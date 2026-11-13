/* ==================================================================
   THE SCHOOL'S OWN SYLLABUS — Gemini drafts, Takhti checks, the
   teacher approves, the class learns (Tier 2: it loads tomorrow).

   A teacher uploads a chapter in the teacher view (ui/teacher.js). The
   server (api/syllabus.mjs, or the voice server's POST /syllabus) asks
   Gemini for a few lessons in Takhti's own lesson format. Then, on this
   phone, before anyone sees them:

     1. sylClean() keeps only what the lesson player can draw — the beat
        types and their fields, plain text, one emoji — and checks what
        the general checker doesn't know about a school's lesson:
          · a maths question's right answer is a NUMBER, so the
            arithmetic check below can test it;
          · a reading question's right answer is in the passage's own
            words (or it is marked "for the teacher to check");
          · the pictures stay drawable (no 80 dots on screen).
     2. validateLesson() (core/lesson-gen.js) — the same checker every
        generated lesson passes: arithmetic, the age band's number
        ceiling, sentence lengths for the band, both languages.
     3. Anything that fails goes back to Gemini ONCE with the checker's
        reasons (sylDraft → 'repair'), and is checked again. Still
        failing → shown to the teacher as "not used", with why.
     4. The teacher reads each lesson and approves it. Approved lessons
        go into the class mirror (_lessons) and travel with the class
        sync (core/class-sync.js) — and every child's phone runs 1 and 2
        AGAIN before a lesson appears (schoolLessons()), so a lesson
        edited on the way is simply not shown.

   Shapes (content/geometry.js) work the same way: a figure, a corner or a
   numbered row of them, and the question's answer is worked out from the
   drawing itself.

   A child plays them at the Story Fire, under "From your school". Their
   answers count as evidence only for a skill the checker could match.
   ================================================================== */
const SYL_URL = (typeof window !== 'undefined' && window.TAKHTI_SYLLABUS) || (TALK_URL ? TALK_URL + '/syllabus' : '/api/syllabus');

/* What the lesson player can draw, and the fields each beat may carry. */
const SYL_FIELDS = {
  intro:[], count:['n'], add:['a','b'], take:['a','b'], group:['a'], line:['a','b','hops'],
  array:['a','b'], share:['a','b'], bar:['a','b'], frac:['b'],
  passage:['p','art'], word:['w','art'], readline:['text'],
  ask:['q','opts','hiOpts','correct','why'], win:[]
};
const SYL_MATH = ['count','add','take','group','line','array','share','bar','frac'];
const SYL_READ = ['passage','word','readline'];
/* the same listening caps validateLesson() applies, said to Gemini up front */
const SYL_WORDS = { pre:11, early:14, developing:18, fluent:24 };
/* the class a teacher picks → the age band and the grade of its skills */
const SYL_CLASSES = [
  { id:'kg', band:'pre',        g:0, en:'Nursery / KG', hi:'नर्सरी / केजी' },
  { id:'c1', band:'early',      g:1, en:'Class 1',      hi:'कक्षा 1' },
  { id:'c2', band:'developing', g:2, en:'Class 2',      hi:'कक्षा 2' },
  { id:'c3', band:'developing', g:3, en:'Class 3',      hi:'कक्षा 3' },
  { id:'c4', band:'fluent',     g:4, en:'Class 4',      hi:'कक्षा 4' },
  { id:'c5', band:'fluent',     g:5, en:'Class 5',      hi:'कक्षा 5' }
];
const SYL_CHECKED = new Map();   // lesson JSON -> checked lesson | null, this session only

const sylClass = id => SYL_CLASSES.find(c => c.id === id) || SYL_CLASSES[2];
function sylRules(bandId){
  const b = AGE_BANDS[bandId] || AGE_BANDS.developing;
  return { band: b.id, ages: b.ages, maxNumber: b.maxNumber, sayWords: SYL_WORDS[b.id] || 18, read: b.read };
}
/* the skills a lesson for this class may name: its own grade first, then
   the grades around it — a Class 3 shapes chapter practises flat shapes
   (graded Class 1) and square corners and perimeter (Class 4), and its
   answers should count for them */
function sylSkills(cls){
  const near = s => s.g === cls.g ? 0 : s.g === cls.g - 1 ? 1 : s.g === cls.g + 1 ? 2 : 3;
  return SKILLS.filter(s => s.g >= cls.g - 2 && s.g <= cls.g + 1 && s.strand !== 'evs')
    .sort((a, b) => near(a) - near(b)).slice(0, 60).map(s => ({ id: s.id, en: s.en }));
}

