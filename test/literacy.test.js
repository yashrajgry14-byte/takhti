const fs=require('fs'), vm=require('vm');
const ctx={console, Intl, S:{lang:'en',age:6,name:'x',day:0}};
vm.createContext(ctx);
for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/lessons.js','src/core/lesson-gen.js',
                'src/content/skills.js','src/content/curriculum-early.js','src/content/literacy.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
vm.runInContext('globalThis.__={generateLessons,validateLesson,CONCEPTS,SKILLS,coverageMatrix,ladderCoverage,contentQueue,litArt,litSay,LIT_CONCEPTS,skillById};',ctx);
const X=ctx.__;

let failures=0;
const checks=[];
function check(name, pass, detail){
  checks.push({name, pass, detail});
  if(!pass) failures++;
}

const {lessons,rejected}=X.generateLessons({report:true});
console.log('concepts       :', X.CONCEPTS.length);
console.log('lessons        :', lessons.length);
console.log('rejected       :', rejected.length);
if(rejected.length) rejected.slice(0,6).forEach(r=>console.log('   ', r.id, '→', r.errors[0]));

const lit=lessons.filter(l=>X.LIT_CONCEPTS.some(c=>c.id===l.concept));
console.log('literacy/early :', lit.length);

check('34 concepts (19 original arithmetic + 15 literacy/early-numeracy)', X.CONCEPTS.length===34, `got ${X.CONCEPTS.length}`);
check('467 lessons generated', lessons.length===467, `got ${lessons.length}`);
check('0 rejected — every generated literacy lesson passed the validator first try', rejected.length===0,
  `${rejected.length} rejected: ${rejected.slice(0,3).map(r=>r.id+' → '+r.errors[0]).join(' | ')}`);
check('148 of the 467 lessons come from the new literacy/early-numeracy concepts', lit.length===148, `got ${lit.length}`);

// every new beat must render and narrate
const seen=new Set(); let noArt=0, noSay=0;
for(const l of lit) for(const b of l.beats){
  if(['intro','win','ask'].includes(b.t)) continue;
  seen.add(b.t);
  const a=X.litArt(b);
  if(a===null || a===undefined){ /* falls through to arithmetic renderer */ }
  else if(!a.trim()) noArt++;
  if(X.LIT_CONCEPTS.length && ['letter','sound','blend','word','rhyme','readline','sortbin','pattern','shape','clock'].includes(b.t)){
    for(const lang of ['en','hi']){ ctx.S.lang=lang; if(!X.litSay(b)) noSay++; }
  }
}
ctx.S.lang='en';
console.log('new beat types :', [...seen].join(', '));
console.log('empty art      :', noArt, '· missing narration:', noSay);
check('every literacy beat renders non-empty HTML via litArt()', noArt===0, `${noArt} beat(s) returned empty art`);
check('every literacy beat narrates in both languages via litSay()', noSay===0, `${noSay} beat/language combination(s) missing narration`);
// literacy.js's own LIT_BEAT_TYPES array lists 10 entries, not the 9 the
// brief described — verified by counting the actual array, not assumed.
const LIT_TYPES = ['letter','sound','blend','word','rhyme','readline','sortbin','pattern','shape','clock'];
check(`all ${LIT_TYPES.length} new beat types actually got exercised by the generated lessons (brief said 9; LIT_BEAT_TYPES itself has ${LIT_TYPES.length})`,
  LIT_TYPES.filter(t=>seen.has(t)).length===LIT_TYPES.length,
  `saw: ${[...seen].join(', ')}`);

console.log('\n=== SUBJECT COVERAGE: Nursery to Class 5 (strand:\'lit\' excluded) ===');
console.log('grade      numeracy    english     hindi       evs');
const matrix = X.coverageMatrix(5);
for(const r of matrix){
  const f=c=>c?`${c.done}/${c.n} (${c.pct}%)`.padEnd(11):'—'.padEnd(11);
  console.log(r.grade.padEnd(10), f(r.cells.num), f(r.cells.eng), f(r.cells.hin), f(r.cells.evs));
}

