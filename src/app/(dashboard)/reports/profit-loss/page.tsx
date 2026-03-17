"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface AccountRow {
  account: { code: string; name: string };
  amount: number;
}

interface ProfitLoss {
  fromDate: string;
  toDate: string;
  revenue: AccountRow[];
  expenses: AccountRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export default function ProfitLossPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      const response = await fetch(`/api/reports/profit-loss?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, t]);

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
      const response = await fetch(`/api/reports/profit-loss/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profit-loss-${fromDate}-to-${toDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
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
        <DateRangePresetSelector
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onGenerate={fetchReport}
          isLoading={isLoading}
        />
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
                      <div key={row.account.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                        <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.amount")}</p>
                          <p className="mt-1 font-mono font-semibold text-green-600">{fmt(row.amount)}</p>
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
                          <TableRow key={row.account.code}>
                            <TableCell>
                              <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                              {row.account.name}
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
                      <div key={row.account.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                        <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.amount")}</p>
                          <p className="mt-1 font-mono font-semibold text-red-600">{fmt(row.amount)}</p>
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
                          <TableRow key={row.account.code}>
                            <TableCell>
                              <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                              {row.account.name}
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
            </div>
          )}
        </>
      )}
    </ReportPageLayout>
  );
}
