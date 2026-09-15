/* ==================================================================
   RUNNER SHELL TESTS

   Two passes, both against the real src/games/runner.js and the real
   src/games/game-core.js it sits on — no reimplementation of either:

   1. ROUND LOGIC — runnerRecordAnswer() is the one function in
      runner.js that touches gameAnswer()/gameEnd(), and it is written
      to need no DOM at all, specifically so this is possible: three
      wrong answers end a round, two do not; S.gameBest.runner updates
      only on a genuine new best; every skill tagged on a played item
      gains real S.skillHistory evidence.

   2. LIFECYCLE — cancelAnimationFrame/removeEventListener actually run
      when a round is left mid-play, verified by spying on
      requestAnimationFrame/addEventListener rather than eyeballing a
      real browser console (a call-count is the same fact a quiet
      console would be showing).

   No shell UI beyond runner.js exists yet, and this file does not
   render anything — VIEWS.runner()/AFTER.runner() are exercised only
   through the loop/listener bookkeeping they trigger, via a minimal
   spying `document` stub whose $() always returns null (every DOM
   lookup in runner.js is already null-guarded for exactly this).
   ================================================================== */
const fs=require('fs'), vm=require('vm');

let failures=0;
const checks=[];
function check(name, pass, detail){
  checks.push({name, pass, detail});
  if(!pass) failures++;
}

/* ==================================================================
   PASS 1 — round logic, no DOM at all
   ================================================================== */
const ctx1={console, Intl,
  S:{lang:'en', age:8, name:'TestChild', day:0, game:'cricket',
     skillHistory:{}, gameBest:{}, doneLessons:[]}};
vm.createContext(ctx1);
ctx1.log = () => {};   // core/log.js needs document; game-core.js logs at round start/end
for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
                'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
                'src/content/comprehension.js','src/core/diagnose.js','src/games/game-core.js',
                'src/games/runner.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx1, {filename:f});
vm.runInContext(`globalThis.__={runnerBegin,runnerRecordAnswer,gameCurrent,S};`, ctx1);
const X = ctx1.__;

console.log('=== lives: three wrong answers end a round, two do not ===');
let g = X.runnerBegin();
console.log(`round drawn: ${g.items.length} items, starting lives=${g.lives}`);
X.runnerRecordAnswer(false);
X.runnerRecordAnswer(false);
check('after two wrong answers the round is still live', g.over === false, `g.over=${g.over}, lives=${g.lives}`);
X.runnerRecordAnswer(false);
check('after a third wrong answer the round has ended', g.over === true, `g.over=${g.over}, lives=${g.lives}`);
check('lives reads exactly 0 at the moment it ended', g.lives === 0, `lives=${g.lives}`);

console.log('\n=== S.gameBest.runner updates only on a genuine new best ===');
X.S.gameBest = {};
g = X.runnerBegin();
for(let i=0;i<5;i++) X.runnerRecordAnswer(true);
while(!g.over) X.runnerRecordAnswer(false);   // close it out via lives, the same way a real miss-streak would
const firstBest = X.S.gameBest.runner;
console.log(`round 1: right=${g.right} → gameBest.runner=${firstBest}`);
check('gameBest.runner is set after the first completed round', firstBest === g.right, `gameBest.runner=${firstBest}, right=${g.right}`);

g = X.runnerBegin();
X.runnerRecordAnswer(false); X.runnerRecordAnswer(false); X.runnerRecordAnswer(false);
console.log(`round 2 (deliberately worse): right=${g.right} → gameBest.runner=${X.S.gameBest.runner}, newBest=${g.newBest}`);
check('a worse round does not overwrite the existing best',
  X.S.gameBest.runner === firstBest && !g.newBest,
  `gameBest.runner=${X.S.gameBest.runner} (expected ${firstBest}), newBest=${g.newBest}`);

