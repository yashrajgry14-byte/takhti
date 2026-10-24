#!/usr/bin/env node
/* ==================================================================
   VOICE CHANNEL TESTS — run with: node test/voice.test.js

   Exercises the phone channel against the REAL engine (the brain loads
   src/core/*.js through vm, same as the other suites): number
   understanding, the session rules from voice/session.js's header, the
   post-call transcript check, the HTTP surface, and the Bolna graph.
   ================================================================== */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const http = require('http');

const U = require('../voice/understand');
const S = require('../voice/session');
const { createBrain } = require('../voice/brain');
const { createServer } = require('../voice/server');
const { agent, nodes, tools } = require('../voice/agent/build-agent');

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push('  ok    ' + name); }
  catch (e) { fail++; results.push('  FAIL  ' + name + '\n        ' + (e && e.message || e)); }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-voice-test-'));
const brain = createBrain({ dataDir: tmp() });
const kid = (age, lang, name) => brain.registerChild({ name: name || 'Riya', age, lang, parent_phone: '+919800000000', consent: true }).child;

/* drive one session with a scripted child; answerFn(item, session) → words */
function run(child, answerFn, seed) {
  const { session } = brain.createSession(child.id, { seed });
  const says = [];
  let r = brain.toolNext(session.id); says.push(r.say);
  for (let i = 0; i < 80 && !r.done; i++) {
    const s = brain.getSession(session.id);
    const it = s.items[s.items.length - 1];
    r = brain.toolAnswer(session.id, answerFn(it, s, i));
    says.push(r.say);
  }
  return { id: session.id, says, last: r, s: brain.getSession(session.id), child: brain.getChild(child.id) };
}
const perfect = it => it.expect === 'yesno' ? (it.answer ? 'yes' : 'no') : it.expect === 'number' ? String(it.answer) : it.target;

