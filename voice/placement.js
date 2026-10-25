/* ==================================================================
   THE PLACEMENT CALL — where should a new child start?

   For a new admission: one call (about ten minutes) that finds where a
   child is, instead of starting everyone at their age band's first step.
   It walks the skill graph's spoken-maths ladder (count → add within 10 →
   tens and ones → carrying → tables → …) like a binary search: two sums
   per step, up when both are right, down when not, until it finds the
   last step the child owns and the first one they don't. Those two steps
   get two more sums each, so the skill history holds four real attempts
   on each — enough for the app's diagnosis to call it solid or a gap.
   Then reading: one line per reading level on the card, easiest first,
   until two in a row don't come.

   What is recorded is only what happened: every first-try sum as an
   attempt on its skill (noteSkillAttempt), every reading as an attempt on
   its level — re-graded from Bolna's transcript, like every reading — and
   the starting levels that follow. No clue, no reveal: it's a test, so
   Munni just says thank you and moves on, and never says "wrong".
   ================================================================== */
'use strict';
const crypto = require('crypto');
const { parseNumber, intentOf } = require('./understand');
const SS = require('./session');

const MAX_MS = 11 * 60 * 1000, MAX_TURNS = 70, MAX_STEPS = 6;

// the spoken ladder, easiest first, and roughly the biggest number each
// one needs (a skill that can't fit the band's number ceiling isn't
// really tested by a shrunk sum, so it's left off)
const LADDER = [
  ['count20', 20, 2], ['add10', 10, 3], ['sub10', 10, 3], ['bonds10', 10, 3], ['place2', 99, 4], ['add2', 99, 4],
  ['sub2', 99, 4], ['carry', 99, 4], ['borrow', 99, 4], ['skip', 60, 5], ['tables', 100, 5], ['divshare', 60, 5],
  ['place3', 999, 5], ['mult2x1', 240, 5], ['divrem', 60, 5], ['mult2x2', 480, 6], ['longdiv', 240, 6]
];

const PL = {
  intro: { en: "Today is a little different. Munni wants to see what you already know, so some questions are easy and some are hard. It's fine not to know! Here's the first one.",
           hi: 'आज थोड़ा अलग है। मुन्नी देखना चाहती है कि तुम्हें क्या-क्या आता है, इसलिए कुछ सवाल आसान होंगे और कुछ मुश्किल। न आए तो भी बिल्कुल ठीक है! पहला सवाल।' },
  right: [{ en: 'Yes!', hi: 'हाँ!' }, { en: 'Right!', hi: 'सही!' }, { en: 'Good!', hi: 'बढ़िया!' }],
  thanks: [{ en: 'Thank you!', hi: 'धन्यवाद!' }, { en: 'Okay!', hi: 'ठीक है!' }],
  fine: { en: "That's fine!", hi: 'कोई बात नहीं!' },
  takeTime: { en: 'Take your time.', hi: 'आराम से सोचो।' },
  notHeard: { en: "I didn't hear a number. Can you say it again?", hi: 'मुझे संख्या सुनाई नहीं दी। फिर से बोलोगे?' },
  toRead: { en: 'Now some reading. Take the card. Read line 1 for me.', hi: 'अब थोड़ा पढ़ना। कार्ड लो। लाइन 1 पढ़कर सुनाओ।' },
  toSay: { en: "Now say this after me: {line}", hi: 'अब मेरे बाद बोलो: {line}' },
  nextLine: { en: 'Now line {k}.', hi: 'अब लाइन {k}।' },
  readAgain: { en: "I couldn't hear that well. Read line {k} once more?", hi: 'मुझे ठीक से सुनाई नहीं दिया। लाइन {k} एक बार और पढ़ोगे?' },
  end: { en: 'That is all! Thank you for showing Munni what you know. Bye bye!', hi: 'बस इतना ही! मुन्नी को अपना सीखा हुआ दिखाने के लिए धन्यवाद। बाय-बाय!' },
  stop: { en: "Okay, let's stop here. Thank you! Bye bye!", hi: 'ठीक है, यहीं रुकते हैं। धन्यवाद! बाय-बाय!' }
};
const T2 = (o, lang, v) => SS.fill(o, lang, v || {});
const pick = (arr, k) => arr[k % arr.length];

