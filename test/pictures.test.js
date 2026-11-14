/* ==================================================================
   PICTURES BEYOND SHAPES — Takhti draws them, and the checker reads the
   answer off the drawing. One section per kind of picture.

   CLOCKS (src/content/clock.js)
   1. The answer worked out from the hands: the time on one clock, the
      minutes or hours between two (across 12 too); times read as the class
      writes them, in English and Hindi.
   2. The checker (validateLesson, which every lesson passes): a wrong
      marked time, a Hindi time that disagrees, two right answers, a clock
      that doesn't say what it asks, a time the age band doesn't read yet,
      no clocks for 3–4, hours that aren't whole, minutes over the band's
      ceiling, an hour that can't be drawn, the teaching clock asked again.
   3. The built-in lessons: all pass and make time2 and time3 teachable; a
      question's clock is never read aloud; Ask Munni's hint never says the
      answer; the hands are drawn where they really are; clean SVGs; no
      clock question in an arcade game; a drafted clock keeps known fields.
   4. A school lesson (core/syllabus.js, in the real app): a drafted clock
      lesson passes, checked against the drawing; a wrong time, an intro
      that says the time in Hindi words, and a silent teaching clock whose
      own words give the answer away are caught; a clock's missing ask and a
      time written as a note are tidied; "3:30" is fine as a Hindi answer;
      the teacher is warned when every clock is on the hour, and about a
      clock aim no question checks; the clock example in Gemini's prompt
      passes Takhti's own checker.
   5. In the app: the clock stays on screen while the question is asked,
      the answer counts for time3, Ask Munni says how to read a clock.
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
let failures = 0, passes = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

const LOAD = ['src/state.js','src/core/matcher.js','src/core/readability.js','src/content/sentences.js','src/content/games.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js','src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/content/geometry.js','src/content/clock.js','src/content/themes.js','src/core/diagnose.js','src/games/game-core.js'];
const { verifyLoadListHasAllContent } = require('./_helpers/load-order');
const lo = verifyLoadListHasAllContent(LOAD, 'src/core/diagnose.js');
check('this suite loads every content file index.html loads before diagnose.js', lo.pass, lo.missing.join(', '));
const ctx = { console, Math, Date, JSON };
vm.createContext(ctx);
for(const f of LOAD) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
ctx.log = () => {};
const X = vm.runInContext(`({ clockExpect, clockAskError, clockErrors, clockSays, clockRead, clockArt, clockSay, clockHint, clockClean, clockSaid, clockWords,
  picFor, picIs, validateLesson, generateLessons, gameBuildPool, CLOCK_CONCEPTS, CLOCK_TYPES, AGE_BANDS, S, skillById })`, ctx);

/* ---------- 1. the answer, from the hands ---------- */
const E = b => X.clockExpect(b);
check('one clock: the time its hands show (only when it asks)',
  E({ t:'clock', h:3, m:30, ask:'time' }) === 'time:3:30' && E({ t:'clock', h:12, m:45, ask:'time' }) === 'time:12:45' && E({ t:'clock', h:3, m:30 }) === null, '');
check('two clocks: the minutes between them, whole hours, and across 12 (11:30 → 12:15 is 45)',
  E({ t:'clocks', from:{ h:5, m:0 }, to:{ h:5, m:20 }, ask:'minutes' }) === 20 && E({ t:'clocks', from:{ h:3, m:0 }, to:{ h:6, m:0 }, ask:'hours' }) === 3
  && E({ t:'clocks', from:{ h:11, m:30 }, to:{ h:12, m:15 }, ask:'minutes' }) === 45 && E({ t:'clocks', from:{ h:3, m:0 }, to:{ h:4, m:30 }, ask:'hours' }) === null, '');
