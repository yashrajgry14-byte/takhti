const fs=require('fs'), vm=require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

/* Node has no `localStorage` — this is the same tiny in-memory stand-in the
   real browser one behaves as for our purposes (string keys, JSON blobs),
   so mirrorToClassNow()/readClassShared() run as the genuine code, not a
   reimplementation of it. setTimeout/clearTimeout are Node's real ones, so
   the debounce inside mirrorToClass() is the genuine debounce too — the
   test just calls flushClassMirror() rather than waiting out 800ms of
   real wall-clock time. */
function makeLocalStorage(){
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k,v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}

const ctx={console, Intl, setTimeout, clearTimeout, localStorage: makeLocalStorage(),
  S:{lang:'en', age:8, name:'x', day:0}};
vm.createContext(ctx);
// Same order index.html actually loads them in: skills.js, then
// curriculum-early.js (pushes Nursery-Class 5 skills into SKILLS), then
// lesson-gen.js, then literacy.js (pushes concepts into CONCEPTS/GEN_BEATS
// and teaches skills by populating their .concepts), then comprehension.js
// (the last 7 gaps below Class 4 — same mechanism). Loading anything less
// than the real graph here would mean this file quietly stops testing what
// the app actually ships the moment new content merges in — which is
// exactly what happened before: this list omitted comprehension.js for a
// while, and every number below was computed against a graph the app no
// longer shipped, with 0 test failures the entire time. See the self-check
// right below, added specifically so that can't happen silently again.
const LOAD_LIST = ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
                'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
                'src/content/comprehension.js','src/content/geometry.js','src/content/clock.js','src/content/calendar.js','src/content/upper.js',
                'src/core/diagnose.js'];
for(const f of LOAD_LIST)
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
vm.runInContext(`globalThis.__d={SKILLS,skillCoverage,prereqChain,diagnose,planSummary,classPattern,skillById,
  noteSkillAttempt,tDiagnose,flushClassMirror,readClassShared,classMirrorKey,lessonsForSkill};`,ctx);
const D=ctx.__d;

let failures=0;
const checks=[];
function check(name, pass, detail){
  checks.push({name, pass, detail});
  if(!pass) failures++;
}

// SELF-CHECK, run before anything else counts on LOAD_LIST being complete —
// see test/_helpers/load-order.js. A content file that ships in the real
// app but is missing here is exactly the failure mode this suite lived
// with unnoticed — every number this file asserts is only as real as this
// list, so the list itself is now under test, not just trusted.
const loadCheck = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html actually loads before core/diagnose.js",
  loadCheck.pass,
  `index.html loads ${JSON.stringify(loadCheck.realContentBefore)} before diagnose.js; LOAD_LIST is missing ${JSON.stringify(loadCheck.missing)}`);

