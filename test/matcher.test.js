#!/usr/bin/env node
/* ==================================================================
   MATCHER TEST TABLE — run with: node test/matcher.test.js

   Table-driven: [lang, target, transcript, expected score band].
   Loads src/core/matcher.js as-is (a plain script, not a module — see
   CLAUDE.md on why) via vm, so this exercises the real matcher, not a
   reimplementation of it.

   Score bands are deliberately ranges, not exact numbers: the matcher
   is allowed to change its rounding or weighting slightly without
   breaking this suite, but a band violation means a real regression
   in what gets marked correct, near, or wrong.
   ================================================================== */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const matcherPath = path.join(__dirname, '..', 'src', 'core', 'matcher.js');
const sandbox = { Intl, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(matcherPath, 'utf8'), sandbox, { filename: matcherPath });
const { gradeReading, gradeBest, gradeVerdict } = sandbox;
// GRADE is declared `const` inside the vm script, so — unlike the function
// declarations above — it never attaches to the sandbox object; pull it out
// with one more runInContext call in the same (still-live) lexical scope.
const GRADE = vm.runInContext('GRADE', sandbox);

/* Load the age-gating stack into the SAME sandbox, in the same dependency
   order index.html uses, so ageSentences()/clampLevel() are the real
   functions running against the real shipped content — not a reimplementation. */
const root = path.join(__dirname, '..', 'src');
for (const rel of ['state.js', 'content/sentences.js', 'content/facts.js', 'core/readability.js', 'content/ages.js']) {
  const p = path.join(root, rel);
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p });
}
const { readability, band, clampLevel, ageSentences, rdOrder } = sandbox;
// S is `const`, so — like GRADE — it needs pulling out explicitly. But it's
// an object: once we hold this same reference, mutating S.age from out here
// is visible to band()/ageSentences() in there, since they close over the
// identical object. No need to reach back into the sandbox after this.
const S = vm.runInContext('S', sandbox);

