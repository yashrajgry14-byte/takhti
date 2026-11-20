/* ==================================================================
   AGE BANDS

   An eight-year-old handed a five-year-old's content gets bored and
   leaves; a five-year-old handed an eight-year-old's content decides
   they are stupid and leaves. Both failures look identical in a
   retention graph and neither is fixable by an adaptive level alone,
   because levels only move AFTER a child has already had a bad time.
   Age is the prior that stops the first session being wrong.

   Age sets the ceiling and the floor. The adaptive engine still moves
   the child inside that window — a struggling eight-year-old drops to
   the bottom of their band, not into nursery content, which matters
   because being visibly given a toddler's work is humiliating and
   children stop opening apps that humiliate them.
   ================================================================== */

const AGE_BANDS = {
  /* 3–4 · pre-reader. Letters and sounds. No sentences at all. */
  pre: {
    id:'pre', ages:[3,4], read:'pre',
    en:'Little ones', hi:'छोटे बच्चे',
    levels:  { read:[1,2], write:[1,2], math:[1,2] },
    start:   { read:1, write:1, math:1 },
    modules: ['read','write','count'],          // no free-form Ask yet
    maxNumber: 10,
    factNumberCap: 12,
    sessionCards: 1,
    traceOnly: true,                            // never asks them to copy a sentence
    chunkWords: 3,
    speechRate: 0.72,
    passScore: 65,
    gateScore: 55
  },

  /* 5–6 · early reader. Short sentences, single-digit sums. */
  early: {
    id:'early', ages:[5,6], read:'early',
    en:'Just starting', hi:'अभी शुरुआत',
    levels:  { read:[1,3], write:[1,3], math:[1,3] },
    start:   { read:1, write:1, math:2 },
    modules: ['read','write','count','ask'],
    maxNumber: 20,
    factNumberCap: 30,
    sessionCards: 1,
    traceOnly: true,
    chunkWords: 5,
    speechRate: 0.78,
    passScore: 68,
    gateScore: 58
  },

  /* 7–8 · developing. Full sentences, two-digit work, paper writing. */
  developing: {
    id:'developing', ages:[7,8], read:'developing',
    en:'Getting good', hi:'अच्छा चल रहा है',
    levels:  { read:[2,5], write:[2,5], math:[2,5] },
    start:   { read:2, write:2, math:3 },
    modules: ['read','write','count','ask'],
    maxNumber: 100,
    factNumberCap: 200,
    sessionCards: 2,
    traceOnly: false,
    chunkWords: 8,
    speechRate: 0.85,
    passScore: 78,
    gateScore: 65
  },

  /* 9–10 · fluent. Long sentences, multiplication, everything on. */
  fluent: {
    id:'fluent', ages:[9,10], read:'fluent',
    en:'Confident', hi:'आत्मविश्वासी',
    levels:  { read:[3,6], write:[3,6], math:[3,6] },
    start:   { read:3, write:3, math:4 },
    modules: ['read','write','count','ask'],
    maxNumber: 1000,
    factNumberCap: 10000,
    sessionCards: 2,
    traceOnly: false,
    chunkWords: 10,
    speechRate: 0.9,
    passScore: 82,
    gateScore: 70
  }
};

function bandForAge(age){
  const a = Number(age) || 6;
  if(a <= 4) return AGE_BANDS.pre;
  if(a <= 6) return AGE_BANDS.early;
  if(a <= 8) return AGE_BANDS.developing;
  return AGE_BANDS.fluent;
}

/* ==================================================================
   CLASSES — the class decides WHAT is taught; age decides HOW.

   The school, its book, its syllabus and its teacher all work by class,
   so a child's class is what picks the content: which band of sentences
   and sums, which writing tasks, how far down a gap may reach. Age only
   tunes the delivery (Munni's speaking pace). Two ten-year-olds in
   Class 4 and Class 5 get their own class's work; a ten-year-old is
   never handed a trace pad of single letters because "ten" happened to
   fall in a band whose writing ladder starts at the alphabet.

   band: the content band (AGE_BANDS key) — same mapping the teacher's
         SYL_CLASSES uses (core/syllabus.js), so child and teacher agree.
   stage: NEP 2020's stages (foundational split at Class 1).
   write: 'trace'        trace pad only (Nursery–UKG)
          'trace+paper'  trace first, paper offered (Class 1)
          'paper'        no tracing at all: copy on paper, or dictation (Class 2+)
   start: a higher class starts higher inside its band.
   Classes 6–10 share the fluent band's look-ups (clocks, calendars,
   games) but bring their own levels 7–10, number ceiling and pass mark
   (UPPER_CLASS below).
   ================================================================== */
