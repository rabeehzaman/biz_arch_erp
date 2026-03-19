/**
 * Edition-aware tax calculator for jewellery sales.
 *
 * India: 3% on gold+wastage+stones (HSN 7113) + 5% on making charges (SAC 9988)
 *        Split into CGST/SGST for intra-state, IGST for inter-state.
 * Saudi: 15% flat on total (or 0% for >=99% investment gold K24)
 *
 * All rates come from admin config — NEVER hardcoded.
 */

import type { JewelleryConfig } from "./config";
import type { PricingBreakdown } from "./pricing-engine";

export interface JewelleryTaxBreakdown {
  // India GST
  goldTaxRate: number;
  goldTaxAmount: number;
  makingChargeTaxRate: number;
  makingChargeTaxAmount: number;
  stoneTaxAmount: number;
  totalTax: number;

  // Split (India intra-state)
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;

  // Saudi
  vatRate: number;
  vatAmount: number;

  // Final
  grandTotal: number;
}

export function calculateJewelleryTax(
  pricing: PricingBreakdown,
  config: JewelleryConfig,
  options: {
    purity: string;
    isInterState?: boolean;
  }
): JewelleryTaxBreakdown {
  const result: JewelleryTaxBreakdown = {
    goldTaxRate: 0,
    goldTaxAmount: 0,
    makingChargeTaxRate: 0,
    makingChargeTaxAmount: 0,
    stoneTaxAmount: 0,
    totalTax: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    vatRate: 0,
    vatAmount: 0,
    grandTotal: pricing.subtotal,
  };

  if (config.edition === "SAUDI") {
    // Saudi: 0% for investment gold (K24 / >=99% purity), 15% for rest
    const isInvestmentGold = options.purity === "K24";
    const vatRate = isInvestmentGold
      ? config.jewelleryInvestmentGoldTaxRate
      : config.jewelleryGoldTaxRate;

    result.vatRate = vatRate;
    result.vatAmount = round2(pricing.subtotal * (vatRate / 100));
    result.totalTax = result.vatAmount;
    result.grandTotal = round2(pricing.subtotal + result.totalTax);
  } else {
    // India: Separate tax rates for gold value+wastage+stones vs making charges
    const goldTaxableAmount = pricing.goldValue + pricing.wastageValue + pricing.stoneValue;
    const goldTaxRate = config.jewelleryGoldTaxRate;
    const makingTaxRate = config.jewelleryMakingChargeTaxRate;

    result.goldTaxRate = goldTaxRate;
    result.goldTaxAmount = round2(goldTaxableAmount * (goldTaxRate / 100));

    result.makingChargeTaxRate = makingTaxRate;
    result.makingChargeTaxAmount = round2(pricing.makingCharges * (makingTaxRate / 100));

    result.stoneTaxAmount = round2(pricing.stoneValue * (config.jewelleryStoneTaxRate / 100));

    result.totalTax = round2(result.goldTaxAmount + result.makingChargeTaxAmount);

    // Split CGST/SGST for intra-state, IGST for inter-state
    if (options.isInterState) {
      result.igstAmount = result.totalTax;
    } else {
      result.cgstAmount = round2(result.totalTax / 2);
      result.sgstAmount = round2(result.totalTax - result.cgstAmount); // avoid rounding gaps
    }

    result.grandTotal = round2(pricing.subtotal + result.totalTax);
  }

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
