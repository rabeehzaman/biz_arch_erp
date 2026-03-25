"use client";

import Link from "next/link";
import {
  BarChart3,
  Users,
  Truck,
  BookOpen,
  Scale,
  TrendingUp,
  PieChart,
  Wallet,
  Landmark,
  ArrowRightLeft,
  DollarSign,
  Package,
  GitBranch,
  Clock,
  Percent,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useEdition } from "@/hooks/use-edition";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";
import { useDisabledReports } from "@/hooks/use-form-config";

interface ReportLink {
  titleKey: string;
  descKey: string;
  href: string;
  icon: React.ElementType;
  edition?: "INDIA" | "SAUDI";
  requiresFeature?: "multiBranchEnabled";
}

interface ReportCategory {
  titleKey: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  reports: ReportLink[];
}

const categories: ReportCategory[] = [
  {
    titleKey: "reports.categorySales",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-50",
    reports: [
      { titleKey: "reports.profitByItems", descKey: "reports.profitByItemsDesc", href: "/reports/profit-by-items", icon: BarChart3 },
      { titleKey: "reports.salesByCustomer", descKey: "reports.salesByCustomerDesc", href: "/reports/sales-by-customer", icon: BarChart3 },
      { titleKey: "reports.salesByItem", descKey: "reports.salesByItemDesc", href: "/reports/sales-by-item", icon: BarChart3 },
      { titleKey: "reports.salesBySalesperson", descKey: "reports.salesBySalespersonDesc", href: "/reports/sales-by-salesperson", icon: BarChart3 },
      { titleKey: "reports.salesRegister", descKey: "reports.salesRegisterDesc", href: "/reports/sales-register", icon: FileText },
    ],
  },
  {
    titleKey: "reports.categoryPurchases",
    icon: Truck,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    reports: [
      { titleKey: "reports.purchaseRegister", descKey: "reports.purchaseRegisterDesc", href: "/reports/purchase-register", icon: FileText },
      { titleKey: "reports.purchasesBySupplier", descKey: "reports.purchasesBySupplierDesc", href: "/reports/purchases-by-supplier", icon: BarChart3 },
      { titleKey: "reports.purchasesByItem", descKey: "reports.purchasesByItemDesc", href: "/reports/purchases-by-item", icon: BarChart3 },
    ],
  },
  {
    titleKey: "reports.categoryReceivablesPayables",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    reports: [
      { titleKey: "reports.customerBalances", descKey: "reports.customerBalancesDesc", href: "/reports/customer-balances", icon: Users },
      { titleKey: "reports.supplierBalances", descKey: "reports.supplierBalancesDesc", href: "/reports/supplier-balances", icon: Truck },
      { titleKey: "reports.arAging", descKey: "reports.arAgingDesc", href: "/reports/ar-aging", icon: Clock },
      { titleKey: "reports.apAging", descKey: "reports.apAgingDesc", href: "/reports/ap-aging", icon: Clock },
    ],
  },
  {
    titleKey: "reports.categoryFinancialStatements",
    icon: PieChart,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    reports: [
      { titleKey: "reports.profitLoss", descKey: "reports.profitLossDesc", href: "/reports/profit-loss", icon: TrendingUp },
      { titleKey: "reports.balanceSheet", descKey: "reports.balanceSheetDesc", href: "/reports/balance-sheet", icon: PieChart },
      { titleKey: "reports.trialBalance", descKey: "reports.trialBalanceDesc", href: "/reports/trial-balance", icon: Scale },
      { titleKey: "reports.cashFlow", descKey: "reports.cashFlowDesc", href: "/reports/cash-flow", icon: ArrowRightLeft },
    ],
  },
  {
    titleKey: "reports.categoryCashBank",
    icon: Landmark,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    reports: [
      { titleKey: "reports.cashBook", descKey: "reports.cashBookDesc", href: "/reports/cash-book", icon: Wallet },
      { titleKey: "reports.bankBook", descKey: "reports.bankBookDesc", href: "/reports/bank-book", icon: Landmark },
      { titleKey: "reports.cashBankSummary", descKey: "reports.cashBankSummaryDesc", href: "/reports/cash-bank-summary", icon: ArrowRightLeft },
      { titleKey: "reports.unifiedLedger", descKey: "reports.ledgerDesc", href: "/reports/ledger", icon: BookOpen },
    ],
  },
  {
    titleKey: "reports.categoryTax",
    icon: Percent,
    color: "text-red-600",
    bgColor: "bg-red-50",
    reports: [
      { titleKey: "reports.vatSummary", descKey: "reports.vatSummaryDesc", href: "/reports/vat-summary", icon: Percent, edition: "SAUDI" },
      { titleKey: "reports.vatDetail", descKey: "reports.vatDetailDesc", href: "/reports/vat-detail", icon: Percent, edition: "SAUDI" },
      { titleKey: "reports.gstSummary", descKey: "reports.gstSummaryDesc", href: "/reports/gst-summary", icon: Percent, edition: "INDIA" },
      { titleKey: "reports.gstDetail", descKey: "reports.gstDetailDesc", href: "/reports/gst-detail", icon: Percent, edition: "INDIA" },
    ],
  },
  {
    titleKey: "reports.categoryOther",
    icon: BarChart3,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    reports: [
      { titleKey: "reports.expenseReport", descKey: "reports.expenseReportDesc", href: "/reports/expense-report", icon: DollarSign },
      { titleKey: "reports.stockSummary", descKey: "reports.stockSummaryDesc", href: "/reports/stock-summary", icon: Package },
      { titleKey: "reports.branchPL", descKey: "reports.branchPlDesc", href: "/reports/branch-pl", icon: GitBranch, requiresFeature: "multiBranchEnabled" },
    ],
  },
];

