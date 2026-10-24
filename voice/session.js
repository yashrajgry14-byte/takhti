/* ==================================================================
   A PHONE LESSON — what Munni says, what counts, when it ends

   The language model on the call is a voice, not a teacher. It speaks
   the `say` this file hands back, word for word, and passes the child's
   words back in. Every decision a teacher would make — which problem,
   whether the answer is right, when to hint, when to stop — is made
   here, deterministically, with the app's own engine.

   That is the phone version of lesson-gen.js's safety argument: an LLM
   never decides what a child hears. If the model wanders, the next tool
   call still returns a correct, age-banded, validated line.

   Shape of a call (about 6 minutes):
     warm-up count (not scored)  → three adaptive sums (genProblem +
     record) → one story problem from the validated lesson bank →
     two or three lines read from today's card (the matcher grades)
   For 3–4 year olds the reading lines become "say it after me".

   Things this file promises, and the tests check:
   - Never "wrong". A first miss gets a two-choice clue built from the
     closest distractor; a second gets the answer, kindly, and moves on.
   - A doubt is not a miss. No number heard, or a reading the matcher
     calls 'unsure', asks again once and then moves on recording nothing.
   - Only first-try answers count toward a level-up. A sum solved after
     a clue is a good moment, not evidence of mastery.
   - Every line exists in Hindi and English.
   - The call ends on time, on the child's "bas", or after the plan —
     whichever comes first. No "come back tomorrow" pressure.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const { parseNumber, parseYesNo, intentOf, numberWord } = require('./understand');

const MAX_CALL_MS = 8 * 60 * 1000;     // a lesson for a five-year-old, not a lecture
const MAX_TURNS = 40;                  // hard stop however the call goes

/* ---------------- every line Munni can say, both languages ---------------- */
const L = {
  start:      { en: "Let's begin!", hi: 'चलो शुरू करें!' },
  warmCount:  { en: 'Count with me: {seq}. What comes next?', hi: 'मेरे साथ गिनो: {seq}। आगे क्या आता है?' },
  warmSkip:   { en: 'Count in {s}s with me: {seq}. What comes next?', hi: '{s}-{s} करके गिनो: {seq}। आगे क्या आता है?' },
  plus:       { en: 'What is {a} plus {b}?', hi: '{a} और {b} कितने होते हैं?' },
  minus:      { en: 'What is {a} take away {b}?', hi: '{a} में से {b} गए, तो कितने बचे?' },
  times:      { en: 'What is {a} times {b}?', hi: '{a} गुणा {b} कितना होता है?' },
  plusWhy:    { en: '{a} and {b} make {ans}.', hi: '{a} और {b} मिलकर {ans}।' },
  minusWhy:   { en: '{a} take away {b} leaves {ans}.', hi: '{a} में से {b} गए, {ans} बचे।' },
  timesWhy:   { en: '{a} times {b} is {ans}.', hi: '{a} गुणा {b} बराबर {ans}।' },
  praise: [
    { en: "Yes! That's right.", hi: 'हाँ! बिल्कुल सही।' },
    { en: 'Well done!', hi: 'शाबाश!' },
    { en: 'Perfect!', hi: 'बहुत बढ़िया!' },
    { en: 'Correct! Shabaash!', hi: 'सही जवाब! शाबाश!' }
  ],
  readPraise: [
    { en: 'Lovely reading!', hi: 'बहुत अच्छा पढ़ा!' },
    { en: 'Beautifully read!', hi: 'वाह, सुंदर पढ़ा!' },
    { en: 'Well read! Shabaash!', hi: 'शाबाश, बढ़िया पढ़ा!' }
  ],
  levelUp:    { en: 'Wow! The next one is a little harder.', hi: 'वाह! अगला सवाल थोड़ा मुश्किल है।' },
  clue:       { en: "Let's think again. Is it {x} or {y}?", hi: 'एक बार फिर सोचो। {x} या {y}?' },
  clueDK:     { en: "That's okay! Here's a clue. Is it {x} or {y}?", hi: 'कोई बात नहीं! एक इशारा: {x} या {y}?' },
  clueYN:     { en: "Let's think again. Say yes or no.", hi: 'एक बार फिर सोचो। हाँ या नहीं बोलो।' },
  reveal:     { en: 'The answer is {ans}. {why} Good try!', hi: 'जवाब है {ans}। {why} अच्छी कोशिश!' },
  revealYN:   { en: 'The answer is {ans}. {why} Good try!', hi: 'जवाब है {ans}। {why} अच्छी कोशिश!' },
  notHeard:   { en: "I didn't hear a number. Say it once more?", hi: 'मुझे संख्या सुनाई नहीं दी। फिर से बोलो?' },
  notHeardYN: { en: "I didn't hear. Say yes or no?", hi: 'मुझे सुनाई नहीं दिया। हाँ या नहीं बोलो?' },
  notHeardRd: { en: "I couldn't hear clearly. Read it once more?", hi: 'मुझे ठीक से सुनाई नहीं दिया। एक बार फिर पढ़ो?' },
  moveOn:     { en: "Let's try a new one.", hi: 'चलो, नया सवाल।' },
  next:       { en: 'Next one.', hi: 'अगला।' },
  readFirst:  { en: "Now look at today's card. Read line 1 to me.", hi: 'अब आज का कार्ड देखो। पहली लाइन पढ़कर सुनाओ।' },
  readNext:   { en: 'Now read line {k}.', hi: 'अब {k} लाइन पढ़ो।' },
  readCoachW: { en: 'Almost! Listen to this word: {w}. Now read the whole line again.', hi: 'लगभग! यह शब्द सुनो: {w}। अब पूरी लाइन फिर से पढ़ो।' },
  readCoach:  { en: 'Nice try! Listen: {line} Now you read it once more.', hi: 'अच्छी कोशिश! सुनो: {line} अब एक बार फिर पढ़ो।' },
  readModel:  { en: 'Well tried! It says: {line} We will read it again another day.', hi: 'बढ़िया कोशिश! इसमें लिखा है: {line} इसे फिर किसी दिन पढ़ेंगे।' },
  noCard:     { en: 'No problem! Say it after me: {line}', hi: 'कोई बात नहीं! मेरे बाद बोलो: {line}' },
  repeatMe:   { en: 'Say it after me: {line}', hi: 'मेरे बाद बोलो: {line}' },
  repeatGood: { en: 'Lovely! You said it beautifully.', hi: 'बहुत प्यारा! तुमने बहुत अच्छे से बोला।' },
  repeatTry:  { en: 'Good try! Listen once more: {line}', hi: 'अच्छी कोशिश! एक बार फिर सुनो: {line}' },
  repeatDone: { en: "Good try! Let's go on.", hi: 'अच्छी कोशिश! चलो आगे बढ़ें।' },
  readSlip:   { en: 'Lovely reading! Just one small thing: {w}.', hi: 'बहुत अच्छा पढ़ा! बस एक छोटी बात: {w}।' },
  finish:     { en: "That's all for today! {what} Shabaash! Bye bye!", hi: 'आज के लिए इतना ही! {what} शाबाश! बाय-बाय!' },
  finishBare: { en: "That's all for today! Thank you for practising with me. Bye bye!", hi: 'आज के लिए इतना ही! मेरे साथ अभ्यास करने के लिए धन्यवाद। बाय-बाय!' },
  didSums:    { en: 'You worked on {m} sums', hi: 'तुमने {m} सवाल किए' },
  didRead:    { en: 'you read {r} lines', hi: '{r} लाइनें पढ़ीं' },
  didReadOnly:{ en: 'You read {r} lines.', hi: 'तुमने {r} लाइनें पढ़ीं।' },
  and:        { en: ' and ', hi: ' और ' },
  stop:       { en: "Okay, we'll stop here. You did really well today. Bye bye!", hi: 'ठीक है, आज यहीं रुकते हैं। तुमने बहुत अच्छा किया। बाय-बाय!' },
  over:       { en: 'Our lesson is finished for today. Bye bye!', hi: 'आज का पाठ पूरा हो गया। बाय-बाय!' },
  yes:        { en: 'yes', hi: 'हाँ' },
  no:         { en: 'no', hi: 'नहीं' },
  ordinal:    { en: ['1', '2', '3', '4'], hi: ['पहली', 'दूसरी', 'तीसरी', 'चौथी'] }
};

