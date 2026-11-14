/* ==================================================================
   CLASS SHARING BETWEEN PHONES — core/class-share.js.

   Two separate vm contexts, each with its OWN storage, stand in for two
   phones: a child's and a teacher's. Proves the whole loop works with no
   server — progress code from the child's phone, class diagnosis on the
   teacher's, homework code back — and that a damaged or wrong code can
   never corrupt a record.
   ================================================================== */
const fs = require('fs'), vm = require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

const LOAD_LIST = [
  'src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
  'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
  'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
  'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
  'src/content/comprehension.js','src/content/geometry.js','src/content/clock.js','src/core/diagnose.js','src/core/class-share.js','src/core/mathgen.js'
];
function phone(child){
  const data = {};
  const ctx = { console, Intl, setTimeout, clearTimeout, TextEncoder, TextDecoder, btoa, atob, Uint8Array,
    localStorage: { getItem: k => (k in data ? data[k] : null), setItem: (k,v) => { data[k] = String(v); } },
    S: Object.assign({ lang:'en', age:8, day:0, skillHistory:{}, classCode:null, game:'cricket' }, child) };
  vm.createContext(ctx);
  for(const f of LOAD_LIST) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
  vm.runInContext(`globalThis.__ = { classReportCode, importClassReport, homeworkCode, importHomework, shareDecode,
    assignHomework, readClassShared, tDiagnose, noteSkillAttempt, personalizeContentForHomework, S };`, ctx);
  return ctx.__;
}

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const lc = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html loads before core/diagnose.js", lc.pass, JSON.stringify(lc.missing));

/* ---- the child's phone ---- */
const kid = phone({ id:'c-meera', name:'मीरा', classCode:'ABC123' });
for(const ok of [1,0,0,1,0,0,1,0,0,0]) kid.noteSkillAttempt('tables', !!ok, kid.S);
const code = kid.classReportCode(kid.S);
console.log('progress code:', code.length, 'chars ·', code.slice(0, 40) + '…');
check('a linked child gets a progress code, short enough for a text message', /^TKR1\.[\w-]+\.[0-9a-z]{3}$/.test(code) && code.length < 500, `${code.length} chars`);
check('an unlinked child gets no code (nothing to send it to)', phone({ id:'c-x', name:'X' }).classReportCode() === null, 'expected null');
check('the code survives a Hindi name intact', kid.shareDecode('report', code).n === 'मीरा', JSON.stringify(kid.shareDecode('report', code)));

/* ---- the teacher's phone: a different device, empty storage ---- */
const teacher = phone({ id:'c-teacher', name:'Teacher' });
check("before any code, the teacher's phone knows nothing about this child", Object.keys(teacher.readClassShared('ABC123')).length === 0, 'not empty');
const r = teacher.importClassReport('  ' + code + '\n');   // pasted with stray whitespace
check('pasting the code adds the child to that class on the teacher\'s phone', r.ok && r.code === 'ABC123' && teacher.readClassShared('ABC123')['c-meera'].skillHistory.tables.n === 10, JSON.stringify(r));
const res = teacher.tDiagnose(['bodmas'], [{ id:'c-meera', name:'Meera', skillHistory:{} }], 'ABC123');
check("the teacher's diagnosis now uses this child's real evidence from the other phone (tables is a gap)", res[0].guesswork === false && res[0].plan.some(p => p.skill.id === 'tables' && p.verdict === 'gap'), JSON.stringify(res[0].plan.map(p => p.skill.id + ':' + p.verdict)));

check('a code cut short by a careless copy is rejected', teacher.importClassReport(code.slice(0, -6)).ok === false, 'accepted');
check('an edited code is rejected (checksum)', teacher.importClassReport(code.replace(/\.(.)/, (m, c) => '.' + (c === 'A' ? 'B' : 'A'))).ok === false, 'accepted');
check('plain text is rejected', teacher.importClassReport('hello teacher').ok === false, 'accepted');
check('a homework code pasted in the wrong box is rejected', teacher.importClassReport(teacher.homeworkCode('NOPE00') || 'TKH1.e30.000').ok === false, 'accepted');
for(const ok of [1,1,1,1]) kid.noteSkillAttempt('tables', true, kid.S);
for(const t0 = Date.now(); Date.now() <= t0 + 2;);   // the newer code must carry a later timestamp
const newer = kid.classReportCode(kid.S);
teacher.importClassReport(newer);
check('an older code never overwrites a newer one', teacher.importClassReport(code).ok === false && teacher.readClassShared('ABC123')['c-meera'].skillHistory.tables.n === 14, JSON.stringify(teacher.readClassShared('ABC123')['c-meera'].skillHistory.tables));

/* ---- homework back to the child's phone ---- */
teacher.assignHomework('ABC123', ['tables'], 'Practise your tables');
const hwc = teacher.homeworkCode('ABC123');
check('the teacher gets a homework code for the class', /^TKH1\./.test(hwc), hwc);
const got = kid.importHomework(hwc, kid.S);
check('the child\'s phone accepts it', got.ok === true, JSON.stringify(got));
const plan = kid.personalizeContentForHomework(kid.S);
check("…and diagnoses it against this child's own evidence, like any other homework", plan && plan.assignedSkills[0] === 'tables' && plan.storySkill === 'tables', JSON.stringify(plan && { s: plan.assignedSkills, story: plan.storySkill }));
check('the assignment keeps its original timestamp across phones, so "finished" means the same assignment',
  plan.assignedAt === teacher.readClassShared('ABC123')._homework.assignedAt, `${plan.assignedAt}`);

const other = phone({ id:'c-other', name:'Ravi', classCode:'ZZZ999' });
check("a child linked to another class can't be given this class's homework", other.importHomework(hwc, other.S).why === 'otherclass', 'accepted');
const fresh = phone({ id:'c-new', name:'Asha' });
check('an unlinked child is linked to the class by the homework code', fresh.importHomework(hwc, fresh.S).ok && fresh.S.classCode === 'ABC123', fresh.S.classCode);

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length - failures}/${checks.length} checks passed`);
process.exitCode = failures ? 1 : 0;