console.log('=== graph ===');
const cov=D.skillCoverage();
console.log(`skills: ${cov.total} · teachable today: ${cov.taught} (${cov.pct}%)`);
console.log(`content gaps: ${cov.gaps.length} — ${cov.gaps.slice(0,8).join(', ')}...`);
console.log(`absorbed (read*/write* duplicates removed from the count): ${cov.absorbed.length} — ${cov.absorbed.join(', ')}`);
// The graph has grown three times since the 48-skill maths-only original:
//   +12  read1-6/write1-6 (an earlier session's generic bilingual ladder)
//   +66  curriculum-early.js's Nursery-Class 5 skills (num/eng/hin/evs)
// = 126 raw nodes. content/literacy.js's own 15 concepts then populate SOME
// of those (its own new eng/hin nodes, plus — as a side effect of its
// 'shapes'/'clockhour' concepts — two PRE-EXISTING maths skills,
// shapes2d and time2, which is why the gap count moved by more than
// curriculum-early.js added on its own).
//
// read2/read3/write2 were then ALSO given the specific beat concepts that
// teach the same competency (e.g. read2 gains 'blending', 'letters', ...),
// so a diagnosed gap there surfaces both the live practice screen and the
// concrete letter-sound lessons — see lessonsForSkill() below. That means
// some competencies are now taught by TWO skill nodes at once (read2 AND
// e.g. e1-decode/u-blend, both via 'blending'). skillCoverage() dedupes
// those — any non-read/write skill sharing a concept with a read*/write*
// skill is "absorbed": dropped from both total and taught, never counted
// twice. 126 raw − 23 absorbed = 103.
//
// content/comprehension.js then closes 7 MORE of the still-open gaps —
// e2-compre, e2-noun, e3-compre, e3-verb, e3-para, h3-compre, h3-vyakaran —
// by populating their .concepts the same way literacy.js does (no new
// skill nodes, no change to the 103/126/23 totals above, just fewer of
// the 103 left un-taught): taught moves 48→55, so pct moves 47%→53% and
// gaps moves 55→48. All re-verified against the real merged graph (this
// file loads curriculum-early.js, literacy.js AND comprehension.js, same
// order as index.html — see the self-check above).
// (14 Nov 2026: content/clock.js adds the Class 3 skill time3 — time to five minutes,
// and how long — and content/calendar.js calendar3 — months and the calendar —
// and teaches both: 105 skills, 59 taught)
// (20 Nov 2026: content/upper.js adds 9 Class 8–10 skills and lessons for 24 of the
// Class 5–10 skills, through its 27 kinds: 114 skills, 83 taught, 31 gaps)
check('114 skills counted after dedup (137 raw − 23 read/write-absorbed duplicates; time3 with clock.js, calendar3 with calendar.js, 9 Class 8–10 skills with upper.js)', cov.total===114, `got ${cov.total}`);
check('73% teachable today (83/114) — comprehension.js closed 7 gaps on top of the 47% (48/103), geometry.js 2 more (perimeter, angles), clock.js the new time3, calendar.js the new calendar3, upper.js 24 Class 5–10 skills',
  cov.pct===73 && cov.taught===83, `got ${cov.pct}% (${cov.taught})`);
check("geometry.js's shape lessons closed perimeter and angles", !cov.gaps.includes('4·perimeter') && !cov.gaps.includes('4·angles'), JSON.stringify(cov.gaps.filter(g => /perimeter|angles/.test(g))));
check("two PRE-EXISTING maths gaps stay closed: shapes2d (literacy.js) and time2 (the o'clock lessons, now in clock.js)",
  !cov.gaps.includes('1·shapes2d') && !cov.gaps.includes('2·time2'),
  JSON.stringify(cov.gaps.filter(g=>/shapes2d|time2/.test(g))));
check("comprehension.js's own 7 concepts closed their matching gaps (e2-compre, e2-noun, e3-compre, e3-verb, e3-para, h3-compre, h3-vyakaran) — this is the exact drift the stale version of this file missed",
  ['2·e2-compre','2·e2-noun','3·e3-compre','3·e3-verb','3·e3-para','3·h3-compre','3·h3-vyakaran'].every(g => !cov.gaps.includes(g)),
  JSON.stringify(cov.gaps.filter(g=>/compre|e2-noun|e3-verb|e3-para|vyakaran/.test(g))));
check('31 content gaps remain — dedup never changes gaps, since an absorbed skill is by definition already taught',
  cov.gaps.length===31, `got ${cov.gaps.length}: ${JSON.stringify(cov.gaps)}`);
check('e1-decode and u-blend (curriculum-early.js\'s own decoding/blending skills) are absorbed into read2, not double-counted',
  cov.absorbed.includes('e1-decode') && cov.absorbed.includes('u-blend'),
  JSON.stringify(cov.absorbed));

// sub-task: literacy.js appends to SKILLS[].concepts — confirm that never
// produces a literal duplicate string within one skill's own array (a skill
// that already had a concept and gains it again via a second merge path
// should end up with ONE entry, not two of the same string).
const dupedSkills = D.SKILLS.filter(s => new Set(s.concepts).size !== s.concepts.length);
check("no skill in the graph has a duplicate concept string in its own .concepts array (literacy.js's merge didn't double-tag)",
  dupedSkills.length===0,
  JSON.stringify(dupedSkills.map(s=>({id:s.id, concepts:s.concepts}))));

// cycle safety
let deepest='', dl=0;
for(const s of D.SKILLS){ const c=D.prereqChain(s.id); if(c.length>dl){dl=c.length;deepest=s.id;} }
console.log(`deepest chain: ${deepest} stands on ${dl} skills → ${D.prereqChain(deepest).join(' → ')}`);
check('every skill resolves a finite prerequisite chain (cycle-safe)',
  D.SKILLS.every(s=>Number.isFinite(D.prereqChain(s.id).length)), 'a cycle would have hung this');

