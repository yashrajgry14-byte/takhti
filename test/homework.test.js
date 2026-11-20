const fs = require('fs'), vm = require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

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

// Same load-list fix as test/diagnose.test.js: content/comprehension.js
// ships in the real index.html between literacy.js and diagnose.js, so it
// belongs here too. This file's own assertions happen not to touch any of
// the 7 skills comprehension.js teaches (bodmas/tables are pure maths), so
// its omission was never actually wrong here — but a load list that
// silently drifts from the real app is the exact failure mode being fixed
// project-wide, not something worth re-introducing by leaving this one file
// on the old, shorter list. See the self-check below.
const LOAD_LIST = [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/content/geometry.js','src/content/clock.js','src/content/calendar.js','src/content/upper.js',
  'src/core/diagnose.js', 'src/core/mathgen.js'
];
for(const f of LOAD_LIST){
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
}

vm.runInContext(`globalThis.__h = {
  assignHomework, getAssignedHomework, clearHomework, personalizeContentForHomework, diagnose, noteSkillAttempt, S
};`, ctx);
const H = ctx.__h;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== TEACHER HOMEWORK PERSONALIZATION TESTS ===');

// SELF-CHECK — see test/_helpers/load-order.js and test/diagnose.test.js
// for the full story: a content file that ships in the real app but is
// missing from this list is exactly the drift that let a whole suite pass
// while quietly testing a graph the app no longer ships.
const loadCheck = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html actually loads before core/diagnose.js",
  loadCheck.pass,
  `index.html loads ${JSON.stringify(loadCheck.realContentBefore)} before diagnose.js; LOAD_LIST is missing ${JSON.stringify(loadCheck.missing)}`);

// Test 1: Assign Homework
const assigned = H.assignHomework('CLASS6', ['bodmas', 'tables'], 'Practice BODMAS and tables');
check('Homework assigned successfully to CLASS6', assigned === true, `got ${assigned}`);

// Test 2: Retrieve Assigned Homework
const fetched = H.getAssignedHomework(H.S);
check('Assigned homework retrieved for child linked to CLASS6', fetched && fetched.skills.includes('bodmas'), JSON.stringify(fetched));

// Test 3: Personalize Content for Homework
const personalized = H.personalizeContentForHomework(H.S);
check('Personalized remediation plan generated', personalized && personalized.lessons && personalized.lessons.length > 0, JSON.stringify(personalized));
check('the plan carries the assignment timestamp, so a finished homework can be told apart from a new one',
  personalized && personalized.assignedAt === fetched.assignedAt, JSON.stringify({ at: personalized && personalized.assignedAt }));

// Test 4: the story drills the child's REAL gap, not just what was typed.
// This child is weak on times tables (5/12) — the skill under BODMAS — so
// the homework story must drill tables, the deepest teachable gap.
for(const ok of [1,0,0,1,0,1,0,0,1,0,0,1]) H.noteSkillAttempt('tables', !!ok, H.S);
const weak = H.personalizeContentForHomework(H.S);
check("a child weak on tables, assigned BODMAS + tables, gets a story that drills tables (the diagnosed gap), not BODMAS",
  weak && weak.storySkill === 'tables', JSON.stringify(weak && { storySkill: weak.storySkill, plan: weak.plan.map(p => p.skill.id + ':' + p.verdict) }));

// Test 5: a skill that isn't one arithmetic question gets no fake maths story
H.assignHomework('CLASS6', ['read3'], 'Read aloud');
const reading = H.personalizeContentForHomework(H.S);
check('reading homework gets the diagnosed practice lessons but no maths story (storySkill null)',
  reading && reading.storySkill === null && reading.lessons.length > 0, JSON.stringify(reading && { storySkill: reading.storySkill, lessons: reading.lessons.length }));

// Test 6: a teacher can withdraw homework
H.clearHomework('CLASS6');
check('clearHomework() removes the assignment — the child app sees no homework afterwards',
  H.getAssignedHomework(H.S) === null && H.personalizeContentForHomework(H.S) === null, JSON.stringify(H.getAssignedHomework(H.S)));

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
