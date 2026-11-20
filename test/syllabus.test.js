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
  // aims in the one format: the point the teacher approves, and Munni's lines for Teach Appu
  aims:[{ short:{ en:'Part from a whole', hi:'पूरे में से हिस्सा' }, point:{ en:'The child can take a part away from a whole up to 100.', hi:'बच्चा 100 तक के पूरे में से हिस्सा घटा सकता है।' },
          forget:{ en:'Ravi had 45 mangoes and gave some away. I forgot how to find what is left!', hi:'रवि के पास 45 आम थे, कुछ दे दिए। बचे हुए कैसे निकालूँ, मैं भूल गई!' },
          hints:[{ en:'Is the pile getting bigger or smaller?', hi:'ढेर बड़ा हो रहा है या छोटा?' }, { en:'Which number is the whole?', hi:'पूरा कौन सी संख्या है?' }],
          ideas:[{ en:'take the part away from the whole', hi:'पूरे में से हिस्सा घटाओ', words:['take away','subtract','minus','ghata','ghatao','घटा','घटाओ','कम करो'] }] },
        { short:{ en:'Use the bar', hi:'पट्टी से' }, point:{ en:'The child can use a bar to find the part that is left.', hi:'बच्चा पट्टी से बचा हुआ हिस्सा ढूँढ सकता है।' },
          forget:{ en:'There is a long bar and a short piece of it. What does the rest of the bar show?', hi:'एक लंबी पट्टी है और उसका एक छोटा टुकड़ा। बाकी पट्टी क्या बताती है?' },
          hints:[{ en:'The long bar is all the mangoes. What is the short piece?', hi:'लंबी पट्टी सारे आम हैं। छोटा टुकड़ा क्या है?' }, { en:'What happens to the mangoes Ravi kept?', hi:'जो आम रवि ने रखे, उनका क्या?' }],
          ideas:[{ en:'the rest of the bar is the part that is left', hi:'बाकी पट्टी बचा हुआ हिस्सा है', words:['left','left over','remaining','bache','bacha','बचे','बचा','बचा हुआ'] }] }],
  beats:[ { t:'intro', say:{ en:'Ravi had 45 mangoes.', hi:'रवि के पास 45 आम थे।' } },
          { t:'bar', a:45, b:20, say:{ en:'He gave 20 to his friends.', hi:'उसने 20 आम दोस्तों को दिए।' } },
          { t:'ask', q:{ en:'How many are left?', hi:'कितने आम बचे?' }, opts:['25','65'], hiOpts:['25','65'], correct:0,
            why:{ en:'Children add instead of taking away when they see two numbers.', hi:'दो संख्याएँ देखकर बच्चे घटाने की जगह जोड़ देते हैं।' } },
          { t:'win', say:{ en:'Take the part away from the whole.', hi:'पूरे में से हिस्सा घटाओ।' } } ] };
const READ = { title:{ en:"Meena's kite", hi:'मीना की पतंग' }, sub:{ en:'Read and answer', hi:'पढ़ो और जवाब दो' }, ic:'🪁', skill:'read5', source:'Lesson 6',
  aims:[{ short:{ en:'Find where', hi:'कहाँ, ढूँढो' }, point:{ en:'The child can find where something happens in a short story.', hi:'बच्चा छोटी कहानी में ढूँढ सकता है कि कुछ कहाँ होता है।' },
          forget:{ en:'I forgot where Meena flies her kite! How can I find out?', hi:'मैं भूल गई मीना पतंग कहाँ उड़ाती है! कैसे पता करूँ?' },
          hints:[{ en:'Where is the answer hiding — in your head, or somewhere you can look?', hi:'जवाब कहाँ छिपा है — दिमाग़ में, या कहीं जहाँ देख सकते हो?' }, { en:'Which part of it talks about a place?', hi:'कौन सा हिस्सा किसी जगह की बात करता है?' }],
          ideas:[{ en:'look back in the story for the sentence that says where', hi:'कहानी में वापस देखो, वह वाक्य जो जगह बताता है', words:['story','read again','look back','sentence','kahani','dekho','कहानी','पढ़','देखो','वाक्य'] }] }],
  beats:[ { t:'passage', art:'🪁', p:{ en:'Meena has a red kite. She flies it on the roof. The wind is strong today.', hi:'मीना के पास लाल पतंग है। वह छत पर उड़ाती है। आज हवा तेज़ है।' } },
          { t:'ask', q:{ en:'Where does Meena fly the kite?', hi:'मीना पतंग कहाँ उड़ाती है?' }, opts:['On the roof','In the park'], hiOpts:['छत पर','पार्क में'], correct:0 },
          { t:'win', say:{ en:'The answer was in the story.', hi:'जवाब कहानी में था।' } } ] };
const clone = o => JSON.parse(JSON.stringify(o));
const WRONG_SUM = (() => { const x = clone(MATH); x.title = { en:'Mangoes again', hi:'फिर से आम' }; x.beats[2].opts = ['35','65']; x.beats[2].hiOpts = ['35','65']; return x; })();
const NOT_IN_TEXT = (() => { const x = clone(READ); x.title = { en:'The kite day', hi:'पतंग का दिन' }; x.beats[1].opts = ['At school','In the park']; x.beats[1].hiOpts = ['स्कूल में','पार्क में']; return x; })();

