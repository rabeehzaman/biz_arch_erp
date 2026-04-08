"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import { useSearchParams, useRouter } from "next/navigation";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Search, Package, ArrowRight, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { BulkUnitConversionDialog } from "@/components/products/bulk-unit-conversion-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/mobile/pull-to-refresh-indicator";
import { FloatingActionButton } from "@/components/mobile/floating-action-button";
import { SwipeableCard } from "@/components/mobile/swipeable-card";
import { useEdition } from "@/hooks/use-edition";

interface Product {
  id: string;
  name: string;
  arabicName: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number;
  cost: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  unitId: string | null;
  unit: {
    id: string;
    code: string;
    name: string;
  } | null;
  sku: string | null;
  barcode: string | null;
  gstRate: number | null;
  hsnCode: string | null;
  isService: boolean;
  isImeiTracked: boolean;
  weighMachineCode: string | null;
  isActive: boolean;
  createdAt: string;
}

interface InventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  price: number;
  cost: number;
  isActive: boolean;
  stockLots: {
    id: string;
    remainingQuantity: number;
    unitCost: number;
  }[];
  unitConversions?: {
    conversionFactor: number;
    unit: { code: string; name: string };
  }[];
}

interface StockSummary {
  totalProducts: number;
  productsWithStock: number;
  productsOutOfStock: number;
  totalStockValue: number;
}

function ProductsPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") === "inventory" ? "inventory" : "products";
  const { t, lang } = useLanguage();
  const { edition } = useEdition();
  const isSaudi = edition === "SAUDI";
  const { fmt } = useCurrency();

  const formatAmount = (amount: number) => fmt(amount);

  // — Products tab state —
  const {
    items: products,
    isLoading: isProductsLoading,
    isLoadingMore: isProductsLoadingMore,
    hasMore: hasMoreProducts,
    searchQuery: productSearch,
    setSearchQuery: setProductSearch,
    loadMore: loadMoreProducts,
    refresh: refreshProducts,
  } = useInfiniteList<Product>({ url: "/api/products" });
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refreshProducts });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkConversionOpen, setIsBulkConversionOpen] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedProducts = useMemo(() => {
    if (!sortField) return products;
    return [...products].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "sku": aVal = a.sku || ""; bVal = b.sku || ""; break;
        case "price": aVal = Number(a.price); bVal = Number(b.price); break;
        case "cost": aVal = Number(a.cost); bVal = Number(b.cost); break;
        default: return 0;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [products, sortField, sortDir]);

  // — Inventory tab state —
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [summary, setSummary] = useState<StockSummary>({
    totalProducts: 0,
    productsWithStock: 0,
    productsOutOfStock: 0,
    totalStockValue: 0,
  });

  // Form URL Parameters mapping
  const actionParam = searchParams.get("action");
  const barcodeParam = searchParams.get("barcode");
  const idParam = searchParams.get("id");

  // Lazy fetch: load inventory data when tab becomes active
  useEffect(() => {
    if (activeTab === "inventory" && !inventoryLoaded) {
      fetchInventory();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL params for dialog opening (products loaded via useInfiniteList)
  useEffect(() => {
    if (!isProductsLoading && products.length >= 0) {
      if (actionParam === "new") {
        setIsDialogOpen(true);
      } else if (actionParam === "edit" && idParam) {
        const product = products.find((p) => p.id === idParam);
        if (product) {
          setEditingProduct(product);
          setIsDialogOpen(true);
        }
      }
    }
  }, [actionParam, barcodeParam, idParam, isProductsLoading, products]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement?.tagName || ""))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchInventory = async () => {
    setIsInventoryLoading(true);
    try {
      const response = await fetch("/api/products/stock");
      if (!response.ok) {
        const fallbackResponse = await fetch("/api/products?limit=200");
        const fallbackJson = await fallbackResponse.json();
        const fallbackData = Array.isArray(fallbackJson) ? fallbackJson : fallbackJson.data ?? [];
        const mapped = fallbackData.map((p: InventoryProduct) => ({ ...p, stockLots: [] }));
        setInventory(mapped);
        calculateSummary(mapped);
        setInventoryLoaded(true);
        return;
      }
      const data = await response.json();
      setInventory(data);
      calculateSummary(data);
      setInventoryLoaded(true);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch inventory:", error);
    } finally {
      setIsInventoryLoading(false);
    }
  };

  const calculateSummary = (items: InventoryProduct[]) => {
    const result = items.reduce(
      (acc, product) => {
        const totalQty =
          product.stockLots?.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0) || 0;
        const totalValue =
          product.stockLots?.reduce(
            (sum, lot) => sum + Number(lot.remainingQuantity) * Number(lot.unitCost),
            0
          ) || 0;
        acc.totalProducts++;
        if (totalQty > 0) acc.productsWithStock++;
        else acc.productsOutOfStock++;
        acc.totalStockValue += totalValue;
        return acc;
      },
      { totalProducts: 0, productsWithStock: 0, productsOutOfStock: 0, totalStockValue: 0 }
    );
    setSummary(result);
  };

  // Form submission and state management has been extracted to ProductFormDialog

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("products.deleteProduct"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          refreshProducts();
          toast.success(t("products.productDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete product:", error);
        }
      },
    });
  };

  const handleBulkDelete = () => {
    setConfirmDialog({
      title: t("products.deleteProduct"),
      description: `${t("common.deleteConfirm")} (${selectedIds.size} ${t("common.selected") || "selected"})`,
      onConfirm: async () => {
        try {
          await Promise.all(
            Array.from(selectedIds).map((id) =>
              fetch(`/api/products/${id}`, { method: "DELETE" })
            )
          );
          setSelectedIds(new Set());
          refreshProducts();
          toast.success(t("products.productDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to bulk delete products:", error);
        }
      },
    });
  };

  const getBaseStockQuantity = (product: InventoryProduct) =>
    product.stockLots?.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0) || 0;

  const getStockDisplay = (product: InventoryProduct) => {
    const baseQty = getBaseStockQuantity(product);
    const displayUnit = product.unitConversions?.[0];
    if (displayUnit && Number(displayUnit.conversionFactor) > 0) {
      const factor = Number(displayUnit.conversionFactor);
      const displayQty = Math.round((baseQty / factor) * 1000) / 1000;
      return { qty: displayQty, unitLabel: displayUnit.unit?.name || displayUnit.unit?.code || "" };
    }
    const unitLabel = typeof product.unit === "object" ? (product.unit as any)?.code : product.unit;
    return { qty: baseQty, unitLabel: unitLabel || "" };
  };

  const getStockQuantity = (product: InventoryProduct) => getStockDisplay(product).qty;

  const getStockValue = (product: InventoryProduct) =>
    product.stockLots?.reduce(
      (sum, lot) => sum + Number(lot.remainingQuantity) * Number(lot.unitCost),
      0
    ) || 0;

  const getAverageCost = (product: InventoryProduct) => {
    const totalQty = getStockQuantity(product);
    const totalValue = getStockValue(product);
    return totalQty > 0 ? totalValue / totalQty : Number(product.cost);
  };

  const filteredInventory = inventory.filter(
    (p) =>
      p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  const switchTab = (tab: string) => {
    router.replace(`/products?tab=${tab}`, { scroll: false });
  };

  return (
    <PageAnimation>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t("products.title")}</h2>
          <p className="text-slate-500">{t("products.manageProducts")}</p>
        </div>

        {/* Tab Bar */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => switchTab("products")}
              className={cn(
                "shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "products"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {t("products.title")}
            </button>
            <button
              onClick={() => switchTab("inventory")}
              className={cn(
                "shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "inventory"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {t("nav.inventory")}
            </button>
          </nav>
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
                <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
                {t("products.addProduct")}
              </Button>
            </div>

            <ProductFormDialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingProduct(null);
                  if (actionParam || barcodeParam || idParam) {
                    router.replace("/products", { scroll: false });
                  }
                }
              }}
              productToEdit={editingProduct || undefined}
              initialBarcode={barcodeParam || undefined}
              onSuccess={() => {
                refreshProducts();
                setIsDialogOpen(false);
                setEditingProduct(null);
                if (actionParam || barcodeParam || idParam) {
                  router.replace("/products", { scroll: false });
                }
              }}
            />

            <BulkUnitConversionDialog
              open={isBulkConversionOpen}
              onOpenChange={setIsBulkConversionOpen}
              productIds={Array.from(selectedIds)}
              onSuccess={() => {
                refreshProducts();
                setSelectedIds(new Set());
              }}
            />

            <StaggerContainer className="space-y-4">
              <StaggerItem>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          ref={searchInputRef}
                          placeholder={t("products.searchProducts")}
                          value={productSearch}
                          onChange={(e) => { setProductSearch(e.target.value); setSelectedIds(new Set()); }}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isProductsLoading ? (
                      <TableSkeleton columns={7} rows={5} />
                    ) : products.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Package className="h-12 w-12 text-slate-300" />
                        <h3 className="mt-4 text-lg font-semibold">{t("products.noProducts")}</h3>
                        <p className="text-sm text-slate-500">
                          {productSearch
                            ? t("common.noMatchFound")
                            : t("products.noProductsDesc")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 sm:hidden">
                          {sortedProducts.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => router.push(`/products/${product.id}`)}
                              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-muted/50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <p className="font-semibold text-slate-900">{product.name}</p>
                                  {isSaudi && product.arabicName && (
                                    <p className="text-sm text-slate-600" dir="rtl">{product.arabicName}</p>
                                  )}
                                  {product.description && (
                                    <p className="line-clamp-2 text-sm text-slate-500">
                                      {product.description}
                                    </p>
                                  )}
                                  <p className="text-xs text-slate-500">
                                    {t("products.sku")}: {product.sku || "-"}
                                  </p>
                                </div>
                                <Badge variant={product.isActive ? "default" : "secondary"}>
                                  {product.isActive ? t("common.active") : t("common.inactive")}
                                </Badge>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {t("common.price")}
                                  </p>
                                  <p className="mt-1 font-medium text-slate-900">
                                    {formatAmount(Number(product.price))}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {t("common.cost")}
                                  </p>
                                  <p className="mt-1 font-medium text-slate-900">
                                    {formatAmount(Number(product.cost))}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {t("common.unit")}
                                  </p>
                                  <p className="mt-1 font-medium text-slate-900">
                                    {product.unit?.name || "-"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="hidden sm:block">
                          {selectedIds.size > 0 && (
                            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                              <span className="text-sm font-medium text-slate-700">
                                {selectedIds.size} {t("common.selected") || "selected"}
                              </span>
                              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                {t("common.delete")}
                              </Button>
                              {session?.user?.multiUnitEnabled && (
                                <Button variant="outline" size="sm" onClick={() => setIsBulkConversionOpen(true)}>
                                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                                  {t("products.bulkAssignConversion") || "Assign Unit Conversion"}
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                                {t("common.clear") || "Clear"}
                              </Button>
                            </div>
                          )}
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={products.length > 0 && selectedIds.size === products.length}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedIds(new Set(products.map((p) => p.id)));
                                      } else {
                                        setSelectedIds(new Set());
                                      }
                                    }}
                                  />
                                </TableHead>
                                <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("name")}>
                                  <span className="inline-flex items-center gap-1">
                                    {t("common.name")}
                                    {sortField === "name" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                                  </span>
                                </TableHead>
                                {isSaudi && (
                                <TableHead className="hidden md:table-cell">
                                  {t("products.arabicName") || "Arabic Name"}
                                </TableHead>
                                )}
                                <TableHead className="hidden sm:table-cell cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("sku")}>
                                  <span className="inline-flex items-center gap-1">
                                    {t("products.sku")}
                                    {sortField === "sku" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                                  </span>
                                </TableHead>
                                <TableHead className="cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("price")}>
                                  <span className="inline-flex items-center gap-1">
                                    {t("common.price")}
                                    {sortField === "price" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                                  </span>
                                </TableHead>
                                <TableHead className="hidden md:table-cell cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort("cost")}>
                                  <span className="inline-flex items-center gap-1">
                                    {t("common.cost")}
                                    {sortField === "cost" && <span className="text-xs">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}
                                  </span>
                                </TableHead>
                                <TableHead className="hidden sm:table-cell">{t("common.unit")}</TableHead>
                                <TableHead>{t("common.status")}</TableHead>
                                <TableHead className="text-right">{t("common.actions")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sortedProducts.map((product) => (
                                <TableRow key={product.id} onClick={() => router.push(`/products/${product.id}`)} className="cursor-pointer hover:bg-muted/50">
                                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                      checked={selectedIds.has(product.id)}
                                      onCheckedChange={(checked) => {
                                        const next = new Set(selectedIds);
                                        if (checked) {
                                          next.add(product.id);
                                        } else {
                                          next.delete(product.id);
                                        }
                                        setSelectedIds(next);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{product.name}</div>
                                      {product.description && (
                                        <div className="text-sm text-slate-500 truncate max-w-xs">
                                          {product.description}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  {isSaudi && (
                                  <TableCell className="hidden md:table-cell" dir="rtl">
                                    {product.arabicName || "-"}
                                  </TableCell>
                                  )}
                                  <TableCell className="hidden sm:table-cell">
                                    {product.sku || "-"}
                                  </TableCell>
                                  <TableCell>{formatAmount(Number(product.price))}</TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {formatAmount(Number(product.cost))}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    {product.unit?.name || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={product.isActive ? "default" : "secondary"}>
                                      {product.isActive ? t("common.active") : t("common.inactive")}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title={t("common.edit") || "Edit"}
                                      onClick={() => handleEdit(product)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title={t("common.delete") || "Delete"}
                                      onClick={() => handleDelete(product.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
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
            <LoadMoreTrigger hasMore={hasMoreProducts} isLoadingMore={isProductsLoadingMore} onLoadMore={loadMoreProducts} />
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            <StaggerContainer className="space-y-6">
              <StaggerItem>
                <div className="flex justify-end">
                  <Link href="/inventory/opening-stock" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
                      {t("inventory.openingStock")}
                      <ArrowRight className={`h-4 w-4 ${lang === "ar" ? "mr-2" : "ml-2"}`} />
                    </Button>
                  </Link>
                </div>
              </StaggerItem>

              {/* Summary Cards */}
              <StaggerItem>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t("dashboard.totalProducts")}</CardDescription>
                      <CardTitle className="text-3xl">{summary.totalProducts}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t("products.inStock")}</CardDescription>
                      <CardTitle className="text-3xl text-green-600">
                        {summary.productsWithStock}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t("products.outOfStock")}</CardDescription>
                      <CardTitle className="text-3xl text-red-600">
                        {summary.productsOutOfStock}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{t("reports.stockValue")}</CardDescription>
                      <CardTitle className="text-3xl">
                        {formatAmount(summary.totalStockValue)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              </StaggerItem>

              {/* Stock Table */}
              <StaggerItem>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder={t("products.searchProducts")}
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isInventoryLoading ? (
                      <TableSkeleton columns={6} rows={5} />
                    ) : filteredInventory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Package className="h-12 w-12 text-slate-300" />
                        <h3 className="mt-4 text-lg font-semibold">{t("products.noProducts")}</h3>
                        <p className="text-sm text-slate-500">
                          {inventorySearch
                            ? t("common.noMatchFound")
                            : t("products.noProductsDesc")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 sm:hidden">
                          {filteredInventory.map((product) => {
                            const stockQty = getStockQuantity(product);
                            const stockValue = getStockValue(product);
                            const avgCost = getAverageCost(product);
                            const isLowStock = stockQty > 0 && stockQty <= 5;
                            const isOutOfStock = stockQty <= 0;

                            return (
                              <div
                                key={product.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <p className="font-semibold text-slate-900">{product.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {t("products.sku")}: {product.sku || "-"}
                                    </p>
                                  </div>
                                  {isOutOfStock ? (
                                    <Badge variant="destructive">
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      {t("products.outOfStock")}
                                    </Badge>
                                  ) : isLowStock ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-orange-100 text-orange-800"
                                    >
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      {t("products.lowStock")}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="default"
                                      className="bg-green-100 text-green-800"
                                    >
                                      {t("products.inStock")}
                                    </Badge>
                                  )}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                      {t("inventory.currentStock")}
                                    </p>
                                    <p
                                      className={`mt-1 font-semibold ${
                                        isOutOfStock
                                          ? "text-red-600"
                                          : isLowStock
                                            ? "text-orange-600"
                                            : "text-slate-900"
                                      }`}
                                    >
                                      {getStockDisplay(product).qty} {getStockDisplay(product).unitLabel}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                      {t("products.avgCost")}
                                    </p>
                                    <p className="mt-1 font-medium text-slate-900">
                                      {formatAmount(avgCost)}
                                    </p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                      {t("reports.stockValue")}
                                    </p>
                                    <p className="mt-1 font-medium text-slate-900">
                                      {formatAmount(stockValue)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="hidden sm:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("products.productName")}</TableHead>
                                <TableHead>{t("products.sku")}</TableHead>
                                <TableHead className="text-right">{t("inventory.currentStock")}</TableHead>
                                <TableHead className="text-right">{t("products.avgCost")}</TableHead>
                                <TableHead className="text-right">{t("reports.stockValue")}</TableHead>
                                <TableHead>{t("common.status")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredInventory.map((product) => {
                                const stockQty = getStockQuantity(product);
                                const stockValue = getStockValue(product);
                                const avgCost = getAverageCost(product);
                                const isLowStock = stockQty > 0 && stockQty <= 5;
                                const isOutOfStock = stockQty <= 0;

                                return (
                                  <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="text-slate-500">{product.sku || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      <span
                                        className={
                                          isOutOfStock
                                            ? "text-red-600 font-medium"
                                            : isLowStock
                                              ? "text-orange-600 font-medium"
                                              : ""
                                        }
                                      >
                                        {getStockDisplay(product).qty} {getStockDisplay(product).unitLabel}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatAmount(avgCost)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatAmount(stockValue)}
                                    </TableCell>
                                    <TableCell>
                                      {isOutOfStock ? (
                                        <Badge variant="destructive">
                                          <AlertTriangle className="mr-1 h-3 w-3" />
                                          {t("products.outOfStock")}
                                        </Badge>
                                      ) : isLowStock ? (
                                        <Badge
                                          variant="secondary"
                                          className="bg-orange-100 text-orange-800"
                                        >
                                          <AlertTriangle className="mr-1 h-3 w-3" />
                                          {t("products.lowStock")}
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="default"
                                          className="bg-green-100 text-green-800"
                                        >
                                          {t("products.inStock")}
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>
          </div>
        )}
        {confirmDialog && (
          <ConfirmDialog
            open={!!confirmDialog}
            onOpenChange={(open) => !open && setConfirmDialog(null)}
            title={confirmDialog.title}
            description={confirmDialog.description}
            onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          />
        )}
      </div>
      {activeTab === "products" && (
        <FloatingActionButton onClick={() => setIsDialogOpen(true)} label={t("products.addProduct")} />
      )}
    </PageAnimation>
  );
}

export default function ProductsPage() {
  return (
    <PageAnimation>
      <Suspense>
        <ProductsPageContent />
      </Suspense>
    </PageAnimation>
  );
}
