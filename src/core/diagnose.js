/* ==================================================================
   DIAGNOSIS

   Input: the teacher marks which questions a child got wrong, and each
   question carries a skill tag. Thirty seconds for a whole class.

   Output: an ordered plan of what to teach, deepest gap first.

   The interesting part is what happens between. Rohit fails an algebra
   question. We do not queue an algebra lesson. We walk down what
   algebra stands on — order of operations, which stands on times
   tables — and check each one against what the app already knows from
   his own practice. If his multiplication accuracy is 55%, that is the
   real gap, and everything above it will keep failing until it is
   fixed.

   Two sources of evidence, and they disagree usefully:
     · the teacher's test  — one moment, high stakes, sparse
     · the app's own data  — hundreds of attempts, low stakes, dense
   When the test says "failed" and the app says "mastered", that is
   usually nerves or a careless slip, not a gap — and the plan says so
   rather than making the child redo something they can already do.
   ================================================================== */

const DIAG_MASTERED = 0.8;      // app accuracy at or above this = solid
const DIAG_SHAKY    = 0.6;      // below this = a real gap

/* concept id -> [skillId, ...] that lists it in `concepts`. Built once here
   at load, not searched per attempt — a lesson checkpoint fires often, and
   SKILLS.length * avg(concepts) is small but there is no reason to pay it
   every answer. A concept can teach more than one skill (e.g. the generated
   'carry' concept feeds both 'add2' and 'carry' — the earlier and later
   steps of the same idea), so every call site notes ALL of them, not just
   the first match. Hand-written lessons in content/lessons.js carry no
   `.concept` field and their ids never coincide with a concept key, so they
   simply contribute no skill evidence — same honesty as an empty
   `concepts` array on a skill: a gap we cannot act on yet, not a bug. */
const CONCEPT_SKILLS = (() => {
  const map = {};
  for(const s of SKILLS) for(const c of s.concepts) (map[c] = map[c] || []).push(s.id);
  return map;
})();

/* Called wherever a lesson checkpoint resolves. Resolves the lesson's
   concept to every skill it feeds and records one attempt against each. */
function noteSkillFromConcept(concept, ok, child){
  const ids = CONCEPT_SKILLS[concept];
  if(!ids) return;
  for(const id of ids) noteSkillAttempt(id, ok, child);
}

/* What the app itself knows about a child on one skill.
   Returns null when we simply have not seen enough to judge — which is
   different from "weak", and must not be treated as weak. */
function appEvidence(skillId, child){
  const c = child || S;
  const hist = (c.skillHistory || {})[skillId];
  if(!hist || hist.n < 4) return null;
  return { acc: hist.right / hist.n, n: hist.n };
}

/* Record an attempt against a skill. Called when a lesson checkpoint is
   answered, so the app accumulates its own evidence continuously. */
function noteSkillAttempt(skillId, ok, child){
  const c = child || S;
  c.skillHistory = c.skillHistory || {};
  const h = c.skillHistory[skillId] || { n:0, right:0 };
  h.n++; if(ok) h.right++;
  c.skillHistory[skillId] = h;
  mirrorToClass(c);   // if this child is linked to a class, the teacher side should eventually see this
}

/* ==================================================================
   THE CLASS BRIDGE — child app side

   The teacher app and the child app share no server. They meet at one
   place: a single localStorage key per class code, `takhti-class-<code>`,
   holding { [childId]: {childName, skillHistory} } for every child on
   this device that has that code entered. A parent enters the code once
   (see ui/handlers.js `setClassCode`, ui/views.js parent()); from then on
   every checkpoint keeps that child's slice of the blob current.

   localStorage access is wrapped exactly like core/store.js's own — a
   locked-down webview or a Node test host without it must never make a
   lesson checkpoint throw. Mirroring is a bonus, never a dependency.
   ================================================================== */
function classMirrorKey(code){ return 'takhti-class-' + code; }

/* The actual write, unconditional and synchronous — factored out from the
   debounce below so a test (or a caller that already knows it is the last
   write for a while, e.g. right before the app backgrounds) can force it
   immediately instead of waiting out the debounce window. */
