import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";
import { syncInvoiceCOGSJournal } from "@/lib/accounting/journal";

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
  tx: PrismaTransaction = prisma,
  warehouseId?: string | null
): Promise<StockInfo | null> {
  // Include both the specific warehouse's lots AND null-warehouse lots (legacy stock)
  const lotWhere: any = {
    remainingQuantity: { gt: 0 },
    ...(warehouseId ? { OR: [{ warehouseId }, { warehouseId: null }] } : {}),
  };

  const product = await tx.product.findUnique({
    where: { id: productId },
    include: {
      stockLots: {
        where: lotWhere,
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
  tx: PrismaTransaction = prisma,
  warehouseId?: string | null
): Promise<FIFOConsumptionResult> {
  const qty =
    quantityNeeded instanceof Decimal
      ? quantityNeeded
      : new Decimal(quantityNeeded);

  // Get all lots with remaining quantity, ordered by lotDate ASC (FIFO)
  // When a warehouseId is provided, include both that warehouse's lots AND
  // lots with warehouseId=NULL (legacy stock created before multi-branch was enabled).
  // This prevents COGS = $0 on invoices that should consume pre-existing unassigned stock.
  const lotWhere: any = {
    productId,
    remainingQuantity: { gt: 0 },
    lotDate: { lte: asOfDate },
    ...(warehouseId
      ? { OR: [{ warehouseId }, { warehouseId: null }] }
      : {}),
  };

  const lots = await tx.stockLot.findMany({
    where: lotWhere,
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
  referenceId: string,
  asOfDate: Date,
  tx: PrismaTransaction,
  organizationId?: string,
  warehouseId?: string | null,
  referenceType: "INVOICE" | "STOCK_TRANSFER" | "INVENTORY_ADJUSTMENT" = "INVOICE"
): Promise<FIFOConsumptionResult> {
  const qty =
    quantityNeeded instanceof Decimal
      ? quantityNeeded
      : new Decimal(quantityNeeded);

  // Calculate what will be consumed
  const result = await calculateFIFOConsumption(productId, qty, asOfDate, tx, warehouseId);

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
    const consumptionData: any = {
      stockLotId: consumption.lotId,
      quantityConsumed: consumption.quantity,
      unitCost: consumption.unitCost,
      totalCost: consumption.totalCost,
    };
    if (referenceType === "INVOICE") {
      consumptionData.invoiceItemId = referenceId;
    } else if (referenceType === "STOCK_TRANSFER") {
      consumptionData.stockTransferItemId = referenceId;
    } else {
      consumptionData.inventoryAdjustmentItemId = referenceId;
    }
    if (organizationId) consumptionData.organizationId = organizationId;

    await tx.stockLotConsumption.create({
      data: consumptionData,
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
  referenceId: string,
  tx: PrismaTransaction,
  referenceType: "INVOICE" | "STOCK_TRANSFER" | "INVENTORY_ADJUSTMENT" = "INVOICE"
): Promise<void> {
  // Get all consumptions for this item
  const whereClause = referenceType === "INVOICE"
    ? { invoiceItemId: referenceId }
    : referenceType === "STOCK_TRANSFER"
    ? { stockTransferItemId: referenceId }
    : { inventoryAdjustmentItemId: referenceId };

  const consumptions = await tx.stockLotConsumption.findMany({
    where: whereClause,
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
    where: whereClause,
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
  originalUnitCost?: Decimal | number,
  organizationId?: string,
  warehouseId?: string | null
): Promise<void> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  const lotData: any = {
    productId,
    sourceType: "PURCHASE",
    purchaseInvoiceItemId,
    purchaseInvoiceId,
    lotDate,
    unitCost: cost,
    initialQuantity: qty,
    remainingQuantity: qty,
  };
  if (organizationId) lotData.organizationId = organizationId;
  if (warehouseId) lotData.warehouseId = warehouseId;

  await tx.stockLot.create({
    data: lotData,
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
  tx: PrismaTransaction,
  organizationId?: string,
  warehouseId?: string | null
): Promise<void> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  const lotData: any = {
    productId,
    sourceType: "OPENING_STOCK",
    openingStockId,
    lotDate: stockDate,
    unitCost: cost,
    initialQuantity: qty,
    remainingQuantity: qty,
  };
  if (organizationId) lotData.organizationId = organizationId;
  if (warehouseId) lotData.warehouseId = warehouseId;

  await tx.stockLot.create({
    data: lotData,
  });

  // Auto-update product.cost to opening stock price (fallback cost)
  await tx.product.update({
    where: { id: productId },
    data: { cost },
  });
}

/**
 * Create stock lot from inventory adjustment (INCREASE)
 */
export async function createStockLotFromAdjustment(
  inventoryAdjustmentItemId: string,
  productId: string,
  quantity: Decimal | number,
  unitCost: Decimal | number,
  lotDate: Date,
  tx: PrismaTransaction,
  organizationId?: string,
  warehouseId?: string | null
): Promise<void> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  const lotData: any = {
    productId,
    sourceType: "ADJUSTMENT",
    inventoryAdjustmentItemId,
    lotDate,
    unitCost: cost,
    initialQuantity: qty,
    remainingQuantity: qty,
  };
  if (organizationId) lotData.organizationId = organizationId;
  if (warehouseId) lotData.warehouseId = warehouseId;

  await tx.stockLot.create({
    data: lotData,
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
  triggeredBy?: string,
  organizationId?: string
): Promise<void> {
  // OPTIMIZATION: Early exit if no sales or transfers to recalculate
  const salesCount = await tx.invoiceItem.count({
    where: {
      productId,
      invoice: { issueDate: { gte: fromDate } },
    },
  });

  const transfersCount = await tx.stockTransferItem.count({
    where: {
      productId,
      stockTransfer: { transferDate: { gte: fromDate }, status: { in: ["APPROVED", "IN_TRANSIT", "COMPLETED", "REVERSED", "CANCELLED"] } },
    }
  });

  const debitNotesCount = await tx.debitNoteItem.count({
    where: {
      productId,
      debitNote: { issueDate: { gte: fromDate } },
    }
  });

  const creditNotesCount = await tx.creditNoteItem.count({
    where: {
      productId,
      creditNote: { issueDate: { gte: fromDate } },
    }
  });

  const adjustmentDecreaseCount = await tx.inventoryAdjustmentItem.count({
    where: {
      productId,
      adjustmentType: "DECREASE",
      inventoryAdjustment: { adjustmentDate: { gte: fromDate } },
    },
  });

  if (salesCount === 0 && transfersCount === 0 && debitNotesCount === 0 && creditNotesCount === 0 && adjustmentDecreaseCount === 0) {
    // No sales, transfers, debit notes, credit notes, or adjustment decreases from this date onwards, nothing to recalculate
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
          stockTransferItem: {
            include: {
              stockTransfer: true,
            },
          },
          inventoryAdjustmentItem: {
            include: {
              inventoryAdjustment: true,
            },
          },
        },
      },
      debitNoteConsumptions: {
        include: {
          debitNoteItem: {
            include: {
              debitNote: true,
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

  // 2b. Get all stock transfer items for this product from fromDate onwards
  const transferItems = await tx.stockTransferItem.findMany({
    where: {
      productId,
      stockTransfer: { transferDate: { gte: fromDate }, status: { in: ["APPROVED", "IN_TRANSIT", "COMPLETED"] } }
    },
    include: {
      stockTransfer: true,
      lotConsumptions: true
    },
    orderBy: { stockTransfer: { transferDate: "asc" } },
  });

  // 2c. Get all debit note items for this product from fromDate onwards
  const debitNoteItems = await tx.debitNoteItem.findMany({
    where: {
      productId,
      debitNote: { issueDate: { gte: fromDate } }
    },
    include: {
      debitNote: true,
      lotConsumptions: true
    },
    orderBy: { debitNote: { issueDate: "asc" } }
  });

  // 2d. Get all credit note items for this product from fromDate onwards
  const creditNoteItems = await tx.creditNoteItem.findMany({
    where: {
      productId,
      creditNote: { issueDate: { gte: fromDate } }
    },
    include: {
      creditNote: true,
      stockLot: true
    },
    orderBy: { creditNote: { issueDate: "asc" } }
  });

  // 2e. Get all inventory adjustment DECREASE items for this product from fromDate onwards
  const adjustmentDecreaseItems = await tx.inventoryAdjustmentItem.findMany({
    where: {
      productId,
      adjustmentType: "DECREASE",
      inventoryAdjustment: { adjustmentDate: { gte: fromDate } },
    },
    include: {
      inventoryAdjustment: true,
      lotConsumptions: true,
    },
    orderBy: { inventoryAdjustment: { adjustmentDate: "asc" } },
  });

  // Merge into a single timeline sorted by date
  type TimelineEvent =
    | { type: "INVOICE", item: typeof salesItems[0], date: Date }
    | { type: "STOCK_TRANSFER", item: typeof transferItems[0], date: Date }
    | { type: "DEBIT_NOTE", item: typeof debitNoteItems[0], date: Date }
    | { type: "CREDIT_NOTE", item: typeof creditNoteItems[0], date: Date }
    | { type: "ADJUSTMENT_DECREASE", item: typeof adjustmentDecreaseItems[0], date: Date };

  const events: TimelineEvent[] = [
    ...salesItems.map(item => ({ type: "INVOICE" as const, item, date: item.invoice.issueDate })),
    ...transferItems.map(item => ({ type: "STOCK_TRANSFER" as const, item, date: item.stockTransfer.transferDate })),
    ...debitNoteItems.map(item => ({ type: "DEBIT_NOTE" as const, item, date: item.debitNote.issueDate })),
    ...creditNoteItems.map(item => ({ type: "CREDIT_NOTE" as const, item, date: item.creditNote.issueDate })),
    ...adjustmentDecreaseItems.map(item => ({ type: "ADJUSTMENT_DECREASE" as const, item, date: item.inventoryAdjustment.adjustmentDate })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // 3. Reset all lot quantities
  for (const lot of allLots) {
    if (lot.lotDate < fromDate) {
      // Calculate how much was consumed before fromDate
      const preConsumption = lot.consumptions
        .filter((c) => {
          if (c.invoiceItem?.invoice?.issueDate) return c.invoiceItem.invoice.issueDate < fromDate;
          if (c.stockTransferItem?.stockTransfer?.transferDate) return c.stockTransferItem.stockTransfer.transferDate < fromDate;
          if (c.inventoryAdjustmentItem?.inventoryAdjustment?.adjustmentDate) return c.inventoryAdjustmentItem.inventoryAdjustment.adjustmentDate < fromDate;
          return false;
        })
        .reduce((sum, c) => sum.add(c.quantityConsumed), new Decimal(0));

      const preDebitNoteConsumption = lot.debitNoteConsumptions
        .filter((c) => {
          if (c.debitNoteItem?.debitNote?.issueDate) return c.debitNoteItem.debitNote.issueDate < fromDate;
          return false;
        })
        .reduce((sum, c) => sum.add(c.quantityReturned), new Decimal(0));

      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingQuantity: lot.initialQuantity.sub(preConsumption).sub(preDebitNoteConsumption) },
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
  const transferItemIds = transferItems.map((t) => t.id);
  const debitNoteItemIds = debitNoteItems.map((dn) => dn.id);
  const adjustmentItemIds = adjustmentDecreaseItems.map((a) => a.id);

  if (itemIds.length > 0) {
    await tx.stockLotConsumption.deleteMany({
      where: { invoiceItemId: { in: itemIds } },
    });
  }
  if (transferItemIds.length > 0) {
    await tx.stockLotConsumption.deleteMany({
      where: { stockTransferItemId: { in: transferItemIds } },
    });
  }
  if (debitNoteItemIds.length > 0) {
    await tx.debitNoteLotConsumption.deleteMany({
      where: { debitNoteItemId: { in: debitNoteItemIds } },
    });
  }
  if (adjustmentItemIds.length > 0) {
    await tx.stockLotConsumption.deleteMany({
      where: { inventoryAdjustmentItemId: { in: adjustmentItemIds } },
    });
  }

  // 5. Re-process each event in date order and log cost changes
  const affectedInvoiceIds = new Set<string>();

  for (const event of events) {
    const item = event.item;
    if (!item.productId) continue;

    if (event.type === "INVOICE") {
      const saleItem = item as typeof salesItems[0];
      // Skip jewellery items — they use status-based tracking, not FIFO lots
      if (saleItem.jewelleryItemId) continue;
      const oldCOGS = saleItem.costOfGoodsSold;
      const baseQty = new Decimal(saleItem.quantity).mul(new Decimal(saleItem.conversionFactor || 1));

      const fifoResult = await consumeStockFIFO(
        saleItem.productId!,
        baseQty,
        saleItem.id,
        event.date,
        tx,
        organizationId,
        saleItem.invoice.warehouseId || null,
        "INVOICE"
      );

      const newCOGS = fifoResult.totalCOGS;

      await tx.invoiceItem.update({
        where: { id: saleItem.id },
        data: { costOfGoodsSold: newCOGS },
      });

      if (!oldCOGS.equals(newCOGS)) {
        affectedInvoiceIds.add(saleItem.invoice.id);
        const auditData: any = {
          productId: saleItem.productId,
          invoiceItemId: saleItem.id,
          oldCOGS,
          newCOGS,
          changeAmount: newCOGS.sub(oldCOGS),
          changeReason,
          triggeredBy: triggeredBy || null,
        };
        if (organizationId) auditData.organizationId = organizationId;

        await tx.costAuditLog.create({ data: auditData });
      }
    } else if (event.type === "STOCK_TRANSFER") {
      const stItem = item as typeof transferItems[0];
      const baseQty = new Decimal(stItem.quantity); // Transfers don't have conversion factor in schema right now

      const fifoResult = await consumeStockFIFO(
        stItem.productId,
        baseQty,
        stItem.id,
        event.date,
        tx,
        organizationId,
        stItem.stockTransfer.sourceWarehouseId,
        "STOCK_TRANSFER"
      );

      const newTotalCost = fifoResult.totalCOGS;
      const newUnitCost = baseQty.gt(0) ? newTotalCost.div(baseQty) : new Decimal(0);

      await tx.stockTransferItem.update({
        where: { id: stItem.id },
        data: { unitCost: newUnitCost },
      });

      // Update the destination stock lot's unit cost! This is the multi-tier cost propagation!
      if (stItem.stockTransfer.status === "COMPLETED") {
        await tx.stockLot.updateMany({
          where: {
            stockTransferId: stItem.stockTransferId,
            warehouseId: stItem.stockTransfer.destinationWarehouseId,
            productId: stItem.productId,
            sourceType: "STOCK_TRANSFER"
          },
          data: { unitCost: newUnitCost }
        });
      }
    } else if (event.type === "DEBIT_NOTE") {
      const dnItem = item as typeof debitNoteItems[0];
      const baseQty = new Decimal(dnItem.quantity).mul(new Decimal(dnItem.conversionFactor || 1));

      const result = await calculateFIFOConsumption(
        dnItem.productId,
        baseQty,
        event.date,
        tx,
        dnItem.debitNote.warehouseId || null
      );

      for (const consumption of result.consumptions) {
        const consumptionData: any = {
          debitNoteItemId: dnItem.id,
          stockLotId: consumption.lotId,
          quantityReturned: consumption.quantity,
          unitCost: consumption.unitCost,
          totalCost: consumption.totalCost,
        };
        if (organizationId) consumptionData.organizationId = organizationId;

        await tx.debitNoteLotConsumption.create({
          data: consumptionData
        });

        await tx.stockLot.update({
          where: { id: consumption.lotId },
          data: { remainingQuantity: { decrement: consumption.quantity } }
        });
      }
    } else if (event.type === "ADJUSTMENT_DECREASE") {
      const adjItem = item as typeof adjustmentDecreaseItems[0];
      const baseQty = new Decimal(adjItem.quantity);

      await consumeStockFIFO(
        adjItem.productId,
        baseQty,
        adjItem.id,
        event.date,
        tx,
        organizationId,
        adjItem.inventoryAdjustment.warehouseId || null,
        "INVENTORY_ADJUSTMENT"
      );
    } else if (event.type === "CREDIT_NOTE") {
      const cnItem = item as typeof creditNoteItems[0];
      if (cnItem.stockLot) {
        let newUnitCost = new Decimal(0);

        // Try to get updated unit cost from the original invoice item, whose COGS was just correctly recalculated earlier in this timeline!
        if (cnItem.invoiceItemId) {
          const invoiceItem = await tx.invoiceItem.findUnique({
            where: { id: cnItem.invoiceItemId },
            select: { costOfGoodsSold: true, quantity: true }
          });
          if (invoiceItem && invoiceItem.quantity.gt(0)) {
            newUnitCost = invoiceItem.costOfGoodsSold.div(invoiceItem.quantity);
          }
        }

        // Fallback to originalCOGS if present
        if (newUnitCost.lte(0) && cnItem.originalCOGS && new Decimal(cnItem.originalCOGS).gt(0)) {
          newUnitCost = new Decimal(cnItem.originalCOGS);
        }

        // Fallback to product cost
        if (newUnitCost.lte(0) && cnItem.productId) {
          const product = await tx.product.findUnique({
            where: { id: cnItem.productId },
            select: { cost: true }
          });
          if (product) newUnitCost = product.cost;
        }

        // Update the stock lot that this Credit Note generated
        await tx.stockLot.update({
          where: { id: cnItem.stockLot.id },
          data: { unitCost: newUnitCost }
        });
      }
    }
  }

  // 6. Sync COGS journal entries for all invoices whose COGS changed
  if (organizationId) {
    for (const invoiceId of affectedInvoiceIds) {
      await syncInvoiceCOGSJournal(tx, organizationId, invoiceId);
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

    if (consumption.invoiceItemId) {
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
    } else if (consumption.stockTransferItemId) {
      const allConsumptions = await tx.stockLotConsumption.findMany({
        where: { stockTransferItemId: consumption.stockTransferItemId },
      });

      const totalCost = allConsumptions.reduce(
        (sum, c) => sum.add(c.totalCost),
        new Decimal(0)
      );

      const stItem = await tx.stockTransferItem.findUnique({ where: { id: consumption.stockTransferItemId } });
      if (stItem) {
        const newUnitCost = stItem.quantity.gt(0) ? totalCost.div(stItem.quantity) : new Decimal(0);
        await tx.stockTransferItem.update({
          where: { id: consumption.stockTransferItemId },
          data: { unitCost: newUnitCost }
        });

        await tx.stockLot.updateMany({
          where: {
            stockTransferId: stItem.stockTransferId,
            productId: stItem.productId,
            sourceType: "STOCK_TRANSFER"
          },
          data: { unitCost: newUnitCost }
        });
      }
    }
  }
}
