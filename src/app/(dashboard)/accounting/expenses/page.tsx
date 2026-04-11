"use client";

import { useState, useEffect } from "react";
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
import { Plus, Search, Receipt, SlidersHorizontal, Columns3 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { AdvancedSearchModal } from "@/components/list-page/advanced-search-modal";
import { ViewsDropdown } from "@/components/list-page/views-dropdown";
import { SaveViewDialog } from "@/components/list-page/save-view-dialog";
import { EXPENSE_SEARCH_FIELDS } from "@/lib/advanced-search-configs";
import { EXPENSE_SYSTEM_VIEWS } from "@/lib/system-views";
import { useCustomViews } from "@/hooks/use-custom-views";
import { ColumnCustomizer } from "@/components/list-page/column-customizer";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { EXPENSE_COLUMNS } from "@/lib/column-configs";

interface Expense {
  id: string;
  expenseNumber: string;
  status: string;
  expenseDate: string;
  description: string | null;
  total: number;
  supplier: { id: string; name: string } | null;
  cashBankAccount: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  notes?: string | null;
  _count: { items: number };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

export default function ExpensesPage() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const {
    activeViewId, activeFilters, advancedSearch, advancedSearchOpen,
    setAdvancedSearchOpen, activeFilterCount, handleViewChange,
    handleAdvancedSearch, handleResetAdvancedSearch,
    saveViewDialogOpen, setSaveViewDialogOpen, handleSaveView,
    filtersForSave, sortFieldForSave, sortDirectionForSave,
    viewsRefreshKey, handleViewSaved, editingView, handleEditView,
  } = useCustomViews({ module: "expenses", systemViews: EXPENSE_SYSTEM_VIEWS });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const { visibleColumns, setVisibleColumns, isColumnVisible } = useColumnVisibility("expenses", EXPENSE_COLUMNS);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchExpenses();
  }, [activeFilters]);

  const fetchExpenses = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const qs = params.toString();
      const response = await fetch(`/api/expenses${qs ? `?${qs}` : ""}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      setExpenses(json.data ?? json);
    } catch {
      toast.error(t("accounting.failedToLoadExpenses"));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(
    (e) =>
      e.expenseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">{t("accounting.expenses")}</h2>
                <p className="text-slate-500">{t("accounting.trackManageExpenses")}</p>
            </div>
            <Link href="/accounting/expenses/new" className="w-full sm:w-auto">
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                {t("accounting.newExpense")}
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
                      placeholder={t("accounting.searchExpenses")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <ViewsDropdown
                    module="expenses"
                    systemViews={EXPENSE_SYSTEM_VIEWS}
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
              ) : filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Receipt className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("accounting.noExpenses")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.tryDifferentSearch")
                      : t("accounting.createFirstExpense")}
                    </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {filteredExpenses.map((expense) => (
                      <div key={expense.id} onClick={() => router.push(`/accounting/expenses/${expense.id}`)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-muted/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.number")}</p>
                            <Link
                              href={`/accounting/expenses/${expense.id}`}
                              className="mt-1 block font-semibold text-blue-600 hover:underline"
                            >
                              {expense.expenseNumber}
                            </Link>
                          </div>
                          <Badge className={statusColors[expense.status]}>{expense.status}</Badge>
                        </div>

                        <div className="mt-4">
                          <p className="text-sm text-slate-600">{expense.description || "-"}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.date")}</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {format(new Date(expense.expenseDate), "dd MMM yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.supplier")}</p>
                            <p className="mt-1 font-medium text-slate-900">{expense.supplier?.name || "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.amount")}</p>
                            <p className="mt-1 font-semibold text-slate-900">{fmt(Number(expense.total))}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.items")}</p>
                            <p className="mt-1 font-medium text-slate-900">{expense._count.items}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.number")}</TableHead>
                          {isColumnVisible("expenseDate") && <TableHead>{t("common.date")}</TableHead>}
                          {isColumnVisible("description") && <TableHead>{t("common.description")}</TableHead>}
                          {isColumnVisible("supplier") && <TableHead>{t("common.supplier")}</TableHead>}
                          {isColumnVisible("status") && <TableHead>{t("common.status")}</TableHead>}
                          {isColumnVisible("total") && <TableHead className="text-right">{t("common.amount")}</TableHead>}
                          {isColumnVisible("branch") && <TableHead>{t("common.branch")}</TableHead>}
                          {isColumnVisible("notes") && <TableHead>{t("common.notes")}</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map((expense) => (
                          <TableRow key={expense.id} onClick={() => router.push(`/accounting/expenses/${expense.id}`)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <Link
                                href={`/accounting/expenses/${expense.id}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {expense.expenseNumber}
                              </Link>
                            </TableCell>
                            {isColumnVisible("expenseDate") && <TableCell>
                              {format(new Date(expense.expenseDate), "dd MMM yyyy")}
                            </TableCell>}
                            {isColumnVisible("description") && <TableCell className="max-w-[200px] truncate">
                              {expense.description || "-"}
                            </TableCell>}
                            {isColumnVisible("supplier") && <TableCell>{expense.supplier?.name || "-"}</TableCell>}
                            {isColumnVisible("status") && <TableCell>
                              <Badge className={statusColors[expense.status]}>
                                {expense.status}
                              </Badge>
                            </TableCell>}
                            {isColumnVisible("total") && <TableCell className="text-right font-medium">
                              {fmt(Number(expense.total))}
                            </TableCell>}
                            {isColumnVisible("branch") && <TableCell className="text-sm text-slate-600">{expense.branch?.name || "-"}</TableCell>}
                            {isColumnVisible("notes") && <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">{expense.notes || "-"}</TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        <AdvancedSearchModal
          open={advancedSearchOpen}
          onOpenChange={setAdvancedSearchOpen}
          fields={EXPENSE_SEARCH_FIELDS}
          values={advancedSearch}
          onSearch={handleAdvancedSearch}
          onReset={handleResetAdvancedSearch}
        />
        <SaveViewDialog
          open={saveViewDialogOpen}
          onOpenChange={setSaveViewDialogOpen}
          module="expenses"
          filters={filtersForSave}
          sortField={sortFieldForSave}
          sortDirection={sortDirectionForSave}
          onSaved={handleViewSaved}
          editingView={editingView}
        />
        <ColumnCustomizer
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          columns={EXPENSE_COLUMNS}
          visibleColumns={visibleColumns}
          onSave={setVisibleColumns}
        />
        </PageAnimation>
      );
}
