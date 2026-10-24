# Takhti — working notes for Claude Code

A foundational literacy and numeracy tutor for Indian children aged roughly 5–10.
Built for the iQOO Hackathon 2026, Smart Education track. This repo is the web
prototype; the Android build ports the same logic to Kotlin + Compose.

This file describes the repo **as it actually stands** — verified against the
code and the test suite, not carried forward from earlier drafts of itself
(which drifted badly once: it described a whole cartoon system as live when no
screen could reach it). Where something is limited or not built yet, it says
so — see **Known limitations** at the bottom.

## The one rule that explains the architecture

**The network loads tomorrow. It never serves today.**

Everything a child does in a session runs on-device and is deterministic. The
cloud only answers the saved question queue and pre-fetches future content. If
you are ever tempted to put a network call in the path of a lesson, don't — that
breaks the entire premise and the demo.

| Tier | What it does | Where |
|------|--------------|-------|
| 0 | Reading matcher + age-band pass thresholds, stroke scoring, skill-shaped problem generation, adaptive level, daily scheduler, skill graph + diagnostic, spaced repetition, cartoon episodes, procedural sound | `src/core/`, `src/content/`, `src/games/` — always on, no network, no model |
| 1 | A fresh practice line for missed words | `core/tier1.js` — the curated bank everywhere; the phone's own on-device model (Chrome's Prompt API) where it already has one, strictly validated |
| 2 | Cloud answers for the question queue; class sync between phones | `askCloud()` / `flushQueue()` via `api/ask.js`; `core/class-sync.js` via `api/class-sync.mjs` |

The app ships no model of its own. Tier 1 uses the phone's built-in on-device
model when the browser provides one (see **Tier 1**). "Generative" in
`core/generative-brain.js` means an episode assembled from the child's own
data (skill, level, game) by deterministic code — see **The Picture Hut**.

## Running it

```bash
npm run dev        # serves on http://localhost:5173
npm test           # all 25 test suites (see Testing)
```

No build step, no bundler, no framework. Open `index.html` through the dev
server, not `file://` — the camera, fetch, and `localStorage` all need a real
origin.

## Why plain script tags, not ES modules

Views render HTML strings with `onclick="..."` handlers, which need their
functions on `window`; ES modules would scope them away. **Load order in
`index.html` is therefore load-bearing** — a file that registers a screen
(`VIEWS.x = …`) must load after `ui/views.js`; anything a file calls *at load
time* must come before it. Calls made at run time (inside functions) can go
either way.

Current order (`index.html`):

```
config.js, state.js
content/sentences.js, content/games.js, content/themes.js, content/facts.js, content/ages.js
content/skills.js, content/curriculum-early.js, content/lessons.js, core/lesson-gen.js
content/literacy.js, content/comprehension.js
core/diagnose.js, core/class-share.js, core/class-sync.js, core/generative-brain.js, core/video-library-catalog.js, core/cartoon-series.js
core/srs.js, core/sfx.js, games/game-core.js
content/anim.js, content/copy.js, content/competencies.js
core/log.js, core/store.js, core/profiles.js
core/voice.js, core/speech.js, core/matcher.js
core/adaptive.js, core/daily-engine.js, core/mathgen.js, core/readability.js, core/tier1.js
ui/mascot.js, ui/readback.js, ui/elephant.js, ui/lesson-player.js, ui/anim-celebrate.js, ui/cards.js
ui/views.js, ui/opening.js
ui/arrival.js, ui/onboarding.js, ui/jungle-map.js, ui/video-player.js, ui/teacher.js
games/runner.js, games/pop.js, games/tower.js, games/match.js, games/sort.js, games/archer.js
ui/self-listen.js, ui/handlers.js
app.js
```

`sw.js` caches the app shell as `takhti-v29` (recorded narration lives in a
separate, never-bumped `takhti-audio-v1`). **Bump `CACHE` whenever you ship
changes.** Its `SHELL` list must be exactly `index.html`'s stylesheets +
scripts in the same order — `test/hygiene.test.js` fails otherwise, so a new
file can't silently miss the offline cache.

## Layout

