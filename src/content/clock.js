/* ==================================================================
   CLOCKS — Takhti draws the clock, and the checker reads the time off
   the drawing

   Two more picture beats (registered with geometry.js's picture registry,
   so they are checked, drawn, narrated and helped with everywhere a shape
   is), drawn as SVG by clockArt():
     clock    one clock face showing h:m — the hour hand between the hours,
              as on a real clock (half past 3: half way from 3 to 4)
     clocks   two faces, the start and the end: how much time passed

   What a question asks is on the picture: a clock's ask:'time' (what time
   is it?), two clocks' ask:'minutes' or 'hours' (how long?). clockExpect()
   works the answer out from the hands; clockAskError() — called by
   validateLesson() for every lesson — rejects a marked answer (English or
   Hindi: "half past 3", "quarter to 4", "3:20", "साढ़े 3 बजे", "पौने 4 बजे",
   "3 बजकर 20 मिनट"…) that isn't that time, or a second answer that also is.

   How finely a child reads a clock depends on the age band (NCERT: o'clock
   and half past in Class 2, quarters and five minutes in Class 3): 5–6
   o'clock only ("half past 10" is also too long an answer for them to
   read), 7–8 every five minutes, 9–10 every minute; no clock for 3–4. A time the band doesn't read yet is rejected with why.

   The built-in lessons below (CLOCK_CONCEPTS) teach o'clock and half past,
   quarter past and quarter to, five-minute times and the time that passes
   between two clocks; Gemini's school lessons use the same beats
   (core/syllabus.js, api/syllabus.mjs).
   ================================================================== */
const CLOCK_TYPES = ['clock', 'clocks'];
const CLOCK_ASKS = { clock: ['time'], clocks: ['minutes', 'hours'] };
/* the minutes a band reads a clock to (null: no clocks yet) */
const CLOCK_STEP = { pre: null, early: 60, developing: 5, fluent: 1 };
const CLOCK_STEP_SAY = { 60: "o'clock only", 5: 'every five minutes', 1: 'any minute' };

const clockInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const clockOk = t => !!t && clockInt(t.h, 1, 12) && clockInt(t.m, 0, 59);
const clockMins = t => (t.h % 12) * 60 + t.m;            // minutes after 12 o'clock
const clockNext = h => h === 12 ? 1 : h + 1;
const clockPrev = h => h === 1 ? 12 : h - 1;
/* minutes from the first clock to the second, going forward (at most 12 hours) */
function clockPassed(b){
  if(!clockOk(b.from) || !clockOk(b.to)) return null;
  const d = clockMins(b.to) - clockMins(b.from);
  return d > 0 ? d : d + 720;
}

/* ---------------- what can be drawn ---------------- */
function clockTimeErrors(t, band, where){
  if(!t || typeof t !== 'object') return [`${where} needs a time (h and m)`];
  const e = [];
  if(!clockInt(t.h, 1, 12)) e.push(`${where}: the hour h is 1 to 12`);
  if(!clockInt(t.m, 0, 59)) e.push(`${where}: the minutes m are 0 to 59`);
  const step = CLOCK_STEP[band.id];
  if(!e.length && step && t.m % step) e.push(`${where}: at ages ${band.ages.join('–')} a clock is read to ${CLOCK_STEP_SAY[step]} — not ${clockWords(t, 'en')}`);
  return e;
}
function clockErrors(b, band){
  band = band || AGE_BANDS.developing;
  if(CLOCK_STEP[band.id] == null) return [`clocks start at ages 5–6, not ${band.ages.join('–')}`];
  const e = [];
  if(b.t === 'clock'){
    e.push(...clockTimeErrors(b, band, 'the clock'));
    if(b.ask != null && !CLOCK_ASKS.clock.includes(b.ask)) e.push(`a clock can only ask what time it is (ask: "time"), not "${b.ask}"`);
  } else if(b.t === 'clocks'){
    e.push(...clockTimeErrors(b.from, band, 'the start clock'), ...clockTimeErrors(b.to, band, 'the end clock'));
    if(b.ask != null && !CLOCK_ASKS.clocks.includes(b.ask)) e.push(`two clocks ask how many minutes or hours passed (ask: "minutes" or "hours"), not "${b.ask}"`);
    if(!e.length){
      const d = clockPassed(b);
      if(clockMins(b.from) === clockMins(b.to)) e.push('the two clocks show the same time — nothing passed');
      else if(b.ask === 'hours' && d % 60) e.push(`${clockWords(b.from, 'en')} to ${clockWords(b.to, 'en')} isn't a whole number of hours — ask how many minutes`);
      else if(b.ask === 'minutes' && d > band.maxNumber) e.push(`${d} minutes is over the band ceiling of ${band.maxNumber} — ask how many hours, or a shorter time`);
    }
  }
  return e;
}

