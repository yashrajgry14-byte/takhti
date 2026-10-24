/* ==================================================================
   TAKHTI CORE, ON THE SERVER

   The phone channel must not grow a second, slightly different tutor.
   So this file loads the app's own Tier 0 scripts — the matcher, the
   problem generator, the adaptive engine, the age bands, the lesson
   generator and its validator — unchanged, into a Node vm context,
   exactly the way test/*.test.js already does.

   One child at a time: before any engine call we copy that child's
   saved profile into S with the app's own syncProfileIn(), run, and
   copy it back out with syncProfileOut(). That is the same mechanism
   the phone app uses to switch between siblings, so record(), band()
   and clampLevel() behave identically on a call and on the slate.

   Node is single-threaded and nothing in here awaits, so two calls
   can never interleave inside withChild().
   ================================================================== */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');

/* Load order follows index.html for the files we need. UI files are
   deliberately absent: the phone has no DOM, and anything they would
   have done (celebrations, the trace panel) is stubbed below. */
const FILES = [
  'state.js',
  'content/sentences.js', 'content/games.js', 'content/facts.js', 'content/ages.js',
  'content/lessons.js', 'core/lesson-gen.js', 'content/competencies.js',
  'core/profiles.js', 'core/matcher.js', 'core/adaptive.js',
  'core/daily-engine.js', 'core/mathgen.js', 'core/readability.js'
];

function createCore() {
  const trace = [];
  let random = Math.random;

  /* Stubs for the browser-only functions the engine calls. log() keeps
     its meaning — the judge-facing trace — it just collects instead of
     painting a panel. */
  const sandbox = {
    console, Intl,
    log: (tier, msg) => trace.push({ tier, msg, at: Date.now() }),
    speak: () => {},                 // Munni speaks through Bolna, not the browser
    save: () => {}, saveSoon: () => {},
    homeCelebrate: () => {},
    noteLevelUp: () => { sandbox.__T.S._justLevelled = true; },
    setTimeout: () => 0, clearTimeout: () => {}
  };
  // A Math whose random() we can seed per session, so a call can be
  // replayed exactly in a test. Everything else is the real Math.
  sandbox.Math = Object.create(Math, {
    random: { value: () => random(), writable: true, enumerable: false }
  });

  vm.createContext(sandbox);
  for (const rel of FILES) {
    const p = path.join(SRC, rel);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p });
  }
  // `const` declarations do not attach to the sandbox; lift what we need.
  vm.runInContext(`globalThis.__T = {
    S, AGE_BANDS, bandForAge, band, clampLevel, ageSentences, readability, rdBand,
    gradeReading, gradeBest, gradeVerdict, GRADE, genProblem, record,
    CONCEPTS, validateLesson, newProfile, PROFILE_FIELDS,
    syncProfileIn, syncProfileOut, COMPETENCY, seedOf, rng, SENTENCES
  };`, sandbox);
  const T = sandbox.__T;

  /* Run fn with `profile` loaded as the active child. Returns fn's result;
     the updated profile is written back into `profile` in place. */
  function withChild(profile, opts, fn) {
    opts = opts || {};
    const S = T.S;
    S.profiles = [profile];
    S.activeProfile = 0;
    T.syncProfileIn(0);
    S.lang = opts.lang || 'hi';
    S.screen = 'phone';              // never 'home': no in-app celebration
    S.online = false;                // the server never calls Tier 2 from inside a lesson
    S._bank = null;
    S._justLevelled = false;
    if (opts.seed != null) random = T.rng(T.seedOf(String(opts.seed)));
    const mark = trace.length;
    try {
      const out = fn(T);
      T.syncProfileOut();
      Object.assign(profile, S.profiles[0]);
      return { out, trace: trace.slice(mark) };
    } finally {
      random = Math.random;
      S.profiles = []; S.activeProfile = null;
      if (trace.length > 2000) trace.splice(0, trace.length - 500);
    }
  }

  function freshProfile(name, age) {
    const p = T.newProfile(name);
    p.age = age;
    // start inside the age band, exactly as the app's age screen does
    const b = T.bandForAge(age);
    p.levels = { ...b.start };
    return JSON.parse(JSON.stringify(p));
  }

  return { T, withChild, freshProfile };
}

module.exports = { createCore };
