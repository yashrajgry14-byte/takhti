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
   (default gemini-3.8-flash; GEMINI_FALLBACK_MODEL, default
   gemini-3.5-flash-lite, when that one is busy). TAKHTI_SYLLABUS_KEY, if set, is a school
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
        beats:{ type:'array', items:{
          type:'object',
          properties:{
            t:{ type:'string', enum: BEAT_TYPES },
            say: bi, a:{ type:'integer' }, b:{ type:'integer' }, n:{ type:'integer' }, hops:{ type:'integer' },
            p: bi, art:{ type:'string' }, w:{ type:'string' }, text:{ type:'string' },
            q: bi, opts:{ type:'array', items:{ type:'string' } }, hiOpts:{ type:'array', items:{ type:'string' } },
            correct:{ type:'integer' },
            why: { ...bi, description:'For the teacher only: why children pick the wrong answer.' },
            kind:{ type:'string', enum:['square','rectangle','triangle','circle'] }, s:{ type:'integer' }, w:{ type:'integer' }, h:{ type:'integer' },
            sides:{ type:'array', items:{ type:'integer' } }, folds:{ type:'integer' }, deg:{ type:'integer' },
            ask:{ type:'string', enum:['name','sides','corners','perimeter','equal','meet','kind'] },
            items:{ type:'array', items:{ type:'object', properties:{ kind:{ type:'string', enum:['square','rectangle','triangle','circle','corner'] },
              s:{ type:'integer' }, w:{ type:'integer' }, h:{ type:'integer' }, sides:{ type:'array', items:{ type:'integer' } }, deg:{ type:'integer' } }, required:['kind'] } },
            find:{ type:'string', enum:['square','rectangle','triangle','circle','squarecorner','odd'] }
          },
          required:['t']
        } }
      },
      required:['title','sub','aims','beats']
    } }
  },
  required:['lessons']
};

