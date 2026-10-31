/* ==================================================================
   TWIN — a model of how this child thinks (core/twin.js, the mistakes in
   core/mathgen.js, ui/mind-ui.js)

   vm: a wrong answer is put down to the mistake it really is (52 and 512
   for 38 + 24 are different mistakes); the line of help aimed at it never
   says the answer; knowledge tracing rises with right answers, falls with
   wrong ones, fades with time away (more slowly for a skill got right on
   many days) and never to nothing; a mistake made twice is a habit, a
   one-away slip isn't; the twin's guess before each question — and a
   simulated child with a habit of thought is guessed exactly far more
   often once the twin has seen it; the summary carries no name or id;
   Munni's next idea goes at a habit.

   vm + HTTP (the voice server): a wrong sum on a call gets the clue aimed
   at its mistake, offering the child's own answer against the right one,
   and the mistake is kept; a help call warns about a habit only if it is
   a known mistake this very question can produce.

   jsdom (the real app): Counting Stones guesses before the answer and
   checks after; a wrong answer gets the tip for its mistake, and the
   second time "Munni noticed"; Ask Munni warns about the habit and a
   call carries it; a helped answer teaches the twin nothing; the parent
   reads it all in English and Hindi; nothing of the twin is synced.
   ================================================================== */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createBrain } = require('../voice/brain');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }
const root = path.resolve(__dirname, '..');
const DAY = 864e5;

