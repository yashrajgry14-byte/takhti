/* ==================================================================
   TEACH MUNNI — the engine (no screen here; ui/teach-munni.js draws it)

   After a lesson Munni "forgets" its aims, and the child teaches them
   back. This file holds everything that decides what happens:

   · teachCheckAim()  an aim is usable only if Munni's question and both
                      hints would NOT already pass as the explanation —
                      "never the answer", checked rather than promised.
   · teachRubric()    the offline judge: an explanation covers an aim when
                      it has a word for every one of the aim's ideas
                      (English, Hindi, romanised Hindi). Too few words =
                      'unsure': ask again, keep nothing — the matcher's rule.
   · teachGround()    the online judge (Gemini, api/teachback.mjs) must
                      QUOTE the child's words for every point it credits;
                      a quote that isn't in what the child said, or only
                      repeats Munni, is downgraded. Checked on the server
                      and again here.
   · teachFixFor()    a 'fix' aim: Munni works a sum and makes a real
                      mistake — this child's habit when the twin has one —
                      and the child catches it, then explains it.
   · teachBegin() / teachHeard() / teachPick() / teachFinish()
                      the session: one aim at a time, two hints at most,
                      then "we'll figure it out together later" — never
                      "wrong". Gaps are kept for "Munni forgot again".

   Evidence: the fix aim's first tap is a real answer to a sum
   (noteSkillAttempt + twinAnswer — the same as any 3-choice question).
   Explanations are a different measure: they go to S.teach (the parent's
   "How … explains", the teacher's aim results), never into the twin's
   mastery numbers — a shy child who can do it but can't yet say it is
   not a child who can't do it.
   ================================================================== */

const TEACH_ID = /^[a-z0-9.-]{1,32}$/;
const TEACH_VERDICTS = ['covered', 'partly', 'missing', 'unsure'];
const tL = (o, lang) => o ? (lang === 'hi' ? o.hi : o.en) : '';

function teachOf(c){
  const ch = c || S;
  if(!ch.teach || ch.teach.v !== 1) ch.teach = { v: 1, units: {}, log: [], explained: {} };
  return ch.teach;
}

