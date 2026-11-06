#!/usr/bin/env node
/* ==================================================================
   MUNNI'S BOLNA AGENT — a graph agent that is only a voice.

     TAKHTI_PUBLIC_URL=https://xyz.trycloudflare.com \
     TAKHTI_TOOL_TOKEN=... TAKHTI_WEBHOOK_KEY=... \
     node voice/agent/build-agent.js > voice/agent/munni.agent.json

   Every decision lives in the Takhti brain (voice/session.js). The graph
   only handles what a phone call needs around the lesson: who picked up,
   silence, the child or a parent wanting to stop, an adult with a
   question, and a child saying something that worries us. Tools are
   scoped to the lesson node, so nothing outside the lesson can reach
   the tutor, and nothing inside the lesson can do anything else.

   The structure follows Bolna's documented graph-agent payload
   (agent_config → tasks[0] → tools_config → llm_agent.llm_config, with
   api_tools beside it). Voice, transcriber and telephony are left for
   the dashboard, where Bolna validates them — see voice/README.md.
   ================================================================== */
'use strict';
require('./env');   // reads voice/.env

const LANG = process.env.TAKHTI_AGENT_LANG || 'hi';     // 'hi', 'en' or 'multi'
const base = (process.env.TAKHTI_PUBLIC_URL || 'https://YOUR-TUNNEL.example').replace(/\/$/, '');
const TOOL = process.env.TAKHTI_TOOL_TOKEN || 'REPLACE_WITH_TAKHTI_TOOL_TOKEN';
const HOOK = process.env.TAKHTI_WEBHOOK_KEY || 'REPLACE_WITH_TAKHTI_WEBHOOK_KEY';
const MODEL = process.env.TAKHTI_AGENT_MODEL || 'gpt-4.1-mini';
// `node build-agent.js web` → the Talking Munni agent (BOLNA_WEB_AGENT_ID):
// a child may play a game in silence for minutes, so the call must not hang
// up on silence the way a phone lesson does
const WEB = process.argv.includes('web') || process.env.TAKHTI_AGENT_FOR === 'web';

/* a static line: one string for a single-language agent, a per-language
   map for a multilingual one (Bolna plays the clip for the live language) */
const say = (hi, en) => LANG === 'multi' ? { hi, en } : LANG === 'en' ? en : hi;

const PERSONA = `You are Munni, a friendly baby elephant from Takhti. You help a child practise maths and reading on a phone call. You are a tutor for this one lesson, not a friend or companion.

How you work:
1. Speak ONLY the text in the "say" field that the takhti tools return, word for word. Never add to it, shorten it, translate it, explain it, or change any number in it. You may say the child's name, {{child_name}}, before it.
2. After you speak, stop and listen. Never answer for the child and never give extra hints.
3. Every time the child speaks during the lesson, call takhti_answer with exactly the words you heard: wrong numbers, half words, mistakes and all. Never correct them. Never guess what they meant.
4. Never ask for personal information (address, school, phone numbers, family details). Never ask a child to keep a secret. Never talk about anything except today's lesson. If the child talks about something else, say one short warm sentence and continue with the lesson.
5. If anyone wants to stop, pass their words to takhti_answer; it ends the lesson kindly.
6. The lesson language is {{lesson_language}}. Hindi lines are written in Devanagari: read them naturally.
7. If you receive "dtmf_number: ..." the child pressed keys on the phone. Pass that text unchanged as child_said.
8. If the child says nothing at all after you have repeated the question, call takhti_answer with child_said = "(silence)". Never treat silence as an answer.`;

/* The safety edge. Bolna's router checks lower priorities first, and a
   priority on this edge once sent a child who answered "8" to the safety
   message (first live call, 26 Oct 2026). So: no priority, a condition that
   says plainly what is NOT this, and the child's own worrying words as a
   required quote — a router that can't quote them can't take the edge. */
const SAFE_EDGE = {
  to_node_id: 'safe',
  condition: 'ONLY when the child says in clear words that a person is hurting them, that they are afraid of a person, that they are in danger, or that they want to hurt themselves. NEVER for a number, a single word, yes or no, a reading attempt, a wrong or half answer, laughing, silence, background noise or anything about the lesson.',
  parameters: { worrying_words: { type: 'string', description: 'The child\'s exact words that show they are being hurt, are afraid of someone, are in danger or want to hurt themselves. If the child said no such words, do not take this edge.' } }
};

/* The lesson is over when a tool result says done: true, and its "say" is
   Munni's closing line ("today you did four sums…"). Bolna's router runs
   again right after a tool result, so an edge that waited for "Munni has
   already said goodbye" fired before she had — the first full call ended on
   a bare "बाय-बाय!" with the closing line unsaid. So the router now takes
   this edge at that moment on purpose, carrying the line (without its
   final bye) into the goodbye node, which says it; end_now adds the bye. */
