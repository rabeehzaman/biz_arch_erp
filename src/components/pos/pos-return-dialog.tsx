"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2, Search, X, Plus, Minus, RotateCcw, CheckCircle, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CustomerSelect } from "@/components/pos/customer-select";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import type { ReceiptData } from "@/components/pos/receipt";
import {
  openCashDrawerIfEnabled,
  smartPrintReceipt,
  isElectronEnvironment,
  printAndCacheReceiptWithConfig,
} from "@/lib/electron-print";

interface ReturnItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  hsnCode?: string;
}

interface POSProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  gstRate: number;
  hsnCode: string | null;
  stockQuantity: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface POSReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  branchId?: string | null;
  warehouseId?: string | null;
  products: POSProduct[];
  onComplete: () => void;
  companySettings?: Record<string, string | undefined>;
  receiptPrintingEnabled?: boolean;
  isSaudiOrg?: boolean;
}

type Step = "items" | "confirm" | "success";

export function POSReturnDialog({
  open,
  onOpenChange,
  sessionId,
  branchId,
  warehouseId,
  products,
  onComplete,
  companySettings,
  receiptPrintingEnabled,
  isSaudiOrg,
}: POSReturnDialogProps) {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("items");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [lastReturnReceiptData, setLastReturnReceiptData] = useState<ReceiptData | null>(null);

  const reset = useCallback(() => {
    setStep("items");
    setSelectedCustomer(null);
    setReturnItems([]);
    setReason("");
    setSearchQuery("");
    setIsProcessing(false);
    setCreditNoteNumber("");
    setLastReturnReceiptData(null);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, reset]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q))
    ).slice(0, 8);
  }, [products, searchQuery]);

  const addReturnItem = useCallback((product: POSProduct) => {
    setReturnItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.price),
          gstRate: Number(product.gstRate) || 0,
          hsnCode: product.hsnCode || undefined,
        },
      ];
    });
    setSearchQuery("");
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setReturnItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const updatePrice = useCallback((productId: string, price: number) => {
    setReturnItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, unitPrice: price } : i))
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setReturnItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const totals = useMemo(() => {
    const subtotal = returnItems.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0
    );
    const taxAmount = returnItems.reduce(
      (sum, i) => sum + (i.quantity * i.unitPrice * i.gstRate) / 100,
      0
    );
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [returnItems]);

  const processReturn = async () => {
    if (returnItems.length === 0) return;
    setIsProcessing(true);

    try {
      const res = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || undefined,
          posSessionId: sessionId,
          branchId: branchId || undefined,
          warehouseId: warehouseId || undefined,
          reason: reason || undefined,
          appliedToBalance: !!selectedCustomer,
          items: returnItems.map((item) => ({
            productId: item.productId,
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            ...(isSaudiOrg
              ? { vatRate: item.gstRate }
              : { gstRate: item.gstRate, hsnCode: item.hsnCode }),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process return");
      }

      const result = await res.json();
      setCreditNoteNumber(result.creditNoteNumber);

      // Open cash drawer
      openCashDrawerIfEnabled();

      // Build return receipt
      const receiptData: ReceiptData = {
        storeName: companySettings?.companyName || "Store",
        storeAddress: companySettings?.companyAddress,
        storeCity: companySettings?.companyCity,
        storeState: companySettings?.companyState,
        storePhone: companySettings?.companyPhone,
        storeGstin: companySettings?.companyGstNumber,
        invoiceNumber: result.creditNoteNumber,
        date: new Date(),
        customerName: selectedCustomer?.name,
        items: returnItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: 0,
          lineTotal: item.quantity * item.unitPrice,
        })),
        subtotal: totals.subtotal,
        taxRate: 0,
        taxAmount: totals.taxAmount,
        total: totals.total,
        payments: [],
        change: 0,
        isReturn: true,
        brandColor: companySettings?.brandColor,
        currency: companySettings?.currency,
      };
      setLastReturnReceiptData(receiptData);

      // Auto-print if enabled
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

  const handleDone = () => {
    onComplete();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            {t("pos.salesReturn")}
          </DialogTitle>
          <DialogDescription>
            {step === "items" && t("pos.selectReturnItems")}
            {step === "confirm" && t("pos.confirmReturn")}
            {step === "success" && t("pos.creditNoteCreated")}
          </DialogDescription>
        </DialogHeader>

        {step === "items" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Customer Select */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t("common.customer")}</label>
              <CustomerSelect
                selectedCustomer={selectedCustomer}
                onSelect={setSelectedCustomer}
              />
            </div>

            {/* Product Search */}
            <div>
              <label className="text-sm font-medium mb-1 block">{t("pos.addProduct")}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("pos.searchProductsByNameOrSku")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {filteredProducts.length > 0 && (
                <div className="mt-1 rounded-md border bg-white shadow-sm max-h-40 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addReturnItem(product)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex justify-between items-center"
                    >
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground">{fmt(Number(product.price))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Return Items */}
            {returnItems.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("pos.returnItems")}</label>
                {returnItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center border rounded">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.productId, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.productId, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">@</span>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updatePrice(item.productId, parseFloat(e.target.value) || 0)
                          }
                          className="h-7 w-24 text-sm"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">
                        {fmt(item.quantity * item.unitPrice)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-700"
                        onClick={() => removeItem(item.productId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reason */}
            {returnItems.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">{t("pos.returnReason")}</label>
                <Textarea
                  placeholder={t("pos.returnReasonPlaceholder")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("common.customer")}</span>
                <span className="font-medium">{selectedCustomer?.name || t("pos.walkInCustomer")}</span>
              </div>
              {reason && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("pos.returnReason")}</span>
                  <span className="font-medium truncate ml-4">{reason}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              {returnItems.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm py-1">
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span className="font-medium">{fmt(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1">
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
              <div className="flex justify-between text-lg font-bold">
                <span>{t("pos.returnTotal")}</span>
                <span>{fmt(totals.total)}</span>
              </div>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{t("pos.creditNoteCreated")}</p>
              <p className="text-sm text-muted-foreground mt-1">{creditNoteNumber}</p>
              <p className="text-lg font-bold mt-2">{fmt(totals.total)}</p>
            </div>
            <Button
              variant="outline"
              onClick={handlePrintReceipt}
              className="mt-2"
            >
              <Printer className="h-4 w-4 mr-2" />
              {t("pos.printReturnReceipt")}
            </Button>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {step === "items" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t("pos.cancel")}
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={returnItems.length === 0}
              >
                {t("pos.reviewReturn")}
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("items")}>
                {t("common.back")}
              </Button>
              <Button
                onClick={processReturn}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("pos.processReturn")}
              </Button>
            </>
          )}
          {step === "success" && (
            <Button onClick={handleDone} className="w-full sm:w-auto">
              {t("common.done")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
