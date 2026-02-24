"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export const SIDEBAR_ITEMS = [
    { group: "General", items: ["Dashboard", "POS Terminal", "Products", "Inventory"] },
    { group: "Sales", items: ["Customers", "Quotations", "Sales Invoices", "Credit Notes", "Customer Payments"] },
    { group: "Purchases", items: ["Suppliers", "Purchase Invoices", "Debit Notes", "Supplier Payments"] },
    { group: "Accounting", items: ["Expenses", "Cash & Bank", "Journal Entries", "Chart of Accounts"] },
    { group: "Reports", items: ["Profit by Items", "Customer Balances", "Supplier Balances", "Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Flow", "Expense Report"] },
];

interface SidebarConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
    orgName: string;
}

export function SidebarConfigDialog({ open, onOpenChange, orgId, orgName }: SidebarConfigDialogProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disabledItems, setDisabledItems] = useState<string[]>([]);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (open && orgId) {
            setLoading(true);
            setError("");
            fetch(`/api/admin/organizations/${orgId}/sidebar`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.disabledSidebarItems) {
                        setDisabledItems(data.disabledSidebarItems);
                    } else {
                        setDisabledItems([]);
                    }
                })
                .catch(() => setError("Failed to load settings"))
                .finally(() => setLoading(false));
        }
    }, [open, orgId]);

    const toggleItem = (item: string) => {
        setDisabledItems((prev) =>
            prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/organizations/${orgId}/sidebar`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabledSidebarItems: disabledItems }),
            });
            if (res.ok) {
                onOpenChange(false);
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save settings");
            }
        } catch {
            setError("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sidebar Configuration</DialogTitle>
                    <DialogDescription>
                        Enable or disable navigation items for <strong>{orgName}</strong>.
                        Disabled items will be completely hidden for all users in this organization.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {SIDEBAR_ITEMS.map((group) => (
                                <div key={group.group} className="space-y-3">
                                    <h4 className="font-semibold text-sm border-b pb-1">{group.group}</h4>
                                    <div className="space-y-2">
                                        {group.items.map((item) => {
                                            const isDisabled = disabledItems.includes(item);
                                            return (
                                                <div key={item} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`item-${item}`}
                                                        checked={!isDisabled}
                                                        onCheckedChange={() => toggleItem(item)}
                                                    />
                                                    <Label
                                                        htmlFor={`item-${item}`}
                                                        className={`text-sm font-normal cursor-pointer ${isDisabled ? 'text-muted-foreground line-through' : ''}`}
                                                    >
                                                        {item}
                                                    </Label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter className="sticky bottom-0 bg-background pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
