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
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