/* ---------------- the answer, worked out from the hands ---------------- */
function clockExpect(b){
  if(!b) return null;
  if(b.t === 'clock') return b.ask === 'time' && clockOk(b) ? `time:${b.h}:${b.m}` : null;
  if(b.t === 'clocks'){
    const d = clockPassed(b);
    if(d == null || clockMins(b.from) === clockMins(b.to)) return null;
    if(b.ask === 'minutes') return d;
    if(b.ask === 'hours') return d % 60 ? null : d / 60;
  }
  return null;
}

/* ---------------- times in words, both languages ---------------- */
const pad2 = n => (n < 10 ? '0' : '') + n;
function clockWords(t, lang){
  const { h, m } = t;
  if(lang === 'hi'){
    if(m === 0) return `${h} बजे`;
    if(m === 30) return h === 1 ? 'डेढ़ बजे' : h === 2 ? 'ढाई बजे' : `साढ़े ${h} बजे`;
    if(m === 15) return `सवा ${h} बजे`;
    if(m === 45) return `पौने ${clockNext(h)} बजे`;
    return `${h} बजकर ${m} मिनट`;
  }
  if(m === 0) return `${h} o'clock`;
  if(m === 30) return `half past ${h}`;
  if(m === 15) return `quarter past ${h}`;
  if(m === 45) return `quarter to ${clockNext(h)}`;
  return `${h}:${pad2(m)}`;
}
function clockDuration(d, lang){
  if(d % 60 === 0){ const n = d / 60; return lang === 'hi' ? `${n} ${n === 1 ? 'घंटा' : 'घंटे'}` : `${n} hour${n === 1 ? '' : 's'}`; }
  return lang === 'hi' ? `${d} मिनट` : `${d} minutes`;
}

/* Every time written in a line, English or Hindi: "3:20", "3 o'clock", "half
   past 3", "quarter to 4", "20 minutes past 3", "साढ़े 3 बजे", "सवा 3", "पौने
   4", "डेढ़", "ढाई", "3 बजकर 20 मिनट", "4 बजने में 10 मिनट", "3 बजे". Each match
   is blanked out before the next pattern, so "साढ़े 3 बजे" is 3:30, not also 3:00. */
