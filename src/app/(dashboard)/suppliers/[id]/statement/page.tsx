"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";

interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "PURCHASE_INVOICE" | "PAYMENT" | "DEBIT_NOTE" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface SupplierStatement {
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  openingBalance: number;
  transactions: StatementTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  generatedAt: string;
}

const typeLabels: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  PURCHASE_INVOICE: "Purchase Invoice",
  PAYMENT: "Payment",
  DEBIT_NOTE: "Debit Note",
  ADJUSTMENT: "Adjustment",
};

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  OPENING_BALANCE: "secondary",
  PURCHASE_INVOICE: "default",
  PAYMENT: "outline",
  DEBIT_NOTE: "outline",
  ADJUSTMENT: "secondary",
};

export default function SupplierStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    fetchStatement();
  }, [id]);

  const fetchStatement = async () => {
    setIsLoading(true);
    try {
      let url = `/api/suppliers/${id}/statement`;
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch statement");
      const data = await response.json();
      setStatement(data);
    } catch (error) {
      console.error("Failed to fetch statement:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      let url = `/api/suppliers/${id}/statement/pdf`;
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `statement-${statement?.supplier.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to download PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFilter = () => {
    fetchStatement();
  };

  const formatCurrency = (amount: number) => {
    return `₹${Math.abs(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Supplier Statement
            </h2>
            <p className="text-slate-500">Loading statement...</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton columns={6} rows={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Supplier Statement
            </h2>
            <p className="text-slate-500">Statement not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Supplier Statement
            </h2>
            <p className="text-slate-500">{statement.supplier.name}</p>
          </div>
        </div>
        <Button onClick={handleDownloadPDF} disabled={isDownloading}>
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download PDF
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Opening Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${statement.openingBalance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(statement.openingBalance)}
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
              {formatCurrency(statement.totalDebits)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(statement.totalCredits)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Closing Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${statement.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(statement.closingBalance)}
              <span className="text-sm ml-1">
                {statement.closingBalance >= 0 ? "Dr" : "Cr"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="fromDate" className="text-sm">
                  From
                </Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="toDate" className="text-sm">
                  To
                </Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button variant="outline" onClick={handleFilter}>
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statement.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">
                No transactions found
              </h3>
              <p className="text-sm text-slate-500">
                {fromDate || toDate
                  ? "Try adjusting the date filter"
                  : "This supplier has no transactions yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Payable</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      {format(new Date(txn.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant[txn.type]}>
                        {typeLabels[txn.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{txn.reference}</TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell className="text-right text-red-600">
                      {txn.debit > 0 ? formatCurrency(txn.debit) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {txn.credit > 0 ? formatCurrency(txn.credit) : "-"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${txn.runningBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(txn.runningBalance)}
                      <span className="text-xs ml-1">
                        {txn.runningBalance >= 0 ? "Dr" : "Cr"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-medium">
                  <TableCell colSpan={4} className="text-right">
                    Totals
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(statement.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(statement.totalCredits)}
                  </TableCell>
                  <TableCell
                    className={`text-right ${statement.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(statement.closingBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-sm text-slate-400">
        Statement generated on{" "}
        {format(new Date(statement.generatedAt), "dd MMM yyyy, hh:mm a")}
      </div>
    </div>
  );
}
