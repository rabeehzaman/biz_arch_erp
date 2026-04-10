import { Decimal } from "@prisma/client/runtime/client";
import { consumeStockFIFO, getProductStock } from "@/lib/inventory/fifo";

// Type for transaction client
type PrismaTransaction = Parameters<Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]>[0];

export interface AutoConsumeResult {
  totalCOGS: Decimal;
  warnings: string[];
}

/**
 * Auto-consume BOM ingredients when a product is sold (recipe/auto-consume mode).
 * Returns null if the product has no active BOM with autoConsumeOnSale, meaning
 * the caller should fall through to normal stock consumption.
 */
export async function consumeBOMIngredientsForSale(
  productId: string,
  saleQuantity: number | Decimal,
  invoiceItemId: string,
  date: Date,
  tx: PrismaTransaction,
  organizationId: string,
  warehouseId: string | null
): Promise<AutoConsumeResult | null> {
  // Find active default BOM with autoConsumeOnSale
  const bom = await tx.billOfMaterials.findFirst({
    where: {
      organizationId,
      productId,
      status: "ACTIVE",
      isDefault: true,
      autoConsumeOnSale: true,
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, cost: true } },
        },
      },
    },
  });

  if (!bom) return null;

  const qty = saleQuantity instanceof Decimal ? Number(saleQuantity) : saleQuantity;
  const bomOutputQty = Number(bom.outputQuantity);
  const warnings: string[] = [];
  let totalCOGS = new Decimal(0);

  // Check consumption policy for BLOCK mode
  if (bom.consumptionPolicy === "BLOCK") {
    for (const item of bom.items) {
      const effectiveQty = (Number(item.quantity) / bomOutputQty) * qty * (1 + Number(item.wastagePercent) / 100);
      const stock = await getProductStock(item.productId, tx, warehouseId);
      const available = stock ? Number(stock.totalQuantity) : 0;
      if (available < effectiveQty) {
        throw new Error(
          `Insufficient stock for ingredient "${item.product.name}": need ${effectiveQty.toFixed(2)}, have ${available.toFixed(2)}`
        );
      }
    }
  }

  // Consume each ingredient
  for (const item of bom.items) {
    const effectiveQty = (Number(item.quantity) / bomOutputQty) * qty * (1 + Number(item.wastagePercent) / 100);

    // Warn mode: check availability and warn
    if (bom.consumptionPolicy === "WARN") {
      const stock = await getProductStock(item.productId, tx, warehouseId);
      const available = stock ? Number(stock.totalQuantity) : 0;
      if (available < effectiveQty) {
        warnings.push(
          `Low stock: "${item.product.name}" needs ${effectiveQty.toFixed(2)} but only ${available.toFixed(2)} available`
        );
      }
    }

    const fifoResult = await consumeStockFIFO(
      item.productId,
      effectiveQty,
      invoiceItemId,
      date,
      tx,
      organizationId,
      warehouseId,
      "INVOICE" // Use INVOICE reference so existing restore logic works
    );

    totalCOGS = totalCOGS.add(fifoResult.totalCOGS);
    if (fifoResult.warnings.length > 0) {
      warnings.push(...fifoResult.warnings);
    }
  }

  return { totalCOGS, warnings };
}
