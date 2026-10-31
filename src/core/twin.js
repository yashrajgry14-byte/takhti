/* ==================================================================
   TWIN — a model of how THIS child thinks (Tier 0, stays on the phone)

   core/mind.js learns which way of teaching works for a child. This file
   keeps the rest of the picture, built only from the child's own answers:

   · What they know, and how it fades (knowledge tracing). One live number
     per skill — how likely they are to get it right today. Each answer
     updates it the standard way (Bayesian knowledge tracing: a right
     answer might be a lucky guess, a wrong one might be a slip), and time
     away lowers it: a skill not used for a while fades, more slowly each
     time it was got right on a different day. Never to nothing.
   · How they get things wrong — in all three subjects. A wrong sum is put
     down to the named mistake it really is (core/mathgen.js's
     whichMistake(): forgot to carry, took the smaller digit from the
     bigger…); an answer no single mistake explains is matched against
     combinations of wrong column steps (procMatches()), and a combination
     that explains answers to two DIFFERENT questions becomes this child's
     own mistake (tw.found) — what nothing explains is kept for the shared
     database to look at (tw.unexplained, question and answer only). A
     reading or writing slip comes named from core/lang-mistakes.js
     (twinNote()). A mistake made twice lately is a habit, and it decides
     the next explanation (mistakeExplain(), langTip()).
   · A guess before each question. Before a question is answered the twin
     says what it expects this child to tap — the right answer, or which
     wrong one — and afterwards checks itself (sums: the exact answer;
     story questions, games, reading, writing: right or not). How often it
     guesses right is an honest measure of how well Takhti knows how this
     child thinks; it should rise as the record grows.
   · A profile (twinProfile()): the picture in a small, checked structure —
     ids only, no name, no raw history — that Munni's calls and any model
     step (twinPrompt()) use to teach this child the same way the app does.

   Nothing here is a label or a type. It is evidence. S.twin stays on this
   phone; only the profile travels, and only where a parent allowed it.
   ================================================================== */
const TWIN_P0 = 0.3, TWIN_SLIP = 0.1, TWIN_LEARN = 0.15, TWIN_DAY = 864e5;
let TWIN_EXP = null;   // the guess for the question on screen: { key, skill, answer, pRight, why }

function twinOf(c){
  const ch = c || S;
  if(!ch.twin || ch.twin.v !== 1) ch.twin = { v: 1, k: {}, bugs: {}, recent: {}, preds: [] };
  const tw = ch.twin;
  tw.unknown = tw.unknown || []; tw.found = tw.found || {}; tw.unexplained = tw.unexplained || [];
  return tw;
}

const twinDayOf = t => new Date(t).toISOString().slice(0, 10);

/* How long until an unused skill has faded half way: 4 days, doubling for
   each different day it was got right (4, 8, 16 … up to 128 days). */
function twinHalfLife(k){ return 4 * Math.pow(2, Math.min(5, (k.days || []).length)); }

/* How likely the child is to get this skill right now, 0–1, and what it
   was at its last answer. null when the twin has never seen the skill. */
function twinMastery(skill, c, now){
  const k = twinOf(c).k[skill];
  if(!k) return null;
  const dt = Math.max(0, ((now || Date.now()) - k.at) / TWIN_DAY);
  return { now: k.p * (0.5 + 0.5 * Math.pow(0.5, dt / twinHalfLife(k))), was: k.p, n: k.n, peak: k.peak || k.p, days: (k.days || []).length };
}

/* The child's own answer on a skill (never a helped one). `guess` is the
   chance of a lucky right answer: one over the number of choices. */
