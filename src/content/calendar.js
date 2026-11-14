/* ==================================================================
   CALENDARS — Takhti draws the months and the month's page, and the
   checker reads the answer off the drawing

   Two more picture beats (registered with geometry.js's picture registry,
   so they are checked, drawn, narrated and helped with everywhere a shape
   is), drawn as SVG by calArt():
     months    the twelve months in order, two rows of six, each with its
               number — optionally a date as a birth certificate prints it
               (02/05/2015) above them
     calendar  one month's page: a column for each day of the week, the
               dates in their rows

   What a question asks is on the picture:
     months    ask 'name'   which month is number m (or the month of the
                            printed date — the strip shows the numbers)
               ask 'number' what number month m is (the numbers are hidden)
               ask 'after' / 'before'  the month next to the marked one
               ask 'later'  the month k months after the marked one ("sown
                            in June, ready 3 months later") — the question
                            itself must say k
               ask 'count'  how many months from the first marked month to
                            the second
     calendar  ask 'weekday' what day of the week the marked date is
               ask 'count'   how many dates are in the marked day's column
                             ("how many Sundays?")
               ask 'later'   the date k days after the marked one — the
                             question must say k ("a week later" is 7)
   calExpect() works the answer out from the drawing; calAskError() —
   called by validateLesson() for every lesson — rejects a marked answer
   (English or Hindi: May / मई, Sunday / रविवार, a number) that isn't it,
   or a second answer that also is.

   The age band: months are numbered to 12, so not for 3–4 (their ceiling
   is 10); a month's dates go to 31, so the page is for 7–8 and up (5–6's
   ceiling is 20). A printed date's year is a label on the certificate, not
   a number the child works with — it is never an answer, and a date whose
   day or month the band can't read is rejected.

   The built-in lessons below (CAL_CONCEPTS) teach the order of the
   months, months later and between, the month in a date, the day of a
   date and a week later; Gemini's school lessons use the same beats
   (core/syllabus.js, api/syllabus.mjs).
   ================================================================== */
const CAL_TYPES = ['months', 'calendar'];
const CAL_ASKS = { months: ['name', 'number', 'after', 'before', 'later', 'count'], calendar: ['weekday', 'count', 'later'] };
const CAL_MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  hi: ['जनवरी','फ़रवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर']
};
/* every way a month is written, for reading an answer */
const CAL_MONTH_FORMS = [
  ['january','jan','जनवरी'], ['february','feb','फ़रवरी','फरवरी'], ['march','mar','मार्च'], ['april','apr','अप्रैल','अप्रेल'],
  ['may','मई'], ['june','jun','जून'], ['july','jul','जुलाई'], ['august','aug','अगस्त'],
  ['september','sep','sept','सितंबर','सितम्बर'], ['october','oct','अक्टूबर','अक्तूबर'], ['november','nov','नवंबर','नवम्बर'], ['december','dec','दिसंबर','दिसम्बर']
];
const CAL_DAYS = {
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  hi: ['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार']
};
const CAL_DAY_SHORT = { en: ['S','M','T','W','T','F','S'], hi: ['र','सो','मं','बु','गु','शु','श'] };
const CAL_DAY_FORMS = [
  ['sunday','sun','रविवार','इतवार'], ['monday','mon','सोमवार'], ['tuesday','tue','tues','मंगलवार'], ['wednesday','wed','बुधवार'],
  ['thursday','thu','thur','thurs','गुरुवार','बृहस्पतिवार','वीरवार'], ['friday','fri','शुक्रवार'], ['saturday','sat','शनिवार']
];

const calInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const calMonthAt = n => ((n - 1) % 12 + 12) % 12 + 1;                 // 13 → 1, 0 → 12
/* a printed date "DD/MM/YYYY" → { d, m, y }, or null */
function calDate(s){
  const x = /^\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})\s*$/.exec(String(s == null ? '' : s));
  if(!x) return null;
  const d = Number(x[1]), m = Number(x[2]), y = Number(x[3]);
  const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return calInt(m, 1, 12) && calInt(d, 1, dim[m - 1]) && calInt(y, 1900, 2100) ? { d, m, y } : null;
}

