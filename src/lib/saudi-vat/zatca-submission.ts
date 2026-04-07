// ZATCA Phase 2 submission orchestrator
// XML generation → signing → QR → ZATCA API submission → DB storage

import type { PrismaClient, ZatcaDocumentType, ZatcaSubmissionStatus } from "@/generated/prisma/client";
import { generateInvoiceXML, type UBLInvoiceParams, type UBLPartyInfo, type UBLLineItem } from "./ubl-xml";
import { signInvoiceXML, embedQRInXml, extractQRDataFromSignedXml } from "./xml-signing";
import { generateEnhancedTLVQRCode } from "./qr-code";
import { decryptPrivateKey } from "./certificate";
import {
  clearInvoice,
  reportInvoice,
  decodeBST,
  ZatcaClearanceOffError,
  ZatcaRejectionError,
  type InvoiceSubmissionResponse,
} from "./zatca-api";
import {
  ZATCA_DOC_TYPES,
  ZATCA_SUBTYPES,
  ZATCA_PHASE2_INITIAL_PIH,
  type ZatcaEnvironment,
} from "./zatca-config";
import { TAX_EXEMPTION_REASONS } from "./zatca-config";

// ─── Types ────────────────────────────────────────────────────────────────

interface DocumentData {
  id: string;
  documentNumber: string;
  uuid: string;
  issueDate: Date;
  total: number;
  subtotal: number;
  totalVat: number;
  saudiInvoiceType: string; // "STANDARD" or "SIMPLIFIED"
  invoiceCounterValue: number;
  previousInvoiceHash: string;
  billingReferenceNumber?: string; // original invoice number for CN/DN
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    vatRate: number;
    vatCategory: string;
    vatAmount: number;
    lineExtensionAmount: number;
    taxExemptionReasonCode?: string;
  }>;
  buyer?: {
    name: string;
    arabicName?: string;
    vatNumber?: string;
    streetName?: string;
    buildingNumber?: string;
    plotIdentification?: string;
    city?: string;
    postalZone?: string;
    countryCode?: string;
  };
  paymentType: string;
}

interface OrgData {
  name: string;
  arabicName: string;
  vatNumber: string;
  commercialRegNumber: string;
  address: string;
  buildingNumber: string;
  plotIdentification: string;
  city: string;
  zipCode: string;
  zatcaEnvironment: ZatcaEnvironment;
  zatcaClearanceAsync: boolean;
}

interface CertData {
  id: string;
  privateKeyEnc: string;
  privateKeyIv: string;
  privateKeyTag: string;
  productionCsid: string;
  productionSecret: string;
}

export interface SubmissionResult {
  submissionId: string;
  status: ZatcaSubmissionStatus;
  clearedXml?: string;
  warnings?: string[];
  errors?: string[];
}

// ─── Chain Lock ──────────────────────────────────────────────────────────

/**
 * Check if the submission chain is locked due to an ambiguous timeout.
 * When a clearance request times out, we don't know if ZATCA received it,
 * so the PIH chain state is uncertain. No new submissions should be made
 * until the timed-out submission is resolved (retry succeeds or is manually cleared).
 */
export async function isChainLocked(
  prisma: PrismaClient,
  organizationId: string
): Promise<{ locked: boolean; lockedSubmissionId?: string }> {
  const timedOut = await prisma.zatcaSubmission.findFirst({
    where: {
      organizationId,
      status: "FAILED",
      submissionMode: "CLEARANCE",
      zatcaResponse: { contains: '"chainLocked":true' },
    },
    select: { id: true },
  });
  if (timedOut) {
    return { locked: true, lockedSubmissionId: timedOut.id };
  }
  return { locked: false };
}

/**
 * Manually resolve a chain lock (e.g., after confirming with ZATCA that the
 * submission was not received, or after successful retry).
 */