/* What a maths picture computes — the number its question must have as the answer. */
function sylExpect(b){
  const v = { count: b.n, add: b.a + b.b, take: b.a - b.b, group: b.a, line: b.a + b.b * (b.hops || 1),
              array: b.a * b.b, share: b.b ? b.a / b.b : null, bar: b.a - b.b, frac: b.b }[b.t];
  return Number.isInteger(v) ? v : null;
}
const sylPlain = s => typeof s === 'string' && !/[<>`{}\\]|https?:|www\.|javascript:/i.test(s);
const sylEmoji = s => typeof s === 'string' && s.length <= 8 && /\p{Extended_Pictographic}/u.test(s) && !/[\p{L}\p{N}]/u.test(s);
function sylHash(o){ return seedOf(JSON.stringify(o)).toString(36); }
/* content words, for "is this answer really in the passage?" */
function sylWords(s){
  return String(s || '').toLowerCase().replace(/[.,!?;:।"“”‘’'()\-—–]/g, ' ').split(/\s+/)
    .filter(w => /\d/.test(w) || w.length >= 3 || (/[ऀ-ॿ]/.test(w) && w.length >= 2));
}
function sylGrounded(answer, text){
  const want = sylWords(answer), have = sylWords(text);
  if(!want.length) return false;
  const hit = w => have.some(h => h === w || (w.length >= 4 && h.length >= 4 && h.slice(0, 4) === w.slice(0, 4)));
  return want.filter(hit).length / want.length >= 0.6;
}

/* Before checking: tidy what a model commonly gets slightly wrong, where
   the fix is certain and the checker still tests the result —
   · a beat repeated twice in a row is kept once;
   · a word beat's word may come as "word" (the drafting schema's name,
     because a rectangle's w is a number);
   · a notes field on a picture is dropped (notes belong on the question);
   · a figure or corner followed by a question but missing what it asks gets
     it from the question's own words ("How many sides?" → sides). If that
     reading is wrong, validateLesson() rejects the answer against the drawing. */
function sylTidy(beats){
  const out = [];
  for(const x0 of beats){
    if(!x0 || typeof x0 !== 'object') { out.push(x0); continue; }
    const x = { ...x0 };
    if(x.t === 'word' && x.w == null && typeof x.word === 'string') x.w = x.word;
    delete x.word;
    if(x.t !== 'ask') delete x.why;
    const prev = out[out.length - 1];
    if(prev && JSON.stringify(prev) === JSON.stringify(x)) continue;
    out.push(x);
  }
  // a size written into a note ("folds 2") instead of its own field
  out.forEach(x => { if(x && (x.t === 'figure' || x.t === 'corner')) { sylSizesFromText(x); delete x.text; } });
  out.forEach((x, i) => {
    const next = out[i + 1];
    if(!x || !next || next.t !== 'ask') return;
    if(x.t === 'corner' && x.ask == null) x.ask = 'kind';
    if(x.t === 'figure' && x.ask == null) x.ask = sylInferAsk(x, next);
    if(x.t === 'figures' && x.find == null) x.find = sylInferFind(next);
  });
  // a rectangle with only one side given: give it the other, half as long
  // (never equal, so it stays a rectangle) — unless the question is its
  // perimeter, where the made-up side would change the answer
  // (a row shows no side labels, so a rectangle in a row gets one too)
  const ok = v => Number.isInteger(v) && v >= 1;
  const fillRect = r => {
    if(!r || r.kind !== 'rectangle') return;
    if(ok(r.w) && !ok(r.h)) r.h = r.w >= 2 ? Math.max(1, Math.round(r.w / 2)) : 2;
    else if(ok(r.h) && !ok(r.w)) r.w = r.h * 2;
  };
  out.forEach(x => {
    if(!x) return;
    if(x.t === 'figure' && x.ask !== 'perimeter') fillRect(x);
    if(x.t === 'figures' && Array.isArray(x.items)) x.items = x.items.map(it => { if(!it || typeof it !== 'object') return it; const c = { ...it }; fillRect(c); return c; });
  });
  return out;
}
/* Only the fields this kind of shape has, and only where they're missing:
   "folds 2" / "2 folds", "6 × 3", "side 4", "sides 3, 4, 5", "60°". */
function sylSizesFromText(x){
  if(typeof x.text !== 'string' || !x.text.trim()) return;
  const t = x.text.toLowerCase().replace(/\s+/g, ' ');
  const one = (...res) => { for(const re of res){ const m = t.match(re); if(m) return Number(m[1]); } return null; };
  const fill = (k, v) => { if(x[k] == null && Number.isInteger(v)) x[k] = v; };
  if(x.t === 'corner') return fill('deg', one(/(\d+)\s*(?:°|deg)/, /(?:deg\w*|angle|कोण)\s*[:=]?\s*(\d+)/));
  if(x.kind === 'circle') fill('folds', one(/(\d+)\s*(?:fold|तह)/, /(?:folds?|fold lines?|तह)\s*[:=]?\s*(\d+)/));
  if(x.kind === 'square') fill('s', one(/sides?\s*[:=]?\s*(\d+)/, /\bs\s*[:=]\s*(\d+)/));
  if(x.kind === 'rectangle'){
    const m = t.match(/(\d+)\s*[×x*]\s*(\d+)/);
    if(m){ fill('w', Number(m[1])); fill('h', Number(m[2])); }
    fill('w', one(/\b(?:w|width)\s*[:=]?\s*(\d+)/)); fill('h', one(/\b(?:h|height)\s*[:=]?\s*(\d+)/));
  }
  if(x.kind === 'triangle' && !Array.isArray(x.sides)){
    const m = t.match(/(\d+)\s*,\s*(\d+)\s*(?:,|and)\s*(\d+)/);
    if(m) x.sides = [m[1], m[2], m[3]].map(Number);
  }
}
/* Which shape a row's question looks for, when it names exactly one;
   a wrong reading fails against the drawing like any other answer. */
function sylInferFind(q){
  const text = [q.q && q.q.en, q.q && q.q.hi].filter(Boolean).join(' ').toLowerCase();
  const right = (q.opts || [])[q.correct];
  if(!/^\d+$/.test(String(right == null ? '' : right).trim())) return undefined;   // a row's answers are its numbers
  if(/odd one|different|doesn.?t belong|not like the others|अलग/.test(text)) return 'odd';
  if(/\bnot\b|नहीं/.test(text)) return undefined;
  if(/square corner|right angle|चौकोर कोन|समकोण/.test(text)) return 'squarecorner';
  const hits = [['triangle', /triangle|त्रिभुज|three sides|3 sides|तीन भुज|3 भुज/], ['rectangle', /rectangle|आयत/],
    ['square', /square|वर्ग/], ['circle', /circle|वृत्त|गोल/]].filter(([, re]) => re.test(text)).map(([k]) => k);
  return hits.length === 1 ? hits[0] : undefined;
}
function sylInferAsk(fig, q){
  const text = [q.q && q.q.en, q.q && q.q.hi].filter(Boolean).join(' ').toLowerCase();
  const right = (q.opts || [])[q.correct], num = /^\d+$/.test(String(right == null ? '' : right).trim());
  if(num && /perimeter|all the way round|around|distance round|परिमाप|चारों ओर/.test(text)) return 'perimeter';
  if(fig.kind === 'circle' && /meet|cross|cent(re|er)|मिल|केंद्र|केन्द्र/.test(text)) return 'meet';
  if(/equal|same length|बराबर/.test(text)) return 'equal';
  if(num && /corner|कोन/.test(text)) return 'corners';
  if(num && /side|भुज/.test(text)) return 'sides';
  if(!num && /shape|which|what is (this|it)|called|आकृति|आकार|कौन|क्या कहते/.test(text)) return 'name';
  return undefined;                                   // can't tell: the checker asks for it
}

/* Shape aims that no question in the lesson checks ("find a shape with 3
   sides" with no row to find it in) — a warning for the teacher, not a
   rejection: an aim is free text, read here by its key words, and an aim
   these words don't cover is left to the teacher's reading. */
function sylAimGaps(les){
  const beats = (les && les.beats) || [];
  if(!beats.some(b => GEO_TYPES.includes(b.t))) return [];
  const asked = new Set();
  beats.forEach((b, i) => {
    if(!beats[i + 1] || beats[i + 1].t !== 'ask') return;
    if(b.t === 'figure' && b.ask) asked.add(b.ask);
    if(b.t === 'corner') asked.add('kind');
    if(b.t === 'figures'){ asked.add('row'); if(b.find === 'squarecorner') asked.add('kind'); }
  });
  const need = en => {
    const t = String(en || '').toLowerCase();
    if(/\bfind|\bpick|\bspot|which one/.test(t)) return ['row'];
    if(/perimeter|distance round|all the way round/.test(t)) return ['perimeter'];
    if(/square corner|right angle/.test(t)) return ['kind'];
    if(/cent(re|er)|fold/.test(t)) return ['meet'];
    if(/corner/.test(t)) return ['corners'];
    if(/side/.test(t) && /equal|same length/.test(t)) return ['equal'];
    if(/side/.test(t)) return ['sides'];
    if(/\bname|recogni[sz]e|identify/.test(t)) return ['name', 'row'];
    return null;
  };
  return (les.aims || []).filter(a => { const n = need(a && a.en); return n && !n.some(k => asked.has(k)); });
}

/* Does a line of narration already say this answer? A number as a whole
   number; words when every content word of the answer is there. */
function sylSaysIt(text, answer){
  if(!text || answer == null) return false;
  const a = String(answer).trim();
  if(/^\d+$/.test(a)) return new RegExp(`(^|[^\\d])${a}([^\\d]|$)`).test(text);
  const stop = /^(the|and|for|with|its|that|this|are|was|का|की|के|है|हैं|में|पर|से|को|और|एक)$/i;
  const want = sylWords(a).filter(w => !stop.test(w)), have = sylWords(text);
  return want.length > 0 && want.every(w => have.some(h => h === w || (w.length >= 4 && h.length >= 4 && h.slice(0, 4) === w.slice(0, 4))));
}

/* One draft (from Gemini, or a lesson that travelled) → a lesson the player
   can run, plus every reason it can't be used. Idempotent on its own output. */
function sylClean(raw, opts){
  opts = opts || {};
  const errs = [], band = AGE_BANDS[opts.band] ? opts.band : (AGE_BANDS[raw && raw.band] ? raw.band : 'developing');
  const bi = (o, where, max) => {
    if(!o || typeof o.en !== 'string' || typeof o.hi !== 'string' || !o.en.trim() || !o.hi.trim()){ errs.push(`${where} needs English and Hindi`); return null; }
    if(!sylPlain(o.en) || !sylPlain(o.hi)){ errs.push(`${where} has markup or a link in it`); return null; }
    if(o.en.length > max || o.hi.length > max){ errs.push(`${where} is too long`); return null; }
    if(!/[ऀ-ॿ]/.test(o.hi)) errs.push(`${where}: the Hindi isn't in Devanagari`);
    return { en: o.en.trim(), hi: o.hi.trim() };
  };
  raw = raw && typeof raw === 'object' ? raw : {};
  const skills = opts.skills || null;
  const skillId = typeof (raw.skill || raw.skillId) === 'string' && skillById(raw.skill || raw.skillId)
    && (!skills || skills.some(s => s.id === (raw.skill || raw.skillId))) ? (raw.skill || raw.skillId) : undefined;
  const les = {
    band, school: true, ic: sylEmoji(raw.ic) ? raw.ic : '📘',
    title: bi(raw.title, 'the title', 60), sub: bi(raw.sub, 'the subtitle', 80),
    skillId, source: sylPlain(raw.source) ? String(raw.source).slice(0, 120) : '',
    // what the child will be able to do — what the teacher approves
    aims: (Array.isArray(raw.aims) ? raw.aims.slice(0, 4) : []).map((a, k) => bi(a, `aim ${k + 1}`, 140)).filter(Boolean),
    beats: []
  };
  if(!les.aims.length) errs.push('the lesson needs its aims — 1 to 4 things the child will be able to do');
  const beats = sylTidy(Array.isArray(raw.beats) ? raw.beats.slice(0, 12) : []);
  if(beats.length > 10) errs.push('more than 10 beats — keep a lesson short');
  let lastShown = null, shown = null, readText = '', lead = [], taught = false, asked = false;   // lead: what Munni said since the last question
  const checks = [];

  beats.forEach((x, i) => {
    x = x && typeof x === 'object' ? x : {};
    const t = x.t;
    // a shape (content/geometry.js): only what can be drawn; validateLesson()
    // then checks the question after it against the answer read off the drawing
    if(GEO_TYPES.includes(t)){
      const g = geoClean(x);
      g.errors.forEach(e => errs.push(`beat ${i}: ${e}`));
      if(x.say){ const s = bi(x.say, `beat ${i}'s narration`, 200); if(s) g.beat.say = s; }
      // a teaching circle that talks about its folds must draw them (the fourth
      // live run: "the point where fold lines meet is the centre" over a plain circle)
      if(g.beat.kind === 'circle' && g.beat.ask == null && g.beat.say && !(g.beat.folds >= 2)
         && /fold|meet|cent(re|er)|तह|मिल|केंद्र|केन्द्र/i.test(g.beat.say.en + ' ' + g.beat.say.hi))
        errs.push(`beat ${i}: the picture doesn't show the folds its narration talks about — give the circle folds: 2 or more`);
      // remember whether this picture teaches or is a question's picture
      if(g.beat.say) lead.push({ ...g.beat.say, pic: t !== 'figures' && g.beat.ask == null ? 'teach' : 'question' });
      les.beats.push(g.beat); lastShown = t; shown = g.beat;
      if(t !== 'figures' && g.beat.ask == null) taught = true;           // a teaching picture
      return;
    }
    const fields = SYL_FIELDS[t];
    if(!fields){ errs.push(`beat ${i}: Takhti can't show a "${t}" beat`); return; }
    const out = { t };
    if(x.say) { const s = bi(x.say, `beat ${i}'s narration`, 200); if(s) out.say = s; }
    for(const k of fields){
      const v = x[k];
      if(v == null) continue;
      if(['a','b','n','hops','correct'].includes(k)){
        if(!Number.isInteger(v) || v < 0){ errs.push(`beat ${i}: ${k} must be a whole number`); continue; }
        out[k] = v;
      } else if(k === 'why'){
        const s = bi(v, `beat ${i}'s note for the teacher`, 220); if(s) out.why = s;   // never shown to a child
      } else if(k === 'p' || k === 'q'){
        const s = bi(v, k === 'p' ? `beat ${i}'s passage` : `beat ${i}'s question`, k === 'p' ? 500 : 160); if(s) out[k] = s;
      } else if(k === 'art'){
        if(sylEmoji(v)) out.art = v;
      } else if(k === 'w' && t === 'word' && typeof v !== 'string'){
        errs.push(`beat ${i}: the word must be short plain text`);
      } else if(k === 'w' || k === 'text'){
        if(typeof v === 'string' && sylPlain(v) && v.trim() && v.length <= (k === 'w' ? 24 : 140)) out[k] = v.trim();
        else errs.push(`beat ${i}: ${k === 'w' ? 'the word' : 'the line'} must be short plain text`);
      } else if(k === 'opts' || k === 'hiOpts'){
        if(!Array.isArray(v) || !v.every(o => typeof o === 'string' && sylPlain(o) && o.trim() && o.length <= 40)) errs.push(`beat ${i}: answers must be short plain text`);
        else out[k] = v.map(o => o.trim());
      }
    }
    // drawable pictures
    const lim = { count:{ n:20 }, add:{ a:10, b:10 }, take:{ a:20 }, group:{ a:99 }, line:{ a:50, b:10, hops:10 },
                  array:{ a:10, b:10 }, share:{ a:40, b:6 }, bar:{ a:100 }, frac:{ b:8 } }[t] || {};
    for(const [k, max] of Object.entries(lim)){
      if(out[k] == null) errs.push(`beat ${i}: "${t}" needs ${k}`);
      else if(out[k] > max) errs.push(`beat ${i}: ${k}=${out[k]} is too many to draw (at most ${max})`);
    }
    if(t === 'take' && out.b > out.a) errs.push(`beat ${i}: can't take away more than there are`);
    if(t === 'bar' && out.b > out.a) errs.push(`beat ${i}: the known part is bigger than the whole`);
    if(t === 'share' && (!out.b || out.a % out.b)) errs.push(`beat ${i}: ${out.a} doesn't share equally between ${out.b}`);
    if(t === 'frac' && out.b < 2) errs.push(`beat ${i}: a fraction needs at least 2 parts`);
    if(t === 'line' && out.hops == null) out.hops = 1;
    if(t === 'passage' && !out.p) errs.push(`beat ${i}: a passage needs its text`);

    if(t === 'ask'){
      const opts = out.opts || [], hiOpts = out.hiOpts || [];
      if(opts.length !== 2) errs.push(`beat ${i}: a question needs exactly 2 answers`);
      if(hiOpts.some(o => !/^\d+$/.test(o) && !/[ऀ-ॿ]/.test(o))) errs.push(`beat ${i}: the Hindi answers must be in Devanagari (Yes/No → हाँ/नहीं)`);
      if(!asked && !taught) errs.push(`beat ${i}: teach before you ask — put a teaching picture, a worked example or a passage before the first question`);
      asked = true;
      const right = opts[out.correct];
      if(lastShown && SYL_MATH.includes(lastShown)){
        // a maths question: not "derived", so validateLesson() tests the arithmetic
        if(!/^\d+$/.test(String(right))) errs.push(`beat ${i}: a maths question's right answer must be a number`);
        else if(sylExpect(shown) != null && Number(right) !== sylExpect(shown))
          errs.push(`beat ${i}: marked ${right} right, but the picture before it shows ${sylExpect(shown)}`);
        checks.push('sum');
      } else if(lastShown && GEO_TYPES.includes(lastShown)){
        checks.push('shape');                          // validateLesson() reads the answer off the drawing
        // "Are all sides equal in this square?" — the question mustn't name the shape it asks about;
        // nor "How many sides does this triangle have?" — the name gives the count, so nobody counts
        if(shown && shown.t === 'figure' && ['name', 'equal', 'sides', 'corners'].includes(shown.ask) && GEO_WORDS[shown.kind]
           && out.q && GEO_WORDS[shown.kind].some(r => r.test(out.q.en) || r.test(out.q.hi)))
          errs.push(`beat ${i}: the question names the shape it asks about — let the child work it out`);
      } else if(lastShown && SYL_READ.includes(lastShown)){
        out.derived = true;
        const grounded = right != null && (sylGrounded(right, readText) || sylGrounded(hiOpts[out.correct], readText));
        const yesNo = opts.every(o => /^(yes|no)$/i.test(o));
        if(!grounded && !yesNo) errs.push(`beat ${i}: the right answer "${right}" isn't in the passage`);
        checks.push(grounded ? 'text' : 'teacher');
      } else {
        errs.push(`beat ${i}: a question must come after something to look at or read`);
      }
      // the child works the answer out: Munni mustn't have just said it. For a
      // shape question that is everything said since the last question — the
      // intro too — except that a teaching picture may name the idea it
      // teaches ("this is the centre") when the answer is a word; a number
      // said there ("it has 4 sides") still gives a count away
      const geoQ = lastShown && GEO_TYPES.includes(lastShown);
      const said = geoQ ? lead.filter(s => s.pic !== 'teach' || /^\d+$/.test(String(right))) : lead;
      if(right != null && !opts.every(o => /^(yes|no)$/i.test(o)) && said.some(s => sylSaysIt(s.en, right) || sylSaysIt(s.hi, hiOpts[out.correct])))
        errs.push(`beat ${i}: the lines just before this question say the answer "${right}" — let the child work it out`);
      lead = [];
    } else if(t !== 'intro' && t !== 'win'){
      lastShown = t; shown = out;
      if(SYL_READ.includes(t)) readText = [out.p && out.p.en, out.p && out.p.hi, out.w, out.text].filter(Boolean).join(' ');
    }
    if(t !== 'ask' && out.say) lead.push({ ...out.say });
    if(t !== 'ask' && t !== 'intro' && t !== 'win') taught = true;          // a worked example or a passage
    les.beats.push(out);
  });

  if(les.beats.length && les.beats[les.beats.length - 1].t !== 'win')
    les.beats.push({ t:'win', say:{ en:'Well done. You learnt it today.', hi:'शाबाश! आज तुमने यह सीख लिया।' } });
  les.subject = les.beats.some(b => SYL_MATH.includes(b.t) || GEO_TYPES.includes(b.t)) ? 'math' : 'read';
  // the right answer isn't always first: a stable shuffle, by the lesson's own content
  const id = 'sch-' + sylHash({ t: les.title, s: les.sub, k: les.skillId, a: les.aims, b: les.beats.map(b => ({ ...b, correct: undefined, hiOpts: undefined,
    opts: b.opts && b.opts.slice().sort(), right: b.opts ? b.opts[b.correct] : undefined, hiRight: b.hiOpts ? b.hiOpts[b.correct] : undefined })) });
  les.beats.forEach((b, i) => {
    if(b.t === 'ask' && b.opts && b.hiOpts && b.opts.length === 2 && b.hiOpts.length === 2 && Number.isInteger(b.correct) && b.correct < 2 && (seedOf(id + i) & 1) !== b.correct){
      b.opts = [b.opts[1], b.opts[0]]; b.hiOpts = [b.hiOpts[1], b.hiOpts[0]]; b.correct = 1 - b.correct;
    }
  });
  les.id = id;
  const v = validateLesson(les);
  const errors = errs.concat(v.errors);
  return { lesson: les, ok: errors.length === 0, errors, checks };
}

