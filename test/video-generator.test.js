/* ==================================================================
   CARTOON EPISODES — the episode builder (core/generative-brain.js), the
   catalog and recommender (core/video-library-catalog.js), the series
   (core/cartoon-series.js) and the player's round logic
   (ui/video-player.js), driven directly in a vm context.

   Reachability from the real map is proven separately, in a real jsdom
   app — see test/app-flows.test.js. This file proves the behaviour:
     · episodes use the child's own game and the chosen theme, and are
       built from skillProblem() — shuffled options, real answers
     · the worked example (scene 2) is a different problem from the
       child's own question (scene 3), so it doesn't give the answer away
     · the catalog respects the age band, and theme filtering actually
       filters (it used to return nothing for every theme)
     · a series shows only the episodes the child's band reaches
     · the recommender picks the child's hardest cartoon skill
     · a checkpoint answer is real evidence (skill history + record()),
       and the card is awarded only for a right answer, once
   ================================================================== */
const fs = require('fs'), vm = require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

const records = [];
const ctx = {
  console, Intl, setTimeout, clearTimeout,
  S: { lang:'en', age:6, name:'Kabir', id:'c-kabir', game:'cricket', day:0, ctx:{},
       skillHistory:{}, cards:[], classCode:null, levels:{read:2,write:1,math:2} }
};
vm.createContext(ctx);
// DOM/speech/sound-facing helpers the renderers and player call, stubbed:
// none of them carry logic under test here.
Object.assign(ctx, {
  log: () => {}, render: () => {}, speak: () => {}, saveSoon: () => {},
  t: k => k, L: o => (o && (o[ctx.S.lang] || o.en)) || '',
  attr: s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
  record: (mod, ok) => records.push([mod, ok])
});
const LOAD_LIST = [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/core/diagnose.js','src/core/generative-brain.js',
  'src/core/video-library-catalog.js','src/core/cartoon-series.js','src/core/mathgen.js',
  'src/ui/mascot.js','src/ui/lesson-player.js','src/ui/video-player.js'
];
for(const f of LOAD_LIST) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
vm.runInContext(`globalThis.__ = { generateCartoonBlueprint, getVideoCatalog, recommendNextVideo, cartoonSeriesFor,
  cartoonSkills, startCartoonVideo, videoNextScene, videoAnswer, endCartoonVideo, theaterStop, setTheaterTheme,
  videoPlayerHTML, videoLibraryHTML, skillById, THEMES, S };`, ctx);
const X = ctx.__, S = ctx.S;

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({name, pass, detail}); if(!pass) failures++; }

const lc = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html loads before core/diagnose.js", lc.pass, JSON.stringify(lc.missing));

/* ---- the episode ---- */
const vid = X.generateCartoonBlueprint(S, 'add10', { themeId:'anime' });
const q = vid.scenes[2];
console.log('episode:', vid.id, '·', q.question.en, q.opts, 'correct', q.correct);
check('an episode has four scenes, the third is the checkpoint', vid.scenes.length === 4 && q.isCheckpoint === true, JSON.stringify(vid.scenes.map(s=>!!s.isCheckpoint)));
check("it uses the child's own game (cricket), not a hardcoded Kabaddi", vid.gameId === 'cricket', vid.gameId);
check('the chosen theme flows all the way into the drawing (anime backdrop)', vid.themeId === 'anime' && vid.scenes[0].svg.includes('stroke-dasharray="10,5"'), vid.themeId);
check('Gauri in the scene is the real sparrow drawing, not a parrot emoji', vid.scenes[0].svg.includes('cartoon-gauri') && !vid.scenes[0].svg.includes('🦜'), 'gauri missing');
check('the checkpoint has three distinct options and the marked one is the right answer',
  new Set(q.opts).size === 3 && Number(q.opts[q.correct]) === Function(`return ${q.question.en.replace(' = ?','')}`)(), JSON.stringify(q));
check("the worked example (scene 2) is a different problem from the child's own question",
  !vid.scenes[1].narration.en.includes(q.question.en.replace(' = ?','')), vid.scenes[1].narration.en);
check('the worked example is drawn (an add beat) when its numbers are small', vid.scenes[1].beat && vid.scenes[1].beat.t === 'add', JSON.stringify(vid.scenes[1].beat));
check('a skill that is not one arithmetic question gets no episode', X.generateCartoonBlueprint(S, 'shapes2d', {}) === null, 'expected null');
check('the episode id is stable (no timestamp), so its card can be recognised as already earned', !/\d{10,}/.test(vid.id), vid.id);

