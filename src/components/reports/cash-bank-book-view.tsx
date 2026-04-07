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
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { downloadBlob } from "@/lib/download";
import { firstOfMonth, lastOfMonth } from "@/lib/date-utils";
import { ReportPageLayout } from "./report-page-layout";
import { DateRangePresetSelector } from "./date-range-preset-selector";
import { ReportExportButton } from "./report-export-button";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "./branch-filter-select";

interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  accountName: string;
  accountId: string;
}

interface BookData {
  openingBalance: number;
  closingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  transactions: Transaction[];
  accounts: { id: string; name: string }[];
}

const TYPE_KEYS: Record<string, string> = {
  DEPOSIT: "reports.deposit",
  WITHDRAWAL: "reports.withdrawal",
  TRANSFER_IN: "reports.transferIn",
  TRANSFER_OUT: "reports.transferOut",
  OPENING_BALANCE: "reports.openingBalance",
};

interface CashBankBookViewProps {
  bookType: "cash" | "bank";
}

export function CashBankBookView({ bookType }: CashBankBookViewProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const { branches, filterBranchId, setFilterBranchId, multiBranchEnabled, branchParam } = useBranchFilter();
  const searchParams = useSearchParams();
  const initialAccountId = searchParams.get("accountId") || "";

  const [data, setData] = useState<BookData | null>(null);
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(lastOfMonth());
  const [accountId, setAccountId] = useState(initialAccountId);
  const [isLoading, setIsLoading] = useState(false);

  const apiPath = bookType === "cash" ? "cash-book" : "bank-book";
  const titleKey = bookType === "cash" ? "reports.cashBook" : "reports.bankBook";
  const descKey =
    bookType === "cash" ? "reports.cashBookDesc" : "reports.bankBookDesc";

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate });
      if (accountId && accountId !== "all") params.set("accountId", accountId);
      if (branchParam) params.set("branchId", branchParam);
      const response = await fetch(`/api/reports/${apiPath}?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, accountId, branchParam, apiPath, t]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [
      t("reports.date"),
      t("reports.type"),
      t("reports.description"),
      t("reports.account"),
      t("reports.cashIn"),
      t("reports.cashOut"),
      t("reports.runningBalance"),
    ];
    const rows = data.transactions.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      t(TYPE_KEYS[tx.type] || tx.type),
      tx.description,
      tx.accountName,
      tx.cashIn.toFixed(2),
      tx.cashOut.toFixed(2),
      tx.runningBalance.toFixed(2),
    ]);
    const filename = `${bookType}-book-${fromDate}-to-${toDate}.csv`;
    downloadCsv([header, ...rows], filename);
  };

  const handlePrint = () => window.print();

  const [isDownloading, setIsDownloading] = useState(false);
  const { lang } = useLanguage();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, lang });
      if (accountId && accountId !== "all") params.set("accountId", accountId);
      const response = await fetch(`/api/reports/${apiPath}/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      await downloadBlob(blob, `${bookType}-book-${fromDate}-to-${toDate}.pdf`);
    } catch {
      toast.error(t("reports.pdfDownloadError"));
    } finally {
      setIsDownloading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <ReportPageLayout
      titleKey={titleKey}
      descriptionKey={descKey}
      isLoading={isLoading}
      actions={
        <ReportExportButton
          onExportCsv={handleExportCsv}
          onPrint={handlePrint}
          onDownloadPdf={handleDownloadPdf}
          isDownloading={isDownloading}
          disabled={!data || data.transactions.length === 0}
        />
      }
      filterBar={
        <div className="flex flex-col gap-4">
          <DateRangePresetSelector
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            onGenerate={fetchReport}
            isLoading={isLoading}
          />
          {data && data.accounts.length > 1 && (
            <div className="grid gap-2 sm:max-w-[250px]">
              <Label className="text-xs text-slate-500">{t("reports.account")}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.allAccounts")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("reports.allAccounts")}</SelectItem>
                  {data.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <BranchFilterSelect branches={branches} filterBranchId={filterBranchId} onBranchChange={setFilterBranchId} multiBranchEnabled={multiBranchEnabled} />
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
                    <p className="text-sm text-slate-500">{t("reports.openingBalance")}</p>
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
                  <div className="rounded-lg bg-green-50 p-2">
                    <ArrowDownLeft className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{t("reports.cashIn")}</p>
                    <p className="text-xl font-bold font-mono text-green-600">
                      {fmt(data.totalCashIn)}
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
                    <p className="text-sm text-slate-500">{t("reports.cashOut")}</p>
                    <p className="text-xl font-bold font-mono text-red-600">
                      {fmt(data.totalCashOut)}
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
                    <p className="text-sm text-slate-500">{t("reports.closingBalance")}</p>
                    <p className="text-xl font-bold font-mono text-blue-600">
                      {fmt(data.closingBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.transactions.length === 0 ? (
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
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">
                          {formatDate(tx.date)}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {t(TYPE_KEYS[tx.type] || tx.type)}
                        </span>
                      </div>
                      {tx.description && (
                        <p className="mt-1 text-sm text-slate-500">{tx.description}</p>
                      )}
                      {data.accounts.length > 1 && (
                        <p className="mt-1 text-xs text-slate-400">{tx.accountName}</p>
                      )}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("reports.cashIn")}
                          </p>
                          <p className="mt-1 font-mono font-medium text-green-600">
                            {tx.cashIn > 0 ? fmt(tx.cashIn) : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("reports.cashOut")}
                          </p>
                          <p className="mt-1 font-mono font-medium text-red-600">
                            {tx.cashOut > 0 ? fmt(tx.cashOut) : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("reports.runningBalance")}
                          </p>
                          <p className="mt-1 font-mono font-semibold text-slate-900">
                            {fmt(tx.runningBalance)}
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
                        <TableHead>{t("reports.type")}</TableHead>
                        <TableHead>{t("reports.description")}</TableHead>
                        {data.accounts.length > 1 && (
                          <TableHead>{t("reports.account")}</TableHead>
                        )}
                        <TableHead className="text-right">
                          {t("reports.cashIn")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.cashOut")}
                        </TableHead>
                        <TableHead className="text-right">
                          {t("reports.runningBalance")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              {t(TYPE_KEYS[tx.type] || tx.type)}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {tx.description || "-"}
                          </TableCell>
                          {data.accounts.length > 1 && (
                            <TableCell>{tx.accountName}</TableCell>
                          )}
                          <TableCell className="text-right font-mono text-green-600">
                            {tx.cashIn > 0 ? fmt(tx.cashIn) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {tx.cashOut > 0 ? fmt(tx.cashOut) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {fmt(tx.runningBalance)}
                          </TableCell>
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
