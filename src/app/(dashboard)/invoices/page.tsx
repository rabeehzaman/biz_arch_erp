"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, FileText, Eye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/mobile/pull-to-refresh-indicator";
import { FloatingActionButton } from "@/components/mobile/floating-action-button";
import { SwipeableCard } from "@/components/mobile/swipeable-card";
import { ListFilters } from "@/components/list-page/list-filters";
import { ListSummaryBar } from "@/components/list-page/list-summary-bar";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  issueDate: string;
  dueDate: string;
  total: number;
  balanceDue: number;
  _count: {
    items: number;
  };
}

function getInvoiceStatus(balanceDue: number, dueDate: string, t: (key: string) => string) {
  if (balanceDue <= 0) return { label: t("common.paid"), className: "bg-green-100 text-green-700" };
  if (new Date(dueDate) < new Date()) return { label: t("common.overdue"), className: "bg-red-100 text-red-700" };
  return { label: t("common.unpaid"), className: "bg-yellow-100 text-yellow-700" };
}

export default function InvoicesPage() {
  const router = useRouter();
  const {
    items: invoices,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<Invoice>({ url: "/api/invoices" });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refresh });

  const statusFilterOptions = [
    { value: "all", label: t("common.allStatuses") },
    { value: "paid", label: t("common.paid") },
    { value: "unpaid", label: t("common.unpaid") },
    { value: "overdue", label: t("common.overdue") },
  ];

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") return invoices;
    return invoices.filter((inv) => {
      const balance = Number(inv.balanceDue);
      const overdue = new Date(inv.dueDate) < new Date();
      if (statusFilter === "paid") return balance <= 0;
      if (statusFilter === "overdue") return balance > 0 && overdue;
      if (statusFilter === "unpaid") return balance > 0;
      return true;
    });
  }, [invoices, statusFilter]);

  const sortedInvoices = useMemo(() => {
    if (!sortField) return filteredInvoices;
    return [...filteredInvoices].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "invoiceNumber": aVal = a.invoiceNumber; bVal = b.invoiceNumber; break;
        case "customer": aVal = a.customer.name; bVal = b.customer.name; break;
        case "issueDate": aVal = new Date(a.issueDate).getTime(); bVal = new Date(b.issueDate).getTime(); break;
        case "dueDate": aVal = new Date(a.dueDate).getTime(); bVal = new Date(b.dueDate).getTime(); break;
        case "total": aVal = Number(a.total); bVal = Number(b.total); break;
        case "balance": aVal = Number(a.balanceDue); bVal = Number(b.balanceDue); break;
        default: return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredInvoices, sortField, sortDir]);

  // Summary stats for the filtered list
  const summaryStats = useMemo(() => {
    const totalAmount = invoices.reduce((s, inv) => s + Number(inv.total), 0);
    const totalBalance = invoices.reduce((s, inv) => s + Number(inv.balanceDue), 0);
    const totalPaid = totalAmount - totalBalance;
    const overdueAmount = invoices
      .filter((inv) => Number(inv.balanceDue) > 0 && new Date(inv.dueDate) < new Date())
      .reduce((s, inv) => s + Number(inv.balanceDue), 0);
    return { totalAmount, totalPaid, totalBalance, overdueAmount };
  }, [invoices]);

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  }

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

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("sales.deleteInvoice"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          refresh();
          toast.success(t("sales.invoiceDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete invoice:", error);
        }
      },
    });
  };

  return (
    <PageAnimation>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("sales.invoices")}</h2>
            <p className="text-slate-500">{t("dashboard.createInvoiceDesc")}</p>
          </div>
          <Link href="/invoices/new" className="hidden sm:inline-flex">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("sales.newInvoice")}
            </Button>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t("sales.searchInvoices")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ListFilters
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  statusOptions={statusFilterOptions}
                />
              </div>
              {invoices.length > 0 && (
                <ListSummaryBar
                  className="mt-3"
                  stats={[
                    { label: t("common.total"), value: fmt(summaryStats.totalAmount) },
                    { label: t("common.paid"), value: fmt(summaryStats.totalPaid), color: "success" },
                    { label: t("common.balance"), value: fmt(summaryStats.totalBalance), color: summaryStats.totalBalance > 0 ? "danger" : "default" },
                    ...(summaryStats.overdueAmount > 0
                      ? [{ label: t("common.overdue"), value: fmt(summaryStats.overdueAmount), color: "danger" as const }]
                      : []),
                  ]}
                />
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("sales.noInvoices")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.noMatchFound")
                      : t("sales.noInvoicesDesc")}
                  </p>
                  {!searchQuery && (
                    <Link href="/invoices/new" className="mt-4">
                      <Button variant="outline">{t("sales.createInvoice")}</Button>
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
                            title: `${t("common.delete")} ${count} ${t("sales.invoices").toLowerCase()}`,
                            description: t("common.deleteConfirm"),
                            onConfirm: async () => {
                              try {
                                await Promise.all(
                                  Array.from(selectedIds).map(id =>
                                    fetch(`/api/invoices/${id}`, { method: "DELETE" })
                                  )
                                );
                                toast.success(`${count} ${t("sales.invoices").toLowerCase()} ${t("common.deleted").toLowerCase()}`);
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
                    {sortedInvoices.map((invoice) => {
                      const status = getInvoiceStatus(Number(invoice.balanceDue), invoice.dueDate, t);

                      return (
                        <SwipeableCard
                          key={invoice.id}
                          actions={
                            <div className="flex h-full flex-col">
                              <Link
                                href={`/invoices/${invoice.id}`}
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
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/invoices/${invoice.id}`)}>
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
                                <div className="min-w-0 space-y-1">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {invoice.invoiceNumber}
                                  </p>
                                  <p className="truncate text-sm text-slate-700">
                                    {invoice.customer.name}
                                  </p>
                                  {invoice.customer.email && (
                                    <p className="truncate text-xs text-slate-500">
                                      {invoice.customer.email}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className={status.className}>
                                  {status.label}
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {t("sales.issueDate")}
                                </p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {t("sales.dueDate")}
                                </p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {t("common.total")}
                                </p>
                                <p className="mt-1 font-medium text-slate-900">
                                  {fmt(Number(invoice.total))}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {t("common.balance")}
                                </p>
                                <p
                                  className={`mt-1 font-semibold ${
                                    Number(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600"
                                  }`}
                                >
                                  {fmt(Number(invoice.balanceDue))}
                                </p>
                              </div>
                            </div>
                          </div>
                        </SwipeableCard>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <Table className="min-w-[900px]">
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
                            <span className="inline-flex items-center gap-1.5">
                              {t("sales.invoiceNumber")}
                              <SortIcon field="invoiceNumber" />
                            </span>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("customer")}>
                            <span className="inline-flex items-center gap-1.5">
                              {t("sales.customer")}
                              <SortIcon field="customer" />
                            </span>
                          </TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead className="hidden sm:table-cell cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("issueDate")}>
                            <span className="inline-flex items-center gap-1.5">
                              {t("sales.issueDate")}
                              <SortIcon field="issueDate" />
                            </span>
                          </TableHead>
                          <TableHead className="hidden sm:table-cell cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("dueDate")}>
                            <span className="inline-flex items-center gap-1.5">
                              {t("sales.dueDate")}
                              <SortIcon field="dueDate" />
                            </span>
                          </TableHead>
                          <TableHead className="hidden sm:table-cell text-right cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("total")}>
                            <span className="inline-flex items-center gap-1.5 justify-end w-full">
                              {t("common.total")}
                              <SortIcon field="total" />
                            </span>
                          </TableHead>
                          <TableHead className="text-right cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("balance")}>
                            <span className="inline-flex items-center gap-1.5 justify-end w-full">
                              {t("common.balance")}
                              <SortIcon field="balance" />
                            </span>
                          </TableHead>
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedInvoices.map((invoice) => (
                          <TableRow
                            key={invoice.id}
                            onClick={() => router.push(`/invoices/${invoice.id}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
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
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{invoice.customer.name}</div>
                                {invoice.customer.email && (
                                  <div className="text-sm text-slate-500">
                                    {invoice.customer.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const status = getInvoiceStatus(Number(invoice.balanceDue), invoice.dueDate, t);
                                return (
                                  <Badge variant="outline" className={status.className}>
                                    {status.label}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span title={format(new Date(invoice.issueDate), "dd MMM yyyy")}>
                                {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                              </span>
                              {formatRelativeDate(invoice.issueDate) && (
                                <span className="ml-1.5 text-xs text-slate-400">
                                  {formatRelativeDate(invoice.issueDate)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right">
                              {fmt(Number(invoice.total))}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  Number(invoice.balanceDue) > 0
                                    ? "text-red-600 font-medium"
                                    : "text-green-600"
                                }
                              >
                                {fmt(Number(invoice.balanceDue))}
                              </span>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Link href={`/invoices/${invoice.id}`}>
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
                  <LoadMoreTrigger hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
                </>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}
      <FloatingActionButton href="/invoices/new" label={t("sales.newInvoice")} />
    </PageAnimation>
  );
}
