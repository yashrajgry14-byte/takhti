# Takhti — working notes for Claude Code

A foundational literacy and numeracy tutor for Indian children aged 3–10
(four age bands in `content/ages.js`: 3–4, 5–6, 7–8, 9–10).
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

**One deliberate exception: hearing a child read.** With a signal, a line the
child reads (or a word said after Munni) is written down by Sarvam, under the
reading terms a parent accepts at onboarding (see **The reading check**) —
because no phone's own recognizer can hear a child's misreading reliably.
It never *serves* the lesson in the sense that matters: the grading, the
mistakes, the teaching are all on the phone; without a signal the phone's
own recognizer (or typing) takes over, and no answer in 10 s means the same.

| Tier | What it does | Where |
|------|--------------|-------|
| 0 | Reading matcher + age-band pass thresholds, stroke scoring, skill-shaped problem generation, shapes drawn and checked, adaptive level, daily scheduler, skill graph + diagnostic, spaced repetition, cartoon episodes, procedural sound | `src/core/`, `src/content/`, `src/games/` — always on, no network, no model |
| 1 | A fresh practice line for missed words | `core/tier1.js` — the curated bank everywhere; the phone's own on-device model (Chrome's Prompt API) where it already has one, strictly validated |
| 2 | Cloud answers for the question queue; class sync between phones; next week's lessons from the school's own syllabus (Gemini drafts, the phone checks) | `askCloud()` / `flushQueue()` via `api/ask.js`; `core/class-sync.js` via `api/class-sync.mjs`; `core/syllabus.js` via `api/syllabus.mjs` |

The app ships no model of its own. Tier 1 uses the phone's built-in on-device
model when the browser provides one (see **Tier 1**). "Generative" in
`core/generative-brain.js` means an episode assembled from the child's own
data (skill, level, game) by deterministic code — see **The Picture Hut**.

## Running it

```bash
npm run dev        # serves on http://localhost:5173
npm test           # all 38 test suites (see Testing)
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
content/literacy.js, content/comprehension.js, content/geometry.js
core/diagnose.js, core/class-share.js, core/class-sync.js, core/syllabus.js, core/generative-brain.js, core/video-library-catalog.js, core/cartoon-series.js
core/srs.js, core/sfx.js, games/game-core.js
content/anim.js, content/copy.js, content/competencies.js
core/log.js, core/store.js, core/profiles.js
core/voice.js, core/speech.js, core/matcher.js
core/adaptive.js, core/daily-engine.js, core/mathgen.js, core/readability.js, core/tier1.js, core/explain.js, core/mind.js, core/twin.js, core/lang-mistakes.js
ui/mascot.js, ui/readback.js, ui/elephant.js, ui/lesson-player.js, ui/anim-celebrate.js, ui/cards.js
ui/views.js, ui/opening.js
ui/arrival.js, ui/onboarding.js, ui/jungle-map.js, ui/video-player.js, ui/teacher.js
games/runner.js, games/pop.js, games/tower.js, games/match.js, games/sort.js, games/archer.js
ui/self-listen.js, ui/talk-munni.js, ui/cloud-read.js, ui/say-it.js, ui/circle.js, ui/ask-munni.js, ui/mind-ui.js, ui/handlers.js
app.js
```

