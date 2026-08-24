/* ==================================================================
   Service worker — this is what makes the airplane-mode demo REAL.

   Everything the app needs is cached on first load, then served from
   cache first, forever. Once installed, Takhti opens and runs a full
   lesson with the phone in airplane mode — no dev server, no wifi,
   nothing. That is the claim the whole pitch rests on, so it should
   be genuinely true on the judge's own handset.

   Bump CACHE when you ship changes, or phones will keep the old copy.
   ================================================================== */
const CACHE = 'takhti-v1';

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/styles.css',
  './src/config.js', './src/state.js',
  './src/content/sentences.js', './src/content/games.js', './src/content/facts.js',
  './src/content/anim.js', './src/content/copy.js',
  './src/core/log.js', './src/core/speech.js', './src/core/matcher.js',
  './src/core/adaptive.js', './src/core/daily-engine.js', './src/core/mathgen.js',
  './src/content/competencies.js', './src/core/store.js', './src/core/profiles.js',
  './src/ui/mascot.js', './src/ui/readback.js', './src/ui/cards.js',
  './src/ui/views.js', './src/ui/opening.js', './src/ui/handlers.js',
  './src/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  // addAll fails the whole install if one file 404s, which would leave the
  // app half-cached and mysteriously broken offline. Cache individually and
  // report what is missing instead.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(u =>
      cache.add(u).catch(err => console.warn('[sw] could not cache', u, err))
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Tier 2 must never be served stale — it is either live or it is queued.
  if (url.pathname.endsWith('/api/ask')) return;

  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      // opportunistically cache same-origin extras (fonts come from a CDN
      // and are allowed to fail — the CSS declares fallback stacks)
      if (res.ok && url.origin === location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(e.request, res.clone());
      }
      return res;
    } catch (err) {
      // offline and not in cache: for a navigation, hand back the app shell
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
