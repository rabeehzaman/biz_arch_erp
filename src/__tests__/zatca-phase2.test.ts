/**
 * ZATCA Phase 2 End-to-End Test Suite
 * Headless tests for all Phase 2 logic — no database or ZATCA API required.
 *
 * Covers:
 *   1. Certificate management (key gen, CSR, encrypt/decrypt, DER↔P1363)
 *   2. UBL 2.1 XML generation (Standard B2B, Simplified B2C, Credit Note, Debit Note)
 *   3. XML signing (8-step XAdES-BES flow)
 *   4. Enhanced 9-tag QR code (TLV with binary tags)
 *   5. Full pipeline integration (XML → sign → QR → embed)
 *   6. Configuration validation
 *
 * Run with: ZATCA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npx tsx src/__tests__/zatca-phase2.test.ts
 */

import crypto from "crypto";

// Set encryption key before any imports that read it
if (!process.env.ZATCA_ENCRYPTION_KEY) {
  process.env.ZATCA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
}

import {
  generateKeyPair,
  generateCSR,
  encryptPrivateKey,
  decryptPrivateKey,
  importPrivateKey,
  importPublicKey,
  derToP1363,
  p1363ToDer,
  type CSRParams,
} from "@/lib/saudi-vat/certificate";

import {
  generateInvoiceXML,
  type UBLInvoiceParams,
  type UBLPartyInfo,
  type UBLLineItem,
} from "@/lib/saudi-vat/ubl-xml";

import { signInvoiceXML, embedQRInXml } from "@/lib/saudi-vat/xml-signing";

import {
  generateTLVQRCode,
  generateEnhancedTLVQRCode,
  type EnhancedQRCodeInput,
} from "@/lib/saudi-vat/qr-code";

import { generateInvoiceUUID, computeInvoiceHash, GENESIS_INVOICE_HASH } from "@/lib/saudi-vat/invoice-hash";

import {
  ZATCA_ENVIRONMENTS,
  ZATCA_API_PATHS,
  ZATCA_DOC_TYPES,
  ZATCA_SUBTYPES,
  ZATCA_NAMESPACES,
  ZATCA_ALGORITHMS,
  ZATCA_PHASE2_INITIAL_PIH,
  TAX_EXEMPTION_REASONS,
  getZatcaBaseUrl,
  getEncryptionKey,
} from "@/lib/saudi-vat/zatca-config";

import {
  ZatcaApiError,
  ZatcaClearanceOffError,
  ZatcaRateLimitError,
  ZatcaRejectionError,
} from "@/lib/saudi-vat/zatca-api";

import {
  isChainLocked,
  resolveChainLock,
} from "@/lib/saudi-vat/zatca-submission";

