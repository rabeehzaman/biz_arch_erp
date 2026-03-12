"use client";

import { cn } from "@/lib/utils";
import { Package, Layers } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "@/components/ui/badge";

export interface ProductTileProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stockQuantity: number | null;
  categoryId: string | null;
  isService?: boolean;
  isBundle?: boolean;
  category: { color: string | null } | null;
}

interface ProductTileProps {
  product: ProductTileProduct;
  selectedQuantity?: number;
  onAdd: (product: ProductTileProduct) => void;
}

function formatSelectedQuantity(quantity: number) {
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }

  if (quantity < 1) {
    return quantity.toFixed(3).replace(/\.?0+$/, "");
  }

  return quantity.toFixed(2).replace(/\.?0+$/, "");
}

export function ProductTile({
  product,
  selectedQuantity = 0,
  onAdd,
}: ProductTileProps) {
  const { fmt } = useCurrency();
  const outOfStock = !product.isService && !product.isBundle && (product.stockQuantity ?? 0) <= 0;
  const isSelected = selectedQuantity > 0;

  return (
    <button
      onClick={() => onAdd(product)}
      aria-pressed={isSelected}
      className={cn(
        "relative flex min-h-[100px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center transition-colors sm:min-h-[120px]",
        outOfStock ? "cursor-pointer opacity-60" : "cursor-pointer",
        isSelected && "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]",
        "hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100"
      )}
    >
      {isSelected && (
        <Badge className="absolute right-2 top-2 min-w-6 justify-center rounded-full px-2 py-0.5 text-xs font-bold">
          {formatSelectedQuantity(selectedQuantity)}
        </Badge>
      )}
      <div
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg relative"
        style={{ backgroundColor: (product.category?.color || "#0f172a") + "20" }}
      >
        {product.isBundle ? (
          <Layers
            className="h-5 w-5"
            style={{ color: product.category?.color || "#0f172a" }}
          />
        ) : (
          <Package
            className="h-5 w-5"
            style={{ color: product.category?.color || "#0f172a" }}
          />
        )}
      </div>
      {product.isBundle && (
        <span className="mb-0.5 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Bundle
        </span>
      )}
      <span className="text-sm font-medium line-clamp-2 leading-tight">
        {product.name}
      </span>
      {product.sku && (
        <span className="text-xs text-muted-foreground mt-0.5">{product.sku}</span>
      )}
      <span className="mt-1 text-sm font-bold">
        {fmt(Number(product.price))}
      </span>
    </button>
  );
}