/* ---------- 1. the twin, in a vm ---------- */
function twinBox(){
  const ctx = { S: { id: 'c-jai-77', name: 'Jai', lang: 'en', skillHistory: {} }, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/mathgen.js'), 'utf8').replace(/^const SKILL_OPS/m, 'var SKILL_OPS'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/matcher.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/mind.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/lang-mistakes.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/twin.js'), 'utf8') + `;this.T = { MISTAKES, mistakeAnswers, whichMistake, mistakeTip, mistakeExplain, mistakeLabel, procAnswers, procMatches, procValid, twinOf, twinMastery, twinObserve, twinAnswer, twinHabit, twinPredict, twinExpect, twinCheck, twinScore, twinFading, twinSummary, mindNext,
    LMISTAKES, wordMistake, lineMistakes, inkMistakes, langTip, langLetters, gradeReading, twinNote, twinProfile, twinCleanProfile, twinPrompt };`, ctx);
  return ctx;
}
{
  const { T, S } = twinBox();
  const P = (a, op, b, c) => ({ a, op, b, c: c == null ? null : c });
  const cases = [[P(38, '+', 24), 52, 'nocarry'], [P(38, '+', 24), 512, 'colsjoin'], [P(38, '+', 24), 62, 'right'], [P(38, '+', 24), 63, 'countslip'], [P(38, '+', 24), 99, 'other'],
                 [P(53, '−', 28), 35, 'smallbig'], [P(53, '−', 28), 35 - 10 + 10, 'smallbig'], [P(53, '−', 28), 81, 'wrongop'], [P(23, '×', 4), 32, 'tensnotx'], [P(6, '×', 7), 48, 'groupcount'],
                 [P(2, '+', 3, 4), 20, 'lefttoright']];
  const got = cases.map(([p, g, want]) => [T.whichMistake(p, g), want]);
  check('a wrong answer is put down to the mistake it really is (52 and 512 for 38 + 24 are different mistakes)', got.every(([x, y]) => x === y), JSON.stringify(got));
  check('61 − 27 = 46 is "took the smaller digit from the bigger"; 44 (borrowed, but the tens kept their ten) is its own mistake', T.whichMistake(P(61, '−', 27), 46) === 'smallbig' && T.whichMistake(P(61, '−', 27), 44) === 'noborrowback', '');
  // every mistake has words in both languages, and its tip never says the answer
  check('every mistake is named in English and Hindi', Object.values(T.MISTAKES).every(m => m.en && /[ऀ-ॿ]/.test(m.hi)), '');
  let tips = 0, leaks = [];
  for(let a = 10; a < 99; a += 3) for(let b = 2; b < 60; b += 7) for(const op of ['+', '−', '×']){
    if(op === '−' && b >= a) continue;
    if(op === '×' && (a > 40 || b > 9)) continue;
    const p = P(a, op, b), ans = op === '+' ? a + b : op === '−' ? a - b : a * b;
    for(const m of T.mistakeAnswers(p)) for(const lang of ['en', 'hi']){
      const tip = T.mistakeTip(m.id, p, lang); tips++;
      const nums = (tip.match(/\d+/g) || []).map(Number);
      if(!tip || (ans >= 10 && nums.includes(ans) && ![a, b].includes(ans))) leaks.push(`${a}${op}${b} ${m.id} ${lang}: ${tip}`);
    }
  }
  check(`the line of help for each mistake (${tips} of them) is there and never says the answer`, tips > 500 && !leaks.length, leaks.slice(0, 3).join(' | '));
  check('a spoken tip says the signs in words and numbers as the caller writes them', /times/.test(T.mistakeTip('tensnotx', P(23, '×', 4), 'en', n => `<${n}>`, true)) && /<20>/.test(T.mistakeTip('tensnotx', P(23, '×', 4), 'en', n => `<${n}>`, true)), T.mistakeTip('tensnotx', P(23, '×', 4), 'en', n => `<${n}>`, true));

  // knowledge tracing
  check('a skill the twin has never seen has no number (not "weak")', T.twinMastery('carry') === null, '');
  for(let i = 0; i < 4; i++) T.twinObserve('add2', true, S, 1 / 3);
  const up = T.twinMastery('add2').now;
  T.twinObserve('add2', false, S, 1 / 3);
  const down = T.twinMastery('add2').now;
  check('right answers raise what the twin thinks the child knows; a wrong one lowers it', up > 0.8 && down < up, `${up} → ${down}`);
  const tw = T.twinOf();
  tw.k.tables = { p: 0.9, at: Date.now() - 20 * DAY, n: 6, days: ['d1'], peak: 0.9 };
  tw.k.bonds10 = { p: 0.9, at: Date.now() - 20 * DAY, n: 6, days: ['d1', 'd2', 'd3', 'd4'], peak: 0.9 };
  const t1 = T.twinMastery('tables').now, b1 = T.twinMastery('bonds10').now;
  check('time away fades a skill — more slowly for one got right on many different days — and never below half', t1 < 0.65 && b1 > t1 && t1 >= 0.45, `${t1.toFixed(2)} vs ${b1.toFixed(2)}`);
  check('a fading skill is noticed', T.twinFading().some(f => f.skill === 'tables'), JSON.stringify(T.twinFading()));
  S.skillHistory.sub2 = { n: 9, right: 8 };
  T.twinObserve('sub2', true, S);
  check("a skill with history from before the twin starts from that history, not from zero", T.twinMastery('sub2').now > 0.8, String(T.twinMastery('sub2').now));

  // habits
  T.twinAnswer('carry', P(38, '+', 24), 52);
  check('one mistake is not yet a habit', T.twinHabit('carry') === null, '');
  T.twinAnswer('carry', P(47, '+', 35), 72);
  check('the same mistake twice lately is a habit', T.twinHabit('carry') && T.twinHabit('carry').id === 'nocarry', JSON.stringify(T.twinHabit('carry')));
  const tmp = twinBox().T;
  tmp.twinAnswer('carry', P(38, '+', 24), 52); tmp.twinAnswer('carry', P(47, '+', 35), 72);
  for(const [a, b] of [[19, 3], [28, 5], [36, 7]]) tmp.twinAnswer('carry', P(a, '+', b), a + b);
  check('three right in a row since: the habit is behind them', tmp.twinHabit('carry') === null, '');
  T.twinAnswer('add10', P(3, '+', 4), 8); T.twinAnswer('add10', P(2, '+', 5), 6);
  check('a one-away slip, even twice, is not a habit of thought', T.twinHabit('add10') === null, '');
  check("Munni's next idea goes at the habit", T.mindNext() && T.mindNext().skill === 'carry' && T.mindNext().why === 'habit', JSON.stringify(T.mindNext()));

  // the guess
  const fresh = twinBox();
  const g0 = fresh.T.twinPredict('carry', P(38, '+', 24), [62, 52, 512, 63]);
  check('knowing nothing yet, the twin guesses the most telling mistake for this question', g0.answer === 52 && g0.pRight < 0.5 && /common:nocarry/.test(g0.why), JSON.stringify(g0));
  const g1 = T.twinPredict('carry', P(29, '+', 46), [75, 65, 615, 76]);
  check("with a habit, it guesses the child's own mistake", g1.answer === 65 && /habit:nocarry/.test(g1.why), JSON.stringify(g1));
  check('a skill the child knows well: it guesses the right answer', T.twinPredict('sub2', P(57, '−', 23), [34, 44, 35]).answer === 34, '');
  fresh.T.twinExpect('k1', 'carry', P(38, '+', 24), [62, 52, 512, 63]);
  const hit = fresh.T.twinCheck('k1', 52, false, false);
  fresh.T.twinExpect('k2', 'carry', P(38, '+', 24), [62, 52, 512, 63]);
  fresh.T.twinCheck('k2', 62, true, true);
  fresh.T.twinExpect('k3', 'carry', P(38, '+', 24), [62, 52, 512, 63]);
  fresh.T.twinCheck('kX', 62, true, false);
  check('the guess is checked after the answer; a helped answer, or another question, keeps nothing', hit === true && fresh.T.twinOf().preds.length === 1, JSON.stringify(fresh.T.twinOf().preds));

  // a simulated child with a habit of thought: always writes the columns side by side when carrying
  const sim = twinBox(), Z = sim.T;
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for(let q = 0; q < 50; q++){
    const carry = q % 2 === 0;
    const a = 10 + Math.floor(rnd() * 6) * 10 + (carry ? 5 + Math.floor(rnd() * 5) : Math.floor(rnd() * 4));
    const b = 10 + Math.floor(rnd() * 3) * 10 + (carry ? 5 + Math.floor(rnd() * 5) : Math.floor(rnd() * 4));
    const p = P(a, '+', b), ans = a + b, skill = carry ? 'carry' : 'add2';
    const ms = Z.mistakeAnswers(p), side = ms.find(m => m.id === 'colsjoin'), drop = ms.find(m => m.id === 'nocarry');
    const opts = carry ? [ans, drop.v, side.v, ans + 1] : [ans, ans + 1, ans - 1, ans + 10];
    Z.twinExpect('q' + q, skill, p, opts);
    const given = carry ? side.v : ans;
    Z.twinCheck('q' + q, given, given === ans, false);
    Z.twinObserve(skill, given === ans, sim.S, 1 / opts.length);
    Z.twinAnswer(skill, p, given);
  }
  const sc = Z.twinScore();
  // a general tutor expects the right answer every time: half of this child's answers
  check("a child with a habit of thought: the twin guesses their exact answers, wrong ones included (≥ 90% lately) — a general tutor expecting the right answer gets half",
    sc && sc.lateRate >= 0.9 && sc.earlyRate != null && sc.earlyRate < sc.lateRate && sc.lateRate > 0.5 + 0.3, JSON.stringify(sc));
  const sm = Z.twinSummary();
  check('the summary: what they know, the habit, and no name or id', sm.knows.includes('add2') && sm.habits.some(h => h.skill === 'carry' && h.id === 'colsjoin') && !/Jai|c-jai-77/.test(JSON.stringify(sm)), JSON.stringify(sm));
}

