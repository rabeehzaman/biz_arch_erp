// Saudi VAT calculation engine for ZATCA Phase 1

import { TRN_REGEX, SAUDI_VAT_RATE, VATCategory, SaudiInvoiceType } from "./constants";

export { TRN_REGEX, SAUDI_VAT_RATE } from "./constants";

// ─── TRN Validation ────────────────────────────────────────────────────────

export function validateTRN(trn: string): boolean {
  return TRN_REGEX.test(trn);
}

// ─── Line-Item VAT Calculation ─────────────────────────────────────────────

export interface LineVATInput {
  taxableAmount: number; // amount before VAT (after discount)
  vatRate: number;       // 15 or 0
  vatCategory?: VATCategory;
}

export interface LineVATResult {
  vatRate: number;
  vatAmount: number;
  vatCategory: VATCategory;
  totalWithVat: number;
}

export function calculateLineVAT(input: LineVATInput): LineVATResult {
  const { taxableAmount, vatRate } = input;
  const vatCategory: VATCategory = input.vatCategory ?? (vatRate === 0 ? "Z" : "S");

  if (vatRate <= 0 || taxableAmount <= 0 || vatCategory === "E" || vatCategory === "O") {
    return {
      vatRate: 0,
      vatAmount: 0,
      vatCategory,
      totalWithVat: taxableAmount,
    };
  }

  const vatAmount = round2(taxableAmount * vatRate / 100);
  return {
    vatRate,
    vatAmount,
    vatCategory,
    totalWithVat: round2(taxableAmount + vatAmount),
  };
}

// ─── Document-Level VAT Totals ─────────────────────────────────────────────

export interface DocumentVATResult {
  totalExclVat: number;
  totalVat: number;
  totalInclVat: number;
}

export function calculateDocumentVAT(
  lineResults: LineVATResult[]
): DocumentVATResult {
  const totalExclVat = round2(lineResults.reduce((s, l) => s + (l.totalWithVat - l.vatAmount), 0));
  const totalVat = round2(lineResults.reduce((s, l) => s + l.vatAmount, 0));
  return {
    totalExclVat,
    totalVat,
    totalInclVat: round2(totalExclVat + totalVat),
  };
}

// ─── Invoice Type Determination ────────────────────────────────────────────

export function determineSaudiInvoiceType(buyerVatNumber?: string | null): SaudiInvoiceType {
  // Standard invoice when buyer has a VAT TRN (B2B)
  return buyerVatNumber && validateTRN(buyerVatNumber) ? "STANDARD" : "SIMPLIFIED";
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
