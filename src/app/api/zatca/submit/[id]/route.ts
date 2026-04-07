// POST /api/zatca/submit/[id] — Manual submit/retry for a document
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { processDocumentForZatca } from "@/lib/saudi-vat/zatca-submission";
import type { ZatcaDocumentType } from "@/generated/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin" && role !== "superadmin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const organizationId = getOrgId(session);
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "invoice").toUpperCase() as ZatcaDocumentType;

  if (!["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"].includes(type)) {
    return NextResponse.json({ error: "Invalid type. Use: invoice, credit_note, debit_note" }, { status: 400 });
  }

  // Verify org has Phase 2 active
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { zatcaPhase2Active: true },
  });

  if (!org.zatcaPhase2Active) {
    return NextResponse.json({ error: "ZATCA Phase 2 is not active" }, { status: 400 });
  }

  try {
    const result = await processDocumentForZatca(prisma, id, type, organizationId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("ZATCA manual submit error:", err);
    return NextResponse.json(
      { error: `Submission failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