g = X.runnerBegin();
for(let i=0;i<firstBest+1 && !g.over;i++) X.runnerRecordAnswer(true);
while(!g.over) X.runnerRecordAnswer(false);
console.log(`round 3 (beats round 1): right=${g.right} → gameBest.runner=${X.S.gameBest.runner}, newBest=${g.newBest}`);
check('a genuinely better round updates gameBest.runner and flags newBest',
  X.S.gameBest.runner === g.right && g.right > firstBest && g.newBest === true,
  `gameBest.runner=${X.S.gameBest.runner}, right=${g.right}, firstBest=${firstBest}, newBest=${g.newBest}`);

console.log('\n=== every skill tagged on a played item gains real skillHistory evidence ===');
X.S.skillHistory = {};
g = X.runnerBegin();
const tagged = new Set();
let guard = 0;
while(!g.over && guard++ < 200){
  const it = X.gameCurrent();
  if(it) for(const sid of it.skills) tagged.add(sid);
  X.runnerRecordAnswer(guard % 3 !== 0);   // a mix of right/wrong exercises both noteSkillAttempt paths
}
const evidenced = [...tagged].filter(sid => X.S.skillHistory[sid] && X.S.skillHistory[sid].n > 0);
console.log(`skills tagged: ${tagged.size}, with evidence: ${evidenced.length}`);
check('every tagged skill has a skillHistory entry with n > 0',
  tagged.size === 0 || evidenced.length === tagged.size, `${evidenced.length}/${tagged.size}`);

/* ==================================================================
   PASS 2 — lifecycle: cancelAnimationFrame/removeEventListener actually
   fire on a mid-round quit, and nothing reacts after they do.
   ================================================================== */
console.log('\n=== lifecycle: leaving mid-round actually stops the loop ===');
const calls = { raf:0, caf:0, add:0, remove:0 };
let rafId = 0;
const ctx2={console, Intl,
  S:{lang:'en', age:8, name:'TestChild', day:0, game:'cricket',
     skillHistory:{}, gameBest:{}, doneLessons:[]}};
vm.createContext(ctx2);
ctx2.log = () => {};
ctx2.requestAnimationFrame = fn => { calls.raf++; return ++rafId; };
ctx2.cancelAnimationFrame = () => { calls.caf++; };
ctx2.document = {
  addEventListener: (type, fn) => { if(type==='keydown'){ calls.add++; ctx2.document._handler = fn; } },
  removeEventListener: (type, fn) => { if(type==='keydown'){
    calls.remove++;
    if(fn !== ctx2.document._handler) throw new Error('removed a different handler than the one added — a leak, not a real removal');
  } },
  getElementById: () => null   // no real DOM — every $() lookup in runner.js is already null-guarded
};
ctx2.$ = id => ctx2.document.getElementById(id);
ctx2.navigator = { vibrate: () => {} };
for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
                'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
                'src/content/comprehension.js','src/core/diagnose.js','src/games/game-core.js',
                'src/games/runner.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx2, {filename:f});
vm.runInContext(`globalThis.__2={runnerBegin,runnerAttachLive,runnerStop,runnerSteer};`, ctx2);
const Y = ctx2.__2;

Y.runnerBegin();
Y.runnerAttachLive();   // mirrors playGame() then AFTER.runner() firing once the stage is on screen
console.log(`entering: requestAnimationFrame ×${calls.raf}, keydown listeners added ×${calls.add}`);
check('entering the round schedules exactly one animation frame', calls.raf === 1, `got ${calls.raf}`);
check('entering the round adds exactly one keydown listener', calls.add === 1, `got ${calls.add}`);

Y.runnerStop();   // mirrors go() firing on a mid-round quit (or any screen change)
console.log(`leaving: cancelAnimationFrame ×${calls.caf}, keydown listeners removed ×${calls.remove}`);
check('leaving mid-round cancels the pending animation frame', calls.caf === 1, `got ${calls.caf}`);
check('leaving mid-round removes the exact same keydown listener that was added', calls.remove === 1, `got ${calls.remove}`);

const before = calls.raf;
Y.runnerSteer(1);   // an input arriving after the player has left must be inert, not throw, not schedule anything
check('input arriving after the player has left is inert and schedules nothing new',
  calls.raf === before, `raf calls before=${before}, after=${calls.raf}`);

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);

process.exitCode = failures ? 1 : 0;
