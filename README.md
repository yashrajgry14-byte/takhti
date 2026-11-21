# तख़्ती · Takhti

**The school's lesson, taught the way each child learns — and then the child
teaches it back.**

*Google Startup Buildathon India 2026 · team Gladiators*

One teacher, thirty children, one way of teaching, and no way to see *why*
each child got it wrong. Takhti closes that loop for every child, on any
phone, offline:

1. **The school's book becomes lessons.** The teacher picks the class's
   textbook. Gemini drafted every chapter ahead of time and Takhti checked every
   answer against its own sum or drawing; the teacher approves the week's aims
   in a few plain points. In the library now: NCERT *Maths Mela* Class 3, all
   14 chapters.
2. **Each child gets their own path to those aims**, worked out on the phone
   from their own answers: already knows it → show it; a gap underneath → that
   first; otherwise the way that has worked for *this* child — pictures, a
   cartoon or the story; Munni reading first, or hard words in pieces. After
   the school's lesson, one more question a step harder or easier, from how
   their answers went.
3. **Then the child teaches it back.** Appu, Munni's little elephant friend,
   "forgets" the lesson, and the child explains it out loud. For a sum, Appu makes the child's *own*
   habitual mistake, and the child has to catch it. Gemini judges which points
   the explanation covered, and must quote the child for each.
4. **Gaps come back.** A point the child couldn't explain is taught again their
   way, and Appu asks again. The teacher sees it per point, by name: who
   explained it first time, who couldn't, who was taught again and then
   could — and who gets the questions right but can't explain it yet.

**Who pays:** schools, and government or CSR programmes; families get Takhti
through their child's school.

**Where Google's AI is:**

| | |
|---|---|
| Lessons from the textbook | Gemini drafts them in Takhti's lesson format; Takhti's checker tests every answer; the teacher approves. Gemini never decides what a child sees. |
| Teach Appu | Gemini writes down the child's explanation and judges it, quoting the child for every point it credits (checked again on the phone). |
| Munni's voice | Gemini TTS, built ahead and shipped offline. |
| Hearing a child read | Sarvam (verbatim). Our tests on deliberate misreadings (14 Nov) found Gemini writing the right word over a child's slip, so readings go to Sarvam and Gemini stays on what it judges well. |

**Next to Google's Read Along:** Read Along helps a child read aloud and
shows the teacher how accurately and fast they read. Takhti teaches the
school's own NCERT lessons, maths included (sums, shapes, clocks), then has
the child explain each lesson back to Appu, so the teacher sees, point by
point, who can do it and who can explain it. The two fit together: Read
Along for reading fluency, Takhti for understanding the week's lessons.

> The network loads tomorrow. It never serves today. Everything a child does
> in a lesson runs on the phone; the cloud prepares next week.

**Teaching today:** ages 3–10 (Nursery to Class 5): reading, writing,
arithmetic and shapes, in Hindi and English. **Each age uses it its own way:**
Nursery–LKG get Story Time (short stories told by Munni, with moments to tap
and count, pick a picture or say it aloud — no menus to read); UKG adds
Munni's pick of what to do and its own stories (adding, taking away, blending
sounds); Class 1 up gets the full jungle map, and up to Class 2 Munni reads
every question and choice aloud. Five short videos teach the hardest topics
(tens and ones, carrying, borrowing, the मात्रा, the clock) and stop to ask
the child; a filmed teacher replaces each animated version once the team
films it (`video/SCRIPTS.md`). A parent can switch the simple home and the
reading aloud on or off; how long a child plays is up to the parent.
**Next:** more books, more classes, every Indian language.

**Build status:** web prototype on `main` (offline shell `takhti-v101`, 54 test
suites). The lesson library was built with live Gemini calls; Gemini's hearing,
judging and voice have been run live (`tools/live-check.mjs`); the voice server
has had its first live Bolna call. Nothing has been tried with real children
yet. The Android app ports the same logic to Kotlin (`ANDROID.md`).
`DEMO.md` is the step-by-step demo script.

---

## The core loop: learn → teach Appu → fix the gap

1. **Learn.** This week's lesson comes from the school's own textbook
   (Gemini drafts it, Takhti checks it, the teacher approves its aims in a
   few plain points), and each child gets their own path to those aims —
   pictures first, the cartoon, the story, or straight in if they already
   know it — chosen from what has actually worked for that child.
2. **Teach Appu.** Elephants never forget, but Appu does, on purpose: he
   "forgets" the aims and the child teaches them back out loud — in the
   app, at the end of a phone call, and with a parent at home.
3. **Judge each aim.** Gemini decides which aims the explanation covered and
   must quote the child's own words for each credit; offline, Takhti's own
   rubric decides. Two hints at most, then "we'll figure it out together
   later" — never "wrong".
4. **Fix the gap.** An aim the child couldn't explain is taught again in the
   way that works for them, then Appu forgets it again until every aim is
   green. The teacher sees what the class could explain; the parent sees
   how their child explains.

## Built with Google