(async () => {

/* ---------------- understanding numbers ---------------- */
await test('numbers: digits, Devanagari digits, English, Hindi, Hinglish, compounds', () => {
  const table = [
    ['9', 'en', 9], ['९', 'hi', 9], ['nine', 'en', 9], ['नौ', 'hi', 9], ['nau', 'hi', 9],
    ['it is nine', 'en', 9], ['नौ है', 'hi', 9], ['twenty three', 'en', 23], ['twenty-three', 'en', 23],
    ['one hundred and five', 'en', 105], ['a hundred', 'en', 100], ['एक सौ पाँच', 'hi', 105],
    ['पांच', 'hi', 5], ['चौतीस', 'hi', 34], ['छः', 'hi', 6], ['saat', 'hi', 7], ['saath', 'hi', 60],
    ['do sau', 'hi', 200], ['मुझे लगता है सत्ताईस', 'hi', 27], ['अट्ठाइस', 'hi', 28], ['ninety nine', 'en', 99],
    ['tree', 'en', 3], ['for', 'en', 4], ['0', 'en', 0], ['शून्य', 'hi', 0]
  ];
  for (const [s, l, want] of table) assert.strictEqual(U.parseNumber(s, l), want, `"${s}" should be ${want}, got ${U.parseNumber(s, l)}`);
});
await test('numbers: the last number wins (children self-correct out loud)', () => {
  assert.strictEqual(U.parseNumber('eight no nine', 'en'), 9);
  assert.strictEqual(U.parseNumber('4 and 3 makes 7', 'en'), 7);
});
await test('numbers: no number → null, never a guess', () => {
  for (const s of ['', 'hello', 'I do not know', 'मुझे नहीं पता']) assert.strictEqual(U.parseNumber(s, 'en'), null, s);
});
await test('numbers: every Hindi word Munni speaks for 0–1000 parses back to itself', () => {
  for (let n = 0; n <= 1000; n++) assert.strictEqual(U.parseNumber(U.numberWord(n, 'hi'), 'hi'), n, `${n} → "${U.numberWord(n, 'hi')}"`);
});
await test('numbers: no Hindi spelling maps to two different values after folding', () => {
  const seen = new Map();
  for (const row of U.HI_TABLE) {
    let roman = false;
    for (const w of row.slice(1)) {
      if (w === '|') { roman = true; continue; }
      const k = (roman ? 'R:' + U.foldRoman(w) : 'D:' + U.foldDev(w));
      assert.ok(!seen.has(k) || seen.get(k) === row[0], `${w} collides: ${seen.get(k)} vs ${row[0]}`);
      seen.set(k, row[0]);
    }
  }
});
await test('intents: repeat / don\'t know / stop, and Devanagari word edges', () => {
  const want = { 'phir se bolo': 'repeat', 'फिर से': 'repeat', 'क्या?': 'repeat', 'say it again': 'repeat',
    'pata nahi': 'dontKnow', 'नहीं पता': 'dontKnow', "I don't know": 'dontKnow',
    'bas': 'stop', 'बस': 'stop', 'बस करो': 'stop', 'I want to stop': 'stop',
    'बस्ता है': 'answer', 'seven': 'answer', 'again 7': 'answer', '': 'silence' };
  for (const [s, i] of Object.entries(want)) assert.strictEqual(U.intentOf(s), i, `"${s}" → ${U.intentOf(s)}, want ${i}`);
});

/* ---------------- content ---------------- */
await test('every Munni line exists in Hindi and English with the same placeholders', () => {
  const ph = s => [...new Set(s.match(/\{[a-z]+\}/g) || [])].sort().join();
  const check = (o, where) => {
    assert.ok(o.en && o.hi, where + ' is not bilingual');
    if (typeof o.en === 'string') assert.strictEqual(ph(o.en), ph(o.hi), where + ' placeholders differ');
  };
  for (const [k, v] of Object.entries(S.L)) {
    if (Array.isArray(v)) v.forEach((x, i) => check(x, `L.${k}[${i}]`));
    else check(v, 'L.' + k);
  }
  for (const [k, v] of Object.entries(S.STORY)) check(v.q, 'STORY.' + k);
});
await test('Munni never says "wrong"', () => {
  const all = JSON.stringify(S.L) + JSON.stringify(S.STORY);
  for (const w of ['wrong', 'Wrong', 'गलत', 'ग़लत', 'incorrect']) assert.ok(!all.includes(w), 'found ' + w);
});
await test('story bank: every problem passed validateLesson and its spoken answer matches the lesson', () => {
  const { out } = brain.core.withChild(brain.core.freshProfile('x', 7), {}, T => S.buildStoryBank(T));
  assert.strictEqual(out.dropped.length, 0, 'dropped: ' + out.dropped.slice(0, 3).join('; '));
  for (const b of ['pre', 'early', 'developing', 'fluent']) assert.ok(out.bank.some(x => x.band === b), 'no story problems for ' + b);
});

/* ---------------- the session rules ---------------- */
await test('a whole call, every band and both languages, ends on its own', () => {
  for (const [age, lang] of [[4, 'hi'], [5, 'en'], [7, 'hi'], [9, 'en'], [10, 'hi']]) {
    const r = run(kid(age, lang), perfect, 'all-' + age + lang);
    assert.ok(r.last.done, `age ${age} ${lang} did not finish`);
    assert.strictEqual(r.s.items.length, r.s.slots.length, 'not every slot was served');
    assert.ok(r.s.items.every(i => i.outcome === 'correct'), 'a perfect child got: ' + r.s.items.map(i => i.outcome));
    assert.strictEqual(r.s.ended_by, 'plan');
  }
});
await test('a 3–4 year old is never asked to read; they say lines after Munni', () => {
  const r = run(kid(4, 'hi'), perfect, 'pre');
  assert.ok(!r.s.items.some(i => i.kind === 'read'));
  assert.ok(r.s.items.some(i => i.kind === 'repeat'));
});
await test('first miss → two-choice clue with the answer in it; second → kind reveal; only first tries count', () => {
  const c = kid(7, 'en');
  const before = JSON.parse(JSON.stringify(c.profile));
  const r = run(c, (it) => it.expect === 'number' && it.kind === 'math' ? String(it.answer + 2) : perfect(it), 'miss');
  const math = r.s.items.filter(i => i.kind === 'math');
  assert.ok(math.length && math.every(i => i.outcome === 'revealed'));
  const clue = r.says.find(x => x.startsWith("Let's think again"));
  assert.ok(clue && /Is it \d+ or \d+\?/.test(clue), 'no two-choice clue');
  assert.ok(r.says.some(x => /The answer is \d+\./.test(x)), 'no reveal');
  // two attempts per sum, but ONE record per sum
  const recorded = r.child.profile.attempts.math - before.attempts.math;
  const sums = r.s.items.filter(i => i.kind === 'math' || i.kind === 'story').length;
  assert.strictEqual(recorded, sums, `recorded ${recorded} attempts for ${sums} sums`);
});
await test('a clue that is then answered right does not count as mastery', () => {
  const c = kid(7, 'en');
  const before = c.profile.correct.math;
  const r = run(c, (it) => it.expect === 'number' && it.kind === 'math' && it.attempts === 0 ? String(it.answer + 1) : perfect(it), 'clue');
  assert.ok(r.s.items.filter(i => i.kind === 'math').every(i => i.outcome === 'correct_after_clue'));
  const storyRight = r.s.items.filter(i => i.kind === 'story' && i.outcome === 'correct').length;
  assert.strictEqual(r.child.profile.correct.math - before, storyRight, 'a clued answer was counted as correct');
});
await test('doubt is not a miss: no number twice → move on, nothing recorded', () => {
  const c = kid(7, 'hi');
  const before = c.profile.attempts.math;
  const r = run(c, (it) => it.expect === 'number' ? 'उम्म' : perfect(it), 'unsure');
  const sums = r.s.items.filter(i => i.kind === 'math' || i.kind === 'story');
  assert.ok(sums.every(i => i.outcome === 'unsure'), sums.map(i => i.outcome).join());
  assert.strictEqual(r.child.profile.attempts.math, before, 'an unheard answer was recorded');
});
await test('"phir se" repeats the question without using up a try', () => {
  const c = kid(7, 'hi');
  const { session } = brain.createSession(c.id, { seed: 'rep' });
  const a = brain.toolNext(session.id).say;
  const b = brain.toolAnswer(session.id, 'phir se bolo').say;
  assert.ok(a.endsWith(b), 'repeat did not replay the question');
  const it = brain.getSession(session.id).items[0];
  assert.strictEqual(it.attempts, 0);
});
await test('takhti_next is idempotent: a confused model cannot skip a question', () => {
  const c = kid(9, 'en');
  const { session } = brain.createSession(c.id, { seed: 'idem' });
  brain.toolNext(session.id);
  const one = brain.toolNext(session.id), two = brain.toolNext(session.id);
  assert.strictEqual(one.say, two.say);
  assert.strictEqual(brain.getSession(session.id).items.length, 1);
});
await test('"bas" ends the lesson kindly, at once', () => {
  const r = run(kid(7, 'hi'), (it, s, i) => i === 1 ? 'bas' : perfect(it), 'stop');
  assert.ok(r.last.done);
  assert.strictEqual(r.s.ended_by, 'stop');
  assert.ok(r.last.say.includes('रुकते हैं'));
});
await test('no card at home → the reading line becomes say-after-me', () => {
  const r = run(kid(7, 'en'), (it) => it.kind === 'read' && !it.said.length ? "I don't have the card" : perfect(it), 'nocard');
  const reads = r.s.items.filter(i => i.no_card);
  assert.ok(reads.length >= 1, 'no item switched to say-after-me');
  assert.ok(reads.every(i => i.kind === 'repeat'));
  assert.ok(r.says.some(x => x.startsWith('No problem! Say it after me:')));
});
await test('a card line that contains "फिर से" or "नहीं है" is graded as reading, not as an intent', () => {
  const c = kid(7, 'hi');
  const { session } = brain.createSession(c.id, { seed: 'intent-line' });
  const s = brain.getSession(session.id);
  s.lines = ['मेरे पास बस्ता नहीं है।', 'फिर से बारिश हुई।', 'बस आ गई।'];
  brain.store.put('sessions', s.id, s);
  let r = brain.toolNext(session.id);
  for (let i = 0; i < 30 && !r.done; i++) {
    const cur = brain.getSession(session.id), it = cur.items[cur.items.length - 1];
    r = brain.toolAnswer(session.id, perfect(it));
  }
  const reads = brain.getSession(session.id).items.filter(i => i.kind === 'read');
  assert.strictEqual(reads.length, 3);
  assert.ok(reads.every(i => i.outcome === 'correct'), reads.map(i => i.target + ':' + i.outcome).join(' | '));
});
await test('levels stay inside the age band over many calls (age is the ceiling and the floor)', () => {
  const top = kid(5, 'en', 'Top'), low = kid(5, 'en', 'Low');
  for (let k = 0; k < 12; k++) {
    run(top, perfect, 'top' + k);
    run(low, it => it.expect === 'number' ? String(it.answer + 3) : it.expect === 'yesno' ? 'maybe' : 'blah blah', 'low' + k);
  }
  const t = brain.getChild(top.id).profile.levels.math, l = brain.getChild(low.id).profile.levels.math;
  assert.strictEqual(t, 3, 'early band math ceiling is 3, got ' + t);
  assert.strictEqual(l, 1, 'early band math floor is 1, got ' + l);
});
await test('the call is capped however it goes', () => {
  const c = kid(7, 'en');
  const { session } = brain.createSession(c.id, { seed: 'cap' });
  brain.toolNext(session.id);
  let r;
  for (let i = 0; i <= S.MAX_TURNS + 2; i++) { r = brain.toolAnswer(session.id, 'phir se'); if (r.done) break; }
  assert.ok(r.done, 'never ended');
});

/* ---------------- after the call ---------------- */
function webhook(sessionId, transcript, extra) {
  return brain.onCallEvent(Object.assign({ id: 'ex-' + sessionId, status: 'completed', transcript, conversation_duration: 300,
    context_details: { recipient_data: { session_id: sessionId } } }, extra || {}));
}
await test('post-call: reading is graded from Bolna\'s transcript, and relay drift is caught', () => {
  const c = kid(9, 'en');
  const r = run(c, perfect, 'drift');           // the relay says every line was read perfectly...
  const s = brain.getSession(r.id);
  const lines = [];
  for (const t of s.live_turns) {
    let text = t.text;
    // ...but the recognizer heard the child skip words on the first card line
    if (t.role === 'user' && text === s.lines[0]) text = s.lines[0].split(' ').slice(0, 2).join(' ');
    lines.push(`${t.role}: ${text}`);
  }
  const before = r.child.profile.attempts.read;
  const out = webhook(r.id, lines.join('\n'));
  assert.ok(out.ok && out.status === 'done', JSON.stringify(out));
  const done = brain.getSession(r.id);
  assert.ok(done.relay.mismatched >= 1, 'drift not detected: ' + JSON.stringify(done.relay));
  const first = done.items.find(i => i.kind === 'read' && i.line_no === 1);
  assert.strictEqual(first.evidence.source, 'transcript');
  assert.notStrictEqual(first.evidence.first_verdict, 'pass', 'graded the relay, not the transcript');
  assert.ok(brain.getChild(c.id).profile.attempts.read >= before, 'reading not recorded');
  assert.ok(done.report && done.report.text.length > 20);
});
await test('post-call: processing is idempotent (Bolna may POST the same call twice)', () => {
  const r = run(kid(7, 'en'), perfect, 'idem-hook');
  const tx = brain.getSession(r.id).live_turns.map(t => `${t.role}: ${t.text}`).join('\n');
  webhook(r.id, tx);
  const reads = brain.getChild(r.child.id).profile.attempts.read;
  const again = webhook(r.id, tx);
  assert.strictEqual(again.changed, false);
  assert.strictEqual(brain.getChild(r.child.id).profile.attempts.read, reads);
});
await test('post-call: an unanswered call records nothing and tells the parent gently', () => {
  const c = kid(7, 'hi');
  const { session } = brain.createSession(c.id, { seed: 'missed' });
  const before = JSON.stringify(brain.getChild(c.id).profile);
  const out = webhook(session.id, '', { status: 'no-answer', conversation_duration: 0 });
  assert.strictEqual(out.status, 'missed');
  assert.strictEqual(JSON.stringify(brain.getChild(c.id).profile), before);
  assert.ok(brain.getSession(session.id).report.text.includes('मुन्नी'));
});
await test('post-call: a safeguarding extraction flags the session for a human, and stays out of the parent report', () => {
  const r = run(kid(7, 'en'), perfect, 'safe');
  webhook(r.id, '', { extracted_data: { Safety: { safeguarding_concern: { objective: 'yes' } } } });
  const s = brain.getSession(r.id);
  assert.strictEqual(s.flags.safeguarding, true);
  assert.ok(!/safeguard|concern/i.test(s.report.text));
});
await test('words to practise: a child who stopped early is not told to drill words they never reached', () => {
  const c = kid(7, 'hi');
  const { session } = brain.createSession(c.id, { seed: 'stop-early' });
  const s0 = brain.getSession(session.id);
  s0.lines = ['नदी में नाव चलती है।', 'गाय हमें दूध देती है।', 'बच्चे खेल रहे हैं।'];
  brain.store.put('sessions', s0.id, s0);
  let r = brain.toolNext(session.id);
  for (let i = 0; i < 30 && !r.done; i++) {
    const cur = brain.getSession(session.id), it = cur.items[cur.items.length - 1];
    const said = it.line_no === 1 && it.attempts === 0 ? 'नदी में' : perfect(it);
    r = brain.toolAnswer(session.id, said);
  }
  webhook(session.id, brain.getSession(session.id).live_turns.map(t => `${t.role}: ${t.text}`).join('\n'));
  const line1 = brain.getSession(session.id).items.find(i => i.line_no === 1);
  for (const w of ['नाव', 'चलती', 'है।']) assert.ok(!line1.evidence.misread.includes(w), 'listed unreached word ' + w);
});
await test('the parent report leads with what went well and never says "wrong" or "failed"', () => {
  const r = run(kid(7, 'en'), (it) => it.expect === 'number' ? String(it.answer + 1) : perfect(it), 'report');
  webhook(r.id, brain.getSession(r.id).live_turns.map(t => `${t.role}: ${t.text}`).join('\n'));
  const text = brain.getSession(r.id).report.text;
  assert.ok(/practised with Munni/.test(text.split('\n')[0]));
  assert.ok(!/wrong|fail|missed|bad/i.test(text), text);
});
await test('consent is required, and erasure removes the child and every session', () => {
  assert.ok(brain.registerChild({ name: 'A', age: 6, lang: 'hi', parent_phone: '+919800000000' }).error);
  const c = kid(6, 'hi', 'Erase');
  const { session } = brain.createSession(c.id);
  assert.ok(brain.deleteChild(c.id));
  assert.strictEqual(brain.getChild(c.id), null);
  assert.strictEqual(brain.getSession(session.id), null);
});

/* ---------------- the skill graph, homework, SRS, the teacher ---------------- */
/* A teacher's phone: the real app code in its own vm with its own storage,
   the same way test/class-share.test.js stands up two phones. */
function teacherPhone() {
  const data = {};
  const ctx = { console, Intl, setTimeout, clearTimeout, TextEncoder, TextDecoder, btoa, atob, Uint8Array,
    localStorage: { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    S: { lang: 'en', age: 8, day: 0, skillHistory: {}, classCode: null, game: 'cricket' } };
  vm.createContext(ctx);
  for (const f of ['src/core/matcher.js', 'src/core/readability.js', 'src/content/sentences.js', 'src/content/games.js',
    'src/content/themes.js', 'src/content/facts.js', 'src/content/ages.js', 'src/core/daily-engine.js', 'src/content/skills.js',
    'src/content/curriculum-early.js', 'src/content/lessons.js', 'src/core/lesson-gen.js', 'src/content/literacy.js',
    'src/content/comprehension.js', 'src/core/diagnose.js', 'src/core/class-share.js', 'src/core/mathgen.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
  vm.runInContext('globalThis.__ = { assignHomework, homeworkCode, importClassReport, readClassShared, tDiagnose };', ctx);
  return ctx.__;
}

await test('phone maths is tagged with the skill it really exercised (the diagnostic sees it)', () => {
  const r = run(kid(7, 'en'), perfect, 'skills');
  const h = r.child.profile.skillHistory;
  const mathSkills = Object.keys(h).filter(k => !/^read|^write/.test(k));
  assert.ok(mathSkills.length >= 1, 'no maths skill evidence: ' + JSON.stringify(h));
  const sums = r.s.items.filter(i => ['math', 'story'].includes(i.kind));
  const noted = mathSkills.reduce((a, k) => a + h[k].n, 0);
  assert.ok(noted >= sums.length, `${noted} skill notes for ${sums.length} sums`);
});
await test('teacher homework code → the next call asks it → the progress code reaches the teacher view', () => {
  const t = teacherPhone();
  t.assignHomework('ABC123', ['tables'], 'Tables this week');
  const hwCode = t.homeworkCode('ABC123');
  const c = kid(9, 'en', 'Meera');
  const imp = brain.importHomeworkCode(c.id, hwCode);
  assert.ok(imp.ok, JSON.stringify(imp));
  assert.strictEqual(brain.getChild(c.id).profile.classCode, 'ABC123');

  const r = run(c, perfect, 'hw');
  const hw = r.s.items.find(i => i.kind === 'homework');
  assert.ok(hw, 'no homework item; slots ' + r.s.slots.join(','));
  assert.ok(r.says.some(x => x.includes("teacher's homework")), 'Munni did not say it was homework');
  assert.strictEqual(hw.outcome, 'correct');
  assert.ok(r.child.profile.hwDone, 'homework not marked done');

  webhook(r.id, brain.getSession(r.id).live_turns.map(x => `${x.role}: ${x.text}`).join('\n'));
  const rep = brain.getSession(r.id).report;
  const code = rep.lines.find(l => /^TKR1\./.test(l));
  assert.ok(code, 'no progress code in the report');
  const back = t.importClassReport(code);
  assert.ok(back.ok && /\(phone\)$/.test(back.name), JSON.stringify(back));
  const seen = t.readClassShared('ABC123')[r.child.profile.id];
  assert.ok(seen && seen.skillHistory[hw.skill] && seen.skillHistory[hw.skill].n >= 1, 'teacher cannot see the homework skill');

  const next = brain.createSession(c.id, { seed: 'hw2' }).session;
  assert.ok(!next.slots.includes('homework'), 'finished homework was asked again');
});
await test('homework that cannot be asked out loud (BODMAS) is left for the app, not mangled', () => {
  const t = teacherPhone();
  t.assignHomework('XYZ789', ['bodmas'], '');
  const c = kid(10, 'en', 'Ishaan');
  assert.ok(brain.importHomeworkCode(c.id, t.homeworkCode('XYZ789')).ok);
  const s = brain.createSession(c.id, { seed: 'bodmas' }).session;
  // with no evidence, the plan's storySkill is bodmas itself: a + b × c
  assert.ok(!s.slots.includes('homework'), 'asked an unbracketed a + b × c out loud');
});
await test('a wrong or damaged homework code is refused before it touches the child', () => {
  const c = kid(8, 'hi', 'Tara');
  assert.strictEqual(brain.importHomeworkCode(c.id, 'TKH1.abc.000').ok, false);
  assert.strictEqual(brain.getChild(c.id).profile.classCode, null);
});
await test('reading lines that spaced repetition says are due come back on the next card first', () => {
  const c = kid(7, 'hi', 'Srs');
  const r = run(c, perfect, 'srs1');
  webhook(r.id, brain.getSession(r.id).live_turns.map(x => `${x.role}: ${x.text}`).join('\n'));
  const child = brain.getChild(c.id);
  const items = Object.values(child.profile.srs || {}).filter(x => x.mod === 'read');
  assert.ok(items.length >= 1, 'reading on the phone fed no SRS items');
  const line = items[0].content;
  assert.ok(r.s.lines.includes(line), 'SRS item is not keyed on the card sentence: ' + line);
  for (const x of items) x.nextReview = Date.now() - 1000;      // a day has passed
  brain.store.put('children', child.id, child);
  const next = brain.createSession(c.id, { seed: 'srs2' }).session;
  assert.ok(next.lines.includes(line), 'due line not served: ' + JSON.stringify(next.lines));
});
await test('reading thresholds come from the age band, not the voice layer', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'voice', 'session.js'), 'utf8');
  assert.ok(!/g\.score\s*[<>]=?\s*\d/.test(src), 'a hardcoded reading threshold crept into session.js');
});

/* ---------------- HTTP ---------------- */
await test('HTTP: tools need the token, webhook needs the key, family links work, unknown sessions end gracefully', async () => {
  const { server } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env: {} });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const call = (method, p, body, headers) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ port, path: p, method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
  try {
    const c = kid(7, 'hi');
    const made = await call('POST', '/voice/admin/sessions', { child_id: c.id }, { Authorization: 'Bearer ak' });
    assert.strictEqual(made.status, 201, made.body);
    const id = JSON.parse(made.body).session.id;
    assert.strictEqual((await call('POST', '/voice/tools/next', { session_id: id })).status, 401);
    const n = await call('POST', '/voice/tools/next', { session_id: id }, { Authorization: 'Bearer tt' });
    assert.strictEqual(n.status, 200);
    assert.deepStrictEqual(Object.keys(JSON.parse(n.body)).sort(), ['done', 'expect', 'item', 'say']);
    const u = await call('POST', '/voice/tools/answer', { session_id: '%(session_id)s', child_said: '5' }, { Authorization: 'Bearer tt' });
    assert.strictEqual(JSON.parse(u.body).done, true, 'unknown session must end the call politely');
    assert.strictEqual((await call('POST', '/voice/webhook', { id: 'x' })).status, 401);
    assert.strictEqual((await call('POST', '/voice/webhook?key=hk', { id: 'x', status: 'completed' })).status, 200);
    const card = await call('GET', '/voice/card/' + id);
    assert.strictEqual(card.status, 200);
    assert.ok(card.body.includes(brain.getSession(id).lines[0]));
    assert.strictEqual((await call('GET', '/voice/admin')).status, 401);
    assert.strictEqual((await call('GET', '/voice/admin?key=ak', null, { Accept: 'text/html' })).status, 200);
  } finally { server.close(); }
});

