import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
      include: { lines: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    if (entry.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft entries can be posted" },
        { status: 400 }
      );
    }

    // Verify balance
    const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      return NextResponse.json(
        { error: "Entry does not balance - debits must equal credits" },
        { status: 400 }
      );
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: { status: "POSTED" },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to post journal entry:", error);
    return NextResponse.json(
      { error: "Failed to post journal entry" },
      { status: 500 }
    );
  }
}
