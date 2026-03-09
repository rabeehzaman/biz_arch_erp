"use client";

import { cn } from "@/lib/utils";
import { Package } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";

interface ProductTileProps {
  product: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    stockQuantity: number;
    isService?: boolean;
    category: { color: string | null } | null;
  };
  onAdd: () => void;
}

export function ProductTile({ product, onAdd }: ProductTileProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const outOfStock = !product.isService && product.stockQuantity <= 0;

  return (
    <button
      onClick={onAdd}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border bg-white p-3 text-center transition-all min-h-[100px] sm:min-h-[120px]",
        outOfStock
          ? "opacity-60 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
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
        {fmt(Number(product.price))}
      </span>
    </button>
  );
}
