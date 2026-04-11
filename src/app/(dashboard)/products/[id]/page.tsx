"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Pencil, Trash2, Ban, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageAnimation } from "@/components/ui/page-animation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

type DetailTab = "overview" | "transactions" | "stock" | "price-history";

function TabPanelFallback() {
  return (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

const OverviewTab = dynamic(
  () => import("@/components/products/detail/product-overview-tab").then((mod) => mod.ProductOverviewTab),
  { loading: () => <TabPanelFallback /> }
);
const TransactionsTab = dynamic(
  () => import("@/components/products/detail/product-transactions-tab").then((mod) => mod.ProductTransactionsTab),
  { loading: () => <TabPanelFallback /> }
);
const StockTab = dynamic(
  () => import("@/components/products/detail/product-stock-tab").then((mod) => mod.ProductStockTab),
  { loading: () => <TabPanelFallback /> }
);
const PriceHistoryTab = dynamic(
  () => import("@/components/products/detail/product-price-history-tab").then((mod) => mod.ProductPriceHistoryTab),
  { loading: () => <TabPanelFallback /> }
);

interface ProductBasic {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  isActive: boolean;
  isService: boolean;
  arabicName: string | null;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultTab = (searchParams.get("tab") as DetailTab) || "overview";
  const [activeTab, setActiveTab] = useState<DetailTab>(defaultTab);
  const [loadedTabs, setLoadedTabs] = useState<DetailTab[]>([defaultTab]);

  const [product, setProduct] = useState<ProductBasic | null>(null);
  const [stockLevel, setStockLevel] = useState<number | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setProduct(data);
        if (!data.isService) {
          const stockRes = await fetch(`/api/products/${id}/stock`);
          if (stockRes.ok) {
            const stockData = await stockRes.json();
            setStockLevel(stockData.summary?.totalOnHand ?? 0);
          }
        }
      } catch {
        router.push("/products");
      } finally {
        setIsLoadingProduct(false);
      }
    };
    fetchProduct();
  }, [id, router]);

  const getForceMountProps = (tab: DetailTab) =>
    loadedTabs.includes(tab) ? { forceMount: true as const } : {};

  const handleTabChange = (value: string) => {
    const nextTab = value as DetailTab;
    setActiveTab(nextTab);
    setLoadedTabs((current) => (current.includes(nextTab) ? current : [...current, nextTab]));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("productDetail.deleted"));
      router.push("/products");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoadingProduct) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/products">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                  {product.name}
                </h2>
                <Badge variant={product.isActive ? "success" : "secondary"} className="shrink-0">
                  {product.isActive ? t("common.active") : t("common.inactive")}
                </Badge>
                {product.isService && (
                  <Badge variant="info" className="shrink-0">Service</Badge>
                )}
                {!product.isService && stockLevel !== null && (
                  <Badge
                    variant={stockLevel === 0 ? "destructive" : stockLevel <= 5 ? "warning" : "success"}
                    className="shrink-0"
                  >
                    {stockLevel === 0 ? t("products.outOfStock2") : `${t("products.stockLabel")} ${stockLevel}`}
                  </Badge>
                )}
              </div>
              {product.sku && (
                <p className="truncate text-sm text-slate-500">SKU: {product.sku}</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              {t("common.edit")}
            </Button>
            {!product.isService && (
              <Link href={`/inventory/adjustments/new?productId=${id}`}>
                <Button variant="outline" size="sm" className="w-full">
                  <Package className="mr-1 h-4 w-4" />
                  {t("productDetail.adjustStock")}
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("common.more")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => {
                  try {
                    await fetch(`/api/products/${id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ isActive: !product.isActive }),
                    });
                    setProduct({ ...product, isActive: !product.isActive });
                    toast.success(product.isActive ? t("productDetail.markedInactive") : t("productDetail.markedActive"));
                  } catch { toast.error(t("common.error")); }
                }}>
                  <Ban className="mr-2 h-4 w-4" />
                  {product.isActive ? t("productDetail.markInactive") : t("productDetail.markActive")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList variant="line">
            <TabsTrigger value="overview">{t("productDetail.overview")}</TabsTrigger>
            <TabsTrigger value="transactions">{t("productDetail.transactions")}</TabsTrigger>
            {!product.isService && (
              <TabsTrigger value="stock">{t("productDetail.stock")}</TabsTrigger>
            )}
            <TabsTrigger value="price-history">{t("productDetail.priceHistory")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" {...getForceMountProps("overview")} className="mt-6 data-[state=inactive]:hidden">
            <OverviewTab productId={id} />
          </TabsContent>
          <TabsContent value="transactions" {...getForceMountProps("transactions")} className="mt-6 data-[state=inactive]:hidden">
            <TransactionsTab productId={id} />
          </TabsContent>
          {!product.isService && (
            <TabsContent value="stock" {...getForceMountProps("stock")} className="mt-6 data-[state=inactive]:hidden">
              <StockTab productId={id} />
            </TabsContent>
          )}
          <TabsContent value="price-history" {...getForceMountProps("price-history")} className="mt-6 data-[state=inactive]:hidden">
            <PriceHistoryTab productId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <ProductFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        productToEdit={product as never}
        onSuccess={(updated) => {
          setProduct({ ...product, ...updated });
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("productDetail.deleteTitle")}
        description={t("productDetail.deleteDescription")}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </PageAnimation>
  );
}
