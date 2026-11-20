/* ==================================================================
   AFTER THE CALL — what actually happened, and what the parent hears

   During the call the voice model relays the child's words to us. A
   language model can "helpfully" tidy a child's misreading into the
   correct sentence, or turn a wrong 8 into the right 9. So nothing the
   relay said becomes a permanent record of reading. When the call ends,
   Bolna sends its own transcript; we line each of Munni's prompts up
   against it, take the child's reply straight from the recognizer, and
   grade THAT with the app's matcher and the app's verdict — confidence
   gate included. That is the evidence of record.

   Where the relayed words and the transcript disagree we count it.
   That number is how we know whether the live loop can be trusted, and
   it goes on the team dashboard, not to parents.

   The parent report leads with what went well, names at most three
   words to practise, and suggests one thing to do at home. No scores
   out of ten, no "missed", nothing a child could overhear as failure.
   ================================================================== */
'use strict';
const { parseNumber, parseYesNo, foldDev, intentOf } = require('./understand');
const { gradeLine, recordOutcome } = require('./session');
const E = require('./english');
const { phraseScore } = require('./sounds');

const TERMINAL = new Set(['completed', 'no-answer', 'busy', 'failed', 'canceled', 'stopped', 'error', 'balance-low', 'call-disconnected']);

function parseTranscript(text) {
  const turns = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const m = raw.match(/^\s*(assistant|user|agent|bot|human|caller)\s*:\s*(.*)$/i);
    if (m) {
      const role = /assistant|agent|bot/i.test(m[1]) ? 'assistant' : 'user';
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.text += ' ' + m[2];   // a turn split across lines
      else turns.push({ role, text: m[2] });
    } else if (raw.trim() && turns.length) {
      turns[turns.length - 1].text += ' ' + raw.trim();
    }
  }
  return turns;
}

