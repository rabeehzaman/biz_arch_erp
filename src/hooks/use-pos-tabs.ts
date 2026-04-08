import { useState, useRef, useCallback, useEffect } from "react";
import useSWR from "swr";
import type { CartItemData } from "@/components/pos/cart-item";

interface CartState {
  items: CartItemData[];
  totalQuantity: number;
  selectedProductQuantities: Record<string, number>;
  revision: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface TableRef {
  id: string;
  number: number;
  name: string;
  section?: string;
  capacity: number;
}

export interface TabContext {
  id: string;
  label: string;
  cartState: CartState;
  selectedCustomer: Customer | null;
  selectedTable: TableRef | null;
  heldOrderId: string | null;
  isReturnMode: boolean;
  orderType: "DINE_IN" | "TAKEAWAY";
  kotSentQuantities: Map<string, number>;
  kotOrderIds: string[];
  view: "cart" | "payment";
  createdAt: number;
}

// DB record shape from API
interface DBOpenOrder {
  id: string;
  label: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  isReturnMode: boolean;
  items: CartItemData[];
  customerId: string | null;
  customerName: string | null;
  tableId: string | null;
  tableNumber: number | null;
  tableName: string | null;
  tableSection: string | null;
  tableCapacity: number | null;
  heldOrderId: string | null;
  kotSentQuantities: Record<string, number>;
  kotOrderIds: string[];
  version: number;
  createdAt: string;
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const EMPTY_CART: CartState = {
  items: [],
  totalQuantity: 0,
  selectedProductQuantities: {},
  revision: 0,
};

function buildCartState(items: CartItemData[]): CartState {
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    selectedProductQuantities: items.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {}),
    revision: 0,
  };
}

function makeDefaultTab(id: string, label: string): TabContext {
  return {
    id,
    label,
    cartState: EMPTY_CART,
    selectedCustomer: null,
    selectedTable: null,
    heldOrderId: null,
    isReturnMode: false,
    orderType: "DINE_IN",
    kotSentQuantities: new Map(),
    kotOrderIds: [],
    view: "cart",
    createdAt: Date.now(),
  };
}

function deserializeTab(record: DBOpenOrder): TabContext {
  const items = Array.isArray(record.items) ? record.items : [];
  return {
    id: record.id,
    label: record.label,
    cartState: buildCartState(items),
    selectedCustomer: record.customerId
      ? { id: record.customerId, name: record.customerName || "", phone: null }
      : null,
    selectedTable: record.tableId
      ? {
          id: record.tableId,
          number: record.tableNumber || 0,
          name: record.tableName || "",
          section: record.tableSection || undefined,
          capacity: record.tableCapacity || 4,
        }
      : null,
    heldOrderId: record.heldOrderId,
    isReturnMode: record.isReturnMode,
    orderType: record.orderType,
    kotSentQuantities: new Map(
      Object.entries(record.kotSentQuantities || {}).map(([k, v]) => [k, Number(v)])
    ),
    kotOrderIds: Array.isArray(record.kotOrderIds) ? record.kotOrderIds : [],
    view: "cart",
    createdAt: new Date(record.createdAt).getTime(),
  };
}

