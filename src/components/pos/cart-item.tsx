"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Percent } from "lucide-react";

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
  onUpdateDiscount,
  onRemove,
}: CartItemProps) {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValue, setDiscountValue] = useState(item.discount.toString());
  const lineTotal = item.quantity * item.price * (1 - item.discount / 100);

  const applyDiscount = () => {
    const val = parseFloat(discountValue) || 0;
    onUpdateDiscount(val);
    setShowDiscountInput(false);
  };

  return (
    <div className="rounded-lg border bg-white p-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>
              {Number(item.price).toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
              })}
            </span>
            <button
              onClick={() => {
                setDiscountValue(item.discount.toString());
                setShowDiscountInput(!showDiscountInput);
              }}
              className={`inline-flex items-center gap-0.5 px-1 rounded hover:bg-slate-100 ${
                item.discount > 0 ? "text-green-600 font-medium" : "text-slate-400"
              }`}
            >
              <Percent className="h-2.5 w-2.5" />
              {item.discount > 0 ? `${item.discount}%` : "Disc"}
            </button>
          </div>
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
      {showDiscountInput && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
          <Input
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder="0"
            min={0}
            max={100}
            step="0.5"
            className="h-7 w-20 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") applyDiscount();
              if (e.key === "Escape") setShowDiscountInput(false);
            }}
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={applyDiscount}>
            Apply
          </Button>
          {item.discount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-500"
              onClick={() => {
                onUpdateDiscount(0);
                setShowDiscountInput(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
