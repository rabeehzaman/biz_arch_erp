"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAblyClient, getPosDeviceId } from "@/lib/pos/ably-client";
import type {
  OrderOperation,
  SerializedOrderState,
  MutationResult,
} from "@/lib/pos/realtime-types";
import type { CartItemData } from "@/components/pos/cart-item";
import type Ably from "ably";

/** Extended result that includes the new items array from the server */
export type MutationResultWithItems = MutationResult & {
  items?: CartItemData[];
  ackClientSeq?: number;
};

interface UseRealtimeOrderOptions {
  /** Organization ID for channel scoping */
  organizationId?: string | null;
  /** Called when another device updates this order — provides server snapshot for rebase */
  onRemoteUpdate?: (items: CartItemData[], version: number, state: SerializedOrderState) => void;
  /** Called when the order is deleted by another device */
  onRemoteDelete?: () => void;
}

interface UseRealtimeOrderReturn {
  /** Send operations to the server. Returns the mutation result with items. */
  sendOps: (ops: OrderOperation[], clientSeq: number) => Promise<MutationResultWithItems>;
  /** Current version known to this hook */
  version: number;
  /** Whether Ably is connected */
  isConnected: boolean;
  /** Update the version (e.g. after a fallback PUT) */
  setVersion: (v: number) => void;
}

export function useRealtimeOrder(
  orderId: string | null,
  options: UseRealtimeOrderOptions = {},
): UseRealtimeOrderReturn {
  const [isConnected, setIsConnected] = useState(false);
  const versionRef = useRef(0);
  const [version, setVersionState] = useState(0);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;

  // Keep callbacks as refs — the Ably callback only calls dispatch (stable)
  const onRemoteUpdateRef = useRef(options.onRemoteUpdate);
  onRemoteUpdateRef.current = options.onRemoteUpdate;
  const onRemoteDeleteRef = useRef(options.onRemoteDelete);
  onRemoteDeleteRef.current = options.onRemoteDelete;
  const orgIdRef = useRef(options.organizationId);
  orgIdRef.current = options.organizationId;

  const setVersion = useCallback((v: number) => {
    versionRef.current = v;
    setVersionState(v);
  }, []);

  // ── Ably subscription: dispatch-only, no state reading ────────────
  useEffect(() => {
    if (!orderId || !orgIdRef.current) return;

    const orgId = orgIdRef.current;
    const channelName = `pos:${orgId}:${orderId}`;
    let channel: Ably.RealtimeChannel | null = null;
    let ably: Ably.Realtime | null = null;

    try {
      ably = getAblyClient();
    } catch {
      return;
    }

    channel = ably.channels.get(channelName);
    const deviceId = getPosDeviceId();

    function onConnectionStateChange(stateChange: Ably.ConnectionStateChange) {
      setIsConnected(stateChange.current === "connected");
    }

    // Dispatch-only message handler — never reads cart state
    function onMessage(message: Ably.Message) {
      const data = message.data as Record<string, unknown>;

      // Filter self-messages using sourceDeviceId (set by ops route)
      if (data.sourceDeviceId === deviceId || data.deviceId === deviceId) return;

      if (message.name === "order:updated") {
        const payload = data as {
          items?: CartItemData[];
          version: number;
          sourceDeviceId: string;
        };
        if (payload.version <= versionRef.current) return;

        versionRef.current = payload.version;
        setVersionState(payload.version);

        // Call onRemoteUpdate with the server's items snapshot
        if (payload.items && onRemoteUpdateRef.current) {
          // Build a minimal SerializedOrderState for metadata updates
          const state: SerializedOrderState = {
            items: payload.items,
            label: (data.label as string) || "",
            orderType: (data.orderType as "DINE_IN" | "TAKEAWAY") || "DINE_IN",
            isReturnMode: (data.isReturnMode as boolean) || false,
            customerId: (data.customerId as string) || null,
            customerName: (data.customerName as string) || null,
            tableId: (data.tableId as string) || null,
            tableNumber: (data.tableNumber as number) || null,
            tableName: (data.tableName as string) || null,
            tableSection: (data.tableSection as string) || null,
            tableCapacity: (data.tableCapacity as number) || null,
            heldOrderId: (data.heldOrderId as string) || null,
            kotSentQuantities: (data.kotSentQuantities as Record<string, number>) || {},
            kotOrderIds: (data.kotOrderIds as string[]) || [],
          };
          onRemoteUpdateRef.current(payload.items, payload.version, state);
        }
      } else if (message.name === "order:deleted") {
        onRemoteDeleteRef.current?.();
      }
    }

    channel.subscribe(onMessage);
    ably.connection.on(onConnectionStateChange);
    setIsConnected(ably.connection.state === "connected");

    return () => {
      channel?.unsubscribe(onMessage);
      ably?.connection.off(onConnectionStateChange);
      channel?.detach().catch(() => {});
    };
  }, [orderId, options.organizationId]);

  // ── Send operations via HTTP ──────────────────────────────────────
  // No queue needed — the pending-ops buffer handles concurrent ops correctly.
  // The rebase pattern means we don't need serialization.

  const sendOps = useCallback(
    async (ops: OrderOperation[], clientSeq: number): Promise<MutationResultWithItems> => {
      const currentOrderId = orderIdRef.current;
      if (!currentOrderId) {
        return { ok: false, reason: "NOT_FOUND", message: "No active order" };
      }

      // Retry up to 3 times on version conflict
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/pos/open-orders/${currentOrderId}/ops`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ops,
              expectedVersion: versionRef.current,
              deviceId: getPosDeviceId(),
              clientSeq,
            }),
          });

          const result = await res.json() as MutationResultWithItems;

          if (result.ok) {
            versionRef.current = result.version;
            setVersionState(result.version);
            return result;
          }

          if (result.reason === "VERSION_CONFLICT") {
            // Update version and retry — pending-ops buffer preserves local state
            versionRef.current = (result as any).currentVersion;
            setVersionState((result as any).currentVersion);
            continue;
          }

          return result;
        } catch {
          return { ok: false, reason: "ERROR", message: "Network error" };
        }
      }

      return { ok: false, reason: "ERROR", message: "Too many version conflicts" };
    },
    [],
  );

  return {
    sendOps,
    version,
    isConnected,
    setVersion,
  };
}
