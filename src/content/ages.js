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
    speechRate: 0.72
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
    speechRate: 0.78
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
    speechRate: 0.85
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
    speechRate: 0.9
  }
};

function bandForAge(age){
  const a = Number(age) || 6;
  if(a <= 4) return AGE_BANDS.pre;
  if(a <= 6) return AGE_BANDS.early;
  if(a <= 8) return AGE_BANDS.developing;
  return AGE_BANDS.fluent;
}

/* The single accessor everything else uses. Defaults to the middle band
   so nothing breaks for a profile created before age existed. */
function band(){ return bandForAge(S.age || 6); }

/* Clamp a level into the child's age window. Called wherever the
   adaptive engine would otherwise be free to wander. */
function clampLevel(mod, lvl){
  const [lo, hi] = band().levels[mod] || [1,6];
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
