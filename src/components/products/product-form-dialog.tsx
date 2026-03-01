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

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (product: Product) => void;
    productToEdit?: Product;
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
        // Mobile Device fields
        imeisList: "",
        color: "",
        storageCapacity: "",
        ram: "",
        networkStatus: "UNLOCKED",
        conditionGrade: "NEW",
        batteryHealthPercentage: "",
        supplierId: "",
        costPrice: "",
        landedCost: "",
        supplierWarrantyExpiry: "",
        customerWarrantyExpiry: "",
        deviceNotes: "",
    });

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
                imeisList: "", color: "",
                storageCapacity: "", ram: "", networkStatus: "UNLOCKED",
                conditionGrade: "NEW", batteryHealthPercentage: "",
                supplierId: "", costPrice: "", landedCost: "",
                supplierWarrantyExpiry: "", customerWarrantyExpiry: "", deviceNotes: "",
            });
            setFormErrors({});
        } else if (!open) {
            resetForm();
        }
    }, [productToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!formData.name.trim()) errors.name = "Name is required";
        if (!formData.price || parseFloat(formData.price) < 0)
            errors.price = "A valid price is required";
        if (!formData.unitId) errors.unitId = "Unit is required";

        if (formData.isImeiTracked && !productToEdit) {
            const imeiArray = formData.imeisList.split(/[\n,]+/).map(i => i.trim()).filter(Boolean);
            if (imeiArray.length === 0) errors.imeisList = "At least one IMEI is required";
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
                imeisList: formData.imeisList.split(/[\n,]+/).map(i => i.trim()).filter(Boolean),
                color: formData.color,
                storageCapacity: formData.storageCapacity,
                ram: formData.ram,
                networkStatus: formData.networkStatus,
                conditionGrade: formData.conditionGrade,
                batteryHealthPercentage: formData.batteryHealthPercentage ? parseInt(formData.batteryHealthPercentage) : null,
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

            if (!response.ok) throw new Error("Failed to save product");

            const rawData = await response.json();
            const newProduct = productToEdit ? rawData : (rawData.product || rawData);

            toast.success(productToEdit ? "Product updated successfully" : "Product added successfully");

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newProduct);
            }
        } catch (error) {
            toast.error("Failed to save product");
            console.error("Failed to save product:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormErrors({});
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
            imeisList: "", color: "",
            storageCapacity: "", ram: "", networkStatus: "UNLOCKED",
            conditionGrade: "NEW", batteryHealthPercentage: "",
            supplierId: "", costPrice: "", landedCost: "",
            supplierWarrantyExpiry: "", customerWarrantyExpiry: "", deviceNotes: "",
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                if (!isOpen) resetForm();
            }}
        >
            <DialogContent className="sm:max-w-md md:max-w-xl overflow-y-auto max-h-[90vh]">
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
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                            <div className="rounded-md border p-4 space-y-4 bg-muted/20 mt-4">
                                <h4 className="text-sm font-medium border-b pb-2">Mobile Device Details (Initial Stock)</h4>
                                <div className="grid gap-2">
                                    <Label>IMEI(s) *</Label>
                                    <Textarea
                                        value={formData.imeisList}
                                        onChange={(e) => setFormData({ ...formData, imeisList: e.target.value })}
                                        placeholder="Enter IMEIs (one per line or comma-separated)"
                                        className={`font-mono bg-background min-h-[100px] ${formErrors.imeisList ? "border-red-500" : ""}`}
                                        required={formData.isImeiTracked}
                                    />
                                    {formErrors.imeisList && <p className="text-sm text-red-500">{formErrors.imeisList}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        Note: Brand and Model will be automatically extracted from the Product Name.
                                        Adding multiple IMEIs will create multiple device records in stock.
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="grid gap-2">
                                        <Label>Color</Label>
                                        <Input
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="bg-background"
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Storage</Label>
                                        <Input
                                            value={formData.storageCapacity}
                                            onChange={(e) => setFormData({ ...formData, storageCapacity: e.target.value })}
                                            className="bg-background"
                                            placeholder="e.g. 128GB"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>RAM</Label>
                                        <Input
                                            value={formData.ram}
                                            onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                                            className="bg-background"
                                            placeholder="e.g. 8GB"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="grid gap-2">
                                        <Label>Condition</Label>
                                        <select
                                            value={formData.conditionGrade}
                                            onChange={(e) => setFormData({ ...formData, conditionGrade: e.target.value })}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm bg-background"
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
                                        <Label>Network Status</Label>
                                        <select
                                            value={formData.networkStatus}
                                            onChange={(e) => setFormData({ ...formData, networkStatus: e.target.value })}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm bg-background"
                                        >
                                            <option value="UNLOCKED">Unlocked</option>
                                            <option value="LOCKED">Locked</option>
                                        </select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Battery Health %</Label>
                                        <Input
                                            type="number" min="0" max="100"
                                            value={formData.batteryHealthPercentage}
                                            onChange={(e) => setFormData({ ...formData, batteryHealthPercentage: e.target.value })}
                                            className="bg-background"
                                            placeholder="Optional"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                        <Label>Supplier *</Label>
                                        <select
                                            value={formData.supplierId}
                                            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                                            className={`flex h-9 w-full rounded-md border border-input text-sm bg-background px-3 py-1 ${formErrors.supplierId ? "border-red-500" : ""}`}
                                            required={formData.isImeiTracked}
                                        >
                                            <option value="">-- Select Supplier --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        {formErrors.supplierId && <p className="text-sm text-red-500">{formErrors.supplierId}</p>}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Cost Price *</Label>
                                        <Input
                                            type="number" step="0.01"
                                            value={formData.costPrice}
                                            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                                            className={`bg-background ${formErrors.costPrice ? "border-red-500" : ""}`}
                                            placeholder="0.00"
                                            required={formData.isImeiTracked}
                                        />
                                        {formErrors.costPrice && <p className="text-sm text-red-500">{formErrors.costPrice}</p>}
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
