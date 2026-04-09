"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAblyClient, getPosDeviceId } from "@/lib/pos/ably-client";
import type { SerializedOrderState } from "@/lib/pos/realtime-types";
import type { CartItemData } from "@/components/pos/cart-item";
import type Ably from "ably";

interface UseRealtimeOrderOptions {
  /** Organization ID for channel scoping */
  organizationId?: string | null;
  /** Called when another device updates this order — provides server snapshot for metadata sync */
  onRemoteUpdate?: (items: CartItemData[], version: number, state: SerializedOrderState) => void;
  /** Called when the order is deleted by another device */
  onRemoteDelete?: () => void;
}

interface UseRealtimeOrderReturn {
  /** Whether Ably is connected */
  isConnected: boolean;
}

export function useRealtimeOrder(
  orderId: string | null,
  options: UseRealtimeOrderOptions = {},
): UseRealtimeOrderReturn {
  const [isConnected, setIsConnected] = useState(false);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;

  const onRemoteUpdateRef = useRef(options.onRemoteUpdate);
  onRemoteUpdateRef.current = options.onRemoteUpdate;
  const onRemoteDeleteRef = useRef(options.onRemoteDelete);
  onRemoteDeleteRef.current = options.onRemoteDelete;
  const orgIdRef = useRef(options.organizationId);
  orgIdRef.current = options.organizationId;

  // ── Ably subscription: notification-only ─────────────────────────
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

    function onMessage(message: Ably.Message) {
      const data = message.data as Record<string, unknown>;

      // Filter self-messages
      if (data.sourceDeviceId === deviceId || data.deviceId === deviceId) return;

      if (message.name === "order:updated") {
        const payload = data as {
          items?: CartItemData[];
          version: number;
          sourceDeviceId: string;
        };

        if (payload.items && onRemoteUpdateRef.current) {
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

  return { isConnected };
}
