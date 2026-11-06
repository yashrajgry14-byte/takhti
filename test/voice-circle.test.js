#!/usr/bin/env node
/* ==================================================================
   THE LEARNING CIRCLE — run with: node test/voice-circle.test.js

   Everyone around one child, in step: app sync (only with the parent's
   tick, progress only, a phone key), the family code that joins the app
   to the school's record, the evidence ledger (nothing counted twice),
   the weekly focus (class homework adapted to the child, Takhti's own
   choice, next week's suggestion), the Friday check (app, call, reading),
   the home loop (activities, done, Munni asks), tutors (invited by a
   parent, linked by a school and waiting for the parent, their pack,
   results and notes), the three pages, the WhatsApp outbox and the
   circle's weekly rhythm in the scheduler.
   ================================================================== */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createBrain } = require('../voice/brain');
const { createServer } = require('../voice/server');
const { createScheduler } = require('../voice/schedule');
const EV = require('../voice/evidence');
const CI = require('../voice/circle');

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push('  ok    ' + name); }
  catch (e) { fail++; results.push('  FAIL  ' + name + '\n        ' + (e && e.stack || e).toString().split('\n').slice(0, 12).join('\n        ')); }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-circle-test-'));
let n = 0;
const phone = () => '+9195000' + String(10000 + (n++)).padStart(5, '0');
const ENV = { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata', TAKHTI_PUBLIC_URL: 'https://takhti.example', TAKHTI_CHECK_DAYS: '1,2,3,4,5,6,7' };
const appChild = (id, extra) => Object.assign({ id, name: 'Riya', age: 7, lang: 'hi' }, extra || {});
const progress = (h, extra) => Object.assign({ seq: Date.now(), levels: { read: 3, write: 2, math: 3 }, skillHistory: h || {}, attempts: { read: 4, write: 0, math: 6 }, correct: { read: 3, write: 0, math: 4 }, stars: 9, cards: 1 }, extra || {});
const perfect = it => it.expect === 'yesno' ? (it.answer ? 'haan' : 'nahi') : it.expect === 'number' ? String(it.answer) : it.target;
function lesson(brain, childId, answerFn) {
  const { session, error } = brain.createSession(childId);
  if (error) throw new Error(error.join('; '));
  let r = brain.toolNext(session.id);
  for (let i = 0; i < 80 && !r.done; i++) { const s = brain.getSession(session.id); const it = s.items[s.items.length - 1]; r = brain.toolAnswer(session.id, (answerFn || perfect)(it)); }
  const s = brain.getSession(session.id);
  brain.onCallEvent({ id: 'ex-' + session.id, status: 'completed', transcript: s.live_turns.map(t => `${t.role}: ${t.text}`).join('\n'),
    conversation_duration: 240, telephony_data: {}, context_details: { recipient_data: { session_id: session.id } } }, ENV);
  return brain.getSession(session.id);
}
async function http0(server) { await new Promise(r => server.listen(0, r)); return server.address().port; }
function caller(port) {
  return (method, p, body, opts) => new Promise((resolve, reject) => {
    const form = opts && opts.form;
    const data = body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : null;
    const req = http.request({ port, path: p, method, headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: /^[\[{]/.test(d) ? JSON.parse(d) : d }));
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}

(async () => {

await test('the week key is the ISO week, in the family\'s time zone', () => {
  assert.strictEqual(CI.isoWeek('2027-01-04'), '2027-W01');
  assert.strictEqual(CI.isoWeek('2027-01-03'), '2026-W53');
  assert.strictEqual(CI.isoWeek('2026-10-25'), '2026-W43');
  for (const [k, g] of Object.entries(CI.HOME)) for (const part of ['do', 'teach', 'topic']) assert.ok(g[part].en && g[part].hi && /[ऀ-ॿ]/.test(g[part].hi), k + '.' + part);
});

await test('sync: nothing without the parent\'s tick; then progress only, this phone\'s key, levels from the app', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle;
  assert.strictEqual((await C.sync({ child: appChild('appRIYA01'), progress: progress() }, 'ip1')).status, 403);
  const r = await C.sync({ child: appChild('appRIYA01'), consent: { sync: true }, progress: progress({ add10: { n: 8, right: 7 } }),
    photos: ['data:image/png;base64,AAA'], queue: [{ q: 'why is the sky blue' }], voice: 'blob' }, 'ip1');
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.key && r.body.child_id === 'app_appRIYA01');
  const rec = brain.getChild('app_appRIYA01');
  const raw = JSON.stringify(rec);
  assert.ok(!/data:image|sky blue|blob/.test(raw), 'a photo, a typed question or a voice was stored');
  assert.deepStrictEqual(rec.circle.app_snapshot.skillHistory, { add10: { n: 8, right: 7 } });
  assert.strictEqual(rec.profile.levels.math, 3);
  assert.ok(rec.circle.sync.on && rec.circle.sync.notice === C.SYNC_NOTICE);
  assert.strictEqual(rec.consent.given, false, 'sync must not open phone lessons');
  assert.ok(brain.createSession(rec.id).error, 'a phone lesson without lesson consent');
  assert.strictEqual((await C.sync({ child: appChild('appRIYA01'), consent: { sync: true }, progress: progress() }, 'ip1')).status, 403, 'another phone synced without the key');
  const again = await C.sync({ child: appChild('appRIYA01'), key: r.body.key, consent: { sync: true }, progress: progress({ add10: { n: 9, right: 8 } }) }, 'ip1');
  assert.strictEqual(again.status, 200);
  assert.ok(!again.body.key, 'a new key on every sync');
  assert.ok(again.body.circle.week.skill && again.body.circle.week.why.en && again.body.circle.week.why.hi);
  assert.ok(/^https:\/\/takhti\.example\/circle\/p\//.test(again.body.circle.parent_page));
});

await test('a family code joins the app to the school\'s record; the class tells us the school; nothing is counted twice', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle;
  const school = brain.createSchool({ name: 'Green Valley' }).school;
  brain.registerTeacher({ name: 'Sunita', phone: phone(), class_codes: ['CLS1B1'], school_id: school.id });
  const kid = brain.registerChild({ name: 'Aman', age: 7, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const code = C.familyCode(kid.id);
  assert.ok(/^[A-HJ-NP-Z2-9]{8}$/.test(code));
  // the app had synced on its own first
  const first = await C.sync({ child: appChild('appAMAN01', { name: 'Aman' }), consent: { sync: true }, progress: progress({ add10: { n: 4, right: 4 } }) }, 'ip2');
  assert.strictEqual((await C.sync({ child: appChild('appAMAN01', { name: 'Aman' }), key: first.body.key, consent: { sync: true }, link: 'NOPE1234', progress: progress() }, 'ip2')).status, 404);
  const linked = await C.sync({ child: appChild('appAMAN01', { name: 'Aman' }), key: first.body.key, consent: { sync: true }, link: code.toLowerCase(),
                                progress: progress({ add10: { n: 6, right: 5 } }, { classCode: 'CLS1B1' }) }, 'ip2');
  assert.strictEqual(linked.status, 200, JSON.stringify(linked.body));
  assert.strictEqual(linked.body.child_id, kid.id, 'not joined to the school record');
  assert.strictEqual(brain.getChild('app_appAMAN01'), null, 'the app-only record was left behind');
  assert.strictEqual((await C.sync({ child: appChild('appOTHER1', { name: 'X' }), consent: { sync: true }, link: code, progress: progress() }, 'ip3')).status, 409, 'a second phone took the family code');
  // a phone lesson is server evidence; the app's snapshot is the app's
  lesson(brain, kid.id);
  const rec = brain.getChild(kid.id);
  const server = rec.server_evidence;
  assert.ok(Object.keys(server).length, 'the phone lesson left no server evidence');
  const comb = EV.combinedHistory(rec);
  for (const [id, e] of Object.entries(server)) assert.strictEqual(comb[id].n, e.n + ((rec.circle.app_snapshot.skillHistory[id] || {}).n || 0), id);
  const down = await C.sync({ child: appChild('appAMAN01', { name: 'Aman' }), key: first.body.key, consent: { sync: true }, progress: progress({ add10: { n: 6, right: 5 } }) }, 'ip2');
  assert.deepStrictEqual(down.body.circle.circleHistory, rec.server_evidence, 'the app should get exactly the server-only evidence');
  // a level the phone lesson moved goes back to the app
  const moved = brain.getChild(kid.id); const was = moved.profile.levels.math; moved.profile.levels.math = was === 5 ? 4 : was + 1; brain.store.put('children', moved.id, moved);
  const back = await C.sync({ child: appChild('appAMAN01', { name: 'Aman' }), key: first.body.key, consent: { sync: true }, progress: progress() }, 'ip2');
  assert.deepStrictEqual(back.body.levels, { math: moved.profile.levels.math }, 'a level a phone lesson moved did not go back to the app');
  assert.strictEqual(down.body.circle.members.school, 'Green Valley');
});

await test('weekly focus: the class focus adapted to the child\'s real gap, else the child\'s own weakest step; the same everywhere', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle;
  const school = brain.createSchool({ name: 'Hill View' }).school;
  const a = brain.registerChild({ name: 'Zoya', age: 9, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const b = brain.registerChild({ name: 'Dev', age: 9, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
  for (const k of [a, b]) { const r = brain.getChild(k.id); r.profile.classCode = 'CLS9A1'; brain.store.put('children', r.id, r); }
  // Zoya is weak on skip counting, which tables stands on
  const z = brain.getChild(a.id); z.profile.skillHistory = { skip: { n: 8, right: 2 }, add2: { n: 8, right: 8 } }; brain.store.put('children', z.id, z);
  const r = C.setClassFocus('CLS9A1', 'tables', 'Times tables week', 'Sunita');
  assert.ok(r.ok && r.children === 2 && /^TKH1\./.test(r.homework_code));
  const wz = C.focusFor(brain.getChild(a.id)), wd = C.focusFor(brain.getChild(b.id));
  assert.strictEqual(wz.source, 'homework');
  assert.strictEqual(wz.skill, 'skip', 'not adapted to the gap underneath');
  assert.ok(/step underneath/.test(wz.why.en) && /नीचे का कदम/.test(wz.why.hi), wz.why.en);
  assert.strictEqual(wd.skill, 'tables');
  assert.strictEqual(wd.home.length, 2);
  // the phone lesson asks the same step, in the homework slot
  const s = brain.createSession(a.id).session;
  assert.strictEqual(s.homework_skill, 'skip');
  // with no homework: the child's own weakest step, earliest first
  const solo = brain.registerChild({ name: 'Om', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const o = brain.getChild(solo.id); o.profile.skillHistory = { borrow: { n: 6, right: 1 }, carry: { n: 6, right: 2 }, add10: { n: 9, right: 9 } }; brain.store.put('children', o.id, o);
  const wo = C.focusFor(brain.getChild(solo.id));
  assert.strictEqual(wo.source, 'takhti');
  assert.ok(['carry', 'borrow'].includes(wo.skill), wo.skill);
  assert.ok(/पहला कदम/.test(wo.why.hi));
});

await test('Friday check: three questions in the app → a kind verdict and next week\'s step; on a call; and read off the week\'s reading', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle;
  const school = brain.createSchool({ name: 'S' }).school;
  const kid = brain.registerChild({ name: 'Riya', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k = brain.getChild(kid.id); k.profile.skillHistory = { carry: { n: 6, right: 2 } }; brain.store.put('children', k.id, k);
  const w = C.focusFor(brain.getChild(kid.id));
  assert.strictEqual(w.skill, 'carry');
  const qs = C.checkQuestions(brain.getChild(kid.id), w);
  assert.strictEqual(qs.length, 3);
  assert.ok(qs.every(q => q.opts.includes(q.answer) && (q.text.match(/\d+/g) || []).map(Number).reduce((x, y) => x % 10 + y % 10) >= 10), 'a carrying check without carrying');
  let r = C.checkResult(brain.getChild(kid.id), { week: w.key, right: 3, of: 3, source: 'app' });
  assert.ok(r.ok && r.check.verdict === 'mastered' && r.check.next.skill === 'borrow', JSON.stringify(r.check));
  assert.ok(!C.checkResult(brain.getChild(kid.id), { week: w.key, right: 0, of: 3, source: 'app' }).ok, 'checked twice');
  const msg = brain.messages.list().find(m => m.kind === 'check_done');
  assert.ok(msg && /शुक्रवार वाला छोटा टेस्ट/.test(msg.text) && /3 में से 3/.test(msg.text) && msg.to.phone === kid.parent_phone, msg && msg.text);
  assert.ok(!/fail|wrong|गलत/i.test(msg.text));
  // a "not yet" looks underneath with the app's own diagnosis
  const kid2 = brain.registerChild({ name: 'Aman', age: 9, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k2 = brain.getChild(kid2.id); k2.profile.skillHistory = { tables: { n: 6, right: 2 }, skip: { n: 6, right: 1 } }; brain.store.put('children', k2.id, k2);
  const w2 = C.focusFor(brain.getChild(kid2.id));
  const r2 = C.checkResult(brain.getChild(kid2.id), { week: w2.key, right: 0, of: 3, source: 'app' });
  assert.strictEqual(r2.check.verdict, 'not_yet');
  assert.ok(r2.check.next.skill && r2.check.next.why.en, JSON.stringify(r2.check.next));
  // next week starts from the suggestion
  const rec = brain.getChild(kid.id); rec.circle.week.key = '2000-W01'; brain.store.put('children', rec.id, rec);
  assert.strictEqual(C.focusFor(brain.getChild(kid.id)).skill, 'borrow');
  assert.strictEqual(C.focusFor(brain.getChild(kid.id)).source, 'last check');
  // on a call: three check questions replace the free sums; the result lands in the circle
  const kid3 = brain.registerChild({ name: 'Zoya', age: 8, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k3 = brain.getChild(kid3.id); k3.profile.skillHistory = { carry: { n: 6, right: 2 } }; brain.store.put('children', k3.id, k3);
  const sess = lesson(brain, kid3.id);
  assert.strictEqual(sess.items.filter(i => i.kind === 'check').length, 3, sess.slots.join(','));
  assert.ok(sess.items.find(i => i.kind === 'check').prompts[0].startsWith("Now Munni's Friday check"));
  const w3 = brain.getChild(kid3.id).circle.week;
  assert.ok(w3.check && w3.check.source === 'call' && w3.check.right === 3 && w3.check.of === 3, JSON.stringify(w3.check));
  // a reading focus: the week's reading is the check
  const kid4 = brain.registerChild({ name: 'Ira', age: 7, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k4 = brain.getChild(kid4.id); C.ensure(k4); k4.focus = null; brain.store.put('children', k4.id, k4);
  const w4 = C.focusFor(brain.getChild(kid4.id));
  const k4b = brain.getChild(kid4.id); k4b.circle.week.skill = 'read3'; k4b.circle.week.start = { n: 0, right: 0 };
  k4b.profile.skillHistory.read3 = { n: 5, right: 4 }; brain.store.put('children', k4b.id, k4b);
  const rc = C.readingCheck(brain.getChild(kid4.id));
  assert.ok(rc && rc.check.source === 'reading' && rc.check.of === 3, JSON.stringify(rc));
});

await test('home loop: two things a week; the parent marks one done; Munni asks the child next time (call or app), once', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle;
  const school = brain.createSchool({ name: 'S' }).school;
  const kid = brain.registerChild({ name: 'Riya', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const w = C.focusFor(brain.getChild(kid.id));
  assert.deepStrictEqual(w.home.map(h => h.kind), ['do', 'teach']);
  assert.ok(w.home.every(h => h.text.hi.includes('Riya') || !/\{name\}/.test(h.text.hi)));
  assert.strictEqual(C.homeToAsk(brain.getChild(kid.id)), null, 'asked before the family had it');
  const teach = w.home.find(h => h.kind === 'teach');
  assert.ok(C.homeDone(brain.getChild(kid.id), teach.id, 'parent (page)').ok);
  const s = brain.createSession(kid.id).session;
  assert.strictEqual(s.slots[0], 'home');
  let r = brain.toolNext(s.id);
  assert.ok(/घर पर किसी को/.test(r.say) && r.say.includes(teach.topic.hi), r.say);
  r = brain.toolAnswer(s.id, 'haan');
  assert.ok(/सिखाना सीखने का सबसे अच्छा तरीका/.test(r.say), r.say);
  const h = brain.getChild(kid.id).circle.week.home.find(x => x.id === teach.id);
  assert.ok(h.child_said === 'yes' && h.asked_where === 'call');
  assert.strictEqual(C.homeToAsk(brain.getChild(kid.id)), null, 'asked twice');
  assert.ok(!brain.createSession(kid.id).session.slots.includes('home'));
});

await test('tutors: a parent invites (active); a school links (waits for the parent); the pack, results as evidence, notes, removal', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle;
  const school = brain.createSchool({ name: 'Green Valley' }).school;
  const teacher = brain.registerTeacher({ name: 'Sunita', phone: phone(), class_codes: ['CLS2B1'], school_id: school.id }).teacher;
  const kid = brain.registerChild({ name: 'Riya', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k = brain.getChild(kid.id); k.profile.classCode = 'CLS2B1'; k.profile.skillHistory = { carry: { n: 6, right: 2 } }; brain.store.put('children', k.id, k);
  // a call this week where carrying went wrong
  lesson(brain, kid.id, it => it.skill === 'carry' && it.attempts === 0 ? String(it.answer - 10) : perfect(it));
  const { server } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env: ENV });
  const port = await http0(server); const call = caller(port);
  try {
    // the parent invites their own tutor
    const inv = await C.inviteTutor(kid.id, { name: 'Mr Rao', phone: phone(), lang: 'en' }, 'parent');
    assert.strictEqual(inv.status, 'active');
    const tutor = brain.store.get('tutors', inv.tutor.id);
    assert.ok(brain.messages.list().some(m => m.kind === 'tutor_added' && m.to.phone === tutor.phone && /\/circle\/t\//.test(m.link)));
    // the school links another: it waits for the parent
    let res = await call('POST', `/circle/c/${teacher.token}/link-tutor`, { child: kid.id, name: 'Ms Iyer', phone: phone() }, { form: true });
    assert.strictEqual(res.status, 303);
    const pending = brain.getChild(kid.id).circle.tutors.find(x => x.status === 'pending');
    assert.ok(pending, 'school-linked tutor is not waiting for the parent');
    const iyer = brain.store.get('tutors', pending.id);
    assert.strictEqual(C.tutorChildren(iyer).length, 0, 'a tutor saw a child before the parent said yes');
    assert.ok(brain.messages.list().some(m => m.kind === 'tutor_approve' && /हाँ कहें/.test(m.text)));
    const ptok = brain.getChild(kid.id).circle.parent_token;
    res = await call('POST', `/circle/p/${ptok}/tutor`, { id: iyer.id, action: 'approve' }, { form: true });
    assert.strictEqual(C.tutorChildren(brain.store.get('tutors', iyer.id)).length, 1);
    // the pack
    const page = await call('GET', `/circle/t/${tutor.token}`);
    assert.strictEqual(page.status, 200);
    assert.ok(/Riya/.test(page.body) && /Carrying/.test(page.body) && /Three questions for today/.test(page.body), 'pack missing');
    assert.ok(/forgot to carry the ten/.test(page.body), 'the mistake to watch for is missing');
    const pack = C.tutorPack(tutor, brain.getChild(kid.id));
    assert.strictEqual(pack.questions.length, 3);
    assert.ok(pack.misses.length >= 1 && pack.misses[0].problem, 'what went wrong this week is missing');
    // results come back as evidence
    const before = (brain.getChild(kid.id).server_evidence.carry || { n: 0 }).n;
    res = await call('POST', `/circle/t/${tutor.token}/result`, { child: kid.id, q0: 'right', q2: 'right' }, { form: true });
    assert.strictEqual(res.status, 303);
    const after = brain.getChild(kid.id);
    assert.strictEqual(after.server_evidence.carry.n, before + 3);
    assert.strictEqual(after.circle.week.tutor_results[0].right, 2);
    // a note
    await call('POST', `/circle/t/${tutor.token}/note`, { child: kid.id, text: 'finds borrowing hard' }, { form: true });
    const note = brain.getChild(kid.id).teacher_notes.pop();
    assert.ok(note.skill === 'borrow' && note.ok === false && /tutor/.test(note.by), JSON.stringify(note));
    // the tutor's own phone line takes notes, for their students only
    const lk = brain.inboundLookup({ contact_number: tutor.phone }, { TAKHTI_QUIET_HOURS: '0-0' });
    assert.strictEqual(lk.caller_kind, 'teacher');
    assert.ok(/Riya/.test(brain.toolNote(lk.session_id, 'Riya ko hasil mein dikkat').say));
    // schedule; removal by the parent
    await call('POST', `/circle/t/${tutor.token}/schedule`, { d2: '1', d4: '1', time: '17:00' }, { form: true });
    assert.deepStrictEqual(brain.store.get('tutors', tutor.id).schedule, { days: [2, 4], time: '17:00' });
    await call('POST', `/circle/p/${ptok}/tutor`, { id: tutor.id, action: 'remove' }, { form: true });
    assert.strictEqual(C.tutorChildren(brain.store.get('tutors', tutor.id)).length, 0);
    assert.ok(!/Riya/.test((await call('GET', `/circle/t/${tutor.token}`)).body), 'a removed tutor still sees the child');
    assert.strictEqual((await call('GET', '/circle/t/not-a-real-token-at-all')).status, 404);
  } finally { server.close(); }
});

await test('pages: the parent\'s (their language, done, invite, stop messages), the class teacher\'s (focus, codes, rows)', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const school = brain.createSchool({ name: 'Green Valley' }).school;
  const teacher = brain.registerTeacher({ name: 'Sunita', phone: phone(), class_codes: ['CLS3C1'], school_id: school.id }).teacher;
  const kid = brain.registerChild({ name: 'Aman', age: 7, lang: 'en', parent_lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k = brain.getChild(kid.id); k.profile.classCode = 'CLS3C1'; brain.store.put('children', k.id, k);
  const { server } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env: ENV });
  const port = await http0(server); const call = caller(port);
  try {
    const ptok = brain.circle.ensure(brain.getChild(kid.id)).parent_token; brain.store.put('children', kid.id, Object.assign(brain.getChild(kid.id), { circle: Object.assign(brain.getChild(kid.id).circle || {}, { parent_token: ptok }) }));
    let page = await call('GET', `/circle/p/${ptok}`);
    assert.ok(page.status === 200 && /का सीखने का घेरा/.test(page.body) && /घर पर/.test(page.body) && /शुक्रवार/.test(page.body), 'parent page not in the parent\'s language');
    assert.ok(!/<script/i.test(page.body.replace(/onclick="window.print\(\)"/g, '')), 'scripts on a family page');
    const doId = brain.getChild(kid.id).circle.week.home[0].id;
    let res = await call('POST', `/circle/p/${ptok}/home`, { id: doId }, { form: true });
    assert.strictEqual(res.status, 303);
    assert.ok(brain.getChild(kid.id).circle.week.home[0].done_at);
    res = await call('POST', `/circle/p/${ptok}/invite`, { name: 'Mr Rao', phone: phone(), lang: 'en' }, { form: true });
    assert.ok(/Mr%20Rao/.test(res.headers.location));
    await call('POST', `/circle/p/${ptok}/messages`, { on: 'no' }, { form: true });
    assert.strictEqual(brain.getChild(kid.id).circle.messages_off, true);
    // the class teacher
    page = await call('GET', `/circle/c/${teacher.token}`);
    assert.ok(page.status === 200 && /Class CLS3C1/.test(page.body) && /Aman/.test(page.body));
    res = await call('POST', `/circle/c/${teacher.token}/focus`, { code: 'CLS3C1', skill: 'add2', note: 'Two-digit week' }, { form: true });
    assert.ok(/focus%20is%20set/.test(res.headers.location), res.headers.location);
    assert.strictEqual(brain.getChild(kid.id).circle.week.skill, 'add2');
    res = await call('POST', `/circle/c/${teacher.token}/focus`, { code: 'OTHER1', skill: 'add2' }, { form: true });
    assert.ok(/Not%20your%20class/.test(res.headers.location));
    res = await call('POST', `/circle/c/${teacher.token}/family-code`, { child: kid.id }, { form: true });
    assert.ok(/Family%20code/.test(res.headers.location) && brain.getChild(kid.id).circle.link_code);
    assert.strictEqual((await call('GET', '/circle/c/AAAAAAAAAAAAAAAAAAAAAAAA')).status, 404);
    // the app's sync goes through CORS
    const pre = await call('OPTIONS', '/circle/sync');
    assert.strictEqual(pre.status, 204);
  } finally { server.close(); }
});

await test('messages: AiSensy sends when set up; otherwise ready to send by hand; quiet hours wait; a daily cap; a parent can stop them', async () => {
  const sent = [];
  const fake = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { sent.push(JSON.parse(b)); res.writeHead(200); res.end('{}'); }); });
  const port = await http0(fake);
  try {
    const env = Object.assign({}, ENV, { AISENSY_API_KEY: 'ak-1', AISENSY_API_URL: `http://127.0.0.1:${port}/send`, TAKHTI_MSG_DAILY: '2' });
    const brain = createBrain({ dataDir: tmp(), env });
    const school = brain.createSchool({ name: 'S' }).school;
    const kid = brain.registerChild({ name: 'Riya', age: 8, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
    const w = brain.circle.focusFor(brain.getChild(kid.id));
    const m1 = brain.messages.weekStart(brain.getChild(kid.id), w);
    assert.ok(m1 && /This week Riya works on/.test(m1.text) && /At home:/.test(m1.text));
    assert.strictEqual(brain.messages.weekStart(brain.getChild(kid.id), w), null, 'the same message twice');
    brain.messages.homeTeach(brain.getChild(kid.id), w);
    const third = brain.messages.queue({ kind: 'x', role: 'parent', to: { phone: kid.parent_phone }, child_id: kid.id, text: 'third', link: '' });
    assert.ok(new Date(third.send_after) - Date.now() > 20 * 3600e3, 'the daily cap let a third through today');
    const out = await brain.messages.flush();
    assert.strictEqual(out.length, 2);
    assert.strictEqual(sent.length, 2);
    assert.ok(sent[0].apiKey === 'ak-1' && sent[0].destination === kid.parent_phone.replace('+', '') && sent[0].templateParams.length === 2 && !/\n/.test(sent[0].templateParams[0]));
    const doItem = brain.getChild(kid.id).circle.week.home.find(h => h.kind === 'do');
    assert.ok(doItem.sent_at, 'a sent activity was not marked as reaching the family');
    // without AiSensy: ready, with a one-tap link
    const b2 = createBrain({ dataDir: tmp(), env: ENV });
    const s2 = b2.createSchool({ name: 'S' }).school;
    const k2 = b2.registerChild({ name: 'Om', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: s2.id }).child;
    b2.messages.weekStart(b2.getChild(k2.id), b2.circle.focusFor(b2.getChild(k2.id)));
    await b2.messages.flush();
    const r = b2.messages.list()[0];
    assert.ok(r.status === 'ready' && /^https:\/\/wa\.me\/\d+\?text=/.test(r.wa));
    // quiet hours: held until morning
    const b3 = createBrain({ dataDir: tmp(), env: Object.assign({}, ENV, { TAKHTI_QUIET_HOURS: '0-24' }) });
    const k3 = b3.registerChild({ name: 'Ira', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: b3.createSchool({ name: 'S' }).school.id }).child;
    const held = b3.messages.weekStart(b3.getChild(k3.id), b3.circle.focusFor(b3.getChild(k3.id)));
    assert.ok(new Date(held.send_after) > new Date(), 'sent in quiet hours');
    // a parent who stopped messages gets none
    const k4 = brain.registerChild({ name: 'Zoya', age: 8, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
    const z = brain.getChild(k4.id); brain.circle.ensure(z).messages_off = true; brain.store.put('children', z.id, z);
    brain.messages.weekStart(brain.getChild(k4.id), brain.circle.focusFor(brain.getChild(k4.id)));
    const before = sent.length;
    await brain.messages.flush();
    assert.strictEqual(sent.length, before, 'a message went to a parent who stopped them');
    assert.ok(brain.messages.list().some(m => m.child_id === k4.id && m.status === 'skipped'));
  } finally { fake.close(); }
});

await test('the circle\'s week in the scheduler: Monday focus to the parent, Wednesday home, the tutor\'s pack before the session, Saturday digest', async () => {
  const env = Object.assign({}, ENV, { TAKHTI_QUIET_HOURS: '22-6' });
  const brain = createBrain({ dataDir: tmp(), env });
  const school = brain.createSchool({ name: 'S' }).school;
  const teacher = brain.registerTeacher({ name: 'Sunita', phone: phone(), class_codes: ['CLS4D1'], school_id: school.id, lang: 'en' }).teacher;
  const kid = brain.registerChild({ name: 'Riya', age: 8, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const k = brain.getChild(kid.id); k.profile.classCode = 'CLS4D1'; brain.store.put('children', k.id, k);
  const inv = await brain.circle.inviteTutor(kid.id, { name: 'Mr Rao', phone: phone(), lang: 'en' }, 'parent');
  brain.circle.setTutorSchedule(brain.store.get('tutors', inv.tutor.id), [2], '17:00');
  const sch = createScheduler(brain, env);
  const IST = (d, t) => new Date(`${d}T${t}:00+05:30`);
  const kinds = () => brain.messages.list().map(m => m.kind);
  await sch.tick(IST('2027-01-04', '17:30'));                       // Monday evening
  assert.ok(kinds().includes('week_start'), kinds().join(','));
  await sch.tick(IST('2027-01-04', '17:45'));
  assert.strictEqual(kinds().filter(x => x === 'week_start').length, 1, 'week_start twice');
  await sch.tick(IST('2027-01-05', '16:20'));                       // Tuesday, 40 min before tuition
  assert.ok(kinds().includes('tutor_pack'), kinds().join(','));
  await sch.tick(IST('2027-01-06', '17:30'));                       // Wednesday evening
  assert.ok(kinds().includes('home_teach'));
  await sch.tick(IST('2027-01-09', '10:30'));                       // Saturday morning
  const dig = brain.messages.list().find(m => m.kind === 'teacher_digest');
  assert.ok(dig && dig.to.phone === teacher.phone && /Class CLS4D1 this week/.test(dig.text) && dig.link.endsWith(teacher.token), dig && dig.text);
  assert.ok(brain.messages.list().every(m => m.role !== 'child'), 'a message to a child');
});

console.log(results.join('\n'));
console.log(`\n${pass}/${pass + fail} circle checks passed`);
process.exit(fail ? 1 : 0);
})();
