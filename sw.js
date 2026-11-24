// Network-first for pages, cache-first for built assets; falls back to the cache offline.
// Only same-origin GETs are cached, so food lookups and Gist sync always go straight to the network.
const CACHE = 'daywell-v1.7.5';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png']))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  const assets = new URL(r.url).pathname.includes('/assets/'); // hashed filenames never change
  e.respondWith(
    assets
      ? caches.match(r).then((hit) => hit || fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); return res; }))
      : fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); return res; }).catch(() => caches.match(r).then((hit) => hit || caches.match('./'))),
  );
});
