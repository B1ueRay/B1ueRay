// Kurazh offline cache. Only same-origin static files are ever cached: no cross-origin
// responses (CDNs, Google, the PeerJS broker), no query-string or API-like requests.
const CACHE = 'kurazh-v6';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './config.js', './live.js', './sound.js', './analytics.js',
  './support.html', './legal/terms.html', './legal/privacy.html', './legal/community-guidelines.html',
  './admin.html', './sound-lab.html', './test-rig.html', './viewer-pov.html',
];
const STATIC = /\.(?:html|js|css|webmanifest|png|svg|ico|woff2?)$/i;
const FRESH = /\/config\.js$/; // network first, so a new client ID reaches devices on the next load

function cacheable(req, res) {
  const url = new URL(req.url);
  return req.method === 'GET' && url.origin === location.origin && (url.pathname.endsWith('/') || STATIC.test(url.pathname))
    && res && res.ok && res.type === 'basic' && !res.redirected;
}

self.addEventListener('install', (e) => {
  // Each file on its own: a team file that doesn't exist yet must never break the install.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((u) =>
    fetch(new Request(u, { cache: 'reload' })).then((res) => (cacheable(new Request(new URL(u, location.href)), res) ? c.put(u, res) : null)).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('kurazh-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const page = req.mode === 'navigate';
  // Navigations with ?watch=… or ?topic=… still get the cached page, but other query strings bypass the cache.
  if (url.search && !page) return;
  if (!page && !url.pathname.endsWith('/') && !STATIC.test(url.pathname)) return;
  const key = page ? new Request(new URL(url.pathname, location.href)) : req;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(key);
      const net = fetch(req)
        .then((res) => { if (cacheable(key, res)) cache.put(key, res.clone()); return res; })
        .catch(() => hit || Response.error());
      if (FRESH.test(url.pathname)) return net; // config.js: network first, cache as fallback
      return hit || net;
    }),
  );
});
