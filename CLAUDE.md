# Takhti — working notes for Claude Code

A foundational literacy and numeracy tutor for Indian children aged 3–10
(four age bands in `content/ages.js`: 3–4, 5–6, 7–8, 9–10).
Started for the iQOO Hackathon 2026 (Smart Education track); now the team's
entry to the Google Startup Buildathon India 2026. This repo is the web
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

**One deliberate exception: hearing a child read.** With a signal, a line the
child reads (or a word said after Munni) is written down by Gemini (Sarvam as
backup — `voice/speech.js`), under the
reading terms a parent accepts at onboarding (see **The reading check**) —
because no phone's own recognizer can hear a child's misreading reliably.
It never *serves* the lesson in the sense that matters: the grading, the
mistakes, the teaching are all on the phone; without a signal the phone's
own recognizer (or typing) takes over, and no answer in 10 s means the same.
**Teach Munni** uses the same exception for a child's *explanation* (written
down, then judged by Gemini — see **Teach Munni**); without a signal or the
terms, the phone's own rubric judges it. A build with no voice server (the
Netlify link) sends Teach Munni's *words* only — typed, or written down by
the phone's own recognizer — to the host's judge, under their own terms.

| Tier | What it does | Where |
|------|--------------|-------|
| 0 | Reading matcher + age-band pass thresholds, stroke scoring, skill-shaped problem generation, shapes drawn and checked, adaptive level, daily scheduler, skill graph + diagnostic, spaced repetition, cartoon episodes, procedural sound | `src/core/`, `src/content/`, `src/games/` — always on, no network, no model |
| 1 | A fresh practice line for missed words | `core/tier1.js` — the curated bank everywhere; the phone's own on-device model (Chrome's Prompt API) where it already has one, strictly validated |
| 2 | Cloud answers for the question queue; class sync between phones; next week's lessons from the school's own syllabus (Gemini drafts, the phone checks); Teach Munni's judge (Gemini, every credit quoted and checked) | `askCloud()` / `flushQueue()` via `api/ask.js`; `core/class-sync.js` via `api/class-sync.mjs`; `core/syllabus.js` via `api/syllabus.mjs`; `ui/teach-munni.js` via `POST /teach/judge` on the voice server, or `/api/teachback` on Netlify (words only) (`api/teachback.mjs`) |

The app ships no model of its own. Tier 1 uses the phone's built-in on-device
model when the browser provides one (see **Tier 1**). "Generative" in
`core/generative-brain.js` means an episode assembled from the child's own
data (skill, level, game) by deterministic code — see **The Picture Hut**.

## Running it

```bash
npm run dev        # serves on http://localhost:5173
npm test           # all 47 test suites (see Testing)
npm run cloud      # the Cloud Run server locally (cloud/server.mjs), on :8080
npm run voice:sim -- --auto --mistakes   # a whole Munni phone call, in the terminal
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
content/literacy.js, content/comprehension.js, content/geometry.js, content/clock.js, content/calendar.js
core/diagnose.js, core/class-share.js, core/class-sync.js, core/syllabus.js, content/library.js, core/library.js, core/generative-brain.js, core/video-library-catalog.js, core/cartoon-series.js
core/srs.js, core/sfx.js, games/game-core.js
content/anim.js, content/copy.js, content/competencies.js
core/log.js, core/store.js, core/profiles.js
core/voice.js, core/speech.js, core/matcher.js
core/adaptive.js, core/daily-engine.js, core/mathgen.js, core/readability.js, core/tier1.js, core/explain.js, core/mind.js, core/twin.js, core/lang-mistakes.js, content/teach.js, core/teachback.js, core/planner.js, core/demo.js
ui/mascot.js, ui/readback.js, ui/elephant.js, ui/lesson-player.js, ui/anim-celebrate.js, ui/cards.js
ui/views.js, ui/opening.js
ui/arrival.js, ui/onboarding.js, ui/jungle-map.js, ui/video-player.js, ui/teacher.js
games/runner.js, games/pop.js, games/tower.js, games/match.js, games/sort.js, games/archer.js
ui/self-listen.js, ui/talk-munni.js, ui/cloud-read.js, ui/say-it.js, ui/circle.js, ui/ask-munni.js, ui/mind-ui.js, ui/teach-munni.js, ui/handlers.js
app.js
```

`sw.js` caches the app shell as `takhti-v85` (recorded narration lives in a
separate `takhti-audio-v2`, bumped only when a line is rendered again in a new
voice — `build-audio.mjs --force` keeps the filename). **Bump `CACHE` whenever you ship
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
    literacy.js             literacy + early-numeracy beats (incl. Class 1 English from NCERT Mridang ch. 1, in our own words: the body words and what each part does, the first sound of a word, the sight word "one")
    comprehension.js        comprehension + grammar beats (the last gaps below Class 4)
    geometry.js             the picture registry (picIs/picArt/picFor/… — every beat whose answer is read off its drawing) and shapes: figure / corner / figures beats drawn as SVG, geoExpect() reads each answer off the drawing; 27 built-in lessons
    clock.js                clocks: clock (one face, "what time is it?") and clocks (start and end, "how long?") drawn as SVG with the hands where they really are, clockExpect() reads the answer off the hands; times read in English and Hindi; 28 built-in lessons
    calendar.js             calendars: months (the twelve months, numbered, optionally a printed date) and calendar (one month's page) drawn as SVG, calExpect() reads the answer off the drawing; months and days read in English and Hindi; 20 built-in lessons
    library.js              GENERATED by tools/build-library.mjs from library/ — the lesson library: each book's chapters and their checked lessons (loaded after core/syllabus.js: data read only when a teacher opens it)
    teach.js                Teach Munni's content: the built-in units (aims with Munni's question, two hints, the ideas and their words), Munni's acted mistakes and what explaining each needs
    anim.js, copy.js, competencies.js   animation templates, UI strings, NIPUN/NCERT level names
  core/
    diagnose.js             the teacher diagnostic, class-code mirror, homework bridge
    class-share.js          progress/homework codes that carry the class between phones
    class-sync.js           automatic class sync — hourly, on reconnect, and "Sync now"
    syllabus.js             the school's own chapter → Gemini's draft lessons → sylClean() + validateLesson() → the teacher approves → schoolLessons()
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
    mathgen.js              genProblem(level) for free practice; skillProblem(skill) for one named skill; the mistakes: column procedures (procAnswers/procMatches), MISTAKES, whichMistake(), mistakeTip(), mistakeExplain()
    lesson-gen.js           generates the lesson bank; genHomeworkStory(), genGameSvg()
    readability.js          a measurable difficulty score for a line
    tier1.js                practice lines for missed words (bank + on-device model)
    mind.js                 how THIS child learns: which way of teaching works, topic by topic, measured; switches when one doesn't (stays on the phone)
    twin.js                 how THIS child thinks: what they know and how it fades, the mistakes they repeat (all three subjects), a guess before each answer; the checked profile for calls and model steps
    lang-mistakes.js        how a read word, a typed-back word or a traced letter went wrong (aspiration, vowel signs, half letters, b/d, mirrored, no शिरोरेखा…) and the help for each
    explain.js              one question step by step (make ten, tens/ones, borrow, multiply first, a word in pieces) — Ask Munni and the help call
    teachback.js            Teach Munni's engine: the aim checker, the offline judge, the quote check, Munni's mistake, the session, what is kept
    library.js              the library on the phone: the class's book and its term (S.libPlan), this week's chapter's lessons checked again → the teacher's approval card
    planner.js              this week's school lessons, this child's way: knows it / a gap underneath / the way that works (the mind) → the school's lesson → Teach Munni; planFor(), planMarkWay()
    demo.js                 the demo class: two labelled demo children whose records differ (written by the mind's and twin's own functions), so one approved lesson shows two paths; demoAdd()/demoRemove()
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
    talk-munni.js           Talking Munni at the Pond and on into the games — parent opt-in, voice leaves the phone only during a talk
    cloud-read.js           the reading check: online, a line goes to the voice server (Gemini, Sarvam as backup) under the reading terms accepted at onboarding (v3); offline, the phone's own recognizer; a skipped check keeps the line to read again
    say-it.js               "say it with Munni": after a slip, the word in pieces in Munni's voice (the offline pack, else the live backup), the child says it, checked again
    circle.js               the learning circle's app side: the parent's sync tick, this week's step, the Friday check, the home question
    mind-ui.js              the mind on screen: missed sums and reading lines taught the child's way, "Munni's idea" on the map, the parent's "How … learns" and school marks; the twin's tip after a mistake and the parent's "How well Munni knows how … thinks"
    ask-munni.js            "Ask Munni": instant step-by-step help on the question on screen; "still stuck?" → Munni calls (in the app)
    teach-munni.js          "Teach Munni" (VIEWS.teach): the child teaches a lesson's aims back; the end-of-lesson button, "Munni forgot again", the parent's "How … explains", the teacher's results per aim
    handlers.js             event handlers
  app.js                    boot: load(), S.screen='arrival', render()
api/ask.js                  serverless proxy; keeps the API key off the client
api/class-sync.mjs          Tier 2 class sync (Netlify Blobs); syncCore() is the merge
api/syllabus.mjs            Tier 2: a chapter → Gemini drafts lessons in Takhti's format (draftCore(); also POST /syllabus on the voice server)
api/teachback.mjs           Tier 2: Teach Munni's judge — which aims an explanation covered, each credit quoted (judgeCore(); POST /teach/judge on the voice server takes audio)
sw.js                       service worker — offline cache
voice/                      Munni on a phone call (Bolna), the learning circle's server, the shared mistakes database, the speech adapter (speech.js: Gemini, Sarvam as backup in asr.js) — a separate Node server, see below
tools/build-audio.mjs       build-time narration into audio/, played offline: lessons, reading lines, every word and its pieces, letters, Munni's coaching lines — Gemini TTS through the Batch API by default (Sarvam or ElevenLabs with --provider)
tools/try-syllabus.mjs      one chapter, live: Gemini drafts (draftCore) → the phone's own checks (sylClean in a vm) → one repair round → syllabus-run/report.md and raw.json (with every model's outcome); the key from voice/.env, never written; --recheck raw.json checks a saved run again with today's checker, no Gemini
tools/build-library.mjs     the lesson library: every chapter of a book in library/<book>/book.json drafted (try-syllabus's pipeline), checked, repaired once, only the passing lessons kept in <ch>.json (+ raw, report); --import a try-syllabus run, --recheck, then bundled into src/content/library.js
tools/book-words.mjs        a reader's lesson never copies its textbook: the chapter's printed lines copied out once by Gemini, kept only as hashes of every five-word run (<ch>.book.json), every kept lesson read against them
library/<book>/             book.json (the book and its chapters, written by a person), <ch>.json / .raw.json / .report.md / .book.json (built); the PDFs are never committed
tools/live-check.mjs        Gemini live, before a demo: Munni's voice, hearing lines read with a planted slip (TTS-made), judging four explanations, judging from a recording — per model in the chain, timed against the phone's budget; says what to set (GEMINI_SPEECH_MODEL, TAKHTI_TEACH_MODEL); live-check/report.md, never the key
tools/compare-speech.mjs    day 1: a folder of children's recordings through both speech providers; where each misjudged a word, and whether to switch the reading check back to Sarvam
```

## Screens and navigation

**Boot**: `app.js` → `arrival` (jungle scene, also the first user gesture audio
needs; a bouncing *Takhti* title while the herd passes, a cast of emoji animals
and flowers, and in the talk Munni's bubble above her and the replies in one
coloured row below her feet — nothing covers her). Onboarding asks the child's
name first (`#obName`, typed by a grown-up, letters only, kept on the phone —
no microphone for a name), then the animal friend (bright cartoon cards); with
no name typed, the animal's name stands in, as before. `arrFinish()`: no avatar/age → `onboard`; no game yet → `pick`;
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
| Munni's Pond | `ask` | questions for Tier 2 (shows how many wait for signal); Talking Munni, if a parent turned it on (it carries on into the games) |
| The Picture Hut | `theater` | cartoon episodes |

