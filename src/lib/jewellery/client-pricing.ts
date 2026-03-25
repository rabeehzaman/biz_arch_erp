/**
 * Client-side jewellery pricing calculations.
 * Used by invoice/quotation/POS forms to show live pricing.
 * Mirrors the server-side pricing-engine.ts logic exactly.
 */

export interface JewelleryLineData {
  grossWeight: number;
  stoneWeight: number;
  purity: string;
  metalType: string;
  goldRate: number;
  wastagePercent: number;
  makingChargeType: "PER_GRAM" | "PERCENTAGE" | "FIXED";
  makingChargeValue: number;
  stoneValue: number;
}

export interface JewelleryPricingResult {
  netWeight: number;
  fineWeight: number;
  goldValue: number;
  wastageValue: number;
  makingCharges: number;
  stoneValue: number;
  subtotal: number;
}

const PURITY_MULTIPLIER: Record<string, number> = {
  K24: 1.0,
  K22: 22 / 24,
  K21: 21 / 24,
  K18: 18 / 24,
  K14: 14 / 24,
  K9: 9 / 24,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function calculateJewelleryLinePrice(data: JewelleryLineData): JewelleryPricingResult {
  const netWeight = round3(Math.max(0, data.grossWeight - data.stoneWeight));
  const purityMult = PURITY_MULTIPLIER[data.purity] ?? 1.0;
  const fineWeight = round3(netWeight * purityMult);

  const goldValue = round2(netWeight * data.goldRate);
  const wastageValue = round2(netWeight * (data.wastagePercent / 100) * data.goldRate);

  let makingCharges = 0;
  switch (data.makingChargeType) {
    case "PER_GRAM":
      makingCharges = round2(data.makingChargeValue * netWeight);
      break;
    case "PERCENTAGE":
      makingCharges = round2(goldValue * (data.makingChargeValue / 100));
      break;
    case "FIXED":
      makingCharges = round2(data.makingChargeValue);
      break;
  }

  const subtotal = round2(goldValue + wastageValue + makingCharges + data.stoneValue);

  return {
    netWeight,
    fineWeight,
    goldValue,
    wastageValue,
    makingCharges,
    stoneValue: round2(data.stoneValue),
    subtotal,
  };
}
