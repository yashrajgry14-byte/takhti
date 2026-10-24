/* ==================================================================
   MUTE TESTS — S.muted is global (checked inside speak()/trumpet()
   themselves, not just on the arrival screen) and persisted per child.

   Two passes:
   1. speak()'s callback contract, in a minimal vm context — the part
      the brief specifically flagged as non-trivial: when muted, speak()
      must still call onDone() immediately, or every narrated scene
      (a lesson beat, the reading screen, an opening sequence) stalls
      forever waiting for a sound that will never come. Also proves the
      un-muted path is genuinely different (it really attempts speech),
      so the muted branch isn't just always a no-op regardless of state.
   2. trumpet() respects S.muted, and S.muted persists PER CHILD across
      a real profile switch (via the actual createProfile()/
      switchProfile()/save()/load() — not reimplemented), and the parent
      dashboard's own toggle (not just arrival's) flips it. Real
      index.html/CSS/JS in a real jsdom document, same as the other
      integration tests.
   ================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
const checks = [];
function check(name, pass, detail){
  checks.push({ name, pass, detail });
  if(!pass) failures++;
}

/* ==================================================================
   PASS 1 — speak()'s onDone contract when muted, in a light vm context
   ================================================================== */
console.log('=== speak(): the callback contract when muted ===');
{
  const ctx = {
    console, Intl, setTimeout, clearTimeout, TextEncoder, DataView, Uint8Array, Int32Array,
    S: { lang:'en', muted:false, _voiceNoted:false },
    band: () => ({ speechRate: 0.85 }),
    log: () => {},
    fetch: () => Promise.reject(new Error('no manifest in this test')),
  };
  vm.createContext(ctx);
  ctx.window = ctx;   // speech.js checks `'speechSynthesis' in window` — window IS this context, as in a real page

  let speakCalled = false;
  ctx.speechSynthesis = {
    cancel(){}, getVoices(){ return []; }, addEventListener(){}, removeEventListener(){},
    speak(u){ speakCalled = true; if(u.onend) u.onend(); }
  };
  ctx.SpeechSynthesisUtterance = function(text){ this.text = text; };
  ctx.Audio = function(){ this.play = () => Promise.resolve(); this.pause = () => {}; };

  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src/core/voice.js'),'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src/core/speech.js'),'utf8'), ctx);
  vm.runInContext('globalThis.__ = { speak };', ctx);
  const X = ctx.__;

  console.log('--- muted: speak() must call onDone immediately, not stall ---');
  ctx.S.muted = true;
  let doneCalled = 0;
  let settled = false;
  X.speak('Hello', 'en', () => { doneCalled++; }).then(() => { settled = true; });
  // speak() is async but has no `await` before the muted guard, so onDone
  // fires synchronously within this same tick — no need to wait a turn.
  check('speak() calls onDone exactly once, synchronously, when S.muted is true',
    doneCalled === 1, `onDone called ${doneCalled} time(s)`);
  check('speak() never reaches real TTS when muted', speakCalled === false, `speechSynthesis.speak() was called: ${speakCalled}`);

  console.log('--- not muted: speak() genuinely attempts real speech ---');
  ctx.S.muted = false;
  speakCalled = false;
  let doneCalled2 = 0;
  return X.speak('Hello again', 'en', () => { doneCalled2++; }).then(() => {
    // playRecorded() rejects (no manifest, no fetch), so speak() falls
    // through to speakDevice(), which queues the utterance after a 70ms
    // beat (see speech.js's own comment on why: Chrome drops an
    // utterance queued in the same tick as cancel()).
    setTimeout(() => {
      check('speak() reaches real TTS when NOT muted (the muted branch is not just always a no-op)',
        speakCalled === true, `speechSynthesis.speak() was called: ${speakCalled}`);
      check('onDone still fires exactly once via the real TTS onend path when not muted',
        doneCalled2 === 1, `onDone called ${doneCalled2} time(s)`);
      runPass2();
    }, 150);
  });
}

/* ==================================================================
   PASS 2 — trumpet() respects mute; muted persists per profile
   (including a genuine localStorage round trip); the parent
   dashboard's own toggle works. Real app, real jsdom.

   Served over a real local HTTP origin rather than file:// — jsdom
   correctly treats file:// as an opaque origin (matching real
   browsers), where localStorage throws outright. That is exactly the
   file:// pitfall CLAUDE.md already warns about for this app ("not
   file:// — the camera and fetch need an origin"), so this is also
   the more honest way to run the check, not a workaround for the test
   alone.
   ================================================================== */
