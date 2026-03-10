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
  Info,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
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
        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition-all duration-200",
        isActive
          ? "border-cyan-200/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(56,189,248,0.16))] text-white shadow-[0_22px_38px_-26px_rgba(45,212,191,0.75)]"
          : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
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
        className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3.5 py-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
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
      <div className="mx-3 mt-3 flex h-[4.5rem] items-center gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.07] px-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.95)] backdrop-blur-xl">
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white p-1.5 shadow-sm">
          <Image src="/bizarch-mark.svg" alt="BizArch Logo" fill sizes="36px" className="object-contain" priority />
        </div>
        <div className="min-w-0">
          <span className="block truncate bg-gradient-to-r from-white via-sky-100 to-emerald-200 bg-clip-text text-lg font-bold text-transparent">
            BizArch ERP
          </span>
          <span className="block text-[11px] uppercase tracking-[0.22em] text-sky-100/75">
            Workspace
          </span>
        </div>
      </div>

      <Separator className="mt-4 bg-white/10" />

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
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
        <Separator className="mb-4 bg-white/10" />
        {!isSuperadmin && visibleBottom.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.nameKey}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border-cyan-200/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(56,189,248,0.16))] text-white shadow-[0_22px_38px_-26px_rgba(45,212,191,0.75)]"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.nameKey)}
            </Link>
          );
        })}
        <AboutDialog />
        <Button
          variant="ghost"
          className="mt-1 h-11 w-full justify-start gap-3 rounded-2xl border border-transparent px-3.5 text-slate-300 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5" />
          {t("nav.signOut")}
        </Button>
      </div>
    </>
  );
}

function AboutDialog() {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const isElectron = typeof window !== "undefined" && !!window.electronPOS;

  useEffect(() => {
    if (isElectron) {
      window.electronPOS!.getAppVersion().then(setAppVersion);
      window.electronPOS!.onUpdateStatus((msg) => {
        setUpdateStatus(msg);
        if (!msg.includes("Checking") && !msg.includes("Downloading")) {
          setChecking(false);
        }
      });
    }
  }, [isElectron]);

  const handleCheckUpdate = useCallback(async () => {
    if (!isElectron) return;
    setChecking(true);
    setUpdateStatus("Checking for updates...");
    await window.electronPOS!.checkForUpdates();
  }, [isElectron]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 w-full justify-start gap-3 rounded-2xl border border-transparent px-3.5 text-slate-300 hover:border-white/10 hover:bg-white/[0.08] hover:text-white"
        >
          <Info className="h-5 w-5" />
          About
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>About BizArch ERP</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium">{appVersion ?? "Web"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Platform</span>
              <span className="text-sm font-medium">
                {isElectron ? (window.electronPOS!.platform === "win32" ? "Windows" : window.electronPOS!.platform === "darwin" ? "macOS" : "Linux") : "Browser"}
              </span>
            </div>
          </div>

          {isElectron && (
            <>
              <Separator />
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleCheckUpdate}
                  disabled={checking}
                >
                  {checking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Check for Updates
                </Button>
                {updateStatus && (
                  <p className="text-center text-sm text-muted-foreground">
                    {updateStatus}
                  </p>
                )}
              </div>
            </>
          )}

          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} BizArch. All rights reserved.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SidebarBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#020617_0%,#05222a_38%,#031822_64%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.2] [background-image:linear-gradient(rgba(148,163,184,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:30px_30px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,189,208,0.28),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(86,137,220,0.2),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(125,206,124,0.16),transparent_34%)]" />
      <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-cyan-300/22 blur-3xl" />
      <div className="absolute bottom-[8%] right-[-4.5rem] h-56 w-56 rounded-full bg-emerald-300/18 blur-3xl" />
      <div
        className="absolute inset-x-4 top-20 h-40 rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[0_30px_70px_-40px_rgba(15,23,42,0.9)] backdrop-blur-sm"
        style={{ transform: "rotate(-8deg)" }}
      />
      <div
        className="absolute inset-x-8 top-28 h-32 rounded-[1.75rem] border border-white/8 bg-gradient-to-br from-white/[0.12] via-white/[0.02] to-transparent"
        style={{ transform: "rotate(-2deg)" }}
      />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.07] to-transparent" />
      <div className="absolute left-0 top-24 h-56 w-px bg-gradient-to-b from-transparent via-cyan-200/60 to-transparent" />
      <div className="absolute right-0 bottom-20 h-56 w-px bg-gradient-to-b from-transparent via-green-200/45 to-transparent" />
    </div>
  );
}

export function Sidebar() {
  const { isRTL } = useLanguage();
  return (
    <div
      className={`relative hidden h-screen min-h-screen w-72 shrink-0 self-stretch overflow-hidden border-white/10 bg-[#020817] text-white ${isRTL ? "border-l" : "border-r"} md:sticky md:top-0 md:flex`}
    >
      <SidebarBackdrop />
      <div className="relative z-10 flex h-full flex-col">
        <SidebarContent />
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const { isRTL } = useLanguage();

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
        className="flex h-full w-[min(22rem,88vw)] flex-col overflow-hidden border-white/10 bg-[#020817] p-0 text-white"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SheetDescription className="sr-only">
          Browse the BizArch ERP sections and open a page.
        </SheetDescription>
        <SidebarBackdrop />
        <div className="relative z-10 flex h-full flex-col">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
