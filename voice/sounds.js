/* ==================================================================
   SOUNDS — does this word sound like that one, whatever the script?

   A Hindi phone recognizer hearing a child say the English word "water"
   may write वॉटर; an English one writes "water". A child calling in says
   their name; the recognizer writes रिया, the parent registered "Riya".
   Spelling cannot compare those. Sound can, roughly.

   Each word is reduced to a consonant skeleton in one shared alphabet:
   vowels dropped (scripts and accents disagree most about vowels),
   aspiration folded (kh→k, th→t), the English spellings that are not
   sounds removed (silent k, gh, the w in "cow"), and the sounds Hindi
   transliteration blurs folded together (d/t, s/z/sh, v/w). Then two
   skeletons are compared with a small edit allowance.

     water → vtr      वॉटर → vtr
     father → ftr     फ़ादर → ftr
     orange → rnj     ऑरेंज → rnj
     Riya  → r        रिया → r

   This is deliberately lenient — it is for a child practising, where a
   near miss should count — and deliberately rough: it is not a phonetic
   model, and words chosen for the English bank avoid the cases it gets
   wrong (all-vowel words like "eye", silent-letter traps like "knife").
   ================================================================== */
'use strict';

/* ---------- English spelling → skeleton ---------- */
function enSkeleton(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  w = w.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/mb$/, 'm')
       .replace(/gh(t|$)/g, '$1')                        // night, high
       .replace(/sch/g, 'sk').replace(/chr/g, 'kr')
       .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/x/g, 'ks')
       .replace(/sh/g, 's').replace(/th/g, 't').replace(/ch/g, 'C')
       .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
       .replace(/g(?=[eiy])/g, 'j').replace(/dg/g, 'j')
       .replace(/z/g, 's').replace(/d/g, 't');
  w = w.replace(/([^aeiouy])le$/, '$1el');                  // apple, little: a syllable, not a silent e
  if (w.length > 2) w = w.replace(/([^aeiouy])e$/, '$1');   // silent final e: house, rice, come
  let out = w[0] === 'w' ? 'v' : w[0];
  for (let i = 1; i < w.length; i++) {
    const c = w[i];
    if ('aeiouy'.includes(c)) out += 'V';                    // y after the start is a vowel: happy, my
    else if ('wvh'.includes(c)) continue;                    // soft letters only count at the start
    else out += c;
  }
  if ('aeiouy'.includes(out[0]) && out[0] !== 'y') out = 'V' + out.slice(1);
  return finish(out.replace(/C/g, 'c'));
}

/* ---------- Devanagari → skeleton ---------- */
const DEV = {
  'क': 'k', 'ख': 'k', 'ग': 'g', 'घ': 'g', 'ङ': 'n',
  'च': 'c', 'छ': 'c', 'ज': 'j', 'झ': 'j', 'ञ': 'n',
  'ट': 't', 'ठ': 't', 'ड': 't', 'ढ': 't', 'ण': 'n',
  'त': 't', 'थ': 't', 'द': 't', 'ध': 't', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'b', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 's', 'ष': 's', 'स': 's', 'ह': 'h',
  'ळ': 'l', 'ऋ': 'r'
};
const NUKTA_MAP = { 'क़': 'k', 'ख़': 'k', 'ग़': 'g', 'ज़': 's', 'फ़': 'f', 'ड़': 'r', 'ढ़': 'r', 'य़': 'y' };
const DEV_VOWEL_LETTER = /[ऄ-औॠॡॲ-ॷ]/;   // अ आ इ … औ
const DEV_MATRA = /[ा-ौॢॣ]/;                        // ा ि ी … ौ
function devSkeleton(word) {
  const chars = [...String(word || '').normalize('NFD')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i], cons = null;
    if (chars[i + 1] === '़') { cons = NUKTA_MAP[(ch + '़').normalize('NFC')]; i++; }
    else cons = DEV[ch] || NUKTA_MAP[ch];
    if (cons) {
      // soft letters (व य ह) only count at the start, as in English
      out += (out.length && 'vyh'.includes(cons)) ? '' : cons;
      const nxt = chars[i + 1];
      // a consonant with no matra and no halant carries the inherent vowel —
      // pronounced in the middle of a word (मदर = ma-dar), dropped at the end
      if (nxt !== '्' && !(nxt && DEV_MATRA.test(nxt)) && i + 1 < chars.length && !/[\s]/.test(nxt)) out += 'V';
      continue;
    }
    if (DEV_VOWEL_LETTER.test(ch) || DEV_MATRA.test(ch)) { out += 'V'; continue; }
    if (ch === 'ं') {                                         // anusvara before a consonant: n
      const nxt = chars[i + 1];
      if (nxt && (DEV[nxt] || NUKTA_MAP[nxt])) out += 'n';
    }
    // halant, chandrabindu, visarga: nothing
  }
  return finish(out);
}

/* Both scripts end the same way: runs of vowels are one vowel slot,
   doubled consonants one consonant, and a FINAL vowel is dropped — it is
   the least reliable sound in transliteration (the schwa Hindi deletes,
   the y of "happy"), so "the" and द, "tree" and ट्री agree. */
function finish(s) {
  return s.replace(/V+/g, 'V').replace(/([^V])\1+/g, '$1').replace(/V$/, '');
}

function skeleton(word) {
  return /[ऀ-ॿ]/.test(word) ? devSkeleton(word) : enSkeleton(word);
}

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/* Do two single words sound alike? A long skeleton may be one sound off. */
function soundsLike(a, b) {
  const x = skeleton(a), y = skeleton(b);
  // two all-vowel words ("I" / आई, "a" / ए): nothing left to compare but
  // that they are both vowel sounds, which for "I am fine" is what matters
  if (!x && !y) return true;
  if (!x || !y) return false;
  return lev(x, y) <= (Math.max(x.length, y.length) >= 6 ? 1 : 0);
}

const words = s => String(s || '').normalize('NFC').replace(/[.,!?;:"'“”‘’()\[\]।॥…-]/g, ' ').split(/\s+/).filter(Boolean);

/* Score a spoken phrase against a target, 0–100, in either script:
   the share of target words heard in order, a small penalty for extras —
   the same shape as the reading matcher's score. */
function phraseScore(target, said) {
  const T = words(target), H = words(said);
  const m = T.length, n = H.length;
  if (!m) return 0;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], soundsLike(T[i - 1], H[j - 1]) ? dp[i - 1][j - 1] + 1 : -1);
  const hit = dp[m][n];
  const extra = Math.max(0, n - hit);
  const missed = [];
  // which target words were not heard (for "say this word again")
  let i = m, j = n;
  const got = new Array(m).fill(false);
  while (i > 0 && j > 0) {
    if (soundsLike(T[i - 1], H[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) { got[i - 1] = true; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  T.forEach((w, k) => { if (!got[k]) missed.push(w); });
  const score = Math.max(0, Math.round(hit / m * 100 - Math.min(12, extra * 4)));
  return { score, missed };
}

/* Is any of `answers` (one or two words each) inside what the child said? */
function saidAny(answers, said) {
  const H = words(said);
  for (const ans of answers) {
    const A = words(ans);
    for (let j = 0; j + A.length <= H.length; j++)
      if (A.every((w, k) => soundsLike(w, H[j + k]))) return ans;
  }
  return null;
}

module.exports = { skeleton, enSkeleton, devSkeleton, soundsLike, phraseScore, saidAny };
