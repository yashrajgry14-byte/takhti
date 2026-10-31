/* ==================================================================
   TALKING MUNNI — the real index.html/CSS/JS in jsdom, like app-flows.

   The voice server and Bolna's Web Call SDK are stand-ins (a fetch that
   answers like voice/server.js's /voice/web/* routes, and a BolnaWebCall
   class that behaves like the SDK's event emitter); everything else is
   the real app. It proves the promises talk-munni.js makes:
     · nothing shows, and no SDK loads, until a parent turns it on
     · the parent sees, in plain words, that the voice leaves the phone
     · no signal → an honest sentence, no button
     · a talk mints through the voice server with consent, shows the
       line or the sum on screen, turns a first miss into tap choices,
       and a tap goes to the server
     · the talk carries on into the games: the lesson pauses, a missed
       answer asks Munni for a hint by item id, a visible bar stays up;
       anywhere else (the Reading Tree) or losing signal ends it
     · afterwards the talk's answers enter THIS child's record once
     · a parent can erase the voice-side record
     · a build with no voice server shows none of it
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const full = path.join(root, clean === '/' ? 'index.html' : clean);
  fs.readFile(full, (err, data) => {
    if(err){ res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
    res.end(data);
  });
});

/* ---- a stand-in voice server, answering like voice/web.js ---- */
function fakeVoice(){
  const log = [];
  let screens = [], result = { pending: false, source: 'transcript', records: [] };
  const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: async () => body });
  const fetch = (url, opts) => {
    opts = opts || {};
    const u = new URL(url);
    const body = opts.body ? JSON.parse(opts.body) : null;
    log.push({ path: u.pathname, body, query: Object.fromEntries(u.searchParams) });
    if(u.pathname === '/voice/web/session') return json(200, { bolna: { run_id: 'run-1' }, session_id: 'sess-' + log.length, token: 'tok', key: 'key-1' });
    if(u.pathname === '/voice/web/state') return json(200, { screen: screens.length > 1 ? screens.shift() : screens[0] || null });
    if(u.pathname === '/voice/web/tap') return json(200, { injected: true, screen: { kind: 'number', text: '7 − 2 = ?', choices: null } });
    if(u.pathname === '/voice/web/result') return json(200, result);
    if(u.pathname === '/voice/web/forget') return json(200, { forgotten: true });
    if(u.pathname === '/voice/web/mode') return json(200, { mode: body.mode, changed: true, injected: true });
    if(u.pathname === '/voice/web/game') return json(200, { said: 'Almost!', injected: true });
    return Promise.reject(new Error('offline in this test: ' + url));
  };
  return { fetch, log, setScreens: s => { screens = s; }, setResult: r => { result = r; } };
}

/* ---- a stand-in for the SDK's BolnaWebCall ---- */
function fakeSdkClass(registry){
  return class FakeBolnaWebCall {
    constructor(opts){ this.opts = opts; this.h = {}; this.state = 'idle'; registry.push(this); }
    on(evt, fn){ (this.h[evt] = this.h[evt] || []).push(fn); }
    emit(evt, arg){ (this.h[evt] || []).forEach(fn => fn(arg)); }
    async start(){ this.session = await this.opts.getSession(); this.state = 'active'; this.emit('state-change', 'active'); this.emit('call-start'); }
    stop(){ if(this.state === 'ended') return; this.state = 'ended'; this.emit('call-end', { reason: 'local-hangup' }); }
  };
}

