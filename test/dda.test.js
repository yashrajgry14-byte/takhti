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
  S: { lang: 'en', age: 5, name: 'Rohan' }
};
vm.createContext(ctx);

for(const f of [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/core/diagnose.js'
]){
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
}

vm.runInContext(`globalThis.__dda = {
  gradeVerdict, getGradeThresholds, bandForAge, S
};`, ctx);
const DDA = ctx.__dda;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== DYNAMIC DIFFICULTY ADJUSTMENT (DDA) TESTS ===');

// Test 1: 5-year-old (early band) thresholds
DDA.S.age = 5;
let thresh = DDA.getGradeThresholds(DDA.S);
check('Early band (age 5) pass threshold is 68%', thresh.pass === 68, `got ${thresh.pass}`);

// Test 2: 68% score passes for a 5-year-old
let verdict68_early = DDA.gradeVerdict({ score: 68, confidence: 0.9, shaky: false }, DDA.S);
check('68% score passes for a 5-year-old in early band', verdict68_early === 'pass', `got ${verdict68_early}`);

// Test 3: 9-year-old (fluent band) thresholds
DDA.S.age = 9;
thresh = DDA.getGradeThresholds(DDA.S);
check('Fluent band (age 9) pass threshold is 82%', thresh.pass === 82, `got ${thresh.pass}`);

// Test 4: 68% score fails/coaches for a 9-year-old
let verdict68_fluent = DDA.gradeVerdict({ score: 68, confidence: 0.9, shaky: false }, DDA.S);
check('68% score does NOT pass for a 9-year-old in fluent band (verdict: coach)', verdict68_fluent === 'coach', `got ${verdict68_fluent}`);

// Test 5: 82% score passes for a 9-year-old
let verdict82_fluent = DDA.gradeVerdict({ score: 82, confidence: 0.9, shaky: false }, DDA.S);
check('82% score passes for a 9-year-old in fluent band', verdict82_fluent === 'pass', `got ${verdict82_fluent}`);

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
