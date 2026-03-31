"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { AsOfDateSelector } from "@/components/reports/as-of-date-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}

interface CustomerRow {
  customerId: string;
  customerName: string;
  buckets: AgingBuckets;
}

interface ARAgingData {
  customers: CustomerRow[];
  totals: AgingBuckets;
}

export default function ARAgingPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<ARAgingData | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ asOfDate });
      const response = await fetch(`/api/reports/ar-aging?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch { toast.error(t("reports.noDataForPeriod")); }
    finally { setIsLoading(false); }
  }, [asOfDate, t]);

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [t("reports.customerName"), t("reports.agingCurrent"), "1-30", "31-60", "61-90", "90+", t("reports.totals")];
    const rows = data.customers.map((c) => [
      c.customerName, c.buckets.current.toFixed(2), c.buckets.days1to30.toFixed(2),
      c.buckets.days31to60.toFixed(2), c.buckets.days61to90.toFixed(2),
      c.buckets.over90.toFixed(2), c.buckets.total.toFixed(2),
    ]);
    rows.push([t("reports.totals"), data.totals.current.toFixed(2), data.totals.days1to30.toFixed(2),
      data.totals.days31to60.toFixed(2), data.totals.days61to90.toFixed(2),
      data.totals.over90.toFixed(2), data.totals.total.toFixed(2)]);
    downloadCsv([header, ...rows], `ar-aging-${asOfDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ asOfDate, lang });
      const response = await fetch(`/api/reports/ar-aging/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ar-aging-${asOfDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { toast.error(t("reports.pdfDownloadError")); }
    finally { setIsDownloading(false); }
  };

  return (
    <ReportPageLayout
      titleKey="reports.arAging"
      descriptionKey="reports.arAgingDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!data || data.customers.length === 0}
        />
      }
      filterBar={
        <AsOfDateSelector
          asOfDate={asOfDate}
          onDateChange={setAsOfDate}
          onGenerate={fetchReport}
          isLoading={isLoading}
        />
      }
    >
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: t("reports.agingCurrent"), value: data.totals.current, color: "text-green-600", bg: "bg-green-50" },
              { label: "1-30 " + t("reports.days"), value: data.totals.days1to30, color: "text-yellow-600", bg: "bg-yellow-50" },
              { label: "31-60 " + t("reports.days"), value: data.totals.days31to60, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "61-90 " + t("reports.days"), value: data.totals.days61to90, color: "text-red-500", bg: "bg-red-50" },
              { label: "90+ " + t("reports.days"), value: data.totals.over90, color: "text-red-700", bg: "bg-red-50" },
              { label: t("reports.totals"), value: data.totals.total, color: "text-slate-900", bg: "bg-slate-100" },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">{card.label}</p>
                  <p className={`text-lg font-bold font-mono ${card.color}`}>{fmt(card.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.customers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("reports.noTransactions")}</h3>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-6">
                <div className="space-y-3 p-4 sm:hidden">
                  {data.customers.map((c) => (
                    <div key={c.customerId} onClick={() => router.push(`/customers/${c.customerId}?tab=statement`)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-muted/50">
                      <p className="font-semibold text-slate-900">{c.customerName}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div><p className="text-xs text-slate-500">{t("reports.agingCurrent")}</p><p className="mt-1 font-mono text-green-600">{fmt(c.buckets.current)}</p></div>
                        <div><p className="text-xs text-slate-500">1-30</p><p className="mt-1 font-mono text-yellow-600">{fmt(c.buckets.days1to30)}</p></div>
                        <div><p className="text-xs text-slate-500">31-60</p><p className="mt-1 font-mono text-orange-600">{fmt(c.buckets.days31to60)}</p></div>
                        <div><p className="text-xs text-slate-500">61-90</p><p className="mt-1 font-mono text-red-500">{fmt(c.buckets.days61to90)}</p></div>
                        <div><p className="text-xs text-slate-500">90+</p><p className="mt-1 font-mono text-red-700">{fmt(c.buckets.over90)}</p></div>
                        <div><p className="text-xs text-slate-500">{t("reports.totals")}</p><p className="mt-1 font-mono font-semibold">{fmt(c.buckets.total)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.customerName")}</TableHead>
                        <TableHead className="text-right">{t("reports.agingCurrent")}</TableHead>
                        <TableHead className="text-right">1-30</TableHead>
                        <TableHead className="text-right">31-60</TableHead>
                        <TableHead className="text-right">61-90</TableHead>
                        <TableHead className="text-right">90+</TableHead>
                        <TableHead className="text-right">{t("reports.totals")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customers.map((c) => (
                        <TableRow key={c.customerId} onClick={() => router.push(`/customers/${c.customerId}?tab=statement`)} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">{c.customerName}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">{c.buckets.current > 0 ? fmt(c.buckets.current) : "-"}</TableCell>
                          <TableCell className="text-right font-mono text-yellow-600">{c.buckets.days1to30 > 0 ? fmt(c.buckets.days1to30) : "-"}</TableCell>
                          <TableCell className="text-right font-mono text-orange-600">{c.buckets.days31to60 > 0 ? fmt(c.buckets.days31to60) : "-"}</TableCell>
                          <TableCell className="text-right font-mono text-red-500">{c.buckets.days61to90 > 0 ? fmt(c.buckets.days61to90) : "-"}</TableCell>
                          <TableCell className="text-right font-mono text-red-700">{c.buckets.over90 > 0 ? fmt(c.buckets.over90) : "-"}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(c.buckets.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>{t("reports.totals")}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.current)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.days1to30)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.days31to60)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.days61to90)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(data.totals.over90)}</TableCell>
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