/* Classes 6–10: their own reading lines (levels 7–10, content/sentences.js)
   and maths (levels 7–10, content/upper.js), starting at the class's own
   level with one below it to fall back on; bigger numbers allowed. */
function UPPER_CLASS(read, math, maxNumber){
  const win = l => [Math.max(5, l - 2), Math.min(10, l + 1)];
  return { start:{ read, write: read, math }, levels:{ read: win(read), write: win(read), math: win(math) }, maxNumber,
           factNumberCap: maxNumber * 10, chunkWords: 12, passScore: 84 };
}
const CLASSES = [
  { id:'nur', g:-3, band:'pre',        stage:'foundA',    write:'trace',       en:'Nursery',  hi:'नर्सरी' },
  { id:'lkg', g:-2, band:'pre',        stage:'foundA',    write:'trace',       en:'LKG',      hi:'एलकेजी' },
  { id:'ukg', g:-1, band:'early',      stage:'foundA',    write:'trace',       en:'UKG',      hi:'यूकेजी' },
  { id:'c1',  g:1,  band:'early',      stage:'foundB',    write:'trace+paper', en:'Class 1',  hi:'कक्षा 1' },
  { id:'c2',  g:2,  band:'developing', stage:'foundB',    write:'paper',       en:'Class 2',  hi:'कक्षा 2' },
  { id:'c3',  g:3,  band:'developing', stage:'prep',      write:'paper',       en:'Class 3',  hi:'कक्षा 3',  start:{ read:3, write:3, math:4 } },
  { id:'c4',  g:4,  band:'fluent',     stage:'prep',      write:'paper',       en:'Class 4',  hi:'कक्षा 4' },
  { id:'c5',  g:5,  band:'fluent',     stage:'prep',      write:'paper',       en:'Class 5',  hi:'कक्षा 5',  start:{ read:4, write:4, math:5 } },
  { id:'c6',  g:6,  band:'fluent',     stage:'middle',    write:'paper',       en:'Class 6',  hi:'कक्षा 6',  ...UPPER_CLASS(7, 7, 100000) },
  { id:'c7',  g:7,  band:'fluent',     stage:'middle',    write:'paper',       en:'Class 7',  hi:'कक्षा 7',  ...UPPER_CLASS(8, 8, 100000) },
  { id:'c8',  g:8,  band:'fluent',     stage:'middle',    write:'paper',       en:'Class 8',  hi:'कक्षा 8',  ...UPPER_CLASS(8, 9, 100000) },
  { id:'c9',  g:9,  band:'fluent',     stage:'secondary', write:'paper',       en:'Class 9',  hi:'कक्षा 9',  ...UPPER_CLASS(9, 10, 10000000) },
  { id:'c10', g:10, band:'fluent',     stage:'secondary', write:'paper',       en:'Class 10', hi:'कक्षा 10', ...UPPER_CLASS(10, 10, 10000000) }
];
const STAGES = {
  foundA:    { en:'Foundational', hi:'बुनियादी' },
  foundB:    { en:'Foundational', hi:'बुनियादी' },
  prep:      { en:'Preparatory',  hi:'प्रारंभिक' },
  middle:    { en:'Middle',       hi:'मध्य' },
  secondary: { en:'Secondary',    hi:'माध्यमिक' }
};
const MAX_AGE = 16;

const classById = id => CLASSES.find(k => k.id === id) || null;
/* Classes 6–10 are built (content/upper.js) but not offered (21 Nov 2026): their
   lessons haven't been tried with children or reviewed by a subject teacher. No
   picker — the child's class or age, the parent's, the teacher's roster or
   syllabus — goes past Class 5 (age 10). Their content stays in the code;
   raise this to 10 to offer them again. */
const CLASS_SHOWN_MAX = 5;
const AGE_SHOWN_MAX = Math.min(MAX_AGE, CLASS_SHOWN_MAX + 5);
const classesShown = () => CLASSES.filter(k => k.g <= CLASS_SHOWN_MAX);

/* The usual class for an age in India (Class 1 at six). Only a guess:
   it is offered pre-selected on the class screen, and it stands in for
   a profile made before class existed — which keeps those children on
   exactly the band they had. */
function clsForAge(age){
  const a = Math.round(Number(age) || 6);
  if(a <= 3) return 'nur';
  if(a === 4) return 'lkg';
  if(a === 5) return 'ukg';
  return 'c' + Math.min(10, a - 5);
}
function classFor(child){
  const c = child || S;
  return classById(c.cls) || classById(clsForAge(c.age || 6));
}

/* How far down a gap may reach. From Class 3, never into pre-primary
   work (pencil grip, tracing, counting to five): that is the nursery
   screen a ten-year-old must never be handed. School skills from Class 1
   up stay in reach for Classes 3–5, because a Class 5 child still adding
   like a Class 2 child is common, and re-teaching that IS Takhti's loop.
   From Class 6, at most four classes down; deeper is the teacher's call. */
