"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad } from "./numpad";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface CashTenderedInputProps {
  total: number;
  value: string;
  onChange: (value: string) => void;
}

function sanitizeAmountInput(rawValue: string) {
  const cleaned = rawValue.replace(/[^\d.]/g, "");
  if (!cleaned) {
    return "";
  }

  const [wholePartRaw, ...fractionParts] = cleaned.split(".");
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, "") || "0";

  if (fractionParts.length === 0 && !cleaned.includes(".")) {
    return wholePart;
  }

  const fractionPart = fractionParts.join("").slice(0, 2);
  return `${wholePart}.${fractionPart}`;
}

function appendAmountInput(
  currentValue: string,
  key: string,
  exactValue: string,
) {
  const baseValue =
    currentValue === exactValue && key !== "." ? "" : currentValue;

  if (key === ".") {
    if (baseValue.includes(".")) {
      return baseValue;
    }

    return baseValue ? `${baseValue}.` : "0.";
  }

  const nextValue = `${baseValue}${key}`;
  return sanitizeAmountInput(nextValue);
}

export function CashTenderedInput({
  total,
  value,
  onChange,
}: CashTenderedInputProps) {
  const { fmt: formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const numericValue = parseFloat(value) || 0;
  const exactValue = total.toFixed(2);
  const change = Math.max(0, numericValue - total);
  const remaining = Math.max(0, total - numericValue);

  const quickAmounts = [100, 200, 500, 1000, 2000].filter((a) => a >= total);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <label className="pt-0.5 text-sm font-medium text-slate-700">
          {t("pos.cashReceived")}
        </label>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {t("payments.cash") || "Cash"}
        </div>
      </div>

      <div className="mt-2.5 space-y-0.5">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 border-slate-200 bg-slate-50 px-4 text-right text-2xl font-bold tracking-tight tabular-nums shadow-none md:text-2xl"
          autoFocus
          placeholder="0.00"
        />
      </div>

      <div
        key={`${numericValue}-${change}-${remaining}-${total}`}
        className="mt-2.5 grid grid-cols-3 gap-1.5"
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {t("pos.totalDue")}
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(total)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {t("pos.cashReceived")}
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(numericValue)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl border p-2 text-center",
            change > 0
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.16em]">
            {change > 0 ? t("pos.change") : t("pos.remaining")}
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(change > 0 ? change : remaining)}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => onChange(exactValue)}
          className="h-7 rounded-full border-slate-200 bg-slate-50 px-3 text-[10.5px] font-semibold shadow-none hover:bg-white"
        >
          {t("pos.exact")} {formatCurrency(total)}
        </Button>
        {quickAmounts.slice(0, 3).map((amount) => (
          <Button
            key={amount}
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onChange(amount.toString())}
            className="h-7 rounded-full border-slate-200 bg-slate-50 px-3 text-[10.5px] font-semibold shadow-none hover:bg-white"
          >
            {formatCurrency(amount)}
          </Button>
        ))}
      </div>

      <Numpad
        compact
        className="mt-2.5"
        onInput={(key) => onChange(appendAmountInput(value, key, exactValue))}
        onClear={() => onChange("")}
        onBackspace={() => onChange(value.length > 1 ? value.slice(0, -1) : "")}
      />
    </div>
  );
}
