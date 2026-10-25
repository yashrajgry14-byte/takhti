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
const { processCallEnd, progressCodeFor, missedReport } = require('./report');
const { soundsLike } = require('./sounds');
const PC = require('./parent');
const NT = require('./notes');
const PLC = require('./placement');
const R = require('./report');
const C = require('./clock');

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
    // a child's data is processed only with a parent's consent (DPDP Act
    // s.9): given in person (consent: true), or asked for on a consent call
    // (consent: 'call') — then nobody calls the child until that call, and
    // the transcript check after it, say yes
    const byCall = input.consent === 'call';
    if (input.consent !== true && !byCall) errs.push('a parent must consent before Munni can call (consent: true), or ask on a consent call (consent: "call")');
    const plang = input.parent_lang === 'en' ? 'en' : input.parent_lang === 'hi' ? 'hi' : lang;
    if (errs.length) return { error: errs };

    if (input.school_id && !store.get('schools', String(input.school_id))) return { error: ['no such school'] };
    const child = {
      id: newId(), name: name.charAt(0).toUpperCase() + name.slice(1), age, lang, parent_lang: plang,
      school_id: input.school_id ? String(input.school_id) : null,
      placement_due: input.placement === true || input.placement === 'yes',
      parent_phone: phone,
      consent: byCall
        ? { given: false, status: 'pending', method: 'call', asked_at: null }
        : { given: true, status: 'given', method: 'in person', by: String(input.consent_by || 'parent').slice(0, 60), at: new Date().toISOString(),
            recording: input.consent_recording !== false,
            // using the words a child reads (no name, no voice) to improve
            // Takhti is a separate purpose: only with its own yes
            research: input.consent_research === true },
      created_at: new Date().toISOString(),
      profile: core.freshProfile(name, age),
      sessions: []
    };
    store.put('children', child.id, child);
    return { child };
  }

  /* ---------- schools: one isolated account each ----------
     A school sees only its own children, calls and teachers (its own admin
     key), and calls go out on its own Bolna account — a Bolna sub-account,
     so each school's data is separate on Bolna's side too, with one bill.
     The keys a school's calls use replace the server's own (envFor()). */
  const hash = k => crypto.createHash('sha256').update(String(k)).digest('hex');
  const BOLNA_FIELDS = { api_key: 'BOLNA_API_KEY', agent_id: 'BOLNA_AGENT_ID', parent_agent_id: 'BOLNA_PARENT_AGENT_ID',
                         from_number: 'BOLNA_FROM_NUMBER', daily_workflow_id: 'BOLNA_DAILY_WORKFLOW_ID',
                         consent_workflow_id: 'BOLNA_CONSENT_WORKFLOW_ID' };
  function createSchool(input) {
    const name = String(input.name || '').trim().slice(0, 80);
    if (!name) return { error: ['a school needs a name'] };
    const key = crypto.randomBytes(24).toString('base64url');
    const school = { id: 'sch_' + newId(), name, contact: String(input.contact || '').slice(0, 60), key_hash: hash(key),
                     bolna: {}, created_at: new Date().toISOString() };
    setBolnaFields(school, input.bolna || {});
    store.put('schools', school.id, school);
    // the key is shown once; only its hash is kept
    return { school: publicSchool(school), key };
  }
  function setBolnaFields(school, b) {
    for (const f of Object.keys(BOLNA_FIELDS)) if (b[f] != null && b[f] !== '') school.bolna[f] = String(b[f]).slice(0, 200);
  }
  function updateSchool(id, input) {
    const school = store.get('schools', id);
    if (!school) return { error: ['no such school'] };
    if (input.name) school.name = String(input.name).slice(0, 80);
    if (input.contact != null) school.contact = String(input.contact).slice(0, 60);
    setBolnaFields(school, input.bolna || {});
    store.put('schools', id, school);
    return { school: publicSchool(school) };
  }
  function schoolByKey(key) {
    if (!key) return null;
    const h = Buffer.from(hash(key));
    return store.list('schools').find(sc => { const x = Buffer.from(sc.key_hash || ''); return x.length === h.length && crypto.timingSafeEqual(x, h); }) || null;
  }
  // never hand a stored Bolna key back out
  function publicSchool(sc) {
    const { key_hash, bolna, ...rest } = sc;
    return Object.assign(rest, { bolna: Object.fromEntries(Object.entries(bolna || {}).map(([k, v]) => [k, k === 'api_key' ? '•••' + v.slice(-4) : v])) });
  }
  /* The settings a call for this child uses: the school's own Bolna
     account where it has one, else the server's. */
  function envFor(child, env) {
    env = env || process.env;
    const sc = child && child.school_id && store.get('schools', child.school_id);
    if (!sc) return env;
    const over = {};
    for (const [f, k] of Object.entries(BOLNA_FIELDS)) if (sc.bolna && sc.bolna[f]) over[k] = sc.bolna[f];
    if (sc.contact) over.TAKHTI_HELP_CONTACT = sc.contact;
    return Object.assign({}, env, over);
  }

  /* ---------- teachers (voice notes, class calls) ---------- */
  function registerTeacher(input) {
    const name = String(input.name || '').trim().slice(0, 60);
    const phone = String(input.phone || '').replace(/[\s-]/g, '');
    const codes = [].concat(input.class_codes || input.class_code || []).map(c => String(c).trim().toUpperCase()).filter(Boolean);
    const errs = [];
    if (!name) errs.push('name is required');
    if (!/^\+\d{10,15}$/.test(phone)) errs.push('phone must be in international format');
    if (input.school_id && !store.get('schools', String(input.school_id))) errs.push('no such school');
    if (errs.length) return { error: errs };
    const t = { id: 'tch_' + newId(), name, phone, lang: input.lang === 'en' ? 'en' : 'hi', class_codes: codes,
                school_id: input.school_id ? String(input.school_id) : null,
      placement_due: input.placement === true || input.placement === 'yes', created_at: new Date().toISOString() };
    store.put('teachers', t.id, t);
    return { teacher: t };
  }
  /* the children a teacher may talk about: their classes, their school */
  function classChildren(teacherOrCodes, schoolId) {
    const codes = Array.isArray(teacherOrCodes) ? teacherOrCodes : teacherOrCodes.class_codes;
    const sch = Array.isArray(teacherOrCodes) ? schoolId : teacherOrCodes.school_id;
    return store.list('children').filter(c => c.kind !== 'app' && c.profile && codes.includes(String(c.profile.classCode || '').toUpperCase()) &&
      (c.school_id || null) === (sch || null));
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
    for (const pid of child.parent_calls || []) store.remove('parentcalls', pid);
    store.remove('children', id);
    return true;
  }

  /* ---------- sessions ---------- */
  function createSession(childId, o) {
    const child = store.get('children', childId);
    if (!child) return { error: ['no such child'] };
    if (!child.consent || !child.consent.given) return { error: ['waiting for a parent\'s consent (' + ((child.consent && child.consent.status) || 'none') + ')'] };
    o = o || {};
    if (o.kind === 'placement' && child.age < 5) return { error: ['the placement call is for ages 5 and up'] };
    const s = o.kind === 'placement' ? PLC.planPlacement(core, child, { seed: o.seed, channel: o.channel,
      keypad: o.keypad != null ? o.keypad : process.env.TAKHTI_KEYPAD !== '0' }) : S.planSession(core, child, {
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
    const r = x.s.kind === 'placement' ? PLC.next(core, x.child, x.s) : S.next(core, x.child, x.s, storyBank);
    log(x.s, 'assistant', r.say);
    save(x.s, x.child);
    return r;
  }
  function toolAnswer(sessionId, said) {
    const x = load(sessionId);
    if (!x) return { say: SORRY, expect: 'none', done: true, error: 'unknown session' };
    log(x.s, 'user', said);
    const r = x.s.kind === 'placement' ? PLC.answer(core, x.child, x.s, said) : S.answer(core, x.child, x.s, storyBank, said);
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
    // a school's own inbound number rings its own agent: only its children
    const school = q.agent_id ? store.list('schools').find(sc => sc.bolna && sc.bolna.agent_id === q.agent_id) : null;
    const inSchool = c => !school || c.school_id === school.id;
    // a teacher ringing in leaves a voice note (notes.js), whatever the hour
    const teacher = num.length === 10 ? store.list('teachers').find(t => inSchool(t) && lastTen(t.phone) === num) : null;
    if (teacher) {
      const ns = NT.planNoteCall(teacher);
      ns.call = { execution_id: q.execution_id || null, inbound: true };
      store.put('teachercalls', ns.id, ns);
      return { registered: true, allowed: true, caller_kind: 'teacher', session_id: ns.id, child_name: '',
               lesson_language: ns.lang === 'hi' ? 'Hindi' : 'English', greeting: ns.greeting };
    }
    const kids = num.length === 10 ? store.list('children').filter(c => c.consent && c.consent.given && inSchool(c) && lastTen(c.parent_phone) === num) : [];
    const closed = greeting => ({ registered: kids.length > 0, allowed: false, caller_kind: 'child', session_id: 'none', child_name: kids[0] ? kids[0].name : '',
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
      registered: true, allowed: true, caller_kind: 'child', session_id: session.id, child_name: open.length === 1 ? child.name : '',
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
    // a new admission the school asked to place: the first call finds the starting point
    if (child.placement_due && !child.placement && child.age >= 5) return 'placement';
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
  function onCallEvent(payload, env, nowIn) {
    env = env || process.env;
    const rd = (payload.context_details && payload.context_details.recipient_data) || {};
    const sessionId = rd.session_id || payload.session_id;
    const pc = sessionId && store.get('parentcalls', String(sessionId));
    if (pc) return onParentCallEnd(pc, payload, env);
    const tc = sessionId && store.get('teachercalls', String(sessionId));
    if (tc) return onTeacherCallEnd(tc, payload);
    const x = load(sessionId);
    if (!x) return { ok: false, reason: 'no session for this call' };
    // processCallEnd records the execution id itself: setting it here first
    // made every later event (a retry's own call) look "already processed"
    x.s.call = Object.assign(x.s.call || {}, { last_status: payload.status });
    const r = x.s.kind === 'placement' ? PLC.processPlacementEnd(core, x.child, x.s, payload, R) : processCallEnd(core, x.child, x.s, payload);
    if (r.changed && (x.s.status === 'missed' || x.s.status === 'no_lesson')) afterMissed(x.child, x.s, env, nowIn);
    save(x.s, x.child);
    return Object.assign({ ok: true, session_id: x.s.id }, r);
  }

  /* A daily call nobody answered gets ONE more try, half an hour later,
     only if that is still before quiet hours and still today — and the
     parent's message says exactly what will happen next, because nothing
     else will. A call that was answered but had no lesson (the child
     wasn't there, a parent said "not now") is not retried. The Bolna
     Workflow does its own retry; this is for the server's own scheduler. */
  function afterMissed(child, s, env, nowIn) {
    const now = nowIn ? new Date(nowIn) : new Date();
    const lp = C.localParts(now, env);
    const d = child.daily && Object.values(child.daily).find(e => e.session_id === s.id);
    let info = {};
    if (d && d.mode === 'direct' && s.status === 'missed' && !d.retry_at) {
      const mins = Number(env.TAKHTI_RETRY_MINUTES || 30);
      const at = new Date(now.getTime() + mins * 60e3);
      const la = C.localParts(at, env);
      if (la.day === lp.day && !C.inQuiet(la.minutes, env.TAKHTI_QUIET_HOURS)) {
        d.retry_at = at.toISOString();
        info.retry = C.fromMinutes(la.minutes);
      }
    }
    if (!info.retry && child.schedule && child.schedule.enabled) {
      const nx = C.nextCallDay(child.schedule.days, lp);
      if (nx) info.next = { day: nx, time: child.schedule.time };
    }
    s.report = missedReport(child, s, info);
  }

  /* ---------- parent calls: consent, and the weekly progress call ---------- */
  function contact(env) { return String((env || process.env).TAKHTI_HELP_CONTACT || '').slice(0, 60); }
  function childSessions(child) { return (child.sessions || []).map(id => store.get('sessions', id)).filter(Boolean); }

  function createParentSession(childId, kind, env, extra) {
    const child = store.get('children', childId);
    if (!child) return { error: ['no such child'] };
    env = envFor(child, env || process.env);
    if (kind === 'consent' && child.consent && child.consent.given) return { error: ['consent is already given'] };
    if ((kind === 'weekly' || kind === 'class') && !(child.consent && child.consent.given)) return { error: ['no consent yet'] };
    if (kind === 'class' && !(child.consent && child.consent.given)) return { error: ['no consent yet'] };
    let summary = null, facts = null;
    if (kind === 'weekly' || kind === 'class') {
      const sessions = childSessions(child);
      facts = PC.weekFacts(child, sessions);
      summary = kind === 'class' ? String((extra && extra.summary) || '')
        : PC.weekSummary(child, facts, (child.parent_lang || child.lang) === 'en' ? 'en' : 'hi');
      if (!summary) return { error: ['a class call needs its message'] };
    }
    const s = PC.planParentCall(kind, child, { contact: contact(env), quiet: env.TAKHTI_QUIET_HOURS,
                                               keypad: env.TAKHTI_KEYPAD !== '0', summary, facts });
    if (extra && extra.class_code) Object.assign(s, { class_code: extra.class_code, class_skill: extra.class_skill || null });
    store.put('parentcalls', s.id, s);
    child.parent_calls = (child.parent_calls || []).concat(s.id).slice(-60);
    if (kind === 'consent') child.consent = Object.assign({}, child.consent, { asked_at: s.created_at, last_call: s.id });
    store.put('children', child.id, child);
    return { session: s, child };
  }

  function toolParent(sessionId, said, env) {
    env = env || process.env;
    const s = sessionId && store.get('parentcalls', String(sessionId));
    const child = s && store.get('children', s.child_id);
    if (!s || !child) return { say: SORRY_PARENT, done: true, error: 'unknown session' };
    log(s, 'user', said);
    const r = PC.parentTurn(s, said, {
      core, child, env, now: new Date(),
      homework: s.kind === 'weekly' ? S.homeworkStatus(core, child, childSessions(child)) : null,
      apply: change => applyParentChange(child, change, s)
    });
    log(s, 'assistant', r.say);
    store.put('parentcalls', s.id, s);
    store.put('children', child.id, child);
    return r;
  }
  const SORRY_PARENT = 'माफ़ कीजिए, अभी यह कॉल ठीक से नहीं खुल रही। हम बाद में फिर फ़ोन करेंगे। ' +
                       "Sorry, I can't open this call properly right now. We'll call another time. Goodbye!";

  /* ---------- teacher voice notes ---------- */
  function toolNote(sessionId, said) {
    const s = sessionId && store.get('teachercalls', String(sessionId));
    const t = s && store.get('teachers', s.teacher_id);
    if (!s || !t) return { say: SORRY_PARENT, done: true, error: 'unknown session' };
    log(s, 'user', said);
    const r = NT.noteTurn(s, said, {
      teacher: t, kids: classChildren(t),
      skillName: id => { const sk = core.T.skillById(id); return sk ? (s.lang === 'hi' ? sk.hi : sk.en.toLowerCase()) : ''; },
      save: note => saveTeacherNote(t, s, note)
    });
    log(s, 'assistant', r.say);
    store.put('teachercalls', s.id, s);
    return r;
  }
  /* A teacher's observation is evidence: one observed attempt on that
     skill, in the same skill history the diagnosis reads, mirrored to the
     class. A difficulty also becomes what the next calls practise (for a
     sum Munni can ask out loud, or the letters in the reading lines). */
  function saveTeacherNote(teacher, call, note) {
    const child = store.get('children', note.child_id);
    if (!child) return {};
    const id = 'note_' + newId();
    core.withChild(child.profile, { lang: child.lang }, T => {
      if (T.skillById(note.skill)) T.noteSkillAttempt(note.skill, note.ok, T.S);
      T.mirrorToClassNow(T.S);
    });
    const at = new Date();
    child.teacher_notes = (child.teacher_notes || []).concat({ id, by: teacher.name, teacher_id: teacher.id, call: call.id,
      skill: note.skill, ok: note.ok, letters: note.letters, text: note.text, at: at.toISOString() }).slice(-100);
    let focus = false;
    if (note.ok === false) {
      const until = new Date(at.getTime() + 7 * 864e5).toISOString();
      if (S.skillSpoken(core, child, note.skill)) { child.focus = { skill: note.skill, until, source: 'teacher note', note: id }; focus = true; }
      if (note.letters && child.lang === 'hi' === note.letters.some(l => /[ऀ-ॿ]/.test(l))) { child.focus_letters = { letters: note.letters, until, note: id }; focus = true; }
    }
    store.put('children', child.id, child);
    return { note_id: id, focus };
  }
  function onTeacherCallEnd(s, payload) {
    const status = String(payload.status || '').toLowerCase();
    s.call = Object.assign(s.call || {}, { execution_id: payload.id, status,
      duration_s: Number(payload.conversation_duration || (payload.telephony_data || {}).duration || 0) });
    s.transcript = String(payload.transcript || '');
    s.processed = true; s.status = s.notes.length ? 'done' : 'no_notes';
    // a saved note is "heard" if the child's name is in the teacher's own
    // words in Bolna's transcript, as the recognizer wrote them
    const said = s.transcript.split(/\r?\n/).filter(l => /^\s*(user|human|caller)\s*:/i.test(l)).join(' ').split(/\s+/);
    for (const n of s.notes) n.heard_in_transcript = n.child_name.split(/\s+/).some(p => said.some(w => soundsLike(p, w.replace(/[.,!?।]/g, ''))));
    store.put('teachercalls', s.id, s);
    return { ok: true, session_id: s.id, type: 'teacher', notes: s.notes.length };
  }

  /* ---------- class-wide parent calls ----------
     A teacher picks a class (and a skill, or lets Takhti find the gap the
     class shares) and every parent who agreed to calls hears the same
     message — plus where their own child stands on it, and one thing to
     do at home. Never in quiet hours, never twice a day per family. */
  const sameCode = (a, b) => String(a || '').toUpperCase() === String(b || '').toUpperCase();
  function classRoster(code, schoolId, superScope) {
    return store.list('children').filter(c => c.kind !== 'app' && c.profile && sameCode(c.profile.classCode, code) &&
      (superScope || c.school_id === schoolId));
  }
  function standingOn(child, skill) {
    const h = (child.profile.skillHistory || {})[skill];
    if (!h || h.n < 4) return 'unseen';
    return h.right / h.n >= 0.8 ? 'solid' : 'working';
  }
  /* skills two or more children in the class are below 60% on (four or
     more attempts each) — the same bar as the app's diagnosis */
  function sharedGaps(kids) {
    const count = {};
    for (const c of kids) for (const [id, h] of Object.entries(c.profile.skillHistory || {})) {
      if (h.n >= 4 && h.right / h.n < 0.6) (count[id] = count[id] || []).push(c.id);
    }
    return Object.entries(count).filter(([, ids]) => ids.length >= 2).map(([id, ids]) => {
      const sk = core.T.skillById(id);
      return { skill: id, en: sk ? sk.en : id, hi: sk ? sk.hi : id, children: ids.length };
    }).sort((a, b) => b.children - a.children);
  }
  function classSummary(code, schoolId, superScope) {
    const kids = classRoster(code, schoolId, superScope);
    return { code: String(code).toUpperCase(), gaps: sharedGaps(kids),
             children: kids.map(c => ({ id: c.id, name: c.name, consent: (c.consent && c.consent.status) || 'none', phone: !!c.parent_phone })) };
  }
  async function classParentCalls(code, o, env, scope) {
    env = env || process.env;
    o = o || {};
    scope = scope || { super: true };
    const kids = classRoster(code, scope.school && scope.school.id, scope.super);
    if (!kids.length) return { error: 'no children in that class' };
    const skill = o.skill || (sharedGaps(kids)[0] || {}).skill;
    const sk = skill && core.T.skillById(skill);
    if (!sk) return { error: 'choose a skill: Takhti found no gap the class shares yet' };
    const now = C.localParts(new Date(), env);
    if (C.inQuiet(now.minutes, env.TAKHTI_QUIET_HOURS)) return { error: 'quiet hours: families are not called now' };
    const placed = [], skipped = [];
    for (const kid of kids) {
      if (!kid.consent || !kid.consent.given) { skipped.push({ child: kid.name, why: 'no consent' }); continue; }
      if (!kid.parent_phone) { skipped.push({ child: kid.name, why: 'no phone' }); continue; }
      const today = (kid.parent_calls || []).map(id => store.get('parentcalls', id))
        .some(pc => pc && pc.kind === 'class' && C.localParts(pc.created_at, env).day === now.day);
      if (today) { skipped.push({ child: kid.name, why: 'already called today' }); continue; }
      const lang = (kid.parent_lang || kid.lang) === 'en' ? 'en' : 'hi';
      const promise = S.skillSpoken(core, kid, skill);
      const summary = PC.classMessage(kid, skill, { skillName: lang === 'hi' ? sk.hi : sk.en.toLowerCase(), teacher: o.teacher || '',
        note: o.note || '', standing: standingOn(kid, skill), promise }, lang);
      const r = await placeParentCall(kid.id, 'class', env, { summary, class_code: String(code).toUpperCase(), class_skill: skill });
      if (r.error) { skipped.push({ child: kid.name, why: r.error }); continue; }
      if (promise) {
        const c = store.get('children', kid.id);
        c.focus = { skill, until: new Date(Date.now() + 7 * 864e5).toISOString(), source: 'class call', call: r.session_id };
        store.put('children', c.id, c);
      }
      placed.push({ child: kid.name, session_id: r.session_id });
    }
    return { ok: true, skill, placed, skipped };
  }

  /* what a parent asked for on the weekly call, done at once */
  function applyParentChange(child, c, s) {
    const at = new Date().toISOString();
    if (c.weekly_enabled === false) child.weekly = Object.assign({}, child.weekly, { enabled: false, changed_at: at, changed_by: 'parent (weekly call)' });
    if (c.lessons_enabled === false && child.schedule) child.schedule = Object.assign({}, child.schedule, { enabled: false, changed_at: at, changed_by: 'parent (weekly call)' });
    if (c.english_practice === true) child.english_practice = true;
    if (c.time) {
      if (child.schedule) child.schedule = Object.assign({}, child.schedule, { time: c.time, days: c.days || child.schedule.days, changed_at: at, changed_by: 'parent (weekly call)' });
      else child.requested_time = c.time;          // no schedule yet: the team sees what they asked for
    }
    (child.changes = child.changes || []).push({ at, call: s.id, change: c });
    child.changes = child.changes.slice(-50);
  }

  function onParentCallEnd(s, payload, env) {
    const child = store.get('children', s.child_id);
    if (!child) return { ok: false, reason: 'no child for this call' };
    const r = PC.processParentEnd(child, s, payload);
    if (r.changed && s.kind === 'consent' && s.consent) applyConsent(child, s, s.consent);
    if (r.changed && s.kind === 'weekly') child.weekly_last = { call: s.id, status: s.status, at: new Date().toISOString() };
    store.put('parentcalls', s.id, s);
    store.put('children', child.id, child);
    return Object.assign({ ok: true, session_id: s.id, type: 'parent' }, r);
  }

  /* The consent record: who agreed, how, when, to which notice, on which
     call — and the schedule they chose. needs_review keeps every answer
     for a person to check; it never starts a lesson by itself. */
  function applyConsent(child, s, c, reviewedBy) {
    const at = new Date().toISOString();
    if (c.status === 'given') {
      child.consent = { given: true, status: 'given', method: reviewedBy ? 'call (reviewed)' : 'call', by: 'parent (phone)',
                        reviewed_by: reviewedBy || null, at, call: { session_id: s.id, execution_id: (s.call && s.call.execution_id) || null },
                        recording: c.terms.recording, research: !!c.terms.research, notice: s.notice };
      child.schedule = { enabled: true, time: c.terms.time, days: c.terms.days, set_by: 'parent (consent call)', changed_at: at };
      const wt = C.toMinutes(c.terms.time) >= 16 * 60 && C.toMinutes(c.terms.time) <= 20 * 60 ? c.terms.time : '18:00';
      child.weekly = { enabled: c.terms.weekly, day: 7, time: wt, set_by: 'parent (consent call)' };
    } else if (c.status === 'needs_review') {
      child.consent = { given: false, status: 'needs_review', method: 'call', why: c.why, call: { session_id: s.id }, at };
    } else if (c.status === 'refused') {
      child.consent = { given: false, status: 'refused', method: 'call', call: { session_id: s.id }, at };
    } else {
      child.consent = Object.assign({}, child.consent, { given: false, status: 'pending', last_result: c.why, last_call: s.id });
    }
  }
  /* A person listened to a consent call the transcript check couldn't
     settle, and heard a clear yes. */
  function confirmConsent(childId, by) {
    const child = store.get('children', childId);
    if (!child || !child.consent || child.consent.status !== 'needs_review') return { ok: false, why: 'nothing to review' };
    const s = store.get('parentcalls', child.consent.call.session_id);
    if (!s || !s.consent || !s.consent.terms) return { ok: false, why: 'no call to review' };
    applyConsent(child, s, { status: 'given', terms: s.consent.terms }, String(by || 'team').slice(0, 60));
    store.put('children', child.id, child);
    return { ok: true, consent: child.consent };
  }

  /* The lesson schedule and the weekly call, set by the team for a family
     that agreed in person (a consent call sets them itself). */
  function setSchedule(childId, o) {
    const child = store.get('children', childId);
    if (!child) return { error: ['no such child'] };
    const time = o.time != null ? C.parseClock(o.time) || (/^\d{2}:\d{2}$/.test(o.time) ? o.time : null) : (child.schedule && child.schedule.time) || '17:00';
    const days = Array.isArray(o.days) ? o.days.map(Number).filter(d => d >= 1 && d <= 7) : C.DAYS[o.days] || (child.schedule && child.schedule.days) || C.DAYS.alternate;
    if (!time) return { error: ['time must look like 17:30'] };
    if (C.inQuiet(C.toMinutes(time), process.env.TAKHTI_QUIET_HOURS)) return { error: ['that time is inside quiet hours'] };
    child.schedule = { enabled: o.enabled !== false && o.enabled !== 'no', time, days, set_by: String(o.by || 'team').slice(0, 60), changed_at: new Date().toISOString() };
    if (o.weekly != null) child.weekly = Object.assign({ day: 7, time: '18:00' }, child.weekly, { enabled: o.weekly === true || o.weekly === 'yes' });
    store.put('children', child.id, child);
    return { schedule: child.schedule, weekly: child.weekly || null };
  }

  async function bolnaCall(env, agentId, phone, userData) {
    const body = { agent_id: agentId, recipient_phone_number: phone, user_data: userData };
    if (env.BOLNA_FROM_NUMBER) body.from_phone_number = env.BOLNA_FROM_NUMBER;
    const res = await fetch((env.BOLNA_API_BASE || 'https://api.bolna.ai') + '/call', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.BOLNA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(e => ({ ok: false, status: 502, json: async () => ({ error: String(e.message || e) }) }));
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, execution_id: data.execution_id } : { error: `Bolna said ${res.status}`, detail: data };
  }

  /* A parent call through Munni's parent agent (agent/build-parent-agent.js). */
  async function placeParentCall(childId, kind, env, extra) {
    env = envFor(store.get('children', childId), env || process.env);
    if (!env.BOLNA_API_KEY || !env.BOLNA_PARENT_AGENT_ID) return { error: 'set BOLNA_API_KEY and BOLNA_PARENT_AGENT_ID' };
    const r = createParentSession(childId, kind, env, extra);
    if (r.error) return { error: r.error.join('; ') };
    const s = r.session;
    const out = await bolnaCall(env, env.BOLNA_PARENT_AGENT_ID, r.child.parent_phone, {
      session_id: s.id, child_name: r.child.name, lesson_language: s.lang === 'hi' ? 'Hindi' : 'English', greeting: s.greeting, call_kind: kind
    });
    if (out.ok) { s.call = { execution_id: out.execution_id, queued_at: new Date().toISOString() }; s.status = 'calling'; store.put('parentcalls', s.id, s); }
    return Object.assign({ session_id: s.id }, out);
  }

  /* One family through a published Bolna Workflow (agent/build-workflow.js):
     the workflow calls back into /voice/flow/* for everything it needs. */
  async function runWorkflow(workflowId, child, reference, env) {
    env = envFor(child, env || process.env);
    if (!env.BOLNA_API_KEY) return { error: 'set BOLNA_API_KEY' };
    const res = await fetch((env.BOLNA_API_BASE || 'https://api.bolna.ai') + `/workflows/${encodeURIComponent(workflowId)}/run`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.BOLNA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_id: reference, mobile_number: child.parent_phone, name: child.name, child_id: child.id })
    }).catch(e => ({ ok: false, status: 502, json: async () => ({ error: String(e.message || e) }) }));
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, execution: data.id || data.execution_id || null } : { error: `Bolna said ${res.status}`, detail: data };
  }

  /* The consent call: through the consent workflow when there is one (it
     also sends the written copy on WhatsApp), else a direct call. */
  async function requestConsentCall(childId, env) {
    const child = store.get('children', childId);
    if (!child) return { error: 'no such child' };
    env = envFor(child, env || process.env);
    if (child.consent && child.consent.given) return { error: 'consent is already given' };
    if (env.BOLNA_CONSENT_WORKFLOW_ID) return runWorkflow(env.BOLNA_CONSENT_WORKFLOW_ID, child, `${child.id}_consent_${Date.now()}`, env);
    return placeParentCall(childId, 'consent', env);
  }

  /* ---------- placing a call through Bolna ---------- */
  async function placeCall(sessionId, env) {
    env = env || process.env;
    const x = load(sessionId);
    if (!x) return { error: 'no such session' };
    if (!x.child.consent || !x.child.consent.given) return { error: 'no parent consent' };
    env = envFor(x.child, env);
    if (!env.BOLNA_API_KEY || !env.BOLNA_AGENT_ID) return { error: 'set BOLNA_API_KEY and BOLNA_AGENT_ID' };
    const body = {
      agent_id: env.BOLNA_AGENT_ID,
      recipient_phone_number: x.child.parent_phone,
      // the minimum Bolna needs: no age, no surname, no phone in the prompt
      user_data: { session_id: x.s.id, child_name: x.child.name, lesson_language: x.s.lang === 'hi' ? 'Hindi' : 'English',
                   greeting: greeting(x.child, x.s.lang), registered: true, allowed: true, caller_kind: 'child' }
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
    createParentSession, toolParent, placeParentCall, requestConsentCall, confirmConsent, setSchedule,
    runWorkflow, childSessions,
    toolNote, saveTeacherNote, classParentCalls, classSummary, sharedGaps,
    getTeacherCall: id => store.get('teachercalls', id), listTeacherCalls: () => store.list('teachercalls'),
    createSchool, updateSchool, schoolByKey, publicSchool, envFor, registerTeacher, classChildren,
    getSchool: id => store.get('schools', id), listSchools: () => store.list('schools'),
    getTeacher: id => store.get('teachers', id), listTeachers: () => store.list('teachers'),
    getParentCall: id => store.get('parentcalls', id),
    listParentCalls: () => store.list('parentcalls'),
    getChild: id => store.get('children', id),
    getSession: id => store.get('sessions', id),
    listChildren: () => store.list('children'),
    listSessions: () => store.list('sessions')
  };
}

module.exports = { createBrain };
