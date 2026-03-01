"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Building2,
  LayoutDashboard,
  Package,
  Users,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  Wrench,
  Truck,
  Receipt,
  Wallet,
  FileCheck,
  Monitor,
  BarChart3,
  FileMinus,
  FileOutput,
  BookOpen,
  Landmark,
  CircleDollarSign,
  ChevronDown,
  ChevronRight,
  Scale,
  TrendingUp,
  PieChart,
  DollarSign,
  ArrowRightLeft,
  ShoppingCart,
  Warehouse,
  GitBranch,
  Smartphone,
  Search,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { useLanguage } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Navigation items with translation keys
const navigation = [
  { nameKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { nameKey: "nav.posTerminal", href: "/pos", icon: Monitor },
  { nameKey: "nav.products", href: "/products", icon: Package },
];

const salesNavigation = [
  { nameKey: "nav.customers", href: "/customers", icon: Users },
  { nameKey: "nav.quotations", href: "/quotations", icon: FileCheck },
  { nameKey: "nav.salesInvoices", href: "/invoices", icon: FileText },
  { nameKey: "nav.creditNotes", href: "/credit-notes", icon: FileMinus },
  { nameKey: "nav.customerPayments", href: "/payments", icon: CreditCard },
];

const purchasesNavigation = [
  { nameKey: "nav.suppliers", href: "/suppliers", icon: Truck },
  { nameKey: "nav.purchaseInvoices", href: "/purchase-invoices", icon: Receipt },
  { nameKey: "nav.debitNotes", href: "/debit-notes", icon: FileOutput },
  { nameKey: "nav.supplierPayments", href: "/supplier-payments", icon: Wallet },
];

const accountingNavigation = [
  { nameKey: "nav.expenses", href: "/accounting/expenses", icon: CircleDollarSign },
  { nameKey: "nav.cashBank", href: "/accounting/cash-bank", icon: Landmark },
  { nameKey: "nav.journalEntries", href: "/accounting/journal-entries", icon: BookOpen },
  { nameKey: "nav.chartOfAccounts", href: "/accounting/chart-of-accounts", icon: Scale },
];

const reportsNavigation = [
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

const bottomNavigation = [
  { nameKey: "nav.settings", href: "/settings", icon: Settings },
  { nameKey: "nav.fixBalances", href: "/admin/fix-balances", icon: Wrench },
];

const inventoryNavigation = [
  { nameKey: "nav.branches", href: "/inventory/branches", icon: GitBranch },
  { nameKey: "nav.stockTransfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft },
  { nameKey: "nav.openingStock", href: "/inventory/opening-stock", icon: Package },
];

const mobileShopNavigation = [
  { nameKey: "nav.imeiLookup", href: "/mobile-shop/imei-lookup", icon: Search },
  { nameKey: "nav.deviceInventory", href: "/mobile-shop/device-inventory", icon: Smartphone },
];

const superadminNavigation = [
  { nameKey: "nav.organizations", href: "/admin/organizations", icon: Building2 },
];

// Map from English name to nameKey for sidebar filtering (backward compat with API)
const NAME_TO_KEY: Record<string, string> = {
  "Dashboard": "nav.dashboard",
  "POS Terminal": "nav.posTerminal",
  "Products": "nav.products",
  "Customers": "nav.customers",
  "Quotations": "nav.quotations",
  "Sales Invoices": "nav.salesInvoices",
  "Credit Notes": "nav.creditNotes",
  "Customer Payments": "nav.customerPayments",
  "Suppliers": "nav.suppliers",
  "Purchase Invoices": "nav.purchaseInvoices",
  "Debit Notes": "nav.debitNotes",
  "Supplier Payments": "nav.supplierPayments",
  "Expenses": "nav.expenses",
  "Cash & Bank": "nav.cashBank",
  "Journal Entries": "nav.journalEntries",
  "Chart of Accounts": "nav.chartOfAccounts",
  "Branches": "nav.branches",
  "Stock Transfers": "nav.stockTransfers",
  "Opening Stock": "nav.openingStock",
  "IMEI Lookup": "nav.imeiLookup",
  "Device Inventory": "nav.deviceInventory",
  "Profit by Items": "nav.profitByItems",
  "Customer Balances": "nav.customerBalances",
  "Supplier Balances": "nav.supplierBalances",
  "Unified Ledger": "nav.unifiedLedger",
  "Trial Balance": "nav.trialBalance",
  "Profit & Loss": "nav.profitLoss",
  "Balance Sheet": "nav.balanceSheet",
  "Cash Flow": "nav.cashFlow",
  "Expense Report": "nav.expenseReport",
  "Stock Summary": "nav.stockSummary",
  "Branch P&L": "nav.branchPL",
  "Settings": "nav.settings",
  "Fix Balances": "nav.fixBalances",
  "Organizations": "nav.organizations",
};

// Reverse map: key → English name (for disabledItems filtering)
const KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_TO_KEY).map(([k, v]) => [v, k])
);

type NavItem = { nameKey: string; href: string; icon: React.ElementType };

function NavItemComponent({ item, pathname, onNavigate }: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  const isActive = pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5" />
      {t(item.nameKey)}
    </Link>
  );
}

