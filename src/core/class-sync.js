/* ==================================================================
   CLASS SYNC — the class, kept the same on every phone, automatically.

   Once an hour (and the moment a connection comes back, and whenever
   someone taps "Sync now"), each class this phone takes part in is sent
   to the Tier 2 sync function (api/class-sync.mjs) and the whole class
   comes back:

     · a child's phone sends that child's name and practice counts per
       skill — ONLY if a parent switched sync on for that child
       (S.syncOn, parent dashboard, behind the PIN). Off until then: the
       DPDP Act requires a parent's consent before a child's data leaves
       the phone, and the dashboard says exactly what is sent.
     · a teacher's phone sends the class's homework, and keeps the
       classes the teacher chose (S.syncClasses) up to date. It holds a
       random teacher key per class (S.syncKeys) that never leaves it and
       proves to the server that it is the class's teacher: only the key
       gets the whole class back or can set homework. A child's phone
       gets only the homework and its own record — never classmates'.

   Everything comes back into the same class-code mirror the teacher
   view, the diagnosis and the homework banner already read
   (core/diagnose.js), merged newest-wins: per child by `at`, homework by
   `assignedAt` (a withdrawal is a dated "cleared" marker, so it travels
   too). Sync is a bonus, never a dependency — offline, or with no sync
   server configured, everything keeps working on this phone, and the
   progress/homework codes (core/class-share.js) still work by hand.
   ================================================================== */
const SYNC_URL = (typeof window !== 'undefined' && window.TAKHTI_SYNC) || '/api/class-sync';
const SYNC_EVERY_MS = 60 * 60 * 1000;
const SYNC_STATE = {};   // code -> { busy } | { error } — this session only, for the status lines

/* Every class this phone syncs: the teacher's chosen ones, plus the class
   of every child here whose parent switched sync on. */
function syncCodes(){
  syncProfileOut();
  const codes = new Set(S.syncClasses);
  for(const p of S.profiles) if(p.classCode && p.syncOn) codes.add(p.classCode);
  return [...codes];
}

async function syncClass(code){
  if(!code || (SYNC_STATE[code] && SYNC_STATE[code].busy)) return false;
  if(!navigator.onLine){ SYNC_STATE[code] = { error:'offline' }; return false; }
  const identity = typeof classAuthToken==='function' ? classAuthToken() : null;
  if(!identity){ SYNC_STATE[code] = { error:'sign-in-required' }; return false; }
  SYNC_STATE[code] = { busy:true };
  flushClassMirror();
  syncProfileOut();
  const children = {};
  for(const p of S.profiles)
    if(p.classCode === code && p.syncOn && p.id)
      children[p.id] = { childName: p.name, skillHistory: p.skillHistory || {}, ...teachExplainedOf(p), ...(typeof planPathsOf === 'function' ? planPathsOf(p) : {}), at: Date.now() };
  const teacherKey = S.syncKeys[code]; // legacy local marker; server ignores it as authentication
  const homework = teacherKey ? (readClassShared(code)._homework || null) : null;
  const lessons = teacherKey ? (readClassShared(code)._lessons || null) : null;   // the school's own lessons (core/syllabus.js)
  const roster = teacherKey ? (readClassShared(code)._roster || null) : null;     // which class each child is in (schoolClassOf())
  try{
    const res = await fetch(SYNC_URL, { method:'POST', headers:{ 'content-type':'application/json', 'authorization':'Bearer '+identity },
                                        body: JSON.stringify({ code, children, homework, lessons, roster, teacherKey }) });
    if(!res.ok) throw new Error(res.status === 503 ? 'noserver' : res.status === 403 ? 'claimed' : 'HTTP ' + res.status);
    const cls = await res.json();
    classMirrorUpdate(code, all => {
      for(const [id, c] of Object.entries(cls.children || {})){
        if(id.startsWith('_')) continue;
        if(!all[id] || !all[id].at || all[id].at <= c.at) all[id] = { ...c, viaSync: true };
      }
      const hw = cls.homework;
      if(hw && (!all._homework || (all._homework.assignedAt || 0) < hw.assignedAt)) all._homework = hw;
      // each phone checks these again before a child sees one (schoolLessons())
      const ls = cls.lessons;
      if(ls && Array.isArray(ls.items) && (!all._lessons || (all._lessons.at || 0) < ls.at)) all._lessons = ls;
      const ro = cls.roster;
      if(ro && typeof ro === 'object' && (!all._roster || (all._roster.at || 0) < (ro.at || 0))) all._roster = ro;
    });
    applySchoolClass(code);
    S.syncAt = { ...S.syncAt, [code]: Date.now() };
    SYNC_STATE[code] = {};
    log(2, `Class sync · ${code} · sent ${Object.keys(children).length} child record(s) · class has ${Object.keys(cls.children || {}).length}`);
    save();
    return true;
  }catch(e){
    SYNC_STATE[code] = { error: ['noserver', 'claimed'].includes(e.message) ? e.message : 'failed' };
    log(2, `Class sync · ${code} · not reached (${e.message}) — will try again`);
    return false;
  }
}

