"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, Package, TrendingUp, Clock, CreditCard, GitBranch, Warehouse } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export function DashboardContent() {
  const { stats, isLoading, isError } = useDashboardStats();
  const { data: session } = useSession();
  const multiBranchEnabled = session?.user?.multiBranchEnabled;
  const { t, lang } = useLanguage();

  const formatAmount = (amount: number) => {
    if (lang === "ar") {
      return `${amount.toLocaleString("ar-SA", { minimumFractionDigits: 0 })} ر.س`;
    }
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t("dashboard.title")}</h2>
          <p className="text-slate-500">
            {t("dashboard.overview")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/new">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              {t("sales.newInvoice")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("dashboard.totalInvoices")}
                </CardTitle>
                <FileText className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalInvoices ?? 0}</div>
                <p className="text-xs text-slate-500">
                  {stats?.pendingInvoices ?? 0} {t("dashboard.pending")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("dashboard.totalCustomers")}
                </CardTitle>
                <Users className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalCustomers ?? 0}</div>
                <p className="text-xs text-slate-500">
                  {t("dashboard.activeCustomers")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("dashboard.totalProducts")}
                </CardTitle>
                <Package className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalProducts ?? 0}</div>
                <p className="text-xs text-slate-500">
                  {t("dashboard.inCatalog")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {t("dashboard.totalInvoiced")}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(stats?.totalRevenue ?? 0)}
                </div>
                <p className="text-xs text-slate-500">
                  {formatAmount(stats?.totalCollected ?? 0)} {t("dashboard.collected")}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Multi-Branch Section */}
      {multiBranchEnabled && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <GitBranch className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  {t("dashboard.activeBranches")}
                </p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-10" /> : (stats as any)?.totalBranches ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Warehouse className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  {t("dashboard.activeWarehouses")}
                </p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-10" /> : (stats as any)?.totalWarehouses ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-primary/50 transition-colors">
            <Link href="/reports/stock-summary">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                  <Package className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{t("nav.stockSummary")}</h3>
                  <p className="text-sm text-slate-500">
                    {t("dashboard.viewByWarehouse")}
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/invoices/new">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">{t("sales.newInvoice")}</h3>
                <p className="text-sm text-slate-500">
                  {t("dashboard.createInvoiceDesc")}
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/customers">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {t("dashboard.manageCustomers")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("dashboard.viewEditCustomers")}
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/payments">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {t("dashboard.recordPayment")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("dashboard.recordPaymentDesc")}
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("dashboard.recentInvoices")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : !stats?.recentInvoices?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">
                {t("dashboard.noInvoicesYet")}
              </h3>
              <p className="text-sm text-slate-500">
                {t("dashboard.startByCreating")}
              </p>
              <Link href="/invoices/new" className="mt-4">
                <Button variant="outline">{t("sales.newInvoice")}</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentInvoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-slate-500">{invoice.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatAmount(invoice.total)}</p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(invoice.createdAt), "dd MMM yyyy")}
                    </p>
                  </div>
                </Link>
              ))}
              <Link href="/invoices" className="block">
                <Button variant="outline" className="w-full">
                  {t("common.viewAll")} {t("nav.salesInvoices")}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
