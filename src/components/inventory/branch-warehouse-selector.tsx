"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";

interface Branch {
    id: string;
    name: string;
    code: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
    branchId: string;
}

interface BranchWarehouseSelectorProps {
    branchId?: string;
    warehouseId?: string;
    onBranchChange: (branchId: string) => void;
    onWarehouseChange: (warehouseId: string) => void;
    disabled?: boolean;
}

export function BranchWarehouseSelector({
    branchId,
    warehouseId,
    onBranchChange,
    onWarehouseChange,
    disabled = false,
}: BranchWarehouseSelectorProps) {
    const { data: session } = useSession();
    const multiBranchEnabled = session?.user?.multiBranchEnabled;

    const [branches, setBranches] = useState<Branch[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!multiBranchEnabled) return;

        async function fetchData() {
            setLoading(true);
            try {
                const [branchRes, warehouseRes] = await Promise.all([
                    fetch("/api/branches"),
                    fetch("/api/user-warehouse-access")
                ]);

                if (branchRes.ok) {
                    const bData = await branchRes.json();
                    setBranches(bData.filter((b: any) => b.isActive));
                }

                if (warehouseRes.ok) {
                    const wData = await warehouseRes.json();

                    const userAccess = wData.filter((a: any) =>
                        session?.user?.role === 'admin' ||
                        session?.user?.role === 'superadmin' ||
                        a.userId === session?.user?.id
                    );

                    let availableWarehouses: any[] = [];
                    if (session?.user?.role === 'admin' || session?.user?.role === 'superadmin') {
                        // Admins get all warehouses
                        const allWarehousesRes = await fetch("/api/warehouses");
                        if (allWarehousesRes.ok) {
                            availableWarehouses = await allWarehousesRes.json();
                        }
                    } else {
                        // Normal users only get assigned warehouses
                        availableWarehouses = userAccess.map((access: any) => access.warehouse).filter(Boolean);
                    }

                    setWarehouses(availableWarehouses.filter((w: any) => w.isActive));
                }
            } catch (error) {
                console.error("Failed to load branches and warehouses", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [multiBranchEnabled]);

    // Handle case where user only has access to a subset of warehouses for the branch
    const availableWarehouses = warehouses.filter(w => !branchId || w.branchId === branchId);

    // Auto-select if only one option is available
    useEffect(() => {
        if (!branchId && branches.length === 1 && !disabled) {
            onBranchChange(branches[0].id);
        }
    }, [branches, branchId, onBranchChange, disabled]);

    useEffect(() => {
        if (branchId && !warehouseId && availableWarehouses.length === 1 && !disabled) {
            onWarehouseChange(availableWarehouses[0].id);
        }
    }, [branchId, availableWarehouses, warehouseId, onWarehouseChange, disabled]);

    if (!multiBranchEnabled) return null;

    return (
        <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-slate-50 mb-4">
            <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                    disabled={loading || disabled || branches.length === 0}
                    value={branchId || ""}
                    onValueChange={(val) => {
                        onBranchChange(val);
                        onWarehouseChange(""); // Reset warehouse when branch changes
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                        {branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select
                    disabled={loading || disabled || !branchId || availableWarehouses.length === 0}
                    value={warehouseId || ""}
                    onValueChange={onWarehouseChange}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableWarehouses.map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
