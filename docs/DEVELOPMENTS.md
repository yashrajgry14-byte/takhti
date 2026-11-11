# Takhti — what has been built (dated log)

A dated record of what is built and where it lives. Each item was checked
against the code on 11 Nov 2026 (`main` at `f58146d`, and the
`syllabus-gemini` branch at `2b29bb1`). Markers:

- **✓** found in the repo (file and function named)
- **≠** found, but different from how it is usually described (the
  difference is spelled out)
- **✗ not found in repo**

Dates are commit dates (UTC). `CLAUDE.md` has the full detail of every
subsystem; this file is the timeline and the status.

## Where things stand (11 Nov 2026)

- `main` — web prototype; offline shell `takhti-v40`; **36 test suites,
  all passing**. Includes the whole voice layer (merged 6 Nov).
- `syllabus-gemini` — one commit on top of `main`, **not merged yet**:
  the school's chapter → Gemini drafts lessons → the phone checks them →
  the teacher approves → sync to phones. Cache `takhti-v41`, 37 suites.
- `voice-bolna` — fully merged into `main` (nothing on it that `main`
  lacks).

## Timeline

### Aug–Sep 2026 — the offline tutor
- **24–25 Aug** — first app: offline-first literacy tutor, PWA, age bands,
  lessons, Munni, daylight theme (`22be596` … `72f3c15`).
- **1 Sep** — home scene, 339 lessons, profile guards (`7bd4c19`).
- **16 Sep** — self-listen, the jungle map, arrival, onboarding, the six
  game shells, spaced repetition, homework (`f7c05e0`).

### 24 Oct 2026 — honest offline, class codes, Tier 1
- ✓ On-device speech recognition for offline reading
  (`core/speech.js`, `prepareOfflineSpeech()`), SRS surfaced through the map
  and dashboard, the cartoon episode builder (`core/generative-brain.js`)
  (`ff1f016`, `7b8956e`).
- ✓ Progress and homework codes between phones over WhatsApp/SMS
  (`core/class-share.js`) (`14629f2`).
- ✓ **Gemini Nano writes practice lines on the device**: `core/tier1.js`
  uses Chrome's built-in Prompt API (`LanguageModel`, which runs Gemini
  Nano), only if the model is already on the phone, and only lines that
  `t1Valid()` accepts; otherwise the curated bank (`14629f2`). The code
  calls it "the phone's on-device model" and doesn't name Gemini.
- ✓ **Hourly class sync** (`core/class-sync.js` ↔ `api/class-sync.mjs`,
  Netlify Blobs): hourly, on reconnect, and *Sync now*; parent consent per
  child; codes stay as the no-internet fallback (`67c1b3b`).
- ✓ Munni voice lessons over the phone begin (`voice/`, `563acef`,
  `d3c5625`).

### 25 Oct 2026 — the Bolna voice layer
All on the `voice-bolna` branch, merged into `main` on 6 Nov.

- ✓ **Phone lessons** — a Node server plans, grades and records every
  question while the Bolna agent only speaks (`voice/session.js`,
  `voice/takhti-core.js`, `voice/report.js` re-grades reading from the
  transcript).
- ✓ **Inbound line** — a registered child can call Munni
  (`/voice/inbound/lookup` in `voice/server.js`; daily limit, quiet hours;
  siblings matched by sound, `voice/sounds.js`) (`a7f40d3`).
- ✓ **Keypad support** — `dtmf_number` answers, `*` repeats, 1/2 for yes/no
  (`voice/understand.js`, `voice/agent/build-agent.js`) (`a7f40d3`).
- ✓ **Spoken English practice** — `voice/english.js` (`englishPlan()`,
  `buildEnglishItem()`), a parent's per-child choice (`a7f40d3`).
