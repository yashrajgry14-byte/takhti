const fs=require('fs'), vm=require('vm');
const { verifyLoadListHasAllContent } = require('./_helpers/load-order.js');

const ctx={console, Intl, setTimeout, clearTimeout,
  S:{lang:'en', age:8, name:'x', day:0, game:'cricket', online:false, doneLessons:[], levels:{}, skillHistory:{}}};
vm.createContext(ctx);

/* Same real load order index.html and sw.js's SHELL now ship: the content
   graph, then comprehension.js (which needs CONCEPTS/GEN_BEATS/SKILLS from
   lesson-gen.js, literacy.js and skills.js, per the brief), then the UI's
   lesson-player.js itself — so the compArt/compSay delegation chain added
   to lesArt/lesSay is the REAL chain, not a reimplementation of it. This
   file is the one this whole repo's numbers get quoted from (CLAUDE.md
   included) precisely because it is the only suite that loads the complete
   graph — see the self-check right below, which exists so a FUTURE content
   file can't quietly fall off this list the way comprehension.js once fell
   off test/diagnose.test.js's. */
const LOAD_LIST = ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/themes.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/skills.js','src/content/curriculum-early.js',
                'src/content/lessons.js','src/core/lesson-gen.js','src/content/literacy.js',
                'src/content/comprehension.js','src/content/geometry.js','src/content/clock.js','src/content/calendar.js','src/core/diagnose.js','src/content/copy.js'];
for(const f of LOAD_LIST)
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});

/* lesson-player.js is a UI file — it expects a handful of things that, in
   the real app, come from files this test deliberately does not load
   (cards.js, log.js, speech.js, views.js) because those touch the DOM or
   real network/TTS. Each stand-in here is either the exact one-line real
   implementation (L, copied verbatim from ui/cards.js — comprehension.js's
   own CL does the same thing for the same reason, see its comment) or a
   no-op for something startLesson() calls but this test does not need
   (render, log, speak — speak's onDone fires immediately, synchronously,
   so nothing here waits on real TTS). Nothing that touches lesson CONTENT
   or the lesArt/lesSay rendering chain is stubbed. */
ctx.L = (o) => (o && (o[ctx.S.lang] || o.en)) || '';
ctx.render = () => {};
ctx.log = () => {};
// A total no-op, deliberately: if onDone fired, lesNarrate()'s own callback
// would schedule a real setTimeout to auto-advance the lesson, racing the
// beat-by-beat walk this test drives itself below. Nothing here depends on
// speak() actually happening.
ctx.speak = () => {};
vm.runInContext(fs.readFileSync('src/ui/lesson-player.js','utf8'), ctx, {filename:'src/ui/lesson-player.js'});

vm.runInContext(`globalThis.__={generateLessons,validateLesson,CONCEPTS,SKILLS,skillById,
  coverageMatrix,ladderCoverage,contentQueue,
  compArt,compSay,COMP_CONCEPTS,COMP_BEAT_TYPES,CL,GEO_CONCEPTS,CLOCK_CONCEPTS,CAL_CONCEPTS,
  litArt,litSay,
  startLesson,endLesson,lessonHTML,lesArt,lesSay,lessonBank,S};`, ctx);
const X = ctx.__;

let failures=0;
const checks=[];
function check(name, pass, detail){
  checks.push({name, pass, detail});
  if(!pass) failures++;
}

const loadCheck = verifyLoadListHasAllContent(LOAD_LIST, 'src/core/diagnose.js');
check("this file's own LOAD_LIST includes every content/*.js file index.html actually loads before core/diagnose.js",
  loadCheck.pass,
  `index.html loads ${JSON.stringify(loadCheck.realContentBefore)} before diagnose.js; LOAD_LIST is missing ${JSON.stringify(loadCheck.missing)}`);

console.log('=== generation ===');
const {lessons, rejected} = X.generateLessons({report:true});
console.log('concepts :', X.CONCEPTS.length);
console.log('lessons  :', lessons.length);
console.log('rejected :', rejected.length);
rejected.slice(0,8).forEach(r=>console.log('   ', r.id, '→', r.errors[0]));

