/* ==================================================================
   SHAPES — Takhti draws them, and the checker reads the answer off
   the drawing

   Three more beat types, drawn as SVG by geoArt():
     figure   one shape: a square (side s), a rectangle (w by h), a
              triangle (sides [a,b,c]) or a circle (with 0–4 fold lines)
     corner   one corner of `deg` degrees — square, smaller or bigger
     figures  2–4 shapes or corners in a row, numbered 1–4

   The point is the same as for sums: nothing reaches a child unless its
   answer can be worked out from what is on the screen. A beat that a
   question is about says WHAT is asked (`ask` on a figure — name, sides,
   corners, perimeter, equal, meet; `find` on figures), geoExpect() works
   the answer out from the drawing itself, and geoAskError() — called by
   validateLesson() for every lesson, built-in or drafted by Gemini —
   rejects a question whose marked answer (in English AND Hindi) isn't
   that, or where the other answer is also right.

   A picture a question is about stays on screen while it is asked (the
   lesson player), its narration never names the answer, and such a
   question never goes into an arcade game, where there is no picture.

   The built-in lessons below (GEO_CONCEPTS) teach sides and corners,
   picking a shape out, square corners, the centre of a circle and
   perimeter; Gemini's school lessons use the same beats
   (core/syllabus.js).
   ================================================================== */
const GEO_TYPES = ['figure', 'corner', 'figures'];
const GEO_KINDS = ['square', 'rectangle', 'triangle', 'circle'];
const GEO_ASKS = ['name', 'sides', 'corners', 'perimeter', 'equal', 'meet'];
const GEO_FINDS = ['square', 'rectangle', 'triangle', 'circle', 'squarecorner', 'odd'];

const geoInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/* Keep only what can be drawn; say why anything else can't. */
function geoItemErrors(it, inRow){
  const e = [];
  if(!it || typeof it !== 'object') return ['a shape is missing'];
  if(it.kind === 'corner'){
    if(!inRow) e.push('a corner is its own beat');
    if(!geoInt(it.deg, 20, 160)) e.push('a corner needs deg between 20 and 160');
    return e;
  }
  if(!GEO_KINDS.includes(it.kind)) return [`Takhti can't draw a "${it.kind}"`];
  if(it.kind === 'square' && !geoInt(it.s, 1, 999)) e.push('a square needs its side s');
  if(it.kind === 'rectangle'){
    if(!geoInt(it.w, 1, 999) || !geoInt(it.h, 1, 999)) e.push('a rectangle needs w and h');
    else if(it.w === it.h) e.push('a rectangle with equal sides is a square — say square');
    else if(Math.max(it.w, it.h) / Math.min(it.w, it.h) > 8) e.push('that rectangle is too thin to draw');
  }
  if(it.kind === 'triangle'){
    const s = it.sides;
    if(!Array.isArray(s) || s.length !== 3 || !s.every(x => geoInt(x, 1, 999))) e.push('a triangle needs 3 side lengths');
    else { const [a, b, c] = s; if(a + b <= c || a + c <= b || b + c <= a) e.push(`sides ${s.join(', ')} can't make a triangle`); }
  }
  if(it.kind === 'circle' && it.folds != null && !geoInt(it.folds, 0, 4)) e.push('a circle has 0 to 4 fold lines');
  return e;
}
function geoErrors(b, maxNumber){
  const e = [];
  if(b.t === 'figure'){
    e.push(...geoItemErrors(b));
    if(b.ask != null && !GEO_ASKS.includes(b.ask)) e.push(`a figure can't ask "${b.ask}"`);
    if(b.ask === 'perimeter' && b.kind === 'circle') e.push("a circle's perimeter isn't asked here");
    if(b.ask === 'equal' && b.kind === 'circle') e.push('a circle has no sides to compare');
    if(b.ask === 'meet' && !(b.kind === 'circle' && b.folds >= 2)) e.push('"where the folds meet" needs a circle with 2 or more folds');
  } else if(b.t === 'corner'){
    if(!geoInt(b.deg, 20, 160)) e.push('a corner needs deg between 20 and 160');
    if(b.ask != null && b.ask !== 'kind') e.push(`a corner can only ask what kind it is`);
  } else if(b.t === 'figures'){
    if(!Array.isArray(b.items) || b.items.length < 2 || b.items.length > 4) e.push('figures needs 2 to 4 shapes');
    else b.items.forEach((it, k) => geoItemErrors(it, true).forEach(x => e.push(`shape ${k + 1}: ${x}`)));
    if(!GEO_FINDS.includes(b.find)) e.push(`figures can't find "${b.find}"`);
    else if(!e.length && geoExpect(b) == null) e.push(b.find === 'odd' ? 'there must be exactly one odd one out' : `exactly one shape must be the ${b.find === 'squarecorner' ? 'square corner' : b.find}`);
  }
  if(maxNumber) for(const n of geoNumbers(b)) if(n > maxNumber) { e.push(`${n} is over the band ceiling of ${maxNumber}`); break; }
  return e;
}
/* Every number a child meets in the picture (and the answer, when it is one). */
function geoNumbers(b){
  const items = b.t === 'figures' ? (b.items || []) : [b];
  const out = [];
  for(const it of items) for(const k of ['s', 'w', 'h']) if(Number.isInteger(it[k])) out.push(it[k]);
  for(const it of items) if(Array.isArray(it.sides)) out.push(...it.sides.filter(Number.isInteger));
  const x = geoExpect(b);
  if(typeof x === 'number') out.push(x);
  return out;
}

