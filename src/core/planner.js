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
       topic, switched when it doesn't stick): for shapes, pictures first
       (the built-in drawn lessons) or straight into the school's own
       story lesson;
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
    if(mindDomain(skill) === 'shape'){
      const pic = planBuiltin(skill, ch);
      way = mindChoose(skill, pic ? ['show', 'story'] : ['story'], ch);
      if(way === 'show' && pic) steps.push({ k: 'show', skill, lesson: pic, done: done(pic),
        label: { en: 'Pictures first', hi: 'पहले चित्र' }, why: planWhyWay(skill, 'show', ch) });
    }
  }
  steps.push({ k: 'school', lesson: les.id, done: done(les.id),
    label: knows ? { en: 'Show you know it', hi: 'दिखाओ कि तुम्हें आता है' } : { en: 'The school’s lesson', hi: 'स्कूल का पाठ' },
    why: knows ? { en: 'you already know this well', hi: 'यह तुम्हें अच्छे से आता है' }
         : way === 'story' ? planWhyWay(skill, 'story', ch) : { en: 'what your class is learning this week', hi: 'इस हफ़्ते तुम्हारी कक्षा यही सीख रही है' } });
  const unit = typeof teachUnitFor === 'function' ? teachUnitFor(les, ch) : null;
  if(unit){
    const taught = Object.values((typeof teachOf === 'function' ? teachOf(ch) : { units: {} }).units).some(u => u.lessonId === les.id);
    steps.push({ k: 'teach', lesson: les.id, done: taught, label: { en: 'Teach Munni', hi: 'मुन्नी को सिखाओ' },
      why: { en: 'Munni forgets — you explain it back', hi: 'मुन्नी भूल जाती है — तुम उसे समझाओ' } });
  }
  return { lesson: les.id, skill, knows, way, steps, next: steps.find(s => !s.done) || null };
}

/* How a lesson being opened counts as teaching (core/mind.js): a built-in
   shape lesson is "pictures first"; a school lesson is "the school's story",
   unless this child's plan had pictures first — then it is the check that
   tells whether the pictures worked, and labels nothing. */
function planMarkWay(les, skill, c){
  if(mindDomain(skill) !== 'shape') return 'story';
  if(!les.school) return 'show';
  const p = planFor(les, c);
  return p && p.way === 'show' ? null : 'story';
}
