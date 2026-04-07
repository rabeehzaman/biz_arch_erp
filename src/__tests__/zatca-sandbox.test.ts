/**
 * ZATCA Sandbox Integration Test
 *
 * Tests the full flow against ZATCA's developer sandbox:
 *   1. Generate keypair + CSR (pure JS, no OpenSSL)
 *   2. Request Compliance CSID from ZATCA sandbox
 *   3. Submit 6 compliance test invoices (unified pipeline)
 *   4. Request Production CSID
 *
 * Run: ZATCA_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") npx tsx src/__tests__/zatca-sandbox.test.ts
 */

import crypto from "crypto";

if (!process.env.ZATCA_ENCRYPTION_KEY) {
  process.env.ZATCA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
}

import { generateKeyPair, generateCSR, type CSRParams } from "@/lib/saudi-vat/certificate";
import { requestComplianceCsid, submitComplianceInvoice, requestProductionCsid, decodeBST } from "@/lib/saudi-vat/zatca-api";
import { generateInvoiceXML, type UBLInvoiceParams, type UBLPartyInfo } from "@/lib/saudi-vat/ubl-xml";
import { signInvoiceXML, embedQRInXml, extractQRDataFromSignedXml } from "@/lib/saudi-vat/xml-signing";
import { generateEnhancedTLVQRCode } from "@/lib/saudi-vat/qr-code";
import { generateInvoiceUUID } from "@/lib/saudi-vat/invoice-hash";
import { ZATCA_DOC_TYPES, ZATCA_SUBTYPES, ZATCA_PHASE2_INITIAL_PIH } from "@/lib/saudi-vat/zatca-config";

// ─── Config ──────────────────────────────────────────────────────────────────

const SANDBOX_OTP = "123456"; // ZATCA sandbox accepts any 6-digit OTP
const VAT_NUMBER = "399999999900003"; // ZATCA test VAT number

const SELLER: UBLPartyInfo = {
  name: "شركة اختبار التجارة",
  vatNumber: VAT_NUMBER,
  commercialRegNumber: "1010010000",
  streetName: "شارع الملك فهد",
  buildingNumber: "1234",
  plotIdentification: "5678",
  citySubdivision: "حي العليا",
  city: "الرياض",
  postalZone: "12345",
  countryCode: "SA",
};

const BUYER: UBLPartyInfo = {
  name: "شركة المشتري",
  vatNumber: "300000000000003",
  commercialRegNumber: "1010010000",
  streetName: "شارع الأمير سلطان",
  buildingNumber: "4321",
  city: "جدة",
  postalZone: "54321",
  countryCode: "SA",
};