/* ---------------- what can be drawn ---------------- */
function calErrors(b, band){
  band = band || AGE_BANDS.developing;
  const e = [];
  if(b.t === 'months'){
    if(band.maxNumber < 12) return [`the months are numbered to 12, over the band ceiling of ${band.maxNumber}`];
    if(b.ask != null && !CAL_ASKS.months.includes(b.ask)) e.push(`the months can ask name, number, after, before, later or count — not "${b.ask}"`);
    if(b.m != null && !calInt(b.m, 1, 12)) e.push('m is a month, 1 to 12');
    if(b.date != null){
      const dt = calDate(b.date);
      if(!dt) e.push(`"${b.date}" isn't a date written as day/month/year`);
      else if(b.m != null && b.m !== dt.m) e.push(`the date's month is ${dt.m}, not ${b.m}`);
      else if(dt.d > band.maxNumber) e.push(`the date's day ${dt.d} is over the band ceiling of ${band.maxNumber}`);
    }
    if(b.ask && !(b.ask === 'name' && b.date) && !calInt(b.m, 1, 12)) e.push(`a "${b.ask}" question needs the month m it is about`);
    if(b.ask === 'later' && !calInt(b.k, 1, 11)) e.push('"later" needs k, 1 to 11 months');
    if(b.ask === 'count'){
      if(!calInt(b.m2, 1, 12)) e.push('"count" needs the second month m2');
      else if(b.m2 === b.m) e.push('the two months are the same — nothing to count');
    }
  } else if(b.t === 'calendar'){
    if(band.maxNumber < 31) return [`a month's dates go to 31, over the band ceiling of ${band.maxNumber}`];
    if(!calInt(b.days, 28, 31)) e.push('a month has 28 to 31 days (days)');
    if(!calInt(b.start, 0, 6)) e.push('start is the day of the 1st: 0 (Sunday) to 6 (Saturday)');
    if(b.month != null && !calInt(b.month, 1, 12)) e.push('month is 1 to 12');
    if(b.ask != null && !CAL_ASKS.calendar.includes(b.ask)) e.push(`a calendar can ask weekday, count or later — not "${b.ask}"`);
    if(!e.length){
      if((b.ask === 'weekday' || b.ask === 'later') && !calInt(b.d, 1, b.days)) e.push(`the marked date d is 1 to ${b.days}`);
      if(b.ask === 'count' && !calInt(b.w, 0, 6)) e.push('"count" needs the day w (0 Sunday … 6 Saturday) whose dates are counted');
      if(b.ask === 'later'){
        if(!calInt(b.k, 1, 27)) e.push('"later" needs k, the days later (1 to 27)');
        else if(b.d + b.k > b.days) e.push(`${b.d} + ${b.k} days is past the end of the month (${b.days})`);
      }
      if(b.ask == null && b.d != null && !calInt(b.d, 1, b.days)) e.push(`the marked date d is 1 to ${b.days}`);
    }
  }
  return e;
}

/* ---------------- the answer, from the drawing ---------------- */
function calExpect(b){
  if(!b || calErrors(b, AGE_BANDS.fluent).length) return null;
  if(b.t === 'months'){
    switch(b.ask){
      case 'name':   return 'month:' + (b.date ? calDate(b.date).m : b.m);
      case 'number': return b.m;
      case 'after':  return 'month:' + calMonthAt(b.m + 1);
      case 'before': return 'month:' + calMonthAt(b.m - 1);
      case 'later':  return 'month:' + calMonthAt(b.m + b.k);
      case 'count':  return ((b.m2 - b.m) % 12 + 12) % 12;
    }
    return null;
  }
  if(b.t === 'calendar'){
    switch(b.ask){
      case 'weekday': return 'day:' + (b.start + b.d - 1) % 7;
      case 'count':   { let n = 0; for(let d = 1; d <= b.days; d++) if((b.start + d - 1) % 7 === b.w) n++; return n; }
      case 'later':   return b.d + b.k;
    }
  }
  return null;
}

