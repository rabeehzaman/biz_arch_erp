"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { PaymentMethodButton } from "./payment-method-button";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { POSPaymentMethod } from "@/lib/pos/payment-methods";

export interface PaymentEntry {
  method: string;
  amount: string;
  reference: string;
}

interface SplitPaymentFormProps {
  payments: PaymentEntry[];
  total: number;
  availableMethods: POSPaymentMethod[];
  onUpdate: (payments: PaymentEntry[]) => void;
}

export function SplitPaymentForm({
  payments,
  total,
  availableMethods,
  onUpdate,
}: SplitPaymentFormProps) {
  const { fmt: formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const totalPaid = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );
  const remaining = total - totalPaid;
  const defaultMethod = availableMethods[0] ?? "CASH";

  const addPayment = () => {
    onUpdate([
      ...payments,
      {
        method: defaultMethod,
        amount: remaining > 0 ? remaining.toFixed(2) : "0",
        reference: "",
      },
    ]);
  };

  const removePayment = (index: number) => {
    onUpdate(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, field: keyof PaymentEntry, value: string) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate(updated);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t("pos.splitPayment")}</h3>
        <Button variant="outline" size="sm" type="button" onClick={addPayment}>
          <Plus className="h-3 w-3 mr-1" />
          {t("pos.add")}
        </Button>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {payments.map((payment, index) => (
          <div key={index} className="rounded-lg border p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("pos.paymentIndex").replace("{index}", String(index + 1))}
              </span>
              {payments.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="h-6 w-6 text-red-500"
                  onClick={() => removePayment(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availableMethods.map((method) => (
                <PaymentMethodButton
                  key={method}
                  method={method}
                  isSelected={payment.method === method}
                  compact
                  onClick={() => updatePayment(index, "method", method)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t("pos.amount")}
                value={payment.amount}
                onChange={(e) => updatePayment(index, "amount", e.target.value)}
                className="h-10 flex-1"
                min={0}
                step="0.001"
              />
              {payment.method !== "CASH" && (
                <Input
                  placeholder={t("pos.reference")}
                  value={payment.reference}
                  onChange={(e) =>
                    updatePayment(index, "reference", e.target.value)
                  }
                  className="h-10 flex-1"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-slate-50 p-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span>{t("pos.totalDue")}</span>
          <span className="font-medium">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>{t("pos.totalPaid")}</span>
          <span className="font-medium">{formatCurrency(totalPaid)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>{remaining >= 0 ? t("pos.remaining") : t("pos.change")}</span>
          <span className={remaining < 0 ? "text-green-600" : remaining > 0 ? "text-red-600" : ""}>
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>
      </div>
    </div>
  );
}
