/* ==================================================================
   SKILL-SHAPED PROBLEMS (Tier 0)

   genProblem(lvl) below serves the free-practice maths screen by level.
   skillProblem() serves anything that teaches ONE named skill from the
   skill graph — a teacher's homework story, a cartoon episode — so the
   question actually exercises that skill: carrying really carries,
   borrowing really borrows, a BODMAS question really needs the order of
   operations. Every number is capped by the child's age band, the
   options are shuffled (the right answer is not always first), and each
   wrong option is a REAL mistake a child makes for that skill — the
   wrong-order BODMAS answer, one group too many in a times table, a
   dropped ten — so a wrong tap tells the diagnostic something.

   Deterministic for a given seed (core/daily-engine.js's seedOf/rng):
   the same child, skill and day get the same problem, so replaying a
   story or episode is consistent. Returns null for skills that are not
   a single arithmetic question (shapes, time, fractions, reading, ...)
   — callers must not pretend to teach those with a sum.
   ================================================================== */
const SKILL_OPS = {
  count20:'+', add10:'+', bonds10:'+', add2:'+', carry:'+', place2:'+', place3:'+', skip:'+', money2:'+',
  sub10:'−', sub2:'−', borrow:'−',
  tables:'×', mult2x1:'×', mult2x2:'×',
  divshare:'÷', divrem:'÷', longdiv:'÷',
  twostep3:'mix', bodmas:'mix'
};
const skillHasProblem = id => !!SKILL_OPS[id];

function skillProblem(skillId, seed){
  const op = SKILL_OPS[skillId];
  if(!op) return null;
  const rnd = rng(seed >>> 0);
  const r = (a,b) => a + Math.floor(rnd() * (b - a + 1));
  const cap = band().maxNumber;
  let a, b, c = null, ans, wrong = [];

  for(let tries = 0; tries < 30; tries++){
    const shrink = tries > 10;   // couldn't fit the band's ceiling — use the skill's smallest form
    if(op === '+'){
      if(skillId === 'add10' || skillId === 'bonds10'){ a = r(1,8); b = r(1, 10 - a); }
      else if(skillId === 'count20'){ a = r(5,12); b = r(1, Math.min(8, 20 - a)); }
      else if(skillId === 'skip'){ b = [2,5,10][r(0,2)]; a = b * r(1,6); }
      else if(skillId === 'carry'){ a = r(1,7)*10 + r(5,9); b = r(1,2)*10 + r(10 - a % 10, 9); }
      else if(skillId === 'place3'){ a = r(1,6)*100 + r(0,9)*10 + r(0,9); b = r(1,3)*100 + r(0,9)*10; }
      else { a = r(1,6)*10 + r(0,4); b = r(1,3)*10 + r(0,5); }      // add2, place2, money2: no carry
      if(shrink){ a = r(1,5); b = r(1,4); }
      ans = a + b;
      wrong = [ans + 1, ans - 1, ans + 10, ans - 10];
      if(skillId === 'carry') wrong.unshift(ans - 10);             // forgot to carry the one
    } else if(op === '−'){
      if(skillId === 'sub10'){ a = r(3,10); b = r(1, a - 1); }
      else if(skillId === 'borrow'){ a = r(3,9)*10 + r(0,4); b = r(1, Math.floor(a/10) - 1)*10 + r(a % 10 + 1, 9); }
      else { a = r(3,9)*10 + r(5,9); b = r(1,2)*10 + r(0, a % 10); }  // sub2: no borrow
      if(shrink){ a = r(4,9); b = r(1,3); }
      ans = a - b;
      wrong = [ans + 1, ans - 1, ans + 10];
      if(skillId === 'borrow') wrong.unshift(Math.abs((a % 10) - (b % 10)) + (Math.floor(a/10) - Math.floor(b/10)) * 10);  // subtracted the smaller digit from the bigger
    } else if(op === '×'){
      if(skillId === 'mult2x2'){ a = r(11,25); b = r(11,19); }
      else if(skillId === 'mult2x1'){ a = r(12,40); b = r(2,6); }
      else { a = r(2,10); b = r(2,10); }
      if(shrink){ a = r(1,3); b = r(2,3); }
      ans = a * b;
      wrong = [ans + a, ans - a, ans + b, a + b];                  // one group too many/few, or added instead
    } else if(op === '÷'){
      b = r(2,6); ans = skillId === 'longdiv' ? r(11,40) : r(2,9);
      if(shrink){ b = 2; ans = r(2,5); }
      a = ans * b;
      wrong = [ans + 1, ans - 1, a - b];
    } else {                                                        // 'mix': a + b × c
      a = r(2,9); b = r(2,6); c = r(2,5);
      if(shrink){ a = r(1,4); b = 2; c = r(2,3); }
      ans = a + b * c;
      wrong = [(a + b) * c, ans + c, ans - 1];                       // the classic: added first
    }
    if(ans <= cap && a <= cap) break;
  }

  const opts = [ans];
  for(const w of wrong) if(w >= 0 && !opts.includes(w) && opts.length < 3) opts.push(w);
  while(opts.length < 3){ const w = ans + opts.length + 1; if(!opts.includes(w)) opts.push(w); }
  for(let i = opts.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }

  const text = c == null ? `${a} ${op} ${b}` : `${a} + ${b} × ${c}`;
  return { skillId, op, a, b, c, ans, text, opts: opts.map(String), correct: opts.indexOf(ans) };
}