function toks(s, lang) {
  return String(s || '').normalize('NFC').replace(/[.,!?;:"'“”‘’()\[\]।॥…]/g, ' ')
    .split(/\s+/).filter(Boolean).map(t => (lang === 'hi' ? foldDev(t) : t.toLowerCase()));
}
function overlap(prompt, line, lang) {
  const p = toks(prompt, lang), l = new Set(toks(line, lang));
  if (!p.length) return 0;
  return p.filter(t => l.has(t)).length / p.length;
}

/* For every prompt Munni gave (first ask, clue, coaching), find it in the
   transcript and take the user turns that follow it, up to her next line. */
function alignToTranscript(session, turns) {
  let pos = 0;
  for (const it of session.items) {
    it.heard_tx = [];
    for (const prompt of it.prompts) {
      let hit = -1, best = 0;
      for (let i = pos; i < turns.length; i++) {
        if (turns[i].role !== 'assistant') continue;
        const o = overlap(prompt, turns[i].text, session.lang);
        if (o > best) { best = o; hit = i; }
        if (o >= 0.9) break;
      }
      if (hit < 0 || best < 0.6) { it.heard_tx.push(null); continue; }
      // the reply after this prompt; if the child asked to hear it again,
      // Munni repeated the same words — the answer follows the repeat
      let reply = null;
      for (let h = hit; h >= 0 && h < turns.length;) {
        const said = [];
        let j = h + 1;
        while (j < turns.length && turns[j].role === 'user') said.push(turns[j++].text);
        reply = said.join(' ').trim() || null;
        pos = h + 1;
        if (!reply || intentOf(reply) !== 'repeat') break;
        h = j < turns.length && overlap(prompt, turns[j].text, session.lang) >= 0.6 ? j : -1;
      }
      it.heard_tx.push(reply);
    }
  }
}

/* ---------- quiet moments, from Bolna's own transcript ----------
   Whether or not the live call told us (the graph's "hush" node), the
   transcript shows it: Munni says the same line twice with nothing from
   the child in between — the platform repeating after silence. And a call
   that ended on the quiet-hang-up line ended because the child went
   quiet. Both are kept as observations, never as wrong answers. */
const QUIET_END = /now (is not|isn't) a good time|अभी सही समय नहीं है/i;
function quietFromTranscript(session, text) {
  const lines = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const m = raw.match(/^\s*(assistant|user|agent|bot|human|caller)\s*:\s*(.*)$/i);
    if (m) lines.push({ role: /assistant|agent|bot/i.test(m[1]) ? 'assistant' : 'user', text: m[2] });
  }
  const byItem = {};
  let repeats = 0;
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i], b = lines[i - 1];
    if (a.role !== 'assistant' || b.role !== 'assistant' || overlap(a.text, b.text, session.lang) < 0.6) continue;
    repeats++;
    let best = 0, who = null;
    for (const it of session.items || []) for (const p of it.prompts || []) {
      const o = overlap(p, a.text, session.lang);
      if (o > best) { best = o; who = it; }
    }
    if (who && best >= 0.6) byItem[who.n] = (byItem[who.n] || 0) + 1;
  }
  const last = lines.filter(l => l.role === 'assistant').pop();
  return { repeats, byItem, ended: !!(last && QUIET_END.test(last.text)) };
}
/* what the call's quiet moments add up to, kept on the session and the child */
function settleQuiet(child, session) {
  const tx = quietFromTranscript(session, session.transcript);
  const items = new Set((session.silence_log || []).map(x => x.n));
  for (const it of session.items || []) {
    it.silent_tx = tx.byItem[it.n] || 0;
    if (it.silent_tx || it.silences) items.add(it.n);
  }
  session.silence = { live: (session.silence_log || []).length, transcript: tx.repeats, items: [...items].sort((a, b) => a - b),
                      ended_in_silence: tx.ended || session.ended_by === 'quiet' };
  child.last_call_session = session.id;
  if (session.silence.items.length || session.silence.ended_in_silence) {
    child.quiet = (child.quiet || []).concat({ at: new Date().toISOString(), session: session.id, items: session.silence.items.length,
                                               ended: session.silence.ended_in_silence }).slice(-30);
    child.quiet_skills = child.quiet_skills || {};
    for (const it of session.items || []) if ((it.silences || it.silent_tx) && it.skill) child.quiet_skills[it.skill] = (child.quiet_skills[it.skill] || 0) + 1;
  }
  return session.silence;
}

