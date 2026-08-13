// Bump this whenever site files change meaningfully, so returning visitors
// pick up the update instead of staying stuck on old cached assets.
const CACHE_VERSION = "wandlr-v1";

// Only the small, always-needed core shell is pre-cached on install. Heavier,
// lazily-loaded files (the PDF and HEIC engines under /vendor/) are cached on
// first actual use instead, via the fetch handler below — no point making
// every visitor download several extra megabytes up front.
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/main.js",
  "/heic-decoder.js",
  "/icon.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    // HTML shell: prefer the network so updates show up immediately, fall
    // back to the cached shell only when actually offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Everything else (CSS/JS/vendor libraries/icon): serve from cache when
  // available, otherwise fetch and store a copy for next time (this is how
  // the lazily-loaded PDF/HEIC engines become available offline after their
  // first real use).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
