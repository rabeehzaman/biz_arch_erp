"use client";

import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

interface ProductTileProps {
  product: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    stockQuantity: number;
    category: { color: string | null } | null;
  };
  onAdd: () => void;
}

export function ProductTile({ product, onAdd }: ProductTileProps) {
  const outOfStock = product.stockQuantity <= 0;
  const lowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;

  return (
    <button
      onClick={onAdd}
      disabled={outOfStock}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border bg-white p-3 text-center transition-all min-h-[120px]",
        outOfStock
          ? "opacity-50 cursor-not-allowed"
          : "hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      )}
    >
      <div
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: (product.category?.color || "#6366f1") + "20" }}
      >
        <Package
          className="h-5 w-5"
          style={{ color: product.category?.color || "#6366f1" }}
        />
      </div>
      <span className="text-sm font-medium line-clamp-2 leading-tight">
        {product.name}
      </span>
      {product.sku && (
        <span className="text-xs text-muted-foreground mt-0.5">{product.sku}</span>
      )}
      <span className="mt-1 text-sm font-bold">
        {Number(product.price).toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
        })}
      </span>
      {outOfStock && (
        <span className="text-xs text-red-500 font-medium mt-1">Out of Stock</span>
      )}
      {lowStock && (
        <span className="text-xs text-orange-500 font-medium mt-1">
          {product.stockQuantity} left
        </span>
      )}
    </button>
  );
}