/* ---------------- story problems from the validated lesson bank ----------------
   Each concept the app teaches with pictures gets a spoken version. The
   number the child must say is NOT computed here: it is read from the
   lesson's own checkpoint, after validateLesson() has passed it. `expect`
   recomputes it independently, and a lesson where the two disagree is
   dropped at load — so a typo in a template can never change an answer. */
const STORY = {
  count:   { q: { en: 'Count with me: {seq}. How many did we count?', hi: 'मेरे साथ गिनो: {seq}। हमने कितने गिने?' }, expect: p => p.n },
  compare: { q: { en: 'Which is more, {a} or {b}?', hi: 'ज़्यादा कौन है, {a} या {b}?' }, expect: p => Math.max(p.a, p.b) },
  add:     { q: { en: 'There are {a} mangoes. {b} more arrive. How many mangoes now?', hi: '{a} आम हैं। {b} और आ गए। अब कितने आम?' }, expect: p => p.a + p.b },
  take:    { q: { en: 'There are {a} birds on a tree. {b} fly away. How many are left?', hi: 'पेड़ पर {a} चिड़ियाँ हैं। {b} उड़ गईं। कितनी बचीं?' }, expect: p => p.a - p.b },
  bond:    { q: { en: '{b} and what makes 10?', hi: '{b} और कितने मिलकर दस बनते हैं?' }, expect: p => 10 - p.b },
  group:   { q: { en: 'How many bundles of ten are in {a}?', hi: '{a} में दस-दस के कितने बंडल हैं?' }, expect: p => Math.floor(p.a / 10) },
  carry:   { q: { en: 'What is {a} plus {b}?', hi: '{a} और {b} कितने होते हैं?' }, expect: p => p.a + p.b },
  barsub:  { q: { en: 'What is {a} minus {b}?', hi: '{a} में से {b} घटाओ, तो कितने बचे?' }, expect: p => p.a - p.b },
  skip:    { q: { en: 'Start at zero and jump {b} each time. After {hops} jumps, where are you?', hi: 'शून्य से शुरू करो, हर बार {b} की छलाँग। {hops} छलाँगों के बाद कहाँ पहुँचे?' }, expect: p => p.b * p.hops },
  array:   { q: { en: 'There are {a} rows of chairs, with {b} chairs in each row. How many chairs?', hi: 'कुर्सियों की {a} पंक्तियाँ हैं, हर पंक्ति में {b} कुर्सियाँ। कुल कितनी कुर्सियाँ?' }, expect: p => p.a * p.b },
  table:   { q: { en: 'What is {a} times {b}?', hi: '{a} गुणा {b} कितना होता है?' }, expect: p => p.a * p.b },
  share:   { q: { en: 'Share {a} laddoos equally between {b} friends. How many does each friend get?', hi: '{a} लड्डू {b} दोस्तों में बराबर बाँटो। हर दोस्त को कितने मिलेंगे?' }, expect: p => p.a / p.b },
  frac:    { q: { en: 'A roti is cut into {b} equal pieces. How many pieces are there?', hi: 'एक रोटी को {b} बराबर टुकड़ों में काटा। कितने टुकड़े हैं?' }, expect: p => p.b },
  money:   { q: { en: 'You have {a} rupees. Your uncle gives you {b} more. How many rupees now?', hi: 'तुम्हारे पास {a} रुपये हैं। चाचा {b} रुपये और देते हैं। अब कितने रुपये?' }, expect: p => p.a + p.b },
  spend:   { q: { en: 'You have {a} rupees and spend {b}. How many rupees are left?', hi: 'तुम्हारे पास {a} रुपये हैं, {b} खर्च किए। कितने बचे?' }, expect: p => p.a - p.b },
  twostep: { q: { en: '{a} children are playing. {b} more join. Then {c} go home. How many are playing now?', hi: '{a} बच्चे खेल रहे हैं। {b} और आ गए। फिर {c} घर चले गए। अब कितने खेल रहे हैं?' }, expect: p => p.a + p.b - p.c },
  measure: { q: { en: 'A ruler is {b} centimetres long. Put it down {hops} times in a row. How many centimetres?', hi: 'एक पैमाना {b} सेंटीमीटर का है। उसे {hops} बार लगातार रखो। कुल कितने सेंटीमीटर?' }, expect: p => p.b * p.hops },
  oddeven: { q: { en: 'Is {n} an even number? Say yes or no.', hi: 'क्या {n} सम संख्या है? हाँ या नहीं बोलो।' }, expect: p => p.n % 2 === 0, yesno: true },
  half:    { q: { en: 'What is half of {a}?', hi: '{a} का आधा कितना है?' }, expect: p => p.a / 2 }
};

