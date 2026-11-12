/* ==================================================================
   SHAPES — Takhti draws them, and the checker reads the answer off the
   drawing (src/content/geometry.js)

   1. The answer worked out from the drawing: sides, corners, names,
      perimeter, equal sides, the centre, corner kinds, the numbered row.
   2. The checker (through validateLesson, which every lesson passes):
      a wrong marked answer, a Hindi answer that disagrees, two right
      answers, a figure that doesn't say what it asks, a "rectangle"
      with equal sides, sides that can't make a triangle, a row with two
      matches or no odd one out, a number over the band's ceiling — all
      rejected with a reason.
   3. The 27 built-in lessons: all pass; a question's picture never names
      or measures the answer aloud; Ask Munni's hint never says it; side
      lengths are hidden when sides are being counted; no shape question
      goes into an arcade game (there's no picture there); every drawing
      is a clean SVG.
   4. In the app (the real index.html): the picture stays on screen while
      the question is asked, the answer counts for the lesson's skill,
      Ask Munni gives how-to-look help, and a shape lesson drafted by
      Gemini is checked against its drawing.
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
let failures = 0, passes = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

const ctx = { console, Math, Date, JSON };
vm.createContext(ctx);
for(const f of ['src/state.js','src/core/matcher.js','src/core/readability.js','src/content/sentences.js','src/content/games.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js','src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/content/geometry.js','src/content/themes.js','src/core/diagnose.js','src/games/game-core.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
ctx.log = () => {};
const X = vm.runInContext(`({ geoExpect, geoAskError, geoErrors, geoSays, geoArt, geoSay, geoHint, geoPicFor, geoClean, validateLesson, generateLessons, gameBuildPool, GEO_CONCEPTS, GEO_TYPES, S, skillById, CONCEPT_SKILLS })`, ctx);

/* ---------- 1. the answer, from the drawing ---------- */
const E = b => X.geoExpect(b);
check('sides and corners: square 4, rectangle 4, triangle 3, circle 0',
  E({ t:'figure', kind:'square', s:3, ask:'sides' }) === 4 && E({ t:'figure', kind:'rectangle', w:6, h:3, ask:'corners' }) === 4
  && E({ t:'figure', kind:'triangle', sides:[3,4,5], ask:'sides' }) === 3 && E({ t:'figure', kind:'circle', ask:'corners' }) === 0, '');
check('perimeter: 4 × side, 2 × (w + h), the three sides added',
  E({ t:'figure', kind:'square', s:9, ask:'perimeter' }) === 36 && E({ t:'figure', kind:'rectangle', w:12, h:7, ask:'perimeter' }) === 38 && E({ t:'figure', kind:'triangle', sides:[6,8,10], ask:'perimeter' }) === 24, '');
check('names, equal sides (an equilateral triangle yes, a 3-4-5 no), and the centre where 2+ folds meet',
  E({ t:'figure', kind:'rectangle', w:5, h:2, ask:'name' }) === 'rectangle' && E({ t:'figure', kind:'triangle', sides:[5,5,5], ask:'equal' }) === 'yes'
  && E({ t:'figure', kind:'triangle', sides:[3,4,5], ask:'equal' }) === 'no' && E({ t:'figure', kind:'circle', folds:2, ask:'meet' }) === 'centre' && E({ t:'figure', kind:'circle', folds:1, ask:'meet' }) === null, '');
check('corners: 90 square, under it smaller, over it bigger',
  E({ t:'corner', deg:90 }) === 'corner:square' && E({ t:'corner', deg:45 }) === 'corner:smaller' && E({ t:'corner', deg:135 }) === 'corner:bigger', '');
