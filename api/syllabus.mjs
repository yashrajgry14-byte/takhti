/* ==================================================================
   THE SCHOOL'S OWN SYLLABUS → THIS WEEK'S LESSONS (Gemini)

   A teacher uploads a chapter — a PDF, a photo of the textbook page, or
   the text pasted in — and Gemini drafts a few short Takhti lessons from
   it, in Takhti's own lesson format (the beats the lesson player already
   draws: counting, adding, sharing, the bar, a passage to read, a
   question with two answers…).

   This function only DRAFTS. It never decides what a child sees:
     · the phone checks every draft with the app's own lesson checker
       (validateLesson() in src/core/lesson-gen.js, plus the school
       checks in src/core/syllabus.js: the arithmetic of every answer,
       numbers inside the child's age band, sentence lengths, an answer
       to a reading question that the passage really states, plain text
       only), and throws away anything that fails;
     · a draft that fails goes back here ONCE, with the checker's own
       reasons, for Gemini to fix ("repair") — and is checked again;
     · the teacher reads every lesson and approves it before it reaches
       a child, and every child's phone checks it again on arrival.
   That is the "network loads tomorrow" rule: Gemini prepares next week's
   lessons; nothing in a child's lesson waits for it.

   POST { mode:'draft', chapter:{text}|{file,mime}, rules, count, skills, note, schoolKey? }
   POST { mode:'repair', repair:[{lesson, errors}], rules, schoolKey? }
   → { lessons:[…raw drafts…], chapter, model }

   Keys stay here: GEMINI_API_KEY (or GOOGLE_API_KEY), GEMINI_MODEL
   (default gemini-3.8-flash; GEMINI_FALLBACK_MODEL, a comma list tried in
   turn when that one is busy, default gemini-3.7-flash,gemini-3.5-flash-lite). TAKHTI_SYLLABUS_KEY, if set, is a school
   password the teacher view must send. Works as a Netlify function
   (Request → Response), with the Vercel-style (req, res) signature
   api/ask.js uses, and inside the voice server (voice/server.js,
   POST /syllabus — no serverless time limit there).
   ================================================================== */

const BANDS = ['pre', 'early', 'developing', 'fluent'];
const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_TEXT = 30000;
/* A chapter's PDF, in MB. Serverless hosts cap a request near 6 MB, so 3.4 by
   default; the voice server has no such cap and sets 12 (TAKHTI_SYLLABUS_MAX_MB).
   Gemini takes up to 20 MB inline per request — 12 MB of PDF is ~16 MB encoded. */
const maxMb = env => Math.min(14, Math.max(1, Number(env.TAKHTI_SYLLABUS_MAX_MB) || 3.4));
const maxB64 = env => Math.ceil(maxMb(env) * 1024 * 1024 * 4 / 3) + 1024;
const BEAT_TYPES = ['intro','count','add','take','group','line','array','share','bar','frac','figure','corner','figures','passage','word','readline','ask','win'];
const SKILL = /^[a-z0-9-]{1,24}$/;
const HITS = new Map();

