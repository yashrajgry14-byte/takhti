/* ==================================================================
   CURRICULUM: NURSERY → CLASS 5

   This file extends the skill graph beyond maths. It exists because a
   school will not run a pilot on a maths app — they want to see their
   whole early-years curriculum mapped, and they want to know where you
   are on it.

   Two things worth understanding before reading it:

   1. For Nursery to Class 2, the curriculum IS foundational literacy
      and numeracy. There are no "subjects" yet in any meaningful
      sense — EVS at that age is looking out of a window and talking.
      So the early-years strands here are pre-literacy and pre-number,
      which is exactly what Takhti was already built to do.

   2. Every skill declares `concepts: []` when we cannot yet teach it.
      That is deliberate and it is the point of this file. The coverage
      report turns those empty arrays into a build queue, and it is
      also what you show a principal instead of overclaiming.

   `strand`: num | eng | hin | evs
   `g`:      -3 Nursery · -2 LKG · -1 UKG · 1..8 classes
   `gl`:     what a school actually calls it
   ================================================================== */

const GRADE_LABEL = { '-3':'Nursery', '-2':'LKG', '-1':'UKG',
  '1':'Class 1','2':'Class 2','3':'Class 3','4':'Class 4','5':'Class 5',
  '6':'Class 6','7':'Class 7','8':'Class 8' };

