/* ==================================================================
   UNDERSTAND — what did the child actually say?

   On the phone there is no tap target. A child answering "7 + 2" can
   say any of: 9, ९, nine, नौ, nau, "it is nine", "नौ है", "eight… no,
   nine". This file turns all of those into the number 9, and turns
   "phir se bolo", "I don't know" and "bas" into intents the session
   can act on, so the language model never has to guess.

   Rules this file keeps:
   - The LAST number in an utterance wins. Children self-correct out
     loud ("eight… no, nine"), and "4 and 3 makes 7" ends on the answer.
   - A doubt is not a wrong answer. If no number can be found we return
     null and the caller asks again; it never records a miss.
   - Recognizers spell Hindi numbers inconsistently (पांच / पाँच, चौंतीस /
     चौतीस, छह / छः). Both sides are folded before comparing, the same
     idea as foldWord() in src/core/matcher.js, narrowed to numbers.
   ================================================================== */
'use strict';

/* ---------- Hindi 0–100: Devanagari plus common romanized spellings ----------
   Hindi numbers are irregular; there is no "twenty + three" rule to lean on,
   so every one is listed. Roman variants are what ASR and children type/say
   in Hinglish. Order: [value, devanagari variants..., '|', roman variants...] */
const HI_TABLE = [
  [0, 'शून्य', 'सिफ़र', 'ज़ीरो', '|', 'shunya', 'shoonya', 'sifar', 'zero'],
  [1, 'एक', '|', 'ek', 'aik'],
  [2, 'दो', '|', 'do', 'dho'],
  [3, 'तीन', '|', 'teen', 'tin'],
  [4, 'चार', '|', 'char', 'chaar'],
  [5, 'पाँच', 'पांच', '|', 'panch', 'paanch', 'paach', 'paanch'],
  [6, 'छह', 'छः', 'छे', 'छै', '|', 'chhah', 'chah', 'chhe', 'che', 'chheh', 'cheh', 'chha'],
  [7, 'सात', '|', 'saat', 'sat'],
  [8, 'आठ', '|', 'aath', 'aat', 'ath'],
  [9, 'नौ', '|', 'nau', 'nao'],
  [10, 'दस', '|', 'das', 'dus'],
  [11, 'ग्यारह', '|', 'gyarah', 'gyara', 'gyaarah'],
  [12, 'बारह', '|', 'barah', 'bara', 'baarah'],
  [13, 'तेरह', '|', 'terah', 'tera'],
  [14, 'चौदह', '|', 'chaudah', 'chauda', 'chodah'],
  [15, 'पंद्रह', 'पन्द्रह', '|', 'pandrah', 'pandra'],
  [16, 'सोलह', '|', 'solah', 'sola'],
  [17, 'सत्रह', '|', 'satrah', 'satra'],
  [18, 'अठारह', '|', 'atharah', 'athara', 'attharah'],
  [19, 'उन्नीस', '|', 'unnis', 'unees', 'unnees'],
  [20, 'बीस', '|', 'bees', 'bis'],
  [21, 'इक्कीस', '|', 'ikkis', 'ikkees'],
  [22, 'बाईस', '|', 'bais', 'baees', 'baais'],
  [23, 'तेईस', '|', 'teis', 'teees', 'teyis'],
  [24, 'चौबीस', '|', 'chaubis', 'chaubees', 'chobis'],
  [25, 'पच्चीस', '|', 'pachchis', 'pachis', 'pacchis', 'pachees'],
  [26, 'छब्बीस', '|', 'chhabbis', 'chabbis', 'chhabees'],
  [27, 'सत्ताईस', '|', 'sattais', 'sattaees', 'sataees'],
  [28, 'अट्ठाईस', 'अट्ठाइस', '|', 'atthais', 'athais', 'athaees', 'attaees'],
  [29, 'उनतीस', '|', 'untis', 'untees'],
  [30, 'तीस', '|', 'tees', 'tis'],
  [31, 'इकतीस', 'इकत्तीस', '|', 'iktis', 'ikattis', 'iktees'],
  [32, 'बत्तीस', '|', 'battis', 'battees'],
  [33, 'तैंतीस', '|', 'taintis', 'tentis', 'taintees'],
  [34, 'चौंतीस', '|', 'chauntis', 'chontis', 'chauntees'],
  [35, 'पैंतीस', '|', 'paintis', 'pentis', 'paintees'],
  [36, 'छत्तीस', '|', 'chhattis', 'chattis', 'chhattees'],
  [37, 'सैंतीस', '|', 'saintis', 'sentis', 'saintees'],
  [38, 'अड़तीस', '|', 'adtis', 'artis', 'adtees', 'artees'],
  [39, 'उनतालीस', '|', 'untalis', 'untalees'],
  [40, 'चालीस', '|', 'chalis', 'chalees'],
  [41, 'इकतालीस', '|', 'iktalis', 'iktalees'],
  [42, 'बयालीस', '|', 'bayalis', 'bayalees', 'byalis'],
  [43, 'तैंतालीस', '|', 'taintalis', 'tentalis', 'taintalees'],
  [44, 'चवालीस', 'चौवालीस', '|', 'chavalis', 'chawalis', 'chauvalis'],
  [45, 'पैंतालीस', '|', 'paintalis', 'pentalis', 'paintalees'],
  [46, 'छियालीस', '|', 'chhiyalis', 'chiyalis', 'chhiyalees'],
  [47, 'सैंतालीस', '|', 'saintalis', 'sentalis', 'saintalees'],
  [48, 'अड़तालीस', '|', 'adtalis', 'artalis', 'adtalees'],
  [49, 'उनचास', '|', 'unchas', 'unchaas'],
  [50, 'पचास', '|', 'pachas', 'pachaas'],
  [51, 'इक्यावन', '|', 'ikyavan', 'ikyawan', 'ikyaavan'],
  [52, 'बावन', '|', 'bavan', 'bawan', 'baavan'],
  [53, 'तिरपन', '|', 'tirpan', 'tirepan'],
  [54, 'चौवन', '|', 'chauvan', 'chauwan', 'chovan'],
  [55, 'पचपन', '|', 'pachpan'],
  [56, 'छप्पन', '|', 'chhappan', 'chappan'],
  [57, 'सत्तावन', '|', 'sattavan', 'sattawan'],
  [58, 'अट्ठावन', '|', 'atthavan', 'athavan', 'atthawan'],
  [59, 'उनसठ', '|', 'unsath', 'unsaath'],
  [60, 'साठ', '|', 'saath', 'sath'],
  [61, 'इकसठ', '|', 'iksath', 'iksaath'],
  [62, 'बासठ', '|', 'basath', 'baasath'],
  [63, 'तिरसठ', '|', 'tirsath', 'tiresath'],
  [64, 'चौंसठ', '|', 'chaunsath', 'chonsath'],
  [65, 'पैंसठ', '|', 'painsath', 'pensath'],
  [66, 'छियासठ', '|', 'chhiyasath', 'chiyasath'],
  [67, 'सड़सठ', '|', 'sadsath', 'sarsath'],
  [68, 'अड़सठ', '|', 'adsath', 'arsath'],
  [69, 'उनहत्तर', '|', 'unhattar'],
  [70, 'सत्तर', '|', 'sattar'],
  [71, 'इकहत्तर', '|', 'ikhattar', 'ikahattar'],
  [72, 'बहत्तर', '|', 'bahattar'],
  [73, 'तिहत्तर', '|', 'tihattar'],
  [74, 'चौहत्तर', '|', 'chauhattar', 'chohattar'],
  [75, 'पचहत्तर', '|', 'pachhattar', 'pachattar'],
  [76, 'छिहत्तर', '|', 'chhihattar', 'chihattar'],
  [77, 'सतहत्तर', '|', 'sathattar', 'satahattar'],
  [78, 'अठहत्तर', '|', 'athhattar', 'athattar'],
  [79, 'उन्यासी', 'उनासी', '|', 'unyasi', 'unasi'],
  [80, 'अस्सी', '|', 'assi', 'asi'],
  [81, 'इक्यासी', '|', 'ikyasi'],
  [82, 'बयासी', '|', 'bayasi', 'byasi'],
  [83, 'तिरासी', '|', 'tirasi'],
  [84, 'चौरासी', '|', 'chaurasi', 'chorasi'],
  [85, 'पचासी', '|', 'pachasi'],
  [86, 'छियासी', '|', 'chhiyasi', 'chiyasi'],
  [87, 'सत्तासी', '|', 'sattasi'],
  [88, 'अट्ठासी', '|', 'atthasi', 'athasi'],
  [89, 'नवासी', 'नवासि', '|', 'navasi', 'nawasi'],
  [90, 'नब्बे', '|', 'nabbe', 'nabe'],
  [91, 'इक्यानवे', '|', 'ikyanve', 'ikyanave'],
  [92, 'बानवे', '|', 'banve', 'baanve'],
  [93, 'तिरानवे', '|', 'tiranve'],
  [94, 'चौरानवे', '|', 'chauranve', 'choranve'],
  [95, 'पचानवे', '|', 'pachanve'],
  [96, 'छियानवे', '|', 'chhiyanve', 'chiyanve'],
  [97, 'सत्तानवे', '|', 'sattanve'],
  [98, 'अट्ठानवे', '|', 'atthanve', 'athanve'],
  [99, 'निन्यानवे', '|', 'ninyanve', 'ninyanave'],
  [100, 'सौ', '|', 'sau', 'so']
];

