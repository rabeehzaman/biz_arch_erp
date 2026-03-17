"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

interface CashFlowSummary {
  type: string;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

interface AccountBalance {
  name: string;
  balance: number;
  accountSubType: string;
}

interface Reconciliation {
  glCashBalance: number;
  subledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

interface CashFlow {
  fromDate: string;
  toDate: string;
  summary: CashFlowSummary[];
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  accounts: AccountBalance[];
  transactionCount: number;
  reconciliation: Reconciliation;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

const typeLabelKeys: Record<string, string> = {
  PAYMENT: "reports.cashFlowCustomerPayments",
  SUPPLIER_PAYMENT: "reports.cashFlowSupplierPayments",
  EXPENSE: "reports.cashFlowExpenses",
  TRANSFER: "reports.cashFlowTransfers",
  DEPOSIT: "reports.cashFlowDeposits",
  WITHDRAWAL: "reports.cashFlowWithdrawals",
  OPENING_BALANCE: "reports.cashFlowOpeningBalances",
  TRANSFER_IN: "reports.cashFlowTransfersIn",
  TRANSFER_OUT: "reports.cashFlowTransfersOut",
};

export default function CashFlowPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<CashFlow | null>(null);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/cash-flow?fromDate=${fromDate}&toDate=${toDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // Initial report load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("reports.cashFlow")}</h2>
            <p className="text-slate-500">{t("reports.cashFlowDesc")}</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="grid gap-2">
                  <Label>{t("common.from")}</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>{t("common.to")}</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                <Button onClick={fetchReport} className="mt-6">{t("reports.generate")}</Button>
              </div>
            </CardHeader>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-6">
                    <span className="text-sm text-slate-500">{t("reports.totalInflow")}</span>
                    <p className="text-2xl font-bold text-green-600 font-mono">{fmt(data.totalInflow)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <span className="text-sm text-slate-500">{t("reports.totalOutflow")}</span>
                    <p className="text-2xl font-bold text-red-600 font-mono">{fmt(data.totalOutflow)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <span className="text-sm text-slate-500">{t("reports.netCashFlow")}</span>
                    <p className={`text-2xl font-bold font-mono ${data.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(data.netCashFlow)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t("reports.byCategory")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:hidden">
                    {data.summary.map((row) => (
                      <div key={row.type} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-semibold text-slate-900">{typeLabelKeys[row.type] ? t(typeLabelKeys[row.type]) : row.type}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.inflow")}</p>
                            <p className="mt-1 font-mono font-medium text-green-600">
                              {row.inflow > 0 ? fmt(row.inflow) : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.outflow")}</p>
                            <p className="mt-1 font-mono font-medium text-red-600">
                              {row.outflow > 0 ? fmt(row.outflow) : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.net")}</p>
                            <p className={`mt-1 font-mono font-semibold ${row.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {fmt(row.net)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.count")}</p>
                            <p className="mt-1 font-medium text-slate-900">{row.count}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("reports.category")}</TableHead>
                          <TableHead className="text-right">{t("reports.inflow")}</TableHead>
                          <TableHead className="text-right">{t("reports.outflow")}</TableHead>
                          <TableHead className="text-right">{t("reports.net")}</TableHead>
                          <TableHead className="text-right">{t("reports.count")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.summary.map((row) => (
                          <TableRow key={row.type}>
                            <TableCell>{typeLabelKeys[row.type] ? t(typeLabelKeys[row.type]) : row.type}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {row.inflow > 0 ? fmt(row.inflow) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {row.outflow > 0 ? fmt(row.outflow) : "-"}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${row.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {fmt(row.net)}
                            </TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("reports.accountBalances")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:hidden">
                    {data.accounts.map((a) => (
                      <div key={a.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-semibold text-slate-900">{a.name}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.type")}</p>
                            <p className="mt-1 text-slate-900">{a.accountSubType === "BANK" ? t("reports.bank") : t("reports.cash")}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.balance")}</p>
                            <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(a.balance)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("reports.account")}</TableHead>
                          <TableHead>{t("reports.type")}</TableHead>
                          <TableHead className="text-right">{t("reports.balance")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.accounts.map((a) => (
                          <TableRow key={a.name}>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{a.accountSubType === "BANK" ? t("reports.bank") : t("reports.cash")}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{fmt(a.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {data.reconciliation && (
                <Card className={data.reconciliation.isReconciled ? "border-green-200" : "border-orange-300"}>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("reports.glReconciliation")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:hidden">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.glBalance")}</p>
                        <p className="mt-2 font-mono font-semibold text-slate-900">{fmt(data.reconciliation.glCashBalance)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.subledgerBalance")}</p>
                        <p className="mt-2 font-mono font-semibold text-slate-900">{fmt(data.reconciliation.subledgerBalance)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className={`text-xs uppercase tracking-[0.16em] ${data.reconciliation.isReconciled ? "text-green-600" : "text-orange-600"}`}>
                          {data.reconciliation.isReconciled ? t("common.status") : t("reports.balance")}
                        </p>
                        <p className={`mt-2 font-mono text-lg font-bold ${data.reconciliation.isReconciled ? "text-green-600" : "text-orange-600"}`}>
                          {data.reconciliation.isReconciled ? t("reports.reconciled") : fmt(data.reconciliation.difference)}
                        </p>
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-slate-500">{t("reports.glBalance")}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(data.reconciliation.glCashBalance)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-slate-500">{t("reports.subledgerBalance")}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(data.reconciliation.subledgerBalance)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className={`font-medium ${data.reconciliation.isReconciled ? "text-green-600" : "text-orange-600"}`}>
                              {data.reconciliation.isReconciled ? t("reports.reconciled") : t("reports.balance")}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${data.reconciliation.isReconciled ? "text-green-600" : "text-orange-600"}`}>
                              {fmt(data.reconciliation.difference)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    {!data.reconciliation.isReconciled && (
                      <p className="text-xs text-orange-600 mt-2">
                        {t("reports.discrepancyWarning")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <p className="text-center py-8 text-slate-500">{t("reports.noDataAvailable")}</p>
          )}
        </div>
        </PageAnimation>
      );
}