/* ---------------- small helpers ---------------- */
function fill(tpl, lang, vars) {
  let s = tpl[lang] || tpl.en;
  for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const nw = (n, lang) => numberWord(n, lang);
function seq(from, to, step, lang) {
  const out = []; for (let v = from; v <= to; v += step) out.push(nw(v, lang));
  return out.join(', ');
}
function pick(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length]; }

/* Build the voice story bank once: every concept × parameter, validated by
   the app's own validator, cross-checked against STORY[...].expect. */
function buildStoryBank(T) {
  const bank = [], dropped = [];
  for (const c of T.CONCEPTS) {
    const tpl = STORY[c.id];
    if (!tpl) continue;
    for (const p of c.space()) {
      const les = {
        id: `gen-${c.id}-${Object.values(p).join('-')}`,
        band: c.band, concept: c.id, generated: true,
        title: c.title(p), sub: c.sub(p), beats: c.beats(p)
      };
      if (!T.validateLesson(les).ok) { dropped.push(les.id + ' (validator)'); continue; }
      const ask = les.beats.find(b => b.t === 'ask');
      const marked = ask.opts[ask.correct];
      const other = ask.opts.find((o, i) => i !== ask.correct);
      const want = tpl.expect(p);
      let answer, distractor;
      if (tpl.yesno) {
        answer = marked === 'Yes';
        if (answer !== want) { dropped.push(les.id + ' (yes/no mismatch)'); continue; }
      } else {
        answer = Number(marked); distractor = Number(other);
        if (answer !== want) { dropped.push(`${les.id} (template says ${want}, lesson says ${marked})`); continue; }
      }
      const win = les.beats.find(b => b.t === 'win');
      bank.push({ id: les.id, band: c.band, concept: c.id, p, answer, distractor, win: win && win.say });
    }
  }
  return { bank, dropped };
}

