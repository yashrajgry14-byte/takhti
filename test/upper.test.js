/* ==================================================================
   CLASSES 6–10 — src/content/upper.js, the reading lines at levels 7–10
   (src/content/sentences.js) and the class table (src/content/ages.js).

   Proves, over hundreds of seeds of every kind:
     · each problem's right answer is right — worked out AGAIN here, from
       the question's own words, by code that shares nothing with the
       generator
     · four different choices, the right one among them; every wrong one
       is a named mistake whose help exists in English and Hindi
     · the steps (Ask Munni's, and the worked steps after a miss) never
       say the answer, unless the question itself already shows it
     · the same seed gives the same problem
   And: every kind's lessons pass the app's lesson checker and make their
   skills teachable; Classes 6–10 get their own levels, starts and number
   ceiling; a Class 4 child never meets a Class 6–10 lesson or game item,
   a Class 9 child meets Class 7–9 work; reading and writing lines exist
   at every new level in both languages; the column-sum generator never
   hands a phone call a text problem.
   ================================================================== */
const fs = require('fs'), vm = require('vm');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const ctx = { console, Intl, Math, Date, JSON, setTimeout, localStorage: { getItem: () => null, setItem(){} } };
vm.createContext(ctx);
const LOAD_LIST = ['src/state.js','src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js','src/content/comprehension.js',
  'src/content/geometry.js','src/content/clock.js','src/content/calendar.js','src/content/upper.js',
  'src/core/mathgen.js','src/games/game-core.js'];
for(const f of LOAD_LIST) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const X = vm.runInContext(`({ S, UPPER_KINDS, UPPER_LEVELS, UPPER_MISTAKES, UPPER_CONCEPTS, UPPER_SKILLS, upperMake, upperProblem, upperProblemFor,
  upperHasProblem, upperMistakeTip, SKILLS, skillById, generateLessons, validateLesson, lessonsForChild, band, bandFor, CLASSES,
  ageSentences, SENTENCES, genProblem, gameItems, clampLevel, skillCoverage })`, ctx);

