/* freeHTML.dev — service worker
   Cache the shell so the hub page opens offline after the first visit.
   The tools themselves live on tekideki.github.io and register their own
   service workers there, so we never try to cache cross-origin content. */

const VERSION = 'fhd-v2';

/* Short paths that 302 to GitHub Pages — let the network handle those,
   never serve the cached hub page in their place. */
const SHORTCUTS = [
  '/cheaper', '/money', '/prompts', '/bmi', '/preview', '/bets',
  '/words', '/lorem', '/pass', '/qr', '/img', '/github', '/star'
];

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/og.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch the tools' origin
  if (SHORTCUTS.indexOf(url.pathname.replace(/\/$/, '')) > -1) return; // let 302s pass through untouched

  // Navigations: network first, fall back to the cached shell, then offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put('/index.html', copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || caches.match('/404.html')).then((r) => r || Response.error()))
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
