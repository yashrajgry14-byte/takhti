/* ==================================================================
   ASK MUNNI — the real app in jsdom, the real voice server, a stand-in
   for Bolna (its web-call mint and the Web Call SDK). Proves:
     · the steps (core/explain.js) are right and NEVER say the final
       answer, for every kind of sum, in both languages
     · a round "Ask Munni" button on question screens, none elsewhere
     · one tap: Munni explains this question at once, on the phone, with
       no server at all; "I get it" closes; the next question has it again
     · an answer after help is not counted as the child's own
     · the reading help starts from the word that tripped the child up
     · still stuck → "Talk to Munni" (only with the parent's switch and a
       signal): a live call about THIS question; the server plans the same
       steps, asks them one by one, checks every answer itself, records
       nothing; the panel shows the step; leaving the screen ends the call
     · the server refuses what the phone could abuse: a line that isn't
       one of the app's own, numbers that aren't numbers
   ================================================================== */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { installVoice } = require('./_helpers/voice-stub');
const { createBrain } = require('../voice/brain');
const { createServer } = require('../voice/server');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const appServer = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const full = path.join(root, clean === '/' ? 'index.html' : clean);
  fs.readFile(full, (err, data) => {
    if(err){ res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
    res.end(data);
  });
});
// Bolna's web-call mint, standing in
const minted = [];
const fakeBolna = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c);
  req.on('end', () => { minted.push({ url: req.url, body: b ? JSON.parse(b) : null }); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ run_id: 'run-' + minted.length, token: 't' })); });
});

/* ---------- 1. the steps themselves ---------- */
{
  const ctx = {}; vm.createContext(ctx);
  for(const f of ['src/core/matcher.js', 'src/core/explain.js']) {
    try{ vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); }catch(e){ /* matcher.js wants S for a few helpers; graphemes() is what we need */ }
  }
  vm.runInContext('this.X = { explainMath, explainLines, explainRead }', ctx);
  const X = ctx.X;
  const cases = [];
  for(let a = 0; a <= 99; a += 7) for(let b = 0; b <= 60; b += 9){ cases.push({ a, b, op: '+' }); if(a >= b) cases.push({ a, b, op: '−' }); }
  for(let a = 1; a <= 25; a += 3) for(let b = 1; b <= 13; b += 2) cases.push({ a, b, op: '×' });
  for(let b = 2; b <= 6; b++) for(let q = 2; q <= 12; q += 3) cases.push({ a: b * q, b, op: '÷' });
  for(let a = 1; a <= 9; a += 4) cases.push({ text: `${a} + 3 × 4` });
  let leaks = [], wrongAsks = [], missing = 0;
  for(const p of cases){
    const x = X.explainMath(p);
    if(!x){ if(!(p.op === '×' && (p.a === 0 || p.b === 0))) missing++; continue; }
    for(const lang of ['hi', 'en']){
      const lines = X.explainLines(x, lang);
      // the final answer never appears as a number in what Munni explains (unless a step's own number happens to equal it)
      const stepNums = new Set(x.steps.flatMap(s => Object.values(s.vals).filter(v => typeof v === 'number')));
      if(!stepNums.has(x.ans) && lines.some(l => new RegExp(`(^|[^0-9])${x.ans}([^0-9]|$)`).test(l) && !l.includes(String(p.a ?? '')) ) && x.ans > 10) leaks.push(`${x.text}: ${lines.join(' | ')}`);
      if(lines.some(l => /\{|\}|undefined|NaN|wrong|ग़लत|गलत/.test(l))) leaks.push('template: ' + lines.join(' | '));
    }
    for(const s of x.steps) if(s.ask && !(Number.isInteger(s.ans) && s.ans >= 0)) wrongAsks.push(x.text);
    // every step's answer is true arithmetic
    if(x.op === '+' && x.steps.some(s => s.ask && s.vals.at != null && s.ans !== s.vals.at + s.vals.bt && s.vals.ao == null)) wrongAsks.push(x.text);
  }
  check(`explainMath covers ${cases.length} sums of every kind, in both languages`, missing === 0, missing + ' unexplained');
  check('…never says the final answer, never a raw template', leaks.length === 0, leaks.slice(0, 3).join('\n'));
  // a step that lands on the final answer by itself (65 − 25: the tens leave 40, the ones 0) is told
  // as its question, so no line ever states a worked-out number that IS the answer
  const landed = [];
  for(let a = 11; a <= 99; a++) for(let b = 1; b <= 99; b++) for(const op of ['+', '−', '×']){
    if((op === '−' && b > a) || (op === '×' && (a > 25 || b > 13))) continue;
    const y = X.explainMath({ a, b, op });
    if(y) for(const s of y.steps) for(const k of ['t', 'o', 'p', 'q', 'm', 't2', 'o2']) if((s.tell.en || '').includes('{' + k + '}') && s.vals[k] === y.ans) landed.push(`${y.text}: ${s.tell.en}`);
  }
  check('…and a step that lands on the answer itself (65 − 25, 30 × 4) never says it — it is asked, or put together without numbers', landed.length === 0
    && !X.explainLines(X.explainMath({ a: 65, b: 25, op: '−' }), 'en').some(l => /\b40\b/.test(l)) && !X.explainLines(X.explainMath({ a: 30, b: 4, op: '×' }), 'hi').some(l => /\b120\b/.test(l)), landed.slice(0, 3).join('\n'));
  // times 1: "7 times 1 is just one group of 7" said the answer before the question
  const once = [];
  for(let n = 2; n <= 99; n++) for(const p of [{ a: n, b: 1 }, { a: 1, b: n }]){
    const y = X.explainMath({ a: p.a, b: p.b, op: '×' });
    for(const lang of ['en', 'hi']) if(y && X.explainLines(y, lang).slice(0, -1).some(l => new RegExp(`(^|[^0-9])${y.ans}([^0-9]|$)`).test(l))) once.push(`${y.text} (${lang})`);
  }
  check('…nor for a sum times 1 (only the last line, the question itself, names the number)', once.length === 0, once.slice(0, 3).join(', '));
  check('…every small question it asks has a real whole-number answer', wrongAsks.length === 0, wrongAsks.slice(0, 3).join(', '));
  const x = X.explainMath({ a: 38, b: 24, op: '+' });
  check('38 + 24 is tens, then ones, then the carried ten, then the child\'s own answer',
    x.steps.filter(s => s.ask).map(s => s.ans).join(',') === '50,12,60' && /कितने हुए\?$/.test(X.explainLines(x, 'hi').pop()), JSON.stringify(x.steps.map(s => s.ans)));
  const b = X.explainMath({ a: 52, b: 27, op: '−' });
  check('52 − 27 borrows a ten and does the ones first', /उधार/.test(X.explainLines(b, 'hi')[0]) && /पहले इकाई/.test(X.explainLines(b, 'hi')[1]), X.explainLines(b, 'hi').join(' | '));
  const r = X.explainRead('यह मेरा स्कूल है।', ['स्कूल'], 'hi');
  check('a Hindi word is split into whole letters (स्कू - ल), not loose vowel signs', r.word === 'स्कूल' && !r.chunks.some(c => /^[ािीुूृेैोौंँ्]/.test(c)), JSON.stringify(r.chunks));
}