function twinObserve(skill, ok, c, guess){
  if(!skill) return;
  const ch = c || S, tw = twinOf(ch), now = Date.now();
  let prior;
  const m = twinMastery(skill, ch, now);
  if(m) prior = m.now;
  else {
    // a skill with history from before the twin starts from that history
    const h = (ch.skillHistory || {})[skill];
    const n = h ? h.n - 1 : 0, r = h ? h.right - (ok ? 1 : 0) : 0;
    prior = n >= 3 ? Math.min(0.9, Math.max(0.1, (r + 1) / (n + 2))) : TWIN_P0;
  }
  const g = Math.min(0.5, Math.max(0.02, guess == null ? 0.25 : guess));
  let p = ok ? prior * (1 - TWIN_SLIP) / (prior * (1 - TWIN_SLIP) + (1 - prior) * g)
             : prior * TWIN_SLIP / (prior * TWIN_SLIP + (1 - prior) * (1 - g));
  p = p + (1 - p) * TWIN_LEARN;
  const k = tw.k[skill] = tw.k[skill] || { p, at: now, n: 0, days: [] };
  k.p = Math.round(p * 1000) / 1000; k.at = now; k.n++;
  k.peak = Math.max(k.peak || 0, k.p);
  if(ok){ const d = twinDayOf(now); if(!k.days.includes(d)) k.days = k.days.concat(d).slice(-6); }
}

/* Is this a mistake the twin knows how to name? (a named or found sum
   mistake, or a reading/writing slip) */
function twinKnown(id){
  return !!((typeof mistakeLabel === 'function' && mistakeLabel(id)) || (typeof LMISTAKES !== 'undefined' && LMISTAKES[id]));
}
function twinLabel(id){
  return (typeof mistakeLabel === 'function' && mistakeLabel(id)) || (typeof LMISTAKES !== 'undefined' && LMISTAKES[id]) || null;
}
const twinQ = p => `${p.a}${MOP[p.op] || p.op}${p.b}${p.c != null ? '×' + p.c : ''}`;

function twinKeep(tw, skill, id, extra){
  const b = (tw.bugs[skill] = tw.bugs[skill] || {})[id] = (tw.bugs[skill] || {})[id] || { n: 0, last: null };
  b.n++; b.last = new Date().toISOString();
  if(extra && extra.pair) b.pair = extra.pair;
}

/* Which mistake this answer was, kept per skill. Returns 'right', the
   mistake's id (or a found combination's code), or 'other'. */
function twinAnswer(skill, p, given, c){
  if(!skill || !p) return null;
  const tw = twinOf(c), q = twinQ(p);
  let id = whichMistake(p, given);
  if(id === 'other'){
    // a combination of wrong steps this child has already shown?
    const codes = procMatches(p, given);
    const mine = codes.find(k => tw.found[k]);
    if(mine) id = mine;
    else if(codes.length){
      // the same combination behind a different question's answer: not a coincidence
      const earlier = tw.unknown.find(u => u.q !== q && u.codes.some(k => codes.includes(k)));
      if(earlier){
        id = codes.find(k => earlier.codes.includes(k));
        tw.found[id] = { at: new Date().toISOString(), skill, examples: [earlier.q + '=' + earlier.given, q + '=' + given] };
        twinKeep(tw, skill, id);                                      // the earlier answer was this too
        for(const r of tw.recent[earlier.skill] || []) if(r.id === 'other' && r.q === earlier.q) r.id = id;
        tw.unknown = tw.unknown.filter(u => u !== earlier);
        if(typeof log === 'function') log(0, `Twin · found a mistake nobody listed: ${mistakeLabel(id).en} (${earlier.q}=${earlier.given} and ${q}=${given})`);
      } else tw.unknown = tw.unknown.concat({ skill, q, given: Number(given), codes, at: Date.now() }).slice(-20);
    } else tw.unexplained = tw.unexplained.concat({ q, a: Number(given), at: Date.now() }).slice(-20);
  }
  const rec = tw.recent[skill] = (tw.recent[skill] || []).concat({ id, at: Date.now(), q }).slice(-8);
  if(id !== 'right' && id !== 'other'){
    twinKeep(tw, skill, id);
    if(typeof log === 'function') log(0, `Twin · ${skill}: ${p.a} ${p.op} ${p.b}${p.c != null ? ' × ' + p.c : ''} = ${given} — ${twinLabel(id).en}${rec.filter(x => x.id === id).length >= 2 ? ' (again: a habit now)' : ''}`);
  }
  return id;
}

/* A read line or a written letter: the slips core/lang-mistakes.js named
   (none = it went right). Each kind counts once per line. */
