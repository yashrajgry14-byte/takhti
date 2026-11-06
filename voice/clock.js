/* ==================================================================
   CLOCK — times a parent says, times Munni says, and the local day

   A parent on the consent call says "शाम साढ़े पाँच बजे", "paanch baje",
   "6 pm" or "17:30"; Munni says it back the way people say it
   ("शाम साढ़े पाँच बजे", "5:30 in the evening"). Everything is in the
   family's own time zone (TAKHTI_TZ, Asia/Kolkata by default), never the
   server's.
   ================================================================== */
'use strict';
const { numbersIn, numberWord } = require('./understand');

const pad = n => String(n).padStart(2, '0');
const tzOf = env => (env && env.TAKHTI_TZ) || 'Asia/Kolkata';

/* The local calendar day, weekday (1 = Monday … 7 = Sunday) and minute of
   the day, for a moment in the family's time zone. */
function localParts(date, env) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tzOf(env), hour12: false, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(date instanceof Date ? date : new Date(date)).map(x => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    weekday: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday],
    hour, minutes: hour * 60 + Number(p.minute)
  };
}

const toMinutes = hhmm => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const fromMinutes = mins => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

/* Quiet hours as "21-7": no call to a child, and no lesson set up, inside
   them. Shared with the inbound line. */
function inQuiet(minutes, spec) {
  const m = String(spec || '21-7').match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return false;
  const a = Number(m[1]) * 60, b = Number(m[2]) * 60;
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}
function quietBounds(spec) {
  const m = String(spec || '21-7').match(/^(\d{1,2})-(\d{1,2})$/) || [0, 21, 7];
  return { from: fromMinutes(Number(m[2]) * 60), to: fromMinutes(Number(m[1]) * 60) };   // when calls ARE allowed
}