Above the map: `topGamifyBar()` (the child's avatar and stars),
`circleMapHTML()` (this week's step, when a parent turned the learning circle on) and
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
on. `clearHomework()` withdraws it. With the learning circle on, homework
also arrives (and is withdrawn) through the sync — see **The learning
circle**.

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
  PIN; the dashboard says exactly what is sent). Only the name, practice
  counts per skill, which Teach Munni points were explained (`explained`,
  ids and c/p/g) and the way each school lesson is being taught to them
  (`paths`, short codes — see **This child's path**) — never photos, voice,
  levels, what was said or read.
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

## The school's own syllabus — `core/syllabus.js`, `api/syllabus.mjs`

Each school teaches from its own textbook; this turns the teacher's chapter
into the class's lessons for the week, without a model ever deciding what a
child sees.

- **The teacher view** (`syllabusHTML()`, a card under the homework): pick
  the class (Nursery/KG → Class 5, `SYL_CLASSES` → the age band and the
  grade of its skills), a PDF or a photo of the page (`sylPickFile()`, ≤ 12
  MB on the phone; the server says its own limit — 3.4 MB on a serverless
  host, 12 MB on the voice server, `TAKHTI_SYLLABUS_MAX_MB` — and a 413
  names it) or the pasted text, how many lessons (2–5), an optional note.
  *Draft this week's lessons* → `sylDraft()`. Needs a signal; offline says
  so. A school key field appears when the server asks for one (403).
- **The server** (`api/syllabus.mjs`, `draftCore()`; a Netlify/Vercel
  function and `POST /syllabus` on the voice server, which has no serverless
  time limit): builds the prompt itself from clamped inputs — the band's
  rules (number ceiling, word limit — sent by the phone from `ages.js`),
  the beat types the player can draw and their limits, the arithmetic rule,
  both languages, the class's skill ids, the note — and asks Gemini
  (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-4-hydrogen`, Gemini 4's fast model since 20 Nov 2026) for JSON in
  Takhti's lesson schema (structured output, **one beat schema per beat
  type, each with its own required fields** — a question can't arrive
  without its two answers and the right one, a rectangle without `w` and
  `h`, a circle without `folds`; the fields that live runs left out or wrote
  as text carry descriptions; one retry with the older field names, and
  the old all-optional schema only if the API refuses the strict one).
  Every teaching picture should carry its `say` (what to look at — never
  a number or name a question then asks for; the prompt says so, and a
  silent one gets Munni's own words, below). Google saying the model is
  busy (503) gets one more try a moment later; a 429 (the key's quota)
  none — then each `GEMINI_FALLBACK_MODEL` in turn (a comma list, default
  `gemini-3.8-flash,gemini-3.5-flash-lite`; `none` switches them off),
  which a 404 also moves to; all busy → "Gemini is busy right now" (a 429
  is said as the key's own limit, not as busy). Every model's outcome and
  time (`ok`, `hung`, 503, 429…) — and, for an answer, the tokens Gemini
  says it used (`usageMetadata`: in, out with thinking, total) — come back
  as `tried` and are logged; `tools/try-syllabus.mjs` totals them per model
  (`TAKHTI_SYLLABUS_LOG=0` silences it). A model that just hung or said
  busy rests for five minutes (`TAKHTI_GEMINI_REST_MS`), so the repair round
  and the next chapter go straight to the fallback. Every model but the last gets at most 60% of
  the time left (55 s serverless, 180 s on the voice server), and never the
  last model's reserve (40% of the limit, at most 45 s,
  `TAKHTI_SYLLABUS_LAST_MS`), and at most a minute each
  (`TAKHTI_SYLLABUS_MODEL_MS`): a model with too little left before it is
  skipped (`no time` in `tried`), a model's retries share its one budget,
  and a try the whole limit cuts off is recorded as `cut` — so a model
  that hangs still leaves the last one a fair turn. The draft and the repair prompt
  share one description of the beats and the rules (`beatsText()`,
  `rulesText()`) — what each shape `ask` means, the school's Hindi words
  (चौकोर कोना, वर्ग…), teach-then-ask, a `why` that names the real mistake —
  and one worked example lesson, which the test runs through the checker so
  the two can't drift apart. A word beat's text is `word` in the drafting
  schema (a rectangle's `w` is a number). The class's skills offered are its
  own grade first, then the grades around it (a Class 3 shapes chapter
  reaches `shapes2d`, `angles`, `perimeter`). A PDF or photo goes as `inline_data`. `mode:'repair'` sends
  rejected lessons back with the checker's reasons; a repair that comes
  back the same as what was sent is marked, and the teacher card says
  "Gemini's fix changed nothing". Drafts only; the key
  never leaves the server; `TAKHTI_SYLLABUS_KEY` (optional school password)
  and a per-address hourly limit.
- **A group can ask about its bundles** (`group {a, ask:'tens'|'ones'}`):
  "how many tens?" is checked as the tens digit, "how many left over?" as
  the ones; `sylTidy()` sets it from the question's words when the marked
  answer is that digit; such a group needs its own `say`, and the player
  hides the tally that would tell. A reading answer "1" counts as in a
  passage that says "one"/"एक"; "how many letters are in the word tiger?"
  is checked by counting.
- **Calendars** (`content/calendar.js`, see **Calendars**) are pictures too: `months
  {m, ask, m2, k, date}` and `calendar {days, start, month, d, w, k, ask}` in the
  schema, the real calendar mistakes in `beatsText()`, "use months / calendar,
  never a sentence" in `rulesText()`, and a worked calendar example the test runs
  through the checker; a missing ask is read from the question's words
  (`calTidy()`), and a line naming the month or day asked for counts as saying
  the answer (`calSaid()`).
- **Two questions, in the library**: `sylClean(…, { minQuestions })` rejects a
  lesson with a picture that asks fewer — with two answers, one question is a
  coin toss. The library builder sets 2 on every draft, repair and re-check
  (`LIB_MIN_QUESTIONS`, `tools/build-library.mjs`); a teacher's own upload keeps
  the warning instead. The prompt says every lesson asks at least two
  questions, and the repair round knows the reason.
- **Clocks** (`content/clock.js`, see **Clocks**) are pictures like shapes:
  a `clock {h, m, ask:'time'}` or `clocks {from, to, ask:'minutes'|'hours'}`
  in the schema with its required fields, described in `beatsText()` with
  the real clock mistakes, the band's clock step in `rulesText()`, and a
  worked clock example the test runs through the checker. A clock's missing
  ask is read from its question and a time written as a note ("3:30") goes
  into h and m (`clockTidy()`); a line that says the time in any form
  ("साढ़े नौ बजे") counts as saying the answer (`clockSaid()`); "3:30" is a
  fine Hindi answer; a silent teaching clock gets Munni's own words ("It is
  half past 4", "That is 20 minutes"); the teacher is warned when every
  clock question is on the hour, and about a clock aim ("tell how long")
  no question checks.
- **The checks, on the phone** (`sylClean()`, then `validateLesson()`):
  only the player's beat types and fields; plain text (no markup, links,
  braces); one emoji; both languages, the Hindi in Devanagari; pictures
  that can be drawn (≤ 20 dots, shares that divide, a part no bigger than
  the whole…); a maths question's right answer is a number equal to what
  the picture before it computes (`sylExpect()`), so the arithmetic is
  checked; a reading question's right answer is in the passage's own words
  (`sylGrounded()`), yes/no answers marked for the teacher to check; a
  shape question's answer is read off its drawing (`geoClean()`, then the
  validator — see **Shapes**); then
  the band's number ceiling and sentence lengths. Before checking,
  `sylTidy()` fixes only what is certain and still checked: a beat repeated
  twice in a row is kept once, a picture's stray notes are dropped, and a
  figure or corner followed by a question but missing its `ask` gets it from
  the question's own words (`sylInferAsk()`: "How many sides?" → sides) —
  a wrong reading fails against the drawing — and a rectangle given only its
  width gets a height half as long (in a row too), except for a perimeter
  question, where a made-up side would change the answer; a row missing its
  `find` gets it from a question that names exactly one shape
  (`sylInferFind()`); a size written as a note ("folds 2", "6 × 3", "60°")
  goes into its own field, never over one that was given
  (`sylSizesFromText()`); a shape written beside a row's items goes in
  only where the row then answers as marked, else it is dropped (never a
  second match); a circle with no folds gets them where they're needed (3 on a
  "where do they meet?" circle, 2 on a teaching circle that talks about
  folds — the answer, the centre, is the same for any number from 2, and
  a number given is never changed); and in a row with one look-alike (the
  square when finding the rectangle, the corner nearest square) the wrong
  answer becomes the look-alike's number, its `why` the mix-up it really
  is (`sylLookAlike()`). Teach on one shape, ask on another
  (`sylAskAnother()`): when a question's picture is the teaching picture
  again, or the lines before it say its count, the picture becomes the
  shape whose answer is the question's other option — teach a square's 4
  sides, ask a triangle's: 3 is right and 4, what the child just heard, is
  the wrong answer, its `why` saying so (a circle asked where its folds meet
  just gets a different number of folds); never when the question names a
  shape or the new count was said too. A teaching picture with no words gets the words
  Munni will really say over it (`geoSayBoth()`: "A rectangle: 4 sides…"),
  written in for the teacher and heard by the giveaway check. Then: something must teach (a
  teaching picture, a worked example or a passage) before the first
  question; a shape question mustn't name the shape it asks about (for
  sides and corners too: "this triangle" gives the count away); a teaching
  circle whose narration talks about folds or the centre must draw 2 or
  more folds; the Hindi
  answers are in Devanagari unless they are numbers. Every lesson carries its
  **aims** — required, 1–4, in the one format Teach Munni uses (a bilingual
  `point`, "the child can …", plus Munni's `forget` question, two `hints` and
  the `ideas` an explanation needs; `teachCleanAims()` — see **Teach
  Munni**): a word both Munni's question and the aim's point say is the
  topic, not the explanation, and comes out of the explanation words first;
  an aim that fails its check is dropped and named (`aimErrors`, a giveaway
  naming the words it says), a lesson left with none is rejected; the repair
  round gets every dropped aim's reason (`sylRepairReasons()`), and after it a
  hint that still gives the explanation away becomes a general nudge
  (`TEACH_NUDGES`, checked again, shown to the teacher as "Hint replaced") — and each
  question may carry a teacher-only `why` (why children pick the wrong
  answer); a question whose answer Munni has just said (`sylSaysIt()` over
  every line written since the last question — for a shape question the
  intro counts too, but a teaching picture may name the idea it teaches when
  the answer is a word; a number as a digit or a word ("three", "तीन") and
  centre/center alike) is rejected, so the child works it out — the reason
  says where ("in the intro", "in beat 1's words"), so the repair round
  changes that line. A shape
  question whose picture is the teaching picture again (same drawing, which
  marks the answer) is rejected by `validateLesson()` (`geoSig()`) — teach
  on one shape, ask on another, as the built-in lessons do; a teaching
  circle that talks about its folds must draw them; a row asking which has
  a square corner may have only one (squares, rectangles and a 3-4-5
  triangle all do — `geoSquareCorner()`); "how many sides does this
  triangle have?" names the count away (any shape's name, in a sides or
  corners question). An aim no question checks is
  flagged for the teacher (`sylAimGaps()`, not a rejection), and a repair
  that came back unchanged is marked. A failure goes back to
  Gemini **once** with its reasons; still failing → shown as "not used",
  with why. The right answer is shuffled (stable, by content); the id is a
  hash of the content, so a lesson edited later gets a different id.
- **The teacher approves the aims** (`sylDraftHTML()`: the aims' points
  first, *Approve these aims*, Munni's questions for them folded under
  "Afterwards Munni forgets these", any aim left out and why, then
  the whole lesson folded underneath — every line with its picture drawn small
  by the player's own `lesArt()` (`sylTeacherArt()`), the right answer marked,
  how each answer was checked, the `why` notes, never shown to a child; a
  shape aim no question checks — "find a shape with 3 sides" with no row —
  is flagged under the aims, on a lesson that isn't used too, and so is an
  aim a screen can't check ("fold a round paper") — `sylAimGaps()`, a
  warning read from the aim's key words, not a rejection; so is a lesson
  with one question — a coin toss with two answers — and one whose every
  "are all its sides equal?" answer is the same, or whose questions all
  share one right answer, or whose Hindi uses a word drafts get wrong here
  (`SYL_HI_WATCH`: झुकाओ for fold, "पता चलूँ"), `sylLessonWarnings()`;
  "by folding", "cut out" are aims a screen can't check):
  `sylApprove()`
  / `sylApproveAll()` / `sylRemove()` write `_lessons {items, at}` (≤ 12)
  into the class mirror; with *Keep this class synced* on, the class sync
  carries them to every synced phone (teacher's key only; shape- and
  size-checked on the server, never trusted).
- **The child** sees *From your school — this week* at the Story Fire
  (`schoolLessonsHTML()`), from `schoolLessons()`, which re-runs both checks
  on this phone and drops any lesson whose id no longer matches. `startLesson()`
  finds them, never rewrites their words online (`enrichLesson()` is
  skipped), answers count for the lesson's skill when the checker matched
  one, and a reading lesson doesn't move the maths ladder. A school maths
  lesson with one question gets a second at play time (`lesYourTurn()`):
  "your turn", the same skill's `skillProblem()` at the child's band (right
  by construction), two answers, the other a real mistake, with its own
  `sum` so Ask Munni explains that sum (one whose own steps would land on
  its answer is passed over) — the approved lesson and its id
  unchanged; shapes, clocks, reading and two-operation skills get none
  (the teacher's card says which). Under each
  lesson the child sees **their own path** to its aims (`planFor()`, see
  **This child's path**), and the lesson's button starts its next step
  (`planGo()`).

## The lesson library — `tools/build-library.mjs`, `library/`, `core/library.js`

Built ahead instead of drafted live: a school says which book it teaches
from, and every school on that book gets the same checked lessons, with no
network and no waiting in the week.

- **A book is listed once** (`library/<book>/book.json`: id, board, title
  in both languages, edition, class, subject, and its chapters — id,
  number, the PDF, how many lessons, an optional note and title). The PDFs
  stay out of the repo (`.gitignore`); the lessons are Gemini's own words,
  numbers and passages, checked by Takhti.
- **The builder** (`node tools/build-library.mjs --book library/<book>`)
  runs each chapter through `tools/try-syllabus.mjs`'s own `run()` — the
  draft, the phone's checks, one repair round — and keeps only the lessons
  that pass (`<ch>.json`, with what wasn't used and why), plus the raw
  drafts and the report beside it. A chapter already built is skipped (a
  run cut short carries on); `--force --only ch5` builds one again;
  `--import ch5 syllabus-run/raw.json` turns a try-syllabus run into a
  chapter; `--recheck` checks every saved draft again with today's checker.
  Neither of the last two calls Gemini. A whole book: `--scan` lists every
  chapter PDF in the folder in book.json in natural order (01, 02, 10),
  front matter and answer files left out (NCERT's `…ps.pdf`, `…an.pdf`), a
  chapter already listed keeping its title, count and note — and warns when
  a chapter already built now points at another file. One chapter Gemini
  can't do (busy, quota, over 12 MB) is said and left for the next run, the
  rest carry on; `summary.md` lists every chapter in order with what it
  has. At the end it bundles every book
  into `src/content/library.js` (`LIBRARY`): each chapter in order, a
  chapter not built yet with no lessons, only the kept lessons, and no book
  with nothing built yet — the test regenerates it and fails if the file was
  edited by hand.
- **Half price, through the Batch API** (`--batch`, `batchBook()`): each
  chapter's PDF goes up once through the Files API (resumable upload, up to
  50 MB — no 12 MB inline limit), the drafts go as one batch job and the
  phone's checker reads every one, the failures go back as a second job with
  its reasons — the same one repair round. The requests are exactly the live
  ones: `api/syllabus.mjs` now builds both (`buildRequest()`, `GEN_SHAPES`,
  `answerJSON()`, `lessonsFrom()`; `draftCore()` is a thin wrapper), and a
  batch whose every request is refused as a bad request is sent again with
  the older field names. The model is `GEMINI_BATCH_MODEL` (default
  `gemini-4-hydrogen`; `gemini-4-argon`, Gemini 4's frontier model, is one
  setting away for the library's best drafts — a batch waits for capacity). The job runs on Google's
  side: its name is kept in `<book>/.batch.json` (never committed), so a
  run that stops waiting (`--wait` minutes, default 60) picks it up again;
  the uploads are deleted when it is done.
- **A rebuild never makes a chapter worse**: a new build from Gemini (live
  or batch) that keeps fewer lessons than the chapter already has is saved
  beside it as `<ch>.candidate.json` with its report, and the chapter stays
  as it was until `--replace` — so a busy day can't empty a chapter a
  school, or the demo, uses. `--recheck` and `--import` are deliberate and
  replace as before.
- **The rules a library lesson meets**: everything an upload meets, and two
  questions — every picture lesson in a maths book, and **every** lesson in
  a reader (`sylClean(…, { minAll })` for a book whose `subject` isn't
  maths): a passage with one two-answer question is a coin toss too. And
  its questions don't all share one right answer (`sylClean(…, { mixRight })`,
  `LIB_MIX_ANSWERS`, every draft, repair and re-check): every answer "Yes" is
  passed by a child who always says Yes. Both rules are the builder's only —
  a teacher's own upload, and a lesson already on a phone, keep the warning.
- **A reader never copies its textbook** (`tools/book-words.mjs`, builder
  only): once per chapter Gemini copies out the chapter's printed lines
  (flash-lite, `TAKHTI_BOOKWORDS_MODEL`); only a hash of every five-word run
  is kept, in `<ch>.book.json` — never the text. A lesson with five or more
  of the book's words in a row, in anything the child reads or hears (not
  its title), is rejected ("copies the textbook word for word ("i see with
  my eyes")") and the repair round is told which words to write again;
  nothing shorter counts — a single word or a short common phrase ("these
  are my legs", "with my eyes") is the language every Class 1 lesson shares; `--recheck` reads the
  kept index with no call. The first live Mridang build kept two lessons
  whose passages were page 7's own sentences — the reason for it. The phone
  can't see the book, so `libDrafts()` doesn't repeat this check.
- **An English book's lessons stay English** (`subject: "english"` —
  Mridang, Santoor; only those — a Hindi reader, an EVS book and a maths
  book get no `lang` and keep the child's language, as before): built with `lang: 'en'` (`langOf()` in the builder →
  `sylClean(…, { lang })`, kept on the lesson and **inside its id only when
  set**, so every maths lesson keeps the id it always had), and checked again
  with it by `libDrafts()` (`libLangOf()`). The player reads the passage,
  the questions and the answer buttons in the lesson's own language whatever
  `S.lang` is (`lesLang()`/`lesText()` in `ui/lesson-player.js`, `CL()` in
  `content/comprehension.js`; the question and a passage Munni reads first
  in the English voice); Munni's intro, her help and "well done" stay in the
  child's language. The class sync carries the lesson object whole, `lang`
  with it. Drafting one, the prompt adds `englishText()` (`api/syllabus.mjs`,
  `lang:'en'` on the draft and repair): simple English a Class 1 child reads,
  hiOpts the same English words, a word card never read out before its
  question, never "which word is this?", first sounds as two letters, never
  copy the book — with a worked English example (`ENGLISH_EXAMPLE`) the test
  runs through the checker. The checker, for such a lesson: an English
  answer may stand as its own Hindi answer (that exact word only); a first
  sound ("What is the first sound of ant?") is checked against the word's
  first letter (`sylFirstSound()`, `sylLetterOf()`); everything read since
  the last question counts as read (two word cards in a row), a card's own
  short word ("to") too; a letter or a two-letter word said aloud before its
  question gives it away (`sylSaysIt()`: "an n sound", "this word is to" —
  "starts with a sound" is the article); and "Which word is shown here?"
  right after the card is rejected — nothing to work out.
- **The books** (`library/BOOKS.md`): NCERT for Classes 1–5 are set up and
  waiting for their PDFs — *Joyful Mathematics* 1–2, *Maths Mela* 3–5,
  *Mridang* 1–2 and *Santoor* 3–5 (English), *Sarangi* 1–2 and *Veena* 3–5
  (Hindi) — each `book.json` with its class, subject and both titles, no
  chapters until `--scan`. BOOKS.md says where to download each and the four
  commands (unzip, `--scan`, `--batch`, read the reports).
- **On the phone** (`core/library.js`, the teacher view's `libraryHTML()`
  inside the syllabus card): the teacher picks the class's book once
  (`libSetBook()`); its chapters make the term in the book's order, which
  ↑ ↓ move to the school's calendar (`libMove()`); one chapter is this
  week's (`libSetWeek()`, *Next chapter for next week* → `libNextWeek()`).
  A chapter added to the book later joins at the end. *Open this week's
  lessons* (`libOpen()` → `libDrafts()`) fills the same draft card as an
  upload, each lesson checked again by `sylClean()` — one whose id no longer
  matches its content (edited after it was built) is shown as not used —
  so approving its aims is the same tap, and the approved lessons reach
  children the same way (the class mirror, then the class sync). The plan
  is the teacher phone's own setting (`S.libPlan`, a device field like the
  sync keys) and is never sent. No network is used for any of it.
- **Mridang Class 1, chapter 1** (*Two Little Hands*, `aemr101.pdf`) — the
  library's first English chapter, built 15 Nov through the Batch API with
  `gemini-3.8-flash` (draft and repair; every live try that day had the full
  Flash models hang or answer 503, and flash-lite's live builds kept 0–2):
  3 English lessons, each with two questions — what the nose and ears do
  (a passage about Ravi, then a line to read), and the first sound of ant /
  bag and of dog / egg (a / e, b / d: the real mix-ups). "One and to" (the
  sight words) wasn't used: its answer "to" wasn't in what the child read.
  The four live builds before it found the English checks, the book-words
  check and the "which word is on the card" rule above.
- **In the library now**: NCERT *Maths Mela* Class 3 — 42 lessons across
  all 14 chapters (built 13–15 Nov, all drafted by flash-lite). Chapter 13
  (time) was rebuilt with clocks and calendars on 15 Nov: 3 lessons, each
  with two questions read off the drawing (o'clock, minutes passed, the month
  in a date), instead of 4 sentences to read — the best of the builds allowed
  (another kept 2; two more were busy or a runaway draft and built nothing).
  Chapters 2 and 5 still keep 4 one-question picture lessons each from their
  older builds: the library's two-question rule rejects those on the next
  rebuild. 12 lessons are still taught only by a sentence to read (measuring, weighing, symmetry, a map; and three in
  chapters 1 and 9 tagged with a reading skill): Takhti has no picture for
  those topics yet, and the teacher is warned on the nine with a maths skill
  (`sylLessonWarnings()`) — the three tagged with a reading skill get no
  warning.
- **EVS, the first subject beyond maths and language** (15 Nov): NCERT *Our
  Wondrous World* Class 5 (`library/ncert-our-wondrous-world-5`, subject
  `evs`), chapter 3 "The Mystery of Food" — 5 lessons (why food spoils,
  what microbes need, drying / oil / cold, helpful microbes, chewing and
  teeth). Each is a passage with two questions whose right answers are in
  the passage (a reading lesson, `subject: 'read'`), and the science is in
  the Teach Munni aims ("explain why oil keeps a pickle from spoiling").
  **They count as EVS**: every lesson's skill is `v5-health` (health and
  hygiene), so a child's answers go to that skill's history, the twin and
  the teacher view — not to reading comprehension. `sylSkills(cls,
  subject)` offers an EVS book's EVS skills first (the library builder,
  `--import`/`--recheck` and the teacher's `libDrafts()` pass the book's
  `subject`); every other book and a teacher's own upload still leave EVS
  out. The `v5-…` skills still have no built-in concepts, so they stay out
  of the "teachable" count, and the mind picks no reading way for them. **Drafted by Claude in a chat session,
  not Gemini** (no key there): `ch3.raw.json` says `model: claude (hand-written
  draft)`, the report says "drafted by", and they went through
  `--import` and the same checker — a Gemini build (`--force --only ch3`
  with the PDF) can replace them.
- **Hindi, Class 1** (15 Nov): NCERT *Sarangi* 1, chapter 7 "वाह, मेरे
  घोड़े!" — 1 lesson, rhyming words (ताल / चाल: yes; ताल / घर: no). Its first
  build kept two lessons whose every answer was "हाँ", which the
  mixed-answers rule now rejects; two rebuilds kept one lesson each (the
  other drafts read too hard for a Class 1 child — "decodes at fluent"), and
  the rhyming one was taken with `--import` from its saved run: the other
  ("first sounds") asked back the sound its teaching line had just said.

## This child's path — `core/planner.js`

The teacher approves a lesson's aims once, for the class; each child then
gets their own path to them, worked out on the phone from what the twin and
the mind already know — nothing new measured, nothing sent:
- **already knows it** (twin mastery ≥ 0.85 over ≥ 4 own answers) → the
  school's lesson as "show you know it", then Teach Munni;
- **a gap underneath** (a prerequisite below 0.5 over ≥ 3 answers) → a
  built-in lesson for it first (perimeter → two-digit adding);
- **the way**, chosen by `mindChoose()` from this child's own record, held
  per topic, switched when it doesn't stick:
  - *shapes* (`mindDomain()` → `'shape'` for `shapes2d`, `angles`,
    `perimeter`; `WAYS.shape`): **pictures first** (a built-in drawn lesson,
    `planBuiltin()`) or **the school's story**;
  - *maths*: **the cartoon first** (the Picture Hut's episode for the skill,
    when the band has one — `planHasCartoon()`; done once watched, its card
    earned or its round open — `planCartoonDone()`) or **the school's
    story**; *show* and *steps* stay in Counting Stones, where they teach a
    missed sum;
  - *reading*: inside the school's lesson itself — **Munni reads the
    passage first** (she reads it aloud), **its hard words in pieces** (the
    two longest, `wordChunks()`, `lesChunksHTML()`), or **you read it
    first** (`S.lesson.readWay`, `LES_READ_SAY`);
- **the school's lesson** — the same for every child; after pictures or
  the cartoon it is the check, so opening it labels no second way
  (`planMarkWay()`, called by `startLesson()`, for the lesson's own skill
  only), and its answers settle whether that way worked; a reading lesson
  opens as the plan's reading way;
- **one more, at this child's level** (`planMoreStep()`, arithmetic skills
  only): the school lesson's first finish is kept (`S.lessonScores[id]
  {r, a}`, by `lesNext()`); every answer right → *A harder one* (a skill
  one up, whose prerequisites include this one, the same operation where
  there is one, inside the band), one missed → *One more, a little easier*
  (a prerequisite, else the same skill) — never a two-operation sum. Its
  button opens Counting Stones on that skill's `skillProblem()`
  (`S.planMore` → `S.ctx.planMore`); the answer sets `x` (`y`/`n`) and the
  step is done;
- **Teach Munni** on the approved aims.

Each step says why, from the child's own record ("this has worked for you
before"), in Hindi and English. A step's status is read from what is kept
(`S.doneLessons`, `S.lessonScores`, `S.teach` units' `lessonId`) — the plan has no state of
its own. The next step is the first one not done *after* the last one
done, so a step skipped on the way (the school's lesson opened straight
away) doesn't come back.

**The teacher sees the paths** (`planTeacherHTML()`, under the syllabus
card): per approved lesson, the class grouped by path — already knew it,
something underneath first (the skill), pictures / the cartoon / straight
into the school's lesson, or the reading way — each child with steps done
of how many. A path travels as `planPathOf()` → `{w, k, g, d, n}` (the way,
knew it, the gap's skill id, steps done, steps) in the class mirror
(`planPathsOf()`, at most 12 lessons) and the class sync, under the same
*Sync automatically* consent; the server keeps only lesson ids `sch-…`, a
known way, a real skill id and d ≤ n ≤ 6. A path is how, not how well —
never compared or ranked.

## The demo class — `core/demo.js`, `DEMO.md`

A new child has no record, so every new child gets the same path. The
teacher view's **Demo class** card (`demoHTML()`, behind the PIN) adds two
children — *Asha (demo)* and *Kabir (demo)*, flagged `demo`, age 8, linked to
the open class — whose records differ and are written by the app's own
functions, not set by hand: settled `mindTaught()`/`mindAttempt()` rounds
(pictures, the cartoon and hard-words-in-pieces stick for Asha; the story
and Munni-reads-first for Kabir) and, for Kabir, `twinAnswer()` twice on two
different borrowing sums with the smaller digit taken from the bigger, so
`twinHabit('borrow')` is real and Teach Munni's Munni makes his mistake.
Both have also taught Munni borrowing once through Teach Munni's own session
functions (`demoTeach()`): Asha couldn't say what a borrowed ten becomes,
took *Let's learn it again*, then could (`grc`); Kabir couldn't say when to
borrow and has been re-taught, Munni still to ask him (`gr`) — so the
teacher's loop line has something real to show.
Never synced (`syncOn` stays off); needs two free profile places and says so
when there aren't; `demoRemove()` deletes exactly the flagged children from
the phone and this phone's class mirror. When the approved lessons change
(`sylApprove()`…), `sylRemirror()` writes every class child on this phone
into the mirror, so the teacher's path card is right at once. `DEMO.md` is
the step-by-step script, with what is real and what is staged.

## Shapes — `content/geometry.js`

Takhti draws shapes and checks shape questions the way it checks sums: the
answer must be readable off what is on the screen.

- **The picture registry** (top of `geometry.js`): every beat whose answer
  is read off its drawing registers a kind (`picRegister()`: expect, errors
  for the band, askError, sig, asks, art, sayBoth/say, hint, clean, and
  optionally said, tidy, aimKeys/aimNeed, warnings). `validateLesson()`,
  `sylClean()`/`sylTidy()`/`sylAimGaps()`/`sylLessonWarnings()`, the lesson
  player (`picArt`, `picSay`, `picFor`), Ask Munni (`picHint`,
  `explainLessonBeat()`) and the games' pool (`picFor`) ask the registry, so
  a new kind of picture is wired everywhere a shape is. Shapes and clocks
  are registered; shape-only rules (`sylAskAnother()`, the folds, the
  look-alike, a question naming its shape) stay shape-only.

- **Three beats**, drawn as SVG by `geoArt()` (to scale, theme-coloured):
  `figure` (a square with side `s`, a rectangle `w`×`h` with w ≠ h, a
  triangle `sides:[a,b,c]` that can exist, a circle with 0–4 `folds`),
  `corner` (`deg` 20–160) and `figures` (2–4 shapes or corners in a row,
  numbered 1–4, no side labels there). Side lengths are labelled, except
  while sides or corners are being counted; a teaching picture (no
  question about it) marks its corners, a square corner's box, the centre.
- **What a question asks is on the picture**: a figure's `ask` (name,
  sides, corners, perimeter, equal, meet), a corner's `ask:'kind'`, a
  row's `find` (square, rectangle, triangle, circle, squarecorner, odd).
  A square corner is in a 90° corner, a square, a rectangle or a right
  triangle (3-4-5), so a row of shapes may hold only one of those; a
  triangle with a corner within 15° of square that isn't one can't be in
  such a row (`geoSquareCorner()`).
  `geoExpect()` works the answer out from the drawing; `geoAskError()`,
  called by `validateLesson()` for every lesson, rejects a marked answer
  (English or Hindi, read by `geoSays()`: वर्ग, आयत, चौकोर कोना, केंद्र…)
  that isn't it, or a second answer that also is; `geoErrors()` rejects what
  can't be drawn and numbers over the band's ceiling.
- **In the player**: a question's picture stays on screen (`geoPicFor()`),
  its narration never names or measures the answer (`geoSay()`), Ask Munni
  gives how-to-look help (`geoHint()`, never the answer;
  `explainLessonBeat()` stops at a shape), and such questions never enter
  the arcade games.
- **27 built-in lessons** (`GEO_CONCEPTS`): counting sides and corners and
  finding a shape in a row (5–6), square corners and the centre of a circle
  (7–8), perimeter (9–10) — making `perimeter` and `angles` teachable and
  adding to `shapes2d`. Gemini's school lessons use the same beats
  (`sylClean()` → `geoClean()`, the prompt describes them).

## Clocks — `content/clock.js`

The clock is drawn, and the time is read off the hands, the way shapes are.

- **Two beats**, drawn as SVG by `clockArt()` (theme-coloured, the hands at
  exactly h:m — half past 3's hour hand half way to the 4): `clock {h, m}`
  and `clocks {from, to}` (start → end, labelled in the child's language).
  A teaching pair of clocks shades the minutes that passed.
- **What a question asks is on the picture**: a clock's `ask:'time'`, two
  clocks' `ask:'minutes'` or `'hours'` (whole hours only). `clockExpect()`
  works the answer out; `clockAskError()` rejects a marked answer that isn't
  that time — read in English and Hindi by `clockRead()` ("3:20", "half past
  9", "quarter to 4", "20 minutes past 3", "साढ़े 3 बजे", "सवा", "पौने",
  "डेढ़", "ढाई", "3 बजकर 20 मिनट", "बजने में", Devanagari digits; "20 hours"
  is not 20 minutes) — or a second answer that also is.
- **The band's clock** (`CLOCK_STEP`): no clocks at 3–4; 5–6 o'clock only
  ("half past 10" is also too long an answer for them to read); 7–8 every
  five minutes; 9–10 any minute. Minutes passed over the band's ceiling →
  ask hours. Each is rejected with why.
- **In the player** the clock stays on screen during its question; a
  question's clock is never read aloud ("Look at both hands"); a teaching
  clock says its time; Ask Munni says how to read it ("first the short
  hand… then count the long hand in fives"), never the answer; no clock
  question goes into a game; the SVG's label never says the time.
- **28 built-in lessons** (`CLOCK_CONCEPTS`), each wrong answer a real clock
  mistake: o'clock (5–6, `clockhour`, the 12 lessons that were in
  `literacy.js` — whose clock drew the minute hand at 12 whatever the time
  and said the hour just before asking it — same ids, now with a teaching
  clock), o'clock and half past, quarter past and to, five-minute times,
  and time passed (7–8) — making the new Class 3 skill `time3` teachable
  and teaching `time2`.

## Calendars — `content/calendar.js`

The months and a month's page are drawn, and the answer is read off them.

- **Two beats**, drawn as SVG by `calArt()`: `months` — the twelve months in
  order, three across and four down (on a 360 px phone the Hindi names stay
  ~13 px), each with its number, optionally a date printed above as a birth
  certificate does (02/05/2015) — and `calendar` — one month's page, a column
  for each day of the week (`start` is the day of the 1st).
- **What a question asks is on the picture**: months `ask` — `name` (which
  month is number m, or the month in the printed date), `number` (the numbers
  are hidden), `after` / `before` the marked month, `later` (k months after;
  the question must say k, in both languages — the picture can't), `count`
  (months from m to m2); calendar `ask` — `weekday` (the marked date's day),
  `count` (how many dates in the marked day's column — "how many Sundays?"),
  `later` (k days after the marked date; "a week later" is 7). `calExpect()`
  works the answer out; `calAskError()` rejects a marked answer that isn't it
  (months and days read by `calMonthRead()`/`calDayRead()` in English and
  Hindi — May/मई, फ़रवरी/फरवरी, सितंबर/सितम्बर, Sunday/रविवार/इतवार) or a
  second answer that also is.
- **The band**: months are numbered to 12, so none at 3–4; a month's dates go
  to 31, so the page is for 7–8 and up. A printed date's year is a label on
  the certificate, never an answer or a number worked with.
- **In the player** the picture stays on screen during its question, a
  question's picture is never read aloud ("Look along the months, one at a
  time"), Ask Munni says how to look ("find the middle number of the date"),
  never the answer — not even "after December comes January" — and no
  calendar question goes into a game.
- **20 built-in lessons** (`CAL_CONCEPTS`), each with two questions and each
  wrong answer a real mistake: the order of the months (the month before, for
  after; January counted as 0), months later and between (one short, one over),
  the month in a date (the day read as the month), a date's day and how many
  Sundays (the next column; the last row missed), a week later (one day later)
  — making the new Class 3 skill `calendar3` teachable.

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
- **Alignment takes the best of match or skip.** An alignable word pair is an
  option, not an obligation — otherwise a child who read two words and
  stopped had a later look-alike word steal the alignment (scored 27, not 40;
  see the "stopped after two correct words" row in `test/matcher.test.js`).
- **The pass bar moves with age**: `gradeVerdict()` uses the band's own
  `passScore`/`gateScore` (`content/ages.js`). Don't hardcode a threshold
  elsewhere.

## The skill graph

`SKILLS` (`skills.js`, extended by `curriculum-early.js`) tags every attempt
with the skill it really exercises, so a failed BODMAS question can be traced
to the prerequisite underneath. **Verified numbers** (`test/comprehension.test.js`,
the one suite that loads the full graph): 57 concepts → 564 lessons, 0
rejected; 105 skills after dedup (128 raw, 23 absorbed); 59/105 = 56%
teachable (`test/diagnose.test.js`); Nursery–Class 3 subject coverage 63/63;
reading and writing ladders 6/6 each; 517 game-pool items (shape, clock and
calendar questions stay out of the games — their answer is in a picture a game can't
show; the 12 o'clock questions that were in the pool are out now).

## Two fixes worth knowing (15 Nov)

- **The writing pad** (`setupPad()`, `handlers.js`) uses pointer events
  (mouse, finger, stylus) and keeps the strokes in `S.ctx.strokes`, so a
  re-render while a child draws (narration ending, a sync) draws them back
  instead of handing over an empty canvas; *Clear* empties them.
- **"Show me"** (`playMath()`) waits for each spoken line (`mathSay()`, with a
  timeout so a silent voice can't stall it) before the next step: `speak()`
  cancels whatever is playing, so the old fixed timers cut every line off and
  the child heard only the answer. Rows are counted out (4, 8, 12…) in the
  array; leaving the screen or pressing again stops the old run.

## How a new build reaches a phone (20 Nov)

The live link's first screen stayed old after a redeploy, and the Story Fire
and Picture Hut broke: the service worker filled its new cache through the
browser's HTTP cache, and the server let scripts be kept for an hour, so a
phone that had just visited stored the new `index.html` beside the old
scripts — two builds at once, served cache-first until the next bump. Now
`sw.js` caches the shell with `cache: 'reload'`; `cloud/server.mjs` sends
every file `no-cache` with an ETag (a 304 when unchanged; only a hash-named
audio clip is kept); and `index.html` registers the worker with
`updateViaCache: 'none'` and reloads into a new build when its worker takes
over — only on the first screen or the map, never in a lesson or a game.
`test/cloud.test.js` checks all three.

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

## How this child learns — `core/mind.js`, `ui/mind-ui.js`

A class teaches thirty children one way; Takhti keeps, for each child, which
way of teaching actually works for *them*, topic by topic, and changes it
when it stops working.

- **Measured, not guessed.** No "learning style" label (matching lessons to
  VARK-style types hasn't held up in research). The ways are the ones the
  app really has (`WAYS`): maths — *show* (the objects animation), *steps*
  (`explain.js`), *story* (a lesson), *cartoon*; reading — *model* (Munni
  reads first), *chunks* (hard words in pieces), *solo*; shapes — *show* (a
  built-in drawn lesson), *story* (the school's lesson). A school lesson in
  any of the three gets its way from **This child's path**.
- **Every teaching moment is labelled** (`mindTaught()`): "Show me", Ask
  Munni, a story lesson, a cartoon, the Reading Tree's way for the line.
  The next answers the child gives **on their own** on that skill settle
  the round — it stuck (2 right) or didn't (2 missed) (`mindAttempt()`,
  called from `noteSkillAttempt()`, Counting Stones and `checkRead()`).
  Helped answers never count.
- **A plan per topic** (`mindChoose()`, Thompson sampling over Beta
  counts): it holds while it works; two rounds that don't stick switch it
  and cool the old way for a week; the change and its reason are kept
  (`m.changes`). A topic never taught starts from what has worked across
  the subject at half weight — it grows with the child.
- **School marks** (`mindAssessment()`): a parent types them on the
  dashboard; a class teacher enters a class test on the class page
  (`recordMarks()`, `voice/circle.js`) and it arrives with the circle sync.
  Under half marks: the way switches at once, the topic becomes "Munni's
  idea" (`mindNext()`) and, on the server, next week's step (`chooseFocus()`
  source `'school test'`).
- **Where it shows**: a missed sum in Counting Stones is taught the plan's
  way (animation, Ask Munni's steps with the answer — `askTeach()` — or
  "Munni's idea: let's learn this with a story/cartoon"); practice leans
  half the time to the focus topic (`mindPracticeProblem()`); the Reading
  Tree reads the line first or shows hard words in pieces
  (`mindReadWay()`, `AFTER.read`); a "Munni's idea" card on the map; the
  parent dashboard's **How … learns** (what works, how each topic is taught
  now, what changed and why, school marks), in Hindi and English.
- **Stays on this phone**: `S.mind` and `S.assessments` are never in the
  circle's sync body (the test checks).

## How this child thinks — `core/twin.js`, `core/lang-mistakes.js`, the mistakes in `core/mathgen.js`

The mind learns *how to teach* a child; the twin keeps a picture of *how
the child thinks*, from their own answers only, in all three subjects.

- **Sum mistakes, open-ended.** `core/mathgen.js` works a sum the way a
  child really does, column by column (`PROC`: the carry dropped, written
  in, or the ones carried; the smaller digit from the bigger; a borrow that
  never leaves the tens; borrowing across a zero; 0 − N = 0; N − 0 = 0; the
  shorter number lined up on the left; the carry in multiplying dropped,
  written in, or added first; the answer's digits reversed). Each single
  wrong step is a named mistake (`MISTAKES`, with `countincl`, `adddigits`,
  `wrongop`, `divmult`, `lefttoright`, `groupcount`, `tensnotx`, and the
  slips); **any combination** of them (`procAnswers()`, codes like
  `+|carry=none|out=rev`) is a mistake the engine can name
  (`mistakeLabel()`), help with (`mistakeTip()`) and explain
  (`mistakeExplain()`) from its steps. `whichMistake()` names a single one;
  `procMatches()` finds the combinations behind any other answer.
  **Never the final answer** in a tip or an explanation (the test checks
  thousands). `genProblem()` puts real mistakes among its options.
- **Found, not guessed.** The twin keeps a combination as this child's own
  (`tw.found`) only when it explains answers to two DIFFERENT questions;
  what nothing explains is kept (`tw.unexplained`, sum and answer only).
- **Reading and writing mistakes** (`core/lang-mistakes.js`): a word
  (`wordMistake()`: vowel-sign length, a vowel sign left out or swapped, the
  nasal dot, aspiration क/ख, tongue position ट/त ण/न, श/ष/स, ब/व, a half letter
  dropped or pulled apart, look-alike letters, guessing from the first
  letter; b/d and was/saw, the vowel, the silent e, endings; a nukta is the
  recognizer's, not the child's), a line (`lineMistakes()`: skipped, added,
  stopping before the end), a traced letter (`inkMistakes()`: mirrored, part
  left out and where, the शिरोरेखा missing, much too small, off the guide,
  wandering), typed-back paper writing (the word checks, as spelling).
  `langTip()` is the help, `langLetters()` the letters to hear side by side.
  `twinNote()` keeps them. **Games** name a picked answer too, when the
  item has a sum under it (`twinGameAnswer()`, from runner and tower).
  **Calls** name mistakes on the server's twin; they come back to the app
  with a talk's results and the circle's sync (`twinFar()`, deduped).
- **A habit** (`twinHabit()`): the same mistake twice in the last eight
  answers on a skill, within two weeks, not followed by three right in a
  row (one-away slips never). **A habit decides the explanation**: a missed
  sum that is the habit is taught straight at it (`mindTeachMath()` →
  `askTeach()` with `mistakeExplain()`), Ask Munni's steps become the
  explanation for the habit, a line with the letter gets a heads-up first
  (`twinHeadsUpHTML()`) and the next lines lean to it (`twinPickLine()`),
  `mindNext()` goes at it.
- **What they know, and how it fades** (`twinObserve()`, `twinMastery()`):
  Bayesian knowledge tracing per skill (slip 0.1, learn 0.15, guess = one
  over the options), fed by every own answer. Half-life 4 days doubling for
  each different day it was got right, never below half. **It is the number
  decisions use**: `appEvidence()` (so the diagnostic, homework, the teacher
  view) reads it for this phone's own evidence once the twin has seen the
  skill as often as the counts — and the games' choice of items; the raw
  counts still travel in codes and the circle's sync, where another phone
  has no twin. One deliberate exception: the **level ladder** (which rung
  of lines and sums to serve, `record()`'s last-five window) still moves on
  recent answers, so a child who is improving moves up the same day; the
  twin's number is per skill and slower by design.
- **A guess before every answer** (`twinExpect()` at render, `twinCheck()`
  after): sums in Counting Stones, cartoons, the Friday check and story
  lessons (the exact answer: right, the habit, a found combination, a seen
  mistake or the most telling one); story questions without a sum, games,
  reading lines and traced letters (right or not). In the judge trace before
  the answer, never shown to the child; a helped answer keeps nothing.
  **Calls guess too** (`guessFor()`/`guessCheck()` in `session.js`: the
  call's trace and the server twin's record; with the circle's tick they
  join the app's score, `twinFarGuesses()`). `twinScore()`: exact guesses
  lately and at the start, and right-or-not.
- **The profile** (`twinProfile()`, `twinCleanProfile()`, `twinPrompt()`):
  ids only (band, language, ways, plans, habits, fading, working, knows,
  found combinations, letters to practise, up to ten unexplained sums) — no
  name, no id, checked on both ends. It goes **with the circle's sync** (the
  parent's tick; the notice says so in both languages), **with a Talking
  Munni or help call** (the parent's switch; its notice says so), and as
  sentences into the **on-device model's prompt** (Tier 1) and **Tier 2's**
  question (only when a parent shared progress). On calls (`planSession()`):
  the first free sum goes at a habit or fading skill (`'twin'` slot), a slip
  that is the habit gets "I know this tricky bit!" and its help, a child
  taught step by step hears the reveal step by step (`stepsWhy()`), reading
  lines carry the letters, reading coaching names the slip (`readTip()`); a
  child with no app gets the same from the server's own twin.
- **The shared mistakes database** (`voice/mistakes.js`): found
  combinations and unexplained sums from synced profiles, counted by a keyed
  hash of the child (never names); a combination in
  `TAKHTI_MISTAKE_MIN_CHILDREN` children (3) is promoted and comes down every
  sync (`mistake_rules` → `S.mistakeRules`, device-level, codes checked by
  `procValid()`) — every app then knows it from the first sighting; the team
  reviews the rest at `/voice/admin/mistakes`. An erased child leaves every
  count.
- **Where it shows**: after a slip, the help for it ("Munni noticed this
  happened before" for a habit; letters to hear for reading); the parent's
  **How … learns** now ends with **How well Munni knows how … thinks**
  (`twinParentHTML()`: the guess scores, knows well, getting there, fading,
  the mistakes she keeps seeing in all three subjects, a mistake she worked
  out herself), Hindi and English.
- **Stays on this phone**: `S.mind` and `S.twin` themselves are never in the
  sync body — only the checked profile (the tests check exactly which keys).

## The reading check — `ui/cloud-read.js`, `ui/say-it.js`, `voice/speech.js`

**Why the voice server, not the phone.** Phones do have recognizers: Android's
on-device speech recognition (offline language packs, Hindi included on
many phones; `SpeechRecognizer.createOnDeviceSpeechRecognizer`, Android 12+),
Apple's on-device speech, and Chrome's on-device Web Speech
(`SpeechRecognition.available()/install()`, `processLocally`). All of them
are built for adults dictating and write down *dictionary words*: a child's
"बाई" for "भाई" comes back as "भाई", and the slip — the thing to teach —
is gone. The voice server's speech provider writes down what was *said*.

**The speech adapter** (`voice/speech.js`, 12 Nov 2026): every voice Takhti
hears or makes goes through two functions, `checkReading(clip, passage,
lang)` and `narrate(text, lang)`. `SPEECH_PROVIDER=gemini|sarvam` in
`voice/.env` picks the provider, **default gemini** (the Google buildathon);
Sarvam stays as the backup — its code is `voice/asr.js`, unchanged, and is
the whole reading check again the moment the setting says `sarvam`.
- **Gemini hears** (`GEMINI_SPEECH_MODEL`, default `gemini-4-hydrogen`): the
  clip as inline audio, structured output `{ said, words:[{word, said}] }`,
  told to write what it HEARS ("बाई" for "भाई" stays "बाई"). Asked to think
  little (`thinkingConfig.thinkingLevel`, `TAKHTI_THINKING`, default `low`; a model
  that refuses the field is asked again without it) — the judge too; and
  `GEMINI_HEAR_LINE=0` sends no line at all. The response
  keeps the shape the reading check always had — `{ transcript, provider }`,
  `words` extra — and the phone still grades it with its own matcher.
- **The passage is the server's own**: the phone names the line it showed;
  the server uses it only if it is one of the app's own `SENTENCES` (or a
  word of one, for "say it with Munni") — `knownLine()` in
  `voice/server.js`. Anything else is heard without a line.
- **The order**: `gemini` → Gemini, then Sarvam if set up; `sarvam` →
  Sarvam only (that setting exists for the day Gemini mishears children
  reading Hindi, and a mishearing gives wrong marks). Both inside
  `TAKHTI_SPEECH_BUDGET_MS` (9 s, under the phone's 10 s). Neither answers →
  `{ skipped: true }` (503): the phone says so kindly, the typed fallback is
  there, and the line goes in `S.readAgain` (the line only, never the
  recording) — the Reading Tree offers it next time (`readAgainNext()`).
  Clamped inputs, a per-address limit, nothing kept: no clip, no
  transcript, no audio on the server.
- **Teach Munni** hears an explanation through the same `checkReading()`
  (no passage), in the same order, before Gemini judges it — or first by
  `TAKHTI_TEACH_HEAR` (gemini | sarvam), falling back to that order: an
  explanation is judged on meaning, so a provider that tidies slips (too
  risky for readings) is fine for it.
- **Munni's voice** (`narrate()`): built ahead with **Gemini TTS**
  (`GEMINI_TTS_MODEL`, default `gemini-3.8-flash-tts`, from Google's
  speech-generation guide; voice `GEMINI_TTS_VOICE`, Kore) through the
  **Batch API** (`narrateBatch()`, half price) by `tools/build-audio.mjs`,
  and shipped offline — mp3 where the machine has ffmpeg, else WAV with
  `x:'wav'` in the manifest (`core/voice.js` plays either). At run time:
  the pack → the live backup (`POST /reading/tts`, Sarvam/ElevenLabs only,
  never Gemini; `playLive()`, ≤ 2.5 s) → the phone's own voice.
- **Day 1**: `tools/compare-speech.mjs` runs a folder of real recordings
  through both providers and prints where each misjudged a word (a slip
  missed, a slip invented, against a person's `.truth.txt`), and whether to
  switch the reading check to Sarvam.

- **The terms, once, at onboarding** (`voiceTermsHTML()`, a grown-up step
  before the learning circle's, only with a voice server): what goes (a
  line read, a word said after Munni, a Teach Munni explanation), to whom
  (Takhti's voice server and Google's Gemini — the paid tier, so Google
  doesn't train on it — with Sarvam AI as the backup), that neither
  recording nor words are kept, how to withdraw — in Hindi and English, one
  "I'm the parent or guardian, and I agree". Kept as `S.voiceTerms {v, at,
  by}` (`VOICE_TERMS_V` = **3**, 12 Nov 2026: Gemini named as a processor).
  **Every online check needs v3**: a family that agreed to v1/v2 agreed to
  Sarvam only, so until they agree again (the parent page offers the new
  terms) everything stays on the phone. The wording is for the lawyer —
  not final. Not a switch. The parent
  page shows the agreement and can **withdraw** it (the law's right, DPDP
  s.6(4)); withdrawn, nothing leaves the phone.
- **Who hears a turn** (`startListening()`): online with the terms →
  the voice server (`cloudListen()` → `POST /reading/asr`), even where the phone has
  its own recognizer; offline → the phone's on-device recognizer
  (`listen()`), else typing; with a voice server and **no** terms, only the
  on-device recognizer — a general cloud recognizer never hears the child.
  The text is graded **on the phone** by the matcher; `S.ctx.heardBy` says
  who wrote it down. The recording is not kept anywhere.
- **Say it with Munni** (`say-it.js`): after a slip (a word read wrong
  starts it at once; an "almost" word on a pass offers a button) Munni says
  the word, its pieces slowly (akshara: भा · ई; syllables in English), the
  help for HOW it slipped (`langTip()`), the word slowly, at speed, then
  "now you say it". The child says it → the voice server writes it down → `gradeWord()`.
  Right → "Yes! That is exactly it!" and "read the whole line again"; not
  yet → the pieces again, slower, with the help for the new slip; after two
  tries, "we'll say it again next time" — never "wrong". Help, not evidence:
  nothing recorded, only `mindTaught(…, 'chunks')`.
- **Munni's voice** (`sayVoice()`): pre-rendered files (Gemini TTS,
  `tools/build-audio.mjs`: every word of every reading line, its pieces,
  her coaching lines) played offline by `core/voice.js`, slowed for pieces;
  a line not in the pack → the live backup, Sarvam (`POST /reading/tts`,
  short teaching lines only, cached); else the phone's own voice.
- **On calls** the same teaching: a misread word is said in pieces, slowly,
  then whole ("भा… लू… भालू", `wordPieces()` in `session.js`), with the
  help for how it slipped.

## Ask Munni — `ui/ask-munni.js`, `core/explain.js`, `voice/help.js`

Help with the question in front of the child, like a voice assistant that
only knows this one question.

- **The button.** A round 🐘 *Ask Munni* button floats (`askFab()`, called
  by `render()`) on any screen that is asking something: Counting Stones,
  the Reading Tree, a story lesson's question, a cartoon's "your turn".
  Never on the map, and not on Munni's Friday check (that is the week's
  measure). `askTarget()` says what is being asked.
- **One tap: instant help, on the phone.** `explainMath()` /
  `explainRead()` / `explainLessonBeat()` break the question down the way
  a teacher would — fingers, make ten, tens then ones, the carried ten,
  borrow a ten (ones first), groups and skip-counting, split a two-digit
  number, multiply first — or a hard word in akshara pieces then the whole
  line. Munni says each line (`speak()`) as it appears in the help sheet.
  **She never says the final answer**: the last line asks it, and the
  child answers on screen; a step that lands on the answer by itself
  (65 − 25: the tens leave 40) is asked, not told, and "put them
  together" then names no numbers; a sum times 1 is "just one group",
  never "one group of 7". On the call, that step is asked too, and its
  reveal after two tries still explains it ("60 take away 20 leaves 40").
  No network, so it works offline.
- **Still stuck? Munni calls.** With the parent's Talking Munni switch on
  and a signal, *Still stuck? Talk to Munni* opens the same live web call
  as Talking Munni (`talkHelp()`), about this one question. The server
  (`voice/help.js`, `planHelp()`) plans the SAME steps from the same
  `explain.js` and asks them one at a time ("first the tens: thirty and
  twenty?"), with the usual clue and kind reveal, then the question itself,
  then "now tap it on the screen too". The panel shows the step and, after
  a slip, the two choices as buttons. The phone only sends what the
  question is (and the id of a mistake the child keeps making on it, one
  of `MISTAKES`, if any — see **How this child thinks**): the server recomputes every number, a reading line must be
  one of the app's own `SENTENCES`, a lesson beat comes from its own lesson
  bank — anything else is refused (`cleanHelp()`), so nothing the phone
  makes up can be put in Munni's mouth. Its own daily limit
  (`TAKHTI_HELP_DAILY`, 6). Leaving the screen ends it.
- **Help is not evidence.** Help steps are never recorded, and the answer
  the child gives on screen after help isn't either (`S.ctx.helped`,
  `S.lesson.helpedAt`, `activeVideo.helpedAt`): no `record()`, no skill
  attempt. The next question is the child's own again.

## Teach Munni — `content/teach.js`, `core/teachback.js`, `ui/teach-munni.js`, `api/teachback.mjs`

Elephants never forget. Munni does, on purpose: after a lesson she
"forgets" its **aims** and the child teaches them back out loud — the
protégé effect, and the one place a child gets to *say* what they learnt.
(This is KidMonk's "Forgetful Monk", folded into Takhti.)

- **A unit is one topic's aims** — 3–5 plain points a teacher would
  approve ("knows to borrow when the top ones digit is smaller"). Built in
  for `add10`, `carry`, `borrow`, `place2` (`TEACH_UNITS`); any other maths
  skill with a sum gets Munni's sum alone (`teachUnitBuiltin()`); a school
  lesson brings the aims Gemini drafted and the teacher approved (below).
  `teachUnitFor(les)` prefers a skill with written aims (a bar-model
  take-away is borrowing too). None for the 3–4 band.
- **Everything Munni says is written ahead**, in Hindi and English: per
  aim her puzzled question (`forget`), two hints, and the `ideas` a full
  explanation contains, each with the words that show it (English, Hindi,
  romanised Hindi). **Never the answer, checked**: `teachCheckAim()`
  rejects an aim whose question or either hint would already pass the
  offline judge as the explanation — every built-in aim and every drafted
  one goes through it (the test checks all of them).
- **Munni's sum** (`kind:'fix'`, `teachFixFor()`): a `skillProblem()` sum
  worked with a real mistake — **this child's own habit** when the twin has
  one (`twinHabit()`; on a school lesson, a habit on the next skill up counts —
  borrowing for a two-digit taking-away lesson, whose own sums never borrow), else the skill's commonest (`TEACH_FIX_DEFAULT`) —
  in her own words (`TEACH_ACTS`, never the right answer: checked over
  every skill, three ages and many sums). The child taps the right answer
  of three, then explains her slip, judged against what that mistake needs
  (`TEACH_FIX_IDEAS`). The first tap is **real evidence**
  (`noteSkillAttempt()`, and `twinAnswer()` when the child agrees with her
  mistake); a nudged tap isn't.
- **The session** (`teachBegin()` / `teachHeard()` / `teachPick()` /
  `teachFinish()`): one aim at a time. Covered → a chip turns green and she
  thanks them; partly or missing → hint 1, then hint 2; still not →
  "we'll figure it out together later" (never "wrong"); `unsure` (too few
  words) costs nothing — ask again. One explanation can cover later aims
  too. Leaving half way keeps what was taught (`teachFollow()` in `go()`).
- **Explanations are their own measure**, not mastery: they go to
  `S.teach` (units with their gaps, the last result per aim, a log of
  sessions), never into the twin's numbers — a child who can do it but
  can't yet say it is not a child who can't do it.
- **Gaps come back**: the summary's *Let's learn it again* teaches the
  gap's skill the child's way but **not the way just used** (`mindGoWay()` with
  `mindChooseOther()`: the best of the other ways; the plan itself stays, the
  next answers on their own still decide); a school reading aim replays its
  lesson in another reading way (Munni first, in pieces, on your own), and the Story Fire shows **"Munni forgot
  again!"** (`teachAgainHTML()`), which asks only the aims still to teach.
- **How Munni hears** (`teachMic()`): online under the current reading terms
  (`S.voiceTerms.v >= VOICE_TERMS_V`, v3; the parent page offers the new
  terms to an older family): the recording (`cloudListen()` with
  a longer turn) goes to `POST /teach/judge` on the voice server, written
  down by the speech adapter (`voice/speech.js`: Gemini, Sarvam as backup), then judged
  by Gemini (`api/teachback.mjs`, `judgeCore()`). **Its models**
  (`judgeModels()`): `TAKHTI_TEACH_MODEL`, else `GEMINI_MODEL`, else
  `gemini-4-hydrogen`, which gets the first 6 s (`TAKHTI_TEACH_FIRST_MS`;
  the 20 Nov live check timed it at 3.0–4.5 s; a 503/429/404 moves on at once), then `TAKHTI_TEACH_FALLBACK`
  (default `gemini-3.5-flash-lite`; `none` switches it off) for the rest of
  the 9 s — the live checks found the full Flash models busy or silent while
  flash-lite judged all four test explanations right in under 2 s.
  `tools/live-check.mjs` measures each model alone (fallback off).
  **A build with no voice server** (the Netlify link, 15 Nov 2026): with a
  signal and the **words terms** (`S.teachWords {v, at, by}`,
  `TEACH_WORDS_V` = 1, `TEACH_WORDS_TERMS` EN/HI: only the words go — typed,
  or written down by the phone's own recognizer — never a recording or a
  name; Takhti's server and Google's Gemini, paid tier; nothing kept;
  withdrawable), the words go to the host's own judge (`TEACH_URL`,
  `/api/teachback`, `teachJudgeUrl()`), the same `judgeCore()` and quote
  check. The terms are asked where they are needed — a grown-up's card on
  Teach Munni the first time a child teaches Munni with a signal
  (`teachWordsCardHTML()`; *Not now* keeps the phone judging for that
  session) — and on the parent page (`teachWordsParentHTML()`: agree, or
  withdraw in two taps); not at onboarding. Without a signal the screen
  says Munni checks it on the phone and Gemini does with a signal (the demo
  toggle starts in airplane mode). Otherwise the phone's
  on-device recognizer or typing, and the **offline judge**
  (`teachRubric()`: covered when every idea has a word). Typed words go to
  the judge too when the terms allow it. No answer in time → the honest
  message and typing; the lesson never waits.
- **The judge never writes a word the child hears**, and must **quote the
  child** for every aim it credits: a quote not in what the child said, or
  only repeating Munni, is downgraded (covered → partly → missing), on the
  server (`grounded()`) and again on the phone (`teachApplyJudge()`). A
  built-in aim is read from the **server's own copy** of `content/teach.js`
  (a fix aim's ideas from the mistake's id), so a phone can't put words in
  the prompt; a school aim is clamped and passed as data; the child's
  words are labelled as data, not instructions. Nothing is kept. No
  Gemini key, or Gemini failing → `judge: null` and the phone's rubric
  decides. The Netlify function (`api/teachback`) takes a transcript only;
  `netlify.toml`'s `included_files` ships `src/content/teach.js` with it,
  and `knownAims()` looks beside the file, under `LAMBDA_TASK_ROOT` and the
  working folder — without it a Munni's-sum point couldn't be judged there.
- **What the phone sends**: the points still to teach, the band's ages,
  the audio or words — no name, no id.
- **On a phone call** (`voice/session.js`, the `teach` slot, 13 Nov 2026):
  `voice/takhti-core.js` loads `content/teach.js` and `core/teachback.js`
  unchanged, so a call runs the app's own session — `teachBegin()`,
  `teachHeard()` (the offline rubric on the words the voice model passes),
  `teachFinish()` into the child's own `profile.teach`. `planSession()` adds
  `teach` as the last slot (ages 5+) when a built-in unit fits the child's
  band, on the first of: the call's homework skill, the twin's habit, the
  Friday check's skill, then a unit skill the child has practised ≥ 3 times
  (most practised first) — with at most two `explain` aims not yet covered
  (`s.teach_plan`); no `fix` aims on a call (a phone can't show three
  answers). Covered → praise; partly or missing → hint 1, hint 2; still not
  → "later"; not heard twice → "let's try the next thing", nothing counted.
  Never evidence of mastery (the skill history is untouched — the test
  checks). The parent report says how many points the child taught Munni
  (`teachAll`/`teachSome`/`teachNone`, never "wrong").
- **At home** (`voice/circle.js`, `homeAim()`): when the week's step has a
  built-in unit, the circle's Wednesday "teach" activity is Munni's own
  question for one aim, her first hint as a clue and what a full answer says
  (the aim's ideas), in both languages, with `aim` on the activity — a point
  the child's record (`profile.teach`, which calls now fill) says they
  couldn't yet explain comes first. Other steps keep the old activity.
- **School lessons' aims** (`core/syllabus.js`): one format for both jobs —
  the syllabus prompt asks Gemini for 1–4 aims per lesson (required), each
  a `point` the teacher approves plus Munni's lines; `sylClean()` runs
  `teachCleanAims()`, drops a failing aim with its reason (`aimErrors`,
  shown to the teacher), rejects a lesson left with none, and keeps the rest
  **inside the lesson's id** (an aim edited on the way changes the id, so
  no phone shows it). The teacher approves the points first ("Approve these
  aims"), Munni's questions folded underneath.
- **Where it shows**: the end of a lesson (*🐘 Teach Munni*), the Story
  Fire, the parent's **How … explains** (`teachParentHTML()`: points
  explained, without a hint, in their own words, the lesson's words used,
  the last sessions, "never compared"), and the teacher's **What the class
  could explain** (`teachTeacherHTML()`: per aim, explained / partly /
  still to come, the hardest first) — and **the loop**: per point, where
  each child started, whether Munni taught it again, where they are now
  (`S.teach.loop`, `teachLoopNext()`: `c` first time; `g`/`p` a gap; `gr`
  re-taught by *Let's learn it again* (`teachMarkRetaught()`); `grc`/`grp`…
  re-taught then asked; `gc` asked again without re-teaching), counted by
  `teachLoopCounts()` into one line for the class ("points children couldn't
  explain the first time (3): 1 explained after Munni taught them again…")
  and, per point, who is where by name. **Doing it next to explaining it**:
  a school lesson's question names the aim it checks (`aim`, 1 = the first;
  drafted by Gemini, renumbered with the aims a check drops, left out when
  it names none — never a rejection); a one-aim lesson's questions are that
  aim's; otherwise `teachAimOfAsk()` links a question only to the one aim it
  clearly shares words with. First answers on their own go to `S.teach.did`
  (`teachDid()`, from the lesson player), and the card says per point who
  does it and explains it, who gets it right but can't explain it yet, who
  explains it but whose answers aren't right yet. The class mirror and the
  class sync carry `explained {aimId: c|p|g}`, `loop {aimId: code}` and
  `did {aimId: y|n}` (`teachDidOf()`) — ids and letters, nothing said (`teachExplainedOf()`; the server keeps only
  well-formed ids and codes); the parent's sync notice says so in both
  languages.

## Talking Munni — `ui/talk-munni.js`

One of the two places in the app where a child's voice can leave the phone
(the other is the reading check; the help call from Ask Munni is
this same call, about one question), so:

- **This build has it only if `window.TAKHTI_VOICE` names a voice server**
  (`config.js` `TALK_URL`, set in `index.html`; empty by default). Empty →
  no switch, no button, nothing.
- **Off for every child** (`S.talkMunni`) until a parent turns it on in the
  dashboard, under a plain disclosure in Hindi and English: the voice goes
  over the internet to the voice service (Bolna) during a talk, the talk's
  words are kept to check the lesson, everything else stays on the phone.
  The same section can erase the child's voice-server record (`talkForget()`,
  authorised by `S.talkKey`).
- **Starts only at Munni's Pond, only with a signal** (`S.online`);
  otherwise an honest sentence. It never gates anything else. It **carries
  on into the games** (`TALK_KEEP`: the Pond, the map between, the Play
  Clearing and the six shells — `talkFollow()` in `go()`): the lesson waits
  (`/voice/web/mode` → `play`), and `gameAnswer()`/`gameEnd()` tell the
  server about a miss (by **item id** — the server says the hint from its
  own copy of the validated lesson bank, and only if the phone's answer
  text matches it) or a finished round; at most one line every 6 s. A
  fixed **"Munni is with you"** bar with an end button is on screen
  whenever the talk is live away from the Pond (`talkChip()`): a live
  microphone is never invisible. Any other screen (the Reading Tree needs
  the mic), a different child, or `setOnline(false)` ends it.
- The Bolna Web Call SDK is loaded from its CDN only when opted in and the
  Pond is open (`talkPreload()`, `AFTER.ask`) — not part of the offline
  shell. The browser never holds a key: `voice/server.js` mints a one-use
  session.
- **Screen + voice**: the server runs the same bounded lesson as a phone
  call; the line to read is on screen, and after a first miss the two clue
  choices are buttons. A tap is graded on the server and Munni answers it
  at once (Bolna event injection into the graph's `screen` node).
- Afterwards the talk's attempts are replayed through this child's own
  `record()` / `noteSkillAttempt()` / `noteSkillFromConcept()` — once per talk
  (`S.talkApplied`) and only into the child who talked (`talkApply()`).

## Google Cloud — `cloud/`, `Dockerfile`

One Cloud Run service, `cloud/server.mjs` (no dependencies), serves the app
and the Tier 2 endpoints it already calls on its own origin: `/api/syllabus`
(`draftCore()`), `/api/teachback` (`judgeCore()`, words only), `/api/ask`, and
`/api/class-sync` (`syncCore()` over a private Cloud Storage bucket,
`TAKHTI_SYNC_BUCKET`, reached with Cloud Run's own service-account token from
the metadata server — no key file). It serves only a whitelist (`index.html`,
`sw.js`, the manifest, `src/`, `icons/`, `audio/`). `GEMINI_API_KEY` comes from
Secret Manager. Cloud Run has no serverless cap, so it sets
`TAKHTI_SYLLABUS_MAX_MB` 12 and `TAKHTI_SYLLABUS_TIMEOUT_MS` 180000 unless the
deploy does. `cloud/deploy.sh`, run in Cloud Shell, enables the APIs, stores
the key, makes the bucket, grants the service account just those, and runs
`gcloud run deploy --source .` to `asia-south1`; `cloud/README.md` is the
walk-through. The voice server is not part of it (it keeps state in files).
Not yet deployed from this repo's workspace — Google Cloud's APIs are blocked
there; the deploy runs from Cloud Shell.

## Munni on the phone — `voice/`

A **second channel, not part of the app**: a small dependency-free Node
server that a Bolna voice agent calls during a phone lesson, so a child
with no smartphone (or no data) can practise. It is network-only by its
nature and never touches the app's lesson path — the app still runs fully
on-device. Full setup in `voice/README.md`.

- **One engine.** `voice/takhti-core.js` loads the app's own Tier 0 files
  (state, content, skill graph, diagnose, class-share, srs, matcher,
  adaptive, mathgen, readability, lesson-gen) unchanged into a vm, and
  switches children with the app's own `syncProfileIn()`/`syncProfileOut()`.
  It gets its own `localStorage` (kept in the voice store) for the class
  mirror and homework. If you change a signature in those files, run
  `test/voice.test.js`.
- **The voice model never teaches.** It speaks the `say` the server returns
  and passes the child's words back (`/voice/tools/next`, `/voice/tools/answer`).
  `voice/session.js` picks each item (warm-up count, `genProblem()` sums, one
  story problem from the validated lesson bank, teacher homework via
  `skillProblem()`, card lines from `ageSentences()` with SRS-due lines
  first), grades it (`gradeBest()`/`gradeVerdict()` with the band's own
  thresholds), gives a two-choice clue then a kind reveal, and records only
  first tries through `record()` plus `noteSkillAttempt()`/
  `noteSkillFromConcept()`.
- **A phone can't show text**, so the family copies today's lines from a card
  page onto the takhti before the call; 3–4 year olds say lines after Munni
  instead.
- **Reading is re-graded after the call** from Bolna's own transcript
  (`voice/report.js`), because a voice model can tidy a child's misreading
  before relaying it. That grade is what's recorded; the dashboard shows how
  often the relay and the transcript disagreed.
- **The class, by the same codes.** A teacher's homework code pasted on the
  voice dashboard (`importHomework()`) links the child and puts the homework
  in the next call; the parent report ends with the child's progress code
  (`classReportCode()`, name labelled "(phone)") for the teacher view.
- Spoken `a + b × c` is ambiguous without brackets, so BODMAS homework is
  never asked on a call — it stays in the app.
- **Parent calls** (`voice/parent.js`, a second Bolna agent from
  `agent/build-parent-agent.js`, one tool `takhti_parent`). The **consent
  call** is the first call to a family registered with `consent: 'call'`:
  the notice (what is kept, that Bolna turns the call into text, how to stop
  or delete), then yes/no for lessons and for recording, then time, days and
  the weekly call. No lesson can be planned before it (`createSession()`
  refuses). Consent is settled **after** the call from Bolna's transcript,
  like reading: relay and transcript must both say yes, else `needs_review`
  for a person (`confirmConsent()`); doubt is never a yes. The **weekly
  call** reads the week from real sessions (`weekFacts()`), answers "is she
  behind?" only against the band's start level (`standing()`, "too early"
  below six first tries a month), and applies what a parent asks — time,
  English on, weekly off, lessons paused. Hindi parent lines avoid gendered
  verbs for the child (no gender is stored).
- **Schedule and the daily sequence.** `voice/schedule.js` (runs inside
  the server) starts each family's lesson at their time: through the Bolna
  Workflow from `agent/build-workflow.js` (WhatsApp card → call → retry →
  WhatsApp three lines, every decision via `/voice/flow/*` in
  `voice/flow.js`), or a direct call with one retry (`brain.afterMissed()`).
  Never in quiet hours, never twice a day, never without consent. A
  missed-call message names only what will really happen next.
- **Schools** (`brain.createSchool()`): one admin key per school (hash
  kept), which scopes every dashboard and API record to that school (404
  for anything else); `envFor(child)` puts the school's own Bolna
  sub-account key, agents and workflows on its calls; its inbound agent only
  knows its own families.
- **Placement call** (`voice/placement.js`, kind `'placement'`, ages 5+;
  `placement_due` makes it the first call): a binary search on the
  spoken-maths ladder (two sums a step, a miss settles a step), the boundary
  topped up to four attempts each so `appEvidence()` can judge it, then one
  reading line per band level re-graded from the transcript. Records only
  `noteSkillAttempt()`s and sets the starting levels; no clue, no reveal,
  never "wrong".
- **Teacher voice notes** (`voice/notes.js`, the child agent's `teacher`
  node, tool `takhti_note`): the inbound lookup recognises a teacher's
  number (`caller_kind: 'teacher'`). Child matched by sound within that
  teacher's classes only; skill and letters and polarity from the words;
  read back, saved only on a yes. A note is one observed attempt; a
  difficulty sets `child.focus` (a spoken sum in the story slot, said as the
  teacher's request) or `child.focus_letters` (reading lines with those
  letters) for a week.
- **Class-wide parent calls** (`brain.classParentCalls()`, parent call kind
  `'class'`): shared gap (two or more children under 60% over four or more
  attempts) or the teacher's skill; each family hears where their own child
  stands and one thing to do at home; consent only, never in quiet hours,
  once a day.
- **Misreading corpus** (`voice/corpus.js`): word-level states and heard
  forms from transcript-graded readings, letter swaps (ण→न), only for
  children with `consent.research` (its own consent-call question, notice
  v2), no names or ids, heard forms only from `TAKHTI_CORPUS_MIN_CHILDREN`
  children. `voice/BOLNA-QUESTIONS.md` lists what Bolna must confirm.
- **When a child goes quiet** — an observation, never a wrong answer. Live:
  the graph's `hush` node (on `_silence_repeats`) sends `(silence)`
  (`intentOf()` → `'silence'`); the first time `session.answer()` gives an
  easier way into the same item (two choices, the first words) and marks it
  `eased` (no first-try credit), the second time outcome `'silent'` (counted
  nowhere) and a different item. After the call `report.js`
  `settleQuiet()` adds what the transcript shows (a line repeated with
  nothing between, the quiet goodbye) → `session.silence`,
  `child.quiet`, `child.quiet_skills`. The report says it kindly and
  promises an easier start, which `planSession()` keeps (an extra unscored
  warm-up after a quiet call, once). The weekly call and "behind?" mention
  it; `quietSignal()` flags "check in with the family" after two calls in a
  week ended quiet (for a person; nothing is sent). Placement counts a
  quiet step as "not yet seen".
- **Keypad**: a child can press the answer (`dtmf_number: …`; `*` repeats,
  1/2 = yes/no). Munni offers it after an unheard answer — only on phone
  channels, and only where the provider passes keys (not Exotel/Vobiz).
- **Inbound line**: Bolna asks `/voice/inbound/lookup` who is calling; only
  numbers a parent registered get a lesson; siblings on one number are asked
  who's calling and matched by sound (रिया ↔ Riya, `voice/sounds.js`); a daily
  limit and quiet hours (DPDP s.9: an always-open line must not become a
  habit loop) close the line with a kind goodbye.
- **Spoken English** (`voice/english.js`): a parent's per-child choice that
  alternates with the normal lesson. Hindi meaning → English word, and short
  phrases said back, graded by a script-agnostic sound skeleton (a Hindi
  recognizer writes "water" as वॉटर). Practice only: it writes nothing to the
  app's levels, SRS or skill history.

## The learning circle — `ui/circle.js` + `voice/circle.js`

Everyone around one child works on **one step a week**: the class teacher,
the parents, the tuition teacher, Munni on calls, and the app. The server
side lives in the voice server (it is the one place they can meet); the
app is a client of it, and only when a parent says so.

- **The parent's tick.** A build with a voice server (`TALK_URL`) ends
  onboarding with a grown-ups' step (`circleOnboardHTML()`, once per child,
  `S.circleAsked`), and the parent dashboard has the same switch
  (`circleParentHTML()`). Both say, in Hindi and English, that only practice
  progress goes, never a voice, a photo or a typed question. No voice
  server → no step, no section.
- **Off and erase reach the server** (`POST /circle/leave`, waiting in
  `S.circleLeave` for a signal if need be). Off: nothing more is sent, and
  the server stops the circle for this child (`active()` false: no weekly
  plan, no messages, no check or home question in calls) until it is turned
  on again. *Delete the circle's data* (two taps, the first explains, in
  both languages): a record only the app made is deleted whole; a school's
  record loses everything the circle kept (app link, snapshot, weeks,
  checks, home activities, tutor links, messages) and stays off, keeping
  only the school's own records (phone lessons, teachers' notes). The phone
  keeps its own progress.
- **Names.** The app knows a child by the animal they tapped, so a sync
  names only a record the app made; a school's record keeps the school's
  name and age.
- **Sync** (`circleSync()` → `POST /circle/sync`): at the map (between
  activities, at most every two minutes), when the signal comes back, after
  the Friday check / a home answer / a dashboard action, and *Sync now*.
  Fire-and-forget, never in a lesson's path; a sync asked for while one is
  in flight runs right after it. Up: levels, the skill history, counts,
  stars, card count, SRS counts, the class code, and what waits in
  `S.circleOut` (the check, home answers, a tutor invite or decision). Down
  (`circleApply()`): this phone's key (`S.circleKey`), `S.circle` (this
  week, home activities, the check's questions, members, notes, parent
  page), a level a phone lesson moved, the class homework (through the app's
  own `importHomework()`), and `S.circleHistory` — evidence only the server
  saw (phone lessons, tutor ticks, teachers' notes). `appEvidence()` adds
  it to the child's own history; the server keeps the two apart
  (`voice/evidence.js`'s ledger), so nothing counts twice.
- **Class homework, both ways.** A teacher sets the class focus on their
  class page (`setClassFocus()`), and it reaches each synced app as
  `homework_code`, imported by the app's own `importHomework()`;
  `S.circleHw` remembers which assignment came that way. *Withdraw it* on
  the class page (`clearClassFocus()`) clears the class's homework, remakes
  every week that was built on it from the child's own next step (the old
  week is kept in the history as "homework withdrawn"), and on its next
  sync the app drops exactly that assignment — never homework from a code
  a parent pasted or the teacher view on the phone.
- **Family code.** A school's 8-letter code (from the class page or the
  voice dashboard) typed at onboarding or on the dashboard joins this phone
  to the school's record of the same child; a code used by another phone is
  refused.
- **The weekly focus** (`focusFor()`): the class homework adapted to *this*
  child's gap underneath, else last Friday's suggestion, a teacher's note,
  the weakest step, the placement call's next step, the ladder. The same
  step everywhere: the map (`circleMapHTML()`), the Story Fire's lessons for
  it (`circleLessonsHTML()`), the phone lesson's homework slot, the tutor's
  pack, the parent's WhatsApp.
- **Munni's Friday check** (`VIEWS.check`, Friday–Sunday by default,
  `TAKHTI_CHECK_DAYS`): three `skillProblem()` questions seeded by child and
  week (the same three on a call), real evidence (`noteSkillAttempt()` +
  `record('math')`), "Almost! It's 7", never "wrong". The verdict
  (mastered / nearly / not yet) and next week's step are the server's; the
  teacher sees them in the Saturday digest and on the class page.
- **The home loop.** Two activities a week for a grown-up (*do* on day 1,
  *teach* on day 3 — "ask her to show you how 38 + 24 works"). The parent
  marks one done (dashboard, parent page, WhatsApp link); then the child is
  asked once — on the map or on a call — "did you teach someone at home?".
- **Tutors**: a parent's invite is active at once; a school's link waits for
  the parent's yes. A tutor gets the week's pack before their session, ticks
  the pack's questions (evidence), and can leave a note — by page or phone.
- **WhatsApp** goes to grown-ups only (AiSensy, or ready `wa.me` links),
  never in quiet hours, capped per day, and a parent can stop it. Nothing is
  ever sent to a child.

## Product constraints that are not negotiable

- **No streaks, no reminder notifications to children.** India's DPDP Act s.9
  bars addictive design aimed at minors (penalties up to ₹200 crore). Stars
  are the only habit mechanic, and they only ever grow — never spent, reset,
  or compared. (A "🔥 N Day" streak badge once crept into the map header; it
  was removed. `topGamifyBar()`'s comment says why — keep it that way.)
- **Original IP only.** Gauri the sparrow and Munni the elephant are ours.
- **Progress syncs only with a parent's tick** (the learning circle, below):
  levels, skill history, counts, the Friday check, home answers. Never a
  voice, a photo or a typed question — the sync body is checked for exactly
  that in `test/circle.test.js`.
- **Photos and voice clips never leave the device** — with exceptions a
  parent agrees to: the reading check (a line read, or a word said after
  Munni, to Gemini — Sarvam as backup — for writing down; the reading terms
  at onboarding, v3, not kept, withdrawable), and Talking Munni (below), off for every child until a parent
  turns it on behind the PIN after reading, in both languages, that the
  child's voice goes to the voice service while they talk (at the Pond, and
  in a game the talk carries on into, with the "Munni is with you" bar
  showing), and in Ask Munni's "still stuck? Munni calls", which the same
  switch allows and the same notice names; and Teach Munni's explanation,
  under the same reading terms (v3). (A build with no voice server sends
  Teach Munni's words — never a recording — under the words terms.) Nothing else
  ever sends a voice. Keep it true, and keep saying so in both languages.
- **A tutor, not a companion.** Bounded, task-scoped.
- **Every child-facing string ships in Hindi and English.**

## Testing

`npm test` runs 47 suites. Two methods: **vm** (real source in an isolated
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
| `talk-munni` | jsdom | Talking Munni through real taps with a stand-in voice server and SDK: hidden and SDK-free until a parent opts in, the bilingual disclosure, offline honesty, minting with consent, the line and the clue choices on screen, a tap to the server, the talk carrying on into the games (bar shown, mode play, a miss sent by item id, the round's score, back to the lesson), the Reading Tree/losing signal ends the call, answers replayed into the record once (record, skill history, SRS), erase, and a build with no voice server shows nothing |
| `voice` | vm + HTTP | the phone channel: spoken numbers (EN/HI/Hinglish, every Hindi word Munni speaks parses back), every Munni line bilingual and never "wrong", whole calls for every band, clue/reveal/first-try rules, doubt records nothing, "bas" stops, no-card fallback, band floor/ceiling over many calls, transcript re-grading and relay drift, skill tagging, homework code → call → progress code into a real teacher phone, SRS-due lines, keypad answers, the inbound line (unregistered, siblings, daily limit, quiet hours), the sound matcher and English practice, the in-app talk server against a fake Bolna (mint, screen, tap → event injection, results, limits, erase), the HTTP surface and auth, the Bolna graph, and the `genProblem(3)` hang regression |
| `voice-parent` | vm + HTTP | consent call (Hindi/English): notice content, nothing before it, transcript-settled consent, relay/transcript disagreement → review, no transcript → review, refusal, unclear never a yes, quiet-hour times; weekly call from real lessons, honest "behind?", a parent's changes applied; scheduler: on time, once, one retry, truthful missed message, quiet hours, no consent, already practised, Sunday weekly call; workflow endpoints idempotent; both workflow definitions and the parent agent graph checked; HTTP auth |
| `voice-school` | vm + HTTP | school keys see only their own records (404 otherwise), calls on the school's own Bolna key, inbound scoped to the school; placement finds the boundary, tops it up to four attempts, reads, sets levels, kind to a child who knows nothing; teacher notes (recognised line, read-back, saved on yes only, evidence + focus, focus in the next call, other classes refused, same-name children asked apart, transcript check); class calls (shared gap, per-child standing, consent, quiet hours, once a day); corpus (research consent only, no names or ids, K-children threshold, letter swaps); the teacher node in the agent graph |
| `voice-quiet` | vm + HTTP | silence is its own intent; an easier way in, then a different item, never a wrong answer or first-try credit; transcript-detected quiet moments; the kind report line and the kept "easier start" promise (once); ended-in-silence twice → check-in signal; the weekly call's quiet lines; placement quiet steps; games: lesson paused, hint only from the server's bank (mismatch or unknown id → nothing), throttled, silence is play, back to the lesson; the hush/play nodes and the web agent's silence hang-up |
| `voice-circle` | vm + HTTP | the circle's server: sync only with the tick, progress only, this phone's key; the family code joins the school's record; the ledger (nothing counted twice); levels a phone lesson moved go back; weekly focus (class homework adapted to the child's gap, else the weakest step); the Friday check (app, call, reading) and next week's step; the home loop; tutors (parent invite, school link waiting for the parent, pack, results, notes); the three pages; the WhatsApp outbox (fake AiSensy); the scheduler's circle week |
| `circle` | jsdom + the real voice server | the app side through real taps: nothing without a circle server; the bilingual grown-ups' step; nothing sent before the tick, progress only after it; family code → school, keeping the school's name; class homework via `importHomework()`, and withdrawn from the class page (the week remade, the app drops exactly that assignment, other homework left alone); this week on the map; the Friday check (real evidence, never "wrong", the verdict on the server); "We did it" and the child's home question; a phone lesson back as `circleHistory`, counted once; sync off reaches the server (also after a spell offline) and stops calls' circle items and messages; on again; erase (school record keeps its own, app-only record goes whole, another phone refused) |
| `ask-munni` | jsdom + the real voice server + a stand-in Bolna | the steps for hundreds of sums of every kind never say the final answer and ask only true sub-answers; 38 + 24 and 52 − 27 broken down as a teacher would; Hindi words split into whole letters; the server refuses a made-up line, non-numbers, unknown signs or lessons, asks the steps one by one with a clue, records nothing; in the app: the button only where something is asked, instant help out loud with no server, "I get it", a helped answer not counted, reading help from the stumbled word, help leaves with the screen; with a voice server: no call until the parent's switch, then the call about this question, the step and the two choices on the panel, leaving ends it |
| `mind` | vm + HTTP + jsdom | rounds settle on the child's own answers; two misses switch and cool a way, with the reason; a plan holds while it works; two simulated children who learn differently end up taught differently; a new topic leans on the subject; a low school mark switches at once and becomes the focus; teacher class-test marks reach records and next week's step; in the app: a missed sum taught by steps or with a story invitation, helped answers never count, the Reading Tree's pieces and read-first, the parent's marks and "What Munni changed" (EN/HI), "Munni's idea" on the map, a class test applied once, nothing of the mind in the sync |
| `twin` | vm + HTTP + jsdom | each wrong answer named as its real mistake, incl. the column-procedure ones (carrying the ones, lining up on the left, borrowing across zero, 0 − N, N − 0, the carry in multiplying…); tips and explanations for thousands never say the answer; a combination found only on two different questions, named and explained from its steps, then guessed; unexplained sums kept; shared rules known at once; codes checked; reading slips (17 cases EN/HI), a line's stopping/adding, traced letters (mirror, part missing, शिरोरेखा, too small) from pixels; reading habits with their letters; right-or-not guesses; knowledge tracing up, down, fading, seeded; the profile (ids only, junk dropped) and its prompt; a simulated child with a habit of thought guessed exactly ≥ 90%; on a call: the clue aimed at the mistake, the profile's twin sum, "I know this tricky bit!", the step-by-step reveal, reading coaching naming the slip; the shared database (promoted at three children, counted without names, erase leaves every count, the review page); in the app: the guesses (sums, reading, lessons, games), the tips, "Munni noticed", the heads-up, paper spelling, a habit deciding Ask Munni's explanation, `appEvidence()` reading the twin, where the profile goes, the parent section EN/HI, only the profile in the sync |
| `speech` | vm + HTTP + jsdom | the Sarvam provider (the backup) against a stand-in: verbatim mode, Hindi, the key on the server only, nothing kept, consent, bogus recordings refused, per-address limit, honest 503, an OpenAI-compatible service; Munni's live voice (Bulbul, slow, cached, short lines only); in the app: no terms without a voice server, the bilingual terms at onboarding kept with version and time, online → Sarvam even with a recognizer on the phone, the slip named, **say it with Munni** (the word in pieces in Sarvam's voice, the child says it, checked, praised; two tries then let go kindly; help not evidence), offline → the on-device recognizer and nothing sent, withdrawn → nothing sent, no answer → the honest message; on a call the word in pieces; the narration builder |
| `syllabus` | vm + HTTP + jsdom | the server against a stand-in Gemini (key in a header on the server only, the PDF and the band's rules and schema in the request, the older field names, 503 with no key, the school key, PDF/photo only, a limit per address, the repair round with the checker's reasons, the voice server's `POST /syllabus`); one beat schema per type with its required fields (an ask's two answers, a rectangle's w and h, a circle's folds), the flat one last after a 400; `tools/try-syllabus.mjs` through the same pipeline (passed / repaired / not used, the report, every model's outcome, `--recheck` with no call to Gemini, the key in neither file, no key → nobody called, busy → once more by itself); the sixth run's lessons moved onto another shape (the question's other option right, the teacher's note naming the repeat), a question naming a shape never moved, the reason saying where the answer was said; the class sync carries lessons from the teacher's key only; the phone's checks (a good maths and reading lesson pass; a wrong sum, an answer not in the passage, markup, over the band's ceiling, an undrawable beat, an unequal share, non-Devanagari Hindi, a non-number maths answer all fail with a reason; idempotent; shuffled); in the app: draft → one repaired, one "not used" → approve → remove; offline honest; the child's "From your school" (EN/HI), played, never rewritten, evidence for its skill; an edited lesson not shown; the sync sends them; English lessons: the prompt's English example passes as one (and fails unmarked: English Hindi answers are only an English lesson's own words), lang inside the id only when set (a lesson without it keeps its id), a Hindi answer in English letters only as that very word, a first sound marked wrong or both answers the first sound, a letter or a two-letter word said before its question, "starts with a sound" not the letter, two word cards both read, "which little word did you read?" rejected |
| `geometry` | vm + jsdom | answers read off the drawing (sides, corners, names, perimeter, equal sides, the centre, corner kinds, a numbered row, the odd one out), in English and Hindi; the checker rejects a wrong marked answer, a disagreeing Hindi answer, two right answers, a figure that doesn't say what it asks, an equal-sided "rectangle", an impossible triangle, a row with two matches, a number over the ceiling, an undrawable shape; the 27 built-in lessons pass, a question's picture is never named or measured aloud, Ask Munni's hint never says the answer, clean SVGs, labels hidden while counting, no shape question in the games, drafted fields sanitised; in the app: the picture stays on screen during the question, the answer counts for the skill, Ask Munni's how-to-look help, a drafted shape lesson checked against its drawing |
| `pictures` | vm + jsdom | clocks: the time and the time passed read off the hands (across 12 too), times read as the class writes them in English and Hindi (साढ़े, सवा, पौने, डेढ़, ढाई, बजकर, बजने में; "साढ़े 3 बजे" never also 3:00); the checker rejects a wrong time, a Hindi time that disagrees, two right answers, a clock that doesn't say what it asks, a time the band doesn't read yet, clocks at 3–4, hours that aren't whole, minutes over the ceiling, an undrawable hour, the teaching clock asked again; 28 built-in lessons pass and teach time2 and time3; a question's clock never read aloud, Ask Munni's hint never the answer; the hands drawn to the time; clean SVGs, no time in the label; no clock question in the games; a drafted clock lesson checked against its drawing, a wrong time / the intro saying it in Hindi words / a silent teaching clock's own words giving it away caught, ask and time tidied, the on-the-hour warning, clock aims, the prompt's clock example through the checker; a Hindi answer "3 बजे 30" or "330" still fails, only an exact H:MM passes the Devanagari rule; calendars: the month, number, after/before, months later and between, the month in a printed date, a date's day, how many Sundays, a week later — read in English and Hindi; the checker rejects the day read as the month, a disagreeing Hindi month, "later" whose question doesn't say how much, a date whose month isn't m, a page for 5–6, a week past the month's end; 20 built-in lessons pass with two questions each and teach calendar3; never read aloud, the hint never names the answer; clean SVGs, a number question hides the numbers; no calendar question in the games; the prompt's calendar example through the checker; the library's rule — a picture lesson with one question rejected for the library, a teacher's upload warned; in the app: the clocks stay on screen, the answer counts for time3, Ask Munni's how-to-read help, Hindi labels; the strip of months and the printed date on screen, the answer counting for calendar3 |
| `teachback` | vm + HTTP + jsdom | every built-in aim passes its check; the checker rejects a question or hint that gives the explanation, no Hindi, markup; the offline judge (covered/partly/missing/unsure, EN/HI/romanised, Devanagari digits); Munni's sum for every skill, three ages, many sums: never the right answer in her working, a real named mistake, the right option there; the child's own habit acted out; a whole session (hints, "later", never "wrong", unsure costs nothing, one explanation teaching two aims, the first tap as evidence and an agreed mistake into the twin, a nudged tap not); what is kept; "forgot again" asks only the gaps; the judge's credit needs a real quote of the child; Gemini's school aims cleaned, inside the lesson's id, idempotent; a topic word Munni's question and the point share taken out of the explanation words (centre), but a question that says the answer still dropped; a giveaway hint named with its words, mended to a general nudge only after the repair round, a giveaway question never; the repair gets every dropped aim's reason; the judge against a stand-in Gemini (key in a header, schema, the server's own aim text not the phone's, words as data, fix ideas from the mistake id, downgrade, 403/400, no key → no judge, failing Gemini → no judge, per-address limit) and through the voice server with a stand-in speech service; in the app: the end-of-lesson button, chips, Munni's sum, the summary, learn it again, "Munni forgot again", the parent's "How … explains" (EN/HI), the teacher's results per aim, the class mirror and sync carrying only ids and c/p/g; with a voice server: nothing sent on v1 terms, the new terms offered, then the recording and typed words judged with no name, an unquoted credit refused; no button for 3–4; the judge's models (a busy or silent first model → flash-lite inside the time, all silent → no judge); the Netlify function laid out as Netlify ships it (the built-in points found, words only); the Netlify link in the app: no signal → nothing sent and said so, the grown-up's words terms card (EN/HI), nothing sent before it, then typed and phone-recognized words to `/api/teachback` with no name, Gemini's quoted verdict turning the chip, an unquoted credit refused, the parent page's agree/withdraw, withdrawn → nothing sent |
| `voice-teach` | vm (the voice brain) | Teach Munni on a call: the `teach` slot only for a practised topic in the child's band (none for 3–4, none for a 7–8 topic at 5–6); Munni forgets, a muddled answer gets her written hint, an explanation thanks, never "wrong"; kept in `profile.teach`, the skill history untouched; Hindi lines; not heard twice → the next point, nothing credited; a point taught isn't asked on the next call; the report line (EN/HI); the circle's Wednesday activity carries Munni's question, clue and full answer, a gap first, and an aim-less topic keeps the old activity |
| `speech-provider` | vm + HTTP + jsdom + child processes | one stand-in for Gemini (hearing, TTS, Batch API) and Sarvam: the switch both ways (unset/gemini → Gemini; sarvam → Sarvam only, Gemini never called); Gemini's request (the model, key in a header, inline audio, structured output, "write what you hear"); the answer's shape; the passage only from the server's own lines; Gemini failing or slow → Sarvam inside the budget; neither → skipped at once; sarvam set and down → skipped, no Gemini; live `/reading/tts` never Gemini; per-address limit; Teach Munni hears the same way; nothing kept in the data folder; Gemini TTS (model, voice, WAV, PCM wrapped, the older voice field after a 400); `tools/build-audio.mjs` through the Batch API (WAV without ffmpeg, mp3 with it, carries on where it stopped, `--provider sarvam`); on the phone: pack → live backup → device voice, a `.wav` pack, v2 terms send nothing, a skipped check never blocks (message, typing, the line comes back, no recording kept); `tools/compare-speech.mjs` names the slip Gemini missed and advises switching back, or keeping Gemini |
| `planner` | vm + jsdom | two children, the same approved shapes aims, two different paths from their own records (pictures first / the school's story), each step's why in EN/HI, the plan held; maths: the cartoon first or the school's story, the cartoon done once watched, the school's lesson after it the check, a skipped step not coming back; reading: three children, three ways inside the same lesson (Munni reads first / pieces / you first), each counted as that way; already knows it → show it, teach Munni; a gap underneath first (perimeter → add2) with a built-in lesson; status from what the child really did; labelling (pictures, the story, the check labels nothing), the answers settling it, two misses switching the way and the plan following; in the app: the Story Fire's path and why (EN/HI), the button starting the next step, then the school lesson as the check; a reading lesson's passage in pieces, or read aloud by Munni first; a maths lesson's button opening the cartoon (seeded sampling, so every run is the same); what goes to the teacher (short codes only, the mirror carrying it, the server keeping a well-formed path and dropping the rest), the teacher's card grouping four children by path (EN/HI), the parent's notice naming it |
| `library` | Node + jsdom | the Batch API builder against a stand-in Files API and Batch API (the PDF uploaded once by resumable upload, the key in a header, one draft job to the full Flash model with no PDF inline, each request exactly `buildRequest()`'s; a job not done by `--wait` kept in `.batch.json` and collected by the next run with no second upload or job; one repair job; the report saying batch and its tokens; the upload deleted, the key in no file; a weaker rebuild saved as a candidate, `--replace` taking it; a refused request shape sent again with the older names; `GEMINI_BATCH_MODEL`); a reader holding every lesson to two questions; a book not built yet left out of the bundle; the fourteen NCERT books set up; the builder against a stand-in Gemini with the seventh live run's own drafts (each question asked a second time — the drafts as they are ask one, and none is kept: a picture lesson with one question isn't, with why): only passing lessons kept, the failure named with why, the title from the chapter, a missing PDF skipped and said, raw and report written, the key in no file, a built chapter skipped (no call), `--force --only`, `--recheck` and `--import` with no call; `--scan` (a whole book's PDFs in natural order, front matter and answers left out, a listed chapter's title kept, a built chapter now on another file warned about); a chapter Gemini can't do doesn't stop the book, and `summary.md` says so; a bad book.json refused with each fault; the bundle (every chapter in order, one not built yet with no lessons, no raw drafts); the shipped `src/content/library.js` exactly what `library/` builds; PDFs ignored; in the app, offline: no book for Class 2 said, Maths Mela offered for Class 3, the term laid out with this week's chapter, the plan kept on the phone, this week's lessons in the approval card (every one checked again, no network), approved into the class, the child's "From your school" with their path; a chapter added later at the end, ↑ ↓, a not-built week said, next week; a lesson edited after it was built not offered; Hindi; no fetch at all; the book's own words (hashes only, not one word of the book in the index; five words in a row caught, across a poem's lines, the lesson's own sentences passing; nothing shorter — a single word, a short common phrase, a four-word sentence of the book's — caught); an English book's chapter against a stand-in (the text copied out once, the draft and repair asked as English lessons, the draft that copied sent back with the words it copied, the kept lesson its own with lang 'en', `--recheck` with no call); in the app: Mridang offered for Class 1, its chapter 1 opened with every lesson an English lesson, approved, and a 5-year-old using the app in Hindi playing one — the passage, question and answer buttons in English, Munni's intro in Hindi; a Hindi book's (Sarangi), an EVS book's (Our Wondrous World) and a maths book's (Maths Mela) lessons with no lang, in the child's language both ways |
| `demo` | jsdom | the demo card says what it is; two labelled demo children join the class with sync off; their records come from the mind's own rounds and a real twin habit for Kabir (none for Asha); the library's chapter approved → two different paths for the same lesson; the teacher's path card names both; switching to each goes to the map and shows their own Story Fire; removal deletes exactly them (phone and mirror) and restores the real child; no room → said, none added; Hindi |
| `live-check` | Node | `tools/live-check.mjs` against a stand-in Gemini with a good, a slip-tidying and a down model: slips kept or "wrote the line", every case failing with its reason when down, the judge's four cases (a credit-anything judge fails, an echo of Munni's question downgraded by the quote check), judging from a recording, the advice naming the settings, the key in no output, no key → nobody called; the judge's own model setting (`TAKHTI_TEACH_MODEL`, else `GEMINI_MODEL`), each model measured alone (`TAKHTI_TEACH_FALLBACK: 'none'`) |
| `cloud` | HTTP | `cloud/server.mjs`, the Cloud Run service: the app's files from a whitelist only (never `voice/`, `api/`, a `.env`, the notes, a path that climbs out), honest 503s without a key or bucket, a non-JSON body a 400, a chapter reaching a stand-in Gemini with the key in a header, 12 MB and 180 s, class sync round-tripping through a stand-in Cloud Storage with the metadata server's token (fetched once), storage down → 503 |
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
3. **Class sync needs Netlify, or the learning circle.** The hourly class
   sync (`core/class-sync.js`) needs the server deployed on Netlify (Netlify
   Blobs); elsewhere it reports "not set up" and the codes still work. The
   teacher key lives on one phone (no key-transfer flow yet). With the
   learning circle's tick, progress (only) also syncs through the voice
   server — see **The learning circle**.
4. **`planSummary()` is English-only**, so the teacher view's per-child line
   is English even in Hindi mode.
5. **SRS replays content only for reading**; write/math review is routing only.
6. **Cartoons and homework stories cover arithmetic skills only**
   (`SKILL_OPS` in `mathgen.js`). Other homework still gets its diagnosed
   lessons, just no story.
7. **Browser APIs are stubbed in the tests** (speech, the on-device model,
   audio). Check on a real handset before a demo — especially the microphone
   and offline reading. The jsdom suites' "no uncaught errors" checks ignore
   only Google Fonts failing to load (a sandbox with no open internet) — any
   other link that fails still fails them.
8. **The phone channel has had its first live call, nothing more.** On 26
   Oct 2026 `build-agent.js`'s output was created in a real Bolna account
   (through Bolna's API) and called a real phone: the greeting, Sarvam
   hearing "yes" and "8", and the first tool call worked. It also found two
   faults, both fixed in the builder: the router sent the answer "8" to the
   safety message (a priority on that edge; now none, a stricter condition
   and the child's own words required as a parameter), and Bolna spoke an
   English filler before every tool call (now "हम्म…"); and Bolna's own
   English "are you still there?" is now off. See `BOLNA-QUESTIONS.md`
   33–36. Children's speech
   through a phone recognizer is untested; voice storage is one JSON file
   per record (a pilot, not a serverless host); WhatsApp is a share link,
   not automatic sending; consent is a checkbox and timestamp, not the
   DPDP Rules' verifiable parental consent: the consent call records a
   transcript-checked yes, but doesn't verify the parent is an identifiable
   adult (Rule 10, in force 13 May 2027). The Bolna Workflows follow the
   documented (beta) definition format but haven't run in an account; the
   WhatsApp node is fire-and-forget. Talking Munni's minting
   endpoint is open to any browser (rate-limited per address and per child,
   not authenticated), and the English sound matcher accepts words that
   differ only in a vowel (sun/son) — the bank avoids such pairs. The live
   silence signal depends on how Bolna's `_silence_repeats` and expression
   edges behave on a silent turn (unconfirmed — `BOLNA-QUESTIONS.md` 8);
   the transcript check after the call works either way.
9. **The learning circle is a pilot.** The sync tick is a parent's
   checkbox in the app, not verified parental consent (same caveat as 8);
   WhatsApp sending needs an approved AiSensy template (`takhti_circle`,
   two parameters) or falls back to links a person taps; the Friday check
   and the weekly focus are maths-shaped for skills with a `skillProblem()`
   (a reading focus is checked from the week's reading instead); the
   circle's server is the voice server's JSON store.
10. **How-this-child-learns is new and uncalibrated.** The settle rule
   (2 of up to 3 answers), the switch rule (two misses) and the half-weight
   subject prior are reasonable first choices, not tuned on real children;
   it covers maths skills with a `skillProblem()` and reading levels, not
   writing yet; on calls only "step by step" can be used (a phone can't show
   or play a cartoon), through the twin's profile. Children's data law: DPDP s.9(3)
   bars "tracking or behavioural monitoring" of children, with an exemption
   for educational institutions' educational activities; the team's lawyer
   advised (31 Oct 2026) that edtech use like this is exempt too. The model
   still stays on the phone, which is the safest design either way.
11. **The twin is new and uncalibrated too.** Its knowledge-tracing numbers
   (start 0.3, slip 0.1, learn 0.15, the fading half-life) are textbook
   defaults, not fitted to real children. The column engine covers +, −
   and × by one digit; long multiplication and division only have their
   named mistakes. Reading slips are only as good as what the recognizer
   writes down (a tidying recognizer hides them — which is why the clearer
   check uses verbatim mode); writing slips come from tracing pixels and
   typed-back spelling, not from reading the child's handwriting in a photo.
   Games and story questions without a sum are guessed right-or-not only.
   The exact-guess "at the start" comparison needs 25 guesses. Promoted
   combinations travel only with the circle's sync; a brand-new kind of
   mistake (not a combination of known steps) still needs a person to
   write it into `mathgen.js` from the review page.
12. **The reading check depends on a network and a service.** It is the one
   place a child's lesson uses the network, so it never waits: no answer in
   10 s (or "skipped") → the typed fallback and the line comes back later;
   offline, the phone's recognizer, which misses some slips. Its endpoints are open to any browser (rate-limited per
   address), like Talking Munni's minting. The terms are an in-app
   agreement with a timestamp — the team's T&C and lawyer decide the final
   wording, whether accepting them may be a condition of using the app,
   and the DPDP Rules' verifiable parental consent (same caveat as 8);
   Gemini (paid tier) and Sarvam each need a data-processing agreement.
   Children's speech through either is untested on real children. Builds without a voice server keep
   the old path (the browser's own recognizer online). The recorded
   narration is complete in both languages and in one voice (Gemini TTS,
   Kore, 15 Nov 2026): Hindi 1,315 lines (mp3, 21 MB in `audio/hi/`),
   English 1,332 (mp3, 18 MB in `audio/en/`) — the 439 English lines from
   the 1 Sep build in an older voice were rendered again with
   `build-audio.mjs --force`, and `AUDIO_CACHE` went to v2 so phones drop
   the old clips. Neither pack downloads at install: `sw.js` keeps each clip
   in `takhti-audio-v2` the first time it plays, so a line never heard
   online plays in the phone's own voice offline. Sarvam (or ElevenLabs)
   can still build either pack with `--provider sarvam`.

13. **Lessons from the syllabus are new.** Gemini drafting is tested
   against a stand-in, not yet against real chapters in an account: the
   model name and the structured-output field names follow the current
   docs (one retry covers the older names). The checks catch wrong
   arithmetic, ungrounded reading answers, unsafe text and unsuitable
   numbers — not a lesson that is correct but teaches the chapter badly;
   that is what the teacher's reading is for. Lessons use the player's
   own pictures — counting, sums, bars, fractions and now squares,
   rectangles, triangles, circles and corners — never a copy of a textbook
   figure (no clocks, maps, 3-D shapes, angles in degrees or patterns
   yet); a
   reading answer counts as "in the passage" by shared words, which a
   paraphrase can fail. They reach other phones only through the class
   sync (no lesson code by hand yet). Serverless hosts cap a chapter at
   3.4 MB and may time out on a long PDF — NCERT chapters are often 5–10 MB,
   so use the voice server's `POST /syllabus` (12 MB, no time limit); past
   that, the Gemini Files API would be next. The first live runs (12 Nov
   2026) found `gemini-3.8-flash` overloaded (503) for an hour, hence the
   fallback; `gemini-3.5-flash-lite` then passed 1 of 6 drafted lessons on
   the *Maths Mela* Class 3 shapes chapter, every rejection a missing shape
   `ask` or a rectangle without `h`, and the repair round (which then didn't
   describe the beats) fixed none — the reason for the shared prompt, the
   worked example and `sylTidy()`. The second run (still flash-lite;
   3.8-flash hung or was busy every time) passed 2 of 3, but both passing
   lessons asked about their own teaching picture and one intro said the
   answer — the reason for the same-picture rule, the wider "said it" check,
   the resting model and the rectangle's inferred height. The third run
   (flash-lite again) passed 0 of 3: the schema then required only a
   beat's type, so it sent a question with no answers and two lessons with
   no question at all, and the repair returned them unchanged — the reason
   for the lesson shape with every field required, the unchanged-repair
   mark and the full-Flash fallback before the lite one. In the fourth
   (13 Nov), the repair did change its lessons and fixed the said-the-answer
   and same-picture faults, but left a row's rectangle without `h`, a row
   without `find` and "folds 2" written as text — the reason for the field
   descriptions in the schema and the three extra tidy steps. Its teacher
   reading found more: "which shape has square corners?" over a rectangle
   and a 3-4-5 triangle (two right answers), "how many sides does this
   triangle have?" (the name gives the count), a teaching circle without
   the folds it talked about, and an aim no question checked — each now
   caught or flagged. In parallel (13 Nov, `tools/try-syllabus.mjs`), the
   flat schema's 0 of 4 led to the per-type schema, the topic words, the
   named giveaways and the nudge for hints; the next run gave 4 of 4 valid,
   then the number words and centre/center; the run after that, 4 of 4
   usable with nothing given away. The two lines of work were combined on
   13 Nov: the per-type schema (it gave the 4 of 4), with the lesson-shape
   branch's checks, tidy steps, fallbacks and resting models. The fifth
   lesson-shape run (13 Nov, evening, before the combining) logged every
   model's answer and showed the "busy" was the key's quota:
   `gemini-3.8-flash` and `gemini-3.7-flash` both answer 429, so flash-lite
   drafted everything; 4 of its 6 lessons passed, all after the repair
   round. Its reading led to the last tidy steps above (folds, the stray
   row shape, the look-alike), Munni's own words on a silent teaching
   picture (a silent rectangle would have said "4 sides" before "how many
   sides?") and no retry on a 429. A verdict on 3.8-flash needs a key whose
   quota allows it. The sixth run (13 Nov, evening, on the combined `main`;
   flash-lite again, a 267 s draft) gave 0 of 4: every lesson taught a fact
   ("a square has four sides", a square corner) and asked it again of the
   same kind of shape or of the teaching picture itself, and the repair only
   changed the picture's size — the reason for `sylAskAnother()` and for
   naming where an answer was said. Checked again with `--recheck`, the same
   drafts give 3 of 4; the fourth's intro ("let us … find its centre")
   still names the answer to "where do the folds meet?", and stays sent
   back. The seventh run (13 Nov, evening, with `sylAskAnother()`; every
   faster model answered 503 or hung, so flash-lite again, 178 s) gave
   **4 of 4 usable**: two passed first time (one only because its question
   was moved onto a triangle), and the repair round, told *where* each
   answer was said, rewrote the intro and the teaching line it named. The
   eighth (13 Nov, evening, the first on a paid key: no 429 any more) got
   nothing: `gemini-3.8-flash` answered 503 or hung on every try, even for
   a 70-word text, and the default chain spent 151 of 180 s on the two full
   Flash models before flash-lite — the reason for the last model's
   reserve, the shared retry budget and `cut`/`no time` in `tried`. Its
   re-check found the stray-row step adding a second match (now placed only
   where the row answers as marked) and its teacher reading the coin-toss
   and always-Yes lessons (now warned about). The ninth (13 Nov, evening)
   gave **3 of 3 usable** in the default chain: `gemini-3.8-flash` hung
   108 s, `gemini-3.7-flash` was busy, and flash-lite had its reserved turn
   (14,421 + 5,150 tokens in, 3,081 + 3,070 out, for draft and repair).
   Its reading led to the per-model cap (a minute), "by folding" as an aim
   a screen can't check, and warnings for one right answer everywhere and
   for Hindi words drafts get wrong.
14. **Teach Munni is new and untested on real children.** The judge (Gemini
   on a transcript) is tested against a stand-in; whether it judges a
   seven-year-old's Hinglish fairly needs real recordings first (try ten
   before a demo). The offline rubric only knows the words an aim lists,
   so it misses a correct explanation in other words (it says "partly" or
   "missing" and Munni hints — never "wrong"), and a child who says the
   key word in a muddled sentence can pass it. Audio is written down by the
   speech adapter's `checkReading()` before Gemini judges the words (the
   voice server only). Built-in aims cover
   four maths topics; reading topics get aims only from school lessons.
   The explained points travel with the class sync, not in progress codes.
   On calls Teach Munni uses only the built-in units' `explain` aims (no
   school lesson's aims, no Munni's sum), is judged live by the rubric only
   (Gemini doesn't re-judge it from Bolna's transcript yet), and lands in the
   voice server's copy of the child (`profile.teach`) — which feeds the home
   activity, but doesn't travel back to the app's own record; a Talking
   Munni talk's teach result isn't replayed into the app either.
16. **The child's path is new (13 Nov 2026).** Its thresholds (knows ≥ 0.85
   over 4 answers, a gap < 0.5 over 3) inherit the twin's uncalibrated
   numbers; a maths school lesson can only choose the cartoon or the
   story (and only for skills with an episode at the child's band — the
   rest go straight to the story); reading ways change how the passage is
   read, not the questions; built-in picture lessons for `shapes2d` at 7–8
   are only the centre-of-a-circle ones; the teacher sees a child's path
   only through the class mirror or the class sync (not in progress codes).
17. **The library is new (13 Nov 2026).** One book, *Maths Mela* Class 3:
   42 lessons in all 14 chapters; chapters 3 and 6 (numbers to 200 and
   300) kept only one lesson each, and chapter 13 three, drawn, two
   questions each (a fourth, how long activities take — minutes or months —
   came back as a sentence to read and was rejected; nothing in Takhti
   draws that comparison yet). The other 39 have one question each: the
   17 arithmetic ones get a "your turn" sum at play time; the rest stay at
   one until their chapters are rebuilt (a library build now rejects a
   picture lesson with fewer than two). 12 of the kept lessons
   teach a maths topic by a sentence to read, because Takhti can't yet draw
   scales, measuring jugs, rulers, mirror lines or maps — they
   pass the checks but check reading, not doing; the teacher sees a warning
   on the nine tagged with a maths skill, none on the three tagged with a
   reading skill (ch1 "Animal Names and Letters", "Grouping Objects", ch9
   "Word Numerals"). Clocks and calendars are drawn now (content/clock.js,
   content/calendar.js), and the teacher card draws them small like every
   other picture (`sylTeacherArt()` → `lesArt()` → `picArt()`). The builder drafts
   one chapter at a time with live calls (about three minutes each while
   the faster models are busy) — the half-price Batch API isn't used yet.
   The term is a list of chapters, one a week; a chapter taking two weeks
   or a school's own week dates aren't modelled. The book choice and term
   live on the teacher's phone only (no transfer to another phone). The EVS
   book (*Our Wondrous World* Class 5) has one chapter, written by Claude
   rather than Gemini; its answers count for one broad EVS skill
   (`v5-health`), so the twin tracks "health and hygiene" but not finer EVS
   topics (microbes, preserving food), and a teacher's own EVS upload still
   gets no EVS skill. Every
   lesson is the same for every school on the book; a teacher who wants
   something different still drafts from a chapter. The publisher's
   permission for lessons built from its book is a question for the lawyer
   (the lessons don't copy the book's text or figures).
18. **Gemini 4 Hydrogen is the default since 20 Nov 2026** (the Buildathon
   finals, Jaipur): released 12 Nov as the fast model of the Gemini 4 family
   and the successor of 3.8 Flash, it drafts lessons, hears and judges by
   default; 3.8 Flash and 3.5 Flash-Lite stay as the fallbacks. The first
   live check (20 Nov, Cloud Shell, paid key): as a judge Hydrogen answered
   all four in 3.0–4.5 s and got three right (a full English explanation
   only "partly": Munni gives a hint, never "wrong"), 3.8 Flash three in
   2–6 s, flash-lite all four but two of them in 11–14 s — so Hydrogen
   keeps the first 6 s. Hearing: every model wrote the line's "भाई" for the
   planted "बाई" (Hydrogen with the line took 34 s), as on 14 Nov — readings
   stay off Gemini. The live link (Cloud Run) has no reading check anyway.
   Drafting the same day (`try-syllabus`, a Class 3 shapes chapter):
   Hydrogen and 3.8 Flash each hung their full minute, flash-lite drafted
   in 16 s and repaired in 6 s — 3 of 3 usable (1 first time, 2 after the
   repair round), 136 s in all. So the live link runs drafting
   flash-lite first (`GEMINI_MODEL=gemini-3.5-flash-lite`,
   `GEMINI_FALLBACK_MODEL=gemini-4-hydrogen`) and judging on Hydrogen
   (`TAKHTI_TEACH_MODEL=gemini-4-hydrogen`) — set on the service, not in
   the code's defaults.
   The tests run against a stand-in; `tools/live-check.mjs` and
   `tools/try-syllabus.mjs` with the team's key are what show its real speed
   and quality — run them before the demo.
15. **Gemini as the speech provider is new (12 Nov 2026).** It is tested
   against a stand-in only. The real risk is that a model given the line
   "hears" the line — tidying a child's misreading the way the phone's
   recognizers do — so it is told to write what it hears, and the line is
   only a list of words to listen for; whether that holds for children
   reading Hindi is exactly what `tools/compare-speech.mjs` is for (run it
   on real recordings before the demo; switch with `SPEECH_PROVIDER=sarvam`
   if it doesn't). Gemini's docs list WebM among audio types, but the
   phone's `audio/webm` (Opus) clips haven't been tried against the live
   API. The TTS request follows the docs, which are inconsistent about the
   voice field (`voiceConfig.voice` vs `prebuiltVoiceConfig.voiceName`) —
   one retry covers both. `tools/live-check.mjs` (14 Nov) runs hearing, judging and
   TTS live, per model, before a demo — with an adult TTS voice, so passing is
   necessary, not enough. Its first run (14 Nov, paid key): TTS worked (4.8 s);
   `gemini-3.8-flash` and `gemini-3.7-flash` answered 503 or nothing in 35 s
   for every hearing and judging call; flash-lite answered but heard in 10–11 s
   (the phone allows 6), judged in 7–8.5 s, kept "run" for "ran" but wrote
   "red" back into "I like to eat apples" — the line pulled it into
   correcting — and judged the Hinglish ten-ones explanation only "partly".
   Those requests set no thinking level then (the newer Flash models think at
   length by default); now they ask for low, and the check hears each clip
   without the line too. The second run (14 Nov, low thinking): flash-lite
   heard in 1.6–2.8 s and judged all four explanations right in 0.9–1.8 s
   (Hinglish included) — but still tidied slips: with the line it wrote
   "भाई" for "बाई" and put "red" back; without it, "ran" for "run". The full
   Flash models were still 503 or silent. So, for now: readings to Sarvam
   (`SPEECH_PROVIDER=sarvam`), Teach Munni explanations still heard by
   Gemini (`TAKHTI_TEACH_HEAR=gemini` — judged on meaning, where a tidied word
   costs nothing) and judged by flash-lite (`TAKHTI_TEACH_MODEL`). The first
   run of `tools/compare-speech.mjs` on a person's own recordings (14 Nov,
   four clips, deliberate slips) found Sarvam's verbatim mode writing English
   in Devanagari ("द डॉग रन टू द पार्क" — "run" heard right, but unmatchable),
   so English lines now go to Sarvam as `codemix` (`SARVAM_EN_MODE`); Gemini
   hid "run" and invented "apple"; both wrote "भाई" for a "बाई", and did again
   for a fifth clip with a deliberately hard ब — so neither hears the ब/भ
   (aspiration) slip in an adult's voice, and Takhti can't yet catch that
   slip from speech (typed-back writing and "say it with Munni" still teach
   it). Its verdict is per language and counts only clips both providers
   answered (Gemini timed out on three in the second run); the Batch API's job state and inline answers
   appear under two field names in the docs, and both are read. Phone
   calls (Bolna) use the transcriber set in Bolna's dashboard — unchanged.
   The v3 terms wording is for the lawyer, not final.

## Style

Plain, dependency-free JavaScript in the app (`jsdom`, `acorn`, `acorn-walk`
are test-only dev dependencies; `@netlify/blobs` is used only by the server
function). Comments explain *why*, not *what*.
Child-facing copy is warm and short; never scold, never say "wrong" when
"almost" is true. Sound and celebration calls are guarded — a bonus, never a
dependency. Keep the judge trace (`log()`) honest: it must never claim
something happened that didn't.