const CLOCK_EN_NUM = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const CLOCK_HI_NUM = ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस','ग्यारह','बारह'];
const CLOCK_N = `(\\d{1,2}|${CLOCK_EN_NUM.slice(1).join('|')}|${CLOCK_HI_NUM.slice(1).join('|')}|पांच|छः)`;
function clockNum(s){
  if(/^\d+$/.test(s)) return Number(s);
  if(s === 'पांच') return 5;
  if(s === 'छः') return 6;
  const en = CLOCK_EN_NUM.indexOf(s); if(en > 0) return en;
  const hi = CLOCK_HI_NUM.indexOf(s); return hi > 0 ? hi : NaN;
}
const CLOCK_END = '(?=$|[^\\p{L}\\p{N}\\p{M}])';          // a word ends here (\b doesn't, after Devanagari)
const CLOCK_PATTERNS = [
  [`(\\d{1,2})\\s*[:.]\\s*(\\d{2})(?!\\d)`,                 (a, b) => [a, b]],
  [`quarter\\s+past\\s+${CLOCK_N}${CLOCK_END}`,             a => [a, 15]],
  [`quarter\\s+to\\s+${CLOCK_N}${CLOCK_END}`,               a => [clockPrev(a), 45]],
  [`half\\s+past\\s+${CLOCK_N}${CLOCK_END}`,                a => [a, 30]],
  [`${CLOCK_N}\\s+minutes?\\s+past\\s+${CLOCK_N}${CLOCK_END}`, (a, b) => [b, a]],
  [`${CLOCK_N}\\s+minutes?\\s+to\\s+${CLOCK_N}${CLOCK_END}`,   (a, b) => [clockPrev(b), 60 - a]],
  [`${CLOCK_N}\\s*o['’]?\\s*clock`,                          a => [a, 0]],
  [`डेढ़`,                                                    () => [1, 30]],
  [`ढाई`,                                                     () => [2, 30]],
  [`साढ़े\\s*${CLOCK_N}${CLOCK_END}`,                         a => [a, 30]],
  [`सवा\\s*${CLOCK_N}${CLOCK_END}`,                           a => [a, 15]],
  [`पौने\\s*${CLOCK_N}${CLOCK_END}`,                          a => [clockPrev(a), 45]],
  [`${CLOCK_N}\\s*बजकर\\s*${CLOCK_N}\\s*मिनट`,                 (a, b) => [a, b]],
  [`${CLOCK_N}\\s*बजने\\s*में\\s*${CLOCK_N}\\s*मिनट`,           (a, b) => [clockPrev(a), 60 - b]],
  [`${CLOCK_N}\\s*बजे`,                                      a => [a, 0]]
].map(([re, f]) => [new RegExp(re, 'giu'), f]);
function clockTimesIn(text){
  let s = String(text == null ? '' : text).toLowerCase().replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d));
  const out = [];
  for(const [re, f] of CLOCK_PATTERNS){
    s = s.replace(re, (m0, ...g) => {
      const nums = g.slice(0, f.length).map(x => typeof x === 'string' ? clockNum(x) : x);
      if(nums.some(n => !Number.isFinite(n))) return m0;
      const [h, m] = f(...nums);
      if(clockInt(h, 1, 12) && clockInt(m, 0, 59)) out.push({ h, m });
      return ' '.repeat(m0.length);
    });
  }
  return out;
}
/* One answer, as written: the time it says, or null (none, or two different ones). */
function clockRead(opt){
  const ts = clockTimesIn(opt);
  return ts.length && ts.every(t => t.h === ts[0].h && t.m === ts[0].m) ? ts[0] : null;
}
/* A number of minutes or hours, as an answer: "20", "20 minutes", "20 मिनट", "3 घंटे". */
function clockAmount(opt, unit){
  const o = String(opt == null ? '' : opt).trim().replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d));
  const m = /^(\d+)\s*(minutes?|mins?|मिनट|hours?|hrs?|घंटे|घंटा|घंटों)?$/i.exec(o);
  if(!m) return null;
  if(m[2]){ const saysHours = /^(h|घ)/i.test(m[2]); if(saysHours !== (unit === 'hours')) return null; }   // "20 hours" is not 20 minutes
  return Number(m[1]);
}
function clockSays(opt, want, unit){
  if(typeof want === 'number') return clockAmount(opt, unit) === want;
  if(typeof want === 'string' && want.startsWith('time:')){
    const [, h, m] = want.split(':').map(Number), t = clockRead(opt);
    return !!t && t.h === h && t.m === m;
  }
  return false;
}
function clockAskError(pic, ask){
  const want = clockExpect(pic);
  if(want == null) return pic.ask == null
    ? 'the clock before this question must say what is asked (ask)' : "the clock before this question can't answer it";
  const opts = ask.opts || [], hi = ask.hiOpts || opts, unit = pic.ask;
  if(!clockSays(opts[ask.correct], want, unit)) return `the marked answer "${opts[ask.correct]}" isn't what the clock shows`;
  if(!clockSays(hi[ask.correct], want, unit)) return `the Hindi answer "${hi[ask.correct]}" doesn't say what the clock shows`;
  if(opts.some((o, k) => k !== ask.correct && clockSays(o, want, unit))) return 'both answers are right — one must be a mistake';
  return null;
}
/* Does a line already say this picture's answer? (the giveaway check, core/syllabus.js) */
function clockSaid(text, pic){
  const want = clockExpect(pic);
  if(want == null) return false;
  if(typeof want === 'string'){ const [, h, m] = want.split(':').map(Number); return clockTimesIn(text).some(t => t.h === h && t.m === m); }
  const s = String(text).toLowerCase(), n = want;
  if(pic.ask === 'hours') return new RegExp(`(^|\\D)${n}\\s*(hours?|घंटे|घंटा)`).test(s) || (n <= 12 && new RegExp(`(^|\\s)(${CLOCK_EN_NUM[n]}|${CLOCK_HI_NUM[n]})\\s*(hours?|घंटे|घंटा)`).test(s));
  return new RegExp(`(^|\\D)${n}\\s*(minutes?|mins?|मिनट)`).test(s)
    || (n === 30 && /half an hour|आधा घंटा|आधे घंटे/.test(s)) || (n === 15 && /quarter of an hour|पाव घंटा/.test(s)) || (n === 60 && /\b(an|one) hour\b|एक घंटा/.test(s));
}

/* What a picture draws, without what it asks. */
function clockSig(b){ return JSON.stringify(b.t === 'clock' ? { t: b.t, h: b.h, m: b.m } : { t: b.t, from: b.from, to: b.to }); }

