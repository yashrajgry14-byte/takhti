/* ==================================================================
   SPEECH PROVIDERS — Gemini first, Sarvam as the backup (voice/speech.js)

   Against one stand-in that answers as both Gemini (hearing, TTS, the
   Batch API) and Sarvam (speech-to-text, text-to-speech):

   · the switch, both ways: SPEECH_PROVIDER unset or gemini → Gemini;
     sarvam → Sarvam only, Gemini never called; and back again
   · the reading check with Gemini: the clip as inline audio, structured
     output, a per-word answer, the response in the shape the reading
     check always had ({ transcript, provider }, `words` extra); the line
     sent only when it is one of the server's own reading lines (or a word
     of one) — a phone's made-up line is never put in the prompt
   · the fallback order: Gemini failing or too slow → Sarvam; neither →
     "skipped" inside the budget (under the phone's 10 s); with
     SPEECH_PROVIDER=sarvam, Sarvam down → skipped, no Gemini
   · narration: Gemini TTS (the model id from the docs, WAV out, raw PCM
     wrapped, the older voice field tried after a 400); the content pack
     built through the Batch API by tools/build-audio.mjs (WAV without an
     mp3 encoder, mp3 with one); live narration only ever by the backup
   · nothing kept: no clip, no transcript, no audio in the server's data
     folder; the phone keeps a skipped line to read again — never audio
   · the phone: prebuilt audio → the live backup → the phone's own voice;
     a .wav pack plays; older (v2) terms send nothing; a skipped check
     never blocks the lesson (honest message, typing, the line comes back)
   · Teach Munni hears with the same provider and order
   · tools/compare-speech.mjs: where each provider misjudged, and the
     switch-back advice when Gemini hides children's Hindi slips
   ================================================================== */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execFile } = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
let failures = 0, passes = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 700)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));
const run = (file, args, env) => new Promise(res => execFile(process.execPath, [file, ...args], { env: { ...process.env, ...env }, timeout: 120000 }, (err, out, errOut) => res({ code: err ? err.code || 1 : 0, out: String(out), err: String(errOut) })));

process.env.TAKHTI_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-speech-'));
const speech = require('../voice/speech.js');

/* ---------- the stand-in: Gemini and Sarvam on one port ---------- */
const G = { hear: 'ok', said: 'मेरा बाई स्कूल जाता है', tts: 'wav', batchPolls: 0, calls: [], sarvam: 'ok', sarvamSaid: 'मेरा बाई स्कूल जाता है' };
const SILENCE = speech.wavFromPcm(Buffer.alloc(4800), 24000);
const stand = http.createServer((req, res) => {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    const raw = Buffer.concat(chunks), url = req.url;
    const json = (status, obj) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
    if(url.startsWith('/speech-to-text')){
      G.calls.push({ who: 'sarvam-stt', body: raw.toString('latin1').replace(/[^\x20-\x7e\n]/g, '') });
      if(G.sarvam === 'fail') return json(500, {});
      return json(200, { transcript: G.sarvamSaid });
    }
    if(url.startsWith('/text-to-speech')){
      G.calls.push({ who: 'sarvam-tts', body: JSON.parse(raw) });
      if(G.sarvam === 'fail') return json(500, {});
      return json(200, { audios: [Buffer.from('ID3-sarvam-mp3').toString('base64')] });
    }
    if(/:batchGenerateContent$/.test(url)){
      const body = JSON.parse(raw);
      G.batch = body; G.batchPolls = 0;
      G.calls.push({ who: 'gemini-batch', url, headers: req.headers });
      return json(200, { name: 'batches/b-1', metadata: { state: 'JOB_STATE_PENDING' } });
    }
    if(url.startsWith('/v1beta/batches/')){
      G.batchPolls++;
      if(G.batchPolls < 2) return json(200, { name: 'batches/b-1', metadata: { state: 'JOB_STATE_RUNNING' } });
      const reqs = G.batch.batch.input_config.requests.requests;
      return json(200, { name: 'batches/b-1', metadata: { state: 'JOB_STATE_SUCCEEDED' }, response: { inlinedResponses: { inlinedResponses: reqs.map(r => ({
        metadata: r.metadata, response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: SILENCE.toString('base64') } }] } }] } })) } } });
    }
    if(/:generateContent$/.test(url)){
      const body = JSON.parse(raw), model = decodeURIComponent(url.split('/models/')[1].split(':')[0]);
      G.calls.push({ who: 'gemini', model, body, headers: req.headers, url });
      if(/tts/.test(model)){
        if(G.tts === 'v400' && body.generationConfig.speechConfig.voiceConfig.voice) return json(400, { error: { message: 'unknown field voice' } });
        const data = G.tts === 'pcm' ? Buffer.alloc(4800).toString('base64') : SILENCE.toString('base64');
        return json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: G.tts === 'pcm' ? 'audio/L16;codec=pcm;rate=24000' : 'audio/wav', data } }] } }] });
      }
      if(G.hear === 'fail') return json(500, { error: { message: 'boom' } });
      if(G.hear === 'hang'){ await wait(5000); return json(200, {}); }
      const line = ((body.contents[0].parts || []).find(p => p.text) || {}).text;
      const words = line ? line.replace('The line: ', '').split(/\s+/).map((w, i) => ({ word: w, said: G.said.split(/\s+/)[i] || '' })) : undefined;
      return json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ said: G.said, ...(words ? { words } : {}) }) }] } }] });
    }
    json(404, {});
  });
});