const CURRICULUM_EARLY = [

/* ============ NURSERY (age 3–4) ============ */
{id:'n-sort',     g:-3, strand:'num', en:'Sorting by colour and size', hi:'रंग और आकार से छाँटना', pre:[], concepts:[]},
{id:'n-count5',   g:-3, strand:'num', en:'Counting to 5',              hi:'5 तक गिनती',            pre:[], concepts:['count']},
{id:'n-big',      g:-3, strand:'num', en:'Big and small',              hi:'बड़ा और छोटा',          pre:[], concepts:['compare']},
{id:'n-shapes',   g:-3, strand:'num', en:'Circle, square, triangle',   hi:'गोल, चौकोर, तिकोन',     pre:[], concepts:[]},
{id:'n-listen',   g:-3, strand:'eng', en:'Listening to a story',       hi:'कहानी सुनना',           pre:[], concepts:[]},
{id:'n-rhyme',    g:-3, strand:'eng', en:'Rhyming sounds',             hi:'तुकबंदी',               pre:[], concepts:[]},
{id:'n-hold',     g:-3, strand:'eng', en:'Holding a pencil',           hi:'पेंसिल पकड़ना',         pre:[], concepts:[]},
{id:'n-trace',    g:-3, strand:'eng', en:'Tracing lines and curves',   hi:'रेखाएँ बनाना',          pre:['n-hold'], concepts:[]},

/* ============ LKG (age 4–5) ============ */
{id:'l-count10',  g:-2, strand:'num', en:'Counting to 10',             hi:'10 तक गिनती',           pre:['n-count5'], concepts:['count']},
{id:'l-match',    g:-2, strand:'num', en:'Matching number to quantity',hi:'संख्या और गिनती मिलाना',pre:['l-count10'], concepts:['count']},
{id:'l-pattern',  g:-2, strand:'num', en:'Simple patterns',            hi:'सरल पैटर्न',            pre:['n-sort'], concepts:[]},
{id:'l-more',     g:-2, strand:'num', en:'More and fewer',             hi:'ज़्यादा और कम',         pre:['l-count10'], concepts:['compare']},
{id:'l-alpha',    g:-2, strand:'eng', en:'Recognising A to Z',         hi:'A से Z पहचानना',        pre:['n-rhyme'], concepts:[]},
{id:'l-sound',    g:-2, strand:'eng', en:'Letter sounds',              hi:'अक्षरों की ध्वनि',      hiOnly:false, pre:['l-alpha'], concepts:[]},
{id:'l-write',    g:-2, strand:'eng', en:'Writing capital letters',    hi:'बड़े अक्षर लिखना',      pre:['n-trace'], concepts:[]},
{id:'l-swar',     g:-2, strand:'hin', en:'Recognising स्वर (vowels)',  hi:'स्वर पहचानना',          pre:[], concepts:[]},
{id:'l-matra0',   g:-2, strand:'hin', en:'Hearing matra sounds',       hi:'मात्रा की ध्वनि',       pre:['l-swar'], concepts:[]},

/* ============ UKG (age 5–6) ============ */
{id:'u-count20',  g:-1, strand:'num', en:'Counting to 20',             hi:'20 तक गिनती',           pre:['l-count10'], concepts:['count']},
{id:'u-addpic',   g:-1, strand:'num', en:'Adding with pictures',       hi:'चित्रों से जोड़',       pre:['l-match'], concepts:['add']},
{id:'u-subpic',   g:-1, strand:'num', en:'Taking away with pictures',  hi:'चित्रों से घटाव',       pre:['l-match'], concepts:['take']},
{id:'u-order',    g:-1, strand:'num', en:'Before, after, between',     hi:'पहले, बाद, बीच में',    pre:['u-count20'], concepts:[]},
{id:'u-blend',    g:-1, strand:'eng', en:'Blending sounds into words', hi:'ध्वनियाँ जोड़कर शब्द',  pre:['l-sound'], concepts:[]},
{id:'u-sight',    g:-1, strand:'eng', en:'First sight words',          hi:'पहले शब्द',             pre:['u-blend'], concepts:[]},
{id:'u-small',    g:-1, strand:'eng', en:'Writing small letters',      hi:'छोटे अक्षर लिखना',      pre:['l-write'], concepts:[]},
{id:'u-vyanjan',  g:-1, strand:'hin', en:'Recognising व्यंजन',         hi:'व्यंजन पहचानना',        pre:['l-swar'], concepts:[]},
{id:'u-matra1',   g:-1, strand:'hin', en:'Reading आ and इ matras',     hi:'आ और इ की मात्रा',      pre:['u-vyanjan','l-matra0'], concepts:[]},

/* ============ CLASS 1 — literacy alongside the existing maths ============ */
{id:'e1-decode',  g:1, strand:'eng', en:'Sounding out simple words',   hi:'सरल शब्द पढ़ना',        pre:['u-blend'], concepts:[]},
{id:'e1-read',    g:1, strand:'eng', en:'Reading a short sentence',    hi:'छोटा वाक्य पढ़ना',      pre:['e1-decode','u-sight'], concepts:['reading']},
{id:'e1-write',   g:1, strand:'eng', en:'Copying a sentence',          hi:'वाक्य उतारना',          pre:['u-small'], concepts:['writing']},
{id:'h1-matra',   g:1, strand:'hin', en:'All matras',                  hi:'सभी मात्राएँ',          pre:['u-matra1'], concepts:[]},
{id:'h1-read',    g:1, strand:'hin', en:'Reading a Hindi sentence',    hi:'हिंदी वाक्य पढ़ना',     pre:['h1-matra'], concepts:['reading']},
{id:'h1-write',   g:1, strand:'hin', en:'Writing Hindi words',         hi:'हिंदी शब्द लिखना',      pre:['h1-matra'], concepts:['writing']},
{id:'v1-body',    g:1, strand:'evs', en:'My body and senses',          hi:'मेरा शरीर और इंद्रियाँ',pre:[], concepts:[]},
{id:'v1-family',  g:1, strand:'evs', en:'Family and home',             hi:'परिवार और घर',          pre:[], concepts:[]},

/* ============ CLASS 2 ============ */
{id:'e2-fluent',  g:2, strand:'eng', en:'Reading fluently',            hi:'धाराप्रवाह पढ़ना',      pre:['e1-read'], concepts:['reading']},
{id:'e2-compre',  g:2, strand:'eng', en:'Answering about a story',     hi:'कहानी पर सवाल',         pre:['e2-fluent'], concepts:[]},
{id:'e2-noun',    g:2, strand:'eng', en:'Naming words',                hi:'नाम वाले शब्द',         pre:['e1-read'], concepts:[]},
{id:'h2-fluent',  g:2, strand:'hin', en:'Reading Hindi fluently',      hi:'हिंदी धाराप्रवाह',      pre:['h1-read'], concepts:['reading']},
{id:'h2-sanyukt', g:2, strand:'hin', en:'Conjunct letters',            hi:'संयुक्त अक्षर',         pre:['h1-read'], concepts:[]},
{id:'v2-plants',  g:2, strand:'evs', en:'Plants around us',            hi:'हमारे आसपास पौधे',      pre:[], concepts:[]},
{id:'v2-animals', g:2, strand:'evs', en:'Animals and their homes',     hi:'जानवर और उनके घर',      pre:[], concepts:[]},
{id:'v2-water',   g:2, strand:'evs', en:'Water and weather',           hi:'पानी और मौसम',          pre:[], concepts:[]},

/* ============ CLASS 3 ============ */
{id:'e3-compre',  g:3, strand:'eng', en:'Reading comprehension',       hi:'पढ़कर समझना',           pre:['e2-compre'], concepts:[]},
{id:'e3-verb',    g:3, strand:'eng', en:'Doing words and tenses',      hi:'क्रिया और काल',         pre:['e2-noun'], concepts:[]},
{id:'e3-para',    g:3, strand:'eng', en:'Writing a paragraph',         hi:'अनुच्छेद लिखना',        pre:['e1-write','e2-noun'], concepts:[]},
{id:'h3-compre',  g:3, strand:'hin', en:'Hindi comprehension',         hi:'हिंदी में समझ',         pre:['h2-fluent'], concepts:[]},
{id:'h3-vyakaran',g:3, strand:'hin', en:'संज्ञा and सर्वनाम',          hi:'संज्ञा और सर्वनाम',     pre:['h2-fluent'], concepts:[]},
{id:'v3-food',    g:3, strand:'evs', en:'Food we eat',                 hi:'हमारा भोजन',            pre:['v2-plants'], concepts:[]},
{id:'v3-house',   g:3, strand:'evs', en:'Houses and materials',        hi:'घर और सामग्री',         pre:['v1-family'], concepts:[]},
{id:'v3-travel',  g:3, strand:'evs', en:'Travel and transport',        hi:'यात्रा और वाहन',        pre:[], concepts:[]},

/* ============ CLASS 4 ============ */
{id:'e4-compre',  g:4, strand:'eng', en:'Inference from a passage',    hi:'निष्कर्ष निकालना',      pre:['e3-compre'], concepts:[]},
{id:'e4-adj',     g:4, strand:'eng', en:'Describing words',            hi:'विशेषण',                pre:['e3-verb'], concepts:[]},
{id:'e4-letter',  g:4, strand:'eng', en:'Writing a short letter',      hi:'छोटा पत्र लिखना',       pre:['e3-para'], concepts:[]},
{id:'h4-vyakaran',g:4, strand:'hin', en:'विशेषण and क्रिया',           hi:'विशेषण और क्रिया',      pre:['h3-vyakaran'], concepts:[]},
{id:'h4-nibandh', g:4, strand:'hin', en:'Short essay',                 hi:'छोटा निबंध',            pre:['h3-compre'], concepts:[]},
{id:'v4-body',    g:4, strand:'evs', en:'Inside the body',             hi:'शरीर के अंदर',          pre:['v1-body'], concepts:[]},
{id:'v4-map',     g:4, strand:'evs', en:'Maps and directions',         hi:'नक्शा और दिशाएँ',       pre:['v3-travel'], concepts:[]},
{id:'v4-work',    g:4, strand:'evs', en:'Work people do',              hi:'लोगों के काम',          pre:['v3-house'], concepts:[]},

/* ============ CLASS 5 ============ */
{id:'e5-compre',  g:5, strand:'eng', en:'Reading longer texts',        hi:'लंबा पाठ पढ़ना',        pre:['e4-compre'], concepts:[]},
{id:'e5-gram',    g:5, strand:'eng', en:'Sentence structure',          hi:'वाक्य रचना',            pre:['e4-adj'], concepts:[]},
{id:'e5-story',   g:5, strand:'eng', en:'Writing a story',             hi:'कहानी लिखना',           pre:['e4-letter'], concepts:[]},
{id:'h5-compre',  g:5, strand:'hin', en:'Hindi passage work',          hi:'हिंदी गद्यांश',         pre:['h4-nibandh'], concepts:[]},
{id:'h5-muhavare',g:5, strand:'hin', en:'Idioms and proverbs',         hi:'मुहावरे और लोकोक्तियाँ',pre:['h4-vyakaran'], concepts:[]},
{id:'v5-plants',  g:5, strand:'evs', en:'How plants make food',        hi:'पौधे भोजन कैसे बनाते',  pre:['v3-food'], concepts:[]},
{id:'v5-earth',   g:5, strand:'evs', en:'Earth, sun and moon',         hi:'पृथ्वी, सूरज, चाँद',    pre:['v4-map'], concepts:[]},
{id:'v5-health',  g:5, strand:'evs', en:'Health and hygiene',          hi:'स्वास्थ्य और सफ़ाई',    pre:['v4-body'], concepts:[]}
];

