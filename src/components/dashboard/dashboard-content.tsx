"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import {
  Activity,
  ArrowUpRight,
  Clock,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { useDashboardStats, type DashboardStats } from "@/hooks/use-dashboard";
import { getLocale, useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

type ExtendedDashboardStats = DashboardStats & {
  totalBranches?: number;
  totalWarehouses?: number;
};

function StatCardSkeleton() {
  return (
    <Card className="mesh-card border-white/70">
      <CardContent className="p-5">
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
      iconClass:
        "bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(37,99,235,0.14))] text-sky-700",
    },
    {
      title: t("dashboard.totalCustomers"),
      value: dashboardStats?.totalCustomers ?? 0,
      subtitle: t("dashboard.activeCustomers"),
      icon: Users,
      iconClass:
        "bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(45,212,191,0.14))] text-emerald-700",
    },
    {
      title: t("dashboard.totalProducts"),
      value: dashboardStats?.totalProducts ?? 0,
      subtitle: t("dashboard.inCatalog"),
      icon: Package,
      iconClass:
        "bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(251,191,36,0.14))] text-amber-700",
    },
    {
      title: t("dashboard.totalInvoiced"),
      value: fmt(dashboardStats?.totalRevenue ?? 0),
      subtitle: `${fmt(dashboardStats?.totalCollected ?? 0)} ${t("dashboard.collected")}`,
      icon: TrendingUp,
      iconClass:
        "bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(99,102,241,0.14))] text-blue-700",
    },
  ];

  return (
    <StaggerContainer className="space-y-6">
      <StaggerItem>
        <Card className="mesh-card relative overflow-hidden border-white/70">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.14),transparent_22%),radial-gradient(circle_at_70%_88%,rgba(16,185,129,0.12),transparent_18%)]"
          />
          <CardContent className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:p-7">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="section-chip">{today}</span>
                <Badge variant="secondary">{t("dashboard.overview")}</Badge>
              </div>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  <span className="gradient-heading">{t("dashboard.title")}</span>
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                  {t("dashboard.overview")}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/invoices/new">
                  <Button size="lg">
                    <FileText className="h-4 w-4" />
                    {t("sales.newInvoice")}
                  </Button>
                </Link>
                <Link href="/invoices">
                  <Button size="lg" variant="outline">
                    <ArrowUpRight className="h-4 w-4" />
                    {t("common.viewAll")} {t("nav.salesInvoices")}
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="surface-pill">
                  <Activity className="h-3.5 w-3.5" />
                  {t("dashboard.recentInvoices")}
                </span>
                <span className="surface-pill">
                  <Users className="h-3.5 w-3.5" />
                  {t("dashboard.activeCustomers")}
                </span>
                <span className="surface-pill">
                  <Package className="h-3.5 w-3.5" />
                  {t("dashboard.inCatalog")}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/70 bg-white/74 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t("dashboard.totalInvoiced")}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {fmt(dashboardStats?.totalRevenue ?? 0)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {fmt(dashboardStats?.totalCollected ?? 0)} {t("dashboard.collected")}
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/70 bg-[linear-gradient(135deg,rgba(14,165,233,0.92),rgba(16,185,129,0.88))] p-4 text-white shadow-[0_22px_40px_-26px_rgba(14,165,233,0.7)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                  {t("dashboard.totalInvoices")}
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {dashboardStats?.totalInvoices ?? 0}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  {dashboardStats?.pendingInvoices ?? 0} {t("dashboard.pending")}
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/70 bg-white/74 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t("dashboard.totalCustomers")}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {dashboardStats?.totalCustomers ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">{t("dashboard.activeCustomers")}</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/70 bg-white/74 p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t("dashboard.totalProducts")}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {dashboardStats?.totalProducts ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">{t("dashboard.inCatalog")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
            <StaggerItem key={item.title}>
              <Card className="mesh-card border-white/70">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {item.title}
                      </p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{item.value}</p>
                      <p className="mt-2 text-sm text-slate-500">{item.subtitle}</p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-[1.25rem] ${item.iconClass}`}>
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
            <Card className="mesh-card border-white/70">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(99,102,241,0.14))] text-indigo-700">
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
            <Card className="mesh-card border-white/70">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(16,185,129,0.14))] text-sky-700">
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
              <Card className="mesh-card h-full border-white/70 transition-transform hover:-translate-y-0.5">
                <CardContent className="flex h-full items-center gap-4 p-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(251,191,36,0.14))] text-amber-700">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StaggerItem>
          <Link href="/invoices/new" className="block h-full">
            <Card className="mesh-card h-full border-white/70 transition-transform hover:-translate-y-0.5">
              <CardContent className="flex h-full items-center gap-4 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(14,165,233,0.14))] text-sky-700">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{t("sales.newInvoice")}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t("dashboard.createInvoiceDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Link href="/customers" className="block h-full">
            <Card className="mesh-card h-full border-white/70 transition-transform hover:-translate-y-0.5">
              <CardContent className="flex h-full items-center gap-4 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(45,212,191,0.14))] text-emerald-700">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{t("dashboard.manageCustomers")}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t("dashboard.viewEditCustomers")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Link href="/payments" className="block h-full">
            <Card className="mesh-card h-full border-white/70 transition-transform hover:-translate-y-0.5">
              <CardContent className="flex h-full items-center gap-4 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(168,85,247,0.18),rgba(99,102,241,0.14))] text-violet-700">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{t("dashboard.recordPayment")}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t("dashboard.recordPaymentDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>
      </div>

      <StaggerItem>
        <Card className="mesh-card border-white/70">
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Clock className="h-5 w-5 text-sky-700" />
                  {t("dashboard.recentInvoices")}
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">{t("dashboard.startByCreating")}</p>
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
                    className="flex items-center justify-between rounded-[1.4rem] border border-white/65 bg-white/72 p-4"
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
              <div className="flex flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-slate-200/90 bg-white/66 px-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(59,130,246,0.14),rgba(16,185,129,0.12))] text-sky-700">
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
                    className="group flex items-center justify-between gap-4 rounded-[1.4rem] border border-white/65 bg-white/72 p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.42)] transition-all hover:-translate-y-0.5 hover:bg-white"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(14,165,233,0.14))] text-sky-700">
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