(async () => {
  /* ---------- 1. the server ---------- */
  const { pathToFileURL } = require('url');                   // a bare C:\ path isn't an import specifier on Windows
  const { draftCore } = await import(pathToFileURL(path.join(root, 'api/syllabus.mjs')).href);
  const calls = [];
  const gemini = reply => async (url, o) => {
    const body = JSON.parse(o.body);
    calls.push({ url, headers: o.headers, body });
    const r = typeof reply === 'function' ? reply(body) : reply;
    return { ok: true, status: 200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify(r) }] } }] }) };
  };
  const env = { GEMINI_API_KEY: 'gk-secret', GEMINI_MODEL: 'gemini-test', TAKHTI_SYLLABUS_LOG: '0' };
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
  calls.length = 0;
  const busyThen = async (url, o) => { calls.push({ url }); return /gemini-test:/.test(url)
    ? { ok:false, status:503, json: async () => ({ error:{ message:'The model is overloaded' } }) }
    : { ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ lessons:[MATH] }) }] } }] }) }; };
  const rb = await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_RETRY_MS: 1, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.1.8', busyThen);
  check('Google says the model is busy (503): one more try, then the next model in the chain (a full Flash before the lite one) answers', rb.status === 200 && rb.json.model === 'gemini-3.8-flash'
    && calls.filter(c => /gemini-test:/.test(c.url)).length === 2 && /3\.8-flash:/.test(calls[calls.length - 1].url), JSON.stringify(calls.map(c => c.url.split('/').pop())));
  calls.length = 0;
  const hangs = (url, o) => { calls.push({ url }); return /gemini-test:/.test(url)
    ? new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('aborted'))))
    : Promise.resolve({ ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ lessons:[READ] }) }] } }] }) }); };
  // the eighth live run: both full Flash models hung, used 151 of 180 s, and flash-lite never had a fair turn
  const twoHang = (url, o) => { calls.push({ url }); return /gemini-test:|3\.8-flash:/.test(url)
    ? new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('aborted'))))
    : new Promise(ok => setTimeout(() => ok({ ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ lessons:[READ] }) }] } }] }) }), 1200)); };
  const r2h = await draftCore({ chapter:{ text:'Chapter 6. Kites. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_TIMEOUT_MS: 6000, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.1.6', twoHang);
  check("when the faster models hang, the last one still gets its reserved share (40% of the limit) and answers",
    r2h.status === 200 && r2h.json.model === 'gemini-3.5-flash-lite' && /^hung,(hung|no time),ok$/.test(r2h.json.tried.map(x => x.outcome).join()), JSON.stringify(r2h.json.tried || r2h.json));
  // the ninth run: a hanging 3.8-flash held the teacher 108 s; each model before the last is capped
  const tc = Date.now();
  const rcap = await draftCore({ chapter:{ text:'Chapter 6. Kites. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_TIMEOUT_MS: 20000, TAKHTI_SYLLABUS_MODEL_MS: 1500, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.1.4', twoHang);
  check('a model before the last is given at most TAKHTI_SYLLABUS_MODEL_MS (a minute by default), not 60% of the limit',
    rcap.status === 200 && rcap.json.tried[0].outcome === 'hung' && rcap.json.tried[0].ms < 2500 && Date.now() - tc < 8000, JSON.stringify(rcap.json.tried));
  const allHang = (url, o) => new Promise((_, no) => o.signal.addEventListener('abort', () => no(new Error('aborted'))));
  const rah = await draftCore({ chapter:{ text:'Chapter 6. Kites. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_TIMEOUT_MS: 4000, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.1.5', allHang);
  check("…and a try the whole limit cuts off is said so in the tried list (the eighth run's last try was invisible)",
    rah.status === 504 && rah.json.tried.length === 3 && rah.json.tried[2].outcome === 'cut', JSON.stringify(rah.json.tried));
  calls.length = 0;
  const t0 = Date.now();
  const rh = await draftCore({ chapter:{ text:'Chapter 6. Kites. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_TIMEOUT_MS: 4000 }, '1.1.1.7', hangs);
  check('a model that hangs is given up on in time for a fallback to answer (no retry of a hang)', rh.status === 200 && rh.json.model !== 'gemini-test'
    && calls.filter(c => /gemini-test:/.test(c.url)).length === 1 && Date.now() - t0 < 4000, `${rh.status} ${JSON.stringify(rh.json.tried)} ${calls.map(c => c.url.split("/").pop()).join()} ${Date.now() - t0}ms`);
  const allBusy = async () => ({ ok:false, status:503, json: async () => ({}) });
  const rz = await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_RETRY_MS: 1, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.1.9', allBusy);
  // a model that just failed rests: the next request (the repair round) goes straight to the fallback
  const restEnv = { ...env, GEMINI_MODEL: 'gemini-resty', TAKHTI_SYLLABUS_RETRY_MS: 1 };
  calls.length = 0;
  const restFake = async (url) => { calls.push({ url }); return /gemini-resty:/.test(url)
    ? { ok:false, status:503, json: async () => ({}) }
    : { ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ lessons:[MATH] }) }] } }] }) }; };
  await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, restEnv, '1.1.3.1', restFake);
  const firstCalls = calls.length; calls.length = 0;
  const again = await draftCore({ mode:'repair', repair:[{ lesson: WRONG_SUM, errors:['x'] }], rules }, restEnv, '1.1.3.2', restFake);
  check('a model that just said "busy" rests: the next request (the repair round) goes straight to the fallback, no waiting',
    firstCalls === 3 && calls.length === 1 && /3\.8-flash:/.test(calls[0].url) && again.json.model === 'gemini-3.8-flash', `${firstCalls} then ${JSON.stringify(calls.map(c => c.url.split('/').pop()))}`);
  calls.length = 0;
  const twoBusy = async (url) => { calls.push({ url }); return /gemini-test:|3\.8-flash:/.test(url)
    ? { ok:false, status:503, json: async () => ({}) }
    : { ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ lessons:[MATH] }) }] } }] }) }; };
  const r3m = await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_RETRY_MS: 1, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.3.3', twoBusy);
  check('…and when that one is busy too, the lite model is last', r3m.status === 200 && r3m.json.model === 'gemini-3.5-flash-lite', JSON.stringify(calls.map(c => c.url.split('/').pop())));
  check('…and when every model is busy, an honest "busy right now"', rz.status === 502 && /busy right now/.test(rz.json.error), JSON.stringify(rz));
  // the fourth live run couldn't tell a hang from "busy" from a quota: every model's outcome and time comes back
  check("each model's outcome and time come back with the answer — a hang, then the fallback's answer",
    Array.isArray(rh.json.tried) && rh.json.tried[0].model === 'gemini-test' && rh.json.tried[0].outcome === 'hung' && rh.json.tried.slice(-1)[0].outcome === 'ok' && rh.json.tried.every(x => Number.isFinite(x.ms)), JSON.stringify(rh.json.tried));
  const usage = async () => ({ ok:true, status:200, json: async () => ({ usageMetadata:{ promptTokenCount: 5100, candidatesTokenCount: 900, thoughtsTokenCount: 300, totalTokenCount: 6300 },
    candidates:[{ content:{ parts:[{ text: JSON.stringify({ chapter:'x', lessons:[] }) }] } }] }) });
  const ru = await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, env, '1.1.3.9', usage);
  check("the tokens Gemini says it used come back with the model (in, out with thinking, total) — so a run can say what it cost",
    JSON.stringify(ru.json.tried[0].tokens) === JSON.stringify({ in: 5100, out: 1200, total: 6300 }), JSON.stringify(ru.json.tried));
  check('…busy twice, then the next model', rb.json.tried.filter(x => x.model === 'gemini-test').map(x => x.outcome).join() === '503,503' && rz.json.tried.length >= 3, JSON.stringify(rb.json.tried));
  const quota = async () => ({ ok:false, status:429, json: async () => ({ error:{ message:'Quota exceeded' } }) });
  const rq = await draftCore({ chapter:{ text:'Chapter 4. Subtraction. '.repeat(5) }, rules }, { ...env, TAKHTI_SYLLABUS_RETRY_MS: 1, TAKHTI_GEMINI_REST_MS: 0 }, '1.1.3.4', quota);
  check("a 429 is said as the key's own limit, not as Google being busy", rq.status === 502 && /limit/.test(rq.json.error) && !/busy/.test(rq.json.error) && rq.json.tried.every(x => x.outcome === 429), JSON.stringify(rq.json));
  check('…and a 429 is not retried: one try per model, then the next (a quota doesn\'t clear in a second)', rq.json.tried.length >= 2 && new Set(rq.json.tried.map(x => x.model)).size === rq.json.tried.length, JSON.stringify(rq.json.tried));
  const big = Buffer.alloc(5 * 1024 * 1024, 7).toString('base64');
  const r413 = await draftCore({ chapter:{ file: big, mime:'application/pdf' }, rules }, env, '1.1.2.1', gemini({ lessons:[] }));
  const r12 = await draftCore({ chapter:{ file: big, mime:'application/pdf' }, rules }, { ...env, TAKHTI_SYLLABUS_MAX_MB: 12 }, '1.1.2.2', gemini({ lessons:[] }));
  check('a 5 MB chapter: refused at the serverless default (3.4 MB, saying so), taken where the limit is 12 MB (the voice server)', r413.status === 413 && r413.json.maxMb === 3.4 && r12.status === 200, JSON.stringify([r413.status, r12.status, r12.json]));
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
  const rsys = calls[0].body.systemInstruction.parts[0].text;
  check('…and the repair round is told what every beat is, what a shape ask may be, and how to read the reasons', /figure \{kind/.test(rsys) && /ask is exactly one of/.test(rsys) && /must say what is asked \(ask\)" → set the figure's ask/.test(rsys) && /needs exactly 2 answers/.test(rsys) && /TEACH, THEN ASK/.test(rsys), rsys.slice(0, 200));
  check("the repair round sends the lesson back with the checker's own reasons, and returns the fix", r3.status === 200 && r3.json.lessons.length === 1
    && JSON.stringify(calls[0].body.contents).includes('shows 25') && /rejected by Takhti's checker/.test(calls[0].body.systemInstruction.parts[0].text), JSON.stringify(r3).slice(0, 200));
  check('the model is told it only drafts from THIS chapter (nothing from outside it)', /nothing from outside it/.test(sys), '');
  check('…teach before asking, the school words (चौकोर कोना…), a why that names the real mistake, Hindi answers in Devanagari, and what each shape ask means',
    /TEACH, THEN ASK/.test(sys) && /चौकोर कोना/.test(sys) && /names the real misconception/.test(sys) && /हाँ\/नहीं/.test(sys) && /ask is exactly one of: name/.test(sys), '');
  // one beat schema per beat type, each with its own required fields: the first live run (flash-lite, Maths Mela
  // Class 3) answered a flat all-optional beat with questions that had no answers and rectangles with no height
  const variants = c1.body.generationConfig.responseFormat.text.schema.properties.lessons.items.properties.beats.items.anyOf;
  const vt = (t, kind) => variants.find(v => v.properties.t.enum[0] === t && (!kind || v.properties.kind.enum[0] === kind));
  check('the schema has one beat per type, each with its own required fields: a question can\'t come without its two answers and the right one, a rectangle without w and h, a circle without folds',
    vt('ask') && ['q','opts','hiOpts','correct'].every(f => vt('ask').required.includes(f)) && vt('ask').properties.opts.minItems === 2 && vt('ask').properties.opts.maxItems === 2
      && ['w','h'].every(f => vt('figure','rectangle').required.includes(f)) && vt('figure','circle').required.includes('folds') && vt('figure','triangle').properties.sides.minItems === 3
      && vt('word').properties.word.type === 'string' && vt('figure','rectangle').properties.w.type === 'integer', JSON.stringify(variants.map(v => v.properties.t.enum[0])));
  const flat = []; const refuse = async (url, o) => { const b = JSON.parse(o.body); flat.push(b);
    return JSON.stringify(b.generationConfig).includes('anyOf') ? { ok:false, status:400, json: async () => ({ error:{ message:'schema too complex' } }) }
      : { ok:true, status:200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify({ chapter:'x', lessons:[MATH] }) }] } }] }) }; };
  const rf = await draftCore({ mode:'draft', chapter:{ text:'Subtraction' }, rules, count:1 }, env, '1.1.1.8', refuse);
  check('an API that refuses the strict schema (400) still gets the old flat one, last', rf.status === 200 && flat.length === 3 && !JSON.stringify(flat[2].generationConfig).includes('anyOf'), JSON.stringify(rf).slice(0, 200));
  check('…to start every lesson with aims the teacher can approve, each one taught and checked, a note on why children pick the wrong answer, and never गुणा for "by"',
    /AIMS/.test(sys) && /Every aim is taught in the beats AND checked by a question/.test(sys) && /something a child can show on a screen/.test(sys) && /TEACH ON ONE SHAPE, ASK ON ANOTHER/.test(sys) && /why/.test(sys) && /गुणा/.test(sys) && c1.body.generationConfig && JSON.stringify(c1.body.generationConfig).includes('"aims"'), sys.slice(0, 200));

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
  const { syncCore } = await import(pathToFileURL(path.join(root, 'api/class-sync.mjs')).href);
  const mem = new Map(), store = { get: async k => mem.get(k) || null, setJSON: async (k, v) => mem.set(k, JSON.parse(JSON.stringify(v))) };
  const pack = { items:[{ id:'sch-abc12', band:'developing', beats:[{ t:'intro' }] }], at: 1000 };
  // Cloud sync now requires an independently verified teacher/guardian ACL.
  // A class code or the old teacherKey is never an authorization credential.
  const { authorizeClass } = await import(pathToFileURL(path.join(root, 'api/lib/class-auth.mjs')).href);
  const teacher = authorizeClass({code:'CLS001'}, {role:'teacher',active:true,schoolId:'school-one',classes:['CLS001']});
  const guardian = authorizeClass({code:'CLS001',children:{}}, {role:'guardian',active:true,schoolId:'school-one',
    children:[{code:'CLS001',id:'test-child',consent:true}]});
  await syncCore(store, { code:'CLS001', lessons: pack }, teacher);
  const kid = await syncCore(store, { code:'CLS001', children:{} }, guardian);
  check('the class sync: lessons set by the verified teacher reach an authorized guardian',
    kid.status === 200 && kid.json.lessons?.items[0]?.id === 'sch-abc12', JSON.stringify(kid.json));
  const denied = await syncCore(store, { code:'CLS001', lessons:{ items:[{ id:'sch-evil1', beats:[] }], at: 5000 } }, guardian);
  const unchanged = await syncCore(store, { code:'CLS001', children:{} }, guardian);
  check('…and a guardian cannot set or replace teacher lessons',
    denied.status === 403 && unchanged.json.lessons?.items[0]?.id === 'sch-abc12', JSON.stringify(denied));
  await syncCore(store, { code:'CLS001', lessons:{ items:[{ id:'<script>', beats:[] }], at: 6000 } }, teacher);
  const sanitized = await syncCore(store, { code:'CLS001', children:{} }, guardian);
  check('…only lesson-shaped items are kept (ids, beat counts, size)',
    sanitized.status === 200 && sanitized.json.lessons?.items.length === 0, JSON.stringify(sanitized.json));

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
    // the 13 Nov live run's own lessons (Maths Mela Class 3): valid, but the answer given away
    const AIM1 = MATH.aims[0];
    const TRI = { title:{ en:'Triangle sides', hi:'त्रिभुज की भुजाएँ' }, sub:{ en:'Count', hi:'गिनो' }, ic:'🔺', skill:'shapes2d', aims:[AIM1],
      beats:[{ t:'intro', say:{ en:'A triangle has three straight sides.', hi:'त्रिभुज की तीन सीधी भुजाएँ होती हैं।' } }, { t:'figure', kind:'square', s:4 },
             { t:'figure', kind:'triangle', sides:[5,4,6], ask:'sides' }, { t:'ask', q:{ en:'How many sides does it have?', hi:'इसकी कितनी भुजाएँ हैं?' }, opts:['4','3'], hiOpts:['4','3'], correct:1,
               why:{ en:'Children who just saw the square say four.', hi:'वर्ग देखकर बच्चे चार कहते हैं।' } }, { t:'win', say:{ en:'Count every side once.', hi:'हर भुजा एक बार गिनो।' } }] };
    const tri = clean(TRI), triOk = clean({ ...TRI, beats:[{ t:'intro', say:{ en:'Shapes have straight sides. Let us count them.', hi:'आकृतियों की सीधी भुजाएँ होती हैं। आओ गिनें।' } }].concat(TRI.beats.slice(1)) });
    check('"A triangle has three straight sides" before "how many sides?" gives the answer away — a number word counts like a digit (and in Hindi, तीन) — and the reason says where ("in the intro")',
      !tri.ok && tri.errors.some(e => /say the answer "3" \(in the intro\)/.test(e)) && triOk.ok, JSON.stringify([tri.errors, triOk.errors]));
    const SQC = { ...TRI, title:{ en:'Square corners', hi:'चौकोर कोने' }, skill:'angles',
      beats:[{ t:'intro', say:{ en:'Look at this corner.', hi:'इस कोने को देखो।' } }, { t:'corner', deg:90 }, { t:'corner', deg:90, ask:'kind' },
             { t:'ask', q:{ en:'What kind of corner is this?', hi:'यह किस तरह का कोना है?' }, opts:['Square corner','Smaller corner'], hiOpts:['चौकोर कोना','छोटा कोना'], correct:0,
               why:{ en:'Children call any corner square.', hi:'बच्चे हर कोने को चौकोर कहते हैं।' } }, { t:'win', say:{ en:'Check it with a book corner.', hi:'किताब के कोने से मिलाओ।' } }] };
    const sqc = clean(SQC), sqcOk = clean({ ...SQC, beats: SQC.beats.map((b, k) => k === 1 ? { t:'corner', deg:60 } : b) });
    const sqcQ = sqc.lesson && sqc.lesson.beats.find(b => b.t === 'ask'), sqcPic = sqc.lesson && sqc.lesson.beats.find(b => b.t === 'corner' && b.ask);
    check('teach on one example, ask on another: the teaching corner asked about again becomes a corner of the OTHER answer\'s kind (smaller) — "square corner", what was just shown, is the wrong answer now',
      sqc.ok && sqcPic.deg < 90 && /Smaller/.test(sqcQ.opts[sqcQ.correct]) && /छोटा/.test(sqcQ.hiOpts[sqcQ.correct]) && /repeat/.test(sqcQ.why.en) && /दोहरा/.test(sqcQ.why.hi) && sqcOk.ok,
      JSON.stringify([sqc.errors, sqcPic, sqcQ, sqcOk.errors]));
    const CIR = { ...TRI, title:{ en:'Centre', hi:'केंद्र' },
      beats:[{ t:'intro', say:{ en:'Fold a circle plate to find its center.', hi:'गोल प्लेट को मोड़ो।' } }, { t:'figure', kind:'circle', folds:0 }, { t:'figure', kind:'circle', folds:2, ask:'meet' },
             { t:'ask', q:{ en:'Where do the folds meet?', hi:'मोड़ कहाँ मिलते हैं?' }, opts:['Side','Centre'], hiOpts:['भुजा','केंद्र'], correct:1,
               why:{ en:'Children point at the edge.', hi:'बच्चे किनारे की ओर इशारा करते हैं।' } }, { t:'win', say:{ en:'Folds meet in the middle.', hi:'मोड़ बीच में मिलते हैं।' } }] };
    const cir = clean(CIR);
    check('"find its center" before an answer "Centre" gives it away — US and UK spelling are the same word', !cir.ok && cir.errors.some(e => /say the answer "Centre"/.test(e)), JSON.stringify(cir.errors));
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
    bad('teach before you ask: a question straight after the intro is rejected',
      { ...clone(READ), title:{ en:'Square corners', hi:'चौकोर कोने' }, beats:[{ t:'intro', say:{ en:"Let's look at corners.", hi:'आओ कोने देखें।' } }, { t:'corner', deg:90, ask:'kind' },
        { t:'ask', q:{ en:'What kind of corner is this?', hi:'यह कैसा कोना है?' }, opts:['Square corner','Smaller corner'], hiOpts:['चौकोर कोना','छोटा कोना'], correct:0 }, { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] }, /teach before you ask/);
    bad('Hindi answers in English are rejected (only numbers may stay as they are)', (() => { const x = clone(READ); x.beats[1].hiOpts = ['On the roof','In the park']; return x; })(), /must be in Devanagari/);
    const shapeL = (q, opts, hiOpts, extra) => ({ ...clone(READ), title:{ en:'Shapes', hi:'आकृतियाँ' }, skill:'shapes2d', beats:[{ t:'intro', say:{ en:'Look at the shapes.', hi:'आकृतियाँ देखो।' } },
      { t:'figure', kind:'triangle', sides:[4,4,4] }, { t:'figure', kind:'rectangle', w:6, h:3, ...(extra || {}) }, { t:'figure', kind:'rectangle', w:6, h:3, ...(extra || {}) },
      { t:'ask', q, opts, hiOpts, correct:0 }, { t:'win', say:{ en:'Count every side.', hi:'हर भुजा गिनो।' } }] });
    const inferred = clean(shapeL({ en:'How many sides does it have?', hi:'इसकी कितनी भुजाएँ हैं?' }, ['4','3'], ['4','3']));
    check("the live run's pattern — the same shape twice, the question's ask left out — is tidied: one shape, its ask read from the question, then checked against the drawing",
      inferred.ok && inferred.lesson.beats.filter(b => b.t === 'figure').length === 2 && inferred.lesson.beats.find(b => b.kind === 'rectangle').ask === 'sides' && inferred.checks[0] === 'shape', JSON.stringify(inferred.errors));
    bad('…and a question the drawing contradicts still fails (a rectangle has 4 corners, not 3)', shapeL({ en:'How many corners?', hi:'कितने कोने?' }, ['3','4'], ['3','4']), /isn't what the picture shows/);
    bad('a question that names the shape it asks about is rejected ("…in this rectangle?")', shapeL({ en:'Are all the sides equal in this rectangle?', hi:'क्या इस आयत की सारी भुजाएँ बराबर हैं?' }, ['No','Yes'], ['नहीं','हाँ'], { ask:'equal' }), /names the shape/);
    const wordL = clean({ ...clone(READ), beats:[{ t:'word', word:'पतंग', art:'🪁' }, { t:'ask', q:{ en:'Which word is this?', hi:'यह कौन सा शब्द है?' }, opts:['Kite','Ball'], hiOpts:['पतंग','गेंद'], correct:0 }, { t:'win', say:{ en:'Well read.', hi:'शाबाश।' } }] });
    check('a word beat sent as "word" (the schema\'s name) works', wordL.ok && wordL.lesson.beats[0].w === 'पतंग', JSON.stringify(wordL.errors));
    // (line endings normalised: a Windows checkout has \r\n)
    const exSrc = fs.readFileSync(path.join(root, 'api/syllabus.mjs'), 'utf8').replace(/\r\n/g, '\n').match(/An example of one good lesson[^\n]*\n([\s\S]*?)`;\n}/)[1];
    const ex = JSON.parse(E(`JSON.stringify(sylClean(${exSrc}, { band:'early', skills: sylSkills(sylClass('c1')) }))`));
    check("the example lesson in Gemini's prompt passes Takhti's own checker (so the example and the rules can't drift apart)", ex.ok && ex.checks.length >= 1 && ex.checks.every(c => c === 'shape'), JSON.stringify(ex.errors));
    // an English book's lesson (NCERT Mridang): read in English whatever the app's language
    const enSrc = fs.readFileSync(path.join(root, 'api/syllabus.mjs'), 'utf8').replace(/\r\n/g, '\n').match(/ENGLISH_EXAMPLE = `([\s\S]*?)`;/)[1];
    const EN = JSON.parse(enSrc);
    const enClean = (x, lang) => JSON.parse(E(`JSON.stringify(sylClean(${JSON.stringify(x)}, { band:'early', skills: sylSkills(sylClass('c1')), minQuestions: 2, minAll: true, lang: ${JSON.stringify(lang || null)} }))`));
    const enEx = enClean(EN, 'en');
    check("the English example in Gemini's prompt passes as an English lesson: lang 'en' kept, both questions read off the text (the first sound off the word itself)",
      enEx.ok && enEx.lesson.lang === 'en' && enEx.checks.every(c => c === 'text'), JSON.stringify(enEx.errors));
    check("…the same lesson NOT marked English fails: Hindi answers in English letters are only an English lesson's own words",
      !enClean(EN).ok && enClean(EN).errors.some(e => /must be in Devanagari/.test(e)), JSON.stringify(enClean(EN).errors));
    const readEn = clean({ ...clone(READ) }), readEnL = JSON.parse(E(`JSON.stringify(sylClean(${JSON.stringify(READ)}, { band:'developing', skills: sylSkills(sylClass('c2')), lang:'en' }))`));
    check("lang is inside the id when set — and a lesson without one keeps the id it always had (no lang key in it)",
      readEn.ok && readEnL.ok && readEnL.lesson.id !== readEn.lesson.id && !('lang' in readEn.lesson) && readEnL.lesson.lang === 'en'
      && JSON.parse(E(`JSON.stringify(sylClean(${JSON.stringify(readEnL.lesson)}, { band:'developing' }).lesson.id)`)) === readEnL.lesson.id, readEnL.lesson.id + ' ' + readEn.lesson.id);
    const enMod = f => { const x = clone(EN); f(x.beats); return x; };
    const enErr = (name, x, re) => { const c = enClean(x, 'en'); check(name, !c.ok && c.errors.some(e => re.test(e)), JSON.stringify(c.errors)); };
    enErr("an English lesson's Hindi answer in English letters must be that very English word", enMod(b => { b[2].hiOpts = ['bird', 'the sun']; }), /same English words/);
    enErr('a first sound marked wrong is caught by the word itself ("nose" starts with "n", not "m")', enMod(b => { b[4].correct = 1; }), /"nose" starts with "n"/);
    enErr('…and two answers that are both its first sound', enMod(b => { b[4].opts = ['n', 'N']; b[4].hiOpts = ['n', 'N']; }), /both answers are the first sound/);
    enErr('a word card whose narration says the letter ("This word begins with an n sound.") gives the first sound away', enMod(b => { b[3].say = { en: 'This word begins with an n sound.', hi: 'यह शब्द n आवाज़ से शुरू होता है।' }; }), /say the answer "n"/);
    const article = enClean(enMod(b => { b[0].say = { en: 'Every word starts with a sound.', hi: 'हर शब्द एक आवाज़ से शुरू होता है।' }; b[3].w = undefined; b[3].word = 'ant'; b[4].q = { en: 'What is the first sound of ant?', hi: 'ant की पहली आवाज़ क्या है?' }; b[4].opts = ['a', 'e']; b[4].hiOpts = ['a', 'e']; }), 'en');
    check('…but "starts with a sound" is the article, not the letter a', article.ok, JSON.stringify(article.errors));
    const twoCards = q => enMod(b => { b.splice(3, 2, { t: 'word', word: 'eyes', art: '👀', say: { en: 'Look at this word.', hi: 'इस शब्द को देखो।' } }, { t: 'word', word: 'ears', art: '👂', say: { en: 'And this one.', hi: 'और इसे भी।' } },
      { t: 'ask', q, opts: ['eyes', 'ears'], hiOpts: ['eyes', 'ears'], correct: 0, aim: 1, why: { en: 'Children mix up eyes and ears.', hi: 'बच्चे आँख और कान में उलझते हैं।' } }); });
    const cards = enClean(twoCards({ en: 'What do we see with?', hi: 'हम किससे देखते हैं?' }), 'en');
    check('two word cards in a row are both read: a question about the first card is in what the child read', cards.ok, JSON.stringify(cards.errors));
    enErr('…but "Which little word did you read first?" only asks for the card the child just saw — nothing to work out', twoCards({ en: 'Which little word did you read first?', hi: 'तुमने पहले कौन सा छोटा शब्द पढ़ा?' }), /asks which word was on the card/);
    enErr('…and a word card that says the two-letter word ("This word is to.") gives it away', enMod(b => { b.splice(3, 2, { t: 'word', word: 'to', art: '➡️', say: { en: 'This word is to.', hi: 'यह शब्द to है।' } },
      { t: 'ask', q: { en: 'Which little word did you read?', hi: 'तुमने कौन सा छोटा शब्द पढ़ा?' }, opts: ['to', 'go'], hiOpts: ['to', 'go'], correct: 0, aim: 2, why: { en: 'Children mix up short words.', hi: 'बच्चे छोटे शब्दों में उलझते हैं।' } }); }), /say the answer "to"/);
    // from the second live run: the question's picture was the teaching picture again, and the intro said the answer
    const circ = (beats) => ({ ...clone(READ), title:{ en:'The centre', hi:'केंद्र' }, skill:'shapes2d', beats:[...beats,
      { t:'ask', q:{ en:'Where do the fold lines meet?', hi:'तह की रेखाएँ कहाँ मिलती हैं?' }, opts:['Centre','Edge'], hiOpts:['केंद्र','किनारा'], correct:0 },
      { t:'win', say:{ en:'Folds meet in the middle.', hi:'तह बीच में मिलती हैं।' } }] });
    const refold = clean(circ([{ t:'intro', say:{ en:'Let us fold a plate.', hi:'आओ प्लेट मोड़ें।' } }, { t:'figure', kind:'circle', folds:2 }, { t:'figure', kind:'circle', folds:2, ask:'meet' }]));
    check('a question about the very picture that just taught it gets a picture of its own (the folds meet at the centre for any number from 2, so the question\'s circle gets 3)',
      refold.ok && refold.lesson.beats.filter(b => b.kind === 'circle').map(b => b.folds).join() === '2,3', JSON.stringify(refold.errors));
    bad('…and the same picture twice, where no shape has the other answer (5 sides), is still sent back',
      { ...clone(READ), title:{ en:'Sides', hi:'भुजाएँ' }, skill:'shapes2d', beats:[{ t:'intro', say:{ en:'Look.', hi:'देखो।' } },
        { t:'figure', kind:'rectangle', w:6, h:3, say:{ en:'Look at its sides.', hi:'इसकी भुजाएँ देखो।' } }, { t:'figure', kind:'rectangle', w:6, h:3, ask:'sides' },
        { t:'ask', q:{ en:'How many sides does this shape have?', hi:'इस आकृति की कितनी भुजाएँ हैं?' }, opts:['4','5'], hiOpts:['4','5'], correct:0 }, { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] }, /teaching picture again/);
    bad('an intro that says the answer before a shape question is rejected',
      circ([{ t:'intro', say:{ en:'Fold lines meet at the centre.', hi:'तह की रेखाएँ केंद्र पर मिलती हैं।' } }, { t:'figure', kind:'circle', folds:2 }, { t:'figure', kind:'circle', folds:3, ask:'meet' }]), /say the answer "Centre"/);
    const named = clean(circ([{ t:'intro', say:{ en:'Let us fold a plate.', hi:'आओ प्लेट मोड़ें।' } }, { t:'figure', kind:'circle', folds:2, say:{ en:'The folds meet in the middle. This is the centre.', hi:'तह बीच में मिलती हैं। यह केंद्र है।' } }, { t:'figure', kind:'circle', folds:3, ask:'meet' }]));
    check('…but a teaching picture may name the idea it teaches when the question is about a NEW picture', named.ok, JSON.stringify(named.errors));
    const noH = (ask, opts) => ({ ...clone(READ), title:{ en:'Rectangles', hi:'आयत' }, skill:'shapes2d', beats:[{ t:'intro', say:{ en:'Look.', hi:'देखो।' } },
      { t:'figure', kind:'triangle', sides:[4,4,4] }, { t:'figure', kind:'rectangle', w:8, ask }, { t:'ask', q:{ en:'How many sides? Or how far round?', hi:'कितनी भुजाएँ? या कितनी दूरी?' }, opts, hiOpts: opts, correct:0 },
      { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] });
    const hFixed = clean(noH('sides', ['4','3']));
    check("a rectangle with only its width gets a height (half, so it stays a rectangle) when the question doesn't depend on it", hFixed.ok && hFixed.lesson.beats.find(b => b.kind === 'rectangle').h === 4, JSON.stringify(hFixed.errors));
    bad('…but never for a perimeter question, where a made-up side would change the answer', noH('perimeter', ['24','16']), /needs w and h/);
    // from the fourth live run: the repair kept a row's rectangle without h, a row without find, and wrote "folds 2" as text
    const row = (q, find, items) => ({ ...clone(READ), title:{ en:'Find it', hi:'ढूँढो' }, skill:'shapes2d', beats:[{ t:'intro', say:{ en:'Look at the shapes.', hi:'आकृतियाँ देखो।' } },
      { t:'figure', kind:'square', s:4 }, { t:'figures', items: items || [{ kind:'triangle', sides:[3,4,5] }, { kind:'rectangle', w:6 }, { kind:'circle' }], ...(find ? { find } : {}) },
      { t:'ask', q, opts:['2','1'], hiOpts:['2','1'], correct:0 }, { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] });
    const rowFixed = clean(row({ en:'Which number is a rectangle?', hi:'किस नंबर पर आयत है?' }));
    const rb = rowFixed.lesson && rowFixed.lesson.beats.find(b => b.t === 'figures');
    check("a row's rectangle with no h gets one, and a row with no find gets it from the question's words — then checked against the drawing",
      rowFixed.ok && rb.find === 'rectangle' && rb.items[1].h === 3, JSON.stringify(rowFixed.errors));
    bad('…a wrong reading still fails against the drawing (no square in that row)', row({ en:'Which number is a square?', hi:'किस नंबर पर वर्ग है?' }), /exactly one shape must be the square/);
    bad("…and a question that names two shapes isn't guessed — the checker asks for find", row({ en:'Which is a rectangle and which a triangle?', hi:'आयत कौन सा है और त्रिभुज कौन सा?' }), /a row needs its find/);
    const folded = clean(circ([{ t:'intro', say:{ en:'Let us fold a plate.', hi:'आओ प्लेट मोड़ें।' } }, { t:'figure', kind:'circle', text:'2 folds' }, { t:'figure', kind:'circle', text:'folds 3' }]));
    check('sizes written as text ("folds 3", "2 folds") go into their own fields', folded.ok && folded.lesson.beats.filter(b => b.kind === 'circle').map(b => b.folds).join() === '2,3' && !folded.lesson.beats.some(b => 'text' in b), JSON.stringify(folded.errors));
    const sizes = JSON.parse(E(`JSON.stringify(sylTidy([{ t:'figure', kind:'rectangle', text:'6 × 3' }, { t:'figure', kind:'triangle', text:'sides 3, 4 and 5' }, { t:'corner', text:'a 60° corner' }, { t:'figure', kind:'square', s:5, text:'side 9' }]))`));
    check('…a rectangle "6 × 3", a triangle "3, 4 and 5", a corner "60°" — never over a field that was given', sizes[0].w === 6 && sizes[0].h === 3 && sizes[1].sides.join() === '3,4,5' && sizes[2].deg === 60 && sizes[3].s === 5, JSON.stringify(sizes));
    // the fourth run's teacher reading: a named shape gives the count away; a teaching circle without the folds it talks about
    bad('"How many sides does this triangle have?" gives the count away — the name says it, so nobody counts', shapeL({ en:'How many sides does this rectangle have?', hi:'इस आयत की कितनी भुजाएँ हैं?' }, ['4','3'], ['4','3'], { ask:'sides' }), /names the shape/);
    const foldTeach = { t:'figure', kind:'circle', say:{ en:'Where the fold lines meet is the centre.', hi:'जहाँ तह की रेखाएँ मिलती हैं, वह केंद्र है।' } };
    bad('a teaching circle that talks about its folds must draw them (when it says it has none)',
      circ([{ t:'intro', say:{ en:'Let us fold a plate.', hi:'आओ प्लेट मोड़ें।' } }, { ...foldTeach, folds:0 }, { t:'figure', kind:'circle', folds:3, ask:'meet' }]), /doesn't show the folds/);
    // the fifth run: the teaching circle and the question's circle had no folds at all (and were the same picture)
    const drawn = clean(circ([{ t:'intro', say:{ en:'Let us fold a plate.', hi:'आओ प्लेट मोड़ें।' } }, foldTeach, { t:'figure', kind:'circle', ask:'meet' }]));
    check('circles with no folds get them drawn: 2 on a teaching circle that talks about folds, 3 on a "where do they meet?" circle — so it is a different picture',
      drawn.ok && drawn.lesson.beats.filter(b => b.kind === 'circle').map(b => b.folds).join() === '2,3', JSON.stringify(drawn.errors));
    // the fifth run: a teaching picture with no words passed, but the player says its facts ("A rectangle: 4 sides…") before "how many sides?"
    const silent = { ...clone(READ), title:{ en:'Rectangles', hi:'आयत' }, skill:'shapes2d', beats:[{ t:'intro', say:{ en:'Look.', hi:'देखो।' } },
      { t:'figure', kind:'rectangle', w:6, h:3 }, { t:'figure', kind:'rectangle', w:5, h:3, ask:'sides' },
      { t:'ask', q:{ en:'How many sides does this shape have?', hi:'इस आकृति की कितनी भुजाएँ हैं?' }, opts:['3','4'], hiOpts:['3','4'], correct:1 }, { t:'win', say:{ en:'Well done.', hi:'शाबाश।' } }] };
    const silentT = clean(silent), silentQ = silentT.lesson && silentT.lesson.beats.find(b => b.t === 'ask');
    check("a teaching picture without words: what Munni will say over it (\"4 sides\") counts — so \"how many sides?\" moves to the shape whose answer is the other option (a triangle, 3)",
      silentT.ok && silentT.lesson.beats.find(b => b.t === 'figure' && b.ask === 'sides').kind === 'triangle' && silentQ.opts[silentQ.correct] === '3', JSON.stringify([silentT.errors, silentQ]));
    bad('…and where both counts were said, nothing can be moved, so it is still sent back',
      { ...silent, beats:[{ t:'intro', say:{ en:'Triangles have three sides.', hi:'त्रिभुज की तीन भुजाएँ होती हैं।' } }].concat(silent.beats.slice(1)) }, /say the answer "4" \(in beat 1's words\)|say the answer "3"/);
    // the first whole-book build: place-value questions about a group's bundles
    const PV = { ...clone(READ), title:{ en:'Tens', hi:'दहाई' }, skill:'place2', beats:[
      { t:'intro', say:{ en:'Let us look at bundles.', hi:'आओ बंडल देखें।' } },
      { t:'group', a:30, say:{ en:'Here are some bundles.', hi:'ये कुछ बंडल हैं।' } },
      { t:'group', a:54, say:{ en:'Look at these bundles and loose sticks.', hi:'इन बंडलों और खुली तीलियों को देखो।' } },
      { t:'ask', q:{ en:'How many tens are shown here?', hi:'यहाँ कितनी दहाइयाँ हैं?' }, opts:['5','8'], hiOpts:['5','8'], correct:0 },
      { t:'win', say:{ en:'Count the bundles.', hi:'बंडल गिनो।' } }] };
    const pv = clean(PV), pvPic = pv.lesson && pv.lesson.beats.filter(b => b.t === 'group')[1];
    check('"How many tens are shown?" over a group of 54 is a bundle question: the group asks about its tens, and 5 — the tens digit — is checked as right',
      pv.ok && pvPic.ask === 'tens', JSON.stringify([pv.errors, pvPic]));
    bad('…the wrong digit is still caught', { ...PV, beats: PV.beats.map(b => b.t === 'ask' ? { ...b, correct: 1 } : b) }, /shows 54|compute/);
    bad('…and narration that counts the bundles aloud first is sent back', { ...PV, beats: PV.beats.map(b => b.a === 54 ? { ...b, say:{ en:'Here are five tens and four ones.', hi:'यहाँ पाँच दहाइयाँ और चार इकाइयाँ हैं।' } } : b) }, /say the answer "5"/);
    const wn = clean({ ...clone(READ), beats: clone(READ).beats.map(b => b.t === 'passage' ? { ...b, p:{ en:'Moon means one. Eyes mean two.', hi:'चंद्रमा का अर्थ एक है। आँखें दो हैं।' } } : b.t === 'ask' ? { ...b, q:{ en:'What number does Moon stand for?', hi:'चंद्रमा किस संख्या के लिए है?' }, opts:['1','2'], hiOpts:['1','2'], correct:0 } : b) });
    check('a reading answer "1" is in a passage that says "one" (a number is itself as a word)', wn.ok || !wn.errors.some(e => /isn't in the passage/.test(e)), JSON.stringify(wn.errors));
    const lw = b => clean({ ...clone(READ), beats: clone(READ).beats.map(x => x.t === 'ask' ? { ...x, q:{ en:'How many letters are in the word tiger?', hi:'tiger शब्द में कितने अक्षर हैं?' }, opts:['5','4'], hiOpts:['5','4'], correct: b } : x) });
    check('"How many letters are in the word tiger?" is checked by counting: 5 passes, 4 marked right is sent back', !lw(0).errors.some(e => /isn't in the passage/.test(e)) && lw(1).errors.some(e => /isn't in the passage/.test(e)), JSON.stringify([lw(0).errors, lw(1).errors]));
    check('a maths topic taught only by a sentence to read is flagged for the teacher (EN/HI) — and a lesson with a picture is not',
      E(`sylLessonWarnings({ skillId:'time2', beats:[{ t:'passage' }, { t:'ask', opts:['a','b'], correct:0 }, { t:'ask', opts:['a','b'], correct:1 }] }).some(w => /only by a sentence to read/.test(w.en) && /वाक्य/.test(w.hi))`)
        && !E(`sylLessonWarnings({ skillId:'time2', beats:[{ t:'count', n:3 }, { t:'ask', opts:['a','b'], correct:0 }, { t:'ask', opts:['a','b'], correct:1 }] }).some(w => /sentence to read/.test(w.en))`)
        && !E(`sylLessonWarnings({ skillId:'read3', beats:[{ t:'passage' }, { t:'ask', opts:['a','b'], correct:0 }, { t:'ask', opts:['a','b'], correct:1 }] }).some(w => /sentence to read/.test(w.en))`), '');
    // the sixth run (13 Nov, evening): every lesson taught a fact, then asked it — the repair changed only the size
    const SIX = { ...clone(READ), title:{ en:'Square and Rectangle', hi:'वर्ग और आयत' }, skill:'shapes2d', beats:[
      { t:'intro', say:{ en:'Squares and rectangles have sides and corners. Let us look at them.', hi:'वर्ग और आयत की भुजाएँ और कोने होते हैं। आओ इन्हें देखें।' } },
      { t:'figure', kind:'square', s:4, say:{ en:'A square has four equal sides and four corners.', hi:'एक वर्ग की चार बराबर भुजाएँ और चार कोने होते हैं।' } },
      { t:'figure', kind:'rectangle', w:6, h:2, ask:'sides' },
      { t:'ask', q:{ en:'How many sides does this shape have?', hi:'इस आकृति की कितनी भुजाएँ हैं?' }, opts:['4','3'], hiOpts:['4','3'], correct:0,
        why:{ en:'Children confuse rectangles with triangles.', hi:'बच्चे आयत को त्रिभुज समझते हैं।' } },
      { t:'win', say:{ en:'Count every side once.', hi:'हर भुजा एक बार गिनो।' } }] };
    const six = clean(SIX), sixQ = six.lesson && six.lesson.beats.find(b => b.t === 'ask'), sixPic = six.lesson && six.lesson.beats.find(b => b.ask === 'sides');
    check('the sixth run\'s lesson — "a square has four sides", then "how many sides?" of a rectangle — is moved onto a triangle: 3 right, 4 (what the child just heard) the wrong answer, and the teacher\'s note says so (EN/HI)',
      six.ok && sixPic.kind === 'triangle' && sixQ.opts[sixQ.correct] === '3' && sixQ.opts.includes('4') && /"4"/.test(sixQ.why.en) && /"4"/.test(sixQ.why.hi), JSON.stringify([six.errors, sixPic, sixQ]));
    bad('a question that names a shape is never moved — and "how many sides does this triangle have?" over a rectangle is sent back as naming a shape',
      { ...SIX, beats: SIX.beats.map(b => b.t === 'ask' ? { ...b, q:{ en:'How many sides does this triangle have?', hi:'इस त्रिभुज की कितनी भुजाएँ हैं?' } } : b) }, /names the shape/);
    const silentOk = clean({ ...silent, beats: silent.beats.map((b, k) => k === 1 ? { t:'figure', kind:'triangle', sides:[5,5,5] } : b) });
    check('…teach one kind and count another, and it passes — with the narration written in for the teacher to read',
      silentOk.ok && /triangle/i.test(silentOk.lesson.beats[1].say.en) && /त्रिभुज/.test(silentOk.lesson.beats[1].say.hi), JSON.stringify(silentOk.errors));
    // a shape beside a row's items goes in; a row's wrong answer points at the look-alike
    const rowAsk = right => ({ t:'ask', q:{ en:'Which number?', hi:'कौन सा नंबर?' }, opts:[right, '1'], hiOpts:[right, '1'], correct:0 });
    const stray = JSON.parse(E(`JSON.stringify(sylTidy([{ t:'figures', kind:'square', s:3, items:[{ kind:'triangle', sides:[4,4,4] }, { kind:'circle' }], find:'squarecorner' }, ${JSON.stringify(rowAsk('3'))}]))`));
    check('a shape written beside a row\'s items goes in where the row then answers as marked (here the end: 3), the stray fields gone',
      stray[0].items.length === 3 && stray[0].items[2].kind === 'square' && stray[0].items[2].s === 3 && !('kind' in stray[0]) && !('s' in stray[0]), JSON.stringify(stray));
    // the eighth run: put in blindly, a stray rectangle became the row's second rectangle
    const stray2 = JSON.parse(E(`JSON.stringify(sylTidy([{ t:'figures', kind:'rectangle', w:5, items:[{ kind:'triangle', sides:[3,4,5] }, { kind:'rectangle', w:6, h:3 }, { kind:'square', s:3 }], find:'rectangle' }, ${JSON.stringify(rowAsk('2'))}]))`));
    check("…but a stray that would make a second match (or disagree with the marked answer) is dropped, and the row that was right stays right",
      stray2[0].items.length === 3 && !('kind' in stray2[0]) && E(`geoExpect(${JSON.stringify(stray2[0])})`) === 2, JSON.stringify(stray2));
    const lk = JSON.parse(E(`JSON.stringify(sylTidy([{ t:'figures', items:[{ kind:'triangle', sides:[3,4,5] }, { kind:'rectangle', w:6, h:3 }, { kind:'square', s:3 }], find:'rectangle' },
      { t:'ask', q:{ en:'Which number is a rectangle?', hi:'किस नंबर पर आयत है?' }, opts:['1','2'], hiOpts:['1','2'], correct:1 }]))`));
    check("a row's wrong answer is moved to the look-alike (the square when finding the rectangle); the right answer stays",
      lk[1].opts.join() === '3,2' && lk[1].hiOpts.join() === '3,2' && lk[1].correct === 1 && /square/.test(lk[1].why.en) && /वर्ग/.test(lk[1].why.hi), JSON.stringify(lk[1]));
    const lkc = JSON.parse(E(`JSON.stringify(sylTidy([{ t:'figures', items:[{ kind:'corner', deg:40 }, { kind:'corner', deg:90 }, { kind:'corner', deg:120 }], find:'squarecorner' },
      { t:'ask', q:{ en:'Which is a square corner?', hi:'चौकोर कोना कौन सा है?' }, opts:['2','1'], hiOpts:['2','1'], correct:0 }]))`));
    check('…and in a row of corners, to the corner nearest a square one', lkc[1].opts.join() === '2,3', JSON.stringify(lkc[1]));
    // an aim no question checks is shown to the teacher (not a rejection)
    const aimed = clean({ ...shapeL({ en:'How many sides does it have?', hi:'इसकी कितनी भुजाएँ हैं?' }, ['4','3'], ['4','3']),
      aims:[{ ...MATH.aims[0], short:{ en:'Count sides', hi:'भुजाएँ गिनो' }, point:{ en:'The child can count the sides of a shape.', hi:'बच्चा आकृति की भुजाएँ गिन सकता है।' } },
            { ...MATH.aims[0], short:{ en:'Find it', hi:'ढूँढो' }, point:{ en:'The child can find a shape with 3 sides.', hi:'बच्चा 3 भुजाओं वाली आकृति ढूँढ सकता है।' } }] });
    const gaps = JSON.parse(E(`JSON.stringify(sylAimGaps(${JSON.stringify(aimed.lesson)}))`));
    check('an aim no question checks ("find a shape with 3 sides" with no row to find it in) is flagged for the teacher — and only that one', aimed.ok && gaps.length === 1 && /find a shape/.test(gaps[0].point.en), JSON.stringify(gaps));
    check("…the example lesson's aims are all checked", JSON.parse(E(`JSON.stringify(sylAimGaps(${JSON.stringify(ex.lesson)}))`)).length === 0, '');
    const paper = JSON.parse(E(`JSON.stringify(sylAimGaps({ beats:[{ t:'figure', kind:'circle', folds:3, ask:'meet' }, { t:'ask' }], aims:[{ en:'The child can fold a round paper to find lines.', hi:'x' }, { en:'The child can find the centre.', hi:'x' }] }))`));
    check('an aim a screen can\'t check ("fold a round paper") is flagged; "find the centre" is checked by the centre question', paper.length === 1 && /paper/.test(paper[0].en), JSON.stringify(paper));
    // the eighth run's teacher reading: one coin-toss question; a square asked "all sides equal?" is always Yes
    const eqL = clean(shapeL({ en:'Are all its sides equal?', hi:'क्या इसकी सारी भुजाएँ बराबर हैं?' }, ['No','Yes'], ['नहीं','हाँ'], { ask:'equal' }));
    const warns = JSON.parse(E(`JSON.stringify(sylLessonWarnings(${JSON.stringify(eqL.lesson)}).map(w => w.en))`));
    check('the teacher is told when a lesson has one question (a coin toss) and when every "all sides equal?" answer is the same — in both languages, not a rejection',
      eqL.ok && warns.length === 2 && /half the time/.test(warns[0]) && /always says No/.test(warns[1]), JSON.stringify(warns));
    check("…and the example lesson in Gemini's prompt gets no warning but the coin toss it really has", JSON.parse(E(`JSON.stringify(sylLessonWarnings(${JSON.stringify(ex.lesson)}).map(w => w.en))`)).length <= 1, '');
    // the ninth run's reading: "by folding" can't be checked on a screen; 4 and 4; झुकाओ for fold
    const fold = JSON.parse(E(`JSON.stringify(sylAimGaps({ beats:[{ t:'figure', kind:'circle', folds:3, ask:'meet' }, { t:'ask' }], aims:[{ point:{ en:'The child can find the centre of a circle by folding.', hi:'x' } }, { point:{ en:'The child can see where two fold lines meet.', hi:'x' } }] }).map(a => a.point.en))`));
    check('"…by folding" is flagged as something a screen can\'t check; "where two fold lines meet" is not', fold.length === 1 && /by folding/.test(fold[0]), JSON.stringify(fold));
    const same = JSON.parse(E(`JSON.stringify(sylLessonWarnings({ beats:[{ t:'figure', kind:'rectangle', w:5, h:2, ask:'sides', say:{ en:'x', hi:'आयत को झुकाओ' } }, { t:'ask', opts:['3','4'], correct:1 }, { t:'figure', kind:'rectangle', w:4, h:2, ask:'corners' }, { t:'ask', opts:['5','4'], correct:1 }],
      aims:[{ point:{ en:'x', hi:'y' }, forget:{ en:'How?', hi:'मैं कैसे पता चलूँ?' }, hints:[{ en:'a', hi:'b' }, { en:'c', hi:'d' }] }] }).map(w => w.en))`));
    check('the teacher is told when every question has the same right answer, and about Hindi a draft gets wrong here (झुकाओ for fold, पता चलूँ) — in Munni\'s lines too',
      same.length === 3 && /same|"4"/.test(same[0]) && /मोड़/.test(same[1]) && /पता करूँ/.test(same[2]), JSON.stringify(same));
    const c3 = JSON.parse(E(`JSON.stringify(sylSkills(sylClass('c3')).map(s => s.id))`));
    check('a Class 3 chapter may name the shape skills — flat shapes (Class 1), angles and perimeter (Class 4) — Class 3 skills first', ['shapes2d','angles','perimeter'].every(id => c3.includes(id)) && c3.length <= 60, JSON.stringify(c3));
    bad('a maths question needs a number for its answer', (() => { const x = clone(MATH); x.beats[2].opts = ['twenty-five','65']; return x; })(), /must be a number/);
    const again = JSON.parse(E(`JSON.stringify(sylClean(sylClean(${JSON.stringify(MATH)}, { band:'developing' }).lesson, { band:'developing' }))`));
    check('checking is idempotent: a checked lesson checks the same again (same id, still passes)', again.ok && again.lesson.id === m.lesson.id, JSON.stringify(again.errors));
    // the shuffle is by content, so check over many lessons rather than trusting a few to land both ways
    const sides = Array.from({ length: 12 }, (_, k) => { const x = clone(k % 2 ? MATH : READ); x.title = { en: x.title.en + ' ' + k, hi: x.title.hi + ' ' + k }; return clean(x).lesson.beats.find(b => b.t === 'ask').correct; });
    check('the right answer is not always the first option', new Set(sides).size === 2, JSON.stringify(sides));
    // and in one lesson with 2+ questions the right answers are never all in one slot (Mridang ch1: 6 of 6 on the second button)
    const slotsOf = l => l.beats.filter(b => b.t === 'ask').map(b => b.correct).join('');
    const twoAsk = k => { const x = clone(READ); x.title = { en: x.title.en + ' two ' + k, hi: x.title.hi + ' ' + k }; const a = x.beats.find(b => b.t === 'ask');
      x.beats.splice(x.beats.indexOf(a) + 1, 0, ...(k % 2 ? [{ t: 'readline', say: { en: 'Read this line.', hi: 'यह पंक्ति पढ़ो।' }, text: 'Meena has a red kite.' }] : []),
        { ...clone(a), q: { en: 'Is the kite red?', hi: 'क्या पतंग लाल है?' }, opts: ['Yes', 'No'], hiOpts: ['हाँ', 'नहीं'], correct: 0 }); return x; };   // questions 1 or 2 beats apart
    const many = Array.from({ length: 24 }, (_, k) => clean(twoAsk(k)));
    const plain = many.map(r => r.lesson.beats.map((b, i) => [b, i]).filter(([b]) => b.t === 'ask').map(([, i]) => Number(E(`seedOf(${JSON.stringify(r.lesson.id + i)}) & 1`))).join(''));
    check('two questions: the right answers are never both in one slot — the first from the hash, the last flipped when every later one matched (both cases met)',
      many.every(r => r.ok && new Set(slotsOf(r.lesson)).size === 2) && plain.some(p => p[0] === p[1]) && plain.some(p => p[0] !== p[1])
      && many.every((r, k) => slotsOf(r.lesson)[0] === plain[k][0] && (plain[k][0] !== plain[k][1] ? slotsOf(r.lesson) === plain[k] : slotsOf(r.lesson)[1] !== plain[k][1])),
      JSON.stringify([many.map(r => slotsOf(r.lesson)), plain, many.filter(r => !r.ok).map(r => r.errors)]));
    const reCleaned = many.map(r => JSON.parse(E(`JSON.stringify(sylClean(${JSON.stringify(r.lesson)}, { band: 'developing' }).lesson)`)));
    check('…the id doesn\'t move with the order, and checking a stored lesson again (as schoolLessons() does) gives the same id and the same order',
      reCleaned.every((l, k) => l.id === many[k].lesson.id && slotsOf(l) === slotsOf(many[k].lesson)) && clean({ ...twoAsk(3), beats: twoAsk(3).beats.map(b => b.t === 'ask' ? { ...b, opts: b.opts.slice().reverse(), hiOpts: b.hiOpts.slice().reverse(), correct: 1 - b.correct } : b) }).lesson.id === many[3].lesson.id,
      JSON.stringify(reCleaned.map(slotsOf)));

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
    check('…and a "fix" that came back exactly as sent is said so to the teacher', E(`S.ctx.sylRes.drafts[3].unchanged`) === true && /fix changed nothing/.test(screen()), E(`JSON.stringify(S.ctx.sylRes.drafts.map(d => !!d.unchanged))`));
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

  /* ---------- 5. tools/try-syllabus.mjs: one chapter through the whole pipeline, as the live run will ---------- */
  try{
    const tool = await import(pathToFileURL(path.join(root, 'tools/try-syllabus.mjs')).href);
    const FIXED = clone(MATH); FIXED.title = { en:'Mangoes again', hi:'फिर से आम' };
    const seen = []; let n = 0;
    const stand = gemini(body => { seen.push(body); return n++ === 0 ? { chapter:'Subtraction', lessons:[MATH, WRONG_SUM, NOT_IN_TEXT] } : { lessons:[FIXED, NOT_IN_TEXT] }; });
    const pdfFile = path.join(require('os').tmpdir(), 'takhti-try-chapter.pdf');
    fs.writeFileSync(pdfFile, Buffer.from('%PDF-1.4 ' + 'x'.repeat(400)));
    const res = await tool.run({ file: pdfFile, cls: 'c3', count: 3, env: { GEMINI_API_KEY: 'gk-tool-secret', GEMINI_MODEL: 'gemini-test' } }, stand);
    const v = res.drafts.map(x => x.verdict);
    check('try-syllabus: the chapter goes to Gemini, each draft through the phone\'s own checker, failures back once with the reasons — passed / repaired / not used',
      v.join() === 'passed,repaired,not used' && seen.length === 2 && JSON.parse(seen[1].contents[0].parts[0].text).lessons.length === 2
        && JSON.parse(seen[1].contents[0].parts[0].text).lessons[0].errors.length > 0 && seen[0].contents[0].parts[0].inline_data.mime_type === 'application/pdf', v.join());
    const md = tool.report(res), raw = JSON.stringify(res);
    check('try-syllabus: the report names the verdicts, why each failed, the aims kept and the marked answer — and the key is in neither file',
      /1 passed first time · 1 fixed by the repair round · 1 not used/.test(md) && /Why it failed/.test(md) && /Aims kept/.test(md) && /\*\*25 ✓\*\*/.test(md)
        && !md.includes('gk-tool-secret') && !raw.includes('gk-tool-secret'), md.slice(0, 400));
    check('try-syllabus: every model\'s outcome is kept in raw.json and shown in the report', Array.isArray(res.tried) && res.tried.length >= 1 && /Models for the draft: \S+ ok \(\d+ s\)/.test(md), JSON.stringify(res.tried));
    // --recheck: the saved drafts through today's checker, no Gemini
    const before = seen.length, again = tool.recheck(JSON.parse(raw));
    check('try-syllabus --recheck: a saved run checked again by today\'s checker — the same verdicts here, no call to Gemini, and the report says it was checked again',
      again.drafts.map(x => x.verdict).join() === 'passed,repaired,not used' && seen.length === before && /Checked again on/.test(tool.report(again)), again.drafts.map(x => x.verdict).join());
    let msg = '';
    try{ await tool.run({ text: pdfFile, env: { GEMINI_API_KEY: '', GOOGLE_API_KEY: '' } }, stand); }catch(e){ msg = e.message; }
    check('try-syllabus: with no key it says where the key goes, and calls nobody', /voice\/\.env/.test(msg) && seen.length === 2, msg);
    let busy = 0;
    const flaky = async (url, o) => (busy++ < 2 ? { ok:false, status:503, json: async () => ({}) } : stand(url, o));
    n = 0; const said = [];
    const rb = await tool.run({ file: pdfFile, cls: 'c3', count: 3, retryMs: 0, say: x => said.push(x), env: { GEMINI_API_KEY: 'gk-tool-secret', GEMINI_MODEL: 'gemini-test', GEMINI_FALLBACK_MODEL: 'none', TAKHTI_SYLLABUS_RETRY_MS: 1 } }, flaky);
    check('try-syllabus: Gemini busy → it says so and tries once more by itself', rb.drafts.length === 3 && said.some(x => /busy right now.*trying once more/.test(x)), said.join(' | '));
  }catch(e){ check('try-syllabus ran', false, e.stack); }
  appServer.close();
  win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