function twinNote(skill, mistakes, c){
  if(!skill) return [];
  const tw = twinOf(c), ids = [];
  for(const m of mistakes || []) if(m && LMISTAKES[m.id] && !ids.includes(m.id)){ ids.push(m.id); twinKeep(tw, skill, m.id, m); }
  const add = ids.length ? ids : ['right'];
  tw.recent[skill] = (tw.recent[skill] || []).concat(add.map(id => ({ id, at: Date.now() }))).slice(-8);
  if(ids.length && typeof log === 'function') log(0, `Twin · ${skill}: ${ids.map(id => LMISTAKES[id].en).join('; ')}`);
  return ids;
}

/* Mistakes the twin couldn't see itself: named by the voice server's own
   copy of this file during a Talking Munni talk or a phone lesson (they
   come back with the talk's results and the circle's sync). Checked, and
   not counted twice: the same mistake on the same sum within half an hour
   is the same answer. */
function twinFar(list, c){
  const tw = twinOf(c), now = Date.now();
  let n = 0;
  for(const x of (list || []).slice(0, 40)){
    if(!x || typeof x.skill !== 'string' || !/^[a-z0-9]{2,16}$/.test(x.skill)) continue;
    if(x.id !== 'right' && !twinKnown(x.id)) continue;
    const at = Number(x.at) || now, q = String(x.q || '').slice(0, 20);
    const rec = tw.recent[x.skill] = tw.recent[x.skill] || [];
    if(rec.some(r => r.id === x.id && r.q === q && Math.abs((r.at || 0) - at) < 30 * 60e3)) continue;
    rec.push({ id: x.id, at, q, far: true });
    rec.sort((p, r) => p.at - r.at);
    tw.recent[x.skill] = rec.slice(-8);
    if(x.id !== 'right') twinKeep(tw, x.skill, x.id);
    n++;
  }
  if(n && typeof log === 'function') log(2, `Twin · ${n} answer(s) from Munni's calls added to what Munni knows about how this child thinks`);
  return n;
}

/* Munni's guesses on phone lessons, checked there: they count in the same score. */
function twinFarGuesses(list, c){
  const tw = twinOf(c);
  const seen = new Set(tw.preds.map(p => p.at + '|' + p.skill));
  for(const g of (list || []).slice(0, 40)){
    if(!g || typeof g.skill !== 'string' || !(Number(g.at) > 0) || seen.has(g.at + '|' + g.skill)) continue;
    seen.add(g.at + '|' + g.skill);
    tw.preds.push({ at: Number(g.at), skill: g.skill.slice(0, 16), hit: !!g.hit, rw: !!g.rw, call: true });
  }
  tw.preds.sort((p, q) => p.at - q.at);
  tw.preds = tw.preds.slice(-100);
}

/* A mistake this child keeps making on this skill: twice in their last
   eight answers on it, the latest within two weeks — and not yet put
   behind them (three right in a row since ends it). */
function twinHabit(skill, c){
  const rec = twinOf(c).recent[skill] || [];
  let run = 0;
  for(let i = rec.length - 1; i >= 0 && rec[i].id === 'right'; i--) run++;
  if(run >= 3) return null;
  const named = rec.filter(x => twinKnown(x.id) && !/slip$/.test(x.id));   // a one-away slip is not a habit of thought
  const count = {};
  for(const x of named) count[x.id] = (count[x.id] || 0) + 1;
  const last = named[named.length - 1];
  const best = Object.entries(count).filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1])[0];
  if(!best || !last || Date.now() - last.at > 14 * TWIN_DAY) return null;
  const b = ((twinOf(c).bugs[skill] || {})[best[0]]) || {};
  return { id: best[0], n: best[1], pair: b.pair || null };
}

