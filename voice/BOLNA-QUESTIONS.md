# Questions for the Bolna team

Everything on Takhti's side is built and tested against a stand-in Bolna
(`test/voice*.test.js`). This is what we assumed for each Bolna feature, and
what we need Bolna to confirm or switch on before we go live. Each question
says where in the code it matters.

## Access and accounts

1. **Web Call SDK.** Please turn on the Web Call SDK for our account. We use
   `@bolna/web-call` v3.0.1 from the CDN, and we create sessions with
   `POST https://api.bolna.ai/web-call/session {agent_id, user_data}` from
   our server. Is `run_id` in that reply the id to use for event injection?
   (`voice/web.js`, `src/ui/talk-munni.js`)
2. **Sub-accounts, one per school.** Can sub-accounts be created and given
   their own API keys **through the API**, or only in the dashboard? Does each
   sub-account need its own copy of our agents and its own phone number? Do
   webhooks and caller lookup work per sub-account? Is billing rolled up to
   the parent account? (`brain.createSchool()` stores a key per school,
   `envFor()` uses it)
3. **Data residency.** Is there an India-only region for call audio,
   transcripts and stored variables, and how do we turn it on? We work with
   children, so this matters for DPDP.
4. **Deleting data.** When a parent asks us to delete everything, can we
   delete a child's executions, recordings and transcripts on Bolna's side
   **through the API**? What does Bolna keep by default, and for how long?

## Graph agents

5. **Edge parameters.** We pass the child's (or teacher's) first words into
   the next node with an LLM edge's `parameters` (`caller_name`,
   `teacher_said`, `parent_said`). Is `{{name}}` from edge parameters available
   in the next node's prompt and in the tool's `%(name)s` params?
   (`agent/build-agent.js`, `agent/build-parent-agent.js`)
6. **`function_call` on a node.** Is a node's `function_call` called once, as
   soon as the node is entered, with parameters filled from the conversation?
7. **Expression edges on our own variables.** We route on `allowed`
   (boolean) and `caller_kind` (string), declared in `variable_types` and set
   in `user_data` or by the inbound lookup. Do expression edges see those
   values on the first turn?
8. **Silence (built; please confirm the semantics).** When a child goes
   quiet, we want the tutor to know, because it's part of what we observe
   about the child. The lesson node has an expression edge on
   `_silence_repeats >= 1` to a `hush` node, which calls `takhti_answer` with
   `child_said = "(silence)"` and then goes straight back to the lesson. The
   server answers with an easier way into the same question, and a different
   question the second time. Questions: does `_silence_repeats` count up
   after each of Munni's automatic repeats, and reset when the child speaks?
   Is an expression edge checked on a silence (no user turn), or only after
   the child speaks? If neither, is there a silence event we can route on?
   We also count quiet moments from the transcript after the call (a line
   repeated with nothing in between): is a repeat-after-silence written into
   the transcript that way? (`voice/report.js` `quietFromTranscript()`)
9. **Static `end_call` nodes.** Our goodbye nodes are `node_type: 'static'`
   with `function_call: 'end_call'`, and `hangup_after_LLMCall: false`. Is that
   the right way to have a fixed safety line ("tell a grown-up… 1098 / 112")
   spoken word for word and then hang up?
10. **Tool latency and failure.** What is the timeout on a custom function?
    What does the agent say or do if our server is slow or returns an error?
    Our tools answer in milliseconds, and an unknown session gets a polite
    goodbye with `done: true`.

## Speech

11. **Children's voices.** Which transcriber works best for 5–10 year olds
    in Hindi (Sarvam Saaras?) and in English? Is there any per-call setting for
    children's speech?
12. **Keyword boosting.** We must **not** boost the reading card's words: it
    would make the recognizer "hear" the right word and pass a misreading. Is
    boosting off unless we set it? Can it be set per node?
13. **Mid-call language switching.** With a multilingual agent, can Hindi and
    English switch during a call (Hinglish answers), and does the transcript
    keep Devanagari for Hindi?
14. **Transcript format.** We re-grade reading from the webhook's
    `transcript`, expecting `assistant: …` / `user: …` lines. Is that format
    stable? Is there a structured, per-turn transcript with timestamps or
    confidence?
15. **One voice for Munni.** Can we clone or choose one ElevenLabs voice and use
    it for Munni on calls, web calls and the parent agent alike? Which Hindi
    voices sound young and warm?

## Keypad, inbound and telephony

