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
  Sparkles,
  Clock,
  Percent,
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
import { useEdition } from "@/hooks/use-edition";

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
  { nameKey: "nav.salesByCustomer", href: "/reports/sales-by-customer", icon: BarChart3 },
  { nameKey: "nav.salesByItem", href: "/reports/sales-by-item", icon: BarChart3 },
  { nameKey: "nav.salesBySalesperson", href: "/reports/sales-by-salesperson", icon: BarChart3 },
  { nameKey: "nav.salesRegister", href: "/reports/sales-register", icon: FileText },
  { nameKey: "nav.customerBalances", href: "/reports/customer-balances", icon: Users },
  { nameKey: "nav.supplierBalances", href: "/reports/supplier-balances", icon: Truck },
  { nameKey: "nav.unifiedLedger", href: "/reports/ledger", icon: BookOpen },
  { nameKey: "nav.trialBalance", href: "/reports/trial-balance", icon: Scale },
  { nameKey: "nav.profitLoss", href: "/reports/profit-loss", icon: TrendingUp },
  { nameKey: "nav.balanceSheet", href: "/reports/balance-sheet", icon: PieChart },
  { nameKey: "nav.cashBook", href: "/reports/cash-book", icon: Wallet },
  { nameKey: "nav.bankBook", href: "/reports/bank-book", icon: Landmark },
  { nameKey: "nav.cashBankSummary", href: "/reports/cash-bank-summary", icon: ArrowRightLeft },
  { nameKey: "nav.cashFlow", href: "/reports/cash-flow", icon: ArrowRightLeft },
  { nameKey: "nav.arAging", href: "/reports/ar-aging", icon: Clock },
  { nameKey: "nav.apAging", href: "/reports/ap-aging", icon: Clock },
  { nameKey: "nav.vatSummary", href: "/reports/vat-summary", icon: Percent, edition: "SAUDI" as const },
  { nameKey: "nav.vatDetail", href: "/reports/vat-detail", icon: Percent, edition: "SAUDI" as const },
  { nameKey: "nav.gstSummary", href: "/reports/gst-summary", icon: Percent, edition: "INDIA" as const },
  { nameKey: "nav.gstDetail", href: "/reports/gst-detail", icon: Percent, edition: "INDIA" as const },
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
  { nameKey: "nav.whatsNew", href: "/admin/whats-new", icon: Sparkles },
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
  "Sales by Customer": "nav.salesByCustomer",
  "Sales by Item": "nav.salesByItem",
  "Sales by Salesperson": "nav.salesBySalesperson",
  "Sales Register": "nav.salesRegister",
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
  "Cash Book": "nav.cashBook",
  "Bank Book": "nav.bankBook",
  "Cash & Bank Summary": "nav.cashBankSummary",
  "AR Aging": "nav.arAging",
  "AP Aging": "nav.apAging",
  "VAT Summary": "nav.vatSummary",
  "VAT Detail": "nav.vatDetail",
  "GST Summary": "nav.gstSummary",
  "GST Detail": "nav.gstDetail",
  "Settings": "nav.settings",
  "Organizations": "nav.organizations",
};

// Reverse map: key → English name (for disabledItems filtering)
const KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_TO_KEY).map(([k, v]) => [v, k])
);

type NavItem = { nameKey: string; href: string; icon: React.ElementType; edition?: "INDIA" | "SAUDI" };

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
        "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors",
        isActive
          ? "border-slate-700 bg-slate-800 text-white"
          : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
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
        className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-slate-800 hover:bg-slate-900 hover:text-white"
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
  const { edition } = useEdition();
  const isSuperadmin = session?.user?.role === "superadmin";

  const { data: disabledItems = [] } = useSWR<string[]>(
    !isSuperadmin && session?.user ? "/api/sidebar" : null,
    fetcher
  );

  // disabledItems come from API as English names; filter by matching English name + edition
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.edition && item.edition !== edition) return false;
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
      <div className="mx-3 mt-3 flex h-[4.5rem] shrink-0 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4">
        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-white p-1.5">
          <Image src="/bizarch-mark.svg" alt="BizArch Logo" fill sizes="36px" className="object-contain" priority />
        </div>
        <div className="min-w-0">
          <span className="block truncate text-lg font-bold text-white">
            {t("nav2.appName")}
          </span>
          <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {t("nav2.workspace")}
          </span>
        </div>
      </div>

      <Separator className="mt-4 shrink-0 bg-white/10" />

      {/* Main Navigation */}
      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 overscroll-contain">
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
      <div className="shrink-0 px-3 py-4">
        <Separator className="mb-4 bg-white/10" />
        {!isSuperadmin && visibleBottom.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.nameKey}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
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
          className="mt-1 h-11 w-full justify-start gap-3 rounded-xl border border-transparent px-3.5 text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
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
  const { t } = useLanguage();
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
    setUpdateStatus(t("nav2.checkingForUpdates"));
    await window.electronPOS!.checkForUpdates();
  }, [isElectron]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 w-full justify-start gap-3 rounded-xl border border-transparent px-3.5 text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
        >
          <Info className="h-5 w-5" />
          {t("nav2.about")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("nav2.aboutTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("nav2.version")}</span>
              <span className="text-sm font-medium">{appVersion ?? t("nav2.web")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("nav2.platform")}</span>
              <span className="text-sm font-medium">
                {isElectron ? (window.electronPOS!.platform === "win32" ? t("nav2.windows") : window.electronPOS!.platform === "darwin" ? t("nav2.macos") : t("nav2.linux")) : t("nav2.browser")}
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
                  {t("nav2.checkForUpdates")}
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
            &copy; {new Date().getFullYear()} {t("nav2.copyright")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Sidebar() {
  const { isRTL } = useLanguage();
  return (
    <div
      className={`hidden h-screen min-h-0 w-72 shrink-0 self-stretch overflow-hidden border-slate-800 bg-slate-950 text-white ${isRTL ? "border-l" : "border-r"} md:sticky md:top-0 md:flex`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <SidebarContent />
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const { t, isRTL } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("nav2.toggleMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isRTL ? "right" : "left"}
        className="flex h-full min-h-0 w-[min(22rem,88vw)] flex-col overflow-hidden border-slate-800 bg-slate-950 p-0 text-white"
      >
        <SheetTitle className="sr-only">{t("nav2.navigationMenu")}</SheetTitle>
        <SheetDescription className="sr-only">
          {t("nav2.navigationMenuDesc")}
        </SheetDescription>
        <div className="flex h-full min-h-0 flex-col">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
