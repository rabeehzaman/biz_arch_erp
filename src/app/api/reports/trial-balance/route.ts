import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrgId(session);
    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get("asOfDate") || new Date().toISOString();

    // Get all posted journal entry lines up to the date
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: "POSTED",
          date: { lte: new Date(asOfDate) },
        },
      },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            accountType: true,
            accountSubType: true,
          },
        },
      },
    });

    // Aggregate by account
    const accountTotals = new Map<
      string,
      {
        account: { id: string; code: string; name: string; accountType: string; accountSubType: string };
        debit: number;
        credit: number;
      }
    >();

    for (const line of lines) {
      const key = line.accountId;
      const existing = accountTotals.get(key);
      if (existing) {
        existing.debit += Number(line.debit);
        existing.credit += Number(line.credit);
      } else {
        accountTotals.set(key, {
          account: line.account,
          debit: Number(line.debit),
          credit: Number(line.credit),
        });
      }
    }

    const result = Array.from(accountTotals.values())
      .sort((a, b) => a.account.code.localeCompare(b.account.code))
      .map((item) => ({
        ...item,
        balance: item.debit - item.credit,
      }));

    const totalDebit = result.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = result.reduce((sum, r) => sum + r.credit, 0);

    return NextResponse.json({
      asOfDate,
      accounts: result,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    });
  } catch (error) {
    console.error("Failed to generate trial balance:", error);
    return NextResponse.json(
      { error: "Failed to generate trial balance" },
      { status: 500 }
    );
  }
}