/* Ask the server for drafts, check them, send the failures back once. */
async function sylDraft(input){
  const cls = sylClass(input.cls), rules = sylRules(cls.band), skills = sylSkills(cls);
  const post = async body => {
    const res = await fetch(SYL_URL, { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ...body, rules, schoolKey: S.ctx.sylKey || undefined }) });
    const d = await res.json().catch(() => ({}));
    if(!res.ok) throw Object.assign(new Error(d.error || ('HTTP ' + res.status)), { status: res.status, maxMb: d.maxMb });
    return d;
  };
  const d = await post({ mode:'draft', chapter: input.chapter, count: input.count, skills, note: input.note });
  const raws = Array.isArray(d.lessons) ? d.lessons : [];
  let drafts = raws.map(raw => ({ raw, ...sylClean(raw, { band: cls.band, skills }) }));
  const failed = drafts.filter(x => !x.ok);
  log(2, `Syllabus · Gemini (${d.model || '?'}) drafted ${raws.length} lesson(s) from "${d.chapter || 'the chapter'}" · ${drafts.length - failed.length} passed Takhti's checker`);
  if(failed.length){
    try{
      const r = await post({ mode:'repair', repair: failed.map(x => ({ lesson: x.raw, errors: x.errors.slice(0, 8) })) });
      (r.lessons || []).forEach((raw, k) => {
        const again = sylClean(raw, { band: cls.band, skills }), at = drafts.indexOf(failed[k]);
        if(at < 0) return;
        // a "fix" that came back exactly as sent is said so, not counted as a second try
        const same = JSON.stringify(sylTidy(raw.beats || [])) === JSON.stringify(sylTidy(failed[k].raw.beats || []));
        drafts[at] = again.ok ? { raw, ...again, repaired: true } : { ...drafts[at], repairErrors: again.errors, unchanged: same };
      });
      log(2, `Syllabus · ${failed.length} sent back to Gemini with the checker's reasons · ${drafts.filter(x => x.repaired).length} fixed and passed${drafts.some(x => x.unchanged) ? ` · ${drafts.filter(x => x.unchanged).length} came back unchanged` : ''}`);
    }catch(e){ log(2, `Syllabus · repair round not reached (${e.message}) — the failures stay unused`); }
  }
  return { chapter: d.chapter || '', model: d.model || '', cls: cls.id, drafts };
}

/* Approved lessons live in the class mirror, newest-wins with `at`, and
   travel with the class sync like the homework does. */
function sylApproved(code){ const x = readClassShared(code)._lessons; return x && Array.isArray(x.items) ? x.items : []; }
function sylSave(code, items){
  classMirrorUpdate(code, all => { all._lessons = { items: items.slice(-12), at: Date.now() }; });
}

/* What this child's class has, each lesson checked again on this phone. */
function schoolLessons(){
  if(!S.classCode) return [];
  const out = [];
  for(const les of sylApproved(S.classCode)){
    const k = JSON.stringify(les);
    if(!SYL_CHECKED.has(k)){
      const c = sylClean(les, { band: les.band });
      // a lesson that changed on the way gets a different id — not shown
      SYL_CHECKED.set(k, c.ok && c.lesson.id === les.id ? c.lesson : null);
      if(!SYL_CHECKED.get(k)) log(0, `Syllabus · a school lesson failed this phone's check and is not shown`);
    }
    if(SYL_CHECKED.get(k)) out.push(SYL_CHECKED.get(k));
  }
  return out;
}

/* Read a chosen file as base64 (a PDF or a photo of the page). */
function sylReadFile(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('could not read the file'));
    r.readAsDataURL(file);
  });
}
