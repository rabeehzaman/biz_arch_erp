"use client";

import Link from "next/link";
import { Building2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { BankAccount } from "@/hooks/use-dashboard-charts";

interface BankAccountsListProps {
  data: BankAccount[] | undefined;
  isLoading: boolean;
}

export function BankAccountsList({ data, isLoading }: BankAccountsListProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const accounts = data || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {t("dashboard.bankAndCash")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-slate-500">
            {t("dashboard.noBankAccounts")}
          </div>
        ) : (
          <div className="space-y-1">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href="/accounting/cash-bank"
                className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200">
                    {account.type === "BANK" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {account.name}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    account.balance < 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {fmt(account.balance)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
