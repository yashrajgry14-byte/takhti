/* ---------------- state ---------------- */

/* One child's on-device record. See core/profiles.js for the switcher —
   S.<field> below always mirrors S.profiles[S.activeProfile], so every
   existing view and handler that reads S.name, S.levels, etc. keeps
   working unchanged regardless of how many children share this phone. */
function newProfile(name){
  return {
    name: name || null,
    age: null,       // set on the age screen; null = not asked yet, see content/ages.js
    game: null,
    visits: 0,
    day: 0,          // index into this week's plan; the demo can step it forward
    seen: [],        // formats already opened this week
    stars: 3,
    levels: { read: 2, write: 1, math: 2 },
    window: { read: [], write: [], math: [] },   // rolling accuracy window
    attempts: { read: 0, write: 0, math: 0 },
    correct:  { read: 0, write: 0, math: 0 },
    queue: [],            // questions asked with no signal
    answered: [],         // resolved answers, cached forever
    targets: { read:5, write:5, math:5, facts:3 },   // set by the parent
    today:   { read:0, write:0, math:0, facts:0 },   // counted on success only
    photos:  []           // notebook photos, stay on this device
  };
}
const PROFILE_FIELDS = Object.keys(newProfile());

const S = {
  lang: 'en',
  online: false,
  screen: 'greet',
  profiles: [],          // up to 4 children, see core/profiles.js
  activeProfile: null,   // index into profiles
  parentPin: null,       // 4-digit string set by a parent; null = not yet set
  camOk:   false,        // camera permission granted this session (device-wide)
  eleph:   null,         // Munni's mood on the ask screen, see ui/elephant.js
  lesson:  null,         // in-progress arithmetic story, see ui/lesson-player.js
  rb: null,             // read-back session, see ui/readback.js
  ctx: {},               // per-screen scratch
  ...newProfile()
};