/* ---------------- free-practice generator (Tier 0) ---------------- */
function genProblem(lvl){
  const r=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  let a,b,op,ans;
  if(lvl===1){ a=r(1,4); b=r(1,4); op='+'; }
  else if(lvl===2){ a=r(2,7); b=r(1,6); op='+'; }
  else if(lvl===3){ a=r(4,9); b=r(1,4); op='−'; }
  else if(lvl===4){ a=r(12,38); b=r(6,29); op='+'; }
  else if(lvl===5){ a=r(22,60); b=r(8,19); op='−'; }
  else { a=r(2,9); b=r(2,9); op='×'; }

  // age ceiling: never hand a child a number bigger than their band allows
  const cap = band().maxNumber;
  a = Math.min(a, cap); b = Math.min(b, cap);
  if(op==='−' && a<b) [a,b] = [b,a];   // keep subtraction non-negative after capping

  ans = op==='+'? a+b : op==='−'? a-b : a*b;
  const set = new Set([ans]);
  // the real mistakes for this sum go in first (forgot to carry, took the
  // smaller digit from the bigger…), so a wrong tap says WHICH mistake —
  // core/twin.js keeps track of the ones a child repeats
  for(const m of mistakeAnswers({ a, b, op })) if(set.size < 3 && m.v >= 0 && m.v !== ans && !/slip$/.test(m.id)) set.add(m.v);
  // span must leave 3 distinct non-negative distractors: at ans 0 a span
  // of 2 only reaches {1,2}, and this loop never ended (level 3, 4 − 4)
  const span = Math.max(ans < 2 ? 3 : 2, Math.round(ans*.3));
  while(set.size<4){ const d=ans + (Math.random()<.5?-1:1)*r(1,span); if(d>=0) set.add(d); }
  return { a,b,op,ans, opts:[...set].sort(()=>Math.random()-.5) };
}

/* ==================================================================
   THE MISTAKES CHILDREN REALLY MAKE

   A wrong answer is not just "wrong": 38 + 24 = 52 (the carried ten was
   dropped) and 38 + 24 = 512 (each column written down on its own) are
   different minds needing different help. The list of ways a child can
   go wrong has no end, so this is built in two layers:

   1. COLUMN PROCEDURES. Sums are worked the way a child really works
      them — column by column — with each step done right or in one of
      the ways children are documented to do it wrong (Brown & Burton's
      "buggy" procedures, Ashlock's error patterns): the carry dropped,
      written in, or the wrong digit carried; the smaller digit taken from
      the bigger; a borrow that never leaves the tens; borrowing across a
      zero; the shorter number lined up on the left; the answer's digits
      reversed… Any combination of these is a mistake the engine can name
      and explain, so an answer nobody listed ("misaligned AND forgot to
      carry") is still understood.
   2. NAMED MISTAKES (MISTAKES): the single steps above, and the ones that
      aren't column steps (counting the first number again, adding all the
      digits, the wrong sign, multiplying first, one group off, a ten or a
      one away), each with a line of help (mistakeTip) and a short
      explanation aimed at it (mistakeExplain) — with this question's
      numbers, never the final answer.

   whichMistake() names a single known mistake; procMatches() finds the
   combinations behind an answer no single mistake explains; core/twin.js
   keeps a combination only when it explains answers to two DIFFERENT
   questions (a coincidence rarely does), and a combination many children
   share comes back from the shared database (S.mistakeRules) as known.
   ================================================================== */
