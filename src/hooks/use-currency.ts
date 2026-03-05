"use client";

import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";

export function useCurrency() {
  const { data: session } = useSession();
  const currency = (session?.user as { currency?: string })?.currency || "INR";
  const symbol = currency === "SAR" ? "SAR " : "₹";

  const fmt = (amount: number) => formatCurrency(amount, currency);

  return { currency, symbol, fmt };
}