/* The answer, worked out from the drawing. null = nothing to ask. */
function geoPerimeter(it){
  if(it.kind === 'square') return 4 * it.s;
  if(it.kind === 'rectangle') return 2 * (it.w + it.h);
  if(it.kind === 'triangle') return it.sides.reduce((a, b) => a + b, 0);
  return null;
}
function geoCornerKind(deg){ return deg === 90 ? 'square' : deg < 90 ? 'smaller' : 'bigger'; }
function geoExpect(b){
  if(!b) return null;
  if(b.t === 'figure'){
    if(geoItemErrors(b).length) return null;
    const n = { square: 4, rectangle: 4, triangle: 3, circle: 0 }[b.kind];
    switch(b.ask){
      case 'name': return b.kind;
      case 'sides': case 'corners': return n;
      case 'perimeter': return geoPerimeter(b);
      case 'equal':
        if(b.kind === 'square') return 'yes';
        if(b.kind === 'rectangle') return 'no';
        if(b.kind === 'triangle') return new Set(b.sides).size === 1 ? 'yes' : 'no';
        return null;
      case 'meet': return b.kind === 'circle' && b.folds >= 2 ? 'centre' : null;
    }
    return null;
  }
  if(b.t === 'corner') return geoInt(b.deg, 20, 160) ? 'corner:' + geoCornerKind(b.deg) : null;
  if(b.t === 'figures'){
    const items = b.items || [];
    if(items.length < 2 || items.some(it => geoItemErrors(it, true).length)) return null;
    const kindOf = it => it.kind === 'corner' ? (it.deg === 90 ? 'squarecorner' : 'corner') : it.kind;
    let hits;
    if(b.find === 'odd'){
      const kinds = items.map(kindOf);
      hits = kinds.map((k, i) => kinds.filter(x => x === k).length === 1 ? i : -1).filter(i => i >= 0);
      if(new Set(kinds).size !== 2) return null;               // one odd one out among the same others
    } else hits = items.map((it, i) => kindOf(it) === b.find ? i : -1).filter(i => i >= 0);
    return hits.length === 1 ? hits[0] + 1 : null;              // the number under the shape
  }
  return null;
}

/* Does this answer (as written, English or Hindi) say the expected thing? */
const GEO_WORDS = {
  square:    [/\bsquares?\b(?!\s*corner)/i, /वर्ग/],
  rectangle: [/rectangles?/i, /आयत/],
  triangle:  [/triangles?/i, /त्रिभुज|तिकोन/],
  circle:    [/circles?/i, /वृत्त|गोला/]
};
function geoSays(opt, want){
  const o = String(opt == null ? '' : opt).trim();
  if(typeof want === 'number') return /^\d+$/.test(o) && Number(o) === want;
  if(GEO_KINDS.includes(want)){
    const hit = k => GEO_WORDS[k].some(r => r.test(o));
    return hit(want) && !GEO_KINDS.filter(k => k !== want).some(hit);
  }
  // \b doesn't work after Devanagari letters, so the end is spelled out
  if(want === 'yes') return /^(yes|हाँ|हां)(?=$|[\s,.!?।])/i.test(o);
  if(want === 'no') return /^(no|नहीं)(?=$|[\s,.!?।])/i.test(o);
  if(want === 'centre') return /cent(re|er)|केंद्र|केन्द्र/i.test(o);
  if(String(want).startsWith('corner:')){
    const small = /small|less|narrow|छोटा|कम/i.test(o), big = /big|more|wide|larg|बड़ा|ज़्यादा|अधिक/i.test(o);
    const sq = /square|right|चौकोर|समकोण/i.test(o);
    const k = small && !big ? 'smaller' : big && !small ? 'bigger' : sq ? 'square' : null;
    return k === want.slice(7);
  }
  return false;
}
/* The question after a picture: its marked answer must be the picture's
   answer in both languages, and the other answer must not be. */
