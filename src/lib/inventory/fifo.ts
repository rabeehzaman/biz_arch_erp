import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

// Type for transaction client (allows use within $transaction)
type PrismaTransaction = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Result types
export interface LotConsumption {
  lotId: string;
  quantity: Decimal;
  unitCost: Decimal;
  totalCost: Decimal;
}

export interface FIFOConsumptionResult {
  consumptions: LotConsumption[];
  totalCOGS: Decimal;
  insufficientStock: boolean;
  shortfall: Decimal;
  availableQuantity: Decimal;
  usedFallbackCost: boolean; // Indicates if product.cost was used instead of FIFO lots
  warnings: string[]; // Array of warning messages for the user
}

export interface StockInfo {
  productId: string;
  productName: string;
  totalQuantity: Decimal;
  averageCost: Decimal;
  totalValue: Decimal;
  lots: {
    id: string;
    lotDate: Date;
    unitCost: Decimal;
    initialQuantity: Decimal;
    remainingQuantity: Decimal;
    sourceType: string;
  }[];
}

/**
 * Get available stock for a product using FIFO ordering
 */
export async function getProductStock(
  productId: string,
  tx: PrismaTransaction = prisma
): Promise<StockInfo | null> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: {
      stockLots: {
        where: { remainingQuantity: { gt: 0 } },
        orderBy: { lotDate: "asc" },
      },
    },
  });

  if (!product) return null;

  const lots = product.stockLots;
  const totalQuantity = lots.reduce(
    (sum, lot) => sum.add(lot.remainingQuantity),
    new Decimal(0)
  );
  const totalValue = lots.reduce(
    (sum, lot) => sum.add(lot.remainingQuantity.mul(lot.unitCost)),
    new Decimal(0)
  );
  const averageCost = totalQuantity.gt(0)
    ? totalValue.div(totalQuantity)
    : new Decimal(0);

  return {
    productId: product.id,
    productName: product.name,
    totalQuantity,
    averageCost,
    totalValue,
    lots: lots.map((lot) => ({
      id: lot.id,
      lotDate: lot.lotDate,
      unitCost: lot.unitCost,
      initialQuantity: lot.initialQuantity,
      remainingQuantity: lot.remainingQuantity,
      sourceType: lot.sourceType,
    })),
  };
}

/**
 * Calculate FIFO consumption without actually modifying the database
 * Used for previewing COGS before creating an invoice
 */
export async function calculateFIFOConsumption(
  productId: string,
  quantityNeeded: Decimal | number,
  asOfDate: Date,
  tx: PrismaTransaction = prisma
): Promise<FIFOConsumptionResult> {
  const qty =
    quantityNeeded instanceof Decimal
      ? quantityNeeded
      : new Decimal(quantityNeeded);

  // Get all lots with remaining quantity, ordered by lotDate ASC (FIFO)
  const lots = await tx.stockLot.findMany({
    where: {
      productId,
      remainingQuantity: { gt: 0 },
      lotDate: { lte: asOfDate }, // Only consider lots dated on or before the sale
    },
    orderBy: { lotDate: "asc" },
  });

  let remainingToConsume = qty;
  const consumptions: LotConsumption[] = [];
  let totalAvailable = new Decimal(0);

  for (const lot of lots) {
    totalAvailable = totalAvailable.add(lot.remainingQuantity);

    if (remainingToConsume.lte(0)) continue;

    const consumeFromLot = Decimal.min(lot.remainingQuantity, remainingToConsume);

    consumptions.push({
      lotId: lot.id,
      quantity: consumeFromLot,
      unitCost: lot.unitCost,
      totalCost: consumeFromLot.mul(lot.unitCost),
    });

    remainingToConsume = remainingToConsume.sub(consumeFromLot);
  }

  const totalCOGS = consumptions.reduce(
    (sum, c) => sum.add(c.totalCost),
    new Decimal(0)
  );

  return {
    consumptions,
    totalCOGS,
    insufficientStock: remainingToConsume.gt(0),
    shortfall: remainingToConsume.gt(0) ? remainingToConsume : new Decimal(0),
    availableQuantity: totalAvailable,
    usedFallbackCost: false, // Will be set in consumeStockFIFO if fallback is used
    warnings: [],
  };
}

