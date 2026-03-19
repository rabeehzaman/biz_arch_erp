/**
 * Purity multiplier map: converts karat to fraction of pure (24K) gold.
 * e.g. K22 = 22/24 = 0.9167
 */
export const PURITY_MULTIPLIER: Record<string, number> = {
  K24: 1.0,
  K22: 22 / 24, // 0.9167
  K21: 21 / 24, // 0.875
  K18: 18 / 24, // 0.75
  K14: 14 / 24, // 0.5833
  K9:  9  / 24, // 0.375
};

/** Get purity multiplier for a given karat string */
export function getPurityMultiplier(purity: string): number {
  return PURITY_MULTIPLIER[purity] ?? 1.0;
}

/**
 * Calculate fine weight (24K equivalent) from net weight and purity.
 * Fine Weight = Net Weight × (Karat / 24)
 */
export function calculateFineWeight(netWeight: number, purity: string): number {
  return round3(netWeight * getPurityMultiplier(purity));
}

/**
 * Auto-derive rates for other purities from a 24K base rate.
 * Returns a map of purity → derived rate.
 */
export function deriveRatesFrom24K(
  base24KRate: number,
  enabledPurities: string[]
): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const purity of enabledPurities) {
    const mult = getPurityMultiplier(purity);
    rates[purity] = round2(base24KRate * mult);
  }
  return rates;
}

/**
 * Calculate net weight: grossWeight - stoneWeight
 */
export function calculateNetWeight(grossWeight: number, stoneWeight: number): number {
  return round3(Math.max(0, grossWeight - stoneWeight));
}

// Round to 3 decimal places (milligram precision for weight)
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Round to 2 decimal places (currency precision)
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
