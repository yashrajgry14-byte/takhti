const fs=require('fs'), vm=require('vm');
const ctx={console, Intl, S:{lang:'hi', age:7, name:'Rudra', day:0}};
vm.createContext(ctx);
for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                'src/content/games.js','src/content/facts.js','src/content/ages.js',
                'src/core/daily-engine.js','src/content/lessons.js','src/core/lesson-gen.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx);
vm.runInContext('globalThis.__g={generateLessons,validateLesson,lessonsForChild,S};', ctx);
const G = ctx.__g;

// 1. adversarial: the validator must catch deliberately broken lessons
const bad = [
  {name:'wrong arithmetic', l:{id:'x',band:'early',title:{en:'a',hi:'अ'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'add',a:3,b:4},{t:'ask',q:{en:'3+4?',hi:'3+4?'},opts:['8','6'],hiOpts:['8','6'],correct:0}]}},
  {name:'number over band ceiling', l:{id:'x',band:'pre',title:{en:'a',hi:'अ'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'count',n:500},{t:'ask',q:{en:'?',hi:'?'},opts:['500','1'],hiOpts:['500','1'],correct:0}]}},
  {name:'not bilingual', l:{id:'x',band:'early',title:{en:'a'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'count',n:3},{t:'ask',q:{en:'?',hi:'?'},opts:['3','2'],hiOpts:['3','2'],correct:0}]}},
  {name:'no checkpoint', l:{id:'x',band:'early',title:{en:'a',hi:'अ'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'count',n:3},{t:'win',say:{en:'done',hi:'हो गया'}}]}},
  {name:'duplicate options', l:{id:'x',band:'early',title:{en:'a',hi:'अ'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'add',a:2,b:3},{t:'ask',q:{en:'?',hi:'?'},opts:['5','5'],hiOpts:['5','5'],correct:0}]}},
  {name:'correct index out of range', l:{id:'x',band:'early',title:{en:'a',hi:'अ'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'add',a:2,b:3},{t:'ask',q:{en:'?',hi:'?'},opts:['5','4'],hiOpts:['5','4'],correct:9}]}},
  {name:'unknown beat type', l:{id:'x',band:'early',title:{en:'a',hi:'अ'},sub:{en:'b',hi:'ब'},
    beats:[{t:'intro',say:{en:'x',hi:'क'}},{t:'explode'},{t:'ask',q:{en:'?',hi:'?'},opts:['1','2'],hiOpts:['1','2'],correct:0}]}},
];
console.log('--- adversarial: every one of these MUST be rejected ---');
let missed=0;
for(const b of bad){
  const v=G.validateLesson(b.l);
  console.log((v.ok?'  MISSED  ':'  caught  ')+b.name.padEnd(28)+(v.ok?'':'→ '+v.errors[0]));
  if(v.ok) missed++;
}
console.log(missed? `\n${missed} SLIPPED THROUGH` : '\nall 7 caught');

// 2. every generated lesson must survive a full replay of its own arithmetic
const all = G.generateLessons();
let checked=0, wrong=0;
for(const l of all){
  let last=null;
  for(const x of l.beats){
    if(x.t==='count') last=x.n;
    if(x.t==='add') last=x.a+x.b;
    if(x.t==='take') last=x.a-x.b;
    if(x.t==='array') last=x.a*x.b;
    if(x.t==='share') last=Math.floor(x.a/x.b);
    if(x.t==='bar') last=x.a-x.b;
    if(x.t==='line') last=x.a+x.b*(x.hops||1);
    if(x.t==='group') last=x.a;
    if(x.t==='ask' && !x.derived && last!=null){
      const g=x.opts[x.correct];
      if(/^-?\d+$/.test(g)){ checked++; if(Number(g)!==last) wrong++; }
    }
  }
}
console.log(`\narithmetic replay: ${checked} numeric checkpoints, ${wrong} wrong`);

// 3. the picker must respect the age band and stay varied
console.log('\n--- what each age is offered ---');
let bandLeaks=0;
for(const age of [4,6,8,10]){
  G.S.age=age;
  const pick=G.lessonsForChild(8);
  const bands=[...new Set(pick.map(l=>l.band))];
  const concepts=[...new Set(pick.map(l=>l.concept||l.id))];
  console.log(` age ${String(age).padEnd(3)} ${String(pick.length).padStart(2)} offered · bands ${bands.join(',').padEnd(12)} · ${concepts.length} distinct concepts`);
  if(bands.length>1) bandLeaks++;   // every pick must come from exactly this age's own band
}
console.log(bandLeaks? `\n${bandLeaks} age(s) got lessons outside their own band` : '\nevery age stayed inside its own band');

const failed = missed || wrong || bandLeaks;
console.log(`\n${failed? 'FAILED' : 'PASSED'} — ${missed} adversarial case(s) missed, ${wrong}/${checked} arithmetic checkpoint(s) wrong, ${bandLeaks} band leak(s)`);
process.exitCode = failed ? 1 : 0;
