/* ==================================================================
   A PHONE LESSON — what Munni says, what counts, when it ends

   The language model on the call is a voice, not a teacher. It speaks
   the `say` this file hands back, word for word, and passes the child's
   words back in. Every decision a teacher would make — which problem,
   whether the answer is right, when to hint, when to stop — is made
   here, deterministically, with the app's own engine.

   That is the phone version of lesson-gen.js's safety argument: an LLM
   never decides what a child hears. If the model wanders, the next tool
   call still returns a correct, age-banded, validated line.

   Shape of a call (about 6 minutes):
     warm-up count (not scored)  → three adaptive sums (genProblem +
     record) → one story problem from the validated lesson bank →
     two or three lines read from today's card (the matcher grades)
   For 3–4 year olds the reading lines become "say it after me".

   Things this file promises, and the tests check:
   - Never "wrong". A first miss gets a two-choice clue built from the
     closest distractor; a second gets the answer, kindly, and moves on.
   - A doubt is not a miss. No number heard, or a reading the matcher
     calls 'unsure', asks again once and then moves on recording nothing.
   - Only first-try answers count toward a level-up. A sum solved after
     a clue is a good moment, not evidence of mastery.
   - Every line exists in Hindi and English.
   - The call ends on time, on the child's "bas", or after the plan —
     whichever comes first. No "come back tomorrow" pressure.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const { parseNumber, parseYesNo, intentOf, numberWord } = require('./understand');
const E = require('./english');

const MAX_CALL_MS = 8 * 60 * 1000;     // a lesson for a five-year-old, not a lecture
const MAX_TURNS = 40;                  // hard stop however the call goes

/* ---------------- every line Munni can say, both languages ---------------- */
const L = {
  start:      { en: "Let's begin!", hi: 'चलो शुरू करें!' },
  // when the child goes quiet: an easier way in, never a scolding
  quietClue:  { en: 'Take your time. Is it {x} or {y}?', hi: 'आराम से सोचो। {x} या {y}?' },
  quietYN:    { en: 'Take your time. Just say yes or no.', hi: 'आराम से सोचो। बस हाँ या नहीं बोलो।' },
  quietRead:  { en: 'Take your time. Start with: {start}', hi: 'आराम से। ऐसे शुरू करो: {start}' },
  quietRepeat:{ en: 'Take your time. Say it with me: {line}', hi: 'आराम से। मेरे साथ बोलो: {line}' },
  quietAgain: { en: 'Take your time. Here it is again: {prompt}', hi: 'आराम से सोचो। फिर से सुनो: {prompt}' },
  quietMoveOn:{ en: "That's okay! Let's try a different one.", hi: 'कोई बात नहीं! चलो, कोई दूसरा करते हैं।' },
  warmCount:  { en: 'Count with me: {seq}. What comes next?', hi: 'मेरे साथ गिनो: {seq}। आगे क्या आता है?' },
  warmSkip:   { en: 'Count in {s}s with me: {seq}. What comes next?', hi: '{s}-{s} करके गिनो: {seq}। आगे क्या आता है?' },
  plus:       { en: 'What is {a} plus {b}?', hi: '{a} और {b} कितने होते हैं?' },
  minus:      { en: 'What is {a} take away {b}?', hi: '{a} में से {b} गए, तो कितने बचे?' },
  times:      { en: 'What is {a} times {b}?', hi: '{a} गुणा {b} कितना होता है?' },
  divide:     { en: 'What is {a} divided by {b}?', hi: '{a} को {b} से भाग दो, तो कितना आता है?' },
  divideWhy:  { en: '{a} divided by {b} is {ans}.', hi: '{a} को {b} से भाग देने पर {ans}।' },
  homeworkLead: { en: "This one is from your teacher's homework.", hi: 'यह सवाल टीचर के होमवर्क से है।' },
  checkLead: { en: "Now Munni's Friday check: three questions on {skill}. Ready?", hi: 'अब मुन्नी का शुक्रवार वाला छोटा टेस्ट: {skill} पर तीन सवाल। तैयार?' },
  homeAsk:   { en: 'First, a question: did you teach someone at home about {topic}?', hi: 'पहले एक सवाल: क्या तुमने घर पर किसी को {topic} के बारे में सिखाया?' },
  homeYes:   { en: 'Wonderful! Teaching someone is the best way to learn.', hi: 'वाह! किसी को सिखाना सीखने का सबसे अच्छा तरीका है।' },
  homeNo:    { en: "That's okay!", hi: 'कोई बात नहीं!' },
  focusLead: { en: 'Your teacher asked Munni to practise this one with you.', hi: 'यह सवाल टीचर ने मुन्नी से तुम्हारे साथ अभ्यास करने को कहा है।' },
  plusWhy:    { en: '{a} and {b} make {ans}.', hi: '{a} और {b} मिलकर {ans}।' },
  minusWhy:   { en: '{a} take away {b} leaves {ans}.', hi: '{a} में से {b} गए, {ans} बचे।' },
  timesWhy:   { en: '{a} times {b} is {ans}.', hi: '{a} गुणा {b} बराबर {ans}।' },
  // Praise rotates through the whole list before any line comes back
  // (praiseFor()), and some lines name the child's own answer, so a lesson
  // never sounds like one phrase on repeat. {ans} is the right answer.
  praise: [
    { en: "Yes! That's right.", hi: 'हाँ! बिल्कुल सही।' },
    { en: 'Well done!', hi: 'शाबाश!' },
    { en: 'Perfect!', hi: 'बहुत बढ़िया!' },
    { en: 'Correct! Shabaash!', hi: 'सही जवाब! शाबाश!' },
    { en: '{ans}! Spot on!', hi: '{ans}! एकदम सही!' },
    { en: 'Wah! You got it.', hi: 'वाह! तुमने कर दिखाया।' },
    { en: 'Super! {ans} it is.', hi: 'शानदार! {ans} ही है।' },
    { en: 'You worked that out so well!', hi: 'तुमने कितनी अच्छी तरह सोचा!' },
    { en: 'Yes, {ans}! Munni is so happy.', hi: 'हाँ, {ans}! मुन्नी बहुत ख़ुश है।' },
    { en: 'Brilliant thinking!', hi: 'क्या बात है, बहुत बढ़िया सोचा!' },
    { en: 'Right again! Clever you.', hi: 'फिर से सही! तुम तो बहुत होशियार हो।' },
    { en: 'That is it! {ans}.', hi: 'बिल्कुल! {ans}।' }
  ],
  readPraise: [
    { en: 'Lovely reading!', hi: 'बहुत अच्छा पढ़ा!' },
    { en: 'Beautifully read!', hi: 'वाह, सुंदर पढ़ा!' },
    { en: 'Well read! Shabaash!', hi: 'शाबाश, बढ़िया पढ़ा!' },
    { en: 'Every word, so clearly!', hi: 'हर शब्द, कितना साफ़ पढ़ा!' },
    { en: 'You read that like a big reader!', hi: 'तुमने तो बड़े बच्चों की तरह पढ़ा!' },
    { en: 'Wah! Smooth reading.', hi: 'वाह! कितना अच्छे से पढ़ा।' },
    { en: 'That sounded lovely!', hi: 'यह सुनकर बहुत अच्छा लगा!' }
  ],
  repeatPraise: [
    { en: 'Lovely! You said it beautifully.', hi: 'बहुत प्यारा! तुमने बहुत अच्छे से बोला।' },
    { en: 'Just like Munni said it!', hi: 'बिल्कुल मुन्नी की तरह बोला!' },
    { en: 'Wah! So clear.', hi: 'वाह! कितना साफ़ बोला।' },
    { en: 'Well said!', hi: 'बहुत बढ़िया बोला!' },
    { en: 'You said every word!', hi: 'तुमने हर शब्द बोला!' }
  ],
  levelUp:    { en: 'Now the next one is a little harder.', hi: 'अब अगला सवाल थोड़ा मुश्किल है।' },
  // a level-up on the very last answer: there is no next question to point at
  levelUpEnd: { en: "You're getting really good at this! Next time we'll try some harder ones.", hi: 'तुम इसमें बहुत अच्छे हो गए हो! अगली बार थोड़े मुश्किल सवाल करेंगे।' },
  clue:       { en: "Let's think again. Is it {x} or {y}?", hi: 'एक बार फिर सोचो। {x} या {y}?' },
  clueDK:     { en: "That's okay! Here's a clue. Is it {x} or {y}?", hi: 'कोई बात नहीं! एक इशारा: {x} या {y}?' },
  clueYN:     { en: "Let's think again. Say yes or no.", hi: 'एक बार फिर सोचो। हाँ या नहीं बोलो।' },
  reveal:     { en: 'The answer is {ans}. {why} Good try!', hi: 'जवाब है {ans}। {why} अच्छी कोशिश!' },
  revealYN:   { en: 'The answer is {ans}. {why} Good try!', hi: 'जवाब है {ans}। {why} अच्छी कोशिश!' },
  notHeard:   { en: "I didn't hear a number. Say it once more?", hi: 'मुझे संख्या सुनाई नहीं दी। फिर से बोलो?' },
  notHeardYN: { en: "I didn't hear. Say yes or no?", hi: 'मुझे सुनाई नहीं दिया। हाँ या नहीं बोलो?' },
  // with keypad on: a noisy home or a quiet child can press instead
  notHeardKey:   { en: "I didn't hear a number. Say it once more, or press it on your phone and then the hash key.",
                   hi: 'मुझे संख्या सुनाई नहीं दी। फिर से बोलो, या फ़ोन पर नंबर दबाओ और फिर हैश वाला बटन।' },
  notHeardYNKey: { en: "I didn't hear. Say yes or no, or press 1 for yes and 2 for no.",
                   hi: 'मुझे सुनाई नहीं दिया। हाँ या नहीं बोलो, या हाँ के लिए एक और नहीं के लिए दो दबाओ।' },
  notHeardRd: { en: "I couldn't hear clearly. Read it once more?", hi: 'मुझे ठीक से सुनाई नहीं दिया। एक बार फिर पढ़ो?' },
  moveOn:     { en: "Let's try a new one.", hi: 'चलो, नया सवाल।' },
  next:       { en: 'Next one.', hi: 'अगला।' },
  readFirst:  { en: "Now look at today's card. Read line 1 to me.", hi: 'अब आज का कार्ड देखो। पहली लाइन पढ़कर सुनाओ।' },
  readNext:   { en: 'Now read line {k}.', hi: 'अब {k} लाइन पढ़ो।' },
  // Talking Munni in the app: the line is on the screen, no card needed
  readScreen: { en: 'Now read the line on the screen to me.', hi: 'अब स्क्रीन पर लिखी लाइन पढ़कर सुनाओ।' },
  readScreenNext: { en: 'Now read the next line on the screen.', hi: 'अब स्क्रीन पर अगली लाइन पढ़ो।' },
  readCoachW: { en: 'Almost! Listen to this word: {w}. Now read the whole line again.', hi: 'लगभग! यह शब्द सुनो: {w}। अब पूरी लाइन फिर से पढ़ो।' },
  readCoach:  { en: 'Nice try! Listen: {line} Now you read it once more.', hi: 'अच्छी कोशिश! सुनो: {line} अब एक बार फिर पढ़ो।' },
  readModel:  { en: 'Well tried! It says: {line} We will read it again another day.', hi: 'बढ़िया कोशिश! इसमें लिखा है: {line} इसे फिर किसी दिन पढ़ेंगे।' },
  noCard:     { en: 'No problem! Say it after me: {line}', hi: 'कोई बात नहीं! मेरे बाद बोलो: {line}' },
  repeatMe:   { en: 'Say it after me: {line}', hi: 'मेरे बाद बोलो: {line}' },
  repeatTry:  { en: 'Good try! Listen once more: {line}', hi: 'अच्छी कोशिश! एक बार फिर सुनो: {line}' },
  repeatDone: { en: "Good try! Let's go on.", hi: 'अच्छी कोशिश! चलो आगे बढ़ें।' },
  readSlip:   { en: 'Lovely reading! Just one small thing: {w}.', hi: 'बहुत अच्छा पढ़ा! बस एक छोटी बात: {w}।' },
  finish:     { en: "That's all for today! {what} Shabaash! Bye bye!", hi: 'आज के लिए इतना ही! {what} शाबाश! बाय-बाय!' },
  finishBare: { en: "That's all for today! Thank you for practising with me. Bye bye!", hi: 'आज के लिए इतना ही! मेरे साथ अभ्यास करने के लिए धन्यवाद। बाय-बाय!' },
  didSums:    { en: 'You worked on {m} sums', hi: 'तुमने {m} सवाल किए' },
  didRead:    { en: 'you read {r} lines', hi: '{r} लाइनें पढ़ीं' },
  didReadOnly:{ en: 'You read {r} lines.', hi: 'तुमने {r} लाइनें पढ़ीं।' },
  and:        { en: ' and ', hi: ' और ' },
  stop:       { en: "Okay, we'll stop here. You did really well today. Bye bye!", hi: 'ठीक है, आज यहीं रुकते हैं। तुमने बहुत अच्छा किया। बाय-बाय!' },
  over:       { en: 'Our lesson is finished for today. Bye bye!', hi: 'आज का पाठ पूरा हो गया। बाय-बाय!' },
  yes:        { en: 'yes', hi: 'हाँ' },
  no:         { en: 'no', hi: 'नहीं' },
  ordinal:    { en: ['1', '2', '3', '4'], hi: ['पहली', 'दूसरी', 'तीसरी', 'चौथी'] }
};

