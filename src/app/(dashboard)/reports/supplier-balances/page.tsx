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

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
