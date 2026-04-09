import type { CartItemData } from "@/components/pos/cart-item";
import type { OrderOperation, SerializedOrderState } from "./realtime-types";
import { cartLineKeyFromItem } from "./realtime-types";

/**
 * Pure function that applies a list of operations to an order state.
 * Used both server-side (to update DB) and client-side (for optimistic updates).
 *
 * Each operation handler mirrors the existing cartReducer logic in
 * terminal/page.tsx:266-337.
 */
export function applyOperations(
  state: SerializedOrderState,
  ops: OrderOperation[],
): SerializedOrderState {
  let result = { ...state };

  for (const op of ops) {
    result = applyOneOperation(result, op);
  }

  return result;
}

function applyOneOperation(
  state: SerializedOrderState,
  op: OrderOperation,
): SerializedOrderState {
  switch (op.op) {
    case "ADD_ITEM": {
      const lineKey = cartLineKeyFromItem(op.item);
      const items = [...state.items];
      const idx = items.findIndex((it) => cartLineKeyFromItem(it) === lineKey);

      if (idx >= 0) {
        // Increment quantity on existing line (mirrors cartReducer ADD when idx >= 0)
        items[idx] = {
          ...items[idx],
          quantity: items[idx].quantity + (op.quantity ?? 1),
        };
      } else {
        // Append new line with the specified quantity (or 1)
        items.push({
          ...op.item,
          quantity: op.quantity ?? op.item.quantity,
        });
      }

      return { ...state, items };
    }

    case "REMOVE_ITEM": {
      // Remove all lines matching the lineKey (mirrors cartReducer REMOVE)
      const items = state.items.filter(
        (it) => cartLineKeyFromItem(it) !== op.lineKey,
      );
      return { ...state, items };
    }

    case "SET_QUANTITY": {
      const items = state.items.map((it) =>
        cartLineKeyFromItem(it) === op.lineKey
          ? { ...it, quantity: op.quantity }
          : it,
      );
      // Remove item if quantity reaches 0
      return { ...state, items: items.filter((it) => it.quantity > 0) };
    }

    case "CLEAR_ITEMS":
      return { ...state, items: [] };

    case "SET_CUSTOMER":
      return {
        ...state,
        customerId: op.customerId,
        customerName: op.customerName,
      };

    case "SET_TABLE":
      if (op.table) {
        return {
          ...state,
          tableId: op.table.id,
          tableNumber: op.table.number,
          tableName: op.table.name,
          tableSection: op.table.section ?? null,
          tableCapacity: op.table.capacity,
        };
      }
      return {
        ...state,
        tableId: null,
        tableNumber: null,
        tableName: null,
        tableSection: null,
        tableCapacity: null,
      };

    case "SET_ORDER_TYPE":
      return { ...state, orderType: op.orderType };

    case "SET_RETURN_MODE":
      return { ...state, isReturnMode: op.isReturnMode };

    case "SET_LABEL":
      return { ...state, label: op.label };

    case "UPDATE_KOT":
      return {
        ...state,
        kotSentQuantities: op.kotSentQuantities,
        kotOrderIds: op.kotOrderIds,
      };

    case "REPLACE_STATE":
      return { ...op.state };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Conflict detection: checks if incoming operation conflicts with missed ops.
// ADD_ITEM is always safe (commutative). Other item-level ops conflict only
// if they target the same lineKey as a missed operation.
// ---------------------------------------------------------------------------

export function hasConflict(
  incoming: OrderOperation,
  missed: { type: string; payload: Record<string, unknown> }[],
): boolean {
  // ADD_ITEM never conflicts — two adds are commutative
  if (incoming.op === "ADD_ITEM") return false;

  // Metadata ops don't conflict with item ops, but do conflict with same-type metadata
  const metadataOps = new Set([
    "SET_CUSTOMER",
    "SET_TABLE",
    "SET_ORDER_TYPE",
    "SET_RETURN_MODE",
    "SET_LABEL",
  ]);
  if (metadataOps.has(incoming.op)) {
    return missed.some((m) => m.type === incoming.op);
  }

  // Item-level ops: conflict if same lineKey was touched
  if ("lineKey" in incoming) {
    return missed.some(
      (m) =>
        (m.payload as { lineKey?: string })?.lineKey === incoming.lineKey,
    );
  }

  // CLEAR_ITEMS conflicts with any item-level missed op
  if (incoming.op === "CLEAR_ITEMS") {
    const itemOps = new Set(["ADD_ITEM", "REMOVE_ITEM", "SET_QUANTITY", "CLEAR_ITEMS"]);
    return missed.some((m) => itemOps.has(m.type));
  }

  // UPDATE_KOT conflicts with other KOT updates
  if (incoming.op === "UPDATE_KOT") {
    return missed.some((m) => m.type === "UPDATE_KOT");
  }

  return false;
}

/**
 * Serialize a DB record (POSOpenOrder) into the wire format.
 */
export function dbRecordToState(record: {
  label: string;
  orderType: string;
  isReturnMode: boolean;
  items: unknown;
  customerId: string | null;
  customerName: string | null;
  tableId: string | null;
  tableNumber: number | null;
  tableName: string | null;
  tableSection: string | null;
  tableCapacity: number | null;
  heldOrderId: string | null;
  kotSentQuantities: unknown;
  kotOrderIds: unknown;
}): SerializedOrderState {
  return {
    items: (Array.isArray(record.items) ? record.items : []) as CartItemData[],
    label: record.label,
    orderType: record.orderType as "DINE_IN" | "TAKEAWAY",
    isReturnMode: record.isReturnMode,
    customerId: record.customerId,
    customerName: record.customerName,
    tableId: record.tableId,
    tableNumber: record.tableNumber,
    tableName: record.tableName,
    tableSection: record.tableSection,
    tableCapacity: record.tableCapacity,
    heldOrderId: record.heldOrderId,
    kotSentQuantities:
      (record.kotSentQuantities as Record<string, number>) ?? {},
    kotOrderIds: (Array.isArray(record.kotOrderIds) ? record.kotOrderIds : []) as string[],
  };
}
