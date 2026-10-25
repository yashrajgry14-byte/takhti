#!/usr/bin/env node
/* ==================================================================
   SCHOOLS — run with: node test/voice-school.test.js

   Separate school accounts (and their own Bolna sub-account keys), the
   placement call for new admissions, teacher voice notes, class-wide
   parent calls, and the misreading corpus — against the real engine and
   a stand-in Bolna on localhost.
   ================================================================== */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createBrain } = require('../voice/brain');
const { createServer } = require('../voice/server');
const { buildCorpus, corpusCsv, swapOf } = require('../voice/corpus');
const N = require('../voice/notes');
const PLC = require('../voice/placement');
const { agent } = require('../voice/agent/build-agent');

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push('  ok    ' + name); }
  catch (e) { fail++; results.push('  FAIL  ' + name + '\n        ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-school-test-'));
let n = 0;
const phone = () => '+9197000' + String(10000 + (n++)).padStart(5, '0');

async function fakeBolna() {
  const calls = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url === '/call') { calls.push({ auth: req.headers.authorization, body: JSON.parse(b) }); return res.end(JSON.stringify({ execution_id: 'ex-' + calls.length })); }
      res.end('{}');
    });
  });
  await new Promise(r => srv.listen(0, r));
  return { calls, base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}
function inClass(brain, child, code) {
  const c = brain.getChild(child.id); c.profile.classCode = code; brain.store.put('children', c.id, c); return c;
}
function history(brain, id, skill, n, right) {
  const c = brain.getChild(id); c.profile.skillHistory = Object.assign({}, c.profile.skillHistory, { [skill]: { n, right } }); brain.store.put('children', c.id, c);
}
function hangUp(brain, id, edit) {
  const s = brain.getSession(id) || brain.getTeacherCall(id) || brain.getParentCall(id);
  const lines = (s.greeting ? ['assistant: ' + s.greeting] : []).concat((s.live_turns || []).map(t => `${t.role}: ${edit && t.role === 'user' && edit[t.text] != null ? edit[t.text] : t.text}`));
  return brain.onCallEvent({ id: 'ex-' + id, status: 'completed', transcript: lines.join('\n'), conversation_duration: 300, telephony_data: {},
                             context_details: { recipient_data: { session_id: id } } });
}

