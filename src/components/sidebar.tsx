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
  Gem,
  Wrench,
  UtensilsCrossed,
  Grid3X3,
  ClipboardList,
  Tags,
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
import { useState, useEffect, useCallback, Fragment, useMemo } from "react";
import { useLanguage } from "@/lib/i18n";
import { useEdition } from "@/hooks/use-edition";
import { useSidebarSectionOrder, useDisabledSidebarItems, useFormConfigLoaded } from "@/hooks/use-form-config";
import { SIDEBAR_SECTIONS } from "@/lib/form-config/types";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";


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
  { nameKey: "nav.priceLists", href: "/price-lists", icon: Tags },
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

const bottomNavigation = [
  { nameKey: "nav.settings", href: "/settings", icon: Settings },
];

const inventoryNavigation = [
  { nameKey: "nav.branches", href: "/inventory/branches", icon: GitBranch },
  { nameKey: "nav.stockTransfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft },
  { nameKey: "nav.openingStock", href: "/inventory/opening-stock", icon: Package },
  { nameKey: "nav.stockTake", href: "/inventory/adjustments", icon: ClipboardList },
];

const mobileShopNavigation = [
  { nameKey: "nav.imeiLookup", href: "/mobile-shop/imei-lookup", icon: Search },
  { nameKey: "nav.deviceInventory", href: "/mobile-shop/device-inventory", icon: Smartphone },
];

const jewelleryShopNavigation = [
  { nameKey: "nav.jewelleryDashboard", href: "/jewellery-shop/dashboard", icon: LayoutDashboard },
  { nameKey: "nav.jewellerySale", href: "/jewellery-shop/sale", icon: ShoppingCart },
  { nameKey: "nav.goldRates", href: "/jewellery-shop/gold-rates", icon: BarChart3 },
  { nameKey: "nav.jewelleryInventory", href: "/jewellery-shop/inventory", icon: Package },
  { nameKey: "nav.oldGoldExchange", href: "/jewellery-shop/old-gold", icon: ArrowRightLeft },
  { nameKey: "nav.karigars", href: "/jewellery-shop/karigars", icon: Users },
  { nameKey: "nav.jewelleryRepairs", href: "/jewellery-shop/repairs", icon: Wrench },
  { nameKey: "nav.customerSchemes", href: "/jewellery-shop/schemes", icon: CreditCard },
  { nameKey: "nav.jewelleryReports", href: "/jewellery-shop/reports", icon: BarChart3 },
];

const restaurantNavigation = [
  { nameKey: "nav.restaurantDashboard", href: "/restaurant/dashboard", icon: LayoutDashboard },
  { nameKey: "nav.restaurantTables", href: "/restaurant/tables", icon: Grid3X3 },
  { nameKey: "nav.restaurantKotHistory", href: "/restaurant/kot-history", icon: ClipboardList },
];

// When jewellery module is enabled, items integrate into existing sections
const jewelleryGeneralNav: NavItem[] = [
  { nameKey: "nav.jewelleryDashboard", href: "/jewellery-shop/dashboard", icon: LayoutDashboard },
  { nameKey: "nav.jewelleryInventory", href: "/jewellery-shop/inventory", icon: Package },
  { nameKey: "nav.goldRates", href: "/jewellery-shop/gold-rates", icon: BarChart3 },
];

const jewellerySalesNav: NavItem[] = [
  { nameKey: "nav.customers", href: "/customers", icon: Users },
  { nameKey: "nav.jewellerySale", href: "/jewellery-shop/sale", icon: ShoppingCart },
  { nameKey: "nav.customerPayments", href: "/payments", icon: CreditCard },
  { nameKey: "nav.oldGoldExchange", href: "/jewellery-shop/old-gold", icon: ArrowRightLeft },
  { nameKey: "nav.customerSchemes", href: "/jewellery-shop/schemes", icon: CreditCard },
];

const jewelleryPurchasesNav: NavItem[] = [
  ...purchasesNavigation,
  { nameKey: "nav.karigars", href: "/jewellery-shop/karigars", icon: Users },
  { nameKey: "nav.jewelleryRepairs", href: "/jewellery-shop/repairs", icon: Wrench },
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
  "Price Lists": "nav.priceLists",
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
  "Stock Take": "nav.stockTake",
  "IMEI Lookup": "nav.imeiLookup",
  "Device Inventory": "nav.deviceInventory",
  "Jewellery Dashboard": "nav.jewelleryDashboard",
  "Gold Rates": "nav.goldRates",
  "Jewellery Inventory": "nav.jewelleryInventory",
  "Old Gold Exchange": "nav.oldGoldExchange",
  "Karigars": "nav.karigars",
  "Jewellery Repairs": "nav.jewelleryRepairs",
  "Jewellery Sale": "nav.jewellerySale",
  "Customer Schemes": "nav.customerSchemes",
  "Jewellery Reports": "nav.jewelleryReports",
  "Restaurant Dashboard": "nav.restaurantDashboard",
  "Tables": "nav.restaurantTables",
  "KOT History": "nav.restaurantKotHistory",
  "Profit by Items": "nav.profitByItems",
  "Sales by Customer": "nav.salesByCustomer",
  "Sales by Item": "nav.salesByItem",
  "Sales by Salesperson": "nav.salesBySalesperson",
  "Sales Register": "nav.salesRegister",
  "Purchase Register": "nav.purchaseRegister",
  "Purchases by Supplier": "nav.purchasesBySupplier",
  "Purchases by Item": "nav.purchasesByItem",
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

function NavItemComponent({ item, pathname, onNavigate, collapsed }: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { t } = useLanguage();
  const isActive = pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? t(item.nameKey) : undefined}
      className={cn(
        "flex items-center rounded-xl border text-sm font-medium transition-colors",
        collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3",
        isActive
          ? "border-slate-700 bg-slate-800 text-white"
          : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{t(item.nameKey)}</span>}
    </Link>
  );
}

function CollapsibleSection({ title, icon: Icon, items, pathname, onNavigate, defaultOpen = false, collapsed }: {
  title: string;
  icon: React.ElementType;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
  collapsed?: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const hasActive = items.some(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActive);

  // In collapsed mode, show just the section icon. Click toggles expansion.
  if (collapsed) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          title={t(title)}
          className={cn(
            "flex w-full items-center justify-center rounded-xl border py-3 text-sm font-medium transition-colors",
            hasActive
              ? "border-slate-700 bg-slate-800 text-white"
              : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
        {isOpen && (
          <div className="mt-1 space-y-1">
            {items.map((item) => (
              <NavItemComponent key={item.nameKey} item={item} pathname={pathname} onNavigate={onNavigate} collapsed />
            ))}
          </div>
        )}
      </div>
    );
  }

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

function SidebarContent({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { edition } = useEdition();
  const isSuperadmin = session?.user?.role === "superadmin";

  const disabledItems = useDisabledSidebarItems();
  const isConfigLoaded = useFormConfigLoaded();

  // disabledItems come from API as English names; filter by matching English name + edition
  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.edition && item.edition !== edition) return false;
      const englishName = KEY_TO_NAME[item.nameKey];
      return !disabledItems.includes(englishName || "");
    });

  const multiBranchEnabled = session?.user?.multiBranchEnabled;
  const isMobileShopEnabled = session?.user?.isMobileShopModuleEnabled;
  const isJewelleryEnabled = session?.user?.isJewelleryModuleEnabled;
  const isRestaurantEnabled = (session?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled;
  const isPriceListEnabled = (session?.user as { isPriceListEnabled?: boolean })?.isPriceListEnabled;

  // When jewellery is enabled, integrate jewellery items into existing sections
  const visibleNav = filterItems(isJewelleryEnabled ? jewelleryGeneralNav : navigation);
  const visibleSales = filterItems(isJewelleryEnabled ? jewellerySalesNav : salesNavigation).filter(
    (item) => item.nameKey !== "nav.priceLists" || isPriceListEnabled
  );
  const visiblePurchases = filterItems(isJewelleryEnabled ? jewelleryPurchasesNav : purchasesNavigation);
  const visibleAccounting = filterItems(accountingNavigation);
  const visibleBottom = filterItems(bottomNavigation);
  const visibleInventory = filterItems(inventoryNavigation);
  const visibleMobileShop = filterItems(mobileShopNavigation);
  const visibleRestaurant = filterItems(restaurantNavigation);
  const sidebarOrder = useSidebarSectionOrder();

  // Data-driven section rendering — allows configurable order
  const sectionRenderers = useMemo(() => {
    const map: Record<string, () => React.ReactNode> = {
      general: () =>
        visibleNav.length > 0
          ? visibleNav.map((item) => (
              <NavItemComponent key={item.nameKey} item={item} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
            ))
          : null,
      sales: () =>
        visibleSales.length > 0 ? (
          <CollapsibleSection title="nav.sales" icon={ShoppingCart} items={visibleSales} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ) : null,
      purchases: () =>
        visiblePurchases.length > 0 ? (
          <CollapsibleSection title="nav.purchases" icon={Truck} items={visiblePurchases} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ) : null,
      accounting: () =>
        visibleAccounting.length > 0 ? (
          <CollapsibleSection title="nav.accounting" icon={BookOpen} items={visibleAccounting} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ) : null,
      inventory: () => {
        // Filter inventory items: branches and stock transfers need multiBranch, but opening stock and stock take always show
        const multiBranchOnly = new Set(["nav.branches", "nav.stockTransfers"]);
        const items = visibleInventory.filter(
          (item) => multiBranchEnabled || !multiBranchOnly.has(item.nameKey)
        );
        return items.length > 0 ? (
          <CollapsibleSection title="nav.inventory" icon={Warehouse} items={items} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ) : null;
      },
      mobileShop: () =>
        isMobileShopEnabled && visibleMobileShop.length > 0 ? (
          <CollapsibleSection title="nav.mobileShop" icon={Smartphone} items={visibleMobileShop} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ) : null,
      // When jewellery enabled, items are integrated into General/Sales/Purchases
      jewellery: () => null,
      restaurant: () =>
        isRestaurantEnabled && visibleRestaurant.length > 0 ? (
          <CollapsibleSection title="nav.restaurant" icon={UtensilsCrossed} items={visibleRestaurant} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ) : null,
    };
    return map;
  }, [visibleNav, visibleSales, visiblePurchases, visibleAccounting, visibleInventory, visibleMobileShop, visibleRestaurant, multiBranchEnabled, isMobileShopEnabled, isJewelleryEnabled, isRestaurantEnabled, pathname, onNavigate, collapsed]);

  const orderedSections = sidebarOrder ?? [...SIDEBAR_SECTIONS];

  return (
    <>
      {/* Logo */}
      <div className={cn(
        "mx-3 mt-3 flex shrink-0 items-center rounded-2xl border border-slate-800 bg-slate-900",
        collapsed ? "h-14 justify-center px-2" : "h-[4.5rem] gap-3 px-4"
      )}>
        <div className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-white",
          collapsed ? "h-8 w-8 p-1" : "h-10 w-10 p-1.5"
        )}>
          <Image src="/bizarch-mark.svg" alt="BizArch Logo" fill sizes="36px" className="object-contain" priority />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="block truncate text-lg font-bold text-white">
              {t("nav2.appName")}
            </span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-400">
              {t("nav2.workspace")}
            </span>
          </div>
        )}
      </div>

      <Separator className="mt-4 shrink-0 bg-white/10" />

      {/* Main Navigation */}
      <nav className={cn(
        "min-h-0 flex-1 space-y-1.5 overflow-y-auto py-4 overscroll-contain transition-opacity duration-150",
        collapsed ? "px-2" : "px-3",
        !isSuperadmin && !isConfigLoaded && "opacity-0"
      )}>
        {isSuperadmin ? (
          superadminNavigation.map((item) => (
            <NavItemComponent key={item.nameKey} item={item} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
          ))
        ) : (
          <>
            {orderedSections.map((sectionKey) => {
              const renderer = sectionRenderers[sectionKey];
              const content = renderer?.();
              return content ? <Fragment key={sectionKey}>{content}</Fragment> : null;
            })}

            <NavItemComponent
              item={{ nameKey: "nav.reports", href: "/reports", icon: BarChart3 }}
              pathname={pathname}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className={cn(
        "shrink-0 py-4 transition-opacity duration-150",
        collapsed ? "px-2" : "px-3",
        !isSuperadmin && !isConfigLoaded && "opacity-0"
      )}>
        <Separator className="mb-4 bg-white/10" />
        {!isSuperadmin && visibleBottom.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.nameKey}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? t(item.nameKey) : undefined}
              className={cn(
                "flex items-center rounded-xl border text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3",
                isActive
                  ? "border-slate-700 bg-slate-800 text-white"
                  : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {!collapsed && t(item.nameKey)}
            </Link>
          );
        })}
        {!collapsed && <AboutDialog />}
        <Button
          variant="ghost"
          title={collapsed ? t("nav.signOut") : undefined}
          className={cn(
            "mt-1 h-11 w-full rounded-xl border border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white",
            collapsed ? "justify-center px-0" : "justify-start gap-3 px-3.5"
          )}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && t("nav.signOut")}
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
  const { isRTL, t } = useLanguage();
  const { collapsed, toggle } = useSidebarCollapsed();
  return (
    <div
      className={cn(
        "hidden h-screen min-h-0 shrink-0 self-stretch overflow-hidden border-slate-800 bg-slate-950 text-white transition-[width] duration-200 ease-in-out md:sticky md:top-0 md:flex",
        collapsed ? "w-[4.5rem]" : "w-72",
        isRTL ? "border-l" : "border-r"
      )}
    >
      <div className="relative flex h-full min-h-0 w-full flex-col">
        <SidebarContent collapsed={collapsed} />
        {/* Collapse toggle button */}
        <button
          onClick={toggle}
          title={collapsed ? t("nav2.expandSidebar") : t("nav2.collapseSidebar")}
          className={cn(
            "absolute top-[5.5rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
            isRTL ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
          )}
        >
          <ChevronRight className={cn(
            "h-3.5 w-3.5 transition-transform",
            collapsed ? "" : "rotate-180",
            isRTL && !collapsed ? "rotate-0" : "",
            isRTL && collapsed ? "rotate-180" : ""
          )} />
        </button>
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
