"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { PageAnimation } from "@/components/ui/page-animation";
import { AttachmentDialog } from "@/components/attachments/attachment-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  ArrowLeft,
  Trash2,
  CheckCircle,
  Pencil,
  TrendingUp,
  TrendingDown,
  Clock,
  Loader2,
} from "lucide-react";

interface AdjustmentItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    unit: { name: string; code: string } | null;
  };
  systemQuantity: number;
  physicalQuantity: number;
  adjustmentType: "INCREASE" | "DECREASE";
  quantity: number;
  unitCost: number;
  reason: string | null;
}

interface Adjustment {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  notes: string | null;
  status: "DRAFT" | "RECONCILED";
  reconciledAt: string | null;
  warehouseId: string | null;
  warehouse: { id: string; name: string; code: string } | null;
  items: AdjustmentItem[];
}

export default function StockTakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { fmt } = useCurrency();
  const { t, tt } = useLanguage();

  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmReconcile, setConfirmReconcile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchAdjustment = useCallback(async () => {
    try {
      const response = await fetch(`/api/inventory-adjustments/${id}`);
      if (!response.ok) {
        throw new Error("Not found");
      }
      const data: Adjustment = await response.json();
      setAdjustment(data);
    } catch {
      toast.error(t("inventory.stockTake"));
      router.push("/inventory/adjustments");
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

  useEffect(() => {
    fetchAdjustment();
  }, [fetchAdjustment]);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const response = await fetch(`/api/inventory-adjustments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? tt(data.error)
            : t("inventory.reconcile")
        );
      }

      toast.success(t("inventory.stockTakeReconciled"));
      setLoading(true);
      fetchAdjustment();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("inventory.reconcile")
      );
    } finally {
      setReconciling(false);
      setConfirmReconcile(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/inventory-adjustments/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string"
            ? tt(data.error)
            : t("inventory.failedToDeleteStockTake")
        );
      }

      toast.success(t("inventory.stockTakeDeleted"));
      router.push("/inventory/adjustments");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("inventory.failedToDeleteStockTake")
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <PageAnimation>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/inventory/adjustments">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          </div>
          <Card>
            <CardContent className="p-6">
              <TableSkeleton columns={5} rows={3} />
            </CardContent>
          </Card>
        </div>
      </PageAnimation>
    );
  }

  if (!adjustment) {
    return null;
  }

  const isDraft = adjustment.status === "DRAFT";

  // Compute summary values
  const totalProducts = adjustment.items.length;
  const totalShortageValue = adjustment.items
    .filter((item) => item.adjustmentType === "DECREASE")
    .reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
  const totalSurplusValue = adjustment.items
    .filter((item) => item.adjustmentType === "INCREASE")
    .reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/inventory/adjustments">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">
                  {t("inventory.stockTake")} {adjustment.adjustmentNumber}
                </h2>
                <Badge
                  className={
                    isDraft
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }
                >
                  {isDraft ? (
                    <Clock className="mr-1 h-3 w-3" />
                  ) : (
                    <CheckCircle className="mr-1 h-3 w-3" />
                  )}
                  {isDraft
                    ? t("inventory.draft")
                    : t("inventory.reconciled")}
                </Badge>
              </div>
              <p className="text-slate-500">
                {format(new Date(adjustment.adjustmentDate), "dd MMM yyyy")}
                {adjustment.warehouse && (
                  <span className="ml-2 text-slate-400">
                    &middot; {adjustment.warehouse.name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Link href={`/inventory/adjustments/${id}/edit`}>
              <Button variant="outline" className="w-full sm:w-auto">
                <Pencil className="mr-2 h-4 w-4" />
                {t("common.edit")}
              </Button>
            </Link>
            {isDraft && (
              <Button
                onClick={() => setConfirmReconcile(true)}
                disabled={reconciling}
                className="w-full sm:w-auto"
              >
                {reconciling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {t("inventory.reconcile")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="w-full text-red-600 hover:text-red-700 sm:w-auto"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t("common.delete")}
            </Button>
            <AttachmentDialog documentType="inventory_adjustment" documentId={adjustment.id} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {t("inventory.countItems")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {totalProducts}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-red-600">
                <TrendingDown className="h-4 w-4" />
                {t("inventory.shortage")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-red-600">
              {fmt(totalShortageValue)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <TrendingUp className="h-4 w-4" />
                {t("inventory.surplus")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-green-600">
              {fmt(totalSurplusValue)}
            </CardContent>
          </Card>
        </div>

        {/* Detail card */}
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            {/* Header info */}
            <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("inventory.countDetails")}
                </h3>
                <p className="text-sm text-slate-500">
                  {t("inventory.stockTakeNumber")}: {adjustment.adjustmentNumber}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm text-slate-500">
                  {t("inventory.countDate")}
                </div>
                <div className="font-semibold">
                  {format(new Date(adjustment.adjustmentDate), "dd MMM yyyy")}
                </div>
                {adjustment.reconciledAt && (
                  <div className="mt-1 text-xs text-slate-400">
                    {t("inventory.reconciled")}:{" "}
                    {format(new Date(adjustment.reconciledAt), "dd MMM yyyy")}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {adjustment.notes && (
              <div className="rounded-lg border p-4">
                <div className="text-sm font-semibold text-slate-500">
                  {t("common.notes")}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {adjustment.notes}
                </p>
              </div>
            )}

            {/* Items */}
            <div className="space-y-3">
              <div className="text-lg font-semibold text-slate-900">
                {t("inventory.countItems")}
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 sm:hidden">
                {adjustment.items.map((item) => {
                  const diff =
                    Number(item.physicalQuantity) - Number(item.systemQuantity);

                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border p-4 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-900">
                          {item.product.name}
                        </div>
                        {diff > 0 ? (
                          <Badge className="bg-green-100 text-green-800">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            +{diff}
                          </Badge>
                        ) : diff < 0 ? (
                          <Badge className="bg-red-100 text-red-800">
                            <TrendingDown className="mr-1 h-3 w-3" />
                            {diff}
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">
                            {t("inventory.noChange")}
                          </Badge>
                        )}
                      </div>
                      {item.product.sku && (
                        <div className="mt-1 text-xs text-slate-500">
                          SKU: {item.product.sku}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-3 text-slate-600">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            {t("inventory.systemQty")}
                          </div>
                          <div className="font-medium text-slate-900">
                            {Number(item.systemQuantity)}
                            {item.product.unit
                              ? ` ${item.product.unit.code}`
                              : ""}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            {t("inventory.physicalQty")}
                          </div>
                          <div className="font-medium text-slate-900">
                            {Number(item.physicalQuantity)}
                            {item.product.unit
                              ? ` ${item.product.unit.code}`
                              : ""}
                          </div>
                        </div>
                      </div>

                      {item.reason && (
                        <div className="mt-3 border-t pt-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">
                            {t("inventory.reason")}
                          </div>
                          <div className="mt-0.5 text-slate-700">
                            {item.reason}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.product")}</TableHead>
                      <TableHead className="text-right">
                        {t("inventory.systemQty")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("inventory.physicalQty")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("inventory.difference")}
                      </TableHead>
                      <TableHead>{t("inventory.reason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustment.items.map((item) => {
                      const diff =
                        Number(item.physicalQuantity) -
                        Number(item.systemQuantity);

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">
                              {item.product.name}
                            </div>
                            {item.product.sku && (
                              <div className="text-xs text-slate-500">
                                SKU: {item.product.sku}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.systemQuantity)}
                            {item.product.unit
                              ? ` ${item.product.unit.code}`
                              : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.physicalQuantity)}
                            {item.product.unit
                              ? ` ${item.product.unit.code}`
                              : ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {diff > 0 ? (
                              <span className="font-medium text-green-600">
                                +{diff}
                              </span>
                            ) : diff < 0 ? (
                              <span className="font-medium text-red-600">
                                {diff}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {item.reason || "\u2014"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Count Summary */}
            <div className="flex justify-end border-t pt-4">
              <div className="w-full space-y-2 sm:w-72">
                <div className="text-sm font-semibold text-slate-900 mb-3">
                  {t("inventory.countSummary")}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {t("inventory.countItems")}
                  </span>
                  <span className="font-medium">{totalProducts}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="h-3 w-3" />
                    {t("inventory.shortage")}
                  </span>
                  <span className="font-medium text-red-600">
                    {fmt(totalShortageValue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-3 w-3" />
                    {t("inventory.surplus")}
                  </span>
                  <span className="font-medium text-green-600">
                    {fmt(totalSurplusValue)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reconcile Confirm Dialog */}
        <ConfirmDialog
          open={confirmReconcile}
          onOpenChange={setConfirmReconcile}
          title={t("inventory.reconcile")}
          description={t("inventory.reconcileConfirm")}
          confirmLabel={t("inventory.reconcile")}
          onConfirm={handleReconcile}
          variant="default"
        />

        {/* Delete Confirm Dialog */}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("inventory.deleteStockTake")}
          description={t("inventory.deleteStockTakeConfirm")}
          onConfirm={handleDelete}
          variant="destructive"
        />
      </div>
    </PageAnimation>
  );
}
