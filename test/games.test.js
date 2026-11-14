const fs=require('fs'), vm=require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

/* Same real load order index.html and sw.js's SHELL now ship: the full
   content graph, then core/diagnose.js, then src/games/game-core.js —
   which needs noteSkillAttempt, lessonBank, band, SKILLS, LIT and
   GRAMMAR, all of which exist by that point. No shell UI is loaded (none
   exists yet, by design) — this exercises gameBuildPool()/gameItems()/
   gameSets()/gameStart()/gameAnswer()/gameEnd() directly, exactly as a
   shell will eventually call them. */
const ctx={console, Intl,
  S:{lang:'en', age:8, name:'TestChild', day:0, game:'cricket',
     skillHistory:{}, gameBest:{}, doneLessons:[]}};
vm.createContext(ctx);
const LOAD_LIST = ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
                'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
                'src/content/comprehension.js','src/content/geometry.js','src/content/clock.js','src/content/calendar.js','src/content/themes.js','src/core/diagnose.js','src/games/game-core.js'];
for(const f of LOAD_LIST)
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
// game-core.js calls log(0, ...) inside gameStart()/gameEnd() — a no-op
// stand-in, same reasoning as every other test file's stubs: nothing here
// touches the DOM (core/log.js's real version does).
ctx.log = () => {};

vm.runInContext(`globalThis.__={gameBuildPool,gamePool,gameItems,gameSets,gameStart,gameCurrent,
  gameAnswer,gameEnd,gameSummary,GAME_SHELLS,gameList,band,bandForAge,AGE_BANDS,S};`, ctx);
const X = ctx.__;

let failures=0;
const checks=[];
function check(name, pass, detail){
  checks.push({name, pass, detail});
  if(!pass) failures++;
}

const loadCheck = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html actually loads before core/diagnose.js",
  loadCheck.pass,
  `index.html loads ${JSON.stringify(loadCheck.realContentBefore)} before diagnose.js; LOAD_LIST is missing ${JSON.stringify(loadCheck.missing)}`);

/* ==================================================================
   1. THE POOL — built once from the real, validated lesson bank
   ================================================================== */
console.log('=== pool ===');
const pool = X.gamePool();
console.log('pool items:', pool.length);
console.log('same array on a second call (cached)?', X.gamePool() === pool);
check('gamePool() builds ~517 items from the real lesson bank (every ask-beat with 2+ options)',
  pool.length >= 500 && pool.length <= 540, `got ${pool.length}`);
check('gamePool() caches on S._gamePool — a second call returns the identical array, not a rebuild',
  X.gamePool() === pool, 'second call produced a different array');

let poolBad = 0;
for(const it of pool){
  if(!it.id) poolBad++;
  if(!it.band) poolBad++;
  if(!it.prompt || !it.prompt.en || !it.prompt.hi) poolBad++;
  if(!it.right || !it.right.en || !it.right.hi) poolBad++;
  if(!Array.isArray(it.wrong) || !it.wrong.length) poolBad++;
  if(!Array.isArray(it.skills)) poolBad++;
}
console.log('pool items with a structural problem:', poolBad);
check('every pool item has a bilingual prompt/right answer, a band, at least one wrong option, and a skills array',
  poolBad===0, `${poolBad} problem(s)`);

/* ==================================================================
   2. ODD-ONE-OUT SETS — 30 of them, each checked for internal soundness
   ================================================================== */
console.log('\n=== gameSets(30) ===');
const sets = X.gameSets(30);
console.log('sets returned:', sets.length);
let setBad = 0;
const setProblems = [];
for(const s of sets){
  const tag = `[${s.id}]`;
  if(!Array.isArray(s.options) || s.options.length !== 4){
    setBad++; setProblems.push(`${tag} expected 4 options, got ${s.options && s.options.length}`);
  }
  const oddCount = (s.options||[]).filter(o=>o.odd).length;
  if(oddCount !== 1){
    setBad++; setProblems.push(`${tag} expected exactly 1 odd option, found ${oddCount}`);
  }
  if(!(Number.isInteger(s.correct) && s.options && s.options[s.correct] && s.options[s.correct].odd)){
    setBad++; setProblems.push(`${tag} correct=${s.correct} does not point at the odd option`);
  }
  const texts = (s.options||[]).map(o=>o.text);
  if(new Set(texts).size !== texts.length){
    setBad++; setProblems.push(`${tag} duplicate option text: ${JSON.stringify(texts)}`);
  }
  if(!s.prompt || !s.prompt.en || !s.prompt.hi){
    setBad++; setProblems.push(`${tag} prompt not bilingual`);
  }
  if(!s.why || !s.why.en || !s.why.hi){
    setBad++; setProblems.push(`${tag} why (shown after the shot) not bilingual`);
  }
  if(!X.AGE_BANDS[s.band]){
    setBad++; setProblems.push(`${tag} band "${s.band}" is not a real AGE_BANDS key`);
  }
  if(!Array.isArray(s.skills)){
    setBad++; setProblems.push(`${tag} skills is not an array`);
  }
}
console.log('structural problems:', setBad);
setProblems.slice(0,10).forEach(p=>console.log('   ', p));
check('gameSets(30) returns 30 sets', sets.length===30, `got ${sets.length}`);
check('0 structural problems across the 30 odd-one-out sets (4 options, exactly one odd, correct index points at it, no duplicate option text, bilingual prompt and why, real band)',
  setBad===0, `${setBad} problem(s): ${setProblems.slice(0,3).join(' | ')}`);

/* ==================================================================
   3. AGE BAND FLOOR — a child never meets anything more than one band
   below their own, at any age
   ================================================================== */
