/* ==================================================================
   PARENT CALLS — the consent call and the weekly progress call

   Same rule as the lesson: the voice model only speaks the "say" this
   file returns, and passes the parent's words back. Every sentence a
   parent hears is written here, in Hindi and English; nothing is
   improvised, nothing is promised that the code doesn't do.

   THE CONSENT CALL is the first call to a family. Munni says who she is,
   what Takhti keeps and who processes the call, then asks — one question
   at a time, yes or no — whether Munni may call the child, and whether the
   calls may be recorded. Then the time and the days. A "yes" spoken on
   the call is not the end of it: after the call, the reply to each
   consent question is checked against Bolna's own transcript (as reading
   is), because a voice model can tidy "nahi" into "haan". Consent counts
   only when both agree; otherwise a person reviews it. Silence, doubt or
   a muddle is never a yes.

   THE WEEKLY CALL tells a parent, in their language, how the week went,
   and answers what parents actually ask ("is she behind?", "what should
   we do at home?", "can it be at six?", "stop these calls") from the
   child's real record — and says plainly what it can't know.

   Hindi lines avoid gendered verbs for the child ("X का अभ्यास चल रहा है",
   not "X कर रहा/रही है"): Takhti doesn't store a child's gender.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const { intentOf, keypadOf } = require('./understand');
const C = require('./clock');

// bump when the consent notice's wording changes: the record says which
// notice a parent agreed to
const NOTICE_VERSION = 'consent-2026-10-v2';   // v2: the separate question about improving Takhti
const MAX_TURNS = 30;
const MAX_QUESTIONS = 8;

/* ---------- yes / no, strictly ----------
   For consent, a reply with both a yes-word and a no-word ("नहीं, कोई
   दिक्कत नहीं") is a muddle, not an answer: ask again. */
const YES = ['yes', 'yeah', 'yep', 'yup', 'ya', 'haan', 'han', 'haa', 'haanji', 'hanji', 'ji', 'jee', 'ok', 'okay', 'theek', 'thik',
  'sure', 'agree', 'agreed', 'bilkul', 'zaroor', 'jarur', 'jaroor', 'manzoor', 'sahmat', 'हाँ', 'हां', 'जी', 'ठीक', 'बिल्कुल', 'बिलकुल',
  'ज़रूर', 'जरूर', 'मंज़ूर', 'मंजूर', 'सहमत', 'हाँजी', 'हांजी'];
