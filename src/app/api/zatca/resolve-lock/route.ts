// POST /api/zatca/resolve-lock — Manually resolve a chain lock
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { resolveChainLock, isChainLocked } from "@/lib/saudi-vat/zatca-submission";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);

  const lockStatus = await isChainLocked(prisma, organizationId);
  if (!lockStatus.locked || !lockStatus.lockedSubmissionId) {
    return NextResponse.json({ success: true, message: "No chain lock to resolve" });
  }

  try {
    await resolveChainLock(prisma, lockStatus.lockedSubmissionId);
    return NextResponse.json({
      success: true,
      message: "Chain lock resolved. Submissions can proceed.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Failed to resolve lock: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
