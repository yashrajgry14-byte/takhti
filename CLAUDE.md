# Takhti — working notes for Claude Code

A foundational literacy and numeracy tutor for Indian children aged roughly 5–10.
Built for the iQOO Hackathon 2026, Smart Education track. This repo is the web
prototype; the Android build ports the same logic to Kotlin + Compose.

## The one rule that explains the architecture

**The network loads tomorrow. It never serves today.**

Everything a child does in a session runs on-device and is deterministic. The
cloud only answers the saved question queue and pre-fetches future content. If
you are ever tempted to put a network call in the path of a lesson, don't — that
breaks the entire premise and the demo.

Three tiers, and the child never sees which one is running:

| Tier | What it does | Where |
|------|--------------|-------|
| 0 | Reading matcher, stroke scoring, photo check, problem generation, adaptive level, daily scheduler | `src/core/` — always on, no network, no model |
| 1 | Small language model for fresh sentences and kid-language explanations | `tier1Explain()` in `handlers.js` — a stub; enhances Tier 0, never gates it |
| 2 | Cloud answers + storyboards for the question queue | `askCloud()` / `flushQueue()` via `api/ask.js` |

## Running it

```bash
npm run dev        # serves on http://localhost:5173
```

No build step, no bundler, no framework. Open `index.html` through the dev
server (not `file://` — the camera and fetch need an origin).

## Why plain script tags, not ES modules

The views render HTML strings containing `onclick="..."` handlers. Those need
their functions on `window`. ES modules scope everything, so the handlers would
silently break. **Load order in `index.html` is therefore load-bearing** — if
you add a file, put it after everything it calls at load time. In particular
`core/log.js` must come before `core/speech.js`, and `ui/readback.js` before
`ui/cards.js`.

## Layout

```
src/
  config.js              Tier 2 endpoint; falls back to on-device when absent
  state.js               S — the single global state object
  content/
    sentences.js         reading + copying lines, EN and HI, 6 levels
    games.js             20 games: tokens for the opening animation + a quiz
    facts.js             60 facts (3 per game) with hero numbers and units
    anim.js              which animation template each game uses
    copy.js              UI strings, EN and HI
  core/
    log.js               the judge-facing trace panel
    speech.js            TTS with voice fallback; attr()/sayEl() for safe audio buttons
    matcher.js           the reading matcher — see below
    adaptive.js          rolling-window levelling + daily goal counters
    daily-engine.js      the weekly format scheduler + world/word content pools
    mathgen.js           levelled problem generation
  ui/
    mascot.js            Gauri, an SVG chalk sparrow
    readback.js          child reads the screen aloud, graded and coached
    cards.js             the seven daily card formats + animation scenes
    views.js             screens: greet, pick, open, home, read, write, math, ask, parent
    opening.js           the greeting → animation → impact → card timeline
    handlers.js          all event handlers
  app.js                 boot
api/ask.js               serverless proxy; keeps the API key off the client
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

There is a test table in `Testing` below. Extend it rather than eyeballing.

## Product constraints that are not negotiable

- **No streaks, no reminder notifications to children.** India's DPDP Act
  s.9 bars addictive design patterns aimed at minors, with penalties up to
  ₹200 crore. Retention comes from the week strip showing *variety*, not from
  guilt. If you add a habit mechanic, it must only ever grow.
- **Original IP only.** No Chhota Bheem, no licensed characters, anywhere —
  in the app or the pitch. Gauri the sparrow is ours.
- **Photos never leave the device.** The notebook shelf is local-only and the
  permission card says so in both languages. Keep it true.
- **This is a tutor, not a companion.** Bounded, task-scoped. No open-ended
  persona chat with a child. See *Garcia v. Character Technologies* for why.
- **Every child-facing string ships in Hindi and English.** If you add copy in
  one language only, you have introduced a bug.

## Testing

There is no test runner yet. The highest-value thing to add:

```
test/matcher.test.js   table of [lang, target, transcript, expected score band]
```

Cases that must keep passing (real recognizer output, all should score 90+):
`रोज़`→`रोज`, `बड़ा`→`बडा`, `ऊँचे`→`ऊंचे`, `मेरी`→`मेरि`.
Cases that must fail: a genuinely skipped word (~65), a misread line (~25).

## Good next tasks

1. **Persistence.** Everything is in-memory and dies on refresh. Add a thin
   `store.js` wrapping `localStorage` behind `load()`/`save()` so the Android
   port can swap in Room without touching callers.
2. **Multi-child profiles.** One phone, several siblings, and it belongs to a
   parent. Profile switcher + a kid-lock on the parent dashboard.
3. **Real Hindi TTS check.** `speak()` logs when no Hindi voice exists. On
   Android this becomes `TextToSpeech` with the Hindi language pack.
4. **Offline STT.** The browser recognizer needs a connection. The Android
   build uses `EXTRA_PREFER_OFFLINE`, with Vosk (`vosk-model-small-hi-0.22`,
   ~42MB) bundled as insurance if the OEM ROM's recognizer disappoints.
5. **NCERT / NIPUN Bharat mapping.** Name the six levels after real
   competencies so a teacher recognizes them.

## Style

Plain, dependency-free JavaScript. Comments explain *why*, not *what*. Child-
facing copy is warm and short; never scold, never say "wrong" when "almost"
is true. Keep the judge trace panel (`log()`) informative — it is how the
architecture becomes visible in a three-minute demo.
