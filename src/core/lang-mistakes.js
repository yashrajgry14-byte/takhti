/* ==================================================================
   READING AND WRITING MISTAKES (Tier 0)

   The matcher (core/matcher.js) says which words of a line went wrong.
   This file says HOW — because "भी" read as "बी" (the puff of air left
   out), "दिन" read as "दीन" (a long vowel for a short one), "b" read as
   "d" (a letter turned round) and a word left out are different minds
   needing different help:

   · wordMistake(target, heard): one word, the kind of slip — vowel sign
     length, a vowel sign left out or swapped, the nasal dot, aspiration
     (क/ख), tongue position (ट/त, ण/न), श/ष/स, ब/व, a half letter
     dropped, letters that look alike, guessing from the first letter; in
     English, a letter turned round (b/d), the wrong vowel, the silent e,
     an ending left off.
   · lineMistakes(tokens, extra): the line — the words' slips, a word
     skipped, words added, stopping before the end.
   · inkMistakes(): a traced letter — mirrored, part left out (and where),
     the top line (शिरोरेखा) missing, much too small, off to one side,
     wandering over the lines.
   · langTip(): one line of help for the child, with the letters and words
     in question (Hindi and English); langLetters(): the letters to hear.

   Typed-back paper writing (VIEWS.write's paper mode) goes through the
   same word checks, as spelling. The kinds feed core/twin.js, so a slip a
   child keeps making is noticed, warned about and practised.
   ================================================================== */
const LMISTAKES = {
  vowelLength: { en: 'mixes up short and long vowel signs (ि/ी, ु/ू)',     hi: 'छोटी-बड़ी मात्रा (ि/ी, ु/ू) में गड़बड़ करते हैं' },
  matraDropped:{ en: 'leaves out a vowel sign',                              hi: 'मात्रा छोड़ देते हैं' },
  matraSwap:   { en: 'reads one vowel sign as another',                      hi: 'एक मात्रा की जगह दूसरी पढ़ते हैं' },
  nasal:       { en: 'leaves out the nasal dot (ं/ँ)',                       hi: 'बिंदी/चंद्रबिंदु छोड़ देते हैं' },
  aspiration:  { en: 'mixes up breathy and plain letters (क/ख, द/ध)',        hi: 'हवा वाले और सादे अक्षर (क/ख, द/ध) मिला देते हैं' },
  retroflex:   { en: 'mixes up ट/त, ड/द, ण/न',                               hi: 'ट/त, ड/द, ण/न मिला देते हैं' },
  sibilant:    { en: 'mixes up श, ष and स',                                  hi: 'श, ष और स मिला देते हैं' },
  bv:          { en: 'mixes up ब and व',                                     hi: 'ब और व मिला देते हैं' },
  conjunct:    { en: 'leaves out the half letter of a joined letter',        hi: 'संयुक्त अक्षर का आधा अक्षर छोड़ देते हैं' },
  lookalike:   { en: 'mixes up letters that look alike (घ/ध, भ/म)',          hi: 'एक जैसे दिखने वाले अक्षर (घ/ध, भ/म) मिला देते हैं' },
  guessStart:  { en: 'guesses a word from its first letter',                 hi: 'पहले अक्षर से शब्द का अंदाज़ा लगा लेते हैं' },
  skipped:     { en: 'skips a word',                                         hi: 'कोई शब्द छोड़ देते हैं' },
  added:       { en: "adds words that aren't there",                        hi: 'अपनी तरफ़ से शब्द जोड़ देते हैं' },
  stopped:     { en: 'stops before the end of the line',                     hi: 'पंक्ति पूरी होने से पहले रुक जाते हैं' },
  reversal:    { en: 'turns letters round (b/d, p/q)',                       hi: 'b/d, p/q जैसे अक्षर उल्टे पढ़ते हैं' },
  vowelEn:     { en: 'reads a different vowel (a, e, i, o, u)',              hi: 'अंग्रेज़ी का स्वर (a, e, i, o, u) बदल देते हैं' },
  magicE:      { en: 'misses the silent e that changes the vowel (cap/cape)', hi: 'आख़िरी e (cap/cape) पर ध्यान नहीं देते' },
  ending:      { en: 'leaves off word endings (-s, -ed, -ing)',              hi: 'शब्द का आख़िरी हिस्सा (-s, -ed, -ing) छोड़ देते हैं' },
  mirror:      { en: 'draws the letter mirrored',                            hi: 'अक्षर उल्टा (शीशे जैसा) बनाते हैं' },
  partMissing: { en: 'leaves part of the letter out',                        hi: 'अक्षर का कुछ हिस्सा छोड़ देते हैं' },
  noShirorekha:{ en: 'leaves out the top line (शिरोरेखा)',                   hi: 'ऊपर की लकीर (शिरोरेखा) नहीं खींचते' },
  tooSmall:    { en: 'writes the letter much too small',                     hi: 'अक्षर बहुत छोटा बनाते हैं' },
  offPlace:    { en: 'writes off to one side of the guide',                  hi: 'अक्षर गाइड से हटकर बनाते हैं' },
  wander:      { en: 'goes well outside the lines',                          hi: 'लकीर से काफ़ी बाहर चले जाते हैं' }
};