/* The call is over: settle the record. Idempotent per execution id. */
function processCallEnd(core, child, session, payload) {
  const status = String(payload.status || '').toLowerCase();
  if (!TERMINAL.has(status)) return { changed: false, reason: 'not terminal: ' + status };
  // idempotent per call: the id placeCall() stored is the call to settle,
  // so the guard is the id we last SETTLED, not the last one we dialled
  if (session.processed && session.processed_exec === payload.id) return { changed: false, reason: 'already processed' };

  const tel = payload.telephony_data || {};
  session.call = Object.assign(session.call || {}, {
    execution_id: payload.id, status, smart_status: payload.smart_status || null,
    duration_s: Number(payload.conversation_duration || tel.duration || 0),
    recording_url: tel.recording_url || null, hangup_by: tel.hangup_by || null,
    hangup_reason: tel.hangup_reason || null, answered_by_voice_mail: !!payload.answered_by_voice_mail,
    cost_cents: payload.total_cost != null ? payload.total_cost : null
  });
  session.transcript = String(payload.transcript || '');
  session.processed = true; session.processed_exec = payload.id;
  session.processed_at = new Date().toISOString();

  // safeguarding is a human's job, never automated messaging — flag only
  session.flags = session.flags || {};
  if (findTrue(payload.extracted_data, /safeguard|safety|concern/i)) session.flags.safeguarding = true;

  if (!session.items.length) {
    // the phone was answered but no lesson started (child not there,
    // voicemail), or it was never answered. Nothing is recorded either way.
    session.status = session.call.duration_s > 0 && !session.call.answered_by_voice_mail ? 'no_lesson' : 'missed';
    if (session.status === 'no_lesson') settleQuiet(child, session);
    session.report = missedReport(child, session);
    return { changed: true, status: session.status };
  }
  session.status = 'done';

  const turns = parseTranscript(session.transcript);
  alignToTranscript(session, turns);
  settleQuiet(child, session);

  // relay check: did the words the model passed us match the recognizer?
  let checked = 0, mismatched = 0;
  for (const it of session.items) {
    it.said.forEach((relayed, k) => {
      const tx = it.heard_tx && it.heard_tx[k];
      if (tx == null) return;
      checked++;
      if (it.expect === 'number' && parseNumber(relayed, session.lang) !== parseNumber(tx, session.lang)) mismatched++;
      else if (it.expect === 'yesno' && parseYesNo(relayed) !== parseYesNo(tx)) mismatched++;
      else if (it.expect === 'reading' && Math.abs(gradeLine(core, child, session, it.target, [relayed]).score -
                                                   gradeLine(core, child, session, it.target, [tx]).score) >= 15) mismatched++;
      else if (it.expect === 'english' && E.gradeWord(it, relayed) !== E.gradeWord(it, tx)) mismatched++;
      else if (it.expect === 'phrase' && Math.abs(phraseScore(it.target, relayed).score - phraseScore(it.target, tx).score) >= 15) mismatched++;
    });
  }
  session.relay = { checked, mismatched };

  // spoken English, settled from the transcript like reading: the word
  // history that picks tomorrow's words (voice record only — English is
  // practice, not an app level)
  if (session.kind === 'english' && !session.recorded_english) {
    const { out: th } = core.withChild(child.profile, { lang: session.lang }, T => T.getGradeThresholds());
    child.english_words = child.english_words || {};
    for (const it of session.items) {
      if (!['eword', 'esay', 'ephrase'].includes(it.kind)) continue;
      const txs = (it.heard_tx || []).filter(Boolean);
      const alts = txs.length ? txs : it.said.filter(Boolean);
      const source = txs.length ? 'transcript' : 'relay';
      if (!alts.length) { it.evidence = { source, verdict: 'unsure' }; continue; }
      let first, best;
      if (it.kind === 'eword') {
        first = E.gradeWord(it, alts[0]) ? 'pass' : 'coach';
        best = alts.some(a => E.gradeWord(it, a)) ? 'pass' : 'coach';
      } else {
        first = E.gradePhrase(it, alts[0], th.pass, th.gateScore).verdict;
        best = alts.map(a => E.gradePhrase(it, a, th.pass, th.gateScore).verdict).includes('pass') ? 'pass' : first;
      }
      it.evidence = { source, first_verdict: first, verdict: best };
      if (it.word && first !== 'unsure') {
        const h = child.english_words[it.word] || { n: 0, right: 0 };
        h.n++; if (first === 'pass') h.right++;
        child.english_words[it.word] = h;
      }
    }
    session.recorded_english = true;
  }

  // reading evidence of record: the transcript, graded by the app's matcher
  for (const it of session.items) {
    if (it.expect !== 'reading') continue;
    const txs = (it.heard_tx || []).filter(Boolean);
    const source = txs.length ? 'transcript' : 'relay';
    const alts = txs.length ? txs : it.said.filter(Boolean);
    if (!alts.length) { it.evidence = { source, verdict: 'unsure', score: 0 }; continue; }
    const first = gradeLine(core, child, session, it.target, [alts[0]]);
    const best = gradeLine(core, child, session, it.target, alts);
    // words to practise: what tripped them up the FIRST time, even if a
    // second reading after Munni's coaching came out clean
    const misread = [...new Set([...practiceWords(first.tokens), ...practiceWords(best.tokens)])];
    it.evidence = { source, first_verdict: first.verdict, verdict: best.verdict, score: best.score,
                    misread, slips: best.slips,
                    // word by word, what the recognizer heard the first time:
                    // the raw material of the misreading corpus (corpus.js)
                    tokens: first.tokens };
    // only a first reading of a card line counts toward the reading level;
    // a line said after Munni is speaking practice, not reading
    if (it.kind === 'read' && !session.recorded_read && first.verdict !== 'unsure' && !it.eased) {
      const mv = recordOutcome(core, child, session, 'read', first.verdict === 'pass', it);
      it.evidence.level_move = mv || null;
    }
  }
  session.recorded_read = true;
  session.levels_after = { ...child.profile.levels };
  session.report = buildReport(core, child, session);
  return { changed: true, status: session.status };
}

