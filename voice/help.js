/* ==================================================================
   "STILL STUCK? MUNNI CALLS" — the help call (server half)

   A child tapped "Ask Munni" on a question in the app, heard the instant
   explanation (src/core/explain.js, on the phone), and is still stuck.
   With a parent's Talking Munni switch on and a signal, the app opens a
   live voice call (the same web call as Talking Munni), and this file
   plans it: the SAME steps as the instant help, but asked one at a time
   — "first the tens: thirty and twenty?" — then the question itself.

   What the phone sends is only what the question is (two numbers and a
   sign, a reading line, or a lesson beat's id). The server works out
   every answer itself and never speaks text the phone made up: numbers
   are recomputed, a reading line must be one of the app's own sentences,
   a lesson beat comes from the server's own copy of the lesson bank.

   It teaches, it doesn't test: help steps are never recorded as the
   child's evidence (record() is only called for lesson items), and the
   app doesn't count the answer the child gives on screen afterwards.
   ================================================================== */
'use strict';

const HL = {
  start:  { en: "Let's work this one out together.", hi: 'चलो इस सवाल को साथ में समझते हैं।' },
  done:   { en: 'Shabaash! Now tap the answer on the screen too. Bye bye!', hi: 'शाबाश! अब स्क्रीन पर भी सही जवाब चुनकर दिखाओ। बाय-बाय!' },
  doneRead: { en: 'Lovely! Now read it on the screen once more. Bye bye!', hi: 'बहुत बढ़िया! अब स्क्रीन पर एक बार फिर पढ़कर दिखाओ। बाय-बाय!' },
  watch:  { en: 'Watch out for one thing:', hi: 'एक बात का ध्यान रखना:' },
  bare:   { en: 'Try it on the screen whenever you are ready. Bye bye!', hi: 'जब तैयार हो, स्क्रीन पर कोशिश करना। बाय-बाय!' },
  greet:  { en: n => `Hello ${n}! It's Munni. I heard this one is tricky. Shall we do it together?`,
            hi: n => `नमस्ते ${n}! मैं मुन्नी हूँ। यह सवाल थोड़ा मुश्किल लग रहा है? चलो साथ में करें, तैयार हो?` }
};

/* The question, checked: what kind it is and nothing the phone could use
   to put words in Munni's mouth. */
function cleanHelp(T, h) {
  h = h || {};
  if (h.kind === 'math') {
    const n = v => (v == null || v === '' ? null : Number(v));
    const p = { a: n(h.a), b: n(h.b), c: n(h.c), op: String(h.op || '') };
    if (![p.a, p.b].every(v => Number.isInteger(v) && v >= 0 && v <= 9999)) return null;
    if (p.c != null && !(Number.isInteger(p.c) && p.c >= 0 && p.c <= 99)) return null;
    if (!['+', '−', '-', '×', 'x', '*', '÷', '/'].includes(p.op)) return null;
    const x = T.explainMath(p);
    // a mistake the child keeps making (src/core/twin.js): only a known one
    // that this very question can produce — the tip is the server's own words
    const mistake = T.MISTAKES[h.mistake] && T.mistakeAnswers(p).some(m => m.id === h.mistake) ? h.mistake : null;
    return x ? { kind: 'math', x, p, mistake } : null;
  }
  if (h.kind === 'read') {
    const line = String(h.line || '').trim().slice(0, 160);
    const all = [];
    for (const lang of Object.keys(T.SENTENCES || {})) for (const lv of Object.values(T.SENTENCES[lang])) all.push(...lv);
    if (!all.includes(line)) return null;              // only the app's own lines
    const lang = /[ऀ-ॿ]/.test(line) ? 'hi' : 'en';
    const missed = Array.isArray(h.missed) ? h.missed.map(String).slice(0, 5) : [];
    const x = T.explainRead(line, missed, lang);
    return x ? { kind: 'read', x } : null;
  }
  if (h.kind === 'lesson') {
    const [id, beat] = String(h.id || '').split(':');
    const les = (T.lessonBank() || []).find(l => l.id === id);
    const i = Number(beat);
    if (!les || !Number.isInteger(i)) return null;
    const x = T.explainLessonBeat(les, i);
    if (!x) return null;
    return { kind: x.kind === 'count' ? 'count' : 'math', x, beat: les.beats[i] };
  }
  return null;
}

