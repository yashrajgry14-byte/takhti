/* ==================================================================
   TEACH APPU — the engine (no screen here; ui/teach-munni.js draws it)

   After a lesson Appu "forgets" its aims, and the child teaches them
   back. This file holds everything that decides what happens:

   · teachCheckAim()  an aim is usable only if Appu's question and both
                      hints would NOT already pass as the explanation —
                      "never the answer", checked rather than promised.
   · teachRubric()    the offline judge: an explanation covers an aim when
                      it has a word for every one of the aim's ideas
                      (English, Hindi, romanised Hindi). Too few words =
                      'unsure': ask again, keep nothing — the matcher's rule.
   · teachGround()    the online judge (Gemini, api/teachback.mjs) must
                      QUOTE the child's words for every point it credits;
                      a quote that isn't in what the child said, or only
                      repeats Appu, is downgraded. Checked on the server
                      and again here.
   · teachFixFor()    a 'fix' aim: Appu works a sum and makes a real
                      mistake — this child's habit when the twin has one —
                      and the child catches it, then explains it.
   · teachBegin() / teachHeard() / teachPick() / teachFinish()
                      the session: one aim at a time, two hints at most,
                      then "we'll figure it out together later" — never
                      "wrong". Gaps are kept for "Appu forgot again".

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
  if(!ch.teach.loop) ch.teach.loop = {};
  if(!ch.teach.did) ch.teach.did = {};
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

/* Other ways a child says the same idea. A drafted aim lists the words
   Gemini thought of, and some lists are thin: "Taking away tens and ones"
   (Maths Mela ch12) only had convert / units / badlo, so "take one ten, it
   becomes ten ones" got nothing offline; "Square Corners" (ch5) had only
   Hindi words, so no English explanation could pass. An idea that names one
   of the `if` words also takes the `add` words — here, when the child is
   heard, and in teachCheckAim's "never the answer" check, so a hint or
   Appu's question that says one of them still fails. The lesson itself (and
   its id) is not changed. */
const TEACH_ALSO = [
  { if: ['convert', 'badlo', 'regroup'],
    add: ['ten ones', '10 ones', 'into ones', 'into units', 'becomes ten', 'becomes 10', 'break the ten', 'break a ten',
      'break one ten', 'borrow', 'regroup', 'exchange', 'udhar', 'udhaar', 'उधार', 'दस इकाई', 'das ikai', 'tod do'] },
  { if: ['chaukore kona', 'chaukor kona', 'चौकोर कोना', 'square corner'],
    add: ['square corner', 'square corners', 'right angle', 'samkon', 'समकोण', 'chaukor kona', 'chokor kona'] }
];
function teachWordsFor(words){
  const ws = Array.isArray(words) ? words : [], have = ws.map(teachNorm);
  const extra = [];
  for(const g of TEACH_ALSO) if(g.if.some(w => have.includes(teachNorm(w)))) g.add.forEach(w => { if(!have.includes(teachNorm(w)) && !extra.includes(w)) extra.push(w); });
  return extra.length ? ws.concat(extra) : ws;
}

/* The offline judge. */
function teachRubric(ideas, text){
  const n = teachTokens(text).length;
  if(n < 2) return { verdict: 'unsure', hits: [], n };
  const hits = (ideas || []).map(i => teachHit(text, teachWordsFor(i.words)));
  const got = hits.filter(Boolean).length;
  return { verdict: !hits.length ? 'unsure' : got === hits.length ? 'covered' : got ? 'partly' : 'missing', hits, n };
}

