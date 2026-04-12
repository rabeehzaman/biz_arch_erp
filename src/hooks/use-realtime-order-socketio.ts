"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPosSocket, getPosDeviceId } from "@/lib/pos/socket-client";
import type { SerializedOrderState, OrderOperation } from "@/lib/pos/realtime-types";
import type { CartItemData } from "@/components/pos/cart-item";
import type { Socket } from "socket.io-client";

interface UseRealtimeOrderSocketIOOptions {
  organizationId?: string | null;
  onRemoteUpdate?: (items: CartItemData[], version: number, state: SerializedOrderState) => void;
  onRemoteDelete?: () => void;
}

interface UseRealtimeOrderSocketIOReturn {
  isConnected: boolean;
  /** Emit a mutation directly via Socket.IO for instant broadcast */
  emitMutation: (orderId: string, ops: OrderOperation[]) => Promise<{
    ok: boolean;
    version: number;
    state?: SerializedOrderState;
  }>;
  /** Sync version after HTTP persistTab bumps the DB version */
  updateVersion: (v: number) => void;
}

export function useRealtimeOrderSocketIO(
  orderId: string | null,
  options: UseRealtimeOrderSocketIOOptions = {},
): UseRealtimeOrderSocketIOReturn {
  const [isConnected, setIsConnected] = useState(false);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;

  const onRemoteUpdateRef = useRef(options.onRemoteUpdate);
  onRemoteUpdateRef.current = options.onRemoteUpdate;
  const onRemoteDeleteRef = useRef(options.onRemoteDelete);
  onRemoteDeleteRef.current = options.onRemoteDelete;

  const socketRef = useRef<Socket | null>(null);
  const versionRef = useRef(0);

  // ── Socket.IO subscription ─────────────────────────────────────
  useEffect(() => {
    if (!orderId) {
      setIsConnected(false);
      versionRef.current = 0;
      return;
    }

    let socket: Socket;
    try {
      socket = getPosSocket();
    } catch {
      return;
    }
    socketRef.current = socket;

    const deviceId = getPosDeviceId();

    function joinRoom(oid: string) {
      socket.emit("order:join", oid, (_state: any, version: number) => {
        versionRef.current = version || 0;
      });
    }

    function onConnect() {
      setIsConnected(true);
      // Rejoin room on reconnect
      if (orderIdRef.current) {
        joinRoom(orderIdRef.current);
      }
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onOrderUpdated(payload: {
      orderId: string;
      ops: OrderOperation[];
      version: number;
      deviceId: string;
      state?: SerializedOrderState;
    }) {
      // Filter self-messages
      if (payload.deviceId === deviceId) return;
      // Only handle updates for our order
      if (payload.orderId !== orderIdRef.current) return;

      // Track server version for optimistic locking
      if (payload.version) versionRef.current = payload.version;

      if (payload.state && onRemoteUpdateRef.current) {
        onRemoteUpdateRef.current(payload.state.items, payload.version, payload.state);
      }
    }

    function onOrderDeleted(payload: { orderId: string; deviceId: string }) {
      if (payload.deviceId === deviceId) return;
      if (payload.orderId !== orderIdRef.current) return;
      onRemoteDeleteRef.current?.();
    }

    function onOrderFullState(payload: {
      orderId: string;
      state: SerializedOrderState;
      version: number;
    }) {
      if (payload.orderId !== orderIdRef.current) return;
      if (onRemoteUpdateRef.current) {
        onRemoteUpdateRef.current(payload.state.items, payload.version, payload.state);
      }
    }

    // Join the order room and capture server version
    joinRoom(orderId);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("order:updated", onOrderUpdated);
    socket.on("order:deleted", onOrderDeleted);
    socket.on("order:fullState", onOrderFullState);

    setIsConnected(socket.connected);

    return () => {
      socket.emit("order:leave", orderId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("order:updated", onOrderUpdated);
      socket.off("order:deleted", onOrderDeleted);
      socket.off("order:fullState", onOrderFullState);
    };
  }, [orderId]);

  // Allow external version sync (e.g. after HTTP persistTab bumps the version)
  const updateVersion = useCallback((v: number) => {
    versionRef.current = v;
  }, []);

  // ── Emit mutation for instant cart sync (auto-retries on version conflict) ──
  const emitMutation = useCallback(
    (targetOrderId: string, ops: OrderOperation[]) => {
      return new Promise<{ ok: boolean; version: number; state?: SerializedOrderState }>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ ok: false, version: versionRef.current });
          return;
        }

        function attempt(expectedVersion: number, isRetry: boolean) {
          socket!.emit(
            "order:mutate",
            { orderId: targetOrderId, ops, expectedVersion },
            (result: any) => {
              if (result.ok) {
                versionRef.current = result.version;
                resolve({ ok: true, version: result.version });
              } else if (result.reason === "VERSION_CONFLICT" && !isRetry) {
                // Retry once with the server's current version
                versionRef.current = result.currentVersion;
                attempt(result.currentVersion, true);
              } else if (result.reason === "VERSION_CONFLICT") {
                versionRef.current = result.currentVersion;
                resolve({ ok: false, version: result.currentVersion, state: result.currentState });
              } else {
                resolve({ ok: false, version: versionRef.current });
              }
            },
          );
        }

        attempt(versionRef.current, false);
      });
    },
    [],
  );

  return { isConnected, emitMutation, updateVersion };
}