/* ---------- hearing a time ---------- */
const AM = /\b(am|a\.m\.|morning|subah|subha|savere|savera)\b|सुबह|सवेरे/i;
const PM = /\b(pm|p\.m\.|evening|afternoon|night|shaam|sham|dopahar|dopehar|raat|rat)\b|शाम|दोपहर|रात/i;
const MARKER = /\d[:.]\d{2}|\b(baje|bajey|bje|o'?clock|am|pm|a\.m\.|p\.m\.)\b|बजे|बजकर/i;
const HALF = /\b(sadhe|saadhe|saade|sade|half past)\b|साढ़े|साढे/i;
const QUARTER = /\b(sawa|sava|quarter past)\b|सवा/i;
const TO = /\b(paune|pone|quarter to)\b|पौने/i;

/* "5:30", "साढ़े पाँच", "शाम 6 बजे", "6 pm" → "17:30" / "18:00", or null.
   With needMarker, only an utterance that is clearly about a time counts
   ("6 baje", "6 pm", "5:30") — so "do din mein ek baar" is not 2 o'clock. */
function parseClock(said, o) {
  o = o || {};
  const u = String(said || '').normalize('NFC');
  if (o.needMarker && !MARKER.test(u) && !AM.test(u) && !PM.test(u)) return null;
  let h = null, m = 0;
  const hm = u.match(/\b(\d{1,2})[:.](\d{2})\b/);
  if (hm) { h = Number(hm[1]); m = Number(hm[2]); }
  else if (/\b(dhai|dhaai)\b|ढाई/i.test(u)) { h = 2; m = 30; }
  else if (/\b(dedh|derh)\b|डेढ़|डेढ/i.test(u)) { h = 1; m = 30; }
  else {
    // "quarter to 6": the marker's own words are not numbers ("to" is two)
    // English words a Hinglish reader takes for numbers ("at" = aath,
    // "to" = two, "for" = four) are dropped before reading the hour
    const bare = u.replace(HALF, ' ').replace(QUARTER, ' ').replace(TO, ' ')
      .replace(/\b(at|to|too|for|by|on|won|ate)\b/gi, ' ');
    const digits = bare.match(/\b\d{1,2}\b/g);
    const ns = (digits ? digits.map(Number) : numbersIn(bare)).filter(n => n >= 0 && n <= 59);
    if (!ns.length || ns[0] > 24) return null;
    h = ns[0];
    if (HALF.test(u)) m = 30;
    else if (QUARTER.test(u)) m = 15;
    else if (TO.test(u)) { h -= 1; m = 45; }
    else if (ns.length > 1 && (/\b(minute|minutes|mint)\b|मिनट|बजकर/i.test(u) || [15, 30, 45].includes(ns[1]))) m = ns[1];
  }
  if (h == null || h < 0 || h > 24 || m > 59) return null;
  if (h === 24) h = 0;
  if (h <= 12) {
    if (AM.test(u)) { if (h === 12) h = 0; }
    else if (PM.test(u)) { if (h < 12) h += 12; }
    // no morning/evening: a child's lesson time is nearly always after
    // school, so 1–8 means the afternoon or evening
    else if (h >= 1 && h <= 8) h += 12;
  }
  return `${pad(h)}:${pad(m)}`;
}

/* "every day" / "every other day" → the weekdays Munni calls on */
const DAYS = { daily: [1, 2, 3, 4, 5, 6, 7], alternate: [1, 3, 5] };
function daysOf(said) {
  const u = String(said || '').toLowerCase().normalize('NFC');
  if (/\b(alternate|every other|other day|ek din chhod|ek din chod|din chhod|din chod|do din mein ek|teen din)\b|एक दिन छोड़|दिन छोड़|दो दिन में एक|तीन दिन/.test(u)) return 'alternate';
  if (/\b(every ?day|daily|each day|roz|rozana|roj|har din|har roz|sab din)\b|रोज़|रोज|रोज़ाना|हर दिन|हर रोज़|हर रोज/.test(u)) return 'daily';
  return null;
}

/* ---------- saying a time ---------- */
const PART = { en: ['in the morning', 'in the afternoon', 'in the evening', 'at night'], hi: ['सुबह', 'दोपहर', 'शाम', 'रात'] };
function partOf(h) { return h < 12 ? 0 : h < 16 ? 1 : h < 20 ? 2 : 3; }
function clockSay(hhmm, lang) {
  const mins = toMinutes(hhmm);
  if (mins == null) return hhmm;
  const h = Math.floor(mins / 60), m = mins % 60, h12 = h % 12 || 12, part = partOf(h);
  if (lang !== 'hi') return `${h12}${m ? ':' + pad(m) : ''} ${PART.en[part]}`;
  const w = n => numberWord(n, 'hi');
  let t;
  if (m === 0) t = `${w(h12)} बजे`;
  else if (m === 30) t = h12 === 1 ? 'डेढ़ बजे' : h12 === 2 ? 'ढाई बजे' : `साढ़े ${w(h12)} बजे`;
  else if (m === 15) t = `सवा ${w(h12)} बजे`;
  else if (m === 45) t = `पौने ${w(h12 % 12 + 1)} बजे`;
  else t = `${w(h12)} बजकर ${w(m)} मिनट`;
  return `${PART.hi[part]} ${t}`;
}

const DAY_NAME = {
  en: [null, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  hi: [null, 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार', 'रविवार']
};
function daysSay(days, lang) {
  const set = [...new Set(days || [])].sort();
  if (set.length === 7) return lang === 'hi' ? 'रोज़' : 'every day';
  const names = set.map(d => DAY_NAME[lang === 'hi' ? 'hi' : 'en'][d]);
  const and = lang === 'hi' ? ' और ' : ' and ';
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + and + names[names.length - 1] : names[0] || '';
  return lang === 'hi' ? `${list} को` : `on ${list}`;
}

/* The next day Munni calls on, after today: { weekday, inDays } */
function nextCallDay(days, nowParts) {
  for (let k = 1; k <= 7; k++) {
    const wd = ((nowParts.weekday - 1 + k) % 7) + 1;
    if ((days || []).includes(wd)) return { weekday: wd, inDays: k };
  }
  return null;
}
/* "tomorrow at 5 in the evening" / "कल शाम पाँच बजे" / "on Monday at …" */
function whenSay(next, hhmm, lang) {
  if (!next) return '';
  const c = clockSay(hhmm, lang);
  if (lang === 'hi') return next.inDays === 1 ? `कल ${c}` : `${DAY_NAME.hi[next.weekday]} को ${c}`;
  return next.inDays === 1 ? `tomorrow at ${c}` : `on ${DAY_NAME.en[next.weekday]} at ${c}`;
}

module.exports = { localParts, toMinutes, fromMinutes, inQuiet, quietBounds, parseClock, daysOf, DAYS,
                   clockSay, daysSay, nextCallDay, whenSay, DAY_NAME };
