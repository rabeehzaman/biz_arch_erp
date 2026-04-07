// POST /api/zatca/compliance-check — Submit 6 test invoices to ZATCA
// Uses the unified custom XAdES-BES pipeline (no zatca-xml-js dependency)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateInvoiceXML, type UBLInvoiceParams, type UBLPartyInfo } from "@/lib/saudi-vat/ubl-xml";
import { signInvoiceXML, embedQRInXml, extractQRDataFromSignedXml } from "@/lib/saudi-vat/xml-signing";
import { decryptPrivateKey } from "@/lib/saudi-vat/certificate";
import { submitComplianceInvoice, decodeBST } from "@/lib/saudi-vat/zatca-api";
import { generateEnhancedTLVQRCode } from "@/lib/saudi-vat/qr-code";
import { generateInvoiceUUID } from "@/lib/saudi-vat/invoice-hash";
import { ZATCA_DOC_TYPES, ZATCA_SUBTYPES, ZATCA_PHASE2_INITIAL_PIH, type ZatcaEnvironment } from "@/lib/saudi-vat/zatca-config";

// The 6 test invoice combinations required for compliance
const TEST_INVOICES = [
  { docType: ZATCA_DOC_TYPES.INVOICE, subtype: ZATCA_SUBTYPES.STANDARD, label: "Standard Invoice" },
  { docType: ZATCA_DOC_TYPES.CREDIT_NOTE, subtype: ZATCA_SUBTYPES.STANDARD, label: "Standard Credit Note" },
  { docType: ZATCA_DOC_TYPES.DEBIT_NOTE, subtype: ZATCA_SUBTYPES.STANDARD, label: "Standard Debit Note" },
  { docType: ZATCA_DOC_TYPES.INVOICE, subtype: ZATCA_SUBTYPES.SIMPLIFIED, label: "Simplified Invoice" },
  { docType: ZATCA_DOC_TYPES.CREDIT_NOTE, subtype: ZATCA_SUBTYPES.SIMPLIFIED, label: "Simplified Credit Note" },
  { docType: ZATCA_DOC_TYPES.DEBIT_NOTE, subtype: ZATCA_SUBTYPES.SIMPLIFIED, label: "Simplified Debit Note" },
];

const TEST_SELLER: UBLPartyInfo = {
  name: "", // filled from org
  vatNumber: "",
  commercialRegNumber: "",
  streetName: "",
  buildingNumber: "1234",
  plotIdentification: "1234",
  city: "",
  postalZone: "",
  countryCode: "SA",
};

const TEST_BUYER: UBLPartyInfo = {
  name: "Test Buyer",
  vatNumber: "300000000000003",
  commercialRegNumber: "1010010000",
  streetName: "Buyer St",
  buildingNumber: "5678",
  city: "Jeddah",
  postalZone: "23456",
  countryCode: "SA",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);

  const cert = await prisma.zatcaCertificate.findFirst({
    where: { organizationId, isActive: true, status: "COMPLIANCE_CSID_ISSUED" },
  });
  if (!cert || !cert.complianceCsid || !cert.complianceSecret) {
    return NextResponse.json({ error: "No compliance CSID found. Run onboarding first." }, { status: 400 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      name: true,
      arabicName: true,
      vatNumber: true,
      commercialRegNumber: true,
      address: true,
      city: true,
      zipCode: true,
      zatcaEnvironment: true,
    },
  });

  const privateKeyPem = decryptPrivateKey({
    encrypted: cert.privateKeyEnc,
    iv: cert.privateKeyIv,
    tag: cert.privateKeyTag,
  });

  const seller: UBLPartyInfo = {
    ...TEST_SELLER,
    name: org.arabicName || org.name,
    vatNumber: org.vatNumber!,
    commercialRegNumber: org.commercialRegNumber || "1010010000",
    streetName: org.address || "King Fahd Road",
    city: org.city || "Riyadh",
    postalZone: org.zipCode || "12345",
  };

  const results: Array<{ label: string; status: string; errors?: string[] }> = [];
  let allPassed = true;
  let pih = ZATCA_PHASE2_INITIAL_PIH;

  for (let i = 0; i < TEST_INVOICES.length; i++) {
    const test = TEST_INVOICES[i];
    const uuid = generateInvoiceUUID();
    const now = new Date();
    const issueDate = now.toISOString().split("T")[0];
    const issueTime = now.toISOString().split("T")[1]?.split(".")[0] || "00:00:00";
    const isStandard = test.subtype === ZATCA_SUBTYPES.STANDARD;
    const isNote = test.docType !== ZATCA_DOC_TYPES.INVOICE;

    try {
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
        seller,
        buyer: isStandard ? TEST_BUYER : undefined,
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

      // Unified pipeline: XML → sign → extract QR data from signed XML → QR → embed
      const xml = generateInvoiceXML(params);
      const sigResult = await signInvoiceXML(xml, privateKeyPem, decodeBST(cert.complianceCsid));
      const qrData = extractQRDataFromSignedXml(sigResult.signedXml);
      const enhancedQr = generateEnhancedTLVQRCode({
        sellerName: seller.name,
        vatNumber: seller.vatNumber,
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
      const invoiceHash = sigResult.invoiceHash;
      pih = invoiceHash;

      const response = await submitComplianceInvoice(
        xmlBase64,
        invoiceHash,
        uuid,
        cert.complianceCsid,
        cert.complianceSecret,
        org.zatcaEnvironment as ZatcaEnvironment
      );

      const hasErrors = response.validationResults?.errorMessages?.length;

      if (hasErrors) {
        allPassed = false;
        const allMsgs = [
          ...(response.validationResults?.errorMessages?.map((e) => `ERROR ${e.code}: ${e.message}`) || []),
          ...(response.validationResults?.warningMessages?.map((e) => `WARN ${e.code}: ${e.message}`) || []),
        ];
        results.push({ label: test.label, status: "FAILED", errors: allMsgs });
      } else {
        results.push({ label: test.label, status: "PASSED" });
      }
    } catch (err: unknown) {
      allPassed = false;
      results.push({
        label: test.label,
        status: "ERROR",
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  if (allPassed) {
    await prisma.zatcaCertificate.update({
      where: { id: cert.id },
      data: { status: "COMPLIANCE_PASSED" },
    });
  }

  return NextResponse.json({
    success: allPassed,
    message: allPassed
      ? "All 6 compliance test invoices passed. Ready to activate."
      : "Some compliance tests failed. Fix errors and retry.",
    results,
  });
}