/* ---------------- the Bolna graph ---------------- */
await test('graph: every edge lands on a real node, tools are scoped to the lesson, every exit hangs up', () => {
  const ids = new Set(nodes.map(n => n.id));
  for (const n of nodes) for (const e of n.edges) assert.ok(ids.has(e.to_node_id), `${n.id} → ${e.to_node_id}`);
  const tp = agent.agent_config.tasks[0].tools_config.api_tools.tools_params;
  for (const t of tools) assert.deepStrictEqual(tp[t.name].nodes, ['lesson'], t.name + ' is not scoped to the lesson');
  for (const n of nodes.filter(n => !n.edges.length)) assert.strictEqual(n.function_call, 'end_call', n.id + ' is a dead end');
  assert.ok(agent.agent_config.tasks[0].task_config.hangup_after_LLMCall === false);
});

/* ---------------- the engine fix ---------------- */
await test('regression: genProblem(3) no longer hangs on 4 − 4 = 0', () => {
  const seq = [0.0, 0.99];                 // r(4,9) → 4, r(1,4) → 4
  let k = 0, calls = 0;
  const box = { console, Math: Object.create(Math, { random: { value: () => { if (++calls > 10000) throw new Error('hang'); return k < seq.length ? seq[k++] : Math.random(); } } }) };
  vm.createContext(box);
  for (const f of ['state.js', 'content/ages.js', 'core/mathgen.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), box);
  vm.runInContext('S.age = 7;', box);
  k = 0; calls = 0;                        // loading may itself draw randoms; start the sequence here
  const g = vm.runInContext('genProblem(3)', box);
  assert.strictEqual(g.ans, 0);
  assert.strictEqual(new Set(g.opts).size, 4);
  assert.ok(g.opts.every(o => o >= 0));
});

console.log('--- voice channel ---');
console.log(results.join('\n'));
console.log(`\n${fail ? 'FAILED' : 'PASSED'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