const DONE_EDGE = {
  to_node_id: 'goodbye',
  condition: 'The most recent takhti tool result has "done": true. Its "say" is the closing line of the call.',
  parameters: { goodbye_say: { type: 'string', description: 'That tool result\'s "say" text, word for word, without the final "Bye bye!" or "बाय-बाय!".' } }
};

const nodes = [
  {
    id: 'start',
    prompt: 'Munni has just said the greeting. If it asked whether {{child_name}} is ready, wait for the reply. If it asked who is calling, wait for the child to say their name. If it said goodbye, say nothing more. Do not start the lesson yourself and do not call any tool. If someone asks who you are, say you are Munni from Takhti, here for a short practice lesson.',
    repeat_after_silence_seconds: 8,
    edges: [
      // the inbound lookup said this line is closed (unregistered number,
      // quiet hours, or today's lessons done): the greeting already said
      // why and goodbye, so the next thing anyone says ends the call
      { to_node_id: 'closed_end', condition_type: 'expression', priority: 0,
        expression: { conditions: [{ variable: 'allowed', operator: 'eq', value: false }] } },
      { to_node_id: 'not_now', condition_type: 'expression', priority: 1,
        expression: { conditions: [{ variable: '_silence_repeats', operator: 'gte', value: 2 }] } },
      // a teacher rang the line (the inbound lookup said caller_kind =
      // teacher): take a voice note, never a lesson
      { to_node_id: 'teacher', condition_type: 'expression', priority: 2,
        expression: { conditions: [{ variable: 'caller_kind', operator: 'eq', value: 'teacher' }] } },
      { to_node_id: 'lesson', condition: 'The person says the child is here or ready, hands the phone over, says yes / haan / okay, a child starts speaking, or (when Munni asked who is calling) the child says their name.',
        parameters: { caller_name: { type: 'string', description: 'If Munni asked who is calling: the name the child said. Otherwise empty.' } } },
      { to_node_id: 'not_now', condition: 'The person says the child is not available, busy, sleeping or at school, asks to call later, does not want the call, or says it is a wrong number.' }
    ]
  },
  {
    id: 'lesson',
    function_call: 'takhti_next',
    prompt: 'Call @takhti_next to get the first thing to say (pass caller_name = "{{caller_name}}" if the child said their name), and speak its "say" exactly. From then on, every time the child speaks, call @takhti_answer with their exact words, then speak the new "say" exactly. When a result has "done": true, its "say" is the goodbye: speak it and then stop talking.',
    repeat_after_silence_seconds: 9,
    edges: [
      // Talking Munni in the app: the child tapped an answer on screen and
      // the server pushed Munni's reply in (event injection)
      { to_node_id: 'screen', condition_type: 'event', event_name: 'screen_answer' },
      // ...or left the Pond to play a game: the lesson waits
      { to_node_id: 'play_say', condition_type: 'event', event_name: 'play_mode' },
      { to_node_id: 'quiet_end', condition_type: 'expression', priority: 0,
        expression: { conditions: [{ variable: '_silence_repeats', operator: 'gte', value: 3 }] } },
      { to_node_id: 'end_now', condition_type: 'expression', priority: 1,
        expression: { conditions: [{ variable: '_total_turns', operator: 'gte', value: 60 }] } },
      // the child went quiet (after Munni's own repeat): tell the tutor, so
      // the next line is an easier way in — and the quiet moment is kept
      { to_node_id: 'hush', condition_type: 'expression', priority: 2,
        expression: { conditions: [{ variable: '_silence_repeats', operator: 'gte', value: 1 }] } },
      SAFE_EDGE,
      DONE_EDGE,
      { to_node_id: 'adult',
        condition: 'An adult (not the child) is now speaking and asks a question about Takhti, the call, or the child\'s progress.' }
    ]
  },
  {
    // Talking Munni while the child plays a game on screen. Silence here is
    // just play: no repeats, no "are you there?", no quiet hang-up.
    id: 'play',
    prompt: 'The child is playing a game on the screen. Stay quiet. Only if the child speaks, call @takhti_answer with their exact words and speak its "say" exactly (if "say" is empty, say nothing).',
    edges: [
      { to_node_id: 'play_say', condition_type: 'event', event_name: 'game_say' },
      { to_node_id: 'screen', condition_type: 'event', event_name: 'lesson_mode' },
      SAFE_EDGE,
      DONE_EDGE
    ]
  },
  {
    // the closing line the last tool result carried, then the bye
    id: 'goodbye',
    prompt: 'Say exactly this, word for word, and nothing else: {{goodbye_say}}',
    edges: [{ to_node_id: 'end_now', condition_type: 'unconditional' }]
  },
  {
    id: 'play_say',
    prompt: 'Say exactly this, word for word, and nothing else: {{screen_say}}',
    edges: [{ to_node_id: 'play', condition_type: 'unconditional' }]
  },
  {
    id: 'hush',
    function_call: 'takhti_answer',
    prompt: 'The child has gone quiet. Call @takhti_answer with child_said = "(silence)" and speak its "say" exactly, gently. Do not add anything.',
    edges: [{ to_node_id: 'lesson', condition_type: 'unconditional' }]
  },
  {
    id: 'teacher',
    function_call: 'takhti_note',
    prompt: 'You are now speaking with a TEACHER, not a child, who is leaving a note about a child. Call @takhti_note with teacher_said = the teacher\'s exact last words and speak its "say" exactly. Every time the teacher speaks again, call @takhti_note with their exact words, names included, and speak the new "say" exactly. Never repeat a child\'s name you did not hear. When a result has "done": true, speak its "say" and stop.',
    repeat_after_silence_seconds: 10,
    edges: [
      { to_node_id: 'end_now', condition_type: 'expression', priority: 0,
        expression: { conditions: [{ variable: '_silence_repeats', operator: 'gte', value: 3 }] } },
      DONE_EDGE
    ]
  },
  {
    id: 'screen',
    prompt: 'The child just answered by tapping the screen. Say exactly this, word for word, and nothing else: {{screen_say}}',
    edges: [
      // whatever the child says next is a lesson turn again
      { to_node_id: 'lesson', condition_type: 'unconditional' }
    ]
  },
  {
    id: 'adult',
    prompt: 'An adult has a question. Answer in one or two short sentences, in the lesson language: Munni is Takhti\'s practice call; after the call the family gets a short report; to change the time or stop the calls, reply to that report. Do not discuss the child\'s answers in detail. Then ask whether {{child_name}} would like to continue the lesson.',
    edges: [
      { to_node_id: 'lesson', condition: 'They say to continue, or the child is speaking again.' },
      { to_node_id: 'not_now', condition: 'They want to stop the call now.' }
    ]
  },
  {
    id: 'safe',
    node_type: 'static',
    static_message: say(
      'मुझे बताने के लिए धन्यवाद। यह बहुत ज़रूरी बात है। अभी किसी ऐसे बड़े को बताओ जिस पर तुम्हें भरोसा है, घर पर या स्कूल में। अगर तुम्हें ख़तरा है, तो किसी बड़े से 1098 या 112 पर फ़ोन करने को कहो।',
      'Thank you for telling me. That is really important. Please tell a grown-up you trust right now, at home or at school. If you are in danger, ask a grown-up to call 1098 or 112.'),
    function_call: 'end_call',
    edges: []
  },
  {
    id: 'not_now',
    node_type: 'static',
    static_message: say('कोई बात नहीं! मुन्नी फिर किसी और समय बात करेगी। बाय-बाय!', 'No problem! Munni will talk another time. Bye bye!'),
    function_call: 'end_call',
    edges: []
  },
  {
    id: 'quiet_end',
    node_type: 'static',
    static_message: say('लगता है अभी सही समय नहीं है। हम फिर बात करेंगे। बाय-बाय!', 'It sounds like now is not a good time. We will talk again. Bye bye!'),
    function_call: 'end_call',
    edges: []
  },
  {
    id: 'closed_end',
    node_type: 'static',
    static_message: say('बाय-बाय!', 'Bye bye!'),
    function_call: 'end_call',
    edges: []
  },
  {
    id: 'end_now',
    node_type: 'static',
    static_message: say('बाय-बाय!', 'Bye bye!'),
    function_call: 'end_call',
    edges: []
  }
];