(async () => {

/* ---------------- schools ---------------- */
await test('schools: each school\'s key sees only its own children and calls; its calls use its own Bolna sub-account', async () => {
  const fb = await fakeBolna();
  const brain = createBrain({ dataDir: tmp() });
  const env = { BOLNA_API_KEY: 'server-key', BOLNA_AGENT_ID: 'server-agent', BOLNA_API_BASE: fb.base, TAKHTI_QUIET_HOURS: '0-0' };
  const a = brain.createSchool({ name: 'Green Valley', contact: '+91 90000 11111', bolna: { api_key: 'gv-subaccount-key-1234', agent_id: 'gv-agent' } });
  const b = brain.createSchool({ name: 'Hill View' });
  assert.ok(a.key && a.school.id && !('key_hash' in a.school), 'key not handed out once');
  assert.strictEqual(a.school.bolna.api_key, '•••1234', 'a stored Bolna key was returned in full');
  assert.strictEqual(brain.schoolByKey(a.key).id, a.school.id);
  assert.strictEqual(brain.schoolByKey('nope'), null);
  const { server } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const call = (method, p, body, key) => new Promise((resolve, reject) => {
    const req = http.request({ port, path: p, method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}) }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: /^[\[{]/.test(d) ? JSON.parse(d) : d }));
    });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
  try {
    const ra = await call('POST', '/voice/admin/children', { name: 'Riya', age: 7, lang: 'hi', parent_phone: phone(), consent: true, school_id: b.school.id }, a.key);
    assert.strictEqual(ra.status, 201);
    assert.strictEqual(ra.body.child.school_id, a.school.id, 'a school registered a child into another school');
    const rb = await call('POST', '/voice/admin/children', { name: 'Om', age: 8, lang: 'en', parent_phone: phone(), consent: true }, b.key);
    const listA = await call('GET', '/voice/admin/children', null, a.key);
    assert.deepStrictEqual(listA.body.map(c => c.name), ['Riya']);
    assert.ok(!listA.body.some(c => 'profile' in c || 'app_key' in c));
    assert.strictEqual((await call('GET', `/voice/admin/children/${rb.body.child.id}/progress-code`, null, a.key)).status, 404, 'saw another school\'s child');
    assert.strictEqual((await call('POST', '/voice/admin/sessions', { child_id: rb.body.child.id }, a.key)).status, 404);
    assert.strictEqual((await call('GET', '/voice/admin/schools', null, a.key)).status, 404, 'a school listed schools');
    assert.strictEqual((await call('GET', '/voice/admin/schools', null, 'ak')).body.length, 2);
    assert.strictEqual((await call('GET', '/voice/admin/children', null, 'ak')).body.length, 2, 'the server key should see everything');
    const dashA = await call('GET', '/voice/admin?key=' + encodeURIComponent(a.key));
    assert.ok(/Green Valley/.test(dashA.body) && !/Om/.test(dashA.body.replace(/Omit|Om[a-z]/g, '')), 'dashboard leaked another school');
    // calls go out on the school's own sub-account
    const s = await call('POST', '/voice/admin/sessions', { child_id: ra.body.child.id, call: true }, a.key);
    assert.strictEqual(s.status, 201);
    assert.strictEqual(fb.calls[0].auth, 'Bearer gv-subaccount-key-1234');
    assert.strictEqual(fb.calls[0].body.agent_id, 'gv-agent');
    await call('POST', '/voice/admin/sessions', { child_id: rb.body.child.id, call: true }, b.key);
    assert.strictEqual(fb.calls[1].auth, 'Bearer server-key', 'a school without its own account should use the server\'s');
    // the school's inbound number only knows its own families
    const lk = brain.inboundLookup({ contact_number: rb.body.child.parent_phone, agent_id: 'gv-agent' }, { TAKHTI_QUIET_HOURS: '0-0' });
    assert.strictEqual(lk.registered, false, 'another school\'s family got a lesson on this school\'s line');
  } finally { server.close(); fb.close(); }
});

/* ---------------- the placement call ---------------- */
await test('placement: a binary search up the spoken ladder finds the boundary, tops it up to 4 attempts, reads, and sets the start', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Kabir', age: 8, lang: 'en', parent_phone: phone(), consent: true, placement: true }).child;
  assert.strictEqual(brain.nextKind(brain.getChild(c.id)), 'placement', 'a new admission should be placed first');
  assert.ok(brain.createSession(brain.registerChild({ name: 'Tiny', age: 4, lang: 'hi', parent_phone: phone(), consent: true }).child.id, { kind: 'placement' }).error);
  const { session } = brain.createSession(c.id, { kind: 'placement', seed: 'p1' });
  const ladder = session.place.ladder;
  assert.ok(ladder.includes('carry') && ladder.includes('borrow') && !ladder.includes('mult2x2'), 'ladder not fitted to the band: ' + ladder);
  assert.strictEqual(session.lines.length, session.line_levels.length);
  const knows = sk => ladder.indexOf(sk) <= ladder.indexOf('carry');
  const says = [];
  let r = brain.toolNext(session.id); says.push(r.say);
  assert.ok(/a little different/.test(r.say));
  for (let i = 0; i < 80 && !r.done; i++) {
    const s = brain.getSession(session.id);
    const it = s.items[s.items.length - 1];
    let said;
    if (it.expect === 'number') said = knows(it.skill) ? String(it.answer) : String(it.answer + 3);
    else said = it.level <= 3 ? it.target : 'um';                       // reads up to level 3
    r = brain.toolAnswer(session.id, said); says.push(r.say);
  }
  assert.ok(r.done, 'never ended');
  assert.ok(says.every(x => !/\bwrong\b/i.test(x)), 'said wrong');
  const s = brain.getSession(session.id);
  assert.ok(s.items.filter(x => x.kind === 'pmath').length <= 16, 'too many sums for one call');
  hangUp(brain, session.id);
  const k = brain.getChild(c.id);
  assert.strictEqual(k.placement.math.passed, 'carry');
  assert.strictEqual(k.placement.math.next, 'borrow');
  assert.strictEqual(k.profile.skillHistory.carry.n, 4, 'boundary not topped up to four attempts');
  assert.strictEqual(k.profile.skillHistory.carry.right, 4);
  assert.ok(k.profile.skillHistory.borrow.n >= 3 && k.profile.skillHistory.borrow.right === 0);
  assert.strictEqual(k.profile.levels.math, 4);
  assert.strictEqual(k.profile.levels.read, 3);
  assert.strictEqual(k.placement_due, false);
  const rep = brain.getSession(session.id).report;
  assert.ok(/can do carrying\. The next step is borrowing\./.test(rep.text), rep.text);
  assert.notStrictEqual(brain.nextKind(k), 'placement', 'placed twice');
});

