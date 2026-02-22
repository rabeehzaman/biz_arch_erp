"use client";

import { Separator } from "@/components/ui/separator";
import type { CartItemData } from "./cart-item";

interface CartSummaryProps {
  items: CartItemData[];
  taxRate: number;
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
}

export function CartSummary({ items, taxRate }: CartSummaryProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price * (1 - item.discount / 100),
    0
  );
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tax ({taxRate}%)</span>
        <span>{formatCurrency(taxAmount)}</span>
      </div>
      <Separator />
      <div className="flex justify-between text-lg font-bold">
        <span>Total</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function calculateCartTotal(items: CartItemData[], taxRate: number) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price * (1 - item.discount / 100),
    0
  );
  const taxAmount = (subtotal * taxRate) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}
