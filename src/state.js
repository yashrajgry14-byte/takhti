/* ---------------- state ---------------- */

/* A child's identity has to survive everything a name does not: renaming,
   two siblings sharing one name, array reordering when a profile is
   deleted. Generated once, at creation, and never again — see
   core/profiles.js's syncProfileIn() for how an OLD profile that predates
   this field gets one assigned exactly once rather than a fresh one every
   sync (which would make "stable" a lie). */
function genChildId(){
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* One child's on-device record. See core/profiles.js for the switcher —
   S.<field> below always mirrors S.profiles[S.activeProfile], so every
   existing view and handler that reads S.name, S.levels, etc. keeps
   working unchanged regardless of how many children share this phone. */
function newProfile(name){
  return {
    id: genChildId(),   // stable identity; see core/diagnose.js's class-code bridge
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
    photos:  [],           // notebook photos, stay on this device
    doneLessons: [],       // ids already offered, so the picker rotates
    skillHistory: {},      // skillId -> {n, right}, built from lesson checkpoints; see core/diagnose.js
    classCode: null,       // a teacher's 6-char code, entered once on the parent dashboard; see core/diagnose.js
    gameBest: {},          // shellKind -> this child's own best score, see src/games/game-core.js's gameEnd()
    muted: false,          // per child, not per device — see core/speech.js's speak()/ui/elephant.js's trumpet()
    avatar: null,          // the animal a child taps to say who they are, see ui/onboarding.js
    ob: null,              // in-progress onboarding step ('who'|'age'), see ui/onboarding.js's onboardHTML()
    srs: {}                // Spaced Repetition Memory Engine records (itemId -> SRS item)
  };
}
const PROFILE_FIELDS = Object.keys(newProfile());

const S = {
  lang: 'en',
  online: false,
  screen: 'arrival',     // the first screen every session — see ui/arrival.js
  profiles: [],          // up to 4 children, see core/profiles.js
  activeProfile: null,   // index into profiles
  parentPin: null,       // 4-digit string set by a parent; null = not yet set
  camOk:   false,        // camera permission granted this session (device-wide)
  eleph:   null,         // Munni's mood on the ask screen, see ui/elephant.js
  lesson:  null,         // in-progress arithmetic story, see ui/lesson-player.js
  _bank:   null,         // lessonBank() cache — derived, never persisted, see core/lesson-gen.js
  _gamePool: null,       // gameBuildPool() cache — derived, never persisted, see src/games/game-core.js
  game_:   null,         // in-progress arcade round — device-level scratch, never persisted, see src/games/game-core.js
  arr:     null,         // in-progress arrival conversation ({step,turn,reply}) — device-level scratch, never persisted, see ui/arrival.js
  _justLevelled: false,      // record() sets this on a level-up; homeLine() reads it once, see ui/home-scene.js
  _pendingCelebrate: false,  // a goal was met away from home; fires on the next visit, see ui/home-scene.js
  rb: null,             // read-back session, see ui/readback.js
  ctx: {},               // per-screen scratch
  ...newProfile()
};