function boot(port, withVoice){
  const vc = new VirtualConsole();
  const jsErrors = [];
  // a font stylesheet that can't be fetched (no open internet) is the
  // network, not a script error; anything else is counted
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const voice = fakeVoice(), calls = [];
  const dom = new JSDOM(html, {
    virtualConsole: vc,
    url: `http://127.0.0.1:${port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      w.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {}, addEventListener: () => {} };
      w.SpeechSynthesisUtterance = function(){};
      w.navigator.vibrate = () => {};
      if(withVoice){ w.TAKHTI_VOICE = 'http://voice.test'; w.fetch = voice.fetch; w.__FakeSdk = fakeSdkClass(calls); }
    }
  });
  return { dom, w: dom.window, voice, calls, jsErrors };
}

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const A = boot(port, true);
  const w = A.w;
  const $ = sel => w.document.querySelector(sel);
  const $$ = sel => [...w.document.querySelectorAll(sel)];
  const E = code => w.eval(code);
  const tap = el => { if(!el) throw new Error('nothing to tap'); el.click(); };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  w.addEventListener('load', async () => {
    try{
      // a child, as onboarding makes one
      E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
      tap($$('.ob-av').find(b => b.getAttribute('onclick').includes("'tiger'")));
      tap($$('.ob-cakebtn')[4]);
      tap($('.ob-go'));
      // a build with a voice server has the grown-ups' steps: the reading terms (test/speech.test.js covers
      // them), then the learning circle, skipped here (test/circle.test.js covers it)
      tap($$('button').find(b => (b.getAttribute('onclick') || '') === 'voiceTermsAccept()'));
      tap($$('button').find(b => (b.getAttribute('onclick') || '') === 'circleOnboardDone(false)'));
      tap($$('.gcard').find(b => b.getAttribute('onclick').includes("'cricket'")));

      /* ---- off until a parent turns it on ---- */
      E(`setOnline(true); go('ask')`);
      check('by default the Pond has no Talking Munni button', !$$('button').some(b => (b.getAttribute('onclick') || '').includes('talkStart')), $('#screen').innerHTML.slice(0, 200));
      // the SDK is not present yet: if talk-munni.js ignored the parent's
      // switch, opening the Pond would have injected its <script> by now
      check('…and the voice SDK has not been loaded', !$('#bolna-sdk'), 'sdk script present');
      check('a new profile starts with Talking Munni off', E('S.talkMunni') === false, String(E('S.talkMunni')));

      /* ---- the parent's switch, with the plain-words disclosure ---- */
      E(`go('parent')`);
      const sw = $$('button').find(b => (b.getAttribute('onclick') || '') === 'toggleTalkMunni()');
      const text = $('#screen').textContent;
      check('the parent dashboard has the Talking Munni switch', !!sw, 'no switch');
      check('it says plainly that the voice goes over the internet to the voice service', /voice goes over the internet/.test(text) && /Bolna/.test(text), text.slice(0, 120));
      check('it says everything else stays on this phone', /Everything else in Takhti stays on this phone/.test(text), '');
      E(`S.lang='hi'; render()`);
      check('the disclosure is in Hindi too', /आवाज़ इंटरनेट से/.test($('#screen').textContent), '');
      E(`S.lang='en'; render()`);
      tap($$('button').find(b => (b.getAttribute('onclick') || '') === 'toggleTalkMunni()'));
      check('a parent can turn it on', E('S.talkMunni') === true, String(E('S.talkMunni')));
      w.BolnaWebCall = w.__FakeSdk;   // from here on, as if the CDN script had loaded

      /* ---- no signal: an honest sentence, no button ---- */
      E(`setOnline(false); go('ask')`);
      check('offline, the Pond says Talking Munni needs the internet, with no button', /needs the internet/.test($('#screen').textContent) && !$$('button').some(b => (b.getAttribute('onclick') || '').includes('talkStart')), '');

      /* ---- a talk ---- */
      E(`setOnline(true); go('ask')`);
      const btn = $$('button').find(b => (b.getAttribute('onclick') || '') === 'talkStart()');
      check('with a signal and the switch on, the Pond offers "Talk with Munni"', !!btn, '');
      A.voice.setScreens([{ kind: 'read', text: 'The sun is hot.' }, { kind: 'number', text: '7 − 2 = ?', choices: ['4', '5'] }]);
      tap(btn);
      await wait(50);
      const mint = A.voice.log.find(x => x.path === '/voice/web/session');
      check('the talk is minted by the voice server, with consent and this child\'s levels — no key in the browser', !!mint && mint.body.consent === true && mint.body.child.id === E('S.id') && mint.body.child.levels.math === E('S.levels.math'), JSON.stringify(mint && mint.body));
      check('the voice server\'s per-child key is kept on this profile', E('S.talkKey') === 'key-1', String(E('S.talkKey')));
      check('the call started', A.calls.length === 1 && A.calls[0].state === 'active', '');
      await wait(1000);
      check('the line to read is shown on screen during the talk', /The sun is hot\./.test(($('#talkpanel') || {}).textContent || ''), ($('#talkpanel') || {}).innerHTML);
      await wait(950);
      const choice = $$('#talkpanel .opt').find(b => b.textContent === '5');
      check('after a first miss, the clue choices are buttons', !!choice, ($('#talkpanel') || {}).innerHTML);
      tap(choice);
      await wait(30);
      const tapCall = A.voice.log.find(x => x.path === '/voice/web/tap');
      check('a tap goes to the voice server for grading', !!tapCall && tapCall.body.choice === '5' && tapCall.body.token === 'tok', JSON.stringify(tapCall && tapCall.body));

      /* ---- the end of the talk: answers enter this child's record, once ---- */
      const before = { m: E('S.attempts.math'), r: E('S.attempts.read'), sub: (E('S.skillHistory.sub10') || { n: 0 }).n };
      A.voice.setResult({ pending: false, source: 'transcript', records: [
        { mod: 'math', ok: true, skill: 'sub10' }, { mod: 'math', ok: false, skill: null, concept: 'add' },
        { mod: 'read', ok: true, sentence: 'The sun is hot.' } ] });
      tap($$('#talkpanel button').find(b => (b.getAttribute('onclick') || '') === 'talkStop()'));
      await wait(60);
      check('ending the talk ends the call', A.calls[0].state === 'ended', A.calls[0].state);
      check("the talk's answers enter the record through record()", E('S.attempts.math') === before.m + 2 && E('S.attempts.read') === before.r + 1, `${E('S.attempts.math')} / ${E('S.attempts.read')}`);
      const addSkills = E('CONCEPT_SKILLS.add') || [];
      check("…and the skill history (sub10, and every skill the 'add' concept feeds)", E('S.skillHistory.sub10.n') === before.sub + 1 && addSkills.length > 0 && addSkills.every(id => E(`S.skillHistory[${JSON.stringify(id)}] && S.skillHistory[${JSON.stringify(id)}].n >= 1`)), JSON.stringify({ addSkills, h: E('S.skillHistory') }));
      check('…and reading feeds spaced repetition keyed on the sentence', Object.values(E('S.srs')).some(x => x.content === 'The sun is hot.'), JSON.stringify(Object.keys(E('S.srs'))));
      const session = A.calls[0].session && A.voice.log.find(x => x.path === '/voice/web/result').query.session;
      check('the same talk can never count twice', E(`talkApply(${JSON.stringify(session)}, S.id, [{mod:'math', ok:true, skill:'sub10'}])`) === 0 && E('S.attempts.math') === before.m + 2, '');

      /* ---- the talk goes on into the games ---- */
      tap($$('button').find(b => (b.getAttribute('onclick') || '') === 'talkStart()'));
      await wait(40);
      E(`go('map')`);
      check('the map (the path to the games) keeps the talk', A.calls[1] && A.calls[1].state === 'active', A.calls[1] && A.calls[1].state);
      check('…with a visible "Munni is with you" bar and an end button', !!A.w.document.getElementById('talkchip') && /talkStop/.test(A.w.document.getElementById('talkchip').innerHTML), '');
      E(`go('games')`);
      await wait(10);
      const modePlay = A.voice.log.filter(x => x.path === '/voice/web/mode').pop();
      check('entering the games pauses the lesson (mode: play)', A.calls[1].state === 'active' && !!modePlay && modePlay.body.mode === 'play' && modePlay.body.token === 'tok', JSON.stringify(modePlay && modePlay.body));
      E(`playGame('runner')`);
      const it = E(`(() => { const x = gameCurrent(); return x && { id: x.id, right: S.lang === 'hi' ? x.right.hi : x.right.en }; })()`);
      E(`gameAnswer(false)`);
      await wait(10);
      const miss = A.voice.log.filter(x => x.path === '/voice/web/game').pop();
      check('a missed answer in a game asks Munni for a hint — by item id, with the answer this phone shows', !!miss && miss.body.event === 'miss' && miss.body.item === it.id && miss.body.right === it.right, JSON.stringify({ miss: miss && miss.body, it }));
      check('…and the game still records the attempt itself, as before', E('S.game_.wrong') === 1, String(E('S.game_.wrong')));
      E(`gameEnd()`);
      await wait(10);
      const end = A.voice.log.filter(x => x.path === '/voice/web/game').pop();
      check('a finished round tells Munni the score', !!end && end.body.event === 'end' && end.body.score === E('S.game_.right'), JSON.stringify(end && end.body));
      E(`go('ask')`);
      await wait(10);
      const modeBack = A.voice.log.filter(x => x.path === '/voice/web/mode').pop();
      check('back at the Pond the lesson carries on (mode: lesson), and the bar goes', modeBack.body.mode === 'lesson' && !A.w.document.getElementById('talkchip'), JSON.stringify(modeBack.body));
      E(`go('read')`);
      check('the Reading Tree (it needs the microphone) ends the call', A.calls[1].state === 'ended' && !A.w.document.getElementById('talkchip'), A.calls[1].state);
      E(`go('ask')`);
      tap($$('button').find(b => (b.getAttribute('onclick') || '') === 'talkStart()'));
      await wait(40);
      E(`setOnline(false)`);
      check('losing the signal ends the call', A.calls[2] && A.calls[2].state === 'ended', A.calls[2] && A.calls[2].state);

      /* ---- erase ---- */
      E(`setOnline(true); go('parent')`);
      tap($$('button').find(b => (b.getAttribute('onclick') || '') === 'talkForget()'));
      await wait(30);
      const forget = A.voice.log.find(x => x.path === '/voice/web/forget');
      check('a parent can erase the voice-side record (with this phone\'s key)', !!forget && forget.body.key === 'key-1' && E('S.talkKey') === null, JSON.stringify(forget && forget.body));
      check('no uncaught script errors in this run', A.jsErrors.length === 0, A.jsErrors.slice(0, 3).join(' | '));

      /* ---- a build with no voice server ---- */
      const B = boot(port, false);
      await new Promise(r => B.w.addEventListener('load', r));
      B.w.eval(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
      const bq = sel => [...B.w.document.querySelectorAll(sel)];
      bq('.ob-av').find(b => b.getAttribute('onclick').includes("'tiger'")).click();
      bq('.ob-cakebtn')[4].click(); B.w.document.querySelector('.ob-go').click();
      B.w.eval(`S.talkMunni = true; setOnline(true); go('parent')`);
      check('with no voice server configured, the dashboard shows no Talking Munni switch', !/TALKING MUNNI/.test(B.w.document.querySelector('#screen').textContent), '');
      B.w.eval(`go('ask')`);
      check('…and the Pond shows no button, even if the flag were set', !bq('button').some(b => (b.getAttribute('onclick') || '').includes('talkStart')), '');
      B.dom.window.close();
    }catch(e){
      check('the run completed', false, e.stack);
    }
    console.log('\n' + '-'.repeat(70));
    checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
    console.log('-'.repeat(70));
    console.log(`${checks.length - failures}/${checks.length} checks passed`);
    A.dom.window.close();
    server.close();
    process.exitCode = failures ? 1 : 0;
  });
});
