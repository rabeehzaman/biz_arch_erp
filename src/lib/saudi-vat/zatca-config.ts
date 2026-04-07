// ZATCA Phase 2 environment configuration and API paths

export const ZATCA_ENVIRONMENTS = {
  SANDBOX: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
  SIMULATION: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  PRODUCTION: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
} as const;

export type ZatcaEnvironment = keyof typeof ZATCA_ENVIRONMENTS;

export const ZATCA_API_PATHS = {
  COMPLIANCE: "/compliance",
  COMPLIANCE_INVOICES: "/compliance/invoices",
  PRODUCTION_CSIDS: "/production/csids",
  CLEARANCE: "/invoices/clearance/single",
  REPORTING: "/invoices/reporting/single",
} as const;

export const ZATCA_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "Accept-Version": "V2",
  "Accept-Language": "en",
} as const;

// UBL 2.1 document type codes
export const ZATCA_DOC_TYPES = {
  INVOICE: "388",
  CREDIT_NOTE: "381",
  DEBIT_NOTE: "383",
} as const;

// Invoice subtype codes (7-position)
export const ZATCA_SUBTYPES = {
  STANDARD: "0100000",
  SIMPLIFIED: "0200000",
} as const;

// XML namespace URIs
export const ZATCA_NAMESPACES = {
  INVOICE: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  CAC: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  CBC: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  EXT: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  SIG: "urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2",
  SAC: "urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2",
  SBC: "urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2",
  DS: "http://www.w3.org/2000/09/xmldsig#",
  XADES: "http://uri.etsi.org/01903/v1.3.2#",
} as const;

// Canonicalization and signing algorithms
export const ZATCA_ALGORITHMS = {
  CANONICALIZATION: "http://www.w3.org/2006/12/xml-c14n11",
  SIGNATURE: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
  DIGEST: "http://www.w3.org/2001/04/xmlenc#sha256",
} as const;

// Tax exemption reason codes for Z/E/O categories
export const TAX_EXEMPTION_REASONS: Record<string, { code: string; reason: string }> = {
  // Zero-rated
  "VATEX-SA-32": { code: "VATEX-SA-32", reason: "Export of goods" },
  "VATEX-SA-33": { code: "VATEX-SA-33", reason: "Export of services" },
  "VATEX-SA-34-1": { code: "VATEX-SA-34-1", reason: "Intra-GCC supply of goods" },
  "VATEX-SA-34-2": { code: "VATEX-SA-34-2", reason: "Intra-GCC supply of services" },
  "VATEX-SA-34-3": { code: "VATEX-SA-34-3", reason: "Transfer of goods between KSA" },
  "VATEX-SA-34-4": { code: "VATEX-SA-34-4", reason: "Medicines and medical equipment" },
  "VATEX-SA-34-5": { code: "VATEX-SA-34-5", reason: "Metals for investment purposes" },
  // Exempt
  "VATEX-SA-29": { code: "VATEX-SA-29", reason: "Financial services" },
  "VATEX-SA-29-7": { code: "VATEX-SA-29-7", reason: "Life insurance" },
  "VATEX-SA-30": { code: "VATEX-SA-30", reason: "Real estate transactions" },
  // Out-of-scope
  "VATEX-SA-OOS": { code: "VATEX-SA-OOS", reason: "Out of scope supply" },
};

// PIH for the first Phase 2 invoice (Base64 SHA-256 of "0")
export const ZATCA_PHASE2_INITIAL_PIH =
  "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

export function getZatcaBaseUrl(environment: ZatcaEnvironment): string {
  return ZATCA_ENVIRONMENTS[environment];
}

/**
 * Validate an environment change. Once set to PRODUCTION, cannot revert.
 * Prevents accidental mode switch that would invalidate certificates and chain.
 */
export function validateEnvironmentChange(
  current: ZatcaEnvironment,
  next: ZatcaEnvironment
): { allowed: boolean; reason?: string } {
  if (current === next) return { allowed: true };
  if (current === "PRODUCTION" && next !== "PRODUCTION") {
    return {
      allowed: false,
      reason: "Cannot change environment from PRODUCTION. This would invalidate all certificates and the invoice hash chain.",
    };
  }
  return { allowed: true };
}

export function getEncryptionKey(): Buffer {
  const key = process.env.ZATCA_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ZATCA_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}