/* ---------- 1b. mistakes nobody listed, reading and writing, the profile ---------- */
{
  const { T, S } = twinBox();
  const P = (a, op, b) => ({ a, op, b, c: null });
  // documented single wrong steps, worked out by the column engine
  const more = [[P(38, '+', 24), 71, 'carryones'], [P(38, '+', 4), 78, 'misalign'], [P(38, '+', 24), 17, 'adddigits'], [P(8, '+', 5), 12, 'countincl'],
                [P(302, '−', 127), 275, 'zeroborrow'], [P(40, '−', 12), 30, 'zerozero'], [P(47, '−', 20), 20, 'nminus0'], [P(27, '×', 4), 88, 'xnocarry'],
                [P(27, '×', 4), 828, 'xcolsjoin'], [P(27, '×', 4), 168, 'addfirst'], [P(24, '÷', 6), 144, 'divmult'], [P(38, '+', 24), 26, 'reversed']];
  const got = more.map(([p, g, want]) => [T.whichMistake(p, g), want]);
  check('more documented mistakes, from children\'s column work: carrying the ones, lining up on the left, borrowing across a zero, 0 − N = 0, N − 0 = 0, the carry in multiplying, adding all the digits, counting the first number again, reversed digits',
    got.every(([x, y]) => x === y), JSON.stringify(got.filter(([x, y]) => x !== y)));
  // every named mistake has help, an explanation, both languages — and neither ever says the answer
  let leaks = [], n = 0;
  for(let a = 11; a < 400; a += 13) for(let b = 2; b < 90; b += 9) for(const op of ['+', '−', '×', '÷']){
    if(op === '−' && b > a) continue; if(op === '×' && (a > 99 || b > 9)) continue; if(op === '÷' && a % b) continue;
    const p = P(a, op, b), ans = T.mistakeAnswers.length && ({ '+': a + b, '−': a - b, '×': a * b, '÷': a / b })[op];
    for(const m of T.mistakeAnswers(p)) for(const lang of ['en', 'hi']){
      const lines = [T.mistakeTip(m.id, p, lang)].concat(T.mistakeExplain(m.id, p, lang)); n += lines.length;
      for(const l of lines){ const nums = (l.match(/\d+/g) || []).map(Number); if(!l || (ans >= 10 && nums.includes(ans) && ![a, b].includes(ans))) leaks.push(`${a}${op}${b} ${m.id} ${lang}: ${l}`); }
    }
  }
  check(`help and explanations for every mistake (${n} lines) never say the answer`, n > 3000 && !leaks.length, leaks.slice(0, 3).join(' | '));
  check('every mistake is named in English and Hindi', Object.values(T.MISTAKES).concat(Object.values(T.LMISTAKES)).every(m => m.en && /[ऀ-ॿ]/.test(m.hi)), '');

  // a combination nobody listed, confirmed on a DIFFERENT question
  const code = '+|carry=none|out=rev';
  check('an answer no single mistake explains is matched against combinations of wrong steps', T.whichMistake(P(38, '+', 24), 25) === 'other' && T.procMatches(P(38, '+', 24), 25).includes(code), JSON.stringify(T.procMatches(P(38, '+', 24), 25)));
  T.twinAnswer('carry', P(38, '+', 24), 25); T.twinAnswer('carry', P(38, '+', 24), 25);
  check('the same question twice proves nothing (a coincidence stays a coincidence)', !T.twinOf().found[code], JSON.stringify(T.twinOf().found));
  const id = T.twinAnswer('carry', P(47, '+', 35), 27);
  check('the same combination behind a different question: a mistake of this child\'s own, named from its steps, and a habit', id === code && T.twinOf().found[code] &&
    T.twinHabit('carry') && T.twinHabit('carry').id === code && /carry the ten, and writes the answer/.test(T.mistakeLabel(code).en), JSON.stringify(T.twinHabit('carry')));
  check('its help is the help for each of its steps', /carry the ten/.test(T.mistakeTip(code, P(29, '+', 46), 'en')) && /tens first/.test(T.mistakeTip(code, P(29, '+', 46), 'en')), T.mistakeTip(code, P(29, '+', 46), 'en'));
  check('the twin then guesses that very answer (29 + 46 → 56: the carry dropped, the digits reversed)', T.twinPredict('carry', P(29, '+', 46), [75, 65, 56, 76]).answer === 56, JSON.stringify(T.twinPredict('carry', P(29, '+', 46), [75, 65, 56, 76])));
  T.twinAnswer('carry', P(38, '+', 24), 99);
  check('what nothing explains is kept for the shared database: the sum and the answer only', T.twinOf().unexplained.some(u => u.q === '38+24' && u.a === 99), JSON.stringify(T.twinOf().unexplained));
  S.mistakeRules = ['+|align=left|carry=ones'];
  const fresh = twinBox(); fresh.S.mistakeRules = [code];
  check('a combination the shared database says many children make is known from the first time', fresh.T.whichMistake(P(38, '+', 24), 25) === code, fresh.T.whichMistake(P(38, '+', 24), 25));
  check('codes are checked before use: nothing made up runs', !T.procValid('+|carry=evil') && !T.procValid('<script>') && !T.procValid('+|carry=none|carry=ok') && !T.procValid('×|borrow=nodec') && T.procValid(code), '');

  // reading: HOW a word went
  const R = [['भी', 'बी', 'hi', 'aspiration'], ['दिन', 'दीन', 'hi', 'vowelLength'], ['किताब', 'कताब', 'hi', 'matraDropped'], ['मैं', 'मे', 'hi', 'matraSwap'], ['गाँव', 'गाव', 'hi', 'nasal'],
             ['टमाटर', 'तमाटर', 'hi', 'retroflex'], ['शेर', 'सेर', 'hi', 'sibilant'], ['क्या', 'का', 'hi', 'conjunct'], ['स्कूल', 'सकूल', 'hi', 'conjunct'], ['घर', 'धर', 'hi', 'lookalike'],
             ['बड़ा', 'बडा', 'hi', null], ['bed', 'ded', 'en', 'reversal'], ['was', 'saw', 'en', 'reversal'], ['cat', 'cot', 'en', 'vowelEn'], ['cap', 'cape', 'en', 'magicE'], ['jumped', 'jump', 'en', 'ending'], ['elephant', 'egg', 'en', 'guessStart']];
  const rg = R.map(([t, h, l, want]) => [t, (T.wordMistake(t, h, l) || {}).id || null, want]);
  check('reading: how a word went — aspiration, vowel length, a vowel sign left out or swapped, the nasal dot, tongue position, श/ष/स, a half letter dropped or pulled apart, look-alike letters; b/d, was/saw, the vowel, the silent e, endings, guessing from the first letter; a nukta is the recognizer\'s, not the child\'s',
    rg.every(([, x, y]) => x === y), JSON.stringify(rg.filter(([, x, y]) => x !== y)));
  const r = T.gradeReading('मेरा भाई घर गया', 'मेरा बाई घर', 'hi');
  const lm = T.lineMistakes(r.tokens, r.extra, 'hi');
  check('a line: the word\'s slip, and stopping before the end (not "skipped")', lm.some(m => m.id === 'aspiration' && m.word === 'भाई') && lm.some(m => m.id === 'stopped') && !lm.some(m => m.id === 'skipped'), JSON.stringify(lm));
  const r2 = T.gradeReading('the cat sat on the mat', 'the cat sat on on the big mat', 'en');
  check('…and words added', T.lineMistakes(r2.tokens, r2.extra, 'en').some(m => m.id === 'added'), JSON.stringify(T.lineMistakes(r2.tokens, r2.extra, 'en')));
  const tipsOk = Object.keys(T.LMISTAKES).every(id => ['en', 'hi'].every(l => T.langTip({ id, word: 'भी', heard: 'बी', pair: ['भ', 'ब'], rest: 'घर', where: 'top' }, l, 'क').length > 8));
  check('every reading and writing slip has a line of help in both languages; the letters to hear side by side', tipsOk && T.langLetters(T.wordMistake('भी', 'बी', 'hi')).join() === 'भ,ब', '');
  // writing: a traced letter, from pixels
  const W = 60, H = 60, grid = (pts) => { const a = new Uint8ClampedArray(W * H * 4); for(const [x, y] of pts) a[(y * W + x) * 4 + 3] = 255; return a; };
  const shape = []; for(let y = 10; y < 50; y++) shape.push([15, y]); for(let x = 15; x < 45; x++) shape.push([x, 49]);       // an "L"
  const bar = []; for(let x = 10; x < 50; x++) bar.push([x, 10]); for(let y = 10; y < 50; y++) bar.push([30, y]);            // a top line and a stem
  const ink = (G, C, lang) => T.inkMistakes(grid(G), grid(C), W, H, lang, 1).map(m => m.id + (m.where ? ':' + m.where : ''));
  const mirrored = shape.map(([x, y]) => [60 - x, y]);
  const half = shape.filter(([x, y]) => y < 30);
  const noTop = bar.filter(([x, y]) => y > 12);
  const small = shape.map(([x, y]) => [25 + Math.round((x - 15) / 4), 25 + Math.round((y - 10) / 4)]);
  check('writing: a traced letter mirrored, half of it left out (and where), the top line (शिरोरेखा) missing, much too small — and a good trace is none of these',
    ink(shape, mirrored, 'en').includes('mirror') && ink(shape, half, 'en').some(x => /^partMissing:(bottom|right)$/.test(x)) && ink(bar, noTop, 'hi').includes('noShirorekha') &&
    ink(shape, small, 'en').includes('tooSmall') && ink(shape, shape, 'en').length === 0, JSON.stringify([ink(shape, mirrored, 'en'), ink(shape, half, 'en'), ink(bar, noTop, 'hi'), ink(shape, small, 'en'), ink(shape, shape, 'en')]));
  // reading habits in the twin
  T.twinNote('read3', T.lineMistakes(r.tokens, r.extra, 'hi'));
  const r3 = T.gradeReading('भालू भागा', 'बालू भागा', 'hi'); T.twinNote('read3', T.lineMistakes(r3.tokens, r3.extra, 'hi'));
  const rh = T.twinHabit('read3');
  check('the same reading slip twice is a habit, with the letters it is about', rh && rh.id === 'aspiration' && rh.pair && rh.pair[0] === 'भ', JSON.stringify(rh));
  // right-or-not guesses where there's no sum
  T.twinExpect('read:x', 'read3', null, 0.05); T.twinCheck('read:x', null, false, false);
  check('reading, writing, stories and games are guessed too: right or not, and scored', T.twinOf().preds.slice(-1)[0].hit === null && typeof T.twinOf().preds.slice(-1)[0].rw === 'boolean', JSON.stringify(T.twinOf().preds.slice(-1)));
  // the profile
  S.lang = 'hi';
  const prof = T.twinProfile();
  check('the profile: ids only — habits (sums and reading), found combinations, letters to practise, unexplained sums — no name or id', prof.habits.some(h => h.id === code) && prof.habits.some(h => h.id === 'aspiration') &&
    prof.found.includes(code) && prof.letters.includes('भ') && prof.unexplained.some(u => u.sum === '38+24' && u.a === 99) && !/Jai|c-jai-77/.test(JSON.stringify(prof)), JSON.stringify(prof));
  const dirty = T.twinCleanProfile({ v: 9, name: 'Jai', band: 'x', ways: { math: 'hypnosis' }, plans: { carry: 'steps', 'drop table': 'show' }, habits: [{ skill: 'carry', id: '<b>' }, { skill: 'carry', id: 'nocarry' }],
    letters: ['भ', '<img>', 'abcdef'], found: ['+|carry=none', 'rm -rf'], unexplained: [{ sum: 'hello', a: 1 }, { sum: '3+4', a: 9 }], extra: 'x' });
  check('a profile from anywhere is reduced to what one may hold (unknown keys, ways, mistakes, letters and sums dropped)', !('name' in dirty) && !('extra' in dirty) && dirty.ways.math === null &&
    Object.keys(dirty.plans).join() === 'carry' && dirty.habits.length === 1 && dirty.letters.join() === 'भ' && dirty.found.join() === '+|carry=none' && dirty.unexplained.length === 1, JSON.stringify(dirty));
  const pr = T.twinPrompt(prof);
  check('the profile as a few sentences for a model: the mistakes, the letters, the language — and how to speak; no name', /Keeps making this mistake/.test(pr) && /भ/.test(pr) && /Hindi/.test(pr) && /never say "wrong"/.test(pr) && !/Jai/.test(pr), pr);
}