console.log('\n=== reading/writing: do they resolve to anything now? ===');
console.log('(they used to resolve to nothing at all — no skill declared them, and lessonBank()');
console.log(' is exclusively arithmetic-story lessons and always will be. This section checks the');
console.log(' fix, not lessonBank() itself: a read/write skill now resolves via a pseudo-lesson');
console.log(' that points at the real read()/write() screen, never a lessonBank() entry.)');

check('read1..read6 and write1..write6 all exist, each with a non-empty concepts array',
  ['read1','read2','read3','read4','read5','read6','write1','write2','write3','write4','write5','write6']
    .every(id => { const s = D.skillById(id); return s && s.concepts.length > 0; }),
  'one or more of the 12 literacy skills is missing or has concepts:[]');

// lessonsForSkill() must still return [] for anything NOT tagged reading/writing
// and not resolvable via lessonBank() either — e.g. a genuine maths content
// gap like bodmas. This is the negative control: the fix must not have made
// lessonsForSkill() optimistic about skills it still cannot teach.
check("lessonsForSkill('bodmas', ...) is still empty — a real maths content gap, untouched by this fix",
  D.lessonsForSkill('bodmas', {}).length === 0, JSON.stringify(D.lessonsForSkill('bodmas', {})));

// The positive case: a reading skill with ONLY the pseudo-concept (read6 —
// nothing in literacy.js teaches independent fluent reading yet), for a
// child currently at reading level 4, resolves to a pseudo-lesson pointing
// at the live read() screen — at the CHILD's level, not a level baked into
// the skill itself.
const readerAtL4 = { levels: { read:4, write:2 } };
const readLoop = D.lessonsForSkill('read6', readerAtL4);   // deliberately not read4 — level comes from the child
console.log('\nlessonsForSkill("read6", childAtReadLevel4):', JSON.stringify(readLoop));
check("'reading' now resolves: lessonsForSkill('read6', ...) returns the live read() screen",
  readLoop.length===1 && readLoop[0].screen==='read' && readLoop[0].concept==='reading',
  JSON.stringify(readLoop));
check("the pseudo-lesson reflects the CHILD's own current level (4), not the skill's own level (6)",
  readLoop[0] && readLoop[0].level===4, readLoop[0] ? `level=${readLoop[0].level}` : 'n/a');

const writeLoop = D.lessonsForSkill('write5', readerAtL4);
check("'writing' now resolves: lessonsForSkill('write5', ...) returns the live write() screen",
  writeLoop.length===1 && writeLoop[0].screen==='write' && writeLoop[0].concept==='writing',
  JSON.stringify(writeLoop));

check("a child object with no .levels at all still resolves safely (teacher-roster shape), defaulting to level 1",
  D.lessonsForSkill('read4', {}).length===1 && D.lessonsForSkill('read4', {})[0].level===1,
  JSON.stringify(D.lessonsForSkill('read4', {})));

// THE RECONCILIATION ITSELF: read2 now carries both the 'reading' pseudo-
// concept AND real beat concepts (blending, letters, swar, ...) — a
// diagnosed gap there must surface BOTH the live practice screen and the
// specific letter-sound lessons, not just one or the other.
const read2Lessons = D.lessonsForSkill('read2', readerAtL4);
console.log('\nlessonsForSkill("read2", childAtReadLevel4):', read2Lessons.length, 'lesson(s) —',
  read2Lessons.map(l=>l.id).join(', '));
check("read2 (which has both a pseudo-concept and real beat concepts) returns the live practice screen AND specific literacy lessons, not just one",
  read2Lessons.some(l=>l.screen==='read' && l.concept==='reading') && read2Lessons.some(l=>l.screen===undefined),
  JSON.stringify(read2Lessons.map(l=>({id:l.id, screen:l.screen, concept:l.concept}))));

const write2Lessons = D.lessonsForSkill('write2', readerAtL4);
check("write2 (writing pseudo-concept + letters/swar beat concepts) likewise returns both the live write() screen and specific letter-formation lessons",
  write2Lessons.some(l=>l.screen==='write' && l.concept==='writing') && write2Lessons.some(l=>l.screen===undefined),
  JSON.stringify(write2Lessons.map(l=>({id:l.id, screen:l.screen, concept:l.concept}))));

