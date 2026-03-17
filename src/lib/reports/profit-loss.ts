import prisma from "@/lib/prisma";

export interface ProfitLossAccountRow {
  account: { id: string; code: string; name: string; accountSubType: string };
  amount: number;
}

export interface ProfitLossData {
  revenue: ProfitLossAccountRow[];
  expenses: ProfitLossAccountRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export async function getProfitLossData(
  organizationId: string,
  fromDate: string,
  toDate: string
): Promise<ProfitLossData> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId,
      journalEntry: {
        status: "POSTED",
        date: {
          gte: new Date(fromDate),
          lte: new Date(toDate + "T23:59:59.999Z"),
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

  const revenue = accounts
    .filter((a) => a.account.accountType === "REVENUE")
    .map((a) => ({ account: a.account, amount: a.credit - a.debit }));

  const expenses = accounts
    .filter((a) => a.account.accountType === "EXPENSE")
    .map((a) => ({ account: a.account, amount: a.debit - a.credit }));

  const totalRevenue = revenue.reduce((sum, a) => sum + a.amount, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + a.amount, 0);

  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}
