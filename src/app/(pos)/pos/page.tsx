"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ShoppingCart, PauseCircle, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface POSSessionData {
  id: string;
  sessionNumber: string;
  openingCash: number;
  totalSales: number;
  totalTransactions: number;
  openedAt: string;
}

interface POSProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
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

export default function POSPage() {
  const router = useRouter();

  // Session state
  const { data: sessionData, mutate: mutateSession, isLoading: sessionLoading } = useSWR(
    "/api/pos/sessions/current",
    fetcher
  );
  const posSession: POSSessionData | null = sessionData?.session ?? null;

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
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showHeldSheet, setShowHeldSheet] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  // Tax rate — fetched from org settings, editable per session
  const { data: taxRateSetting } = useSWR<{ value: string }>(
    posSession ? "/api/settings/pos-tax-rate" : null,
    fetcher
  );
  const [taxRateOverride, setTaxRateOverride] = useState<number | null>(null);
  const taxRate = taxRateOverride ?? (taxRateSetting?.value ? parseFloat(taxRateSetting.value) : 0);

  // ── Cart Handlers ──────────────────────────────────────────────────

  const addToCart = useCallback((product: POSProduct) => {
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
        },
      ];
    });
  }, []);

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

  const openSession = async () => {
    setIsOpeningSession(true);
    try {
      const res = await fetch("/api/pos/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: parseFloat(openingCash) || 0 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to open session");
      }
      await mutateSession();
      setShowOpenDialog(false);
      setOpeningCash("");
      toast.success("POS session opened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open session");
    } finally {
      setIsOpeningSession(false);
    }
  };

  const closeSession = async () => {
    if (!posSession) return;
    setIsClosingSession(true);
    try {
      const res = await fetch(`/api/pos/sessions/${posSession.id}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: parseFloat(closingCash) || 0 }),
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close session");
    } finally {
      setIsClosingSession(false);
    }
  };

  // ── Checkout ───────────────────────────────────────────────────────

  const handleCheckout = async (payments: PaymentEntry[]) => {
    setIsProcessing(true);
    try {
      const { subtotal } = calculateCartTotal(cart, taxRate);
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || undefined,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount,
          })),
          taxRate,
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

      clearCart();
      setView("cart");
      setMobileView("products");
      await Promise.all([mutateSession(), mutateHeldOrders(), mutateProducts()]);

      if (change > 0) {
        toast.success(
          `Sale complete! Change: ${change.toLocaleString("en-IN", { style: "currency", currency: "INR" })}`
        );
      } else {
        toast.success(`Sale complete! Invoice: ${result.invoice?.invoiceNumber}`);
      }

      if (result.warnings?.length > 0) {
        result.warnings.forEach((w: string) => toast.warning(w));
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
      const { subtotal } = calculateCartTotal(cart, taxRate);
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
    // Refresh stock quantities from current product data to avoid stale caps
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

  // ── No Active Session → Show Open Dialog ───────────────────────────

  if (!posSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Dialog open={true}>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Open POS Session</DialogTitle>
              <DialogDescription>
                Enter the opening cash amount to start a new POS session.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Opening Cash</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  min={0}
                  step="0.01"
                  className="mt-1"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => router.push("/")}>
                Exit POS
              </Button>
              <Button onClick={openSession} disabled={isOpeningSession}>
                {isOpeningSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Open Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Active Session → Full POS Interface ────────────────────────────

  const { total } = calculateCartTotal(cart, taxRate);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <POSHeader
        session={posSession}
        heldOrdersCount={heldOrders.length}
        onHeldOrdersClick={() => setShowHeldSheet(true)}
        onCloseSession={() => setShowCloseDialog(true)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Products (always visible on desktop, conditional on mobile) */}
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

        {/* Right Panel — Cart / Payment (always visible on desktop, conditional on mobile) */}
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
              {mobileView === "payment" ? "Payment" : "Cart"}
            </h2>
            {cart.length > 0 && (
              <div className="ml-auto text-sm font-bold text-primary">
                {total.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
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
                    <p className="text-sm">Cart is empty</p>
                    <p className="text-xs">Add products to get started</p>
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
                  <CartSummary items={cart} taxRate={taxRate} />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={holdOrder}
                    >
                      <PauseCircle className="h-4 w-4 mr-1" />
                      Hold
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearCart}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <Button
                    className="w-full h-12 text-lg font-bold"
                    onClick={() => {
                      setView("payment");
                      setMobileView("payment");
                    }}
                  >
                    Pay{" "}
                    {total.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                    })}
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
            />
          )}
        </div>

        {/* Floating cart FAB — mobile only, visible when browsing products */}
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
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close POS Session</DialogTitle>
            <DialogDescription>
              Enter the closing cash amount to end this session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Session</span>
                <p className="font-medium">{posSession.sessionNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Opened</span>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(posSession.openedAt), { addSuffix: true })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Opening Cash</span>
                <p className="font-medium">
                  {Number(posSession.openingCash).toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                  })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Transactions</span>
                <p className="font-medium">{posSession.totalTransactions}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Closing Cash</label>
              <Input
                type="number"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                min={0}
                step="0.01"
                className="mt-1"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={closeSession} disabled={isClosingSession}>
              {isClosingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Close Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Orders Sheet */}
      <Sheet open={showHeldSheet} onOpenChange={setShowHeldSheet}>
        <SheetContent side="right" className="w-full sm:w-[400px] sm:max-w-[450px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Held Orders ({heldOrders.length})</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100%-65px)]">
            {heldOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <PauseCircle className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No held orders</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {heldOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border bg-white p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {order.customer?.name || order.customerName || "Walk-in Customer"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.heldAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-bold">
                        {Number(order.subtotal).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                        })}
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
                        Restore
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
    </div>
  );
}
