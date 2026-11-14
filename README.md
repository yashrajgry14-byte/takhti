# तख़्ती · Takhti

**A tutor that learns how each child thinks.**

Schools give every child a Takhti account. From then on, an AI builds a
*digital mind* of that child from their own answers: it names the exact
mistake behind each wrong answer, knows what they're forgetting, predicts
their next answer, and keeps finding better ways to teach them. It works
offline on any phone, and over a plain phone call for children who have no
smartphone or data. The child's school, teacher, parents and tutor stay in
step on one learning goal a week.

> The network loads tomorrow. It never serves today.

**Teaching today:** ages 3–10 (Nursery to Class 5) — reading, writing and
arithmetic, in Hindi and English: letters to reading with understanding,
tracing to writing, counting to carrying, tables and BODMAS.
**Next:** up to Class 10 and every Indian language. Lessons from each
school's own syllabus have started: a teacher uploads a chapter, Gemini
drafts the week's lessons, Takhti checks every one.

**Build status:** web prototype on `main` (offline shell `takhti-v61`, 43 test
suites); the voice server has had its first live Bolna call. The Android app
ports the same logic to Kotlin (`ANDROID.md`).

---

## Why

India has about 250 million children in school (UDISE+ 2024–25), and many fall
behind on the basics early: in ASER 2024 only about half of rural Class 5
children could read a Class 2 text, and fewer than 30% could do a basic
division. One teacher, thirty children, one way of teaching — and no way to see
*why* each child got it wrong.

---

## What's built

### The digital mind of each child
`src/core/twin.js`, `src/core/mind.js`, `src/core/lang-mistakes.js`, `src/core/mathgen.js`

- **Names the mistake.** Not just "wrong": 38 + 24 = 52 is a dropped carry,
  512 is each column written down on its own, बाई for भाई is a missing puff of
  air, a mirrored letter is a mirrored letter. Sums are worked column by column
  the way children really work them, so even a combination nobody listed
  ("lined up on the left *and* forgot to carry") is understood — and kept only
  when it explains answers to two different questions.
- **Knows what's fading.** One live number per skill (knowledge tracing): what
  the child knows today, and what they're starting to forget.
- **Predicts the answer.** Before each question it guesses what the child will
  say — the wrong answer too — and checks itself. How often it's right is an
  honest measure of how well Takhti understands that child.
- **Changes how it teaches.** Objects, steps, a story or a cartoon: it keeps the
  way that works for this child, topic by topic, and switches when one doesn't.
  School marks count too.
- **A mistake made twice decides the next explanation.**

### Reading, writing, arithmetic — offline
Takhti draws shapes too — squares, rectangles, triangles, circles and corners —
and checks a shape question the way it checks a sum: the answer must be readable
off the drawing on screen. Seven places on a jungle map: the Reading Tree (read aloud, graded word by
word), the Sand Patch (trace, or write in a notebook), Counting Stones, the
Story Fire (story lessons and homework), the Play Clearing (six games), the
Picture Hut (cartoon episodes for one maths skill each) and Munni's Pond.
Lessons are generated and checked on the phone; nothing waits for a network.

### Hearing a child read — Gemini (Sarvam as backup)
With the reading terms a parent accepts at sign-up, a line the child reads is
written down by Google's Gemini — what was said, not a tidied sentence — and
graded on the phone. Sarvam (verbatim mode) is the backup, and one setting
(`SPEECH_PROVIDER=sarvam`) makes it the reading check again; a day-1 script
(`tools/compare-speech.mjs`) compares the two on real children's recordings.
Munni's voice is built ahead with Gemini TTS and ships offline. **Say it with Munni:** after a slip, Munni
teaches the word in pieces (भा · ई), slowly, then whole, the child says it, and
it's checked again. Offline, the phone's own recognizer takes over.

### Lessons from the school's own syllabus — Gemini
A teacher uploads a chapter: a PDF, a photo of the textbook page, or the text.
Gemini drafts a few short lessons in Takhti's own lesson format. Then Takhti's
lesson checker tests every one on the phone: the arithmetic of each answer,
numbers right for the age, sentence lengths, that a reading answer is really
in the passage, that no answer is given away just before its question, plain
text only. A lesson that fails goes back to Gemini once with the checker's
reasons. Each lesson comes with its aims in a few plain points; the teacher
approves the aims,
and the class gets it at the Story Fire, offline. Every child's phone checks
it again before showing it. Gemini prepares next week; it never decides what a
child sees. → `api/syllabus.mjs`, `src/core/syllabus.js`

