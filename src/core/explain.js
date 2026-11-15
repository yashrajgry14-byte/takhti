/* ==================================================================
   EXPLAIN — one question, step by step (Tier 0)

   "Ask Munni" (ui/ask-munni.js) uses this the moment a stuck child taps:
   Munni explains THIS question, out loud and on screen, at once, with no
   network. If the child is still stuck, Munni calls them in the app
   (Talking Munni, voice/help.js) and walks the same steps, asking each one
   — the voice server loads this file too, so the instant help and the call
   always teach the same way.

   Rules the steps keep:
   · never the final answer — the child still answers the question
     themselves (the last step asks it);
   · the way a teacher in a Hindi-medium class would break it down: make
     ten, tens then ones, borrow a ten, multiply first, count in groups;
   · every line in Hindi and English, kind, never "wrong".

   A step is { tell, ask, ans, vals }: `tell` is what Munni says when
   explaining; `ask` (optional) is the small question she asks on the
   call, with its answer `ans`; `vals` fill both. Numbers stay numbers
   here — the app shows digits, the voice server turns them into words.
   ================================================================== */
const XL = {
  // addition
  fingers:    { en: 'Hold up {a} fingers. Now hold up {b} more.', hi: '{a} उँगलियाँ उठाओ। अब {b} और उठाओ।' },
  countAll:   { en: 'Now count all the fingers that are up.', hi: 'अब सारी उठी हुई उँगलियाँ गिनो।' },
  makeTen:    { en: '{a} needs {k} more to make ten.', hi: '{a} में {k} और जोड़ें तो दस बनता है।' },
  makeTenQ:   { en: 'What is {a} and {k}?', hi: '{a} और {k} कितने होते हैं?' },
  tenLeft:    { en: 'We took {k} from {b}, so {r} is left. Ten and {r}!', hi: '{b} में से {k} लिए, तो {r} बचे। दस और {r}!' },
  split:      { en: '{a} is {at} and {ao}. {b} is {bt} and {bo}.', hi: '{a} मतलब {at} और {ao}। {b} मतलब {bt} और {bo}।' },
  tensAdd:    { en: 'First the tens: {at} and {bt} make {t}.', hi: 'पहले दहाई: {at} और {bt} मिलकर {t}।' },
  tensAddQ:   { en: 'First the tens: what is {at} and {bt}?', hi: 'पहले दहाई जोड़ो: {at} और {bt} कितने?' },
  onesAdd:    { en: 'Then the ones: {ao} and {bo} make {o}.', hi: 'फिर इकाई: {ao} और {bo} मिलकर {o}।' },
  onesAddQ:   { en: 'Now the ones: what is {ao} and {bo}?', hi: 'अब इकाई जोड़ो: {ao} और {bo} कितने?' },
  carry:      { en: '{o} has one more ten in it, so the tens become {t2}, and {o2} ones are left.', hi: '{o} में एक और दहाई है, तो दहाई {t2} हो गई, और इकाई में {o2} बचे।' },
  carryQ:     { en: '{o} has one more ten in it. What is {t} and ten?', hi: '{o} में एक और दहाई है। {t} और दस कितने?' },
  joinUp:     { en: 'Now put {t} and {o} together.', hi: 'अब {t} और {o} को मिलाओ।' },
  joinPlain:  { en: 'Now put the tens and the ones together.', hi: 'अब दहाई और इकाई को मिलाओ।' },
  // subtraction
  foldDown:   { en: 'Hold up {a} fingers. Now fold down {b} of them.', hi: '{a} उँगलियाँ उठाओ। अब उनमें से {b} नीचे करो।' },
  countUp:    { en: 'Count the fingers that are still up.', hi: 'अब गिनो, कितनी उँगलियाँ अभी भी उठी हैं।' },
  countBack:  { en: 'Start at {a} and count back {b} steps.', hi: '{a} से शुरू करो और {b} क़दम पीछे गिनो।' },
  tensSub:    { en: 'First the tens: {at} take away {bt} leaves {t}.', hi: 'पहले दहाई: {at} में से {bt} गए, {t} बचे।' },
  tensSubQ:   { en: 'First the tens: {at} take away {bt}?', hi: 'पहले दहाई: {at} में से {bt} गए, कितने बचे?' },
  onesSub:    { en: 'Then the ones: {ao} take away {bo} leaves {o}.', hi: 'फिर इकाई: {ao} में से {bo} गए, {o} बचे।' },
  onesSubQ:   { en: 'Now the ones: {ao} take away {bo}?', hi: 'अब इकाई: {ao} में से {bo} गए, कितने बचे?' },
  onesSubFirst:  { en: 'First the ones: {ao} take away {bo} leaves {o}.', hi: 'पहले इकाई: {ao} में से {bo} गए, {o} बचे।' },
  onesSubFirstQ: { en: 'First the ones: {ao} take away {bo}?', hi: 'पहले इकाई: {ao} में से {bo} गए, कितने बचे?' },
  tensSubThen:   { en: 'Then the tens: {at} take away {bt} leaves {t}.', hi: 'फिर दहाई: {at} में से {bt} गए, {t} बचे।' },
  tensSubThenQ:  { en: 'Now the tens: {at} take away {bt}?', hi: 'अब दहाई: {at} में से {bt} गए, कितने बचे?' },
  borrow:     { en: 'We can\'t take {bo} from {ao}, so we borrow one ten: {a} becomes {at2} and {ao2}.', hi: '{ao} में से {bo} नहीं घटा सकते, तो एक दहाई उधार लेते हैं: {a} बन गया {at2} और {ao2}।' },
  // multiplication and division
  groups:     { en: '{a} times {b} means {b} groups of {a}. Count in {a}s: {list}…', hi: '{a} गुणा {b} मतलब {a} के {b} समूह। {a}-{a} करके गिनो: {list}…' },
  oneMoreQ:   { en: 'What is {last} and {a} more?', hi: '{last} में {a} और जोड़ो तो कितने?' },
  oneGroup:   { en: 'Times 1 means just one group. Nothing more is added.', hi: '1 से गुणा मतलब बस एक समूह। और कुछ नहीं जुड़ता।' },
  splitMul:   { en: '{a} is {at} and {ao}. Multiply each one by {b}.', hi: '{a} मतलब {at} और {ao}। दोनों को {b} से गुणा करो।' },
  mulPartQ:   { en: 'What is {x} times {b}?', hi: '{x} गुणा {b} कितने?' },
  mulPart:    { en: '{x} times {b} is {p}.', hi: '{x} गुणा {b} बराबर {p}।' },
  addParts:   { en: 'Now add {p} and {q}.', hi: 'अब {p} और {q} जोड़ो।' },
  addPlain:   { en: 'Now add the two parts together.', hi: 'अब दोनों हिस्सों को जोड़ो।' },
  share:      { en: 'Share {a} into {b} equal groups. Think: {b} times what makes {a}?', hi: '{a} को {b} बराबर हिस्सों में बाँटो। सोचो: {b} गुणा कितना करें तो {a} बने?' },
  countIn:    { en: 'Count in {b}s: {list}… and stop at {a}. How many {b}s did you count?', hi: '{b}-{b} करके गिनो: {list}… और {a} पर रुको। कितनी बार {b} गिना?' },
  mulFirst:   { en: 'Multiply first! {b} times {c} is {m}.', hi: 'पहले गुणा करते हैं! {b} गुणा {c} बराबर {m}।' },
  mulFirstQ:  { en: 'Multiply first: what is {b} times {c}?', hi: 'पहले गुणा: {b} गुणा {c} कितने?' },
  thenAdd:    { en: 'Then add {a} to it.', hi: 'फिर उसमें {a} जोड़ो।' },
  // the last step is always the child's own
  finalPlus:  { en: 'So, what is {a} and {b}?', hi: 'तो, {a} और {b} कितने हुए?' },
  finalMinus: { en: 'So, what is {a} take away {b}?', hi: 'तो, {a} में से {b} गए, कितने बचे?' },
  finalTimes: { en: 'So, what is {a} times {b}?', hi: 'तो, {a} गुणा {b} कितने हुए?' },
  finalDiv:   { en: 'So, {a} shared into {b} groups: how many in each?', hi: 'तो, {a} को {b} हिस्सों में बाँटें तो हर हिस्से में कितने?' },
  finalMix:   { en: 'So, what is {a} plus {b} times {c}?', hi: 'तो, {a} जमा {b} गुणा {c} कितने हुए?' },
  // reading
  slowWord:   { en: 'Let\'s read this word slowly: {chunks}. {w}.', hi: 'यह शब्द धीरे-धीरे पढ़ते हैं: {chunks}। {w}।' },
  sayWordQ:   { en: 'Say it after me: {w}.', hi: 'मेरे बाद बोलो: {w}।' },
  wholeLine:  { en: 'Now the whole line: {line}', hi: 'अब पूरी लाइन: {line}' },
  readLineQ:  { en: 'Now you read the whole line.', hi: 'अब तुम पूरी लाइन पढ़ो।' },
  // counting (a lesson beat)
  countEach:  { en: 'Touch each one and count: 1, 2, 3… The last number you say is how many.', hi: 'हर एक को छूकर गिनो: एक, दो, तीन… जो आख़िरी संख्या बोलो, उतने ही हैं।' }
};

