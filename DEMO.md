# Takhti — the demo, step by step

**The story in one line:** a teacher approves this week's aims once; two
children get two different paths to them; each child teaches Appu back; the
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
7. **For Gemini to judge Teach Appu live** (the Netlify link, or `npm run
   dev` with no voice server): turn the **signal** on (the pill at the top
   starts in airplane mode). The first time a child opens Teach Appu with a
   signal, a *FOR A GROWN-UP* card shows the terms (only the words go — no
   recording, no name; nothing kept): tap **I'm the parent or guardian, and I
   agree**. Each demo child asks once. On Netlify, `GEMINI_API_KEY` must be
   set in the site's environment variables. Without the signal or the terms,
   the phone's own rubric judges — the screen says which.

## The demo

| # | Do | Say |
|---|----|-----|
| 1 | Teacher view → the syllabus card. It starts on **Class 3** once the demo children are added (check it says so). Under *From the library*, choose **Maths Mela · NCERT**. | "The school tells us its book once. Every chapter was drafted ahead by Gemini and checked by Takhti — the teacher never waits, and needs no internet." |
| 2 | Show the term list; tap ↑ ↓ on a chapter. Then tap **This week** on **5. Fun with Shapes**. | "This is the school's term. The teacher moves chapters to match their own calendar." |
| 3 | Tap **Open this week's lessons**. Open one lesson's *Read the whole lesson*. | "The teacher sees the aims first, in plain points. Every answer was checked against the drawing — Gemini drafts, but it never decides what a child sees." |
| 4 | Tap **Approve all the checked lessons' aims**. Off camera, do 2–4 again for **12. Give and Take** (Kabir's borrowing lesson, *Taking away tens and ones*, is only there), then set **This week** back to chapter 5. Both chapters stay on the children's lists. | "One tap. That's the teacher's whole job for the week." |
| 4b | *(optional, needs internet and the voice server)* Upload a chapter PDF under *Or draft from a chapter now*. | "A chapter that isn't in the library yet is drafted live, through the same checks." |
| 5 | Scroll to **How each child is taking this week's lessons**. | "Same aims, but look: Asha gets pictures first, Kabir goes straight into the school's lesson. Munni chose from what has worked for each child before — measured, not a label." |
| 6 | Back to the map. Switch child to **Asha (demo)** → **The Story Fire**. | "This is Asha's phone. Her path is on screen, with the reason: 'this has worked for you on this topic'." |
| 7 | Tap the lesson. It opens a **picture lesson** first. Play it, then the school's lesson. | "Pictures first, then the school's own lesson as the check." |
| 8 | At the end tap **🐘 Teach Appu**. Agree to the grown-up's card once (step 7). Type or say an explanation. Point at the trace beside the phone: the T2 line says *judged by Gemini … each credit checked*, and Tier 2 lights up. | "Now Appu, Munni's little friend, 'forgets', and the child teaches him back. Gemini judges which points the explanation covered — but only by quoting the child's own words, and the phone checks the quote again. What the child can't explain becomes next week's gap — never a 'wrong'." |
| 9 | Switch to **Kabir (demo)** → **The Story Fire**. | "Kabir, same lesson — no pictures step. The story works for him." |
| 10 | *(maths, if a sums chapter is approved)* Kabir → Teach Appu on chapter 12's *Taking away tens and ones* (or chapter 4's *Finding Hidden Seeds*). When Appu reaches his sum, **Kabir's clip plays** (52 − 27, in Hindi) and stops on *क्या ये सही है, कबीर?* — tap 25, it carries on and ends on *हमने एक बंडल क्यों खोला?*; then tap the mic. Asha's (61 − 24, English) plays on a *borrowing* lesson's Teach Appu (her chapter-12 sum is a different mistake, so no clip there). | "Appu makes Kabir's own mistake — taking the smaller digit from the bigger — on video, and stops for Kabir to catch it. Then Kabir has to say why." |
| 11 | Back to the teacher view → **What the class could explain**. Read the green line at the top, then the ↻ lines under the borrowing points. | "For every point a child couldn't explain the first time, the teacher sees what happened next: Asha couldn't say what a borrowed ten becomes, Munni taught her again her way, and then she could. Kabir has been re-taught and Appu will ask him again. That is the loop — explain back, find the gap, re-teach, explain again — and it's measured, child by child." |

## Recording checklist

- Record from the **Cloud Run link** with the **signal on**. About 830 Hindi
  and 920 English lines have no recording yet; they only speak through
  Google's voice when online. With the signal off, Munni is silent on those
  lines and Gemini doesn't judge Teach Appu.
- After a redeploy, open `/health` and check `gemini: true`.
- Type a **name** in onboarding — left blank, the child is named after the
  animal ("Tiger"), on purpose for children who can't type yet.
- On the teacher screen, scroll past **What Takhti covers** (it honestly shows
  EVS at 0 and 73% of skills).
- On Teach Appu, point at the trace only when it says **judged by Gemini**.
  If it says *the phone judges*, these pass the phone's own check:
  Asha on *Square and Rectangle* — "it has four sides"; *Square Corners* —
  "it is a square corner, a right angle"; Kabir on *Taking away tens and
  ones* — "take one ten, it becomes ten ones".

## If something goes off-script

- **A demo child lands on a greeting screen:** tap through it once; it plays
  once a day per child.
- **Both children show the same path:** you approved a lesson for a topic the
  demo children have no record on. Use the shapes chapter: tap **This week** on chapter 5, or chapter 12 (*Give and Take*) for sums.
- **The library shows no book:** the class must be **Class 3**.
- **Teach Appu's microphone does nothing:** type the explanation. Voice
  needs the voice server (`npm run voice`), a signal and the reading terms —
  or, with no voice server, the phone's own recognizer (Chrome).
- **Gemini didn't judge it (the trace says "the phone judges"):** the signal
  is off, the grown-up's card wasn't agreed (parent page → *Teach Appu:
  checked by Gemini*), or the site has no `GEMINI_API_KEY`. `npm run dev` reads
  the key from `voice/.env` and serves `/api` (Ask me, the syllabus, Teach
  Munni's judge on words) on the same origin, like Cloud Run.
- **Appu's clip doesn't play (the slate shows instead):** the phone has never had the clip and has no signal, or the clip's list didn't load in time. The slate and Appu's voice carry on the same — or open Teach Appu once online first, and the phone keeps the clip.
- **Start clean:** teacher view → **Remove the demo children**, then add them
  again.

## What is real and what is staged

- **Real:** the library lessons (Gemini's drafts from the real NCERT chapter,
  passed by Takhti's checks), the paths, the teacher's cards, Teach Appu.
- **Staged, and labelled:** the two demo children's histories. They were
  written by the same functions a real child's answers go through, so the
  paths are what real children with those histories would get. Their Teach
  Appu loop (Asha: gap → re-taught → explained) was also written by Teach
  Appu's own session, heard by the phone's own rubric, with typed sentences
  standing in for a child's voice.
- **Not yet tested on real children:** Gemini hearing children read, and the
  Teach Appu judge on children's own words. The first live check (14 Nov)
  found Gemini writing the correct word over a child's slip, so readings go
  to Sarvam (`SPEECH_PROVIDER=sarvam`); explanations are still heard and
  judged by Gemini (`TAKHTI_TEACH_HEAR=gemini`, `TAKHTI_TEACH_MODEL=
  gemini-3.5-flash-lite`: all four test explanations right in under 2 s).
