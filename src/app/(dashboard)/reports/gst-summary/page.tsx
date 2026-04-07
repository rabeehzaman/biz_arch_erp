"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Receipt, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { downloadBlob } from "@/lib/download";
import { firstOfMonth, lastOfMonth } from "@/lib/date-utils";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { useEdition } from "@/hooks/use-edition";
import { PageAnimation } from "@/components/ui/page-animation";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

interface GSTSection {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface GSTLiability {
  cgst: number;
  sgst: number;
  igst: number;
}

interface GSTSummaryData {
  sales: GSTSection;
  salesReturns: GSTSection;
  purchases: GSTSection;
  purchaseReturns: GSTSection;
  netOutputGST: GSTSection;
  netInputGST: GSTSection;
  totalLiability: GSTLiability;
}

function gstTotal(s: { cgst: number; sgst: number; igst: number }) {
  return s.cgst + s.sgst + s.igst;
}

export default function GSTSummaryPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { config } = useEdition();

  if (config.taxSystem !== "GST") {
    return (
      <PageAnimation>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">{t("reports.gstSummary")}</h2>
          <p className="mt-2 text-slate-500">{t("reports.taxReportNotAvailable")}</p>
        </div>
      </PageAnimation>
    );
  }
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [data, setData] = useState<GSTSummaryData | null>(null);
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/gst-summary?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch { toast.error(t("reports.noDataForPeriod")); }
    finally { setIsLoading(false); }
  }, [fromDate, toDate, branchParam, t]);

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [t("reports.category"), t("reports.vatTaxableAmount"), "CGST", "SGST", "IGST"];
    const rows = [
      [t("reports.vatSales"), data.sales.taxableAmount.toFixed(2), data.sales.cgst.toFixed(2), data.sales.sgst.toFixed(2), data.sales.igst.toFixed(2)],
      [t("reports.vatSalesReturns"), data.salesReturns.taxableAmount.toFixed(2), data.salesReturns.cgst.toFixed(2), data.salesReturns.sgst.toFixed(2), data.salesReturns.igst.toFixed(2)],
      [t("reports.gstNetOutput"), data.netOutputGST.taxableAmount.toFixed(2), data.netOutputGST.cgst.toFixed(2), data.netOutputGST.sgst.toFixed(2), data.netOutputGST.igst.toFixed(2)],
      [t("reports.vatPurchases"), data.purchases.taxableAmount.toFixed(2), data.purchases.cgst.toFixed(2), data.purchases.sgst.toFixed(2), data.purchases.igst.toFixed(2)],
      [t("reports.vatPurchaseReturns"), data.purchaseReturns.taxableAmount.toFixed(2), data.purchaseReturns.cgst.toFixed(2), data.purchaseReturns.sgst.toFixed(2), data.purchaseReturns.igst.toFixed(2)],
      [t("reports.gstNetInput"), data.netInputGST.taxableAmount.toFixed(2), data.netInputGST.cgst.toFixed(2), data.netInputGST.sgst.toFixed(2), data.netInputGST.igst.toFixed(2)],
      [t("reports.gstTotalLiability"), "", data.totalLiability.cgst.toFixed(2), data.totalLiability.sgst.toFixed(2), data.totalLiability.igst.toFixed(2)],
    ];
    downloadCsv([header, ...rows], `gst-summary-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, lang });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/gst-summary/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      await downloadBlob(blob, `gst-summary-${fromDate}-to-${toDate}.pdf`);
    } catch { toast.error(t("reports.pdfDownloadError")); }
    finally { setIsDownloading(false); }
  };

  const renderRow = (label: string, section: GSTSection, bold = false) => (
    <TableRow className={bold ? "font-bold border-t-2" : ""}>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right font-mono">{fmt(section.taxableAmount)}</TableCell>
      <TableCell className="text-right font-mono">{fmt(section.cgst)}</TableCell>
      <TableCell className="text-right font-mono">{fmt(section.sgst)}</TableCell>
      <TableCell className="text-right font-mono">{fmt(section.igst)}</TableCell>
      <TableCell className="text-right font-mono">{fmt(gstTotal(section))}</TableCell>
    </TableRow>
  );

  return (
    <ReportPageLayout
      titleKey="reports.gstSummary"
      descriptionKey="reports.gstSummaryDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!data}
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2"><Receipt className="h-5 w-5 text-red-600" /></div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.gstOutputGST")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">{fmt(gstTotal(data.netOutputGST))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2"><Receipt className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.gstInputGST")}</p>
                    <p className="text-xl font-bold font-mono text-green-600">{fmt(gstTotal(data.netInputGST))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${gstTotal(data.totalLiability) >= 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <DollarSign className={`h-5 w-5 ${gstTotal(data.totalLiability) >= 0 ? "text-red-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.gstTotalLiability")}</p>
                    <p className={`text-xl font-bold font-mono ${gstTotal(data.totalLiability) >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(gstTotal(data.totalLiability))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-red-700">{t("reports.gstOutputGST")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {[
                    { label: t("reports.vatSales"), s: data.sales },
                    { label: t("reports.vatSalesReturns"), s: data.salesReturns },
                    { label: t("reports.gstNetOutput"), s: data.netOutputGST },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500">{t("reports.vatTaxableAmount")}</p><p className="mt-1 font-mono">{fmt(row.s.taxableAmount)}</p></div>
                        <div><p className="text-xs text-slate-500">CGST</p><p className="mt-1 font-mono">{fmt(row.s.cgst)}</p></div>
                        <div><p className="text-xs text-slate-500">SGST</p><p className="mt-1 font-mono">{fmt(row.s.sgst)}</p></div>
                        <div><p className="text-xs text-slate-500">IGST</p><p className="mt-1 font-mono">{fmt(row.s.igst)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.category")}</TableHead>
                        <TableHead className="text-right">{t("reports.vatTaxableAmount")}</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">{t("reports.gstTotalGST")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderRow(t("reports.vatSales"), data.sales)}
                      {renderRow(t("reports.vatSalesReturns"), data.salesReturns)}
                      {renderRow(t("reports.gstNetOutput"), data.netOutputGST, true)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-green-700">{t("reports.gstInputGST")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {[
                    { label: t("reports.vatPurchases"), s: data.purchases },
                    { label: t("reports.vatPurchaseReturns"), s: data.purchaseReturns },
                    { label: t("reports.gstNetInput"), s: data.netInputGST },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500">{t("reports.vatTaxableAmount")}</p><p className="mt-1 font-mono">{fmt(row.s.taxableAmount)}</p></div>
                        <div><p className="text-xs text-slate-500">CGST</p><p className="mt-1 font-mono">{fmt(row.s.cgst)}</p></div>
                        <div><p className="text-xs text-slate-500">SGST</p><p className="mt-1 font-mono">{fmt(row.s.sgst)}</p></div>
                        <div><p className="text-xs text-slate-500">IGST</p><p className="mt-1 font-mono">{fmt(row.s.igst)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.category")}</TableHead>
                        <TableHead className="text-right">{t("reports.vatTaxableAmount")}</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">{t("reports.gstTotalGST")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renderRow(t("reports.vatPurchases"), data.purchases)}
                      {renderRow(t("reports.vatPurchaseReturns"), data.purchaseReturns)}
                      {renderRow(t("reports.gstNetInput"), data.netInputGST, true)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{t("reports.gstTotalLiability")}</span>
                <span className={`text-2xl font-bold font-mono ${gstTotal(data.totalLiability) >= 0 ? "text-red-700" : "text-green-700"}`}>
                  {fmt(gstTotal(data.totalLiability))}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">CGST</p>
                  <p className={`font-mono font-semibold ${data.totalLiability.cgst >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(data.totalLiability.cgst)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">SGST</p>
                  <p className={`font-mono font-semibold ${data.totalLiability.sgst >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(data.totalLiability.sgst)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">IGST</p>
                  <p className={`font-mono font-semibold ${data.totalLiability.igst >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(data.totalLiability.igst)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {gstTotal(data.totalLiability) >= 0 ? t("reports.vatPayableTax") : t("reports.vatRefundable")}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </ReportPageLayout>
  );
}