```
src/
  config.js                 Tier 2 endpoint; falls back to on-device when absent
  state.js                  S — the single global state object; newProfile() is one child's record
  content/
    sentences.js            reading + copying lines, EN and HI, 6 levels
    games.js                20 games: opening-animation tokens, quiz, and actor/proj/accent for drawings
    themes.js               6 visual themes for cartoon episodes (sports, anime, cinema, folk tale, sci-fi, fantasy)
    facts.js                60 facts (3 per game)
    ages.js                 age bands: modules offered, starting levels, number ceiling, pass/gate scores
    skills.js               the skill graph + skillCoverage()
    curriculum-early.js     Nursery→Class 5 skills; coverageMatrix()/ladderCoverage()/contentQueue()
    lessons.js              hand-authored lessons (lesson-gen.js generates the rest)
    literacy.js             literacy + early-numeracy beats
    comprehension.js        comprehension + grammar beats (the last gaps below Class 4)
    anim.js, copy.js, competencies.js   animation templates, UI strings, NIPUN/NCERT level names
  core/
    diagnose.js             the teacher diagnostic, class-code mirror, homework bridge
    class-share.js          progress/homework codes that carry the class between phones
    class-sync.js           automatic class sync — hourly, on reconnect, and "Sync now"
    generative-brain.js     builds one 4-scene cartoon episode for a maths skill
    video-library-catalog.js  which episodes a child is offered, and which first
    cartoon-series.js       short multi-episode ladders, filtered to the child's band
    srs.js                  spaced repetition (Ebbinghaus)
    sfx.js                  synthesized sound effects + the map's ambient rustle
    log.js                  the judge-facing trace panel
    store.js                localStorage wrapper — load()/save()/saveSoon()
    profiles.js             up to 4 children on one phone
    voice.js                recorded narration where it exists, else device TTS
    speech.js               speak(), listen() — on-device recognition where the phone has it
    matcher.js              the reading matcher + getGradeThresholds()/gradeVerdict()
    adaptive.js             rolling-window levelling, daily goals; record() feeds SRS
    daily-engine.js         the week plan; dayIndex()/dayKey() (calendar-driven)
    mathgen.js              genProblem(level) for free practice; skillProblem(skill) for one named skill
    lesson-gen.js           generates the lesson bank; genHomeworkStory(), genGameSvg()
    readability.js          a measurable difficulty score for a line
    tier1.js                practice lines for missed words (bank + on-device model)
  games/
    game-core.js            shared round lifecycle + GAME_SHELLS registry
    runner, pop, tower, match, sort, archer   the six game shells
  ui/
    mascot.js               Munni (munniSmall) and Gauri (gauriSmall) SVGs
    elephant.js             the ask-page Munni with moods; trumpet()
    readback.js, cards.js   read-it-back, and the seven daily card formats
    lesson-player.js        plays lesson beats; homework stories; awardCard()
    anim-celebrate.js       triggerConfetti()/triggerStarBurst() — one shared canvas loop
    views.js                VIEWS, go()/render(), profileSwitcher(), topGamifyBar()
    opening.js              AFTER hooks; the daily opening; goHub()
    arrival.js, onboarding.js, jungle-map.js   boot scene, avatar/age picker, the hub
    video-player.js         the Picture Hut (VIEWS.theater)
    teacher.js              the teacher view (VIEWS.teacher)
    self-listen.js          hear-your-own-reading
    handlers.js             event handlers
  app.js                    boot: load(), S.screen='arrival', render()
api/ask.js                  serverless proxy; keeps the API key off the client
api/class-sync.mjs          Tier 2 class sync (Netlify Blobs); syncCore() is the merge
sw.js                       service worker — offline cache
```

## Screens and navigation

**Boot**: `app.js` → `arrival` (jungle scene, also the first user gesture audio
needs). `arrFinish()`: no avatar/age → `onboard`; no game yet → `pick`;
otherwise `goHub()`.