function geoAskError(pic, ask){
  const want = geoExpect(pic);
  if(want == null) return pic.t === 'figure' && pic.ask == null
    ? 'the picture before this question must say what is asked (ask)' : "the picture before this question can't answer it";
  const opts = ask.opts || [], hi = ask.hiOpts || opts;
  if(!geoSays(opts[ask.correct], want)) return `the marked answer "${opts[ask.correct]}" isn't what the picture shows`;
  if(!geoSays(hi[ask.correct], want)) return `the Hindi answer "${hi[ask.correct]}" doesn't say what the picture shows`;
  if(opts.some((o, k) => k !== ask.correct && geoSays(o, want))) return 'both answers are right — one must be a mistake';
  return null;
}

/* What a picture draws, without what it asks — two pictures with the same
   signature look the same on screen. */
function geoSig(b){
  const it = b.t === 'figures' ? { t: b.t, items: b.items } : { t: b.t, kind: b.kind, s: b.s, w: b.w, h: b.h, sides: b.sides, folds: b.folds || 0, deg: b.deg };
  return JSON.stringify(it);
}

/* The picture a question at beat i is about, if it is a shape. */
function geoPicFor(les, i){
  for(let k = i - 1; k >= 0; k--){
    const b = les.beats[k];
    if(b.t === 'ask') continue;
    return GEO_TYPES.includes(b.t) ? b : null;
  }
  return null;
}

/* Sanitise a drafted beat (core/syllabus.js): known fields only, typed. */
function geoClean(x){
  const pickItem = it => {
    const o = { kind: it && it.kind };
    for(const k of ['s', 'w', 'h', 'folds', 'deg']) if(it && it[k] != null) o[k] = it[k];
    if(it && Array.isArray(it.sides)) o.sides = it.sides.slice(0, 3);
    return o;
  };
  let beat;
  if(x.t === 'figure') beat = { t: 'figure', ...pickItem(x), ...(x.ask != null ? { ask: x.ask } : {}) };
  else if(x.t === 'corner') beat = { t: 'corner', deg: x.deg, ...(x.ask != null ? { ask: x.ask } : {}) };
  else beat = { t: 'figures', items: Array.isArray(x.items) ? x.items.slice(0, 4).map(pickItem) : [], find: x.find };
  return { beat, errors: geoErrors(beat) };
}

