/* ==================================================================
   MULTI-CHILD PROFILES (Tier 0) — up to 4 children, one phone.

   S.<field> (name, game, levels, ...) is always a live mirror of
   S.profiles[S.activeProfile]. syncProfileOut()/syncProfileIn() are
   the only places that copy between them — every view and handler
   elsewhere just keeps reading and writing the flat S fields it
   always has, exactly as before profiles existed.
   ================================================================== */
const MAX_PROFILES = 4;

function syncProfileOut(){
  if(S.activeProfile == null) return;
  const p = S.profiles[S.activeProfile];
  if(!p) return;
  for(const k of PROFILE_FIELDS) p[k] = S[k];
}
function syncProfileIn(i){
  const p = S.profiles[i];
  if(!p) return;
  for(const k of PROFILE_FIELDS) S[k] = p[k];
}

function createProfile(name){
  const n = (name||'').trim();
  if(!n || S.profiles.length >= MAX_PROFILES) return false;
  syncProfileOut();
  const p = newProfile(n.charAt(0).toUpperCase()+n.slice(1));
  S.profiles.push(p);
  S.activeProfile = S.profiles.length - 1;
  syncProfileIn(S.activeProfile);
  log(null, `Child profile created on device · nothing sent anywhere · ${S.profiles.length}/${MAX_PROFILES} profiles`);
  save();
  return true;
}

function switchProfile(i){
  if(i === S.activeProfile || !S.profiles[i]) return;
  syncProfileOut();
  S.activeProfile = i;
  syncProfileIn(i);
  S.ctx = {}; S.rb = null;
  log(null, `Switched to ${S.name}'s profile · on-device, instant`);
  save();
  go('home');
}
