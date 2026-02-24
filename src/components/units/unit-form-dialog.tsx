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

interface Unit {
    id: string;
    code: string;
    name: string;
}

interface UnitFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (unit: Unit) => void;
}

export function UnitFormDialog({
    open,
    onOpenChange,
    onSuccess,
}: UnitFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        code: "",
        name: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            code: formData.code.toLowerCase(),
            name: formData.name,
        };

        try {
            const response = await fetch("/api/units", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save unit");
            }

            const rawData = await response.json();
            // The API returns { unit: {...} } or just the unit itself depending on common practices, 
            // but let's assume it returns the unit object directly based on how it's used elsewhere
            const newUnit = rawData.unit || rawData;

            toast.success("Unit added successfully");

            resetForm();
            onOpenChange(false);

            if (onSuccess) {
                onSuccess(newUnit);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save unit");
            console.error("Failed to save unit:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            code: "",
            name: "",
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
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Unit</DialogTitle>
                        <DialogDescription>
                            Add a new unit of measurement.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) =>
                                    setFormData({ ...formData, code: e.target.value })
                                }
                                placeholder="e.g., mtr, kg, pcs"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                Short code for the unit (will be converted to lowercase)
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                placeholder="e.g., Meter, Kilogram, Piece"
                                required
                            />
                            <p className="text-xs text-slate-500">
                                Full name of the unit
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Adding..." : "Add Unit"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
