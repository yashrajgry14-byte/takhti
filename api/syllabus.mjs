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
   turn when that one is busy, default gemini-3.7-flash,gemini-3.5-flash-lite;
   a model that hung or was busy rests a few minutes). TAKHTI_SYLLABUS_KEY, if set, is a school
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

/* The shape Gemini must answer in — Takhti's lesson format.

   One beat schema PER BEAT TYPE (anyOf), each with its own required fields.
   The first live run on a real chapter (13 Nov 2026, Maths Mela Class 3,
   flash-lite) answered a single flattened beat with every field optional:
   all 4 lessons had questions with no options, no Hindi options and no right
   answer, rectangles with no height and circles with no folds — and junk
   s:0 / w:0 / word on every beat. Optional fields are optional to the model.
   Here an ask can't arrive without its two answers, a rectangle without w
   and h, a circle without folds. BEAT_SCHEMA_FLAT (the old one) is only the
   last resort, for an API that refuses the strict schema (400). */
const bi = { type:'object', properties:{ en:{ type:'string' }, hi:{ type:'string' } }, required:['en','hi'] };
const int = { type:'integer' };
const beat = (t, props, req) => ({ type:'object', properties:{ t:{ type:'string', enum:[t] }, ...props }, required:['t', ...req] });
const SHAPE_ASK = { type:'string', enum:['name','sides','corners','perimeter','equal','meet'],
  description:'Only on a question picture (the very next beat is the ask about it); leave it out on a teaching picture.' };
const BEAT_SCHEMA = { anyOf: [
  beat('intro',   { say: bi }, ['say']),
  beat('count',   { n: int, say: bi }, ['n']),
  ...['add', 'take', 'array', 'share', 'bar'].map(t => beat(t, { a: int, b: int, say: bi }, ['a', 'b'])),
  beat('line',    { a: int, b: int, hops: int, say: bi }, ['a', 'b', 'hops']),
  beat('group',   { a: int, say: bi }, ['a']),
  beat('frac',    { b: int, say: bi }, ['b']),
  beat('passage', { p: bi, art:{ type:'string' } }, ['p', 'art']),
  beat('word',    { word:{ type:'string' }, art:{ type:'string' }, say: bi }, ['word', 'art']),
  beat('readline',{ text:{ type:'string' }, say: bi }, ['text']),
  beat('ask',     { q: bi, opts:{ type:'array', items:{ type:'string' }, minItems:2, maxItems:2 }, hiOpts:{ type:'array', items:{ type:'string' }, minItems:2, maxItems:2 },
                    correct:{ type:'integer', minimum:0, maximum:1 }, why:{ ...bi, description:'For the teacher only: the real mistake behind the wrong option.' } },
                  ['q', 'opts', 'hiOpts', 'correct', 'why']),
  { ...beat('figure', { kind:{ type:'string', enum:['square'] }, s: int, ask: SHAPE_ASK, say: bi }, ['kind', 's']), description:'A square: s is its side.' },
  { ...beat('figure', { kind:{ type:'string', enum:['rectangle'] }, w: int, h: int, ask: SHAPE_ASK, say: bi }, ['kind', 'w', 'h']), description:'A rectangle: w and h, two different numbers.' },
  { ...beat('figure', { kind:{ type:'string', enum:['triangle'] }, sides:{ type:'array', items: int, minItems:3, maxItems:3 }, ask: SHAPE_ASK, say: bi }, ['kind', 'sides']), description:'A triangle: three side lengths that make a triangle.' },
  { ...beat('figure', { kind:{ type:'string', enum:['circle'] }, folds:{ type:'integer', minimum:0, maximum:4, description:'how many fold lines, 0–4 — a number here, never in the narration' }, ask: SHAPE_ASK, say: bi }, ['kind', 'folds']), description:'A circle: 0–4 fold lines through the middle; a "meet" question needs 2 or more.' },
  beat('corner',  { deg: int, ask:{ type:'string', enum:['kind'], description:'Only when the next beat asks what kind of corner it is.' }, say: bi }, ['deg']),
  beat('figures', { items:{ type:'array', minItems:2, maxItems:4, description:'the 2–4 shapes in the row', items:{ type:'object', properties:{ kind:{ type:'string', enum:['square','rectangle','triangle','circle','corner'] },
                      s: int, w: int, h:{ type:'integer', description:'rectangle: always give it, different from w' }, sides:{ type:'array', items: int }, folds: int, deg: int }, required:['kind'] } },
                    find:{ type:'string', enum:['square','rectangle','triangle','circle','squarecorner','odd'], description:'which ONE item the question looks for' }, say: bi }, ['items', 'find']),
  beat('win',     { say: bi }, ['say'])
] };
/* the old flattened beat: every field optional — only if the strict schema is refused */
const BEAT_SCHEMA_FLAT = {
  type:'object',
  properties:{
    t:{ type:'string', enum: BEAT_TYPES },
    say: bi, a: int, b: int, n: int, hops: int,
    p: bi, art:{ type:'string' }, word:{ type:'string' }, text:{ type:'string' },
    q: bi, opts:{ type:'array', items:{ type:'string' } }, hiOpts:{ type:'array', items:{ type:'string' } },
    correct: int,
    why: { ...bi, description:'For the teacher only: why children pick the wrong answer.' },
    kind:{ type:'string', enum:['square','rectangle','triangle','circle'] }, s: int, w: int, h: int,
    sides:{ type:'array', items: int }, folds: int, deg: int,
    ask:{ type:'string', enum:['name','sides','corners','perimeter','equal','meet','kind'] },
    items:{ type:'array', items:{ type:'object', properties:{ kind:{ type:'string', enum:['square','rectangle','triangle','circle','corner'] },
      s: int, w: int, h: int, sides:{ type:'array', items: int }, deg: int }, required:['kind'] } },
    find:{ type:'string', enum:['square','rectangle','triangle','circle','squarecorner','odd'] }
  },
  required:['t']
};
const lessonsSchema = beatSchema => ({
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
        aims:{ type:'array', minItems:1, maxItems:4, description:'What the child will be able to do — the points a teacher approves, and that Munni later "forgets" for the child to explain back (Teach Munni).', items:{
          type:'object',
          properties:{ short: bi, point: bi, forget: bi, hints:{ type:'array', items: bi, minItems:2, maxItems:2 },
            ideas:{ type:'array', minItems:1, maxItems:2, items:{ type:'object', properties:{ en:{ type:'string' }, hi:{ type:'string' }, words:{ type:'array', items:{ type:'string' } } }, required:['en','hi','words'] } } },
          required:['short','point','forget','hints','ideas'] } },
        beats:{ type:'array', items: beatSchema }
      },
      required:['title','sub','ic','skill','source','aims','beats']
    } }
  },
  required:['chapter','lessons']
});
const SCHEMA = lessonsSchema(BEAT_SCHEMA);
const SCHEMA_FLAT = lessonsSchema(BEAT_SCHEMA_FLAT);

