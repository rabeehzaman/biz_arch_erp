"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    ArrowRightLeft, Eye, Loader2, Plus, Printer, RotateCcw, Search, Trash2,
} from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

interface Warehouse {
    id: string;
    name: string;
    code: string;
    branchId: string;
    isActive: boolean;
    branch: { id: string; name: string; code: string };
}

interface FormItem {
    productId: string;
    quantity: number;
    notes?: string;
}

interface TransferItem {
    id?: string;
    productId: string;
    quantity: number;
    unitCost: number;
    notes?: string | null;
    product?: { id: string; name: string; sku?: string | null };
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
    id: string;
    name: string;
    sku: string | null;
    availableStock: number;
}

const getEmptyForm = () => ({
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    notes: "",
    items: [{ productId: "", quantity: 1 }] as FormItem[],
});

const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-800",
    APPROVED: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    REVERSED: "bg-purple-100 text-purple-800",
};

export default function StockTransfersPage() {
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [form, setForm] = useState(getEmptyForm);

    const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

    useEffect(() => {
        fetchTransfers();
    }, []);

    useEffect(() => {
        if (!dialogOpen) {
            return;
        }

        if (!form.sourceWarehouseId) {
            setProducts([]);
            return;
        }

        fetchProducts(form.sourceWarehouseId);
    }, [dialogOpen, form.sourceWarehouseId]);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stock-transfers");
            if (!res.ok) throw new Error();
            setTransfers(await res.json());
        } catch {
            toast.error("Failed to load stock transfers");
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        const response = await fetch("/api/warehouses");
        if (!response.ok) {
            throw new Error("Failed to load warehouses");
        }

        const data = await response.json();
        setWarehouses(data.filter((warehouse: Warehouse) => warehouse.isActive));
    };

    const fetchProducts = async (warehouseId: string) => {
        setLoadingProducts(true);
        try {
            const params = new URLSearchParams({
                compact: "true",
                excludeServices: "true",
                warehouseId,
            });
            const response = await fetch(`/api/products?${params.toString()}`);
            if (!response.ok) {
                throw new Error("Failed to load products");
            }

            setProducts(await response.json());
        } catch {
            toast.error("Failed to load source warehouse stock");
        } finally {
            setLoadingProducts(false);
        }
    };

    const openCreateDialog = async () => {
        try {
            await fetchWarehouses();
            setForm(getEmptyForm());
            setProducts([]);
            setDialogOpen(true);
        } catch {
            toast.error("Failed to load transfer setup");
        }
    };

    const addItem = () => {
        setForm((current) => ({
            ...current,
            items: [...current.items, { productId: "", quantity: 1 }],
        }));
    };

    const removeItem = (index: number) => {
        setForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const updateItem = (index: number, field: keyof FormItem, value: string | number) => {
        setForm((current) => {
            const items = [...current.items];
            items[index] = {
                ...items[index],
                [field]: value,
            };
            return { ...current, items };
        });
    };

    const handleSourceWarehouseChange = (value: string) => {
        setForm((current) => ({
            ...current,
            sourceWarehouseId: value,
            destinationWarehouseId: current.destinationWarehouseId === value ? "" : current.destinationWarehouseId,
            items: [{ productId: "", quantity: 1 }],
        }));
    };

    const saveTransfer = async () => {
        if (!form.sourceWarehouseId || !form.destinationWarehouseId) {
            toast.error("Select source and destination warehouses");
            return;
        }

        if (form.sourceWarehouseId === form.destinationWarehouseId) {
            toast.error("Source and destination must be different");
            return;
        }

        const validItems = form.items.filter((item) => item.productId && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Add at least one item");
            return;
        }

        const unavailableItem = validItems.find((item) => {
            const product = products.find((productItem) => productItem.id === item.productId);
            return product && item.quantity > Number(product.availableStock || 0);
        });

        if (unavailableItem) {
            const product = products.find((productItem) => productItem.id === unavailableItem.productId);
            toast.error(`Requested quantity exceeds available stock for ${product?.name || "the selected product"}`);
            return;
        }

        setSaving(true);
        try {
            const response = await fetch("/api/stock-transfers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceWarehouseId: form.sourceWarehouseId,
                    destinationWarehouseId: form.destinationWarehouseId,
                    notes: form.notes || null,
                    items: validItems,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Failed to complete transfer");
            }

            toast.success("Stock transfer completed");
            setDialogOpen(false);
            setForm(getEmptyForm());
            fetchTransfers();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to complete transfer");
        } finally {
            setSaving(false);
        }
    };

    const reverseTransfer = (transfer: StockTransfer) => {
        setConfirmDialog({
            title: "Reverse Stock Transfer",
            description: "This will move the stock back to the source warehouse if none of the transferred stock has been consumed.",
            onConfirm: async () => {
                try {
                    const response = await fetch(`/api/stock-transfers/${transfer.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reverse" }),
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.error || "Failed to reverse transfer");
                    }

                    toast.success("Transfer reversed");
                    fetchTransfers();
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to reverse transfer");
                }
            },
        });
    };

    const filteredTransfers = transfers.filter((transfer) => {
        const query = search.toLowerCase();
        return (
            transfer.transferNumber.toLowerCase().includes(query) ||
            transfer.sourceBranch.name.toLowerCase().includes(query) ||
            transfer.sourceWarehouse.name.toLowerCase().includes(query) ||
            transfer.destinationBranch.name.toLowerCase().includes(query) ||
            transfer.destinationWarehouse.name.toLowerCase().includes(query)
        );
    });

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Stock Transfers</h2>
                    <p className="text-slate-500">Move stock between warehouses and complete the transfer in one step.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search transfers..."
                            className="pl-10"
                        />
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Transfer
                    </Button>
                </div>

                <StaggerContainer className="space-y-4">
                    <StaggerItem>
                        <Card>
                            <CardContent>
                                {loading ? (
                                    <TableSkeleton columns={7} rows={5} />
                                ) : filteredTransfers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <ArrowRightLeft className="h-12 w-12 text-slate-300" />
                                        <h3 className="mt-4 text-lg font-semibold">No stock transfers found</h3>
                                        <p className="text-sm text-slate-500">
                                            {search ? "Try a different search term" : "Complete your first stock transfer"}
                                        </p>
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
                                            {filteredTransfers.map((transfer) => (
                                                <TableRow key={transfer.id}>
                                                    <TableCell className="font-medium font-mono">
                                                        {transfer.transferNumber}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{transfer.sourceBranch.name}</div>
                                                        <div className="text-xs text-slate-500">{transfer.sourceWarehouse.name}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">{transfer.destinationBranch.name}</div>
                                                        <div className="text-xs text-slate-500">{transfer.destinationWarehouse.name}</div>
                                                    </TableCell>
                                                    <TableCell>{transfer._count?.items || 0}</TableCell>
                                                    <TableCell>{new Date(transfer.transferDate).toLocaleDateString()}</TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColors[transfer.status] || ""}>
                                                            {transfer.status.replace("_", " ")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/inventory/stock-transfers/${transfer.id}`}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    Open
                                                                </Link>
                                                            </Button>
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={`/inventory/stock-transfers/${transfer.id}?print=1`} target="_blank">
                                                                    <Printer className="mr-2 h-4 w-4" />
                                                                    Print
                                                                </Link>
                                                            </Button>
                                                            {transfer.status === "COMPLETED" && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => reverseTransfer(transfer)}
                                                                    title="Reverse transfer"
                                                                >
                                                                    <RotateCcw className="h-4 w-4 text-amber-600" />
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

                <Dialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) {
                            setForm(getEmptyForm());
                            setProducts([]);
                        }
                    }}
                >
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>New Stock Transfer</DialogTitle>
                            <DialogDescription>
                                Stock is checked against the selected source warehouse and the transfer is completed immediately when you save.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Source Warehouse *</Label>
                                    <Select value={form.sourceWarehouseId} onValueChange={handleSourceWarehouseChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select source warehouse" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map((warehouse) => (
                                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                                    {warehouse.branch.name} {"->"} {warehouse.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Destination Warehouse *</Label>
                                    <Select
                                        value={form.destinationWarehouseId}
                                        onValueChange={(value) => setForm((current) => ({ ...current, destinationWarehouseId: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select destination warehouse" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses
                                                .filter((warehouse) => warehouse.id !== form.sourceWarehouseId)
                                                .map((warehouse) => (
                                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                                        {warehouse.branch.name} {"->"} {warehouse.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Input
                                    value={form.notes}
                                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                    placeholder="Optional transfer notes"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Items *</Label>
                                    <Button variant="outline" size="sm" onClick={addItem}>
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add Item
                                    </Button>
                                </div>

                                {form.items.map((item, index) => {
                                    const selectedProduct = products.find((product) => product.id === item.productId);
                                    return (
                                        <div key={index} className="space-y-3 rounded-lg border p-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">Product</Label>
                                                    <Select
                                                        value={item.productId}
                                                        onValueChange={(value) => updateItem(index, "productId", value)}
                                                        disabled={!form.sourceWarehouseId || loadingProducts}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={form.sourceWarehouseId ? "Select product" : "Select source warehouse first"} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map((product) => (
                                                                <SelectItem
                                                                    key={product.id}
                                                                    value={product.id}
                                                                    disabled={Number(product.availableStock || 0) <= 0}
                                                                >
                                                                    {product.name}
                                                                    {product.sku ? ` (${product.sku})` : ""}
                                                                    {` - Stock: ${Number(product.availableStock || 0)}`}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="w-full space-y-1 sm:w-28">
                                                    <Label className="text-xs">Qty</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={item.quantity}
                                                        onChange={(event) => updateItem(index, "quantity", Number(event.target.value))}
                                                    />
                                                </div>

                                                {form.items.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeItem(index)}
                                                        className="shrink-0"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                )}
                                            </div>

                                            {selectedProduct && (
                                                <p className="text-xs text-slate-500">
                                                    Available in source warehouse: {Number(selectedProduct.availableStock || 0)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={saveTransfer} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Complete Transfer
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
                        onConfirm={() => {
                            confirmDialog.onConfirm();
                            setConfirmDialog(null);
                        }}
                    />
                )}
            </div>
        </PageAnimation>
    );
}
