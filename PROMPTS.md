# Claude Code prompts

Copy-paste these in order. Run `claude` from inside this folder — it reads
`CLAUDE.md` automatically, so you never need to explain the project.

---

## 0 · Constraints (paste once, at the start of every session)

> Three constraints for this session. One: don't convert the scripts to ES
> modules — the inline onclick handlers need functions on window, and modules
> would silently break every button. Two: don't touch src/core/matcher.js
> without adding tests first; the Devanagari folding is subtle and easy to
> break without noticing. Three: every child-facing string you add must exist
> in both Hindi and English.

---

## 1 · Audit before editing

> Read CLAUDE.md and README.md, then give me a short map of how the app
> actually flows at runtime — from boot, through the opening sequence, to a
> child finishing one reading task. Tell me the three places you think are
> most likely to break, and anything in the code that contradicts what
> CLAUDE.md claims. Don't change anything yet.

Worth the two minutes. It finds drift, and its summary teaches you the codebase.

---

## 2 · Persistence — do this first

Everything is in memory and dies on refresh. This is the most embarrassing
thing that could happen during a live demo.

> Add src/core/store.js: a thin wrapper over localStorage exposing load() and
> save(), persisting the parts of S that should survive a refresh — name, game,
> levels, attempts, correct, targets, today, stars, day, photos, answered,
> queue. Reset `today` when the calendar date changes. Save on a debounce after
> record(), and load once at boot before the first render(). Keep the interface
> narrow enough that the Android port can swap in Room without touching callers.
> Don't persist S.ctx or S.rb. Add it to the load order in index.html.

---

## 3 · A test table for the matcher

> Add test/matcher.test.js — a plain Node script, no framework, run with
> `node test/matcher.test.js`. Table-driven: [lang, target, transcript,
> expected score band]. Include every case listed in CLAUDE.md under Testing,
> plus at least eight more Hindi cases covering nukta drift, matra length,
> anusvara vs chandrabindu, skipped words, extra words, and a genuinely misread
> line. Print a pass/fail table and exit non-zero on failure. Add an npm test
> script.

---

## 4 · Multi-child profiles

One phone, several siblings, and it belongs to a parent.

> Add profile switching: up to 4 children, each with their own name, game,
> levels and progress. Put the switcher on the home screen and a simple 4-digit
> PIN gate on the parent dashboard. Follow the existing state and view patterns,
> and make it work with store.js so profiles survive a refresh.

---

## 5 · More content — the cheapest quality win

> The Hindi sentence bank in src/content/sentences.js is thin at levels 3–6,
> and GLYPHS only has a few Devanagari letters. Expand both: 6–8 sentences per
> level per language, graded by word count and syllable complexity, and a full
> set of Devanagari letters and simple words across the six writing levels.
> Keep the existing structure exactly. Sentences should use vocabulary an
> Indian child aged 5–10 actually encounters.

---

## 6 · NIPUN Bharat mapping

> Map the six levels in each module to real NCERT / NIPUN Bharat foundational
> literacy and numeracy competencies, so a teacher recognises them. Add the
> competency name to the level display in both languages, and document the
> mapping in a new CURRICULUM.md.

---

## 7 · Before the demo

> Do a demo-readiness pass. Check every button reaches a working state, no
> screen can trap the child with no way back, the app degrades cleanly with no
> network and no microphone, and nothing in the console errors during a full
> walkthrough. Report what you found before fixing anything.

---

## Things to push back on

Claude Code will be tempted to modernise this — React, a bundler, TypeScript,
ES modules. Every one of those makes the Kotlin port harder and the demo more
fragile, and none makes the app better for a child in a village school. The
dependency-free, no-build-step design is a decision, not an accident. If it
proposes a refactor, ask what it buys you before the 29th.
