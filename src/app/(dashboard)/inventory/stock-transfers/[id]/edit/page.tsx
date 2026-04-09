"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageAnimation } from "@/components/ui/page-animation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
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

interface Product {
    id: string;
    name: string;
    sku: string | null;
    availableStock: number;
}

interface FormItem {
    productId: string;
    quantity: number;
}

export default function EditStockTransferPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const { t, tt } = useLanguage();

    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingPage, setLoadingPage] = useState(true);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [saving, setSaving] = useState(false);

    const [sourceWarehouseId, setSourceWarehouseId] = useState("");
    const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
    const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<FormItem[]>([{ productId: "", quantity: 1 }]);
    const [transferStatus, setTransferStatus] = useState("");
    const [transferNumber, setTransferNumber] = useState("");

    const fetchProducts = useCallback(async (warehouseId: string) => {
        setLoadingProducts(true);
        try {
            const params = new URLSearchParams({ compact: "true", excludeServices: "true", warehouseId });
            const res = await fetch(`/api/products?${params}`);
            if (!res.ok) throw new Error();
            setProducts(await res.json());
        } catch {
            toast.error(t("inventory.failedToLoadProducts"));
        } finally {
            setLoadingProducts(false);
        }
    }, [t]);

    useEffect(() => {
        const load = async () => {
            try {
                const [transferRes, warehousesRes] = await Promise.all([
                    fetch(`/api/stock-transfers/${id}`),
                    fetch("/api/warehouses"),
                ]);

                if (!transferRes.ok) throw new Error("Transfer not found");
                const transfer = await transferRes.json();

                if (!["DRAFT", "APPROVED", "COMPLETED"].includes(transfer.status)) {
                    toast.error(t("inventory.cannotEditTransferStatus"));
                    router.push(`/inventory/stock-transfers/${id}`);
                    return;
                }

                const warehouseData = await warehousesRes.json();
                setWarehouses(warehouseData.filter((w: Warehouse) => w.isActive));

                setTransferStatus(transfer.status);
                setTransferNumber(transfer.transferNumber);
                setSourceWarehouseId(transfer.sourceWarehouse.id);
                setDestinationWarehouseId(transfer.destinationWarehouse.id);
                setTransferDate(transfer.transferDate.slice(0, 10));
                setNotes(transfer.notes || "");
                setItems(
                    transfer.items.length > 0
                        ? [
                            ...transfer.items.map((item: any) => ({
                                productId: item.product.id,
                                quantity: Number(item.quantity),
                            })),
                            { productId: "", quantity: 1 }, // trailing empty row
                          ]
                        : [{ productId: "", quantity: 1 }]
                );

                // Load products for source warehouse
                await fetchProducts(transfer.sourceWarehouse.id);
            } catch {
                toast.error(t("inventory.failedToLoadStockTransfers"));
                router.push("/inventory/stock-transfers");
            } finally {
                setLoadingPage(false);
            }
        };
        load();
    }, [id, router, t, fetchProducts]);

    useEffect(() => {
        if (sourceWarehouseId && !loadingPage) {
            fetchProducts(sourceWarehouseId);
        }
    }, [sourceWarehouseId, loadingPage, fetchProducts]);

    const handleSourceWarehouseChange = (value: string) => {
        setSourceWarehouseId(value);
        if (destinationWarehouseId === value) setDestinationWarehouseId("");
        setItems([{ productId: "", quantity: 1 }]);
    };

    const addItem = () => {
        setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
    };

    const removeItem = (index: number) => {
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof FormItem, value: string | number) => {
        setItems((prev) => {
            const isLast = index === prev.length - 1;
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            // Auto-add new empty row when product selected on last row
            if (field === "productId" && value && isLast) {
                next.push({ productId: "", quantity: 1 });
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!sourceWarehouseId || !destinationWarehouseId) {
            toast.error(t("inventory.selectSourceAndDestinationWarehouses"));
            return;
        }
        if (sourceWarehouseId === destinationWarehouseId) {
            toast.error(t("inventory.sourceAndDestinationMustBeDifferent"));
            return;
        }

        const validItems = items.filter((item) => item.productId && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error(t("inventory.addAtLeastOneItem"));
            return;
        }

        const unavailableItem = validItems.find((item) => {
            const product = products.find((p) => p.id === item.productId);
            return product && item.quantity > Number(product.availableStock || 0);
        });
        if (unavailableItem) {
            const product = products.find((p) => p.id === unavailableItem.productId);
            toast.error(
                `${t("inventory.requestedQuantityExceedsAvailableStock")} ${product?.name || t("inventory.selectedProduct")}`
            );
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/stock-transfers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceWarehouseId,
                    destinationWarehouseId,
                    transferDate,
                    notes: notes || null,
                    items: validItems,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(typeof data.error === "string" ? tt(data.error) : t("inventory.failedToCompleteTransfer"));
            }

            toast.success(t("inventory.transferUpdated"));
            router.push(`/inventory/stock-transfers/${id}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("inventory.failedToCompleteTransfer"));
        } finally {
            setSaving(false);
        }
    };

    const totalItems = items.filter((i) => i.productId && i.quantity > 0).length;
    const totalQuantity = items.reduce((sum, i) => (i.productId ? sum + (Number(i.quantity) || 0) : sum), 0);

    if (loadingPage) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <PageAnimation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0 rounded-full">
                        <Link href={`/inventory/stock-transfers/${id}`}>
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {t("inventory.editTransfer")} {transferNumber}
                        </h1>
                        <p className="text-sm text-slate-500">
                    {transferStatus === "COMPLETED"
                        ? t("inventory.editCompletedTransferDescription")
                        : t("inventory.editTransferDescription")}
                </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Main form */}
                    <div className="space-y-6 lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t("inventory.transferDetails")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>{t("inventory.sourceWarehouseLabel")} *</Label>
                                        <Select value={sourceWarehouseId} onValueChange={handleSourceWarehouseChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t("inventory.selectSourceWarehouse")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses.map((w) => (
                                                    <SelectItem key={w.id} value={w.id}>
                                                        {w.branch.name} {"→"} {w.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t("inventory.destinationWarehouseLabel")} *</Label>
                                        <Select
                                            value={destinationWarehouseId}
                                            onValueChange={setDestinationWarehouseId}
                                            disabled={!sourceWarehouseId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t("inventory.selectDestinationWarehouse")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {warehouses
                                                    .filter((w) => w.id !== sourceWarehouseId)
                                                    .map((w) => (
                                                        <SelectItem key={w.id} value={w.id}>
                                                            {w.branch.name} {"→"} {w.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>{t("common.date")}</Label>
                                        <Input
                                            type="date"
                                            value={transferDate}
                                            onChange={(e) => setTransferDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>{t("common.notes")}</Label>
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder={t("inventory.optionalTransferNotes")}
                                        rows={2}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-base">{t("inventory.itemsLabel")} *</CardTitle>
                                <Button variant="outline" size="sm" onClick={addItem} disabled={!sourceWarehouseId}>
                                    <Plus className="mr-1 h-3 w-3" />
                                    {t("inventory.addItem")}
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {!sourceWarehouseId && (
                                    <p className="text-sm text-slate-400 py-4 text-center">
                                        {t("inventory.selectSourceWarehouseFirst")}
                                    </p>
                                )}

                                {sourceWarehouseId && loadingProducts && (
                                    <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t("inventory.loadingProducts")}
                                    </div>
                                )}

                                {sourceWarehouseId && !loadingProducts && items.map((item, index) => {
                                    const selectedProduct = products.find((p) => p.id === item.productId);
                                    return (
                                        <div key={index} className="rounded-lg border p-3 space-y-2">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">{t("common.product")}</Label>
                                                    <Select
                                                        value={item.productId}
                                                        onValueChange={(v) => updateItem(index, "productId", v)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t("inventory.selectProduct")} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map((p) => (
                                                                <SelectItem
                                                                    key={p.id}
                                                                    value={p.id}
                                                                    disabled={Number(p.availableStock || 0) <= 0}
                                                                >
                                                                    {p.name}
                                                                    {p.sku ? ` (${p.sku})` : ""}
                                                                    {` — ${t("inventory.availableStock")}: ${Number(p.availableStock || 0)}`}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="w-full space-y-1 sm:w-28">
                                                    <Label className="text-xs">{t("common.quantity")}</Label>
                                                    <Input
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                                                    />
                                                </div>

                                                {items.length > 1 && (
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
                                                    {item.quantity > Number(selectedProduct.availableStock || 0) && (
                                                        <span className="ml-2 text-red-500 font-medium">
                                                            ({t("inventory.requestedQuantityExceedsAvailableStock")})
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{t("inventory.transferSummary")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">{t("inventory.itemsLabel")}</span>
                                    <span className="font-medium">{totalItems}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">{t("common.quantity")}</span>
                                    <span className="font-medium">{totalQuantity}</span>
                                </div>
                                {sourceWarehouseId && (
                                    <div className="border-t pt-3">
                                        <p className="text-xs text-slate-400 mb-1">{t("common.from")}</p>
                                        <p className="font-medium">
                                            {warehouses.find((w) => w.id === sourceWarehouseId)?.name || "—"}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {warehouses.find((w) => w.id === sourceWarehouseId)?.branch.name}
                                        </p>
                                    </div>
                                )}
                                {destinationWarehouseId && (
                                    <div className="border-t pt-3">
                                        <p className="text-xs text-slate-400 mb-1">{t("common.to")}</p>
                                        <p className="font-medium">
                                            {warehouses.find((w) => w.id === destinationWarehouseId)?.name || "—"}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {warehouses.find((w) => w.id === destinationWarehouseId)?.branch.name}
                                        </p>
                                    </div>
                                )}
                                {transferStatus === "COMPLETED" && (
                                    <div className="border-t pt-3 text-xs text-amber-600 bg-amber-50 rounded p-2">
                                        {t("inventory.editCompletedTransferWarning")}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="flex flex-col gap-2">
                            <Button onClick={handleSubmit} disabled={saving} className="w-full">
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t("inventory.saveTransfer")}
                            </Button>
                            <Button variant="outline" asChild className="w-full">
                                <Link href={`/inventory/stock-transfers/${id}`}>
                                    {t("common.cancel")}
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </PageAnimation>
    );
}
