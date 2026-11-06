/* ==================================================================
   THE DAILY SEQUENCE — what a Bolna Workflow asks this server

   agent/build-workflow.js writes two Bolna Workflows. Each one runs per
   family and calls back here for every decision, so the workflow is only
   plumbing (calls, WhatsApp, waits, retries) and the rules stay in one
   place, tested:

   daily     plan → WhatsApp the reading card → wait → gate → call the
             child → wait → result → WhatsApp the parent three lines;
             nobody answered → retry once (through the gate) → missed →
             WhatsApp the parent what happens next
   consent   plan → call the parent (parent agent) → wait → result →
             WhatsApp a written copy of what they agreed

   All endpoints: POST, JSON, Bearer TAKHTI_TOOL_TOKEN.
     /voice/flow/plan            { child_id, reference_id } → { go, session_id, … }
     /voice/flow/gate            { session_id }             → { go, why }
     /voice/flow/result          { session_id }             → { ready, l1, l2, l3, report_url, lang }
     /voice/flow/missed          { session_id }             → { send, l1, lang }
     /voice/flow/consent/plan    { child_id }               → { go, session_id, greeting, … }
     /voice/flow/consent/result  { session_id }             → { ready, given, l1, l2, lang }

   Every answer is safe to ask twice (a workflow's API node may be
   retried): the same reference gets the same session.
   ================================================================== */
'use strict';
const C = require('./clock');
const { contactHow } = require('./parent');

// a WhatsApp template variable can't hold a line break or a long run of
// spaces (Meta rejects the message), and is capped in length
const one = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 900) || '—';

