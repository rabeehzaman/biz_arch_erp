"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, FileText, Scale } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { downloadBlob } from "@/lib/download";
import { firstOfYear, lastOfMonth } from "@/lib/date-utils";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

interface AccountRow {
  account: { code: string; name: string };
  amount: number;
  goldAnnotation?: { fineWeightGrams: number; label: string };
}

interface ProfitLoss {
  fromDate: string;
  toDate: string;
  revenue: AccountRow[];
  expenses: AccountRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  goldMovement?: {
    goldSold: number;
    oldGoldReceived: number;
    goldPurchased: number;
    netMovement: number;
  };
}

export default function ProfitLossPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [fromDate, setFromDate] = useState(firstOfYear());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/profit-loss?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, branchParam, t]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [t("common.code"), t("reports.account"), t("reports.type"), t("common.amount")];
    const rows = [
      ...data.revenue.map((r) => [r.account.code, r.account.name, t("reports.totalRevenue"), r.amount.toFixed(2)]),
      ...data.expenses.map((r) => [r.account.code, r.account.name, t("reports.expenses"), r.amount.toFixed(2)]),
    ];
    downloadCsv([header, ...rows], `profit-loss-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/profit-loss/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      await downloadBlob(blob, `profit-loss-${fromDate}-to-${toDate}.pdf`);
    } catch {
      toast.error(t("reports.pdfDownloadError"));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ReportPageLayout
      titleKey="reports.profitLoss"
      descriptionKey="reports.profitLossDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!data || (data.revenue.length === 0 && data.expenses.length === 0)}
        />
      }
      filterBar={
        <>
          <DateRangePresetSelector
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onGenerate={fetchReport}
            isLoading={isLoading}
          />
          <BranchFilterSelect branches={branches} filterBranchId={filterBranchId} onBranchChange={setFilterBranchId} multiBranchEnabled={multiBranchEnabled} />
        </>
      }
    >
      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.totalRevenue")}</p>
                    <p className="text-xl font-bold font-mono text-green-600">{fmt(data.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.totalExpenses")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">{fmt(data.totalExpenses)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${data.netIncome >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                    <DollarSign className={`h-5 w-5 ${data.netIncome >= 0 ? "text-green-600" : "text-red-600"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.netIncome")}</p>
                    <p className={`text-xl font-bold font-mono ${data.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(data.netIncome)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.revenue.length === 0 && data.expenses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("reports.noTransactions")}</h3>
                <p className="text-sm text-slate-500">{t("reports.noTransactionsDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-700">{t("reports.totalRevenue")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:hidden">
                    {data.revenue.map((row) => (
                      <div key={row.account.code} onClick={() => router.push(`/reports/ledger?accountCode=${row.account.code}`)} className="cursor-pointer hover:bg-muted/50 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                        <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.amount")}</p>
                          <p className="mt-1 font-mono font-semibold text-green-600">{fmt(row.amount)}</p>
                          {row.goldAnnotation && (
                            <p className="mt-1 text-xs font-mono text-amber-600">{row.goldAnnotation.label}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                      <p className="font-semibold text-slate-900">{t("reports.totalRevenue2")}</p>
                      <p className="mt-2 font-mono text-lg font-bold text-green-700">{fmt(data.totalRevenue)}</p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("reports.account")}</TableHead>
                          <TableHead className="text-right">{t("common.amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.revenue.map((row) => (
                          <TableRow key={row.account.code} onClick={() => router.push(`/reports/ledger?accountCode=${row.account.code}`)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                              {row.account.name}
                              {row.goldAnnotation && (
                                <span className="ml-2 text-xs font-mono text-amber-600">({row.goldAnnotation.label})</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">{fmt(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell>{t("reports.totalRevenue2")}</TableCell>
                          <TableCell className="text-right font-mono text-green-700">{fmt(data.totalRevenue)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-700">{t("reports.expenses")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:hidden">
                    {data.expenses.map((row) => (
                      <div key={row.account.code} onClick={() => router.push(`/reports/ledger?accountCode=${row.account.code}`)} className="cursor-pointer hover:bg-muted/50 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                        <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.amount")}</p>
                          <p className="mt-1 font-mono font-semibold text-red-600">{fmt(row.amount)}</p>
                          {row.goldAnnotation && (
                            <p className="mt-1 text-xs font-mono text-amber-600">{row.goldAnnotation.label}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="font-semibold text-slate-900">{t("reports.totalExpenses2")}</p>
                      <p className="mt-2 font-mono text-lg font-bold text-red-700">{fmt(data.totalExpenses)}</p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("reports.account")}</TableHead>
                          <TableHead className="text-right">{t("common.amount")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expenses.map((row) => (
                          <TableRow key={row.account.code} onClick={() => router.push(`/reports/ledger?accountCode=${row.account.code}`)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                              {row.account.name}
                              {row.goldAnnotation && (
                                <span className="ml-2 text-xs font-mono text-amber-600">({row.goldAnnotation.label})</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">{fmt(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell>{t("reports.totalExpenses2")}</TableCell>
                          <TableCell className="text-right font-mono text-red-700">{fmt(data.totalExpenses)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold">{t("reports.netIncome")}</span>
                    <span className={`text-2xl font-bold font-mono ${data.netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {data.netIncome >= 0 ? "" : "-"}{fmt(Math.abs(data.netIncome))}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {data.goldMovement && (data.goldMovement.goldSold > 0 || data.goldMovement.goldPurchased > 0 || data.goldMovement.oldGoldReceived > 0) && (
                <Card className="lg:col-span-2 border-amber-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-700">
                      <Scale className="h-5 w-5" />
                      {t("reports.goldMovementSummary")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="rounded-lg bg-red-50 p-3">
                        <p className="text-xs text-slate-500">{t("reports.goldSold")}</p>
                        <p className="mt-1 font-mono font-bold text-red-600">{data.goldMovement.goldSold.toFixed(3)}g</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3">
                        <p className="text-xs text-slate-500">{t("reports.oldGoldReceived")}</p>
                        <p className="mt-1 font-mono font-bold text-green-600">{data.goldMovement.oldGoldReceived.toFixed(3)}g</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3">
                        <p className="text-xs text-slate-500">{t("reports.goldPurchased")}</p>
                        <p className="mt-1 font-mono font-bold text-green-600">{data.goldMovement.goldPurchased.toFixed(3)}g</p>
                      </div>
                      <div className={`rounded-lg p-3 ${data.goldMovement.netMovement >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                        <p className="text-xs text-slate-500">{t("reports.netGoldMovement")}</p>
                        <p className={`mt-1 font-mono font-bold ${data.goldMovement.netMovement >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {data.goldMovement.netMovement >= 0 ? "+" : ""}{data.goldMovement.netMovement.toFixed(3)}g
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </ReportPageLayout>
  );
}