/* ---------- planning ---------- */
function planPlacement(core, child, o) {
  o = o || {};
  const id = o.id || crypto.randomBytes(12).toString('base64url');
  const lang = child.lang === 'en' ? 'en' : 'hi';
  const seed = o.seed || id;
  const { out } = core.withChild(child.profile, { lang, seed }, T => {
    const b = T.band();
    const ladder = LADDER.filter(([, max]) => max <= b.maxNumber).map(([sk]) => sk).filter(sk => T.skillHasProblem(sk));
    // start a grade below where a child this age usually is: an easy
    // first question, not a scary one
    const g = Math.max(1, child.age - 6);
    let start = 0;
    ladder.forEach((sk, i) => { const s = T.skillById(sk); if (s && s.g <= g) start = i; });
    const [lo, hi] = b.levels.read;
    const r = T.rng(T.seedOf(seed + '|placelines'));
    const lines = [];
    for (let lv = lo; lv <= hi; lv++) {
      const pool = T.ageSentences(lang, lv).filter(l => !lines.some(x => x.text === l));
      if (pool.length) lines.push({ level: lv, text: pool[Math.floor(r() * pool.length)] });
    }
    return { band: b.id, ladder, start, lines, levels: { ...T.S.levels }, oral: !!b.traceOnly && b.id === 'pre' };
  });
  return {
    id, child_id: child.id, lang, seed, kind: 'placement', channel: o.channel || 'call', keypad: o.keypad !== false,
    band: out.band, slots: ['math', 'read'], lines: out.lines.map(l => l.text), line_levels: out.lines.map(l => l.level),
    levels_before: out.levels, status: 'planned', created_at: new Date().toISOString(), started_at: null, ended_at: null,
    turns: 0, items: [], trace: [`T0 · placement ladder: ${out.ladder.join(' → ')} (start at ${out.ladder[out.start] || '–'})`],
    ended_by: null,
    place: { ladder: out.ladder, lo: -1, hi: out.ladder.length, cur: out.start, steps: 0, tested: {}, phase: out.ladder.length ? 'math' : 'read',
             queue: [], topped: false, line: 0, misses: 0 }
  };
}

/* ---------- serving ---------- */
function mathItem(core, child, s, skill, k) {
  const { out } = core.withChild(child.profile, { lang: s.lang }, T => T.skillProblem(skill, T.seedOf(`${s.seed}|${skill}|${k}`)));
  if (!out || !SS.SPOKEN_OPS[out.op]) return null;
  const v = { a: SS.nw(out.a, s.lang), b: SS.nw(out.b, s.lang) };
  return { n: s.items.length + 1, kind: 'pmath', skill, expect: 'number', answer: out.ans, problem: out.text,
           prompt: T2(SS.L[SS.SPOKEN_OPS[out.op]], s.lang, v), prompts: [], said: [], attempts: 0, heard_misses: 0 };
}
function readItem(s, i) {
  const k = i + 1;
  const text = i === 0 ? T2(PL.toRead, s.lang) : T2(PL.nextLine, s.lang, { k });
  return { n: s.items.length + 1, kind: 'pread', line_no: k, level: s.line_levels[i], expect: 'reading', target: s.lines[i],
           prompt: text, prompts: [], said: [], attempts: 0 };
}
function serve(s, it, lead) {
  const say = SS.joinSay(lead, it.prompt);
  it.prompts.push(say);
  s.items.push(it);
  return { say, expect: it.expect, done: false, item: { n: it.n, kind: it.kind } };
}
function end(s, why, lead) {
  s.ended_by = why; s.status = 'ended'; s.ended_at = new Date().toISOString();
  s.goodbye = SS.joinSay(lead, T2(why === 'stop' ? PL.stop : PL.end, s.lang));
  return { say: s.goodbye, expect: 'none', done: true, item: null };
}

