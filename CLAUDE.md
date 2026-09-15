# Takhti — working notes for Claude Code

A foundational literacy and numeracy tutor for Indian children aged roughly 5–10.
Built for the iQOO Hackathon 2026, Smart Education track. This repo is the web
prototype; the Android build ports the same logic to Kotlin + Compose.

This file describes the repo **as it actually stands** (verified by walking
`git ls-files`, the real filesystem, and running the full test suite — not
carried forward from memory). Where something is stale, unwired, or
contradictory, it is called out explicitly rather than quietly fixed — see
**Known issues** near the bottom.

**Git note:** `git ls-files` currently reflects an old baseline commit — most
of what's described below (`content/skills.js`, `content/curriculum-early.js`,
`content/literacy.js`, `content/comprehension.js`, `core/diagnose.js`,
`core/srs.js`, `core/vosk-stt.js`, all of `src/games/`, `ui/arrival.js`,
`ui/onboarding.js`, `ui/jungle-map.js`, `ui/self-listen.js`, and 12 of the 15
test files) is untracked or modified-but-uncommitted. `git status` is the
accurate picture, not `git ls-files`.

## The one rule that explains the architecture

**The network loads tomorrow. It never serves today.**

Everything a child does in a session runs on-device and is deterministic. The
cloud only answers the saved question queue and pre-fetches future content. If
you are ever tempted to put a network call in the path of a lesson, don't — that
breaks the entire premise and the demo.

Three tiers, and the child never sees which one is running:

| Tier | What it does | Where |
|------|--------------|-------|
| 0 | Reading matcher, stroke scoring, problem generation, adaptive level, daily scheduler, skill graph, spaced repetition, offline STT | `src/core/`, `src/content/`, `src/games/` — always on, no network, no model |
| 1 | Small language model for fresh sentences and kid-language explanations | `tier1Explain()` in `handlers.js` — a stub; enhances Tier 0, never gates it |
| 2 | Cloud answers + storyboards for the question queue | `askCloud()` / `flushQueue()` via `api/ask.js` |

## Running it

```bash
npm run dev        # serves on http://localhost:5173
npm test           # runs the 14 wired test files (see Testing below)
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
content/sentences.js, content/games.js, content/facts.js, content/ages.js
content/skills.js, content/curriculum-early.js
content/lessons.js, core/lesson-gen.js
content/literacy.js, content/comprehension.js
core/diagnose.js, core/srs.js
games/game-core.js
content/anim.js, content/copy.js, content/competencies.js
core/log.js, core/store.js, core/profiles.js
core/vosk-stt.js, core/voice.js, core/speech.js, core/matcher.js
core/adaptive.js, core/daily-engine.js, core/mathgen.js, core/readability.js
ui/mascot.js, ui/readback.js, ui/elephant.js, ui/home-scene.js
ui/lesson-player.js, ui/cards.js
ui/views.js, ui/opening.js
ui/arrival.js, ui/onboarding.js, ui/jungle-map.js
games/runner.js, games/pop.js, games/tower.js, games/match.js, games/sort.js, games/archer.js
ui/self-listen.js
ui/handlers.js
app.js
```

Notable ordering reasons: `content/comprehension.js` needs `CONCEPTS`/
`GEN_BEATS` (from `lesson-gen.js`) and `SKILLS` (from `skills.js`) already
defined, and `lesson-player.js`'s `lesArt`/`lesSay` delegate to
`literacy.js`'s and `comprehension.js`'s art/say functions, so both content
files must load before the player. `core/log.js` must come before
`core/speech.js`. `ui/readback.js` before `ui/cards.js`. The six game shell
files register themselves into the shared `AFTER` object (see Game shells)
and need `games/game-core.js` and `ui/views.js` (for `go()`/`AFTER`) already
loaded.