/**
 * Consume stock using FIFO method
 * Creates StockLotConsumption records and updates lot remaining quantities
 */
export async function consumeStockFIFO(
  productId: string,
  quantityNeeded: Decimal | number,
  invoiceItemId: string,
  asOfDate: Date,
  tx: PrismaTransaction
): Promise<FIFOConsumptionResult> {
  const qty =
    quantityNeeded instanceof Decimal
      ? quantityNeeded
      : new Decimal(quantityNeeded);

  // Calculate what will be consumed
  const result = await calculateFIFOConsumption(productId, qty, asOfDate, tx);

  // If there's nothing to consume, return early
  if (result.consumptions.length === 0) {
    // If no lots available, try to use product's default cost
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { cost: true, name: true },
    });

    const fallbackCost = product?.cost || new Decimal(0);
    const warnings: string[] = [];

    // Generate appropriate warning messages
    if (fallbackCost.lte(0)) {
      warnings.push(
        `Product "${product?.name || productId}" has no stock and no fallback cost set. COGS will be $0.`
      );
    } else {
      warnings.push(
        `Product "${product?.name || productId}" has no stock. Using fallback cost of $${fallbackCost.toFixed(2)}/unit.`
      );
    }

    // Return with fallback cost or zero
    return {
      ...result,
      totalCOGS: qty.mul(fallbackCost),
      usedFallbackCost: true,
      warnings,
    };
  }

  // Create consumption records and update lot quantities
  for (const consumption of result.consumptions) {
    // Create consumption record
    await tx.stockLotConsumption.create({
      data: {
        stockLotId: consumption.lotId,
        invoiceItemId,
        quantityConsumed: consumption.quantity,
        unitCost: consumption.unitCost,
        totalCost: consumption.totalCost,
      },
    });

    // Update lot remaining quantity
    await tx.stockLot.update({
      where: { id: consumption.lotId },
      data: {
        remainingQuantity: {
          decrement: consumption.quantity,
        },
      },
    });
  }

  // Check if there was insufficient stock and handle shortfall with fallback cost
  if (result.insufficientStock && result.shortfall.gt(0)) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { cost: true, name: true },
    });

    const fallbackCost = product?.cost || new Decimal(0);
    const shortfallCost = result.shortfall.mul(fallbackCost);
    const warnings: string[] = [];

    // Add shortfall cost to total COGS
    const updatedTotalCOGS = result.totalCOGS.add(shortfallCost);

    // Generate warning message
    if (fallbackCost.lte(0)) {
      warnings.push(
        `Product "${product?.name || productId}" only has ${result.availableQuantity.toFixed(2)} units in stock, but ${qty.toFixed(2)} were sold. Shortfall of ${result.shortfall.toFixed(2)} units costed at $0 (no fallback cost set).`
      );
    } else {
      warnings.push(
        `Product "${product?.name || productId}" only has ${result.availableQuantity.toFixed(2)} units in stock, but ${qty.toFixed(2)} were sold. Shortfall of ${result.shortfall.toFixed(2)} units costed at fallback price of $${fallbackCost.toFixed(2)}/unit.`
      );
    }

    return {
      ...result,
      totalCOGS: updatedTotalCOGS,
      usedFallbackCost: true,
      warnings,
    };
  }

  return result;
}

/**
 * Restore stock from consumptions (used when deleting/editing invoices)
 */
export async function restoreStockFromConsumptions(
  invoiceItemId: string,
  tx: PrismaTransaction
): Promise<void> {
  // Get all consumptions for this invoice item
  const consumptions = await tx.stockLotConsumption.findMany({
    where: { invoiceItemId },
  });

  // Restore quantity to each lot
  for (const consumption of consumptions) {
    await tx.stockLot.update({
      where: { id: consumption.stockLotId },
      data: {
        remainingQuantity: {
          increment: consumption.quantityConsumed,
        },
      },
    });
  }

  // Delete the consumption records
  await tx.stockLotConsumption.deleteMany({
    where: { invoiceItemId },
  });
}

/**
 * Create stock lot from purchase invoice item
 */
