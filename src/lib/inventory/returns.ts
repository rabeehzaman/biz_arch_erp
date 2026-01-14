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
 * Uses original COGS as the new unitCost to maintain accurate inventory valuation
 *
 * @param creditNoteItemId - The credit note item creating this lot
 * @param productId - The product being returned
 * @param quantity - Quantity being returned
 * @param unitCost - Original COGS per unit (from the sale)
 * @param lotDate - Date of the credit note (used for FIFO ordering)
 * @param tx - Prisma transaction client
 * @returns The ID of the created stock lot
 */
export async function createStockLotFromCreditNote(
  creditNoteItemId: string,
  productId: string,
  quantity: Decimal | number,
  unitCost: Decimal | number,
  lotDate: Date,
  tx: PrismaTransaction
): Promise<string> {
  const qty = quantity instanceof Decimal ? quantity : new Decimal(quantity);
  const cost = unitCost instanceof Decimal ? unitCost : new Decimal(unitCost);

  const stockLot = await tx.stockLot.create({
    data: {
      productId,
      sourceType: "CREDIT_NOTE",
      creditNoteItemId,
      lotDate,
      unitCost: cost,
      initialQuantity: qty,
      remainingQuantity: qty,
    },
  });

  return stockLot.id;
}

/**
 * Consume stock using FIFO for a debit note (purchase return)
 * Similar to invoice consumption but creates DebitNoteLotConsumption records
 *
 * @param productId - The product being returned to supplier
 * @param quantityNeeded - Quantity to return
 * @param debitNoteItemId - The debit note item consuming the stock
 * @param asOfDate - Date of the debit note (for FIFO calculation)
 * @param tx - Prisma transaction client
 * @returns FIFO consumption result with details of which lots were consumed
 * @throws Error if insufficient stock available
 */
export async function consumeStockForDebitNote(
  productId: string,
  quantityNeeded: Decimal | number,
  debitNoteItemId: string,
  asOfDate: Date,
  tx: PrismaTransaction
): Promise<FIFOConsumptionResult> {
  const qty =
    quantityNeeded instanceof Decimal
      ? quantityNeeded
      : new Decimal(quantityNeeded);

  // Calculate what will be consumed using the same FIFO logic
  const result = await calculateFIFOConsumption(productId, qty, asOfDate, tx);

  if (result.insufficientStock) {
    throw new Error(
      `Insufficient stock to process debit note for product ${productId}. ` +
        `Requested: ${qty.toString()}, Available: ${result.availableQuantity.toString()}, ` +
        `Shortfall: ${result.shortfall.toString()}`
    );
  }

  // Create debit note consumption records and update lot quantities
  for (const consumption of result.consumptions) {
    // Create consumption record
    await tx.debitNoteLotConsumption.create({
      data: {
        debitNoteItemId,
        stockLotId: consumption.lotId,
        quantityReturned: consumption.quantity,
        unitCost: consumption.unitCost,
        totalCost: consumption.totalCost,
      },
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
 * Reverses the stock consumption by adding quantities back to the lots
 *
 * @param debitNoteItemId - The debit note item whose consumptions should be reversed
 * @param tx - Prisma transaction client
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
 * This is simpler than debit note restoration - just delete the lot
 * If the lot has been consumed by sales, those consumptions will be recalculated by FIFO
 *
 * @param creditNoteItemId - The credit note item whose stock lot should be deleted
 * @param tx - Prisma transaction client
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
 * Used when creating credit notes to determine the cost basis for returned inventory
 *
 * @param invoiceItemId - The invoice item to get COGS from
 * @param tx - Prisma transaction client
 * @returns The original COGS, or null if not found
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
 * Checks current stock to ensure we don't try to return more than available
 *
 * @param productId - The product to check
 * @param requestedQuantity - Quantity requested for return
 * @param tx - Prisma transaction client
 * @returns Object with available quantity and whether the requested amount is available
 */
export async function checkReturnableStock(
  productId: string,
  requestedQuantity: Decimal | number,
  tx: PrismaTransaction = prisma
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
  const lots = await tx.stockLot.findMany({
    where: {
      productId,
      remainingQuantity: { gt: 0 },
    },
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