/* ---------------- planning ---------------- */
function bandPlan(bandId) {
  if (bandId === 'pre')   return ['warm', 'math', 'repeat', 'math', 'story', 'repeat', 'math'];
  if (bandId === 'early') return ['warm', 'math', 'read', 'math', 'story', 'read', 'math'];
  return ['warm', 'math', 'read', 'math', 'story', 'read', 'math', 'read'];
}

/* Plan a session. Reading lines are chosen NOW, because they go on the
   card the family sees before the call; maths is generated lazily, at
   the moment it is asked, so a level-up mid-call takes effect at once. */
function planSession(core, child, opts) {
  opts = opts || {};
  const id = opts.id || crypto.randomBytes(12).toString('base64url');
  const lang = child.lang === 'en' ? 'en' : 'hi';
  const seed = opts.seed || id;
  const { out, trace } = core.withChild(child.profile, { lang, seed }, T => {
    const b = T.band();
    const slots = bandPlan(b.id);
    const nRead = slots.filter(s => s === 'read' || s === 'repeat').length;
    const pool = T.ageSentences(lang, T.S.levels.read).slice();
    const r = T.rng(T.seedOf(seed + '|lines'));
    const lines = [];
    while (lines.length < nRead && pool.length) lines.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return { band: b.id, slots, lines, levels: { ...T.S.levels } };
  });
  return {
    id, child_id: child.id, lang, seed,
    band: out.band, slots: out.slots, lines: out.lines,
    levels_before: out.levels,
    status: 'planned', created_at: new Date().toISOString(),
    started_at: null, ended_at: null,
    cursor: 0, turns: 0, items: [], trace: trace.map(t => t.msg), ended_by: null
  };
}

