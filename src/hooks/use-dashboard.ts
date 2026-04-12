"use client";

import useSWR from "swr";

export interface DashboardStats {
  totalInvoices: number;
  pendingInvoices: number;
  totalCustomers: number;
  totalProducts: number;
  totalRevenue: number;
  totalCollected: number;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    total: number;
    createdAt: string;
  }>;
  timestamp: number;
}

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/api/dashboard",
    {
      refreshInterval: 300000,
      dedupingInterval: 30000,
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      keepPreviousData: true,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
