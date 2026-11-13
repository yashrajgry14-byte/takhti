/* ==================================================================
   THIS WEEK'S SCHOOL LESSONS, THIS CHILD'S WAY (core/planner.js)

   1. The plan, in a vm with the real content and core files: one school
      shapes lesson the teacher approved, and children it is planned for —
        · two children whose own records say different ways work for
          them get two different paths to the same approved aims (the
          buildathon demo: book in → aims approved → taught two ways);
        · a child who already knows it shows it and teaches Munni;
        · a gap underneath comes first, with a built-in lesson;
        · a step's status comes from what the child really did;
        · opening a lesson labels the way it teaches (pictures, the
          school's story, or — after pictures — the check, labelling
          nothing), and the answers after it settle that way.
   2. The app, through the real index.html: the Story Fire shows this
      child's path under the school lesson, in both languages, and the
      lesson's button starts the plan's next step.
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
let failures = 0, passes = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

/* the 13 Nov live run's kind of lesson: Maths Mela Class 3, the centre of a circle */
const AIM = { short:{ en:'Find the centre', hi:'केंद्र खोजो' }, point:{ en:'The child can find the centre of a circle by folding it.', hi:'बच्चा वृत्त को मोड़कर उसका केंद्र खोज सकता है।' },
  forget:{ en:'I forgot! How do I find the centre of a circle?', hi:'मैं भूल गई! वृत्त का केंद्र कैसे खोजूँ?' },
  hints:[{ en:'What could you do to a paper circle?', hi:'कागज़ के वृत्त के साथ तुम क्या कर सकते हो?' }, { en:'Do it twice. What do you see?', hi:'दो बार करो। क्या दिखता है?' }],
  ideas:[{ en:'fold it in half twice; the folds cross at the centre', hi:'दो बार आधा मोड़ो; मोड़ जहाँ मिलें वह केंद्र', words:['fold','half','cross','meet','मोड़','आधा','मिल'] }] };
const CIRCLE = { title:{ en:'Centre of a circle', hi:'वृत्त का केंद्र' }, sub:{ en:'Fold and look', hi:'मोड़ो और देखो' }, ic:'⭕', skill:'shapes2d', source:'Page 59', aims:[AIM],
  beats:[{ t:'intro', say:{ en:'Riya folds a round paper plate.', hi:'रिया गोल कागज़ की प्लेट मोड़ती है।' } }, { t:'figure', kind:'circle', folds:2 },
         { t:'figure', kind:'circle', folds:3, ask:'meet' },
         { t:'ask', q:{ en:'Where do the folds meet?', hi:'मोड़ कहाँ मिलते हैं?' }, opts:['Edge','Centre'], hiOpts:['किनारा','केंद्र'], correct:1,
           why:{ en:'Children point at the edge where the folds start.', hi:'बच्चे किनारे की ओर इशारा करते हैं जहाँ से मोड़ शुरू होते हैं।' } },
         { t:'win', say:{ en:'Folds cross in the middle.', hi:'मोड़ बीच में एक-दूसरे को काटते हैं।' } }] };

/* ---------- 1. the plan ---------- */
const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, JSON };
vm.createContext(ctx);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for(const f of [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1])
  .filter(f => /^src\/(config|state)\.js$|^src\/(content|core)\/|^src\/games\/game-core\.js$/.test(f)).filter(f => !/\/(speech|voice|sfx)\.js$/.test(f)))
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
ctx.log = () => {};
const V = src => JSON.parse(vm.runInContext(`JSON.stringify(${src})`, ctx));
vm.runInContext(`S.age = 8; var LES = sylClean(${JSON.stringify(CIRCLE)}, { band: 'developing' }).lesson;
  var kid = (extra) => Object.assign({ age: 8, doneLessons: [] }, extra || {});
  var steps = p => p.steps.map(s => s.k + (s.k === 'gap' ? ':' + s.skill : ''));`, ctx);
check('the approved school lesson is a shapes lesson with its aims (the topic the mind now tracks as "shape")',
  V(`[LES.school, LES.skillId, LES.aims.length, mindDomain('shapes2d'), mindDomain('angles'), mindDomain('perimeter'), Object.keys(WAYS.shape)]`).join() === 'true,shapes2d,1,shape,shape,shape,show,story', V(`LES`));

// two children: their own records say different ways have worked on shapes
vm.runInContext(`
  var asha = kid({ mind: { v: 1, arms: { angles: { show: { a: 5, b: 0 }, story: { a: 0, b: 4 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
  var kabir = kid({ mind: { v: 1, arms: { angles: { show: { a: 0, b: 4 }, story: { a: 5, b: 0 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
  var pa = planFor(LES, asha), pk = planFor(LES, kabir);`, ctx);
check('two children, the same approved aims, two different paths: pictures first for the child drawings work for; straight into the school\'s story for the other',
  V(`[pa.way, steps(pa).join(' '), pk.way, steps(pk).join(' ')]`).join(' | ') === 'show | show school teach | story | school teach', V(`[steps(pa), steps(pk)]`));