check('a numbered row: the number of the one that matches, the odd one out, and nothing when two match',
  E({ t:'figures', items:[{ kind:'square', s:3 }, { kind:'rectangle', w:6, h:3 }, { kind:'circle' }], find:'rectangle' }) === 2
  && E({ t:'figures', items:[{ kind:'corner', deg:60 }, { kind:'corner', deg:120 }, { kind:'corner', deg:90 }], find:'squarecorner' }) === 3
  && E({ t:'figures', items:[{ kind:'triangle', sides:[3,4,5] }, { kind:'square', s:2 }, { kind:'triangle', sides:[4,4,4] }], find:'odd' }) === 2
  && E({ t:'figures', items:[{ kind:'square', s:3 }, { kind:'square', s:5 }], find:'square' }) === null, '');
check('answers are read in English and Hindi: वर्ग/आयत/त्रिभुज/वृत्त, केंद्र, चौकोर/छोटा/बड़ा कोना, हाँ/नहीं',
  X.geoSays('वर्ग', 'square') && X.geoSays('Rectangle', 'rectangle') && !X.geoSays('Square corner', 'square') && X.geoSays('केंद्र', 'centre')
  && X.geoSays('चौकोर कोना', 'corner:square') && X.geoSays('छोटा कोना', 'corner:smaller') && X.geoSays('Bigger corner', 'corner:bigger') && X.geoSays('हाँ', 'yes') && X.geoSays('12', 12) && !X.geoSays('12', 13), '');