/* Sanitise a drafted beat (core/syllabus.js): known fields only. */
function clockClean(x){
  const tm = t => t && typeof t === 'object' ? { h: t.h, m: t.m } : t;
  const beat = x.t === 'clock'
    ? { t: 'clock', h: x.h, m: x.m, ...(x.ask != null ? { ask: x.ask } : {}) }
    : { t: 'clocks', from: tm(x.from), to: tm(x.to), ...(x.ask != null ? { ask: x.ask } : {}) };
  return { beat, errors: clockErrors(beat, AGE_BANDS.fluent) };   // the band's own limits: validateLesson()
}
/* Before checking (sylTidy): a clock followed by a question but missing what
   it asks gets it from the question's own words, and a time written as a
   note ("3:30") goes into h and m — never over a time that was given. A wrong
   reading fails against the drawing like any other answer. */
function clockTidy(x, next){
  if(typeof x.text === 'string' && x.t === 'clock' && x.h == null && x.m == null){
    const t = clockRead(x.text); if(t){ x.h = t.h; x.m = t.m; }
  }
  delete x.text;
  if(!next || next.t !== 'ask' || x.ask != null) return;
  const q = `${(next.q && next.q.en) || ''} ${(next.q && next.q.hi) || ''}`.toLowerCase();
  if(x.t === 'clock' && /what time|time is it|time does|कितने बजे|क्या समय|समय क्या|कितना समय हुआ/.test(q)) x.ask = 'time';
  if(x.t === 'clocks'){
    if(/minutes?|मिनट/.test(q)) x.ask = 'minutes';
    else if(/hours?|घंटे|घंटा/.test(q)) x.ask = 'hours';
  }
}

/* ---------------- drawing ---------------- */
/* one clock face; the hands are exactly where they are at h:m */
function clockFace(t, cx, cy, r, opt){
  opt = opt || {};
  const at = (deg, len) => { const a = (deg - 90) * Math.PI / 180; return [cx + len * Math.cos(a), cy + len * Math.sin(a)]; };
  const f = v => v.toFixed(1);
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GEO_FILL}" stroke="${GEO_STROKE}" stroke-width="3.5"/>`;
  for(let i = 0; i < 60; i++){
    const big = i % 5 === 0, [x1, y1] = at(i * 6, r * (big ? 0.86 : 0.91)), [x2, y2] = at(i * 6, r * 0.96);
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="currentColor" stroke-width="${big ? 2 : 1}" opacity="${big ? 0.7 : 0.35}"/>`;
  }
  for(let n = 1; n <= 12; n++){
    const [x, y] = at(n * 30, r * 0.72);
    s += `<text x="${f(x)}" y="${f(y)}" font-size="${f(r * 0.19)}" text-anchor="middle" dominant-baseline="central" fill="currentColor" font-weight="600">${n}</text>`;
  }
  // a teaching picture between two clocks shades the minutes that passed
  if(opt.sweep != null && opt.sweep > 0 && opt.sweep < 60){
    const a0 = (t.m - opt.sweep) * 6, [x0, y0] = at(a0, r * 0.62), [x1, y1] = at(t.m * 6, r * 0.62);
    s += `<path d="M${cx} ${cy} L${f(x0)} ${f(y0)} A${f(r * 0.62)} ${f(r * 0.62)} 0 ${opt.sweep > 30 ? 1 : 0} 1 ${f(x1)} ${f(y1)} Z" fill="var(--rani)" opacity=".18"/>`;
  }
  const [hx, hy] = at(((t.h % 12) + t.m / 60) * 30, r * 0.48), [mx, my] = at(t.m * 6, r * 0.8);
  s += `<line x1="${cx}" y1="${cy}" x2="${f(hx)}" y2="${f(hy)}" stroke="currentColor" stroke-width="${f(r * 0.075)}" stroke-linecap="round"/>`;
  s += `<line x1="${cx}" y1="${cy}" x2="${f(mx)}" y2="${f(my)}" stroke="var(--rani)" stroke-width="${f(r * 0.04)}" stroke-linecap="round"/>`;
  return s + `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.06)}" fill="currentColor"/>`;
}
function clockArt(b){
  if(b.t === 'clock'){
    if(!clockOk(b)) return null;
    return `<svg class="geo clock" viewBox="0 0 220 220" width="220" role="img" aria-label="${S.lang === 'hi' ? 'घड़ी' : 'a clock'}">${clockFace(b, 110, 110, 100)}</svg>`;
  }
  if(b.t === 'clocks'){
    if(!clockOk(b.from) || !clockOk(b.to)) return null;
    const hi = S.lang === 'hi', d = clockPassed(b);
    const lab = (x, t) => `<text x="${x}" y="222" font-size="17" text-anchor="middle" fill="currentColor" opacity=".8">${t}</text>`;
    return `<svg class="geo clock" viewBox="0 0 420 232" width="320" role="img" aria-label="${hi ? 'दो घड़ियाँ: शुरू और अंत' : 'two clocks: start and end'}">`
      + clockFace(b.from, 100, 100, 92) + clockFace(b.to, 320, 100, 92, { sweep: b.ask == null ? d : null })
      + `<path d="M196 100 H224 M214 90 L226 100 L214 110" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`
      + lab(100, hi ? 'शुरू' : 'start') + lab(320, hi ? 'अंत' : 'end') + `</svg>`;
  }
  return null;
}

