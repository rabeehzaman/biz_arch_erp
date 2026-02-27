"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Users, Warehouse, Loader2, ShieldCheck } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

interface AccessRow {
    id: string;
    isDefault: boolean;
    user: { id: string; name: string; email: string };
    branch: { id: string; name: string; code: string } | null;
    warehouse: { id: string; name: string; code: string } | null;
}

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface WarehouseItem {
    id: string;
    name: string;
    code: string;
    branch: { id: string; name: string; code: string };
}

export function UserWarehouseSettings() {
    const [access, setAccess] = useState<AccessRow[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ userId: "", warehouseId: "", isDefault: false });
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [accRes, usrRes, whRes] = await Promise.all([
                fetch("/api/user-warehouse-access"),
                fetch("/api/users"),
                fetch("/api/warehouses"),
            ]);
            if (accRes.ok) setAccess(await accRes.json());
            if (usrRes.ok) setUsers(await usrRes.json());
            if (whRes.ok) setWarehouses(await whRes.json());
        } catch {
            toast.error("Failed to load user access data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openDialog = () => {
        setForm({ userId: "", warehouseId: "", isDefault: false });
        setDialogOpen(true);
    };

    const save = async () => {
        if (!form.userId || !form.warehouseId) {
            toast.error("User and warehouse are required");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/user-warehouse-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success("Access granted");
                setDialogOpen(false);
                fetchAll();
            } else {
                const d = await res.json();
                toast.error(d.error || "Failed to grant access");
            }
        } catch {
            toast.error("Failed to grant access");
        } finally {
            setSaving(false);
        }
    };

    const revoke = (row: AccessRow) => {
        setConfirmDialog({
            title: "Revoke Access",
            description: `Remove ${row.user.name}'s access to ${row.warehouse?.name ?? "this warehouse"}?`,
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/user-warehouse-access?id=${row.id}`, { method: "DELETE" });
                    if (res.ok) { toast.success("Access revoked"); fetchAll(); }
                    else { const d = await res.json(); toast.error(d.error || "Failed to revoke"); }
                } catch { toast.error("Failed to revoke access"); }
            },
        });
    };

    // Group by user for display
    const groupedByUser: Record<string, { user: User; rows: AccessRow[] }> = {};
    for (const row of access) {
        if (!groupedByUser[row.user.id]) {
            const u = users.find((u) => u.id === row.user.id);
            groupedByUser[row.user.id] = { user: u ?? row.user as unknown as User, rows: [] };
        }
        groupedByUser[row.user.id].rows.push(row);
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500">
                        Assign users to specific warehouses. Users with no assignments can access all warehouses.
                    </p>
                </div>
                <Button onClick={openDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Grant Access
                </Button>
            </div>

            {loading ? (
                <TableSkeleton columns={5} rows={4} />
            ) : access.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-slate-50">
                    <ShieldCheck className="h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="font-semibold text-slate-700">No access assignments</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        All users currently have unrestricted access to all warehouses.<br />
                        Grant specific access to restrict users to certain warehouses.
                    </p>
                    <Button onClick={openDialog} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Grant First Access
                    </Button>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead className="text-center">Default</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {access.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Users className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{row.user.name}</p>
                                            <p className="text-xs text-slate-400">{row.user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {row.branch ? (
                                        <Badge variant="outline" className="text-xs">{row.branch.name}</Badge>
                                    ) : (
                                        <span className="text-slate-400 text-sm">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {row.warehouse ? (
                                        <div className="flex items-center gap-1.5">
                                            <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                                            <span className="text-sm font-medium">{row.warehouse.name}</span>
                                            <span className="text-xs text-slate-400">({row.warehouse.code})</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 text-sm">All</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    {row.isDefault && (
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Default</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => revoke(row)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Grant Access Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Grant Warehouse Access</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>User *</Label>
                            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                                <SelectContent>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.name} — {u.email} ({u.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Warehouse *</Label>
                            <Select value={form.warehouseId} onValueChange={(v) => setForm({ ...form, warehouseId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name} ({w.code}) — {w.branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch
                                id="isDefault"
                                checked={form.isDefault}
                                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                            />
                            <Label htmlFor="isDefault" className="cursor-pointer">
                                Set as default warehouse for this user
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={save} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Grant Access
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {confirmDialog && (
                <ConfirmDialog
                    open={!!confirmDialog}
                    onOpenChange={(open) => !open && setConfirmDialog(null)}
                    title={confirmDialog.title}
                    description={confirmDialog.description}
                    onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                    variant="destructive"
                />
            )}
        </div>
    );
}