export async function resolveChainLock(
  prisma: PrismaClient,
  submissionId: string
): Promise<void> {
  const sub = await prisma.zatcaSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  });
  // Parse existing response and remove chainLocked flag
  let response: Record<string, unknown> = {};
  try { response = JSON.parse(sub.zatcaResponse || "{}"); } catch {}
  delete response.chainLocked;

  await prisma.zatcaSubmission.update({
    where: { id: submissionId },
    data: {
      status: "REJECTED",
      zatcaResponse: JSON.stringify(response),
    },
  });
}

// ─── Main Processing Functions ────────────────────────────────────────────

export async function processDocumentForZatca(
  prisma: PrismaClient,
  documentId: string,
  documentType: ZatcaDocumentType,
  organizationId: string
): Promise<SubmissionResult> {
  // 0. Check chain lock — block if a previous clearance timed out
  const chainLockStatus = await isChainLocked(prisma, organizationId);
  if (chainLockStatus.locked) {
    throw new Error(
      `Submission chain is locked due to an ambiguous timeout on submission ${chainLockStatus.lockedSubmissionId}. ` +
      `Resolve that submission before posting new invoices.`
    );
  }

  // 1. Fetch org, cert, and document data
  const org = await getOrgData(prisma, organizationId);
  const cert = await getActiveCert(prisma, organizationId);
  const docData = await getDocumentData(prisma, documentId, documentType);

  // 2. Check for duplicate submission
  const existing = await prisma.zatcaSubmission.findFirst({
    where: {
      organizationId,
      ...(documentType === "INVOICE" ? { invoiceId: documentId } : {}),
      ...(documentType === "CREDIT_NOTE" ? { creditNoteId: documentId } : {}),
      ...(documentType === "DEBIT_NOTE" ? { debitNoteId: documentId } : {}),
      status: { in: ["CLEARED", "REPORTED"] },
    },
  });
  if (existing) {
    return {
      submissionId: existing.id,
      status: existing.status as ZatcaSubmissionStatus,
    };
  }

  // 3. Determine document type code and subtype
  const docTypeCode = getDocTypeCode(documentType);
  const isStandard = docData.saudiInvoiceType === "STANDARD";
  const subtype = isStandard ? ZATCA_SUBTYPES.STANDARD : ZATCA_SUBTYPES.SIMPLIFIED;
  const submissionMode = isStandard ? "CLEARANCE" : "REPORTING";

  // 4. Build UBL XML params
  const xmlParams = buildXMLParams(docData, org, docTypeCode, subtype);

  // 5. Generate XML
  const invoiceXml = generateInvoiceXML(xmlParams);

  // 6. Decrypt private key
  const privateKeyPem = decryptPrivateKey({
    encrypted: cert.privateKeyEnc,
    iv: cert.privateKeyIv,
    tag: cert.privateKeyTag,
  });

  // 7. Unified signing pipeline — same XAdES-BES flow for all doc types
  // BST from ZATCA is double-encoded (base64(base64(DER))) — decode for cert operations
  const signingResult = await signInvoiceXML(invoiceXml, privateKeyPem, decodeBST(cert.productionCsid));

  // 8. Extract QR tags 6-7 from the signed XML (per ZATCA spec page 61)
  const qrData = extractQRDataFromSignedXml(signingResult.signedXml);
  const enhancedQr = generateEnhancedTLVQRCode({
    sellerName: org.arabicName || org.name,
    vatNumber: org.vatNumber,
    timestamp: docData.issueDate.toISOString().replace(/\.\d{3}Z$/, ""),
    totalWithVat: docData.total.toFixed(2),
    totalVat: docData.totalVat.toFixed(2),
    invoiceHash: qrData.digestValue,
    ecdsaSignature: qrData.signatureValue,
    publicKey: signingResult.publicKeyDER,
    certificateSignature: signingResult.certSignatureDER,
  });
  const finalXml = embedQRInXml(signingResult.signedXml, enhancedQr);
  const finalXmlBase64 = Buffer.from(finalXml, "utf-8").toString("base64");
  const invoiceHash = signingResult.invoiceHash;
  const enhancedQrData = enhancedQr;

  // 10. Create submission record
  const submission = await prisma.zatcaSubmission.create({
    data: {
      organizationId,
      documentType,
      ...(documentType === "INVOICE" ? { invoiceId: documentId } : {}),
      ...(documentType === "CREDIT_NOTE" ? { creditNoteId: documentId } : {}),
      ...(documentType === "DEBIT_NOTE" ? { debitNoteId: documentId } : {}),
      submissionMode,
      signedXml: finalXml,
      xmlHash: invoiceHash,
      enhancedQrData,
      certificateId: cert.id,
      status: "PENDING",
    },
  });

  // 11. Submit to ZATCA (or queue for async)
  const shouldSubmitNow =
    submissionMode === "REPORTING" || // B2C always queued but we try immediately
    (submissionMode === "CLEARANCE" && !org.zatcaClearanceAsync);

  if (shouldSubmitNow) {
    return await submitToZatca(
      prisma,
      submission.id,
      finalXmlBase64,
      invoiceHash,
      docData.uuid,
      cert,
      org,
      submissionMode
    );
  }

  // Async mode — return PENDING, background job will process
  return {
    submissionId: submission.id,
    status: "PENDING",
  };
}

