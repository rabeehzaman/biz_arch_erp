import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import {
  createStockLotFromAdjustment,
  consumeStockFIFO,
  restoreStockFromConsumptions,
  recalculateFromDate,
  isBackdated,
  hasZeroCOGSItems,
  getProductStock,
} from "@/lib/inventory/fifo";
import {
  createAutoJournalEntry,
  getSystemAccount,
  ensureInventoryAdjustmentAccounts,
} from "@/lib/accounting/journal";
import { toMidnightUTC } from "@/lib/date-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);
    const { id } = await params;

    const adjustment = await prisma.inventoryAdjustment.findUnique({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: { select: { name: true, code: true } } },
            },
            stockLot: { select: { id: true, remainingQuantity: true } },
          },
        },
      },
    });

    if (!adjustment) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }

    return NextResponse.json(adjustment);
  } catch (error) {
    console.error("Failed to fetch stock take:", error);
    return NextResponse.json({ error: "Failed to fetch stock take" }, { status: 500 });
  }
}

// PUT — update a stock take (DRAFT: just update items; RECONCILED: reverse → update → re-reconcile)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { adjustmentDate, warehouseId, notes, items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const existing = await prisma.inventoryAdjustment.findUnique({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            stockLot: { include: { consumptions: true } },
            lotConsumptions: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }

    const wasReconciled = existing.status === "RECONCILED";
    const parsedDate = adjustmentDate ? toMidnightUTC(adjustmentDate) : existing.adjustmentDate;
    const wId = warehouseId !== undefined ? (warehouseId || null) : existing.warehouseId;

    await prisma.$transaction(
      async (tx) => {
        // 1. If reconciled, reverse all existing stock effects first
        if (wasReconciled) {
          const recalcProducts = new Map<string, Date>();

          for (const item of existing.items) {
            if (Number(item.quantity) === 0) continue;

            if (item.adjustmentType === "INCREASE" && item.stockLot) {
              const hasConsumptions = (item.stockLot.consumptions?.length ?? 0) > 0;
              await tx.stockLot.update({
                where: { id: item.stockLot.id },
                data: { initialQuantity: 0, remainingQuantity: 0 },
              });
              if (hasConsumptions) {
                recalcProducts.set(item.productId, existing.adjustmentDate);
              }
            } else if (item.adjustmentType === "DECREASE") {
              await restoreStockFromConsumptions(item.id, tx, "INVENTORY_ADJUSTMENT");
            }

            // Delete journal entries
            await tx.journalEntry.deleteMany({
              where: { sourceType: "INVENTORY_ADJUSTMENT", sourceId: item.id, organizationId },
            });
          }

          // Recalculate FIFO for reversed products
          for (const [productId, fromDate] of recalcProducts) {
            await recalculateFromDate(productId, fromDate, tx, "stock_take_edit_reverse", undefined, organizationId);
          }

          // Clean up stock lots
          for (const item of existing.items) {
            if (item.adjustmentType === "INCREASE" && item.stockLot) {
              await tx.stockLotConsumption.deleteMany({ where: { stockLotId: item.stockLot.id } });
              await tx.stockLot.delete({ where: { id: item.stockLot.id } });
            }
          }
        }

        // 2. Delete old items
        await tx.inventoryAdjustmentItem.deleteMany({
          where: { inventoryAdjustmentId: id },
        });

        // 3. Update header
        await tx.inventoryAdjustment.update({
          where: { id },
          data: {
            adjustmentDate: parsedDate,
            notes: notes ?? existing.notes,
            warehouseId: wId,
          },
        });

        // 4. Recreate items with fresh system quantities
        const newItemIds: { id: string; productId: string; adjustmentType: string; quantity: number; productName: string }[] = [];

        for (const item of items) {
          const physicalQty = parseFloat(String(item.physicalQuantity));
          const stockInfo = await getProductStock(item.productId, tx, wId);
          const systemQty = stockInfo ? Number(stockInfo.totalQuantity) : 0;
          const avgCost = stockInfo && stockInfo.totalQuantity.gt(0)
            ? Number(stockInfo.totalValue.div(stockInfo.totalQuantity))
            : 0;

          const diff = physicalQty - systemQty;
          const adjustmentType = diff >= 0 ? "INCREASE" : "DECREASE";
          const absQuantity = Math.abs(diff);
          const unitCost = item.unitCost !== undefined ? parseFloat(String(item.unitCost)) : avgCost;

          const created = await tx.inventoryAdjustmentItem.create({
            data: {
              inventoryAdjustmentId: id,
              organizationId,
              productId: item.productId,
              systemQuantity: systemQty,
              physicalQuantity: physicalQty,
              adjustmentType,
              quantity: absQuantity,
              unitCost: unitCost || 0,
              reason: item.reason || null,
            },
            include: { product: true },
          });

          newItemIds.push({
            id: created.id,
            productId: created.productId,
            adjustmentType,
            quantity: absQuantity,
            productName: created.product.name,
          });
        }

        // 5. If was reconciled, re-apply stock effects to stay reconciled
        if (wasReconciled) {
          const adjAccounts = await ensureInventoryAdjustmentAccounts(tx, organizationId);
          const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
          const recalcProducts = new Map<string, Date>();

          for (const newItem of newItemIds) {
            if (newItem.quantity === 0) continue;

            if (newItem.adjustmentType === "INCREASE") {
              const unitCostRecord = await tx.inventoryAdjustmentItem.findUnique({
                where: { id: newItem.id },
                select: { unitCost: true },
              });
              const unitCost = Number(unitCostRecord?.unitCost ?? 0);

              await createStockLotFromAdjustment(
                newItem.id, newItem.productId, newItem.quantity, unitCost,
                parsedDate, tx, organizationId, wId
              );

              const totalValue = newItem.quantity * unitCost;
              if (totalValue > 0 && inventoryAccount && adjAccounts) {
                await createAutoJournalEntry(tx, organizationId, {
                  date: parsedDate,
                  description: `Stock Take (Increase) - ${newItem.productName}`,
                  sourceType: "INVENTORY_ADJUSTMENT",
                  sourceId: newItem.id,
                  lines: [
                    { accountId: inventoryAccount.id, description: "Inventory", debit: totalValue, credit: 0 },
                    { accountId: adjAccounts.adjustmentIncome.id, description: "Adjustment Gain", debit: 0, credit: totalValue },
                  ],
                });
              }
            } else {
              const fifoResult = await consumeStockFIFO(
                newItem.productId, newItem.quantity, newItem.id,
                parsedDate, tx, organizationId, wId, "INVENTORY_ADJUSTMENT"
              );

              const actualUnitCost = newItem.quantity > 0 ? Number(fifoResult.totalCOGS) / newItem.quantity : 0;
              await tx.inventoryAdjustmentItem.update({
                where: { id: newItem.id },
                data: { unitCost: actualUnitCost },
              });

              const totalValue = Number(fifoResult.totalCOGS);
              if (totalValue > 0 && inventoryAccount && adjAccounts) {
                await createAutoJournalEntry(tx, organizationId, {
                  date: parsedDate,
                  description: `Stock Take (Decrease) - ${newItem.productName}`,
                  sourceType: "INVENTORY_ADJUSTMENT",
                  sourceId: newItem.id,
                  lines: [
                    { accountId: adjAccounts.adjustmentExpense.id, description: "Adjustment Loss", debit: totalValue, credit: 0 },
                    { accountId: inventoryAccount.id, description: "Inventory", debit: 0, credit: totalValue },
                  ],
                });
              }
            }

            // Backdating check
            const backdated = await isBackdated(newItem.productId, parsedDate, tx);
            const zeroCOGSDate = await hasZeroCOGSItems(newItem.productId, tx);
            let recalcDate: Date | null = null;
            if (backdated) recalcDate = parsedDate;
            if (zeroCOGSDate) {
              recalcDate = recalcDate ? (recalcDate < zeroCOGSDate ? recalcDate : zeroCOGSDate) : zeroCOGSDate;
            }
            if (recalcDate) {
              const ex = recalcProducts.get(newItem.productId);
              if (!ex || recalcDate < ex) recalcProducts.set(newItem.productId, recalcDate);
            }
          }

          for (const [productId, fromDate] of recalcProducts) {
            await recalculateFromDate(productId, fromDate, tx, "stock_take_edit_reconcile", undefined, organizationId);
          }
        }
      },
      { timeout: 120000 }
    );

    const updated = await prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: { select: { name: true, code: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update stock take:", error);
    return NextResponse.json({ error: "Failed to update stock take" }, { status: 500 });
  }
}