/* What Takhti can draw, and the rules its checker holds a lesson to —
   one text, used by the draft AND the repair round (the first live run's
   repair fixed nothing: it was told "add ask" without being told what ask is). */
function beatsText(){
  return `Every lesson is a list of "beats" the app draws on screen with the child's favourite game pieces, and narrates aloud. Use ONLY these beat types and fields:
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
- word {word, art}: one word to read.
- readline {text}: one sentence for the child to read aloud.
- ask {q, opts, hiOpts, correct, why}: a question with exactly 2 options; correct is the index of the right one; why (for the teacher only, never shown to the child) names the real misconception behind the wrong option.
- figure {kind, s | w,h | sides, folds, ask}: Takhti draws ONE shape — a square (s = its side), a rectangle (w AND h, both needed, different numbers), a triangle (sides = [a,b,c], three numbers that make a triangle) or a circle (folds = 0–4 fold lines through the middle). Side lengths are labelled on the drawing.
    · A figure WITHOUT ask is a teaching picture: its corners are marked and Munni says what it is.
    · A figure WITH ask is a question picture, and the VERY NEXT beat must be the ask about it. ask is exactly one of: name (which shape is it?) | sides (how many sides?) | corners (how many corners?) | perimeter (all the way round — add every side) | equal (are all its sides equal? answers Yes / No) | meet (where do the folds meet? answer Centre — the circle needs folds ≥ 2).
- corner {deg, ask}: Takhti draws one corner of deg degrees (20–160; 90 is a square corner). Without ask it is a teaching picture. With ask:"kind" the next beat asks what kind it is, and the answers are two of "Square corner" / "Smaller corner" / "Bigger corner" (Hindi: चौकोर कोना / छोटा कोना / बड़ा कोना).
- figures {items, find}: 2–4 shapes or corners in a row, numbered 1–4 (an item is {kind, s | w,h | sides} or {kind:"corner", deg}). find = square | rectangle | triangle | circle | squarecorner | odd; exactly ONE item must match, and the next beat asks which number — its answers are numbers like "2".
    · A square corner is in a corner of 90, a square, a rectangle, or a triangle with one (3-4-5, 6-8-10): find = squarecorner works on a row of shapes too, so only ONE item in the row may have a square corner (not a rectangle AND a 3-4-5 triangle). A triangle that only looks nearly square-cornered (e.g. 5-5-7) can't be in such a row.
    · Put the shapes IN items — never a kind or size beside them on the row itself.
- win {say}: the closing line — the one idea to remember.
Every size is its own number field — s, w, h, sides, folds, deg — never written into text ("folds 2" in text is lost).
Every teaching picture (a figure or corner without ask) MUST have a say — what to look at or do ("go round and count each side"), never a number or name a question after it asks for. A teaching picture without words isn't silent: Munni then says its facts ("A rectangle: 4 sides and 4 square corners"), which give away a counting question about the same kind of shape.
Never repeat a beat. A figure, corner or figures beat never carries a why — notes go on the ask.
The teaching picture and the question picture are DIFFERENT examples (a different shape or size), so the child applies what they saw.

An example of one good lesson (the shape of it, not its content):
{"title":{"en":"Sides and corners","hi":"भुजाएँ और कोने"},"sub":{"en":"Go round the shape","hi":"आकृति के चारों ओर"},"ic":"🔷","skill":"shapes2d","source":"Page 61",
 "aims":[{"short":{"en":"Count the sides","hi":"भुजाएँ गिनो"},"point":{"en":"The child can count the sides of a shape.","hi":"बच्चा किसी आकृति की भुजाएँ गिन सकता है।"},"forget":{"en":"I forgot! How do I find out how many sides a shape has?","hi":"मैं भूल गई! किसी आकृति की कितनी भुजाएँ हैं, यह कैसे पता करूँ?"},"hints":[{"en":"Put your finger on one corner. What do you do next?","hi":"एक कोने पर उँगली रखो। फिर क्या करोगे?"},{"en":"How do you know when to stop?","hi":"कैसे पता चलेगा कि कब रुकना है?"}],"ideas":[{"en":"go round the shape and count each straight edge once","hi":"आकृति के चारों ओर घूमकर हर सीधी भुजा एक बार गिनो","words":["go round","count","each side","every side","one by one","once","घूम","गिन","हर भुजा","एक-एक","ek ek","ginti","ginna","एक बार"]}]}],
 "beats":[{"t":"intro","say":{"en":"Shapes have sides. Let us count them.","hi":"आकृतियों की भुजाएँ होती हैं। आओ गिनें।"}},
  {"t":"figure","kind":"square","s":4,"say":{"en":"Put your finger on one corner and go round, counting each side.","hi":"एक कोने पर उँगली रखो और हर भुजा गिनते हुए घूमो।"}},
  {"t":"figure","kind":"triangle","sides":[5,5,5],"ask":"sides"},
  {"t":"ask","q":{"en":"How many sides does it have?","hi":"इसकी कितनी भुजाएँ हैं?"},"opts":["3","4"],"hiOpts":["3","4"],"correct":0,
   "why":{"en":"Children who just saw the square expect every shape to have 4 sides.","hi":"वर्ग देखने के बाद बच्चे हर आकृति की 4 भुजाएँ मान लेते हैं।"}},
  {"t":"win","say":{"en":"Go round once and count each side.","hi":"एक बार पूरा घूमो और हर भुजा गिनो।"}}]}`;
}
function rulesText(rules){
  return `Hard rules — Takhti's checker rejects any lesson that breaks one:
1. 4 to 8 beats; start with intro, passage or a teaching picture; end with win; at least one ask.
2. TEACH, THEN ASK: before the first question there must be something that teaches — a teaching picture (a figure or corner without ask, or a count/add/take/… beat), or a passage. Every aim is taught in the beats AND checked by a question. Every aim is something a child can show on a screen (count, name, find, pick): never "fold a paper" or "cut", and never empty ("find a rectangle with 4 sides" — every rectangle has 4). If an aim says "find", one question is a numbered row to find it in.
3. A maths ask comes right after the beat that shows it, and its right answer is a number equal to what that beat computes (count → n, add → a+b, take → a−b, group → a, array → a×b, share → a÷b, bar → a−b, line → a+b×hops, frac → b). Numbers as digits.
4. A reading ask comes after a passage/word/readline, and its right answer uses the passage's own words.
5. A shape ask comes right after the figure/corner/figures it is about (with its ask or find set), and its right answer is what that drawing shows. For anything about shapes, sides, corners or perimeter, USE the drawings — never describe a shape only in words.
6. Never say the answer in the lines just before a question — not as a digit, not as a word ("three", "तीन") — and never name it in the question itself ("Are all sides equal in this square?" gives it away — ask "Are all its sides equal?"; "How many sides does this triangle have?" too — ask "How many sides does this shape have?" so the child counts). Where you can, ask two questions: one to recognise, one to apply to something new.
6b. TEACH ON ONE SHAPE, ASK ON ANOTHER: a question's picture is never a teaching picture again (a teaching picture marks the answer). Teach with a 6 × 3 rectangle, ask about a 4 × 2 one; teach a square corner, ask about a smaller or bigger corner; teach a circle with 2 folds, ask with 3. A teaching circle that talks about folds draws them (folds 2 or more).
6d. Teach one kind, count another: after teaching a rectangle, count a triangle's sides (not another rectangle's — what Munni said about the first is the answer).
6c. Ask TWO questions per lesson: the first to recognise, the second about a NEW example (another shape, a numbered row, an odd one out). With two answers each, one question alone is a coin toss — the teacher is shown that. For "are all its sides equal?", ask it of one shape whose answer is Yes AND one whose answer is No (a square and a rectangle): a child who always says Yes must not pass.
7. The wrong option is a mistake a child really makes — never silly, never equal to the right one. Its why names that mistake ("children count only the top two corners"), not "they might guess". For "where do the folds meet?" the real wrong answer is Edge (किनारा). In a row, put a look-alike next to the right shape (a square among rectangles, a thin triangle like 2-6-7) and make the wrong answer the look-alike's number — not a picture nobody would pick.
8. Every number a child meets is at most ${rules.maxNumber}.
9. Every say and q is at most ${rules.sayWords} words in Hindi; short, warm, concrete; speak to the child as "तुम", never "आप"; never scold, never the word "wrong".
10. title, sub, say, q, p, why and each aim's short, point, forget and hints are objects with natural English "en" AND natural Hindi "hi" in Devanagari (not transliteration). opts are English; hiOpts are the same answers in Hindi, in Devanagari unless the answer is a number (Yes/No → हाँ/नहीं).
11. Use the words Indian schools use: वर्ग (square), आयत (rectangle), त्रिभुज (triangle), वृत्त (circle), भुजा (side), कोना (corner), चौकोर कोना (square corner), केंद्र (centre), परिमाप (perimeter). Sizes are written "6 × 3" or "sides 6 and 3" — in Hindi never translate "by" as गुणा.
12. Plain text only: no markup, no brackets of code, no links. ic and art are a single emoji.`;
}

