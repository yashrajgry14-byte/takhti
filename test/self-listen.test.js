/* ==================================================================
   SELF-LISTEN TESTS

   Real index.html/CSS/JS in a real jsdom document, served over a real
   local HTTP origin (file:// is an opaque origin — localStorage throws
   there, and createProfile()/save() need it; same lesson as
   test/mute.test.js and test/jungle.test.js).

   jsdom implements neither getUserMedia nor MediaRecorder nor
   URL.createObjectURL/revokeObjectURL at all, so all four are stubbed
   here — but every stub either mirrors one real, load-bearing fact
   (getUserMedia is a Promise that can reject; a MediaRecorder delivers
   chunks then fires onstop) or is a pure spy (URL.createObjectURL/
   revokeObjectURL, fetch, localStorage.setItem) that still calls
   through to a real or realistic implementation — nothing here
   reimplements src/ui/self-listen.js's own logic.

   Three things this file exists to prove, because they are the actual
   claim made to a school, not just "the DOM looks right":
     1. URL.revokeObjectURL fires on all three cleanup triggers —
        next sentence, leaving the screen, a profile switch — and the
        Blob is released together with the URL every time.
     2. No code path anywhere hands the recorded Blob to fetch,
        localStorage, or IndexedDB — checked both by a static read of
        the shipped source (self-listen.js never even calls those
        names) and by spying on the real globals through a full
        record → clip → play → cleanup cycle.
     3. A getUserMedia rejection (denied permission, no mic) leaves
        the actual reading/grading loop — checkRead(), typed or
        spoken — fully functional; self-listen is additive, never a
        dependency.
   ================================================================== */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

let failures = 0;
const checks = [];
function check(name, pass, detail){
  checks.push({ name, pass, detail });
  if(!pass) failures++;
}

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---- static source check: the actual shipped claim, not just runtime ----
   The file's own prose (this very comment block included) talks ABOUT
   never touching these APIs, so a plain substring scan would flag its
   own documentation. Strip comments first — /* block *\/ and // line —
   so this checks real code, not what the code says about itself. */
console.log('=== static check: self-listen.js\'s CODE never calls fetch/localStorage/indexedDB ===');
const selfListenSrc = fs.readFileSync(path.join(root, 'src/ui/self-listen.js'), 'utf8');
const codeOnly = selfListenSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
  .replace(/\/\/.*$/gm, '');          // line comments
const forbidden = ['fetch(', 'localStorage', 'indexedDB', 'IndexedDB'];
const found = forbidden.filter(w => codeOnly.includes(w));
console.log('forbidden substrings found in actual code (comments stripped):', found.length ? found.join(', ') : 'none');
check('src/ui/self-listen.js\'s actual code (not its comments) never calls fetch(/localStorage/indexedDB', found.length === 0, found.join(', '));

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

/* A fake MediaRecorder that delivers one chunk on start() and fires
   onstop() synchronously on stop() — deterministic on purpose; nothing
   in self-listen.js depends on real-world capture timing, only on
   "ondataavailable then eventually onstop" happening at all. */
