"use client";

import { ProductTile } from "./product-tile";
import { PackageX } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stockQuantity: number;
  categoryId: string | null;
  category: { id: string; name: string; slug: string; color: string | null } | null;
}

interface ProductGridProps {
  products: Product[];
  searchQuery: string;
  selectedCategory: string | null;
  onAddToCart: (product: Product) => void;
}

export function ProductGrid({
  products,
  searchQuery,
  selectedCategory,
  onAddToCart,
}: ProductGridProps) {
  const filtered = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      !selectedCategory || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground py-12">
        <PackageX className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No products found</p>
        <p className="text-sm">Try adjusting your search or category filter</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 overflow-y-auto flex-1 content-start">
      {filtered.map((product) => (
        <ProductTile
          key={product.id}
          product={product}
          onAdd={() => onAddToCart(product)}
        />
      ))}
    </div>
  );
}
