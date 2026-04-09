"use client";

import { memo } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { Trash2, ChefHat, Minus, Plus } from "lucide-react";

export interface CartItemJewelleryData {
  jewelleryItemId: string;
  goldRate: number;
  purity: string;
  metalType: string;
  grossWeight: number;
  stoneWeight: number;
  netWeight: number;
  fineWeight: number;
  wastagePercent: number;
  makingChargeType: string;
  makingChargeValue: number;
  stoneValue: number;
  tagNumber: string;
  huidNumber: string | null;
}

export interface CartItemData {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  stockQuantity: number;
  gstRate?: number;
  hsnCode?: string;
  unitId?: string;
  unitName?: string;
  conversionFactor: number;
  jewellery?: CartItemJewelleryData | null;
  categoryId?: string | null;
  variantId?: string;
  variantName?: string;
  modifiers?: string[];
}

interface CartItemProps {
  item: CartItemData;
  onRemove: (productId: string) => void;
  kotSentQty?: number;
  onQuantityChange?: (productId: string, variantId: string | undefined, newQty: number) => void;
}

export const CartItem = memo(function CartItem({
  item,
  onRemove,
  kotSentQty,
  onQuantityChange,
}: CartItemProps) {
  const { fmt } = useCurrency();
  const lineTotal = item.quantity * item.price * (1 - item.discount / 100);

  return (
    <div className="max-w-full rounded-lg border bg-white p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2">
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-medium leading-tight whitespace-normal break-words [overflow-wrap:anywhere]">
            {item.name}{item.variantName ? ` - ${item.variantName}` : ""}{item.unitName ? ` (${item.unitName})` : ""}
          </p>
          {item.modifiers && item.modifiers.length > 0 && (
            <p className="text-[11px] text-orange-600 leading-tight">
              {item.modifiers.join(", ")}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{fmt(Number(item.price))}</span>
            {item.jewellery && (
              <span className="text-amber-600">
                · #{item.jewellery.tagNumber} · {item.jewellery.purity} · {item.jewellery.grossWeight}g
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center self-center gap-0.5">
          {onQuantityChange ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const minQty = kotSentQty ?? 0;
                  if (item.quantity <= 1 && minQty === 0) {
                    onRemove(item.productId);
                  } else if (item.quantity > minQty) {
                    onQuantityChange(item.productId, item.variantId, item.quantity - 1);
                  }
                }}
                disabled={kotSentQty != null && item.quantity <= kotSentQty}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[1.5rem] text-center text-sm font-semibold">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onQuantityChange(item.productId, item.variantId, item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span className="text-sm font-medium">x{item.quantity}</span>
          )}
          {kotSentQty != null && kotSentQty > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0 text-[10px] font-medium text-green-700">
              <ChefHat className="h-2.5 w-2.5" />
              {kotSentQty}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 self-center">
          <span className="w-16 text-right text-sm font-semibold sm:w-20">
            {fmt(lineTotal)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onRemove(item.productId)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.item.productId === next.item.productId &&
  prev.item.variantId === next.item.variantId &&
  prev.item.quantity === next.item.quantity &&
  prev.item.price === next.item.price &&
  prev.item.discount === next.item.discount &&
  prev.kotSentQty === next.kotSentQty &&
  prev.onRemove === next.onRemove &&
  prev.onQuantityChange === next.onQuantityChange
);
