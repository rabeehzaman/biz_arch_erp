"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageAnimation } from "@/components/ui/page-animation";

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

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

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

const subTypeLabels: Record<string, string> = {
  CURRENT_ASSET: "Current Assets",
  FIXED_ASSET: "Fixed Assets",
  BANK: "Bank Accounts",
  CASH: "Cash",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  INVENTORY: "Inventory",
  OTHER_ASSET: "Other Assets",
  CURRENT_LIABILITY: "Current Liabilities",
  LONG_TERM_LIABILITY: "Long-Term Liabilities",
  ACCOUNTS_PAYABLE: "Accounts Payable",
  OTHER_LIABILITY: "Other Liabilities",
  OWNERS_EQUITY: "Owner's Equity",
  RETAINED_EARNINGS: "Retained Earnings",
  OTHER_EQUITY: "Other Equity",
};

function SectionTable({ title, rows, total, color }: {
  title: string;
  rows: AccountRow[];
  total: number;
  color: string;
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(groups.entries()).map(([subType, groupRows]) => {
              const groupTotal = groupRows.reduce((sum, r) => sum + r.balance, 0);
              const label = subTypeLabels[subType] || subType.replace(/_/g, " ");
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
              <TableCell>Total {title}</TableCell>
              <TableCell className="text-right font-mono">{fmt(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/balance-sheet?asOfDate=${asOfDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error("Failed to load balance sheet");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Balance Sheet</h2>
          <p className="text-slate-500">Financial position as of a date</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="grid gap-2">
                <Label>As of Date</Label>
                <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
              </div>
              <Button onClick={fetchReport} className="mt-6">Generate</Button>
            </div>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <>
            <div className="flex gap-2 items-center">
              {data.isBalanced ? (
                <Badge className="bg-green-100 text-green-700">Assets = Liabilities + Equity</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700">Not Balanced</Badge>
              )}
            </div>

            <SectionTable title="Assets" rows={data.assets} total={data.totalAssets} color="text-blue-700" />

            <SectionTable title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} color="text-red-700" />

            <Card>
              <CardHeader>
                <CardTitle className="text-purple-700">Equity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const groups = groupBySubType(data.equity);
                      return Array.from(groups.entries()).map(([subType, groupRows]) => {
                        const groupTotal = groupRows.reduce((sum, r) => sum + r.balance, 0);
                        const label = subTypeLabels[subType] || subType.replace(/_/g, " ");

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
                      });
                    })()}
                    <TableRow>
                      <TableCell className="italic text-slate-600">Retained Earnings (computed)</TableCell>
                      <TableCell className="text-right font-mono italic">{fmt(data.retainedEarnings)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Equity</TableCell>
                      <TableCell className="text-right font-mono">{fmt(data.totalEquity)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-slate-500">Total Assets</span>
                    <p className="text-xl font-bold font-mono">{fmt(data.totalAssets)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Total Liabilities + Equity</span>
                    <p className="text-xl font-bold font-mono">{fmt(data.totalLiabilitiesAndEquity)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-center py-8 text-slate-500">No data available</p>
        )}
      </div>
    </PageAnimation>
  );
}
