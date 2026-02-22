"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";

export interface CartItemData {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  stockQuantity: number;
}

interface CartItemProps {
  item: CartItemData;
  onUpdateQuantity: (qty: number) => void;
  onUpdateDiscount: (discount: number) => void;
  onRemove: () => void;
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const lineTotal = item.quantity * item.price * (1 - item.discount / 100);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white p-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {Number(item.price).toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
          })}
          {item.discount > 0 && (
            <span className="ml-1 text-green-600">-{item.discount}%</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onUpdateQuantity(item.quantity - 1)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center text-sm font-medium">
          {item.quantity}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          disabled={item.quantity >= item.stockQuantity}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <span className="w-20 text-right text-sm font-semibold">
        {lineTotal.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
        })}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
