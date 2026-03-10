"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import useSWR from "swr";
import {
  Users,
  FileText,
  CreditCard,
  Truck,
  Receipt,
  Wallet,
  FileCheck,
  BarChart3,
  FileMinus,
  FileOutput,
  BookOpen,
  Landmark,
  CircleDollarSign,
  Scale,
  TrendingUp,
  PieChart,
  DollarSign,
  ArrowRightLeft,
  Warehouse,
  GitBranch,
  Smartphone,
  Search,
  Settings,
  LogOut,
  Package,
  ChevronRight,
  Building2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Map from English name to nameKey for sidebar filtering
const KEY_TO_NAME: Record<string, string> = {
  "nav.customers": "Customers",
  "nav.quotations": "Quotations",
  "nav.salesInvoices": "Sales Invoices",
  "nav.creditNotes": "Credit Notes",
  "nav.customerPayments": "Customer Payments",
  "nav.suppliers": "Suppliers",
  "nav.purchaseInvoices": "Purchase Invoices",
  "nav.debitNotes": "Debit Notes",
  "nav.supplierPayments": "Supplier Payments",
  "nav.expenses": "Expenses",
  "nav.cashBank": "Cash & Bank",
  "nav.journalEntries": "Journal Entries",
  "nav.chartOfAccounts": "Chart of Accounts",
  "nav.branches": "Branches",
  "nav.stockTransfers": "Stock Transfers",
  "nav.openingStock": "Opening Stock",
  "nav.imeiLookup": "IMEI Lookup",
  "nav.deviceInventory": "Device Inventory",
  "nav.profitByItems": "Profit by Items",
  "nav.customerBalances": "Customer Balances",
  "nav.supplierBalances": "Supplier Balances",
  "nav.unifiedLedger": "Unified Ledger",
  "nav.trialBalance": "Trial Balance",
  "nav.profitLoss": "Profit & Loss",
  "nav.balanceSheet": "Balance Sheet",
  "nav.cashFlow": "Cash Flow",
  "nav.expenseReport": "Expense Report",
  "nav.stockSummary": "Stock Summary",
  "nav.branchPL": "Branch P&L",
  "nav.settings": "Settings",
  "nav.organizations": "Organizations",
};

type NavItem = { nameKey: string; href: string; icon: React.ElementType };

const purchasesSection: NavItem[] = [
  { nameKey: "nav.suppliers", href: "/suppliers", icon: Truck },
  { nameKey: "nav.purchaseInvoices", href: "/purchase-invoices", icon: Receipt },
  { nameKey: "nav.debitNotes", href: "/debit-notes", icon: FileOutput },
  { nameKey: "nav.supplierPayments", href: "/supplier-payments", icon: Wallet },
];

const salesSection: NavItem[] = [
  { nameKey: "nav.customers", href: "/customers", icon: Users },
  { nameKey: "nav.quotations", href: "/quotations", icon: FileCheck },
  { nameKey: "nav.salesInvoices", href: "/invoices", icon: FileText },
  { nameKey: "nav.creditNotes", href: "/credit-notes", icon: FileMinus },
  { nameKey: "nav.customerPayments", href: "/payments", icon: CreditCard },
];

const accountingSection: NavItem[] = [
  { nameKey: "nav.expenses", href: "/accounting/expenses", icon: CircleDollarSign },
  { nameKey: "nav.cashBank", href: "/accounting/cash-bank", icon: Landmark },
  { nameKey: "nav.journalEntries", href: "/accounting/journal-entries", icon: BookOpen },
  { nameKey: "nav.chartOfAccounts", href: "/accounting/chart-of-accounts", icon: Scale },
];

const inventorySection: NavItem[] = [
  { nameKey: "nav.branches", href: "/inventory/branches", icon: GitBranch },
  { nameKey: "nav.stockTransfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft },
  { nameKey: "nav.openingStock", href: "/inventory/opening-stock", icon: Package },
];

const mobileShopSection: NavItem[] = [
  { nameKey: "nav.imeiLookup", href: "/mobile-shop/imei-lookup", icon: Search },
  { nameKey: "nav.deviceInventory", href: "/mobile-shop/device-inventory", icon: Smartphone },
];

const reportsSection: NavItem[] = [
  { nameKey: "nav.profitByItems", href: "/reports/profit-by-items", icon: BarChart3 },
  { nameKey: "nav.customerBalances", href: "/reports/customer-balances", icon: Users },
  { nameKey: "nav.supplierBalances", href: "/reports/supplier-balances", icon: Truck },
  { nameKey: "nav.unifiedLedger", href: "/reports/ledger", icon: BookOpen },
  { nameKey: "nav.trialBalance", href: "/reports/trial-balance", icon: Scale },
  { nameKey: "nav.profitLoss", href: "/reports/profit-loss", icon: TrendingUp },
  { nameKey: "nav.balanceSheet", href: "/reports/balance-sheet", icon: PieChart },
  { nameKey: "nav.cashFlow", href: "/reports/cash-flow", icon: ArrowRightLeft },
  { nameKey: "nav.expenseReport", href: "/reports/expense-report", icon: DollarSign },
  { nameKey: "nav.stockSummary", href: "/reports/stock-summary", icon: Package },
  { nameKey: "nav.branchPL", href: "/reports/branch-pl", icon: GitBranch },
];

const superadminSection: NavItem[] = [
  { nameKey: "nav.organizations", href: "/admin/organizations", icon: Building2 },
];

function MenuSection({
  title,
  items,
  disabledItems,
}: {
  title: string;
  items: NavItem[];
  disabledItems: string[];
}) {
  const { t } = useLanguage();
  const visible = items.filter((item) => {
    const englishName = KEY_TO_NAME[item.nameKey];
    return !disabledItems.includes(englishName || "");
  });

  if (visible.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {visible.map((item, idx) => (
          <Link
            key={item.nameKey}
            href={item.href}
            className={`flex items-center gap-3.5 px-4 py-3.5 text-sm font-medium text-slate-700 active:bg-slate-50 ${
              idx < visible.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50">
              <item.icon className="h-[18px] w-[18px] text-slate-500" />
            </div>
            <span className="flex-1">{t(item.nameKey)}</span>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function MorePage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isSuperadmin = session?.user?.role === "superadmin";
  const multiBranchEnabled = session?.user?.multiBranchEnabled;
  const isMobileShopEnabled = session?.user?.isMobileShopModuleEnabled;

  const { data: disabledItems = [] } = useSWR<string[]>(
    !isSuperadmin && session?.user ? "/api/sidebar" : null,
    fetcher
  );

  return (
    <div className="pb-4">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("nav.more")}</h1>

      {isSuperadmin && (
        <MenuSection
          title={t("nav.organizations")}
          items={superadminSection}
          disabledItems={[]}
        />
      )}

      {!isSuperadmin && (
        <>
          <MenuSection title={t("nav.sales")} items={salesSection} disabledItems={disabledItems} />
          <MenuSection title={t("nav.purchases")} items={purchasesSection} disabledItems={disabledItems} />
          <MenuSection title={t("nav.accounting")} items={accountingSection} disabledItems={disabledItems} />

          {multiBranchEnabled && (
            <MenuSection title={t("nav.inventory")} items={inventorySection} disabledItems={disabledItems} />
          )}

          {isMobileShopEnabled && (
            <MenuSection title={t("nav.mobileShop")} items={mobileShopSection} disabledItems={disabledItems} />
          )}

          <MenuSection title={t("nav.reports")} items={reportsSection} disabledItems={disabledItems} />

          {/* Settings & Sign Out */}
          <div className="mb-6">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <Link
                href="/settings"
                className="flex items-center gap-3.5 border-b border-slate-100 px-4 py-3.5 text-sm font-medium text-slate-700 active:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50">
                  <Settings className="h-[18px] w-[18px] text-slate-500" />
                </div>
                <span className="flex-1">{t("nav.settings")}</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-sm font-medium text-red-600 active:bg-red-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                  <LogOut className="h-[18px] w-[18px] text-red-500" />
                </div>
                <span className="flex-1 text-left">{t("nav.signOut")}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
