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

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeviceFormDialog({ open, onOpenChange, onSuccess }: DeviceFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

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
  });

  useEffect(() => {
    if (open) {
      fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers).catch(() => {});
      fetch("/api/products?excludeServices=true").then((r) => r.json()).then(setProducts).catch(() => {});
    }
  }, [open]);

  const resetForm = () => {
    setFormData({
      imei1: "", imei2: "", serialNumber: "", brand: "", model: "",
      color: "", storageCapacity: "", ram: "", networkStatus: "UNLOCKED",
      conditionGrade: "NEW", batteryHealthPercentage: "", productId: "",
      supplierId: "", costPrice: "", landedCost: "", sellingPrice: "",
      supplierWarrantyExpiry: "", customerWarrantyExpiry: "", notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imei1 || !formData.brand || !formData.model || !formData.supplierId || !formData.costPrice) {
      toast.error("IMEI 1, Brand, Model, Supplier, and Cost Price are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mobile-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          costPrice: parseFloat(formData.costPrice),
          landedCost: parseFloat(formData.landedCost) || 0,
          sellingPrice: parseFloat(formData.sellingPrice) || 0,
          batteryHealthPercentage: formData.batteryHealthPercentage ? parseInt(formData.batteryHealthPercentage) : null,
          productId: formData.productId || null,
          supplierWarrantyExpiry: formData.supplierWarrantyExpiry || null,
          customerWarrantyExpiry: formData.customerWarrantyExpiry || null,
        }),
      });

      if (res.ok) {
        toast.success("Device added successfully");
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
            <DialogTitle>Add Device</DialogTitle>
            <DialogDescription>Manually add a mobile device to inventory</DialogDescription>
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
              <div className="grid gap-2">
                <Label>Brand *</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g. Samsung"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Model *</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g. Galaxy S24"
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
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">-- Select Product --</option>
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
              Add Device
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
