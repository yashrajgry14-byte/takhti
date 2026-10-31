/* ==================================================================
   THE SHARED MISTAKES DATABASE

   Each child's twin (src/core/twin.js) works out mistakes nobody listed:
   a combination of wrong column steps that explains answers to two
   different questions ("lined the 4 up under the 3 AND forgot to carry").
   When the parent has turned on the learning circle, the app's profile
   carries those codes, and the few sums no known step explains (question
   and answer only — never a name). This file pools them across children:

   · a combination seen in TAKHTI_MISTAKE_MIN_CHILDREN children (default 3)
     is PROMOTED: it goes back down every sync as `mistake_rules`, and each
     app then treats it as a known mistake from the first time it appears —
     as a wrong option, in its guesses, with its explanation;
   · sums nothing explains are kept for the team to look at
     (GET /voice/admin/mistakes), most common first — where a new kind of
     mistake gets written into src/core/mathgen.js, with its help and
     explanation, and reaches every child with the next release.

   Children are counted by a keyed hash of their id, so the database can
   count distinct children without holding who they are; an erased child is
   taken out of every count (forget()). Codes are checked before they are
   kept (procValid), so nothing the phone makes up is stored or sent on.
   ================================================================== */
'use strict';
const crypto = require('crypto');

function createMistakes(store, core, env) {
  env = env || {};
  const MIN = Number(env.TAKHTI_MISTAKE_MIN_CHILDREN || 3);
  const salt = env.TAKHTI_MISTAKE_SALT || env.TAKHTI_ADMIN_KEY || 'takhti';
  const who = id => crypto.createHmac('sha256', salt).update(String(id)).digest('base64url').slice(0, 16);
  const db = () => store.get('mistakes', 'db') || { codes: {}, unexplained: {} };
  const save = d => store.put('mistakes', 'db', d);
  const T = core.T;

  /* What one child's (checked) profile adds. */
  function record(childId, profile) {
    if (!profile) return;
    const d = db(), h = who(childId), at = new Date().toISOString();
    for (const code of (profile.found || []).filter(T.procValid)) {
      const r = d.codes[code] = d.codes[code] || { children: [], first: at, last: at };
      if (!r.children.includes(h)) r.children.push(h);
      r.last = at;
    }
    for (const u of profile.unexplained || []) {
      if (!/^\d{1,4}[+−×÷]\d{1,4}(×\d{1,2})?$/.test(String(u.sum)) || !Number.isInteger(u.a)) continue;
      const k = `${u.sum}=${u.a}`;
      const r = d.unexplained[k] = d.unexplained[k] || { children: [], first: at, last: at };
      if (!r.children.includes(h)) r.children.push(h);
      r.last = at;
    }
    // keep the unexplained list bounded: the rarest, oldest go first
    const keys = Object.keys(d.unexplained);
    if (keys.length > 2000) keys.sort((x, y) => d.unexplained[x].children.length - d.unexplained[y].children.length || d.unexplained[x].last.localeCompare(d.unexplained[y].last))
      .slice(0, keys.length - 2000).forEach(k => delete d.unexplained[k]);
    save(d);
  }

  /* Combinations enough children share to count as known everywhere. */
  function promoted() {
    const d = db();
    return Object.entries(d.codes).filter(([code, r]) => r.children.length >= MIN && T.procValid(code))
      .sort((x, y) => y[1].children.length - x[1].children.length).slice(0, 60).map(([code]) => code);
  }

  /* For the team: what the database holds, in words. */
  function review() {
    const d = db();
    const codes = Object.entries(d.codes).map(([code, r]) => ({ code, children: r.children.length, promoted: r.children.length >= MIN,
      en: (T.mistakeLabel(code) || {}).en || code, hi: (T.mistakeLabel(code) || {}).hi || code, first: r.first, last: r.last }))
      .sort((x, y) => y.children - x.children);
    const unexplained = Object.entries(d.unexplained).map(([k, r]) => ({ sum: k, children: r.children.length, last: r.last }))
      .sort((x, y) => y.children - x.children || y.last.localeCompare(x.last)).slice(0, 200);
    return { min_children: MIN, codes, unexplained };
  }

  /* An erased child leaves every count. */
  function forget(childId) {
    const d = db(), h = who(childId);
    for (const r of Object.values(d.codes)) r.children = r.children.filter(x => x !== h);
    for (const r of Object.values(d.unexplained)) r.children = r.children.filter(x => x !== h);
    save(d);
  }

  return { record, promoted, review, forget };
}

module.exports = { createMistakes };