/* ---------- words ---------- */
function teachNorm(s){
  return String(s || '').toLowerCase()
    .replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?;:।"“”()\[\]{}…—–\-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function teachTokens(s){ const n = teachNorm(s); return n ? n.split(' ') : []; }
function teachHit(text, words){
  const norm = ' ' + teachNorm(text) + ' ', toks = norm.trim().split(' ');
  return (words || []).some(w0 => {
    const w = teachNorm(w0);
    if(!w) return false;
    if(w.includes(' ')) return norm.includes(' ' + w + ' ');
    return toks.some(t => t === w || (w.length >= 4 && !/^\d+$/.test(w) && t.startsWith(w)));
  });
}

/* The offline judge. */
function teachRubric(ideas, text){
  const n = teachTokens(text).length;
  if(n < 2) return { verdict: 'unsure', hits: [], n };
  const hits = (ideas || []).map(i => teachHit(text, i.words));
  const got = hits.filter(Boolean).length;
  return { verdict: !hits.length ? 'unsure' : got === hits.length ? 'covered' : got ? 'partly' : 'missing', hits, n };
}

/* A credited point needs a real quote of the child, not of Munni. */
function teachGround(quote, transcript, said){
  const q = teachNorm(quote), t = ' ' + teachNorm(transcript) + ' ';
  if(q.split(' ').filter(Boolean).length < 2 || !t.includes(' ' + q + ' ')) return false;
  const munni = new Set(teachTokens(said));
  return teachTokens(quote).some(w => !munni.has(w));
}
/* Gemini's verdicts, each checked against what the child really said. */
function teachApplyJudge(judge, transcript, items){
  const out = {};
  for(const j of (judge && Array.isArray(judge.aims) ? judge.aims : [])){
    if(!j || !TEACH_ID.test(String(j.id)) || !TEACH_VERDICTS.includes(j.verdict)) continue;
    const it = items.find(x => x.aim.id === j.id);
    if(!it) continue;
    let v = j.verdict;
    if((v === 'covered' || v === 'partly') && !teachGround(j.quote, transcript, teachSaid(it, 'en') + ' ' + teachSaid(it, 'hi')))
      v = v === 'covered' ? 'partly' : 'missing';
    out[j.id] = v;
  }
  return out;
}

/* ---------- checking an aim ---------- */
const tPlain = s => typeof s === 'string' && !/[<>`{}\\]|https?:|www\.|javascript:/i.test(s);
function teachBi(o, max){
  return !!(o && typeof o.en === 'string' && typeof o.hi === 'string' && o.en.trim() && o.hi.trim()
    && o.en.length <= max && o.hi.length <= max && tPlain(o.en) && tPlain(o.hi) && /[ऀ-ॿ]/.test(o.hi));
}
function teachCheckAim(a){
  const e = [];
  if(!a || typeof a !== 'object') return ['not an aim'];
  if(!TEACH_ID.test(String(a.id))) e.push('a bad id');
  if(!teachBi(a.short, 32)) e.push('the short name needs English and Hindi, at most 32 letters');
  if(!teachBi(a.point, 140)) e.push('the point needs English and Hindi, at most 140 letters');
  if(a.kind === 'fix') return e;
  if(a.kind !== 'explain') e.push('kind must be explain or fix');
  if(!teachBi(a.forget, 240)) e.push("Munni's question needs English and Hindi, at most 240 letters");
  if(!Array.isArray(a.hints) || a.hints.length !== 2 || !a.hints.every(h => teachBi(h, 180))) e.push('two hints, each in English and Hindi');
  const ideas = Array.isArray(a.ideas) ? a.ideas : [];
  if(ideas.length < 1 || ideas.length > 3) e.push('one to three ideas');
  for(const i of ideas){
    if(!i || !tPlain(i.en) || !tPlain(i.hi) || !String(i.en).trim() || String(i.en).length > 140) e.push('each idea needs a plain description');
    if(!Array.isArray(i && i.words) || i.words.length < 2 || i.words.length > 40 || !i.words.every(w => tPlain(w) && String(w).trim() && String(w).length <= 28))
      e.push('each idea needs 2–40 short words that show it');
  }
  if(e.length) return e;
  // never the answer: nothing Munni says may already pass as the explanation
  for(const lang of ['en', 'hi']){
    if(teachRubric(ideas, a.forget[lang]).verdict === 'covered') e.push(`Munni's question (${lang}) already gives the explanation`);
    a.hints.forEach((h, k) => { if(teachRubric(ideas, h[lang]).verdict === 'covered') e.push(`hint ${k + 1} (${lang}) already gives the explanation`); });
  }
  return e;
}

/* Aims that came from Gemini with a school lesson (core/syllabus.js):
   the usable ones, with ids made from the lesson's own id. */
function teachCleanAims(raw, lessonId){
  const aims = [], errors = [];
  (Array.isArray(raw) ? raw : []).slice(0, 4).forEach((r, k) => {
    r = r && typeof r === 'object' ? r : {};
    const pick = o => o && typeof o === 'object' ? { en: String(o.en || '').trim(), hi: String(o.hi || '').trim() } : null;
    const a = {
      id: '', kind: 'explain',
      short: pick(r.short), point: pick(r.point), forget: pick(r.forget),
      hints: (Array.isArray(r.hints) ? r.hints : []).slice(0, 2).map(pick),
      ideas: (Array.isArray(r.ideas) ? r.ideas : []).slice(0, 3).map(i => i && typeof i === 'object' ? {
        en: String(i.en || '').trim(), hi: String(i.hi || '').trim(),
        words: (Array.isArray(i.words) ? i.words : []).slice(0, 40).map(w => String(w || '').trim()).filter(Boolean) } : null).filter(Boolean)
    };
    a.id = 's0.' + aims.length;          // a valid id while it is checked
    const errs = teachCheckAim(a);
    if(errs.length) errors.push(`aim ${k + 1}: ${errs[0]}`);
    else aims.push(a);
  });
  // ids by place among the usable ones, so checking a checked lesson changes nothing
  aims.forEach((a, k) => { a.id = ('s' + String(lessonId || '').replace(/^sch-/, '') + '.' + k).slice(0, 32); });
  return { aims, errors };
}