function createFlow(brain, envIn) {
  const env = envIn || process.env;
  const store = brain.store;
  const base = () => (env.TAKHTI_PUBLIC_URL || '').replace(/\/$/, '');
  const langWord = l => (l === 'hi' ? 'Hindi' : 'English');

  function plan(b) {
    const child = brain.getChild(String(b.child_id || ''));
    if (!child) return { go: false, why: 'no such child' };
    if (!child.consent || !child.consent.given) return { go: false, why: 'no consent' };
    const now = C.localParts(new Date(), env);
    child.daily = child.daily || {};
    let entry = child.daily[now.day];
    if (entry && entry.session_id && (!b.reference_id || entry.reference === b.reference_id || entry.mode === 'workflow')) {
      const s = brain.getSession(entry.session_id);
      if (s && !s.started_at) return answerPlan(child, s);
      if (s) return { go: false, why: 'today\'s lesson already happened' };
    }
    if (child.schedule && child.schedule.enabled === false) return { go: false, why: 'lessons are paused' };
    const r = brain.createSession(child.id, { kind: brain.nextKind(child) });
    if (r.error) return { go: false, why: r.error.join('; ') };
    const fresh = brain.getChild(child.id);
    fresh.daily = Object.assign(fresh.daily || {}, { [now.day]: Object.assign({}, entry, { mode: 'workflow', session_id: r.session.id, reference: b.reference_id || null, at: new Date().toISOString() }) });
    trimDaily(fresh);
    store.put('children', fresh.id, fresh);
    return answerPlan(fresh, r.session);
  }
  function answerPlan(child, s) {
    return { go: true, session_id: s.id, child_name: child.name, lang: s.lang, lesson_language: langWord(s.lang),
             greeting: brain.greeting(child, s.lang), card_url: `${base()}/voice/card/${s.id}` };
  }

  /* Just before dialling (and before the retry): still a good moment? */
  function gate(b) {
    const pc = brain.getParentCall(String(b.session_id || ''));
    if (pc) {
      // a parent call: polite hours, and only once
      if (C.inQuiet(C.localParts(new Date(), env).minutes, env.TAKHTI_QUIET_HOURS)) return { go: false, why: 'quiet hours' };
      if (pc.started_at || pc.processed && pc.status === 'done') return { go: false, why: 'already happened' };
      return { go: true };
    }
    const s = brain.getSession(String(b.session_id || ''));
    const child = s && brain.getChild(s.child_id);
    if (!s || !child) return { go: false, why: 'no such session' };
    const now = C.localParts(new Date(), env);
    if (!child.consent || !child.consent.given) return { go: false, why: 'no consent' };
    if (child.schedule && child.schedule.enabled === false) return { go: false, why: 'lessons are paused' };
    if (C.inQuiet(now.minutes, env.TAKHTI_QUIET_HOURS)) return { go: false, why: 'quiet hours' };
    if (s.started_at || s.status === 'done') return { go: false, why: 'already happened' };
    if (C.localParts(s.created_at, env).day !== now.day) return { go: false, why: 'not today\'s lesson' };
    return { go: true };
  }

  function result(b) {
    const s = brain.getSession(String(b.session_id || ''));
    const child = s && brain.getChild(s.child_id);
    if (!s || !child) return { ready: false, why: 'no such session' };
    if (!s.processed || !s.report) return { ready: false };
    const sh = s.report.short || [s.report.text];
    return { ready: true, lang: s.lang, child_name: child.name, l1: one(sh[0]), l2: one(sh[1]), l3: one(sh[2]),
             report_url: `${base()}/voice/report/${s.id}`, status: s.status };
  }

  /* The retry is spent (or the gate said no): what does the parent hear? */
  function missed(b) {
    const s = brain.getSession(String(b.session_id || ''));
    const child = s && brain.getChild(s.child_id);
    if (!s || !child) return { send: false, why: 'no such session' };
    if (s.status === 'done') return { send: false, why: 'the lesson happened' };
    if (s.missed_sent) return { send: false, why: 'already sent' };
    s.missed_sent = new Date().toISOString();
    if (!s.processed && !s.started_at) s.status = 'missed';
    const lp = C.localParts(new Date(), env);
    const nx = child.schedule && child.schedule.enabled ? C.nextCallDay(child.schedule.days, lp) : null;
    const rep = require('./report').missedReport(child, s, nx ? { next: { day: nx, time: child.schedule.time } } : {});
    s.report = s.report && !s.report.missed ? s.report : rep;
    store.put('sessions', s.id, s);
    return { send: true, lang: s.lang, child_name: child.name, l1: one(rep.text) };
  }

  /* ---------- the consent workflow ---------- */
  function consentPlan(b) {
    const child = brain.getChild(String(b.child_id || ''));
    if (!child) return { go: false, why: 'no such child' };
    if (child.consent && child.consent.given) return { go: false, why: 'consent is already given' };
    const r = brain.createParentSession(child.id, 'consent', env);
    if (r.error) return { go: false, why: r.error.join('; ') };
    return { go: true, session_id: r.session.id, child_name: child.name, lang: r.session.lang,
             lesson_language: langWord(r.session.lang), greeting: r.session.greeting, call_kind: 'consent' };
  }
  function consentResult(b) {
    const s = brain.getParentCall(String(b.session_id || ''));
    const child = s && brain.getChild(s.child_id);
    if (!s || !child) return { ready: false, why: 'no such session' };
    if (!s.processed) return { ready: false };
    const given = !!(child.consent && child.consent.given && child.consent.call && child.consent.call.session_id === s.id);
    if (!given) return { ready: true, given: false, status: (child.consent && child.consent.status) || 'pending', lang: s.lang };
    const lang = s.lang, sch = child.schedule;
    const n = child.name;
    // the written copy of what they agreed to, in their language
    const l1 = lang === 'hi'
      ? `आपने ${dateSay(child.consent.at, lang)} को हाँ कहा कि मुन्नी ${C.daysSay(sch.days, lang)} ${C.clockSay(sch.time, lang)} ${n} को अभ्यास के लिए फ़ोन करे${child.consent.recording ? ', और कॉल रिकॉर्ड हों' : ', बिना रिकॉर्डिंग के'}${child.consent.research ? '; और तख़्ती को बेहतर बनाने के लिए पढ़े हुए शब्द (बिना नाम) इस्तेमाल हों' : ''}।`
      : `On ${dateSay(child.consent.at, lang)} you agreed that Munni may call ${n} ${C.daysSay(sch.days, lang)} at ${C.clockSay(sch.time, lang)} for practice${child.consent.recording ? ', with the calls recorded' : ', without recording'}${child.consent.research ? ', and that the words read (without the name) may be used to improve Takhti' : ''}.`;
    const l2 = lang === 'hi'
      ? `हम ${n} का पहला नाम, उम्र, यह नंबर और जवाब रखते हैं, किसी को बेचते या देते नहीं। रोकने या सब मिटवाने के लिए ${contactHow(lang, env.TAKHTI_HELP_CONTACT)}।`
      : `We keep ${n}'s first name, age, this number and the answers, and never sell or share them. To stop or delete everything, ${contactHow(lang, env.TAKHTI_HELP_CONTACT)}.`;
    return { ready: true, given: true, lang, child_name: n, l1: one(l1), l2: one(l2) };
  }
  function dateSay(iso, lang) {
    return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: env.TAKHTI_TZ || 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  }

  function trimDaily(child) {
    const days = Object.keys(child.daily || {}).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 30))) delete child.daily[d];
  }

  return { plan, gate, result, missed, consentPlan, consentResult, trimDaily };
}

module.exports = { createFlow };