/* ---------------- reading an answer, English or Hindi ---------------- */
const calNorm = s => String(s == null ? '' : s).toLowerCase().replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d));
function calNamed(text, forms){
  const t = calNorm(text), hits = new Set();
  forms.forEach((fs, k) => { if(fs.some(f => new RegExp(`(^|[^\\p{L}\\p{M}])${f}($|[^\\p{L}\\p{M}])`, 'u').test(t))) hits.add(k); });
  return [...hits];
}
/* the one month an answer names (1–12), or null */
function calMonthRead(opt){ const h = calNamed(opt, CAL_MONTH_FORMS); return h.length === 1 ? h[0] + 1 : null; }
function calDayRead(opt){ const h = calNamed(opt, CAL_DAY_FORMS); return h.length === 1 ? h[0] : null; }
/* a number as an answer: "5", "5 months", "5 महीने", "5 Sundays", "५" */
function calAmount(opt){
  const m = /^\s*(\d+)\s*([\p{L}\p{M}\s]*)$/u.exec(calNorm(opt));
  return m && (!m[2].trim() || /^(months?|महीने|महीना|दिन|days?|dates?|तारीख|sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|रविवार|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार)$/u.test(m[2].trim())) ? Number(m[1]) : null;
}
function calSays(opt, want){
  if(typeof want === 'number') return calAmount(opt) === want;
  if(String(want).startsWith('month:')) return calMonthRead(opt) === Number(want.slice(6));
  if(String(want).startsWith('day:')) return calDayRead(opt) === Number(want.slice(4));
  return false;
}
/* "k later" isn't on the picture: the question must say it ("3 months later", "a week later") */
const CAL_NUM_EN = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const CAL_NUM_HI = ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस','ग्यारह','बारह'];
function calSaysK(text, k, days){
  const t = calNorm(text);
  if(new RegExp(`(^|\\D)${k}(\\D|$)`).test(t)) return true;
  if(k <= 12 && new RegExp(`(^|[^\\p{L}\\p{M}])(${CAL_NUM_EN[k]}|${CAL_NUM_HI[k]})($|[^\\p{L}\\p{M}])`, 'u').test(t)) return true;
  if(days && k === 7 && /\b(a|one) week\b|एक (हफ़्ते|हफ्ते|सप्ताह)|हफ़्ते भर|हफ्ते भर|week later/.test(t)) return true;
  if(days && k === 14 && /\btwo weeks\b|दो (हफ़्ते|हफ्ते|सप्ताह)/.test(t)) return true;
  return false;
}
function calAskError(pic, ask){
  const want = calExpect(pic);
  if(want == null) return pic.ask == null
    ? 'the calendar before this question must say what is asked (ask)' : "the calendar before this question can't answer it";
  const opts = ask.opts || [], hi = ask.hiOpts || opts;
  if(!calSays(opts[ask.correct], want)) return `the marked answer "${opts[ask.correct]}" isn't what the calendar shows`;
  if(!calSays(hi[ask.correct], want)) return `the Hindi answer "${hi[ask.correct]}" doesn't say what the calendar shows`;
  if(opts.some((o, k) => k !== ask.correct && calSays(o, want))) return 'both answers are right — one must be a mistake';
  if(pic.ask === 'later'){
    const q = ask.q || {};
    if(!calSaysK(q.en, pic.k, pic.t === 'calendar') || !calSaysK(q.hi, pic.k, pic.t === 'calendar'))
      return `the question must say how much later (${pic.k}${pic.t === 'calendar' ? ' days' : ' months'}) in both languages — the picture can't show it`;
  }
  return null;
}
/* Does a line already say this picture's answer? (the giveaway check) */
function calSaid(text, pic){
  const want = calExpect(pic);
  if(want == null) return false;
  if(String(want).startsWith('month:')) return calNamed(text, CAL_MONTH_FORMS).includes(Number(want.slice(6)) - 1);
  if(String(want).startsWith('day:')) return calNamed(text, CAL_DAY_FORMS).includes(Number(want.slice(4)));
  return false;                                          // a number is heard by the general check (digits and number words)
}

/* What a picture draws, without what it asks. */
function calSig(b){
  return JSON.stringify(b.t === 'months' ? { t: b.t, m: b.m || 0, m2: b.m2 || 0, date: b.date || '' } : { t: b.t, days: b.days, start: b.start, month: b.month || 0, d: b.d || 0, w: b.w == null ? -1 : b.w });
}
/* Sanitise a drafted beat (core/syllabus.js): known fields only. */
function calClean(x){
  const keep = x.t === 'months' ? ['m', 'm2', 'k', 'date', 'ask'] : ['days', 'start', 'month', 'd', 'w', 'k', 'ask'];
  const beat = { t: x.t };
  for(const k of keep) if(x[k] != null) beat[k] = x[k];
  return { beat, errors: calErrors(beat, AGE_BANDS.fluent) };     // the band's own limits: validateLesson()
}
/* Before checking (sylTidy): a missing ask read from the question's own words —
   only when they say it plainly; a wrong reading fails against the drawing. */
