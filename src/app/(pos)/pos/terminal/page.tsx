"use client";

import { Suspense, useState, useCallback, useEffect, useRef, useMemo, useReducer, useDeferredValue } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ShoppingCart, PauseCircle, Trash2, ArrowLeft, RotateCcw, UtensilsCrossed } from "lucide-react";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageAnimation } from "@/components/ui/page-animation";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { POSHeader } from "@/components/pos/pos-header";
import { ProductSearch } from "@/components/pos/product-search";
import { CategoryTabs } from "@/components/pos/category-tabs";
import { ProductGrid } from "@/components/pos/product-grid";
import { ViewModeToggle } from "@/components/pos/view-mode-toggle";
import { usePosViewMode } from "@/hooks/use-pos-view-mode";
import { CartItem, type CartItemData } from "@/components/pos/cart-item";
import { CartSummary, calculateCartTotal } from "@/components/pos/cart-summary";
import { CustomerSelect } from "@/components/pos/customer-select";
import { PaymentPanel } from "@/components/pos/payment-panel";
import type { PaymentEntry } from "@/components/pos/split-payment-form";
import type { ReceiptData } from "@/components/pos/receipt";
import { ReturnPanel } from "@/components/pos/return-panel";
import { PreviousOrdersSheet } from "@/components/pos/previous-orders-sheet";
import { TableSelect } from "@/components/pos/table-select";
import { printKOT, printKOTMulti } from "@/lib/restaurant/kot-print";
import type { KOTReceiptData } from "@/components/restaurant/kot-receipt";
import {
  cacheReceiptArtifactWithConfig,
  isElectronEnvironment,
  loadLatestCachedReceipt,
  openCashDrawerIfEnabled,
  printAndCacheReceiptWithConfig,
  printLatestCachedReceipt,
  smartPrintReceipt,
} from "@/lib/electron-print";
import { useLanguage } from "@/lib/i18n";
import { INDIAN_STATES } from "@/lib/gst/constants";
import { printPOSSessionReport } from "@/lib/print-session-report";
import {
  DEFAULT_ENABLED_POS_PAYMENT_METHODS,
  type POSPaymentMethod,
} from "@/lib/pos/payment-methods";
import { normalizeRoundOffMode, roundCurrency } from "@/lib/round-off";
import { parseWeightBarcode, type WeighMachineConfig } from "@/lib/weigh-machine/barcode-parser";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const USE_CASH_ACCOUNT_VALUE = "__use_cash_account__";
const EMPTY_PAYMENT_BREAKDOWN: { method: string; total: number }[] = [];

interface POSSessionData {
  id: string;
  sessionNumber: string;
  employeeId?: string | null;
  openingCash: number;
  totalSales: number;
  totalTransactions: number;
  openedAt: string;
  employee?: { id: string; name: string } | null;
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
}

interface CurrentSessionResponse {
  session: POSSessionData | null;
}

interface POSJewelleryItem {
  id: string;
  tagNumber: string;
  huidNumber: string | null;
  metalType: string;
  purity: string;
  grossWeight: number;
  stoneWeight: number;
  netWeight: number;
  fineWeight: number;
  makingChargeType: string;
  makingChargeValue: number;
  wastagePercent: number;
  stoneValue: number;
  costPrice: number;
  status: string;
  categoryName: string | null;
}

interface POSUnitConversion {
  id: string;
  unitId: string;
  unit: { id: string; name: string; code: string } | null;
  conversionFactor: number;
  barcode: string | null;
  price: number | null;
  isDefaultUnit?: boolean;
}

interface POSProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  gstRate: number;
  hsnCode: string | null;
  stockQuantity: number | null;
  categoryId: string | null;
  category: { id: string; name: string; slug: string; color: string | null } | null;
  weighMachineCode: string | null;
  isService?: boolean;
  isBundle?: boolean;
  unitConversions?: POSUnitConversion[];
  jewelleryItem?: POSJewelleryItem | null;
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

interface CheckoutTimingPayload {
  requestTotalMs: number;
  requestStages: Record<string, number>;
  transactionStages: Record<string, number>;
}

type CartAction =
  | { type: "ADD"; product: any; quantity?: number; unitId?: string; unitName?: string; conversionFactor?: number; price?: number | null }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" }
  | { type: "RESTORE"; items: CartItemData[] };

interface CartState {
  items: CartItemData[];
  totalQuantity: number;
  selectedProductQuantities: Record<string, number>;
  revision: number;
}

function getPaymentMethodLabel(method: string, t: (key: string) => string) {
  switch (method) {
    case "CASH":
      return t("payments.cash");
    case "CREDIT_CARD":
      return t("pos.card");
    case "BANK_TRANSFER":
      return t("common.bankTransfer");
    case "UPI":
      return "UPI";
    case "CASH_REFUND":
      return t("pos.cashRefund");
    default:
      return method.replace(/_/g, " ");
  }
}

function formatSignedDifference(amount: number, fmt: (value: number) => string) {
  if (amount > 0) {
    return `+${fmt(Math.abs(amount))}`;
  }
  if (amount < 0) {
    return `-${fmt(Math.abs(amount))}`;
  }
  return fmt(0);
}

function normalizeAmountInput(rawValue: string) {
  const westernDigits = rawValue
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");

  const cleaned = westernDigits.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) {
    return "";
  }

  const [wholePartRaw, ...fractionParts] = cleaned.split(".");
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, "") || "0";

  if (fractionParts.length === 0 && !cleaned.includes(".")) {
    return wholePart;
  }

  const fractionPart = fractionParts.join("").slice(0, 2);
  return `${wholePart}.${fractionPart}`;
}

function parseAmountInput(rawValue: string) {
  return parseFloat(normalizeAmountInput(rawValue) || "0") || 0;
}

function roundTimingMs(value: number) {
  return Number(value.toFixed(2));
}

