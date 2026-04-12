"use client";

import { useEffect } from "react";
import type Ably from "ably";

interface UseRealtimeTablesOptions {
  organizationId?: string | null;
  onTableStatusChanged?: (payload: { tableId: string; status: string; orderId?: string | null }) => void;
}

/**
 * Subscribe to real-time table status changes via Ably and/or Socket.IO.
 * Both transports are checked — on VPS both may be active simultaneously.
 */
export function useRealtimeTables(
  enabled: boolean,
  options: UseRealtimeTablesOptions = {},
) {
  const { organizationId, onTableStatusChanged } = options;

  // Ably subscription for table events
  useEffect(() => {
    if (!enabled || !organizationId || !onTableStatusChanged) return;

    let channel: Ably.RealtimeChannel | null = null;
    let cleanup: (() => void) | null = null;

    import("@/lib/pos/ably-client").then(({ getAblyClient }) => {
      const ably = getAblyClient();
      channel = ably.channels.get(`pos:${organizationId}`);
      const handler = (message: Ably.Message) => {
        if (message.name === "table:statusChanged" && message.data) {
          onTableStatusChanged(message.data as { tableId: string; status: string; orderId?: string | null });
        }
      };
      channel.subscribe("table:statusChanged", handler);
      cleanup = () => {
        channel?.unsubscribe("table:statusChanged", handler);
      };
    }).catch(() => {});

    return () => { cleanup?.(); };
  }, [enabled, organizationId, onTableStatusChanged]);

  // Socket.IO subscription for table events (VPS only)
  useEffect(() => {
    if (!enabled || !organizationId || !onTableStatusChanged) return;
    if (!process.env.NEXT_PUBLIC_SOCKET_URL) return;

    let socket: import("socket.io-client").Socket | null = null;
    let cleanup: (() => void) | null = null;

    import("@/lib/pos/socket-client").then(({ getPosSocket }) => {
      socket = getPosSocket();
      const handler = (payload: { tableId: string; status: string; orderId?: string | null }) => {
        onTableStatusChanged(payload);
      };
      socket.on("table:statusChanged" as any, handler);
      cleanup = () => {
        socket?.off("table:statusChanged" as any, handler);
      };
    }).catch(() => {});

    return () => { cleanup?.(); };
  }, [enabled, organizationId, onTableStatusChanged]);
}
