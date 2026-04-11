"use client";


import type { CartItemData } from "./cart-item";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { calculateRoundOff, type RoundOffMode } from "@/lib/round-off";

export type GlobalDiscountType = "percent" | "amount";

interface CartSummaryProps {
  items: CartItemData[];
  isTaxInclusivePrice?: boolean;
  roundOffMode?: RoundOffMode;
  globalDiscount?: number;
  globalDiscountType?: GlobalDiscountType;
}

export function CartSummary({ items, isTaxInclusivePrice, roundOffMode, globalDiscount = 0, globalDiscountType = "percent" }: CartSummaryProps) {
  const { fmt: formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const { subtotal, globalDiscountAmount, globalDiscountPercent, taxAmount, roundOffAmount, total } = calculateCartTotal(items, isTaxInclusivePrice, roundOffMode, globalDiscount, globalDiscountType);

  return (
    <div className="space-y-1">
      {isTaxInclusivePrice && (
        <div className="text-xs text-blue-600 text-right font-medium">{t("common.pricesIncludeTax")}</div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("common.subtotal")}</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      {taxAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("common.tax")}{isTaxInclusivePrice ? " (incl.)" : ""}</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>
      )}
      {globalDiscountAmount > 0 && (
        <div className="flex justify-between text-sm text-emerald-600">
          <span>
            {globalDiscountPercent > 0 && globalDiscountType === "percent"
              ? t("pos.discountApplied").replace("{percent}", globalDiscountPercent.toFixed(globalDiscountPercent % 1 === 0 ? 0 : 2))
              : t("pos.globalDiscount")}
          </span>
          <span>-{formatCurrency(globalDiscountAmount)}</span>
        </div>
      )}
      {roundOffAmount !== 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("common.roundOff")}</span>
          <span>{roundOffAmount > 0 ? "+" : ""}{formatCurrency(roundOffAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-bold border-t pt-1">
        <span>{t("common.total")}</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function calculateCartTotal(
  items: CartItemData[],
  taxInclusive?: boolean,
  roundOffMode: RoundOffMode = "NONE",
  globalDiscount: number = 0,
  globalDiscountType: GlobalDiscountType = "percent"
) {
  // ── Percent mode: discount reduces the taxable base, tax is recalculated ──
  if (globalDiscountType === "percent") {
    const pct = Math.min(Math.max(globalDiscount, 0), 100);
    const discountFactor = 1 - pct / 100;

    const subtotalBeforeDiscount = taxInclusive
      ? items.reduce((sum, item) => {
          const gross = item.quantity * item.price * (1 - item.discount / 100);
          const rate = item.gstRate || 0;
          return sum + (rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross);
        }, 0)
      : items.reduce((sum, item) => sum + item.quantity * item.price * (1 - item.discount / 100), 0);

    const globalDiscountAmount = subtotalBeforeDiscount * (1 - discountFactor);
    const subtotal = subtotalBeforeDiscount - globalDiscountAmount;

    const taxAmount = taxInclusive
      ? items.reduce((sum, item) => {
          const gross = item.quantity * item.price * (1 - item.discount / 100);
          const rate = item.gstRate || 0;
          const base = rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross;
          return sum + (base * discountFactor * rate) / 100;
        }, 0)
      : items.reduce((sum, item) => {
          const lineTotal = item.quantity * item.price * (1 - item.discount / 100);
          return sum + (lineTotal * discountFactor * (item.gstRate || 0)) / 100;
        }, 0);

    const { roundOffAmount, roundedTotal } = calculateRoundOff(
      subtotal + taxAmount, roundOffMode, roundOffMode !== "NONE"
    );
    return { subtotal: subtotalBeforeDiscount, globalDiscountAmount, globalDiscountPercent: pct, taxAmount, roundOffAmount, total: roundedTotal };
  }

  // ── Amount mode: flat deduction from the total (after tax, before round-off) ──
  // Tax stays unchanged — the discount is a straight bill reduction.
  // This ensures "bill 320, discount 20 → total 300" with no rounding surprise.
  const subtotal = taxInclusive
    ? items.reduce((sum, item) => {
        const gross = item.quantity * item.price * (1 - item.discount / 100);
        const rate = item.gstRate || 0;
        return sum + (rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross);
      }, 0)
    : items.reduce((sum, item) => sum + item.quantity * item.price * (1 - item.discount / 100), 0);

  const taxAmount = taxInclusive
    ? items.reduce((sum, item) => {
        const gross = item.quantity * item.price * (1 - item.discount / 100);
        const rate = item.gstRate || 0;
        const base = rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross;
        return sum + (base * rate) / 100;
      }, 0)
    : items.reduce((sum, item) => {
        const lineTotal = item.quantity * item.price * (1 - item.discount / 100);
        return sum + (lineTotal * (item.gstRate || 0)) / 100;
      }, 0);

  const totalBeforeDiscount = subtotal + taxAmount;
  const globalDiscountAmount = Math.min(Math.max(globalDiscount, 0), totalBeforeDiscount);
  const globalDiscountPercent = totalBeforeDiscount > 0 ? (globalDiscountAmount / totalBeforeDiscount) * 100 : 0;

  const { roundOffAmount, roundedTotal } = calculateRoundOff(
    totalBeforeDiscount - globalDiscountAmount, roundOffMode, roundOffMode !== "NONE"
  );
  return { subtotal, globalDiscountAmount, globalDiscountPercent, taxAmount, roundOffAmount, total: roundedTotal };
}