await test('placement: a child who knows nothing yet starts at the bottom, kindly; "I don\'t know" is fine', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Asha', age: 6, lang: 'hi', parent_phone: phone(), consent: true }).child;
  const { session } = brain.createSession(c.id, { kind: 'placement', seed: 'p2' });
  let r = brain.toolNext(session.id); const says = [r.say];
  for (let i = 0; i < 60 && !r.done; i++) { const s = brain.getSession(session.id); const it = s.items[s.items.length - 1];
    r = brain.toolAnswer(session.id, it.expect === 'number' ? 'pata nahi' : 'hmm'); says.push(r.say); }
  assert.ok(says.some(x => /कोई बात नहीं/.test(x)));
  hangUp(brain, session.id);
  const k = brain.getChild(c.id);
  assert.strictEqual(k.placement.math.passed, null);
  assert.ok(/की शुरुआत .* से होगी/.test(brain.getSession(session.id).report.text), brain.getSession(session.id).report.text);
});

/* ---------------- teacher voice notes ---------------- */
await test('teacher notes: the line knows a teacher; a note is read back, saved on yes, and becomes evidence and focus', () => {
  const brain = createBrain({ dataDir: tmp() });
  const riya = inClass(brain, brain.registerChild({ name: 'Riya', age: 7, lang: 'hi', parent_phone: phone(), consent: true }).child, '1B');
  const aman = inClass(brain, brain.registerChild({ name: 'Aman', age: 8, lang: 'hi', parent_phone: phone(), consent: true }).child, '1B');
  const other = brain.registerChild({ name: 'Meera', age: 7, lang: 'hi', parent_phone: phone(), consent: true }).child;   // not in the class
  const t = brain.registerTeacher({ name: 'Sunita', phone: phone(), class_codes: ['1b'], lang: 'hi' }).teacher;
  const lk = brain.inboundLookup({ contact_number: t.phone }, { TAKHTI_QUIET_HOURS: '0-24' });
  assert.ok(lk.allowed && lk.caller_kind === 'teacher' && /Sunita/.test(lk.greeting), 'teacher not recognised (or turned away in quiet hours)');
  const id = lk.session_id;
  let r = brain.toolNote(id, 'Riya ne aaj ण और न mein galti ki');
  assert.ok(/Riya/.test(r.say) && /ण और न/.test(r.say) && /सेव/.test(r.say), r.say);
  r = brain.toolNote(id, 'haan');
  assert.ok(/सेव हो गया/.test(r.say) && /अगली कॉल्स/.test(r.say), r.say);
  let k = brain.getChild(riya.id);
  assert.deepStrictEqual(k.profile.skillHistory.read2, { n: 1, right: 0 });
  assert.deepStrictEqual(k.focus_letters.letters, ['ण', 'न']);
  assert.strictEqual(k.teacher_notes[0].by, 'Sunita');
  // a sum Munni can ask becomes what the next call practises
  r = brain.toolNote(id, 'Aman ko hasil wale jod mein dikkat hai');
  assert.ok(/Aman/.test(r.say) && /हासिल/.test(r.say), r.say);
  brain.toolNote(id, 'haan ji');
  k = brain.getChild(aman.id);
  assert.strictEqual(k.focus.skill, 'carry');
  const next = brain.createSession(aman.id).session;
  assert.strictEqual(next.homework_skill, 'carry');
  assert.strictEqual(next.focus_source, 'teacher note');
  let x = brain.toolNext(next.id);
  for (let i = 0; i < 60 && !x.done; i++) { const s = brain.getSession(next.id); const it = s.items[s.items.length - 1];
    if (it.kind === 'homework') { assert.ok(/टीचर ने मुन्नी से/.test(it.prompts[0]), it.prompts[0]); break; }
    x = brain.toolAnswer(next.id, it.expect === 'yesno' ? (it.answer ? 'haan' : 'nahi') : it.expect === 'number' ? String(it.answer) : it.target); }
  // a child outside the teacher's classes can't be noted, and a "no" saves nothing
  r = brain.toolNote(id, 'Meera padhne mein kamzor hai');
  assert.ok(/कौन सा बच्चा|नहीं मिला/.test(r.say), r.say);
  assert.strictEqual((brain.getChild(other.id).teacher_notes || []).length, 0);
  r = brain.toolNote(id, 'Meera');
  r = brain.toolNote(id, 'Meera');
  assert.ok(/सेव नहीं/.test(r.say), r.say);
  r = brain.toolNote(id, 'Riya read very well today');
  r = brain.toolNote(id, 'nahi');
  assert.ok(/फिर से बताइए/.test(r.say));
  r = brain.toolNote(id, 'bas, dhanyavad');
  assert.ok(r.done && /Sunita/.test(r.say));
  hangUp(brain, id);
  const call = brain.getTeacherCall(id);
  assert.strictEqual(call.notes.length, 2);
  assert.ok(call.notes.every(x => x.heard_in_transcript === true));
});