/* ---------------- what Munni says ----------------
   A clock a question is about is never read aloud. */
const CLOCK_SAY = {
  look:   { en: 'Look at both hands: the short one, then the long one.', hi: 'दोनों सुइयाँ देखो: पहले छोटी, फिर बड़ी।' },
  looks:  { en: 'Look at the start clock, then the end clock. Watch the long hand.', hi: 'पहले शुरू वाली घड़ी देखो, फिर अंत वाली। बड़ी सुई पर ध्यान दो।' },
  looksH: { en: 'Look at the start clock, then the end clock. Watch the short hand.', hi: 'पहले शुरू वाली घड़ी देखो, फिर अंत वाली। छोटी सुई पर ध्यान दो।' }
};
function clockSayBoth(b){
  if(b.t === 'clock'){
    if(b.ask) return CLOCK_SAY.look;
    if(!clockOk(b)) return null;
    const w = clockWords(b, 'hi');
    return { en: `The short hand shows the hour, the long hand the minutes. It is ${clockWords(b, 'en')}.`,
             hi: `छोटी सुई घंटा बताती है, बड़ी सुई मिनट। अभी ${w} ${/बजे$/.test(w) ? 'हैं' : 'हुए हैं'}।` };
  }
  if(b.t === 'clocks'){
    if(b.ask) return b.ask === 'hours' ? CLOCK_SAY.looksH : CLOCK_SAY.looks;
    if(!clockOk(b.from) || !clockOk(b.to)) return null;
    const d = clockPassed(b);
    return { en: `It starts at ${clockWords(b.from, 'en')} and ends at ${clockWords(b.to, 'en')}. That is ${clockDuration(d, 'en')}.`,
             hi: `${clockWords(b.from, 'hi')} शुरू, ${clockWords(b.to, 'hi')} खत्म। यानी ${clockDuration(d, 'hi')}।` };
  }
  return null;
}
function clockSay(b){
  if(!CLOCK_TYPES.includes(b.t) || b.say) return null;
  const o = clockSayBoth(b);
  return o ? o[S.lang === 'hi' ? 'hi' : 'en'] : null;
}
/* Ask Munni on a clock question: how to read it, never the answer. */
const CLOCK_HINT = {
  time:    { en: 'First the short hand: which number has it just passed? That is the hour. Then the long hand: count in fives from the 12.', hi: 'पहले छोटी सुई: वह अभी-अभी कौन सा अंक पार कर चुकी है? वही घंटा है। फिर बड़ी सुई: 12 से पाँच-पाँच गिनो।' },
  minutes: { en: 'Find where the long hand starts and where it stops. Count the jumps of five minutes in between; a whole turn of the long hand is one hour.', hi: 'देखो बड़ी सुई कहाँ से चली और कहाँ रुकी। बीच में पाँच-पाँच मिनट की छलाँगें गिनो; बड़ी सुई का पूरा चक्कर एक घंटा है।' },
  hours:   { en: 'Look at the short hand: count the numbers it moved on, one for each hour.', hi: 'छोटी सुई देखो: वह जितने अंक आगे बढ़ी, हर अंक एक घंटा।' }
};
function clockHint(les, i){
  const p = picFor(les, i);
  if(!p || !CLOCK_TYPES.includes(p.t)) return null;
  const h = CLOCK_HINT[p.t === 'clock' ? 'time' : p.ask === 'hours' ? 'hours' : 'minutes'];
  return h[S.lang === 'hi' ? 'hi' : 'en'];
}
/* What the teacher should know (sylLessonWarnings, not a rejection). */
function clockWarnings(beats){
  const asked = beats.filter((b, i) => b && b.t === 'clock' && b.ask === 'time' && beats[i + 1] && beats[i + 1].t === 'ask' && clockOk(b));
  return asked.length && asked.every(b => b.m === 0)
    ? [{ en: 'Every clock question shows a time on the hour — a child who reads only the short hand passes. A half past or quarter past would test the long hand.',
         hi: 'घड़ी का हर प्रश्न पूरे घंटे का समय दिखाता है — केवल छोटी सुई पढ़ने वाला बच्चा पास हो जाएगा। साढ़े या सवा से बड़ी सुई की जाँच होगी।' }]
    : [];
}

