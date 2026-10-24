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
   from your environment. The output contains your token, so it is git-ignored.
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

**Variables the agent uses:** `session_id`, `child_name`, `lesson_language` and
`greeting`. All four are sent by `placeCall()` in `brain.js`. Nothing else is:
no age, no surname, and the phone number only as the number to dial.

## Endpoints

| Who | Route | Auth |
|---|---|---|
| Bolna, during a call | `POST /voice/tools/next` `{session_id}` | `Bearer TAKHTI_TOOL_TOKEN` |
| | `POST /voice/tools/answer` `{session_id, child_said}` | same |
| Bolna, after a call | `POST /voice/webhook?key=…` (execution payload) | `TAKHTI_WEBHOOK_KEY` |
| Families | `GET /voice/card/:session`, `GET /voice/report/:session` | the unguessable link |
| Team | `GET /voice/admin`, `POST /voice/admin/children`, `POST /voice/admin/sessions` (`call: true` to dial), `POST /voice/admin/sessions/:id/call`, `POST /voice/admin/children/:id/homework` `{code}`, `GET /voice/admin/children/:id/progress-code`, `DELETE /voice/admin/children/:id` | `TAKHTI_ADMIN_KEY` |

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
- **Consent first.** A child can't be registered without `consent: true`.
  `DELETE` erases the child and every session and transcript.

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
- **WhatsApp** is a share link (`wa.me`) for now. Bolna Workflows can send real
  WhatsApp templates through AiSensy: that's the next step for sending the card
  before the call and the report after it.
- **Consent** is a checkbox and a timestamp. A production launch needs the
  verifiable parental consent mechanism under the DPDP Rules. Check the current
  requirements before any real pilot.
- **Talking Munni inside the app** (Bolna's Web Call SDK) isn't built yet. When
  it is, it must stay optional and must never gate a lesson.
