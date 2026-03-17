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
import { Users, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";

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

interface Reconciliation {
  glBalance: number;
  ledgerBalance: number;
  difference: number;
  isReconciled: boolean;
}

interface ReportData {
  customers: Customer[];
  summary: Summary;
  reconciliation: Reconciliation;
}

export default function CustomerBalancesPage() {
  const { t } = useLanguage();
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
          <h2 className="text-2xl font-bold text-slate-900">{t("reports.customerBalances")}</h2>
          <p className="text-slate-500">{t("reports.customerBalancesDesc")}</p>
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
            <h2 className="text-2xl font-bold text-slate-900">{t("reports.customerBalances")}</h2>
            <p className="text-slate-500">{t("reports.customerBalancesDesc")}</p>
          </div>

          {reportData && (
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    {t("reports.totalCustomers")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reportData.summary.totalCustomers}
                  </div>
                  <p className="text-xs text-slate-500">{reportData.summary.activeCustomers} {t("common.active").toLowerCase()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    {t("reports.totalReceivable")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(reportData.summary.totalReceivable)}
                  </div>
                  <p className="text-xs text-slate-500">{reportData.summary.customersWithBalance} {t("reports.totalCustomers").toLowerCase()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    {t("reports.totalAdvances")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(reportData.summary.totalAdvances)}
                  </div>
                  <p className="text-xs text-slate-500">{reportData.summary.customersWithAdvances} {t("reports.totalCustomers").toLowerCase()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">
                    {t("reports.netBalance")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${reportData.summary.netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(reportData.summary.netBalance)}
                  </div>
                  <p className="text-xs text-slate-500">{t("reports.outstanding").toLowerCase()}</p>
                </CardContent>
              </Card>
              {reportData.reconciliation && (
                <Card className={reportData.reconciliation.isReconciled ? "border-green-200" : "border-orange-300"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-1">
                      {reportData.reconciliation.isReconciled
                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                        : <AlertTriangle className="h-4 w-4 text-orange-500" />}
                      {t("reports.arReconciliation")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-sm font-bold ${reportData.reconciliation.isReconciled ? 'text-green-600' : 'text-orange-600'}`}>
                      {reportData.reconciliation.isReconciled ? t("reports.reconciled") : `${t("reports.offBy")} ${formatCurrency(Math.abs(reportData.reconciliation.difference))}`}
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
                <CardTitle>{t("reports.balanceDetails")}</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={t("reports.searchCustomers")}
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
                  <h3 className="mt-4 text-lg font-semibold">{t("reports.noCustomersFound")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchTerm
                      ? t("reports.tryAdjustingSearch")
                      : t("reports.noCustomersAdded")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/customers/${customer.id}/statement`}
                              className="font-semibold text-blue-600 hover:underline"
                            >
                              {customer.name}
                            </Link>
                            <div className="mt-1 space-y-1 text-sm text-slate-500">
                              {customer.email && <p className="break-all">{customer.email}</p>}
                              <p>{customer.phone || t("reports.noPhoneNumber")}</p>
                            </div>
                          </div>
                          <Badge variant={customer.isActive ? "default" : "secondary"}>
                            {customer.isActive ? t("common.active") : t("common.inactive")}
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.balance")}</p>
                            <p
                              className={`mt-1 font-semibold ${
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
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.invoiceNumber")}</p>
                            <p className="mt-1 font-medium text-slate-900">{customer.invoiceCount}</p>
                          </div>
                        </div>

                        <Link
                          href={`/customers/${customer.id}/statement`}
                          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          {t("reports.viewStatement")}
                        </Link>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead>{t("common.email")}</TableHead>
                            <TableHead>{t("common.phone")}</TableHead>
                            <TableHead className="text-right">{t("reports.balance")}</TableHead>
                            <TableHead className="text-right">{t("reports.invoiceNumber")}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
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
                                  {customer.isActive ? t("common.active") : t("common.inactive")}
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
