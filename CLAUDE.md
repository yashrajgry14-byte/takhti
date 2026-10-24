# Takhti — working notes for Claude Code

A foundational literacy and numeracy tutor for Indian children aged roughly 5–10.
Built for the iQOO Hackathon 2026, Smart Education track. This repo is the web
prototype; the Android build ports the same logic to Kotlin + Compose.

This file describes the repo **as it actually stands** (verified by walking
`git ls-files`, the real filesystem, and running the full test suite — not
carried forward from memory). Where something is stale, unwired, or
contradictory, it is called out explicitly rather than quietly fixed — see
**Known issues** near the bottom.

**Git note:** as of commit `f7c05e0` ("Self-listen, jungle map, arrival,
onboarding, game shells, SRS, homework"), everything described below is
tracked — `git ls-files` is accurate again.

## The one rule that explains the architecture

**The network loads tomorrow. It never serves today.**

Everything a child does in a session runs on-device and is deterministic. The
cloud only answers the saved question queue and pre-fetches future content. If
you are ever tempted to put a network call in the path of a lesson, don't — that
breaks the entire premise and the demo.

Three tiers, and the child never sees which one is running:

| Tier | What it does | Where |
|------|--------------|-------|
| 0 | Reading matcher, stroke scoring, problem generation, adaptive level, daily scheduler, skill graph, spaced repetition, offline STT, Generative AI Brain, Cartoon Engine, Procedural Audio | `src/core/`, `src/content/`, `src/games/` — always on, no network, no model |
| 1 | Small language model for fresh sentences and kid-language explanations | `tier1Explain()` in `handlers.js` — a stub; enhances Tier 0, never gates it |
| 2 | Cloud answers + storyboards for the question queue | `askCloud()` / `flushQueue()` via `api/ask.js` |

## Running it

```bash
npm run dev        # serves on http://localhost:5173
npm test           # runs all 19 wired test files (see Testing below)
```

No build step, no bundler, no framework. Open `index.html` through the dev
server (not `file://` — the camera, fetch, and `localStorage` all need a real
origin; `file://` is treated as opaque and `localStorage` throws there —
several tests exist specifically to serve over a local HTTP origin for this
reason, see Testing).

## Why plain script tags, not ES modules

The views render HTML strings containing `onclick="..."` handlers. Those need
their functions on `window`. ES modules scope everything, so the handlers would
silently break. **Load order in `index.html` is therefore load-bearing** — if
you add a file, put it after everything it calls at load time, and add it to
`sw.js`'s `SHELL` array in the same relative position so the offline cache
stays complete.

The exact, current, authoritative load order (`index.html` and `sw.js`'s
`SHELL` array are kept in lockstep — both were checked this pass and agree):

```
config.js, state.js
content/sentences.js, content/games.js, content/themes.js, content/facts.js, content/ages.js
content/skills.js, content/curriculum-early.js
content/lessons.js, core/lesson-gen.js
content/literacy.js, content/comprehension.js
core/diagnose.js, core/generative-brain.js, core/video-library-catalog.js, core/cartoon-series.js
core/srs.js, core/sfx.js
games/game-core.js
content/anim.js, content/copy.js, content/competencies.js
core/log.js, core/store.js, core/profiles.js
core/vosk-stt.js, core/voice.js, core/speech.js, core/matcher.js
core/adaptive.js, core/daily-engine.js, core/mathgen.js, core/readability.js
ui/mascot.js, ui/readback.js, ui/elephant.js, ui/home-scene.js
ui/lesson-player.js, ui/anim-celebrate.js, ui/video-player.js, ui/cards.js
ui/views.js, ui/opening.js
ui/arrival.js, ui/onboarding.js, ui/jungle-map.js
games/runner.js, games/pop.js, games/tower.js, games/match.js, games/sort.js, games/archer.js
ui/self-listen.js
ui/handlers.js
app.js
```

`sw.js`'s cache is `takhti-v26` (`AUDIO_CACHE = 'takhti-audio-v1'`, a
separate, never-bumped cache for content-hashed recorded narration — bumping
`CACHE` on a normal deploy must never force a re-download of tens of MB of
audio).

## Layout

