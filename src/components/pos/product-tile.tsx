"use client";

import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

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

const TILE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#a855f7", "#e11d48",
];

function getTileColor(product: ProductTileProduct): string {
  if (product.category?.color) return product.category.color;
  // Stable color from product id
  let hash = 0;
  for (let i = 0; i < product.id.length; i++) {
    hash = product.id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

export function ProductTile({
  product,
  selectedQuantity = 0,
  onAdd,
}: ProductTileProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const isSelected = selectedQuantity > 0;
  const color = getTileColor(product);

  return (
    <button
      onClick={() => onAdd(product)}
      aria-pressed={isSelected}
      className={cn(
        "relative flex h-[120px] flex-col items-center justify-center rounded-xl p-3 text-center transition-all cursor-pointer",
        isSelected && "ring-2 ring-offset-2 ring-primary",
        "active:scale-95"
      )}
      style={{ backgroundColor: color + "20" }}
    >
      {isSelected && (
        <Badge className="absolute right-1 top-1 z-10 min-w-5 justify-center rounded-full px-1.5 py-0 text-[10px] font-bold">
          {formatSelectedQuantity(selectedQuantity)}
        </Badge>
      )}
      {product.isBundle && (
        <div className="absolute left-1 top-1 z-10 flex items-center gap-0.5 rounded bg-slate-900/80 px-1 py-0.5">
          <Layers className="h-2.5 w-2.5 text-white" />
        </div>
      )}
      <span className="line-clamp-2 text-sm font-bold leading-tight text-slate-800">
        {product.name}
      </span>
      <span className="mt-1 text-xs font-semibold text-slate-500">
        {fmt(Number(product.price))}
      </span>
    </button>
  );
}
