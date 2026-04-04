import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/client";

export interface PriceResolutionContext {
  userId: string;
  userPriceListId: string | null;
  customerId?: string | null;
  organizationId: string;
}

export interface ResolvedPrice {
  price: number;
  basePrice: number;
  source: "customer_price_list" | "user_price_list" | "base";
  priceListName?: string;
  unitPrices?: Record<string, number>; // unitId → resolved price for that unit
}

function computePrice(
  basePrice: number,
  item: { overrideType: string; fixedPrice: Decimal | null; percentOffset: Decimal | null } | null,
  defaultDiscountPercent: number
): number {
  if (item) {
    if (item.overrideType === "FIXED" && item.fixedPrice !== null) {
      return Number(item.fixedPrice);
    }
    if (item.overrideType === "PERCENTAGE" && item.percentOffset !== null) {
      return Math.round(basePrice * (1 + Number(item.percentOffset) / 100) * 100) / 100;
    }
  }
  if (defaultDiscountPercent > 0) {
    return Math.round(basePrice * (1 - defaultDiscountPercent / 100) * 100) / 100;
  }
  return basePrice;
}

function applyPriceListItems(
  items: Array<{ productId: string; unitId: string | null; overrideType: string; fixedPrice: Decimal | null; percentOffset: Decimal | null }>,
  priceListName: string,
  defaultDiscount: number,
  source: "customer_price_list" | "user_price_list",
  products: Array<{ id: string; price: number | Decimal; hasJewelleryItem?: boolean }>,
  jewelleryIds: Set<string>,
  result: Map<string, ResolvedPrice>
) {
  // Separate base items (unitId = null) from unit-specific items
  const baseItemMap = new Map<string, typeof items[0]>();
  const unitItems: typeof items = [];
  for (const item of items) {
    if (item.unitId == null) {
      baseItemMap.set(item.productId, item);
    } else {
      unitItems.push(item);
    }
  }

  // Apply base product prices
  for (const p of products) {
    if (jewelleryIds.has(p.id)) continue;
    const base = Number(p.price);
    const item = baseItemMap.get(p.id) ?? null;
    const resolved = computePrice(base, item, defaultDiscount);
    if (resolved !== base || item) {
      result.set(p.id, {
        price: resolved,
        basePrice: base,
        source,
        priceListName,
      });
    }
  }

  // Apply unit-specific prices
  for (const item of unitItems) {
    if (jewelleryIds.has(item.productId)) continue;
    const p = products.find((pr) => pr.id === item.productId);
    if (!p) continue;
    const base = Number(p.price);
    const unitPrice = computePrice(base, item, 0); // No default discount for unit-specific
    const existing = result.get(item.productId);
    const unitPrices = existing?.unitPrices ?? {};
    unitPrices[item.unitId!] = unitPrice;
    result.set(item.productId, {
      price: existing?.price ?? base,
      basePrice: base,
      source: existing?.source ?? source,
      priceListName: existing?.priceListName ?? priceListName,
      unitPrices,
    });
  }
}

/**
 * Bulk-resolve prices for a list of products given a user's price list and optional customer.
 * Resolution order: customer price list > user price list > base price.
 * Jewellery products (those with a jewelleryItem relation) are skipped.
 */
export async function resolveProductPrices(
  products: Array<{ id: string; price: number | Decimal; hasJewelleryItem?: boolean }>,
  ctx: PriceResolutionContext
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>();
  const productIds = products.map((p) => p.id);

  // Initialize all products with base price
  for (const p of products) {
    const base = Number(p.price);
    result.set(p.id, { price: base, basePrice: base, source: "base" });
  }

  if (productIds.length === 0) return result;

  // Skip if no price list context at all
  if (!ctx.userPriceListId && !ctx.customerId) return result;

  // Collect jewellery product IDs to skip
  const jewelleryIds = new Set(
    products.filter((p) => p.hasJewelleryItem).map((p) => p.id)
  );

  // 1. Try customer price list first
  if (ctx.customerId) {
    const customerAssignment = await prisma.priceListAssignment.findUnique({
      where: { customerId: ctx.customerId },
      include: {
        priceList: {
          include: {
            items: {
              where: { productId: { in: productIds } },
            },
          },
        },
      },
    });

    if (customerAssignment?.priceList?.isActive) {
      const pl = customerAssignment.priceList;
      const defaultDiscount = Number(pl.defaultDiscountPercent);
      applyPriceListItems(pl.items, pl.name, defaultDiscount, "customer_price_list", products, jewelleryIds, result);
      return result; // Customer price list takes full priority
    }
  }

  // 2. Fall back to user price list
  if (ctx.userPriceListId) {
    const priceList = await prisma.priceList.findFirst({
      where: { id: ctx.userPriceListId, isActive: true },
      include: {
        items: {
          where: { productId: { in: productIds } },
        },
      },
    });

    if (priceList) {
      const defaultDiscount = Number(priceList.defaultDiscountPercent);
      applyPriceListItems(priceList.items, priceList.name, defaultDiscount, "user_price_list", products, jewelleryIds, result);
    }
  }

  return result;
}
