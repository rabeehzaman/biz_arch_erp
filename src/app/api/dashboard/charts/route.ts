import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrgId(session);

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1);
    const fiscalYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const fromDate = searchParams.get("fromDate")
      ? new Date(searchParams.get("fromDate")!)
      : fiscalYearStart;
    const toDate = searchParams.get("toDate")
      ? new Date(searchParams.get("toDate") + "T23:59:59.999Z")
      : fiscalYearEnd;

    const [
      currentReceivables,
      overdueReceivables,
      currentPayables,
      overduePayables,
      invoicesByMonth,
      expensesByMonth,
      topExpenseItems,
      cashBankAccounts,
      cashFlowTransactions,
    ] = await Promise.all([
      // Current receivables (not yet due)
      prisma.invoice.aggregate({
        where: {
          organizationId,
          balanceDue: { gt: 0 },
          dueDate: { gte: now },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Overdue receivables
      prisma.invoice.aggregate({
        where: {
          organizationId,
          balanceDue: { gt: 0 },
          dueDate: { lt: now },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Current payables (not yet due)
      prisma.purchaseInvoice.aggregate({
        where: {
          organizationId,
          balanceDue: { gt: 0 },
          dueDate: { gte: now },
          status: { not: "CANCELLED" },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Overdue payables
      prisma.purchaseInvoice.aggregate({
        where: {
          organizationId,
          balanceDue: { gt: 0 },
          dueDate: { lt: now },
          status: { not: "CANCELLED" },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Monthly invoices (income) in date range
      prisma.invoice.findMany({
        where: {
          organizationId,
          issueDate: { gte: fromDate, lte: toDate },
        },
        select: {
          issueDate: true,
          total: true,
        },
      }),
      // Monthly expenses in date range
      prisma.expense.findMany({
        where: {
          organizationId,
          expenseDate: { gte: fromDate, lte: toDate },
          status: { in: ["APPROVED", "PAID"] },
        },
        select: {
          expenseDate: true,
          total: true,
        },
      }),
      // Top expenses by account
      prisma.expenseItem.groupBy({
        by: ["accountId"],
        where: {
          organizationId,
          expense: {
            expenseDate: { gte: fromDate, lte: toDate },
            status: { in: ["APPROVED", "PAID"] },
          },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
      // Cash & bank accounts with balances
      prisma.cashBankAccount.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          accountSubType: true,
          balance: true,
        },
        orderBy: { name: "asc" },
      }),
      // Cash flow transactions in date range
      prisma.cashBankTransaction.findMany({
        where: {
          organizationId,
          transactionDate: { gte: fromDate, lte: toDate },
        },
        select: {
          transactionDate: true,
          transactionType: true,
          amount: true,
        },
        orderBy: { transactionDate: "asc" },
      }),
    ]);

    // Aggregate invoices by month
    const incomeByMonth = new Map<string, number>();
    for (const inv of invoicesByMonth) {
      const key = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, "0")}`;
      incomeByMonth.set(key, (incomeByMonth.get(key) || 0) + Number(inv.total));
    }

    // Aggregate expenses by month
    const expenseByMonth = new Map<string, number>();
    for (const exp of expensesByMonth) {
      const key = `${exp.expenseDate.getFullYear()}-${String(exp.expenseDate.getMonth() + 1).padStart(2, "0")}`;
      expenseByMonth.set(key, (expenseByMonth.get(key) || 0) + Number(exp.total));
    }

    // Build monthly data array
    const months: string[] = [];
    const d = new Date(fromDate);
    while (d <= toDate) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() + 1);
    }

    const incomeExpenseMonthly = months.map((month) => ({
      month,
      income: Math.round((incomeByMonth.get(month) || 0) * 100) / 100,
      expense: Math.round((expenseByMonth.get(month) || 0) * 100) / 100,
    }));

    // Aggregate cash flow by month
    const cashFlowByMonth = new Map<string, { incoming: number; outgoing: number }>();
    for (const tx of cashFlowTransactions) {
      const key = `${tx.transactionDate.getFullYear()}-${String(tx.transactionDate.getMonth() + 1).padStart(2, "0")}`;
      const entry = cashFlowByMonth.get(key) || { incoming: 0, outgoing: 0 };
      const amount = Number(tx.amount);
      if (tx.transactionType === "DEPOSIT" || tx.transactionType === "TRANSFER_IN") {
        entry.incoming += amount;
      } else if (tx.transactionType === "WITHDRAWAL" || tx.transactionType === "TRANSFER_OUT") {
        entry.outgoing += amount;
      }
      cashFlowByMonth.set(key, entry);
    }

    const totalIncoming = Array.from(cashFlowByMonth.values()).reduce((s, e) => s + e.incoming, 0);
    const totalOutgoing = Array.from(cashFlowByMonth.values()).reduce((s, e) => s + e.outgoing, 0);

    const cashFlowMonthly = months.map((month) => {
      const entry = cashFlowByMonth.get(month) || { incoming: 0, outgoing: 0 };
      return {
        month,
        incoming: Math.round(entry.incoming * 100) / 100,
        outgoing: Math.round(entry.outgoing * 100) / 100,
        net: Math.round((entry.incoming - entry.outgoing) * 100) / 100,
      };
    });

    // Resolve top expense account names
    const accountIds = topExpenseItems.map((item) => item.accountId);
    const accounts = accountIds.length
      ? await prisma.account.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, name: true },
        })
      : [];
    const accountNameMap = new Map(accounts.map((a) => [a.id, a.name]));

    const topExpenses = topExpenseItems.map((item) => ({
      category: accountNameMap.get(item.accountId) || "Unknown",
      amount: Math.round(Number(item._sum.amount || 0) * 100) / 100,
    }));

    const currentReceivableAmount = Number(currentReceivables._sum.balanceDue || 0);
    const overdueReceivableAmount = Number(overdueReceivables._sum.balanceDue || 0);
    const currentPayableAmount = Number(currentPayables._sum.balanceDue || 0);
    const overduePayableAmount = Number(overduePayables._sum.balanceDue || 0);

    return NextResponse.json({
      receivables: {
        total: Math.round((currentReceivableAmount + overdueReceivableAmount) * 100) / 100,
        current: Math.round(currentReceivableAmount * 100) / 100,
        overdue: Math.round(overdueReceivableAmount * 100) / 100,
        overdueCount: overdueReceivables._count,
      },
      payables: {
        total: Math.round((currentPayableAmount + overduePayableAmount) * 100) / 100,
        current: Math.round(currentPayableAmount * 100) / 100,
        overdue: Math.round(overduePayableAmount * 100) / 100,
        overdueCount: overduePayables._count,
      },
      cashFlow: {
        totalIncoming: Math.round(totalIncoming * 100) / 100,
        totalOutgoing: Math.round(totalOutgoing * 100) / 100,
        monthly: cashFlowMonthly,
      },
      incomeExpense: {
        totalIncome: Math.round(incomeByMonth.size ? Array.from(incomeByMonth.values()).reduce((s, v) => s + v, 0) : 0),
        totalExpense: Math.round(expenseByMonth.size ? Array.from(expenseByMonth.values()).reduce((s, v) => s + v, 0) : 0),
        monthly: incomeExpenseMonthly,
      },
      topExpenses,
      bankAccounts: cashBankAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.accountSubType,
        balance: Math.round(Number(a.balance) * 100) / 100,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch dashboard charts:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard charts" },
      { status: 500 }
    );
  }
}