| Google component | What it does in Takhti | Where |
|---|---|---|
| **Gemini API — structured output** (`gemini-4-hydrogen`, falling back to `gemini-3.8-flash` and `gemini-3.5-flash-lite`) | Turns a textbook chapter (PDF, photo or text) into lessons in Takhti's own format, one JSON schema per lesson-step type, each with its teacher-approved aims; a failed lesson goes back once with the checker's reasons | `api/syllabus.mjs`, `tools/try-syllabus.mjs`, `tools/build-library.mjs` |
| **Gemini — audio understanding** | Writes down what a child *said* when reading aloud (बाई stays बाई, not भाई) and when explaining to Appu; the phone grades it | `voice/speech.js` |
| **Gemini — the judge** | Decides which aims a child's explanation covered, quoting the child for every credit; an unquoted credit is downgraded on the server and again on the phone | `api/teachback.mjs` |
| **Gemini TTS + Batch API** | Munni's voice, built ahead at half price and shipped offline, so a lesson never waits for the network | `tools/build-audio.mjs` |
| **Chrome built-in AI (Prompt API, on-device Gemini Nano)** | Writes a fresh practice line for the words a child missed, on the phone, with no network — only if the model is already there, and strictly checked | `src/core/tier1.js` |
| **Chrome on-device speech recognition** | Hears a child read with no network at all, once the language pack is downloaded | `src/core/speech.js` |
| **Google AI Studio** | Prompt testing on real NCERT chapters and the Gemini API key | — |

The rule that keeps all of it safe for a lesson: **the network loads
tomorrow; it never serves today.** Gemini prepares next week's lessons and
judges explanations; it never decides what a child sees, and never writes a
word the child hears.

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

### Hearing a child read — Sarvam, with Gemini for explanations
With the reading terms a parent accepts at sign-up, a line the child reads is
written down by a speech service — what was said, not a tidied sentence — and
graded on the phone. Which service is one setting (`SPEECH_PROVIDER`), chosen
on evidence: `tools/compare-speech.mjs` runs real recordings with deliberate
slips through Gemini and Sarvam, and `tools/live-check.mjs` times every Gemini
call against the phone's budget. On 14 Nov Sarvam kept the English slips and
Gemini tidied them, so readings go to Sarvam; a Teach Appu explanation is
judged on meaning, so Gemini still hears those (`TAKHTI_TEACH_HEAR`). Munni's
voice is built ahead with Gemini TTS and ships offline. **Say it with Munni:**
after a slip, Munni teaches the word in pieces (भा · ई), slowly, then whole,
the child says it, and it's checked again. Offline, the phone's own recognizer
takes over.

### The lesson library — one book, built ahead
A school says which book it teaches from; every chapter of that book is
already drafted by Gemini, checked by Takhti and kept only if it passes
(`tools/build-library.mjs`). The teacher lays out the term, opens this week's
chapter, approves its aims, and the class has its lessons with no network and
no waiting. NCERT *Maths Mela* Class 3 is in: all 14 chapters. Some topics —
time, measuring, weighing, symmetry, maps — still need their own pictures
(a clock face is being built now), and the teacher is warned on each lesson
that teaches only in words. → `library/`, `src/core/library.js`

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

**The lesson library:** a school only says which book it teaches from. Each
book is built once, ahead of time (`tools/build-library.mjs`: every chapter
through the same draft → check → one repair), and ships offline, so every
school on that book gets the same checked lessons with no waiting. The
teacher picks the book, orders its chapters to the school calendar and
approves each week's aims, offline. → `library/`, `src/core/library.js`

### Ask Munni
A help button on every question: Munni breaks it down the way a teacher would
— make ten, tens then ones, borrow a ten, a hard word in pieces — and never
says the answer. Still stuck? Munni calls, inside the app.

### Teach Appu
Elephants never forget — but Appu, Munni's little elephant friend, does, on
purpose. After a lesson he forgets its aims and the child teaches them back, out loud, while each aim's
chip turns green. For a sum, Appu makes the child's own habitual mistake and
the child catches it and explains it. Two hints at most, then "we'll figure it
out together later"; the gap is taught again the child's way and Appu forgets
it again. Online, Gemini judges which aims the explanation covered and must
quote the child for each; offline, Takhti's own rubric does. Parents see how
their child explains; the teacher sees which aims the class could explain,
and for each child who couldn't at first, whether they could after being
taught again.

**On a phone call, too:** at the end of a call Appu forgets up to two points
of a topic the child is really working on (the teacher's homework, a mistake
they keep making, or what they've practised) and the child teaches them back
by voice — the same aims, hints and rules as the app, run by the same code.
**And at home:** the parent's Wednesday "teach" activity asks Appu's own
question, with his clue and what a full answer says, so a parent can listen
the way Appu does — a point the child couldn't yet explain comes first.
→ `src/core/teachback.js`, `src/ui/teach-munni.js`, `api/teachback.mjs`, `voice/session.js`, `voice/circle.js`

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
npm run dev                                   # the app + /api, on http://localhost:5173 (key from voice/.env)
npm test                                      # 44 test suites
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
`POST /syllabus`) and `api/teachback.mjs` (Teach Appu's Gemini judge, words
only, the same `GEMINI_API_KEY`; the app uses it when there is no voice
server, under the words terms a grown-up agrees to). Without them the app still
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
