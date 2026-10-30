/* freeHTML.dev - cache same-origin pages under their own keys.
   External tools keep their own service workers. */
const VERSION = 'fhd-v33-offline-redirects';
const SHORTCUTS = [
  '/convert', '/cheaper', '/money', '/prompts', '/bmi', '/preview', '/bets',
  '/words', '/lorem', '/pass', '/qr', '/barcode', '/cv', '/pdfimg', '/subs', '/quiz', '/stability', '/img', '/tts-reader', '/palette', '/cycle-calendar', '/photo-sheet', '/zones', '/pdf', '/sign', '/github', '/star'
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
/* Descarca o adresa si intoarce un raspuns curat, fara urma de redirect.
   Cloudflare servește /index.html și /404.html printr-un redirect (307) catre /index, respectiv
   /404. Un raspuns venit prin redirect NU poate fi folosit de browser pentru o NAVIGARE, asa ca
   varianta pusa in cache de cache.addAll() lasa site-ul fara offline, desi fisierele apar in cache. */
async function curat(url) {
  try {
    const res = await fetch(new Request(url, { credentials: 'same-origin', redirect: 'follow' }));
    if (!res.ok) return null;
    const body = await res.blob();
    const clean = new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8' }
    });
    return { res: clean, final: res.url || url };
  } catch (_) {
    return null;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => Promise.all(SHELL.map(async path => {
      const absolut = new URL(path, self.location.origin).href;
      const rezultat = await curat(absolut);
      if (!rezultat) return;                       /* o adresa lipsa nu rupe instalarea */
      await cache.put(absolut, rezultat.res.clone());
      if (rezultat.final !== absolut) await cache.put(rezultat.final, rezultat.res.clone());
    })))
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
    }).catch(async () => {
      /* intai pagina ceruta, apoi cheia de pagina, abia apoi 404 - si mereu curat, fara redirect */
      const direct = await caches.match(url.pathname);
      const copie = direct || (key && await caches.match(key)) || await caches.match('/404.html');
      if (!copie) return Response.error();
      if (!copie.redirected) return copie;
      const body = await copie.blob();
      return new Response(body, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': copie.headers.get('Content-Type') || 'text/html; charset=utf-8' }
      });
    }));
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
