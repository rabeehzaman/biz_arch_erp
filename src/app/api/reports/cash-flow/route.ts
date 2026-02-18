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
    const fromDate = searchParams.get("fromDate") || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const toDate = searchParams.get("toDate") || new Date().toISOString();

    const transactions = await prisma.cashBankTransaction.findMany({
      where: {
        organizationId,
        transactionDate: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      include: {
        cashBankAccount: { select: { id: true, name: true } },
      },
      orderBy: { transactionDate: "asc" },
    });

    // Aggregate by reference type
    const byType = new Map<string, { inflow: number; outflow: number; count: number }>();

    for (const tx of transactions) {
      const type = tx.referenceType || tx.transactionType;
      const existing = byType.get(type) || { inflow: 0, outflow: 0, count: 0 };
      const amount = Number(tx.amount);
      if (amount >= 0) {
        existing.inflow += amount;
      } else {
        existing.outflow += Math.abs(amount);
      }
      existing.count++;
      byType.set(type, existing);
    }

    const summary = Array.from(byType.entries()).map(([type, data]) => ({
      type,
      ...data,
      net: data.inflow - data.outflow,
    }));

    const totalInflow = summary.reduce((sum, s) => sum + s.inflow, 0);
    const totalOutflow = summary.reduce((sum, s) => sum + s.outflow, 0);

    // Get account balances
    const accounts = await prisma.cashBankAccount.findMany({
      where: { organizationId },
      select: { id: true, name: true, balance: true, accountSubType: true },
    });

    return NextResponse.json({
      fromDate,
      toDate,
      summary,
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      accounts: accounts.map((a) => ({
        ...a,
        balance: Number(a.balance),
      })),
      transactionCount: transactions.length,
    });
  } catch (error) {
    console.error("Failed to generate cash flow:", error);
    return NextResponse.json(
      { error: "Failed to generate cash flow report" },
      { status: 500 }
    );
  }
}
