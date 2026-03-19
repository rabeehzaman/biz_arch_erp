/**
 * Core Jewellery Pricing Engine
 *
 * Pure function — takes item components + gold rate → calculates live price.
 * NEVER stores final price on inventory. All values calculated at query time.
 * Values are FROZEN only at invoice time (see sale API).
 */

import { getPurityMultiplier } from "./purity-rates";

export interface PricingInput {
  netWeight: number;         // grams (grossWeight - stoneWeight)
  purity: string;            // e.g. "K22"
  goldRate: number;          // per gram at this purity (sell rate)
  wastagePercent: number;    // e.g. 5.0
  makingChargeType: "PER_GRAM" | "PERCENTAGE" | "FIXED";
  makingChargeValue: number; // rate/percent/amount depending on type
  stoneValue: number;        // total value of all stones
}

export interface PricingBreakdown {
  goldValue: number;         // netWeight × goldRate × purityFactor
  wastageValue: number;      // netWeight × wastage% × goldRate × purityFactor
  makingCharges: number;     // depends on makingChargeType
  stoneValue: number;
  subtotal: number;          // sum of all above (before tax)
}

/**
 * Calculate the price breakdown for a jewellery item.
 * Uses the formula:
 *   Gold Value = Net Weight × Gold Rate per gram (already purity-adjusted if rate is per-purity)
 *   OR: Gold Value = Net Weight × 24K Rate × Purity Factor (if rate is 24K base)
 *
 * This engine expects goldRate to be the per-gram sell rate for the specific purity.
 */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const { netWeight, wastagePercent, makingChargeType, makingChargeValue, stoneValue } = input;

  // Gold value = net weight × gold rate (rate is already for the specific purity)
  const goldValue = round2(netWeight * input.goldRate);

  // Wastage value = net weight × wastage% × gold rate
  const wastageValue = round2(netWeight * (wastagePercent / 100) * input.goldRate);

  // Making charges depend on type
  let makingCharges = 0;
  switch (makingChargeType) {
    case "PER_GRAM":
      makingCharges = round2(makingChargeValue * netWeight);
      break;
    case "PERCENTAGE":
      makingCharges = round2(goldValue * (makingChargeValue / 100));
      break;
    case "FIXED":
      makingCharges = round2(makingChargeValue);
      break;
  }

  const subtotal = round2(goldValue + wastageValue + makingCharges + stoneValue);

  return {
    goldValue,
    wastageValue,
    makingCharges,
    stoneValue: round2(stoneValue),
    subtotal,
  };
}

/**
 * Calculate live selling price from components + current gold rate.
 * Convenience wrapper that returns a single number.
 */
export function calculateLivePrice(input: PricingInput): number {
  return calculatePricing(input).subtotal;
}

/**
 * Calculate price from 24K base rate (auto-deriving the purity-specific rate).
 */
export function calculatePricingFrom24K(
  input: Omit<PricingInput, "goldRate"> & { rate24K: number }
): PricingBreakdown {
  const purityFactor = getPurityMultiplier(input.purity);
  const goldRate = round2(input.rate24K * purityFactor);
  return calculatePricing({ ...input, goldRate });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
