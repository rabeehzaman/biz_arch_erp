"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Search, Package, ArrowRight, AlertTriangle } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { UnitSelect } from "@/components/units/unit-select";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
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
}

interface StockSummary {
  totalProducts: number;
  productsWithStock: number;
  productsOutOfStock: number;
  totalStockValue: number;
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") === "inventory" ? "inventory" : "products";
  const { t, lang } = useLanguage();

  const formatAmount = (amount: number) => {
    if (lang === "ar") return `${amount.toLocaleString("ar-SA", { minimumFractionDigits: 0 })} ر.س`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  // — Products tab state —
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

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

  // Lazy fetch: load data when tab becomes active
  useEffect(() => {
    if (activeTab === "products" && !productsLoaded) {
      fetchProducts();
    } else if (activeTab === "inventory" && !inventoryLoaded) {
      fetchInventory();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProducts = async () => {
    setIsProductsLoading(true);
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setProducts(data);
      setProductsLoaded(true);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch products:", error);
    } finally {
      setIsProductsLoading(false);
    }
  };

  const fetchInventory = async () => {
    setIsInventoryLoading(true);
    try {
      const response = await fetch("/api/products/stock");
      if (!response.ok) {
        const fallbackResponse = await fetch("/api/products");
        const fallbackData = await fallbackResponse.json();
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
          fetchProducts();
          toast.success(t("products.productDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete product:", error);
        }
      },
    });
  };



  const getStockQuantity = (product: InventoryProduct) =>
    product.stockLots?.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0) || 0;

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

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

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
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t("products.title")}</h2>
          <p className="text-slate-500">{lang === "ar" ? "إدارة كتالوج المنتجات ومستويات المخزون" : "Manage your product catalog and stock levels"}</p>
        </div>

        {/* Tab Bar */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-1">
            <button
              onClick={() => switchTab("products")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
                }
              }}
              productToEdit={editingProduct || undefined}
              onSuccess={() => {
                fetchProducts();
                setIsDialogOpen(false);
                setEditingProduct(null);
              }}
            />

            <StaggerContainer className="space-y-4">
              <StaggerItem>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder={t("products.searchProducts")}
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isProductsLoading ? (
                      <TableSkeleton columns={6} rows={5} />
                    ) : filteredProducts.length === 0 ? (
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("common.name")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("products.sku")}</TableHead>
                            <TableHead>{t("common.price")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("common.unit")}</TableHead>
                            <TableHead>{t("common.status")}</TableHead>
                            <TableHead className="text-right">{t("common.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => (
                            <TableRow key={product.id}>
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
                              <TableCell className="hidden sm:table-cell">
                                {product.sku || "-"}
                              </TableCell>
                              <TableCell>{formatAmount(Number(product.price))}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {product.unit?.name || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={product.isActive ? "default" : "secondary"}>
                                  {product.isActive ? t("common.active") : t("common.inactive")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(product)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>
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
                      <CardDescription>{lang === "ar" ? "في المخزون" : "In Stock"}</CardDescription>
                      <CardTitle className="text-3xl text-green-600">
                        {summary.productsWithStock}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{lang === "ar" ? "نفد المخزون" : "Out of Stock"}</CardDescription>
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
                      <div className="relative flex-1 max-w-sm">
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("products.productName")}</TableHead>
                            <TableHead>{t("products.sku")}</TableHead>
                            <TableHead className="text-right">{t("inventory.currentStock")}</TableHead>
                            <TableHead className="text-right">{lang === "ar" ? "متوسط التكلفة" : "Avg. Cost"}</TableHead>
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
                                    {stockQty} {typeof product.unit === "object" ? (product.unit as any)?.code : product.unit}
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
                                      {lang === "ar" ? "نفد المخزون" : "Out of Stock"}
                                    </Badge>
                                  ) : isLowStock ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-orange-100 text-orange-800"
                                    >
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      {lang === "ar" ? "مخزون منخفض" : "Low Stock"}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="default"
                                      className="bg-green-100 text-green-800"
                                    >
                                      {lang === "ar" ? "في المخزون" : "In Stock"}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
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
