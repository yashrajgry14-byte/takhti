/* ==================================================================
   HOMEWORK STORY — genHomeworkStory() (core/lesson-gen.js), built on
   skillProblem() (core/mathgen.js).

   Proves the things that were wrong before: the right answer is not
   always the first option; the question really exercises the named
   skill (carrying carries, BODMAS needs the order of operations and
   offers the add-first mistake); the story uses the child's own game,
   not a hardcoded one; a skill that isn't one arithmetic question gets
   no fake story; the card id is stable so it can't be minted twice.
   ================================================================== */
const fs = require('fs'), vm = require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

const ctx = { console, Intl, S: { lang:'en', age:8, name:'Kabir', id:'c-kabir', game:'cricket', day:0 } };
vm.createContext(ctx);
const LOAD_LIST = [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/core/diagnose.js','src/core/mathgen.js'
];
for(const f of LOAD_LIST) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
vm.runInContext(`globalThis.__ = { genHomeworkStory, genGameSvg, gameById, S };`, ctx);
const X = ctx.__;

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({name, pass, detail}); if(!pass) failures++; }

const lc = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html loads before core/diagnose.js", lc.pass, JSON.stringify(lc.missing));

const evalQ = q => Function(`return (${q.en.replace(' = ?','').replace(/×/g,'*').replace(/−/g,'-').replace(/÷/g,'/')})`)();
const ask = st => st.beats.find(b => b.t === 'ask');

const carry = X.genHomeworkStory('carry', null, X.S, { teacherNote: 'Practise carrying' });
console.log('carry story:', ask(carry).q.en, ask(carry).opts, 'correct', ask(carry).correct);
check('a homework story has three beats: intro, the question, the win', carry && carry.beats.map(b=>b.t).join() === 'intro,ask,win', JSON.stringify(carry && carry.beats.map(b=>b.t)));
check("with no game given, it uses the child's own game (cricket), not a hardcoded one", carry.gameId === 'cricket', carry.gameId);
check("the teacher's note is woven into the opening line", carry.beats[0].say.en.includes('Practise carrying'), carry.beats[0].say.en);
check('the option marked correct really is the answer to the question asked', Number(ask(carry).opts[ask(carry).correct]) === evalQ(ask(carry).q), JSON.stringify(ask(carry)));
{
  const [a, b] = ask(carry).q.en.replace(' = ?','').split(' + ').map(Number);
  check('a "carrying" question genuinely carries (ones digits add to 10 or more)', (a % 10) + (b % 10) >= 10, ask(carry).q.en);
}

// the right answer must not sit in the same position every time
const positions = new Set();
for(let i = 0; i < 40; i++){
  const st = X.genHomeworkStory('add2', null, { ...X.S, id: 'child' + i }, {});
  positions.add(ask(st).correct);
}
check('across 40 children, the correct answer lands in more than one position (it used to be index 0 every time)', positions.size >= 2, JSON.stringify([...positions]));

const bod = X.genHomeworkStory('bodmas', null, X.S, {});
const bq = ask(bod).q.en.replace(' = ?','');
const [ba, rest] = bq.split(' + '); const [bb, bc] = rest.split(' × ').map(Number);
check('a BODMAS question really needs the order of operations (a + b × c)', /\d+ \+ \d+ × \d+/.test(bq), bq);
check('…and offers the classic mistake (adding first) as one of the wrong options', ask(bod).opts.map(Number).includes((Number(ba) + bb) * bc), JSON.stringify(ask(bod).opts));

check('a skill that is not one arithmetic question (shapes) gets no story at all, not a fake sum', X.genHomeworkStory('shapes2d', null, X.S, {}) === null, 'expected null');
check('…same for a reading skill', X.genHomeworkStory('read3', null, X.S, {}) === null, 'expected null');

const coop = X.genHomeworkStory('carry', 'kabaddi', X.S, { coop:true, p2Name:'Ananya' });
check('co-op mode: coop flag set and the friend named', coop.coop === true && coop.p2Name === 'Ananya', JSON.stringify({coop:coop.coop, p2:coop.p2Name}));
check('an explicit game overrides the child default', coop.gameId === 'kabaddi', coop.gameId);

const again = X.genHomeworkStory('carry', null, X.S, {});
const card = carry.beats[2].card;
check('the win beat carries a card with a stable id, so finishing twice cannot mint a duplicate', card && card.id === again.beats[2].card.id && !/\d{10,}/.test(card.id), card && card.id);

const svgCricket = X.genGameSvg(X.gameById('cricket'), 1);
check('procedural game SVG renders for cricket', svgCricket.includes('game-svg-panel') && svgCricket.includes('rect'), 'invalid SVG');
const svgStapu = X.genGameSvg(X.gameById('stapu'), 1);
check('procedural game SVG renders for stapu', svgStapu.includes('game-svg-panel'), 'invalid SVG');

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);
process.exitCode = failures ? 1 : 0;
