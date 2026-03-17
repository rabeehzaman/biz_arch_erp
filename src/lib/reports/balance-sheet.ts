import prisma from "@/lib/prisma";

export interface BalanceSheetAccountRow {
  account: { id: string; code: string; name: string; accountSubType: string };
  balance: number;
}

export interface BalanceSheetData {
  assets: BalanceSheetAccountRow[];
  liabilities: BalanceSheetAccountRow[];
  equity: BalanceSheetAccountRow[];
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export async function getBalanceSheetData(
  organizationId: string,
  asOfDate: string
): Promise<BalanceSheetData> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId,
      journalEntry: {
        status: "POSTED",
        date: { lte: new Date(asOfDate + "T23:59:59.999Z") },
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

  const assets = all
    .filter((a) => a.account.accountType === "ASSET")
    .map((a) => ({ account: a.account, balance: a.debit - a.credit }))
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const liabilities = all
    .filter((a) => a.account.accountType === "LIABILITY")
    .map((a) => ({ account: a.account, balance: a.credit - a.debit }))
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const equity = all
    .filter((a) => a.account.accountType === "EQUITY")
    .map((a) => ({ account: a.account, balance: a.credit - a.debit }))
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  const revenue = all
    .filter((a) => a.account.accountType === "REVENUE")
    .reduce((sum, a) => sum + (a.credit - a.debit), 0);
  const expenseTotal = all
    .filter((a) => a.account.accountType === "EXPENSE")
    .reduce((sum, a) => sum + (a.debit - a.credit), 0);
  const retainedEarnings = revenue - expenseTotal;

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0) + retainedEarnings;

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}