// ─── ZATCA Submission ─────────────────────────────────────────────────────

async function submitToZatca(
  prisma: PrismaClient,
  submissionId: string,
  xmlBase64: string,
  xmlHash: string,
  uuid: string,
  cert: CertData,
  org: OrgData,
  mode: string
): Promise<SubmissionResult> {
  try {
    let response: InvoiceSubmissionResponse;

    if (mode === "CLEARANCE") {
      try {
        response = await clearInvoice(
          xmlBase64,
          xmlHash,
          uuid,
          cert.productionCsid,
          cert.productionSecret,
          org.zatcaEnvironment
        );
      } catch (e) {
        // 303: Clearance off → fall back to reporting
        if (e instanceof ZatcaClearanceOffError) {
          response = await reportInvoice(
            xmlBase64,
            xmlHash,
            uuid,
            cert.productionCsid,
            cert.productionSecret,
            org.zatcaEnvironment
          );
          mode = "REPORTING"; // Update mode for status tracking
        } else {
          throw e;
        }
      }
    } else {
      response = await reportInvoice(
        xmlBase64,
        xmlHash,
        uuid,
        cert.productionCsid,
        cert.productionSecret,
        org.zatcaEnvironment
      );
    }

    // Determine final status
    const hasErrors = response.validationResults?.errorMessages?.length;
    const hasWarnings = response.validationResults?.warningMessages?.length;
    const status: ZatcaSubmissionStatus = hasErrors
      ? "REJECTED"
      : hasWarnings
        ? "WARNING"
        : mode === "CLEARANCE"
          ? "CLEARED"
          : "REPORTED";

    // For B2B clearance, ZATCA returns the stamped XML with their QR in clearedInvoice.
    // Use that as the authoritative final document instead of our locally signed XML.
    const clearedXmlUtf8 = response.clearedInvoice
      ? Buffer.from(response.clearedInvoice, "base64").toString("utf-8")
      : null;

    // Extract QR from ZATCA's cleared XML if available (replaces locally generated QR)
    let finalQrData: string | undefined;
    if (clearedXmlUtf8) {
      const qrMatch = clearedXmlUtf8.match(
        /<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\/cbc:EmbeddedDocumentBinaryObject>/
      );
      if (qrMatch?.[1]) {
        finalQrData = qrMatch[1];
      }
    }

    await prisma.zatcaSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        submissionMode: mode,
        zatcaResponse: JSON.stringify(response),
        clearedXml: clearedXmlUtf8,
        // For clearance: use ZATCA's stamped XML as the signed doc; for reporting: keep original
        signedXml: clearedXmlUtf8 || undefined,
        // Update QR with ZATCA's stamped QR for B2B clearance
        enhancedQrData: finalQrData || undefined,
        warningMessages: JSON.stringify(response.validationResults?.warningMessages || []),
        errorMessages: JSON.stringify(response.validationResults?.errorMessages || []),
        infoMessages: JSON.stringify(response.validationResults?.infoMessages || []),
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    return {
      submissionId,
      status,
      clearedXml: clearedXmlUtf8 || undefined,
      warnings: response.validationResults?.warningMessages?.map((w) => w.message),
      errors: response.validationResults?.errorMessages?.map((e) => e.message),
    };
  } catch (e) {
    if (e instanceof ZatcaRejectionError) {
      await prisma.zatcaSubmission.update({
        where: { id: submissionId },
        data: {
          status: "REJECTED",
          zatcaResponse: JSON.stringify(e.response),
          errorMessages: JSON.stringify(e.response.validationResults?.errorMessages || []),
          warningMessages: JSON.stringify(e.response.validationResults?.warningMessages || []),
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });
      return {
        submissionId,
        status: "REJECTED",
        errors: e.response.validationResults?.errorMessages?.map((e) => e.message),
      };
    }

    // Network/unexpected error — mark as FAILED
    // For clearance mode: lock the chain (ZATCA may have received it, PIH state uncertain)
    const isClearance = mode === "CLEARANCE";
    const nextRetry = new Date(Date.now() + 60_000); // 1 minute initial retry
    await prisma.zatcaSubmission.update({
      where: { id: submissionId },
      data: {
        status: "FAILED",
        zatcaResponse: JSON.stringify({
          error: (e instanceof Error ? e.message : String(e)),
          ...(isClearance ? { chainLocked: true } : {}),
        }),
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        nextRetryAt: nextRetry,
      },
    });
    return {
      submissionId,
      status: "FAILED",
      errors: [
        (e instanceof Error ? e.message : String(e)),
        ...(isClearance ? ["Chain locked: resolve this submission before posting new invoices."] : []),
      ],
    };
  }
}

// ─── Queue Processing ─────────────────────────────────────────────────────

/**
 * Process pending submissions (called by cron/background job).
 * Handles both B2C reporting and async B2B clearance.
 */
export async function processSubmissionQueue(
  prisma: PrismaClient,
  organizationId: string,
  batchSize: number = 10
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const pendingSubmissions = await prisma.zatcaSubmission.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "FAILED"] },
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextRetryAt: { lte: new Date() } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    include: { certificate: true },
  });

  const org = await getOrgData(prisma, organizationId);
  let succeeded = 0;
  let failed = 0;

  for (const sub of pendingSubmissions) {
    const xmlBase64 = Buffer.from(sub.signedXml, "utf-8").toString("base64");
    const uuid = await getDocumentUuid(prisma, sub);

    const result = await submitToZatca(
      prisma,
      sub.id,
      xmlBase64,
      sub.xmlHash,
      uuid,
      {
        id: sub.certificate.id,
        privateKeyEnc: sub.certificate.privateKeyEnc,
        privateKeyIv: sub.certificate.privateKeyIv,
        privateKeyTag: sub.certificate.privateKeyTag,
        productionCsid: sub.certificate.productionCsid!,
        productionSecret: sub.certificate.productionSecret!,
      },
      org,
      sub.submissionMode
    );

    if (result.status === "CLEARED" || result.status === "REPORTED" || result.status === "WARNING") {
      succeeded++;
    } else {
      failed++;
      // Exponential backoff for retries
      const attempt = (sub.attemptCount || 0) + 1;
      const delayMs = Math.min(60_000 * Math.pow(2, attempt - 1), 4 * 60 * 60 * 1000); // max 4 hours
      await prisma.zatcaSubmission.update({
        where: { id: sub.id },
        data: { nextRetryAt: new Date(Date.now() + delayMs) },
      });
    }
  }

  return { processed: pendingSubmissions.length, succeeded, failed };
}

