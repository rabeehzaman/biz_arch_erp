import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { generateAutoNumber } from "@/lib/accounting/auto-number";
import { validateJournalBalance, syncCashBankForJournalLines } from "@/lib/accounting/journal";
import { parsePagination, parseAdvancedSearch, paginatedResponse } from "@/lib/pagination";
import { getUserAllowedBranchIds, buildBranchWhereClause } from "@/lib/user-access";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const userId = session.user.id!;
    const role = (session.user as any).role || "user";
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get("sourceType");
    const sourceId = searchParams.get("sourceId");
    const { limit, offset, search } = parsePagination(request);
    const adv = parseAdvancedSearch(request);

    const allowedBranchIds = await getUserAllowedBranchIds(prisma, organizationId, userId, role);
    if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
      return paginatedResponse([], 0, false);
    }
    const branchFilter = buildBranchWhereClause(allowedBranchIds, { includeNullBranch: true });

    const where: Record<string, unknown> = { organizationId, ...branchFilter };
    if (sourceType) where.sourceType = sourceType;
    if (sourceId) where.sourceId = sourceId;

    // Advanced search filters
    if (adv.journalNumber) where.journalNumber = { contains: adv.journalNumber, mode: "insensitive" };
    if (adv.description) where.description = { contains: adv.description, mode: "insensitive" };
    if (adv.sourceType && !sourceType) where.sourceType = adv.sourceType;
    if (adv.branchId) where.branchId = adv.branchId;
    if (adv.dateFrom || adv.dateTo) {
      const date: Record<string, Date> = {};
      if (adv.dateFrom) date.gte = new Date(adv.dateFrom);
      if (adv.dateTo) date.lte = new Date(adv.dateTo + "T23:59:59.999Z");
      where.date = date;
    }

    if (search) {
      (where as any).OR = [
        { journalNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          lines: {
            include: {
              account: { select: { id: true, code: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          branch: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return paginatedResponse(entries, total, offset + entries.length < total);
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

    const entryStatus = status === "POSTED" ? "POSTED" : "DRAFT";
    const entryDate = new Date(date);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data: {
          journalNumber,
          date: entryDate,
          description,
          status: entryStatus,
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

      if (created.status === "POSTED") {
        await syncCashBankForJournalLines(tx, organizationId, created.id, entryDate, description, lines);
      }

      return created;
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
