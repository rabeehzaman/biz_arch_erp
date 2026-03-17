"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface SalesBySalespersonRow {
  userId: string;
  userName: string;
  invoiceCount: number;
  totalSales: number;
  totalTax: number;
  totalAmount: number;
  collected: number;
  outstanding: number;
}

interface SalesBySalespersonData {
  rows: SalesBySalespersonRow[];
  totals: {
    invoiceCount: number;
    totalSales: number;
    totalTax: number;
    totalAmount: number;
    collected: number;
    outstanding: number;
  };
}

export default function SalesBySalespersonPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<SalesBySalespersonData | null>(null);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      const response = await fetch(`/api/reports/sales-by-salesperson?${params}`);
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
    const header = [
      t("reports.salesperson") || "Salesperson",
      t("reports.invoiceNumber") || "Invoices",
      t("reports.sales") || "Sales",
      t("reports.tax") || "Tax",
      t("reports.totals") || "Total",
      t("reports.collected") || "Collected",
      t("reports.outstanding") || "Outstanding",
    ];
    const rows = data.rows.map((r) => [
      r.userName,
      String(r.invoiceCount),
      r.totalSales.toFixed(2),
      r.totalTax.toFixed(2),
      r.totalAmount.toFixed(2),
      r.collected.toFixed(2),
      r.outstanding.toFixed(2),
    ]);
    const totalsRow = [
      t("reports.totals") || "Totals",
      String(data.totals.invoiceCount),
      data.totals.totalSales.toFixed(2),
      data.totals.totalTax.toFixed(2),
      data.totals.totalAmount.toFixed(2),
      data.totals.collected.toFixed(2),
      data.totals.outstanding.toFixed(2),
    ];
    downloadCsv([header, ...rows, totalsRow], `sales-by-salesperson-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const response = await fetch(`/api/reports/sales-by-salesperson/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-by-salesperson-${fromDate}-to-${toDate}.pdf`;
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
      titleKey="reports.salesBySalesperson"
      descriptionKey="reports.salesBySalespersonDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!data || data.rows.length === 0}
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
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.totalSales") || "Total Sales"}</p>
                    <p className="text-xl font-bold font-mono text-green-600">
                      {fmt(data.totals.totalAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.collected") || "Collected"}</p>
                    <p className="text-xl font-bold font-mono text-blue-600">
                      {fmt(data.totals.collected)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2">
                    <DollarSign className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.outstanding") || "Outstanding"}</p>
                    <p className="text-xl font-bold font-mono text-red-600">
                      {fmt(data.totals.outstanding)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("reports.noTransactions") || "No sales data found"}</h3>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-6">
                {/* Mobile cards */}
                <div className="space-y-3 p-4 sm:hidden">
                  {data.rows.map((r) => (
                    <div key={r.userId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{r.userName}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {r.invoiceCount} {t("reports.invoiceNumber") || "invoices"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.totals") || "Total"}</p>
                          <p className="mt-1 font-mono font-semibold">{fmt(r.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.collected") || "Collected"}</p>
                          <p className="mt-1 font-mono text-blue-600">{fmt(r.collected)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.outstanding") || "Outstanding"}</p>
                          <p className={`mt-1 font-mono ${r.outstanding > 0 ? "text-red-600" : ""}`}>{fmt(r.outstanding)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.salesperson") || "Salesperson"}</TableHead>
                        <TableHead className="text-right">{t("reports.invoiceNumber") || "Invoices"}</TableHead>
                        <TableHead className="text-right">{t("reports.sales") || "Sales"}</TableHead>
                        <TableHead className="text-right">{t("reports.tax") || "Tax"}</TableHead>
                        <TableHead className="text-right">{t("reports.totals") || "Total"}</TableHead>
                        <TableHead className="text-right">{t("reports.collected") || "Collected"}</TableHead>
                        <TableHead className="text-right">{t("reports.outstanding") || "Outstanding"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.userId}>
                          <TableCell className="font-medium">{r.userName}</TableCell>
                          <TableCell className="text-right">{r.invoiceCount}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.totalSales)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.totalTax)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(r.totalAmount)}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600">{fmt(r.collected)}</TableCell>
                          <TableCell className={`text-right font-mono ${r.outstanding > 0 ? "text-red-600" : ""}`}>{fmt(r.outstanding)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="border-t-2 bg-slate-50 font-bold">
                        <TableCell className="font-bold">{t("reports.totals") || "Totals"}</TableCell>
                        <TableCell className="text-right font-bold">{data.totals.invoiceCount}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(data.totals.totalSales)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(data.totals.totalTax)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(data.totals.totalAmount)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-600">{fmt(data.totals.collected)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">{fmt(data.totals.outstanding)}</TableCell>
                      </TableRow>
                    </TableBody>
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