function calTidy(x, next){
  delete x.text;
  if(!next || next.t !== 'ask' || x.ask != null) return;
  const q = `${(next.q && next.q.en) || ''} ${(next.q && next.q.hi) || ''}`.toLowerCase();
  if(x.t === 'months'){
    if(/\bafter\b|के बाद/.test(q) && !/later|बाद में/.test(q)) x.ask = 'after';
    else if(/\bbefore\b|से पहले/.test(q)) x.ask = 'before';
    else if(/later|months? (from now|after)|महीने बाद/.test(q)) x.ask = 'later';
    else if(/how many months|कितने महीने/.test(q)) x.ask = 'count';
    else if(/what number|which number|कौन सा नंबर|कौन सी संख्या|किस नंबर/.test(q)) x.ask = 'number';
    else if(/which month|कौन सा महीना|किस महीने/.test(q)) x.ask = 'name';
  } else {
    if(/what day|which day|कौन सा दिन|कौन सा वार|किस दिन/.test(q)) x.ask = 'weekday';
    else if(/how many (sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)|कितने (रविवार|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार)/.test(q)) x.ask = 'count';
    else if(/later|what date|कौन सी तारीख|बाद/.test(q)) x.ask = 'later';
  }
}

/* ---------------- drawing ---------------- */
const CAL_MARK = 'rgba(232,74,124,.22)';                         // the marked month / date / column
function calArt(b){
  const hi = S.lang === 'hi', lang = hi ? 'hi' : 'en';
  const txt = (x, y, t, size, opt) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="currentColor"${opt || ''}>${t}</text>`;
  if(b.t === 'months'){
    if(calErrors(b, AGE_BANDS.fluent).length) return null;
    const dt = b.date ? calDate(b.date) : null, top = dt ? 46 : 8;
    // marked: the month a teaching strip or an after/before/later/count question is about (and count's second);
    // a name or number question marks its month by hiding what is asked instead
    const marked = new Set();
    if(b.m && (b.ask == null || ['after', 'before', 'later', 'count'].includes(b.ask))) marked.add(b.m);
    if(b.ask === 'count' && b.m2) marked.add(b.m2);
    const hideName = b.ask === 'name' && !dt, hideNum = b.ask === 'number';
    // three across, four down: on a 360 px phone the names stay ~13 px (two rows of
    // six shrank the Hindi names to ~8 px)
    let s = '';
    if(dt) s += `<rect x="84" y="6" width="200" height="34" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".6"/>` + txt(184, 23, b.date.trim(), 21, ' font-weight="700" letter-spacing="1"');
    for(let n = 1; n <= 12; n++){
      const c = (n - 1) % 3, r = Math.floor((n - 1) / 3), x = 4 + c * 120, y = top + r * 62;
      const on = marked.has(n), unknown = (hideName || hideNum) && n === b.m;
      s += `<rect x="${x}" y="${y}" width="114" height="56" rx="9" fill="${on || unknown ? CAL_MARK : GEO_FILL}" stroke="${on || unknown ? 'var(--rani)' : GEO_STROKE}" stroke-width="${on || unknown ? 3 : 1.5}"/>`;
      s += txt(x + 18, y + 28, hideNum ? (n === b.m ? '?' : '') : n, 19, ' font-weight="700" opacity=".8"');
      s += txt(x + 68, y + 29, hideName && n === b.m ? '?' : CAL_MONTHS[lang][n - 1], hi ? 19 : 17, hideName && n === b.m ? ' font-weight="700"' : '');
    }
    const H = top + 4 * 62;
    return `<svg class="geo cal" viewBox="0 0 368 ${H}" width="340" role="img" aria-label="${hi ? 'साल के महीने' : 'the months of the year'}">${s}</svg>`;
  }
  if(b.t === 'calendar'){
    if(calErrors(b, AGE_BANDS.fluent).length) return null;
    const rows = Math.ceil((b.start + b.days) / 7), top = b.month ? 34 : 6, cw = 44, ch = 34;
    let s = b.month ? txt(154, 16, CAL_MONTHS[lang][b.month - 1], 17, ' font-weight="700"') : '';
    const col = b.ask === 'count' ? b.w : null;
    for(let w = 0; w < 7; w++){
      if(col === w) s += `<rect x="${2 + w * cw}" y="${top}" width="${cw - 4}" height="${ch * (rows + 1)}" rx="6" fill="${CAL_MARK}"/>`;
      s += txt(22 + w * cw, top + ch / 2, CAL_DAY_SHORT[lang][w], 14, ` font-weight="700"${w === 0 ? ' fill-opacity=".9"' : ''}`);
    }
    for(let d = 1; d <= b.days; d++){
      const at = b.start + d - 1, w = at % 7, r = Math.floor(at / 7), x = w * cw, y = top + ch * (r + 1);
      const on = d === b.d;
      s += `<rect x="${x + 3}" y="${y + 3}" width="${cw - 6}" height="${ch - 6}" rx="5" fill="${on ? CAL_MARK : 'none'}" stroke="${on ? 'var(--rani)' : GEO_STROKE}" stroke-width="${on ? 2.5 : 1}" opacity="${on ? 1 : 0.7}"/>`;
      s += txt(x + cw / 2, y + ch / 2, d, 14, on ? ' font-weight="700"' : '');
    }
    return `<svg class="geo cal" viewBox="0 0 ${7 * cw} ${top + ch * (rows + 1) + 4}" width="300" role="img" aria-label="${hi ? 'महीने का पन्ना' : "a month's calendar page"}">${s}</svg>`;
  }
  return null;
}

