"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useLanguage } from "@/lib/i18n";
import { useFormConfig } from "@/hooks/use-form-config";

export interface Supplier {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    gstin: string | null;
    gstStateCode: string | null;
    balance?: number;
    notes: string | null;
    isActive?: boolean;
    createdAt?: string;
    vatNumber?: string | null;
    arabicName?: string | null;
    ccNo?: string | null;
    buildingNo?: string | null;
    addNo?: string | null;
    district?: string | null;
}

interface SupplierFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (supplier: Supplier) => void;
    supplierToEdit?: Supplier | null;
}

export function SupplierFormDialog({
    open,
    onOpenChange,
    onSuccess,
    supplierToEdit,
}: SupplierFormDialogProps) {
    const { data: session } = useSession();
    const { t } = useLanguage();
    const { isFieldHidden, getDefault } = useFormConfig("supplier", { isEdit: !!supplierToEdit });
    const isSaudi = !!(session?.user as any)?.saudiEInvoiceEnabled;
    const defaultCountry = isSaudi ? "Saudi Arabia" : "India";
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: getDefault("email", ""),
        phone: getDefault("phone", ""),
        address: getDefault("address", ""),
        city: getDefault("city", ""),
        state: getDefault("state", ""),
        zipCode: getDefault("zipCode", ""),
        country: getDefault("country", defaultCountry),
        gstin: getDefault("gstin", ""),
        gstStateCode: "",
        notes: getDefault("notes", ""),
        vatNumber: "",
        arabicName: "",
        ccNo: "",
        buildingNo: "",
        addNo: "",
        district: "",
    });

    const resetForm = useCallback(() => {
        setFormData({
            name: "",
            email: getDefault("email", ""),
            phone: getDefault("phone", ""),
            address: getDefault("address", ""),
            city: getDefault("city", ""),
            state: getDefault("state", ""),
            zipCode: getDefault("zipCode", ""),
            country: defaultCountry,
            gstin: getDefault("gstin", ""),
            gstStateCode: "",
            notes: getDefault("notes", ""),
            vatNumber: "",
            arabicName: "",
            ccNo: "",
            buildingNo: "",
            addNo: "",
            district: "",
        });
    }, [defaultCountry, getDefault]);

    useEffect(() => {
        if (supplierToEdit && open) {
            setFormData({
                name: supplierToEdit.name,
                email: supplierToEdit.email || "",
                phone: supplierToEdit.phone || "",
                address: supplierToEdit.address || "",
                city: supplierToEdit.city || "",
                state: supplierToEdit.state || "",
                zipCode: supplierToEdit.zipCode || "",
                country: supplierToEdit.country || defaultCountry,
                gstin: supplierToEdit.gstin || "",
                gstStateCode: supplierToEdit.gstStateCode || "",
                notes: supplierToEdit.notes || "",
                vatNumber: supplierToEdit.vatNumber || "",
                arabicName: supplierToEdit.arabicName || "",
                ccNo: supplierToEdit.ccNo || "",
                buildingNo: supplierToEdit.buildingNo || "",
                addNo: supplierToEdit.addNo || "",
                district: supplierToEdit.district || "",
            });
        } else if (open && !supplierToEdit) {
            setFormData(prev => ({
                ...prev,
                country: defaultCountry,
            }));
        } else if (!open) {
            resetForm();
        }
    }, [defaultCountry, open, resetForm, supplierToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSubmitting(true);

        const payload = {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zipCode: formData.zipCode || null,
            country: formData.country || defaultCountry,
            gstin: formData.gstin || null,
            gstStateCode: formData.gstStateCode || null,
            notes: formData.notes || null,
            vatNumber: formData.vatNumber || null,
            arabicName: formData.arabicName || null,
            ccNo: formData.ccNo || null,
            buildingNo: formData.buildingNo || null,
            addNo: formData.addNo || null,
            district: formData.district || null,
        };

        try {
            const response = supplierToEdit
                ? await fetch(`/api/suppliers/${supplierToEdit.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                : await fetch("/api/suppliers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

            if (!response.ok) throw new Error("Failed to save supplier");

            const newSupplier = await response.json();

            toast.success(supplierToEdit ? t("suppliers.updatedSuccess") : t("suppliers.addedSuccess"));

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newSupplier);
            }
        } catch (error) {
            toast.error(t("suppliers.saveFailed"));
            console.error("Failed to save supplier:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                if (!isOpen) resetForm();
            }}
        >
            <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl">
                <form onSubmit={handleSubmit} className="contents">
                    <DialogHeader className="pr-12">
                        <DialogTitle>
                            {supplierToEdit ? t("suppliers.editSupplier") : t("suppliers.addNewSupplier")}
                        </DialogTitle>
                        <DialogDescription>
                            {supplierToEdit
                                ? t("suppliers.editDesc")
                                : t("suppliers.addDesc")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="sup-name">{t("common.nameRequired")}</Label>
                                <Input
                                    id="sup-name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            {!isFieldHidden("email") && (
                            <div className="grid gap-2">
                                <Label htmlFor="sup-email">{t("common.email")}</Label>
                                <Input
                                    id="sup-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                />
                            </div>
                            )}
                        </div>
                        {(!isFieldHidden("phone") || !isFieldHidden("country")) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {!isFieldHidden("phone") && (
                            <div className="grid gap-2">
                                <Label htmlFor="sup-phone">{t("common.phone")}</Label>
                                <Input
                                    id="sup-phone"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                />
                            </div>
                            )}
                            {!isFieldHidden("country") && (
                            <div className="grid gap-2">
                                <Label htmlFor="sup-country">{t("common.country")}</Label>
                                <Input
                                    id="sup-country"
                                    value={formData.country}
                                    onChange={(e) =>
                                        setFormData({ ...formData, country: e.target.value })
                                    }
                                />
                            </div>
                            )}
                        </div>
                        )}
                        {session?.user?.gstEnabled && !(session?.user as any)?.saudiEInvoiceEnabled && !isFieldHidden("gstin") && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="sup-gstin">{t("suppliers.gstin")}</Label>
                                    <Input
                                        id="sup-gstin"
                                        value={formData.gstin}
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase();
                                            setFormData({
                                                ...formData,
                                                gstin: val,
                                                gstStateCode: val.length >= 2 ? val.slice(0, 2) : "",
                                            });
                                        }}
                                        placeholder="15-digit GSTIN"
                                        maxLength={15}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="sup-gstStateCode">{t("suppliers.gstStateCode")}</Label>
                                    <Input
                                        id="sup-gstStateCode"
                                        value={formData.gstStateCode}
                                        onChange={(e) => setFormData({ ...formData, gstStateCode: e.target.value })}
                                        placeholder="e.g. 27"
                                        maxLength={2}
                                        disabled={!!formData.gstin}
                                    />
                                </div>
                            </div>
                        )}
                        {!isFieldHidden("address") && (
                        <div className="grid gap-2">
                            <Label htmlFor="sup-address">{t("common.address")}</Label>
                            <Input
                                id="sup-address"
                                value={formData.address}
                                onChange={(e) =>
                                    setFormData({ ...formData, address: e.target.value })
                                }
                            />
                        </div>
                        )}
                        {isSaudi && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                    <div className="grid gap-2">
                                        <Label htmlFor="sup-vatNumber">{t("suppliers.vatNumber")}</Label>
                                        <Input
                                            id="sup-vatNumber"
                                            value={formData.vatNumber}
                                            onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                                            placeholder="3XXXXXXXXXXXXXX"
                                            maxLength={15}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="sup-arabicName">{t("suppliers.arabicName")}</Label>
                                        <Input
                                            id="sup-arabicName"
                                            value={formData.arabicName}
                                            onChange={(e) => setFormData({ ...formData, arabicName: e.target.value })}
                                            dir="rtl"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                    <div className="grid gap-2">
                                        <Label htmlFor="sup-district">{t("suppliers.district")}</Label>
                                        <Input
                                            id="sup-district"
                                            value={formData.district}
                                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="sup-buildingNo">{t("suppliers.buildingNo")}</Label>
                                        <Input
                                            id="sup-buildingNo"
                                            value={formData.buildingNo}
                                            onChange={(e) => setFormData({ ...formData, buildingNo: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                    <div className="grid gap-2">
                                        <Label htmlFor="sup-addNo">{t("suppliers.addNo")}</Label>
                                        <Input
                                            id="sup-addNo"
                                            value={formData.addNo}
                                            onChange={(e) => setFormData({ ...formData, addNo: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="sup-ccNo">{t("suppliers.crNo")}</Label>
                                        <Input
                                            id="sup-ccNo"
                                            value={formData.ccNo}
                                            onChange={(e) => setFormData({ ...formData, ccNo: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        {(!isFieldHidden("city") || !isFieldHidden("state") || !isFieldHidden("zipCode")) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {!isFieldHidden("city") && (
                            <div className="grid gap-2">
                                <Label htmlFor="sup-city">{t("common.city")}</Label>
                                <Input
                                    id="sup-city"
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                />
                            </div>
                            )}
                            {!isFieldHidden("state") && (
                            <div className="grid gap-2">
                                <Label htmlFor="sup-state">{t("customers.state")}</Label>
                                <Input
                                    id="sup-state"
                                    value={formData.state}
                                    onChange={(e) =>
                                        setFormData({ ...formData, state: e.target.value })
                                    }
                                />
                            </div>
                            )}
                            {!isFieldHidden("zipCode") && (
                            <div className="grid gap-2">
                                <Label htmlFor="sup-zipCode">{t("settings.zipCode")}</Label>
                                <Input
                                    id="sup-zipCode"
                                    value={formData.zipCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, zipCode: e.target.value })
                                    }
                                />
                            </div>
                            )}
                        </div>
                        )}
                        {!isFieldHidden("notes") && (
                        <div className="grid gap-2">
                            <Label htmlFor="sup-notes">{t("common.notes")}</Label>
                            <Textarea
                                id="sup-notes"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder={t("common.notesPlaceholder")}
                            />
                        </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                            {isSubmitting
                                ? (supplierToEdit ? t("common.updating") : t("common.adding"))
                                : (supplierToEdit ? t("suppliers.updateSupplier") : t("suppliers.addSupplier"))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
