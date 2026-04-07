/**
 * ZATCA Official SDK Validation Test
 * Generates invoices with our implementation, then validates with the
 * official ZATCA Java SDK (fatoora CLI).
 *
 * Requires: zatca-einvoicing-sdk-Java-238-R3.4.8 in project root.
 *
 * Run with:
 *   ZATCA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npx tsx src/__tests__/zatca-official-sdk.test.ts
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

if (!process.env.ZATCA_ENCRYPTION_KEY) {
  process.env.ZATCA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
}

import {
  generateInvoiceXML,
  type UBLInvoiceParams,
  type UBLPartyInfo,
} from "@/lib/saudi-vat/ubl-xml";

import {
  signInvoiceXML,
  embedQRInXml,
  extractQRDataFromSignedXml,
} from "@/lib/saudi-vat/xml-signing";

import {
  generateEnhancedTLVQRCode,
} from "@/lib/saudi-vat/qr-code";

import { generateInvoiceUUID } from "@/lib/saudi-vat/invoice-hash";

import { ZATCA_PHASE2_INITIAL_PIH } from "@/lib/saudi-vat/zatca-config";

// ─── Test Harness ───────────────────────────────────────────────────────────

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

function section(name: string): void {
  totalSections++;
  console.log(`\n── ${name} ──`);
}

// ─── SDK Setup ──────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, "../..");

// R3.4.8 (Java 11)
const SDK_DIR = path.join(PROJECT_ROOT, "zatca-einvoicing-sdk-Java-238-R3.4.8");
const SDK_JAR = path.join(SDK_DIR, "Apps/zatca-einvoicing-sdk-238-R3.4.8.jar");
const SDK_CONFIG = path.join(SDK_DIR, "Configuration/config.json");
const OUTPUT_DIR = path.join(SDK_DIR, "Data/Input");

// R4.0.0 (Java 21)
const SDK4_DIR = path.join(PROJECT_ROOT, "zatca-einvoicing-sdk-238-R4.0.0");
const SDK4_JAR = path.join(SDK4_DIR, "Apps/zatca-einvoicing-sdk-238-R4.0.0.jar");
const SDK4_CONFIG = path.join(SDK4_DIR, "Configuration/config.json");
const SDK4_OUTPUT_DIR = path.join(SDK4_DIR, "Data/Input");
const JAVA21 = "/opt/homebrew/opt/openjdk@21/bin/java";

const SDK_CERT_PATH = path.join(SDK_DIR, "Data/Certificates/cert.pem");
const SDK_KEY_PATH = path.join(SDK_DIR, "Data/Certificates/ec-secp256k1-priv-key.pem");

// SDK certificate and private key (bundled with the SDK)
const SDK_CERT_BASE64 = fs.readFileSync(SDK_CERT_PATH, "utf-8").trim();
const SDK_EC_KEY_RAW = fs.readFileSync(SDK_KEY_PATH, "utf-8").trim();

// Convert EC key to PKCS#8 PEM for our WebCrypto-based signer
// The SDK key is raw base64 (no PEM headers), EC format
const SDK_EC_KEY_PEM = `-----BEGIN EC PRIVATE KEY-----\n${SDK_EC_KEY_RAW}\n-----END EC PRIVATE KEY-----`;

// Seller info matching the SDK certificate subject
const SDK_SELLER: UBLPartyInfo = {
  name: "شركة توريد التكنولوجيا بأقصى سرعة المحدودة | Maximum Speed Tech Supply LTD",
  vatNumber: "399999999900003",
  commercialRegNumber: "1010010000",
  streetName: "الامير سلطان | Prince Sultan",
  buildingNumber: "2322",
  plotIdentification: "2223",
  citySubdivision: "المربع | Al-Murabba",
  city: "الرياض | Riyadh",
  postalZone: "23333",
  countryCode: "SA",
};

const SDK_BUYER: UBLPartyInfo = {
  name: "شركة نماذج فاتورة المحدودة | Fatoora Samples LTD",
  vatNumber: "399999999800003",
  streetName: "صلاح الدين | Salah Al-Din",
  buildingNumber: "1111",
  citySubdivision: "المروج | Al-Murooj",
  city: "الرياض | Riyadh",
  postalZone: "12222",
  countryCode: "SA",
};

interface SDKResult {
  output: string;
  passed: boolean;
  xsd: boolean;
  en: boolean;
  ksa: boolean;
  qr: boolean;
  signature: boolean;
  pih: boolean;
  warnings: string[];
  errors: string[];
}

function runSDKValidation(invoiceFile: string, opts?: {
  jarPath?: string; version?: string; sdkConfig?: string; sdkDir?: string; javaPath?: string;
}): SDKResult {
  const jar = opts?.jarPath ?? SDK_JAR;
  const ver = opts?.version ?? "238-R3.4.8";
  const config = opts?.sdkConfig ?? SDK_CONFIG;
  const dir = opts?.sdkDir ?? SDK_DIR;
  const javaCmd = opts?.javaPath ?? "java";

  const cmd = [
    `"${javaCmd}"`,
    "-Djdk.module.illegalAccess=deny",
    "-Djdk.sunec.disableNative=false",
    "-jar", `"${jar}"`,
    "--globalVersion", ver,
    "-validate",
    "-invoice", `"${invoiceFile}"`,
  ].join(" ");

  let output: string;
  try {
    output = execSync(cmd, {
      env: { ...process.env, SDK_CONFIG: config, FATOORA_HOME: path.join(dir, "Apps") },
      timeout: 30000,
      encoding: "utf-8",
    });
  } catch (e: any) {
    output = e.stdout || e.stderr || e.message;
  }

  const xsd = output.includes("[XSD] validation result : PASSED");
  const en = output.includes("[EN] validation result : PASSED");
  const ksa = output.includes("[KSA] validation result : PASSED");
  const qr = output.includes("[QR] validation result : PASSED");
  const signature = output.includes("[SIGNATURE] validation result : PASSED");
  const pih = output.includes("[PIH] validation result : PASSED");
  const globalPassed = output.includes("GLOBAL VALIDATION RESULT = PASSED");

  const warnings = (output.match(/\[WARN\].*MESSAGE : (.+)/g) || []).map(
    (w) => w.replace(/.*MESSAGE : /, "")
  );
  const errors = (output.match(/\[ERROR\].*MESSAGE : (.+)/g) || []).map(
    (e) => e.replace(/.*MESSAGE : /, "")
  );

  return { output, passed: globalPassed, xsd, en, ksa, qr, signature, pih, warnings, errors };
}

// ─── Generate, Sign, and Write Invoice ──────────────────────────────────────

async function generateSignedInvoice(
  params: UBLInvoiceParams,
  filename: string
): Promise<{ filePath: string; xml: string; hash: string }> {
  // 1. Generate XML
  const xml = generateInvoiceXML(params);

  // 2. Sign with SDK certificate and key (convert EC to PKCS#8 at runtime)
  // Our signer needs PKCS#8, but SDK key is EC format.
  // Use openssl to convert, or import directly.
  const privateKeyPem = await ecToPkcs8(SDK_EC_KEY_RAW);

  const signingResult = await signInvoiceXML(xml, privateKeyPem, SDK_CERT_BASE64);

  // 3. Extract QR data from signed XML
  const qrData = extractQRDataFromSignedXml(signingResult.signedXml);

  // 4. Generate enhanced QR
  const enhancedQR = generateEnhancedTLVQRCode({
    sellerName: params.seller.name,
    vatNumber: params.seller.vatNumber,
    timestamp: `${params.issueDate}T${params.issueTime}`,
    totalWithVat: params.taxInclusiveAmount.toFixed(2),
    totalVat: params.totalVat.toFixed(2),
    invoiceHash: qrData.digestValue,
    ecdsaSignature: qrData.signatureValue,
    publicKey: signingResult.publicKeyDER,
    certificateSignature: signingResult.certSignatureDER,
  });

  // 5. Embed QR
  const finalXml = embedQRInXml(signingResult.signedXml, enhancedQR);

  // 6. Write to file
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, finalXml, "utf-8");

  return { filePath, xml: finalXml, hash: signingResult.invoiceHash };
}

async function ecToPkcs8(ecKeyBase64: string): Promise<string> {
  // Convert EC private key (raw base64) to PKCS#8 PEM using openssl
  const tmpEc = path.join(OUTPUT_DIR, `_tmp_ec_${Date.now()}.pem`);
  const tmpPkcs8 = path.join(OUTPUT_DIR, `_tmp_pkcs8_${Date.now()}.pem`);
  try {
    fs.writeFileSync(tmpEc, `-----BEGIN EC PRIVATE KEY-----\n${ecKeyBase64}\n-----END EC PRIVATE KEY-----\n`);
    execSync(`openssl pkcs8 -topk8 -nocrypt -in "${tmpEc}" -out "${tmpPkcs8}" 2>&1`);
    return fs.readFileSync(tmpPkcs8, "utf-8").trim();
  } finally {
    try { fs.unlinkSync(tmpEc); } catch {}
    try { fs.unlinkSync(tmpPkcs8); } catch {}
  }
}

// ─── Test Invoice Generators ────────────────────────────────────────────────

function makeSimplifiedInvoice(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  const now = new Date();
  const issueDate = now.toISOString().slice(0, 10);
  const issueTime = now.toISOString().slice(11, 19);
  return {
    invoiceNumber: "SME00099",
    uuid: generateInvoiceUUID(),
    issueDate,
    issueTime,
    documentType: "388",
    invoiceSubtype: "0200000",
    icv: 10,
    previousInvoiceHash: ZATCA_PHASE2_INITIAL_PIH,
    seller: SDK_SELLER,
    buyer: SDK_BUYER,
    deliveryDate: issueDate,
    paymentMeansCode: "10",
    items: [
      {
        id: "1",
        name: "كتاب",
        quantity: 33,
        unitPrice: 3,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 14.85,
        lineExtensionAmount: 99,
      },
      {
        id: "2",
        name: "قلم",
        quantity: 3,
        unitPrice: 34,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 15.30,
        lineExtensionAmount: 102,
      },
    ],
    lineExtensionAmount: 201,
    taxExclusiveAmount: 201,
    taxInclusiveAmount: 231.15,
    payableAmount: 231.15,
    taxSubtotals: [
      { taxableAmount: 201, taxAmount: 30.15, taxCategory: "S", taxPercent: 15 },
    ],
    totalVat: 30.15,
    ...overrides,
  };
}

function makeStandardInvoice(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return makeSimplifiedInvoice({
    invoiceNumber: "STD00099",
    invoiceSubtype: "0100000",
    buyer: SDK_BUYER,
    ...overrides,
  });
}

function makeCreditNote(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return makeSimplifiedInvoice({
    invoiceNumber: "CN00099",
    documentType: "381",
    billingReferenceId: "SME00099",
    paymentMeansCode: "10",
    instructionNote: "Goods returned",
    ...overrides,
  });
}

function makeDebitNote(overrides: Partial<UBLInvoiceParams> = {}): UBLInvoiceParams {
  return makeSimplifiedInvoice({
    invoiceNumber: "DN00099",
    documentType: "383",
    billingReferenceId: "SME00099",
    paymentMeansCode: "10",
    instructionNote: "Price adjustment",
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════

async function runTests(): Promise<void> {
  // Verify SDK exists
  section("0. SDK Setup Verification");
  assert(fs.existsSync(SDK_JAR), `SDK JAR exists: ${path.basename(SDK_JAR)}`);
  assert(fs.existsSync(SDK_CERT_PATH), "SDK certificate exists");
  assert(fs.existsSync(SDK_KEY_PATH), "SDK private key exists");

  // Verify SDK works with its own sample
  const sampleResult = runSDKValidation(
    path.join(SDK_DIR, "Data/Samples/Simplified/Invoice/Simplified_Invoice.xml")
  );
  assert(sampleResult.passed, "SDK validates its own sample invoice");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SIMPLIFIED INVOICE
  // ═══════════════════════════════════════════════════════════════════════════

  section("1. Simplified Invoice — Generate & Sign");
  const simplified = await generateSignedInvoice(
    makeSimplifiedInvoice(),
    "our_simplified_invoice.xml"
  );
  assert(fs.existsSync(simplified.filePath), "Signed XML written to file");
  console.log(`    Hash: ${simplified.hash}`);

  section("1.1 Simplified Invoice — SDK Validation");
  const simplifiedResult = runSDKValidation(simplified.filePath);

  assert(simplifiedResult.xsd, "[XSD] UBL 2.1 schema validation");
  assert(simplifiedResult.en, "[EN] EN16931 business rules");
  assert(simplifiedResult.ksa, "[KSA] ZATCA-specific rules");
  assert(simplifiedResult.qr, "[QR] QR code validation");
  assert(simplifiedResult.signature, "[SIGNATURE] Digital signature");
  assert(simplifiedResult.pih, "[PIH] Previous invoice hash");
  assert(simplifiedResult.passed, "GLOBAL VALIDATION = PASSED");

  if (simplifiedResult.warnings.length > 0) {
    console.log(`    Warnings (${simplifiedResult.warnings.length}):`);
    simplifiedResult.warnings.forEach((w) => console.log(`      - ${w}`));
  }
  if (!simplifiedResult.passed) {
    console.log("\n    --- SDK OUTPUT ---");
    console.log(simplifiedResult.output);
    console.log("    --- END OUTPUT ---\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. STANDARD INVOICE
  // ═══════════════════════════════════════════════════════════════════════════

  section("2. Standard Invoice — Generate & Sign");
  const standard = await generateSignedInvoice(
    makeStandardInvoice(),
    "our_standard_invoice.xml"
  );
  assert(fs.existsSync(standard.filePath), "Signed XML written to file");

  section("2.1 Standard Invoice — SDK Validation");
  const standardResult = runSDKValidation(standard.filePath);

  assert(standardResult.xsd, "[XSD] UBL 2.1 schema validation");
  assert(standardResult.en, "[EN] EN16931 business rules");
  assert(standardResult.ksa, "[KSA] ZATCA-specific rules");
  // SDK skips QR and SIGNATURE for Standard (B2B) invoices — only validates at clearance time
  assert(standardResult.pih, "[PIH] Previous invoice hash");
  assert(standardResult.passed, "GLOBAL VALIDATION = PASSED");

  if (standardResult.warnings.length > 0) {
    console.log(`    Warnings (${standardResult.warnings.length}):`);
    standardResult.warnings.forEach((w) => console.log(`      - ${w}`));
  }
  if (!standardResult.passed) {
    console.log("\n    --- SDK OUTPUT ---");
    console.log(standardResult.output);
    console.log("    --- END OUTPUT ---\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SIMPLIFIED CREDIT NOTE
  // ═══════════════════════════════════════════════════════════════════════════

  section("3. Simplified Credit Note — Generate & Sign");
  const creditNote = await generateSignedInvoice(
    makeCreditNote(),
    "our_credit_note.xml"
  );
  assert(fs.existsSync(creditNote.filePath), "Signed XML written to file");

  section("3.1 Simplified Credit Note — SDK Validation");
  const creditResult = runSDKValidation(creditNote.filePath);

  assert(creditResult.xsd, "[XSD] UBL 2.1 schema validation");
  assert(creditResult.en, "[EN] EN16931 business rules");
  assert(creditResult.ksa, "[KSA] ZATCA-specific rules");
  assert(creditResult.qr, "[QR] QR code validation");
  assert(creditResult.signature, "[SIGNATURE] Digital signature");
  assert(creditResult.pih, "[PIH] Previous invoice hash");
  assert(creditResult.passed, "GLOBAL VALIDATION = PASSED");

  if (creditResult.warnings.length > 0) {
    console.log(`    Warnings (${creditResult.warnings.length}):`);
    creditResult.warnings.forEach((w) => console.log(`      - ${w}`));
  }
  if (!creditResult.passed) {
    console.log("\n    --- SDK OUTPUT ---");
    console.log(creditResult.output);
    console.log("    --- END OUTPUT ---\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SIMPLIFIED DEBIT NOTE
  // ═══════════════════════════════════════════════════════════════════════════

  section("4. Simplified Debit Note — Generate & Sign");
  const debitNote = await generateSignedInvoice(
    makeDebitNote(),
    "our_debit_note.xml"
  );
  assert(fs.existsSync(debitNote.filePath), "Signed XML written to file");

  section("4.1 Simplified Debit Note — SDK Validation");
  const debitResult = runSDKValidation(debitNote.filePath);

  assert(debitResult.xsd, "[XSD] UBL 2.1 schema validation");
  assert(debitResult.en, "[EN] EN16931 business rules");
  assert(debitResult.ksa, "[KSA] ZATCA-specific rules");
  assert(debitResult.qr, "[QR] QR code validation");
  assert(debitResult.signature, "[SIGNATURE] Digital signature");
  assert(debitResult.pih, "[PIH] Previous invoice hash");
  assert(debitResult.passed, "GLOBAL VALIDATION = PASSED");

  if (debitResult.warnings.length > 0) {
    console.log(`    Warnings (${debitResult.warnings.length}):`);
    debitResult.warnings.forEach((w) => console.log(`      - ${w}`));
  }
  if (!debitResult.passed) {
    console.log("\n    --- SDK OUTPUT ---");
    console.log(debitResult.output);
    console.log("    --- END OUTPUT ---\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. STANDARD CREDIT NOTE
  // ═══════════════════════════════════════════════════════════════════════════

  section("5. Standard Credit Note — Generate & Sign");
  const stdCreditNote = await generateSignedInvoice(
    makeCreditNote({ invoiceSubtype: "0100000", buyer: SDK_BUYER }),
    "our_std_credit_note.xml"
  );
  assert(fs.existsSync(stdCreditNote.filePath), "Signed XML written to file");

  section("5.1 Standard Credit Note — SDK Validation");
  const stdCreditResult = runSDKValidation(stdCreditNote.filePath);

  assert(stdCreditResult.xsd, "[XSD] UBL 2.1 schema validation");
  assert(stdCreditResult.en, "[EN] EN16931 business rules");
  assert(stdCreditResult.ksa, "[KSA] ZATCA-specific rules");
  // SDK skips QR and SIGNATURE for Standard (B2B) — validated at clearance time
  assert(stdCreditResult.pih, "[PIH] Previous invoice hash");
  assert(stdCreditResult.passed, "GLOBAL VALIDATION = PASSED");

  if (stdCreditResult.warnings.length > 0) {
    console.log(`    Warnings (${stdCreditResult.warnings.length}):`);
    stdCreditResult.warnings.forEach((w) => console.log(`      - ${w}`));
  }
  if (!stdCreditResult.passed) {
    console.log("\n    --- SDK OUTPUT ---");
    console.log(stdCreditResult.output);
    console.log("    --- END OUTPUT ---\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. STANDARD DEBIT NOTE
  // ═══════════════════════════════════════════════════════════════════════════

  section("6. Standard Debit Note — Generate & Sign");
  const stdDebitNote = await generateSignedInvoice(
    makeDebitNote({ invoiceSubtype: "0100000", buyer: SDK_BUYER }),
    "our_std_debit_note.xml"
  );
  assert(fs.existsSync(stdDebitNote.filePath), "Signed XML written to file");

  section("6.1 Standard Debit Note — SDK Validation");
  const stdDebitResult = runSDKValidation(stdDebitNote.filePath);

  assert(stdDebitResult.xsd, "[XSD] UBL 2.1 schema validation");
  assert(stdDebitResult.en, "[EN] EN16931 business rules");
  assert(stdDebitResult.ksa, "[KSA] ZATCA-specific rules");
  // SDK skips QR and SIGNATURE for Standard (B2B) — validated at clearance time
  assert(stdDebitResult.pih, "[PIH] Previous invoice hash");
  assert(stdDebitResult.passed, "GLOBAL VALIDATION = PASSED");

  if (stdDebitResult.warnings.length > 0) {
    console.log(`    Warnings (${stdDebitResult.warnings.length}):`);
    stdDebitResult.warnings.forEach((w) => console.log(`      - ${w}`));
  }
  if (!stdDebitResult.passed) {
    console.log("\n    --- SDK OUTPUT ---");
    console.log(stdDebitResult.output);
    console.log("    --- END OUTPUT ---\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SDK R4.0.0 (Java 21) — CROSS-VERSION VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  const hasR4 = fs.existsSync(SDK4_JAR) && fs.existsSync(JAVA21);

  if (hasR4) {
    section("7. SDK R4.0.0 — Sanity Check");
    const r4Sample = runSDKValidation(
      path.join(SDK4_DIR, "Data/Samples/Simplified/Invoice/Simplified_Invoice.xml"),
      { jarPath: SDK4_JAR, version: "238-R4.0.0", sdkConfig: SDK4_CONFIG, sdkDir: SDK4_DIR, javaPath: JAVA21 }
    );
    assert(r4Sample.passed, "R4.0.0 validates its own sample");

    // Copy our generated files to R4 input dir and validate
    const r4Opts = { jarPath: SDK4_JAR, version: "238-R4.0.0", sdkConfig: SDK4_CONFIG, sdkDir: SDK4_DIR, javaPath: JAVA21 };

    section("7.1 R4.0.0 — Simplified Invoice");
    const r4Simplified = runSDKValidation(simplified.filePath, r4Opts);
    assert(r4Simplified.xsd, "[XSD] R4.0.0");
    assert(r4Simplified.en, "[EN] R4.0.0");
    assert(r4Simplified.ksa, "[KSA] R4.0.0");
    assert(r4Simplified.qr, "[QR] R4.0.0");
    assert(r4Simplified.signature, "[SIGNATURE] R4.0.0");
    assert(r4Simplified.pih, "[PIH] R4.0.0");
    assert(r4Simplified.passed, "GLOBAL R4.0.0 = PASSED");
    if (!r4Simplified.passed) {
      console.log("\n    --- R4.0.0 OUTPUT ---");
      console.log(r4Simplified.output);
      console.log("    --- END ---\n");
    }

    section("7.2 R4.0.0 — Standard Invoice");
    const r4Standard = runSDKValidation(standard.filePath, r4Opts);
    assert(r4Standard.xsd, "[XSD] R4.0.0");
    assert(r4Standard.en, "[EN] R4.0.0");
    assert(r4Standard.ksa, "[KSA] R4.0.0");
    assert(r4Standard.pih, "[PIH] R4.0.0");
    assert(r4Standard.passed, "GLOBAL R4.0.0 = PASSED");

    section("7.3 R4.0.0 — Simplified Credit Note");
    const r4Credit = runSDKValidation(creditNote.filePath, r4Opts);
    assert(r4Credit.xsd, "[XSD] R4.0.0");
    assert(r4Credit.en, "[EN] R4.0.0");
    assert(r4Credit.ksa, "[KSA] R4.0.0");
    assert(r4Credit.qr, "[QR] R4.0.0");
    assert(r4Credit.signature, "[SIGNATURE] R4.0.0");
    assert(r4Credit.pih, "[PIH] R4.0.0");
    assert(r4Credit.passed, "GLOBAL R4.0.0 = PASSED");
    if (!r4Credit.passed) {
      console.log("\n    --- R4.0.0 OUTPUT ---");
      console.log(r4Credit.output);
      console.log("    --- END ---\n");
    }

    section("7.4 R4.0.0 — Simplified Debit Note");
    const r4Debit = runSDKValidation(debitNote.filePath, r4Opts);
    assert(r4Debit.xsd, "[XSD] R4.0.0");
    assert(r4Debit.en, "[EN] R4.0.0");
    assert(r4Debit.ksa, "[KSA] R4.0.0");
    assert(r4Debit.qr, "[QR] R4.0.0");
    assert(r4Debit.signature, "[SIGNATURE] R4.0.0");
    assert(r4Debit.pih, "[PIH] R4.0.0");
    assert(r4Debit.passed, "GLOBAL R4.0.0 = PASSED");
    if (!r4Debit.passed) {
      console.log("\n    --- R4.0.0 OUTPUT ---");
      console.log(r4Debit.output);
      console.log("    --- END ---\n");
    }

    section("7.5 R4.0.0 — Standard Credit Note");
    const r4StdCredit = runSDKValidation(stdCreditNote.filePath, r4Opts);
    assert(r4StdCredit.xsd, "[XSD] R4.0.0");
    assert(r4StdCredit.en, "[EN] R4.0.0");
    assert(r4StdCredit.ksa, "[KSA] R4.0.0");
    assert(r4StdCredit.pih, "[PIH] R4.0.0");
    assert(r4StdCredit.passed, "GLOBAL R4.0.0 = PASSED");

    section("7.6 R4.0.0 — Standard Debit Note");
    const r4StdDebit = runSDKValidation(stdDebitNote.filePath, r4Opts);
    assert(r4StdDebit.xsd, "[XSD] R4.0.0");
    assert(r4StdDebit.en, "[EN] R4.0.0");
    assert(r4StdDebit.ksa, "[KSA] R4.0.0");
    assert(r4StdDebit.pih, "[PIH] R4.0.0");
    assert(r4StdDebit.passed, "GLOBAL R4.0.0 = PASSED");
  } else {
    section("7. SDK R4.0.0 — SKIPPED");
    console.log(`  SDK R4.0.0 not available (JAR: ${fs.existsSync(SDK4_JAR)}, Java 21: ${fs.existsSync(JAVA21)})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  section("Summary — R3.4.8");
  const allResults = [
    { name: "Simplified Invoice", result: simplifiedResult },
    { name: "Standard Invoice", result: standardResult },
    { name: "Simplified Credit Note", result: creditResult },
    { name: "Simplified Debit Note", result: debitResult },
    { name: "Standard Credit Note", result: stdCreditResult },
    { name: "Standard Debit Note", result: stdDebitResult },
  ];

  console.log("\n  Document Type               XSD  EN   KSA  QR   SIG  PIH  GLOBAL");
  console.log("  " + "─".repeat(70));
  for (const { name, result } of allResults) {
    const cols = [
      result.xsd ? "✓" : "✗",
      result.en ? "✓" : "✗",
      result.ksa ? "✓" : "✗",
      result.qr ? "✓" : "—",
      result.signature ? "✓" : "—",
      result.pih ? "✓" : "✗",
      result.passed ? "✓" : "✗",
    ];
    console.log(`  ${name.padEnd(28)} ${cols.map((c) => c.padEnd(5)).join("")}`);
  }

  // Cleanup generated files
  for (const f of [
    "our_simplified_invoice.xml",
    "our_standard_invoice.xml",
    "our_credit_note.xml",
    "our_debit_note.xml",
    "our_std_credit_note.xml",
    "our_std_debit_note.xml",
  ]) {
    try { fs.unlinkSync(path.join(OUTPUT_DIR, f)); } catch {}
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

runTests()
  .then(() => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`Official ZATCA SDK Validation: ${passed} passed, ${failed} failed (${totalSections} sections)`);
    if (failed > 0) {
      console.error(`\n${failed} test(s) FAILED`);
      process.exit(1);
    } else {
      console.log(`\nAll ${passed} tests passed — our invoices are ZATCA SDK compliant!`);
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("\n\nFATAL ERROR:", err);
    process.exit(2);
  });