```
src/
  config.js                 Tier 2 endpoint; falls back to on-device when absent
  state.js                  S — the single global state object
  content/
    sentences.js            reading + copying lines, EN and HI, 6 levels
    games.js                20 games: tokens for the opening animation + a quiz
    themes.js               6 visual & narrative themes (Anime, Movies, Folk Tales, Sci-Fi, Fantasy, Sports)
    facts.js                60 facts (3 per game) with hero numbers and units
    ages.js                 age-band definitions, per-band starting levels/module gating
    anim.js                 which animation template each game uses
    copy.js                 UI strings, EN and HI
    competencies.js         display names for the 6 levels, mapped to NIPUN Bharat / NCERT FLN
    skills.js               the skill graph — see "The skill graph" below
    curriculum-early.js     extends the skill graph Nursery→Class 5 beyond maths;
                             coverageMatrix()/ladderCoverage() for the school-facing % numbers
    literacy.js              literacy + early-numeracy lesson beats (tracing, blending, sight words)
    comprehension.js         the last 7 gaps below Class 4: reading comprehension + grammar beats
    lessons.js               hand-authored lesson data (see lesson-gen.js for the generated bank)
  core/
    generative-brain.js     Generative AI Brain — synthesizes 4-scene cartoon animation blueprints
    video-library-catalog.js Infinite Cartoon Video Catalog & Recommendation Engine ("YouTube for Kids")
    cartoon-series.js       Multi-episode topic cartoon series generator (narrative arcs)
    sfx.js                  Web Audio procedural sound effects engine (sfxPop, sfxThud, sfxChime, sfxChalk)
    log.js                   the judge-facing trace panel
    store.js                 thin localStorage wrapper — load()/save(), see "Persistence"
    profiles.js              multi-child profiles — see "Multi-child profiles"
    speech.js                TTS with voice fallback; listen() — WebSpeech when online,
                             else onEnd('network')/onEnd('unsupported') immediately
    voice.js                 plays pre-recorded (content-hashed) narration where it exists
    vosk-stt.js              offline STT status — isVoskReady()
    matcher.js                the reading matcher — see below
    readability.js            a measurable difficulty score for a line (no ML)
    adaptive.js                rolling-window levelling + daily goal counters; record()
    daily-engine.js            the weekly format scheduler + world/word content pools
    mathgen.js                 levelled arithmetic problem generation
    lesson-gen.js               generates the full lesson bank from CONCEPTS at boot;
    diagnose.js                 the teacher diagnostic — see "The teacher diagnostic" below
    srs.js                      spaced repetition (Ebbinghaus) — see "Spaced repetition" below
  games/
    game-core.js               shared game-shell plumbing: GAME_SHELLS registry, gamePool()
    runner.js, pop.js, tower.js, match.js, sort.js, archer.js
                                the six playable game shells
  ui/
    mascot.js                  Gauri, an SVG chalk sparrow
    elephant.js                 Munni, the Ask-page mascot — 4-mood state machine
    home-scene.js                the (now-retired-as-destination) home screen's idle director
    readback.js                  child reads the screen aloud, graded and coached
    cards.js                     the seven daily card formats + animation scenes
    lesson-player.js             plays a lesson's BEATS as animated stories
    anim-celebrate.js            zero-dependency 60fps HTML5 Canvas confetti & starburst particle engine
    video-player.js              Multi-modal Cartoon Player & Cartoon Theater gallery UI
    views.js                     VIEWS (screen renderers) + topGamifyBar() header
    opening.js                   AFTER (post-render hooks) + timeline
    arrival.js                   the jungle boot scene
    onboarding.js                 avatar + age picker
    jungle-map.js                 the hub screen
    self-listen.js                hear-your-own-reading loop
    handlers.js                   all event handlers
  app.js                        boot: load(), S.screen='arrival', render()
api/ask.js                    serverless proxy; keeps the API key off the client
sw.js                         service worker — offline cache (takhti-v26)
```

## Generative AI Backend Brain & Multi-Theme Cartoon Library

1. **Generative AI Brain (`src/core/generative-brain.js`)**:
   - Evaluates child profile traits (*age band, skill history, favorite game/theme, learning modality, teacher assignments*).
   - Synthesizes 4-scene cartoon animation blueprints on demand:
     - **Scene 1 (The Hook)**: Real-world/themed match setup with teacher note integration.
     - **Scene 2 (Visual Cartoon Explainer)**: Step-by-step cartoon math/literacy visual breakdown with vector SVG keyframes dynamically styled by universe theme (`genCartoonSvgKeyframe()`).
     - **Scene 3 (Interactive Checkpoint)**: Pauses for child answer selection with Web Audio SFX feedback.
     - **Scene 4 (Memory Rule & Badge)**: Rhyming mnemonic rule, celebratory sound effect (`sfxChime()`), and unlockable collectible badge.