`sw.js`'s cache is `takhti-v22` (`AUDIO_CACHE = 'takhti-audio-v1'`, a
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
    log.js                   the judge-facing trace panel
    store.js                 thin localStorage wrapper — load()/save(), see "Persistence"
    profiles.js              multi-child profiles — see "Multi-child profiles"
    speech.js                TTS with voice fallback; listen() — WebSpeech first, falls
                             back to vosk-stt.js; attr()/sayEl() for safe audio buttons
    voice.js                 plays pre-recorded (content-hashed) narration where it exists,
                             else falls back to speech synthesis via speech.js
    vosk-stt.js              offline WASM STT fallback — see "Known issues", it is currently
                             a non-functional stub, not a working recognizer
    matcher.js                the reading matcher — see below
    readability.js            a measurable difficulty score for a line (no ML)
    adaptive.js                rolling-window levelling + daily goal counters; record()
                               also feeds core/srs.js on every graded attempt
    daily-engine.js            the weekly format scheduler + world/word content pools
    mathgen.js                 levelled arithmetic problem generation
    lesson-gen.js               generates the full lesson bank from CONCEPTS at boot;
                                 validateLesson() rejects anything structurally broken
    diagnose.js                 the teacher diagnostic — see "The teacher diagnostic" below
    srs.js                      spaced repetition (Ebbinghaus) — see "Spaced repetition" below
  games/
    game-core.js               shared game-shell plumbing: GAME_SHELLS registry, gamePool(),
                               gameItems()/gameSets(), gameStart/Answer/End/Summary() — every
                               shell reuses these, never reimplements them
    runner.js, pop.js, tower.js, match.js, sort.js, archer.js
                               the six playable game shells — see "Game shells" below
  ui/
    mascot.js                  Gauri, an SVG chalk sparrow
    elephant.js                 Munni, the Ask-page mascot — 4-mood state machine
    home-scene.js                the (now-retired-as-destination) home screen's idle director
    readback.js                  child reads the screen aloud, graded and coached
    cards.js                     the seven daily card formats + animation scenes
    lesson-player.js             plays a lesson's BEATS as animated arithmetic/literacy/
                                 comprehension stories; delegates art/say to literacy.js
                                 and comprehension.js before falling back to its own switch
    views.js                     VIEWS (screen renderers) + go()/render() + profileSwitcher();
                                 see "Screens and navigation" below
    opening.js                   AFTER (post-render hooks) + the greeting → animation →
                                 impact → card timeline; promptAge()/setAge()
    arrival.js                   the jungle boot scene — see "Arrival" below
    onboarding.js                 avatar + age picker — see "Onboarding" below
    jungle-map.js                 the hub screen — see "The jungle map" below
    self-listen.js                hear-your-own-reading loop — see "Self-listen" below
    handlers.js                   all event handlers (startListening, checkRead, playGame, ...)
  app.js                        boot: load(), S.screen='arrival', render()
api/ask.js                    serverless proxy; keeps the API key off the client
sw.js                         service worker — offline cache, see above
```

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
`test/comprehension.test.js`, which is the only test file that loads the
*complete* graph including `comprehension.js` — see Known issues for why this
distinction matters):

- **41 concepts**, generating **489 lessons, 0 rejected** by `validateLesson()`.
- **103 skills** after dedup (126 raw skills, 23 absorbed as read*/write* pool duplicates).
- Nursery–Class 3 subject coverage (excluding EVS, excluding the reading/writing ladder): **63/63 = 100%**.
- Reading ladder: **6/6 = 100%**. Writing ladder: **6/6 = 100%**.
- Overall (subject matrix + both ladders), Nursery–Class 3: **75/75 = 100%**.
- Game shell pool (`gamePool()`): **517 items**, 0 structural problems.

These numbers require the full load order above, `content/comprehension.js`
included. A shorter load list (as several test files still use — see Known
issues) understates coverage.

## Persistence

`core/store.js` is a thin wrapper over `localStorage` — `load()`/`save()`
(and a debounced `saveSoon()`) are the only things that touch it directly, so
the Android port can swap it for Room without touching any caller. Key:
`takhti.progress.v2`. Device-level fields (not per-child): `profiles`,
`activeProfile`, `parentPin`. `localStorage` is unavailable on `file://`
origins (opaque origin) — this is why several jsdom tests spin up a real
local HTTP server rather than loading `index.html` directly.

## Multi-child profiles

