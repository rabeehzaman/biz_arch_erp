"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./realtime-types";

type POSSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: POSSocket | null = null;
let deviceId: string | null = null;

function getDeviceId(): string {
  if (deviceId) return deviceId;
  // Persist per browser tab (sessionStorage) so each tab is a distinct device
  const stored = typeof sessionStorage !== "undefined"
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

export function getPosSocket(): POSSocket {
  if (socket) return socket;

  const url = process.env.NEXT_PUBLIC_SOCKET_URL || "";
  socket = io(`${url}/pos`, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    query: { deviceId: getDeviceId() },
  }) as POSSocket;

  return socket;
}

export function disconnectPosSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getPosDeviceId(): string {
  return getDeviceId();
}
