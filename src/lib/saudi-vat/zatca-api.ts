// ZATCA Phase 2 API client
// HTTP client for 5 ZATCA endpoints with Basic auth and error handling

import {
  getZatcaBaseUrl,
  ZATCA_API_PATHS,
  ZATCA_HEADERS,
  type ZatcaEnvironment,
} from "./zatca-config";

// ─── Response Types ───────────────────────────────────────────────────────

export interface ZatcaValidationMessage {
  type: string;
  code: string;
  category: string;
  message: string;
  status: string;
}

export interface ZatcaValidationResults {
  infoMessages: ZatcaValidationMessage[];
  warningMessages: ZatcaValidationMessage[];
  errorMessages: ZatcaValidationMessage[];
  status: string; // "PASS" | "WARNING" | "ERROR"
}

export interface ComplianceCsidResponse {
  requestID: string;
  dispositionMessage: string;
  binarySecurityToken: string; // Base64(Base64(DER)) — double-encoded from ZATCA API
  secret: string;
  errors?: string;
}

export interface ProductionCsidResponse {
  requestID: string;
  dispositionMessage: string;
  binarySecurityToken: string; // Base64(Base64(DER)) — double-encoded from ZATCA API
  secret: string;
  errors?: string;
}

/**
 * Decode ZATCA's binarySecurityToken which is base64(base64(DER_cert)).
 * Returns the inner base64 of the DER certificate, suitable for parseCertificate().
 */
export function decodeBST(bst: string): string {
  return Buffer.from(bst, "base64").toString("utf-8").trim();
}

export interface InvoiceSubmissionResponse {
  invoiceHash: string;
  status: string; // "PASS" | "WARNING" | "ERROR"
  clearedInvoice?: string; // Base64 XML (clearance only)
  reportingStatus?: string;
  clearanceStatus?: string;
  validationResults?: ZatcaValidationResults;
  warnings?: ZatcaValidationMessage[];
  errors?: ZatcaValidationMessage[];
}

// ─── API Client ───────────────────────────────────────────────────────────

/**
 * Step 4: Request Compliance CSID.
 * Auth: OTP header (not Basic auth).
 */