const GAP_REACH = 4;

const _bandCache = new Map();
function bandFor(child){
  const c = child || S, k = classFor(c), age = Number(c.age) || 0;
  const key = k.id + '|' + age;
  if(_bandCache.has(key)) return _bandCache.get(key);
  const base = AGE_BANDS[k.band];
  const b = Object.assign({}, base, {
    cls: k.id, clsEn: k.en, clsHi: k.hi, g: k.g,
    stage: k.stage, stageEn: STAGES[k.stage].en, stageHi: STAGES[k.stage].hi,
    write: k.write,
    traceOnly: k.write === 'trace',               // never asks them to copy a sentence
    trace: k.write !== 'paper',                   // a trace pad is offered at all
    gFloor: k.g >= 3 ? Math.max(1, k.g - GAP_REACH) : -Infinity,
    start: Object.assign({}, base.start, k.start || {}),
    levels: k.levels ? { ...base.levels, ...k.levels } : base.levels,
    maxNumber: k.maxNumber || base.maxNumber,
    factNumberCap: k.factNumberCap || base.factNumberCap,
    chunkWords: k.chunkWords || base.chunkWords,
    passScore: k.passScore || base.passScore,
    // delivery follows the child's own age, not the class
    speechRate: age ? (age >= 11 ? 0.95 : bandForAge(age).speechRate) : base.speechRate
  });
  _bandCache.set(key, b);
  return b;
}

/* The single accessor everything else uses. The child's class picks the
   band; a profile with no class yet falls back to the usual class for
   its age (the middle band if there is no age either). */
function band(){ return bandFor(S); }

/* Tracing is for Nursery to Class 1 only. Above Class 1 no child is
   handed a trace pad — not on the Write screen, and not as a "gap
   underneath" either: holding a pencil and tracing lines are never a
   Class 2+ child's next step. */
const TRACE_SKILLS = ['n-hold', 'n-trace'];
const TRACE_MAX_G = 1;

/* May a gap (a prerequisite) be taught to this child as part of their
   path? Never a tracing skill above Class 1; from Class 3, never below
   the floor. */
function gapInReach(skillId, child){
  const b = bandFor(child);
  if(b.g > TRACE_MAX_G && TRACE_SKILLS.includes(skillId)) return false;
  const s = typeof skillById === 'function' ? skillById(skillId) : null;
  if(!s || s.g == null) return true;
  return s.g >= b.gFloor;
}

/* Clamp a level into the child's age window. Called wherever the
   adaptive engine would otherwise be free to wander. */
function clampLevel(mod, lvl, child){
  const [lo, hi] = bandFor(child || S).levels[mod] || [1,6];
  return Math.max(lo, Math.min(hi, lvl));
}

/* Is this module even offered at this age? */
function moduleAllowed(m){ return band().modules.includes(m); }

/* Age-appropriate slice of any sentence pool, by measured difficulty
   rather than by which array it happens to live in.

   If nothing at the child's level is easy enough, walk DOWN through the
   lower levels before giving up — and if the whole bank is still too
   hard (a real gap in the Hindi content for pre-readers), hand back the
   easiest lines that exist rather than something they cannot read. A
   slightly easy sentence is a small waste; an unreadable one teaches a
   four-year-old that reading is not for them. */
function ageSentences(lang, level){
  const top = clampLevel('read', level);
  const [lo] = band().levels.read;
  const want = band().read;

  for(let l = top; l >= lo; l--){
    const pool = (SENTENCES[lang] && SENTENCES[lang][l]) || [];
    const fit = pool.filter(t => rdBand(readability(t, lang).score, lang) === want
                              || rdOrder(readability(t, lang).band) < rdOrder(want));
    if(fit.length) return fit;
  }
  // nothing in band anywhere: return the easiest lines the bank contains
  const all = [];
  for(let l = lo; l <= top; l++) all.push(...((SENTENCES[lang] && SENTENCES[lang][l]) || []));
  if(!all.length) return [];
  const scored = all.map(t => ({ t, s: readability(t, lang).score })).sort((a,b) => a.s - b.s);
  const floor = scored[0].s;
  return scored.filter(x => x.s <= floor + 6).map(x => x.t);
}
function rdOrder(b){ return ['pre','early','developing','fluent'].indexOf(b); }

/* Facts carry hero numbers; a four-year-old should not meet 400 km/h. */
function ageFacts(gameId){
  const list = (typeof FACTS !== 'undefined' && FACTS[gameId]) || [];
  const cap = band().factNumberCap;
  const ok = list.filter(f => f.h == null || Number(f.h) <= cap);
  return ok.length ? ok : list.slice(0, 1);
}
