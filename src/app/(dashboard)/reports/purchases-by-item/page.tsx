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
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface PurchasesByItemRow {
  productId: string;
  productName: string;
  sku: string | null;
  qtyPurchased: number;
  amount: number;
  tax: number;
  total: number;
}

interface PurchasesByItemReport {
  fromDate: string;
  toDate: string;
  rows: PurchasesByItemRow[];
  totals: {
    qtyPurchased: number;
    amount: number;
    tax: number;
    total: number;
  };
}

export default function PurchasesByItemPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<PurchasesByItemReport | null>(null);
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
      const response = await fetch(`/api/reports/purchases-by-item?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, t]);

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [
      t("reports.product"),
      t("reports.skuLabel"),
      t("reports.pbiQtyPurchased"),
      t("reports.pbiAmount"),
      t("reports.tax"),
      t("reports.pbiTotal"),
    ];
    const rows = data.rows.map((r) => [
      r.productName,
      r.sku || "",
      String(r.qtyPurchased),
      r.amount.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
    ]);
    rows.push([
      t("reports.totals"),
      "",
      String(data.totals.qtyPurchased),
      data.totals.amount.toFixed(2),
      data.totals.tax.toFixed(2),
      data.totals.total.toFixed(2),
    ]);
    downloadCsv([header, ...rows], `purchases-by-item-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const response = await fetch(`/api/reports/purchases-by-item/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchases-by-item-${fromDate}-to-${toDate}.pdf`;
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
      titleKey="reports.purchasesByItem"
      descriptionKey="reports.purchasesByItemDesc"
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
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.pbiQtyPurchased")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totals.qtyPurchased.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500">
                  {data.rows.length} {t("reports.products")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.pbiAmount")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {fmt(data.totals.amount)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.tax")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-600">
                  {fmt(data.totals.tax)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.pbiItemDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("reports.noItemsFound")}</h3>
                  <p className="text-sm text-slate-500">{t("reports.pbiNoData")}</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {data.rows.map((row) => (
                      <div
                        key={row.productId}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{row.productName}</p>
                          {row.sku && (
                            <p className="mt-1 text-xs text-slate-500">{t("reports.skuLabel")} {row.sku}</p>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbiQtyPurchased")}</p>
                            <p className="mt-1 font-medium text-slate-900">{row.qtyPurchased}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbiAmount")}</p>
                            <p className="mt-1 font-medium text-slate-900">{fmt(row.amount)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.tax")}</p>
                            <p className="mt-1 font-medium text-slate-600">{fmt(row.tax)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.pbiTotal")}</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {fmt(row.total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("reports.product")}</TableHead>
                            <TableHead>{t("reports.skuLabel")}</TableHead>
                            <TableHead className="text-right">{t("reports.pbiQtyPurchased")}</TableHead>
                            <TableHead className="text-right">{t("reports.pbiAmount")}</TableHead>
                            <TableHead className="text-right">{t("reports.tax")}</TableHead>
                            <TableHead className="text-right">{t("reports.pbiTotal")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.rows.map((row) => (
                            <TableRow key={row.productId}>
                              <TableCell className="font-medium">{row.productName}</TableCell>
                              <TableCell className="text-slate-500">{row.sku || "-"}</TableCell>
                              <TableCell className="text-right">{row.qtyPurchased}</TableCell>
                              <TableCell className="text-right">{fmt(row.amount)}</TableCell>
                              <TableCell className="text-right">{fmt(row.tax)}</TableCell>
                              <TableCell className="text-right font-medium">{fmt(row.total)}</TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow className="border-t-2 font-bold bg-slate-50">
                            <TableCell>{t("reports.totals")}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">{data.totals.qtyPurchased}</TableCell>
                            <TableCell className="text-right">{fmt(data.totals.amount)}</TableCell>
                            <TableCell className="text-right">{fmt(data.totals.tax)}</TableCell>
                            <TableCell className="text-right">{fmt(data.totals.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </ReportPageLayout>
  );
}
