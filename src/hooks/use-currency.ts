"use client";

import { useSession } from "next-auth/react";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";

export function useCurrency() {
  const { data: session } = useSession();
  const currency = (session?.user as { currency?: string })?.currency || "INR";
  const symbol = getCurrencySymbol(currency);

  const fmt = (amount: number) => formatCurrency(amount, currency);

  return { currency, symbol, fmt };
}
