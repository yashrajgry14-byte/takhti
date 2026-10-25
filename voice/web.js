/* ==================================================================
   TALKING MUNNI IN THE APP — the server half

   The app's Munni's Pond can open a live voice call with Munni through
   Bolna's Web Call SDK, but only after a parent turns it on (the child's
   voice goes to the voice service while they talk; see CLAUDE.md). This
   file is everything that call needs from the server:

     POST /voice/web/session   mint a one-use Bolna web session for this
                               child's lesson (the browser never holds a key)
     GET  /voice/web/state     what the screen should show right now
     POST /voice/web/tap       the child tapped instead of speaking: grade
                               it, then PUSH Munni's reply into the live call
                               (Bolna event injection) so she answers at once
     GET  /voice/web/result    after the call: the attempts to replay into
                               the app's own record, so the slate knows
     POST /voice/web/forget    erase this child's voice-side record
     POST /voice/web/mode      the child left the Pond to play (or came back):
                               the lesson pauses, Munni keeps them company
     POST /voice/web/game      a missed answer or a finished round in a game:
                               Munni says a hint from the validated lesson bank

   The screen and the voice share one lesson: the same session the phone
   uses, with the line to read shown on screen instead of on a card, and
   the two clue choices shown as buttons after a first miss.

   The app is the source of truth for a child's level: each new talk
   starts from the levels the app sends, and the app replays the talk's
   attempts through its own record() afterwards.
   ================================================================== */
'use strict';
const crypto = require('crypto');