const LM_PAIRS = {
  aspiration: [['क','ख'],['ग','घ'],['च','छ'],['ज','झ'],['ट','ठ'],['ड','ढ'],['त','थ'],['द','ध'],['प','फ'],['ब','भ']],
  retroflex:  [['ट','त'],['ठ','थ'],['ड','द'],['ढ','ध'],['ण','न']],
  sibilant:   [['श','ष'],['श','स'],['ष','स']],
  bv:         [['ब','व']],
  lookalike:  [['घ','ध'],['भ','म'],['प','ष'],['थ','य'],['ड','ङ'],['ढ','ठ'],['ब','क'],['म','भ']]
};
const LM_BREATHY = 'खघछझठढथधफभ';
const LM_MATRA = /[ा-ौ]/g;
const lmBase = g => (g || '').replace(/[़ा-्ँ-ः]/g, '');
const lmPair = (kind, x, y) => (LM_PAIRS[kind] || []).some(([p, q]) => (p === x && q === y) || (p === y && q === x));

/* The first place two words differ, letter by letter (whole letters). */
function lmDiff(t, h){
  const T = graphemes(t), H = graphemes(h);
  for(let i = 0; i < Math.max(T.length, H.length); i++) if(T[i] !== H[i]) return { i, t: T[i] || '', h: H[i] || '', T, H };
  return null;
}

function wordMistake(target, heard, lang){
  if(heard == null) return null;
  const t = normWord(target, lang), h = normWord(heard, lang);
  if(!t || !h || t === h) return null;
  const d = lmDiff(t, h);
  const mk = (id, extra) => Object.assign({ id, word: target, heard }, d ? { pair: [d.t, d.h] } : {}, extra || {});
  if(lang === 'hi'){
    const noNukta = w => w.normalize('NFD').replace(/़/g, '').normalize('NFC');
    if(noNukta(t) === noNukta(h)) return null;                          // a nukta: the recognizer's, not the child's
    // a half letter dropped: क्य → क, स्क → क
    if(/्/.test(t) && !/्/.test(h)){
      // dropped (क्या → का), or pulled apart with a vowel between (स्कूल → सकूल)
      const forms = [t.replace(/(.)्/g, ''), t.replace(/्(.)/g, ''), t.replace(/्/g, '')];
      if(forms.some(f => f === h || foldWord(f, 'hi') === foldWord(h, 'hi'))){
        const j = t.match(/(.)्(.)/);
        return mk('conjunct', { pair: [j ? j[1] + '्' + j[2] : '', ''] });
      }
    }
    const noNasal = w => w.replace(/[ँं]/g, '');
    if(noNasal(t) === noNasal(h)) return mk('nasal');
    // the vowel checks look past a nasal dot that also went missing (मैं → मे)
    const t2 = noNasal(t), h2 = noNasal(h);
    const shortV = w => w.replace(/ी/g, 'ि').replace(/ू/g, 'ु').replace(/ई/g, 'इ').replace(/ऊ/g, 'उ');
    if(shortV(t2) === shortV(h2)) return mk('vowelLength');
    const noM = w => w.replace(LM_MATRA, '');
    if(noM(t2) === noM(h2)){
      const cm = w => (w.match(LM_MATRA) || []).length;
      return mk(cm(h2) < cm(t2) ? 'matraDropped' : 'matraSwap');
    }
    // one letter's consonant changed, the rest the same
    if(d && graphemes(t).length === graphemes(h).length && d.T.slice(d.i + 1).join('') === d.H.slice(d.i + 1).join('')){
      const x = lmBase(d.t).charAt(0), y = lmBase(d.h).charAt(0);
      for(const kind of ['aspiration', 'retroflex', 'sibilant', 'bv', 'lookalike'])
        if(lmPair(kind, x, y)) return mk(kind, { pair: [x, y] });
    }
  } else {
    if(t.length === h.length){
      const diffs = [...t].map((ch, i) => ch !== h[i] ? i : -1).filter(i => i >= 0);
      if(diffs.length === 1){
        const x = t[diffs[0]], y = h[diffs[0]];
        if(['bd', 'db', 'pq', 'qp'].includes(x + y)) return mk('reversal', { pair: [x, y] });
        if('aeiou'.includes(x) && 'aeiou'.includes(y)) return mk('vowelEn', { pair: [x, y] });
      }
      if(t === [...h].reverse().join('') && t.length >= 3) return mk('reversal', { pair: [t, h] });
    }
    if((t.endsWith('e') && t.slice(0, -1) === h) || (h.endsWith('e') && h.slice(0, -1) === t)) return mk('magicE');
    for(const end of ['ing', 'ed', 'es', 's']) if(t.endsWith(end) && t.slice(0, -end.length) === h) return mk('ending', { pair: [end, ''] });
  }
  // the first letter right and most of the rest not: a guess from the start
  const G = graphemes(t), HG = graphemes(h);
  if(G.length >= 3 && G[0] === HG[0] && levG(t, h) >= Math.ceil(G.length / 2)) return mk('guessStart', { pair: [G[0], ''] });
  return null;
}

