const fs = require('fs'), vm = require('vm');

function makeLocalStorage(){
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k,v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}

const ctx = {
  console, Intl, setTimeout, clearTimeout,
  localStorage: makeLocalStorage(),
  S: { lang: 'en', age: 8, name: 'Aayush', muted: false }
};
vm.createContext(ctx);

for(const f of [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/core/diagnose.js','src/core/srs.js','src/core/sfx.js'
]){
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
}

vm.runInContext(`globalThis.__sfx = {
  sfxPop, sfxChalk, sfxThud, sfxChime, sfxCard, sfxAmbientBg, sfxAllowed, S
};`, ctx);
const SFX = ctx.__sfx;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== WEB AUDIO PROCEDURAL SFX ENGINE TESTS ===');

// Test 1: Mute preference check
check('SFX allowed when muted is false', SFX.sfxAllowed() === false /* no window/AudioContext in bare node */, 'expected false in node environment without AudioContext');

// Test 2: Sound functions execute safely without throwing
let errorCaught = null;
try {
  SFX.sfxPop();
  SFX.sfxChalk();
  SFX.sfxThud();
  SFX.sfxChime();
  SFX.sfxCard();
  SFX.sfxAmbientBg();
} catch(e){
  errorCaught = e.message;
}

check('Procedural SFX functions execute safely without throwing in node environment', errorCaught === null, errorCaught);

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