await test('teacher notes: two children with one name are asked apart; a good note is evidence without focus; English and levels', () => {
  const brain = createBrain({ dataDir: tmp() });
  const r1 = inClass(brain, brain.registerChild({ name: 'Riya', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child, '2A');
  inClass(brain, brain.registerChild({ name: 'Riya', age: 8, lang: 'en', parent_phone: phone(), consent: true }).child, '2A');
  const dev = inClass(brain, brain.registerChild({ name: 'Dev', age: 9, lang: 'en', parent_phone: phone(), consent: true }).child, '2A');
  const t = brain.registerTeacher({ name: 'Mr Rao', phone: phone(), class_codes: ['2A'], lang: 'en' }).teacher;
  const id = brain.inboundLookup({ contact_number: t.phone }, {}).session_id;
  let r = brain.toolNote(id, 'Riya mixes up b and d');
  assert.ok(/more than one child/.test(r.say), r.say);
  assert.strictEqual(N.childOf('Riya', [r1]).id, r1.id);
  r = brain.toolNote(id, 'Dev did really well at times tables today');
  assert.ok(/Dev did well at times tables/.test(r.say), r.say);
  brain.toolNote(id, 'yes');
  const k = brain.getChild(dev.id);
  assert.deepStrictEqual(k.profile.skillHistory.tables, { n: 1, right: 1 });
  assert.ok(!k.focus, 'a good note set a focus');
  assert.strictEqual(N.skillOf('addition', { age: 6 }), 'add10');
  assert.strictEqual(N.skillOf('addition', { age: 9 }), 'add2');
  assert.strictEqual(N.polarityOf('found it hard'), false);
  assert.strictEqual(N.polarityOf('great work'), true);
  assert.deepStrictEqual(N.lettersOf('b and d'), ['b', 'd']);
});

/* ---------------- class-wide parent calls ---------------- */
await test('class calls: the shared gap, one message per family with where their own child stands, never twice a day, never in quiet hours', async () => {
  const fb = await fakeBolna();
  const brain = createBrain({ dataDir: tmp() });
  const env = { BOLNA_API_KEY: 'k', BOLNA_PARENT_AGENT_ID: 'parent-agent', BOLNA_API_BASE: fb.base, TAKHTI_QUIET_HOURS: '0-0' };
  try {
    const a = inClass(brain, brain.registerChild({ name: 'Riya', age: 7, lang: 'hi', parent_phone: phone(), consent: true }).child, '3C');
    const b = inClass(brain, brain.registerChild({ name: 'Aman', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child, '3C');
    const c = inClass(brain, brain.registerChild({ name: 'Zoya', age: 7, lang: 'hi', parent_phone: phone(), consent: true }).child, '3C');
    const d = inClass(brain, brain.registerChild({ name: 'Ira', age: 7, lang: 'hi', parent_phone: phone(), consent: 'call' }).child, '3C');
    history(brain, a.id, 'carry', 5, 1); history(brain, b.id, 'carry', 6, 2); history(brain, c.id, 'carry', 5, 5);
    const sum = brain.classSummary('3c', null, true);
    assert.strictEqual(sum.gaps[0].skill, 'carry');
    assert.strictEqual(sum.children.length, 4);
    assert.ok((await brain.classParentCalls('3C', {}, Object.assign({}, env, { TAKHTI_QUIET_HOURS: '0-24' }))).error, 'called in quiet hours');
    const r = await brain.classParentCalls('3C', { teacher: 'Sunita', note: 'Please practise at home' }, env);
    assert.strictEqual(r.skill, 'carry');
    assert.deepStrictEqual(r.placed.map(x => x.child).sort(), ['Aman', 'Riya', 'Zoya']);
    assert.deepStrictEqual(r.skipped, [{ child: 'Ira', why: 'no consent' }]);
    assert.ok(fb.calls.every(x => x.body.agent_id === 'parent-agent' && x.body.user_data.call_kind === 'class'));
    const msgs = Object.fromEntries(r.placed.map(x => [x.child, brain.getParentCall(x.session_id).summary]));
    assert.ok(/Sunita जी/.test(msgs.Riya) && /हासिल/.test(msgs.Riya) && /का भी इस पर अभ्यास/.test(msgs.Riya) && /घर पर/.test(msgs.Riya), msgs.Riya);
    assert.ok(/already doing well/.test(msgs.Aman) === false && /still working on this/.test(msgs.Aman) && /Munni will practise it/.test(msgs.Aman), msgs.Aman);
    assert.ok(/पहले से अच्छा/.test(msgs.Zoya) && !/घर पर:/.test(msgs.Zoya), msgs.Zoya);
    assert.strictEqual(brain.getChild(a.id).focus.skill, 'carry');
    const again = await brain.classParentCalls('3C', {}, env);
    assert.strictEqual(again.placed.length, 0, 'a family called twice in a day');
    // the call itself: the message, then questions like the weekly call
    const out = brain.toolParent(r.placed.find(x => x.child === 'Aman').session_id, 'yes');
    assert.ok(/several children in Aman's class/.test(out.say) && /What would you like to know\?/.test(out.say), out.say);
    assert.ok((await brain.classParentCalls('9Z', {}, env)).error);
  } finally { fb.close(); }
});

/* ---------------- the misreading corpus ---------------- */
await test('corpus: only children whose parents said yes; no names or ids; heard forms only from K+ children; letter swaps', () => {
  const brain = createBrain({ dataDir: tmp() });
  const env = { TAKHTI_CORPUS_MIN_CHILDREN: '2' };
  const kids = ['Riya', 'Aman', 'Zoya'].map((nm, i) => brain.registerChild({ name: nm, age: 7, lang: 'hi', parent_phone: phone(), consent: true, consent_research: i < 2 }).child);
  // every child misreads the same word the same way: one grapheme swapped
  let target = null, swapped = null;
  for (const c of kids) {
    const { session } = brain.createSession(c.id, { seed: 'same-card' });
    let r = brain.toolNext(session.id);
    for (let i = 0; i < 80 && !r.done; i++) {
      const s = brain.getSession(session.id); const it = s.items[s.items.length - 1];
      let said;
      if (it.expect === 'reading') {
        const words = it.target.replace(/[।.!?]/g, '').split(/\s+/);
        const w = words.find(x => [...new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(x)].length >= 3) || words[0];
        const g = [...new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(w)].map(x => x.segment);
        const repl = g[0] === 'न' ? 'म' : 'न';
        const bad = [repl].concat(g.slice(1)).join('');
        if (it.line_no === 1) { target = target || w; swapped = swapped || bad; }
        said = it.line_no === 1 ? it.target.replace(w, bad) : it.target;
      } else said = it.expect === 'yesno' ? (it.answer ? 'haan' : 'nahi') : String(it.answer);
      r = brain.toolAnswer(session.id, said);
    }
    hangUp(brain, session.id);
  }
  const corpus = buildCorpus(brain, env);
  assert.strictEqual(corpus.children, 2, 'a child without research consent was included');
  const json = JSON.stringify(corpus);
  for (const c of kids) { assert.ok(!json.includes(c.name), 'a name leaked'); assert.ok(!json.includes(c.id), 'an id leaked'); }
  const row = corpus.words.find(w => w.word === target);
  assert.ok(row && row.attempts === 2 && row.children === 2, JSON.stringify(row));
  assert.ok(row.heard.some(h => h.form === swapped && h.children === 2), JSON.stringify(row.heard));
  assert.ok(corpus.swaps.length >= 1 && corpus.swaps[0].children >= 2);
  // with a higher bar the heard form is withheld
  const strict = buildCorpus(brain, { TAKHTI_CORPUS_MIN_CHILDREN: '3' });
  assert.ok(strict.words.find(w => w.word === target).heard.length === 0 && strict.swaps.length === 0);
  assert.ok(/^lang,word,bands,attempts/.test(corpusCsv(corpus)));
  assert.deepStrictEqual(swapOf('पानी', 'मानी'), { from: 'प', to: 'म' });
  assert.deepStrictEqual(swapOf('पानी', 'पान'), { from: 'नी', to: 'न' }, 'a dropped matra');
  assert.strictEqual(swapOf('पानी', 'दाल'), null);
});

await test('child agent graph: a teacher node with its own tool; caller_kind declared; every edge lands', () => {
  const llm = agent.agent_config.tasks[0].tools_config.llm_agent.llm_config;
  const ids = new Set(llm.nodes.map(x => x.id));
  for (const nd of llm.nodes) for (const e of nd.edges) assert.ok(ids.has(e.to_node_id), e.to_node_id);
  const teacher = llm.nodes.find(x => x.id === 'teacher');
  assert.ok(teacher && teacher.function_call === 'takhti_note');
  assert.strictEqual(llm.variable_types.caller_kind, 'string');
  assert.ok(llm.nodes.find(x => x.id === 'start').edges.some(e => e.to_node_id === 'teacher' && e.parameters && e.parameters.teacher_said));
  assert.ok(PLC.LADDER.length > 10 && Object.values(PLC.PL).every(v => Array.isArray(v) ? v.every(x => x.hi && x.en) : v.hi && v.en));
});

console.log(results.join('\n'));
console.log(`\n${pass}/${pass + fail} school checks passed`);
process.exit(fail ? 1 : 0);
})();
