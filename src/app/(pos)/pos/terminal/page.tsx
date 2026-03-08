"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ShoppingCart, PauseCircle, Trash2, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageAnimation } from "@/components/ui/page-animation";

import { cn } from "@/lib/utils";
import { POSHeader } from "@/components/pos/pos-header";
import { ProductSearch } from "@/components/pos/product-search";
import { CategoryTabs } from "@/components/pos/category-tabs";
import { ProductGrid } from "@/components/pos/product-grid";
import { CartItem, type CartItemData } from "@/components/pos/cart-item";
import { CartSummary, calculateCartTotal } from "@/components/pos/cart-summary";
import { CustomerSelect } from "@/components/pos/customer-select";
import { PaymentPanel } from "@/components/pos/payment-panel";
import type { PaymentEntry } from "@/components/pos/split-payment-form";
import type { ReceiptData } from "@/components/pos/receipt";
import { smartPrintReceipt } from "@/lib/electron-print";
import { useLanguage } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const USE_CASH_ACCOUNT_VALUE = "__use_cash_account__";

interface POSSessionData {
  id: string;
  sessionNumber: string;
  openingCash: number;
  totalSales: number;
  totalTransactions: number;
  openedAt: string;
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
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
  categoryId: string | null;
  category: { id: string; name: string; slug: string; color: string | null } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface HeldOrder {
  id: string;
  customerId: string | null;
  customerName: string | null;
  customer: { name: string } | null;
  items: CartItemData[];
  subtotal: number;
  notes: string | null;
  heldAt: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

function POSTerminalContent() {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const { data: authSession } = useSession();
  const taxInclusive = !!(authSession?.user as { isTaxInclusivePrice?: boolean } | undefined)?.isTaxInclusivePrice;
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  // Session state — fetch by sessionId if provided
  const sessionUrl = sessionId
    ? `/api/pos/sessions/current?sessionId=${sessionId}`
    : "/api/pos/sessions/current";
  const { data: sessionData, mutate: mutateSession, isLoading: sessionLoading } = useSWR(
    sessionUrl,
    fetcher
  );
  const posSession: POSSessionData | null = sessionData?.session ?? null;

  // Redirect to dashboard if no session found (after loading)
  useEffect(() => {
    if (!sessionLoading && !posSession) {
      router.replace("/pos");
    }
  }, [sessionLoading, posSession, router]);

  // Products & categories
  const { data: products = [], mutate: mutateProducts } = useSWR<POSProduct[]>(
    posSession ? "/api/pos/products" : null,
    fetcher
  );
  const { data: categories = [] } = useSWR<Category[]>(
    posSession ? "/api/product-categories" : null,
    fetcher
  );

  // Held orders
  const { data: heldOrders = [], mutate: mutateHeldOrders } = useSWR<HeldOrder[]>(
    posSession ? "/api/pos/held-orders" : null,
    fetcher
  );

  // Cart state
  const [cart, setCart] = useState<CartItemData[]>([]);
  const [heldOrderId, setHeldOrderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [view, setView] = useState<"cart" | "payment">("cart");
  const [mobileView, setMobileView] = useState<"products" | "cart" | "payment">("products");
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog state
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showHeldSheet, setShowHeldSheet] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [debouncedClosingCash, setDebouncedClosingCash] = useState("");
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [settleCashAccountId, setSettleCashAccountId] = useState("");
  const [settleBankAccountId, setSettleBankAccountId] = useState("");
  const autoFilledRef = useRef(false);

  // Fetch org settings for POS accounting mode
  const { data: orgSettings } = useSWR<{ posAccountingMode: string }>(
    posSession ? "/api/pos/org-settings" : null,
    fetcher
  );
  const isClearingMode = orgSettings?.posAccountingMode === "CLEARING_ACCOUNT";

  // Fetch Cash/Bank accounts for settlement (only in clearing mode)
  interface CashBankAccountOption {
    id: string;
    name: string;
    accountSubType: string;
  }
  const { data: cashBankAccounts = [] } = useSWR<CashBankAccountOption[]>(
    isClearingMode && showCloseDialog ? "/api/cash-bank-accounts?activeOnly=true" : null,
    fetcher
  );
  const { data: registerConfigData } = useSWR<{
    config: {
      defaultCashAccountId: string | null;
      defaultBankAccountId: string | null;
    } | null;
  }>(
    posSession
      ? `/api/pos/register-configs?branchId=${posSession.branch?.id ?? "null"}&warehouseId=${posSession.warehouse?.id ?? "null"}`
      : null,
    fetcher
  );

  // POS Session Summary (for Expected Cash during closing)
  const { data: sessionSummary, isLoading: isLoadingSummary } = useSWR<{ paymentBreakdown: { method: string; total: number }[] }>(
    showCloseDialog && posSession?.id ? `/api/pos/sessions/${posSession.id}/summary` : null,
    fetcher
  );

  // Debounce closing cash input so diff doesn't flicker mid-typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClosingCash(closingCash), 400);
    return () => clearTimeout(timer);
  }, [closingCash]);