/* What the twin expects this child to answer. */
function twinPredict(skill, p, opts, c){
  const ans = mistakeAnswerOf(p);
  const m = twinMastery(skill, c);
  const g = opts && opts.length ? 1 / opts.length : 0.05;
  const mastery = m ? m.now : TWIN_P0;
  const pRight = mastery * (1 - TWIN_SLIP) + (1 - mastery) * g;
  if(pRight >= 0.5) return { answer: ans, pRight, why: 'right' };
  const offered = v => !opts || !opts.length || opts.map(Number).includes(v);
  const tw = twinOf(c);
  const all = mistakeAnswers(p).concat(procAnswers(p).filter(x => tw.found[x.code]).map(x => ({ id: x.code, v: x.v })));
  // their own habit first, then the most telling mistake for this question
  const habit = twinHabit(skill, c);
  const fromHabit = habit && all.find(x => x.id === habit.id && offered(x.v));
  if(fromHabit) return { answer: fromHabit.v, pRight, why: 'habit:' + habit.id };
  const bugs = tw.bugs[skill] || {};
  const seen = all.filter(x => bugs[x.id] && offered(x.v)).sort((x, y) => bugs[y.id].n - bugs[x.id].n)[0];
  if(seen) return { answer: seen.v, pRight, why: 'seen:' + seen.id };
  const common = all.find(x => offered(x.v));
  if(common) return { answer: common.v, pRight, why: 'common:' + common.id };
  return { answer: ans, pRight, why: 'right' };
}

/* The guess, made while the question is on screen (once per question). */
function twinExpect(key, skill, p, opts, c){
  if(!skill || (TWIN_EXP && TWIN_EXP.key === key)) return TWIN_EXP;
  if(!p){
    // no sum to work out (a story question, a game, a line to read, a
    // letter to write): the guess is right or not, from what they know
    const m = twinMastery(skill, c), mastery = m ? m.now : TWIN_P0, g = opts == null ? 0.25 : opts;
    const pRight = mastery * (1 - TWIN_SLIP) + (1 - mastery) * g;
    TWIN_EXP = { key, skill, answer: null, pRight, why: 'rw' };
    if(typeof log === 'function') log(0, `Twin · expects ${pRight >= 0.5 ? 'a right answer' : 'a slip'} on ${skill} (p(right) ${Math.round(pRight * 100)}%)`);
    return TWIN_EXP;
  }
  const g = twinPredict(skill, p, opts, c);
  TWIN_EXP = Object.assign({ key, skill }, g);
  if(typeof log === 'function') log(0, `Twin · expects ${g.answer} for ${p.a} ${p.op} ${p.b}${p.c != null ? ' × ' + p.c : ''} (p(right) ${Math.round(g.pRight * 100)}%${g.why !== 'right' ? ', ' + g.why : ''})`);
  return TWIN_EXP;
}

/* The child answered on their own: was the guess right? A helped answer
   is no test of the twin either — the caller passes helped and nothing is
   kept. */
function twinCheck(key, given, right, helped, c){
  const e = TWIN_EXP;
  if(!e || e.key !== key) return null;
  TWIN_EXP = null;
  if(helped) return null;
  const tw = twinOf(c);
  const hit = e.answer == null ? null : Number(given) === Number(e.answer);
  const rw = (right === true) === (e.pRight >= 0.5);
  tw.preds = tw.preds.concat({ at: Date.now(), skill: e.skill, hit, rw }).slice(-100);
  if(typeof log === 'function') log(0, e.answer == null ? `Twin · guessed ${e.pRight >= 0.5 ? 'right' : 'a slip'}: ${rw ? 'it was' : 'it was not'}`
    : `Twin · guessed ${e.answer}, the child answered ${given}: ${hit ? 'exactly right' : rw ? 'right/wrong right, not the exact answer' : 'missed'}`);
  return e.answer == null ? rw : hit;
}

/* How well the twin knows this child: exact guesses lately, and at the start. */
function twinScore(c){
  const all = twinOf(c).preds, ps = all.filter(x => x.hit != null);
  const rw = all.slice(-30), rwRate = rw.length ? rw.filter(x => x.rw).length / rw.length : null;
  if(ps.length < 5) return all.length >= 5 ? { n: 0, late: null, early: null, lateRate: null, earlyRate: null, rw: { hit: rw.filter(x => x.rw).length, of: rw.length }, rwRate } : null;
  const rate = xs => xs.length ? xs.filter(x => x.hit).length / xs.length : null;
  const late = ps.slice(-20), early = ps.length >= 25 ? ps.slice(0, 20) : null;
  return { n: ps.length, late: { hit: late.filter(x => x.hit).length, of: late.length }, early: early ? { hit: early.filter(x => x.hit).length, of: early.length } : null,
           lateRate: rate(late), earlyRate: early ? rate(early) : null, rw: { hit: rw.filter(x => x.rw).length, of: rw.length }, rwRate };
}

