#!/usr/bin/env node
/* ==================================================================
   TEACH MUNNI ON A PHONE CALL, AND AT HOME — run with: node test/voice-teach.test.js

   The explain-back loop reaches a child with no smartphone: at the end of
   a call Munni "forgets" up to two of the app's own aims (content/
   teach.js) and the child teaches them back out loud, through the app's
   own session (core/teachback.js) — hints, "later", never "wrong", never
   evidence of mastery. What was explained goes to the child's own record
   (profile.teach); the parent report says it kindly; a point already
   taught isn't asked again; and the circle's Wednesday "teach" activity
   asks the parent to put the same question, a point the child couldn't
   yet explain first.
   ================================================================== */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createBrain } = require('../voice/brain');

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push('  ok    ' + name); }
  catch (e) { fail++; results.push('  FAIL  ' + name + '\n        ' + (e && e.stack || e).toString().split('\n').slice(0, 12).join('\n        ')); }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-teach-call-'));
let n = 0;
const phone = () => '+9195100' + String(10000 + (n++)).padStart(5, '0');
const ENV = { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata', TAKHTI_PUBLIC_URL: 'https://takhti.example' };
const perfect = it => it.expect === 'yesno' ? (it.answer ? 'haan' : 'nahi') : it.expect === 'number' ? String(it.answer) : it.target;

function kid(brain, age, lang, hist) {
  const c = brain.registerChild({ name: 'Riya', age, lang, parent_phone: phone(), consent: true }).child;
  const fresh = brain.getChild(c.id);
  fresh.profile.skillHistory = Object.assign({}, fresh.profile.skillHistory, hist || {});
  brain.store.put('children', fresh.id, fresh);
  return fresh;
}
/* a whole call: sums and lines answered right, the teach item by `teachFn` */
function call(brain, childId, teachFn) {
  const { session, error } = brain.createSession(childId);
  if (error) throw new Error(error.join('; '));
  const says = [];
  let r = brain.toolNext(session.id); says.push(r.say);
  let before = null;
  for (let i = 0; i < 90 && !r.done; i++) {
    const s = brain.getSession(session.id), it = s.items[s.items.length - 1];
    if (it.kind === 'teach' && !before) before = JSON.stringify(brain.getChild(childId).profile.skillHistory);
    r = brain.toolAnswer(session.id, it.kind === 'teach' ? teachFn(it, says[says.length - 1]) : perfect(it));
    says.push(r.say);
  }
  const after = JSON.stringify(brain.getChild(childId).profile.skillHistory);   // before the transcript re-grades reading
  const s = brain.getSession(session.id);
  brain.onCallEvent({ id: 'ex-' + session.id, status: 'completed', transcript: s.live_turns.map(t => `${t.role}: ${t.text}`).join('\n'),
    conversation_duration: 300, telephony_data: {}, context_details: { recipient_data: { session_id: session.id } } }, ENV);
  return { s: brain.getSession(session.id), says, before, after, child: brain.getChild(childId) };
}

(async () => {

await test('a child who has practised carrying: the call ends with Teach Munni on two carrying points; none for 3–4', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const c = kid(brain, 8, 'en', { carry: { n: 5, right: 3 } });
  const s = brain.createSession(c.id).session;
  assert.strictEqual(s.slots[s.slots.length - 1], 'teach', s.slots.join(','));
  assert.strictEqual(s.teach_plan.skill, 'carry');
  assert.ok(s.teach_plan.aims.length >= 1 && s.teach_plan.aims.length <= 2 && s.teach_plan.aims.every(a => /^carry\./.test(a) && !/fix/.test(a)), JSON.stringify(s.teach_plan));
  const little = kid(brain, 4, 'hi', { add10: { n: 6, right: 4 } });
  assert.ok(!brain.createSession(little.id).session.slots.includes('teach'), 'Teach Munni for a 3–4 year old');
  const fresh = kid(brain, 8, 'en', {});
  assert.ok(!brain.createSession(fresh.id).session.slots.includes('teach'), 'a topic the child never practised');
  const early = kid(brain, 6, 'en', { carry: { n: 5, right: 3 } });
  assert.ok(!brain.createSession(early.id).session.slots.includes('teach'), "a 7–8 topic for a 5–6 year old");
});

await test('on the call: Munni forgets, a muddled answer gets her written hint, a real explanation gets thanks; never "wrong"; kept in profile.teach; not mastery evidence', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const c = kid(brain, 8, 'en', { carry: { n: 5, right: 3 } });
  const units = brain.core.T.TEACH_UNITS.carry.aims;
  let turn = 0;
  const { s, says, before, after, child } = call(brain, c.id, it => {
    turn++;
    if (turn === 1) return 'umm I am not sure about that';           // muddled: a hint
    return 'first you add the ones then you carry the ten to the tens, one more ten on top';
  });
  const it = s.items.find(x => x.kind === 'teach');
  assert.ok(it, 'no teach item');
  const first = units.find(a => a.id === s.teach_plan.aims[0]);
  const ask = says.find(x => x.includes(first.forget.en));
  assert.ok(ask && /forgot/i.test(ask), 'Munni forgets: ' + says.join(' | '));
  assert.ok(says.some(x => x.includes(first.hints[0].en)), 'her written hint after a muddled answer');
  assert.ok(says.every(x => !/\bwrong\b|\bfailed\b/i.test(x)), 'never "wrong"');
  assert.strictEqual(it.outcome, 'taught');
  assert.ok(it.teach_result && it.teach_result.m === s.teach_plan.aims.length && it.teach_result.covered >= 1, JSON.stringify(it.teach_result));
  const t = child.profile.teach;
  assert.ok(t && t.v === 1 && t.units.carry && Object.keys(t.units.carry.aims).length >= 1, JSON.stringify(t));
  assert.ok(Object.values(t.explained).every(v => /^[cpg]$/.test(v)));
  assert.strictEqual(after, before, 'explaining changed the skill history');
  assert.ok(/taught Munni/.test(s.report.text) && /adding with carrying/.test(s.report.text), s.report.text);
  assert.ok(!/wrong|failed/i.test(s.report.text));
});

await test('Hindi: Munni\'s lines and the report line in Hindi; a point not heard twice moves on without being counted', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const c = kid(brain, 8, 'hi', { borrow: { n: 6, right: 2 } });
  const { s, says, child } = call(brain, c.id, () => 'हाँ');    // one word: never enough to judge
  const it = s.items.find(x => x.kind === 'teach');
  assert.ok(it && it.teach_result, 'no teach result');
  assert.ok(says.some(x => /भूल/.test(x)), 'Munni forgets, in Hindi');
  assert.ok(says.some(x => x.includes('ठीक से सुनाई नहीं')), 'asked again when unsure');
  assert.ok(says.some(x => x.includes('अगली बात')), 'moved on after two');
  assert.strictEqual(it.teach_result.covered, 0);
  assert.ok(!Object.values(child.profile.teach.explained).includes('c'), 'nothing credited for "हाँ"');
  assert.ok(/मुन्नी को/.test(s.report.text) && /फिर पूछेगी/.test(s.report.text), s.report.text);
});

