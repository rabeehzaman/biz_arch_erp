"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Package, Search, Warehouse } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  isActive: boolean;
}

interface OpeningStock {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    unit: { name: string; code: string } | null;
  };
  quantity: number;
  unitCost: number;
  stockDate: string;
  notes: string | null;
  warehouseId: string | null;
  warehouse?: { id: string; name: string; code: string } | null;
  stockLot: { id: string; remainingQuantity: number } | null;
}

export default function OpeningStockPage() {
  const { data: session } = useSession();
  const { symbol, locale } = useCurrency();
  const { t } = useLanguage();
  const multiBranchEnabled = session?.user?.multiBranchEnabled;

  const [openingStocks, setOpeningStocks] = useState<OpeningStock[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("all");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [_deleting, setDeleting] = useState(false);

  const [editStock, setEditStock] = useState<OpeningStock | null>(null);
  const [editForm, setEditForm] = useState({ quantity: "", unitCost: "", stockDate: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stocksRes, warehousesRes] = await Promise.all([
        fetch("/api/opening-stocks"),
        fetch("/api/warehouses"),
      ]);

      if (stocksRes.ok) setOpeningStocks(await stocksRes.json());
      if (warehousesRes.ok) {
        const w = await warehousesRes.json();
        setWarehouses(w.filter((x: WarehouseItem) => x.isActive));
      }
    } catch {
      toast.error(t("inventory.failedToLoadData2"));
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered table rows
  const filtered = openingStocks.filter((s) => {
    const matchSearch =
      s.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.product.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchWh =
      filterWarehouse === "all" ||
      (filterWarehouse === "none" ? !s.warehouseId : s.warehouseId === filterWarehouse);
    return matchSearch && matchWh;
  });

  const totalValue = openingStocks.reduce(
    (sum, s) => sum + Number(s.quantity) * Number(s.unitCost),
    0
  );
  const uniqueWarehouses = new Set(openingStocks.map((s) => s.warehouseId).filter(Boolean)).size;

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/opening-stocks/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("inventory.openingStockDeleted"));
        setDeleteId(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || t("common.delete"));
      }
    } catch {
      toast.error(t("common.delete"));
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(stock: OpeningStock) {
    setEditStock(stock);
    setEditForm({
      quantity: String(Number(stock.quantity)),
      unitCost: String(Number(stock.unitCost)),
      stockDate: new Date(stock.stockDate).toISOString().split("T")[0],
      notes: stock.notes || "",
    });
  }

  async function handleEdit() {
    if (!editStock) return;
    if (!editForm.quantity || parseFloat(editForm.quantity) <= 0) {
      toast.error(t("inventory.quantityGreaterThanZero"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/opening-stocks/${editStock.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: parseFloat(editForm.quantity),
          unitCost: parseFloat(editForm.unitCost) || 0,
          stockDate: editForm.stockDate,
          notes: editForm.notes || null,
        }),
      });
      if (res.ok) {
        toast.success(t("inventory.openingStockUpdated"));
        setEditStock(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || t("inventory.failedToUpdateOpeningStock"));
      }
    } catch {
      toast.error(t("inventory.failedToUpdateOpeningStock"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("inventory.openingStock")}</h2>
            <p className="text-slate-500">{t("inventory.openingStockDesc")}</p>
          </div>
          <Link href="/inventory/opening-stock/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("inventory.addOpeningStock")}
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <StaggerContainer>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StaggerItem>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t("common.products")}</p>
                      <p className="text-2xl font-bold">{openingStocks.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <Package className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t("inventory.totalValue")}</p>
                      <p className="text-2xl font-bold">
                        {symbol}{totalValue.toLocaleString(locale, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Warehouse className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">{t("inventory.warehouses")}</p>
                      <p className="text-2xl font-bold">{uniqueWarehouses || (multiBranchEnabled ? "0" : "\u2014")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          </div>
        </StaggerContainer>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("inventory.searchProducts")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {multiBranchEnabled && warehouses.length > 0 && (
                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={t("inventory.allWarehouses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("inventory.allWarehouses")}</SelectItem>
                    <SelectItem value="none">{t("inventory.noWarehouseGlobal")}</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.branch.name} → {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("inventory.stockEntries")} ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Package className="h-12 w-12 mb-3 text-slate-300" />
                <p className="font-medium">{t("inventory.noOpeningStockEntries")}</p>
                <p className="text-sm">{t("inventory.addOpeningStockCTA")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 sm:hidden">
                  {filtered.map((stock) => {
                    const remaining = stock.stockLot ? Number(stock.stockLot.remainingQuantity) : 0;
                    const pct = Number(stock.quantity) > 0 ? (remaining / Number(stock.quantity)) * 100 : 0;
                    const totalValue = Number(stock.quantity) * Number(stock.unitCost);

                    return (
                      <div key={stock.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{stock.product.name}</p>
                            {stock.product.sku && (
                              <p className="mt-1 text-xs text-slate-500">SKU: {stock.product.sku}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-slate-400 hover:text-blue-500"
                              onClick={() => openEdit(stock)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-500"
                              onClick={() => setDeleteId(stock.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.openingQty")}</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {Number(stock.quantity).toLocaleString(locale)}
                              {stock.product.unit && (
                                <span className="ml-1 text-xs text-slate-400">{stock.product.unit.code}</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.remaining")}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">{remaining.toLocaleString(locale)}</span>
                              <Badge
                                variant="outline"
                                className={
                                  pct > 50
                                    ? "text-xs border-emerald-200 text-emerald-700 bg-emerald-50"
                                    : pct > 10
                                      ? "text-xs border-amber-200 text-amber-700 bg-amber-50"
                                      : "text-xs border-red-200 text-red-700 bg-red-50"
                                }
                              >
                                {pct.toFixed(0)}% {t("inventory.pctLeft")}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.unitCost")}</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {symbol}{Number(stock.unitCost).toLocaleString(locale, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.totalValue")}</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {symbol}{totalValue.toLocaleString(locale, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          {multiBranchEnabled && (
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.warehouse")}</p>
                              <p className="mt-1 text-slate-900">{stock.warehouse?.name || t("inventory.global")}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.date")}</p>
                            <p className="mt-1 text-slate-900">{format(new Date(stock.stockDate), "dd MMM yyyy")}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>{t("common.product")}</TableHead>
                        <TableHead className="text-right">{t("inventory.openingQty")}</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">{t("inventory.remaining")}</TableHead>
                        <TableHead className="hidden md:table-cell text-right">{t("inventory.unitCost")}</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">{t("inventory.totalValue")}</TableHead>
                        {multiBranchEnabled && <TableHead className="hidden sm:table-cell">{t("inventory.warehouse")}</TableHead>}
                        <TableHead className="hidden sm:table-cell">{t("common.date")}</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((stock) => {
                        const remaining = stock.stockLot ? Number(stock.stockLot.remainingQuantity) : 0;
                        const pct = Number(stock.quantity) > 0 ? (remaining / Number(stock.quantity)) * 100 : 0;
                        return (
                          <TableRow key={stock.id} className="hover:bg-slate-50">
                            <TableCell>
                              <p className="font-medium text-slate-900">{stock.product.name}</p>
                              {stock.product.sku && (
                                <p className="text-xs text-slate-500">SKU: {stock.product.sku}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(stock.quantity).toLocaleString(locale)}
                              {stock.product.unit && (
                                <span className="text-xs text-slate-400 ml-1">{stock.product.unit.code}</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="tabular-nums text-sm">
                                  {remaining.toLocaleString(locale)}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={
                                    pct > 50
                                      ? "text-xs border-emerald-200 text-emerald-700 bg-emerald-50"
                                      : pct > 10
                                        ? "text-xs border-amber-200 text-amber-700 bg-amber-50"
                                        : "text-xs border-red-200 text-red-700 bg-red-50"
                                  }
                                >
                                  {pct.toFixed(0)}% {t("inventory.pctLeft")}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-right tabular-nums">
                              {symbol}{Number(stock.unitCost).toLocaleString(locale, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right font-medium tabular-nums">
                              {symbol}{(Number(stock.quantity) * Number(stock.unitCost)).toLocaleString(locale, { minimumFractionDigits: 2 })}
                            </TableCell>
                            {multiBranchEnabled && (
                              <TableCell className="hidden sm:table-cell">
                                {stock.warehouse ? (
                                  <span className="text-sm text-slate-600">{stock.warehouse.name}</span>
                                ) : (
                                  <span className="text-sm text-slate-400">{t("inventory.global")}</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="hidden sm:table-cell text-sm text-slate-600">
                              {format(new Date(stock.stockDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-blue-500"
                                  onClick={() => openEdit(stock)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                                  onClick={() => setDeleteId(stock.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editStock} onOpenChange={(open) => { if (!open) setEditStock(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inventory.editOpeningStock")} — {editStock?.product.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.quantity")} *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.unitCost")} ({symbol})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.unitCost}
                  onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
            {editForm.quantity && editForm.unitCost && parseFloat(editForm.quantity) > 0 && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                <span className="font-medium">{t("inventory.totalValue")}: </span>
                {symbol}{(parseFloat(editForm.quantity || "0") * parseFloat(editForm.unitCost || "0")).toLocaleString(locale, { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("inventory.stockDate")}</Label>
              <Input
                type="date"
                value={editForm.stockDate}
                onChange={(e) => setEditForm((f) => ({ ...f, stockDate: e.target.value }))}
              />
              <p className="text-xs text-slate-500">{t("inventory.fifoNote")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("common.notes")}</Label>
              <Input
                type="text"
                placeholder={t("inventory.optionalNotesPlaceholder")}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStock(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t("inventory.deleteOpeningStock")}
        description={t("inventory.deleteOpeningStockDesc")}
        confirmLabel={t("common.delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageAnimation>
  );
}
