// GET /api/zatca/status — Certificate status, submission counts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let organizationId: string;
  try {
    organizationId = getOrgId(session);
  } catch {
    return NextResponse.json({ error: "No organization context" }, { status: 400 });
  }

  const [org, activeCert, submissionCounts] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        zatcaPhase2Allowed: true,
        zatcaPhase2Active: true,
        zatcaEnvironment: true,
        zatcaClearanceAsync: true,
        saudiEInvoiceEnabled: true,
        vatNumber: true,
      },
    }),
    prisma.zatcaCertificate.findFirst({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.zatcaSubmission.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: true,
    }),
  ]);

  const counts = Object.fromEntries(
    submissionCounts.map((c: { status: string; _count: number }) => [c.status, c._count])
  );

  return NextResponse.json({
    phase2Allowed: org.zatcaPhase2Allowed,
    phase2Active: org.zatcaPhase2Active,
    environment: org.zatcaEnvironment,
    clearanceAsync: org.zatcaClearanceAsync,
    saudiEInvoiceEnabled: org.saudiEInvoiceEnabled,
    vatNumber: org.vatNumber,
    certificate: activeCert ? {
      id: activeCert.id,
      status: activeCert.status,
      expiresAt: activeCert.expiresAt?.toISOString(),
      createdAt: activeCert.createdAt.toISOString(),
    } : null,
    submissions: {
      pending: counts.PENDING || 0,
      cleared: counts.CLEARED || 0,
      reported: counts.REPORTED || 0,
      rejected: counts.REJECTED || 0,
      warning: counts.WARNING || 0,
      failed: counts.FAILED || 0,
    },
  });
}