check('…each step says why, from that child\'s own record ("this has worked for you before"), in English and Hindi',
  V(`pa.steps[0].why.en`) === 'this has worked for you before' && /पहले तुम्हारे लिए काम आया/.test(V(`pa.steps[0].why.hi`)) && V(`pk.steps[0].why.en`) === 'this has worked for you before', V(`[pa.steps[0].why, pk.steps[0].why]`));
check('…the pictures are a real built-in drawn lesson for the same skill, never another school lesson',
  V(`(() => { const l = lessonBank().find(x => x.id === pa.steps[0].lesson); return !!l && !l.school && (l.skillId === 'shapes2d' || (CONCEPT_SKILLS[l.concept] || []).includes('shapes2d')); })()`), V(`pa.steps[0]`));
check('…and the plan holds: asked again, the same path (the mind keeps its choice per topic)',
  V(`[0,1,2,3,4].every(() => planFor(LES, asha).way === 'show' && planFor(LES, kabir).way === 'story')`), '');

// a child who already knows it
vm.runInContext(`var nia = kid(); twinOf(nia).k.shapes2d = { p: 0.95, n: 6, at: Date.now(), days: ['a','b','c'], peak: 0.95 }; var pn = planFor(LES, nia);`, ctx);
check('a child the twin says already knows it: no teaching — show it in the school\'s lesson, then teach Munni',
  V(`[pn.knows, steps(pn).join(' '), pn.steps[0].label.en]`).join(' | ') === 'true | school teach | Show you know it', V(`pn`));

// a gap underneath: perimeter needs add2, and this child's add2 hasn't settled
vm.runInContext(`var PER = sylClean(${JSON.stringify({ ...CIRCLE, title:{ en:'All the way round', hi:'चारों ओर' }, skill:'perimeter',
  aims:[{ ...AIM, short:{ en:'Add the sides', hi:'भुजाएँ जोड़ो' }, point:{ en:'The child can find the perimeter by adding every side.', hi:'बच्चा हर भुजा जोड़कर परिमाप निकाल सकता है।' },
          forget:{ en:'I forgot! How far is it all the way round?', hi:'मैं भूल गई! चारों ओर कितनी दूरी है?' }, ideas:[{ en:'add every side', hi:'हर भुजा जोड़ो', words:['add','plus','total','jodo','जोड़'] }] }],
  beats:[{ t:'intro', say:{ en:'Ravi walks round a garden.', hi:'रवि बगीचे के चारों ओर चलता है।' } }, { t:'figure', kind:'square', s:3 }, { t:'figure', kind:'rectangle', w:6, h:4, ask:'perimeter' },
         { t:'ask', q:{ en:'How far does he walk?', hi:'वह कितना चलता है?' }, opts:['20','10'], hiOpts:['20','10'], correct:0, why:{ en:'Children add only two sides.', hi:'बच्चे सिर्फ़ दो भुजाएँ जोड़ते हैं।' } },
         { t:'win', say:{ en:'Add every side.', hi:'हर भुजा जोड़ो।' } }] })}, { band: 'fluent' }).lesson;
  var dev = kid({ age: 10 }); twinOf(dev).k.add2 = { p: 0.2, n: 5, at: Date.now(), days: ['a'], peak: 0.3 }; var pd = planFor(PER, dev);`, ctx);
check('a gap underneath comes first: perimeter, for a child whose two-digit adding hasn\'t settled, starts with a built-in add2 lesson',
  V(`[PER && PER.skillId, steps(pd)[0], !!pd.steps[0].lesson, pd.steps[0].why.en]`).join(' | ') === 'perimeter | gap:add2 | true | it comes underneath this, and it hasn’t settled yet', V(`[PER && PER.skillId, pd]`));

// what the child really did decides each step's status
vm.runInContext(`asha.doneLessons.push(pa.steps[0].lesson); var pa2 = planFor(LES, asha);`, ctx);
check('a step is done when the child really did it: after the pictures, the next step is the school\'s lesson',
  V(`[pa2.steps[0].done, pa2.next.k]`).join() === 'true,school', V(`pa2`));
vm.runInContext(`asha.doneLessons.push(LES.id); teachOf(asha).units[LES.id] = { at: new Date().toISOString(), lessonId: LES.id, aims: {}, gaps: [] }; var pa3 = planFor(LES, asha);`, ctx);
check('…and after teaching Munni, the path is complete', V(`pa3.next === null && pa3.steps.every(s => s.done)`), V(`pa3`));