const R = s => { const t = X.clockRead(s); return t ? `${t.h}:${t.m}` : null; };
check("times read as the class writes them: 3:20, 3 o'clock, half past, quarter past, quarter to, minutes past/to, number words",
  R('3:20') === '3:20' && R("3 o'clock") === '3:0' && R('half past 9') === '9:30' && R('quarter past 6') === '6:15' && R('quarter to 4') === '3:45'
  && R('quarter to 1') === '12:45' && R('20 minutes past 3') === '3:20' && R('10 minutes to 5') === '4:50' && R("seven o'clock") === '7:0', '');
check('…and in Hindi: बजे, साढ़े, सवा, पौने, डेढ़, ढाई, बजकर … मिनट, बजने में, Devanagari digits — "साढ़े 3 बजे" is 3:30, never also 3:00',
  R('3 बजे') === '3:0' && R('साढ़े 3 बजे') === '3:30' && R('सवा 6 बजे') === '6:15' && R('पौने 4 बजे') === '3:45' && R('डेढ़ बजे') === '1:30' && R('ढाई बजे') === '2:30'
  && R('3 बजकर 20 मिनट') === '3:20' && R('5 बजने में 10 मिनट') === '4:50' && R('साढ़े ९ बजे') === '9:30' && R('सात बजे') === '7:0', '');
check('an answer that says two different times, or none, is no time at all', R('3:20 or 4:20') === null && R('soon') === null, '');
check('minutes and hours as answers: "20", "20 minutes", "20 मिनट" — but not "20 hours" for minutes',
  X.clockSays('20', 20, 'minutes') && X.clockSays('20 minutes', 20, 'minutes') && X.clockSays('20 मिनट', 20, 'minutes') && !X.clockSays('20 hours', 20, 'minutes') && X.clockSays('3 घंटे', 3, 'hours'), '');

