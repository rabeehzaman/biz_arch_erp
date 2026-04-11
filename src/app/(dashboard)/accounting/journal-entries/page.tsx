"use client";

import { useState, useEffect, useRef } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, BookOpen, MoreHorizontal, Edit, Trash2, Eye, SlidersHorizontal, Columns3 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { AdvancedSearchModal } from "@/components/list-page/advanced-search-modal";
import { ViewsDropdown } from "@/components/list-page/views-dropdown";
import { SaveViewDialog } from "@/components/list-page/save-view-dialog";
import { JOURNAL_ENTRY_SEARCH_FIELDS } from "@/lib/advanced-search-configs";
import { JOURNAL_ENTRY_SYSTEM_VIEWS } from "@/lib/system-views";
import { useCustomViews } from "@/hooks/use-custom-views";
import { ColumnCustomizer } from "@/components/list-page/column-customizer";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { JOURNAL_ENTRY_COLUMNS } from "@/lib/column-configs";

interface JournalLine {
  id: string;
  account: { id: string; code: string; name: string };
  description: string | null;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  date: string;
  description: string;
  status: string;
  sourceType: string;
  lines: JournalLine[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  POSTED: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

const sourceLabels = (t: (key: string) => string): Record<string, string> => ({
  MANUAL: t("accounting.sourceManual"),
  INVOICE: t("accounting.sourceInvoice"),
  PURCHASE_INVOICE: t("accounting.sourcePurchase"),
  PAYMENT: t("accounting.sourcePayment"),
  SUPPLIER_PAYMENT: t("accounting.sourceSupplierPay"),
  EXPENSE: t("accounting.sourceExpense"),
  CREDIT_NOTE: t("accounting.sourceCreditNote"),
  DEBIT_NOTE: t("accounting.sourceDebitNote"),
  TRANSFER: t("accounting.sourceTransfer"),
  OPENING_BALANCE: t("accounting.sourceOpening"),
});

export default function JournalEntriesPage() {
  const router = useRouter();
  const { locale } = useCurrency();
  const { t } = useLanguage();
  const srcLabels = sourceLabels(t);
  const {
    activeViewId, activeFilters, advancedSearch, advancedSearchOpen,
    setAdvancedSearchOpen, activeFilterCount, handleViewChange,
    handleAdvancedSearch, handleResetAdvancedSearch,
    saveViewDialogOpen, setSaveViewDialogOpen, handleSaveView,
    filtersForSave, sortFieldForSave, sortDirectionForSave,
    viewsRefreshKey, handleViewSaved, editingView, handleEditView,
  } = useCustomViews({ module: "journal-entries", systemViews: JOURNAL_ENTRY_SYSTEM_VIEWS });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility("journal-entries", JOURNAL_ENTRY_COLUMNS);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEntries();
  }, [activeFilters]);

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

