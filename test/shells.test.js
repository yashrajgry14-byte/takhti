/* ==================================================================
   THE FIVE REMAINING SHELLS — pop, tower, match, sort, archer

   Same discipline as test/runner.test.js: each shell's PURE round
   logic (the one function per file that touches gameAnswer()/gameEnd())
   is driven directly, with no DOM at all — every $()/document lookup
   in these files is already null-guarded for exactly this. A fresh vm
   context per shell keeps them isolated; a thin spy wrapped around the
   real gameAnswer() (installed AFTER game-core.js loads, BEFORE the
   shell file that calls it) counts real invocations without
   reimplementing anything gameAnswer() itself does.
   ================================================================== */
const fs=require('fs'), vm=require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

let failures=0;
const checks=[];
function check(name, pass, detail){
  checks.push({name, pass, detail});
  if(!pass) failures++;
}

const COMMON_FILES = ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/content/themes.js','src/core/diagnose.js','src/games/game-core.js'];

const loadCheck = verifyLoadListHasAllContent(COMMON_FILES, 'src/core/diagnose.js');
check("this file's own COMMON_FILES includes every content/*.js file index.html actually loads before core/diagnose.js",
  loadCheck.pass,
  `index.html loads ${JSON.stringify(loadCheck.realContentBefore)} before diagnose.js; COMMON_FILES is missing ${JSON.stringify(loadCheck.missing)}`);

/* Builds a fresh, isolated context: the common content/diagnostic
   pipeline, a gameAnswer() call counter spliced in right after it, then
   the one shell file under test. Returns the exposed globals plus a
   `calls()` accessor for the spy. */
function setupShell(shellFile, exposedNames){
  const ctx = { console, Intl, setTimeout, clearTimeout,
    S: { lang:'en', age:8, name:'TestChild', day:0, game:'cricket',
         skillHistory:{}, gameBest:{}, doneLessons:[] } };
  vm.createContext(ctx);
  ctx.log = () => {};
  for(const f of COMMON_FILES) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
  // spy: count real gameAnswer() invocations without changing its behaviour
  vm.runInContext(`var __gaCalls = 0; var __gaOrig = gameAnswer;
    gameAnswer = function(ok){ __gaCalls++; return __gaOrig(ok); };`, ctx);
  vm.runInContext(fs.readFileSync(shellFile,'utf8'), ctx, {filename: shellFile});
  vm.runInContext(`globalThis.__={${exposedNames.join(',')},S,gameCurrent};`, ctx);
  const X = ctx.__;
  X.calls = () => vm.runInContext('__gaCalls', ctx);
  X.resetCalls = () => vm.runInContext('__gaCalls = 0;', ctx);
  // module-local `let` state (MTC/TW/...) is reassigned by each shell's
  // own beginFn — a one-time export above would only ever see its value
  // at export time, so re-query the context's live global scope instead.
  X.peek = name => vm.runInContext(name, ctx);
  return X;
}
const bothNonEmpty = o => !!(o && String(o.en||'').trim() && String(o.hi||'').trim());

/* ==================================================================
   1. POP — "Pop the Right One"
   ================================================================== */
