#!/usr/bin/env node
/* ==================================================================
   PARENT CALLS AND THE DAILY SEQUENCE — run with: node test/voice-parent.test.js

   The consent call (and the transcript check that settles it), the
   weekly progress call (and the changes a parent can make on it), the
   scheduler (lesson days, one retry, the weekly call — and every time it
   must NOT call), and the Bolna Workflow endpoints and definitions, all
   against the real engine and a stand-in Bolna on localhost.
   ================================================================== */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const C = require('../voice/clock');
const PC = require('../voice/parent');
const { createBrain } = require('../voice/brain');
const { createScheduler } = require('../voice/schedule');
const { createFlow } = require('../voice/flow');
const { createServer } = require('../voice/server');
const WF = require('../voice/agent/build-workflow');
const PA = require('../voice/agent/build-parent-agent');

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push('  ok    ' + name); }
  catch (e) { fail++; results.push('  FAIL  ' + name + '\n        ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-parent-test-'));
let phoneN = 0;
const phone = () => '+9198000' + String(10000 + (phoneN++)).padStart(5, '0');

/* a stand-in Bolna: records every call and workflow run */
async function fakeBolna() {
  const calls = [], runs = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const body = b ? JSON.parse(b) : {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url === '/call') { calls.push(body); return res.end(JSON.stringify({ execution_id: 'ex-' + calls.length, status: 'queued' })); }
      const m = req.url.match(/^\/workflows\/([^/]+)\/run$/);
      if (m) { runs.push({ id: m[1], body }); return res.end(JSON.stringify({ id: 'wfx-' + runs.length })); }
      res.end('{}');
    });
  });
  await new Promise(r => srv.listen(0, r));
  return { calls, runs, base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}

/* talk through a parent call; returns every line Munni said */
function talk(brain, id, replies) {
  const says = [];
  for (const r of replies) { const out = brain.toolParent(id, r); says.push(out.say); if (out.done) break; }
  return says;
}
/* the webhook Bolna sends after a call, with a transcript of what was said —
   optionally with the parent's words changed, as a recognizer heard them */
