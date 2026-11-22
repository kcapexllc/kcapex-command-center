// Offline cache for the app shell. Bump VERSION when you change files.
// Speed: the app opens instantly from this cache, and each file is refreshed in the background for next time.
// The page itself (index.html) tries the network for up to 1.2 s first, so sign-in and new versions still show up.
const VERSION = 'kcapex-cc-v27';
const ASSETS = ['./', './index.html', './claude-shim.js', './app.js', './styles.css', './manifest.webmanifest',
  './icons/kc-logo-192.png', './icons/kc-logo-512.png', './icons/kc-apple-touch-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(ASSETS.map((a) => fetch(new Request(a, { cache: 'reload', credentials: 'same-origin' })).then((r) => r.ok && !r.redirected ? c.put(a, r) : null).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const save = (req, res) => { if (res && res.ok && !res.redirected && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; };
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/__')) return;
  if (e.request.mode === 'navigate') {
    // After a sign-out the app reloads with ?fresh=… : always go to the network then.
    if (url.searchParams.has('fresh')) return;
    const net = fetch(e.request).then((r) => save(new Request('./index.html'), r));
    e.respondWith(Promise.race([net, new Promise((res) => setTimeout(res, 1200))])
      .then((r) => r || caches.match('./index.html').then((c) => c || net))
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Files: answer from the cache right away, refresh it in the background.
  e.respondWith(caches.match(e.request).then((cached) => {
    const net = fetch(e.request).then((r) => save(e.request, r)).catch(() => cached);
    if (cached) { e.waitUntil(net); return cached; }
    return net;
  }));
});
