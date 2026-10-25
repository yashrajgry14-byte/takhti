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

await test('keypad: pressed digits, * to repeat, 1/2 for yes/no', () => {
  assert.strictEqual(U.parseNumber('dtmf_number: 12', 'hi'), 12);
  assert.strictEqual(U.parseNumber('dtmf_number: 7#', 'en'), 7);
  assert.strictEqual(U.intentOf('dtmf_number: *'), 'repeat');
  assert.strictEqual(U.parseYesNo('dtmf_number: 1'), true);
  assert.strictEqual(U.parseYesNo('dtmf_number: 2'), false);
});
await test('keypad: a call can be answered entirely by pressing keys, and Munni offers it after a doubt', () => {
  const r = run(kid(7, 'hi', 'Keys'), (it, s, i) => {
    if (i === 0) return 'उम्म';                                      // not heard → keypad hint
    if (it.expect === 'number') return 'dtmf_number: ' + it.answer + '#';
    if (it.expect === 'yesno') return 'dtmf_number: ' + (it.answer ? 1 : 2);
    return it.target;
  }, 'keys');
  assert.ok(r.says.some(x => x.includes('हैश वाला बटन')), 'no keypad hint after an unheard answer');
  const sums = r.s.items.filter(i => i.expect === 'number' || i.expect === 'yesno');
  assert.ok(sums.every(i => /^correct/.test(i.outcome)), sums.map(i => i.outcome).join());
});
await test('keypad: never offered where there is no keypad (Talking Munni in the app)', () => {
  const c = kid(7, 'en', 'NoKeys');
  const { session } = brain.createSession(c.id, { seed: 'nokey', channel: 'app' });
  brain.toolNext(session.id);
  const r = brain.toolAnswer(session.id, 'hmm');
  assert.ok(!/press/i.test(r.say), r.say);
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

/* ---------------- spoken English ---------------- */
const SND = require('../voice/sounds');
const ENG = require('../voice/english');
await test('sounds: English words match their Devanagari transcription, and names across scripts', () => {
  const same = [['water', 'वॉटर'], ['water', 'वाटर'], ['father', 'फ़ादर'], ['mother', 'मदर'], ['orange', 'ऑरेंज'], ['school', 'स्कूल'],
    ['flower', 'फ्लावर'], ['happy', 'हैप्पी'], ['night', 'नाइट'], ['apple', 'एप्पल'], ['window', 'विंडो'], ['brother', 'ब्रदर'],
    ['Riya', 'रिया'], ['Kabir', 'कबीर'], ['Arjun', 'अर्जुन'], ['Ishaan', 'ईशान'], ['the', 'द'], ['you', 'यू']];
  for (const [a, b] of same) assert.ok(SND.soundsLike(a, b), `${a} ≠ ${b} (${SND.skeleton(a)} / ${SND.skeleton(b)})`);
  const differ = [['water', 'पानी'], ['tree', 'door'], ['red', 'rain'], ['star', 'sister'], ['ball', 'blue'], ['dog', 'duck'], ['Riya', 'Kabir']];
  for (const [a, b] of differ) assert.ok(!SND.soundsLike(a, b), `${a} matched ${b}`);
  assert.strictEqual(SND.phraseScore('My name is Riya.', 'माय नेम इज़ रिया').score, 100);
  assert.strictEqual(SND.phraseScore('I am fine', 'आई एम फाइन').score, 100);
});
await test('english bank: no two words sound alike to the checker, every line is bilingual', () => {
  for (const w of ENG.WORDS) for (const a of w.accept) for (const o of ENG.WORDS)
    assert.ok(o === w || !o.accept.some(x => SND.soundsLike(x, a)), `${w.en}/${a} clashes with ${o.en}`);
  for (const w of ENG.WORDS) assert.ok(w.en && w.hi && SND.skeleton(w.en), w.en);
  for (const p of ENG.PHRASES) assert.ok(p.en && p.hi && SND.phraseScore(p.en.replace('{name}', 'Riya'), p.en.replace('{name}', 'Riya')).score === 100, p.en);
  for (const [k, v] of Object.entries(ENG.EL)) assert.ok(v.en && v.hi, 'EL.' + k);
});
await test('english call: a Hindi word gets a clue, the English word in Devanagari counts, phrases graded by sound', () => {
  const c = kid(7, 'hi', 'Esha');
  const { session } = brain.createSession(c.id, { seed: 'eng', kind: 'english' });
  assert.strictEqual(session.kind, 'english');
  assert.ok(session.slots.includes('eword') && session.slots.includes('ephrase'));
  const says = [brain.toolNext(session.id).say];
  let r = { done: false }, first = true;
  for (let i = 0; i < 30 && !r.done; i++) {
    const s = brain.getSession(session.id), it = s.items[s.items.length - 1];
    let said;
    if (it.expect === 'english') { said = first ? it.meaning : it.word; first = false; }
    else said = it.target;
    r = brain.toolAnswer(session.id, said); says.push(r.say);
  }
  const s = brain.getSession(session.id);
  assert.ok(says.some(x => x.includes('एक बार फिर सोचो')), 'no clue after a Hindi answer');
  assert.ok(s.items.filter(i => i.kind === 'ephrase').every(i => i.outcome === 'correct'));
  assert.ok(/अंग्रेज़ी के .* शब्द/.test(r.say), r.say);
});
await test('english call: English practice never touches the app\'s reading/maths levels; word history picks tomorrow\'s words', () => {
  const c = kid(6, 'hi', 'Om');
  const before = JSON.stringify(brain.getChild(c.id).profile);
  const { session } = brain.createSession(c.id, { seed: 'eng3', kind: 'english' });
  let x = brain.toolNext(session.id);
  for (let i = 0; i < 30 && !x.done; i++) {
    const s = brain.getSession(session.id), it = s.items[s.items.length - 1];
    x = brain.toolAnswer(session.id, it.expect === 'english' ? 'उम्म नहीं पता' : it.target);
  }
  const tx = brain.getSession(session.id).live_turns.map(t => `${t.role}: ${t.text}`).join('\n');
  webhook(session.id, tx);
  const child = brain.getChild(c.id);
  const done = brain.getSession(session.id);
  const asked = done.items.filter(i => i.kind === 'eword').map(i => i.word);
  assert.ok(asked.every(w => child.english_words[w] && child.english_words[w].right === 0), JSON.stringify(child.english_words));
  assert.ok(/English|अंग्रेज़ी/.test(done.report.text));
  // the app record (levels, attempts, SRS, skill history) is untouched
  const after = JSON.parse(JSON.stringify(child.profile)), was = JSON.parse(before);
  for (const k of ['levels', 'attempts', 'correct', 'srs', 'skillHistory']) assert.deepStrictEqual(after[k], was[k], k + ' changed');
  // the next English call brings the missed words back
  const next = brain.createSession(c.id, { seed: 'eng4', kind: 'english' }).session;
  assert.ok(next.english.words.some(w => asked.includes(w)), 'missed words did not come back');
});
await test('english practice alternates with the normal lesson when a parent turns it on', () => {
  const c = kid(8, 'hi', 'Alt');
  assert.strictEqual(brain.nextKind(brain.getChild(c.id)), 'lesson');
  brain.setEnglishPractice(c.id, true);
  run(brain.getChild(c.id), perfect, 'alt1');               // a normal lesson happened
  assert.strictEqual(brain.nextKind(brain.getChild(c.id)), 'english');
});

/* ---------------- the inbound line ---------------- */
const reg = (name, age, lang, phone) => brain.registerChild({ name, age, lang, parent_phone: phone, consent: true }).child;
const notQuiet = { TAKHTI_QUIET_HOURS: 'off' };
await test('inbound: an unregistered number hears why, and the line closes', () => {
  const r = brain.inboundLookup({ contact_number: '+919111111111' }, notQuiet);
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.registered, false);
  assert.ok(/registered/.test(r.greeting) && /जुड़ा नहीं/.test(r.greeting), r.greeting);
});
await test('inbound: a registered child is greeted by name and gets a lesson with keypad on', () => {
  const c = reg('Pari', 7, 'hi', '+919122222222');
  const r = brain.inboundLookup({ contact_number: '9122222222', execution_id: 'ex-in-1' }, notQuiet);
  assert.ok(r.allowed && r.registered && r.child_name === 'Pari', JSON.stringify(r));
  assert.ok(r.greeting.includes('Pari'));
  const s = brain.getSession(r.session_id);
  assert.strictEqual(s.channel, 'inbound'); assert.strictEqual(s.keypad, true); assert.strictEqual(s.child_id, c.id);
  assert.ok(!brain.toolNext(r.session_id).done);
});
await test('inbound: siblings on one phone — Munni asks who, and the answer picks the right child (रिया → Riya)', () => {
  const a = reg('Kabir', 6, 'hi', '+919133333333');
  const b = reg('Riya', 8, 'hi', '+919133333333');
  const r = brain.inboundLookup({ contact_number: '+91 91333 33333' }, notQuiet);
  assert.ok(r.allowed && /Kabir/.test(r.greeting) && /Riya/.test(r.greeting), r.greeting);
  brain.toolNext(r.session_id, 'मैं रिया');
  const s = brain.getSession(r.session_id);
  assert.strictEqual(s.child_id, b.id, 'stayed on the first sibling');
  assert.strictEqual(s.band, 'developing');
  assert.ok(brain.getChild(b.id).sessions.includes(s.id) && !brain.getChild(a.id).sessions.includes(s.id));
});
await test('inbound: after today\'s lessons the line says rest, not another sum', () => {
  reg('Dev', 7, 'en', '+919144444444');
  for (let k = 0; k < 2; k++) {
    const r = brain.inboundLookup({ contact_number: '9144444444' }, notQuiet);
    assert.ok(r.allowed); brain.toolNext(r.session_id);
  }
  const r3 = brain.inboundLookup({ contact_number: '9144444444' }, notQuiet);
  assert.strictEqual(r3.allowed, false);
  assert.ok(/already practised/.test(r3.greeting), r3.greeting);
});
await test('inbound: quiet hours close the line kindly', () => {
  reg('Noor', 7, 'hi', '+919155555555');
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date())) % 24;
  const r = brain.inboundLookup({ contact_number: '9155555555' }, { TAKHTI_QUIET_HOURS: `${h}-${(h + 1) % 24}` });
  assert.strictEqual(r.allowed, false);
  assert.ok(r.greeting.includes('आराम का समय'), r.greeting);
});
await test('graph: a closed line hangs up on the next thing anyone says', () => {
  const start = nodes.find(n => n.id === 'start');
  const e = start.edges.find(x => x.to_node_id === 'closed_end');
  assert.ok(e && e.condition_type === 'expression' && e.priority === 0);
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
    assert.strictEqual((await call('GET', '/voice/inbound/lookup?contact_number=9111111111')).status, 401);
    const look = await call('GET', '/voice/inbound/lookup?contact_number=9111111111', null, { Authorization: 'Bearer tt' });
    assert.strictEqual(look.status, 200);
    assert.strictEqual(JSON.parse(look.body).allowed, false);
    assert.strictEqual((await call('POST', '/voice/webhook?key=hk', { id: 'x', status: 'completed' })).status, 200);
    const card = await call('GET', '/voice/card/' + id);
    assert.strictEqual(card.status, 200);
    assert.ok(card.body.includes(brain.getSession(id).lines[0]));
    assert.strictEqual((await call('GET', '/voice/admin')).status, 401);
    assert.strictEqual((await call('GET', '/voice/admin?key=ak', null, { Accept: 'text/html' })).status, 200);
  } finally { server.close(); }
});

