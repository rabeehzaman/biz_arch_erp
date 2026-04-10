import { Decimal } from "@prisma/client/runtime/client";
import { consumeStockFIFO, restoreStockFromConsumptions } from "@/lib/inventory/fifo";

// Type for transaction client
type PrismaTransaction = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0];

export interface ProductionCompletionResult {
  completedQuantity: number;
  scrapQuantity: number;
  totalMaterialCost: number;
  unitProductionCost: number;
  outputLotId: string;
  warnings: string[];
}

/**
 * Complete a production order (full or partial).
 * Consumes raw materials via FIFO and creates an output stock lot.
 */
export async function completeProductionOrder(
  orderId: string,
  completionQuantity: number,
  scrapQuantity: number,
  tx: PrismaTransaction,
  organizationId: string
): Promise<ProductionCompletionResult> {
  const order = await tx.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      bom: {
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, cost: true } },
            },
          },
        },
      },
      items: true,
    },
  });

  if (!order || order.organizationId !== organizationId) {
    throw new Error("Production order not found");
  }

  if (order.status !== "IN_PROGRESS") {
    throw new Error("Production order must be IN_PROGRESS to complete");
  }

  const remaining = Number(order.plannedQuantity) - Number(order.completedQuantity);
  if (completionQuantity > remaining) {
    throw new Error(`Cannot complete ${completionQuantity} units — only ${remaining} remaining`);
  }

  const bomOutputQty = Number(order.bom.outputQuantity);
  const warnings: string[] = [];
  let totalMaterialCost = 0;

  // Consume materials for each production order item
  for (const item of order.items) {
    if (item.issueMethod !== "BACKFLUSH") continue;

    // Find corresponding BOM item to get wastage
    const bomItem = order.bom.items.find((bi) => bi.productId === item.productId);
    const wastagePercent = bomItem ? Number(bomItem.wastagePercent) : 0;

    // Calculate quantity to consume
    const baseQty = (Number(item.requiredQuantity) / Number(order.plannedQuantity)) * completionQuantity;
    const effectiveQty = baseQty * (1 + wastagePercent / 100);

    const fifoResult = await consumeStockFIFO(
      item.productId,
      effectiveQty,
      item.id,
      new Date(),
      tx,
      organizationId,
      order.sourceWarehouseId || null,
      "PRODUCTION"
    );

    const itemCost = Number(fifoResult.totalCOGS);
    totalMaterialCost += itemCost;

    if (fifoResult.warnings.length > 0) {
      warnings.push(...fifoResult.warnings);
    }

    // Update production order item with consumed quantity and cost
    await tx.productionOrderItem.update({
      where: { id: item.id },
      data: {
        consumedQuantity: { increment: effectiveQty },
        unitCost: effectiveQty > 0 ? itemCost / effectiveQty : 0,
        totalCost: { increment: itemCost },
      },
    });

    // Create production consumption records for audit
    for (const consumption of fifoResult.consumptions) {
      await tx.productionConsumption.create({
        data: {
          productionOrderId: orderId,
          productionOrderItemId: item.id,
          organizationId,
          stockLotId: consumption.lotId,
          quantityConsumed: consumption.quantity,
          unitCost: consumption.unitCost,
          totalCost: consumption.totalCost,
        },
      });
    }
  }

  // Calculate unit production cost
  const unitProductionCost = completionQuantity > 0
    ? totalMaterialCost / completionQuantity
    : 0;

  // Create output stock lot for finished goods
  const outputLot = await tx.stockLot.create({
    data: {
      productId: order.productId,
      organizationId,
      sourceType: "PRODUCTION",
      productionOrderId: orderId,
      warehouseId: order.outputWarehouseId || null,
      lotDate: new Date(),
      unitCost: unitProductionCost,
      initialQuantity: completionQuantity,
      remainingQuantity: completionQuantity,
    },
  });

  // Update production order totals
  const newCompletedQty = Number(order.completedQuantity) + completionQuantity;
  const newScrapQty = Number(order.scrapQuantity) + scrapQuantity;
  const isFullyComplete = newCompletedQty >= Number(order.plannedQuantity);

  await tx.productionOrder.update({
    where: { id: orderId },
    data: {
      completedQuantity: newCompletedQty,
      scrapQuantity: newScrapQty,
      totalMaterialCost: { increment: totalMaterialCost },
      unitProductionCost,
      status: isFullyComplete ? "COMPLETED" : "IN_PROGRESS",
      completedAt: isFullyComplete ? new Date() : null,
    },
  });

  // Update product cost to latest production cost
  await tx.product.update({
    where: { id: order.productId },
    data: { cost: unitProductionCost },
  });

  return {
    completedQuantity: completionQuantity,
    scrapQuantity,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    unitProductionCost: Math.round(unitProductionCost * 100) / 100,
    outputLotId: outputLot.id,
    warnings,
  };
}

/**
 * Cancel a production order. Restores any consumed stock.
 */
export async function cancelProductionOrder(
  orderId: string,
  tx: PrismaTransaction,
  organizationId: string
): Promise<void> {
  const order = await tx.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      outputLots: true,
    },
  });

  if (!order || order.organizationId !== organizationId) {
    throw new Error("Production order not found");
  }

  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new Error(`Cannot cancel a ${order.status} order`);
  }

  // Restore consumed stock for each item
  for (const item of order.items) {
    await restoreStockFromConsumptions(item.id, tx, "PRODUCTION");
  }

  // Remove output stock lots (set remaining to 0 if already partially consumed)
  for (const lot of order.outputLots) {
    if (Number(lot.remainingQuantity) < Number(lot.initialQuantity)) {
      // Already partially consumed — can't fully reverse
      throw new Error(
        "Cannot cancel: finished goods from this order have already been sold or transferred. " +
        "Reverse those transactions first."
      );
    }
    await tx.stockLot.delete({ where: { id: lot.id } });
  }

  // Delete production consumption records
  await tx.productionConsumption.deleteMany({
    where: { productionOrderId: orderId },
  });

  await tx.productionOrder.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      completedQuantity: 0,
      scrapQuantity: 0,
      totalMaterialCost: 0,
      unitProductionCost: 0,
    },
  });
}