// The real end-to-end proof, mirroring exactly how the math Riya scenario
// below demonstrates the arithmetic side: a struggling reader, diagnosed.
// Ruchi is weak at word & sentence reading (read3) — 3 of 10 correct, well
// under DIAG_SHAKY — so failing read3 in a teacher's test must come back a
// confirmed 'gap' pointing at the live read() screen, not 'unseen'.
const ruchi = { name:'Ruchi', skillHistory:{} };
for(const ok of [1,0,0,1,0,0,0,1,0,0]) D.noteSkillAttempt('read3', !!ok, ruchi);
const ruchiPlan = D.diagnose(['read3'], ruchi);
console.log('\nRUCHI — teacher marked "word & sentence reading" wrong, 3/10 in the app');
ruchiPlan.forEach(p=>console.log(`  [${p.verdict.padEnd(7)}] ${p.skill.en.padEnd(26)} ${p.lessons.length} lesson(s) · ${p.why}`));
console.log('  →', D.planSummary(ruchiPlan, 'Ruchi'));
// diagnose() also surfaces read3's own prerequisites (read2, read1) as
// blind spots — no evidence on those either, correctly 'unseen' rather
// than assumed — the exact same shape Rohit's scenario above demonstrates.
// The thing under test here is specifically the TARGET skill (read3).
const ruchiTarget = ruchiPlan.find(p => p.skill.id==='read3');
// read3 now also carries sightword/hisight beat concepts, so its lessons
// include the practice loop PLUS the specific sight-word lessons — more
// than one, and that's correct: check for the practice loop's presence,
// not an exact count.
check("Ruchi's reading gap (read3, the failed skill itself) is a confirmed 'gap', not 'unseen', and has a real practice loop to point at",
  !!ruchiTarget && ruchiTarget.verdict==='gap' && ruchiTarget.lessons.length>=1
    && ruchiTarget.lessons.some(l=>l.screen==='read'),
  JSON.stringify(ruchiPlan.map(p=>({id:p.skill.id, verdict:p.verdict, lessons:p.lessons.length}))));
check("Ruchi's planSummary names the practice loop, proving lessonsForSkill() actually fed it through",
  /solid|start with/i.test(D.planSummary(ruchiPlan,'Ruchi')) && !/cannot teach/i.test(D.planSummary(ruchiPlan,'Ruchi')),
  D.planSummary(ruchiPlan,'Ruchi'));

console.log('\n=== the three children from the brief ===');

// Riya: missed a BODMAS question. App shows weak multiplication.
const riya={ name:'Riya', age:11,
  skillHistory:{ tables:{n:22,right:12}, add2:{n:18,right:16}, sub2:{n:15,right:14},
                 mult2x1:{n:9,right:5}, divrem:{n:6,right:5} } };
ctx.S.age=11;
const rp=D.diagnose(['bodmas'], riya);
console.log('\nRIYA — teacher marked BODMAS wrong');
rp.slice(0,5).forEach(p=>console.log(`  [${p.verdict.padEnd(7)}] ${p.skill.en.padEnd(26)} ${p.lessons.length} lessons · ${p.why}`));
console.log('  →', D.planSummary(rp,'Riya'));

// Her real gap must sit UNDER bodmas — inside its prerequisite chain, not
// at bodmas itself — and be a confirmed 'gap' (her app accuracy is <60%
// on both tables and mult2x1), not a mere blind spot.
const bodmasChain = D.prereqChain('bodmas');
const riyaGap = rp.find(p => p.verdict==='gap');
check("Riya's gap is a confirmed 'gap' verdict, not 'unseen' or 'wobbly'",
  !!riyaGap, riyaGap ? riyaGap.skill.id : 'no gap-verdict entry in the plan');
check("Riya's gap sits under BODMAS in the prerequisite chain (not bodmas itself)",
  !!riyaGap && bodmasChain.includes(riyaGap.skill.id) && riyaGap.skill.id!=='bodmas',
  riyaGap ? riyaGap.skill.id : 'n/a');
check("Riya's gap is her weakest evidenced skill (Times tables, 55% over 22 attempts)",
  !!riyaGap && riyaGap.skill.id==='tables', riyaGap ? riyaGap.skill.id : 'n/a');

// Rohit: missed algebra. Solid multiplication, never practised BODMAS.
const rohit={ name:'Rohit', age:12,
  skillHistory:{ tables:{n:30,right:27}, mult2x1:{n:20,right:18}, add2:{n:25,right:23},
                 sub2:{n:20,right:18}, divrem:{n:12,right:10} } };
