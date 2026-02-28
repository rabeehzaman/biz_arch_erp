"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  code: string;
  name: string;
}

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editDevice?: any;
}

export function DeviceFormDialog({ open, onOpenChange, onSuccess, editDevice }: DeviceFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    imei1: "",
    imei2: "",
    serialNumber: "",
    brand: "",
    model: "",
    color: "",
    storageCapacity: "",
    ram: "",
    networkStatus: "UNLOCKED",
    conditionGrade: "NEW",
    batteryHealthPercentage: "",
    productId: "",
    supplierId: "",
    costPrice: "",
    landedCost: "",
    sellingPrice: "",
    supplierWarrantyExpiry: "",
    customerWarrantyExpiry: "",
    notes: "",
    createProduct: false,
    productName: "",
    categoryId: "",
    unitId: "",
    hsnCode: "",
    gstRate: "18",
  });

  useEffect(() => {
    if (formData.createProduct && formData.brand && formData.model) {
      const parts = [
        editDevice ? formData.brand : formData.model.split(" ")[0] || "Unknown",
        editDevice ? formData.model : formData.model.split(" ").slice(1).join(" ") || formData.model,
        formData.color,
        formData.storageCapacity
      ].filter(Boolean);
      const newName = parts.join(" ");
      if (formData.productName !== newName) {
        setFormData((prev) => ({ ...prev, productName: newName }));
      }
    }
  }, [formData.createProduct, formData.brand, formData.model, formData.color, formData.storageCapacity, editDevice]);

  useEffect(() => {
    if (open) {
      if (editDevice) {
        setFormData({
          imei1: editDevice.imei1 || "", imei2: editDevice.imei2 || "", serialNumber: editDevice.serialNumber || "",
          brand: editDevice.brand || "", model: editDevice.brand && editDevice.model ? `${editDevice.brand} ${editDevice.model}`.trim() : (editDevice.model || editDevice.brand || ""), color: editDevice.color || "",
          storageCapacity: editDevice.storageCapacity || "", ram: editDevice.ram || "", networkStatus: editDevice.networkStatus || "UNLOCKED",
          conditionGrade: editDevice.conditionGrade || "NEW", batteryHealthPercentage: editDevice.batteryHealthPercentage ? String(editDevice.batteryHealthPercentage) : "",
          productId: editDevice.productId || "", supplierId: editDevice.supplierId || "", costPrice: editDevice.costPrice !== undefined ? String(editDevice.costPrice) : "",
          landedCost: editDevice.landedCost !== undefined ? String(editDevice.landedCost) : "", sellingPrice: editDevice.sellingPrice !== undefined ? String(editDevice.sellingPrice) : "",
          supplierWarrantyExpiry: editDevice.supplierWarrantyExpiry ? new Date(editDevice.supplierWarrantyExpiry).toISOString().split('T')[0] : "",
          customerWarrantyExpiry: editDevice.customerWarrantyExpiry ? new Date(editDevice.customerWarrantyExpiry).toISOString().split('T')[0] : "", notes: editDevice.notes || "",
          createProduct: false, productName: "", categoryId: "", unitId: "", hsnCode: "", gstRate: "18",
        });
      } else {
        resetForm();
      }
      fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers).catch(() => { });
      fetch("/api/products?excludeServices=true").then((r) => r.json()).then(setProducts).catch(() => { });
      fetch("/api/product-categories").then((r) => r.json()).then(setCategories).catch(() => { });
      fetch("/api/units").then((r) => r.json()).then(setUnits).catch(() => { });
    }
  }, [open, editDevice]);

  const resetForm = () => {
    setFormData({
      imei1: "", imei2: "", serialNumber: "", brand: "", model: "",
      color: "", storageCapacity: "", ram: "", networkStatus: "UNLOCKED",
      conditionGrade: "NEW", batteryHealthPercentage: "", productId: "",
      supplierId: "", costPrice: "", landedCost: "", sellingPrice: "",
      supplierWarrantyExpiry: "", customerWarrantyExpiry: "", notes: "",
      createProduct: false, productName: "", categoryId: "", unitId: "", hsnCode: "", gstRate: "18",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imei1 || !formData.model || !formData.supplierId || !formData.costPrice) {
      toast.error("IMEI 1, Model, Supplier, and Cost Price are required");
      return;
    }
    if (formData.createProduct && !formData.productName) {
      toast.error("Product name is required when creating a new product");
      return;
    }

    setSaving(true);
    try {
      const url = editDevice ? `/api/mobile-devices/${editDevice.id}` : "/api/mobile-devices";
      const method = editDevice ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          brand: formData.model.split(" ")[0] || "Unknown",
          model: formData.model.split(" ").slice(1).join(" ") || formData.model,
          costPrice: parseFloat(formData.costPrice),
          landedCost: parseFloat(formData.landedCost) || 0,
          sellingPrice: parseFloat(formData.sellingPrice) || 0,
          batteryHealthPercentage: formData.batteryHealthPercentage ? parseInt(formData.batteryHealthPercentage) : null,
          productId: formData.productId === "CREATE_NEW" ? null : (formData.productId || null),
          supplierWarrantyExpiry: formData.supplierWarrantyExpiry || null,
          customerWarrantyExpiry: formData.customerWarrantyExpiry || null,
          createProduct: formData.createProduct,
          productName: formData.productName,
          categoryId: formData.categoryId || null,
          unitId: formData.unitId || null,
          hsnCode: formData.hsnCode || null,
          gstRate: parseFloat(formData.gstRate) || 0,
        }),
      });

      if (res.ok) {
        toast.success(editDevice ? "Device updated successfully" : "Device added successfully");
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add device");
      }
    } catch {
      toast.error("Failed to add device");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
      <DialogContent className="sm:max-w-2xl overflow-y-auto max-h-[90vh]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editDevice ? "Edit Device" : "Add Device"}</DialogTitle>
            <DialogDescription>{editDevice ? "Update details for this mobile device" : "Manually add a mobile device to inventory"}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>IMEI 1 *</Label>
                <Input
                  value={formData.imei1}
                  onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
                  placeholder="15-digit IMEI"
                  maxLength={15}
                  className="font-mono"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>IMEI 2</Label>
                <Input
                  value={formData.imei2}
                  onChange={(e) => setFormData({ ...formData, imei2: e.target.value })}
                  placeholder="Optional"
                  maxLength={15}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2 col-span-2">
                <Label>Brand & Model *</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g. Samsung Galaxy S24"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Serial Number</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Color</Label>
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="e.g. Black"
                />
              </div>
              <div className="grid gap-2">
                <Label>Storage</Label>
                <Input
                  value={formData.storageCapacity}
                  onChange={(e) => setFormData({ ...formData, storageCapacity: e.target.value })}
                  placeholder="e.g. 128GB"
                />
              </div>
              <div className="grid gap-2">
                <Label>RAM</Label>
                <Input
                  value={formData.ram}
                  onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                  placeholder="e.g. 8GB"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Network Status</Label>
                <select
                  value={formData.networkStatus}
                  onChange={(e) => setFormData({ ...formData, networkStatus: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="UNLOCKED">Unlocked</option>
                  <option value="LOCKED">Locked</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Condition</Label>
                <select
                  value={formData.conditionGrade}
                  onChange={(e) => setFormData({ ...formData, conditionGrade: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="NEW">New</option>
                  <option value="OPEN_BOX">Open Box</option>
                  <option value="GRADE_A">Grade A</option>
                  <option value="GRADE_B">Grade B</option>
                  <option value="GRADE_C">Grade C</option>
                  <option value="REFURBISHED">Refurbished</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Battery Health %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.batteryHealthPercentage}
                  onChange={(e) => setFormData({ ...formData, batteryHealthPercentage: e.target.value })}
                  placeholder="e.g. 95"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Product</Label>
                <select
                  value={formData.productId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "CREATE_NEW") {
                      setFormData({ ...formData, productId: value, createProduct: true });
                    } else {
                      setFormData({ ...formData, productId: value, createProduct: false });
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">-- Select Product --</option>
                  <option value="CREATE_NEW">-- Create New Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Supplier *</Label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  required
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.createProduct && (
              <div className="rounded-md border p-4 space-y-4 bg-muted/20">
                <h4 className="text-sm font-medium border-b pb-2">New Product Details</h4>
                <div className="grid gap-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="e.g. Samsung Galaxy S24 Black 128GB"
                    required={formData.createProduct}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm bg-background"
                    >
                      <option value="">-- None --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <select
                      value={formData.unitId}
                      onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm bg-background"
                    >
                      <option value="">-- Select Unit --</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>{u.code}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>HSN Code</Label>
                    <Input
                      value={formData.hsnCode}
                      onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                      placeholder="e.g. 8517"
                      className="bg-background"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>GST Rate (%)</Label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm bg-background"
                    >
                      <option value="0">0</option>
                      <option value="5">5</option>
                      <option value="12">12</option>
                      <option value="18">18</option>
                      <option value="28">28</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Cost Price *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Landed Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.landedCost}
                  onChange={(e) => setFormData({ ...formData, landedCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Supplier Warranty Expiry</Label>
                <Input
                  type="date"
                  value={formData.supplierWarrantyExpiry}
                  onChange={(e) => setFormData({ ...formData, supplierWarrantyExpiry: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Customer Warranty Expiry</Label>
                <Input
                  type="date"
                  value={formData.customerWarrantyExpiry}
                  onChange={(e) => setFormData({ ...formData, customerWarrantyExpiry: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editDevice ? "Update Device" : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