// ─── Data Fetching Helpers ────────────────────────────────────────────────

async function getOrgData(prisma: PrismaClient, orgId: string): Promise<OrgData> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      arabicName: true,
      vatNumber: true,
      commercialRegNumber: true,
      address: true,
      buildingNumber: true,
      plotIdentification: true,
      city: true,
      zipCode: true,
      zatcaEnvironment: true,
      zatcaClearanceAsync: true,
    },
  });
  return {
    name: org.name,
    arabicName: org.arabicName || org.name,
    vatNumber: org.vatNumber!,
    commercialRegNumber: org.commercialRegNumber!,
    address: org.address || "",
    buildingNumber: org.buildingNumber || "0000",
    plotIdentification: org.plotIdentification || "0000",
    city: org.city || "",
    zipCode: org.zipCode || "00000",
    zatcaEnvironment: org.zatcaEnvironment as ZatcaEnvironment,
    zatcaClearanceAsync: org.zatcaClearanceAsync,
  };
}

async function getActiveCert(prisma: PrismaClient, orgId: string): Promise<CertData> {
  const cert = await prisma.zatcaCertificate.findFirstOrThrow({
    where: {
      organizationId: orgId,
      isActive: true,
      status: "PRODUCTION_CSID_ISSUED",
    },
  });
  if (!cert.productionCsid || !cert.productionSecret) {
    throw new Error("Active certificate missing production CSID/secret");
  }
  return {
    id: cert.id,
    privateKeyEnc: cert.privateKeyEnc,
    privateKeyIv: cert.privateKeyIv,
    privateKeyTag: cert.privateKeyTag,
    productionCsid: cert.productionCsid,
    productionSecret: cert.productionSecret,
  };
}

