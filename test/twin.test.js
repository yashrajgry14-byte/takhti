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
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/mind.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/twin.js'), 'utf8') + `;this.T = { MISTAKES, mistakeAnswers, whichMistake, mistakeTip, twinOf, twinMastery, twinObserve, twinAnswer, twinHabit, twinPredict, twinExpect, twinCheck, twinScore, twinFading, twinSummary, mindNext };`, ctx);
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
}

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
    check('Ask Munni warns about the mistake this child keeps making, before she asks', /Watch out: .*carry the ten[^|]*\| So, what is 29 and 46\?$/.test(panel) && E(`ASK.call.mistake`) === 'nocarry', panel.slice(0, 400));
    const before = E(`JSON.stringify([S.twin.preds.length, S.twin.recent.carry.length])`);
    $$('.opt').find(b => b.textContent.trim() === '65').click();
    check('an answer after help teaches the twin nothing (no guess scored, no mistake kept)', E(`JSON.stringify([S.twin.preds.length, S.twin.recent.carry.length])`) === before, before);
    E(`askClose()`);

    // the parent reads it
    E(`S.parentPin = '1234'; go('parent')`);
    const en = screen();
    check('the parent dashboard: how well Munni knows how Jai thinks, and the mistake she keeps seeing', /HOW WELL MUNNI KNOWS HOW JAI THINKS/.test(en) && /Forgets to carry the ten/.test(en) && /exactly this mistake/.test(en), en.slice(en.indexOf('HOW WELL'), en.indexOf('HOW WELL') + 500));
    E(`S.lang = 'hi'; render()`);
    const hi = screen();
    check('…in Hindi too', /सोच को कितना जानती है/.test(hi) && /हासिल वाली दहाई/.test(hi), hi.slice(hi.indexOf('सोच'), hi.indexOf('सोच') + 300));
    E(`S.lang = 'en'`);

    const src = fs.readFileSync(path.join(root, 'src/ui/circle.js'), 'utf8');
    const body = src.slice(src.indexOf('const body = {'), src.indexOf('const sent ='));
    check("nothing of the twin is in the circle's sync", !/twin|mind/.test(body), '');
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the run finished', false, e.stack); }
  console.log('\n' + '-'.repeat(70));
  for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '\n        ' + String(c.detail).slice(0, 500)}`);
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exit(failures ? 1 : 0);
});
