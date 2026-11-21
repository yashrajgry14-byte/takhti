/* ==================================================================
   THIS WEEK'S SCHOOL LESSONS, THIS CHILD'S WAY (core/planner.js)

   1. The plan, in a vm with the real content and core files: one school
      shapes lesson the teacher approved, and children it is planned for —
        · two children whose own records say different ways work for
          them get two different paths to the same approved aims (the
          buildathon demo: book in → aims approved → taught two ways);
        · a child who already knows it shows it and teaches Appu;
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
// the mind samples (Thompson): a seeded random makes every run the same run
vm.runInContext(`var __seed = 7; mindRand = () => (__seed = (__seed * 16807) % 2147483647) / 2147483647;`, ctx);
const V = src => JSON.parse(vm.runInContext(`JSON.stringify(${src})`, ctx));
vm.runInContext(`S.age = 8; var LES = sylClean(${JSON.stringify(CIRCLE)}, { band: 'developing' }).lesson;
  var kid = (extra) => Object.assign(JSON.parse(JSON.stringify(S)), { age: 8, doneLessons: [], cards: [], mind: undefined, twin: undefined, teach: undefined }, extra || {});
  var steps = p => p.steps.map(s => s.k + (s.k === 'gap' ? ':' + s.skill : ''));`, ctx);
check('the approved school lesson is a shapes lesson with its aims (the topic the mind now tracks as "shape")',
  V(`[LES.school, LES.skillId, LES.aims.length, mindDomain('shapes2d'), mindDomain('angles'), mindDomain('perimeter'), Object.keys(WAYS.shape)]`).join() === 'true,shapes2d,1,shape,shape,shape,show,story', V(`LES`));

// two children: their own records say different ways have worked on shapes
vm.runInContext(`
  var asha = kid({ mind: { v: 1, arms: { angles: { show: { a: 12, b: 0 }, story: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
  var kabir = kid({ mind: { v: 1, arms: { angles: { show: { a: 0, b: 12 }, story: { a: 12, b: 0 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
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
check('a child the twin says already knows it: no teaching — show it in the school\'s lesson, then teach Appu',
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
check('…and after teaching Appu, the path is complete', V(`pa3.next === null && pa3.steps.every(s => s.done)`), V(`pa3`));

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

// maths: the Picture Hut's cartoon, or straight into the school's story
const SUB = { title:{ en:'Mangoes left', hi:'बचे हुए आम' }, sub:{ en:'Take away with a bar', hi:'पट्टी से घटाना' }, ic:'🥭', skill:'sub2', source:'Chapter 4',
  aims:[{ short:{ en:'Part from a whole', hi:'पूरे में से हिस्सा' }, point:{ en:'The child can take a part away from a whole up to 100.', hi:'बच्चा 100 तक के पूरे में से हिस्सा घटा सकता है।' },
          forget:{ en:'Ravi had 45 mangoes and gave some away. I forgot how to find what is left!', hi:'रवि के पास 45 आम थे, कुछ दे दिए। बचे हुए कैसे निकालूँ, मैं भूल गई!' },
          hints:[{ en:'Is the pile getting bigger or smaller?', hi:'ढेर बड़ा हो रहा है या छोटा?' }, { en:'Which number is the whole?', hi:'पूरा कौन सी संख्या है?' }],
          ideas:[{ en:'take the part away from the whole', hi:'पूरे में से हिस्सा घटाओ', words:['take away','subtract','minus','ghatao','घटा','घटाओ'] }] }],
  beats:[{ t:'intro', say:{ en:'Ravi had 45 mangoes.', hi:'रवि के पास 45 आम थे।' } }, { t:'bar', a:45, b:20, say:{ en:'He gave 20 to his friends.', hi:'उसने 20 आम दोस्तों को दिए।' } },
         { t:'ask', q:{ en:'How many are left?', hi:'कितने आम बचे?' }, opts:['25','65'], hiOpts:['25','65'], correct:0, why:{ en:'Children add instead of taking away.', hi:'बच्चे घटाने की जगह जोड़ देते हैं।' } },
         { t:'win', say:{ en:'Take the part away from the whole.', hi:'पूरे में से हिस्सा घटाओ।' } }] };
vm.runInContext(`var MLES = sylClean(${JSON.stringify(SUB)}, { band: 'developing' }).lesson;
  var toon = kid({ mind: { v: 1, arms: { carry: { cartoon: { a: 12, b: 0 }, story: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
  var tale = kid({ mind: { v: 1, arms: { carry: { cartoon: { a: 0, b: 12 }, story: { a: 12, b: 0 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
  var pt = planFor(MLES, toon), ps = planFor(MLES, tale);`, ctx);
check('maths: the same approved subtraction lesson — the cartoon first for the child cartoons work for, straight into the school\'s story for the other',
  V(`[MLES && MLES.skillId, planHasCartoon('sub2', toon), pt.way, steps(pt).join(' '), ps.way, steps(ps).join(' ')]`).join(' | ') === 'sub2 | true | cartoon | cartoon school teach | story | school teach', JSON.stringify(V(`[MLES && MLES.skillId, planHasCartoon('sub2', toon), pt.way, steps(pt), ps.way, steps(ps)]`)));
vm.runInContext(`mindTaught('sub2', 'cartoon', toon); var pt2 = planFor(MLES, toon);`, ctx);
check('…the cartoon step is done once it was watched (its round open), the school\'s lesson next — and that lesson, after the cartoon, is the check that labels nothing',
  V(`[pt2.steps[0].done, pt2.next.k, planMarkWay(MLES, 'sub2', toon), planMarkWay(MLES, 'sub2', tale)]`).join() === 'true,school,,story', JSON.stringify(V(`[pt2.steps, planMarkWay(MLES, 'sub2', toon), planMarkWay(MLES, 'sub2', tale)]`)));
vm.runInContext(`var skip = kid({ mind: JSON.parse(JSON.stringify(toon.mind)) }); skip.mind.pending = {}; skip.doneLessons.push(MLES.id); var pk2 = planFor(MLES, skip);`, ctx);
check('…a step skipped on the way doesn\'t come back: the school\'s lesson done first, next is Teach Appu, not the cartoon', V(`pk2.next && pk2.next.k`) === 'teach', V(`pk2`));

// harder or easier after the school's lesson, from how its first answers went
vm.runInContext(`
  var allRight = kid({ mind: JSON.parse(JSON.stringify(tale.mind)), doneLessons: [MLES.id], lessonScores: { [MLES.id]: { r: 2, a: 2 } } });
  var missed = kid({ mind: JSON.parse(JSON.stringify(tale.mind)), doneLessons: [MLES.id], lessonScores: { [MLES.id]: { r: 1, a: 2 } } });
  var little = kid({ age: 5, mind: JSON.parse(JSON.stringify(tale.mind)), doneLessons: [MLES.id], lessonScores: { [MLES.id]: { r: 2, a: 2 } } });
  var pr = planFor(MLES, allRight), pm = planFor(MLES, missed), pl = planFor(MLES, little);
  var mr = pr.steps.find(s => s.k === 'more'), mm = pm.steps.find(s => s.k === 'more'), ml = pl.steps.find(s => s.k === 'more');`, ctx);
check('every answer right first time → a harder step after the school\'s lesson: a take-away skill one up (it builds on two-digit taking away), before Teach Appu',
  V(`[steps(pr).join(' '), mr.up, SKILL_OPS[mr.skill], skillById(mr.skill).pre.includes('sub2'), pr.next.k]`).join(' | ') === 'school more teach | true | − | true | more', JSON.stringify(V(`[steps(pr), mr, pr.next]`)));
check('one missed → an easier step instead: a skill underneath (a prerequisite of two-digit taking away), said kindly, never "wrong"',
  V(`[mm.up, (skillById('sub2').pre || []).concat('sub2').includes(mm.skill), mm.label.en, mm.why.en, /wrong/i.test(JSON.stringify(mm))]`).join(' | ').startsWith('false | true | One more, a little easier'), JSON.stringify(V(`mm`)));
check('…both in Hindi too', /थोड़ा कठिन/.test(V(`mr.label.hi`)) && /थोड़ा आसान/.test(V(`mm.label.hi`)) && /[ऀ-ॿ]/.test(V(`mr.why.hi + mm.why.hi`)), JSON.stringify(V(`[mr.label, mm.label]`)));
check('a harder skill must be inside the child\'s band: a 5-year-old who got it all right gets no step a Class 3 skill would need (or one inside the band)',
  V(`!ml || skillById(ml.skill).g <= CARTOON_MAX_GRADE[bandForAge(5).id]`) === true, JSON.stringify(V(`ml || null`)));
check('…no score yet (the school\'s lesson not finished), a shapes lesson, or a two-operation skill → no such step',
  V(`[planFor(MLES, tale).steps.some(s => s.k === 'more'), planFor(LES, kid({ doneLessons: [LES.id], lessonScores: { [LES.id]: { r: 1, a: 1 } } })).steps.some(s => s.k === 'more'), planMoreSkill('bodmas', true, allRight)]`).join() === 'false,false,', '');
vm.runInContext(`allRight.lessonScores[MLES.id].x = 'y'; var pr2 = planFor(MLES, allRight);`, ctx);
check('…answered once, the step is done (read from what is kept) and Teach Appu is next; the teacher\'s path counts it as a step, within the server\'s six',
  V(`[pr2.steps.find(s => s.k === 'more').done, pr2.next.k, planPathOf(MLES, allRight).n <= 6, planPathOf(MLES, allRight).d]`).join() === 'true,teach,true,2', JSON.stringify(V(`[pr2.steps, planPathOf(MLES, allRight)]`)));

// reading: the way lives inside the school's lesson — how its passage is read
const RD = { title:{ en:"Meena's kite", hi:'मीना की पतंग' }, sub:{ en:'Read and answer', hi:'पढ़ो और जवाब दो' }, ic:'🪁', skill:'read5', source:'Lesson 6',
  aims:[{ short:{ en:'Find where', hi:'कहाँ, ढूँढो' }, point:{ en:'The child can find where something happens in a short story.', hi:'बच्चा छोटी कहानी में ढूँढ सकता है कि कुछ कहाँ होता है।' },
          forget:{ en:'I forgot where Meena flies her kite! How can I find out?', hi:'मैं भूल गई मीना पतंग कहाँ उड़ाती है! कैसे पता करूँ?' },
          hints:[{ en:'Where is the answer hiding — in your head, or somewhere you can look?', hi:'जवाब कहाँ छिपा है — दिमाग़ में, या कहीं जहाँ देख सकते हो?' }, { en:'Which part of it talks about a place?', hi:'कौन सा हिस्सा किसी जगह की बात करता है?' }],
          ideas:[{ en:'look back in the story for the sentence that says where', hi:'कहानी में वापस देखो, वह वाक्य जो जगह बताता है', words:['story','read again','look back','sentence','kahani','dekho','कहानी','पढ़','देखो','वाक्य'] }] }],
  beats:[{ t:'passage', art:'🪁', p:{ en:'Meena has a red kite. She flies it on the roof. The wind is strong today.', hi:'मीना के पास लाल पतंग है। वह छत पर उड़ाती है। आज हवा तेज़ है।' } },
         { t:'ask', q:{ en:'Where does Meena fly the kite?', hi:'मीना पतंग कहाँ उड़ाती है?' }, opts:['On the roof','In the park'], hiOpts:['छत पर','पार्क में'], correct:0 },
         { t:'win', say:{ en:'The answer was in the story.', hi:'जवाब कहानी में था।' } }] };
vm.runInContext(`var RLES = sylClean(${JSON.stringify(RD)}, { band: 'developing' }).lesson;
  var rk = w => kid({ mind: { v: 1, arms: { read4: Object.fromEntries(['model','chunks','solo'].map(x => [x, x === w ? { a: 12, b: 0 } : { a: 0, b: 12 }])) }, plan: {}, pending: {}, cool: {}, changes: [], school: {} } });
  var rm = planFor(RLES, rk('model')), rc = planFor(RLES, rk('chunks')), rs = planFor(RLES, rk('solo'));`, ctx);
check('reading: three children, the same approved passage, three ways — Munni reads it first / hard words in pieces / you read it first — inside the school\'s lesson',
  V(`[rm.way, rc.way, rs.way, steps(rm).join(' ')]`).join(' | ') === 'model | chunks | solo | school teach'
    && /munni reads it first/.test(V(`rm.steps[0].label.en`)) && /टुकड़ों/.test(V(`rc.steps[0].label.hi`)) && /you read it first/.test(V(`rs.steps[0].label.en`)), V(`[rm.steps[0], rc.steps[0], rs.steps[0]]`));
check('…and opening the school\'s reading lesson counts as that way for the mind', V(`[planMarkWay(RLES, 'read5', rk('model')), planMarkWay(RLES, 'read5', rk('chunks'))]`).join() === 'model,chunks', '');

// what travels to the teacher: the path, in ids and short codes only
check('a child\'s path for the teacher is short codes only — the way, knew-it, the gap underneath, steps done of how many — and two children differ',
  V(`[planPathOf(LES, asha), planPathOf(LES, kabir), planPathOf(RLES, rk('chunks'))]`).map(x => x.w + '/' + x.n + (x.d <= x.n ? '' : '!')).join(' | ')
    === 'show/3 | story/2 | chunks/2', JSON.stringify(V(`[planPathOf(LES, asha), planPathOf(LES, kabir), planPathOf(RLES, rk('chunks'))]`)));
check('…with nothing in it a child said, read or wrote (only the keys w, k, g, d, n)',
  V(`[planPathOf(LES, asha), planPathOf(RLES, rk('solo'))]`).every(x => Object.keys(x).every(k => ['w','k','g','d','n'].includes(k))), '');

/* ---------- 2. the app ---------- */
(async () => {
  const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
  const appServer = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => appServer.listen(0, '127.0.0.1', r));
  {
    const { syncCore } = await import(require('url').pathToFileURL(path.join(root, 'api/class-sync.mjs')).href);
    const blobs = new Map(), store = { get: async k => blobs.has(k) ? JSON.parse(blobs.get(k)) : null, setJSON: async (k, v) => { blobs.set(k, JSON.stringify(v)); } };
    const { authorizeClass } = await import(require('url').pathToFileURL(path.join(root, 'api/lib/class-auth.mjs')).href);
    const verifiedTeacher = authorizeClass({code:'PTH001'}, {active:true,role:'teacher',schoolId:'school-one',classes:['PTH001']});
    const verifiedGuardian = authorizeClass({code:'PTH001',children:{kid1:{}}}, {active:true,role:'guardian',schoolId:'school-one',children:[{code:'PTH001',id:'kid1',consent:true}]});
    await syncCore(store, { code:'PTH001', children:{} }, verifiedTeacher);
    await syncCore(store, { code:'PTH001', children:{ kid1:{ childName:'Asha', skillHistory:{}, at: 5, paths:{
      'sch-abc123': { w:'show', d:1, n:3 }, 'sch-def456': { w:'cartoon', k:1, g:'add2', d:9, n:4, said:'hello' },
      'sch-bad': { w:'whatever', d:0, n:2 }, 'not-a-lesson': { w:'story', d:0, n:2 }, 'sch-ghi789': { w:'story', g:'<b>', d:0, n:2 } } } } }, verifiedGuardian);
    const back = (await syncCore(store, { code:'PTH001', children:{} }, verifiedTeacher)).json;
    const p = back && back.children && back.children.kid1 && back.children.kid1.paths;
    check('the class sync server keeps a well-formed path and drops the rest — a non-lesson id, a bad skill, any other field; an unknown way becomes none, steps over the total are capped',
      !!p && JSON.stringify(p['sch-abc123']) === '{"w":"show","d":1,"n":3}' && !p['not-a-lesson'] && p['sch-bad'].w === '' && !p['sch-ghi789'].g
        && !p['sch-def456'].said && p['sch-def456'].d === 4 && p['sch-def456'].g === 'add2', JSON.stringify(back));
  }
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
       S.mind = { v: 1, arms: { angles: { show: { a: 12, b: 0 }, story: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} }; go('lessons')`);
    await wait(20);
    const steps = [...win.document.querySelectorAll('.planstep')].map(x => x.textContent.trim());
    check('the Story Fire shows this child\'s path under the school lesson — pictures first, the school\'s lesson, teach Appu — and why',
      steps.length === 3 && /Pictures first/.test(steps[0]) && /▶/.test(steps[0]) && /The school’s lesson/.test(steps[1]) && /Teach Appu/.test(steps[2]) && /Munni's plan: this has worked for you before/.test(screen()),
      JSON.stringify(steps) + ' ' + screen().slice(0, 300));
    E(`S.lang = 'hi'; render()`);
    check('…in Hindi too', /पहले चित्र/.test(screen()) && /स्कूल का पाठ/.test(screen()) && /अप्पू को सिखाओ/.test(screen()) && /मुन्नी की योजना/.test(screen()), screen().slice(0, 300));
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

    // reading: the school's passage, read this child's way
    E(`endLesson(); sylSave('CLS001', [sylClean(${JSON.stringify(RD)}, { band: 'developing' }).lesson]);
       S.mind = { v: 1, arms: { read4: { chunks: { a: 12, b: 0 }, model: { a: 0, b: 12 }, solo: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} }; go('lessons')`);
    await wait(20);
    check('the Story Fire names the reading way inside the school\'s lesson ("hard words in pieces")', /hard words in pieces/.test(screen()), screen().slice(0, 300));
    win.document.querySelector('.lescard[onclick^="planGo"]').click();
    for(let i = 0; i < 50 && !E(`!!S.lesson`); i++) await wait(10);
    check('…its passage shows the two hardest words in pieces, Munni says to say them first, and the mind counts it as "pieces"',
      E(`S.lesson && S.lesson.readWay`) === 'chunks' && /·/.test(win.document.querySelector('.planchunks') ? win.document.querySelector('.planchunks').textContent : '') && /hard words in pieces/.test(screen())
        && E(`S.mind.pending.read5 && S.mind.pending.read5.way`) === 'chunks', E(`JSON.stringify([S.lesson && S.lesson.readWay, S.mind.pending])`) + ' ' + screen().slice(0, 300));
    E(`endLesson(); S.mind = { v: 1, arms: { read4: { model: { a: 12, b: 0 }, chunks: { a: 0, b: 12 }, solo: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} }; go('lessons')`);
    await wait(20);
    win.document.querySelector('.lescard[onclick^="planGo"]').click();
    for(let i = 0; i < 50 && !E(`!!S.lesson`); i++) await wait(10);
    check('…for a child Munni-reads-first works for, Munni reads the passage itself aloud first',
      E(`S.lesson && S.lesson.readWay`) === 'model' && /Listen — I will read it first\. Meena has a red kite/.test(win.document.querySelector('.lescap').textContent), win.document.querySelector('.lescap') && win.document.querySelector('.lescap').textContent);
    // a point the child couldn't explain is taught again — the same passage, another reading way
    E(`(() => { const u = teachUnitFor(schoolLessons().find(l => l.id === S.lesson.id)); const s = teachBegin(u); s.items.forEach(x => { x.state = 'gap'; }); TEACH = { s, sum: teachFinish(s) }; })()`);
    const before = E(`JSON.stringify([S.lesson.id, S.mind.plan.read5 || null])`);
    E(`teachRemedy()`); await wait(20);
    check('"Let\'s learn it again" on a reading point: the same school lesson, read another way than Munni-reads-first — and the child\'s plan is left alone',
      E(`S.lesson && S.lesson.id`) === JSON.parse(before)[0] && ['chunks', 'solo'].includes(E(`S.lesson.readWay`)) && E(`S.mind.pending.read5 && S.mind.pending.read5.way`) === E(`S.lesson.readWay`)
        && E(`JSON.stringify(S.mind.plan.read5 || null)`) === JSON.stringify(JSON.parse(before)[1]), E(`JSON.stringify([S.lesson && S.lesson.readWay, S.mind.pending, S.mind.plan])`) + ' ' + before);
    // maths: the cartoon first
    E(`endLesson(); sylSave('CLS001', [sylClean(${JSON.stringify(SUB)}, { band: 'developing' }).lesson]);
       S.mind = { v: 1, arms: { carry: { cartoon: { a: 12, b: 0 }, story: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} }; go('lessons')`);
    await wait(20);
    check('maths: the Story Fire shows the cartoon first for a child cartoons work for', /The cartoon first/.test(screen()), screen().slice(0, 300));
    win.document.querySelector('.lescard[onclick^="planGo"]').click();
    await wait(30);
    check('…and the button opens that skill\'s cartoon in the Picture Hut', E(`S.screen`) === 'theater' && E(`S.activeVideo && S.activeVideo.data.skillId`) === 'sub2', E(`JSON.stringify([S.screen, S.activeVideo && S.activeVideo.data.skillId])`));
    // the school's lesson played, every answer right → the harder step, in Counting Stones
    E(`S.activeVideo = null; go('lessons'); startLesson(schoolLessons()[0].id)`);
    await wait(20);
    E(`(function(){ const les = S.lesson.data; for(let n = 0; n < 40 && S.lesson && S.lesson.i < les.beats.length - 1; n++){ const b = les.beats[S.lesson.i]; if(b.t === 'ask' && S.lesson.picked == null){ S.lesson.picked = b.correct; S.lesson.asked++; S.lesson.right++; } S.lesson.i++; S.lesson.picked = null; } lesNext(); })()`);
    const sid = E(`schoolLessons()[0].id`);
    check('a school lesson\'s first finish is kept as its score — its own question and the "your turn" one', E(`JSON.stringify(S.lessonScores[${JSON.stringify(sid)}])`) === '{"r":2,"a":2}', E(`JSON.stringify(S.lessonScores)`));
    const turn = JSON.parse(E(`JSON.stringify((function(){ const les = schoolLessons()[0], t = lesYourTurn(les), b = t.beats.find(x => x.turn); const x = explainLessonBeat(t, t.beats.indexOf(b));
      return { n0: les.beats.filter(x => x.t === 'ask').length, n1: t.beats.filter(x => x.t === 'ask').length, last: t.beats[t.beats.length - 1].t, b, sameId: t.id === les.id,
        stored: schoolLessons()[0].beats.length === les.beats.length, again: JSON.stringify(lesYourTurn(les)) === JSON.stringify(t), shapes: lesYourTurn(Object.assign({}, les, { skillId: 'shapes2d' })) === null ? 'x' : lesYourTurn(Object.assign({}, les, { skillId: 'shapes2d' })).beats.length === les.beats.length,
        steps: x && x.steps ? x.steps.length : 0, said: x ? JSON.stringify(x.steps) : '' }; })())`));
    const right = turn.b && Number(turn.b.opts[turn.b.correct]), sum = turn.b && turn.b.sum, val = sum && (sum.op === '−' ? sum.a - sum.b : sum.op === '+' ? sum.a + sum.b : NaN);
    check('a one-question school maths lesson gets a second, "your turn" question at play time: the same skill, new numbers, right by construction, the other answer a real mistake, before the ending',
      turn.n0 === 1 && turn.n1 === 2 && turn.last === 'win' && sum && sum.op === '−' && right === val && turn.b.opts.length === 2 && /Your turn/.test(turn.b.q.en) && /तुम्हारी बारी/.test(turn.b.q.hi), JSON.stringify(turn));
    check('…the approved lesson and its id are untouched, the same child gets the same question again, and a non-arithmetic lesson gets none',
      turn.sameId && turn.stored && turn.again && turn.shapes === true, JSON.stringify(turn));
    check('…Ask Munni explains the "your turn" sum itself (not the lesson\'s earlier picture), never saying its answer',
      turn.steps > 0 && !new RegExp('\\b' + val + '\\b').test(turn.said), turn.said);
    E(`endLesson(); go('lessons')`);
    await wait(20);
    check('…the Story Fire then shows "A harder one" on this child\'s path', /A harder one/.test(screen()), screen().slice(0, 400));
    win.document.querySelector('.lescard[onclick^="planGo"]').click();
    await wait(30);
    check('…its button opens Counting Stones on a take-away sum of the harder skill', E(`S.screen`) === 'math' && E(`S.ctx.p && S.ctx.p.op`) === '−' && E(`!!S.ctx.planMore`) === true, E(`JSON.stringify([S.screen, S.ctx])`));
    E(`answerMath(S.ctx.p.ans)`);
    check('…answering it marks the step done, and Teach Appu is next', E(`S.lessonScores[${JSON.stringify(sid)}].x`) === 'y' && E(`planFor(schoolLessons()[0]).next && planFor(schoolLessons()[0]).next.k`) === 'teach', E(`JSON.stringify([S.lessonScores, planFor(schoolLessons()[0]).steps])`));
    E(`S.lang = 'hi'; go('lessons')`); await wait(20);
    check('…in Hindi too', /थोड़ा कठिन/.test(screen()), screen().slice(0, 300));
    E(`S.lang = 'en'`);
    // the teacher sees which path each child is taking
    E(`endLesson(); sylSave('CLS001', [sylClean(${JSON.stringify(CIRCLE)}, { band: 'developing' }).lesson]);
       S.mind = { v: 1, arms: { angles: { show: { a: 12, b: 0 }, story: { a: 0, b: 12 } } }, plan: {}, pending: {}, cool: {}, changes: [], school: {} };
       mirrorToClassNow(S)`);
    const mine = E(`JSON.stringify(readClassShared('CLS001')[S.id])`);
    check('this phone\'s class mirror carries the child\'s path for the school lesson (the way only)', /"paths":\{"sch-[a-z0-9]+":\{"w":"show","d":\d,"n":3\}\}/.test(mine), mine);
    E(`(() => { const id = schoolLessons()[0].id, all = readClassShared('CLS001');
        all.kabir1 = { childName: 'Kabir', skillHistory: {}, paths: { [id]: { w: 'story', d: 1, n: 2 } }, at: Date.now() };
        all.meena1 = { childName: 'Meena', skillHistory: {}, paths: { [id]: { w: '', g: 'add2', d: 0, n: 3 } }, at: Date.now() };
        all.ravi1 = { childName: 'Ravi', skillHistory: {}, paths: { [id]: { w: '', k: 1, d: 0, n: 2 } }, at: Date.now() };
        localStorage.setItem(classMirrorKey('CLS001'), JSON.stringify(all)); })();
        CLASS_AUTH.token='test-approved-session'; CLASS_AUTH.expires=Date.now()+600000;
        CLASS_AUTH.role='teacher'; CLASS_AUTH.classes=['CLS001']; CLASS_AUTH.email='teacher@example.test';
        S.ctx.tcode = 'CLS001'; go('teacher')`);
    await wait(20);
    const rows = [...win.document.querySelectorAll('.planrow')].map(x => x.textContent.trim());
    check('the teacher view groups the class by path for this week\'s lesson: pictures first (Asha), straight into the school\'s lesson (Kabir), something underneath first (Meena), already knew it (Ravi)',
      /HOW EACH CHILD IS TAKING THIS WEEK/i.test(screen()) && rows.length === 4
        && rows.some(r => /Pictures first: Asha/.test(r)) && rows.some(r => /Straight into the school’s lesson: Kabir 1\/2/.test(r))
        && rows.some(r => /Something underneath first: Two-digit addition: Meena 0\/3/.test(r)) && rows.some(r => /Already knew it.*Ravi/.test(r)), JSON.stringify(rows));
    E(`S.lang = 'hi'; render()`);
    check('…in Hindi too', /हर बच्चे का अपना रास्ता/.test(screen()) && /पहले चित्र: Asha/.test(screen()) && /पहले से आता था/.test(screen()), screen().slice(0, 400));
    E(`S.lang = 'en'; render()`);
    E(`go('parent')`); await wait(10);
    check('the parent\'s sync notice says the way each school lesson is taught goes with the sync', /the way each school lesson is being taught/.test(E(`(typeof syncNoticeHTML === 'function' ? '' : '') + document.body.innerHTML`)) || /the way each school lesson is being taught/.test(E(`VIEWS.parent ? VIEWS.parent() : ''`)), '');
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  appServer.close();
  win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
