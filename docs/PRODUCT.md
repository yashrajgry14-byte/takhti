# Takhti — the product and the decisions behind it

What Takhti is, who it is for, and the decisions that shape what gets built.
`CLAUDE.md` describes the code as it stands; `docs/DEVELOPMENTS.md` is the
dated log of what has been built; `docs/master-format-plan.md` is the plan
for lessons from each school's own books. Read this one first.

Last updated: 11 Nov 2026.

## What Takhti is

An **offline-first literacy and numeracy tutor for Indian children aged
3–10** (Nursery to Class 5), in **Hindi and English today**, with an
elephant mascot, **Munni**. Reading, writing and arithmetic: letters to
reading with understanding, tracing to writing, counting to carrying,
tables and BODMAS.

- **Next:** up to **Class 10**, and **every Indian language** — Sarvam for
  hearing and speaking the languages, Bolna for the voice channel.
- **Who pays:** schools (B2B). Lessons are aligned to **each partner
  school's own books and to NCERT** (see `docs/master-format-plan.md`).
- **How it reaches children:** the app on any phone, working offline; and a
  plain phone call with Munni (Bolna) for children with no smartphone or
  data.

## The vision

Takhti is **not a general AI tutor**. It builds a **"digital mind" of each
child** that keeps learning *how that child learns* and teaches to match.

- **Measured from the child's own answers.** Which way of teaching works for
  this child, topic by topic (`core/mind.js`); what they know, what is
  fading, and the exact mistake behind each wrong answer (`core/twin.js`).
- **Never learning-style labels.** No "visual learner" / VARK types —
  matching lessons to such labels hasn't held up in research. A way of
  teaching is kept only because this child's own answers show it works,
  and dropped when they show it doesn't.

## Decided (Nov 2026): one app

**Takhti is the single master product.** KidMonk — a K-12 practice app —
and its **"Forgetful Monk"** AI voice teach-back (the child explains the
concept back to a monk who has "forgotten" it) are **folded into Takhti**,
not kept as a separate app.

The two halves have different jobs and share one syllabus:

| | Takhti's teaching | The teach-back mode |
|---|---|---|
| Job | Teaches the concepts a child **couldn't learn at school** | **Practises and tests at home** what the school taught |
| Input | The school's syllabus and books | The same syllabus and books |
| Driven by | The child's digital mind | The teacher's weekly lesson |

The teacher updates the weekly lesson. The child explains it back at home.
**Wherever the teach-back shows a weak point, the child is rerouted into
Takhti's teaching** for exactly that point.

**Status:** the teach-back mode is **not built yet** — there is no
teach-back, KidMonk or Forgetful Monk code on any branch (checked 11 Nov
2026). The parts it would stand on do exist: the twin names mistakes and
the mind picks the remedy; Talking Munni and the Bolna server already run
bounded voice conversations; the learning circle carries a weekly focus
from the teacher; the `syllabus-gemini` branch turns a school's chapter
into lessons.

## What we pitch and build

**Only this loop:**

> **explain-back → weak points found → remediation**

The child explains a concept back; Takhti finds the weak points from what
they said; Takhti teaches those points the way that works for this child.
Work that doesn't serve this loop is not the build focus.

## Rules that stand

- **The cloud never runs a lesson.** "The network loads tomorrow. It never
  serves today." Everything a child does in a session runs on the phone;
  the cloud prepares future content and answers saved questions. The one
  deliberate exception is hearing a child read (next rule) — and even then
  grading and teaching stay on the phone, and no signal means the phone's
  own recognizer or typing.
- **The Sarvam voice reading check is part of the onboarding terms**
  parents accept — not an optional toggle. (In code: one "I'm the parent
  or guardian, and I agree" step at onboarding in any build with a voice
  server, `ui/cloud-read.js`. The parent page can still withdraw it, which
  is the law's right under DPDP s.6(4); withdrawn, nothing leaves the
  phone.)
- **Children's data law — counsel's view.** The team's lawyer advised
  (31 Oct 2026) that edtech use like Takhti's is exempt from the DPDP Act
  s.9(3) limits on tracking and behavioural monitoring of children. **This
  is counsel's view, not a guarantee.** The child's model stays on the
  phone regardless, which is the safest design either way.
- **No streaks, no reminder notifications to children** (DPDP s.9,
  addictive design). Stars only ever grow.
- **No learning-style labels.** "Fastest way to learn" is always measured
  from the child's own answers.
- **Original content only.** Munni and Gauri are ours. Lessons built from a
  school's book teach its aims with original passages and numbers, never
  the book's text.
- **Photos and voice never leave the phone**, except where a parent agreed:
  the reading check, and Talking Munni (off until a parent turns it on).
- **Every child-facing string ships in Hindi and English.**
- **A tutor, not a companion.** Bounded and task-scoped.

## Audiences

- **Schools (B2B)** — the customer. They give us their books and term plan,
  approve the weekly aims, and see each child's progress.
- **Y Combinator** — the pitch: the explain-back → weak points →
  remediation loop, built on a digital mind of each child.
- **The Google buildathon** (AI Studio / Antigravity / Gemini track) —
  Gemini builds the school's lessons ahead of time; the demo is a book in,
  aims approved, two children taught the same aim two different ways
  (`docs/master-format-plan.md`).