function instructions(rules, count, skills, note){
  return `You write short practice lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (age band "${rules.band}").
A teacher has given you a chapter from their own school's syllabus. Write ${count} lesson(s) that practise what THIS chapter teaches — nothing from outside it.

Every lesson is a list of "beats" the app draws on screen with the child's favourite game pieces, and narrates aloud. Use ONLY these beat types and fields:
- intro {say}: an opening line.
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
- word {w, art}: one word to read.
- readline {text}: one sentence for the child to read aloud.
- ask {q, opts, hiOpts, correct, why}: a question with exactly 2 options; correct is the index of the right one; why (for the teacher only, never shown to the child) says why children pick the wrong one.
- figure {kind, s | w,h | sides, folds, ask}: Takhti draws one shape — a square (side s), a rectangle (w by h, w and h different), a triangle (sides [a,b,c]) or a circle (folds = 0–4 fold lines through the middle). Side lengths are labelled. Without ask it is for teaching (corners are marked); with ask, the very next beat is a question about it: ask = name | sides | corners | perimeter | equal (are all sides equal? Yes/No) | meet (where the folds meet: Centre, needs 2+ folds).
- corner {deg, ask}: Takhti draws one corner of deg degrees (20–160). With ask:"kind" the next question's answer is "Square corner", "Smaller corner" or "Bigger corner" (square = 90).
- figures {items, find}: 2–4 shapes or corners in a row, numbered 1–4 (an item is {kind, s|w,h|sides} or {kind:"corner", deg}). find = square | rectangle | triangle | circle | squarecorner | odd; exactly one must match, and the next question's answer is its NUMBER.
- win {say}: the closing line — the one idea to remember.

Every lesson starts with its AIMS: 3 short points a teacher can approve ("The child can …"), the Hindi saying exactly what the English says. Every aim is taught in the beats AND checked by a question — never an aim only a question touches.

Hard rules — a checker rejects any lesson that breaks one:
1. 4 to 8 beats; start with intro, passage or a figure; at least one ask; end with win.
2. A maths ask comes right after the beat that shows it, and its right answer is a number equal to what that beat computes (count → n, add → a+b, take → a−b, group → a, array → a×b, share → a÷b, bar → a−b, line → a+b×hops, frac → b). Write numbers as digits in opts and hiOpts.
3. A reading ask comes after a passage/word/readline, and its right answer uses the passage's own words.
3b. A shape ask comes right after the figure/corner/figures it is about, and its right answer is what that drawing shows. For anything about shapes, sides, corners or perimeter, USE these drawings — never describe a shape only in words.
3c. Never say the answer in the lines just before a question, and never put the definition in the question itself: the child works it out from the picture or the numbers (the checker rejects a question whose answer Munni has just said). Where you can, ask two questions — one to recognise, one to apply to something new.
4. The wrong option is a mistake a child really makes (one off, forgot to carry, added instead of subtracting, a detail from the wrong sentence) — never silly, never equal to the right one.
5. Every number a child meets is at most ${rules.maxNumber}.
6. Every say and q is at most ${rules.sayWords} words in Hindi; short, warm, concrete; speak to the child as "तुम", never "आप"; never scold, never the word "wrong".
7. title, sub, say, q, p are objects with natural English "en" AND natural Hindi "hi" in Devanagari (not transliteration). opts are English, hiOpts the same answers in Hindi, same order.
8. Plain text only: no markup, no brackets of code, no links. ic and art are a single emoji. Sizes are written "6 × 3" or "sides 6 and 3" — in Hindi never translate "by" as गुणा.
9. skill: the id from this list that the lesson practises, or "" if none fits: ${skills.length ? skills.map(s => `${s.id} (${s.en})`).join('; ') : '(none given)'}.
10. source: where in the chapter it comes from.
${note ? `The teacher's note: "${note}"` : ''}
Answer with JSON only, in the given schema.`;
}

function repairInstructions(rules){
  return `You fix lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (band "${rules.band}"). Each lesson below was rejected by Takhti's checker; its reasons are listed. Return each lesson fixed — same topic, same format, same aims, every reason addressed — and change nothing else. If a reason says the answer was said just before a question, change the narration (or ask about a new example), not the answer. Numbers at most ${rules.maxNumber}; every say and q at most ${rules.sayWords} words in Hindi; a maths answer must equal what the beat before it computes; a reading answer must use the passage's words; exactly 2 options; English and Devanagari Hindi everywhere; plain text only. Answer with JSON only, in the given schema.`;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function callGemini(parts, system, env, fetchImpl){
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  // the chosen model, then a lighter one when Google says it's busy (503/429)
  // or doesn't know the model (404) — GEMINI_FALLBACK_MODEL, 'none' to switch off
  const primary = env.GEMINI_MODEL || 'gemini-3.8-flash';
  const fallback = env.GEMINI_FALLBACK_MODEL === 'none' ? null : (env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite');
  const models = [primary].concat(fallback && fallback !== primary ? [fallback] : []);
  const urlFor = m => `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
  const base = { systemInstruction:{ parts:[{ text: system }] }, contents:[{ role:'user', parts }] };
  // the current structured-output field first; older deployments of the API
  // take responseMimeType/responseJsonSchema — one retry covers both
  const shapes = [
    { generationConfig:{ temperature:0.4, responseFormat:{ text:{ mimeType:'APPLICATION_JSON', schema: SCHEMA } } } },
    { generationConfig:{ temperature:0.4, responseMimeType:'application/json', responseJsonSchema: SCHEMA } }
  ];
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), Number(env.TAKHTI_SYLLABUS_TIMEOUT_MS || 55000));
  try{
    let res, d, model;
    const busy = s => s === 503 || s === 429;
    models: for(model of models){
      for(const shape of shapes){
        for(let attempt = 0; attempt < 2; attempt++){
          res = await fetchImpl(urlFor(model), { method:'POST', signal: ctl.signal,
            headers:{ 'content-type':'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ ...base, ...shape }) });
          d = await res.json().catch(() => ({}));
          if(!busy(res.status)) break;
          if(attempt === 0) await wait(Number(env.TAKHTI_SYLLABUS_RETRY_MS || 1500));   // once more, a moment later
        }
        if(res.ok) break models;
        if(busy(res.status) || res.status === 404) continue models;                  // busy, or no such model: the next one
        if(res.status !== 400) break models;                                          // 400: the other request shape
      }
    }
    if(!res.ok) return { error: busy(res.status) ? 'Gemini is busy right now — try again in a few minutes' : `Gemini said ${res.status}`, status: 502 };
    const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
    let out;
    try{ out = JSON.parse(text); }catch(e){ return { error:'Gemini did not answer in the lesson format', status: 502 }; }
    return { out, model };
  }catch(e){
    return { error:'Gemini did not answer in time', status: 504 };
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
    const r = await callGemini([{ text: JSON.stringify({ lessons: items }) }], repairInstructions(rules), env, fetchImpl);
    if(r.error) return { status: r.status, json:{ error: r.error } };
    return { status:200, json:{ lessons: (Array.isArray(r.out.lessons) ? r.out.lessons : []).filter(l => l && typeof l === 'object').slice(0, items.length), model: r.model } };
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
  const skills = (Array.isArray(body.skills) ? body.skills : []).filter(s => s && SKILL.test(s.id)).slice(0, 40)
    .map(s => ({ id: s.id, en: plain(s.en, 60) }));
  const note = plain(body.note, 200).trim();
  parts.push({ text: `Write ${count} lesson(s) from this chapter.` });

  const r = await callGemini(parts, instructions(rules, count, skills, note), env, fetchImpl);
  if(r.error) return { status: r.status, json:{ error: r.error } };
  return { status:200, json:{
    chapter: plain(r.out.chapter, 80),
    lessons: (Array.isArray(r.out.lessons) ? r.out.lessons : []).filter(l => l && typeof l === 'object').slice(0, count),
    model: r.model
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
