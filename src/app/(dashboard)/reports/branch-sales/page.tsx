"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GitBranch,
  RefreshCw,
  Download,
  FileText,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Wallet,
  Landmark,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import {
  PageAnimation,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-animation";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { firstOfMonth as firstOfMonthStr, lastOfMonth } from "@/lib/date-utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadBlob } from "@/lib/download";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

interface BranchSessionRow {
  sessionId: string;
  sessionNumber: string;
  sessionLabel: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openedBy: string | null;
  closedBy: string | null;
  cash: number;
  bank: number;
  total: number;
  transactionCount: number;
}

interface BranchSalesRow {
  branchId: string | null;
  branchName: string;
  branchCode: string | null;
  sessions: BranchSessionRow[];
  totalCash: number;
  totalBank: number;
  grandTotal: number;
}

interface BranchSalesData {
  rows: BranchSalesRow[];
  totals: { cash: number; bank: number; total: number };
  from: string;
  to: string;
}

function MobileMetric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${className}`}>{value}</p>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return format(d, "MMM dd, hh:mm a");
}

export default function BranchSalesPage() {
  const { t, isRTL, lang } = useLanguage();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const { data: session } = useSession();
  const multiBranchEnabled = (session?.user as any)?.multiBranchEnabled;
  const { branches, filterBranchId, setFilterBranchId, branchParam } = useBranchFilter();
  const { symbol, locale } = useCurrency();
  const fmt = (n: number) =>
    `${symbol}${n.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [data, setData] = useState<BranchSalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (branchParam) params.set("branchId", branchParam);
      const res = await fetch(`/api/reports/branch-sales?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, t, branchParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function exportCSV() {
    if (!data) return;
    const headers = [
      t("reports.branchName"),
      t("reports.branchSalesSession"),
      t("reports.branchSalesOpened"),
      t("reports.branchSalesClosed"),
      t("reports.branchSalesCash"),
      t("reports.branchSalesBank"),
      t("reports.branchSalesTotal"),
    ];
    const csvRows = ["\uFEFF" + headers.join(",")];
    for (const r of data.rows) {
      for (const s of r.sessions) {
        csvRows.push(
          [
            `"${r.branchName}"`,
            `"${s.sessionLabel}"`,
            `"${s.openedAt ? formatTime(s.openedAt) : ""}"`,
            `"${s.closedAt ? formatTime(s.closedAt) : ""}"`,
            s.cash.toFixed(2),
            s.bank.toFixed(2),
            s.total.toFixed(2),
          ].join(",")
        );
      }
      csvRows.push(
        [
          `"${r.branchName} - ${t("reports.branchSalesBranchTotal")}"`,
          "",
          "",
          "",
          r.totalCash.toFixed(2),
          r.totalBank.toFixed(2),
          r.grandTotal.toFixed(2),
        ].join(",")
      );
    }
    csvRows.push(
      [
        `"${t("reports.branchSalesGrandTotal")}"`,
        "",
        "",
        "",
        data.totals.cash.toFixed(2),
        data.totals.bank.toFixed(2),
        data.totals.total.toFixed(2),
      ].join(",")
    );
    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    await downloadBlob(blob, `branch-sales-${fromDate}-to-${toDate}.csv`);
  }

  async function downloadPDF() {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const res = await fetch(`/api/reports/branch-sales/pdf?${params}`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      await downloadBlob(blob, `branch-sales-${fromDate}-to-${toDate}.pdf`);
    } catch {
      toast.error(t("common.failedToGeneratePdf"));
    } finally {
      setIsDownloading(false);
    }
  }

  if (!multiBranchEnabled) {
    return (
      <PageAnimation>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {t("reports.multiBranchDisabled")}
          </h2>
          <p className="text-slate-500 max-w-md">
            {t("reports.multiBranchDisabledDesc")}
          </p>
        </div>
      </PageAnimation>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/reports"
              className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <BackArrow className="h-4 w-4" />
              {t("nav.reports")}
            </Link>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("reports.branchSales")}
            </h2>
            <p className="text-slate-500">
              {t("reports.branchSalesDesc")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t("reports.refresh")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t("reports.exportCsv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadPDF}
              disabled={isDownloading}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {isDownloading ? "..." : t("reports.exportPdf")}
            </Button>
          </div>
        </div>

        {/* Date Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">
                  {t("reports.fromDate")}
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">
                  {t("reports.toDate")}
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <BranchFilterSelect
                branches={branches}
                filterBranchId={filterBranchId}
                onBranchChange={setFilterBranchId}
                multiBranchEnabled={multiBranchEnabled}
              />
              <Button
                onClick={fetchData}
                size="sm"
                className="w-full self-end sm:w-auto"
              >
                {t("reports.generate")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {data && (
          <StaggerContainer>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StaggerItem>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-green-100 p-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("reports.branchSalesTotalCash")}
                        </p>
                        <p className="text-xl font-bold text-green-600">
                          {fmt(data.totals.cash)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-100 p-2">
                        <Landmark className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("reports.branchSalesTotalBank")}
                        </p>
                        <p className="text-xl font-bold text-blue-600">
                          {fmt(data.totals.bank)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
              <StaggerItem>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-slate-100 p-2">
                        <DollarSign className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">
                          {t("reports.branchSalesGrandTotal")}
                        </p>
                        <p className="text-xl font-bold text-slate-900">
                          {fmt(data.totals.total)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </div>
          </StaggerContainer>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <GitBranch className="h-5 w-5" />
              {t("reports.branchSales")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton columns={7} rows={4} />
            ) : !data || data.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <GitBranch className="h-12 w-12 mb-3 text-slate-300" />
                <p className="font-medium">{t("reports.noDataAvailable")}</p>
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="space-y-3 p-4 sm:hidden">
                  {data.rows.map((row, i) => (
                    <div
                      key={row.branchId ?? `unassigned-${i}`}
                      className="rounded-xl border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-purple-100 rounded">
                          <GitBranch className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <span className="font-semibold text-slate-900">
                          {row.branchName}
                        </span>
                        {row.branchCode && (
                          <span className="text-xs text-slate-400">
                            ({row.branchCode})
                          </span>
                        )}
                      </div>

                      {row.sessions.map((s) => (
                        <div
                          key={s.sessionId}
                          className="mb-3 rounded-lg bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">
                              {s.sessionLabel}
                            </span>
                            {s.status === "OPEN" ? (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                {t("reports.branchSalesOpen")}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500 mb-2">
                            {formatTime(s.openedAt)}
                            {s.closedAt
                              ? ` — ${formatTime(s.closedAt)}`
                              : ""}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <MobileMetric
                              label={t("reports.branchSalesCash")}
                              value={fmt(s.cash)}
                              className="text-green-600"
                            />
                            <MobileMetric
                              label={t("reports.branchSalesBank")}
                              value={fmt(s.bank)}
                              className="text-blue-600"
                            />
                            <MobileMetric
                              label={t("reports.branchSalesTotal")}
                              value={fmt(s.total)}
                            />
                          </div>
                        </div>
                      ))}

                      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
                        <MobileMetric
                          label={t("reports.branchSalesTotalCash")}
                          value={fmt(row.totalCash)}
                          className="text-green-600"
                        />
                        <MobileMetric
                          label={t("reports.branchSalesTotalBank")}
                          value={fmt(row.totalBank)}
                          className="text-blue-600"
                        />
                        <MobileMetric
                          label={t("reports.branchSalesGrandTotal")}
                          value={fmt(row.grandTotal)}
                          className="font-bold"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden overflow-x-auto sm:block">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>{t("reports.branchName")}</TableHead>
                        <TableHead>{t("reports.branchSalesSession")}</TableHead>
                        <TableHead>{t("reports.branchSalesOpened")}</TableHead>
                        <TableHead>{t("reports.branchSalesClosed")}</TableHead>
                        <TableHead className="text-right">
                          {t("reports.branchSalesCash")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.branchSalesBank")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.branchSalesTotal")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row, i) => (
                        <Fragment key={row.branchId ?? `unassigned-${i}`}>
                          {row.sessions.map((s, si) => (
                            <TableRow
                              key={s.sessionId}
                              className={
                                si % 2 === 0
                                  ? "hover:bg-slate-50"
                                  : "bg-slate-50/50 hover:bg-slate-100/60"
                              }
                            >
                              <TableCell>
                                {si === 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-100 rounded">
                                      <GitBranch className="h-3.5 w-3.5 text-purple-600" />
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-900">
                                        {row.branchName}
                                      </span>
                                      {row.branchCode && (
                                        <span className="ml-2 text-xs text-slate-400">
                                          ({row.branchCode})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-700">
                                    {s.sessionLabel}
                                  </span>
                                  {s.status === "OPEN" && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-green-600 border-green-300"
                                    >
                                      {t("reports.branchSalesOpen")}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 tabular-nums">
                                {formatTime(s.openedAt)}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600 tabular-nums">
                                {s.closedAt
                                  ? formatTime(s.closedAt)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-green-600">
                                {fmt(s.cash)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-blue-600">
                                {fmt(s.bank)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {fmt(s.total)}
                              </TableCell>
                            </TableRow>
                          ))}

                          {/* Branch subtotal */}
                          <TableRow className="bg-slate-100/80 border-t-2 border-slate-300">
                            <TableCell
                              colSpan={4}
                              className="font-bold text-slate-700"
                            >
                              {t("reports.branchSalesBranchTotal")}:{" "}
                              {row.branchName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold text-green-600">
                              {fmt(row.totalCash)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold text-blue-600">
                              {fmt(row.totalBank)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold">
                              {fmt(row.grandTotal)}
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      ))}

                      {/* Grand Total */}
                      <TableRow className="bg-slate-100 font-bold border-t-2">
                        <TableCell colSpan={4}>
                          {t("reports.branchSalesGrandTotal")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-green-600">
                          {fmt(data.totals.cash)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-blue-600">
                          {fmt(data.totals.bank)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(data.totals.total)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageAnimation>
  );
}