/* ---------------- drawing ---------------- */
const GEO_STROKE = 'var(--marigold)', GEO_FILL = 'rgba(240,160,42,.16)';
function geoLabel(x, y, t, size){ return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size || 14}" text-anchor="middle" dominant-baseline="middle" fill="currentColor" font-weight="600">${t}</text>`; }
/* one shape inside a box {x,y,w,h}; labels = side lengths, marks = corner dots */
function geoDraw(it, box, opt){
  opt = opt || {};
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2, fs = opt.small ? 11 : 14;
  const poly = pts => `<polygon points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${GEO_FILL}" stroke="${GEO_STROKE}" stroke-width="${opt.small ? 2.5 : 3.5}" stroke-linejoin="round"/>`;
  const dots = pts => opt.marks ? pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="var(--rani)"/>`).join('') : '';
  if(it.kind === 'square' || it.kind === 'rectangle'){
    const w = it.kind === 'square' ? 1 : it.w, h = it.kind === 'square' ? 1 : it.h;
    const k = Math.min(box.w * 0.8 / w, box.h * 0.72 / h);
    const W = Math.max(w * k, 16), H = Math.max(h * k, 16), x0 = cx - W / 2, y0 = cy - H / 2;
    const pts = [[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]];
    const lw = it.kind === 'square' ? it.s : it.w, lh = it.kind === 'square' ? it.s : it.h, g = fs * 0.9;
    const lab = opt.labels ? geoLabel(cx, y0 - g, lw, fs) + geoLabel(cx, y0 + H + g, lw, fs) + geoLabel(x0 - g * 1.3, cy, lh, fs) + geoLabel(x0 + W + g * 1.3, cy, lh, fs) : '';
    return poly(pts) + dots(pts) + lab;
  }
  if(it.kind === 'triangle'){
    const [a, b, c] = it.sides;                                  // AB = a (the base), AC = b, BC = c
    const px = (a * a + b * b - c * c) / (2 * a), py = Math.sqrt(Math.max(0, b * b - px * px));
    const xs = [0, a, px], minX = Math.min(...xs), spanX = Math.max(...xs) - minX || 1;
    const k = Math.min(box.w * 0.78 / spanX, box.h * 0.7 / (py || 1));
    const ox = cx - (spanX * k) / 2 - minX * k, oy = cy + (py * k) / 2;
    const P = [[ox, oy], [ox + a * k, oy], [ox + px * k, oy - py * k]];
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const gx = (P[0][0] + P[1][0] + P[2][0]) / 3, gy = (P[0][1] + P[1][1] + P[2][1]) / 3;
    const out = (m, t) => { const dx = m[0] - gx, dy = m[1] - gy, d = Math.hypot(dx, dy) || 1; return geoLabel(m[0] + dx / d * fs * 1.2, m[1] + dy / d * fs * 1.2, t, fs); };
    const lab = opt.labels ? out(mid(P[0], P[1]), a) + out(mid(P[0], P[2]), b) + out(mid(P[1], P[2]), c) : '';
    return poly(P) + dots(P) + lab;
  }
  if(it.kind === 'circle'){
    const r = Math.min(box.w, box.h) * 0.4;
    const folds = it.folds || 0;
    let lines = '';
    for(let i = 0; i < folds; i++){
      const t = Math.PI * i / folds + Math.PI / 2 * (folds === 1 ? 0 : 0.25);
      lines += `<line x1="${(cx - r * Math.cos(t)).toFixed(1)}" y1="${(cy - r * Math.sin(t)).toFixed(1)}" x2="${(cx + r * Math.cos(t)).toFixed(1)}" y2="${(cy + r * Math.sin(t)).toFixed(1)}" stroke="currentColor" stroke-width="2" stroke-dasharray="6 5" opacity=".75"/>`;
    }
    const centre = opt.marks && folds >= 2 ? `<circle cx="${cx}" cy="${cy}" r="5" fill="var(--rani)"/>` : '';
    return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${GEO_FILL}" stroke="${GEO_STROKE}" stroke-width="${opt.small ? 2.5 : 3.5}"/>` + lines + centre;
  }
  if(it.kind === 'corner'){
    const len = Math.min(box.w * 0.62, box.h * 0.8), vx = cx - len * 0.45, vy = box.y + box.h * 0.85;
    const t = it.deg * Math.PI / 180, ex = vx + len * Math.cos(t), ey = vy - len * Math.sin(t);
    const ar = len * 0.22, ax = vx + ar * Math.cos(t), ay = vy - ar * Math.sin(t);
    const mark = opt.marks && it.deg === 90
      ? `<path d="M${vx + ar * 0.7} ${vy} V${vy - ar * 0.7} H${vx}" fill="none" stroke="var(--rani)" stroke-width="2.5"/>`
      : `<path d="M${vx + ar} ${vy} A${ar} ${ar} 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)}" fill="none" stroke="var(--rani)" stroke-width="2.5"/>`;
    return `<path d="M${(vx + len).toFixed(1)} ${vy} L${vx.toFixed(1)} ${vy} L${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${GEO_STROKE}" stroke-width="${opt.small ? 3 : 4}" stroke-linecap="round" stroke-linejoin="round"/>` + mark;
  }
  return '';
}
/* The beat on screen. `teach` (no question about it) marks corners and the centre. */
function geoArt(b){
  if(!GEO_TYPES.includes(b.t)) return null;
  const teach = b.t === 'figure' ? b.ask == null : b.t === 'corner' ? b.ask == null : false;
  if(b.t === 'figures'){
    const n = (b.items || []).length, cw = 90, W = cw * n;
    const cells = (b.items || []).map((it, k) => geoDraw(it, { x: k * cw + 6, y: 6, w: cw - 12, h: 84 }, { small: true })   // drawn to scale; no side labels in a row — neighbours' labels would collide
      + `<circle cx="${k * cw + cw / 2}" cy="108" r="12" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".6"/>` + geoLabel(k * cw + cw / 2, 109, k + 1, 13)).join('');
    return `<svg class="geo" viewBox="0 0 ${W} 124" width="${Math.min(320, W * 1.15)}" role="img" aria-label="shapes numbered 1 to ${n}">${cells}</svg>`;
  }
  const it = b.t === 'corner' ? { kind: 'corner', deg: b.deg } : b;
  const labels = b.t === 'figure' && it.kind !== 'circle' && !['sides', 'corners'].includes(b.ask);
  const marks = teach && !(b.t === 'figure' && b.kind === 'circle' && !b.folds);
  return `<svg class="geo" viewBox="0 0 240 170" width="240" role="img" aria-label="${b.t === 'corner' ? 'a corner' : 'a ' + it.kind}">${geoDraw(it, { x: 20, y: 14, w: 200, h: 142 }, { labels, marks })}</svg>`;
}

