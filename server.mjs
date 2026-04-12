/**
 * Custom Node.js server wrapping Next.js + Socket.IO.
 *
 * Provides real-time POS sync via WebSocket rooms on the local network.
 * Run with: node server.mjs (production) or via "npm start".
 *
 * Next.js handles all HTTP routes. Socket.IO handles WebSocket connections
 * on the /pos namespace for order-level collaboration.
 */

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server } from "socket.io";
import { decode } from "next-auth/jwt";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key.trim()] = decodeURIComponent(rest.join("="));
  }
  return cookies;
}

function orderRoom(orgId, orderId) {
  return `org:${orgId}:order:${orderId}`;
}

function orgRoom(orgId) {
  return `org:${orgId}`;
}

// ---------------------------------------------------------------------------
// Dynamically import Prisma + apply-operations at runtime (they use @/ paths
// resolved by Next.js, so we import the compiled versions).
// ---------------------------------------------------------------------------

let prisma;
let applyOperations;
let dbRecordToState;

async function loadModules() {
  // Prisma 7 generates .ts files — Node.js 24 handles them with --experimental-strip-types
  const { PrismaClient } = await import("./src/generated/prisma/client.ts");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const pg = await import("pg");

  // Use DIRECT_URL (no PgBouncer) for the long-running server process.
  // Pass explicit pg.Pool so PrismaPg reads credentials from the connection string.
  const pool = new pg.default.Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

// Inline the core apply-operations logic to avoid @/ import issues in .mjs
// This must stay in sync with src/lib/pos/apply-operations.ts

function cartLineKeyFromItem(item) {
  return [item.productId, item.variantId || "", item.unitId || ""].join("::");
}

function applyOps(state, ops) {
  let result = { ...state };
  for (const op of ops) {
    result = applyOneOp(result, op);
  }
  return result;
}

function applyOneOp(state, op) {
  switch (op.op) {
    case "ADD_ITEM": {
      const lineKey = cartLineKeyFromItem(op.item);
      const items = [...state.items];
      const idx = items.findIndex((it) => cartLineKeyFromItem(it) === lineKey);
      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: items[idx].quantity + (op.quantity ?? 1) };
      } else {
        items.push({ ...op.item, quantity: op.quantity ?? op.item.quantity });
      }
      return { ...state, items };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((it) => cartLineKeyFromItem(it) !== op.lineKey) };
    case "SET_QUANTITY": {
      const items = state.items
        .map((it) => cartLineKeyFromItem(it) === op.lineKey ? { ...it, quantity: op.quantity } : it)
        .filter((it) => it.quantity > 0);
      return { ...state, items };
    }
    case "CLEAR_ITEMS":
      return { ...state, items: [] };
    case "SET_CUSTOMER":
      return { ...state, customerId: op.customerId, customerName: op.customerName };
    case "SET_TABLE":
      if (op.table) {
        return { ...state, tableId: op.table.id, tableNumber: op.table.number, tableName: op.table.name, tableSection: op.table.section ?? null, tableCapacity: op.table.capacity };
      }
      return { ...state, tableId: null, tableNumber: null, tableName: null, tableSection: null, tableCapacity: null };
    case "SET_ORDER_TYPE":
      return { ...state, orderType: op.orderType };
    case "SET_RETURN_MODE":
      return { ...state, isReturnMode: op.isReturnMode };
    case "SET_LABEL":
      return { ...state, label: op.label };
    case "UPDATE_KOT":
      return { ...state, kotSentQuantities: op.kotSentQuantities, kotOrderIds: op.kotOrderIds };
    case "REPLACE_STATE":
      return { ...op.state };
    default:
      return state;
  }
}