  const expectedCash = posSession
    ? Number(posSession.openingCash) +
    (sessionSummary?.paymentBreakdown?.find((p) => p.method === "CASH")?.total || 0)
    : 0;

  const cashDifference = parseFloat(debouncedClosingCash || "0") - expectedCash;

  // Receipt printing
  const { data: receiptSetting } = useSWR<{ value: string }>(
    posSession ? "/api/settings/pos-receipt-printing" : null,
    fetcher
  );
  const { data: companySettings } = useSWR(
    posSession ? "/api/settings" : null,
    fetcher
  );

  const receiptPrintingEnabled = receiptSetting?.value === "true";
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!showCloseDialog || !isClearingMode) {
      autoFilledRef.current = false; // reset when dialog closes
      return;
    }
    if (autoFilledRef.current) return; // already auto-filled for this dialog open
    autoFilledRef.current = true;
    if (registerConfigData?.config?.defaultCashAccountId) {
      setSettleCashAccountId(registerConfigData.config.defaultCashAccountId);
    }
    if (registerConfigData?.config?.defaultBankAccountId) {
      setSettleBankAccountId(registerConfigData.config.defaultBankAccountId);
    }
  }, [showCloseDialog, isClearingMode, registerConfigData]);

  // ── Cart Handlers ──────────────────────────────────────────────────

   
  const addToCart = useCallback((product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          discount: 0,
          stockQuantity: product.stockQuantity,
          gstRate: Number(product.gstRate) || 0,
          hsnCode: product.hsnCode || undefined,
        },
      ];
    });
  }, []);

  // ── Barcode Scanner Listener ───────────────────────────────────────
  useEffect(() => {
    if (!posSession || showCloseDialog || showHeldSheet || view === "payment") return;

    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const currentTime = Date.now();

      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = "";
      }
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          e.preventDefault();

          const product = products.find(p => p.barcode === barcodeBuffer || p.sku === barcodeBuffer);

          if (product) {
            addToCart(product);
            toast.success(`Added ${product.name}`);
          } else {
            toast.error(`Product not found for barcode: ${barcodeBuffer}`);
          }

          barcodeBuffer = "";
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [posSession, products, showCloseDialog, showHeldSheet, view, addToCart]);

  const updateCartQuantity = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      )
    );
  }, []);

  const updateCartDiscount = useCallback((productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, discount: Math.max(0, Math.min(100, discount)) }
          : item
      )
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setHeldOrderId(null);
    setSelectedCustomer(null);
    setMobileView("products");
  }, []);

  // ── Session Handlers ───────────────────────────────────────────────

  const closeSession = async () => {
    if (!posSession) return;
    setIsClosingSession(true);
    try {
      const res = await fetch(`/api/pos/sessions/${posSession.id}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCash: parseFloat(closingCash) || 0,
          ...(isClearingMode && {
            settleCashAccountId: settleCashAccountId || null,
            settleBankAccountId:
              settleBankAccountId === USE_CASH_ACCOUNT_VALUE ? null : settleBankAccountId || null,
          }),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to close session");
      }
      clearCart();
      await mutateSession();
      setShowCloseDialog(false);
      setClosingCash("");
      toast.success("POS session closed");
      router.replace("/pos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close session");
    } finally {
      setIsClosingSession(false);
    }
  };

  const openCloseSessionDialog = () => {
    setClosingCash("");
    if (isClearingMode) {
      setSettleCashAccountId(registerConfigData?.config?.defaultCashAccountId || "");
      setSettleBankAccountId(
        registerConfigData?.config?.defaultBankAccountId || USE_CASH_ACCOUNT_VALUE
      );
    } else {
      setSettleCashAccountId("");
      setSettleBankAccountId(USE_CASH_ACCOUNT_VALUE);
    }
    setShowCloseDialog(true);
  };

  // ── Checkout ───────────────────────────────────────────────────────

  const handleCheckout = async (payments: PaymentEntry[]) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: posSession?.id,
          customerId: selectedCustomer?.id || undefined,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount,
            gstRate: item.gstRate || 0,
            hsnCode: item.hsnCode || undefined,
          })),
          payments: payments.map((p) => ({
            method: p.method,
            amount: parseFloat(p.amount),
            reference: p.reference || undefined,
          })),
          heldOrderId: heldOrderId || undefined,
          notes: undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Checkout failed");
      }

      const result = await res.json();
      const change = result.change || 0;
      const receiptMeta = result.receiptMeta;

      // Build receipt data before clearing cart
      const receiptData: ReceiptData = {
        storeName: companySettings?.companyName || "Store",
        storeAddress: companySettings?.companyAddress,
        storeCity: companySettings?.companyCity,
        storeState: companySettings?.companyState,
        storePhone: companySettings?.companyPhone,
        storeGstin: companySettings?.companyGstNumber,
        invoiceNumber: result.invoice?.invoiceNumber || "",
        date: new Date(),
        customerName: selectedCustomer?.name,
        items: cart.map((item) => {
          const lineTotal = item.quantity * item.price * (1 - (item.discount || 0) / 100);
          return {
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
            lineTotal,
          };
        }),
        subtotal: Number(result.invoice?.subtotal) || calculateCartTotal(cart, taxInclusive).subtotal,
        taxRate: receiptMeta?.taxLabel === "VAT" ? 15 : 0,
        taxAmount: receiptMeta?.taxLabel === "VAT"
          ? Number(result.invoice?.totalVat || 0)
          : (Number(result.invoice?.totalCgst || 0) + Number(result.invoice?.totalSgst || 0) + Number(result.invoice?.totalIgst || 0)) || calculateCartTotal(cart, taxInclusive).taxAmount,
        total: Number(result.invoice?.total) || calculateCartTotal(cart, taxInclusive).total,
        payments: payments.map((p) => ({
          method: p.method,
          amount: parseFloat(p.amount),
        })),
        change,
        // Enhanced fields from checkout response
        logoUrl: receiptMeta?.logoUrl || undefined,
        logoHeight: receiptMeta?.logoHeight || undefined,
        qrCodeDataURL: receiptMeta?.qrCodeDataURL || undefined,
        vatNumber: receiptMeta?.vatNumber || companySettings?.companyGstNumber || undefined,
        arabicName: receiptMeta?.arabicName || undefined,
        taxLabel: receiptMeta?.taxLabel || undefined,
        brandColor: receiptMeta?.brandColor || undefined,
        currency: receiptMeta?.currency || undefined,
        isTaxInclusivePrice: receiptMeta?.isTaxInclusivePrice || false,
      };
      setLastReceiptData(receiptData);

      clearCart();
      setView("cart");
      setMobileView("products");
      await Promise.all([mutateSession(), mutateHeldOrders(), mutateProducts()]);

      if (change > 0) {
        toast.success(
          `Sale complete! Change: ${fmt(change)}`
        );
      } else {
        toast.success(`Sale complete! Invoice: ${result.invoice?.invoiceNumber}`);
      }

      if (result.warnings?.length > 0) {
        result.warnings.forEach((w: string) => toast.warning(w));
      }

      // Auto-print receipt (fire-and-forget)
      if (receiptPrintingEnabled) {
        try {
          smartPrintReceipt(receiptData);
        } catch (e) {
          console.error("Receipt printing failed:", e);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Hold / Restore ─────────────────────────────────────────────────

  const holdOrder = async () => {
    if (cart.length === 0) return;
    try {
      const { subtotal } = calculateCartTotal(cart, taxInclusive);
      const res = await fetch("/api/pos/held-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || undefined,
          customerName: selectedCustomer?.name || undefined,
          items: cart,
          subtotal,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to hold order");
      }
      clearCart();
      await mutateHeldOrders();
      toast.success("Order held successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to hold order");
    }
  };

  const restoreHeldOrder = (order: HeldOrder) => {
    const restoredItems = (order.items as CartItemData[]).map((item) => {
      const currentProduct = products.find((p) => p.id === item.productId);
      return {
        ...item,
        stockQuantity: currentProduct?.stockQuantity ?? item.stockQuantity,
        price: currentProduct ? Number(currentProduct.price) : item.price,
      };
    });
    setCart(restoredItems);
    setHeldOrderId(order.id);
    if (order.customerId && order.customer) {
      setSelectedCustomer({
        id: order.customerId,
        name: order.customer.name,
        phone: null,
      });
    }
    setShowHeldSheet(false);
    setMobileView("cart");
    toast.success("Order restored to cart");
  };

  const deleteHeldOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/pos/held-orders/${orderId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await mutateHeldOrders();
      toast.success("Held order deleted");
    } catch {
      toast.error("Failed to delete held order");
    }
  };

  // ── Loading State ──────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No session → redirect handled by useEffect above
  if (!posSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Active Session → Full POS Interface ────────────────────────────

  const { total } = calculateCartTotal(cart, taxInclusive);

  return (
    <PageAnimation className="flex h-screen flex-col">
      {/* Header */}
      <POSHeader
        session={posSession}
        branchName={posSession.branch?.name}
        warehouseName={posSession.warehouse?.name}
        heldOrdersCount={heldOrders.length}
        onHeldOrdersClick={() => setShowHeldSheet(true)}
        onCloseSession={openCloseSessionDialog}
        onBackToSessions={() => router.push("/pos")}
        onReprintReceipt={lastReceiptData ? () => {
          try {
            smartPrintReceipt(lastReceiptData);
          } catch (e) {
            console.error("Receipt reprint failed:", e);
          }
        } : undefined}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Products */}
        <div className={cn(
          "flex-1 flex-col gap-3 p-4 overflow-hidden",
          mobileView === "products" ? "flex" : "hidden md:flex"
        )}>
          <ProductSearch value={searchQuery} onChange={setSearchQuery} />
          <CategoryTabs
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <ProductGrid
            products={products}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            onAddToCart={addToCart}
          />
        </div>

        {/* Right Panel — Cart / Payment */}
        <div className={cn(
          "flex flex-col bg-white",
          "md:w-[400px] md:flex-shrink-0 md:border-l",
          mobileView !== "products" ? "flex-1" : "hidden md:flex"
        )}>
          {/* Mobile back header */}
          <div className="flex items-center gap-2 border-b p-3 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileView(mobileView === "payment" ? "cart" : "products")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-bold">
              {mobileView === "payment" ? t("pos.checkout") : t("pos.cart")}
            </h2>
            {cart.length > 0 && (
              <div className="ml-auto text-sm font-bold text-primary">
                {fmt(total)}
              </div>
            )}
          </div>

          {view === "cart" ? (
            <>
              {/* Customer Select */}
              <div className="border-b p-3">
                <CustomerSelect
                  selectedCustomer={selectedCustomer}
                  onSelect={setSelectedCustomer}
                />
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">{t("pos.emptyCart")}</p>
                    <p className="text-xs">{t("pos.addProducts")}</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <CartItem
                      key={item.productId}
                      item={item}
                      onUpdateQuantity={(qty) =>
                        updateCartQuantity(item.productId, qty)
                      }
                      onUpdateDiscount={(discount) =>
                        updateCartDiscount(item.productId, discount)
                      }
                      onRemove={() => removeFromCart(item.productId)}
                    />
                  ))
                )}
              </div>

              {/* Cart Summary & Actions */}
              {cart.length > 0 && (
                <div className="border-t p-3 space-y-3">
                  <CartSummary items={cart} isTaxInclusivePrice={taxInclusive} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={holdOrder}
                    >
                      <PauseCircle className="h-4 w-4 mr-1" />
                      {t("pos.holdOrder").split(" ")[0]}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearCart}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("pos.clearCart").split(" ")[0]}
                    </Button>
                  </div>
                  <Button
                    className="w-full h-12 text-lg font-bold"
                    onClick={() => {
                      setView("payment");
                      setMobileView("payment");
                    }}
                  >
                    {t("pos.payNow")}{" "}
                    {fmt(total)}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <PaymentPanel
              total={total}
              onBack={() => {
                setView("cart");
                setMobileView("cart");
              }}
              onComplete={handleCheckout}
              isProcessing={isProcessing}
              hasCustomer={!!selectedCustomer}
            />
          )}
        </div>

        {/* Floating cart FAB — mobile only */}
        {mobileView === "products" && cart.length > 0 && (
          <button
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform md:hidden"
            onClick={() => setMobileView("cart")}
          >
            <ShoppingCart className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </button>
        )}
      </div>

      {/* Close Session Dialog */}
      <Dialog
        open={showCloseDialog}
        onOpenChange={(open) => {
          setShowCloseDialog(open);
          if (!open) {
            setClosingCash("");
          }
        }}
      >
          <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pos.closePosSession")}</DialogTitle>
            <DialogDescription>
              {t("pos.enterClosingCashAmount")}
            </DialogDescription>
          </DialogHeader>
            <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">{t("pos.session")}</span>
                <p className="font-medium">{posSession.sessionNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("pos.opened")}</span>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(posSession.openedAt), { addSuffix: true })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("pos.openingCash")}</span>
                <p className="font-medium">
                  {fmt(Number(posSession.openingCash))}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("pos.transactions")}</span>
                <p className="font-medium">{posSession.totalTransactions}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("pos.expectedCash")}</span>
                <p className="font-medium">
                  {isLoadingSummary ? (
                    <Loader2 className="h-3 w-3 animate-spin inline" />
                  ) : (
                    fmt(expectedCash)
                  )}
                </p>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="text-sm font-medium">{t("pos.countedClosingCash")}</label>
                {closingCash && !isLoadingSummary && (
                  <span className={cn(
                    "text-sm font-medium",
                    cashDifference > 0 ? "text-green-600" : (cashDifference < 0 ? "text-red-600" : "text-slate-600")
                  )}>
                    {t("pos.diff")} {cashDifference > 0 ? "+" : ""}{fmt(cashDifference)}
                  </span>
                )}
              </div>
              <Input
                type="number"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                min={0}
                step="0.01"
                autoFocus
              />
            </div>

            {/* Settlement Account Selectors (only in clearing account mode) */}
            {isClearingMode && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs text-muted-foreground font-medium">Settlement Accounts</p>
                <div className="space-y-2">
                  <Label className="text-sm">{t("pos.depositCashTo")}</Label>
                  <Select value={settleCashAccountId} onValueChange={setSettleCashAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("pos.selectCashAccount")} />
                    </SelectTrigger>
                    <SelectContent>
                      {cashBankAccounts
                        .filter((a) => a.accountSubType === "CASH")
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{t("pos.depositNonCashTo")}</Label>
                  <Select value={settleBankAccountId} onValueChange={setSettleBankAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("pos.selectBankAccountOptional")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={USE_CASH_ACCOUNT_VALUE}>
                        {t("pos.useCashAccountFallback")}
                      </SelectItem>
                      {cashBankAccounts
                        .filter((a) => a.accountSubType === "BANK")
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("pos.ifNotSelectedNonCashPaymentsGoToCashAccount")}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)} className="w-full sm:w-auto">
              {t("pos.cancel")}
            </Button>
            <Button
              onClick={closeSession}
              disabled={isClosingSession || (isClearingMode && !settleCashAccountId)}
              className="w-full sm:w-auto"
            >
              {isClosingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("pos.closePosSession")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Orders Sheet */}
      <Sheet open={showHeldSheet} onOpenChange={setShowHeldSheet}>
        <SheetContent side="right" className="w-full sm:w-[400px] sm:max-w-[450px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>{t("pos.heldOrders")} ({heldOrders.length})</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-65px)]">
            {heldOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <PauseCircle className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">{t("pos.emptyCart")}</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {heldOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border bg-white p-3 space-y-2"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {order.customer?.name || order.customerName || t("pos.walkInCustomer")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.heldAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-bold">
                        {fmt(Number(order.subtotal))}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(order.items as CartItemData[]).length} item(s)
                      {order.notes && ` — ${order.notes}`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => restoreHeldOrder(order)}
                      >
                        {t("pos.recallOrder")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteHeldOrder(order.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageAnimation>
  );
}

export default function POSTerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-100">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <POSTerminalContent />
    </Suspense>
  );
}
