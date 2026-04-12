"use client";

import { Suspense, useState, useCallback, useEffect, useRef, useMemo, useReducer, useDeferredValue } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ShoppingCart, PauseCircle, Trash2, ArrowLeft, RotateCcw, UtensilsCrossed, ChevronDown, Armchair, Receipt } from "lucide-react";
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
import { CashMovementDialog } from "@/components/pos/cash-movement-dialog";
import { QuickSaleDialog } from "@/components/pos/quick-sale-dialog";
import { ProductSearch } from "@/components/pos/product-search";
import { CategoryTabs } from "@/components/pos/category-tabs";
import { ProductGrid } from "@/components/pos/product-grid";
import { ViewModeToggle } from "@/components/pos/view-mode-toggle";
import { usePosViewMode } from "@/hooks/use-pos-view-mode";
import { CartItem, type CartItemData } from "@/components/pos/cart-item";
import { VariantPickerDialog } from "@/components/pos/variant-picker-dialog";
import { CartSummary, calculateCartTotal, type GlobalDiscountType } from "@/components/pos/cart-summary";
import { CustomerSelect } from "@/components/pos/customer-select";
import { PaymentPanel } from "@/components/pos/payment-panel";
import type { PaymentEntry } from "@/components/pos/split-payment-form";
import type { ReceiptData } from "@/components/pos/receipt";
import { ReturnPanel } from "@/components/pos/return-panel";
import { PreviousOrdersSheet } from "@/components/pos/previous-orders-sheet";
import { TableSelect } from "@/components/pos/table-select";
import { usePOSTabs, type TabContext } from "@/hooks/use-pos-tabs";
import { useRealtimeOrder } from "@/hooks/use-realtime-order";
import type { OrderOperation, SerializedOrderState } from "@/lib/pos/realtime-types";
import { cartLineKey as makeLineKey } from "@/lib/pos/realtime-types";
import { applyOperations } from "@/lib/pos/apply-operations";
import { OrderTabsSheet } from "@/components/pos/order-tabs-sheet";
import type { PreBillReceiptData } from "@/lib/pos/pre-bill-print";
import type { KOTReceiptData } from "@/components/restaurant/kot-receipt";
import {
  cacheReceiptArtifactWithConfig,
  isElectronEnvironment,
  loadLatestCachedReceipt,
  openCashDrawerIfEnabled,
  printAndCacheReceiptWithConfig,
  printLatestCachedReceipt,
  smartPrintReceipt,
  setOrgMobileRenderMode,
  setOrgElectronDefaultMode,
} from "@/lib/electron-print";
import { useLanguage } from "@/lib/i18n";
import {
  DEFAULT_ENABLED_POS_PAYMENT_METHODS,
  type POSPaymentMethod,
} from "@/lib/pos/payment-methods";
import { normalizeRoundOffMode, roundCurrency } from "@/lib/round-off";
import { parseWeightBarcode, type WeighMachineConfig } from "@/lib/weigh-machine/barcode-parser";
import { useAndroidBackButton } from "@/hooks/use-android-back-button";
import { usePosHiddenComponents } from "@/hooks/use-pos-hidden-components";
import { usePosFeedback } from "@/hooks/use-pos-feedback";

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

interface POSVariant {
  id: string;
  name: string;
  price: number;
  barcode?: string | null;
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
  imageUrl?: string | null;
  unitConversions?: POSUnitConversion[];
  variants?: POSVariant[];
  modifiers?: string[];
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
  | { type: "ADD"; product: any; quantity?: number; unitId?: string; unitName?: string; conversionFactor?: number; price?: number | null; variantId?: string; variantName?: string; modifiers?: string[] }
  | { type: "REMOVE"; productId: string; variantId?: string }
  | { type: "SET_QUANTITY"; productId: string; variantId?: string; quantity: number }
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

/** Compute derived fields (totalQuantity, selectedProductQuantities) from items */
function computeDerived(items: CartItemData[], previousRevision: number): Pick<CartState, "items" | "totalQuantity" | "selectedProductQuantities" | "revision"> {
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    selectedProductQuantities: items.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {}),
    revision: previousRevision + 1,
  };
}

function buildCartState(items: CartItemData[], previousRevision = -1): CartState {
  return computeDerived(items, previousRevision);
}

function buildCartItemFromProduct(product: any, quantity?: number, unitId?: string, unitName?: string, cf?: number, altPrice?: number | null, variantId?: string, variantName?: string, modifiers?: string[]): CartItemData {
  const effectivePrice = altPrice != null ? altPrice : Number(product.price);
  const ji = product.jewelleryItem;
  const jewelleryData = ji ? {
    jewelleryItemId: ji.id, goldRate: 0, purity: ji.purity, metalType: ji.metalType,
    grossWeight: ji.grossWeight, stoneWeight: ji.stoneWeight, netWeight: ji.netWeight,
    fineWeight: ji.fineWeight, wastagePercent: ji.wastagePercent,
    makingChargeType: ji.makingChargeType, makingChargeValue: ji.makingChargeValue,
    stoneValue: ji.stoneValue, tagNumber: ji.tagNumber, huidNumber: ji.huidNumber,
  } : null;
  return {
    productId: product.id, name: product.name, price: effectivePrice,
    quantity: quantity ?? 1, discount: 0, stockQuantity: product.stockQuantity ?? 0,
    gstRate: Number(product.gstRate) || 0,
    hsnCode: product.hsnCode || (ji ? "7113" : undefined),
    unitId, unitName, conversionFactor: cf ?? 1, jewellery: jewelleryData,
    categoryId: product.categoryId ?? null, variantId, variantName, modifiers,
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const item = buildCartItemFromProduct(
        action.product, action.quantity, action.unitId, action.unitName,
        action.conversionFactor, action.price, action.variantId, action.variantName, action.modifiers,
      );
      const lineKey = makeLineKey(item.productId, item.variantId, item.unitId);
      const items = [...state.items];
      const idx = items.findIndex(i => makeLineKey(i.productId, i.variantId, i.unitId) === lineKey);
      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: items[idx].quantity + (action.quantity ?? 1) };
      } else {
        items.push({ ...item, quantity: action.quantity ?? 1 });
      }
      return computeDerived(items, state.revision);
    }

    case "REMOVE": {
      const removeKey = makeLineKey(action.productId, action.variantId);
      const items = state.items.filter(i => makeLineKey(i.productId, i.variantId) !== removeKey);
      return computeDerived(items, state.revision);
    }

    case "SET_QUANTITY": {
      const lineKey = makeLineKey(action.productId, action.variantId);
      if (action.quantity <= 0) {
        const items = state.items.filter(i => makeLineKey(i.productId, i.variantId) !== lineKey);
        return computeDerived(items, state.revision);
      }
      const items = state.items.map(i =>
        makeLineKey(i.productId, i.variantId) === lineKey ? { ...i, quantity: action.quantity } : i
      );
      return computeDerived(items, state.revision);
    }

    case "CLEAR":
      return computeDerived([], state.revision);

    case "RESTORE":
      return buildCartState(action.items, state.revision);

    default:
      return state;
  }
}

