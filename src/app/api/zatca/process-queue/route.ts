// POST /api/zatca/process-queue — Process pending ZATCA submissions
// Can be called by Vercel Cron or manually by admin
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { processSubmissionQueue } from "@/lib/saudi-vat/zatca-submission";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { zatcaPhase2Active: true },
  });

  if (!org.zatcaPhase2Active) {
    return NextResponse.json({ error: "ZATCA Phase 2 is not active" }, { status: 400 });
  }

  try {
    const result = await processSubmissionQueue(prisma, organizationId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("ZATCA queue processing error:", error);
    return NextResponse.json(
      { error: `Queue processing failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