export async function requestComplianceCsid(
  csrBase64: string,
  otp: string,
  environment: ZatcaEnvironment
): Promise<ComplianceCsidResponse> {
  const url = `${getZatcaBaseUrl(environment)}${ZATCA_API_PATHS.COMPLIANCE}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...ZATCA_HEADERS,
      OTP: otp,
    },
    body: JSON.stringify({ csr: csrBase64 }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ZatcaApiError(
      `Compliance CSID request failed: ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Step 5: Submit compliance test invoice.
 * Auth: Basic (complianceCsid:secret).
 */
export async function submitComplianceInvoice(
  signedXmlBase64: string,
  xmlHash: string,
  uuid: string,
  csid: string,
  secret: string,
  environment: ZatcaEnvironment
): Promise<InvoiceSubmissionResponse> {
  return submitInvoice(
    ZATCA_API_PATHS.COMPLIANCE_INVOICES,
    signedXmlBase64,
    xmlHash,
    uuid,
    csid,
    secret,
    environment
  );
}

/**
 * Step 6: Request Production CSID.
 * Auth: Basic (complianceCsid:secret).
 */
export async function requestProductionCsid(
  complianceRequestId: string,
  csid: string,
  secret: string,
  environment: ZatcaEnvironment
): Promise<ProductionCsidResponse> {
  const url = `${getZatcaBaseUrl(environment)}${ZATCA_API_PATHS.PRODUCTION_CSIDS}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...ZATCA_HEADERS,
      Authorization: basicAuth(csid, secret),
    },
    body: JSON.stringify({ compliance_request_id: complianceRequestId }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ZatcaApiError(
      `Production CSID request failed: ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Renew an expiring Production CSID via PATCH.
 * Auth: Basic (old productionCsid:secret).
 * Per ZATCA spec, renewal uses PATCH with the old CSR — lighter than full re-onboard.
 */
export async function renewProductionCsid(
  oldCsrBase64: string,
  otp: string,
  oldCsid: string,
  oldSecret: string,
  environment: ZatcaEnvironment
): Promise<ProductionCsidResponse> {
  const url = `${getZatcaBaseUrl(environment)}${ZATCA_API_PATHS.PRODUCTION_CSIDS}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...ZATCA_HEADERS,
      Authorization: basicAuth(oldCsid, oldSecret),
      OTP: otp,
    },
    body: JSON.stringify({ csr: oldCsrBase64 }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ZatcaApiError(
      `Production CSID renewal failed: ${response.status}`,
      response.status,
      body
    );
  }

  return response.json();
}

/**
 * Report a simplified (B2C) invoice to ZATCA.
 * Auth: Basic (productionCsid:secret).
 */
export async function reportInvoice(
  signedXmlBase64: string,
  xmlHash: string,
  uuid: string,
  csid: string,
  secret: string,
  environment: ZatcaEnvironment
): Promise<InvoiceSubmissionResponse> {
  return submitInvoice(
    ZATCA_API_PATHS.REPORTING,
    signedXmlBase64,
    xmlHash,
    uuid,
    csid,
    secret,
    environment
  );
}

/**
 * Clear a standard (B2B) invoice with ZATCA.
 * Auth: Basic (productionCsid:secret).
 * Returns ZATCA-stamped XML in clearedInvoice field.
 */
export async function clearInvoice(
  signedXmlBase64: string,
  xmlHash: string,
  uuid: string,
  csid: string,
  secret: string,
  environment: ZatcaEnvironment
): Promise<InvoiceSubmissionResponse> {
  return submitInvoice(
    ZATCA_API_PATHS.CLEARANCE,
    signedXmlBase64,
    xmlHash,
    uuid,
    csid,
    secret,
    environment
  );
}

// ─── Shared Submit Logic ──────────────────────────────────────────────────

async function submitInvoice(
  path: string,
  signedXmlBase64: string,
  xmlHash: string,
  uuid: string,
  csid: string,
  secret: string,
  environment: ZatcaEnvironment
): Promise<InvoiceSubmissionResponse> {
  const url = `${getZatcaBaseUrl(environment)}${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...ZATCA_HEADERS,
      Authorization: basicAuth(csid, secret),
      "Clearance-Status": path.includes("clearance") ? "1" : "0",
    },
    body: JSON.stringify({
      invoiceHash: xmlHash,
      uuid,
      invoice: signedXmlBase64,
    }),
  });

  // 303 = clearance temporarily off, caller should fall back to reporting
  if (response.status === 303) {
    throw new ZatcaClearanceOffError();
  }

  if (response.status === 429) {
    throw new ZatcaRateLimitError();
  }

  const body: InvoiceSubmissionResponse = await response.json();

  // 400 = rejected with errors, BUT "clearance deactivated" means fall back to reporting
  if (response.status === 400) {
    const errorMsgs = body.validationResults?.errorMessages || [];
    const isClearanceOff = errorMsgs.some(
      (e) => e.message?.toLowerCase().includes("clearance") && e.message?.toLowerCase().includes("deactivat")
    );
    if (isClearanceOff) {
      throw new ZatcaClearanceOffError();
    }
    throw new ZatcaRejectionError(body);
  }

  // 200 = accepted, 202 = accepted with warnings
  return body;
}

// ─── Auth Helper ──────────────────────────────────────────────────────────

function basicAuth(csid: string, secret: string): string {
  const credentials = Buffer.from(`${csid}:${secret}`).toString("base64");
  return `Basic ${credentials}`;
}

// ─── Error Classes ────────────────────────────────────────────────────────

export class ZatcaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "ZatcaApiError";
  }
}

export class ZatcaClearanceOffError extends Error {
  constructor() {
    super("ZATCA clearance is temporarily switched off (HTTP 303). Fall back to reporting.");
    this.name = "ZatcaClearanceOffError";
  }
}

export class ZatcaRateLimitError extends Error {
  constructor() {
    super("ZATCA API rate limit exceeded (HTTP 429). Retry after a delay.");
    this.name = "ZatcaRateLimitError";
  }
}

export class ZatcaRejectionError extends Error {
  public response: InvoiceSubmissionResponse;
  constructor(response: InvoiceSubmissionResponse) {
    const errorMsgs = response.validationResults?.errorMessages
      ?.map((e) => `${e.code}: ${e.message}`)
      .join("; ") || "Unknown error";
    super(`ZATCA rejected invoice: ${errorMsgs}`);
    this.name = "ZatcaRejectionError";
    this.response = response;
  }
}
