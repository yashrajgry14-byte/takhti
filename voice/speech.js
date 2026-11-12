'use strict';
/* ==================================================================
   SPEECH — one door for every voice Takhti hears or makes

     narrate(text, lang, opts)              → { audio (base64), mime, provider } | { error, status }
     checkReading(clip, passage, lang, opts) → { transcript, provider, words? }  | { error, status, skipped? }

   Two providers, chosen in voice/.env:  SPEECH_PROVIDER=gemini|sarvam
   (default gemini, from 12 Nov 2026 — the Google buildathon). Sarvam stays
   as the backup; its code is unchanged in voice/asr.js and works as soon
   as it is switched on.

   checkReading — a child's voice → exactly what they said
   · gemini: GEMINI_SPEECH_MODEL (default gemini-3.8-flash), audio in
     (inline_data — webm, ogg, wav… are all listed by the API), structured
     output { said, words:[{word, said}] }. With the passage it also says,
     per word of the line, what the child said for it. It is told to write
     what it HEARS — a child's "बाई" for "भाई" stays "बाई" — because the
     slip is the thing to teach. The phone still grades it with its own
     matcher; the response keeps the shape the reading check always had
     ({ transcript, provider }), `words` is extra.
   · sarvam: Sarvam saaras in verbatim mode (or a Whisper-compatible
     service), exactly as before.
   · The order: SPEECH_PROVIDER=gemini → Gemini, then Sarvam if it is set
     up. SPEECH_PROVIDER=sarvam → Sarvam only: that setting exists for the
     day Gemini mishears children reading Hindi, and a mishearing gives
     wrong marks, which is worse than no mark. Neither answers inside the
     time budget (TAKHTI_SPEECH_BUDGET_MS, 9 s — under the phone's 10 s) →
     { skipped: true }: the phone carries on and keeps the line to read
     again later. A lesson never waits on this.
   · The passage is never the phone's word for it: the caller passes only
     a line the server found in its own copy of the app's reading lines
     (voice/server.js → knownLine()). Anything else is heard without one.

   narrate — Munni's voice
   · gemini: GEMINI_TTS_MODEL (default gemini-3.8-flash-tts, from Google's
     speech-generation guide, Nov 2026), voice GEMINI_TTS_VOICE (Kore),
     a warm, unhurried style. Unary answers are WAV, 24 kHz mono 16-bit;
     raw L16 PCM (older deployments) is wrapped into WAV here.
     narrateBatch() renders a whole content pack through the Batch API
     (half price) — tools/build-audio.mjs — so the voice ships offline.
   · sarvam: Sarvam Bulbul, or ElevenLabs (voice/asr.js synthesize()).
   · At run time (POST /reading/tts) only the backup speaks live: a line
     the offline pack lacks → Sarvam if set up → the phone's own voice.

   Nothing is kept: no clip, no transcript, no audio. Keys stay here. Use
   the paid Gemini tier, so Google doesn't train on what children say.
   ================================================================== */

const { transcribe, synthesize, provider: sarvamWho } = require('./asr');

const PROVIDERS = ['gemini', 'sarvam'];
const LANGS = { hi: 'Hindi', en: 'English' };
const MIME_OK = /^audio\/[a-z0-9.+-]+$/i;

const chosen = env => { const p = String((env || {}).SPEECH_PROVIDER || 'gemini').toLowerCase(); return PROVIDERS.includes(p) ? p : 'gemini'; };
const geminiReady = env => !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
const sarvamReady = env => !!sarvamWho(env);
const ready = (p, env) => p === 'gemini' ? geminiReady(env) : sarvamReady(env);

/* Which providers to try for a reading check, in order. */
function readingOrder(env){
  const c = chosen(env);
  return (c === 'gemini' ? ['gemini', 'sarvam'] : ['sarvam']).filter(p => ready(p, env));
}

