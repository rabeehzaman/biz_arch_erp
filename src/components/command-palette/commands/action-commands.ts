import {
  Plus,
  FileText,
  FileCheck,
  Receipt,
  FileMinus,
  FileOutput,
  CircleDollarSign,
  BookOpen,
  Monitor,
  Smartphone,
} from "lucide-react";
import type { NavDef } from "./navigation-commands";

export const quickActions: NavDef[] = [
  { name: "New Sales Invoice", href: "/invoices/new", icon: FileText, keywords: ["create", "new sale", "sell", "invoice"] },
  { name: "New Quotation", href: "/quotations/new", icon: FileCheck, keywords: ["create", "new quote", "estimate", "proposal"] },
  { name: "New Purchase Invoice", href: "/purchase-invoices/new", icon: Receipt, keywords: ["create", "buy", "purchase", "vendor bill"] },
  { name: "New Credit Note", href: "/credit-notes/new", icon: FileMinus, keywords: ["create", "sales return", "refund", "credit"] },
  { name: "New Debit Note", href: "/debit-notes/new", icon: FileOutput, keywords: ["create", "purchase return", "debit"] },
  { name: "New Expense", href: "/accounting/expenses/new", icon: CircleDollarSign, keywords: ["create", "add expense", "cost"] },
  { name: "New Journal Entry", href: "/accounting/journal-entries/new", icon: BookOpen, keywords: ["create", "JE", "adjustment"] },
  { name: "Add Device (IMEI)", href: "/mobile-shop/device-inventory", icon: Smartphone, keywords: ["create", "add phone", "mobile", "imei"], requiresFeature: ["isMobileShopModuleEnabled"] },
  { name: "Open POS Terminal", href: "/pos", icon: Monitor, keywords: ["sell", "ring up", "cashier", "retail"] },
];