/* The kinds of slip in one read (or typed-back) line. */
function lineMistakes(tokens, extra, lang){
  const out = [];
  if(!tokens || !tokens.length) return out;
  let lastRead = -1;
  tokens.forEach((tk, i) => { if(tk.state !== 'miss') lastRead = i; });
  tokens.forEach((tk, i) => {
    if(tk.state === 'miss'){
      if(lastRead >= 0 && i > lastRead){ if(!out.some(m => m.id === 'stopped')) out.push({ id: 'stopped', word: tk.text, rest: tokens.slice(i).map(x => x.text).join(' ') }); }
      else out.push({ id: 'skipped', word: tk.text });
    } else if(tk.state === 'bad' || tk.state === 'near'){
      const m = wordMistake(tk.text, tk.heard, lang);
      if(m) out.push(m);
    }
  });
  if(extra > 0) out.push({ id: 'added' });
  return out;
}

/* A traced letter, from the guide's and the child's pixels (alpha, every
   `step`-th pixel). Kinds, most telling first. */
function inkMistakes(G, C, w, h, lang, step){
  step = step || 4;
  const gp = [], cp = [];
  for(let i = 3, k = 0; i < G.length; i += 4 * step, k += step){
    const x = k % w, y = Math.floor(k / w);
    if(G[i] > 40) gp.push([x, y]);
    if(C[i] > 40) cp.push([x, y]);
  }
  if(!gp.length || !cp.length) return [];
  const box = pts => pts.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), x1: Math.max(b.x1, x), y0: Math.min(b.y0, y), y1: Math.max(b.y1, y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  const gb = box(gp), cb = box(cp);
  const gw = Math.max(1, gb.x1 - gb.x0), gh = Math.max(1, gb.y1 - gb.y0);
  const TOL = Math.max(6, Math.round(Math.min(gw, gh) * 0.07));
  // a coarse grid of the child's ink, so "is there ink near here?" is quick
  const cell = TOL, key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  const grid = new Set(cp.map(([x, y]) => key(x, y)));
  const near = (x, y, set) => { for(let dx = -1; dx <= 1; dx++) for(let dy = -1; dy <= 1; dy++) if(set.has((Math.floor(x / cell) + dx) + ',' + (Math.floor(y / cell) + dy))) return true; return false; };
  const covered = pts => pts.length ? pts.filter(([x, y]) => near(x, y, grid)).length / pts.length : 1;
  const cov = covered(gp);
  const cx = (gb.x0 + gb.x1) / 2;
  const mgrid = new Set(cp.map(([x, y]) => key(2 * cx - x, y)));
  const mcov = gp.filter(([x, y]) => near(x, y, mgrid)).length / gp.length;
  const ggrid = new Set(gp.map(([x, y]) => key(x, y)));
  const precision = cp.filter(([x, y]) => near(x, y, ggrid)).length / cp.length;
  const out = [];
  const area = b => Math.max(1, b.x1 - b.x0) * Math.max(1, b.y1 - b.y0);
  if(mcov > cov + 0.15 && mcov >= 0.5) out.push({ id: 'mirror' });
  // ink that lies ON the guide is a letter left part-done, not a small or
  // misplaced one — only ink mostly off the guide is judged by its size and place
  if(!out.length && precision < 0.6){
    if(area(cb) < 0.3 * area(gb)) out.push({ id: 'tooSmall' });
    const off = Math.hypot((cb.x0 + cb.x1) / 2 - cx, (cb.y0 + cb.y1) / 2 - (gb.y0 + gb.y1) / 2);
    if(off > 0.35 * Math.max(gw, gh)) out.push({ id: 'offPlace' });
  }
  if(!out.length){
    if(lang === 'hi'){
      // the top line: of the guide's columns along its top band, how many
      // have the child's ink in that band too (a stem touching it is not a line)
      const band = gb.y0 + gh * 0.16;
      const top = gp.filter(([, y]) => y <= band);
      const cols = new Set(top.map(([x]) => Math.floor(x / cell)));
      const inkCols = new Set(cp.filter(([, y]) => y <= band + cell / 2).map(([x]) => Math.floor(x / cell)));
      const across = cols.size ? [...cols].filter(x => inkCols.has(x) || inkCols.has(x - 1) || inkCols.has(x + 1)).length / cols.size : 1;
      if(top.length >= gp.length * 0.08 && cols.size >= 4 && across < 0.4 && cov >= 0.3) out.push({ id: 'noShirorekha' });
    }
    const halves = {
      top: gp.filter(([, y]) => y < gb.y0 + gh / 2), bottom: gp.filter(([, y]) => y >= gb.y0 + gh / 2),
      left: gp.filter(([x]) => x < cx), right: gp.filter(([x]) => x >= cx)
    };
    const cv = Object.fromEntries(Object.entries(halves).map(([k, v]) => [k, covered(v)]));
    const worst = Object.entries(cv).sort((x, y) => x[1] - y[1])[0];
    if(!out.length && worst[1] < 0.35 && Object.values(cv).some(v => v > 0.6)) out.push({ id: 'partMissing', where: worst[0] });
    if(precision < 0.5) out.push({ id: 'wander' });
  }
  return out;
}

