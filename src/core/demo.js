/* ==================================================================
   THE DEMO CLASS — two children with different histories, for showing
   "one approved lesson, two paths" without waiting weeks for real ones.

   A brand-new child has no record, so every new child gets the same
   path — which shows nothing. demoAdd() makes two children, plainly
   named "(demo)" and flagged `demo`, whose records are written the way
   real ones are: by the mind's own mindTaught()/mindAttempt() rounds and
   the twin's own twinAnswer() — nothing is set by hand that the app
   couldn't have learnt from a child.

     Asha (demo)   pictures stick for shapes, the cartoon for sums, hard
                   words in pieces for reading
     Kabir (demo)  the story sticks for shapes and sums, Munni reading
                   first for reading — and he takes the smaller digit
                   from the bigger when borrowing (so Teach Munni's Munni
                   makes HIS mistake)

   Behind the parent PIN (the teacher view). Demo children are never
   synced (syncOn stays off), take profile slots like any child, and
   demoRemove() deletes exactly the flagged ones — from the phone and
   from this phone's class mirror. The judge trace says each step.
   ================================================================== */
const DEMO_KIDS = [
  { name: 'Asha (demo)',  avatar: 'peacock', works: { shape: 'show',  math: 'cartoon', read: 'chunks' } },
  { name: 'Kabir (demo)', avatar: 'tiger',   works: { shape: 'story', math: 'story',   read: 'model'  }, habit: true }
];
const DEMO_TOPICS = { shape: ['shapes2d', 'angles', 'perimeter'], math: ['add2', 'carry', 'sub2', 'borrow'], read: ['read4', 'read5'] };

const demoKids = () => (S.profiles || []).filter(p => p && p.demo);

/* One settled round, through the mind's own functions. */
function demoRound(skill, way, stuck, c){
  mindTaught(skill, way, c);
  mindAttempt(skill, stuck, c);
  mindAttempt(skill, stuck, c);
}

function demoAdd(code){
  if(!code || demoKids().length) return { ok: false, why: 'have' };
  if(S.profiles.length + DEMO_KIDS.length > MAX_PROFILES) return { ok: false, why: 'full' };
  syncProfileOut();
  for(const k of DEMO_KIDS){
    const p = newProfile(k.name);
    Object.assign(p, { demo: true, age: 8, avatar: k.avatar, game: S.game || 'cricket', classCode: code, lastOpen: dayKey(), circleAsked: true });
    for(const [dom, way] of Object.entries(k.works)){
      for(const skill of DEMO_TOPICS[dom]){
        if(mindDomain(skill) !== dom) continue;
        for(const w of Object.keys(WAYS[dom])){
          if(w === way) for(let i = 0; i < 6; i++) demoRound(skill, w, true, p);
          else if(dom !== 'math' || w === 'cartoon' || w === 'story') for(let i = 0; i < 5; i++) demoRound(skill, w, false, p);
        }
      }
    }
    if(k.habit) demoHabit(p);
    S.profiles.push(p);
    mirrorToClassNow(p);
  }
  log(0, `Demo class · added ${DEMO_KIDS.map(k => k.name).join(' and ')} to class ${code} · their records were written by the mind's and the twin's own functions · never synced`);
  save();
  return { ok: true };
}

/* Kabir's habit: twice, on two different sums, the smaller digit from the bigger. */
function demoHabit(p){
  const age = S.age; S.age = 8;                       // skillProblem() reads the active child's band
  try{
    let n = 0;
    for(let seed = 1; seed < 60 && n < 2; seed++){
      const q = skillProblem('borrow', seed);
      if(!q || q.a == null || q.b == null) continue;
      const given = Math.abs((q.a % 10) - (q.b % 10)) + (Math.floor(q.a / 10) - Math.floor(q.b / 10)) * 10;
      if(whichMistake(q, given) !== 'smallbig') continue;
      twinAnswer('borrow', q, given, p); n++;
    }
  }finally{ S.age = age; }
}

function demoRemove(){
  const gone = demoKids();
  if(!gone.length) return 0;
  syncProfileOut();
  const active = S.profiles[S.activeProfile];
  for(const p of gone) if(p.classCode) classMirrorUpdate(p.classCode, all => { delete all[p.id]; });
  S.profiles = S.profiles.filter(p => !p.demo);
  // the active child stays the active child; if it was a demo child, the first real one
  S.activeProfile = Math.max(0, S.profiles.indexOf(active));
  if(S.profiles.length) syncProfileIn(S.activeProfile);
  log(0, `Demo class · removed ${gone.length} demo children from this phone and its class mirror`);
  save();
  return gone.length;
}
