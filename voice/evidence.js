/* ==================================================================
   THE EVIDENCE LEDGER — one child, many places that see them learn

   A child in the circle is seen by the app (on the phone, offline), by
   Munni on calls, by the tuition teacher, and by the class teacher's
   notes. Each attempt must count exactly once.

   So the server keeps two things apart:
     app snapshot      the app's own skill history, sent whole on every
                       sync (it already includes Talking Munni talks the
                       app replayed into itself)
     server evidence   only what the app can't have seen: phone lessons,
                       tutor results, teacher and tutor notes, placement,
                       a Friday check done on a call

   combined = app snapshot + server evidence. The app gets the server
   evidence back as `circleHistory` and adds it in its own diagnosis.
   Nothing is ever counted twice, and a child with no app simply has the
   server's record.
   ================================================================== */
'use strict';

const clone = o => JSON.parse(JSON.stringify(o || {}));

/* Run fn (which may record attempts into child.profile.skillHistory) and
   add whatever it added to the server-only ledger. */
function ledger(child, fn) {
  const before = clone(child.profile && child.profile.skillHistory);
  const out = fn();
  const after = (child.profile && child.profile.skillHistory) || {};
  child.server_evidence = child.server_evidence || {};
  for (const [id, h] of Object.entries(after)) {
    const b = before[id] || { n: 0, right: 0 };
    const dn = (h.n || 0) - (b.n || 0), dr = (h.right || 0) - (b.right || 0);
    if (dn <= 0) continue;
    const e = child.server_evidence[id] || { n: 0, right: 0 };
    e.n += dn; e.right += Math.max(0, dr);
    child.server_evidence[id] = e;
  }
  return out;
}

function combinedHistory(child) {
  const snap = child.circle && child.circle.app_snapshot && child.circle.app_snapshot.skillHistory;
  if (!snap) return clone(child.profile && child.profile.skillHistory);
  const out = clone(snap);
  for (const [id, e] of Object.entries(child.server_evidence || {})) {
    const o = out[id] || { n: 0, right: 0 };
    o.n += e.n; o.right += e.right; out[id] = o;
  }
  return out;
}

module.exports = { ledger, combinedHistory };
