"use client";

import { useState } from "react";
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
import { Plus, Search, FileText, Eye, Edit, Trash2, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
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
import { CREDIT_NOTE_SEARCH_FIELDS } from "@/lib/advanced-search-configs";
import { CREDIT_NOTE_SYSTEM_VIEWS } from "@/lib/system-views";
import { useCustomViews } from "@/hooks/use-custom-views";

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  issueDate: string;
  total: number;
  reason: string | null;
  _count: {
    items: number;
  };
}

export default function CreditNotesPage() {
  const router = useRouter();
  const {
    activeViewId, activeFilters, advancedSearch, advancedSearchOpen,
    setAdvancedSearchOpen, activeFilterCount, handleViewChange,
    handleAdvancedSearch, handleResetAdvancedSearch,
    saveViewDialogOpen, setSaveViewDialogOpen, handleSaveView,
    filtersForSave, sortFieldForSave, sortDirectionForSave,
    viewsRefreshKey, handleViewSaved, editingView, handleEditView,
  } = useCustomViews({ module: "credit-notes", systemViews: CREDIT_NOTE_SYSTEM_VIEWS });
  const {
    items: creditNotes,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<CreditNote>({ url: "/api/credit-notes", params: activeFilters });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refresh });

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("accounting.deleteCreditNote"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/credit-notes/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          refresh();
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete credit note:", error);
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
              <h2 className="text-2xl font-bold text-slate-900">{t("creditNotes.title")}</h2>
              <p className="text-slate-500">
                {t("creditNotes.manageCreditNotes")}
              </p>
          </div>
          <Link href="/credit-notes/new" className="hidden sm:inline-flex">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("creditNotes.newCreditNote")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 w-full sm:max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={t("creditNotes.searchCreditNotes")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ViewsDropdown
                module="credit-notes"
                systemViews={CREDIT_NOTE_SYSTEM_VIEWS}
                activeViewId={activeViewId}
                onViewChange={handleViewChange}
                onSaveView={handleSaveView}
                onEditView={handleEditView}
                refreshKey={viewsRefreshKey}
              />
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
              <TableSkeleton columns={6} rows={5} />
            ) : creditNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  {t("creditNotes.noCreditNotesFound")}
                </h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noMatchFound")
                    : t("creditNotes.noCreditNotesDesc")}
                </p>
                {!searchQuery && (
                  <Link href="/credit-notes/new" className="mt-4">
                    <Button variant="outline">{t("creditNotes.newCreditNote")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {creditNotes.map((creditNote) => (
                    <SwipeableCard
                      key={creditNote.id}
                      actionWidth={200}
                      actions={
                        <div className="flex h-full flex-col">
                          <Link
                            href={`/credit-notes/${creditNote.id}`}
                            className="flex flex-1 items-center justify-center bg-slate-600 px-4 text-sm font-medium text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/credit-notes/${creditNote.id}/edit`}
                            className="flex flex-1 items-center justify-center bg-blue-500 px-4 text-sm font-medium text-white"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            className="flex flex-1 items-center justify-center bg-red-500 px-4 text-sm font-medium text-white"
                            onClick={() => handleDelete(creditNote.id)}
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
                            {t("creditNotes.cnNo")}
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">{creditNote.creditNoteNumber}</p>
                        </div>
                        <p className="text-sm font-semibold text-green-600">{fmt(Number(creditNote.total))}</p>
                      </div>

                      <div className="mt-4 min-w-0">
                        <Link href={`/customers/${creditNote.customer.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:underline">{creditNote.customer.name}</Link>
                        {creditNote.customer.email && (
                          <p className="mt-1 break-all text-sm text-slate-500">{creditNote.customer.email}</p>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("sales.issueDate")}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(creditNote.issueDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("sales.invoiceNumber")}
                          </p>
                          {creditNote.invoice ? (
                            <Link href={`/invoices/${creditNote.invoice.id}`} className="mt-1 block font-medium text-blue-600 hover:underline">
                              {creditNote.invoice.invoiceNumber}
                            </Link>
                          ) : (
                            <p className="mt-1 font-medium text-slate-400">-</p>
                          )}
                        </div>
                      </div>

                      </div>
                    </SwipeableCard>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("creditNotes.cnNo")}</TableHead>
                        <TableHead>{t("sales.customer")}</TableHead>
                        <TableHead>{t("sales.invoiceNumber")}</TableHead>
                        <TableHead>{t("sales.issueDate")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditNotes.map((creditNote) => (
                        <TableRow
                          key={creditNote.id}
                          onClick={() => router.push(`/credit-notes/${creditNote.id}`)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            {creditNote.creditNoteNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <Link href={`/customers/${creditNote.customer.id}`} className="font-medium hover:underline">
                                {creditNote.customer.name}
                              </Link>
                              {creditNote.customer.email && (
                                <div className="text-sm text-slate-500">
                                  {creditNote.customer.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {creditNote.invoice ? (
                              <Link
                                href={`/invoices/${creditNote.invoice.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline"
                              >
                                {creditNote.invoice.invoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(creditNote.issueDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {fmt(Number(creditNote.total))}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={`/credit-notes/${creditNote.id}`}>
                              <Button variant="ghost" size="icon" title="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/credit-notes/${creditNote.id}/edit`}>
                              <Button variant="ghost" size="icon" title="Edit">
                                <Edit className="h-4 w-4 text-blue-500" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(creditNote.id)}
                              title="Delete"
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
          </CardContent>
        </Card>
        <LoadMoreTrigger hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
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
      <FloatingActionButton href="/credit-notes/new" label={t("creditNotes.newCreditNote")} />
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        fields={CREDIT_NOTE_SEARCH_FIELDS}
        values={advancedSearch}
        onSearch={handleAdvancedSearch}
        onReset={handleResetAdvancedSearch}
      />
      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        module="credit-notes"
        filters={filtersForSave}
        sortField={sortFieldForSave}
        sortDirection={sortDirectionForSave}
        onSaved={handleViewSaved}
        editingView={editingView}
      />
    </PageAnimation>
  );
}
