"use client";

import Ably from "ably";

let ablyClient: Ably.Realtime | null = null;
let deviceId: string | null = null;

function getDeviceId(): string {
  if (deviceId) return deviceId;
  const stored =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("pos-device-id")
      : null;
  if (stored) {
    deviceId = stored;
    return stored;
  }
  const id = crypto.randomUUID();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("pos-device-id", id);
  }
  deviceId = id;
  return id;
}

export function getAblyClient(): Ably.Realtime {
  if (ablyClient) return ablyClient;

  ablyClient = new Ably.Realtime({
    authUrl: "/api/pos/ably-auth",
    authMethod: "GET",
    autoConnect: true,
    echoMessages: false,  // Don't echo our own messages back
  });

  return ablyClient;
}

export function disconnectAbly(): void {
  if (ablyClient) {
    ablyClient.close();
    ablyClient = null;
  }
}

export function getPosDeviceId(): string {
  return getDeviceId();
}
