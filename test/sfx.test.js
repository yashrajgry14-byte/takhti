/* ==================================================================
   SOUND EFFECTS — core/sfx.js against a recording stub AudioContext.

   Loads ONLY sfx.js: it touches nothing but S.muted and Web Audio, so
   there is no content load list to drift. Proves the guarantees the
   file makes, not just that it doesn't throw:
     · muted means silent — no audio node is created at all
     · each effect really builds and starts a sound when unmuted
     · the noise buffer is made once and shared, not per call
     · chalk is throttled (it fires on every pointer move)
     · the map's ambient loop starts once, stops, and can restart
     · a partial Web Audio implementation can never throw out of a lesson
   Where each effect is wired into a real screen is checked by
   test/hygiene.test.js's reachability pass.
   ================================================================== */
const fs = require('fs'), vm = require('vm');

let made = [], started = 0, buffers = 0;
function node(kind){
  const n = { kind, connect(){}, start(){ started++; }, stop(){ this.stopped = true; },
    frequency:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){} },
    gain:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){} }, Q:{ value:0 } };
  made.push(n); return n;
}
function FullCtx(){ this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; }
FullCtx.prototype.createOscillator = () => node('osc');
FullCtx.prototype.createGain = () => node('gain');
FullCtx.prototype.createBiquadFilter = () => node('filter');
FullCtx.prototype.createBufferSource = () => node('src');
FullCtx.prototype.createBuffer = (ch, len, rate) => { buffers++; return { sampleRate: rate, getChannelData: () => new Float32Array(len) }; };
FullCtx.prototype.resume = () => Promise.resolve();

function load(AudioCtx){
  const ctx = { console, Date, Math, Promise, S: { muted: false }, window: { AudioContext: AudioCtx } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('src/core/sfx.js','utf8'), ctx, { filename:'src/core/sfx.js' });
  vm.runInContext(`globalThis.__ = { sfxPop, sfxChalk, sfxThud, sfxChime, sfxCard, sfxAmbientBg, sfxAmbientStop, S };`, ctx);
  return ctx.__;
}

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}
console.log('=== SOUND EFFECTS ===');

const X = load(FullCtx);
X.S.muted = true;
X.sfxPop(); X.sfxChime(); X.sfxCard(); X.sfxThud(); X.sfxAmbientBg();
check('muted means silent — no audio node is created at all', made.length === 0, `${made.length} nodes`);

X.S.muted = false;
for(const fn of ['sfxPop','sfxThud','sfxChime','sfxCard']){
  const before = started; X[fn]();
  check(`${fn}() builds and starts a real sound when unmuted`, started > before, `${started - before} started`);
}
X.sfxCard(); X.sfxCard();
check('the noise buffer is made once and shared, not allocated per sound', buffers === 1, `${buffers} buffers`);

const chalkBefore = started;
for(let i = 0; i < 20; i++) X.sfxChalk();
check('chalk is throttled: 20 calls in the same instant make one scrape', started - chalkBefore === 1, `${started - chalkBefore}`);

const ambBefore = started;
X.sfxAmbientBg(); X.sfxAmbientBg(); X.sfxAmbientBg();
check('the ambient loop starts once however often the map re-renders (noise + its swell)', started - ambBefore === 2, `${started - ambBefore}`);
const loop = made.filter(n => n.kind === 'src').pop();
X.sfxAmbientStop();
check('sfxAmbientStop() actually stops the loop', loop.stopped === true, 'not stopped');
const reBefore = started; X.sfxAmbientBg();
check('…and it can start again afterwards', started > reBefore, 'did not restart');
X.sfxAmbientStop();

// a partial Web Audio implementation (oscillators but no buffers, as on
// some older WebViews) must never throw out of the screen that played it
function PartialCtx(){ FullCtx.call(this); }
PartialCtx.prototype.createOscillator = FullCtx.prototype.createOscillator;
PartialCtx.prototype.createGain = FullCtx.prototype.createGain;
PartialCtx.prototype.resume = FullCtx.prototype.resume;
const P = load(PartialCtx);
let threw = null;
try{ P.sfxCard(); P.sfxChalk(); P.sfxAmbientBg(); P.sfxChime(); }catch(e){ threw = e.message; }
check('a partial Web Audio implementation never throws out of a lesson', threw === null, threw);

const N = load(undefined);
threw = null;
try{ N.sfxPop(); N.sfxChime(); N.sfxAmbientBg(); N.sfxAmbientStop(); }catch(e){ threw = e.message; }
check('no Web Audio at all is silent, not an error', threw === null, threw);

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