`core/profiles.js` — up to `MAX_PROFILES = 4` children on one phone.
`S.<field>` (name, game, levels, srs, ...) is always a live mirror of
`S.profiles[S.activeProfile]`; `syncProfileOut()`/`syncProfileIn()` are the
only places that copy between them, so every view and handler elsewhere just
reads/writes the flat `S` fields it always has. `createProfile(name)`,
`switchProfile(i)`.

## Spaced repetition

`core/srs.js` is a small, self-contained Ebbinghaus spaced-repetition engine:
`recordSrsItem`, `getDueSrsItems`, `srsStats`, `srsIntervalMs`, with
`SRS_INTERVALS_MS = {1: 1 day, 2: 3 days, 3: 7 days, 4: 21 days}`. It touches
only `child.srs` (a real, persisted `newProfile()` field), `Date.now()`, and
an optional `log()` — no dependency on the skill graph or diagnose.js. It is
genuinely wired in: `core/adaptive.js`'s `record()` calls
`recordSrsItem(itemId, mod, S.ctx?.sentence||S.ctx?.glyph||'', ok, S)` on
every graded attempt, and `ui/views.js` calls `getDueSrsItems(S)` to surface
due items. Tested in `test/srs.test.js`.

## The teacher diagnostic

`core/diagnose.js`:

- `diagnose(failed, child)` — per-child diagnostic from failed items.
- `classPattern(results)` — aggregates across a class.
- `tDiagnose(failed, students, classCode)` — the class-level version, reads
  the shared mirror via `readClassShared(classCode)`.
- **Class-code mirror**: `mirrorToClassNow(child)` / `mirrorToClass(child)`
  (debounced) write a child's results into `localStorage` under
  `classMirrorKey(code)` = `'takhti-class-' + code`, so every device sharing
  a class code can read a shared, eventually-consistent picture without a
  server.
- **Teacher-assigned homework** (built on the same mirror, under an
  `_homework` key): `assignHomework(classCode, skillIds, note)`,
  `getAssignedHomework(child)`, `personalizeContentForHomework(child)`. The
  real call site is `assignSampleHomework()` in `handlers.js`.

Tested in `test/diagnose.test.js` (see Known issues — this test's own
hardcoded numbers are currently stale) and `test/homework.test.js` (currently
unwired — see Known issues).

## Game shells

`games/game-core.js` holds the shared plumbing every shell reuses rather than
reimplements: `GAME_SHELLS` (the registry below), `gameBuildPool()`/
`gamePool()`, `gameItems()`/`gameSets()`, and the shared round lifecycle
`gameStart(kind, len)` / `gameAnswer(ok)` / `gameEnd()` / `gameSummary()`.
Every answer feeds `noteSkillAttempt()` (the skill graph) and, for maths
items, `record('math', ok)` (the adaptive engine) — games are a first-class
evidence source for the diagnostic, not a separate toy.

The six shells, each a `src/games/<kind>.js` file with pure round-logic split
from DOM rendering, and each registering its own `AFTER.<kind>` post-render
hook:

| kind | name | tests / builds |
|------|------|-----------------|
| `runner` | Run and Choose | fast recall — answer without stopping to think |
| `pop` | Pop the Right One | spotting — find the one that fits the rule |
| `tower` | Build the Tower | care over speed — one wrong block and it wobbles |
| `match` | Find the Pairs | memory — hold what you saw and match it |
| `sort` | Sort it Fast | deciding — two bins, no time to dither |
| `archer` | Find the Odd One | reasoning — work out why one doesn't belong (a bow, deliberately not a gun) |

`playGame(kind)` calls the shell's own `xBegin()` first, then `go(kind)`.
`go()` stops every OTHER shell's loop (and the home-scene director, arrival,
and any in-flight self-listen clip) but explicitly excludes the shell it is
entering — see the comment at `views.js:4` and Known issues history: this
used to be a real bug (see below) and `test/shell-integration.test.js` exists
specifically to catch a regression of it. `match`'s displayed "best" is
fewest moves (lower is better), tracked separately from `gameEnd()`'s own
right-count bookkeeping (`S.gameBest.matchMoves`, not `S.gameBest.match`).