/* Bolna speaks a pre-call message while a tool runs, and fills in an
   English "Just give me a moment…" when it is left empty (first live call);
   "हम्म…" after every answer sounded odd (second call). Our tools answer in
   milliseconds, so the message is a pause: an ellipsis, no word at all. */
const PRE = '…';

const tools = [
  {
    key: 'custom_task',
    name: 'takhti_next',
    pre_call_message: PRE,
    description: 'Get the next thing Munni should say in today\'s lesson. Call it when the lesson starts, and again only if you have lost track of what to say.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The lesson id: always {{session_id}}.' },
        caller_name: { type: 'string', description: 'Only if Munni asked who is calling: the name the child said. Otherwise leave empty.' }
      },
      required: ['session_id']
    }
  },
  {
    key: 'custom_task',
    name: 'takhti_answer',
    pre_call_message: PRE,
    description: 'Send the child\'s reply to the Takhti tutor and get what Munni says next. Call this EVERY time the child speaks during the lesson.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The lesson id: always {{session_id}}.' },
        child_said: { type: 'string', description: 'The child\'s exact words as you heard them, including wrong numbers and mistakes. Do not correct, complete or translate them.' }
      },
      required: ['session_id', 'child_said']
    }
  },
  {
    key: 'custom_task',
    name: 'takhti_note',
    pre_call_message: PRE,
    description: 'Send what the teacher just said to Takhti and get what Munni says next. Call this EVERY time the teacher speaks.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The call id: always {{session_id}}.' },
        teacher_said: { type: 'string', description: 'The teacher\'s exact words, including the child\'s name as you heard it.' }
      },
      required: ['session_id', 'teacher_said']
    }
  }
];