function buildCartState(items: CartItemData[], previousRevision = -1): CartState {
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    selectedProductQuantities: items.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = item.quantity;
      return acc;
    }, {}),
    revision: previousRevision + 1,
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const { product, quantity, unitId, unitName, conversionFactor: cf, price: altPrice } = action;
      const effectiveConversionFactor = cf ?? 1;
      const effectivePrice = altPrice != null ? altPrice : Number(product.price);
      // Match existing cart line by productId + unitId so the same product in different units gets separate lines
      const idx = state.items.findIndex((item) => item.productId === product.id && (item.unitId || undefined) === (unitId || undefined));
      if (idx >= 0) {
        const newItems = [...state.items];
        const currentItem = newItems[idx];
        newItems[idx] = {
          ...currentItem,
          quantity: quantity != null ? currentItem.quantity + quantity : currentItem.quantity + 1,
        };
        return buildCartState(newItems, state.revision);
      }
      // Build jewellery data if product is jewellery-linked
      const ji = product.jewelleryItem;
      const jewelleryData = ji ? {
        jewelleryItemId: ji.id,
        goldRate: 0, // Will be set from live rate
        purity: ji.purity,
        metalType: ji.metalType,
        grossWeight: ji.grossWeight,
        stoneWeight: ji.stoneWeight,
        netWeight: ji.netWeight,
        fineWeight: ji.fineWeight,
        wastagePercent: ji.wastagePercent,
        makingChargeType: ji.makingChargeType,
        makingChargeValue: ji.makingChargeValue,
        stoneValue: ji.stoneValue,
        tagNumber: ji.tagNumber,
        huidNumber: ji.huidNumber,
      } : null;

      const newItems = [
        ...state.items,
        {
          productId: product.id,
          name: product.name,
          price: effectivePrice,
          quantity: quantity ?? 1,
          discount: 0,
          stockQuantity: product.stockQuantity ?? 0,
          gstRate: Number(product.gstRate) || 0,
          hsnCode: product.hsnCode || (ji ? "7113" : undefined),
          unitId,
          unitName,
          conversionFactor: effectiveConversionFactor,
          jewellery: jewelleryData,
          categoryId: product.categoryId ?? null,
        },
      ];
      return buildCartState(newItems, state.revision);
    }
    case "REMOVE":
      return buildCartState(
        state.items.filter((item) => item.productId !== action.productId),
        state.revision
      );
    case "CLEAR":
      return buildCartState([], state.revision);
    case "RESTORE":
      return buildCartState(action.items, state.revision);
    default:
      return state;
  }
}

