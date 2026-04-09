"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAblyClient, getPosDeviceId } from "@/lib/pos/ably-client";
import { applyOperations } from "@/lib/pos/apply-operations";
import type {
  OrderOperation,
  SerializedOrderState,
  MutationResult,
} from "@/lib/pos/realtime-types";
import type Ably from "ably";

interface UseRealtimeOrderOptions {
  /** Organization ID for channel scoping */
  organizationId?: string | null;
  /** Called when another device sends operations to this order */
  onRemoteOps?: (ops: OrderOperation[], newVersion: number, newState: SerializedOrderState) => void;
  /** Called on version conflict — server state is authoritative */
  onConflict?: (serverState: SerializedOrderState, serverVersion: number) => void;
  /** Called when the order is deleted by another device */
  onRemoteDelete?: () => void;
  /** Current local state for applying remote ops (kept as ref) */
  currentState?: SerializedOrderState | null;
}

interface UseRealtimeOrderReturn {
  /** Send operations to the server. Returns the mutation result. */
  sendOps: (ops: OrderOperation[]) => Promise<MutationResult>;
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

  // Keep callbacks as refs to avoid re-subscribing on every render
  const onRemoteOpsRef = useRef(options.onRemoteOps);
  onRemoteOpsRef.current = options.onRemoteOps;
  const onConflictRef = useRef(options.onConflict);
  onConflictRef.current = options.onConflict;
  const onRemoteDeleteRef = useRef(options.onRemoteDelete);
  onRemoteDeleteRef.current = options.onRemoteDelete;
  const currentStateRef = useRef(options.currentState);
  currentStateRef.current = options.currentState;
  const orgIdRef = useRef(options.organizationId);
  orgIdRef.current = options.organizationId;

  // Queue to serialize sendOps — prevents version conflicts from rapid additions
  const queueRef = useRef<Promise<MutationResult>>(Promise.resolve({ ok: true, version: 0 }));

  const setVersion = useCallback((v: number) => {
    versionRef.current = v;
    setVersionState(v);
  }, []);

  // ── Ably subscription: subscribe to per-order channel ─────────────
  useEffect(() => {
    if (!orderId || !orgIdRef.current) return;

    const orgId = orgIdRef.current;
    const channelName = `pos:${orgId}:${orderId}`;
    let channel: Ably.RealtimeChannel | null = null;
    let ably: Ably.Realtime | null = null;

    try {
      ably = getAblyClient();
    } catch {
      // Ably not available — fall back to polling only
      return;
    }

    channel = ably.channels.get(channelName);
    const deviceId = getPosDeviceId();

    function onConnectionStateChange(stateChange: Ably.ConnectionStateChange) {
      setIsConnected(stateChange.current === "connected");
    }

    // Subscribe to order updates
    function onMessage(message: Ably.Message) {
      const data = message.data as Record<string, unknown>;
      // Ignore our own messages
      if (data.deviceId === deviceId) return;

      if (message.name === "order:updated") {
        const payload = data as {
          orderId: string;
          ops: OrderOperation[];
          version: number;
          deviceId: string;
        };
        if (payload.version <= versionRef.current) return;

        versionRef.current = payload.version;
        setVersionState(payload.version);

        if (currentStateRef.current && onRemoteOpsRef.current) {
          const newState = applyOperations(currentStateRef.current, payload.ops);
          onRemoteOpsRef.current(payload.ops, payload.version, newState);
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

  // ── Send operations via HTTP (serialized queue) ───────────────────
  // Each sendOps call waits for the previous one to complete so it always
  // has the correct version. On VERSION_CONFLICT, it retries automatically.

  const sendOps = useCallback(
    (ops: OrderOperation[]): Promise<MutationResult> => {
      const task = queueRef.current.then(async (): Promise<MutationResult> => {
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
              }),
            });

            const result: MutationResult = await res.json();

            if (result.ok) {
              versionRef.current = result.version;
              setVersionState(result.version);
              return result;
            }

            if (result.reason === "VERSION_CONFLICT") {
              // Update our version and retry with the new version
              versionRef.current = result.currentVersion;
              setVersionState(result.currentVersion);
              // Don't call onConflict — just retry the ops with the correct version
              continue;
            }

            // Other errors (NOT_FOUND, ERROR) — don't retry
            return result;
          } catch {
            return { ok: false, reason: "ERROR", message: "Network error" };
          }
        }

        // Exhausted retries — fetch current state and report conflict
        return { ok: false, reason: "ERROR", message: "Too many version conflicts" };
      });

      // Chain: next sendOps waits for this one
      queueRef.current = task.catch(() => ({ ok: false, reason: "ERROR" as const }));
      return task;
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
