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
    });

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
                country: supplierToEdit.country || "India",
                gstin: supplierToEdit.gstin || "",
                gstStateCode: supplierToEdit.gstStateCode || "",
                notes: supplierToEdit.notes || "",
            });
        } else if (!open) {
            resetForm();
        }
    }, [supplierToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            zipCode: formData.zipCode || null,
            country: formData.country || "India",
            gstin: formData.gstin || null,
            gstStateCode: formData.gstStateCode || null,
            notes: formData.notes || null,
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

            toast.success(supplierToEdit ? "Supplier updated successfully" : "Supplier added successfully");

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newSupplier);
            }
        } catch (error) {
            toast.error("Failed to save supplier");
            console.error("Failed to save supplier:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
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
            <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl overflow-y-auto max-h-[90vh]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <DialogHeader>
                        <DialogTitle>
                            {supplierToEdit ? "Edit Supplier" : "Add New Supplier"}
                        </DialogTitle>
                        <DialogDescription>
                            {supplierToEdit
                                ? "Update the supplier details below."
                                : "Fill in the details to add a new supplier."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="sup-name">Name *</Label>
                                <Input
                                    id="sup-name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sup-email">Email</Label>
                                <Input
                                    id="sup-email"
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
                                <Label htmlFor="sup-phone">Phone</Label>
                                <Input
                                    id="sup-phone"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sup-country">Country</Label>
                                <Input
                                    id="sup-country"
                                    value={formData.country}
                                    onChange={(e) =>
                                        setFormData({ ...formData, country: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        {session?.user?.gstEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="sup-gstin">GSTIN</Label>
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
                                    <Label htmlFor="sup-gstStateCode">GST State Code</Label>
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
                        <div className="grid gap-2">
                            <Label htmlFor="sup-address">Address</Label>
                            <Input
                                id="sup-address"
                                value={formData.address}
                                onChange={(e) =>
                                    setFormData({ ...formData, address: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="sup-city">City</Label>
                                <Input
                                    id="sup-city"
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sup-state">State</Label>
                                <Input
                                    id="sup-state"
                                    value={formData.state}
                                    onChange={(e) =>
                                        setFormData({ ...formData, state: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sup-zipCode">ZIP Code</Label>
                                <Input
                                    id="sup-zipCode"
                                    value={formData.zipCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, zipCode: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sup-notes">Notes</Label>
                            <Textarea
                                id="sup-notes"
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                }
                                placeholder="Any additional notes..."
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-auto pt-4 border-t">
                        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                            {isSubmitting
                                ? (supplierToEdit ? "Updating..." : "Adding...")
                                : (supplierToEdit ? "Update Supplier" : "Add Supplier")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
