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
import { Loader2, Upload, X } from "lucide-react";
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
  const [photoUploading, setPhotoUploading] = useState(false);

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
    photoUrls: [] as string[],
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
          photoUrls: Array.isArray(editDevice.photoUrls) ? editDevice.photoUrls : [],
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
      supplierWarrantyExpiry: "", customerWarrantyExpiry: "", notes: "", photoUrls: [],
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Photo too large. Maximum size is 10 MB.");
      return;
    }
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Upload failed");
      }
      setFormData((prev) => ({ ...prev, photoUrls: [...prev.photoUrls, data.secure_url] }));
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((_, i) => i !== index) }));
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
      {/* flex+min-h-0 on form lets header/footer stay sticky while body scrolls */}
      <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-2xl max-h-[90dvh]">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

          {/* Sticky header */}
          <DialogHeader className="shrink-0 px-4 pt-5 pb-4 sm:px-6 border-b">
            <DialogTitle>{editDevice ? "Edit Device" : "Add Device"}</DialogTitle>
            <DialogDescription>
              {editDevice ? "Update details for this mobile device" : "Manually add a mobile device to inventory"}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">

            {/* Identifiers */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identifiers</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>IMEI 1 *</Label>
                  <div className="flex gap-1">
                    <Input
                      value={formData.imei1}
                      onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
                      placeholder="15-digit IMEI"
                      maxLength={15}
                      inputMode="numeric"
                      className="font-mono"
                      required
                    />
                    <ImeiCameraScanner onScan={(imei) => setFormData((prev) => ({ ...prev, imei1: imei }))} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>IMEI 2</Label>
                  <div className="flex gap-1">
                    <Input
                      value={formData.imei2}
                      onChange={(e) => setFormData({ ...formData, imei2: e.target.value })}
                      placeholder="Optional"
                      maxLength={15}
                      inputMode="numeric"
                      className="font-mono"
                    />
                    <ImeiCameraScanner onScan={(imei) => setFormData((prev) => ({ ...prev, imei2: imei }))} />
                  </div>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Serial Number</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </fieldset>

            {/* Specifications — 2 cols on mobile, 3 on sm+ */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specifications</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Color</Label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g. Black"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Storage</Label>
                  <Select value={formData.storageCapacity} onValueChange={(value) => setFormData({ ...formData, storageCapacity: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4TB"].map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>RAM</Label>
                  <Select value={formData.ram} onValueChange={(value) => setFormData({ ...formData, ram: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["1GB", "1.5GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB", "32GB", "64GB"].map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Network</Label>
                  <Select value={formData.networkStatus} onValueChange={(value) => setFormData({ ...formData, networkStatus: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNLOCKED">Unlocked</SelectItem>
                      <SelectItem value="LOCKED">Locked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Condition</Label>
                  <Select value={formData.conditionGrade} onValueChange={(value) => setFormData({ ...formData, conditionGrade: value })}>
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
                <div className="grid gap-1.5">
                  <Label>Battery %</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100"
                    value={formData.batteryHealthPercentage}
                    onChange={(e) => setFormData({ ...formData, batteryHealthPercentage: e.target.value })}
                    placeholder="e.g. 95"
                  />
                </div>
              </div>
            </fieldset>

            {/* Product & Supplier */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product & Supplier</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
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
                <div className="grid gap-1.5">
                  <Label>Supplier *</Label>
                  <SupplierCombobox
                    suppliers={suppliers as any}
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                    required
                  />
                </div>
              </div>
            </fieldset>

            {/* Pricing — always 3 cols, shortened labels fit on small screens */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</legend>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Cost *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Landed</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.landedCost}
                    onChange={(e) => setFormData({ ...formData, landedCost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Selling</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </fieldset>

            {/* Warranty */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warranty</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Supplier Expiry</Label>
                  <Input
                    type="date"
                    value={formData.supplierWarrantyExpiry}
                    onChange={(e) => setFormData({ ...formData, supplierWarrantyExpiry: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Customer Expiry</Label>
                  <Input
                    type="date"
                    value={formData.customerWarrantyExpiry}
                    onChange={(e) => setFormData({ ...formData, customerWarrantyExpiry: e.target.value })}
                  />
                </div>
              </div>
            </fieldset>

            {/* Photos */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Device Photos</legend>
              <div className="flex flex-wrap gap-2">
                {formData.photoUrls.map((url, index) => (
                  <div key={url} className="relative h-20 w-20 shrink-0 rounded-md border overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className={`h-20 w-20 shrink-0 rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${photoUploading ? "cursor-not-allowed opacity-50" : "hover:bg-accent cursor-pointer"}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
                    className="sr-only"
                    disabled={photoUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {photoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground text-center leading-tight">Add Photo</span>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG or WEBP. Gallery or camera.</p>
            </fieldset>

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

          </div>

          {/* Sticky footer — full-width buttons on mobile */}
          <DialogFooter className="shrink-0 flex flex-row gap-2 px-4 sm:px-6 py-4 border-t bg-background">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editDevice ? "Update Device" : "Add Device"}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