## Screens and navigation

Screens live in two places: `VIEWS` in `ui/views.js` (`greet`, `age`, `pick`,
`open`, `home`, `parentlock`, `read`, `write`, `math`, `lessons`, `games`,
`ask`, `askquiz`, `parent`), plus three screens registered into the same
`VIEWS` object from their own files: `arrival.js` → `VIEWS.arrival`,
`onboarding.js` → `VIEWS.onboard`, `jungle-map.js` → `VIEWS.map`. Post-render
hooks live in `AFTER` (defined in `opening.js`, extended by `arrival.js` and
each game shell).

**Boot** (`app.js`, unconditionally): `S.screen = 'arrival'` → `render()`.
`arrival.js`'s `arrFinish()` then routes onward once the scripted arrival
conversation ends:

```
arrival → (no avatar or age not set) → onboard
        → (avatar+age set, no game chosen) → pick
        → (avatar+age+game all set) → map
```

`map` (the jungle map, `jungle-map.js`) is the actual hub now — it replaces
`home` as the screen every other screen's back button and completion flow
returns to. All 13 `go('home')` call sites across `views.js`,
`lesson-player.js`, `readback.js`, and `profiles.js` were changed to
`go('map')` this session. **`home`'s view code and its `AFTER.home` hook
(which starts `home-scene.js`'s idle director) are left intact but are no
longer reachable through normal navigation** — see Known issues.

From `map`, the six places (`MAP_PLACES` in `jungle-map.js`) go to: `read`
(The Reading Tree), `write` (The Sand Patch), `math` (Counting Stones),
`lessons` (The Story Fire — story-mode lessons), `games` (The Play Clearing —
the shelf of 6 shells), `ask` (Munni's Pond). `mapVisible()` filters places by
the active age band's allowed modules; `mapSuggestion()` picks whichever
module is furthest from its daily target.

`greet` and `age` are the original new-profile-creation screens, still used
by `profileSwitcher()`'s "add a child" button (`go('greet')`) — they are not
retired, `onboard` is the *first-run* path and `greet`/`age` remain the
*add-another-child* path.

### Arrival

`ui/arrival.js` — the jungle scene every session opens on, new device or
returning. Time-of-day sky via `ARR` config (dawn/day/dusk/night hour
ranges, `arrPeriod()`); synthesized ambience (rooster/rumble/chirp) from raw
Web Audio oscillators in `arrAudio()`, not audio files; a 4-elephant herd
(`arrElephant()`); a bounded, fully-scripted 3-turn tap-reply conversation
(`arrTalk()`/`arrReply()`/`arrAdvance()`/`arrSkip()`) that also doubles as the
app's first real user gesture, which the rest of the app's audio depends on.
`S.muted` (global, persisted per child — see below) is reachable from a mute
button here. `arrFinish()` routes onward per the table above.

### Onboarding

`ui/onboarding.js` — avatar-tap (`AVATARS`, 9 animals) then a candle-cake age
picker. `obWhoHTML()`/`obPickAvatar()`, `obAgeHTML()`/`obPickAge()`/
`obFinishAge()`, `onboardHTML()` router. `obPickAvatar()` lazily calls
`createProfile(name)` if no active profile exists yet, so a brand-new
device's avatar/name/age actually persists (this was a real bug — the
original pasted file never created a profile at all).

### The jungle map

`ui/jungle-map.js` — see Screens above for `MAP_PLACES` and routing.
`mapProgress()` reads today's counters for the progress ring on each place.

### Self-listen

`ui/self-listen.js` — an independent hear-your-own-reading loop that runs
*alongside* (not attached to) `core/speech.js`'s `listen()`. `listen()`
grades what the child said but never exposes the audio (WebSpeech and
`vosk-stt.js` both consume the mic stream internally), so this opens its own
`getUserMedia`/`MediaRecorder` session, started and stopped on the same two
signals `startListening()` already has (mic goes live; recognizer calls back
with a result or error). Module state `SL_STREAM`/`SL_RECORDER`/`SL_SESSION`
(an incrementing token that invalidates a stale `getUserMedia()` promise that
resolves after a newer attempt/reset already started). The clip
(`S.ctx.clipBlob`/`S.ctx.clipUrl`) never touches `fetch`/`localStorage`/
IndexedDB anywhere in this file — that's the literal privacy claim shown to
the child ("Only ever plays back here — never saved or sent"), and
`test/self-listen.test.js` checks the source text for exactly that, not just
DOM behaviour. `URL.revokeObjectURL` is called in exactly three places:
`nextSentence()`, `go()`, `switchProfile()`. `selfListenPlay(url, onSettled)`
defensively handles `Audio.play()` not reliably returning a Promise (jsdom
returns `undefined`; some real WebViews vary too).

### Mute

`S.muted` is global (moved into `newProfile()` this session, so it persists
per child — it used to be arrival-screen-only state). Checked inside
`speak()` (`core/speech.js`) and `trumpet()` (`ui/elephant.js`) themselves,
not just gated in the UI: `speak()` still calls `onDone()` immediately when
muted, so a narrated scene (lesson beat, reading screen, opening sequence)
never stalls waiting for sound that will never come. Reachable from the
arrival screen's mute button and from a "SOUND" section in the parent
dashboard (`toggleMuted()` in `handlers.js`). Tested in `test/mute.test.js`.

## Product constraints that are not negotiable

- **No streaks, no reminder notifications to children.** India's DPDP Act
  s.9 bars addictive design patterns aimed at minors, with penalties up to
  ₹200 crore. Retention comes from the week strip showing *variety*, and now
  the jungle map's own place-to-place variety, not from guilt. If you add a
  habit mechanic, it must only ever grow.
- **Original IP only.** No Chhota Bheem, no licensed characters, anywhere —
  in the app or the pitch. Gauri the sparrow and Munni the elephant are ours.
- **Photos never leave the device.** The notebook shelf is local-only and the
  permission card says so in both languages. Keep it true. The self-listen
  clip carries the identical promise — keep that true too.
- **This is a tutor, not a companion.** Bounded, task-scoped. No open-ended
  persona chat with a child. See *Garcia v. Character Technologies* for why.
- **Every child-facing string ships in Hindi and English.** If you add copy in
  one language only, you have introduced a bug.

## Testing

`npm test` runs 14 of the 15 test files that exist in `test/`, in this order
(from `package.json`): `matcher`, `lessons`, `lesson-gen`, `diagnose`,
`literacy`, `comprehension`, `games`, `runner`, `shells`,
`shell-integration`, `mute`, `jungle`, `self-listen`, `srs`. Current status:
**green — 0 failures**, ~817+ individual checks across the numeric-heavy
files alone (see per-file notes). Two methodologies are used, by design:

- **Node `vm`**: most files load real source into an isolated `vm` context in
  real load order and call the real functions — no reimplementation of the
  logic under test. Used by `matcher`, `lesson-gen`, `lessons`, `literacy`,
  `comprehension`, `diagnose`, `games`, `runner`, `shells`, `homework`, `srs`.
- **jsdom + a real local HTTP server**: loads the actual `index.html`/CSS/JS
  with `runScripts:'dangerously', resources:'usable'`, driven via
  `window.eval(...)` (top-level `const`/`let` in classic scripts do NOT
  become `window` properties — only `var`/function declarations do — this is
  real JS spec behaviour). Served over `http://127.0.0.1:<port>` rather than
  `file://`, because `file://` is an opaque origin where `localStorage`
  throws and `createProfile()`/`save()` need it. jsdom gaps stubbed rather
  than skipped: no `AudioContext` (a `StubAudioContext` that goes
  suspended→running on `.resume()`), no `getUserMedia`/`MediaRecorder` (a
  `FakeMediaRecorder` delivering one chunk on `.start()`, firing `onstop()`
  synchronously on `.stop()`), no `URL.createObjectURL`/`revokeObjectURL` (a
  real spy with a "live URLs" registry for leak detection). Used by `mute`,
  `jungle`, `self-listen`, `shell-integration`.

| file | wired? | proves |
|------|--------|--------|
| `matcher.test.js` | yes | table of [lang, target, transcript, expected score band]; real recognizer transcripts that must score 90+ (`रोज़→रोज`, `बड़ा→बडा`, `ऊँचे→ऊंचे`, `मेरी→मेरि`) and ones that must fail (a skipped word ~65, a misread line ~25) |
| `lessons.test.js` | yes | structural validity of every hand-authored lesson (bilingual title/sub, every `say`/`ask` bilingual, option arrays same length, `correct` a valid index) plus a numeric-checkpoint replay; flags a count mismatch (15 vs. an expected 16) as a reported discrepancy rather than silently editing lesson data |
| `lesson-gen.test.js` | yes | `validateLesson()` genuinely rejects deliberately-broken lessons (adversarial cases), and the generated bank is structurally sound |
| `diagnose.test.js` | yes | class-code mirror (`mirrorToClassNow`/`readClassShared`) against a real in-memory `localStorage` stand-in with real debounce timing; **see Known issues — its own hardcoded skill-coverage numbers are currently stale** |
| `literacy.test.js` | yes | `content/literacy.js`'s beats and `litArt()`/`litSay()` delegation, `coverageMatrix()`/`ladderCoverage()` against the graph *without* `comprehension.js` |
| `comprehension.test.js` | yes | the full, real load order including `comprehension.js` — this is the file whose numbers this doc quotes as ground truth; proves `compArt`/`compSay` delegate correctly from `lesArt`/`lesSay` |
| `games.test.js` | yes | `gameBuildPool()`/`gameItems()`/`gameSets()`/`gameStart()`/`gameAnswer()`/`gameEnd()` directly, no shell UI — 517 pool items, 0 structural problems |
| `runner.test.js` | yes | `runnerRecordAnswer()`'s pure round logic with no DOM: three wrong answers end a round, two do not; `S.gameBest.runner` updates only on a genuine new best; skill history gets real evidence |
| `shells.test.js` | yes | the same discipline as `runner.test.js` for the other five shells — pure round-logic functions driven directly, a spy wrapped around the real `gameAnswer()` counts real invocations |
| `shell-integration.test.js` | yes | the real `playGame()` → `go()` → `render()` → `AFTER.x()` chain in real jsdom — exists specifically because it's the only test exercising `go()`'s "stop every shell but the one being entered" logic; a prior bug here shipped silently because every other games test bypasses `go()` entirely |
| `mute.test.js` | yes | `speak()` still calls `onDone()` when muted (scenes don't stall) and genuinely does NOT call it when unmuted-and-working differently; `S.muted` reachable and persisted per profile in a real jsdom app |
| `jungle.test.js` | yes | boot renders `arrival` without throwing; the herd exists; tapping through the scripted conversation reaches `arrFinish()`; onboarding sets `S.avatar`/`S.name`/`S.age` and seeds levels from the band; the map renders exactly the places the age band allows |
| `self-listen.test.js` | yes | the recording/playback lifecycle against stubbed `getUserMedia`/`MediaRecorder`/`URL.createObjectURL`, and a static scan of the source text for `fetch`/`localStorage`/IndexedDB — the actual privacy claim, not just behaviour |
| `srs.test.js` | yes | `recordSrsItem`/`getDueSrsItems`/`srsStats` interval math against the real `SRS_INTERVALS_MS` table |
| `homework.test.js` | **no — not in `package.json`'s test script** | `assignHomework`/`getAssignedHomework`/`personalizeContentForHomework` against a real in-memory `localStorage` stand-in — passes when run manually (`node test/homework.test.js`), just never runs as part of `npm test` |

## Known issues

Flagged as found, not fixed — per instruction, this section exists so
staleness gets *surfaced* rather than quietly tidied.

1. **`test/diagnose.test.js`'s hardcoded skill-coverage assertions are
   stale**, and it currently passes anyway. Its own `for(const f of [...])`
   load list omits `content/comprehension.js`, even though the real
   `index.html` loads it between `literacy.js` and `diagnose.js`. Verified by
   running the real `skillCoverage()` both ways:

   | | total | taught | pct | gaps |
   |---|---|---|---|---|
   | what `diagnose.test.js` actually asserts (no comprehension.js) | 103 | 48 | 47% | 55 |
   | what the real, fully-loaded app computes | 103 | 55 | 53% | 48 |

   The 7 gaps `comprehension.js` closes that the test still (wrongly) counts
   as open: `e2-compre`, `e2-noun`, `e3-compre`, `e3-verb`, `e3-para`,
   `h3-compre`, `h3-vyakaran`. This is a live instance of the exact failure
   mode this task was framed around ("an unwired suite is usually stale") —
   the test shows 0 FAIL only because it never loads the file that would
   reveal the discrepancy.

2. **`test/homework.test.js` is not wired into `npm test`** — absent from
   `package.json`'s `scripts.test` chain, so CI/`npm test` never runs it. Its
   own load list is also missing `comprehension.js` (and `srs.js`,
   `game-core.js`, though those are irrelevant to homework's own logic).
   Verified this omission is currently harmless to homework.test.js's
   specific assertions (its plan/lesson-list outputs are byte-identical with
   or without `comprehension.js` loaded) — drifted, but not currently wrong,
   unlike `diagnose.test.js` above.

3. **`core/vosk-stt.js` does not actually recognize speech.** `initVoskSTT()`
   sets `ready = true` with a comment reading "Simulated WASM model loader
   for browser environment" — no WASM module, no model, no recognizer is
   ever loaded. `listenVosk()` genuinely opens the mic and buffers real PCM
   audio (`pcmBuffers`), but **that buffer is never processed or read by
   anything — `onResult()` is never called anywhere in the file.** Its
   `{stop}` handle only ever calls `onEnd()` (with `null`, `'unsupported'`,
   or `'not-allowed'`), never a transcript. Since `core/speech.js`'s
   `listen()` falls back to `listenVosk()` whenever WebSpeech is unavailable
   or the device is offline — which, per this app's own core premise, is the
   common case — **a child's reading attempt can never be graded while
   offline**: `checkRead()` is never reached. Compounding this,
   `startListening()` (`handlers.js`) never retains the handle
   `listen()`/`listenVosk()` returns, so nothing ever calls `.stop()` on the
   offline path either — the mic can stay "live" with no way to end the turn
   through the UI. This contradicts the file's own header comment ("Enables
   100% offline speech recognition") and this doc's own prior "Good next
   tasks" note (now removed) claiming offline STT was done. No test currently
   exercises `listenVosk()`'s actual recognition path — `mute.test.js` and
   others stub `AudioContext`/`getUserMedia` for unrelated reasons but do not
   assert anything about STT correctness.

4. **The `home` screen is retired as a destination but not deleted.** Every
   former `go('home')` call site (across `views.js`, `lesson-player.js`,
   `readback.js`, `profiles.js`) now says `go('map')` — confirmed by grep,
   `go('home')` does not appear anywhere in `src/` any more. `VIEWS.home` and
   `AFTER.home` (which starts `home-scene.js`'s idle director,
   `homeSceneStart()`) are both still fully defined and would render
   correctly if reached — they are just currently unreachable through normal
   navigation. Intentional per an earlier explicit decision this session
   ("keep home reachable or retire it, your call" → retired-but-not-deleted).
   `home-scene.js`'s ~everything (`HM_GESTURES`, `homeCelebrate()`,
   `S._pendingCelebrate`) is therefore currently dead code at runtime, not a
   bug, but worth knowing before you next touch it.

5. **Two independent `getUserMedia` calls can be in flight at once.** When
   self-listen is active AND the STT path falls back to `listenVosk()`
   (offline), both open their own microphone stream independently — noted,
   not fixed, out of scope for this pass.

## Style

Plain, dependency-free JavaScript (the one `devDependency`, `jsdom`, is
test-only — see Testing). Comments explain *why*, not *what*. Child-facing
copy is warm and short; never scold, never say "wrong" when "almost" is
true. Keep the judge trace panel (`log()`) informative — it is how the
architecture becomes visible in a three-minute demo.