function mirrorToClassNow(child){
  const c = child || S;
  if(!c || !c.classCode || !c.id) return;
  try{
    const key = classMirrorKey(c.classCode);
    const raw = localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};
    all[c.id] = { childName: c.name, skillHistory: c.skillHistory || {} };
    localStorage.setItem(key, JSON.stringify(all));
  }catch(e){ /* mirroring is a bonus, never a dependency */ }
}

let _classMirrorTimer = null, _classMirrorPending = null;
/* Debounced: a lesson can fire several checkpoints in quick succession,
   and there is no reason to hit localStorage on every single one. */
function mirrorToClass(child){
  const c = child || S;
  if(!c || !c.classCode || !c.id) return;
  _classMirrorPending = c;
  clearTimeout(_classMirrorTimer);
  _classMirrorTimer = setTimeout(() => {
    mirrorToClassNow(_classMirrorPending);
    _classMirrorPending = null;
  }, 800);
}
/* Force any pending debounced write out immediately. */
function flushClassMirror(){
  if(!_classMirrorPending) return;
  clearTimeout(_classMirrorTimer);
  mirrorToClassNow(_classMirrorPending);
  _classMirrorPending = null;
}

/* ---- reading/writing practice loops, as pseudo-lessons ----
   lessonBank() is exclusively the "Learn with a story" arithmetic feature
   (see lesson-gen.js) — there is no generated or hand-written "lesson"
   object for reading or writing, because those two practice loops are not
   story-shaped: read()/write() in ui/views.js pick straight from
   SENTENCES/GLYPHS every time a child opens the screen, already levelled
   1-6 by ageSentences()/GLYPHS themselves. Marking every read/write skill
   an untaught content gap would be dishonest the other way — there IS
   real, live practice to point at, it is just not a "lesson" object.

   So a read/write skill resolves to a pseudo-lesson: a pointer at the
   real screen, at the level the CHILD is actually at right now — not the
   specific skill being diagnosed, because that screen has no way to open
   independently at a level other than the child's own current one. */
const PRACTICE_LOOP_SCREEN = { reading:'read', writing:'write' };
function practiceLoopLesson(concept, child){
  const screen = PRACTICE_LOOP_SCREEN[concept];
  if(!screen) return null;
  const c = child || S;
  const level = (c.levels && c.levels[screen]) || 1;
  return {
    id: `practiceloop-${screen}`,
    concept,
    screen,           // the real screen this points at — go(screen) in ui/views.js
    level,            // the child's own current level there, not a fixed lesson level
    ic: screen==='read' ? '📖' : '✍️',
    title: screen==='read'
      ? { en:'Read aloud practice', hi:'ज़ोर से पढ़ने का अभ्यास' }
      : { en:'Writing practice',    hi:'लिखने का अभ्यास' },
    sub: { en:`Currently level ${level}`, hi:`अभी स्तर ${level}` }
  };
}

/* Lessons that teach a skill, filtered to what this child should meet. */
function lessonsForSkill(skillId, child){
  const s = skillById(skillId);
  if(!s || !s.concepts.length) return [];

  // A skill like read2 now carries BOTH a practice-loop pseudo-concept
  // ('reading', which points at the live read() screen) and real,
  // beat-taught concepts ('blending', 'letters', ...). Both are real
  // content and both must come back — a gap at read2 should surface the
  // live practice screen AND the specific letter-sound lessons, not
  // whichever kind happened to be checked first.
  const loops = [];
  const bankConcepts = [];
  for(const concept of s.concepts){
    const loop = practiceLoopLesson(concept, child);
    if(loop) loops.push(loop);
    else bankConcepts.push(concept);
  }

  let bankLessons = [];
  if(bankConcepts.length){
    const bandId = (typeof band === 'function') ? band().id : 'developing';
    const bank = (typeof lessonBank === 'function') ? lessonBank() : [];
    const hit = bank.filter(l => bankConcepts.includes(l.concept || l.id));
    // prefer the child's own band, but a prerequisite from two years back
    // is legitimately below it — so fall back rather than return nothing
    const inBand = hit.filter(l => l.band === bandId);
    bankLessons = (inBand.length ? inBand : hit).slice(0, 6);
  }

  return loops.concat(bankLessons);
}