/* ---------- 2. the voice server ---------- */
{
  const brain = createBrain({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-twin-')), env: { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata' } });
  const kid = brain.registerChild({ name: 'Jai', age: 8, lang: 'hi', parent_phone: '+919500000088', consent: true }).child;
  const s = brain.createSession(kid.id, { channel: 'app', kind: 'lesson' }).session;
  brain.toolNext(s.id);
  const live = brain.store.get('sessions', s.id);
  const it = live.items[live.items.length - 1];
  Object.assign(it, { kind: 'math', expect: 'number', skill: 'carry', problem: '38 + 24', answer: 62, distractor: 61, attempts: 0, said: [], prompts: ['अड़तीस और चौबीस?'] });
  brain.store.put('sessions', s.id, live);
  const t = brain.toolAnswer(s.id, 'बावन');
  const after = brain.store.get('sessions', s.id), item = after.items.find(x => x.problem === '38 + 24');
  check('a wrong sum on a call: the clue goes at its mistake, and offers the child\'s own answer against the right one',
    /दहाई/.test(t.say) && /बावन/.test(t.say) && /बासठ/.test(t.say) && item.mistake === 'nocarry' && item.choices.includes(52), t.say);
  const tw = brain.getChild(kid.id).profile.twin;
  check('…and the mistake is kept in the child\'s twin on the server', tw && (tw.recent.carry || []).some(x => x.id === 'nocarry'), JSON.stringify(tw && tw.recent));
  const h1 = brain.createSession(kid.id, { channel: 'app', kind: 'help', help: { kind: 'math', a: 38, b: 24, op: '+', mistake: 'nocarry' } }).session;
  const s1 = brain.toolNext(h1.id).say;
  const h2 = brain.createSession(kid.id, { channel: 'app', kind: 'help', help: { kind: 'math', a: 38, b: 24, op: '+', mistake: 'lefttoright' } }).session;
  const s2 = brain.toolNext(h2.id).say;
  const h3 = brain.createSession(kid.id, { channel: 'app', kind: 'help', help: { kind: 'math', a: 38, b: 24, op: '+', mistake: '<say something>' } }).session;
  const s3 = brain.toolNext(h3.id).say;
  check('a help call warns about the habit first, in the server\'s own words', /ध्यान रखना/.test(s1) && /दहाई/.test(s1), s1);
  check('…only for a known mistake this very question can produce', !/ध्यान रखना/.test(s2) && !/ध्यान रखना/.test(s3) && !/say something/.test(s3), s2 + ' | ' + s3);

  // the app's profile teaches the phone lesson the app's way
  const levelLines = brain.core.withChild(brain.getChild(kid.id).profile, { lang: 'hi' }, TT => TT.ageSentences('hi', TT.S.levels.read)).out;
  const letter = ['भ', 'ध', 'घ', 'ठ', 'छ', 'फ'].find(x => levelLines.some(l => l.includes(x)) && !levelLines.every(l => l.includes(x)));
  const prof = { v: 1, lang: 'hi', band: 'developing', ways: { math: 'steps', read: null }, plans: { carry: 'steps' }, habits: [{ skill: 'carry', id: 'nocarry' }, { skill: 'read3', id: 'aspiration' }], fading: [], working: [], knows: [], found: [], letters: [letter], unexplained: [], at: new Date().toISOString() };
  const ps = brain.createSession(kid.id, { channel: 'app', kind: 'lesson', profile: prof, seed: 'twin-1' }).session;
  check('a call with the app\'s profile: the first free sum goes at the habit, said as practice together', ps.slots.includes('twin') && ps.twin_skill === 'carry' && ps.profile.habits.length === 2, JSON.stringify(ps.slots));
  check('…and a reading line has the letter the child keeps slipping on', !!letter && ps.lines.some(l => l.includes(letter)), letter + ' ' + JSON.stringify(ps.lines));
  let tt = brain.toolNext(ps.id), guard = 0;
  while(!/अभ्यास कर रहे हैं/.test(tt.say) && !tt.done && guard++ < 12){ const cur = brain.store.get('sessions', ps.id); const it2 = cur.items[cur.items.length - 1]; tt = brain.toolAnswer(ps.id, it2.expect === 'number' ? String(it2.answer) : it2.expect === 'reading' ? it2.target : 'हाँ'); }
  const cur = brain.store.get('sessions', ps.id), tw2 = cur.items[cur.items.length - 1];
  check('…the twin\'s sum is that skill', tw2.twin && tw2.skill === 'carry' && /अभ्यास कर रहे हैं/.test(tt.say), tt.say);
  const wrongA = tw2.answer - 10;
  const c1 = brain.toolAnswer(ps.id, String(wrongA)).say;
  check('…a slip that is the known habit: "I know this tricky bit!" and the help for it', /मुश्किल हिस्सा मुझे पता है/.test(c1) && /दहाई/.test(c1), c1);
  const c2 = brain.toolAnswer(ps.id, String(wrongA)).say;
  check('…and the reveal, for a child taught step by step, goes step by step', /दहाई|इकाई/.test(c2) && /जवाब है/.test(c2), c2);
  const afterCall = brain.store.get('sessions', ps.id);
  check('a call guesses too: before each sum, the twin\'s guess in the call\'s trace, checked on the first answer and kept in the child\'s record', afterCall.trace.some(t => /^Twin · expects/.test(t)) && afterCall.trace.some(t => /^Twin · guessed/.test(t)) &&
    (brain.getChild(kid.id).profile.twin.preds || []).some(p => p.call), afterCall.trace.filter(t => /Twin/.test(t)).join(' | '));
  const res = require('../voice/web').createWeb(brain, {}).result;
  afterCall.processed = true; afterCall.web_token = 'tk'; brain.store.put('sessions', ps.id, afterCall);
  const recs = res(ps.id, 'tk').body.records;
  check('a talk\'s results carry which mistake each first answer was, for the app\'s twin', recs.some(r => r.mistake === 'nocarry' && r.problem), JSON.stringify(recs).slice(0, 300));
  // reading on a call: the slip named
  const rs = brain.createSession(kid.id, { channel: 'app', kind: 'lesson', seed: 'twin-2' }).session;
  brain.toolNext(rs.id);
  const rl = brain.store.get('sessions', rs.id), ri = rl.items[rl.items.length - 1];
  Object.assign(ri, { kind: 'read', expect: 'reading', target: 'मेरा भाई घर गया।', attempts: 0, said: [], prompts: ['पढ़ो'] });
  brain.store.put('sessions', rs.id, rl);
  const rsay = brain.toolAnswer(rs.id, 'मेरा बाई घर गया').say;
  check('reading on a call: the coaching names HOW the word slipped (the puff of air in भ)', /हवा/.test(rsay) && /भाई/.test(rsay), rsay);

}