/* Merge into the main graph. Existing maths skills get strand 'num' so
   every skill has one, and the reports below can group cleanly. This
   only backfills a MISSING strand — skills.js's read1-6/write1-6 already
   declare strand:'lit' themselves, so this loop never touches them. */
if(typeof SKILLS !== 'undefined'){
  for(const s of SKILLS) if(!s.strand) s.strand = 'num';
  for(const s of CURRICULUM_EARLY) if(!SKILLS.find(x => x.id === s.id)) SKILLS.push(s);
}

const STRAND_NAME = {
  num:{en:'Numeracy', hi:'गणित'}, eng:{en:'English', hi:'अंग्रेज़ी'},
  hin:{en:'Hindi', hi:'हिंदी'},   evs:{en:'EVS', hi:'पर्यावरण'},
  lit:{en:'Reading & Writing Ladder', hi:'पठन-लेखन सीढ़ी'}
};

/* ==================================================================
   THE BUILD QUEUE
   Every skill with an empty `concepts` is content we cannot teach.
   This turns that into a prioritised list: earliest grade first,
   because a gap at LKG blocks everything above it.
   ================================================================== */
function contentQueue(maxGrade){
  const cap = maxGrade == null ? 5 : maxGrade;
  return SKILLS
    .filter(s => s.g <= cap && !s.concepts.length)
    .sort((a,b) => a.g - b.g || a.strand.localeCompare(b.strand))
    .map(s => ({ id:s.id, grade:GRADE_LABEL[String(s.g)] || s.g,
                 strand:s.strand, en:s.en,
                 blocks: SKILLS.filter(x => x.pre.includes(s.id)).length }));
}

