"use client";

import { useState, useEffect } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    Plus, Search, ArrowRightLeft, Loader2, Trash2,
    CheckCircle, XCircle, Truck, RotateCcw, ChevronDown,
} from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Branch {
    id: string; name: string; code: string;
}
interface Warehouse {
    id: string; name: string; code: string; branchId: string; isActive: boolean;
    branch: { id: string; name: string; code: string };
}
interface TransferItem {
    id?: string; productId: string; quantity: number; unitCost: number; notes?: string;
    product?: { id: string; name: string; sku?: string };
}
interface StockTransfer {
    id: string;
    transferNumber: string;
    status: string;
    transferDate: string;
    notes: string | null;
    sourceBranch: { id: string; name: string };
    sourceWarehouse: { id: string; name: string };
    destinationBranch: { id: string; name: string };
    destinationWarehouse: { id: string; name: string };
    items?: TransferItem[];
    _count?: { items: number };
    createdAt: string;
}
interface Product {
    id: string; name: string; sku: string | null; price: number;
}

const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800",
    APPROVED: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    REVERSED: "bg-purple-100 text-purple-800",
};

const statusActions: Record<string, { label: string; action: string; icon: React.ElementType }[]> = {
    DRAFT: [
        { label: "Approve", action: "approve", icon: CheckCircle },
        { label: "Cancel", action: "cancel", icon: XCircle },
    ],
    APPROVED: [
        { label: "Ship", action: "ship", icon: Truck },
        { label: "Cancel", action: "cancel", icon: XCircle },
    ],
    IN_TRANSIT: [
        { label: "Complete", action: "complete", icon: CheckCircle },
        { label: "Cancel", action: "cancel", icon: XCircle },
    ],
    COMPLETED: [
        { label: "Reverse", action: "reverse", icon: RotateCcw },
    ],
};

