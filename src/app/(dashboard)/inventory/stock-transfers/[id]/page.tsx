"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { PageAnimation } from "@/components/ui/page-animation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, Loader2, Printer, RotateCcw } from "lucide-react";

interface TransferItem {
    id: string;
    quantity: number | string;
    unitCost: number | string;
    notes: string | null;
    product: {
        id: string;
        name: string;
        sku: string | null;
    };
}

interface StockTransfer {
    id: string;
    transferNumber: string;
    status: string;
    transferDate: string;
    notes: string | null;
    createdAt: string;
    completedAt: string | null;
    reversedAt: string | null;
    cancelledAt: string | null;
    sourceBranch: { id: string; name: string };
    sourceWarehouse: { id: string; name: string };
    destinationBranch: { id: string; name: string };
    destinationWarehouse: { id: string; name: string };
    items: TransferItem[];
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

export default function StockTransferDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const { fmt } = useCurrency();
    const { t, tt, lang } = useLanguage();

    const [transfer, setTransfer] = useState<StockTransfer | null>(null);
    const [loading, setLoading] = useState(true);
    const [reversing, setReversing] = useState(false);
    const [confirmReverse, setConfirmReverse] = useState(false);

    const formatDate = (value: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));

    const formatDateTime = (value: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));

    const formatTransferStatus = (status: string) => {
        const key = transferStatusLabelKeys[status];
        return key ? t(key) : status.replaceAll("_", " ");
    };

    const fetchTransfer = useCallback(async () => {
        try {
            const response = await fetch(`/api/stock-transfers/${id}`);
            if (!response.ok) {
                throw new Error(t("inventory.transferNotFound"));
            }

            setTransfer(await response.json());
        } catch {
            toast.error(t("inventory.transferNotFound"));
            router.push("/inventory/stock-transfers");
        } finally {
            setLoading(false);
        }
    }, [id, router, t]);

    useEffect(() => {
        fetchTransfer();
    }, [fetchTransfer]);

    const handleReverse = async () => {
        if (!transfer) {
            return;
        }

        setReversing(true);
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
            setConfirmReverse(false);
            fetchTransfer();
        } catch (error) {
            toast.error(error instanceof Error ? tt(error.message) : t("inventory.failedToReverseTransfer"));
        } finally {
            setReversing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-slate-500">{t("common.loading")}</div>
            </div>
        );
    }

    if (!transfer) {
        return null;
    }

    const totalQuantity = transfer.items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalValue = transfer.items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitCost),
        0
    );

    return (
        <PageAnimation>
            <div className="space-y-6 print:space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                    <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/inventory/stock-transfers">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                                {t("inventory.stockTransfer")} {transfer.transferNumber}
                            </h2>
                            <p className="text-slate-500">
                                {t("inventory.recordedOn")} {formatDate(transfer.transferDate)}
                            </p>
                        </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                        {transfer.status === "COMPLETED" && (
                            <Button
                                variant="outline"
                                onClick={() => setConfirmReverse(true)}
                                disabled={reversing}
                                className="w-full sm:w-auto"
                            >
                                {reversing
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <RotateCcw className="mr-2 h-4 w-4" />}
                                {t("inventory.reverseTransfer")}
                            </Button>
                        )}
                        <Button variant="outline" asChild className="w-full sm:w-auto">
                            <Link
                                href={`/api/stock-transfers/${transfer.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                {t("inventory.downloadPdf")}
                            </Link>
                        </Button>
                        <Button variant="outline" asChild className="w-full sm:w-auto">
                            <Link
                                href={`/api/stock-transfers/${transfer.id}/pdf?download=0`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                {t("inventory.printPdf")}
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">{t("common.status")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Badge className={statusColors[transfer.status] || ""}>
                                {formatTransferStatus(transfer.status)}
                            </Badge>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">{t("inventory.totalQuantity")}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {totalQuantity.toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">{t("inventory.transferValue")}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-2xl font-semibold">
                            {fmt(totalValue)}
                        </CardContent>
                    </Card>
                </div>

                <Card className="print:shadow-none print:border-none">
                    <CardContent className="space-y-8 p-6 sm:p-8">
                        <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{t("inventory.transferNote")}</h1>
                                <p className="text-sm text-slate-500">{transfer.transferNumber}</p>
                            </div>
                            <div className="text-left sm:text-right">
                                <div className="text-sm text-slate-500">{t("inventory.transferDate")}</div>
                                <div className="font-semibold">{formatDate(transfer.transferDate)}</div>
                            </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2 rounded-lg border p-4">
                                <div className="text-sm font-semibold text-slate-500">{t("common.from")}</div>
                                <div className="text-lg font-semibold">{transfer.sourceWarehouse.name}</div>
                                <div className="text-sm text-slate-500">{transfer.sourceBranch.name}</div>
                            </div>

                            <div className="space-y-2 rounded-lg border p-4">
                                <div className="text-sm font-semibold text-slate-500">{t("common.to")}</div>
                                <div className="text-lg font-semibold">{transfer.destinationWarehouse.name}</div>
                                <div className="text-sm text-slate-500">{transfer.destinationBranch.name}</div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border p-4">
                                <div className="text-sm font-semibold text-slate-500">{t("inventory.created")}</div>
                                <div className="mt-1 font-medium">{formatDateTime(transfer.createdAt)}</div>
                            </div>
                            {transfer.completedAt && (
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-semibold text-slate-500">{t("inventory.completed")}</div>
                                    <div className="mt-1 font-medium">{formatDateTime(transfer.completedAt)}</div>
                                </div>
                            )}
                            {transfer.reversedAt && (
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-semibold text-slate-500">{t("inventory.reversed")}</div>
                                    <div className="mt-1 font-medium">{formatDateTime(transfer.reversedAt)}</div>
                                </div>
                            )}
                            {transfer.cancelledAt && (
                                <div className="rounded-lg border p-4">
                                    <div className="text-sm font-semibold text-slate-500">{t("inventory.cancelled")}</div>
                                    <div className="mt-1 font-medium">{formatDateTime(transfer.cancelledAt)}</div>
                                </div>
                            )}
                        </div>

                        {transfer.notes && (
                            <div className="rounded-lg border p-4">
                                <div className="text-sm font-semibold text-slate-500">{t("common.notes")}</div>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{transfer.notes}</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="text-lg font-semibold text-slate-900">{t("inventory.itemsLabel")}</div>
                            <div className="space-y-3 sm:hidden">
                                {transfer.items.map((item) => (
                                    <div key={item.id} className="rounded-lg border p-4 text-sm">
                                        <div className="font-medium text-slate-900">{item.product.name}</div>
                                        {item.product.sku && (
                                            <div className="mt-1 text-xs text-slate-500">{t("products.sku")}: {item.product.sku}</div>
                                        )}
                                        {item.notes && (
                                            <div className="mt-2 text-xs text-slate-500">{item.notes}</div>
                                        )}
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-slate-600">
                                            <div>
                                                <div className="text-xs uppercase tracking-wide text-slate-400">{t("common.quantity")}</div>
                                                <div className="font-medium text-slate-900">
                                                    {Number(item.quantity).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs uppercase tracking-wide text-slate-400">{t("inventory.unitCost")}</div>
                                                <div className="font-medium text-slate-900">{fmt(Number(item.unitCost))}</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between border-t pt-3">
                                            <span className="text-xs uppercase tracking-wide text-slate-400">{t("inventory.lineTotal")}</span>
                                            <span className="font-semibold text-slate-900">
                                                {fmt(Number(item.quantity) * Number(item.unitCost))}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="hidden sm:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t("common.product")}</TableHead>
                                            <TableHead className="text-right">{t("common.quantity")}</TableHead>
                                            <TableHead className="text-right">{t("inventory.unitCost")}</TableHead>
                                            <TableHead className="text-right">{t("inventory.lineTotal")}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transfer.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium">{item.product.name}</div>
                                                    {item.product.sku && (
                                                        <div className="text-xs text-slate-500">{t("products.sku")}: {item.product.sku}</div>
                                                    )}
                                                    {item.notes && (
                                                        <div className="mt-1 text-xs text-slate-500">{item.notes}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {Number(item.quantity).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {fmt(Number(item.unitCost))}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {fmt(Number(item.quantity) * Number(item.unitCost))}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <ConfirmDialog
                    open={confirmReverse}
                    onOpenChange={setConfirmReverse}
                    title={t("inventory.reverseStockTransfer")}
                    description={t("inventory.reverseStockTransferDescription")}
                    onConfirm={handleReverse}
                />
            </div>
        </PageAnimation>
    );
}
