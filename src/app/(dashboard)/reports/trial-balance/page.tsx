"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

interface AccountRow {
  account: { code: string; name: string; accountType: string };
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalance {
  asOfDate: string;
  accounts: AccountRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalance | null>(null);
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/trial-balance?asOfDate=${asOfDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error("Failed to load trial balance");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // Initial report load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Trial Balance</h2>
            <p className="text-slate-500">Summary of all account balances</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="grid gap-2">
                  <Label>As of Date</Label>
                  <Input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>
                <Button onClick={fetchReport} className="mt-6">
                  Generate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : !data || data.accounts.length === 0 ? (
                <p className="text-center py-8 text-slate-500">
                  No journal entries found for this period
                </p>
              ) : (
                <>
                  {data.isBalanced ? (
                    <Badge className="mb-4 bg-green-100 text-green-700">Balanced</Badge>
                  ) : (
                    <Badge className="mb-4 bg-red-100 text-red-700">Unbalanced</Badge>
                  )}
                  <div className="space-y-3 sm:hidden">
                    {data.accounts.map((row) => (
                      <div key={row.account.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                            <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                          </div>
                          <Badge variant="outline">{row.account.accountType}</Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Debit</p>
                            <p className="mt-1 font-mono font-medium text-slate-900">
                              {row.debit > 0 ? fmt(row.debit) : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Credit</p>
                            <p className="mt-1 font-mono font-medium text-slate-900">
                              {row.credit > 0 ? fmt(row.credit) : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4">
                      <p className="font-semibold text-slate-900">Totals</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Debit</p>
                          <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(data.totalDebit)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Credit</p>
                          <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(data.totalCredit)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.accounts.map((row) => (
                          <TableRow key={row.account.code}>
                            <TableCell className="font-mono">
                              {row.account.code}
                            </TableCell>
                            <TableCell>{row.account.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.account.accountType}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.debit > 0 ? fmt(row.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.credit > 0 ? fmt(row.credit) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={3} className="text-right">
                            Totals
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(data.totalDebit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmt(data.totalCredit)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        </PageAnimation>
      );
}