function POSTerminalContent() {
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const { data: authSession } = useSession();
  const taxInclusive = !!(authSession?.user as { isTaxInclusivePrice?: boolean } | undefined)?.isTaxInclusivePrice;
  const isSaudiOrg = !!(authSession?.user as { saudiEInvoiceEnabled?: boolean } | undefined)?.saudiEInvoiceEnabled;

  // Weigh machine config from session
  const weighMachineEnabled = !!(authSession?.user as { isWeighMachineEnabled?: boolean })?.isWeighMachineEnabled;
  const weighMachineConfig = useMemo<WeighMachineConfig>(() => ({
    prefix: (authSession?.user as { weighMachineBarcodePrefix?: string | null })?.weighMachineBarcodePrefix ?? "77",
    productCodeLen: (authSession?.user as { weighMachineProductCodeLen?: number | null })?.weighMachineProductCodeLen ?? 5,
    weightDigits: (authSession?.user as { weighMachineWeightDigits?: number | null })?.weighMachineWeightDigits ?? 5,
    decimalPlaces: (authSession?.user as { weighMachineDecimalPlaces?: number | null })?.weighMachineDecimalPlaces ?? 3,
  }), [authSession]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  // Session state — fetch by sessionId if provided
  const sessionUrl = sessionId
    ? `/api/pos/sessions/current?sessionId=${sessionId}`
    : "/api/pos/sessions/current";
  const { data: sessionData, mutate: mutateSession, isLoading: sessionLoading } = useSWR<CurrentSessionResponse>(
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
  const {
    data: products = [],
    mutate: mutateProducts,
    isLoading: productsLoading,
  } = useSWR<POSProduct[]>(
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
  const [cartState, dispatchCart] = useReducer(cartReducer, undefined, () => buildCartState([]));
  const [heldOrderId, setHeldOrderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { viewMode, setViewMode } = usePosViewMode();
  const [view, setView] = useState<"cart" | "payment">("cart");
  const [mobileView, setMobileView] = useState<"products" | "cart" | "payment">("products");
  const [isProcessing, setIsProcessing] = useState(false);

  // Dialog state
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showHeldSheet, setShowHeldSheet] = useState(false);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [showPreviousOrdersSheet, setShowPreviousOrdersSheet] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [closePinCode, setClosePinCode] = useState("");
  const [countedClosingCash, setCountedClosingCash] = useState<number | null>(null);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [settleCashAccountId, setSettleCashAccountId] = useState("");
  const [settleBankAccountId, setSettleBankAccountId] = useState("");
  const [chargedFromProducts, setChargedFromProducts] = useState(false);
  const autoFilledRef = useRef(false);
  const cartItemsContainerRef = useRef<HTMLDivElement | null>(null);
  const previousCartMetricsRef = useRef({ items: 0, quantity: 0 });
  const checkoutInFlightRef = useRef(false);
  const checkoutCounterRef = useRef(0);

  // Restaurant state
  const isRestaurantEnabled = !!(authSession?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled;
  const [selectedTable, setSelectedTable] = useState<{ id: string; number: number; name: string; section?: string; capacity: number } | null>(null);
  const [showTableSelect, setShowTableSelect] = useState(false);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [guestCount, setGuestCount] = useState<number>(1);
  const [kotSentQuantities, setKotSentQuantities] = useState<Map<string, number>>(new Map());
  const [kotOrderIds, setKotOrderIds] = useState<string[]>([]);

  // Listen for guest count from table selection
  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail;
      if (typeof count === "number") setGuestCount(count);
    };
    window.addEventListener("restaurant-guest-count", handler);
    return () => window.removeEventListener("restaurant-guest-count", handler);
  }, []);

  // Fetch org settings for POS accounting mode
  const { data: orgSettings } = useSWR<{ posAccountingMode: string; roundOffMode: string; posDefaultCashAccountId: string | null; posDefaultBankAccountId: string | null }>(
    posSession ? "/api/pos/org-settings" : null,
    fetcher
  );
  const { data: paymentMethodsData } = useSWR<{ methods: POSPaymentMethod[] }>(
    posSession ? "/api/settings/pos-payment-methods" : null,
    fetcher
  );
  const isClearingMode = orgSettings?.posAccountingMode === "CLEARING_ACCOUNT";
  const roundOffMode = normalizeRoundOffMode(orgSettings?.roundOffMode);
  const enabledPaymentMethods = paymentMethodsData?.methods?.length
    ? paymentMethodsData.methods
    : DEFAULT_ENABLED_POS_PAYMENT_METHODS;

  // Settlement accounts are auto-filled from register config or org defaults
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

  const paymentBreakdown = sessionSummary?.paymentBreakdown ?? EMPTY_PAYMENT_BREAKDOWN;
  const paymentTotals = useMemo(
    () =>
      paymentBreakdown.reduce<Record<string, number>>((totals, payment) => {
        totals[payment.method] = roundCurrency((totals[payment.method] || 0) + Number(payment.total || 0));
        return totals;
      }, {}),
    [paymentBreakdown]
  );
  const cashSalesTotal = paymentTotals.CASH || 0;
  const cashRefundsTotal = Math.abs(paymentTotals.CASH_REFUND || 0);
  const nonCashTotal = roundCurrency(
    Object.entries(paymentTotals).reduce(
      (sum, [method, total]) => (method === "CASH" || method === "CASH_REFUND" ? sum : sum + total),
      0
    )
  );
  const expectedCash = posSession
    ? roundCurrency(Number(posSession.openingCash) + cashSalesTotal - cashRefundsTotal)
    : 0;

  const parsedClosingCash = countedClosingCash ?? 0;
  const cashDifference = countedClosingCash !== null
    ? roundCurrency(countedClosingCash - expectedCash)
    : null;
  const visiblePaymentBreakdown = useMemo(
    () =>
      paymentBreakdown
        .filter((payment) => Number(payment.total) !== 0)
        .sort((a, b) => {
          if (a.method === "CASH") return -1;
          if (b.method === "CASH") return 1;
          if (a.method === "CASH_REFUND") return 1;
          if (b.method === "CASH_REFUND") return -1;
          return Number(b.total) - Number(a.total);
        }),
    [paymentBreakdown]
  );

  // Receipt printing
  const { data: receiptSetting } = useSWR<{ value: string }>(
    posSession ? "/api/settings/pos-receipt-printing" : null,
    fetcher
  );
  const { data: sessionReportLanguageSetting } = useSWR<{ value: "en" | "ar" }>(
    posSession ? "/api/settings/pos-session-report-language" : null,
    fetcher
  );
  const { data: companySettings } = useSWR(
    posSession ? "/api/settings" : null,
    fetcher
  );

  const receiptPrintingEnabled = receiptSetting?.value === "true";
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);
  const [isPendingReceipt, setIsPendingReceipt] = useState(false);
  const cart = cartState.items;
  const cartQuantity = cartState.totalQuantity;
  const selectedProductQuantities = cartState.selectedProductQuantities;
  const cartTotals = useMemo(
    () => calculateCartTotal(cartState.items, taxInclusive, roundOffMode),
    [cartState.items, taxInclusive, roundOffMode]
  );
  const scanCodeIndex = useMemo(() => {
    const index = new Map<string, { product: POSProduct; unitId?: string; unitName?: string; conversionFactor?: number; price?: number | null }>();

    for (const product of products) {
      const defaultUc = product.unitConversions?.find((uc) => uc.isDefaultUnit);
      const defaultEntry = defaultUc
        ? { product, unitId: defaultUc.unitId, unitName: defaultUc.unit?.name, conversionFactor: Number(defaultUc.conversionFactor), price: defaultUc.price != null ? Number(defaultUc.price) : null }
        : { product };
      if (product.barcode) {
        index.set(product.barcode, defaultEntry);
      }
      if (product.sku) {
        index.set(product.sku, defaultEntry);
      }
      // Index alt-unit barcodes
      for (const uc of product.unitConversions || []) {
        if (uc.barcode) {
          index.set(uc.barcode, {
            product,
            unitId: uc.unitId,
            unitName: uc.unit?.name,
            conversionFactor: Number(uc.conversionFactor),
            price: uc.price != null ? Number(uc.price) : null,
          });
        }
      }
    }

    return index;
  }, [products]);
  const weighCodeIndex = useMemo(() => {
    const index = new Map<string, POSProduct>();

    for (const product of products) {
      if (product.weighMachineCode) {
        index.set(product.weighMachineCode, product);
      }
    }

    return index;
  }, [products]);

  useEffect(() => {
    if (!posSession || !isElectronEnvironment()) {
      return;
    }

    let isMounted = true;
    void loadLatestCachedReceipt().then((cachedReceipt) => {
      if (!isMounted || !cachedReceipt) {
        return;
      }

      setLastReceiptData((current) => current ?? cachedReceipt);
    });

    return () => {
      isMounted = false;
    };
  }, [posSession]);

  useEffect(() => {
    if (!showCloseDialog || !isClearingMode) {
      autoFilledRef.current = false; // reset when dialog closes
      return;
    }
    if (autoFilledRef.current) return; // already auto-filled for this dialog open
    autoFilledRef.current = true;
    const cashDefault = registerConfigData?.config?.defaultCashAccountId || orgSettings?.posDefaultCashAccountId || "";
    const bankDefault = registerConfigData?.config?.defaultBankAccountId || orgSettings?.posDefaultBankAccountId || "";
    if (cashDefault) {
      setSettleCashAccountId(cashDefault);
    }
    if (bankDefault) {
      setSettleBankAccountId(bankDefault);
    }
  }, [showCloseDialog, isClearingMode, registerConfigData, orgSettings]);

  // ── Cart Handlers ──────────────────────────────────────────────────

  const syncClosingCashValue = useCallback((rawValue: string) => {
    const normalizedValue = normalizeAmountInput(rawValue);
    setClosingCash(normalizedValue);
    setCountedClosingCash(
      normalizedValue === "" ? null : roundCurrency(parseAmountInput(normalizedValue))
    );
  }, []);

  const addToCart = useCallback((product: any, quantity?: number, unitId?: string, unitName?: string, conversionFactor?: number, price?: number | null) => {
    dispatchCart({ type: "ADD", product, quantity, unitId, unitName, conversionFactor, price });
  }, []);

  // Wrapper for product tile clicks — applies default unit if set
  const addToCartWithDefault = useCallback((tileProduct: any) => {
    const fullProduct = products.find(p => p.id === tileProduct.id);
    const defaultUc = fullProduct?.unitConversions?.find((uc: any) => uc.isDefaultUnit);
    if (defaultUc) {
      addToCart(tileProduct, 1, defaultUc.unitId, defaultUc.unit?.name, Number(defaultUc.conversionFactor), defaultUc.price != null ? Number(defaultUc.price) : null);
    } else {
      addToCart(tileProduct);
    }
  }, [products, addToCart]);

  // ── Barcode Scanner Listener ───────────────────────────────────────
  useEffect(() => {
    if (!posSession || showCloseDialog || showHeldSheet || view === "payment") return;

    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();

      if (currentTime - lastKeyTime > 50) {
        barcodeBuffer = "";
      }
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          e.preventDefault();

          // Try weigh machine barcode first
          if (weighMachineEnabled) {
            const parsed = parseWeightBarcode(barcodeBuffer, weighMachineConfig);
            if (parsed) {
              const weightProduct = weighCodeIndex.get(parsed.productCode);
              if (weightProduct) {
                addToCart(weightProduct, parsed.weightKg);
                setSearchQuery("");
                toast.success(`${weightProduct.name} — ${parsed.weightKg} kg`);
                barcodeBuffer = "";
                return;
              }
              // No product found by weighMachineCode — fall through to regular barcode lookup
            }
          }

          // Fall back to regular barcode/SKU lookup
          const match = scanCodeIndex.get(barcodeBuffer);

          if (match) {
            addToCart(match.product, undefined, match.unitId, match.unitName, match.conversionFactor, match.price);
            setSearchQuery("");
            const displayName = match.unitName ? `${match.product.name} (${match.unitName})` : match.product.name;
            toast.success(`Added ${displayName}`);
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
  }, [posSession, showCloseDialog, showHeldSheet, view, addToCart, weighMachineEnabled, weighMachineConfig, weighCodeIndex, scanCodeIndex, setSearchQuery]);

  const removeFromCart = useCallback((productId: string) => {
    dispatchCart({ type: "REMOVE", productId });
  }, []);

  const scrollCartToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = cartItemsContainerRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    });
  }, []);

  useEffect(() => {
    const previous = previousCartMetricsRef.current;
    const hasAddedLine = cart.length > previous.items;
    const hasAddedQuantity = cartQuantity > previous.quantity;

    previousCartMetricsRef.current = {
      items: cart.length,
      quantity: cartQuantity,
    };

    if (cart.length === 0 || (!hasAddedLine && !hasAddedQuantity) || view !== "cart") {
      return;
    }

    scrollCartToBottom(hasAddedLine ? "smooth" : "auto");
  }, [cart.length, cartQuantity, scrollCartToBottom, view]);

  useEffect(() => {
    if (cart.length === 0 || view !== "cart" || mobileView !== "cart") {
      return;
    }

    scrollCartToBottom("auto");
  }, [cart.length, mobileView, scrollCartToBottom, view]);

  const clearCart = useCallback(() => {
    dispatchCart({ type: "CLEAR" });
    setHeldOrderId(null);
    setSelectedCustomer(null);
    setMobileView("products");
  }, []);

  const applyOptimisticCheckoutUpdates = useCallback(
    (completedCart: CartItemData[], completedTotal: number, completedHeldOrderId: string | null) => {
      void mutateSession(
        (current?: CurrentSessionResponse) => {
          if (!current?.session) {
            return current;
          }

          return {
            ...current,
            session: {
              ...current.session,
              totalSales: roundCurrency(Number(current.session.totalSales || 0) + completedTotal),
              totalTransactions: Number(current.session.totalTransactions || 0) + 1,
            },
          };
        },
        { revalidate: false }
      );

      if (completedHeldOrderId) {
        void mutateHeldOrders(
          (current: HeldOrder[] | undefined) =>
            current?.filter((order) => order.id !== completedHeldOrderId),
          { revalidate: false }
        );
      }

      void mutateProducts(
        (currentProducts: POSProduct[] | undefined) => {
          if (!currentProducts || completedCart.length === 0) {
            return currentProducts;
          }

          const soldQuantities = completedCart.reduce<Record<string, number>>((acc, item) => {
            acc[item.productId] = (acc[item.productId] || 0) + Number(item.quantity);
            return acc;
          }, {});

          return currentProducts.map((product) => {
            const soldQuantity = soldQuantities[product.id];
            if (
              !soldQuantity ||
              product.stockQuantity == null ||
              product.isBundle ||
              product.isService
            ) {
              return product;
            }

            return {
              ...product,
              stockQuantity: Math.max(0, Number(product.stockQuantity) - soldQuantity),
            };
          });
        },
        { revalidate: false }
      );
    },
    [mutateHeldOrders, mutateProducts, mutateSession]
  );

  const revalidateCheckoutDataInBackground = useCallback(() => {
    void Promise.allSettled([mutateSession(), mutateHeldOrders(), mutateProducts()]).then((results) => {
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );

      if (rejected.length > 0) {
        console.error(
          "[pos-checkout] Background revalidation failed",
          rejected.map((result) => result.reason)
        );
      }
    });
  }, [mutateHeldOrders, mutateProducts, mutateSession]);

  // ── Session Handlers ───────────────────────────────────────────────

  const closeSession = async () => {
    if (!posSession) return;
    setIsClosingSession(true);
    const closedSessionId = posSession.id;
    try {
      const res = await fetch(`/api/pos/sessions/${posSession.id}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCash: parsedClosingCash,
          pinCode: closePinCode,
          ...(isClearingMode && {
            settleCashAccountId: settleCashAccountId || null,
            settleBankAccountId:
              settleBankAccountId === USE_CASH_ACCOUNT_VALUE ? null : settleBankAccountId || null,
          }),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("pos.failedToCloseSession"));
      }

      let reportPrintError: string | null = null;
      try {
        const reportRes = await fetch(`/api/pos/sessions/${closedSessionId}/summary`);
        if (!reportRes.ok) {
          const data = await reportRes.json().catch(() => null);
          throw new Error(data?.error || t("pos.failedToPrintSessionReport"));
        }

        const report = await reportRes.json();
        const printResult = await printPOSSessionReport({
          report,
          company: {
            companyName: companySettings?.companyName,
            companyAddress: companySettings?.companyAddress,
            companyCity: companySettings?.companyCity,
            companyState: companySettings?.companyState,
            companyPhone: companySettings?.companyPhone,
            companyGstNumber: companySettings?.companyGstNumber,
          },
          language: sessionReportLanguageSetting?.value === "ar" ? "ar" : "en",
        });

        if (!printResult.success) {
          reportPrintError = printResult.error || t("pos.failedToPrintSessionReport");
        }
      } catch (error) {
        reportPrintError = error instanceof Error
          ? error.message
          : t("pos.failedToPrintSessionReport");
      }

      clearCart();
      await mutateSession();
      setShowCloseDialog(false);
      setClosingCash("");
      setClosePinCode("");
      setCountedClosingCash(null);
      if (reportPrintError) {
        toast.error(reportPrintError);
      }
      router.replace("/pos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pos.failedToCloseSession"));
    } finally {
      setIsClosingSession(false);
    }
  };

  const openCloseSessionDialog = () => {
    setClosingCash("");
    setClosePinCode("");
    setCountedClosingCash(null);
    if (isClearingMode) {
      setSettleCashAccountId(registerConfigData?.config?.defaultCashAccountId || orgSettings?.posDefaultCashAccountId || "");
      setSettleBankAccountId(
        registerConfigData?.config?.defaultBankAccountId || orgSettings?.posDefaultBankAccountId || USE_CASH_ACCOUNT_VALUE
      );
    } else {
      setSettleCashAccountId("");
      setSettleBankAccountId(USE_CASH_ACCOUNT_VALUE);
    }
    setShowCloseDialog(true);
  };

  // ── Send to Kitchen (KOT) ─────────────────────────────────────────

  const handleSendToKitchen = async () => {
    // Build list of unsent items (new items or quantity increases)
    const itemsToSend: { productId: string; name: string; quantity: number; categoryId?: string | null }[] = [];
    for (const item of cartState.items) {
      const sentQty = kotSentQuantities.get(item.productId) ?? 0;
      const diff = item.quantity - sentQty;
      if (diff > 0) {
        itemsToSend.push({ productId: item.productId, name: item.name, quantity: diff, categoryId: item.categoryId });
      }
    }
    if (itemsToSend.length === 0) {
      toast.info("No new items to send to kitchen");
      return;
    }

    try {
      const kotType = kotOrderIds.length === 0 ? "STANDARD" : "FOLLOWUP";
      const res = await fetch("/api/restaurant/kot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable?.id || null,
          posSessionId: posSession?.id || null,
          kotType,
          orderType,
          serverName: authSession?.user?.name || undefined,
          guestCount: guestCount || undefined,
          items: itemsToSend.map(item => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            isNew: kotType === "FOLLOWUP",
          })),
        }),
      });

      if (!res.ok) throw new Error("Failed to create KOT");
      const kot = await res.json();

      // Update sent quantities to current cart quantities
      const newSentQtys = new Map(kotSentQuantities);
      for (const item of cartState.items) {
        newSentQtys.set(item.productId, item.quantity);
      }
      setKotSentQuantities(newSentQtys);
      setKotOrderIds(prev => [...prev, kot.id]);

      // Print KOT
      try {
        const kotReceiptData: KOTReceiptData = {
          kotNumber: kot.kotNumber,
          kotType: kot.kotType,
          orderType: kot.orderType,
          tableName: selectedTable?.name,
          tableNumber: selectedTable?.number,
          section: selectedTable?.section || undefined,
          serverName: authSession?.user?.name || undefined,
          guestCount: guestCount || undefined,
          timestamp: new Date(),
          items: itemsToSend.map(item => ({
            name: item.name,
            quantity: item.quantity,
            categoryId: item.categoryId,
            isNew: kotType === "FOLLOWUP",
          })),
        };
        await printKOTMulti(kotReceiptData);
      } catch (printErr) {
        console.error("KOT print failed:", printErr);
        // Don't fail the KOT creation just because printing failed
      }

      toast.success(`KOT ${kot.kotNumber} sent to kitchen`);

      // Update table status to OCCUPIED if it was AVAILABLE
      if (selectedTable?.id) {
        fetch(`/api/restaurant/tables/${selectedTable.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "OCCUPIED", guestCount }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to send KOT:", error);
      toast.error("Failed to send order to kitchen");
    }
  };

  // ── Cancel Sent Kitchen Item (Void KOT) ────────────────────────────

  const [pendingCancelProductId, setPendingCancelProductId] = useState<string | null>(null);

  const handleCartItemRemove = (productId: string) => {
    const sentQty = kotSentQuantities.get(productId) ?? 0;
    if (sentQty > 0) {
      // Item was sent to kitchen — need confirmation + void KOT
      setPendingCancelProductId(productId);
    } else {
      // Not sent to kitchen — remove normally
      removeFromCart(productId);
    }
  };

  const confirmCancelKitchenItem = async () => {
    if (!pendingCancelProductId) return;
    const productId = pendingCancelProductId;
    const sentQty = kotSentQuantities.get(productId) ?? 0;
    const item = cartState.items.find((i) => i.productId === productId);
    if (!item || sentQty <= 0) {
      removeFromCart(productId);
      setPendingCancelProductId(null);
      return;
    }

    try {
      const res = await fetch("/api/restaurant/kot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable?.id || null,
          posSessionId: posSession?.id || null,
          kotType: "VOID",
          orderType,
          serverName: authSession?.user?.name || undefined,
          items: [{ productId: item.productId, name: item.name, quantity: sentQty }],
        }),
      });

      if (!res.ok) throw new Error("Failed to create void KOT");
      const kot = await res.json();
      setKotOrderIds((prev) => [...prev, kot.id]);

      // Print void KOT to kitchen
      try {
        const kotReceiptData: KOTReceiptData = {
          kotNumber: kot.kotNumber,
          kotType: "VOID",
          orderType,
          tableName: selectedTable?.name,
          tableNumber: selectedTable?.number,
          section: selectedTable?.section || undefined,
          serverName: authSession?.user?.name || undefined,
          timestamp: new Date(),
          items: [{ name: item.name, quantity: sentQty, categoryId: item.categoryId }],
        };
        await printKOTMulti(kotReceiptData);
      } catch (printErr) {
        console.error("Void KOT print failed:", printErr);
      }

      // Update sent quantities
      const newSentQtys = new Map(kotSentQuantities);
      newSentQtys.delete(productId);
      setKotSentQuantities(newSentQtys);

      // Remove from cart
      removeFromCart(productId);
      toast.success(`Cancelled: ${item.name} (void KOT sent to kitchen)`);
    } catch (error) {
      console.error("Failed to cancel kitchen item:", error);
      toast.error("Failed to cancel kitchen item");
    } finally {
      setPendingCancelProductId(null);
    }
  };

  // ── Checkout ───────────────────────────────────────────────────────

  const handleCheckout = async (payments: PaymentEntry[]) => {
    if (checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;

    const checkoutStartedAt = performance.now();
    setIsProcessing(true);

    // Snapshot state before clearing — used for receipt building and error recovery
    const completedCart = cart;
    const completedHeldOrderId = heldOrderId;
    const snapshotTotals = cartTotals;

    // Open cash drawer immediately on checkout (no delay)
    openCashDrawerIfEnabled();

    setIsPendingReceipt(true); // hide reprint until new receipt data is ready

    try {
      // Content-based idempotency key: same cart + payments + counter = same key.
      // Counter increments only on success, so retries reuse the same key
      // but legitimate repeat orders get a new key.
      const keySource = JSON.stringify({
        s: posSession?.id,
        n: checkoutCounterRef.current,
        i: completedCart.map(item => `${item.productId}:${item.quantity}:${item.price}:${item.discount}`).sort(),
        p: payments.map(p => `${p.method}:${parseFloat(p.amount)}`).sort(),
      });
      let idempotencyKey: string;
      if (crypto?.subtle) {
        const keyHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keySource));
        idempotencyKey = Array.from(new Uint8Array(keyHash)).map(b => b.toString(16).padStart(2, "0")).join("");
      } else {
        // Fallback for insecure contexts (HTTP localhost)
        let h = 0x811c9dc5;
        for (let i = 0; i < keySource.length; i++) {
          h ^= keySource.charCodeAt(i);
          h = Math.imul(h, 0x01000193);
        }
        idempotencyKey = (h >>> 0).toString(16).padStart(8, "0");
      }

      const requestStartedAt = performance.now();
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: posSession?.id,
          customerId: selectedCustomer?.id || undefined,
          items: completedCart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount,
            gstRate: item.gstRate || 0,
            hsnCode: item.hsnCode || undefined,
            unitId: item.unitId || undefined,
            conversionFactor: item.conversionFactor || 1,
          })),
          payments: payments.map((p) => ({
            method: p.method,
            amount: parseFloat(p.amount),
            reference: p.reference || undefined,
          })),
          heldOrderId: completedHeldOrderId || undefined,
          notes: undefined,
          idempotencyKey,
          tableId: selectedTable?.id || undefined,
          kotOrderIds: kotOrderIds.length > 0 ? kotOrderIds : undefined,
        }),
      });
      const responseReceivedAt = performance.now();

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("pos.checkoutFailed"));
      }

      const result = await res.json();
      checkoutCounterRef.current += 1; // New key for next order; retries keep the old key
      const responseParsedAt = performance.now();
      const change = result.change || 0;
      const receiptMeta = result.receiptMeta;
      const serverTimings = result.timings as CheckoutTimingPayload | undefined;
      const completedTotal = Number(result.invoice?.total) || snapshotTotals.total;

      // Build receipt data from pre-captured snapshots
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
        items: completedCart.map((item, idx) => {
          const lineTotal = item.quantity * item.price * (1 - (item.discount || 0) / 100);
          const invoiceItem = result.invoice?.items?.[idx] as Record<string, unknown> | undefined;
          return {
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
            lineTotal,
            hsnCode: (invoiceItem?.hsnCode as string) || undefined,
            gstRate: Number(invoiceItem?.gstRate || 0) || undefined,
            cgstRate: Number(invoiceItem?.cgstRate || 0) || undefined,
            sgstRate: Number(invoiceItem?.sgstRate || 0) || undefined,
            igstRate: Number(invoiceItem?.igstRate || 0) || undefined,
            cgstAmount: Number(invoiceItem?.cgstAmount || 0) || undefined,
            sgstAmount: Number(invoiceItem?.sgstAmount || 0) || undefined,
            igstAmount: Number(invoiceItem?.igstAmount || 0) || undefined,
          };
        }),
        subtotal: Number(result.invoice?.subtotal) || snapshotTotals.subtotal,
        taxRate: receiptMeta?.taxLabel === "VAT" ? 15 : 0,
        taxAmount: receiptMeta?.taxLabel === "VAT"
          ? Number(result.invoice?.totalVat || 0)
          : (Number(result.invoice?.totalCgst || 0) + Number(result.invoice?.totalSgst || 0) + Number(result.invoice?.totalIgst || 0)) || snapshotTotals.taxAmount,
        roundOffAmount: Number(result.invoice?.roundOffAmount || 0) || snapshotTotals.roundOffAmount,
        total: Number(result.invoice?.total) || snapshotTotals.total,
        payments: payments.map((p) => ({
          method: p.method,
          amount: parseFloat(p.amount),
        })),
        change,
        // Enhanced fields from checkout response
        logoUrl: receiptMeta?.logoUrl || undefined,
        logoHeight: receiptMeta?.logoHeight || undefined,
        qrCodeDataURL: receiptMeta?.qrCodeDataURL || undefined,
        qrCodeText: receiptMeta?.qrCodeText || undefined,
        vatNumber: receiptMeta?.vatNumber || companySettings?.companyGstNumber || undefined,
        arabicName: receiptMeta?.arabicName || undefined,
        taxLabel: receiptMeta?.taxLabel || undefined,
        brandColor: receiptMeta?.brandColor || undefined,
        currency: receiptMeta?.currency || undefined,
        isTaxInclusivePrice: receiptMeta?.isTaxInclusivePrice || false,
        // Indian GST document-level fields
        totalCgst: Number(result.invoice?.totalCgst || 0) || undefined,
        totalSgst: Number(result.invoice?.totalSgst || 0) || undefined,
        totalIgst: Number(result.invoice?.totalIgst || 0) || undefined,
        isInterState: (result.invoice as Record<string, unknown>)?.isInterState as boolean || false,
        placeOfSupply: (result.invoice as Record<string, unknown>)?.placeOfSupply as string || undefined,
        placeOfSupplyName: (() => {
          const pos = (result.invoice as Record<string, unknown>)?.placeOfSupply as string | undefined;
          return pos ? (INDIAN_STATES[pos] || pos) : undefined;
        })(),
      };
      setLastReceiptData(receiptData);
      setIsPendingReceipt(false);

      if (isElectronEnvironment()) {
        if (receiptPrintingEnabled) {
          void printAndCacheReceiptWithConfig(receiptData).then((result) => {
            if (!result.success) {
              console.error("Cached Electron print failed:", result.error);
              try {
                smartPrintReceipt(receiptData);
              } catch (printError) {
                console.error("Fallback receipt printing failed:", printError);
              }
            }
          });
        } else {
          void cacheReceiptArtifactWithConfig(receiptData).then((result) => {
            if (!result.success) {
              console.error("Receipt cache preparation failed:", result.error);
            }
          });
        }
      }

      applyOptimisticCheckoutUpdates(completedCart, completedTotal, completedHeldOrderId);
      revalidateCheckoutDataInBackground();

      // Server confirmed — now clear cart and navigate to products
      clearCart();
      setView("cart");
      setMobileView("products");

      // Reset restaurant state
      setSelectedTable(null);
      setOrderType("DINE_IN");
      setGuestCount(1);
      setKotSentQuantities(new Map());
      setKotOrderIds([]);

      const syncSuccessWorkMs = roundTimingMs(performance.now() - responseParsedAt);
      const clientTimings = {
        apiRoundTripMs: roundTimingMs(responseReceivedAt - requestStartedAt),
        responseParseMs: roundTimingMs(responseParsedAt - responseReceivedAt),
        syncSuccessWorkMs,
        itemCount: completedCart.length,
        paymentCount: payments.length,
        serverRequestTotalMs: serverTimings?.requestTotalMs ?? null,
      };

      if (serverTimings) {
        console.info("[pos-checkout] server timings", serverTimings);
      }

      requestAnimationFrame(() => {
        console.info("[pos-checkout] client timings", {
          ...clientTimings,
          nextPaintMs: roundTimingMs(performance.now() - checkoutStartedAt),
        });
      });

      // Auto-print receipt (fire-and-forget)
      if (receiptPrintingEnabled && !isElectronEnvironment()) {
        try {
          smartPrintReceipt(receiptData);
        } catch (e) {
          console.error("Receipt printing failed:", e);
        }
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pos.checkoutFailed"));
      // Restore cart so user can retry
      dispatchCart({ type: "RESTORE", items: completedCart });
      if (completedHeldOrderId) setHeldOrderId(completedHeldOrderId);
      setView("payment");
      setIsPendingReceipt(false); // restore reprint of previous receipt on failure
    } finally {
      setIsProcessing(false);
      checkoutInFlightRef.current = false;
    }
  };

  // ── Hold / Restore ─────────────────────────────────────────────────

  const holdOrder = async () => {
    if (cart.length === 0) return;
    try {
      const res = await fetch("/api/pos/held-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || undefined,
          customerName: selectedCustomer?.name || undefined,
          items: cart,
          subtotal: cartTotals.subtotal,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("pos.failedToHoldOrder"));
      }
      clearCart();
      await mutateHeldOrders();
      toast.success(t("pos.orderHeldSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pos.failedToHoldOrder"));
    }
  };

  const restoreHeldOrder = (order: HeldOrder) => {
    const restoredItems = (order.items as CartItemData[]).map((item) => {
      const currentProduct = products.find((p) => p.id === item.productId);
      return {
        ...item,
        stockQuantity: currentProduct?.stockQuantity ?? item.stockQuantity,
        price: currentProduct ? Number(currentProduct.price) : item.price,
        conversionFactor: item.conversionFactor ?? 1,
      };
    });
    dispatchCart({ type: "RESTORE", items: restoredItems });
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
    toast.success(t("pos.orderRestoredToCart"));
  };

  const deleteHeldOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/pos/held-orders/${orderId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(t("pos.failedToDeleteHeldOrder"));
      await mutateHeldOrders();
      toast.success(t("pos.heldOrderDeleted"));
    } catch {
      toast.error(t("pos.failedToDeleteHeldOrder"));
    }
  };

  const openHeldOrders = useCallback(() => {
    setShowHeldSheet(true);
  }, []);

  const toggleReturnMode = useCallback(() => {
    setIsReturnMode((prev) => !prev);
    dispatchCart({ type: "CLEAR" });
    setSelectedCustomer(null);
    setHeldOrderId(null);
    setView("cart");
    setMobileView("products");
  }, []);

  const openPreviousOrders = useCallback(() => {
    setShowPreviousOrdersSheet(true);
  }, []);

  const handleReturnDone = useCallback(() => {
    dispatchCart({ type: "CLEAR" });
    setIsReturnMode(false);
    setSelectedCustomer(null);
    setHeldOrderId(null);
    setView("cart");
    setMobileView("products");
    void Promise.all([mutateSession(), mutateProducts()]);
  }, [mutateSession, mutateProducts]);

  const backToSessions = useCallback(() => {
    router.push("/pos");
  }, [router]);

  const reprintReceipt = useCallback(() => {
    if (isElectronEnvironment()) {
      void printLatestCachedReceipt().then(async (result) => {
        if (result.success) return;
        if (lastReceiptData) {
          await smartPrintReceipt(lastReceiptData);
          return;
        }
        console.error("Receipt reprint failed:", result.error);
        toast.error(result.error || t("pos.noCachedReceipt"));
      });
      return;
    }
    if (lastReceiptData) {
      void smartPrintReceipt(lastReceiptData);
    }
  }, [lastReceiptData]);

  // ── Loading State ──────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No session → redirect handled by useEffect above
  if (!posSession) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Active Session → Full POS Interface ────────────────────────────

  return (
    <PageAnimation className="flex h-dvh flex-col">
      {/* Header */}
      <POSHeader
        session={posSession}
        branchName={posSession.branch?.name}
        warehouseName={posSession.warehouse?.name}
        employeeName={posSession.employee?.name}
        heldOrdersCount={heldOrders.length}
        onHeldOrdersClick={openHeldOrders}
        onCloseSession={openCloseSessionDialog}
        onBackToSessions={backToSessions}
        onReprintReceipt={lastReceiptData && !isPendingReceipt ? reprintReceipt : undefined}
        isReprintLoading={isPendingReceipt}
        onReturn={toggleReturnMode}
        isReturnMode={isReturnMode}
        onPreviousOrders={openPreviousOrders}
        selectedTable={selectedTable}
        isRestaurantMode={isRestaurantEnabled}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Products */}
        <div className={cn(
          "flex-1 flex-col overflow-hidden pt-4 md:p-4",
          mobileView === "products" ? "flex" : "hidden md:flex"
        )}>
          <div className="flex flex-col gap-3 flex-1 overflow-hidden px-4 md:px-0">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ProductSearch value={searchQuery} onChange={setSearchQuery} />
            </div>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
          <CategoryTabs
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <ProductGrid
            viewMode={viewMode}
            products={products.map(p => {
              const du = p.unitConversions?.find(uc => uc.isDefaultUnit);
              return du?.price != null ? { ...p, price: Number(du.price) } : p;
            })}
            isLoading={productsLoading}
            searchQuery={deferredSearchQuery}
            selectedCategory={selectedCategory}
            selectedQuantities={selectedProductQuantities}
            selectionRevision={cartState.revision}
            onAddToCart={addToCartWithDefault}
          />
          </div>

          {/* Bottom bar — mobile only */}
          {cart.length > 0 && (
            <div className="flex shrink-0 gap-3 bg-slate-900 p-3 pb-[max(0.75rem,var(--app-safe-area-bottom))] md:hidden">
              <button
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-5 py-3.5 text-sm font-semibold text-white active:bg-slate-600"
                onClick={() => setMobileView("cart")}
              >
                <ShoppingCart className="h-5 w-5" />
                {t("pos.cart")}
                <Badge className="min-w-5 justify-center rounded-full bg-white px-1.5 py-0 text-xs text-slate-900">
                  {cartQuantity}
                </Badge>
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white active:opacity-90",
                  isReturnMode ? "bg-red-600" : "bg-primary"
                )}
                onClick={() => {
                  setChargedFromProducts(true);
                  setView("payment");
                  setMobileView("payment");
                }}
              >
                {isReturnMode ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    {t("pos.processReturn")} {fmt(cartTotals.total)}
                  </>
                ) : (
                  <>
                    {t("pos.charge")} {fmt(cartTotals.total)}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel — Cart / Payment */}
        <div className={cn(
          "flex flex-col bg-white",
          "md:w-[430px] md:flex-shrink-0 md:border-l lg:w-[460px]",
          mobileView !== "products" ? "flex-1" : "hidden md:flex"
        )}>
          {/* Mobile back header */}
          <div className="flex items-center gap-2 border-b p-3 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                if (mobileView === "payment" && chargedFromProducts) {
                  setChargedFromProducts(false);
                  setView("cart");
                  setMobileView("products");
                } else {
                  setMobileView(mobileView === "payment" ? "cart" : "products");
                }
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className={cn("text-lg font-bold", isReturnMode && "text-red-600")}>
              {isReturnMode
                ? t("pos.salesReturn")
                : (mobileView === "payment" ? t("pos.checkout") : t("pos.cart"))
              }
            </h2>
            {cart.length > 0 && (
              <div className="ml-auto text-sm font-bold text-primary">
                {fmt(cartTotals.total)}
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

              {/* Restaurant Table Selection */}
              {isRestaurantEnabled && (
                <div className="border-b p-3 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowTableSelect(true)}>
                    {selectedTable ? `Table ${selectedTable.number}` : t("restaurant.selectTable")}
                  </Button>
                  {selectedTable && (
                    <Badge variant="secondary">{guestCount} guests</Badge>
                  )}
                  {orderType === "TAKEAWAY" && (
                    <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                      {t("restaurant.takeaway")}
                    </Badge>
                  )}
                </div>
              )}

              {/* Return Mode Banner */}
              {isReturnMode && (
                <div className="mx-3 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-sm font-medium text-red-700">{t("pos.returnMode")}</span>
                  <span className="text-xs text-red-500 ml-auto">{t("pos.addItemsToReturn")}</span>
                </div>
              )}

              {/* Cart Items */}
              <div
                ref={cartItemsContainerRef}
                className="flex-1 overflow-x-hidden overflow-y-auto p-3 space-y-2"
              >
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">{t("pos.emptyCart")}</p>
                    <p className="text-xs">{t("pos.addProducts")}</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <CartItem
                      key={`${item.productId}:${item.quantity}:${item.discount}`}
                      item={item}
                      onRemove={isRestaurantEnabled ? handleCartItemRemove : removeFromCart}
                      kotSentQty={isRestaurantEnabled ? (kotSentQuantities.get(item.productId) ?? 0) : undefined}
                    />
                  ))
                )}
              </div>

              {/* Cart Summary & Actions */}
              {cart.length > 0 && (
                <div
                  key={`cart-summary-${cartState.revision}`}
                  className="border-t p-3 space-y-3"
                >
                  <CartSummary items={cart} isTaxInclusivePrice={taxInclusive} roundOffMode={roundOffMode} />
                  {isRestaurantEnabled && (
                    <Button
                      variant="default"
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={handleSendToKitchen}
                      disabled={cartState.items.length === 0}
                    >
                      <UtensilsCrossed className="h-4 w-4 mr-2" />
                      {t("restaurant.sendToKitchen")}
                      {kotSentQuantities.size > 0 && cartState.items.some(i => (i.quantity - (kotSentQuantities.get(i.productId) ?? 0)) > 0) && (
                        <Badge variant="secondary" className="ml-2">
                          {cartState.items.reduce((count, i) => {
                            const diff = i.quantity - (kotSentQuantities.get(i.productId) ?? 0);
                            return diff > 0 ? count + 1 : count;
                          }, 0)} new
                        </Badge>
                      )}
                    </Button>
                  )}
                  <div className="flex gap-2">
                    {!isReturnMode && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={holdOrder}
                      >
                        <PauseCircle className="h-4 w-4 mr-1" />
                        {t("pos.holdOrder").split(" ")[0]}
                      </Button>
                    )}
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
                    className={cn(
                      "w-full h-12 text-lg font-bold",
                      isReturnMode && "bg-red-600 hover:bg-red-700"
                    )}
                    onClick={() => {
                      setView("payment");
                      setMobileView("payment");
                    }}
                  >
                    {isReturnMode ? (
                      <>
                        <RotateCcw className="h-5 w-5 mr-2" />
                        {t("pos.processReturn")} {fmt(cartTotals.total)}
                      </>
                    ) : (
                      <>
                        {t("pos.payNow")} {fmt(cartTotals.total)}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : isReturnMode ? (
            <ReturnPanel
              items={cart}
              sessionId={posSession.id}
              branchId={posSession.branch?.id}
              warehouseId={posSession.warehouse?.id}
              customerId={selectedCustomer?.id}
              customerName={selectedCustomer?.name}
              companySettings={companySettings}
              receiptPrintingEnabled={receiptPrintingEnabled}
              isSaudiOrg={isSaudiOrg}
              isTaxInclusive={taxInclusive}
              roundOffMode={roundOffMode}
              onBack={() => {
                setView("cart");
                setMobileView("cart");
              }}
              onComplete={handleReturnDone}
            />
          ) : (
            <PaymentPanel
              total={cartTotals.total}
              availableMethods={enabledPaymentMethods}
              onBack={() => {
                if (chargedFromProducts) {
                  setChargedFromProducts(false);
                  setView("cart");
                  setMobileView("products");
                } else {
                  setView("cart");
                  setMobileView("cart");
                }
              }}
              onComplete={handleCheckout}
              isProcessing={isProcessing}
              hasCustomer={!!selectedCustomer}
            />
          )}
        </div>

      </div>

      {/* Close Session Dialog */}
      <Dialog
        open={showCloseDialog}
        onOpenChange={(open) => {
          setShowCloseDialog(open);
          if (!open) {
            setClosingCash("");
            setClosePinCode("");
            setCountedClosingCash(null);
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
            {!isLoadingSummary && visiblePaymentBreakdown.length > 0 && (
              <div className="rounded-lg border bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{t("pos.paymentBreakdown")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("pos.transactions")}: {posSession.totalTransactions}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {visiblePaymentBreakdown.map((payment) => (
                    <div
                      key={payment.method}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className={payment.method === "CASH_REFUND" ? "text-red-500" : "text-muted-foreground"}>
                        {getPaymentMethodLabel(payment.method, t)}
                      </span>
                      <span className={cn("font-medium", payment.method === "CASH_REFUND" && "text-red-500")}>
                        {payment.method === "CASH_REFUND" ? `-${fmt(Math.abs(Number(payment.total)))}` : fmt(Number(payment.total))}
                      </span>
                    </div>
                  ))}
                  {nonCashTotal > 0 && (
                    <div className="mt-2 flex items-center justify-between gap-4 border-t pt-2">
                      <span className="font-medium text-slate-700">
                        {t("pos.depositNonCashTo")}
                      </span>
                      <span className="font-semibold">{fmt(nonCashTotal)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="text-sm font-medium">{t("pos.countedClosingCash")}</label>
                {countedClosingCash !== null && !isLoadingSummary && cashDifference !== null && (
                  <span className={cn(
                    "text-sm font-medium",
                    cashDifference > 0 ? "text-green-600" : (cashDifference < 0 ? "text-red-600" : "text-slate-600")
                  )}>
                    {t("pos.diff")} {formatSignedDifference(cashDifference, fmt)}
                  </span>
                )}
              </div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={closingCash}
                onInput={(e) => syncClosingCashValue((e.target as HTMLInputElement).value)}
                onChange={(e) => syncClosingCashValue(e.currentTarget.value)}
                autoFocus
              />
            </div>

            {posSession.employeeId && (
              <div className="mt-2">
                <label className="mb-1 block text-sm font-medium">
                  {t("pos.employeePin")}
                </label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder={t("pos.enterFourDigitPin")}
                  value={closePinCode}
                  onChange={(e) => setClosePinCode(e.target.value.replace(/\D/g, ""))}
                  className="font-mono"
                />
              </div>
            )}

            {/* Settlement accounts are auto-filled from register config or org defaults and sent silently */}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)} className="w-full sm:w-auto">
              {t("pos.cancel")}
            </Button>
            <Button
              onClick={closeSession}
              disabled={isClosingSession || (isClearingMode && !settleCashAccountId && !registerConfigData?.config?.defaultCashAccountId && !orgSettings?.posDefaultCashAccountId)}
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
            <SheetDescription className="sr-only">
              Review, restore, or remove orders currently on hold for this POS session.
            </SheetDescription>
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
                      {(order.items as CartItemData[]).length} {t("common.items")}
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

      <PreviousOrdersSheet
        open={showPreviousOrdersSheet}
        onClose={() => setShowPreviousOrdersSheet(false)}
        sessionId={posSession?.id ?? null}
        companySettings={companySettings}
      />

      {isRestaurantEnabled && (
        <TableSelect
          open={showTableSelect}
          onOpenChange={setShowTableSelect}
          onSelectTable={(table) => {
            setSelectedTable(table);
            setOrderType("DINE_IN");
            setShowTableSelect(false);
          }}
          onTakeaway={() => {
            setSelectedTable(null);
            setOrderType("TAKEAWAY");
            setShowTableSelect(false);
          }}
        />
      )}

      {/* Cancel Kitchen Item Confirmation Dialog */}
      <Dialog open={!!pendingCancelProductId} onOpenChange={(open) => { if (!open) setPendingCancelProductId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("restaurant.cancelKitchenOrder") || "Cancel Kitchen Order?"}</DialogTitle>
            <DialogDescription>
              {t("restaurant.cancelKitchenOrderDesc") || "This item was already sent to the kitchen. A cancellation ticket will be printed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingCancelProductId(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmCancelKitchenItem}>
              {t("restaurant.confirmCancel") || "Cancel & Notify Kitchen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageAnimation>
  );
}

export default function POSTerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-slate-100">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <POSTerminalContent />
    </Suspense>
  );
}
