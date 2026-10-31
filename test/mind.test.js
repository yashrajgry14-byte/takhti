/* ==================================================================
   MIND — how this child learns (core/mind.js, ui/mind-ui.js)

   vm: the learning itself — a teaching round settles on the child's own
   answers; a way that keeps not sticking is replaced and cooled; a plan
   holds while it works; a new topic leans on what has worked across the
   subject; Thompson sampling ends up preferring what works for THIS child
   (two simulated children who learn differently get different plans); a
   low school mark switches the way and makes that topic the focus.

   jsdom (the real app): a missed sum is taught the child's way (objects,
   steps, or "Munni's idea" for a story); helped answers never count;
   the Reading Tree offers the child's way (Munni reads first, or hard
   words in pieces); the parent types a school mark and sees the change
   and why, in Hindi and English; "Munni's idea" appears on the map; a
   class test from the circle arrives and is applied once; nothing of the
   mind is in the circle's sync.

   vm + HTTP: a teacher's class-test marks on the class page reach each
   child's record and make a low-mark topic next week's step.
   ================================================================== */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }
const root = path.resolve(__dirname, '..');

/* ---------- 1. the learning, in a vm ---------- */
function mindBox(seed){
  const ctx = { S: { name: 'Jai' }, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/mathgen.js'), 'utf8').split('/* ---------------- free-practice')[0].replace(/^[\s\S]*?const SKILL_OPS/m, 'var SKILL_OPS'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/core/mind.js'), 'utf8') + `;this.M = { mindOf, mindChoose, mindTaught, mindAttempt, mindAssessment, mindNext, mindBest, mindSubject, skillOfProblem, setRand: f => { mindRand = f; }, WAYS };`, ctx);
  let t = seed || 1; ctx.M.setRand(() => { t = (t * 16807) % 2147483647; return t / 2147483647; });
  return ctx;
}
{
  const { M, S } = mindBox(7);
  check('free-practice sums map to the skill they exercise', M.skillOfProblem({ a: 38, b: 24, op: '+' }) === 'carry' && M.skillOfProblem({ a: 52, b: 27, op: '−' }) === 'borrow' &&
    M.skillOfProblem({ a: 3, b: 4, op: '+' }) === 'add10' && M.skillOfProblem({ a: 7, b: 6, op: '×' }) === 'tables', '');
  const first = M.mindChoose('carry');
  check('a plan holds while nothing says otherwise', M.mindChoose('carry') === first && M.mindChoose('carry') === first, first);
  // two rounds that don't stick → the way changes, the old one cools
  for(let r = 0; r < 2; r++){ M.mindTaught('carry', first); M.mindAttempt('carry', false); M.mindAttempt('carry', false); }
  const m = M.mindOf();
  const now = M.mindChoose('carry');
  check("two rounds that didn't stick: the way of teaching changes, and the change is recorded with why",
    now !== first && m.changes[0] && m.changes[0].from === first && m.changes[0].to === now && /didn't stick/.test(m.changes[0].why.en) && /बात नहीं बनी/.test(m.changes[0].why.hi), JSON.stringify(m.changes[0]));
  check('…and the old way is cooled for a week', m.cool.carry[first] > Date.now() + 6 * 864e5, '');
  // a round that sticks keeps the plan
  M.mindTaught('carry', now); M.mindAttempt('carry', true); M.mindAttempt('carry', true);
  check('a round that sticks keeps the plan and counts for that way', M.mindChoose('carry') === now && m.arms.carry[now].a === 1, JSON.stringify(m.arms.carry));
  // an answer with no teaching round open changes nothing
  const before = JSON.stringify(m.arms);
  M.mindAttempt('carry', false);
  check('answers outside a teaching round change nothing', JSON.stringify(m.arms) === before, '');
  // a school mark under half switches at once and makes it the focus
  M.mindChoose('borrow');
  const was = m.plan.borrow.way;
  M.mindAssessment({ skill: 'borrow', got: 3, of: 10, by: 'parent' });
  check('a school mark under half: the way changes at once, and the topic becomes the focus',
    m.plan.borrow && m.plan.borrow.way !== was && /3/.test(m.changes[0].why.en) && M.mindNext().skill === 'borrow' && S.assessments.length === 1, JSON.stringify(m.changes[0]));
  check('…the same mark twice is kept once; a nonsense mark is refused', !M.mindAssessment({ id: S.assessments[0].id, skill: 'borrow', got: 3, of: 10 }) &&
    !M.mindAssessment({ skill: 'borrow', got: 12, of: 10 }) && !M.mindAssessment({ skill: 'shapes', got: 1, of: 2 }), '');
}
{
  // two simulated children: one learns from stories, one from steps
  const sim = (good) => {
    const { M } = mindBox(11);
    let r = 3; const rnd = () => { r = (r * 48271) % 2147483647; return r / 2147483647; };
    const skills = ['add10', 'sub10', 'add2', 'carry', 'sub2', 'borrow', 'tables'];
    for(let round = 0; round < 70; round++){
      const sk = skills[round % skills.length];
      const way = M.mindChoose(sk);
      M.mindTaught(sk, way);
      const p = way === good ? 0.85 : 0.3;
      for(let k = 0; k < 3; k++) M.mindAttempt(sk, rnd() < p);
    }
    return M;
  };
  const a = sim('story'), b = sim('steps');
  const ba = a.mindBest('math'), bb = b.mindBest('math');
  check('a child who learns from stories ends up taught with stories; one who learns step by step, with steps',
    ba && ba.way === 'story' && bb && bb.way === 'steps', JSON.stringify([ba, bb]));
  // a brand-new topic leans on the subject: the story child's first plan for a new skill is (usually) a story
  let storyFirst = 0;
  for(let k = 0; k < 20; k++){ const s = 'mult2x1'; const m = a.mindOf(); delete m.plan[s]; if(a.mindChoose(s) === 'story') storyFirst++; }
  check('a topic never taught before starts from what has worked across the subject', storyFirst >= 12, storyFirst + '/20');
}

/* ---------- 2. teacher marks on the server ---------- */
const { createBrain } = require('../voice/brain');
{
  const brain = createBrain({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-mind-')), env: { TAKHTI_QUIET_HOURS: '0-0' } });
  const school = brain.createSchool({ name: 'S' }).school;
  brain.registerTeacher({ name: 'Sunita', phone: '+919500000301', class_codes: ['CLS3A1'], school_id: school.id });
  const kid = brain.registerChild({ name: 'Riya', age: 8, lang: 'hi', parent_phone: '+919500000302', consent: true, school_id: school.id }).child;
  const kid2 = brain.registerChild({ name: 'Om', age: 8, lang: 'hi', parent_phone: '+919500000303', consent: true, school_id: school.id }).child;
  for(const k of [kid, kid2]){ const r = brain.getChild(k.id); r.profile.classCode = 'CLS3A1'; brain.store.put('children', r.id, r); }
  const C = brain.circle;
  C.focusFor(brain.getChild(kid.id));
  const r = C.recordMarks('CLS3A1', 'borrow', 10, { [kid.id]: '3', [kid2.id]: '9' }, 'Sunita');
  const riya = brain.getChild(kid.id), om = brain.getChild(kid2.id);
  check("a teacher's class-test marks reach each child's record", r.ok && r.children === 2 && riya.assessments[0].got === 3 && om.assessments[0].got === 9, JSON.stringify(r));
  check('under half marks: that topic is next week\'s step, said kindly in both languages', C.focusFor(riya).skill === 'borrow' && C.focusFor(riya).source === 'school test' &&
    /new way/.test(C.focusFor(riya).why.en) && /नए तरीक़े/.test(C.focusFor(riya).why.hi), JSON.stringify(C.focusFor(riya)));
  check('…a good mark doesn\'t', C.focusFor(om).source !== 'school test', C.focusFor(om).source);
  check('the marks travel to the app with the circle', (C.view(riya, 'app').assessments || []).some(a => a.skill === 'borrow' && a.got === 3), '');
  check('a mark that isn\'t a number, or more than the total, is skipped', C.recordMarks('CLS3A1', 'borrow', 10, { [kid.id]: '12', [kid2.id]: 'x' }, 'S').children === 0, '');
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
  const spoken = [];
  const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      w.SpeechSynthesisUtterance = function(t){ this.text = t; };
      w.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => { spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 0); } };
      w.navigator.vibrate = () => {};
    } });
  const w = dom.window, E = c => w.eval(c), $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const screen = () => $('#screen').textContent;
  await new Promise(r => w.addEventListener('load', r));
  try{
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    $$('.ob-av')[0].click(); $$('.ob-cakebtn')[5].click(); $('.ob-go').click();
    E(`S.game = S.game || 'cricket'; go('map')`);
    check('a new child: no "Munni\'s idea" yet (nothing to go on)', !/Munni's idea|मुन्नी का आइडिया/.test(screen()), '');

    // a missed sum, taught the child's way: plan says steps
    E(`S.mind = null; mindOf().plan.carry = { way: 'steps', since: Date.now(), fails: 0 }; go('math'); S.ctx = { p: { a: 38, b: 24, op: '+', ans: 62, opts: [62, 52, 72, 61] } }; render()`);
    E(`answerMath(52)`);
    for(let i = 0; i < 300 && !(E('ASK') && !E('ASK.playing')); i++) await wait(25);
    const panel = ($('#askpanel') || {}).textContent || '';
    if(process.env.DBG) console.log('DBG', E('JSON.stringify({i: ASK && ASK.i, n: ASK && ASK.lines.length, playing: ASK && ASK.playing, lines: ASK && ASK.lines})'));
    check('plan "step by step": a missed sum opens Munni\'s steps, ending with the answer', /62/.test(panel) && /30/.test(panel) && E(`S.mind.pending.carry && S.mind.pending.carry.way`) === 'steps', panel.slice(0, 200));
    E(`askClose(); nextProblem(); S.ctx = { p: { a: 47, b: 35, op: '+', ans: 82, opts: [82, 72, 92, 81] } }; render(); answerMath(82)`);
    E(`nextProblem(); S.ctx = { p: { a: 29, b: 13, op: '+', ans: 42, opts: [42, 32, 52, 41] } }; render(); answerMath(42)`);
    check('the child\'s next two answers on their own settle the round: it stuck', E(`S.mind.arms.carry.steps.a`) === 1 && !E(`S.mind.pending.carry`), E(`JSON.stringify(S.mind.arms)`));
    // helped answers never count
    E(`mindTaught('carry','show'); nextProblem(); S.ctx = { p: { a: 38, b: 24, op: '+', ans: 62, opts: [62, 52, 72, 61] } }; render(); S.ctx.helped = true; answerMath(52)`);
    check('an answer after Ask Munni never counts for or against a way', E(`S.mind.pending.carry.n`) === 0, E(`JSON.stringify(S.mind.pending)`));
    // plan says story → Munni's idea button
    E(`askClose(); S.mind.plan.borrow = { way: 'story', since: Date.now(), fails: 0 }; nextProblem(); S.ctx = { p: { a: 52, b: 27, op: '−', ans: 25, opts: [25, 35, 15, 24] } }; render(); answerMath(35)`);
    const idea = $$('button').find(b => /mindGoWay\('borrow','story'\)/.test(b.getAttribute('onclick') || ''));
    check('plan "a story": a missed sum offers "Munni\'s idea: let\'s learn this with a story"', !!idea && /story|कहानी/.test(idea.textContent), screen().slice(-200));
    idea.click();
    await wait(300);
    check('…which opens a story lesson for that topic, and labels it as teaching by story', E(`S.screen`) === 'lessons' && !!E(`S.lesson`) && E(`S.mind.pending.borrow && S.mind.pending.borrow.way`) === 'story', E(`S.screen`));
    E(`endLesson()`);

    // the Reading Tree, the child's way
    E(`S.mind.plan[readSkill()] = { way: 'chunks', since: Date.now(), fails: 0 }; go('read'); S.ctx = { sentence: 'मेरी बहन के पास बस्ता है।' }; render()`);
    check('plan "words in pieces": the hard words of the line are shown in pieces', $$('.mindchunks .chip').length >= 1 && /·/.test($('.mindchunks').textContent), ($('.mindchunks') || {}).textContent);
    const n0 = spoken.length;
    E(`S.mind.plan[readSkill()] = { way: 'model', since: Date.now(), fails: 0 }; S.ctx = { sentence: 'गेंद लाल है।' }; render()`);
    await wait(600);
    check('plan "hear it first": Munni reads the line when it appears, once', spoken.slice(n0).includes('गेंद लाल है।') && !$('.mindchunks'), spoken.slice(n0).join(' | '));

    // the parent types a school mark
    E(`go('parent')`);
    check('the parent dashboard: "How … learns", saying it stays on this phone', /LEARNS/.test(screen()) && /stays on this phone/.test(screen()), '');
    E(`$('mkSkill').value = 'sub2'; $('mkGot').value = '2'; $('mkOf').value = '10'; mindSaveMark()`);
    check('a school mark under half: Munni says she will focus on it and teach it a new way', /focus on/.test(screen()) && E(`S.assessments[0].skill`) === 'sub2' && E(`mindNext().skill`) === 'sub2', screen().slice(-300));
    check('…and the change and its reason are shown', /What Munni changed/.test(screen()) && /2 of 10/.test(screen()), '');
    E(`S.lang = 'hi'; render()`);
    check('…in Hindi too', /कैसे सीखते हैं/.test(screen()) && /मुन्नी ने क्या बदला/.test(screen()) && /10 में से 2/.test(screen()), '');
    E(`S.lang = 'en'; render()`);
    E(`$('mkGot').value = '12'; $('mkOf').value = '10'; mindSaveMark()`);
    check('a mark more than the total is refused kindly', /Please write the marks/.test(screen()) && E(`S.assessments.length`) === 1, '');

    // Munni's idea on the map
    E(`go('map')`);
    check('"Munni\'s idea" on the map: the low-mark topic, taught this child\'s way', /Munni's idea/.test(screen()) && /Two-digit subtraction/.test(screen()), screen().slice(0, 300));

    // a class test from the circle, applied once
    E(`circleApply(true, 200, { circle: { week: null, members: {}, assessments: [{ id: 't-1', skill: 'tables', got: 9, of: 10, by: 'Sunita', at: new Date().toISOString() }] } }, {}); circleApply(true, 200, { circle: { members: {}, assessments: [{ id: 't-1', skill: 'tables', got: 9, of: 10, by: 'Sunita', at: new Date().toISOString() }] } }, {})`);
    check("a class teacher's test arrives through the circle and is kept once", E(`S.assessments.filter(a => a.id === 't-1').length`) === 1 && E(`S.assessments[0].by`) === 'Sunita', E(`JSON.stringify(S.assessments)`));
    // nothing of the mind leaves the phone
    const src = fs.readFileSync(path.join(root, 'src/ui/circle.js'), 'utf8');
    const body = src.slice(src.indexOf('const body = {'), src.indexOf('const sent ='));
    check("the mind and the marks are not in the circle's sync (only the twin's checked profile)", !/S\.mind|assessments/.test(body) && /profile: twinProfile\(\)/.test(body), '');
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the run finished', false, e.stack); }
  console.log('\n' + '-'.repeat(70));
  for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '\n        ' + String(c.detail).slice(0, 500)}`);
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exit(failures ? 1 : 0);
});
