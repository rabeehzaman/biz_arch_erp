"use client";

import { cn } from "@/lib/utils";
import { Package, Layers } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import type { ProductTileProduct } from "./product-tile";

interface ProductListItemProps {
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

export function ProductListItem({
  product,
  selectedQuantity = 0,
  onAdd,
}: ProductListItemProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const isSelected = selectedQuantity > 0;

  return (
    <button
      onClick={() => onAdd(product)}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
        isSelected && "bg-primary/5",
        "hover:bg-slate-50 active:bg-slate-100"
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
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

      <div className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">
          {product.name}
        </span>
        {product.isBundle && (
          <span className="inline-block rounded bg-slate-900 px-1 py-0.5 text-[10px] font-semibold text-white mr-1">
            {t("pos.bundle")}
          </span>
        )}
        {product.sku && (
          <span className="block truncate text-xs text-muted-foreground">{product.sku}</span>
        )}
      </div>

      <span className="shrink-0 text-sm font-bold">
        {fmt(Number(product.price))}
      </span>

      {isSelected && (
        <Badge className="shrink-0 min-w-6 justify-center rounded-full px-2 py-0.5 text-xs font-bold">
          {formatSelectedQuantity(selectedQuantity)}
        </Badge>
      )}
    </button>
  );
}
