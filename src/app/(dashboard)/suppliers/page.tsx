"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/hooks/use-currency";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";

import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Search, Truck, MoreHorizontal, Wallet } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  gstin: string | null;
  gstStateCode: string | null;
  balance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    purchaseInvoices: number;
  };
}
import { useLanguage } from "@/lib/i18n";

export default function SuppliersPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { symbol, locale } = useCurrency();
  const {
    items: suppliers,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<Supplier>({ url: "/api/suppliers" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isOpeningBalanceDialogOpen, setIsOpeningBalanceDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedSupplierForBalance, setSelectedSupplierForBalance] = useState<Supplier | null>(null);
  const [openingBalanceData, setOpeningBalanceData] = useState({
    amount: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

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

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("suppliers.deleteSupplier"),
      description: t("suppliers.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to delete");
          }
          refresh();
          toast.success(t("suppliers.supplierDeleted"));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t("common.error"));
          console.error("Failed to delete supplier:", error);
        }
      },
    });
  };

  const handleBulkDelete = () => {
    setConfirmDialog({
      title: t("suppliers.deleteSupplier"),
      description: `${t("suppliers.deleteConfirm")} (${selectedIds.size} ${t("common.selected") || "selected"})`,
      onConfirm: async () => {
        try {
          await Promise.all(
            Array.from(selectedIds).map((id) =>
              fetch(`/api/suppliers/${id}`, { method: "DELETE" })
            )
          );
          setSelectedIds(new Set());
          refresh();
          toast.success(t("suppliers.supplierDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to bulk delete suppliers:", error);
        }
      },
    });
  };

  const handleOpeningBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForBalance) return;

    try {
      const response = await fetch(`/api/suppliers/${selectedSupplierForBalance.id}/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(openingBalanceData.amount),
          transactionDate: openingBalanceData.transactionDate,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setIsOpeningBalanceDialogOpen(false);
      setSelectedSupplierForBalance(null);
      setOpeningBalanceData({
        amount: "",
        transactionDate: new Date().toISOString().split("T")[0],
      });
      refresh();
      toast.success(t("suppliers.supplierUpdated"));
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to set opening balance:", error);
    }
  };

  const handleOpenOpeningBalanceDialog = async (supplier: Supplier) => {
    setSelectedSupplierForBalance(supplier);

    // Fetch existing opening balance if any
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/opening-balance`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setOpeningBalanceData({
            amount: String(data.amount),
            transactionDate: data.transactionDate.split("T")[0],
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch opening balance:", error);
    }

    setIsOpeningBalanceDialogOpen(true);
  };

  return (
    <PageAnimation>
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("suppliers.title")}</h2>
            <p className="text-slate-500">{t("suppliers.manageSuppliers")}</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => {
            setEditingSupplier(null);
            setIsDialogOpen(true);
          }}>
            <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
            {t("suppliers.addSupplier")}
          </Button>
          <SupplierFormDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSuccess={refresh}
            supplierToEdit={editingSupplier}
          />
        </StaggerItem>

        <StaggerItem>
          <Dialog open={isOpeningBalanceDialogOpen} onOpenChange={(open) => {
            setIsOpeningBalanceDialogOpen(open);
            if (!open) {
              setSelectedSupplierForBalance(null);
              setOpeningBalanceData({
                amount: "",
                transactionDate: new Date().toISOString().split("T")[0],
              });
            }
          }}>
            <DialogContent>
              <form className="contents" onSubmit={handleOpeningBalanceSubmit}>
                <DialogHeader className="pr-12">
                  <DialogTitle>{t("common.setOpeningBalance")}</DialogTitle>
                  <DialogDescription>
                    {t("suppliers.openingBalanceDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="openingAmount">{t("common.openingBalanceAmount")}</Label>
                    <Input
                      id="openingAmount"
                      type="number"
                      step="0.01"
                      value={openingBalanceData.amount}
                      onChange={(e) =>
                        setOpeningBalanceData({ ...openingBalanceData, amount: e.target.value })
                      }
                      placeholder={t("suppliers.openingBalancePlaceholder")}
                      required
                    />
                    <p className="text-xs text-slate-500">
                      {t("suppliers.openingBalanceHint")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="balanceDate">{t("common.asOfDate")}</Label>
                    <Input
                      id="balanceDate"
                      type="date"
                      value={openingBalanceData.transactionDate}
                      onChange={(e) =>
                        setOpeningBalanceData({ ...openingBalanceData, transactionDate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{t("common.setOpeningBalance")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t("suppliers.searchSuppliersPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedIds(new Set()); }}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Truck className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("suppliers.noSuppliers")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.noResultsFound")
                      : t("suppliers.addFirstSupplier")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {suppliers.map((supplier) => (
                      <div key={supplier.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/suppliers/${supplier.id}/statement`)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{supplier.name}</p>
                            {(supplier.email || supplier.phone) && (
                              <div className="mt-1 space-y-1 text-sm text-slate-500">
                                {supplier.email && <p className="break-all">{supplier.email}</p>}
                                {supplier.phone && <p>{supplier.phone}</p>}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={supplier.isActive ? "default" : "secondary"}>
                              {supplier.isActive ? t("common.active") : t("common.inactive")}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] -mr-2 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenOpeningBalanceDialog(supplier)}>
                                  <Wallet className="mr-2 h-4 w-4" />
                                  {t("common.openingBalance")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(supplier.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.balance")}</p>
                            <p className={`mt-1 font-semibold ${Number(supplier.balance) > 0 ? "text-red-600" : Number(supplier.balance) < 0 ? "text-green-600" : "text-slate-900"}`}>
                              {symbol}{Math.abs(Number(supplier.balance)).toLocaleString(locale)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.invoices")}</p>
                            <p className="mt-1 font-medium text-slate-900">{supplier._count?.purchaseInvoices || 0}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.location")}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {supplier.city && supplier.state
                              ? `${supplier.city}, ${supplier.state}`
                              : supplier.city || supplier.state || "-"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block">
                    {selectedIds.size > 0 && (
                      <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                        <span className="text-sm font-medium text-slate-700">
                          {selectedIds.size} {t("common.selected") || "selected"}
                        </span>
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t("common.delete")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                          {t("common.clear") || "Clear"}
                        </Button>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={suppliers.length > 0 && selectedIds.size === suppliers.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedIds(new Set(suppliers.map((s) => s.id)));
                                  } else {
                                    setSelectedIds(new Set());
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("suppliers.contactInfo")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("common.location")}</TableHead>
                            <TableHead>{t("common.balance")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("common.invoices")}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                            <TableHead className="text-right">{t("common.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {suppliers.map((supplier) => (
                            <TableRow key={supplier.id} onClick={() => router.push(`/suppliers/${supplier.id}/statement`)} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedIds.has(supplier.id)}
                                  onCheckedChange={(checked) => {
                                    const next = new Set(selectedIds);
                                    if (checked) {
                                      next.add(supplier.id);
                                    } else {
                                      next.delete(supplier.id);
                                    }
                                    setSelectedIds(next);
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{supplier.name}</div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <div className="text-sm">
                                  {supplier.email && <div>{supplier.email}</div>}
                                  {supplier.phone && (
                                    <div className="text-slate-500">{supplier.phone}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <div className="text-sm">
                                  {supplier.city && supplier.state
                                    ? `${supplier.city}, ${supplier.state}`
                                    : supplier.city || supplier.state || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={
                                    Number(supplier.balance) > 0
                                      ? "text-red-600 font-medium"
                                      : Number(supplier.balance) < 0
                                        ? "text-green-600 font-medium"
                                        : ""
                                  }
                                >
                                  {symbol}{Math.abs(Number(supplier.balance)).toLocaleString(locale)}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">{supplier._count?.purchaseInvoices || 0}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={supplier.isActive ? "default" : "secondary"}
                                >
                                  {supplier.isActive ? t("common.active") : t("common.inactive")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      {t("common.edit")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenOpeningBalanceDialog(supplier)}>
                                      <Wallet className="mr-2 h-4 w-4" />
                                      {t("common.openingBalance")}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => handleDelete(supplier.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      {t("common.delete")}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
    </PageAnimation>
  );
}
