"use client";

import { Separator } from "@/components/ui/separator";
import type { CartItemData } from "./cart-item";
import { useCurrency } from "@/hooks/use-currency";

interface CartSummaryProps {
  items: CartItemData[];
}

export function CartSummary({ items }: CartSummaryProps) {
  const { fmt: formatCurrency } = useCurrency();
  const { subtotal, taxAmount, total } = calculateCartTotal(items);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      {taxAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">GST</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between text-lg font-bold">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function calculateCartTotal(items: CartItemData[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price * (1 - item.discount / 100),
    0
  );
  const taxAmount = items.reduce((sum, item) => {
    const lineTotal = item.quantity * item.price * (1 - item.discount / 100);
    return sum + (lineTotal * (item.gstRate || 0)) / 100;
  }, 0);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}