/* ---------- Gemini: the shared call ---------- */
const geminiUrl = (env, model) => `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
async function geminiCall(env, fetchImpl, model, bodies, ms){
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), Math.max(500, ms));
  try{
    let res, d;
    // the current field names first, then the older ones (one 400 → one retry)
    for(const body of bodies){
      res = await fetchImpl(geminiUrl(env, model), { method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY || env.GOOGLE_API_KEY }, body: JSON.stringify(body) });
      d = await res.json().catch(() => ({}));
      if(res.status !== 400) break;
    }
    if(!res.ok) return { error: `Gemini said ${res.status}`, status: 502 };
    return { data: d };
  }catch(e){
    return { error: 'Gemini did not answer in time', status: 504 };
  }finally{ clearTimeout(to); }
}
const partsOf = d => ((((d.candidates || [])[0] || {}).content || {}).parts || []);
const clampText = (s, n) => String(s == null ? '' : s).replace(/[<>`{}\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/* ---------- Gemini: hearing a child ---------- */
const READ_SCHEMA = {
  type: 'object',
  properties: {
    said: { type: 'string', description: 'Exactly what the child said, word for word, as heard.' },
    words: { type: 'array', items: { type: 'object', properties: {
      word: { type: 'string', description: 'One word of the line, in order.' },
      said: { type: 'string', description: 'What the child said for that word, as heard; "" if skipped.' }
    }, required: ['word', 'said'] } }
  },
  required: ['said']
};
function readInstructions(lang, withLine){
  return `You write down exactly what a child said, from a recording. The child is learning to read and speak (ages 3–10), in ${LANGS[lang] || 'Hindi'}, maybe mixed with ${lang === 'hi' ? 'English' : 'Hindi'}.
Write what you HEAR, never what the child should have said: keep every mispronunciation as it was said (if the line has "भाई" and the child said "बाई", write "बाई"), leave out what the child skipped, include what the child added or repeated, and stop where the child stopped. Use Devanagari for Hindi words and English letters for English words. Never correct the child. If you hear no speech, "said" is "".
${withLine ? 'The line the child was reading is given only so you know which words to listen for — it is not what the child said. In "words", give each word of the line in order with what the child said for it ("" if skipped).' : 'There is no line: write down whatever the child said.'}
Answer with JSON only, in the given schema.`;
}
async function geminiHear(clip, passage, lang, env, fetchImpl, ms){
  const model = env.GEMINI_SPEECH_MODEL || 'gemini-3.8-flash';
  const parts = [{ inline_data: { mime_type: clip.mime, data: clip.buf.toString('base64') } }];
  if(passage) parts.push({ text: 'The line: ' + passage });
  const base = { systemInstruction: { parts: [{ text: readInstructions(lang, !!passage) }] }, contents: [{ role: 'user', parts }] };
  const r = await geminiCall(env, fetchImpl, model, [
    { ...base, generationConfig: { temperature: 0, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: READ_SCHEMA } } } },
    { ...base, generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: READ_SCHEMA } }
  ], ms);
  if(r.error) return r;
  let out;
  try{ out = JSON.parse(partsOf(r.data).map(p => p.text || '').join('').replace(/```json|```/g, '').trim()); }
  catch(e){ return { error: 'Gemini did not answer in the format', status: 502 }; }
  const words = passage && Array.isArray(out.words)
    ? out.words.slice(0, 40).map(w => ({ word: clampText(w && w.word, 40), said: clampText(w && w.said, 40) })) : undefined;
  let transcript = clampText(out.said, 400);
  if(!transcript && words) transcript = words.map(w => w.said).filter(Boolean).join(' ');
  return { transcript, provider: 'gemini', ...(words ? { words } : {}) };
}

/* A child's voice → what they said. clip = { buf, mime }. passage: a line
   from the server's own copy, or null. */
async function checkReading(clip, passage, lang, opts){
  opts = opts || {};
  const env = opts.env || process.env, fetchImpl = opts.fetch || fetch;
  lang = lang === 'en' ? 'en' : 'hi';
  const mime = MIME_OK.test(String(clip && clip.mime || '').split(';')[0]) ? String(clip.mime).split(';')[0] : 'audio/webm';
  if(!clip || !Buffer.isBuffer(clip.buf) || !clip.buf.length) return { error: 'no recording', status: 400 };
  passage = passage ? clampText(passage, 160) : null;
  const order = opts.provider ? [opts.provider].filter(p => ready(p, env)) : readingOrder(env);
  if(!order.length) return { error: 'no speech service is set up on this server', status: 503 };
  const until = Date.now() + Number(env.TAKHTI_SPEECH_BUDGET_MS || 9000);
  const tried = [];
  for(const p of order){
    const left = until - Date.now();
    if(left < 600){ tried.push(`${p}: no time left`); break; }
    const r = p === 'gemini'
      ? await geminiHear({ buf: clip.buf, mime }, passage, lang, env, fetchImpl, Math.min(left, Number(env.GEMINI_SPEECH_TIMEOUT_MS || 6000)))
      : await transcribe(clip.buf, mime, lang, { ...env, TAKHTI_ASR_TIMEOUT_MS: String(Math.min(left, Number(env.TAKHTI_ASR_TIMEOUT_MS || 8000))) });
    if(!r.error) return { ...r, ...(tried.length ? { fellBack: tried.map(x => x.split(':')[0]) } : {}) };
    tried.push(`${p}: ${r.error}`);
  }
  return { error: 'no speech service answered in time — skipped, nothing kept', status: 503, skipped: true, tried };
}

