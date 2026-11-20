/* ==================================================================
   MIND — how THIS child learns, learned from what works for them (Tier 0)

   A class teaches thirty children one way. Takhti keeps, for each child,
   a record of which way of teaching actually works for them, topic by
   topic, and teaches the next thing that way — and when a way stops
   working, it changes the plan and says so.

   It does not guess a "type" of learner. Matching lessons to a learning
   style (visual / auditory / …) has not held up in research. What does
   hold up is measuring: teach a topic one way, see how the child does on
   their own afterwards, keep what works. So:

   · Ways of teaching that the app really has (WAYS): for maths — seeing
     it happen with objects (the "Show me" animation), step by step (Ask
     Munni's explanation, core/explain.js), a story lesson, a cartoon
     episode; for reading — hearing the line first, breaking hard words
     into pieces, reading alone first.
   · Every teaching moment is labelled with its way (mindTaught()), from
     the child's own choices (they tapped "Show me", opened a story) or
     from Munni's plan. The next few answers the child gives ON THEIR OWN
     on that topic (never a helped answer) settle that teaching round:
     it stuck, or it didn't (mindAttempt()).
   · The plan for a topic (mindChoose()) keeps one way while it works —
     a child isn't jerked between methods — and switches after two rounds
     that didn't stick, or at once after a low school test mark
     (mindAssessment()), cooling the old way for a week. Choosing between
     ways is Thompson sampling: proven ways win, untried ones still get a
     fair chance.
   · It grows with the child: a topic never taught before starts from what
     has worked for this child across the whole subject so far, so by Class
     3 Munni already knows how this child takes in a new kind of sum.
   · School marks (a parent types them in; a class teacher sends a class
     test through the learning circle) are the strongest evidence: a low
     mark makes that topic the next focus and changes the way it's taught.

   It all stays on this phone (S.mind is never in the circle's sync).
   ================================================================== */
const WAYS = {
  math: {
    show:    { en: 'seeing it happen with objects', hi: 'चीज़ों से होते हुए देखकर' },
    steps:   { en: 'step by step',                  hi: 'एक-एक क़दम करके' },
    story:   { en: 'through a story',               hi: 'कहानी से' },
    cartoon: { en: 'with a cartoon',                hi: 'कार्टून से' }
  },
  read: {
    model:  { en: 'hearing it first, then reading',  hi: 'पहले सुनकर, फिर पढ़कर' },
    chunks: { en: 'breaking words into pieces',      hi: 'शब्दों को टुकड़ों में तोड़कर' },
    solo:   { en: 'reading on their own first',      hi: 'पहले ख़ुद पढ़कर' }
  },
  // shapes (content/geometry.js): the built-in drawn lessons, or the school's
  // own story lesson — the two ways a school's shapes chapter can be taught
  shape: {
    show:  { en: 'looking at drawings first',        hi: 'पहले चित्र देखकर' },
    story: { en: 'through the school’s story',       hi: 'स्कूल की कहानी से' }
  }
};
const MIND_SHAPES = ['shapes2d', 'angles', 'perimeter'];
const MIND_DAY = 864e5;
const MIND_WHY = {
  twoMisses: { en: "two rounds taught this way didn't stick", hi: 'इस तरीक़े से दो बार सिखाया, पर बात नहीं बनी' },
  school:    { en: 'a school test showed {got} of {of}',       hi: 'स्कूल के टेस्ट में {of} में से {got} आए' }
};

let mindRand = Math.random;     // tests make it deterministic

function mindOf(c){
  const ch = c || S;
  if(!ch.mind || ch.mind.v !== 1) ch.mind = { v: 1, arms: {}, plan: {}, pending: {}, cool: {}, changes: [], school: {} };
  return ch.mind;
}

function mindDomain(skill){
  if(/^read\d$/.test(skill)) return 'read';
  if(MIND_SHAPES.includes(skill)) return 'shape';
  if(typeof SKILL_OPS !== 'undefined' && SKILL_OPS[skill]) return 'math';
  if(typeof upperHasProblem === 'function' && upperHasProblem(skill)) return 'math';   // Classes 6–10 (content/upper.js)
  return null;
}

/* The skill a free-practice sum really exercises (Counting Stones). */
function skillOfProblem(p){
  if(!p) return null;
  if(p.kind === 'upper') return p.skill;   // content/upper.js
  const a = +p.a, b = +p.b;
  if(p.op === '+') return a + b <= 10 ? 'add10' : (a >= 10 || b >= 10) ? ((a % 10) + (b % 10) >= 10 ? 'carry' : 'add2') : 'bonds10';
  if(p.op === '−' || p.op === '-') return a <= 10 ? 'sub10' : (a % 10) < (b % 10) ? 'borrow' : 'sub2';
  if(p.op === '×') return a >= 10 || b >= 10 ? 'mult2x1' : 'tables';
  if(p.op === '÷') return 'divshare';
  return null;
}

