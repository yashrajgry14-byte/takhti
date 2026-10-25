#!/usr/bin/env node
/* ==================================================================
   TAKHTI'S BOLNA WORKFLOWS — WhatsApp + call sequences

     TAKHTI_PUBLIC_URL=… TAKHTI_TOOL_TOKEN=… BOLNA_AGENT_ID=… BOLNA_PARENT_AGENT_ID=… \
     node voice/agent/build-workflow.js daily   > voice/agent/daily.workflow.json
     node voice/agent/build-workflow.js consent > voice/agent/consent.workflow.json

   …or create the draft straight in your Bolna account and validate it
   (it is not published until you have looked at it in the editor):

     BOLNA_API_KEY=… node voice/agent/build-workflow.js daily --push

   DAILY (one family, one day; the server's scheduler starts it at the
   time the parent chose — BOLNA_DAILY_WORKFLOW_ID):

     plan ─▶ WhatsApp the reading card ─▶ wait ─▶ gate ─▶ call the child
       │                                            ▲          │ answered
       │ not today                       retry once │          ▼
       ▼                                (30 min) ◀── no answer   wait ─▶ result ─▶ WhatsApp 3-line report
      end                                    │
                                             ▼ still no
                                  missed ─▶ WhatsApp "what happens next"

   CONSENT (BOLNA_CONSENT_WORKFLOW_ID): plan ─▶ gate ─▶ call the parent
   (parent agent) ─▶ wait ─▶ result ─▶ WhatsApp a written copy of what
   they agreed to; no answer → one retry three hours later.

   Every decision is the server's (/voice/flow/*, voice/flow.js); the
   workflow only carries it out. Node format: Bolna's workflow definition
   (docs: workflows/nodes, workflows/conditions-and-variables).
   WhatsApp goes through Bolna's AiSensy node: the templates must exist
   and be approved first — their text is in voice/README.md.
   ================================================================== */
'use strict';
require('./env');   // reads voice/.env

const base = (process.env.TAKHTI_PUBLIC_URL || 'https://YOUR-TUNNEL.example').replace(/\/$/, '');
const TOOL = process.env.TAKHTI_TOOL_TOKEN || 'REPLACE_WITH_TAKHTI_TOOL_TOKEN';
const CHILD_AGENT = process.env.BOLNA_AGENT_ID || 'REPLACE_WITH_BOLNA_AGENT_ID';
const PARENT_AGENT = process.env.BOLNA_PARENT_AGENT_ID || 'REPLACE_WITH_BOLNA_PARENT_AGENT_ID';
const FROM = process.env.BOLNA_FROM_NUMBER || null;
const TPL = {
  card: process.env.TAKHTI_WA_CARD || 'takhti_card',
  report: process.env.TAKHTI_WA_REPORT || 'takhti_report',
  missed: process.env.TAKHTI_WA_MISSED || 'takhti_missed',
  consent: process.env.TAKHTI_WA_CONSENT || 'takhti_consent'
};
const CARD_LEAD = Number(process.env.TAKHTI_CARD_LEAD_MIN || 20);     // card arrives this long before the call
const RETRY = Number(process.env.TAKHTI_RETRY_MINUTES || 30);

/* ---------- condition and node helpers ---------- */
const v = name => ({ var: name });
const k = value => ({ const: value });
const eq = (name, value) => ({ cmp: '==', left: v(name), right: k(value) });
const all = (...xs) => ({ all: xs });
const ALWAYS = { always: true };
const when = (cond, to, effects) => ({ when: cond, then: effects ? { to, effects } : { to } });
const ok200 = eq('response.status', 200);

function api(id, path, body, map, cases) {
  return {
    id, type: 'api', name: path.replace('/voice/flow/', ''),
    config: {
      url: base + path, method: 'POST',
      headers: { Authorization: 'Bearer ' + TOOL, 'Content-Type': 'application/json' },
      body: Object.fromEntries(Object.keys(body).map(key => [key, `{${key}}`])),
      variables: Object.fromEntries(Object.entries(body).map(([key, val]) => [key, { value: val, type: 'string', required: true }])),
      response_map: Object.fromEntries(map.map(m => [m, m])),
      timeout_s: 20
    },
    cases
  };
}
function whatsapp(id, template, language, vars, to) {
  return {
    id, type: 'aisensy_whatsapp', name: `${template} (${language})`,
    config: { template_name: template, language, recipient: v('entry.mobile_number'),
              variables: Object.fromEntries(vars.map((x, i) => [String(i + 1), x])), campaign_name: template },
    // fire-and-forget: one "always" exit
    cases: [when(ALWAYS, to)]
  };
}
const wait = (id, delay, to) => ({ id, type: 'time', config: { delay }, to });
const end = (id, label, outcome) => ({ id, type: 'end', config: { label, outcome } });
const retry = (id, target, attempts, to) => ({ id, type: 'retry', config: { target_node_id: target, attempts: attempts.map(d => ({ delay: d })) }, cases: [when(ALWAYS, to)] });
const start = to => ({ id: 'n_start', type: 'start',
  config: { trigger: { kind: 'manual' }, fields: [{ name: 'child_id', type: 'string', required: true }] }, cases: [when(ALWAYS, to)] });
