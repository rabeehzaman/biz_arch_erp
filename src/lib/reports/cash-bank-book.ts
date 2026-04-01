import prisma from "@/lib/prisma";

export interface CashBankBookTransaction {
  id: string;
  date: string;
  type: string;
  description: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  accountName: string;
  accountId: string;
}

export interface CashBankBookData {
  openingBalance: number;
  closingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  transactions: CashBankBookTransaction[];
  accounts: { id: string; name: string }[];
}

export async function getCashBankBookData(
  organizationId: string,
  accountSubType: "CASH" | "BANK",
  fromDate: string,
  toDate: string,
  accountId?: string,
  branchId?: string
): Promise<CashBankBookData> {
  // Get all matching cash/bank accounts
  const cashBankAccounts = await prisma.cashBankAccount.findMany({
    where: {
      organizationId,
      accountSubType,
      ...(accountId ? { id: accountId } : {}),
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, name: true },
  });

  const accountIds = cashBankAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return {
      openingBalance: 0,
      closingBalance: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      transactions: [],
      accounts: [],
    };
  }

  // Compute opening balance: sum of amounts before fromDate
  const openingTransactions = await prisma.cashBankTransaction.findMany({
    where: {
      organizationId,
      cashBankAccountId: { in: accountIds },
      transactionDate: { lt: new Date(fromDate) },
    },
    select: { amount: true },
  });

  const openingBalance = openingTransactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );

  // Fetch transactions in date range
  const transactions = await prisma.cashBankTransaction.findMany({
    where: {
      organizationId,
      cashBankAccountId: { in: accountIds },
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

  // Map to cashIn/cashOut columns and compute running balance
  let balance = openingBalance;
  let totalCashIn = 0;
  let totalCashOut = 0;

  const mapped: CashBankBookTransaction[] = transactions.map((tx) => {
    const amount = Number(tx.amount);
    const cashIn = amount >= 0 ? amount : 0;
    const cashOut = amount < 0 ? Math.abs(amount) : 0;
    totalCashIn += cashIn;
    totalCashOut += cashOut;
    balance += amount;

    return {
      id: tx.id,
      date: tx.transactionDate.toISOString(),
      type: tx.transactionType,
      description: tx.description || "",
      cashIn,
      cashOut,
      runningBalance: balance,
      accountName: tx.cashBankAccount.name,
      accountId: tx.cashBankAccount.id,
    };
  });

  return {
    openingBalance,
    closingBalance: balance,
    totalCashIn,
    totalCashOut,
    transactions: mapped,
    accounts: cashBankAccounts,
  };
}
