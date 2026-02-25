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
    });

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
                                    setFormData({ ...formData, isService: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label htmlFor="prod-isService">Service product (no inventory tracking)</Label>
                        </div>
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