/* the next question, from the search state */
function nextQuestion(core, child, s, lead) {
  const P = s.place;
  if (s.turns > MAX_TURNS || (s.started_at && Date.now() - Date.parse(s.started_at) > MAX_MS)) return end(s, 'time', lead);
  if (P.phase === 'math') {
    if (!P.queue.length && P.topped) return toReading(core, child, s, lead);
    if (!P.queue.length) {
      // the current step is settled: move the search
      const done = P.tested[P.ladder[P.cur]];
      if (done && done.counted >= 2) {
        if (done.right >= 2 && done.counted === done.right) P.lo = Math.max(P.lo, P.cur); else P.hi = Math.min(P.hi, P.cur);
        P.steps++;
        if (P.hi - P.lo <= 1 || P.steps >= MAX_STEPS) {
          // two more sums on each side of the boundary, then reading
          if (!P.topped) {
            P.topped = true;
            for (const i of [P.lo, P.hi]) if (i >= 0 && i < P.ladder.length) P.queue.push(P.ladder[i], P.ladder[i]);
          }
          if (!P.queue.length) return toReading(core, child, s, lead);
        } else {
          P.cur = Math.floor((P.lo + P.hi) / 2);
          if (P.cur === P.lo) P.cur++;
          P.queue.push(P.ladder[P.cur], P.ladder[P.cur]);
        }
      } else P.queue.push(P.ladder[P.cur], P.ladder[P.cur]);
      if (!P.queue.length) return toReading(core, child, s, lead);
    }
    const skill = P.queue.shift();
    const it = mathItem(core, child, s, skill, s.items.length);
    if (!it) return nextQuestion(core, child, s, lead);
    return serve(s, it, lead);
  }
  return toReading(core, child, s, lead);
}
function toReading(core, child, s, lead) {
  const P = s.place;
  P.phase = 'read';
  if (P.line >= s.lines.length || P.misses >= 2) return end(s, 'plan', lead);
  return serve(s, readItem(s, P.line), lead);
}

function next(core, child, s) {
  if (s.ended_by) return { say: s.goodbye, expect: 'none', done: true, item: null };
  if (!s.started_at) { s.started_at = new Date().toISOString(); s.status = 'live'; return nextQuestion(core, child, s, T2(PL.intro, s.lang)); }
  const it = s.items[s.items.length - 1];
  if (it && !it.outcome) { it.prompts.push(it.prompt); return { say: it.prompt, expect: it.expect, done: false, item: { n: it.n, kind: it.kind } }; }
  return nextQuestion(core, child, s, '');
}

function answer(core, child, s, said) {
  if (s.ended_by) return { say: s.goodbye, expect: 'none', done: true, item: null };
  if (!s.started_at) return next(core, child, s);
  s.turns++;
  const it = s.items[s.items.length - 1];
  if (!it || it.outcome) return next(core, child, s);
  const intent = intentOf(said);
  if (intent === 'stop') { it.outcome = 'stopped'; return end(s, 'stop', ''); }
  if (intent === 'repeat') { it.prompts.push(it.prompt); return { say: it.prompt, expect: it.expect, done: false, item: { n: it.n, kind: it.kind } }; }
  // went quiet: kept as an observation, never as a wrong answer
  if (intent === 'silence') {
    it.silences = (it.silences || 0) + 1;
    s.silence_log = (s.silence_log || []).concat({ n: it.n, kind: it.kind, skill: it.skill || null, at: Date.now(), source: 'live' });
    if (it.silences < 2) { const t = SS.joinSay(T2(PL.takeTime, s.lang), it.prompt); it.prompts.push(t); return { say: t, expect: it.expect, done: false, item: { n: it.n, kind: it.kind } }; }
    it.outcome = 'silent';
    const P0 = s.place;
    if (it.expect === 'number') {
      P0.replaced = P0.replaced || {};
      if (!P0.replaced[it.skill]) { P0.replaced[it.skill] = true; P0.queue.unshift(it.skill); }
      else {
        // quiet again on the same step: for the search, treat it as not yet
        // there (go easier) — but record no attempt, because none was made
        const rec = P0.tested[it.skill] || { counted: 0, right: 0 };
        rec.counted = Math.max(rec.counted, 2); rec.quiet = true;
        P0.tested[it.skill] = rec;
        P0.queue = P0.queue.filter(x => x !== it.skill);
      }
    }
    else { P0.misses++; P0.line++; return toReading(core, child, s, T2(PL.fine, s.lang)); }
    return nextQuestion(core, child, s, T2(PL.fine, s.lang));
  }
  it.said.push(String(said || ''));
  const P = s.place;

  if (it.expect === 'number') {
    const got = intent === 'dontKnow' ? null : parseNumber(said, s.lang);
    if (got == null && intent !== 'dontKnow') {
      // a doubt is not a miss: ask once more, then let it go uncounted
      if (it.heard_misses++ < 1) { const t = T2(PL.notHeard, s.lang); it.prompts.push(t); return { say: t, expect: 'number', done: false, item: { n: it.n, kind: it.kind } }; }
      it.outcome = 'unsure';
      P.queue.unshift(it.skill);              // one more sum on the same step instead
      return nextQuestion(core, child, s, T2(pick(PL.thanks, it.n), s.lang));
    }
    const ok = got === it.answer;
    it.outcome = ok ? 'correct' : intent === 'dontKnow' ? 'dont_know' : 'not_yet';
    const rec = P.tested[it.skill] || { counted: 0, right: 0 };
    rec.counted++; if (ok) rec.right++;
    P.tested[it.skill] = rec;
    core.withChild(child.profile, { lang: s.lang }, T => { T.noteSkillAttempt(it.skill, ok, T.S); });
    // a miss on this step settles it: no need for the second sum
    if (!ok && P.queue[0] === it.skill && !P.topped) { P.queue.shift(); rec.counted = Math.max(rec.counted, 2); }
    const lead = ok ? T2(pick(PL.right, it.n), s.lang) : intent === 'dontKnow' ? T2(PL.fine, s.lang) : T2(pick(PL.thanks, it.n), s.lang);
    return nextQuestion(core, child, s, lead);
  }

  // reading: graded live only to decide whether to go on; the transcript
  // settles it after the call
  const g = SS.gradeLine(core, child, s, it.target, [said]);
  if (g.verdict === 'unsure' && it.attempts++ < 1) {
    const t = T2(PL.readAgain, s.lang, { k: it.line_no });
    it.prompts.push(t);
    return { say: t, expect: 'reading', done: false, item: { n: it.n, kind: it.kind } };
  }
  it.outcome = g.verdict;
  P.misses = g.verdict === 'pass' ? 0 : P.misses + 1;
  P.line++;
  return toReading(core, child, s, g.verdict === 'pass' ? T2(pick(PL.right, it.n), s.lang) : T2(pick(PL.thanks, it.n), s.lang));
}

