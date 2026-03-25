"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface ProductCategory {
    id: string;
    name: string;
    slug: string;
    color: string | null;
}

interface CategoryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (category: ProductCategory) => void;
}

export function CategoryFormDialog({
    open,
    onOpenChange,
    onSuccess,
}: CategoryFormDialogProps) {
    const { t } = useLanguage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        color: "#6366f1",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/product-categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    color: formData.color,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save category");
            }

            const newCategory = await response.json();

            toast.success(t("categories.added"));

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newCategory);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save category");
            console.error("Failed to save category:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "",
            color: "#6366f1",
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
            <DialogContent>
                <form className="contents" onSubmit={handleSubmit}>
                    <DialogHeader className="pr-12">
                        <DialogTitle>{t("categories.addNewCategory")}</DialogTitle>
                        <DialogDescription>
                            {t("categories.addDesc")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cat-name">{t("common.nameRequired")}</Label>
                            <Input
                                id="cat-name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                placeholder={t("categories.namePlaceholder")}
                                required
                            />
                            <p className="text-xs text-slate-500">
                                {t("categories.nameDescription")}
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cat-color">{t("categories.colorLabel")}</Label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    id="cat-color"
                                    value={formData.color}
                                    onChange={(e) =>
                                        setFormData({ ...formData, color: e.target.value })
                                    }
                                    className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                                />
                                <span className="text-sm text-slate-500">{formData.color}</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                {t("categories.colorDescription")}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? t("common.adding") : t("categories.addCategory")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