(async () => {
  await new Promise(r => stand.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${stand.address().port}`;
  const GEM = { GEMINI_API_KEY: 'gk-secret', GEMINI_API_BASE: BASE };
  const SAR = { SARVAM_API_KEY: 'sk-secret', SARVAM_API_BASE: BASE };
  const clip = { buf: Buffer.alloc(6000, 7), mime: 'audio/webm;codecs=opus' };
  const LINE = 'मेरा भाई स्कूल जाता है';
  const reset = () => { G.calls = []; G.hear = 'ok'; G.sarvam = 'ok'; G.tts = 'wav'; };

  /* ================= the switch ================= */
  reset();
  let r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, ...SAR } });
  const hearCall = G.calls.find(c => c.who === 'gemini');
  check('SPEECH_PROVIDER unset → Gemini hears the reading check (the default since 12 Nov 2026)', r.provider === 'gemini' && !!hearCall && !G.calls.some(c => c.who === 'sarvam-stt'), JSON.stringify(r));
  check('…with gemini-3.8-flash, the key in a header (never the URL), the clip as inline audio with its type, structured output',
    hearCall.model === 'gemini-3.8-flash' && hearCall.headers['x-goog-api-key'] === 'gk-secret' && !/gk-secret/.test(hearCall.url)
      && hearCall.body.contents[0].parts[0].inline_data.mime_type === 'audio/webm' && hearCall.body.contents[0].parts[0].inline_data.data === clip.buf.toString('base64')
      && /responseFormat|responseJsonSchema/.test(JSON.stringify(hearCall.body.generationConfig)), JSON.stringify(hearCall && hearCall.body).slice(0, 300));
  check('…told to write what it hears, a misreading kept as said ("बाई" for "भाई"), never corrected', /never what the child should have said/.test(JSON.stringify(hearCall.body.systemInstruction)) && /बाई/.test(JSON.stringify(hearCall.body.systemInstruction)), '');
  check('…the answer in the shape the reading check always had: { transcript, provider }, plus each word of the line and what was said for it',
    r.transcript === G.said && Array.isArray(r.words) && r.words[1].word === 'भाई' && r.words[1].said === 'बाई', JSON.stringify(r));
  reset();
  r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, ...SAR, SPEECH_PROVIDER: 'sarvam' } });
  check('SPEECH_PROVIDER=sarvam → Sarvam only (verbatim mode, Hindi), Gemini never called', r.provider === 'sarvam' && r.transcript === G.sarvamSaid && !G.calls.some(c => c.who === 'gemini')
    && /verbatim/.test(G.calls.find(c => c.who === 'sarvam-stt').body) && /hi-IN/.test(G.calls.find(c => c.who === 'sarvam-stt').body), JSON.stringify(r));
  reset();
  r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, ...SAR, SPEECH_PROVIDER: 'gemini' } });
  check('…and back: SPEECH_PROVIDER=gemini → Gemini again', r.provider === 'gemini', JSON.stringify(r));

  /* ================= the fallback order ================= */
  reset(); G.hear = 'fail';
  r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, ...SAR } });
  check('Gemini failing → Sarvam answers (and says it fell back)', r.provider === 'sarvam' && r.transcript === G.sarvamSaid && r.fellBack && r.fellBack[0] === 'gemini', JSON.stringify(r));
  reset(); G.hear = 'hang';
  let t0 = Date.now();
  r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, ...SAR, GEMINI_SPEECH_TIMEOUT_MS: '700', TAKHTI_SPEECH_BUDGET_MS: '3000' } });
  check('Gemini too slow → Sarvam, inside the budget', r.provider === 'sarvam' && Date.now() - t0 < 3000, `${Date.now() - t0} ms ${JSON.stringify(r)}`);
  reset(); G.hear = 'hang';
  t0 = Date.now();
  r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, GEMINI_SPEECH_TIMEOUT_MS: '700', TAKHTI_SPEECH_BUDGET_MS: '3000' } });
  check('Gemini too slow and no Sarvam → "skipped" (503) at once, nothing heard, nothing kept', r.error && r.skipped === true && r.status === 503 && Date.now() - t0 < 1500, `${Date.now() - t0} ms ${JSON.stringify(r)}`);
  reset(); G.sarvam = 'fail';
  r = await speech.checkReading(clip, LINE, 'hi', { env: { ...GEM, ...SAR, SPEECH_PROVIDER: 'sarvam' } });
  check('SPEECH_PROVIDER=sarvam and Sarvam down → skipped, still no Gemini', r.skipped === true && !G.calls.some(c => c.who === 'gemini'), JSON.stringify(r));
  r = await speech.checkReading(clip, LINE, 'hi', { env: {} });
  check('neither set up → 503, "no speech service"', r.status === 503 && /no speech service/.test(r.error), JSON.stringify(r));

  /* ================= the HTTP routes, through the voice server ================= */
  const { createServer } = require('../voice/server.js');
  const boot = async env => {
    const { server } = createServer({ env, toolToken: 't'.repeat(24), webhookKey: 'w'.repeat(24), adminKey: 'a'.repeat(24) });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const post = (p, body) => fetch(`http://127.0.0.1:${server.address().port}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(async res => ({ status: res.status, body: await res.json().catch(() => ({})) }));
    return { server, post };
  };
  const audio = clip.buf.toString('base64');
  let vs = await boot({ ...GEM, ...SAR });
  reset();
  const known = await vs.post('/reading/asr', { consent: true, lang: 'hi', mime: 'audio/webm', audio, line: 'बिल्ली दूध पीती है।' });
  const knownCall = G.calls.find(c => c.who === 'gemini');
  // a real line from the app's own reading lines
  const realLine = require('vm').runInNewContext(fs.readFileSync(path.join(root, 'src/content/sentences.js'), 'utf8') + ';SENTENCES.hi[1][0]', {});
  reset();
  const real = await vs.post('/reading/asr', { consent: true, lang: 'hi', mime: 'audio/webm', audio, line: realLine });
  const realCall = G.calls.find(c => c.who === 'gemini');
  check('POST /reading/asr: a line the server finds in its own copy of the app\'s reading lines is sent with the clip',
    real.status === 200 && real.body.provider === 'gemini' && JSON.stringify(realCall.body.contents).includes(realLine), JSON.stringify(real));
  check('…a line the phone made up is never put in the prompt — Gemini hears without one', known.status === 200 && !JSON.stringify(knownCall.body.contents).includes('बिल्ली दूध पीती'), JSON.stringify(knownCall && knownCall.body.contents).slice(0, 300));
  check('…the response keeps its shape: transcript and provider (words extra) — no clip, nothing else', typeof real.body.transcript === 'string' && !('audio' in real.body) && Object.keys(real.body).every(k => ['transcript', 'provider', 'words'].includes(k)), JSON.stringify(real.body));
  check('…no consent → 403', (await vs.post('/reading/asr', { lang: 'hi', audio })).status === 403, '');
  vs.server.close();
  vs = await boot({ ...GEM, GEMINI_SPEECH_TIMEOUT_MS: '600', TAKHTI_SPEECH_BUDGET_MS: '2500' });
  reset(); G.hear = 'hang';
  t0 = Date.now();
  const sk = await vs.post('/reading/asr', { consent: true, lang: 'hi', mime: 'audio/webm', audio, line: realLine });
  check('Gemini hanging, no backup: the server says "skipped" well inside the phone\'s 10 s', sk.status === 503 && sk.body.skipped === true && Date.now() - t0 < 2500, `${Date.now() - t0} ms ${JSON.stringify(sk)}`);
  reset();
  const tts0 = await vs.post('/reading/tts', { text: 'हाँ! बिलकुल ऐसे ही!', lang: 'hi' });
  check('live narration (POST /reading/tts) never uses Gemini: with no backup set up it says so, and the phone uses its own voice', tts0.status === 503 && !G.calls.some(c => c.who === 'gemini'), JSON.stringify(tts0));
  vs.server.close();
  vs = await boot({ ...GEM, ...SAR, TAKHTI_ASR_PER_HOUR: '3' });
  reset();
  const tts1 = await vs.post('/reading/tts', { text: 'हाँ! बिलकुल ऐसे ही!', lang: 'hi', pace: 0.7 });
  check('…with Sarvam set up, the backup speaks it live (slowed), still no Gemini', tts1.status === 200 && tts1.body.provider === 'sarvam' && G.calls.find(c => c.who === 'sarvam-tts').body.pace === 0.7 && !G.calls.some(c => c.who === 'gemini'), JSON.stringify(tts1));
  let limited = 0;
  for(let i = 0; i < 5; i++) if((await vs.post('/reading/asr', { consent: true, lang: 'hi', mime: 'audio/webm', audio })).status === 429) limited++;
  check('a limit per address on the reading check', limited >= 1, limited);
  // Teach Munni hears with the same provider and order
  reset(); G.hear = 'fail';
  const tj = await vs.post('/teach/judge', { consent: true, lang: 'hi', mime: 'audio/webm', audio, ask: 'borrow.when', aims: [{ id: 'borrow.when', kind: 'explain' }] });
  check('Teach Munni hears the same way: Gemini failing → Sarvam wrote the explanation down', tj.status === 200 && tj.body.provider === 'sarvam' && tj.body.transcript === G.sarvamSaid, JSON.stringify(tj));
  vs.server.close();
  // readings to Sarvam, explanations to Gemini: TAKHTI_TEACH_HEAR
  vs = await boot({ ...GEM, ...SAR, SPEECH_PROVIDER: 'sarvam', TAKHTI_TEACH_HEAR: 'gemini' });
  reset();
  const rd = await vs.post('/reading/asr', { consent: true, lang: 'hi', mime: 'audio/webm', audio, line: realLine });
  const tj2 = await vs.post('/teach/judge', { consent: true, lang: 'hi', mime: 'audio/webm', audio, ask: 'borrow.when', aims: [{ id: 'borrow.when', kind: 'explain' }] });
  check('SPEECH_PROVIDER=sarvam with TAKHTI_TEACH_HEAR=gemini: a reading goes to Sarvam only, an explanation is heard by Gemini',
    rd.body.provider === 'sarvam' && tj2.status === 200 && tj2.body.provider === 'gemini' && tj2.body.transcript === G.said, JSON.stringify([rd.body, tj2.body]));
  reset(); G.hear = 'fail';
  const tj3 = await vs.post('/teach/judge', { consent: true, lang: 'hi', mime: 'audio/webm', audio, ask: 'borrow.when', aims: [{ id: 'borrow.when', kind: 'explain' }] });
  check('…and Gemini failing on an explanation falls back to the usual order (Sarvam)', tj3.status === 200 && tj3.body.provider === 'sarvam', JSON.stringify(tj3.body));
  vs.server.close();
  // nothing kept
  const kept = [];
  const walk = d => { for(const f of fs.readdirSync(d)){ const p = path.join(d, f); if(fs.statSync(p).isDirectory()) walk(p); else kept.push(fs.readFileSync(p, 'utf8')); } };
  walk(process.env.TAKHTI_DATA_DIR);
  const all = kept.join('\n');
  check('nothing kept: no clip, no transcript, no audio anywhere in the server\'s data folder', !all.includes(audio.slice(0, 60)) && !all.includes(G.said) && !all.includes(G.sarvamSaid) && !all.includes(SILENCE.toString('base64').slice(0, 60)), `${kept.length} files`);

  /* ================= narration ================= */
  reset();
  let n = await speech.narrate('चलो, साथ में बोलें।', 'hi', { env: { ...GEM, ...SAR } });
  const ttsCall = G.calls.find(c => c.who === 'gemini');
  check('narrate(): Gemini TTS — gemini-3.8-flash-tts, audio out, voice Kore — answers WAV',
    n.provider === 'gemini' && n.mime === 'audio/wav' && Buffer.from(n.audio, 'base64').slice(0, 4).toString() === 'RIFF'
      && ttsCall.model === 'gemini-3.8-flash-tts' && ttsCall.body.generationConfig.responseModalities[0] === 'AUDIO' && ttsCall.body.generationConfig.speechConfig.voiceConfig.voice === 'Kore', JSON.stringify(ttsCall && ttsCall.body).slice(0, 300));
  reset(); G.tts = 'pcm';
  n = await speech.narrate('Now you say it!', 'en', { env: GEM });
  check('…raw PCM (an older answer form) is wrapped into a playable WAV', n.mime === 'audio/wav' && Buffer.from(n.audio, 'base64').slice(0, 4).toString() === 'RIFF' && Buffer.from(n.audio, 'base64').readUInt32LE(24) === 24000, JSON.stringify({ ...n, audio: undefined }));
  reset(); G.tts = 'v400';
  n = await speech.narrate('Now you say it!', 'en', { env: GEM });
  check('…a 400 on the voice field → one retry with the older voice field', n.provider === 'gemini' && G.calls.filter(c => c.who === 'gemini').length === 2
    && G.calls[1].body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === 'Kore', JSON.stringify(G.calls.map(c => c.body.generationConfig)));
  reset();
  n = await speech.narrate('Now you say it!', 'en', { env: { ...GEM, ...SAR, SPEECH_PROVIDER: 'sarvam' } });
  check('narrate() with SPEECH_PROVIDER=sarvam → Sarvam Bulbul, no Gemini', n.provider === 'sarvam' && !G.calls.some(c => c.who === 'gemini'), JSON.stringify(n));

  // the content pack, through the Batch API
  const out1 = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-pack-'));
  reset();
  let b = await run(path.join(root, 'tools/build-audio.mjs'), ['--lang', 'hi', '--limit', '6', '--out', out1], { ...GEM, SARVAM_API_KEY: '', ELEVEN_API_KEY: '', SPEECH_PROVIDER: '', TAKHTI_BATCH_POLL_MS: '20', TAKHTI_NO_FFMPEG: '1' });
  let man = fs.existsSync(path.join(out1, 'manifest-hi.json')) ? JSON.parse(fs.readFileSync(path.join(out1, 'manifest-hi.json'), 'utf8')) : {};
  const keys = Object.keys(man);
  check('tools/build-audio.mjs: Gemini by default, one Batch API job (gemini-3.8-flash-tts, key in a header), polled until it succeeded',
    b.code === 0 && /voice service : gemini/.test(b.out) && G.calls.some(c => c.who === 'gemini-batch' && /gemini-3\.8-flash-tts:batchGenerateContent$/.test(c.url) && c.headers['x-goog-api-key'] === 'gk-secret') && G.batchPolls >= 2, b.out + b.err);
  check('…every line written, without an mp3 encoder as WAV (the manifest says x:"wav")',
    keys.length === 6 && keys.every(k => man[k].x === 'wav' && man[k].v === 'gemini' && fs.readFileSync(path.join(out1, 'hi', k + '.wav')).slice(0, 4).toString() === 'RIFF'), JSON.stringify(man).slice(0, 300));
  reset();
  b = await run(path.join(root, 'tools/build-audio.mjs'), ['--lang', 'hi', '--limit', '6', '--out', out1], { ...GEM, TAKHTI_BATCH_POLL_MS: '20', TAKHTI_NO_FFMPEG: '1' });
  const sentAgain = (G.batch ? G.batch.batch.input_config.requests.requests : []).map(x => x.metadata.key);
  check('…a second run carries on: it sends only lines not yet rendered, and counts what is done', b.code === 0 && /already done : 6\b/.test(b.out) && sentAgain.length === 6 && sentAgain.every(k => !keys.includes(k)), b.out + JSON.stringify(sentAgain));
  let hasFfmpeg = true; try{ require('child_process').execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }catch(e){ hasFfmpeg = false; }
  if(hasFfmpeg){
    const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-pack-'));
    b = await run(path.join(root, 'tools/build-audio.mjs'), ['--lang', 'en', '--limit', '3', '--out', out2], { ...GEM, TAKHTI_BATCH_POLL_MS: '20' });
    man = JSON.parse(fs.readFileSync(path.join(out2, 'manifest-en.json'), 'utf8'));
    check('…with ffmpeg, small mp3s (no x in the manifest)', Object.keys(man).length === 3 && Object.keys(man).every(k => !man[k].x && fs.existsSync(path.join(out2, 'en', k + '.mp3'))), b.out + b.err);
  }
  reset();
  b = await run(path.join(root, 'tools/build-audio.mjs'), ['--lang', 'hi', '--limit', '2', '--out', fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-pack-')), '--provider', 'sarvam'], { ...SAR, GEMINI_API_KEY: '' });
  check('…and --provider sarvam still builds the pack with Sarvam', /voice service : sarvam/.test(b.out), b.out + b.err);

  /* ================= the phone ================= */
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const appServer = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => appServer.listen(0, '127.0.0.1', r));
  const app = async voiceReply => {
    const vc = new VirtualConsole(), jsErrors = [], sent = [], spoken = [], played = [];
    vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
    const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
      beforeParse(win){
        win.SpeechSynthesisUtterance = function(t){ this.text = t; };
        win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => { spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 0); } };
        win.HTMLMediaElement.prototype.play = function(){ played.push(this.src); setTimeout(() => this.onended && this.onended(), 0); return Promise.resolve(); };
        win.HTMLMediaElement.prototype.pause = function(){};
        win.URL.createObjectURL = () => 'blob:clip'; win.URL.revokeObjectURL = () => {};
        win.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop(){} }] }) };
        win.MediaRecorder = class { constructor(){ this.state = 'inactive'; this.mimeType = 'audio/webm'; } start(){ this.state = 'recording'; setTimeout(() => this.stop(), 30); }
          stop(){ if(this.state !== 'recording') return; this.state = 'inactive'; this.ondataavailable({ data: new win.Blob([new Uint8Array(5000)], { type: 'audio/webm' }) }); setTimeout(() => this.onstop(), 0); } };
        win.TAKHTI_VOICE = 'http://voice.test';
        win.fetch = (url, o) => {
          if(!String(url).startsWith('http://voice.test')) return Promise.reject(new Error('offline'));
          const p = String(url).replace('http://voice.test', ''), body = JSON.parse(o.body);
          sent.push({ url: p, body });
          const [status, json] = voiceReply(p, body);
          return Promise.resolve({ ok: status < 300, status, json: async () => json });
        };
      } });
    const win = dom.window;
    await new Promise(r => win.addEventListener('load', r));
    win.eval(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][5].click(); win.document.querySelector('.ob-go').click();
    win.eval(`S.game = S.game || 'cricket'; S.name = 'Jai'; S.age = 8; S.ob = null; S.online = true; go('map')`);
    return { win, E: x => win.eval(x), sent, spoken, played, jsErrors, screen: () => win.document.querySelector('#screen').textContent };
  };
  try{
    let liveFails = false;
    const a = await app((p, body) => p === '/reading/tts' ? (liveFails ? [503, { error: 'no voice' }] : [200, { audio: 'SUQz', mime: 'audio/mpeg', provider: 'sarvam' }])
      : p === '/reading/asr' ? [503, { error: 'no speech service answered in time — skipped, nothing kept', skipped: true }] : [200, {}]);
    await wait(150);   // the boot's own manifest fetches settle first
    a.E(`S.muted = false; VOICE_MANIFEST.en = { [lineKey('In the pack', 'en')]: { t: 'In the pack', x: 'wav' } }; VOICE_MANIFEST.hi = {}`);
    a.played.length = 0; a.sent.length = 0;
    a.E(`speak('In the pack', 'en')`); await wait(40);
    check('the phone, 1: a line in the offline pack plays from the pack — a .wav pack too — and nothing goes online', a.played.some(s => /audio\/en\/[0-9a-f]{16}\.wav$/.test(s)) && !a.sent.length, JSON.stringify(a.played));
    a.played.length = 0;
    a.E(`setOnline(true)`);
    const why = a.E(`JSON.stringify([S.online, TALK_URL, voicePackLoaded('en'), S.muted])`);
    a.E(`speak('Not in the pack yet', 'en')`); await wait(80);
    check('…2: a line the pack lacks → the live backup (POST /reading/tts) plays it', a.sent.some(x => x.url === '/reading/tts' && x.body.text === 'Not in the pack yet') && a.played.some(s => /^data:audio\/mpeg;base64,SUQz/.test(s)), JSON.stringify([why, a.sent, a.played]));
    liveFails = true; a.spoken.length = 0;
    a.E(`speak('Also not in the pack', 'en')`); await wait(150);
    check('…3: the backup can\'t → the phone\'s own voice', a.spoken.includes('Also not in the pack'), JSON.stringify(a.spoken));
    a.spoken.length = 0; a.sent.length = 0;
    a.E(`speak('Hindi line', 'hi')`); await wait(150);
    check('…no pack for a language at all → the phone\'s voice, without going online for every line', a.spoken.includes('Hindi line') && !a.sent.length, JSON.stringify(a.sent));

    // reading: older terms send nothing; v3 terms → the voice server; skipped → never blocks
    a.E(`S.voiceTerms = { v: 2, at: '2026-11-01', by: 'parent' }; S.lang = 'hi'; go('read')`);
    check('older (v2) terms: the clearer check is off — nothing would leave the phone', a.E(`cloudReadReady()`) === false, '');
    a.E(`S.voiceTerms = { v: VOICE_TERMS_V, at: '2026-11-12', by: 'parent' }; S.ctx = { sentence: ${JSON.stringify(realLine)} }; render()`);
    check('the current terms are v3, and with them the check goes to the voice server', a.E(`VOICE_TERMS_V`) === 3 && a.E(`cloudReadReady()`) === true, '');
    a.sent.length = 0;
    a.E(`startListening()`);
    for(let i = 0; i < 50 && a.E(`!!S.ctx.live`); i++) await wait(20);
    const asr = a.sent.find(x => x.url === '/reading/asr');
    check('…the phone sends the clip with consent and the line it showed (the server decides whether to trust it)', !!asr && asr.body.consent === true && asr.body.line === realLine && asr.body.audio.length > 100, JSON.stringify(asr && { ...asr.body, audio: '…' }));
    check('a skipped check never blocks the lesson: an honest message, the typed fallback, and the line kept to read again — never the recording',
      /couldn't hear that one just now|अभी यह नहीं सुन पाई/.test(a.screen()) && a.E(`S.ctx.live`) === false && !!a.win.document.querySelector('#screen input') && a.E(`JSON.stringify(S.readAgain)`) === JSON.stringify([realLine]), JSON.stringify([a.E(`S.ctx.msg`), a.E(`S.ctx.live`), !!a.win.document.querySelector('#screen input'), a.E(`JSON.stringify(S.readAgain)`), a.screen().slice(0, 600)]));
    a.E(`S.ctx = {}; go('map'); go('read')`);
    check('…the Reading Tree offers that line again next time', a.E(`S.ctx.sentence`) === realLine && a.E(`S.readAgain.length`) === 0, a.E(`S.ctx.sentence`));
    const stored = a.E(`JSON.stringify(localStorage)`);
    check('the phone keeps no recording', !/AAAAAAAAAAAAAAAAAAAA/.test(stored) && !/audio\/webm;base64|"audio":"/.test(stored), stored.length);
    check('no uncaught script errors', a.jsErrors.length === 0, a.jsErrors.join(' | '));
  }catch(e){ check('the phone run finished', false, e.stack); }
  appServer.close();

  /* ================= the day-1 comparison ================= */
  const clips = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-clips-'));
  const lines = ['मेरा भाई स्कूल जाता है', 'मेरा भाई घर आता है', 'मेरा भाई दूध पीता है'];
  lines.forEach((l, i) => {
    fs.writeFileSync(path.join(clips, `riya-0${i}.webm`), Buffer.alloc(3000, i + 1));
    fs.writeFileSync(path.join(clips, `riya-0${i}.txt`), l);
    fs.writeFileSync(path.join(clips, `riya-0${i}.truth.txt`), l.replace('भाई', 'बाई'));   // she said बाई every time
  });
  fs.writeFileSync(path.join(clips, 'cat.webm'), Buffer.alloc(3000, 9));
  fs.writeFileSync(path.join(clips, 'cat.txt'), 'The cat sat on the mat');
  // Gemini tidies the slip away; Sarvam writes down what was said
  const cmp = async () => run(path.join(root, 'tools/compare-speech.mjs'), [clips], { ...GEM, ...SAR, TAKHTI_DATA_DIR: process.env.TAKHTI_DATA_DIR });
  G.said = 'मेरा भाई स्कूल जाता है'; G.sarvamSaid = 'मेरा बाई स्कूल जाता है'; G.hear = 'ok'; G.sarvam = 'ok';
  let c = await cmp();
  check('tools/compare-speech.mjs: each clip through both providers, and where each misjudged — Gemini "MISSED A SLIP" on भाई, Sarvam judged every word right',
    c.code === 0 && /riya-00\.webm[\s\S]*?gemini[^\n]*MISSED A SLIP on भाई/.test(c.out) && /riya-00\.webm[\s\S]*?sarvam[^\n]*judged every word right/.test(c.out), c.out + c.err);
  check('…a clip without a truth file shows where the two disagree, not who is right', /cat\.webm[\s\S]*?(they disagree on|they agree on every word)/.test(c.out), c.out);
  check('…and when Gemini hides children\'s Hindi slips, it says to switch: SPEECH_PROVIDER=sarvam', /Hindi: Sarvam is better/.test(c.out) && /Use SPEECH_PROVIDER=sarvam/.test(c.out), c.out.split('\n').slice(-4).join(' | '));
  G.said = 'मेरा बाई स्कूल जाता है';
  c = await cmp();
  check('…when Gemini hears the slips as well, it names no winner and asks for more clips (never a switch on a tie)', /Hindi: no clear difference/.test(c.out) && /No clear winner yet/.test(c.out) && !/Use SPEECH_PROVIDER/.test(c.out), c.out.split('\n').slice(-4).join(' | '));

  stand.close();
  console.log('\n' + '-'.repeat(70) + `\n${passes}/${passes + failures} checks passed`);
  process.exit(failures ? 1 : 0);
})();