/* The steps as call items: whatever Munni only tells is said just before
   the next thing she asks, so every turn ends in a question. */
function itemsFor(S, T, help, lang) {
  const say = (tpl, vals) => T.xfill(tpl, vals, lang, n => S.nw(n, lang));
  const items = [];
  let carry = '';
  const near = a => (a >= 10 ? a + 10 : a + 1);
  if (help.kind === 'math') {
    const x = help.x;
    if (help.mistake) carry = S.joinSay(HL.watch[lang], T.mistakeTip(help.mistake, help.p, lang, n => S.nw(n, lang), true));
    for (const st of x.steps) {
      const told = say(st.tell, st.vals);
      if (st.ask && st.ans != null) {
        // the reveal explains (a step told as its question keeps its statement in `why`)
        items.push({ kind: 'helpstep', expect: 'number', answer: st.ans, distractor: near(st.ans),
                     prompt: S.joinSay(carry, say(st.ask, Object.assign({}, st.vals))), why: say(st.why || st.tell, st.vals) });
        carry = '';
      } else carry = S.joinSay(carry, told);
    }
    items.push({ kind: 'helpstep', expect: 'number', answer: x.ans, distractor: near(x.ans), problem: x.text,
                 prompt: S.joinSay(carry, say(x.final.tpl, x.final.vals)), why: '' });
  } else if (help.kind === 'count') {
    const b = help.beat, q = b.q ? (b.q[lang] || b.q.en) : '';
    items.push({ kind: 'helpstep', expect: 'number', answer: help.x.ans, distractor: near(help.x.ans),
                 prompt: S.joinSay(say(help.x.steps[0].tell, {}), q), why: '' });
  } else if (help.kind === 'read') {
    const x = help.x, [w, ln] = x.steps;
    items.push({ kind: 'helpsay', expect: 'reading', target: x.word, prompt: S.joinSay(say(w.tell, w.vals), say(w.ask, w.vals)) });
    items.push({ kind: 'helpsay', expect: 'reading', target: x.line, prompt: S.joinSay(say(ln.tell, ln.vals), say(ln.ask, ln.vals)) });
  }
  return items;
}

/* A session in the same shape planSession() makes, so the tools, the
   screen, the call and the report all work on it unchanged. */
function planHelp(core, child, opts) {
  const S = require('./session');
  const crypto = require('crypto');
  const lang = child.lang === 'en' ? 'en' : 'hi';
  const id = opts.id || crypto.randomBytes(12).toString('base64url');
  const { out } = core.withChild(child.profile, { lang }, T => {
    const help = cleanHelp(T, opts.help);
    if (!help) return null;
    return { band: T.band().id, items: itemsFor(S, T, help, lang), what: help.kind, levels: { ...T.S.levels } };
  });
  if (!out || !out.items.length) return null;
  return {
    id, child_id: child.id, lang, seed: id, kind: 'help', english: null,
    channel: opts.channel || 'app', keypad: false,
    band: out.band, slots: out.items.map((_, i) => 'help:' + i), help_items: out.items, help_what: out.what,
    lines: [], homework_skill: null, focus_source: null, ease: null, circle_check: null, circle_home: null,
    levels_before: out.levels,
    status: 'planned', created_at: new Date().toISOString(), started_at: null, ended_at: null,
    cursor: 0, turns: 0, items: [], trace: [], ended_by: null
  };
}

module.exports = { planHelp, cleanHelp, itemsFor, HL };
