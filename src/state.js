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
    day: 0,          // demo offset on top of the real weekday — only nextDay() ("Tomorrow →") moves it, see core/daily-engine.js's dayIndex()
    lastOpen: null,  // dayKey() of the last daily opening, so it plays once a day — see ui/opening.js's goHub()
    stars: 3,        // only ever grows: never spent, reset, or compared — see ui/views.js's topGamifyBar()
    cards: [],       // collectible cards earned by getting a story/cartoon checkpoint right; shown on the parent dashboard
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
    syncOn: false,         // a parent's consent to sync this child's name + practice counts with the class (core/class-sync.js); off until switched on
    hwDone: null,          // assignedAt of the last homework this child finished, so Munni stops pointing at it — see ui/jungle-map.js
    gameBest: {},          // shellKind -> this child's own best score, see src/games/game-core.js's gameEnd()
    muted: false,          // per child, not per device — see core/speech.js's speak()/ui/elephant.js's trumpet()
    avatar: null,          // the animal a child taps to say who they are, see ui/onboarding.js
    ob: null,              // in-progress onboarding step ('who'|'age'), see ui/onboarding.js's onboardHTML()
    srs: {},               // Spaced Repetition Memory Engine records (itemId -> SRS item)
    talkMunni: false,      // a parent turned on Talking Munni (voice goes to the voice service while talking) — see ui/talk-munni.js
    talkKey: null,         // this child's key on the voice server, so only this phone can use or erase that record
    talkApplied: [],       // talk sessions already replayed into this record, so a talk never counts twice
    readAgain: [],         // lines the clearer reading check had to skip (no service answered): read again later — the line only, never a recording
    voiceTerms: null,      // {v, at, by}: a grown-up accepted the reading terms (reading checked online by Gemini, Sarvam as backup, nothing kept) — see ui/cloud-read.js
    // the learning circle — see ui/circle.js. Progress only; never a voice, a photo or a typed question.
    circleSync: false,     // a parent ticked "always keep in sync"
    circleSyncAt: null,    // when they did
    circleAsked: false,    // the grown-ups' step at the end of onboarding has been shown
    circleKey: null,       // this child's key on the circle server
    circleCode: '',        // a school's family code waiting to be sent
    circlePhone: '',       // the parent's WhatsApp number, if they gave it
    circle: null,          // what the circle sent back: this week's step, home activities, check, members, notes
    circleAt: null,        // last sync
    circleHistory: {},     // skill evidence only the circle saw (phone lessons, tutor's ticks, teachers' notes) — appEvidence() adds it
    circleChecks: {},      // week -> this child's Friday check
    circleHomeAns: {},     // home activity id -> the child's answer
    circleOut: {},         // waiting to be sent: check, home answers, a tutor invite or decision
    circleHw: null,        // assignedAt of class homework that came through the circle, so a withdrawal removes exactly it
    mind: null,            // how this child learns: which ways of teaching work, topic by topic — see core/mind.js (stays on this phone)
    assessments: [],       // school marks a parent typed or a class teacher sent: {skill, got, of, by, at}
    teach: null,           // Teach Munni: which lesson points this child explained, and how (core/teachback.js) — stays on this phone except the points, with class sync
    twin: null,            // how this child thinks: what they know and how it fades, the mistakes they repeat, the twin's guesses — see core/twin.js (stays on this phone)
    circleLeave: null      // {erase} — a parent's "off" or "delete" waiting for a signal to reach the server
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
  syncClasses: [],       // class codes this phone's teacher view keeps synced, see core/class-sync.js
  syncAt: {},            // class code -> time of its last successful sync
  syncKeys: {},          // class code -> this phone's teacher key, see core/class-sync.js (never shown, never shared)
  camOk:   false,        // camera permission granted this session (device-wide)
  eleph:   null,         // Munni's mood on the ask screen, see ui/elephant.js
  lesson:  null,         // in-progress arithmetic story, see ui/lesson-player.js
  _bank:   null,         // lessonBank() cache — derived, never persisted, see core/lesson-gen.js
  _gamePool: null,       // gameBuildPool() cache — derived, never persisted, see src/games/game-core.js
  game_:   null,         // in-progress arcade round — device-level scratch, never persisted, see src/games/game-core.js
  arr:     null,         // in-progress arrival conversation ({step,turn,reply}) — device-level scratch, never persisted, see ui/arrival.js
  _justLevelled: false,      // record() sets this on a level-up; Munni mentions it once on the map, see ui/jungle-map.js's mapLine()
  _pendingCelebrate: false,  // a daily goal was met mid-activity; the map celebrates it on the next visit, see ui/jungle-map.js
  _addingChild: false,       // onboarding is creating a sibling's new profile, see ui/onboarding.js's addChild()
  rb: null,             // read-back session, see ui/readback.js
  ctx: {},               // per-screen scratch
  mistakeRules: [],      // combinations of mistakes many children share, from the shared database (core/mathgen.js) — device-level, codes only
  ...newProfile()
};
