import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { validateJournalBalance } from "@/lib/accounting/journal";

export async function GET(
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
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to fetch journal entry:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entry" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { id } = await params;
    const body = await request.json();
    const { date, description, lines } = body;

    const existing = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    // Removed draft restriction to allow editing posted entries

    if (lines && !validateJournalBalance(lines)) {
      return NextResponse.json(
        { error: "Total debits must equal total credits" },
        { status: 400 }
      );
    }

    const entry = await prisma.$transaction(async (tx) => {
      // Delete existing lines
      if (lines) {
        await tx.journalEntryLine.deleteMany({
          where: { journalEntryId: id },
        });
      }

      return tx.journalEntry.update({
        where: { id, organizationId },
        data: {
          ...(date && { date: new Date(date) }),
          ...(description && { description }),
          ...(lines && {
            lines: {
              create: lines.map(
                (line: {
                  accountId: string;
                  description?: string;
                  debit: number;
                  credit: number;
                }) => ({
                  accountId: line.accountId,
                  description: line.description || null,
                  debit: line.debit || 0,
                  credit: line.credit || 0,
                  organizationId,
                })
              ),
            },
          }),
        },
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("Failed to update journal entry:", error);
    return NextResponse.json(
      { error: "Failed to update journal entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existing = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    // Removed draft restriction to allow deleting posted entries

    await prisma.journalEntry.delete({ where: { id, organizationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete journal entry:", error);
    return NextResponse.json(
      { error: "Failed to delete journal entry" },
      { status: 500 }
    );
  }
}