/* ---------- Gemini: Munni's voice ---------- */
const TTS_STYLE = 'Warm, kind and unhurried, like a gentle teacher talking to a young child.';
function wavFromPcm(pcm, rate){
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
/* Gemini's audio part → WAV, whatever form it came in. */
function audioOf(d){
  const part = partsOf(d).find(p => (p.inlineData || p.inline_data));
  const inl = part && (part.inlineData || part.inline_data);
  if(!inl || !inl.data) return null;
  const mime = String(inl.mimeType || inl.mime_type || '');
  const buf = Buffer.from(inl.data, 'base64');
  if(/wav/i.test(mime) || buf.slice(0, 4).toString() === 'RIFF') return { audio: buf.toString('base64'), mime: 'audio/wav' };
  if(/l16|pcm/i.test(mime)){ const m = mime.match(/rate=(\d+)/); return { audio: wavFromPcm(buf, m ? Number(m[1]) : 24000).toString('base64'), mime: 'audio/wav' }; }
  return { audio: buf.toString('base64'), mime: mime || 'audio/wav' };
}
function ttsBodies(text, env, pace){
  const voice = env.GEMINI_TTS_VOICE || 'Kore';
  const style = TTS_STYLE + (pace && pace < 0.85 ? ' Speak slowly and clearly.' : '');
  return [
    { contents: [{ role: 'user', parts: [{ text, speech_metadata: { style } }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice } } } },
    { contents: [{ role: 'user', parts: [{ text: `Say in a ${style.toLowerCase()} way: ${text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }
  ];
}
async function geminiSpeak(text, lang, env, fetchImpl, pace){
  const r = await geminiCall(env, fetchImpl, env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts', ttsBodies(text, env, pace), Number(env.GEMINI_TTS_TIMEOUT_MS || 20000));
  if(r.error) return r;
  const a = audioOf(r.data);
  return a ? { ...a, provider: 'gemini' } : { error: 'Gemini sent no audio', status: 502 };
}

/* Munni says one line. opts.provider picks one; otherwise SPEECH_PROVIDER,
   falling back to the other when the chosen one isn't set up. */
async function narrate(text, lang, opts){
  opts = opts || {};
  const env = opts.env || process.env, fetchImpl = opts.fetch || fetch;
  text = String(text || '').trim();
  if(!text) return { error: 'nothing to say', status: 400 };
  lang = lang === 'en' ? 'en' : 'hi';
  const pace = Math.max(0.5, Math.min(1.5, Number(opts.pace) || 0.95));
  let p = opts.provider || chosen(env);
  if(!opts.provider && !ready(p, env)) p = p === 'gemini' ? 'sarvam' : 'gemini';
  if(p === 'gemini'){
    if(!geminiReady(env)) return { error: 'Gemini is not set up on this server', status: 503 };
    return geminiSpeak(text, lang, env, fetchImpl, pace);
  }
  return synthesize(text, lang, pace, env).catch(() => ({ error: 'the voice service did not answer', status: 504 }));
}

/* A whole content pack through Gemini's Batch API (half price, not
   urgent). items: [{ key, text }] → Map key → { audio, mime } | { error }.
   The job's state and its inline answers have appeared under a couple of
   field names in the docs; both are read. */
async function narrateBatch(items, lang, opts){
  opts = opts || {};
  const env = opts.env || process.env, fetchImpl = opts.fetch || fetch;
  const base = env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  const model = env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': key };
  const out = new Map();
  if(!key) throw new Error('Set GEMINI_API_KEY.');
  const body = ttsBodies('', env)[0];
  const res = await fetchImpl(`${base}/v1beta/models/${encodeURIComponent(model)}:batchGenerateContent`, { method: 'POST', headers,
    body: JSON.stringify({ batch: { display_name: opts.name || `takhti-narration-${lang}`, input_config: { requests: { requests: items.map(it => ({
      request: { ...body, contents: [{ role: 'user', parts: [{ text: it.text, speech_metadata: body.contents[0].parts[0].speech_metadata }] }] },
      metadata: { key: it.key } })) } } } }) });
  const job = await res.json().catch(() => ({}));
  if(!res.ok || !job.name) throw new Error(`the batch was not accepted (${res.status}) ${JSON.stringify(job).slice(0, 200)}`);
  const stateOf = j => (j.metadata && j.metadata.state) || j.state || '';
  let j = job;
  const pollMs = Number(opts.pollMs || 15000), until = Date.now() + Number(opts.maxWaitMs || 6 * 3600e3);
  while(!/SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(stateOf(j))){
    if(Date.now() > until) throw new Error(`the batch ${job.name} is still running — run again later to collect it`);
    if(opts.onWait) opts.onWait(stateOf(j) || 'pending');
    await new Promise(r => setTimeout(r, pollMs));
    const g = await fetchImpl(`${base}/v1beta/${job.name}`, { headers });
    j = await g.json().catch(() => ({}));
  }
  if(!/SUCCEEDED/.test(stateOf(j))) throw new Error(`the batch ended ${stateOf(j)}`);
  const r = j.response || j.dest || {};
  const list = (r.inlinedResponses && (r.inlinedResponses.inlinedResponses || r.inlinedResponses)) || [];
  (Array.isArray(list) ? list : []).forEach((x, i) => {
    const k = (x.metadata && x.metadata.key) || (items[i] && items[i].key);
    if(!k) return;
    const a = x.response && audioOf(x.response);
    out.set(k, a || { error: (x.error && x.error.message) || 'no audio' });
  });
  return out;
}

/* ---------- the HTTP side: POST /reading/asr and /reading/tts ---------- */
function createSpeechRoutes(env, opts){
  opts = opts || {};
  const hits = new Map();
  const rateOk = ip => {
    const now = Date.now(), per = Number(env.TAKHTI_ASR_PER_HOUR || 120);
    const xs = (hits.get(ip) || []).filter(t => now - t < 36e5);
    if (xs.length >= per) { hits.set(ip, xs); return false; }
    xs.push(now); hits.set(ip, xs);
    if (hits.size > 5000) hits.delete(hits.keys().next().value);
    return true;
  };
  const knownLine = opts.knownLine || (() => null);
  /* POST /reading/asr — { consent: true, lang, mime, audio: base64, line? } */
  async function handle(body, ip) {
    body = body || {};
    if (body.consent !== true) return { status: 403, body: { error: 'a parent has not turned on the clearer reading check' } };
    if (!readingOrder(env).length) return { status: 503, body: { error: 'no speech service is set up on this server' } };
    if (!rateOk(ip || '?')) return { status: 429, body: { error: 'enough for now — try later' } };
    const b64 = String(body.audio || '');
    if (b64.length < 200 || /[^A-Za-z0-9+/=]/.test(b64)) return { status: 400, body: { error: 'no recording' } };   // a scan, not a whole-string match (stack-safe)
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 1.5 * 1024 * 1024) return { status: 413, body: { error: 'that recording is too long for one line' } };
    // the line, only from the server's own copy of the app's lines
    const passage = body.line ? knownLine(String(body.line).trim().slice(0, 160)) : null;
    const r = await checkReading({ buf, mime: body.mime }, passage, body.lang, { env, fetch: opts.fetch });
    if (r.error) return { status: r.status || 502, body: { error: r.error, ...(r.skipped ? { skipped: true } : {}) } };
    return { status: 200, body: { transcript: r.transcript, provider: r.provider, ...(r.words ? { words: r.words } : {}) } };
  }
  /* POST /reading/tts — { text, lang, pace }: a short teaching line the
     offline pack lacks. Live, only the backup speaks (Sarvam / ElevenLabs);
     without one, the phone uses its own voice. */
  const cache = new Map();
  async function speak(body, ip) {
    body = body || {};
    const text = String(body.text || '').trim(), lang = body.lang === 'en' ? 'en' : 'hi';
    const pace = Math.max(0.5, Math.min(1.5, Number(body.pace) || 0.95));
    if (!text || text.length > 160 || !/^[ऀ-ॿ A-Za-z0-9.,!?'"“”‘’—–…:;()\-]+$/.test(text)) return { status: 400, body: { error: 'only a short teaching line' } };
    const k = `${lang}|${pace}|${text}`;
    if (cache.has(k)) return { status: 200, body: cache.get(k) };
    if (!rateOk('tts:' + (ip || '?'))) return { status: 429, body: { error: 'enough for now — try later' } };
    const r = await narrate(text, lang, { env, pace, provider: 'sarvam' });
    if (r.error) return { status: r.status || 502, body: { error: r.error } };
    const out = { audio: r.audio, mime: r.mime, provider: r.provider };
    cache.set(k, out);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return { status: 200, body: out };
  }
  return { handle, speak, provider: () => readingOrder(env)[0] || null };
}

module.exports = { narrate, checkReading, narrateBatch, createSpeechRoutes, readingOrder, chosen, wavFromPcm };