/* ---------------- what Munni says ----------------
   A picture a question is about is never named or measured aloud. */
const GEO_SAY = {
  look:      { en: 'Look at this shape carefully.',                 hi: 'इस आकृति को ध्यान से देखो।' },
  lookFold:  { en: 'Look where the fold lines cross.',              hi: 'देखो, मोड़ की रेखाएँ कहाँ मिलती हैं।' },
  lookCorner:{ en: 'Look at this corner carefully.',                hi: 'इस कोने को ध्यान से देखो।' },
  lookAll:   { en: 'Look at each one. They are numbered.',          hi: 'हर एक को देखो। सब पर नंबर लिखे हैं।' },
  square:    { en: 'A square: 4 sides, all the same length, and 4 square corners.', hi: 'वर्ग: 4 भुजाएँ, सब बराबर, और 4 चौकोर कोने।' },
  rectangle: { en: 'A rectangle: 4 sides and 4 square corners. Opposite sides are equal.', hi: 'आयत: 4 भुजाएँ और 4 चौकोर कोने। आमने-सामने की भुजाएँ बराबर।' },
  triangle:  { en: 'A triangle: 3 sides and 3 corners.',            hi: 'त्रिभुज: 3 भुजाएँ और 3 कोने।' },
  circle:    { en: 'A circle is one curved line. It has no corners.', hi: 'वृत्त एक घुमावदार रेखा है। इसका कोई कोना नहीं।' },
  fold1:     { en: 'Fold it in half. The fold is a straight line right across.', hi: 'आधा मोड़ो। मोड़ एक सीधी रेखा है, आर-पार।' },
  fold2:     { en: 'Fold it again. The folds cross in the very middle: the centre.', hi: 'फिर मोड़ो। मोड़ ठीक बीच में मिलते हैं: इसे केंद्र कहते हैं।' },
  sq:        { en: 'This is a square corner, like the corner of a book.', hi: 'यह चौकोर कोना है, किताब के कोने जैसा।' },
  small:     { en: 'This corner is smaller than a square corner.',  hi: 'यह कोना चौकोर कोने से छोटा है।' },
  big:       { en: 'This corner is bigger than a square corner.',   hi: 'यह कोना चौकोर कोने से बड़ा है।' }
};
function geoSay(b){
  if(!GEO_TYPES.includes(b.t) || b.say) return null;
  const T = o => o[S.lang === 'hi' ? 'hi' : 'en'];
  if(b.t === 'figures') return T(GEO_SAY.lookAll);
  if(b.t === 'corner') return T(b.ask ? GEO_SAY.lookCorner : b.deg === 90 ? GEO_SAY.sq : b.deg < 90 ? GEO_SAY.small : GEO_SAY.big);
  if(b.ask) return T(b.ask === 'meet' ? GEO_SAY.lookFold : GEO_SAY.look);
  if(b.kind === 'circle') return T(b.folds >= 2 ? GEO_SAY.fold2 : b.folds === 1 ? GEO_SAY.fold1 : GEO_SAY.circle);
  return T(GEO_SAY[b.kind]);
}
/* Ask Munni on a shape question: how to look, never the answer. */
const GEO_HINT = {
  count:  { en: 'Put your finger on one corner and go round the shape, counting as you go.', hi: 'एक कोने पर उँगली रखो और आकृति के चारों ओर घूमते हुए गिनो।' },
  name:   { en: 'Count the sides first. Then check: are all the sides the same length?', hi: 'पहले भुजाएँ गिनो। फिर देखो: क्या सारी भुजाएँ बराबर हैं?' },
  perim:  { en: 'Go all the way round. Add every side, one by one, without missing any.', hi: 'पूरा चक्कर लगाओ। हर भुजा जोड़ो, एक-एक करके, कोई छूटे नहीं।' },
  equal:  { en: 'Read the length on every side and compare them.', hi: 'हर भुजा की लंबाई पढ़ो और मिलाओ।' },
  meet:   { en: 'The folds cross in the very middle. What is the middle of a circle called?', hi: 'मोड़ ठीक बीच में मिलते हैं। वृत्त के बीच वाले बिंदु को क्या कहते हैं?' },
  corner: { en: 'Hold the corner of a book against it. Does it fit exactly, or is the corner smaller or bigger?', hi: 'किताब का कोना इस पर रखो। क्या ठीक बैठता है, या कोना छोटा या बड़ा है?' },
  all:    { en: 'Look at each one in turn: count its sides and check its corners.', hi: 'एक-एक करके देखो: भुजाएँ गिनो और कोने जाँचो।' }
};
function geoHint(les, i){
  const p = geoPicFor(les, i);
  if(!p) return null;
  const k = p.t === 'figures' ? 'all' : p.t === 'corner' ? 'corner'
    : ({ sides: 'count', corners: 'count', name: 'name', perimeter: 'perim', equal: 'equal', meet: 'meet' })[p.ask] || 'all';
  return GEO_HINT[k][S.lang === 'hi' ? 'hi' : 'en'];
}

