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
      const itemMap = new Map(pl.items.map((i) => [i.productId, i]));
      const defaultDiscount = Number(pl.defaultDiscountPercent);

      for (const p of products) {
        if (jewelleryIds.has(p.id)) continue;
        const base = Number(p.price);
        const item = itemMap.get(p.id) ?? null;
        const resolved = computePrice(base, item, defaultDiscount);
        if (resolved !== base || item) {
          result.set(p.id, {
            price: resolved,
            basePrice: base,
            source: "customer_price_list",
            priceListName: pl.name,
          });
        }
      }
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
      const itemMap = new Map(priceList.items.map((i) => [i.productId, i]));
      const defaultDiscount = Number(priceList.defaultDiscountPercent);

      for (const p of products) {
        if (jewelleryIds.has(p.id)) continue;
        const base = Number(p.price);
        const item = itemMap.get(p.id) ?? null;
        const resolved = computePrice(base, item, defaultDiscount);
        if (resolved !== base || item) {
          result.set(p.id, {
            price: resolved,
            basePrice: base,
            source: "user_price_list",
            priceListName: priceList.name,
          });
        }
      }
    }
  }

  return result;
}