### Ask Munni
A help button on every question: Munni breaks it down the way a teacher would
— make ten, tens then ones, borrow a ten, a hard word in pieces — and never
says the answer. Still stuck? Munni calls, inside the app.

### Teach Munni
Elephants never forget — but Munni does, on purpose. After a lesson she
forgets its aims and the child teaches them back, out loud, while each aim's
chip turns green. For a sum, Munni makes the child's own habitual mistake and
the child catches it and explains it. Two hints at most, then "we'll figure it
out together later"; the gap is taught again the child's way and Munni forgets
it again. Online, Gemini judges which aims the explanation covered and must
quote the child for each; offline, Takhti's own rubric does. Parents see how
their child explains; the teacher sees which aims the class could explain.
→ `src/core/teachback.js`, `src/ui/teach-munni.js`, `api/teachback.mjs`

### Munni on a phone call — Bolna
For children with no smartphone or data, Munni calls at the family's chosen
time. The Bolna voice agent speaks; our server plans every question, grades
it, aims each clue at the child's own mistake and re-checks reading from the
transcript. Bolna also runs parent consent and weekly calls, placement calls,
teachers' voice notes and class-wide calls to parents. → `voice/README.md`

### The learning circle — the school ecosystem
The class teacher, parents, tuition teacher, the app and Munni's calls all work
on **one step a week**: class homework adapted to each child's gap, a Friday
check, a home activity for a grown-up, a tutor's pack, WhatsApp updates to
grown-ups. A teacher view diagnoses the class and assigns homework. A shared,
nameless database of mistakes makes every child's tutor smarter.

Without the voice server, a class still stays in step: with a parent's
switch, each phone syncs practice counts with the teacher's phone once an
hour and whenever a signal returns (`core/class-sync.js`), and homework comes
back down. Phones that rarely see a signal pass short progress and homework
codes instead, over WhatsApp or SMS.

### Privacy, by design
The child's mind stays on the phone. Only a short summary — ids, no name —
travels, and only where a parent agreed. Recordings for the reading check are
not kept. No streaks, no reminders to children (India's DPDP Act s.9).

---

## Run it

```bash
npm run dev                                   # the app, on http://localhost:5173
npm test                                      # 38 test suites
npm run voice:sim -- --auto --mistakes        # a whole Munni phone call, in the terminal
```

No build step, no bundler, no framework — plain HTML, CSS and JavaScript.
Serve it rather than opening `index.html` directly (camera, microphone and
storage need a real origin).

**The voice server** (phone calls, the learning circle, the reading check):
`cd voice && cp .env.example .env`, fill in the keys (Bolna, Gemini, Sarvam as backup), then
`npm run voice`. Full setup in `voice/README.md`.

**Deploying the app:** any static host. The app's server pieces are optional:
`api/ask.js` (answers to saved questions), `api/class-sync.mjs` (the hourly
class sync, which needs Netlify Blobs) and `api/syllabus.mjs` (lessons from a
chapter; set `GEMINI_API_KEY`, or run it on the voice server as
`POST /syllabus`). Without them the app still
runs on its on-device content, and classes use codes.

---

## Demo notes

- The **network toggle** at the top fakes connectivity: everything a child does
  keeps working in airplane mode.
- The **right-hand panel** is the judges' trace: which tier ran, the mistake
  named, the digital mind's guess *before* the answer and whether it was right.
- **For parents →** (behind a PIN) shows *How … learns* and *How well Munni
  knows how … thinks*, in Hindi and English.
- **Tomorrow →** on a daily card steps the week forward.

## Read more

- `CLAUDE.md` — the architecture as it actually stands, every subsystem, the
  constraints that aren't negotiable, and honest known limitations
- `voice/README.md` — Munni on Bolna, the learning circle's server, the
  reading check
- `CURRICULUM.md`, `ANDROID.md`
