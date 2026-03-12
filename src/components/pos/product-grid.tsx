"use client";

import { useMemo } from "react";
import { ProductTile, type ProductTileProduct } from "./product-tile";
import { PackageX } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface ProductGridProps {
  products: ProductTileProduct[];
  searchQuery: string;
  selectedCategory: string | null;
  onAddToCart: (product: ProductTileProduct) => void;
}

export function ProductGrid({
  products,
  searchQuery,
  selectedCategory,
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
          onAdd={onAddToCart}
        />
      ))}
    </div>
  );
}