/* ---------- after the call: settle the starting point ---------- */
const LEVEL_OF = Object.fromEntries(LADDER.map(([sk, , lv]) => [sk, lv]));

function processPlacementEnd(core, child, s, payload, R) {
  const status = String(payload.status || '').toLowerCase();
  if (!R.TERMINAL.has(status)) return { changed: false, reason: 'not terminal: ' + status };
  if (s.processed && s.processed_exec === payload.id) return { changed: false, reason: 'already processed' };
  const tel = payload.telephony_data || {};
  s.call = Object.assign(s.call || {}, { execution_id: payload.id, status, duration_s: Number(payload.conversation_duration || tel.duration || 0),
    recording_url: tel.recording_url || null });
  s.transcript = String(payload.transcript || '');
  s.processed = true; s.processed_exec = payload.id; s.processed_at = new Date().toISOString();
  const answered = s.items.filter(it => it.said.length);
  if (!answered.length) { s.status = 'missed'; s.report = R.missedReport(child, s, {}); return { changed: true, status: s.status }; }
  s.status = 'done';
  R.alignToTranscript(s, R.parseTranscript(s.transcript));
  R.settleQuiet(child, s);
  // the same relay check as a lesson: did the voice model pass on what the recognizer heard?
  let checked = 0, mismatched = 0;
  for (const it of s.items) it.said.forEach((relayed, k) => {
    const tx = it.heard_tx && it.heard_tx[k];
    if (tx == null) return;
    checked++;
    if (it.expect === 'number' ? parseNumber(relayed, s.lang) !== parseNumber(tx, s.lang)
        : Math.abs(SS.gradeLine(core, child, s, it.target, [relayed]).score - SS.gradeLine(core, child, s, it.target, [tx]).score) >= 15) mismatched++;
  });
  s.relay = { checked, mismatched };

  // reading, from the recognizer's own words
  const reads = [];
  for (const it of s.items.filter(x => x.kind === 'pread' && x.said.length)) {
    const txs = (it.heard_tx || []).filter(Boolean);
    const alts = txs.length ? txs : it.said;
    const g = SS.gradeLine(core, child, s, it.target, [alts[0]]);
    it.evidence = { source: txs.length ? 'transcript' : 'relay', first_verdict: g.verdict, verdict: g.verdict, score: g.score, tokens: g.tokens };
    reads.push({ level: it.level, verdict: g.verdict });
  }
  const P = s.place;
  const passed = P.lo >= 0 ? P.ladder[P.lo] : null, nextStep = P.hi < P.ladder.length ? P.ladder[P.hi] : null;
  const readOk = reads.filter(r => r.verdict === 'pass').map(r => r.level);
  const { out: lv } = core.withChild(child.profile, { lang: s.lang }, T => {
    for (const r of reads) if (r.verdict !== 'unsure') T.noteSkillAttempt('read' + r.level, r.verdict === 'pass', T.S);
    const b = T.band();
    const math = T.clampLevel('math', passed ? LEVEL_OF[passed] : b.levels.math[0]);
    const read = T.clampLevel('read', readOk.length ? Math.max(...readOk) : b.levels.read[0]);
    if (P.ladder.length) T.S.levels.math = math;
    if (reads.length) T.S.levels.read = read;
    T.mirrorToClassNow(T.S);
    return { math: T.S.levels.math, read: T.S.levels.read, comp: { math: T.COMPETENCY.math[T.S.levels.math], read: T.COMPETENCY.read[T.S.levels.read] } };
  });
  child.placement = {
    at: new Date().toISOString(), session: s.id,
    math: { level: lv.math, passed, next: nextStep, tested: Object.entries(P.tested).map(([skill, r]) => ({ skill, n: r.counted, right: r.right })) },
    read: { level: lv.read, lines: reads }
  };
  child.placement_due = false;
  s.levels_after = { ...child.profile.levels };
  s.report = placementReport(core, child, s, lv, passed, nextStep, R);
  return { changed: true, status: s.status, placement: child.placement };
}

