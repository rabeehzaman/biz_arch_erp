import { roundCurrency } from "./round-off";

export interface LineAmountInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export interface LineAmountResult {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Unified line amount calculation for all document types.
 * Handles both tax-inclusive and tax-exclusive pricing.
 *
 * Tax-inclusive: the unitPrice already includes tax.
 *   subtotal = discountedAmount / (1 + taxRate/100)
 *   tax = discountedAmount - subtotal
 *   total = discountedAmount
 *
 * Tax-exclusive: tax is added on top.
 *   subtotal = discountedAmount
 *   tax = subtotal * (taxRate/100)
 *   total = subtotal + tax
 */
export function calculateLineAmounts(
  input: LineAmountInput,
  taxInclusive: boolean = false
): LineAmountResult {
  const { quantity, unitPrice, discount, taxRate } = input;
  const discountedAmount = quantity * unitPrice * (1 - discount / 100);

  if (taxInclusive && taxRate > 0) {
    const subtotal = roundCurrency(discountedAmount / (1 + taxRate / 100));
    const tax = roundCurrency(discountedAmount - subtotal);
    return { subtotal, tax, total: roundCurrency(discountedAmount) };
  }

  const subtotal = roundCurrency(discountedAmount);
  const tax = roundCurrency(subtotal * (taxRate / 100));
  return { subtotal, tax, total: roundCurrency(subtotal + tax) };
}
