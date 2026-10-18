/* freeHTML.dev - cache same-origin pages under their own keys.
   External tools keep their own service workers. */
const VERSION = 'fhd-v18-cta-count';
const SHORTCUTS = [
  '/convert', '/cheaper', '/money', '/prompts', '/bmi', '/preview', '/bets',
  '/words', '/lorem', '/pass', '/qr', '/img', '/tts-reader', '/palette', '/cycle-calendar', '/photo-sheet', '/zones', '/github', '/star'
];
const SHELL = [
  '/', '/index.html', '/404.html',
  '/manifest.webmanifest', '/assets/favicon.svg', '/assets/icon-192.png',
  '/assets/icon-512.png', '/assets/og.png'
];
function pageKey(path) {
  if (path === '/' || path === '/index.html') return '/index.html';
  return null;
}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(SHELL))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('fhd-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (SHORTCUTS.includes(url.pathname.replace(/\/$/, ''))) return;
  if (req.mode === 'navigate') {
    const key = pageKey(url.pathname);
    event.respondWith(fetch(req).then(res => {
      if (key && res.ok && !res.redirected) {
        const copy = res.clone();
        event.waitUntil(caches.open(VERSION).then(cache => cache.put(key, copy)).catch(() => {}));
      }
      return res;
    }).catch(async () => (key && await caches.match(key)) || await caches.match('/404.html') || Response.error()));
    return;
  }
  // Retain refresh work even when a cached response is returned immediately.
  const refresh = fetch(req).then(async res => {
    if (res.status === 200 && res.type === 'basic' && !res.redirected) {
      const cache = await caches.open(VERSION);
      await cache.put(req, res.clone());
    }
    return res;
  });
  event.waitUntil(refresh.catch(() => {}));
  event.respondWith(caches.match(req).then(hit => hit || refresh).catch(() => Response.error()));
});
