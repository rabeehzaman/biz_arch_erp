const CACHE_VERSION = "bizarch-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_PATTERNS = [/\/_next\/static\//, /\/fonts\//, /\.(png|jpg|jpeg|svg|ico|webp)$/];
const API_PATTERN = /\/api\//;

const MAX_STATIC_ENTRIES = 100;
const MAX_API_ENTRIES = 50;
const API_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Trim a cache to a max number of entries (oldest first)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
  }
}

// Delete API cache entries older than API_MAX_AGE_MS
async function purgeExpiredApiEntries() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();
  const now = Date.now();
  await Promise.all(
    keys.map(async (request) => {
      const response = await cache.match(request);
      if (!response) return;
      const dateHeader = response.headers.get("date");
      if (dateHeader && now - new Date(dateHeader).getTime() > API_MAX_AGE_MS) {
        await cache.delete(request);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(["/offline.html"]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean old cache versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      ),
      // Purge expired API entries
      purgeExpiredApiEntries(),
    ])
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first for static assets
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, clone);
                trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES);
              });
            }
            return response;
          })
      )
    );
    return;
  }

  // Network-first for API GET requests
  if (API_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(API_CACHE, MAX_API_ENTRIES);
            });
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  // Network-first for navigation
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((cached) => cached || new Response("Offline", { status: 503 })))
    );
  }
});