/* ---------- 'fix': Munni's mistake ---------- */
function teachFixFor(skill, seed, c){
  if(typeof skillProblem !== 'function' || !skillHasProblem(skill)) return null;
  const habit = typeof twinHabit === 'function' ? twinHabit(skill, c) : null;
  const order = [].concat(habit ? [habit.id] : [], TEACH_FIX_DEFAULT[skill] || [])
    .filter((id, i, a) => a.indexOf(id) === i && TEACH_ACTS[id] && TEACH_FIX_IDEAS[id]);
  for(let t = 0; t < 8; t++){
    const sp = skillProblem(skill, (seed >>> 0) + t * 7919);
    if(!sp) return null;
    const p = { a: sp.a, b: sp.b, op: sp.op === 'mix' ? '+' : sp.op, c: sp.c };
    const cands = mistakeAnswers(p);
    for(const id of order){
      const m = cands.find(x => x.id === id && x.v !== sp.ans && x.v >= 0);
      if(!m) continue;
      const act = { en: TEACH_ACTS[id](p, m.v, false), hi: TEACH_ACTS[id](p, m.v, true) };
      // her working never says the right answer
      if([act.en, act.hi].some(s => (s.match(/\d+/g) || []).includes(String(sp.ans)))) continue;
      const third = (cands.find(x => x.v !== sp.ans && x.v !== m.v && x.v >= 0) || { v: sp.ans + 10 }).v;
      const opts = [sp.ans, m.v, third];
      const r = rng(seedOf('fix' + seed + t));
      for(let i = opts.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      const tip = { en: mistakeTip(id, p, 'en') || '', hi: mistakeTip(id, p, 'hi') || '' };
      return { skill, p, text: sp.text, ans: sp.ans, wrong: m.v, mistake: id, habit: !!(habit && habit.id === id),
               opts, correct: opts.indexOf(sp.ans), act, tip, ideas: TEACH_FIX_IDEAS[id] };
    }
  }
  return null;
}

/* ---------- which unit goes with a lesson ---------- */
function teachUnitBuiltin(skill){
  const u = TEACH_UNITS[skill];
  if(u) return { id: skill, skill, title: u.title, aims: u.aims.map(a => ({ ...a, skill: a.skill || skill })) };
  if(skillHasProblem(skill) && (TEACH_FIX_DEFAULT[skill] || []).length){
    const s = skillById(skill);
    return { id: skill, skill, title: s ? { en: s.en, hi: s.hi } : { en: skill, hi: skill }, aims: [{
      id: skill + '.fix', kind: 'fix', skill,
      short: { en: 'Fix Munni’s sum', hi: 'मुन्नी का सवाल ठीक करो' },
      point: { en: 'Can find and explain a mistake in a sum', hi: 'सवाल में गड़बड़ ढूँढकर समझा सकते हैं' } }] };
  }
  return null;
}
function teachUnitFor(les){
  if(!les || typeof band !== 'function' || band().id === 'pre') return null;
  if(les.school && Array.isArray(les.aims) && les.aims.length){
    const aims = les.aims.slice();
    const fix = les.skillId && teachUnitBuiltin(les.skillId);
    const f = fix && fix.aims.find(a => a.kind === 'fix');
    if(f) aims.push({ ...f, id: (les.id.replace(/^sch-/, 's') + '.fix').slice(0, 32) });
    return { id: les.id, skill: les.skillId || null, title: les.title, aims, lessonId: les.id };
  }
  const skills = [les.skillId].concat(typeof CONCEPT_SKILLS !== 'undefined' ? (CONCEPT_SKILLS[les.concept] || []) : []).filter(Boolean);
  // a topic with written points first (a bar-model take-away is also borrowing), then Munni's sum alone
  for(const sk of skills) if(TEACH_UNITS[sk]) return teachUnitBuiltin(sk);
  for(const sk of skills){ const u = teachUnitBuiltin(sk); if(u) return u; }
  return null;
}

/* ---------- the session ---------- */
function teachPrompt(it){
  if(it.fix) return it.phase === 'why' ? TEACH_LINES.fixCaught
    : { en: `${TEACH_LINES.fixIntro.en} ${it.fix.act.en}`, hi: `${TEACH_LINES.fixIntro.hi} ${it.fix.act.hi}` };
  return it.aim.forget;
}
/* everything Munni has said about this aim — a quote of it isn't the child's */
function teachSaid(it, lang){
  return [tL(teachPrompt(it), lang), it.fix ? tL(it.fix.act, lang) + ' ' + tL(it.fix.tip, lang) : '',
          ...(it.aim.hints || []).map(h => tL(h, lang))].join(' ');
}
function teachIdeas(it){ return it.fix ? it.fix.ideas : it.aim.ideas; }
const tJoin = (...xs) => ({ en: xs.map(x => x && x.en).filter(Boolean).join(' '), hi: xs.map(x => x && x.hi).filter(Boolean).join(' ') });

function teachBegin(unit, opts, c){
  opts = opts || {};
  const t = teachOf(c), prev = t.units[unit.id];
  let aims = unit.aims;
  if(opts.again && prev && prev.gaps && prev.gaps.length) aims = aims.filter(a => prev.gaps.includes(a.id));
  const seed = seedOf(unit.id + ':' + (typeof dayKey === 'function' ? dayKey() : 0) + ':' + ((c || S).id || ''));
  const items = [];
  for(const aim of aims){
    if(aim.kind === 'fix'){
      const fix = teachFixFor(aim.skill || unit.skill, seed + items.length, c);
      if(fix) items.push({ aim, fix, phase: 'pick', state: 'todo', hints: 0, unsure: 0, first: true });
    } else items.push({ aim, fix: null, phase: 'ask', state: 'todo', hints: 0, unsure: 0, first: true });
  }
  if(!items.length) return null;
  const s = { unit: { id: unit.id, skill: unit.skill, title: unit.title, lessonId: unit.lessonId || null }, again: !!opts.again,
              items, i: 0, done: false, heard: [], hint: null, started: Date.now() };
  s.line = tJoin(opts.again ? TEACH_LINES.again : TEACH_LINES.intro, teachPrompt(items[0]));
  return s;
}
function teachItem(s){ return s && !s.done ? s.items[s.i] : null; }

function teachAdvance(s, lead){
  s.hint = null;
  s.i++;
  while(s.i < s.items.length && s.items[s.i].state !== 'todo') s.i++;    // taught already, along the way
  if(s.i >= s.items.length){
    s.done = true;
    const n = s.items.filter(x => x.state === 'covered').length, m = s.items.length;
    const end = n === m ? TEACH_LINES.doneAll
      : { en: TEACH_LINES.done.en.replace('{n}', n).replace('{m}', m), hi: TEACH_LINES.done.hi.replace('{n}', n).replace('{m}', m) };
    s.line = tJoin(lead, end);
  } else s.line = tJoin(lead, teachPrompt(s.items[s.i]));
}

/* The child explained something. `verdicts` (optional) are the online
   judge's, already grounded; without them the offline rubric decides. */
function teachHeard(s, text, verdicts, how){
  const it = teachItem(s);
  if(!it || (it.fix && it.phase !== 'why')) return null;
  const local = teachRubric(teachIdeas(it), text);
  const v = verdicts && verdicts[it.aim.id] ? verdicts[it.aim.id] : local.verdict;
  s.heard.push({ aim: it.aim.id, text: String(text || '').slice(0, 400), verdict: v, hinted: !it.first, key: local.hits.some(Boolean), by: how || 'rubric' });
  // the same words may teach other points too
  for(const other of s.items){
    if(other === it || other.state !== 'todo' || other.fix) continue;
    const ov = verdicts && verdicts[other.aim.id] ? verdicts[other.aim.id] : teachRubric(other.aim.ideas, text).verdict;
    if(ov === 'covered') other.state = 'covered';
  }
  if(v === 'covered'){
    it.state = 'covered';
    teachAdvance(s, TEACH_LINES.praise[s.heard.length % TEACH_LINES.praise.length]);
    return 'covered';
  }
  if(v === 'unsure'){
    it.unsure++;
    s.line = TEACH_LINES.unsure;
    return 'unsure';
  }
  if(it.hints < 2){
    const h = it.fix ? (it.hints === 0 ? TEACH_LINES.fixLook : TEACH_LINES.fixShould) : it.aim.hints[it.hints];
    it.hints++; it.first = false;
    s.hint = h;
    s.line = v === 'partly' && !it.fix ? tJoin(TEACH_LINES.partly, h) : h;
    return v;
  }
  it.state = v === 'partly' ? 'partly' : 'gap';
  teachAdvance(s, TEACH_LINES.gap);
  return it.state;
}

/* The child tapped an answer to Munni's sum. */
function teachPick(s, k){
  const it = teachItem(s);
  if(!it || !it.fix || it.phase !== 'pick') return null;
  const f = it.fix, v = f.opts[k], ok = k === f.correct;
  if(v == null) return null;
  if(it.first && it.hints === 0){
    // a real answer to a sum: evidence, like any question with three choices
    if(typeof noteSkillAttempt === 'function') noteSkillAttempt(f.skill, ok);
    if(!ok && typeof twinAnswer === 'function') twinAnswer(f.skill, f.p, v);
  }
  if(ok){ it.phase = 'why'; s.hint = null; s.line = TEACH_LINES.fixCaught; return 'caught'; }
  it.hints++; it.first = false;
  if(it.hints <= 1){ s.hint = f.tip; s.line = tJoin(TEACH_LINES.fixAgree, f.tip); return 'again'; }
  it.state = 'gap';
  teachAdvance(s, TEACH_LINES.gap);
  return 'gap';
}

/* ---------- how well the child explains (for the parent, never compared) ---------- */
function teachOwnWords(text, source){
  const mine = teachTokens(text).filter(w => w.length >= 3 || /\d/.test(w));
  if(!mine.length) return 0;
  const src = new Set(teachTokens(source));
  return 1 - mine.filter(w => src.has(w)).length / mine.length;
}

function teachFinish(s, c){
  const ch = c || S, t = teachOf(ch);
  const items = s.items, m = items.length;
  const covered = items.filter(x => x.state === 'covered');
  const gaps = items.filter(x => x.state === 'gap' || x.state === 'partly').map(x => x.aim.id);
  const prev = t.units[s.unit.id] || { aims: {} };
  const aims = Object.assign({}, prev.aims);
  for(const x of items) aims[x.aim.id] = x.state === 'todo' ? (aims[x.aim.id] || 'gap') : x.state;
  t.units[s.unit.id] = { at: new Date().toISOString(), title: s.unit.title, skill: s.unit.skill, lessonId: s.unit.lessonId,
                         aims, gaps: Object.keys(aims).filter(id => aims[id] !== 'covered') };
  for(const x of items) if(x.state !== 'todo') t.explained[x.aim.id] = x.state === 'covered' ? 'c' : x.state === 'partly' ? 'p' : 'g';
  const keys = Object.keys(t.explained);
  for(const k of keys.slice(0, Math.max(0, keys.length - 60))) delete t.explained[k];

  const said = s.heard.filter(h => h.verdict === 'covered' || h.verdict === 'partly');
  const avg = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100 : null;
  const entry = {
    at: new Date().toISOString(), unit: s.unit.id, title: s.unit.title, again: s.again, m,
    covered: covered.length, unaided: covered.filter(x => x.first).length,
    hints: items.reduce((a, x) => a + x.hints, 0),
    words: avg(said.map(h => teachTokens(h.text).length)),
    own: avg(said.map(h => { const it = items.find(x => x.aim.id === h.aim); return teachOwnWords(h.text, teachSaid(it, 'en') + ' ' + teachSaid(it, 'hi')); })),
    key: said.length ? Math.round(said.filter(h => h.key).length / said.length * 100) / 100 : null
  };
  t.log = t.log.concat(entry).slice(-30);
  if(typeof mirrorToClass === 'function') mirrorToClass(ch);
  if(typeof saveSoon === 'function') saveSoon();
  return { ...entry, gaps };
}

/* Units with points still to teach Munni again. */
function teachAgainList(c){
  const t = teachOf(c);
  return Object.entries(t.units).filter(([, u]) => u.gaps && u.gaps.length).map(([id, u]) => ({ id, ...u }))
    .sort((x, y) => String(y.at).localeCompare(String(x.at)));
}
