const CACHE = "wuhan-midautumn-2026-v8";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./prep-v6.js",
  "./sync-v8.js",
  "./responsive-v8.css",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first prevents previously opened Safari tabs from staying on stale UI/sync code.
  event.respondWith(
    fetch(event.request).then(resp => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return resp;
    }).catch(async () => {
      return (await caches.match(event.request)) ||
             (event.request.mode === "navigate" ? await caches.match("./index.html") : Response.error());
    })
  );
});
