# Takhti — the master-format library (plan)

## The idea, in one line
The school tells us its book → we map it to the syllabus → we break it into master
lessons, prepared ahead → the teacher approves the aims in a few plain points → each
child's own brain module teaches those aims in the way that child learns fastest.

## The flow
1. School setup — per class and subject: which book (board, title, edition) and the
   school's term plan.
2. Book map — book → chapters → topics, mapped to the school's syllabus weeks and to
   Takhti's skill graph.
3. Master lessons (built ahead, in a content pack) — one per topic:
   - Aims: 3–5 plain points a teacher can approve ("can subtract two-digit numbers with
     borrowing").
   - Skills (our graph ids), prerequisites, mistakes to watch (our MISTAKES ids).
   - Teaching variants: maths = show / steps / story / cartoon; reading = Munni reads
     first / word in pieces / on your own. Each variant at 2–3 difficulty steps, in our
     lesson-beat format.
   - Practice pool and a 3-question check (the Friday check) that measures the aims.
   - Every variant passes Takhti's checker (arithmetic, age-band numbers, sentence
     length, answers grounded, both languages) before it enters the library.
4. Teacher approval — the teacher sees only the aims per week, in short points, and taps
   approve or edit. They can reorder weeks to match the school calendar.
5. Each child's brain module (already built: the mind + the twin) takes the approved
   master lesson and: skips what the child already knows and starts at the gap
   underneath; picks the teaching variant that works for this child (and switches if it
   doesn't stick); aims practice at the mistakes this child keeps making; measures the
   aims with the check and reports to teacher and parent.

## Why build ahead, not live
- Fits "the network loads tomorrow": the library ships as an offline pack; nothing waits
  for Gemini in a lesson.
- Each lesson is checked once, by the checker and by our team, then reused by every
  school using that book.
- Cheaper: built with the Gemini Batch API (half price), once per book.

## What already exists in the repo
- The checker (validateLesson, sylClean), the repair round with Gemini, teacher approval,
  sync to phones (branch syllabus-gemini).
- The child's brain: core/mind.js (which way works), core/twin.js (what they know, what
  fades, their mistakes, guesses), the Friday check, the skill graph.
- To build: the book map + master-format schema, the library builder
  (tools/build-library), the teacher's "approve the aims" screen, and the child's planner
  that turns a master lesson into this child's path.

## Google AI Pro — what to use
- AI Studio: Gemini API key; test the "chapter → master lesson" prompt on a real chapter.
- $10/month Google Cloud credits (Google Developer Program premium, part of AI Pro) for
  the Gemini API; paid-tier use means our content isn't used for training.
- Batch API: build the library offline at 50% off.
- Antigravity: the build environment for the pipeline.
- NotebookLM (up to 300 sources): load the book + syllabus to check mapping and aims.
- Optional: Jules for background coding; Nano Banana Pro for original lesson pictures.

## Risks to settle
- Book rights. NCERT books are free to download but NCERT holds copyright; derived
  lessons for a paid product need permission. Private publishers need a licence. Our
  lessons teach the aims with original passages and numbers, never the book's text.
  Get the lawyer's view.
- "Fastest way to learn" must stay measured, from the child's own answers; no
  learning-style labels.
- The checker catches wrong answers and unsuitable content, not a lesson that teaches
  badly; team review and the teacher's aims approval cover that.

## Order of work
1. Pick one book (e.g. NCERT Class 3 maths, Maths Mela) and one chapter.
2. Key + credits in AI Studio; test the prompt on that chapter.
3. Build: master-format schema → library builder → aims-approval screen → child planner.
4. Buildathon demo: book in → aims approved → two children taught the same aim two
   different ways.