function recordToState(record) {
  return {
    items: Array.isArray(record.items) ? record.items : [],
    label: record.label,
    orderType: record.orderType,
    isReturnMode: record.isReturnMode,
    customerId: record.customerId,
    customerName: record.customerName,
    tableId: record.tableId,
    tableNumber: record.tableNumber,
    tableName: record.tableName,
    tableSection: record.tableSection,
    tableCapacity: record.tableCapacity,
    heldOrderId: record.heldOrderId,
    kotSentQuantities: record.kotSentQuantities ?? {},
    kotOrderIds: Array.isArray(record.kotOrderIds) ? record.kotOrderIds : [],
    preBillPrinted: record.preBillPrinted ?? false,
  };
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// app.prepare() loads .env files — must run before loadModules() reads DIRECT_URL
await app.prepare();
await loadModules();

const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

// ---------------------------------------------------------------------------
// Socket.IO setup
// ---------------------------------------------------------------------------

const io = new Server(httpServer, {
  // Allow all origins on LAN — POS devices may connect from different IPs
  cors: { origin: "*", credentials: true },
  // Ping interval / timeout tuned for LAN reliability
  pingInterval: 10000,
  pingTimeout: 5000,
  // Max payload 1MB (large orders with many items)
  maxHttpBufferSize: 1e6,
});

const posNamespace = io.of("/pos");

// Store on globalThis so API routes can broadcast via getIO()
globalThis.__posSocketIO = posNamespace;

// ── Authentication middleware ──────────────────────────────────────────────

posNamespace.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);

    // Next-Auth v5 stores the JWT in authjs.session-token (HTTP) or
    // __Secure-authjs.session-token (HTTPS). Salt must match the cookie name.
    const cookieName =
      cookies["__Secure-authjs.session-token"] ? "__Secure-authjs.session-token" :
      cookies["authjs.session-token"] ? "authjs.session-token" :
      cookies["__Secure-next-auth.session-token"] ? "__Secure-next-auth.session-token" :
      cookies["next-auth.session-token"] ? "next-auth.session-token" : "";

    const token = cookies[cookieName];

    if (!token) {
      return next(new Error("No session token"));
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return next(new Error("AUTH_SECRET not configured"));
    }

    const decoded = await decode({ token, secret, salt: cookieName });

    if (!decoded?.id || !decoded?.organizationId) {
      return next(new Error("Invalid session"));
    }

    socket.data.userId = decoded.id;
    socket.data.organizationId = decoded.organizationId;
    // deviceId: each browser tab gets a unique ID via the handshake query
    socket.data.deviceId = socket.handshake.query.deviceId || socket.id;

    // Join the org-level room for list-level notifications
    socket.join(orgRoom(decoded.organizationId));

    next();
  } catch (err) {
    console.error("[Socket.IO] Auth error:", err.message);
    next(new Error("Authentication failed"));
  }
});

// ── Event handlers ─────────────────────────────────────────────────────────