/* A word is worth practising if the child misread it, slipped on it, or
   skipped it in the MIDDLE of a line. Words after the point where they
   simply stopped reading were never attempted — "है" is not a word to
   drill just because the child stopped two words in. */
function practiceWords(tokens) {
  const out = [];
  (tokens || []).forEach((t, i) => {
    const laterRead = tokens.slice(i + 1).some(x => x.state !== 'miss');
    if (t.state === 'bad' || t.state === 'near' || (t.state === 'miss' && laterRead)) out.push(t.text);
  });
  return out;
}

function findTrue(obj, keyRe, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return false;
  for (const [k, v] of Object.entries(obj)) {
    if (keyRe.test(k)) {
      const val = v && typeof v === 'object' ? (v.objective ?? v.subjective ?? v.value) : v;
      if (val === true || /^(true|yes|haan|हाँ|1)$/i.test(String(val).trim())) return true;
    }
    if (v && typeof v === 'object' && findTrue(v, keyRe, depth + 1)) return true;
  }
  return false;
}

/* ---------------- the parent report ---------------- */
const R = {
  title:    { en: '{name} practised with Munni today', hi: '{name} ने आज मुन्नी के साथ अभ्यास किया' },
  minutes:  { en: 'About {m} minutes on the call.', hi: 'लगभग {m} मिनट बात हुई।' },
  minute:   { en: 'About a minute on the call.', hi: 'लगभग एक मिनट बात हुई।' },
  maths:    { en: 'Maths: worked on {n} sums, {c} right on the first try.', hi: 'गणित: {n} सवाल किए, {c} पहली बार में सही।' },
  level:    { en: 'Now practising: {comp}.', hi: 'अभी अभ्यास: {comp}।' },
  reading:  { en: 'Reading: read {g} of {n} lines well.', hi: 'पढ़ना: {n} में से {g} लाइनें अच्छे से पढ़ीं।' },
  oral:     { en: 'Speaking: said {g} of {n} lines after Munni.', hi: 'बोलना: मुन्नी के बाद {n} में से {g} लाइनें बोलीं।' },
  words:    { en: 'Worth practising together: {w}.', hi: 'साथ में अभ्यास करें: {w}।' },
  tipMath:  { en: 'Tip for today: count something together at dinner, like rotis or spoons.', hi: 'आज की सलाह: खाने के समय साथ में कुछ गिनें, जैसे रोटियाँ या चम्मच।' },
  tipRead:  { en: 'Tip for today: find the word "{w}" together on a sign, a box or a newspaper.', hi: 'आज की सलाह: "{w}" शब्द किसी बोर्ड, डिब्बे या अख़बार पर साथ में ढूँढें।' },
  tipGood:  { en: 'Tip for today: ask {name} to teach you one sum from the call.', hi: 'आज की सलाह: {name} से कहें कि कॉल का एक सवाल आपको सिखाए।' },
  quiet:    { en: "{name} went quiet on {k}. That's okay: a quiet moment often means a question felt hard. Munni will start the next call a little easier.",
              hi: '{k} पर {name} की ओर से जवाब नहीं आया। कोई बात नहीं: अक्सर इसका मतलब होता है कि सवाल कठिन लगा। अगली कॉल मुन्नी थोड़ी आसान शुरुआत से करेगी।' },
  quietOne: { en: 'one question', hi: 'एक सवाल' }, quietMany: { en: '{k} questions', hi: '{k} सवालों' },
  quietEnd: { en: 'The call ended because {name} went quiet. That is fine; nothing is lost.', hi: 'कॉल इसलिए ख़त्म हुई क्योंकि {name} की ओर से जवाब नहीं आ रहा था। कोई बात नहीं, कुछ भी नहीं बिगड़ा।' },
  stopped:  { en: '{name} chose to stop early today, which is completely fine.', hi: '{name} ने आज जल्दी रुकना चुना, यह बिल्कुल ठीक है।' },
  missed:   { en: 'Munni could not reach {name} today.', hi: 'मुन्नी आज {name} से बात नहीं कर पाई।' },
  noLesson: { en: "Munni called, but today's lesson with {name} didn't happen. That's fine.", hi: 'मुन्नी ने फ़ोन किया, पर आज {name} के साथ पाठ नहीं हो पाया। कोई बात नहीं।' },
  retry:    { en: 'She will try once more at {clock}.', hi: 'वह {clock} एक बार और कोशिश करेगी।' },
  next:     { en: 'The next call is {when}.', hi: 'अगली कॉल {when} होगी।' },
  short1:   { en: '{name} practised with Munni today: {parts}.', hi: '{name} ने आज मुन्नी के साथ अभ्यास किया: {parts}।' },
  short1b:  { en: '{name} practised with Munni today.', hi: '{name} ने आज मुन्नी के साथ अभ्यास किया।' },
  pSums:    { en: '{c} of {n} sums right first time', hi: '{n} में से {c} सवाल पहली बार में सही' },
  pRead:    { en: '{g} of {n} lines read well', hi: '{n} में से {g} लाइनें अच्छे से पढ़ीं' },
  pEng:     { en: '{k} of {n} English words straight away', hi: '{n} में से {k} अंग्रेज़ी शब्द तुरंत' },
  good:     { en: 'A good lesson today.', hi: 'आज का पाठ अच्छा रहा।' },
  enWords:  { en: 'Spoken English: knew {k} of {n} words straight away.', hi: 'अंग्रेज़ी बोलना: {n} में से {k} शब्द तुरंत बताए।' },
  enPhrases:{ en: 'Said {k} of {n} English sentences clearly.', hi: 'अंग्रेज़ी के {n} में से {k} वाक्य साफ़ बोले।' },
  enPractise:{ en: 'English words to use at home: {w}.', hi: 'घर पर इन अंग्रेज़ी शब्दों का इस्तेमाल करें: {w}।' },
  tipEnglish:{ en: 'Tip for today: ask {name} to say "{w}" in English when you see one.', hi: 'आज की सलाह: जब भी दिखे, {name} से उसका अंग्रेज़ी नाम "{w}" बुलवाएँ।' },
  homework: { en: "{name} also did a question from the teacher's homework.", hi: '{name} ने टीचर के होमवर्क का एक सवाल भी किया।' },
  focusDone: { en: '{name} also practised something the teacher asked for.', hi: '{name} ने वह भी अभ्यास किया जो टीचर ने कहा था।' },
  teachAll: { en: '{name} taught Appu everything he "forgot" about {topic}, out loud.', hi: '{name} ने अप्पू को {topic} की वे सब बातें बोलकर सिखाईं जो वह "भूल" गया था।' },
  teachSome:{ en: '{name} taught Appu {c} of {m} things about {topic}. Appu will ask the rest again another day.', hi: '{name} ने अप्पू को {topic} की {m} में से {c} बातें सिखाईं। बाक़ी अप्पू किसी और दिन फिर पूछेगा।' },
  teachNone:{ en: '{name} tried to teach Appu about {topic}. Explaining is hard; Appu will ask again another day.', hi: '{name} ने अप्पू को {topic} सिखाने की कोशिश की। समझाना मुश्किल होता है; अप्पू किसी और दिन फिर पूछेगा।' },
  teacher:  { en: 'To share this practice with the teacher, send them this code:', hi: 'यह अभ्यास टीचर तक पहुँचाने के लिए उन्हें यह कोड भेजें:' },
  footer:   { en: '— Takhti', hi: '— तख़्ती' }
};