export async function createStockLotFromPurchase(
  purchaseInvoiceItemId: string,
  purchaseInvoiceId: string,
  productId: string,
  quantity: Decimal | number,
  unitCost: Decimal | number,
  lotDate: Date,
  tx: PrismaTransaction,
  originalUnitCost?: Decimal | number
): Promise<void> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  await tx.stockLot.create({
    data: {
      productId,
      sourceType: "PURCHASE",
      purchaseInvoiceItemId,
      purchaseInvoiceId,
      lotDate,
      unitCost: cost,
      initialQuantity: qty,
      remainingQuantity: qty,
    },
  });

  // Auto-update product.cost to original MRP (pre-discount) for form auto-population
  const productCost = originalUnitCost != null
    ? (originalUnitCost instanceof Decimal ? originalUnitCost : new Decimal(originalUnitCost))
    : cost;

  await tx.product.update({
    where: { id: productId },
    data: { cost: productCost },
  });
}

/**
 * Create stock lot from opening stock entry
 */
export async function createStockLotFromOpeningStock(
  openingStockId: string,
  productId: string,
  quantity: Decimal | number,
  unitCost: Decimal | number,
  stockDate: Date,
  tx: PrismaTransaction
): Promise<void> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  await tx.stockLot.create({
    data: {
      productId,
      sourceType: "OPENING_STOCK",
      openingStockId,
      lotDate: stockDate,
      unitCost: cost,
      initialQuantity: qty,
      remainingQuantity: qty,
    },
  });

  // Auto-update product.cost to opening stock price (fallback cost)
  await tx.product.update({
    where: { id: productId },
    data: { cost },
  });
}

/**
 * Recalculate FIFO for a product from a specific date forward
 * Used when backdated transactions are edited
 */
export async function recalculateFromDate(
  productId: string,
  fromDate: Date,
  tx: PrismaTransaction,
  changeReason: string = "recalculation",
  triggeredBy?: string
): Promise<void> {
  // OPTIMIZATION: Early exit if no sales to recalculate
  const salesCount = await tx.invoiceItem.count({
    where: {
      productId,
      invoice: { issueDate: { gte: fromDate } },
    },
  });

  if (salesCount === 0) {
    // No sales from this date onwards, nothing to recalculate
    return;
  }

  // 1. Get all stock lots for this product
  const allLots = await tx.stockLot.findMany({
    where: { productId },
    orderBy: { lotDate: "asc" },
    include: {
      consumptions: {
        include: {
          invoiceItem: {
            include: {
              invoice: true,
            },
          },
        },
      },
    },
  });

  // 2. Get all sales invoice items for this product from fromDate onwards
  const salesItems = await tx.invoiceItem.findMany({
    where: {
      productId,
      invoice: { issueDate: { gte: fromDate } },
    },
    include: {
      invoice: true,
      lotConsumptions: true,
    },
    orderBy: { invoice: { issueDate: "asc" } },
  });

  // 3. Reset all lot quantities
  for (const lot of allLots) {
    if (lot.lotDate < fromDate) {
      // Calculate how much was consumed before fromDate
      const preConsumption = lot.consumptions
        .filter((c) => c.invoiceItem.invoice.issueDate < fromDate)
        .reduce((sum, c) => sum.add(c.quantityConsumed), new Decimal(0));

      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: lot.initialQuantity.sub(preConsumption) },
      });
    } else {
      // Reset to full initial quantity
      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: lot.initialQuantity },
      });
    }
  }

  // 4. Delete all consumptions from fromDate onwards
  const itemIds = salesItems.map((item) => item.id);
  if (itemIds.length > 0) {
    await tx.stockLotConsumption.deleteMany({
      where: { invoiceItemId: { in: itemIds } },
    });
  }

  // 5. Re-process each sale in date order and log cost changes
  for (const item of salesItems) {
    if (!item.productId) continue;

    const oldCOGS = item.costOfGoodsSold;

    const fifoResult = await consumeStockFIFO(
      item.productId,
      item.quantity,
      item.id,
      item.invoice.issueDate,
      tx
    );

    const newCOGS = fifoResult.totalCOGS;

    // Update invoice item COGS
    await tx.invoiceItem.update({
      where: { id: item.id },
      data: { costOfGoodsSold: newCOGS },
    });

    // Log cost change if COGS changed
    if (!oldCOGS.equals(newCOGS)) {
      await tx.costAuditLog.create({
        data: {
          productId: item.productId,
          invoiceItemId: item.id,
          oldCOGS,
          newCOGS,
          changeAmount: newCOGS.sub(oldCOGS),
          changeReason,
          triggeredBy: triggeredBy || null,
        },
      });
    }
  }
}

