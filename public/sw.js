const CACHE = "wuhan-midautumn-2026-v6";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./prep-v6.js", "./icons/apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(resp => {
      if (resp && resp.ok) caches.open(CACHE).then(cache => cache.put("./index.html", resp.clone()));
      return resp;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => {
    const network = fetch(event.request).then(resp => {
      if (resp && resp.ok) caches.open(CACHE).then(cache => cache.put(event.request, resp.clone()));
      return resp;
    }).catch(() => cached);
    return cached || network;
  }));
});
