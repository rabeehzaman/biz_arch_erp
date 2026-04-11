"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Eye, Trash2, SlidersHorizontal, Columns3 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
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
import { QUOTATION_SEARCH_FIELDS } from "@/lib/advanced-search-configs";
import { QUOTATION_SYSTEM_VIEWS } from "@/lib/system-views";
import { useCustomViews } from "@/hooks/use-custom-views";
import { ColumnCustomizer } from "@/components/list-page/column-customizer";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { QUOTATION_COLUMNS } from "@/lib/column-configs";

interface Quotation {
  id: string;
  quotationNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  issueDate: string;
  validUntil: string;
  status: "SENT" | "CONVERTED" | "CANCELLED" | "EXPIRED";
  total: number;
  branch?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string } | null;
  subtotal?: number;
  notes?: string | null;
  _count: {
    items: number;
  };
}

export default function QuotationsPage() {
  const router = useRouter();
  const {
    activeViewId, activeFilters, advancedSearch, advancedSearchOpen,
    setAdvancedSearchOpen, activeFilterCount, handleViewChange,
    handleAdvancedSearch, handleResetAdvancedSearch,
    saveViewDialogOpen, setSaveViewDialogOpen, handleSaveView,
    filtersForSave, sortFieldForSave, sortDirectionForSave,
    viewsRefreshKey, handleViewSaved, editingView, handleEditView,
  } = useCustomViews({ module: "quotations", systemViews: QUOTATION_SYSTEM_VIEWS });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility("quotations", QUOTATION_COLUMNS);
  const {
    items: quotations,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<Quotation>({ url: "/api/quotations", params: activeFilters });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refresh });

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("quotations.quotationDeleted"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete");
          }
          refresh();
        } catch (error: any) {
          toast.error(error.message || t("common.error"));
          console.error("Failed to delete quotation:", error);
        }
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      SENT: "default",
      CONVERTED: "secondary",
      CANCELLED: "secondary",
      EXPIRED: "destructive",
    };

    const colors: Record<string, string> = {
      SENT: "bg-blue-500",
      CONVERTED: "bg-green-500",
      CANCELLED: "bg-gray-500",
      EXPIRED: "bg-red-500",
    };

    const statusLabels: Record<string, string> = {
      SENT: t("common.sent2"),
      CONVERTED: t("common.converted"),
      CANCELLED: t("common.cancelled"),
      EXPIRED: t("common.expired"),
    };

    return (
      <Badge variant={variants[status] || "default"} className={colors[status]}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  return (
    <PageAnimation>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("quotations.title")}</h2>
              <p className="text-slate-500">{t("quotations.manageQuotations")}</p>
          </div>
          <Link href="/quotations/new" className="hidden sm:inline-flex">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("quotations.newQuotation")}
            </Button>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 w-full sm:max-w-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={t("quotations.searchQuotations")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ViewsDropdown
                  module="quotations"
                  systemViews={QUOTATION_SYSTEM_VIEWS}
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
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : quotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("quotations.noQuotations")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.noMatchFound")
                      : t("quotations.noQuotationsDesc")}
                  </p>
                  {!searchQuery && (
                    <Link href="/quotations/new" className="mt-4">
                      <Button variant="outline">{t("quotations.createQuotation")}</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {quotations.map((quotation) => (
                      <SwipeableCard
                        key={quotation.id}
                        actions={
                          <div className="flex h-full flex-col">
                            <Link
                              href={`/quotations/${quotation.id}`}
                              className="flex flex-1 items-center justify-center bg-slate-600 px-4 text-sm font-medium text-white"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              className="flex flex-1 items-center justify-center bg-red-500 px-4 text-sm font-medium text-white disabled:opacity-50"
                              onClick={() => handleDelete(quotation.id)}
                              disabled={quotation.status === "CONVERTED"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        }
                      >
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("quotations.quotationNumber")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">{quotation.quotationNumber}</p>
                          </div>
                          {getStatusBadge(quotation.status)}
                        </div>

                        <div className="mt-4 min-w-0">
                          <Link href={`/customers/${quotation.customer.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:underline">{quotation.customer.name}</Link>
                          {quotation.customer.email && (
                            <p className="mt-1 break-all text-sm text-slate-500">{quotation.customer.email}</p>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("sales.issueDate")}
                            </p>
                            <p className="mt-1 font-medium text-slate-900">
                              {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("quotations.validUntil")}
                            </p>
                            <p className="mt-1 font-medium text-slate-900">
                              {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("common.total")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">{fmt(Number(quotation.total))}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.items")}</p>
                            <p className="mt-1 font-medium text-slate-900">{quotation._count.items}</p>
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
                          <TableHead>{t("quotations.quotationNumber")}</TableHead>
                          {isColumnVisible("customer") && <TableHead>{t("sales.customer")}</TableHead>}
                          {isColumnVisible("issueDate") && <TableHead>{t("sales.issueDate")}</TableHead>}
                          {isColumnVisible("validUntil") && <TableHead>{t("quotations.validUntil")}</TableHead>}
                          {isColumnVisible("status") && <TableHead>{t("common.status")}</TableHead>}
                          {isColumnVisible("total") && <TableHead className="text-right">{t("common.total")}</TableHead>}
                          {isColumnVisible("branch") && <TableHead>{t("common.branch")}</TableHead>}
                          {isColumnVisible("warehouse") && <TableHead>{t("common.warehouse")}</TableHead>}
                          {isColumnVisible("subtotal") && <TableHead className="text-right">{t("common.subtotal")}</TableHead>}
                          {isColumnVisible("notes") && <TableHead>{t("common.notes")}</TableHead>}
                          {isColumnVisible("itemCount") && <TableHead className="text-right">{t("common.items")}</TableHead>}
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotations.map((quotation) => (
                          <TableRow
                            key={quotation.id}
                            onClick={() => router.push(`/quotations/${quotation.id}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              {quotation.quotationNumber}
                            </TableCell>
                            {isColumnVisible("customer") && <TableCell>
                              <div>
                                <Link href={`/customers/${quotation.customer.id}`} className="font-medium hover:underline">{quotation.customer.name}</Link>
                                {quotation.customer.email && (
                                  <div className="text-sm text-slate-500">
                                    {quotation.customer.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>}
                            {isColumnVisible("issueDate") && <TableCell>
                              {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                            </TableCell>}
                            {isColumnVisible("validUntil") && <TableCell>
                              {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                            </TableCell>}
                            {isColumnVisible("status") && <TableCell>{getStatusBadge(quotation.status)}</TableCell>}
                            {isColumnVisible("total") && <TableCell className="text-right">
                              {fmt(Number(quotation.total))}
                            </TableCell>}
                            {isColumnVisible("branch") && <TableCell className="text-sm text-slate-600">{quotation.branch?.name || "-"}</TableCell>}
                            {isColumnVisible("warehouse") && <TableCell className="text-sm text-slate-600">{quotation.warehouse?.name || "-"}</TableCell>}
                            {isColumnVisible("subtotal") && <TableCell className="text-right">{fmt(Number(quotation.subtotal || 0))}</TableCell>}
                            {isColumnVisible("notes") && <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">{quotation.notes || "-"}</TableCell>}
                            {isColumnVisible("itemCount") && <TableCell className="text-right">{quotation._count?.items || 0}</TableCell>}
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Link href={`/quotations/${quotation.id}`}>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(quotation.id)}
                                disabled={quotation.status === "CONVERTED"}
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
      <FloatingActionButton href="/quotations/new" label={t("quotations.newQuotation")} />
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        fields={QUOTATION_SEARCH_FIELDS}
        values={advancedSearch}
        onSearch={handleAdvancedSearch}
        onReset={handleResetAdvancedSearch}
      />
      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        module="quotations"
        filters={filtersForSave}
        sortField={sortFieldForSave}
        sortDirection={sortDirectionForSave}
        onSaved={handleViewSaved}
        editingView={editingView}
      />
      <ColumnCustomizer
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        columns={QUOTATION_COLUMNS}
        visibleColumns={visibleColumns}
        onSave={setVisibleColumns}
      />
    </PageAnimation>
  );
}