/* [lang, target, transcript, [minScore, maxScore], note] */
const TESTS = [
  // ---- CLAUDE.md "must keep passing" table (real recognizer output, 90+) ----
  ['hi', 'हम रोज़ सुबह पढ़ते हैं।', 'हम रोज सुबह पढ़ते हैं', [88, 100], 'CLAUDE.md: nukta drift रोज़→रोज'],
  ['hi', 'यह बड़ा घर है।', 'यह बडा घर है', [88, 100], 'CLAUDE.md: nukta drift बड़ा→बडा'],
  ['hi', 'पेड़ ऊँचे हैं।', 'पेड़ ऊंचे हैं', [85, 100], 'CLAUDE.md: chandrabindu→anusvara ऊँचे→ऊंचे'],
  ['hi', 'मेरी बहन आई।', 'मेरि बहन आई', [85, 100], 'CLAUDE.md: matra length मेरी→मेरि'],

  // ---- CLAUDE.md "must fail" table ----
  ['hi', 'बिल्ली बैठी है।', 'बिल्ली है', [50, 78], 'CLAUDE.md: genuinely skipped word (~65)'],
  ['hi', 'मैं पक्षी देखता हूँ।', 'मैं आम खाता कहाँ', [10, 40], 'CLAUDE.md: genuinely misread line (~25)'],

  // ---- extra Hindi cases: nukta drift ----
  ['hi', 'यह ख़ास किताब है।', 'यह खास किताब है', [85, 100], 'nukta drift: ख़ास→खास'],
  ['hi', 'बाज़ार बंद है।', 'बाजार बंद है', [85, 100], 'nukta drift: बाज़ार→बाजार'],

  // ---- extra Hindi cases: matra length (long/short vowels) ----
  ['hi', 'पानी ठंडा है।', 'पानि ठंडा है', [85, 100], 'matra length: पानी→पानि'],
  ['hi', 'बच्चे गिनती सीखते हैं।', 'बच्चे गिनति सीखते हैं', [88, 100], 'matra length: गिनती→गिनति'],

  // ---- extra Hindi cases: anusvara vs chandrabindu ----
  ['hi', 'वह गाँव गया।', 'वह गांव गया', [85, 100], 'anusvara vs chandrabindu: गाँव→गांव'],
  ['hi', 'यह गहरा कुआँ है।', 'यह गहरा कुआं है', [85, 100], 'anusvara vs chandrabindu: कुआँ→कुआं'],
  ['hi', 'राम वहाँ गया।', 'राम वहां गया', [85, 100], 'anusvara vs chandrabindu: वहाँ→वहां'],

  // ---- extra Hindi cases: other folds CLAUDE.md names but the base table doesn't cover ----
  ['hi', 'बच्चे गणना करते हैं।', 'बच्चे गनना करते हैं', [85, 100], 'retroflex/dental fold: ण→न (गणना→गनना)'],
  ['hi', 'यह विशेष दिन है।', 'यह विसेस दिन है', [85, 100], 'sibilant collapse: श/ष→स (विशेष→विसेस)'],
  ['hi', 'वह बाहर गया।', 'वह वाहर गया', [85, 100], 'b/v confusion: ब↔व (बाहर→वाहर)'],

  // ---- extra Hindi cases: skipped word ----
  ['hi', 'सूरज गरम है।', 'सूरज है', [40, 70], 'skipped word in a short line'],
  ['hi', 'बड़ा कुत्ता तेज़ दौड़ता है।', 'बड़ा कुत्ता दौड़ता है', [70, 90], 'skipped word in a longer line, smaller penalty'],

  // ---- extra Hindi cases: extra (inserted) words ----
  ['hi', 'सूरज गरम है।', 'अरे सूरज गरम है', [85, 100], 'one filler word inserted before the line'],
  ['hi', 'बिल्ली बैठी है।', 'अरे देखो बिल्ली बैठी है यहाँ', [70, 95], 'several inserted words, penalty caps out'],

  // ---- extra Hindi cases: a second genuinely misread line ----
  ['hi', 'आम मीठा है।', 'सेब खट्टा था', [0, 30], 'misread line: unrelated words throughout'],

  // ---- sanity control: exact read, no drift at all ----
  ['hi', 'बचपन में हम खेलते थे।', 'बचपन में हम खेलते थे', [98, 100], 'sanity: verbatim read scores ~100'],

  // ---- English coverage: matcher grades both languages ----
  ['en', 'The big dog runs fast.', 'the big dog runs fast', [95, 100], 'English: exact read, case/punctuation stripped'],
  ['en', 'The big dog runs fast.', 'the big dog running fast', [70, 95], 'English: fold absorbs a running/runs style slip'],
];

/* [lang, target, alternatives, expectedVerdict, note]
   Exercises gradeBest()+gradeVerdict() directly — the score-band table
   above only calls gradeReading() and can't see the confidence-gate or
   "shaky pick" behavior, which is where these tests live. */
const VERDICT_TESTS = [
  ['hi', 'सूरज गरम है।',
    [{transcript:'कुछ पता नहीं', confidence:0.15}],
    'unsure', 'gate: low confidence AND low score → unsure, nothing recorded'],
  ['hi', 'सूरज गरम है।',
    [{transcript:'सूरज गरम है', confidence:0.85}],
    'pass', 'high confidence, exact match → pass'],
  ['hi', 'सूरज गरम है।',
    [{transcript:'सूरज गरम है', confidence:0.10}],
    'pass', 'a low-confidence guess that is the ONLY (and so the top) alternative is not shaky — nothing better was on offer'],
  ['hi', 'सूरज गरम है।',
    [ {transcript:'सूरज गरम रहा', confidence:0.18}, {transcript:'हाथी नदी पहाड़', confidence:0.82} ],
    'unsure',
    'THE ASYMMETRY FIX: best-scoring alt (67%) is a weak, low-confidence guess while a far more confident alternative (82%) was on offer — shaky, and the score is not high enough to trust anyway'],
  ['hi', 'सूरज गरम है।',
    [ {transcript:'सूरज गरम है', confidence:0.18}, {transcript:'हाथी नदी पहाड़', confidence:0.82} ],
    'pass',
    'shaky (same low-confidence-vs-a-more-confident-alt shape) but the match is near-perfect (100%) — trusted anyway, per "shaky && score<90"'],
];

