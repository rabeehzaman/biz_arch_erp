"use client";

import { useMemo } from "react";
import { ProductTile, type ProductTileProduct } from "./product-tile";
import { PackageX } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductGridProps {
  products: ProductTileProduct[];
  isLoading?: boolean;
  searchQuery: string;
  selectedCategory: string | null;
  selectedQuantities: Record<string, number>;
  onAddToCart: (product: ProductTileProduct) => void;
}

export function ProductGrid({
  products,
  isLoading = false,
  searchQuery,
  selectedCategory,
  selectedQuantities,
  onAddToCart,
}: ProductGridProps) {
  const { t } = useLanguage();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearchQuery ||
        product.name.toLowerCase().includes(normalizedSearchQuery) ||
        (product.sku && product.sku.toLowerCase().includes(normalizedSearchQuery));
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, normalizedSearchQuery, selectedCategory]);

  if (isLoading) {
    return (
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto content-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={`product-skeleton-${index}`}
            className="flex min-h-[100px] flex-col rounded-xl border border-slate-200 bg-white p-3 sm:min-h-[120px]"
          >
            <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
            <Skeleton className="mb-2 h-3 w-16 rounded-md" />
            <Skeleton className="mb-1.5 h-4 w-full rounded-md" />
            <Skeleton className="mb-3 h-4 w-3/4 rounded-md" />
            <Skeleton className="mt-auto h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground">
        <PackageX className="mb-3 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">{t("pos.noProductsFound")}</p>
        <p className="text-sm">
          {normalizedSearchQuery ? t("pos.tryAdjustingSearch") : t("pos.addProducts")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 overflow-y-auto flex-1 content-start">
      {filtered.map((product) => (
        <ProductTile
          key={product.id}
          product={product}
          selectedQuantity={selectedQuantities[product.id] ?? 0}
          onAdd={onAddToCart}
        />
      ))}
    </div>
  );
}
