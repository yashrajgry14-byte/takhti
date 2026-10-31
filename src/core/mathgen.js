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
   different minds needing different help. mistakeAnswers() lists, for one
   question, the answer each known mistake produces; whichMistake() names
   the mistake behind an answer the child gave; mistakeTip() is the one
   line of help for it — with this question's numbers, never the final
   answer. Specific mistakes come before the generic slips, so an answer
   two mistakes would explain is put down to the more telling one.
   ================================================================== */
const MISTAKES = {
  nocarry:     { en: 'forgets to carry the ten',                         hi: 'हासिल वाली दहाई जोड़ना भूल जाते हैं' },
  colsjoin:    { en: "writes each column's total side by side",           hi: 'हर कॉलम का जोड़ अलग-अलग साथ लिख देते हैं' },
  smallbig:    { en: 'takes the smaller digit from the bigger one',       hi: 'हर कॉलम में बड़े अंक में से छोटा घटा देते हैं' },
  noborrowback:{ en: "borrows a ten but doesn't take it from the tens",   hi: 'दहाई उधार लेते हैं, पर दहाई में से कम नहीं करते' },
  tensnotx:    { en: 'multiplies only the ones',                          hi: 'सिर्फ़ इकाई का गुणा करते हैं' },
  lefttoright: { en: 'works left to right instead of multiplying first',  hi: 'पहले गुणा करने की जगह बाएँ से दाएँ हल करते हैं' },
  groupcount:   { en: 'counts one group too many or too few',              hi: 'एक समूह ज़्यादा या कम गिन लेते हैं' },
  wrongop:     { en: 'uses a different sign (adds instead, say)',         hi: 'दूसरा चिह्न लगा देते हैं (जैसे जोड़ देते हैं)' },
  tenslip:     { en: 'slips by ten in the tens',                          hi: 'दहाई में दस आगे-पीछे हो जाते हैं' },
  countslip:   { en: 'is one away when counting',                         hi: 'गिनती में एक आगे-पीछे हो जाते हैं' }
};
const MOP = { '+': '+', '−': '−', '-': '−', '×': '×', 'x': '×', '*': '×', '÷': '÷', '/': '÷' };

function mistakeAnswers(pIn){
  const a = +pIn.a, b = +pIn.b, c = pIn.c == null ? null : +pIn.c, op = MOP[pIn.op] || pIn.op;
  const out = [], put = (id, v) => { if(Number.isInteger(v) && v >= 0) out.push({ id, v }); };
  if(!Number.isFinite(a) || !Number.isFinite(b)) return out;
  let ans;
  if(c != null){
    ans = a + b * c;
    put('lefttoright', (a + b) * c);
  } else if(op === '+'){
    ans = a + b;
    const ones = a % 10 + b % 10, tens = Math.floor(a / 10) + Math.floor(b / 10);
    if((a >= 10 || b >= 10) && ones >= 10){
      put('nocarry', ans - 10);
      if(a < 100 && b < 100) put('colsjoin', Number(String(tens) + String(ones)));
    }
  } else if(op === '−'){
    ans = a - b;
    if(a >= 10 && a % 10 < b % 10){
      put('smallbig', Math.abs(a % 10 - b % 10) + (Math.floor(a / 10) - Math.floor(b / 10)) * 10);
      put('noborrowback', ans + 10);
    }
    put('wrongop', a + b);
  } else if(op === '×'){
    ans = a * b;
    const big = Math.max(a, b), small = Math.min(a, b);
    if(big >= 10 && small < 10) put('tensnotx', (big % 10) * small + (big - big % 10));
    for(const g of [a, b]) if(g > 0){ put('groupcount', ans + g); put('groupcount', ans - g); }
    put('wrongop', a + b);
  } else if(op === '÷'){
    if(!(b > 0)) return out;
    ans = a / b;
    put('wrongop', a - b);
  } else return out;
  if(ans >= 10){ put('tenslip', ans + 10); put('tenslip', ans - 10); }
  put('countslip', ans + 1); put('countslip', ans - 1);
  return out.filter(m => m.v !== ans);
}

