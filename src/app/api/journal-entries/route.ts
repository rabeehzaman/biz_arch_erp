import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { validateJournalBalance } from "@/lib/accounting/journal";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);

    const entries = await prisma.journalEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to fetch journal entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const body = await request.json();
    const { date, description, lines, status } = body;

    if (!date || !description || !lines || lines.length < 2) {
      return NextResponse.json(
        { error: "Date, description, and at least 2 lines are required" },
        { status: 400 }
      );
    }

    // Validate balance
    if (!validateJournalBalance(lines)) {
      return NextResponse.json(
        { error: "Total debits must equal total credits" },
        { status: 400 }
      );
    }

    const journalNumber = await generateAutoNumber(
      prisma.journalEntry as never,
      "journalNumber",
      "JV",
      organizationId
    );

    const entry = await prisma.journalEntry.create({
      data: {
        journalNumber,
        date: new Date(date),
        description,
        status: status === "POSTED" ? "POSTED" : "DRAFT",
        sourceType: "MANUAL",
        organizationId,
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
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create journal entry:", error);
    return NextResponse.json(
      { error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}
