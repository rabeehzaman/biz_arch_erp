"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import { useDisabledSidebarItems, useSidebarMode } from "@/hooks/use-form-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  GitBranch,
  Smartphone,
  Search,
  Settings,
  LogOut,
  Package,
  ChevronRight,
  ChevronDown,
  Building2,
  ClipboardList,
  LayoutDashboard,
  UtensilsCrossed,
  Grid3X3,
  ShoppingCart,
  Wrench,
} from "lucide-react";

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
  "nav.stockTake": "Stock Take",
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
  "nav.salesByCustomer": "Sales by Customer",
  "nav.stockSummary": "Stock Summary",
  "nav.branchPL": "Branch P&L",
  "nav.settings": "Settings",
  "nav.organizations": "Organizations",
  // Restaurant
  "nav.restaurantDashboard": "Restaurant Dashboard",
  "nav.restaurantTables": "Tables",
  "nav.restaurantKotHistory": "KOT History",
  // Jewellery
  "nav.jewelleryDashboard": "Jewellery Dashboard",
  "nav.jewelleryInventory": "Jewellery Inventory",
  "nav.goldRates": "Gold Rates",
  "nav.jewellerySale": "Jewellery Sale",
  "nav.oldGoldExchange": "Old Gold Exchange",
  "nav.customerSchemes": "Customer Schemes",
  "nav.karigars": "Karigars",
  "nav.jewelleryRepairs": "Jewellery Repairs",
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
  { nameKey: "nav.stockTake", href: "/inventory/adjustments", icon: ClipboardList },
];

const mobileShopSection: NavItem[] = [
  { nameKey: "nav.imeiLookup", href: "/mobile-shop/imei-lookup", icon: Search },
  { nameKey: "nav.deviceInventory", href: "/mobile-shop/device-inventory", icon: Smartphone },
];

const restaurantSection: NavItem[] = [
  { nameKey: "nav.restaurantDashboard", href: "/restaurant/dashboard", icon: LayoutDashboard },
  { nameKey: "nav.restaurantTables", href: "/restaurant/tables", icon: Grid3X3 },
  { nameKey: "nav.restaurantKotHistory", href: "/restaurant/kot-history", icon: ClipboardList },
];

const jewelleryGeneralSection: NavItem[] = [
  { nameKey: "nav.jewelleryDashboard", href: "/jewellery-shop/dashboard", icon: LayoutDashboard },
  { nameKey: "nav.jewelleryInventory", href: "/jewellery-shop/inventory", icon: Package },
  { nameKey: "nav.goldRates", href: "/jewellery-shop/gold-rates", icon: BarChart3 },
];

const jewellerySalesSection: NavItem[] = [
  { nameKey: "nav.customers", href: "/customers", icon: Users },
  { nameKey: "nav.jewellerySale", href: "/jewellery-shop/sale", icon: ShoppingCart },
  { nameKey: "nav.customerPayments", href: "/payments", icon: CreditCard },
  { nameKey: "nav.oldGoldExchange", href: "/jewellery-shop/old-gold", icon: ArrowRightLeft },
  { nameKey: "nav.customerSchemes", href: "/jewellery-shop/schemes", icon: CreditCard },
];

const jewelleryPurchasesSection: NavItem[] = [
  ...purchasesSection,
  { nameKey: "nav.karigars", href: "/jewellery-shop/karigars", icon: Users },
  { nameKey: "nav.jewelleryRepairs", href: "/jewellery-shop/repairs", icon: Wrench },
];

const reportsSection: NavItem[] = [
  { nameKey: "nav.profitByItems", href: "/reports/profit-by-items", icon: BarChart3 },
  { nameKey: "nav.salesByCustomer", href: "/reports/sales-by-customer", icon: BarChart3 },
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

const COLLAPSED_STORAGE_KEY = "more-page-collapsed";

function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  });

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