/* Beta(a, b) for small whole a, b: the a-th smallest of a+b−1 uniforms. */
function betaDraw(a, b){
  const n = Math.max(1, Math.round(a) + Math.round(b) - 1), k = Math.max(1, Math.round(a));
  const u = []; for(let i = 0; i < n; i++) u.push(mindRand());
  u.sort((x, y) => x - y);
  return u[Math.min(k, n) - 1];
}

/* What has worked for this child across a whole subject. */
function mindSubject(dom, c){
  const m = mindOf(c), out = {};
  for(const w of Object.keys(WAYS[dom] || {})) out[w] = { a: 0, b: 0 };
  for(const [skill, arms] of Object.entries(m.arms)){
    if(mindDomain(skill) !== dom) continue;
    for(const [w, r] of Object.entries(arms)) if(out[w]){ out[w].a += r.a; out[w].b += r.b; }
  }
  return out;
}

/* The way to teach this topic now. `avail` limits it to what the screen
   can do right now (no story lesson for this skill, say). */
function mindChoose(skill, avail, c){
  const dom = mindDomain(skill);
  if(!dom) return null;
  const m = mindOf(c), now = Date.now();
  const cool = m.cool[skill] || {};
  let opts = Object.keys(WAYS[dom]).filter(w => !(cool[w] > now));
  if(avail) opts = opts.filter(w => avail.includes(w));
  if(!opts.length) opts = avail && avail.length ? avail.slice() : Object.keys(WAYS[dom]);
  const plan = m.plan[skill];
  if(plan && opts.includes(plan.way)) return plan.way;
  const subj = mindSubject(dom, c), arms = m.arms[skill] || {};
  let best = null, bestDraw = -1;
  for(const w of opts){
    const own = arms[w] || { a: 0, b: 0 }, s = subj[w] || { a: 0, b: 0 };
    // a new topic leans on the whole subject, at half weight, capped
    const a = 1 + own.a + Math.min(6, Math.round((s.a - own.a) / 2));
    const b = 1 + own.b + Math.min(6, Math.round((s.b - own.b) / 2));
    const d = betaDraw(a, b);
    if(d > bestDraw){ bestDraw = d; best = w; }
  }
  // the plan holds only for ways that every screen can do; a screen-bound
  // pick (a story, when no story exists elsewhere) doesn't overwrite it
  if(!avail || avail.length === Object.keys(WAYS[dom]).length || !plan) m.plan[skill] = { way: best, since: now, fails: 0 };
  return best;
}

/* A second way, for teaching again after a child couldn't explain it: the
   best of the ways NOT just used (the plan's, or the round still open), so a
   cartoon that didn't lead to an explanation isn't simply shown again. The
   plan itself is left alone — explanations are their own measure, and the
   next answers on their own still decide whether this way works. */
function mindChooseOther(skill, avail, c){
  const dom = mindDomain(skill);
  if(!dom) return null;
  const m = mindOf(c), now = Date.now();
  const used = [m.plan[skill] && m.plan[skill].way, m.pending[skill] && m.pending[skill].way].filter(Boolean);
  const cool = m.cool[skill] || {};
  let opts = (avail || Object.keys(WAYS[dom])).filter(w => WAYS[dom][w] && !used.includes(w));
  const warm = opts.filter(w => !(cool[w] > now));
  if(warm.length) opts = warm;
  if(!opts.length) return mindChoose(skill, avail, c);
  const subj = mindSubject(dom, c), arms = m.arms[skill] || {};
  let best = null, bestDraw = -1;
  for(const w of opts){
    const own = arms[w] || { a: 0, b: 0 }, sb = subj[w] || { a: 0, b: 0 };
    const d = betaDraw(1 + own.a + Math.min(6, Math.round((sb.a - own.a) / 2)), 1 + own.b + Math.min(6, Math.round((sb.b - own.b) / 2)));
    if(d > bestDraw){ bestDraw = d; best = w; }
  }
  return best;
}

/* A teaching moment, in this way, on this topic. */
function mindTaught(skill, way, c){
  const dom = mindDomain(skill);
  if(!dom || !WAYS[dom][way]) return;
  const m = mindOf(c), p = m.pending[skill];
  if(p && p.way === way && Date.now() - p.at < 7 * MIND_DAY) return;      // the same round, still open
  if(p && p.n >= 2) mindSettle(skill, c);
  m.pending[skill] = { way, at: Date.now(), n: 0, right: 0 };
}

/* An answer the child gave on their own (never call this for a helped one). */
function mindAttempt(skill, ok, c){
  const m = mindOf(c), p = m.pending[skill];
  if(!p) return;
  if(Date.now() - p.at > 7 * MIND_DAY){ delete m.pending[skill]; return; }
  p.n++; if(ok) p.right++;
  if(p.right >= 2 || p.n - p.right >= 2 || p.n >= 3) mindSettle(skill, c);
}

