"use client";

import { Separator } from "@/components/ui/separator";
import type { CartItemData } from "./cart-item";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";

interface CartSummaryProps {
  items: CartItemData[];
  isTaxInclusivePrice?: boolean;
}

export function CartSummary({ items, isTaxInclusivePrice }: CartSummaryProps) {
  const { fmt: formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const { subtotal, taxAmount, total } = calculateCartTotal(items, isTaxInclusivePrice);

  return (
    <div className="space-y-2">
      {isTaxInclusivePrice && (
        <div className="text-xs text-blue-600 text-right font-medium">{t("common.pricesIncludeTax") || "Prices include tax"}</div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("common.subtotal") || "Subtotal"}</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      {taxAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("common.tax") || "Tax"}{isTaxInclusivePrice ? " (incl.)" : ""}</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between text-lg font-bold">
        <span>{t("common.total") || "Total"}</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function calculateCartTotal(items: CartItemData[], taxInclusive?: boolean) {
  if (taxInclusive) {
    // Back-calculate tax-exclusive base per line
    const subtotal = items.reduce((sum, item) => {
      const gross = item.quantity * item.price * (1 - item.discount / 100);
      const rate = item.gstRate || 0;
      return sum + (rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross);
    }, 0);
    const taxAmount = items.reduce((sum, item) => {
      const gross = item.quantity * item.price * (1 - item.discount / 100);
      const rate = item.gstRate || 0;
      const base = rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross;
      return sum + (base * rate) / 100;
    }, 0);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }
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