console.log('=== POP ===');
{
  const X = setupShell('src/games/pop.js', ['popBegin','popRecordAnswer','popWrongTap']);
  let g = X.popBegin();
  console.log(`round: ${g.items.length} items, lives=${g.lives}`);

  X.popRecordAnswer(false); X.popRecordAnswer(false);
  check('pop: two missed waves — round still live', g.over === false, `over=${g.over}, lives=${g.lives}`);
  X.popRecordAnswer(false);
  check('pop: a third missed wave ends the round', g.over === true, `over=${g.over}, lives=${g.lives}`);
  check('pop: gameAnswer() called exactly once per wave (3 waves → 3 calls)', X.calls() === 3, `calls=${X.calls()}`);

  // wrong-bubble taps mid-wave must NOT call gameAnswer unless they empty the last life
  X.resetCalls();
  g = X.popBegin();
  X.popWrongTap(); X.popWrongTap();
  check('pop: two wrong-bubble taps cost lives but call gameAnswer zero times', X.calls() === 0 && g.lives === 1, `calls=${X.calls()}, lives=${g.lives}`);
  X.popWrongTap();
  check('pop: the THIRD wrong-bubble tap (0 lives) closes the in-progress wave with exactly one gameAnswer call', X.calls() === 1 && g.over === true, `calls=${X.calls()}, over=${g.over}`);

  // gameBest — genuine improvement only
  X.S.gameBest = {};
  g = X.popBegin();
  for(let i=0;i<4;i++) X.popRecordAnswer(true);
  while(!g.over) X.popRecordAnswer(false);
  const firstBest = X.S.gameBest.pop;
  check('pop: gameBest.pop set after first completed round', firstBest === g.right, `gameBest.pop=${firstBest}, right=${g.right}`);
  g = X.popBegin();
  X.popRecordAnswer(false); X.popRecordAnswer(false); X.popRecordAnswer(false);
  check('pop: a worse round does not overwrite gameBest.pop', X.S.gameBest.pop === firstBest && !g.newBest, `gameBest.pop=${X.S.gameBest.pop}, newBest=${g.newBest}`);
  g = X.popBegin();
  for(let i=0;i<firstBest+1 && !g.over;i++) X.popRecordAnswer(true);
  while(!g.over) X.popRecordAnswer(false);
  check('pop: a genuinely better round updates gameBest.pop', X.S.gameBest.pop === g.right && g.right > firstBest && g.newBest === true, `gameBest.pop=${X.S.gameBest.pop}, right=${g.right}, firstBest=${firstBest}`);

  // skillHistory coverage over a full natural round
  X.S.skillHistory = {};
  g = X.popBegin();
  const tagged = new Set();
  let guard = 0;
  while(!g.over && guard++ < 200){
    const it = X.gameCurrent();
    if(it) for(const sid of it.skills) tagged.add(sid);
    X.popRecordAnswer(guard % 4 !== 0);
  }
  const evidenced = [...tagged].filter(sid => X.S.skillHistory[sid] && X.S.skillHistory[sid].n > 0);
  check('pop: every tagged skill gains skillHistory evidence', tagged.size === 0 || evidenced.length === tagged.size, `${evidenced.length}/${tagged.size}`);
}

/* ==================================================================
   2. TOWER — "Build the Tower"
   ================================================================== */
