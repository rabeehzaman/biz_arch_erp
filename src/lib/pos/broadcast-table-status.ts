/**
 * Broadcast table status changes via both Ably and Socket.IO.
 *
 * On VPS: both transports may have connected clients.
 * On Vercel: only Ably is available (getIO() returns null).
 */
import Ably from "ably";
import { getIO } from "./socket-io-server";

let ablyRest: Ably.Rest | null = null;

function getAblyRest(): Ably.Rest | null {
  if (ablyRest) return ablyRest;
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  ablyRest = new Ably.Rest({ key });
  return ablyRest;
}

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";

export async function broadcastTableStatus(
  orgId: string,
  tableId: string,
  status: TableStatus,
  orderId?: string | null,
): Promise<void> {
  const payload = { tableId, status, orderId: orderId ?? null };

  // 1. Ably — always available on both Vercel and VPS
  const ably = getAblyRest();
  if (ably) {
    try {
      const channel = ably.channels.get(`pos:${orgId}`);
      await channel.publish("table:statusChanged", payload);
    } catch (err) {
      console.error("[broadcastTableStatus] Ably publish failed:", err);
    }
  }

  // 2. Socket.IO — only available on VPS where server.mjs runs
  const io = getIO();
  if (io) {
    try {
      io.to(`org:${orgId}`).emit("table:statusChanged", payload);
    } catch (err) {
      console.error("[broadcastTableStatus] Socket.IO emit failed:", err);
    }
  }
}