/* ---------------- the built-in lessons ---------------- */
const geoOpts = (right, wrong, flip, hiRight, hiWrong) => {
  const o = [String(right), String(wrong)], h = [String(hiRight != null ? hiRight : right), String(hiWrong != null ? hiWrong : wrong)];
  return flip ? { opts: [o[1], o[0]], hiOpts: [h[1], h[0]], correct: 1 } : { opts: o, hiOpts: h, correct: 0 };
};
const GEO_NAME = { square: ['Square', 'वर्ग'], rectangle: ['Rectangle', 'आयत'], triangle: ['Triangle', 'त्रिभुज'], circle: ['Circle', 'वृत्त'] };
const geoTag = it => it.kind === 'square' ? `sq${it.s}` : it.kind === 'rectangle' ? `re${it.w}x${it.h}` : it.kind === 'triangle' ? `tr${it.sides.join('-')}` : `ci${it.folds || 0}`;

const GEO_CONCEPTS = [

{ id:'sides', band:'early', ic:'🔷', strand:'num', key:(p)=>`sides-${geoTag(p.it)}-${p.ask}`,
  title:(p)=>gq(`Counting ${p.ask}`, p.ask === 'sides' ? 'भुजाएँ गिनो' : 'कोने गिनो'),
  sub:()=>gq('Go round the shape', 'आकृति के चारों ओर'),
  space:()=>[
    { it:{ kind:'square', s:3 }, ask:'sides', teach:{ kind:'triangle', sides:[4,4,4] }, wrong:3, i:0 },
    { it:{ kind:'triangle', sides:[3,4,5] }, ask:'corners', teach:{ kind:'square', s:4 }, wrong:4, i:1 },
    { it:{ kind:'rectangle', w:6, h:3 }, ask:'corners', teach:{ kind:'triangle', sides:[5,5,5] }, wrong:3, i:2 },
    { it:{ kind:'triangle', sides:[5,5,5] }, ask:'sides', teach:{ kind:'rectangle', w:7, h:4 }, wrong:4, i:3 },
    { it:{ kind:'square', s:5 }, ask:'corners', teach:{ kind:'triangle', sides:[3,4,5] }, wrong:3, i:4 },
    { it:{ kind:'circle', folds:0 }, ask:'corners', teach:{ kind:'square', s:2 }, wrong:1, i:5 }
  ],
  beats:(p)=>{
    const n = { square:4, rectangle:4, triangle:3, circle:0 }[p.it.kind];
    return [
      {t:'intro', say:gq('Shapes have sides and corners. Let us count them.', 'आकृतियों की भुजाएँ और कोने होते हैं। आओ गिनें।')},
      {t:'figure', ...p.teach},
      {t:'figure', ...p.it, ask:p.ask},
      {t:'ask', q: p.ask === 'sides' ? gq('How many sides does it have?', 'इसकी कितनी भुजाएँ हैं?') : gq('How many corners does it have?', 'इसके कितने कोने हैं?'),
        ...geoOpts(n, p.wrong, p.i % 2)},
      {t:'win', say:gq('Go round once, and count each one as you pass it.', 'एक बार पूरा घूमो, और हर एक को गिनो।')}
    ];
  }},

{ id:'whichshape', band:'early', ic:'🔺', strand:'num', key:(p)=>`whichshape-${p.find}-${p.i}`,
  title:(p)=>gq(`Find the ${p.find}`, `${GEO_NAME[p.find][1]} ढूँढो`),
  sub:()=>gq('Which one is it?', 'कौन सा है?'),
  space:()=>[
    { find:'rectangle', teach:{ kind:'rectangle', w:8, h:4 }, items:[{ kind:'square', s:4 }, { kind:'rectangle', w:6, h:3 }, { kind:'triangle', sides:[4,4,4] }], wrong:1, i:0 },
    { find:'square', teach:{ kind:'square', s:5 }, items:[{ kind:'rectangle', w:7, h:4 }, { kind:'triangle', sides:[5,5,5] }, { kind:'square', s:3 }], wrong:1, i:1 },
    { find:'triangle', teach:{ kind:'triangle', sides:[3,4,5] }, items:[{ kind:'triangle', sides:[4,4,4] }, { kind:'square', s:4 }, { kind:'circle' }], wrong:3, i:2 },
    { find:'circle', teach:{ kind:'circle' }, items:[{ kind:'square', s:3 }, { kind:'circle' }, { kind:'rectangle', w:6, h:4 }], wrong:1, i:3 }
  ],
  beats:(p)=>{
    const ans = p.items.findIndex(it => it.kind === p.find) + 1;
    return [
      {t:'intro', say:gq(`Today we look for the ${p.find}.`, `आज हम ${GEO_NAME[p.find][1]} ढूँढेंगे।`)},
      {t:'figure', ...p.teach},
      {t:'figures', items:p.items, find:p.find},
      {t:'ask', q:gq(`Which number is the ${p.find}?`, `${GEO_NAME[p.find][1]} किस नंबर पर है?`), ...geoOpts(ans, p.wrong, p.i % 2)},
      {t:'win', say:gq('Count the sides, check the lengths, and you can tell them apart.', 'भुजाएँ गिनो, लंबाई देखो, और पहचान लो।')}
    ];
  }},

{ id:'squarecorner', band:'developing', ic:'📐', strand:'num', key:(p)=>`squarecorner-${p.deg}`,
  title:()=>gq('Square corners', 'चौकोर कोने'),
  sub:()=>gq('Like the corner of a book', 'किताब के कोने जैसे'),
  space:()=>[
    { deg:45, row:[60, 90, 130], i:0 }, { deg:120, row:[90, 45, 150], i:1 }, { deg:100, row:[110, 70, 90], i:2 },
    { deg:60, row:[135, 90, 40], i:3 }, { deg:135, row:[90, 120, 60], i:4 }, { deg:30, row:[50, 140, 90], i:5 }
  ],
  beats:(p)=>{
    const k = geoCornerKind(p.deg);
    const W = { square:['Square corner', 'चौकोर कोना'], smaller:['Smaller corner', 'छोटा कोना'], bigger:['Bigger corner', 'बड़ा कोना'] };
    const wrongK = k === 'square' ? (p.i % 2 ? 'bigger' : 'smaller') : 'square';
    const sqAt = p.row.indexOf(90) + 1, wrongAt = sqAt === 1 ? 2 : 1;
    return [
      {t:'intro', say:gq('Some corners are square, like a book. Some are smaller, some bigger.', 'कुछ कोने किताब जैसे चौकोर होते हैं। कुछ छोटे, कुछ बड़े।')},
      {t:'corner', deg:90},
      {t:'corner', deg:p.deg, ask:'kind'},
      {t:'ask', q:gq('What kind of corner is this?', 'यह कैसा कोना है?'), ...geoOpts(W[k][0], W[wrongK][0], p.i % 2, W[k][1], W[wrongK][1])},
      {t:'figures', items:p.row.map(deg => ({ kind:'corner', deg })), find:'squarecorner'},
      {t:'ask', q:gq('Which number is a square corner?', 'चौकोर कोना किस नंबर पर है?'), ...geoOpts(sqAt, wrongAt, (p.i + 1) % 2)},
      {t:'win', say:gq('A square corner fits the corner of a book exactly.', 'चौकोर कोना किताब के कोने पर ठीक बैठता है।')}
    ];
  }},

{ id:'centre', band:'developing', ic:'⭕', strand:'num', key:()=>'centre-1',
  title:()=>gq('The centre of a circle', 'वृत्त का केंद्र'),
  sub:()=>gq('Fold a round plate', 'गोल प्लेट मोड़ो'),
  space:()=>[{}],
  beats:()=>[
    {t:'figure', kind:'circle', folds:0},
    {t:'figure', kind:'circle', folds:1},
    {t:'figure', kind:'circle', folds:3, ask:'meet'},
    {t:'ask', q:gq('Where the folds meet is the … of the circle?', 'जहाँ मोड़ मिलते हैं, वह वृत्त का … है?'), ...geoOpts('Centre', 'Corner', true, 'केंद्र', 'कोना')},
    {t:'figure', kind:'circle', folds:2, ask:'corners'},
    {t:'ask', q:gq('How many corners does a circle have?', 'वृत्त के कितने कोने होते हैं?'), ...geoOpts(0, 4, false)},
    {t:'win', say:gq('A circle has no corners, and its folds meet at the centre.', 'वृत्त का कोई कोना नहीं, और उसके मोड़ केंद्र पर मिलते हैं।')}
  ]},

{ id:'perim', band:'fluent', ic:'📏', strand:'num', key:(p)=>`perim-${geoTag(p.it)}`,
  title:()=>gq('All the way round', 'पूरा चक्कर'),
  sub:()=>gq('Perimeter: add every side', 'परिमाप: हर भुजा जोड़ो'),
  space:()=>[
    { it:{ kind:'square', s:4 } }, { it:{ kind:'square', s:6 } }, { it:{ kind:'square', s:9 } },
    { it:{ kind:'rectangle', w:6, h:3 } }, { it:{ kind:'rectangle', w:8, h:5 } }, { it:{ kind:'rectangle', w:12, h:7 } }, { it:{ kind:'rectangle', w:15, h:10 } },
    { it:{ kind:'triangle', sides:[3,4,5] } }, { it:{ kind:'triangle', sides:[5,5,5] } }, { it:{ kind:'triangle', sides:[6,8,10] } }
  ].map((x, i) => ({ ...x, i })),
  beats:(p)=>{
    const P = geoPerimeter(p.it);
    // the real mistakes: two sides of a rectangle (w + h), three sides of a square, two of a triangle
    const wrong = p.it.kind === 'rectangle' ? p.it.w + p.it.h : p.it.kind === 'square' ? 3 * p.it.s : p.it.sides[0] + p.it.sides[1];
    return [
      {t:'intro', say:gq('Perimeter is the distance all the way round a shape.', 'परिमाप यानी आकृति के चारों ओर की पूरी दूरी।')},
      {t:'figure', kind:'square', s:2, say:gq('Round this square: 2 + 2 + 2 + 2. That is 8.', 'इस वर्ग के चारों ओर: 2 + 2 + 2 + 2, यानी 8।')},
      {t:'figure', ...p.it, ask:'perimeter'},
      {t:'ask', q:gq('How far is it all the way round?', 'चारों ओर कुल कितनी दूरी है?'), ...geoOpts(P, wrong, p.i % 2)},
      {t:'win', say:gq('Add every side, even the ones that look the same.', 'हर भुजा जोड़ो, जो एक जैसी दिखें वे भी।')}
    ];
  }}
];

/* ---------------- register ---------------- */
if(typeof GEN_BEATS !== 'undefined') for(const t of GEO_TYPES) if(!GEN_BEATS.includes(t)) GEN_BEATS.push(t);
if(typeof CONCEPTS !== 'undefined') CONCEPTS.push(...GEO_CONCEPTS);
const GEO_SKILL_MAP = { sides:['shapes2d'], whichshape:['shapes2d'], squarecorner:['angles'], centre:['shapes2d'], perim:['perimeter'] };
if(typeof SKILLS !== 'undefined'){
  for(const [c, ids] of Object.entries(GEO_SKILL_MAP))
    for(const id of ids){
      const s = SKILLS.find(x => x.id === id);
      if(s && !s.concepts.includes(c)) s.concepts.push(c);
    }
}