const NO = ['no', 'nope', 'nah', 'not', "don't", 'dont', 'disagree', 'nahi', 'nahin', 'nai', 'na', 'naa', 'mat', 'नहीं', 'नही', 'ना', 'न', 'मत'];
function words(s) {
  return String(s || '').normalize('NFC').toLowerCase().replace(/[.,!?;:"'“”‘’()\[\]।॥…]/g, ' ').split(/\s+/).filter(Boolean);
}
// "no problem" is a yes, though it is made of no-words
const NO_PROBLEM = /\b(no problem|koi (dikkat|problem|baat|pareshani) nahi[n]?|koi baat nahi)\b|कोई (दिक्कत|दिक़्क़त|प्रॉब्लम|बात|परेशानी) नहीं/gi;
function strictYesNo(said) {
  const k = keypadOf(said);
  if (k === '1') return true;
  if (k === '2') return false;
  // "pata nahi" is "I don't know", not "no"
  if (intentOf(said) === 'dontKnow') return null;
  const raw = String(said || '').normalize('NFC');
  const np = raw.match(NO_PROBLEM);
  const w = words(raw.replace(NO_PROBLEM, ' haan '));
  if (np) w.push('haan');
  const y = w.some(t => YES.includes(t)), n = w.some(t => NO.includes(t));
  return y && !n ? true : n && !y ? false : null;
}

/* ---------- what a parent is asking ---------- */
const ANY = (u, list) => list.some(re => re.test(u));
const R = {
  stop:     [/\b(stop|no more|band|bandh|mat karo|mat kijiye|nahi chahiye|nahin chahiye|ruk|rok|cancel)\b/i, /बंद|मत करो|मत कीजिए|नहीं चाहिए|रोक|रुक/],
  lessons:  [/\b(lesson|lessons|class|padhai|padhaai|paath|munni ki call)\b/i, /पढ़ाई|पढाई|पाठ|क्लास/],
  time:     [/\b(time|timing|samay|waqt|baje|o'?clock|change the time|earlier|later)\b/i, /समय|वक़्त|वक्त|बजे|टाइम/],
  behind:   [/\b(behind|peeche|piche|kamzor|weak|how is (she|he|it) doing|how'?s (she|he) doing|how (she|he) is doing|kaisa|kaisi|progress|level|compared|aage|ahead|theek chal)\b/i,
             /पीछे|कमज़ोर|कमजोर|कैसा|कैसी|आगे|प्रगति|लेवल|ठीक चल/],
  practise: [/\b(what (should|can) (i|we)|how (can|do) (i|we) help|kya karein|kya karen|kya karayein|kya karaun|kya karwayein|help|madad|ghar par|ghar pe|at home)\b/i,
             /क्या करें|क्या कराएँ|क्या कराऊँ|मदद|घर पर|घर पे/],
  reading:  [/\b(read|reading|padh|padhna|padhne|hindi)\b/i, /पढ़|पढ/],
  maths:    [/\b(math|maths|sums|ganit|hisab|hisaab|numbers|ginti|jod|counting)\b/i, /गणित|हिसाब|गिनती|जोड़|सवाल/],
  english:  [/\b(english|angrezi|angreji|inglish)\b/i, /अंग्रेज़ी|अंग्रेजी|इंग्लिश/],
  homework: [/\b(homework|home work|teacher|school|grihkary)\b/i, /होमवर्क|गृहकार्य|टीचर|स्कूल|अध्यापक/],
  privacy:  [/\b(record|recording|recorded|data|privacy|private|safe|delete|kaun sunta|who listens)\b/i, /रिकॉर्ड|डेटा|सुरक्षित|मिटा|कौन सुनता/],
  bye:      [/\b(bye|thank|thanks|thank you|dhanyavad|dhanyawad|shukriya|bas|that'?s all|nothing|kuch nahi|kuchh nahi|no questions)\b/i,
             /(^|\s)(बस|धन्यवाद|शुक्रिया|कुछ नहीं|बाय)(?=$|[\s,.!?।])/]
};
function parentIntent(said) {
  const u = String(said || '').normalize('NFC');
  if (!u.trim()) return 'silence';
  if (keypadOf(u) === '*' || intentOf(u) === 'repeat') return 'repeat';
  if (ANY(u, R.stop)) return ANY(u, R.lessons) ? 'stopLessons' : 'stopWeekly';
  if (C.parseClock(u, { needMarker: true }) || C.daysOf(u) || ANY(u, R.time)) return 'time';
  for (const k of ['practise', 'behind', 'homework', 'english', 'reading', 'maths', 'privacy', 'bye']) if (ANY(u, R[k])) return k;
  const yn = strictYesNo(u);
  return yn === false ? 'bye' : yn === true ? 'yes' : 'unknown';
}

/* ---------- the lines ---------- */
const MOD = { read: { en: 'reading', hi: 'पढ़ने' }, math: { en: 'maths', hi: 'गणित' } };
function contactHow(lang, contact) {
  if (contact) return lang === 'hi' ? `${contact} पर फ़ोन या मैसेज करें` : `call or message ${contact}`;
  return lang === 'hi' ? 'उस स्कूल या टीचर को बताएँ जिन्होंने आपको तख़्ती दी' : 'tell the school or teacher who gave you Takhti';
}
const keys = (lang, on) => on ? (lang === 'hi' ? ' आप हाँ के लिए 1, या नहीं के लिए 2 भी दबा सकते हैं।' : ' You can also press 1 for yes, or 2 for no.') : '';

const L = {
  greetConsent: {
    en: n => `Namaste! This is Munni from Takhti. I'm calling about practice lessons for ${n}. Am I speaking with ${n}'s parent or guardian?`,
    hi: n => `नमस्ते! मैं तख़्ती से मुन्नी बोल रही हूँ। ${n} के अभ्यास पाठों के बारे में फ़ोन किया है। क्या मैं ${n} के माता-पिता या अभिभावक से बात कर रही हूँ?`
  },
  greetClass: {
    en: n => `Namaste! This is Munni from Takhti, with a message from ${n}'s class teacher. Am I speaking with ${n}'s parent or guardian?`,
    hi: n => `नमस्ते! मैं तख़्ती से मुन्नी बोल रही हूँ, ${n} की कक्षा के टीचर का एक संदेश लेकर। क्या मैं ${n} के माता-पिता या अभिभावक से बात कर रही हूँ?`
  },
  classIntro: {
    en: (n, t, skill) => `${t ? t + ', ' + n + "'s teacher, asked me to call. " : ''}This week, several children in ${n}'s class found "${skill}" hard.`,
    hi: (n, t, skill) => `${t ? t + ' जी, ' + n + ' के टीचर, ने यह फ़ोन करने को कहा है। ' : ''}इस हफ़्ते ${n} की कक्षा के कई बच्चों को "${skill}" में दिक्कत हुई।`
  },
  classNote: { en: note => ` The teacher says: ${note}`, hi: note => ` टीचर का कहना है: ${note}` },
  classSolid: { en: n => ` ${n} is already doing well at this.`, hi: n => ` ${n} इसमें पहले से अच्छा कर रहे हैं।` },
  classWorking: { en: n => ` ${n} is still working on this too.`, hi: n => ` ${n} का भी इस पर अभ्यास चल रहा है।` },
  classUnseen: { en: n => ` Munni hasn't practised this with ${n} yet.`, hi: n => ` मुन्नी ने अभी तक ${n} के साथ इसका अभ्यास नहीं किया है।` },
  classPromise: { en: n => ` Munni will practise it with ${n} on the next calls.`, hi: n => ` मुन्नी अगली कॉल्स में ${n} के साथ इसका अभ्यास कराएगी।` },
  classTipLead: { en: () => ' At home:', hi: () => ' घर पर:' },
  notNowClass: { en: () => "No problem. The teacher has the same message. Goodbye!", hi: () => 'कोई बात नहीं। यही संदेश टीचर के पास भी है। नमस्ते!' },
  greetWeekly: {
    en: n => `Namaste! This is Munni from Takhti, with ${n}'s week of practice. Am I speaking with ${n}'s parent or guardian?`,
    hi: n => `नमस्ते! मैं तख़्ती से मुन्नी बोल रही हूँ, ${n} के इस हफ़्ते के अभ्यास के बारे में। क्या मैं ${n} के माता-पिता या अभिभावक से बात कर रही हूँ?`
  },
  notice: {
    en: (n, how, kp) => `Thank you. Takhti is a free practice tutor for reading and maths. On the days you choose, Munni calls ${n} on this number for a five-minute lesson. ` +
      `To check the answers, our voice service, Bolna, turns what ${n} says on the call into text. We keep ${n}'s first name, age, this phone number and the answers. ` +
      `We don't sell them or share them with anyone else. To stop the calls or have everything deleted at any time, ${how}. ` +
      `Do you agree that Munni may call ${n} for these lessons? Please say yes or no.${kp}`,
    hi: (n, how, kp) => `धन्यवाद। तख़्ती पढ़ने और गणित के अभ्यास का एक मुफ़्त ट्यूटर है। आप जो दिन चुनें, उन दिनों मुन्नी इसी नंबर पर ${n} को पाँच मिनट के पाठ के लिए फ़ोन करती है। ` +
      `जवाब जाँचने के लिए हमारी वॉइस सेवा, Bolna, कॉल पर ${n} की बातों को लिखित रूप में बदलती है। हम ${n} का पहला नाम, उम्र, यह फ़ोन नंबर और जवाब रखते हैं। ` +
      `हम ये न किसी को बेचते हैं, न किसी और के साथ साझा करते हैं। कभी भी कॉल बंद करवाने या सब कुछ मिटवाने के लिए ${how}। ` +
      `क्या आप सहमत हैं कि मुन्नी इन पाठों के लिए ${n} को फ़ोन करे? कृपया हाँ या नहीं बोलें।${kp}`
  },
  askAgain: {
    en: (n, kp) => `Sorry, I didn't catch that. Do you agree that Munni may call ${n} for lessons? Please say yes or no.${kp}`,
    hi: (n, kp) => `माफ़ कीजिए, मैं समझ नहीं पाई। क्या आप सहमत हैं कि मुन्नी पाठों के लिए ${n} को फ़ोन करे? कृपया हाँ या नहीं बोलें।${kp}`
  },
  whoAgain: {
    en: n => `Sorry, I didn't catch that. Am I speaking with ${n}'s parent or guardian? Please say yes or no.`,
    hi: n => `माफ़ कीजिए, मैं समझ नहीं पाई। क्या मैं ${n} के माता-पिता या अभिभावक से बात कर रही हूँ? कृपया हाँ या नहीं बोलें।`
  },
  recording: {
    en: (n, kp) => `Thank you. One more question: may we keep the sound recording of the calls, so a person at Takhti can check that Munni is teaching well? The lessons work just the same if you say no.${kp}`,
    hi: (n, kp) => `धन्यवाद। एक और सवाल: क्या हम कॉल की आवाज़ की रिकॉर्डिंग रख सकते हैं, ताकि तख़्ती में कोई व्यक्ति जाँच सके कि मुन्नी ठीक से सिखा रही है? अगर आप नहीं कहें, तब भी पाठ वैसे ही चलेंगे।${kp}`
  },
  recordingAgain: {
    en: () => 'Sorry, I didn\'t catch that. May we keep the recordings? Yes or no?',
    hi: () => 'माफ़ कीजिए, मैं समझ नहीं पाई। क्या हम रिकॉर्डिंग रख सकते हैं? हाँ या नहीं?'
  },
  research: {
    en: (n, kp) => `And may Takhti use the words ${n} reads on the calls (never the name, never the voice) to make Takhti better for all children? The lessons work just the same if you say no.${kp}`,
    hi: (n, kp) => `और क्या तख़्ती, कॉल पर ${n} के पढ़े हुए शब्दों को (नाम या आवाज़ कभी नहीं) सभी बच्चों के लिए तख़्ती को बेहतर बनाने में इस्तेमाल कर सकती है? अगर आप नहीं कहें, तब भी पाठ वैसे ही चलेंगे।${kp}`
  },
  researchAgain: {
    en: () => "Sorry, I didn't catch that. May Takhti use the words, without the name? Yes or no?",
    hi: () => 'माफ़ कीजिए, मैं समझ नहीं पाई। क्या तख़्ती बिना नाम के शब्दों का इस्तेमाल कर सकती है? हाँ या नहीं?'
  },
  time: {
    en: n => `What time should Munni call ${n}? For example, five in the evening.`,
    hi: n => `मुन्नी ${n} को किस समय फ़ोन करे? जैसे, शाम पाँच बजे।`
  },
  timeQuiet: {
    en: (from, to) => `That's rest time for children, so Munni doesn't call then. Any time from ${from} to ${to} works. What time should she call?`,
    hi: (from, to) => `वह बच्चों के आराम का समय है, तब मुन्नी फ़ोन नहीं करती। ${from} से ${to} के बीच कोई भी समय ठीक है। किस समय फ़ोन करे?`
  },
  days: {
    en: c => `Okay, at ${c}. Should Munni call every day, or every other day?`,
    hi: c => `ठीक है, ${c}। मुन्नी रोज़ फ़ोन करे, या एक दिन छोड़कर?`
  },
  weekly: {
    en: n => `And would you like a short call from me every Sunday evening, about how ${n}'s practice is going?`,
    hi: n => `और क्या आप चाहेंगे कि मैं हर रविवार शाम फ़ोन करके बताऊँ कि ${n} का अभ्यास कैसा चल रहा है?`
  },
  agreed: {
    en: (n, days, c, start, how) => `Thank you! Munni will call ${n} ${days} at ${c}, starting ${start}. To stop at any time, ${how}. Goodbye!`,
    hi: (n, days, c, start, how) => `धन्यवाद! मुन्नी ${days} ${c} ${n} को फ़ोन करेगी, ${start} से। कभी भी रोकने के लिए ${how}। नमस्ते!`
  },
  refused: {
    en: n => `That's completely fine. Munni won't call ${n}. Thank you for your time. Goodbye!`,
    hi: n => `बिल्कुल ठीक है। मुन्नी ${n} को फ़ोन नहीं करेगी। आपके समय के लिए धन्यवाद। नमस्ते!`
  },
  notParent: {
    en: n => `Thank you. Please tell ${n}'s parent that Takhti called. Goodbye!`,
    hi: n => `धन्यवाद। कृपया ${n} के माता-पिता को बता दीजिए कि तख़्ती से फ़ोन आया था। नमस्ते!`
  },
  unclear: {
    en: () => "I couldn't hear clearly, so I won't set anything up today. Thank you, goodbye!",
    hi: () => 'मुझे साफ़ सुनाई नहीं दिया, इसलिए आज मैं कुछ शुरू नहीं करूँगी। धन्यवाद, नमस्ते!'
  },
  // ---- the weekly call ----
  menu: {
    en: n => `You can ask me how ${n} is doing, what to practise at home, about reading, maths or English, or to change the call time. What would you like to know?`,
    hi: n => `आप मुझसे पूछ सकते हैं कि ${n} का अभ्यास कैसा चल रहा है, घर पर क्या अभ्यास कराएँ, पढ़ने, गणित या अंग्रेज़ी के बारे में, या कॉल का समय बदलना। आप क्या जानना चाहेंगे?`
  },
  more: { en: () => 'Anything else?', hi: () => 'कुछ और पूछना है?' },
  notNow: { en: () => "No problem. Takhti will call again next week. Goodbye!", hi: () => 'कोई बात नहीं। तख़्ती अगले हफ़्ते फिर फ़ोन करेगी। नमस्ते!' },
  bye: { en: () => 'Thank you! Have a good week. Goodbye!', hi: () => 'धन्यवाद! आपका हफ़्ता अच्छा रहे। नमस्ते!' },
  onlyLessons: { en: n => `I can only help with ${n}'s lessons. `, hi: n => `मैं सिर्फ़ ${n} के पाठों के बारे में बता सकती हूँ। ` },
  weekNone: { en: n => `Munni didn't get to practise with ${n} this week.`, hi: n => `इस हफ़्ते मुन्नी ${n} के साथ अभ्यास नहीं कर पाई।` },
  weekTried: { en: k => ` She tried ${k === 1 ? 'once' : k + ' times'} but couldn't get through.`, hi: k => ` मुन्नी ने ${k} बार कोशिश की, पर बात नहीं हो पाई।` },
  weekSome: {
    en: (n, c, m) => `This week ${n} practised with Munni ${c === 1 ? 'once' : c === 2 ? 'twice' : c + ' times'}, about ${m} minute${m === 1 ? '' : 's'} in all.`,
    hi: (n, c, m) => `इस हफ़्ते ${n} ने मुन्नी के साथ ${c} बार अभ्यास किया, कुल लगभग ${m} मिनट।`
  },
  weekMath: { en: (c, k) => ` In maths, ${c} of ${k} sums were right the first time.`, hi: (c, k) => ` गणित में ${k} में से ${c} सवाल पहली बार में सही हुए।` },
  weekRead: { en: (g, k) => ` In reading, ${g} of ${k} lines were read well.`, hi: (g, k) => ` पढ़ने में ${k} में से ${g} लाइनें अच्छे से पढ़ी गईं।` },
  weekEng:  { en: (g, k) => ` In English, ${g} of ${k} words came straight away.`, hi: (g, k) => ` अंग्रेज़ी में ${k} में से ${g} शब्द तुरंत आ गए।` },
  weekUp:   { en: (n, mod) => ` Munni moved ${n} up a step in ${mod}.`, hi: (n, mod) => ` मुन्नी ने ${mod} में ${n} को एक कदम आगे बढ़ाया।` },
  and:      { en: () => ' and ', hi: () => ' और ' },
  weekQuiet: { en: (n, k) => ` ${n} went quiet on ${k} questions this week, which often means they felt hard.`,
               hi: (n, k) => ` इस हफ़्ते ${k} सवालों पर ${n} की ओर से जवाब नहीं आया; अक्सर इसका मतलब होता है कि सवाल कठिन लगे।` },
  weekEased: { en: () => ' So Munni started the next calls more gently.', hi: () => ' इसलिए मुन्नी ने अगली कॉल्स आसान शुरुआत से कीं।' },
  quietMost: { en: (n, sk) => ` ${n} went quiet most often on "${sk}". That is worth a gentle look together.`,
               hi: (n, sk) => ` सबसे ज़्यादा बार "${sk}" पर ${n} की ओर से जवाब नहीं आया। इस पर साथ में प्यार से ध्यान दें।` },
  weekHw:   { en: n => ` ${n} also worked on the teacher's homework.`, hi: n => ` ${n} ने टीचर का होमवर्क भी किया।` },
  tooEarly: {
    en: n => `It's too early to say: Munni has only heard ${n} a few times so far. After two or three weeks of lessons I can tell you more.`,
    hi: n => `अभी कहना जल्दी होगा: मुन्नी ने अभी तक ${n} को कुछ ही बार सुना है। दो-तीन हफ़्तों के पाठों के बाद मैं ज़्यादा बता पाऊँगी।`
  },
  behindIntro: {
    en: n => `I can't compare ${n} with the class; the teacher knows that best. Here is what Munni sees.`,
    hi: n => `मैं ${n} की तुलना कक्षा से नहीं कर सकती; यह टीचर सबसे अच्छा जानते हैं। मुन्नी को जो दिखता है, वह यह है।`
  },
  above: {
    en: (n, mod, comp) => ` In ${mod}, ${n} is ahead of where Takhti starts at this age, practising "${comp}".`,
    hi: (n, mod, comp) => ` ${mod} में ${n} इस उम्र की शुरुआत से आगे हैं, अभी "${comp}" का अभ्यास चल रहा है।`
  },
  same: {
    en: (n, mod, comp) => ` In ${mod}, ${n} is about where Takhti expects at this age, practising "${comp}".`,
    hi: (n, mod, comp) => ` ${mod} में ${n} इस उम्र के हिसाब से ठीक जगह पर हैं, अभी "${comp}" का अभ्यास चल रहा है।`
  },
  below: {
    en: (n, mod, comp) => ` In ${mod}, ${n} is still building the basics, practising "${comp}". That's common, and Munni stays on that step until it feels easy.`,
    hi: (n, mod, comp) => ` ${mod} में अभी नींव पक्की हो रही है, "${comp}" का अभ्यास चल रहा है। ऐसा अक्सर होता है; जब तक यह आसान न लगे, मुन्नी यही कदम दोहराएगी।`
  },
  homeIntro: { en: () => 'At home, try this:', hi: () => 'घर पर यह करें:' },
  homeWords: { en: w => /,/.test(w) ? ` read the words ${w} together, or look for them on a sign or a box.` : ` read the word "${w}" together, or look for it on a sign or a box.`, hi: w => /,/.test(w) ? ` ये शब्द साथ में पढ़ें: ${w}, या किसी बोर्ड या डिब्बे पर ढूँढें।` : ` "${w}" शब्द साथ में पढ़ें, या किसी बोर्ड या डिब्बे पर ढूँढें।` },
  homeMath:  { en: () => ' count things together at dinner, like rotis or spoons.', hi: () => ' खाने के समय साथ में चीज़ें गिनें, जैसे रोटियाँ या चम्मच।' },
  homeEng:   { en: w => ` say the English words ${w} when you see those things.`, hi: w => ` जब ये चीज़ें दिखें तो इनके अंग्रेज़ी नाम बोलें: ${w}।` },
  homeTeach: { en: n => ` ask ${n} to teach you one thing from a call. Explaining is great practice.`, hi: n => ` ${n} से कहें कि कॉल की कोई एक बात आपको सिखाएँ। समझाना बहुत अच्छा अभ्यास है।` },
  noRead: { en: n => `${n} didn't read with Munni this week.`, hi: n => `इस हफ़्ते ${n} ने मुन्नी के साथ पढ़ने का अभ्यास नहीं किया।` },
  noMath: { en: n => `${n} didn't do sums with Munni this week.`, hi: n => `इस हफ़्ते ${n} ने मुन्नी के साथ गणित का अभ्यास नहीं किया।` },
  nowPractising: { en: c => ` Now practising "${c}".`, hi: c => ` अभी "${c}" का अभ्यास चल रहा है।` },
  wordsToPractise: { en: w => ` Words worth practising: ${w}.`, hi: w => ` अभ्यास के लिए शब्द: ${w}।` },
  engOff: {
    en: n => `English practice is off for ${n}. Munni can make every other call a little spoken English. Would you like that?`,
    hi: n => `${n} के लिए अंग्रेज़ी अभ्यास अभी बंद है। मुन्नी हर दूसरी कॉल में थोड़ा अंग्रेज़ी बोलने का अभ्यास करा सकती है। क्या आप यह चाहेंगे?`
  },
  engOn: { en: () => 'Done. Every other call will now be spoken English practice.', hi: () => 'हो गया। अब हर दूसरी कॉल में अंग्रेज़ी बोलने का अभ्यास होगा।' },
  engStays: { en: () => 'Okay, it stays off.', hi: () => 'ठीक है, यह बंद ही रहेगा।' },
  engNone: { en: n => `English practice is on, but ${n} hasn't had an English call yet.`, hi: n => `अंग्रेज़ी अभ्यास चालू है, पर ${n} की अभी तक कोई अंग्रेज़ी कॉल नहीं हुई।` },
  engSome: {
    en: (n, g, k) => `In spoken English, ${n} knew ${g} of the last ${k} words straight away.`,
    hi: (n, g, k) => `अंग्रेज़ी बोलने में ${n} ने पिछले ${k} में से ${g} शब्द तुरंत बताए।`
  },
  hwNone: { en: () => "There's no teacher's homework on Takhti right now.", hi: () => 'अभी तख़्ती पर टीचर का कोई होमवर्क नहीं है।' },
  hwDone: { en: n => `${n}'s teacher set homework, and Munni has asked it on a call.`, hi: n => `${n} के टीचर ने होमवर्क दिया था, और मुन्नी ने एक कॉल पर वह पूछ लिया है।` },
  hwNext: { en: n => `${n}'s teacher set homework. Munni will ask it on the next call.`, hi: n => `${n} के टीचर ने होमवर्क दिया है। मुन्नी अगली कॉल पर वह पूछेगी।` },
  hwApp:  { en: n => `${n}'s teacher set homework that's best done in the Takhti app, not on a call.`, hi: n => `${n} के टीचर ने ऐसा होमवर्क दिया है जो कॉल पर नहीं, तख़्ती ऐप में करना ठीक रहेगा।` },
  timeAsk: { en: n => `What time should Munni call ${n}?`, hi: n => `मुन्नी ${n} को किस समय फ़ोन करे?` },
  timeSet: { en: (n, days, c) => `Done. From now on Munni will call ${n} ${days} at ${c}.`, hi: (n, days, c) => `हो गया। अब से मुन्नी ${days} ${c} ${n} को फ़ोन करेगी।` },
  timeNoSchedule: {
    en: (n, c) => `I've noted ${c}. Lessons for ${n} aren't switched on yet, so ask the school or teacher to start them.`,
    hi: (n, c) => `मैंने ${c} नोट कर लिया है। ${n} के पाठ अभी चालू नहीं हैं, उन्हें शुरू करने के लिए स्कूल या टीचर से कहें।`
  },
  stoppedWeekly: { en: n => `Okay, no more of these weekly calls. ${n}'s lessons carry on as before.`, hi: n => `ठीक है, अब ये हफ़्ते वाली कॉल नहीं आएँगी। ${n} के पाठ पहले की तरह चलते रहेंगे।` },
  stoppedLessons: { en: (n, how) => `Okay. Munni won't call ${n} for lessons from now on. To start again, ${how}.`, hi: (n, how) => `ठीक है। अब से मुन्नी ${n} को पाठ के लिए फ़ोन नहीं करेगी। फिर से शुरू करने के लिए ${how}।` },
  privacy: {
    en: (n, rec, how) => `We keep ${n}'s first name, age, this phone number and the answers from each lesson${rec ? ', and the call recordings you agreed to' : ''}. Nothing is sold or shared with anyone else. To have everything deleted, ${how}.`,
    hi: (n, rec, how) => `हम ${n} का पहला नाम, उम्र, यह फ़ोन नंबर और हर पाठ के जवाब रखते हैं${rec ? ', और कॉल की वह रिकॉर्डिंग जिसके लिए आपने हाँ कहा था' : ''}। कुछ भी बेचा या किसी और के साथ साझा नहीं किया जाता। सब कुछ मिटवाने के लिए ${how}।`
  }
};
const say = (k, lang, ...a) => (L[k][lang === 'hi' ? 'hi' : 'en'])(...a);

/* ---------- the week, from the child's real record ---------- */
const DAY_MS = 864e5;
function recent(sessions, days, now) {
  const since = (now || Date.now()) - days * DAY_MS;
  return (sessions || []).filter(s => s && Date.parse(s.created_at) >= since);
}
function weekFacts(child, sessions, now) {
  const wk = recent(sessions, 7, now);
  const done = wk.filter(s => s.status === 'done');
  const tried = wk.filter(s => s.status === 'missed' || s.status === 'no_lesson').length;
  const items = done.flatMap(s => s.items || []);
  const sums = items.filter(x => ['math', 'story', 'homework'].includes(x.kind) && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent');
  const reads = items.filter(x => x.kind === 'read' && x.evidence && x.evidence.verdict !== 'unsure');
  const eng = items.filter(x => (x.kind === 'eword' || x.kind === 'esay') && x.evidence && x.evidence.verdict !== 'unsure');
  const words = [];
  for (const x of reads) for (const w of (x.evidence.misread || []).concat(x.evidence.slips || [])) {
    const c = String(w).replace(/[.,!?।]/g, ''); if (c && !words.includes(c)) words.push(c);
  }
  const engMissed = [...new Set(eng.filter(x => x.evidence.first_verdict !== 'pass').map(x => x.word))];
  const up = {};
  for (const s of done) for (const m of ['read', 'math']) {
    if (s.levels_before && s.levels_after && s.levels_after[m] > s.levels_before[m]) up[m] = true;
  }
  const quiet = wk.reduce((a, x) => a + ((x.silence && x.silence.items.length) || 0), 0);
  return {
    quiet, eased: wk.some(x => x.ease),
    calls: done.length, tried,
    minutes: Math.max(done.length ? 1 : 0, Math.round(done.reduce((a, s) => a + ((s.call && s.call.duration_s) || 0), 0) / 60)),
    sums: sums.length, sumsFirst: sums.filter(x => x.outcome === 'correct').length,
    reads: reads.length, readsGood: reads.filter(x => x.evidence.verdict === 'pass').length,
    eng: eng.length, engGood: eng.filter(x => x.evidence.first_verdict === 'pass').length,
    words: words.slice(0, 3), engMissed: engMissed.slice(0, 3), up,
    homework: items.some(x => x.kind === 'homework' && x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent'),
    // how much first-try evidence the last month holds: below this, "is
    // she behind?" gets "too early to say", not a guess
    evidence: recent(sessions, 30, now).filter(s => s.status === 'done').flatMap(s => s.items || [])
      .filter(x => (x.outcome && x.outcome !== 'unsure' && x.outcome !== 'silent') || (x.evidence && x.evidence.verdict !== 'unsure')).length
  };
}
function weekSummary(child, f, lang) {
  const n = child.name;
  if (!f.calls) return say('weekNone', lang, n) + (f.tried ? say('weekTried', lang, f.tried) : '');
  let s = say('weekSome', lang, n, f.calls, f.minutes);
  if (f.sums) s += say('weekMath', lang, f.sumsFirst, f.sums);
  if (f.reads) s += say('weekRead', lang, f.readsGood, f.reads);
  if (f.eng) s += say('weekEng', lang, f.engGood, f.eng);
  const up = ['read', 'math'].filter(m => f.up[m]).map(m => MOD[m][lang === 'hi' ? 'hi' : 'en']);
  if (up.length) s += say('weekUp', lang, n, up.join(say('and', lang)));
  if (f.homework) s += say('weekHw', lang, n);
  if (f.quiet >= 2) s += say('weekQuiet', lang, n, f.quiet) + (f.eased ? say('weekEased', lang) : '');
  return s;
}

/* where the child is, against where Takhti starts for their age — the
   only comparison Takhti can honestly make */
function standing(core, child, lang) {
  const { out } = core.withChild(child.profile, { lang }, T => {
    const b = T.band();
    return ['read', 'math'].map(m => {
      const lvl = T.S.levels[m], start = b.start[m];
      const comp = T.COMPETENCY[m][lvl];
      return { m, rel: lvl > start ? 'above' : lvl === start ? 'same' : 'below', comp: comp ? comp[lang === 'hi' ? 'hi' : 'en'] : '' };
    });
  });
  return out;
}

/* ---------- a class-wide message ---------- */
const TIP = [
  [/^(add10|count20|bonds10|n-count5|l-count10|u-count20|u-addpic)$/, { en: ' add small things together, like 3 spoons and 2 spoons.', hi: ' छोटी चीज़ें साथ में जोड़ें, जैसे 3 चम्मच और 2 चम्मच।' }],
  [/^(add2|carry|place2|place3)$/, { en: ' make two numbers with bundles of ten sticks or coins, then put them together.', hi: ' दस-दस की गड्डियों या सिक्कों से दो संख्याएँ बनाएँ, फिर उन्हें मिलाएँ।' }],
  [/^(sub10|sub2|borrow|u-subpic)$/, { en: ' take away together: "we had 12 rotis and ate 5; how many are left?"', hi: ' साथ में घटाएँ: "12 रोटियाँ थीं, 5 खा लीं, कितनी बचीं?"' }],
  [/^(tables|mult2x1|mult2x2|skip)$/, { en: ' say a times table together on the way to school.', hi: ' स्कूल जाते हुए साथ में पहाड़ा बोलें।' }],
  [/^(divshare|divrem|longdiv)$/, { en: ' share things out equally, like 12 sweets between 3 people.', hi: ' चीज़ें बराबर बाँटें, जैसे 12 टॉफ़ी 3 लोगों में।' }],
  [/^money2$/, { en: ' let them count the money at the shop.', hi: ' दुकान पर पैसे उन्हें गिनने दें।' }],
  [/^(read\d|h\d-\w+|u-\w+|e\d-\w+|l-\w+)$/, { en: ' read one line together every day, from a sign, a box or a newspaper.', hi: ' हर दिन साथ में एक लाइन पढ़ें, किसी बोर्ड, डिब्बे या अख़बार से।' }]
];
function tipFor(skill, lang) {
  const row = TIP.find(([re]) => re.test(skill));
  return row ? row[1][lang === 'hi' ? 'hi' : 'en'] : (lang === 'hi' ? ' बच्चे से कहें कि इसका एक उदाहरण आपको दिखाएँ।' : ' ask them to show you one example.');
}
/* o: { skillName, teacher, note, standing: 'solid'|'working'|'unseen', promise } */
function classMessage(child, skill, o, lang) {
  const n = child.name;
  let m = say('classIntro', lang, n, o.teacher || '', o.skillName);
  if (o.note) m += say('classNote', lang, String(o.note).replace(/\s+/g, ' ').slice(0, 200).replace(/[.।]?$/, lang === 'hi' ? '।' : '.'));
  m += say(o.standing === 'solid' ? 'classSolid' : o.standing === 'working' ? 'classWorking' : 'classUnseen', lang, n);
  if (o.standing !== 'solid') m += say('classTipLead', lang) + tipFor(skill, lang);
  if (o.promise) m += say('classPromise', lang, n);
  return m;
}

/* ---------- planning a parent call ---------- */
function planParentCall(kind, child, o) {
  o = o || {};
  const lang = (child.parent_lang || child.lang) === 'en' ? 'en' : 'hi';
  const id = o.id || crypto.randomBytes(12).toString('base64url');
  const greeting = say(kind === 'consent' ? 'greetConsent' : kind === 'class' ? 'greetClass' : 'greetWeekly', lang, child.name);
  return {
    id, type: 'parent', kind, child_id: child.id, lang, keypad: o.keypad !== false,
    contact: o.contact || '', quiet: o.quiet || '21-7',
    status: 'planned', created_at: new Date().toISOString(), started_at: null, ended_at: null,
    greeting, step: 'who', turns: 0, questions: 0, unknowns: 0, pending: null,
    // each question is an item, so the after-call transcript check can line
    // the parent's replies up against Munni's words (report.js)
    items: [{ step: 'who', prompts: [greeting], said: [], retries: 0 }],
    answers: {}, outcome: null, done: false, goodbye: null, changes: [],
    summary: o.summary || null, facts: o.facts || null, notice: kind === 'consent' ? NOTICE_VERSION : null
  };
}

function ask(s, step, text) {
  s.step = step;
  s.items.push({ step, prompts: [text], said: [], retries: 0 });
  return { say: text, done: false };
}
function again(s, text) {
  const it = s.items[s.items.length - 1];
  it.retries++; it.prompts.push(text);
  return { say: text, done: false };
}
function finish(s, outcome, text) {
  s.done = true; s.outcome = s.outcome || outcome; s.goodbye = text;
  s.ended_at = new Date().toISOString();
  return { say: text, done: true };
}

/* ---------- one parent turn ----------
   ctx: { core, child, sessions, now, env, apply(change) } — apply() makes a
   change the parent asked for on the weekly call (time, stop, English). */
function parentTurn(s, said, ctx) {
  if (s.done) return { say: s.goodbye, done: true };
  if (!s.started_at) { s.started_at = new Date().toISOString(); s.status = 'live'; }
  s.turns++;
  const it = s.items[s.items.length - 1];
  it.said.push(String(said == null ? '' : said));
  if (s.turns > MAX_TURNS) return finish(s, s.kind === 'consent' ? 'unclear' : 'ended', s.kind === 'consent' ? say('unclear', s.lang) : say('bye', s.lang));
  return s.kind === 'consent' ? consentTurn(s, said, ctx) : weeklyTurn(s, said, ctx);
}

function consentTurn(s, said, ctx) {
  const n = ctx.child.name, lang = s.lang, kp = keys(lang, s.keypad);
  const it = s.items[s.items.length - 1];
  const how = contactHow(lang, s.contact);
  const repeat = parentIntent(said) === 'repeat';
  const yn = strictYesNo(said);
  switch (s.step) {
    case 'who':
      if (yn === true) { s.answers.parent = true; return ask(s, 'lessons', say('notice', lang, n, how, kp)); }
      if (yn === false) return finish(s, 'not_parent', say('notParent', lang, n));
      if (it.retries >= 2) return finish(s, 'unclear', say('unclear', lang));
      return again(s, say('whoAgain', lang, n));
    case 'lessons':
      if (repeat && it.retries < 2) return again(s, say('notice', lang, n, how, kp));
      if (yn === true) { s.answers.lessons = true; return ask(s, 'recording', say('recording', lang, n, kp)); }
      if (yn === false) { s.answers.lessons = false; return finish(s, 'refused', say('refused', lang, n)); }
      if (it.retries >= 2) return finish(s, 'unclear', say('unclear', lang));   // never assume a yes
      return again(s, say('askAgain', lang, n, kp));
    case 'recording':
      if (yn === null && it.retries < 1) return again(s, say('recordingAgain', lang));
      s.answers.recording = yn === true;                                        // doubt = no recording
      return ask(s, 'research', say('research', lang, n, kp));
    case 'research':
      if (yn === null && it.retries < 1) return again(s, say('researchAgain', lang));
      s.answers.research = yn === true;                                         // doubt = not used
      return ask(s, 'time', say('time', lang, n));
    case 'time': {
      const t = C.parseClock(said);
      const quiet = t && C.inQuiet(C.toMinutes(t), s.quiet);
      if (t && !quiet) s.answers.time = t;
      else if (it.retries < 1) {
        const b = C.quietBounds(s.quiet);
        return again(s, quiet ? say('timeQuiet', lang, C.clockSay(b.from, lang), C.clockSay(b.to, lang)) : say('time', lang, n));
      } else s.answers.time = '17:00';             // said back to them in the next question
      return ask(s, 'days', say('days', lang, C.clockSay(s.answers.time, lang)));
    }
    case 'days': {
      // "no, six o'clock" while asked about days: the time changes, ask again
      const t = C.parseClock(said, { needMarker: true });
      if (t && !C.inQuiet(C.toMinutes(t), s.quiet) && t !== s.answers.time && it.retries < 2) {
        s.answers.time = t;
        return again(s, say('days', lang, C.clockSay(t, lang)));
      }
      s.answers.days = C.daysOf(said) || 'alternate';                            // doubt = fewer calls
      return ask(s, 'weekly', say('weekly', lang, n));
    }
    case 'weekly': {
      s.answers.weekly = yn === true;
      const days = C.DAYS[s.answers.days];
      const now = C.localParts(ctx.now || new Date(), ctx.env);
      const first = C.nextCallDay(days, now);
      const start = first && first.inDays === 1 ? (lang === 'hi' ? 'कल' : 'tomorrow')
        : first ? (lang === 'hi' ? C.DAY_NAME.hi[first.weekday] : 'on ' + C.DAY_NAME.en[first.weekday]) : '';
      return finish(s, 'agreed', say('agreed', lang, n, C.daysSay(days, lang), C.clockSay(s.answers.time, lang), start, how));
    }
  }
  return finish(s, 'unclear', say('unclear', lang));
}

function weeklyTurn(s, said, ctx) {
  const child = ctx.child, n = child.name, lang = s.lang;
  const intent = parentIntent(said);
  const how = contactHow(lang, s.contact);
  const more = ' ' + say('more', lang);

  if (s.step === 'who') {
    const yn = strictYesNo(said);
    // on the weekly call a "no" is as likely to mean "not now" as "not the parent"
    if (yn === false || intent === 'bye') return finish(s, 'not_now', say(s.kind === 'class' ? 'notNowClass' : 'notNow', lang));
    const question = !['yes', 'unknown', 'repeat'].includes(intent);
    if (yn === null && !question && s.items[0].retries < 1) return again(s, say('whoAgain', lang, n));
    s.answers.parent = true;
    // the summary first; a parent who asked straight away gets the answer too
    const lead = s.summary + ' ';
    if (question) return answerQuestion(s, intent, said, ctx, lead, more, how);
    return ask(s, 'talk', lead + say('menu', lang, n));
  }

  // a pending yes/no (switching on English practice)
  if (s.pending === 'english_on') {
    s.pending = null;
    const yn = strictYesNo(said);
    if (yn === true) { ctx.apply({ english_practice: true }); s.changes.push('english_on'); return ask(s, 'talk', say('engOn', lang) + more); }
    if (yn === false) return ask(s, 'talk', say('engStays', lang) + more);
  }
  if (s.pending === 'time') {
    s.pending = null;
    const t = C.parseClock(said);
    if (t) return setTime(s, t, C.daysOf(said), ctx, more);
  }
  return answerQuestion(s, intent, said, ctx, '', more, how);
}

function answerQuestion(s, intent, said, ctx, lead, more, how) {
  const child = ctx.child, n = child.name, lang = s.lang, f = s.facts || {};
  const L2 = lang === 'hi' ? 'hi' : 'en';
  s.questions++;
  if (intent !== 'unknown') s.unknowns = 0;
  if (s.questions > MAX_QUESTIONS || intent === 'bye') return finish(s, 'ended', lead + say('bye', lang));
  const out = text => ask(s, 'talk', lead + text + more);

  switch (intent) {
    case 'repeat': return out(s.summary);
    case 'stopWeekly': ctx.apply({ weekly_enabled: false }); s.changes.push('weekly_off'); return finish(s, 'ended', lead + say('stoppedWeekly', lang, n) + ' ' + say('bye', lang));
    case 'stopLessons': ctx.apply({ lessons_enabled: false }); s.changes.push('lessons_off'); return out(say('stoppedLessons', lang, n, how));
    case 'time': {
      const t = C.parseClock(said, { needMarker: true });
      if (t) return setTime(s, t, C.daysOf(said), ctx, more, lead);
      const d = C.daysOf(said);
      if (d && child.schedule && child.schedule.time) return setTime(s, child.schedule.time, d, ctx, more, lead);
      s.pending = 'time';
      return ask(s, 'talk', lead + say('timeAsk', lang, n));
    }
    case 'behind': {
      if ((f.evidence || 0) < 6) return out(say('tooEarly', lang, n));
      const only = ['read', 'math'].filter(m => ANY(said, R[m === 'read' ? 'reading' : 'maths']));
      const rows = standing(ctx.core, child, lang).filter(r => !only.length || only.includes(r.m));
      return out(say('behindIntro', lang, n) + rows.map(r => say(r.rel, lang, n, MOD[r.m][L2], r.comp)).join('') + quietMostLine(ctx, child, lang));
    }
    case 'practise': {
      let t = say('homeIntro', lang);
      if (f.words && f.words.length) t += say('homeWords', lang, f.words.join(', '));
      if (f.sums && f.sumsFirst < f.sums / 2) t += say('homeMath', lang);
      if (f.engMissed && f.engMissed.length) t += say('homeEng', lang, f.engMissed.join(', '));
      if (t === say('homeIntro', lang)) t += say('homeTeach', lang, n);
      return out(t);
    }
    case 'reading': {
      const st = standing(ctx.core, child, lang).find(r => r.m === 'read');
      let t = f.reads ? say('weekRead', lang, f.readsGood, f.reads).trim() : say('noRead', lang, n);
      if (st && st.comp) t += say('nowPractising', lang, st.comp);
      if (f.words && f.words.length) t += say('wordsToPractise', lang, f.words.join(', '));
      return out(t);
    }
    case 'maths': {
      const st = standing(ctx.core, child, lang).find(r => r.m === 'math');
      let t = f.sums ? say('weekMath', lang, f.sumsFirst, f.sums).trim() : say('noMath', lang, n);
      if (st && st.comp) t += say('nowPractising', lang, st.comp);
      return out(t + quietMostLine(ctx, child, lang));
    }
    case 'english': {
      if (!child.english_practice) { s.pending = 'english_on'; return ask(s, 'talk', lead + say('engOff', lang, n)); }
      const h = Object.values(child.english_words || {});
      const k = h.reduce((a, x) => a + x.n, 0), g = h.reduce((a, x) => a + x.right, 0);
      return out(k ? say('engSome', lang, n, g, k) : say('engNone', lang, n));
    }
    case 'homework': {
      const hw = ctx.homework || {};
      return out(!hw.assigned ? say('hwNone', lang) : !hw.spoken ? say('hwApp', lang, n) : hw.asked ? say('hwDone', lang, n) : say('hwNext', lang, n));
    }
    case 'privacy': return out(say('privacy', lang, n, !!(child.consent && child.consent.recording), how));
    case 'yes': return out(say('menu', lang, n).replace(/\s*$/, ''));
    default:
      s.unknowns++;
      if (s.unknowns >= 3) return finish(s, 'ended', lead + say('bye', lang));
      return ask(s, 'talk', lead + say('onlyLessons', lang, n) + say('menu', lang, n));
  }
}

/* where the child went quiet most (two or more times): worth knowing */
function quietMostLine(ctx, child, lang) {
  const top = Object.entries(child.quiet_skills || {}).filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1])[0];
  if (!top) return '';
  const sk = ctx.core.T.skillById(top[0]);
  return sk ? say('quietMost', lang, child.name, lang === 'hi' ? sk.hi : sk.en.toLowerCase()) : '';
}

function setTime(s, t, days, ctx, more, lead) {
  const lang = s.lang, n = ctx.child.name;
  lead = lead || '';
  if (C.inQuiet(C.toMinutes(t), s.quiet)) {
    const b = C.quietBounds(s.quiet);
    s.pending = 'time';
    return ask(s, 'talk', lead + say('timeQuiet', lang, C.clockSay(b.from, lang), C.clockSay(b.to, lang)));
  }
  const sch = ctx.child.schedule;
  if (!sch) { ctx.apply({ time: t, days: days ? C.DAYS[days] : null }); s.changes.push('time'); return ask(s, 'talk', lead + say('timeNoSchedule', lang, n, C.clockSay(t, lang)) + more); }
  const newDays = days ? C.DAYS[days] : sch.days;
  ctx.apply({ time: t, days: newDays });
  s.changes.push('time');
  return ask(s, 'talk', lead + say('timeSet', lang, n, C.daysSay(newDays, lang), C.clockSay(t, lang)) + more);
}

/* ---------- after a parent call ----------
   Like the lesson's reading check: Bolna's transcript, not the voice
   model's relay, settles what was agreed. For each consent question we
   take the parent's reply straight from the recognizer and require it to
   agree with what was relayed live. */
const TERMINAL = new Set(['completed', 'no-answer', 'busy', 'failed', 'canceled', 'stopped', 'error', 'balance-low', 'call-disconnected']);

function settleConsent(s) {
  const decided = step => {
    const it = s.items.find(x => x.step === step);
    if (!it) return { relay: null, tx: null, heard: false };
    const relayed = it.said.length ? strictYesNo(it.said[it.said.length - 1]) : null;
    const txs = (it.heard_tx || []).filter(x => x != null);
    return { relay: relayed, tx: txs.length ? strictYesNo(txs[txs.length - 1]) : null, heard: txs.length > 0 };
  };
  const who = decided('who'), les = decided('lessons'), rec = decided('recording'), res = decided('research');
  const a = s.answers;
  if (a.parent !== true || a.lessons !== true) {
    return { status: a.lessons === false ? 'refused' : 'pending', why: s.outcome || 'call ended early' };
  }
  // both consent answers must be heard in the transcript as the same yes
  const ok = q => q.relay === true && q.tx === true;
  const terms = {
    recording: ok(rec),                       // a doubtful recording answer is simply "no"
    research: ok(res),                        // same for using the words to improve Takhti
    time: a.time || '17:00', days: C.DAYS[a.days || 'alternate'], weekly: a.weekly === true
  };
  if (ok(who) && ok(les)) return { status: 'given', terms };
  return { status: 'needs_review', terms, why: !who.heard || !les.heard ? 'not found in the transcript' : 'the transcript and the live relay disagree' };
}

function processParentEnd(child, s, payload) {
  const status = String(payload.status || '').toLowerCase();
  if (!TERMINAL.has(status)) return { changed: false, reason: 'not terminal: ' + status };
  if (s.processed && s.processed_exec === payload.id) return { changed: false, reason: 'already processed' };
  const { parseTranscript, alignToTranscript } = require('./report');
  const tel = payload.telephony_data || {};
  s.call = Object.assign(s.call || {}, {
    execution_id: payload.id, status, duration_s: Number(payload.conversation_duration || tel.duration || 0),
    recording_url: tel.recording_url || null, answered_by_voice_mail: !!payload.answered_by_voice_mail
  });
  s.transcript = String(payload.transcript || '');
  s.processed = true; s.processed_exec = payload.id; s.processed_at = new Date().toISOString();
  const spoke = s.items.some(it => it.said.length);
  s.status = !spoke ? 'missed' : 'done';
  if (!spoke) return { changed: true, status: s.status };
  alignToTranscript(s, parseTranscript(s.transcript));
  if (s.kind === 'consent') s.consent = settleConsent(s);
  return { changed: true, status: s.status, consent: s.consent || null };
}

module.exports = { classMessage, tipFor, processParentEnd, settleConsent, planParentCall, parentTurn, parentIntent, strictYesNo, weekFacts, weekSummary, standing,
                   contactHow, NOTICE_VERSION, L };
