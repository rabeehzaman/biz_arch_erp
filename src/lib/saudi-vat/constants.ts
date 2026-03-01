// Saudi VAT constants for ZATCA Phase 1 compliance

export const SAUDI_VAT_RATE = 15; // Standard rate: 15%
export const SAUDI_CURRENCY = "SAR";
export const SAUDI_COUNTRY_CODE = "SA";

// VAT categories per ZATCA
export const VAT_CATEGORIES = {
  S: "Standard rated (15%)",
  Z: "Zero rated (0%)",
  E: "Exempt",
  O: "Out of scope",
} as const;

export type VATCategory = keyof typeof VAT_CATEGORIES;

// Supported VAT rates
export const SAUDI_VAT_RATES = [0, 15] as const;

// TRN validation: 15 digits starting with 3
export const TRN_REGEX = /^3\d{14}$/;

// Invoice types
export const SAUDI_INVOICE_TYPES = {
  STANDARD: "STANDARD",   // B2B - requires buyer VAT details
  SIMPLIFIED: "SIMPLIFIED", // B2C - no buyer details required, QR mandatory
} as const;

export type SaudiInvoiceType = keyof typeof SAUDI_INVOICE_TYPES;
