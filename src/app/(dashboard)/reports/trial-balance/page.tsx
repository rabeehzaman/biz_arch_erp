"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { todayStr } from "@/lib/date-utils";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { AsOfDateSelector } from "@/components/reports/as-of-date-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

interface AccountRow {
  account: { code: string; name: string; accountType: string };
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalance {
  asOfDate: string;
  accounts: AccountRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export default function TrialBalancePage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [data, setData] = useState<TrialBalance | null>(null);
  const [asOfDate, setAsOfDate] = useState(todayStr());
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ asOfDate });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/trial-balance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate, branchParam, t]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [t("common.code"), t("reports.account"), t("reports.type"), t("reports.debit"), t("reports.credit")];
    const rows = data.accounts.map((r) => [
      r.account.code,
      r.account.name,
      r.account.accountType,
      r.debit > 0 ? r.debit.toFixed(2) : "",
      r.credit > 0 ? r.credit.toFixed(2) : "",
    ]);
    rows.push(["", t("reports.totals"), "", data.totalDebit.toFixed(2), data.totalCredit.toFixed(2)]);
    downloadCsv([header, ...rows], `trial-balance-${asOfDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ asOfDate, lang });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/trial-balance/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trial-balance-${asOfDate}.pdf`;
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
      titleKey="reports.trialBalance"
      descriptionKey="reports.trialBalanceDesc"
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
          <AsOfDateSelector
            asOfDate={asOfDate}
            onDateChange={setAsOfDate}
            onGenerate={fetchReport}
            isLoading={isLoading}
          />
          <BranchFilterSelect branches={branches} filterBranchId={filterBranchId} onBranchChange={setFilterBranchId} multiBranchEnabled={multiBranchEnabled} />
        </>
      }
    >
      {!data || data.accounts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center py-8 text-slate-500">
              {t("reports.noEntries")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {data.isBalanced ? (
              <Badge className="mb-4 bg-green-100 text-green-700">{t("reports.balanced")}</Badge>
            ) : (
              <Badge className="mb-4 bg-red-100 text-red-700">{t("reports.unbalanced")}</Badge>
            )}

            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {data.accounts.map((row) => (
                <div key={row.account.code} onClick={() => router.push(`/reports/ledger?accountCode=${row.account.code}`)} className="cursor-pointer hover:bg-muted/50 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                      <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                    </div>
                    <Badge variant="outline">{row.account.accountType}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.debit")}</p>
                      <p className="mt-1 font-mono font-medium text-slate-900">
                        {row.debit > 0 ? fmt(row.debit) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.credit")}</p>
                      <p className="mt-1 font-mono font-medium text-slate-900">
                        {row.credit > 0 ? fmt(row.credit) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
                <p className="font-semibold text-slate-900">{t("reports.totals")}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.debit")}</p>
                    <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(data.totalDebit)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.credit")}</p>
                    <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(data.totalCredit)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.code")}</TableHead>
                    <TableHead>{t("reports.account")}</TableHead>
                    <TableHead>{t("reports.type")}</TableHead>
                    <TableHead className="text-right">{t("reports.debit")}</TableHead>
                    <TableHead className="text-right">{t("reports.credit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((row) => (
                    <TableRow key={row.account.code} onClick={() => router.push(`/reports/ledger?accountCode=${row.account.code}`)} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono">
                        {row.account.code}
                      </TableCell>
                      <TableCell>{row.account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.account.accountType}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.debit > 0 ? fmt(row.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.credit > 0 ? fmt(row.credit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3} className="text-right">
                      {t("reports.totals")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmt(data.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmt(data.totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </ReportPageLayout>
  );
}