function runPass2(){
  const { JSDOM, VirtualConsole } = require('jsdom');
  const http = require('http');
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

  function StubAudioContext(){ this.state = 'suspended'; }
  StubAudioContext.prototype.resume = function(){ this.state = 'running'; return Promise.resolve(); };
  StubAudioContext.prototype.createOscillator = function(){
    return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, start(){}, stop(){} };
  };
  StubAudioContext.prototype.createGain = function(){
    return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(){} };
  };
  Object.defineProperty(StubAudioContext.prototype, 'currentTime', { get(){ return 0; } });
  Object.defineProperty(StubAudioContext.prototype, 'destination', { get(){ return {}; } });

  server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const virtualConsole = new VirtualConsole();
  const jsErrors = [];
  virtualConsole.on('jsdomError', e => jsErrors.push(e.message));
  virtualConsole.forwardTo(console);

  const dom = new JSDOM(html, {
    virtualConsole,
    url: `http://127.0.0.1:${port}/index.html`,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window){
      window.speechSynthesis = {
        getVoices: () => [], speak: () => {}, cancel: () => {},
        addEventListener: () => {}, removeEventListener: () => {}
      };
      window.SpeechSynthesisUtterance = function(){};
      window.AudioContext = window.webkitAudioContext = StubAudioContext;
    }
  });
  const { window } = dom;
  window.navigator.vibrate = () => {};

  window.addEventListener('load', () => {
    console.log('\n=== trumpet(): respects S.muted, created audio context untouched when muted ===');
    const trumpetResult = window.eval(`
      (function(){
        createProfile('Riya');
        S.age = 8; S.screen = 'map'; render();
        S.muted = true;
        S._ac = undefined;
        trumpet(1);
        const acAfterMuted = S._ac ? S._ac.state : 'none';
        S.muted = false;
        trumpet(1);
        const acAfterUnmuted = S._ac ? S._ac.state : 'none';
        return { acAfterMuted, acAfterUnmuted };
      })()
    `);
    console.log(JSON.stringify(trumpetResult));
    check('trumpet() does nothing at all when muted — no AudioContext gets created', trumpetResult.acAfterMuted === 'none', JSON.stringify(trumpetResult));
    check('trumpet() works normally once unmuted', trumpetResult.acAfterUnmuted === 'running', JSON.stringify(trumpetResult));

    console.log('\n=== S.muted is per-profile, not per-device ===');
    const perProfile = window.eval(`
      (function(){
        // Riya (created above) starts unmuted; mute her explicitly
        S.muted = true; saveSoon();
        createProfile('Aarav');   // a second child on the same phone
        const aaravMutedOnCreation = S.muted;   // a brand-new profile must not inherit Riya's mute
        switchProfile(0);          // back to Riya
        const riyaStillMuted = S.muted;
        switchProfile(1);          // to Aarav again
        const aaravStillUnmuted = S.muted;
        return { aaravMutedOnCreation, riyaStillMuted, aaravStillUnmuted };
      })()
    `);
    console.log(JSON.stringify(perProfile));
    check("a brand-new profile does not inherit another child's mute setting",
      perProfile.aaravMutedOnCreation === false, JSON.stringify(perProfile));
    check("switching back to a muted child restores their mute setting",
      perProfile.riyaStillMuted === true, JSON.stringify(perProfile));
    check("the other child's own (unmuted) setting is untouched by the first child's mute",
      perProfile.aaravStillUnmuted === false, JSON.stringify(perProfile));

    console.log('\n=== muted genuinely persists through a save()/load() round trip (a real app restart) ===');
    const roundTrip = window.eval(`
      (function(){
        switchProfile(0);        // Riya, currently muted (per the check above)
        const mutedBeforeRestart = S.muted;
        save();                  // writes S.profiles (with Riya's muted:true) to real localStorage
        S.muted = false;         // simulate forgetting it in memory, the way a fresh page load would
        S.profiles = []; S.activeProfile = null;
        load();                  // reads it back from real localStorage, exactly like a real restart
        return { mutedBeforeRestart, mutedAfterRestart: S.muted, profileCount: S.profiles.length };
      })()
    `);
    console.log(JSON.stringify(roundTrip));
    check("muted was true before the simulated restart", roundTrip.mutedBeforeRestart === true, JSON.stringify(roundTrip));
    check("a real save()/load() round trip through localStorage restores the muted child's setting",
      roundTrip.profileCount > 0 && roundTrip.mutedAfterRestart === true, JSON.stringify(roundTrip));

    console.log('\n=== the parent dashboard has its own reachable toggle (not just arrival) ===');
    const parentToggle = window.eval(`
      (function(){
        switchProfile(0);   // Riya, currently muted
        S.parentPin = null; S.screen = 'parent'; render();
        const beforeHTML = document.getElementById('screen').innerHTML;
        const hasToggleBefore = /onclick="toggleMuted\\(\\)"/.test(beforeHTML);
        const wasMuted = S.muted;
        toggleMuted();
        const afterHTML = document.getElementById('screen').innerHTML;
        return { hasToggleBefore, wasMuted, isMutedNow: S.muted, htmlChanged: beforeHTML !== afterHTML };
      })()
    `);
    console.log(JSON.stringify(parentToggle));
    check('the parent dashboard view renders a mute toggle wired to toggleMuted()', parentToggle.hasToggleBefore === true, JSON.stringify(parentToggle));
    check('toggleMuted() actually flips S.muted', parentToggle.wasMuted === true && parentToggle.isMutedNow === false, JSON.stringify(parentToggle));

    check('no uncaught script errors anywhere in this pass', jsErrors.length === 0, jsErrors.join(' | '));

    console.log('\n' + '-'.repeat(70));
    checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
    console.log('-'.repeat(70));
    console.log(`${checks.length-failures}/${checks.length} checks passed`);
    server.close();
    process.exit(failures ? 1 : 0);
  });
  });
}