const toolParam = (pathname, param, node) => ({
  method: 'POST', url: base + pathname, api_token: 'Bearer ' + TOOL,
  headers: { 'Content-Type': 'application/json' }, param,
  scope: 'node', nodes: [node || 'lesson']
});

const agent = {
  agent_config: {
    agent_name: WEB ? 'Munni · Takhti app' : 'Munni · Takhti',
    // the greeting is written by the server in the lesson's language and
    // passed in user_data, so one agent serves Hindi and English families
    agent_welcome_message: '{{greeting}}',
    webhook_url: `${base}/voice/webhook?key=${HOOK}`,
    tasks: [{
      task_type: 'conversation',
      tools_config: {
        llm_agent: {
          agent_type: 'graph_agent',
          agent_flow_type: 'streaming',
          llm_config: {
            provider: 'openai', model: MODEL, max_tokens: 250, temperature: 0.2,
            routing_provider: 'openai', routing_model: MODEL, routing_max_tokens: 250,
            agent_information: PERSONA,
            routing_instructions: 'Route on what the person on the phone just said. During the lesson, stay_on_current_node unless one condition clearly and literally applies. A number, a single word, yes or no, a wrong or half answer, a half-read line, "I don\'t know", laughter or noise is part of the lesson: stay_on_current_node. Take the safety edge only when you can quote the child\'s own words about being hurt, afraid of someone or in danger.',
            current_node_id: 'start',
            // set by the server on every call (user_data) or inbound lookup
            variable_types: { allowed: 'boolean', registered: 'boolean', caller_kind: 'string' },
            nodes
          }
        },
        api_tools: {
          tools,
          tools_params: {
            takhti_next: toolParam('/voice/tools/next', { session_id: '%(session_id)s', caller_name: '%(caller_name)s' }),
            takhti_answer: Object.assign(toolParam('/voice/tools/answer', { session_id: '%(session_id)s', child_said: '%(child_said)s' }), { nodes: ['lesson', 'hush', 'play'] }),
            takhti_note: toolParam('/voice/tools/note', { session_id: '%(session_id)s', teacher_said: '%(teacher_said)s' }, 'teacher')
          }
        }
      },
      task_config: {
        hangup_after_LLMCall: false,       // required for end_call nodes
        dtmf_enabled: true,                // keypad answers (Plivo / Twilio / SIP trunk only)
        call_terminate: WEB ? 1200 : 540,  // hard stop: 9 minutes on the phone, 20 with games on screen
        hangup_after_silence: WEB ? 600 : 25,
        optimize_latency: true,
        // Bolna's own "are you still there?" is English; the graph's hush node handles a quiet child
        check_if_user_online: false
      },
      toolchain: { execution: 'parallel', pipelines: [['transcriber', 'llm', 'synthesizer']] }
    }]
  },
  // the create API needs a system prompt per task as well as the graph's own
  agent_prompts: { task_1: { system_prompt: PERSONA } }
};
/* Hearing and voice, so the output can be created through Bolna's API as it
   stands. Sarvam hears Hindi and Hinglish; never set keywords (a boosted
   word would make a misreading pass). Override the voice with
   TAKHTI_VOICE_PROVIDER / TAKHTI_VOICE_ID / TAKHTI_VOICE_NAME / TAKHTI_VOICE_MODEL. */
Object.assign(agent.agent_config.tasks[0].tools_config, {
  transcriber: { provider: 'sarvam', model: 'saaras:v4', language: LANG === 'en' ? 'en' : 'hi', stream: true, endpointing: 500 },
  synthesizer: { provider: process.env.TAKHTI_VOICE_PROVIDER || 'sarvam',
    provider_config: { voice: process.env.TAKHTI_VOICE_NAME || 'Suhani', voice_id: process.env.TAKHTI_VOICE_ID || 'suhani',
                       model: process.env.TAKHTI_VOICE_MODEL || 'bulbul:v3', language: LANG === 'en' ? 'en' : 'hi', speed: 0.95 },
    stream: true, buffer_size: 150 },
  input: { provider: 'plivo', format: 'wav' },
  output: { provider: 'plivo', format: 'wav' }
});

if (require.main === module) process.stdout.write(JSON.stringify(agent, null, 2) + '\n');
module.exports = { agent, nodes, tools, PERSONA };