/* ---------------- Talking Munni in the app: server half, against a fake Bolna ---------------- */
await test('web talk: mint, screen, a tap pushed into the live call, results for the app, limits, erase', async () => {
  const injected = [];
  const fake = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      if (req.url === '/web-call/session') {
        const body = JSON.parse(b);
        assert.ok(body.user_data.session_id && body.user_data.greeting && req.headers.authorization === 'Bearer bk');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ run_id: 'run-' + body.user_data.session_id, agent_id: body.agent_id, expires_in: 120 }));
      }
      const m = req.url.match(/^\/v1\/call\/([^/]+)\/events$/);
      if (m) { injected.push({ run: m[1], body: JSON.parse(b) }); res.writeHead(202); return res.end('{}'); }
      res.writeHead(404); res.end();
    });
  });
  await new Promise(r => fake.listen(0, r));
  const env = { BOLNA_API_KEY: 'bk', BOLNA_AGENT_ID: 'agent-1', BOLNA_API_BASE: `http://127.0.0.1:${fake.address().port}`,
                TAKHTI_WEB_DAILY: '2', TAKHTI_WEB_GRACE_MS: '999999999' };
  const { server } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const call = (method, p, body) => new Promise((resolve, reject) => {
    const req = http.request({ port, path: p, method, headers: { 'Content-Type': 'application/json', Origin: 'http://app.example' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null, headers: res.headers }));
    });
    req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
  try {
    const child = { id: 'cAPPKID01', name: 'Mira', age: 7, lang: 'en', levels: { read: 3, write: 2, math: 3 } };
    assert.strictEqual((await call('POST', '/voice/web/session', { child })).status, 403, 'started without parent opt-in');
    const pre = await call('OPTIONS', '/voice/web/session');
    assert.strictEqual(pre.status, 204); assert.ok(pre.headers['access-control-allow-origin']);

    const st = await call('POST', '/voice/web/session', { child, consent: true });
    assert.strictEqual(st.status, 200, JSON.stringify(st.body));
    const { session_id: sid, token, key } = st.body;
    assert.ok(st.body.bolna.run_id && token && key);
    assert.strictEqual((await call('POST', '/voice/web/session', { child, consent: true })).status, 403, 'another phone took this child');
    const sv = brain.getSession(sid);
    assert.strictEqual(sv.channel, 'app'); assert.strictEqual(sv.keypad, false);
    assert.deepStrictEqual(brain.getChild('app_cAPPKID01').profile.levels.math, 3, 'did not start from the app\'s level');

    brain.toolNext(sid);                               // the call has started
    let state = (await call('GET', `/voice/web/state?session=${sid}&token=${token}`)).body;
    assert.strictEqual(state.screen.kind, 'number');
    assert.strictEqual((await call('GET', `/voice/web/state?session=${sid}&token=wrong`)).status, 404);

    // a wrong tap → the clue's two choices appear as buttons; Munni's reply went into the call
    const cur = () => { const s = brain.getSession(sid); return s.items[s.items.length - 1]; };
    let r = await call('POST', '/voice/web/tap', { session: sid, token, choice: String(cur().answer + 2) });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.screen.choices) && r.body.screen.choices.includes(cur().answer), JSON.stringify(r.body.screen));
    assert.strictEqual(injected.length, 1);
    assert.strictEqual(injected[0].run, 'run-' + sid);
    assert.strictEqual(injected[0].body.event, 'screen_answer');
    assert.ok(injected[0].body.properties.screen_say.includes('Is it'), injected[0].body.properties.screen_say);
    r = await call('POST', '/voice/web/tap', { session: sid, token, choice: String(cur().answer) });
    assert.ok(r.body.injected);

    // play the rest by voice; reading items show the line itself on screen
    let sawLine = false, x = { done: false };
    for (let i = 0; i < 40 && !x.done; i++) {
      state = (await call('GET', `/voice/web/state?session=${sid}&token=${token}`)).body;
      const it = cur();
      if (it.expect === 'reading') { sawLine = sawLine || state.screen.text === it.target; assert.ok(/screen/.test(it.prompts[0]) || it.kind === 'repeat'); }
      x = brain.toolAnswer(sid, perfect(it));
    }
    assert.ok(sawLine, 'the line to read was not on screen');
    assert.strictEqual((await call('GET', `/voice/web/result?session=${sid}&token=${token}`)).body.pending, true);
    webhook(sid, brain.getSession(sid).live_turns.map(t => `${t.role}: ${t.text}`).join('\n'));
    const res = (await call('GET', `/voice/web/result?session=${sid}&token=${token}`)).body;
    assert.strictEqual(res.source, 'transcript');
    const math = res.records.filter(z => z.mod === 'math'), read = res.records.filter(z => z.mod === 'read');
    const sums = brain.getSession(sid).items.filter(i => ['math', 'story', 'homework'].includes(i.kind));
    assert.strictEqual(math.length, sums.length, 'every sum (and only sums — not the warm-up) comes back for the app');
    assert.ok(math.every(z => z.ok === true), 'perfect sums came back as misses');
    assert.ok(read.length >= 1 && read.every(z => z.sentence), JSON.stringify(read));

    // a second talk today is fine; a third is not
    assert.strictEqual((await call('POST', '/voice/web/session', { child, consent: true, key })).status, 200);
    const s2 = brain.listSessions().filter(s => s.child_id === 'app_cAPPKID01' && !s.started_at)[0];
    brain.toolNext(s2.id);
    const third = await call('POST', '/voice/web/session', { child, consent: true, key });
    assert.strictEqual(third.status, 429); assert.strictEqual(third.body.limit, true);

    assert.strictEqual((await call('POST', '/voice/web/forget', { child_id: 'cAPPKID01', key: 'nope' })).status, 404);
    assert.strictEqual((await call('POST', '/voice/web/forget', { child_id: 'cAPPKID01', key })).status, 200);
    assert.strictEqual(brain.getChild('app_cAPPKID01'), null);
    assert.strictEqual(brain.getSession(sid), null);
  } finally { server.close(); fake.close(); }
});
await test('web talk: minting is rate-limited per address', async () => {
  const { createWeb } = require('../voice/web');
  const w = createWeb(brain, { BOLNA_API_KEY: 'k', BOLNA_AGENT_ID: 'a', BOLNA_API_BASE: 'http://127.0.0.1:9', TAKHTI_WEB_PER_HOUR: '2' });
  const body = n => ({ consent: true, child: { id: 'rateKid' + n, name: 'R', age: 6, lang: 'hi' } });
  await w.startSession(body(1), '9.9.9.9'); await w.startSession(body(2), '9.9.9.9');
  assert.strictEqual((await w.startSession(body(3), '9.9.9.9')).status, 429);
});
await test('graph: a screen tap event makes Munni speak at once, then the lesson carries on', () => {
  const lesson = nodes.find(n => n.id === 'lesson'), screen = nodes.find(n => n.id === 'screen');
  assert.ok(lesson.edges.some(e => e.condition_type === 'event' && e.event_name === 'screen_answer' && e.to_node_id === 'screen'));
  assert.ok(/\{\{screen_say\}\}/.test(screen.prompt));
  assert.ok(screen.edges.some(e => e.condition_type === 'unconditional' && e.to_node_id === 'lesson'));
});

/* ---------------- the Bolna graph ---------------- */
await test('graph: every edge lands on a real node, tools are scoped to the lesson, every exit hangs up', () => {
  const ids = new Set(nodes.map(n => n.id));
  for (const n of nodes) for (const e of n.edges) assert.ok(ids.has(e.to_node_id), `${n.id} → ${e.to_node_id}`);
  const tp = agent.agent_config.tasks[0].tools_config.api_tools.tools_params;
  // lesson tools live only on the lesson node; the teacher's note tool only on the teacher node
  const want = { takhti_note: ['teacher'], takhti_answer: ['lesson', 'hush', 'play'], takhti_next: ['lesson'] };
  for (const t of tools) assert.deepStrictEqual(tp[t.name].nodes, want[t.name], t.name + ' is scoped to the wrong node');
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
