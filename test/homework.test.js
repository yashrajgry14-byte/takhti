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
  S: { lang: 'en', age: 8, name: 'Aayush', day: 0, classCode: 'CLASS6' }
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

vm.runInContext(`globalThis.__h = {
  assignHomework, getAssignedHomework, personalizeContentForHomework, diagnose, S
};`, ctx);
const H = ctx.__h;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== TEACHER HOMEWORK PERSONALIZATION TESTS ===');

// Test 1: Assign Homework
const assigned = H.assignHomework('CLASS6', ['bodmas', 'tables'], 'Practice BODMAS and tables');
check('Homework assigned successfully to CLASS6', assigned === true, `got ${assigned}`);

// Test 2: Retrieve Assigned Homework
const fetched = H.getAssignedHomework(H.S);
check('Assigned homework retrieved for child linked to CLASS6', fetched && fetched.skills.includes('bodmas'), JSON.stringify(fetched));

// Test 3: Personalize Content for Homework
const personalized = H.personalizeContentForHomework(H.S);
check('Personalized remediation plan generated', personalized && personalized.lessons && personalized.lessons.length > 0, JSON.stringify(personalized));

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
