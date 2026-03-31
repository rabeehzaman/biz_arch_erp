"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
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
import { Download, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { useLanguage } from "@/lib/i18n";

interface StatementTransaction {
  id: string;
  date: string;
  type: "OPENING_BALANCE" | "INVOICE" | "PAYMENT" | "CREDIT_NOTE" | "ADJUSTMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface CustomerStatement {
  customer: {
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

const typeBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  OPENING_BALANCE: "secondary",
  INVOICE: "default",
  PAYMENT: "outline",
  CREDIT_NOTE: "outline",
  ADJUSTMENT: "secondary",
};

export function CustomerStatementTab({ customerId }: { customerId: string }) {
  const { t } = useLanguage();

  const typeLabels: Record<string, string> = {
    OPENING_BALANCE: t("statement.typeOpeningBalance"),
    INVOICE: t("statement.typeInvoice"),
    PAYMENT: t("statement.typePayment"),
    CREDIT_NOTE: t("statement.typeCreditNote"),
    ADJUSTMENT: t("statement.typeAdjustment"),
  };

  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    fetchStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const fetchStatement = async () => {
    setIsLoading(true);
    try {
      let url = `/api/customers/${customerId}/statement`;
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
      let url = `/api/customers/${customerId}/statement/pdf`;
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
      link.download = `statement-${statement?.customer.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
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

  const { fmt } = useCurrency();
  const formatCurrency = (amount: number) => fmt(Math.abs(amount));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <TableSkeleton columns={6} rows={5} />
        </CardContent>
      </Card>
    );
  }

  if (!statement) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold">{t("statement.notFound")}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleDownloadPDF} disabled={isDownloading} size="sm">
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t("common.downloadPDF")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              {t("statement.openingBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-bold sm:text-2xl ${statement.openingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(statement.openingBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              {t("statement.totalReceivable")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-red-600 sm:text-2xl">
              {formatCurrency(statement.totalDebits)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              {t("statement.totalReceived")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-600 sm:text-2xl">
              {formatCurrency(statement.totalCredits)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              {t("statement.closingBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-bold sm:text-2xl ${statement.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>{t("statement.transactions")}</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="fromDate" className="text-sm">{t("common.from")}</Label>
                <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full sm:w-40" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="toDate" className="text-sm">{t("common.to")}</Label>
                <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full sm:w-40" />
              </div>
              <Button variant="outline" onClick={() => fetchStatement()} className="w-full sm:w-auto">
                {t("common.filter")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {statement.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">{t("statement.noTransactions")}</h3>
              <p className="text-sm text-slate-500">
                {fromDate || toDate ? t("statement.adjustDateFilter") : t("statement.noCustomerTransactions")}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile view */}
              <div className="space-y-3 sm:hidden">
                {statement.transactions.map((txn) => (
                  <div key={txn.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{format(new Date(txn.date), "dd MMM yyyy")}</p>
                        <Badge variant={typeBadgeVariant[txn.type]}>{typeLabels[txn.type]}</Badge>
                      </div>
                      <p className={`text-right text-sm font-semibold ${txn.runningBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(txn.runningBalance)}
                        <span className="ml-1 text-xs">{txn.runningBalance >= 0 ? "Dr" : "Cr"}</span>
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="break-all font-mono text-xs text-slate-500">{txn.reference}</p>
                      <p className="text-sm text-slate-600">{txn.description}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-rose-50 px-3 py-2">
                        <p className="text-xs text-slate-500">{t("statement.receivable")}</p>
                        <p className="font-semibold text-red-600">{txn.debit > 0 ? formatCurrency(txn.debit) : "-"}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-2">
                        <p className="text-xs text-slate-500">{t("statement.received")}</p>
                        <p className="font-semibold text-green-600">{txn.credit > 0 ? formatCurrency(txn.credit) : "-"}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">{t("statement.receivable")}</p>
                      <p className="font-semibold text-red-600">{formatCurrency(statement.totalDebits)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t("statement.received")}</p>
                      <p className="font-semibold text-green-600">{formatCurrency(statement.totalCredits)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{t("common.balance")}</p>
                      <p className={`font-semibold ${statement.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(statement.closingBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop view */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("common.type")}</TableHead>
                      <TableHead>{t("common.reference")}</TableHead>
                      <TableHead>{t("common.description")}</TableHead>
                      <TableHead className="text-right">{t("statement.receivable")}</TableHead>
                      <TableHead className="text-right">{t("statement.received")}</TableHead>
                      <TableHead className="text-right">{t("common.balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>{format(new Date(txn.date), "dd MMM yyyy")}</TableCell>
                        <TableCell><Badge variant={typeBadgeVariant[txn.type]}>{typeLabels[txn.type]}</Badge></TableCell>
                        <TableCell className="font-mono">{txn.reference}</TableCell>
                        <TableCell>{txn.description}</TableCell>
                        <TableCell className="text-right text-red-600">{txn.debit > 0 ? formatCurrency(txn.debit) : "-"}</TableCell>
                        <TableCell className="text-right text-green-600">{txn.credit > 0 ? formatCurrency(txn.credit) : "-"}</TableCell>
                        <TableCell className={`text-right font-medium ${txn.runningBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(txn.runningBalance)}
                          <span className="text-xs ml-1">{txn.runningBalance >= 0 ? "Dr" : "Cr"}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell colSpan={4} className="text-right">{t("common.totals")}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(statement.totalDebits)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(statement.totalCredits)}</TableCell>
                      <TableCell className={`text-right ${statement.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(statement.closingBalance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-sm text-slate-400">
        {t("statement.generatedOn")} {format(new Date(statement.generatedAt), "dd MMM yyyy, hh:mm a")}
      </div>
    </div>
  );
}