/* ==================================================================
   THE SCHOOL'S ROSTER — which class each child is in.

   The class decides what Takhti teaches (content/ages.js CLASSES), and
   the school knows a child's class better than anyone. The teacher sets
   the class's grade once (and, rarely, one child's own), in the teacher
   view; it is kept in the class mirror as _roster { cls, kids:{id: cls},
   at } and reaches every phone the way homework does — the class sync
   (teacher's key only; a child's phone gets the grade and its own entry,
   never a classmate's), or the homework code by hand (the grade only).
   A class from the school is marked clsBy:'school', and a parent can't
   change it on the dashboard; a parent who unlinks the class code gets
   the choice back, the class kept as it was.
   ================================================================== */
function schoolClassOf(code, childId){
  const r = code ? readClassShared(code)._roster : null;
  if(!r) return null;
  const id = (r.kids && childId && r.kids[childId]) || r.cls;
  return classById(id) ? id : null;
}

/* Every child on this phone in the class gets the school's class. Levels
   are pulled inside the new class's band. Returns how many changed. */
function applySchoolClass(code){
  if(!code) return 0;
  syncProfileOut();
  let changed = 0;
  for(const p of S.profiles){
    if(!p || p.classCode !== code) continue;
    const id = schoolClassOf(code, p.id);
    if(!id){
      if(p.clsBy === 'school'){ p.clsBy = null; changed++; }   // the school cleared it: the class stays, a parent may change it again
      continue;
    }
    if(p.cls === id && p.clsBy === 'school') continue;
    const was = p.cls;
    p.cls = id; p.clsBy = 'school';
    if(p.levels) for(const m of ['read','write','math']) if(p.levels[m] != null) p.levels[m] = clampLevel(m, p.levels[m], p);
    changed++;
    log(2, `School roster · ${p.name || 'a child'} · class ${was || '(by age)'} → ${id} · band "${bandFor(p).id}"`);
  }
  if(changed && S.activeProfile != null){
    syncProfileIn(S.activeProfile);
    if(S.screen === 'write') S.ctx = {};        // a writing tab the new class doesn't have must not linger
  }
  return changed;
}

/* The teacher's own phone: set the class's grade, or one child's. */
function setSchoolClass(code, cls, childId){
  if(!code || (cls && !classById(cls))) return false;
  classMirrorUpdate(code, all => {
    const r = all._roster || { cls: null, kids: {} };
    const kids = { ...(r.kids || {}) };
    if(childId){ if(cls) kids[childId] = cls; else delete kids[childId]; }
    all._roster = { cls: childId ? (r.cls || null) : (cls || null), kids, at: Date.now() };
  });
  applySchoolClass(code);
  return true;
}

/* Sync every class that's due (an hour since its last success), or all of
   them now with force. Only re-renders the map by itself — homework that
   arrives should move Munni — never a screen someone may be typing on. */
async function syncDue(force){
  let any = false;
  for(const code of syncCodes())
    if(force || Date.now() - (S.syncAt[code] || 0) >= SYNC_EVERY_MS) any = (await syncClass(code)) || any;
  if(any && S.screen === 'map') render();
  return any;
}

function startClassSync(){
  syncDue();
  setInterval(() => syncDue(), 5 * 60 * 1000);   // checks every 5 minutes; each class syncs once an hour
  window.addEventListener('online', () => syncDue());
}

/* The secret that makes this phone the class's teacher, made once when the
   teacher switches sync on. Random, never displayed, never sent anywhere
   but the sync server (which keeps only its hash). */
function newTeacherKey(){
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* One status line for a class: last synced, or why not. */
function syncStatusLine(code){
  const hi = S.lang === 'hi', st = SYNC_STATE[code] || {}, at = S.syncAt[code];
  if(st.busy) return hi ? 'सिंक हो रहा है…' : 'Syncing…';
  if(st.error === 'sign-in-required') return hi ? 'सिंक के लिए स्कूल खाते से साइन इन करें।' : 'Sign in with a school account to sync.';
  if(st.error === 'offline') return hi ? 'इंटरनेट नहीं — जुड़ते ही सिंक होगा।' : 'No connection — it will sync as soon as there is one.';
  if(st.error === 'noserver') return hi ? 'इस सर्वर पर सिंक अभी चालू नहीं है।' : "Sync isn't set up on this server yet.";
  if(st.error === 'claimed') return hi ? 'यह कक्षा पहले से किसी और शिक्षक के फ़ोन से सिंक होती है।' : "This class is already synced from another teacher's phone.";
  if(st.error) return hi ? 'सिंक नहीं हो पाया — थोड़ी देर में फिर कोशिश होगी।' : "Couldn't sync — it will try again shortly.";
  if(!at) return hi ? 'अभी तक सिंक नहीं हुआ।' : 'Not synced yet.';
  const time = new Date(at).toLocaleTimeString(hi ? 'hi-IN' : 'en-IN', { hour:'2-digit', minute:'2-digit' });
  return hi ? `आख़िरी सिंक ${time} — हर घंटे अपने आप।` : `Last synced ${time} — automatically every hour.`;
}
