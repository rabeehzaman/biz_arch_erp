/**
 * Resolve a BOM item's quantity to an absolute value.
 * For ABSOLUTE type, returns the quantity directly.
 * For PERCENTAGE type, calculates: (percentage / 100) * outputQuantity
 */
export function resolveQuantity(
  quantity: number,
  quantityType: "ABSOLUTE" | "PERCENTAGE",
  outputQuantity: number
): number {
  if (quantityType === "PERCENTAGE") {
    return (quantity / 100) * outputQuantity;
  }
  return quantity;
}
