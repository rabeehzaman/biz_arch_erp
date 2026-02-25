// GST calculation engine
// Used by all API routes and UI forms for GST computation

import { INDIAN_STATES } from "./constants";

export { INDIAN_STATES } from "./constants";
export { GST_SLABS, COMMON_HSN_CODES } from "./constants";
export type { GSTSlab, HSNEntry } from "./constants";

// ─── GSTIN Validation ──────────────────────────────────────────────────────

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function validateGSTIN(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin);
}

export function stateCodeFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.substring(0, 2);
  return INDIAN_STATES[code] ? code : null;
}

// ─── Interstate Detection ──────────────────────────────────────────────────

export function isInterState(
  sellerStateCode: string | null | undefined,
  buyerStateCode: string | null | undefined
): boolean {
  if (!sellerStateCode || !buyerStateCode) return false;
  return sellerStateCode !== buyerStateCode;
}

export function getPlaceOfSupply(
  sellerState: string,
  buyerGstin?: string | null,
  buyerState?: string | null
): string {
  // If buyer has GSTIN, derive state from it
  if (buyerGstin) {
    const derived = stateCodeFromGSTIN(buyerGstin);
    if (derived) return derived;
  }
  // Fall back to buyer's state code
  if (buyerState) return buyerState;
  // Default to seller's state
  return sellerState;
}

// ─── Line-Item GST Calculation ─────────────────────────────────────────────

export interface LineGSTInput {
  taxableAmount: number;
  gstRate: number;
  isInterState: boolean;
}

export interface LineGSTResult {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

export function calculateLineGST(input: LineGSTInput): LineGSTResult {
  const { taxableAmount, gstRate, isInterState: interState } = input;

  if (gstRate <= 0 || taxableAmount <= 0) {
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    };
  }

  if (interState) {
    // IGST applies
    const igstAmount = round2(taxableAmount * gstRate / 100);
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: gstRate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      totalTax: igstAmount,
    };
  } else {
    // CGST + SGST (each half of GST rate)
    const halfRate = gstRate / 2;
    const cgstAmount = round2(taxableAmount * halfRate / 100);
    const sgstAmount = round2(taxableAmount * halfRate / 100);
    return {
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalTax: cgstAmount + sgstAmount,
    };
  }
}

// ─── Document-Level GST Totals ─────────────────────────────────────────────

export interface DocumentGSTResult {
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
}

export function calculateDocumentGST(
  lineResults: LineGSTResult[]
): DocumentGSTResult {
  const totalCgst = round2(
    lineResults.reduce((sum, l) => sum + l.cgstAmount, 0)
  );
  const totalSgst = round2(
    lineResults.reduce((sum, l) => sum + l.sgstAmount, 0)
  );
  const totalIgst = round2(
    lineResults.reduce((sum, l) => sum + l.igstAmount, 0)
  );

  return {
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax: totalCgst + totalSgst + totalIgst,
  };
}

// ─── Full Document Calculation Helper ──────────────────────────────────────

export interface DocumentLineInput {
  taxableAmount: number;
  gstRate: number;
  hsnCode?: string | null;
}

export interface CalculatedDocumentLine extends LineGSTResult {
  hsnCode: string | null;
  gstRate: number;
  taxableAmount: number;
}

export interface FullDocumentGSTResult {
  lines: CalculatedDocumentLine[];
  totals: DocumentGSTResult;
  placeOfSupply: string;
  isInterState: boolean;
}

export function calculateFullDocumentGST(
  lines: DocumentLineInput[],
  sellerStateCode: string,
  buyerGstin?: string | null,
  buyerStateCode?: string | null
): FullDocumentGSTResult {
  const pos = getPlaceOfSupply(sellerStateCode, buyerGstin, buyerStateCode);
  const interState = isInterState(sellerStateCode, pos);

  const calculatedLines: CalculatedDocumentLine[] = lines.map((line) => {
    const result = calculateLineGST({
      taxableAmount: line.taxableAmount,
      gstRate: line.gstRate,
      isInterState: interState,
    });

    return {
      ...result,
      hsnCode: line.hsnCode || null,
      gstRate: line.gstRate,
      taxableAmount: line.taxableAmount,
    };
  });

  const totals = calculateDocumentGST(calculatedLines);

  return {
    lines: calculatedLines,
    totals,
    placeOfSupply: pos,
    isInterState: interState,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
