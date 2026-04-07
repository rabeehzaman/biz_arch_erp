// POST /api/zatca/renew — Renew expiring Production CSID
// Per ZATCA spec: PATCH /production/csids with old CSR + old PCSID auth
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { parseCertificate, encryptPrivateKey, generateKeyPair, generateCSR } from "@/lib/saudi-vat/certificate";
import { renewProductionCsid, requestComplianceCsid, decodeBST } from "@/lib/saudi-vat/zatca-api";
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
  if (!oldCert || !oldCert.productionCsid || !oldCert.productionSecret || !oldCert.csrPem) {
    return NextResponse.json({ error: "No active production certificate to renew" }, { status: 400 });
  }

  try {
    const env = org.zatcaEnvironment as ZatcaEnvironment;

    // ZATCA spec: PATCH /production/csids with old CSR, authenticated with old PCSID
    const prodResponse = await renewProductionCsid(
      oldCert.csrPem,
      otp,
      oldCert.productionCsid,
      oldCert.productionSecret,
      env
    );

    const newCert = parseCertificate(decodeBST(prodResponse.binarySecurityToken));
    const expiresAt = newCert.notAfter;

    // Deactivate old cert
    await prisma.zatcaCertificate.update({
      where: { id: oldCert.id },
      data: { isActive: false, status: "EXPIRED" },
    });

    // Create new cert record — reuses the same keypair and CSR from the old cert
    await prisma.zatcaCertificate.create({
      data: {
        organizationId,
        csrPem: oldCert.csrPem,
        privateKeyEnc: oldCert.privateKeyEnc,
        privateKeyIv: oldCert.privateKeyIv,
        privateKeyTag: oldCert.privateKeyTag,
        productionCsid: prodResponse.binarySecurityToken,
        productionRequestId: String(prodResponse.requestID),
        productionSecret: prodResponse.secret,
        status: "PRODUCTION_CSID_ISSUED",
        expiresAt,
        renewedFromId: oldCert.id,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Certificate renewed successfully via PATCH.",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error("ZATCA renewal error:", err);
    return NextResponse.json(
      { error: `Renewal failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
