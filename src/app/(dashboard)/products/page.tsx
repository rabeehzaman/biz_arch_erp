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
  isService: boolean;
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

  // — Products tab state —
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
      toast.error("Failed to load products");
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
      toast.error("Failed to load inventory");
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
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      fetchProducts();
      toast.success("Product deleted");
    } catch (error) {
      toast.error("Failed to delete product");
      console.error("Failed to delete product:", error);
    }
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
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500">Manage your product catalog and stock levels</p>
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
              Products
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
              Inventory
            </button>
          </nav>
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
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
                          placeholder="Search products..."
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
                        <h3 className="mt-4 text-lg font-semibold">No products found</h3>
                        <p className="text-sm text-slate-500">
                          {productSearch
                            ? "Try a different search term"
                            : "Add your first product to get started"}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden sm:table-cell">SKU</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className="hidden sm:table-cell">Unit</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                              <TableCell>₹{Number(product.price).toLocaleString("en-IN")}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {product.unit?.name || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={product.isActive ? "default" : "secondary"}>
                                  {product.isActive ? "Active" : "Inactive"}
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
                      Opening Stock
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </StaggerItem>

              {/* Summary Cards */}
              <StaggerItem>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Products</CardDescription>
                      <CardTitle className="text-3xl">{summary.totalProducts}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>In Stock</CardDescription>
                      <CardTitle className="text-3xl text-green-600">
                        {summary.productsWithStock}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Out of Stock</CardDescription>
                      <CardTitle className="text-3xl text-red-600">
                        {summary.productsOutOfStock}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Stock Value</CardDescription>
                      <CardTitle className="text-3xl">
                        ₹{summary.totalStockValue.toLocaleString("en-IN")}
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
                          placeholder="Search products..."
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
                        <h3 className="mt-4 text-lg font-semibold">No products found</h3>
                        <p className="text-sm text-slate-500">
                          {inventorySearch
                            ? "Try a different search term"
                            : "Add products and stock to see inventory"}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Current Stock</TableHead>
                            <TableHead className="text-right">Avg. Cost</TableHead>
                            <TableHead className="text-right">Stock Value</TableHead>
                            <TableHead>Status</TableHead>
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
                                  ₹{avgCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right">
                                  ₹{stockValue.toLocaleString("en-IN")}
                                </TableCell>
                                <TableCell>
                                  {isOutOfStock ? (
                                    <Badge variant="destructive">
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      Out of Stock
                                    </Badge>
                                  ) : isLowStock ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-orange-100 text-orange-800"
                                    >
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      Low Stock
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="default"
                                      className="bg-green-100 text-green-800"
                                    >
                                      In Stock
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