const TEST_INVOICES = [
  { docType: ZATCA_DOC_TYPES.INVOICE, subtype: ZATCA_SUBTYPES.STANDARD, label: "Standard Invoice" },
  { docType: ZATCA_DOC_TYPES.CREDIT_NOTE, subtype: ZATCA_SUBTYPES.STANDARD, label: "Standard Credit Note" },
  { docType: ZATCA_DOC_TYPES.DEBIT_NOTE, subtype: ZATCA_SUBTYPES.STANDARD, label: "Standard Debit Note" },
  { docType: ZATCA_DOC_TYPES.INVOICE, subtype: ZATCA_SUBTYPES.SIMPLIFIED, label: "Simplified Invoice" },
  { docType: ZATCA_DOC_TYPES.CREDIT_NOTE, subtype: ZATCA_SUBTYPES.SIMPLIFIED, label: "Simplified Credit Note" },
  { docType: ZATCA_DOC_TYPES.DEBIT_NOTE, subtype: ZATCA_SUBTYPES.SIMPLIFIED, label: "Simplified Debit Note" },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ZATCA Sandbox Integration Test — Full Onboarding Flow");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ─── Step 1: Generate keypair + CSR (pure JS) ───────────────────────────
  console.log("Step 1: Generating ECDSA keypair + CSR (pkijs, no OpenSSL)...");
  const keyPair = await generateKeyPair();

  const csrParams: CSRParams = {
    organizationName: "Test Company",
    organizationUnit: "Main Branch",
    commonName: "EGS1-886431145",
    vatNumber: VAT_NUMBER,
    serialNumber: "1-BizArchERP|2-1.0|3-sandbox-test",
    title: "1100",
    registeredAddress: "Riyadh",
    businessCategory: "Technology",
    isProduction: false,
    environment: "SANDBOX",
  };

  const csrBase64 = await generateCSR(csrParams, keyPair.privateKey, keyPair.publicKey);
  console.log(`  ✓ CSR generated (${csrBase64.length} chars, double-base64)\n`);

  // ─── Step 2: Request Compliance CSID ────────────────────────────────────
  console.log("Step 2: Requesting Compliance CSID from ZATCA sandbox...");
  let csidResponse;
  try {
    csidResponse = await requestComplianceCsid(csrBase64, SANDBOX_OTP, "SANDBOX");
    console.log(`  ✓ Compliance CSID obtained`);
    console.log(`    requestID: ${csidResponse.requestID}`);
    console.log(`    token length: ${csidResponse.binarySecurityToken?.length || 0}`);
    console.log(`    disposition: ${csidResponse.dispositionMessage}\n`);
  } catch (err: unknown) {
    console.error("  ✗ FAILED to get Compliance CSID:");
    if (err instanceof Error) {
      console.error(`    ${err.message}`);
      if ("responseBody" in err) console.error(`    Response: ${(err as { responseBody: string }).responseBody}`);
    }
    process.exit(1);
  }

  // Decode BST (base64(base64(DER))) → base64(DER) for use as certificate
  const certBase64 = decodeBST(csidResponse.binarySecurityToken);
  console.log(`  Certificate decoded (${certBase64.length} chars)\n`);

  // Export private key PEM for signing
  const { Crypto } = await import("@peculiar/webcrypto");
  const peculiarCrypto = new Crypto();
  const privKeyDer = await peculiarCrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const privKeyB64 = Buffer.from(privKeyDer).toString("base64");
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privKeyB64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;

  // ─── Step 3: Submit 6 compliance test invoices ──────────────────────────
  console.log("Step 3: Submitting 6 compliance test invoices...");
  let pih = ZATCA_PHASE2_INITIAL_PIH;
  let allPassed = true;

  for (let i = 0; i < TEST_INVOICES.length; i++) {
    const test = TEST_INVOICES[i];
    const uuid = generateInvoiceUUID();
    const now = new Date();
    const issueDate = now.toISOString().split("T")[0];
    const issueTime = now.toISOString().split("T")[1]?.split(".")[0] || "00:00:00";
    const isStandard = test.subtype === ZATCA_SUBTYPES.STANDARD;
    const isNote = test.docType !== ZATCA_DOC_TYPES.INVOICE;

    const params: UBLInvoiceParams = {
      invoiceNumber: `COMP-${i + 1}`,
      uuid,
      issueDate,
      issueTime,
      documentType: test.docType as "388" | "381" | "383",
      invoiceSubtype: test.subtype as "0100000" | "0200000",
      icv: i + 1,
      previousInvoiceHash: pih,
      billingReferenceId: isNote ? "COMP-1" : undefined,
      instructionNote: isNote ? "Return of goods" : undefined,
      seller: SELLER,
      buyer: isStandard ? BUYER : undefined,
      deliveryDate: issueDate,
      paymentMeansCode: "10",
      items: [{
        id: "1",
        name: "Test Product",
        quantity: 1,
        unitPrice: 100,
        vatRate: 15,
        vatCategory: "S",
        vatAmount: 15,
        lineExtensionAmount: 100,
      }],
      lineExtensionAmount: 100,
      taxExclusiveAmount: 100,
      taxInclusiveAmount: 115,
      payableAmount: 115,
      taxSubtotals: [{ taxableAmount: 100, taxAmount: 15, taxCategory: "S", taxPercent: 15 }],
      totalVat: 15,
    };

    try {
      // Unified pipeline: XML → sign → QR → embed
      const xml = generateInvoiceXML(params);
      const sigResult = await signInvoiceXML(xml, privateKeyPem, certBase64);
      // Extract QR tags 6-7 from the signed XML (per ZATCA spec page 61)
      const qrData = extractQRDataFromSignedXml(sigResult.signedXml);
      const enhancedQr = generateEnhancedTLVQRCode({
        sellerName: SELLER.name,
        vatNumber: SELLER.vatNumber,
        timestamp: `${issueDate}T${issueTime}`,
        totalWithVat: "115.00",
        totalVat: "15.00",
        invoiceHash: qrData.digestValue,
        ecdsaSignature: qrData.signatureValue,
        publicKey: sigResult.publicKeyDER,
        certificateSignature: sigResult.certSignatureDER,
      });
      const finalXml = embedQRInXml(sigResult.signedXml, enhancedQr);
      const xmlBase64 = Buffer.from(finalXml, "utf-8").toString("base64");
      pih = sigResult.invoiceHash;

      const response = await submitComplianceInvoice(
        xmlBase64,
        sigResult.invoiceHash,
        uuid,
        csidResponse.binarySecurityToken,
        csidResponse.secret,
        "SANDBOX"
      );

      const errors = response.validationResults?.errorMessages || [];
      const warnings = response.validationResults?.warningMessages || [];

      if (errors.length > 0) {
        allPassed = false;
        console.log(`  ✗ ${test.label}: FAILED`);
        for (const e of errors) console.log(`    ERROR ${e.code}: ${e.message}`);
        for (const w of warnings) console.log(`    WARN  ${w.code}: ${w.message}`);
      } else {
        console.log(`  ✓ ${test.label}: PASSED${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
        for (const w of warnings) console.log(`    WARN  ${w.code}: ${w.message}`);
      }
    } catch (err: unknown) {
      allPassed = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${test.label}: ERROR — ${msg}`);
      if (err instanceof Error && "response" in err) {
        const resp = (err as { response: { validationResults?: { errorMessages?: Array<{ code: string; message: string }> } } }).response;
        for (const e of resp.validationResults?.errorMessages || []) {
          console.log(`    ERROR ${e.code}: ${e.message}`);
        }
      }
    }
  }

  console.log();

  if (!allPassed) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  RESULT: Some compliance tests FAILED");
    console.log("═══════════════════════════════════════════════════════════");
    process.exit(1);
  }

  // ─── Step 4: Request Production CSID ────────────────────────────────────
  console.log("Step 4: Requesting Production CSID from ZATCA sandbox...");
  try {
    const prodResponse = await requestProductionCsid(
      csidResponse.requestID,
      csidResponse.binarySecurityToken,
      csidResponse.secret,
      "SANDBOX"
    );
    console.log(`  ✓ Production CSID obtained`);
    console.log(`    requestID: ${prodResponse.requestID}`);
    console.log(`    token length: ${prodResponse.binarySecurityToken?.length || 0}`);
    console.log(`    disposition: ${prodResponse.dispositionMessage}\n`);
  } catch (err: unknown) {
    console.error("  ✗ FAILED to get Production CSID:");
    if (err instanceof Error) console.error(`    ${err.message}`);
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  RESULT: Full sandbox flow PASSED ✓");
  console.log("  CSR → Compliance CSID → 6 invoices → Production CSID");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(2);
});