console.log('\n=== band floor across ages ===');
const order = ['pre','early','developing','fluent'];
let bandBad = 0;
const bandProblems = [];
for(const age of [3,5,7,9]){
  ctx.S.age = age;
  ctx.S._gameRound = 0;
  const cap = order.indexOf(X.band().id);
  const floor = Math.max(0, cap - 1);
  const items = X.gameItems(60);
  const seenBands = new Set(items.map(it=>it.band));
  for(const it of items){
    const b = order.indexOf(it.band);
    if(b > cap || b < floor){
      bandBad++;
      bandProblems.push(`age ${age} (band ${X.band().id}, cap ${cap}): item band "${it.band}" (${b}) outside [${floor},${cap}]`);
    }
  }
  console.log(`age ${age} · band ${X.band().id} · ${items.length} items · bands seen: ${[...seenBands].join(',')}`);
}
ctx.S.age = 8;
console.log('out-of-window items:', bandBad);
bandProblems.slice(0,5).forEach(p=>console.log('   ', p));
check("age bands never run more than one below the child's own, across ages 3/5/7/9 (60 items each)",
  bandBad===0, `${bandBad} problem(s): ${bandProblems.slice(0,3).join(' | ')}`);

/* ==================================================================
   4. WEIGHTING — a weak skill should be drawn ~2.4x more than a neutral
   (untagged) item. This is the game's own weightOf() formula: an item
   with one skill at <60% accuracy over 4+ attempts gets weight 1+1.4=2.4;
   an item with NO skill tag never enters the loop and stays at the base
   weight of 1 — so 2.4x is exactly what the formula promises, not a
   guess, and this measures it empirically against the real sampler
   rather than re-deriving the formula by hand.
   ================================================================== */
console.log('\n=== weighting: weak vs. neutral ===');
const savedPool = ctx.S._gamePool, savedHistory = ctx.S.skillHistory, savedRound = ctx.S._gameRound;
ctx.S.age = 8;   // 'developing' band
const bandId = X.band().id;
ctx.S._gamePool = [
  { id:'synthetic-weak',    band:bandId, strand:'num', concept:'x', skills:['synthetic-weak-skill'],
    prompt:{en:'?',hi:'?'}, right:{en:'1',hi:'1'}, wrong:[{en:'2',hi:'2'}], terse:true },
  { id:'synthetic-neutral', band:bandId, strand:'num', concept:'y', skills:[],
    prompt:{en:'?',hi:'?'}, right:{en:'1',hi:'1'}, wrong:[{en:'2',hi:'2'}], terse:true }
];
ctx.S.skillHistory = { 'synthetic-weak-skill': { n:10, right:2 } };   // 20% accuracy, well under the 60% "weak" line
ctx.S._gameRound = 0;

const N = 4000;
const draws = X.gameItems(N);
const counts = { 'synthetic-weak':0, 'synthetic-neutral':0 };
for(const d of draws) counts[d.id] = (counts[d.id]||0) + 1;
const ratio = counts['synthetic-neutral'] ? counts['synthetic-weak'] / counts['synthetic-neutral'] : Infinity;
console.log(`${N} draws over a 2-item pool → weak:${counts['synthetic-weak']} neutral:${counts['synthetic-neutral']} → ratio ${ratio.toFixed(3)}`);
check('a weak-tagged skill (20% accuracy) is drawn ~2.4x more often than a neutral, untagged item, over 4000 weighted draws',
  Math.abs(ratio - 2.4) < 0.25, `expected ≈2.4, got ${ratio.toFixed(3)}`);

ctx.S._gamePool = savedPool; ctx.S.skillHistory = savedHistory; ctx.S._gameRound = savedRound;
ctx.S.age = 8;

/* ==================================================================
   5. STATE WIRING — gameBest persists per shell; a full headless round
   through gameStart()/gameAnswer()/gameEnd() actually sets it and feeds
   noteSkillAttempt(), exactly like the brief describes.
   ================================================================== */
console.log('\n=== one full headless round ===');
ctx.S.skillHistory = {};
ctx.S.gameBest = {};
const g = X.gameStart('runner', 6);
console.log(`gameStart('runner', 6) → ${g.items.length} items, best coming in: ${g.best}`);
let answered = 0;
while(!ctx.S.game_.over && answered < 20){
  const it = X.gameCurrent();
  if(!it) break;
  X.gameAnswer(true);   // answer every one right
  answered++;
}
console.log('round over:', ctx.S.game_.over, '· right:', ctx.S.game_.right, '/', ctx.S.game_.items.length);
check('a full round runs through gameStart()/gameAnswer()/gameEnd() and ends on its own',
  ctx.S.game_.over === true && ctx.S.game_.right === g.items.length,
  JSON.stringify({over:ctx.S.game_.over, right:ctx.S.game_.right, items:g.items.length}));
check("gameEnd() records the child's own best for this shell into S.gameBest (the field newProfile() now persists per profile)",
  ctx.S.gameBest.runner === g.items.length, `S.gameBest.runner=${ctx.S.gameBest.runner}, expected ${g.items.length}`);

const taggedSkills = new Set();
for(const it of g.items) for(const sid of it.skills) taggedSkills.add(sid);
const evidenced = [...taggedSkills].filter(sid => ctx.S.skillHistory[sid] && ctx.S.skillHistory[sid].n > 0);
console.log('skills tagged in this round:', taggedSkills.size, '· skills with new evidence:', evidenced.length);
check('every answer feeds noteSkillAttempt() — every skill tagged on a played item now has evidence in S.skillHistory',
  taggedSkills.size === 0 || evidenced.length === taggedSkills.size,
  `${evidenced.length}/${taggedSkills.size} tagged skills got evidence`);

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);

process.exitCode = failures ? 1 : 0;
