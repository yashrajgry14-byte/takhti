/* ==================================================================
   THIS WEEK'S SCHOOL LESSONS, THIS CHILD'S WAY

   A teacher approves a lesson's aims once, for the whole class
   (core/syllabus.js). Every child then gets their own path to those
   aims, worked out on this phone from what Takhti already knows about
   them — nothing new is measured here, nothing leaves the phone:

     · already knows it (the twin's mastery, core/twin.js) → show it in
       the school's lesson, then teach Munni;
     · a gap underneath (a prerequisite the twin has seen go wrong) →
       that first, with a built-in lesson;
     · the way to teach it (the mind, core/mind.js — measured, topic by
       topic, switched when it doesn't stick):
         shapes  — pictures first (a built-in drawn lesson), or straight
                   into the school's own story lesson;
         maths   — the Picture Hut's cartoon for the skill first, or
                   straight into the school's story;
         reading — inside the school's lesson itself: Munni reads the
                   passage first, its hard words in pieces, or the child
                   reads it alone first;
     · the school's lesson — the teacher's chapter, the same for every
       child — whose answers tell the mind whether the way worked;
     · Teach Munni on the aims the teacher approved.

   Two children in one class, the same approved aims, two different
   paths: that is the point. A step's status is read from what is
   already kept (S.doneLessons, S.teach) — the plan adds no state of its
   own, so it can never disagree with what the child really did.
   ================================================================== */

const PLAN_KNOWS = 0.85;        // the twin's mastery at or above this, with
const PLAN_KNOWS_N = 4;         // at least this many own answers: "knows it"
const PLAN_GAP = 0.5;           // a prerequisite below this, with
const PLAN_GAP_N = 3;           // at least this many own answers: "a gap"

/* A built-in lesson for a skill (never a school lesson): a picture lesson for shapes. */
function planBuiltin(skill, c){
  const l = (typeof lessonsForSkill === 'function' ? lessonsForSkill(skill, c || S) : []).find(x => x && x.id && !x.screen && !x.school);
  return l ? l.id : null;
}

/* Does the Picture Hut have this skill's cartoon for this child's band? */
function planHasCartoon(skill, c){
  try{ return typeof getVideoCatalog === 'function' && getVideoCatalog(c || S).some(v => v.skillId === skill); }catch(e){ return false; }
}
/* A cartoon step is done once the child has watched it for this round: the
   episode's card earned, or the mind's round for it still open. */
function planCartoonDone(skill, c){
  const ch = c || S, m = mindOf(ch), p = m.pending[skill];
  return (ch.cards || []).some(k => k.id === `card-vid-${skill}`) || !!(p && p.way === 'cartoon');
}
const PLAN_READ_LABEL = {
  model:  { en: 'Munni reads it first', hi: 'मुन्नी पहले पढ़ेगी' },
  chunks: { en: 'Hard words in pieces', hi: 'कठिन शब्द टुकड़ों में' },
  solo:   { en: 'You read it first',    hi: 'पहले तुम पढ़ो' }
};

/* Why this way, in words a parent understands — from this child's own record. */
function planWhyWay(skill, way, c){
  const m = mindOf(c), own = (m.arms[skill] || {})[way], subj = mindSubject(mindDomain(skill), c)[way];
  if(own && own.a > 0) return { en: 'this has worked for you on this topic', hi: 'इस विषय में यह तरीक़ा तुम्हारे लिए काम आया है' };
  if(subj && subj.a > 0) return { en: 'this has worked for you before', hi: 'यह तरीक़ा पहले तुम्हारे लिए काम आया है' };
  const ch = (m.changes || []).find(x => x.skill === skill && x.to === way);
  if(ch) return { en: 'the other way didn’t stick, so Munni is trying this', hi: 'दूसरा तरीक़ा नहीं जमा, इसलिए मुन्नी यह आज़मा रही है' };
  return { en: 'let’s see if this works for you', hi: 'देखते हैं यह तुम्हारे लिए कैसा रहता है' };
}