const MISTAKES = {
  nocarry:     { en: 'forgets to carry the ten',                         hi: 'हासिल वाली दहाई जोड़ना भूल जाते हैं' },
  colsjoin:    { en: "writes each column's total side by side",           hi: 'हर कॉलम का जोड़ अलग-अलग साथ लिख देते हैं' },
  carryones:   { en: 'carries the ones digit instead of the ten',         hi: 'दहाई की जगह इकाई वाला अंक हासिल ले जाते हैं' },
  misalign:    { en: 'lines the shorter number up on the left',           hi: 'छोटी संख्या को बाईं ओर से मिलाकर लिखते हैं' },
  adddigits:   { en: 'adds all the digits together',                      hi: 'सारे अंक एक साथ जोड़ देते हैं' },
  countincl:   { en: 'counts the first number again when counting on',    hi: 'आगे गिनते समय पहली संख्या दोबारा गिन लेते हैं' },
  smallbig:    { en: 'takes the smaller digit from the bigger one',       hi: 'हर कॉलम में बड़े अंक में से छोटा घटा देते हैं' },
  noborrowback:{ en: "borrows a ten but doesn't take it from the tens",   hi: 'दहाई उधार लेते हैं, पर दहाई में से कम नहीं करते' },
  zeroborrow:  { en: 'borrows across a zero but stops at the zero',       hi: 'शून्य से उधार लेते समय आगे वाले अंक को कम नहीं करते' },
  zerozero:    { en: 'thinks 0 take away a number is 0',                  hi: 'सोचते हैं कि 0 में से कुछ घटाओ तो 0 बचता है' },
  nminus0:     { en: 'thinks a number take away 0 is 0',                  hi: 'सोचते हैं कि किसी संख्या में से 0 घटाओ तो 0 बचता है' },
  tensnotx:    { en: 'multiplies only the ones',                          hi: 'सिर्फ़ इकाई का गुणा करते हैं' },
  xnocarry:    { en: 'forgets to carry when multiplying',                 hi: 'गुणा में हासिल ले जाना भूल जाते हैं' },
  xcolsjoin:   { en: 'writes each product side by side',                  hi: 'हर गुणनफल अलग-अलग साथ लिख देते हैं' },
  addfirst:    { en: 'adds the carry before multiplying',                 hi: 'गुणा से पहले हासिल जोड़ देते हैं' },
  lefttoright: { en: 'works left to right instead of multiplying first',  hi: 'पहले गुणा करने की जगह बाएँ से दाएँ हल करते हैं' },
  groupcount:  { en: 'counts one group too many or too few',              hi: 'एक समूह ज़्यादा या कम गिन लेते हैं' },
  divmult:     { en: 'multiplies when sharing',                           hi: 'भाग की जगह गुणा कर देते हैं' },
  wrongop:     { en: 'uses a different sign (adds instead, say)',         hi: 'दूसरा चिह्न लगा देते हैं (जैसे जोड़ देते हैं)' },
  reversed:    { en: "writes the answer's digits the wrong way round",    hi: 'जवाब के अंक उल्टे क्रम में लिख देते हैं' },
  tenslip:     { en: 'slips by ten in the tens',                          hi: 'दहाई में दस आगे-पीछे हो जाते हैं' },
  countslip:   { en: 'is one away when counting',                         hi: 'गिनती में एक आगे-पीछे हो जाते हैं' }
};
const MOP = { '+': '+', '−': '−', '-': '−', '×': '×', 'x': '×', '*': '×', '÷': '÷', '/': '÷' };