function POSTerminalContent() {
  const { fmt } = useCurrency();
  const { t, lang } = useLanguage();
  const { data: authSession } = useSession();
  const organizationId = (authSession?.user as { organizationId?: string } | undefined)?.organizationId ?? null;
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
  const { isHidden: isPosComponentHidden, hiddenComponents: posHiddenSet } = usePosHiddenComponents(!!posSession);
  const {
    soundEnabled,
    toggleSound,
    feedbackAddItem,
    feedbackQuantity,
    feedbackRemoveItem,
    feedbackCompleteSale,
    feedbackKotSent,
    feedbackError,
    feedbackScan,
    feedbackNavTap,
  } = usePosFeedback();

  // Redirect to dashboard if no session found (after loading)
  useEffect(() => {
    if (!sessionLoading && !posSession) {
      router.replace("/pos");
    }
  }, [sessionLoading, posSession, router]);

  // Products & categories
  const {
    data: rawProducts,
    mutate: mutateProducts,
    isLoading: productsLoading,
  } = useSWR<POSProduct[]>(
    posSession ? "/api/pos/products" : null,
    fetcher
  );
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const { data: categories = [] } = useSWR<Category[]>(
    posSession ? "/api/product-categories" : null,
    fetcher
  );

  // Held orders
  const { data: heldOrders = [], mutate: mutateHeldOrders } = useSWR<HeldOrder[]>(
    posSession ? "/api/pos/held-orders" : null,
    fetcher
  );

  // Cart state — local only, saved to server on KOT send
  const [cartState, dispatchCart] = useReducer(cartReducer, undefined, () => buildCartState([]));
  const cartStateRef = useRef(cartState);
  cartStateRef.current = cartState;
  const [heldOrderId, setHeldOrderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { viewMode, setViewMode } = usePosViewMode();
  const [view, setView] = useState<"cart" | "payment">("cart");
  const [mobileView, setMobileView] = useState<"products" | "cart" | "payment">("products");
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [globalDiscountType, setGlobalDiscountType] = useState<GlobalDiscountType>("percent");

  // Dialog state
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showHeldSheet, setShowHeldSheet] = useState(false);
  const [isReturnMode, setIsReturnMode] = useState(false);
  const [showPreviousOrdersSheet, setShowPreviousOrdersSheet] = useState(false);
  const [showCashMovementDialog, setShowCashMovementDialog] = useState(false);
  const [showQuickSaleDialog, setShowQuickSaleDialog] = useState(false);
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
  const kotInFlightRef = useRef(false);

  // Restaurant state
  const isRestaurantEnabled = !!(authSession?.user as { isRestaurantModuleEnabled?: boolean })?.isRestaurantModuleEnabled;
  const [selectedTable, setSelectedTable] = useState<{ id: string; number: number; name: string; section?: string; capacity: number } | null>(null);
  const [showTableSelect, setShowTableSelect] = useState(false);
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [kotSentQuantities, setKotSentQuantities] = useState<Map<string, number>>(new Map());
  const kotSentQuantitiesRef = useRef(kotSentQuantities);
  kotSentQuantitiesRef.current = kotSentQuantities;
  const [kotOrderIds, setKotOrderIds] = useState<string[]>([]);
  const [isKotSending, setIsKotSending] = useState(false);

  // Android hardware back button — navigate POS views or close dialogs
  useAndroidBackButton(useCallback(() => {
    // Close any open dialog/sheet first
    if (showCloseDialog) { setShowCloseDialog(false); return true; }
    if (showHeldSheet) { setShowHeldSheet(false); return true; }
    if (showPreviousOrdersSheet) { setShowPreviousOrdersSheet(false); return true; }
    if (showTableSelect) { setShowTableSelect(false); return true; }

    // Navigate mobile views: payment → cart → products
    if (mobileView === "payment") {
      if (chargedFromProducts) {
        setChargedFromProducts(false);
        setView("cart");
        setMobileView("products");
      } else {
        setMobileView("cart");
      }
      return true;
    }
    if (mobileView === "cart") {
      setMobileView("products");
      return true;
    }

    // On products view — don't consume, let default behavior (history.back) handle
    return false;
  }, [mobileView, chargedFromProducts, showCloseDialog, showHeldSheet, showPreviousOrdersSheet, showTableSelect]));

  // Callbacks for remote tab events (from polling)
  const remoteUpdateRef = useRef<((tab: TabContext) => void) | null>(null);
  const activeTabRemovedRef = useRef<(() => void) | null>(null);

  // Tab system — generalises per-table context to unlimited concurrent orders
  const {
    tabs, activeTabId, activeTabLabel, activeTabOrderNumber, activeTabCreatedAt, tabCount,
    allTabs, switchTab, switchToNewTab, closeTab: closeTabAction,
    findTabByTableId, updateActiveTabLabel, getAllTableIds, clearAllTabs,
    isHydrated, initialTabContext, persistTab, scheduleSave, mutateOpenOrders, adoptAsActiveTab,
  } = usePOSTabs(
    posSession?.id ?? null,
    (tab) => remoteUpdateRef.current?.(tab),
    () => activeTabRemovedRef.current?.(),
    isRestaurantEnabled ? organizationId : null,
  );
  const [showTabsSheet, setShowTabsSheet] = useState(false);

  // ── Real-time sync via Socket.IO ──────────────────────────────────
  const { isConnected: isSocketConnected } = useRealtimeOrder(
    isHydrated && isRestaurantEnabled ? activeTabId : null,
    {
      organizationId,
      onRemoteUpdate: useCallback((serverItems: CartItemData[], _version: number, state: SerializedOrderState) => {
        // Another device sent a KOT — merge server items with our local unsent items
        const localItems = cartStateRef.current.items;
        const localSentQtys = kotSentQuantitiesRef.current;
        const lineKey = (item: CartItemData) => item.variantId ? `${item.productId}::${item.variantId}` : item.productId;

        // Find local items that have unsent quantities (added locally but not yet KOT'd)
        const unsentOps: OrderOperation[] = [];
        for (const item of localItems) {
          const key = lineKey(item);
          const sentQty = localSentQtys.get(key) ?? 0;
          const unsent = item.quantity - sentQty;
          if (unsent > 0) {
            unsentOps.push({ op: "ADD_ITEM", item, quantity: unsent });
          }
        }

        // Merge: server items (committed) + our unsent local items on top
        let mergedItems = serverItems;
        if (unsentOps.length > 0) {
          const baseState: SerializedOrderState = {
            items: serverItems, label: "", orderType: "DINE_IN", isReturnMode: false,
            customerId: null, customerName: null, tableId: null, tableNumber: null,
            tableName: null, tableSection: null, tableCapacity: null, heldOrderId: null,
            kotSentQuantities: {}, kotOrderIds: [],
          };
          mergedItems = applyOperations(baseState, unsentOps).items;
        }

        dispatchCart({ type: "RESTORE", items: mergedItems });
        setKotSentQuantities(new Map(Object.entries(state.kotSentQuantities || {}).map(([k, v]) => [k, Number(v)])));
        setKotOrderIds(state.kotOrderIds || []);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []),
      onRemoteDelete: useCallback(() => {
        resetLiveState();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []),
    },
  );

  // Fetch org settings for POS accounting mode
  const { data: orgSettings } = useSWR<{ posAccountingMode: string; roundOffMode: string; posDefaultCashAccountId: string | null; posDefaultBankAccountId: string | null; posReceiptRenderConfig?: { electron: { allowedModes: string[]; defaultMode: string | null }; mobile: { renderMode: string } } }>(
    posSession ? "/api/pos/org-settings" : null,
    fetcher
  );
  const { data: paymentMethodsData } = useSWR<{ methods: POSPaymentMethod[] }>(
    posSession ? "/api/settings/pos-payment-methods" : null,
    fetcher
  );
  const isClearingMode = orgSettings?.posAccountingMode === "CLEARING_ACCOUNT";
  const roundOffMode = normalizeRoundOffMode(orgSettings?.roundOffMode);

  // Sync org-level render mode config into the print module
  useEffect(() => {
    const rc = orgSettings?.posReceiptRenderConfig;
    if (rc) {
      setOrgMobileRenderMode((rc.mobile?.renderMode as "htmlImage" | "bitmapCanvas" | "escposText") || null);
      setOrgElectronDefaultMode((rc.electron?.defaultMode as "htmlDriver" | "htmlRaster" | "escposText" | "bitmapCanvas") || null);
    }
  }, [orgSettings?.posReceiptRenderConfig]);
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
  const { data: sessionSummary, isLoading: isLoadingSummary, mutate: mutateSessionSummary } = useSWR<{
    paymentBreakdown: { method: string; total: number }[];
    cashMovementTotals?: { totalCashIn: number; totalCashOut: number; netCashMovement: number };
  }>(
    showCloseDialog && posSession?.id ? `/api/pos/sessions/${posSession.id}/summary` : null,
    fetcher
  );

  // Re-fetch session summary when cash movements are recorded
  useEffect(() => {
    const handler = () => mutateSessionSummary();
    window.addEventListener("pos-cash-movement-updated", handler);
    return () => window.removeEventListener("pos-cash-movement-updated", handler);
  }, [mutateSessionSummary]);

  const paymentBreakdown = sessionSummary?.paymentBreakdown ?? EMPTY_PAYMENT_BREAKDOWN;
  const cashMovementTotals = sessionSummary?.cashMovementTotals;
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
    ? roundCurrency(
        Number(posSession.openingCash) + cashSalesTotal - cashRefundsTotal
        + (cashMovementTotals?.totalCashIn || 0)
        - (cashMovementTotals?.totalCashOut || 0)
      )
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

  const { data: preBillReceiptMeta } = useSWR(
    posSession ? "/api/receipt-meta" : null,
    fetcher
  );

  const receiptPrintingEnabled = receiptSetting?.value === "true";
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);
  const [isPendingReceipt, setIsPendingReceipt] = useState(false);
  const [isPrintingPreBill, setIsPrintingPreBill] = useState(false);
  const [preBillPrinted, setPreBillPrinted] = useState(false);
  const cart = cartState.items;
  const cartQuantity = cartState.totalQuantity;
  const selectedProductQuantities = cartState.selectedProductQuantities;
  const cartTotals = useMemo(
    () => calculateCartTotal(cartState.items, taxInclusive, roundOffMode, globalDiscount, globalDiscountType),
    [cartState.items, taxInclusive, roundOffMode, globalDiscount, globalDiscountType]
  );
  const productsWithDefaultPrice = useMemo(() =>
    products.map(p => {
      const du = p.unitConversions?.find(uc => uc.isDefaultUnit);
      return du?.price != null ? { ...p, price: Number(du.price) } : p;
    }),
    [products]
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

  /** Reset a table back to AVAILABLE in the database (retry once on failure) */
  const freeTable = useCallback(async (tableId: string) => {
    const doFetch = () => fetch(`/api/restaurant/tables/${tableId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "AVAILABLE" }),
    });
    try {
      const res = await doFetch();
      if (!res.ok) throw new Error();
    } catch {
      try {
        await new Promise(r => setTimeout(r, 1000));
        const res = await doFetch();
        if (!res.ok) throw new Error();
      } catch {
        toast.error(t("pos.failedToFreeTable"));
      }
    }
  }, []);

  /** Mark a table as OCCUPIED in the database (retry once on failure) */
  const occupyTable = useCallback(async (tableId: string) => {
    const doFetch = () => fetch(`/api/restaurant/tables/${tableId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "OCCUPIED" }),
    });
    try {
      const res = await doFetch();
      if (!res.ok) throw new Error();
    } catch {
      try {
        await new Promise(r => setTimeout(r, 1000));
        const res = await doFetch();
        if (!res.ok) throw new Error();
      } catch {
        toast.error(t("pos.failedToUpdateTableStatus"));
      }
    }
  }, []);

  const addToCart = useCallback((product: any, quantity?: number, unitId?: string, unitName?: string, conversionFactor?: number, price?: number | null, variantId?: string, variantName?: string, modifiers?: string[]) => {
    dispatchCart({ type: "ADD", product, quantity, unitId, unitName, conversionFactor, price, variantId, variantName, modifiers });
    // If items are added after bill was printed, reset billed state
    if (preBillPrinted) {
      setPreBillPrinted(false);
    }
  }, [preBillPrinted]);

  // Quick Sale handler — adds an ad-hoc item with no inventory record
  const handleQuickSale = useCallback((price: number, description: string) => {
    const uniqueId = `qs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    feedbackAddItem();
    dispatchCart({
      type: "ADD",
      product: { id: "", name: description || "Quick Sale", price, stockQuantity: 0, categoryId: null },
      quantity: 1,
      variantId: uniqueId,
    });
  }, [feedbackAddItem]);

  // State for variant picker dialog
  const [variantPickerProduct, setVariantPickerProduct] = useState<POSProduct | null>(null);

  // Wrapper for product tile clicks — applies default unit if set, or shows variant/modifier picker
  const addToCartWithDefault = useCallback((tileProduct: any) => {
    const fullProduct = products.find(p => p.id === tileProduct.id);
    const hasVariants = fullProduct?.variants && fullProduct.variants.length > 0;
    const hasModifiers = fullProduct?.modifiers && fullProduct.modifiers.length > 0;

    // If product has variants or modifiers, show the picker dialog
    if (hasVariants || hasModifiers) {
      setVariantPickerProduct(fullProduct!);
      return;
    }

    feedbackAddItem();
    const defaultUc = fullProduct?.unitConversions?.find((uc: any) => uc.isDefaultUnit);
    if (defaultUc) {
      addToCart(tileProduct, 1, defaultUc.unitId, defaultUc.unit?.name, Number(defaultUc.conversionFactor), defaultUc.price != null ? Number(defaultUc.price) : null);
    } else {
      addToCart(tileProduct);
    }
  }, [products, addToCart, feedbackAddItem]);

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
                feedbackScan();
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
            feedbackScan();
            addToCart(match.product, undefined, match.unitId, match.unitName, match.conversionFactor, match.price);
            setSearchQuery("");
            const displayName = match.unitName ? `${match.product.name} (${match.unitName})` : match.product.name;
            toast.success(`Added ${displayName}`);
          } else {
            feedbackError();
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
  }, [posSession, showCloseDialog, showHeldSheet, view, addToCart, weighMachineEnabled, weighMachineConfig, weighCodeIndex, scanCodeIndex, setSearchQuery, feedbackScan, feedbackError]);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    dispatchCart({ type: "REMOVE", productId, variantId });
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
    setGlobalDiscount(0);
    setGlobalDiscountType("percent");
    setMobileView("products");
  }, []);

  const [showClearCartKotWarning, setShowClearCartKotWarning] = useState(false);

  const handleClearCart = () => {
    if (isRestaurantEnabled) {
      setShowClearCartKotWarning(true);
      return;
    }
    clearCart();
  };

  // ── Tab helpers ───────────────────────────────────────────────────

  const snapshotCurrentTab = useCallback((): TabContext => ({
    id: activeTabId,
    label: activeTabLabel,
    orderNumber: activeTabOrderNumber,
    cartState,
    selectedCustomer,
    selectedTable,
    heldOrderId,
    isReturnMode,
    orderType,
    kotSentQuantities,
    kotOrderIds,
    view,
    preBillPrinted,
    createdAt: activeTabCreatedAt,
  }), [activeTabId, activeTabLabel, activeTabOrderNumber, cartState, selectedCustomer, selectedTable, heldOrderId, isReturnMode, orderType, kotSentQuantities, kotOrderIds, view, preBillPrinted, activeTabCreatedAt]);

  const restoreTabContext = useCallback((tab: TabContext) => {
    dispatchCart({ type: "RESTORE", items: tab.cartState.items });
    setSelectedCustomer(tab.selectedCustomer);
    setSelectedTable(tab.selectedTable);
    setHeldOrderId(tab.heldOrderId);
    setIsReturnMode(tab.isReturnMode);
    setOrderType(tab.orderType);
    setKotSentQuantities(tab.kotSentQuantities);
    setKotOrderIds(tab.kotOrderIds);
    setView(tab.view);
    setPreBillPrinted(tab.preBillPrinted);
  }, []);

  const resetLiveState = useCallback(() => {
    dispatchCart({ type: "CLEAR" });
    setSelectedCustomer(null);
    setSelectedTable(null);
    setHeldOrderId(null);
    setIsReturnMode(false);
    setGlobalDiscount(0);
    setGlobalDiscountType("percent");
    setOrderType("DINE_IN");
    setKotSentQuantities(new Map());
    setKotOrderIds([]);
    setView("cart");
    setMobileView("products");
    setPreBillPrinted(false);
    // Restaurant resting state: always prompt for next table/order
    setShowTableSelect(true);
  }, []);

  const handleTabSwitch = useCallback((targetId: string) => {
    if (targetId === activeTabId) return;
    const snapshot = snapshotCurrentTab();
    const target = switchTab(targetId, snapshot);
    if (target) restoreTabContext(target);
  }, [activeTabId, snapshotCurrentTab, switchTab, restoreTabContext]);

  const handleNewTab = useCallback(() => {
    const snapshot = snapshotCurrentTab();
    // If current tab is completely empty (no items, no KOT, no table), just reset it
    // instead of creating a new tab and wasting an order number
    const isEmpty = snapshot.cartState.items.length === 0
      && snapshot.kotSentQuantities.size === 0
      && !snapshot.selectedTable;
    if (isEmpty) {
      resetLiveState();
      if (isRestaurantEnabled) {
        setShowTableSelect(true);
      }
      return;
    }

    switchToNewTab(snapshot);
    resetLiveState();
    // In restaurant mode, auto-open table select for the new order
    if (isRestaurantEnabled) {
      setShowTableSelect(true);
    }
  }, [snapshotCurrentTab, switchToNewTab, resetLiveState, isRestaurantEnabled]);

  const handleCloseTab = useCallback((tabId: string) => {
    // Free the table if the closed tab had one assigned (skip if bill already freed it)
    if (tabId === activeTabId) {
      // Active tab — selectedTable is in live state
      if (selectedTable && !preBillPrinted) freeTable(selectedTable.id);
    } else {
      // Inactive tab — check its saved state in the tabs map
      const inactiveTab = tabs.get(tabId);
      if (inactiveTab?.selectedTable && !inactiveTab.preBillPrinted) freeTable(inactiveTab.selectedTable.id);
    }

    const { switchTo, wasActive } = closeTabAction(tabId);
    if (wasActive) {
      if (switchTo) {
        restoreTabContext(switchTo);
      } else {
        resetLiveState();
      }
    }
  }, [closeTabAction, restoreTabContext, resetLiveState, activeTabId, selectedTable, preBillPrinted, tabs, freeTable]);

  // Auto-label active tab based on customer/table/return state
  useEffect(() => {
    let label = activeTabLabel;
    const n = activeTabOrderNumber;
    if (isReturnMode) {
      label = "Return";
    } else if (selectedTable && selectedCustomer) {
      label = `#${n} · T${selectedTable.number} - ${selectedCustomer.name}`;
    } else if (selectedTable) {
      label = `#${n} · T${selectedTable.number}`;
    } else if (selectedCustomer) {
      label = selectedCustomer.name;
    }
    // Only update if changed and not a generic "Order N" being overridden back
    if (label !== activeTabLabel) {
      updateActiveTabLabel(label);
    }
  }, [selectedCustomer, selectedTable, isReturnMode, activeTabLabel, activeTabOrderNumber, updateActiveTabLabel]);

  // Restore active tab from DB on initial hydration
  const hydrationDoneRef = useRef(false);
  useEffect(() => {
    if (!isHydrated || hydrationDoneRef.current) return;
    hydrationDoneRef.current = true;
    if (initialTabContext) {
      restoreTabContext(initialTabContext);
      // Continued session in restaurant mode — always land on table select so staff
      // can pick a new customer/table instead of resuming the last cart automatically.
      if (isRestaurantEnabled) {
        setShowTableSelect(true);
      }
    } else if (isRestaurantEnabled) {
      // Fresh session in restaurant mode — prompt for table
      setShowTableSelect(true);
    }
  }, [isHydrated, initialTabContext, restoreTabContext, isRestaurantEnabled]);

  // Wire up remote tab event callbacks
  useEffect(() => {
    remoteUpdateRef.current = (tab: TabContext) => {
      // Polling detected a server-side change on the active tab.
      // Only update KOT metadata — never overwrite local cart items.
      setKotSentQuantities(tab.kotSentQuantities);
      setKotOrderIds(tab.kotOrderIds);
    };
    activeTabRemovedRef.current = () => {
      resetLiveState();
    };
  }, [resetLiveState]);

  // Auto-save active tab to DB on KOT/metadata changes only (not live cart edits)
  useEffect(() => {
    if (!isHydrated || !posSession) return;
    // Don't persist blank tabs (no table, no items) — avoids ghost orders after checkout/reset
    if (!selectedTable && cartState.items.length === 0 && kotSentQuantities.size === 0) return;
    scheduleSave(snapshotCurrentTab());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id, selectedTable?.id, isReturnMode, orderType, kotSentQuantities, kotOrderIds, view]);

  // Persist immediately when page becomes hidden (browser tab close / app switch)
  useEffect(() => {
    if (!isHydrated) return;
    const handler = () => {
      if (document.visibilityState === "hidden") {
        persistTab(snapshotCurrentTab());
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [isHydrated, snapshotCurrentTab, persistTab]);

  const confirmClearCartWithKot = async () => {
    // Send VOID KOT to kitchen for all already-sent items
    const voidItems = cartState.items
      .map((item) => {
        const key = cartLineKey(item.productId, item.variantId);
        const sentQty = kotSentQuantities.get(key) ?? 0;
        return sentQty > 0 ? { item, sentQty } : null;
      })
      .filter(Boolean) as { item: CartItemData; sentQty: number }[];

    if (voidItems.length > 0) {
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
            items: voidItems.map(({ item, sentQty }) => ({
              productId: item.productId,
              name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
              quantity: sentQty,
            })),
          }),
        });

        if (res.ok) {
          const kot = await res.json();
          try {
            const { printKOTMulti } = await import("@/lib/restaurant/kot-print");
            await printKOTMulti({
              kotNumber: kot.kotNumber,
              kotType: "VOID",
              orderType,
              tableName: selectedTable?.name,
              tableNumber: selectedTable?.number,
              section: selectedTable?.section || undefined,
              serverName: authSession?.user?.name || undefined,
              timestamp: new Date(),
              items: voidItems.map(({ item, sentQty }) => ({
                name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
                quantity: sentQty,
                modifiers: item.modifiers,
                categoryId: item.categoryId,
              })),
            });
          } catch {
            toast.warning(t("pos.voidKotPrintFailed"), { duration: 6000 });
          }
          toast.success(`Void KOT sent to kitchen for ${voidItems.length} item(s)`);
        }
      } catch {
        toast.error(t("pos.failedToSendVoidKot"));
      }
    }

    if (selectedTable) {
      freeTable(selectedTable.id);
    }
    clearCart();
    setKotSentQuantities(new Map());
    setKotOrderIds([]);
    setSelectedTable(null);
    setOrderType("DINE_IN");
    setShowClearCartKotWarning(false);
    setShowTableSelect(true);
  };

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
    void Promise.allSettled([mutateSession(), mutateHeldOrders(), mutateProducts(), mutateOpenOrders()]).then((results) => {
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
  }, [mutateHeldOrders, mutateProducts, mutateSession, mutateOpenOrders]);

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
        const { printPOSSessionReport } = await import("@/lib/print-session-report");
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

      clearAllTabs();
      clearCart();
      setKotSentQuantities(new Map());
      setKotOrderIds([]);
      setSelectedTable(null);
      setOrderType("DINE_IN");
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

  /** Core KOT send logic — returns the created KOT id, or null if nothing to send */
  const cartLineKey = (productId: string, variantId?: string) => variantId ? `${productId}::${variantId}` : productId;

  const hasUnsentKotItems = cart.length > 0 && cart.some(
    (i) => (i.quantity - (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0)) > 0
  );

  const sendKotForUnsentItems = async (opts?: { silent?: boolean }): Promise<{ kotId: string; kotSentQuantities: Map<string, number>; kotOrderIds: string[] } | null> => {
    // 1. Compute unsent items from LOCAL cart
    const itemsToSend: { productId: string; name: string; variantName?: string; modifiers?: string[]; quantity: number; categoryId?: string | null; lineKey: string }[] = [];
    for (const item of cartState.items) {
      const key = cartLineKey(item.productId, item.variantId);
      const sentQty = kotSentQuantities.get(key) ?? 0;
      const diff = item.quantity - sentQty;
      if (diff > 0) {
        itemsToSend.push({ productId: item.productId, name: item.name, variantName: item.variantName, modifiers: item.modifiers, quantity: diff, categoryId: item.categoryId, lineKey: key });
      }
    }
    if (itemsToSend.length === 0) return null;

    // 2. Merge any server-only items (added by other devices) into local cart
    let mergedItems = cartState.items;
    try {
      const serverRes = await fetch(`/api/pos/open-orders/${activeTabId}`);
      if (serverRes.ok) {
        const serverOrder = await serverRes.json();
        const serverItems: CartItemData[] = Array.isArray(serverOrder.items) ? serverOrder.items : [];
        if (serverItems.length > 0) {
          // Only add items from server that don't exist in local cart (from other devices)
          const localKeys = new Set(cartState.items.map(i => cartLineKey(i.productId, i.variantId)));
          const serverOnlyItems = serverItems.filter(i => !localKeys.has(cartLineKey(i.productId, i.variantId)));
          if (serverOnlyItems.length > 0) {
            mergedItems = [...cartState.items, ...serverOnlyItems];
            dispatchCart({ type: "RESTORE", items: mergedItems });
          }
        }
      }
    } catch {
      // If server fetch fails, proceed with local items only
    }

    // 3. Create KOT record
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
        items: itemsToSend.map(item => ({
          productId: item.productId,
          name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
          variantName: item.variantName || undefined,
          modifiers: item.modifiers || undefined,
          quantity: item.quantity,
          isNew: kotType === "FOLLOWUP",
        })),
      }),
    });

    if (!res.ok) throw new Error("Failed to create KOT");
    const kot = await res.json();

    // 4. Update sent quantities for the MERGED items
    const newSentQtys = new Map(kotSentQuantities);
    for (const item of mergedItems) {
      const key = cartLineKey(item.productId, item.variantId);
      newSentQtys.set(key, item.quantity);
    }
    setKotSentQuantities(newSentQtys);
    setKotOrderIds(prev => [...prev, kot.id]);

    // 5. Persist merged state + KOT info to server (Ably notification via PUT route)
    const updatedKotOrderIds = [...kotOrderIds, kot.id];
    persistTab({
      ...snapshotCurrentTab(),
      kotSentQuantities: newSentQtys,
      kotOrderIds: updatedKotOrderIds,
    }, { broadcast: true });

    // 6. Print KOT (only the unsent diff items)
    try {
      const kotReceiptData: KOTReceiptData = {
        kotNumber: kot.kotNumber,
        kotType: kot.kotType,
        orderType: kot.orderType,
        tableName: selectedTable?.name,
        tableNumber: selectedTable?.number,
        section: selectedTable?.section || undefined,
        serverName: authSession?.user?.name || undefined,
        timestamp: new Date(),
        items: itemsToSend.map(item => ({
          name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
          quantity: item.quantity,
          modifiers: item.modifiers,
          categoryId: item.categoryId,
          isNew: kotType === "FOLLOWUP",
        })),
      };
      const { printKOTMulti } = await import("@/lib/restaurant/kot-print");
      await printKOTMulti(kotReceiptData);
    } catch (printErr) {
      console.error("KOT print failed:", printErr);
      toast.warning(t("pos.kotPrintFailed"), { duration: 6000 });
    }

    if (!opts?.silent) {
      toast.success(`KOT ${kot.kotNumber} sent to kitchen`);
    }

    // Update table status to OCCUPIED if it was AVAILABLE
    if (selectedTable?.id) {
      fetch(`/api/restaurant/tables/${selectedTable.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OCCUPIED" }),
      }).catch(() => {});
    }

    return { kotId: kot.id, kotSentQuantities: newSentQtys, kotOrderIds: updatedKotOrderIds };
  };

  const handlePrintPreBill = useCallback(async () => {
    if (isPrintingPreBill || cart.length === 0 || hasUnsentKotItems) return;
    setIsPrintingPreBill(true);
    try {
      const data: PreBillReceiptData = {
        storeName: companySettings?.companyName || "Store",
        storeAddress: companySettings?.companyAddress,
        storeCity: companySettings?.companyCity,
        storeState: companySettings?.companyState,
        storePhone: companySettings?.companyPhone,
        logoUrl: preBillReceiptMeta?.logoUrl || undefined,
        logoHeight: preBillReceiptMeta?.logoHeight || undefined,
        brandColor: preBillReceiptMeta?.brandColor || undefined,
        vatNumber: preBillReceiptMeta?.vatNumber || companySettings?.companyGstNumber || undefined,
        secondaryName: preBillReceiptMeta?.secondaryName || undefined,
        currency: preBillReceiptMeta?.currency || undefined,
        taxLabel: preBillReceiptMeta?.taxLabel || undefined,
        orderNumber: activeTabOrderNumber,
        date: new Date(),
        tableName: selectedTable?.name,
        tableNumber: selectedTable?.number,
        section: selectedTable?.section,
        serverName: authSession?.user?.name || undefined,
        orderType,
        customerName: selectedCustomer?.name,
        items: cart.map((item) => ({
          name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
          lineTotal: item.quantity * item.price * (1 - (item.discount || 0) / 100),
          modifiers: item.modifiers,
        })),
        subtotal: cartTotals.subtotal,
        taxAmount: cartTotals.taxAmount,
        roundOffAmount: cartTotals.roundOffAmount,
        total: cartTotals.total,
        isTaxInclusivePrice: preBillReceiptMeta?.isTaxInclusivePrice || taxInclusive,
      };
      const { printPreBill } = await import("@/lib/pos/pre-bill-print");
      await printPreBill(data);
      // Mark order as billed (table stays occupied until payment)
      setPreBillPrinted(true);
      // Persist the billed state immediately (spread to avoid stale closure on preBillPrinted)
      persistTab({ ...snapshotCurrentTab(), preBillPrinted: true });
      toast.success(t("pos.preBillPrinted") || "Bill printed");
    } catch (err) {
      console.error("Pre-bill print failed:", err);
      toast.error(t("pos.preBillPrintFailed") || "Failed to print bill");
    } finally {
      setIsPrintingPreBill(false);
    }
  }, [isPrintingPreBill, cart, companySettings, preBillReceiptMeta, selectedTable, authSession, orderType, selectedCustomer, cartTotals, taxInclusive, activeTabOrderNumber, hasUnsentKotItems, t, persistTab, snapshotCurrentTab]);

  const handleSendToKitchen = async () => {
    if (kotInFlightRef.current) return;
    kotInFlightRef.current = true;
    setIsKotSending(true);

    if (orderType === "DINE_IN" && !selectedTable) {
      toast.error(t("pos.selectTableForDineIn"));
      setShowTableSelect(true);
      kotInFlightRef.current = false;
      setIsKotSending(false);
      return;
    }

    try {
      const result = await sendKotForUnsentItems();
      if (!result) {
        toast.info(t("pos.noNewKitchenItems"));
      } else if (isRestaurantEnabled) {
        // Snapshot with correct KOT data (React state hasn't batched yet)
        const snapshot = {
          ...snapshotCurrentTab(),
          kotSentQuantities: result.kotSentQuantities,
          kotOrderIds: result.kotOrderIds,
        };
        switchToNewTab(snapshot);
        resetLiveState();
      }
      feedbackKotSent();
    } catch (error) {
      console.error("Failed to send KOT:", error);
      feedbackError();
      toast.error(t("pos.failedToSendToKitchen"));
    } finally {
      kotInFlightRef.current = false;
      setIsKotSending(false);
    }
  };

  // ── Cancel Sent Kitchen Item (Void KOT) ────────────────────────────

  const [pendingCancelItem, setPendingCancelItem] = useState<{ productId: string; variantId?: string } | null>(null);

  const handleCartItemRemove = (productId: string, variantId?: string) => {
    const key = cartLineKey(productId, variantId);
    const sentQty = kotSentQuantities.get(key) ?? 0;
    if (sentQty > 0) {
      // Item was sent to kitchen — need confirmation + void KOT
      setPendingCancelItem({ productId, variantId });
    } else {
      // Not sent to kitchen — remove normally
      removeFromCart(productId, variantId);
    }
  };

  const confirmCancelKitchenItem = async () => {
    if (!pendingCancelItem) return;
    const { productId, variantId } = pendingCancelItem;
    const key = cartLineKey(productId, variantId);
    const sentQty = kotSentQuantities.get(key) ?? 0;
    const item = cartState.items.find((i) => makeLineKey(i.productId, i.variantId) === makeLineKey(productId, variantId));
    if (!item || sentQty <= 0) {
      removeFromCart(productId, variantId);
      setPendingCancelItem(null);
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
          items: [{ productId: item.productId, name: item.variantName ? `${item.name} - ${item.variantName}` : item.name, quantity: sentQty }],
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
          items: [{ name: item.variantName ? `${item.name} - ${item.variantName}` : item.name, quantity: sentQty, modifiers: item.modifiers, categoryId: item.categoryId }],
        };
        const { printKOTMulti } = await import("@/lib/restaurant/kot-print");
        await printKOTMulti(kotReceiptData);
      } catch (printErr) {
        console.error("Void KOT print failed:", printErr);
        toast.warning(t("pos.voidKotPrintFailed"), { duration: 6000 });
      }

      // Update sent quantities
      const newSentQtys = new Map(kotSentQuantities);
      newSentQtys.delete(key);
      setKotSentQuantities(newSentQtys);

      // If all KOT items have been voided, free the table
      if (newSentQtys.size === 0 && selectedTable) {
        freeTable(selectedTable.id);
      }

      // Remove from cart
      removeFromCart(productId, variantId);
      toast.success(`Cancelled: ${item.variantName ? `${item.name} - ${item.variantName}` : item.name} (void KOT sent to kitchen)`);
    } catch (error) {
      console.error("Failed to cancel kitchen item:", error);
      toast.error(t("pos.failedToCancelKitchenItem"));
    } finally {
      setPendingCancelItem(null);
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

    // Auto-send KOT for any unsent items before checkout
    if (isRestaurantEnabled) {
      try {
        await sendKotForUnsentItems({ silent: true });
      } catch (err) {
        console.error("Auto KOT before checkout failed:", err);
        // Don't block checkout — KOT failure shouldn't prevent payment
      }
    }

    try {
      // Content-based idempotency key: same cart + payments + counter = same key.
      // Counter increments only on success, so retries reuse the same key
      // but legitimate repeat orders get a new key.
      const keySource = JSON.stringify({
        s: posSession?.id,
        n: checkoutCounterRef.current,
        i: completedCart.map(item => `${item.productId}:${item.quantity}:${item.price}:${item.discount}`).sort(),
        p: payments.map(p => `${p.method}:${parseFloat(p.amount)}`).sort(),
        gd: globalDiscount,
        gdt: globalDiscountType,
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
            name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount,
            gstRate: item.gstRate || 0,
            hsnCode: item.hsnCode || undefined,
            unitId: item.unitId || undefined,
            conversionFactor: item.conversionFactor || 1,
            variantId: item.variantId || undefined,
            variantName: item.variantName || undefined,
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
          globalDiscount: globalDiscount > 0 ? globalDiscount : undefined,
          globalDiscountType: globalDiscount > 0 ? globalDiscountType : undefined,
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
        orderType: isRestaurantEnabled ? orderType : undefined,
        tableNumber: selectedTable?.number,
        tableName: selectedTable?.name || undefined,
        orderNumber: isRestaurantEnabled ? activeTabOrderNumber : undefined,
        items: completedCart.map((item, idx) => {
          const lineTotal = item.quantity * item.price * (1 - (item.discount || 0) / 100);
          const invoiceItem = result.invoice?.items?.[idx] as Record<string, unknown> | undefined;
          return {
            name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
            lineTotal,
            modifiers: item.modifiers,
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
        subtotal: (Number(result.invoice?.subtotal) || snapshotTotals.subtotal) + (Number(result.invoice?.globalDiscountAmount) || snapshotTotals.globalDiscountAmount || 0),
        taxRate: receiptMeta?.taxLabel === "VAT" ? 15 : 0,
        taxAmount: receiptMeta?.taxLabel === "VAT"
          ? Number(result.invoice?.totalVat || 0)
          : (Number(result.invoice?.totalCgst || 0) + Number(result.invoice?.totalSgst || 0) + Number(result.invoice?.totalIgst || 0)) || snapshotTotals.taxAmount,
        roundOffAmount: Number(result.invoice?.roundOffAmount || 0) || snapshotTotals.roundOffAmount,
        globalDiscountPercent: Number(result.invoice?.globalDiscountPercent || 0) || globalDiscount,
        globalDiscountAmount: Number(result.invoice?.globalDiscountAmount || 0) || snapshotTotals.globalDiscountAmount,
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
        placeOfSupplyName: await (async () => {
          const pos = (result.invoice as Record<string, unknown>)?.placeOfSupply as string | undefined;
          if (!pos) return undefined;
          const { INDIAN_STATES } = await import("@/lib/gst/constants");
          return INDIAN_STATES[pos] || pos;
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

      // Server confirmed — close this tab and switch to next (or reset if last)
      handleCloseTab(activeTabId);
      // Always prompt for next order after payment
      if (isRestaurantEnabled) setShowTableSelect(true);

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
      feedbackError();
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
    if (kotSentQuantities.size > 0) {
      toast.error(t("pos.cannotHoldKotOrder"));
      return;
    }
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
      // After successful hold, close this tab (or reset if last)
      handleCloseTab(activeTabId);
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

    // Always open restored order in a new tab
    const customerName = order.customer?.name;
    const snapshot = snapshotCurrentTab();
    switchToNewTab(snapshot, {
      label: customerName || `Held #${order.id.slice(-4)}`,
      heldOrderId: order.id,
      selectedCustomer: order.customerId && order.customer
        ? { id: order.customerId, name: order.customer.name, phone: null }
        : null,
    });
    // Restore into the new (now active) live state
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
    setShowTableSelect(true);
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
  if (!posSession || !isHydrated) {
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
        heldOrdersCount={isRestaurantEnabled ? 0 : heldOrders.length}
        onHeldOrdersClick={isRestaurantEnabled ? undefined : openHeldOrders}
        onCloseSession={openCloseSessionDialog}
        onBackToSessions={backToSessions}
        onReprintReceipt={lastReceiptData && !isPendingReceipt ? reprintReceipt : undefined}
        isReprintLoading={isPendingReceipt}
        onReturn={toggleReturnMode}
        hiddenComponents={posHiddenSet}
        isReturnMode={isReturnMode}
        onPreviousOrders={openPreviousOrders}
        onCashMovement={() => setShowCashMovementDialog(true)}
        selectedTable={selectedTable}
        orderType={orderType}
        isRestaurantMode={isRestaurantEnabled}
        onTableClick={() => setShowTableSelect(true)}
        tabCount={tabCount}
        onTabsClick={() => setShowTabsSheet(true)}
        isSocketConnected={isRestaurantEnabled ? isSocketConnected : undefined}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Products */}
        <div className={cn(
          "flex-1 flex-col overflow-hidden pt-4 md:p-4",
          mobileView === "products" ? "flex" : "hidden md:flex"
        )}>
          <div className="flex flex-col gap-3 flex-1 overflow-hidden px-4 md:px-0">
          {(!isPosComponentHidden("product-search") || !isPosComponentHidden("view-mode-toggle")) && (
          <div className="flex items-center gap-2">
            {!isPosComponentHidden("product-search") && (
            <div className="flex-1">
              <ProductSearch value={searchQuery} onChange={setSearchQuery} />
            </div>
            )}
            {!isPosComponentHidden("view-mode-toggle") && (
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            )}
          </div>
          )}
          {!isPosComponentHidden("category-tabs") && (
          <CategoryTabs
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          )}
          <ProductGrid
            viewMode={viewMode}
            products={productsWithDefaultPrice}
            isLoading={productsLoading}
            searchQuery={deferredSearchQuery}
            selectedCategory={selectedCategory}
            selectedQuantities={selectedProductQuantities}
            selectionRevision={cartState.revision}
            onAddToCart={addToCartWithDefault}
            showQuickSale={!isPosComponentHidden("quick-sale-tile")}
            onQuickSale={() => setShowQuickSaleDialog(true)}
          />
          </div>

          {/* Bottom bar — mobile only */}
          <div className="flex shrink-0 gap-2 bg-slate-900 p-2 pb-[max(0.5rem,var(--app-safe-area-bottom))] sm:gap-3 sm:p-3 sm:pb-[max(0.75rem,var(--app-safe-area-bottom))] md:hidden">
              <button
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-3 py-3.5 text-sm font-semibold text-white active:bg-slate-600"
                onClick={() => { feedbackNavTap(); setMobileView("cart"); }}
              >
                <ShoppingCart className="h-5 w-5" />
                <Badge className="min-w-5 justify-center rounded-full bg-white px-1.5 py-0 text-xs text-slate-900">
                  {cartQuantity}
                </Badge>
              </button>
              {isRestaurantEnabled && !isPosComponentHidden("table-select") && (
                <button
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-2 py-3.5 text-sm font-semibold text-white active:bg-amber-500"
                  onClick={() => { feedbackNavTap(); setShowTableSelect(true); }}
                >
                  <Armchair className="h-4 w-4" />
                  {selectedTable ? `T${selectedTable.number}` : t("restaurant.selectTable").split(" ")[0]}
                </button>
              )}
              {isRestaurantEnabled && !isPosComponentHidden("kot-button") && (
                <button
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-2 py-3.5 text-sm font-semibold text-white active:bg-orange-500 disabled:opacity-50"
                  onClick={handleSendToKitchen}
                  disabled={isKotSending || cartState.items.length === 0}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  KOT
                  {kotSentQuantities.size > 0 && cartState.items.some(i => (i.quantity - (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0)) > 0) && (
                    <Badge className="min-w-5 justify-center rounded-full bg-white px-1.5 py-0 text-xs text-orange-700">
                      {cartState.items.reduce((count, i) => {
                        const diff = i.quantity - (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0);
                        return diff > 0 ? count + 1 : count;
                      }, 0)}
                    </Badge>
                  )}
                </button>
              )}
              {!isPosComponentHidden("pay-now-button") && (
              <button
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white active:opacity-90 disabled:opacity-50",
                  isReturnMode ? "bg-red-600" : "bg-primary"
                )}
                disabled={cart.length === 0}
                onClick={() => {
                  feedbackNavTap();
                  setChargedFromProducts(true);
                  setView("payment");
                  setMobileView("payment");
                }}
              >
                {isReturnMode ? (
                  <>
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t("pos.processReturn")} {fmt(cartTotals.total)}</span>
                  </>
                ) : (
                  <span className="truncate">{t("pos.charge")} {fmt(cartTotals.total)}</span>
                )}
              </button>
              )}
          </div>
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
              {/* Customer Select — hidden in restaurant mode or by admin config */}
              {!isRestaurantEnabled && !isPosComponentHidden("customer-select") && (
                <div className="border-b p-3">
                  <CustomerSelect
                    selectedCustomer={selectedCustomer}
                    onSelect={setSelectedCustomer}
                  />
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
                className="flex-1 overflow-x-hidden overflow-y-auto divide-y divide-slate-100"
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
                      key={`${item.productId}:${item.variantId || ""}:${item.quantity}:${item.discount}`}
                      item={item}
                      onRemove={(productId) => { feedbackRemoveItem(); (isRestaurantEnabled ? handleCartItemRemove : removeFromCart)(productId); }}
                      kotSentQty={isRestaurantEnabled ? (kotSentQuantities.get(cartLineKey(item.productId, item.variantId)) ?? 0) : undefined}
                      onQuantityChange={isRestaurantEnabled ? (productId, variantId, qty) => {
                        feedbackQuantity();
                        dispatchCart({ type: "SET_QUANTITY", productId, variantId, quantity: qty });
                      } : undefined}
                    />
                  ))
                )}
              </div>

              {/* Cart Summary & Actions */}
              {cart.length > 0 && (
                <div
                  key={`cart-summary-${cartState.revision}`}
                  className="border-t p-2 space-y-1.5"
                >
                  {!isPosComponentHidden("global-discount") && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className={cn(
                          "h-6 rounded-md border text-[10px] font-bold px-1.5 transition-colors shrink-0",
                          globalDiscountType === "percent"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        )}
                        onClick={() => {
                          setGlobalDiscountType(globalDiscountType === "percent" ? "amount" : "percent");
                          setGlobalDiscount(0);
                        }}
                      >
                        {globalDiscountType === "percent" ? "%" : "#"}
                      </button>
                      <div className="flex items-center gap-1 flex-1">
                        {globalDiscountType === "percent" && [5, 10, 15, 20].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            className={cn(
                              "h-6 min-w-[36px] rounded-md border text-xs font-medium transition-colors",
                              globalDiscount === pct
                                ? "border-primary bg-primary text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            )}
                            onClick={() => setGlobalDiscount(globalDiscount === pct ? 0 : pct)}
                          >
                            {pct}%
                          </button>
                        ))}
                        <input
                          type="number"
                          min={0}
                          max={globalDiscountType === "percent" ? 100 : undefined}
                          step={globalDiscountType === "percent" ? "0.01" : "0.01"}
                          value={globalDiscount || ""}
                          placeholder={globalDiscountType === "percent" ? "%" : t("pos.globalDiscount")}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (globalDiscountType === "percent") {
                              setGlobalDiscount(isNaN(v) ? 0 : Math.min(Math.max(v, 0), 100));
                            } else {
                              setGlobalDiscount(isNaN(v) ? 0 : Math.max(v, 0));
                            }
                          }}
                          className={cn(
                            "h-6 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-right tabular-nums focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                            globalDiscountType === "percent" ? "w-14" : "flex-1"
                          )}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    {!isPosComponentHidden("cart-summary") && (
                    <div className="flex-1">
                      <CartSummary items={cart} isTaxInclusivePrice={taxInclusive} roundOffMode={roundOffMode} globalDiscount={globalDiscount} globalDiscountType={globalDiscountType} />
                    </div>
                    )}
                    {isRestaurantEnabled && !isPosComponentHidden("clear-cart-button") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={handleClearCart}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isRestaurantEnabled && (!isPosComponentHidden("kot-button") || !isPosComponentHidden("pre-bill-button")) && (
                    <div className="flex gap-1.5">
                      {!isPosComponentHidden("kot-button") && (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={handleSendToKitchen}
                        disabled={cartState.items.length === 0 || isKotSending}
                      >
                        {isKotSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UtensilsCrossed className="h-4 w-4 mr-1" />}
                        KOT
                        {kotSentQuantities.size > 0 && cartState.items.some(i => (i.quantity - (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0)) > 0) && (
                          <Badge variant="secondary" className="ml-1">
                            {cartState.items.reduce((count, i) => {
                              const diff = i.quantity - (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0);
                              return diff > 0 ? count + 1 : count;
                            }, 0)}
                          </Badge>
                        )}
                      </Button>
                      )}
                      {!isPosComponentHidden("pre-bill-button") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={handlePrintPreBill}
                        disabled={isPrintingPreBill || cart.length === 0 || hasUnsentKotItems}
                      >
                        {isPrintingPreBill ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Receipt className="h-4 w-4 mr-1" />}
                        Bill
                      </Button>
                      )}
                    </div>
                  )}
                  {!isRestaurantEnabled && (
                    <div className="flex gap-2">
                      {!isReturnMode && !isPosComponentHidden("hold-order-button") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={holdOrder}
                        >
                          <PauseCircle className="h-4 w-4 mr-1" />
                          {t("pos.holdOrder").split(" ")[0]}
                        </Button>
                      )}
                      {!isPosComponentHidden("clear-cart-button") && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleClearCart}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {t("pos.clearCart").split(" ")[0]}
                      </Button>
                      )}
                    </div>
                  )}
                  {!isPosComponentHidden("pay-now-button") && (
                  <Button
                    className={cn(
                      "w-full h-10 text-base font-bold",
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
                  )}
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
              hiddenComponents={posHiddenSet}
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
            <DialogDescription className="sr-only">
              {t("pos.enterClosingCashAmount")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Expected Cash — hero number */}
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("pos.expectedCash")}
              </p>
              {isLoadingSummary ? (
                <Loader2 className="mx-auto mt-2 h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(expectedCash)}</p>
              )}
            </div>

            {/* Counted Closing Cash — main input */}
            <div>
              <label className="mb-1 block text-sm font-medium">{t("pos.countedClosingCash")}</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                className="h-12 text-center text-lg tabular-nums"
                value={closingCash}
                onInput={(e) => syncClosingCashValue((e.target as HTMLInputElement).value)}
                onChange={(e) => syncClosingCashValue(e.currentTarget.value)}
                autoFocus
              />
            </div>

            {/* Cash Difference — prominent display */}
            {countedClosingCash !== null && !isLoadingSummary && cashDifference !== null && (
              <div className={cn(
                "rounded-lg py-3 text-center",
                cashDifference > 0 ? "bg-green-50" : cashDifference < 0 ? "bg-red-50" : "bg-slate-50"
              )}>
                <p className={cn(
                  "text-xl font-bold tabular-nums",
                  cashDifference > 0 ? "text-green-600" : cashDifference < 0 ? "text-red-600" : "text-slate-600"
                )}>
                  {formatSignedDifference(cashDifference, fmt)}
                </p>
                <p className={cn(
                  "mt-0.5 text-xs font-medium",
                  cashDifference > 0 ? "text-green-600" : cashDifference < 0 ? "text-red-600" : "text-slate-500"
                )}>
                  {cashDifference > 0 ? t("pos.overage") : cashDifference < 0 ? t("pos.shortage") : t("pos.exactMatch")}
                </p>
              </div>
            )}

            {/* Employee PIN — conditional */}
            {posSession.employeeId && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t("pos.employeePin")}
                </label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder={t("pos.enterFourDigitPin")}
                  value={closePinCode}
                  onChange={(e) => setClosePinCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 text-center font-mono text-lg tracking-[0.3em]"
                />
              </div>
            )}

            {/* Session Details — collapsible */}
            {!isLoadingSummary && (
              <details className="group rounded-lg border">
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-medium select-none">
                  {t("pos.sessionDetails")}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-3 pb-3 pt-2 text-sm">
                  {/* Meta row */}
                  <div className="mb-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{posSession.sessionNumber}</span>
                    <span>&middot;</span>
                    <span>{formatDistanceToNow(new Date(posSession.openedAt), { addSuffix: true })}</span>
                    <span>&middot;</span>
                    <span>{posSession.totalTransactions} {t("pos.transactions").toLowerCase()}</span>
                  </div>
                  {/* Opening Cash */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">{t("pos.openingCash")}</span>
                    <span className="font-medium tabular-nums">{fmt(Number(posSession.openingCash))}</span>
                  </div>
                  {/* Cash Sales */}
                  {cashSalesTotal > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">{t("pos.cashSales")}</span>
                      <span className="font-medium tabular-nums">{fmt(cashSalesTotal)}</span>
                    </div>
                  )}
                  {/* Cash In/Out totals */}
                  {cashMovementTotals && cashMovementTotals.totalCashIn > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-green-600">{lang === "ar" ? "إيداع نقدي" : "Cash In"}</span>
                      <span className="font-medium tabular-nums text-green-600">+{fmt(cashMovementTotals.totalCashIn)}</span>
                    </div>
                  )}
                  {cashMovementTotals && cashMovementTotals.totalCashOut > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-red-500">{lang === "ar" ? "سحب نقدي" : "Cash Out"}</span>
                      <span className="font-medium tabular-nums text-red-500">-{fmt(cashMovementTotals.totalCashOut)}</span>
                    </div>
                  )}
                  {/* Payment breakdown rows (non-cash + refunds) */}
                  {visiblePaymentBreakdown
                    .filter((p) => p.method !== "CASH")
                    .map((payment) => (
                    <div key={payment.method} className="flex items-center justify-between py-1">
                      <span className={payment.method === "CASH_REFUND" ? "text-red-500" : "text-muted-foreground"}>
                        {getPaymentMethodLabel(payment.method, t)}
                      </span>
                      <span className={cn("font-medium tabular-nums", payment.method === "CASH_REFUND" && "text-red-500")}>
                        {payment.method === "CASH_REFUND" ? `-${fmt(Math.abs(Number(payment.total)))}` : fmt(Number(payment.total))}
                      </span>
                    </div>
                  ))}
                  {/* Non-cash deposit total */}
                  {nonCashTotal > 0 && (
                    <div className="mt-1 flex items-center justify-between border-t pt-2">
                      <span className="font-medium text-slate-700">{t("pos.depositNonCashTo")}</span>
                      <span className="font-semibold tabular-nums">{fmt(nonCashTotal)}</span>
                    </div>
                  )}
                </div>
              </details>
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

      {/* Held Orders Sheet — hidden when restaurant module is enabled (tabs replace it) */}
      {!isRestaurantEnabled && (
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
      )}

      <PreviousOrdersSheet
        open={showPreviousOrdersSheet}
        onClose={() => setShowPreviousOrdersSheet(false)}
        sessionId={posSession?.id ?? null}
        companySettings={companySettings}
      />

      {posSession && (
        <CashMovementDialog
          open={showCashMovementDialog}
          onOpenChange={setShowCashMovementDialog}
          sessionId={posSession.id}
          onSuccess={() => {
            // Invalidate session summary so close dialog picks up updated expected cash
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("pos-cash-movement-updated"));
            }
          }}
        />
      )}

      <QuickSaleDialog
        open={showQuickSaleDialog}
        onOpenChange={setShowQuickSaleDialog}
        onAdd={handleQuickSale}
      />

      <OrderTabsSheet
        open={showTabsSheet}
        onOpenChange={setShowTabsSheet}
        tabs={allTabs(snapshotCurrentTab())}
        activeTabId={activeTabId}
        onSwitch={handleTabSwitch}
        onClose={handleCloseTab}
        onNew={handleNewTab}
      />

      {isRestaurantEnabled && (
        <TableSelect
          open={showTableSelect}
          onOpenChange={setShowTableSelect}
          required={!selectedTable && cart.length === 0}
          onSelectTable={async (table) => {
            if (!table) {
              setShowTableSelect(false);
              return;
            }

            // Already on this table's tab — just close
            if (selectedTable?.id === table.id) {
              setShowTableSelect(false);
              return;
            }
            const oldTable = selectedTable;
            if (oldTable) {
              // Free the old table before reassigning
              freeTable(oldTable.id);
            }

            // Assign table to the current tab (table becomes OCCUPIED when KOT is sent)
            setSelectedTable(table);
            setOrderType("DINE_IN");
            // Update tab label immediately (don't wait for auto-label effect)
            const newLabel = selectedCustomer
              ? `#${activeTabOrderNumber} · T${table.number} - ${selectedCustomer.name}`
              : `#${activeTabOrderNumber} · T${table.number}`;
            updateActiveTabLabel(newLabel);
            setShowTableSelect(false);
            // Sync table change to server
            requestAnimationFrame(() => {
              persistTab(snapshotCurrentTab());
            });

            // If KOTs were already sent, update them and notify kitchen
            if (oldTable && kotOrderIds.length > 0) {
              // Update KOT records in DB to new table
              for (const kotId of kotOrderIds) {
                fetch(`/api/restaurant/kot/${kotId}/move`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ tableId: table.id }),
                }).catch(() => {});
              }
              // Print table move notification to kitchen
              import("@/lib/restaurant/kot-print").then(({ printKOTMulti }) =>
                printKOTMulti({
                  kotNumber: "TABLE MOVE",
                  kotType: "STANDARD",
                  orderType: "DINE_IN",
                  tableName: table.name,
                  tableNumber: table.number,
                  section: table.section,
                  serverName: authSession?.user?.name || undefined,
                  timestamp: new Date(),
                  specialInstructions: `MOVED FROM TABLE ${oldTable.number} → TABLE ${table.number}`,
                  items: cartState.items
                    .filter(i => (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0) > 0)
                    .map(i => ({
                      name: i.variantName ? `${i.name} - ${i.variantName}` : i.name,
                      quantity: kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? i.quantity,
                      modifiers: i.modifiers,
                      categoryId: i.categoryId,
                    })),
                })
              ).catch(() => {});
            }
          }}
          onTakeaway={() => {
            const oldTable = selectedTable;
            // Free the old table if switching from dine-in
            if (oldTable) {
              freeTable(oldTable.id);
            }

            setSelectedTable(null);
            setOrderType("TAKEAWAY");
            updateActiveTabLabel(`#${activeTabOrderNumber} · Takeaway`);
            setShowTableSelect(false);
            // Sync change to server
            requestAnimationFrame(() => {
              persistTab(snapshotCurrentTab());
            });

            // Notify kitchen if KOTs were already sent for this table
            if (kotOrderIds.length > 0 && oldTable) {
              // Update KOT records to clear table reference
              for (const kotId of kotOrderIds) {
                fetch(`/api/restaurant/kot/${kotId}/move`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ tableId: null }),
                }).catch(() => {});
              }
              // Print kitchen notification
              import("@/lib/restaurant/kot-print").then(({ printKOTMulti }) =>
                printKOTMulti({
                  kotNumber: "ORDER TYPE CHANGE",
                  kotType: "STANDARD",
                  orderType: "TAKEAWAY",
                  tableName: oldTable.name,
                  tableNumber: oldTable.number,
                  section: oldTable.section || undefined,
                  serverName: authSession?.user?.name || undefined,
                  timestamp: new Date(),
                  specialInstructions: `TABLE ${oldTable.number} → TAKEAWAY`,
                  items: cartState.items
                    .filter(i => (kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? 0) > 0)
                    .map(i => ({
                      name: i.variantName ? `${i.name} - ${i.variantName}` : i.name,
                      quantity: kotSentQuantities.get(cartLineKey(i.productId, i.variantId)) ?? i.quantity,
                      modifiers: i.modifiers,
                      categoryId: i.categoryId,
                    })),
                })
              ).catch(() => {});
            }
          }}
        />
      )}

      {/* Cancel Kitchen Item Confirmation Dialog */}
      <Dialog open={!!pendingCancelItem} onOpenChange={(open) => { if (!open) setPendingCancelItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("restaurant.cancelKitchenOrder") || "Cancel Kitchen Order?"}</DialogTitle>
            <DialogDescription>
              {t("restaurant.cancelKitchenOrderDesc") || "This item was already sent to the kitchen. A cancellation ticket will be printed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingCancelItem(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmCancelKitchenItem}>
              {t("restaurant.confirmCancel") || "Cancel & Notify Kitchen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Cart with Active KOT Warning */}
      <Dialog open={showClearCartKotWarning} onOpenChange={setShowClearCartKotWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{kotSentQuantities.size > 0 ? "Clear cart with sent kitchen items?" : "Clear cart without sending to kitchen?"}</DialogTitle>
            <DialogDescription>
              {kotSentQuantities.size > 0
                ? `${kotSentQuantities.size} item(s) were already sent to the kitchen. Clearing the cart will NOT cancel those kitchen tickets.`
                : "Items in the cart have not been sent to the kitchen yet. They will be lost if you clear."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowClearCartKotWarning(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmClearCartWithKot}>
              Clear Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Variant & Modifier Picker Dialog */}
      <VariantPickerDialog
        open={!!variantPickerProduct}
        onOpenChange={(open) => { if (!open) setVariantPickerProduct(null); }}
        productName={variantPickerProduct?.name || ""}
        variants={variantPickerProduct?.variants || []}
        modifiers={variantPickerProduct?.modifiers || []}
        onSelect={(variant, selectedModifiers) => {
          if (variantPickerProduct) {
            feedbackAddItem();
            addToCart(
              variantPickerProduct,
              1,
              undefined,
              undefined,
              undefined,
              variant ? variant.price : null,
              variant?.id,
              variant?.name,
              selectedModifiers,
            );
          }
        }}
      />
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
