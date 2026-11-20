/* ==================================================================
   Service worker — this is what makes the airplane-mode demo REAL.

   Everything the app needs is cached on first load, then served from
   cache first, forever. Once installed, Takhti opens and runs a full
   lesson with the phone in airplane mode — no dev server, no wifi,
   nothing. That is the claim the whole pitch rests on, so it should
   be genuinely true on the judge's own handset.

   Bump CACHE when you ship changes, or phones will keep the old copy.
   ================================================================== */
const CACHE = 'takhti-v88';
// Recorded audio clips are named by a hash of their text (see core/voice.js),
// so they live in a cache of their own that the version cleanup below never
// touches: bumping CACHE on a normal deploy must not re-download tens of MB
// of narration. The one time a filename's sound changes is a line rendered
// again in a new voice (build-audio --force) — then, and only then, bump
// AUDIO_CACHE too. v2 (15 Nov 2026): English re-rendered in Gemini's voice,
// so phones drop the old-voice clips and fetch each again when it next plays.
const AUDIO_CACHE = 'takhti-audio-v2';

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/styles.css', './src/theme-light.css',
  './src/config.js', './src/state.js', './src/content/sentences.js',
  './src/content/games.js', './src/content/themes.js', './src/content/facts.js',
  './src/content/ages.js', './src/content/skills.js', './src/content/curriculum-early.js',
  './src/content/lessons.js', './src/core/lesson-gen.js', './src/content/literacy.js',
  './src/content/comprehension.js', './src/content/geometry.js', './src/content/clock.js', './src/content/calendar.js', './src/core/diagnose.js', './src/core/class-share.js',
  './src/core/class-sync.js', './src/core/syllabus.js', './src/content/library.js', './src/core/library.js', './src/core/generative-brain.js', './src/core/video-library-catalog.js', './src/core/cartoon-series.js',
  './src/core/srs.js', './src/core/sfx.js', './src/games/game-core.js',
  './src/content/anim.js', './src/content/copy.js', './src/content/competencies.js',
  './src/core/log.js', './src/core/store.js', './src/core/profiles.js',
  './src/core/voice.js', './src/core/speech.js', './src/core/matcher.js',
  './src/core/adaptive.js', './src/core/daily-engine.js', './src/core/mathgen.js',
  './src/core/readability.js', './src/core/tier1.js', './src/core/explain.js', './src/core/mind.js', './src/core/twin.js', './src/core/lang-mistakes.js', './src/content/teach.js', './src/core/teachback.js', './src/core/planner.js', './src/core/demo.js', './src/ui/mascot.js',
  './src/ui/readback.js', './src/ui/elephant.js', './src/ui/lesson-player.js',
  './src/ui/anim-celebrate.js', './src/ui/cards.js', './src/ui/views.js',
  './src/ui/opening.js', './src/ui/arrival.js', './src/ui/onboarding.js',
  './src/ui/jungle-map.js', './src/ui/video-player.js', './src/ui/teacher.js',
  './src/games/runner.js', './src/games/pop.js', './src/games/tower.js',
  './src/games/match.js', './src/games/sort.js', './src/games/archer.js',
  './src/ui/self-listen.js', './src/ui/talk-munni.js', './src/ui/cloud-read.js', './src/ui/say-it.js', './src/ui/circle.js', './src/ui/ask-munni.js', './src/ui/mind-ui.js', './src/ui/teach-munni.js', './src/ui/handlers.js', './src/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  // addAll fails the whole install if one file 404s, which would leave the
  // app half-cached and mysteriously broken offline. Cache individually and
  // report what is missing instead.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' goes past the browser's HTTP cache. Without it a phone
    // that loaded the app within the server's max-age filled the NEW cache
    // with the OLD scripts beside the new index.html — a mix of two builds,
    // served cache-first until the next bump (20 Nov: the live link's new
    // first screen never showed, and the Story Fire and Picture Hut broke).
    await Promise.all(SHELL.map(u =>
      cache.add(new Request(u, { cache: 'reload' })).catch(err => console.warn('[sw] could not cache', u, err))
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Tier 2 must never be served stale — it is either live or it is queued.
  if (url.pathname.endsWith('/api/ask')) return;

  // Recorded narration clips: cache-first, forever, in their own cache.
  // The manifest (audio/manifest-{lang}.json) is NOT content-hashed — its
  // contents grow as more lines get recorded — so it deliberately falls
  // through to the normal versioned handler below instead.
  if (url.pathname.includes('/audio/') && !url.pathname.endsWith('.json')) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    })());
    return;
  }

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