// PATCH — reconcile a DRAFT stock take (applies stock effects)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action !== "reconcile") {
      return NextResponse.json({ error: "Invalid action. Use 'reconcile'." }, { status: 400 });
    }

    const adjustment = await prisma.inventoryAdjustment.findUnique({
      where: { id, organizationId },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!adjustment) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }
    if (adjustment.status === "RECONCILED") {
      return NextResponse.json({ error: "Already reconciled" }, { status: 400 });
    }

    const parsedDate = adjustment.adjustmentDate;

    await prisma.$transaction(
      async (tx) => {
        const adjAccounts = await ensureInventoryAdjustmentAccounts(tx, organizationId);
        const inventoryAccount = await getSystemAccount(tx, organizationId, "1400");
        const recalcProducts = new Map<string, Date>();

        for (const item of adjustment.items) {
          const qty = Number(item.quantity);
          if (qty === 0) continue; // No difference, skip

          const productName = item.product.name;

          if (item.adjustmentType === "INCREASE") {
            const unitCost = Number(item.unitCost);

            await createStockLotFromAdjustment(
              item.id,
              item.productId,
              qty,
              unitCost,
              parsedDate,
              tx,
              organizationId,
              adjustment.warehouseId
            );

            const totalValue = qty * unitCost;
            if (totalValue > 0 && inventoryAccount && adjAccounts) {
              await createAutoJournalEntry(tx, organizationId, {
                date: parsedDate,
                description: `Stock Take (Increase) - ${productName}`,
                sourceType: "INVENTORY_ADJUSTMENT",
                sourceId: item.id,
                lines: [
                  { accountId: inventoryAccount.id, description: "Inventory", debit: totalValue, credit: 0 },
                  { accountId: adjAccounts.adjustmentIncome.id, description: "Adjustment Gain", debit: 0, credit: totalValue },
                ],
              });
            }
          } else {
            // DECREASE
            const fifoResult = await consumeStockFIFO(
              item.productId,
              qty,
              item.id,
              parsedDate,
              tx,
              organizationId,
              adjustment.warehouseId,
              "INVENTORY_ADJUSTMENT"
            );

            // Update unitCost to actual FIFO cost
            const actualUnitCost = qty > 0 ? Number(fifoResult.totalCOGS) / qty : 0;
            await tx.inventoryAdjustmentItem.update({
              where: { id: item.id },
              data: { unitCost: actualUnitCost },
            });

            const totalValue = Number(fifoResult.totalCOGS);
            if (totalValue > 0 && inventoryAccount && adjAccounts) {
              await createAutoJournalEntry(tx, organizationId, {
                date: parsedDate,
                description: `Stock Take (Decrease) - ${productName}`,
                sourceType: "INVENTORY_ADJUSTMENT",
                sourceId: item.id,
                lines: [
                  { accountId: adjAccounts.adjustmentExpense.id, description: "Adjustment Loss", debit: totalValue, credit: 0 },
                  { accountId: inventoryAccount.id, description: "Inventory", debit: 0, credit: totalValue },
                ],
              });
            }
          }

          // Backdating check
          const backdated = await isBackdated(item.productId, parsedDate, tx);
          const zeroCOGSDate = await hasZeroCOGSItems(item.productId, tx);
          let recalcDate: Date | null = null;
          if (backdated) recalcDate = parsedDate;
          if (zeroCOGSDate) {
            recalcDate = recalcDate
              ? recalcDate < zeroCOGSDate ? recalcDate : zeroCOGSDate
              : zeroCOGSDate;
          }
          if (recalcDate) {
            const existing = recalcProducts.get(item.productId);
            if (!existing || recalcDate < existing) {
              recalcProducts.set(item.productId, recalcDate);
            }
          }
        }

        // FIFO recalculation
        for (const [productId, fromDate] of recalcProducts) {
          await recalculateFromDate(productId, fromDate, tx, "stock_take_reconciled", undefined, organizationId);
        }

        // Mark as reconciled
        await tx.inventoryAdjustment.update({
          where: { id },
          data: { status: "RECONCILED", reconciledAt: new Date() },
        });
      },
      { timeout: 120000 }
    );

    const reconciled = await prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: { select: { name: true, code: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(reconciled);
  } catch (error) {
    console.error("Failed to reconcile stock take:", error);
    return NextResponse.json({ error: "Failed to reconcile stock take" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);
    const { id } = await params;

    const adjustment = await prisma.inventoryAdjustment.findUnique({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            stockLot: { include: { consumptions: true } },
            lotConsumptions: true,
          },
        },
      },
    });

    if (!adjustment) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }

    await prisma.$transaction(
      async (tx) => {
        // If reconciled, reverse stock effects
        if (adjustment.status === "RECONCILED") {
          const recalcProducts = new Map<string, Date>();

          for (const item of adjustment.items) {
            if (Number(item.quantity) === 0) continue;

            if (item.adjustmentType === "INCREASE" && item.stockLot) {
              const hasConsumptions = (item.stockLot.consumptions?.length ?? 0) > 0;
              await tx.stockLot.update({
                where: { id: item.stockLot.id },
                data: { initialQuantity: 0, remainingQuantity: 0 },
              });
              if (hasConsumptions) {
                recalcProducts.set(item.productId, adjustment.adjustmentDate);
              }
            } else if (item.adjustmentType === "DECREASE") {
              await restoreStockFromConsumptions(item.id, tx, "INVENTORY_ADJUSTMENT");
            }

            // Delete journal entries
            await tx.journalEntry.deleteMany({
              where: { sourceType: "INVENTORY_ADJUSTMENT", sourceId: item.id, organizationId },
            });
          }

          for (const [productId, fromDate] of recalcProducts) {
            await recalculateFromDate(productId, fromDate, tx, "stock_take_deleted", undefined, organizationId);
          }

          // Clean up stock lots
          for (const item of adjustment.items) {
            if (item.adjustmentType === "INCREASE" && item.stockLot) {
              await tx.stockLotConsumption.deleteMany({ where: { stockLotId: item.stockLot.id } });
              await tx.stockLot.delete({ where: { id: item.stockLot.id } });
            }
          }
        }

        // Delete items and header
        await tx.inventoryAdjustmentItem.deleteMany({ where: { inventoryAdjustmentId: id } });
        await tx.inventoryAdjustment.delete({ where: { id, organizationId } });
      },
      { timeout: 120000 }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete stock take:", error);
    return NextResponse.json({ error: "Failed to delete stock take" }, { status: 500 });
  }
}