/* the canonical Hindi word for each value, used when Munni SPEAKS a number */
const HI_WORD = {};
for (const row of HI_TABLE) HI_WORD[row[0]] = row[1];

/* ---------- folds ---------- */
function foldDev(w) {
  return String(w).normalize('NFC')
    .replace(/़/g, '')                 // nukta
    .replace(/[ँंः]/g, '')   // chandrabindu / anusvara / visarga
    .replace(/ी/g, 'ि')           // ी → ि
    .replace(/ू/g, 'ु')           // ू → ु
    .replace(/ै/g, 'े')           // ै → े
    .replace(/ौ/g, 'ो')           // ौ → ो
    .replace(/ई/g, 'इ').replace(/ऊ/g, 'उ')
    .replace(/[शष]/g, 'स').replace(/ण/g, 'न').replace(/ब/g, 'व');
}
function foldRoman(w) {
  return String(w).toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k')
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a')
    .replace(/(.)\1+/g, '$1');
}

const DEV_INDEX = new Map(), ROMAN_INDEX = new Map();
for (const row of HI_TABLE) {
  const v = row[0];
  let roman = false;
  for (const w of row.slice(1)) {
    if (w === '|') { roman = true; continue; }
    (roman ? ROMAN_INDEX : DEV_INDEX).set(roman ? foldRoman(w) : foldDev(w), v);
  }
}
const DEV_HUNDRED = new Set(['सौ', 'सो'].map(foldDev));
const DEV_THOUSAND = new Set(['हज़ार', 'हजार'].map(foldDev));
const ROMAN_HUNDRED = new Set(['sau'].map(foldRoman));
const ROMAN_THOUSAND = new Set(['hazaar', 'hazar', 'hajar'].map(foldRoman));

