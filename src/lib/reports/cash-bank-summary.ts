import prisma from "@/lib/prisma";

export interface CashBankSummaryAccount {
  id: string;
  name: string;
  accountSubType: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

export interface CashBankSummaryData {
  fromDate: string;
  toDate: string;
  accounts: CashBankSummaryAccount[];
  totals: {
    openingBalance: number;
    totalIn: number;
    totalOut: number;
    closingBalance: number;
  };
}

export async function getCashBankSummaryData(
  organizationId: string,
  fromDate: string,
  toDate: string,
  branchId?: string
): Promise<CashBankSummaryData> {
  const accounts = await prisma.cashBankAccount.findMany({
    where: { organizationId, isActive: true, ...(branchId ? { branchId } : {}) },
    select: { id: true, name: true, accountSubType: true },
    orderBy: { name: "asc" },
  });

  const accountSummaries = await Promise.all(
    accounts.map(async (account) => {
      const openingTxns = await prisma.cashBankTransaction.findMany({
        where: {
          organizationId,
          cashBankAccountId: account.id,
          transactionDate: { lt: new Date(fromDate) },
        },
        select: { amount: true },
      });
      const openingBalance = openingTxns.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );

      const periodTxns = await prisma.cashBankTransaction.findMany({
        where: {
          organizationId,
          cashBankAccountId: account.id,
          transactionDate: {
            gte: new Date(fromDate),
            lte: new Date(toDate + "T23:59:59.999Z"),
          },
        },
        select: { amount: true },
      });

      let totalIn = 0;
      let totalOut = 0;
      for (const tx of periodTxns) {
        const amount = Number(tx.amount);
        if (amount >= 0) totalIn += amount;
        else totalOut += Math.abs(amount);
      }

      return {
        id: account.id,
        name: account.name,
        accountSubType: account.accountSubType,
        openingBalance,
        totalIn,
        totalOut,
        closingBalance: openingBalance + totalIn - totalOut,
      };
    })
  );

  const totals = accountSummaries.reduce(
    (acc, a) => ({
      openingBalance: acc.openingBalance + a.openingBalance,
      totalIn: acc.totalIn + a.totalIn,
      totalOut: acc.totalOut + a.totalOut,
      closingBalance: acc.closingBalance + a.closingBalance,
    }),
    { openingBalance: 0, totalIn: 0, totalOut: 0, closingBalance: 0 }
  );

  return { fromDate, toDate, accounts: accountSummaries, totals };
}