/* ---------------- the built-in lessons ---------------- */
const clockOpts = (right, wrong, flip) => {
  const o = [clockWords(right, 'en'), clockWords(wrong, 'en')], h = [clockWords(right, 'hi'), clockWords(wrong, 'hi')];
  return flip ? { opts: [o[1], o[0]], hiOpts: [h[1], h[0]], correct: 1 } : { opts: o, hiOpts: h, correct: 0 };
};
const clockTag = t => `${t.h}${pad2(t.m)}`;
const WHAT_TIME = () => gq('What time is it?', 'कितने बजे हैं?');

const CLOCK_CONCEPTS = [

/* o'clock (5–6), one lesson per hour — moved here from literacy.js, whose
   clock drew the minute hand at 12 whatever the time and said the hour aloud
   just before asking it. The same ids (clock-1 … clock-12), now with a
   teaching clock first and the answer read off the hands. The mistake: the
   long hand read as the hour ("12 o'clock"); at 12 itself, the next hour. */
{ id:'clockhour', key:(p)=>'clock-' + p.h, band:'early', ic:'🕐', strand:'num',
  title:(p)=>gq(`${p.h} o'clock`, `${p.h} बजे`),
  sub:()=>gq('Reading the short hand', 'छोटी सुई पढ़ना'),
  space:()=>[1,2,3,4,5,6,7,8,9,10,11,12].map(h=>({ h, teach: h === 3 ? 9 : 3 })),
  beats:(p)=>[
    {t:'intro', say:gq('A clock has two hands. The short hand tells the hour.', 'घड़ी में दो सुइयाँ होती हैं। छोटी सुई घंटा बताती है।')},
    {t:'clock', h:p.teach, m:0},
    {t:'clock', h:p.h, m:0, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts({ h:p.h, m:0 }, { h: p.h === 12 ? 1 : 12, m:0 }, p.h % 2)},
    {t:'win', say:gq('The short hand tells the hour. The long hand at the 12 means o\'clock.', 'छोटी सुई घंटा बताती है। बड़ी सुई 12 पर हो तो पूरे बजे।')}
  ]},

/* o'clock and half past (7–8): the mistakes — reading the long hand as the
   hour (7 o'clock read as 12 o'clock), and at half past naming the number the
   short hand is heading for (half past 9 read as half past 10) */
{ id:'clockhalf', band:'developing', ic:'🕒', strand:'num', key:(p)=>`clockhalf-${clockTag(p.q1)}-${clockTag(p.q2)}`,
  title:()=>gq("O'clock and half past", 'बजे और साढ़े'),
  sub:()=>gq('The short hand tells the hour', 'छोटी सुई घंटा बताती है'),
  space:()=>[
    { t1:{ h:3, m:0 }, q1:{ h:7, m:0 }, t2:{ h:4, m:30 }, q2:{ h:9, m:30 }, i:0 },
    { t1:{ h:5, m:0 }, q1:{ h:2, m:0 }, t2:{ h:6, m:30 }, q2:{ h:3, m:30 }, i:1 },
    { t1:{ h:10, m:0 }, q1:{ h:4, m:0 }, t2:{ h:1, m:30 }, q2:{ h:7, m:30 }, i:2 },
    { t1:{ h:8, m:0 }, q1:{ h:11, m:0 }, t2:{ h:2, m:30 }, q2:{ h:5, m:30 }, i:3 }
  ],
  beats:(p)=>[
    {t:'intro', say:gq('A clock has two hands. The short hand tells the hour.', 'घड़ी में दो सुइयाँ होती हैं। छोटी सुई घंटा बताती है।')},
    {t:'clock', ...p.t1},
    {t:'clock', ...p.q1, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts(p.q1, { h:12, m:0 }, p.i % 2)},
    {t:'clock', ...p.t2},
    {t:'clock', ...p.q2, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts(p.q2, { h:clockNext(p.q2.h), m:30 }, (p.i + 1) % 2)},
    {t:'win', say:gq('Short hand first for the hour. Then the long hand: at the 6, it is half past.', 'पहले छोटी सुई से घंटा। फिर बड़ी सुई: 6 पर हो तो साढ़े।')}
  ]},

/* quarter past and quarter to (7–8): the mistakes — mixing up past and to,
   and at quarter to naming the hour the short hand has just passed */
{ id:'clockquarter', band:'developing', ic:'🕞', strand:'num', key:(p)=>`clockquarter-${clockTag(p.q1)}-${clockTag(p.q2)}`,
  title:()=>gq('Quarter past and quarter to', 'सवा और पौने'),
  sub:()=>gq('A quarter of the way round', 'चौथाई चक्कर'),
  space:()=>[
    { t1:{ h:2, m:15 }, q1:{ h:6, m:15 }, t2:{ h:4, m:45 }, q2:{ h:8, m:45 }, i:0 },
    { t1:{ h:9, m:15 }, q1:{ h:3, m:15 }, t2:{ h:11, m:45 }, q2:{ h:5, m:45 }, i:1 },
    { t1:{ h:5, m:15 }, q1:{ h:10, m:15 }, t2:{ h:1, m:45 }, q2:{ h:6, m:45 }, i:2 },
    { t1:{ h:7, m:15 }, q1:{ h:1, m:15 }, t2:{ h:3, m:45 }, q2:{ h:9, m:45 }, i:3 }
  ],
  beats:(p)=>[
    {t:'intro', say:gq('When the long hand goes a quarter of the way round, we say quarter.', 'जब बड़ी सुई चौथाई चक्कर घूमती है, तो हम सवा या पौने कहते हैं।')},
    {t:'clock', ...p.t1},
    {t:'clock', ...p.q1, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts(p.q1, { h:clockPrev(p.q1.h), m:45 }, p.i % 2)},   // quarter past 6 → "quarter to 6"
    {t:'clock', ...p.t2},
    {t:'clock', ...p.q2, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts(p.q2, { h:clockPrev(p.q2.h), m:45 }, (p.i + 1) % 2)},
    {t:'win', say:gq('Long hand at the 3: quarter past. At the 9: quarter to the next hour.', 'बड़ी सुई 3 पर: सवा। 9 पर: अगले घंटे से पौने।')}
  ]},

/* five-minute times (7–8): the mistake — reading the number the long hand
   points at as the minutes (3:20 read as 3:04) */
{ id:'clockfive', band:'developing', ic:'🕓', strand:'num', key:(p)=>`clockfive-${clockTag(p.q1)}-${clockTag(p.q2)}`,
  title:()=>gq('Counting minutes in fives', 'पाँच-पाँच मिनट गिनो'),
  sub:()=>gq('Every number is five minutes', 'हर अंक पाँच मिनट'),
  space:()=>[
    { q1:{ h:7, m:40 }, q2:{ h:10, m:25 }, i:0 },
    { q1:{ h:2, m:50 }, q2:{ h:6, m:10 }, i:1 },
    { q1:{ h:11, m:35 }, q2:{ h:4, m:55 }, i:2 },
    { q1:{ h:8, m:20 }, q2:{ h:1, m:40 }, i:3 }
  ],
  beats:(p)=>[
    {t:'intro', say:gq('From one number to the next, the long hand takes five minutes.', 'एक अंक से अगले अंक तक बड़ी सुई को पाँच मिनट लगते हैं।')},
    {t:'clock', h:3, m:20, say:gq('The long hand is at the 4. Count in fives: 5, 10, 15, 20. It is 3:20.', 'बड़ी सुई 4 पर है। पाँच-पाँच गिनो: 5, 10, 15, 20। अभी 3 बजकर 20 मिनट हुए हैं।')},
    {t:'clock', ...p.q1, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts(p.q1, { h:p.q1.h, m:p.q1.m / 5 }, p.i % 2)},
    {t:'clock', ...p.q2, ask:'time'},
    {t:'ask', q:WHAT_TIME(), ...clockOpts(p.q2, { h:p.q2.h, m:p.q2.m / 5 }, (p.i + 1) % 2)},
    {t:'win', say:gq('Count the long hand in fives from the 12.', 'बड़ी सुई को 12 से पाँच-पाँच करके गिनो।')}
  ]},

/* time that passes (7–8): the mistakes — counting the numbers the long hand
   moved past instead of five minutes for each (20 minutes read as 4), and
   giving the end time as the hours that passed */
{ id:'timepassed', band:'developing', ic:'⏳', strand:'num', key:(p)=>`timepassed-${clockTag(p.a)}-${clockTag(p.b)}`,
  title:()=>gq('How long did it take?', 'कितना समय लगा?'),
  sub:()=>gq('From the start clock to the end clock', 'शुरू की घड़ी से अंत की घड़ी तक'),
  space:()=>[
    { teach:{ from:{ h:2, m:0 }, to:{ h:2, m:30 } }, a:{ h:5, m:0 }, b:{ h:5, m:20 }, hf:{ h:3, m:0 }, ht:{ h:6, m:0 }, i:0 },
    { teach:{ from:{ h:4, m:0 }, to:{ h:4, m:15 } }, a:{ h:7, m:15 }, b:{ h:7, m:45 }, hf:{ h:8, m:0 }, ht:{ h:10, m:0 }, i:1 },
    { teach:{ from:{ h:9, m:0 }, to:{ h:9, m:20 } }, a:{ h:1, m:30 }, b:{ h:2, m:15 }, hf:{ h:2, m:0 }, ht:{ h:5, m:0 }, i:2 },
    { teach:{ from:{ h:11, m:0 }, to:{ h:11, m:45 } }, a:{ h:6, m:10 }, b:{ h:6, m:35 }, hf:{ h:7, m:0 }, ht:{ h:11, m:0 }, i:3 }
  ],
  beats:(p)=>{
    const d = clockMins(p.b) - clockMins(p.a), hrs = (clockMins(p.ht) - clockMins(p.hf)) / 60;
    const num = (r, w, flip) => { const o = [String(r), String(w)]; return flip ? { opts:[o[1], o[0]], hiOpts:[o[1], o[0]], correct:1 } : { opts:o, hiOpts:o, correct:0 }; };
    return [
      {t:'intro', say:gq('The long hand goes all the way round in one hour. The short hand moves one number.', 'बड़ी सुई एक घंटे में पूरा चक्कर लगाती है। छोटी सुई एक अंक आगे बढ़ती है।')},
      {t:'clocks', ...p.teach},
      {t:'clocks', from:p.a, to:p.b, ask:'minutes'},
      {t:'ask', q:gq('How many minutes passed?', 'कितने मिनट बीते?'), ...num(d, d / 5, p.i % 2)},
      {t:'clocks', from:p.hf, to:p.ht, ask:'hours'},
      {t:'ask', q:gq('How many hours passed?', 'कितने घंटे बीते?'), ...num(hrs, p.ht.h, (p.i + 1) % 2)},
      {t:'win', say:gq('Count from the start to the end: five minutes for each number the long hand passes.', 'शुरू से अंत तक गिनो: बड़ी सुई जितने अंक पार करे, हर अंक पाँच मिनट।')}
    ];
  }}
];

