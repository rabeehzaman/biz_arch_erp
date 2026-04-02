"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Split, CheckCircle2 } from "lucide-react";
import { PaymentMethodButton } from "./payment-method-button";
import { CashTenderedInput } from "./cash-tendered-input";
import { SplitPaymentForm, type PaymentEntry } from "./split-payment-form";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ENABLED_POS_PAYMENT_METHODS,
  type POSPaymentMethod,
} from "@/lib/pos/payment-methods";

interface PaymentPanelProps {
  total: number;
  availableMethods: POSPaymentMethod[];
  onBack: () => void;
  onComplete: (payments: PaymentEntry[], isCreditSale?: boolean) => void;
  isProcessing: boolean;
  hasCustomer: boolean;
}

export function PaymentPanel({
  total,
  availableMethods,
  onBack,
  onComplete,
  isProcessing,
  hasCustomer,
}: PaymentPanelProps) {
  const { fmt: formatCurrency } = useCurrency();
  const { t } = useLanguage();
  const checkoutMethods = useMemo(
    () =>
      availableMethods.length > 0
        ? availableMethods
        : DEFAULT_ENABLED_POS_PAYMENT_METHODS,
    [availableMethods],
  );
  const defaultMethod = checkoutMethods[0] ?? "CASH";
  const [mode, setMode] = useState<"single" | "split">("single");
  const [preferredMethod, setPreferredMethod] =
    useState<POSPaymentMethod>(defaultMethod);
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [cashTendered, setCashTendered] = useState(total.toFixed(2));
  const [reference, setReference] = useState("");
  const [splitPayments, setSplitPayments] = useState<PaymentEntry[]>([
    {
      method: defaultMethod,
      amount: total.toFixed(2),
      reference: "",
    },
  ]);
  const selectedMethod = checkoutMethods.includes(preferredMethod)
    ? preferredMethod
    : defaultMethod;
  const normalizedSplitPayments = useMemo(
    () =>
      splitPayments.map((payment) =>
        checkoutMethods.includes(payment.method as POSPaymentMethod)
          ? payment
          : {
              ...payment,
              method: defaultMethod,
              reference: defaultMethod === "CASH" ? "" : payment.reference,
            },
      ),
    [checkoutMethods, defaultMethod, splitPayments],
  );

  const handleComplete = () => {
    if (mode === "single") {
      const amount =
        selectedMethod === "CASH" || isCreditSale
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
      onComplete(normalizedSplitPayments, false); // Split assumes full payment for now
    }
  };

  const getPaidAmount = () => {
    if (mode === "single") {
      if (selectedMethod === "CASH" || isCreditSale) {
        return parseFloat(cashTendered) || 0;
      }

      return total;
    }

    return normalizedSplitPayments.reduce(
      (sum, p) => sum + (parseFloat(p.amount) || 0),
      0,
    );
  };

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const paidAmount = getPaidAmount();
  const roundedTotal = Math.round(total * 100) / 100;
  const balanceDue = Math.max(0, roundedTotal - paidAmount);

  const canComplete =
    mode === "single"
      ? isCreditSale
        ? hasCustomer && tenderedAmount < roundedTotal && tenderedAmount >= 0
        : selectedMethod === "CASH"
          ? tenderedAmount >= roundedTotal
          : true
      : paidAmount >= roundedTotal;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/60">
      <div className="hidden items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur md:flex">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold">{t("pos.checkout")}</h2>
        <div className="ml-auto text-xl font-bold tracking-tight text-primary">
          {formatCurrency(total)}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 pb-4 md:overflow-hidden">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
          <Button
            variant={mode === "single" ? "secondary" : "ghost"}
            size="sm"
            type="button"
            className={cn(
              "h-10 rounded-xl border-0 text-sm font-semibold shadow-none",
              mode === "single"
                ? "bg-white text-slate-900 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
            )}
            onClick={() => setMode("single")}
          >
            {t("pos.singlePayment")}
          </Button>
          <Button
            variant={mode === "split" ? "secondary" : "ghost"}
            size="sm"
            type="button"
            className={cn(
              "h-10 rounded-xl border-0 text-sm font-semibold shadow-none",
              mode === "split"
                ? "bg-white text-slate-900 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
            )}
            onClick={() => setMode("split")}
          >
            <Split className="h-3 w-3 mr-1" />
            {t("pos.split")}
          </Button>
        </div>

        {mode === "single" ? (
          <div className="flex flex-col gap-2 sm:grid sm:items-start sm:gap-2 sm:grid-cols-[minmax(220px,0.92fr)_minmax(0,1.08fr)]">
            <div className="contents sm:flex sm:flex-col sm:gap-2">
              <div className="order-1 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)]">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t("payments.paymentMethod")}
                </p>
                <div
                  className={`grid gap-1.5 ${
                    checkoutMethods.length <= 2
                      ? "grid-cols-2"
                      : checkoutMethods.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2 md:grid-cols-4"
                  }`}
                >
                  {checkoutMethods.map((method) => (
                    <PaymentMethodButton
                      key={method}
                      method={method}
                      isSelected={selectedMethod === method}
                      compact
                      onClick={() => {
                        setPreferredMethod(method);
                        if (method !== "CASH") {
                          setCashTendered(total.toFixed(2));
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="order-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)]">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="credit-sale"
                    checked={isCreditSale}
                    onChange={(e) => {
                      setIsCreditSale(e.target.checked);
                      if (
                        e.target.checked &&
                        parseFloat(cashTendered) >= total
                      ) {
                        setCashTendered("0.00"); // Reset tendered if switching to credit
                      } else if (!e.target.checked) {
                        setCashTendered(total.toFixed(2));
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                  />
                  <label
                    htmlFor="credit-sale"
                    className="cursor-pointer text-sm font-medium text-slate-700"
                  >
                    {t("pos.markAsCreditSale")}
                  </label>
                </div>
                {isCreditSale && (
                  <div className="mt-2.5 rounded-2xl border border-orange-200 bg-orange-50 p-2.5">
                    {!hasCustomer ? (
                      <p className="text-center text-sm font-bold text-red-600">
                        {t("pos.customerMustBeSelectedForCreditSale")}
                      </p>
                    ) : (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-orange-800">
                          {t("pos.balanceDue")}:
                        </span>
                        <span className="text-lg font-bold text-orange-800 tabular-nums">
                          {formatCurrency(balanceDue)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="order-2">
              {selectedMethod === "CASH" ? (
                <CashTenderedInput
                  total={total}
                  value={cashTendered}
                  onChange={setCashTendered}
                />
              ) : (
                <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t("payments.paymentMethod")}
                      </p>
                      <p className="text-sm text-slate-600">
                        {selectedMethod === "CREDIT_CARD"
                          ? t("pos.card")
                          : t("pos.bankMethod")}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {isCreditSale
                        ? t("pos.balanceDue")
                        : t("pos.completeSale")}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("pos.totalDue")}
                      </p>
                      <p className="text-xl font-bold tabular-nums">
                        {formatCurrency(total)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center text-emerald-700">
                      <p className="text-[11px] uppercase tracking-wide">
                        {t("pos.totalPaid")}
                      </p>
                      <p className="text-xl font-bold tabular-nums">
                        {formatCurrency(isCreditSale ? tenderedAmount : total)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("pos.referenceOrTransactionId")}
                    </label>
                    <Input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={t("pos.enterReferenceNumber")}
                      className="h-10 border-slate-200 bg-slate-50 shadow-none"
                    />
                  </div>
                  {isCreditSale && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t("pos.amount")}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder="0.00"
                        className="h-10 border-slate-200 bg-slate-50 text-right shadow-none"
                      />
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t("pos.amount")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {isCreditSale
                        ? t("pos.balanceDue")
                        : t("pos.completeSale")}
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                      {formatCurrency(isCreditSale ? balanceDue : total)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)]">
            <SplitPaymentForm
              payments={normalizedSplitPayments}
              total={total}
              availableMethods={checkoutMethods}
              onUpdate={setSplitPayments}
            />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3 sm:hidden">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isCreditSale ? t("pos.balanceDue") : t("pos.totalDue")}
            </p>
            <p className="text-sm text-slate-500">
              {mode === "split"
                ? t("pos.splitPayment")
                : t("pos.singlePayment")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">
              {formatCurrency(isCreditSale ? balanceDue : total)}
            </p>
          </div>
        </div>
        <Button
          className="h-11 w-full text-base font-bold shadow-[0_18px_36px_-24px_rgba(14,165,233,0.55)]"
          onClick={handleComplete}
          disabled={!canComplete || isProcessing}
        >
          {isProcessing ? (
            t("pos.processing")
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {t("pos.completeSale")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
