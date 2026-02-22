"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { PaymentMethodButton } from "./payment-method-button";

export interface PaymentEntry {
  method: string;
  amount: string;
  reference: string;
}

interface SplitPaymentFormProps {
  payments: PaymentEntry[];
  total: number;
  onUpdate: (payments: PaymentEntry[]) => void;
}

const METHODS = ["CASH", "CREDIT_CARD", "UPI", "BANK_TRANSFER"];

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

export function SplitPaymentForm({
  payments,
  total,
  onUpdate,
}: SplitPaymentFormProps) {
  const totalPaid = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );
  const remaining = total - totalPaid;

  const addPayment = () => {
    onUpdate([
      ...payments,
      { method: "CASH", amount: remaining > 0 ? remaining.toFixed(2) : "0", reference: "" },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Split Payment</h3>
        <Button variant="outline" size="sm" onClick={addPayment}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {payments.map((payment, index) => (
        <div key={index} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payment {index + 1}</span>
            {payments.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500"
                onClick={() => removePayment(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((method) => (
              <PaymentMethodButton
                key={method}
                method={method}
                isSelected={payment.method === method}
                onClick={() => updatePayment(index, "method", method)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount"
              value={payment.amount}
              onChange={(e) => updatePayment(index, "amount", e.target.value)}
              className="flex-1"
              min={0}
              step="0.01"
            />
            {payment.method !== "CASH" && (
              <Input
                placeholder="Reference"
                value={payment.reference}
                onChange={(e) =>
                  updatePayment(index, "reference", e.target.value)
                }
                className="flex-1"
              />
            )}
          </div>
        </div>
      ))}

      <div className="rounded-lg bg-slate-50 p-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span>Total Due</span>
          <span className="font-medium">{formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Paid</span>
          <span className="font-medium">{formatCurrency(totalPaid)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>{remaining >= 0 ? "Remaining" : "Change"}</span>
          <span className={remaining < 0 ? "text-green-600" : remaining > 0 ? "text-red-600" : ""}>
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>
      </div>
    </div>
  );
}
