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

// Handlers removed
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

// Handlers removed
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

httpServer.listen(port, hostname, () => {
  console.log(`> POS server ready on http://${hostname}:${port}`);
  console.log(`> Socket.IO /pos namespace active`);
  if (dev) console.log(`> Development mode`);
});