function FakeMediaRecorder(stream){
  this.stream = stream; this.state = 'inactive'; this.mimeType = 'audio/webm';
  this.ondataavailable = null; this.onstop = null;
}
FakeMediaRecorder.prototype.start = function(){
  this.state = 'recording';
  if(this.ondataavailable) this.ondataavailable({ data: new (this._Blob||Blob)(['x'], { type:this.mimeType }) });
};
FakeMediaRecorder.prototype.stop = function(){
  if(this.state === 'inactive') return;
  this.state = 'inactive';
  if(this.onstop) this.onstop();
};

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const virtualConsole = new VirtualConsole();
  const jsErrors = [];
  // jsdom's own diagnostic for calling .play() on an <audio> element —
  // a real, known jsdom limitation (it has no media pipeline at all),
  // not a script exception. self-listen.js already handles a play()
  // that fails or returns no Promise (see selfListenPlay()'s own
  // comment) — this is expected noise from the test environment, not
  // a bug to fail the suite on. Anything else still fails it.
  virtualConsole.on('jsdomError', e => {
    if(/Not implemented: HTMLMediaElement/.test(e.message)) return;
    // Google Fonts can't load without open internet (a sandbox): the network, not the app
    if(/^Could not load link: "https:\/\/fonts\.googleapis\.com\//.test(e.message)) return;
    jsErrors.push(e.message);
  });
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

  /* ---- getUserMedia: controllable per check, exactly the one real
     fact this test needs — a Promise that can resolve or reject ---- */
  let gumMode = 'allow';
  const gumCalls = [];
  window.navigator.mediaDevices = {
    getUserMedia: (constraints) => {
      gumCalls.push(constraints);
      if(gumMode === 'allow'){
        return Promise.resolve({ getTracks: () => [{ stop(){} }] });
      }
      const err = new Error('Permission denied');
      err.name = 'NotAllowedError';
      return Promise.reject(err);
    }
  };
  window.MediaRecorder = FakeMediaRecorder;

  /* ---- URL.createObjectURL/revokeObjectURL: jsdom has neither at all,
     so this is a real (if minimal) implementation, not just a spy —
     it hands back a genuinely unique string per Blob and tracks which
     ones are still "live" so a leak (created, never revoked) is
     directly detectable, not just "was revoke called at all". ---- */
  let urlSeq = 0;
  const liveUrls = new Map();     // url -> the Blob it was made from
  const revokeCalls = [];
  window.URL.createObjectURL = (blob) => {
    const u = 'blob:self-listen-fake-' + (++urlSeq);
    liveUrls.set(u, blob);
    return u;
  };
  window.URL.revokeObjectURL = (u) => {
    revokeCalls.push(u);
    liveUrls.delete(u);
  };

  /* ---- fetch/localStorage: SPIES that still call through to the real
     thing, so save()/load()/voice-manifest loading keep working
     exactly as they do in the real app — every call's arguments are
     just also recorded for inspection. ---- */
  const fetchCalls = [];
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = (...args) => {
    fetchCalls.push(args);
    return realFetch ? realFetch(...args) : Promise.reject(new Error('no fetch in test'));
  };
  const setItemCalls = [];
  const realSetItem = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = (...args) => { setItemCalls.push(args); return realSetItem(...args); };

  window.addEventListener('load', () => {
    console.log('\n=== setup: a profile, on the reading screen ===');
    window.eval(`
      createProfile('TestChild'); S.age = 8; S.avatar='tiger'; S.game='cricket';
      go('read');
    `);
    console.log('S.screen:', window.eval('S.screen'));
    check('boots onto the reading screen with a real profile', window.eval('S.screen') === 'read', 'setup failed');

    /* ================================================================
       1. a clip is actually produced by the real record → stop cycle
       ================================================================ */
    console.log('\n=== recording a clip via the real selfListenStart()/selfListenStop() ===');
    const rec1 = window.eval(`
      (function(){
        S.ctx.live = true;
        selfListenStart();
        return true;
      })()
    `);
    // getUserMedia() is a real Promise — let it settle before checking
    setTimeout(() => {
      const afterStart = window.eval(`({ clipUrl: S.ctx.clipUrl, hasBlob: !!S.ctx.clipBlob })`);
      window.eval('selfListenStop();');
      const afterStop = window.eval(`({ clipUrl: S.ctx.clipUrl, hasBlob: !!S.ctx.clipBlob })`);
      console.log('after start (still recording):', JSON.stringify(afterStart));
      console.log('after stop (clip should exist):', JSON.stringify(afterStop));
      check('a clip (URL + Blob) exists once recording actually stops', !!afterStop.clipUrl && afterStop.hasBlob, JSON.stringify(afterStop));
      check(`exactly one live object URL exists right now (no duplicate/leaked creation)`, liveUrls.size === 1, `liveUrls.size=${liveUrls.size}`);

      /* ================================================================
         2. revokeObjectURL fires on all three cleanup triggers
         ================================================================ */
      console.log('\n=== trigger 1: nextSentence() revokes the clip ===');
      const urlBeforeNext = window.eval('S.ctx.clipUrl');
      window.eval('nextSentence();');
      const afterNext = window.eval(`({ clipUrl: S.ctx.clipUrl, clipBlob: S.ctx.clipBlob })`);
      console.log('revoked?', revokeCalls.includes(urlBeforeNext), '· S.ctx after:', JSON.stringify(afterNext));
      check('nextSentence() calls URL.revokeObjectURL on the previous clip\'s exact URL', revokeCalls.includes(urlBeforeNext), `revokeCalls=${JSON.stringify(revokeCalls)}`);
      // nextSentence() replaces S.ctx wholesale with a fresh object, so a
      // cleared key reads back as undefined here, not literally null —
      // both mean "no clip reference exists", which is the actual claim
      check('nextSentence() clears both S.ctx.clipUrl and S.ctx.clipBlob together', afterNext.clipUrl == null && afterNext.clipBlob == null, JSON.stringify(afterNext));
      check('no object URL is left live after nextSentence()', liveUrls.size === 0, `liveUrls.size=${liveUrls.size}`);

      console.log('\n=== trigger 2: leaving the screen (go()) revokes the clip ===');
      window.eval(`
        S.ctx.live = true;
        selfListenStart();
      `);
      setTimeout(() => {
        window.eval('selfListenStop();');
        const urlBeforeLeave = window.eval('S.ctx.clipUrl');
        check('a fresh clip exists before leaving the screen', !!urlBeforeLeave, `clipUrl=${urlBeforeLeave}`);
        window.eval(`go('map');`);
        console.log('revoked on go()?', revokeCalls.includes(urlBeforeLeave));
        check("go() calls URL.revokeObjectURL when leaving the reading screen with a live clip", revokeCalls.includes(urlBeforeLeave), `revokeCalls=${JSON.stringify(revokeCalls)}`);
        check('no object URL is left live after leaving the screen', liveUrls.size === 0, `liveUrls.size=${liveUrls.size}`);

        /* ================================================================
           3. revoke on a profile switch
           ================================================================ */
        console.log('\n=== trigger 3: switching profiles revokes the clip ===');
        window.eval(`
          go('read');
          S.ctx.live = true;
          selfListenStart();
        `);
        setTimeout(() => {
          window.eval('selfListenStop();');
          const urlBeforeSwitch = window.eval('S.ctx.clipUrl');
          check('a fresh clip exists before switching profiles', !!urlBeforeSwitch, `clipUrl=${urlBeforeSwitch}`);
          window.eval(`
            createProfile('SecondChild');
            switchProfile(0);
          `);
          console.log('revoked on switchProfile()?', revokeCalls.includes(urlBeforeSwitch));
          check('switchProfile() calls URL.revokeObjectURL on the outgoing profile\'s live clip', revokeCalls.includes(urlBeforeSwitch), `revokeCalls=${JSON.stringify(revokeCalls)}`);
          check('no object URL is left live after a profile switch', liveUrls.size === 0, `liveUrls.size=${liveUrls.size}`);

          continueAfterRevocation();
        }, 20);
      }, 20);
    }, 20);

    /* ================================================================
       Runs after the three revocation triggers above have all resolved.
       ================================================================ */
    function continueAfterRevocation(){
      /* ================================================================
         4. no code path hands the Blob to fetch/localStorage/indexedDB —
         runtime spy, across a full record → clip → play-both cycle
         ================================================================ */
      console.log('\n=== runtime check: the Blob never reaches fetch() or localStorage.setItem() ===');
      const fetchBefore = fetchCalls.length, setItemBefore = setItemCalls.length;
      window.eval(`
        go('read');
        S.ctx.live = true;
        selfListenStart();
      `);
      setTimeout(() => {
        window.eval('selfListenStop();');
        setTimeout(() => {
          const blobRef = window.eval('S.ctx.clipBlob');
          const clipUrlRef = window.eval('S.ctx.clipUrl');
          // exercise every playback path, including "Hear both" (which
          // touches Audio() and, 500ms later, speak())
          window.eval(`selfListenPlayMe(); selfListenPlayBoth();`);

          const fetchArgsSince = fetchCalls.slice(fetchBefore);
          const setItemArgsSince = setItemCalls.slice(setItemBefore);
          const fetchTouchedBlob = fetchArgsSince.some(args => args.some(a => a === blobRef || a === clipUrlRef));
          const setItemTouchedBlob = setItemArgsSince.some(args => args.some(a => a === blobRef || (typeof a === 'string' && clipUrlRef && a.includes(clipUrlRef))));
          console.log(`fetch() calls since recording: ${fetchArgsSince.length} · localStorage.setItem() calls since recording: ${setItemArgsSince.length}`);
          console.log('any fetch call touched the Blob/clip URL?', fetchTouchedBlob);
          console.log('any localStorage.setItem call touched the Blob/clip URL?', setItemTouchedBlob);
          check('a real clip exists to test against', !!blobRef && !!clipUrlRef, `blobRef=${!!blobRef}, clipUrlRef=${clipUrlRef}`);
          check('no fetch() call, across recording + both playback paths, ever receives the Blob or its object URL', !fetchTouchedBlob, JSON.stringify(fetchArgsSince));
          check('no localStorage.setItem() call, across recording + both playback paths, ever receives the Blob or its object URL', !setItemTouchedBlob, JSON.stringify(setItemArgsSince));
          check("IndexedDB is never referenced by self-listen.js at all (see the static check above) — nothing further to spy on at runtime", true, '');

          window.eval('nextSentence();');   // tidy up this clip too
          runGumDenialCheck();
        }, 20);
      }, 20);
    }

    /* ================================================================
       5. a getUserMedia rejection leaves the reading/grading loop —
       checkRead(), typed or spoken — fully functional
       ================================================================ */
    function runGumDenialCheck(){
      console.log('\n=== getUserMedia denial leaves the reading loop fully functional ===');
      gumMode = 'deny';
      const denial = window.eval(`
        (function(){
          go('read');
          let threw = null;
          try{ S.ctx.live = true; selfListenStart(); }catch(e){ threw = e.message; }
          return { threw, screen: S.screen };
        })()
      `);
      console.log('selfListenStart() under denial:', JSON.stringify(denial));
      check('selfListenStart() does not throw when getUserMedia is denied', denial.threw === null, JSON.stringify(denial));

      setTimeout(() => {
        const afterDenial = window.eval(`({ clipUrl: S.ctx.clipUrl, live: S.ctx.live })`);
        console.log('after the denial settles:', JSON.stringify(afterDenial));
        check('a denied getUserMedia leaves no clip behind (no crash, no stale URL)', afterDenial.clipUrl == null, JSON.stringify(afterDenial));
        check('S.ctx.live is untouched by the self-listen failure — it is owned entirely by the real listen() callback', afterDenial.live === true, JSON.stringify(afterDenial));

        // the actual claim: grading works regardless — typed input,
        // completely independent of mic/self-listen state
        const graded = window.eval(`
          (function(){
            S.ctx.live = false;
            const before = { score: S.ctx.score, msg: S.ctx.msg };
            checkRead('this is a typed reading attempt');
            return { before, after: { score: S.ctx.score, msg: S.ctx.msg }, hasMsg: !!S.ctx.msg };
          })()
        `);
        console.log('grading via typed input after a mic denial:', JSON.stringify(graded));
        check('checkRead() still grades a typed attempt end-to-end after a getUserMedia denial (score is set)', graded.after.score !== null && graded.after.score !== undefined, JSON.stringify(graded));
        check('a feedback message is produced — the reading loop genuinely completed, not silently swallowed', graded.hasMsg === true, JSON.stringify(graded));

        const slHtml = window.eval(`typeof selfListenHTML === 'function' ? selfListenHTML() : 'MISSING'`);
        console.log('selfListenHTML() with no clip:', slHtml);
        check('selfListenHTML() renders the Munni-only fallback (never blocks, never throws) when there is no clip', /Hear Munni|मुन्नी/.test(slHtml) && !/Hear both|दोनों/.test(slHtml), slHtml);

        check('no uncaught script errors anywhere in this run', jsErrors.length === 0, jsErrors.join(' | '));
        finish();
      }, 20);
    }
  });

  function finish(){
    console.log('\n' + '-'.repeat(70));
    checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
    console.log('-'.repeat(70));
    console.log(`${checks.length-failures}/${checks.length} checks passed`);
    server.close();
    process.exit(failures ? 1 : 0);
  }
});
