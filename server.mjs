/**
 * Custom Node.js server wrapping Next.js.
 *
 * Run with: node server.mjs (production) or via "npm start".
 * Next.js handles all HTTP routes.
 */

import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

httpServer.listen(port, hostname, () => {
  console.log(`> Server ready on http://${hostname}:${port}`);
  if (dev) console.log(`> Development mode`);
});
