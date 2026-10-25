/* ==================================================================
   THE LEARNING CIRCLE, APP SIDE — the real index.html/CSS/JS in jsdom,
   talking to the REAL voice server (voice/server.js, in this process).

   No stand-in for the circle: the app's fetch is forwarded to the voice
   server's own /circle/sync, so what this proves is the whole bridge:
     · a build with no circle server shows none of it
     · onboarding ends with a grown-ups' step, in both languages, saying
       that only progress goes — never a voice, a photo or a typed question
     · nothing is sent before the parent's tick; after it, only progress
       (every request body is checked for what it carries)
     · the school's family code joins this phone to the school's record
     · the class homework arrives through the app's own importHomework()
     · this week's step is on the map; Munni's Friday check is three real
       questions, kind, never "wrong", recorded as real evidence, and the
       teacher's side sees the verdict
     · the parent marks a home activity done; the child is asked once
       whether they taught someone; the answer reaches the circle
     · a phone lesson's evidence comes back as circleHistory and the
       app's diagnosis counts it, once
     · the school's record keeps the school's name, not the avatar's
     · turning sync off reaches the server (after a spell offline too): the
       circle stops — no plan in calls, no messages — and on again resumes
     · a parent can erase the circle's data: the school's record keeps only
       its own records, a record only the app made goes whole
   ================================================================== */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');
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

