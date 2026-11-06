/* ==================================================================
   THE LEARNING CIRCLE — everyone around one child, in step

   Around every child: the class teacher, the parents, the tuition
   teacher, Munni (on calls), and the app. They work on ONE thing a week —
   the weekly focus — and four loops keep it moving:

     weekly focus   chosen on Monday: the class homework, adapted by the
                    app's own diagnosis to this child's real gap; else
                    last Friday's suggestion, a teacher's or tutor's note,
                    or the child's own weakest step. The app, the calls,
                    the parent, the tutor and the teacher all see the same.
     tutor pack     before each tuition session: the focus and why, what
                    went wrong this week, three ready questions with the
                    common mistake for each. The tutor's ticks come back
                    as evidence.
     Friday check   three questions on the focus (in the app, or on a
                    Friday call; a reading focus is read off the week's
                    reading) → a kind verdict → next week's suggestion →
                    the class teacher's results.
     home loop      one thing to do together (Monday) and one thing for
                    the child to teach (Wednesday); the parent marks it
                    done, and Munni asks the child about it next time.

   Sync: a parent ticks "always keep in sync" once (the app's onboarding
   or dashboard). From then on the app sends PROGRESS — levels, the skill
   history, counts — whenever it has a signal, never in the middle of a
   lesson, never a voice or a photo, and gets the circle back. Nothing
   syncs without that tick. The evidence ledger (evidence.js) makes sure
   an attempt counts once however many places saw it.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const C = require('./clock');
const EV = require('./evidence');
const NT = require('./notes');

const SYNC_NOTICE = 'circle-2026-10-v1';
const tok = () => crypto.randomBytes(18).toString('base64url');
const hash = k => crypto.createHash('sha256').update(String(k)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const LINK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';     // no 0/O, 1/I/L
const linkCode = () => Array.from(crypto.randomBytes(8), b => LINK_ALPHABET[b % LINK_ALPHABET.length]).join('');

/* ISO week of a local calendar day, e.g. "2027-W01" */
function isoWeek(day) {
  const d = new Date(day + 'T12:00:00Z');
  const wd = (d.getUTCDay() + 6) % 7;                 // Monday 0
  d.setUTCDate(d.getUTCDate() - wd + 3);              // the week's Thursday
  const y = d.getUTCFullYear();
  const first = new Date(Date.UTC(y, 0, 4));
  const n = 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(n).padStart(2, '0')}`;
}

/* ---------------- the home loop: things to do together ---------------- */
const HOME = {
  count:    { topic: { en: 'counting', hi: 'गिनती' },
              do: { en: 'Count the spoons together at dinner, then take one away: how many now?', hi: 'खाने के समय साथ में चम्मच गिनें, फिर एक हटाएँ: अब कितने?' },
              teach: { en: 'Ask {name} to count the stairs out loud, then teach you to count back down.', hi: '{name} से कहें कि सीढ़ियाँ बोलकर गिनें, फिर आपको उल्टी गिनती सिखाएँ।' } },
  add:      { topic: { en: 'adding big numbers', hi: 'बड़ी संख्याएँ जोड़ना' },
              do: { en: 'Make 27 with bundles of ten sticks and loose sticks, add 15, and bundle the extra ten together.', hi: 'दस-दस तीलियों की गड्डियों और खुली तीलियों से 27 बनाएँ, 15 जोड़ें, और बची दस तीलियों की नई गड्डी बनाएँ।' },
              teach: { en: 'Ask {name} to show you how 38 + 24 works, out loud, step by step.', hi: '{name} से कहें कि 38 + 24 कैसे होता है, बोलकर, एक-एक कदम आपको सिखाएँ।' } },
  sub:      { topic: { en: 'taking away', hi: 'घटाना' },
              do: { en: 'Play shop: you have 50 rupees and buy something for 23. How much is left?', hi: 'दुकान-दुकान खेलें: आपके पास 50 रुपये हैं, 23 का सामान लें। कितने बचे?' },
              teach: { en: 'Ask {name} to teach you how to take 19 away from 42.', hi: '{name} से कहें कि 42 में से 19 घटाना आपको सिखाएँ।' } },
  mult:     { topic: { en: 'times tables', hi: 'पहाड़े' },
              do: { en: 'Say the 4 times table together while walking, one step for each number.', hi: 'चलते हुए साथ में 4 का पहाड़ा बोलें, हर संख्या पर एक कदम।' },
              teach: { en: 'Ask {name} to show you, with spoons, why 3 × 4 is the same as 4 × 3.', hi: '{name} से कहें कि चम्मचों से दिखाएँ कि 3 × 4 और 4 × 3 एक जैसे क्यों हैं।' } },
  div:      { topic: { en: 'sharing equally', hi: 'बराबर बाँटना' },
              do: { en: 'Share 12 sweets equally among 3 people together. How many each?', hi: 'साथ में 12 टॉफ़ी 3 लोगों में बराबर बाँटें। हर एक को कितनी?' },
              teach: { en: 'Ask {name} to share 14 things among 4 people and explain what is left over.', hi: '{name} से कहें कि 14 चीज़ें 4 लोगों में बाँटें और बताएँ कितनी बचीं।' } },
  money:    { topic: { en: 'counting money', hi: 'पैसे गिनना' },
              do: { en: 'Let {name} count the change at the shop today.', hi: 'आज दुकान पर {name} को छुट्टे पैसे गिनने दें।' },
              teach: { en: 'Ask {name} to teach you two different ways to make 20 rupees with coins.', hi: '{name} से कहें कि सिक्कों से 20 रुपये बनाने के दो अलग तरीके आपको सिखाएँ।' } },
  time:     { topic: { en: 'telling the time', hi: 'समय बताना' },
              do: { en: 'Look at a clock together at each meal and say the hour.', hi: 'हर खाने के समय साथ में घड़ी देखें और बताएँ कितने बजे हैं।' },
              teach: { en: 'Ask {name} to teach you where the short hand points at bedtime.', hi: '{name} से कहें कि सोने के समय छोटी सुई कहाँ होती है, यह आपको सिखाएँ।' } },
  fraction: { topic: { en: 'halves and quarters', hi: 'आधा और चौथाई' },
              do: { en: 'Cut a roti into halves and then quarters together, and name each piece.', hi: 'साथ में एक रोटी के आधे और फिर चौथाई टुकड़े करें, और हर टुकड़े का नाम बोलें।' },
              teach: { en: 'Ask {name} to show you which is bigger, a half or a quarter, and why.', hi: '{name} से कहें कि दिखाएँ आधा बड़ा है या चौथाई, और क्यों।' } },
  letters:  { topic: { en: 'letter sounds', hi: 'अक्षरों की आवाज़' },
              do: { en: 'Find the letters {letters} on signs and packets around the house.', hi: 'घर में बोर्ड और पैकेटों पर {letters} अक्षर ढूँढें।' },
              teach: { en: 'Ask {name} to teach you the sound of each letter in their own name.', hi: '{name} से कहें कि अपने नाम के हर अक्षर की आवाज़ आपको सिखाएँ।' } },
  matra:    { topic: { en: 'matras', hi: 'मात्राएँ' },
              do: { en: 'Write five words with the same matra together, like कि, मि, दि.', hi: 'साथ में एक ही मात्रा वाले पाँच शब्द लिखें, जैसे कि, मि, दि।' },
              teach: { en: 'Ask {name} to show you how one matra changes a word.', hi: '{name} से कहें कि दिखाएँ एक मात्रा शब्द को कैसे बदल देती है।' } },
  reading:  { topic: { en: 'reading', hi: 'पढ़ना' },
              do: { en: 'Read the words on one packet in your kitchen together.', hi: 'रसोई के किसी एक पैकेट पर लिखे शब्द साथ में पढ़ें।' },
              teach: { en: 'Ask {name} to read you one line from a book or newspaper, then you read the next.', hi: '{name} से कहें कि किताब या अख़बार की एक लाइन आपको पढ़कर सुनाएँ, फिर अगली आप पढ़ें।' } },
  any:      { topic: { en: 'what they learned', hi: 'जो सीखा' },
              do: { en: 'Ask {name} what they practised with Munni today, and try one together.', hi: '{name} से पूछें कि आज मुन्नी के साथ क्या अभ्यास किया, और एक साथ में करके देखें।' },
              teach: { en: 'Ask {name} to teach you one thing from this week.', hi: '{name} से कहें कि इस हफ़्ते की कोई एक बात आपको सिखाएँ।' } }
};
function homeGroup(skill) {
  const s = String(skill || '');
  if (/^(count20|add10|bonds10|compare1|n-count5|l-count10|u-count20|l-match|u-addpic|u-order)$/.test(s)) return 'count';
  if (/^(add2|carry|place2|place3)$/.test(s)) return 'add';
  if (/^(sub10|sub2|borrow|u-subpic)$/.test(s)) return 'sub';
  if (/^(tables|mult2x1|mult2x2|skip)$/.test(s)) return 'mult';
  if (/^(divshare|divrem|longdiv)$/.test(s)) return 'div';
  if (s === 'money2') return 'money';
  if (s === 'time2') return 'time';
  if (/^frac/.test(s)) return 'fraction';
  if (/^(read2|l-sound|l-alpha|l-swar|u-vyanjan|e1-decode|u-blend)$/.test(s)) return 'letters';
  if (/matra/.test(s)) return 'matra';
  if (/^(read\d|e\d-|h\d-|u-sight|n-listen)/.test(s)) return 'reading';
  return 'any';
}
const fillName = (t, v) => { let s = t; for (const k in v) s = s.split('{' + k + '}').join(v[k]); return s; };

/* ---------------- what a tutor should know about a mistake ---------------- */
const MISTAKE = {
  carry:   { en: 'forgot to carry the ten', hi: 'हासिल का दस भूल गए' },
  borrow:  { en: 'took the smaller digit from the bigger one', hi: 'बड़े अंक में से छोटा घटा दिया' },
  sub2:    { en: 'one off: counted wrong', hi: 'एक का फ़र्क: गिनती में चूक' },
  add2:    { en: 'one off: counted wrong', hi: 'एक का फ़र्क: गिनती में चूक' },
  tables:  { en: 'one group too many', hi: 'एक समूह ज़्यादा गिन लिया' },
  mult2x1: { en: 'one group too many', hi: 'एक समूह ज़्यादा गिन लिया' },
  mult2x2: { en: 'one group too many', hi: 'एक समूह ज़्यादा गिन लिया' },
  divshare:{ en: 'one off when sharing', hi: 'बाँटते समय एक का फ़र्क' },
  divrem:  { en: 'one off when sharing', hi: 'बाँटते समय एक का फ़र्क' },
  add10:   { en: 'counted on one too many', hi: 'एक ज़्यादा गिन लिया' },
  sub10:   { en: 'counted back one too few', hi: 'उल्टी गिनती में एक कम' }
};

function createCircle(brain, envIn) {
  const env = envIn || process.env;
  const store = brain.store, core = brain.core, T = core.T;
  const base = () => (env.TAKHTI_PUBLIC_URL || '').replace(/\/$/, '');
  const now = () => new Date();
  const L2 = l => (l === 'hi' ? 'hi' : 'en');
  const skillName = (id, lang) => { const s = T.skillById(id); return s ? (lang === 'hi' ? s.hi : s.en) : id; };
  let messages = null;                                  // set by attachMessages()

  function ensure(child) {
    child.circle = child.circle || {};
    const c = child.circle;
    c.parent_token = c.parent_token || tok();
    c.tutors = c.tutors || [];
    c.history = c.history || [];
    c.notes_seen = c.notes_seen || 0;
    return c;
  }
  const put = child => store.put('children', child.id, child);
  /* Who is in a circle: a child whose parent turned on sync, a child a
     school registered, a child with a tutor, or one the team switched on. */
  function active(child) {
    const c = child && child.circle;
    if (c && c.stopped) return false;          // the parent turned sync off in the app: their choice wins, school child or not
    return !!(child && (child.school_id || (c && ((c.sync && c.sync.on) || (c.tutors || []).length || c.on))));
  }

  /* ======================= SYNC (the app) ======================= */
  const hits = new Map();
  function rateOk(key, max) {
    const t = Date.now(), list = (hits.get(key) || []).filter(x => t - x < 3600e3);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(t); hits.set(key, list); return true;
  }
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : 0; };
  function cleanHistory(h) {
    const out = {};
    for (const [id, v] of Object.entries(h || {}).slice(0, 400)) {
      if (!T.skillById(id) || !v) continue;
      const n = num(v.n, 0, 1e6), right = Math.min(n, num(v.right, 0, 1e6));
      if (n) out[id] = { n, right };
    }
    return out;
  }
  function findByApp(appId) {
    return store.list('children').find(c => c.circle && c.circle.app && c.circle.app.id === appId) || null;
  }

  async function sync(body, ip) {
    body = body || {};
    const c = body.child || {};
    if (!/^[A-Za-z0-9_-]{4,60}$/.test(String(c.id || ''))) return { status: 400, body: { error: 'child id missing' } };
    if (!body.consent || body.consent.sync !== true) return { status: 403, body: { error: 'a parent has not turned on sync' } };
    if (!rateOk('ip:' + (ip || '?'), Number(env.TAKHTI_SYNC_PER_HOUR || 120)) || !rateOk('c:' + c.id, 60)) return { status: 429, body: { error: 'too many syncs' } };
    const age = Number(c.age), name = String(c.name || '').trim().slice(0, 40);
    if (!name || !Number.isInteger(age) || age < 3 || age > 10) return { status: 400, body: { error: 'name and an age from 3 to 10 are needed' } };

    // who is this child on the server?
    let child = findByApp(c.id) || store.get('children', 'app_' + c.id);
    let key = null;
    if (child) {
      const k = child.circle && child.circle.app && child.circle.app.key_hash;
      if (k && !same(hash(body.key || ''), k)) return { status: 403, body: { error: 'this child belongs to another phone' } };
      if (!k && child.app_key && !same(body.key, child.app_key)) return { status: 403, body: { error: 'this child belongs to another phone' } };
    }
    // a family code from the school joins this app child to the school's record
    if (body.link) {
      const code = String(body.link).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const target = store.list('children').find(x => x.circle && x.circle.link_code === code);
      if (!target) return { status: 404, body: { error: 'that family code was not found', link: false } };
      if (target.circle.app && target.circle.app.id !== c.id) return { status: 409, body: { error: 'that family code is already used by another phone', link: false } };
      if (child && child.id !== target.id) mergeInto(child, target);
      child = target;
    }
    if (!child) {
      child = { id: 'app_' + c.id, kind: 'app', name: name.charAt(0).toUpperCase() + name.slice(1), age, lang: c.lang === 'en' ? 'en' : 'hi',
                parent_phone: null, consent: { given: false, status: 'app only' }, created_at: now().toISOString(),
                profile: core.freshProfile(name, age), sessions: [] };
    }
    const cc = ensure(child);
    if (!cc.app || !cc.app.key_hash) { key = tok(); cc.app = { id: c.id, key_hash: hash(key), since: now().toISOString() }; }
    cc.sync = { on: true, at: (cc.sync && !cc.stopped && cc.sync.at) || now().toISOString(), by: 'parent (app)', notice: SYNC_NOTICE, last: now().toISOString() };
    delete cc.stopped;
    // The app knows a child by the animal they tapped ("Tiger"), so it only
    // names a record the app itself made. A record the school made keeps the
    // school's name and age: the teacher's page, the messages and Munni's
    // calls must say "Aman", not "Tiger".
    if (child.kind === 'app') {
      child.name = name.charAt(0).toUpperCase() + name.slice(1); child.age = age;
      if (c.lang === 'en' || c.lang === 'hi') child.lang = c.lang;
    }
    if (body.parent_phone && /^\+\d{10,15}$/.test(String(body.parent_phone).replace(/[\s-]/g, ''))) child.parent_phone = child.parent_phone || String(body.parent_phone).replace(/[\s-]/g, '');

    // ---- up: progress only ----
    const p = body.progress || {};
    const seq = num(p.seq, 0, 1e12);
    if (!cc.app_snapshot || seq >= (cc.app_snapshot.seq || 0)) {
      cc.app_snapshot = { seq, at: now().toISOString(), skillHistory: cleanHistory(p.skillHistory),
        attempts: { read: num(p.attempts && p.attempts.read, 0, 1e6), write: num(p.attempts && p.attempts.write, 0, 1e6), math: num(p.attempts && p.attempts.math, 0, 1e6) },
        correct: { read: num(p.correct && p.correct.read, 0, 1e6), write: num(p.correct && p.correct.write, 0, 1e6), math: num(p.correct && p.correct.math, 0, 1e6) },
        stars: num(p.stars, 0, 1e6), cards: num(p.cards, 0, 1e4), srs: { due: num(p.srs && p.srs.due, 0, 1e5), total: num(p.srs && p.srs.total, 0, 1e5) } };
    }
    // levels: the app's, unless a phone lesson moved one since the last sync
    const levelsBack = {};
    core.withChild(child.profile, { lang: child.lang }, TT => {
      TT.S.age = age;
      const before = cc.levels_at_sync || {};
      for (const m of ['read', 'write', 'math']) {
        const server = TT.S.levels[m], app = num(p.levels && p.levels[m], 0, 6);
        const movedByPhone = before[m] != null && server !== before[m];
        if (movedByPhone) levelsBack[m] = server;
        else if (app) TT.S.levels[m] = TT.clampLevel(m, app);
      }
      if (p.classCode && /^[A-Z0-9]{6}$/.test(String(p.classCode)) && !TT.S.classCode) TT.S.classCode = String(p.classCode);
    });
    cc.levels_at_sync = { ...child.profile.levels };
    // the class code tells us the school (through its teacher)
    if (!child.school_id && child.profile.classCode) {
      const t = store.list('teachers').find(x => (x.class_codes || []).includes(String(child.profile.classCode).toUpperCase()));
      if (t && t.school_id) child.school_id = t.school_id;
    }
    // how this child thinks, as checked ids (src/core/twin.js): Munni's phone
    // lessons teach the app's way; found mistakes and unexplained sums go to
    // the shared database (voice/mistakes.js), counted without names
    const prof = body.profile ? core.T.twinCleanProfile(body.profile) : null;
    if (prof) { cc.app_profile = prof; if (brain.mistakes) brain.mistakes.record(child.id, prof); }
    put(child);

    // ---- what the app tells us happened in the circle ----
    if (body.check && body.check.week) checkResult(child, { week: String(body.check.week), right: num(body.check.right, 0, 3), of: num(body.check.of, 1, 3), source: 'app' });
    for (const h of [].concat(body.home || []).slice(0, 10)) {
      if (h && h.id && (h.answer === 'yes' || h.answer === 'no')) homeAsked(child, String(h.id), h.answer, 'app');
      if (h && h.id && h.answer === 'done') homeDone(child, String(h.id), 'parent (app)');
      if (h && h.id && h.answer === 'seen') {
        const x = brain.getChild(child.id), hh = x.circle.week && (x.circle.week.home || []).find(y => y.id === String(h.id));
        if (hh && !hh.seen_at) { hh.seen_at = now().toISOString(); put(x); }
      }
    }
    if (body.invite && body.invite.phone) await inviteTutor(child.id, body.invite, 'parent');
    if (body.tutor && body.tutor.id) tutorDecision(child.id, String(body.tutor.id), body.tutor.action);
    if (body.parent_lang === 'en' || body.parent_lang === 'hi') { const x = brain.getChild(child.id); x.parent_lang = body.parent_lang; put(x); }

    // ---- down: the circle ----
    const fresh = brain.getChild(child.id);
    const out = Object.assign({ child_id: fresh.id, circle: view(fresh, 'app') }, key ? { key } : {});
    if (brain.mistakes) out.mistake_rules = brain.mistakes.promoted();
    // what Munni's phone lessons saw of how this child thinks (the server's
    // twin), since the last sync — the app's twin adds it (twinFar)
    const ftw = fresh.profile && fresh.profile.twin, since = (fresh.circle && fresh.circle.twin_sent_at) || 0;
    if (ftw && ftw.recent) {
      const far = [];
      for (const [skill, rec] of Object.entries(ftw.recent)) for (const r of rec) if (r.at > since && !r.far && r.q) far.push({ skill, id: r.id, q: r.q, at: r.at });
      const guesses = (ftw.preds || []).filter(g => g.call && g.at > since).map(g => ({ skill: g.skill, hit: !!g.hit, rw: !!g.rw, at: g.at }));
      if (guesses.length) out.twin_guesses = guesses.slice(-40);
      const all = far.map(f => f.at).concat(guesses.map(g => g.at));
      if (far.length) out.twin_far = far.slice(-40);
      if (all.length) { const x = brain.getChild(child.id); x.circle.twin_sent_at = Math.max(...all); put(x); }
    }
    if (Object.keys(levelsBack).length) out.levels = levelsBack;
    return { status: 200, body: out };
  }

  /* The parent turns sync off (or erases) in the app. Off: nothing more is
     taken from the app, and the circle stops for this child — no weekly
     plan, no messages, no circle parts in calls — until the parent turns
     it on again. Erase: everything the circle keeps goes. A record only the
     app made goes whole; a record the school made keeps only what is the
     school's own (its registration, its phone lessons, its teachers'
     notes), which the family can ask the school to delete. */
  function leave(body) {
    body = body || {};
    const c = body.child || {};
    if (!/^[A-Za-z0-9_-]{4,60}$/.test(String(c.id || ''))) return { status: 400, body: { error: 'child id missing' } };
    const child = findByApp(c.id) || store.get('children', 'app_' + c.id);
    if (!child) return { status: 200, body: { ok: true, nothing: true } };     // nothing kept: already as the parent wants
    const k = child.circle && child.circle.app && child.circle.app.key_hash;
    if (!k || !same(hash(body.key || ''), k)) return { status: 403, body: { error: 'this child belongs to another phone' } };
    const at = now().toISOString();
    if (!body.erase) {
      const cc = ensure(child);
      cc.sync = Object.assign({}, cc.sync, { on: false, off_at: at });
      cc.stopped = { at, by: 'parent (app)' };
      delete cc.app_profile;                        // off: the app's picture of the child is not used any more
      put(child);
      dropQueued(child.id);
      return { status: 200, body: { ok: true, off: true } };
    }
    // messages about this child, sent or not, carry the parent's number and the child's name
    for (const m of store.list('outbox')) if (m.child_id === child.id) store.remove('outbox', m.id);
    for (const t of store.list('tutors')) if ((t.children || []).includes(child.id)) { t.children = t.children.filter(x => x !== child.id); store.put('tutors', t.id, t); }
    if (child.kind === 'app') { brain.deleteChild(child.id); return { status: 200, body: { ok: true, erased: 'all' } }; }
    // the school's record: the circle goes, and it stays off
    child.circle = { stopped: { at, by: 'parent (app)', erased: true } };
    if (brain.mistakes) brain.mistakes.forget(child.id);
    put(child);
    return { status: 200, body: { ok: true, erased: 'circle' } };
  }
  /* messages not yet sent about this child are dropped */
  function dropQueued(childId) {
    for (const m of store.list('outbox')) if (m.child_id === childId && m.status === 'queued') { m.status = 'skipped'; m.error = 'the parent turned the circle off'; store.put('outbox', m.id, m); }
  }

  /* an app child who had synced on its own, now joining the school's record */
  function mergeInto(from, to) {
    const a = ensure(from), b = ensure(to);
    b.app = a.app; b.app_snapshot = a.app_snapshot; b.sync = a.sync;
    for (const t of a.tutors) if (!b.tutors.some(x => x.id === t.id)) b.tutors.push(t);
    for (const sid of from.sessions || []) { const s = store.get('sessions', sid); if (s) { s.child_id = to.id; store.put('sessions', sid, s); } }
    to.sessions = (to.sessions || []).concat(from.sessions || []).slice(-200);
    for (const [id, e] of Object.entries(from.server_evidence || {})) {
      to.server_evidence = to.server_evidence || {};
      const o = to.server_evidence[id] || { n: 0, right: 0 }; o.n += e.n; o.right += e.right; to.server_evidence[id] = o;
    }
    for (const t of store.list('tutors')) if ((t.children || []).includes(from.id)) { t.children = t.children.map(x => x === from.id ? to.id : x); store.put('tutors', t.id, t); }
    store.remove('children', from.id);
    put(to);
  }

  /* the code a school hands a family, to join the app to the school's record */
  function familyCode(childId) {
    const child = brain.getChild(childId);
    if (!child) return null;
    const c = ensure(child);
    if (!c.link_code) { c.link_code = linkCode(); put(child); }
    return c.link_code;
  }

  /* ======================= THE WEEKLY FOCUS ======================= */
  const LADDER = require('./placement').LADDER.map(r => r[0]);
  function withHistory(child, fn) {
    // run the app's own engine on a copy carrying the combined evidence
    const copy = JSON.parse(JSON.stringify(child.profile));
    copy.skillHistory = EV.combinedHistory(child);
    return core.withChild(copy, { lang: child.lang }, fn).out;
  }
  const acc = h => h && h.n >= 4 ? h.right / h.n : null;

  function chooseFocus(child, c) {
    const hist = EV.combinedHistory(child);
    // 1. the class homework, adapted to this child by the app's diagnosis
    const hw = withHistory(child, TT => {
      const h = TT.personalizeContentForHomework(TT.S);
      if (!h) return null;
      const assigned = (TT.getAssignedHomework(TT.S) || {}).skills || [];
      return { skill: h.storySkill || assigned[0], assigned: assigned[0] || null, assignedAt: h.assignedAt };
    });
    if (hw && hw.skill) {
      const deeper = hw.assigned && hw.skill !== hw.assigned;
      const h = hist[hw.skill];
      return { skill: hw.skill, source: 'homework', homework_at: hw.assignedAt, assigned: hw.assigned,
        why: deeper ? { en: `The class is working on ${skillName(hw.assigned, 'en').toLowerCase()}. For ${child.name}, Takhti found the step underneath: ${skillName(hw.skill, 'en').toLowerCase()}${h && h.n ? ` (${h.right} of ${h.n} right so far)` : ''}.`,
                        hi: `कक्षा ${skillName(hw.assigned, 'hi')} पर काम कर रही है। ${child.name} के लिए तख़्ती को उसके नीचे का कदम मिला: ${skillName(hw.skill, 'hi')}${h && h.n ? ` (अब तक ${h.n} में से ${h.right} सही)` : ''}।` }
                      : { en: `The class is working on ${skillName(hw.skill, 'en').toLowerCase()} this week.`, hi: `इस हफ़्ते कक्षा ${skillName(hw.skill, 'hi')} पर काम कर रही है।` } };
    }
    // 2. a class test the teacher entered, under half marks in the last month:
    //    the school's own measure, so it comes before Takhti's guesses
    const test = (child.assessments || []).filter(a => a.got / a.of < 0.5 && Date.now() - Date.parse(a.at) < 30 * 864e5 && T.skillById(a.skill))
      .sort((x, y) => x.got / x.of - y.got / y.of)[0];
    if (test) return { skill: test.skill, source: 'school test',
      why: { en: `In the class test on ${skillName(test.skill, 'en').toLowerCase()}, ${child.name} got ${test.got} of ${test.of}. This week we teach it a new way.`,
             hi: `${skillName(test.skill, 'hi')} के कक्षा टेस्ट में ${child.name} के ${test.of} में से ${test.got} आए। इस हफ़्ते इसे नए तरीक़े से सिखाएँगे।` } };
    // 3. what last Friday's check suggested
    const last = c.history[c.history.length - 1];
    if (last && last.next && last.next.skill && T.skillById(last.next.skill)) return { skill: last.next.skill, source: 'last check', why: last.next.why };
    // 3. something a teacher or tutor noticed
    if (child.focus && Date.parse(child.focus.until) > Date.now() && T.skillById(child.focus.skill)) {
      return { skill: child.focus.skill, source: child.focus.source || 'note',
        why: { en: `${child.focus.source === 'class call' ? 'The class teacher' : 'A teacher'} noticed ${child.name} finds ${skillName(child.focus.skill, 'en').toLowerCase()} hard.`,
               hi: `${child.focus.source === 'class call' ? 'कक्षा के टीचर' : 'टीचर'} ने देखा कि ${child.name} को ${skillName(child.focus.skill, 'hi')} में दिक्कत होती है।` } };
    }
    // 4. the child's own weakest step, earliest in the curriculum first
    const weak = Object.entries(hist).filter(([id, h]) => acc(h) != null && acc(h) < 0.6 && T.skillById(id))
      .sort((a, b) => (T.skillById(a[0]).g - T.skillById(b[0]).g) || (acc(a[1]) - acc(b[1])));
    if (weak.length) {
      const [id, h] = weak[0];
      return { skill: id, source: 'takhti',
        why: { en: `${skillName(id, 'en')} is the earliest step ${child.name} isn't sure of yet (${h.right} of ${h.n} right).`,
               hi: `${skillName(id, 'hi')} वह पहला कदम है जो ${child.name} को अभी पक्का नहीं (${h.n} में से ${h.right} सही)।` } };
    }
    if (child.placement && child.placement.math && child.placement.math.next) {
      const id = child.placement.math.next;
      return { skill: id, source: 'placement', why: { en: `The placement call showed ${skillName(id, 'en').toLowerCase()} is the next step.`, hi: `प्लेसमेंट कॉल से पता चला कि अगला कदम ${skillName(id, 'hi')} है।` } };
    }
    // 5. the next step on the ladder after what they own
    const fits = withHistory(child, TT => LADDER.filter(sk => { const sp = TT.skillProblem(sk, 1); return sp && Math.max(sp.a, sp.ans) <= TT.band().maxNumber; }));
    // start where the child's maths level is, then step past anything they own
    const LV = Object.fromEntries(require('./placement').LADDER.map(r => [r[0], r[2]]));
    let next = fits.find(sk => LV[sk] >= (child.profile.levels.math || 1)) || fits[0];
    for (let i = fits.indexOf(next); i >= 0 && i < fits.length; i++) {
      if (acc(hist[fits[i]]) != null && acc(hist[fits[i]]) >= 0.8) next = fits[i + 1] || fits[i]; else break;
    }
    next = next || 'read' + Math.min(6, child.profile.levels.read || 2);
    return { skill: next, source: 'takhti', why: { en: `The next step for ${child.name}: ${skillName(next, 'en').toLowerCase()}.`, hi: `${child.name} का अगला कदम: ${skillName(next, 'hi')}।` } };
  }

  /* This week's focus (made, or remade if new homework arrived mid-week,
     or the teacher withdrew the homework this week was built on). */
  function focusFor(child, at) {
    const c = ensure(child);
    const lp = C.localParts(at || now(), env);
    const wk = isoWeek(lp.day);
    if (c.week && c.week.key !== wk) {
      c.history.push(summaryOf(c.week)); c.history = c.history.slice(-12);
      c.week = null;
    }
    const hwNow = withHistory(child, TT => { const h = TT.getAssignedHomework(TT.S); return h ? h.assignedAt : null; });
    const stale = c.week && c.week.source !== 'teacher' && (hwNow ? c.week.homework_at !== hwNow : c.week.source === 'homework');
    if (stale) { c.history.push(Object.assign(summaryOf(c.week), { replaced: hwNow ? 'new homework' : 'homework withdrawn' })); c.history = c.history.slice(-12); }
    if (!c.week || stale) {
      const f = chooseFocus(child, c);
      const hist = EV.combinedHistory(child);
      c.week = Object.assign({ key: wk, set_at: (at || now()).toISOString(), start: hist[f.skill] || { n: 0, right: 0 },
                               changed_mid_week: !!stale, home: [], check: null, tutor_results: [] }, f);
      c.week.home = homePlan(child, c.week);
      put(child);
    }
    return c.week;
  }
  function summaryOf(w) {
    return { key: w.key, skill: w.skill, source: w.source, check: w.check || null, next: w.check && w.check.next || null,
             home_done: (w.home || []).filter(h => h.done_at).length, home: (w.home || []).length, tutor: (w.tutor_results || []).length };
  }

  /* A teacher sets the class's focus (it rides on the same homework the
     app already understands, so every child's app adapts it the same way). */
  function setClassFocus(code, skill, note, by) {
    if (!T.skillById(skill)) return { error: 'no such skill' };
    const up = String(code).toUpperCase();
    const { out } = core.withChild(core.freshProfile('t', 7), {}, TT => { TT.assignHomework(up, [skill], String(note || '').slice(0, 140)); return TT.homeworkCode(up); });
    let n = 0;
    for (const child of classRoster(up)) {
      const c = ensure(child);
      if (c.week) { c.history.push(summaryOf(c.week)); c.history = c.history.slice(-12); c.week = null; }
      focusFor(child); n++;
      const fresh = brain.getChild(child.id);
      if (fresh.circle.week.source === 'homework') { fresh.circle.week.set_by = by || 'teacher'; put(fresh); }
    }
    return { ok: true, children: n, homework_code: out };
  }
  /* The class's homework as it stands, and withdrawing it. Withdrawn, every
     child's week built on it is remade from the child's own next step, and
     each synced app drops it on its next sync (homework_code goes null). */
  function classHomework(code) {
    const up = String(code).toUpperCase();
    return core.withChild(core.freshProfile('t', 7), {}, TT => { TT.S.classCode = up; return TT.getAssignedHomework(TT.S); }).out || null;
  }
  function clearClassFocus(code, by) {
    const up = String(code).toUpperCase();
    if (!classHomework(up)) return { ok: false, why: 'no class focus to withdraw' };
    core.withChild(core.freshProfile('t', 7), {}, TT => TT.clearHomework(up));
    let n = 0;
    for (const child of classRoster(up)) {
      const before = child.circle && child.circle.week;
      focusFor(child);                                           // remakes a week that was built on the homework
      if (before && before.source === 'homework') { n++; const fresh = brain.getChild(child.id); fresh.circle.week.withdrawn_by = by || 'teacher'; put(fresh); }
    }
    return { ok: true, children: n };
  }
  /* A class test: the teacher enters each child's marks on one topic. They
     are the school's own record (child.assessments); each synced app gets
     them (view → assessments) and changes how it teaches that topic. */
  function recordMarks(code, skill, of, marks, by) {
    if (!T.skillById(skill)) return { error: 'no such topic' };
    of = Number(of);
    if (!(of > 0 && of <= 1000)) return { error: 'out of what?' };
    const up = String(code).toUpperCase(), at = now().toISOString();
    let n = 0;
    for (const child of classRoster(up)) {
      const v = marks[child.id];
      if (v === '' || v == null) continue;
      const got = Number(v);
      if (!(got >= 0 && got <= of)) continue;
      child.assessments = (child.assessments || []).filter(a => !(a.skill === skill && a.at.slice(0, 10) === at.slice(0, 10)));
      child.assessments.unshift({ id: `t-${up}-${skill}-${at.slice(0, 10)}-${child.id}`, skill, got, of, by: by || 'teacher', at });
      child.assessments = child.assessments.slice(0, 60);
      // a low mark this week remakes the week around it
      if (got / of < 0.5) { const c = ensure(child); if (c.week && c.week.source !== 'homework') { c.history.push(summaryOf(c.week)); c.history = c.history.slice(-12); c.week = null; } }
      put(child); n++;
    }
    return { ok: true, children: n };
  }
  function classRoster(code) {
    const up = String(code).toUpperCase();
    return store.list('children').filter(c => c.profile && String(c.profile.classCode || '').toUpperCase() === up &&
      (c.kind !== 'app' || (c.circle && c.circle.sync && c.circle.sync.on)));
  }

  /* ======================= FRIDAY CHECK ======================= */
  // Friday to Sunday (TAKHTI_CHECK_DAYS, ISO weekdays)
  const checkDue = at => String(env.TAKHTI_CHECK_DAYS || '5,6,7').split(',').map(Number).includes(C.localParts(at || now(), env).weekday);
  function checkQuestions(child, week) {
    return withHistory(child, TT => [0, 1, 2].map(k => TT.skillProblem(week.skill, TT.seedOf(`${child.id}|check|${week.key}|${k}`))).filter(Boolean)
      .map(sp => ({ text: sp.text, answer: sp.ans, opts: sp.opts.map(Number), skill: sp.skillId })));
  }
  const isSpoken = (child, skill) => require('./session').skillSpoken(core, child, skill);

  function checkResult(childIn, r) {
    const child = brain.getChild(childIn.id) || childIn;
    const w = focusFor(child);
    if (r.week && r.week !== w.key) return { ok: false, why: 'another week' };
    if (w.check && w.check.done_at) return { ok: false, why: 'already done' };
    const of = Math.max(1, r.of), right = Math.min(of, r.right);
    const ratio = right / of;
    const verdict = ratio >= 0.8 ? 'mastered' : ratio >= 0.5 ? 'nearly' : 'not_yet';
    w.check = { done_at: now().toISOString(), right, of, source: r.source, verdict, next: nextAfter(child, w.skill, verdict) };
    put(child);
    if (messages) messages.checkDone(child, w);
    return { ok: true, check: w.check };
  }
  /* what next week should be, from this week's check */
  function nextAfter(child, skill, verdict) {
    const n = child.name;
    if (verdict === 'nearly') return { skill, why: { en: `${n} nearly has ${skillName(skill, 'en').toLowerCase()}: one more week will make it solid.`, hi: `${n} को ${skillName(skill, 'hi')} लगभग आ गया है: एक और हफ़्ता इसे पक्का कर देगा।` } };
    if (verdict === 'mastered') {
      let nx = null;
      const m = /^read(\d)$/.exec(skill);
      if (m) nx = 'read' + Math.min(6, Number(m[1]) + 1);
      else if (LADDER.includes(skill)) nx = LADDER[LADDER.indexOf(skill) + 1] || null;
      if (!nx) {
        // the skill graph: the first skill that stands on this one, earliest grade first
        const up = T.SKILLS.filter(x => (x.pre || []).includes(skill)).sort((a, b) => a.g - b.g)[0];
        nx = up ? up.id : null;
      }
      if (nx && withHistory(child, TT => { const sp = TT.skillHasProblem(nx) ? TT.skillProblem(nx, 1) : null; return !sp || Math.max(sp.a, sp.ans) <= TT.band().maxNumber; }))
        return { skill: nx, why: { en: `${n} has ${skillName(skill, 'en').toLowerCase()}. Next: ${skillName(nx, 'en').toLowerCase()}.`, hi: `${n} को ${skillName(skill, 'hi')} आ गया। अगला: ${skillName(nx, 'hi')}।` } };
      return { skill: null, why: { en: `${n} has ${skillName(skill, 'en').toLowerCase()}.`, hi: `${n} को ${skillName(skill, 'hi')} आ गया।` } };
    }
    // not yet: the app's own diagnosis looks underneath
    const under = withHistory(child, TT => {
      const plan = TT.diagnose([skill], TT.S);
      const gap = plan.find(p => p.verdict === 'gap' && p.skill.id !== skill) || plan.find(p => p.verdict === 'unseen' && !p.target);
      return gap ? gap.skill.id : null;
    });
    const nx = under || skill;
    return { skill: nx, why: nx === skill
      ? { en: `${skillName(skill, 'en')} needs another week, a little slower.`, hi: `${skillName(skill, 'hi')} को एक और हफ़्ता चाहिए, थोड़ा धीरे।` }
      : { en: `Before ${skillName(skill, 'en').toLowerCase()}, a step underneath: ${skillName(nx, 'en').toLowerCase()}.`, hi: `${skillName(skill, 'hi')} से पहले, नीचे का एक कदम: ${skillName(nx, 'hi')}।` } };
  }
  /* a reading focus (no single question to ask): the week's reading is the check */
  function readingCheck(child) {
    const w = focusFor(child);
    if (w.check || !/^read\d$|^h\d-|^e\d-/.test(w.skill)) return null;
    const h = EV.combinedHistory(child)[w.skill] || { n: 0, right: 0 };
    const dn = h.n - (w.start.n || 0), dr = h.right - (w.start.right || 0);
    if (dn < 3) return null;
    // scaled to the same "of 3" a parent sees for maths
    return checkResult(child, { right: Math.round(3 * dr / dn), of: 3, source: 'reading' });
  }

  /* ======================= HOME LOOP ======================= */
  function homePlan(child, w) {
    const g = homeGroup(w.skill);
    const letters = child.focus_letters && Date.parse(child.focus_letters.until) > Date.now() ? child.focus_letters.letters.join(', ') : '';
    const v = { name: child.name, letters: letters || (child.lang === 'hi' ? 'आज के' : "this week's") };
    const H = HOME[g];
    return [
      { id: `${w.key}-do`, kind: 'do', day: 1, group: g, text: { en: fillName(H.do.en, v), hi: fillName(H.do.hi, v) }, topic: H.topic },
      { id: `${w.key}-teach`, kind: 'teach', day: 3, group: g, text: { en: fillName(H.teach.en, v), hi: fillName(H.teach.hi, v) }, topic: H.topic }
    ];
  }
  function homeDone(childIn, id, by) {
    const child = brain.getChild(childIn.id) || childIn;
    const w = focusFor(child);
    const h = (w.home || []).find(x => x.id === id);
    if (!h || h.done_at) return { ok: false };
    h.done_at = now().toISOString(); h.done_by = by;
    put(child);
    return { ok: true };
  }
  /* Munni asked the child (on a call or in the app) */
  function homeAsked(childIn, id, answer, where) {
    const child = brain.getChild(childIn.id) || childIn;
    const w = focusFor(child);
    const h = (w.home || []).find(x => x.id === id);
    if (!h || h.child_said) return { ok: false };
    h.child_said = answer; h.asked_at = now().toISOString(); h.asked_where = where;
    if (answer === 'yes' && !h.done_at) { h.done_at = h.asked_at; h.done_by = 'the child said so'; }
    put(child);
    return { ok: true };
  }
  /* the activity Munni should ask about next, if any: a "teach" one that
     reached the family (sent, seen on their page or the app, or marked
     done) and has not been asked yet */
  function homeToAsk(child) {
    const w = child.circle && child.circle.week;
    if (!w) return null;
    return (w.home || []).find(h => h.kind === 'teach' && !h.child_said && (h.sent_at || h.seen_at || h.done_at)) || null;
  }

  /* ======================= TUTORS ======================= */
  function tutorByPhone(phone) { return store.list('tutors').find(t => t.phone === phone) || null; }
  /* Parent invites (active at once: the parent IS the consent), or the
     school links (pending until the parent approves). */
  async function inviteTutor(childId, input, by) {
    const child = brain.getChild(childId);
    if (!child) return { error: 'no such child' };
    const phone = String(input.phone || '').replace(/[\s-]/g, '');
    const name = String(input.name || '').trim().slice(0, 60);
    if (!/^\+\d{10,15}$/.test(phone)) return { error: 'phone must be in international format' };
    let t = tutorByPhone(phone);
    if (!t) {
      if (!name) return { error: 'a name is needed' };
      t = { id: 'tut_' + crypto.randomBytes(9).toString('base64url'), name, phone, lang: input.lang === 'en' ? 'en' : 'hi', token: tok(),
            children: [], schedule: null, school_id: by === 'school' ? (input.school_id || child.school_id || null) : null, created_at: now().toISOString() };
    }
    const c = ensure(child);
    const existing = c.tutors.find(x => x.id === t.id);
    const status = by === 'parent' ? 'active' : (existing && existing.status === 'active' ? 'active' : 'pending');
    if (existing) Object.assign(existing, { status, by: existing.by === 'parent' ? 'parent' : by });
    else c.tutors.push({ id: t.id, status, by, at: now().toISOString() });
    if (!t.children.includes(child.id)) t.children.push(child.id);
    store.put('tutors', t.id, t); put(child);
    if (messages) messages.tutorInvited(child, t, status, by);
    return { tutor: publicTutor(t), status };
  }
  function tutorDecision(childId, tutorId, action) {
    const child = brain.getChild(childId);
    if (!child) return { error: 'no such child' };
    const c = ensure(child);
    const link = c.tutors.find(x => x.id === tutorId);
    if (!link) return { error: 'no such tutor' };
    if (action === 'approve') {
      const was = link.status;
      link.status = 'active';
      const t = store.get('tutors', tutorId);
      if (was !== 'active' && t && messages) { put(child); messages.tutorInvited(child, t, 'active', link.by); }
    }
    else if (action === 'decline' || action === 'remove') {
      c.tutors = c.tutors.filter(x => x.id !== tutorId);
      const t = store.get('tutors', tutorId);
      if (t) { t.children = t.children.filter(x => x !== child.id); store.put('tutors', t.id, t); }
    }
    put(child);
    return { ok: true };
  }
  const tutorActive = (child, tutorId) => !!(child.circle && child.circle.tutors.some(x => x.id === tutorId && x.status === 'active'));
  function tutorChildren(t) { return (t.children || []).map(id => brain.getChild(id)).filter(ch => ch && tutorActive(ch, t.id)); }
  const publicTutor = t => ({ id: t.id, name: t.name, lang: t.lang });

  /* What a tutor needs before a session */
  function tutorPack(t, childIn) {
    const child = brain.getChild(childIn.id) || childIn;
    const w = focusFor(child);
    const lang = t.lang === 'en' ? 'en' : 'hi';
    const hist = EV.combinedHistory(child)[w.skill] || { n: 0, right: 0 };
    const week = { tries: hist.n - (w.start.n || 0), right: hist.right - (w.start.right || 0) };
    // what went wrong: the actual sums from this week's calls on the focus
    const since = Date.parse(w.set_at) - 7 * 864e5;
    const misses = [];
    for (const s of brain.childSessions(child).filter(s => Date.parse(s.created_at) >= since).reverse()) {
      for (const it of s.items || []) {
        if (misses.length >= 5) break;
        if (it.skill !== w.skill || !it.problem || it.outcome === 'correct' || !it.said.length) continue;
        misses.push({ problem: it.problem, answer: it.answer, said: it.said[0], silent: it.outcome === 'silent' });
      }
    }
    const qs = isSpoken(child, w.skill) || T.skillHasProblem(w.skill)
      ? withHistory(child, TT => [0, 1, 2].map(k => TT.skillProblem(w.skill, TT.seedOf(`${child.id}|tutor|${w.key}|${t.id}|${k}`))).filter(Boolean)
          .map(sp => { const wrong = sp.opts.map(Number).filter(o => o !== sp.ans); return { text: sp.text, answer: sp.ans, mistake: wrong[0], means: MISTAKE[w.skill] ? MISTAKE[w.skill][lang] : null }; }))
      : [];
    const quiet = Object.entries(child.quiet_skills || {}).filter(([, k]) => k >= 2).map(([id]) => skillName(id, lang));
    const notes = (child.teacher_notes || []).slice(-3).reverse().map(n => ({ by: n.by, skill: skillName(n.skill, lang), ok: n.ok, at: n.at, letters: n.letters }));
    return { child: { id: child.id, name: child.name, age: child.age }, week: w.key, skill: w.skill, skill_name: skillName(w.skill, lang),
             why: w.why[lang], so_far: week, misses, questions: qs, quiet, notes, home: (w.home || []).map(h => ({ text: h.text[lang], done: !!h.done_at })),
             check: w.check, level: { read: child.profile.levels.read, math: child.profile.levels.math } };
  }
  /* The tutor's ticks: real evidence, in the shared ledger */
  function tutorResult(t, childId, results) {
    const child = brain.getChild(childId);
    if (!child || !tutorActive(child, t.id)) return { error: 'not your student' };
    const w = focusFor(child);
    const marks = [].concat(results || []).slice(0, 10).map(r => r === true || r === 'yes' || r === '1' || r === 'right');
    if (!marks.length) return { error: 'nothing marked' };
    EV.ledger(child, () => core.withChild(child.profile, { lang: child.lang }, TT => {
      if (TT.skillById(w.skill)) for (const ok of marks) TT.noteSkillAttempt(w.skill, ok, TT.S);
      TT.mirrorToClassNow(TT.S);
    }));
    w.tutor_results.push({ tutor: t.id, by: t.name, at: now().toISOString(), right: marks.filter(Boolean).length, of: marks.length });
    put(child);
    return { ok: true, right: marks.filter(Boolean).length, of: marks.length };
  }
  /* A tutor's typed note: read like a teacher's voice note (notes.js) */
  function tutorNote(t, childId, text) {
    const child = brain.getChild(childId);
    if (!child || !tutorActive(child, t.id)) return { error: 'not your student' };
    const u = String(text || '').slice(0, 400);
    const letters = NT.lettersOf(u);
    const skill = NT.skillOf(u, child, letters) || focusFor(child).skill;
    const ok = NT.polarityOf(u);
    const note = { child_id: child.id, skill, ok: ok == null ? false : ok, letters, text: u };
    const r = brain.saveTeacherNote({ id: t.id, name: t.name + ' (tutor)' }, { id: 'tutor-page' }, note);
    return { ok: true, skill, polarity: note.ok, focus: !!r.focus };
  }
  function setTutorSchedule(t, days, time) {
    const tm = C.parseClock(time) || (/^\d{2}:\d{2}$/.test(String(time)) ? String(time) : null);
    const ds = [].concat(days || []).map(Number).filter(d => d >= 1 && d <= 7);
    if (!tm || !ds.length) return { error: 'choose days and a time' };
    t.schedule = { days: [...new Set(ds)].sort(), time: tm };
    store.put('tutors', t.id, t);
    return { ok: true, schedule: t.schedule };
  }

  /* ======================= WHAT EACH MEMBER SEES ======================= */
  function members(child) {
    const c = ensure(child);
    const school = child.school_id && store.get('schools', child.school_id);
    const code = child.profile && child.profile.classCode;
    const teachers = code ? store.list('teachers').filter(t => (t.class_codes || []).includes(String(code).toUpperCase())) : [];
    return { school: school ? school.name : null, class_code: code || null, teachers: teachers.map(t => t.name),
             tutors: c.tutors.map(x => { const t = store.get('tutors', x.id); return t ? { id: t.id, name: t.name, status: x.status, by: x.by } : null; }).filter(Boolean) };
  }
  function view(child, forWhom) {
    const w = focusFor(child);
    const lang = forWhom === 'app' ? child.lang : child.parent_lang || child.lang;
    const hwCode = withHistory(child, TT => TT.S.classCode ? TT.homeworkCode(TT.S.classCode) : null);
    const ask = homeToAsk(brain.getChild(child.id) || child);
    return {
      week: { key: w.key, skill: w.skill, skill_name: { en: skillName(w.skill, 'en'), hi: skillName(w.skill, 'hi') }, why: w.why, source: w.source,
              check: { due: checkDue() && !w.check && T.skillHasProblem(w.skill), done: !!w.check, ...(w.check || {}) ,
                       questions: checkDue() && !w.check && T.skillHasProblem(w.skill) ? checkQuestions(child, w) : [] },
              home: (w.home || []).map(h => ({ id: h.id, kind: h.kind, text: h.text, topic: h.topic, done: !!h.done_at, ask: !!(ask && ask.id === h.id) })) },
      members: members(child),
      notes: (child.teacher_notes || []).slice(-5).reverse().map(n => ({ by: n.by, skill: n.skill, skill_name: { en: skillName(n.skill, 'en'), hi: skillName(n.skill, 'hi') }, ok: n.ok, at: n.at })),
      homework_code: hwCode, circleHistory: child.server_evidence || {}, assessments: (child.assessments || []).slice(0, 20), parent_page: `${base()}/circle/p/${ensure(child).parent_token}`,
      synced_at: now().toISOString(), lang
    };
  }

  /* one class, for its teacher */
  function classView(code) {
    const kids = classRoster(code);
    return kids.map(ch => {
      const w = focusFor(ch);
      const hist = EV.combinedHistory(ch)[w.skill] || { n: 0, right: 0 };
      const c = ensure(ch);
      return { id: ch.id, name: ch.name, skill: w.skill, skill_name: skillName(w.skill, 'en'), source: w.source, why: w.why.en,
               week: { tries: hist.n - (w.start.n || 0), right: hist.right - (w.start.right || 0) },
               check: w.check || null, home: { done: (w.home || []).filter(h => h.done_at).length, of: (w.home || []).length },
               tutors: c.tutors.filter(x => x.status === 'active').map(x => (store.get('tutors', x.id) || {}).name).filter(Boolean),
               pending_tutors: c.tutors.filter(x => x.status === 'pending').length,
               app: !!(c.sync && c.sync.on), quiet: brain.quietSignal(ch), family_code: c.link_code || null };
    });
  }

  function attachMessages(m) { messages = m; }

  return { active, sync, leave, familyCode, focusFor, setClassFocus, clearClassFocus, classHomework, recordMarks, classRoster, classView, checkResult, readingCheck, checkQuestions, checkDue,
           homeDone, homeAsked, homeToAsk, inviteTutor, tutorDecision, tutorChildren, tutorPack, tutorResult, tutorNote, setTutorSchedule,
           members, view, attachMessages, isoWeek, ensure, skillName, HOME, SYNC_NOTICE,
           findByApp, hash, same,
           tutorByToken: tk => store.list('tutors').find(t => same(t.token, tk)) || null,
           childByParentToken: tk => store.list('children').find(c => c.circle && same(c.circle.parent_token, tk)) || null };
}

module.exports = { createCircle, isoWeek, homeGroup, HOME, MISTAKE };
