/* ==================================================================
   OFFLINE READING — core/speech.js's on-device recognition, against a
   stub of the browser's SpeechRecognition with the on-device API
   (available()/install()/processLocally).

   Proves: while online, the language packs get downloaded; offline with
   a pack, a reading attempt is recognised ON THE DEVICE and graded;
   recognition runs on-device even online when it can (the voice never
   leaves the phone); offline without a pack the turn ends at once with
   an honest message — never a hanging microphone; and a browser with no
   on-device API at all behaves exactly as before.
   ================================================================== */
const fs = require('fs'), vm = require('vm');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

function load({ status, installs, online }){
  const calls = { install:[], started:[] };
  const packs = Object.assign({}, status);
  function SR(){ this.processLocally = false; }
  SR.prototype.start = function(){
    calls.started.push({ lang:this.lang, local:this.processLocally });
    this.onresult({ results:[[{ transcript:'the sun is hot', confidence:0.9 }]] });
    this.onend();
  };
  if(status){
    SR.available = async o => packs[o.langs[0]] || 'unavailable';
    SR.install = async o => { calls.install.push(o.langs[0]); if(installs){ packs[o.langs[0]] = 'available'; return true; } return false; };
  }
  const ctx = { console, Intl, setTimeout, clearTimeout, S:{ lang:'en', muted:false },
    navigator:{ onLine: online }, log: () => {},
    window:{ SpeechRecognition: SR } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('src/core/speech.js','utf8'), ctx, { filename:'src/core/speech.js' });
  vm.runInContext('globalThis.__ = { listen, micReason, prepareOfflineSpeech, STT_LOCAL, S };', ctx);
  return { X: ctx.__, calls, ctx };
}
function hear(X){
  const out = { alts:null, ended:[] };
  X.listen(a => { out.alts = a; }, e => out.ended.push(e));
  return out;
}

(async () => {
  /* the network loads tomorrow: download while online */
  let t = load({ status:{ 'en-IN':'downloadable', 'hi-IN':'downloadable' }, installs:true, online:true });
  await t.X.prepareOfflineSpeech();
  check('while online, both language packs are downloaded', t.calls.install.join() === 'en-IN,hi-IN' && t.X.STT_LOCAL.en === 'available' && t.X.STT_LOCAL.hi === 'available', JSON.stringify({ calls:t.calls.install, st:t.X.STT_LOCAL }));
  t.ctx.navigator.onLine = false;
  let h = hear(t.X);
  check('offline, with the pack, the reading is recognised on the device', h.alts && h.alts[0].transcript === 'the sun is hot' && t.calls.started[0].local === true, JSON.stringify({ h, started:t.calls.started }));
  t.X.S.lang = 'hi'; h = hear(t.X);
  check('…in Hindi too, with the Hindi pack', t.calls.started[1].lang === 'hi-IN' && t.calls.started[1].local === true && !!h.alts, JSON.stringify(t.calls.started[1]));

  t = load({ status:{ 'en-IN':'available' }, online:true });
  await t.X.prepareOfflineSpeech();
  hear(t.X);
  check("online, it still recognises on the device when it can — the child's voice never leaves the phone", t.calls.started[0].local === true, JSON.stringify(t.calls.started));

  /* no pack */
  t = load({ status:{ 'en-IN':'downloadable' }, installs:false, online:false });
  await t.X.prepareOfflineSpeech();
  h = hear(t.X);
  check('offline with no pack, the turn ends at once (no hanging microphone)', h.ended[0] === 'network' && t.calls.started.length === 0, JSON.stringify(h));
  check('…and never tries to download while offline', t.calls.install.length === 0, JSON.stringify(t.calls.install));
  check('…and the message says how to get offline reading', /download offline reading/i.test(t.X.micReason('network')), t.X.micReason('network'));

  /* a browser with no on-device API */
  t = load({ status:null, online:true });
  await t.X.prepareOfflineSpeech();
  h = hear(t.X);
  check('a browser with no on-device API still recognises online, as before', !!h.alts && t.calls.started[0].local === false, JSON.stringify(t.calls.started));
  t.ctx.navigator.onLine = false;
  h = hear(t.X);
  check('…and offline ends the turn with the honest typed-fallback message', h.ended[0] === 'network' && /type it below/i.test(t.X.micReason('network')), t.X.micReason('network'));

  console.log('-'.repeat(70));
  checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exitCode = failures ? 1 : 0;
})();
