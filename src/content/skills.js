/* ==================================================================
   THE SKILL GRAPH

   A teacher tells us Riya got question 2 wrong, and it was a BODMAS
   question. The naive response is to teach her BODMAS. That is usually
   the wrong lesson.

   A child who fails BODMAS has, far more often, not internalised
   multiplication — so they lose track of the order because each step
   costs them too much effort. Teaching BODMAS again does nothing. You
   have to go down.

   So every skill declares what it stands on. When a child fails a
   skill, we walk DOWN the prerequisites, check what the app already
   knows about each one from their own practice, and teach the deepest
   thing they have not mastered. That is the diagnosis, and it is why
   the teacher's thirty seconds of input is worth something.

   `concepts` lists the lesson generator ids that actually teach the
   skill. An empty list is honest: it means we can diagnose that gap
   but cannot yet teach it, and that is the content roadmap.
   ================================================================== */

const SKILLS = [
/* ---------------- Foundational literacy: reading ----------------
   Six levels, not six new ideas — this is exactly the read1-6 ladder
   already shown to a parent on the home and parent-dashboard screens
   (see content/competencies.js / CURRICULUM.md), reused here rather
   than reinvented, so the skill graph and the level a parent already
   sees say the same thing in the same words. Grades follow
   CURRICULUM.md's own mapping: L1 Balvatika, L2-3 Grade 1, L4-5
   Grade 2(-3), L6 Grade 3 exit.

   `concepts:['reading']` is a pseudo-concept — there is no generated
   or hand-written "lesson" for reading the way there is for
   arithmetic (see core/diagnose.js's practiceLoopLesson()). It
   resolves to the real, live read() screen instead of a canned demo.

   content/literacy.js ALSO adds real beat-lesson concepts here, where
   one of its discrete sub-skills teaches the same thing this fluency
   level represents — chosen by what each concept's own beats actually
   do, not by name:
     read1  rhyming                     — pure sound play, no print: phonological awareness
     read2  letters, blending, swar,
            vyanjan, matra, hiblend,
            sanyukt                     — matching a letter/matra/conjunct to its sound, blending sounds into a word
     read3  sightword, hisight          — recognising a whole familiar word
     write2 letters, swar               — the only two literacy concepts whose own
                                           subtitle is "Look, say, TRACE"; vyanjan and
                                           matra ask the child to say the sound, never
                                           to trace it, so they stay reading-only.
   read4-6 and write1/3-6 gain nothing — no literacy.js concept teaches
   fluency, comprehension, pre-writing motor control, or word/sentence/
   paragraph writing yet, and forcing a match would be exactly the kind
   of inflation skillCoverage() is built to refuse. See lessonsForSkill()
   in core/diagnose.js for how a skill with BOTH a pseudo-concept and a
   real concept now returns both; see skillCoverage() below for why
   adding these did not just quietly double-count e1-decode/u-blend/etc.

   strand:'lit' — these are NOT a subject. A child reads and writes in
   whichever language they're using that day; filing the ladder under
   'num' (curriculum-early.js's fallback for anything with no strand) is
   wrong, and filing it under 'eng' or 'hin' is equally wrong, since the
   same six rungs apply either way. curriculum-early.js's coverageMatrix()
   excludes strand:'lit' from the per-grade subject cells entirely and
   reports it as its own two rows instead (see ladderCoverage()) — a
   ladder spanning Balvatika to Class 3 was never a per-grade, per-subject
   cell to begin with, and forcing it into one produced both a stray
   unlabelled grade-0 row and a percentage nobody could reconcile.
   contentQueue() and diagnosis are untouched — these stay real skills
   with real evidence, just not a subject column. */
{id:'read1', g:0, strand:'lit', en:'Phonological Awareness',     hi:'ध्वनि-जागरूकता',        pre:[],        concepts:['reading','rhyming']},
{id:'read2', g:1, strand:'lit', en:'Letter-Sound Decoding',      hi:'अक्षर-ध्वनि पहचान',     pre:['read1'], concepts:['reading','blending','letters','swar','vyanjan','matra','hiblend','sanyukt']},
{id:'read3', g:1, strand:'lit', en:'Word & Sentence Reading',    hi:'शब्द व वाक्य पठन',      pre:['read2'], concepts:['reading','sightword','hisight']},
{id:'read4', g:2, strand:'lit', en:'Reading Fluency',            hi:'धाराप्रवाह पठन',        pre:['read3'], concepts:['reading']},
{id:'read5', g:2, strand:'lit', en:'Reading Comprehension',      hi:'पठन-बोध',               pre:['read4'], concepts:['reading']},
{id:'read6', g:3, strand:'lit', en:'Independent Fluent Reading', hi:'स्वतंत्र सुगम पठन',     pre:['read5'], concepts:['reading']},

/* ---------------- Foundational literacy: writing ---------------- */
{id:'write1', g:0, strand:'lit', en:'Pre-Writing & Fine Motor',     hi:'पूर्व-लेखन कौशल',       pre:[],         concepts:['writing']},
{id:'write2', g:1, strand:'lit', en:'Letter Formation',             hi:'अक्षर लेखन',            pre:['write1'], concepts:['writing','letters','swar']},
{id:'write3', g:1, strand:'lit', en:'Word Writing',                 hi:'शब्द लेखन',             pre:['write2'], concepts:['writing']},
{id:'write4', g:2, strand:'lit', en:'Sentence Copying & Dictation', hi:'वाक्य लेखन व श्रुतलेख', pre:['write3'], concepts:['writing']},
{id:'write5', g:2, strand:'lit', en:'Independent Sentence Writing', hi:'स्वतंत्र वाक्य लेखन',   pre:['write4'], concepts:['writing']},
{id:'write6', g:3, strand:'lit', en:'Short Paragraph Writing',      hi:'लघु अनुच्छेद लेखन',     pre:['write5'], concepts:['writing']},

/* ---------------- Class 1 ---------------- */
{id:'count20',    g:1, en:'Counting to 20',           hi:'20 तक गिनती',        pre:[],                       concepts:['count']},
{id:'compare1',   g:1, en:'More, fewer, equal',       hi:'ज़्यादा, कम, बराबर',  pre:['count20'],              concepts:['compare']},
{id:'add10',      g:1, en:'Adding within 10',         hi:'10 तक जोड़',          pre:['count20'],              concepts:['add','money']},
{id:'sub10',      g:1, en:'Subtracting within 10',    hi:'10 तक घटाव',          pre:['count20'],              concepts:['take']},
{id:'bonds10',    g:1, en:'Number bonds to 10',       hi:'10 की जोड़ियाँ',      pre:['add10'],                concepts:['bond']},
{id:'shapes2d',   g:1, en:'Flat shapes',              hi:'सपाट आकार',           pre:[],                       concepts:[]},

/* ---------------- Class 2 ---------------- */
{id:'place2',     g:2, en:'Tens and ones',            hi:'दहाई और इकाई',        pre:['count20'],              concepts:['group']},
{id:'add2',       g:2, en:'Two-digit addition',       hi:'दो अंकों का जोड़',    pre:['add10','place2'],       concepts:['carry']},
{id:'carry',      g:2, en:'Carrying',                 hi:'हासिल',               pre:['add2','bonds10'],       concepts:['carry']},
{id:'sub2',       g:2, en:'Two-digit subtraction',    hi:'दो अंकों का घटाव',    pre:['sub10','place2'],       concepts:['barsub','spend']},
{id:'borrow',     g:2, en:'Borrowing',                hi:'उधार लेना',           pre:['sub2'],                 concepts:['barsub']},
{id:'skip',       g:2, en:'Skip counting',            hi:'छलाँग गिनती',         pre:['count20'],              concepts:['skip']},
{id:'money2',     g:2, en:'Rupees and paise',         hi:'रुपये और पैसे',       pre:['add2'],                 concepts:['money','spend']},
{id:'time2',      g:2, en:'Telling the hour',         hi:'घंटे देखना',          pre:['count20'],              concepts:[]},

/* ---------------- Class 3 ---------------- */
{id:'place3',     g:3, en:'Hundreds',                 hi:'सैकड़ा',              pre:['place2'],               concepts:['group']},
{id:'tables',     g:3, en:'Times tables',             hi:'पहाड़े',              pre:['skip','add2'],          concepts:['array','table']},
{id:'divshare',   g:3, en:'Division as sharing',      hi:'बाँटकर भाग',          pre:['tables'],               concepts:['share','half']},
{id:'oddeven',    g:3, en:'Odd and even',             hi:'सम और विषम',          pre:['skip'],                 concepts:['oddeven']},
{id:'fracunit',   g:3, en:'Halves and quarters',      hi:'आधा और चौथाई',        pre:['divshare'],             concepts:['frac','half']},
{id:'measure3',   g:3, en:'Length in cm and m',       hi:'सेमी और मीटर',        pre:['skip'],                 concepts:['measure']},
{id:'twostep3',   g:3, en:'Two-step problems',        hi:'दो चरण के सवाल',      pre:['add2','sub2'],          concepts:['twostep']},
{id:'calendar3',  g:3, en:'Months and the calendar', hi:'महीने और कैलेंडर', pre:['count20'], concepts:[]},   // concepts: content/calendar.js
{id:'time3',      g:3, en:'Time to five minutes, and how long', hi:'पाँच-पाँच मिनट में समय, और कितना समय लगा', pre:['time2','skip'], concepts:[]},   // concepts: content/clock.js

/* ---------------- Class 4 ---------------- */
{id:'mult2x1',    g:4, en:'Multiplying by one digit', hi:'एक अंक से गुणा',      pre:['tables','place3'],      concepts:['array','table']},
{id:'divrem',     g:4, en:'Division with remainder',  hi:'शेषफल के साथ भाग',    pre:['divshare'],             concepts:['share']},
{id:'fraceq',     g:4, en:'Equivalent fractions',     hi:'तुल्य भिन्न',         pre:['fracunit','tables'],    concepts:['frac']},
{id:'decimal1',   g:4, en:'Decimals, first look',     hi:'दशमलव, पहली बार',     pre:['place3','fracunit'],    concepts:[]},
{id:'perimeter',  g:4, en:'Perimeter',                hi:'परिमाप',              pre:['measure3','add2'],      concepts:[]},
{id:'angles',     g:4, en:'Angles',                   hi:'कोण',                 pre:['shapes2d'],             concepts:[]},

/* ---------------- Class 5 ---------------- */
{id:'mult2x2',    g:5, en:'Multiplying two digits',   hi:'दो अंकों से गुणा',    pre:['mult2x1','carry'],      concepts:[]},
{id:'longdiv',    g:5, en:'Long division',            hi:'लंबा भाग',            pre:['divrem','mult2x1'],     concepts:[]},
{id:'fracops',    g:5, en:'Adding fractions',         hi:'भिन्न जोड़ना',        pre:['fraceq'],               concepts:[]},
{id:'decimalops', g:5, en:'Decimal arithmetic',       hi:'दशमलव की गणना',       pre:['decimal1','carry'],     concepts:[]},
{id:'area',       g:5, en:'Area',                     hi:'क्षेत्रफल',           pre:['perimeter','mult2x1'],  concepts:[]},
{id:'average',    g:5, en:'Average',                  hi:'औसत',                 pre:['divrem'],               concepts:[]},

/* ---------------- Class 6 ---------------- */
{id:'integers',   g:6, en:'Negative numbers',         hi:'ऋणात्मक संख्याएँ',    pre:['sub2'],                 concepts:[]},
{id:'bodmas',     g:6, en:'Order of operations',      hi:'संक्रियाओं का क्रम',  pre:['mult2x1','divrem','add2','sub2'], concepts:[]},
{id:'ratio',      g:6, en:'Ratio',                    hi:'अनुपात',              pre:['fraceq','divshare'],    concepts:[]},
{id:'percent',    g:6, en:'Percentage',               hi:'प्रतिशत',             pre:['fraceq','decimalops'],  concepts:[]},
{id:'algebra1',   g:6, en:'Letters for numbers',      hi:'अक्षर संख्या के लिए', pre:['bodmas','tables'],      concepts:[]},

/* ---------------- Class 7 ---------------- */
{id:'algexpr',    g:7, en:'Algebraic expressions',    hi:'बीजीय व्यंजक',        pre:['algebra1','integers'],  concepts:[]},
{id:'lineareq',   g:7, en:'Simple equations',         hi:'सरल समीकरण',          pre:['algexpr'],              concepts:[]},
{id:'rational',   g:7, en:'Rational numbers',         hi:'परिमेय संख्याएँ',     pre:['integers','fracops'],   concepts:[]},
{id:'percentapp', g:7, en:'Profit, loss, interest',   hi:'लाभ, हानि, ब्याज',    pre:['percent'],              concepts:[]},
{id:'triarea',    g:7, en:'Area of triangles',        hi:'त्रिभुज का क्षेत्रफल', pre:['area','angles'],       concepts:[]},

/* ---------------- Class 8 ---------------- */
{id:'exponents',  g:8, en:'Powers and exponents',     hi:'घातांक',              pre:['mult2x2'],              concepts:[]},
{id:'factorise',  g:8, en:'Factorisation',            hi:'गुणनखंड',             pre:['algexpr','tables'],     concepts:[]},
{id:'lineareq2',  g:8, en:'Equations both sides',     hi:'दोनों ओर चर',         pre:['lineareq'],             concepts:[]},
{id:'mensuration',g:8, en:'Volume and surface area',  hi:'आयतन और पृष्ठ',       pre:['area','exponents'],     concepts:[]},
{id:'quadril',    g:8, en:'Quadrilaterals',           hi:'चतुर्भुज',            pre:['triarea'],              concepts:[]}
];

