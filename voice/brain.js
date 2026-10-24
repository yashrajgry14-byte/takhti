/* ==================================================================
   THE TAKHTI BRAIN — children, sessions, calls, and the two tools
   Bolna's voice agent is allowed to use.

   server.js is only HTTP plumbing around this file, and simulate.js
   drives this file directly, so everything a real call does can be
   rehearsed in a terminal with no phone and no credits.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const { createCore } = require('./takhti-core');
const { createStore } = require('./store');
const S = require('./session');
const { processCallEnd } = require('./report');

const newId = () => crypto.randomBytes(12).toString('base64url');

function createBrain(opts) {
  opts = opts || {};
  const core = createCore();
  const store = opts.store || createStore(opts.dataDir);
  const { out: built } = core.withChild(core.freshProfile('x', 7), {}, T => S.buildStoryBank(T));
  const storyBank = built.bank;
  if (built.dropped.length) console.warn(`[takhti] ${built.dropped.length} story problems dropped by the cross-check:`, built.dropped.slice(0, 5));

  /* ---------- children ---------- */
  function registerChild(input) {
    const name = String(input.name || '').trim();
    const age = Number(input.age);
    const lang = input.lang === 'en' ? 'en' : input.lang === 'hi' ? 'hi' : null;
    const phone = String(input.parent_phone || '').replace(/[\s-]/g, '');
    const errs = [];
    if (!name || name.length > 40) errs.push('name is required (max 40 characters)');
    if (!Number.isInteger(age) || age < 3 || age > 10) errs.push('age must be a whole number from 3 to 10');
    if (!lang) errs.push('lang must be "hi" or "en"');
    if (!/^\+\d{10,15}$/.test(phone)) errs.push('parent_phone must be in international format, e.g. +919876543210');
    // a child's data is processed only with a parent's consent (DPDP Act s.9)
    if (input.consent !== true) errs.push('a parent must consent before Munni can call (consent: true)');
    if (errs.length) return { error: errs };

    const child = {
      id: newId(), name: name.charAt(0).toUpperCase() + name.slice(1), age, lang,
      parent_phone: phone,
      consent: { given: true, by: String(input.consent_by || 'parent').slice(0, 60), at: new Date().toISOString(),
                 recording: input.consent_recording !== false },
      created_at: new Date().toISOString(),
      profile: core.freshProfile(name, age),
      sessions: []
    };
    store.put('children', child.id, child);
    return { child };
  }

  /* Right to erasure: the child, every session, every transcript. */
  function deleteChild(id) {
    const child = store.get('children', id);
    if (!child) return false;
    for (const sid of child.sessions || []) store.remove('sessions', sid);
    store.remove('children', id);
    return true;
  }

  /* ---------- sessions ---------- */
  function createSession(childId, o) {
    const child = store.get('children', childId);
    if (!child) return { error: ['no such child'] };
    const s = S.planSession(core, child, { seed: o && o.seed });
    child.sessions = (child.sessions || []).concat(s.id).slice(-200);
    store.put('sessions', s.id, s);
    store.put('children', child.id, child);
    return { session: s, child };
  }

  function load(sessionId) {
    const s = sessionId && store.get('sessions', String(sessionId));
    const child = s && store.get('children', s.child_id);
    return s && child ? { s, child } : null;
  }
  function save(s, child) { store.put('sessions', s.id, s); store.put('children', child.id, child); }

  /* ---------- the two tools ---------- */
  // we don't know the session, so we don't know the language: say both
  const SORRY = 'माफ़ करना, अभी आज का पाठ नहीं खुल रहा। हम जल्दी फिर बात करेंगे। ' +
                "Sorry, I can't open today's lesson right now. We'll talk again soon. Bye bye!";
  function toolNext(sessionId) {
    const x = load(sessionId);
    if (!x) return { say: SORRY, expect: 'none', done: true, error: 'unknown session' };
    const r = S.next(core, x.child, x.s, storyBank);
    log(x.s, 'assistant', r.say);
    save(x.s, x.child);
    return r;
  }
  function toolAnswer(sessionId, said) {
    const x = load(sessionId);
    if (!x) return { say: SORRY, expect: 'none', done: true, error: 'unknown session' };
    log(x.s, 'user', said);
    const r = S.answer(core, x.child, x.s, storyBank, said);
    log(x.s, 'assistant', r.say);
    save(x.s, x.child);
    return r;
  }
  // what the tools saw, in order — the live view on the dashboard
  function log(s, role, text) {
    s.live_turns = s.live_turns || [];
    s.live_turns.push({ role, text: String(text == null ? '' : text).slice(0, 500), at: Date.now() });
    if (s.live_turns.length > 200) s.live_turns.shift();
  }

  /* ---------- after the call ---------- */
  function onCallEvent(payload) {
    const rd = (payload.context_details && payload.context_details.recipient_data) || {};
    const sessionId = rd.session_id || payload.session_id;
    const x = load(sessionId);
    if (!x) return { ok: false, reason: 'no session for this call' };
    x.s.call = Object.assign(x.s.call || {}, { execution_id: payload.id, last_status: payload.status });
    const r = processCallEnd(core, x.child, x.s, payload);
    save(x.s, x.child);
    return Object.assign({ ok: true, session_id: x.s.id }, r);
  }

  /* ---------- placing a call through Bolna ---------- */
  async function placeCall(sessionId, env) {
    env = env || process.env;
    const x = load(sessionId);
    if (!x) return { error: 'no such session' };
    if (!env.BOLNA_API_KEY || !env.BOLNA_AGENT_ID) return { error: 'set BOLNA_API_KEY and BOLNA_AGENT_ID' };
    const body = {
      agent_id: env.BOLNA_AGENT_ID,
      recipient_phone_number: x.child.parent_phone,
      // the minimum Bolna needs: no age, no surname, no phone in the prompt
      user_data: { session_id: x.s.id, child_name: x.child.name, lesson_language: x.s.lang === 'hi' ? 'Hindi' : 'English',
                   greeting: greeting(x.child, x.s.lang) }
    };
    if (env.BOLNA_FROM_NUMBER) body.from_phone_number = env.BOLNA_FROM_NUMBER;
    if (env.BOLNA_MULTILINGUAL === '1') body.agent_data = { language: x.s.lang };
    const res = await fetch((env.BOLNA_API_BASE || 'https://api.bolna.ai') + '/call', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.BOLNA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: `Bolna said ${res.status}`, detail: data };
    x.s.call = Object.assign(x.s.call || {}, { execution_id: data.execution_id, queued_at: new Date().toISOString() });
    x.s.status = 'calling';
    save(x.s, x.child);
    return { ok: true, execution_id: data.execution_id };
  }

  /* The first words of the call. Whoever picks up hears who is calling,
     why, and (if the parent agreed to recording) that it is recorded. */
  function greeting(child, lang) {
    const n = child.name;
    const rec = child.consent && child.consent.recording;
    return lang === 'hi'
      ? `नमस्ते! मैं मुन्नी हूँ, तख़्ती से। ${n} के आज के पाठ के लिए फ़ोन किया है।${rec ? ' सीखने में मदद के लिए यह कॉल रिकॉर्ड होती है।' : ''} क्या ${n} तैयार हैं?`
      : `Namaste! I'm Munni from Takhti, calling for ${n}'s lesson today.${rec ? ` This call is recorded to help ${n} learn.` : ''} Is ${n} ready?`;
  }

  return {
    core, store, storyBank, greeting,
    registerChild, deleteChild, createSession, toolNext, toolAnswer, onCallEvent, placeCall,
    getChild: id => store.get('children', id),
    getSession: id => store.get('sessions', id),
    listChildren: () => store.list('children'),
    listSessions: () => store.list('sessions')
  };
}

module.exports = { createBrain };