/* 'right', a mistake's id, or 'other' (a wrong answer no known mistake explains). */
function mistakeAnswerOf(p){
  const op = MOP[p.op] || p.op, a = +p.a, b = +p.b;
  return p.c != null ? a + b * +p.c : op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' && b ? a / b : NaN;
}
function whichMistake(p, given){
  const g = Number(given);
  if(g === mistakeAnswerOf(p)) return 'right';
  const m = mistakeAnswers(p).find(x => x.v === g);
  return m ? m.id : 'other';
}

/* One line of help aimed at this mistake, with this question's numbers.
   `num` writes a number (number words on a call); spoken lines say the
   signs in words. Never the final answer. */
function mistakeTip(id, pIn, lang, num, spoken){
  const hi = lang === 'hi', N = num || String;
  const a = +pIn.a, b = +pIn.b, c = pIn.c == null ? null : +pIn.c;
  const X = spoken ? (hi ? ' गुणा ' : ' times ') : ' × ', P = spoken ? (hi ? ' और ' : ' plus ') : ' + ';
  const a1 = a % 10, b1 = b % 10, ones = a1 + b1, at = Math.floor(a / 10);
  const big = Math.max(a, b), small = Math.min(a, b);
  const SIGN = { '+': ['plus', 'जोड़'], '−': ['minus — take away', 'घटाना'], '×': ['times', 'गुणा'], '÷': ['share — divide', 'भाग'] };
  switch(id){
    case 'nocarry': return hi ? `${N(a1)}${P}${N(b1)} मिलकर ${N(ones)} होते हैं: इकाई में ${N(ones % 10)} रखो, और एक दहाई, दहाई में ले जाओ।`
                                : `${N(a1)}${P}${N(b1)} makes ${N(ones)}: keep ${N(ones % 10)} in the ones, and carry the ten over to the tens.`;
    case 'colsjoin': return hi ? `${N(ones)} इकाइयाँ एक जगह में नहीं आतीं: यह एक दहाई और ${N(ones % 10)} इकाई है।`
                                 : `${N(ones)} ones won't fit in one place: that's one ten and ${N(ones % 10)} ones.`;
    case 'smallbig': return hi ? `इकाई में ${N(a1)}, ${N(b1)} से छोटा है, तो पहले एक दहाई उधार लो: ${N(a1 + 10)} में से ${N(b1)}।`
                                 : `In the ones, ${N(a1)} is smaller than ${N(b1)}, so borrow a ten first: ${N(a1 + 10)} take away ${N(b1)}.`;
    case 'noborrowback': return hi ? `एक दहाई उधार ली, तो अब दहाई ${N(at)} नहीं, ${N(at - 1)} बची हैं।`
                                     : `You borrowed a ten, so there are ${N(at - 1)} tens left now, not ${N(at)}.`;
    case 'tensnotx': return hi ? `दहाई का भी गुणा करो: ${N(small)}${X}${N(big - big % 10)}, और ${N(small)}${X}${N(big % 10)}।`
                                 : `Multiply the tens too: ${N(small)}${X}${N(big - big % 10)}, and ${N(small)}${X}${N(big % 10)}.`;
    case 'lefttoright': return hi ? `पहले गुणा करो: ${N(b)}${X}${N(c)}, फिर ${N(a)} जोड़ो।` : `Multiply first: ${N(b)}${X}${N(c)}, then add ${N(a)}.`;
    case 'groupcount': {
      // count on in groups, stopping well short of the answer
      const run = [1, 2, 3].filter(k => k < b).map(k => N(k * a)).join(', ');
      return hi ? `${N(a)}${X}${N(b)} यानी ${N(a)} के ${N(b)} समूह: समूह ध्यान से गिनो${run ? ' — ' + run + '…' : '।'}`
                : `${N(a)}${X}${N(b)} is ${N(b)} groups of ${N(a)}: count the groups carefully${run ? ' — ' + run + '…' : '.'}`;
    }
    case 'wrongop': { const s = SIGN[MOP[pIn.op] || pIn.op] || SIGN['+']; return hi ? `चिह्न देखो: यह ${s[1]} है।` : `Look at the sign: it's ${s[0]}.`; }
    case 'tenslip': return hi ? 'इकाई सही है — दहाई एक बार फिर देखो।' : 'The ones are right — check the tens once more.';
    case 'countslip': return hi ? 'बहुत पास — बस एक का फ़र्क़। एक बार धीरे से फिर गिनो।' : 'So close — just one away. Count once more, slowly.';
  }
  return '';
}
