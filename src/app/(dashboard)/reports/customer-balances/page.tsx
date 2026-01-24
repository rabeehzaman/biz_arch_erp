"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Users, Search } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  balance: number;
  invoiceCount: number;
  isActive: boolean;
}

interface Summary {
  totalCustomers: number;
  activeCustomers: number;
  totalReceivable: number;
  totalAdvances: number;
  netBalance: number;
  customersWithBalance: number;
  customersWithAdvances: number;
}

interface ReportData {
  customers: Customer[];
  summary: Summary;
}

export default function CustomerBalancesPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/reports/customer-balances");
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

  const filteredCustomers = reportData?.customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Customer Balances</h2>
          <p className="text-slate-500">View customer balances - positive amounts are receivables (owed to you), negative amounts in green are advances (paid in advance)</p>
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
        <h2 className="text-2xl font-bold text-slate-900">Customer Balances</h2>
        <p className="text-slate-500">View customer balances - positive amounts are receivables (owed to you), negative amounts in green are advances (paid in advance)</p>
      </div>

      {reportData && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reportData.summary.totalCustomers}
              </div>
              <p className="text-xs text-slate-500">{reportData.summary.activeCustomers} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total Receivable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(reportData.summary.totalReceivable)}
              </div>
              <p className="text-xs text-slate-500">{reportData.summary.customersWithBalance} customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Total Advances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(reportData.summary.totalAdvances)}
              </div>
              <p className="text-xs text-slate-500">{reportData.summary.customersWithAdvances} customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                Net Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${reportData.summary.netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(reportData.summary.netBalance)}
              </div>
              <p className="text-xs text-slate-500">total outstanding</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Balance Details</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredCustomers || filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No customers found</h3>
              <p className="text-sm text-slate-500">
                {searchTerm
                  ? "Try adjusting your search"
                  : "No customers have been added yet"}
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
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Link
                          href={`/customers/${customer.id}/statement`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {customer.email || "-"}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {customer.phone || "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          customer.balance > 0
                            ? "text-red-600"
                            : customer.balance < 0
                            ? "text-green-600"
                            : "text-slate-900"
                        }`}
                      >
                        {customer.balance < 0
                          ? `(${formatCurrency(Math.abs(customer.balance))})`
                          : formatCurrency(customer.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.invoiceCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={customer.isActive ? "default" : "secondary"}
                        >
                          {customer.isActive ? "Active" : "Inactive"}
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
