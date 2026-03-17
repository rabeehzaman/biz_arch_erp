import prisma from "@/lib/prisma";

export interface CashFlowSummaryRow {
  type: string;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

export interface CashFlowAccountBalance {
  name: string;
  balance: number;
  accountSubType: string;
}

export interface CashFlowReconciliation {
  glCashBalance: number;
  subledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

export interface CashFlowData {
  summary: CashFlowSummaryRow[];
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  accounts: CashFlowAccountBalance[];
  transactionCount: number;
  reconciliation: CashFlowReconciliation;
}

export async function getCashFlowData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<CashFlowData> {
  const transactions = await prisma.cashBankTransaction.findMany({
    where: {
      organizationId,
      transactionDate: {
        gte: new Date(fromDate),
        lte: new Date(toDate + "T23:59:59.999Z"),
      },
    },
    include: {
      cashBankAccount: { select: { id: true, name: true } },
    },
    orderBy: { transactionDate: "asc" },
  });

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

  const cashBankAccounts = await prisma.cashBankAccount.findMany({
    where: { organizationId },
    select: { id: true, name: true, balance: true, accountSubType: true },
  });

  const glCashLines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId,
      journalEntry: {
        status: "POSTED",
        date: { lte: new Date(toDate + "T23:59:59.999Z") },
      },
      account: {
        code: { in: ["1100", "1200"] },
      },
    },
    select: { debit: true, credit: true },
  });

  const glCashBalance = glCashLines.reduce(
    (sum, line) => sum + Number(line.debit) - Number(line.credit),
    0
  );
  const subledgerBalance = cashBankAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return {
    summary,
    totalInflow,
    totalOutflow,
    netCashFlow: totalInflow - totalOutflow,
    accounts: cashBankAccounts.map((a) => ({
      name: a.name,
      balance: Number(a.balance),
      accountSubType: a.accountSubType,
    })),
    transactionCount: transactions.length,
    reconciliation: {
      glCashBalance,
      subledgerBalance,
      difference: glCashBalance - subledgerBalance,
      isReconciled: Math.abs(glCashBalance - subledgerBalance) < 0.01,
    },
  };
}