/* The app's own progress code (core/class-share.js), for a child linked
   to a class. The name is labelled so the teacher can tell phone practice
   from the same child's practice in the app. */
function progressCodeFor(core, child) {
  if (!child.profile || !child.profile.classCode) return null;
  const { out } = core.withChild(child.profile, { lang: child.lang }, T =>
    T.classReportCode(Object.assign({}, T.S, { name: T.S.name + ' (phone)' })));
  return out;
}
const t = (k, lang, v) => { let s = R[k][lang] || R[k].en; for (const x in (v || {})) s = s.split('{' + x + '}').join(v[x]); return s; };

function buildReport(core, child, session) {
  const lang = session.lang, name = child.name;
  const lines = [t('title', lang, { name })];
  const mins = Math.max(1, Math.round((session.call && session.call.duration_s || 0) / 60));
  if (session.call && session.call.duration_s) lines.push(mins === 1 ? t('minute', lang, {}) : t('minutes', lang, { m: mins }));

  const sums = session.items.filter(x => ['math', 'story', 'homework', 'check'].includes(x.kind) && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent');
  const firstTry = sums.filter(x => x.outcome === 'correct').length;
  if (sums.length) {
    lines.push(t('maths', lang, { n: sums.length, c: firstTry }));
    const { out: comp } = core.withChild(child.profile, { lang }, T => {
      const c = T.COMPETENCY.math[T.S.levels.math]; return c ? c[lang] : '';
    });
    if (comp) lines.push(t('level', lang, { comp }));
  }

  const reads = session.items.filter(x => x.kind === 'read' && x.evidence && x.evidence.verdict !== 'unsure');
  const oral = session.items.filter(x => x.kind === 'repeat' && x.evidence && x.evidence.verdict !== 'unsure');
  if (reads.length) lines.push(t('reading', lang, { g: reads.filter(x => x.evidence.verdict === 'pass').length, n: reads.length }));
  if (oral.length) lines.push(t('oral', lang, { g: oral.filter(x => x.evidence.verdict === 'pass').length, n: oral.length }));

  const words = [];
  for (const x of reads) for (const w of (x.evidence.misread || []).concat(x.evidence.slips || [])) {
    const clean = w.replace(/[.,!?।]/g, '');
    if (clean && !words.includes(clean)) words.push(clean);
  }
  if (words.length) lines.push(t('words', lang, { w: words.slice(0, 3).join(', ') }));
  // spoken English (an English-practice call)
  const ew = session.items.filter(x => (x.kind === 'eword' || x.kind === 'esay') && x.evidence && x.evidence.verdict !== 'unsure');
  const ep = session.items.filter(x => x.kind === 'ephrase' && x.evidence && x.evidence.verdict !== 'unsure');
  const eMissed = ew.filter(x => x.evidence.first_verdict !== 'pass').map(x => x.word);
  if (ew.length) lines.push(t('enWords', lang, { k: ew.filter(x => x.evidence.first_verdict === 'pass').length, n: ew.length }));
  if (ep.length) lines.push(t('enPhrases', lang, { k: ep.filter(x => x.evidence.verdict === 'pass').length, n: ep.length }));
  if (eMissed.length) lines.push(t('enPractise', lang, { w: eMissed.slice(0, 3).join(', ') }));

  const hw = session.items.find(x => x.kind === 'homework' && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent');
  if (hw) lines.push(t(hw.focus ? 'focusDone' : 'homework', lang, { name }));
  // Teach Appu on the call: how many points the child taught him
  const taught = session.items.find(x => x.kind === 'teach' && x.teach_result);
  if (taught) {
    const tr = taught.teach_result, topic = (tr.title && (tr.title[lang] || tr.title.en)) || '';
    lines.push(t(tr.covered === tr.m ? 'teachAll' : tr.covered ? 'teachSome' : 'teachNone', lang, { name, c: tr.covered, m: tr.m, topic: lang === 'hi' ? topic : topic.toLowerCase() }));
  }
  if (session.ended_by === 'stop') lines.push(t('stopped', lang, { name }));
  const q = session.silence;
  if (q && q.ended_in_silence) lines.push(t('quietEnd', lang, { name }));
  else if (q && q.items.length) lines.push(t('quiet', lang, { name, k: q.items.length === 1 ? t('quietOne', lang, {}) : t('quietMany', lang, { k: q.items.length }) }));

  if (session.kind === 'english') {
    const w = eMissed[0] || (ew[0] && ew[0].word);
    if (w) lines.push(t('tipEnglish', lang, { w, name }));
  } else if (words.length) lines.push(t('tipRead', lang, { w: words[0] }));
  else if (sums.length && firstTry < sums.length / 2) lines.push(t('tipMath', lang, {}));
  else lines.push(t('tipGood', lang, { name }));

  // linked to a class: the progress code the app's parent dashboard would
  // offer ("Send to the teacher"), so phone practice reaches the teacher
  // view by the same code, pasted by the same people
  const code = progressCodeFor(core, child);
  if (code) { lines.push(t('teacher', lang, {})); lines.push(code); }
  lines.push(t('footer', lang, {}));

  const text = lines.join('\n');
  const phone = String(child.parent_phone || '').replace(/[^\d]/g, '');

  // three single lines for a WhatsApp template (no line breaks allowed in
  // a template variable): what was done, what to practise, one tip
  const parts = [];
  if (sums.length) parts.push(t('pSums', lang, { c: firstTry, n: sums.length }));
  if (reads.length) parts.push(t('pRead', lang, { g: reads.filter(x => x.evidence.verdict === 'pass').length, n: reads.length }));
  if (ew.length) parts.push(t('pEng', lang, { k: ew.filter(x => x.evidence.first_verdict === 'pass').length, n: ew.length }));
  const tip = lines.find(l => /^(Tip for today|आज की सलाह)/.test(l));
  const second = lines.find(l => /^(Worth practising|साथ में अभ्यास|English words to use|घर पर इन अंग्रेज़ी)/.test(l)) || t('good', lang, {});
  const short = [parts.length ? t('short1', lang, { name, parts: parts.join(', ') }) : t('short1b', lang, { name }), second, tip || t('footer', lang, {})]
    .map(l => l.replace(/\s+/g, ' ').trim());
  return { lang, text, lines, short,
           // for the team: open a WhatsApp chat with this parent, report typed in
           whatsapp: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null,
           // for the parent: forward it to the other parent or the teacher
           share: `https://wa.me/?text=${encodeURIComponent(text)}` };
}

/* A call with no lesson. The message says only what will really happen
   next (info comes from the scheduler): a retry, the next scheduled call,
   or nothing at all. */
function missedReport(child, session, info) {
  info = info || {};
  const lang = session.lang;
  const C = require('./clock');
  const parts = [t(session.status === 'no_lesson' ? 'noLesson' : 'missed', lang, { name: child.name })];
  if (info.retry) parts.push(t('retry', lang, { clock: C.clockSay(info.retry, lang) }));
  else if (info.next) parts.push(t('next', lang, { when: C.whenSay(info.next.day, info.next.time, lang) }));
  const text = parts.join(' ');
  return { lang, text, lines: [text], short: [parts[0], parts[1] || (lang === 'hi' ? 'धन्यवाद।' : 'Thank you.'), t('footer', lang, {})], missed: true };
}

module.exports = { settleQuiet, quietFromTranscript, processCallEnd, parseTranscript, alignToTranscript, buildReport, missedReport, progressCodeFor, TERMINAL };
