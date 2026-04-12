import type { CartItemData } from "@/components/pos/cart-item";

// ---------------------------------------------------------------------------
// Cart line key — canonical composite key for matching cart items.
// Mirrors the matching logic in terminal/page.tsx cartReducer ADD case.
// ---------------------------------------------------------------------------

export function cartLineKey(
  productId: string,
  variantId?: string,
  unitId?: string,
): string {
  return [productId, variantId || "", unitId || ""].join("::");
}

export function cartLineKeyFromItem(item: CartItemData): string {
  return cartLineKey(item.productId, item.variantId, item.unitId);
}

// ---------------------------------------------------------------------------
// Serialized order state — the shape stored in DB / sent over the wire.
// ---------------------------------------------------------------------------

export interface SerializedOrderState {
  items: CartItemData[];
  label: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  isReturnMode: boolean;
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
}

// ---------------------------------------------------------------------------
// Operations — discrete mutations instead of full-state replacement.
// ADD_ITEM operations are commutative: two devices adding different items
// to the same order can never conflict.
// ---------------------------------------------------------------------------

export type OrderOperation =
  | { op: "ADD_ITEM"; item: CartItemData; quantity?: number }
  | { op: "REMOVE_ITEM"; lineKey: string }
  | { op: "SET_QUANTITY"; lineKey: string; quantity: number }
  | { op: "CLEAR_ITEMS" }
  | { op: "SET_CUSTOMER"; customerId: string | null; customerName: string | null }
  | {
      op: "SET_TABLE";
      table: {
        id: string;
        number: number;
        name: string;
        section?: string;
        capacity: number;
      } | null;
    }
  | { op: "SET_ORDER_TYPE"; orderType: "DINE_IN" | "TAKEAWAY" }
  | { op: "SET_RETURN_MODE"; isReturnMode: boolean }
  | { op: "SET_LABEL"; label: string }
  | { op: "UPDATE_KOT"; kotSentQuantities: Record<string, number>; kotOrderIds: string[] }
  | { op: "REPLACE_STATE"; state: SerializedOrderState };

// ---------------------------------------------------------------------------
// Socket.IO typed event contracts
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  "order:join": (
    orderId: string,
    ack: (state: SerializedOrderState | null, version: number) => void,
  ) => void;
  "order:leave": (orderId: string) => void;
  "order:mutate": (
    payload: {
      orderId: string;
      ops: OrderOperation[];
      expectedVersion: number;
    },
    ack: (result: MutationResult) => void,
  ) => void;
  "order:create": (
    payload: {
      orderId: string;
      state: SerializedOrderState;
    },
    ack: (result: { ok: boolean; version: number }) => void,
  ) => void;
  "order:delete": (
    orderId: string,
    ack: (result: { ok: boolean }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "order:updated": (payload: {
    orderId: string;
    ops: OrderOperation[];
    version: number;
    deviceId: string;
    state?: SerializedOrderState;
  }) => void;
  "order:deleted": (payload: {
    orderId: string;
    deviceId: string;
  }) => void;
  "order:created": (payload: {
    orderId: string;
    deviceId: string;
  }) => void;
  "order:fullState": (payload: {
    orderId: string;
    state: SerializedOrderState;
    version: number;
  }) => void;
  "table:statusChanged": (payload: {
    tableId: string;
    status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
    orderId?: string | null;
  }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  organizationId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
}

// ---------------------------------------------------------------------------
// Mutation result — returned by the server after applying operations.
// ---------------------------------------------------------------------------

export type MutationResult =
  | { ok: true; version: number }
  | {
      ok: false;
      reason: "VERSION_CONFLICT";
      currentVersion: number;
      currentState: SerializedOrderState;
    }
  | { ok: false; reason: "NOT_FOUND" | "UNAUTHORIZED" | "ERROR"; message?: string };

// ---------------------------------------------------------------------------
// Room name helper
// ---------------------------------------------------------------------------

export function orderRoom(organizationId: string, orderId: string): string {
  return `org:${organizationId}:order:${orderId}`;
}