/* ---------------- story problems from the validated lesson bank ----------------
   Each concept the app teaches with pictures gets a spoken version. The
   number the child must say is NOT computed here: it is read from the
   lesson's own checkpoint, after validateLesson() has passed it. `expect`
   recomputes it independently, and a lesson where the two disagree is
   dropped at load — so a typo in a template can never change an answer. */
const STORY = {
  count:   { q: { en: 'Count with me: {seq}. How many did we count?', hi: 'मेरे साथ गिनो: {seq}। हमने कितने गिने?' }, expect: p => p.n },
  compare: { q: { en: 'Which is more, {a} or {b}?', hi: 'ज़्यादा कौन है, {a} या {b}?' }, expect: p => Math.max(p.a, p.b) },
  add:     { q: { en: 'There are {a} mangoes. {b} more arrive. How many mangoes now?', hi: '{a} आम हैं। {b} और आ गए। अब कितने आम?' }, expect: p => p.a + p.b },
  take:    { q: { en: 'There are {a} birds on a tree. {b} fly away. How many are left?', hi: 'पेड़ पर {a} चिड़ियाँ हैं। {b} उड़ गईं। कितनी बचीं?' }, expect: p => p.a - p.b },
  bond:    { q: { en: '{b} and what makes 10?', hi: '{b} और कितने मिलकर दस बनते हैं?' }, expect: p => 10 - p.b },
  group:   { q: { en: 'How many bundles of ten are in {a}?', hi: '{a} में दस-दस के कितने बंडल हैं?' }, expect: p => Math.floor(p.a / 10) },
  carry:   { q: { en: 'What is {a} plus {b}?', hi: '{a} और {b} कितने होते हैं?' }, expect: p => p.a + p.b },
  barsub:  { q: { en: 'What is {a} minus {b}?', hi: '{a} में से {b} घटाओ, तो कितने बचे?' }, expect: p => p.a - p.b },
  skip:    { q: { en: 'Start at zero and jump {b} each time. After {hops} jumps, where are you?', hi: 'शून्य से शुरू करो, हर बार {b} की छलाँग। {hops} छलाँगों के बाद कहाँ पहुँचे?' }, expect: p => p.b * p.hops },
  array:   { q: { en: 'There are {a} rows of chairs, with {b} chairs in each row. How many chairs?', hi: 'कुर्सियों की {a} पंक्तियाँ हैं, हर पंक्ति में {b} कुर्सियाँ। कुल कितनी कुर्सियाँ?' }, expect: p => p.a * p.b },
  table:   { q: { en: 'What is {a} times {b}?', hi: '{a} गुणा {b} कितना होता है?' }, expect: p => p.a * p.b },
  share:   { q: { en: 'Share {a} laddoos equally between {b} friends. How many does each friend get?', hi: '{a} लड्डू {b} दोस्तों में बराबर बाँटो। हर दोस्त को कितने मिलेंगे?' }, expect: p => p.a / p.b },
  frac:    { q: { en: 'A roti is cut into {b} equal pieces. How many pieces are there?', hi: 'एक रोटी को {b} बराबर टुकड़ों में काटा। कितने टुकड़े हैं?' }, expect: p => p.b },
  money:   { q: { en: 'You have {a} rupees. Your uncle gives you {b} more. How many rupees now?', hi: 'तुम्हारे पास {a} रुपये हैं। चाचा {b} रुपये और देते हैं। अब कितने रुपये?' }, expect: p => p.a + p.b },
  spend:   { q: { en: 'You have {a} rupees and spend {b}. How many rupees are left?', hi: 'तुम्हारे पास {a} रुपये हैं, {b} खर्च किए। कितने बचे?' }, expect: p => p.a - p.b },
  twostep: { q: { en: '{a} children are playing. {b} more join. Then {c} go home. How many are playing now?', hi: '{a} बच्चे खेल रहे हैं। {b} और आ गए। फिर {c} घर चले गए। अब कितने खेल रहे हैं?' }, expect: p => p.a + p.b - p.c },
  measure: { q: { en: 'A ruler is {b} centimetres long. Put it down {hops} times in a row. How many centimetres?', hi: 'एक पैमाना {b} सेंटीमीटर का है। उसे {hops} बार लगातार रखो। कुल कितने सेंटीमीटर?' }, expect: p => p.b * p.hops },
  oddeven: { q: { en: 'Is {n} an even number? Say yes or no.', hi: 'क्या {n} सम संख्या है? हाँ या नहीं बोलो।' }, expect: p => p.n % 2 === 0, yesno: true },
  half:    { q: { en: 'What is half of {a}?', hi: '{a} का आधा कितना है?' }, expect: p => p.a / 2 }
};