function pad(s, n){ s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

let failures = 0;
console.log(pad('#', 3) + pad('lang', 5) + pad('score', 7) + pad('band', 10) + pad('result', 7) + 'note');
console.log('-'.repeat(90));

TESTS.forEach((row, i) => {
  const [lang, target, transcript, [lo, hi], note] = row;
  const { score } = gradeReading(target, transcript, lang);
  const pass = score >= lo && score <= hi;
  if (!pass) failures++;
  console.log(
    pad(i + 1, 3) + pad(lang, 5) + pad(score + '%', 7) + pad(`[${lo}-${hi}]`, 10) +
    pad(pass ? 'PASS' : 'FAIL', 7) + note
  );
  if (!pass) {
    console.log('    target:     ' + target);
    console.log('    transcript: ' + transcript);
  }
});

console.log('-'.repeat(90));
console.log(`${TESTS.length - failures}/${TESTS.length} score-band tests passed`);

console.log(`\nVERDICT TESTS (gradeBest + gradeVerdict, GRADE=${JSON.stringify(GRADE)})`);
console.log(pad('#', 3) + pad('lang', 5) + pad('score', 7) + pad('conf', 6) + pad('shaky', 7) + pad('verdict', 9) + pad('want', 9) + pad('result', 7) + 'note');
console.log('-'.repeat(110));

let vFailures = 0;
VERDICT_TESTS.forEach((row, i) => {
  const [lang, target, alts, want, note] = row;
  const r = gradeBest(target, alts, lang);
  const verdict = gradeVerdict(r);
  const pass = verdict === want;
  if (!pass) vFailures++;
  console.log(
    pad(i + 1, 3) + pad(lang, 5) + pad(r.score + '%', 7) + pad(r.confidence.toFixed(2), 6) +
    pad(r.shaky ? 'yes' : 'no', 7) + pad(verdict, 9) + pad(want, 9) + pad(pass ? 'PASS' : 'FAIL', 7) + note
  );
});

console.log('-'.repeat(110));
console.log(`${VERDICT_TESTS.length - vFailures}/${VERDICT_TESTS.length} verdict tests passed`);

failures += vFailures;

/* ==================================================================
   AGE GATING — for every age 3..10:
   1. ageSentences(lang, level) never hands back a line harder than the
      child's own band, for either language, at any of the six levels.
   2. clampLevel(mod, raw) never escapes that age's [lo,hi] window, for
      any module, from any raw level an adaptive nudge could propose.
   ================================================================== */
console.log(`\nAGE TESTS (ageSentences band ceiling + clampLevel window, ages 3-10)`);
let ageFailures = 0, ageTotal = 0;
const ageIssues = [];

for (let age = 3; age <= 10; age++) {
  S.age = age;
  const b = band();
  const wantOrder = rdOrder(b.read);

  for (const lang of ['en', 'hi']) {
    for (let level = 1; level <= 6; level++) {
      const lines = ageSentences(lang, level);
      for (const line of lines) {
        ageTotal++;
        const gotBand = readability(line, lang).band;
        if (rdOrder(gotBand) > wantOrder) {
          ageFailures++;
          ageIssues.push(`  FAIL age=${age} band=${b.id} lang=${lang} level=${level}: "${line}" is band "${gotBand}", harder than "${b.read}"`);
        }
      }
    }
  }

  for (const mod of ['read', 'write', 'math']) {
    const [lo, hi] = b.levels[mod];
    for (let raw = 0; raw <= 8; raw++) {
      ageTotal++;
      const clamped = clampLevel(mod, raw);
      if (clamped < lo || clamped > hi) {
        ageFailures++;
        ageIssues.push(`  FAIL age=${age} clampLevel('${mod}', ${raw}) = ${clamped}, outside window [${lo},${hi}]`);
      }
    }
  }
}

ageIssues.forEach(l => console.log(l));
console.log(`${ageTotal - ageFailures}/${ageTotal} age-gating checks passed`
  + ` (per age: ageSentences over 2 langs × 6 levels, every returned line checked; clampLevel over 3 modules × 9 raw levels)`);

failures += ageFailures;
console.log(`\n${TESTS.length + VERDICT_TESTS.length + ageTotal - failures}/${TESTS.length + VERDICT_TESTS.length + ageTotal} total`);

process.exitCode = failures ? 1 : 0;