/* A credited point needs a real quote of the child, not of Appu. */
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
  if(!teachBi(a.forget, 240)) e.push("Appu's question needs English and Hindi, at most 240 letters");
  if(!Array.isArray(a.hints) || a.hints.length !== 2 || !a.hints.every(h => teachBi(h, 180))) e.push('two hints, each in English and Hindi');
  const ideas = Array.isArray(a.ideas) ? a.ideas : [];
  if(ideas.length < 1 || ideas.length > 3) e.push('one to three ideas');
  for(const i of ideas){
    if(!i || !tPlain(i.en) || !tPlain(i.hi) || !String(i.en).trim() || String(i.en).length > 140) e.push('each idea needs a plain description');
    if(!Array.isArray(i && i.words) || i.words.length < 2 || i.words.length > 40 || !i.words.every(w => tPlain(w) && String(w).trim() && String(w).length <= 28))
      e.push('each idea needs 2–40 short words that show it');
  }
  if(e.length) return e;
  // never the answer: nothing Appu says may already pass as the explanation.
  // The reason names the words it said, so Gemini's repair round knows what to change.
  const said = text => { const w = []; ideas.forEach(i => { const x = teachWordsFor(i.words).find(v => teachHit(text, [v])); if(x) w.push(x); }); return w.length ? ` (it says "${w.join('", "')}")` : ''; };
  for(const lang of ['en', 'hi']){
    if(teachRubric(ideas, a.forget[lang]).verdict === 'covered') e.push(`Appu's question (${lang}) already gives the explanation${said(a.forget[lang])}`);
    a.hints.forEach((h, k) => { if(teachRubric(ideas, h[lang]).verdict === 'covered') e.push(`hint ${k + 1} (${lang}) already gives the explanation${said(h[lang])}`); });
  }
  return e;
}

/* Aims that came from Gemini with a school lesson (core/syllabus.js):
   the usable ones, with ids made from the lesson's own id. */
/* The last resort for a drafted hint that gives the explanation away, after
   Gemini's repair round has had its chance (sylClean's mendHints): a general
   nudge that names no method — checked again like any hint, and shown to the
   teacher as replaced. Losing a whole lesson over one hint helps nobody. */
const TEACH_NUDGES = [
  { en: 'Think back to the lesson. What did you do first?', hi: 'पाठ के बारे में सोचो। तुमने सबसे पहले क्या किया?' },
  { en: 'Show me with your finger, then tell me what you did.', hi: 'उँगली से दिखाओ, फिर बताओ तुमने क्या किया।' }
];
/* An idea word that is one single Latin letter or a little English word
   (or "shuru" — just "start") on its own: never evidence of an idea. */
const TEACH_LONE = ['a', 'i', 'an', 'the', 'is', 'it', 'shuru'];
function teachLoneWord(w){
  const t = teachTokens(w);
  return t.length === 1 && (/^[a-z]$/.test(t[0]) || TEACH_LONE.includes(t[0]));
}
/* "this word", "this one", "here", "यह शब्द", "इस शब्द" with no word named
   (a quoted word, or a word right after "word"/"शब्द") → what it said. */
const TEACH_NOT_A_NAME = ['is', 'start', 'starts', 'begin', 'begins', 'sound', 'sounds', 'has', 'have', 'end', 'ends',
  'mean', 'means', 'say', 'says', 'from', 'with', 'and', 'or', 'in', 'on', 'of', 'to', 'here', 'now', 'again', 'first', 'that', 'the', 'a'];
function teachVagueForget(f){
  if(!f) return '';
  const quoted = s => /["“”‘’'«»][^"“”‘’'«»\s]{1,24}["“”‘’'«»]/.test(s);
  const en = String(f.en || ''), hi = String(f.hi || '');
  const named = (s, re) => { const m = s.match(re); return !!m && !!m[1] && !TEACH_NOT_A_NAME.includes(m[1].toLowerCase()); };
  if(!quoted(en)){
    const m = en.match(/\b(this word|this one|here)\b/i);
    if(m && !(/word/i.test(m[1]) && named(en, /\bthis word[,:]?\s+([A-Za-z]+)/i))) return m[1];
  }
  if(!quoted(hi)){
    const m = hi.match(/(यह शब्द|इस शब्द)/);
    if(m && !named(hi, /(?:यह|इस) शब्द[,:]?\s+([A-Za-z]+)/)) return m[1];
  }
  return '';
}
/* The words Appu's question names: quoted in either language, or written in
   Latin letters inside the Hindi question — and said in the English one. */
