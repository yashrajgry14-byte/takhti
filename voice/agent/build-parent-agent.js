#!/usr/bin/env node
/* ==================================================================
   MUNNI FOR PARENTS — the Bolna graph agent for parent calls

     TAKHTI_PUBLIC_URL=https://xyz.trycloudflare.com \
     TAKHTI_TOOL_TOKEN=... TAKHTI_WEBHOOK_KEY=... \
     node voice/agent/build-parent-agent.js > voice/agent/munni-parent.agent.json

   One agent for both parent calls: the consent call and the weekly
   progress call. Which one it is, and every sentence, comes from the
   server (voice/parent.js) through one tool, takhti_parent. The graph
   only holds the call around it: the greeting, silence, and hanging up.
   Its id goes in BOLNA_PARENT_AGENT_ID.

   Same payload structure as build-agent.js (Bolna's graph-agent
   format); voice, transcriber and telephony are set in the dashboard.
   ================================================================== */
'use strict';
require('./env');   // reads voice/.env

const LANG = process.env.TAKHTI_AGENT_LANG || 'hi';
const base = (process.env.TAKHTI_PUBLIC_URL || 'https://YOUR-TUNNEL.example').replace(/\/$/, '');
const TOOL = process.env.TAKHTI_TOOL_TOKEN || 'REPLACE_WITH_TAKHTI_TOOL_TOKEN';
const HOOK = process.env.TAKHTI_WEBHOOK_KEY || 'REPLACE_WITH_TAKHTI_WEBHOOK_KEY';
const MODEL = process.env.TAKHTI_AGENT_MODEL || 'gpt-4.1-mini';
const say = (hi, en) => LANG === 'multi' ? { hi, en } : LANG === 'en' ? en : hi;

const PERSONA = `You are Munni from Takhti, on a phone call with a child's parent or guardian about the child's practice lessons. The child's name is {{child_name}}. The call language is {{lesson_language}}.

How you work:
1. Speak ONLY the text in the "say" field that the takhti_parent tool returns, word for word. Never add to it, shorten it, translate it, or change any number, time or day in it.
2. Every time the person speaks, call takhti_parent with exactly the words you heard. If you receive "dtmf_number: ..." they pressed keys: pass that text unchanged.
3. Never answer a question yourself, never give advice, never promise anything, and never agree to anything on the family's behalf. The tool decides every answer, including what to say when it can't help.
4. Never ask for personal information beyond what the tool says. Never discuss other children or other families.
5. Hindi lines are written in Devanagari: read them naturally, politely, using "aap".`;

const nodes = [
  {
    id: 'start',
    prompt: 'Munni has just said the greeting, which asks whether she is speaking with {{child_name}}\'s parent or guardian. Wait for the reply. Do not say anything yourself and do not call any tool.',
    repeat_after_silence_seconds: 7,
    edges: [
      { to_node_id: 'no_reply', condition_type: 'expression', priority: 0,
        expression: { conditions: [{ variable: '_silence_repeats', operator: 'gte', value: 2 }] } },
      { to_node_id: 'talk', condition: 'The person said anything at all in reply, or pressed a key.',
        parameters: { parent_said: { type: 'string', description: 'The person\'s exact words in reply to the greeting (or the dtmf_number text).' } } }
    ]
  },
  {
    id: 'talk',
    function_call: 'takhti_parent',
    prompt: 'Call @takhti_parent with parent_said = "{{parent_said}}" (the reply to the greeting) and speak its "say" exactly. From then on, every time the person speaks, call @takhti_parent with their exact words and speak the new "say" exactly. When a result has "done": true, its "say" is the goodbye: speak it and then stop talking.',
    repeat_after_silence_seconds: 9,
    edges: [
      { to_node_id: 'no_reply', condition_type: 'expression', priority: 0,
        expression: { conditions: [{ variable: '_silence_repeats', operator: 'gte', value: 3 }] } },
      { to_node_id: 'end_now', condition_type: 'expression', priority: 1,
        expression: { conditions: [{ variable: '_total_turns', operator: 'gte', value: 50 }] } },
      { to_node_id: 'end_now',
        condition: 'Munni has already spoken a goodbye from a tool result with done = true (it ends with "Goodbye!" or "नमस्ते!"), and the person says anything, or says bye.' }
    ]
  },
  {
    id: 'no_reply',
    node_type: 'static',
    static_message: say('लगता है अभी बात करने का सही समय नहीं है। तख़्ती फिर फ़ोन करेगी। नमस्ते!', "It sounds like now isn't a good time. Takhti will call another time. Goodbye!"),
    function_call: 'end_call',
    edges: []
  },
  {
    id: 'end_now',
    node_type: 'static',
    static_message: say('नमस्ते!', 'Goodbye!'),
    function_call: 'end_call',
    edges: []
  }
];

const tools = [{
  key: 'custom_task',
  name: 'takhti_parent',
  description: 'Send what the parent just said to Takhti and get what Munni says next. Call this EVERY time the parent speaks.',
  parameters: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'The call id: always {{session_id}}.' },
      parent_said: { type: 'string', description: 'The parent\'s exact words as you heard them. Do not correct, complete or translate them.' }
    },
    required: ['session_id', 'parent_said']
  }
}];

const agent = {
  agent_config: {
    agent_name: 'Munni · Takhti parents',
    agent_welcome_message: '{{greeting}}',
    webhook_url: `${base}/voice/webhook?key=${HOOK}`,
    tasks: [{
      task_type: 'conversation',
      tools_config: {
        llm_agent: {
          agent_type: 'graph_agent',
          agent_flow_type: 'streaming',
          llm_config: {
            provider: 'openai', model: MODEL, max_tokens: 300, temperature: 0.2,
            routing_provider: 'openai', routing_model: MODEL, routing_max_tokens: 250,
            agent_information: PERSONA,
            routing_instructions: 'Stay on the talk node for the whole conversation; leave it only when one of its conditions clearly applies.',
            current_node_id: 'start',
            nodes
          }
        },
        api_tools: {
          tools,
          tools_params: {
            takhti_parent: {
              method: 'POST', url: base + '/voice/tools/parent', api_token: 'Bearer ' + TOOL,
              headers: { 'Content-Type': 'application/json' },
              param: { session_id: '%(session_id)s', parent_said: '%(parent_said)s' },
              scope: 'node', nodes: ['talk']
            }
          }
        }
      },
      task_config: {
        hangup_after_LLMCall: false,
        dtmf_enabled: true,                 // 1 = yes, 2 = no on the consent call
        call_terminate: 480,
        hangup_after_silence: 25,
        optimize_latency: true
      }
    }]
  }
};

if (require.main === module) process.stdout.write(JSON.stringify(agent, null, 2) + '\n');
module.exports = { agent, nodes, tools, PERSONA };
