/* ==================================================================
   THE SCHEDULER — the daily lesson and the weekly parent call, on time

   Once a minute (or whenever tick() is called), for each family with a
   parent's consent:

   - LESSON DAY: on a day and at a time the parent chose (consent call, or
     the team for a family that agreed in person), start today's lesson —
     through the Bolna Workflow when BOLNA_DAILY_WORKFLOW_ID is set
     (WhatsApp card, call, retry, WhatsApp report), else a direct call.
     Never twice a day, never inside quiet hours, never if the child
     already practised today (e.g. they rang Munni themselves), never
     while lessons are paused.
   - RETRY: a direct call nobody answered was given one retry time by the
     brain (brain.afterMissed); at that time, dial again, once.
   - WEEKLY: on the parent's day and time, the weekly progress call.

   Nothing here contacts a child except the lesson itself, at the time a
   parent picked: no reminders, no nudges, no "you missed a day" (DPDP
   s.9 — see CLAUDE.md). A "fire window" of an hour lets a restarted
   server catch up on a call it was about to make, and no further.
   ================================================================== */
'use strict';
const C = require('./clock');

function createScheduler(brain, envIn, o) {
  const env = envIn || process.env;
  o = o || {};
  const WINDOW = Number(env.TAKHTI_FIRE_WINDOW_MIN || 60);
  let timer = null, running = false;

  const lessonToday = (child, day) => brain.childSessions(child).some(s => s.started_at && C.localParts(s.started_at, env).day === day);

  async function tick(nowIn) {
    if (running) return [];
    running = true;
    const now = nowIn ? new Date(nowIn) : new Date();
    const lp = C.localParts(now, env);
    const done = [];
    try {
      for (const child of brain.listChildren()) {
        if (child.kind === 'app' || !child.consent || !child.consent.given || !child.parent_phone) continue;
        if (C.inQuiet(lp.minutes, env.TAKHTI_QUIET_HOURS)) continue;
        const a = await lessonDay(child, now, lp); if (a) done.push(a);
        const r = await retry(child, now, lp); if (r) done.push(r);
        const w = await weekly(child, now, lp); if (w) done.push(w);
      }
      for (const a of await circleTick(now, lp)) done.push(a);
    } finally { running = false; }
    return done;
  }

  /* ---------- the learning circle's week ----------
     Monday evening: this week's focus and a thing to do together, to the
     parent. Wednesday evening: a thing for the child to teach them. Before
     each tuition session (or Monday morning, for a tutor with no days
     set): the tutor's pack. Saturday morning: the class's Friday checks,
     to the teacher. Weekend: a reading focus is checked from the week's
     reading. All of it to grown-ups only, through the outbox's own limits. */
  async function circleTick(now, lp) {
    const C = brain.circle, M = brain.messages;
    if (!C || !M) return [];
    const done = [];
    const evening = lp.minutes >= Number(env.TAKHTI_CIRCLE_EVENING_MIN || 17 * 60);
    for (const child of brain.listChildren()) {
      if (!C.active(child)) continue;
      const w = C.focusFor(child, now);
      const ch = brain.getChild(child.id);
      if (lp.weekday <= 2 && (lp.weekday === 2 || evening) && M.weekStart(ch, w, now)) done.push({ child: ch.id, action: 'week_start' });
      if (lp.weekday >= 3 && lp.weekday <= 4 && (lp.weekday === 4 || evening) && M.homeTeach(ch, w, now)) done.push({ child: ch.id, action: 'home_teach' });
      if (lp.weekday >= 6 && C.readingCheck(ch)) done.push({ child: ch.id, action: 'reading_check' });
    }
    for (const t of brain.store.list('tutors')) {
      const kids = C.tutorChildren(t);
      if (!kids.length) continue;
      const sch = t.schedule;
      const before = sch && sch.days.includes(lp.weekday) && lp.minutes >= C_toMin(sch.time) - 60 && lp.minutes < C_toMin(sch.time);
      const monday = !sch && lp.weekday === 1 && lp.minutes >= 8 * 60;
      if (!before && !monday) continue;
      for (const ch of kids) if (M.tutorPack(t, ch, C.tutorPack(t, ch), lp.day, now)) done.push({ tutor: t.id, child: ch.id, action: 'tutor_pack' });
    }
    if (lp.weekday === 6 && lp.minutes >= 10 * 60) {
      for (const teacher of brain.listTeachers()) {
        if (!teacher.token) continue;
        for (const code of teacher.class_codes || []) {
          const rows = C.classView(code);
          if (rows.length && M.teacherDigest(teacher, code, rows, C.isoWeek(lp.day), now)) done.push({ teacher: teacher.id, code, action: 'teacher_digest' });
        }
      }
    }
    for (const x of await M.flush(now)) done.push({ message: x.id, action: 'message_' + x.status });
    return done;
  }
  const C_toMin = hhmm => C.toMinutes(hhmm);

  const due = (time, lp) => { const t = C.toMinutes(time); return t != null && lp.minutes >= t && lp.minutes < t + WINDOW; };

  async function lessonDay(child, now, lp) {
    const sch = child.schedule;
    if (!sch || !sch.enabled || !(sch.days || []).includes(lp.weekday) || !due(sch.time, lp)) return null;
    if (child.daily && child.daily[lp.day]) return null;
    // mark first, so a slow Bolna reply can't make the next tick call twice
    const c = brain.getChild(child.id);
    c.daily = Object.assign(c.daily || {}, { [lp.day]: { at: now.toISOString() } });
    if (lessonToday(c, lp.day)) {
      c.daily[lp.day].skipped = 'already practised today';
      brain.store.put('children', c.id, c);
      return { child: c.id, action: 'skip', why: 'already practised today' };
    }
    brain.store.put('children', c.id, c);

    let out;
    const cenv = brain.envFor(c, env);           // the school's own Bolna account, if it has one
    if (cenv.BOLNA_DAILY_WORKFLOW_ID) {
      const ref = `${c.id}_${lp.day}`;
      out = await brain.runWorkflow(cenv.BOLNA_DAILY_WORKFLOW_ID, c, ref, env);
      mark(c.id, lp.day, { mode: 'workflow', reference: ref, result: out.ok ? 'started' : out.error });
      return { child: c.id, action: 'workflow', ok: !!out.ok };
    }
    const r = brain.createSession(c.id, { kind: brain.nextKind(c) });
    if (r.error) { mark(c.id, lp.day, { result: r.error.join('; ') }); return { child: c.id, action: 'error', why: r.error }; }
    mark(c.id, lp.day, { mode: 'direct', session_id: r.session.id });
    out = await brain.placeCall(r.session.id, env);
    mark(c.id, lp.day, { result: out.ok ? 'called' : out.error });
    return { child: c.id, action: 'call', session_id: r.session.id, ok: !!out.ok };
  }

  async function retry(child, now, lp) {
    const d = child.daily && child.daily[lp.day];
    if (!d || d.mode !== 'direct' || !d.retry_at || d.retried || now < new Date(d.retry_at)) return null;
    if (child.schedule && child.schedule.enabled === false) return null;
    const s = brain.getSession(d.session_id);
    if (!s || s.started_at) return null;
    mark(child.id, lp.day, { retried: now.toISOString() });
    const out = await brain.placeCall(s.id, env);
    mark(child.id, lp.day, { retry_result: out.ok ? 'called' : out.error });
    return { child: child.id, action: 'retry', session_id: s.id, ok: !!out.ok };
  }

  async function weekly(child, now, lp) {
    const w = child.weekly;
    if (!w || !w.enabled || w.day !== lp.weekday || !due(w.time, lp)) return null;
    if ((child.weekly_log || {})[lp.day]) return null;
    const c = brain.getChild(child.id);
    c.weekly_log = Object.assign({}, c.weekly_log, { [lp.day]: now.toISOString() });
    const keep = Object.keys(c.weekly_log).sort().slice(-12);
    c.weekly_log = Object.fromEntries(keep.map(k => [k, c.weekly_log[k]]));
    brain.store.put('children', c.id, c);
    const out = await brain.placeParentCall(c.id, 'weekly', env);
    return { child: c.id, action: 'weekly', ok: !!out.ok, session_id: out.session_id || null };
  }

  function mark(id, day, fields) {
    const c = brain.getChild(id);
    c.daily = c.daily || {};
    c.daily[day] = Object.assign({}, c.daily[day], fields);
    const days = Object.keys(c.daily).sort();
    for (const k of days.slice(0, Math.max(0, days.length - 30))) delete c.daily[k];
    brain.store.put('children', c.id, c);
  }

  function start(everyMs) {
    if (timer) return;
    timer = setInterval(() => tick().catch(e => console.error('[takhti] scheduler', e)), everyMs || 60e3);
    if (timer.unref) timer.unref();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  return { tick, start, stop };
}

module.exports = { createScheduler };
