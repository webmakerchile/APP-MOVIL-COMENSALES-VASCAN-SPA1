const CACHE_NAME = "vascan-v4";
const STATIC_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: network only, no cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ message: "Sin conexión" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  // HTML navigation requests: network first, fall back to cache only when offline
  // This ensures users always get the latest version when online
  const isNavigation =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML — server already says no-store
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached index.html if available
          return caches.match("/index.html").then(
            (cached) =>
              cached ||
              new Response("<h1>Sin conexión</h1>", {
                headers: { "Content-Type": "text/html" },
                status: 503,
              })
          );
        })
    );
    return;
  }

  // Static assets with content-hash in filename (JS, CSS, fonts, images):
  // cache first — these never change once deployed
  const hasContentHash = /\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpg|svg)$/i.test(url.pathname);
  if (hasContentHash) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest, etc.): network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
