"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad } from "./numpad";

interface CashTenderedInputProps {
  total: number;
  value: string;
  onChange: (value: string) => void;
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

export function CashTenderedInput({
  total,
  value,
  onChange,
}: CashTenderedInputProps) {
  const numericValue = parseFloat(value) || 0;
  const change = numericValue - total;

  const quickAmounts = [100, 200, 500, 1000, 2000].filter((a) => a >= total);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-muted-foreground">
          Cash Received
        </label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 text-2xl font-bold h-14 text-right"
          autoFocus
          min={0}
          step="0.01"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(total.toFixed(2))}
          className="text-xs"
        >
          Exact {formatCurrency(total)}
        </Button>
        {quickAmounts.slice(0, 4).map((amount) => (
          <Button
            key={amount}
            variant="outline"
            size="sm"
            onClick={() => onChange(amount.toString())}
            className="text-xs"
          >
            {formatCurrency(amount)}
          </Button>
        ))}
      </div>

      <Numpad
        onInput={(key) => onChange(value === "0" ? key : value + key)}
        onClear={() => onChange("0")}
        onBackspace={() =>
          onChange(value.length > 1 ? value.slice(0, -1) : "0")
        }
      />

      {numericValue > 0 && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
          <p className="text-sm text-green-700">Change</p>
          <p className="text-2xl font-bold text-green-700">
            {formatCurrency(Math.max(0, change))}
          </p>
        </div>
      )}
    </div>
  );
}