async function getDocumentData(
  prisma: PrismaClient,
  docId: string,
  docType: ZatcaDocumentType
): Promise<DocumentData> {
  if (docType === "INVOICE") {
    const inv = await prisma.invoice.findUniqueOrThrow({
      where: { id: docId },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });
    return {
      id: inv.id,
      documentNumber: inv.invoiceNumber,
      uuid: inv.invoiceUuid!,
      issueDate: inv.issueDate,
      total: Number(inv.total),
      subtotal: Number(inv.subtotal),
      totalVat: Number(inv.totalVat || 0),
      saudiInvoiceType: inv.saudiInvoiceType || "SIMPLIFIED",
      invoiceCounterValue: inv.invoiceCounterValue!,
      previousInvoiceHash: inv.previousInvoiceHash || ZATCA_PHASE2_INITIAL_PIH,
      items: inv.items.map((item, idx) => ({
        name: item.product?.name || item.description || `Item ${idx + 1}`,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        vatRate: Number(item.vatRate || 0),
        vatCategory: item.vatCategory || "S",
        vatAmount: Number(item.vatAmount || 0),
        lineExtensionAmount: Number(item.total),
      })),
      buyer: inv.customer ? {
        name: inv.customer.name,
        arabicName: inv.customer.arabicName || undefined,
        vatNumber: inv.customer.vatNumber || undefined,
        streetName: inv.customer.address || undefined,
        buildingNumber: inv.customer.buildingNo || undefined,
        plotIdentification: inv.customer.addNo || undefined,
        city: inv.customer.city || undefined,
        postalZone: inv.customer.zipCode || undefined,
        countryCode: inv.customer.country || "SA",
      } : undefined,
      paymentType: inv.paymentType,
    };
  }

  if (docType === "CREDIT_NOTE") {
    const cn = await prisma.creditNote.findUniqueOrThrow({
      where: { id: docId },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: { select: { invoiceNumber: true, saudiInvoiceType: true } },
      },
    });
    return {
      id: cn.id,
      documentNumber: cn.creditNoteNumber,
      uuid: cn.invoiceUuid!,
      issueDate: cn.issueDate,
      total: Number(cn.total),
      subtotal: Number(cn.subtotal),
      totalVat: Number(cn.totalVat || 0),
      saudiInvoiceType: cn.invoice?.saudiInvoiceType || "SIMPLIFIED",
      invoiceCounterValue: cn.invoiceCounterValue!,
      previousInvoiceHash: cn.previousInvoiceHash || ZATCA_PHASE2_INITIAL_PIH,
      billingReferenceNumber: cn.invoice?.invoiceNumber,
      items: cn.items.map((item, idx) => ({
        name: item.product?.name || item.description || `Item ${idx + 1}`,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        vatRate: Number(item.vatRate || 0),
        vatCategory: item.vatCategory || "S",
        vatAmount: Number(item.vatAmount || 0),
        lineExtensionAmount: Number(item.total),
      })),
      buyer: cn.customer ? {
        name: cn.customer.name,
        arabicName: cn.customer.arabicName || undefined,
        vatNumber: cn.customer.vatNumber || undefined,
        streetName: cn.customer.address || undefined,
        buildingNumber: cn.customer.buildingNo || undefined,
        city: cn.customer.city || undefined,
        postalZone: cn.customer.zipCode || undefined,
        countryCode: cn.customer.country || "SA",
      } : undefined,
      paymentType: "CREDIT",
    };
  }

  // DEBIT_NOTE
  const dn = await prisma.debitNote.findUniqueOrThrow({
    where: { id: docId },
    include: {
      items: { include: { product: true } },
      supplier: true,
      purchaseInvoice: { select: { purchaseInvoiceNumber: true } },
    },
  });
  return {
    id: dn.id,
    documentNumber: dn.debitNoteNumber,
    uuid: dn.invoiceUuid!,
    issueDate: dn.issueDate,
    total: Number(dn.total),
    subtotal: Number(dn.subtotal),
    totalVat: Number(dn.totalVat || 0),
    saudiInvoiceType: dn.supplier?.vatNumber ? "STANDARD" : "SIMPLIFIED",
    invoiceCounterValue: dn.invoiceCounterValue!,
    previousInvoiceHash: dn.previousInvoiceHash || ZATCA_PHASE2_INITIAL_PIH,
    billingReferenceNumber: dn.purchaseInvoice?.purchaseInvoiceNumber,
    items: dn.items.map((item, idx) => ({
      name: item.product?.name || `Item ${idx + 1}`,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitCost),
      discount: Number(item.discount || 0),
      vatRate: Number(item.vatRate || 0),
      vatCategory: item.vatCategory || "S",
      vatAmount: Number(item.vatAmount || 0),
      lineExtensionAmount: Number(item.total),
    })),
    buyer: dn.supplier ? {
      name: dn.supplier.name,
      arabicName: dn.supplier.arabicName || undefined,
      vatNumber: dn.supplier.vatNumber || undefined,
      streetName: dn.supplier.address || undefined,
      city: dn.supplier.city || undefined,
      postalZone: dn.supplier.zipCode || undefined,
      countryCode: dn.supplier.country || "SA",
    } : undefined,
    paymentType: "CREDIT",
  };
}