function mindSettle(skill, c){
  const m = mindOf(c), p = m.pending[skill];
  if(!p) return;
  delete m.pending[skill];
  const stuck = p.right >= 2 || (p.n === 1 && p.right === 1);
  const arms = m.arms[skill] = m.arms[skill] || {};
  const r = arms[p.way] = arms[p.way] || { a: 0, b: 0 };
  if(stuck) r.a++; else r.b++;
  const plan = m.plan[skill];
  if(plan && plan.way === p.way){
    if(stuck) plan.fails = 0;
    else if(++plan.fails >= 2) mindSwitch(skill, MIND_WHY.twoMisses, {}, c);
  }
  if(typeof log === 'function') log(0, `Mind · ${skill} taught ${p.way}: ${stuck ? 'it stuck' : "didn't stick"} (${p.right}/${p.n} on their own)`);
}

function mindSwitch(skill, why, vals, c){
  const m = mindOf(c), dom = mindDomain(skill);
  const from = m.plan[skill] && m.plan[skill].way;
  if(from){ m.cool[skill] = m.cool[skill] || {}; m.cool[skill][from] = Date.now() + 7 * MIND_DAY; }
  delete m.plan[skill];
  const to = mindChoose(skill, null, c);
  const fill = t => t.replace(/\{(\w+)\}/g, (_, k) => vals[k] != null ? vals[k] : '');
  m.changes.unshift({ at: new Date().toISOString(), skill, from: from || null, to, why: { en: fill(why.en), hi: fill(why.hi) } });
  m.changes = m.changes.slice(0, 30);
  if(typeof log === 'function') log(0, `Mind · ${skill}: changed the way of teaching ${from || '—'} → ${to} (${fill(why.en)})`);
  return to;
}

/* A school mark on a topic: the strongest evidence there is. */
function mindAssessment(a, c){
  const ch = c || S;
  const got = Number(a.got), of = Number(a.of);
  if(!mindDomain(a.skill) || !(of > 0) || !(got >= 0) || got > of) return false;
  ch.assessments = ch.assessments || [];
  const id = a.id || `${a.by || 'parent'}-${a.skill}-${Date.now()}`;
  if(ch.assessments.some(x => x.id === id)) return false;
  const rec = { id, skill: a.skill, got, of, by: a.by || 'parent', at: a.at || new Date().toISOString(), note: String(a.note || '').slice(0, 80) };
  ch.assessments.unshift(rec);
  ch.assessments = ch.assessments.slice(0, 60);
  const m = mindOf(ch), r = got / of;
  m.school[a.skill] = { r, at: rec.at, got, of };
  const plan = m.plan[a.skill];
  if(r < 0.5){
    if(plan){
      const arms = m.arms[a.skill] = m.arms[a.skill] || {};
      const x = arms[plan.way] = arms[plan.way] || { a: 0, b: 0 };
      x.b += 2;
    }
    mindSwitch(a.skill, MIND_WHY.school, { got, of }, ch);
  } else if(r >= 0.8 && plan){
    const arms = m.arms[a.skill] = m.arms[a.skill] || {};
    (arms[plan.way] = arms[plan.way] || { a: 0, b: 0 }).a += 1;
  }
  return true;
}

/* The topic Munni would teach next, and how: a recent low school mark
   first, then a topic whose plan has just changed, then a mistake the
   child keeps making, then a skill that is fading, then none. */
function mindNext(c){
  const m = mindOf(c), now = Date.now();
  const low = Object.entries(m.school).filter(([, s]) => s.r < 0.6 && now - Date.parse(s.at) < 30 * MIND_DAY)
    .sort((x, y) => x[1].r - y[1].r)[0];
  if(low) return { skill: low[0], why: 'school' };
  const ch = m.changes[0];
  if(ch && now - Date.parse(ch.at) < 7 * MIND_DAY) return { skill: ch.skill, why: 'changed' };
  // what the twin (core/twin.js) sees: a mistake the child keeps making, then a skill fading
  if(typeof twinOf === 'function'){
    const tw = twinOf(c);
    const habit = Object.keys(tw.recent).filter(sk => mindDomain(sk) && twinHabit(sk, c))[0];
    if(habit) return { skill: habit, why: 'habit' };
    const fade = twinFading(c).find(f => mindDomain(f.skill));
    if(fade) return { skill: fade.skill, why: 'fading' };
  }
  return null;
}

/* What has worked best for this child in a subject, when there is enough
   to say (at least three teaching rounds). */
function mindBest(dom, c){
  const s = mindSubject(dom, c);
  const rows = Object.entries(s).map(([w, r]) => ({ way: w, a: r.a, n: r.a + r.b })).filter(x => x.n > 0);
  const total = rows.reduce((t, x) => t + x.n, 0);
  if(total < 3) return null;
  rows.sort((x, y) => (y.a + 1) / (y.n + 2) - (x.a + 1) / (x.n + 2));
  return rows[0];
}
