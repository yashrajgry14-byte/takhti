/* ==================================================================
   SPEECH SERVICES — the clearer reading check (ui/cloud-read.js +
   voice/asr.js) and the narration builder (tools/build-audio.mjs)

   server (a stand-in Sarvam / OpenAI-compatible service on a local port):
   one line goes out in Sarvam's VERBATIM mode with the right language, the
   text comes back, nothing is kept; a parent's consent is required; no
   service set up → an honest 503; a cut-off or bogus recording is refused;
   per-address limit; an OpenAI-compatible service works the same way.

   app (the real index.html in jsdom, a stand-in microphone and voice
   server): no switch without a voice server; the bilingual notice; the
   phone's own on-device recognizer always wins; with the switch on and no
   recognizer, the line is recorded, written down by the service and
   graded HERE by the matcher (a slip named, as for any reading); no answer
   → the honest message, the lesson goes on.

   narration: the builder collects the lesson bank, every reading line and
   every letter, for either voice service, without sending anything on a
   dry run.
   ================================================================== */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execFileSync } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createAsr } = require('../voice/asr');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }
const root = path.resolve(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* ---------- 1. the server half, against a stand-in service ---------- */
  const seen = [];
  const svc = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('latin1');
      const field = n => { const m = body.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)); return m ? m[1] : null; };
      seen.push({ path: req.url, key: req.headers['api-subscription-key'] || req.headers.authorization, model: field('model'), mode: field('mode'), lang: field('language_code') || field('language'), hasFile: /filename="line\./.test(body) });
      res.setHeader('Content-Type', 'application/json');
      if(req.url.startsWith('/speech-to-text')) return res.end(JSON.stringify({ request_id: 'r1', transcript: 'मेरा बाई घर गया', language_code: 'hi-IN' }));
      if(req.url.startsWith('/v1/audio/transcriptions')) return res.end(JSON.stringify({ text: 'the cat sat on the mat' }));
      res.statusCode = 404; res.end('{}');
    });
  });
  await new Promise(r => svc.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${svc.address().port}`;
  const audio = Buffer.alloc(6000, 7).toString('base64');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-asr-'));
  const sarvam = createAsr({ SARVAM_API_KEY: 'sk-test', SARVAM_API_BASE: base, TAKHTI_ASR_PER_HOUR: '3' });
  const ok = await sarvam.handle({ consent: true, lang: 'hi', mime: 'audio/webm;codecs=opus', audio }, '1.1.1.1');
  check('one line goes to Sarvam in verbatim mode (what was said, not a tidied sentence), Hindi, with the key on the server only — and the text comes back',
    ok.status === 200 && ok.body.transcript === 'मेरा बाई घर गया' && ok.body.provider === 'sarvam' && seen[0].mode === 'verbatim' && seen[0].model === 'saaras:v3' && seen[0].lang === 'hi-IN' && seen[0].key === 'sk-test' && seen[0].hasFile, JSON.stringify([ok, seen[0]]));
  check('nothing is kept: no file written anywhere by the reading check', fs.readdirSync(dataDir).length === 0, '');
  check('a parent\'s consent is required', (await sarvam.handle({ lang: 'hi', audio }, '1.1.1.2')).status === 403, '');
  check('a cut-off or bogus recording is refused before it goes anywhere', (await sarvam.handle({ consent: true, audio: 'not audio!' }, '1.1.1.3')).status === 400 && seen.length === 1, '');
  await sarvam.handle({ consent: true, lang: 'en', audio }, '9.9.9.9'); await sarvam.handle({ consent: true, lang: 'en', audio }, '9.9.9.9'); await sarvam.handle({ consent: true, lang: 'en', audio }, '9.9.9.9');
  check('a limit per address', (await sarvam.handle({ consent: true, lang: 'en', audio }, '9.9.9.9')).status === 429, '');
  check('no speech service set up: an honest 503', (await createAsr({}).handle({ consent: true, audio }, '1.1.1.4')).status === 503, '');
  const whisper = createAsr({ WHISPER_API_KEY: 'wk', WHISPER_URL: base + '/v1/audio/transcriptions' });
  const w = await whisper.handle({ consent: true, lang: 'en', mime: 'audio/webm', audio }, '2.2.2.2');
  check('an OpenAI-compatible transcription service works the same way', w.status === 200 && w.body.transcript === 'the cat sat on the mat' && w.body.provider === 'whisper' && seen.slice(-1)[0].lang === 'en', JSON.stringify(w));

  /* ---------- 2. the app ---------- */
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
  const appServer = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => appServer.listen(0, '127.0.0.1', r));
  const boot = async (voice, answer) => {
    const vc = new VirtualConsole(), jsErrors = [], sent = [];
    vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
    const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
      beforeParse(win){
        win.SpeechSynthesisUtterance = function(t){ this.text = t; };
        win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
        win.navigator.vibrate = () => {};
        win.URL.createObjectURL = () => 'blob:test'; win.URL.revokeObjectURL = () => {};
        // a stand-in microphone: the recorder gives one chunk and stops when asked
        win.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop(){} }] }) };
        win.MediaRecorder = class { constructor(){ this.state = 'inactive'; this.mimeType = 'audio/webm'; } start(){ this.state = 'recording'; setTimeout(() => this.stop(), 30); }
          stop(){ if(this.state !== 'recording') return; this.state = 'inactive'; this.ondataavailable({ data: new win.Blob([new Uint8Array(5000)], { type: 'audio/webm' }) }); setTimeout(() => this.onstop(), 0); } };
        if(voice){
          win.TAKHTI_VOICE = 'http://voice.test';
          win.fetch = (url, opts) => {
            if(!String(url).startsWith('http://voice.test')) return Promise.reject(new Error('offline'));
            const body = JSON.parse(opts.body); sent.push({ url: String(url).replace('http://voice.test', ''), body });
            if(answer === 'none') return Promise.reject(new Error('no signal'));
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ transcript: answer, provider: 'sarvam' }) });
          };
        }
      } });
    const win = dom.window;
    await new Promise(r => win.addEventListener('load', r));
    win.eval(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][5].click(); win.document.querySelector('.ob-go').click();
    win.eval(`S.game = S.game || 'cricket'; S.name = 'Jai'; if(typeof circleOnboardDone === 'function' && S.ob) circleOnboardDone(false); go('map')`);
    return { win, E: c => win.eval(c), screen: () => win.document.querySelector('#screen').textContent, sent, jsErrors };
  };
  try{
    const plain = await boot(false);
    plain.E(`S.parentPin = '1234'; go('parent')`);
    check('a build with no voice server: no switch, nothing goes anywhere', !/clearer reading check/i.test(plain.screen()) && plain.E(`cloudReadReady()`) === false, '');

    const app = await boot(true, 'मेरा बाई घर गया');
    app.E(`S.parentPin = '1234'; go('parent')`);
    const en = app.screen();
    app.E(`S.lang = 'hi'; render()`);
    const hi = app.screen();
    check('the parent\'s switch, off to begin with, says plainly in both languages that one line goes to the speech service, is checked on the phone, and is not kept', /A clearer reading check/.test(en) && /recording is not kept/.test(en) && /Sarvam/.test(en) &&
      /पढ़ने की और साफ़ जाँच/.test(hi) && /रिकॉर्डिंग कहीं नहीं रखी जाती/.test(hi) && app.E(`S.cloudRead`) === false, en.slice(en.indexOf('A clearer'), en.indexOf('A clearer') + 300));
    app.E(`toggleCloudRead(); S.online = true; STT_LOCAL.hi = 'available'`);
    check('the phone\'s own on-device recognizer always wins (the voice stays on the phone)', app.E(`cloudReadReady()`) === false, '');
    app.E(`STT_LOCAL.hi = 'unavailable'; go('read'); S.ctx = { sentence: 'मेरा भाई घर गया।' }; render(); startListening()`);
    for(let i = 0; i < 100 && !app.E(`!!S.ctx.tokens`); i++) await wait(20);
    check('switch on, no recognizer: the line is recorded, written down by the service, and graded HERE — the slip named like any reading', app.sent.length === 1 && app.sent[0].url === '/reading/asr' && app.sent[0].body.consent === true && app.sent[0].body.lang === 'hi' &&
      app.E(`!!S.ctx.tokens`) && /हवा/.test(app.screen()), JSON.stringify(app.sent.map(x => x.url)) + ' ' + app.screen().slice(-200));
    check('…the recording itself goes nowhere else: no name or id in what is sent', !/Jai|"id"/.test(JSON.stringify(app.sent[0].body).replace(app.sent[0].body.audio, '')), '');

    const off = await boot(true, 'none');
    off.E(`S.cloudRead = true; S.online = true; STT_LOCAL.hi = 'unavailable'; S.lang = 'hi'; go('read'); S.ctx = { sentence: 'मेरा भाई घर गया।' }; render(); startListening()`);
    for(let i = 0; i < 100 && off.E(`S.ctx.live`); i++) await wait(20);
    check('no answer from the service: the honest message, the typed fallback, the lesson goes on', !off.E(`S.ctx.live`) && /इंटरनेट|लिखकर/.test(off.E(`S.ctx.msg || ''`)) && !!off.win.document.querySelector('#typed'), off.E(`S.ctx.msg`));
    check('no uncaught script errors', [plain, app, off].every(x => !x.jsErrors.length), [plain, app, off].map(x => x.jsErrors.join(' | ')).join(' || '));
  }catch(e){ check('the app run finished', false, e.stack); }

  /* ---------- 3. narration ---------- */
  const out = execFileSync(process.execPath, [path.join(root, 'tools/build-audio.mjs'), '--lang', 'hi', '--dry-run', '--provider', 'sarvam'], { env: { PATH: process.env.PATH } }).toString();
  const n = Number((out.match(/unique lines : (\d+)/) || [])[1]);
  check('narration: the builder collects the lessons, every reading line and every letter for either service, and a dry run sends nothing', n > 600 && /voice service : sarvam/.test(out) && /nothing sent/.test(out), out);

  svc.close(); appServer.close();
  console.log('\n' + '-'.repeat(70));
  for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '\n        ' + String(c.detail).slice(0, 500)}`);
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exit(failures ? 1 : 0);
})();
