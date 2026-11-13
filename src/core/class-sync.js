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
  SYNC_STATE[code] = { busy:true };
  flushClassMirror();
  syncProfileOut();
  const children = {};
  for(const p of S.profiles)
    if(p.classCode === code && p.syncOn && p.id)
      children[p.id] = { childName: p.name, skillHistory: p.skillHistory || {}, ...teachExplainedOf(p), ...(typeof planPathsOf === 'function' ? planPathsOf(p) : {}), at: Date.now() };
  const teacherKey = S.syncKeys[code];                       // only on the teacher's phone
  const homework = teacherKey ? (readClassShared(code)._homework || null) : null;
  const lessons = teacherKey ? (readClassShared(code)._lessons || null) : null;   // the school's own lessons (core/syllabus.js)
  try{
    const res = await fetch(SYNC_URL, { method:'POST', headers:{ 'content-type':'application/json' },
                                        body: JSON.stringify({ code, children, homework, lessons, teacherKey }) });
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
    });
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
  if(st.error === 'offline') return hi ? 'इंटरनेट नहीं — जुड़ते ही सिंक होगा।' : 'No connection — it will sync as soon as there is one.';
  if(st.error === 'noserver') return hi ? 'इस सर्वर पर सिंक अभी चालू नहीं है।' : "Sync isn't set up on this server yet.";
  if(st.error === 'claimed') return hi ? 'यह कक्षा पहले से किसी और शिक्षक के फ़ोन से सिंक होती है।' : "This class is already synced from another teacher's phone.";
  if(st.error) return hi ? 'सिंक नहीं हो पाया — थोड़ी देर में फिर कोशिश होगी।' : "Couldn't sync — it will try again shortly.";
  if(!at) return hi ? 'अभी तक सिंक नहीं हुआ।' : 'Not synced yet.';
  const time = new Date(at).toLocaleTimeString(hi ? 'hi-IN' : 'en-IN', { hour:'2-digit', minute:'2-digit' });
  return hi ? `आख़िरी सिंक ${time} — हर घंटे अपने आप।` : `Last synced ${time} — automatically every hour.`;
}
