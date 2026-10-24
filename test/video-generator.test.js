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
  S: { lang: 'en', age: 6, name: 'Kabir', favGame: 'kabaddi' },
  log: () => {},
  render: () => {},
  speak: () => {},
  L: (o) => (o && (o['en'] || o.en)) || '',
  t: (k) => k,
  band: () => ({ id: 'early', en: 'Just starting' })
};
vm.createContext(ctx);

for(const f of [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/core/diagnose.js','src/core/generative-brain.js','src/core/video-library-catalog.js',
  'src/core/cartoon-series.js','src/ui/video-player.js'
]){
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
}

vm.runInContext(`globalThis.__brain = {
  generateCartoonBlueprint, genCartoonSvgKeyframe, getVideoCatalog, recommendNextVideo,
  generateCartoonSeries, startCartoonVideo, videoPlayerHTML, videoLibraryHTML, S, GAMES, THEMES, themeById
};`, ctx);
const B = ctx.__brain;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== GENERATIVE AI CARTOON VIDEO & LIBRARY TESTS ===');

// Test 1: Cartoon blueprint script generation
const vid = B.generateCartoonBlueprint(B.S, 'carry', { gameId: 'kabaddi' });
check('Cartoon video blueprint generated for Kabaddi', vid && vid.type === 'cartoon_video', 'failed to generate blueprint');
check('Blueprint carries 4 cartoon scenes', vid && vid.scenes.length === 4, `got ${vid && vid.scenes.length}`);
check('Scene 2 is interactive checkpoint', vid && vid.scenes[2].isCheckpoint === true, 'checkpoint flag missing');

// Test 2: Multi-Theme Vector SVG keyframe rendering (Anime, Cinema, Sci-Fi, Folk Tales)
const svgAnime = B.genCartoonSvgKeyframe('anime', 1, 1);
check('Anime SVG keyframe contains energy aura circles', typeof svgAnime === 'string' && svgAnime.includes('cartoon-svg-frame') && svgAnime.includes('stroke-dasharray'), 'invalid Anime SVG');

const svgSciFi = B.genCartoonSvgKeyframe('scifi', 1, 1);
check('Sci-Fi SVG keyframe contains planet rings', typeof svgSciFi === 'string' && svgSciFi.includes('ellipse'), 'invalid Sci-Fi SVG');

const svgCinema = B.genCartoonSvgKeyframe('cinema', 1, 1);
check('Cinema SVG keyframe contains spotlight beams', typeof svgCinema === 'string' && svgCinema.includes('polygon'), 'invalid Cinema SVG');

// Test 3: Infinite Video Catalog indexing & theme filtering
const catalogAnime = B.getVideoCatalog(B.S, 'anime');
check('Video catalog returns indexed episodes under theme filter', Array.isArray(catalogAnime), `got ${catalogAnime.length}`);

const recommended = B.recommendNextVideo(B.S);
check('Recommendation engine produces target video', recommended && recommended.type === 'cartoon_video', 'recommendation failed');

// Test 4: Topic Cartoon Series multi-episode arcs
const series = B.generateCartoonSeries('kabaddi_league', B.S);
check('Cartoon series generated with 3 episodes', series && series.episodes.length === 3, `got ${series && series.episodes.length}`);
check('Series Ep 1 carries title', series && series.episodes[0].seriesTitle.en.includes('Kabaddi'), 'series title missing');

// Test 5: Cartoon Theater UI rendering & Theme Filter Pills
B.startCartoonVideo('vid-test', 'carry', 'kabaddi');
const playerHtml = B.videoPlayerHTML();
check('videoPlayerHTML renders active video stage', typeof playerHtml === 'string' && playerHtml.includes('video-stage'), 'invalid player HTML');

const libraryHtml = B.videoLibraryHTML('anime');
check('videoLibraryHTML renders Cartoon Theater gallery with theme filter pills', typeof libraryHtml === 'string' && libraryHtml.includes('theme-filter-row'), 'invalid library HTML');

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
