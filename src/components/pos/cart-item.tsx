"use client";

import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface CartItemData {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  stockQuantity: number;
  gstRate?: number;
  hsnCode?: string;
}

interface CartItemProps {
  item: CartItemData;
  onRemove: (productId: string) => void;
}

export function CartItem({
  item,
  onRemove,
}: CartItemProps) {
  const { fmt } = useCurrency();
  const lineTotal = item.quantity * item.price * (1 - item.discount / 100);

  return (
    <div className="max-w-full rounded-lg border bg-white p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2">
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-medium leading-tight whitespace-normal break-words [overflow-wrap:anywhere]">
            {item.name}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{fmt(Number(item.price))}</span>
          </div>
        </div>
        <div className="flex min-w-[3rem] shrink-0 items-center justify-center self-center">
          <span className="text-sm font-medium">x{item.quantity}</span>
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
}