2. **Multi-Theme Universe Engine (`src/content/themes.js`)**:
   - 6 distinct visual and narrative universe themes:
     - ⚔️ **Anime / Manga**: Energy auras, neon gradients, speed rays, electric spark particle overlays.
     - 🎬 **Cinema / Movies**: Cinema stage spotlights, dramatic backdrop cones, film strip aesthetics.
     - 📜 **Folk Tales / Indian Mythology**: Ancient scrolls, heritage motifs, parchment borders, golden glows.
     - 🚀 **Sci-Fi / Cyberpunk**: Cyber grids, matrix neon backdrops, hologram rings, starry space nebulas.
     - 🐉 **Fantasy / Fairytale**: Magic sparkles, enchanted castle towers, glowing crystal lighting.
     - 🤼 **Sports Arena**: Stadium spotlights, action field lines, track energy rays.

3. **Infinite Kids Video Library Catalog ("YouTube for Kids") (`src/core/video-library-catalog.js`)**:
   - An expanding catalog of generated cartoon videos indexed across subjects (*Math, Literacy, Science, Ethics*).
   - Smart recommendation engine (`recommendNextVideo`) that analyzes homework assignments and prerequisite skill gaps to synthesize recommended videos.

4. **Topic Cartoon Series Engine (`src/core/cartoon-series.js`)**:
   - Generates 3-to-5 episode narrative cartoon arcs (e.g., *"Kabir's Anime Power League"*, *"Munni's Ancient Folk Tale Quest"*, *"Ananya's Sci-Fi Space Frontier"*).

5. **Cartoon Theater & Video Player UI (`src/ui/video-player.js`)**:
   - Dedicated **"📺 Cartoon Theater / बाल चित्रशाला"** view:
     - **Theme Filter Pills**: Instant filtering across *All, Anime, Movies, Folk Tales, Sci-Fi, Fantasy, Sports*.
     - **Vector Cartoon SVG Keyframe Stage**: Renders 60fps animated cartoon scene keyframes with theme-matched backdrops.
     - **Playback Controls**: `▶ Play`, `⏸ Pause`, `⏪ Replay`, `🎙️ Self-Listen`.
     - **Synchronized Narration**: Active subtitle highlight synchronized with speech and Web Audio SFX (`sfxPop()`, `sfxThud()`, `sfxChime()`, `sfxChalk()`).

## Child-Centric UI & UX ("Takhti Playground")

- **Tactile 3D Controls (`.btn-3d`)**: Tactile, pressable 3D interactive push-buttons with HSL shadows, scale micro-press states, and pop feedback across all views (`src/styles.css`, `src/theme-light.css`).
- **Glassmorphism Styling (`.glass-card`)**: Frosted translucent containers with vibrant HSL borders, inner highlights, and dynamic background blurs.
- **Top Gamification Header (`.top-gamify-bar`)**: Real-time tracked **🔥 Daily Streak**, **⭐ Star Balance**, and interactive cheering **🐘 Munni Mascot Avatar** (`src/ui/views.js`, `cheerMascotAvatar()`).
- **Zero-Dependency Canvas Celebration Engine (`src/ui/anim-celebrate.js`)**: 60fps HTML5 Canvas particle confetti and starburst burst engine (`triggerConfetti()`, `triggerStarBurst()`) firing whenever a child correctly answers an interactive checkpoint or completes a cartoon lesson.
- **Procedural Web Audio SFX Engine (`src/core/sfx.js`)**: Zero-dependency Web Audio synthesizers (`sfxPop()`, `sfxThud()`, `sfxChime()`, `sfxChalk()`) respecting `S.muted`.

## The reading matcher — read this before changing it

`core/matcher.js` is the most load-bearing code in the repo, and Hindi makes it
subtle. Six stages: capture → normalize → align → grade → confidence gate → score.

Things that will break if you are careless:

- **Devanagari letters are multiple codepoints.** `की` is क + ी. Always go
  through `graphemes()` before measuring distance; never iterate a string by
  character.
- **Two normalization levels, and the gap between them is the feature.**
  `normWord()` strict → a match here is *correct* (green). `foldWord()` soft →
  a match only here is *near* (amber), not wrong. The fold absorbs nukta
  inconsistency, long/short vowels, anusvara vs chandrabindu, ण/न, श/ष/स, and
  the b/v confusion — all things a recognizer or a child routinely varies.
- **Never mark a child wrong for the recognizer's doubt.** Low confidence plus
  a low score means ask again and record nothing.
- **Grade every alternative, keep the best.** The recognizer returns five
  guesses; the correct reading is often not the first.

There is a test table for this — `test/matcher.test.js`. Extend it rather
than eyeballing.

## The skill graph

`content/skills.js` holds `SKILLS` — the idea that a child who fails a BODMAS
question has usually not internalised something further back (operator
precedence, not "more BODMAS practice"), so every attempt is tagged with the
skill(s) it actually exercises, not just the topic. `content/curriculum-early.js`
extends this graph beyond maths (Nursery→Class 5, for school credibility), and
`content/comprehension.js` adds the last 7 gaps below Class 4 (comprehension +
grammar). `skillCoverage()` dedups read*/write* pool items into the ladder so
they aren't double-counted; `coverageMatrix()`/`ladderCoverage()` produce the
subject/ladder % numbers the diagnostic and this doc both quote.