/* The path for one school lesson. */
function planFor(les, c){
  const ch = c || S;
  if(!les || !les.id) return null;
  const skill = les.skillId || null, steps = [];
  const done = id => (ch.doneLessons || []).includes(id);
  const k = skill && typeof twinMastery === 'function' ? twinMastery(skill, ch) : null;
  const knows = !!(k && k.n >= PLAN_KNOWS_N && k.now >= PLAN_KNOWS);
  let way = null;

  if(skill && !knows){
    // a gap underneath comes first
    const s = typeof skillById === 'function' ? skillById(skill) : null;
    for(const pre of (s && s.pre) || []){
      const pm = typeof twinMastery === 'function' ? twinMastery(pre, ch) : null, id = pm && pm.n >= PLAN_GAP_N && pm.now < PLAN_GAP ? planBuiltin(pre, ch) : null;
      if(id){
        const ps = skillById(pre);
        steps.push({ k: 'gap', skill: pre, lesson: id, done: done(id),
          label: { en: ps ? ps.en : pre, hi: ps ? ps.hi : pre },
          why: { en: 'it comes underneath this, and it hasn’t settled yet', hi: 'यह इसके नीचे आता है, और अभी पक्का नहीं हुआ' } });
        break;
      }
    }
    // the way to teach it
    const dom = mindDomain(skill);
    if(dom === 'shape'){
      const pic = planBuiltin(skill, ch);
      way = mindChoose(skill, pic ? ['show', 'story'] : ['story'], ch);
      if(way === 'show' && pic) steps.push({ k: 'show', skill, lesson: pic, done: done(pic),
        label: { en: 'Pictures first', hi: 'पहले चित्र' }, why: planWhyWay(skill, 'show', ch) });
    } else if(dom === 'math'){
      // the cartoon or the school's story; "show" and "steps" stay in Counting
      // Stones, where they teach a missed sum
      way = mindChoose(skill, planHasCartoon(skill, ch) ? ['cartoon', 'story'] : ['story'], ch);
      if(way === 'cartoon') steps.push({ k: 'cartoon', skill, done: planCartoonDone(skill, ch),
        label: { en: 'The cartoon first', hi: 'पहले कार्टून' }, why: planWhyWay(skill, 'cartoon', ch) });
    } else if(dom === 'read'){
      // the way lives inside the school's lesson: how its passage is read
      way = mindChoose(skill, ['model', 'chunks', 'solo'], ch);
    }
  }
  const readWay = PLAN_READ_LABEL[way] ? way : null;
  steps.push({ k: 'school', lesson: les.id, done: done(les.id), readWay,
    label: knows ? { en: 'Show you know it', hi: 'दिखाओ कि तुम्हें आता है' }
         : readWay ? { en: 'The school’s lesson — ' + PLAN_READ_LABEL[readWay].en.toLowerCase(), hi: 'स्कूल का पाठ — ' + PLAN_READ_LABEL[readWay].hi }
         : { en: 'The school’s lesson', hi: 'स्कूल का पाठ' },
    why: knows ? { en: 'you already know this well', hi: 'यह तुम्हें अच्छे से आता है' }
         : way === 'story' || readWay ? planWhyWay(skill, way, ch) : { en: 'what your class is learning this week', hi: 'इस हफ़्ते तुम्हारी कक्षा यही सीख रही है' } });
  const unit = typeof teachUnitFor === 'function' ? teachUnitFor(les, ch) : null;
  if(unit){
    const taught = Object.values((typeof teachOf === 'function' ? teachOf(ch) : { units: {} }).units).some(u => u.lessonId === les.id);
    steps.push({ k: 'teach', lesson: les.id, done: taught, label: { en: 'Teach Munni', hi: 'मुन्नी को सिखाओ' },
      why: { en: 'Munni forgets — you explain it back', hi: 'मुन्नी भूल जाती है — तुम उसे समझाओ' } });
  }
  // the next step comes after the last one done: a step skipped on the way
  // (the child opened the school's lesson straight away) doesn't come back
  let last = -1; steps.forEach((s, i) => { if(s.done) last = i; });
  return { lesson: les.id, skill, knows, way, steps, next: steps.find((s, i) => i > last && !s.done) || null };
}

/* What the teacher sees of this child's path, per school lesson — ids and
   short codes only, under the parent's sync consent (S.syncOn), with the
   Teach Munni points: the way (pictures, the story, the cartoon, a reading
   way), "already knew it", the skill underneath taken first, and steps done
   of the whole. Never what was said or read, never the mind itself. */
function planPathOf(les, c){
  const p = planFor(les, c);
  if(!p) return null;
  const gap = p.steps.find(s => s.k === 'gap');
  return { w: p.way || '', ...(p.knows ? { k: 1 } : {}), ...(gap ? { g: gap.skill } : {}),
    d: p.steps.filter(s => s.done).length, n: p.steps.length };
}
function planPathsOf(c){
  const ch = c || S, paths = {};
  try{
    for(const les of (typeof schoolLessons === 'function' ? schoolLessons(ch) : []).slice(0, 12)){ const x = planPathOf(les, ch); if(x) paths[les.id] = x; }
  }catch(e){ /* a path is a bonus for the teacher, never a dependency */ }
  return Object.keys(paths).length ? { paths } : {};
}

/* How a lesson being opened counts as teaching (core/mind.js):
   · a built-in shape lesson is "pictures first";
   · a school reading lesson is taught the plan's reading way, inside it;
   · any other school lesson is "the school's story" — unless this child's
     plan taught it another way first (pictures, the cartoon): then the
     school's lesson is the check that tells whether that way worked, and
     labels nothing. */
function planMarkWay(les, skill, c){
  const dom = mindDomain(skill);
  if(!les.school) return dom === 'shape' ? 'show' : 'story';
  if(skill !== les.skillId) return 'story';            // the plan's way is for the lesson's own skill
  const p = planFor(les, c);
  if(dom === 'read') return p && p.way ? p.way : null;
  return p && p.way && p.way !== 'story' ? null : 'story';
}
