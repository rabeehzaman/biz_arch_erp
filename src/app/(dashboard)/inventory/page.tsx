"use client";

import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package, ArrowRight, AlertTriangle } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";

interface Product {
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

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState<StockSummary>({
    totalProducts: 0,
    productsWithStock: 0,
    productsOutOfStock: 0,
    totalStockValue: 0,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products/stock");
      if (!response.ok) {
        // Fallback to regular products API if stock endpoint doesn't exist yet
        const fallbackResponse = await fetch("/api/products");
        const fallbackData = await fallbackResponse.json();
        setProducts(fallbackData.map((p: Product) => ({ ...p, stockLots: [] })));
        calculateSummary(fallbackData.map((p: Product) => ({ ...p, stockLots: [] })));
        return;
      }
      const data = await response.json();
      setProducts(data);
      calculateSummary(data);
    } catch (error) {
      toast.error("Failed to load inventory");
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (products: Product[]) => {
    const summary = products.reduce(
      (acc, product) => {
        const totalQty = product.stockLots?.reduce(
          (sum, lot) => sum + Number(lot.remainingQuantity),
          0
        ) || 0;
        const totalValue = product.stockLots?.reduce(
          (sum, lot) => sum + Number(lot.remainingQuantity) * Number(lot.unitCost),
          0
        ) || 0;

        acc.totalProducts++;
        if (totalQty > 0) {
          acc.productsWithStock++;
        } else {
          acc.productsOutOfStock++;
        }
        acc.totalStockValue += totalValue;
        return acc;
      },
      { totalProducts: 0, productsWithStock: 0, productsOutOfStock: 0, totalStockValue: 0 }
    );
    setSummary(summary);
  };

  const getStockQuantity = (product: Product) => {
    return product.stockLots?.reduce(
      (sum, lot) => sum + Number(lot.remainingQuantity),
      0
    ) || 0;
  };

  const getStockValue = (product: Product) => {
    return product.stockLots?.reduce(
      (sum, lot) => sum + Number(lot.remainingQuantity) * Number(lot.unitCost),
      0
    ) || 0;
  };

  const getAverageCost = (product: Product) => {
    const totalQty = getStockQuantity(product);
    const totalValue = getStockValue(product);
    return totalQty > 0 ? totalValue / totalQty : Number(product.cost);
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
          <p className="text-slate-500">Track your product stock levels</p>
        </div>
        <Link href="/inventory/opening-stock" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
            Opening Stock
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
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
            <CardTitle className="text-3xl text-green-600">{summary.productsWithStock}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Out of Stock</CardDescription>
            <CardTitle className="text-3xl text-red-600">{summary.productsOutOfStock}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Stock Value</CardDescription>
            <CardTitle className="text-3xl">₹{summary.totalStockValue.toLocaleString("en-IN")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={6} rows={5} />
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No products found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery
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
                {filteredProducts.map((product) => {
                  const stockQty = getStockQuantity(product);
                  const stockValue = getStockValue(product);
                  const avgCost = getAverageCost(product);
                  const isLowStock = stockQty > 0 && stockQty <= 5;
                  const isOutOfStock = stockQty <= 0;

                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {product.sku || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          isOutOfStock
                            ? "text-red-600 font-medium"
                            : isLowStock
                              ? "text-orange-600 font-medium"
                              : ""
                        }>
                          {stockQty} {product.unit}
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
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-100 text-green-800">
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
    </div>
  );
}