check('55 concepts (33 before comprehension.js + 7 comprehension/grammar + 5 shape concepts from geometry.js + 5 clock concepts from clock.js + 5 calendar concepts from calendar.js)',
  X.CONCEPTS.length===55, `got ${X.CONCEPTS.length}`);
check('552 lessons generated (477 + 27 shape lessons + 28 clock lessons + 20 calendar lessons)', lessons.length===552, `got ${lessons.length}`);
check('0 rejected — every generated comprehension/grammar lesson passed the validator first try',
  rejected.length===0, `${rejected.length} rejected: ${rejected.slice(0,3).map(r=>r.id+' → '+r.errors[0]).join(' | ')}`);

const comp = lessons.filter(l => X.COMP_CONCEPTS.some(c=>c.id===l.concept));
const geoLes = lessons.filter(l => X.GEO_CONCEPTS.some(c=>c.id===l.concept));
const clockLes = lessons.filter(l => X.CLOCK_CONCEPTS.some(c=>c.id===l.concept));
const calLes = lessons.filter(l => X.CAL_CONCEPTS.some(c=>c.id===l.concept));
console.log('comprehension/grammar lessons:', comp.length, '· shape lessons:', geoLes.length);
check('comprehension.js\'s 7 concepts, geometry.js\'s 5, clock.js\'s 5 and calendar.js\'s 5 account for every lesson beyond the pre-existing 455 (467 before the o\'clock lessons moved to clock.js)',
  comp.length + geoLes.length + clockLes.length + calLes.length === lessons.length - 455 && geoLes.length === 27 && clockLes.length === 28 && calLes.length === 20, `got ${comp.length} + ${geoLes.length} + ${clockLes.length} + ${calLes.length}, expected ${lessons.length-455}`);

console.log('\n=== the last Class 2-3 gaps ===');
const closedIds = ['e2-compre','e2-noun','e3-compre','e3-verb','e3-para','h3-compre','h3-vyakaran'];
const stillGapped = closedIds.filter(id => !X.skillById(id).concepts.length);
console.log('previously-missing skills now taught:', closedIds.filter(id=>!stillGapped.includes(id)).join(', '));
check('all 7 previously-missing Class 2-3 skills now have real concepts',
  stillGapped.length===0, `still gapped: ${stillGapped.join(', ') || 'none'}`);

console.log('\n=== SUBJECT COVERAGE (strand:\'lit\' still excluded) ===');
const matrix = X.coverageMatrix(5);
console.log('grade      numeracy    english     hindi       evs');
for(const r of matrix){
  const f=c=>c?`${c.done}/${c.n} (${c.pct}%)`.padEnd(11):'—'.padEnd(11);
  console.log(r.grade.padEnd(10), f(r.cells.num), f(r.cells.eng), f(r.cells.hin), f(r.cells.evs));
}
const upto3 = X.SKILLS.filter(s => s.g<=3 && s.strand!=='evs' && s.strand!=='lit');
const d3 = upto3.filter(s=>s.concepts.length);
const pct3 = Math.round(d3.length/upto3.length*100);
console.log(`\nSubject matrix, Nursery-Class 3 excluding EVS: ${d3.length}/${upto3.length} = ${pct3}%`);
check("Nursery-Class 3 subject coverage (EVS and the ladder both excluded) is 100% — comprehension.js closed every remaining gap",
  pct3===100, `got ${pct3}%`);

const ladders = X.ladderCoverage();
for(const l of ladders) console.log(`${l.en} ${l.done}/${l.n} (${l.pct}%)`);
const combinedDone = d3.length + ladders.reduce((a,l)=>a+l.done,0);
const combinedTotal = upto3.length + ladders.reduce((a,l)=>a+l.n,0);
const combinedPct = Math.round(combinedDone/combinedTotal*100);
console.log(`Overall (subject + both ladders), Nursery-Class 3: ${combinedDone}/${combinedTotal} = ${combinedPct}%`);
check('overall Nursery-Class 3 figure (subject matrix + both ladders) is now 100%',
  combinedPct===100, `got ${combinedPct}%`);