function instructions(rules, count, skills, note){
  return `You write short practice lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (age band "${rules.band}").
A teacher has given you a chapter from their own school's syllabus. Write ${count} lesson(s) that practise what THIS chapter teaches — nothing from outside it.

Every lesson starts with its AIMS: 1 to 4 (3 is best) points a teacher can approve. After the lesson, Munni the elephant pretends she forgot them, and the child explains each one back to her. Each aim has:
- point: what the child will be able to do or explain ("The child can …"), the Hindi saying exactly what the English says;
- short: a 2–4 word name for it;
- forget: Munni's puzzled question that makes the child explain it — it must NOT contain the explanation;
- hints: exactly 2 gentle nudges, which also must NOT give the explanation;
- ideas: 1–2 things a full explanation says, each with "words": 4–15 words or short phrases a child might use for it, in English, Hindi in Devanagari and romanised Hindi.
Munni's lines are spoken to the child: warm, short, "तुम" in Hindi. An aim whose question or hints already give the explanation is dropped; a lesson with no usable aim is rejected.
How to keep the explanation out of Munni's mouth: her question names the TOPIC ("How do I find out how many sides a shape has?"); the words are the METHOD the child says back ("go round", "count each side once") — words that appear in her question don't count, so don't rely on them. Each hint is a question that points the way WITHOUT using any of the words ("Put your finger on one corner. What do you do next?"), never an instruction that is the method ("Go round the shape" is the explanation itself).

${beatsText()}

${rulesText(rules)}
13. skill: the id from this list that the lesson practises, or "" if none fits: ${skills.length ? skills.map(s => `${s.id} (${s.en})`).join('; ') : '(none given)'}.
14. source: where in the chapter it comes from.
${note ? `The teacher's note: "${note}"` : ''}
Answer with JSON only, in the given schema.`;
}

function repairInstructions(rules){
  return `You fix lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (band "${rules.band}"). Each lesson below was rejected by Takhti's checker; its reasons are listed. Return each lesson fixed — same topic, same format, same aims, every reason addressed — and change nothing else.
How to read the reasons: "must say what is asked (ask)" → set the figure's ask to what the next question asks (sides, corners, name…); "a rectangle needs w and h" → give both; "say the answer … (in the intro)" or "(in beat N's words)" → rewrite THAT line so it no longer says the answer (an intro may say what we will do — "let us fold a paper circle" — not what we will find), or ask about a new example whose answer is different (teach a square's 4 sides, ask a triangle's); "the teaching picture again" → change the question picture to another shape whose answer is different; "say the answer" also counts number words (three, तीन) — teach the idea without the number; "teach before you ask" → add a teaching picture (a different shape or size from the question's) before the first question; "names the shape" → ask without naming it; "Hindi answers must be in Devanagari" → write hiOpts in Hindi; "a question needs exactly 2 answers" → give opts, hiOpts and correct; "needs a circle with 2 or more folds" / "doesn't show the folds" → set folds to 2 or more (a number, not text); "a row needs its find" → set find to the one shape the question looks for; "exactly one picture may have a square corner" → change the row so only one item has one; a teaching picture's say may tell what to look at, never the number or name asked for; "already gives the explanation (it says …)" → rewrite that question or hint so it no longer uses those words (a hint asks, it doesn't tell), keeping the aim's words as they are.

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
  // a 400 moves to the next shape: the strict schema in both field names
  // first, then the old flattened one (an API that refuses anyOf still works)
  const shapes = [
    { generationConfig:{ temperature:0.4, responseFormat:{ text:{ mimeType:'APPLICATION_JSON', schema: SCHEMA } } } },
    { generationConfig:{ temperature:0.4, responseMimeType:'application/json', responseJsonSchema: SCHEMA } },
    { generationConfig:{ temperature:0.4, responseMimeType:'application/json', responseJsonSchema: SCHEMA_FLAT } }
  ];
  // the whole request has TAKHTI_SYLLABUS_TIMEOUT_MS (55 s on a serverless host, 180 s on the
  // voice server); one model may take at most 60% of it, so a model that hangs
  // still leaves time for the fallback (the first live run's health check hung for 55 s)
  const total = Number(env.TAKHTI_SYLLABUS_TIMEOUT_MS || 55000), started = Date.now();
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), total);
  // each model may take 60% of what is left while another one waits behind
  // it — and never the last model's reserve (40% of the limit, at most 45 s,
  // TAKHTI_SYLLABUS_LAST_MS): on the eighth live run two full Flash models
  // used 151 of 180 s, flash-lite got 29 s and nothing came back, while
  // flash-lite alone drafted 3 of 3. A model's retries share its one budget.
  const leftNow = () => total - (Date.now() - started);
  const reserve = Math.min(Number(env.TAKHTI_SYLLABUS_LAST_MS || 45000), Math.floor(total * 0.4));
  // …and at most a minute each (TAKHTI_SYLLABUS_MODEL_MS): on the ninth run a
  // hanging 3.8-flash held a teacher for 108 s before anything else was tried
  const cap = Number(env.TAKHTI_SYLLABUS_MODEL_MS || 60000);
  const budgetFor = m => { const left = leftNow(); return models.indexOf(m) === models.length - 1 ? left : Math.floor(Math.min(left * 0.6, left - reserve, cap)); };
  // what each model said and how long it took (the live runs couldn't tell a
  // hang from "busy" from a key's quota) — returned with the answer, and logged
  const tried = [];
  try{
    let res, d, model;
    const busy = s => s === 503 || s === 429;
    models: for(model of models){
      const budget = budgetFor(model);
      // too little left before the last model's reserve: this one waits its turn out
      if(budget < 1500){ tried.push({ model, outcome: 'no time', ms: 0 }); continue models; }
      const modelEnd = Date.now() + budget;
      for(const shape of shapes){
        for(let attempt = 0; attempt < 2; attempt++){
          const left = Math.min(modelEnd - Date.now(), leftNow());
          if(attempt > 0 && left < 3000) break;                            // no time left for this model's retry
          const one = new AbortController();
          // (the last model's own timer runs a little past the whole limit, so a
          // try the limit cuts off is recorded as cut, not as hung)
          const last = models.indexOf(model) === models.length - 1;
          const stop = () => one.abort(), t1 = setTimeout(stop, Math.max(1000, left) + (last ? 250 : 0));
          ctl.signal.addEventListener('abort', stop);
          const t0 = Date.now();
          try{
            res = await fetchImpl(urlFor(model), { method:'POST', signal: one.signal,
              headers:{ 'content-type':'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ ...base, ...shape }) });
            d = await res.json().catch(() => ({}));
          }catch(e){
            if(ctl.signal.aborted){                                       // the whole request is out of time:
              tried.push({ model, outcome: 'cut', ms: Date.now() - t0 });  // say so, and which models never had a turn
              models.slice(models.indexOf(model) + 1).forEach(m => tried.push({ model: m, outcome: 'no time', ms: 0 }));
              throw e;
            }
            res = { ok:false, status:503, hung:true }; d = {};            // this model hung: straight to the next one
          }finally{ clearTimeout(t1); ctl.signal.removeEventListener('abort', stop); }
          // the tokens Gemini says it used (usageMetadata), so a run can say what it cost
          const u = (res.ok && d && d.usageMetadata) || null, n = v => Number.isFinite(v) ? v : 0;
          tried.push({ model, outcome: res.hung ? 'hung' : res.ok ? 'ok' : res.status, ms: Date.now() - t0,
            ...(u ? { tokens:{ in: n(u.promptTokenCount), out: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount), total: n(u.totalTokenCount) } } : {}) });
          // a 429 is the key's quota, not a moment's overload: retrying only waits
          // (the fifth live run: ~6 s a model) — straight on to the next model
          if(res.hung || res.status !== 503) break;
          // (a busy model gets one more try, a moment later)
          if(attempt === 0) await wait(Number(env.TAKHTI_SYLLABUS_RETRY_MS || 1500));   // once more, a moment later
        }
        if(res.ok){ RESTING.delete(model); break models; }
        if(res.hung || busy(res.status)){ RESTING.set(model, Date.now() + (env.TAKHTI_GEMINI_REST_MS != null ? Number(env.TAKHTI_GEMINI_REST_MS) : 300000)); continue models; }
        if(res.status === 404) continue models;                                       // no such model: the next one
        if(res.status !== 400) break models;                                          // 400: the other request shape
      }
    }
    if(env.TAKHTI_SYLLABUS_LOG !== '0') console.log('[syllabus] models:', tried.map(x => `${x.model} ${x.outcome} ${(x.ms / 1000).toFixed(1)}s${x.tokens ? ` ${x.tokens.in} in / ${x.tokens.out} out tokens` : ''}`).join(' → '));
    // 429 is the key's own limit (requests a minute or a day), not Google being busy
    if(!res.ok) return res.hung ? { error:'Gemini did not answer in time', status: 504, tried }
                                : { error: res.status === 429 ? "this Gemini key's limit is used up for now — try again later, or check the key's quota in AI Studio"
                                    : res.status === 503 ? 'Gemini is busy right now — try again in a few minutes' : `Gemini said ${res.status}`, status: 502, tried };
    const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
    let out;
    try{ out = JSON.parse(text); }catch(e){ return { error:'Gemini did not answer in the lesson format', status: 502, tried }; }
    return { out, model, tried };
  }catch(e){
    if(env.TAKHTI_SYLLABUS_LOG !== '0') console.log('[syllabus] models:', tried.map(x => `${x.model} ${x.outcome} ${(x.ms / 1000).toFixed(1)}s`).join(' → '));
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
      .map(x => ({ lesson: x.lesson, errors: (Array.isArray(x.errors) ? x.errors : []).slice(0, 10).map(e => plain(e, 240)) }));
    if(!items.length) return { status:400, json:{ error:'nothing to repair' } };
    const r = await callGemini([{ text: JSON.stringify({ lessons: items }) }], repairInstructions(rules), env, fetchImpl);
    if(r.error) return { status: r.status, json:{ error: r.error, tried: r.tried } };
    return { status:200, json:{ lessons: (Array.isArray(r.out.lessons) ? r.out.lessons : []).filter(l => l && typeof l === 'object').slice(0, items.length), model: r.model, tried: r.tried } };
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
    lessons: (Array.isArray(r.out.lessons) ? r.out.lessons : []).filter(l => l && typeof l === 'object').slice(0, count),
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
