"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";

interface PriceHistoryData {
  cost: number;
  currentPrice: number;
  defaultUnitName?: string | null;
  lastSaleToCustomer: {
    unitPrice: number;
    discount: number;
    date: string;
    invoiceNumber: string;
  } | null;
  recentSales: {
    customerName: string;
    unitPrice: number;
    discount: number;
    date: string;
    invoiceNumber: string;
  }[];
  recentPurchases: {
    supplierName: string;
    unitCost: number;
    discount: number;
    date: string;
    invoiceNumber: string;
  }[];
  stats: {
    avgSalePrice: number;
    minSalePrice: number;
    maxSalePrice: number;
  };
}

interface PriceHistoryDialogProps {
  productId: string;
  productName: string;
  customerId?: string;
  customerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceHistoryDialog({
  productId,
  productName,
  customerId,
  customerName,
  open,
  onOpenChange,
}: PriceHistoryDialogProps) {
  const [data, setData] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    if (!open || !productId) return;
    setLoading(true);
    setData(null);

    const params = new URLSearchParams();
    if (customerId) params.set("customerId", customerId);

    fetch(`/api/products/${productId}/price-history?${params}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, productId, customerId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const margin =
    data && data.cost > 0
      ? (((data.currentPrice - data.cost) / data.cost) * 100).toFixed(1)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{productName} — {t("sales.priceHistory")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-32" />
          </div>
        ) : data ? (
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">{t("common.overview")}</TabsTrigger>
              <TabsTrigger value="sales" className="flex-1">{t("common.salesHistory")}</TabsTrigger>
              <TabsTrigger value="purchases" className="flex-1">{t("common.purchaseHistory")}</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">{t("common.costPrice")}{data.defaultUnitName && <span className="text-slate-400"> /{data.defaultUnitName}</span>}</p>
                  <p className="text-lg font-semibold">{fmt(data.cost)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">{t("common.sellingPrice")}{data.defaultUnitName && <span className="text-slate-400"> /{data.defaultUnitName}</span>}</p>
                  <p className="text-lg font-semibold">{fmt(data.currentPrice)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">{t("common.margin")}</p>
                  <p className="text-lg font-semibold">
                    {margin !== null ? `${margin}%` : "—"}
                  </p>
                </div>
              </div>

              {customerId && customerName && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">
                    {t("sales.lastSaleTo")} {customerName}
                  </p>
                  {data.lastSaleToCustomer ? (
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-semibold text-blue-900">
                        {fmt(data.lastSaleToCustomer.unitPrice)}
                      </span>
                      {data.lastSaleToCustomer.discount > 0 && (
                        <span className="text-sm text-blue-600">
                          (-{data.lastSaleToCustomer.discount}%)
                        </span>
                      )}
                      <span className="text-xs text-blue-500">
                        {formatDate(data.lastSaleToCustomer.date)} · #{data.lastSaleToCustomer.invoiceNumber}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-blue-600">{t("sales.noSalesToCustomer")}</p>
                  )}
                </div>
              )}

              {data.stats.avgSalePrice > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500 mb-2">{t("sales.salePriceStats")}</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-slate-400">{t("common.average")}</p>
                      <p className="font-medium">{fmt(data.stats.avgSalePrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{t("common.minimum")}</p>
                      <p className="font-medium">{fmt(data.stats.minSalePrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{t("common.maximum")}</p>
                      <p className="font-medium">{fmt(data.stats.maxSalePrice)}</p>
                    </div>
                  </div>
                </div>
              )}

              {data.recentSales.length === 0 && data.recentPurchases.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  {t("sales.noPriceHistory")}
                </p>
              )}
            </TabsContent>

            {/* Sales History Tab */}
            <TabsContent value="sales" className="mt-4">
              {data.recentSales.length > 0 ? (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block rounded-lg border overflow-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs">{t("common.date")}</TableHead>
                          <TableHead className="text-xs">{t("common.customer")}</TableHead>
                          <TableHead className="text-xs text-right">{t("common.price")}</TableHead>
                          <TableHead className="text-xs text-right">{t("common.discountPercent")}</TableHead>
                          <TableHead className="text-xs">{t("common.invoiceHash")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentSales.map((sale, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{formatDate(sale.date)}</TableCell>
                            <TableCell className="text-xs">{sale.customerName}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(sale.unitPrice)}</TableCell>
                            <TableCell className="text-xs text-right">
                              {sale.discount > 0 ? `${sale.discount}%` : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{sale.invoiceNumber}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-slate-200 rounded-lg border">
                    {data.recentSales.map((sale, i) => (
                      <div key={i} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{sale.customerName}</span>
                          <span className="text-xs font-semibold">{fmt(sale.unitPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{formatDate(sale.date)}</span>
                          <span className="flex items-center gap-2">
                            {sale.discount > 0 && <span className="text-green-600">-{sale.discount}%</span>}
                            <span className="font-mono">#{sale.invoiceNumber}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">
                  {t("sales.noSalesHistory")}
                </p>
              )}
            </TabsContent>

            {/* Purchase History Tab */}
            <TabsContent value="purchases" className="mt-4">
              {data.recentPurchases.length > 0 ? (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block rounded-lg border overflow-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs">{t("common.date")}</TableHead>
                          <TableHead className="text-xs">{t("common.supplier")}</TableHead>
                          <TableHead className="text-xs text-right">{t("common.cost")}</TableHead>
                          <TableHead className="text-xs text-right">{t("common.discountPercent")}</TableHead>
                          <TableHead className="text-xs">{t("common.invoiceHash")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentPurchases.map((purchase, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{formatDate(purchase.date)}</TableCell>
                            <TableCell className="text-xs">{purchase.supplierName}</TableCell>
                            <TableCell className="text-xs text-right">{fmt(purchase.unitCost)}</TableCell>
                            <TableCell className="text-xs text-right">
                              {purchase.discount > 0 ? `${purchase.discount}%` : "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{purchase.invoiceNumber}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-slate-200 rounded-lg border">
                    {data.recentPurchases.map((purchase, i) => (
                      <div key={i} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{purchase.supplierName}</span>
                          <span className="text-xs font-semibold">{fmt(purchase.unitCost)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{formatDate(purchase.date)}</span>
                          <span className="flex items-center gap-2">
                            {purchase.discount > 0 && <span className="text-green-600">-{purchase.discount}%</span>}
                            <span className="font-mono">#{purchase.invoiceNumber}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">
                  {t("sales.noPurchaseHistory")}
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">
            {t("sales.failedToLoadPriceHistory")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
