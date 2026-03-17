"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface PurchasesBySupplierRow {
  supplierId: string;
  supplierName: string;
  invoiceCount: number;
  returnCount: number;
  grossPurchases: number;
  returns: number;
  netPurchases: number;
  tax: number;
  total: number;
}

interface PurchasesBySupplierData {
  rows: PurchasesBySupplierRow[];
  totals: {
    invoiceCount: number;
    returnCount: number;
    grossPurchases: number;
    returns: number;
    netPurchases: number;
    tax: number;
    total: number;
  };
}

export default function PurchasesBySupplierPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<PurchasesBySupplierData | null>(null);
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
      const response = await fetch(`/api/reports/purchases-by-supplier?${params}`);
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
      t("reports.pbsSupplier"),
      t("reports.pbsInvoices"),
      t("reports.pbsReturnsCol"),
      t("reports.pbsGrossPurchases"),
      t("reports.pbsReturnsAmount"),
      t("reports.pbsTax"),
      t("reports.pbsNetTotal"),
    ];
    const rows = data.rows.map((r) => [
      r.supplierName,
      String(r.invoiceCount),
      String(r.returnCount),
      r.grossPurchases.toFixed(2),
      r.returns.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
    ]);
    downloadCsv([header, ...rows], `purchases-by-supplier-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const response = await fetch(`/api/reports/purchases-by-supplier/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchases-by-supplier-${fromDate}-to-${toDate}.pdf`;
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
      titleKey="reports.pbsTitle"
      descriptionKey="reports.pbsDesc"
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
                  <div className="rounded-lg bg-red-50 p-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.pbsGrossPurchases")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">{fmt(data.totals.grossPurchases)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.pbsReturns")}</p>
                    <p className="text-xl font-bold font-mono text-green-600">{fmt(data.totals.returns)}</p>
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
                    <p className="text-sm text-slate-500">{t("reports.pbsNetPurchases")}</p>
                    <p className="text-xl font-bold font-mono text-blue-600">{fmt(data.totals.netPurchases)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.rows.length === 0 ? (
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
                  {data.rows.map((row) => (
                    <div
                      key={row.supplierId}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{row.supplierName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {row.invoiceCount} {t("reports.pbsInvoices").toLowerCase()}
                            {row.returnCount > 0 && `, ${row.returnCount} ${t("reports.pbsReturnsCol").toLowerCase()}`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbsGrossPurchases")}</p>
                          <p className="mt-1 font-mono font-semibold text-red-600">{fmt(row.grossPurchases)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbsReturns")}</p>
                          <p className="mt-1 font-mono text-green-600">{row.returns > 0 ? fmt(row.returns) : "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbsTax")}</p>
                          <p className="mt-1 font-mono">{fmt(row.tax)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbsNetTotal")}</p>
                        <p className="font-mono text-lg font-bold text-blue-600">{fmt(row.total)}</p>
                      </div>
                    </div>
                  ))}

                  {/* Mobile totals */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="font-semibold text-slate-900">{t("reports.totals")}</p>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">{t("reports.pbsGrossPurchases")}</p>
                        <p className="mt-1 font-mono font-bold text-red-700">{fmt(data.totals.grossPurchases)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t("reports.pbsReturns")}</p>
                        <p className="mt-1 font-mono font-bold text-green-700">{fmt(data.totals.returns)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{t("reports.pbsNetTotal")}</p>
                        <p className="mt-1 font-mono font-bold text-blue-700">{fmt(data.totals.total)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.pbsSupplier")}</TableHead>
                        <TableHead className="text-right">{t("reports.pbsInvoices")}</TableHead>
                        <TableHead className="text-right">{t("reports.pbsReturnsCol")}</TableHead>
                        <TableHead className="text-right">{t("reports.pbsGrossPurchases")}</TableHead>
                        <TableHead className="text-right">{t("reports.pbsReturnsAmount")}</TableHead>
                        <TableHead className="text-right">{t("reports.pbsTax")}</TableHead>
                        <TableHead className="text-right">{t("reports.pbsNetTotal")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((row) => (
                        <TableRow key={row.supplierId}>
                          <TableCell className="font-medium">{row.supplierName}</TableCell>
                          <TableCell className="text-right">{row.invoiceCount}</TableCell>
                          <TableCell className="text-right">{row.returnCount}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{fmt(row.grossPurchases)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {row.returns > 0 ? fmt(row.returns) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.tax)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(row.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>{t("reports.totals")}</TableCell>
                        <TableCell className="text-right">{data.totals.invoiceCount}</TableCell>
                        <TableCell className="text-right">{data.totals.returnCount}</TableCell>
                        <TableCell className="text-right font-mono text-red-700">{fmt(data.totals.grossPurchases)}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{fmt(data.totals.returns)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.tax)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.total)}</TableCell>
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
