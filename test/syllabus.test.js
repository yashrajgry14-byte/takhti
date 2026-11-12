/* ==================================================================
   THE SCHOOL'S OWN SYLLABUS → THIS WEEK'S LESSONS (Gemini)

   1. The server (api/syllabus.mjs) against a stand-in Gemini: the key on
      the server only, the chapter (text or PDF) and the band's rules in
      the request, the lesson schema asked for, an honest 503 with no
      key, the school key, a limit per address, files refused that
      aren't a PDF or photo, the repair round carrying the checker's
      reasons — and the same thing through the voice server.
   2. The checker on the phone (sylClean + validateLesson): a good maths
      and a good reading lesson pass; a wrong sum, an answer not in the
      passage, markup, a number over the band's ceiling, a beat Takhti
      can't draw, an unequal share, Hindi not in Devanagari all fail with
      a reason; checking is idempotent; a lesson edited on the way gets a
      different id and is not shown.
   3. The app, through the real index.html: the teacher drafts from a
      chapter, a failure is sent back once and fixed, one stays "not
      used"; approve; offline is honest; the child on this phone finds
      "From your school" at the Story Fire, plays it, the answer counts
      for its skill, and the approved words are never rewritten.
   4. The class sync carries approved lessons from the teacher's phone
      only, to every phone in the class.
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
let failures = 0, passes = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- lessons a stand-in Gemini sends ---------- */
const MATH = { title:{ en:'Sharing mangoes', hi:'आम बाँटना' }, sub:{ en:'Take away with a bar', hi:'पट्टी से घटाना' }, ic:'🥭', skill:'sub2', source:'Chapter 4, page 31',
  aims:[{ en:'The child can take a part away from a whole up to 100.', hi:'बच्चा 100 तक के पूरे में से हिस्सा घटा सकता है।' },
        { en:'The child can use a bar to find the part that is left.', hi:'बच्चा पट्टी से बचा हुआ हिस्सा ढूँढ सकता है।' }],
  beats:[ { t:'intro', say:{ en:'Ravi had 45 mangoes.', hi:'रवि के पास 45 आम थे।' } },
          { t:'bar', a:45, b:20, say:{ en:'He gave 20 to his friends.', hi:'उसने 20 आम दोस्तों को दिए।' } },
          { t:'ask', q:{ en:'How many are left?', hi:'कितने आम बचे?' }, opts:['25','65'], hiOpts:['25','65'], correct:0,
            why:{ en:'Children add instead of taking away when they see two numbers.', hi:'दो संख्याएँ देखकर बच्चे घटाने की जगह जोड़ देते हैं।' } },
          { t:'win', say:{ en:'Take the part away from the whole.', hi:'पूरे में से हिस्सा घटाओ।' } } ] };
const READ = { title:{ en:"Meena's kite", hi:'मीना की पतंग' }, sub:{ en:'Read and answer', hi:'पढ़ो और जवाब दो' }, ic:'🪁', skill:'read5', source:'Lesson 6',
  aims:[{ en:'The child can find where something happens in a short story.', hi:'बच्चा छोटी कहानी में ढूँढ सकता है कि कुछ कहाँ होता है।' }],
  beats:[ { t:'passage', art:'🪁', p:{ en:'Meena has a red kite. She flies it on the roof. The wind is strong today.', hi:'मीना के पास लाल पतंग है। वह छत पर उड़ाती है। आज हवा तेज़ है।' } },
          { t:'ask', q:{ en:'Where does Meena fly the kite?', hi:'मीना पतंग कहाँ उड़ाती है?' }, opts:['On the roof','In the park'], hiOpts:['छत पर','पार्क में'], correct:0 },
          { t:'win', say:{ en:'The answer was in the story.', hi:'जवाब कहानी में था।' } } ] };
const clone = o => JSON.parse(JSON.stringify(o));
const WRONG_SUM = (() => { const x = clone(MATH); x.title = { en:'Mangoes again', hi:'फिर से आम' }; x.beats[2].opts = ['35','65']; x.beats[2].hiOpts = ['35','65']; return x; })();
const NOT_IN_TEXT = (() => { const x = clone(READ); x.title = { en:'The kite day', hi:'पतंग का दिन' }; x.beats[1].opts = ['At school','In the park']; x.beats[1].hiOpts = ['स्कूल में','पार्क में']; return x; })();