/* ---------------- what Munni says ----------------
   A picture a question is about is never read aloud. */
const CAL_SAY = {
  months:  { en: 'A year has twelve months, in order from January to December.', hi: 'साल में बारह महीने होते हैं, जनवरी से दिसंबर तक, क्रम से।' },
  date:    { en: 'In a date, the middle number is the month.', hi: 'तारीख में बीच वाली संख्या महीना बताती है।' },
  lookM:   { en: 'Look along the months, one at a time.', hi: 'महीनों को एक-एक करके देखो।' },
  lookD:   { en: 'Look at the date, then at the months.', hi: 'तारीख देखो, फिर महीने देखो।' },
  cal:     { en: 'Each column is one day of the week. The dates go along each row.', hi: 'हर खाना हफ़्ते का एक दिन है। तारीखें हर पंक्ति में आगे बढ़ती हैं।' },
  lookCal: { en: 'Look at the marked date and its column.', hi: 'निशान वाली तारीख और उसका खाना देखो।' },
  lookCol: { en: 'Look down the marked column.', hi: 'निशान वाले खाने में नीचे तक देखो।' }
};
function calSayBoth(b){
  if(b.t === 'months'){
    if(b.ask) return b.date ? CAL_SAY.lookD : CAL_SAY.lookM;
    if(b.date && calDate(b.date)) return CAL_SAY.date;
    if(calInt(b.m, 1, 12)) return { en: `Month ${b.m} is ${CAL_MONTHS.en[b.m - 1]}.`, hi: `महीना ${b.m} ${CAL_MONTHS.hi[b.m - 1]} है।` };
    return CAL_SAY.months;
  }
  if(b.t === 'calendar'){
    if(b.ask) return b.ask === 'count' ? CAL_SAY.lookCol : CAL_SAY.lookCal;
    if(calInt(b.start, 0, 6)) return { en: `${CAL_SAY.cal.en} The 1st is a ${CAL_DAYS.en[b.start]}.`, hi: `${CAL_SAY.cal.hi} 1 तारीख को ${CAL_DAYS.hi[b.start]} है।` };
    return CAL_SAY.cal;
  }
  return null;
}
function calSay(b){
  if(!CAL_TYPES.includes(b.t) || b.say) return null;
  const o = calSayBoth(b);
  return o ? o[S.lang === 'hi' ? 'hi' : 'en'] : null;
}
/* Ask Munni: how to look, never the answer. */
const CAL_HINT = {
  name:    { en: 'Find that number on the strip of months. Its name is right under it.', hi: 'महीनों की पट्टी पर वह संख्या ढूँढो। उसका नाम ठीक उसके नीचे है।' },
  nameD:   { en: 'Find the middle number of the date. Then find that number on the strip of months.', hi: 'तारीख की बीच वाली संख्या ढूँढो। फिर वही संख्या महीनों की पट्टी पर ढूँढो।' },
  nameQ:   { en: 'Say the months from January, counting on your fingers, until you reach that number.', hi: 'जनवरी से महीने बोलो, उँगलियों पर गिनते हुए, जब तक वह संख्या न आ जाए।' },
  number:  { en: 'Start at January as 1 and count along, one month at a time.', hi: 'जनवरी को 1 मानो और एक-एक महीना आगे गिनो।' },
  // (never a month's name: "after December comes January" was the answer to "what comes after December?")
  move:    { en: 'Put your finger on the marked month and move along, one month at a time. At the end of the year, go back to the start of the strip.', hi: 'निशान वाले महीने पर उँगली रखो और एक-एक महीना आगे बढ़ो। साल खत्म हो तो पट्टी की शुरुआत पर लौटो।' },
  count:   { en: 'Start at the first marked month and count each step to the second one.', hi: 'पहले निशान वाले महीने से शुरू करो और दूसरे तक हर कदम गिनो।' },
  weekday: { en: 'Put your finger on the date and go straight up to the top of its column.', hi: 'तारीख पर उँगली रखो और सीधे ऊपर, उसके खाने के सबसे ऊपर तक जाओ।' },
  col:     { en: 'Go down the marked column and count the dates in it. Look at the last row too.', hi: 'निशान वाले खाने में नीचे जाओ और उसकी तारीखें गिनो। आख़िरी पंक्ति भी देखो।' },
  later:   { en: 'Count on from the marked date, one box at a time. A week later is the box just below it.', hi: 'निशान वाली तारीख से एक-एक खाना आगे गिनो। एक हफ़्ते बाद ठीक नीचे वाला खाना होता है।' }
};
function calHint(les, i){
  const p = picFor(les, i);
  if(!p || !CAL_TYPES.includes(p.t)) return null;
  const k = p.t === 'calendar' ? ({ weekday: 'weekday', count: 'col', later: 'later' })[p.ask]
    : p.ask === 'name' ? (p.date ? 'nameD' : 'nameQ') : p.ask === 'number' ? 'number' : p.ask === 'count' ? 'count' : 'move';
  const h = CAL_HINT[k || 'move'];
  return h[S.lang === 'hi' ? 'hi' : 'en'];
}

