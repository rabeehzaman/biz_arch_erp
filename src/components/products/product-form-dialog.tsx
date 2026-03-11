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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UnitSelect } from "@/components/units/unit-select";
import { CategorySelect } from "@/components/products/category-select";
import { Plus, Trash2, Package } from "lucide-react";


interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    cost: number;
    categoryId: string | null;
    category: { id: string; name: string } | null;
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
    isBundle?: boolean;
    weighMachineCode: string | null;
    isActive: boolean;
    createdAt: string;
    bundleItems?: Array<{
        id: string;
        componentProductId: string;
        quantity: number;
        componentProduct: {
            id: string;
            name: string;
            price: number;
            cost: number;
            unitId?: string;
            unit?: { id: string; code: string; name: string } | null;
        };
    }>;
}

interface BundleItemEntry {
    componentProductId: string;
    componentName: string;
    quantity: string;
    unitName: string;
}

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (product: Product) => void;
    productToEdit?: Product;
    initialBarcode?: string;
}


export function ProductFormDialog({
    open,
    onOpenChange,
    onSuccess,
    productToEdit,
    initialBarcode
}: ProductFormDialogProps) {
    const { data: session } = useSession();
    const sessionUser = session?.user as ({ gstEnabled?: boolean } & { saudiEInvoiceEnabled?: boolean } & { isMobileShopModuleEnabled?: boolean } & { isWeighMachineEnabled?: boolean } & { weighMachineProductCodeLen?: number }) | undefined;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [allProducts, setAllProducts] = useState<Array<{ id: string; name: string; unit?: { code: string; name: string } | null }>>([]);
    const [bundleItems, setBundleItems] = useState<BundleItemEntry[]>([]);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        cost: "",
        unitId: "",
        categoryId: "",
        sku: "",
        barcode: "",
        hsnCode: "",
        gstRate: "0",
        isService: false,
        isImeiTracked: false,
        isBundle: false,
        weighMachineCode: "",
    });

    // Fetch all products for bundle component selection
    useEffect(() => {
        if (formData.isBundle && open) {
            fetch("/api/products?compact=true")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setAllProducts(data.filter((p: Product) => p.id !== productToEdit?.id && !p.isBundle));
                    }
                })
                .catch(() => { /* ignore */ });
        }
    }, [formData.isBundle, open, productToEdit?.id]);

    useEffect(() => {
        if (productToEdit && open) {
            setFormData({
                name: productToEdit.name,
                description: productToEdit.description || "",
                price: productToEdit.price.toString(),
                cost: productToEdit.cost.toString(),
                unitId: productToEdit.unitId || productToEdit.unit?.id || "",
                categoryId: productToEdit.categoryId || productToEdit.category?.id || "",
                sku: productToEdit.sku || "",
                barcode: productToEdit.barcode || "",
                hsnCode: productToEdit.hsnCode || "",
                gstRate: productToEdit.gstRate?.toString() || "0",
                isService: productToEdit.isService || false,
                isImeiTracked: productToEdit.isImeiTracked || false,
                isBundle: productToEdit.isBundle || false,
                weighMachineCode: productToEdit.weighMachineCode || "",
            });

            // Load existing bundle items
            if (productToEdit.bundleItems && productToEdit.bundleItems.length > 0) {
                setBundleItems(productToEdit.bundleItems.map(bi => ({
                    componentProductId: bi.componentProductId,
                    componentName: bi.componentProduct.name,
                    quantity: bi.quantity.toString(),
                    unitName: bi.componentProduct.unit?.name || "",
                })));
            } else {
                setBundleItems([]);
            }

            setFormErrors({});
        } else if (!productToEdit && open) {
            resetForm();
            if (initialBarcode) {
                setFormData(prev => ({ ...prev, barcode: initialBarcode }));
            }
        } else if (!open) {
            resetForm();
        }
    }, [productToEdit, open, initialBarcode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const errors: Record<string, string> = {};
        if (!formData.name.trim()) errors.name = "Name is required";
        if (!formData.price || parseFloat(formData.price) < 0)
            errors.price = "A valid price is required";
        if (formData.cost && parseFloat(formData.cost) < 0)
            errors.cost = "Cost cannot be negative";
        if (!formData.unitId) errors.unitId = "Unit is required";

        // Validate bundle items
        if (formData.isBundle) {
            if (bundleItems.length === 0) {
                errors.bundle = "At least one component is required for a bundle";
            }
            for (const bi of bundleItems) {
                if (!bi.componentProductId) {
                    errors.bundle = "All components must have a product selected";
                    break;
                }
                if (!bi.quantity || parseFloat(bi.quantity) <= 0) {
                    errors.bundle = "All components must have a valid quantity";
                    break;
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setIsSubmitting(true);

        const payload: Record<string, unknown> = {
            name: formData.name,
            description: formData.description || null,
            price: parseFloat(formData.price),
            cost: parseFloat(formData.cost || "0"),
            unitId: formData.unitId,
            categoryId: formData.categoryId && formData.categoryId !== "none" ? formData.categoryId : null,
            sku: formData.sku || null,
            barcode: formData.barcode || null,
            hsnCode: formData.hsnCode || null,
            gstRate: parseFloat(formData.gstRate) || 0,
            isService: formData.isService,
            isImeiTracked: formData.isImeiTracked,
            isBundle: formData.isBundle,
            weighMachineCode: formData.weighMachineCode || null,
        };

        if (formData.isBundle) {
            payload.bundleItems = bundleItems.map(bi => ({
                componentProductId: bi.componentProductId,
                quantity: parseFloat(bi.quantity),
            }));
        }

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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to save product";
            toast.error(message);
            console.error("Failed to save product:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormErrors({});
        setBundleItems([]);
        setFormData({
            name: "",
            description: "",
            price: "",
            cost: "",
            unitId: "",
            categoryId: "",
            sku: "",
            barcode: "",
            hsnCode: "",
            gstRate: "0",
            isService: false,
            isImeiTracked: false,
            isBundle: false,
            weighMachineCode: "",
        });
    };

    const addBundleItem = () => {
        setBundleItems([...bundleItems, { componentProductId: "", componentName: "", quantity: "1", unitName: "" }]);
    };

    const removeBundleItem = (index: number) => {
        setBundleItems(bundleItems.filter((_, i) => i !== index));
    };

    const updateBundleItem = (index: number, field: keyof BundleItemEntry, value: string) => {
        const updated = [...bundleItems];
        updated[index] = { ...updated[index], [field]: value };

        // When selecting a product, also store the name and unit
        if (field === "componentProductId") {
            const selectedProduct = allProducts.find(p => p.id === value);
            if (selectedProduct) {
                updated[index].componentName = selectedProduct.name;
                updated[index].unitName = selectedProduct.unit?.name || "";
            }
        }

        setBundleItems(updated);
    };

    // Filter out already-selected components
    const getAvailableProducts = (currentIndex: number) => {
        const selectedIds = bundleItems
            .map((bi, i) => i !== currentIndex ? bi.componentProductId : null)
            .filter(Boolean);
        return allProducts.filter(p => !selectedIds.includes(p.id));
    };


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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <div className="grid gap-2">
                                <Label htmlFor="prod-cost">Cost</Label>
                                <Input
                                    id="prod-cost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.cost}
                                    onChange={(e) => {
                                        setFormData({ ...formData, cost: e.target.value });
                                        setFormErrors((prev) => ({ ...prev, cost: "" }));
                                    }}
                                    className={formErrors.cost ? "border-red-500" : ""}
                                    placeholder="0.00"
                                />
                                {formErrors.cost ? (
                                    <p className="text-sm text-red-500">{formErrors.cost}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Used as the default purchase/fallback cost when no stock lot cost is available.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <div>
                                <CategorySelect
                                    value={formData.categoryId}
                                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="prod-sku">SKU</Label>
                                <Input
                                    id="prod-sku"
                                    value={formData.sku}
                                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                    placeholder="Optional product code"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        {sessionUser?.gstEnabled && !sessionUser.saudiEInvoiceEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                    <Select
                                        value={formData.gstRate}
                                        onValueChange={(value) => setFormData({ ...formData, gstRate: value })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[0, 5, 12, 18, 28].map((rate) => (
                                                <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="prod-isService"
                                checked={formData.isService}
                                onChange={(e) =>
                                    setFormData({ ...formData, isService: e.target.checked, ...(e.target.checked && { isImeiTracked: false, isBundle: false }) })
                                }
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label htmlFor="prod-isService">Service product (no inventory tracking)</Label>
                        </div>

                        {!formData.isService && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="prod-isBundle"
                                    checked={formData.isBundle}
                                    onChange={(e) =>
                                        setFormData({ ...formData, isBundle: e.target.checked })
                                    }
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="prod-isBundle">Bundle / Kit (stock deducted from components)</Label>
                            </div>
                        )}

                        {formData.isBundle && !formData.isService && (
                            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Bundle Components
                                    </Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addBundleItem}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Component
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Define what raw products make up 1 unit of this bundle. When sold, stock is deducted from these components.
                                </p>
                                {bundleItems.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
                                        No components added yet. Click &quot;Add Component&quot; to start.
                                    </p>
                                )}
                                {bundleItems.map((bi, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <Select
                                                value={bi.componentProductId}
                                                onValueChange={(value) => updateBundleItem(index, "componentProductId", value)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select product..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {getAvailableProducts(index).map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.name} {p.unit ? `(${p.unit.name})` : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-28">
                                            <Input
                                                type="number"
                                                min="0.0001"
                                                step="0.01"
                                                placeholder="Qty"
                                                value={bi.quantity}
                                                onChange={(e) => updateBundleItem(index, "quantity", e.target.value)}
                                            />
                                        </div>
                                        {bi.unitName && (
                                            <span className="text-xs text-muted-foreground w-10">{bi.unitName}</span>
                                        )}
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeBundleItem(index)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                ))}
                                {formErrors.bundle && (
                                    <p className="text-sm text-red-500">{formErrors.bundle}</p>
                                )}
                            </div>
                        )}

                        {sessionUser?.isMobileShopModuleEnabled && !formData.isService && !formData.isBundle && (
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

                        {sessionUser?.isWeighMachineEnabled && !formData.isService && (
                            <div className="grid gap-2">
                                <Label htmlFor="prod-weighMachineCode">Weigh Machine Code</Label>
                                <Input
                                    id="prod-weighMachineCode"
                                    value={formData.weighMachineCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, weighMachineCode: e.target.value.replace(/\D/g, "") })
                                    }
                                    placeholder="e.g. 12345"
                                    maxLength={sessionUser?.weighMachineProductCodeLen ?? 5}
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Numeric code embedded in the weigh machine barcode label
                                </p>
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
