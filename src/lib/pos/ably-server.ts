/**
 * Server-side Ably REST client for publishing POS real-time events.
 * Used in API routes to broadcast order changes to connected clients.
 */
import Ably from "ably";
import type { OrderOperation } from "./realtime-types";

let ablyRest: Ably.Rest | null = null;

function getAblyRest(): Ably.Rest | null {
  if (ablyRest) return ablyRest;
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    console.warn("[Ably] ABLY_API_KEY not set — real-time sync disabled");
    return null;
  }
  ablyRest = new Ably.Rest({ key });
  return ablyRest;
}

// Channel names
function orderChannel(orgId: string, orderId: string): string {
  return `pos:${orgId}:${orderId}`;
}

function orgChannel(orgId: string): string {
  return `pos:${orgId}`;
}

// ── Publish helpers ─────────────────────────────────────────────────

export async function publishOrderUpdate(
  orgId: string,
  orderId: string,
  ops: OrderOperation[],
  version: number,
  deviceId: string,
): Promise<void> {
  const client = getAblyRest();
  if (!client) return;

  try {
    const channel = client.channels.get(orderChannel(orgId, orderId));
    await channel.publish("order:updated", {
      orderId,
      ops,
      version,
      deviceId,
    });

    // Also notify org channel for tab-list sync
    const org = client.channels.get(orgChannel(orgId));
    await org.publish("order:updated", { orderId, deviceId });
  } catch (err) {
    console.error("[Ably] Failed to publish order update:", err);
  }
}

export async function publishOrderCreated(
  orgId: string,
  orderId: string,
  deviceId: string,
): Promise<void> {
  const client = getAblyRest();
  if (!client) return;

  try {
    const channel = client.channels.get(orgChannel(orgId));
    await channel.publish("order:created", { orderId, deviceId });
  } catch (err) {
    console.error("[Ably] Failed to publish order created:", err);
  }
}

export async function publishOrderDeleted(
  orgId: string,
  orderId: string,
  deviceId: string,
): Promise<void> {
  const client = getAblyRest();
  if (!client) return;

  try {
    // Notify both the order channel and the org channel
    const orderCh = client.channels.get(orderChannel(orgId, orderId));
    await orderCh.publish("order:deleted", { orderId, deviceId });

    const orgCh = client.channels.get(orgChannel(orgId));
    await orgCh.publish("order:deleted", { orderId, deviceId });
  } catch (err) {
    console.error("[Ably] Failed to publish order deleted:", err);
  }
}

/**
 * Create an Ably token request for client-side auth.
 * Scopes the token to the org's POS channels only.
 */
export async function createTokenRequest(
  orgId: string,
  userId: string,
): Promise<Ably.TokenRequest | null> {
  const client = getAblyRest();
  if (!client) return null;

  try {
    const tokenRequest = await client.auth.createTokenRequest({
      clientId: userId,
      capability: JSON.stringify({
        [`pos:${orgId}:*`]: ["subscribe", "publish"],
        [`pos:${orgId}`]: ["subscribe"],
      }),
    });
    return tokenRequest;
  } catch (err) {
    console.error("[Ably] Failed to create token request:", err);
    throw err;
  }
}
