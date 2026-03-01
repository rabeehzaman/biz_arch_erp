"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stocksRes, productsRes, branchesRes, warehousesRes, suppliersRes] = await Promise.all([
        fetch("/api/opening-stocks"),
        fetch("/api/products"),
        fetch("/api/branches"),
        fetch("/api/warehouses"),
        fetch("/api/suppliers"),
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
      toast.error("Failed to load data");
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
      toast.error("Product, quantity, and stock date are required");
      return;
    }
    if (parseFloat(formData.quantity) <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    if (isImeiTracked) {
      if (!formData.supplierId) {
        toast.error("Supplier is required for IMEI tracked products");
        return;
      }
      const missingImei = formData.imeiNumbers.some((imei) => !imei.imei1 || !imei.brand || !imei.model);
      if (missingImei || formData.imeiNumbers.length === 0) {
        toast.error("Please fill in all required IMEI fields (IMEI 1, Brand, Model)");
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
        toast.success("Opening stock added and stock lot created");
        setIsDialogOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add opening stock");
      }
    } catch {
      toast.error("Failed to add opening stock");
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
        toast.success("Opening stock entry deleted");
        setDeleteId(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
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
            <h2 className="text-2xl font-bold text-slate-900">Opening Stock</h2>
            <p className="text-slate-500">Set initial inventory quantities and values for your products</p>
          </div>
          <Button onClick={openDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Opening Stock
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
                      <p className="text-sm text-slate-500">Products</p>
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
                      <p className="text-sm text-slate-500">Total Value</p>
                      <p className="text-2xl font-bold">
                        ₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
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
                      <p className="text-sm text-slate-500">Warehouses</p>
                      <p className="text-2xl font-bold">{uniqueWarehouses || (multiBranchEnabled ? "0" : "—")}</p>
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
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {multiBranchEnabled && warehouses.length > 0 && (
                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    <SelectItem value="none">No Warehouse (Global)</SelectItem>
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
            <CardTitle>Stock Entries ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Package className="h-12 w-12 mb-3 text-slate-300" />
                <p className="font-medium">No opening stock entries</p>
                <p className="text-sm">Click &quot;Add Opening Stock&quot; to set initial inventory</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Opening Qty</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    {multiBranchEnabled && <TableHead>Warehouse</TableHead>}
                    <TableHead>Date</TableHead>
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
                        <TableCell className="text-right">
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
                              {pct.toFixed(0)}% left
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          ₹{Number(stock.unitCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          ₹{(Number(stock.quantity) * Number(stock.unitCost)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        {multiBranchEnabled && (
                          <TableCell>
                            {stock.warehouse ? (
                              <span className="text-sm text-slate-600">{stock.warehouse.name}</span>
                            ) : (
                              <span className="text-sm text-slate-400">Global</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-slate-600">
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent className={isImeiTracked ? "max-w-3xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>Add Opening Stock</DialogTitle>
            <DialogDescription>
              Set the initial quantity and cost for a product. A stock lot will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Warehouse selector (multi-branch only) */}
            {multiBranchEnabled && (
              <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                <p className="text-sm font-medium text-slate-700">Warehouse (optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Branch</Label>
                    <Select
                      value={formData.selectedBranchId}
                      onValueChange={(bId) =>
                        setFormData((f) => ({ ...f, selectedBranchId: bId, warehouseId: "" }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All branches" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Warehouse</Label>
                    <Select
                      value={formData.warehouseId}
                      onValueChange={(wId) => setFormData((f) => ({ ...f, warehouseId: wId }))}
                      disabled={dialogWarehouses.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select" />
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
              <Label>Product *</Label>
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
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">
                      All products have opening stock for this warehouse
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity *</Label>
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
                <Label>Unit Cost (₹)</Label>
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
                <span className="font-medium">Total Value: </span>
                ₹{(parseFloat(formData.quantity || "0") * parseFloat(formData.unitCost || "0")).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            )}

            {/* Stock Date */}
            <div className="space-y-2">
              <Label>Stock Date *</Label>
              <Input
                type="date"
                value={formData.stockDate}
                onChange={(e) => setFormData((f) => ({ ...f, stockDate: e.target.value }))}
              />
              <p className="text-xs text-slate-500">
                Stock from earlier dates is consumed first (FIFO order).
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* IMEI Details */}
            {isImeiTracked && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Supplier *</Label>
                  <SupplierCombobox
                    suppliers={suppliers}
                    value={formData.supplierId}
                    onValueChange={(v) => setFormData((f) => ({ ...f, supplierId: v }))}
                  />
                </div>
                {formData.imeiNumbers.length > 0 && (
                  <div className="space-y-3">
                    <Label>Device Details *</Label>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
                      {formData.imeiNumbers.map((imei, idx) => (
                        <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-50 border rounded-lg">
                          <Input
                            placeholder={`IMEI 1 (Device ${idx + 1}) *`}
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
                            placeholder="Brand *"
                            value={imei.brand}
                            onChange={(e) => updateImeiField(idx, "brand", e.target.value)}
                            className="text-xs"
                            required
                          />
                          <Input
                            placeholder="Model *"
                            value={imei.model}
                            onChange={(e) => updateImeiField(idx, "model", e.target.value)}
                            className="text-xs"
                            required
                          />
                          <Input
                            placeholder="Color"
                            value={imei.color}
                            onChange={(e) => updateImeiField(idx, "color", e.target.value)}
                            className="text-xs"
                          />
                          <Input
                            placeholder="Storage"
                            value={imei.storageCapacity}
                            onChange={(e) => updateImeiField(idx, "storageCapacity", e.target.value)}
                            className="text-xs"
                          />
                          <Input
                            placeholder="RAM"
                            value={imei.ram}
                            onChange={(e) => updateImeiField(idx, "ram", e.target.value)}
                            className="text-xs"
                          />
                          <Select
                            value={imei.conditionGrade}
                            onValueChange={(value) => updateImeiField(idx, "conditionGrade", value)}
                          >
                            <SelectTrigger className="text-xs h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NEW">New</SelectItem>
                              <SelectItem value="OPEN_BOX">Open Box</SelectItem>
                              <SelectItem value="GRADE_A">Grade A</SelectItem>
                              <SelectItem value="GRADE_B">Grade B</SelectItem>
                              <SelectItem value="GRADE_C">Grade C</SelectItem>
                              <SelectItem value="REFURBISHED">Refurbished</SelectItem>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Add Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Opening Stock"
        description="This will remove the opening stock entry and its associated stock lot. Any sales that consumed this stock will be affected. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </PageAnimation>
  );
}
