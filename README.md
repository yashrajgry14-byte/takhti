# तख़्ती · Takhti

**The slate that listens.** A foundational literacy and numeracy tutor for
Indian children, built for the phone a family already owns and the signal they
often don't have.

> The network loads tomorrow. It never serves today.

Every lesson runs on-device and works in airplane mode. When a signal appears,
the app answers saved questions and pre-fetches new content in the background.
Same app, same code, for the child on fibre in Gurugram and the child with two
bars a week in rural Punjab. The difference is latency, not capability.

---

## Run it

```bash
npm run dev
```

Then open <http://localhost:5173>. No build step, no bundler, no framework —
plain HTML, CSS and JavaScript.

Serve it rather than opening `index.html` directly; the camera and network
calls need a real origin.

## Deploy it

Any static host works. The only server-side piece is the Tier 2 proxy that
keeps the API key off the client.

**Vercel**

```bash
vercel deploy
vercel env add ANTHROPIC_API_KEY
```

`api/ask.js` is picked up automatically.

**Netlify** — `netlify.toml` is already configured; set `ANTHROPIC_API_KEY` in
site settings.

**Anywhere else / no key at all** — it still runs. Every cloud call is wrapped;
when the proxy is missing the app falls back to the on-device content pack and
nothing visibly breaks. That is the architecture, not a workaround.

---

## What's in it

**Three practice loops, all offline**

- **Read aloud** — speech in, graded word by word against the target sentence,
  with four states: correct, *almost*, misread, skipped. Hindi and English.
- **Write** — trace on screen with pixel-level stroke scoring, or write in a
  real notebook and photograph it; the photo is checked on-device for ink and
  line count, then the child types back what they wrote.
- **Count** — levelled problems with three animated explainers: objects,
  number line, and array grids for multiplication.

**A reason to come back**

The child picks a favourite game from twenty — cricket, kabaddi, pithoo, gilli
danda, chupan chupai, stapu and the rest. Every session opens with a short
animation built from that game, ending in an impact that knocks a learning card
loose.

Seven card formats — fact, quiz, animated explainer, world, new word, story,
challenge — drawn as a shuffled bag so **each appears exactly once a week**.
No two days in a row are ever the same shape. The order is adaptive: a child
weak at reading gets word and story days pulled forward; a child weak at
counting gets challenge and quiz.

**Read it back**

Any card can be read aloud by the child. Long text is chunked into breathable
lines, graded against what's on screen, and when it goes wrong the app marks the
exact word, says what it heard instead, and offers to drill that single word
before returning to the line.

**For the parent**

Daily targets they set themselves, accuracy per module, the notebook shelf of
photographed handwriting, and the whole report read aloud — because many of the
parents we're building for read less fluently than their child soon will.

No streaks. No reminder notifications to children. See `CLAUDE.md` for why that
is a deliberate constraint and not an oversight.

---

## Demo notes

- The **network toggle** at the top of the page fakes connectivity. Ask a
  question in airplane mode, flip it on, and watch the saved chit resolve into
  a cached answer that then plays offline forever.
- **Tomorrow →** on any daily card steps the scheduler forward. Press it four
  times to show Monday's fact become Tuesday's quiz become Wednesday's
  animation, with the same child and the same game.
- The **right-hand panel** traces which tier is running. It exists for judges,
  not children.
- Browser speech recognition routes through the Web Speech API and needs a
  connection. On Android this is replaced by an on-device recognizer — which is
  why every speaking task has a keyboard fallback.

## Working on it

Read `CLAUDE.md` first. It covers the tier architecture, the Devanagari
matching rules that are easy to break, the product constraints that are not
negotiable, and the next tasks worth doing.