// read1-6/write1-6 are a language-agnostic fluency ladder, not a subject —
// filing them under 'num' (the old fallback for "no strand") or under
// 'eng'/'hin' would both be wrong, since the same six rungs apply
// whichever language the child is using. They now declare strand:'lit'
// themselves and coverageMatrix() excludes that strand entirely, reporting
// it instead as its own two rows via ladderCoverage().
check("read1-6/write1-6 all declare strand:'lit', not 'num'/'eng'/'hin'",
  ['read1','read2','read3','read4','read5','read6','write1','write2','write3','write4','write5','write6']
    .every(id => X.skillById(id).strand === 'lit'),
  JSON.stringify(['read1','write1'].map(id=>({id, strand:X.skillById(id).strand}))));
check('the stray, unlabelled "0" grade row is gone now that strand:\'lit\' skills (the only g:0 skills) are excluded from the subject matrix',
  !matrix.some(r => r.grade === '0'), `grade rows: ${matrix.map(r=>r.grade).join(', ')}`);

console.log('\n=== THE LADDER, reported as its own rows, not a subject cell ===');
const ladders = X.ladderCoverage();
for(const l of ladders) console.log(`${l.en} ${l.done}/${l.n} (${l.pct}%)`);
check("ladderCoverage() reports 'Reading ladder 6/6' and 'Writing ladder 6/6'",
  ladders.length===2 && ladders.every(l => l.n===6 && l.done===6 && l.pct===100),
  JSON.stringify(ladders));

// The SUBJECT-ONLY figure: Nursery-Class 3, excluding EVS and excluding
// the ladder (coverageMatrix() already excludes strand:'lit'; recomputed
// directly here too, off the same filter, as the ground truth for the
// number that goes in the deck).
const upto3 = X.SKILLS.filter(s => s.g<=3 && s.strand!=='evs' && s.strand!=='lit');
const d3 = upto3.filter(s=>s.concepts.length);
const pct3 = Math.round(d3.length/upto3.length*100);
console.log(`\nSubject matrix, Nursery-Class 3 excluding EVS: ${d3.length}/${upto3.length} = ${pct3}%`);
const gaps3 = upto3.filter(s=>!s.concepts.length);
console.log('still missing:', gaps3.map(s=>s.id).join(', ') || 'none');

// This was the earlier session's unexplained 89-vs-91 discrepancy. It is
// now fully explained and closed: 'lit' skills were being counted as
// numeracy (the strand:'num' fallback for "no strand at all"), which
// inflated the subject figure from 89% to 91%. With the ladder properly
// separated, the subject-only figure lands exactly on the brief's
// original 89% — re-verified by running it, not assumed.
check('Nursery-Class 3 subject coverage (EVS and the ladder both excluded) is 89% — the discrepancy from the earlier session is now fully explained and closed',
  pct3===89, `got ${pct3}%`);

// The blended figure — subject skills plus both ladders folded back in —
// is the earlier session's 91%, unchanged, but now arrived at
// transparently (subject + ladder) instead of by accident (ladder
// silently mislabelled as a subject).
const combinedDone = d3.length + ladders.reduce((a,l)=>a+l.done,0);
const combinedTotal = upto3.length + ladders.reduce((a,l)=>a+l.n,0);
const combinedPct = Math.round(combinedDone/combinedTotal*100);
console.log(`\nOverall (subject + both ladders), Nursery-Class 3: ${combinedDone}/${combinedTotal} = ${combinedPct}%`);
check('overall Nursery-Class 3 figure (subject matrix + both ladders) is 91% — same total as before, now composed transparently instead of conflated',
  combinedPct===91, `got ${combinedPct}%`);

// contentQueue() and diagnosis must still see the ladder in full — the
// strand split only changes how it's REPORTED, not what's teachable or
// diagnosable.
const queue = X.contentQueue(5);
check('contentQueue() is untouched by the strand split — no strand filtering, ladder skills just never appear because all 12 rungs already have concepts',
  queue.filter(q => X.skillById(q.id).strand==='lit').length===0 && queue.length>0,
  `queue length ${queue.length}, lit entries ${queue.filter(q => X.skillById(q.id).strand==='lit').length}`);

console.log('\n' + '-'.repeat(70));
checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
console.log('-'.repeat(70));
console.log(`${checks.length-failures}/${checks.length} checks passed`);

process.exitCode = failures ? 1 : 0;