export default function StockTransfersPage() {
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [form, setForm] = useState({
        sourceWarehouseId: "",
        destinationWarehouseId: "",
        notes: "",
        items: [{ productId: "", quantity: 1, unitCost: 0 }] as TransferItem[],
    });

    const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

    useEffect(() => { fetchTransfers(); }, []);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stock-transfers");
            if (res.ok) setTransfers(await res.json());
        } catch { toast.error("Failed to load stock transfers"); }
        finally { setLoading(false); }
    };

    const openCreateDialog = async () => {
        // load warehouses and products
        try {
            const [whRes, prodRes] = await Promise.all([
                fetch("/api/warehouses"),
                fetch("/api/products"),
            ]);
            if (whRes.ok) setWarehouses(await whRes.json());
            if (prodRes.ok) setProducts(await prodRes.json());
        } catch { toast.error("Failed to load data"); return; }
        setForm({ sourceWarehouseId: "", destinationWarehouseId: "", notes: "", items: [{ productId: "", quantity: 1, unitCost: 0 }] });
        setDialogOpen(true);
    };

    const addItem = () => setForm({ ...form, items: [...form.items, { productId: "", quantity: 1, unitCost: 0 }] });
    const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
    const updateItem = (i: number, field: string, value: any) => {
        const items = [...form.items];
        (items[i] as any)[field] = value;
        setForm({ ...form, items });
    };

    const saveTransfer = async () => {
        if (!form.sourceWarehouseId || !form.destinationWarehouseId) { toast.error("Select source and destination warehouses"); return; }
        if (form.sourceWarehouseId === form.destinationWarehouseId) { toast.error("Source and destination must be different"); return; }
        const validItems = form.items.filter((i) => i.productId && i.quantity > 0);
        if (validItems.length === 0) { toast.error("Add at least one item"); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/stock-transfers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, items: validItems }),
            });
            if (res.ok) {
                toast.success("Stock transfer created");
                setDialogOpen(false);
                fetchTransfers();
            } else {
                const d = await res.json();
                toast.error(d.error || "Failed to create");
            }
        } catch { toast.error("Failed to create stock transfer"); }
        finally { setSaving(false); }
    };

    const performAction = async (transferId: string, action: string) => {
        try {
            const res = await fetch(`/api/stock-transfers/${transferId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                toast.success(`Transfer ${action}d successfully`);
                fetchTransfers();
            } else {
                const d = await res.json();
                toast.error(d.error || `Failed to ${action}`);
            }
        } catch { toast.error(`Failed to ${action}`); }
    };

    const deleteTransfer = (id: string) => {
        setConfirmDialog({
            title: "Delete Stock Transfer",
            description: "This will permanently delete this stock transfer. Only DRAFT and APPROVED transfers can be deleted.",
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/stock-transfers/${id}`, { method: "DELETE" });
                    if (res.ok) { toast.success("Deleted"); fetchTransfers(); }
                    else { const d = await res.json(); toast.error(d.error || "Failed to delete"); }
                } catch { toast.error("Failed to delete"); }
            },
        });
    };

    const filteredTransfers = transfers.filter((t) => {
        const matchSearch = t.transferNumber.toLowerCase().includes(search.toLowerCase()) ||
            t.sourceBranch.name.toLowerCase().includes(search.toLowerCase()) ||
            t.destinationBranch.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Stock Transfers</h2>
                    <p className="text-slate-500">Transfer stock between warehouses and track movements</p>
                </div>

                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Status</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                <SelectItem value="REVERSED">Reversed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" /> New Transfer
                    </Button>
                </div>

                <StaggerContainer className="space-y-4">
                    <StaggerItem>
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input placeholder="Search transfers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading ? <TableSkeleton columns={7} rows={5} /> : filteredTransfers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <ArrowRightLeft className="h-12 w-12 text-slate-300" />
                                        <h3 className="mt-4 text-lg font-semibold">No stock transfers found</h3>
                                        <p className="text-sm text-slate-500">{search ? "Try a different search term" : "Create your first stock transfer"}</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Transfer #</TableHead>
                                                <TableHead>From</TableHead>
                                                <TableHead>To</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredTransfers.map((t) => (
                                                <TableRow key={t.id}>
                                                    <TableCell className="font-medium font-mono">{t.transferNumber}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{t.sourceBranch.name}</div>
                                                        <div className="text-xs text-slate-500">{t.sourceWarehouse.name}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{t.destinationBranch.name}</div>
                                                        <div className="text-xs text-slate-500">{t.destinationWarehouse.name}</div>
                                                    </TableCell>
                                                    <TableCell>{t._count?.items || 0}</TableCell>
                                                    <TableCell>{new Date(t.transferDate).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[t.status] || ""}>{t.status.replace("_", " ")}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {statusActions[t.status] && statusActions[t.status].length > 0 && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="outline" size="sm">
                                                                            Actions <ChevronDown className="ml-1 h-3 w-3" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        {statusActions[t.status].map((sa) => (
                                                                            <DropdownMenuItem key={sa.action} onClick={() => performAction(t.id, sa.action)}>
                                                                                <sa.icon className="mr-2 h-4 w-4" /> {sa.label}
                                                                            </DropdownMenuItem>
                                                                        ))}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                            {["DRAFT", "APPROVED"].includes(t.status) && (
                                                                <Button variant="ghost" size="icon" onClick={() => deleteTransfer(t.id)}>
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </StaggerItem>
                </StaggerContainer>

                {/* Create Transfer Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>New Stock Transfer</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Source Warehouse *</Label>
                                    <Select value={form.sourceWarehouseId} onValueChange={(v) => setForm({ ...form, sourceWarehouseId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                                        <SelectContent>
                                            {warehouses.filter((w) => w.isActive && w.id !== form.destinationWarehouseId).map((w) => (
                                                <SelectItem key={w.id} value={w.id}>{w.branch.name} → {w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Destination Warehouse *</Label>
                                    <Select value={form.destinationWarehouseId} onValueChange={(v) => setForm({ ...form, destinationWarehouseId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                                        <SelectContent>
                                            {warehouses.filter((w) => w.isActive && w.id !== form.sourceWarehouseId).map((w) => (
                                                <SelectItem key={w.id} value={w.id}>{w.branch.name} → {w.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Items *</Label>
                                    <Button variant="outline" size="sm" onClick={addItem}>
                                        <Plus className="mr-1 h-3 w-3" /> Add Item
                                    </Button>
                                </div>
                                {form.items.map((item, i) => (
                                    <div key={i} className="flex items-end gap-2 p-3 border rounded-lg">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs">Product</Label>
                                            <Select value={item.productId} onValueChange={(v) => updateItem(i, "productId", v)}>
                                                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                                                <SelectContent>
                                                    {products.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-24 space-y-1">
                                            <Label className="text-xs">Qty</Label>
                                            <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                                        </div>
                                        <div className="w-28 space-y-1">
                                            <Label className="text-xs">Unit Cost</Label>
                                            <Input type="number" min={0} step={0.01} value={item.unitCost} onChange={(e) => updateItem(i, "unitCost", Number(e.target.value))} />
                                        </div>
                                        {form.items.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="shrink-0">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveTransfer} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Transfer
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
                    />
                )}
            </div>
        </PageAnimation>
    );
}
