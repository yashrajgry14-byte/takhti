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
  S: { lang: 'en', age: 6, name: 'Kabir', favGame: 'kabaddi' }
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

vm.runInContext(`globalThis.__hwStory = {
  genHomeworkStory, genGameSvg, personalizeContentForHomework, assignHomework, S, GAMES
};`, ctx);
const HW = ctx.__hwStory;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== HOMEWORK STORY GENERATOR TESTS ===');

// Test 1: Story generation across games (Cricket, Kabaddi, Pithoo, Stapu)
const storyKabaddi = HW.genHomeworkStory('carry', 'kabaddi', HW.S, { teacherNote: 'Practice 2-digit carrying' });
check('Homework story generated for Kabaddi', storyKabaddi && storyKabaddi.isHomeworkStory, 'failed to generate story');
check('Story carries 3 interactive beats', storyKabaddi && storyKabaddi.beats.length === 3, `got ${storyKabaddi && storyKabaddi.beats.length}`);
check('Beat 0 contains teacher note', storyKabaddi && storyKabaddi.beats[0].say.en.includes('Practice 2-digit carrying'), 'note not woven in');

// Test 2: Procedural SVG court rendering
const svgCricket = HW.genGameSvg('cricket', 0);
check('Procedural SVG generated for Cricket pitch', typeof svgCricket === 'string' && svgCricket.includes('game-svg-panel') && svgCricket.includes('rect'), 'invalid SVG');

const svgStapu = HW.genGameSvg('stapu', 1);
check('Procedural SVG generated for Stapu grid', typeof svgStapu === 'string' && svgStapu.includes('7'), 'invalid Stapu SVG');

// Test 3: Co-Op Buddy Mode turn assignments
const storyCoop = HW.genHomeworkStory('carry', 'cricket', HW.S, { coop: true, p2Name: 'Ananya' });
check('Co-Op Buddy Mode set to true', storyCoop && storyCoop.coop === true, `coop is ${storyCoop && storyCoop.coop}`);
check('Co-Op sets p2Name to Ananya', storyCoop && storyCoop.p2Name === 'Ananya', `got ${storyCoop && storyCoop.p2Name}`);

// Test 4: Checkpoint math options & collectible card reward
const winBeat = storyKabaddi.beats[2];
check('Win beat contains collectible card reward', winBeat && winBeat.card && winBeat.card.stamp === '⭐ Teacher Approved', 'card reward missing');

// Test 5: Teacher homework assignment bridge integration
HW.S.classCode = 'CLASS101';
HW.assignHomework('CLASS101', ['carry', 'barsub'], 'Submitting math practice');
const hwPlan = HW.personalizeContentForHomework(HW.S);
check('personalizeContentForHomework returns story bundle', hwPlan && hwPlan.story && hwPlan.story.isHomeworkStory, 'story not returned in hw bundle');

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