export default function ReportsPage() {
  const { t } = useLanguage();
  const { edition } = useEdition();
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const multiBranch = !!(session?.user as any)?.multiBranchEnabled;
  const disabledReports = useDisabledReports();

  const filteredCategories = useMemo(() => {
    const query = search.toLowerCase().trim();

    return categories
      .map((cat) => {
        const filtered = cat.reports.filter((r) => {
          if (r.edition && r.edition !== edition) return false;
          if (r.requiresFeature === "multiBranchEnabled" && !multiBranch) return false;
          // Check if report is disabled by org config
          const slug = r.href.replace("/reports/", "");
          if (disabledReports.includes(slug)) return false;
          if (!query) return true;
          const title = t(r.titleKey).toLowerCase();
          const desc = t(r.descKey).toLowerCase();
          return title.includes(query) || desc.includes(query);
        });
        return { ...cat, reports: filtered };
      })
      .filter((cat) => cat.reports.length > 0);
  }, [search, edition, multiBranch, disabledReports, t]);

  return (
    <PageAnimation>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("reports.reportsCenter")}</h2>
            <p className="text-slate-500">{t("reports.reportsCenterDesc")}</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t("reports.searchReports")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Categories */}
        {filteredCategories.map((cat) => (
          <div key={cat.titleKey}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`rounded-lg p-1.5 ${cat.bgColor}`}>
                <cat.icon className={`h-4 w-4 ${cat.color}`} />
              </div>
              <h3 className={`text-lg font-semibold ${cat.color}`}>{t(cat.titleKey)}</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cat.reports.map((report) => (
                <Link key={report.href} href={report.href}>
                  <Card className="group h-full transition-all hover:shadow-md hover:border-slate-300">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${cat.bgColor} transition-colors group-hover:bg-opacity-80`}>
                        <report.icon className={`h-4 w-4 ${cat.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 group-hover:text-slate-700">{t(report.titleKey)}</p>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{t(report.descKey)}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{t("reports.noReportsFound")}</h3>
            <p className="text-sm text-slate-500">{t("reports.tryAdjustingSearch")}</p>
          </div>
        )}
      </div>
    </PageAnimation>
  );
}
