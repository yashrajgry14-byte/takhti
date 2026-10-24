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
  while(set.size<4){ const d=ans + (Math.random()<.5?-1:1)*r(1,Math.max(2,Math.round(ans*.3))); if(d>=0) set.add(d); }
  return { a,b,op,ans, opts:[...set].sort(()=>Math.random()-.5) };
}
