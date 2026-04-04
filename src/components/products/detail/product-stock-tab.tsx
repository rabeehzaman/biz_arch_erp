"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { format } from "date-fns";
import { Package, Archive } from "lucide-react";

interface StockData {
  stockLots: Array<{
    id: string; sourceType: string; lotDate: string; unitCost: number;
    initialQuantity: number; remainingQuantity: number;
    warehouseName: string; sourceReference: string;
  }>;
  openingStocks: Array<{
    id: string; quantity: number; unitCost: number; stockDate: string;
    notes: string | null; warehouseName: string;
  }>;
  summary: {
    totalOnHand: number; totalValue: number; lotCount: number; depletedLotCount: number;
  };
  defaultUnit: {
    unitName: string; unitCode: string; conversionFactor: number;
  } | null;
}

const sourceTypeBadge: Record<string, { variant: "default" | "secondary" | "outline" | "success" | "warning" | "info"; label: string }> = {
  PURCHASE: { variant: "info", label: "Purchase" },
  OPENING_STOCK: { variant: "secondary", label: "Opening Stock" },
  ADJUSTMENT: { variant: "warning", label: "Adjustment" },
  CREDIT_NOTE: { variant: "success", label: "Credit Note" },
  STOCK_TRANSFER: { variant: "outline", label: "Transfer" },
};

export function ProductStockTab({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const [data, setData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/stock`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch stock:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStock();
  }, [productId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const du = data.defaultUnit;
  const factor = du ? du.conversionFactor : 1;
  const fmtQty = (qty: number) => (qty / factor).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const unitLabel = du ? du.unitCode : null;

  const activeLots = data.stockLots.filter((l) => l.remainingQuantity > 0);
  const depletedLots = data.stockLots.filter((l) => l.remainingQuantity === 0);

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">
            {fmtQty(data.summary.totalOnHand)}
            {unitLabel && <span className="ml-1 text-sm font-normal text-slate-400">{unitLabel}</span>}
          </p>
          <p className="text-xs text-slate-500">{t("productDetail.stockOnHand")}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{fmt(data.summary.totalValue)}</p>
          <p className="text-xs text-slate-500">{t("productDetail.totalStockValue")}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{activeLots.length}</p>
          <p className="text-xs text-slate-500">Active Lots</p>
        </div>
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">{depletedLots.length}</p>
          <p className="text-xs text-slate-500">{t("productDetail.depletedLots")}</p>
        </div>
      </div>

      {/* Stock Lots */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">{t("productDetail.stockLots")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {data.stockLots.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t("productDetail.noStockLots")}</p>
          ) : (
            <>
              {/* Mobile */}
              <div className="space-y-3 sm:hidden">
                {activeLots.map((lot) => (
                  <div key={lot.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={sourceTypeBadge[lot.sourceType]?.variant || "secondary"} className="text-xs">
                        {sourceTypeBadge[lot.sourceType]?.label || lot.sourceType}
                      </Badge>
                      <span className="font-semibold">
                        {fmtQty(lot.remainingQuantity)} / {fmtQty(lot.initialQuantity)}
                        {unitLabel && <span className="ml-1 text-xs text-slate-400">{unitLabel}</span>}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{format(new Date(lot.lotDate), "dd MMM yyyy")}</span>
                      <span>{lot.warehouseName}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{lot.sourceReference}</span>
                      <span>{fmt(lot.unitCost * factor)} / {unitLabel || "unit"}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("productDetail.lotDate")}</TableHead>
                      <TableHead>{t("productDetail.sourceType")}</TableHead>
                      <TableHead>{t("productDetail.sourceRef")}</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">{t("productDetail.unitCost")}</TableHead>
                      <TableHead className="text-right">{t("productDetail.initialQty")}</TableHead>
                      <TableHead className="text-right">{t("productDetail.remainingQty")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>{format(new Date(lot.lotDate), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={sourceTypeBadge[lot.sourceType]?.variant || "secondary"} className="text-xs">
                            {sourceTypeBadge[lot.sourceType]?.label || lot.sourceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{lot.sourceReference}</TableCell>
                        <TableCell>{lot.warehouseName}</TableCell>
                        <TableCell className="text-right">{fmt(lot.unitCost * factor)}</TableCell>
                        <TableCell className="text-right">{fmtQty(lot.initialQuantity)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtQty(lot.remainingQuantity)}</TableCell>
                      </TableRow>
                    ))}
                    {depletedLots.length > 0 && (
                      <>
                        <TableRow>
                          <TableCell colSpan={7} className="bg-slate-50 text-center text-xs text-slate-400 py-2">
                            {t("productDetail.depletedLots")} ({depletedLots.length})
                          </TableCell>
                        </TableRow>
                        {depletedLots.map((lot) => (
                          <TableRow key={lot.id} className="opacity-50">
                            <TableCell>{format(new Date(lot.lotDate), "dd MMM yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant={sourceTypeBadge[lot.sourceType]?.variant || "secondary"} className="text-xs">
                                {sourceTypeBadge[lot.sourceType]?.label || lot.sourceType}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{lot.sourceReference}</TableCell>
                            <TableCell>{lot.warehouseName}</TableCell>
                            <TableCell className="text-right">{fmt(lot.unitCost * factor)}</TableCell>
                            <TableCell className="text-right">{fmtQty(lot.initialQuantity)}</TableCell>
                            <TableCell className="text-right line-through">0</TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Opening Stock Entries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-base">{t("productDetail.openingStockEntries")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {data.openingStocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t("productDetail.noOpeningStock")}</p>
          ) : (
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">{t("productDetail.unitCost")}</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>{t("common.notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.openingStocks.map((os) => (
                    <TableRow key={os.id}>
                      <TableCell>{format(new Date(os.stockDate), "dd MMM yyyy")}</TableCell>
                      <TableCell>{os.warehouseName}</TableCell>
                      <TableCell className="text-right">{fmtQty(os.quantity)}</TableCell>
                      <TableCell className="text-right">{fmt(os.unitCost * factor)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(os.quantity * os.unitCost)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-500">{os.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