const ENV = { TAKHTI_QUIET_HOURS: '0-0', TAKHTI_TZ: 'Asia/Kolkata', TAKHTI_PUBLIC_URL: 'https://takhti.example', TAKHTI_CHECK_DAYS: '1,2,3,4,5,6,7' };
const brain = createBrain({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-circle-app-')), env: ENV });
const { server: voiceServer } = createServer({ brain, toolToken: 'tt', webhookKey: 'hk', adminKey: 'ak', env: ENV });

function boot(port, voiceBase){
  const vc = new VirtualConsole();
  const jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const sent = [];
  const dom = new JSDOM(html, {
    virtualConsole: vc,
    url: `http://127.0.0.1:${port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      w.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {}, addEventListener: () => {} };
      w.SpeechSynthesisUtterance = function(){};
      w.navigator.vibrate = () => {};
      if(voiceBase){
        w.TAKHTI_VOICE = voiceBase;
        // the app's fetch, forwarded to the real voice server
        w.fetch = (url, opts) => {
          if(!String(url).startsWith(voiceBase)) return Promise.reject(new Error('offline in this test: ' + url));
          sent.push({ url: String(url).slice(voiceBase.length), body: opts && opts.body ? JSON.parse(opts.body) : null });
          return fetch(url, opts);
        };
      }
    }
  });
  return { dom, w: dom.window, sent, jsErrors };
}

const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms){ for(let i = 0; i < (ms || 3000) / 25; i++){ if(fn()) return true; await wait(25); } return false; }

appServer.listen(0, '127.0.0.1', () => voiceServer.listen(0, '127.0.0.1', async () => {
  const port = appServer.address().port, vport = voiceServer.address().port;
  const BASE = `http://127.0.0.1:${vport}`;

  // the school's side: a class, its teacher, a child the school registered, a family code
  const school = brain.createSchool({ name: 'Green Valley' }).school;
  brain.registerTeacher({ name: 'Sunita', phone: '+919500000001', class_codes: ['CLS1B1'], school_id: school.id });
  const kid = brain.registerChild({ name: 'Aman', age: 7, lang: 'en', parent_phone: '+919500000002', consent: true, school_id: school.id }).child;
  { const r = brain.getChild(kid.id); r.profile.classCode = 'CLS1B1'; brain.store.put('children', r.id, r); }
  const familyCode = brain.circle.familyCode(kid.id);
  const hw = brain.circle.setClassFocus('CLS1B1', 'carry', 'Carrying this week', 'Sunita');

  /* ---- a build with no circle server shows none of it ---- */
  {
    const B = boot(port, null);
    await new Promise(r => B.w.addEventListener('load', r));
    const E = c => B.w.eval(c), $$ = s => [...B.w.document.querySelectorAll(s)];
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    $$('.ob-av')[0].click(); $$('.ob-cakebtn')[4].click(); B.w.document.querySelector('.ob-go').click();
    check('no circle server: onboarding goes straight on to the game pick', E('S.screen') === 'pick', E('S.screen'));
    E(`go('parent')`);
    check('…and the parent dashboard has no learning circle', !/LEARNING CIRCLE|सीखने का घेरा/.test(B.w.document.getElementById('screen').textContent), '');
  }

  const A = boot(port, BASE);
  const w = A.w;
  const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
  const E = c => w.eval(c);
  const screen = () => $('#screen').textContent;
  await new Promise(r => w.addEventListener('load', r));
  try{
    E(`setOnline(true)`);
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    $$('.ob-av').find(b => b.getAttribute('onclick').includes("'tiger'")).click();
    $$('.ob-cakebtn')[4].click();
    $('.ob-go').click();

    /* ---- the grown-ups' step ---- */
    check('onboarding ends with the grown-ups\' step', E('S.ob && S.ob.step') === 'grownup' && !!$('#circleTick'), E('JSON.stringify(S.ob)'));
    check('it says plainly that only progress goes, never a voice, a photo or a typed question', /never a voice, a photo or a typed question/.test(screen()), screen().slice(0, 300));
    E(`S.lang='hi'; render()`);
    check('…and says it in Hindi too', /आवाज़, फ़ोटो या लिखे सवाल कभी नहीं/.test(screen()), screen().slice(0, 300));
    E(`S.lang='en'; render()`);
    check('nothing is sent before the parent\'s tick', A.sent.length === 0, JSON.stringify(A.sent));

    $('#circleTick').checked = true;
    $('#circleCodeIn').value = familyCode.toLowerCase();
    $$('button').find(b => (b.getAttribute('onclick') || '') === 'circleOnboardDone(true)').click();
    check('after the grown-ups\' step the child picks a game as before', E('S.screen') === 'pick', E('S.screen'));
    const joined = await until(() => E('!!(S.circle && S.circle.members && S.circle.members.school)'));
    check('the family code joins this phone to the school\'s record', joined && E('S.circle.members.school') === 'Green Valley' && brain.getChild(kid.id).circle.app.id === E('S.id'), E('JSON.stringify(S.circle && S.circle.members)'));
    check('the school\'s record keeps the school\'s name, not the animal the child tapped', brain.getChild(kid.id).name === 'Aman' && E('S.name') !== 'Aman',
      `${brain.getChild(kid.id).name} / app: ${E('S.name')}`);
    check('the phone got its own key, and the code is spent', !!E('S.circleKey') && E('S.circleCode') === '', E('S.circleKey'));

    const ALLOWED = ['child', 'key', 'consent', 'link', 'parent_phone', 'progress', 'check', 'home', 'invite', 'tutor'];
    const PROG = ['seq', 'levels', 'skillHistory', 'attempts', 'correct', 'stars', 'cards', 'classCode', 'srs'];
    const leaks = () => A.sent.filter(x => x.url === '/circle/sync').filter(x => Object.keys(x.body).some(k => !ALLOWED.includes(k)) ||
      Object.keys(x.body.progress || {}).some(k => !PROG.includes(k)) || /data:image|blob:|"queue"|"q":/.test(JSON.stringify(x.body)));
    check('every sync carries progress only — no photo, voice or question', A.sent.length && leaks().length === 0, JSON.stringify(leaks()).slice(0, 300));

    /* ---- the class homework, through the app's own import ---- */
    check('the class homework arrived with the sync (importHomework)', E('!!getAssignedHomework(S)') && E('S.classCode') === 'CLS1B1', E('S.classCode'));
    check('this week\'s step is the class step, chosen for this child', E('S.circle.week.source') === 'homework' && !!E('S.circle.week.skill'), E('JSON.stringify(S.circle.week).slice(0,200)'));

    /* ---- this week on the map, and Munni's Friday check ---- */
    E(`S.game = S.game || 'cricket'; go('map')`);
    check('the map shows this week\'s step', /This week you and Munni are learning/.test(screen()), screen().slice(0, 300));
    const checkBtn = $$('button').find(b => (b.getAttribute('onclick') || '') === "go('check')");
    check('…and Munni\'s Friday check', !!checkBtn, '');
    checkBtn.click();
    const qs = E('JSON.stringify(S.circle.week.check.questions)'), Q = JSON.parse(qs);
    check('the check is three real questions for this week\'s step', Q.length === 3 && Q.every(q => q.opts.includes(q.answer) && q.skill), qs);
    const before = E(`JSON.stringify(S.skillHistory)`);
    const answer = v => $$('.opt').find(b => Number(b.textContent) === v).click();
    answer(Q[0].answer); answer(Q[1].answer);
    answer(Q[2].opts.find(o => o !== Q[2].answer));
    check('a miss is "almost", never "wrong"', !/wrong/i.test(screen()) && /2 of 3/.test(screen()), screen().slice(0, 200));
    const hAfter = E(`JSON.stringify(S.skillHistory)`), h0 = JSON.parse(before), h1 = JSON.parse(hAfter);
    const added = Object.keys(h1).reduce((n, k) => n + (h1[k].n - ((h0[k] || {}).n || 0)), 0);
    check('the check is real evidence: three attempts on the skill history', added === 3, hAfter);
    const verdict = await until(() => { const r = brain.getChild(kid.id); return r.circle.week && r.circle.week.check && r.circle.week.check.done_at; });
    const wk = brain.getChild(kid.id).circle.week.check;
    check('the circle (and the teacher\'s page) sees the check: 2 of 3, "nearly"', verdict && wk.right === 2 && wk.of === 3 && wk.verdict === 'nearly' && wk.source === 'app', JSON.stringify(wk));

    /* ---- the home loop ---- */
    E(`go('parent')`);
    check('the parent dashboard shows the circle: this week, at home, the members', /LEARNING CIRCLE/.test(screen()) && /At home/.test(screen()) && /Green Valley/.test(screen()), screen().slice(0, 400));
    const teach = brain.getChild(kid.id).circle.week.home.find(h => h.kind === 'teach');
    $$('button').find(b => (b.getAttribute('onclick') || '') === `circleHomeDone('${teach.id}')`).click();
    await until(() => !!brain.getChild(kid.id).circle.week.home.find(h => h.id === teach.id).done_at);
    check('"We did it" reaches the circle', !!brain.getChild(kid.id).circle.week.home.find(h => h.id === teach.id).done_at, '');
    await until(() => !E('CIRCLE_BUSY'));
    E(`circleSync(true)`);
    await until(() => E(`!!(S.circle.week.home.find(h => h.ask))`));
    E(`go('map')`);
    check('the child is asked once: did you teach someone at home?', /Did you teach someone at home/.test(screen()), screen().slice(0, 400));
    $$('button').find(b => (b.getAttribute('onclick') || '') === `circleHomeAnswer('${teach.id}','yes')`).click();
    await until(() => brain.getChild(kid.id).circle.week.home.find(h => h.id === teach.id).child_said);
    check('the child\'s answer reaches the circle', brain.getChild(kid.id).circle.week.home.find(h => h.id === teach.id).child_said === 'yes',
      JSON.stringify(brain.getChild(kid.id).circle.week.home.find(h => h.id === teach.id)));
    check('…and the question is not asked again', !/Did you teach someone at home/.test(screen()), '');

    /* ---- a phone lesson comes back as circleHistory, counted once ---- */
    const { session } = brain.createSession(kid.id);
    let r = brain.toolNext(session.id);
    for(let i = 0; i < 80 && !r.done; i++){
      const s = brain.getSession(session.id), it = s.items[s.items.length - 1];
      r = brain.toolAnswer(session.id, it.expect === 'yesno' ? (it.answer ? 'haan' : 'nahi') : it.expect === 'number' ? String(it.answer) : it.target);
    }
    const s = brain.getSession(session.id);
    brain.onCallEvent({ id: 'ex-' + session.id, status: 'completed', transcript: s.live_turns.map(t => `${t.role}: ${t.text}`).join('\n'),
      conversation_duration: 240, telephony_data: {}, context_details: { recipient_data: { session_id: session.id } } }, ENV);
    const far = brain.getChild(kid.id).server_evidence;
    await until(() => !E('CIRCLE_BUSY'));
    E(`circleSync(true)`);
    await until(() => E(`Object.keys(S.circleHistory || {}).length > 0`));
    check('a phone lesson\'s evidence comes back as circleHistory', JSON.stringify(E('S.circleHistory')) === JSON.stringify(far), JSON.stringify(E('S.circleHistory')));
    const sk = Object.keys(far)[0];
    const own = E(`(S.skillHistory['${sk}'] || {n:0}).n`), ev = E(`appEvidence('${sk}')`);
    check('the app\'s diagnosis counts it once (own + circle)', (own + far[sk].n) < 4 ? ev === null : ev && ev.n === own + far[sk].n, JSON.stringify({ own, far: far[sk], ev }));

    /* ---- sync off reaches the server, even after a spell without signal ---- */
    const btn = on => $$('button').find(b => (b.getAttribute('onclick') || '') === on);
    await until(() => !E('CIRCLE_BUSY'));
    E(`go('parent')`);
    E(`setOnline(false)`);
    btn('toggleCircle()').click();
    const n0 = A.sent.length;
    check('off without signal: nothing sent yet, and the parent is told it will be', A.sent.length === n0 && E('!!S.circleLeave') && /will be told/.test(screen()), screen().slice(-300));
    check('…the server still has it on until then', brain.circle.active(brain.getChild(kid.id)), '');
    E(`setOnline(true)`);
    await until(() => !E('S.circleLeave'));
    const rec = brain.getChild(kid.id);
    check('when the signal comes back the server is told: the circle stops for this child', A.sent.slice(n0).some(x => x.url === '/circle/leave' && !x.body.erase) &&
      !brain.circle.active(rec) && rec.circle.sync.on === false, JSON.stringify(rec.circle.sync));
    // a check would be due this week again if the circle were still on
    { const x = brain.getChild(kid.id); delete x.circle.week.check; brain.store.put('children', x.id, x); }
    const quiet = brain.createSession(kid.id).session;
    check('…so a phone lesson carries no circle items (no Friday check, no home question)', quiet && !quiet.slots.some(x => x === 'check' || x === 'home'), JSON.stringify(quiet.slots));
    brain.messages.queue && brain.messages.queue({ role: 'parent', kind: 'test', child_id: kid.id, to: { phone: '+919500000002', name: 'p' }, text: 'x', link: 'y' });
    await brain.messages.flush(new Date(Date.now() + 864e5 * 2));
    check('…and no message about this child goes out', !brain.messages.list().some(m => m.child_id === kid.id && m.status === 'sent' && m.kind === 'test'),
      JSON.stringify(brain.messages.list().filter(m => m.child_id === kid.id).map(m => [m.kind, m.status, m.error])));
    const n1 = A.sent.length;
    E(`circleSync(true); go('map')`);
    await wait(150);
    check('off: nothing more is sent from the app', E('S.circleSync') === false && A.sent.length === n1, `${n1} → ${A.sent.length}`);

    /* ---- on again, then the parent erases the circle's data ---- */
    E(`go('parent')`);
    btn('toggleCircle()').click();
    await until(() => brain.circle.active(brain.getChild(kid.id)) && !E('CIRCLE_BUSY'));
    check('turned on again, the circle picks up where it was', brain.circle.active(brain.getChild(kid.id)) && brain.getChild(kid.id).circle.app.id === E('S.id'), '');
    E(`render()`);
    btn('circleErase()').click();
    check('erase asks first, saying what goes and what stays with the school', /This deletes everything the circle keeps/.test(screen()) && /school's own records/.test(screen()) &&
      brain.getChild(kid.id).circle.app, screen().slice(-500));
    E(`S.lang='hi'; render()`);
    check('…in Hindi too', /घेरे में रखा/.test(screen()) && /स्कूल के अपने रिकॉर्ड/.test(screen()), '');
    E(`S.lang='en'; render()`);
    btn('circleErase()').click();
    await until(() => !E('S.circleLeave'));
    const gone = brain.getChild(kid.id);
    check('erased: the circle is gone from the school\'s record and stays off', gone && !gone.circle.app && !gone.circle.app_snapshot && !gone.circle.week && !brain.circle.active(gone),
      JSON.stringify(gone && gone.circle));
    check('…the school\'s own records stay (its phone lessons)', (gone.sessions || []).length > 0, '');
    check('…no message about the child is left', !brain.messages.list().some(m => m.child_id === kid.id), '');
    check('…and the phone forgets the circle too (its own progress stays)', !E('S.circleKey') && !E('S.circle') && !Object.keys(E('S.circleHistory')).length && E('S.circleSync') === false &&
      Object.keys(E('S.skillHistory')).length > 0, '');

    /* ---- a child only the app knew is erased whole ---- */
    const solo = await brain.circle.sync({ child: { id: 'appSOLO001', name: 'Tiger', age: 6, lang: 'en' }, consent: { sync: true }, progress: { seq: 1, skillHistory: {} } }, 'ipx');
    check('a record the app made takes the app\'s name', brain.getChild('app_appSOLO001').name === 'Tiger', JSON.stringify(solo.body).slice(0, 200));
    check('a different phone cannot turn it off or erase it', brain.circle.leave({ child: { id: 'appSOLO001' }, key: 'nope', erase: true }).status === 403 && !!brain.getChild('app_appSOLO001'), '');
    const er = brain.circle.leave({ child: { id: 'appSOLO001' }, key: solo.body.key, erase: true });
    check('erasing a record only the app made deletes it whole', er.status === 200 && er.body.erased === 'all' && !brain.getChild('app_appSOLO001'), JSON.stringify(er.body));

    check('no uncaught script errors', A.jsErrors.length === 0, A.jsErrors.join(' | ').slice(0, 400));
  }catch(e){
    check('the run finished', false, e.stack);
  }

  console.log('\n' + '-'.repeat(70));
  for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '\n        ' + String(c.detail).slice(0, 500)}`);
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  A.dom.window.close();
  appServer.close(); voiceServer.close();
  process.exit(failures ? 1 : 0);
}));
