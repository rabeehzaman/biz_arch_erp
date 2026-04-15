import type { CartItemData } from "@/components/pos/cart-item";

// ---------------------------------------------------------------------------
// Cart line key — canonical composite key for matching cart items.
// Mirrors the matching logic in terminal/page.tsx cartReducer ADD case.
// ---------------------------------------------------------------------------

export function cartLineKey(
  productId: string,
  variantId?: string,
  unitId?: string,
): string {
  return [productId, variantId || "", unitId || ""].join("::");
}

export function cartLineKeyFromItem(item: CartItemData): string {
  return cartLineKey(item.productId, item.variantId, item.unitId);
}
