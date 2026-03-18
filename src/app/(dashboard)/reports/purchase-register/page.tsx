"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface PurchaseRegisterRow {
  id: string;
  invoiceNumber: string;
  date: string;
  supplierName: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
}

interface PurchaseRegisterData {
  rows: PurchaseRegisterRow[];
  totals: {
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
  };
  invoiceCount: number;
}

const statusColorClass = (status: string): string => {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700";
    case "PARTIAL":
      return "bg-yellow-100 text-yellow-700";
    case "UNPAID":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function PurchaseRegisterPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<PurchaseRegisterData | null>(null);
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
      const response = await fetch(`/api/reports/purchase-register?${params}`);
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

  const statusLabel = (status: string): string => {
    switch (status) {
      case "PAID":
        return t("reports.paid") || "Paid";
      case "PARTIAL":
        return t("reports.partial") || "Partial";
      case "UNPAID":
        return t("reports.unpaid") || "Unpaid";
      default:
        return status;
    }
  };

  const handleExportCsv = () => {
    if (!data) return;
    const header = [
      t("reports.date") || "Date",
      t("reports.invoiceNumber") || "Invoice #",
      t("reports.supplier") || "Supplier",
      t("reports.subtotal") || "Subtotal",
      t("reports.tax") || "Tax",
      t("reports.totals") || "Total",
      t("reports.paid") || "Paid",
      t("reports.balance") || "Balance",
      t("common.status") || "Status",
    ];
    const rows = data.rows.map((r) => [
      new Date(r.date).toLocaleDateString(),
      r.invoiceNumber,
      r.supplierName,
      r.subtotal.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
      r.amountPaid.toFixed(2),
      r.balanceDue.toFixed(2),
      statusLabel(r.status),
    ]);
    const totalsRow = [
      t("reports.totals") || "Totals",
      `${data.invoiceCount} invoices`,
      "",
      data.totals.subtotal.toFixed(2),
      data.totals.tax.toFixed(2),
      data.totals.total.toFixed(2),
      data.totals.amountPaid.toFixed(2),
      data.totals.balanceDue.toFixed(2),
      "",
    ];
    downloadCsv([header, ...rows, totalsRow], `purchase-register-${fromDate}-to-${toDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      const response = await fetch(`/api/reports/purchase-register/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase-register-${fromDate}-to-${toDate}.pdf`;
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
      titleKey="reports.purchaseRegister"
      descriptionKey="reports.purchaseRegisterDesc"
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
                    <DollarSign className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.totalPurchases") || "Total Purchases"}</p>
                    <p className="text-xl font-bold font-mono text-red-600">
                      {fmt(data.totals.total)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.invoiceCount} {t("reports.invoiceNumber") || "invoices"}
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
                    <p className="text-sm text-slate-500">{t("reports.paid") || "Paid"}</p>
                    <p className="text-xl font-bold font-mono text-blue-600">
                      {fmt(data.totals.amountPaid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-50 p-2">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.outstanding") || "Outstanding"}</p>
                    <p className="text-xl font-bold font-mono text-orange-600">
                      {fmt(data.totals.balanceDue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.rows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("reports.noTransactions") || "No invoices found"}</h3>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-6">
                {/* Mobile cards */}
                <div className="space-y-3 p-4 sm:hidden">
                  {data.rows.map((r) => (
                    <div key={r.id} onClick={() => router.push(`/purchase-invoices/${r.id}`)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(r.date).toLocaleDateString()}
                        </p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColorClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{r.invoiceNumber}</p>
                      <p className="text-sm text-slate-500">{r.supplierName}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.totals") || "Total"}</p>
                          <p className="mt-1 font-mono font-semibold">{fmt(r.total)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.paid") || "Paid"}</p>
                          <p className="mt-1 font-mono text-blue-600">{fmt(r.amountPaid)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">{t("reports.balance") || "Balance"}</p>
                          <p className={`mt-1 font-mono ${r.balanceDue > 0 ? "text-red-600" : ""}`}>
                            {fmt(r.balanceDue)}
                          </p>
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
                        <TableHead>{t("reports.date") || "Date"}</TableHead>
                        <TableHead>{t("reports.invoiceNumber") || "Invoice #"}</TableHead>
                        <TableHead>{t("reports.supplier") || "Supplier"}</TableHead>
                        <TableHead className="text-right">{t("reports.subtotal") || "Subtotal"}</TableHead>
                        <TableHead className="text-right">{t("reports.tax") || "Tax"}</TableHead>
                        <TableHead className="text-right">{t("reports.totals") || "Total"}</TableHead>
                        <TableHead className="text-right">{t("reports.paid") || "Paid"}</TableHead>
                        <TableHead className="text-right">{t("reports.balance") || "Balance"}</TableHead>
                        <TableHead>{t("common.status") || "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.id} onClick={() => router.push(`/purchase-invoices/${r.id}`)} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            {new Date(r.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-mono">{r.invoiceNumber}</TableCell>
                          <TableCell>{r.supplierName}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.subtotal)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(r.tax)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(r.total)}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600">{fmt(r.amountPaid)}</TableCell>
                          <TableCell className={`text-right font-mono ${r.balanceDue > 0 ? "text-red-600" : ""}`}>
                            {fmt(r.balanceDue)}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColorClass(r.status)}`}>
                              {statusLabel(r.status)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="border-t-2 bg-slate-50 font-bold">
                        <TableCell className="font-bold" colSpan={3}>
                          {t("reports.totals") || "Totals"} ({data.invoiceCount})
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(data.totals.subtotal)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(data.totals.tax)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(data.totals.total)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-blue-600">{fmt(data.totals.amountPaid)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-red-600">{fmt(data.totals.balanceDue)}</TableCell>
                        <TableCell>{""}</TableCell>
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