/* ---------------- serving ---------------- */
function currentItem(s) {
  const it = s.items[s.items.length - 1];
  return it && !it.outcome ? it : null;
}

function buildItem(core, child, s, slot, storyBank) {
  const lang = s.lang;
  const k = s.items.length;
  const { out, trace } = core.withChild(child.profile, { lang, seed: s.seed + '|' + k }, T => {
    const r = T.rng(T.seedOf(s.seed + '|item|' + k));
    const b = T.band();
    if (slot === 'warm') {
      if (b.id === 'pre' || b.id === 'early') {
        const top = 2 + Math.floor(r() * 4);                  // count 1..top, ask top+1
        return { kind: 'warm', expect: 'number', answer: top + 1, distractor: top + 2,
                 prompt: fill(L.warmCount, lang, { seq: seq(1, top, 1, lang) }) };
      }
      const step = pick([2, 5, 10], r), n = 3;
      // the clue offers "counting on by one" — the slip a child actually makes
      return { kind: 'warm', expect: 'number', answer: step * (n + 1), distractor: step * n + 1,
               prompt: fill(L.warmSkip, lang, { s: nw(step, lang), seq: seq(step, step * n, step, lang) }) };
    }
    if (slot === 'math') {
      const lvl = T.S.levels.math;
      const g = T.genProblem(lvl);
      const op = g.op === '+' ? 'plus' : g.op === '×' ? 'times' : 'minus';
      const v = { a: nw(g.a, lang), b: nw(g.b, lang), ans: nw(g.ans, lang) };
      // the clue is the CLOSEST wrong option: off-by-one is the mistake a
      // child actually makes, so it is the one worth choosing between
      const wrong = g.opts.filter(o => o !== g.ans).sort((x, y) => Math.abs(x - g.ans) - Math.abs(y - g.ans))[0];
      return { kind: 'math', level: lvl, expect: 'number', answer: g.ans, distractor: wrong,
               problem: `${g.a} ${g.op} ${g.b}`,
               prompt: fill(L[op], lang, v), why: fill(L[op + 'Why'], lang, v) };
    }
    if (slot === 'story') {
      const done = T.S.doneLessons || [];
      const mine = storyBank.filter(x => x.band === b.id);
      const fresh = mine.filter(x => !done.includes(x.id));
      const pool = fresh.length ? fresh : mine;
      if (!pool.length) return null;
      const st = pick(pool, r);
      T.S.doneLessons = done.concat(st.id).slice(-200);
      const tpl = STORY[st.concept];
      const p = st.p, v = {};
      for (const key of ['a', 'b', 'c', 'n', 'hops']) if (p[key] != null) v[key] = nw(p[key], lang);
      if (st.concept === 'count') v.seq = seq(1, p.n, 1, lang);
      const why = st.win ? (st.win[lang] || st.win.en) : '';
      if (tpl.yesno) {
        return { kind: 'story', concept: st.concept, lesson_id: st.id, expect: 'yesno', answer: st.answer,
                 prompt: fill(tpl.q, lang, v), why };
      }
      return { kind: 'story', concept: st.concept, lesson_id: st.id, expect: 'number',
               answer: st.answer, distractor: st.distractor, prompt: fill(tpl.q, lang, v), why };
    }
    if (slot === 'read' || slot === 'repeat') {
      const lineNo = s.items.filter(x => x.kind === 'read' || x.kind === 'repeat').length;
      const line = s.lines[lineNo];
      if (!line) return null;
      if (slot === 'repeat') {
        return { kind: 'repeat', expect: 'reading', target: line, line_no: lineNo + 1,
                 prompt: fill(L.repeatMe, lang, { line }) };
      }
      const prompt = lineNo === 0 ? fill(L.readFirst, lang, {})
        : fill(L.readNext, lang, { k: lang === 'hi' ? L.ordinal.hi[lineNo] : L.ordinal.en[lineNo] });
      return { kind: 'read', expect: 'reading', target: line, line_no: lineNo + 1, prompt };
    }
    return null;
  });
  if (!out) return null;
  if (out.expect === 'number' && (out.distractor == null || out.distractor === out.answer)) out.distractor = out.answer + 1;
  return Object.assign(out, { slot, n: k + 1, attempts: 0, said: [], prompts: [], outcome: null, trace: trace.map(t => t.msg) });
}

