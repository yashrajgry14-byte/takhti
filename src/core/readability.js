/* ==================================================================
   READABILITY — how hard is this line, really?

   The honest answer to "use ML to sort content by age" is: you do not
   need a model for this, you need a measurement. A model trained on no
   data would be a guess wearing a lab coat; this is a metric you can
   explain to a teacher, defend to a judge, and debug when it is wrong.

   It scores any sentence 0–100 and assigns an age band. That means new
   content never has to be hand-labelled — write a line, and it slots
   itself. When you have real usage data (which item did which child
   actually fail?), you replace the weights here with learned ones and
   the interface does not change.

   Devanagari needs different features from Latin:
     conjuncts (क्ष, त्र, स्व) are the real difficulty spike for a
     young reader, far more than word length. A five-year-old reads
     कमल fluently and stalls completely on विद्यालय.
   ================================================================== */

const RD_WEIGHTS = {
  hi: { words: 3.2, gLen: 5.0, conjunct: 7.5, rareMatra: 4.0, longWord: 6.0 },
  en: { words: 3.0, gLen: 2.6, syll: 5.5, rareCluster: 5.0, longWord: 6.5 }
};

/* matras a beginner meets late: ऐ ौ ृ ॄ ॢ and the chandra forms */
const RD_RARE_MATRA = /[\u0943\u0944\u0962\u0963\u0945\u0949\u0948\u094C]/g;
/* halant = a conjunct join; the single strongest difficulty signal in Hindi */
const RD_HALANT = /\u094D/g;
const RD_RARE_CLUSTER = /(tch|ough|augh|sch|thr|spl|scr|shr|phth)/g;

function rdSyllables(word){
  const w = word.toLowerCase().replace(/[^a-z]/g,'');
  if(!w) return 0;
  const groups = w.replace(/e$/,'').match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function readability(text, lang){
  const clean = String(text||'').trim();
  if(!clean) return { score:0, band:'pre', words:0 };
  const words = clean.split(/\s+/).filter(Boolean);
  const w = RD_WEIGHTS[lang === 'hi' ? 'hi' : 'en'];
  const n = words.length;

  let score = n * w.words;
  const longWords = words.filter(x => graphemes(x).length > (lang==='hi' ? 5 : 7)).length;
  score += longWords * w.longWord;

  const meanG = words.reduce((a,x)=>a+graphemes(x).length,0) / n;
  score += Math.max(0, meanG - 2.5) * w.gLen;

  if(lang === 'hi'){
    score += (clean.match(RD_HALANT)     || []).length * w.conjunct;
    score += (clean.match(RD_RARE_MATRA) || []).length * w.rareMatra;
  } else {
    const syll = words.reduce((a,x)=>a+rdSyllables(x),0) / n;
    score += Math.max(0, syll - 1) * w.syll * n / 3;
    score += (clean.toLowerCase().match(RD_RARE_CLUSTER) || []).length * w.rareCluster;
  }

  score = Math.round(Math.min(100, score));
  return { score, band: rdBand(score, lang), words: n };
}

/* Band cut-offs, per script. Devanagari words are shorter in graphemes
   than English words are in letters, so the same sentence scores lower
   in Hindi — the thresholds compensate. These were fitted against the
   shipped sentence bank, not picked from the air; the check is that
   levels 1–6 climb through the bands in order in BOTH languages. */
const RD_CUTS = {
  hi: { pre:14, early:25, developing:38 },   // 3–4 / 5–6 / 7–8 / 9–10
  en: { pre:14, early:27, developing:45 }
};
function rdBand(score, lang){
  const c = RD_CUTS[lang === 'hi' ? 'hi' : 'en'];
  if(score <= c.pre)        return 'pre';
  if(score <= c.early)      return 'early';
  if(score <= c.developing) return 'developing';
  return 'fluent';
}

/* Filter any pool down to what this child should actually be seeing.
   Falls back one band at a time rather than returning nothing — an
   empty screen is worse than a slightly easy sentence. */
function rdFilter(pool, lang, band){
  const order = ['pre','early','developing','fluent'];
  const cap = order.indexOf(band);
  for(let c = cap; c >= 0; c--){
    const allowed = order.slice(0, c+1);
    const hit = pool.filter(t => allowed.includes(readability(t, lang).band));
    if(hit.length) return hit;
  }
  return pool;
}
