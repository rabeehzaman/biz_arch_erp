"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Clock,
  Calculator,
  Smartphone,
  Package,
  Users,
  Truck,
  FileText,
  Receipt,
  Loader2,
  X,
} from "lucide-react";

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "./command-palette-provider";
import { useRecentCommands } from "./use-recent-commands";
import { useCommandSearch } from "./use-command-search";
import { isIMEI, isPartialIMEI, extractIMEI } from "./utils/imei-detector";
import { tryEvaluate } from "./utils/calculator";
import {
  coreNav,
  salesNav,
  purchasesNav,
  accountingNav,
  inventoryNav,
  mobileShopNav,
  reportsNav,
  settingsNav,
  superadminNav,
} from "./commands/navigation-commands";
import { quickActions } from "./commands/action-commands";
import type { NavDef } from "./commands/navigation-commands";

type SessionUser = {
  role?: string;
  multiBranchEnabled?: boolean;
  isMobileShopModuleEnabled?: boolean;
};

function useVisibleNav(session: { user?: SessionUser } | null) {
  const user = session?.user;
  const isSuperadmin = user?.role === "superadmin";
  const multiBranch = !!user?.multiBranchEnabled;
  const mobileShop = !!user?.isMobileShopModuleEnabled;

  const filter = (items: NavDef[]) =>
    items.filter((item) => {
      if (item.requiresRole && !item.requiresRole.includes(user?.role as "superadmin" | "admin" | "user")) return false;
      if (item.requiresFeature) {
        return item.requiresFeature.every((f) => {
          if (f === "multiBranchEnabled") return multiBranch;
          if (f === "isMobileShopModuleEnabled") return mobileShop;
          return true;
        });
      }
      return true;
    });

  if (isSuperadmin) {
    return { core: [], sales: [], purchases: [], accounting: [], inventory: [], mobileShop: [], reports: [], settings: [], admin: filter(superadminNav), quickActions: [] };
  }

  return {
    core: filter(coreNav),
    sales: filter(salesNav),
    purchases: filter(purchasesNav),
    accounting: filter(accountingNav),
    inventory: multiBranch ? filter(inventoryNav) : [],
    mobileShop: mobileShop ? filter(mobileShopNav) : [],
    reports: filter(reportsNav),
    settings: filter(settingsNav),
    admin: [],
    quickActions: filter(quickActions),
  };
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { data: session } = useSession();
  const { recents, addRecent, clearRecents } = useRecentCommands();

  const isMobileShopEnabled = !!session?.user?.isMobileShopModuleEnabled;
  const nav = useVisibleNav(session);

  const { results, loading } = useCommandSearch(
    search,
    open && search.trim().length >= 2,
    isMobileShopEnabled
  );

  const calcResult = search.trim().length > 2 ? tryEvaluate(search) : null;
  const imei = extractIMEI(search);
  const partialImei = !imei && isPartialIMEI(search);
  const hasEntityResults = !!(
    results.products?.length ||
    results.customers?.length ||
    results.suppliers?.length ||
    results.invoices?.length ||
    results.purchaseInvoices?.length ||
    results.devices?.length
  );

  const navigate = useCallback(
    (href: string, label: string, iconName: string) => {
      addRecent({ id: href, label, iconName, href, timestamp: Date.now() });
      setOpen(false);
      setSearch("");
      router.push(href);
    },
    [addRecent, setOpen, router]
  );

  const handleOpenChange = useCallback(
    (val: boolean) => {
      setOpen(val);
      if (!val) setSearch("");
    },
    [setOpen]
  );

  const isEmpty = search.trim().length === 0;
  const isSearching = search.trim().length >= 2;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search pages, records, actions..."
        value={search}
        onValueChange={setSearch}
      />

      <CommandList>
        {/* IMEI Detection */}
        {imei && isMobileShopEnabled && (
          <CommandGroup heading="IMEI">
            <CommandItem
              value={`imei-${imei}`}
              onSelect={() => navigate(`/mobile-shop/imei-lookup?imei=${imei}`, `IMEI: ${imei}`, "Smartphone")}
            >
              <Smartphone className="h-4 w-4 text-emerald-600" />
              <div className="flex flex-col">
                <span className="font-medium">Lookup IMEI: {imei}</span>
                <span className="text-xs text-slate-400">Open device info page</span>
              </div>
            </CommandItem>
          </CommandGroup>
        )}

        {partialImei && isMobileShopEnabled && (
          <CommandGroup heading="IMEI">
            <CommandItem value="imei-partial" disabled>
              <Smartphone className="h-4 w-4 text-slate-300" />
              <span className="text-slate-400">Keep typing to complete IMEI ({search.replace(/[\s-]/g, "").length}/15 digits)</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Calculator */}
        {calcResult && (
          <CommandGroup heading="Calculator">
            <CommandItem
              value={`calc-${search}`}
              onSelect={() => {
                navigator.clipboard.writeText(calcResult).catch(() => {});
                toast.success(`Copied ${calcResult} to clipboard`);
                setOpen(false);
                setSearch("");
              }}
            >
              <Calculator className="h-4 w-4 text-blue-500" />
              <div className="flex flex-col">
                <span className="font-medium">= {calcResult}</span>
                <span className="text-xs text-slate-400">Click to copy result</span>
              </div>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Recent (shown when no search) */}
        {isEmpty && recents.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recents.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`recent-${item.href}`}
                  onSelect={() => navigate(item.href, item.label, item.iconName)}
                >
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
              <CommandItem
                value="clear-recents"
                onSelect={() => { clearRecents(); }}
                className="text-slate-400"
              >
                <X className="h-4 w-4" />
                <span>Clear recent history</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        {nav.quickActions.length > 0 && (
          <CommandGroup heading="Quick Actions">
            {nav.quickActions.map((item) => (
              <CommandItem
                key={item.href}
                value={`action-${item.name}-${item.keywords?.join(" ")}`}
                onSelect={() => navigate(item.href, item.name, item.name)}
              >
                <item.icon className="h-4 w-4 text-emerald-600" />
                <span>{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {nav.core.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
          {nav.sales.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
          {nav.purchases.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
          {nav.accounting.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
          {nav.inventory.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
          {nav.mobileShop.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
          {nav.settings.map((item) => (
            <NavCommandItem key={item.href} item={item} onSelect={navigate} />
          ))}
        </CommandGroup>

        {/* Reports */}
        {nav.reports.length > 0 && (
          <CommandGroup heading="Reports">
            {nav.reports.map((item) => (
              <NavCommandItem key={item.href} item={item} onSelect={navigate} />
            ))}
          </CommandGroup>
        )}

        {/* Superadmin */}
        {nav.admin.length > 0 && (
          <CommandGroup heading="Admin">
            {nav.admin.map((item) => (
              <NavCommandItem key={item.href} item={item} onSelect={navigate} />
            ))}
          </CommandGroup>
        )}

        {/* Entity search results */}
        {isSearching && loading && (
          <CommandGroup heading="Searching...">
            <CommandItem value="loading" disabled>
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="text-slate-400">Searching records...</span>
            </CommandItem>
          </CommandGroup>
        )}

        {isSearching && !loading && results.products && results.products.length > 0 && (
          <CommandGroup heading="Products">
            {results.products.map((p) => (
              <CommandItem
                key={p.id}
                value={`product-${p.id}-${p.name}-${p.sku}`}
                onSelect={() => navigate("/products", p.name, "Package")}
              >
                <Package className="h-4 w-4 text-slate-400" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{p.name}</span>
                  {p.sku && <span className="text-xs text-slate-400">SKU: {p.sku}</span>}
                </div>
                {p.sellingPrice != null && (
                  <span className="ml-auto text-xs text-slate-400 shrink-0">
                    ₹{p.sellingPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSearching && !loading && results.customers && results.customers.length > 0 && (
          <CommandGroup heading="Customers">
            {results.customers.map((c) => (
              <CommandItem
                key={c.id}
                value={`customer-${c.id}-${c.name}-${c.email}`}
                onSelect={() => navigate("/customers", c.name, "Users")}
              >
                <Users className="h-4 w-4 text-slate-400" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{c.name}</span>
                  {c.email && <span className="text-xs text-slate-400 truncate">{c.email}</span>}
                </div>
                {c.phone && (
                  <span className="ml-auto text-xs text-slate-400 shrink-0">{c.phone}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSearching && !loading && results.suppliers && results.suppliers.length > 0 && (
          <CommandGroup heading="Suppliers">
            {results.suppliers.map((s) => (
              <CommandItem
                key={s.id}
                value={`supplier-${s.id}-${s.name}-${s.email}`}
                onSelect={() => navigate("/suppliers", s.name, "Truck")}
              >
                <Truck className="h-4 w-4 text-slate-400" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{s.name}</span>
                  {s.email && <span className="text-xs text-slate-400 truncate">{s.email}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSearching && !loading && results.invoices && results.invoices.length > 0 && (
          <CommandGroup heading="Sales Invoices">
            {results.invoices.map((inv) => (
              <CommandItem
                key={inv.id}
                value={`invoice-${inv.id}-${inv.invoiceNumber}`}
                onSelect={() => navigate(`/invoices/${inv.id}`, inv.invoiceNumber, "FileText")}
              >
                <FileText className="h-4 w-4 text-slate-400" />
                <div className="flex flex-col min-w-0">
                  <span>{inv.invoiceNumber}</span>
                  {inv.customer?.name && (
                    <span className="text-xs text-slate-400">{inv.customer.name}</span>
                  )}
                </div>
                {inv.total != null && (
                  <span className="ml-auto text-xs text-slate-400 shrink-0">
                    ₹{inv.total.toLocaleString("en-IN")}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSearching && !loading && results.purchaseInvoices && results.purchaseInvoices.length > 0 && (
          <CommandGroup heading="Purchase Invoices">
            {results.purchaseInvoices.map((inv) => (
              <CommandItem
                key={inv.id}
                value={`pi-${inv.id}-${inv.purchaseInvoiceNumber}`}
                onSelect={() => navigate(`/purchase-invoices/${inv.id}`, inv.purchaseInvoiceNumber, "Receipt")}
              >
                <Receipt className="h-4 w-4 text-slate-400" />
                <div className="flex flex-col min-w-0">
                  <span>{inv.purchaseInvoiceNumber}</span>
                  {inv.supplier?.name && (
                    <span className="text-xs text-slate-400">{inv.supplier.name}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSearching && !loading && results.devices && results.devices.length > 0 && (
          <CommandGroup heading="Devices">
            {results.devices.map((d) => (
              <CommandItem
                key={d.id}
                value={`device-${d.id}-${d.imei1}-${d.brand}-${d.model}`}
                onSelect={() => navigate(`/mobile-shop/imei-lookup?imei=${d.imei1}`, `${d.brand} ${d.model}`, "Smartphone")}
              >
                <Smartphone className="h-4 w-4 text-slate-400" />
                <div className="flex flex-col min-w-0">
                  <span>{d.brand} {d.model}</span>
                  <span className="text-xs text-slate-400">{d.imei1}</span>
                </div>
                <span className="ml-auto text-xs text-slate-400 shrink-0">{d.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {isSearching && !loading && !hasEntityResults && !imei && !partialImei && (
          <CommandEmpty>No results found for &quot;{search}&quot;</CommandEmpty>
        )}
      </CommandList>

      {/* Footer hints */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            Close
          </span>
        </div>
        <span>BizArch ERP</span>
      </div>
    </CommandDialog>
  );
}

function NavCommandItem({
  item,
  onSelect,
}: {
  item: NavDef;
  onSelect: (href: string, label: string, iconName: string) => void;
}) {
  return (
    <CommandItem
      value={`nav-${item.href}-${item.name}-${item.keywords?.join(" ")}`}
      onSelect={() => onSelect(item.href, item.name, item.name)}
    >
      <item.icon className="h-4 w-4 text-slate-400" />
      <span>{item.name}</span>
    </CommandItem>
  );
}