function serializeTab(tab: TabContext): Record<string, unknown> {
  return {
    label: tab.label,
    orderType: tab.orderType,
    isReturnMode: tab.isReturnMode,
    items: tab.cartState.items,
    customerId: tab.selectedCustomer?.id || null,
    customerName: tab.selectedCustomer?.name || null,
    tableId: tab.selectedTable?.id || null,
    tableNumber: tab.selectedTable?.number ?? null,
    tableName: tab.selectedTable?.name || null,
    tableSection: tab.selectedTable?.section || null,
    tableCapacity: tab.selectedTable?.capacity ?? null,
    heldOrderId: tab.heldOrderId,
    kotSentQuantities: Object.fromEntries(tab.kotSentQuantities),
    kotOrderIds: tab.kotOrderIds,
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePOSTabs(
  sessionId: string | null,
  onActiveTabRemoteUpdate?: (tab: TabContext) => void,
  onActiveTabRemoved?: () => void,
) {
  // Inactive tabs — the active tab's state lives in the component's hooks
  const [tabs, setTabs] = useState<Map<string, TabContext>>(() => new Map());
  const [activeTabId, setActiveTabId] = useState<string>(() => generateId());
  const [activeTabLabel, setActiveTabLabel] = useState("Order 1");
  const [activeTabCreatedAt, setActiveTabCreatedAt] = useState(() => Date.now());
  const orderCounterRef = useRef(1);
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const onActiveTabRemoteUpdateRef = useRef(onActiveTabRemoteUpdate);
  onActiveTabRemoteUpdateRef.current = onActiveTabRemoteUpdate;
  const onActiveTabRemovedRef = useRef(onActiveTabRemoved);
  onActiveTabRemovedRef.current = onActiveTabRemoved;

  // DB persistence state
  const [isHydrated, setIsHydrated] = useState(false);
  const [initialTabContext, setInitialTabContext] = useState<TabContext | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionsRef = useRef<Map<string, number>>(new Map());

  // Fetch open orders from DB — poll every 5s for cross-device sync
  const { data: dbOrders, mutate: mutateOpenOrders } = useSWR<DBOpenOrder[]>(
    sessionId ? "/api/pos/open-orders" : null,
    fetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, refreshInterval: 5000 }
  );

  // Hydrate from DB — runs once when data first arrives
  useEffect(() => {
    if (isHydrated || !dbOrders) return;

    if (dbOrders.length === 0) {
      // No persisted tabs — keep default empty state
      setIsHydrated(true);
      return;
    }

    const deserialized = dbOrders.map(deserializeTab);

    // First tab becomes active, rest go into inactive Map
    const [first, ...rest] = deserialized;
    setActiveTabId(first.id);
    setActiveTabLabel(first.label);
    setActiveTabCreatedAt(first.createdAt);
    setInitialTabContext(first);

    if (rest.length > 0) {
      const map = new Map<string, TabContext>();
      for (const tab of rest) {
        map.set(tab.id, tab);
      }
      setTabs(map);
    }

    // Store versions
    for (const record of dbOrders) {
      versionsRef.current.set(record.id, record.version);
    }

    orderCounterRef.current = dbOrders.length;
    setIsHydrated(true);
  }, [dbOrders, isHydrated]);

  // Reconcile remote changes after initial hydration (polling sync)
  useEffect(() => {
    if (!isHydrated || !dbOrders) return;

    const currentActiveTabId = activeTabIdRef.current;
    let hasChanges = false;

    const dbMap = new Map<string, DBOpenOrder>();
    for (const record of dbOrders) {
      dbMap.set(record.id, record);
    }

    // Update inactive tabs that changed on the server
    setTabs((prev) => {
      const next = new Map(prev);

      for (const record of dbOrders) {
        const localVersion = versionsRef.current.get(record.id);
        if (localVersion != null && record.version <= localVersion) continue;

        // Version increased — this record was modified externally
        if (record.id === currentActiveTabId) {
          // Active tab — only update if no local save is pending
          if (!saveTimerRef.current && onActiveTabRemoteUpdateRef.current) {
            versionsRef.current.set(record.id, record.version);
            onActiveTabRemoteUpdateRef.current(deserializeTab(record));
          }
          continue;
        }

        // Inactive tab or new tab from another device
        versionsRef.current.set(record.id, record.version);
        next.set(record.id, deserializeTab(record));
        hasChanges = true;
      }

      // Remove local tabs that no longer exist on the server (deleted/checked out elsewhere)
      for (const tabId of prev.keys()) {
        if (!dbMap.has(tabId)) {
          next.delete(tabId);
          versionsRef.current.delete(tabId);
          hasChanges = true;
        }
      }

      // Add new tabs that appeared on the server (adopted from other sessions, etc.)
      for (const record of dbOrders) {
        if (record.id !== currentActiveTabId && !prev.has(record.id) && !versionsRef.current.has(record.id)) {
          versionsRef.current.set(record.id, record.version);
          next.set(record.id, deserializeTab(record));
          hasChanges = true;
        }
      }

      return hasChanges ? next : prev;
    });

    // If the active tab was removed from the server (adopted by another device / checked out),
    // reset to a fresh empty tab so auto-save doesn't re-create the deleted order
    if (!dbMap.has(currentActiveTabId) && versionsRef.current.has(currentActiveTabId)) {
      versionsRef.current.delete(currentActiveTabId);
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      onActiveTabRemovedRef.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbOrders]);

  const tabCount = tabs.size + 1; // inactive + active

  // ── Persistence functions ─────────────────────────────────────────

  const persistTab = useCallback((tab: TabContext) => {
    if (!sessionId) return;
    const body = serializeTab(tab);
    fetch(`/api/pos/open-orders/${tab.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result?.version != null) {
          versionsRef.current.set(tab.id, result.version);
        }
      })
      .catch(() => {}); // fire-and-forget
  }, [sessionId]);

  const deletePersistedTab = useCallback((tabId: string) => {
    if (!sessionId) return;
    versionsRef.current.delete(tabId);
    fetch(`/api/pos/open-orders/${tabId}`, { method: "DELETE" }).catch(() => {});
  }, [sessionId]);

  const scheduleSave = useCallback((snapshot: TabContext) => {
    if (!sessionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistTab(snapshot);
      saveTimerRef.current = null;
    }, 2000);
  }, [sessionId, persistTab]);

  // ── Tab management functions ──────────────────────────────────────

  const allTabs = useCallback(
    (activeSnapshot: TabContext): TabContext[] => {
      const all: TabContext[] = [activeSnapshot];
      for (const tab of tabs.values()) {
        all.push(tab);
      }
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },
    [tabs]
  );

  const newTab = useCallback(
    (initialOverrides?: Partial<TabContext>): { id: string; label: string } => {
      orderCounterRef.current += 1;
      const id = generateId();
      const label = initialOverrides?.label ?? `Order ${orderCounterRef.current}`;
      return { id, label };
    },
    []
  );

  const switchTab = useCallback(
    (targetId: string, currentSnapshot: TabContext): TabContext | null => {
      // Persist outgoing tab immediately
      persistTab(currentSnapshot);

      setTabs((prev) => {
        const next = new Map(prev);
        next.set(currentSnapshot.id, currentSnapshot);
        next.delete(targetId);
        return next;
      });

      const target = tabs.get(targetId);
      if (target) {
        setActiveTabId(target.id);
        setActiveTabLabel(target.label);
        setActiveTabCreatedAt(target.createdAt);
        return target;
      }
      return null;
    },
    [tabs, persistTab]
  );

  const switchToNewTab = useCallback(
    (currentSnapshot: TabContext, overrides?: Partial<TabContext>): TabContext => {
      // Persist outgoing tab immediately
      persistTab(currentSnapshot);

      const { id, label } = newTab(overrides);
      const freshTab = makeDefaultTab(id, label);
      const merged = { ...freshTab, ...overrides, id, label };

      setTabs((prev) => {
        const next = new Map(prev);
        next.set(currentSnapshot.id, currentSnapshot);
        return next;
      });

      setActiveTabId(id);
      setActiveTabLabel(label);
      setActiveTabCreatedAt(merged.createdAt);
      return merged;
    },
    [newTab, persistTab]
  );

  const closeTab = useCallback(
    (tabId: string): { switchTo: TabContext | null; wasActive: boolean } => {
      // Cancel any pending save so it doesn't re-create the deleted order
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      // Delete from DB
      deletePersistedTab(tabId);

      if (tabId !== activeTabId) {
        setTabs((prev) => {
          const next = new Map(prev);
          next.delete(tabId);
          return next;
        });
        return { switchTo: null, wasActive: false };
      }

      // Closing the active tab
      if (tabs.size === 0) {
        orderCounterRef.current += 1;
        const newId = generateId();
        setActiveTabId(newId);
        setActiveTabLabel(`Order ${orderCounterRef.current}`);
        setActiveTabCreatedAt(Date.now());
        return { switchTo: null, wasActive: true };
      }

      let newest: TabContext | null = null;
      for (const tab of tabs.values()) {
        if (!newest || tab.createdAt > newest.createdAt) {
          newest = tab;
        }
      }

      if (newest) {
        setTabs((prev) => {
          const next = new Map(prev);
          next.delete(newest!.id);
          return next;
        });
        setActiveTabId(newest.id);
        setActiveTabLabel(newest.label);
        setActiveTabCreatedAt(newest.createdAt);
      }

      return { switchTo: newest, wasActive: true };
    },
    [activeTabId, tabs, deletePersistedTab]
  );

  const findTabByTableId = useCallback(
    (tableId: string, activeTableId?: string | null): string | null => {
      if (activeTableId === tableId) return activeTabId;
      for (const tab of tabs.values()) {
        if (tab.selectedTable?.id === tableId) return tab.id;
      }
      return null;
    },
    [activeTabId, tabs]
  );

  const updateActiveTabLabel = useCallback((label: string) => {
    setActiveTabLabel(label);
  }, []);

  const getAllTableIds = useCallback(
    (activeTableId?: string | null): string[] => {
      const ids: string[] = [];
      if (activeTableId) ids.push(activeTableId);
      for (const tab of tabs.values()) {
        if (tab.selectedTable?.id) ids.push(tab.selectedTable.id);
      }
      return ids;
    },
    [tabs]
  );

  const hasUnsavedWork = useCallback(
    (activeCartLength: number): boolean => {
      if (activeCartLength > 0) return true;
      for (const tab of tabs.values()) {
        if (tab.cartState.items.length > 0) return true;
      }
      return false;
    },
    [tabs]
  );

  /** Replace the active tab's identity with an adopted order's ID (e.g. from another session) */
  const adoptAsActiveTab = useCallback(
    (adoptedId: string, label: string, createdAt: number, version: number, currentSnapshot: TabContext) => {
      // Cancel any pending save for the old tab
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      // If current tab is empty, just replace its identity
      if (currentSnapshot.cartState.items.length === 0) {
        deletePersistedTab(currentSnapshot.id);
      } else {
        // Current tab has work — stash it as inactive
        setTabs((prev) => {
          const next = new Map(prev);
          next.set(currentSnapshot.id, currentSnapshot);
          return next;
        });
        persistTab(currentSnapshot);
      }
      // Track the adopted order's version so polling doesn't overwrite local changes
      versionsRef.current.set(adoptedId, version);
      setActiveTabId(adoptedId);
      setActiveTabLabel(label);
      setActiveTabCreatedAt(createdAt);
    },
    [deletePersistedTab, persistTab]
  );

  const clearAllTabs = useCallback(() => {
    // DB cleanup happens server-side in session close
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setTabs(new Map());
    orderCounterRef.current = 1;
    const id = generateId();
    setActiveTabId(id);
    setActiveTabLabel("Order 1");
    setActiveTabCreatedAt(Date.now());
  }, []);

  return {
    tabs,
    activeTabId,
    activeTabLabel,
    activeTabCreatedAt,
    tabCount,
    allTabs,
    newTab,
    switchTab,
    switchToNewTab,
    closeTab,
    findTabByTableId,
    updateActiveTabLabel,
    getAllTableIds,
    hasUnsavedWork,
    clearAllTabs,
    // DB persistence
    isHydrated,
    initialTabContext,
    persistTab,
    scheduleSave,
    mutateOpenOrders,
    adoptAsActiveTab,
  };
}
