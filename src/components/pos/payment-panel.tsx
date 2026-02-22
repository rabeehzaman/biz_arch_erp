"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Split, CheckCircle2 } from "lucide-react";
import { PaymentMethodButton } from "./payment-method-button";
import { CashTenderedInput } from "./cash-tendered-input";
import { SplitPaymentForm, type PaymentEntry } from "./split-payment-form";
import { Input } from "@/components/ui/input";

interface PaymentPanelProps {
  total: number;
  onBack: () => void;
  onComplete: (payments: PaymentEntry[]) => void;
  isProcessing: boolean;
}

const METHODS = ["CASH", "CREDIT_CARD", "UPI", "BANK_TRANSFER"];

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

export function PaymentPanel({
  total,
  onBack,
  onComplete,
  isProcessing,
}: PaymentPanelProps) {
  const [mode, setMode] = useState<"single" | "split">("single");
  const [selectedMethod, setSelectedMethod] = useState("CASH");
  const [cashTendered, setCashTendered] = useState(total.toFixed(2));
  const [reference, setReference] = useState("");
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([
    { method: "CASH", amount: total.toFixed(2), reference: "" },
  ]);

  const handleComplete = () => {
    if (mode === "single") {
      const amount =
        selectedMethod === "CASH"
          ? Math.min(parseFloat(cashTendered) || 0, total)
          : total;
      onComplete([
        {
          method: selectedMethod,
          amount: amount.toFixed(2),
          reference: selectedMethod !== "CASH" ? reference : "",
        },
      ]);
    } else {
      onComplete(splitPayments);
    }
  };

  const canComplete =
    mode === "single"
      ? selectedMethod === "CASH"
        ? (parseFloat(cashTendered) || 0) >= total
        : true
      : splitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) >=
        total;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold">Payment</h2>
        <div className="ml-auto text-xl font-bold text-primary">
          {formatCurrency(total)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === "single" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("single")}
          >
            Single Payment
          </Button>
          <Button
            variant={mode === "split" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("split")}
          >
            <Split className="h-3 w-3 mr-1" />
            Split
          </Button>
        </div>

        {mode === "single" ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((method) => (
                <PaymentMethodButton
                  key={method}
                  method={method}
                  isSelected={selectedMethod === method}
                  onClick={() => {
                    setSelectedMethod(method);
                    if (method !== "CASH") {
                      setCashTendered(total.toFixed(2));
                    }
                  }}
                />
              ))}
            </div>

            {selectedMethod === "CASH" ? (
              <CashTenderedInput
                total={total}
                value={cashTendered}
                onChange={setCashTendered}
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-3xl font-bold">{formatCurrency(total)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Reference / Transaction ID
                  </label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Enter reference number"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <SplitPaymentForm
            payments={splitPayments}
            total={total}
            onUpdate={setSplitPayments}
          />
        )}
      </div>

      <div className="border-t p-4">
        <Button
          className="w-full h-14 text-lg font-bold"
          onClick={handleComplete}
          disabled={!canComplete || isProcessing}
        >
          {isProcessing ? (
            "Processing..."
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Complete Sale
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