function hangUp(brain, id, o) {
  o = o || {};
  const s = brain.getParentCall(id) || brain.getSession(id);
  let turns = (s.live_turns || []).map(t => ({ ...t }));
  if (o.edit) turns = turns.map(t => t.role === 'user' && o.edit[t.text] != null ? { ...t, text: o.edit[t.text] } : t);
  const greeting = s.greeting ? 'assistant: ' + s.greeting + '\n' : '';
  const transcript = o.noTranscript ? '' : greeting + turns.map(t => `${t.role}: ${t.text}`).join('\n');
  return brain.onCallEvent({ id: o.exec || 'ex-' + id, status: o.status || 'completed', transcript,
    conversation_duration: o.duration != null ? o.duration : 140, telephony_data: {},
    context_details: { recipient_data: { session_id: id } } }, o.env, o.now);
}
/* a whole lesson with a scripted child, then the webhook */
function lesson(brain, childId, wrongEvery) {
  const { session } = brain.createSession(childId);
  let r = brain.toolNext(session.id), i = 0;
  while (!r.done && i++ < 80) {
    const s = brain.getSession(session.id);
    const it = s.items[s.items.length - 1];
    const right = it.expect === 'yesno' ? (it.answer ? 'yes' : 'no') : it.expect === 'number' ? String(it.answer) : it.target;
    const wrong = it.expect === 'number' ? String(it.answer + 1) : it.expect === 'yesno' ? (it.answer ? 'no' : 'yes') : 'hmm';
    r = brain.toolAnswer(session.id, wrongEvery && it.n % wrongEvery === 0 && it.attempts === 0 ? wrong : right);
  }
  hangUp(brain, session.id);
  return brain.getSession(session.id);
}
// 2027-01-04 is a Monday; 17:00 in Kolkata is 11:30 UTC
const IST = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:30`);

(async () => {

/* ---------------- hearing and saying times ---------------- */
await test('clock: times parents say (Hindi, Hinglish, English) and how Munni says them back', () => {
  const table = [
    ['शाम साढ़े पाँच बजे', '17:30'], ['paanch baje', '17:00'], ['5:30', '17:30'], ['sawa chhe', '18:15'], ['raat 8 baje', '20:00'],
    ['6 pm', '18:00'], ['dhai baje', '14:30'], ['sadhe chaar baje', '16:30'], ['17:00', '17:00'], ['subah 9 baje', '09:00'],
    ['quarter to 6', '17:45'], ['पौने छह बजे', '17:45'], ['can you call at 6 pm instead', '18:00'], ['call me at five thirty', '17:30'],
    ['time 6 baje kar do', '18:00'], ['5 baje 20 minute', '17:20'], ['koi bhi time', null], ['you decide', null]
  ];
  for (const [said, want] of table) assert.strictEqual(C.parseClock(said), want, said);
  assert.strictEqual(C.parseClock('do din mein ek baar', { needMarker: true }), null, '"do din" is not 2 o\'clock');
  assert.strictEqual(C.daysOf('ek din chhod ke'), 'alternate');
  assert.strictEqual(C.daysOf('रोज़'), 'daily');
  assert.strictEqual(C.daysOf('every day please'), 'daily');
  assert.strictEqual(C.clockSay('17:30', 'hi'), 'शाम साढ़े पाँच बजे');
  assert.strictEqual(C.clockSay('18:45', 'hi'), 'शाम पौने सात बजे');
  assert.strictEqual(C.clockSay('14:30', 'hi'), 'दोपहर ढाई बजे');
  assert.strictEqual(C.clockSay('17:30', 'en'), '5:30 in the evening');
  const sun = C.localParts(IST('2027-01-03', '12:00'));
  assert.strictEqual(sun.weekday, 7);
  assert.strictEqual(C.whenSay(C.nextCallDay([1, 3, 5], sun), '17:00', 'hi'), 'कल शाम पाँच बजे');
  assert.strictEqual(C.whenSay(C.nextCallDay([3], sun), '17:00', 'en'), 'on Wednesday at 5 in the evening');
  assert.ok(C.inQuiet(21 * 60 + 30, '21-7') && C.inQuiet(6 * 60, '21-7') && !C.inQuiet(17 * 60, '21-7'));
});

await test('yes/no for consent is strict: a muddle is not a yes, keys 1/2 work', () => {
  const t = [['haan ji', true], ['yes okay', true], ['ठीक है', true], ['बिल्कुल', true], ['nahi', false], ['no thanks', false],
             ['नहीं, कोई दिक्कत नहीं', null], ['haan nahi', null], ['main Riya hoon', null], ['', null], ['dtmf_number: 1', true], ['dtmf_number: 2', false]];
  for (const [said, want] of t) assert.strictEqual(PC.strictYesNo(said), want, said);
});

await test('parent questions are understood in Hindi, Hinglish and English', () => {
  const t = [['is she behind?', 'behind'], ['kya wo peeche hai', 'behind'], ['पढ़ाई कैसी चल रही है', 'behind'], ['ghar par kya karayein', 'practise'],
             ['what should we do at home', 'practise'], ['reading kaisi hai', 'behind'], ['tell me about reading', 'reading'], ['गणित', 'maths'],
             ['angrezi ke baare mein', 'english'], ['homework ka kya', 'homework'], ['6 baje kar do', 'time'], ['call at 6 pm', 'time'],
             ['band karo ye call', 'stopWeekly'], ['stop the lessons', 'stopLessons'], ['पाठ बंद करो', 'stopLessons'], ['recording kaun sunta hai', 'privacy'],
             ['bas, dhanyavad', 'bye'], ['nahi', 'bye'], ['phir se bolo', 'repeat'], ['mausam kaisa hai', 'behind'], ['blue sky', 'unknown']];
  for (const [said, want] of t) assert.strictEqual(PC.parentIntent(said), want, said);
});

await test('every parent line exists in Hindi and English and never says "wrong"', () => {
  for (const [k, v] of Object.entries(PC.L)) {
    assert.ok(typeof v.hi === 'function' && typeof v.en === 'function', k);
    const a = Array.from({ length: 6 }, () => 'X');
    const en = v.en(...a), hi = v.hi(...a);
    assert.ok(en && hi && en !== hi, k);
    assert.ok(/[ऀ-ॿ]/.test(hi), k + ': Hindi line has no Devanagari');
    assert.ok(!/\b(wrong|fail|failed|bad)\b/i.test(en) && !/गलत|ग़लत|फ़ेल/.test(hi), k);
  }
});

/* ---------------- the consent call ---------------- */
const brain = createBrain({ dataDir: tmp() });

await test('consent call (Hindi): nobody calls the child before it; afterwards the transcript settles consent and the schedule', () => {
  const c = brain.registerChild({ name: 'Riya', age: 7, lang: 'hi', parent_phone: phone(), consent: 'call' }).child;
  assert.ok(brain.createSession(c.id).error, 'a lesson was planned before consent');
  assert.strictEqual(brain.inboundLookup({ contact_number: c.parent_phone }, { TAKHTI_QUIET_HOURS: '0-0' }).allowed, false, 'inbound line open before consent');
  const { session } = brain.createParentSession(c.id, 'consent');
  assert.ok(/माता-पिता या अभिभावक/.test(session.greeting));
  const says = talk(brain, session.id, ['haan ji', 'haan', 'nahi', 'haan', 'shaam saadhe paanch baje', 'ek din chhod ke', 'haan']);
  assert.ok(/Bolna/.test(says[0]) && /पहला नाम, उम्र, यह फ़ोन नंबर/.test(says[0]) && /मिटवाने/.test(says[0]), 'notice incomplete: ' + says[0]);
  assert.ok(/1.*2/.test(says[0]), 'keypad not offered');
  assert.ok(/बेहतर बनाने/.test(says[2]) && /नाम या आवाज़ कभी नहीं/.test(says[2]), 'the improving-Takhti question is missing');
  assert.ok(/शाम साढ़े पाँच बजे/.test(says[4]), 'time not said back');
  assert.ok(/सोमवार, बुधवार और शुक्रवार को शाम साढ़े पाँच बजे/.test(says[6]), says[6]);
  // the call is over, but nothing is given until the transcript agrees
  assert.strictEqual(brain.getChild(c.id).consent.given, false);
  const r = hangUp(brain, session.id);
  assert.strictEqual(r.consent.status, 'given');
  const k = brain.getChild(c.id);
  assert.ok(k.consent.given && k.consent.method === 'call' && k.consent.notice === PC.NOTICE_VERSION && k.consent.call.execution_id);
  assert.strictEqual(k.consent.recording, false, 'they said no to recording');
  assert.strictEqual(k.consent.research, true, 'they said yes to improving Takhti');
  assert.deepStrictEqual([k.schedule.time, k.schedule.days, k.schedule.enabled], ['17:30', [1, 3, 5], true]);
  assert.ok(k.weekly.enabled && k.weekly.day === 7);
  assert.ok(!brain.createSession(c.id).error, 'lesson still blocked after consent');
  assert.strictEqual(brain.inboundLookup({ contact_number: c.parent_phone }, { TAKHTI_QUIET_HOURS: '0-0' }).allowed, true);
});

await test('consent: the relay said "haan" but the recognizer heard "nahi" → a person reviews; nothing starts until they do', () => {
  const c = brain.registerChild({ name: 'Aman', age: 6, lang: 'hi', parent_phone: phone(), consent: 'call' }).child;
  const { session } = brain.createParentSession(c.id, 'consent');
  talk(brain, session.id, ['haan', 'haan bilkul', 'haan', 'nahi', '5 baje', 'roz', 'nahi']);
  const r = hangUp(brain, session.id, { edit: { 'haan bilkul': 'nahi' } });
  assert.strictEqual(r.consent.status, 'needs_review');
  assert.ok(/disagree/.test(r.consent.why));
  const k = brain.getChild(c.id);
  assert.strictEqual(k.consent.given, false);
  assert.ok(brain.createSession(c.id).error);
  // a person listens and hears a clear yes
  const ok = brain.confirmConsent(c.id, 'Asha (team)');
  assert.ok(ok.ok && ok.consent.given && ok.consent.method === 'call (reviewed)' && ok.consent.reviewed_by === 'Asha (team)');
  assert.deepStrictEqual(brain.getChild(c.id).schedule.days, C.DAYS.daily);
  assert.strictEqual(brain.getChild(c.id).consent.recording, true);
  assert.ok(!brain.confirmConsent(c.id).ok, 'reviewed twice');
});

await test('consent: no transcript at all → review, never given', () => {
  const c = brain.registerChild({ name: 'Zoya', age: 8, lang: 'en', parent_phone: phone(), consent: 'call' }).child;
  const { session } = brain.createParentSession(c.id, 'consent');
  talk(brain, session.id, ['yes', 'yes', 'yes', 'yes', '6 pm', 'every day', 'no']);
  const r = hangUp(brain, session.id, { noTranscript: true });
  assert.strictEqual(r.consent.status, 'needs_review');
  assert.strictEqual(brain.getChild(c.id).consent.given, false);
});

await test('consent: a "no" is respected — refused, no lessons, the inbound line treats the number as unregistered', () => {
  const c = brain.registerChild({ name: 'Kabir', age: 9, lang: 'en', parent_phone: phone(), consent: 'call' }).child;
  const { session } = brain.createParentSession(c.id, 'consent');
  const says = talk(brain, session.id, ['yes', 'no, not now']);
  assert.ok(/won't call Kabir/.test(says[1]));
  const r = hangUp(brain, session.id);
  assert.strictEqual(r.consent.status, 'refused');
  assert.strictEqual(brain.getChild(c.id).consent.status, 'refused');
  assert.strictEqual(brain.inboundLookup({ contact_number: c.parent_phone }, { TAKHTI_QUIET_HOURS: '0-0' }).registered, false);
});

await test('consent: a child picks up, or nobody gives a clear answer → nothing is set up; doubt is never a yes', () => {
  const c = brain.registerChild({ name: 'Meera', age: 5, lang: 'hi', parent_phone: phone(), consent: 'call' }).child;
  let s = brain.createParentSession(c.id, 'consent').session;
  let says = talk(brain, s.id, ['main Meera hoon', 'hmm', 'Munni!']);
  assert.ok(/साफ़ सुनाई नहीं दिया/.test(says[2]), says[2]);
  hangUp(brain, s.id);
  assert.strictEqual(brain.getChild(c.id).consent.status, 'pending');
  s = brain.createParentSession(c.id, 'consent').session;
  says = talk(brain, s.id, ['haan', 'pata nahi', 'shayad', 'umm']);
  assert.ok(brain.getParentCall(s.id).outcome === 'unclear' && brain.getParentCall(s.id).answers.lessons === undefined);
  hangUp(brain, s.id);
  assert.strictEqual(brain.getChild(c.id).consent.given, false);
});

await test('consent: a time in quiet hours is asked again; "you decide" becomes 5pm and is said back', () => {
  const c = brain.registerChild({ name: 'Dev', age: 7, lang: 'en', parent_phone: phone(), consent: 'call' }).child;
  let s = brain.createParentSession(c.id, 'consent').session;
  let says = talk(brain, s.id, ['yes', 'yes', 'no', 'no', '10 at night', '5 pm', 'every other day', 'no']);
  assert.ok(/rest time/.test(says[4]) && /7 in the morning to 9 at night/.test(says[4]), says[4]);
  assert.ok(/at 5 in the evening/.test(says[5]));
  s = brain.createParentSession(c.id, 'consent').session;
  says = talk(brain, s.id, ['yes', 'yes', 'no', 'no', 'you decide', 'anything', 'every day', 'no']);
  assert.ok(/Okay, at 5 in the evening/.test(says[5]), says[5]);
  // "no, six o'clock" while asked about the days changes the time
  s = brain.createParentSession(c.id, 'consent').session;
  says = talk(brain, s.id, ['yes', 'yes', 'yes', 'no', '5 pm', 'no, 6 baje', 'roz', 'yes']);
  assert.ok(/at 6 in the evening/.test(says[5]), says[5]);
  hangUp(brain, s.id);
  assert.strictEqual(brain.getChild(c.id).schedule.time, '18:00');
  assert.strictEqual(brain.getChild(c.id).consent.recording, true);
});

/* ---------------- the weekly call ---------------- */
await test('weekly call: the week from real lessons; "is she behind?" answered honestly against the age band', () => {
  const c = brain.registerChild({ name: 'Riya', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child;
  brain.setSchedule(c.id, { time: '17:00', days: 'alternate', weekly: 'yes' });
  // too little evidence first
  let s = brain.createParentSession(c.id, 'weekly').session;
  let says = talk(brain, s.id, ['yes', 'is she behind?']);
  assert.ok(/didn't get to practise/.test(says[0]));
  assert.ok(/too early to say/.test(says[1]), says[1]);
  for (let i = 0; i < 3; i++) lesson(brain, c.id, 3);
  s = brain.createParentSession(c.id, 'weekly').session;
  says = talk(brain, s.id, ['haan', 'is she behind in maths?', 'tell me about reading', 'what should we do at home', 'homework?', 'is my data safe', 'bye']);
  assert.ok(/practised with Munni 3 times/.test(says[0]) && /sums were right the first time/.test(says[0]), says[0]);
  assert.ok(/can't compare Riya with the class/.test(says[1]) && /In maths/.test(says[1]) && !/In reading/.test(says[1]), says[1]);
  assert.ok(/"[^"]+"/.test(says[1]), 'no competency named');
  assert.ok(/lines were read well/.test(says[2]) && /Now practising/.test(says[2]), says[2]);
  assert.ok(/^At home, try this:/.test(says[3]), says[3]);
  assert.ok(/no teacher's homework/.test(says[4]));
  assert.ok(/first name, age, this phone number/.test(says[5]) && /call recordings/.test(says[5]), 'recording consent not reflected');
  assert.ok(/Goodbye!$/.test(says[6]));
  assert.ok(brain.getParentCall(s.id).done);
});

await test('weekly call: a parent can change the time, switch on English, stop the weekly call or pause lessons', () => {
  const c = brain.registerChild({ name: 'Sara', age: 8, lang: 'hi', parent_phone: phone(), consent: true }).child;
  brain.setSchedule(c.id, { time: '17:00', days: 'alternate', weekly: 'yes' });
  let s = brain.createParentSession(c.id, 'weekly').session;
  let says = talk(brain, s.id, ['haan', 'raat 10 baje call karo', 'shaam 6 baje', 'angrezi', 'haan', 'ye call band karo']);
  assert.ok(/आराम का समय/.test(says[1]), says[1]);
  assert.ok(/शाम छह बजे/.test(says[2]));
  assert.ok(/अंग्रेज़ी अभ्यास अभी बंद है/.test(says[3]) && /हर दूसरी कॉल/.test(says[4]));
  assert.ok(/हफ़्ते वाली कॉल नहीं आएँगी/.test(says[5]));
  let k = brain.getChild(c.id);
  assert.deepStrictEqual([k.schedule.time, k.schedule.enabled, k.english_practice, k.weekly.enabled], ['18:00', true, true, false]);
  assert.ok(k.changes.length >= 3 && k.changes.every(x => x.call === s.id));
  s = brain.createParentSession(c.id, 'weekly').session;
  says = talk(brain, s.id, ['haan', 'पाठ बंद करो']);
  k = brain.getChild(c.id);
  assert.strictEqual(k.schedule.enabled, false);
  assert.ok(createFlow(brain, { TAKHTI_QUIET_HOURS: '0-0' }).plan({ child_id: c.id }).go === false, 'paused lessons still planned');
  // "not now" on the greeting ends kindly
  s = brain.createParentSession(c.id, 'weekly').session;
  says = talk(brain, s.id, ['abhi nahi']);
  assert.ok(/अगले हफ़्ते/.test(says[0]) && brain.getParentCall(s.id).done);
});

/* ---------------- the scheduler, direct calls ---------------- */
await test('scheduler: calls at the chosen time, once; one retry 30 min later; then says honestly when the next call is', async () => {
  const fb = await fakeBolna();
  const b2 = createBrain({ dataDir: tmp() });
  const env = { BOLNA_API_KEY: 'bk', BOLNA_AGENT_ID: 'child-agent', BOLNA_PARENT_AGENT_ID: 'parent-agent', BOLNA_API_BASE: fb.base,
                TAKHTI_QUIET_HOURS: '21-7', TAKHTI_TZ: 'Asia/Kolkata' };
  try {
    const c = b2.registerChild({ name: 'Riya', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child;
    b2.setSchedule(c.id, { time: '17:00', days: 'alternate' });
    const sch = createScheduler(b2, env);
    assert.deepStrictEqual(await sch.tick(IST('2027-01-04', '16:50')), [], 'called early');
    let a = await sch.tick(IST('2027-01-04', '17:02'));
    assert.strictEqual(a.length, 1); assert.strictEqual(a[0].action, 'call');
    assert.strictEqual(fb.calls.length, 1);
    assert.strictEqual(fb.calls[0].agent_id, 'child-agent');
    assert.deepStrictEqual(Object.keys(fb.calls[0].user_data).sort(), ['allowed', 'caller_kind', 'child_name', 'greeting', 'lesson_language', 'registered', 'session_id']);
    assert.deepStrictEqual(await sch.tick(IST('2027-01-04', '17:05')), [], 'called twice in a day');
    // nobody answered
    const sid = a[0].session_id;
    hangUp(b2, sid, { status: 'no-answer', duration: 0, env, now: IST('2027-01-04', '17:03') });
    let s = b2.getSession(sid);
    assert.strictEqual(s.status, 'missed');
    assert.ok(/try once more at 5:33 in the evening/.test(s.report.text), s.report.text);
    assert.deepStrictEqual(await sch.tick(IST('2027-01-04', '17:20')), [], 'retried too soon');
    a = await sch.tick(IST('2027-01-04', '17:34'));
    assert.strictEqual(a[0].action, 'retry'); assert.strictEqual(fb.calls.length, 2);
    assert.strictEqual(fb.calls[1].user_data.session_id, sid, 'retry should reuse the planned lesson');
    hangUp(b2, sid, { status: 'busy', duration: 0, exec: 'ex-2', env, now: IST('2027-01-04', '17:35') });
    s = b2.getSession(sid);
    assert.ok(/next call is on Wednesday at 5 in the evening/.test(s.report.text), s.report.text);
    assert.deepStrictEqual(await sch.tick(IST('2027-01-04', '18:10')), [], 'a third call');
    // Tuesday is not a lesson day; Wednesday is
    assert.deepStrictEqual(await sch.tick(IST('2027-01-05', '17:01')), []);
    assert.strictEqual((await sch.tick(IST('2027-01-06', '17:01'))).length, 1);
  } finally { fb.close(); }
});

await test('scheduler: never in quiet hours, never without consent, never twice when the child already practised, weekly call on Sunday', async () => {
  const fb = await fakeBolna();
  const b3 = createBrain({ dataDir: tmp() });
  const env = { BOLNA_API_KEY: 'bk', BOLNA_AGENT_ID: 'child-agent', BOLNA_PARENT_AGENT_ID: 'parent-agent', BOLNA_API_BASE: fb.base,
                TAKHTI_QUIET_HOURS: '21-7', TAKHTI_TZ: 'Asia/Kolkata' };
  try {
    const sch = createScheduler(b3, env);
    // consent pending: no schedule can even be due
    const p = b3.registerChild({ name: 'Ira', age: 6, lang: 'hi', parent_phone: phone(), consent: 'call' }).child;
    const pk = b3.getChild(p.id); pk.schedule = { enabled: true, time: '17:00', days: C.DAYS.daily }; b3.store.put('children', pk.id, pk);
    // quiet hours: a schedule saved at 20:30 with a long fire window
    const q = b3.registerChild({ name: 'Om', age: 8, lang: 'en', parent_phone: phone(), consent: true }).child;
    b3.setSchedule(q.id, { time: '20:30', days: 'daily' });
    assert.ok(b3.setSchedule(q.id, { time: '22:00', days: 'daily' }).error, 'a lesson time inside quiet hours was accepted');
    const sch2 = createScheduler(b3, Object.assign({}, env, { TAKHTI_FIRE_WINDOW_MIN: '120' }));
    assert.deepStrictEqual((await sch2.tick(IST('2027-01-04', '21:10'))).filter(x => x.child === q.id), [], 'called in quiet hours');
    assert.deepStrictEqual((await sch.tick(IST('2027-01-04', '17:05'))).filter(x => x.child === p.id), [], 'called without consent');
    // a child who rang Munni themselves today isn't called again
    const r = b3.registerChild({ name: 'Rehan', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child;
    b3.setSchedule(r.id, { time: '17:00', days: 'daily', weekly: 'yes' });
    const today = C.localParts(new Date(), env);
    const rk = b3.getChild(r.id); rk.schedule.days = [today.weekday]; b3.store.put('children', rk.id, rk);
    lesson(b3, r.id);
    const nowAt5 = new Date(new Date(`${today.day}T17:05:00+05:30`));
    const out = (await sch.tick(nowAt5)).filter(x => x.child === r.id);
    assert.deepStrictEqual(out.map(x => x.action), ['skip']);
    // the weekly parent call: Sunday at the parent's time, through the parent agent
    const before = fb.calls.length;
    const w = (await sch.tick(IST('2027-01-10', '18:03'))).filter(x => x.action === 'weekly');
    assert.strictEqual(w.length, 1);
    const pc = fb.calls.slice(before).find(x => x.agent_id === 'parent-agent');
    assert.ok(pc && pc.user_data.call_kind === 'weekly' && /week of practice/.test(pc.user_data.greeting));
    assert.deepStrictEqual((await sch.tick(IST('2027-01-10', '18:20'))).filter(x => x.action === 'weekly'), [], 'weekly twice');
  } finally { fb.close(); }
});

/* ---------------- the Bolna Workflow path ---------------- */
await test('workflow: the scheduler starts the daily workflow; plan, gate, result and missed answer it safely, twice over', async () => {
  const fb = await fakeBolna();
  const b4 = createBrain({ dataDir: tmp() });
  const env = { BOLNA_API_KEY: 'bk', BOLNA_AGENT_ID: 'child-agent', BOLNA_API_BASE: fb.base, BOLNA_DAILY_WORKFLOW_ID: 'wf-daily',
                TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata', TAKHTI_PUBLIC_URL: 'https://takhti.example' };
  try {
    const c = b4.registerChild({ name: 'Riya', age: 7, lang: 'hi', parent_phone: phone(), consent: true }).child;
    b4.setSchedule(c.id, { time: '17:00', days: 'daily' });
    const a = await createScheduler(b4, env).tick(IST('2027-01-04', '17:00'));
    assert.strictEqual(a[0].action, 'workflow');
    assert.strictEqual(fb.runs.length, 1);
    assert.strictEqual(fb.runs[0].id, 'wf-daily');
    assert.strictEqual(fb.runs[0].body.child_id, c.id);
    assert.strictEqual(fb.runs[0].body.mobile_number, c.parent_phone);
    assert.strictEqual(fb.calls.length, 0, 'the server dialled as well as the workflow');

    const flow = createFlow(b4, env);
    const p1 = flow.plan({ child_id: c.id, reference_id: 'r1' });
    const p2 = flow.plan({ child_id: c.id, reference_id: 'r1' });
    assert.ok(p1.go && p1.session_id === p2.session_id, 'plan is not idempotent');
    assert.strictEqual(p1.lang, 'hi');
    assert.strictEqual(p1.card_url, `https://takhti.example/voice/card/${p1.session_id}`);
    assert.ok(/रिकॉर्ड/.test(p1.greeting) || p1.greeting.length > 20);
    assert.deepStrictEqual(flow.gate({ session_id: p1.session_id }), { go: true });
    assert.strictEqual(createFlow(b4, Object.assign({}, env, { TAKHTI_QUIET_HOURS: '0-24' })).gate({ session_id: p1.session_id }).go, false, 'gate open in quiet hours');
    assert.strictEqual(flow.result({ session_id: p1.session_id }).ready, false, 'a report before the call');

    // the call happens (the workflow's agent node), the webhook settles it
    let r = b4.toolNext(p1.session_id), i = 0;
    while (!r.done && i++ < 80) { const s = b4.getSession(p1.session_id); const it = s.items[s.items.length - 1];
      r = b4.toolAnswer(p1.session_id, it.expect === 'yesno' ? (it.answer ? 'haan' : 'nahi') : it.expect === 'number' ? String(it.answer) : it.target); }
    assert.strictEqual(flow.gate({ session_id: p1.session_id }).go, false, 'gate open after the lesson started');
    hangUp(b4, p1.session_id);
    const res = flow.result({ session_id: p1.session_id });
    assert.ok(res.ready && res.l1 && res.l2 && res.l3 && res.report_url.endsWith(p1.session_id));
    for (const l of [res.l1, res.l2, res.l3]) assert.ok(!/\n/.test(l) && l.length < 900, 'a template variable with a line break');
    assert.ok(/Riya ने आज मुन्नी के साथ अभ्यास किया/.test(res.l1), res.l1);
    assert.strictEqual(flow.missed({ session_id: p1.session_id }).send, false, 'missed message after a real lesson');
    assert.strictEqual(flow.plan({ child_id: c.id, reference_id: 'r1' }).go, false, 'a second lesson the same day');

    // a family the workflow couldn't reach
    const d = b4.registerChild({ name: 'Om', age: 8, lang: 'en', parent_phone: phone(), consent: true }).child;
    b4.setSchedule(d.id, { time: '17:00', days: 'daily' });
    const p3 = flow.plan({ child_id: d.id, reference_id: 'r3' });
    const m1 = flow.missed({ session_id: p3.session_id });
    assert.ok(m1.send && /Munni could not reach Om today\. The next call is tomorrow at 5 in the evening\./.test(m1.l1), m1.l1);
    assert.strictEqual(flow.missed({ session_id: p3.session_id }).send, false, 'missed message sent twice');
    assert.strictEqual(flow.plan({ child_id: 'nobody' }).go, false);
  } finally { fb.close(); }
});

