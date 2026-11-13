# Takhti — the demo, step by step

**The story in one line:** a teacher approves this week's aims once; two
children get two different paths to them; each child teaches Munni back; the
teacher sees who took which path and what the class could explain.

About 6 minutes. Everything below works **with no internet** except the
optional live step (4b).

## Before you start (once)

1. In the `takhti` folder: `git pull`, then `npm run dev`.
2. Open **http://localhost:5173** in Chrome. Press F12 → the phone icon, so
   it looks like a phone.
3. Go through the arrival, tap an animal, pick age **8**, pick a game. This is
   your one real child.
4. On the map: **For parents →**, set a PIN, then **For teachers →**.
5. Type a class code, e.g. `DEMO01`, and tap **Open class**.
6. Scroll to the bottom: **DEMO CLASS → Add two demo children**.
   This adds *Asha (demo)* and *Kabir (demo)*. They are labelled as demo data,
   are never synced, and **Remove the demo children** deletes both.

## The demo

| # | Do | Say |
|---|----|-----|
| 1 | Teacher view → the syllabus card. Pick **Class 3**. Under *From the library*, choose **Maths Mela · NCERT**. | "The school tells us its book once. Every chapter was drafted ahead by Gemini and checked by Takhti — the teacher never waits, and needs no internet." |
| 2 | Show the term list; tap ↑ ↓ on a chapter. | "This is the school's term. The teacher moves chapters to match their own calendar." |
| 3 | Tap **Open this week's lessons**. Open one lesson's *Read the whole lesson*. | "The teacher sees the aims first, in plain points. Every answer was checked against the drawing — Gemini drafts, but it never decides what a child sees." |
| 4 | Tap **Approve all the checked lessons' aims**. | "One tap. That's the teacher's whole job for the week." |
| 4b | *(optional, needs internet and the voice server)* Upload a chapter PDF under *Or draft from a chapter now*. | "A chapter that isn't in the library yet is drafted live, through the same checks." |
| 5 | Scroll to **How each child is taking this week's lessons**. | "Same aims, but look: Asha gets pictures first, Kabir goes straight into the school's lesson. Munni chose from what has worked for each child before — measured, not a label." |
| 6 | Back to the map. Switch child to **Asha (demo)** → **The Story Fire**. | "This is Asha's phone. Her path is on screen, with the reason: 'this has worked for you on this topic'." |
| 7 | Tap the lesson. It opens a **picture lesson** first. Play it, then the school's lesson. | "Pictures first, then the school's own lesson as the check." |
| 8 | At the end tap **🐘 Teach Munni**. Type or say an explanation. | "Now Munni 'forgets', and the child teaches her back. What the child can't explain becomes next week's gap — never a 'wrong'." |
| 9 | Switch to **Kabir (demo)** → **The Story Fire**. | "Kabir, same lesson — no pictures step. The story works for him." |
| 10 | *(maths, if a sums chapter is approved)* Kabir → Teach Munni on a borrowing lesson. | "Munni makes Kabir's own mistake — taking the smaller digit from the bigger — and he has to catch it." |
| 11 | Back to the teacher view → **What the class could explain**. | "The teacher sees, per aim, who could explain it. That closes the loop: explain back → weak points → re-teaching." |

## If something goes off-script

- **A demo child lands on a greeting screen:** tap through it once; it plays
  once a day per child.
- **Both children show the same path:** you approved a lesson for a topic the
  demo children have no record on. Use the shapes chapter (chapter 5).
- **The library shows no book:** the class must be **Class 3**.
- **Teach Munni's microphone does nothing:** type the explanation. Voice
  needs the voice server (`npm run voice`), a signal and the reading terms.
- **Start clean:** teacher view → **Remove the demo children**, then add them
  again.

## What is real and what is staged

- **Real:** the library lessons (Gemini's drafts from the real NCERT chapter,
  passed by Takhti's checks), the paths, the teacher's cards, Teach Munni.
- **Staged, and labelled:** the two demo children's histories. They were
  written by the same functions a real child's answers go through, so the
  paths are what real children with those histories would get.
- **Not yet tested on real children:** Gemini hearing children read, and the
  Teach Munni judge on children's own words.