/* ---------- 1. column procedures ---------- */
const PROC = {
  '+': { carry: ['ok', 'none', 'write', 'ones'], align: ['right', 'left'], out: ['fwd', 'rev'] },
  '−': { borrow: ['ok', 'smallbig', 'nodec', 'zeronodec', 'zerozero', 'nminus0'], align: ['right', 'left'], out: ['fwd', 'rev'] },
  '×': { carry: ['ok', 'none', 'write', 'addfirst'], out: ['fwd', 'rev'] }
};
// a single wrong step, and the named mistake it is
const PROC_NAMED = {
  '+|carry=none': 'nocarry', '+|carry=write': 'colsjoin', '+|carry=ones': 'carryones', '+|align=left': 'misalign', '+|out=rev': 'reversed',
  '−|borrow=smallbig': 'smallbig', '−|borrow=nodec': 'noborrowback', '−|borrow=zeronodec': 'zeroborrow', '−|borrow=zerozero': 'zerozero',
  '−|borrow=nminus0': 'nminus0', '−|align=left': 'misalign', '−|out=rev': 'reversed',
  '×|carry=none': 'xnocarry', '×|carry=write': 'xcolsjoin', '×|carry=addfirst': 'addfirst', '×|out=rev': 'reversed'
};
const pdig = n => String(n).split('').reverse().map(Number);
function procOut(cols, o){
  if(cols.some(x => !(x >= 0))) return null;
  let t = cols.map(String).reverse().join('').replace(/^0+(?=\d)/, '');
  if(o.out === 'rev') t = t.split('').reverse().join('').replace(/^0+(?=\d)/, '');
  return Number(t);
}
function procShift(A, B, o){
  if(o.align !== 'left') return [A, B];
  if(A.length === B.length) return null;                  // lining up on the left changes nothing
  const d = Math.abs(A.length - B.length), pad = Array(d).fill(0);
  return A.length < B.length ? [pad.concat(A), B] : [A, pad.concat(B)];
}
function procAdd(a, b, o){
  const ab = procShift(pdig(a), pdig(b), o); if(!ab) return null;
  const [A, B] = ab, n = Math.max(A.length, B.length), cols = [];
  let c = 0;
  for(let i = 0; i < n; i++){
    const s = (A[i] || 0) + (B[i] || 0) + (o.carry === 'none' || o.carry === 'write' ? 0 : c);
    if(o.carry === 'write'){ cols.push(s); c = 0; }
    else if(o.carry === 'ones' && s >= 10){ cols.push(Math.floor(s / 10)); c = s % 10; }
    else { cols.push(s % 10); c = o.carry === 'none' ? 0 : Math.floor(s / 10); }
  }
  if(c) cols.push(c);
  return procOut(cols, o);
}
function procSub(a, b, o){
  if(a < b) return null;
  const ab = procShift(pdig(a), pdig(b), o); if(!ab) return null;
  const T = ab[0].slice(), B = ab[1], cols = [];
  if(B.length > T.length) return null;
  for(let i = 0; i < T.length; i++){
    let t = T[i]; const d = B[i] || 0, has = i < B.length;
    if(o.borrow === 'smallbig'){ cols.push(Math.abs(t - d)); continue; }
    if(o.borrow === 'nminus0' && has && d === 0 && t > 0){ cols.push(0); continue; }
    if(t < d){
      if(o.borrow === 'zerozero' && t === 0){ cols.push(0); continue; }
      t += 10;
      if(o.borrow !== 'nodec'){
        let j = i + 1, stop = false;
        while(j < T.length && T[j] === 0){ T[j] = 9; j++; if(o.borrow === 'zeronodec'){ stop = true; break; } }
        if(!stop){ if(j >= T.length) return null; T[j]--; }
      }
    }
    cols.push(t - d);
  }
  return procOut(cols, o);
}
function procMul(a, b, o){
  const big = Math.max(a, b), s = Math.min(a, b);
  if(!(big >= 10 && s < 10)) return null;
  const D = pdig(big), cols = [];
  let c = 0;
  for(let i = 0; i < D.length; i++){
    const v = o.carry === 'addfirst' ? (D[i] + c) * s : D[i] * s + (o.carry === 'none' || o.carry === 'write' ? 0 : c);
    if(o.carry === 'write'){ cols.push(v); c = 0; }
    else { cols.push(v % 10); c = o.carry === 'none' ? 0 : Math.floor(v / 10); }
  }
  if(c) cols.push(c);
  return procOut(cols, o);
}
const PROC_RUN = { '+': procAdd, '−': procSub, '×': procMul };

