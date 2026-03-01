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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ImeiCameraScanner } from "./imei-camera-scanner";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  isImeiTracked: boolean;
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

  const [formData, setFormData] = useState({
    imei1: "",
    imei2: "",
    serialNumber: "",
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
      if (editDevice) {
        setFormData({
          imei1: editDevice.imei1 || "", imei2: editDevice.imei2 || "", serialNumber: editDevice.serialNumber || "",
          color: editDevice.color || "",
          storageCapacity: editDevice.storageCapacity || "", ram: editDevice.ram || "", networkStatus: editDevice.networkStatus || "UNLOCKED",
          conditionGrade: editDevice.conditionGrade || "NEW", batteryHealthPercentage: editDevice.batteryHealthPercentage ? String(editDevice.batteryHealthPercentage) : "",
          productId: editDevice.productId || "", supplierId: editDevice.supplierId || "", costPrice: editDevice.costPrice !== undefined ? String(editDevice.costPrice) : "",
          landedCost: editDevice.landedCost !== undefined ? String(editDevice.landedCost) : "", sellingPrice: editDevice.sellingPrice !== undefined ? String(editDevice.sellingPrice) : "",
          supplierWarrantyExpiry: editDevice.supplierWarrantyExpiry ? new Date(editDevice.supplierWarrantyExpiry).toISOString().split('T')[0] : "",
          customerWarrantyExpiry: editDevice.customerWarrantyExpiry ? new Date(editDevice.customerWarrantyExpiry).toISOString().split('T')[0] : "", notes: editDevice.notes || "",
        });
      } else {
        resetForm();
      }
      fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers).catch(() => { });
      fetch("/api/products?excludeServices=true").then((r) => r.json()).then((data) => setProducts(data.filter((p: Product) => p.isImeiTracked))).catch(() => { });
    }
  }, [open, editDevice]);

  const resetForm = () => {
    setFormData({
      imei1: "", imei2: "", serialNumber: "",
      color: "", storageCapacity: "", ram: "", networkStatus: "UNLOCKED",
      conditionGrade: "NEW", batteryHealthPercentage: "", productId: "",
      supplierId: "", costPrice: "", landedCost: "", sellingPrice: "",
      supplierWarrantyExpiry: "", customerWarrantyExpiry: "", notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imei1 || !formData.supplierId || !formData.costPrice) {
      toast.error("IMEI 1, Supplier, and Cost Price are required");
      return;
    }
    if (!editDevice && !formData.productId) {
      toast.error("Product is required");
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
          brand: (() => { const n = (products.find(p => p.id === formData.productId)?.name || editDevice?.brand || "").trim(); return n.split(" ")[0] || "Unknown"; })(),
          model: (() => { const n = (products.find(p => p.id === formData.productId)?.name || `${editDevice?.brand || ""} ${editDevice?.model || ""}`).trim(); const parts = n.split(" "); return parts.slice(1).join(" ") || n; })(),
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
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>IMEI 1 *</Label>
                <div className="flex gap-1">
                  <Input
                    value={formData.imei1}
                    onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
                    placeholder="15-digit IMEI"
                    maxLength={15}
                    className="font-mono"
                    required
                  />
                  <ImeiCameraScanner
                    onScan={(imei) => setFormData((prev) => ({ ...prev, imei1: imei }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>IMEI 2</Label>
                <div className="flex gap-1">
                  <Input
                    value={formData.imei2}
                    onChange={(e) => setFormData({ ...formData, imei2: e.target.value })}
                    placeholder="Optional"
                    maxLength={15}
                    className="font-mono"
                  />
                  <ImeiCameraScanner
                    onScan={(imei) => setFormData((prev) => ({ ...prev, imei2: imei }))}
                  />
                </div>
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
                <Select
                  value={formData.networkStatus}
                  onValueChange={(value) => setFormData({ ...formData, networkStatus: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNLOCKED">Unlocked</SelectItem>
                    <SelectItem value="LOCKED">Locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Condition</Label>
                <Select
                  value={formData.conditionGrade}
                  onValueChange={(value) => setFormData({ ...formData, conditionGrade: value })}
                >
                  <SelectTrigger className="w-full">
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
                <Label>Product {!editDevice && "*"}</Label>
                <Combobox
                  items={products}
                  value={formData.productId}
                  onValueChange={(value) => setFormData({ ...formData, productId: value })}
                  getId={(p) => p.id}
                  getLabel={(p) => p.name}
                  filterFn={(p, query) => p.name.toLowerCase().includes(query)}
                  placeholder="Search products..."
                  emptyText={products.length === 0 ? "No IMEI-tracked products found." : "No products found."}
                />
                {products.length === 0 && (
                  <p className="text-xs text-muted-foreground">No IMEI-tracked products found. Create one from the Products page first.</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Supplier *</Label>
                <SupplierCombobox
                  suppliers={suppliers as any}
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                  required
                />
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
              {editDevice ? "Update Device" : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
