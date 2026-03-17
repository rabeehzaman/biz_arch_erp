// Edition system — single source of truth for India vs Saudi configuration

export type EditionId = "INDIA" | "SAUDI";

export interface EditionConfig {
  id: EditionId;
  label: string;
  flag: string;
  taxSystem: "GST" | "VAT";
  currency: string;
  currencySymbol: string;
  languages: readonly string[];
  isLanguageSwitchable: boolean;
  defaultLanguage: string;
  allowedInvoicePdfFormats: readonly string[];
  allowedTransferPdfFormats: readonly string[];
}

export const EDITIONS: Record<EditionId, EditionConfig> = {
  INDIA: {
    id: "INDIA",
    label: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    taxSystem: "GST",
    currency: "INR",
    currencySymbol: "\u20B9",
    languages: ["en"],
    isLanguageSwitchable: false,
    defaultLanguage: "en",
    allowedInvoicePdfFormats: ["A5_LANDSCAPE", "A4_PORTRAIT", "A4_GST2", "A4_MODERN_GST"],
    allowedTransferPdfFormats: ["DEFAULT"],
  },
  SAUDI: {
    id: "SAUDI",
    label: "Saudi Arabia",
    flag: "\u{1F1F8}\u{1F1E6}",
    taxSystem: "VAT",
    currency: "SAR",
    currencySymbol: "\u20C1",
    languages: ["en", "ar"],
    isLanguageSwitchable: true,
    defaultLanguage: "en",
    allowedInvoicePdfFormats: ["A4_VAT", "A4_BILINGUAL", "A4_MODERN_GST"],
    allowedTransferPdfFormats: ["DEFAULT", "ARABIC"],
  },
};

export function getEditionConfig(edition?: string | null): EditionConfig {
  if (edition && edition in EDITIONS) {
    return EDITIONS[edition as EditionId];
  }
  return EDITIONS.INDIA;
}

/**
 * Derive edition from existing org flags (migration safety fallback).
 * Used when the `edition` column hasn't been set yet.
 */
export function deriveEdition(org: {
  saudiEInvoiceEnabled?: boolean;
  currency?: string;
}): EditionId {
  if (org.saudiEInvoiceEnabled || org.currency === "SAR") {
    return "SAUDI";
  }
  return "INDIA";
}
