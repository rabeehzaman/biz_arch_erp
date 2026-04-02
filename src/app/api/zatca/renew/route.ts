// POST /api/zatca/renew — Renew expiring Production CSID
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateKeyPair, generateCSR, encryptPrivateKey, parseCertificate } from "@/lib/saudi-vat/certificate";
import { requestComplianceCsid, requestProductionCsid } from "@/lib/saudi-vat/zatca-api";
import type { ZatcaEnvironment } from "@/lib/saudi-vat/zatca-config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);
  const body = await req.json();
  const { otp } = body;

  if (!otp) {
    return NextResponse.json({ error: "OTP is required for renewal" }, { status: 400 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      name: true,
      vatNumber: true,
      commercialRegNumber: true,
      arabicCity: true,
      arabicAddress: true,
      zatcaEnvironment: true,
    },
  });

  const oldCert = await prisma.zatcaCertificate.findFirst({
    where: { organizationId, isActive: true, status: "PRODUCTION_CSID_ISSUED" },
  });
  if (!oldCert) {
    return NextResponse.json({ error: "No active production certificate to renew" }, { status: 400 });
  }

  try {
    const isProduction = org.zatcaEnvironment === "PRODUCTION";
    const keyPair = await generateKeyPair();
    const csrBase64 = await generateCSR(
      {
        organizationName: org.name,
        organizationUnit: "Main Branch",
        commonName: `EGS1-${org.vatNumber}`,
        vatNumber: org.vatNumber!,
        serialNumber: `1-BizArchERP|2-1.0|3-${organizationId}`,
        title: "1100",
        registeredAddress: org.arabicCity || org.arabicAddress || "Riyadh",
        businessCategory: "Technology",
        isProduction,
      },
      keyPair.privateKey,
      keyPair.publicKey
    );

    const encKey = encryptPrivateKey(keyPair.privateKeyPem);
    const env = org.zatcaEnvironment as ZatcaEnvironment;

    // Get new compliance CSID
    const csidResponse = await requestComplianceCsid(csrBase64, otp, env);

    // Get new production CSID
    const prodResponse = await requestProductionCsid(
      csidResponse.requestID,
      csidResponse.binarySecurityToken,
      csidResponse.secret,
      env
    );

    const newCert = parseCertificate(prodResponse.binarySecurityToken);
    const expiresAt = newCert.notAfter;

    // Deactivate old cert
    await prisma.zatcaCertificate.update({
      where: { id: oldCert.id },
      data: { isActive: false, status: "EXPIRED" },
    });

    // Create new cert
    await prisma.zatcaCertificate.create({
      data: {
        organizationId,
        csrPem: csrBase64,
        privateKeyEnc: encKey.encrypted,
        privateKeyIv: encKey.iv,
        privateKeyTag: encKey.tag,
        complianceCsid: csidResponse.binarySecurityToken,
        complianceRequestId: csidResponse.requestID,
        complianceSecret: csidResponse.secret,
        productionCsid: prodResponse.binarySecurityToken,
        productionRequestId: prodResponse.requestID,
        productionSecret: prodResponse.secret,
        status: "PRODUCTION_CSID_ISSUED",
        expiresAt,
        renewedFromId: oldCert.id,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Certificate renewed successfully.",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("ZATCA renewal error:", error);
    return NextResponse.json(
      { error: `Renewal failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
