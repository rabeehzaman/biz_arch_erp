"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import { useLanguage } from "@/lib/i18n";
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

const transferStatusLabelKeys: Record<string, string> = {
    DRAFT: "inventory.draftStatus",
    APPROVED: "inventory.approvedStatus",
    IN_TRANSIT: "inventory.inTransitStatus",
    COMPLETED: "inventory.completedStatus",
    CANCELLED: "inventory.cancelledStatus",
    REVERSED: "inventory.reversedStatus",
};

export default function StockTransfersPage() {
    const { t, tt, lang } = useLanguage();
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

    const formatDate = (value: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));

    const formatTransferStatus = (status: string) => {
        const key = transferStatusLabelKeys[status];
        return key ? t(key) : status.replaceAll("_", " ");
    };

    const fetchTransfers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/stock-transfers");
            if (!res.ok) throw new Error();
            setTransfers(await res.json());
        } catch {
            toast.error(t("inventory.failedToLoadStockTransfers"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const fetchWarehouses = useCallback(async () => {
        const response = await fetch("/api/warehouses");
        if (!response.ok) {
            throw new Error(t("inventory.failedToLoadWarehouses"));
        }

        const data = await response.json();
        setWarehouses(data.filter((warehouse: Warehouse) => warehouse.isActive));
    }, [t]);

    const fetchProducts = useCallback(async (warehouseId: string) => {
        setLoadingProducts(true);
        try {
            const params = new URLSearchParams({
                compact: "true",
                excludeServices: "true",
                warehouseId,
            });
            const response = await fetch(`/api/products?${params.toString()}`);
            if (!response.ok) {
                throw new Error(t("inventory.failedToLoadProducts"));
            }

            setProducts(await response.json());
        } catch (error) {
            toast.error(error instanceof Error ? tt(error.message) : t("inventory.failedToLoadSourceWarehouseStock"));
        } finally {
            setLoadingProducts(false);
        }
    }, [t, tt]);

    useEffect(() => {
        fetchTransfers();
    }, [fetchTransfers]);

    useEffect(() => {
        if (!dialogOpen) {
            return;
        }

        if (!form.sourceWarehouseId) {
            setProducts([]);
            return;
        }

        fetchProducts(form.sourceWarehouseId);
    }, [dialogOpen, form.sourceWarehouseId, fetchProducts]);

    const openCreateDialog = async () => {
        try {
            await fetchWarehouses();
            setForm(getEmptyForm());
            setProducts([]);
            setDialogOpen(true);
        } catch (error) {
            toast.error(error instanceof Error ? tt(error.message) : t("inventory.failedToLoadTransferSetup"));
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
            toast.error(t("inventory.selectSourceAndDestinationWarehouses"));
            return;
        }

        if (form.sourceWarehouseId === form.destinationWarehouseId) {
            toast.error(t("inventory.sourceAndDestinationMustBeDifferent"));
            return;
        }

        const validItems = form.items.filter((item) => item.productId && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error(t("inventory.addAtLeastOneItem"));
            return;
        }

        const unavailableItem = validItems.find((item) => {
            const product = products.find((productItem) => productItem.id === item.productId);
            return product && item.quantity > Number(product.availableStock || 0);
        });

        if (unavailableItem) {
            const product = products.find((productItem) => productItem.id === unavailableItem.productId);
            toast.error(
                `${t("inventory.requestedQuantityExceedsAvailableStock")} ${product?.name || t("inventory.selectedProduct")}`
            );
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
                throw new Error(
                    typeof data.error === "string"
                        ? tt(data.error)
                        : t("inventory.failedToCompleteTransfer")
                );
            }

            toast.success(t("inventory.stockTransferCompleted"));
            setDialogOpen(false);
            setForm(getEmptyForm());
            fetchTransfers();
        } catch (error) {
            toast.error(error instanceof Error ? tt(error.message) : t("inventory.failedToCompleteTransfer"));
        } finally {
            setSaving(false);
        }
    };

    const reverseTransfer = (transfer: StockTransfer) => {
        setConfirmDialog({
            title: t("inventory.reverseStockTransfer"),
            description: t("inventory.reverseStockTransferDescription"),
            onConfirm: async () => {
                try {
                    const response = await fetch(`/api/stock-transfers/${transfer.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reverse" }),
                    });

                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(
                            typeof data.error === "string"
                                ? tt(data.error)
                                : t("inventory.failedToReverseTransfer")
                        );
                    }

                    toast.success(t("inventory.transferReversed"));
                    fetchTransfers();
                } catch (error) {
                    toast.error(error instanceof Error ? tt(error.message) : t("inventory.failedToReverseTransfer"));
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
                    <h2 className="text-2xl font-bold text-slate-900">{t("inventory.stockTransfers")}</h2>
                    <p className="text-slate-500">{t("inventory.stockTransfersDescription")}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t("inventory.searchTransfers")}
                            className="pl-10"
                        />
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t("inventory.newTransfer")}
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
                                        <h3 className="mt-4 text-lg font-semibold">{t("inventory.noStockTransfersFound")}</h3>
                                        <p className="text-sm text-slate-500">
                                            {search ? t("inventory.tryDifferentSearchTerm") : t("inventory.completeFirstStockTransfer")}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-3 sm:hidden">
                                            {filteredTransfers.map((transfer) => (
                                                <div key={transfer.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-mono text-sm font-semibold text-slate-900">{transfer.transferNumber}</p>
                                                            <p className="mt-1 text-sm text-slate-500">
                                                                {formatDate(transfer.transferDate)}
                                                            </p>
                                                        </div>
                                                        <Badge className={statusColors[transfer.status] || ""}>
                                                            {formatTransferStatus(transfer.status)}
                                                        </Badge>
                                                    </div>

                                                    <div className="mt-4 grid gap-3 text-sm">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.from")}</p>
                                                            <p className="mt-1 text-slate-900">{transfer.sourceBranch.name}</p>
                                                            <p className="text-xs text-slate-500">{transfer.sourceWarehouse.name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.to")}</p>
                                                            <p className="mt-1 text-slate-900">{transfer.destinationBranch.name}</p>
                                                            <p className="text-xs text-slate-500">{transfer.destinationWarehouse.name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("inventory.itemsLabel")}</p>
                                                            <p className="mt-1 font-medium text-slate-900">
                                                                {new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US").format(transfer._count?.items || 0)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 grid gap-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <Button variant="outline" className="min-h-[44px]" asChild>
                                                                <Link href={`/inventory/stock-transfers/${transfer.id}`}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    {t("inventory.openAction")}
                                                                </Link>
                                                            </Button>
                                                            <Button variant="outline" className="min-h-[44px]" asChild>
                                                                <Link
                                                                    href={`/api/stock-transfers/${transfer.id}/pdf?download=0`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <Printer className="mr-2 h-4 w-4" />
                                                                    {t("inventory.printAction")}
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                        {transfer.status === "COMPLETED" && (
                                                            <Button
                                                                variant="outline"
                                                                className="min-h-[44px]"
                                                                onClick={() => reverseTransfer(transfer)}
                                                            >
                                                                <RotateCcw className="mr-2 h-4 w-4 text-amber-600" />
                                                                {t("inventory.reverseTransfer")}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="hidden sm:block">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>{t("inventory.transferNumberLabel")}</TableHead>
                                                        <TableHead>{t("common.from")}</TableHead>
                                                        <TableHead>{t("common.to")}</TableHead>
                                                        <TableHead>{t("inventory.itemsLabel")}</TableHead>
                                                        <TableHead>{t("common.date")}</TableHead>
                                                        <TableHead>{t("common.status")}</TableHead>
                                                        <TableHead className="text-right">{t("common.actions")}</TableHead>
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
                                                            <TableCell>
                                                                {new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US").format(transfer._count?.items || 0)}
                                                            </TableCell>
                                                            <TableCell>{formatDate(transfer.transferDate)}</TableCell>
                                                            <TableCell>
                                                                <Badge className={statusColors[transfer.status] || ""}>
                                                                    {formatTransferStatus(transfer.status)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="outline" size="sm" asChild>
                                                                        <Link href={`/inventory/stock-transfers/${transfer.id}`}>
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            {t("inventory.openAction")}
                                                                        </Link>
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" asChild>
                                                                        <Link
                                                                            href={`/api/stock-transfers/${transfer.id}/pdf?download=0`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                        >
                                                                            <Printer className="mr-2 h-4 w-4" />
                                                                            {t("inventory.printAction")}
                                                                        </Link>
                                                                    </Button>
                                                                    {transfer.status === "COMPLETED" && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => reverseTransfer(transfer)}
                                                                            title={t("inventory.reverseTransfer")}
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
                                        </div>
                                    </>
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
                    <DialogContent className="max-w-2xl">
                        <DialogHeader className="pr-12">
                            <DialogTitle>{t("inventory.newStockTransfer")}</DialogTitle>
                            <DialogDescription>
                                {t("inventory.newStockTransferDescription")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-2 sm:py-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>{t("inventory.sourceWarehouseLabel")} *</Label>
                                    <Select value={form.sourceWarehouseId} onValueChange={handleSourceWarehouseChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t("inventory.selectSourceWarehouse")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses.map((warehouse) => (
                                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                                    {warehouse.branch.name} {"→"} {warehouse.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>{t("inventory.destinationWarehouseLabel")} *</Label>
                                    <Select
                                        value={form.destinationWarehouseId}
                                        onValueChange={(value) => setForm((current) => ({ ...current, destinationWarehouseId: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t("inventory.selectDestinationWarehouse")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {warehouses
                                                .filter((warehouse) => warehouse.id !== form.sourceWarehouseId)
                                                .map((warehouse) => (
                                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                                        {warehouse.branch.name} {"→"} {warehouse.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>{t("common.notes")}</Label>
                                <Input
                                    value={form.notes}
                                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                    placeholder={t("inventory.optionalTransferNotes")}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>{t("inventory.itemsLabel")} *</Label>
                                    <Button variant="outline" size="sm" onClick={addItem}>
                                        <Plus className="mr-1 h-3 w-3" />
                                        {t("inventory.addItem")}
                                    </Button>
                                </div>

                                {form.items.map((item, index) => {
                                    const selectedProduct = products.find((product) => product.id === item.productId);
                                    return (
                                        <div key={index} className="space-y-3 rounded-lg border p-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">{t("common.product")}</Label>
                                                    <Select
                                                        value={item.productId}
                                                        onValueChange={(value) => updateItem(index, "productId", value)}
                                                        disabled={!form.sourceWarehouseId || loadingProducts}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                placeholder={form.sourceWarehouseId
                                                                    ? t("inventory.selectProduct")
                                                                    : t("inventory.selectSourceWarehouseFirst")}
                                                            />
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
                                                                    {` - ${t("inventory.availableStock")}: ${Number(product.availableStock || 0)}`}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="w-full space-y-1 sm:w-28">
                                                    <Label className="text-xs">{t("common.quantity")}</Label>
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
                                                    {t("inventory.availableInSourceWarehouse")}: {Number(selectedProduct.availableStock || 0)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {t("common.cancel")}
                            </Button>
                            <Button onClick={saveTransfer} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("inventory.completeTransfer")}
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
