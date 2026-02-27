import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";
import {
  calculateFIFOConsumption,
  type FIFOConsumptionResult,
} from "./fifo";

// Type for transaction client (allows use within $transaction)
type PrismaTransaction = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Create stock lot from credit note (sales return)
 */
export async function createStockLotFromCreditNote(
  creditNoteItemId: string,
  productId: string,
  quantity: Decimal | number,
  unitCost: Decimal | number,
  lotDate: Date,
  tx: PrismaTransaction,
  organizationId?: string,
  warehouseId?: string | null
): Promise<string> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  const lotData: any = {
    productId,
    sourceType: "CREDIT_NOTE",
    creditNoteItemId,
    lotDate,
    unitCost: cost,
    initialQuantity: qty,
    remainingQuantity: qty,
  };
  if (organizationId) lotData.organizationId = organizationId;
  if (warehouseId) lotData.warehouseId = warehouseId;

  const stockLot = await tx.stockLot.create({
    data: lotData,
  });

  return stockLot.id;
}

/**
 * Consume stock using FIFO for a debit note (purchase return)
 */
export async function consumeStockForDebitNote(
  productId: string,
  quantityNeeded: Decimal | number,
  debitNoteItemId: string,
  asOfDate: Date,
  tx: PrismaTransaction,
  organizationId?: string,
  warehouseId?: string | null
): Promise<FIFOConsumptionResult> {
  const qty =
    quantityNeeded instanceof Decimal
      ? quantityNeeded
      : new Decimal(quantityNeeded);

  // Calculate what will be consumed using the same FIFO logic
  const result = await calculateFIFOConsumption(productId, qty, asOfDate, tx, warehouseId);

  if (result.insufficientStock) {
    throw new Error(
      `Insufficient stock to process debit note for product ${productId}. ` +
      `Requested: ${qty.toString()}, Available: ${result.availableQuantity.toString()}, ` +
      `Shortfall: ${result.shortfall.toString()}`
    );
  }

  // Create debit note consumption records and update lot quantities
  for (const consumption of result.consumptions) {
    const consumptionData: any = {
      debitNoteItemId,
      stockLotId: consumption.lotId,
      quantityReturned: consumption.quantity,
      unitCost: consumption.unitCost,
      totalCost: consumption.totalCost,
    };
    if (organizationId) consumptionData.organizationId = organizationId;

    await tx.debitNoteLotConsumption.create({
      data: consumptionData,
    });

    // Update lot remaining quantity (reduce stock)
    await tx.stockLot.update({
      where: { id: consumption.lotId },
      data: {
        remainingQuantity: {
          decrement: consumption.quantity,
        },
      },
    });
  }

  return result;
}

/**
 * Restore stock from debit note consumptions (when deleting/editing debit notes)
 */
export async function restoreStockFromDebitNote(
  debitNoteItemId: string,
  tx: PrismaTransaction
): Promise<void> {
  // Get all consumptions for this debit note item
  const consumptions = await tx.debitNoteLotConsumption.findMany({
    where: { debitNoteItemId },
  });

  // Restore quantity to each lot
  for (const consumption of consumptions) {
    await tx.stockLot.update({
      where: { id: consumption.stockLotId },
      data: {
        remainingQuantity: {
          increment: consumption.quantityReturned,
        },
      },
    });
  }

  // Delete the consumption records
  await tx.debitNoteLotConsumption.deleteMany({
    where: { debitNoteItemId },
  });
}

/**
 * Delete stock lot created by credit note (when deleting/editing credit notes)
 */
export async function deleteStockLotFromCreditNote(
  creditNoteItemId: string,
  tx: PrismaTransaction
): Promise<void> {
  // Find the stock lot created by this credit note item
  const stockLot = await tx.stockLot.findUnique({
    where: { creditNoteItemId },
  });

  if (stockLot) {
    // Delete the stock lot (cascade will handle consumptions)
    await tx.stockLot.delete({
      where: { id: stockLot.id },
    });
  }
}

/**
 * Get the original COGS for an invoice item
 */
export async function getOriginalCOGSForInvoiceItem(
  invoiceItemId: string,
  tx: PrismaTransaction = prisma
): Promise<Decimal | null> {
  const invoiceItem = await tx.invoiceItem.findUnique({
    where: { id: invoiceItemId },
    select: { costOfGoodsSold: true, quantity: true },
  });

  if (!invoiceItem) return null;

  // Return per-unit COGS
  if (invoiceItem.quantity.gt(0)) {
    return invoiceItem.costOfGoodsSold.div(invoiceItem.quantity);
  }

  return new Decimal(0);
}

/**
 * Calculate available returnable quantity for a product from purchase invoice
 */
export async function checkReturnableStock(
  productId: string,
  requestedQuantity: Decimal | number,
  tx: PrismaTransaction = prisma,
  warehouseId?: string | null
): Promise<{
  available: Decimal;
  canReturn: boolean;
  shortfall: Decimal;
}> {
  const qty =
    requestedQuantity instanceof Decimal
      ? requestedQuantity
      : new Decimal(requestedQuantity);

  // Get all lots with remaining quantity
  const lotWhere: any = {
    productId,
    remainingQuantity: { gt: 0 },
  };
  if (warehouseId) lotWhere.warehouseId = warehouseId;

  const lots = await tx.stockLot.findMany({
    where: lotWhere,
  });

  const totalAvailable = lots.reduce(
    (sum, lot) => sum.add(lot.remainingQuantity),
    new Decimal(0)
  );

  const canReturn = totalAvailable.gte(qty);
  const shortfall = canReturn ? new Decimal(0) : qty.sub(totalAvailable);

  return {
    available: totalAvailable,
    canReturn,
    shortfall,
  };
}
