import prisma from "@/lib/prisma";

export interface TrialBalanceAccountRow {
  account: { id: string; code: string; name: string; accountType: string };
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceData {
  accounts: TrialBalanceAccountRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export async function getTrialBalanceData(
  organizationId: string,
  asOfDate: string,
  branchId?: string
): Promise<TrialBalanceData> {
  const lines = await prisma.journalEntryLine.findMany({
    where: {
      organizationId,
      journalEntry: {
        status: "POSTED",
        date: { lte: new Date(asOfDate + "T23:59:59.999Z") },
        ...(branchId ? { branchId } : {}),
      },
    },
    include: {
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          accountType: true,
        },
      },
    },
  });

  const accountTotals = new Map<
    string,
    {
      account: { id: string; code: string; name: string; accountType: string };
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

  const accounts = Array.from(accountTotals.values())
    .sort((a, b) => a.account.code.localeCompare(b.account.code))
    .map((item) => ({
      ...item,
      balance: item.debit - item.credit,
    }));

  const totalDebit = accounts.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = accounts.reduce((sum, r) => sum + r.credit, 0);

  return {
    accounts,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}
