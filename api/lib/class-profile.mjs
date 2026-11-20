/* ==================================================================
   THE CLASS PROFILE — one description of a class, in every Gemini prompt.

   The child's class decides what Takhti teaches (src/content/ages.js
   CLASSES), so every prompt that writes or judges something for a child
   says which class it is for, the same way: how old they usually are,
   which stage of school, the biggest number, the tone, and what never to
   do. The phone sends only the class id ('c7'); the profile is built
   here, from this table, so no phone can put other words into a prompt.

   This file sits in api/lib/ so Netlify doesn't take it for a function
   (only api/*.mjs are); the Cloud Run image copies api/ whole.

   This table must agree with the app's own (src/content/ages.js —
   CLASSES and the bands' number ceilings); test/class-profile.test.js
   checks that it does, and that the phone's checker (core/syllabus.js
   sylClassErrors) uses the same never-lists.
   ================================================================== */

const STAGE = {
  foundA:    { en: 'pre-primary (foundational)', tone: 'warm and playful; very simple words; one idea per sentence; lots of pictures and counting things you can touch' },
  foundB:    { en: 'early primary (foundational)', tone: 'warm and simple; short sentences; everyday Indian examples; Munni leads gently' },
  prep:      { en: 'primary (preparatory)', tone: 'friendly and clear; the child works it out; real-life examples from school, home and the market; no baby talk' },
  middle:    { en: 'middle school', tone: 'respectful, like a good older student studying alongside them; precise words; examples from science, money and the world around them; never childish' },
  secondary: { en: 'secondary school', tone: 'respectful and precise, as to a young adult; exam-aware; uses the textbook\'s terms correctly; never childish' }
};

// [id, label, ages, stage, band, grade, biggest number]
const ROWS = [
  ['kg',  'Nursery / KG', [3, 6],   'foundA',    'pre',        0,  10],
  ['nur', 'Nursery',      [3, 4],   'foundA',    'pre',        -3, 10],
  ['lkg', 'LKG',          [4, 5],   'foundA',    'pre',        -2, 10],
  ['ukg', 'UKG',          [5, 6],   'foundA',    'early',      -1, 20],
  ['c1',  'Class 1',      [6, 7],   'foundB',    'early',      1,  20],
  ['c2',  'Class 2',      [7, 8],   'foundB',    'developing', 2,  100],
  ['c3',  'Class 3',      [8, 9],   'prep',      'developing', 3,  100],
  ['c4',  'Class 4',      [9, 10],  'prep',      'fluent',     4,  1000],
  ['c5',  'Class 5',      [10, 11], 'prep',      'fluent',     5,  1000],
  ['c6',  'Class 6',      [11, 12], 'middle',    'fluent',     6,  100000],
  ['c7',  'Class 7',      [12, 13], 'middle',    'fluent',     7,  100000],
  ['c8',  'Class 8',      [13, 14], 'middle',    'fluent',     8,  100000],
  ['c9',  'Class 9',      [14, 15], 'secondary', 'fluent',     9,  10000000],
  ['c10', 'Class 10',     [15, 16], 'secondary', 'fluent',     10, 10000000]
];

/* What a lesson for this class must never do. The phone's checker rejects
   a draft that does (core/syllabus.js sylClassErrors) with these same
   patterns — the test checks the sources match. */
export const TRACE_RE = /\btrac(?:e|ing)\s+(?:the|over|along|it|this|these|each|a|an|letters?|lines?|shapes?)\b|\btracing\b|ट्रेस/i;
export const BABY_RE = /\b(?:little one|sweetie|cutie|kiddo|baby|tiny tot)\b|नन्हे|छोटू|बेटू/i;

function never(g){
  const out = ['say "wrong" or scold — say what to try next', 'copy the textbook\'s own sentences'];
  if(g >= 2) out.push('ask the child to trace — tracing is for Nursery to Class 1; this class writes on paper or answers');
  if(g >= 3) out.push('use baby talk ("little one", "sweetie", "नन्हे") or treat the child as much younger');
  if(g >= 6) out.push('use nursery examples (counting toys, ABC, colouring) — use what a Class ' + g + ' textbook uses');
  return out;
}

export const CLASS_PROFILES = Object.fromEntries(ROWS.map(([id, label, ages, stage, band, g, maxNumber]) =>
  [id, { id, label, ages, stage, stageEn: STAGE[stage].en, band, g, maxNumber, tone: STAGE[stage].tone, never: never(g) }]));

export const classProfile = id => CLASS_PROFILES[String(id || '')] || null;

/* The block every prompt carries. */
export function classText(p){
  if(!p) return '';
  return `THE CLASS: ${p.label} — ${p.stageEn}, usually ${p.ages[0]}–${p.ages[1]} years old. Pitch every line at this class, not younger: ${p.tone}. Numbers go up to ${p.maxNumber}. Never: ${p.never.join('; ')}.`;
}

/* For judging what a child said (Teach Appu): expect what this class can say. */
export function classJudgeText(p){
  if(!p) return '';
  return `The child is in ${p.label} (${p.stageEn}, usually ${p.ages[0]}–${p.ages[1]}). Expect an explanation a child of this class could give in their own words — don't demand textbook wording, and don't credit an explanation that only fits a much younger class's version of the idea.`;
}
