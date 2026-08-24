/* ==================================================================
   PERSISTENCE (Tier 0) — thin wrapper over localStorage.

   Only load() and save() cross this boundary. Callers never touch
   localStorage directly, so the Android port can swap this file for
   one backed by Room without changing anything else.

   Deliberately narrow: profiles, which child is active, and the
   parent PIN survive a refresh. S.ctx and S.rb are per-screen scratch
   state and are never persisted.
   ================================================================== */
const STORE_KEY = 'takhti.progress.v2';   // v2: multi-child profiles
const DEVICE_FIELDS = ['profiles','activeProfile','parentPin'];

function todayStamp(){ return new Date().toDateString(); }

function save(){
  try{
    syncProfileOut();
    const out = { date: todayStamp() };
    for(const k of DEVICE_FIELDS) out[k] = S[k];
    localStorage.setItem(STORE_KEY, JSON.stringify(out));
  }catch(e){
    log(null, 'Could not save progress: ' + (e && e.message ? e.message : e));
  }
}

let _saveTimer = null;
function saveSoon(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 800);
}

function load(){
  let raw;
  try{ raw = localStorage.getItem(STORE_KEY); }catch(e){ return; }
  if(!raw) return;
  let data;
  try{ data = JSON.parse(raw); }catch(e){ return; }

  for(const k of DEVICE_FIELDS) if(data[k] !== undefined) S[k] = data[k];

  // a new calendar day means fresh daily targets for every child, even offline
  if(data.date !== todayStamp()){
    for(const p of S.profiles) p.today = { read:0, write:0, math:0, facts:0 };
  }

  if(S.activeProfile != null && S.profiles[S.activeProfile]) syncProfileIn(S.activeProfile);

  log(null, `Progress restored from device storage · ${S.profiles.length} profile(s)`);
}