/* Skills fading since they were last got right: a refresher is due. */
function twinFading(c){
  const tw = twinOf(c), now = Date.now(), out = [];
  for(const skill of Object.keys(tw.k)){
    const m = twinMastery(skill, c, now);
    if(m && m.was >= 0.7 && m.now <= m.was - 0.15) out.push({ skill, was: m.was, now: m.now });
  }
  return out.sort((x, y) => (y.was - y.now) - (x.was - x.now));
}

/* The whole picture, in one small structure: what a parent reads, and
   all a teaching step needs to know about this child. No name, no id. */
function twinSummary(c){
  const ch = c || S, tw = twinOf(ch), now = Date.now();
  const habits = Object.keys(tw.recent).map(skill => { const h = twinHabit(skill, ch); return h ? { skill, id: h.id, n: h.n, pair: h.pair } : null; }).filter(Boolean);
  const rows = Object.keys(tw.k).map(skill => Object.assign({ skill }, twinMastery(skill, ch, now)));
  const best = typeof mindBest === 'function' ? { math: mindBest('math', ch), read: mindBest('read', ch) } : {};
  return {
    band: typeof band === 'function' ? band().id : null,
    knows: rows.filter(r => r.now >= 0.8 && !habits.some(h => h.skill === r.skill)).sort((x, y) => y.now - x.now).map(r => r.skill),
    working: rows.filter(r => r.now >= 0.35 && r.now < 0.8 && r.n >= 2).sort((x, y) => x.now - y.now).map(r => ({ skill: r.skill, p: Math.round(r.now * 100) })),
    fading: twinFading(ch).map(f => ({ skill: f.skill, was: Math.round(f.was * 100), now: Math.round(f.now * 100) })),
    habits,
    ways: { math: best.math ? best.math.way : null, read: best.read ? best.read.way : null },
    lang: ch.lang || S.lang,
    score: twinScore(ch)
  };
}

/* ==================================================================
   THE PROFILE — the picture, for Munni's calls and any model step

   Ids only (skills, ways, mistakes, letters), checked on both ends
   (twinCleanProfile()), no name, no id, no raw answers except the few
   unexplained sums the shared database looks at (question and answer).
   ================================================================== */
function twinProfile(c){
  const ch = c || S, sm = twinSummary(ch), m = ch.mind && ch.mind.plan ? ch.mind.plan : {};
  const tw = twinOf(ch);
  const plans = {};
  for(const [sk, pl] of Object.entries(m).slice(0, 10)) if(pl && pl.way) plans[sk] = pl.way;
  const letters = [];
  for(const h of sm.habits) for(const x of (h.pair || [])) if(x && x.length <= 4 && !letters.includes(x) && /[^\x00-\x7f]|^[a-z]{1,4}$/i.test(x)) letters.push(x);
  return twinCleanProfile({
    v: 1, band: sm.band, lang: sm.lang, ways: sm.ways, plans,
    habits: sm.habits.map(h => ({ skill: h.skill, id: h.id })),
    fading: sm.fading.map(f => f.skill), working: sm.working.map(w => ({ skill: w.skill, p: w.p })), knows: sm.knows,
    found: Object.keys(tw.found), letters,
    unexplained: tw.unexplained.slice(-10).map(u => ({ sum: u.q, a: u.a })),
    at: new Date().toISOString()
  });
}