function call(id, agentId, extra, cases) {
  return {
    id, type: 'agent',
    config: Object.assign({
      agent_id: agentId, recipient: v('entry.mobile_number'), timeout_s: 1200,
      // exactly what Bolna's own calls get from the server: no age, no surname
      variables: Object.assign({ session_id: v('state.session_id'), child_name: v('state.child_name'),
                                 lesson_language: v('state.lesson_language'), greeting: v('state.greeting') }, extra)
    }, FROM ? { from_number: FROM } : {}),
    cases
  };
}
const keep = names => names.map(n => ({ set_value: { ['state.' + n]: v('response.' + n) } }));

/* ---------- the daily sequence ---------- */
function daily() {
  const plan = ['session_id', 'child_name', 'lang', 'lesson_language', 'greeting', 'card_url'];
  return {
    entry_node_id: 'n_start',
    on_no_match: 'n_end_unhandled',
    nodes: [
      start('n_plan'),
      api('n_plan', '/voice/flow/plan', { child_id: v('entry.child_id'), reference_id: v('entry.reference_id') },
        ['go', ...plan], [
          when(all(ok200, eq('response.go', true), eq('response.lang', 'hi')), 'n_card_hi', keep(plan)),
          when(all(ok200, eq('response.go', true)), 'n_card_en', keep(plan)),
          when(ALWAYS, 'n_end_skip')
        ]),
      whatsapp('n_card_hi', TPL.card, 'hi', [v('state.child_name'), v('state.card_url')], 'n_wait'),
      whatsapp('n_card_en', TPL.card, 'en', [v('state.child_name'), v('state.card_url')], 'n_wait'),
      wait('n_wait', { minutes: CARD_LEAD }, 'n_gate'),
      api('n_gate', '/voice/flow/gate', { session_id: v('state.session_id') }, ['go', 'why'], [
        when(all(ok200, eq('response.go', true)), 'n_call'),
        when(ALWAYS, 'n_missed')
      ]),
      call('n_call', CHILD_AGENT, { registered: k(true), allowed: k(true), caller_kind: k('child') }, [
        when(eq('call.status', 'completed'), 'n_settle'),
        when(ALWAYS, 'n_retry')
      ]),
      retry('n_retry', 'n_gate', [{ minutes: RETRY }], 'n_missed'),
      // the post-call webhook reaches the server first; give it a moment
      wait('n_settle', { minutes: 2 }, 'n_result'),
      api('n_result', '/voice/flow/result', { session_id: v('state.session_id') }, ['ready', 'l1', 'l2', 'l3', 'report_url', 'lang'], [
        when(all(ok200, eq('response.ready', true), eq('response.lang', 'hi')), 'n_report_hi'),
        when(all(ok200, eq('response.ready', true)), 'n_report_en'),
        when(ALWAYS, 'n_result_retry')
      ]),
      retry('n_result_retry', 'n_result', [{ minutes: 3 }, { minutes: 10 }], 'n_end_noreport'),
      whatsapp('n_report_hi', TPL.report, 'hi', [v('response.l1'), v('response.l2'), v('response.l3'), v('response.report_url')], 'n_end_done'),
      whatsapp('n_report_en', TPL.report, 'en', [v('response.l1'), v('response.l2'), v('response.l3'), v('response.report_url')], 'n_end_done'),
      api('n_missed', '/voice/flow/missed', { session_id: v('state.session_id') }, ['send', 'l1', 'lang'], [
        when(all(ok200, eq('response.send', true), eq('response.lang', 'hi')), 'n_missed_hi'),
        when(all(ok200, eq('response.send', true)), 'n_missed_en'),
        when(ALWAYS, 'n_end_missed')
      ]),
      whatsapp('n_missed_hi', TPL.missed, 'hi', [v('response.l1')], 'n_end_missed'),
      whatsapp('n_missed_en', TPL.missed, 'en', [v('response.l1')], 'n_end_missed'),
      end('n_end_done', 'report_sent', 'success'),
      end('n_end_skip', 'not_today', 'neutral'),
      end('n_end_missed', 'not_reached', 'failure'),
      end('n_end_noreport', 'no_report', 'neutral'),
      end('n_end_unhandled', 'unhandled', 'neutral')
    ]
  };
}