const clamp = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const plain = (s, max) => String(s == null ? '' : s).replace(/[<>`{}\\]/g, '').slice(0, max);

function rateOk(ip, env){
  const per = Number(env.TAKHTI_SYLLABUS_PER_HOUR || 20), now = Date.now();
  const xs = (HITS.get(ip) || []).filter(t => now - t < 36e5);
  if(xs.length >= per){ HITS.set(ip, xs); return false; }
  xs.push(now); HITS.set(ip, xs);
  if(HITS.size > 5000) HITS.delete(HITS.keys().next().value);
  return true;
}
async function same(a, b){
  const { timingSafeEqual } = await import('node:crypto');
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

/* The age band's rules, sent by the phone (from content/ages.js) and
   clamped here, so the prompt can never be stretched past a sane range. */
function cleanRules(r){
  r = r || {};
  const band = BANDS.includes(r.band) ? r.band : 'developing';
  const ages = Array.isArray(r.ages) ? r.ages.map(a => clamp(a, 3, 16, 7)).slice(0, 2) : [7, 8];
  return { band, ages, maxNumber: clamp(r.maxNumber, 5, 10000, 100), sayWords: clamp(r.sayWords, 6, 30, 18), read: BANDS.includes(r.read) ? r.read : band };
}

/* The shape Gemini must answer in — Takhti's lesson format, flattened. */
const bi = { type:'object', properties:{ en:{ type:'string' }, hi:{ type:'string' } }, required:['en','hi'] };
/* What Gemini must answer in. Not a free list of beats: the third live run
   (flash-lite) sent a question with no answers and two lessons with no
   question at all, because a flat beat schema could only require a beat's
   type. So a lesson is SHAPED like a lesson — an intro, 1–4 things that
   teach, 1–2 questions each with its own picture, exactly two answers, the
   right one's index and a teacher's note, all required — and toBeats()
   turns it into Takhti's beats. The checker still checks everything. */
const PIC_TYPES = BEAT_TYPES.filter(t => !['intro', 'ask', 'win'].includes(t));
const PIC = {
  type:'object',
  properties:{
    t:{ type:'string', enum: PIC_TYPES },
    say: bi, a:{ type:'integer' }, b:{ type:'integer' }, n:{ type:'integer' }, hops:{ type:'integer' },
    p: bi, art:{ type:'string' }, word:{ type:'string' }, text:{ type:'string', description:'A reading passage only — never a shape\'s sizes or folds (those have their own number fields).' },
    kind:{ type:'string', enum:['square','rectangle','triangle','circle'] },
    s:{ type:'integer', description:'square: its side' }, w:{ type:'integer', description:'rectangle: its width (h is needed too)' },
    h:{ type:'integer', description:'rectangle: its height — always give it, different from w' },
    sides:{ type:'array', items:{ type:'integer' }, description:'triangle: its three sides' },
    folds:{ type:'integer', description:'circle: how many fold lines, 0–4 (a number here, never in text)' },
    deg:{ type:'integer', description:'corner: its size in degrees, 20–160' },
    items:{ type:'array', description:'figures: the 2–4 shapes in the row', items:{ type:'object', properties:{ kind:{ type:'string', enum:['square','rectangle','triangle','circle','corner'] },
      s:{ type:'integer' }, w:{ type:'integer' }, h:{ type:'integer', description:'rectangle: always give it, different from w' }, sides:{ type:'array', items:{ type:'integer' } }, folds:{ type:'integer' }, deg:{ type:'integer' } }, required:['kind'] } },
    find:{ type:'string', enum:['square','rectangle','triangle','circle','squarecorner','odd'], description:'figures: which ONE item the question looks for — always give it' }
  },
  required:['t']
};
const answers = { type:'array', items:{ type:'string' }, minItems:2, maxItems:2 };
const QUESTION = {
  type:'object',
  properties:{
    show: { ...PIC, description:'The picture this question is about — a different example from the teaching pictures.' },
    ask:{ type:'string', enum:['name','sides','corners','perimeter','equal','meet','kind','none'],
          description:'For a figure: what is asked about it. For a corner: kind. Anything else (sums, a passage, a numbered row): none.' },
    q: bi, opts: answers, hiOpts: answers,
    correct:{ type:'integer', enum:[0, 1] },
    why: { ...bi, description:'For the teacher only: the misconception behind the wrong answer.' }
  },
  required:['show','ask','q','opts','hiOpts','correct','why']
};
const SCHEMA = {
  type:'object',
  properties:{
    chapter:{ type:'string', description:'The chapter or topic, in a few words.' },
    lessons:{ type:'array', items:{
      type:'object',
      properties:{
        title: bi, sub: bi,
        ic:{ type:'string', description:'One emoji.' },
        skill:{ type:'string', description:'One id from the skill list, or "".' },
        source:{ type:'string', description:'Where in the chapter this comes from (page, heading, exercise).' },
        aims:{ type:'array', minItems:1, maxItems:4, items: bi, description:'What the child will be able to do — 3 short points a teacher approves.' },
        intro: { ...bi, description:'The opening line. Never the answer.' },
        teach:{ type:'array', minItems:1, maxItems:4, items: PIC, description:'Teaching pictures and worked examples, before any question.' },
        questions:{ type:'array', minItems:1, maxItems:2, items: QUESTION },
        remember: { ...bi, description:'The closing line — the one idea to remember.' }
      },
      required:['title','sub','aims','intro','teach','questions','remember']
    } }
  },
  required:['lessons']
};

/* Gemini's lesson shape → Takhti's beats (and back, for the repair round).
   A lesson already in beats passes through unchanged. */
const FIG_ASKS = ['name','sides','corners','perimeter','equal','meet'];
export function toBeats(l){
  if(!l || typeof l !== 'object' || Array.isArray(l.beats) || !Array.isArray(l.questions)) return l;
  const { intro, teach, questions, remember, ...rest } = l;
  const beats = [];
  if(intro) beats.push({ t:'intro', say: intro });
  for(const x of Array.isArray(teach) ? teach : []) if(x && typeof x === 'object'){ const { ask, ...pic } = x; beats.push(pic); }
  for(const qn of questions){
    if(!qn || typeof qn !== 'object') continue;
    const show = qn.show && typeof qn.show === 'object' ? { ...qn.show } : null;
    if(show){
      delete show.ask;
      if(show.t === 'figure' && FIG_ASKS.includes(qn.ask)) show.ask = qn.ask;
      if(show.t === 'corner') show.ask = 'kind';
      beats.push(show);
    }
    beats.push({ t:'ask', q: qn.q, opts: qn.opts, hiOpts: qn.hiOpts, correct: qn.correct, why: qn.why });
  }
  if(remember) beats.push({ t:'win', say: remember });
  return { ...rest, beats };
}
function fromBeats(l){
  if(!l || !Array.isArray(l.beats)) return l;
  const { beats, ...rest } = l, out = { ...rest, intro: null, teach: [], questions: [], remember: null };
  beats.forEach((b, i) => {
    if(!b || typeof b !== 'object') return;
    if(b.t === 'intro') out.intro = out.intro || b.say;
    else if(b.t === 'win') out.remember = b.say;
    else if(b.t === 'ask'){
      const prev = beats[i - 1] && beats[i - 1].t !== 'ask' && beats[i - 1].t !== 'intro' ? beats[i - 1] : null;
      if(prev && out.teach[out.teach.length - 1] === prev) out.teach.pop();
      const { ask, ...show } = prev || {};
      out.questions.push({ show: prev ? show : null, ask: prev && prev.t === 'corner' ? 'kind' : (ask || 'none'), q: b.q, opts: b.opts, hiOpts: b.hiOpts, correct: b.correct, why: b.why });
    } else out.teach.push(b);
  });
  return out;
}

/* What Takhti can draw, and the rules its checker holds a lesson to —
   one text, used by the draft AND the repair round (the first live run's
   repair fixed nothing: it was told "add ask" without being told what ask is). */
function beatsText(){
  return `Every lesson has this shape (the schema enforces it):
- intro: the opening line (never the answer);
- teach: 1–4 pictures or worked examples that TEACH, before any question;
- questions: TWO questions (at least one). Each has its own picture "show" — a DIFFERENT example from the teaching pictures — then q, exactly two answers (opts in English, hiOpts the same in Hindi), correct (0 or 1), and why (for the teacher: the misconception behind the wrong answer). "ask" says what is asked about a figure (name | sides | corners | perimeter | equal | meet), "kind" for a corner, "none" for anything else;
- remember: the closing line — the one idea to remember.

The pictures (for teach and for each question's show) — use ONLY these:
- count {n}: n objects appear (n ≤ 20).
- add {a,b}: a objects, then b more arrive (a,b ≤ 10).
- take {a,b}: a objects, b go away (a ≤ 20, b ≤ a).
- group {a}: the number a shown as bundles of ten and loose ones (a ≤ 99).
- line {a,b,hops}: a number line from a, jumping b each hop (a ≤ 50, b ≤ 10, hops ≤ 10).
- array {a,b}: a rows of b (a,b ≤ 10).
- share {a,b}: a shared equally between b (b ≤ 6, a divisible by b, a ≤ 40).
- bar {a,b}: a bar model: whole a, known part b (b ≤ a ≤ 100).
- frac {b}: one whole cut into b equal parts (2 ≤ b ≤ 8).
- passage {p, art}: a short text to read (3–5 short sentences), art is one emoji.
- word {word, art}: one word to read.
- readline {text}: one sentence for the child to read aloud.
- figure {kind, s | w,h | sides, folds}: Takhti draws ONE shape — a square (s = its side), a rectangle (w AND h, both needed, different numbers), a triangle (sides = [a,b,c], three numbers that make a triangle) or a circle (folds = 0–4 fold lines through the middle). Side lengths are labelled. In teach it is a teaching picture (corners marked, Munni says what it is). As a question's show, its "ask" says what is asked: name (which shape?) | sides | corners | perimeter (add every side) | equal (are all its sides equal? Yes / No) | meet (where do the folds meet? Centre — needs folds ≥ 2).
- corner {deg}: one corner of deg degrees (20–160; 90 is a square corner). As a show, ask is "kind" and the answers are two of "Square corner" / "Smaller corner" / "Bigger corner" (Hindi: चौकोर कोना / छोटा कोना / बड़ा कोना).
- figures {items, find}: 2–4 shapes or corners in a row, numbered 1–4 (an item is {kind, s | w,h | sides} or {kind:"corner", deg}). find = square | rectangle | triangle | circle | squarecorner | odd; exactly ONE item must match; the answers are numbers like "2"; ask is "none".
- A square corner is in a corner of 90, a square, a rectangle, or a triangle with one (3-4-5, 6-8-10): find = squarecorner works on a row of shapes too, so only ONE item in the row may have a square corner (not a rectangle AND a 3-4-5 triangle). A triangle that only looks nearly square-cornered (e.g. 5-5-7) can't be in such a row.
- Every size is its own number field — s, w, h, sides, folds, deg — never written into text ("folds 2" in text is lost). A rectangle always has BOTH w and h, in a row too; a row always has its find.
A picture can carry a short say (what Munni says while it shows). Never put a why on a picture.

An example of one good lesson (the shape of it, not its content):
{"title":{"en":"Sides and corners","hi":"भुजाएँ और कोने"},"sub":{"en":"Go round the shape","hi":"आकृति के चारों ओर"},"ic":"🔷","skill":"shapes2d","source":"Page 61",
 "aims":[{"en":"The child can count the sides of a shape.","hi":"बच्चा किसी आकृति की भुजाएँ गिन सकता है।"},{"en":"The child can find the shape with 3 sides.","hi":"बच्चा 3 भुजाओं वाली आकृति ढूँढ सकता है।"}],
 "intro":{"en":"Shapes have sides. Let us count them.","hi":"आकृतियों की भुजाएँ होती हैं। आओ गिनें।"},
 "teach":[{"t":"figure","kind":"square","s":4}],
 "questions":[
  {"show":{"t":"figure","kind":"triangle","sides":[5,5,5]},"ask":"sides","q":{"en":"How many sides does it have?","hi":"इसकी कितनी भुजाएँ हैं?"},"opts":["3","4"],"hiOpts":["3","4"],"correct":0,
   "why":{"en":"Children who just saw the square expect every shape to have 4 sides.","hi":"वर्ग देखने के बाद बच्चे हर आकृति की 4 भुजाएँ मान लेते हैं।"}},
  {"show":{"t":"figures","items":[{"kind":"rectangle","w":6,"h":3},{"kind":"triangle","sides":[3,4,5]},{"kind":"square","s":3}],"find":"triangle"},"ask":"none","q":{"en":"Which number has 3 sides?","hi":"किस नंबर वाली आकृति की 3 भुजाएँ हैं?"},"opts":["2","1"],"hiOpts":["2","1"],"correct":0,
   "why":{"en":"Children pick the first shape they see without counting its sides.","hi":"बच्चे भुजाएँ गिने बिना पहली दिखी आकृति चुन लेते हैं।"}}],
 "remember":{"en":"Go round once and count each side.","hi":"एक बार पूरा घूमो और हर भुजा गिनो।"}}`;
}
function rulesText(rules){
  return `Hard rules — Takhti's checker rejects any lesson that breaks one:
1. Short: 1–4 teaching pictures, then the questions.
2. TEACH, THEN ASK: teach really teaches what the questions check. Every aim is taught AND checked by a question — and is something a child can show on a screen (count, name, find, pick): never "fold a paper" or "cut", and never empty ("find a rectangle with 4 sides" — every rectangle has 4). If an aim says "find", one question is a numbered row to find it in.
3. A maths question's show is the picture it is about, and its right answer is a number equal to what that picture computes (count → n, add → a+b, take → a−b, group → a, array → a×b, share → a÷b, bar → a−b, line → a+b×hops, frac → b). Numbers as digits.
4. A reading question's show is the passage, word or line, and its right answer uses the passage's own words.
5. A shape question's show is the figure/corner/figures it is about, and its right answer is what that drawing shows. For anything about shapes, sides, corners or perimeter, USE the drawings — never describe a shape only in words.
6. Never say the answer in the lines just before a question (the intro counts), and never name it in the question itself ("Are all sides equal in this square?" gives it away — ask "Are all its sides equal?"; "How many sides does this triangle have?" too — ask "How many sides does this shape have?" so the child counts).
6b. TEACH ON ONE SHAPE, ASK ON ANOTHER: a question's show is never a teaching picture again (a teaching picture marks the answer). Teach with a 6 × 3 rectangle, ask about a 4 × 2 one; teach a square corner, ask about a smaller or bigger corner; teach a circle with 2 folds, ask with 3.
6c. Ask TWO questions per lesson: the first to recognise, the second about a NEW example (another shape, a numbered row, an odd one out).
7. The wrong option is a mistake a child really makes — never silly, never equal to the right one. Its why names the misconception behind it ("children judge a corner by how long its arms are", "children count only the top two corners"), never "they might guess" or "they might confuse it". For "where do the folds meet?" the real wrong answer is Edge (किनारा).
8. Every number a child meets is at most ${rules.maxNumber}.
9. Every say and q is at most ${rules.sayWords} words in Hindi; short, warm, concrete; speak to the child as "तुम", never "आप"; never scold, never the word "wrong".
10. title, sub, intro, remember, say, q, p, aims and why are objects with natural English "en" AND natural Hindi "hi" in Devanagari (not transliteration). opts are English; hiOpts are the same answers in Hindi, in Devanagari unless the answer is a number (Yes/No → हाँ/नहीं).
11. Use the words Indian schools use: वर्ग (square), आयत (rectangle), त्रिभुज (triangle), वृत्त (circle), भुजा (side), कोना (corner), चौकोर कोना (square corner), केंद्र (centre), परिमाप (perimeter), तह / तह की रेखा (fold / fold line), ढूँढो (find). Sizes are written "6 × 3" or "sides 6 and 3" — in Hindi never translate "by" as गुणा.
12. Plain text only: no markup, no brackets of code, no links. ic and art are a single emoji.`;
}

function instructions(rules, count, skills, note){
  return `You write short practice lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (age band "${rules.band}").
A teacher has given you a chapter from their own school's syllabus. Write ${count} lesson(s) that practise what THIS chapter teaches — nothing from outside it.

Every lesson starts with its AIMS: 3 short points a teacher can approve ("The child can …"), the Hindi saying exactly what the English says.

${beatsText()}

${rulesText(rules)}
13. skill: the id from this list that the lesson practises, or "" if none fits: ${skills.length ? skills.map(s => `${s.id} (${s.en})`).join('; ') : '(none given)'}.
14. source: where in the chapter it comes from.
${note ? `The teacher's note: "${note}"` : ''}
Answer with JSON only, in the given schema.`;
}

function repairInstructions(rules){
  return `You fix lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (band "${rules.band}"). Each lesson below was rejected by Takhti's checker; its reasons are listed. Each lesson is given in the lesson shape below; return it fixed in the same shape — same topic, same aims, every reason addressed — and change nothing else. The reasons count the lesson's steps in order (intro, teaching pictures, then each question's picture and the question itself, then remember).
How to read the reasons: "must say what is asked (ask)" → set that question's ask to what it asks (sides, corners, name…); "needs exactly 2 answers" / "no checkpoint" → give the question both answers / add a question; "a rectangle needs w and h" → give both, as numbers; "a row needs its find" → set find to the one shape the question looks for; "needs a circle with 2 or more folds" → set folds (its own number field, not text); "say the answer" → change the narration or ask about a new example, not the answer; "teach before you ask" → add a teaching picture (a different shape or size from the question's) before the first question; "the teaching picture again" → change the QUESTION's picture to a different size or shape (and its answer, if that changes); "names the shape" → ask without naming it ("this shape"); "doesn't show the folds" → give the teaching circle folds: 2 or more; "exactly one picture may have a square corner" → change the row so only one item has a square corner; "Hindi answers must be in Devanagari" → write hiOpts in Hindi.

${beatsText()}

${rulesText(rules)}
Answer with JSON only, in the given schema.`;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
/* A model that just hung or said "busy" rests for a few minutes
   (TAKHTI_GEMINI_REST_MS, default 5 min): the repair round and the next
   chapter go straight to the fallback instead of waiting on it again — on
   the first live runs that wait was ~110 s a request. Kept per server
   process; a serverless host forgets it when it goes cold, which is fine. */
const RESTING = new Map();
async function callGemini(parts, system, env, fetchImpl){
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  // the chosen model, then a lighter one when Google says it's busy (503/429)
  // or doesn't know the model (404) — GEMINI_FALLBACK_MODEL, 'none' to switch off
  const primary = env.GEMINI_MODEL || 'gemini-3.8-flash';
  // the fallbacks, in order — a full Flash model before the lite one (the
  // third live run: flash-lite left out whole questions); a comma list
  const fallbacks = env.GEMINI_FALLBACK_MODEL === 'none' ? []
    : String(env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash,gemini-3.5-flash-lite').split(',').map(x => x.trim()).filter(Boolean);
  const all = [primary].concat(fallbacks.filter((m, i) => m !== primary && fallbacks.indexOf(m) === i));
  const now = Date.now(), awake = all.filter(m => !(RESTING.get(m) > now));
  const models = awake.length ? awake : all.slice(-1);               // all resting: the last one still tries
  const urlFor = m => `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
  const base = { systemInstruction:{ parts:[{ text: system }] }, contents:[{ role:'user', parts }] };
  // the current structured-output field first; older deployments of the API
  // take responseMimeType/responseJsonSchema — one retry covers both
  const shapes = [
    { generationConfig:{ temperature:0.4, responseFormat:{ text:{ mimeType:'APPLICATION_JSON', schema: SCHEMA } } } },
    { generationConfig:{ temperature:0.4, responseMimeType:'application/json', responseJsonSchema: SCHEMA } }
  ];
  // the whole request has TAKHTI_SYLLABUS_TIMEOUT_MS (55 s on a serverless host, 180 s on the
  // voice server); one model may take at most 60% of it, so a model that hangs
  // still leaves time for the fallback (the first live run's health check hung for 55 s)
  const total = Number(env.TAKHTI_SYLLABUS_TIMEOUT_MS || 55000), started = Date.now();
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), total);
  // each model may take 60% of what is left while another one waits behind it
  const shareFor = m => { const left = total - (Date.now() - started); return Math.max(2000, Math.floor(left * (models.indexOf(m) < models.length - 1 ? 0.6 : 1))); };
  // what each model said and how long it took (the live runs couldn't tell a
  // hang from "busy" from a key's quota) — returned with the answer, and logged
  const tried = [];
  try{
    let res, d, model;
    const busy = s => s === 503 || s === 429;
    models: for(model of models){
      for(const shape of shapes){
        for(let attempt = 0; attempt < 2; attempt++){
          const one = new AbortController(), left = Math.min(shareFor(model), total - (Date.now() - started));
          const stop = () => one.abort(), t1 = setTimeout(stop, Math.max(1000, left));
          ctl.signal.addEventListener('abort', stop);
          const t0 = Date.now();
          try{
            res = await fetchImpl(urlFor(model), { method:'POST', signal: one.signal,
              headers:{ 'content-type':'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ ...base, ...shape }) });
            d = await res.json().catch(() => ({}));
          }catch(e){
            if(ctl.signal.aborted) throw e;                               // the whole request is out of time
            res = { ok:false, status:503, hung:true }; d = {};            // this model hung: straight to the next one
          }finally{ clearTimeout(t1); ctl.signal.removeEventListener('abort', stop); }
          tried.push({ model, outcome: res.hung ? 'hung' : res.ok ? 'ok' : res.status, ms: Date.now() - t0 });
          if(res.hung || !busy(res.status)) break;
          // (a busy model gets one more try, a moment later)
          if(attempt === 0) await wait(Number(env.TAKHTI_SYLLABUS_RETRY_MS || 1500));   // once more, a moment later
        }
        if(res.ok){ RESTING.delete(model); break models; }
        if(res.hung || busy(res.status)){ RESTING.set(model, Date.now() + (env.TAKHTI_GEMINI_REST_MS != null ? Number(env.TAKHTI_GEMINI_REST_MS) : 300000)); continue models; }
        if(res.status === 404) continue models;                                       // no such model: the next one
        if(res.status !== 400) break models;                                          // 400: the other request shape
      }
    }
    if(env.TAKHTI_SYLLABUS_LOG !== '0') console.log('[syllabus] models:', tried.map(x => `${x.model} ${x.outcome} ${(x.ms / 1000).toFixed(1)}s`).join(' → '));
    // 429 is the key's own limit (requests a minute or a day), not Google being busy
    if(!res.ok) return res.hung ? { error:'Gemini did not answer in time', status: 504, tried }
                                : { error: res.status === 429 ? "this Gemini key's limit is used up for now — try again later, or check the key's quota in AI Studio"
                                    : res.status === 503 ? 'Gemini is busy right now — try again in a few minutes' : `Gemini said ${res.status}`, status: 502, tried };
    const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
    let out;
    try{ out = JSON.parse(text); }catch(e){ return { error:'Gemini did not answer in the lesson format', status: 502, tried }; }
    return { out, model, tried };
  }catch(e){
    return { error:'Gemini did not answer in time', status: 504, tried };
  }finally{ clearTimeout(to); }
}

/* The whole request, independent of any host — exported for the tests
   and the voice server. */
export async function draftCore(body, env, ip, fetchImpl){
  env = env || {}; body = body || {}; fetchImpl = fetchImpl || fetch;
  if(!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY)) return { status:503, json:{ error:'Gemini is not set up on this server' } };
  if(env.TAKHTI_SYLLABUS_KEY && !(await same(body.schoolKey, env.TAKHTI_SYLLABUS_KEY))) return { status:403, json:{ error:'school key needed' } };
  if(!rateOk(ip || '?', env)) return { status:429, json:{ error:'enough for now — try again in a while' } };
  const rules = cleanRules(body.rules);

  if(body.mode === 'repair'){
    const items = (Array.isArray(body.repair) ? body.repair : []).slice(0, 5)
      .filter(x => x && typeof x.lesson === 'object' && JSON.stringify(x.lesson).length < 12000)
      .map(x => ({ lesson: x.lesson, errors: (Array.isArray(x.errors) ? x.errors : []).slice(0, 8).map(e => plain(e, 200)) }));
    if(!items.length) return { status:400, json:{ error:'nothing to repair' } };
    const r = await callGemini([{ text: JSON.stringify({ lessons: items.map(x => ({ lesson: fromBeats(x.lesson), errors: x.errors })) }) }], repairInstructions(rules), env, fetchImpl);
    if(r.error) return { status: r.status, json:{ error: r.error, tried: r.tried } };
    return { status:200, json:{ lessons: (Array.isArray(r.out.lessons) ? r.out.lessons : []).filter(l => l && typeof l === 'object').slice(0, items.length).map(toBeats), model: r.model, tried: r.tried } };
  }

  const ch = body.chapter || {};
  const parts = [];
  if(ch.file){
    const mime = String(ch.mime || '');
    if(!FILE_TYPES.includes(mime)) return { status:400, json:{ error:'a PDF or a photo (PNG, JPEG, WebP) of the chapter' } };
    const b64 = String(ch.file);
    if(b64.length > maxB64(env)) return { status:413, json:{ error:`that file is too big for this server (up to ${maxMb(env)} MB) — send one chapter, or fewer pages`, maxMb: maxMb(env) } };
    // look for one bad character rather than matching the whole string: a
    // whole-string pattern overflows the stack on a multi-megabyte chapter
    if(b64.length < 100 || /[^A-Za-z0-9+/=]/.test(b64)) return { status:400, json:{ error:'that file could not be read' } };
    parts.push({ inline_data:{ mime_type: mime, data: b64 } });
  }
  const text = plain(ch.text, MAX_TEXT).trim();
  if(text) parts.push({ text: 'The chapter:\n' + text });
  if(!parts.length) return { status:400, json:{ error:'no chapter — paste its text or attach a PDF or photo' } };
  const count = clamp(body.count, 1, 5, 3);
  const skills = (Array.isArray(body.skills) ? body.skills : []).filter(s => s && SKILL.test(s.id)).slice(0, 60)
    .map(s => ({ id: s.id, en: plain(s.en, 60) }));
  const note = plain(body.note, 200).trim();
  parts.push({ text: `Write ${count} lesson(s) from this chapter.` });

  const r = await callGemini(parts, instructions(rules, count, skills, note), env, fetchImpl);
  if(r.error) return { status: r.status, json:{ error: r.error, tried: r.tried } };
  return { status:200, json:{
    chapter: plain(r.out.chapter, 80),
    lessons: (Array.isArray(r.out.lessons) ? r.out.lessons : []).filter(l => l && typeof l === 'object').slice(0, count).map(toBeats),
    model: r.model, tried: r.tried
  } };
}

/* Netlify passes (Request, context); Vercel passes (req, res). */
export default async function handler(req, res){
  const vercel = res && typeof res.status === 'function';
  const reply = (status, json) => vercel
    ? res.status(status).json(json)
    : new Response(JSON.stringify(json), { status, headers:{ 'content-type':'application/json' } });
  if(req.method !== 'POST') return reply(405, { error:'POST only' });
  let body;
  try{
    if(vercel) body = req.body;
    else {
      const text = await req.text();
      if(text.length > Math.max(5 * 1024 * 1024, maxB64(process.env) + 512 * 1024)) return reply(413, { error:'too large' });
      body = JSON.parse(text);
    }
  }catch(e){ return reply(400, { error:'bad JSON' }); }
  const ip = vercel ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                    : String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const out = await draftCore(body, process.env, ip);
  return reply(out.status, out.json);
}

export const config = { maxDuration: 60 };