(async () => {
  /* ---------- 1. the server ---------- */
  const { draftCore } = await import(path.join(root, 'api/syllabus.mjs'));
  const calls = [];
  const gemini = reply => async (url, o) => {
    const body = JSON.parse(o.body);
    calls.push({ url, headers: o.headers, body });
    const r = typeof reply === 'function' ? reply(body) : reply;
    return { ok: true, status: 200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify(r) }] } }] }) };
  };
  const env = { GEMINI_API_KEY: 'gk-secret', GEMINI_MODEL: 'gemini-test' };
  const rules = { band:'developing', ages:[7,8], maxNumber:100, sayWords:18, read:'developing' };
  const pdf = Buffer.from('%PDF-1.4 ' + 'x'.repeat(400)).toString('base64');
  const r1 = await draftCore({ mode:'draft', chapter:{ file: pdf, mime:'application/pdf' }, rules, count: 2, skills:[{ id:'sub2', en:'Two-digit subtraction' }], note:'borrowing' }, env, '1.1.1.1',
    gemini({ chapter:'Subtraction', lessons:[MATH, READ, MATH] }));
  const c1 = calls[0];
  check('a chapter (PDF) goes to Gemini with the key in a header on the server only, the model named, and drafts come back (no more than asked)',
    r1.status === 200 && r1.json.lessons.length === 2 && r1.json.model === 'gemini-test' && c1.headers['x-goog-api-key'] === 'gk-secret' && /models\/gemini-test:generateContent/.test(c1.url)
      && !JSON.stringify(c1.body).includes('gk-secret') && c1.body.contents[0].parts[0].inline_data.mime_type === 'application/pdf', JSON.stringify(r1).slice(0, 300));
  const sys = c1.body.systemInstruction.parts[0].text;
  check("…with Takhti's lesson schema and the band's own rules: the number ceiling, the word limit, the arithmetic rule, both languages, the skills, the teacher's note",
    JSON.stringify(c1.body.generationConfig).includes('"beats"') && /at most 100/.test(sys) && /at most 18 words/.test(sys) && /bar → a−b/.test(sys) && /Devanagari/.test(sys) && /sub2 \(Two-digit subtraction\)/.test(sys) && /borrowing/.test(sys), sys.slice(0, 300));
  calls.length = 0;
  const old = async (url, o) => { const b = JSON.parse(o.body); calls.push(b); return b.generationConfig.responseFormat
    ? { ok:false, status:400, json: async () => ({ error:{ message:'Unknown name "responseFormat"' } }) }
    : { ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ lessons:[MATH] }) }] } }] }) }; };
  const r2 = await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, env, '1.1.1.2', old);
  check('an API that only knows the older structured-output fields still works (one retry)', r2.status === 200 && calls.length === 2 && !!calls[1].generationConfig.responseJsonSchema, JSON.stringify(r2).slice(0, 200));
  check('no Gemini key on the server: an honest 503', (await draftCore({ chapter:{ text:'x'.repeat(50) }, rules }, {}, '1.1.1.3', gemini({ lessons:[] }))).status === 503, '');
  check('a school key, when the server sets one, is required', (await draftCore({ chapter:{ text:'x'.repeat(50) }, rules }, { ...env, TAKHTI_SYLLABUS_KEY:'school-1' }, '1.1.1.4', gemini({ lessons:[] }))).status === 403
    && (await draftCore({ chapter:{ text:'x'.repeat(50) }, rules, schoolKey:'school-1' }, { ...env, TAKHTI_SYLLABUS_KEY:'school-1' }, '1.1.1.4', gemini({ lessons:[] }))).status === 200, '');
  check('only a PDF or a photo of the chapter is accepted', (await draftCore({ chapter:{ file: pdf, mime:'text/html' }, rules }, env, '1.1.1.5', gemini({ lessons:[] }))).status === 400
    && (await draftCore({ chapter:{}, rules }, env, '1.1.1.5', gemini({ lessons:[] }))).status === 400, '');
  const lim = { ...env, TAKHTI_SYLLABUS_PER_HOUR: 2 };
  for(let i = 0; i < 2; i++) await draftCore({ chapter:{ text:'x'.repeat(50) }, rules }, lim, '7.7.7.7', gemini({ lessons:[] }));
  check('a limit per address', (await draftCore({ chapter:{ text:'x'.repeat(50) }, rules }, lim, '7.7.7.7', gemini({ lessons:[] }))).status === 429, '');
  calls.length = 0;
  const r3 = await draftCore({ mode:'repair', repair:[{ lesson: WRONG_SUM, errors:['beat 2: marked 35 right, but the picture before it shows 25'] }], rules }, env, '1.1.1.6', gemini({ lessons:[MATH] }));
  check("the repair round sends the lesson back with the checker's own reasons, and returns the fix", r3.status === 200 && r3.json.lessons.length === 1
    && JSON.stringify(calls[0].body.contents).includes('shows 25') && /rejected by Takhti's checker/.test(calls[0].body.systemInstruction.parts[0].text), JSON.stringify(r3).slice(0, 200));
  check('the model is told it only drafts from THIS chapter (nothing from outside it)', /nothing from outside it/.test(sys), '');
  check('…to start every lesson with aims the teacher can approve, each one taught and checked, a note on why children pick the wrong answer, and never गुणा for "by"',
    /AIMS/.test(sys) && /Every aim is taught in the beats AND checked by a question/.test(sys) && /why/.test(sys) && /गुणा/.test(sys) && c1.body.generationConfig && JSON.stringify(c1.body.generationConfig).includes('"aims"'), sys.slice(0, 200));

  // the voice server hosts the same function (no serverless time limit)
  const { createServer } = require('../voice/server.js');
  process.env.TAKHTI_DATA_DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'takhti-syl-'));
  const { server: vs } = createServer({ env, fetch: gemini({ chapter:'Kites', lessons:[READ] }), toolToken:'t'.repeat(24), webhookKey:'w'.repeat(24), adminKey:'a'.repeat(24) });
  await new Promise(r => vs.listen(0, '127.0.0.1', r));
  const vr = await fetch(`http://127.0.0.1:${vs.address().port}/syllabus`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ chapter:{ text:'Lesson 6. '.repeat(10) }, rules }) });
  const vj = await vr.json();
  check('the voice server answers POST /syllabus the same way (CORS for the app)', vr.status === 200 && vj.lessons.length === 1 && vr.headers.get('access-control-allow-origin') === '*', JSON.stringify(vj).slice(0, 200));
  vs.close();

  /* ---------- 4 (server half). the class sync carries the lessons ---------- */
  const { syncCore } = await import(path.join(root, 'api/class-sync.mjs'));
  const mem = new Map(), store = { get: async k => mem.get(k) || null, setJSON: async (k, v) => mem.set(k, JSON.parse(JSON.stringify(v))) };
  const pack = { items:[{ id:'sch-abc12', band:'developing', beats:[{ t:'intro' }] }], at: 1000 };
  await syncCore(store, { code:'CLS001', teacherKey:'k'.repeat(32), lessons: pack });
  const kid = await syncCore(store, { code:'CLS001', children:{} });
  check('the class sync: lessons set by the teacher\'s phone reach a child\'s phone', kid.json.lessons && kid.json.lessons.items[0].id === 'sch-abc12', JSON.stringify(kid.json));
  await syncCore(store, { code:'CLS001', lessons:{ items:[{ id:'sch-evil1', beats:[] }], at: 5000 } });
  check("…and a phone without the teacher's key can't set them", (await syncCore(store, { code:'CLS001' })).json.lessons.items[0].id === 'sch-abc12', '');
  await syncCore(store, { code:'CLS001', teacherKey:'k'.repeat(32), lessons:{ items:[{ id:'<script>', beats:[] }], at: 6000 } });
  check('…only lesson-shaped items are kept (ids, beat counts, size)', (await syncCore(store, { code:'CLS001' })).json.lessons.items.length === 0, '');

  /* ---------- 2 & 3. the phone ---------- */
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
  const appServer = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => appServer.listen(0, '127.0.0.1', r));
  const vc = new VirtualConsole(), jsErrors = [], sent = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts:'dangerously', resources:'usable', pretendToBeVisual: true,
    beforeParse(win){
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
      win.navigator.vibrate = () => {};
      win.HTMLMediaElement.prototype.play = function(){ setTimeout(() => this.onended && this.onended(), 0); return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function(){};
      win.fetch = (url, o) => {
        const u = String(url), body = o && o.body ? JSON.parse(o.body) : null;
        sent.push({ url: u, body });
        if(u === '/api/syllabus'){
          const r = body.mode === 'repair' ? { lessons:[MATH, NOT_IN_TEXT] }
                                           : { chapter:'Chapter 4: Subtraction', lessons:[MATH, READ, WRONG_SUM, NOT_IN_TEXT] };
          if(body.mode === 'repair') r.lessons[0] = { ...clone(MATH), title:{ en:'Mangoes again', hi:'फिर से आम' } };
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...r, model:'gemini-test' }) });
        }
        return Promise.reject(new Error('offline'));
      };
    } });
  const win = dom.window, E = c => win.eval(c), screen = () => win.document.querySelector('#screen').textContent;
  await new Promise(r => win.addEventListener('load', r));
  E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
  [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][5].click(); win.document.querySelector('.ob-go').click();
  E(`S.game = S.game || 'cricket'; S.name = 'Jai'; S.age = 7; S.classCode = 'CLS001'; go('map')`);
  try{
    // 2. the checker
    const clean = (x, band) => JSON.parse(E(`JSON.stringify(sylClean(${JSON.stringify(x)}, { band: '${band || 'developing'}', skills: sylSkills(sylClass('c2')) }))`));
    const m = clean(MATH), rd = clean(READ);
    check('a good maths lesson passes — its answer checked by the arithmetic — and keeps its skill', m.ok && m.checks[0] === 'sum' && m.lesson.skillId === 'sub2' && m.lesson.school && /^sch-/.test(m.lesson.id), JSON.stringify(m.errors));
    check('a good reading lesson passes — its answer found in the passage', rd.ok && rd.checks[0] === 'text' && rd.lesson.subject === 'read', JSON.stringify(rd.errors));
    const bad = (name, x, re, band) => { const r = clean(x, band); check(name, !r.ok && r.errors.some(e => re.test(e)), JSON.stringify(r.errors)); };
    bad('a wrong sum is rejected, with why', WRONG_SUM, /marked 35 right, but the picture before it shows 25/);
    bad('an answer that is not in the passage is rejected', NOT_IN_TEXT, /isn't in the passage/);
    bad('markup in any text is rejected', (() => { const x = clone(MATH); x.title.en = '<img src=x onerror=alert(1)>'; return x; })(), /markup/);
    bad("a number over the age band's ceiling is rejected (3–4 year olds: 10)", (() => { const x = clone(MATH); x.beats[1] = { t:'count', n:15 }; x.beats[2].opts = ['15','14']; x.beats[2].hiOpts = ['15','14']; return x; })(), /ceiling of 10/, 'pre');
    bad("a beat Takhti can't draw is rejected", (() => { const x = clone(MATH); x.beats.splice(1, 0, { t:'video' }); return x; })(), /can't show a "video" beat/);
    bad('an unequal share is rejected', (() => { const x = clone(MATH); x.beats[1] = { t:'share', a:25, b:4 }; return x; })(), /doesn't share equally/);
    bad("Hindi that isn't in Devanagari is rejected", (() => { const x = clone(READ); x.title.hi = 'Meena ki patang'; return x; })(), /Devanagari/);
    bad('a lesson without aims is rejected — the aims are what the teacher approves', (() => { const x = clone(MATH); delete x.aims; return x; })(), /needs its aims/);
    bad('an answer Munni has just said is rejected ("20 left… how many are left?")', (() => { const x = clone(MATH); x.beats[1].say = { en:'He gave 20 away, so 25 are left.', hi:'उसने 20 दे दिए, तो 25 बचे।' }; return x; })(), /say the answer "25"/);
    bad('…in a reading lesson too (the narration, not the passage)', (() => { const x = clone(READ); x.beats.splice(1, 0, { t:'intro', say:{ en:'Meena flies her kite on the roof.', hi:'मीना छत पर पतंग उड़ाती है।' } }); return x; })(), /say the answer "On the roof"/);
    bad('a maths question needs a number for its answer', (() => { const x = clone(MATH); x.beats[2].opts = ['twenty-five','65']; return x; })(), /must be a number/);
    const again = JSON.parse(E(`JSON.stringify(sylClean(sylClean(${JSON.stringify(MATH)}, { band:'developing' }).lesson, { band:'developing' }))`));
    check('checking is idempotent: a checked lesson checks the same again (same id, still passes)', again.ok && again.lesson.id === m.lesson.id, JSON.stringify(again.errors));
    const sides = [MATH, READ, WRONG_SUM].map(x => clean(x).lesson.beats.find(b => b.t === 'ask').correct);
    check('the right answer is not always the first option', new Set(sides.concat(clean(NOT_IN_TEXT).lesson.beats.find(b => b.t === 'ask').correct)).size === 2 || sides.includes(1), JSON.stringify(sides));

    // 3. the teacher drafts
    E(`go('teacher'); S.ctx.tcode = 'CLS001'; S.online = true; render()`);
    check('the teacher view has the syllabus card, in both languages', /THIS WEEK'S LESSONS FROM YOUR SYLLABUS/.test(screen()) && /Choose a PDF or photo/.test(screen()), screen().slice(0, 300));
    E(`S.ctx.sylText = ${JSON.stringify('Chapter 4. Subtraction. Ravi had 45 mangoes and gave away 20. '.repeat(3))}; S.ctx.sylCls = 'c2'; S.ctx.sylCount = 4`);
    E(`sylGo()`);
    for(let i = 0; i < 200 && E(`!!S.ctx.sylBusy`); i++) await wait(10);
    const drafts = JSON.parse(E(`JSON.stringify(S.ctx.sylRes.drafts.map(d => ({ ok: d.ok, repaired: !!d.repaired, title: d.lesson.title && d.lesson.title.en, errors: d.repairErrors || d.errors })))`));
    const toServer = sent.filter(x => x.url === '/api/syllabus');
    check("the draft request carries the class's band rules and its skills — never a child's name or progress",
      toServer[0].body.rules.band === 'developing' && toServer[0].body.rules.maxNumber === 100 && toServer[0].body.skills.some(s => s.id === 'sub2') && !/Jai|skillHistory/.test(JSON.stringify(toServer[0].body)), JSON.stringify(toServer[0].body).slice(0, 300));
    check('four drafts: two pass at once; the wrong sum goes back to Gemini with its reason and comes back fixed; the ungrounded one stays "not used"',
      drafts.length === 4 && drafts.filter(d => d.ok).length === 3 && drafts[2].repaired && !drafts[3].ok && toServer.length === 2 && toServer[1].body.mode === 'repair'
        && toServer[1].body.repair.length === 2 && /shows 25/.test(toServer[1].body.repair[0].errors.join(' ')), JSON.stringify(drafts));
    const t = screen();
    check('the teacher reads every lesson: the lines, the right answer marked, how each answer was checked, and why one is not used',
      /Ravi had 45 mangoes/.test(t) && /✓ 25/.test(t) && /answer checked by the arithmetic/.test(t) && /answer found in the passage/.test(t) && /Not used — it didn't pass the check/.test(t) && /isn't in the passage/.test(t), t.slice(-1200));
    check("the teacher sees each lesson's aims to approve, and why children pick the wrong answer",
      /AIMS — THE CHILD WILL BE ABLE TO/.test(t) && /take a part away from a whole/.test(t) && /Approve these aims/.test(t) && /add instead of taking away/.test(t), t.slice(0, 600));
    check('nothing reaches a child before the teacher approves', E(`sylApproved('CLS001').length`) === 0 && E(`schoolLessons().length`) === 0, '');
    E(`sylApproveAll()`);
    check('approve: the checked lessons (only) are in the class', E(`sylApproved('CLS001').length`) === 3 && /APPROVED FOR THE CLASS/.test(screen()), E(`JSON.stringify(sylApproved('CLS001').map(l => l.title.en))`));
    E(`sylRemove(sylApproved('CLS001')[2].id)`);
    check('…and the teacher can remove one', E(`sylApproved('CLS001').length`) === 2, '');

    // offline is honest
    E(`S.online = false; S.ctx.sylRes = null`);
    const before = sent.length;
    E(`sylGo()`);
    check('offline: an honest sentence, nothing sent — and approved lessons keep working', sent.length === before && /needs a connection/.test(screen()), screen().slice(-300));

    // the child on this phone
    E(`S.ctx = {}; go('lessons')`);
    const story = screen();
    check('the child finds "From your school — this week" at the Story Fire', /FROM YOUR SCHOOL — THIS WEEK/.test(story) && /Sharing mangoes/.test(story) && /Meena's kite/.test(story), story.slice(0, 500));
    E(`S.lang = 'hi'; render()`);
    check('…in Hindi too', /तुम्हारे स्कूल से/.test(screen()) && /आम बाँटना/.test(screen()), '');
    E(`S.lang = 'en'; S.online = true`);
    const askCalls = sent.filter(x => x.url.includes('/api/ask')).length;
    const id = E(`schoolLessons().find(l => l.skillId === 'sub2').id`);
    E(`startLesson('${id}')`);
    for(let i = 0; i < 50 && !E(`!!S.lesson`); i++) await wait(10);
    for(let s = 0; s < 4; s++){ if(/add instead of taking away|AIMS/.test(screen())) break; E(`S.lesson.i = ${s}; render()`); }
    check("the teacher's notes and the aims are never on the child's screen", !/add instead of taking away|AIMS|बच्चे घटाने/.test(screen()), screen().slice(0, 300));
    check("it plays, and the teacher's approved words are never rewritten online", E(`S.lesson && S.lesson.data.school`) === true && sent.filter(x => x.url.includes('/api/ask')).length === askCalls, '');
    const k = E(`(() => { const i = S.lesson.data.beats.findIndex(b => b.t === 'ask'); S.lesson.i = i; render(); return S.lesson.data.beats[i].correct; })()`);
    const n0 = E(`(S.skillHistory.sub2 || { n:0 }).n`);
    E(`lesAnswer(${k})`);
    check("the child's answer counts as evidence for the lesson's skill", E(`S.skillHistory.sub2.n`) === n0 + 1 && E(`S.skillHistory.sub2.right`) >= 1, E(`JSON.stringify(S.skillHistory.sub2)`));
    E(`endLesson()`);

    // a lesson changed on the way is not shown
    E(`classMirrorUpdate('CLS001', all => { all._lessons.items[0].beats.find(b => b.t === 'ask').correct = 1 - all._lessons.items[0].beats.find(b => b.t === 'ask').correct; })`);
    check("a lesson edited on the way fails this phone's check and is not shown", E(`schoolLessons().length`) === 1, E(`JSON.stringify(schoolLessons().map(l => l.title.en))`));

    // the sync sends the teacher's lessons
    E(`S.syncKeys = { CLS001: 'k'.repeat(32) }; S.syncClasses = ['CLS001']`);
    Object.defineProperty(win.navigator, 'onLine', { value: true, configurable: true });
    E(`syncClass('CLS001')`);
    await wait(30);
    const sync = sent.filter(x => x.url.includes('class-sync')).pop();
    check("the class sync sends the teacher's approved lessons with the homework", sync && sync.body.lessons && sync.body.lessons.items.length === 2, JSON.stringify(sync && sync.body).slice(0, 200));
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  appServer.close();
  win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