const skillById = id => SKILLS.find(s => s.id === id);

/* Everything a skill stands on, all the way down, deepest first.
   Cycle-safe: a malformed graph must not hang a teacher's dashboard. */
function prereqChain(id){
  const out = [], visiting = new Set();
  (function walk(cur){
    if(visiting.has(cur)) return;          // cycle guard
    visiting.add(cur);
    const s = skillById(cur);
    if(!s) return;
    for(const p of s.pre){
      walk(p);
      if(!out.includes(p)) out.push(p);    // deepest first, each once
    }
  })(id);
  return out;
}

/* How much of the graph we can actually teach today, and where the
   content gaps are. Printed by the tests so the roadmap stays honest. */
/* read1-6/write1-6 (the fluency ladder) and the curriculum-early.js
   skills content/literacy.js tags (e.g. e1-decode, u-blend, l-alpha)
   can now describe the SAME underlying competency taught through two
   different content types — a live practice loop and a discrete beat
   lesson. Once literacy.js merges its concepts into read2/write2/etc.
   (see the comment above those entries), that shared competency would
   get counted twice in skillCoverage()'s percentage: once as read2,
   once as e.g. e1-decode, even though a teacher fixing "blending" only
   needs to look at one gap, not two.

   Scoped narrowly: a non-read/write skill is "absorbed" (and dropped
   from both total and taught) only if it shares a concept with a
   read-N or write-N skill specifically — never for two ordinary skills
   sharing a concept (e.g. add10/money2 both touch 'money' but are
   genuinely distinct competencies, not duplicates of each other). An
   absorbed skill is always already-taught (sharing a concept requires
   having one), so this never changes `gaps` — only how many already-
   taught nodes get counted once instead of twice. */
const READWRITE_IDS = new Set(SKILLS.filter(s => /^(read|write)[1-6]$/.test(s.id)).map(s => s.id));

function skillCoverage(){
  const absorbed = new Set();
  for(const rw of SKILLS.filter(s => READWRITE_IDS.has(s.id))){
    for(const other of SKILLS){
      if(other.id === rw.id || READWRITE_IDS.has(other.id)) continue;
      if(other.concepts.some(c => rw.concepts.includes(c))) absorbed.add(other.id);
    }
  }
  const counted = SKILLS.filter(s => !absorbed.has(s.id));
  const total = counted.length;
  const taught = counted.filter(s => s.concepts.length).length;
  const gaps = counted.filter(s => !s.concepts.length).map(s => `${s.g}·${s.id}`);
  return { total, taught, pct: Math.round(taught/total*100), gaps, absorbed: [...absorbed] };
}