/* ---------- 2b. the shared mistakes database ---------- */
const sharedDb = (async () => {
  const brain = createBrain({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-twindb-')), env: { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_MISTAKE_MIN_CHILDREN: '3' } });
  const code = '+|carry=none|out=rev';
  const profile = n => ({ v: 1, lang: 'hi', ways: {}, plans: {}, habits: [], fading: [], working: [], knows: [], found: [code], letters: [], unexplained: [{ sum: '38+24', a: 99 }], at: new Date().toISOString() });
  const out = [];
  for(let i = 0; i < 3; i++) out.push(await brain.circle.sync({ child: { id: 'kid' + i + 'xyz', name: 'Tiger', age: 7, lang: 'hi' }, consent: { sync: true }, progress: { seq: 1 }, profile: profile(i) }, '10.0.0.' + i));
  const after2 = out[1].body.mistake_rules, after3 = out[2].body.mistake_rules;
  check('the shared database: a combination two children share is not yet known everywhere; in three children it is promoted and goes down every sync', !after2.includes(code) && after3.includes(code), JSON.stringify([after2, after3]));
  const rev = brain.mistakes.review();
  check('…counted by children, never names; the unexplained sums are there for the team to look at', rev.codes[0].children === 3 && rev.unexplained[0].sum === '38+24=99' && rev.unexplained[0].children === 3 && !/kid0|Tiger/.test(JSON.stringify(rev)), JSON.stringify(rev).slice(0, 300));
  const sv = brain.getChild('app_kid0xyz');
  check('the app\'s profile is kept, checked, for that child\'s phone lessons', sv.circle.app_profile && sv.circle.app_profile.found.includes(code), JSON.stringify(sv.circle.app_profile));
  // a phone lesson's mistakes and guesses come back to the app with the next sync
  const svp = brain.getChild(sv.id);
  brain.core.withChild(svp.profile, { lang: 'hi' }, TT => { TT.twinAnswer('carry', { a: 38, b: 24, op: '+' }, 52); TT.twinOf().preds.push({ at: Date.now(), skill: 'carry', hit: true, rw: true, call: true }); });
  brain.store.put('children', svp.id, svp);
  const syncAgain = seq => brain.circle.sync({ child: { id: 'kid0xyz', name: 'Tiger', age: 7, lang: 'hi' }, key: out[0].body.key, consent: { sync: true }, progress: { seq } }, '10.0.0.9');
  const back = (await syncAgain(2)).body, back2 = (await syncAgain(3)).body;
  check('mistakes and guesses from phone lessons come down with the sync — once', (back.twin_far || []).some(f => f.skill === 'carry' && f.id === 'nocarry' && f.q === '38+24') && (back.twin_guesses || []).length === 1 && !back2.twin_far && !back2.twin_guesses,
    JSON.stringify([back.twin_far, back.twin_guesses, back2.twin_far]));
  const key0 = out[0].body.key;
  brain.circle.leave({ child: { id: 'kid0xyz' }, key: key0, erase: true });
  check('an erased child leaves every count', brain.mistakes.review().codes[0].children === 2 && !brain.mistakes.promoted().includes(code), JSON.stringify(brain.mistakes.review().codes));
  const page = require('../voice/pages').mistakesPage(brain.mistakes.review(), 'k');
  check('the team\'s review page shows the combinations in words and the unexplained sums', /writes the answer/.test(page) && /38\+24=99/.test(page), '');
})();

/* ---------- 3. the real app ---------- */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const appServer = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const full = path.join(root, clean === '/' ? 'index.html' : clean);
  fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
});
const wait = ms => new Promise(r => setTimeout(r, ms));
appServer.listen(0, '127.0.0.1', async () => {
  const vc = new VirtualConsole(); const jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      w.SpeechSynthesisUtterance = function(t){ this.text = t; };
      w.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
      w.navigator.vibrate = () => {};
    } });
  const w = dom.window, E = c => w.eval(c), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const screen = () => $('#screen').textContent;
  await new Promise(r => w.addEventListener('load', r));
  try{ await sharedDb; }catch(e){ check('the shared database run finished', false, e.stack); }
  try{
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    $$('.ob-av')[0].click(); $$('.ob-cakebtn')[5].click(); $('.ob-go').click();
    E(`S.game = S.game || 'cricket'; S.name = 'Jai'; mindOf().plan.carry = { way: 'show', since: Date.now(), fails: 0 }`);

    const sum = (a, b, opts) => { E(`go('math'); S.ctx = { p: { a: ${a}, b: ${b}, op: '+', ans: ${a + b}, opts: ${JSON.stringify(opts)} } }; render()`); };
    sum(38, 24, [62, 52, 512, 63]);
    check('Counting Stones: the twin guesses before the answer (in the trace, never shown to the child)', E(`TWIN_EXP && TWIN_EXP.key`) === 'math:38+24' && !/expects/.test(screen()), E(`JSON.stringify(TWIN_EXP)`));
    $$('.opt').find(b => b.textContent.trim() === '52').click();
    check('a wrong answer gets the line of help for its mistake', /carry the ten/.test(screen()) && !/noticed/.test(screen()) && E(`S.twin.preds.length`) === 1, screen().slice(-300));
    sum(47, 35, [82, 72, 712, 83]);
    $$('.opt').find(b => b.textContent.trim() === '72').click();
    check('the same mistake again: "Munni noticed this happened before"', /Munni noticed/.test(screen()) && E(`twinHabit('carry').id`) === 'nocarry', screen().slice(-300));

    // Ask Munni on a carrying sum: a warning about the habit, and a call would carry it
    sum(29, 46, [75, 65, 615, 76]);
    E(`askMunni()`);
    const panel = E(`ASK.lines.join(' | ')`);
    check('a mistake this child keeps making decides Ask Munni\'s explanation: straight at it, then the question', /^Watch out: First the ones/.test(panel) && /one ten joins the tens/.test(panel) && /So, what is 29 and 46\?$/.test(panel) && !/29 is 20 and 9/.test(panel) && E(`ASK.call.mistake`) === 'nocarry', panel.slice(0, 400));
    const before = E(`JSON.stringify([S.twin.preds.length, S.twin.recent.carry.length])`);
    $$('.opt').find(b => b.textContent.trim() === '65').click();
    check('an answer after help teaches the twin nothing (no guess scored, no mistake kept)', E(`JSON.stringify([S.twin.preds.length, S.twin.recent.carry.length])`) === before, before);
    E(`askClose()`);

    // the Reading Tree: HOW a word slipped, the letters to hear, then a heads-up
    E(`S.lang = 'hi'; go('read'); S.ctx = { sentence: 'मेरा भाई घर गया।' }; render()`);
    check('the Reading Tree guesses before the child reads', E(`TWIN_EXP && TWIN_EXP.key`) === 'read:मेरा भाई घर गया।', E(`JSON.stringify(TWIN_EXP)`));
    E(`checkRead('मेरा बाई घर गया')`);
    const rd = screen();
    check('a reading slip gets help aimed at it (the puff of air in भ), with the two letters to hear', /हवा/.test(rd) && $$('.mindchunks .chip').some(b => b.textContent.includes('भ')) && E(`S.twin.preds.slice(-1)[0].hit`) === null, rd.slice(-300));
    E(`S.ctx = { sentence: 'भालू भागा।' }; render(); checkRead('बालू भागा')`);
    check('the same slip again: "Munni noticed"', /मुन्नी ने देखा/.test(screen()), screen().slice(-300));
    E(`S.ctx = { sentence: 'भूरा कुत्ता भागा।' }; render()`);
    check('…and before the next line with भ, a word of warning first (the habit decides what Munni says)', /इस पंक्ति में भ है/.test(screen()), screen().slice(0, 300));
    E(`S.lang = 'en'`);
    // paper writing: spelling slips, the same word checks
    E(`S.screen = 'write'; S.ctx = { mode: 'paper', line: 'मेरी किताब', shot: 'x', verdict: { ink: true } }; S.camOk = true; S.lang = 'hi'; render(); submitPaper('मेरी कताब')`);
    check('paper writing: a spelling slip is named (a vowel sign left out) and kept for writing', /मात्रा/.test(screen()) && E(`(S.twin.recent['write' + S.levels.write] || []).some(x => x.id === 'matraDropped')`), screen().slice(-300));
    E(`S.lang = 'en'`);
    // a story lesson and a game are guessed too
    E(`const mathy = (l, i) => l.beats[i].t === 'ask' && (explainLessonBeat(l, i) || {}).op; const les = lessonBank().find(l => l.beats.some((b, i) => mathy(l, i))); go('lessons'); startLesson(les.id); S.lesson.i = les.beats.findIndex((b, k) => mathy(les, k)); render()`);
    check('a story lesson\'s question is guessed (the exact answer when there\'s a sum underneath)', /^lesson:/.test(E(`TWIN_EXP && TWIN_EXP.key`) || '') && E(`TWIN_EXP.answer`) != null, E(`JSON.stringify(TWIN_EXP)`));
    E(`go('map'); playGame('pop')`);
    check('a game\'s item is guessed (right or not)', /^game:pop:/.test(E(`TWIN_EXP && TWIN_EXP.key`) || ''), E(`JSON.stringify(TWIN_EXP)`));
    E(`gameAnswer(true)`);
    check('…and checked when it is answered', E(`S.twin.preds.slice(-1)[0].skill`) != null && /^game:pop:1/.test(E(`TWIN_EXP && TWIN_EXP.key`) || ''), E(`JSON.stringify(S.twin.preds.slice(-1))`));
    // a game with a sum underneath: the picked answer is named like any other
    E(`go('map'); playGame('tower'); const it = gameCurrent(); const lid = it.id.split(':'); const les = lessonBank().find(l => l.id === lid[0]); window.__gq = twinLessonQ(les, Number(lid[1]))`);
    const gq = E(`JSON.stringify(window.__gq)`);
    if(E(`!!(window.__gq && window.__gq.p)`)){
      E(`const p = window.__gq.p; const ms = mistakeAnswers(p); const before = (S.twin.recent[window.__gq.skill] || []).length; window.__gm = ms[0]; gameAnswer(false, String(ms[0].v)); window.__gafter = (S.twin.recent[window.__gq.skill] || []).slice(-1)[0]`);
      check('a game\'s picked answer is named as its mistake too (the sum under the item)', E(`window.__gafter && window.__gafter.id`) === E(`window.__gm.id`), gq + ' ' + E(`JSON.stringify(window.__gafter)`));
    } else {
      E(`const les = lessonBank().find(l => l.beats.some((b, i) => b.t === 'ask' && (explainLessonBeat(l, i) || {}).op)); const i = les.beats.findIndex((b, k) => b.t === 'ask' && (explainLessonBeat(les, k) || {}).op); window.__gm = mistakeAnswers(twinLessonQ(les, i).p)[0]; twinGameAnswer({ id: les.id + ':' + i, skills: [] }, false, String(window.__gm.v))`);
      check('a game\'s picked answer is named as its mistake too (the sum under the item)', E(`JSON.stringify(S.twin.recent)`).includes(E(`window.__gm.id`)), E(`JSON.stringify(window.__gm)`));
    }
    // mistakes and guesses from Munni's calls join the app's twin, never twice
    E(`twinFar([{ skill: 'sub2', id: 'smallbig', q: '61−27', at: Date.now() }, { skill: 'sub2', id: 'smallbig', q: '61−27', at: Date.now() + 1000 }, { skill: 'sub2', id: '<evil>', q: 'x' }]); twinFarGuesses([{ skill: 'sub2', hit: true, rw: true, at: 12345 }, { skill: 'sub2', hit: true, rw: true, at: 12345 }])`);
    check('mistakes and guesses from Munni\'s calls join the app\'s twin — checked, and never counted twice', E(`S.twin.recent.sub2.filter(r => r.far && r.id === 'smallbig').length`) === 1 && !E(`JSON.stringify(S.twin.recent)`).includes('evil') && E(`S.twin.preds.filter(p => p.at === 12345).length`) === 1, E(`JSON.stringify([S.twin.recent.sub2, S.twin.preds.length, S.twin.preds.filter(p => p.at === 12345)])`));
    E(`go('map')`);
    // the live number stands in for the counts in decisions
    E(`for(let i = 0; i < 5; i++) noteSkillAttempt('tables', i % 2 === 0)`);
    check('the teacher\'s diagnostic reads the twin\'s live number, not the raw counts, for this phone\'s evidence', E(`(appEvidence('tables') || {}).mastery`) != null, E(`JSON.stringify(appEvidence('tables'))`));
    // the profile goes where a parent allowed, and to the on-device model
    const srcOf = f => fs.readFileSync(path.join(root, f), 'utf8');
    check('the profile goes with a talk or help call (Talking Munni\'s switch), to the on-device model\'s prompt, and to Tier 2 only when a parent shared progress',
      /profile: twinProfile\(\)/.test(srcOf('src/ui/talk-munni.js')) && /twinPrompt\(twinProfile\(\)\)/.test(srcOf('src/core/tier1.js')) && /\(S\.circleSync \|\| S\.talkMunni\) && typeof twinPrompt/.test(srcOf('src/ui/handlers.js')), '');

    // the parent reads it
    E(`S.parentPin = '1234'; go('parent')`);
    const en = screen();
    check('the parent dashboard: how well Munni knows how Jai thinks, and the mistake she keeps seeing', /How well Munni knows how Jai thinks/.test(en) && /HOW JAI LEARNS/.test(en) && /Forgets to carry the ten/.test(en) && /exactly this mistake/.test(en), en.slice(en.indexOf('HOW WELL'), en.indexOf('HOW WELL') + 500));
    E(`S.lang = 'hi'; render()`);
    const hi = screen();
    check('…in Hindi too, with reading slips and the right-or-not guesses', /सोच को कितना जानती है/.test(hi) && /हासिल वाली दहाई/.test(hi) && /हवा वाले और सादे अक्षर/.test(hi) && /सही होगा या नहीं/.test(hi), hi.slice(hi.indexOf('सोच'), hi.indexOf('सोच') + 600));
    E(`S.lang = 'en'`);

    const src = fs.readFileSync(path.join(root, 'src/ui/circle.js'), 'utf8');
    const body = src.slice(src.indexOf('const body = {'), src.indexOf('const sent ='));
    check("the circle's sync carries the twin's checked profile, never the twin or the mind themselves", !/S\.twin|S\.mind|twinOf/.test(body) && /profile: twinProfile\(\)/.test(body), '');
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the run finished', false, e.stack); }
  console.log('\n' + '-'.repeat(70));
  for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '\n        ' + String(c.detail).slice(0, 500)}`);
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exit(failures ? 1 : 0);
});