/* Every way of working this question with one or more wrong steps, and
   the answer each gives: [{ code: '+|align=left|carry=none', v }]. */
function procAnswers(pIn){
  const op = MOP[pIn.op] || pIn.op, a = +pIn.a, b = +pIn.b;
  if(pIn.c != null || !PROC[op] || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return [];
  const ans = mistakeAnswerOf(pIn), keys = Object.keys(PROC[op]), out = [];
  const walk = (k, o) => {
    if(k === keys.length){
      const parts = keys.filter(x => o[x] !== PROC[op][x][0]).map(x => `${x}=${o[x]}`).sort();
      if(!parts.length) return;
      const v = PROC_RUN[op](a, b, o);
      if(v != null && Number.isFinite(v) && v !== ans) out.push({ code: [op].concat(parts).join('|'), v, n: parts.length });
      return;
    }
    for(const val of PROC[op][keys[k]]) walk(k + 1, Object.assign({}, o, { [keys[k]]: val }));
  };
  walk(0, {});
  return out.sort((x, y) => x.n - y.n);
}
/* A code the engine can run: an op, then known steps (validated before
   anything that came over the network is used). */
function procValid(code){
  const parts = String(code || '').split('|'), op = parts.shift();
  if(!PROC[op] || !parts.length || parts.length > 3) return false;
  const seen = {};
  return parts.every(x => { const [k, v] = x.split('='); if(!PROC[op][k] || PROC[op][k].indexOf(v) < 1 || seen[k]) return false; seen[k] = 1; return true; });
}
/* The combinations behind an answer that no single named mistake explains. */
function procMatches(p, given){
  const g = Number(given);
  return procAnswers(p).filter(x => x.v === g && x.n >= 2).map(x => x.code);
}

/* ---------- 2. named mistakes ---------- */
function mistakeAnswerOf(p){
  const op = MOP[p.op] || p.op, a = +p.a, b = +p.b;
  return p.c != null ? a + b * +p.c : op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' && b ? a / b : NaN;
}
function mistakeAnswers(pIn){
  const a = +pIn.a, b = +pIn.b, c = pIn.c == null ? null : +pIn.c, op = MOP[pIn.op] || pIn.op;
  const out = [], put = (id, v) => { if(Number.isInteger(v) && v >= 0) out.push({ id, v }); };
  if(!Number.isFinite(a) || !Number.isFinite(b)) return out;
  const ans = mistakeAnswerOf(pIn);
  if(!Number.isFinite(ans)) return out;
  // single wrong column steps, from the engine; then combinations the
  // shared database says many children make (S.mistakeRules)
  const proc = c == null ? procAnswers(pIn) : [];
  for(const x of proc) if(x.n === 1 && PROC_NAMED[x.code] !== 'reversed') put(PROC_NAMED[x.code], x.v);
  const shared = typeof S !== 'undefined' && Array.isArray(S.mistakeRules) ? S.mistakeRules : [];
  for(const x of proc) if(x.n >= 2 && shared.includes(x.code)) put(x.code, x.v);
  if(c != null) put('lefttoright', (a + b) * c);
  else if(op === '+'){
    if(a >= 10 || b >= 10) put('adddigits', pdig(a).concat(pdig(b)).reduce((t, d) => t + d, 0));
    if(a < 10 && b < 10 && b > 1) put('countincl', ans - 1);
    if(a >= b) put('wrongop', a - b);
  } else if(op === '−') put('wrongop', a + b);
  else if(op === '×'){
    const big = Math.max(a, b), small = Math.min(a, b);
    if(big >= 10 && small < 10) put('tensnotx', (big % 10) * small + (big - big % 10));
    for(const g of [a, b]) if(g > 0){ put('groupcount', ans + g); put('groupcount', ans - g); }
    put('wrongop', a + b);
  } else if(op === '÷'){
    if(!(b > 0)) return [];
    put('wrongop', a - b);
    put('divmult', a * b);
  }
  if(ans >= 10){
    const r = Number(String(ans).split('').reverse().join(''));
    if(r !== ans) put('reversed', r);
    put('tenslip', ans + 10); put('tenslip', ans - 10);
  }
  put('countslip', ans + 1); put('countslip', ans - 1);
  return out.filter(m => m.v !== ans);
}

/* 'right', a named mistake's id (or a shared combination's code), or
   'other' — a wrong answer no single known mistake explains. */
function whichMistake(p, given){
  const g = Number(given);
  if(g === mistakeAnswerOf(p)) return 'right';
  const m = mistakeAnswers(p).find(x => x.v === g);
  return m ? m.id : 'other';
}

/* What a mistake is called — a named one, or a combination of steps. */
function mistakeLabel(id){
  if(MISTAKES[id]) return MISTAKES[id];
  if(procValid(id)){
    const parts = procParts(id).map(n => MISTAKES[n]).filter(Boolean);
    return { en: parts.map(x => x.en).join(', and '), hi: parts.map(x => x.hi).join(', और ') };
  }
  return null;
}
/* A combination as the named single steps it is made of. */
function procParts(code){
  const parts = String(code).split('|'), op = parts.shift();
  return parts.map(x => PROC_NAMED[op + '|' + x]).filter(Boolean);
}

/* One line of help aimed at this mistake, with this question's numbers.
   `num` writes a number (number words on a call); spoken lines say the
   signs in words. Never the final answer. */
function mistakeTip(id, pIn, lang, num, spoken){
  if(!MISTAKES[id] && procValid(id)) return procParts(id).map(n => mistakeTip(n, pIn, lang, num, spoken)).filter(Boolean).join(' ');
  const hi = lang === 'hi', N = num || String;
  const a = +pIn.a, b = +pIn.b, c = pIn.c == null ? null : +pIn.c;
  const X = spoken ? (hi ? ' गुणा ' : ' times ') : ' × ', P = spoken ? (hi ? ' और ' : ' plus ') : ' + ';
  const a1 = a % 10, b1 = b % 10, ones = a1 + b1, at = Math.floor(a / 10);
  const big = Math.max(a, b), small = Math.min(a, b), v1 = (big % 10) * small;
  const SIGN = { '+': ['plus', 'जोड़'], '−': ['minus — take away', 'घटाना'], '×': ['times', 'गुणा'], '÷': ['share — divide', 'भाग'] };
  switch(id){
    case 'nocarry': return hi ? `${N(a1)}${P}${N(b1)} मिलकर ${N(ones)} होते हैं: इकाई में ${N(ones % 10)} रखो, और एक दहाई, दहाई में ले जाओ।`
                                : `${N(a1)}${P}${N(b1)} makes ${N(ones)}: keep ${N(ones % 10)} in the ones, and carry the ten over to the tens.`;
    case 'colsjoin': return hi ? `${N(ones)} इकाइयाँ एक जगह में नहीं आतीं: यह एक दहाई और ${N(ones % 10)} इकाई है।`
                                 : `${N(ones)} ones won't fit in one place: that's one ten and ${N(ones % 10)} ones.`;
    case 'carryones': return hi ? `${N(ones)} में ${N(ones % 10)} इकाई में रहता है, और जो दहाई में जाता है वह 1 दहाई है।`
                                  : `In ${N(ones)}, the ${N(ones % 10)} stays in the ones — it's the 1 ten that goes over to the tens.`;
    case 'misalign': { const sh = Math.min(a, b), lg = Math.max(a, b);
      return hi ? `इकाई के नीचे इकाई लिखो: ${N(sh % 10)}, ${N(lg % 10)} के नीचे आएगा।` : `Line up the ones: ${N(sh % 10)} goes under the ${N(lg % 10)}.`; }
    case 'adddigits': return hi ? `${N(a)} में ${N(at)} दहाई और ${N(a1)} इकाई हैं: पहले इकाई से इकाई जोड़ो, फिर दहाई से दहाई।`
                                  : `${N(a)} is ${N(at)} tens and ${N(a1)} ones: add ones to ones, then tens to tens.`;
    case 'countincl': { const lg = Math.max(a, b), sh = Math.min(a, b);
      return sh > 1 ? (hi ? `${N(lg)} से आगे गिनना शुरू करो: ${N(lg + 1)}…` : `Start counting after ${N(lg)}: ${N(lg + 1)}…`)
                    : (hi ? `${N(lg)} से बस एक आगे गिनो।` : `Count just one on from ${N(lg)}.`); }
    case 'smallbig': return hi ? `इकाई में ${N(a1)}, ${N(b1)} से छोटा है, तो पहले एक दहाई उधार लो: ${N(a1 + 10)} में से ${N(b1)}।`
                                 : `In the ones, ${N(a1)} is smaller than ${N(b1)}, so borrow a ten first: ${N(a1 + 10)} take away ${N(b1)}.`;
    case 'noborrowback': return hi ? `एक दहाई उधार ली, तो अब दहाई ${N(at)} नहीं, ${N(at - 1)} बची हैं।`
                                     : `You borrowed a ten, so there are ${N(at - 1)} tens left now, not ${N(at)}.`;
    case 'zeroborrow': { const h = Math.floor(a / 100);
      return hi ? `दहाई में 0 है, तो दस सैकड़े से आते हैं: सैकड़े ${N(h)} से ${N(h - 1)} हो जाते हैं, और दहाई 9।`
                : `There are no tens to borrow, so the ten comes from the hundreds: ${N(h)} hundreds become ${N(h - 1)}, and the tens become 9.`; }
    case 'zerozero': return hi ? '0 में से कुछ घटाना हो तो पहले एक दहाई उधार लो — 0, 10 बन जाता है।' : "0 take away a number isn't 0: borrow a ten first, and the 0 becomes 10.";
    case 'nminus0': return hi ? '0 घटाने से संख्या वैसी ही रहती है — कुछ भी कम नहीं होता।' : 'Taking away 0 takes nothing away: the digit stays as it is.';
    case 'tensnotx': return hi ? `दहाई का भी गुणा करो: ${N(small)}${X}${N(big - big % 10)}, और ${N(small)}${X}${N(big % 10)}।`
                                 : `Multiply the tens too: ${N(small)}${X}${N(big - big % 10)}, and ${N(small)}${X}${N(big % 10)}.`;
    case 'xnocarry': return hi ? `${N(big % 10)}${X}${N(small)} = ${N(v1)}: इकाई में ${N(v1 % 10)} लिखो, और ${N(Math.floor(v1 / 10))} हासिल आगे ले जाओ।`
                                 : `${N(big % 10)}${X}${N(small)} is ${N(v1)}: write ${N(v1 % 10)} and carry ${N(Math.floor(v1 / 10))} to the next place.`;
    case 'xcolsjoin': return hi ? `${N(v1)} एक जगह में नहीं आता: ${N(v1 % 10)} लिखो, ${N(Math.floor(v1 / 10))} हासिल ले जाओ।`
                                  : `${N(v1)} won't fit in one place: write ${N(v1 % 10)}, and carry ${N(Math.floor(v1 / 10))}.`;
    case 'addfirst': { const t = Math.floor(big / 10) % 10, cy = Math.floor(v1 / 10);
      return hi ? `पहले गुणा, फिर हासिल जोड़ो: ${N(t)}${X}${N(small)}, उसके बाद ${N(cy)} जोड़ो।` : `Multiply first, then add the carry: ${N(t)}${X}${N(small)}, and then add ${N(cy)}.`; }
    case 'lefttoright': return hi ? `पहले गुणा करो: ${N(b)}${X}${N(c)}, फिर ${N(a)} जोड़ो।` : `Multiply first: ${N(b)}${X}${N(c)}, then add ${N(a)}.`;
    case 'groupcount': {
      // count on in groups, stopping well short of the answer
      const run = [1, 2, 3].filter(k => k < b).map(k => N(k * a)).join(', ');
      return hi ? `${N(a)}${X}${N(b)} यानी ${N(a)} के ${N(b)} समूह: समूह ध्यान से गिनो${run ? ' — ' + run + '…' : '।'}`
                : `${N(a)}${X}${N(b)} is ${N(b)} groups of ${N(a)}: count the groups carefully${run ? ' — ' + run + '…' : '.'}`;
    }
    case 'divmult': return hi ? `भाग यानी बराबर बाँटना: ${N(a)} को ${N(b)} बराबर हिस्सों में बाँटो।` : `Dividing is sharing equally: share ${N(a)} into ${N(b)} equal groups.`;
    case 'wrongop': { const s = SIGN[MOP[pIn.op] || pIn.op] || SIGN['+']; return hi ? `चिह्न देखो: यह ${s[1]} है।` : `Look at the sign: it's ${s[0]}.`; }
    case 'reversed': return hi ? 'अपनी संख्या फिर पढ़ो: पहले दहाई, फिर इकाई।' : 'Read your number again: tens first, then ones.';
    case 'tenslip': return hi ? 'इकाई सही है — दहाई एक बार फिर देखो।' : 'The ones are right — check the tens once more.';
    case 'countslip': return hi ? 'बहुत पास — बस एक का फ़र्क़। एक बार धीरे से फिर गिनो।' : 'So close — just one away. Count once more, slowly.';
  }
  return '';
}

/* A short explanation that goes straight at the mistake — what Munni
   teaches when this child keeps making it (core/twin.js), instead of the
   general steps. Ends on a question about a step, never the answer. */
function mistakeExplain(id, pIn, lang, num, spoken){
  if(!MISTAKES[id] && procValid(id)){
    const parts = procParts(id);
    return parts.map(n => mistakeTip(n, pIn, lang, num, spoken)).filter(Boolean);
  }
  const hi = lang === 'hi', N = num || String;
  const a = +pIn.a, b = +pIn.b, a1 = a % 10, b1 = b % 10, ones = a1 + b1, at = Math.floor(a / 10), bt = Math.floor(b / 10);
  const X = spoken ? (hi ? ' गुणा ' : ' times ') : ' × ';
  const tip = mistakeTip(id, pIn, lang, num, spoken);
  const L2 = (en, hiT) => hi ? hiT : en;
  switch(id){
    case 'nocarry': case 'colsjoin': case 'carryones':
      return [L2(`First the ones: ${N(a1)} and ${N(b1)} make ${N(ones)}.`, `पहले इकाई: ${N(a1)} और ${N(b1)} मिलकर ${N(ones)}।`),
              L2(`${N(ones)} is one ten and ${N(ones % 10)} ones. Only the ${N(ones % 10)} stays in the ones place.`, `${N(ones)} यानी एक दहाई और ${N(ones % 10)} इकाई। इकाई की जगह में सिर्फ़ ${N(ones % 10)} रहता है।`),
              L2(`The one ten joins the tens: ${N(at)} tens, ${N(bt)} tens, and one more ten. How many tens is that?`, `वह एक दहाई, दहाई में जुड़ती है: ${N(at)} दहाई, ${N(bt)} दहाई, और एक दहाई और। कितनी दहाई हुईं?`)];
    case 'smallbig': case 'noborrowback':
      return [L2(`Ones first: ${N(a1)} take away ${N(b1)}? ${N(a1)} is too small.`, `पहले इकाई: ${N(a1)} में से ${N(b1)}? ${N(a1)} छोटा है।`),
              L2(`So one ten moves to the ones: the ones become ${N(a1 + 10)}, and the tens become ${N(at - 1)}.`, `तो एक दहाई इकाई में आती है: इकाई ${N(a1 + 10)} हो जाती है, और दहाई ${N(at - 1)}।`),
              L2(`Now ${N(a1 + 10)} take away ${N(b1)} — what is it?`, `अब ${N(a1 + 10)} में से ${N(b1)} — कितना?`)];
    case 'tensnotx': case 'xnocarry': case 'xcolsjoin': case 'addfirst': {
      const big = Math.max(a, b), small = Math.min(a, b), t = big - big % 10, o = big % 10;
      return [L2(`${N(big)} is ${N(t)} and ${N(o)}. Multiply both parts by ${N(small)}.`, `${N(big)} यानी ${N(t)} और ${N(o)}। दोनों हिस्सों का ${N(small)} से गुणा करो।`),
              L2(`${N(o)}${X}${N(small)} is ${N(o * small)}.`, `${N(o)}${X}${N(small)} = ${N(o * small)}।`),
              L2(`And ${N(t)}${X}${N(small)} — what is it? Then put the two parts together.`, `और ${N(t)}${X}${N(small)} कितना? फिर दोनों हिस्से जोड़ो।`)];
    }
  }
  return tip ? [tip] : [];
}
