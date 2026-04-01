"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Truck, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  invoiceCount: number;
  isActive: boolean;
}

interface Summary {
  totalSuppliers: number;
  activeSuppliers: number;
  totalPayable: number;
  suppliersWithBalance: number;
}

interface Reconciliation {
  glBalance: number;
  ledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

interface ReportData {
  suppliers: Supplier[];
  summary: Summary;
  reconciliation: Reconciliation;
}

export default function SupplierBalancesPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/supplier-balances?${params}`);
      if (!response.ok) throw new Error("Failed to fetch report");
      setReportData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [t, branchParam]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredSuppliers = reportData?.suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.includes(searchTerm)
  );

  const handleExportCsv = () => {
    if (!reportData) return;
    const header = [t("common.name"), t("common.email"), t("common.phone"), t("reports.balance"), t("reports.invoiceNumber"), t("common.status")];
    const rows = reportData.suppliers.map((s) => [
      s.name,
      s.email || "",
      s.phone || "",
      s.balance.toFixed(2),
      String(s.invoiceCount),
      s.isActive ? t("common.active") : t("common.inactive"),
    ]);
    downloadCsv([header, ...rows], `supplier-balances.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ lang });
      const response = await fetch(`/api/reports/supplier-balances/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supplier-balances.pdf`;
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
      titleKey="reports.supplierBalances"
      descriptionKey="reports.supplierBalancesDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!reportData || reportData.suppliers.length === 0}
        />
      }
      filterBar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t("reports.searchSuppliers")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <BranchFilterSelect
            branches={branches}
            filterBranchId={filterBranchId}
            onBranchChange={setFilterBranchId}
            multiBranchEnabled={multiBranchEnabled}
          />
        </div>
      }
    >
      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.totalSuppliers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.summary.totalSuppliers}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.activeSuppliers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {reportData.summary.activeSuppliers}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.totalPayable")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {fmt(reportData.summary.totalPayable)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("reports.withBalance")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {reportData.summary.suppliersWithBalance}
                </div>
                <p className="text-xs text-slate-500">{t("reports.suppliersOwedMoney")}</p>
              </CardContent>
            </Card>
            {reportData.reconciliation && (
              <Card className={reportData.reconciliation.isReconciled ? "border-green-200" : "border-orange-300"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1">
                    {reportData.reconciliation.isReconciled
                      ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <AlertTriangle className="h-4 w-4 text-orange-500" />}
                    {t("reports.apReconciliation")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-sm font-bold ${reportData.reconciliation.isReconciled ? 'text-green-600' : 'text-orange-600'}`}>
                    {reportData.reconciliation.isReconciled ? t("reports.reconciled") : `${t("reports.offBy")} ${fmt(Math.abs(reportData.reconciliation.difference))}`}
                  </div>
                  <p className="text-xs text-slate-500">GL: {fmt(reportData.reconciliation.glBalance)}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Balance Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.balanceDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!filteredSuppliers || filteredSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Truck className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("reports.noSuppliersFound")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchTerm
                      ? t("reports.tryAdjustingSearch")
                      : t("reports.noSuppliersAdded")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 sm:hidden">
                    {filteredSuppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/suppliers/${supplier.id}?tab=statement`}
                              className="font-semibold text-blue-600 hover:underline"
                            >
                              {supplier.name}
                            </Link>
                            <div className="mt-1 space-y-1 text-sm text-slate-500">
                              {supplier.email && <p className="break-all">{supplier.email}</p>}
                              <p>{supplier.phone || t("reports.noPhoneNumber")}</p>
                            </div>
                          </div>
                          <Badge variant={supplier.isActive ? "default" : "secondary"}>
                            {supplier.isActive ? t("common.active") : t("common.inactive")}
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.balance")}</p>
                            <p
                              className={`mt-1 font-semibold ${
                                supplier.balance > 0 ? "text-red-600" : "text-slate-900"
                              }`}
                            >
                              {fmt(supplier.balance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.invoiceNumber")}</p>
                            <p className="mt-1 font-medium text-slate-900">{supplier.invoiceCount}</p>
                          </div>
                        </div>

                        <Link
                          href={`/suppliers/${supplier.id}?tab=statement`}
                          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          {t("reports.viewStatement")}
                        </Link>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead>{t("common.email")}</TableHead>
                            <TableHead>{t("common.phone")}</TableHead>
                            <TableHead className="text-right">{t("reports.balance")}</TableHead>
                            <TableHead className="text-right">{t("reports.invoiceNumber")}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSuppliers.map((supplier) => (
                            <TableRow key={supplier.id}>
                              <TableCell className="font-medium">
                                <Link
                                  href={`/suppliers/${supplier.id}?tab=statement`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {supplier.name}
                                </Link>
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {supplier.email || "-"}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {supplier.phone || "-"}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${
                                  supplier.balance > 0 ? "text-red-600" : "text-slate-900"
                                }`}
                              >
                                {fmt(supplier.balance)}
                              </TableCell>
                              <TableCell className="text-right">
                                {supplier.invoiceCount}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={supplier.isActive ? "default" : "secondary"}
                                >
                                  {supplier.isActive ? t("common.active") : t("common.inactive")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
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
