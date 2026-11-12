# Takhti voice — Munni on a phone call

Munni calls a family. The child does a short lesson on the phone: a warm-up
count, three sums that adapt as they go, one story problem, and two or three
lines that they read from **today's card**. The parent gets a short report.
It works on any phone, with no app and no data.

```
 Bolna (phone line, speech-to-text, voice model, text-to-speech)
   │  welcome: "{{greeting}}"  → graph agent: start → lesson → end
   │                                      │
   │        takhti_next / takhti_answer   │  (the only two tools, lesson node only)
   ▼                                      ▼
 voice/server.js ── voice/brain.js ── voice/session.js ── src/ (unchanged, loaded in a vm)
   │                                      matcher + band thresholds · genProblem · skillProblem
   │                                      record() → SRS · skill graph · diagnose · class codes
   │                                      lesson generator + validator
   └─ after the call: Bolna webhook → voice/report.js
        re-grades reading from Bolna's own transcript → parent report + WhatsApp link
```

**The voice model never teaches.** It speaks the `say` text our server returns,
word for word, and passes back what the child said. Choosing the problem,
grading it, giving a clue and deciding when to stop all happen in
`voice/session.js`, using the app's own engine. That is the phone version of
the rule in `lesson-gen.js`: an LLM never decides what a child sees, or here,
hears.

**The app is unchanged.** Lessons on the slate still run fully on-device. The
phone is a separate channel and needs the network by its nature. It only
*reads* `src/`, loading the same files the tests load.

## Five ways in

| | What it is | Where |
|---|---|---|
| **Munni calls** | the outbound lesson call | `placeCall()`, dashboard *Call now* |
| **The child calls Munni** | the inbound line: Munni knows registered numbers, asks siblings who's calling, and keeps a daily limit and quiet hours | `/voice/inbound/lookup` |
| **Keypad answers** | press the number (`#` to finish), `*` to hear it again, 1 / 2 for yes / no. Munni offers this after an unheard answer | `understand.js` `keypadOf()` |
| **Spoken English** | a parent's per-child choice, alternating with the normal lesson: Hindi meaning → English word, short phrases said back, graded by sound | `english.js`, `sounds.js` |
| **Talking Munni in the app** | parent opt-in. A live voice talk at Munni's Pond, with the line to read on screen and tap choices that Munni answers instantly through event injection. It carries on into the games: the lesson pauses, and a missed answer gets the right one from the server's own validated lesson bank (the phone sends only the item id), at most one line every 6 s. A "Munni is with you" bar stays on screen | `web.js` + `src/ui/talk-munni.js` |

## When a child goes quiet

A child going quiet is something to notice, not a wrong answer.
- **During the call:** after Munni's own repeat, the graph's `hush` node tells
  the tutor `(silence)`. The first time, Munni gives an easier way into the
  same question: two choices instead of recall, or the first words of the
  line. A right answer then doesn't count as a first try. The second time,
  she moves to a different question. Nothing is recorded as an attempt.
- **After the call:** the transcript is checked too (a line said twice with
  nothing from the child in between, or the call ending on the quiet
  goodbye), so quiet moments are counted even if the live signal never
  arrives.