/* ---------- the consent call, with a written copy ---------- */
function consent() {
  const plan = ['session_id', 'child_name', 'lang', 'lesson_language', 'greeting'];
  return {
    entry_node_id: 'n_start',
    on_no_match: 'n_end_unhandled',
    nodes: [
      start('n_plan'),
      api('n_plan', '/voice/flow/consent/plan', { child_id: v('entry.child_id') }, ['go', ...plan], [
        when(all(ok200, eq('response.go', true)), 'n_gate', keep(plan)),
        when(ALWAYS, 'n_end_skip')
      ]),
      api('n_gate', '/voice/flow/gate', { session_id: v('state.session_id') }, ['go', 'why'], [
        when(all(ok200, eq('response.go', true)), 'n_call'),
        when(ALWAYS, 'n_end_missed')
      ]),
      call('n_call', PARENT_AGENT, { call_kind: k('consent') }, [
        when(eq('call.status', 'completed'), 'n_settle'),
        when(ALWAYS, 'n_retry')
      ]),
      retry('n_retry', 'n_gate', [{ hours: 3 }], 'n_end_missed'),
      wait('n_settle', { minutes: 2 }, 'n_result'),
      api('n_result', '/voice/flow/consent/result', { session_id: v('state.session_id') }, ['ready', 'given', 'l1', 'l2', 'lang'], [
        when(all(ok200, eq('response.ready', true), eq('response.given', true), eq('response.lang', 'hi')), 'n_copy_hi'),
        when(all(ok200, eq('response.ready', true), eq('response.given', true)), 'n_copy_en'),
        when(all(ok200, eq('response.ready', true)), 'n_end_notgiven'),
        when(ALWAYS, 'n_result_retry')
      ]),
      retry('n_result_retry', 'n_result', [{ minutes: 3 }, { minutes: 10 }], 'n_end_noreport'),
      whatsapp('n_copy_hi', TPL.consent, 'hi', [v('response.l1'), v('response.l2')], 'n_end_given'),
      whatsapp('n_copy_en', TPL.consent, 'en', [v('response.l1'), v('response.l2')], 'n_end_given'),
      end('n_end_given', 'consent_given', 'success'),
      end('n_end_notgiven', 'consent_not_given', 'neutral'),
      end('n_end_skip', 'not_needed', 'neutral'),
      end('n_end_missed', 'not_reached', 'failure'),
      end('n_end_noreport', 'no_result', 'neutral'),
      end('n_end_unhandled', 'unhandled', 'neutral')
    ]
  };
}

const WORKFLOWS = { daily, consent };
const NAMES = { daily: 'Takhti · daily lesson', consent: 'Takhti · consent call' };

/* Create the draft in Bolna and run Bolna's own validator on it. */
async function push(kind, definition) {
  const key = process.env.BOLNA_API_KEY;
  if (!key) throw new Error('set BOLNA_API_KEY to push');
  const apiBase = process.env.BOLNA_API_BASE || 'https://api.bolna.ai';
  const req = async (method, path, body) => {
    const r = await fetch(apiBase + path, { method, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
                                            body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(data)}`);
    return data;
  };
  const wf = await req('POST', '/workflows', { name: NAMES[kind] });
  const id = wf.id || wf.workflow_id;
  await req('PUT', `/workflows/${id}/draft`, { expected_revision: 0, definition });
  const check = await req('POST', `/workflows/${id}/validate`, {});
  return { id, check };
}

if (require.main === module) {
  const kind = process.argv[2] || 'daily';
  if (!WORKFLOWS[kind]) { console.error('usage: build-workflow.js daily|consent [--push]'); process.exit(1); }
  const def = WORKFLOWS[kind]();
  if (process.argv.includes('--push')) {
    push(kind, def).then(r => {
      console.log(`created draft workflow ${r.id}. Bolna's validator says:\n${JSON.stringify(r.check, null, 2)}`);
      console.log(`Review it in the editor, publish it, then set BOLNA_${kind === 'daily' ? 'DAILY' : 'CONSENT'}_WORKFLOW_ID=${r.id}`);
    }).catch(e => { console.error(e.message); process.exit(1); });
  } else process.stdout.write(JSON.stringify(def, null, 2) + '\n');
}

module.exports = { daily, consent, TPL };
