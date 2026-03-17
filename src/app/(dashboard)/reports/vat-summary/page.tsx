"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Receipt, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { useEdition } from "@/hooks/use-edition";
import { PageAnimation } from "@/components/ui/page-animation";

interface VATSection {
  taxableAmount: number;
  vatAmount: number;
}

interface VATSummaryData {
  sales: VATSection;
  salesReturns: VATSection;
  purchases: VATSection;
  purchaseReturns: VATSection;
  netOutputVAT: VATSection;
  netInputVAT: VATSection;
  netVATPayable: number;
}

export default function VATSummaryPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { config } = useEdition();

  if (config.taxSystem !== "VAT") {
    return (
      <PageAnimation>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">{t("reports.vatSummary")}</h2>
          <p className="mt-2 text-slate-500">{t("reports.taxReportNotAvailable")}</p>
        </div>
      </PageAnimation>
    );
  }
  const [data, setData] = useState<VATSummaryData | null>(null);
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
      const response = await fetch(`/api/reports/vat-summary?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch { toast.error(t("reports.noDataForPeriod")); }
    finally { setIsLoading(false); }
  }, [fromDate, toDate, t]);

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [t("reports.category"), t("reports.vatTaxableAmount"), t("reports.vatAmount")];
    const rows = [
      [t("reports.vatSales"), data.sales.taxableAmount.toFixed(2), data.sales.vatAmount.toFixed(2)],
      [t("reports.vatSalesReturns"), data.salesReturns.taxableAmount.toFixed(2), data.salesReturns.vatAmount.toFixed(2)],
      [t("reports.vatNetOutput"), data.netOutputVAT.taxableAmount.toFixed(2), data.netOutputVAT.vatAmount.toFixed(2)],
      [t("reports.vatPurchases"), data.purchases.taxableAmount.toFixed(2), data.purchases.vatAmount.toFixed(2)],
      [t("reports.vatPurchaseReturns"), data.purchaseReturns.taxableAmount.toFixed(2), data.purchaseReturns.vatAmount.toFixed(2)],
      [t("reports.vatNetInput"), data.netInputVAT.taxableAmount.toFixed(2), data.netInputVAT.vatAmount.toFixed(2)],
      [t("reports.vatNetPayable"), "", data.netVATPayable.toFixed(2)],
    ];
    downloadCsv([header, ...rows], `vat-summary-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const response = await fetch(`/api/reports/vat-summary/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vat-summary-${fromDate}-to-${toDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t("reports.pdfDownloadError")); }
    finally { setIsDownloading(false); }
  };

  const renderRow = (label: string, section: VATSection, bold = false) => (
    <TableRow className={bold ? "font-bold border-t-2" : ""}>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right font-mono">{fmt(section.taxableAmount)}</TableCell>
      <TableCell className="text-right font-mono">{fmt(section.vatAmount)}</TableCell>
    </TableRow>
  );

  return (
    <ReportPageLayout
      titleKey="reports.vatSummary"
      descriptionKey="reports.vatSummaryDesc"
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2"><Receipt className="h-5 w-5 text-red-600" /></div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.vatOutputVAT")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">{fmt(data.netOutputVAT.vatAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2"><Receipt className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.vatInputVAT")}</p>
                    <p className="text-xl font-bold font-mono text-green-600">{fmt(data.netInputVAT.vatAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${data.netVATPayable >= 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <DollarSign className={`h-5 w-5 ${data.netVATPayable >= 0 ? "text-red-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.vatNetPayable")}</p>
                    <p className={`text-xl font-bold font-mono ${data.netVATPayable >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(data.netVATPayable)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-red-700">{t("reports.vatOutputVAT")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {[
                    { label: t("reports.vatSales"), s: data.sales },
                    { label: t("reports.vatSalesReturns"), s: data.salesReturns },
                    { label: t("reports.vatNetOutput"), s: data.netOutputVAT },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500">{t("reports.vatTaxableAmount")}</p><p className="mt-1 font-mono">{fmt(row.s.taxableAmount)}</p></div>
                        <div><p className="text-xs text-slate-500">{t("reports.vatAmount")}</p><p className="mt-1 font-mono">{fmt(row.s.vatAmount)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("reports.category")}</TableHead><TableHead className="text-right">{t("reports.vatTaxableAmount")}</TableHead><TableHead className="text-right">{t("reports.vatAmount")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {renderRow(t("reports.vatSales"), data.sales)}
                      {renderRow(t("reports.vatSalesReturns"), data.salesReturns)}
                      {renderRow(t("reports.vatNetOutput"), data.netOutputVAT, true)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-green-700">{t("reports.vatInputVAT")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 sm:hidden">
                  {[
                    { label: t("reports.vatPurchases"), s: data.purchases },
                    { label: t("reports.vatPurchaseReturns"), s: data.purchaseReturns },
                    { label: t("reports.vatNetInput"), s: data.netInputVAT },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500">{t("reports.vatTaxableAmount")}</p><p className="mt-1 font-mono">{fmt(row.s.taxableAmount)}</p></div>
                        <div><p className="text-xs text-slate-500">{t("reports.vatAmount")}</p><p className="mt-1 font-mono">{fmt(row.s.vatAmount)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>{t("reports.category")}</TableHead><TableHead className="text-right">{t("reports.vatTaxableAmount")}</TableHead><TableHead className="text-right">{t("reports.vatAmount")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {renderRow(t("reports.vatPurchases"), data.purchases)}
                      {renderRow(t("reports.vatPurchaseReturns"), data.purchaseReturns)}
                      {renderRow(t("reports.vatNetInput"), data.netInputVAT, true)}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold">{t("reports.vatNetPayable")}</span>
                <span className={`text-2xl font-bold font-mono ${data.netVATPayable >= 0 ? "text-red-700" : "text-green-700"}`}>
                  {fmt(data.netVATPayable)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {data.netVATPayable >= 0 ? t("reports.vatPayableTax") : t("reports.vatRefundable")}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </ReportPageLayout>
  );
}