/* ---------------- register ---------------- */
picRegister(CLOCK_TYPES, {
  name: 'clock', expect: clockExpect, errors: clockErrors, askError: clockAskError, sig: clockSig,
  asks: b => b.ask != null, again: 'ask about a different time',
  art: clockArt, sayBoth: clockSayBoth, say: clockSay, hint: clockHint, clean: clockClean,
  said: clockSaid, tidy: clockTidy, warnings: clockWarnings,
  aimKeys: b => b.ask ? [b.t === 'clock' ? 'time' : 'passed'] : [],
  aimNeed: t => /how long|time taken|took|minutes? (have )?pass|time (that )?pass|elapsed|between two|hours? (have )?pass/.test(t) ? ['passed']
    : /\b(read|tell|show|say)\b[^.]*\btime\b|what time|o'?clock|half past|quarter (past|to)|\bclock\b/.test(t) ? ['time'] : null
});
if(typeof GEN_BEATS !== 'undefined') for(const t of CLOCK_TYPES) if(!GEN_BEATS.includes(t)) GEN_BEATS.push(t);
if(typeof CONCEPTS !== 'undefined') CONCEPTS.push(...CLOCK_CONCEPTS);
const CLOCK_SKILL_MAP = { clockhour:['time2'], clockhalf:['time2'], clockquarter:['time3'], clockfive:['time3'], timepassed:['time3'] };
if(typeof SKILLS !== 'undefined'){
  for(const [c, ids] of Object.entries(CLOCK_SKILL_MAP))
    for(const id of ids){
      const s = SKILLS.find(x => x.id === id);
      if(s && !s.concepts.includes(c)) s.concepts.push(c);
    }
}