async function getDocumentUuid(
  prisma: PrismaClient,
  sub: { documentType: ZatcaDocumentType; invoiceId: string | null; creditNoteId: string | null; debitNoteId: string | null }
): Promise<string> {
  if (sub.documentType === "INVOICE" && sub.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: sub.invoiceId }, select: { invoiceUuid: true } });
    return inv?.invoiceUuid || "";
  }
  if (sub.documentType === "CREDIT_NOTE" && sub.creditNoteId) {
    const cn = await prisma.creditNote.findUnique({ where: { id: sub.creditNoteId }, select: { invoiceUuid: true } });
    return cn?.invoiceUuid || "";
  }
  if (sub.documentType === "DEBIT_NOTE" && sub.debitNoteId) {
    const dn = await prisma.debitNote.findUnique({ where: { id: sub.debitNoteId }, select: { invoiceUuid: true } });
    return dn?.invoiceUuid || "";
  }
  return "";
}

// ─── XML Param Building ──────────────────────────────────────────────────

function buildXMLParams(
  doc: DocumentData,
  org: OrgData,
  docTypeCode: string,
  subtype: string
): UBLInvoiceParams {
  const seller: UBLPartyInfo = {
    name: org.arabicName || org.name,
    vatNumber: org.vatNumber,
    commercialRegNumber: org.commercialRegNumber,
    streetName: org.address,
    buildingNumber: org.buildingNumber || "0000",
    plotIdentification: org.plotIdentification || "0000",
    city: org.city,
    postalZone: org.zipCode,
    countryCode: "SA",
  };

  const buyer: UBLPartyInfo | undefined = doc.buyer?.vatNumber ? {
    name: doc.buyer.name,
    arabicName: doc.buyer.arabicName,
    vatNumber: doc.buyer.vatNumber,
    streetName: doc.buyer.streetName || "",
    buildingNumber: doc.buyer.buildingNumber || "0000",
    plotIdentification: doc.buyer.plotIdentification,
    city: doc.buyer.city || "",
    postalZone: doc.buyer.postalZone || "00000",
    countryCode: doc.buyer.countryCode || "SA",
  } : undefined;

  // Aggregate tax subtotals by category
  const taxMap = new Map<string, { taxableAmount: number; taxAmount: number; taxPercent: number }>();
  for (const item of doc.items) {
    const key = item.vatCategory;
    const existing = taxMap.get(key) || { taxableAmount: 0, taxAmount: 0, taxPercent: item.vatRate };
    existing.taxableAmount += item.lineExtensionAmount;
    existing.taxAmount += item.vatAmount;
    taxMap.set(key, existing);
  }

  const taxSubtotals = Array.from(taxMap.entries()).map(([cat, data]) => {
    const exemption = cat !== "S"
      ? TAX_EXEMPTION_REASONS[`VATEX-SA-OOS`] // Default, should be overridden by item-level data
      : undefined;
    return {
      taxableAmount: round2(data.taxableAmount),
      taxAmount: round2(data.taxAmount),
      taxCategory: cat,
      taxPercent: data.taxPercent,
      taxExemptionReasonCode: exemption?.code,
      taxExemptionReason: exemption?.reason,
    };
  });

  const paymentMeansCode = doc.paymentType === "CASH" ? "10" : "30";
  const issueDate = doc.issueDate.toISOString().split("T")[0];
  const issueTime = doc.issueDate.toISOString().split("T")[1]?.split(".")[0] || "00:00:00";

  const lineExtensionAmount = round2(doc.items.reduce((s, i) => s + i.lineExtensionAmount, 0));

  return {
    invoiceNumber: doc.documentNumber,
    uuid: doc.uuid,
    issueDate,
    issueTime,
    documentType: docTypeCode as "388" | "381" | "383",
    invoiceSubtype: subtype as "0100000" | "0200000",
    icv: doc.invoiceCounterValue,
    previousInvoiceHash: doc.previousInvoiceHash,
    billingReferenceId: doc.billingReferenceNumber,
    seller,
    buyer,
    deliveryDate: issueDate,
    paymentMeansCode,
    items: doc.items.map((item, idx) => ({
      id: String(idx + 1),
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      vatRate: item.vatRate,
      vatCategory: item.vatCategory,
      vatAmount: item.vatAmount,
      lineExtensionAmount: item.lineExtensionAmount,
      taxExemptionReasonCode: item.taxExemptionReasonCode,
    })),
    lineExtensionAmount,
    taxExclusiveAmount: lineExtensionAmount,
    taxInclusiveAmount: round2(lineExtensionAmount + doc.totalVat),
    payableAmount: round2(doc.total),
    taxSubtotals,
    totalVat: doc.totalVat,
  };
}

function getDocTypeCode(docType: ZatcaDocumentType): string {
  switch (docType) {
    case "INVOICE": return ZATCA_DOC_TYPES.INVOICE;
    case "CREDIT_NOTE": return ZATCA_DOC_TYPES.CREDIT_NOTE;
    case "DEBIT_NOTE": return ZATCA_DOC_TYPES.DEBIT_NOTE;
    default: return ZATCA_DOC_TYPES.INVOICE;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