/* ---------------- the built-in lessons ---------------- */
const calMonthOpts = (right, wrong, flip) => {
  const o = [CAL_MONTHS.en[right - 1], CAL_MONTHS.en[wrong - 1]], h = [CAL_MONTHS.hi[right - 1], CAL_MONTHS.hi[wrong - 1]];
  return flip ? { opts: [o[1], o[0]], hiOpts: [h[1], h[0]], correct: 1 } : { opts: o, hiOpts: h, correct: 0 };
};
const calDayOpts = (right, wrong, flip) => {
  const o = [CAL_DAYS.en[right], CAL_DAYS.en[wrong]], h = [CAL_DAYS.hi[right], CAL_DAYS.hi[wrong]];
  return flip ? { opts: [o[1], o[0]], hiOpts: [h[1], h[0]], correct: 1 } : { opts: o, hiOpts: h, correct: 0 };
};
const calNumOpts = (right, wrong, flip) => { const o = [String(right), String(wrong)]; return flip ? { opts: [o[1], o[0]], hiOpts: [o[1], o[0]], correct: 1 } : { opts: o, hiOpts: o, correct: 0 }; };

const CAL_CONCEPTS = [

/* the order of the months (7–8): the mistakes — going the wrong way along
   the year (the month before, for "after"), and counting January as 0 */
{ id:'monthorder', band:'developing', ic:'🗓️', strand:'num', key:(p)=>`monthorder-${p.after}-${p.num}`,
  title:()=>gq('The months in order', 'महीने क्रम से'),
  sub:()=>gq('January to December', 'जनवरी से दिसंबर'),
  space:()=>[{ after:3, num:8, i:0 }, { after:6, num:4, i:1 }, { after:12, num:10, i:2 }, { after:9, num:5, i:3 }],
  beats:(p)=>[
    {t:'intro', say:gq('Let us walk through the year, one month at a time.', 'आओ साल में एक-एक महीना आगे चलें।')},
    {t:'months'},
    {t:'months', m:p.after, ask:'after'},
    {t:'ask', q:gq('Which month comes after the marked one?', 'निशान वाले महीने के बाद कौन सा महीना आता है?'), ...calMonthOpts(calMonthAt(p.after + 1), calMonthAt(p.after - 1), p.i % 2)},
    {t:'months', m:p.num, ask:'number'},
    {t:'ask', q:gq('What number is the marked month?', 'निशान वाला महीना कौन सी संख्या का है?'), ...calNumOpts(p.num, p.num - 1, (p.i + 1) % 2)},
    {t:'win', say:gq('January is 1, and each month after it is one more.', 'जनवरी 1 है, और उसके बाद हर महीना एक ज़्यादा।')}
  ]},

/* months later and between (7–8): the mistakes — counting the starting
   month as one of the months (one short), and counting both ends (one over) */
{ id:'monthlater', band:'developing', ic:'🌱', strand:'num', key:(p)=>`monthlater-${p.m}-${p.k}-${p.a}-${p.b}`,
  title:()=>gq('How many months?', 'कितने महीने?'),
  sub:()=>gq('Count along the year', 'साल में आगे गिनो'),
  space:()=>[
    { m:6, k:3, a:2, b:7, teach:4, i:0 }, { m:7, k:2, a:3, b:9, teach:11, i:1 },
    { m:10, k:4, a:5, b:8, teach:1, i:2 }, { m:11, k:3, a:4, b:10, teach:8, i:3 }
  ],
  beats:(p)=>{
    const words = gq(`Seeds sown in the marked month take ${p.k} months to grow. Which month are they ready?`, `निशान वाले महीने में बोए बीज ${p.k} महीने में उगते हैं। वे किस महीने तैयार होंगे?`);
    return [
      {t:'intro', say:gq('Some seeds grow in weeks, some take months. Let us count months.', 'कुछ बीज हफ़्तों में उगते हैं, कुछ को महीने लगते हैं। आओ महीने गिनें।')},
      {t:'months', m:p.teach},
      {t:'months', m:p.m, k:p.k, ask:'later'},
      {t:'ask', q:words, ...calMonthOpts(calMonthAt(p.m + p.k), calMonthAt(p.m + p.k - 1), p.i % 2)},
      {t:'months', m:p.a, m2:p.b, ask:'count'},
      {t:'ask', q:gq('How many months is it from the first marked month to the second?', 'पहले निशान वाले महीने से दूसरे तक कितने महीने हैं?'), ...calNumOpts(p.b - p.a, p.b - p.a + 1, (p.i + 1) % 2)},
      {t:'win', say:gq('Count the steps from one month to the next, not the months you start on.', 'एक महीने से अगले तक के कदम गिनो, शुरू वाला महीना नहीं।')}
    ];
  }},

/* the month in a date (7–8): the mistake — reading the first number (the
   day) as the month */
{ id:'datemonth', band:'developing', ic:'📄', strand:'num', key:(p)=>`datemonth-${p.d1}-${p.d2}`,
  title:()=>gq('The month in a date', 'तारीख में महीना'),
  sub:()=>gq('Day, month, year', 'दिन, महीना, साल'),
  space:()=>[
    { d1:'02/05/2015', d2:'09/11/2016', i:0 }, { d1:'04/08/2016', d2:'07/03/2015', i:1 },
    { d1:'06/10/2014', d2:'03/07/2017', i:2 }, { d1:'08/02/2016', d2:'01/09/2015', i:3 }
  ],
  beats:(p)=>{
    const a = calDate(p.d1), b2 = calDate(p.d2);
    return [
      {t:'intro', say:gq('A birth certificate writes the date as day, month, year.', 'जन्म प्रमाण पत्र पर तारीख दिन, महीना, साल लिखी जाती है।')},
      {t:'months', date:'15/06/2016', m:6},
      {t:'months', date:p.d1, ask:'name'},
      {t:'ask', q:gq('Which month is in this date?', 'इस तारीख में कौन सा महीना है?'), ...calMonthOpts(a.m, a.d, p.i % 2)},
      {t:'months', date:p.d2, ask:'name'},
      {t:'ask', q:gq('Which month is in this date?', 'इस तारीख में कौन सा महीना है?'), ...calMonthOpts(b2.m, b2.d, (p.i + 1) % 2)},
      {t:'win', say:gq('Day first, then the month, then the year.', 'पहले दिन, फिर महीना, फिर साल।')}
    ];
  }},

/* the day of a date, and counting a day's dates (7–8): the mistakes — the
   day in the next column, and missing the last row (4 for 5) */
{ id:'calweekday', band:'developing', ic:'📅', strand:'num', key:(p)=>`calweekday-${p.start}-${p.d}`,
  title:()=>gq("A month's calendar", 'महीने का कैलेंडर'),
  sub:()=>gq('Days of the week in columns', 'हफ़्ते के दिन खानों में'),
  space:()=>[
    { days:31, start:3, d:16, w:5, month:7, i:0 }, { days:30, start:1, d:20, w:2, month:9, i:1 },
    { days:31, start:5, d:11, w:0, month:12, i:2 }, { days:28, start:0, d:19, w:4, month:2, i:3 }
  ],
  beats:(p)=>{
    const wd = (p.start + p.d - 1) % 7;
    let n = 0; for(let d = 1; d <= p.days; d++) if((p.start + d - 1) % 7 === p.w) n++;
    const wrongN = n === 5 ? 4 : 5;
    return [
      {t:'intro', say:gq('A calendar shows a whole month, a week in each row.', 'कैलेंडर पूरा महीना दिखाता है, हर पंक्ति में एक हफ़्ता।')},
      {t:'calendar', days:30, start:(p.start + 3) % 7},
      {t:'calendar', days:p.days, start:p.start, month:p.month, d:p.d, ask:'weekday'},
      {t:'ask', q:gq('What day of the week is the marked date?', 'निशान वाली तारीख को कौन सा दिन है?'), ...calDayOpts(wd, (wd + 1) % 7, p.i % 2)},
      {t:'calendar', days:p.days, start:p.start, month:p.month, w:p.w, ask:'count'},
      {t:'ask', q:gq(`How many ${CAL_DAYS.en[p.w]}s are in this month?`, `इस महीने में कितने ${CAL_DAYS.hi[p.w]} हैं?`), ...calNumOpts(n, wrongN, (p.i + 1) % 2)},
      {t:'win', say:gq('Go up a column to find the day; go down it to count.', 'दिन जानने के लिए खाने में ऊपर जाओ; गिनने के लिए नीचे।')}
    ];
  }},

/* a week later (7–8): the mistake — one day later instead of a week */
{ id:'calweek', band:'developing', ic:'🗒️', strand:'num', key:(p)=>`calweek-${p.d}-${p.d2}`,
  title:()=>gq('A week later', 'एक हफ़्ते बाद'),
  sub:()=>gq('Seven days on the calendar', 'कैलेंडर पर सात दिन'),
  space:()=>[{ start:2, d:9, d2:5, k2:3, i:0 }, { start:4, d:12, d2:20, k2:4, i:1 }, { start:6, d:3, d2:15, k2:5, i:2 }, { start:1, d:17, d2:8, k2:6, i:3 }],
  beats:(p)=>[
    {t:'intro', say:gq('A week is seven days. On a calendar, the same day is one row down.', 'एक हफ़्ता सात दिन का होता है। कैलेंडर पर वही दिन एक पंक्ति नीचे होता है।')},
    {t:'calendar', days:31, start:(p.start + 2) % 7},
    {t:'calendar', days:31, start:p.start, d:p.d, k:7, ask:'later'},
    {t:'ask', q:gq('What date is it one week after the marked date?', 'निशान वाली तारीख से एक हफ़्ते बाद कौन सी तारीख होगी?'), ...calNumOpts(p.d + 7, p.d + 1, p.i % 2)},
    {t:'calendar', days:31, start:p.start, d:p.d2, k:p.k2, ask:'later'},
    {t:'ask', q:gq(`What date is it ${p.k2} days after the marked date?`, `निशान वाली तारीख से ${p.k2} दिन बाद कौन सी तारीख होगी?`), ...calNumOpts(p.d2 + p.k2, p.d2 + p.k2 - 1, (p.i + 1) % 2)},
    {t:'win', say:gq('Count on one box for each day; one row down is a week.', 'हर दिन के लिए एक खाना आगे गिनो; एक पंक्ति नीचे यानी एक हफ़्ता।')}
  ]}
];

