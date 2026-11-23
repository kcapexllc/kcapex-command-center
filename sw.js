// Offline cache for the app shell. Bump VERSION when you change files.
// Speed: the app opens instantly from this cache, and each file is refreshed in the background for next time.
// The page itself opens from the cache too; new versions arrive in the background and the app offers a Refresh.
const VERSION = 'kcapex-cc-v37';
const ASSETS = ['./', './index.html', './claude-shim.js', './app.js', './styles.css', './manifest.webmanifest',
  './icons/kc-logo-192.png', './icons/kc-logo-512.png', './icons/kc-apple-touch-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(ASSETS.map((a) => fetch(new Request(a, { cache: 'reload', credentials: 'same-origin' })).then((r) => r.ok && !r.redirected ? c.put(a, r) : null).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'kc-fonts').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const save = (req, res) => { if (res && res.ok && !res.redirected && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; };
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Google Fonts: keep a copy so the app's font is there instantly and offline.
  if (e.request.method === 'GET' && (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com')) {
    e.respondWith(caches.open('kc-fonts').then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/__')) return;
  if (e.request.mode === 'navigate') {
    // After a sign-out the app reloads with ?fresh=… : always go to the network then.
    if (url.searchParams.has('fresh')) return;
    // Open instantly from the saved copy and refresh it in the background. If you're signed out, the app's first
    // data request fails and it reloads with ?fresh, which goes to the network and shows the sign-in page.
    const net = fetch(e.request).then((r) => save(new Request('./index.html'), r));
    e.respondWith(caches.match('./index.html').then((c) => { if (c) { e.waitUntil(net.catch(() => {})); return c; } return net; }).catch(() => caches.match('./index.html')));
    return;
  }
  // Files: answer from the cache right away, refresh it in the background.
  e.respondWith(caches.match(e.request).then((cached) => {
    const net = fetch(e.request).then((r) => save(e.request, r)).catch(() => cached);
    if (cached) { e.waitUntil(net); return cached; }
    return net;
  }));
});
