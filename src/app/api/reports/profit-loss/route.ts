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
    const fromDateParam = searchParams.get("fromDate") || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDateParam = searchParams.get("toDate") || new Date().toISOString();

    const fromDate = new Date(fromDateParam);
    const toDate = new Date(toDateParam);
    toDate.setHours(23, 59, 59, 999);

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          status: "POSTED",
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        account: {
          accountType: { in: ["REVENUE", "EXPENSE"] },
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

    const accounts = Array.from(accountTotals.values()).sort((a, b) =>
      a.account.code.localeCompare(b.account.code)
    );

    // Revenue: credit - debit (revenue is naturally credit)
    const revenueAccounts = accounts
      .filter((a) => a.account.accountType === "REVENUE")
      .map((a) => ({ ...a, amount: a.credit - a.debit }));

    // Expense: debit - credit (expense is naturally debit)
    const expenseAccounts = accounts
      .filter((a) => a.account.accountType === "EXPENSE")
      .map((a) => ({ ...a, amount: a.debit - a.credit }));

    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.amount, 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + a.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    return NextResponse.json({
      fromDate,
      toDate,
      revenue: revenueAccounts,
      expenses: expenseAccounts,
      totalRevenue,
      totalExpenses,
      netIncome,
    });
  } catch (error) {
    console.error("Failed to generate P&L:", error);
    return NextResponse.json(
      { error: "Failed to generate profit & loss" },
      { status: 500 }
    );
  }
}