console.log('\n=== TOWER ===');
{
  const X = setupShell('src/games/tower.js', ['towerBegin','towerRecordAnswer','TW']);
  let g = X.towerBegin();
  console.log(`round: ${g.items.length} items`);

  // a tower that was never built cannot "collapse" — the round should
  // run to item exhaustion, not end on the very first wrong guess
  for(let i=0;i<g.items.length;i++) X.towerRecordAnswer(false);
  check('tower: an all-wrong round (never built) ends via item exhaustion, not a false "collapse"', g.over === true && g.i === g.items.length, `over=${g.over}, i=${g.i}, items=${g.items.length}`);
  check('tower: gameAnswer() called exactly once per item', X.calls() === g.items.length, `calls=${X.calls()}, items=${g.items.length}`);

  // a genuine build-then-collapse ends the round early
  X.resetCalls();
  g = X.towerBegin();
  X.towerRecordAnswer(true); X.towerRecordAnswer(true); X.towerRecordAnswer(true);
  check('tower: three correct answers build real height', g.over === false, `height so far, over=${g.over}`);
  X.towerRecordAnswer(false); X.towerRecordAnswer(false);
  check('tower: still short of a full collapse', g.over === false);
  X.towerRecordAnswer(false);
  check('tower: the tower collapsing from a built state ends the round before the item count', g.over === true && g.i < g.items.length, `over=${g.over}, i=${g.i}, items=${g.items.length}`);

  // the tower must be visibly taller at the end than at the start — read
  // TW.height directly (towerRecordAnswer() alone never clears TW; only
  // the UI-facing towerPick()/towerFinish() do, which this test doesn't call)
  X.resetCalls();
  g = X.towerBegin();
  for(let i=0;i<g.items.length;i++) X.towerRecordAnswer(i % 5 !== 0);   // mostly correct, never collapses
  const finalHeight = X.peek('TW').height;
  console.log(`tower: started at height 0, ended at height ${finalHeight} (${g.right}/${g.items.length} correct)`);
  check('tower: a mostly-correct round ends visibly taller than it started',
    finalHeight > 0 && g.over === true, `finalHeight=${finalHeight}, over=${g.over}`);

  // gameBest — genuine improvement only (higher g.right is the real "taller" metric here)
  X.S.gameBest = {};
  g = X.towerBegin();
  for(let i=0;i<g.items.length;i++) X.towerRecordAnswer(i < 5);
  const firstBest = X.S.gameBest.tower;
  check('tower: gameBest.tower set after first completed round', firstBest === g.right, `gameBest.tower=${firstBest}, right=${g.right}`);
  g = X.towerBegin();
  for(let i=0;i<g.items.length;i++) X.towerRecordAnswer(false);
  check('tower: a worse (0-right) round does not overwrite gameBest.tower', X.S.gameBest.tower === firstBest, `gameBest.tower=${X.S.gameBest.tower}`);
  g = X.towerBegin();
  for(let i=0;i<g.items.length;i++) X.towerRecordAnswer(true);
  check('tower: a flawless round updates gameBest.tower and flags newBest', X.S.gameBest.tower === g.items.length && g.newBest === true, `gameBest.tower=${X.S.gameBest.tower}, newBest=${g.newBest}`);

  // skillHistory coverage
  X.S.skillHistory = {};
  g = X.towerBegin();
  const tagged = new Set();
  for(let i=0;i<g.items.length;i++){
    const it = X.gameCurrent();
    if(it) for(const sid of it.skills) tagged.add(sid);
    X.towerRecordAnswer(i % 3 !== 0);
  }
  const evidenced = [...tagged].filter(sid => X.S.skillHistory[sid] && X.S.skillHistory[sid].n > 0);
  check('tower: every tagged skill gains skillHistory evidence', tagged.size === 0 || evidenced.length === tagged.size, `${evidenced.length}/${tagged.size}`);
}

/* ==================================================================
   3. MATCH — "Find the Pairs"
   ================================================================== */
