"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Receipt, DollarSign, FileText } from "lucide-react";
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

interface GSTDetailRow {
  id: string;
  docType: "INVOICE" | "CREDIT_NOTE" | "PURCHASE" | "DEBIT_NOTE";
  docNumber: string;
  date: string;
  partyName: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

interface GSTDetailData {
  rows: GSTDetailRow[];
  totalTaxableOutput: number;
  totalGSTOutput: number;
  totalTaxableInput: number;
  totalGSTInput: number;
  netGSTLiability: number;
}

const DOC_TYPE_KEYS: Record<string, string> = {
  INVOICE: "reports.vatDocInvoice",
  CREDIT_NOTE: "reports.vatDocCreditNote",
  PURCHASE: "reports.vatDocPurchase",
  DEBIT_NOTE: "reports.vatDocDebitNote",
};

function gstTotal(r: GSTDetailRow) {
  return r.cgst + r.sgst + r.igst;
}

export default function GSTDetailPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { config } = useEdition();

  if (config.taxSystem !== "GST") {
    return (
      <PageAnimation>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">{t("reports.gstDetail")}</h2>
          <p className="mt-2 text-slate-500">{t("reports.taxReportNotAvailable")}</p>
        </div>
      </PageAnimation>
    );
  }

  return <GSTDetailContent />;
}

function GSTDetailContent() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [data, setData] = useState<GSTDetailData | null>(null);
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/gst-detail?${params}`);
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
      t("reports.date"), t("reports.type"), t("reports.vatDocNumber"),
      t("reports.vatParty"), t("reports.vatTaxableAmount"),
      t("reports.gstCGST"), t("reports.gstSGST"), t("reports.gstIGST"),
      t("reports.totals"),
    ];
    const rows = data.rows.map((r) => [
      new Date(r.date).toLocaleDateString(),
      t(DOC_TYPE_KEYS[r.docType] || r.docType),
      r.docNumber,
      r.partyName,
      r.subtotal.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.igst.toFixed(2),
      r.total.toFixed(2),
    ]);
    downloadCsv([header, ...rows], `gst-detail-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate, lang });
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/gst-detail/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      await downloadBlob(blob, `gst-detail-${fromDate}-to-${toDate}.pdf`);
    } catch {
      toast.error(t("reports.pdfDownloadError"));
    } finally {
      setIsDownloading(false);
    }
  };

  const isNegDoc = (dt: string) => dt === "CREDIT_NOTE" || dt === "DEBIT_NOTE";

  return (
    <ReportPageLayout
      titleKey="reports.gstDetail"
      descriptionKey="reports.gstDetailDesc"
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2"><Receipt className="h-5 w-5 text-red-600" /></div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.gstOutputGST")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">{fmt(data.totalGSTOutput)}</p>
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
                    <p className="text-xl font-bold font-mono text-green-600">{fmt(data.totalGSTInput)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${data.netGSTLiability >= 0 ? "bg-red-50" : "bg-green-50"}`}>
                    <DollarSign className={`h-5 w-5 ${data.netGSTLiability >= 0 ? "text-red-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.gstNetLiability")}</p>
                    <p className={`text-xl font-bold font-mono ${data.netGSTLiability >= 0 ? "text-red-600" : "text-green-600"}`}>{fmt(data.netGSTLiability)}</p>
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-6">
                {/* Mobile cards */}
                <div className="space-y-3 p-4 sm:hidden">
                  {data.rows.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">{new Date(r.date).toLocaleDateString()}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isNegDoc(r.docType) ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                          {t(DOC_TYPE_KEYS[r.docType] || r.docType)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{r.docNumber}</p>
                      <p className="text-sm text-slate-500">{r.partyName}</p>
                      <div className="mt-3 grid grid-cols-5 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.vatTaxableAmount")}</p>
                          <p className={`mt-1 font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.subtotal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.gstCGST")}</p>
                          <p className={`mt-1 font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.cgst)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.gstSGST")}</p>
                          <p className={`mt-1 font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.sgst)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.gstIGST")}</p>
                          <p className={`mt-1 font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.igst)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.totals")}</p>
                          <p className={`mt-1 font-mono font-semibold ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.total)}</p>
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
                        <TableHead>{t("reports.date")}</TableHead>
                        <TableHead>{t("reports.type")}</TableHead>
                        <TableHead>{t("reports.vatDocNumber")}</TableHead>
                        <TableHead>{t("reports.vatParty")}</TableHead>
                        <TableHead className="text-right">{t("reports.vatTaxableAmount")}</TableHead>
                        <TableHead className="text-right">{t("reports.gstCGST")}</TableHead>
                        <TableHead className="text-right">{t("reports.gstSGST")}</TableHead>
                        <TableHead className="text-right">{t("reports.gstIGST")}</TableHead>
                        <TableHead className="text-right">{t("reports.totals")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isNegDoc(r.docType) ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                              {t(DOC_TYPE_KEYS[r.docType] || r.docType)}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono">{r.docNumber}</TableCell>
                          <TableCell>{r.partyName}</TableCell>
                          <TableCell className={`text-right font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.subtotal)}</TableCell>
                          <TableCell className={`text-right font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.cgst)}</TableCell>
                          <TableCell className={`text-right font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.sgst)}</TableCell>
                          <TableCell className={`text-right font-mono ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.igst)}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${isNegDoc(r.docType) ? "text-red-600" : ""}`}>{fmt(r.total)}</TableCell>
                        </TableRow>
                      ))}
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