await test('a point taught on one call isn\'t asked on the next; the next point is', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const c = kid(brain, 8, 'en', { carry: { n: 5, right: 3 } });
  const T = brain.core.T;
  const all = T.TEACH_UNITS.carry.aims.filter(a => a.kind === 'explain');
  // a perfect teacher: every idea of every point, in one breath
  const words = all.map(a => a.ideas.map(i => i.words[0]).join(' ')).join(' and ');
  const one = call(brain, c.id, () => 'so ' + words);
  const covered = Object.entries(one.child.profile.teach.units.carry.aims).filter(([, v]) => v === 'covered').map(([k]) => k);
  assert.ok(covered.length >= 1, JSON.stringify(one.child.profile.teach));
  const s2 = brain.createSession(c.id).session;
  if (covered.length === all.length) assert.ok(!s2.slots.includes('teach'), 'asked again after everything was taught');
  else assert.ok(s2.teach_plan && s2.teach_plan.aims.every(a => !covered.includes(a)), JSON.stringify(s2.teach_plan));
});

await test('at home: the Wednesday "teach" activity puts Munni\'s own question, a clue and what a full answer says — a point the child couldn\'t explain first', async () => {
  const brain = createBrain({ dataDir: tmp(), env: ENV });
  const C = brain.circle, T = brain.core.T;
  const school = brain.createSchool({ name: 'S' }).school;
  const c = brain.registerChild({ name: 'Riya', age: 8, lang: 'hi', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const fresh = brain.getChild(c.id);
  fresh.focus = { skill: 'borrow', source: 'note', until: new Date(Date.now() + 7 * 864e5).toISOString() };
  // a call found the second borrowing point hard
  const aims = T.TEACH_UNITS.borrow.aims.filter(a => a.kind === 'explain');
  fresh.profile.teach = { v: 1, units: { borrow: { aims: { [aims[0].id]: 'covered', [aims[1].id]: 'gap' }, gaps: [aims[1].id] } }, log: [], explained: {} };
  brain.store.put('children', fresh.id, fresh);
  const w = C.focusFor(brain.getChild(c.id));
  assert.strictEqual(w.skill, 'borrow');
  const teach = w.home.find(h => h.kind === 'teach');
  assert.strictEqual(teach.aim, aims[1].id, 'the point still to explain comes first');
  assert.ok(teach.text.hi.includes(aims[1].forget.hi) && teach.text.hi.includes(aims[1].hints[0].hi) && teach.text.hi.includes('Riya'), teach.text.hi);
  assert.ok(teach.text.en.includes(aims[1].forget.en) && teach.text.en.includes(aims[1].ideas[0].en), teach.text.en);
  assert.ok(!/\{name\}/.test(teach.text.en + teach.text.hi));
  // a topic with no written points keeps the old activity
  const other = brain.registerChild({ name: 'Kabir', age: 8, lang: 'en', parent_phone: phone(), consent: true, school_id: school.id }).child;
  const o = brain.getChild(other.id);
  o.focus = { skill: 'tables', source: 'note', until: new Date(Date.now() + 7 * 864e5).toISOString() };
  brain.store.put('children', o.id, o);
  const w2 = C.focusFor(brain.getChild(o.id));
  const t2 = w2.home.find(h => h.kind === 'teach');
  assert.ok(!t2.aim && /Kabir/.test(t2.text.en), JSON.stringify(t2));
});

console.log(results.join('\n'));
console.log(`\n${pass}/${pass + fail} Teach Munni call-and-home checks passed`);
process.exit(fail ? 1 : 0);
})();