const XOP = { '+': '+', '−': '−', '-': '−', '×': '×', 'x': '×', '*': '×', '÷': '÷', '/': '÷' };

/* "38 + 24", "7 × 6 = ?", "4 + 3 × 5" → { a, b, c, op } */
function parseProblem(text){
  const m = /^\s*(\d{1,4})\s*([+−\-×x*÷/])\s*(\d{1,4})(?:\s*×\s*(\d{1,4}))?/.exec(String(text || ''));
  if(!m) return null;
  const p = { a: +m[1], op: XOP[m[2]], b: +m[3], c: m[4] != null ? +m[4] : null };
  if(p.c != null && p.op !== '+') return null;
  return p;
}

const xstep = (tell, vals, ask, ans) => ({ tell, vals: vals || {}, ask: ask || null, ans: ans == null ? null : ans });
const tensOf = n => n - n % 10;

/* A maths question, step by step. Returns null for anything it can't
   explain truthfully (so the caller says so instead of guessing). */
function explainMath(pIn){
  const p = pIn && (pIn.op ? { a: +pIn.a, b: +pIn.b, c: pIn.c != null ? +pIn.c : null, op: XOP[pIn.op] || pIn.op } : parseProblem(pIn.text || pIn));
  if(!p || !Number.isFinite(p.a) || !Number.isFinite(p.b) || p.a < 0 || p.b < 0) return null;
  const { a, b, c, op } = p;
  const steps = [];
  let ans, final;

  if(c != null){                                         // a + b × c: multiply first
    const m = b * c; ans = a + m;
    steps.push(xstep(XL.mulFirst, { b, c, m }, XL.mulFirstQ, m));
    steps.push(xstep(XL.thenAdd, { a }));
    final = { tpl: XL.finalMix, vals: { a, b, c } };
  } else if(op === '+'){
    ans = a + b;
    if(a < 10 && b < 10 && ans <= 10){
      steps.push(xstep(XL.fingers, { a, b }));
      steps.push(xstep(XL.countAll, {}));
    } else if(a < 10 && b < 10){                         // 8 + 5: make ten
      const big = Math.max(a, b), small = Math.min(a, b), k = 10 - big;
      steps.push(xstep(XL.makeTen, { a: big, k }, XL.makeTenQ, 10));
      steps.push(xstep(XL.tenLeft, { b: small, k, r: small - k }));
    } else {                                             // tens and ones
      const at = tensOf(a), ao = a % 10, bt = tensOf(b), bo = b % 10, t = at + bt, o = ao + bo;
      steps.push(xstep(XL.split, { a, at, ao, b, bt, bo }));
      steps.push(xstep(XL.tensAdd, { at, bt, t }, XL.tensAddQ, t));
      steps.push(xstep(XL.onesAdd, { ao, bo, o }, XL.onesAddQ, o));
      if(o >= 10){
        steps.push(xstep(XL.carry, { o, t2: t + 10, o2: o - 10 }, Object.assign({}, XL.carryQ), t + 10));
        steps[steps.length - 1].vals.t = t;
        steps.push(xstep(XL.joinUp, { t: t + 10, o: o - 10 }));
      } else steps.push(xstep(XL.joinUp, { t, o }));
    }
    final = { tpl: XL.finalPlus, vals: { a, b } };
  } else if(op === '−'){
    if(b > a) return null;
    ans = a - b;
    if(a <= 10){
      steps.push(xstep(XL.foldDown, { a, b }));
      steps.push(xstep(XL.countUp, {}));
    } else if(b < 10 && a < 20){
      steps.push(xstep(XL.countBack, { a, b }));
    } else {
      let at = tensOf(a), ao = a % 10;
      const bt = tensOf(b), bo = b % 10;
      if(ao < bo){                                       // borrow a ten
        steps.push(xstep(XL.borrow, { a, ao, bo, at2: at - 10, ao2: ao + 10 }));
        at -= 10; ao += 10;
        steps.push(xstep(XL.onesSubFirst, { ao, bo, o: ao - bo }, XL.onesSubFirstQ, ao - bo));
        steps.push(xstep(XL.tensSubThen, { at, bt, t: at - bt }, XL.tensSubThenQ, at - bt));
      } else {
        steps.push(xstep(XL.split, { a, at, ao, b, bt, bo }));
        steps.push(xstep(XL.tensSub, { at, bt, t: at - bt }, XL.tensSubQ, at - bt));
        steps.push(xstep(XL.onesSub, { ao, bo, o: ao - bo }, XL.onesSubQ, ao - bo));
      }
      steps.push(xstep(XL.joinUp, { t: at - bt, o: ao - bo }));
    }
    final = { tpl: XL.finalMinus, vals: { a, b } };
  } else if(op === '×'){
    ans = a * b;
    if(b === 1 || a === 1){                              // 23 × 1: one group (before splitting, whose "23 is 20 and 3" restates it)
      steps.push(xstep(XL.oneGroup, {}));
    } else if(a >= 10 && b < 10){                        // 23 × 4: split the bigger number
      const at = tensOf(a), ao = a % 10;
      steps.push(xstep(XL.splitMul, { a, at, ao, b }));
      steps.push(xstep(XL.mulPart, { x: at, b, p: at * b }, XL.mulPartQ, at * b));
      steps.push(xstep(XL.mulPart, { x: ao, b, p: ao * b }, XL.mulPartQ, ao * b));
      steps.push(xstep(XL.addParts, { p: at * b, q: ao * b }));
    } else if(a >= 10 && b >= 10){                       // 21 × 13: split the second
      const bt = tensOf(b), bo = b % 10;
      steps.push(xstep(XL.splitMul, { a: b, at: bt, ao: bo, b: a }));
      steps.push(xstep(XL.mulPart, { x: bt, b: a, p: bt * a }, XL.mulPartQ, bt * a));
      steps.push(xstep(XL.mulPart, { x: bo, b: a, p: bo * a }, XL.mulPartQ, bo * a));
      steps.push(xstep(XL.addParts, { p: bt * a, q: bo * a }));
    } else if(a === 0 || b === 0){
      return null;
    } else {                                             // count in groups, ask the last one
      const size = Math.max(a, b), n = Math.min(a, b);
      const list = []; for(let k = 1; k < n; k++) list.push(size * k);
      steps.push(xstep(XL.groups, { a: size, b: n, list: list.join(', ') }));
      steps.push(xstep(XL.oneMoreQ, { last: size * (n - 1), a: size }, XL.oneMoreQ, ans));
      steps[steps.length - 1].tell = { en: 'One more group of {a} to go.', hi: '{a} का एक समूह और बाकी है।' };
    }
    final = { tpl: XL.finalTimes, vals: { a, b } };
  } else if(op === '÷'){
    if(b === 0 || a % b) return null;
    ans = a / b;
    steps.push(xstep(XL.share, { a, b }));
    if(ans <= 10){
      const list = []; for(let k = 1; k <= Math.min(3, ans); k++) list.push(b * k);
      steps.push(xstep(XL.countIn, { a, b, list: list.join(', ') }));
    }
    final = { tpl: XL.finalDiv, vals: { a, b } };
  } else return null;

  // A step can land on the final answer by itself (65 − 25: the tens leave 40, the ones 0;
  // 30 × 4: the ones part is 0). Munni never says it: such a step is told as its question,
  // and a "put them together" line with a zero part names no numbers. The call's reveal (after
  // two tries, voice/help.js) still explains it, so the full line is kept as `why`.
  for(const st of steps){
    const said = Object.keys(st.vals).filter(k => (st.tell.en || '').includes('{' + k + '}'));
    if(!said.some(k => st.vals[k] === ans)) continue;
    if(st.ask){ st.why = st.tell; st.tell = st.ask; }
    else if(st.tell === XL.joinUp) st.tell = XL.joinPlain;
    else if(st.tell === XL.addParts) st.tell = XL.addPlain;
  }

  return { kind: 'math', a, b, c, op, ans, text: c != null ? `${a} + ${b} × ${c}` : `${a} ${op} ${b}`, steps, final };
}