/**
 * Check if a date is backdated (before the most recent transaction for a product)
 */
export async function isBackdated(
  productId: string,
  transactionDate: Date,
  tx: PrismaTransaction = prisma
): Promise<boolean> {
  // Check if there are any sales after this date
  const laterSale = await tx.invoiceItem.findFirst({
    where: {
      productId,
      invoice: { issueDate: { gt: transactionDate } },
    },
  });

  return laterSale !== null;
}

/**
 * Check if there are any zero-COGS items for a product that need recalculation
 * Returns the earliest date that needs recalculation, or null if no zero-COGS items
 */
export async function hasZeroCOGSItems(
  productId: string,
  tx: PrismaTransaction = prisma
): Promise<Date | null> {
  // Find the earliest invoice item with zero COGS for this product
  const earliestZeroCOGS = await tx.invoiceItem.findFirst({
    where: {
      productId,
      costOfGoodsSold: 0,
    },
    include: {
      invoice: {
        select: { issueDate: true },
      },
    },
    orderBy: {
      invoice: { issueDate: "asc" },
    },
  });

  return earliestZeroCOGS ? earliestZeroCOGS.invoice.issueDate : null;
}

/**
 * Get the earliest date that needs recalculation when editing a transaction
 */
export function getRecalculationStartDate(
  oldDate: Date | null,
  newDate: Date
): Date {
  if (!oldDate) return newDate;
  return oldDate < newDate ? oldDate : newDate;
}

/**
 * Delete a stock lot and trigger recalculation if needed
 */
export async function deleteStockLot(
  lotId: string,
  tx: PrismaTransaction
): Promise<{ needsRecalculation: boolean; productId: string; fromDate: Date }> {
  const lot = await tx.stockLot.findUnique({
    where: { id: lotId },
    include: { consumptions: true },
  });

  if (!lot) {
    throw new Error("Stock lot not found");
  }

  const needsRecalculation = lot.consumptions.length > 0;
  const productId = lot.productId;
  const fromDate = lot.lotDate;

  // Delete the lot (consumptions will be handled by recalculation)
  await tx.stockLot.delete({
    where: { id: lotId },
  });

  return { needsRecalculation, productId, fromDate };
}

/**
 * Update a stock lot's cost and trigger recalculation
 */
export async function updateStockLotCost(
  lotId: string,
  newUnitCost: Decimal | number,
  tx: PrismaTransaction
): Promise<void> {
  const cost =
    newUnitCost instanceof Decimal ? newUnitCost : new Decimal(newUnitCost);

  const lot = await tx.stockLot.findUnique({
    where: { id: lotId },
    include: { consumptions: true },
  });

  if (!lot) {
    throw new Error("Stock lot not found");
  }

  // Update the lot cost
  await tx.stockLot.update({
    where: { id: lotId },
    data: { unitCost: cost },
  });

  // If there are consumptions, recalculate their costs
  for (const consumption of lot.consumptions) {
    const newTotalCost = consumption.quantityConsumed.mul(cost);
    await tx.stockLotConsumption.update({
      where: { id: consumption.id },
      data: {
        unitCost: cost,
        totalCost: newTotalCost,
      },
    });

    // Get all consumptions for this invoice item to recalculate total COGS
    const allConsumptions = await tx.stockLotConsumption.findMany({
      where: { invoiceItemId: consumption.invoiceItemId },
    });

    const totalCOGS = allConsumptions.reduce(
      (sum, c) => sum.add(c.totalCost),
      new Decimal(0)
    );

    await tx.invoiceItem.update({
      where: { id: consumption.invoiceItemId },
      data: { costOfGoodsSold: totalCOGS },
    });
  }
}