  const fetchEntries = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const qs = params.toString();
      const response = await fetch(`/api/journal-entries${qs ? `?${qs}` : ""}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEntries(data);
    } catch {
      toast.error(t("accounting.failedToLoadJournalEntries"));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.journalNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTotals = (lines: JournalLine[]) => {
    const debit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const credit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
    return { debit, credit };
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("accounting.confirmDeleteJournalEntry"))) return;
    try {
      const response = await fetch(`/api/journal-entries/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete");
      }
      fetchEntries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("accounting.journalEntries")}</h2>
              <p className="text-slate-500">{t("accounting.doubleEntryDesc")}</p>
          </div>
          <Link href="/accounting/journal-entries/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {t("accounting.newJournalEntry")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t("accounting.searchJournalEntries")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ViewsDropdown
                  module="journal-entries"
                  systemViews={JOURNAL_ENTRY_SYSTEM_VIEWS}
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
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BookOpen className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("accounting.noJournalEntries")}</h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.tryDifferentSearch")
                    : t("accounting.createFirstJournalEntry")}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {filteredEntries.map((entry) => {
                    const totals = getTotals(entry.lines);

                    return (
                      <div key={entry.id} onClick={() => router.push(`/accounting/journal-entries/${entry.id}`)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-muted/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/accounting/journal-entries/${entry.id}`}
                              className="font-semibold text-blue-600 hover:underline"
                            >
                              {entry.journalNumber}
                            </Link>
                            <p className="mt-1 text-sm text-slate-500">
                              {format(new Date(entry.date), "dd MMM yyyy")}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="min-h-[44px] min-w-[44px] p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Link href={`/accounting/journal-entries/${entry.id}/edit`}>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                              </Link>
                              <DropdownMenuItem
                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t("common.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <p className="mt-3 text-sm text-slate-600">{entry.description}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {srcLabels[entry.sourceType] || entry.sourceType}
                          </Badge>
                          <Badge className={statusColors[entry.status]}>
                            {entry.status}
                          </Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("accounting.debit")}</p>
                            <p className="mt-1 font-mono font-semibold text-slate-900">
                              {totals.debit.toLocaleString(locale, {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("accounting.credit")}</p>
                            <p className="mt-1 font-mono font-semibold text-slate-900">
                              {totals.credit.toLocaleString(locale, {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>

                        <Button asChild variant="outline" className="mt-4 min-h-[44px] w-full">
                          <Link href={`/accounting/journal-entries/${entry.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("accounting.openEntry")}
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.number")}</TableHead>
                          {isColumnVisible("date") && <TableHead>{t("common.date")}</TableHead>}
                          {isColumnVisible("description") && <TableHead>{t("common.description")}</TableHead>}
                          {isColumnVisible("source") && <TableHead className="hidden sm:table-cell">{t("common.source")}</TableHead>}
                          {isColumnVisible("status") && <TableHead className="hidden sm:table-cell">{t("common.status")}</TableHead>}
                          {isColumnVisible("debit") && <TableHead className="text-right">{t("accounting.debit")}</TableHead>}
                          {isColumnVisible("credit") && <TableHead className="hidden sm:table-cell text-right">{t("accounting.credit")}</TableHead>}
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntries.map((entry) => {
                          const totals = getTotals(entry.lines);
                          return (
                            <TableRow key={entry.id} onClick={() => router.push(`/accounting/journal-entries/${entry.id}`)} className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                <Link
                                  href={`/accounting/journal-entries/${entry.id}`}
                                  className="font-medium text-blue-600 hover:underline"
                                >
                                  {entry.journalNumber}
                                </Link>
                              </TableCell>
                              {isColumnVisible("date") && <TableCell>
                                {format(new Date(entry.date), "dd MMM yyyy")}
                              </TableCell>}
                              {isColumnVisible("description") && <TableCell className="max-w-[120px] truncate">
                                {entry.description}
                              </TableCell>}
                              {isColumnVisible("source") && <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline">
                                  {srcLabels[entry.sourceType] || entry.sourceType}
                                </Badge>
                              </TableCell>}
                              {isColumnVisible("status") && <TableCell className="hidden sm:table-cell">
                                <Badge className={statusColors[entry.status]}>
                                  {entry.status}
                                </Badge>
                              </TableCell>}
                              {isColumnVisible("debit") && <TableCell className="text-right font-mono">
                                {totals.debit.toLocaleString(locale, {
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>}
                              {isColumnVisible("credit") && <TableCell className="hidden sm:table-cell text-right font-mono">
                                {totals.credit.toLocaleString(locale, {
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>}
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <Link href={`/accounting/journal-entries/${entry.id}/edit`}>
                                      <DropdownMenuItem>
                                        <Edit className="mr-2 h-4 w-4" />
                                        {t("common.edit")}
                                      </DropdownMenuItem>
                                    </Link>
                                    <DropdownMenuItem
                                      className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                      onClick={() => handleDelete(entry.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      {t("common.delete")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onOpenChange={setAdvancedSearchOpen}
        fields={JOURNAL_ENTRY_SEARCH_FIELDS}
        values={advancedSearch}
        onSearch={handleAdvancedSearch}
        onReset={handleResetAdvancedSearch}
      />
      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        module="journal-entries"
        filters={filtersForSave}
        sortField={sortFieldForSave}
        sortDirection={sortDirectionForSave}
        onSaved={handleViewSaved}
        editingView={editingView}
      />
      <ColumnCustomizer
        open={columnsOpen}
        onOpenChange={setColumnsOpen}
        columns={JOURNAL_ENTRY_COLUMNS}
        visibleColumns={visibleColumns}
        onSave={setVisibleColumns}
      />
    </PageAnimation>
  );
}