await test('workflow: the consent workflow plans, gates and returns a written copy of what was agreed', () => {
  const env = { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata', TAKHTI_HELP_CONTACT: '+91 90000 00000' };
  const flow = createFlow(brain, env);
  const c = brain.registerChild({ name: 'Tara', age: 7, lang: 'hi', parent_phone: phone(), consent: 'call' }).child;
  const p = flow.consentPlan({ child_id: c.id });
  assert.ok(p.go && p.call_kind === 'consent' && /माता-पिता/.test(p.greeting));
  assert.deepStrictEqual(flow.gate({ session_id: p.session_id }), { go: true });
  assert.strictEqual(flow.consentResult({ session_id: p.session_id }).ready, false);
  talk(brain, p.session_id, ['haan', 'haan', 'haan', 'nahi', '5 baje', 'roz', 'haan']);
  hangUp(brain, p.session_id);
  const r = flow.consentResult({ session_id: p.session_id });
  assert.ok(r.ready && r.given, JSON.stringify(r));
  assert.ok(/रोज़ शाम पाँच बजे Tara को/.test(r.l1) && /रिकॉर्ड/.test(r.l1), r.l1);
  assert.ok(/\+91 90000 00000/.test(r.l2), r.l2);
  assert.strictEqual(flow.consentPlan({ child_id: c.id }).go, false, 'asked again after consent');
});

await test('workflow definitions: every route lands on a node, ends end, templates are numbered 1..n, retries loop upstream', () => {
  for (const [kind, def] of [['daily', WF.daily()], ['consent', WF.consent()]]) {
    const ids = new Set(def.nodes.map(n => n.id));
    assert.strictEqual(ids.size, def.nodes.length, kind + ': duplicate ids');
    assert.ok(ids.has(def.entry_node_id) && ids.has(def.on_no_match), kind);
    const order = def.nodes.map(n => n.id);
    for (const n of def.nodes) {
      assert.ok(/^[a-z0-9_]{1,64}$/.test(n.id), n.id);
      if (n.type === 'end') { assert.ok(n.config.label && ['success', 'failure', 'neutral'].includes(n.config.outcome) && !n.cases && !n.to, n.id); continue; }
      if (n.type === 'time') { assert.ok(ids.has(n.to) && !n.cases && (!!n.config.delay !== !!n.config.at), n.id); continue; }
      assert.ok(Array.isArray(n.cases) && n.cases.length && n.cases.length <= 25, n.id);
      for (const c of n.cases) { assert.ok(ids.has(c.then.to), `${n.id} → ${c.then.to}`); assert.ok(!c.then.effects || c.then.effects.length <= 10); }
      assert.ok(n.cases[n.cases.length - 1].when.always, n.id + ': no catch-all case');
      if (n.type === 'aisensy_whatsapp') {
        const keys = Object.keys(n.config.variables);
        assert.deepStrictEqual(keys, keys.map((_, i) => String(i + 1)), n.id);
        assert.ok(['hi', 'en'].includes(n.config.language) && n.config.recipient.var === 'entry.mobile_number' && n.cases.length === 1);
      }
      if (n.type === 'retry') assert.ok(order.indexOf(n.config.target_node_id) < order.indexOf(n.id) && n.config.attempts.length <= 10, n.id);
      if (n.type === 'api') assert.ok(/^https?:\/\/[^{]+\/voice\/flow\//.test(n.config.url) && /^Bearer /.test(n.config.headers.Authorization), n.id);
      if (n.type === 'agent') {
        assert.ok(n.config.agent_id && n.config.variables.session_id.var === 'state.session_id', n.id);
        assert.ok(!('age' in n.config.variables) && !('parent_phone' in n.config.variables), 'more than the minimum sent to Bolna');
      }
    }
  }
  const d = WF.daily();
  const card = d.nodes.findIndex(n => n.id === 'n_card_hi'), callAt = d.nodes.findIndex(n => n.id === 'n_call');
  assert.ok(card < callAt, 'the card should go before the call');
  assert.strictEqual(d.nodes.find(n => n.id === 'n_retry').config.target_node_id, 'n_gate', 'a retry that skips the quiet-hours gate');
});

await test('parent agent graph: one tool, scoped to the talk node; hang-ups are fixed lines; keypad on', () => {
  const t = PA.agent.agent_config.tasks[0];
  const nodes = t.tools_config.llm_agent.llm_config.nodes;
  assert.deepStrictEqual(PA.tools.map(x => x.name), ['takhti_parent']);
  assert.deepStrictEqual(t.tools_config.api_tools.tools_params.takhti_parent.nodes, ['talk']);
  assert.ok(/\/voice\/tools\/parent$/.test(t.tools_config.api_tools.tools_params.takhti_parent.url));
  for (const n of nodes) for (const e of n.edges) assert.ok(nodes.some(x => x.id === e.to_node_id), e.to_node_id);
  for (const n of nodes.filter(x => x.node_type === 'static')) assert.strictEqual(n.function_call, 'end_call');
  assert.strictEqual(t.task_config.dtmf_enabled, true);
  assert.strictEqual(PA.agent.agent_config.agent_welcome_message, '{{greeting}}');
  assert.ok(/\/voice\/webhook\?key=/.test(PA.agent.agent_config.webhook_url));
  assert.ok(/Never answer a question yourself/.test(PA.PERSONA));
});

/* ---------------- the HTTP surface ---------------- */
await test('HTTP: parent tool and workflow endpoints need the tool token; admin can set schedules and start calls', async () => {
  const fb = await fakeBolna();
  const b5 = createBrain({ dataDir: tmp() });
  const env = { BOLNA_API_KEY: 'bk', BOLNA_PARENT_AGENT_ID: 'parent-agent', BOLNA_API_BASE: fb.base, TAKHTI_QUIET_HOURS: '0-0' };
  const { server } = createServer({ brain: b5, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const call = (method, p, body, auth) => new Promise((resolve, reject) => {
    const req = http.request({ port, path: p, method, headers: Object.assign({ 'Content-Type': 'application/json' }, auth ? { Authorization: 'Bearer ' + auth } : {}) }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d && d[0] === '{' || d[0] === '[' ? JSON.parse(d) : d }));
    });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
  try {
    let r = await call('POST', '/voice/admin/children', { name: 'Riya', age: 7, lang: 'hi', parent_lang: 'en', parent_phone: phone(), consent: 'call' }, 'ak');
    assert.strictEqual(r.status, 201);
    const id = r.body.child.id;
    assert.strictEqual(r.body.child.consent.status, 'pending');
    assert.strictEqual(r.body.child.parent_lang, 'en');
    r = await call('POST', `/voice/admin/children/${id}/consent-call`, {}, 'ak');
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    const pcall = fb.calls[fb.calls.length - 1];
    assert.ok(pcall.agent_id === 'parent-agent' && pcall.user_data.call_kind === 'consent' && /Namaste! This is Munni/.test(pcall.user_data.greeting), 'parent language not used');
    assert.strictEqual((await call('POST', '/voice/tools/parent', { session_id: r.body.session_id, parent_said: 'yes' })).status, 401);
    const t = await call('POST', '/voice/tools/parent', { session_id: r.body.session_id, parent_said: 'yes' }, 'tt');
    assert.ok(t.status === 200 && /Takhti is a free practice tutor/.test(t.body.say) && t.body.done === false);
    assert.strictEqual((await call('POST', '/voice/flow/plan', { child_id: id })).status, 401);
    const fp = await call('POST', '/voice/flow/plan', { child_id: id }, 'tt');
    assert.ok(fp.status === 200 && fp.body.go === false && /consent/.test(fp.body.why));
    assert.strictEqual((await call('POST', `/voice/admin/children/${id}/schedule`, { time: '17:30', days: 'daily' }, 'ak')).status, 200);
    assert.strictEqual(b5.getChild(id).schedule.time, '17:30');
    assert.strictEqual((await call('POST', `/voice/admin/children/${id}/schedule`, { time: '23:00' }, 'ak')).status, 400);
    assert.strictEqual((await call('GET', `/voice/admin/parentcalls/${r.body.session_id}`, null, 'ak')).body.kind, 'consent');
    const dash = await call('GET', '/voice/admin?key=ak', null);
    assert.ok(/Consent call|needs review|waiting/.test(dash.body) && /Parent calls/.test(dash.body));
  } finally { server.close(); fb.close(); }
});

console.log(results.join('\n'));
console.log(`\n${pass}/${pass + fail} parent-call checks passed`);
process.exit(fail ? 1 : 0);
})();