const op=D.diagnose(['algebra1'], rohit);
console.log('\nROHIT — teacher marked algebra wrong');
op.slice(0,5).forEach(p=>console.log(`  [${p.verdict.padEnd(7)}] ${p.skill.en.padEnd(26)} ${p.lessons.length} lessons · ${p.why}`));
console.log('  →', D.planSummary(op,'Rohit'));

// Every skill BELOW bodmas is mastered in Rohit's own data, so the plan
// must not chase those — it has to land on bodmas ("order of operations")
// itself as the nearest unexplained thing between his solid arithmetic
// and the failed algebra question.
const rohitBodmas = op.find(p => p.skill.id==='bodmas');
check("Rohit's diagnosis surfaces BODMAS (order of operations)", !!rohitBodmas,
  'plan: ' + op.map(p=>p.skill.id).join(', '));
check("Rohit's mastered prerequisites (tables, mult2x1, add2, sub2, divrem) are not flagged as gaps",
  !op.some(p => ['tables','mult2x1','add2','sub2','divrem'].includes(p.skill.id) && p.verdict==='gap'),
  'plan: ' + op.map(p=>`${p.skill.id}:${p.verdict}`).join(', '));

// a child who actually knows it — the test failure was a slip
const meera={ name:'Meera', skillHistory:{ tables:{n:40,right:38}, add2:{n:30,right:29},
  sub2:{n:28,right:27}, mult2x1:{n:22,right:20}, divrem:{n:15,right:14}, bodmas:{n:12,right:11} } };
const mp=D.diagnose(['bodmas'], meera);
console.log('\nMEERA — teacher marked BODMAS wrong, but the app disagrees');
mp.forEach(p=>console.log(`  [${p.verdict.padEnd(7)}] ${p.skill.en.padEnd(26)} ${p.why}`));
console.log('  →', D.planSummary(mp,'Meera'));

check("Meera's diagnosis is a single, confirmed slip on BODMAS",
  mp.length===1 && mp[0].verdict==='slip' && mp[0].skill.id==='bodmas',
  'plan: ' + mp.map(p=>`${p.skill.id}:${p.verdict}`).join(', '));
check("Meera's summary reads as a slip, not a remediation plan",
  /slip/i.test(D.planSummary(mp,'Meera')), D.planSummary(mp,'Meera'));

console.log('\n=== whole class ===');
const cls=[{name:'Riya',plan:rp},{name:'Rohit',plan:op},{name:'Meera',plan:mp},
           {name:'Aarav',plan:D.diagnose(['bodmas'],{name:'Aarav',skillHistory:{tables:{n:20,right:9}}})}];
const pat=D.classPattern(cls);
pat.slice(0,4).forEach(x=>console.log(`  ${x.children.length} children stuck on ${x.skill.en}: ${x.children.join(', ')}`));
check('the shared class gap (tables) surfaces Riya and Aarav, not Meera',
  pat.some(x => x.skill.id==='tables' && x.children.includes('Riya') && x.children.includes('Aarav') && !x.children.includes('Meera')),
  JSON.stringify(pat.map(x=>({skill:x.skill.id, children:x.children}))));

console.log('\n=== the child app ↔ teacher app bridge, end to end ===');
console.log('(Riya\'s scenario above used a hardcoded skillHistory fixture — this section');
console.log(' drives the actual noteSkillAttempt()/mirrorToClass()/tDiagnose() path a real');
console.log(' checkpoint and a real teacher roster would take. This is the path that never');
console.log(' actually executed before.)');

const CLASS_CODE = 'ABC123';
// The CHILD APP side: a real device, a real linked child, answering real
// checkpoints. Not a fixture — every attempt goes through the same
// noteSkillAttempt() a lesson checkpoint calls.
const riyaChild = { id:'riya-e2e', name:'Riya', classCode:CLASS_CODE, skillHistory:{} };
// 12 attempts on tables (7 right ≈ 58%), 8 on mult2x1 (4 right = 50%):
// 11/20 = 55% overall, matching the brief, and each skill independently
// lands under DIAG_SHAKY so both should read as a confirmed gap.
const tablesRuns   = [1,1,0,1,0,1,1,0,1,0,1,0];   // 7 of 12
const mult2x1Runs  = [1,0,1,0,1,0,1,0];           // 4 of 8
for(const ok of tablesRuns)  D.noteSkillAttempt('tables',   !!ok, riyaChild);
for(const ok of mult2x1Runs) D.noteSkillAttempt('mult2x1',  !!ok, riyaChild);
console.log(`\nchild app: Riya answered ${tablesRuns.length+mult2x1Runs.length} checkpoints`
  + ` (tables ${riyaChild.skillHistory.tables.right}/${riyaChild.skillHistory.tables.n},`
  + ` mult2x1 ${riyaChild.skillHistory.mult2x1.right}/${riyaChild.skillHistory.mult2x1.n})`);