console.log('\n=== contentQueue() — comprehension skills must not still be queued ===');
const queue = X.contentQueue(5);
const stillQueued = queue.filter(q => closedIds.includes(q.id));
check('none of the 7 newly-taught skills still appear in the content build queue',
  stillQueued.length===0, JSON.stringify(stillQueued.map(q=>q.id)));

console.log('\n=== render/narration sweep: every passage/highlight/sentbuild beat, both languages ===');
console.log('(goes through the REAL lesArt()/lesSay() from ui/lesson-player.js, which is what the');
console.log(' app actually calls — not compArt/compSay called directly.)');
let sweepBad = 0, sweepChecked = 0;
for(const l of comp){
  for(const b of l.beats){
    if(!X.COMP_BEAT_TYPES.includes(b.t)) continue;
    for(const lang of ['en','hi']){
      ctx.S.lang = lang;
      sweepChecked++;
      const art = X.lesArt(b, '🏏');
      if(!art || !art.trim()){ console.log('EMPTY ART', l.id, b.t, lang); sweepBad++; }
      const say = X.lesSay(b);
      if(say == null){ console.log('NULL SAY', l.id, b.t, lang); sweepBad++; }
      if(b.t==='passage' && !X.CL(b.p)){ console.log('EMPTY PASSAGE TEXT', l.id, lang); sweepBad++; }
    }
  }
}
ctx.S.lang = 'en';
console.log(`checked ${sweepChecked} beat/language combinations across ${comp.length} lessons — ${sweepBad} problem(s)`);
check('every passage/highlight/sentbuild beat in every generated comprehension/grammar lesson renders non-empty art and narrates non-null in both languages, via the real lesArt()/lesSay() chain',
  sweepBad===0, `${sweepBad} problem(s) found`);

console.log('\n=== headless play-through, one of each new type, through the REAL startLesson() path ===');
async function playOneOfEach(){
  const ids = ['gen-compre2-1', 'gen-naming-1', 'gen-sentence-1'];
  const results = [];
  for(const id of ids){
    const inBank = !!X.lessonBank().find(l => l.id === id);
    if(!inBank){ results.push({id, ok:false, why:'not found in lessonBank()'}); continue; }

    await X.startLesson(id);   // the actual function the "play" button calls
    const les = ctx.S.lesson && ctx.S.lesson.data;
    if(!les){ results.push({id, ok:false, why:'startLesson() did not populate S.lesson'}); continue; }

    let bad = 0, newTypeBeats = 0;
    for(let i=0; i<les.beats.length; i++){
      const b = les.beats[i];
      // exercise the real per-beat renderer (lesArt/lesSay) for every beat...
      for(const lang of ['en','hi']){
        ctx.S.lang = lang;
        const art = X.lesArt(b, '🏏');
        if(!art || !art.trim()) bad++;
        if(X.COMP_BEAT_TYPES.includes(b.t)){
          newTypeBeats++;
          const say = X.lesSay(b);
          if(say == null) bad++;
        }
      }
      // ...and, once, the actual lessonHTML() the render() pipeline builds,
      // proving the full screen string assembles without throwing for a
      // lesson that opens on one of the new beat types.
      ctx.S.lesson.i = i;
      const html = X.lessonHTML();
      if(!html || !html.trim()) bad++;
    }
    ctx.S.lang = 'en';
    X.endLesson();
    results.push({id, ok: bad===0 && newTypeBeats>0, bad, newTypeBeats, beats: les.beats.length});
  }
  return results;
}

(async () => {
  const results = await playOneOfEach();
  results.forEach(r => console.log(' ', r.id, '→', r.ok ? `OK (${r.newTypeBeats} new-type beat/lang checks, ${r.beats} beats)` : `FAIL (${r.why || r.bad+' problem(s)'})`));
  check('gen-compre2-1, gen-naming-1 and gen-sentence-1 all exist in lessonBank(), play through the real startLesson() path, and render/narrate every beat with no empty art or null narration',
    results.every(r => r.ok), JSON.stringify(results));

  console.log('\n' + '-'.repeat(70));
  checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
  console.log('-'.repeat(70));
  console.log(`${checks.length-failures}/${checks.length} checks passed`);

  process.exitCode = failures ? 1 : 0;
})();
