/* ==================================================================
   AGE-BAND PASS THRESHOLDS (DDA) — getGradeThresholds()/gradeVerdict()
   in core/matcher.js, reading AGE_BANDS' passScore/gateScore from
   content/ages.js.

   Deliberately loads ONLY those two files: nothing here touches the
   skill/content graph, so there is no content load list to drift (see
   test/_helpers/load-order.js for the suites where there is). The real
   call sites — the reading screen's checkRead() and the read-back card —
   are exercised end to end by test/self-listen.test.js.
   ================================================================== */
const fs = require('fs'), vm = require('vm');

const ctx = { console, Intl, S: { lang: 'en', age: 5, name: 'Rohan' } };
vm.createContext(ctx);
for(const f of ['src/content/ages.js', 'src/core/matcher.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
vm.runInContext(`globalThis.__dda = { gradeVerdict, getGradeThresholds, AGE_BANDS, GRADE, S };`, ctx);
const DDA = ctx.__dda;

let failures = 0;
function check(name, pass, detail){
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ' → ' + detail}`);
  if(!pass) failures++;
}

console.log('=== AGE-BAND PASS THRESHOLDS (DDA) ===');

DDA.S.age = 5;
check('Early band (age 5) pass threshold is 68%', DDA.getGradeThresholds(DDA.S).pass === 68, `got ${DDA.getGradeThresholds(DDA.S).pass}`);
check('68% passes for a 5-year-old', DDA.gradeVerdict({ score: 68, confidence: 0.9, shaky: false }, DDA.S) === 'pass', 'not pass');

DDA.S.age = 9;
check('Fluent band (age 9) pass threshold is 82%', DDA.getGradeThresholds(DDA.S).pass === 82, `got ${DDA.getGradeThresholds(DDA.S).pass}`);
check('68% does NOT pass for a 9-year-old (coach)', DDA.gradeVerdict({ score: 68, confidence: 0.9, shaky: false }, DDA.S) === 'coach', 'not coach');
check('82% passes for a 9-year-old', DDA.gradeVerdict({ score: 82, confidence: 0.9, shaky: false }, DDA.S) === 'pass', 'not pass');

check('every age band declares its own pass and gate score, so no band silently falls back to the flat default',
  Object.values(DDA.AGE_BANDS).every(b => typeof b.passScore === 'number' && typeof b.gateScore === 'number'),
  JSON.stringify(Object.values(DDA.AGE_BANDS).map(b => [b.id, b.passScore, b.gateScore])));
check('pass thresholds rise with age — older children are held to a higher bar',
  Object.values(DDA.AGE_BANDS).map(b => b.passScore).every((p, i, a) => i === 0 || p >= a[i-1]),
  JSON.stringify(Object.values(DDA.AGE_BANDS).map(b => b.passScore)));

// "Never mark a child wrong for the recognizer's doubt": low confidence
// plus a low score is 'unsure' (ask again, record nothing), not 'coach'.
check("low recognizer confidence with a low score is 'unsure', never a wrong answer",
  DDA.gradeVerdict({ score: 40, confidence: 0.2, shaky: false }, DDA.S) === 'unsure', 'not unsure');
check("a shaky match below 90 is 'unsure' too",
  DDA.gradeVerdict({ score: 85, confidence: 0.9, shaky: true }, DDA.S) === 'unsure', 'not unsure');

console.log(`\nResults: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'}`);
process.exitCode = failures ? 1 : 0;
