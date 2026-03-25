"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import {
  ArrowUpRight,
  CreditCard,
  FileText,
  GitBranch,
  Package,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { useDashboardStats, type DashboardStats } from "@/hooks/use-dashboard";
import { getLocale, useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

type ExtendedDashboardStats = DashboardStats & {
  totalBranches?: number;
  totalWarehouses?: number;
};

function StatCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full min-h-[8.5rem] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-12 w-12 rounded-[1.25rem]" />
        </div>
      </CardContent>
    </Card>
  );
}

function getStatValueClass(value: string | number) {
  const length = String(value).trim().length;

  if (length >= 13) {
    return "text-[clamp(1.55rem,6.4vw,2.45rem)]";
  }

  if (length >= 10) {
    return "text-[clamp(1.8rem,6vw,2.75rem)]";
  }

  return "text-[clamp(2rem,6vw,3rem)]";
}

export function DashboardContent() {
  const { stats, isLoading, isError } = useDashboardStats();
  const { data: session } = useSession();
  const multiBranchEnabled = session?.user?.multiBranchEnabled;
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();
  const dashboardStats = stats as ExtendedDashboardStats | undefined;
  const today = new Intl.DateTimeFormat(getLocale(lang), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  if (isError) {
    return (
      <div className="glass-panel flex min-h-72 items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">{t("common.loading")}</p>
          <p className="mt-2 text-sm text-slate-500">{t("dashboard.overview")}</p>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      title: t("dashboard.totalInvoices"),
      value: dashboardStats?.totalInvoices ?? 0,
      subtitle: `${dashboardStats?.pendingInvoices ?? 0} ${t("dashboard.pending")}`,
      icon: FileText,
      iconClass: "bg-sky-50 text-sky-700",
    },
    {
      title: t("dashboard.totalCustomers"),
      value: dashboardStats?.totalCustomers ?? 0,
      subtitle: t("dashboard.activeCustomers"),
      icon: Users,
      iconClass: "bg-emerald-50 text-emerald-700",
    },
    {
      title: t("dashboard.totalProducts"),
      value: dashboardStats?.totalProducts ?? 0,
      subtitle: t("dashboard.inCatalog"),
      icon: Package,
      iconClass: "bg-amber-50 text-amber-700",
    },
    {
      title: t("dashboard.totalInvoiced"),
      value: fmt(dashboardStats?.totalRevenue ?? 0),
      subtitle: `${fmt(dashboardStats?.totalCollected ?? 0)} ${t("dashboard.collected")}`,
      icon: TrendingUp,
      iconClass: "bg-blue-50 text-blue-700",
    },
  ];

  return (
    <StaggerContainer className="space-y-4">
      <StaggerItem>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="section-chip md:hidden">{today}</span>
            <h2 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              {t("dashboard.title")}
            </h2>
            <p className="max-w-2xl text-sm text-slate-600">
              {t("dashboard.overview")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/invoices/new" className="block">
              <Button className="w-full">
                <FileText className="h-4 w-4" />
                {t("sales.newInvoice")}
              </Button>
            </Link>
            <Link href="/customers" className="block">
              <Button variant="outline" className="w-full">
                <Users className="h-4 w-4" />
                {t("dashboard.manageCustomers")}
              </Button>
            </Link>
            <Link href="/payments" className="block">
              <Button variant="outline" className="w-full">
                <CreditCard className="h-4 w-4" />
                {t("dashboard.recordPayment")}
              </Button>
            </Link>
          </div>
        </div>
      </StaggerItem>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          statsCards.map((item) => (
            <StaggerItem key={item.title} className="h-full">
              <Card className="h-full">
                <CardContent className="flex h-full min-h-[8.5rem] flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {item.title}
                      </p>
                      <p
                        className={cn(
                          "mt-3 max-w-full font-semibold leading-[0.95] tracking-tight text-slate-900 [overflow-wrap:anywhere]",
                          getStatValueClass(item.value)
                        )}
                      >
                        {item.value}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{item.subtitle}</p>
                    </div>
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 ${item.iconClass}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))
        )}
      </div>

      {multiBranchEnabled && (
        <div className="grid gap-4 lg:grid-cols-3">
          <StaggerItem>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <GitBranch className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t("dashboard.activeBranches")}</p>
                  <div className="mt-1 text-3xl font-semibold text-slate-900">
                    {isLoading ? <Skeleton className="h-9 w-12" /> : dashboardStats?.totalBranches ?? 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Warehouse className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t("dashboard.activeWarehouses")}</p>
                  <div className="mt-1 text-3xl font-semibold text-slate-900">
                    {isLoading ? <Skeleton className="h-9 w-12" /> : dashboardStats?.totalWarehouses ?? 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Link href="/reports/stock-summary" className="block h-full">
              <Card className="h-full transition-colors hover:border-slate-300 hover:bg-white">
                <CardContent className="flex h-full items-center gap-4 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{t("nav.stockSummary")}</h3>
                    <p className="mt-1 text-sm text-slate-500">{t("dashboard.viewByWarehouse")}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        </div>
      )}

      <StaggerItem>
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-slate-900">{t("dashboard.recentInvoices")}</CardTitle>
                {!isLoading && !dashboardStats?.recentInvoices?.length && (
                  <p className="mt-1 text-sm text-slate-500">{t("dashboard.startByCreating")}</p>
                )}
              </div>
              <Link href="/invoices">
                <Button variant="outline">
                  <ArrowUpRight className="h-4 w-4" />
                  {t("common.viewAll")}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-[1.2rem]" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !dashboardStats?.recentInvoices?.length ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FileText className="h-8 w-8" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">
                  {t("dashboard.noInvoicesYet")}
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  {t("dashboard.startByCreating")}
                </p>
                <Link href="/invoices/new" className="mt-5">
                  <Button>{t("sales.newInvoice")}</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardStats.recentInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{invoice.invoiceNumber}</p>
                        <p className="truncate text-sm text-slate-500">{invoice.customerName}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-slate-900">{fmt(invoice.total)}</p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(invoice.createdAt), "dd MMM yyyy")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