posNamespace.on("connection", (socket) => {
  const { organizationId, userId, deviceId } = socket.data;
  console.log(`[Socket.IO] Connected: user=${userId} device=${deviceId} org=${organizationId}`);

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Disconnected: device=${deviceId}`);
  });

  // -- Join an order's room (get current state back) --
  socket.on("order:join", async (orderId, ack) => {
    try {
      const room = orderRoom(organizationId, orderId);
      socket.join(room);

      const record = await prisma.pOSOpenOrder.findFirst({
        where: { id: orderId, organizationId },
      });

      if (record) {
        console.log(`[Socket.IO] order:join ${orderId} → found, version=${record.version}, items=${Array.isArray(record.items) ? record.items.length : 0}`);
        ack(recordToState(record), record.version);
      } else {
        console.log(`[Socket.IO] order:join ${orderId} → NOT FOUND`);
        ack(null, 0);
      }
    } catch (err) {
      console.error("[Socket.IO] order:join error:", err);
      ack(null, 0);
    }
  });

  // -- Leave an order's room --
  socket.on("order:leave", (orderId) => {
    socket.leave(orderRoom(organizationId, orderId));
  });

  // -- Apply operations to an order --
  socket.on("order:mutate", async (payload, ack) => {
    const { orderId, ops, expectedVersion } = payload;

    try {
      const record = await prisma.pOSOpenOrder.findFirst({
        where: { id: orderId, organizationId },
      });

      if (!record) {
        console.log(`[Socket.IO] order:mutate ${orderId} → NOT_FOUND`);
        return ack({ ok: false, reason: "NOT_FOUND" });
      }

      // Optimistic lock check
      if (record.version !== expectedVersion) {
        console.log(`[Socket.IO] order:mutate ${orderId} → VERSION_CONFLICT expected=${expectedVersion} actual=${record.version}`);
        return ack({
          ok: false,
          reason: "VERSION_CONFLICT",
          currentVersion: record.version,
          currentState: recordToState(record),
        });
      }

      // Apply operations
      const currentState = recordToState(record);
      const newState = applyOps(currentState, ops);
      const newVersion = record.version + 1;

      // Write back with version guard (prevents concurrent writers)
      try {
        await prisma.pOSOpenOrder.update({
          where: { id: orderId },
          data: {
            items: newState.items,
            label: newState.label,
            orderType: newState.orderType,
            isReturnMode: newState.isReturnMode,
            customerId: newState.customerId,
            customerName: newState.customerName,
            tableId: newState.tableId,
            tableNumber: newState.tableNumber,
            tableName: newState.tableName,
            tableSection: newState.tableSection,
            tableCapacity: newState.tableCapacity,
            heldOrderId: newState.heldOrderId,
            kotSentQuantities: newState.kotSentQuantities,
            kotOrderIds: newState.kotOrderIds,
            deviceId,
            version: newVersion,
          },
        });
      } catch (err) {
        // P2025 = record not found (someone deleted it between read and write)
        if (err?.code === "P2025") {
          return ack({ ok: false, reason: "NOT_FOUND" });
        }
        throw err;
      }

      console.log(`[Socket.IO] order:mutate ${orderId} → OK version=${newVersion} items=${newState.items.length} ops=${ops.map(o=>o.op).join(",")}`);

      // Broadcast to other devices in the room (not the sender)
      // Include full state so clients can use it directly (same shape as Ably)
      const room = orderRoom(organizationId, orderId);
      socket.to(room).emit("order:updated", {
        orderId,
        ops,
        version: newVersion,
        deviceId,
        state: newState,
      });

      // Also notify org room for tab-list sync (includes full state for direct updates)
      socket.to(orgRoom(organizationId)).emit("order:updated", {
        orderId,
        ops,
        version: newVersion,
        deviceId,
        state: newState,
      });

      ack({ ok: true, version: newVersion });
    } catch (err) {
      console.error("[Socket.IO] order:mutate error:", err);
      ack({ ok: false, reason: "ERROR", message: "Internal server error" });
    }
  });

  // -- Create a new order --
  socket.on("order:create", async (payload, ack) => {
    const { orderId, state } = payload;

    try {
      // Find the user's open POS session
      const posSession = await prisma.pOSSession.findFirst({
        where: { organizationId, userId, status: "OPEN" },
      });

      if (!posSession) {
        return ack({ ok: false, version: 0 });
      }

      await prisma.pOSOpenOrder.upsert({
        where: { id: orderId },
        create: {
          id: orderId,
          organizationId,
          sessionId: posSession.id,
          ...state,
          deviceId,
          version: 0,
        },
        update: {
          ...state,
          deviceId,
          version: { increment: 1 },
        },
      });

      // Notify org room
      socket.to(orgRoom(organizationId)).emit("order:created", {
        orderId,
        deviceId,
      });

      ack({ ok: true, version: 0 });
    } catch (err) {
      console.error("[Socket.IO] order:create error:", err);
      ack({ ok: false, version: 0 });
    }
  });

  // -- Delete an order --
  socket.on("order:delete", async (orderId, ack) => {
    try {
      const record = await prisma.pOSOpenOrder.findFirst({
        where: { id: orderId, organizationId },
      });

      if (record) {
        await prisma.pOSOpenOrder.delete({ where: { id: orderId } });
      }

      // Notify order room and org room
      const room = orderRoom(organizationId, orderId);
      socket.to(room).emit("order:deleted", { orderId, deviceId });
      socket.to(orgRoom(organizationId)).emit("order:deleted", { orderId, deviceId });

      ack({ ok: true });
    } catch (err) {
      console.error("[Socket.IO] order:delete error:", err);
      ack({ ok: false });
    }
  });

  socket.on("disconnect", () => {
    // Socket.IO automatically cleans up room memberships on disconnect
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(port, hostname, () => {
  console.log(`> POS server ready on http://${hostname}:${port}`);
  console.log(`> Socket.IO /pos namespace active`);
  if (dev) console.log(`> Development mode`);
});