const same = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function createWeb(brain, envIn) {
  const env = envIn || process.env;
  const store = brain.store;
  const hits = new Map();            // ip → [timestamps], a small abuse brake on minting calls

  function rateOk(ip) {
    const now = Date.now(), hour = 3600e3, max = Number(env.TAKHTI_WEB_PER_HOUR || 10);
    const list = (hits.get(ip) || []).filter(t => now - t < hour);
    if (list.length >= max) { hits.set(ip, list); return false; }
    list.push(now); hits.set(ip, list);
    return true;
  }

  const GREET = {
    hi: n => `नमस्ते ${n}! मैं मुन्नी हूँ। चलो साथ में पढ़ें? तैयार हो?`,
    en: n => `Namaste ${n}! It's Munni. Shall we practise together? Are you ready?`
  };

  /* ---------- start a talk ---------- */
  async function startSession(body, ip) {
    const c = body && body.child;
    if (!body || body.consent !== true) return { status: 403, body: { error: 'a parent has not turned on Talking Munni' } };
    if (!c || !/^[A-Za-z0-9_-]{4,60}$/.test(String(c.id || ''))) return { status: 400, body: { error: 'child id missing' } };
    const age = Number(c.age), name = String(c.name || '').trim().slice(0, 40);
    if (!name || !Number.isInteger(age) || age < 3 || age > 10) return { status: 400, body: { error: 'name and an age from 3 to 10 are needed' } };
    if (!rateOk(ip || 'unknown')) return { status: 429, body: { error: 'too many talks from here — try later' } };
    if (!env.BOLNA_API_KEY || !(env.BOLNA_WEB_AGENT_ID || env.BOLNA_AGENT_ID)) return { status: 503, body: { error: 'Talking Munni is not set up on this server' } };

    let id = 'app_' + c.id;
    // a child in a synced circle may live on the school's record: the
    // circle's own key for this phone opens it
    const linked = brain.circle && brain.circle.findByApp(c.id);
    let child = linked || store.get('children', id), key = null;
    const circleOk = child && child.circle && child.circle.app && child.circle.app.id === c.id && body.circle_key &&
      brain.circle.same(brain.circle.hash(body.circle_key), child.circle.app.key_hash);
    if (child) {
      id = child.id;
      if (!circleOk && !same(body.key, child.app_key)) return { status: 403, body: { error: 'this child belongs to another phone' } };
      if (!child.app_key) { key = crypto.randomBytes(18).toString('base64url'); child.app_key = key; }
      // Talking Munni is the parent's own in-app choice, made behind the PIN:
      // consent for in-app talks only — it never opens phone lessons
      child.consent_app = { talk: true, at: new Date().toISOString(), by: 'parent (in-app opt-in)' };
    } else {
      key = crypto.randomBytes(18).toString('base64url');
      child = {
        id, kind: 'app', app_key: key, name: name.charAt(0).toUpperCase() + name.slice(1), age,
        lang: c.lang === 'en' ? 'en' : 'hi', parent_phone: null,
        consent: { given: true, by: 'parent (in-app opt-in)', at: new Date().toISOString(), recording: false },
        created_at: new Date().toISOString(), profile: brain.core.freshProfile(name, age), sessions: []
      };
    }
    // the app is the source of truth: start this talk where the slate is
    child.name = name.charAt(0).toUpperCase() + name.slice(1);
    child.age = age; child.lang = c.lang === 'en' ? 'en' : 'hi';
    brain.core.withChild(child.profile, { lang: child.lang }, T => {
      T.S.age = age;
      for (const m of ['read', 'write', 'math']) {
        const v = c.levels && Number(c.levels[m]);
        if (v) T.S.levels[m] = T.clampLevel(m, v);
      }
    });

    // talks per day are limited, like the inbound line: a bounded tutor,
    // not an always-on companion
    const today = new Date().toISOString().slice(0, 10);
    const used = (child.sessions || []).map(sid => store.get('sessions', sid))
      .filter(s => s && s.channel === 'app' && s.started_at && s.started_at.slice(0, 10) === today).length;
    if (used >= Number(env.TAKHTI_WEB_DAILY || 3)) {
      store.put('children', id, child);
      return { status: 429, body: { error: 'enough talking for today', limit: true } };
    }
    store.put('children', id, child);

    const { session } = brain.createSession(id, { channel: 'app', kind: 'lesson', keypad: false });
    const token = crypto.randomBytes(18).toString('base64url');
    session.web_token = token;
    store.put('sessions', session.id, session);

    const mint = await fetch((env.BOLNA_API_BASE || 'https://api.bolna.ai') + '/web-call/session', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.BOLNA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: env.BOLNA_WEB_AGENT_ID || env.BOLNA_AGENT_ID,
        user_data: { session_id: session.id, child_name: child.name, lesson_language: child.lang === 'hi' ? 'Hindi' : 'English',
                     greeting: GREET[child.lang](child.name), registered: true, allowed: true, caller_kind: 'child' }
      })
    }).catch(e => ({ ok: false, status: 502, json: async () => ({ error: String(e.message || e) }) }));
    const data = await mint.json().catch(() => ({}));
    if (!mint.ok) return { status: 502, body: { error: `voice service said ${mint.status}`, detail: data } };

    const s = store.get('sessions', session.id);
    s.call = { run_id: data.run_id || null, web: true, minted_at: new Date().toISOString() };
    store.put('sessions', s.id, s);
    return { status: 200, body: { bolna: data, session_id: s.id, token, key } };
  }

  function load(sessionId, token) {
    const s = sessionId && store.get('sessions', String(sessionId));
    if (!s || s.channel !== 'app' || !same(token, s.web_token)) return null;
    return s;
  }

  /* ---------- what the screen shows ---------- */
  function screenOf(s) {
    const it = s.items[s.items.length - 1];
    const lastSay = (s.live_turns || []).filter(t => t.role === 'assistant').map(t => t.text).pop() || '';
    const base = { status: s.status, done: !!s.ended_by, say: lastSay, n: it ? it.n : 0, of: s.slots.length, mode: s.mode || 'lesson' };
    if (!it || it.outcome || s.ended_by || s.mode === 'play') return Object.assign(base, { screen: null });
    let screen;
    if (it.expect === 'reading') screen = { kind: it.kind, text: it.target };
    else if (it.expect === 'yesno') screen = { kind: 'yesno', text: it.prompt, choices: ['yes', 'no'] };
    else if (it.expect === 'number') screen = { kind: 'number', text: it.problem ? `${it.problem} = ?` : it.prompt,
                                                choices: it.choices || null };
    else screen = { kind: it.expect, text: it.prompt };
    return Object.assign(base, { screen });
  }
  function state(sessionId, token) {
    const s = load(sessionId, token);
    return s ? { status: 200, body: screenOf(s) } : { status: 404, body: { error: 'no such talk' } };
  }

  /* ---------- a tap on the screen ---------- */
  async function tap(sessionId, token, choice) {
    const s = load(sessionId, token);
    if (!s) return { status: 404, body: { error: 'no such talk' } };
    const it = s.items[s.items.length - 1];
    if (!it || it.outcome || s.ended_by || !(it.expect === 'number' || it.expect === 'yesno'))
      return { status: 409, body: Object.assign({ error: 'nothing to tap right now' }, screenOf(s)) };
    const c = String(choice == null ? '' : choice).slice(0, 12);
    const words = it.expect === 'yesno' ? (c === 'yes' ? 'yes' : c === 'no' ? 'no' : '') : (/^\d{1,4}$/.test(c) ? c : '');
    if (!words) return { status: 400, body: { error: 'not a choice' } };
    const r = brain.toolAnswer(s.id, '[tap] ' + words);
    // Munni says the reply now, in the live call, without waiting for
    // the child to speak (Bolna event injection into the graph's
    // 'screen' node). If this fails the next spoken turn still works.
    const fresh = store.get('sessions', s.id);
    const injected = await inject(fresh, 'screen_answer', { screen_say: r.say });
    store.put('sessions', fresh.id, fresh);
    return { status: 200, body: Object.assign({ injected }, screenOf(fresh)) };
  }

  /* ---------- Munni pushes a line into the live call ---------- */
  async function inject(s, event, props) {
    const runId = s.call && s.call.run_id;
    let injected = false;
    if (runId && env.BOLNA_API_KEY) {
      const res = await fetch(`${env.BOLNA_API_BASE || 'https://api.bolna.ai'}/v1/call/${encodeURIComponent(runId)}/events`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.BOLNA_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, properties: props })
      }).catch(() => null);
      injected = !!(res && (res.status === 202 || res.ok));
    }
    s.events = (s.events || []).concat({ at: Date.now(), event, injected }).slice(-80);
    return injected;
  }

  /* ---------- games: the talk stays on while the child plays ----------
     The lesson pauses (brain: s.mode = 'play'), and Munni speaks only
     when there is something worth saying: a missed answer gets the right
     one, kindly, from the validated lesson bank — never text the phone
     sent, so nothing but checked content can be put in her mouth — and a
     finished round gets "well played". At most one line every few
     seconds, and a cap per talk: company, not commentary. */
  const PLAY = {
    enter:   { en: "Let's play! If one is tricky, I'll help.", hi: 'चलो खेलें! कोई मुश्किल लगे तो मैं मदद करूँगी।' },
    back:    { en: "Welcome back! Let's carry on.", hi: 'वापस आ गए! चलो आगे बढ़ें।' },
    almostQ: { en: 'Almost! {q} The answer is {a}.', hi: 'लगभग! {q} जवाब है {a}।' },
    almost:  { en: 'Almost! The answer was {a}.', hi: 'लगभग! जवाब था {a}।' },
    almostSet: { en: 'Almost! Look for the one that is different from the others.', hi: 'लगभग! वह ढूँढो जो बाकियों से अलग है।' },
    end:     { en: 'Well played! {k} right.', hi: 'बहुत बढ़िया खेले! {k} सही।' }
  };
  const fillP = (o, lang, v) => { let t = o[lang === 'hi' ? 'hi' : 'en']; for (const k in v) t = t.split('{' + k + '}').join(v[k]); return t; };
  let BEATS = null;          // "lessonId:beatIndex" → beat, from the same bank the app's games draw on
  function beatOf(id) {
    if (!BEATS) {
      BEATS = new Map();
      const { out } = brain.core.withChild(brain.core.freshProfile('x', 7), {}, T => T.lessonBank());
      for (const les of out) les.beats.forEach((b, i) => { if (b.t === 'ask' && b.opts) BEATS.set(les.id + ':' + i, b); });
    }
    return BEATS.get(String(id || '')) || null;
  }
  function hintFor(item, lang, appRight) {
    const b = beatOf(item);
    if (b) {
      const a = String((lang === 'hi' ? (b.hiOpts || b.opts) : b.opts)[b.correct]);
      // the phone's copy must say the same thing as ours, or we stay generic
      if (appRight != null && String(appRight) !== a && String(appRight) !== String(b.opts[b.correct])) return null;
      const q = b.q && b.q[lang === 'hi' ? 'hi' : 'en'];
      return q && q.length <= 110 ? fillP(PLAY.almostQ, lang, { q: q.replace(/\s+/g, ' '), a }) : fillP(PLAY.almost, lang, { a });
    }
    if (/^set-/.test(String(item || ''))) return fillP(PLAY.almostSet, lang, {});
    return null;
  }

  async function mode(sessionId, token, m) {
    const s = load(sessionId, token);
    if (!s) return { status: 404, body: { error: 'no such talk' } };
    if (s.ended_by) return { status: 409, body: { error: 'the talk is over' } };
    const want = m === 'play' ? 'play' : 'lesson';
    if ((s.mode || 'lesson') === want) return { status: 200, body: { mode: want, changed: false } };
    s.mode = want;
    let say;
    if (want === 'play') say = fillP(PLAY.enter, s.lang, {});
    else {
      const it = s.items[s.items.length - 1];
      say = fillP(PLAY.back, s.lang, {}) + (it && !it.outcome ? ' ' + it.prompts[it.prompts.length - 1] : '');
    }
    s.play = s.play || { lines: 0, last: 0, misses: 0 };
    store.put('sessions', s.id, s);
    const injected = await inject(s, want === 'play' ? 'play_mode' : 'lesson_mode', { screen_say: say });
    store.put('sessions', s.id, s);
    return { status: 200, body: { mode: want, changed: true, injected } };
  }

  async function game(sessionId, token, b) {
    const s = load(sessionId, token);
    if (!s) return { status: 404, body: { error: 'no such talk' } };
    if (s.ended_by || s.mode !== 'play') return { status: 200, body: { said: null, why: 'not playing' } };
    b = b || {};
    s.play = s.play || { lines: 0, last: 0, misses: 0 };
    if (b.event === 'miss') s.play.misses++;
    const now = Date.now();
    if (now - s.play.last < Number(env.TAKHTI_PLAY_GAP_MS || 6000) || s.play.lines >= Number(env.TAKHTI_PLAY_MAX || 25)) {
      store.put('sessions', s.id, s);
      return { status: 200, body: { said: null, why: 'quiet for now' } };
    }
    let say = null;
    if (b.event === 'miss') say = hintFor(b.item, s.lang, b.right);
    else if (b.event === 'end') {
      const k = Number(b.score);
      if (Number.isInteger(k) && k >= 0 && k < 100) say = fillP(PLAY.end, s.lang, { k: String(k) });
    }
    if (!say) { store.put('sessions', s.id, s); return { status: 200, body: { said: null } }; }
    s.play.lines++; s.play.last = now;
    const injected = await inject(s, 'game_say', { screen_say: say });
    store.put('sessions', s.id, s);
    return { status: 200, body: { said: say, injected } };
  }

  /* ---------- after the talk: what the app should record ----------
     Maths: first-try outcomes, as on the phone. Reading: the transcript's
     verdict once Bolna's webhook has settled it; if the webhook never
     comes, the live verdict after a grace period — flagged as such. */
  function result(sessionId, token) {
    const s = load(sessionId, token);
    if (!s) return { status: 404, body: { error: 'no such talk' } };
    const graceOver = s.ended_at && Date.now() - Date.parse(s.ended_at) > Number(env.TAKHTI_WEB_GRACE_MS || 90e3);
    if (!s.processed && !graceOver) return { status: 200, body: { pending: true } };
    const records = [];
    for (const it of s.items) {
      if (!it.outcome || it.outcome === 'unsure' || it.outcome === 'silent') continue;
      if (['math', 'story', 'homework', 'check'].includes(it.kind))
        records.push({ mod: 'math', ok: it.outcome === 'correct', skill: it.concept ? null : (it.skill || null), concept: it.concept || null });
      if (it.kind === 'read') {
        const v = it.evidence ? it.evidence.first_verdict
          : (it.live && it.live[0] ? (it.live[0].verdict === 'pass' ? 'pass' : it.live[0].verdict === 'unsure' ? 'unsure' : 'coach') : 'unsure');
        if (v !== 'unsure') records.push({ mod: 'read', ok: v === 'pass', sentence: it.target });
      }
    }
    return { status: 200, body: { pending: false, source: s.processed ? 'transcript' : 'live', records } };
  }

  /* ---------- erase ---------- */
  function forget(childId, key) {
    const child = store.get('children', 'app_' + String(childId || ''));
    if (!child || !same(key, child.app_key)) return { status: 404, body: { error: 'nothing to forget' } };
    brain.deleteChild(child.id);
    return { status: 200, body: { forgotten: true } };
  }

  return { startSession, state, tap, result, forget, mode, game };
}

module.exports = { createWeb };