const LM_WHERE = { top: ['at the top', 'ऊपर'], bottom: ['at the bottom', 'नीचे'], left: ['on the left', 'बाईं ओर'], right: ['on the right', 'दाईं ओर'] };

/* One line of help for the child. `m` is what wordMistake/lineMistakes/
   inkMistakes returned; `g` the traced letter. Warm, never "wrong". */
function langTip(m, lang, g){
  if(!m) return '';
  const hi = lang === 'hi', w = m.word || '', p = m.pair || [];
  const q = s => `"${s}"`;
  switch(m.id){
    case 'vowelLength': return hi ? `${q(w)} में ${p[0]} देखो: ि छोटी मात्रा, ी बड़ी; ु छोटी, ू बड़ी — धीरे से बोलो।` : `In ${q(w)}, look at ${p[0]}: ि and ु are short, ी and ू are long — say it slowly.`;
    case 'matraDropped': return hi ? `${q(w)} में ${p[0]} पर मात्रा है — ${p[0]} बोलो।` : `In ${q(w)}, ${p[0]} has a vowel sign — say ${p[0]}.`;
    case 'matraSwap': return hi ? `${q(w)} में मात्रा ध्यान से देखो: ${p[0]}।` : `Look closely at the vowel sign in ${q(w)}: ${p[0]}.`;
    case 'nasal': return hi ? `${q(w)} में बिंदी है — नाक से भी आवाज़ निकलती है।` : `${q(w)} has the nasal dot — let a little sound come through your nose.`;
    case 'aspiration': { const br = LM_BREATHY.includes(p[0]) ? p[0] : p[1], pl = br === p[0] ? p[1] : p[0];
      return hi ? `${pl} और ${br} अलग हैं: ${br} में हवा निकलती है। हथेली मुँह के आगे रखकर ${br} बोलो — ${q(w)} में ${p[0]} है।`
                : `${pl} and ${br} are different: ${br} has a puff of air. Hold your hand in front of your mouth and say ${br} — ${q(w)} has ${p[0]}.`; }
    case 'retroflex': return hi ? `${q(w)} में ${p[0]} है: ट, ड, ण बोलते समय जीभ ऊपर मुड़ती है; त, द, न में जीभ दाँतों को छूती है।` : `${q(w)} has ${p[0]}: for ट ड ण the tongue curls back; for त द न it touches the teeth.`;
    case 'sibilant': return hi ? `श, ष और स — ${q(w)} में ${p[0]} है, ध्यान से देखो।` : `श, ष and स — ${q(w)} has ${p[0]}; look closely.`;
    case 'bv': return hi ? `${q(w)} में ${p[0]} है: ब होंठ बंद करके, व दाँत और होंठ से।` : `${q(w)} has ${p[0]}: ब with closed lips, व with teeth and lip.`;
    case 'conjunct': return hi ? `${q(w)} में संयुक्त अक्षर ${p[0]} है: आधा अक्षर भी साथ में बोलो।` : `${q(w)} has a joined letter, ${p[0]}: say the half letter too.`;
    case 'lookalike': return hi ? `${p[0]} और ${p[1]} एक जैसे दिखते हैं — ${q(w)} को ध्यान से देखो।` : `${p[0]} and ${p[1]} look alike — look closely at ${q(w)}.`;
    case 'guessStart': return hi ? `${q(w)} ${p[0]} से शुरू होता है — पर हर अक्षर अंत तक पढ़ो।` : `${q(w)} starts with ${p[0]} — read every letter to the end.`;
    case 'skipped': return hi ? `${q(w)} छूट गया — हर शब्द पर उँगली रखकर पढ़ो।` : `${q(w)} got missed — point to each word as you read.`;
    case 'added': return hi ? 'सिर्फ़ लिखे हुए शब्द पढ़ो — उँगली से शब्द-शब्द चलो।' : 'Read just the words on the line — point as you go.';
    case 'stopped': return hi ? `पंक्ति के अंत तक चलो — "${m.rest}" भी पढ़ना है।` : `Keep going to the end — "${m.rest}" is still there.`;
    case 'reversal': return p[0] && p[0].length > 1 ? (hi ? `${q(w)} बाएँ से दाएँ पढ़ो।` : `Read ${q(w)} from left to right.`)
      : ['b', 'd'].includes(p[0]) ? (hi ? `b का पेट दाईं ओर, d का बाईं ओर — ${q(w)} में ${p[0]} है।` : `b has its tummy on the right, d on the left — ${q(w)} has ${p[0]}.`)
      : (hi ? `${p[0]} और ${p[1]} उल्टे जैसे हैं — ${q(w)} में ${p[0]} है।` : `${p[0]} and ${p[1]} are turned round — ${q(w)} has ${p[0]}.`);
    case 'vowelEn': return hi ? `${q(w)} में स्वर ${p[0]} है।` : `In ${q(w)}, the vowel is ${p[0]}.`;
    case 'magicE': return hi ? `${q(w)} के आख़िर का e देखो — वह स्वर की आवाज़ बदल देता है।` : `Look at the end of ${q(w)}: a silent e makes the vowel say its name.`;
    case 'ending': return hi ? `${q(w)} का आख़िरी हिस्सा "${p[0]}" भी पढ़ो।` : `Read the end of ${q(w)} too: "${p[0]}".`;
    case 'mirror': return hi ? `तुम्हारा ${g} उल्टा बना — गाइड वाली तरफ़ से ही शुरू करो।` : `Your ${g} came out the other way round — start from the same side as the guide.`;
    case 'partMissing': { const wh = LM_WHERE[m.where] || LM_WHERE.top; return hi ? `${g} का ${wh[1]} वाला हिस्सा छूट गया — वह भी बनाओ।` : `Part of ${g} ${wh[0]} is missing — trace that part too.`; }
    case 'noShirorekha': return hi ? `${g} के ऊपर लकीर (शिरोरेखा) खींचो — हिंदी के अक्षर उससे लटकते हैं।` : `Draw the line on top of ${g} — Hindi letters hang from it.`;
    case 'tooSmall': return hi ? `${g} को बड़ा बनाओ — पूरा डिब्बा भरो।` : `Make your ${g} bigger — fill the box.`;
    case 'offPlace': return hi ? `${g} को गाइड के ऊपर ही बनाओ, बगल में नहीं।` : `Write ${g} right on the guide, not beside it.`;
    case 'wander': return hi ? 'धीरे-धीरे चलो और लकीर पर ही रहो।' : 'Go slowly and stay on the line.';
  }
  return '';
}

/* The letters (or word parts) worth hearing side by side for a slip. */
function langLetters(m){
  if(!m || !m.pair) return [];
  return m.pair.filter(x => x && x.length <= 4);
}
