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
   · How they get things wrong. Each wrong answer is put down to the named
     mistake it really is (core/mathgen.js's whichMistake(): forgot to
     carry, took the smaller digit from the bigger…). A mistake made twice
     lately on a skill is a habit, and the next explanation goes at it.
   · A guess before each question. Before a question is answered the twin
     says what it expects this child to tap — the right answer, or which
     wrong one — and afterwards checks itself. How often it guesses the
     exact answer is an honest measure of how well Takhti knows how this
     child thinks; it should rise as the record grows.

   Nothing here is a label or a type. It is evidence, kept on this phone
   (S.twin is never in the circle's sync), and the summary a parent sees.
   ================================================================== */
const TWIN_P0 = 0.3, TWIN_SLIP = 0.1, TWIN_LEARN = 0.15, TWIN_DAY = 864e5;
let TWIN_EXP = null;   // the guess for the question on screen: { key, skill, answer, pRight, why }

function twinOf(c){
  const ch = c || S;
  if(!ch.twin || ch.twin.v !== 1) ch.twin = { v: 1, k: {}, bugs: {}, recent: {}, preds: [] };
  return ch.twin;
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

/* Which mistake this answer was, kept per skill. Returns 'right', the
   mistake's id, or 'other'. */
function twinAnswer(skill, p, given, c){
  if(!skill || !p) return null;
  const tw = twinOf(c), id = whichMistake(p, given);
  const rec = tw.recent[skill] = (tw.recent[skill] || []).concat({ id, at: Date.now() }).slice(-8);
  if(id !== 'right' && id !== 'other'){
    const b = (tw.bugs[skill] = tw.bugs[skill] || {})[id] = (tw.bugs[skill] || {})[id] || { n: 0, last: null };
    b.n++; b.last = new Date().toISOString();
    if(typeof log === 'function') log(0, `Twin · ${skill}: ${p.a} ${p.op} ${p.b}${p.c != null ? ' × ' + p.c : ''} = ${given} — ${MISTAKES[id].en}${rec.filter(x => x.id === id).length >= 2 ? ' (again: a habit now)' : ''}`);
  }
  return id;
}

/* A mistake this child keeps making on this skill: twice in their last
   eight answers on it, the latest within two weeks — and not yet put
   behind them (three right in a row since ends it). */
function twinHabit(skill, c){
  const rec = twinOf(c).recent[skill] || [];
  let run = 0;
  for(let i = rec.length - 1; i >= 0 && rec[i].id === 'right'; i--) run++;
  if(run >= 3) return null;
  const named = rec.filter(x => MISTAKES[x.id] && !/slip$/.test(x.id));   // a one-away slip is not a habit of thought
  const count = {};
  for(const x of named) count[x.id] = (count[x.id] || 0) + 1;
  const last = named[named.length - 1];
  const best = Object.entries(count).filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1])[0];
  if(!best || !last || Date.now() - last.at > 14 * TWIN_DAY) return null;
  return { id: best[0], n: best[1] };
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
  const all = mistakeAnswers(p);
  // their own habit first, then the most telling mistake for this question
  const habit = twinHabit(skill, c);
  const fromHabit = habit && all.find(x => x.id === habit.id && offered(x.v));
  if(fromHabit) return { answer: fromHabit.v, pRight, why: 'habit:' + habit.id };
  const bugs = twinOf(c).bugs[skill] || {};
  const seen = all.filter(x => bugs[x.id] && offered(x.v)).sort((x, y) => bugs[y.id].n - bugs[x.id].n)[0];
  if(seen) return { answer: seen.v, pRight, why: 'seen:' + seen.id };
  const common = all.find(x => offered(x.v));
  if(common) return { answer: common.v, pRight, why: 'common:' + common.id };
  return { answer: ans, pRight, why: 'right' };
}

/* The guess, made while the question is on screen (once per question). */
function twinExpect(key, skill, p, opts, c){
  if(!skill || !p || (TWIN_EXP && TWIN_EXP.key === key)) return TWIN_EXP;
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
  const hit = Number(given) === Number(e.answer);
  const rw = (right === true) === (e.pRight >= 0.5);
  tw.preds = tw.preds.concat({ at: Date.now(), skill: e.skill, hit, rw }).slice(-100);
  if(typeof log === 'function') log(0, `Twin · guessed ${e.answer}, the child answered ${given}: ${hit ? 'exactly right' : rw ? 'right/wrong right, not the exact answer' : 'missed'}`);
  return hit;
}

/* How well the twin knows this child: exact guesses lately, and at the start. */
function twinScore(c){
  const ps = twinOf(c).preds;
  if(ps.length < 5) return null;
  const rate = xs => xs.length ? xs.filter(x => x.hit).length / xs.length : null;
  const late = ps.slice(-20), early = ps.length >= 25 ? ps.slice(0, 20) : null;
  return { n: ps.length, late: { hit: late.filter(x => x.hit).length, of: late.length }, early: early ? { hit: early.filter(x => x.hit).length, of: early.length } : null,
           lateRate: rate(late), earlyRate: early ? rate(early) : null };
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
  const habits = Object.keys(tw.recent).map(skill => { const h = twinHabit(skill, ch); return h ? { skill, id: h.id, n: h.n } : null; }).filter(Boolean);
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