/* ---------- 2. the checker ---------- */
const lesson = (pic, opts, hiOpts, correct, band, extra) => ({ id:'t', band: band || 'developing', title:{ en:'Time', hi:'समय' }, sub:{ en:'Look', hi:'देखो' },
  beats:[{ t:'intro', say:{ en:'Look.', hi:'देखो।' } }, ...(extra || []), pic, { t:'ask', q:{ en:'What time is it?', hi:'कितने बजे हैं?' }, opts, hiOpts: hiOpts || opts, correct }, { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] });
const V = l => X.validateLesson(l);
const good = V(lesson({ t:'clock', h:9, m:30, ask:'time' }, ['half past 9', 'half past 10'], ['साढ़े 9 बजे', 'साढ़े 10 बजे'], 0));
check('a right clock question passes', good.ok, JSON.stringify(good.errors));
const good2 = V(lesson({ t:'clocks', from:{ h:2, m:0 }, to:{ h:2, m:20 }, ask:'minutes' }, ['4', '20'], null, 1));
check('a right "how many minutes passed?" passes', good2.ok, JSON.stringify(good2.errors));
const bad = (name, l, re) => { const r = V(l); check(name, !r.ok && r.errors.some(e => re.test(e)), JSON.stringify(r.errors)); };
bad('a wrong marked time is rejected', lesson({ t:'clock', h:9, m:30, ask:'time' }, ['half past 10', 'half past 9'], ['साढ़े 10 बजे', 'साढ़े 9 बजे'], 0), /isn't what the clock shows/);
bad('a Hindi time that disagrees is rejected', lesson({ t:'clock', h:9, m:30, ask:'time' }, ['half past 9', 'half past 10'], ['साढ़े 10 बजे', 'साढ़े 9 बजे'], 0), /Hindi answer/);
bad('two right answers are rejected ("half past 3" and "3:30")', lesson({ t:'clock', h:3, m:30, ask:'time' }, ['half past 3', '3:30'], null, 0), /both answers are right/);
bad("a clock that doesn't say what it asks is rejected", lesson({ t:'clock', h:3, m:30 }, ['half past 3', 'half past 4'], null, 0), /must say what is asked/);
bad("5–6 year olds read only o'clock: half past 3 is rejected for them, with why", lesson({ t:'clock', h:3, m:30, ask:'time' }, ['3:30', '4:30'], null, 0, 'early'), /o'clock only/);
bad('no clocks for 3–4 year olds', lesson({ t:'clock', h:3, m:0, ask:'time' }, ["3 o'clock", "12 o'clock"], null, 0, 'pre'), /clocks start at ages 5–6/);
bad('"how many hours?" between times that aren\'t whole hours is rejected', lesson({ t:'clocks', from:{ h:3, m:0 }, to:{ h:4, m:30 }, ask:'hours' }, ['1', '2'], null, 0), /whole number of hours/);
bad("minutes over the band's ceiling are rejected (7–8: 100 — so 1 o'clock to 3 o'clock is asked in hours)", lesson({ t:'clocks', from:{ h:1, m:0 }, to:{ h:3, m:0 }, ask:'minutes' }, ['120', '24'], null, 0), /ceiling of 100/);
bad("an hour that can't be on a clock is rejected", lesson({ t:'clock', h:13, m:0, ask:'time' }, ["1 o'clock", "12 o'clock"], null, 0), /hour h is 1 to 12/);
bad('the teaching clock asked about again is rejected (it shows the answer)', lesson({ t:'clock', h:4, m:30, ask:'time' }, ['half past 4', 'half past 5'], null, 0, null, [{ t:'clock', h:4, m:30 }]), /teaching picture again.*different time/);

/* ---------- 3. the built-in lessons ---------- */
const { lessons, rejected } = X.generateLessons({ report: true });
const clk = lessons.filter(l => X.CLOCK_CONCEPTS.some(c => c.id === l.concept));
check("28 built-in clock lessons (12 o'clock ones moved from literacy.js, 16 new), all passing the checker", clk.length === 28 && !rejected.some(r => /clock|timepassed/.test(r.id)), `${clk.length} · ${JSON.stringify(rejected.filter(r => /clock|timepassed/.test(r.id)).slice(0, 3))}`);
check('they make "Telling the hour" (time2) and the new "Time to five minutes, and how long" (time3) teachable',
  ['time2', 'time3'].every(id => X.skillById(id) && X.skillById(id).concepts.some(c => X.CLOCK_CONCEPTS.some(g => g.id === c))), '');
let leaks = [], hintLeaks = [], asks = 0;
for(const les of clk) les.beats.forEach((b, i) => {
  if(b.t !== 'ask') return;
  const pic = X.picFor(les, i); if(!pic) return;
  asks++;
  for(const lang of ['en', 'hi']){
    X.S.lang = lang;
    const said = X.clockSay(pic) || '', hint = X.clockHint(les, i) || '';
    if(X.clockSaid(said, pic)) leaks.push(`${les.id} ${lang}: "${said}"`);
    if(X.clockSaid(hint, pic) || (typeof X.clockExpect(pic) === 'number' && new RegExp(`(^|\\D)${X.clockExpect(pic)}(\\D|$)`).test(hint))) hintLeaks.push(`${les.id} ${lang}: "${hint}"`);
    const right = (lang === 'hi' ? b.hiOpts : b.opts)[b.correct];
    if(said.includes(right) || hint.includes(right)) leaks.push(`${les.id} ${lang}: says "${right}"`);
  }
});
X.S.lang = 'en';
check(`a question's clock is never read aloud (${asks} questions, both languages)`, asks === 44 && !leaks.length, leaks.join(' | '));
check("Ask Munni's hint for a clock question never says the answer", !hintLeaks.length, hintLeaks.join(' | '));
const art = clk.flatMap(l => l.beats.filter(b => X.CLOCK_TYPES.includes(b.t)).map(b => X.clockArt(b)));
check('every clock is a clean SVG (no NaN, no undefined)', art.length === 80 && art.every(s => /^<svg class="geo clock"/.test(s) && !/NaN|undefined|Infinity/.test(s)), art.find(s => /NaN|undefined/.test(s)) || '');
// the hands are where they really are: at 3:00 the hour hand points at the 3 (right of the centre, level);
// at half past 3 it has moved half way to the 4
const hands = svg => [...svg.matchAll(/<line x1="110" y1="110" x2="([\d.]+)" y2="([\d.]+)"/g)].map(m => [Number(m[1]) - 110, Number(m[2]) - 110]);
const [h300] = hands(X.clockArt({ t:'clock', h:3, m:0 })), [h330, m330] = hands(X.clockArt({ t:'clock', h:3, m:30 }));
const deg = v => (Math.atan2(v[1], v[0]) * 180 / Math.PI + 90 + 360) % 360;
check('the hands are drawn to the time: the hour hand at 90° for 3:00, 105° for half past 3, and the minute hand at the 6 (180°)',
  Math.abs(deg(h300) - 90) < 0.5 && Math.abs(deg(h330) - 105) < 0.5 && Math.abs(deg(m330) - 180) < 0.5, JSON.stringify([deg(h300), deg(h330), deg(m330)]));
check('the clock never names its time in its own label (a screen reader would read it out)', !/\d/.test(/aria-label="([^"]*)"/.exec(X.clockArt({ t:'clock', h:3, m:30, ask:'time' }))[1]), '');
const pool = X.gameBuildPool();
check('no clock question goes into an arcade game (no picture there)', !pool.some(it => clk.some(l => it.id.startsWith(l.id + ':'))) && pool.length > 400, pool.length);
const draft = X.clockClean({ t:'clock', h:3, m:'30', ask:'time', evil:'<script>' });
check('a drafted clock keeps only known fields, typed', !('evil' in draft.beat) && draft.errors.some(e => /minutes m/.test(e)), JSON.stringify(draft));

/* ---------- 4 and 5: the app ---------- */
const AIM = { short:{ en:'Read half past', hi:'साढ़े पढ़ो' }, point:{ en:'The child can read a half past time on a clock.', hi:'बच्चा घड़ी पर साढ़े का समय पढ़ सकता है।' },
  forget:{ en:'I forgot! How do I read a clock when the long hand is at the 6?', hi:'मैं भूल गई! जब बड़ी सुई 6 पर हो, तो घड़ी कैसे पढ़ूँ?' },
  hints:[{ en:'Which hand do you look at first?', hi:'सबसे पहले कौन सी सुई देखोगे?' }, { en:'And after that, what do you look at?', hi:'और उसके बाद क्या देखोगे?' }],
  ideas:[{ en:'the short hand has just passed the hour, and the long hand at the 6 means half past', hi:'छोटी सुई अभी घंटा पार कर चुकी है, और बड़ी सुई 6 पर मतलब साढ़े',
           words:['short hand','passed','just after','half past','छोटी सुई','पार','साढ़े','chhoti sui','sadhe'] }] };
const raw = (beats, extra) => ({ title:{ en:'Half past', hi:'साढ़े' }, sub:{ en:'The long hand at the 6', hi:'बड़ी सुई 6 पर' }, ic:'🕒', skill:'time3', source:'Page 170', aims:[AIM], beats, ...(extra || {}) });
const Q = (opts, hiOpts, correct, q) => ({ t:'ask', q: q || { en:'What time is it?', hi:'कितने बजे हैं?' }, opts, hiOpts, correct, why:{ en:'Children name the next hour.', hi:'बच्चे अगला घंटा बोलते हैं।' } });
const INTRO = { t:'intro', say:{ en:'Let us read the clock.', hi:'आओ घड़ी पढ़ें।' } }, WIN = { t:'win', say:{ en:'Short hand first.', hi:'पहले छोटी सुई।' } };
const TEACH = { t:'clock', h:4, m:30, say:{ en:'The short hand has passed the 4. The long hand is at the 6.', hi:'छोटी सुई 4 पार कर चुकी है। बड़ी सुई 6 पर है।' } };

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
  const clean = (r, band) => JSON.parse(A(`JSON.stringify(sylClean(${JSON.stringify(r)}, { band:'${band || 'developing'}', skills: sylSkills(sylClass('c3')) }))`));
  try{
    /* ---------- 4. a school lesson ---------- */
    const ok = clean(raw([INTRO, TEACH, { t:'clock', h:9, m:30, ask:'time' }, Q(['half past 9', 'half past 10'], ['साढ़े 9 बजे', 'साढ़े 10 बजे'], 0),
      { t:'clocks', from:{ h:2, m:0 }, to:{ h:2, m:20 }, ask:'minutes' }, Q(['4', '20'], ['4', '20'], 1, { en:'How many minutes passed?', hi:'कितने मिनट बीते?' }), WIN]));
    check("a drafted clock lesson passes, each answer marked 'checked against the drawing', a maths lesson", ok.ok && ok.checks.join() === 'shape,shape' && ok.lesson.subject === 'math', JSON.stringify(ok.errors));
    const wrongT = clean(raw([INTRO, TEACH, { t:'clock', h:9, m:30, ask:'time' }, Q(['half past 10', 'half past 9'], ['साढ़े 10 बजे', 'साढ़े 9 बजे'], 0), WIN]));
    check('…one that marks the next hour (the real mistake) as right is rejected', !wrongT.ok && wrongT.errors.some(e => /isn't what the clock shows/.test(e)), JSON.stringify(wrongT.errors));
    const told = clean(raw([{ t:'intro', say:{ en:'Riya wakes up and looks at the clock.', hi:'रिया साढ़े नौ बजे उठती है।' } }, TEACH, { t:'clock', h:9, m:30, ask:'time' },
      Q(['half past 9', 'half past 10'], ['साढ़े 9 बजे', 'साढ़े 10 बजे'], 0), WIN]));
    check('…one whose intro says the time in Hindi words ("साढ़े नौ बजे") is rejected, and the reason says where', !told.ok && told.errors.some(e => /say the answer.*in the intro/.test(e)), JSON.stringify(told.errors));
    const silent = clean(raw([INTRO, { t:'clocks', from:{ h:3, m:0 }, to:{ h:3, m:20 } }, { t:'clocks', from:{ h:6, m:0 }, to:{ h:6, m:20 }, ask:'minutes' },
      Q(['20', '4'], ['20', '4'], 0, { en:'How many minutes passed?', hi:'कितने मिनट बीते?' }), WIN]));
    check("a silent teaching clock gets Munni's own words written in (\"That is 20 minutes\") — and so gives away a question whose answer is 20",
      /That is 20 minutes/.test(silent.lesson.beats[1].say.en) && /20 मिनट/.test(silent.lesson.beats[1].say.hi) && !silent.ok && silent.errors.some(e => /say the answer "20" \(in beat 1/.test(e)), JSON.stringify([silent.lesson.beats[1].say, silent.errors]));
    const tidy = clean(raw([INTRO, TEACH, { t:'clock', text:'9:30' }, Q(['half past 9', '9:06'], ['साढ़े 9 बजे', '9:06'], 0), WIN]));
    check('a clock missing its ask gets it from the question ("What time is it?"), its time from a note ("9:30") — and "9:06" is a fine Hindi answer',
      tidy.ok && tidy.lesson.beats[2].h === 9 && tidy.lesson.beats[2].m === 30 && tidy.lesson.beats[2].ask === 'time' && !('text' in tidy.lesson.beats[2]), JSON.stringify([tidy.errors, tidy.lesson.beats[2]]));
    const hourly = clean(raw([INTRO, { t:'clock', h:4, m:0 }, { t:'clock', h:7, m:0, ask:'time' }, Q(["7 o'clock", "12 o'clock"], ['7 बजे', '12 बजे'], 0), WIN]));
    const warns = JSON.parse(A(`JSON.stringify(sylLessonWarnings(${JSON.stringify(hourly.lesson)}).map(w => w.en))`));
    check('the teacher is warned when every clock question is on the hour (only the short hand is tested) — not a rejection',
      hourly.ok && warns.some(w => /on the hour/.test(w)) && !warns.some(w => /sentence to read/.test(w)), JSON.stringify([hourly.errors, warns]));
    const aimed = { ...ok.lesson, aims:[...ok.lesson.aims, { point:{ en:'The child can tell how long an activity took.', hi:'x' } }] };
    const gaps = JSON.parse(A(`JSON.stringify(sylAimGaps(${JSON.stringify(aimed)}).map(a => a.point.en))`));
    const gaps2 = JSON.parse(A(`JSON.stringify(sylAimGaps(${JSON.stringify({ ...ok.lesson, beats: ok.lesson.beats.slice(0, 4) })}).map(a => a.point.en))`));
    check('clock aims: "how long" is checked by two clocks, and flagged for the teacher when no question asks it',
      gaps.length === 0 && JSON.stringify(gaps2) === JSON.stringify([]) && JSON.parse(A(`JSON.stringify(sylAimGaps(${JSON.stringify({ ...ok.lesson, beats: ok.lesson.beats.slice(0, 4), aims:[{ point:{ en:'The child can tell how long an activity took.', hi:'x' } }] })}).length)`)) === 1, JSON.stringify([gaps, gaps2]));
    const exSrc = fs.readFileSync(path.join(root, 'api/syllabus.mjs'), 'utf8').replace(/\r\n/g, '\n').match(/An example of a clock lesson[^\n]*\n([^\n]+)\n/)[1];
    const ex = clean(JSON.parse(exSrc));
    check("the clock example in Gemini's prompt passes Takhti's own checker (so the example and the rules can't drift apart), its aims all checked",
      ex.ok && ex.checks.join() === 'shape,shape' && JSON.parse(A(`JSON.stringify(sylAimGaps(${JSON.stringify(ex.lesson)}))`)).length === 0, JSON.stringify(ex.errors));

    /* ---------- 5. the app ---------- */
    A(`S.game = S.game || 'cricket'; S.age = 8; S.online = false; go('lessons')`);
    const id = A(`lessonBank().find(l => l.concept === 'timepassed').id`);
    A(`startLesson('${id}')`);
    for(let i = 0; i < 50 && !A(`!!S.lesson`); i++) await wait(10);
    A(`S.lesson.i = 1; render()`);
    check('a teaching pair of clocks is drawn, and Munni says how long it took', !!screen().querySelector('.lesart svg.clock') && /That is \d+ minutes/.test(screen().textContent), screen().textContent.slice(0, 300));
    A(`S.lesson.i = 3; render()`);
    check('while the question is asked, its clocks stay on screen', !!screen().querySelector('.lesart svg.clock') && /How many minutes passed/.test(screen().textContent), screen().innerHTML.slice(0, 300));
    const tg = A(`JSON.stringify(askTarget())`);
    check('Ask Munni on it: how to read the clocks (jumps of five), and the two choices', /jumps of five/.test(tg) && /\bor\b/.test(tg), tg.slice(0, 400));
    const n0 = A(`(S.skillHistory.time3 || { n:0 }).n`);
    A(`lesAnswer(S.lesson.data.beats[3].correct)`);
    check("the answer counts for the lesson's skill (time passed → time3)", A(`(S.skillHistory.time3 || { n:0 }).n`) === n0 + 1, A(`JSON.stringify(S.skillHistory)`));
    A(`endLesson()`);
    A(`S.lang = 'hi'`);
    const hiArt = A(`clockArt({ t:'clocks', from:{ h:2, m:0 }, to:{ h:2, m:30 } })`);
    check('in Hindi the clocks are labelled शुरू and अंत', /शुरू/.test(hiArt) && /अंत/.test(hiArt), hiArt.slice(-200));
    A(`S.lang = 'en'`);
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  srv.close(); win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