console.log('\n=== MATCH ===');
{
  const X = setupShell('src/games/match.js', ['matchBegin','matchRecordAttempt','matchFlip']);
  // Solves the board by directly asking the module's own current MTC for
  // its board layout — X.peek('MTC') returns the LIVE object matchFlip()
  // itself mutates, not a snapshot, so this stays correct move to move.
  const solvePair = idx => {
    const mtc = X.peek('MTC');
    const positions = mtc.board.map((c,i)=>({c,i})).filter(x=>x.c.itemIndex===idx && !x.c.matched).map(x=>x.i);
    X.matchFlip(positions[0]); X.matchFlip(positions[1]);
  };
  const mismatchOnce = () => {
    const mtc = X.peek('MTC');
    const p1 = mtc.board.findIndex(c => !c.matched);
    const p2 = mtc.board.findIndex((c,i) => i !== p1 && !c.matched && c.itemIndex !== mtc.board[p1].itemIndex);
    X.matchFlip(p1); X.matchFlip(p2);
    mtc.busy = false; mtc.flipped = [];   // simulate the flip-back timeout completing instantly
  };

  let g = X.matchBegin();
  console.log(`round: ${g.items.length} pairs`);

  solvePair(0); mismatchOnce(); solvePair(1);
  check('match: two found pairs (one mismatch in between) — round still live', g.over === false, `i=${g.i}, over=${g.over}`);
  solvePair(2); solvePair(3); solvePair(4); solvePair(5);
  check('match: the sixth found pair ends the round via gameAnswer\'s own real check', g.over === true && g.i === 6, `i=${g.i}, over=${g.over}`);
  // 6 matches + 1 mismatch = 7 attempted pairs = 7 real gameAnswer() calls
  // — "once per item" here means once per ATTEMPTED PAIR, not per card.
  check('match: gameAnswer() called exactly once per attempted pair (7 attempts → 7 calls)', X.calls() === 7, `calls=${X.calls()}`);

  // THE explicit requirement: a single mismatch calls gameAnswer(false)
  // exactly once, driven through the real matchFlip() (the card-tap
  // path), not matchRecordAttempt() directly.
  X.resetCalls();
  g = X.matchBegin();
  mismatchOnce();
  check('match: a mismatch (two different-item cards) calls gameAnswer(false) exactly once, not once per card',
    X.calls() === 1 && g.wrong === 1 && g.right === 0, `calls=${X.calls()}, right=${g.right}, wrong=${g.wrong}`);

  // gameBest — match's REAL metric is fewest moves (lower is better), a
  // separate key from gameEnd()'s own right-based S.gameBest.match (see
  // match.js's own header comment on why those are not the same number).
  X.S.gameBest = {};
  g = X.matchBegin();
  for(let idx=0; idx<6; idx++) solvePair(idx);   // zero mismatches — the fewest possible moves (6)
  const firstBest = X.S.gameBest.matchMoves;
  check('match: gameBest.matchMoves set to 6 after a flawless (zero-mismatch) round', firstBest === 6 && g.over === true, `gameBest.matchMoves=${firstBest}, over=${g.over}`);

  g = X.matchBegin();
  mismatchOnce();                                 // one wasted move first — this round takes 7 moves, not 6
  for(let idx=0; idx<6; idx++) solvePair(idx);
  check('match: a worse (more-moves) round does not overwrite gameBest.matchMoves',
    X.S.gameBest.matchMoves === firstBest && !g.newMovesBest, `gameBest.matchMoves=${X.S.gameBest.matchMoves}, moves=${g.moves}, newMovesBest=${g.newMovesBest}`);

  // skillHistory coverage — every one of the 6 items' skills should end
  // up evidenced, since g.i walks 0→6 across the 6 successful matches
  // regardless of mismatches or the order pairs were actually found in.
  X.S.skillHistory = {};
  g = X.matchBegin();
  const tagged = new Set();
  g.items.forEach(it => { for(const sid of it.skills) tagged.add(sid); });
  for(let idx=0; idx<6; idx++) solvePair(idx);
  const evidenced = [...tagged].filter(sid => X.S.skillHistory[sid] && X.S.skillHistory[sid].n > 0);
  check('match: every tagged skill (across all 6 pairs) gains skillHistory evidence', tagged.size === 0 || evidenced.length === tagged.size, `${evidenced.length}/${tagged.size}`);
}

/* ==================================================================
   4. SORT — "Sort it Fast"
   ================================================================== */
console.log('\n=== SORT ===');
{
  const X = setupShell('src/games/sort.js', ['sortBegin','sortRecordAnswer']);
  let g = X.sortBegin();
  console.log(`round: ${g.items.length} falling items, lives=${g.lives}`);

  X.sortRecordAnswer(false); X.sortRecordAnswer(false);
  check('sort: two misses — round still live', g.over === false, `over=${g.over}, lives=${g.lives}`);
  X.sortRecordAnswer(false);
  check('sort: a third miss ends the round', g.over === true, `over=${g.over}, lives=${g.lives}`);
  check('sort: gameAnswer() called exactly once per falling item (3 → 3)', X.calls() === 3, `calls=${X.calls()}`);

  // gameBest
  X.S.gameBest = {};
  g = X.sortBegin();
  for(let i=0;i<6;i++) X.sortRecordAnswer(true);
  while(!g.over) X.sortRecordAnswer(false);
  const firstBest = X.S.gameBest.sort;
  check('sort: gameBest.sort set after first completed round', firstBest === g.right, `gameBest.sort=${firstBest}, right=${g.right}`);
  g = X.sortBegin();
  X.sortRecordAnswer(false); X.sortRecordAnswer(false); X.sortRecordAnswer(false);
  check('sort: a worse round does not overwrite gameBest.sort', X.S.gameBest.sort === firstBest && !g.newBest);
  g = X.sortBegin();
  for(let i=0;i<firstBest+1 && !g.over;i++) X.sortRecordAnswer(true);
  while(!g.over) X.sortRecordAnswer(false);
  check('sort: a genuinely better round updates gameBest.sort', X.S.gameBest.sort === g.right && g.right > firstBest && g.newBest === true);

  // skillHistory
  X.S.skillHistory = {};
  g = X.sortBegin();
  const tagged = new Set();
  let guard = 0;
  while(!g.over && guard++ < 200){
    const it = X.gameCurrent();
    if(it) for(const sid of it.skills) tagged.add(sid);
    X.sortRecordAnswer(guard % 4 !== 0);
  }
  const evidenced = [...tagged].filter(sid => X.S.skillHistory[sid] && X.S.skillHistory[sid].n > 0);
  check('sort: every tagged skill gains skillHistory evidence', tagged.size === 0 || evidenced.length === tagged.size, `${evidenced.length}/${tagged.size}`);

  // bin labels and why, both languages, every falling item of a fresh round
  g = X.sortBegin();
  let labelBad = 0;
  for(const it of g.items){
    if(!bothNonEmpty(it.leftLabel)) labelBad++;
    if(!bothNonEmpty(it.rightLabel)) labelBad++;
    if(!bothNonEmpty(it.why)) labelBad++;
  }
  console.log(`sort: ${g.items.length} items checked for bin labels + why, ${labelBad} problem(s)`);
  check('sort: every falling item has non-empty bin labels and why text in both languages', labelBad === 0, `${labelBad} problem(s)`);
}

