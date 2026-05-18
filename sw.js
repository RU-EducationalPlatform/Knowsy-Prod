// Service Worker — offline-first resilience for Knowsy.
//
// Strategy:
//   HTML pages         — network-first, cache fallback (always fresh when online)
//   JS / CSS / SVG     — stale-while-revalidate (instant load, refresh in background)
//   /modules/docs/**.md — stale-while-revalidate (lessons load offline once read)
//   Firebase / GA APIs — network only (don't cache auth or analytics)
//
// Bumping CACHE_VERSION invalidates all caches on next page load.

const CACHE_VERSION = 'knowsy-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const DOCS_CACHE = `${CACHE_VERSION}-docs`;

// Hot pages we want available offline immediately.
const PRECACHE = ['/', '/login.html', '/DynamicContent.html', '/health.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) =>
      cache.addAll(PRECACHE.map((u) => new Request(u, { credentials: 'same-origin' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isApi(url) {
  return (
    url.hostname.endsWith('.googleapis.com') ||
    url.hostname.endsWith('.firebaseio.com') ||
    url.hostname === 'firebaseapp.com' ||
    url.hostname.endsWith('.firebaseapp.com') ||
    // Firebase Storage — live broadcast chunks MUST pass through (caching
    // would serve stale segments to viewers on reload). googleapis match
    // above also covers firebasestorage.googleapis.com; this is belt-and-
    // suspenders for explicit storage URLs.
    url.hostname === 'firebasestorage.googleapis.com' ||
    url.hostname.endsWith('.firebasestorage.app') ||
    url.hostname.includes('sentry') ||
    url.hostname.includes('ingest.sentry.io')
  );
}

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && req.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Last-ditch fallback for navigation: serve the cached landing.
    if (req.mode === 'navigate') {
      const home = await caches.match('/');
      if (home) return home;
    }
    throw new Error('offline and not cached');
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok && req.method === 'GET') cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || network || (await network);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Don't touch cross-origin Firebase / Sentry / analytics.
  if (url.origin !== self.location.origin) {
    if (isApi(url)) return; // pass through, no caching
    return;
  }

  // Navigation requests → network-first.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req, PAGES_CACHE));
    return;
  }

  // Markdown docs → stale-while-revalidate.
  if (url.pathname.startsWith('/modules/docs/')) {
    event.respondWith(staleWhileRevalidate(req, DOCS_CACHE));
    return;
  }

  // Everything else (JS, CSS, SVG, etc.) → stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
});

// Allow the page to ask us to skip waiting (used after a deploy).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
