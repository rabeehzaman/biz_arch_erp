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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "POS Terminal", href: "/pos", icon: Monitor },
  { name: "Products", href: "/products", icon: Package },
];

const salesNavigation = [
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Quotations", href: "/quotations", icon: FileCheck },
  { name: "Sales Invoices", href: "/invoices", icon: FileText },
  { name: "Credit Notes", href: "/credit-notes", icon: FileMinus },
  { name: "Customer Payments", href: "/payments", icon: CreditCard },
];

const purchasesNavigation = [
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Purchase Invoices", href: "/purchase-invoices", icon: Receipt },
  { name: "Debit Notes", href: "/debit-notes", icon: FileOutput },
  { name: "Supplier Payments", href: "/supplier-payments", icon: Wallet },
];

const accountingNavigation = [
  { name: "Expenses", href: "/accounting/expenses", icon: CircleDollarSign },
  { name: "Cash & Bank", href: "/accounting/cash-bank", icon: Landmark },
  { name: "Journal Entries", href: "/accounting/journal-entries", icon: BookOpen },
  { name: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: Scale },
];

const reportsNavigation = [
  { name: "Profit by Items", href: "/reports/profit-by-items", icon: BarChart3 },
  { name: "Customer Balances", href: "/reports/customer-balances", icon: Users },
  { name: "Supplier Balances", href: "/reports/supplier-balances", icon: Truck },
  { name: "Unified Ledger", href: "/reports/ledger", icon: BookOpen },
  { name: "Trial Balance", href: "/reports/trial-balance", icon: Scale },
  { name: "Profit & Loss", href: "/reports/profit-loss", icon: TrendingUp },
  { name: "Balance Sheet", href: "/reports/balance-sheet", icon: PieChart },
  { name: "Cash Flow", href: "/reports/cash-flow", icon: ArrowRightLeft },
  { name: "Expense Report", href: "/reports/expense-report", icon: DollarSign },
  { name: "Stock Summary", href: "/reports/stock-summary", icon: Package },
  { name: "Branch P&L", href: "/reports/branch-pl", icon: GitBranch },
];

const bottomNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Fix Balances", href: "/admin/fix-balances", icon: Wrench },
];

const inventoryNavigation = [
  { name: "Branches", href: "/inventory/branches", icon: GitBranch },
  { name: "Stock Transfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft },
  { name: "Opening Stock", href: "/inventory/opening-stock", icon: Package },
];

const mobileShopNavigation = [
  { name: "IMEI Lookup", href: "/mobile-shop/imei-lookup", icon: Search },
  { name: "Device Inventory", href: "/mobile-shop/device-inventory", icon: Smartphone },
];

const superadminNavigation = [
  { name: "Organizations", href: "/admin/organizations", icon: Building2 },
];

function NavItem({ item, pathname, onNavigate }: {
  item: { name: string; href: string; icon: React.ElementType };
  pathname: string;
  onNavigate?: () => void;
}) {
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
      {item.name}
    </Link>
  );
}

function CollapsibleSection({ title, icon: Icon, items, pathname, onNavigate, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  items: { name: string; href: string; icon: React.ElementType }[];
  pathname: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
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
        <span className="flex-1 text-left">{title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="ml-3 space-y-1">
          {items.map((item) => (
            <NavItem key={item.name} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === "superadmin";

  const { data: disabledItems = [] } = useSWR<string[]>(
    !isSuperadmin && session?.user ? "/api/sidebar" : null,
    fetcher
  );

  const filterItems = (items: { name: string; href: string; icon: any }[]) =>
    items.filter((item) => !disabledItems.includes(item.name));

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
            <NavItem key={item.name} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))
        ) : (
          <>
            {visibleNav.map((item) => (
              <NavItem key={item.name} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}

            {visibleSales.length > 0 && (
              <CollapsibleSection
                title="Sales"
                icon={ShoppingCart}
                items={visibleSales}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {visiblePurchases.length > 0 && (
              <CollapsibleSection
                title="Purchases"
                icon={Truck}
                items={visiblePurchases}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {visibleAccounting.length > 0 && (
              <CollapsibleSection
                title="Accounting"
                icon={BookOpen}
                items={visibleAccounting}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {multiBranchEnabled && visibleInventory.length > 0 && (
              <CollapsibleSection
                title="Inventory"
                icon={Warehouse}
                items={visibleInventory}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {isMobileShopEnabled && visibleMobileShop.length > 0 && (
              <CollapsibleSection
                title="Mobile Shop"
                icon={Smartphone}
                items={visibleMobileShop}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )}

            {visibleReports.length > 0 && (
              <CollapsibleSection
                title="Reports"
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
              key={item.name}
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
              {item.name}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start gap-3 px-3 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <div
      className="hidden md:flex h-full w-64 flex-col relative bg-slate-950 text-white bg-cover bg-no-repeat bg-center border-r border-slate-800"
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
        side="left"
        className="w-64 p-0 relative bg-slate-950 text-white border-slate-800 bg-cover bg-no-repeat bg-center"
        style={{ backgroundImage: "url('/sidebar_bg.png')" }}
      >
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] pointer-events-none z-0"></div>
        <div className="relative z-10 flex h-full flex-col">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