`sw.js` caches the app shell as `takhti-v45` (recorded narration lives in a
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
    geometry.js             shapes: figure / corner / figures beats drawn as SVG, geoExpect() reads each answer off the drawing; 27 built-in lessons
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
    cloud-read.js           the reading check: online, a line goes to Sarvam (verbatim) under the reading terms accepted at onboarding; offline, the phone's own recognizer
    say-it.js               "say it with Munni": after a slip, the word in pieces in Sarvam's voice, the child says it, checked again
    circle.js               the learning circle's app side: the parent's sync tick, this week's step, the Friday check, the home question
    mind-ui.js              the mind on screen: missed sums and reading lines taught the child's way, "Munni's idea" on the map, the parent's "How … learns" and school marks; the twin's tip after a mistake and the parent's "How well Munni knows how … thinks"
    ask-munni.js            "Ask Munni": instant step-by-step help on the question on screen; "still stuck?" → Munni calls (in the app)
    handlers.js             event handlers
  app.js                    boot: load(), S.screen='arrival', render()
api/ask.js                  serverless proxy; keeps the API key off the client
api/class-sync.mjs          Tier 2 class sync (Netlify Blobs); syncCore() is the merge
api/syllabus.mjs            Tier 2: a chapter → Gemini drafts lessons in Takhti's format (draftCore(); also POST /syllabus on the voice server)
sw.js                       service worker — offline cache
voice/                      Munni on a phone call (Bolna), the learning circle's server, the shared mistakes database, the reading check's speech service — a separate Node server, see below
tools/build-audio.mjs       build-time narration (Sarvam or ElevenLabs) into audio/, played offline: lessons, reading lines, every word and its pieces, letters, Munni's coaching lines
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
  (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-3.8-flash`) for JSON in
  Takhti's lesson schema (structured output; one retry with the older field
  names). Google saying the model is busy (503/429) gets one more try a
  moment later, then the lighter `GEMINI_FALLBACK_MODEL`
  (`gemini-3.5-flash-lite`; `none` switches it off), which a 404 also moves
  to; all busy → "Gemini is busy right now". One model gets at most 60% of
  the time limit (55 s serverless, 180 s on the voice server), so a model
  that hangs leaves time for the fallback. The draft and the repair prompt
  share one description of the beats and the rules (`beatsText()`,
  `rulesText()`) — what each shape `ask` means, the school's Hindi words
  (चौकोर कोना, वर्ग…), teach-then-ask, a `why` that names the real mistake —
  and one worked example lesson, which the test runs through the checker so
  the two can't drift apart. A word beat's text is `word` in the drafting
  schema (a rectangle's `w` is a number). The class's skills offered are its
  own grade first, then the grades around it (a Class 3 shapes chapter
  reaches `shapes2d`, `angles`, `perimeter`). A PDF or photo goes as `inline_data`. `mode:'repair'` sends
  rejected lessons back with the checker's reasons. Drafts only; the key
  never leaves the server; `TAKHTI_SYLLABUS_KEY` (optional school password)
  and a per-address hourly limit.
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
  a wrong reading fails against the drawing. Then: something must teach (a
  teaching picture, a worked example or a passage) before the first
  question; a shape question mustn't name the shape it asks about; the Hindi
  answers are in Devanagari unless they are numbers. Every lesson carries its
  **aims** (1–4 bilingual "the child can …" points — required) and each
  question may carry a teacher-only `why` (why children pick the wrong
  answer); a question whose answer Munni has just said (`sylSaysIt()` over
  the narration since the last question — for a shape, its own picture's
  narration) is rejected, so the child works it out. A failure goes back to
  Gemini **once** with its reasons; still failing → shown as "not used",
  with why. The right answer is shuffled (stable, by content); the id is a
  hash of the content, so a lesson edited later gets a different id.
- **The teacher approves the aims** (`sylDraftHTML()`: the aims first, then
  the whole lesson folded underneath — every line, the right answer marked,
  how each answer was checked, the `why` notes, never shown to a child): `sylApprove()`
  / `sylApproveAll()` / `sylRemove()` write `_lessons {items, at}` (≤ 12)
  into the class mirror; with *Keep this class synced* on, the class sync
  carries them to every synced phone (teacher's key only; shape- and
  size-checked on the server, never trusted).
- **The child** sees *From your school — this week* at the Story Fire
  (`schoolLessonsHTML()`), from `schoolLessons()`, which re-runs both checks
  on this phone and drops any lesson whose id no longer matches. `startLesson()`
  finds them, never rewrites their words online (`enrichLesson()` is
  skipped), answers count for the lesson's skill when the checker matched
  one, and a reading lesson doesn't move the maths ladder.

## Shapes — `content/geometry.js`

Takhti draws shapes and checks shape questions the way it checks sums: the
answer must be readable off what is on the screen.

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
the one suite that loads the full graph): 46 concepts → 516 lessons, 0
rejected; 103 skills after dedup (126 raw, 23 absorbed); 57/103 = 55%
teachable (`test/diagnose.test.js`); Nursery–Class 3 subject coverage 63/63;
reading and writing ladders 6/6 each; 517 game-pool items (shape questions
stay out of the games — their answer is in a picture a game can't show).

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
  reads first), *chunks* (hard words in pieces), *solo*.
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

## The reading check — `ui/cloud-read.js`, `ui/say-it.js`, `voice/asr.js`

**Why Sarvam, not the phone.** Phones do have recognizers: Android's
on-device speech recognition (offline language packs, Hindi included on
many phones; `SpeechRecognizer.createOnDeviceSpeechRecognizer`, Android 12+),
Apple's on-device speech, and Chrome's on-device Web Speech
(`SpeechRecognition.available()/install()`, `processLocally`). All of them
are built for adults dictating and write down *dictionary words*: a child's
"बाई" for "भाई" comes back as "भाई", and the slip — the thing to teach —
is gone. Sarvam's `saaras:v3` in **verbatim** mode writes down what was said.

- **The terms, once, at onboarding** (`voiceTermsHTML()`, a grown-up step
  before the learning circle's, only with a voice server): what goes (a
  line read, or a word said after Munni), to whom (Takhti's voice server
  and Sarvam AI), that the recording is not kept, how to withdraw — in Hindi
  and English, one "I'm the parent or guardian, and I agree". Kept as
  `S.voiceTerms {v, at, by}` (`VOICE_TERMS_V`). Not a switch. The parent
  page shows the agreement and can **withdraw** it (the law's right, DPDP
  s.6(4)); withdrawn, nothing leaves the phone.
- **Who hears a turn** (`startListening()`): online with the terms →
  Sarvam (`cloudListen()` → `POST /reading/asr`), even where the phone has
  its own recognizer; offline → the phone's on-device recognizer
  (`listen()`), else typing; with a voice server and **no** terms, only the
  on-device recognizer — a general cloud recognizer never hears the child.
  The text is graded **on the phone** by the matcher; `S.ctx.heardBy` says
  who wrote it down. The recording is not kept anywhere.
- **Say it with Munni** (`say-it.js`): after a slip (a word read wrong
  starts it at once; an "almost" word on a pass offers a button) Munni says
  the word, its pieces slowly (akshara: भा · ई; syllables in English), the
  help for HOW it slipped (`langTip()`), the word slowly, at speed, then
  "now you say it". The child says it → Sarvam writes it down → `gradeWord()`.
  Right → "Yes! That is exactly it!" and "read the whole line again"; not
  yet → the pieces again, slower, with the help for the new slip; after two
  tries, "we'll say it again next time" — never "wrong". Help, not evidence:
  nothing recorded, only `mindTaught(…, 'chunks')`.
- **Munni's voice is Sarvam's** (`sayVoice()`): pre-rendered files
  (`tools/build-audio.mjs`: every word of every reading line, its pieces,
  her coaching lines) played offline by `core/voice.js`, slowed for pieces;
  a line not in the pack → Sarvam live (`POST /reading/tts`, short teaching
  lines only, cached); else the phone's own voice.
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
  child answers on screen. No network, so it works offline.
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
  Munni, to Sarvam for writing down — the reading terms at onboarding, not
  kept, withdrawable), and Talking Munni (below), off for every child until a parent
  turns it on behind the PIN after reading, in both languages, that the
  child's voice goes to the voice service while they talk (at the Pond, and
  in a game the talk carries on into, with the "Munni is with you" bar
  showing), and in Ask Munni's "still stuck? Munni calls", which the same
  switch allows and the same notice names. Nothing else
  ever sends a voice. Keep it true, and keep saying so in both languages.
- **A tutor, not a companion.** Bounded, task-scoped.
- **Every child-facing string ships in Hindi and English.**

## Testing

`npm test` runs 38 suites. Two methods: **vm** (real source in an isolated
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
| `speech` | vm + HTTP + jsdom | Sarvam against a stand-in: verbatim mode, Hindi, the key on the server only, nothing kept, consent, bogus recordings refused, per-address limit, honest 503, an OpenAI-compatible service; Munni's live voice (Bulbul, slow, cached, short lines only); in the app: no terms without a voice server, the bilingual terms at onboarding kept with version and time, online → Sarvam even with a recognizer on the phone, the slip named, **say it with Munni** (the word in pieces in Sarvam's voice, the child says it, checked, praised; two tries then let go kindly; help not evidence), offline → the on-device recognizer and nothing sent, withdrawn → nothing sent, no answer → the honest message; on a call the word in pieces; the narration builder |
| `syllabus` | vm + HTTP + jsdom | the server against a stand-in Gemini (key in a header on the server only, the PDF and the band's rules and schema in the request, the older field names, 503 with no key, the school key, PDF/photo only, a limit per address, the repair round with the checker's reasons, the voice server's `POST /syllabus`); the class sync carries lessons from the teacher's key only; the phone's checks (a good maths and reading lesson pass; a wrong sum, an answer not in the passage, markup, over the band's ceiling, an undrawable beat, an unequal share, non-Devanagari Hindi, a non-number maths answer all fail with a reason; idempotent; shuffled); in the app: draft → one repaired, one "not used" → approve → remove; offline honest; the child's "From your school" (EN/HI), played, never rewritten, evidence for its skill; an edited lesson not shown; the sync sends them |
| `geometry` | vm + jsdom | answers read off the drawing (sides, corners, names, perimeter, equal sides, the centre, corner kinds, a numbered row, the odd one out), in English and Hindi; the checker rejects a wrong marked answer, a disagreeing Hindi answer, two right answers, a figure that doesn't say what it asks, an equal-sided "rectangle", an impossible triangle, a row with two matches, a number over the ceiling, an undrawable shape; the 27 built-in lessons pass, a question's picture is never named or measured aloud, Ask Munni's hint never says the answer, clean SVGs, labels hidden while counting, no shape question in the games, drafted fields sanitised; in the app: the picture stays on screen during the question, the answer counts for the skill, Ask Munni's how-to-look help, a drafted shape lesson checked against its drawing |
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
   and offline reading. The jsdom suites also fail their "no uncaught errors"
   check on a machine that can't reach Google Fonts (a sandbox with no open
   internet), which is the network, not the app.
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
   10 s → the typed fallback; offline, the phone's recognizer, which misses
   some slips. Its endpoints are open to any browser (rate-limited per
   address), like Talking Munni's minting. The terms are an in-app
   agreement with a timestamp — the team's T&C and lawyer decide the final
   wording, whether accepting them may be a condition of using the app,
   and the DPDP Rules' verifiable parental consent (same caveat as 8);
   Sarvam needs a data-processing agreement. Children's speech through
   Sarvam is untested on real children. Builds without a voice server keep
   the old path (the browser's own recognizer online). The narration isn't
   rendered for Hindi yet (English has 439 lines of the old set): run
   `tools/build-audio.mjs --lang hi --provider sarvam`.

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
   worked example and `sylTidy()`. Not yet re-run.

## Style

Plain, dependency-free JavaScript in the app (`jsdom`, `acorn`, `acorn-walk`
are test-only dev dependencies; `@netlify/blobs` is used only by the server
function). Comments explain *why*, not *what*.
Child-facing copy is warm and short; never scold, never say "wrong" when
"almost" is true. Sound and celebration calls are guarded — a bonus, never a
dependency. Keep the judge trace (`log()`) honest: it must never claim
something happened that didn't.