- **Where it shows:** a gentle line in the parent report ("went quiet on two
  questions: a quiet moment often means a question felt hard"), and the next
  call starts with an extra easy warm-up, as the report says. The weekly call
  and "is she behind?" mention where the child went quiet most. On the
  dashboard there's a count per child and per skill, plus a **check in with
  the family** flag after two calls in a week ended in silence. That flag is
  for a person; nothing is sent to anyone automatically. The placement call
  counts quiet steps as "not yet seen", never as mistakes.

## For parents

| | What it is | Where |
|---|---|---|
| **Consent call** | the first call to a family. Munni says who she is, what Takhti keeps, that Bolna turns the call into text, and how to stop or delete everything. Then she asks one yes/no at a time: may Munni call the child, may calls be recorded. Then the time, the days and the weekly call. Nobody calls the child before it | `parent.js`, `POST /voice/admin/children/:id/consent-call` |
| **Weekly progress call** | Sunday, at the parent's time, in the parent's language. The week from the child's real record, then questions: *is she behind?*, *what should we do at home?*, reading, maths, English, homework, privacy. A parent can change the time, switch on English practice, stop the weekly call or pause lessons, on the call | `parent.js`, `schedule.js` |
| **Daily sequence** | at the time the parent chose: WhatsApp the reading card, call the child, WhatsApp three lines after. Nobody answers → one retry half an hour later → WhatsApp what happens next | Bolna Workflow (`agent/build-workflow.js`) + `flow.js`; without a workflow, `schedule.js` calls directly and retries once |

**Consent is settled from the transcript, not the live relay.** After the
consent call, the parent's reply to each consent question is taken from
Bolna's own transcript and must agree with what was relayed live. A
disagreement, or a reply missing from the transcript, goes to **needs
review**: a person listens (the dashboard links the call) and presses *I
heard a clear yes*. A muddled answer, "pata nahi" or silence is never a yes.
A doubtful recording answer means no recording.

**Missed calls say only what will really happen.** "She will try once more
at 5:30", or "the next call is on Wednesday at 5", or nothing at all. The
scheduler never calls in quiet hours, never twice a day, never if the child
already practised that day, and never without consent. Nothing ever goes to
a child except the lesson itself, at a time a parent picked: no reminders
and no "you missed a day" (DPDP s.9).

## For schools

| | What it is | Where |
|---|---|---|
| **One account per school** | each school gets its own admin key (shown once, only a hash kept) and sees only its own children, calls and teachers. With a Bolna sub-account key, its calls run on that account; its inbound number only knows its own families | `brain.createSchool()`, `envFor()`, `POST /voice/admin/schools` |
| **Placement call** | for a new admission (tick *placement* when adding the child): a binary search up the spoken-maths ladder, two sums a step, then two more at the boundary so each side has four real attempts, then one reading line per level. It sets the starting levels and fills the skill history the teacher's diagnosis reads | `placement.js`, `npm run voice:sim -- --kind placement --auto` |
| **Teacher voice notes** | a teacher rings the same Munni number and says "Riya confused ण and न today". The child is matched by sound within that teacher's classes only. Munni asks for anything missing, reads the note back and saves it on a yes, as one observed attempt on the skill. For a difficulty, it's also what the next calls practise: the sum in the story slot, or reading lines with those letters | `notes.js`, the `teacher` node in the child agent |
| **Class-wide parent calls** | *Call all parents* on a class: the gap the class shares (or a skill the teacher picks), where each family's own child stands on it, one thing to do at home. Only families who consented, never in quiet hours, never twice a day. Spoken-maths skills become what the next calls practise | `brain.classParentCalls()`, `POST /voice/admin/classes/:code/parent-calls` |
| **Misreading corpus** | what children actually read for each word, and letter swaps (ण→न), from transcript-graded readings. Only children whose parent said yes to this separate question on the consent call; no names, ids or audio; a heard form appears only once `TAKHTI_CORPUS_MIN_CHILDREN` children produced it | `corpus.js`, `GET /voice/admin/corpus(.csv)` |

Questions for the Bolna team, one per assumption we made, are in
[`BOLNA-QUESTIONS.md`](BOLNA-QUESTIONS.md).

## The learning circle

Everyone around one child works on **one step a week**: the class teacher,
the parents, the tuition teacher, Munni on calls, and the app. This server is
where they meet (`circle.js`, `circle-pages.js`, `messages.js`, `evidence.js`).

| | What happens | Where |
|---|---|---|
| **The parent's tick** | in the app (end of onboarding, or the dashboard) a parent ticks *Always keep in sync*. Only then the app sends **progress**: levels, skill history, counts, the Friday check, home answers. Never a voice, a photo or a typed question. A school's 8-letter **family code** joins the phone to the school's record of the same child | `POST /circle/sync`, `ui/circle.js` |
| **One weekly focus** | the class homework adapted to *this* child's gap underneath (a child weak on skip counting who is set tables works on skip counting), else last Friday's suggestion, a teacher's note, the weakest step, the placement result. The same step on the map, in the Story Fire, in the call's homework slot, in the tutor's pack and in the parent's message | `focusFor()` |
| **Friday check to the teacher** | Friday to Sunday, three questions on the week's step, in the app or on a call (the same three). The verdict (mastered / nearly / not yet) and next week's step go to the teacher's Saturday digest and class page. A reading focus is checked from the week's transcript-graded reading | `checkResult()`, `readingCheck()` |
| **Home loop with the parent** | two activities a week: one to *do* (Monday) and one where the child *teaches* the grown-up (Wednesday). The parent marks it done; then Munni asks the child once, on the map or on the next call, "did you teach someone at home?" | `HOME`, `homeDone()`, `homeAsked()` |
| **Tutor session pack** | a parent invites the tuition teacher (active at once) or the school suggests one (waits for the parent's yes). Before each session the tutor gets the week's pack: the step, why, three questions with the usual mistake for each, what the class is doing. They tick what the child got right (real evidence) and can leave a note, on their page or by ringing the Munni number | `tutorPack()`, `tutorResult()`, `/circle/t/:token` |
| **Nothing counted twice** | the app's own history arrives as a snapshot; what only the server saw (phone lessons, tutor ticks, teachers' notes, placement) is kept apart and sent back to the app as `circleHistory` | `evidence.js` |
| **WhatsApp to grown-ups only** | week start, the teach activity, the check result, the tutor's pack, the teacher's digest — each a pointer to that person's own page. Never in quiet hours, at most `TAKHTI_MSG_DAILY` a day, one of each kind a week, and a parent can stop them. Without an AiSensy key a message waits on the dashboard as a one-tap link | `messages.js` |

Each person has a page by an unguessable link: `/circle/p/:token` (parent),
`/circle/t/:token` (tutor), `/circle/c/:token` (class teacher: the class's
week, setting or withdrawing the class focus, family codes, linking a tutor).

## How the child thinks — the same on a call as in the app

The app's twin (`src/core/twin.js`) keeps a picture of how a child thinks:
what they know and how it fades, the mistakes they keep making (in sums,
reading and writing), the way of teaching that works. With the circle's
tick, its **profile** (checked ids only — no name, no raw answers) comes up
with every sync (`twinCleanProfile()` checks it again here) and Munni's
phone lessons use it: the first free sum goes at a habit or a fading skill
("here's one we're practising together"), a slip that is the known habit
gets "I know this tricky bit!" and the help aimed at it, a child taught
step by step hears the reveal step by step, and reading lines carry the
letters they keep slipping on. A child with no app gets the same from the
server's own twin of their phone lessons. Reading coaching on a call names
how a word slipped (`src/core/lang-mistakes.js`), but what is *recorded* is
still graded from Bolna's transcript after the call.

**The shared mistakes database** (`mistakes.js`): combinations of mistakes
the twins worked out, and sums nothing explains yet, counted by children
(a keyed hash, never names). One seen in `TAKHTI_MISTAKE_MIN_CHILDREN`
children is promoted and goes down every sync as `mistake_rules`; the team
reviews the rest at `GET /voice/admin/mistakes` — where the next named
mistake gets written into `src/core/mathgen.js`. Erasing a child takes them
out of every count.

## The reading check and "say it with Munni" (Sarvam)

Under the reading terms a parent accepts at onboarding, whenever there is a
signal, the app sends one line the child read (or one word said after Munni)
to `POST /reading/asr` (`asr.js`): Sarvam `saaras:v3` in **verbatim** mode
writes down what was said — not a tidied sentence — and the text goes back
to be graded on the phone. The audio is never written down or logged. Any
OpenAI-compatible transcription service works too (`WHISPER_API_KEY`).

After a slip, the app's "say it with Munni" teaches the word in pieces in
Munni's voice: pre-rendered by `tools/build-audio.mjs`, or live from
`POST /reading/tts` (Sarvam Bulbul, short teaching lines only, cached;
`SARVAM_TTS_MODEL` / `SARVAM_SPEAKER` — use the same voice as the pack and,
ideally, as the Bolna agent's synthesizer, so Munni sounds the same
everywhere). On a call, a misread word is said the same way ("भा… लू… भालू").

## Narration (ElevenLabs / Sarvam)

`node tools/build-audio.mjs --lang hi --provider sarvam` (or ElevenLabs)
renders every lesson line, reading line and letter once, at build time, into
`audio/`; the phone plays the files offline (`src/core/voice.js`).

## The reading card

A phone call can't show text. So before the call the family opens the card link
(`/voice/card/<session>`) and copies the lines onto the takhti or into a
notebook. When Munni calls, the child reads what they wrote. That makes writing
part of the lesson: first copy it, then read it back. If there's no card, Munni
turns the line into "say it after me". Children aged 3–4 always get
say-after-me and are never asked to read.

## It feeds the same record the app keeps

- **Skill graph.** Every sum is tagged with the skill it really exercised.
  For example, a two-digit sum whose ones overflow counts as `carry`, and a
  story problem counts towards its concept's skills. This goes through the
  app's own `noteSkillAttempt()` / `noteSkillFromConcept()`, so the teacher's
  diagnosis counts phone practice as evidence.
- **Spaced repetition.** Reading on the call goes through `record()`, which
  keys each SRS item on the actual sentence. The next card puts the lines
  that are due first, most overdue first, the same review the Reading Tree
  runs.
- **Teacher homework.** Paste a homework code from the app's teacher view
  next to the child on the dashboard. That links the child to the class.
  The next call replaces the story problem with the homework, personalised by
  the app's `personalizeContentForHomework()`: a child weak on tables who was
  given BODMAS hears a tables question. BODMAS itself is never asked on a
  call, because "two plus three times four" has no brackets when spoken.
- **Back to the teacher.** For a linked child, the parent report ends with
  the app's own progress code (name labelled "(phone)"). The parent forwards
  it, and the teacher pastes it into the teacher view as usual.

## Try it in 30 seconds (no Bolna, no phone)

```bash
npm run voice:sim -- --auto --mistakes          # a scripted child, Hindi, age 7
npm run voice:sim -- --age 5 --lang en          # you type as the child
npm run voice:sim -- --parent consent --auto    # the consent call, then what it set up
npm run voice:sim -- --parent weekly --lang en  # a weekly progress call; you are the parent
npm test                                         # includes test/voice.test.js
```

The simulator drives the same brain the server uses, including the post-call
webhook. You see the whole call, the level change and the parent report.

## Run the server

```bash
cp voice/.env.example voice/.env      # fill in the three TAKHTI_* secrets
npm run voice                         # http://localhost:8787
npx cloudflared tunnel --url http://localhost:8787   # or ngrok; gives you an https URL
```

Put the tunnel URL in `TAKHTI_PUBLIC_URL`, restart the server, and open
`/voice/admin?key=<TAKHTI_ADMIN_KEY>`. That's the team dashboard: add a child
(with parent consent), plan a lesson, open the card, press **Call now**, then
read the item-by-item record, what the tools heard, and the engine trace.

## Set up the Bolna agent

1. **Account and credits.** Sign up at platform.bolna.ai. New accounts get $5.
   Ask in the Bolna builders' Slack for buildathon credits. Allow about ₹30–40
   per 6-minute test call.
2. **Generate the agent config.**
   ```bash
   node voice/agent/build-agent.js > voice/agent/munni.agent.json
   ```
   This reads `TAKHTI_PUBLIC_URL`, `TAKHTI_TOOL_TOKEN` and `TAKHTI_WEBHOOK_KEY`
   from `voice/.env` (or your shell). The output contains your token, so every
   `voice/agent/*.agent.json` is git-ignored.
3. **Create a graph agent** in the dashboard and use **Import** in the graph
   editor with that file. If the import complains about a field, the graph is
   small enough to build by hand. These are the seven nodes:

   | Node | Type | What it does | Leaves to |
   |---|---|---|---|
   | `start` | LLM | waits for "is the child ready?" | `lesson` (yes / a child speaks) · `not_now` (busy, later, wrong number, 2 silences) |
   | `lesson` | LLM, forces `takhti_next` on entry | speaks each `say`, relays every reply to `takhti_answer` | `end_now` (goodbye said) · `safe` · `adult` · `quiet_end` (3 silences) · `end_now` (60 turns) |
   | `adult` | LLM | answers a parent's question in two sentences | `lesson` · `not_now` |
   | `safe` | static + end call | "Tell a grown-up you trust… 1098 or 112" | — |
   | `not_now`, `quiet_end`, `end_now` | static + end call | kind goodbyes | — |

   The persona text, node prompts and edge conditions are all in
   `build-agent.js`: copy them from there.
4. **Tools.** Two custom functions, both `POST`, both scoped to the `lesson`
   node, both with `api_token: Bearer <TAKHTI_TOOL_TOKEN>`:
   - `takhti_next` → `<PUBLIC_URL>/voice/tools/next`, param `{"session_id": "%(session_id)s"}`
   - `takhti_answer` → `<PUBLIC_URL>/voice/tools/answer`, param `{"session_id": "%(session_id)s", "child_said": "%(child_said)s"}`

   Leave the pre-call message empty: the endpoint answers in a few milliseconds.
5. **Welcome message:** `{{greeting}}`. The server writes it in the lesson's
   language and passes it with each call, so one agent serves Hindi and English
   families.
6. **Voice.** Munni is a girl (her lines in the app are feminine). Pick a warm,
   young female voice that is natural in Hindi, such as Sarvam Bulbul or an
   ElevenLabs voice. The app's build-time narrator (George) is an adult male
   voice: if you want the slate and the phone to sound like the same Munni,
   change one of them.
7. **Transcriber.** Sarvam (Saaras) for Hindi, Deepgram Nova-3 for English.
   **Test with real children's voices on day one.** It's the biggest risk in
   the whole project. Do not add keyword boosting for card lines: it would make
   the recognizer "hear" the correct word, and the matcher would pass a
   misreading.
8. **Calling tab.** Turn on voicemail detection. Set calling hours to after
   school, before bedtime (for example 16:00–19:30). Turn recording on only if
   parents agreed (the greeting mentions recording only for those who did).
9. **Extractions.** Add a category "Safety" with a boolean extraction
   `safeguarding_concern`: "Did the child say anything suggesting they are
   being hurt, are afraid of someone, or are in danger?" A `yes` flags the
   session on the dashboard for a person to review. It never goes into the
   parent report or any automatic message.
10. **Webhook.** `<PUBLIC_URL>/voice/webhook?key=<TAKHTI_WEBHOOK_KEY>`
    (`build-agent.js` already puts it in the config).
11. Copy the agent id into `BOLNA_AGENT_ID`, and your API key into
    `BOLNA_API_KEY`.

**Variables the agent uses:** `session_id`, `child_name`, `lesson_language`,
`greeting`, `registered` and `allowed`. They come from `placeCall()` (outbound),
the inbound lookup, or the web-session mint. Nothing else is sent: no age, no
surname, and the phone number only as the number to dial.

12. **Keypad answers.** `dtmf_enabled: true` is already in the config (the
    Calling tab's *Keypad Input (DTMF)*). Keys reach the agent as
    `dtmf_number: 12`, collected until `#`. This works on Plivo, Twilio and SIP
    trunks, but not on Exotel or Vobiz: on those set `TAKHTI_KEYPAD=0` so
    Munni never offers it.
13. **Inbound line.** In the Calling tab, turn on *Inbound Calling*, pick the
    number and choose *Use your internal APIs*. Set the endpoint to
    `<PUBLIC_URL>/voice/inbound/lookup` and the token to `TAKHTI_TOOL_TOKEN`.
    Bolna sends a GET with `contact_number` and expects an answer within 3
    seconds. Use the same agent: an unregistered, quiet-hours or
    already-practised caller gets `allowed: false`, the greeting explains why,
    and the graph's `closed_end` node hangs up. `TAKHTI_INBOUND_DAILY` sets the
    daily limit (default 2), `TAKHTI_QUIET_HOURS` the quiet hours (default
    `21-7`) and `TAKHTI_TZ` the time zone (default `Asia/Kolkata`).
14. **Talking Munni in the app.** Build its agent with
    `node voice/agent/build-agent.js web` (it doesn't hang up on a child
    playing a game in silence) and put its id in `BOLNA_WEB_AGENT_ID`. Ask Bolna in the builders' Slack to switch on
    the Web Call SDK for your account. Set `window.TAKHTI_VOICE` in the app's
    `index.html` to `<PUBLIC_URL>`, and `TAKHTI_APP_ORIGIN` on the server to the
    app's origin (for CORS). Without `BOLNA_WEB_AGENT_ID` it falls back to the
    phone agent, which hangs up after 25 s of silence, so a silent game would
    end the talk. The graph's `screen`, `play` and `play_say` nodes and their
    event edges are already in the config.

15. **The parent agent.** Generate it with
    `node voice/agent/build-parent-agent.js > voice/agent/munni-parent.agent.json`,
    import it as a second graph agent, add the `takhti_parent` custom function
    (`POST <PUBLIC_URL>/voice/tools/parent`, param `{"session_id": "%(session_id)s", "parent_said": "%(parent_said)s"}`,
    scoped to the `talk` node) and put its id in `BOLNA_PARENT_AGENT_ID`. Use
    the same webhook. Turn on keypad input for 1 / 2 answers.
16. **WhatsApp templates (AiSensy).** In AiSensy, create these utility
    templates in Hindi and English, get them approved by Meta, and launch each
    one as an **API campaign** (approved templates alone don't show up in
    Bolna). Then link AiSensy in Bolna (Integrations).

    | template | English text |
    |---|---|
    | `takhti_card` | Namaste! Here are {{1}}'s lines for today's lesson with Munni: {{2}} Please copy them onto the takhti together before the call. — Takhti |
    | `takhti_report` | Today with Munni: {{1}} {{2}} {{3}} Full report: {{4}} — Takhti |
    | `takhti_missed` | Takhti update: {{1}} — Takhti |
    | `takhti_consent` | Thank you for talking to Munni. {{1}} {{2}} — Takhti |

    Hindi: `takhti_card` "नमस्ते! मुन्नी के साथ आज के पाठ के लिए {{1}} की लाइनें यहाँ हैं: {{2}} कॉल से पहले इन्हें साथ में तख़्ती पर लिख लें। — तख़्ती";
    `takhti_report` "आज मुन्नी के साथ: {{1}} {{2}} {{3}} पूरी रिपोर्ट: {{4}} — तख़्ती";
    `takhti_missed` "तख़्ती: {{1}} — तख़्ती"; `takhti_consent` "मुन्नी से बात करने के लिए धन्यवाद। {{1}} {{2}} — तख़्ती".
    Line breaks between the variables are fine in the template; the
    variables themselves never contain one. Other names: `TAKHTI_WA_CARD`,
    `TAKHTI_WA_REPORT`, `TAKHTI_WA_MISSED`, `TAKHTI_WA_CONSENT`.
17. **The workflows.** `node voice/agent/build-workflow.js daily --push` (and
    `consent --push`) creates each as a draft in your Bolna account and runs
    Bolna's validator. Look at it in the editor, publish it, and put the ids
    in `BOLNA_DAILY_WORKFLOW_ID` and `BOLNA_CONSENT_WORKFLOW_ID`. Without
    `--push` it prints the definition. The scheduler runs inside the server
    (`TAKHTI_SCHEDULER=0` turns it off) and starts each family's daily
    workflow at their time. Without a daily workflow it calls directly, retries
    once, and the WhatsApp step stays a link on the dashboard.

18. **The learning circle's template.** One more AiSensy API campaign,
    `takhti_circle` (or set `AISENSY_CAMPAIGN`), a utility template with two
    parameters, "{{1}} {{2}} — Takhti" (Hindi: "{{1}} {{2}} — तख़्ती"), where `{{1}}` is the message and
    `{{2}}` the person's page. Put the AiSensy key in `AISENSY_API_KEY`.
    In the app, set `window.TAKHTI_VOICE` to this server's public URL — the
    same setting that enables Talking Munni turns on the circle's tick.

## Endpoints

| Who | Route | Auth |
|---|---|---|
| Bolna, during a call | `POST /voice/tools/next` `{session_id}` | `Bearer TAKHTI_TOOL_TOKEN` |
| | `POST /voice/tools/answer` `{session_id, child_said}` | same |
| Bolna, after a call | `POST /voice/webhook?key=…` (execution payload) | `TAKHTI_WEBHOOK_KEY` |
| | `POST /voice/tools/parent` `{session_id, parent_said}` (parent agent) | same |
| | `POST /voice/tools/note` `{session_id, teacher_said}` (teacher node) | same |
| Bolna Workflows | `POST /voice/flow/plan`, `/gate`, `/result`, `/missed`, `/consent/plan`, `/consent/result` (see `flow.js`) | `Bearer TAKHTI_TOOL_TOKEN` |
| Bolna, before an inbound call | `GET /voice/inbound/lookup?contact_number=…` | `Bearer TAKHTI_TOOL_TOKEN` |
| The app (Talking Munni, and Ask Munni's help call: the same mint with `help: {kind: math\|read\|lesson, …}`, see `help.js`) | `POST /voice/web/session`, `GET /voice/web/state`, `POST /voice/web/tap`, `GET /voice/web/result`, `POST /voice/web/forget` | parent consent flag + per-child key; per-talk token; rate limits |
| The app (learning circle) | `POST /circle/sync` (progress + the twin's checked `profile`; returns `mistake_rules`), `POST /circle/leave` `{child, key, erase}` (sync off, or delete the circle's data) (CORS) | the parent's tick (`consent.sync`), this phone's key after the first sync, rate limits |
| The app (reading check) | `POST /reading/asr` `{consent, lang, mime, audio}`, `POST /reading/tts` `{text, lang, pace}` (CORS) | the reading terms; per-address limits; nothing kept |
| The teacher view (syllabus) | `POST /syllabus` `{mode, chapter, rules, count, skills, note}` (CORS) — `api/syllabus.mjs`, Gemini (`GEMINI_API_KEY`) | drafts only; the phone checks every lesson; `TAKHTI_SYLLABUS_KEY` optional; per-address limit |
| The app (Teach Munni) | `POST /teach/judge` `{consent, lang, audio+mime | transcript, ask, aims, ages}` (CORS) — the speech service writes the explanation down (`voice/asr.js`), then `api/teachback.mjs` asks Gemini which points it covered | the reading terms v2; built-in points read from the server's own `src/content/teach.js`; every credit must quote the child; nothing kept; `TAKHTI_TEACH_PER_HOUR` |
| Parents, tutors, teachers | `GET`/`POST /circle/p/:token`, `/circle/t/:token`, `/circle/c/:token` | the unguessable link |
| Families | `GET /voice/card/:session`, `GET /voice/report/:session` | the unguessable link |
| Team | `GET /voice/admin`, `POST /voice/admin/children`, `POST /voice/admin/sessions` (`call: true` to dial), `POST /voice/admin/sessions/:id/call`, `POST /voice/admin/children/:id/homework` `{code}`, `GET /voice/admin/children/:id/progress-code`, `POST /voice/admin/children/:id/consent-call`, `/consent-confirm`, `/weekly-call`, `/schedule` `{time, days: daily\|alternate, enabled, weekly}`, `GET /voice/admin/parentcalls/:id`, `POST`/`GET /voice/admin/teachers`, `GET /voice/admin/teachercalls/:id`, `GET /voice/admin/classes/:code`, `POST /voice/admin/classes/:code/parent-calls` `{skill, teacher, note}`, `GET /voice/admin/outbox`, `POST /voice/admin/children/:id/family-code`, `GET /voice/admin/corpus(.csv)`, `GET /voice/admin/mistakes` (server key), `DELETE /voice/admin/children/:id` | `TAKHTI_ADMIN_KEY` (everything), or a school's key (its own records; 404 for anything else) |
| Server key only | `GET`/`POST /voice/admin/schools`, `POST /voice/admin/schools/:id` `{name, contact, api_key, agent_id, parent_agent_id, from_number, daily_workflow_id, consent_workflow_id}` | `TAKHTI_ADMIN_KEY` |

The tools always return `200` with `{say, expect, done, item}`. An unknown
session gets a polite bilingual goodbye with `done: true`, so a broken link
never leaves a child listening to silence.

## Rules this keeps (from CLAUDE.md)

- **A tutor, not a companion.** The graph has one lesson and nothing else. The
  persona forbids personal questions, secrets and off-topic chat. Tools exist
  only on the lesson node.
- **Never "wrong".** A first miss gets a two-choice clue built from the closest
  distractor. A second miss gets the answer and the lesson's own "why" line.
  The tests check that no line Munni can say contains "wrong" or "गलत".
- **Doubt isn't a miss.** If no number is heard, or the matcher says `unsure`,
  Munni asks once more and then moves on, recording nothing.
- **Only first tries count** toward a level-up. Levels stay inside the age
  band: the tests run a perfect child and a struggling child through 12 calls
  each.
- **No streaks, no guilt.** A missed call records nothing and tells the parent
  "next call at the usual time". There is no automatic re-dialling of children.
  The goodbye counts what was done, never what was missed.
- **Every line in Hindi and English,** with matching placeholders (tested).
- **Consent first.** A child is registered with consent given in person
  (`consent: true`) or to be asked on a consent call (`consent: "call"`). No
  lesson is planned, dialled or answered on the inbound line until consent is
  given. `DELETE` erases the child and every session, parent call and
  transcript.

## Honest gaps

- **Bolna payload shape.** `build-agent.js` follows Bolna's documented graph
  structure, but it hasn't been imported into a real account yet. Expect one
  round of small fixes on first import. The request and response formats for
  the tools are inferred from Bolna's examples (`param` sent as a JSON body,
  our JSON returned to the model), so check the first live call on the
  dashboard's "what the tools heard" panel.
- **Relay drift.** The model could still tidy a child's words before passing
  them on. Reading is therefore re-graded after the call from Bolna's
  transcript, and the dashboard shows how often the relay and the transcript
  disagreed. If that number isn't near zero, fix the prompt before trusting
  live feedback.
- **Storage** is one JSON file per record (`voice/store.js`). That's fine for a
  pilot on one small server, but not for a serverless host. The interface is
  get/put/list, so swap it there.
- **The workflows are built to Bolna's documented definition format** (beta)
  and tested here for shape and against the server's own endpoints, not yet
  run in an account. `--push` runs Bolna's validator on them: fix anything it
  reports before publishing. Bolna's WhatsApp node is fire-and-forget, so a
  WhatsApp that fails to deliver isn't seen.
- **Consent by phone is not the DPDP Rules' *verifiable* consent.** The
  consent call gives the notice, records a clear yes checked against the
  transcript, and keeps which notice was agreed to. Rule 10 also requires
  checking that the person is an identifiable adult (from details already
  held, or an identity/age token such as DigiLocker). Takhti doesn't do that
  yet. Those provisions come into force on 13 May 2027; add that check before
  then.
- **School Bolna keys are stored in the voice store** (never returned by the
  API, only the last four characters). On a real host, keep that store
  encrypted at rest or move the keys to a secrets manager.
- **A teacher's number wins.** If a teacher's phone is also registered as a
  parent's, a call from it takes a note, not a lesson.
- **Teacher notes are one observation each.** A note adds one attempt to
  the skill history; the diagnosis needs four before it calls anything solid
  or a gap, so one note never overrides the app's own evidence.
- **The weekly call answers from Takhti's own record.** "Is she behind?" is
  answered against where Takhti starts for that age, not against the class or
  any test norm, and it says so. Below about six first tries in a month it
  says it's too early to tell.
- **Talking Munni's minting endpoint** is open to any browser. It is limited
  per address (`TAKHTI_WEB_PER_HOUR`) and per child per day
  (`TAKHTI_WEB_DAILY`), but not authenticated. Put it behind the app's own
  login before a public launch.
- **Event injection** is built to Bolna's documented `POST /v1/call/{run_id}/events`
  and is tested against a stand-in. Confirm on a live web call that Munni
  speaks within a second of a tap.
- **The English sound matcher** is lenient by design. It accepts words that
  differ only in a vowel (sun / son), and the word bank avoids such pairs. It
  hasn't been checked against real children's English through a Hindi phone
  recognizer.
