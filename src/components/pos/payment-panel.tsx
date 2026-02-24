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
  onComplete: (payments: PaymentEntry[], isCreditSale?: boolean) => void;
  isProcessing: boolean;
  hasCustomer: boolean;
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
  hasCustomer,
}: PaymentPanelProps) {
  const [mode, setMode] = useState<"single" | "split">("single");
  const [selectedMethod, setSelectedMethod] = useState("CASH");
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [cashTendered, setCashTendered] = useState(total.toFixed(2));
  const [reference, setReference] = useState("");
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([
    { method: "CASH", amount: total.toFixed(2), reference: "" },
  ]);

  const handleComplete = () => {
    if (mode === "single") {
      const amount =
        selectedMethod === "CASH"
          ? parseFloat(cashTendered) || 0
          : total;

      const payments: PaymentEntry[] = [];

      // Only include a payment entry if amount is > 0
      if (amount > 0 && !isCreditSale) {
        payments.push({
          method: selectedMethod,
          amount: amount.toFixed(2),
          reference: selectedMethod !== "CASH" ? reference : "",
        });
      } else if (isCreditSale && amount > 0) {
        // Partial payment on credit sale
        payments.push({
          method: selectedMethod,
          amount: amount.toFixed(2),
          reference: selectedMethod !== "CASH" ? reference : "",
        });
      }

      onComplete(payments, isCreditSale);
    } else {
      onComplete(splitPayments, false); // Split assumes full payment for now
    }
  };

  const getPaidAmount = () => {
    if (mode === "single") {
      return isCreditSale ? (parseFloat(cashTendered) || 0) : total;
    }
    return splitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };

  const paidAmount = getPaidAmount();
  const balanceDue = Math.max(0, total - paidAmount);

  const canComplete =
    mode === "single"
      ? isCreditSale
        ? hasCustomer && paidAmount < total && paidAmount >= 0 // Must have customer for credit sale
        : selectedMethod === "CASH"
          ? (parseFloat(cashTendered) || 0) >= total
          : true
      : paidAmount >= total;

  return (
    <div className="flex h-full flex-col">
      <div className="hidden md:flex items-center gap-2 border-b p-3">
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

            <div className="pt-4 border-t mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="credit-sale"
                  checked={isCreditSale}
                  onChange={(e) => {
                    setIsCreditSale(e.target.checked);
                    if (e.target.checked && parseFloat(cashTendered) >= total) {
                      setCashTendered("0.00"); // Reset tendered if switching to credit
                    } else if (!e.target.checked) {
                      setCashTendered(total.toFixed(2));
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <label htmlFor="credit-sale" className="text-sm font-medium cursor-pointer">
                  Mark as Credit Sale (Partial/No Payment)
                </label>
              </div>
            </div>

            {isCreditSale && (
              <div className="rounded-lg bg-orange-50 p-4 border border-orange-200 mt-2">
                {!hasCustomer ? (
                  <p className="text-sm text-red-600 font-medium font-bold text-center">
                    A customer MUST be selected for a credit sale.
                  </p>
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-orange-800 font-medium">Balance Due:</span>
                    <span className="text-orange-800 font-bold text-lg">{formatCurrency(balanceDue)}</span>
                  </div>
                )}
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