/* ---------------- register ---------------- */
picRegister(CAL_TYPES, {
  name: 'calendar', expect: calExpect, errors: calErrors, askError: calAskError, sig: calSig,
  asks: b => b.ask != null, again: 'ask about a different month or date',
  art: calArt, sayBoth: calSayBoth, say: calSay, hint: calHint, clean: calClean,
  said: calSaid, tidy: calTidy,
  aimKeys: b => b.ask ? [b.t === 'months' ? 'months' : 'calendar'] : [],
  aimNeed: t => /\bmonths?\b|\bdates?\b|birth|certificate|महीन|तारीख/.test(t) ? ['months', 'calendar']
    : /calendar|day of the week|weekday|\bweeks?\b|sunday|monday|कैलेंडर|हफ़्त|हफ्त|सप्ताह/.test(t) ? ['calendar', 'months'] : null
});
if(typeof GEN_BEATS !== 'undefined') for(const t of CAL_TYPES) if(!GEN_BEATS.includes(t)) GEN_BEATS.push(t);
if(typeof CONCEPTS !== 'undefined') CONCEPTS.push(...CAL_CONCEPTS);
const CAL_SKILL_MAP = { monthorder:['calendar3'], monthlater:['calendar3'], datemonth:['calendar3'], calweekday:['calendar3'], calweek:['calendar3'] };
if(typeof SKILLS !== 'undefined'){
  for(const [c, ids] of Object.entries(CAL_SKILL_MAP))
    for(const id of ids){
      const s = SKILLS.find(x => x.id === id);
      if(s && !s.concepts.includes(c)) s.concepts.push(c);
    }
}