**Verified current numbers** (by running the real code via
`test/comprehension.test.js`):

- **41 concepts**, generating **489 lessons, 0 rejected** by `validateLesson()`.
- **103 skills** after dedup (126 raw skills, 23 absorbed as read*/write* pool duplicates).
- **55/103 = 53% teachable today** (48 content gaps remain).
- Nursery–Class 3 subject coverage (excluding EVS, excluding the reading/writing ladder): **63/63 = 100%**.
- Reading ladder: **6/6 = 100%**. Writing ladder: **6/6 = 100%**.
- Overall (subject matrix + both ladders), Nursery–Class 3: **75/75 = 100%**.
- Game shell pool (`gamePool()`): **517 items**, 0 structural problems.

## Persistence

`core/store.js` is a thin wrapper over `localStorage` — `load()`/`save()`
(and a debounced `saveSoon()`) are the only things that touch it directly. Key:
`takhti.progress.v2`. Device-level fields (not per-child): `profiles`,
`activeProfile`, `parentPin`. `localStorage` is unavailable on `file://`
origins (opaque origin).

## Multi-child profiles

`core/profiles.js` — up to `MAX_PROFILES = 4` children on one phone.
`S.<field>` (name, game, levels, srs, ...) is always a live mirror of
`S.profiles[S.activeProfile]`; `syncProfileOut()`/`syncProfileIn()` are the
only places that copy between them.

## Spaced repetition

`core/srs.js` is a self-contained Ebbinghaus spaced-repetition engine:
`recordSrsItem`, `getDueSrsItems`, `srsStats`, `srsIntervalMs`, with
`SRS_INTERVALS_MS = {1: 1 day, 2: 3 days, 3: 7 days, 4: 21 days}`.
`core/adaptive.js`'s `record()` calls `recordSrsItem` on every graded attempt.

surfaced via:
- **Routing**: `mapSuggestion()` checks `getDueSrsItems(S)` first.
- **Content**: `VIEWS.read` drains due `read` items first before random picks.
- **Parent Dashboard**: **REMEMBERED** section renders `srsStats(S)` long-term memory stats.

## The teacher diagnostic

`core/diagnose.js`:
- `diagnose(failed, child)` — per-child diagnostic from failed items.
- `classPattern(results)` — aggregates across a class.
- `tDiagnose(failed, students, classCode)` — the class-level version.
- **Class-code mirror**: `mirrorToClassNow(child)` / `mirrorToClass(child)`.
- **Teacher-assigned homework**: `assignHomework`, `getAssignedHomework`, `personalizeContentForHomework`.

## Game shells

`games/game-core.js` holds the shared plumbing every shell reuses: `GAME_SHELLS`, `gameBuildPool()`, `gamePool()`, `gameItems()`, `gameSets()`, `gameStart()`, `gameAnswer()`, `gameEnd()`, `gameSummary()`.

Six shells: `runner`, `pop`, `tower`, `match`, `sort`, `archer`.

## Product constraints that are not negotiable

- **No streaks, no reminder notifications to children.** India's DPDP Act
  s.9 bars addictive design patterns aimed at minors, with penalties up to
  ₹200 crore. Retention comes from variety, not guilt.
- **Original IP only.** No Chhota Bheem or licensed characters. Gauri the sparrow and Munni the elephant are ours.
- **Photos never leave the device.** Notebook shelf & self-listen clips are strictly local.
- **This is a tutor, not a companion.** Bounded, task-scoped.
- **Every child-facing string ships in Hindi and English.**

## Testing

`npm test` runs all **19 test files** in `test/`, in this order (from `package.json`):
1. `matcher.test.js`
2. `lessons.test.js`
3. `lesson-gen.test.js`
4. `diagnose.test.js`
5. `homework.test.js`
6. `literacy.test.js`
7. `comprehension.test.js`
8. `games.test.js`
9. `runner.test.js`
10. `shells.test.js`
11. `shell-integration.test.js`
12. `mute.test.js`
13. `jungle.test.js`
14. `self-listen.test.js`
15. `srs.test.js`
16. `dda.test.js`
17. `sfx.test.js`
18. `homework-story.test.js`
19. `video-generator.test.js`

Current status: **100% Green — 0 failures across all 19 test suites**.

## Known issues

1. **The `home` screen is retired as a destination but not deleted.** Every former `go('home')` call site now points to `go('map')`. `VIEWS.home` remains intact.
