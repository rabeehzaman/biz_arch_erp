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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Package, Search, Warehouse } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { useLanguage } from "@/lib/i18n";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  cost: number;
  unit: { id: string; name: string; code: string } | null;
  isImeiTracked: boolean;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface ImeiEntry {
  imei1: string;
  imei2: string;
  brand: string;
  model: string;
  color: string;
  storageCapacity: string;
  ram: string;
  conditionGrade: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

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

const emptyForm = {
  productId: "",
  quantity: "",
  unitCost: "",
  stockDate: new Date().toISOString().split("T")[0],
  notes: "",
  warehouseId: "",
  selectedBranchId: "",
  supplierId: "",
  imeiNumbers: [] as ImeiEntry[],
};

export default function OpeningStockPage() {
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const { t } = useLanguage();
  const multiBranchEnabled = session?.user?.multiBranchEnabled;

  const [openingStocks, setOpeningStocks] = useState<OpeningStock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [_deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stocksRes, productsRes, branchesRes, warehousesRes, suppliersRes] = await Promise.all([
        fetch("/api/opening-stocks"),
        fetch("/api/products?compact=true"),
        fetch("/api/branches"),
        fetch("/api/warehouses"),
        fetch("/api/suppliers?compact=true"),
      ]);

      if (stocksRes.ok) setOpeningStocks(await stocksRes.json());
      if (productsRes.ok) setProducts(await productsRes.json());
      if (branchesRes.ok) {
        const b = await branchesRes.json();
        setBranches(b.filter((x: Branch) => x.isActive));
      }
      if (warehousesRes.ok) {
        const w = await warehousesRes.json();
        setWarehouses(w.filter((x: WarehouseItem) => x.isActive));
      }
      if (suppliersRes.ok) {
        setSuppliers(await suppliersRes.json());
      }
    } catch {
      toast.error(t("inventory.failedToLoadData2"));
    } finally {
      setIsLoading(false);
    }
  };

  // Products not yet added for the selected warehouse
  const alreadyAdded = new Set(
    openingStocks.map((s) => `${s.productId}|${s.warehouseId ?? ""}`)
  );
  const availableProducts = products.filter(
    (p) => !alreadyAdded.has(`${p.id}|${formData.warehouseId ?? ""}`)
  );

  // Warehouses filtered by selected branch in dialog
  const dialogWarehouses = formData.selectedBranchId
    ? warehouses.filter((w) => w.branchId === formData.selectedBranchId)
    : warehouses;

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

  const selectedProduct = products.find((p) => p.id === formData.productId);
  const isImeiTracked = selectedProduct?.isImeiTracked || false;

  function openDialog() {
    setFormData({ ...emptyForm, stockDate: new Date().toISOString().split("T")[0] });
    setIsDialogOpen(true);
  }

  const makeEmptyImei = (): ImeiEntry => ({
    imei1: "", imei2: "", brand: "", model: "", color: "", storageCapacity: "", ram: "", conditionGrade: "NEW",
  });

  const syncImeiCount = (qty: string, prodId: string) => {
    const isTracked = products.find((p) => p.id === prodId)?.isImeiTracked;
    if (!isTracked) return;
    const count = Math.max(0, Math.floor(parseFloat(qty) || 0));
    setFormData((prev) => {
      const current = prev.imeiNumbers;
      if (current.length === count) return prev;
      if (current.length < count) {
        return {
          ...prev,
          imeiNumbers: [...current, ...Array(count - current.length).fill(null).map(() => makeEmptyImei())],
        };
      }
      return { ...prev, imeiNumbers: current.slice(0, count) };
    });
  };

  const updateImeiField = (idx: number, field: keyof ImeiEntry, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.imeiNumbers];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, imeiNumbers: updated };
    });
  };

  async function handleSave() {
    if (!formData.productId || !formData.quantity || !formData.stockDate) {
      toast.error(t("inventory.productQtyDateRequired"));
      return;
    }
    if (parseFloat(formData.quantity) <= 0) {
      toast.error(t("inventory.quantityGreaterThanZero"));
      return;
    }

    if (isImeiTracked) {
      if (!formData.supplierId) {
        toast.error(t("inventory.supplierRequiredForImei"));
        return;
      }
      const missingImei = formData.imeiNumbers.some((imei) => !imei.imei1 || !imei.brand || !imei.model);
      if (missingImei || formData.imeiNumbers.length === 0) {
        toast.error(t("inventory.fillRequiredImeiFields"));
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/opening-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: formData.productId,
          quantity: parseFloat(formData.quantity),
          unitCost: parseFloat(formData.unitCost) || 0,
          stockDate: formData.stockDate,
          notes: formData.notes || null,
          warehouseId: formData.warehouseId || null,
          deviceDetails: isImeiTracked ? {
            supplierId: formData.supplierId,
            imeiNumbers: formData.imeiNumbers,
          } : undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("inventory.openingStockAdded"));
        setIsDialogOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || t("inventory.failedToAddOpeningStock"));
      }
    } catch {
      toast.error(t("inventory.failedToAddOpeningStock"));
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("inventory.openingStock")}</h2>
            <p className="text-slate-500">{t("inventory.openingStockDesc")}</p>
          </div>
          <Button onClick={openDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("inventory.addOpeningStock")}
          </Button>
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
                        {symbol}{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-500"
                            onClick={() => setDeleteId(stock.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.openingQty")}</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {Number(stock.quantity).toLocaleString("en-IN")}
                              {stock.product.unit && (
                                <span className="ml-1 text-xs text-slate-400">{stock.product.unit.code}</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.remaining")}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">{remaining.toLocaleString("en-IN")}</span>
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
                              {symbol}{Number(stock.unitCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.totalValue")}</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {symbol}{totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                        <TableHead className="w-[50px]"></TableHead>
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
                              {Number(stock.quantity).toLocaleString("en-IN")}
                              {stock.product.unit && (
                                <span className="text-xs text-slate-400 ml-1">{stock.product.unit.code}</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="tabular-nums text-sm">
                                  {remaining.toLocaleString("en-IN")}
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
                              {symbol}{Number(stock.unitCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right font-medium tabular-nums">
                              {symbol}{(Number(stock.quantity) * Number(stock.unitCost)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500"
                                onClick={() => setDeleteId(stock.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent className={isImeiTracked ? "max-w-3xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>{t("inventory.addOpeningStock")}</DialogTitle>
            <DialogDescription>
              {t("inventory.addOpeningStockDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Warehouse selector (multi-branch only) */}
            {multiBranchEnabled && (
              <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                <p className="text-sm font-medium text-slate-700">{t("inventory.warehouseOptional")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("inventory.branch")}</Label>
                    <Select
                      value={formData.selectedBranchId}
                      onValueChange={(bId) =>
                        setFormData((f) => ({ ...f, selectedBranchId: bId, warehouseId: "" }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t("inventory.allBranches")} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("inventory.warehouse")}</Label>
                    <Select
                      value={formData.warehouseId}
                      onValueChange={(wId) => setFormData((f) => ({ ...f, warehouseId: wId }))}
                      disabled={dialogWarehouses.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t("common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {dialogWarehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Product */}
            <div className="space-y-2">
              <Label>{t("inventory.product2")}</Label>
              <Select
                value={formData.productId}
                onValueChange={(v) => {
                  const p = products.find((x) => x.id === v);
                  setFormData((f) => ({
                    ...f,
                    productId: v,
                    unitCost: p ? String(Number(p.cost)) : f.unitCost,
                  }));
                  syncImeiCount(formData.quantity, v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("inventory.selectProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">
                      {t("inventory.allProductsHaveStock")}
                    </div>
                  ) : (
                    availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.sku && <span className="text-slate-400 ml-1">({p.sku})</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity & Cost */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("inventory.quantity2")}</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => {
                    setFormData((f) => ({ ...f, quantity: e.target.value }));
                    syncImeiCount(e.target.value, formData.productId);
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("inventory.unitCost2")} ({symbol})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.unitCost}
                  onChange={(e) => setFormData((f) => ({ ...f, unitCost: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>

            {/* Value preview */}
            {formData.quantity && formData.unitCost && parseFloat(formData.quantity) > 0 && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                <span className="font-medium">{t("inventory.totalValue")}: </span>
                {symbol}{(parseFloat(formData.quantity || "0") * parseFloat(formData.unitCost || "0")).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            )}

            {/* Stock Date */}
            <div className="space-y-2">
              <Label>{t("inventory.stockDate")}</Label>
              <Input
                type="date"
                value={formData.stockDate}
                onChange={(e) => setFormData((f) => ({ ...f, stockDate: e.target.value }))}
              />
              <p className="text-xs text-slate-500">
                {t("inventory.fifoNote")}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t("common.notes")}</Label>
              <Textarea
                placeholder={t("inventory.optionalNotesPlaceholder")}
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* IMEI Details */}
            {isImeiTracked && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>{t("inventory.supplier2")}</Label>
                  <SupplierCombobox
                    suppliers={suppliers}
                    value={formData.supplierId}
                    onValueChange={(v) => setFormData((f) => ({ ...f, supplierId: v }))}
                    onSupplierCreated={fetchData}
                  />
                </div>
                {formData.imeiNumbers.length > 0 && (
                  <div className="space-y-3">
                    <Label>{t("inventory.deviceDetails2")}</Label>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                      {formData.imeiNumbers.map((imei, idx) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-50 border rounded-lg">
                          <Input
                            placeholder={`IMEI 1 (${idx + 1}) *`}
                            value={imei.imei1}
                            onChange={(e) => updateImeiField(idx, "imei1", e.target.value)}
                            className="font-mono text-xs"
                            maxLength={15}
                            required
                          />
                          <Input
                            placeholder="IMEI 2"
                            value={imei.imei2}
                            onChange={(e) => updateImeiField(idx, "imei2", e.target.value)}
                            className="font-mono text-xs"
                            maxLength={15}
                          />
                          <Input
                            placeholder={`${t("mobileShop.brand")} *`}
                            value={imei.brand}
                            onChange={(e) => updateImeiField(idx, "brand", e.target.value)}
                            className="text-xs"
                            required
                          />
                          <Input
                            placeholder={`${t("mobileShop.model")} *`}
                            value={imei.model}
                            onChange={(e) => updateImeiField(idx, "model", e.target.value)}
                            className="text-xs"
                            required
                          />
                          <Input
                            placeholder={t("mobileShop.color")}
                            value={imei.color}
                            onChange={(e) => updateImeiField(idx, "color", e.target.value)}
                            className="text-xs"
                          />
                          <Select
                            value={imei.storageCapacity}
                            onValueChange={(value) => updateImeiField(idx, "storageCapacity", value)}
                          >
                            <SelectTrigger className="text-xs h-9">
                              <SelectValue placeholder={t("mobileShop.storage")} />
                            </SelectTrigger>
                            <SelectContent>
                              {["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4TB"].map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={imei.ram}
                            onValueChange={(value) => updateImeiField(idx, "ram", value)}
                          >
                            <SelectTrigger className="text-xs h-9">
                              <SelectValue placeholder={t("mobileShop.ram")} />
                            </SelectTrigger>
                            <SelectContent>
                              {["1GB", "1.5GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB", "32GB", "64GB"].map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={imei.conditionGrade}
                            onValueChange={(value) => updateImeiField(idx, "conditionGrade", value)}
                          >
                            <SelectTrigger className="text-xs h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NEW">{t("inventory.conditionNew")}</SelectItem>
                              <SelectItem value="OPEN_BOX">{t("inventory.conditionOpenBox")}</SelectItem>
                              <SelectItem value="GRADE_A">{t("inventory.conditionGradeA")}</SelectItem>
                              <SelectItem value="GRADE_B">{t("inventory.conditionGradeB")}</SelectItem>
                              <SelectItem value="GRADE_C">{t("inventory.conditionGradeC")}</SelectItem>
                              <SelectItem value="REFURBISHED">{t("inventory.conditionRefurbished")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : t("inventory.addStock")}
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
