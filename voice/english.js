/* ==================================================================
   SPOKEN ENGLISH — oral practice for children who learn in Hindi

   Hindi-medium parents ask for spoken English more than anything else,
   and it is purely oral, so the phone is its natural home. A parent turns
   it on per child; it then alternates with the normal lesson, never
   replacing reading and maths.

   Two kinds of item, both short and concrete:
     word    Munni (in Hindi): "पानी को अंग्रेज़ी में क्या कहते हैं?"
             → "water". A miss gets a two-choice clue, then the answer.
             3–4 year olds instead hear it and say it back.
     phrase  "अंग्रेज़ी में कहते हैं: My name is Riya. अब तुम बोलो!"
             → graded by sound, in either script (voice/sounds.js), against
             the age band's own pass score.

   What a phone recognizer writes for an English word in a Hindi call is
   often Devanagari (वॉटर). Grading by sound, not spelling, is what makes
   that work. The bank avoids words the sound skeleton cannot tell apart
   (vowel-only words, silent letters), and words Hindi speakers already
   use as Hindi (school, teacher), which would make a question trivial.
   Words that differ only in a vowel (red / read, rain / run) can't share
   the bank: the sound check would accept one for the other.

   This is practice, not a level: nothing here is written to the app's
   reading/writing/maths record. Per-child word history lives on the
   voice record only, to choose tomorrow's words.
   ================================================================== */
'use strict';
const { soundsLike, phraseScore, saidAny, skeleton } = require('./sounds');

/* [english, hindi meaning, accepted answers (first is the one Munni teaches), tier]
   tier 1: 3–6 year olds · tier 2: 7–10 adds these */
const WORDS = [
  ['water', 'पानी', ['water'], 1], ['milk', 'दूध', ['milk'], 1], ['dog', 'कुत्ता', ['dog'], 1],
  ['cat', 'बिल्ली', ['cat', 'kitten'], 1], ['cow', 'गाय', ['cow'], 1], ['sun', 'सूरज', ['sun'], 1],
  ['moon', 'चाँद', ['moon'], 1], ['star', 'तारा', ['star'], 1], ['ball', 'गेंद', ['ball'], 1],
  ['hand', 'हाथ', ['hand'], 1], ['red', 'लाल', ['red'], 1], ['blue', 'नीला', ['blue'], 1],
  ['green', 'हरा', ['green'], 1], ['book', 'किताब', ['book'], 1], ['house', 'घर', ['house', 'home'], 1],
  ['tree', 'पेड़', ['tree'], 1], ['bird', 'चिड़िया', ['bird'], 1], ['fish', 'मछली', ['fish'], 1],
  ['flower', 'फूल', ['flower'], 1], ['rice', 'चावल', ['rice'], 1], ['chair', 'कुर्सी', ['chair'], 1],
  ['mother', 'माँ', ['mother', 'mummy', 'mom', 'mum'], 1], ['father', 'पिता', ['father', 'papa', 'daddy', 'dad'], 1],
  ['friend', 'दोस्त', ['friend'], 2], ['rain', 'बारिश', ['rain'], 2], ['morning', 'सुबह', ['morning'], 2],
  ['night', 'रात', ['night'], 2], ['big', 'बड़ा', ['big', 'large'], 2], ['small', 'छोटा', ['small', 'little'], 2],
  ['hot', 'गरम', ['hot'], 2], ['cold', 'ठंडा', ['cold'], 2], ['happy', 'ख़ुश', ['happy', 'glad'], 2],
  ['drink', 'पीना', ['drink'], 2], ['apple', 'सेब', ['apple'], 2], ['banana', 'केला', ['banana'], 2],
  ['orange', 'संतरा', ['orange'], 2], ['sister', 'बहन', ['sister'], 2], ['brother', 'भाई', ['brother'], 2],
  ['door', 'दरवाज़ा', ['door'], 2], ['window', 'खिड़की', ['window'], 2]
].map(([en, hi, accept, tier]) => ({ en, hi, accept, tier }));

/* {name} is filled with the child's own name. Hindi meanings avoid
   gendered verb endings (a girl and a boy hear the same line). */
