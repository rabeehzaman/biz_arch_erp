"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface BulkUnitConversionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productIds: string[];
    onSuccess?: () => void;
}

export function BulkUnitConversionDialog({
    open,
    onOpenChange,
    productIds,
    onSuccess,
}: BulkUnitConversionDialogProps) {
    const { t } = useLanguage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allUnits, setAllUnits] = useState<Array<{ id: string; name: string; code: string }>>([]);
    const [unitId, setUnitId] = useState("");
    const [conversionFactor, setConversionFactor] = useState("");
    const [barcode, setBarcode] = useState("");
    const [price, setPrice] = useState("");

    useEffect(() => {
        if (open) {
            fetch("/api/units")
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setAllUnits(data.filter((u: { isActive: boolean }) => u.isActive));
                    }
                })
                .catch(() => { /* ignore */ });
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            resetForm();
        }
    }, [open]);

    const resetForm = () => {
        setUnitId("");
        setConversionFactor("");
        setBarcode("");
        setPrice("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!unitId || !conversionFactor || parseFloat(conversionFactor) <= 0) {
            return;
        }

        setIsSubmitting(true);

        try {
            const payload: Record<string, unknown> = {
                unitId,
                conversionFactor: parseFloat(conversionFactor),
                productIds,
            };
            if (barcode.trim()) {
                payload.barcode = barcode.trim();
            }
            if (price.trim() && parseFloat(price) >= 0) {
                payload.price = parseFloat(price);
            }

            const response = await fetch("/api/product-unit-conversions/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to apply unit conversion");
            }

            const result = await response.json();
            const count = result.count ?? productIds.length;

            toast.success(
                t("products.unitConversionApplied") ||
                    `Unit conversion applied to ${count} products`
            );

            resetForm();
            onOpenChange(false);
            onSuccess?.();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to apply unit conversion";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            {t("products.bulkAssignConversion") || "Assign Unit Conversion"}
                        </DialogTitle>
                        <DialogDescription>
                            {t("products.bulkAssignDescription") ||
                                "Add a unit conversion to the selected products."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>{t("common.unit")} *</Label>
                            <Select value={unitId} onValueChange={setUnitId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={t("products.selectUnit") || "Select unit"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {allUnits.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("products.conversionFactor") || "Conversion Factor"} *</Label>
                            <Input
                                type="number"
                                min="0.0001"
                                step="0.001"
                                placeholder="e.g. 12"
                                value={conversionFactor}
                                onChange={(e) => setConversionFactor(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("products.packBarcode") || "Barcode"}</Label>
                            <Input
                                placeholder={t("common.optional") || "Optional"}
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t("products.overridePrice") || "Price"}</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={t("common.optional") || "Optional"}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            className="w-full sm:w-auto"
                            disabled={isSubmitting || !unitId || !conversionFactor}
                        >
                            {isSubmitting
                                ? (t("common.applying") || "Applying...")
                                : `${t("products.applyToN") || "Apply to"} ${productIds.length} ${t("products.title") || "products"}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
