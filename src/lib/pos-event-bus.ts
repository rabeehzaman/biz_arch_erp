/**
 * In-process SSE event bus for POS real-time sync across local-network devices.
 * Uses globalThis to survive HMR in dev and persist across requests in `next start`.
 */

type Listener = (event: string) => void;

interface POSEventBus {
  /** orgId → Set of SSE listener callbacks */
  listeners: Map<string, Set<Listener>>;
  subscribe(orgId: string, listener: Listener): () => void;
  emit(orgId: string, event: string): void;
}

function createEventBus(): POSEventBus {
  const listeners = new Map<string, Set<Listener>>();

  return {
    listeners,
    subscribe(orgId, listener) {
      if (!listeners.has(orgId)) listeners.set(orgId, new Set());
      listeners.get(orgId)!.add(listener);
      return () => {
        listeners.get(orgId)?.delete(listener);
        if (listeners.get(orgId)?.size === 0) listeners.delete(orgId);
      };
    },
    emit(orgId, event) {
      const orgListeners = listeners.get(orgId);
      if (!orgListeners) return;
      for (const listener of orgListeners) {
        try { listener(event); } catch {}
      }
    },
  };
}

const globalForBus = globalThis as unknown as { posEventBus: POSEventBus | undefined };
export const posEventBus = globalForBus.posEventBus ?? createEventBus();
globalForBus.posEventBus = posEventBus;
