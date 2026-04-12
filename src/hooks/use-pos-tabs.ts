import { useState, useRef, useCallback, useEffect } from "react";
import useSWR from "swr";
import type { CartItemData } from "@/components/pos/cart-item";
import { getPosDeviceId } from "@/lib/pos/ably-client";

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
  orderNumber: number;
  cartState: CartState;
  selectedCustomer: Customer | null;
  selectedTable: TableRef | null;
  heldOrderId: string | null;
  isReturnMode: boolean;
  orderType: "DINE_IN" | "TAKEAWAY";
  kotSentQuantities: Map<string, number>;
  kotOrderIds: string[];
  view: "cart" | "payment";
  preBillPrinted: boolean;
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
  orderNumber: number;
  preBillPrinted: boolean;
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

function parseOrderNumber(label: string): number {
  const m = label.match(/^Order\s+(\d+)/i) || label.match(/^#(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function makeDefaultTab(id: string, label: string, orderNumber: number): TabContext {
  return {
    id,
    label,
    orderNumber,
    cartState: EMPTY_CART,
    selectedCustomer: null,
    selectedTable: null,
    heldOrderId: null,
    isReturnMode: false,
    orderType: "DINE_IN",
    kotSentQuantities: new Map(),
    kotOrderIds: [],
    view: "cart",
    preBillPrinted: false,
    createdAt: Date.now(),
  };
}

function deserializeTab(record: DBOpenOrder, index: number): TabContext {
  const items = Array.isArray(record.items) ? record.items : [];
  const orderNumber = record.orderNumber || parseOrderNumber(record.label) || (index + 1);
  return {
    id: record.id,
    label: record.label,
    orderNumber,
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
    preBillPrinted: record.preBillPrinted ?? false,
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
    preBillPrinted: tab.preBillPrinted,
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePOSTabs(
  sessionId: string | null,
  onActiveTabRemoteUpdate?: (tab: TabContext) => void,
  onActiveTabRemoved?: () => void,
  organizationId?: string | null,
  onVersionUpdate?: (tabId: string, version: number) => void,
) {
  // Inactive tabs — the active tab's state lives in the component's hooks
  const [tabs, setTabs] = useState<Map<string, TabContext>>(() => new Map());
  const [activeTabId, setActiveTabId] = useState<string>(() => generateId());
  const [activeTabLabel, setActiveTabLabel] = useState("#1");
  const [activeTabOrderNumber, setActiveTabOrderNumber] = useState(1);
  const [activeTabCreatedAt, setActiveTabCreatedAt] = useState(() => Date.now());
  const orderCounterRef = useRef(1);
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const onActiveTabRemoteUpdateRef = useRef(onActiveTabRemoteUpdate);
  onActiveTabRemoteUpdateRef.current = onActiveTabRemoteUpdate;
  const onActiveTabRemovedRef = useRef(onActiveTabRemoved);
  onActiveTabRemovedRef.current = onActiveTabRemoved;
  const onVersionUpdateRef = useRef(onVersionUpdate);
  onVersionUpdateRef.current = onVersionUpdate;

  // DB persistence state
  const [isHydrated, setIsHydrated] = useState(false);
  const [initialTabContext, setInitialTabContext] = useState<TabContext | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionsRef = useRef<Map<string, number>>(new Map());

  // Fetch open orders from DB — Ably provides instant sync, polling is a 5s safety-net fallback
  const { data: dbOrders, mutate: mutateOpenOrders } = useSWR<DBOpenOrder[]>(
    sessionId ? "/api/pos/open-orders" : null,
    fetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, refreshInterval: 10000 }
  );

  // Ably: listen for org-level order create/delete events to refresh the tab list.
  // Per-order content sync is handled by useRealtimeOrder in the terminal page.
  useEffect(() => {
    if (!sessionId || !organizationId) return;

    let channel: import("ably").RealtimeChannel | null = null;
    let cleanup: (() => void) | null = null;

    // Dynamic import to avoid SSR issues with Ably client
    import("@/lib/pos/ably-client").then(({ getAblyClient }) => {
      const ably = getAblyClient();
      channel = ably.channels.get(`pos:${organizationId}`);
      const handler = () => { mutateOpenOrders(); };
      channel.subscribe("order:created", handler);
      channel.subscribe("order:deleted", handler);
      channel.subscribe("order:updated", handler);
      cleanup = () => {
        channel?.unsubscribe("order:created", handler);
        channel?.unsubscribe("order:deleted", handler);
        channel?.unsubscribe("order:updated", handler);
        channel?.detach().catch(() => {});
      };
    }).catch(() => {
      // Ably not available — polling fallback handles it
    });

    // Also keep SSE as a fallback for dev mode
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/pos/events");
      es.onmessage = () => { mutateOpenOrders(); };
      es.onerror = () => {};
    } catch {
      // EventSource not supported — polling fallback handles it
    }

    return () => {
      cleanup?.();
      es?.close();
    };
  }, [sessionId, organizationId, mutateOpenOrders]);

  // Socket.IO: listen for org-level events for instant tab list sync on VPS
  useEffect(() => {
    if (!sessionId || !organizationId) return;
    if (!process.env.NEXT_PUBLIC_SOCKET_URL) return; // No Socket.IO server available

    let socket: import("socket.io-client").Socket | null = null;
    let cleanup: (() => void) | null = null;

    import("@/lib/pos/socket-client").then(({ getPosSocket, getPosDeviceId }) => {
      socket = getPosSocket();
      const deviceId = getPosDeviceId();
      const simpleHandler = (payload: { deviceId?: string }) => {
        if (payload?.deviceId === deviceId) return;
        mutateOpenOrders();
      };
      const updateHandler = (payload: { orderId?: string; deviceId?: string; state?: { items: CartItemData[]; label: string; orderType: "DINE_IN" | "TAKEAWAY"; isReturnMode: boolean; customerId: string | null; customerName: string | null; tableId: string | null; tableNumber: number | null; tableName: string | null; tableSection: string | null; tableCapacity: number | null; heldOrderId: string | null; kotSentQuantities: Record<string, number>; kotOrderIds: string[] }; version?: number }) => {
        if (payload?.deviceId === deviceId) return;
        // Direct tab update from full state — instant, no DB round-trip
        if (payload.orderId && payload.state) {
          const oid = payload.orderId;
          const s = payload.state;
          // Update active tab if it matches
          if (oid === activeTabIdRef.current) {
            onActiveTabRemoteUpdateRef.current?.({
              id: oid,
              label: s.label,
              orderNumber: 0,
              cartState: buildCartState(s.items),
              selectedCustomer: s.customerId ? { id: s.customerId, name: s.customerName || "", phone: null } : null,
              selectedTable: s.tableId ? { id: s.tableId, number: s.tableNumber || 0, name: s.tableName || "", section: s.tableSection || undefined, capacity: s.tableCapacity || 0 } : null,
              heldOrderId: s.heldOrderId,
              isReturnMode: s.isReturnMode,
              orderType: s.orderType,
              kotSentQuantities: new Map(Object.entries(s.kotSentQuantities || {}).map(([k, v]) => [k, Number(v)])),
              kotOrderIds: s.kotOrderIds || [],
              view: "cart",
              preBillPrinted: false,
              createdAt: Date.now(),
            });
          } else {
            // Update inactive tab
            setTabs((prev) => {
              const existing = prev.get(oid);
              if (!existing) return prev;
              const next = new Map(prev);
              next.set(oid, {
                ...existing,
                cartState: buildCartState(s.items),
                selectedCustomer: s.customerId ? { id: s.customerId, name: s.customerName || "", phone: null } : null,
                selectedTable: s.tableId ? { id: s.tableId, number: s.tableNumber || 0, name: s.tableName || "", section: s.tableSection || undefined, capacity: s.tableCapacity || 0 } : null,
                kotSentQuantities: new Map(Object.entries(s.kotSentQuantities || {}).map(([k, v]) => [k, Number(v)])),
                kotOrderIds: s.kotOrderIds || [],
                orderType: s.orderType,
              });
              return next;
            });
          }
          if (payload.version != null) versionsRef.current.set(oid, payload.version);
        }
        mutateOpenOrders(); // Safety net
      };
      socket.on("order:created", simpleHandler);
      socket.on("order:deleted", simpleHandler);
      socket.on("order:updated", updateHandler);
      cleanup = () => {
        socket?.off("order:created", simpleHandler);
        socket?.off("order:deleted", simpleHandler);
        socket?.off("order:updated", updateHandler);
      };
    }).catch(() => {});

    return () => { cleanup?.(); };
  }, [sessionId, organizationId, mutateOpenOrders]);

  // Hydrate from DB — runs once when data first arrives
  useEffect(() => {
    if (isHydrated || !dbOrders) return;

    if (dbOrders.length === 0) {
      // No persisted tabs — keep default empty state
      setIsHydrated(true);
      return;
    }

    const deserialized = dbOrders.map((r, i) => deserializeTab(r, i));

    // First tab becomes active, rest go into inactive Map
    const [first, ...rest] = deserialized;
    setActiveTabId(first.id);
    setActiveTabLabel(first.label);
    setActiveTabOrderNumber(first.orderNumber);
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

    // Use the max order number found (not count) to avoid duplicates after deletions
    const maxOrderNum = deserialized.reduce((max, t) => Math.max(max, t.orderNumber), 0);
    orderCounterRef.current = maxOrderNum;
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
            onActiveTabRemoteUpdateRef.current(deserializeTab(record, 0));
          }
          continue;
        }

        // Inactive tab or new tab from another device
        versionsRef.current.set(record.id, record.version);
        next.set(record.id, deserializeTab(record, 0));
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
          next.set(record.id, deserializeTab(record, 0));
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

  const persistTab = useCallback((tab: TabContext, opts?: { broadcast?: boolean }) => {
    if (!sessionId) return;
    const body = { ...serializeTab(tab), ...(opts?.broadcast ? { broadcast: true } : {}), deviceId: getPosDeviceId() };
    fetch(`/api/pos/open-orders/${tab.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result?.version != null) {
          versionsRef.current.set(tab.id, result.version);
          onVersionUpdateRef.current?.(tab.id, result.version);
        }
        // Adopt server-assigned order number if local tab has a provisional one
        if (result?.orderNumber && result.orderNumber > 0) {
          const serverNum = result.orderNumber as number;
          // Update active tab
          if (tab.id === activeTabIdRef.current) {
            setActiveTabOrderNumber((prev) => {
              if (prev !== serverNum) {
                // Also update the label to reflect the server number
                setActiveTabLabel((lbl) => lbl.replace(/#\d+/, `#${serverNum}`));
                return serverNum;
              }
              return prev;
            });
          } else {
            // Update inactive tab
            setTabs((prev) => {
              const existing = prev.get(tab.id);
              if (existing && existing.orderNumber !== serverNum) {
                const next = new Map(prev);
                next.set(tab.id, {
                  ...existing,
                  orderNumber: serverNum,
                  label: existing.label.replace(/#\d+/, `#${serverNum}`),
                });
                return next;
              }
              return prev;
            });
          }
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
    (initialOverrides?: Partial<TabContext>): { id: string; label: string; orderNumber: number } => {
      orderCounterRef.current += 1;
      const id = generateId();
      const orderNumber = orderCounterRef.current;
      const label = initialOverrides?.label ?? `#${orderNumber}`;
      return { id, label, orderNumber };
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
        setActiveTabOrderNumber(target.orderNumber);
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

      const { id, label, orderNumber } = newTab(overrides);
      const freshTab = makeDefaultTab(id, label, orderNumber);
      const merged = { ...freshTab, ...overrides, id, label, orderNumber };

      setTabs((prev) => {
        const next = new Map(prev);
        next.set(currentSnapshot.id, currentSnapshot);
        return next;
      });

      setActiveTabId(id);
      setActiveTabLabel(label);
      setActiveTabOrderNumber(orderNumber);
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
        setActiveTabLabel(`#${orderCounterRef.current}`);
        setActiveTabOrderNumber(orderCounterRef.current);
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
        setActiveTabOrderNumber(newest.orderNumber);
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
      setActiveTabOrderNumber(parseOrderNumber(label) || orderCounterRef.current);
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
    setActiveTabLabel("#1");
    setActiveTabOrderNumber(1);
    setActiveTabCreatedAt(Date.now());
  }, []);

  return {
    tabs,
    activeTabId,
    activeTabLabel,
    activeTabOrderNumber,
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
