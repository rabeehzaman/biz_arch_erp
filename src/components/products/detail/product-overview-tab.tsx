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
import { useEdition } from "@/hooks/use-edition";
import { format } from "date-fns";
import {
  Package, FileText, ShoppingCart, Archive, Clock, Barcode, Tag, Layers,
} from "lucide-react";

interface ProductOverview {
  product: {
    id: string; name: string; arabicName: string | null; description: string | null;
    sku: string | null; barcode: string | null; hsnCode: string | null;
    price: number; cost: number; gstRate: number;
    isService: boolean; isImeiTracked: boolean; isBundle: boolean;
    weighMachineCode: string | null; isActive: boolean; createdAt: string;
    category: { id: string; name: string } | null;
    unit: { id: string; code: string; name: string } | null;
    bundleItems: Array<{ id: string; quantity: number; componentProduct: { id: string; name: string; unit: { code: string } | null } }>;
  };
  stock: {
    totalOnHand: number; totalValue: number;
    byWarehouse: Array<{ warehouseId: string | null; warehouseName: string; quantity: number; value: number }>;
  };
  counts: { salesInvoiceItems: number; purchaseInvoiceItems: number; openingStocks: number };
  lastSaleDate: string | null;
  lastPurchaseDate: string | null;
}

export function ProductOverviewTab({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const { edition } = useEdition();
  const isSaudi = edition === "SAUDI";
  const [data, setData] = useState<ProductOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/overview`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch overview:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOverview();
  }, [productId]);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { product } = data;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left Column */}
      <div className="space-y-6 lg:col-span-3">
        {/* Product Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("productDetail.productInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {product.sku && <DetailRow label="SKU" value={product.sku} />}
              {product.barcode && <DetailRow label={t("common.barcode") || "Barcode"} value={product.barcode} />}
              {product.hsnCode && !isSaudi && <DetailRow label="HSN Code" value={product.hsnCode} />}
              {product.category && <DetailRow label={t("common.category") || "Category"} value={product.category.name} />}
              {product.unit && <DetailRow label={t("common.unit") || "Unit"} value={`${product.unit.name} (${product.unit.code})`} />}
              {product.arabicName && <DetailRow label={t("productDetail.arabicName") || "Arabic Name"} value={product.arabicName} dir="rtl" />}
              <DetailRow label={t("productDetail.createdOn") || "Created On"} value={format(new Date(product.createdAt), "dd MMM yyyy")} />
            </div>
            {product.description && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">{t("common.description")}</p>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("productDetail.pricingAndTax")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${!isSaudi ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <div>
                <p className="text-xs text-slate-500">{t("productDetail.sellingPrice")}</p>
                <p className="text-lg font-bold text-slate-900">{fmt(product.price)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t("productDetail.costPrice")}</p>
                <p className="text-lg font-bold text-slate-900">{fmt(product.cost)}</p>
              </div>
              {!isSaudi && (
                <div>
                  <p className="text-xs text-slate-500">GST Rate</p>
                  <p className="text-lg font-bold text-slate-900">{product.gstRate}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Type Badges */}
        {(product.isService || product.isBundle || product.isImeiTracked || product.weighMachineCode) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("productDetail.productType")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {product.isService && <Badge variant="info"><Tag className="mr-1 h-3 w-3" />Service</Badge>}
                {product.isBundle && <Badge variant="warning"><Layers className="mr-1 h-3 w-3" />Bundle/Kit</Badge>}
                {product.isImeiTracked && <Badge variant="secondary"><Barcode className="mr-1 h-3 w-3" />IMEI Tracked</Badge>}
                {product.weighMachineCode && <Badge variant="outline">Weigh Code: {product.weighMachineCode}</Badge>}
              </div>
              {product.isBundle && product.bundleItems.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Bundle Components</p>
                  <div className="space-y-2">
                    {product.bundleItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span>{item.componentProduct.name}</span>
                        <span className="text-slate-500">x{Number(item.quantity)} {item.componentProduct.unit?.code || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Stock Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("productDetail.stockSummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            {product.isService ? (
              <p className="text-sm text-slate-400">{t("productDetail.serviceNoInventory")}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t("productDetail.stockOnHand")}</span>
                  <span className="text-2xl font-bold text-slate-900">{data.stock.totalOnHand}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{t("productDetail.totalStockValue")}</span>
                  <span className="text-lg font-bold text-green-600">{fmt(data.stock.totalValue)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Warehouse */}
        {!product.isService && data.stock.byWarehouse.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("productDetail.stockByLocation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Warehouse</TableHead>
                    <TableHead className="text-right text-xs">Qty</TableHead>
                    <TableHead className="text-right text-xs">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stock.byWarehouse.map((wh) => (
                    <TableRow key={wh.warehouseId || "default"}>
                      <TableCell className="text-sm">{wh.warehouseName}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{wh.quantity}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(wh.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("productDetail.quickStats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatItem icon={FileText} label={t("productDetail.salesInvoices")} value={data.counts.salesInvoiceItems} />
              <StatItem icon={ShoppingCart} label={t("productDetail.purchaseInvoices")} value={data.counts.purchaseInvoiceItems} />
              <StatItem icon={Archive} label={t("productDetail.openingStocks") || "Opening Stocks"} value={data.counts.openingStocks} />
              <StatItem icon={Package} label={t("common.total") || "Total"} value={data.counts.salesInvoiceItems + data.counts.purchaseInvoiceItems} />
            </div>
            <div className="mt-4 space-y-2 border-t pt-3">
              {data.lastSaleDate && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{t("productDetail.lastSale") || "Last Sale"}: {format(new Date(data.lastSaleDate), "dd MMM yyyy")}</span>
                </div>
              )}
              {data.lastPurchaseDate && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{t("productDetail.lastPurchase") || "Last Purchase"}: {format(new Date(data.lastPurchaseDate), "dd MMM yyyy")}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900" dir={dir}>{value}</p>
    </div>
  );
}

function StatItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
