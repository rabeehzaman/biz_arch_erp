import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";
import { getProductStock } from "@/lib/inventory/fifo";

const MAX_DEPTH = 10;

export interface ComponentCost {
  productId: string;
  productName: string;
  quantity: number;
  wastagePercent: number;
  effectiveQuantity: number;
  unitCost: number;
  lineCost: number;
  costSource: "FIFO" | "LAST_PURCHASE" | "PRODUCT_COST" | "ZERO";
  isPhantom: boolean;
  hasWarning: boolean;
}

export interface CostRollupResult {
  bomId: string;
  bomName: string;
  outputQuantity: number;
  processLossPercent: number;
  totalMaterialCost: number;
  costPerUnit: number;
  components: ComponentCost[];
  warnings: string[];
}

/**
 * Calculate the cost rollup for a BOM.
 * Uses fallback chain: FIFO average → last purchase → product.cost → zero with warning.
 * Recurses into sub-BOMs for multi-level cost, respects phantom components.
 */
export async function calculateBOMCostRollup(
  bomId: string,
  organizationId: string,
  warehouseId?: string | null
): Promise<CostRollupResult> {
  const bom = await prisma.billOfMaterials.findUnique({
    where: { id: bomId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, cost: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!bom || bom.organizationId !== organizationId) {
    throw new Error("BOM not found");
  }

  const warnings: string[] = [];
  const components: ComponentCost[] = [];
  const visited = new Set<string>();

  await resolveComponents(
    bom.items,
    Number(bom.outputQuantity),
    1, // multiplier
    organizationId,
    warehouseId ?? null,
    components,
    warnings,
    visited,
    0
  );

  const totalMaterialCost = components.reduce((sum, c) => sum + c.lineCost, 0);
  const processLoss = Number(bom.processLossPercent);
  const effectiveOutput = Number(bom.outputQuantity) * (1 - processLoss / 100);
  const costPerUnit = effectiveOutput > 0 ? totalMaterialCost / effectiveOutput : 0;

  return {
    bomId: bom.id,
    bomName: bom.name,
    outputQuantity: Number(bom.outputQuantity),
    processLossPercent: processLoss,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    costPerUnit: Math.round(costPerUnit * 100) / 100,
    components,
    warnings,
  };
}

async function resolveComponents(
  items: Array<{
    productId: string;
    product: { id: string; name: string; cost: Decimal };
    quantity: Decimal;
    wastagePercent: Decimal;
    isPhantom: boolean;
  }>,
  outputQuantity: number,
  parentMultiplier: number,
  organizationId: string,
  warehouseId: string | null,
  components: ComponentCost[],
  warnings: string[],
  visited: Set<string>,
  depth: number
): Promise<void> {
  if (depth >= MAX_DEPTH) {
    warnings.push(`Max BOM depth (${MAX_DEPTH}) reached — deeper levels ignored`);
    return;
  }

  for (const item of items) {
    // Cycle guard
    if (visited.has(item.productId)) {
      warnings.push(`Skipped ${item.product.name}: circular reference detected`);
      continue;
    }

    const baseQty = Number(item.quantity) * parentMultiplier;
    const wastage = Number(item.wastagePercent);
    const effectiveQty = baseQty * (1 + wastage / 100);

    // If phantom, resolve sub-BOM components instead
    if (item.isPhantom) {
      const subBom = await prisma.billOfMaterials.findFirst({
        where: {
          organizationId,
          productId: item.productId,
          status: "ACTIVE",
          isDefault: true,
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, cost: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      if (subBom) {
        visited.add(item.productId);
        const subMultiplier = effectiveQty / Number(subBom.outputQuantity);
        await resolveComponents(
          subBom.items,
          Number(subBom.outputQuantity),
          subMultiplier,
          organizationId,
          warehouseId,
          components,
          warnings,
          visited,
          depth + 1
        );
        visited.delete(item.productId);
        continue;
      }
      // No sub-BOM for phantom — treat as normal component
      warnings.push(`${item.product.name} is marked phantom but has no active BOM — treated as direct component`);
    }

    // Get component cost using fallback chain
    const { unitCost, source } = await getComponentCost(
      item.productId,
      item.product.name,
      Number(item.product.cost),
      organizationId,
      warehouseId,
      warnings
    );

    const lineCost = effectiveQty * unitCost;

    components.push({
      productId: item.productId,
      productName: item.product.name,
      quantity: baseQty,
      wastagePercent: wastage,
      effectiveQuantity: Math.round(effectiveQty * 10000) / 10000,
      unitCost: Math.round(unitCost * 100) / 100,
      lineCost: Math.round(lineCost * 100) / 100,
      costSource: source,
      isPhantom: item.isPhantom,
      hasWarning: source === "ZERO",
    });
  }
}

/**
 * Cost fallback chain: FIFO → last purchase → product.cost → zero
 */
async function getComponentCost(
  productId: string,
  productName: string,
  productCost: number,
  organizationId: string,
  warehouseId: string | null,
  warnings: string[]
): Promise<{ unitCost: number; source: ComponentCost["costSource"] }> {
  // 1. FIFO average cost
  const stock = await getProductStock(productId, prisma, warehouseId);
  if (stock && stock.totalQuantity.gt(0)) {
    return { unitCost: Number(stock.averageCost), source: "FIFO" };
  }

  // 2. Last purchase price
  const lastPurchase = await prisma.purchaseInvoiceItem.findFirst({
    where: {
      productId,
      purchaseInvoice: { organizationId },
    },
    orderBy: { purchaseInvoice: { invoiceDate: "desc" } },
    select: { unitCost: true },
  });

  if (lastPurchase && Number(lastPurchase.unitCost) > 0) {
    return { unitCost: Number(lastPurchase.unitCost), source: "LAST_PURCHASE" };
  }

  // 3. Product manual cost
  if (productCost > 0) {
    return { unitCost: productCost, source: "PRODUCT_COST" };
  }

  // 4. Zero — with warning
  warnings.push(`${productName}: no cost data available (FIFO, purchase history, or product cost)`);
  return { unitCost: 0, source: "ZERO" };
}

/**
 * Update the cached totalMaterialCost on a BOM header
 */
export async function updateBOMCostCache(
  bomId: string,
  organizationId: string
): Promise<void> {
  try {
    const result = await calculateBOMCostRollup(bomId, organizationId);
    await prisma.billOfMaterials.update({
      where: { id: bomId },
      data: { totalMaterialCost: result.totalMaterialCost },
    });
  } catch {
    // Don't fail on cache update
  }
}