const PR = {
  title: { en: "{name}'s starting point with Munni", hi: 'मुन्नी के साथ {name} की शुरुआत' },
  mathBoth: { en: 'Maths: {name} can do {a}. The next step is {b}.', hi: 'गणित: {name} को {a} आता है। अगला कदम: {b}।' },
  mathTop: { en: 'Maths: {name} can do {a}, the hardest step Munni asked.', hi: 'गणित: {name} को {a} आता है, जो मुन्नी का सबसे कठिन सवाल था।' },
  mathStart: { en: 'Maths: {name} will start with {b}.', hi: 'गणित: {name} की शुरुआत {b} से होगी।' },
  read: { en: 'Reading: Munni will start at "{c}".', hi: 'पढ़ना: मुन्नी "{c}" से शुरू करेगी।' },
  quiet: { en: '{name} went quiet on {k} of the questions; Munni counted those as "not yet seen", not as mistakes.',
           hi: '{k} सवालों पर {name} की ओर से जवाब नहीं आया; मुन्नी ने उन्हें गलती नहीं, "अभी देखा नहीं" माना।' },
  from: { en: 'Lessons start from here and move with {name}.', hi: 'पाठ यहीं से शुरू होंगे और {name} के साथ आगे बढ़ेंगे।' }
};
function placementReport(core, child, s, lv, passed, nextStep, R) {
  const lang = s.lang, name = child.name;
  const f = (k, v) => SS.fill(PR[k], lang, Object.assign({ name }, v));
  const nm = id => { const sk = core.T.skillById(id); return sk ? (lang === 'hi' ? sk.hi : sk.en.toLowerCase()) : id; };
  const lines = [f('title', {})];
  if (s.place.ladder.length) lines.push(passed && nextStep ? f('mathBoth', { a: nm(passed), b: nm(nextStep) }) : passed ? f('mathTop', { a: nm(passed) }) : f('mathStart', { b: nm(nextStep || s.place.ladder[0]) }));
  if (s.items.some(x => x.kind === 'pread' && x.said.length) && lv.comp.read) lines.push(f('read', { c: lv.comp.read[lang] }));
  if (s.silence && s.silence.items.length) lines.push(f('quiet', { k: s.silence.items.length }));
  lines.push(f('from', {}));
  const code = R.progressCodeFor(core, child);
  if (code) { lines.push(lang === 'hi' ? 'यह अभ्यास टीचर तक पहुँचाने के लिए उन्हें यह कोड भेजें:' : 'To share this with the teacher, send them this code:'); lines.push(code); }
  lines.push(lang === 'hi' ? '— तख़्ती' : '— Takhti');
  const text = lines.join('\n');
  const phone = String(child.parent_phone || '').replace(/[^\d]/g, '');
  return { lang, text, lines, short: [lines[1] || lines[0], lines[2] || lines[lines.length - 1], lines[lines.length - 1]].map(l => l.replace(/\s+/g, ' ')),
           whatsapp: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null, share: `https://wa.me/?text=${encodeURIComponent(text)}` };
}

module.exports = { planPlacement, next, answer, processPlacementEnd, LADDER, PL };
