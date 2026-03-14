"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    ArrowRightLeft, Eye, Plus, Printer, RotateCcw, Search,
} from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

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

    useEffect(() => {
        fetchTransfers();
    }, [fetchTransfers]);

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
                    <Button asChild>
                        <Link href="/inventory/stock-transfers/new">
                            <Plus className="mr-2 h-4 w-4" />
                            {t("inventory.newTransfer")}
                        </Link>
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