function teachNamedWords(f){
  if(!f) return [];
  const en = teachTokens(f.en), out = new Set();
  for(const s of [String(f.en || ''), String(f.hi || '')])
    for(const m of s.matchAll(/["“”‘’'«»]([^"“”‘’'«»\s]{1,24})["“”‘’'«»]/g)) teachTokens(m[1]).forEach(t => out.add(t));
  (String(f.hi || '').match(/[A-Za-z]{2,}/g) || []).forEach(w => out.add(w.toLowerCase()));
  return [...out].filter(t => en.includes(t) && !TEACH_NOT_A_NAME.includes(t) && !TEACH_LONE.includes(t));
}
function teachCleanAims(raw, lessonId, opts){
  const aims = [], errors = [], fixes = [], kept = [];
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
    // A word that both Appu's question and the aim's own point say is the
    // TOPIC ("find the centre of a circle"), not the explanation, so it can't
    // show the child understood. Gemini listed such words as explanation words
    // in every aim of the first live run, and every aim was dropped for it.
    // Only topic words: a question that says the ANSWER ("Does she fly it on
    // the roof?" — roof isn't in the point) still fails the check below.
    // word by word, so "square corner" is found in "square corners", and कोना in
    // कोने (Hindi words change their last vowel sign: कोना, कोने, कोनों)
    const stem = t => t.replace(/[ािीुूेैोौंँ]+$/, '').replace(/(es|s)$/, '');
    const says = (o, w) => !!o && teachTokens(w).length > 0 && ['en', 'hi'].some(l => {
      const have = teachTokens(o[l]).map(stem);
      return teachTokens(w).every(t => have.includes(stem(t)) || teachHit(o[l], [t]));
    });
    if(a.forget) a.ideas.forEach(i => { i.words = i.words.filter(w => !(says(a.forget, w) && (says(a.point, w) || says(a.short, w)))); });
    // The word Appu's question NAMES is the topic too ("What sound does ant
    // start with?" — ant is what he asks about, a is the explanation): Mridang
    // ch1's first draft named it and was dropped as a giveaway for it, and the
    // repair round answered with "this word". Named = quoted, or an English
    // word in Latin letters inside the Hindi question ("ant किस आवाज़ से…"),
    // and said in the English question too. A Hindi question that says the
    // answer in Hindi ("छत पर?") still fails the check below.
    const named = teachNamedWords(a.forget);
    if(named.length) a.ideas.forEach(i => { i.words = i.words.filter(w => !(teachTokens(w).length === 1 && named.includes(teachTokens(w)[0]))); });
    // A word on its own that any sentence has can't show an idea: teachHit
    // matches whole tokens, so the idea word "a" (Mridang ch1's "Sounds of a
    // and b") was matched by the article in "maybe it is a dog". Inside a
    // phrase ("letter a", "starts with a") it still counts.
    const hadWords = a.ideas.map(i => i.words.length);
    a.ideas.forEach(i => { i.words = i.words.filter(w => !teachLoneWord(w)); });
    const emptied = a.ideas.findIndex((i, j) => hadWords[j] && !i.words.length);
    if(emptied >= 0){
      errors.push(`aim ${k + 1}: idea ${emptied + 1}'s words are only single letters or little words every sentence has ("a", "the", "shuru") — give words or phrases that show the idea ("starts with a", "letter a")`);
      return;
    }
    // Appu's question must name what it is about: "the first sound of this
    // word?" on its own, after the lesson, points at nothing (Mridang ch1).
    const vague = teachVagueForget(a.forget);
    if(vague){
      errors.push(`aim ${k + 1}: Appu's question says "${vague}" without naming it — name the word Appu is asking about, e.g. 'What sound does ant start with?'`);
      return;
    }
    a.id = 's0.' + aims.length;          // a valid id while it is checked
    let errs = teachCheckAim(a);
    if(errs.length && opts && opts.mendHints && errs.every(e => /^hint \d/.test(e))){
      const was = errs[0];
      a.hints = a.hints.map((h, j) => ['en', 'hi'].some(l => teachRubric(a.ideas, h[l]).verdict === 'covered') ? { ...TEACH_NUDGES[j] } : h);
      errs = teachCheckAim(a);
      if(!errs.length) fixes.push(`aim ${k + 1}: ${was} — replaced with a general nudge`);
    }
    if(errs.length) errors.push(`aim ${k + 1}: ${errs[0]}`);
    else { aims.push(a); kept.push(k); }
  });
  // ids by place among the usable ones, so checking a checked lesson changes nothing
  aims.forEach((a, k) => { a.id = ('s' + String(lessonId || '').replace(/^sch-/, '') + '.' + k).slice(0, 32); });
  return { aims, errors, fixes, kept };   // kept: each usable aim's place in what was drafted (a question's `aim` follows it)
}