/* ==================================================================
   5. ARCHER — "Find the Odd One"
   ================================================================== */
console.log('\n=== ARCHER ===');
{
  const X = setupShell('src/games/archer.js', ['archerBegin','archerRecordAnswer']);
  let g = X.archerBegin();
  console.log(`round: ${g.items.length} shots, lives=${g.lives}`);

  X.archerRecordAnswer(false); X.archerRecordAnswer(false);
  check('archer: two missed shots — round still live', g.over === false, `over=${g.over}, lives=${g.lives}`);
  X.archerRecordAnswer(false);
  check('archer: a third missed shot ends the round', g.over === true, `over=${g.over}, lives=${g.lives}`);
  check('archer: gameAnswer() called exactly once per shot (3 → 3)', X.calls() === 3, `calls=${X.calls()}`);

  // gameBest
  X.S.gameBest = {};
  g = X.archerBegin();
  for(let i=0;i<6;i++) X.archerRecordAnswer(true);
  while(!g.over) X.archerRecordAnswer(false);
  const firstBest = X.S.gameBest.archer;
  check('archer: gameBest.archer set after first completed round', firstBest === g.right, `gameBest.archer=${firstBest}, right=${g.right}`);
  g = X.archerBegin();
  X.archerRecordAnswer(false); X.archerRecordAnswer(false); X.archerRecordAnswer(false);
  check('archer: a worse round does not overwrite gameBest.archer', X.S.gameBest.archer === firstBest && !g.newBest);
  g = X.archerBegin();
  for(let i=0;i<firstBest+1 && !g.over;i++) X.archerRecordAnswer(true);
  while(!g.over) X.archerRecordAnswer(false);
  check('archer: a genuinely better round updates gameBest.archer', X.S.gameBest.archer === g.right && g.right > firstBest && g.newBest === true);

  // skillHistory
  X.S.skillHistory = {};
  g = X.archerBegin();
  const tagged = new Set();
  let guard = 0;
  while(!g.over && guard++ < 200){
    const it = X.gameCurrent();
    if(it) for(const sid of it.skills) tagged.add(sid);
    X.archerRecordAnswer(guard % 4 !== 0);
  }
  const evidenced = [...tagged].filter(sid => X.S.skillHistory[sid] && X.S.skillHistory[sid].n > 0);
  check('archer: every tagged skill gains skillHistory evidence', tagged.size === 0 || evidenced.length === tagged.size, `${evidenced.length}/${tagged.size}`);

  // why text, both languages, every set of a fresh round (targets carry
  // the odd/not-odd text itself; the shell's own teaching moment is why)
  g = X.archerBegin();
  let whyBad = 0;
  for(const set of g.items){
    if(!bothNonEmpty(set.why)) whyBad++;
  }
  console.log(`archer: ${g.items.length} sets checked for why, ${whyBad} problem(s)`);
  check('archer: every set has non-empty why text in both languages', whyBad === 0, `${whyBad} problem(s)`);
}

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);

process.exitCode = failures ? 1 : 0;
