"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UnitSelect } from "@/components/units/unit-select";
import { Trash2, PlusCircle } from "lucide-react";

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    unitId: string | null;
    unit: {
        id: string;
        code: string;
        name: string;
    } | null;
    sku: string | null;
    barcode: string | null;
    hsnCode: string | null;
    gstRate: number | null;
    isService: boolean;
    isImeiTracked: boolean;
    isActive: boolean;
    createdAt: string;
}

interface DeviceRow {
    imei: string;
    color: string;
    storageCapacity: string;
    ram: string;
    conditionGrade: string;
    networkStatus: string;
    batteryHealthPercentage: string;
}

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (product: Product) => void;
    productToEdit?: Product;
}

function makeEmptyDevice(): DeviceRow {
    return {
        imei: "",
        color: "",
        storageCapacity: "",
        ram: "",
        conditionGrade: "NEW",
        networkStatus: "UNLOCKED",
        batteryHealthPercentage: "",
    };
}

export function ProductFormDialog({
    open,
    onOpenChange,
    onSuccess,
    productToEdit
}: ProductFormDialogProps) {
    const { data: session } = useSession();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        unitId: "",
        sku: "",
        barcode: "",
        hsnCode: "",
        gstRate: "0",
        isService: false,
        isImeiTracked: false,
        // Shared device fields
        supplierId: "",
        costPrice: "",
        landedCost: "",
        supplierWarrantyExpiry: "",
        customerWarrantyExpiry: "",
        deviceNotes: "",
    });

    const [devices, setDevices] = useState<DeviceRow[]>([makeEmptyDevice()]);
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        if (open) {
            fetch("/api/suppliers")
                .then((r) => r.json())
                .then(setSuppliers)
                .catch(console.error);
        }
    }, [open]);

    useEffect(() => {
        if (productToEdit && open) {
            setFormData({
                name: productToEdit.name,
                description: productToEdit.description || "",
                price: productToEdit.price.toString(),
                unitId: productToEdit.unitId || productToEdit.unit?.id || "",
                sku: productToEdit.sku || "",
                barcode: productToEdit.barcode || "",
                hsnCode: productToEdit.hsnCode || "",
                gstRate: productToEdit.gstRate?.toString() || "0",
                isService: productToEdit.isService || false,
                isImeiTracked: productToEdit.isImeiTracked || false,
                supplierId: "",
                costPrice: "",
                landedCost: "",
                supplierWarrantyExpiry: "",
                customerWarrantyExpiry: "",
                deviceNotes: "",
            });
            setDevices([makeEmptyDevice()]);
            setFormErrors({});
        } else if (!open) {
            resetForm();
        }
    }, [productToEdit, open]);

    const updateDevice = (idx: number, field: keyof DeviceRow, value: string) => {
        setDevices(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
        if (field === "imei") setFormErrors(prev => ({ ...prev, devices: "" }));
    };

    const addDevice = () => setDevices(prev => [...prev, makeEmptyDevice()]);

    const removeDevice = (idx: number) => {
        setDevices(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!formData.name.trim()) errors.name = "Name is required";
        if (!formData.price || parseFloat(formData.price) < 0)
            errors.price = "A valid price is required";
        if (!formData.unitId) errors.unitId = "Unit is required";

        if (formData.isImeiTracked && !productToEdit) {
            if (devices.length === 0) errors.devices = "At least one device is required";
            else if (devices.some(d => !d.imei.trim())) errors.devices = "IMEI is required for all devices";
            if (!formData.supplierId) errors.supplierId = "Supplier is required";
            if (!formData.costPrice || parseFloat(formData.costPrice) < 0) errors.costPrice = "Cost Price is required";
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setIsSubmitting(true);

        const payload = {
            name: formData.name,
            description: formData.description || null,
            price: parseFloat(formData.price),
            unitId: formData.unitId,
            sku: formData.sku || null,
            barcode: formData.barcode || null,
            hsnCode: formData.hsnCode || null,
            gstRate: parseFloat(formData.gstRate) || 0,
            isService: formData.isService,
            isImeiTracked: formData.isImeiTracked,
            deviceDetails: (formData.isImeiTracked && !productToEdit) ? {
                devices: devices.map(d => ({
                    imei: d.imei.trim(),
                    color: d.color,
                    storageCapacity: d.storageCapacity,
                    ram: d.ram,
                    conditionGrade: d.conditionGrade,
                    networkStatus: d.networkStatus,
                    batteryHealthPercentage: d.batteryHealthPercentage ? parseInt(d.batteryHealthPercentage) : null,
                })),
                supplierId: formData.supplierId,
                costPrice: parseFloat(formData.costPrice) || 0,
                landedCost: parseFloat(formData.landedCost) || 0,
                sellingPrice: parseFloat(formData.price) || 0,
                supplierWarrantyExpiry: formData.supplierWarrantyExpiry || null,
                customerWarrantyExpiry: formData.customerWarrantyExpiry || null,
                notes: formData.deviceNotes || null,
            } : undefined,
        };

        try {
            const response = productToEdit
                ? await fetch(`/api/products/${productToEdit.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                : await fetch("/api/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to save product");
            }

            const rawData = await response.json();
            const newProduct = productToEdit ? rawData : (rawData.product || rawData);

            toast.success(productToEdit ? "Product updated successfully" : "Product added successfully");

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newProduct);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to save product");
            console.error("Failed to save product:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormErrors({});
        setDevices([makeEmptyDevice()]);
        setFormData({
            name: "",
            description: "",
            price: "",
            unitId: "",
            sku: "",
            barcode: "",
            hsnCode: "",
            gstRate: "0",
            isService: false,
            isImeiTracked: false,
            supplierId: "",
            costPrice: "",
            landedCost: "",
            supplierWarrantyExpiry: "",
            customerWarrantyExpiry: "",
            deviceNotes: "",
        });
    };

    const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                if (!isOpen) resetForm();
            }}
        >
            <DialogContent className="sm:max-w-lg md:max-w-2xl overflow-y-auto max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {productToEdit ? "Edit Product" : "Add New Product"}
                        </DialogTitle>
                        <DialogDescription>
                            {productToEdit
                                ? "Update the product details below."
                                : "Fill in the details to add a new product."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="prod-name">Name *</Label>
                            <Input
                                id="prod-name"
                                value={formData.name}
                                onChange={(e) => {
                                    setFormData({ ...formData, name: e.target.value });
                                    if (e.target.value) setFormErrors((prev) => ({ ...prev, name: "" }));
                                }}
                                className={formErrors.name ? "border-red-500" : ""}
                            />
                            {formErrors.name && (
                                <p className="text-sm text-red-500">{formErrors.name}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="prod-description">Description</Label>
                            <Textarea
                                id="prod-description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="prod-price">Price *</Label>
                                <Input
                                    id="prod-price"
                                    type="number"
                                    step="0.01"
                                    value={formData.price}
                                    onChange={(e) => {
                                        setFormData({ ...formData, price: e.target.value });
                                        if (e.target.value) setFormErrors((prev) => ({ ...prev, price: "" }));
                                    }}
                                    className={formErrors.price ? "border-red-500" : ""}
                                />
                                {formErrors.price && (
                                    <p className="text-sm text-red-500">{formErrors.price}</p>
                                )}
                            </div>
                            <div>
                                <UnitSelect
                                    value={formData.unitId}
                                    onValueChange={(value) => {
                                        setFormData({ ...formData, unitId: value });
                                        if (value) setFormErrors((prev) => ({ ...prev, unitId: "" }));
                                    }}
                                    required
                                    error={formErrors.unitId}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="prod-sku">SKU</Label>
                                <Input
                                    id="prod-sku"
                                    value={formData.sku}
                                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                    placeholder="Optional product code"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="prod-barcode">Barcode</Label>
                                <Input
                                    id="prod-barcode"
                                    value={formData.barcode}
                                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                    placeholder="Scan barcode"
                                />
                            </div>
                        </div>
                        {session?.user?.gstEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="prod-hsnCode">HSN Code</Label>
                                    <Input
                                        id="prod-hsnCode"
                                        value={formData.hsnCode}
                                        onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                                        placeholder="e.g. 8471"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="prod-gstRate">GST Rate</Label>
                                    <select
                                        id="prod-gstRate"
                                        value={formData.gstRate}
                                        onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                                        className={selectClass}
                                    >
                                        {[0, 5, 12, 18, 28].map((rate) => (
                                            <option key={rate} value={rate}>{rate}%</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="prod-isService"
                                checked={formData.isService}
                                onChange={(e) =>
                                    setFormData({ ...formData, isService: e.target.checked, ...(e.target.checked && { isImeiTracked: false }) })
                                }
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label htmlFor="prod-isService">Service product (no inventory tracking)</Label>
                        </div>

                        {session?.user?.isMobileShopModuleEnabled && !formData.isService && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="prod-isImeiTracked"
                                    checked={formData.isImeiTracked}
                                    onChange={(e) =>
                                        setFormData({ ...formData, isImeiTracked: e.target.checked })
                                    }
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <Label htmlFor="prod-isImeiTracked">Track by IMEI (individual device tracking)</Label>
                            </div>
                        )}

                        {formData.isImeiTracked && !productToEdit && (
                            <div className="rounded-md border p-4 space-y-4 bg-muted/20 mt-2">
                                <h4 className="text-sm font-semibold border-b pb-2">Mobile Device Details (Initial Stock)</h4>

                                {/* Per-device rows */}
                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                    {devices.map((device, idx) => (
                                        <div key={idx} className="rounded-md border bg-background p-3 space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-muted-foreground">Device #{idx + 1}</span>
                                                {devices.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                                        onClick={() => removeDevice(idx)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                <div className="col-span-2 sm:col-span-3 grid gap-1">
                                                    <Label className="text-xs">IMEI *</Label>
                                                    <Input
                                                        value={device.imei}
                                                        onChange={(e) => updateDevice(idx, "imei", e.target.value)}
                                                        placeholder="15-digit IMEI"
                                                        maxLength={20}
                                                        className={`font-mono text-sm ${formErrors.devices ? "border-red-500" : ""}`}
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Color</Label>
                                                    <Input
                                                        value={device.color}
                                                        onChange={(e) => updateDevice(idx, "color", e.target.value)}
                                                        placeholder="e.g. Black"
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Storage</Label>
                                                    <Input
                                                        value={device.storageCapacity}
                                                        onChange={(e) => updateDevice(idx, "storageCapacity", e.target.value)}
                                                        placeholder="e.g. 128GB"
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">RAM</Label>
                                                    <Input
                                                        value={device.ram}
                                                        onChange={(e) => updateDevice(idx, "ram", e.target.value)}
                                                        placeholder="e.g. 8GB"
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Condition</Label>
                                                    <select
                                                        value={device.conditionGrade}
                                                        onChange={(e) => updateDevice(idx, "conditionGrade", e.target.value)}
                                                        className={`${selectClass} text-sm h-8`}
                                                    >
                                                        <option value="NEW">New</option>
                                                        <option value="OPEN_BOX">Open Box</option>
                                                        <option value="GRADE_A">Grade A</option>
                                                        <option value="GRADE_B">Grade B</option>
                                                        <option value="GRADE_C">Grade C</option>
                                                        <option value="REFURBISHED">Refurbished</option>
                                                    </select>
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Network</Label>
                                                    <select
                                                        value={device.networkStatus}
                                                        onChange={(e) => updateDevice(idx, "networkStatus", e.target.value)}
                                                        className={`${selectClass} text-sm h-8`}
                                                    >
                                                        <option value="UNLOCKED">Unlocked</option>
                                                        <option value="LOCKED">Locked</option>
                                                    </select>
                                                </div>
                                                <div className="grid gap-1">
                                                    <Label className="text-xs">Battery %</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={device.batteryHealthPercentage}
                                                        onChange={(e) => updateDevice(idx, "batteryHealthPercentage", e.target.value)}
                                                        placeholder="Optional"
                                                        className="text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {formErrors.devices && (
                                    <p className="text-sm text-red-500">{formErrors.devices}</p>
                                )}

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={addDevice}
                                >
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Add Another Device
                                </Button>

                                <p className="text-xs text-muted-foreground">
                                    Brand and Model are automatically extracted from the Product Name. Each device gets its own specs.
                                </p>

                                {/* Shared purchase fields */}
                                <div className="border-t pt-3 space-y-3">
                                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase Details (shared)</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-2">
                                            <Label>Supplier *</Label>
                                            <select
                                                value={formData.supplierId}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, supplierId: e.target.value });
                                                    if (e.target.value) setFormErrors(prev => ({ ...prev, supplierId: "" }));
                                                }}
                                                className={`${selectClass} ${formErrors.supplierId ? "border-red-500" : ""}`}
                                            >
                                                <option value="">-- Select Supplier --</option>
                                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                            {formErrors.supplierId && <p className="text-sm text-red-500">{formErrors.supplierId}</p>}
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Cost Price (per device) *</Label>
                                            <Input
                                                type="number" step="0.01"
                                                value={formData.costPrice}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, costPrice: e.target.value });
                                                    if (e.target.value) setFormErrors(prev => ({ ...prev, costPrice: "" }));
                                                }}
                                                className={formErrors.costPrice ? "border-red-500" : ""}
                                                placeholder="0.00"
                                            />
                                            {formErrors.costPrice && <p className="text-sm text-red-500">{formErrors.costPrice}</p>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-2">
                                            <Label>Landed Cost</Label>
                                            <Input
                                                type="number" step="0.01"
                                                value={formData.landedCost}
                                                onChange={(e) => setFormData({ ...formData, landedCost: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Notes</Label>
                                            <Input
                                                value={formData.deviceNotes}
                                                onChange={(e) => setFormData({ ...formData, deviceNotes: e.target.value })}
                                                placeholder="Optional"
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
                                </div>
                            </div>
                        )}

                    </div>
                    <DialogFooter className="mt-auto pt-4 border-t">
                        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                            {isSubmitting
                                ? (productToEdit ? "Updating..." : "Adding...")
                                : (productToEdit ? "Update Product" : "Add Product")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