/* Fill a step's text in one language. `num` formats a number (the app
   shows digits; the voice server says words). */
function xfill(tpl, vals, lang, num){
  const f = num || (n => String(n));
  let t = tpl[lang === 'hi' ? 'hi' : 'en'];
  for(const k in vals){
    const v = vals[k];
    t = t.split('{' + k + '}').join(typeof v === 'number' ? f(v) : String(v));
  }
  return t;
}

/* Everything Munni says in the instant help, in order (the last line asks
   the question; the answer is the child's). */
function explainLines(x, lang, num){
  if(!x) return [];
  const lines = x.steps.map(s => xfill(s.tell, s.vals, lang, num));
  if(x.final) lines.push(xfill(x.final.tpl, x.final.vals, lang, num));
  return lines;
}

/* Reading: the word the child stumbled on (or the longest), slowly in
   pieces, then the whole line. */
function wordChunks(word, lang){
  if(lang === 'hi' || /[ऀ-ॿ]/.test(word)){
    const g = typeof graphemes === 'function' ? graphemes(word) : Array.from(word);
    // akshara-sized pieces: a grapheme plus any half-letter joined to the next
    const out = [];
    for(const x of g){ if(out.length && /्$/.test(out[out.length - 1])) out[out.length - 1] += x; else out.push(x); }
    return out;
  }
  const parts = String(word).toLowerCase().match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/g);
  return parts && parts.join('') === String(word).toLowerCase() ? parts : String(word).split('');
}
function explainRead(line, missed, lang){
  const clean = String(line || '').replace(/[.,!?।"“”]/g, ' ').trim();
  if(!clean) return null;
  const words = clean.split(/\s+/);
  const want = (missed || []).map(w => String(w).replace(/[.,!?।]/g, '')).find(w => words.includes(w));
  const w = want || words.slice().sort((x, y) => (typeof graphemes === 'function' ? graphemes(y).length - graphemes(x).length : y.length - x.length))[0];
  const chunks = wordChunks(w, lang);
  return { kind: 'read', line: String(line).trim(), word: w, chunks,
           steps: [xstep(XL.slowWord, { chunks: chunks.join(' - '), w }, XL.sayWordQ, null),
                   xstep(XL.wholeLine, { line: String(line).trim() }, XL.readLineQ, null)] };
}

/* A story-lesson question: the teaching beat before it says what sum it
   is about, so the same step-by-step help works there too. */
function explainLessonBeat(les, i){
  if(!les || !les.beats || !les.beats[i] || les.beats[i].t !== 'ask' || les.beats[i].derived) return null;
  // a "your turn" question carries its own sum (lesYourTurn() in the lesson player)
  const own = les.beats[i].sum;
  if(own && Number.isFinite(own.a) && Number.isFinite(own.b) && /^[+−×÷]$/.test(own.op)) return explainMath({ a: own.a, b: own.b, op: own.op });
  for(let k = i - 1; k >= 0; k--){
    const b = les.beats[k];
    if(typeof picIs === 'function' && picIs(b.t)) return null;   // a picture (a shape, a clock…): Ask Munni gives picHint() instead
    if(b.t === 'add' && Number.isFinite(b.a)) return explainMath({ a: b.a, b: b.b, op: '+' });
    if(b.t === 'take' && Number.isFinite(b.a)) return explainMath({ a: b.a, b: b.b, op: '−' });
    if(b.t === 'count' && Number.isFinite(b.n)) return { kind: 'count', ans: b.n, steps: [xstep(XL.countEach, {})], final: null };
  }
  return null;
}