/* ---------- 'fix': Appu's mistake ---------- */
function teachFixFor(skill, seed, c){
  if(typeof skillProblem !== 'function' || !skillHasProblem(skill)) return null;
  const habit = typeof twinHabit === 'function' ? twinHabit(skill, c) : null;
  const order = [].concat(habit ? [habit.id] : [], TEACH_FIX_DEFAULT[skill] || [])
    .filter((id, i, a) => a.indexOf(id) === i && TEACH_ACTS[id] && TEACH_FIX_IDEAS[id]);
  for(let t = 0; t < 8; t++){
    const sp = skillProblem(skill, (seed >>> 0) + t * 7919);
    if(!sp) return null;
    for(const id of order){
      const f = teachFixMake(skill, sp, id, habit, 'fix' + seed + t);
      if(f) return f;
    }
  }
  return null;
}
/* Appu's mistake `id` on one sum, or null when that sum can't carry it: the
   mistake must give a real wrong answer, and his working must never say the
   right one. `key` seeds the order of the three answers. */
function teachFixMake(skill, sp, id, habit, key){
  if(!TEACH_ACTS[id] || !TEACH_FIX_IDEAS[id]) return null;
  const p = { a: sp.a, b: sp.b, op: sp.op === 'mix' ? '+' : sp.op, c: sp.c };
  const cands = mistakeAnswers(p);
  const m = cands.find(x => x.id === id && x.v !== sp.ans && x.v >= 0);
  if(!m) return null;
  const act = { en: TEACH_ACTS[id](p, m.v, false), hi: TEACH_ACTS[id](p, m.v, true) };
  // his working never says the right answer
  if([act.en, act.hi].some(s => (s.match(/\d+/g) || []).includes(String(sp.ans)))) return null;
  const third = (cands.find(x => x.v !== sp.ans && x.v !== m.v && x.v >= 0) || { v: sp.ans + 10 }).v;
  const opts = [sp.ans, m.v, third];
  const r = rng(seedOf(key));
  for(let i = opts.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const tip = { en: mistakeTip(id, p, 'en') || '', hi: mistakeTip(id, p, 'hi') || '' };
  return { skill, p, text: sp.text, ans: sp.ans, wrong: m.v, mistake: id, habit: !!(habit && habit.id === id),
           opts, correct: opts.indexOf(sp.ans), act, tip, ideas: TEACH_FIX_IDEAS[id] };
}
/* The same mistake on a sum chosen in advance: a cartoon of Appu making it
   (video/appu-clips.json, ui/teach-munni.js) shows one particular sum, so his
   sum on the slate has to be that one. Two-digit taking away or adding only. */
function teachFixAt(skill, a, b, id, op, c){
  op = op === '+' ? '+' : '−';
  if(!Number.isInteger(a) || !Number.isInteger(b) || a < 10 || b < 10 || a > 99 || b > 99 || (op === '−' && a <= b)) return null;
  const ans = op === '+' ? a + b : a - b;
  const habit = typeof twinHabit === 'function' ? twinHabit(skill, c) : null;
  return teachFixMake(skill, { a, b, op, c: null, ans, text: `${a} ${op} ${b}` }, id, habit, 'fixat' + a + op + b + id);
}

/* ---------- which unit goes with a lesson ---------- */
function teachUnitBuiltin(skill){
  const u = TEACH_UNITS[skill];
  if(u) return { id: skill, skill, title: u.title, aims: u.aims.map(a => ({ ...a, skill: a.skill || skill })) };
  if(skillHasProblem(skill) && (TEACH_FIX_DEFAULT[skill] || []).length){
    const s = skillById(skill);
    return { id: skill, skill, title: s ? { en: s.en, hi: s.hi } : { en: skill, hi: skill }, aims: [{
      id: skill + '.fix', kind: 'fix', skill,
      short: { en: 'Fix Appu’s sum', hi: 'अप्पू का सवाल ठीक करो' },
      point: { en: 'Can find and explain a mistake in a sum', hi: 'सवाल में गड़बड़ ढूँढकर समझा सकते हैं' } }] };
  }
  return null;
}
function teachUnitFor(les){
  if(!les || typeof band !== 'function' || band().id === 'pre') return null;
  if(les.school && Array.isArray(les.aims) && les.aims.length){
    const aims = les.aims.slice();
    // Appu's sum is aimed at THIS child's habit. A habit is kept on the skill it was
    // seen in, which is often the next one up (borrowing builds on two-digit taking
    // away, and a sub2 sum never borrows), so a habit there moves his sum up a step.
    const up = les.skillId && typeof twinHabit === 'function' && typeof SKILLS !== 'undefined'
      ? SKILLS.filter(s => (s.pre || []).includes(les.skillId)).map(s => s.id)
          .find(id => twinHabit(id) && skillHasProblem(id) && TEACH_ACTS[twinHabit(id).id]) : null;
    const fix = les.skillId && (teachUnitBuiltin(up || les.skillId) || teachUnitBuiltin(les.skillId));
    const f = fix && fix.aims.find(a => a.kind === 'fix');
    if(f) aims.push({ ...f, id: (les.id.replace(/^sch-/, 's') + '.fix').slice(0, 32) });
    return { id: les.id, skill: les.skillId || null, title: les.title, aims, lessonId: les.id };
  }
  const skills = [les.skillId].concat(typeof CONCEPT_SKILLS !== 'undefined' ? (CONCEPT_SKILLS[les.concept] || []) : []).filter(Boolean);
  // a topic with written points first (a bar-model take-away is also borrowing), then Appu's sum alone
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
/* everything Appu has said about this aim — a quote of it isn't the child's */
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

/* The child tapped an answer to Appu's sum. */
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
  for(const x of items) if(x.state !== 'todo'){
    const L = x.state === 'covered' ? 'c' : x.state === 'partly' ? 'p' : 'g';
    t.explained[x.aim.id] = L;
    t.loop[x.aim.id] = teachLoopNext(t.loop[x.aim.id], L);
  }
  for(const o of [t.explained, t.loop]){ const keys = Object.keys(o); for(const k of keys.slice(0, Math.max(0, keys.length - 60))) delete o[k]; }

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

/* ---------- the loop, per point: where the child started, whether Munni
   (the tutor) taught it again, where they are now ----------
   'c'   explained the first time
   'g'/'p'          not yet / partly, not taught again yet
   'gr'/'pr'        taught again ("Let's learn it again"), not asked since
   'grc', 'grp'…    taught again, then asked: explained / partly / not yet
   'gc', 'pg'…      asked again without being taught again ("Appu forgot again")
   Letters only, like `explained` — never what was said. */
const TEACH_LOOP_RE = /^(?:[cpg]|[pg]r|[pg]r?[cpg])$/;
function teachLoopNext(prev, L){
  if(!prev || !TEACH_LOOP_RE.test(prev)) return L;
  if(prev[0] === 'c') return 'c';                 // explained first time stays the story
  return prev[0] + (prev.includes('r') ? 'r' : '') + L;
}
function teachLoopRetaught(prev){
  if(!prev || !TEACH_LOOP_RE.test(prev) || prev[0] === 'c') return prev;
  return prev[0] + 'r';                           // what came after a second teaching is asked again
}
/* The child chose "Let's learn it again": every point of the session still to teach is re-taught. */
function teachMarkRetaught(s, c){
  const t = teachOf(c);
  for(const x of (s && s.items) || []) if(x.state !== 'covered' && t.loop[x.aim.id]) t.loop[x.aim.id] = teachLoopRetaught(t.loop[x.aim.id]);
  if(typeof mirrorToClass === 'function') mirrorToClass(c || S);
  if(typeof saveSoon === 'function') saveSoon();
}
/* ---------- can do it, next to can explain it ----------
   Which aim a school lesson's question checks: the `aim` the draft gave it;
   a lesson with one aim, that one; otherwise the aim whose point shares the
   most words with the question — only when one aim clearly does (2+ words,
   no tie). Unknown → null: better unlinked than linked to the wrong aim. */
function teachAimOfAsk(les, i){
  const aims = les && les.school && les.aims, b = les && les.beats && les.beats[i];
  if(!aims || !aims.length || !b || b.t !== 'ask') return null;
  if(Number.isInteger(b.aim) && b.aim >= 1 && b.aim <= aims.length) return aims[b.aim - 1].id;
  if(aims.length === 1) return aims[0].id;
  const q = new Set(teachTokens(((b.q || {}).en || '') + ' ' + ((b.q || {}).hi || '')).filter(w => w.length >= 4));
  const score = aims.map(a => teachTokens(((a.point || {}).en || '') + ' ' + ((a.point || {}).hi || '') + ' ' + (a.ideas || []).map(x => x.en || '').join(' '))
    .filter((w, j, all) => w.length >= 4 && all.indexOf(w) === j && q.has(w)).length);
  const best = Math.max(...score);
  return best >= 2 && score.filter(x => x === best).length === 1 ? aims[score.indexOf(best)].id : null;
}
/* A first answer on its own (never a helped one) to a school lesson's question. */
function teachDid(les, i, ok, c){
  const id = teachAimOfAsk(les, i);
  if(!id) return null;
  const t = teachOf(c), r = t.did[id] = t.did[id] || [0, 0];
  r[1]++; if(ok) r[0]++;
  const keys = Object.keys(t.did); for(const k of keys.slice(0, Math.max(0, keys.length - 60))) delete t.did[k];
  if(typeof mirrorToClass === 'function') mirrorToClass(c || S);
  return id;
}
/* For the class: y = most first answers on this aim right, n = not yet. Letters only. */
function teachDidOf(c){
  const d = (c && c.teach && c.teach.did) || {}, out = {};
  for(const [id, r] of Object.entries(d)) if(Array.isArray(r) && r[1] > 0) out[id] = r[0] * 2 >= r[1] ? 'y' : 'n';
  return out;
}

/* One class's loops, counted: for the teacher's card. */
function teachLoopCounts(loops){
  const k = { first: 0, after: 0, alone: 0, waiting: 0, working: 0, notyet: 0 };
  for(const v of loops){
    if(!TEACH_LOOP_RE.test(v || '')) continue;
    const re = v.includes('r'), last = v[v.length - 1];
    if(v === 'c') k.first++;
    else if(re && last === 'r') k.waiting++;
    else if(re) last === 'c' ? k.after++ : k.working++;
    else if(v.length > 1 && last === 'c') k.alone++;
    else k.notyet++;
  }
  k.gap = k.after + k.alone + k.waiting + k.working + k.notyet;
  return k;
}

/* Units with points still to teach Appu again. */
function teachAgainList(c){
  const t = teachOf(c);
  return Object.entries(t.units).filter(([, u]) => u.gaps && u.gaps.length).map(([id, u]) => ({ id, ...u }))
    .sort((x, y) => String(y.at).localeCompare(String(x.at)));
}