/* ==================================================================
   THE PLAN
   failed: ['bodmas', 'algebra1'] — the skills the teacher marked wrong
   ================================================================== */
function diagnose(failed, child){
  const c = child || S;
  const considered = new Map();      // skillId -> record

  for(const id of (failed || [])){
    if(!skillById(id)) continue;
    // the failed skill itself, plus everything it stands on, deepest first
    const chain = prereqChain(id).concat([id]);
    for(const sid of chain){
      if(considered.has(sid)) continue;
      const ev = appEvidence(sid, c);
      const isTarget = sid === id;
      considered.set(sid, {
        skill: skillById(sid),
        target: isTarget,
        depth: chain.indexOf(sid),
        evidence: ev,
        lessons: lessonsForSkill(sid, c)
      });
    }
  }

  const plan = [];
  for(const [sid, r] of considered){
    const ev = r.evidence;

    // The app has watched this child do it well, many times. A single test
    // failure against hundreds of correct attempts is a slip, not a gap.
    // Say so and stop — digging into prerequisites here would send a strong
    // child back through work they demonstrably own.
    if(ev && ev.acc >= DIAG_MASTERED){
      if(r.target) plan.push({ ...r, verdict:'slip', priority:0,
        why: `The app has seen ${Math.round(ev.acc*100)}% accuracy over ${ev.n} attempts. Likely a slip in the test, not a gap.` });
      continue;                                  // mastered prereqs are not gaps
    }

    if(ev && ev.acc < DIAG_SHAKY){
      plan.push({ ...r, verdict:'gap', priority: r.target ? 2 : 1,
        why: `${Math.round(ev.acc*100)}% accuracy over ${ev.n} attempts in the app. This is the real gap.` });
      continue;
    }

    if(ev){
      plan.push({ ...r, verdict:'wobbly', priority: r.target ? 4 : 3,
        why: `${Math.round(ev.acc*100)}% in the app — close, but not yet solid.` });
      continue;
    }

    // No evidence either way. This is a blind spot, NOT a gap — and there
    // are always many of them, because a class-6 skill stands on twenty
    // class-1 skills nobody has practised in the app. Ranking these with
    // real gaps buries the diagnosis under noise, which is exactly what
    // makes teacher dashboards useless.
    plan.push({ ...r, verdict:'unseen', priority: r.target ? 5 : 6,
      why: r.target ? 'Marked wrong in the test, and the app has not practised it yet.'
                    : 'Never practised in the app — worth a quick check.' });
  }

  // A confirmed slip settles it. Do not hand a teacher a remediation plan
  // for a child who already knows the thing.
  if(plan.some(p => p.verdict === 'slip')) return plan.filter(p => p.verdict === 'slip');

  plan.sort((a,b) =>
    a.priority - b.priority ||     // confirmed gaps first
    a.depth - b.depth              // then deepest prerequisite first
  );

  // Blind spots need the opposite ordering from gaps. A confirmed gap is
  // most useful at its DEEPEST point — fix the foundation. But an unseen
  // prerequisite is most useful NEAREST the failed skill: if a child is
  // solid on arithmetic and fails algebra, the thing to check is order of
  // operations, not counting to twenty. Keep the two closest, drop the rest.
  const gaps   = plan.filter(p => p.verdict !== 'unseen' || p.target);
  const blind  = plan.filter(p => p.verdict === 'unseen' && !p.target)
                     .sort((a,b) => b.depth - a.depth)      // nearest the target first
                     .slice(0, 2);
  return gaps.concat(blind).sort((a,b) => a.priority - b.priority);
}

