// POST /api/zatca/activate — Get Production CSID, enable Phase 2
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { requestProductionCsid, decodeBST } from "@/lib/saudi-vat/zatca-api";
import { parseCertificate, isCertificateExpiring } from "@/lib/saudi-vat/certificate";
import type { ZatcaEnvironment } from "@/lib/saudi-vat/zatca-config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);

  const cert = await prisma.zatcaCertificate.findFirst({
    where: { organizationId, isActive: true, status: "COMPLIANCE_PASSED" },
  });
  if (!cert || !cert.complianceCsid || !cert.complianceSecret || !cert.complianceRequestId) {
    return NextResponse.json({ error: "Compliance check must pass first" }, { status: 400 });
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { zatcaEnvironment: true },
  });

  try {
    const response = await requestProductionCsid(
      cert.complianceRequestId,
      cert.complianceCsid,
      cert.complianceSecret,
      org.zatcaEnvironment as ZatcaEnvironment
    );

    // Parse the production certificate to get expiry (BST is double-encoded)
    const prodCert = parseCertificate(decodeBST(response.binarySecurityToken));
    const expiresAt = prodCert.notAfter;

    // Update certificate with production CSID
    await prisma.zatcaCertificate.update({
      where: { id: cert.id },
      data: {
        productionCsid: response.binarySecurityToken,
        productionRequestId: String(response.requestID),
        productionSecret: response.secret,
        status: "PRODUCTION_CSID_ISSUED",
        expiresAt,
      },
    });

    // Enable Phase 2 on the organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: { zatcaPhase2Active: true },
    });

    return NextResponse.json({
      success: true,
      message: "Production CSID obtained. ZATCA Phase 2 is now active.",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error("ZATCA activation error:", err);
    return NextResponse.json(
      { error: `Activation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