/* Anything that claims to be a profile, reduced to what one may hold. */
function twinCleanProfile(p){
  if(!p || typeof p !== 'object') return null;
  const isSkill = id => typeof id === 'string' && (typeof skillById !== 'function' ? /^[a-z0-9]{2,16}$/.test(id) : !!skillById(id) || /^(read|write)[1-6]$/.test(id));
  const isWay = w => ['show', 'steps', 'story', 'cartoon', 'model', 'chunks', 'solo'].includes(w);
  const isMistake = id => typeof id === 'string' && (!!(MISTAKES[id]) || procValid(id) || (typeof LMISTAKES !== 'undefined' && !!LMISTAKES[id]));
  const arr = (x, n) => Array.isArray(x) ? x.slice(0, n) : [];
  const out = { v: 1 };
  out.band = ['pre', 'early', 'developing', 'fluent'].includes(p.band) ? p.band : null;
  out.lang = p.lang === 'en' ? 'en' : 'hi';
  out.ways = { math: isWay(p.ways && p.ways.math) ? p.ways.math : null, read: isWay(p.ways && p.ways.read) ? p.ways.read : null };
  out.plans = {};
  for(const [k, v] of Object.entries(p.plans || {}).slice(0, 10)) if(isSkill(k) && isWay(v)) out.plans[k] = v;
  out.habits = arr(p.habits, 6).filter(h => h && isSkill(h.skill) && isMistake(h.id)).map(h => ({ skill: h.skill, id: h.id }));
  out.fading = arr(p.fading, 6).filter(isSkill);
  out.working = arr(p.working, 6).filter(w => w && isSkill(w.skill)).map(w => ({ skill: w.skill, p: Math.max(0, Math.min(100, Math.round(Number(w.p) || 0))) }));
  out.knows = arr(p.knows, 8).filter(isSkill);
  out.found = arr(p.found, 10).filter(procValid);
  out.letters = arr(p.letters, 6).filter(x => typeof x === 'string' && x.length <= 4 && /^([ऀ-ॿ]+|[a-z]+)$/i.test(x));
  out.unexplained = arr(p.unexplained, 10).filter(u => u && /^\d{1,4}[+−×÷]\d{1,4}(×\d{1,2})?$/.test(String(u.sum)) && Number.isInteger(Number(u.a)) && Number(u.a) >= 0 && Number(u.a) < 1e6)
    .map(u => ({ sum: String(u.sum), a: Number(u.a) }));
  out.at = typeof p.at === 'string' && !isNaN(Date.parse(p.at)) ? p.at : null;
  return out;
}

/* The profile as a few plain sentences for a language model: how to pitch
   an answer or an explanation for THIS child. No name. */
function twinPrompt(p){
  if(!p) return '';
  const name = sk => { const s = typeof skillById === 'function' && skillById(sk); return s ? s.en : sk; };
  const WAYW = { show: 'by seeing it happen with objects', steps: 'step by step', story: 'through a story', cartoon: 'with a cartoon', model: 'by hearing it read first', chunks: 'by breaking words into pieces', solo: 'by trying on their own first' };
  const lines = [];
  const AGE = { pre: '3–4', early: '5–6', developing: '7–8', fluent: '9–10' };
  lines.push(`A child aged ${AGE[p.band] || 'about 3–10'}, most comfortable in ${p.lang === 'en' ? 'English' : 'Hindi'}.`);
  if(p.knows.length) lines.push(`Knows well: ${p.knows.map(name).join(', ')}.`);
  if(p.working.length) lines.push(`Still learning: ${p.working.map(w => `${name(w.skill)} (${w.p}%)`).join(', ')}.`);
  if(p.fading.length) lines.push(`Getting rusty: ${p.fading.map(name).join(', ')}.`);
  if(p.habits.length) lines.push(`Keeps making this mistake: ${p.habits.map(h => `${(twinLabel(h.id) || { en: h.id }).en} (${name(h.skill)})`).join('; ')}.`);
  if(p.letters.length) lines.push(`Letters to practise: ${p.letters.join(', ')}.`);
  const ways = [p.ways.math && `maths ${WAYW[p.ways.math]}`, p.ways.read && `reading ${WAYW[p.ways.read]}`].filter(Boolean);
  if(ways.length) lines.push(`Learns best: ${ways.join('; ')}.`);
  lines.push('Use short, warm sentences; never say "wrong"; explain the way that works for this child; for a sum, lead to the answer without saying it.');
  return lines.join(' ');
}
