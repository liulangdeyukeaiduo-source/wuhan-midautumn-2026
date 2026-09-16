// V9: cloud synchronization is the source of truth. Disable the old offline cache layer
// so previously used Safari browsers cannot remain pinned to stale local-only scripts.
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});

// Intentionally no fetch handler: all requests go directly to the network.
