"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Wallet, ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { firstOfMonth, lastOfMonth } from "@/lib/date-utils";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

interface AccountSummary {
  id: string;
  name: string;
  accountSubType: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

interface SummaryData {
  fromDate: string;
  toDate: string;
  accounts: AccountSummary[];
  totals: {
    openingBalance: number;
    totalIn: number;
    totalOut: number;
    closingBalance: number;
  };
}

export default function CashBankSummaryPage() {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/cash-bank-summary?${params}`);
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
    const header = [
      t("reports.accountName"),
      t("reports.type"),
      t("reports.openingBalance"),
      t("reports.totalIn"),
      t("reports.totalOut"),
      t("reports.closingBalance"),
    ];
    const rows = data.accounts.map((a) => [
      a.name,
      a.accountSubType === "CASH" ? t("reports.cash") : t("reports.bank"),
      a.openingBalance.toFixed(2),
      a.totalIn.toFixed(2),
      a.totalOut.toFixed(2),
      a.closingBalance.toFixed(2),
    ]);
    rows.push([
      t("reports.totals"),
      "",
      data.totals.openingBalance.toFixed(2),
      data.totals.totalIn.toFixed(2),
      data.totals.totalOut.toFixed(2),
      data.totals.closingBalance.toFixed(2),
    ]);
    downloadCsv([header, ...rows], `cash-bank-summary-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const [isDownloading, setIsDownloading] = useState(false);
  const { lang } = useLanguage();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const response = await fetch(`/api/reports/cash-bank-summary/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cash-bank-summary-${fromDate}-to-${toDate}.pdf`;
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

  const getReportLink = (account: AccountSummary) => {
    const path =
      account.accountSubType === "CASH"
        ? "/reports/cash-book"
        : "/reports/bank-book";
    return `${path}?accountId=${account.id}`;
  };

  return (
    <ReportPageLayout
      titleKey="reports.cashBankSummary"
      descriptionKey="reports.cashBankSummaryDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!data || data.accounts.length === 0}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <Wallet className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.openingBalance")}</p>
                    <p className="text-xl font-bold font-mono text-slate-900">
                      {fmt(data.totals.openingBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <ArrowDownLeft className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.totalIn")}</p>
                    <p className="text-xl font-bold font-mono text-green-600">
                      {fmt(data.totals.totalIn)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2">
                    <ArrowUpRight className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.totalOut")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">
                      {fmt(data.totals.totalOut)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.closingBalance")}</p>
                    <p className="text-xl font-bold font-mono text-blue-600">
                      {fmt(data.totals.closingBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("reports.noTransactions")}</h3>
                <p className="text-sm text-slate-500">{t("reports.noTransactionsDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-6">
                {/* Mobile cards */}
                <div className="space-y-3 p-4 sm:hidden">
                  {data.accounts.map((account) => (
                    <Link key={account.id} href={getReportLink(account)}>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">{account.name}</p>
                          <Badge variant="outline">
                            {account.accountSubType === "CASH"
                              ? t("reports.cash")
                              : t("reports.bank")}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("reports.opening")}
                            </p>
                            <p className="mt-1 font-mono font-medium text-slate-900">
                              {fmt(account.openingBalance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("reports.closing")}
                            </p>
                            <p className="mt-1 font-mono font-semibold text-slate-900">
                              {fmt(account.closingBalance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("reports.totalIn")}
                            </p>
                            <p className="mt-1 font-mono font-medium text-green-600">
                              {fmt(account.totalIn)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("reports.totalOut")}
                            </p>
                            <p className="mt-1 font-mono font-medium text-red-600">
                              {fmt(account.totalOut)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.accountName")}</TableHead>
                        <TableHead>{t("reports.type")}</TableHead>
                        <TableHead className="text-right">
                          {t("reports.openingBalance")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.totalIn")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.totalOut")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.closingBalance")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.accounts.map((account) => (
                        <TableRow key={account.id} className="cursor-pointer hover:bg-slate-50">
                          <TableCell>
                            <Link
                              href={getReportLink(account)}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {account.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {account.accountSubType === "CASH"
                                ? t("reports.cash")
                                : t("reports.bank")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(account.openingBalance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {fmt(account.totalIn)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {fmt(account.totalOut)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {fmt(account.closingBalance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell colSpan={2}>{t("reports.totals")}</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(data.totals.openingBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {fmt(data.totals.totalIn)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {fmt(data.totals.totalOut)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(data.totals.closingBalance)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </ReportPageLayout>
  );
}