// labelling: how a lesson being opened counts as teaching
check('opening a lesson labels its way: a built-in shapes lesson is "pictures first"; the school lesson is "the school\'s story" — or, after pictures, the check that labels nothing',
  V(`[planMarkWay({ school: false }, 'shapes2d', asha), planMarkWay(LES, 'shapes2d', asha), planMarkWay(LES, 'shapes2d', kabir), planMarkWay(LES, 'add2', asha)]`).join() === 'show,,story,story',
  V(`[planMarkWay({ school: false }, 'shapes2d', asha), planMarkWay(LES, 'shapes2d', asha), planMarkWay(LES, 'shapes2d', kabir)]`));
vm.runInContext(`var zoe = kid(); mindTaught('shapes2d', 'show', zoe); mindAttempt('shapes2d', true, zoe); mindAttempt('shapes2d', true, zoe);`, ctx);
check('…and the answers the child gives on their own afterwards settle it: pictures stuck for this child, on this topic',
  V(`zoe.mind.arms.shapes2d.show.a`) === 1, V(`zoe.mind`));
vm.runInContext(`var raj = kid(); var w0 = planFor(LES, raj).way; for(let r = 0; r < 2; r++){ mindTaught('shapes2d', w0, raj); mindAttempt('shapes2d', false, raj); mindAttempt('shapes2d', false, raj); } var pr = planFor(LES, raj);`, ctx);
check('a way that doesn\'t stick twice is switched, with the reason — and the plan follows the switch',
  V(`[pr.way !== w0, raj.mind.changes.length >= 1, raj.mind.changes[0].from === w0]`).every(Boolean), V(`[w0, pr.way, raj.mind.changes]`));

/* ---------- 2. the app ---------- */
(async () => {
  const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
  const appServer = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => appServer.listen(0, '127.0.0.1', r));
  const vc = new VirtualConsole(), jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts:'dangerously', resources:'usable', pretendToBeVisual: true,
    beforeParse(win){
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
      win.navigator.vibrate = () => {};
      win.HTMLMediaElement.prototype.play = function(){ setTimeout(() => this.onended && this.onended(), 0); return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function(){};
      win.fetch = () => Promise.reject(new Error('offline'));
    } });
  const win = dom.window, E = c => win.eval(c), screen = () => win.document.querySelector('#screen').textContent;
  try{
    await new Promise(r => win.addEventListener('load', r));
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][5].click(); win.document.querySelector('.ob-go').click();
    E(`S.game = S.game || 'cricket'; S.name = 'Asha'; S.age = 8; S.classCode = 'CLS001'; go('map')`);
    E(`sylSave('CLS001', [sylClean(${JSON.stringify(CIRCLE)}, { band: 'developing' }).lesson]);
       S.mind = { v: 1, arms: { angles: { show: { a: 5, b: 0 }, story: { a: 0, b: 4 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} }; go('lessons')`);
    await wait(20);
    const steps = [...win.document.querySelectorAll('.planstep')].map(x => x.textContent.trim());
    check('the Story Fire shows this child\'s path under the school lesson — pictures first, the school\'s lesson, teach Munni — and why',
      steps.length === 3 && /Pictures first/.test(steps[0]) && /▶/.test(steps[0]) && /The school’s lesson/.test(steps[1]) && /Teach Munni/.test(steps[2]) && /Munni's plan: this has worked for you before/.test(screen()),
      JSON.stringify(steps) + ' ' + screen().slice(0, 300));
    E(`S.lang = 'hi'; render()`);
    check('…in Hindi too', /पहले चित्र/.test(screen()) && /स्कूल का पाठ/.test(screen()) && /मुन्नी को सिखाओ/.test(screen()) && /मुन्नी की योजना/.test(screen()), screen().slice(0, 300));
    E(`S.lang = 'en'; render()`);
    const want = E(`planFor(schoolLessons()[0]).next.lesson`);
    win.document.querySelector('.lescard[onclick^="planGo"]').click();
    for(let i = 0; i < 50 && !E(`!!S.lesson`); i++) await wait(10);
    check('the lesson\'s button starts the plan\'s next step — the built-in picture lesson — and counts it as "pictures first" for this topic',
      E(`S.lesson && S.lesson.id`) === want && !/^sch-/.test(want) && E(`S.mind.pending.shapes2d && S.mind.pending.shapes2d.way`) === 'show', E(`JSON.stringify([S.lesson && S.lesson.id, S.mind.pending])`) + ' want ' + want);
    E(`endLesson(); S.doneLessons = (S.doneLessons || []).concat('${want}'); go('lessons')`);
    await wait(20);
    win.document.querySelector('.lescard[onclick^="planGo"]').click();
    for(let i = 0; i < 50 && !(E(`S.lesson && S.lesson.id`) || '').startsWith('sch-'); i++) await wait(10);
    check('…then the school\'s lesson, which — after pictures — is the check and doesn\'t open a second way',
      /^sch-/.test(E(`S.lesson && S.lesson.id`)) && E(`S.mind.pending.shapes2d && S.mind.pending.shapes2d.way`) === 'show', E(`JSON.stringify([S.lesson && S.lesson.id, S.mind.pending])`));
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  appServer.close();
  win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
