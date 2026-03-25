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
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n";
import { useFormConfig } from "@/hooks/use-form-config";

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
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { isFieldHidden, getDefault } = useFormConfig("mobileDevice", { isEdit: !!editDevice });
  const multiBranchEnabled = session?.user?.multiBranchEnabled;

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
    mrp: "",
    landedCost: "",
    sellingPrice: "",
    supplierWarrantyExpiry: "",
    customerWarrantyExpiry: "",
    notes: "",
    photoUrls: [] as string[],
    branchId: "",
    warehouseId: "",
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
          mrp: editDevice.mrp !== undefined ? String(editDevice.mrp) : "",
          landedCost: editDevice.landedCost !== undefined ? String(editDevice.landedCost) : "", sellingPrice: editDevice.sellingPrice !== undefined ? String(editDevice.sellingPrice) : "",
          supplierWarrantyExpiry: editDevice.supplierWarrantyExpiry ? new Date(editDevice.supplierWarrantyExpiry).toISOString().split('T')[0] : "",
          customerWarrantyExpiry: editDevice.customerWarrantyExpiry ? new Date(editDevice.customerWarrantyExpiry).toISOString().split('T')[0] : "", notes: editDevice.notes || "",
          photoUrls: Array.isArray(editDevice.photoUrls) ? editDevice.photoUrls : [],
          branchId: editDevice.branchId || "",
          warehouseId: editDevice.warehouseId || "", // We assume editDevice can have warehouseId if passed
        });
      } else {
        resetForm();
      }
      fetch("/api/suppliers?compact=true").then((r) => r.json()).then(setSuppliers).catch(() => { });
      fetch("/api/products?excludeServices=true&compact=true").then((r) => r.json()).then((data) => setProducts(data.filter((p: Product) => p.isImeiTracked))).catch(() => { });
    }
  }, [open, editDevice]);

  const resetForm = () => {
    setFormData({
      imei1: "", imei2: "", serialNumber: "",
      color: "", storageCapacity: "", ram: "", networkStatus: "UNLOCKED",
      conditionGrade: "NEW", batteryHealthPercentage: "", productId: "",
      supplierId: "", costPrice: "", mrp: "", landedCost: "", sellingPrice: "",
      supplierWarrantyExpiry: "", customerWarrantyExpiry: "", notes: "", photoUrls: [],
      branchId: "", warehouseId: "",
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("devices.photoTooLarge"));
      return;
    }
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!.trim());
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!.trim()}/image/upload`,
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Upload failed");
      }
      setFormData((prev) => ({ ...prev, photoUrls: [...prev.photoUrls, data.secure_url] }));
      toast.success(t("devices.photoUploaded"));
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
    e.stopPropagation();
    if (!formData.imei1 || !formData.supplierId || !formData.costPrice) {
      toast.error(t("devices.requiredFieldsError"));
      return;
    }
    if (!editDevice && !formData.productId) {
      toast.error(t("devices.productRequired"));
      return;
    }
    if (multiBranchEnabled && !formData.warehouseId && !editDevice) {
      toast.error(t("devices.warehouseRequired"));
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
          mrp: parseFloat(formData.mrp) || 0,
          landedCost: parseFloat(formData.landedCost) || 0,
          sellingPrice: parseFloat(formData.sellingPrice) || 0,
          batteryHealthPercentage: formData.batteryHealthPercentage ? parseInt(formData.batteryHealthPercentage) : null,
          productId: formData.productId || null,
          supplierWarrantyExpiry: formData.supplierWarrantyExpiry || null,
          customerWarrantyExpiry: formData.customerWarrantyExpiry || null,
          warehouseId: formData.warehouseId || null,
        }),
      });

      if (res.ok) {
        toast.success(editDevice ? t("devices.updatedSuccess") : t("devices.addedSuccess"));
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data.error || t("devices.saveFailed"));
      }
    } catch {
      toast.error(t("devices.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
      {/* "contents" on form removes it from flex layout so DialogHeader/Footer
          become direct children of the inner scrollable wrapper in DialogContent,
          enabling the built-in sticky top-0 / sticky bottom-0 on those components. */}
      <DialogContent className="sm:max-w-lg md:max-w-2xl">
        <form className="contents" onSubmit={handleSubmit}>

          <DialogHeader>
            <DialogTitle>{editDevice ? t("devices.editDevice") : t("devices.addDevice")}</DialogTitle>
            <DialogDescription>
              {editDevice ? t("devices.editDesc") : t("devices.addDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {multiBranchEnabled && !editDevice && (
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.location")}</legend>
                <BranchWarehouseSelector
                  branchId={formData.branchId}
                  warehouseId={formData.warehouseId}
                  onBranchChange={(branchId) => setFormData({ ...formData, branchId, warehouseId: "" })}
                  onWarehouseChange={(warehouseId) => setFormData({ ...formData, warehouseId })}
                />
              </fieldset>
            )}

            {/* Identifiers */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.identifiers")}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("devices.imei1Required")}</Label>
                  <div className="flex gap-1">
                    <Input
                      value={formData.imei1}
                      onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
                      placeholder={t("devices.imeiPlaceholder")}
                      maxLength={15}
                      inputMode="numeric"
                      className="font-mono"
                      required
                    />
                    <ImeiCameraScanner onScan={(imei) => setFormData((prev) => ({ ...prev, imei1: imei }))} />
                  </div>
                </div>
                {!isFieldHidden("imei2") && (
                <div className="grid gap-1.5">
                  <Label>{t("devices.imei2")}</Label>
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
                )}
              </div>
              {!isFieldHidden("serialNumber") && (
              <div className="grid gap-1.5">
                <Label>{t("devices.serialNumber")}</Label>
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              )}
            </fieldset>

            {/* Specifications — 2 cols on mobile, 3 on sm+ */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.specifications")}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {!isFieldHidden("color") && (
                <div className="grid gap-1.5">
                  <Label>{t("devices.color")}</Label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder={t("devices.colorPlaceholder")}
                  />
                </div>
                )}
                {!isFieldHidden("storageCapacity") && (
                <div className="grid gap-1.5">
                  <Label>{t("devices.storage")}</Label>
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
                )}
                {!isFieldHidden("ram") && (
                <div className="grid gap-1.5">
                  <Label>{t("devices.ram")}</Label>
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
                )}
                <div className="grid gap-1.5">
                  <Label>{t("devices.network")}</Label>
                  <Select value={formData.networkStatus} onValueChange={(value) => setFormData({ ...formData, networkStatus: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNLOCKED">{t("devices.unlocked")}</SelectItem>
                      <SelectItem value="LOCKED">{t("devices.locked")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("devices.condition")}</Label>
                  <Select value={formData.conditionGrade} onValueChange={(value) => setFormData({ ...formData, conditionGrade: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">{t("devices.conditionNew")}</SelectItem>
                      <SelectItem value="OPEN_BOX">{t("devices.conditionOpenBox")}</SelectItem>
                      <SelectItem value="GRADE_A">{t("devices.conditionGradeA")}</SelectItem>
                      <SelectItem value="GRADE_B">{t("devices.conditionGradeB")}</SelectItem>
                      <SelectItem value="GRADE_C">{t("devices.conditionGradeC")}</SelectItem>
                      <SelectItem value="REFURBISHED">{t("devices.conditionRefurbished")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("devices.batteryHealth")}</Label>
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
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.productSupplier")}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("common.product")} {!editDevice && "*"}</Label>
                  <Combobox
                    items={products}
                    value={formData.productId}
                    onValueChange={(value) => setFormData({ ...formData, productId: value })}
                    getId={(p) => p.id}
                    getLabel={(p) => p.name}
                    filterFn={(p, query) => p.name.toLowerCase().includes(query)}
                    placeholder={t("products.searchPlaceholder")}
                    emptyText={products.length === 0 ? t("devices.noImeiProducts") : t("products.noProductsFound")}
                  />
                  {products.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t("devices.noImeiProductsHint")}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("devices.supplierRequired")}</Label>
                  <SupplierCombobox
                    suppliers={suppliers as any}
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                    onSupplierCreated={(supplier) => setSuppliers((prev) => [...prev, supplier as any])}
                    required
                  />
                </div>
              </div>
            </fieldset>

            {/* Pricing — always 3 cols, shortened labels fit on small screens */}
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.pricing")}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("devices.costRequired")}</Label>
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
                  <Label>{t("devices.mrp")}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("devices.landed")}</Label>
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
                  <Label>{t("devices.selling")}</Label>
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
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.warranty")}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("devices.supplierExpiry")}</Label>
                  <Input
                    type="date"
                    value={formData.supplierWarrantyExpiry}
                    onChange={(e) => setFormData({ ...formData, supplierWarrantyExpiry: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("devices.customerExpiry")}</Label>
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
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("devices.devicePhotos")}</legend>
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
                {/* Overlay input directly over the visual button — no sr-only, no
                    programmatic .click(). iOS Safari requires the <input> to be
                    physically tappable (not clipped/hidden) to open the file picker. */}
                <div className={`relative h-20 w-20 shrink-0 rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${photoUploading ? "cursor-not-allowed opacity-50" : "hover:bg-accent"}`}>
                  {!photoUploading && (
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                        e.target.value = "";
                      }}
                    />
                  )}
                  {photoUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-5 w-5 text-muted-foreground pointer-events-none" />
                      <span className="text-xs text-muted-foreground text-center leading-tight pointer-events-none">{t("devices.addPhoto")}</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("devices.photoFormats")}</p>
            </fieldset>

            {/* Notes */}
            {!isFieldHidden("notes") && (
            <div className="grid gap-1.5">
              <Label>{t("common.notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t("common.notesPlaceholder")}
                rows={3}
              />
            </div>
            )}

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editDevice ? t("devices.updateDevice") : t("devices.addDevice")}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
