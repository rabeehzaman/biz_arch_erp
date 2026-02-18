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

    const all = Array.from(accountTotals.values());

    // Assets: debit - credit (natural debit balance)
    const assets = all
      .filter((a) => a.account.accountType === "ASSET")
      .map((a) => ({ ...a, balance: a.debit - a.credit }))
      .sort((a, b) => a.account.code.localeCompare(b.account.code));

    // Liabilities: credit - debit (natural credit balance)
    const liabilities = all
      .filter((a) => a.account.accountType === "LIABILITY")
      .map((a) => ({ ...a, balance: a.credit - a.debit }))
      .sort((a, b) => a.account.code.localeCompare(b.account.code));

    // Equity: credit - debit (natural credit balance)
    const equity = all
      .filter((a) => a.account.accountType === "EQUITY")
      .map((a) => ({ ...a, balance: a.credit - a.debit }))
      .sort((a, b) => a.account.code.localeCompare(b.account.code));

    // Compute retained earnings from revenue - expenses
    const revenue = all
      .filter((a) => a.account.accountType === "REVENUE")
      .reduce((sum, a) => sum + (a.credit - a.debit), 0);
    const expenses = all
      .filter((a) => a.account.accountType === "EXPENSE")
      .reduce((sum, a) => sum + (a.debit - a.credit), 0);
    const retainedEarnings = revenue - expenses;

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity =
      equity.reduce((sum, a) => sum + a.balance, 0) + retainedEarnings;

    return NextResponse.json({
      asOfDate,
      assets,
      liabilities,
      equity,
      retainedEarnings,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    });
  } catch (error) {
    console.error("Failed to generate balance sheet:", error);
    return NextResponse.json(
      { error: "Failed to generate balance sheet" },
      { status: 500 }
    );
  }
}