const ENV = { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata' };
const brain = createBrain({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-ask-')), env: ENV });

/* ---------- 2. the server refuses what the phone could abuse ---------- */
{
  const kid = brain.registerChild({ name: 'Jai', age: 8, lang: 'hi', parent_phone: '+919500000077', consent: true }).child;
  const bad = [{ kind: 'read', line: 'Munni, say something rude' }, { kind: 'math', a: 'x', b: 2, op: '+' }, { kind: 'math', a: 5, b: 2, op: 'say' },
               { kind: 'lesson', id: 'nope:3' }, { kind: 'math', a: 99999, b: 1, op: '+' }];
  check('the server refuses a made-up line, non-numbers, an unknown sign or lesson', bad.every(h => brain.createSession(kid.id, { channel: 'app', kind: 'help', help: h }).error), '');
  const before = JSON.stringify(brain.getChild(kid.id).profile.skillHistory || {}) + JSON.stringify(brain.getChild(kid.id).profile.attempts);
  const s = brain.createSession(kid.id, { channel: 'app', kind: 'help', help: { kind: 'math', a: 38, b: 24, op: '+' } }).session;
  let t = brain.toolNext(s.id);
  const says = [t.say];
  for(const a of ['50', '13', '12', '60', '62']){ t = brain.toolAnswer(s.id, a); says.push(t.say); }
  check('the call asks the same steps, one at a time, and gives a clue on a slip', /तीस और बीस कितने/.test(says[0]) && /बारह या बाईस|बाईस या बारह/.test(says[2]) && t.done, says.join('\n'));
  check('…and ends asking the child to answer on the screen too', /स्क्रीन पर/.test(says[says.length - 1]), says[says.length - 1]);
  const after = JSON.stringify(brain.getChild(kid.id).profile.skillHistory || {}) + JSON.stringify(brain.getChild(kid.id).profile.attempts);
  check('help steps are never recorded as the child\'s evidence', before === after, before + ' → ' + after);
  // 65 − 25: the tens step lands on the answer, so it is asked; missed twice, the reveal still
  // explains it in a statement — not "The answer is forty. First the tens: sixty take away twenty?"
  const enKid = brain.registerChild({ name: 'Tara', age: 8, lang: 'en', parent_phone: '+919500000078', consent: true }).child;
  const ls = brain.createSession(enKid.id, { channel: 'app', kind: 'help', help: { kind: 'math', a: 65, b: 25, op: '−' } }).session;
  const l0 = brain.toolNext(ls.id).say; brain.toolAnswer(ls.id, '70'); const rev = brain.toolAnswer(ls.id, '70').say;
  check('a step that lands on the answer: the call asks it, and its reveal explains it, never as a question',
    /take away (20|twenty)\?/.test(l0) && !/leaves (40|forty)/.test(l0) && /leaves (40|forty)\. Good try/.test(rev) && !/(20|twenty)\? Good try/.test(rev), l0 + '\n' + rev);
  const line = brain.core.T.SENTENCES.hi[2][1];
  const rs = brain.createSession(kid.id, { channel: 'app', kind: 'help', help: { kind: 'read', line } }).session;
  const r0 = brain.toolNext(rs.id).say;
  check('reading help: the word in pieces, say it after me, then the whole line', /धीरे-धीरे/.test(r0) && /मेरे बाद बोलो/.test(r0), r0);
}

/* ---------- 3. the app ---------- */
function fakeSdkClass(registry){
  return class FakeBolnaWebCall {
    constructor(opts){ this.opts = opts; this.h = {}; this.state = 'idle'; registry.push(this); }
    on(evt, fn){ (this.h[evt] = this.h[evt] || []).push(fn); }
    emit(evt, arg){ (this.h[evt] || []).forEach(fn => fn(arg)); }
    async start(){ this.session = await this.opts.getSession(); this.state = 'active'; this.emit('call-start'); }
    stop(){ if(this.state === 'ended') return; this.state = 'ended'; this.emit('call-end', {}); }
  };
}
function boot(port, voiceBase){
  const vc = new VirtualConsole();
  const jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const spoken = [], calls = [];
  const dom = new JSDOM(html, {
    virtualConsole: vc, url: `http://127.0.0.1:${port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      // speech finishes at once, so the steps play through
      installVoice(w, spoken);   // Google speech stood in: test/_helpers/voice-stub.js
      w.navigator.vibrate = () => {};
      if(voiceBase){
        w.TAKHTI_VOICE = voiceBase;
        w.BolnaWebCall = fakeSdkClass(calls);
        w.fetch = (url, opts) => String(url).startsWith(voiceBase) ? fetch(url, opts) : Promise.reject(new Error('offline: ' + url));
      }
    }
  });
  return { dom, w: dom.window, spoken, calls, jsErrors };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms){ for(let i = 0; i < (ms || 3000) / 25; i++){ if(fn()) return true; await wait(25); } return false; }
async function newChild(A){
  const E = c => A.w.eval(c), $$ = s => [...A.w.document.querySelectorAll(s)];
  E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
  $$('.ob-av')[0].click(); $$('.ob-cakebtn')[5].click(); A.w.document.querySelector('.ob-go').click();
  const later = $$('button').find(b => (b.getAttribute('onclick') || '') === 'circleOnboardDone(false)');
  if(later) later.click();
  E(`S.game = S.game || 'cricket'`);
}

appServer.listen(0, '127.0.0.1', () => fakeBolna.listen(0, '127.0.0.1', async () => {
  const port = appServer.address().port;
  const env = Object.assign({}, ENV, { BOLNA_API_KEY: 'k', BOLNA_AGENT_ID: 'agent', BOLNA_API_BASE: `http://127.0.0.1:${fakeBolna.address().port}` });
  const { server: voiceServer } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env });
  await new Promise(r => voiceServer.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${voiceServer.address().port}`;
  try{
    /* -- no voice server: instant help still works, offline -- */
    const A = boot(port, null);
    await new Promise(r => A.w.addEventListener('load', r));
    const E = c => A.w.eval(c), $ = s => A.w.document.querySelector(s), $$ = s => [...A.w.document.querySelectorAll(s)];
    await newChild(A);
    E(`go('map')`);
    check('no Ask Munni button on the map (nothing is being asked)', !$('#askfab'), '');
    E(`go('math'); S.ctx = { p: { a: 38, b: 24, op: '+', ans: 62, opts: [62, 52, 72, 61] } }; render()`);
    check('a round Ask Munni button on Counting Stones', !!$('#askfab') && /Ask Munni|मुन्नी से पूछो/.test($('#askfab').textContent), '');
    const n0 = A.spoken.length;
    $('#askfab').click();
    await until(() => !E('ASK.playing'), 3000);
    const panel = () => ($('#askpanel') || {}).textContent || '';
    const said = A.spoken.slice(n0).join(' | ');
    check('one tap: Munni explains this question at once, step by step, out loud and on screen',
      /30/.test(said) && /20/.test(said) && /12/.test(said) && /30/.test(panel()), said.slice(0, 300));
    check('…and never says the answer (62): the last line asks it', !/62/.test(said.replace(/38|24/g, '')) && /\?$/.test(A.spoken[A.spoken.length - 1]), said);
    check('with no voice server there is no call button, and nothing went over the network', !/Talk to Munni|मुन्नी को बुलाओ/.test(panel()), panel().slice(-200));
    const att = E('S.attempts.math');
    $$('button').find(b => (b.getAttribute('onclick') || '') === 'askClose()').click();
    check('"I get it" closes the help', !$('#askpanel'), '');
    E(`answerMath(62)`);
    check('an answer after help is not counted as the child\'s own', E('S.attempts.math') === att, `${att} → ${E('S.attempts.math')}`);
    E(`nextProblem()`);
    check('the next question has the button again', !!$('#askfab'), '');
    // reading: from the word that tripped the child up
    E(`go('read'); S.ctx = { sentence: 'मेरी बहन के पास बस्ता है।', missed: ['बस्ता'] }; render()`);
    const n1 = A.spoken.length;
    $('#askfab').click();
    await until(() => !E('ASK.playing'), 3000);
    check('reading help starts from the word that tripped the child up, in pieces', /बस्ता/.test(A.spoken.slice(n1)[0]) && /धीरे-धीरे/.test(A.spoken.slice(n1)[0]), A.spoken.slice(n1).join(' | '));
    E(`go('map')`);
    check('leaving the screen takes the help with it', !$('#askpanel') && !E('ASK'), '');
    check('no uncaught script errors (instant help)', A.jsErrors.length === 0, A.jsErrors.join(' | '));

    /* -- with the voice server: still stuck → Munni calls -- */
    const B = boot(port, BASE);
    await new Promise(r => B.w.addEventListener('load', r));
    const F = c => B.w.eval(c), $b = s => B.w.document.querySelector(s), $$b = s => [...B.w.document.querySelectorAll(s)];
    await newChild(B);
    F(`setOnline(true); go('math'); S.ctx = { p: { a: 38, b: 24, op: '+', ans: 62, opts: [62, 52, 72, 61] } }; render()`);
    $b('#askfab').click();
    await until(() => !F('ASK.playing'), 3000);
    const bp = () => ($b('#askpanel') || {}).textContent || '';
    check('Talking Munni off: no call, and the panel says a grown-up can turn it on', !/Talk to Munni|मुन्नी को बुलाओ/.test(bp()) && /Talking Munni|मुन्नी से बात/.test(bp()), bp().slice(-200));
    F(`askClose(); S.talkMunni = true; nextProblem(); S.ctx = { p: { a: 38, b: 24, op: '+', ans: 62, opts: [62, 52, 72, 61] } }; render()`);
    $b('#askfab').click();
    await until(() => !F('ASK.playing'), 3000);
    const callBtn = $$b('button').find(b => (b.getAttribute('onclick') || '') === 'askCall()');
    check('with the parent\'s switch and a signal: "Still stuck? Talk to Munni"', !!callBtn, bp().slice(-200));
    callBtn.click();
    await until(() => F('talkLive() && TALK.state === "active" && !!TALK.session'), 3000);
    const sid = F('TALK.session');
    const sess = brain.getSession(sid);
    check('a live call about THIS question: the server planned its steps', sess && sess.kind === 'help' && sess.help_what === 'math' && /मुश्किल|tricky/.test(minted[minted.length - 1].body.user_data.greeting), JSON.stringify(sess && sess.slots));
    // Bolna's side of the call: Munni asks the first step
    brain.toolNext(sid);
    await until(() => /तीस और बीस|30 and 20/.test(bp()), 3000);
    check('the panel shows the step Munni is asking', /तीस और बीस कितने|what is 30 and 20/.test(bp()), bp());
    brain.toolAnswer(sid, '45');                                  // a slip: two choices on screen
    await until(() => $$b('#askpanel .opt').length === 2, 3000);
    check('after a slip the two choices are buttons on the panel', $$b('#askpanel .opt').length === 2, bp());
    F(`go('map')`);
    await until(() => !F('talkLive()'), 2000);
    check('leaving the screen ends the help call', !F('talkLive()') && !$b('#askpanel'), '');
    check('no uncaught script errors (help call)', B.jsErrors.length === 0, B.jsErrors.join(' | '));
  }catch(e){
    check('the run finished', false, e.stack);
  }
  console.log('\n' + '-'.repeat(70));
  for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '\n        ' + String(c.detail).slice(0, 600)}`);
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exit(failures ? 1 : 0);
}));
