// Offline cache for the app shell. Bump VERSION when you change files.
const VERSION = 'kcapex-cc-v8';
const ASSETS = ['./', './index.html', './claude-shim.js', './app.js', './styles.css', './manifest.webmanifest',
  './icons/kc-logo-192.png', './icons/kc-logo-512.png', './icons/kc-apple-touch-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Network first so updates show up; fall back to cache when offline. Data calls (/api/) are never cached here.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