const PHRASES = [
  ['Hello!', 'नमस्ते!', 1], ['Thank you.', 'धन्यवाद।', 1], ['Good morning.', 'सुप्रभात।', 1],
  ['My name is {name}.', 'मेरा नाम {name} है।', 1], ['I am fine.', 'मैं ठीक हूँ।', 1],
  ['How are you?', 'आप कैसे हैं?', 1], ['This is my book.', 'यह मेरी किताब है।', 1],
  ['The sun is hot.', 'सूरज गरम है।', 1], ['Thank you very much.', 'बहुत-बहुत धन्यवाद।', 2],
  ['May I come in?', 'क्या मैं अंदर आ जाऊँ?', 2], ['Please help me.', 'कृपया मेरी मदद करो।', 2],
  ['What is your name?', 'तुम्हारा नाम क्या है?', 2], ['I am sorry.', 'मुझे माफ़ करना।', 2],
  ['We go to school every day.', 'हम हर दिन स्कूल जाते हैं।', 2], ['See you tomorrow.', 'कल मिलते हैं।', 2],
  ['Can I drink water, please?', 'क्या मैं पानी पी लूँ?', 2]
].map(([en, hi, tier]) => ({ en, hi, tier }));

/* Munni's lines for English practice, both languages (the bilingual rule
   holds even here: an English-medium child hears instructions in English). */
const EL = {
  start:     { en: "Today we'll speak English!", hi: 'आज हम अंग्रेज़ी बोलेंगे!' },
  wordQ:     { en: "How do you say '{hi}' in English?", hi: "'{hi}' को अंग्रेज़ी में क्या कहते हैं?" },
  wordSay:   { en: "In English, '{hi}' is {en}. Now you say: {en}", hi: "'{hi}' को अंग्रेज़ी में {en} कहते हैं। अब तुम बोलो: {en}" },
  wordClue:  { en: "Let's think again. Is it {x} or {y}?", hi: 'एक बार फिर सोचो। {x} या {y}?' },
  wordClueDK:{ en: "That's okay! Here's a clue. Is it {x} or {y}?", hi: 'कोई बात नहीं! एक इशारा: {x} या {y}?' },
  wordReveal:{ en: "'{hi}' is {en} in English. Good try!", hi: "'{hi}' को अंग्रेज़ी में {en} कहते हैं। अच्छी कोशिश!" },
  phrase:    { en: 'In English we say: {en} Now you say it!', hi: "'{hi}' को अंग्रेज़ी में कहते हैं: {en} अब तुम बोलो!" },
  phraseTry: { en: 'Good try! Listen again: {en}', hi: 'अच्छी कोशिश! फिर से सुनो: {en}' },
  phraseGood:{ en: 'Wow! You said it beautifully.', hi: 'वाह! बहुत सुंदर बोला।' },
  phraseDone:{ en: "Good try! Let's go on.", hi: 'अच्छी कोशिश! चलो आगे बढ़ें।' },
  notHeard:  { en: "I didn't hear. Say it once more?", hi: 'मुझे सुनाई नहीं दिया। फिर से बोलो?' },
  finish:    { en: "That's all for today! You said {w} English words and {p} sentences. Shabaash! Bye bye!",
               hi: 'आज के लिए इतना ही! तुमने अंग्रेज़ी के {w} शब्द और {p} वाक्य बोले। शाबाश! बाय-बाय!' }
};

const tierFor = band => (band === 'pre' || band === 'early') ? 1 : 2;

function englishPlan(band) {
  if (band === 'pre') return ['ephrase', 'esay', 'esay', 'ephrase', 'esay'];
  if (band === 'early') return ['ephrase', 'eword', 'eword', 'ephrase', 'eword'];
  return ['ephrase', 'eword', 'eword', 'ephrase', 'eword', 'eword', 'ephrase'];
}

/* Choose today's words and phrases: never seen first, then the ones this
   child has found hardest, shuffled by the session seed. */
