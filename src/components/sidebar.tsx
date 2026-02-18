"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Warehouse,
  Wrench,
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
  ChevronDown,
  ChevronRight,
  Scale,
  TrendingUp,
  PieChart,
  DollarSign,
  ArrowRightLeft,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Products", href: "/products", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Warehouse },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Quotations", href: "/quotations", icon: FileCheck },
  { name: "Sales Invoices", href: "/invoices", icon: FileText },
  { name: "Credit Notes", href: "/credit-notes", icon: FileMinus },
  { name: "Purchase Invoices", href: "/purchase-invoices", icon: Receipt },
  { name: "Debit Notes", href: "/debit-notes", icon: FileOutput },
  { name: "Customer Payments", href: "/payments", icon: CreditCard },
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
  { name: "Trial Balance", href: "/reports/trial-balance", icon: Scale },
  { name: "Profit & Loss", href: "/reports/profit-loss", icon: TrendingUp },
  { name: "Balance Sheet", href: "/reports/balance-sheet", icon: PieChart },
  { name: "Cash Flow", href: "/reports/cash-flow", icon: ArrowRightLeft },
  { name: "Expense Report", href: "/reports/expense-report", icon: DollarSign },
];

const bottomNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Fix Balances", href: "/admin/fix-balances", icon: Wrench },
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

  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Building2 className="h-5 w-5 text-primary-foreground" />
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
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}

            <Separator className="my-3 bg-slate-700" />

            <CollapsibleSection
              title="Accounting"
              icon={BookOpen}
              items={accountingNavigation}
              pathname={pathname}
              onNavigate={onNavigate}
            />

            <CollapsibleSection
              title="Reports"
              icon={BarChart3}
              items={reportsNavigation}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          </>
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="px-3 py-4">
        <Separator className="mb-4 bg-slate-700" />
        {!isSuperadmin && bottomNavigation.map((item) => {
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
    <div className="hidden md:flex h-full w-64 flex-col bg-slate-900 text-white">
      <SidebarContent />
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-slate-900 text-white border-slate-700">
        <div className="flex h-full flex-col">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