/* ---------- English ---------- */
const EN_UNITS = {
  zero: 0, oh: 0, nil: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
};
const EN_TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/* homophones a recognizer produces for short answers ("for" for 4, and
   the Indian-English "tree" for 3). Trusted only in very short replies. */
const EN_HOMOPHONE = { for: 4, to: 2, too: 2, won: 1, ate: 8, tree: 3, free: 3, fore: 4, tu: 2 };

const DEV_DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

function tokens(utterance) {
  return String(utterance || '').normalize('NFC')
    .replace(/[०-९]/g, d => DEV_DIGITS[d])
    .replace(/(\d),(\d)/g, '$1$2')            // 1,000
    .replace(/[-–—]/g, ' ')                   // twenty-three
    .replace(/[.,!?;:"'“”‘’()\[\]।॥…]/g, ' ')
    .split(/\s+/).filter(Boolean);
}

/* classify one token: {kind:'num'|'hundred'|'thousand'|'and'|'word', v} */
function classify(tok, lang, allowHomophones) {
  if (/^\d+$/.test(tok)) return { kind: 'digits', v: Number(tok) };
  const m = tok.match(/^(\d+)(st|nd|rd|th)$/i);
  if (m) return { kind: 'digits', v: Number(m[1]) };

  const lower = tok.toLowerCase();
  if (/[ऀ-ॿ]/.test(tok)) {
    const f = foldDev(tok);
    if (DEV_HUNDRED.has(f)) return { kind: 'hundred' };
    if (DEV_THOUSAND.has(f)) return { kind: 'thousand' };
    if (DEV_INDEX.has(f)) return { kind: 'num', v: DEV_INDEX.get(f) };
    return { kind: 'word' };
  }
  if (lower in EN_UNITS) return { kind: 'num', v: EN_UNITS[lower] };
  if (lower in EN_TENS) return { kind: 'tens', v: EN_TENS[lower] };
  if (lower === 'hundred') return { kind: 'hundred' };
  if (lower === 'thousand') return { kind: 'thousand' };
  if (lower === 'and') return { kind: 'and' };
  if (lower === 'a' || lower === 'an') return { kind: 'article' };

  const r = foldRoman(lower);
  if (ROMAN_HUNDRED.has(r)) return { kind: 'hundred' };
  if (ROMAN_THOUSAND.has(r)) return { kind: 'thousand' };
  // "do" is also an English word ("I do not know"), "so" is too. In an
  // English session only trust them when the whole reply is that one word.
  const enClash = lower === 'do' || lower === 'so' || lower === 'sat';
  if (ROMAN_INDEX.has(r) && !(lang === 'en' && enClash && !allowHomophones)) return { kind: 'num', v: ROMAN_INDEX.get(r) };
  if (allowHomophones && lower in EN_HOMOPHONE) return { kind: 'num', v: EN_HOMOPHONE[lower] };
  return { kind: 'word' };
}

/* Every number spoken in the utterance, in order. */
function numbersIn(utterance, lang) {
  const toks = tokens(utterance);
  const shortReply = toks.length <= 3;
  const out = [];
  let cur = null;          // { v, tensOpen, afterHundred }
  const flush = () => { if (cur) out.push(cur.v); cur = null; };

  for (const t of toks) {
    const c = classify(t, lang, shortReply);
    switch (c.kind) {
      case 'digits':
        flush(); out.push(c.v); break;
      case 'tens':
        if (cur && cur.afterHundred && cur.v % 100 === 0) { cur.v += c.v; cur.tensOpen = true; }
        else { flush(); cur = { v: c.v, tensOpen: true }; }
        break;
      case 'num':
        if (cur && cur.tensOpen && c.v < 10) { cur.v += c.v; cur.tensOpen = false; }
        else if (cur && cur.afterHundred && cur.v % 100 === 0 && c.v < 100) { cur.v += c.v; cur.afterHundred = false; cur.tensOpen = c.v % 10 === 0 && c.v >= 20; }
        else { flush(); cur = { v: c.v }; }
        break;
      case 'hundred':
        if (cur && cur.v < 10 && !cur.afterHundred) { cur.v *= 100; cur.afterHundred = true; cur.tensOpen = false; }
        else if (!cur) cur = { v: 100, afterHundred: true };
        else { flush(); cur = { v: 100, afterHundred: true }; }
        break;
      case 'thousand':
        if (cur && cur.v < 100) { cur.v *= 1000; cur.afterHundred = true; cur.tensOpen = false; }
        else { flush(); cur = { v: 1000, afterHundred: true }; }
        break;
      case 'article':
        // "a hundred" — keep going, the multiplier will start the number
        break;
      case 'and':
        if (!(cur && cur.afterHundred)) flush();
        break;
      default:
        flush();
    }
  }
  flush();
  return out;
}

/* The child's answer: the last number they said, or null if none. */
function parseNumber(utterance, lang) {
  const keys = keypadOf(utterance);
  if (keys !== null) return /^\d{1,4}$/.test(keys) ? Number(keys) : null;   // pressed, not said
  const all = numbersIn(utterance, lang);
  return all.length ? all[all.length - 1] : null;
}

/* ---------- yes / no ---------- */
const YES = ['yes', 'yeah', 'yep', 'yup', 'ya', 'haan', 'han', 'ha', 'haa', 'haanji', 'hanji', 'ji', 'jee', 'sahi', 'right', 'correct', 'हाँ', 'हां', 'हा', 'जी', 'सही'];
const NO = ['no', 'nope', 'nah', 'nahi', 'nahin', 'nai', 'na', 'naa', 'नहीं', 'नही', 'ना', 'न'];
/* ---------- keypad (DTMF) ----------
   Bolna hands pressed keys to the model as "dtmf_number: 12" (collected
   until #). Digits already parse as numbers; these cover the rest. */
const DTMF = /dtmf_number\s*:\s*([0-9*#]*)/i;
function keypadOf(utterance) {
  const m = String(utterance || '').match(DTMF);
  return m ? m[1].replace(/#/g, '') : null;
}

function parseYesNo(utterance) {
  // on the keypad: 1 for yes, 2 for no — what Munni tells them to press
  const keys = keypadOf(utterance);
  if (keys === '1') return true;
  if (keys === '2') return false;
  const toks = tokens(utterance).map(t => t.toLowerCase());
  let ans = null;
  for (const t of toks) {             // last one wins, same as numbers
    if (YES.includes(t)) ans = true;
    else if (NO.includes(t)) ans = false;
  }
  return ans;
}

/* ---------- intents that are not answers ----------
   Checked before grading, so "phir se bolo" replays the question
   instead of being graded as a wrong answer. */
const INTENTS = {
  repeat: [/\b(repeat|again|once more|say (it|that) again|what\??$|pardon|sorry\??$)\b/i,
           /\b(phir\s*se|fir\s*se|dobara|dubara|kya\s*bola|kya\s*kaha|samajh\s*nahi)\b/i,
           dev('फिर से|दोबारा|दुबारा|क्या बोला|क्या कहा|समझ नहीं'), /^\s*क्या\s*[?？]?\s*$/],
  dontKnow: [/\b(don'?t know|dont know|do not know|no idea|not sure|i forgot)\b/i,
             /\b(pata\s*nahi|pata\s*nahin|nahi\s*pata|malum\s*nahi|maloom\s*nahi|nahi\s*aata)\b/i,
             dev('पता नहीं|नहीं पता|मालूम नहीं|नहीं आता|नही पता|पता नही')],
  stop: [/\b(stop|i want to stop|enough|bye|goodbye|i('?m| am) (tired|done)|no more)\b/i,
         /\b(bas|band\s*karo|nahi\s*karna|nahin\s*karna|thak\s*gay[ai]|ruk\s*jao)\b/i,
         dev('बस|बस करो|बंद करो|नहीं करना|थक गया|थक गई|रुक जाओ')]
};
/* JS \b only knows ASCII letters, so Devanagari phrases get explicit
   edges — otherwise "बस" (enough) would fire inside "बस्ता" (school bag). */
function dev(alts) {
  return new RegExp('(^|[\\s,.!?।])(' + alts + ')(?=$|[\\s,.!?।])');
}
function intentOf(utterance) {
  const u = String(utterance || '').trim();
  // nothing said — or the graph's own marker when the child went quiet
  // (agent/build-agent.js, the "hush" node)
  if (!u || /^[\[(]\s*(silence|silent|quiet|no reply|no response)\s*[\])]$/i.test(u)) return 'silence';
  const keys = keypadOf(u);
  if (keys !== null) return keys === '' || keys === '*' ? 'repeat' : 'answer';   // * = hear it again
  // a reply that carries a number is an answer, even if it also says "again"
  for (const name of ['stop', 'repeat', 'dontKnow']) {
    if (INTENTS[name].some(re => re.test(u))) {
      if (name !== 'stop' && numbersIn(u).length) return 'answer';
      return name;
    }
  }
  return 'answer';
}

/* ---------- speaking numbers ---------- */
function numberWord(n, lang) {
  if (lang !== 'hi') return String(n);
  if (n in HI_WORD) return HI_WORD[n];
  if (n > 100 && n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    return `${HI_WORD[h]} सौ` + (r ? ` ${HI_WORD[r]}` : '');
  }
  if (n === 1000) return 'एक हज़ार';
  return String(n);
}

module.exports = { parseNumber, numbersIn, parseYesNo, intentOf, keypadOf, numberWord, HI_TABLE, foldDev, foldRoman };