function chooseEnglish(child, band, rand) {
  const tier = tierFor(band);
  const hist = child.english_words || {};
  const pool = WORDS.filter(w => w.tier <= tier);
  const plan = englishPlan(band);
  const nW = plan.filter(s => s === 'eword' || s === 'esay').length, nP = plan.filter(s => s === 'ephrase').length;
  const shuffle = arr => arr.map(x => ({ x, k: rand() })).sort((a, b) => a.k - b.k).map(o => o.x);
  // up to half the words come back from last time's misses (hardest first);
  // the rest are new; known words fill in only when the bank runs out
  const acc = w => hist[w.en].right / hist[w.en].n;
  const weak = pool.filter(w => hist[w.en] && acc(w) < 0.5).sort((a, b) => acc(a) - acc(b));
  const unseen = shuffle(pool.filter(w => !hist[w.en]));
  const known = shuffle(pool.filter(w => hist[w.en] && acc(w) >= 0.5));
  const back = weak.slice(0, Math.ceil(nW / 2));
  const words = shuffle([...back, ...unseen.slice(0, nW - back.length)]).concat(weak.slice(back.length), known);
  const phrases = shuffle(PHRASES.filter(p => p.tier <= tier));
  // "Hello!" first when it is in the set: a warm, sure start
  const ph = phrases.slice(0, nP);
  const hello = PHRASES[0];
  if (!ph.includes(hello) && phrases.includes(hello)) ph[0] = hello;
  ph.sort((a, b) => (b === hello) - (a === hello));
  return { slots: plan, words: words.slice(0, nW).map(w => w.en), phrases: ph.map(p => p.en) };
}

const wordByEn = en => WORDS.find(w => w.en === en);
const phraseByEn = en => PHRASES.find(p => p.en === en);
const fill = (tpl, lang, v) => { let s = tpl[lang] || tpl.en; for (const k in v) s = s.split('{' + k + '}').join(v[k]); return s; };

/* A clue word that sounds clearly different from the answer (dog/duck,
   hot/hat are too close for the sound check to be fair). */
function distractorFor(word, rand) {
  const sk = skeleton(word.en);
  const others = WORDS.filter(w => w.en !== word.en && w.tier <= Math.max(word.tier, 1) && skeleton(w.en)[0] !== sk[0] && !soundsLike(w.en, word.en));
  return others[Math.floor(rand() * others.length)] || WORDS.find(w => w.en !== word.en);
}

function buildEnglishItem(slot, s, child, lang, k, rand) {
  const name = child.name;
  if (slot === 'ephrase') {
    const en = s.english.phrases[s.items.filter(x => x.kind === 'ephrase').length];
    const p = en && phraseByEn(en);
    if (!p) return null;
    const target = p.en.replace('{name}', name), hi = p.hi.replace('{name}', name);
    const quoted = hi.replace(/[।!?.]+$/, '');            // 'आप कैसे हैं' को…, not 'आप कैसे हैं?' को…
    return { kind: 'ephrase', expect: 'phrase', target, meaning: hi, prompt: fill(EL.phrase, lang, { en: target, hi: quoted }) };
  }
  const en = s.english.words[s.items.filter(x => x.kind === 'eword' || x.kind === 'esay').length];
  const w = en && wordByEn(en);
  if (!w) return null;
  if (slot === 'esay') {
    return { kind: 'esay', expect: 'phrase', word: w.en, target: w.en, meaning: w.hi, prompt: fill(EL.wordSay, lang, { hi: w.hi, en: w.en }) };
  }
  const d = distractorFor(w, rand);
  return { kind: 'eword', expect: 'english', word: w.en, accept: w.accept, meaning: w.hi, distractor: d.en,
           prompt: fill(EL.wordQ, lang, { hi: w.hi }), why: '' };
}

/* Grade a word answer: right if any accepted answer is heard, in either script. */
const gradeWord = (it, said) => !!saidAny(it.accept, said);

/* Grade a phrase (or a word said back) by sound, against the band's pass score. */
function gradePhrase(it, said, pass, gate) {
  const r = phraseScore(it.target, said);
  const verdict = r.score >= pass ? 'pass' : r.score >= Math.round(gate / 2) ? 'coach' : 'unsure';
  return { score: r.score, verdict, missed: r.missed };
}

module.exports = { WORDS, PHRASES, EL, englishPlan, chooseEnglish, buildEnglishItem, gradeWord, gradePhrase, wordByEn, fill };