function CollapsibleSection({ title, icon: Icon, items, pathname, onNavigate, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const hasActive = items.some(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActive);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
      >
        <Icon className="h-5 w-5" />
        <span className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>{t(title)}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />}
      </button>
      {isOpen && (
        <div className={`${isRTL ? "mr-3" : "ml-3"} space-y-1`}>
          {items.map((item) => (
            <NavItemComponent key={item.nameKey} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const isSuperadmin = session?.user?.role === "superadmin";

  const { data: disabledItems = [] } = useSWR<string[]>(
    !isSuperadmin && session?.user ? "/api/sidebar" : null,
    fetcher
  );

  // disabledItems come from API as English names; filter by matching English name
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      const englishName = KEY_TO_NAME[item.nameKey];
      return !disabledItems.includes(englishName || "");
    });

  const visibleNav = filterItems(navigation);
  const visibleSales = filterItems(salesNavigation);
  const visiblePurchases = filterItems(purchasesNavigation);
  const visibleAccounting = filterItems(accountingNavigation);
  const visibleReports = filterItems(reportsNavigation);
  const visibleBottom = filterItems(bottomNavigation);
  const visibleInventory = filterItems(inventoryNavigation);
  const visibleMobileShop = filterItems(mobileShopNavigation);
  const multiBranchEnabled = session?.user?.multiBranchEnabled;
  const isMobileShopEnabled = session?.user?.isMobileShopModuleEnabled;

  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-sm">
        <div className="relative h-9 w-9 bg-white rounded-md flex items-center justify-center overflow-hidden p-1 shadow-sm border border-slate-700">
          <Image src="/logo.png" alt="BizArch Logo" fill sizes="36px" className="object-contain" priority />
        </div>
        <span className="text-lg font-bold">BizArch ERP</span>
      </div>

      <Separator className="bg-slate-700" />

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {isSuperadmin ? (
          superadminNavigation.map((item) => (
            <NavItemComponent key={item.nameKey} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))
        ) : (
          <>
            {visibleNav.map((item) => (
              <NavItemComponent key={item.nameKey} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}

            {visibleSales.length > 0 && (
              <CollapsibleSection
                title="nav.sales"
                icon={ShoppingCart}
                items={visibleSales}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {visiblePurchases.length > 0 && (
              <CollapsibleSection
                title="nav.purchases"
                icon={Truck}
                items={visiblePurchases}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {visibleAccounting.length > 0 && (
              <CollapsibleSection
                title="nav.accounting"
                icon={BookOpen}
                items={visibleAccounting}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {multiBranchEnabled && visibleInventory.length > 0 && (
              <CollapsibleSection
                title="nav.inventory"
                icon={Warehouse}
                items={visibleInventory}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {isMobileShopEnabled && visibleMobileShop.length > 0 && (
              <CollapsibleSection
                title="nav.mobileShop"
                icon={Smartphone}
                items={visibleMobileShop}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {visibleReports.length > 0 && (
              <CollapsibleSection
                title="nav.reports"
                icon={BarChart3}
                items={visibleReports}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}
          </>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="px-3 py-4">
        <Separator className="mb-4 bg-slate-700" />
        {!isSuperadmin && visibleBottom.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.nameKey}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.nameKey)}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start gap-3 px-3 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5" />
          {t("nav.signOut")}
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  const { isRTL } = useLanguage();
  return (
    <div
      className={`hidden md:flex h-full w-64 flex-col relative bg-slate-950 text-white bg-cover bg-no-repeat bg-center border-slate-800 ${isRTL ? "border-l" : "border-r"}`}
      style={{ backgroundImage: "url('/sidebar_bg.png')" }}
    >
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] pointer-events-none z-0"></div>
      <div className="relative z-10 flex h-full flex-col">
        <SidebarContent />
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isRTL } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isRTL ? "right" : "left"}
        className="w-64 p-0 bg-slate-950 text-white border-slate-800 flex flex-col overflow-hidden"
      >
        <div
          className="absolute inset-0 bg-cover bg-no-repeat bg-center z-0"
          style={{ backgroundImage: "url('/sidebar_bg.png')" }}
        >
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"></div>
        </div>
        <div className="relative z-10 flex h-full flex-col">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