**`goHub()`** (`opening.js`): the first arrival of a calendar day plays `open`
(greeting → animation → **today's card**), every other arrival goes straight
to `map`. `S.lastOpen` records the day. The pick screen promises "every day
will start with it" — this is what keeps that true. `switchProfile()` uses the
same routing (or onboarding, for a profile missing an avatar/age).

**The jungle map** (`jungle-map.js`) is the hub every screen returns to. Seven
places, gated by the child's age band (`mapVisible()`), never appearing and
disappearing between visits:

| place | screen | |
|------|--------|---|
| The Reading Tree | `read` | read aloud, graded |
| The Sand Patch | `write` | trace / write on paper |
| Counting Stones | `math` | free maths practice |
| The Story Fire | `lessons` | story lessons + homework |
| The Play Clearing | `games` | the six game shells |
| Munni's Pond | `ask` | questions for Tier 2 (shows how many wait for signal) |
| The Picture Hut | `theater` | cartoon episodes |

Above the map: `topGamifyBar()` (the child's avatar and stars) and
`profileSwitcher()` (switch child, or **Add** — the same tap-an-animal
onboarding as the first child, via `addChild()`). Below: **For parents →**,
which goes through the PIN gate (`parentlock`). The parent dashboard links on
to **For teachers →** (`teacher`).

**Where Munni stands** — `mapSuggestion()` returns `{place, why}`:
1. `homework` — teacher homework this child hasn't finished (`S.hwDone`)
2. `review` — spaced-repetition items due, at their module's place
3. `target` — the module furthest from today's goal
4. `null` — all done; she rests at the Play Clearing

`mapLine()` says why, in words (a level-up she noticed, the teacher's
homework, what's left today, or that it's fine to stop); tapping her reads it
aloud. A review is never called a review. Arriving at the map
(`mapArrive()`, `AFTER.map`) starts the ambient sound and plays the
celebration for any daily goal met elsewhere since the last visit.

## The Picture Hut — cartoon episodes

- **One episode = one maths skill, four scenes** (`generateCartoonBlueprint()`):
  the challenge → *watch how* (a **different** worked example, drawn with
  `lesArt()` beats when small enough, partial products / multiply-first steps
  otherwise) → **your turn** (the child's question) → the rule to remember,
  and a card. The child's own game supplies the actors; the theme supplies the
  scenery; Gauri is the real sparrow drawing.
- **The numbers come from `skillProblem()`** (`mathgen.js`), so they genuinely
  exercise that skill at the child's band: carrying carries, borrowing
  borrows, BODMAS is `a + b × c` with the add-first mistake as a distractor.
  Options are shuffled; every wrong option is a real mistake for that skill.
  Skills that aren't a single arithmetic question get no episode (`null`).
- **The answer is real evidence**: `noteSkillAttempt()` (the diagnostic's
  skill history) and `record('math')` (level, goals, SRS). The card is
  awarded only for a right answer, once (`awardCard()`, stable ids), kept in
  `S.cards`, and shown on the parent dashboard.
- **Catalog** (`getVideoCatalog()`): one episode per maths skill the child's
  band reaches (`CARTOON_MAX_GRADE`); theme filter shows every skill in that
  theme. **Recommendation** (`recommendNextVideo()`): homework first, then the
  child's hardest practised cartoon skill, then one not yet earned.
  **Series** (`cartoonSeriesFor()`): three short skill ladders, filtered to
  the episodes the band reaches.

## Homework — teacher to child

Teacher view → `assignHomework(code, [skill], note)`. On each child's app,
`personalizeContentForHomework()` runs `diagnose()` on it against **that
child's own evidence** and returns the plan, its lessons, and `storySkill` —
the deepest confirmed gap it can teach as a question (a child weak on tables
who is assigned BODMAS gets tables). The Story Fire shows the banner: "Start
with …", a homework story (solo or with a friend) if there's a `storySkill`,
and the plan's lessons. Finishing the story sets `S.hwDone`, so Munni moves
on. `clearHomework()` withdraws it.

## The teacher view

`ui/teacher.js`, behind the parent PIN. Reads the class-code mirror for a code
— children on this phone, plus children on other phones whose parent sent a
progress code (see **Between phones**) — lists them, and lets a teacher pick the skill the class got wrong:
`tDiagnose()` per child (with `planSummary()`, slips and guesswork flagged),
`classPattern()` for the shared gap, then assign that skill or the shared gap
as homework (and send it on as a homework code). It also shows what Takhti
covers — `skillCoverage()`, `coverageMatrix(3)`, `ladderCoverage()` — and
what it can't teach yet (`contentQueue()`).

## Between phones — automatic sync, or by code

The class mirror is each phone's own storage. Two ways it travels:

**Automatic sync** (`core/class-sync.js` ↔ `api/class-sync.mjs`). Every class
this phone takes part in syncs **once an hour** (checked every 5 minutes),
**the moment a connection returns**, and on **Sync now** (parent dashboard and
teacher view). Runs whenever the phone really has a connection
(`navigator.onLine`), regardless of the demo signal toggle.
- **Consent first.** A child's data is only sent if a parent switched *Sync
  automatically* on for that child (`S.syncOn`, off by default, behind the
  PIN; the dashboard says exactly what is sent). Only the name and practice
  counts per skill — never photos, voice, levels or what was read.
- **Who sees what.** The teacher's phone holds a random per-class key
  (`S.syncKeys`, made when the teacher switches *Keep this class synced* on,
  never shown or shared; the server stores only its SHA-256). The first
  teacher phone claims the class; only that key gets the whole class back or
  can set/withdraw homework, and a different key is refused (403). A child's
  phone gets back only the homework and its own record — never classmates'.
- **Merging** is newest-wins: per child by `at` (local mirror writes are
  timestamped), homework by `assignedAt`. Withdrawing homework writes a dated
  `cleared` marker (`clearHomework()`) so the withdrawal travels too.
  Assigning or withdrawing homework syncs straight away.
- **The server** (`api/class-sync.mjs`, Netlify function, also runs under the
  Vercel-style signature) stores one record per class in Netlify Blobs
  (`takhti-classes`), type-checks and caps everything (name 40 chars, ≤200
  skills, ≤60 children, right ≤ tries, no reserved ids, 64 KB body). With no
  blob store (another host, local dev) it answers 503 and the app says
  "Sync isn't set up on this server yet" and carries on.

**By code, no internet** (`core/class-share.js`) — for phones that rarely see
a connection, the way schools already pass things around (WhatsApp, SMS):
- **Progress code** (`classReportCode()`, parent dashboard → *Or send by
  code*), pasted into the teacher view (`importClassReport()`).
- **Homework code** (`homeworkCode()`, teacher view), pasted on the parent
  dashboard (`importHomework()`); it links an unlinked child and refuses
  another class's homework.

Format `TKR1|TKH1.base64url(json).checksum`; a code cut short or edited is
rejected before it touches a record; an older code never overwrites newer data.

## The reading matcher — read this before changing it

`core/matcher.js` is the most load-bearing code in the repo. Six stages:
capture → normalize → align → grade → confidence gate → score.

- **Devanagari letters are multiple codepoints.** Always go through
  `graphemes()`; never iterate a string by character.
- **Two normalization levels, and the gap is the feature.** `normWord()`
  strict → *correct*; `foldWord()` soft → *near*, not wrong (nukta,
  long/short vowels, anusvara/chandrabindu, ण/न, श/ष/स, b/v).
- **Never mark a child wrong for the recognizer's doubt.** Low confidence
  plus a low score is `'unsure'`: ask again, record nothing.
- **Grade every alternative, keep the best.**
- **The pass bar moves with age**: `gradeVerdict()` uses the band's own
  `passScore`/`gateScore` (`content/ages.js`). Don't hardcode a threshold
  elsewhere.

## The skill graph

`SKILLS` (`skills.js`, extended by `curriculum-early.js`) tags every attempt
with the skill it really exercises, so a failed BODMAS question can be traced
to the prerequisite underneath. **Verified numbers** (`test/comprehension.test.js`,
the one suite that loads the full graph): 41 concepts → 489 lessons, 0
rejected; 103 skills after dedup (126 raw, 23 absorbed); 55/103 = 53%
teachable; Nursery–Class 3 subject coverage 63/63; reading and writing
ladders 6/6 each; 517 game-pool items.

## Spaced repetition

`core/srs.js` (intervals 1/3/7/21 days), fed by `record()` for `read`/`write`/
`math`. Surfaced invisibly: Munni's routing (above) and `VIEWS.read`, which
serves due sentences most-overdue first (`S.ctx._srsQueue`, drained by
`nextSentence()`). `write`/`math` items carry no replayable content, so for
those the routing is the review. The parent dashboard's **REMEMBERED**
section shows `srsStats()` in plain words, with an empty state.

## Daily cards

`weekPlan()` orders the formats by this child's needs for the week;
`dayIndex()` picks today's from the **real weekday** (plus `S.day`, a demo
offset only the "Tomorrow →" button moves); `dayKey()` seeds everything
that should be "today's" (fact, word, story, lessons offered). Seven of the
eight formats show each week — the one this child needs least sits out.

## Sound and celebration

`core/sfx.js`: every effect goes through `sfxPlay()` — silent when muted or
without Web Audio, and fail-safe on partial implementations. One shared noise
buffer; chalk throttled to one scrape per 70ms; the map's ambient rustle
starts on arrival and stops on leaving or muting (`sfxAmbientStop()`).
`ui/anim-celebrate.js`: one canvas, one loop, visual only (callers play
sound), honours `prefers-reduced-motion`. Used deliberately rarely: a goal
met, a lesson passed, a correct cartoon checkpoint, a clean read-back
(`cheer()`), tapping your own name.

## Offline reading — on-device speech recognition

`listen()` (`speech.js`) uses the browser's **on-device** recognizer whenever
the phone has the language pack (newer Chrome: `SpeechRecognition.available()`
/ `install()` / `processLocally`) — offline *and* online, because then the
child's voice never leaves the phone. `prepareOfflineSpeech()` downloads the
English and Hindi packs while there is a connection (at boot, on the first
mic tap, or the parent dashboard's *Download offline reading* button); its
results are in `STT_LOCAL`. Without a pack: online uses the browser's normal
recognizer; offline ends the turn **synchronously** with an honest message
(including "connect once to download offline reading" when a pack can be
fetched) — the typed fallback is always on the reading screen. The live
recognizer is kept in `ACTIVE_LISTEN` so `stopListening()` (called by
`go()`, `nextSentence()`, `switchProfile()`) can end an abandoned turn. The
parent dashboard's *Without internet* section shows what this phone has.

## Tier 1 — practice lines

After a reading that isn't a pass, `tier1Offer()` (`handlers.js`) offers
*"One more with these words: …"* from `tier1PracticeLine()` (`core/tier1.js`):
a bank line containing every missed word wins outright; otherwise the phone's
own on-device model (Prompt API `LanguageModel`) may write one — **only if it
is already on the phone** (never downloaded mid-lesson) and only if
`t1Valid()` accepts it: every target word, the band's length, plain letters
and punctuation only (no markup, digits or web addresses), readability at or
below the child's band. Failing that, the nearest bank line. Tapping it makes
that line the one to read (`practiseLine()`). One bounded sentence, never a
conversation.

## Self-listen

`ui/self-listen.js` records the child's own reading alongside `listen()` with
its own `getUserMedia`/`MediaRecorder`; the clip never touches `fetch`,
`localStorage` or IndexedDB (the test scans the source for exactly that), and
`URL.revokeObjectURL` runs at the same three reset points as
`stopListening()`.

## Product constraints that are not negotiable

- **No streaks, no reminder notifications to children.** India's DPDP Act s.9
  bars addictive design aimed at minors (penalties up to ₹200 crore). Stars
  are the only habit mechanic, and they only ever grow — never spent, reset,
  or compared. (A "🔥 N Day" streak badge once crept into the map header; it
  was removed. `topGamifyBar()`'s comment says why — keep it that way.)
- **Original IP only.** Gauri the sparrow and Munni the elephant are ours.
- **Photos and voice clips never leave the device.** Keep it true, and keep
  saying so in both languages.
- **A tutor, not a companion.** Bounded, task-scoped.
- **Every child-facing string ships in Hindi and English.**

## Testing

`npm test` runs 21 suites. Two methods: **vm** (real source in an isolated
context, real functions) and **jsdom** (the real `index.html`/CSS/JS over a
local HTTP server — `file://` is an opaque origin where `localStorage` throws).

| file | method | proves |
|------|--------|--------|
| `matcher` | vm | score-band table incl. real Hindi recognizer output |
| `lessons` | vm | every hand-authored lesson is structurally valid and arithmetically right |
| `lesson-gen` | vm | the validator rejects broken lessons; the generated bank is sound |
| `diagnose` | vm | class-code mirror; coverage numbers match the full graph |
| `homework` | vm | assignment, the diagnosed `storySkill` (tables under BODMAS), reading homework gets no fake maths story, `clearHomework()` |
| `literacy` | vm | literacy.js in isolation (its numbers are labelled as that increment) |
| `comprehension` | vm | the full graph — the numbers above come from here |
| `games`, `runner`, `shells` | vm | game pool and every shell's round logic |
| `shell-integration` | jsdom | the real `playGame()` → `go()` → `AFTER` chain |
| `mute` | jsdom | muted `speak()` still finishes scenes; mute is per child |
| `jungle` | jsdom | arrival → onboarding → map; band-gated places; SRS routing and first sentence; map and dashboard with and without SRS history |
| `self-listen` | jsdom | the recording lifecycle and the privacy claim |
| `srs` | vm | interval maths |
| `dda` | vm | age-band thresholds, and "unsure" for recognizer doubt |
| `sfx` | vm | muted = silent, shared buffer, chalk throttle, ambient start/stop, fail-safe on partial Web Audio |
| `class-sync` | vm | the real server merge + two simulated phones: nothing sent without consent; child → teacher, homework and its withdrawal → child; hourly schedule; offline and no-server handled; children never see classmates; parents can't set homework; a second teacher phone can't take over; only the key's hash stored; input sanitised |
| `class-share` | vm | two separate "phones": progress code → teacher's diagnosis → homework code back; damaged, edited, wrong-kind and older codes rejected |
| `tier1` | vm | bank lines for missed words (EN/HI); the validator; a stub on-device model: good line used, bad reply thrown away, never downloaded mid-lesson, bank first |
| `offline-stt` | vm | packs downloaded while online; offline recognition on the device (EN/HI); on-device even online; no pack → immediate honest end; browsers without the API unchanged |
| `homework-story` | vm | real skill-shaped questions, shuffled answers, the child's own game, stable card ids |
| `video-generator` | vm | episodes, catalog band limits and theme filter, series, recommendation, evidence + card only for a right answer |
| `app-flows` | jsdom | **every wired feature through real taps**: onboarding, map, Picture Hut, PIN gate, teacher view, homework end to end, the practice-line button, the on-device status, progress and homework codes, adding a sibling, once-a-day opening, goal celebration |
| `hygiene` | static | **no unreachable code**, `sw.js` matches `index.html`, no orphan files |

**Helpers** (`test/_helpers/`): `load-order.js` — suites that quote numbers
from the full content graph check their own hand-written load list against
`index.html` (`verifyLoadListHasAllContent()`); suites that test a
self-contained file (`dda`, `sfx`) load only that file. `reachability.js` —
walks from what a session really runs (top-level statements in load order,
`index.html` markup, `onclick` text, screen names) and reports any top-level
function or constant nothing can reach. It over-approximates, so anything it
reports is genuinely dead. **Keep `hygiene` green: if it flags something,
wire it in or delete it.**

## Known limitations

Honest edges of what's built:

1. **Offline reading depends on the browser.** It works where the browser
   offers on-device recognition and the pack has downloaded (recent Chrome);
   elsewhere offline reading is typed. Whether a Hindi pack exists is the
   browser's call. (The Android build uses `EXTRA_PREFER_OFFLINE`.)
2. **The on-device model depends on the browser too.** Without one, practice
   lines come from the curated bank only — which covers most missed words.
3. **Sync needs the server deployed on Netlify** (Netlify Blobs). Elsewhere
   it reports "not set up" and the codes still work. The teacher key lives on
   one phone: a teacher who changes phones needs a new class code (no
   key-transfer flow yet).
4. **`planSummary()` is English-only**, so the teacher view's per-child line
   is English even in Hindi mode.
5. **SRS replays content only for reading**; write/math review is routing only.
6. **Cartoons and homework stories cover arithmetic skills only**
   (`SKILL_OPS` in `mathgen.js`). Other homework still gets its diagnosed
   lessons, just no story.
7. **Browser APIs are stubbed in the tests** (speech, the on-device model,
   audio). Check on a real handset before a demo — especially the microphone
   and offline reading.

## Style

Plain, dependency-free JavaScript in the app (`jsdom`, `acorn`, `acorn-walk`
are test-only dev dependencies; `@netlify/blobs` is used only by the server
function). Comments explain *why*, not *what*.
Child-facing copy is warm and short; never scold, never say "wrong" when
"almost" is true. Sound and celebration calls are guarded — a bonus, never a
dependency. Keep the judge trace (`log()`) honest: it must never claim
something happened that didn't.
