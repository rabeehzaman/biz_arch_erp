import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  CreditCard,
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
  Scale,
  TrendingUp,
  PieChart,
  DollarSign,
  ArrowRightLeft,
  GitBranch,
  Smartphone,
  Search,
  Settings,
  Wrench,
  Building2,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import type { CommandItem } from "../types";

export type NavDef = {
  name: string;
  href: string;
  icon: React.ElementType;
  keywords?: string[];
  requiresFeature?: CommandItem["requiresFeature"];
  requiresRole?: CommandItem["requiresRole"];
};

// Core navigation — always visible (non-superadmin)
export const coreNav: NavDef[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["home", "main", "overview"] },
  { name: "POS Terminal", href: "/pos", icon: Monitor, keywords: ["point of sale", "register", "checkout", "sell"] },
  { name: "Products", href: "/products", icon: Package, keywords: ["items", "inventory", "catalog", "goods"] },
];

// Sales
export const salesNav: NavDef[] = [
  { name: "Customers", href: "/customers", icon: Users, keywords: ["clients", "buyers", "contacts"] },
  { name: "Quotations", href: "/quotations", icon: FileCheck, keywords: ["quotes", "estimates", "proposals"] },
  { name: "Sales Invoices", href: "/invoices", icon: FileText, keywords: ["bills", "sales", "invoice"] },
  { name: "Credit Notes", href: "/credit-notes", icon: FileMinus, keywords: ["returns", "refunds", "credit"] },
  { name: "Customer Payments", href: "/payments", icon: CreditCard, keywords: ["collections", "receipts", "receive"] },
];

// Purchases
export const purchasesNav: NavDef[] = [
  { name: "Suppliers", href: "/suppliers", icon: Truck, keywords: ["vendors", "seller"] },
  { name: "Purchase Invoices", href: "/purchase-invoices", icon: Receipt, keywords: ["bills", "buying", "purchase"] },
  { name: "Debit Notes", href: "/debit-notes", icon: FileOutput, keywords: ["purchase returns", "debit"] },
  { name: "Supplier Payments", href: "/supplier-payments", icon: Wallet, keywords: ["payments out", "pay vendor"] },
];

// Accounting
export const accountingNav: NavDef[] = [
  { name: "Expenses", href: "/accounting/expenses", icon: CircleDollarSign, keywords: ["costs", "spending", "outflow"] },
  { name: "Cash & Bank", href: "/accounting/cash-bank", icon: Landmark, keywords: ["bank accounts", "cash register", "bank"] },
  { name: "Journal Entries", href: "/accounting/journal-entries", icon: BookOpen, keywords: ["JE", "adjustments", "journal"] },
  { name: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: Scale, keywords: ["COA", "ledger accounts", "accounts"] },
];

// Inventory (requires multiBranchEnabled)
export const inventoryNav: NavDef[] = [
  { name: "Branches", href: "/inventory/branches", icon: GitBranch, keywords: ["locations", "stores", "branch"], requiresFeature: ["multiBranchEnabled"] },
  { name: "Stock Transfers", href: "/inventory/stock-transfers", icon: ArrowRightLeft, keywords: ["move stock", "transfer"], requiresFeature: ["multiBranchEnabled"] },
  { name: "Opening Stock", href: "/inventory/opening-stock", icon: Package, keywords: ["initial stock", "opening"], requiresFeature: ["multiBranchEnabled"] },
];

// Mobile Shop (requires isMobileShopModuleEnabled)
export const mobileShopNav: NavDef[] = [
  { name: "IMEI Lookup", href: "/mobile-shop/imei-lookup", icon: Search, keywords: ["device search", "phone lookup", "imei"], requiresFeature: ["isMobileShopModuleEnabled"] },
  { name: "Device Inventory", href: "/mobile-shop/device-inventory", icon: Smartphone, keywords: ["phones", "mobile stock", "devices"], requiresFeature: ["isMobileShopModuleEnabled"] },
];

// Reports
export const reportsNav: NavDef[] = [
  { name: "Profit by Items", href: "/reports/profit-by-items", icon: BarChart3, keywords: ["item profitability", "margin"] },
  { name: "Customer Balances", href: "/reports/customer-balances", icon: Users, keywords: ["receivables", "AR", "customer report"] },
  { name: "Supplier Balances", href: "/reports/supplier-balances", icon: Truck, keywords: ["payables", "AP", "supplier report"] },
  { name: "Unified Ledger", href: "/reports/ledger", icon: BookOpen, keywords: ["account ledger", "transactions", "ledger"] },
  { name: "Trial Balance", href: "/reports/trial-balance", icon: Scale, keywords: ["TB", "trial"] },
  { name: "Profit & Loss", href: "/reports/profit-loss", icon: TrendingUp, keywords: ["P&L", "income statement", "profit"] },
  { name: "Balance Sheet", href: "/reports/balance-sheet", icon: PieChart, keywords: ["BS", "financial position", "assets"] },
  { name: "Cash Flow", href: "/reports/cash-flow", icon: ArrowRightLeft, keywords: ["cash flow statement"] },
  { name: "Expense Report", href: "/reports/expense-report", icon: DollarSign, keywords: ["expense analysis", "costs"] },
  { name: "Stock Summary", href: "/reports/stock-summary", icon: Package, keywords: ["inventory report", "stock levels"] },
  { name: "Branch P&L", href: "/reports/branch-pl", icon: GitBranch, keywords: ["branch profitability"], requiresFeature: ["multiBranchEnabled"] },
];

// Settings & admin (non-superadmin)
export const settingsNav: NavDef[] = [
  { name: "Settings", href: "/settings", icon: Settings, keywords: ["preferences", "configuration", "setup"] },
  { name: "Fix Balances", href: "/admin/fix-balances", icon: Wrench, keywords: ["recalculate", "repair", "fix"] },
];

// Superadmin only
export const superadminNav: NavDef[] = [
  { name: "Organizations", href: "/admin/organizations", icon: Building2, keywords: ["orgs", "tenants", "companies"], requiresRole: ["superadmin"] },
];

// Section labels used for sidebar grouping (mirrors sidebar.tsx)
export const navSections = [
  { title: "Sales", icon: ShoppingCart, items: salesNav },
  { title: "Purchases", icon: Truck, items: purchasesNav },
  { title: "Accounting", icon: BookOpen, items: accountingNav },
  { title: "Inventory", icon: Warehouse, items: inventoryNav, requiresFeature: "multiBranchEnabled" as const },
  { title: "Mobile Shop", icon: Smartphone, items: mobileShopNav, requiresFeature: "isMobileShopModuleEnabled" as const },
  { title: "Reports", icon: BarChart3, items: reportsNav },
];
