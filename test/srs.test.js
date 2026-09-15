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
  S: { lang: 'en', age: 8, name: 'Aayush', srs: {} }
};
vm.createContext(ctx);

for(const f of [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/core/diagnose.js','src/core/srs.js'
]){
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
}

vm.runInContext(`globalThis.__srs = {
  recordSrsItem, getDueSrsItems, srsStats, srsIntervalMs, S
};`, ctx);
const SRS = ctx.__srs;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== SPACED REPETITION ENGINE (EBBINGHAUS) TESTS ===');

// Test 1: Record successful review -> advances step to 1 (1 day review)
SRS.recordSrsItem('read_l1_namaste', 'read', 'Namaste', true, SRS.S);
let item = SRS.S.srs['read_l1_namaste'];
check('First correct attempt sets step 1 (1d interval)', item && item.step === 1, JSON.stringify(item));

// Test 2: Second correct attempt -> advances step to 2 (3d interval)
SRS.recordSrsItem('read_l1_namaste', 'read', 'Namaste', true, SRS.S);
item = SRS.S.srs['read_l1_namaste'];
check('Second correct attempt advances to step 2 (3d interval)', item && item.step === 2, JSON.stringify(item));

// Test 3: Failed attempt -> resets step to 1
SRS.recordSrsItem('read_l1_namaste', 'read', 'Namaste', false, SRS.S);
item = SRS.S.srs['read_l1_namaste'];
check('Failed attempt resets step back to 1', item && item.step === 1, JSON.stringify(item));

// Test 4: Fast-forward time to simulate due item
item.nextReview = Date.now() - 1000; // past due
const dueItems = SRS.getDueSrsItems(SRS.S);
check('Due items identified when nextReview <= now', dueItems.length === 1 && dueItems[0].id === 'read_l1_namaste', JSON.stringify(dueItems));

// Test 5: SRS Stats calculation
const stats = SRS.srsStats(SRS.S);
check('srsStats calculates total and due counts correctly', stats.total === 1 && stats.due === 1, JSON.stringify(stats));

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
