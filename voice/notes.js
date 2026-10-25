/* ==================================================================
   TEACHER VOICE NOTES — "Riya confused ण and न today"

   A teacher rings the same Munni number. The inbound lookup knows the
   number is a teacher's (brain.inboundLookup), so Munni takes a note
   instead of starting a lesson. From what the teacher says we find:

     which child   — matched by sound against the teacher's own classes
                     (रिया ↔ Riya), never anyone else's
     what          — a skill in the skill graph ("hasil" → carry,
                     "ण और न" → letter sounds, with the two letters kept)
     which way     — found it hard, or did well

   Anything missing is asked for. Then Munni reads the note back and saves
   it only on a yes, so a misheard name never lands on the wrong child.
   A saved note becomes one observed attempt on that skill (the same
   evidence the diagnosis reads: brain.saveTeacherNote), and, for a
   difficulty, what the child's next calls practise.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const { soundsLike } = require('./sounds');
const { strictYesNo } = require('./parent');
const { intentOf } = require('./understand');

const MAX_NOTES = 10, MAX_TURNS = 40;

/* ---------- what the note is about ---------- */
// most specific first: "hasil wala jod" is carrying, not addition
const SKILL_WORDS = [
  ['carry',    /\b(carry|carrying|hasil|haasil)\b|हासिल/i],
  ['borrow',   /\b(borrow|borrowing|udhaar|udhar)\b|उधार/i],
  ['divrem',   /\b(remainder|shesh|sheshphal)\b|शेषफल|शेष/i],
  ['tables',   /\b(tables?|pahada|pahade|pahadaa)\b|पहाड़|पहाड/i],
  ['mult2x1',  /\b(multipl\w*|guna|gunaa|times)\b|गुणा/i],
  ['divshare', /\b(divi\w*|bhag|bhaag|sharing)\b|भाग/i],
  ['place3',   /\b(hundreds|saikda|saikde|sau ke)\b|सैकड़/i],
  ['place2',   /\b(place value|ikai|dahai|tens and ones)\b|इकाई|दहाई/i],
  ['money2',   /\b(money|rupees?|paise|paisa)\b|रुपय|रुपए|पैस/i],
  ['time2',    /\b(clock|ghadi|ghari)\b|घड़ी|घडी/i],
  ['fracunit', /\b(fractions?|half|halves|quarter|aadha|bhinn)\b|भिन्न|आधा/i],
  ['skip',     /\b(skip count\w*)\b/i],
  ['sub',      /\b(subtract\w*|minus|ghata\w*|take away|taking away)\b|घटा/i],
  ['add',      /\b(add\w*|plus|jod|jodna|jodne)\b|जोड़|जोड/i],
  ['count20',  /\b(count\w*|ginti|ginna|ginne)\b|गिनती|गिन/i],
  ['h2-sanyukt', /\b(sanyukt|conjuncts?|half letters?|aadha akshar)\b|संयुक्त|आधा अक्षर/i],
  ['h1-matra', /\b(matras?|maatra\w*)\b|मात्रा/i],
  ['read2',    /\b(letters?|akshar|sounds?|varn|phonics)\b|अक्षर|वर्ण|ध्वनि/i],
  ['read',     /\b(read\w*|padh\w*)\b|पढ़|पढ/i],
  ['write',    /\b(writ\w*|likh\w*|handwriting)\b|लिख/i]
];
const NEG = [/\b(confus\w*|struggl\w*|difficult\w*|hard|problem|trouble|mistakes?|wrong|weak|can'?t|cannot|doesn'?t|didn'?t|forg[eo]t\w*|mix\w* up|dikkat|pareshani|galti|galat|kamzor|nahi aata|nahi aaya|nahin aata|bhool\w*|ulat\w*|mushkil|gadbad)\b/i,
             /दिक्कत|दिक़्क़त|परेशानी|गलती|ग़लती|गलत|ग़लत|कमज़ोर|कमजोर|नहीं आ|नही आ|भूल|उलट|मुश्किल|गड़बड़|गड़बड/];
const POS = [/\b(well|good|great|excellent|perfect|nicely|correctly|got it|understood|improv\w*|achha|accha|acha|badhiya|sahi|samajh gay\w*|aa gaya|aa gayi|shabash)\b/i,
             /शाबाश|अच्छा|अच्छे|बढ़िया|सही|समझ गए|समझ गई|आ गया|आ गई|सुधार/];

function polarityOf(said) {
  const u = String(said || '');
  const n = NEG.some(r => r.test(u)), p = POS.some(r => r.test(u));
  return n && !p ? false : p && !n ? true : null;      // false = found it hard
}

/* "ण और न", "ण aur न", "b and d" — two single letters named together */
const DEV_LETTER = /^[ऄ-हक़-ॡॲ-ॿ]़?$/;
function lettersOf(said) {
  const u = String(said || '').normalize('NFC');
  const toks = u.replace(/[.,!?;:"'“”‘’()।]/g, ' ').split(/\s+/).filter(Boolean);
  const dev = toks.filter(t => DEV_LETTER.test(t));
  if (dev.length >= 2) return [...new Set(dev)].slice(0, 4);
  const en = u.match(/\b([a-z])\s+(?:and|aur|or|with|for)\s+([a-z])\b/i);
  if (en && en[1].toLowerCase() !== en[2].toLowerCase() && !/^(a|i)$/i.test(en[1])) return [en[1].toLowerCase(), en[2].toLowerCase()];
  return null;
}

/* the skill for a note, at this child's level where the words alone are
   level-free ("addition" for a six-year-old is within 10, for a nine-year-old
   two digits; "reading" is the step they're on) */
function skillOf(said, child, letters) {
  const u = String(said || '');
  for (const [id, re] of SKILL_WORDS) {
    if (!re.test(u)) continue;
    const lv = (child && child.profile && child.profile.levels) || {};
    if (id === 'add') return child && child.age >= 7 ? 'add2' : 'add10';
    if (id === 'sub') return child && child.age >= 7 ? 'sub2' : 'sub10';
    if (id === 'read') return 'read' + Math.min(6, Math.max(1, lv.read || 2));
    if (id === 'write') return 'write' + Math.min(6, Math.max(1, lv.write || 2));
    return id;
  }
  return letters ? 'read2' : null;
}

/* the child named, among the teacher's own children only */
function childOf(said, kids) {
  const words = String(said || '').normalize('NFC').replace(/[.,!?;:"'“”‘’()।]/g, ' ').split(/\s+/).filter(Boolean);
  const hits = kids.filter(k => {
    const parts = k.name.split(/\s+/);
    return parts.some(p => words.some(w => soundsLike(p, w.replace(/(ने|को|का|की|के|ji|जी)$/, '') || w)));
  });
  return hits.length === 1 ? hits[0] : hits.length > 1 ? hits : null;
}

/* ---------- the lines ---------- */
const L = {
  greet: { en: t => `Namaste ${t}! It's Munni from Takhti. Which child is this about, and what did you notice today?`,
           hi: t => `नमस्ते ${t} जी! मैं तख़्ती से मुन्नी बोल रही हूँ। किस बच्चे के बारे में बताना है, और आज आपने क्या देखा?` },
  which: { en: names => `Which child is it? ${names ? 'In your classes I have ' + names + '.' : 'Please say their name.'}`,
           hi: names => `कौन सा बच्चा? ${names ? 'आपकी कक्षाओं में ' + names + ' हैं।' : 'कृपया बच्चे का नाम बताइए।'}` },
  twoKids: { en: names => `I have more than one child with that name: ${names}. Which one?`, hi: names => `इस नाम के एक से ज़्यादा बच्चे हैं: ${names}। कौन सा?` },
  what: { en: n => `What did you notice about ${n}? For example, "found carrying hard" or "read well today".`,
          hi: n => `${n} के बारे में आपने क्या देखा? जैसे, "हासिल वाले सवालों में दिक्कत" या "आज अच्छा पढ़ा"।` },
  way: { en: (n, what) => `Was ${what} hard for ${n}, or did it go well?`, hi: (n, what) => `क्या ${n} को ${what} में दिक्कत हुई, या अच्छा रहा?` },
  confirmHard: { en: (n, what) => `So: ${n} found ${what} hard. Shall I save that?`, hi: (n, what) => `तो: ${n} को ${what} में दिक्कत हुई। क्या मैं यह सेव कर लूँ?` },
  confirmGood: { en: (n, what) => `So: ${n} did well at ${what}. Shall I save that?`, hi: (n, what) => `तो: ${n} ने ${what} में अच्छा किया। क्या मैं यह सेव कर लूँ?` },
  saved: { en: n => `Saved for ${n}. Anything about another child?`, hi: n => `${n} के लिए सेव हो गया। किसी और बच्चे के बारे में कुछ?` },
  savedFocus: { en: n => `Saved for ${n}, and Munni will practise it on the next calls. Anything about another child?`,
                hi: n => `${n} के लिए सेव हो गया, और मुन्नी अगली कॉल्स में इसका अभ्यास कराएगी। किसी और बच्चे के बारे में कुछ?` },
  again: { en: () => 'Okay, please tell me again: which child, and what did you notice?', hi: () => 'ठीक है, कृपया फिर से बताइए: कौन सा बच्चा, और आपने क्या देखा?' },
  confirmAgain: { en: () => 'Shall I save it? Yes or no?', hi: () => 'क्या सेव करूँ? हाँ या नहीं?' },
  unsaved: { en: () => "I'll leave that one unsaved. Anything about another child?", hi: () => 'वह मैं सेव नहीं करूँगी। किसी और बच्चे के बारे में कुछ?' },
  bye: { en: t => `Thank you, ${t}! Goodbye.`, hi: t => `धन्यवाद ${t} जी! नमस्ते।` },
  notKnown: { en: () => "I couldn't find that child in your classes. Please say the name again.", hi: () => 'यह बच्चा आपकी कक्षाओं में नहीं मिला। कृपया नाम फिर से बताइए।' },
  letters: { en: l => `the letters ${l.join(' and ')}`, hi: l => `${l.join(' और ')} अक्षरों` }
};
const say = (k, lang, ...a) => L[k][lang === 'hi' ? 'hi' : 'en'](...a);
const joinNames = (kids, lang) => kids.slice(0, 6).map(k => k.name).join(lang === 'hi' ? ', ' : ', ');

function planNoteCall(teacher, o) {
  o = o || {};
  const lang = teacher.lang === 'en' ? 'en' : 'hi';
  const greeting = say('greet', lang, teacher.name);
  return {
    id: o.id || crypto.randomBytes(12).toString('base64url'), type: 'teacher', teacher_id: teacher.id,
    school_id: teacher.school_id || null, lang, greeting, status: 'planned', created_at: new Date().toISOString(),
    started_at: null, step: 'listen', turns: 0, items: [{ step: 'listen', prompts: [greeting], said: [], retries: 0 }],
    draft: {}, notes: [], done: false, goodbye: null
  };
}

function ask(s, step, text) { s.step = step; s.items.push({ step, prompts: [text], said: [], retries: 0 }); return { say: text, done: false }; }
function finish(s, text) { s.done = true; s.goodbye = text; s.ended_at = new Date().toISOString(); return { say: text, done: true }; }

/* skill name to say: from the skill graph, or the letters themselves */
function whatSay(d, lang, skillName) {
  if (d.letters && d.skill === 'read2') return say('letters', lang, d.letters);
  return skillName(d.skill) || '';
}

/* ctx: { teacher, kids, skillName(id) → name in this language, save(note) → {focus} } */
function noteTurn(s, said, ctx) {
  if (s.done) return { say: s.goodbye, done: true };
  if (!s.started_at) { s.started_at = new Date().toISOString(); s.status = 'live'; }
  s.turns++;
  const lang = s.lang, t = ctx.teacher;
  s.items[s.items.length - 1].said.push(String(said == null ? '' : said));
  if (s.turns > MAX_TURNS || s.notes.length >= MAX_NOTES) return finish(s, say('bye', lang, t.name));
  const u = String(said || '');
  const d = s.draft;

  if (s.step === 'confirm') {
    const yn = strictYesNo(u);
    if (yn === true) {
      const r = ctx.save({ child_id: d.child.id, skill: d.skill, ok: d.ok, letters: d.letters || null, text: d.text.join(' / ').slice(0, 400) });
      s.notes.push({ child_id: d.child.id, child_name: d.child.name, skill: d.skill, ok: d.ok, letters: d.letters || null, note_id: r.note_id });
      s.draft = {};
      return ask(s, 'listen', say(r.focus ? 'savedFocus' : 'saved', lang, d.child.name));
    }
    if (yn === false) { s.draft = {}; return ask(s, 'listen', say('again', lang)); }
    const it = s.items[s.items.length - 1];
    if (it.retries < 1) { it.retries++; it.prompts.push(say('confirmAgain', lang)); return { say: say('confirmAgain', lang), done: false }; }
    s.draft = {};
    return ask(s, 'listen', say('unsaved', lang));
  }

  // "that's all" while nothing is half-said ends the call
  // (only a short reply: "Riya ko hasil nahi aata" is a note, not a goodbye)
  const short = u.trim().split(/\s+/).length <= 4 && !childOf(u, ctx.kids) && !skillOf(u, null, lettersOf(u));
  const ending = short && (intentOf(u) === 'stop' || strictYesNo(u) === false);
  if (ending && s.step === 'listen' && !d.child && !d.skill) return finish(s, say('bye', lang, t.name));

  // gather whatever this sentence says, keeping what earlier ones said
  d.text = (d.text || []).concat(u);
  const kid = childOf(u, d.choices || ctx.kids);
  if (Array.isArray(kid)) d.choices = kid;
  else if (kid) { d.child = kid; delete d.choices; }
  const letters = lettersOf(u);
  if (letters) d.letters = letters;
  const sk = skillOf(u, d.child || null, d.letters);
  if (sk) d.skill = sk;
  const pol = polarityOf(u);
  if (pol !== null) d.ok = pol;
  // a level-free word heard before the child was known ("addition"): settle its level now
  if (d.child && d.skill && /^(add10|sub10|read\d|write\d)$/.test(d.skill)) d.skill = skillOf(d.text.join(' '), d.child, d.letters) || d.skill;

  if (!d.child) {
    if (d.choices) return ask(s, 'which', say('twoKids', lang, joinNames(d.choices, lang)));
    if (s.step === 'which') {
      d.misses = (d.misses || 0) + 1;
      if (d.misses >= 2) { s.draft = {}; return ask(s, 'listen', say('unsaved', lang)); }
      return ask(s, 'which', say('notKnown', lang));
    }
    return ask(s, 'which', say('which', lang, ctx.kids.length <= 6 ? joinNames(ctx.kids, lang) : ''));
  }
  if (!d.skill) return ask(s, 'what', say('what', lang, d.child.name));
  const what = whatSay(d, lang, ctx.skillName);
  if (d.ok == null) {
    // the answer to "hard, or went well?" may be just "hard" / "mushkil"
    if (s.step === 'way') { const yn = strictYesNo(u); if (yn !== null) d.ok = !yn; }
    if (d.ok == null) return ask(s, 'way', say('way', lang, d.child.name, what));
  }
  return ask(s, 'confirm', say(d.ok ? 'confirmGood' : 'confirmHard', lang, d.child.name, what));
}

module.exports = { planNoteCall, noteTurn, skillOf, childOf, lettersOf, polarityOf, L };
