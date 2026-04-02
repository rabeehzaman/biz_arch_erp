// POST /api/zatca/onboard — Generate keypair + CSR, request Compliance CSID
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateKeyPair, generateCSR, encryptPrivateKey } from "@/lib/saudi-vat/certificate";
import { requestComplianceCsid } from "@/lib/saudi-vat/zatca-api";
import type { ZatcaEnvironment } from "@/lib/saudi-vat/zatca-config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);

  // Verify org is allowed for Phase 2
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      zatcaPhase2Allowed: true,
      saudiEInvoiceEnabled: true,
      vatNumber: true,
      commercialRegNumber: true,
      name: true,
      arabicName: true,
      arabicAddress: true,
      arabicCity: true,
      zatcaEnvironment: true,
    },
  });

  if (!org.zatcaPhase2Allowed) {
    return NextResponse.json({ error: "ZATCA Phase 2 not enabled for this organization. Contact super admin." }, { status: 403 });
  }
  if (!org.saudiEInvoiceEnabled || !org.vatNumber || !org.commercialRegNumber) {
    return NextResponse.json({ error: "Saudi e-invoicing must be enabled with VAT number and CR number" }, { status: 400 });
  }

  const body = await req.json();
  const { otp, branchName, egsDeviceId } = body;

  if (!otp) {
    return NextResponse.json({ error: "OTP is required" }, { status: 400 });
  }

  try {
    // 1. Generate ECDSA keypair
    const keyPair = await generateKeyPair();

    // 2. Generate CSR
    const isProduction = org.zatcaEnvironment === "PRODUCTION";
    const csrBase64 = await generateCSR(
      {
        organizationName: org.name,
        organizationUnit: branchName || "Main Branch",
        commonName: egsDeviceId || `EGS1-${org.vatNumber}`,
        vatNumber: org.vatNumber,
        serialNumber: `1-BizArchERP|2-1.0|3-${organizationId}`,
        title: "1100", // Both standard + simplified
        registeredAddress: org.arabicCity || org.arabicAddress || "Riyadh",
        businessCategory: "Technology",
        isProduction,
      },
      keyPair.privateKey,
      keyPair.publicKey
    );

    // 3. Encrypt private key
    const encKey = encryptPrivateKey(keyPair.privateKeyPem);

    // 4. Deactivate any existing active certificates
    await prisma.zatcaCertificate.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false },
    });

    // 5. Request Compliance CSID from ZATCA
    const csidResponse = await requestComplianceCsid(
      csrBase64,
      otp,
      org.zatcaEnvironment as ZatcaEnvironment
    );

    // 6. Store certificate record
    const certificate = await prisma.zatcaCertificate.create({
      data: {
        organizationId,
        csrPem: csrBase64,
        privateKeyEnc: encKey.encrypted,
        privateKeyIv: encKey.iv,
        privateKeyTag: encKey.tag,
        complianceCsid: csidResponse.binarySecurityToken,
        complianceRequestId: csidResponse.requestID,
        complianceSecret: csidResponse.secret,
        status: "COMPLIANCE_CSID_ISSUED",
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      certificateId: certificate.id,
      status: certificate.status,
      message: "Compliance CSID obtained. Run compliance check next.",
    });
  } catch (error) {
    console.error("ZATCA onboarding error:", error);
    return NextResponse.json(
      { error: `Onboarding failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
