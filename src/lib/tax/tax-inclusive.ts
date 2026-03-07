/**
 * Extracts the tax-exclusive (base) amount from a tax-inclusive amount.
 * When prices include tax, the base = inclusive / (1 + rate/100).
 * Returns the inclusive amount unchanged if taxRate <= 0.
 */
export function extractTaxExclusiveAmount(inclusiveAmount: number, taxRate: number): number {
  if (taxRate <= 0) return inclusiveAmount;
  return Math.round((inclusiveAmount / (1 + taxRate / 100)) * 100) / 100;
}