/* ---- the catalog: band-limited, and theme filtering really filters ---- */
S.age = 6;
const early = X.getVideoCatalog(S, 'all');
check('a 6-year-old sees only Class 1 maths cartoons', early.length > 0 && early.every(v => X.skillById(v.skillId).g <= 1), JSON.stringify(early.map(v=>v.skillId)));
S.age = 9;
const all9 = X.getVideoCatalog(S, 'all'), anime9 = X.getVideoCatalog(S, 'anime');
check('a 9-year-old\'s catalog reaches times tables', all9.some(v => v.skillId === 'tables'), JSON.stringify(all9.map(v=>v.skillId)));
check('filtering by a theme returns that theme\'s episodes — every one of them, not an empty list', anime9.length === all9.length && anime9.every(v => v.themeId === 'anime'), `${anime9.length} vs ${all9.length}`);
check('with no filter the shelf mixes themes', new Set(all9.map(v => v.themeId)).size > 1, JSON.stringify([...new Set(all9.map(v=>v.themeId))]));

/* ---- series: only the episodes this child reaches ---- */
S.age = 6;
const series6 = X.cartoonSeriesFor();
check('a 6-year-old is not offered the times-tables series at all', !series6.some(s => s.id === 'cricket_cup'), JSON.stringify(series6.map(s=>s.id)));
check('…and the series they do see only hold episodes they can reach', series6.every(s => s.episodes.every(id => X.skillById(id).g <= 1)), JSON.stringify(series6.map(s=>s.episodes)));
S.age = 9;
const series9 = X.cartoonSeriesFor();
check('a 9-year-old gets the cricket series with its tables episode', series9.some(s => s.id === 'cricket_cup' && s.episodes.includes('tables')), JSON.stringify(series9.map(s=>[s.id, s.episodes])));

/* ---- recommendation ---- */
S.skillHistory = { tables:{ n:10, right:3 }, add2:{ n:10, right:9 } };
const rec = X.recommendNextVideo(S);
check("the recommendation is the child's hardest practised cartoon skill (tables, 30%)", rec && rec.skillId === 'tables', JSON.stringify(rec));
S.skillHistory = {};

/* ---- the player: evidence and the card ---- */
S.age = 6;
X.startCartoonVideo('add10', 'sports', null);
check('starting an episode opens the player', S.activeVideo && S.activeVideo.sceneIdx === 0 && X.videoPlayerHTML().includes('video-stage'), 'no active video');
X.videoNextScene(); X.videoNextScene();           // hook → example → checkpoint
check('the player cannot skip past the checkpoint without an answer', (X.videoNextScene(), S.activeVideo.sceneIdx === 2), `scene ${S.activeVideo.sceneIdx}`);
const cp = S.activeVideo.data.scenes[2];
X.videoAnswer((cp.correct + 1) % 3);              // wrong
check('a wrong answer is recorded as skill evidence (add10: 1 try, 0 right)', S.skillHistory.add10 && S.skillHistory.add10.n === 1 && S.skillHistory.add10.right === 0, JSON.stringify(S.skillHistory));
check("…and counts on the maths level/goal engine like any other maths answer", records.length === 1 && records[0][0] === 'math' && records[0][1] === false, JSON.stringify(records));
X.videoNextScene();
check('no card for a wrong answer', !S.cards.length && X.videoPlayerHTML().includes('next time'), JSON.stringify(S.cards));
X.endCartoonVideo();

X.startCartoonVideo('add10', 'sports', null);
X.videoNextScene(); X.videoNextScene();
X.videoAnswer(S.activeVideo.data.scenes[2].correct);
X.videoNextScene();
check('a right answer earns the card, kept in the profile', S.cards.length === 1 && S.cards[0].id === 'card-vid-add10', JSON.stringify(S.cards));
X.endCartoonVideo();
X.startCartoonVideo('add10', 'sports', null);
X.videoNextScene(); X.videoNextScene(); X.videoAnswer(S.activeVideo.data.scenes[2].correct); X.videoNextScene();
check('earning it again does not duplicate it', S.cards.length === 1, JSON.stringify(S.cards));
check('the shelf marks an episode whose card is earned', X.getVideoCatalog(S, 'all').find(v => v.skillId === 'add10').earned === true, 'not marked');

X.theaterStop();
check('leaving the Picture Hut clears the episode in progress', S.activeVideo === null, JSON.stringify(S.activeVideo));

S.ctx = {};
const lib = X.videoLibraryHTML();
check('the shelf renders an "All" pill plus one per theme', X.THEMES.every(th => lib.includes(`setTheaterTheme('${th.id}')`)) && lib.includes(`setTheaterTheme('all')`), 'pills missing');
check('the shelf renders the recommended episode and the catalog', lib.includes('hero-video-card') && (lib.match(/class="video-card/g) || []).length === X.getVideoCatalog(S,'all').length, 'shelf incomplete');

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);
process.exitCode = failures ? 1 : 0;
