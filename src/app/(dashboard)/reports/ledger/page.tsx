"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { DateRangePresetSelector } from "@/components/reports/date-range-preset-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";

interface LedgerTransaction {
  id: string;
  date: string;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerData {
  entityName: string;
  entityType: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  transactions: LedgerTransaction[];
}

interface EntityOption {
  id: string;
  name: string;
  code?: string;
}

export default function UnifiedLedgerPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("accountId");
  const initialCustomerId = searchParams.get("customerId");
  const initialSupplierId = searchParams.get("supplierId");

  // Determine initial entity type from query params
  const getInitialType = () => {
    if (initialAccountId) return "ACCOUNT";
    if (initialCustomerId) return "CUSTOMER";
    if (initialSupplierId) return "SUPPLIER";
    return "";
  };
  const getInitialId = () =>
    initialAccountId || initialCustomerId || initialSupplierId || "";

  const [entityType, setEntityType] = useState<string>(getInitialType());
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    getInitialId()
  );
  const [data, setData] = useState<LedgerData | null>(null);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Fetch entity list when type changes
  useEffect(() => {
    if (!entityType) {
      setEntities([]);
      setSelectedEntityId("");
      return;
    }

    const fetchEntities = async () => {
      setIsLoadingEntities(true);
      try {
        let url = "";
        if (entityType === "ACCOUNT") url = "/api/accounts";
        else if (entityType === "CUSTOMER") url = "/api/customers";
        else if (entityType === "SUPPLIER") url = "/api/suppliers";

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");
        const list = await res.json();
        setEntities(list);
      } catch {
        toast.error(t("reports.noDataForPeriod"));
      } finally {
        setIsLoadingEntities(false);
      }
    };

    fetchEntities();
  }, [entityType, t]);

  const fetchLedger = useCallback(async () => {
    if (!entityType || !selectedEntityId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: entityType,
        id: selectedEntityId,
        fromDate,
        toDate,
      });
      const res = await fetch(`/api/reports/ledger?${params}`);
      if (!res.ok) throw new Error("Failed to load ledger");
      setData(await res.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [entityType, selectedEntityId, fromDate, toDate, t]);

  // Auto-load when coming from deep link
  useEffect(() => {
    if (getInitialId()) {
      fetchLedger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [
      t("reports.date"),
      t("reports.reference"),
      t("reports.description"),
      t("reports.debit"),
      t("reports.credit"),
      t("reports.balance"),
    ];
    const rows = data.transactions.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.ref,
      tx.description,
      tx.debit.toFixed(2),
      tx.credit.toFixed(2),
      tx.balance.toFixed(2),
    ]);
    rows.push([
      t("reports.totals"),
      "",
      "",
      data.totalDebit.toFixed(2),
      data.totalCredit.toFixed(2),
      data.closingBalance.toFixed(2),
    ]);
    const entityName = data.entityName.replace(/[^a-zA-Z0-9-_ ]/g, "");
    downloadCsv(
      [header, ...rows],
      `ledger-${entityName}-${fromDate}-to-${toDate}.csv`
    );
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!data) return;
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({
        type: entityType,
        id: selectedEntityId,
        fromDate,
        toDate,
        lang,
      });
      const response = await fetch(`/api/reports/ledger/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const entityName = data.entityName.replace(/[^a-zA-Z0-9-_ ]/g, "");
      a.download = `ledger-${entityName}-${fromDate}-to-${toDate}.pdf`;
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const hasData = data && data.transactions.length > 0;

  return (
    <ReportPageLayout
      titleKey="reports.unifiedLedger"
      descriptionKey="reports.ledgerDesc"
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!hasData}
        />
      }
      filterBar={
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label className="text-xs text-slate-500">
                {t("reports.ledgerType")}
              </Label>
              <Select
                value={entityType}
                onValueChange={(val) => {
                  setEntityType(val);
                  setSelectedEntityId("");
                  setData(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCOUNT">
                    {t("reports.generalAccount")}
                  </SelectItem>
                  <SelectItem value="CUSTOMER">
                    {t("reports.customerLedger")}
                  </SelectItem>
                  <SelectItem value="SUPPLIER">
                    {t("reports.supplierLedger")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-slate-500">
                {t("reports.entity")}
              </Label>
              <Select
                value={selectedEntityId}
                onValueChange={setSelectedEntityId}
                disabled={!entityType || isLoadingEntities}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingEntities
                        ? t("common.loading")
                        : t("reports.selectEntity")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {entityType === "ACCOUNT" && e.code
                        ? `${e.code} - ${e.name}`
                        : e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DateRangePresetSelector
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onGenerate={fetchLedger}
            isLoading={isLoading}
          />
        </div>
      }
    >
      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <Wallet className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {t("reports.openingBalance")}
                    </p>
                    <p className="text-xl font-bold font-mono text-slate-900">
                      {fmt(data.openingBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2">
                    <ArrowUpRight className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {t("reports.totalDebit")}
                    </p>
                    <p className="text-xl font-bold font-mono text-red-600">
                      {fmt(data.totalDebit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <ArrowDownLeft className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {t("reports.totalCredit")}
                    </p>
                    <p className="text-xl font-bold font-mono text-green-600">
                      {fmt(data.totalCredit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">
                      {t("reports.closingBalance")}
                    </p>
                    <p className="text-xl font-bold font-mono text-blue-600">
                      {fmt(data.closingBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Entity Name Banner */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="font-semibold text-slate-900">
                    {data.entityName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {data.transactions.length} {t("reports.ledgerEntries")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {data.transactions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  {t("reports.noTransactions")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("reports.noTransactionsDesc")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-6">
                {/* Mobile cards */}
                <div className="space-y-3 p-4 sm:hidden">
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {tx.ref}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(tx.date)}
                          </p>
                        </div>
                        <p className="font-mono text-sm font-semibold text-slate-900">
                          {fmt(tx.balance)}
                        </p>
                      </div>
                      {tx.description && (
                        <p className="mt-2 text-sm text-slate-600">
                          {tx.description}
                        </p>
                      )}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("reports.debit")}
                          </p>
                          <p className="mt-1 font-mono font-medium text-red-600">
                            {tx.debit > 0 ? fmt(tx.debit) : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("reports.credit")}
                          </p>
                          <p className="mt-1 font-mono font-medium text-green-600">
                            {tx.credit > 0 ? fmt(tx.credit) : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("reports.balance")}
                          </p>
                          <p className="mt-1 font-mono font-semibold text-slate-900">
                            {fmt(tx.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("reports.date")}</TableHead>
                        <TableHead>{t("reports.reference")}</TableHead>
                        <TableHead>{t("reports.description")}</TableHead>
                        <TableHead className="text-right">
                          {t("reports.debit")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.credit")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.balance")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {tx.ref}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {tx.description || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {tx.debit > 0 ? fmt(tx.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {tx.credit > 0 ? fmt(tx.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {fmt(tx.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-slate-50 font-bold">
                        <TableCell colSpan={3}>
                          {t("reports.totals")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {fmt(data.totalDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {fmt(data.totalCredit)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(data.closingBalance)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!isLoading && !data && entityType && selectedEntityId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold">
              {t("reports.noTransactions")}
            </h3>
            <p className="text-sm text-slate-500">
              {t("reports.noTransactionsDesc")}
            </p>
          </CardContent>
        </Card>
      )}

      {!entityType && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold">
              {t("reports.selectLedger")}
            </h3>
            <p className="text-sm text-slate-500">
              {t("reports.selectLedgerDesc")}
            </p>
          </CardContent>
        </Card>
      )}
    </ReportPageLayout>
  );
}
