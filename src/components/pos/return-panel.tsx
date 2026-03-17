"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, Loader2, CheckCircle, Printer, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { CartItemData } from "@/components/pos/cart-item";
import { calculateCartTotal } from "@/components/pos/cart-summary";
import type { ReceiptData } from "@/components/pos/receipt";
import type { RoundOffMode } from "@/lib/round-off";
import {
  openCashDrawerIfEnabled,
  smartPrintReceipt,
  isElectronEnvironment,
  printAndCacheReceiptWithConfig,
} from "@/lib/electron-print";

interface ReturnPanelProps {
  items: CartItemData[];
  sessionId: string;
  branchId?: string | null;
  warehouseId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  companySettings?: Record<string, string | undefined>;
  receiptPrintingEnabled?: boolean;
  isSaudiOrg?: boolean;
  isTaxInclusive?: boolean;
  roundOffMode?: RoundOffMode;
  onBack: () => void;
  onComplete: () => void;
}

export function ReturnPanel({
  items,
  sessionId,
  branchId,
  warehouseId,
  customerId,
  customerName,
  companySettings,
  receiptPrintingEnabled,
  isSaudiOrg,
  isTaxInclusive,
  roundOffMode = "NONE",
  onBack,
  onComplete,
}: ReturnPanelProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"confirm" | "success">("confirm");
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [lastReturnReceiptData, setLastReturnReceiptData] = useState<ReceiptData | null>(null);

  const totals = useMemo(
    () => calculateCartTotal(items, isTaxInclusive, roundOffMode),
    [items, isTaxInclusive, roundOffMode]
  );

  const processReturn = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);

    try {
      const res = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          posSessionId: sessionId,
          branchId: branchId || undefined,
          warehouseId: warehouseId || undefined,
          reason: reason || undefined,
          appliedToBalance: true,
          applyRoundOff: roundOffMode !== "NONE",
          items: items.map((item) => ({
            productId: item.productId,
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
            ...(isSaudiOrg
              ? { vatRate: item.gstRate || 0 }
              : { gstRate: item.gstRate || 0, hsnCode: item.hsnCode }),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process return");
      }

      const result = await res.json();
      setCreditNoteNumber(result.creditNoteNumber);

      openCashDrawerIfEnabled();

      const receiptData: ReceiptData = {
        storeName: companySettings?.companyName || "Store",
        storeAddress: companySettings?.companyAddress,
        storeCity: companySettings?.companyCity,
        storeState: companySettings?.companyState,
        storePhone: companySettings?.companyPhone,
        storeGstin: companySettings?.companyGstNumber,
        invoiceNumber: result.creditNoteNumber,
        date: new Date(),
        customerName: customerName || undefined,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
          lineTotal: item.quantity * item.price * (1 - (item.discount || 0) / 100),
        })),
        subtotal: totals.subtotal,
        taxRate: 0,
        taxAmount: totals.taxAmount,
        roundOffAmount: totals.roundOffAmount,
        total: totals.total,
        payments: [],
        change: 0,
        isReturn: true,
        brandColor: companySettings?.brandColor,
        currency: companySettings?.currency,
        isTaxInclusivePrice: isTaxInclusive,
      };
      setLastReturnReceiptData(receiptData);

      if (receiptPrintingEnabled) {
        if (isElectronEnvironment()) {
          void printAndCacheReceiptWithConfig(receiptData);
        } else {
          try {
            smartPrintReceipt(receiptData);
          } catch (e) {
            console.error("Return receipt print failed:", e);
          }
        }
      }

      setStep("success");
      toast.success(t("pos.creditNoteCreated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process return");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!lastReturnReceiptData) return;
    try {
      if (isElectronEnvironment()) {
        void printAndCacheReceiptWithConfig(lastReturnReceiptData);
      } else {
        smartPrintReceipt(lastReturnReceiptData);
      }
    } catch (e) {
      console.error("Return receipt print failed:", e);
    }
  };

  if (step === "success") {
    return (
      <div className="flex h-full min-h-0 flex-col bg-slate-50/60">
        <div className="hidden items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur md:flex">
          <h2 className="text-lg font-bold text-green-700">{t("pos.creditNoteCreated")}</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-4">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{t("pos.creditNoteCreated")}</p>
            <p className="text-sm text-muted-foreground mt-1">{creditNoteNumber}</p>
            <p className="text-lg font-bold mt-2">{fmt(totals.total)}</p>
          </div>
          <Button variant="outline" onClick={handlePrintReceipt} className="mt-2">
            <Printer className="h-4 w-4 mr-2" />
            {t("pos.printReturnReceipt")}
          </Button>
        </div>
        <div className="border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
          <Button onClick={onComplete} className="h-11 w-full text-base font-bold">
            {t("common.done")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/60">
      <div className="hidden items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur md:flex">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          {t("pos.salesReturn")}
        </h2>
        <div className="ml-auto text-xl font-bold tracking-tight text-red-600">
          {fmt(totals.total)}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 pb-4">
        {/* Items Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {t("pos.returnItems")} ({items.length})
          </p>
          <div className="space-y-1.5">
            {items.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="text-slate-700">
                  {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                </span>
                <span className="font-medium">
                  {fmt(item.quantity * item.price * (1 - (item.discount || 0) / 100))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("common.subtotal")}</span>
            <span>{fmt(totals.subtotal)}</span>
          </div>
          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("common.tax")}</span>
              <span>{fmt(totals.taxAmount)}</span>
            </div>
          )}
          {totals.roundOffAmount !== 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Round Off</span>
              <span>{totals.roundOffAmount > 0 ? "+" : ""}{fmt(totals.roundOffAmount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold text-red-700">
            <span>{t("pos.returnTotal")}</span>
            <span>{fmt(totals.total)}</span>
          </div>
        </div>

        {/* Customer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("common.customer")}</span>
            <span className="font-medium">{customerName || t("pos.walkInCustomer")}</span>
          </div>
        </div>

        {/* Reason */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
            {t("pos.returnReason")}
          </label>
          <Textarea
            placeholder={t("pos.returnReasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-3 sm:hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("pos.returnTotal")}
          </p>
          <p className="text-xl font-bold tracking-tight text-red-700 tabular-nums">
            {fmt(totals.total)}
          </p>
        </div>
        <Button
          className="h-11 w-full text-base font-bold bg-red-600 hover:bg-red-700 shadow-[0_18px_36px_-24px_rgba(220,38,38,0.55)]"
          onClick={processReturn}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t("pos.processing") || "Processing..."}
            </>
          ) : (
            <>
              <RotateCcw className="h-5 w-5 mr-2" />
              {t("pos.processReturn")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