/* Advance to the next item and return its prompt, or finish. */
function advance(core, child, s, storyBank, lead) {
  while (s.cursor < s.slots.length) {
    if (Date.now() - Date.parse(s.started_at) > MAX_CALL_MS) break;
    const slot = s.slots[s.cursor++];
    const it = buildItem(core, child, s, slot, storyBank);
    if (!it) continue;
    s.items.push(it);
    it.prompts.push(it.prompt);
    return reply(s, joinSay(lead, it.prompt), it);
  }
  return finish(s, lead, 'plan');
}

function joinSay(...parts) { return parts.filter(Boolean).join(' '); }

function reply(s, say, it) {
  return { say, expect: it ? it.expect : 'none', done: false, item: it ? it.n : null, of: s.slots.length };
}

function finish(s, lead, why) {
  const lang = s.lang;
  let line;
  if (why === 'stop') line = L.stop[lang];
  else if (why === 'over') line = L.over[lang];
  else {
    const m = s.items.filter(x => (x.kind === 'math' || x.kind === 'story') && x.outcome && x.outcome !== 'unsure').length;
    const rd = s.items.filter(x => (x.kind === 'read' || x.kind === 'repeat') && x.outcome && x.outcome !== 'unsure').length;
    if (!m && !rd) line = L.finishBare[lang];
    else {
      let what;
      if (m && rd) what = fill(L.didSums, lang, { m: nw(m, lang) }) + L.and[lang] + fill(L.didRead, lang, { r: nw(rd, lang) }) + (lang === 'hi' ? '।' : '.');
      else if (m) what = fill(L.didSums, lang, { m: nw(m, lang) }) + (lang === 'hi' ? '।' : '.');
      else what = fill(L.didReadOnly, lang, { r: nw(rd, lang) });
      line = fill(L.finish, lang, { what });
    }
  }
  if (!s.ended_by) { s.ended_by = why; s.status = 'ended'; s.ended_at = new Date().toISOString(); }
  s.goodbye = line;
  return { say: joinSay(lead, line), expect: 'none', done: true, item: null, of: s.slots.length };
}

/* ---------------- the two things the voice agent can ask for ---------------- */

/* "What should I say now?" Idempotent: if a question is open it is
   repeated, not replaced — a confused model calling this twice must not
   skip a child's turn. */
