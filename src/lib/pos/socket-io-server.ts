/**
 * Server-side accessor for the Socket.IO instance.
 * Same globalThis pattern as pos-event-bus.ts.
 *
 * API routes that need to broadcast (e.g., checkout deleting an order)
 * call getIO() to emit to the appropriate Socket.IO room.
 */
import type { Namespace } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./realtime-types";

type POSNamespace = Namespace<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const g = globalThis as unknown as { __posSocketIO?: POSNamespace };

export function getIO(): POSNamespace | null {
  return g.__posSocketIO ?? null;
}

export function setIO(io: POSNamespace): void {
  g.__posSocketIO = io;
}
