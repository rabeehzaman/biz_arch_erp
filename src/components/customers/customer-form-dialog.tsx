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

interface Customer {
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
    notes: string | null;
    ccNo?: string | null;
    buildingNo?: string | null;
    addNo?: string | null;
    district?: string | null;
}

interface CustomerFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (customer: Customer) => void;
    customerToEdit?: Customer;
}

export function CustomerFormDialog({
    open,
    onOpenChange,
    onSuccess,
    customerToEdit,
}: CustomerFormDialogProps) {
    const { data: session } = useSession();
    const { t } = useLanguage();
    const defaultCountry = (session?.user as any)?.saudiEInvoiceEnabled ? "Saudi Arabia" : "India";
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "India",
        gstin: "",
        gstStateCode: "",
        notes: "",
        ccNo: "",
        buildingNo: "",
        addNo: "",
        district: "",
    });

    const resetForm = useCallback(() => {
        setFormData({
            name: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            state: "",
            zipCode: "",
            country: defaultCountry,
            gstin: "",
            gstStateCode: "",
            notes: "",
            ccNo: "",
            buildingNo: "",
            addNo: "",
            district: "",
        });
    }, [defaultCountry]);

    useEffect(() => {
        if (customerToEdit && open) {
            setFormData({
                name: customerToEdit.name,
                email: customerToEdit.email || "",
                phone: customerToEdit.phone || "",
                address: customerToEdit.address || "",
                city: customerToEdit.city || "",
                state: customerToEdit.state || "",
                zipCode: customerToEdit.zipCode || "",
                country: customerToEdit.country || defaultCountry,
                gstin: customerToEdit.gstin || "",
                gstStateCode: customerToEdit.gstStateCode || "",
                notes: customerToEdit.notes || "",
                ccNo: customerToEdit.ccNo || "",
                buildingNo: customerToEdit.buildingNo || "",
                addNo: customerToEdit.addNo || "",
                district: customerToEdit.district || "",
            });
        } else if (open && !customerToEdit) {
            setFormData(prev => ({
                ...prev,
                country: defaultCountry
            }));
        } else if (!open) {
            resetForm();
        }
    }, [customerToEdit, defaultCountry, open, resetForm]);

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
            ccNo: formData.ccNo || null,
            buildingNo: formData.buildingNo || null,
            addNo: formData.addNo || null,
            district: formData.district || null,
        };

        try {
            const response = customerToEdit
                ? await fetch(`/api/customers/${customerToEdit.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                : await fetch("/api/customers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

            if (!response.ok) throw new Error("Failed to save customer");

            const newCustomer = await response.json();

            toast.success(customerToEdit ? t("customers.updatedSuccess") : t("customers.addedSuccess"));

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newCustomer);
            }
        } catch (error) {
            toast.error(t("customers.saveFailed"));
            console.error("Failed to save customer:", error);
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
                            {customerToEdit ? t("customers.editCustomer") : t("customers.addNewCustomer")}
                        </DialogTitle>
                        <DialogDescription>
                            {customerToEdit
                                ? t("customers.editDesc")
                                : t("customers.addDesc")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cust-name">{t("common.nameRequired")}</Label>
                                <Input
                                    id="cust-name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-email">{t("common.email")}</Label>
                                <Input
                                    id="cust-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({ ...formData, email: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cust-phone">{t("common.phone")}</Label>
                                <Input
                                    id="cust-phone"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-country">{t("common.country")}</Label>
                                <Input
                                    id="cust-country"
                                    value={formData.country}
                                    onChange={(e) =>
                                        setFormData({ ...formData, country: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        {session?.user?.gstEnabled && !(session?.user as any)?.saudiEInvoiceEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="cust-gstin">{t("customers.gstin")}</Label>
                                    <Input
                                        id="cust-gstin"
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
                                    <Label htmlFor="cust-gstStateCode">{t("customers.gstStateCode")}</Label>
                                    <Input
                                        id="cust-gstStateCode"
                                        value={formData.gstStateCode}
                                        onChange={(e) => setFormData({ ...formData, gstStateCode: e.target.value })}
                                        placeholder="e.g. 27"
                                        maxLength={2}
                                        disabled={!!formData.gstin}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="cust-address">{t("common.address")}</Label>
                            <Input
                                id="cust-address"
                                value={formData.address}
                                onChange={(e) =>
                                    setFormData({ ...formData, address: e.target.value })
                                }
                            />
                        </div>
                        {(session?.user as any)?.saudiEInvoiceEnabled && (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                    <div className="grid gap-2">
                                        <Label htmlFor="cust-district">{t("customers.district")}</Label>
                                        <Input
                                            id="cust-district"
                                            value={formData.district}
                                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="cust-buildingNo">{t("customers.buildingNo")}</Label>
                                        <Input
                                            id="cust-buildingNo"
                                            value={formData.buildingNo}
                                            onChange={(e) => setFormData({ ...formData, buildingNo: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                    <div className="grid gap-2">
                                        <Label htmlFor="cust-addNo">{t("customers.addNo")}</Label>
                                        <Input
                                            id="cust-addNo"
                                            value={formData.addNo}
                                            onChange={(e) => setFormData({ ...formData, addNo: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="cust-ccNo">{t("customers.crNo")}</Label>
                                        <Input
                                            id="cust-ccNo"
                                            value={formData.ccNo}
                                            onChange={(e) => setFormData({ ...formData, ccNo: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cust-city">{t("common.city")}</Label>
                                <Input
                                    id="cust-city"
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-state">{t("customers.state")}</Label>
                                <Input
                                    id="cust-state"
                                    value={formData.state}
                                    onChange={(e) =>
                                        setFormData({ ...formData, state: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-zipCode">{t("settings.zipCode")}</Label>
                                <Input
                                    id="cust-zipCode"
                                    value={formData.zipCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, zipCode: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cust-notes">{t("common.notes")}</Label>
                            <Textarea
                                id="cust-notes"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder={t("common.notesPlaceholder")}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                            {isSubmitting
                                ? (customerToEdit ? t("common.updating") : t("common.adding"))
                                : (customerToEdit ? t("customers.updateCustomer") : t("customers.addCustomer"))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
