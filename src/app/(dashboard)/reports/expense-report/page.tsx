"use client";

import { useState, useEffect } from "react";
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
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

interface CategoryRow {
  account: { code: string; name: string };
  total: number;
  count: number;
}

interface SupplierRow {
  name: string;
  total: number;
  count: number;
}

interface ExpenseRow {
  id: string;
  expenseNumber: string;
  status: string;
  expenseDate: string;
  description: string | null;
  total: number;
  supplier: string | null;
}

interface ExpenseReport {
  fromDate: string;
  toDate: string;
  byCategory: CategoryRow[];
  bySupplier: SupplierRow[];
  totalExpenses: number;
  expenseCount: number;
  expenses: ExpenseRow[];
}

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
};

export default function ExpenseReportPage() {
  const [data, setData] = useState<ExpenseReport | null>(null);
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
        `/api/reports/expense-report?fromDate=${fromDate}&toDate=${toDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      setData(await response.json());
    } catch {
      toast.error("Failed to load expense report");
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
            <h2 className="text-2xl font-bold text-slate-900">Expense Report</h2>
            <p className="text-slate-500">Expenses by category and supplier</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-slate-500">Total Expenses</span>
                      <p className="text-2xl font-bold text-red-600 font-mono">{fmt(data.totalExpenses)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-slate-500">Number of Expenses</span>
                      <p className="text-2xl font-bold">{data.expenseCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>By Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:hidden">
                      {data.byCategory.map((row) => (
                        <div key={row.account.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="font-mono text-xs text-slate-500">{row.account.code}</p>
                          <p className="mt-1 font-semibold text-slate-900">{row.account.name}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
                              <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(row.total)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Items</p>
                              <p className="mt-1 font-medium text-slate-900">{row.count}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.byCategory.map((row) => (
                            <TableRow key={row.account.code}>
                              <TableCell>
                                <span className="font-mono text-slate-500 mr-2">{row.account.code}</span>
                                {row.account.name}
                              </TableCell>
                              <TableCell className="text-right font-mono">{fmt(row.total)}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>By Supplier</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:hidden">
                      {data.bySupplier.map((row) => (
                        <div key={row.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
                              <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(row.total)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Count</p>
                              <p className="mt-1 font-medium text-slate-900">{row.count}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.bySupplier.map((row) => (
                            <TableRow key={row.name}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(row.total)}</TableCell>
                              <TableCell className="text-right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>All Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:hidden">
                    {data.expenses.map((exp) => (
                      <div key={exp.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{exp.expenseNumber}</p>
                            <p className="mt-1 text-sm text-slate-500">{format(new Date(exp.expenseDate), "dd MMM yyyy")}</p>
                          </div>
                          <Badge className={statusColors[exp.status] || ""}>{exp.status}</Badge>
                        </div>

                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>{exp.description || "-"}</p>
                          <p>Supplier: {exp.supplier || "-"}</p>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
                          <p className="mt-1 font-mono font-semibold text-slate-900">{fmt(exp.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expenses.map((exp) => (
                          <TableRow key={exp.id}>
                            <TableCell className="font-medium">{exp.expenseNumber}</TableCell>
                            <TableCell>{format(new Date(exp.expenseDate), "dd MMM yyyy")}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{exp.description || "-"}</TableCell>
                            <TableCell>{exp.supplier || "-"}</TableCell>
                            <TableCell>
                              <Badge className={statusColors[exp.status] || ""}>{exp.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmt(exp.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