16. **DTMF.** Which providers on Bolna pass keypad input (we understand
    Plivo, Twilio and SIP trunks do, and Exotel and Vobiz don't)? Is the
    format always `dtmf_number: 12`, collected until `#`?
17. **Inbound caller lookup.** We answer `GET /voice/inbound/lookup` with
    `contact_number` (and `agent_id`, `execution_id`) in under 3 s, with a
    Bearer token. Is `agent_id` always sent? What happens if we time out?
18. **Indian numbers and calling hours.** What's needed to call Indian mobile
    numbers from a +91 number (DLT, KYC)? Do calling-hour settings apply to
    API calls and workflows as well as batches?

## Event injection (screen and voice together)

19. **`POST /v1/call/{run_id}/events`.** We send `{event: 'screen_answer',
    properties: {screen_say}}`, and an `event` edge moves the agent to a node
    that speaks `{{screen_say}}`. Are `properties` merged into the variables
    before that node speaks? How fast does it usually land (we're aiming for
    under a second)? Does it work on phone calls as well as web calls?

## Workflows (WhatsApp + call sequences)

20. **Definition format.** `agent/build-workflow.js` writes `entry_node_id`,
    `nodes[]` with `cases[{when, then: {to, effects}}]` and `on_no_match`, as
    in the workflow docs. Is there a `schema_version` we should set? `--push`
    runs `POST /workflows/{id}/validate`; please tell us anything it doesn't
    show.
21. **Agent node variables.** Is `config.variables` on an agent node written
    as operands (`{"var": "state.session_id"}`) and passed to the agent like
    `user_data`?
22. **API node.** Can `headers` hold a fixed `Authorization: Bearer …`? Is
    `body` with `{placeholder}` strings filled from `config.variables`? Is
    `response_map` a dotted path into the JSON reply?
23. **Run body.** Does `POST /workflows/{id}/run` accept start-node fields
    (our `child_id`) at the top level, next to `reference_id`,
    `mobile_number` and `name`?
24. **Retry node.** If the retry's target is our gate node and the gate says
    no, does the execution simply follow the gate's own case (no further
    retries)?
25. **Scheduling.** Workflows have no recurring schedule, so our server starts
    each family's run at the time the parent chose. Is there a better
    Bolna-native way to run "every Mon/Wed/Fri at 17:30, per contact"?
26. **WhatsApp (AiSensy).** The node can't report delivery. Is a
    delivery or read callback planned? Are there limits on template variable
    length? (We keep each to one line, under 900 characters.)

## Batch and class calls

27. **Class-wide parent calls.** We call each family through `POST /call`,
    one at a time. For a class of 40, should we use batch calling or a
    workflow campaign instead? What concurrency does our plan allow?

## Safety and extraction

28. **Extractions on our agent.** We set a boolean `safeguarding_concern`
    extraction in the dashboard. Can extractions be defined in the agent JSON
    or through the API? Where do they appear in the webhook payload
    (`extracted_data`)?
29. **Webhook authentication.** We protect the webhook with a secret in the
    URL. Does Bolna sign webhooks (an HMAC header) that we could check
    instead?

## Costs

30. **Per-minute price** for India telephony (outbound, inbound, web calls)
    with a Hindi transcriber and voice, so we can show cost per child per
    month. Are there credits for the buildathon beyond the $5?

## Games on a web call

31. **Long silent stretches on a web call.** While a child plays a game in
    the app, the talk stays live but nobody speaks for minutes. We build a
    separate web agent (`build-agent.js web`) with `hangup_after_silence: 600`
    and `call_terminate: 1200`, and its `play` node has no
    `repeat_after_silence_seconds`. Are those allowed values? Can silence
    hang-up be turned off per node instead of per agent?
32. **Events from any node.** We inject `play_mode`, `game_say` and
    `lesson_mode` (and `screen_answer`) with `properties.screen_say`. Does an
    `event` edge fire from whichever node the call is on? Does the
    `play_say` node speak `{{screen_say}}` from the latest event's properties?

## From the first live call (26 Oct 2026)

33. **No pre-call message.** Our tools answer in milliseconds. With
    `pre_call_message` empty, Bolna spoke its default English "Just give me a
    moment, I'll be back with you." before every tool call, so we now send
    "हम्म…" / "Hmm…". Is there a way to have no message at all?
34. **The router and priorities.** On the first call the child answered "8"
    and the routing LLM took the safety edge (it had `priority: 10`, ahead of
    the default 100 for LLM edges). We removed the priority, made the
    condition say what is never a safety concern, and require the child's
    worrying words as an edge parameter. Is a required edge parameter a
    reliable guard? Does `priority` on LLM edges change how the router
    weighs them, or only the order of deterministic edges?
35. **Saving in the dashboard.** Editing a tool in the dashboard reset every
    tool's `scope`/`nodes` to null (tools on every node). Expected?
36. **PATCH and tasks.** `PATCH /v2/agent/{id}` with `tasks` reported success
    but changed nothing in the graph or tools. Is a full `PUT` the way to
    change a graph agent's nodes and tools?
