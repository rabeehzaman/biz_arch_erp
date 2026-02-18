import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateAutoNumber } from "@/lib/accounting/auto-number";

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

    if (entry.status !== "POSTED") {
      return NextResponse.json(
        { error: "Only posted entries can be voided" },
        { status: 400 }
      );
    }

    // Create reversal entry and void original in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Void original
      await tx.journalEntry.update({
        where: { id },
        data: { status: "VOID" },
      });

      // Create reversal entry (swap debits and credits)
      const reversalNumber = await generateAutoNumber(
        tx.journalEntry,
        "journalNumber",
        "JV",
        organizationId
      );

      const reversal = await tx.journalEntry.create({
        data: {
          journalNumber: reversalNumber,
          date: new Date(),
          description: `Reversal of ${entry.journalNumber}: ${entry.description}`,
          status: "POSTED",
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          organizationId,
          lines: {
            create: entry.lines.map((line) => ({
              accountId: line.accountId,
              description: `Reversal: ${line.description || ""}`,
              debit: Number(line.credit),
              credit: Number(line.debit),
              organizationId,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      return reversal;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to void journal entry:", error);
    return NextResponse.json(
      { error: "Failed to void journal entry" },
      { status: 500 }
    );
  }
}
