"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { ReportPageLayout } from "@/components/reports/report-page-layout";
import { AsOfDateSelector } from "@/components/reports/as-of-date-selector";
import { ReportExportButton } from "@/components/reports/report-export-button";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";

interface AccountRow {
  account: { id: string; code: string; name: string; accountSubType: string };
  balance: number;
}

interface BalanceSheet {
  asOfDate: string;
  assets: AccountRow[];
  liabilities: AccountRow[];
  equity: AccountRow[];
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

// Group accounts by subtype
function groupBySubType(rows: AccountRow[]) {
  const groups = new Map<string, AccountRow[]>();
  for (const row of rows) {
    const st = row.account.accountSubType || "OTHER";
    if (!groups.has(st)) groups.set(st, []);
    groups.get(st)!.push(row);
  }
  return groups;
}

const subTypeLabelKeys: Record<string, string> = {
  CURRENT_ASSET: "reports.subTypeCurrentAsset",
  FIXED_ASSET: "reports.subTypeFixedAsset",
  BANK: "reports.subTypeBank",
  CASH: "reports.subTypeCash",
  ACCOUNTS_RECEIVABLE: "reports.subTypeAccountsReceivable",
  INVENTORY: "reports.subTypeInventory",
  OTHER_ASSET: "reports.subTypeOtherAssets",
  CURRENT_LIABILITY: "reports.subTypeCurrentLiability",
  LONG_TERM_LIABILITY: "reports.subTypeLongTermLiability",
  ACCOUNTS_PAYABLE: "reports.subTypeAccountsPayable",
  OTHER_LIABILITY: "reports.subTypeOtherLiabilities",
  OWNERS_EQUITY: "reports.subTypeOwnersEquity",
  RETAINED_EARNINGS: "reports.subTypeRetainedEarnings",
  OTHER_EQUITY: "reports.subTypeOtherEquity",
};

function SectionTable({ title, rows, total, color, t, fmt }: {
  title: string;
  rows: AccountRow[];
  total: number;
  color: string;
  t: (key: string) => string;
  fmt: (n: number) => string;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const groups = groupBySubType(rows);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={color}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 sm:hidden">
          {Array.from(groups.entries()).map(([subType, groupRows]) => {
            const groupTotal = groupRows.reduce((sum, r) => sum + r.balance, 0);
            const label = subTypeLabelKeys[subType] ? t(subTypeLabelKeys[subType]) : subType.replace(/_/g, " ");
            const isExpanded = expandedGroups.has(subType);

            return (
              <div key={subType} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => toggleGroup(subType)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <span className="font-semibold text-slate-900">{label}</span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900">{fmt(groupTotal)}</span>
                </button>

                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {groupRows.map((row) => (
                      <Link
                        key={row.account.code}
                        href={`/reports/ledger?accountId=${row.account.id}`}
                        className="block rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                      >
                        <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                        <div className="mt-1 flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">{row.account.name}</p>
                          <span className="font-mono text-sm text-slate-900">{fmt(row.balance)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <p className="font-semibold text-slate-900">{t("reports.totals")} {title}</p>
            <p className="mt-2 font-mono text-lg font-bold text-slate-900">{fmt(total)}</p>
          </div>
        </div>

        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.account")}</TableHead>
                <TableHead className="text-right">{t("reports.balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(groups.entries()).map(([subType, groupRows]) => {
                const groupTotal = groupRows.reduce((sum, r) => sum + r.balance, 0);
                const label = subTypeLabelKeys[subType] ? t(subTypeLabelKeys[subType]) : subType.replace(/_/g, " ");
                const isExpanded = expandedGroups.has(subType);

                return (
                  <React.Fragment key={subType}>
                    <TableRow
                      className="cursor-pointer hover:bg-slate-50 border-b border-t border-slate-100"
                      onClick={() => toggleGroup(subType)}
                    >
                      <TableCell className="font-semibold text-slate-700 flex items-center gap-1">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {label}
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono">{fmt(groupTotal)}</TableCell>
                    </TableRow>
                    {isExpanded &&
                      groupRows.map((row) => (
                        <TableRow key={row.account.code} className="bg-slate-50/50">
                          <TableCell className="pl-8 py-2">
                            <Link
                              href={`/reports/ledger?accountId=${row.account.id}`}
                              className="hover:underline hover:text-blue-600 flex items-center"
                            >
                              <span className="font-mono text-slate-500 mr-2 text-xs">{row.account.code}</span>
                              <span className="text-sm">{row.account.name}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono py-2 text-sm">{fmt(row.balance)}</TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                );
              })}
              <TableRow className="font-bold border-t-2">
                <TableCell>{t("reports.totals")} {title}</TableCell>
                <TableCell className="text-right font-mono">{fmt(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BalanceSheetPage() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [expandedEquityGroups, setExpandedEquityGroups] = useState<Set<string>>(new Set());
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ asOfDate });
      const response = await fetch(`/api/reports/balance-sheet?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error(t("reports.noDataForPeriod"));
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate, t]);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [t("common.code"), t("reports.account"), t("reports.section"), t("reports.balance")];
    const rows = [
      ...data.assets.map((r) => [r.account.code, r.account.name, t("reports.assets"), r.balance.toFixed(2)]),
      ...data.liabilities.map((r) => [r.account.code, r.account.name, t("reports.liabilities"), r.balance.toFixed(2)]),
      ...data.equity.map((r) => [r.account.code, r.account.name, t("reports.equity"), r.balance.toFixed(2)]),
      ["", t("reports.retainedEarnings"), t("reports.equity"), data.retainedEarnings.toFixed(2)],
    ];
    downloadCsv([header, ...rows], `balance-sheet-${asOfDate}.csv`);
  };

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({ asOfDate, lang });
      const response = await fetch(`/api/reports/balance-sheet/pdf?${params}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `balance-sheet-${asOfDate}.pdf`;
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

  const hasData = data && (data.assets.length > 0 || data.liabilities.length > 0 || data.equity.length > 0);

  return (
    <ReportPageLayout
      titleKey="reports.balanceSheet"
      descriptionKey="reports.balanceSheetDesc"
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
        <AsOfDateSelector
          asOfDate={asOfDate}
          onDateChange={setAsOfDate}
          onGenerate={fetchReport}
          isLoading={isLoading}
        />
      }
    >
      {data ? (
        <>
          <div className="flex gap-2 items-center">
            {data.isBalanced ? (
              <Badge className="bg-green-100 text-green-700">{t("reports.assets")} = {t("reports.liabilities")} + {t("reports.equity")}</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700">{t("reports.notBalanced")}</Badge>
            )}
          </div>

          <SectionTable title={t("reports.assets")} rows={data.assets} total={data.totalAssets} color="text-blue-700" t={t} fmt={fmt} />

          <SectionTable title={t("reports.liabilities")} rows={data.liabilities} total={data.totalLiabilities} color="text-red-700" t={t} fmt={fmt} />

          <Card>
            <CardHeader>
              <CardTitle className="text-purple-700">{t("reports.equity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const groups = groupBySubType(data.equity);

                return (
                  <>
                    <div className="space-y-3 sm:hidden">
                      {Array.from(groups.entries()).map(([subType, groupRows]) => {
                        const groupTotal = groupRows.reduce((sum, r) => sum + r.balance, 0);
                        const label = subTypeLabelKeys[subType] ? t(subTypeLabelKeys[subType]) : subType.replace(/_/g, " ");
                        const isExpanded = expandedEquityGroups.has(subType);

                        return (
                          <div key={subType} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 text-left"
                              onClick={() => {
                                setExpandedEquityGroups((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(subType)) next.delete(subType);
                                  else next.add(subType);
                                  return next;
                                });
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                <span className="font-semibold text-slate-900">{label}</span>
                              </div>
                              <span className="font-mono text-sm font-semibold text-slate-900">{fmt(groupTotal)}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                                {groupRows.map((row) => (
                                  <Link
                                    key={row.account.code}
                                    href={`/reports/ledger?accountId=${row.account.id}`}
                                    className="block rounded-xl bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                                  >
                                    <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                                    <div className="mt-1 flex items-start justify-between gap-3">
                                      <p className="text-sm font-medium text-slate-900">{row.account.name}</p>
                                      <span className="font-mono text-sm text-slate-900">{fmt(row.balance)}</span>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.retainedEarnings")}</p>
                        <p className="mt-2 font-mono text-lg font-semibold text-slate-900">{fmt(data.retainedEarnings)}</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
                        <p className="font-semibold text-slate-900">{t("reports.totalEquity")}</p>
                        <p className="mt-2 font-mono text-lg font-bold text-slate-900">{fmt(data.totalEquity)}</p>
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("reports.account")}</TableHead>
                            <TableHead className="text-right">{t("reports.balance")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from(groups.entries()).map(([subType, groupRows]) => {
                            const groupTotal = groupRows.reduce((sum, r) => sum + r.balance, 0);
                            const label = subTypeLabelKeys[subType] ? t(subTypeLabelKeys[subType]) : subType.replace(/_/g, " ");

                            return (
                              <React.Fragment key={subType}>
                                <TableRow className="bg-slate-50 border-b border-t border-slate-100">
                                  <TableCell className="font-semibold text-slate-700">
                                    {label}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold font-mono">{fmt(groupTotal)}</TableCell>
                                </TableRow>
                                {groupRows.map((row) => (
                                  <TableRow key={row.account.code}>
                                    <TableCell className="pl-8 py-2">
                                      <Link
                                        href={`/reports/ledger?accountId=${row.account.id}`}
                                        className="hover:underline hover:text-blue-600 flex items-center"
                                      >
                                        <span className="font-mono text-slate-500 mr-2 text-xs">{row.account.code}</span>
                                        <span className="text-sm">{row.account.name}</span>
                                      </Link>
                                    </TableCell>
                                    <TableCell className="text-right font-mono py-2 text-sm">{fmt(row.balance)}</TableCell>
                                  </TableRow>
                                ))}
                              </React.Fragment>
                            );
                          })}
                          <TableRow>
                            <TableCell className="italic text-slate-600">{t("reports.retainedEarningsComputed")}</TableCell>
                            <TableCell className="text-right font-mono italic">{fmt(data.retainedEarnings)}</TableCell>
                          </TableRow>
                          <TableRow className="font-bold border-t-2">
                            <TableCell>{t("reports.totalEquity")}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(data.totalEquity)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-slate-500">{t("reports.totalAssets")}</span>
                  <p className="text-xl font-bold font-mono">{fmt(data.totalAssets)}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">{t("reports.totalLiabilitiesAndEquity")}</span>
                  <p className="text-xl font-bold font-mono">{fmt(data.totalLiabilitiesAndEquity)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-center py-8 text-slate-500">{t("reports.noDataAvailable")}</p>
      )}
    </ReportPageLayout>
  );
}
