"use client";

import { useState, useEffect } from "react";
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
import Link from "next/link";
import { TableSkeleton } from "@/components/table-skeleton";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";

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
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { fmt: formatCurrency } = useCurrency();

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/reports/supplier-balances");
      if (!response.ok) throw new Error("Failed to fetch report");
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSuppliers = reportData?.suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Supplier Balances</h2>
          <p className="text-slate-500">View outstanding supplier balances (Accounts Payable)</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton columns={6} rows={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Supplier Balances</h2>
            <p className="text-slate-500">View outstanding supplier balances (Accounts Payable)</p>
          </div>

          {reportData && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    Total Suppliers
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
                    Active Suppliers
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
                    Total Payable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(reportData.summary.totalPayable)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    With Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {reportData.summary.suppliersWithBalance}
                  </div>
                  <p className="text-xs text-slate-500">suppliers owed money</p>
                </CardContent>
              </Card>
              {reportData.reconciliation && (
                <Card className={reportData.reconciliation.isReconciled ? "border-green-200" : "border-orange-300"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1">
                      {reportData.reconciliation.isReconciled
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <AlertTriangle className="h-4 w-4 text-orange-500" />}
                      AP Reconciliation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-sm font-bold ${reportData.reconciliation.isReconciled ? 'text-green-600' : 'text-orange-600'}`}>
                      {reportData.reconciliation.isReconciled ? "Reconciled" : `Off by ${formatCurrency(Math.abs(reportData.reconciliation.difference))}`}
                    </div>
                    <p className="text-xs text-slate-500">GL: {formatCurrency(reportData.reconciliation.glBalance)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle>Balance Details</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search suppliers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!filteredSuppliers || filteredSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Truck className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">No suppliers found</h3>
                  <p className="text-sm text-slate-500">
                    {searchTerm
                      ? "Try adjusting your search"
                      : "No suppliers have been added yet"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {filteredSuppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/suppliers/${supplier.id}/statement`}
                              className="font-semibold text-blue-600 hover:underline"
                            >
                              {supplier.name}
                            </Link>
                            <div className="mt-1 space-y-1 text-sm text-slate-500">
                              {supplier.email && <p className="break-all">{supplier.email}</p>}
                              <p>{supplier.phone || "No phone number"}</p>
                            </div>
                          </div>
                          <Badge variant={supplier.isActive ? "default" : "secondary"}>
                            {supplier.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Balance</p>
                            <p
                              className={`mt-1 font-semibold ${
                                supplier.balance > 0 ? "text-red-600" : "text-slate-900"
                              }`}
                            >
                              {formatCurrency(supplier.balance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Invoices</p>
                            <p className="mt-1 font-medium text-slate-900">{supplier.invoiceCount}</p>
                          </div>
                        </div>

                        <Link
                          href={`/suppliers/${supplier.id}/statement`}
                          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          View statement
                        </Link>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="text-right">Invoices</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSuppliers.map((supplier) => (
                            <TableRow key={supplier.id}>
                              <TableCell className="font-medium">
                                <Link
                                  href={`/suppliers/${supplier.id}/statement`}
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
                                {formatCurrency(supplier.balance)}
                              </TableCell>
                              <TableCell className="text-right">
                                {supplier.invoiceCount}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={supplier.isActive ? "default" : "secondary"}
                                >
                                  {supplier.isActive ? "Active" : "Inactive"}
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
        </div>
        </PageAnimation>
      );
}
