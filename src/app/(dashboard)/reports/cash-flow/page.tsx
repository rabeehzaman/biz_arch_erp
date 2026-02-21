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

interface CashFlowSummary {
  type: string;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

interface AccountBalance {
  name: string;
  balance: number;
  accountSubType: string;
}

interface Reconciliation {
  glCashBalance: number;
  subledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

interface CashFlow {
  fromDate: string;
  toDate: string;
  summary: CashFlowSummary[];
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  accounts: AccountBalance[];
  transactionCount: number;
  reconciliation: Reconciliation;
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

const typeLabels: Record<string, string> = {
  PAYMENT: "Customer Payments",
  SUPPLIER_PAYMENT: "Supplier Payments",
  EXPENSE: "Expenses",
  TRANSFER: "Transfers",
  DEPOSIT: "Deposits",
  WITHDRAWAL: "Withdrawals",
  OPENING_BALANCE: "Opening Balances",
  TRANSFER_IN: "Transfers In",
  TRANSFER_OUT: "Transfers Out",
};

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlow | null>(null);
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
        `/api/reports/cash-flow?fromDate=${fromDate}&toDate=${toDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error("Failed to load cash flow");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Cash Flow</h2>
        <p className="text-slate-500">Cash inflows and outflows</p>
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
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <span className="text-sm text-slate-500">Total Inflow</span>
                <p className="text-2xl font-bold text-green-600 font-mono">{fmt(data.totalInflow)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <span className="text-sm text-slate-500">Total Outflow</span>
                <p className="text-2xl font-bold text-red-600 font-mono">{fmt(data.totalOutflow)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <span className="text-sm text-slate-500">Net Cash Flow</span>
                <p className={`text-2xl font-bold font-mono ${data.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmt(data.netCashFlow)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Inflow</TableHead>
                    <TableHead className="text-right">Outflow</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.summary.map((row) => (
                    <TableRow key={row.type}>
                      <TableCell>{typeLabels[row.type] || row.type}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {row.inflow > 0 ? fmt(row.inflow) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {row.outflow > 0 ? fmt(row.outflow) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${row.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(row.net)}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.accounts.map((a) => (
                    <TableRow key={a.name}>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.accountSubType === "BANK" ? "Bank" : "Cash"}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{fmt(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.reconciliation && (
            <Card className={data.reconciliation.isReconciled ? "border-green-200" : "border-orange-300"}>
              <CardHeader>
                <CardTitle className="text-sm">GL Reconciliation (Cash Accounts 1100/1200)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-slate-500">GL Balance (Journal Entries)</TableCell>
                      <TableCell className="text-right font-mono">{fmt(data.reconciliation.glCashBalance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-slate-500">Sub-ledger Balance (Cash Book)</TableCell>
                      <TableCell className="text-right font-mono">{fmt(data.reconciliation.subledgerBalance)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className={`font-medium ${data.reconciliation.isReconciled ? "text-green-600" : "text-orange-600"}`}>
                        {data.reconciliation.isReconciled ? "✓ Reconciled" : "⚠ Difference"}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${data.reconciliation.isReconciled ? "text-green-600" : "text-orange-600"}`}>
                        {fmt(data.reconciliation.difference)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                {!data.reconciliation.isReconciled && (
                  <p className="text-xs text-orange-600 mt-2">
                    Discrepancy detected. This may be caused by manual journal entries that posted directly to cash accounts (1100/1200) without a corresponding cash book transaction.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <p className="text-center py-8 text-slate-500">No data available</p>
      )}
    </div>
  );
}
