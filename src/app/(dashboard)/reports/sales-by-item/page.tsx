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
import { Package } from "lucide-react";
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

interface SalesByItemRow {
  productId: string;
  productName: string;
  sku: string | null;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface SalesByItemReport {
  fromDate: string;
  toDate: string;
  rows: SalesByItemRow[];
  totals: {
    qtySold: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  };
}

export default function SalesByItemPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [data, setData] = useState<SalesByItemReport | null>(null);
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/sales-by-item?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, branchParam, t]);

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [
      t("reports.product"),
      t("reports.skuLabel"),
      t("reports.qtySold"),
      t("reports.totalRevenue"),
      t("reports.cogs"),
      t("reports.totalProfit"),
      t("reports.profitMargin"),
    ];
    const rows = data.rows.map((r) => [
      r.productName,
      r.sku || "",
      String(r.qtySold),
      r.revenue.toFixed(2),
      r.cost.toFixed(2),
      r.profit.toFixed(2),
      r.margin.toFixed(1) + "%",
    ]);
    rows.push([
      t("reports.totals"),
      "",
      String(data.totals.qtySold),
      data.totals.revenue.toFixed(2),
      data.totals.cost.toFixed(2),
      data.totals.profit.toFixed(2),
      data.totals.margin.toFixed(1) + "%",
    ]);
    downloadCsv([header, ...rows], `sales-by-item-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/sales-by-item/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-by-item-${fromDate}-to-${toDate}.pdf`;
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
      titleKey="reports.salesByItem"
      descriptionKey="reports.salesByItemDesc"
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
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.qtySold")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.totals.qtySold.toLocaleString()}
                </div>
                <p className="text-xs text-slate-500">
                  {data.rows.length} {t("reports.products")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.totalRevenue")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {fmt(data.totals.revenue)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.cogs")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {fmt(data.totals.cost)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.totalProfit")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${data.totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {fmt(data.totals.profit)}
                </div>
                <p className="text-xs text-slate-500">
                  {data.totals.margin.toFixed(1)}% {t("reports.margin").toLowerCase()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Table Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.itemDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("reports.noItemsFound")}</h3>
                  <p className="text-sm text-slate-500">{t("reports.noSalesDataForPeriod")}</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {data.rows.map((row) => (
                      <div
                        key={row.productId}
                        onClick={() => router.push(`/products?highlight=${row.productId}`)}
                        className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{row.productName}</p>
                          {row.sku && (
                            <p className="mt-1 text-xs text-slate-500">{t("reports.skuLabel")} {row.sku}</p>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.qtySold")}</p>
                            <p className="mt-1 font-medium text-slate-900">{row.qtySold}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.totalRevenue")}</p>
                            <p className="mt-1 font-medium text-slate-900">{fmt(row.revenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.cogs")}</p>
                            <p className="mt-1 font-medium text-red-600">{fmt(row.cost)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.totalProfit")}</p>
                            <p className={`mt-1 font-semibold ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {fmt(row.profit)}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.profitMargin")}</p>
                            <p className={`mt-1 font-semibold ${row.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {row.margin.toFixed(1)}%
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
                            <TableHead className="text-right">{t("reports.qtySold")}</TableHead>
                            <TableHead className="text-right">{t("reports.totalRevenue")}</TableHead>
                            <TableHead className="text-right">{t("reports.cogs")}</TableHead>
                            <TableHead className="text-right">{t("reports.totalProfit")}</TableHead>
                            <TableHead className="text-right">{t("reports.profitMargin")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.rows.map((row) => (
                            <TableRow key={row.productId} onClick={() => router.push(`/products?highlight=${row.productId}`)} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-medium">{row.productName}</TableCell>
                              <TableCell className="text-slate-500">{row.sku || "-"}</TableCell>
                              <TableCell className="text-right">{row.qtySold}</TableCell>
                              <TableCell className="text-right">{fmt(row.revenue)}</TableCell>
                              <TableCell className="text-right">{fmt(row.cost)}</TableCell>
                              <TableCell
                                className={`text-right font-medium ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {fmt(row.profit)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${row.margin >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {row.margin.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow className="border-t-2 font-bold bg-slate-50">
                            <TableCell>{t("reports.totals")}</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">{data.totals.qtySold}</TableCell>
                            <TableCell className="text-right">{fmt(data.totals.revenue)}</TableCell>
                            <TableCell className="text-right">{fmt(data.totals.cost)}</TableCell>
                            <TableCell
                              className={`text-right ${data.totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {fmt(data.totals.profit)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${data.totals.margin >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {data.totals.margin.toFixed(1)}%
                            </TableCell>
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
