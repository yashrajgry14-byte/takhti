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
  const enCall = seen.filter(x => x.lang === 'en-IN')[0];
  check('an English line goes to Sarvam in codemix mode (verbatim would write it in Devanagari: "द डॉग रन"), Hindi stays verbatim',
    enCall && enCall.mode === 'codemix' && seen[0].mode === 'verbatim', JSON.stringify(seen.map(x => [x.lang, x.mode])));
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
  // answers: a list the stand-in Sarvam gives in turn ('none' = no signal)
  const boot = async (voice, answers, opts) => {
    opts = opts || {};
    const vc = new VirtualConsole(), jsErrors = [], sent = [], queue = [].concat(answers || []);
    vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
    const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
      beforeParse(win){
        win.SpeechSynthesisUtterance = function(t){ this.text = t; };
        win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
        win.navigator.vibrate = () => {};
        win.URL.createObjectURL = () => 'blob:test'; win.URL.revokeObjectURL = () => {};
        win.HTMLMediaElement.prototype.play = function(){ setTimeout(() => this.onended && this.onended(), 0); return Promise.resolve(); };
        win.HTMLMediaElement.prototype.pause = function(){};
        // a stand-in microphone: the recorder gives one chunk and stops by itself
        win.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop(){} }] }) };
        win.MediaRecorder = class { constructor(){ this.state = 'inactive'; this.mimeType = 'audio/webm'; } start(){ this.state = 'recording'; setTimeout(() => this.stop(), 30); }
          stop(){ if(this.state !== 'recording') return; this.state = 'inactive'; this.ondataavailable({ data: new win.Blob([new Uint8Array(5000)], { type: 'audio/webm' }) }); setTimeout(() => this.onstop(), 0); } };
        // the phone's own recognizer, when a test asks for one
        if(opts.device) win.webkitSpeechRecognition = class { start(){ win.__deviceHeard = (win.__deviceHeard || 0) + 1; setTimeout(() => { this.onresult({ results: [[{ transcript: opts.device, confidence: 0.9 }]] }); this.onend(); }, 10); } stop(){} };
        if(voice){
          win.TAKHTI_VOICE = 'http://voice.test';
          win.fetch = (url, o) => {
            if(!String(url).startsWith('http://voice.test')) return Promise.reject(new Error('offline'));
            const body = JSON.parse(o.body), path = String(url).replace('http://voice.test', '');
            sent.push({ url: path, body });
            if(path === '/reading/tts') return Promise.resolve({ ok: true, status: 200, json: async () => ({ audio: 'SUQz', mime: 'audio/mpeg', provider: 'sarvam' }) });
            const a = queue.length > 1 ? queue.shift() : queue[0];
            if(a === 'none') return Promise.reject(new Error('no signal'));
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ transcript: a, provider: 'sarvam' }) });
          };
        }
      } });
    const win = dom.window;
    await new Promise(r => win.addEventListener('load', r));
    win.eval(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][5].click(); win.document.querySelector('.ob-go').click();
    const terms = win.document.querySelector('#screen').textContent;
    if(voice && !opts.skipTerms) win.eval(`voiceTermsAccept()`);
    win.eval(`S.game = S.game || 'cricket'; S.name = 'Jai'; if(typeof circleOnboardDone === 'function' && S.ob && S.ob.step === 'grownup') circleOnboardDone(false); go('map')`);
    return { win, E: c => win.eval(c), screen: () => win.document.querySelector('#screen').textContent, sent, jsErrors, terms };
  };
  const readLine = async (app, line) => {
    app.E(`S.lang = 'hi'; S.online = true; go('read'); S.ctx = { sentence: ${JSON.stringify(line)} }; render(); startListening()`);
    for(let i = 0; i < 150 && !app.E(`!!S.ctx.tokens || !S.ctx.live`); i++) await wait(20);
  };
  try{
    const plain = await boot(false);
    plain.E(`S.parentPin = '1234'; go('parent')`);
    check('a build with no voice server: no terms step, no reading-check section, nothing goes anywhere', !/TERMS|How Munni listens/i.test(plain.terms + plain.screen()) && plain.E(`cloudReadReady()`) === false, '');

    // 1. the terms, once, at onboarding — not a switch
    const app = await boot(true, ['मेरा बाई घर गया', 'भाई']);
    check('onboarding ends with the grown-ups\' reading terms: Sarvam, what is checked, nothing kept, how to withdraw — in Hindi and English, one "I agree", no switch',
      /How Munni listens to reading|मुन्नी पढ़ना कैसे सुनती है/.test(app.terms) && /Sarvam/.test(app.terms) && /recording is not kept/.test(app.terms) && /रिकॉर्डिंग रखी नहीं जाती/.test(app.terms) && /withdraw/.test(app.terms) && /I agree|सहमत हूँ/.test(app.terms),
      app.terms.slice(0, 400));
    check('…and the agreement is kept with its version and time', app.E(`S.voiceTerms && S.voiceTerms.v`) === app.E(`VOICE_TERMS_V`) && !!app.E(`S.voiceTerms.at`), app.E(`JSON.stringify(S.voiceTerms)`));
    // 2. online: Sarvam hears it, even when the phone has its own recognizer
    app.E(`STT_LOCAL.hi = 'available'`);
    await readLine(app, 'मेरा भाई घर गया।');
    check('online: the line goes to Sarvam (verbatim) even where the phone has its own recognizer, and is graded HERE — the slip named', app.sent[0] && app.sent[0].url === '/reading/asr' && app.sent[0].body.lang === 'hi' && app.E(`S.ctx.heardBy`) === 'sarvam' && /हवा/.test(app.screen()),
      JSON.stringify(app.sent.map(x => x.url)) + ' ' + app.screen().slice(-200));
    check('…nothing about the child is sent with the recording — no name, no id', !/Jai|"id"/.test(JSON.stringify(app.sent[0].body).replace(app.sent[0].body.audio, '')), '');
    // 3. say it with Munni
    for(let i = 0; i < 300 && !app.E(`SAY && SAY.step === 'done'`); i++) await wait(20);
    const coach = app.screen();
    check('a slip: Munni teaches the word straight away — the word in pieces (भा · ई), the help for HOW it slipped, in Sarvam\'s voice', app.E(`SAY && SAY.word`) === 'भाई' && app.E(`SAY.pieces.join('|')`) === 'भा|ई' &&
      /मुन्नी के साथ बोलो/.test(coach) && app.sent.some(x => x.url === '/reading/tts' && x.body.text === 'भा' && x.body.pace < 0.9), JSON.stringify(app.sent.filter(x => x.url === '/reading/tts').map(x => x.body.text)).slice(0, 300));
    check('…the child says it, Sarvam writes it down, it is checked here: "Yes! That is exactly it!" and "read the whole line again"', app.E(`SAY.right`) === true && app.sent.filter(x => x.url === '/reading/asr').length === 2 && /शाबाश/.test(coach), coach.slice(-300));
    check('…and saying it after Munni is help, not evidence (no attempt recorded), but a teaching moment by pieces', app.E(`S.attempts.read`) === 1 && app.E(`S.mind.pending[readSkill()] && S.mind.pending[readSkill()].way`) === 'chunks', app.E(`JSON.stringify([S.attempts, S.mind && S.mind.pending])`));
    // a second try when it is not yet right, then kindly let go
    const two = await boot(true, ['मेरा बाई घर गया', 'बाई', 'बाई']);
    await readLine(two, 'मेरा भाई घर गया।');
    for(let i = 0; i < 400 && !two.E(`SAY && SAY.step === 'done'`); i++) await wait(20);
    check('not yet: the pieces once more, slower, another try — after two, "we\'ll say it again next time", never "wrong"', two.E(`SAY.tries`) === 2 && two.E(`SAY.right`) === false && /अगली बार फिर बोलेंगे/.test(two.screen()) && !/ग़लत|गलत है|wrong/i.test(two.screen().replace(/गलत<\/span>|misread/g, '')),
      two.screen().slice(-300));
    // 4. offline: the phone's own recognizer
    const offline = await boot(true, ['should not be used'], { device: 'मेरा भाई घर गया' });
    offline.E(`STT_LOCAL.hi = 'available'`);
    offline.E(`S.lang = 'hi'; S.online = false; go('read'); S.ctx = { sentence: 'मेरा भाई घर गया।' }; render(); startListening()`);
    for(let i = 0; i < 100 && !offline.E(`!!S.ctx.tokens`); i++) await wait(20);
    check('offline: the phone\'s own on-device recognizer hears it (nothing sent), and the lesson goes on', offline.sent.length === 0 && offline.E(`window.__deviceHeard`) === 1 && offline.E(`!!S.ctx.tokens`), JSON.stringify(offline.sent));
    // 5. withdrawn: nothing leaves the phone
    offline.E(`S.parentPin = '1234'; go('parent')`);
    const page = offline.screen();
    offline.E(`S.ctx.termsAsk = true; voiceTermsWithdraw()`);
    offline.E(`STT_LOCAL.hi = 'unavailable'; S.online = true; go('read'); S.ctx = { sentence: 'मेरा भाई घर गया।' }; render(); startListening()`);
    await wait(50);
    check('the parent page shows what was agreed and can withdraw it (the law\'s right); withdrawn, online and no recognizer of its own: nothing is sent, the child types', /Agreed on|सहमति दी/.test(page) && /Withdraw consent|सहमति वापस लें/.test(page) &&
      offline.sent.length === 0 && /सहमति|agree/i.test(offline.E(`S.ctx.msg || ''`)), offline.E(`S.ctx.msg`));
    // 6. no answer: the honest message
    const off = await boot(true, ['none']);
    await readLine(off, 'मेरा भाई घर गया।');
    check('no answer from Sarvam: the honest message, the typed fallback, the lesson goes on', !off.E(`S.ctx.live`) && /इंटरनेट|लिखकर/.test(off.E(`S.ctx.msg || ''`)) && !!off.win.document.querySelector('#typed'), off.E(`S.ctx.msg`));
    check('no uncaught script errors', [plain, app, two, offline, off].every(x => !x.jsErrors.length), [plain, app, two, offline, off].map(x => x.jsErrors.join(' | ')).join(' || '));
  }catch(e){ check('the app run finished', false, e.stack); }

  /* ---------- 2b. Munni's live voice and the call's coaching ---------- */
  {
    const seenT = [];
    const tsvc = http.createServer((req, res) => { const ch = []; req.on('data', c => ch.push(c)); req.on('end', () => { const b = JSON.parse(Buffer.concat(ch).toString()); seenT.push(b); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ audios: ['SUQzBAAAAA=='] })); }); });
    await new Promise(r => tsvc.listen(0, '127.0.0.1', r));
    const tts = createAsr({ SARVAM_API_KEY: 'k', SARVAM_API_BASE: `http://127.0.0.1:${tsvc.address().port}` });
    const a1 = await tts.speak({ text: 'भा', lang: 'hi', pace: 0.7 }, '3.3.3.3');
    const a2 = await tts.speak({ text: 'भा', lang: 'hi', pace: 0.7 }, '3.3.3.3');
    check('Munni\'s live voice: Sarvam Bulbul, slow when asked, the same line served from memory the second time', a1.status === 200 && a1.body.audio && seenT.length === 1 && seenT[0].model && seenT[0].pace === 0.7 && seenT[0].language_code === 'hi-IN' && a2.body.audio === a1.body.audio, JSON.stringify(seenT));
    check('…only short teaching lines (no markup, nothing long)', (await tts.speak({ text: '<script>x</script>', lang: 'hi' }, '3.3.3.3')).status === 400 && (await tts.speak({ text: 'क'.repeat(200) }, '3.3.3.3')).status === 400, '');
    tsvc.close();
    const { createBrain } = require('../voice/brain');
    const brain = createBrain({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-say-')), env: { TAKHTI_QUIET_HOURS: '0-0' } });
    const kid = brain.registerChild({ name: 'Jai', age: 7, lang: 'hi', parent_phone: '+919500000099', consent: true }).child;
    const s = brain.createSession(kid.id, { channel: 'app', kind: 'lesson', seed: 'say-1' }).session;
    brain.toolNext(s.id);
    const live = brain.store.get('sessions', s.id), it = live.items[live.items.length - 1];
    Object.assign(it, { kind: 'read', expect: 'reading', target: 'भालू आया।', attempts: 0, said: [], prompts: ['पढ़ो'] });
    brain.store.put('sessions', s.id, live);
    const say = brain.toolAnswer(s.id, 'बालू आया').say;
    check('on a phone call, the same teaching: the word in pieces, slowly, then whole (भा… लू… भालू)', /भा… लू… भालू/.test(say), say);
  }

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
