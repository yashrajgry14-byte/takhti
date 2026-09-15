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
  // id is the one field that CANNOT come from the generic default-merge
  // below: newProfile() mints a fresh random id on every call, so if a
  // profile that predates this field just borrowed that default afresh on
  // every sync, it would get a DIFFERENT id each time until the next save
  // happened to catch it — not stable at all. Assign it once, directly onto
  // the stored object, right here, so it is fixed from this sync forward
  // regardless of save timing.
  if(p.id === undefined) p.id = genChildId();

  // Every OTHER field persisted before it existed (today/targets/doneLessons/
  // age, and whatever gets added next) is missing that key entirely, not set
  // to a falsy value — p[k] reads back undefined, not null or 0. Falling back
  // to newProfile()'s shape there fixes every field this way at once, instead
  // of each reader guessing its own default.
  //
  // newProfile() is called fresh on every sync, not hoisted into a shared
  // constant: a shared object's nested arrays/objects (levels, today, ...)
  // would alias across every profile that ever needed a fallback, so one
  // profile's mutations would leak into another's defaults.
  const PROFILE_DEFAULTS = newProfile();
  for(const k of PROFILE_FIELDS) S[k] = p[k] !== undefined ? p[k] : PROFILE_DEFAULTS[k];
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
  // revoke any self-listen clip before S.ctx (which holds it) is
  // replaced — this path doesn't go through go(), which would
  // otherwise have done it (see ui/self-listen.js's own comment)
  if(typeof selfListenReset === 'function') selfListenReset();
  S.ctx = {}; S.rb = null;
  log(null, `Switched to ${S.name}'s profile · on-device, instant`);
  save();
  if(S.age == null) promptAge('map'); else go('map');
}