/* ---- the answer, worked out again from the question's words ---- */
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while(b) [a, b] = [b, a % b]; return a || 1; };
const frac = (n, d) => { if(d < 0){ n = -n; d = -d; } const g = gcd(n, d); n /= g; d /= g; return d === 1 ? sgn(n) : `${sgn(n)}/${d}`; };
const sgn = n => n < 0 ? '−' + Math.abs(n) : String(n);
const nums = t => (t.replace(/−/g, '-').replace(/₹([\d,]+)/g, (_, x) => x.replace(/,/g, '')).match(/-?\d+(\.\d+)?/g) || []).map(Number);
const SUP = { '⁰':0,'¹':1,'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6,'⁷':7,'⁸':8,'⁹':9 };
const supN = t => Number(t.split('').map(c => SUP[c]).join(''));
const toSup = n => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
const rupee = n => '₹' + n.toLocaleString('en-IN');
const SOLVE = {
  int_add:      q => { const [a, b] = nums(q); return sgn(a + b); },
  frac_add:     q => { const [a, d, b] = nums(q.replace(/\//g, ' ')); return frac(a + b, d); },
  dec_add:      q => { const [a, b] = nums(q); return String(Math.round((a + b) * 1000) / 1000); },
  ratio:        q => { const [b, g] = nums(q); const k = gcd(b, g); return `${b / k}:${g / k}`; },
  pct_of:       q => { const [p, n] = nums(q); return String(n * p / 100); },
  alg_value:    q => { const [x, a, b] = nums(q.replace(/(\d)x/, '$1 ')); return String(a * x + b); },
  lin_eq:       q => { const [a, b, c] = nums(q); return `x = ${(c - b) / a}`; },
  int_mult:     q => { const [a, b] = nums(q); return sgn(a * b); },
  frac_mult:    q => { const [a, b, c, d] = nums(q.replace(/\//g, ' ')); return frac(a * c, b * d); },
  si:           q => { const [p, r, t] = nums(q); return rupee(p * r * t / 100); },
  profit:       q => { const [cp, sp] = nums(q); return `${(sp - cp) * 100 / cp}%`; },
  tri_area:     q => { const [b, h] = nums(q); return `${b * h / 2} cm²`; },
  alg_simplify: q => { const [a, b, c] = nums(q); const n = a + b - c; return n === 1 ? 'x' : `${n}x`; },
  power:        q => { const m = q.match(/^(\d+)([⁰-⁹¹²³]+)/); return String(Number(m[1]) ** supN(m[2])); },
  exp_law:      q => { const m = q.match(/^(\d+)([⁰-⁹¹²³]+) × \d+([⁰-⁹¹²³]+)/); return m[1] + toSup(supN(m[2]) + supN(m[3])); },
  lin_eq2:      q => { const m = q.match(/(\d+)x \+ (\d+) = (\d*)x \+ (\d+)/); const [a, b, c, d] = [m[1], m[2], m[3] || '1', m[4]].map(Number); return `x = ${(d - b) / (a - c)}`; },
  volume:       q => { const [l, b, h] = nums(q); return `${l * b * h} cm³`; },
  sqrt:         q => String(Math.round(Math.sqrt(nums(q)[0]))),
  factor:       q => { const [p, c] = nums(q.replace(/(\d)x/, '$1 ')); const g = gcd(p, c); return `${g}(${p / g === 1 ? '' : p / g}x + ${c / g})`; },
  pythag:       q => { const [a, b] = nums(q); return `${Math.sqrt(a * a + b * b)} cm`; },
  quad:         q => { const m = q.match(/x² − (\d+)x \+ (\d+)/); const S = +m[1], P = +m[2]; const disc = Math.sqrt(S * S - 4 * P); return `x = ${(S - disc) / 2} or ${(S + disc) / 2}`; },
  ap:           q => { const [n, a, a2] = nums(q.replace(/(\d+)th/, '$1 ')); return String(a + (n - 1) * (a2 - a)); },
  mean:         q => { const xs = nums(q); return String(xs.reduce((s, x) => s + x, 0) / xs.length); },
  prob:         q => { const [r, b] = nums(q); return frac(r, r + b); },
  trig:         q => { const [f, a] = q.split(/[ °]/); return ({ sin:{30:'1/2',60:'√3/2'}, cos:{30:'√3/2',60:'1/2'}, tan:{30:'1/√3',60:'√3'} })[f][a]; },
  dist:         q => { const [x1, y1, x2, y2] = nums(q); return String(Math.hypot(x2 - x1, y2 - y1)); },
  pair:         q => { const [s, d] = nums(q); return `x = ${(s + d) / 2}`; }
};
check('every kind has an independent solver here', Object.keys(X.UPPER_KINDS).every(k => SOLVE[k]), Object.keys(X.UPPER_KINDS).filter(k => !SOLVE[k]).join());

const tok = t => t.split(/[\s,:;()।?.]+/).filter(Boolean);
const faults = { wrongAns: [], opts: [], tip: [], steps: [], bi: [], seed: [] };
let made = 0;
for(const kind of Object.keys(X.UPPER_KINDS)){
  for(let i = 1; i <= 300; i++){
    const seed = i * 7919 + 17;
    const p = X.upperMake(kind, seed);
    if(!p){ faults.opts.push(`${kind}: no problem for seed ${seed}`); continue; }
    made++;
    const want = SOLVE[kind](p.q.en);
    if(want !== p.ans) faults.wrongAns.push(`${kind} "${p.q.en}" → ${p.ans}, but it is ${want}`);
    if(p.opts.length !== 4 || new Set(p.opts).size !== 4 || !p.opts.includes(p.ans)) faults.opts.push(`${kind} ${JSON.stringify(p.opts)} / ${p.ans}`);
    for(const o of p.opts.filter(o => o !== p.ans)){
      const m = p.why[o];
      if(!m || !X.UPPER_MISTAKES[m] || !X.UPPER_MISTAKES[m].en || !X.UPPER_MISTAKES[m].hi) faults.tip.push(`${kind}: "${o}" has no named mistake`);
      if(SOLVE[kind](p.q.en) === o) faults.wrongAns.push(`${kind}: wrong option "${o}" is actually right`);
    }
    for(const x of [...p.steps, p.ex]) if(!x || !x.en || !x.hi || !/[ऀ-ॿ]/.test(x.hi)) faults.bi.push(`${kind}: not bilingual`);
    // a question in words has its Hindi; a bare sum ("(−8) + 5 = ?") is the same in both
    if(!p.q.hi || (/[a-z]{4,}/i.test(p.q.en) && !/[ऀ-ॿ]/.test(p.q.hi))) faults.bi.push(`${kind}: question not in Hindi`);
    const a = p.ans.replace(/^x = /, '');
    for(const st of p.steps) for(const L of ['en', 'hi'])
      if(tok(st[L]).includes(a) && !tok(p.q[L]).includes(a)) faults.steps.push(`${kind}: "${st[L]}" says ${a}`);
    if(i <= 5 && JSON.stringify(X.upperMake(kind, seed)) !== JSON.stringify(p)) faults.seed.push(kind);
  }
}
check(`every answer is right, worked out again from the question (${made} problems, ${Object.keys(X.UPPER_KINDS).length} kinds)`, !faults.wrongAns.length, faults.wrongAns.slice(0, 4).join(' | '));
check('four different choices every time, the right one among them', !faults.opts.length, faults.opts.slice(0, 4).join(' | '));
check('every wrong choice is a named mistake with its help in English and Hindi', !faults.tip.length, faults.tip.slice(0, 4).join(' | '));
check('the steps never say the answer (unless the question already shows it)', !faults.steps.length, faults.steps.slice(0, 4).join(' | '));
check('steps and example in English and Devanagari Hindi; every worded question in Hindi too', !faults.bi.length, faults.bi.slice(0, 3).join(' | '));
check('the same seed gives the same problem', !faults.seed.length, faults.seed.join());
check('no mistake help gives a number away', Object.values(X.UPPER_MISTAKES).every(m => !/= ?-?\d/.test(m.en.replace(/[A-Z] × [A-Z] × [A-Z] ÷ 100|2⁴|2\.5|2\.50|3x/g, ''))), '');
check('the help names the slip a child made', X.upperMistakeTip({ why: { '9': 'signflip' } }, '9', 'hi') === X.UPPER_MISTAKES.signflip.hi, '');

/* ---- levels and skills ---- */
check('every level 7–10 has kinds to practise', [7, 8, 9, 10].every(l => X.UPPER_LEVELS[l].length >= 5), JSON.stringify(Object.fromEntries(Object.entries(X.UPPER_LEVELS).map(([l, k]) => [l, k.length]))));
check('free practice at a level gives a problem of that level', [7, 8, 9, 10].every(l => [1, 2, 3, 4, 5, 6].every(s => X.upperProblem(l, s * 31).level === l)), '');
check("every kind's skill is in the skill graph, at Class 5 to 10", Object.values(X.UPPER_KINDS).every(k => X.skillById(k.skill) && X.skillById(k.skill).g >= 5 && X.skillById(k.skill).g <= 10), Object.values(X.UPPER_KINDS).filter(k => !X.skillById(k.skill)).map(k => k.skill).join());
check('a problem for one skill is of that skill', ['integers', 'lineareq', 'exponents', 'trig', 'linear2'].every(s => X.upperProblemFor(s, 99).skill === s), '');
check('the new Class 8–10 skills are in the graph with their prerequisites', X.UPPER_SKILLS.every(s => X.skillById(s.id) && s.pre.every(p => X.skillById(p))), '');

/* ---- the Story Fire's lessons ---- */
const rep = X.generateLessons({ report: true });
const up = rep.lessons.filter(l => (l.concept || '').startsWith('up-'));
const upRej = rep.rejected.filter(r => r.id.includes('up-'));
check(`every Class 6–10 lesson passes the app's lesson checker (${up.length} lessons, ${Object.keys(X.UPPER_KINDS).length} kinds × 4)`, up.length === Object.keys(X.UPPER_KINDS).length * 4 && !upRej.length, JSON.stringify(upRej.slice(0, 2)));
check("each lesson's questions mark the worked-out answer right, and teach before they ask", up.every(l => l.beats.filter(b => b.t === 'ask').every(b => b.opts[b.correct] === SOLVE[b.upper](b.q.en)) && l.beats[0].t === 'intro' && l.beats[1].t === 'intro'), '');
check('every Class 6–10 skill these teach is now teachable', Object.values(X.UPPER_KINDS).every(k => X.skillById(k.skill).concepts.length > 0), '');
check('each lesson belongs to a class (6–9)', up.every(l => l.g >= 6 && l.g <= 9), '');

/* ---- classes: who gets what ---- */
const asClass = (cls, age) => { X.S.cls = cls; X.S.age = age; X.S.doneLessons = []; X.S._gamePool = null; X.S.name = 'T' + cls; };
asClass('c4', 9);
const c4 = X.lessonsForChild(40);
check('a Class 4 child is never offered a Class 6–10 lesson', c4.length > 0 && c4.every(l => l.g == null), c4.filter(l => l.g != null).map(l => l.id).join());
const g4 = X.gameItems(30);
check("…nor a Class 6–10 game question", g4.length > 0 && g4.every(it => it.g == null), g4.filter(it => it.g != null).map(it => it.id).slice(0, 3).join());
asClass('c9', 14);
const c9 = X.lessonsForChild(8);
check("a Class 9 child's lessons are Class 7–9 work", c9.length === 8 && c9.every(l => l.g >= 7 && l.g <= 9), c9.map(l => l.id + ':' + l.g).join());
const g9 = X.gameItems(10);
check("…and so are their game questions", g9.length > 0 && g9.every(it => it.g >= 7 && it.g <= 9), g9.map(it => it.g).join());
asClass('c6', 11);
check('a Class 6 child gets Class 6 lessons', X.lessonsForChild(8).every(l => l.g === 6), X.lessonsForChild(8).map(l => l.g).join());
const B = c => X.bandFor({ cls: c, age: 12 });
check('Classes 6–10 start at their own levels: reading 7, 8, 8, 9, 10; maths 7, 8, 9, 10, 10',
  ['c6','c7','c8','c9','c10'].map(c => B(c).start.read).join() === '7,8,8,9,10' && ['c6','c7','c8','c9','c10'].map(c => B(c).start.math).join() === '7,8,9,10,10',
  ['c6','c7','c8','c9','c10'].map(c => `${B(c).start.read}/${B(c).start.math}`).join(' '));
check('…with a level or two below to fall back on, and never past 10', ['c6','c7','c8','c9','c10'].every(c => B(c).levels.math[0] < B(c).start.math && B(c).levels.math[1] <= 10 && B(c).levels.read[1] <= 10), '');
check('Classes 6–10 allow bigger numbers than Class 5', B('c6').maxNumber > B('c5').maxNumber && B('c10').maxNumber > B('c6').maxNumber, `${B('c5').maxNumber} / ${B('c6').maxNumber} / ${B('c10').maxNumber}`);
check('Classes 1–5 keep exactly their levels and ceiling', B('c4').levels.math.join() === '3,6' && B('c5').maxNumber === 1000, '');

/* ---- reading and writing ---- */
const lines = []; for(const L of ['en', 'hi']) for(const l of [7, 8, 9, 10]) lines.push([L, l, (X.SENTENCES[L][l] || []).length]);
check('eight reading and writing lines at each of levels 7–10, in English and Hindi', lines.every(x => x[2] === 8), JSON.stringify(lines));
check('the Hindi lines are in Devanagari', [7, 8, 9, 10].every(l => X.SENTENCES.hi[l].every(t => /[ऀ-ॿ]/.test(t) && !/[a-z]/i.test(t))), '');
check('every line at levels 7–10 is new (none repeats a lower level)', (() => { const low = new Set([1,2,3,4,5,6].flatMap(l => X.SENTENCES.en[l])); return [7,8,9,10].every(l => X.SENTENCES.en[l].every(t => !low.has(t))); })(), '');
asClass('c9', 14);
const served = ['en', 'hi'].every(L => [8, 9, 10].every(l => X.ageSentences(L, l).length && X.ageSentences(L, l).every(t => X.SENTENCES[L][Math.min(10, Math.max(8, l))].includes(t) || X.SENTENCES[L][l].includes(t))));
check('a Class 9 child is served the level asked for (reading, and writing on paper or dictation)', served, '');
check("the level ladder can't drop a Class 9 child below level 7 (two under the start), or lift one past 10", X.clampLevel('read', 3) === 7 && X.clampLevel('math', 12) === 10, `${X.clampLevel('read', 3)} / ${X.clampLevel('math', 12)}`);

/* ---- the phone call keeps to column sums ---- */
const gp = [7, 8, 9, 10].map(l => X.genProblem(l));
check('genProblem never hands a phone call a text problem: levels above 6 give the top column sum', gp.every(p => p.kind == null && typeof p.a === 'number' && p.op === '×'), JSON.stringify(gp[0]));

console.log('-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length - failures}/${checks.length} checks passed`);
process.exit(failures ? 1 : 0);
