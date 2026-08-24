/* ---------------- state ---------------- */
const S = {
  lang: 'en',
  online: false,
  screen: 'greet',
  name: null,
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
  photos:  [],          // notebook photos, stay on this device
  camOk:   false,       // camera permission granted this session
  rb: null,             // read-back session, see ui/readback.js
  ctx: {}               // per-screen scratch
};