- ✓ **Talking Munni** — in-app voice calls through the Bolna Web Call SDK
  (`ui/talk-munni.js`, `voice/web.js`), parent opt-in (`a7f40d3`);
  **carries on into the games** (`TALK_KEEP`, `talkFollow()`, the "Munni is
  with you" bar) (`1df127d`).
- ✓ **Parent consent and weekly calls** — `voice/parent.js`,
  `confirmConsent()` (settled from the transcript), `weekFacts()`; WhatsApp +
  call sequences through Bolna Workflows (`voice/flow.js`,
  `voice/agent/build-workflow.js`) (`ad8b92d`).
- ✓ **School and placement calls** — per-school keys and Bolna
  sub-accounts (`createSchool()`, `envFor()` in `voice/brain.js`); the
  placement call (`voice/placement.js`) (`cefcb3f`).
- ✓ **Teacher voice notes** — `voice/notes.js`, tool `takhti_note`
  (`cefcb3f`).
- ✓ **Class-wide parent calls** — `classParentCalls()` in `voice/brain.js`
  (`cefcb3f`).
- ✓ Misreading corpus (`voice/corpus.js`) and noticing when a child goes
  quiet (`cefcb3f`, `1df127d`).
- ✓ **The learning circle** — school, parents, tutors, calls and the app on
  one weekly focus (`voice/circle.js`, `ui/circle.js`) (`9c97d14`); under
  parent control: the sync tick, **sync off and erasure reach the server**
  (`POST /circle/leave`) (`a76e678`), and **a teacher can withdraw the
  class homework**, which the app then drops (`clearClassFocus()`)
  (`cdc5fb6`).
- ✓ **The first live Bolna call is done** — 26 Oct 2026 IST (late 25 Oct
  UTC): greeting, Sarvam hearing "yes" and "8", the first tool call worked;
  the faults it found were fixed in the agent builder (`769e177`,
  `d3a64e7`; `voice/BOLNA-QUESTIONS.md` "From the first live call").
- ✓ **Ask Munni** — instant step-by-step hints on the phone, never the
  final answer (`ui/ask-munni.js` `askFab()`, `core/explain.js`
  `explainMath()`/`explainRead()`); "still stuck?" opens a Munni call about
  that one question (`voice/help.js`) (`9210417`).

### 31 Oct 2026 — the digital mind
- ✓ **The mind** — which way of teaching works for this child, topic by
  topic, measured from their own answers; switches when one doesn't stick
  (`core/mind.js` `mindChoose()`/`mindAttempt()`, `ui/mind-ui.js`)
  (`4cbe079`).
- ✓ Counsel's view on DPDP s.9(3) recorded in `CLAUDE.md` (`7195460`).
- ✓ **The twin** (`core/twin.js`) (`f5ec450`, `176e3b6`, `a7fb9fc`):
  - names the exact mistake through a **column-procedure arithmetic
    engine** (`core/mathgen.js` `procAnswers()`/`procMatches()`, `MISTAKES`)
    plus a **reading/writing mistake taxonomy** (`core/lang-mistakes.js`
    `wordMistake()`, `lineMistakes()`, `inkMistakes()`);
  - tracks knowledge **with forgetting** (`twinObserve()`/`twinMastery()`,
    Bayesian knowledge tracing with a half-life);
  - **predicts the answer before checking it** (`twinExpect()` →
    `twinCheck()`, scored by `twinScore()`);
  - shares a **privacy-safe profile** — ids only, no name, checked on both
    ends (`twinProfile()`/`twinCleanProfile()`).
- ✓ **The shared cross-child mistake database** — `voice/mistakes.js`:
  combinations found in 3+ children (`TAKHTI_MISTAKE_MIN_CHILDREN`), counted
  by a keyed hash, promoted to every app on sync (`176e3b6`).
- ✓ **Sarvam reading check** — `ui/cloud-read.js` + `voice/asr.js`
  (`saaras:v3`, verbatim) (`fca19f7`). **Part of the onboarding terms**:
  `voiceTermsHTML()` is a single "I'm the parent or guardian, and I agree"
  step, no switch. **≠** It appears only in builds with a voice server
  (`TALK_URL`); a build without one has no terms step and uses the browser's
  recognizer. The parent page can withdraw the terms (DPDP s.6(4)), and then
  nothing leaves the phone.
- ✓ **"Say it with Munni"** word correction — `ui/say-it.js`: the word in
  pieces in Sarvam's voice, the child says it, checked again (`fca19f7`).

### 6–9 Nov 2026 — merged
- ✓ **voice-bolna merged into main** — merge commit `70830d1` (6 Nov):
  voice channel, learning circle, mind, twin, reading check, alongside
  `main`'s hourly class sync. **≠** The commit message doesn't name a pull
  request, and the PR number (#1) couldn't be checked from this machine (no
  GitHub CLI); the merge itself is in `main`.
- ✓ Offline shell **`takhti-v40`** (`sw.js`), 36 suites (`f58146d`, 9 Nov).

### 11 Nov 2026 — `syllabus-gemini` (not merged)
Commit `2b29bb1`, one commit on top of `main`:
- ✓ The teacher uploads a chapter (PDF, photo of the page, or text) in the
  teacher view (`ui/teacher.js` `syllabusHTML()`, `sylDraft()`).
- ✓ `api/syllabus.mjs` (`draftCore()`; also `POST /syllabus` on the voice
  server) asks Gemini (`GEMINI_API_KEY`, default `gemini-3.5-flash`) for
  lessons in Takhti's lesson format with structured output.
- ✓ **The checker** on the phone — `sylClean()` (`core/syllabus.js`) then
  `validateLesson()` (`core/lesson-gen.js`): arithmetic of each answer, the
  band's number ceiling and sentence lengths, reading answers grounded in
  the passage, plain text, drawable pictures, both languages.
- ✓ **The Gemini repair round** — rejected lessons go back once with the
  checker's reasons (`mode: 'repair'`).
- ✓ **Teacher approval** — `sylApprove()`/`sylApproveAll()`/`sylRemove()`.
- ✓ **Sync to phones** — approved lessons travel with the class sync
  (teacher's key only); each phone re-checks them before the Story Fire
  shows them under "From your school" (`schoolLessons()`).
- `test/syllabus.test.js` (40 checks), cache `takhti-v41`, 37 suites.

## Docs that need a correction

- **≠ `ANDROID.md` is not a Kotlin port.** It is the guide to installing
  the PWA on an Android phone (Vercel or USB port-forwarding, add to home
  screen, airplane-mode check) and to wrapping it as an APK (PWABuilder,
  Capacitor). It says the Kotlin rewrite is "the real destination"; **no
  Kotlin code is in the repo**.
- **≠ `api/ask.js` uses Claude, not Gemini.** The saved-question queue goes
  to the Anthropic API (`TAKHTI_MODEL`, default `claude-sonnet-5`).

## Not built yet

- **✗ not found in repo** — the KidMonk / "Forgetful Monk" teach-back mode
  and the explain-back → weak points → remediation loop (`docs/PRODUCT.md`).
- **✗ not found in repo** — the master-format library: the book map, the
  master-lesson schema, `tools/build-library`, the "approve the aims"
  screen, the child's planner (`docs/master-format-plan.md`).

## Planned Gemini features for the buildathon

| # | Feature | Status in the repo |
|---|---|---|
| 1 | Syllabus/textbook → master lessons | **Started** on `syllabus-gemini`: chapter → checked lessons → teacher approval → phones. The master format itself (aims, variants, the Friday check per topic, built ahead in batch) **✗ not found in repo**. |
| 2 | Reading a photo of the child's notebook handwriting | **✗ not found in repo.** Today the paper mode photographs the page, checks on the phone only that there is ink (`handlers.js`), and the child types the line back; the photo stays on the phone. |
| 3 | Answering saved questions with Gemini | **✗ not found in repo.** The queue exists (`askCloud()`/`flushQueue()`), answered by Claude through `api/ask.js`. |
| 4 | Weekly teacher/parent reports in their own language | **✗ not found in repo** as a Gemini feature. What exists: the Bolna weekly progress call to parents (`voice/parent.js`, Hindi/English), the teacher's Saturday digest (`voice/messages.js`, `voice/schedule.js`) and class page (`voice/circle-pages.js`), the parent dashboard in Hindi/English. |
| — | Gemini Nano writes practice lines on the device | **✓ already built** (`core/tier1.js`, Chrome Prompt API). |