/* skillProblem() operators that can be asked out loud without ambiguity.
   'mix' (a + b × c) is left out on purpose: spoken aloud, "two plus three
   times four" has no brackets and no written order — it would test
   listening, not BODMAS. Those children get the homework in the app. */
const SPOKEN_OPS = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divide' };

/* ---------------- small helpers ---------------- */
function fill(tpl, lang, vars) {
  let s = tpl[lang] || tpl.en;
  for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const nw = (n, lang) => numberWord(n, lang);
function seq(from, to, step, lang) {
  const out = []; for (let v = from; v <= to; v += step) out.push(nw(v, lang));
  return out.join(', ');
}
function pick(arr, r) { return arr[Math.floor(r() * arr.length) % arr.length]; }

/* Build the voice story bank once: every concept × parameter, validated by
   the app's own validator, cross-checked against STORY[...].expect. */
function buildStoryBank(T) {
  const bank = [], dropped = [];
  for (const c of T.CONCEPTS) {
    const tpl = STORY[c.id];
    if (!tpl) continue;
    for (const p of c.space()) {
      const les = {
        id: `gen-${c.id}-${Object.values(p).join('-')}`,
        band: c.band, concept: c.id, generated: true,
        title: c.title(p), sub: c.sub(p), beats: c.beats(p)
      };
      if (!T.validateLesson(les).ok) { dropped.push(les.id + ' (validator)'); continue; }
      const ask = les.beats.find(b => b.t === 'ask');
      const marked = ask.opts[ask.correct];
      const other = ask.opts.find((o, i) => i !== ask.correct);
      const want = tpl.expect(p);
      let answer, distractor;
      if (tpl.yesno) {
        answer = marked === 'Yes';
        if (answer !== want) { dropped.push(les.id + ' (yes/no mismatch)'); continue; }
      } else {
        answer = Number(marked); distractor = Number(other);
        if (answer !== want) { dropped.push(`${les.id} (template says ${want}, lesson says ${marked})`); continue; }
      }
      const win = les.beats.find(b => b.t === 'win');
      bank.push({ id: les.id, band: c.band, concept: c.id, p, answer, distractor, win: win && win.say });
    }
  }
  return { bank, dropped };
}

/* ---------------- planning ---------------- */
function bandPlan(bandId) {
  if (bandId === 'pre')   return ['warm', 'math', 'repeat', 'math', 'story', 'repeat', 'math'];
  if (bandId === 'early') return ['warm', 'math', 'read', 'math', 'story', 'read', 'math'];
  return ['warm', 'math', 'read', 'math', 'story', 'read', 'math', 'read'];
}

/* Plan a session. Reading lines are chosen NOW, because they go on the
   card the family sees before the call; maths is generated lazily, at
   the moment it is asked, so a level-up mid-call takes effect at once. */
function planSession(core, child, opts) {
  opts = opts || {};
  // "still stuck? Munni calls": the steps of one question (voice/help.js)
  if (opts.kind === 'help') return require('./help').planHelp(core, child, opts);
  const id = opts.id || crypto.randomBytes(12).toString('base64url');
  const lang = child.lang === 'en' ? 'en' : 'hi';
  const seed = opts.seed || id;
  const kind = opts.kind === 'english' ? 'english' : 'lesson';
  const { out, trace } = core.withChild(child.profile, { lang, seed }, T => {
    const b = T.band();
    if (kind === 'english') {
      const r = T.rng(T.seedOf(seed + '|english'));
      const pick = E.chooseEnglish(child, b.id, r);
      return { band: b.id, slots: pick.slots, lines: [], english: { words: pick.words, phrases: pick.phrases },
               homework: null, levels: { ...T.S.levels } };
    }
    const slots = bandPlan(b.id);
    // the last call went quiet: start this one with an extra easy warm-up
    // (unscored), as the parent report promised
    const q = (child.quiet || [])[(child.quiet || []).length - 1];
    const ease = !!(q && q.session === child.last_call_session && (q.items >= 2 || q.ended) && Date.now() - Date.parse(q.at) < 14 * 864e5);
    if (ease) slots.unshift('warm');

    // teacher homework this child hasn't worked through yet takes the
    // story slot — if it can be asked out loud at all
    const hw = T.personalizeContentForHomework(T.S);
    let homework = null, focus = null;
    if (hw && hw.storySkill && hw.assignedAt !== T.S.hwDone) {
      const sp = T.skillProblem(hw.storySkill, 1);
      if (sp && SPOKEN_OPS[sp.op]) { slots[slots.indexOf('story')] = 'homework'; homework = hw.storySkill; }
    }
    // no class homework: what a teacher noticed (a voice note, a class
    // call) takes the same slot, for a week
    const fc = child.focus;
    if (!homework && fc && Date.parse(fc.until) > Date.now() && slots.includes('story')) {
      const sp = T.skillProblem(fc.skill, 1);
      if (sp && SPOKEN_OPS[sp.op]) { slots[slots.indexOf('story')] = 'homework'; homework = fc.skill; focus = fc.source; }
    }

    // the learning circle (circle.js): Friday to Sunday, the week's check
    // takes the free sums after the first (three questions on the focus);
    // the story or homework slot stays. And "did you teach someone at
    // home?" comes first when there's one to ask.
    const cw = child.circle && child.circle.week;
    let check = null, home = null;
    if (opts.checkDue && cw && !cw.check && cw.skill) {
      const sp = T.skillHasProblem(cw.skill) ? T.skillProblem(cw.skill, 1) : null;
      if (sp && SPOKEN_OPS[sp.op]) {
        const maths = slots.map((x, i) => x === 'math' ? i : -1).filter(i => i >= 0).slice(1);
        for (const i of maths) slots[i] = 'check';
        let n = slots.filter(x => x === 'check').length;
        while (n > 0 && n < 3) { slots.splice(slots.lastIndexOf('check') + 1, 0, 'check'); n++; }
        if (n) check = { skill: cw.skill, week: cw.key };
      }
    }
    if (opts.homeAsk) { slots.unshift('home'); home = opts.homeAsk; }
    // reading lines: sentences spaced repetition says are due come first,
    // most overdue first (core/srs.js) — the same review the app's Reading
    // Tree runs — then fresh lines at the child's level
    const nRead = slots.filter(s => s === 'read' || s === 'repeat').length;
    const lines = [];
    if (slots.includes('read')) {
      const due = T.getDueSrsItems(T.S, 'read')
        .filter(x => x.content && /[ऀ-ॿ]/.test(x.content) === (lang === 'hi'))   // this lesson's language only
        .sort((x, y) => x.nextReview - y.nextReview);
      for (const d of due) if (lines.length < nRead && !lines.includes(d.content)) lines.push(d.content);
    }
    let pool = T.ageSentences(lang, T.S.levels.read).filter(l => !lines.includes(l));
    const r = T.rng(T.seedOf(seed + '|lines'));
    // letters a teacher said the child mixes up: lines that contain them first
    const fl = child.focus_letters;
    if (fl && Date.parse(fl.until) > Date.now() && slots.includes('read')) {
      const has = l => fl.letters.some(x => l.toLowerCase().includes(x));
      const hit = pool.filter(has);
      while (lines.length < nRead && hit.length) { const l = hit.splice(Math.floor(r() * hit.length), 1)[0]; lines.push(l); pool = pool.filter(x => x !== l); }
    }
    while (lines.length < nRead && pool.length) lines.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return { band: b.id, slots, lines, english: null, homework, focus, ease, check, home, levels: { ...T.S.levels } };
  });
  return {
    id, child_id: child.id, lang, seed, kind,
    english: out.english,
    // 'call' (Munni rang), 'inbound' (the child rang), 'app' (Talking Munni)
    channel: opts.channel || 'call',
    // keypad answers exist only on a phone line, and only where the
    // telephony provider passes keys through (not Exotel / Vobiz)
    keypad: (opts.channel || 'call') !== 'app' && opts.keypad !== false,
    band: out.band, slots: out.slots, lines: out.lines, homework_skill: out.homework, focus_source: out.focus || null,
    ease: out.ease ? 'after a quiet call' : null,
    circle_check: out.check || null, circle_home: out.home || null,
    levels_before: out.levels,
    status: 'planned', created_at: new Date().toISOString(),
    started_at: null, ended_at: null,
    cursor: 0, turns: 0, items: [], trace: trace.map(t => t.msg), ended_by: null
  };
}

/* ---------------- serving ---------------- */
function currentItem(s) {
  const it = s.items[s.items.length - 1];
  return it && !it.outcome ? it : null;
}

function buildItem(core, child, s, slot, storyBank) {
  const lang = s.lang;
  const k = s.items.length;
  if (/^help:\d+$/.test(slot)) {
    const h = s.help_items && s.help_items[Number(slot.slice(5))];
    return h ? Object.assign(JSON.parse(JSON.stringify(h)), { slot, n: k + 1, attempts: 0, said: [], prompts: [], outcome: null, trace: [] }) : null;
  }
  const { out, trace } = core.withChild(child.profile, { lang, seed: s.seed + '|' + k }, T => {
    const r = T.rng(T.seedOf(s.seed + '|item|' + k));
    const b = T.band();
    if (slot === 'warm') {
      if (b.id === 'pre' || b.id === 'early') {
        const top = 2 + Math.floor(r() * 4);                  // count 1..top, ask top+1
        return { kind: 'warm', expect: 'number', answer: top + 1, distractor: top + 2,
                 prompt: fill(L.warmCount, lang, { seq: seq(1, top, 1, lang) }) };
      }
      const step = pick([2, 5, 10], r), n = 3;
      // the clue offers "counting on by one" — the slip a child actually makes
      return { kind: 'warm', expect: 'number', answer: step * (n + 1), distractor: step * n + 1,
               prompt: fill(L.warmSkip, lang, { s: nw(step, lang), seq: seq(step, step * n, step, lang) }) };
    }
    if (slot === 'math') {
      const lvl = T.S.levels.math;
      const g = T.genProblem(lvl);
      const op = g.op === '+' ? 'plus' : g.op === '×' ? 'times' : 'minus';
      const v = { a: nw(g.a, lang), b: nw(g.b, lang), ans: nw(g.ans, lang) };
      // the clue is the CLOSEST wrong option: off-by-one is the mistake a
      // child actually makes, so it is the one worth choosing between
      const wrong = g.opts.filter(o => o !== g.ans).sort((x, y) => Math.abs(x - g.ans) - Math.abs(y - g.ans))[0];
      return { kind: 'math', level: lvl, skill: skillOfProblem(g), expect: 'number', answer: g.ans, distractor: wrong,
               problem: `${g.a} ${g.op} ${g.b}`,
               prompt: fill(L[op], lang, v), why: fill(L[op + 'Why'], lang, v) };
    }
    if (slot === 'story') {
      const done = T.S.doneLessons || [];
      const mine = storyBank.filter(x => x.band === b.id);
      const fresh = mine.filter(x => !done.includes(x.id));
      const pool = fresh.length ? fresh : mine;
      if (!pool.length) return null;
      const st = pick(pool, r);
      T.S.doneLessons = done.concat(st.id).slice(-200);
      const tpl = STORY[st.concept];
      const p = st.p, v = {};
      for (const key of ['a', 'b', 'c', 'n', 'hops']) if (p[key] != null) v[key] = nw(p[key], lang);
      if (st.concept === 'count') v.seq = seq(1, p.n, 1, lang);
      const why = st.win ? (st.win[lang] || st.win.en) : '';
      if (tpl.yesno) {
        return { kind: 'story', concept: st.concept, lesson_id: st.id, expect: 'yesno', answer: st.answer,
                 prompt: fill(tpl.q, lang, v), why };
      }
      return { kind: 'story', concept: st.concept, lesson_id: st.id, expect: 'number',
               answer: st.answer, distractor: st.distractor, prompt: fill(tpl.q, lang, v), why };
    }
    if (slot === 'check') {
      const k = s.items.filter(x => x.kind === 'check').length;
      const sp = T.skillProblem(s.circle_check.skill, T.seedOf(`${s.child_id}|check|${s.circle_check.week}|${k}`));
      if (!sp || !SPOKEN_OPS[sp.op]) return null;
      const v = { a: nw(sp.a, lang), b: nw(sp.b, lang), ans: nw(sp.ans, lang) };
      const wrongs = sp.opts.map(Number).filter(o => o !== sp.ans);
      const sk = T.skillById(sp.skillId);
      return { kind: 'check', skill: sp.skillId, expect: 'number', answer: sp.ans, distractor: wrongs.find(o => Math.abs(o - sp.ans) > 1) ?? wrongs[0],
               problem: sp.text, week: s.circle_check.week,
               prompt: joinSay(k === 0 ? fill(L.checkLead, lang, { skill: sk ? (lang === 'hi' ? sk.hi : sk.en.toLowerCase()) : '' }) : '', fill(L[SPOKEN_OPS[sp.op]], lang, v)),
               why: fill(L[SPOKEN_OPS[sp.op] + 'Why'], lang, v) };
    }
    if (slot === 'home') {
      const h = s.circle_home;
      return { kind: 'home', expect: 'yesno', home_id: h.id, answer: true, prompt: fill(L.homeAsk, lang, { topic: h.topic[lang] || h.topic.en }) };
    }
    if (slot === 'homework') {
      /* The teacher's homework, personalised by the app's own diagnose():
         storySkill is the deepest confirmed gap that can be asked as one
         question, so a child weak on tables who was given BODMAS hears a
         tables question. skillProblem() makes the numbers really exercise
         it, with the band's ceiling and real-mistake distractors. */
      // (or what a teacher noticed: s.focus_source, planned in planSession)
      const hw = s.focus_source ? null : T.personalizeContentForHomework(T.S);
      const skill = s.focus_source ? s.homework_skill : hw && hw.storySkill;
      const sp = skill ? T.skillProblem(skill, T.seedOf(s.seed + '|hw')) : null;
      if (!sp || !SPOKEN_OPS[sp.op]) return null;
      const v = { a: nw(sp.a, lang), b: nw(sp.b, lang), ans: nw(sp.ans, lang) };
      const wrongs = sp.opts.map(Number).filter(o => o !== sp.ans);
      // prefer the skill's own mistake (a dropped ten, one group too many)
      // over a plain off-by-one, when the generator offered one
      const distractor = wrongs.find(o => Math.abs(o - sp.ans) > 1) ?? wrongs[0];
      return { kind: 'homework', skill: sp.skillId, assigned_at: hw ? hw.assignedAt : null, expect: 'number',
               answer: sp.ans, distractor, problem: sp.text, focus: s.focus_source || null,
               prompt: joinSay((s.focus_source ? L.focusLead : L.homeworkLead)[lang], fill(L[SPOKEN_OPS[sp.op]], lang, v)),
               why: fill(L[SPOKEN_OPS[sp.op] + 'Why'], lang, v) };
    }
    if (slot === 'eword' || slot === 'esay' || slot === 'ephrase') {
      return E.buildEnglishItem(slot, s, child, lang, k, r);
    }
    if (slot === 'read' || slot === 'repeat') {
      const lineNo = s.items.filter(x => x.kind === 'read' || x.kind === 'repeat').length;
      const line = s.lines[lineNo];
      if (!line) return null;
      if (slot === 'repeat') {
        return { kind: 'repeat', expect: 'reading', target: line, line_no: lineNo + 1,
                 prompt: fill(L.repeatMe, lang, { line }) };
      }
      const prompt = s.channel === 'app'
        ? (lineNo === 0 ? L.readScreen[lang] : L.readScreenNext[lang])
        : lineNo === 0 ? fill(L.readFirst, lang, {})
        : fill(L.readNext, lang, { k: lang === 'hi' ? L.ordinal.hi[lineNo] : L.ordinal.en[lineNo] });
      return { kind: 'read', expect: 'reading', target: line, line_no: lineNo + 1, prompt };
    }
    return null;
  });
  if (!out) return null;
  if (out.expect === 'number' && (out.distractor == null || out.distractor === out.answer)) out.distractor = out.answer + 1;
  return Object.assign(out, { slot, n: k + 1, attempts: 0, said: [], prompts: [], outcome: null, trace: trace.map(t => t.msg) });
}

/* Advance to the next item and return its prompt, or finish. */
function advance(core, child, s, storyBank, lead) {
  const up = s._levelUp; delete s._levelUp;
  while (s.cursor < s.slots.length) {
    if (Date.now() - Date.parse(s.started_at) > MAX_CALL_MS) break;
    const slot = s.slots[s.cursor++];
    const it = buildItem(core, child, s, slot, storyBank);
    if (!it) continue;
    s.items.push(it);
    it.prompts.push(it.prompt);
    return reply(s, joinSay(lead, up ? L.levelUp[s.lang] : '', it.prompt), it);
  }
  return finish(s, joinSay(lead, up ? L.levelUpEnd[s.lang] : ''), 'plan');
}

/* A praise line not yet used in this call (the list goes round once before
   any line repeats), with the child's answer filled in where a line names it. */
function praiseFor(s, pool, r, lang, vars) {
  const list = L[pool];
  s.praise_used = s.praise_used || {};
  let used = s.praise_used[pool] || [];
  if (used.length >= list.length) used = used.slice(-1);       // round again, but never the same line twice running
  const free = list.map((_, i) => i).filter(i => !used.includes(i));
  const i = free[Math.floor(r() * free.length) % free.length];
  s.praise_used[pool] = used.concat(i);
  const line = list[i];
  if (/\{ans\}/.test(line[lang]) && (vars.ans == null || vars.ans === '')) return list.find(x => !/\{ans\}/.test(x[lang]))[lang];
  return fill(line, lang, vars);
}

function joinSay(...parts) { return parts.filter(Boolean).join(' '); }

function reply(s, say, it) {
  return { say, expect: it ? it.expect : 'none', done: false, item: it ? it.n : null, of: s.slots.length };
}

function finish(s, lead, why) {
  const lang = s.lang;
  let line;
  if (why === 'stop') line = L.stop[lang];
  else if (why === 'over') line = L.over[lang];
  else if (s.kind === 'help') {
    const HL = require('./help').HL;
    const tried = s.items.some(x => x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent');
    line = !tried ? HL.bare[lang] : s.help_what === 'read' ? HL.doneRead[lang] : HL.done[lang];
  }
  else if (s.kind === 'english') {
    const w = s.items.filter(x => (x.kind === 'eword' || x.kind === 'esay') && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent').length;
    const p = s.items.filter(x => x.kind === 'ephrase' && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent').length;
    line = w + p ? E.fill(E.EL.finish, lang, { w: nw(w, lang), p: nw(p, lang) }) : L.finishBare[lang];
  } else {
    const m = s.items.filter(x => ['math', 'story', 'homework', 'check'].includes(x.kind) && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent').length;
    const rd = s.items.filter(x => (x.kind === 'read' || x.kind === 'repeat') && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent').length;
    if (!m && !rd) line = L.finishBare[lang];
    else {
      let what;
      if (m && rd) what = fill(L.didSums, lang, { m: nw(m, lang) }) + L.and[lang] + fill(L.didRead, lang, { r: nw(rd, lang) }) + (lang === 'hi' ? '।' : '.');
      else if (m) what = fill(L.didSums, lang, { m: nw(m, lang) }) + (lang === 'hi' ? '।' : '.');
      else what = fill(L.didReadOnly, lang, { r: nw(rd, lang) });
      line = fill(L.finish, lang, { what });
    }
  }
  if (!s.ended_by) { s.ended_by = why; s.status = 'ended'; s.ended_at = new Date().toISOString(); }
  s.goodbye = line;
  return { say: joinSay(lead, line), expect: 'none', done: true, item: null, of: s.slots.length };
}

/* ---------------- the two things the voice agent can ask for ---------------- */

/* "What should I say now?" Idempotent: if a question is open it is
   repeated, not replaced — a confused model calling this twice must not
   skip a child's turn. */
function next(core, child, s, storyBank) {
  if (s.ended_by) return { say: s.goodbye || L.over[s.lang], expect: 'none', done: true, item: null, of: s.slots.length };
  if (!s.started_at) { s.started_at = new Date().toISOString(); s.status = 'live'; }
  const open = currentItem(s);
  if (open) return reply(s, open.prompts[open.prompts.length - 1], open);
  const start = s.kind === 'english' ? E.EL.start[s.lang] : s.kind === 'help' ? require('./help').HL.start[s.lang] : L.start[s.lang];
  return advance(core, child, s, storyBank, s.items.length ? '' : start);
}

/* The child said something. Decide, record, and say what comes next. */
function answer(core, child, s, storyBank, said) {
  said = String(said == null ? '' : said).trim().slice(0, 500);
  if (s.ended_by) return next(core, child, s, storyBank);
  if (!s.started_at) return next(core, child, s, storyBank);
  s.turns++;
  if (s.turns > MAX_TURNS || Date.now() - Date.parse(s.started_at) > MAX_CALL_MS) {
    const open = currentItem(s); if (open) open.outcome = 'unsure';
    return finish(s, '', 'over');
  }
  const it = currentItem(s);
  if (!it) return next(core, child, s, storyBank);
  const lang = s.lang;
  const intent = intentOf(said);

  /* ---- the child went quiet ----
     Not a wrong answer and not a doubt: something to notice. The first
     time, an easier way into the same question (two choices instead of
     recall, the first words of the line); the second time, a different
     question. Every quiet moment is kept (s.silence_log) — for the
     report, the teacher, and an easier start next time. */
  if (intent === 'silence') {
    it.silences = (it.silences || 0) + 1;
    s.silence_log = (s.silence_log || []).concat({ n: it.n, kind: it.kind, skill: it.skill || null, at: Date.now(), source: 'live' });
    const out = say => { it.prompts.push(say); return reply(s, say, it); };
    if (it.silences >= 2) { it.outcome = 'silent'; return advance(core, child, s, storyBank, L.quietMoveOn[lang]); }
    it.eased = true;               // an easier way in: a right answer now is not a first-try answer
    if (it.expect === 'number' && it.distractor != null) {
      const pair = rngFor(s, it)() < 0.5 ? [it.answer, it.distractor] : [it.distractor, it.answer];
      it.choices = pair;
      return out(fill(L.quietClue, lang, { x: nw(pair[0], lang), y: nw(pair[1], lang) }));
    }
    if (it.expect === 'yesno') return out(L.quietYN[lang]);
    if (it.kind === 'read' && it.target) return out(fill(L.quietRead, lang, { start: it.target.split(/\s+/).slice(0, 2).join(' ') }));
    if ((it.kind === 'repeat' || it.kind === 'helpsay') && it.target) return out(fill(L.quietRepeat, lang, { line: it.target }));
    return out(fill(L.quietAgain, lang, { prompt: it.prompts[0] }));
  }
  it.said.push(said);

  const ask = (say) => { it.prompts.push(say); return reply(s, say, it); };
  const done = (outcome, lead) => {
    it.outcome = outcome;
    return advance(core, child, s, storyBank, lead);
  };
  const stopNow = () => { it.outcome = 'unsure'; return finish(s, '', 'stop'); };
  const again = () => { it.said.pop(); return reply(s, it.prompts[it.prompts.length - 1], it); };

  /* ---- "did you teach someone at home?" — a question, not a test ---- */
  if (it.kind === 'home') {
    if (intent === 'stop') return stopNow();
    if (intent === 'repeat') return again();
    const yn = parseYesNo(said);
    it.home_answer = yn === true ? 'yes' : yn === false ? 'no' : 'unclear';
    return done('answered', yn === true ? L.homeYes[lang] : L.homeNo[lang]);
  }

  /* ---- numbers and yes/no ---- */
  if (it.expect === 'number' || it.expect === 'yesno') {
    if (intent === 'stop') return stopNow();
    if (intent === 'repeat') return again();
    const yn = it.expect === 'yesno';
    const got = intent === 'dontKnow' ? null : (yn ? parseYesNo(said) : parseNumber(said, lang));
    const ansWord = yn ? (it.answer ? L.yes[lang] : L.no[lang]) : nw(it.answer, lang);

    if (got === null && intent !== 'dontKnow') {
      // doubt, not a miss: one more try, then move on recording nothing
      it.unheard = (it.unheard || 0) + 1;
      if (it.unheard >= 2) return done('unsure', L.moveOn[lang]);
      const key = s.keypad ? 'Key' : '';
      return ask((yn ? L['notHeardYN' + key] : L['notHeard' + key])[lang]);
    }

    it.attempts++;
    const right = got === it.answer;
    if (right) {
      const first = it.attempts === 1 && !it.eased;
      const lead = praiseFor(s, 'praise', rngFor(s, it), lang, { ans: ansWord });
      if (first) mistakeOf(core, child, s, it, got);
      if (it.kind === 'math' || it.kind === 'story' || it.kind === 'homework' || it.kind === 'check') {
        const mv = recordOutcome(core, child, s, 'math', first, it);
        if (mv === 'up') s._levelUp = true;          // advance() says it: "next one is harder", or at the end, "next time"
      }
      if (it.kind === 'homework' && it.assigned_at) child.profile.hwDone = it.assigned_at;
      return done(first ? 'correct' : 'correct_after_clue', lead);
    }
    if (it.attempts === 1) {
      if (yn) return ask(L.clueYN[lang]);
      // which mistake was it? (the app's own core/twin.js) — the clue goes at
      // it, and offers the child's own answer against the right one
      const m = got != null ? mistakeOf(core, child, s, it, got) : null;
      if (m) { it.mistake = m.id; it.distractor = got; }
      const pair = rngFor(s, it)() < 0.5 ? [it.answer, it.distractor] : [it.distractor, it.answer];
      it.choices = pair;                       // Talking Munni shows these two as buttons
      const tpl = intent === 'dontKnow' ? L.clueDK : L.clue;
      return ask(joinSay(m ? m.tip : '', fill(tpl, lang, { x: nw(pair[0], lang), y: nw(pair[1], lang) })));
    }
    if (it.kind === 'math' || it.kind === 'story' || it.kind === 'homework' || it.kind === 'check') recordOutcome(core, child, s, 'math', false, it);
    // the homework was worked through on the call; Munni stops pointing at it
    if (it.kind === 'homework' && it.assigned_at) child.profile.hwDone = it.assigned_at;
    const why = it.why || '';
    return done('revealed', fill(yn ? L.revealYN : L.reveal, lang, { ans: ansWord, why }).replace(/\s+/g, ' '));
  }

  /* ---- spoken English: a word in answer to its Hindi meaning ---- */
  if (it.expect === 'english') {
    if (intent === 'stop') return stopNow();
    if (intent === 'repeat') return again();
    const heard = /[a-zA-Zऀ-ॿ]/.test(said);
    if (!heard && intent !== 'dontKnow') {
      it.unheard = (it.unheard || 0) + 1;
      if (it.unheard >= 2) return done('unsure', L.moveOn[lang]);
      return ask(E.EL.notHeard[lang]);
    }
    it.attempts++;
    if (intent !== 'dontKnow' && E.gradeWord(it, said)) {
      return done(it.attempts === 1 ? 'correct' : 'correct_after_clue', praiseFor(s, 'praise', rngFor(s, it), lang, { ans: it.word }));
    }
    if (it.attempts === 1) {
      const pair = rngFor(s, it)() < 0.5 ? [it.word, it.distractor] : [it.distractor, it.word];
      return ask(E.fill(intent === 'dontKnow' ? E.EL.wordClueDK : E.EL.wordClue, lang, { x: pair[0], y: pair[1] }));
    }
    return done('revealed', E.fill(E.EL.wordReveal, lang, { hi: it.meaning, en: it.word }));
  }

  /* ---- spoken English: a phrase (or a word) said after Munni ---- */
  if (it.expect === 'phrase') {
    const { out: th } = core.withChild(child.profile, { lang }, T => T.getGradeThresholds());
    const g = E.gradePhrase(it, said, th.pass, th.gateScore);
    // as with card reading: intents only when the child is clearly not
    // saying the phrase ("bye" might be part of one)
    if (g.verdict === 'unsure') {
      if (intent === 'stop') return stopNow();
      if (intent === 'repeat') return again();
    }
    it.live = it.live || [];
    it.live.push({ score: g.score, verdict: g.verdict, missed: g.missed });
    if (g.verdict === 'unsure') {
      it.unheard = (it.unheard || 0) + 1;
      if (it.unheard >= 2) return done('unsure', E.EL.phraseDone[lang]);
      return ask(E.fill(E.EL.phraseTry, lang, { en: it.target }));
    }
    it.attempts++;
    if (g.verdict === 'pass') return done(it.attempts === 1 ? 'correct' : 'correct_after_clue', E.EL.phraseGood[lang]);
    if (it.attempts === 1) return ask(E.fill(E.EL.phraseTry, lang, { en: it.target }));
    return done('revealed', E.EL.phraseDone[lang]);
  }

  /* ---- reading a line from the card, or saying it after Munni ---- */
  if (it.expect === 'reading') {
    const g = gradeLine(core, child, s, it.target, [said]);
    // Intents only count when the child is clearly NOT reading the line:
    // a sentence on the card may itself contain "फिर से" or "नहीं है".
    // floors derived from this band's gate score, not hardcoded (ages.js)
    const intentFloor = Math.round(g.gate * 0.6), coachFloor = Math.round(g.gate / 2);
    if (g.score < intentFloor) {
      if (intent === 'stop') return stopNow();
      if (intent === 'repeat') return again();
      // "I don't have the card" → say-after-me, so the call still teaches
      if (it.kind === 'read' && it.attempts === 0 && !it.no_card &&
          (intent === 'dontKnow' || parseYesNo(said) === false || looksLikeNoCard(said))) {
        it.kind = 'repeat'; it.no_card = true; it.said.pop();
        return ask(fill(L.noCard, lang, { line: it.target }));
      }
    }
    /* A phone transcript has no confidence score, so gradeVerdict() calls
       every partial reading 'unsure'. For what Munni SAYS, a child who read
       half the line deserves coaching, not "I couldn't hear" — so between
       half the band's gate score and the gate we coach. What gets RECORDED
       is decided after the call, from Bolna's own transcript, with the
       app's verdict unchanged (see report.js) — so the gate still protects
       the child's record. */
    const verdict = g.verdict === 'unsure' && g.score >= coachFloor ? 'coach' : g.verdict;
    it.live = it.live || [];
    it.live.push({ score: g.score, verdict, misread: g.misread, slips: g.slips });

    if (verdict === 'unsure') {
      it.unheard = (it.unheard || 0) + 1;
      if (it.unheard >= 2) return done('unsure', L.moveOn[lang]);
      return ask((it.kind === 'repeat' || it.kind === 'helpsay') ? fill(L.repeatTry, lang, { line: it.target }) : L.notHeardRd[lang]);
    }
    it.attempts++;
    if (verdict === 'pass') {
      let lead = praiseFor(s, (it.kind === 'repeat' || it.kind === 'helpsay') ? 'repeatPraise' : 'readPraise', rngFor(s, it), lang, {});
      // a pass can still skip or slip on one word: name it, gently, once
      const w = (g.misread || [])[0] || (g.slips || [])[0];
      if (it.kind === 'read' && w) lead = fill(L.readSlip, lang, { w: w.replace(/[.,!?।]/g, '') });
      return done(it.attempts === 1 ? 'correct' : 'correct_after_clue', lead);
    }
    if (it.attempts === 1) {
      if (it.kind === 'repeat' || it.kind === 'helpsay') return ask(fill(L.repeatTry, lang, { line: it.target }));
      if (g.misread.length === 1) return ask(fill(L.readCoachW, lang, { w: g.misread[0] }));
      return ask(fill(L.readCoach, lang, { line: it.target }));
    }
    return done('revealed', (it.kind === 'repeat' || it.kind === 'helpsay') ? L.repeatDone[lang] : fill(L.readModel, lang, { line: it.target }));
  }

  return done('unsure', '');
}

function looksLikeNoCard(said) {
  return /card|kard|कार्ड|nahi hai|नहीं है|nahin hai|don'?t have|no card|पता नहीं|pata nahi/i.test(said);
}

function rngFor(s, it) {
  // stable per item+attempt, so a replay says the same praise
  const seedStr = s.seed + '|say|' + it.n + '|' + it.attempts + '|' + it.said.length;
  let h = 2166136261; for (const c of seedStr) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let t = h >>> 0;
  return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

/* record() is the app's adaptive engine — rolling window, age-clamped. */
/* record() is the app's adaptive engine — rolling window, age-clamped,
   and since the skill graph landed it also feeds SRS and (for read/write)
   the skill history. Maths items additionally tag the skill they really
   exercised, exactly as a lesson checkpoint or cartoon answer does, so a
   teacher's diagnosis sees phone practice as real evidence. */
function recordOutcome(core, child, s, mod, ok, it) {
  // a phone lesson is evidence the app can't see: keep it in the circle's
  // server ledger too (evidence.js). A Talking Munni talk is replayed into
  // the app itself, so it isn't.
  if (s.channel !== 'app') return require('./evidence').ledger(child, () => recordOutcomeNow(core, child, s, mod, ok, it));
  return recordOutcomeNow(core, child, s, mod, ok, it);
}
function recordOutcomeNow(core, child, s, mod, ok, it) {
  const ctx = it && it.target ? { sentence: it.target } : {};
  const { out, trace } = core.withChild(child.profile, { lang: s.lang, ctx }, T => {
    if (mod === 'math' && it) {
      if (it.concept) T.noteSkillFromConcept(it.concept, ok);
      else if (it.skill && T.skillById(it.skill)) T.noteSkillAttempt(it.skill, ok);
    }
    const mv = T.record(mod, ok);
    T.mirrorToClassNow(T.S);
    return mv;
  });
  for (const t of trace) s.trace.push(t.msg);
  return out;
}

/* A first-try answer to a sum: for a wrong one, the named mistake behind it and one
   spoken line of help aimed at it (src/core/mathgen.js), kept in the
   child's twin (src/core/twin.js) when it is the child's own lesson
   answer — a help call's steps are help, not evidence. */
function mistakeOf(core, child, s, it, got) {
  if (!it.problem || it.eased) return null;
  const lang = s.lang;
  const { out } = core.withChild(child.profile, { lang }, T => {
    const p = T.parseProblem(it.problem);
    if (!p) return null;
    if (it.kind !== 'helpstep' && it.skill) T.twinAnswer(it.skill, p, got);   // right answers too: a habit is judged over the latest answers
    const id = T.whichMistake(p, got);
    if (!T.MISTAKES[id]) return null;
    const tip = T.mistakeTip(id, p, lang, n => nw(n, lang), true);
    return tip ? { id, tip } : null;
  });
  return out;
}

/* The skill a free-practice sum actually exercises, read off the numbers
   the same way the skill graph defines them (content/skills.js): a two-
   digit sum whose ones overflow IS carrying, one that doesn't is add2. */
function skillOfProblem(g) {
  if (g.op === '×') return 'tables';
  if (g.op === '+') {
    if (g.a < 10 && g.b < 10 && g.ans <= 10) return 'add10';
    if (g.a < 10 && g.b < 10) return 'count20';
    return (g.a % 10) + (g.b % 10) >= 10 ? 'carry' : 'add2';
  }
  if (g.a <= 10) return 'sub10';
  return (g.a % 10) < (g.b % 10) ? 'borrow' : 'sub2';
}

/* The app's matcher, unchanged. A phone transcript carries no confidence
   score, so confidence is 0: per gradeVerdict(), anything under the gate
   score becomes 'unsure' — asked again, never marked down. */
function gradeLine(core, child, s, target, alternatives) {
  const { out } = core.withChild(child.profile, { lang: s.lang }, T => {
    const best = T.gradeBest(target, alternatives.map(t => ({ transcript: t, confidence: 0 })), s.lang);
    // the band's own thresholds (content/ages.js) — nothing hardcoded here
    const th = T.getGradeThresholds();
    return { score: best.score, verdict: T.gradeVerdict(best), gate: th.gateScore, pass: th.pass,
             misread: best.misread, slips: best.slips,
             tokens: best.tokens.map(x => ({ text: x.text, state: x.state, heard: x.heard })) };
  });
  return out;
}

/* Can a skill be asked as one spoken sum at this child's band? */
function skillSpoken(core, child, skill) {
  const { out } = core.withChild(child.profile, { lang: child.lang === 'en' ? 'en' : 'hi' }, T => {
    const sp = T.skillHasProblem(skill) ? T.skillProblem(skill, 1) : null;
    return !!(sp && SPOKEN_OPS[sp.op]);
  });
  return out;
}

/* For the weekly parent call: is there teacher homework, can it be asked
   out loud, and has a call already asked it? */
function homeworkStatus(core, child, sessions) {
  const { out } = core.withChild(child.profile, { lang: child.lang === 'en' ? 'en' : 'hi' }, T => {
    const hw = T.personalizeContentForHomework(T.S);
    if (!hw) return { assigned: false };
    const sp = hw.storySkill ? T.skillProblem(hw.storySkill, 1) : null;
    return { assigned: true, skill: hw.storySkill || null, assignedAt: hw.assignedAt, spoken: !!(sp && SPOKEN_OPS[sp.op]) };
  });
  if (out.assigned) out.asked = (sessions || []).some(s => s && s.homework_skill && Date.parse(s.created_at) >= (out.assignedAt || 0) &&
    (s.items || []).some(x => x.kind === 'homework' && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent'));
  return out;
}

module.exports = { praiseFor, fill, nw, joinSay, SPOKEN_OPS, skillSpoken, homeworkStatus, planSession, next, answer, finish, buildStoryBank, gradeLine, recordOutcome, L, STORY, MAX_CALL_MS, MAX_TURNS };