D.flushClassMirror();   // force the debounced write out instead of waiting 800ms
const mirrored = D.readClassShared(CLASS_CODE);
check('mirrorToClass actually wrote Riya into the shared class blob',
  !!mirrored['riya-e2e'], `shared keys: ${Object.keys(mirrored).join(', ') || '(none)'}`);
check('the mirrored entry carries childName and the real skillHistory, not a copy of it',
  mirrored['riya-e2e'] && mirrored['riya-e2e'].childName==='Riya'
    && mirrored['riya-e2e'].skillHistory.tables.n===12 && mirrored['riya-e2e'].skillHistory.tables.right===7,
  JSON.stringify(mirrored['riya-e2e']));

// The TEACHER APP side: a roster entry created independently, the way a
// teacher app actually creates one — same id, but an empty skillHistory,
// because the teacher app has never seen a checkpoint fire.
const teacherRoster = [
  { id:'riya-e2e',  name:'Riya',  skillHistory:{} },   // linked — should pick up the mirrored evidence
  { id:'ghost-e2e', name:'Ghost', skillHistory:{} },   // never linked — no matching id, no own data
];
const results = D.tDiagnose(['bodmas'], teacherRoster, CLASS_CODE);
const riyaResult  = results.find(r => r.student.id==='riya-e2e');
const ghostResult = results.find(r => r.student.id==='ghost-e2e');

console.log('\nteacher app: tDiagnose(["bodmas"], roster, "ABC123")');
riyaResult.plan.slice(0,3).forEach(p=>console.log(`  Riya  [${p.verdict.padEnd(7)}] ${p.skill.en}`));
console.log(`  Riya  guesswork=${riyaResult.guesswork}`);
ghostResult.plan.slice(0,2).forEach(p=>console.log(`  Ghost [${p.verdict.padEnd(7)}] ${p.skill.en}`));
console.log(`  Ghost guesswork=${ghostResult.guesswork}`);

// This is the actual bug the bridge fixes: with an empty roster-side
// skillHistory and no merge, this would have come back 'unseen' — a real,
// confirmed gap invisible to the teacher. It must come back 'gap'.
const riyaTables = riyaResult.plan.find(p => p.skill.id==='tables');
check("THE BUG THIS FIXES: teacher-side diagnosis of Riya (roster skillHistory is empty,"
  + " evidence only exists via the class-code mirror) finds tables as a GAP, not unseen",
  !!riyaTables && riyaTables.verdict==='gap',
  riyaTables ? `verdict=${riyaTables.verdict}` : 'tables not even in the plan');
check('a linked student with real evidence is NOT flagged as guesswork',
  riyaResult.guesswork===false, `guesswork=${riyaResult.guesswork}`);

check('an unlinked student (no shared entry, no own data) diagnoses without throwing — everything unseen',
  ghostResult.plan.length>0 && ghostResult.plan.every(p => p.verdict==='unseen'),
  JSON.stringify(ghostResult.plan.map(p=>p.verdict)));
check('an unlinked student IS flagged as guesswork, so the roster can mark them visibly',
  ghostResult.guesswork===true, `guesswork=${ghostResult.guesswork}`);

// tDiagnose must degrade the same way diagnose() itself does for a bad
// input — no class code at all, or a code nobody has written to yet.
const noCodeResults = D.tDiagnose(['bodmas'], teacherRoster, null);
check('tDiagnose with no class code at all still returns a full roster, guesswork throughout, no throw',
  noCodeResults.length===2 && noCodeResults.every(r=>r.guesswork===true),
  JSON.stringify(noCodeResults.map(r=>({id:r.student.id, guesswork:r.guesswork}))));

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);

process.exitCode = failures ? 1 : 0;
