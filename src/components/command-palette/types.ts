import { type LucideIcon } from "lucide-react";

export type CommandGroup =
  | "recent"
  | "quick-actions"
  | "navigation"
  | "products"
  | "customers"
  | "suppliers"
  | "invoices"
  | "purchase-invoices"
  | "devices"
  | "imei"
  | "calculator";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  group: CommandGroup;
  keywords: string[];
  shortcut?: string;
  action: () => void;
  requiresRole?: ("superadmin" | "admin" | "user")[];
  requiresFeature?: (
    | "multiBranchEnabled"
    | "isMobileShopModuleEnabled"
    | "gstEnabled"
  )[];
}

export interface RecentItem {
  id: string;
  label: string;
  iconName: string;
  href: string;
  timestamp: number;
}

export interface SearchResults {
  products?: Array<{
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    sellingPrice: number;
  }>;
  customers?: Array<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  }>;
  suppliers?: Array<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    customer?: { name: string } | null;
    total: number;
    status: string;
  }>;
  purchaseInvoices?: Array<{
    id: string;
    purchaseInvoiceNumber: string;
    supplier?: { name: string } | null;
    total: number;
  }>;
  devices?: Array<{
    id: string;
    imei1: string;
    brand: string;
    model: string;
    status: string;
  }>;
}