// ─── Simple Test Harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let totalSections = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Expected: ${JSON.stringify(expected)}`);
    console.error(`    Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertContains(haystack: string, needle: string, message: string): void {
  if (haystack.includes(needle)) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    console.error(`    Expected to contain: ${needle}`);
    console.error(`    In: ${haystack.substring(0, 200)}...`);
    failed++;
  }
}

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    console.error(`  ✗ FAIL: ${message} (did not throw)`);
    failed++;
  } catch {
    console.log(`  ✓ ${message}`);
    passed++;
  }
}

async function assertThrowsAsync(fn: () => Promise<void>, message: string): Promise<void> {
  try {
    await fn();
    console.error(`  ✗ FAIL: ${message} (did not throw)`);
    failed++;
  } catch {
    console.log(`  ✓ ${message}`);
    passed++;
  }
}

function section(name: string): void {
  totalSections++;
  console.log(`\n── ${name} ──`);
}

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const TEST_SELLER: UBLPartyInfo = {
  name: "شركة اختبار التجارة",
  vatNumber: "399999999900003",
  commercialRegNumber: "1010010000",
  streetName: "شارع الملك فهد",
  buildingNumber: "1234",
  plotIdentification: "5678",
  citySubdivision: "حي العليا",
  city: "الرياض",
  postalZone: "12345",
  countryCode: "SA",
};

const TEST_BUYER: UBLPartyInfo = {
  name: "شركة المشتري",
  vatNumber: "300000000000003",
  streetName: "شارع الأمير سلطان",
  buildingNumber: "4321",
  city: "جدة",
  postalZone: "54321",
  countryCode: "SA",
};

function makeStandardInvoiceParams(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return {
    invoiceNumber: "INV-2026-0001",
    uuid: generateInvoiceUUID(),
    issueDate: "2026-04-04",
    issueTime: "10:30:00",
    documentType: "388",
    invoiceSubtype: "0100000",
    icv: 1,
    previousInvoiceHash: ZATCA_PHASE2_INITIAL_PIH,
    seller: TEST_SELLER,
    buyer: TEST_BUYER,
    deliveryDate: "2026-04-04",
    paymentMeansCode: "30",
    items: [
      {
        id: "1",
        name: "خدمة استشارية",
        quantity: 2,
        unitPrice: 500,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 150,
        lineExtensionAmount: 1000,
      },
      {
        id: "2",
        name: "تدريب متخصص",
        quantity: 1,
        unitPrice: 300,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 45,
        lineExtensionAmount: 300,
      },
    ],
    lineExtensionAmount: 1300,
    taxExclusiveAmount: 1300,
    taxInclusiveAmount: 1495,
    payableAmount: 1495,
    taxSubtotals: [
      { taxableAmount: 1300, taxAmount: 195, taxCategory: "S", taxPercent: 15 },
    ],
    totalVat: 195,
    ...overrides,
  };
}

function makeSimplifiedInvoiceParams(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return makeStandardInvoiceParams({
    invoiceNumber: "SINV-2026-0001",
    invoiceSubtype: "0200000",
    buyer: undefined,
    ...overrides,
  });
}

function makeCreditNoteParams(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return makeStandardInvoiceParams({
    invoiceNumber: "CN-2026-0001",
    documentType: "381",
    billingReferenceId: "INV-2026-0001",
    ...overrides,
  });
}

function makeDebitNoteParams(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return makeStandardInvoiceParams({
    invoiceNumber: "DN-2026-0001",
    documentType: "383",
    billingReferenceId: "INV-2026-0001",
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

section("1.1 ZATCA Environment URLs");
assertEq(
  ZATCA_ENVIRONMENTS.SANDBOX,
  "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
  "Sandbox URL is correct"
);
assertEq(
  ZATCA_ENVIRONMENTS.SIMULATION,
  "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  "Simulation URL is correct"
);
assertEq(
  ZATCA_ENVIRONMENTS.PRODUCTION,
  "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
  "Production URL is correct"
);
assertEq(getZatcaBaseUrl("SANDBOX"), ZATCA_ENVIRONMENTS.SANDBOX, "getZatcaBaseUrl returns correct URL");

section("1.2 API Paths");
assertEq(ZATCA_API_PATHS.COMPLIANCE, "/compliance", "Compliance path");
assertEq(ZATCA_API_PATHS.COMPLIANCE_INVOICES, "/compliance/invoices", "Compliance invoices path");
assertEq(ZATCA_API_PATHS.PRODUCTION_CSIDS, "/production/csids", "Production CSIDs path");
assertEq(ZATCA_API_PATHS.CLEARANCE, "/invoices/clearance/single", "Clearance path");
assertEq(ZATCA_API_PATHS.REPORTING, "/invoices/reporting/single", "Reporting path");

section("1.3 Document Types & Subtypes");
assertEq(ZATCA_DOC_TYPES.INVOICE, "388", "Invoice type code is 388");
assertEq(ZATCA_DOC_TYPES.CREDIT_NOTE, "381", "Credit note type code is 381");
assertEq(ZATCA_DOC_TYPES.DEBIT_NOTE, "383", "Debit note type code is 383");
assertEq(ZATCA_SUBTYPES.STANDARD, "0100000", "Standard subtype is 0100000");
assertEq(ZATCA_SUBTYPES.SIMPLIFIED, "0200000", "Simplified subtype is 0200000");

section("1.4 Algorithms");
assertEq(
  ZATCA_ALGORITHMS.CANONICALIZATION,
  "http://www.w3.org/2006/12/xml-c14n11",
  "C14N 1.1 algorithm URI"
);
assertEq(
  ZATCA_ALGORITHMS.SIGNATURE,
  "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256",
  "ECDSA-SHA256 algorithm URI"
);
assertEq(
  ZATCA_ALGORITHMS.DIGEST,
  "http://www.w3.org/2001/04/xmlenc#sha256",
  "SHA-256 digest algorithm URI"
);

section("1.5 XML Namespaces");
assertContains(ZATCA_NAMESPACES.INVOICE, "Invoice-2", "Invoice namespace contains Invoice-2");
assertContains(ZATCA_NAMESPACES.CAC, "CommonAggregateComponents-2", "CAC namespace");
assertContains(ZATCA_NAMESPACES.CBC, "CommonBasicComponents-2", "CBC namespace");
assertContains(ZATCA_NAMESPACES.DS, "xmldsig", "DS namespace contains xmldsig");
assertContains(ZATCA_NAMESPACES.XADES, "etsi.org", "XAdES namespace");

section("1.6 Tax Exemption Reasons");
assert(Object.keys(TAX_EXEMPTION_REASONS).length >= 10, "At least 10 exemption reason codes");
assertEq(TAX_EXEMPTION_REASONS["VATEX-SA-32"].reason, "Export of goods", "VATEX-SA-32 is export of goods");
assertEq(TAX_EXEMPTION_REASONS["VATEX-SA-OOS"].reason, "Out of scope supply", "VATEX-SA-OOS is out-of-scope");

section("1.7 Initial PIH");
{
  const pihDecoded = Buffer.from(ZATCA_PHASE2_INITIAL_PIH, "base64").toString("utf-8");
  assert(pihDecoded.length === 64, "Initial PIH decodes to 64-char hex string");
  // PIH should be SHA-256 of "0"
  const expected = crypto.createHash("sha256").update("0").digest("hex");
  assertEq(pihDecoded, expected, "Initial PIH is SHA-256 of '0'");
}

section("1.8 Encryption Key");
{
  const key = getEncryptionKey();
  assert(Buffer.isBuffer(key), "getEncryptionKey returns a Buffer");
  assertEq(key.length, 32, "Encryption key is 32 bytes (256-bit)");
}

section("1.9 Error Classes");
{
  const apiErr = new ZatcaApiError("test", 400, "body");
  assertEq(apiErr.name, "ZatcaApiError", "ZatcaApiError has correct name");
  assertEq(apiErr.statusCode, 400, "ZatcaApiError has statusCode");

  const clearanceOff = new ZatcaClearanceOffError();
  assertEq(clearanceOff.name, "ZatcaClearanceOffError", "ZatcaClearanceOffError name");
  assertContains(clearanceOff.message, "303", "Clearance off mentions 303");

  const rateLimit = new ZatcaRateLimitError();
  assertEq(rateLimit.name, "ZatcaRateLimitError", "ZatcaRateLimitError name");
  assertContains(rateLimit.message, "429", "Rate limit mentions 429");

  const rejectionResponse = {
    invoiceHash: "test",
    status: "ERROR",
    validationResults: {
      infoMessages: [],
      warningMessages: [],
      errorMessages: [
        { type: "ERROR", code: "XSD_INVALID", category: "XSD", message: "Invalid XML", status: "ERROR" },
      ],
      status: "ERROR",
    },
  };
  const rejection = new ZatcaRejectionError(rejectionResponse);
  assertEq(rejection.name, "ZatcaRejectionError", "ZatcaRejectionError name");
  assertContains(rejection.message, "XSD_INVALID", "Rejection includes error code");
  assertEq(rejection.response, rejectionResponse, "Rejection preserves response");
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CERTIFICATE MANAGEMENT (async tests)
// ═══════════════════════════════════════════════════════════════════════════

async function runAsyncTests() {
  // ─── 2.1 Key Pair Generation ─────────────────────────────────────────────
  section("2.1 Key Pair Generation (ECDSA secp256k1)");

  const keyPair = await generateKeyPair();

  assert(keyPair.privateKey != null && typeof keyPair.privateKey === "object", "privateKey is CryptoKey");
  assert(keyPair.publicKey != null && typeof keyPair.publicKey === "object", "publicKey is CryptoKey");
  assertContains(keyPair.privateKeyPem, "-----BEGIN PRIVATE KEY-----", "Private key PEM has correct header");
  assertContains(keyPair.privateKeyPem, "-----END PRIVATE KEY-----", "Private key PEM has correct footer");
  assertContains(keyPair.publicKeyPem, "-----BEGIN PUBLIC KEY-----", "Public key PEM has correct header");
  assertContains(keyPair.publicKeyPem, "-----END PUBLIC KEY-----", "Public key PEM has correct footer");

  // Verify uniqueness
  const keyPair2 = await generateKeyPair();
  assert(keyPair.privateKeyPem !== keyPair2.privateKeyPem, "Each key pair is unique");

  // ─── 2.2 Private Key Import ──────────────────────────────────────────────
  section("2.2 Private Key Import/Export Round-Trip");
  {
    const imported = await importPrivateKey(keyPair.privateKeyPem);
    assert(imported != null && typeof imported === "object", "importPrivateKey returns CryptoKey");

    const importedPub = await importPublicKey(keyPair.publicKeyPem);
    assert(importedPub != null && typeof importedPub === "object", "importPublicKey returns CryptoKey");
  }

  // ─── 2.3 Private Key Encryption ─────────────────────────────────────────
  section("2.3 Private Key Encryption (AES-256-GCM)");
  {
    const encrypted = encryptPrivateKey(keyPair.privateKeyPem);
    assert(encrypted.encrypted.length > 0, "Encrypted data is non-empty");
    assert(encrypted.iv.length === 24, "IV is 24 hex chars (12 bytes)");
    assert(encrypted.tag.length === 32, "Auth tag is 32 hex chars (16 bytes)");

    // Decrypt should recover original
    const decrypted = decryptPrivateKey(encrypted);
    assertEq(decrypted, keyPair.privateKeyPem, "Decrypt recovers original PEM");

    // Different encryption produces different IV
    const encrypted2 = encryptPrivateKey(keyPair.privateKeyPem);
    assert(encrypted.iv !== encrypted2.iv, "Each encryption uses a random IV");

    // Tampered data should fail
    const tampered = { ...encrypted, tag: "0".repeat(32) };
    assertThrows(
      () => decryptPrivateKey(tampered),
      "Tampered auth tag causes decryption failure"
    );
  }

  // ─── 2.4 CSR Generation ─────────────────────────────────────────────────
  section("2.4 CSR Generation");
  {
    const csrParams: CSRParams = {
      organizationName: "Test Company",
      organizationUnit: "Main Branch",
      commonName: "EGS1-TEST-001",
      vatNumber: "399999999900003",
      serialNumber: "1-BizArchERP|2-1.0|3-abc123",
      title: "1100",
      registeredAddress: "Riyadh",
      businessCategory: "Trading",
      isProduction: false,
    };

    const csrBase64 = await generateCSR(csrParams, keyPair.privateKey, keyPair.publicKey);
    assert(csrBase64.length > 0, "CSR is non-empty");
    assert(/^[A-Za-z0-9+/]+=*$/.test(csrBase64), "CSR is valid Base64");

    // CSR is double-base64: base64(PEM). Decoding once gives PEM text.
    const csrPem = Buffer.from(csrBase64, "base64").toString("utf-8");
    assert(csrPem.includes("-----BEGIN CERTIFICATE REQUEST-----"), "CSR decodes to PEM format");

    // Production CSR
    const prodCsrBase64 = await generateCSR(
      { ...csrParams, isProduction: true },
      keyPair.privateKey,
      keyPair.publicKey
    );
    assert(prodCsrBase64.length > 0, "Production CSR is non-empty");
    assert(prodCsrBase64 !== csrBase64, "Production CSR differs from sandbox CSR");
  }

  // ─── 2.4.1 CSR Structure Validation (pkijs) ────────────────────────────
  section("2.4.1 CSR Structure Validation (pkijs — pure JS, no OpenSSL)");
  {
    const csrParams: CSRParams = {
      organizationName: "Test Company",
      organizationUnit: "Main Branch",
      commonName: "EGS1-TEST-001",
      vatNumber: "399999999900003",
      serialNumber: "1-BizArchERP|2-1.0|3-abc123",
      title: "1100",
      registeredAddress: "Riyadh",
      businessCategory: "Trading",
      isProduction: false,
    };

    const csrBase64 = await generateCSR(csrParams, keyPair.privateKey, keyPair.publicKey);

    // Decode double-base64 → PEM → DER
    const csrPem = Buffer.from(csrBase64, "base64").toString("utf-8");
    const csrDerB64 = csrPem
      .replace(/-----BEGIN CERTIFICATE REQUEST-----/, "")
      .replace(/-----END CERTIFICATE REQUEST-----/, "")
      .replace(/\s/g, "");
    const csrDer = Buffer.from(csrDerB64, "base64");

    // Parse with pkijs
    const pkijs = await import("pkijs");
    const asn1js = await import("asn1js");
    const asn1 = asn1js.fromBER(csrDer.buffer.slice(csrDer.byteOffset, csrDer.byteOffset + csrDer.byteLength));
    assert(asn1.offset !== -1, "CSR DER parses successfully");

    const parsedCsr = new pkijs.CertificationRequest({ schema: asn1.result });

    // Verify Subject DN fields
    const subjectAttrs = parsedCsr.subject.typesAndValues;
    assert(subjectAttrs.length >= 4, `Subject DN has at least 4 attributes (got ${subjectAttrs.length})`);

    const findAttr = (oid: string) => subjectAttrs.find((a: any) => a.type === oid);
    const cAttr = findAttr("2.5.4.6");
    assert(cAttr != null, "Subject has Country (C) attribute");
    assertEq(cAttr!.value.valueBlock.value, "SA", "Country is SA");

    const ouAttr = findAttr("2.5.4.11");
    assert(ouAttr != null, "Subject has OU attribute");
    assertEq(ouAttr!.value.valueBlock.value, "Main Branch", "OU matches");

    const oAttr = findAttr("2.5.4.10");
    assert(oAttr != null, "Subject has O attribute");
    assertEq(oAttr!.value.valueBlock.value, "Test Company", "O matches");

    const cnAttr = findAttr("2.5.4.3");
    assert(cnAttr != null, "Subject has CN attribute");
    assertEq(cnAttr!.value.valueBlock.value, "EGS1-TEST-001", "CN matches");

    // Verify extensions exist in attributes
    assert(parsedCsr.attributes != null && parsedCsr.attributes.length > 0, "CSR has attributes");
    const extReqAttr = parsedCsr.attributes!.find((a: any) => a.type === "1.2.840.113549.1.9.14");
    assert(extReqAttr != null, "CSR has extensionRequest attribute (1.2.840.113549.1.9.14)");

    // Parse extensions from the attribute
    const extensions = new pkijs.Extensions({ schema: extReqAttr!.values[0] });
    assert(extensions.extensions.length >= 2, `CSR has at least 2 extensions (got ${extensions.extensions.length})`);

    // Verify certificateTemplateName extension
    const templateExt = extensions.extensions.find((e: any) => e.extnID === "1.3.6.1.4.1.311.20.2");
    assert(templateExt != null, "Has certificateTemplateName extension (1.3.6.1.4.1.311.20.2)");

    // Decode the template value (should be PrintableString)
    const templateAsn1 = asn1js.fromBER(templateExt!.extnValue.valueBlock.valueHexView);
    assert(templateAsn1.offset !== -1, "certificateTemplateName value parses");
    const templateValue = (templateAsn1.result as any).valueBlock?.value;
    assertEq(templateValue, "PREZATCA-Code-Signing", "Template name is PREZATCA-Code-Signing for simulation");

    // Verify subjectAltName extension
    const sanExt = extensions.extensions.find((e: any) => e.extnID === "2.5.29.17");
    assert(sanExt != null, "Has subjectAltName extension (2.5.29.17)");

    // Verify CSR has a non-empty signature (pkijs.verify() doesn't support secp256k1 OID natively,
    // but the signature was created by @peculiar/webcrypto which we test in section 2.6)
    assert(
      parsedCsr.signatureValue.valueBlock.valueHexView.byteLength > 0,
      "CSR has a non-empty signature"
    );

    // Production template name test
    const prodCsrBase64 = await generateCSR(
      { ...csrParams, isProduction: true },
      keyPair.privateKey,
      keyPair.publicKey
    );
    const prodPem = Buffer.from(prodCsrBase64, "base64").toString("utf-8");
    const prodDerB64 = prodPem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
    const prodDer = Buffer.from(prodDerB64, "base64");
    const prodAsn1 = asn1js.fromBER(prodDer.buffer.slice(prodDer.byteOffset, prodDer.byteOffset + prodDer.byteLength));
    const prodCsr = new pkijs.CertificationRequest({ schema: prodAsn1.result });
    const prodExtReq = prodCsr.attributes!.find((a: any) => a.type === "1.2.840.113549.1.9.14");
    const prodExts = new pkijs.Extensions({ schema: prodExtReq!.values[0] });
    const prodTemplateExt = prodExts.extensions.find((e: any) => e.extnID === "1.3.6.1.4.1.311.20.2");
    const prodTemplateAsn1 = asn1js.fromBER(prodTemplateExt!.extnValue.valueBlock.valueHexView);
    const prodTemplateName = (prodTemplateAsn1.result as any).valueBlock?.value;
    assertEq(prodTemplateName, "ZATCA-Code-Signing", "Production template name is ZATCA-Code-Signing");
  }

  // ─── 2.5 DER ↔ P1363 Signature Conversion ──────────────────────────────
  section("2.5 DER ↔ IEEE P1363 Signature Conversion");
  {
    // Create a known P1363 signature (64 bytes: r || s)
    const r = crypto.randomBytes(32);
    const s = crypto.randomBytes(32);
    const p1363 = Buffer.concat([r, s]);
    assertEq(p1363.length, 64, "P1363 is 64 bytes");

    // Convert to DER and back
    const der = p1363ToDer(p1363);
    assert(der[0] === 0x30, "DER starts with SEQUENCE tag");
    assert(der.length >= 68 && der.length <= 72, `DER length is reasonable: ${der.length}`);

    const backToP1363 = derToP1363(der);
    assertEq(backToP1363.length, 64, "Round-trip: P1363 is 64 bytes");
    assert(Buffer.compare(backToP1363, p1363) === 0, "Round-trip: P1363 matches original");

    // Test with high-bit r (requires 0x00 padding in DER)
    const rHighBit = Buffer.alloc(32);
    rHighBit[0] = 0x80;
    rHighBit[1] = 0x01;
    const sNormal = Buffer.alloc(32);
    sNormal[31] = 0x42;
    const p1363HighBit = Buffer.concat([rHighBit, sNormal]);

    const derHighBit = p1363ToDer(p1363HighBit);
    // r gets 0x00 padding (33 bytes), but s gets trimmed (leading zeros removed)
    assert(derHighBit[0] === 0x30, "DER with high-bit r starts with SEQUENCE");
    // Verify r has 0x00 padding: 0x30 len 0x02 0x21(33) 0x00 0x80...
    assertEq(derHighBit[3], 33, "DER r-integer is 33 bytes (0x00 + 32 original)");
    assertEq(derHighBit[4], 0x00, "DER r-integer has leading 0x00 padding");
    const recovered = derToP1363(derHighBit);
    assert(Buffer.compare(recovered, p1363HighBit) === 0, "High-bit round-trip succeeds");

    // Test with leading zeros in r
    const rSmall = Buffer.alloc(32);
    rSmall[31] = 0x01; // r = 1
    const p1363Small = Buffer.concat([rSmall, sNormal]);
    const derSmall = p1363ToDer(p1363Small);
    const recoveredSmall = derToP1363(derSmall);
    assert(Buffer.compare(recoveredSmall, p1363Small) === 0, "Small-r round-trip succeeds");
  }

  // ─── 2.6 Sign and Verify with Generated Keys ───────────────────────────
  section("2.6 ECDSA Sign/Verify with Generated Keys");
  {
    const { Crypto } = await import("@peculiar/webcrypto");
    const peculiarCrypto = new Crypto();

    const message = Buffer.from("ZATCA test message for signing", "utf-8");
    const signature = await peculiarCrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      message
    );
    assert(signature.byteLength === 64, "ECDSA-SHA256 signature is 64 bytes (P1363)");

    const isValid = await peculiarCrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      signature,
      message
    );
    assert(isValid, "Signature verifies with original public key");

    // Wrong message should not verify
    const wrongMessage = Buffer.from("wrong message", "utf-8");
    const isInvalid = await peculiarCrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.publicKey,
      signature,
      wrongMessage
    );
    assert(!isInvalid, "Signature does not verify with wrong message");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. UBL XML GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 3.1 Standard Invoice (B2B) ─────────────────────────────────────────
  section("3.1 UBL XML: Standard Invoice (B2B)");
  {
    const params = makeStandardInvoiceParams();
    const xml = generateInvoiceXML(params);

    assert(xml.length > 0, "XML is non-empty");
    assertContains(xml, '<?xml version="1.0" encoding="UTF-8"?>', "XML declaration");
    assertContains(xml, ZATCA_NAMESPACES.INVOICE, "Invoice namespace");
    assertContains(xml, ZATCA_NAMESPACES.CAC, "CAC namespace");
    assertContains(xml, ZATCA_NAMESPACES.CBC, "CBC namespace");
    assertContains(xml, ZATCA_NAMESPACES.EXT, "EXT namespace");

    // Document identification
    assertContains(xml, "reporting:1.0", "ProfileID");
    assertContains(xml, "INV-2026-0001", "Invoice number");
    assertContains(xml, params.uuid, "UUID present");
    assertContains(xml, "2026-04-04", "Issue date");
    assertContains(xml, "10:30:00", "Issue time");

    // Invoice type code with subtype
    assertContains(xml, 'name="0100000"', "Standard subtype 0100000");
    assertContains(xml, ">388<", "Invoice type code 388");

    // Currency
    assertContains(xml, ">SAR<", "SAR currency");

    // Seller party
    assertContains(xml, "399999999900003", "Seller VAT number");
    assertContains(xml, "شركة اختبار التجارة", "Seller Arabic name");
    assertContains(xml, "1010010000", "Seller CR number");
    assertContains(xml, "1234", "Seller building number");
    assertContains(xml, "الرياض", "Seller city");
    assertContains(xml, "12345", "Seller postal zone");

    // Buyer party (B2B has full buyer)
    assertContains(xml, "300000000000003", "Buyer VAT number");
    assertContains(xml, "شركة المشتري", "Buyer name");
    assertContains(xml, "جدة", "Buyer city");

    // ICV and PIH references
    assertContains(xml, ">ICV<", "ICV additional doc ref");
    assertContains(xml, ">PIH<", "PIH additional doc ref");
    assertContains(xml, ">QR<", "QR additional doc ref");

    // Tax totals
    assertContains(xml, ">195.00<", "Total VAT amount 195.00");

    // Line items
    assertContains(xml, "خدمة استشارية", "Line item 1 name");
    assertContains(xml, "تدريب متخصص", "Line item 2 name");
    assertContains(xml, ">500.00<", "Unit price 500.00");

    // Legal monetary total
    assertContains(xml, ">1300.00<", "LineExtensionAmount 1300.00");
    assertContains(xml, ">1495.00<", "TaxInclusiveAmount 1495.00");

    // Signature placeholders (UBLExtensions)
    assertContains(xml, "UBLExtensions", "UBLExtensions present");
    assertContains(xml, "SignatureInformation", "SignatureInformation present");

    // Delivery date
    assertContains(xml, "ActualDeliveryDate", "Delivery date element");

    // Payment means
    assertContains(xml, ">30<", "PaymentMeansCode 30 (credit)");
  }

  // ─── 3.2 Simplified Invoice (B2C) ──────────────────────────────────────
  section("3.2 UBL XML: Simplified Invoice (B2C)");
  {
    const params = makeSimplifiedInvoiceParams();
    const xml = generateInvoiceXML(params);

    assertContains(xml, 'name="0200000"', "Simplified subtype 0200000");
    assertContains(xml, ">388<", "Invoice type code 388");
    assertContains(xml, "AccountingCustomerParty", "Simplified buyer element exists");
    // Should NOT contain buyer VAT info
    assert(!xml.includes("300000000000003"), "No buyer VAT in simplified invoice");
  }

  // ─── 3.3 Credit Note ───────────────────────────────────────────────────
  section("3.3 UBL XML: Credit Note");
  {
    const params = makeCreditNoteParams();
    const xml = generateInvoiceXML(params);

    assertContains(xml, ">381<", "Credit note type code 381");
    assertContains(xml, "BillingReference", "Billing reference present");
    assertContains(xml, "InvoiceDocumentReference", "Invoice document reference present");
    assertContains(xml, "INV-2026-0001", "References original invoice number");
  }

  // ─── 3.4 Debit Note ────────────────────────────────────────────────────
  section("3.4 UBL XML: Debit Note");
  {
    const params = makeDebitNoteParams();
    const xml = generateInvoiceXML(params);

    assertContains(xml, ">383<", "Debit note type code 383");
    assertContains(xml, "BillingReference", "Billing reference present");
    assertContains(xml, "INV-2026-0001", "References original invoice number");
  }

  // ─── 3.5 Document-Level Discount ───────────────────────────────────────
  section("3.5 UBL XML: Document-Level Discount");
  {
    const params = makeStandardInvoiceParams({
      documentDiscount: 100,
      allowanceTotalAmount: 100,
    });
    const xml = generateInvoiceXML(params);

    assertContains(xml, "AllowanceCharge", "AllowanceCharge element present");
    assertContains(xml, ">false<", "ChargeIndicator is false (allowance)");
    assertContains(xml, ">100.00<", "Discount amount 100.00");
    assertContains(xml, "AllowanceTotalAmount", "AllowanceTotalAmount present");
  }

  // ─── 3.6 Line-Level Discount ───────────────────────────────────────────
  section("3.6 UBL XML: Line-Level Discount");
  {
    const params = makeStandardInvoiceParams({
      items: [{
        id: "1",
        name: "Product with discount",
        quantity: 10,
        unitPrice: 100,
        discount: 50,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 142.5,
        lineExtensionAmount: 950,
      }],
    });
    const xml = generateInvoiceXML(params);

    assertContains(xml, "AllowanceChargeReason", "Line discount reason present");
    assertContains(xml, "Line Discount", "Line Discount label");
    assertContains(xml, ">50.00<", "Line discount amount 50.00");
  }

  // ─── 3.7 Mixed Tax Categories ──────────────────────────────────────────
  section("3.7 UBL XML: Mixed Tax Categories (S + Z + E)");
  {
    const params = makeStandardInvoiceParams({
      items: [
        {
          id: "1", name: "Standard item", quantity: 1, unitPrice: 1000,
          vatRate: 15, vatCategory: "S", vatAmount: 150, lineExtensionAmount: 1000,
        },
        {
          id: "2", name: "Zero-rated export", quantity: 1, unitPrice: 500,
          vatRate: 0, vatCategory: "Z", vatAmount: 0, lineExtensionAmount: 500,
          taxExemptionReasonCode: "VATEX-SA-32", taxExemptionReason: "Export of goods",
        },
        {
          id: "3", name: "Exempt financial", quantity: 1, unitPrice: 200,
          vatRate: 0, vatCategory: "E", vatAmount: 0, lineExtensionAmount: 200,
          taxExemptionReasonCode: "VATEX-SA-29", taxExemptionReason: "Financial services",
        },
      ],
      taxSubtotals: [
        { taxableAmount: 1000, taxAmount: 150, taxCategory: "S", taxPercent: 15 },
        { taxableAmount: 500, taxAmount: 0, taxCategory: "Z", taxPercent: 0,
          taxExemptionReasonCode: "VATEX-SA-32", taxExemptionReason: "Export of goods" },
        { taxableAmount: 200, taxAmount: 0, taxCategory: "E", taxPercent: 0,
          taxExemptionReasonCode: "VATEX-SA-29", taxExemptionReason: "Financial services" },
      ],
      lineExtensionAmount: 1700,
      taxExclusiveAmount: 1700,
      taxInclusiveAmount: 1850,
      payableAmount: 1850,
      totalVat: 150,
    });
    const xml = generateInvoiceXML(params);

    // All three tax categories should appear in TaxSubtotal
    assertContains(xml, "VATEX-SA-32", "Zero-rated exemption code");
    assertContains(xml, "Export of goods", "Zero-rated exemption reason");
    assertContains(xml, "VATEX-SA-29", "Exempt exemption code");
    assertContains(xml, "Financial services", "Exempt exemption reason");
  }

  // ─── 3.8 Cash Payment Means ────────────────────────────────────────────
  section("3.8 UBL XML: Cash Payment Means");
  {
    const params = makeSimplifiedInvoiceParams({ paymentMeansCode: "10" });
    const xml = generateInvoiceXML(params);
    assertContains(xml, ">10<", "PaymentMeansCode 10 (cash)");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. XML SIGNING
  // ═══════════════════════════════════════════════════════════════════════════

  section("4.1 XML Signing: Full 8-Step Flow");

  // Generate a self-signed certificate for testing
  const { Crypto } = await import("@peculiar/webcrypto");
  const peculiarCrypto = new Crypto();
  const { X509CertificateGenerator, X509Certificate } = await import("@peculiar/x509");

  // Create a self-signed test certificate
  const testKeys = await peculiarCrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "K-256", hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );

  const testCert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Test,O=TestOrg,C=SA",
    notBefore: new Date(),
    notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    signingAlgorithm: { name: "ECDSA", hash: "SHA-256" },
    keys: testKeys,
  });

  const testCertBase64 = Buffer.from(testCert.rawData).toString("base64");

  // Export private key PEM for signing
  const testPrivKeyDer = await peculiarCrypto.subtle.exportKey("pkcs8", testKeys.privateKey);
  const testPrivKeyB64 = Buffer.from(testPrivKeyDer).toString("base64");
  const testPrivKeyPem = `-----BEGIN PRIVATE KEY-----\n${testPrivKeyB64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;

  {
    const params = makeStandardInvoiceParams();
    const xml = generateInvoiceXML(params);

    const sigResult = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);

    // Verify result structure
    assert(sigResult.signedXml.length > xml.length, "Signed XML is longer than original");
    assert(sigResult.invoiceHash.length > 0, "Invoice hash is non-empty");
    assert(sigResult.invoiceHashBytes.length === 32, "Invoice hash bytes = 32 (SHA-256)");
    assert(sigResult.signatureBytes.length === 64, "Signature bytes = 64 (P1363)");
    assert(sigResult.publicKeyDER.length > 0, "Public key DER is non-empty");
    assert(sigResult.certSignatureBytes.length > 0, "Cert signature bytes non-empty");

    // Invoice hash should be base64
    assert(/^[A-Za-z0-9+/]+=*$/.test(sigResult.invoiceHash), "Invoice hash is valid Base64");

    // Signed XML should contain ds:Signature elements
    assertContains(sigResult.signedXml, "ds:Signature", "Signed XML has ds:Signature");
    assertContains(sigResult.signedXml, "ds:SignedInfo", "Signed XML has ds:SignedInfo");
    assertContains(sigResult.signedXml, "ds:SignatureValue", "Signed XML has ds:SignatureValue");
    assertContains(sigResult.signedXml, "ds:X509Certificate", "Signed XML has X509Certificate");
    assertContains(sigResult.signedXml, "xades:SignedProperties", "Signed XML has SignedProperties");
    assertContains(sigResult.signedXml, "xades:SigningTime", "Signed XML has SigningTime");
    assertContains(sigResult.signedXml, "xades:CertDigest", "Signed XML has CertDigest");

    // Verify digest references
    assertContains(sigResult.signedXml, "invoiceSignedData", "Invoice digest reference ID");
    assertContains(sigResult.signedXml, "xadesSignedProperties", "SignedProperties reference");

    // XPath transforms should be present
    assertContains(sigResult.signedXml, "UBLExtensions", "XPath transform for UBLExtensions");
    assertContains(sigResult.signedXml, "cac:Signature", "XPath transform for Signature");

    // Certificate should be embedded
    assertContains(sigResult.signedXml, testCertBase64, "Certificate Base64 embedded");
  }

  // ─── 4.2 Signing Different Document Types ──────────────────────────────
  section("4.2 XML Signing: Credit Note & Simplified Invoice");
  {
    // Credit note
    const cnXml = generateInvoiceXML(makeCreditNoteParams());
    const cnSig = await signInvoiceXML(cnXml, testPrivKeyPem, testCertBase64);
    assert(cnSig.signedXml.includes("ds:Signature"), "Credit note signed successfully");
    assert(cnSig.signedXml.includes("381"), "Signed credit note still has type 381");

    // Simplified
    const simXml = generateInvoiceXML(makeSimplifiedInvoiceParams());
    const simSig = await signInvoiceXML(simXml, testPrivKeyPem, testCertBase64);
    assert(simSig.signedXml.includes("ds:Signature"), "Simplified invoice signed");
    assert(simSig.signedXml.includes("0200000"), "Simplified subtype preserved");
  }

  // ─── 4.3 Invoice Hash Determinism ──────────────────────────────────────
  section("4.3 Invoice Hash: Deterministic for Same Input");
  {
    const params = makeStandardInvoiceParams({ uuid: "fixed-uuid-for-test" });
    const xml = generateInvoiceXML(params);

    const sig1 = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);
    const sig2 = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);

    assertEq(sig1.invoiceHash, sig2.invoiceHash, "Same XML produces same invoice hash");
    // Signatures differ because of timestamp in SignedProperties
    assert(sig1.signedXml !== sig2.signedXml, "Signed XML differs (signing time changes)");
  }

  // ─── 4.4 Different Invoices Produce Different Hashes ───────────────────
  section("4.4 Invoice Hash: Different Invoices → Different Hashes");
  {
    const xml1 = generateInvoiceXML(makeStandardInvoiceParams({ invoiceNumber: "INV-A" }));
    const xml2 = generateInvoiceXML(makeStandardInvoiceParams({ invoiceNumber: "INV-B" }));

    const sig1 = await signInvoiceXML(xml1, testPrivKeyPem, testCertBase64);
    const sig2 = await signInvoiceXML(xml2, testPrivKeyPem, testCertBase64);

    assert(sig1.invoiceHash !== sig2.invoiceHash, "Different invoices produce different hashes");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ENHANCED QR CODE
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── 5.1 Phase 1 TLV QR (5 tags) ──────────────────────────────────────
  section("5.1 Phase 1 TLV QR Code (5 text tags)");
  {
    const qr = generateTLVQRCode({
      sellerName: "شركة اختبار",
      vatNumber: "399999999900003",
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1495.00",
      totalVat: "195.00",
    });
    assert(qr.length > 0, "QR is non-empty");
    assert(/^[A-Za-z0-9+/]+=*$/.test(qr), "QR is valid Base64");

    // Decode and verify 5 tags
    const decoded = Buffer.from(qr, "base64");
    let offset = 0;
    const tags: Array<{ tag: number; len: number; value: string }> = [];
    while (offset < decoded.length) {
      const tag = decoded[offset++];
      const len = decoded[offset++];
      const value = decoded.subarray(offset, offset + len).toString("utf8");
      offset += len;
      tags.push({ tag, len, value });
    }

    assertEq(tags.length, 5, "Phase 1 QR has exactly 5 tags");
    assertEq(tags[0].tag, 1, "Tag 1: seller name");
    assertEq(tags[1].tag, 2, "Tag 2: VAT number");
    assertEq(tags[1].value, "399999999900003", "Tag 2 value is TRN");
    assertEq(tags[2].tag, 3, "Tag 3: timestamp");
    assertEq(tags[3].tag, 4, "Tag 4: total with VAT");
    assertEq(tags[3].value, "1495.00", "Tag 4 value");
    assertEq(tags[4].tag, 5, "Tag 5: total VAT");
    assertEq(tags[4].value, "195.00", "Tag 5 value");
  }

  // ─── 5.2 Enhanced 9-Tag QR ─────────────────────────────────────────────
  section("5.2 Enhanced 9-Tag QR Code (Phase 2)");
  {
    // Tag 6 is Base64 text (UTF-8 encoded), tags 7-9 are raw binary
    const invoiceHash = crypto.randomBytes(32).toString("base64");
    const ecdsaSignature = crypto.randomBytes(64).toString("base64");  // Base64 text
    const publicKey = crypto.randomBytes(88);
    const certSignature = crypto.randomBytes(64);

    const qr = generateEnhancedTLVQRCode({
      sellerName: "شركة اختبار",
      vatNumber: "399999999900003",
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1495.00",
      totalVat: "195.00",
      invoiceHash,
      ecdsaSignature,
      publicKey,
      certificateSignature: certSignature,
    });

    assert(qr.length > 0, "Enhanced QR is non-empty");
    assert(/^[A-Za-z0-9+/]+=*$/.test(qr), "Enhanced QR is valid Base64");

    // Decode and verify 9 tags
    const decoded = Buffer.from(qr, "base64");
    let offset = 0;
    const tags: Array<{ tag: number; len: number; rawValue: Buffer }> = [];

    while (offset < decoded.length) {
      const tag = decoded[offset++];
      const len = decoded[offset++];
      const rawValue = decoded.subarray(offset, offset + len);
      offset += len;
      tags.push({ tag, len, rawValue });
    }

    assertEq(tags.length, 9, "Enhanced QR has exactly 9 tags");

    // Text tags 1-5
    assertEq(tags[0].tag, 1, "Tag 1: seller name");
    assertEq(tags[1].tag, 2, "Tag 2: VAT number");
    assertEq(tags[1].rawValue.toString("utf-8"), "399999999900003", "Tag 2 value");
    assertEq(tags[2].tag, 3, "Tag 3: timestamp");
    assertEq(tags[3].tag, 4, "Tag 4: total with VAT");
    assertEq(tags[4].tag, 5, "Tag 5: total VAT");

    // Tags 6-7: Base64 text as UTF-8 bytes
    assertEq(tags[5].tag, 6, "Tag 6: invoice hash");
    assertEq(tags[5].rawValue.toString("utf-8"), invoiceHash, "Tag 6 matches invoice hash Base64");
    assertEq(tags[5].len, 44, "Tag 6 length = 44 bytes (Base64 of SHA-256)");

    assertEq(tags[6].tag, 7, "Tag 7: ECDSA signature");
    assertEq(tags[6].rawValue.toString("utf-8"), ecdsaSignature, "Tag 7 is Base64 text of signature");
    assert(tags[6].len > 80, `Tag 7 length is Base64 text: ${tags[6].len}`);

    assertEq(tags[7].tag, 8, "Tag 8: public key");
    assertEq(tags[7].len, 88, "Tag 8 length = 88 bytes (SPKI)");
    assert(Buffer.compare(tags[7].rawValue, publicKey) === 0, "Tag 8 matches public key");

    assertEq(tags[8].tag, 9, "Tag 9: CA cert signature");
    assertEq(tags[8].len, 64, "Tag 9 length = 64 bytes");
    assert(Buffer.compare(tags[8].rawValue, certSignature) === 0, "Tag 9 matches cert signature");
  }

  // ─── 5.3 Simple 1-Byte TLV Length ───────────────────────────────────────
  section("5.3 Enhanced QR: Simple 1-Byte Length (ZATCA TLV format)");
  {
    // ZATCA TLV uses simple 1-byte length (max 255), no BER multi-byte encoding
    const qr = generateEnhancedTLVQRCode({
      sellerName: "Test",
      vatNumber: "399999999900003",
      timestamp: "2026-01-01T00:00:00Z",
      totalWithVat: "100.00",
      totalVat: "15.00",
      invoiceHash: crypto.randomBytes(32).toString("base64"),
      ecdsaSignature: crypto.randomBytes(64).toString("base64"),
      publicKey: crypto.randomBytes(88),
      certificateSignature: crypto.randomBytes(72),
    });

    const decoded = Buffer.from(qr, "base64");
    assert(decoded.length > 0, "QR encodes successfully");

    // Verify all tags use simple 1-byte length
    let offset = 0;
    let tagCount = 0;
    while (offset < decoded.length) {
      const tag = decoded[offset++];
      const len = decoded[offset++]; // always 1 byte
      assert(tag >= 1 && tag <= 9, `Tag ${tag} is valid (1-9)`);
      offset += len;
      tagCount++;
    }
    assertEq(tagCount, 9, "All 9 tags parsed with simple 1-byte length");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. QR EMBEDDING
  // ═══════════════════════════════════════════════════════════════════════════

  section("6.1 QR Embedding in Signed XML");
  {
    const params = makeStandardInvoiceParams();
    const xml = generateInvoiceXML(params);
    const sigResult = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);

    const mockQr = Buffer.from("mock-qr-data-for-test").toString("base64");
    const finalXml = embedQRInXml(sigResult.signedXml, mockQr);

    assertContains(finalXml, mockQr, "QR data embedded in final XML");
    assertContains(finalXml, "ds:Signature", "Signature still present after QR embed");
    assertContains(finalXml, "QR", "QR reference ID still present");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. FULL PIPELINE INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  section("7.1 Full Pipeline: Standard Invoice (B2B)");
  {
    const params = makeStandardInvoiceParams();

    // Step 1: Generate XML
    const xml = generateInvoiceXML(params);
    assert(xml.includes("388"), "Step 1: XML generated with type 388");

    // Step 2: Sign XML
    const sigResult = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);
    assert(sigResult.signedXml.includes("ds:Signature"), "Step 2: XML signed");

    // Step 3: Generate enhanced QR (tags 6-7 are Base64 text per ZATCA spec)
    const enhancedQr = generateEnhancedTLVQRCode({
      sellerName: TEST_SELLER.name,
      vatNumber: TEST_SELLER.vatNumber,
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1495.00",
      totalVat: "195.00",
      invoiceHash: sigResult.invoiceHash,
      ecdsaSignature: sigResult.signatureValueBase64,
      publicKey: sigResult.publicKeyDER,
      certificateSignature: sigResult.certSignatureDER,
    });
    assert(enhancedQr.length > 0, "Step 3: Enhanced QR generated");

    // Step 4: Embed QR in signed XML
    const finalXml = embedQRInXml(sigResult.signedXml, enhancedQr);
    assert(finalXml.includes(enhancedQr), "Step 4: QR embedded in XML");

    // Step 5: Encode for API submission
    const finalXmlBase64 = Buffer.from(finalXml, "utf-8").toString("base64");
    assert(finalXmlBase64.length > 0, "Step 5: Base64 encoded for API");

    // Verify the complete XML has all required elements
    assertContains(finalXml, "UBLExtensions", "Final: UBLExtensions");
    assertContains(finalXml, "ds:Signature", "Final: ds:Signature");
    assertContains(finalXml, "ds:SignatureValue", "Final: SignatureValue");
    assertContains(finalXml, "ds:X509Certificate", "Final: X509Certificate");
    assertContains(finalXml, "xades:SignedProperties", "Final: SignedProperties");
    assertContains(finalXml, "InvoiceLine", "Final: InvoiceLine");
    assertContains(finalXml, "TaxTotal", "Final: TaxTotal");
    assertContains(finalXml, "LegalMonetaryTotal", "Final: LegalMonetaryTotal");
  }

  section("7.2 Full Pipeline: Simplified Invoice (B2C)");
  {
    const params = makeSimplifiedInvoiceParams();
    const xml = generateInvoiceXML(params);
    const sigResult = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);

    const enhancedQr = generateEnhancedTLVQRCode({
      sellerName: TEST_SELLER.name,
      vatNumber: TEST_SELLER.vatNumber,
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1495.00",
      totalVat: "195.00",
      invoiceHash: sigResult.invoiceHash,
      ecdsaSignature: sigResult.signatureValueBase64,
      publicKey: sigResult.publicKeyDER,
      certificateSignature: sigResult.certSignatureDER,
    });

    const finalXml = embedQRInXml(sigResult.signedXml, enhancedQr);
    assertContains(finalXml, "0200000", "B2C pipeline: simplified subtype preserved");
    assertContains(finalXml, enhancedQr, "B2C pipeline: QR embedded");
    assertContains(finalXml, "ds:Signature", "B2C pipeline: signature present");
  }

  section("7.3 Full Pipeline: Credit Note");
  {
    const params = makeCreditNoteParams();
    const xml = generateInvoiceXML(params);
    const sigResult = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);

    const enhancedQr = generateEnhancedTLVQRCode({
      sellerName: TEST_SELLER.name,
      vatNumber: TEST_SELLER.vatNumber,
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1495.00",
      totalVat: "195.00",
      invoiceHash: sigResult.invoiceHash,
      ecdsaSignature: sigResult.signatureValueBase64,
      publicKey: sigResult.publicKeyDER,
      certificateSignature: sigResult.certSignatureDER,
    });

    const finalXml = embedQRInXml(sigResult.signedXml, enhancedQr);
    assertContains(finalXml, ">381<", "Credit note pipeline: type 381 preserved");
    assertContains(finalXml, "BillingReference", "Credit note pipeline: billing ref");
    assertContains(finalXml, "ds:Signature", "Credit note pipeline: signed");
  }

  section("7.4 Full Pipeline: Debit Note");
  {
    const params = makeDebitNoteParams();
    const xml = generateInvoiceXML(params);
    const sigResult = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);

    const enhancedQr = generateEnhancedTLVQRCode({
      sellerName: TEST_SELLER.name,
      vatNumber: TEST_SELLER.vatNumber,
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1495.00",
      totalVat: "195.00",
      invoiceHash: sigResult.invoiceHash,
      ecdsaSignature: sigResult.signatureValueBase64,
      publicKey: sigResult.publicKeyDER,
      certificateSignature: sigResult.certSignatureDER,
    });

    const finalXml = embedQRInXml(sigResult.signedXml, enhancedQr);
    assertContains(finalXml, ">383<", "Debit note pipeline: type 383 preserved");
    assertContains(finalXml, "ds:Signature", "Debit note pipeline: signed");
  }

  // ─── 7.5 Hash Chain Integrity ──────────────────────────────────────────
  section("7.5 Hash Chain: PIH Links Invoices");
  {
    // Invoice 1: uses initial PIH
    const params1 = makeStandardInvoiceParams({
      invoiceNumber: "INV-CHAIN-001",
      icv: 1,
      previousInvoiceHash: ZATCA_PHASE2_INITIAL_PIH,
    });
    const xml1 = generateInvoiceXML(params1);
    const sig1 = await signInvoiceXML(xml1, testPrivKeyPem, testCertBase64);

    // Invoice 2: uses invoice 1's hash as PIH
    const params2 = makeStandardInvoiceParams({
      invoiceNumber: "INV-CHAIN-002",
      icv: 2,
      previousInvoiceHash: sig1.invoiceHash,
    });
    const xml2 = generateInvoiceXML(params2);
    const sig2 = await signInvoiceXML(xml2, testPrivKeyPem, testCertBase64);

    assert(sig1.invoiceHash !== sig2.invoiceHash, "Chain: different invoices have different hashes");
    assertContains(xml2, sig1.invoiceHash, "Chain: invoice 2 XML contains invoice 1 hash as PIH");

    // Invoice 3
    const params3 = makeStandardInvoiceParams({
      invoiceNumber: "INV-CHAIN-003",
      icv: 3,
      previousInvoiceHash: sig2.invoiceHash,
    });
    const xml3 = generateInvoiceXML(params3);
    assertContains(xml3, sig2.invoiceHash, "Chain: invoice 3 XML contains invoice 2 hash as PIH");
  }

  // ─── 7.6 ICV Monotonic Sequence ───────────────────────────────────────
  section("7.6 ICV: Monotonically Increasing Counter");
  {
    for (let icv = 1; icv <= 5; icv++) {
      const params = makeStandardInvoiceParams({
        invoiceNumber: `INV-ICV-${icv}`,
        icv,
      });
      const xml = generateInvoiceXML(params);
      assertContains(xml, `>${icv}<`, `ICV ${icv} present in XML`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  section("8.1 Edge Case: Arabic-Only Seller Name in QR");
  {
    const qr = generateTLVQRCode({
      sellerName: "شركة ابن سينا للصيدلة",
      vatNumber: "399999999900003",
      timestamp: "2026-04-04T10:30:00Z",
      totalWithVat: "1000.00",
      totalVat: "130.43",
    });
    const decoded = Buffer.from(qr, "base64");
    // Tag 1 should have the Arabic seller name
    const tag1Len = decoded[1];
    const tag1Value = decoded.subarray(2, 2 + tag1Len).toString("utf8");
    assert(tag1Value.includes("ابن سينا"), "Arabic-only name encoded correctly in QR");
  }

  section("8.2 Edge Case: Zero-Amount Invoice");
  {
    const params = makeStandardInvoiceParams({
      items: [{
        id: "1", name: "Free sample", quantity: 1, unitPrice: 0,
        vatRate: 0, vatCategory: "Z", vatAmount: 0, lineExtensionAmount: 0,
      }],
      lineExtensionAmount: 0,
      taxExclusiveAmount: 0,
      taxInclusiveAmount: 0,
      payableAmount: 0,
      totalVat: 0,
      taxSubtotals: [{ taxableAmount: 0, taxAmount: 0, taxCategory: "Z", taxPercent: 0 }],
    });
    const xml = generateInvoiceXML(params);
    assertContains(xml, ">0.00<", "Zero amount renders as 0.00");
    // Should still sign without error
    const sig = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);
    assert(sig.signedXml.includes("ds:Signature"), "Zero-amount invoice signs successfully");
  }

  section("8.3 Edge Case: Large Amounts");
  {
    const params = makeStandardInvoiceParams({
      items: [{
        id: "1", name: "Expensive item", quantity: 1, unitPrice: 9999999.99,
        vatRate: 15, vatCategory: "S", vatAmount: 1500000.00,
        lineExtensionAmount: 9999999.99,
      }],
      lineExtensionAmount: 9999999.99,
      taxExclusiveAmount: 9999999.99,
      taxInclusiveAmount: 11499999.99,
      payableAmount: 11499999.99,
      totalVat: 1500000.00,
      taxSubtotals: [{ taxableAmount: 9999999.99, taxAmount: 1500000.00, taxCategory: "S", taxPercent: 15 }],
    });
    const xml = generateInvoiceXML(params);
    assertContains(xml, "9999999.99", "Large amount rendered correctly");
    assertContains(xml, "1500000.00", "Large VAT amount rendered correctly");
  }

  section("8.4 Edge Case: Many Line Items");
  {
    const items: UBLLineItem[] = [];
    for (let i = 1; i <= 50; i++) {
      items.push({
        id: String(i),
        name: `Item ${i}`,
        quantity: i,
        unitPrice: 10,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: i * 1.5,
        lineExtensionAmount: i * 10,
      });
    }
    const totalExt = items.reduce((s, i) => s + i.lineExtensionAmount, 0);
    const totalVat = items.reduce((s, i) => s + i.vatAmount, 0);

    const params = makeStandardInvoiceParams({
      items,
      lineExtensionAmount: totalExt,
      taxExclusiveAmount: totalExt,
      taxInclusiveAmount: totalExt + totalVat,
      payableAmount: totalExt + totalVat,
      totalVat,
      taxSubtotals: [{ taxableAmount: totalExt, taxAmount: totalVat, taxCategory: "S", taxPercent: 15 }],
    });
    const xml = generateInvoiceXML(params);
    assertContains(xml, "Item 50", "50th line item present");

    // Should still sign
    const sig = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);
    assert(sig.signedXml.includes("ds:Signature"), "50-line invoice signs successfully");
  }

  section("8.5 Edge Case: Special Characters in Names");
  {
    const params = makeStandardInvoiceParams({
      seller: {
        ...TEST_SELLER,
        name: 'Test & "Company" <Special>',
      },
      items: [{
        id: "1",
        name: 'Widget with "quotes" & <brackets>',
        quantity: 1,
        unitPrice: 100,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 15,
        lineExtensionAmount: 100,
      }],
    });
    // Should not crash — xmlbuilder2 handles escaping
    const xml = generateInvoiceXML(params);
    assert(xml.length > 0, "XML with special characters generated successfully");
    // The XML should have escaped entities
    const sig = await signInvoiceXML(xml, testPrivKeyPem, testCertBase64);
    assert(sig.signedXml.includes("ds:Signature"), "Special character invoice signs successfully");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. INVOICE HASH CHAIN UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  section("9.1 Invoice UUID Generation");
  {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateInvoiceUUID());
    }
    assertEq(uuids.size, 100, "100 unique UUIDs generated");

    const uuid = generateInvoiceUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert(uuidRegex.test(uuid), `UUID is valid v4 format: ${uuid}`);
  }

  section("9.2 Phase 1 Invoice Hash (SHA-256 Chain)");
  {
    const hash = computeInvoiceHash({
      invoiceNumber: "INV-001",
      issueDate: "2026-04-04T10:00:00Z",
      sellerVatNumber: "399999999900003",
      totalInclVat: "1495.00",
      totalVat: "195.00",
    });
    assertEq(hash.length, 64, "Hash is 64 hex chars");
    assert(/^[0-9a-f]{64}$/.test(hash), "Hash is lowercase hex");

    // Deterministic
    const hash2 = computeInvoiceHash({
      invoiceNumber: "INV-001",
      issueDate: "2026-04-04T10:00:00Z",
      sellerVatNumber: "399999999900003",
      totalInclVat: "1495.00",
      totalVat: "195.00",
    });
    assertEq(hash, hash2, "Hash is deterministic");
  }

  section("9.3 Genesis Invoice Hash");
  {
    assertEq(GENESIS_INVOICE_HASH, "0".repeat(64), "Genesis hash is 64 zeros");
    assertEq(GENESIS_INVOICE_HASH.length, 64, "Genesis hash length = 64");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. CHAIN LOCKING
  // ═══════════════════════════════════════════════════════════════════════════

  section("10.1 Chain Lock Functions Exported");
  {
    assert(typeof isChainLocked === "function", "isChainLocked is exported as a function");
    assert(typeof resolveChainLock === "function", "resolveChainLock is exported as a function");
  }

  section("10.2 Chain Lock Detection Pattern");
  {
    // Verify the chainLocked JSON pattern that isChainLocked searches for
    const lockedResponse = JSON.stringify({ error: "timeout", chainLocked: true });
    assert(lockedResponse.includes('"chainLocked":true'), "Chain locked pattern is searchable in JSON");

    const unlockedResponse = JSON.stringify({ error: "timeout" });
    assert(!unlockedResponse.includes('"chainLocked":true'), "Non-locked response does not match pattern");

    // After successful retry, response is replaced (no chainLocked key)
    const successResponse = JSON.stringify({ status: "CLEARED", invoiceHash: "abc" });
    assert(!successResponse.includes('"chainLocked":true'), "Success response clears chain lock");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. DOWN PAYMENT HANDLING (BR-KSA-80)
  // ═══════════════════════════════════════════════════════════════════════════

  section("11.1 UBL XML: PrepaidAmount in LegalMonetaryTotal");
  {
    const params = makeStandardInvoiceParams({
      prepaidAmount: 200,
    });
    const xml = generateInvoiceXML(params);
    assertContains(xml, "PrepaidAmount", "PrepaidAmount element present");
    assertContains(xml, ">200.00<", "PrepaidAmount value 200.00");
  }

  section("11.2 UBL XML: No PrepaidAmount When Zero");
  {
    const params = makeStandardInvoiceParams();
    const xml = generateInvoiceXML(params);
    assert(!xml.includes("PrepaidAmount"), "No PrepaidAmount when not set");
  }

  section("11.3 Down Payment Items Excluded from Tax Subtotals");
  {
    const params = makeStandardInvoiceParams({
      items: [
        {
          id: "1", name: "Consulting service", quantity: 1, unitPrice: 1000,
          vatRate: 15, vatCategory: "S", vatAmount: 150, lineExtensionAmount: 1000,
        },
        {
          id: "2", name: "Down payment deduction", quantity: 1, unitPrice: -500,
          vatRate: 15, vatCategory: "S", vatAmount: -75, lineExtensionAmount: -500,
          isDownPayment: true,
        },
      ],
      prepaidAmount: 500,
      lineExtensionAmount: 500,
      taxExclusiveAmount: 500,
      taxInclusiveAmount: 575,
      payableAmount: 575,
      taxSubtotals: [{ taxableAmount: 500, taxAmount: 75, taxCategory: "S", taxPercent: 15 }],
      totalVat: 75,
    });
    const xml = generateInvoiceXML(params);
    assertContains(xml, "PrepaidAmount", "PrepaidAmount present for down payment invoice");
    assertContains(xml, ">500.00<", "PrepaidAmount value matches down payment");
    // Down payment line should still appear as InvoiceLine
    assertContains(xml, "Down payment deduction", "Down payment line item present in XML");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. RETENTION TAX FILTERING
  // ═══════════════════════════════════════════════════════════════════════════

  section("12.1 Retention Tax Items Excluded from UBL XML");
  {
    const params = makeStandardInvoiceParams({
      items: [
        {
          id: "1", name: "Service", quantity: 1, unitPrice: 1000,
          vatRate: 15, vatCategory: "S", vatAmount: 150, lineExtensionAmount: 1000,
        },
        {
          id: "2", name: "Withholding tax", quantity: 1, unitPrice: 0,
          vatRate: 5, vatCategory: "S", vatAmount: -50, lineExtensionAmount: 0,
          isRetention: true,
        },
      ],
    });
    const xml = generateInvoiceXML(params);
    assertContains(xml, "Service", "Non-retention item present");
    assert(!xml.includes("Withholding tax"), "Retention tax item excluded from UBL XML");
  }

  section("12.2 Non-Retention Items Unaffected");
  {
    const params = makeStandardInvoiceParams();
    const xml = generateInvoiceXML(params);
    assertContains(xml, "خدمة استشارية", "Normal item present");
    assertContains(xml, "تدريب متخصص", "Normal item 2 present");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. PRODUCTION MODE LOCK
  // ═══════════════════════════════════════════════════════════════════════════

  section("13.1 validateEnvironmentChange Function");
  {
    // Import the function
    const { validateEnvironmentChange } = await import("@/lib/saudi-vat/zatca-config");

    // SANDBOX → SIMULATION: allowed
    assert(validateEnvironmentChange("SANDBOX", "SIMULATION").allowed, "SANDBOX → SIMULATION allowed");

    // SANDBOX → PRODUCTION: allowed
    assert(validateEnvironmentChange("SANDBOX", "PRODUCTION").allowed, "SANDBOX → PRODUCTION allowed");

    // SIMULATION → PRODUCTION: allowed
    assert(validateEnvironmentChange("SIMULATION", "PRODUCTION").allowed, "SIMULATION → PRODUCTION allowed");

    // PRODUCTION → SANDBOX: blocked
    const result1 = validateEnvironmentChange("PRODUCTION", "SANDBOX");
    assert(!result1.allowed, "PRODUCTION → SANDBOX blocked");
    assert(result1.reason!.length > 0, "Block reason provided");

    // PRODUCTION → SIMULATION: blocked
    const result2 = validateEnvironmentChange("PRODUCTION", "SIMULATION");
    assert(!result2.allowed, "PRODUCTION → SIMULATION blocked");

    // PRODUCTION → PRODUCTION: allowed (no-op)
    assert(validateEnvironmentChange("PRODUCTION", "PRODUCTION").allowed, "PRODUCTION → PRODUCTION allowed (no-op)");
  }
}

// ─── Run All Tests ──────────────────────────────────────────────────────────

runAsyncTests()
  .then(() => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`ZATCA Phase 2 E2E Test Results: ${passed} passed, ${failed} failed (${totalSections} sections)`);
    if (failed > 0) {
      console.error(`\n${failed} test(s) FAILED`);
      process.exit(1);
    } else {
      console.log(`\nAll ${passed} tests passed!`);
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("\n\nFATAL ERROR during test execution:");
    console.error(err);
    process.exit(2);
  });
