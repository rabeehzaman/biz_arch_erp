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
        if (customerToEdit && open) {
            setFormData({
                name: customerToEdit.name,
                email: customerToEdit.email || "",
                phone: customerToEdit.phone || "",
                address: customerToEdit.address || "",
                city: customerToEdit.city || "",
                state: customerToEdit.state || "",
                zipCode: customerToEdit.zipCode || "",
                country: customerToEdit.country || "India",
                gstin: customerToEdit.gstin || "",
                gstStateCode: customerToEdit.gstStateCode || "",
                notes: customerToEdit.notes || "",
            });
        } else if (!open) {
            resetForm();
        }
    }, [customerToEdit, open]);

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

            toast.success(customerToEdit ? "Customer updated successfully" : "Customer added successfully");

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newCustomer);
            }
        } catch (error) {
            toast.error("Failed to save customer");
            console.error("Failed to save customer:", error);
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
                            {customerToEdit ? "Edit Customer" : "Add New Customer"}
                        </DialogTitle>
                        <DialogDescription>
                            {customerToEdit
                                ? "Update the customer details below."
                                : "Fill in the details to add a new customer."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cust-name">Name *</Label>
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
                                <Label htmlFor="cust-email">Email</Label>
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
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cust-phone">Phone</Label>
                                <Input
                                    id="cust-phone"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-country">Country</Label>
                                <Input
                                    id="cust-country"
                                    value={formData.country}
                                    onChange={(e) =>
                                        setFormData({ ...formData, country: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        {session?.user?.gstEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="cust-gstin">GSTIN</Label>
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
                                    <Label htmlFor="cust-gstStateCode">GST State Code</Label>
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
                            <Label htmlFor="cust-address">Address</Label>
                            <Input
                                id="cust-address"
                                value={formData.address}
                                onChange={(e) =>
                                    setFormData({ ...formData, address: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="grid gap-2">
                                <Label htmlFor="cust-city">City</Label>
                                <Input
                                    id="cust-city"
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-state">State</Label>
                                <Input
                                    id="cust-state"
                                    value={formData.state}
                                    onChange={(e) =>
                                        setFormData({ ...formData, state: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cust-zipCode">ZIP Code</Label>
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
                            <Label htmlFor="cust-notes">Notes</Label>
                            <Textarea
                                id="cust-notes"
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
                                ? (customerToEdit ? "Updating..." : "Adding...")
                                : (customerToEdit ? "Update Customer" : "Add Customer")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
