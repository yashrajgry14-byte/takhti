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
const { processCallEnd, progressCodeFor } = require('./report');
const { soundsLike } = require('./sounds');

const newId = () => crypto.randomBytes(12).toString('base64url');

function createBrain(opts) {
  opts = opts || {};
  const store = opts.store || createStore(opts.dataDir);
  // this server's own "localStorage": the class mirror and homework live here
  const core = createCore({ persist: {
    load: () => (store.get('mirror', 'storage') || {}).data,
    save: data => store.put('mirror', 'storage', { data })
  } });
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

  /* ---------- the class, between phones (core/class-share.js) ----------
     The server is one more phone. A teacher's HOMEWORK CODE pasted for a
     child links them to the class and puts the homework where the app's
     own personalizeContentForHomework() finds it; the next call asks it.
     A PROGRESS CODE carries the child's phone practice back to the teacher
     view — the same codes, the same checksum, nothing new to trust. */
  function importHomeworkCode(childId, text) {
    const child = store.get('children', childId);
    if (!child) return { ok: false, why: 'no such child' };
    const { out } = core.withChild(child.profile, { lang: child.lang }, T => T.importHomework(text, T.S));
    if (out.ok) store.put('children', child.id, child);
    return out;
  }
  function progressCode(childId) {
    const child = store.get('children', childId);
    return child ? progressCodeFor(core, child) : null;
  }

  /* A parent's choice, per child: alternate English practice with the
     normal lesson (never replace it). */
  function setEnglishPractice(childId, on) {
    const child = store.get('children', childId);
    if (!child) return null;
    child.english_practice = !!on;
    store.put('children', child.id, child);
    return { id: child.id, english_practice: child.english_practice };
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
    o = o || {};
    const s = S.planSession(core, child, {
      seed: o.seed, channel: o.channel, kind: o.kind,
      keypad: o.keypad != null ? o.keypad : process.env.TAKHTI_KEYPAD !== '0'
    });
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
  function toolNext(sessionId, callerName) {
    let x = load(sessionId);
    if (x && x.s.candidates && !x.s.started_at) x = resolveSibling(x, callerName);
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
  /* ---------- the child calls Munni (inbound line) ----------
     Bolna asks us who is calling before Munni says a word (a GET with
     the caller's number, answered within 3 seconds); what we return
     becomes the call's variables. Rules a child-facing line needs:
     only numbers a parent registered (with consent) get a lesson; a
     daily limit, because an always-open line must not become a habit
     loop (DPDP s.9); quiet hours, because a seven-year-old calling at
     11pm should hear "rest time", not a sum. */
  function localNow(env) {
    const tz = env.TAKHTI_TZ || 'Asia/Kolkata';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
  }
  function inQuietHours(hour, spec) {
    const m = String(spec || '21-7').match(/^(\d{1,2})-(\d{1,2})$/);
    if (!m) return false;
    const a = Number(m[1]), b = Number(m[2]);
    return a <= b ? hour >= a && hour < b : hour >= a || hour < b;
  }
  const lastTen = p => String(p || '').replace(/\D/g, '').slice(-10);
  const INBOUND_TEXT = {
    hello:   { hi: n => `नमस्ते ${n}! मैं मुन्नी हूँ। चलो, आज थोड़ा अभ्यास करें?`, en: n => `Namaste ${n}! It's Munni. Shall we practise a little today?` },
    who:     { hi: ns => `नमस्ते! मैं मुन्नी हूँ। कौन बोल रहा है — ${ns.join(' या ')}?`, en: ns => `Namaste! It's Munni. Who's calling — ${ns.join(' or ')}?` },
    rec:     { hi: ' सीखने में मदद के लिए यह कॉल रिकॉर्ड होती है।', en: ' This call is recorded to help you learn.' },
    enough:  { hi: n => `नमस्ते ${n}! आज हम पहले ही अभ्यास कर चुके हैं। अब आराम करो, कल फिर बात करेंगे। बाय-बाय!`,
               en: n => `Namaste ${n}! We've already practised today. Time for a rest — we'll talk tomorrow. Bye bye!` },
    quiet:   { hi: n => `नमस्ते ${n}! अभी आराम का समय है। मुन्नी कल बात करेगी। बाय-बाय!`,
               en: n => `Namaste ${n}! It's rest time now. Munni will talk tomorrow. Bye bye!` },
    unknown: 'नमस्ते! यह तख़्ती की मुन्नी है। यह नंबर अभी तख़्ती में जुड़ा नहीं है। अपने स्कूल या टीचर से कहो। बाय-बाय! ' +
             "Namaste! This is Munni from Takhti. This number isn't registered with Takhti yet — please ask your school or teacher. Bye bye!"
  };

  function inboundLookup(q, env) {
    env = env || process.env;
    const num = lastTen(q.contact_number);
    const kids = num.length === 10 ? store.list('children').filter(c => c.consent && c.consent.given && lastTen(c.parent_phone) === num) : [];
    const closed = greeting => ({ registered: kids.length > 0, allowed: false, session_id: 'none', child_name: kids[0] ? kids[0].name : '',
                                  lesson_language: kids[0] && kids[0].lang === 'en' ? 'English' : 'Hindi', greeting });
    if (!kids.length) return closed(INBOUND_TEXT.unknown);

    const lang = kids[0].lang === 'en' ? 'en' : 'hi';
    const names = kids.map(k => k.name);
    const now = localNow(env);
    if (inQuietHours(now.hour, env.TAKHTI_QUIET_HOURS)) return closed(INBOUND_TEXT.quiet[lang](names.join(lang === 'hi' ? ' और ' : ' and ')));

    // a child who has already had today's inbound lessons rests; siblings
    // who haven't can still have theirs
    const limit = Number(env.TAKHTI_INBOUND_DAILY || 2);
    const usedToday = c => (c.sessions || []).map(id => store.get('sessions', id)).filter(s => s && s.channel === 'inbound' &&
      s.started_at && localDay(s.started_at, env) === now.day).length;
    const open = kids.filter(c => usedToday(c) < limit);
    if (!open.length) return closed(INBOUND_TEXT.enough[lang](names.join(lang === 'hi' ? ' और ' : ' and ')));

    const rec = open.some(c => c.consent.recording) ? INBOUND_TEXT.rec[lang] : '';
    let session;
    if (open.length === 1) {
      session = createSession(open[0].id, { channel: 'inbound', kind: nextKind(open[0]) }).session;
    } else {
      // siblings share a phone: plan for the first, and let the child's
      // answer to "who's calling?" re-point it before the first question
      session = createSession(open[0].id, { channel: 'inbound', kind: nextKind(open[0]) }).session;
      session.candidates = open.map(c => c.id);
      store.put('sessions', session.id, session);
    }
    session.call = { execution_id: q.execution_id || null, inbound: true };
    store.put('sessions', session.id, session);
    const child = open[0];
    return {
      registered: true, allowed: true, session_id: session.id, child_name: open.length === 1 ? child.name : '',
      lesson_language: lang === 'hi' ? 'Hindi' : 'English',
      greeting: (open.length === 1 ? INBOUND_TEXT.hello[lang](child.name) : INBOUND_TEXT.who[lang](open.map(c => c.name))) + rec
    };
  }
  function localDay(iso, env) {
    const tz = env.TAKHTI_TZ || 'Asia/Kolkata';
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  /* The name the child gave when Munni asked who is calling, matched by
     sound (रिया ↔ Riya). No match keeps the first sibling, and says so in
     the session record rather than guessing silently. */
  function resolveSibling(x, callerName) {
    const ids = x.s.candidates;
    const kids = ids.map(id => store.get('children', id)).filter(Boolean);
    const said = String(callerName || '').split(/\s+/);
    const pick = kids.find(k => said.some(w => soundsLike(k.name, w)));
    const chosen = pick || kids[0];
    let s = x.s;
    if (chosen.id !== s.child_id) {
      // replan for the right child under the same id Bolna already holds
      const fresh = S.planSession(core, chosen, { id: s.id, channel: 'inbound', kind: nextKind(chosen),
                                                  keypad: s.keypad });
      fresh.call = s.call; fresh.live_turns = s.live_turns;
      const old = store.get('children', s.child_id);
      if (old) { old.sessions = (old.sessions || []).filter(i => i !== s.id); store.put('children', old.id, old); }
      chosen.sessions = (chosen.sessions || []).concat(s.id).slice(-200);
      s = fresh;
    }
    s.sibling_pick = pick ? 'named' : 'default';
    delete s.candidates;
    store.put('sessions', s.id, s); store.put('children', chosen.id, chosen);
    return { s, child: chosen };
  }
  /* Which kind of lesson comes next. A parent who turned on English
     practice gets it every other call, never instead of reading and maths. */
  function nextKind(child) {
    if (!child.english_practice) return 'lesson';
    const last = (child.sessions || []).map(id => store.get('sessions', id)).filter(s => s && s.started_at).pop();
    return last && last.kind !== 'english' ? 'english' : 'lesson';
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
                   greeting: greeting(x.child, x.s.lang), registered: true, allowed: true }
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
    importHomeworkCode, progressCode, inboundLookup, nextKind, setEnglishPractice,
    getChild: id => store.get('children', id),
    getSession: id => store.get('sessions', id),
    listChildren: () => store.list('children'),
    listSessions: () => store.list('sessions')
  };
}

module.exports = { createBrain };