function MenuSection({
  title,
  sectionKey,
  items,
  disabledItems,
  isCollapsed,
  onToggle,
}: {
  title: string;
  sectionKey: string;
  items: NavItem[];
  disabledItems: string[];
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const visible = items.filter((item) => {
    const englishName = KEY_TO_NAME[item.nameKey];
    return !disabledItems.includes(englishName || "");
  });

  if (visible.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="mb-2 flex w-full items-center gap-1 px-1"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h3>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            isCollapsed ? "ltr:-rotate-90 rtl:rotate-90" : ""
          }`}
        />
        {isCollapsed && (
          <span className="text-xs text-slate-300">{visible.length}</span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {visible.map((item, idx) => (
            <Link
              key={item.nameKey}
              href={item.href}
              className={`touch-ripple flex items-center gap-3.5 px-4 py-3.5 text-sm font-medium text-slate-700 active:bg-slate-50 ${
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
    </div>
  );
}

export default function MorePage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isSuperadmin = session?.user?.role === "superadmin";
  const multiBranchEnabled = session?.user?.multiBranchEnabled;
  const isMobileShopEnabled = session?.user?.isMobileShopModuleEnabled;
  const isJewelleryEnabled = session?.user?.isJewelleryModuleEnabled;
  const isRestaurantEnabled = session?.user?.isRestaurantModuleEnabled;
  const { collapsed, toggle } = useCollapsedSections();
  const disabledItems = useDisabledSidebarItems();
  const sidebarMode = useSidebarMode();

  const { data: warehouseAccess } = useSWR(
    !isSuperadmin && multiBranchEnabled && session?.user ? "/api/user-warehouse-access" : null,
  );

  const initials = session?.user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "U";

  const assignedBranch = useMemo(() => {
    if (!warehouseAccess || !Array.isArray(warehouseAccess)) return null;
    const userId = session?.user?.id;
    const myAccess = warehouseAccess.filter((a: { userId: string }) => a.userId === userId);
    if (myAccess.length === 0) return null;
    const defaultAccess = myAccess.find((a: { isDefault: boolean }) => a.isDefault);
    return (defaultAccess || myAccess[0])?.branch?.name ?? null;
  }, [warehouseAccess, session?.user?.id]);

  if (sidebarMode === "hidden" && !isSuperadmin) {
    return null;
  }

  return (
    <div className="pb-4">
      {!isSuperadmin && session?.user && (
        <div className="mb-5">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-slate-900 text-sm font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{session.user.name}</p>
                <p className="truncate text-xs text-slate-500">{session.user.email}</p>
                {assignedBranch && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <GitBranch className="h-3 w-3 shrink-0" />
                    <span className="truncate">{assignedBranch}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("nav.more")}</h1>

      {isSuperadmin && (
        <>
          <MenuSection
            title={t("nav.organizations")}
            sectionKey="admin"
            items={superadminSection}
            disabledItems={[]}
            isCollapsed={!!collapsed["admin"]}
            onToggle={() => toggle("admin")}
          />

          <div className="mb-6">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
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

      {!isSuperadmin && (
        <>
          {isJewelleryEnabled && (
            <MenuSection title={t("nav.jewelleryShop")} sectionKey="jewelleryGeneral" items={jewelleryGeneralSection} disabledItems={disabledItems} isCollapsed={!!collapsed["jewelleryGeneral"]} onToggle={() => toggle("jewelleryGeneral")} />
          )}

          <MenuSection title={t("nav.sales")} sectionKey="sales" items={isJewelleryEnabled ? jewellerySalesSection : salesSection} disabledItems={disabledItems} isCollapsed={!!collapsed["sales"]} onToggle={() => toggle("sales")} />
          <MenuSection title={t("nav.purchases")} sectionKey="purchases" items={isJewelleryEnabled ? jewelleryPurchasesSection : purchasesSection} disabledItems={disabledItems} isCollapsed={!!collapsed["purchases"]} onToggle={() => toggle("purchases")} />
          <MenuSection title={t("nav.accounting")} sectionKey="accounting" items={accountingSection} disabledItems={disabledItems} isCollapsed={!!collapsed["accounting"]} onToggle={() => toggle("accounting")} />

          <MenuSection title={t("nav.inventory")} sectionKey="inventory" items={multiBranchEnabled ? inventorySection : inventorySection.filter((i) => i.nameKey !== "nav.branches" && i.nameKey !== "nav.stockTransfers")} disabledItems={disabledItems} isCollapsed={!!collapsed["inventory"]} onToggle={() => toggle("inventory")} />

          {isMobileShopEnabled && (
            <MenuSection title={t("nav.mobileShop")} sectionKey="mobileShop" items={mobileShopSection} disabledItems={disabledItems} isCollapsed={!!collapsed["mobileShop"]} onToggle={() => toggle("mobileShop")} />
          )}

          {isRestaurantEnabled && (
            <MenuSection title={t("nav.restaurant")} sectionKey="restaurant" items={restaurantSection} disabledItems={disabledItems} isCollapsed={!!collapsed["restaurant"]} onToggle={() => toggle("restaurant")} />
          )}

          <MenuSection title={t("nav.reports")} sectionKey="reports" items={reportsSection} disabledItems={disabledItems} isCollapsed={!!collapsed["reports"]} onToggle={() => toggle("reports")} />

          {/* Settings & Sign Out */}
          <div className="mb-6">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <Link
                href="/settings"
                className="touch-ripple flex items-center gap-3.5 border-b border-slate-100 px-4 py-3.5 text-sm font-medium text-slate-700 active:bg-slate-50"
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