/* One line a teacher can read in two seconds. */
function planSummary(plan, name){
  if(!plan.length) return `${name} looks solid on everything tested.`;
  const first = plan[0];
  if(first.verdict === 'slip') return `${name}: probably a careless slip on ${first.skill.en}, not a gap.`;
  const teach = plan.filter(p => p.lessons.length).slice(0,3);
  if(!teach.length) return `${name}: gap at ${first.skill.en} — we cannot teach this one yet.`;
  return `${name}: start with ${teach.map(p=>p.skill.en).join(', ')}.`;
}

/* Roll a whole class up into the thing a teacher actually wants: which
   gap is shared, so it is worth ten minutes of class time rather than
   ten separate interventions. */
function classPattern(results){
  const count = {};
  for(const r of results){
    for(const p of (r.plan || [])){
      if(p.verdict === 'slip' || p.verdict === 'unseen') continue;   // only confirmed gaps
      count[p.skill.id] = count[p.skill.id] || { skill:p.skill, children:[] };
      count[p.skill.id].children.push(r.name);
    }
  }
  return Object.values(count)
    .filter(x => x.children.length > 1)
    .sort((a,b) => b.children.length - a.children.length);
}

/* ==================================================================
   THE CLASS BRIDGE — teacher app side

   The teacher app's own roster never sees a checkpoint fire; every
   student it creates starts with an empty skillHistory and would stay
   that way forever without this. tDiagnose reads the ONE shared place a
   linked child app has been writing to (see mirrorToClass above),
   merges that evidence with whatever the roster's own student object
   already carries, and runs the real diagnose() against the union.

   A student nobody has linked yet — no matching id in the shared blob,
   no own skillHistory either — is not an error. The diagnosis still
   runs and comes back honestly 'unseen' throughout (appEvidence/diagnose
   already treat "no evidence" as its own case, never a crash). What
   tDiagnose adds is `guesswork:true` on that result, so a roster can
   visibly mark it — a teacher should not read silence as "this child is
   fine," only as "nobody has told us anything about this child yet."
   ================================================================== */
function readClassShared(classCode){
  if(!classCode) return {};
  try{
    const raw = localStorage.getItem(classMirrorKey(classCode));
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

function tDiagnose(failed, students, classCode){
  const shared = readClassShared(classCode);
  return (students || []).map(student => {
    const linked = shared[student && student.id];
    // The mirrored entry is {childName, skillHistory} — the evidence
    // itself lives one level down, under .skillHistory, not spread flat.
    const ev = { ...((student && student.skillHistory) || {}), ...((linked && linked.skillHistory) || {}) };
    return {
      student,
      guesswork: Object.keys(ev).length === 0,   // no evidence anywhere — flag it, don't hide it
      plan: diagnose(failed, { ...student, skillHistory: ev })
    };
  });
}

/* ==================================================================
   TEACHER-CHILD HOMEWORK PERSONALIZATION BRIDGE

   Allows a teacher to assign target homework skills to a Class Code.
   The child's app reads assigned homework, runs diagnose() against
   prerequisites, and generates personalized remediation lessons.
   ================================================================== */

function assignHomework(classCode, skillIds, note = ''){
  if(!classCode || !Array.isArray(skillIds)) return false;
  try {
    const key = classMirrorKey(classCode);
    const raw = localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};
    all._homework = {
      skills: skillIds,
      note: note,
      assignedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(all));
    return true;
  } catch(e){
    return false;
  }
}

function getAssignedHomework(child){
  const c = child || S;
  if(!c || !c.classCode) return null;
  try {
    const shared = readClassShared(c.classCode);
    return shared._homework || null;
  } catch(e){
    return null;
  }
}

/* Generates personalized homework remediation plan for active child */
function personalizeContentForHomework(child){
  const c = child || S;
  const hw = getAssignedHomework(c);
  if(!hw || !hw.skills || !hw.skills.length) return null;

  // Run Takhti prerequisite diagnosis on assigned homework skills
  const diagPlan = diagnose(hw.skills, c);
  const targetLessons = [];

  for(const item of diagPlan){
    if(item.lessons && item.lessons.length){
      targetLessons.push(...item.lessons);
    }
  }

  return {
    assignedSkills: hw.skills,
    note: hw.note,
    plan: diagPlan,
    lessons: targetLessons
  };
}

