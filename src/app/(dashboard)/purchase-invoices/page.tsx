"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, Receipt, Eye, Trash2, SlidersHorizontal, Columns3 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/mobile/pull-to-refresh-indicator";
import { FloatingActionButton } from "@/components/mobile/floating-action-button";
import { SwipeableCard } from "@/components/mobile/swipeable-card";
import { AdvancedSearchModal } from "@/components/list-page/advanced-search-modal";
import { ViewsDropdown } from "@/components/list-page/views-dropdown";
import { SaveViewDialog } from "@/components/list-page/save-view-dialog";
import { PURCHASE_INVOICE_SEARCH_FIELDS } from "@/lib/advanced-search-configs";
import { PURCHASE_INVOICE_SYSTEM_VIEWS } from "@/lib/system-views";
import { useCustomViews } from "@/hooks/use-custom-views";
import { ColumnCustomizer } from "@/components/list-page/column-customizer";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PURCHASE_INVOICE_COLUMNS } from "@/lib/column-configs";

interface PurchaseInvoice {
  id: string;
  purchaseInvoiceNumber: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
  };
  invoiceDate: string;
  dueDate: string;
  status: string;
  supplierInvoiceRef: string | null;
  total: number;
  balanceDue: number;
  branch?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string } | null;
  subtotal?: number;
  amountPaid?: number;
  notes?: string | null;
  _count: {
    items: number;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const {
    activeViewId, activeFilters, statusFilter, setStatusFilter,
    dateFilter, setDateFilter, sortField, sortDirection: sortDir,
    toggleSort, advancedSearch, advancedSearchOpen, setAdvancedSearchOpen,
    activeFilterCount, handleViewChange, handleAdvancedSearch,
    handleResetAdvancedSearch, saveViewDialogOpen, setSaveViewDialogOpen,
    handleSaveView, filtersForSave, sortFieldForSave, sortDirectionForSave,
    viewsRefreshKey, handleViewSaved, editingView, handleEditView,
  } = useCustomViews({ module: "purchase-invoices", systemViews: PURCHASE_INVOICE_SYSTEM_VIEWS });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility("purchase-invoices", PURCHASE_INVOICE_COLUMNS);

  // Merge status filter into API params
  const paginationParams = useMemo(
    (): Record<string, string> => {
      const p: Record<string, string> = { ...activeFilters };
      if (statusFilter !== "all") p.status = statusFilter;
      return p;
    },
    [statusFilter, activeFilters]
  );

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement?.tagName || ""))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const {
    items: invoices,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<PurchaseInvoice>({ url: "/api/purchase-invoices", params: paginationParams });
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refresh });

  const statusLabels: Record<string, string> = {
    DRAFT: t("purchases.statusDraft"),
    RECEIVED: t("purchases.statusReceived"),
    PAID: t("purchases.statusPaid"),
    PARTIALLY_PAID: t("purchases.statusPartial"),
    CANCELLED: t("purchases.statusCancelled"),
  };

  const dateFilteredInvoices = useMemo(() => {
    if (dateFilter === "all") return invoices;
    const now = new Date();
    let cutoff: Date;
    if (dateFilter === "today") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateFilter === "thisMonth") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === "last30") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      cutoff = new Date(0);
    }
    return invoices.filter((inv) => new Date(inv.invoiceDate) >= cutoff);
  }, [invoices, dateFilter]);

  const sortedInvoices = useMemo(() => {
    if (!sortField) return dateFilteredInvoices;
    return [...dateFilteredInvoices].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "invoiceNumber": aVal = a.purchaseInvoiceNumber; bVal = b.purchaseInvoiceNumber; break;
        case "supplier": aVal = a.supplier.name; bVal = b.supplier.name; break;
        case "invoiceDate": aVal = new Date(a.invoiceDate).getTime(); bVal = new Date(b.invoiceDate).getTime(); break;
        case "dueDate": aVal = new Date(a.dueDate).getTime(); bVal = new Date(b.dueDate).getTime(); break;
        case "total": aVal = Number(a.total); bVal = Number(b.total); break;
        case "balance": aVal = Number(a.balanceDue); bVal = Number(b.balanceDue); break;
        default: return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [invoices, sortField, sortDir]);

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("purchases.deletePurchaseInvoice"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/purchase-invoices/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          refresh();
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete purchase invoice:", error);
        }
      },
    });
  };

  return (
    <PageAnimation>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("purchases.purchaseInvoices")}</h2>
              <p className="text-slate-500">{t("purchases.subtitle")}</p>
          </div>
          <Link href="/purchase-invoices/new" className="hidden sm:inline-flex">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("purchases.newPurchase")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] sm:max-w-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t("purchases.searchPurchases")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ViewsDropdown
                  module="purchase-invoices"
                  systemViews={PURCHASE_INVOICE_SYSTEM_VIEWS}
                  activeViewId={activeViewId}
                  onViewChange={handleViewChange}
                  onSaveView={handleSaveView}
                  onEditView={handleEditView}
                  refreshKey={viewsRefreshKey}
                />
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => setColumnsOpen(true)} title={t("views.customizeColumns")}>
                  <Columns3 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="relative shrink-0" onClick={() => setAdvancedSearchOpen(true)} title={t("common.advancedSearch")}>
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white">{activeFilterCount}</span>
                  )}
                </Button>
              </div>
              <div className="flex gap-1">
                {[
                  { value: "all", label: t("common.all") },
                  { value: "today", label: t("common.today") },
                  { value: "thisMonth", label: t("common.thisMonth") },
                  { value: "last30", label: t("common.last30Days") },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDateFilter(opt.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${dateFilter === opt.value ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("purchases.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("purchases.allStatus")}</SelectItem>
                  <SelectItem value="DRAFT">{t("purchases.statusDraft")}</SelectItem>
                  <SelectItem value="RECEIVED">{t("purchases.statusReceived")}</SelectItem>
                  <SelectItem value="PAID">{t("purchases.statusPaid")}</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">{t("purchases.statusPartial")}</SelectItem>
                  <SelectItem value="CANCELLED">{t("purchases.statusCancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={8} rows={5} />
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("purchases.noPurchaseInvoices")}</h3>
                <p className="text-sm text-slate-500">
                  {searchQuery || statusFilter !== "all"
                    ? t("common.noMatchFound")
                    : t("purchases.noPurchaseInvoicesDesc")}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Link href="/purchase-invoices/new" className="mt-4">
                    <Button variant="outline">{t("purchases.newPurchase")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                {selectedIds.size > 0 && (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <span className="text-sm font-medium text-slate-700">
                      {selectedIds.size} {t("common.selected")}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const count = selectedIds.size;
                        setConfirmDialog({
                          title: `${t("common.delete")} ${count} ${t("purchases.purchaseInvoices").toLowerCase()}`,
                          description: t("common.deleteConfirm"),
                          onConfirm: async () => {
                            try {
                              await Promise.all(
                                Array.from(selectedIds).map(id =>
                                  fetch(`/api/purchase-invoices/${id}`, { method: "DELETE" })
                                )
                              );
                              setSelectedIds(new Set());
                              refresh();
                            } catch {
                              toast.error(t("common.error"));
                            }
                          },
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("common.delete")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      {t("common.clearSelection")}
                    </Button>
                  </div>
                )}

                <div className="space-y-3 sm:hidden">
                  {sortedInvoices.map((invoice) => (
                    <SwipeableCard
                      key={invoice.id}
                      actions={
                        <div className="flex h-full flex-col">
                          <Link
                            href={`/purchase-invoices/${invoice.id}`}
                            className="flex flex-1 items-center justify-center bg-slate-600 px-4 text-sm font-medium text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            className="flex flex-1 items-center justify-center bg-red-500 px-4 text-sm font-medium text-white"
                            onClick={() => handleDelete(invoice.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      }
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/purchase-invoices/${invoice.id}`)}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(invoice.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(invoice.id);
                            else next.delete(invoice.id);
                            setSelectedIds(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <div className="flex flex-1 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("purchases.purchaseInvoiceNumber")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">{invoice.purchaseInvoiceNumber}</p>
                          </div>
                          <Badge className={statusColors[invoice.status]}>
                            {statusLabels[invoice.status]}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 min-w-0">
                        <Link href={`/suppliers/${invoice.supplier.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:underline">{invoice.supplier.name}</Link>
                        {invoice.supplier.email && (
                          <p className="mt-1 break-all text-sm text-slate-500">{invoice.supplier.email}</p>
                        )}
                        {invoice.supplierInvoiceRef && (
                          <p className="mt-2 text-sm text-slate-500">
                            {t("common.supplierRef")}: {invoice.supplierInvoiceRef}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.date")}</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("sales.dueDate")}</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.total")}</p>
                          <p className="mt-1 font-semibold text-slate-900">{fmt(Number(invoice.total))}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.balance")}</p>
                          <p className={`mt-1 font-semibold ${Number(invoice.balanceDue) > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {fmt(Number(invoice.balanceDue))}
                          </p>
                        </div>
                      </div>

                      </div>
                    </SwipeableCard>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === invoices.length && invoices.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(new Set(invoices.map(inv => inv.id)));
                              } else {
                                setSelectedIds(new Set());
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </TableHead>
                        <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("invoiceNumber")}>
                          <span className="inline-flex items-center gap-1">
                            {t("purchases.purchaseInvoiceNumber")}
                            {sortField === "invoiceNumber" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                          </span>
                        </TableHead>
                        {isColumnVisible("supplier") && <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("supplier")}>
                          <span className="inline-flex items-center gap-1">
                            {t("suppliers.supplier")}
                            {sortField === "supplier" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                          </span>
                        </TableHead>}
                        {isColumnVisible("supplierRef") && <TableHead>{t("common.supplierRef")}</TableHead>}
                        {isColumnVisible("invoiceDate") && <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("invoiceDate")}>
                          <span className="inline-flex items-center gap-1">
                            {t("common.date")}
                            {sortField === "invoiceDate" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                          </span>
                        </TableHead>}
                        {isColumnVisible("dueDate") && <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("dueDate")}>
                          <span className="inline-flex items-center gap-1">
                            {t("sales.dueDate")}
                            {sortField === "dueDate" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                          </span>
                        </TableHead>}
                        {isColumnVisible("status") && <TableHead>{t("common.status")}</TableHead>}
                        {isColumnVisible("total") && <TableHead className="text-right cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("total")}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">
                            {t("common.total")}
                            {sortField === "total" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                          </span>
                        </TableHead>}
                        {isColumnVisible("balance") && <TableHead className="text-right cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("balance")}>
                          <span className="inline-flex items-center gap-1 justify-end w-full">
                            {t("common.balance")}
                            {sortField === "balance" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                          </span>
                        </TableHead>}
                        {isColumnVisible("branch") && <TableHead>{t("common.branch")}</TableHead>}
                        {isColumnVisible("warehouse") && <TableHead>{t("common.warehouse")}</TableHead>}
                        {isColumnVisible("subtotal") && <TableHead className="text-right">{t("common.subtotal")}</TableHead>}
                        {isColumnVisible("amountPaid") && <TableHead className="text-right">{t("common.amountPaid") || "Amount Paid"}</TableHead>}
                        {isColumnVisible("notes") && <TableHead>{t("common.notes")}</TableHead>}
                        {isColumnVisible("itemCount") && <TableHead className="text-right">{t("common.items")}</TableHead>}
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedInvoices.map((invoice) => (
                        <TableRow key={invoice.id} onClick={() => router.push(`/purchase-invoices/${invoice.id}`)} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(invoice.id)}
                              onChange={(e) => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(invoice.id);
                                else next.delete(invoice.id);
                                setSelectedIds(next);
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {invoice.purchaseInvoiceNumber}
                          </TableCell>
                          {isColumnVisible("supplier") && <TableCell>
                            <div>
                              <Link href={`/suppliers/${invoice.supplier.id}`} className="font-medium hover:underline">{invoice.supplier.name}</Link>
                              {invoice.supplier.email && (
                                <div className="text-sm text-slate-500">
                                  {invoice.supplier.email}
                                </div>
                              )}
                            </div>
                          </TableCell>}
                          {isColumnVisible("supplierRef") && <TableCell>
                            {invoice.supplierInvoiceRef || "-"}
                          </TableCell>}
                          {isColumnVisible("invoiceDate") && <TableCell>
                            {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                          </TableCell>}
                          {isColumnVisible("dueDate") && <TableCell>
                            {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                          </TableCell>}
                          {isColumnVisible("status") && <TableCell>
                            <Badge className={statusColors[invoice.status]}>
                              {statusLabels[invoice.status]}
                            </Badge>
                          </TableCell>}
                          {isColumnVisible("total") && <TableCell className="text-right">
                            {fmt(Number(invoice.total))}
                          </TableCell>}
                          {isColumnVisible("balance") && <TableCell className="text-right">
                            <span
                              className={
                                Number(invoice.balanceDue) > 0
                                  ? "text-orange-600 font-medium"
                                  : "text-green-600"
                              }
                            >
                              {fmt(Number(invoice.balanceDue))}
                            </span>
                          </TableCell>}
                          {isColumnVisible("branch") && <TableCell className="text-sm text-slate-600">{invoice.branch?.name || "-"}</TableCell>}
                          {isColumnVisible("warehouse") && <TableCell className="text-sm text-slate-600">{invoice.warehouse?.name || "-"}</TableCell>}
                          {isColumnVisible("subtotal") && <TableCell className="text-right">{fmt(Number(invoice.subtotal || 0))}</TableCell>}
                          {isColumnVisible("amountPaid") && <TableCell className="text-right">{fmt(Number(invoice.amountPaid || 0))}</TableCell>}
                          {isColumnVisible("notes") && <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">{invoice.notes || "-"}</TableCell>}
                          {isColumnVisible("itemCount") && <TableCell className="text-right">{invoice._count?.items || 0}</TableCell>}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/purchase-invoices/${invoice.id}`}>
                              <Button variant="ghost" size="icon" title={t("common.details") || "Details"}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("common.delete") || "Delete"}
                              onClick={() => handleDelete(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            <LoadMoreTrigger hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
          </CardContent>
        </Card>
        {confirmDialog && (
          <ConfirmDialog
            open={!!confirmDialog}
            onOpenChange={(open) => !open && setConfirmDialog(null)}
            title={confirmDialog.title}
            description={confirmDialog.description}
            onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          />
        )}
      </div>
      <FloatingActionButton href="/purchase-invoices/new" label={t("purchases.newPurchase")} />
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        fields={PURCHASE_INVOICE_SEARCH_FIELDS}
        values={advancedSearch}
        onSearch={handleAdvancedSearch}
        onReset={handleResetAdvancedSearch}
      />
      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        module="purchase-invoices"
        filters={filtersForSave}
        sortField={sortFieldForSave}
        sortDirection={sortDirectionForSave}
        onSaved={handleViewSaved}
        editingView={editingView}
      />
      <ColumnCustomizer
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        columns={PURCHASE_INVOICE_COLUMNS}
        visibleColumns={visibleColumns}
        onSave={setVisibleColumns}
      />
    </PageAnimation>
  );
}