/* ---------- 2. the checker ---------- */
const lesson = (pic, opts, hiOpts, correct, band) => ({ id:'t', band: band || 'developing', title:{ en:'Shapes', hi:'आकृतियाँ' }, sub:{ en:'Look', hi:'देखो' },
  beats:[{ t:'intro', say:{ en:'Look.', hi:'देखो।' } }, pic, { t:'ask', q:{ en:'Which is it?', hi:'कौन सा है?' }, opts, hiOpts: hiOpts || opts, correct }, { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] });
const V = l => X.validateLesson(l);
const good = V(lesson({ t:'figure', kind:'rectangle', w:8, h:5, ask:'perimeter' }, ['26', '13'], null, 0));
check('a right shape question passes', good.ok, JSON.stringify(good.errors));
const bad = (name, l, re) => { const r = V(l); check(name, !r.ok && r.errors.some(e => re.test(e)), JSON.stringify(r.errors)); };
bad('a wrong marked answer is rejected', lesson({ t:'figure', kind:'rectangle', w:8, h:5, ask:'perimeter' }, ['13', '26'], null, 0), /isn't what the picture shows/);
bad('a Hindi answer that disagrees is rejected', lesson({ t:'figure', kind:'square', s:4, ask:'name' }, ['Square', 'Rectangle'], ['आयत', 'वर्ग'], 0), /Hindi answer/);
bad('two right answers are rejected', lesson({ t:'figure', kind:'square', s:4, ask:'name' }, ['Square', 'A square'], ['वर्ग', 'एक वर्ग'], 0), /both answers are right/);
bad("a figure that doesn't say what it asks is rejected", lesson({ t:'figure', kind:'square', s:4 }, ['4', '3'], null, 0), /must say what is asked/);
bad('a "rectangle" with equal sides is rejected', lesson({ t:'figure', kind:'rectangle', w:5, h:5, ask:'sides' }, ['4', '3'], null, 0), /is a square/);
bad("sides that can't make a triangle are rejected", lesson({ t:'figure', kind:'triangle', sides:[1,2,9], ask:'sides' }, ['3', '4'], null, 0), /can't make a triangle/);
bad('a row with two matches is rejected', lesson({ t:'figures', items:[{ kind:'square', s:3 }, { kind:'square', s:4 }], find:'square' }, ['1', '2'], null, 0), /exactly one/);
bad("a number over the band's ceiling is rejected (3–4 year olds: 10)", lesson({ t:'figure', kind:'square', s:12, ask:'perimeter' }, ['48', '36'], null, 0, 'pre'), /ceiling of 10/);
bad("a shape Takhti can't draw is rejected", lesson({ t:'figure', kind:'hexagon', ask:'sides' }, ['6', '5'], null, 0), /can't draw a "hexagon"/);

/* ---------- 3. the built-in lessons ---------- */
const { lessons, rejected } = X.generateLessons({ report: true });
const geo = lessons.filter(l => X.GEO_CONCEPTS.some(c => c.id === l.concept));
check('27 built-in shape lessons, all passing the checker', geo.length === 27 && !rejected.some(r => /sides|whichshape|squarecorner|centre|perim/.test(r.id)), `${geo.length} · ${JSON.stringify(rejected.slice(0, 3))}`);
check('they make two more skills teachable — perimeter and angles — and add to flat shapes',
  ['perimeter', 'angles', 'shapes2d'].every(id => X.skillById(id).concepts.some(c => X.GEO_CONCEPTS.some(g => g.id === c))), '');
const words = { square:['square','वर्ग'], rectangle:['rectangle','आयत'], triangle:['triangle','त्रिभुज'], circle:['circle','वृत्त'], centre:['centre','center','केंद्र'] };
let leaks = [], hintLeaks = [], asks = 0;
for(const les of geo) les.beats.forEach((b, i) => {
  if(b.t !== 'ask') return;
  const pic = X.geoPicFor(les, i); if(!pic) return;
  asks++;
  const want = X.geoExpect(pic);
  for(const lang of ['en', 'hi']){
    X.S.lang = lang;
    const said = X.geoSay(pic) || '', hint = X.geoHint(les, i) || '';
    const bad = typeof want === 'number' ? (pic.t === 'figures' ? null : new RegExp(`\\b${want}\\b`)) : words[want] ? new RegExp(words[want].join('|'), 'i') : null;
    if(bad && bad.test(said)) leaks.push(`${les.id} ${lang}: "${said}"`);
    if(bad && bad.test(hint)) hintLeaks.push(`${les.id} ${lang}: "${hint}"`);
  }
});
X.S.lang = 'en';
check(`a question's picture is never named or measured aloud (${asks} questions, both languages)`, asks >= 30 && !leaks.length, leaks.join(' | '));
check("Ask Munni's hint for a shape question never says the answer", !hintLeaks.length, hintLeaks.join(' | '));
const art = geo.flatMap(l => l.beats.filter(b => X.GEO_TYPES.includes(b.t)).map(b => X.geoArt(b)));
check('every drawing is a clean SVG (no NaN, no undefined)', art.length > 60 && art.every(s => /^<svg class="geo"/.test(s) && !/NaN|undefined|Infinity/.test(s)), art.find(s => /NaN|undefined/.test(s)) || '');
check('side lengths are labelled for perimeter, hidden while sides or corners are counted',
  /<text[^>]*>9<\/text>/.test(X.geoArt({ t:'figure', kind:'square', s:9, ask:'perimeter' })) && !/<text/.test(X.geoArt({ t:'figure', kind:'square', s:3, ask:'sides' })), '');
check('corners are marked when teaching, never on the question picture', /var\(--rani\)/.test(X.geoArt({ t:'figure', kind:'triangle', sides:[3,4,5] }))
  && !/r="4.5"/.test(X.geoArt({ t:'figure', kind:'triangle', sides:[3,4,5], ask:'corners' })), '');
const pool = X.gameBuildPool();
check('no shape question goes into an arcade game (no picture there)', !pool.some(it => geo.some(l => it.id.startsWith(l.id + ':'))) && pool.length > 400, pool.length);
const draft = X.geoClean({ t:'figure', kind:'square', s:'4', ask:'sides', evil:'<script>' });
check('a drafted shape keeps only known fields, typed', !('evil' in draft.beat) && draft.errors.some(e => /side s/.test(e)), JSON.stringify(draft));

/* ---------- 4. the app ---------- */
(async () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
  const srv = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const vc = new VirtualConsole(), jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${srv.address().port}/index.html`, runScripts:'dangerously', resources:'usable', pretendToBeVisual: true,
    beforeParse(win){
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
      win.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function(){};
      win.fetch = () => Promise.reject(new Error('offline'));
    } });
  const win = dom.window, A = c => win.eval(c), screen = () => win.document.querySelector('#screen');
  await new Promise(r => win.addEventListener('load', r));
  A(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
  [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][4].click(); win.document.querySelector('.ob-go').click();
  try{
    A(`S.game = S.game || 'cricket'; S.age = 7; S.online = false; go('lessons')`);
    const id = A(`lessonBank().find(l => l.concept === 'squarecorner' && /45/.test(l.id)).id`);
    A(`startLesson('${id}')`);
    for(let i = 0; i < 50 && !A(`!!S.lesson`); i++) await wait(10);
    A(`S.lesson.i = 1; render()`);
    check('a teaching corner is drawn on the lesson screen', !!screen().querySelector('.lesart svg.geo') && /square corner/i.test(screen().textContent), screen().textContent.slice(0, 200));
    A(`S.lesson.i = 3; render()`);
    check('while the question is asked, its picture stays on screen', !!screen().querySelector('.lesart svg.geo') && /What kind of corner/.test(screen().textContent), screen().innerHTML.slice(0, 300));
    const tg = A(`JSON.stringify(askTarget())`);
    check('Ask Munni on it: how to look (a book corner), and the two choices — not the answer alone', /corner of a book/.test(tg) && /Smaller corner/.test(tg), tg.slice(0, 300));
    const n0 = A(`(S.skillHistory.angles || { n:0 }).n`);
    A(`lesAnswer(S.lesson.data.beats[3].correct)`);
    check("the answer counts for the lesson's skill (square corners → angles)", A(`S.skillHistory.angles.n`) === n0 + 1, A(`JSON.stringify(S.skillHistory)`));
    A(`endLesson()`);

    // Gemini's school lesson with a shape: checked against its drawing
    const raw = { title:{ en:'Around the field', hi:'मैदान के चारों ओर' }, sub:{ en:'Perimeter', hi:'परिमाप' }, ic:'🏏', skill:'perimeter',
      aims:[{ en:'The child can find the perimeter of a rectangle.', hi:'बच्चा आयत का परिमाप निकाल सकता है।' }],
      beats:[{ t:'intro', say:{ en:'Ravi walks around the field.', hi:'रवि मैदान के चारों ओर चलता है।' } }, { t:'figure', kind:'rectangle', w:30, h:20, ask:'perimeter' },
             { t:'ask', q:{ en:'How far does he walk?', hi:'वह कितना चलता है?' }, opts:['100','50'], hiOpts:['100','50'], correct:0 }, { t:'win', say:{ en:'Add every side.', hi:'हर भुजा जोड़ो।' } }] };
    const ok = JSON.parse(A(`JSON.stringify(sylClean(${JSON.stringify(raw)}, { band:'fluent' }))`));
    check("a drafted shape lesson passes, its answer marked 'checked against the drawing'", ok.ok && ok.checks[0] === 'shape' && ok.lesson.subject === 'math', JSON.stringify(ok.errors));
    raw.beats[2].opts = ['50','100']; raw.beats[2].hiOpts = ['50','100'];
    const no = JSON.parse(A(`JSON.stringify(sylClean(${JSON.stringify(raw)}, { band:'fluent' }))`));
    check('…and one that marks w + h (the mistake) as right is rejected', !no.ok && no.errors.some(e => /isn't what the picture shows/.test(e)), JSON.stringify(no.errors));
    raw.beats[2].opts = ['100','50']; raw.beats[2].hiOpts = ['100','50']; raw.beats[1].say = { en:'All the way round is 100.', hi:'चारों ओर कुल 100 है।' };
    const told = JSON.parse(A(`JSON.stringify(sylClean(${JSON.stringify(raw)}, { band:'fluent' }))`));
    check("…and one whose picture's own narration says the answer is rejected", !told.ok && told.errors.some(e => /say the answer "100"/.test(e)), JSON.stringify(told.errors));
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  srv.close(); win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
