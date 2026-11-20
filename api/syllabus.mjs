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
   (default gemini-4-hydrogen — Gemini 4's fast model, 12 Nov 2026; GEMINI_FALLBACK_MODEL, a comma list tried in
   turn when that one is busy, default gemini-3.8-flash,gemini-3.5-flash-lite;
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
const BEAT_TYPES = ['intro','count','add','take','group','line','array','share','bar','frac','figure','corner','figures','clock','clocks','months','calendar','passage','word','readline','ask','win'];
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
const CLOCK_TIME = { type:'object', properties:{ h:{ type:'integer', minimum:1, maximum:12 }, m:{ type:'integer', minimum:0, maximum:59 } }, required:['h','m'] };
const SHAPE_ASK = { type:'string', enum:['name','sides','corners','perimeter','equal','meet'],
  description:'Only on a question picture (the very next beat is the ask about it); leave it out on a teaching picture.' };
const BEAT_SCHEMA = { anyOf: [
  beat('intro',   { say: bi }, ['say']),
  beat('count',   { n: int, say: bi }, ['n']),
  ...['add', 'take', 'array', 'share', 'bar'].map(t => beat(t, { a: int, b: int, say: bi }, ['a', 'b'])),
  beat('line',    { a: int, b: int, hops: int, say: bi }, ['a', 'b', 'hops']),
  beat('group',   { a: int, ask: { type:'string', enum:['tens','ones'], description:'only when the question after it asks how many bundles of ten (tens) or how many are left over (ones); leave out to ask for the whole number' }, say: bi }, ['a']),
  beat('frac',    { b: int, say: bi }, ['b']),
  beat('passage', { p: bi, art:{ type:'string' } }, ['p', 'art']),
  beat('word',    { word:{ type:'string' }, art:{ type:'string' }, say: bi }, ['word', 'art']),
  beat('readline',{ text:{ type:'string' }, say: bi }, ['text']),
  beat('ask',     { q: bi, opts:{ type:'array', items:{ type:'string' }, minItems:2, maxItems:2 }, hiOpts:{ type:'array', items:{ type:'string' }, minItems:2, maxItems:2 },
                    correct:{ type:'integer', minimum:0, maximum:1 }, why:{ ...bi, description:'For the teacher only: the real mistake behind the wrong option.' },
                    aim:{ type:'integer', minimum:1, maximum:4, description:'Which aim this question checks: 1 for the first aim, 2 for the second…' } },
                  ['q', 'opts', 'hiOpts', 'correct', 'why']),
  { ...beat('figure', { kind:{ type:'string', enum:['square'] }, s: int, ask: SHAPE_ASK, say: bi }, ['kind', 's']), description:'A square: s is its side.' },
  { ...beat('figure', { kind:{ type:'string', enum:['rectangle'] }, w: int, h: int, ask: SHAPE_ASK, say: bi }, ['kind', 'w', 'h']), description:'A rectangle: w and h, two different numbers.' },
  { ...beat('figure', { kind:{ type:'string', enum:['triangle'] }, sides:{ type:'array', items: int, minItems:3, maxItems:3 }, ask: SHAPE_ASK, say: bi }, ['kind', 'sides']), description:'A triangle: three side lengths that make a triangle.' },
  { ...beat('figure', { kind:{ type:'string', enum:['circle'] }, folds:{ type:'integer', minimum:0, maximum:4, description:'how many fold lines, 0–4 — a number here, never in the narration' }, ask: SHAPE_ASK, say: bi }, ['kind', 'folds']), description:'A circle: 0–4 fold lines through the middle; a "meet" question needs 2 or more.' },
  beat('corner',  { deg: int, ask:{ type:'string', enum:['kind'], description:'Only when the next beat asks what kind of corner it is.' }, say: bi }, ['deg']),
  beat('figures', { items:{ type:'array', minItems:2, maxItems:4, description:'the 2–4 shapes in the row', items:{ type:'object', properties:{ kind:{ type:'string', enum:['square','rectangle','triangle','circle','corner'] },
                      s: int, w: int, h:{ type:'integer', description:'rectangle: always give it, different from w' }, sides:{ type:'array', items: int }, folds: int, deg: int }, required:['kind'] } },
                    find:{ type:'string', enum:['square','rectangle','triangle','circle','squarecorner','odd'], description:'which ONE item the question looks for' }, say: bi }, ['items', 'find']),
  beat('clock',   { h:{ type:'integer', minimum:1, maximum:12, description:'the hour, 1–12' }, m:{ type:'integer', minimum:0, maximum:59, description:'the minutes, 0–59 (a number here, never "3:30" in the narration)' },
                    ask:{ type:'string', enum:['time'], description:'Only on a question picture: the very next beat asks what time it is.' }, say: bi }, ['h', 'm']),
  beat('clocks',  { from: CLOCK_TIME, to: CLOCK_TIME,
                    ask:{ type:'string', enum:['minutes','hours'], description:'Only on a question picture: the next beat asks how many minutes (or whole hours) passed from the start clock to the end clock.' }, say: bi }, ['from', 'to']),
  beat('months',  { m:{ type:'integer', minimum:1, maximum:12, description:'the month the picture marks or asks about, 1 (January) – 12' }, m2:{ type:'integer', minimum:1, maximum:12, description:'count only: the second month' },
                    k:{ type:'integer', minimum:1, maximum:11, description:'later only: how many months later (the question says it too)' }, date:{ type:'string', description:'optional: a date printed above the months, day/month/year like "02/05/2015"' },
                    ask:{ type:'string', enum:['name','number','after','before','later','count'], description:'Only on a question picture: what the next beat asks.' }, say: bi }, []),
  beat('calendar',{ days:{ type:'integer', minimum:28, maximum:31 }, start:{ type:'integer', minimum:0, maximum:6, description:'the day of the week of the 1st: 0 Sunday … 6 Saturday' }, month:{ type:'integer', minimum:1, maximum:12 },
                    d:{ type:'integer', minimum:1, maximum:31, description:'the marked date (weekday, later)' }, w:{ type:'integer', minimum:0, maximum:6, description:'count only: the day whose dates are counted (0 Sunday … 6 Saturday)' },
                    k:{ type:'integer', minimum:1, maximum:27, description:'later only: how many days later (the question says it too)' },
                    ask:{ type:'string', enum:['weekday','count','later'], description:'Only on a question picture: what the next beat asks.' }, say: bi }, ['days', 'start']),
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
    sides:{ type:'array', items: int }, folds: int, deg: int, h: int, m: int, from: CLOCK_TIME, to: CLOCK_TIME,
    m2: int, k: int, date:{ type:'string' }, days: int, start: int, month: int, d: int, w: int,
    ask:{ type:'string', enum:['name','sides','corners','perimeter','equal','meet','kind','time','minutes','hours','number','after','before','later','count','weekday'] },
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
        aims:{ type:'array', minItems:1, maxItems:4, description:'What the child will be able to do — the points a teacher approves, and that Appu later "forgets" for the child to explain back (Teach Appu).', items:{
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
/* The structured-output request, in the order it is tried: the current
   field first; older deployments of the API take responseMimeType/
   responseJsonSchema; the flattened schema last, for an API that refuses
   anyOf. A 400 moves to the next. Exported so the library builder's Batch
   API requests are exactly the live ones (tools/build-library.mjs). */
export const GEN_SHAPES = [
  { generationConfig:{ temperature:0.4, responseFormat:{ text:{ mimeType:'APPLICATION_JSON', schema: SCHEMA } } } },
  { generationConfig:{ temperature:0.4, responseMimeType:'application/json', responseJsonSchema: SCHEMA } },
  { generationConfig:{ temperature:0.4, responseMimeType:'application/json', responseJsonSchema: SCHEMA_FLAT } }
];

/* What Takhti can draw, and the rules its checker holds a lesson to —
   one text, used by the draft AND the repair round (the first live run's
   repair fixed nothing: it was told "add ask" without being told what ask is). */
function beatsText(){
  return `Every lesson is a list of "beats" the app draws on screen with the child's favourite game pieces, and narrates aloud. Use ONLY these beat types and fields:
- intro {say}: an opening line.
- count {n}: n objects appear (n ≤ 20).
- add {a,b}: a objects, then b more arrive (a,b ≤ 10).
- take {a,b}: a objects, b go away (a ≤ 20, b ≤ a).
- group {a, ask?}: the number a shown as bundles of ten and loose ones (a ≤ 99). To ask "how many tens?" give ask:"tens" (the answer is the tens digit); "how many left over?" → ask:"ones"; with ask, give the beat its own say that never says that count.
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
- clock {h, m, ask}: Takhti draws ONE clock face showing h:m (h 1–12, m 0–59), the hour hand between the hours as on a real clock. Without ask it is a teaching picture (Munni reads its time aloud). With ask:"time" the next beat asks "What time is it?" and its two answers are times, written the way the class says them: "3 o'clock", "half past 3", "quarter past 3", "quarter to 4", "3:20" (Hindi: "3 बजे", "साढ़े 3 बजे", "सवा 3 बजे", "पौने 4 बजे", "3 बजकर 20 मिनट").
- clocks {from:{h,m}, to:{h,m}, ask}: Takhti draws two clocks, the start and the end. Without ask it is a teaching picture (Munni says how long it took). With ask:"minutes" the next beat asks how many minutes passed (answers are numbers like "20"); ask:"hours" only when it is a whole number of hours.
    · The real clock mistakes make the wrong answers: the long hand read as the hour ("12 o'clock" for 7 o'clock), half past naming the NEXT hour (half past 10 for half past 9), quarter past and quarter to mixed up, the number the long hand points at read as the minutes (3:04 for 3:20), counting the numbers the long hand passed instead of 5 minutes for each (4 for 20 minutes), the end time given as the hours that passed.
- months {m, ask, m2, k, date}: Takhti draws the twelve months in order (two rows of six), each with its number 1–12 and its name. date (optional) prints a date above them as a birth certificate does: "02/05/2015" is day 2, month 5 (May), 2015. Without ask it is a teaching picture (m marks a month). With ask the next beat asks: name (which month is number m, the question saying the number — or, with date, which month is in the date; answers are month names), number (what number is month m; answers are numbers), after / before (the month next to the marked month m), later (the month k months after the marked month m — the question must say k in both languages, "3 months later" / "3 महीने बाद"), count (how many months from m to m2; a number).
- calendar {days, start, month, d, w, k, ask}: Takhti draws one month's page: days 28–31, start = the day of the week of the 1st (0 Sunday … 6 Saturday), a column for each day. With ask the next beat asks: weekday (what day of the week the marked date d is; answers are day names, Sunday / रविवार …), count (how many of day w — say Sundays — are in the month; a number), later (the date k days after the marked date d — the question must say k: "a week later" is 7). Dates go to 31, so a calendar page is for ages 7 and up.
    · The real calendar mistakes make the wrong answers: the month on the wrong side (before, for after), January counted as 0, the starting month counted as one of the months (one short) or both ends counted (one over), the day read as the month (02/05/2015 read as February), the day in the next column, the last row missed (4 Sundays for 5), one day later for "a week later".
- win {say}: the closing line — the one idea to remember.
Every size is its own number field — s, w, h, sides, folds, deg — never written into text ("folds 2" in text is lost).
Every teaching picture (a figure or corner without ask) MUST have a say — what to look at or do ("go round and count each side"), never a number or name a question after it asks for. A teaching picture without words isn't silent: Munni then says its facts ("A rectangle: 4 sides and 4 square corners"), which give away a counting question about the same kind of shape.
Never repeat a beat. A figure, corner or figures beat never carries a why — notes go on the ask.
The teaching picture and the question picture are DIFFERENT examples (a different shape or size), so the child applies what they saw.

An example of a calendar lesson (the shape of it, not its content):
{"title":{"en":"The month in a date","hi":"तारीख में महीना"},"sub":{"en":"Day, month, year","hi":"दिन, महीना, साल"},"ic":"📄","skill":"calendar3","source":"Page 169","aims":[{"short":{"en":"Find the month","hi":"महीना ढूँढो"},"point":{"en":"The child can find the month in a date written as day, month, year.","hi":"बच्चा दिन, महीना, साल में लिखी तारीख में महीना ढूँढ सकता है।"},"forget":{"en":"I forgot! How do I find the month in a date like 02/05/2015?","hi":"मैं भूल गया! 02/05/2015 जैसी तारीख में महीना कैसे ढूँढूँ?"},"hints":[{"en":"Which part of the date do you look at?","hi":"तारीख का कौन सा हिस्सा देखोगे?"},{"en":"Then where do you find that on the picture?","hi":"फिर उसे चित्र में कहाँ ढूँढोगे?"}],"ideas":[{"en":"the middle number is the month; find that number on the strip","hi":"बीच वाली संख्या महीना है; वह संख्या पट्टी पर ढूँढो","words":["middle number","second number","the middle","बीच वाली","बीच की संख्या","दूसरी संख्या","beech wali","doosri"]}]}],"beats":[{"t":"intro","say":{"en":"A birth certificate writes a date as day, month, year.","hi":"जन्म प्रमाण पत्र पर तारीख दिन, महीना, साल लिखी जाती है।"}},{"t":"months","date":"15/06/2016","m":6,"say":{"en":"In 15/06/2016 the middle number is 6, so the month is June.","hi":"15/06/2016 में बीच वाली संख्या 6 है, तो महीना जून है।"}},{"t":"months","date":"02/05/2015","ask":"name"},{"t":"ask","q":{"en":"Which month is in this date?","hi":"इस तारीख में कौन सा महीना है?"},"opts":["May","February"],"hiOpts":["मई","फ़रवरी"],"correct":0,"why":{"en":"Children read the first number, the day, as the month.","hi":"बच्चे पहली संख्या, यानी दिन, को महीना पढ़ लेते हैं।"}},{"t":"months","m":9,"ask":"after"},{"t":"ask","q":{"en":"Which month comes after the marked one?","hi":"निशान वाले महीने के बाद कौन सा महीना आता है?"},"opts":["August","October"],"hiOpts":["अगस्त","अक्टूबर"],"correct":1,"why":{"en":"Children go the wrong way along the year and give the month before.","hi":"बच्चे साल में उल्टी ओर चले जाते हैं और पहले वाला महीना बता देते हैं।"}},{"t":"win","say":{"en":"Day first, then the month, then the year.","hi":"पहले दिन, फिर महीना, फिर साल।"}}]}

An example of a clock lesson (the shape of it, not its content):
{"title":{"en":"Half past","hi":"साढ़े"},"sub":{"en":"The long hand at the 6","hi":"बड़ी सुई 6 पर"},"ic":"🕒","skill":"time3","source":"Page 170","aims":[{"short":{"en":"Read half past","hi":"साढ़े पढ़ो"},"point":{"en":"The child can read a half past time on a clock.","hi":"बच्चा घड़ी पर साढ़े का समय पढ़ सकता है।"},"forget":{"en":"I forgot! How do I read a clock when the long hand is at the 6?","hi":"मैं भूल गया! जब बड़ी सुई 6 पर हो, तो घड़ी कैसे पढ़ूँ?"},"hints":[{"en":"Which hand do you look at first?","hi":"सबसे पहले कौन सी सुई देखोगे?"},{"en":"And after that, what do you look at?","hi":"और उसके बाद क्या देखोगे?"}],"ideas":[{"en":"the short hand has just passed the hour, and the long hand at the 6 means half past","hi":"छोटी सुई अभी घंटा पार कर चुकी है, और बड़ी सुई 6 पर मतलब साढ़े","words":["short hand","passed","just after","half past","छोटी सुई","पार","साढ़े","chhoti sui","sadhe"]}]}],"beats":[{"t":"intro","say":{"en":"Let us read the clock: first one hand, then the other.","hi":"आओ घड़ी पढ़ें: पहले एक सुई, फिर दूसरी।"}},{"t":"clock","h":4,"m":30,"say":{"en":"The short hand has passed the 4. The long hand is at the 6: half past 4.","hi":"छोटी सुई 4 पार कर चुकी है। बड़ी सुई 6 पर है: साढ़े 4 बजे।"}},{"t":"clock","h":9,"m":30,"ask":"time"},{"t":"ask","q":{"en":"What time is it?","hi":"कितने बजे हैं?"},"opts":["half past 9","half past 10"],"hiOpts":["साढ़े 9 बजे","साढ़े 10 बजे"],"correct":0,"why":{"en":"Children name the number the short hand is heading for, not the one it has passed.","hi":"बच्चे वह अंक बोलते हैं जिसकी ओर छोटी सुई जा रही है, न कि जिसे वह पार कर चुकी है।"}},{"t":"clocks","from":{"h":2,"m":0},"to":{"h":2,"m":20},"ask":"minutes"},{"t":"ask","q":{"en":"How many minutes passed?","hi":"कितने मिनट बीते?"},"opts":["4","20"],"hiOpts":["4","20"],"correct":1,"why":{"en":"Children count the numbers the long hand passed, not five minutes for each.","hi":"बच्चे बड़ी सुई के पार किए अंक गिनते हैं, हर अंक के पाँच मिनट नहीं।"}},{"t":"win","say":{"en":"Short hand for the hour, long hand for the minutes.","hi":"छोटी सुई से घंटा, बड़ी सुई से मिनट।"}}]}

An example of one good lesson (the shape of it, not its content):
{"title":{"en":"Sides and corners","hi":"भुजाएँ और कोने"},"sub":{"en":"Go round the shape","hi":"आकृति के चारों ओर"},"ic":"🔷","skill":"shapes2d","source":"Page 61",
 "aims":[{"short":{"en":"Count the sides","hi":"भुजाएँ गिनो"},"point":{"en":"The child can count the sides of a shape.","hi":"बच्चा किसी आकृति की भुजाएँ गिन सकता है।"},"forget":{"en":"I forgot! How do I find out how many sides a shape has?","hi":"मैं भूल गया! किसी आकृति की कितनी भुजाएँ हैं, यह कैसे पता करूँ?"},"hints":[{"en":"Put your finger on one corner. What do you do next?","hi":"एक कोने पर उँगली रखो। फिर क्या करोगे?"},{"en":"How do you know when to stop?","hi":"कैसे पता चलेगा कि कब रुकना है?"}],"ideas":[{"en":"go round the shape and count each straight edge once","hi":"आकृति के चारों ओर घूमकर हर सीधी भुजा एक बार गिनो","words":["go round","count","each side","every side","one by one","once","घूम","गिन","हर भुजा","एक-एक","ek ek","ginti","ginna","एक बार"]}]}],
 "beats":[{"t":"intro","say":{"en":"Shapes have sides. Let us count them.","hi":"आकृतियों की भुजाएँ होती हैं। आओ गिनें।"}},
  {"t":"figure","kind":"square","s":4,"say":{"en":"Put your finger on one corner and go round, counting each side.","hi":"एक कोने पर उँगली रखो और हर भुजा गिनते हुए घूमो।"}},
  {"t":"figure","kind":"triangle","sides":[5,5,5],"ask":"sides"},
  {"t":"ask","q":{"en":"How many sides does it have?","hi":"इसकी कितनी भुजाएँ हैं?"},"opts":["3","4"],"hiOpts":["3","4"],"correct":0,"aim":1,
   "why":{"en":"Children who just saw the square expect every shape to have 4 sides.","hi":"वर्ग देखने के बाद बच्चे हर आकृति की 4 भुजाएँ मान लेते हैं।"}},
  {"t":"win","say":{"en":"Go round once and count each side.","hi":"एक बार पूरा घूमो और हर भुजा गिनो।"}}]}`;
}
/* An English book's lesson (the library builder sends lang:'en' for a book
   whose subject is english — NCERT Mridang, Santoor): the child reads English
   whatever the app's language (src/ui/lesson-player.js), so what the child
   reads is English a Class 1 child can read, hiOpts are those same English
   words, and Munni never reads out the word she then asks about. The first
   live Mridang run (15 Nov 2026) wrote Hindi-script answers for "to" and "a",
   word cards whose narration said the word, and "Which word is this?" after
   the card had gone — 0 of 4 kept. The test runs the example through the
   checker. */
export const ENGLISH_EXAMPLE = `{"title":{"en":"What Meena hears","hi":"मीना क्या सुनती है"},"sub":{"en":"Read and find out","hi":"पढ़ो और पता करो"},"ic":"👂","skill":"e1-read","source":"Page 7",
 "aims":[{"short":{"en":"Ears hear","hi":"कान सुनते हैं"},"point":{"en":"The child can tell what we do with our ears.","hi":"बच्चा बता सकता है कि हम कानों से क्या करते हैं।"},"forget":{"en":"I forgot! What are my big ears for?","hi":"मैं भूल गया! मेरे बड़े कान किस काम के हैं?"},"hints":[{"en":"What do you do when a bird sings?","hi":"जब चिड़िया गाती है, तब तुम क्या करते हो?"},{"en":"Shut your eyes. Can you still tell the bird is there?","hi":"आँखें बंद करो। क्या फिर भी पता चलता है कि चिड़िया है?"}],"ideas":[{"en":"we hear sounds with our ears","hi":"हम कानों से आवाज़ सुनते हैं","words":["hear","listen","sound","sounds","सुन","सुनते","आवाज़","sunte","sunna","awaaz"]}]},
  {"short":{"en":"First sound","hi":"पहली आवाज़"},"point":{"en":"The child can say the first sound of a word.","hi":"बच्चा किसी शब्द की पहली आवाज़ बता सकता है।"},"forget":{"en":"I forgot! How do I find the first sound of a word?","hi":"मैं भूल गया! किसी शब्द की पहली आवाज़ कैसे पता करूँ?"},"hints":[{"en":"Say nose to yourself. Which sound comes out of your mouth before the others?","hi":"nose मन में बोलो। मुँह से बाकी आवाज़ों से आगे कौन सी आवाज़ निकलती है?"},{"en":"Is it the same sound you hear in nest?","hi":"क्या यह वही आवाज़ है जो nest में सुनते हो?"}],"ideas":[{"en":"say the word slowly and listen to how it starts","hi":"शब्द धीरे-धीरे बोलो और सुनो कि वह कैसे शुरू होता है","words":["slowly","start","starts","beginning","begin","धीरे","शुरू","शुरुआत","dheere","shuru"]}]}],
 "beats":[{"t":"intro","say":{"en":"Let us read about Meena.","hi":"आओ मीना के बारे में पढ़ें।"}},
  {"t":"passage","p":{"en":"Meena sits in the park. A bird sings. Meena hears the bird. The sun is up. Meena sees the sun.","hi":"मीना पार्क में बैठी है। एक चिड़िया गाती है। मीना चिड़िया को सुनती है। सूरज निकला है। मीना सूरज को देखती है।"},"art":"🐦"},
  {"t":"ask","q":{"en":"What does Meena hear?","hi":"मीना क्या सुनती है?"},"opts":["the bird","the sun"],"hiOpts":["the bird","the sun"],"correct":0,"aim":1,
   "why":{"en":"Children pick the sun because Meena sees it, not hears it.","hi":"बच्चे सूरज चुन लेते हैं क्योंकि मीना उसे देखती है, सुनती नहीं।"}},
  {"t":"word","word":"nose","art":"👃","say":{"en":"Look at this word. Read it.","hi":"इस शब्द को देखो और पढ़ो।"}},
  {"t":"ask","q":{"en":"What is the first sound of nose?","hi":"nose की पहली आवाज़ क्या है?"},"opts":["n","m"],"hiOpts":["n","m"],"correct":0,"aim":2,
   "why":{"en":"Children mix up n and m, which sound alike.","hi":"बच्चे n और m में उलझते हैं, दोनों की आवाज़ मिलती-जुलती है।"}},
  {"t":"win","say":{"en":"We hear with our ears. Every word has a first sound.","hi":"हम कानों से सुनते हैं। हर शब्द की एक पहली आवाज़ होती है।"}}]}`;
function englishText(rules){
  return `THIS IS AN ENGLISH LESSON, from the school's English textbook: the child is learning to read English.
E1. What the child reads is English a child of ${rules.ages.join('–')} can read: the passage, word and readline text, each question's "en" and opts. Short everyday words, sentences of 3 to 6 words, one idea each.
E2. The child sees the English passage, question and answers even when the app is in Hindi. hiOpts are the SAME English words as opts — copy them (["n","m"], ["the bird","the sun"]); this replaces rule 10 for hiOpts. The Hindi of p and q is for the teacher: natural Hindi, keeping the English word being learnt in English ("nose की पहली आवाज़").
E3. Munni's say lines may explain, but never read out a word a question then asks for. A word beat SHOWS one word: its say is "Look at this word. Read it." — never the word itself, never "this word starts with b".
E4. A question asks only about what the child has just read: the words its answer needs are in the passage or word beats right before it. Never "Which word is this?" — the word card has gone by then; ask about the word's sound or meaning, or put the words in a passage.
E5. First sounds: ask "What is the first sound of <word>?", with two single letters as answers ("n" and "m") — the right one is the word's first letter, the other a sound children mix up with it. Use a word whose first letter is its first sound (not "eyes", "knee", "one").
E6. Write your own words and sentences. NEVER copy the textbook's poem, song, rhyme or sentences, not even one line: take the chapter's topic and its word list only.
An example of one good English lesson:
${ENGLISH_EXAMPLE}`;
}

function rulesText(rules){
  return `Hard rules — Takhti's checker rejects any lesson that breaks one:
1. 4 to 8 beats; start with intro, passage or a teaching picture; end with win; at least one ask.
2. TEACH, THEN ASK: before the first question there must be something that teaches — a teaching picture (a figure or corner without ask, or a count/add/take/… beat), or a passage. Every aim is taught in the beats AND checked by a question. Every aim is something a child can show on a screen (count, name, find, pick): never "fold a paper" or "cut", and never empty ("find a rectangle with 4 sides" — every rectangle has 4). If an aim says "find", one question is a numbered row to find it in.
3. A maths ask comes right after the beat that shows it, and its right answer is a number equal to what that beat computes (count → n, add → a+b, take → a−b, group → a (or its tens / ones digit when the group has ask), array → a×b, share → a÷b, bar → a−b, line → a+b×hops, frac → b). Numbers as digits.
4. A reading ask comes after a passage/word/readline, and its right answer uses the passage's own words.
5. A shape or clock ask comes right after the figure/corner/figures/clock/clocks it is about (with its ask or find set), and its right answer is what that drawing shows. For anything about shapes, sides, corners or perimeter, USE the drawings — never describe a shape only in words. For reading a clock or how long something takes, USE clock / clocks; for months, dates, days of the week or a calendar, USE months / calendar — never teach these with a sentence to read. At this age a clock is read to ${({ pre:'(no clocks for ages 3–4)', early:"o'clock only (m is 0)", developing:'five minutes (m is a multiple of 5)', fluent:'the minute' })[rules.band]}.
6. Never say the answer in the lines just before a question — not as a digit, not as a word ("three", "तीन") — and never name it in the question itself ("Are all sides equal in this square?" gives it away — ask "Are all its sides equal?"; "How many sides does this triangle have?" too — ask "How many sides does this shape have?" so the child counts). Where you can, ask two questions: one to recognise, one to apply to something new.
6b. TEACH ON ONE SHAPE, ASK ON ANOTHER: a question's picture is never a teaching picture again (a teaching picture marks the answer). Teach with a 6 × 3 rectangle, ask about a 4 × 2 one; teach a square corner, ask about a smaller or bigger corner; teach a circle with 2 folds, ask with 3. A teaching circle that talks about folds draws them (folds 2 or more).
6d. Teach one kind, count another: after teaching a rectangle, count a triangle's sides (not another rectangle's — what Munni said about the first is the answer).
6c. EVERY lesson asks AT LEAST TWO questions — a lesson with a picture and one question is NOT USED: the first to recognise, the second about a NEW example (another shape, a numbered row, an odd one out, another time, another month or date). With two answers each, one question alone is a coin toss. For "are all its sides equal?", ask it of one shape whose answer is Yes AND one whose answer is No (a square and a rectangle): a child who always says Yes must not pass.
6e. MIX THE RIGHT ANSWERS: a lesson's questions must not all have the same right answer — if every answer is Yes (हाँ), a child who always says Yes passes, and the library does not use that lesson. Make at least one right answer No (नहीं), or a different word or number.
6f. A YES/NO QUESTION MUST NOT SAY A TEACHING LINE BACK: if one line Munni just said already holds every word of the question ("तोता starts with the letter त" → "Does तोता have the letter त?"), the child answers from what they heard, and the library does not use that lesson. Teach on one example, ask about a NEW one the lines didn't name ("Does फल start with घ?"), or ask the child to put two lines together ("ताल ends in ल", "चाल ends in ल" → "Do ताल and चाल rhyme?").
6e. Every ask names the aim it checks in "aim" (1 = the first aim). Each aim is checked by at least one question, so the teacher can see who can DO each point, next to who can EXPLAIN it to Appu.
7. The wrong option is a mistake a child really makes — never silly, never equal to the right one. Its why names that mistake ("children count only the top two corners"), not "they might guess". For "where do the folds meet?" the real wrong answer is Edge (किनारा). In a row, put a look-alike next to the right shape (a square among rectangles, a thin triangle like 2-6-7) and make the wrong answer the look-alike's number — not a picture nobody would pick.
8. Every number a child meets is at most ${rules.maxNumber}.
9. Every say and q is at most ${rules.sayWords} words in Hindi; short, warm, concrete; speak to the child as "तुम", never "आप"; never scold, never the word "wrong".
10. title, sub, say, q, p, why and each aim's short, point, forget and hints are objects with natural English "en" AND natural Hindi "hi" in Devanagari (not transliteration). opts are English; hiOpts are the same answers in Hindi, in Devanagari unless the answer is a number (Yes/No → हाँ/नहीं).
11. Use the words Indian schools use: वर्ग (square), आयत (rectangle), त्रिभुज (triangle), वृत्त (circle), भुजा (side), कोना (corner), चौकोर कोना (square corner), केंद्र (centre), परिमाप (perimeter); घड़ी, घंटे की सुई (छोटी सुई), मिनट की सुई (बड़ी सुई), बजे, साढ़े, सवा, पौने, मिनट, घंटा; महीना, साल, तारीख, हफ़्ता, दिन, कैलेंडर, the months जनवरी … दिसंबर and the days रविवार, सोमवार, मंगलवार, बुधवार, गुरुवार, शुक्रवार, शनिवार. Sizes are written "6 × 3" or "sides 6 and 3" — in Hindi never translate "by" as गुणा.
12. Plain text only: no markup, no brackets of code, no links. ic and art are a single emoji.`;
}

function instructions(rules, count, skills, note, lang){
  return `You write short practice lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (age band "${rules.band}").
A teacher has given you a chapter from their own school's syllabus. Write ${count} lesson(s) that practise what THIS chapter teaches — nothing from outside it.

Every lesson starts with its AIMS: 1 to 4 (3 is best) points a teacher can approve. After the lesson, Appu, a little boy elephant, pretends he forgot them, and the child explains each one back to him. Each aim has:
- point: what the child will be able to do or explain ("The child can …"), the Hindi saying exactly what the English says;
- short: a 2–4 word name for it;
- forget: Appu's puzzled question that makes the child explain it — it must NOT contain the explanation, and it must NAME what it is about: never "this word", "this one", "here", "यह शब्द" or "इस शब्द" alone (after the lesson nothing is on screen) — "What sound does ant start with?", not "How do I find the first sound of this word?";
- hints: exactly 2 gentle nudges, which also must NOT give the explanation;
- ideas: 1–2 things a full explanation says, each with "words": 4–15 words or short phrases a child might use for it, in English, Hindi in Devanagari and romanised Hindi. A single letter or a little word on its own ("a", "the", "is", "shuru") is never a word for an idea — every sentence has one; put it in a phrase ("starts with a", "letter a").
Appu's lines are spoken to the child: warm, short, "तुम" in Hindi, and Appu is a boy — in Hindi he says "मैं भूल गया", "मैं समझ गया" (never गई). An aim whose question or hints already give the explanation is dropped; a lesson with no usable aim is rejected.
How to keep the explanation out of Appu's mouth: his question names the TOPIC ("How do I find out how many sides a shape has?"); the words are the METHOD the child says back ("go round", "count each side once") — words that appear in his question don't count, so don't rely on them. Each hint is a question that points the way WITHOUT using any of the words ("Put your finger on one corner. What do you do next?"), never an instruction that is the method ("Go round the shape" is the explanation itself).

${beatsText()}

${rulesText(rules)}
${lang === 'en' ? englishText(rules) + '\n' : ''}13. skill: the id from this list that the lesson practises, or "" if none fits: ${skills.length ? skills.map(s => `${s.id} (${s.en})`).join('; ') : '(none given)'}.
14. source: where in the chapter it comes from.
${note ? `The teacher's note: "${note}"` : ''}
Answer with JSON only, in the given schema.`;
}

function repairInstructions(rules, lang){
  return `You fix lessons for Takhti, a tutor app for Indian children aged ${rules.ages.join('–')} (band "${rules.band}"). Each lesson below was rejected by Takhti's checker; its reasons are listed. Return each lesson fixed — same topic, same format, same aims, every reason addressed — and change nothing else.
How to read the reasons: "must say what is asked (ask)" → set the figure's ask to what the next question asks (sides, corners, name…); "a rectangle needs w and h" → give both; "say the answer … (in the intro)" or "(in beat N's words)" → rewrite THAT line so it no longer says the answer (an intro may say what we will do — "let us fold a paper circle" — not what we will find), or ask about a new example whose answer is different (teach a square's 4 sides, ask a triangle's); "the teaching picture again" → change the question picture to another shape whose answer is different; "say the answer" also counts number words (three, तीन) — teach the idea without the number; "teach before you ask" → add a teaching picture (a different shape or size from the question's) before the first question; "names the shape" → ask without naming it; "Hindi answers must be in Devanagari" → write hiOpts in Hindi; "a question needs exactly 2 answers" → give opts, hiOpts and correct; "needs a circle with 2 or more folds" / "doesn't show the folds" → set folds to 2 or more (a number, not text); "a row needs its find" → set find to the one shape the question looks for; "exactly one picture may have a square corner" → change the row so only one item has one; a teaching picture's say may tell what to look at, never the number or name asked for; "the clock … must say what is asked" → give the clock ask:"time" (or two clocks ask:"minutes"/"hours"); "a clock is read to" → change m to a time this age reads; "isn't what the clock shows" → mark the time the hands really show; "a whole number of hours" → ask minutes instead; "the question must say how much later" → put k in the question in both languages ("3 months later", "3 महीने बाद"); "isn't what the calendar shows" → mark the month or day the picture really gives; "every question's right answer is …" → change one question so its right answer is different (a No / नहीं, or another word or number), keeping it true to the picture or passage; "asks at least 2 questions" → add a second question: a NEW picture (another shape, time, month or date, with its ask) and its ask beat, before the win; "already gives the explanation (it says …)" → rewrite that question or hint so it no longer uses those words (a hint asks, it doesn't tell), keeping the aim's words as they are; "Appu's question says "this word" without naming it" → put the word itself in Appu's question in both languages ("What sound does ant start with?" / "ant किस आवाज़ से शुरू होता है?"); "words are only single letters or little words" → replace them with phrases that show the idea ("starts with a", "letter a").

${beatsText()}

${rulesText(rules)}
${lang === 'en' ? `${englishText(rules)}
For an English lesson: "an English lesson's Hindi answers are the same English words" → copy opts into hiOpts; "starts with" / "both answers are the first sound" → make the right answer the word's own first letter and the other a different letter; "isn't in the passage" → put the word the answer needs in a word or passage beat just before the question; "asks which word was on the card" → ask the word's first sound, or what it means, or which word fits a short sentence; "copies the textbook word for word" → write that line again with your own words (another child, another thing, another sentence), not the book's.
` : ''}Answer with JSON only, in the given schema.`;
}

const wait =ms => new Promise(r => setTimeout(r, ms));
/* A generateContent answer's JSON, or null — the live call's and a batch
   response's alike. */
export function answerJSON(d){
  const text = ((((d && d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
  try{ const o = JSON.parse(text); return o && typeof o === 'object' ? o : null; }catch(e){ return null; }
}
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
  const primary = env.GEMINI_MODEL || 'gemini-4-hydrogen';
  // the fallbacks, in order — a full Flash model before the lite one (the
  // third live run: flash-lite left out whole questions); a comma list
  const fallbacks = env.GEMINI_FALLBACK_MODEL === 'none' ? []
    : String(env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash,gemini-3.5-flash-lite').split(',').map(x => x.trim()).filter(Boolean);
  const all = [primary].concat(fallbacks.filter((m, i) => m !== primary && fallbacks.indexOf(m) === i));
  const now = Date.now(), awake = all.filter(m => !(RESTING.get(m) > now));
  const models = awake.length ? awake : all.slice(-1);               // all resting: the last one still tries
  const urlFor = m => `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
  const base = { systemInstruction:{ parts:[{ text: system }] }, contents:[{ role:'user', parts }] };
  // the current structured-output field first; older deployments of the API
  // take responseMimeType/responseJsonSchema — one retry covers both
  // a 400 moves to the next shape: the strict schema in both field names
  // first, then the old flattened one (an API that refuses anyOf still works)
  const shapes = GEN_SHAPES;
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
    const out = answerJSON(d);
    if(!out) return { error:'Gemini did not answer in the lesson format', status: 502, tried };
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
  const q = buildRequest(body, { env });
  if(q.error) return { status: q.status, json: { error: q.error, ...(q.maxMb ? { maxMb: q.maxMb } : {}) } };
  const r = await callGemini(q.parts, q.system, env, fetchImpl);
  if(r.error) return { status: r.status, json:{ error: r.error, tried: r.tried } };
  return { status:200, json: lessonsFrom(r.out, q, r) };
}

/* The prompt for a draft or a repair, built from clamped inputs only — the
   live endpoint's (draftCore) and the library builder's Batch API requests
   alike, so the two can't drift. A chapter is inline data (a PDF or photo
   within this server's limit), pasted text, or — for the library builder
   only, never from a phone — a file it uploaded to the Gemini Files API
   (opts.fileUri), which lifts the 12 MB limit. */
export function buildRequest(body, opts = {}){
  body = body || {};
  const env = opts.env || {};
  const rules = cleanRules(body.rules);
  const lang = body.lang === 'en' ? 'en' : '';          // an English book's lesson (englishText)
  if(body.mode === 'repair'){
    const items = (Array.isArray(body.repair) ? body.repair : []).slice(0, 5)
      .filter(x => x && typeof x.lesson === 'object' && JSON.stringify(x.lesson).length < 12000)
      .map(x => ({ lesson: x.lesson, errors: (Array.isArray(x.errors) ? x.errors : []).slice(0, 10).map(e => plain(e, 240)) }));
    if(!items.length) return { status:400, error:'nothing to repair' };
    return { mode:'repair', count: items.length, system: repairInstructions(rules, lang), parts:[{ text: JSON.stringify({ lessons: items }) }] };
  }
  const ch = body.chapter || {};
  const parts = [];
  if(opts.fileUri){
    const mime = String(opts.mime || '');
    if(!FILE_TYPES.includes(mime)) return { status:400, error:'a PDF or a photo (PNG, JPEG, WebP) of the chapter' };
    parts.push({ file_data:{ mime_type: mime, file_uri: String(opts.fileUri) } });
  } else if(ch.file){
    const mime = String(ch.mime || '');
    if(!FILE_TYPES.includes(mime)) return { status:400, error:'a PDF or a photo (PNG, JPEG, WebP) of the chapter' };
    const b64 = String(ch.file);
    if(b64.length > maxB64(env)) return { status:413, error:`that file is too big for this server (up to ${maxMb(env)} MB) — send one chapter, or fewer pages`, maxMb: maxMb(env) };
    // look for one bad character rather than matching the whole string: a
    // whole-string pattern overflows the stack on a multi-megabyte chapter
    if(b64.length < 100 || /[^A-Za-z0-9+/=]/.test(b64)) return { status:400, error:'that file could not be read' };
    parts.push({ inline_data:{ mime_type: mime, data: b64 } });
  }
  const text = plain(ch.text, MAX_TEXT).trim();
  if(text) parts.push({ text: 'The chapter:\n' + text });
  if(!parts.length) return { status:400, error:'no chapter — paste its text or attach a PDF or photo' };
  const count = clamp(body.count, 1, 5, 3);
  const skills = (Array.isArray(body.skills) ? body.skills : []).filter(s => s && SKILL.test(s.id)).slice(0, 60)
    .map(s => ({ id: s.id, en: plain(s.en, 60) }));
  const note = plain(body.note, 200).trim();
  parts.push({ text: `Write ${count} lesson(s) from this chapter.` });
  return { mode:'draft', count, system: instructions(rules, count, skills, note, lang), parts };
}

/* What Gemini sent, as the endpoint answers it: lessons only, at most as
   many as asked for, each still to be checked on the phone. */
export function lessonsFrom(out, q, r = {}){
  const lessons = (Array.isArray(out && out.lessons) ? out.lessons : []).filter(l => l && typeof l === 'object').slice(0, q.count);
  return q.mode === 'repair' ? { lessons, model: r.model, tried: r.tried }
    : { chapter: plain(out && out.chapter, 80), lessons, model: r.model, tried: r.tried };
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
