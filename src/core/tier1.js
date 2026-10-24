/* ==================================================================
   TIER 1 — a fresh practice line for the words a child just stumbled on.

   After a reading that wasn't a pass, the child is offered one more
   line that uses the word(s) they missed, at their own level. Two
   sources, in this order:

     1. The curated sentence bank (content/sentences.js), every level up
        to the child's own +1 — reviewed content, works on every phone,
        offline, always. Most missed words are in it somewhere else,
        because the line they just read came from it.
     2. An on-device language model, only when no bank line has EVERY
        missed word (a bank line with some of them is the fallback):
        the browser's built-in model (Chrome's Prompt API, `LanguageModel`),
        when this phone already has it. Nothing is downloaded mid-lesson,
        no network is touched, and nothing leaves the device.

   A model-written line is accepted only if it is something this app
   would ship itself (t1Valid): it contains every target word, fits the
   band's length, uses only plain letters and punctuation, and reads at
   or below the child's band on core/readability.js's own scale. A
   bounded, one-sentence task — never a conversation (see CLAUDE.md's
   "tutor, not a companion").
   ================================================================== */

const T1_MAX_WORDS = { pre:5, early:7, developing:10, fluent:14 };

const t1Words = (line, lang) => line.split(/\s+/).map(w => normWord(w, lang)).filter(Boolean);

function t1FromBank(words, lang, level, current){
  const want = words.map(w => normWord(w, lang));
  let best = null;
  for(let l = 1; l <= Math.min(6, level + 1); l++){
    for(const line of ((SENTENCES[lang] || {})[l] || [])){
      if(line === current) continue;
      const ws = t1Words(line, lang);
      const hits = want.filter(w => ws.includes(w)).length;
      if(!hits) continue;
      const score = hits * 100 - ws.length;          // most target words first, then the shortest
      if(!best || score > best.score) best = { line, score, all: hits === want.length };
    }
  }
  return best;
}

function t1Valid(line, words, lang){
  if(typeof line !== 'string') return false;
  line = line.trim();
  const ws = t1Words(line, lang);
  if(ws.length < 3 || ws.length > (T1_MAX_WORDS[band().id] || 10)) return false;
  const allowed = lang === 'hi' ? /^[ऀ-ॿ ,.!?।]+$/ : /^[A-Za-z ,.'!?]+$/;
  if(!allowed.test(line) || /\S\.\S/.test(line)) return false;     // no markup, digits, or dotted addresses
  if(!words.every(w => ws.includes(normWord(w, lang)))) return false;
  return rdOrder(readability(line, lang).band) <= rdOrder(band().read);
}

const T1_MODEL_LANGS = { en:'en', hi:'hi' };

/* 'available' | 'downloadable' | 'downloading' | 'unavailable' — for the
   parent dashboard, and so a lesson never waits on a model download. */
async function tier1ModelStatus(lang){
  if(typeof LanguageModel === 'undefined' || !LanguageModel.availability) return 'unavailable';
  const l = T1_MODEL_LANGS[lang];
  try{
    return await LanguageModel.availability({ expectedInputs:[{ type:'text', languages:[l] }],
                                              expectedOutputs:[{ type:'text', languages:[l] }] });
  }catch(e){ return 'unavailable'; }
}

async function t1FromModel(words, lang){
  if(await tier1ModelStatus(lang) !== 'available') return null;
  const l = T1_MODEL_LANGS[lang];
  let session = null;
  try{
    session = await LanguageModel.create({
      expectedInputs:[{ type:'text', languages:[l] }], expectedOutputs:[{ type:'text', languages:[l] }],
      initialPrompts:[{ role:'system', content:
        'You write ONE short, simple, kind sentence for a young child in India to read aloud. ' +
        'Use everyday words about family, school, animals, food, weather or games. ' +
        'No names of real people, brands or places. Reply with the sentence only.' +
        (lang === 'hi' ? ' Write it in Hindi, in Devanagari script.' : '') }]
    });
    const out = await session.prompt(
      `Write one sentence of at most ${T1_MAX_WORDS[band().id] || 10} words that uses: ${words.join(', ')}.`);
    const line = String(out || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
    return t1Valid(line, words, lang) ? line : null;
  }catch(e){
    return null;
  }finally{
    try{ session && session.destroy && session.destroy(); }catch(e){}
  }
}

/* { line, source:'bank'|'model' } or null when neither has anything. */
async function tier1PracticeLine(words, lang, level, current){
  const ws = (words || []).filter(Boolean);
  if(!ws.length) return null;
  // a bank line with EVERY missed word wins outright; otherwise the model
  // gets a chance to write one, and a bank line with some of them is the
  // fallback
  const bank = t1FromBank(ws, lang, level, current);
  if(bank && bank.all) return { line: bank.line, source: 'bank' };
  const gen = await t1FromModel(ws, lang);
  if(gen) return { line: gen, source: 'model' };
  return bank ? { line: bank.line, source: 'bank' } : null;
}
