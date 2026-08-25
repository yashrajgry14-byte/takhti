#!/usr/bin/env node
/* ==================================================================
   LESSON DATA TESTS — run with: node test/lessons.test.js

   Loads content/lessons.js, content/ages.js and ui/lesson-player.js
   via vm, exactly as-shipped — this checks the real LESSONS array and
   the real lesValues() the player narrates from, not a reimplementation.

   Two passes:
   1. STRUCTURE — every lesson has bilingual title/sub, every beat with
      a `say` has both languages, every `ask` has a bilingual q, opts
      and hiOpts are the same length, `correct` is a valid index, and
      `band` names a real AGE_BANDS key.
   2. ARITHMETIC — walk each lesson's beats tracking a running total
      the same way lesValues() computes it, and check every numeric,
      non-derived `ask` answer against that total. `derived:true` asks
      (bundles, tens, hands) are skipped — they are correct about
      something other than the running total, on purpose.
   ================================================================== */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const sandbox = {};
vm.createContext(sandbox);
// None of these three files touch S/L/speak/render/DOM at load time —
// only inside function bodies, which we never call except lesValues().
for (const rel of ['content/ages.js', 'content/lessons.js', 'ui/lesson-player.js']) {
  const p = path.join(root, rel);
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p });
}
const { lesValues } = sandbox;
// LESSONS and AGE_BANDS are `const`, so — unlike the function declarations
// above — they don't attach to the sandbox object; pull them out explicitly.
const LESSONS = vm.runInContext('LESSONS', sandbox);
const AGE_BANDS = vm.runInContext('AGE_BANDS', sandbox);

let failures = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };

/* ==================== 1. STRUCTURE ==================== */
console.log(`STRUCTURE — ${LESSONS.length} lessons`);
for (const l of LESSONS) {
  const tag = `[${l.id}]`;

  if (!l.title || !l.title.en || !l.title.hi) fail(`${tag} title missing en and/or hi`);
  if (!l.sub   || !l.sub.en   || !l.sub.hi)   fail(`${tag} sub missing en and/or hi`);
  if (!AGE_BANDS[l.band]) fail(`${tag} band "${l.band}" is not a real AGE_BANDS key`);

  l.beats.forEach((b, i) => {
    const btag = `${tag} beat[${i}] (${b.t})`;
    if (b.say && (!b.say.en || !b.say.hi)) fail(`${btag} say missing en and/or hi`);
    if (b.t === 'ask') {
      if (!b.q || !b.q.en || !b.q.hi) fail(`${btag} ask.q missing en and/or hi`);
      if (!Array.isArray(b.opts) || !Array.isArray(b.hiOpts)) {
        fail(`${btag} opts and/or hiOpts missing`);
      } else if (b.opts.length !== b.hiOpts.length) {
        fail(`${btag} opts.length (${b.opts.length}) !== hiOpts.length (${b.hiOpts.length})`);
      }
      const n = (b.opts || []).length;
      if (!(Number.isInteger(b.correct) && b.correct >= 0 && b.correct < n)) {
        fail(`${btag} correct=${b.correct} out of range for ${n} opts`);
      }
    }
  });
}
const structFailures = failures;
console.log(structFailures ? `${structFailures} structural issue(s)` : 'all lessons structurally sound');

/* ==================== 2. ARITHMETIC ==================== */
console.log('\nARITHMETIC — running total from the beats vs. every numeric, non-derived ask');
const ANS_BEATS = ['count', 'add', 'take', 'line', 'array', 'share', 'bar'];
let numericChecks = 0, numericFailures = 0;

for (const l of LESSONS) {
  let total = null;
  for (const b of l.beats) {
    if (b.t === 'group') {
      total = b.a;                                  // the number being bundled, not tens/ones
    } else if (ANS_BEATS.includes(b.t)) {
      total = lesValues(b).ans;                      // same formula the player narrates from
    } else if (b.t === 'ask') {
      if (b.derived) continue;                        // about bundles/tens/hands, not the total
      const answer = Number((b.opts || [])[b.correct]);
      if (!Number.isFinite(answer)) continue;          // not a numeric answer (e.g. "one half")
      numericChecks++;
      if (total == null || answer !== total) {
        numericFailures++;
        fail(`[${l.id}] ask "${(b.q && b.q.en) || ''}" expects ${answer}, running total was ${total}`);
      }
    }
  }
}
console.log(numericFailures
  ? `${numericChecks - numericFailures}/${numericChecks} numeric checkpoints passed`
  : `${numericChecks}/${numericChecks} numeric checkpoints passed`);

failures += numericFailures;

console.log(`\n${LESSONS.length} lessons · ${structFailures} structural issue(s) · ${numericChecks} numeric checkpoints found`);
if (numericChecks !== 16) {
  console.log(`NOTE: counted ${numericChecks} numeric checkpoints here, not the 16 you verified — reporting the discrepancy, not editing lesson data.`);
} else {
  console.log('Matches the 16 numeric checkpoints verified by hand.');
}

process.exitCode = failures ? 1 : 0;
