/* ==================================================================
   SPACED REPETITION MEMORY ENGINE (Ebbinghaus Forgetting Curve)

   On-device memory review scheduler.
   Tracks long-term memory retention across expanding intervals:
   Step 1 (1 day) -> Step 2 (3 days) -> Step 3 (7 days) -> Step 4 (21 days)
   ================================================================== */

const SRS_INTERVALS_MS = {
  1: 1 * 86400000,    // 1 day
  2: 3 * 86400000,    // 3 days
  3: 7 * 86400000,    // 7 days
  4: 21 * 86400000   // 21 days
};

function srsIntervalMs(step){
  return SRS_INTERVALS_MS[Math.min(4, Math.max(1, step))] || SRS_INTERVALS_MS[1];
}

/* Record a practice attempt for an item into the child's SRS memory graph */
function recordSrsItem(itemId, mod, textContent, ok, child){
  const c = child || S;
  if(!c) return;
  c.srs = c.srs || {};

  const existing = c.srs[itemId] || {
    id: itemId,
    mod: mod || 'read',
    content: textContent || '',
    step: 0,
    attempts: 0,
    correct: 0,
    lastReview: 0,
    nextReview: 0
  };

  existing.attempts++;
  if(ok) existing.correct++;
  existing.lastReview = Date.now();

  if(ok){
    existing.step = Math.min(4, existing.step + 1);
    existing.nextReview = Date.now() + srsIntervalMs(existing.step);
    if(typeof log === 'function') log(0, `SRS · "${itemId}" step ${existing.step} (${existing.step===4?'Mastered':Math.round(srsIntervalMs(existing.step)/86400000)+'d review'})`);
  } else {
    existing.step = 1;
    existing.nextReview = Date.now() + srsIntervalMs(1);
    if(typeof log === 'function') log(0, `SRS · "${itemId}" reset to step 1 (review in 1d)`);
  }

  c.srs[itemId] = existing;
}

/* Get all items due for memory review today */
function getDueSrsItems(child, mod){
  const c = child || S;
  if(!c || !c.srs) return [];
  const now = Date.now();
  const items = Object.values(c.srs);
  return items.filter(it => {
    if(mod && it.mod !== mod) return false;
    return it.nextReview <= now;
  });
}

/* Aggregate long-term memory stats for Parent/Teacher Dashboard */
function srsStats(child){
  const c = child || S;
  if(!c || !c.srs) return { total: 0, mastered: 0, due: 0 };
  const items = Object.values(c.srs);
  const now = Date.now();
  const total = items.length;
  const mastered = items.filter(i => i.step >= 4).length;
  const due = items.filter(i => i.nextReview <= now).length;
  return { total, mastered, due };
}
