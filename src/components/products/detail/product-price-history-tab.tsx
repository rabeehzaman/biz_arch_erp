"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

interface PriceHistory {
  cost: number;
  currentPrice: number;
  recentSales: Array<{
    customerName: string; unitPrice: number; discount: number;
    date: string; invoiceNumber: string;
  }>;
  recentPurchases: Array<{
    supplierName: string; unitCost: number; discount: number;
    date: string; invoiceNumber: string;
  }>;
  stats: { avgSalePrice: number; minSalePrice: number; maxSalePrice: number };
}

export function ProductPriceHistoryTab({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const [data, setData] = useState<PriceHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/price-history`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch price history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPriceHistory();
  }, [productId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Price Statistics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={t("productDetail.sellingPrice")} value={fmt(data.currentPrice)} icon={TrendingUp} color="text-blue-600" />
        <StatCard label={t("productDetail.costPrice")} value={fmt(data.cost)} icon={TrendingDown} color="text-slate-600" />
        <StatCard label={t("productDetail.avgSalePrice")} value={fmt(data.stats.avgSalePrice)} icon={BarChart3} color="text-green-600" />
        <StatCard label={t("productDetail.minSalePrice")} value={fmt(data.stats.minSalePrice)} icon={TrendingDown} color="text-amber-600" />
        <StatCard label={t("productDetail.maxSalePrice")} value={fmt(data.stats.maxSalePrice)} icon={TrendingUp} color="text-emerald-600" />
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("productDetail.recentSales")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No recent sales</p>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {data.recentSales.map((sale, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{sale.invoiceNumber}</span>
                      <span className="font-semibold text-green-600">{fmt(sale.unitPrice)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{format(new Date(sale.date), "dd MMM yyyy")}</span>
                      <span>{sale.customerName}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentSales.map((sale, i) => (
                      <TableRow key={i}>
                        <TableCell>{format(new Date(sale.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono">{sale.invoiceNumber}</TableCell>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">{fmt(sale.unitPrice)}</TableCell>
                        <TableCell className="text-right">{sale.discount > 0 ? fmt(sale.discount) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Purchases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("productDetail.recentPurchases")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentPurchases.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No recent purchases</p>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {data.recentPurchases.map((purchase, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{purchase.invoiceNumber}</span>
                      <span className="font-semibold">{fmt(purchase.unitCost)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{format(new Date(purchase.date), "dd MMM yyyy")}</span>
                      <span>{purchase.supplierName}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentPurchases.map((purchase, i) => (
                      <TableRow key={i}>
                        <TableCell>{format(new Date(purchase.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono">{purchase.invoiceNumber}</TableCell>
                        <TableCell>{purchase.supplierName}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(purchase.unitCost)}</TableCell>
                        <TableCell className="text-right">{purchase.discount > 0 ? fmt(purchase.discount) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