function next(core, child, s, storyBank) {
  if (s.ended_by) return { say: s.goodbye || L.over[s.lang], expect: 'none', done: true, item: null, of: s.slots.length };
  if (!s.started_at) { s.started_at = new Date().toISOString(); s.status = 'live'; }
  const open = currentItem(s);
  if (open) return reply(s, open.prompts[open.prompts.length - 1], open);
  return advance(core, child, s, storyBank, s.items.length ? '' : L.start[s.lang]);
}

/* The child said something. Decide, record, and say what comes next. */
function answer(core, child, s, storyBank, said) {
  said = String(said == null ? '' : said).trim().slice(0, 500);
  if (s.ended_by) return next(core, child, s, storyBank);
  if (!s.started_at) return next(core, child, s, storyBank);
  s.turns++;
  if (s.turns > MAX_TURNS || Date.now() - Date.parse(s.started_at) > MAX_CALL_MS) {
    const open = currentItem(s); if (open) open.outcome = 'unsure';
    return finish(s, '', 'over');
  }
  const it = currentItem(s);
  if (!it) return next(core, child, s, storyBank);
  const lang = s.lang;
  const intent = intentOf(said);
  it.said.push(said);

  const ask = (say) => { it.prompts.push(say); return reply(s, say, it); };
  const done = (outcome, lead) => {
    it.outcome = outcome;
    return advance(core, child, s, storyBank, lead);
  };
  const stopNow = () => { it.outcome = 'unsure'; return finish(s, '', 'stop'); };
  const again = () => { it.said.pop(); return reply(s, it.prompts[it.prompts.length - 1], it); };

  /* ---- numbers and yes/no ---- */
  if (it.expect === 'number' || it.expect === 'yesno') {
    if (intent === 'stop') return stopNow();
    if (intent === 'repeat') return again();
    const yn = it.expect === 'yesno';
    const got = intent === 'dontKnow' ? null : (yn ? parseYesNo(said) : parseNumber(said, lang));
    const ansWord = yn ? (it.answer ? L.yes[lang] : L.no[lang]) : nw(it.answer, lang);

    if (got === null && intent !== 'dontKnow') {
      // doubt, not a miss: one more try, then move on recording nothing
      it.unheard = (it.unheard || 0) + 1;
      if (it.unheard >= 2) return done('unsure', L.moveOn[lang]);
      return ask(yn ? L.notHeardYN[lang] : L.notHeard[lang]);
    }

    it.attempts++;
    const right = got === it.answer;
    if (right) {
      const first = it.attempts === 1;
      let lead = pick(L.praise, rngFor(s, it))[lang];
      if (it.kind === 'math' || it.kind === 'story') {
        const mv = recordOutcome(core, child, s, 'math', first);
        if (mv === 'up') lead = joinSay(lead, L.levelUp[lang]);
      }
      return done(first ? 'correct' : 'correct_after_clue', lead);
    }
    if (it.attempts === 1) {
      if (yn) return ask(L.clueYN[lang]);
      const pair = rngFor(s, it)() < 0.5 ? [it.answer, it.distractor] : [it.distractor, it.answer];
      const tpl = intent === 'dontKnow' ? L.clueDK : L.clue;
      return ask(fill(tpl, lang, { x: nw(pair[0], lang), y: nw(pair[1], lang) }));
    }
    if (it.kind === 'math' || it.kind === 'story') recordOutcome(core, child, s, 'math', false);
    const why = it.why || '';
    return done('revealed', fill(yn ? L.revealYN : L.reveal, lang, { ans: ansWord, why }).replace(/\s+/g, ' '));
  }

  /* ---- reading a line from the card, or saying it after Munni ---- */
  if (it.expect === 'reading') {
    const g = gradeLine(core, child, s, it.target, [said]);
    // Intents only count when the child is clearly NOT reading the line:
    // a sentence on the card may itself contain "फिर से" or "नहीं है".
    if (g.score < 40) {
      if (intent === 'stop') return stopNow();
      if (intent === 'repeat') return again();
      // "I don't have the card" → say-after-me, so the call still teaches
      if (it.kind === 'read' && it.attempts === 0 && !it.no_card &&
          (intent === 'dontKnow' || parseYesNo(said) === false || looksLikeNoCard(said))) {
        it.kind = 'repeat'; it.no_card = true; it.said.pop();
        return ask(fill(L.noCard, lang, { line: it.target }));
      }
    }
    /* A phone transcript has no confidence score, so gradeVerdict() calls
       every partial reading 'unsure'. For what Munni SAYS, a child who read
       half the line deserves coaching, not "I couldn't hear" — so between
       30 and the gate we coach. What gets RECORDED is decided after the
       call, from Bolna's own transcript, with the app's verdict unchanged
       (see report.js) — so the gate still protects the child's record. */
    const verdict = g.verdict === 'unsure' && g.score >= 30 ? 'coach' : g.verdict;
    it.live = it.live || [];
    it.live.push({ score: g.score, verdict, misread: g.misread, slips: g.slips });

    if (verdict === 'unsure') {
      it.unheard = (it.unheard || 0) + 1;
      if (it.unheard >= 2) return done('unsure', L.moveOn[lang]);
      return ask(it.kind === 'repeat' ? fill(L.repeatTry, lang, { line: it.target }) : L.notHeardRd[lang]);
    }
    it.attempts++;
    if (verdict === 'pass') {
      let lead = it.kind === 'repeat' ? L.repeatGood[lang] : pick(L.readPraise, rngFor(s, it))[lang];
      // a pass can still skip or slip on one word: name it, gently, once
      const w = (g.misread || [])[0] || (g.slips || [])[0];
      if (it.kind === 'read' && w) lead = fill(L.readSlip, lang, { w: w.replace(/[.,!?।]/g, '') });
      return done(it.attempts === 1 ? 'correct' : 'correct_after_clue', lead);
    }
    if (it.attempts === 1) {
      if (it.kind === 'repeat') return ask(fill(L.repeatTry, lang, { line: it.target }));
      if (g.misread.length === 1) return ask(fill(L.readCoachW, lang, { w: g.misread[0] }));
      return ask(fill(L.readCoach, lang, { line: it.target }));
    }
    return done('revealed', it.kind === 'repeat' ? L.repeatDone[lang] : fill(L.readModel, lang, { line: it.target }));
  }

  return done('unsure', '');
}