/* What a principal actually asks: what do you cover, by subject and year.
   strand:'lit' (read1-6/write1-6) is deliberately excluded here — it is a
   language-agnostic fluency ladder, not a per-grade subject, and it is
   the reason a stray unlabelled grade-0 row and an unreconcilable
   percentage used to show up in this matrix. See ladderCoverage() for
   how it's reported instead: as its own two rows, not a subject cell. */
function coverageMatrix(maxGrade){
  const cap = maxGrade == null ? 5 : maxGrade;
  const subject = SKILLS.filter(s => s.strand !== 'lit');
  const grades = [...new Set(subject.filter(s=>s.g<=cap).map(s=>s.g))].sort((a,b)=>a-b);
  const out = [];
  for(const g of grades){
    const row = { grade: GRADE_LABEL[String(g)] || String(g), cells:{} };
    for(const st of ['num','eng','hin','evs']){
      const all = subject.filter(s => s.g === g && s.strand === st);
      const done = all.filter(s => s.concepts.length);
      row.cells[st] = all.length ? { n:all.length, done:done.length,
        pct: Math.round(done.length/all.length*100) } : null;
    }
    out.push(row);
  }
  return out;
}

/* The ladder, reported as its own two rows instead of forced into a
   per-grade subject cell — see the strand:'lit' comment on read1-6/
   write1-6 in skills.js for why. Each rung is either fully teachable or
   not (skills.js currently has all 12 non-empty), but this stays a real
   done/total count rather than an assumed 100%, so a future gap in the
   ladder shows up here too. */
function ladderCoverage(){
  return ['read','write'].map(prefix => {
    const rungs = SKILLS.filter(s => s.strand==='lit' && s.id.startsWith(prefix));
    const done = rungs.filter(s => s.concepts.length).length;
    return {
      id: prefix,
      en: (prefix==='read' ? 'Reading ladder' : 'Writing ladder'),
      hi: (prefix==='read' ? 'पठन सीढ़ी' : 'लेखन सीढ़ी'),
      n: rungs.length, done, pct: rungs.length ? Math.round(done/rungs.length*100) : 0
    };
  });
}
