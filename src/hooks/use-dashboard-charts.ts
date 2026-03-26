"use client";

import useSWR from "swr";

export interface ReceivablesPayables {
  total: number;
  current: number;
  overdue: number;
  overdueCount: number;
}

export interface CashFlowMonth {
  month: string;
  incoming: number;
  outgoing: number;
  net: number;
}

export interface IncomeExpenseMonth {
  month: string;
  income: number;
  expense: number;
}

export interface TopExpense {
  category: string;
  amount: number;
}

export interface BankAccount {
  id: string;
  name: string;
  type: "BANK" | "CASH";
  balance: number;
}

export interface DashboardChartsData {
  receivables: ReceivablesPayables;
  payables: ReceivablesPayables;
  cashFlow: {
    totalIncoming: number;
    totalOutgoing: number;
    monthly: CashFlowMonth[];
  };
  incomeExpense: {
    totalIncome: number;
    totalExpense: number;
    monthly: IncomeExpenseMonth[];
  };
  topExpenses: TopExpense[];
  bankAccounts: BankAccount[];
}

export function useDashboardCharts(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  const query = params.toString();
  const key = `/api/dashboard/charts${query ? `?${query}` : ""}`;

  const { data, error, isLoading } = useSWR<DashboardChartsData>(key, {
    refreshInterval: 120000,
    dedupingInterval: 30000,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    keepPreviousData: true,
  });

  return {
    charts: data,
    isLoading,
    isError: error,
  };
}