function looksLikeNoCard(said) {
  return /card|kard|कार्ड|nahi hai|नहीं है|nahin hai|don'?t have|no card|पता नहीं|pata nahi/i.test(said);
}

function rngFor(s, it) {
  // stable per item+attempt, so a replay says the same praise
  const seedStr = s.seed + '|say|' + it.n + '|' + it.attempts + '|' + it.said.length;
  let h = 2166136261; for (const c of seedStr) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let t = h >>> 0;
  return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

/* record() is the app's adaptive engine — rolling window, age-clamped. */
function recordOutcome(core, child, s, mod, ok) {
  const { out, trace } = core.withChild(child.profile, { lang: s.lang }, T => T.record(mod, ok));
  for (const t of trace) s.trace.push(t.msg);
  return out;
}

/* The app's matcher, unchanged. A phone transcript carries no confidence
   score, so confidence is 0: per gradeVerdict(), anything under the gate
   score becomes 'unsure' — asked again, never marked down. */
function gradeLine(core, child, s, target, alternatives) {
  const { out } = core.withChild(child.profile, { lang: s.lang }, T => {
    const best = T.gradeBest(target, alternatives.map(t => ({ transcript: t, confidence: 0 })), s.lang);
    return { score: best.score, verdict: T.gradeVerdict(best), misread: best.misread, slips: best.slips,
             tokens: best.tokens.map(x => ({ text: x.text, state: x.state, heard: x.heard })) };
  });
  return out;
}

module.exports = { planSession, next, answer, finish, buildStoryBank, gradeLine, recordOutcome, L, STORY, MAX_CALL_MS, MAX_TURNS };
