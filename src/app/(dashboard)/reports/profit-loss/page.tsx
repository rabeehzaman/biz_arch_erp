"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface AccountRow {
  account: { code: string; name: string };
  amount: number;
}

interface ProfitLoss {
  fromDate: string;
  toDate: string;
  revenue: AccountRow[];
  expenses: AccountRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function ProfitLossPage() {
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  );
  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/profit-loss?fromDate=${fromDate}&toDate=${toDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error("Failed to load P&L");
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
            <h2 className="text-2xl font-bold text-slate-900">Profit & Loss</h2>
            <p className="text-slate-500">Income statement for a period</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="grid gap-2">
                  <Label>From</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>To</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-700">Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.revenue.map((row) => (
                        <TableRow key={row.account.code}>
                          <TableCell>
                            <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                            {row.account.name}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">{fmt(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total Revenue</TableCell>
                        <TableCell className="text-right font-mono text-green-700">{fmt(data.totalRevenue)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-700">Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.expenses.map((row) => (
                        <TableRow key={row.account.code}>
                          <TableCell>
                            <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                            {row.account.name}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">{fmt(row.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total Expenses</TableCell>
                        <TableCell className="text-right font-mono text-red-700">{fmt(data.totalExpenses)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold">Net Income</span>
                    <span className={`text-2xl font-bold font-mono ${data.netIncome >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {data.netIncome >= 0 ? "" : "-"}{fmt(Math.abs(data.netIncome))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">No data available</p>
          )}
        </div>
        </PageAnimation>
      );
}
