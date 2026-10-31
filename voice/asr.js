/* ==================================================================
   A CLEARER READING CHECK — the speech service behind it (server half)

   Only when a parent turned it on in the app, and only when the phone has
   no on-device recognizer for the language (src/ui/cloud-read.js): the
   child's reading of ONE line arrives here, is written down as text by a
   speech service built for Indian children's speech, and the text goes
   back. The app grades it with its own matcher, exactly as it grades the
   phone's own recognizer — nothing here grades, nothing here is kept: the
   audio is never written to disk or logged, only passed on and dropped.

   Providers (the first with a key wins; TAKHTI_ASR_PROVIDER picks one):
   · Sarvam (SARVAM_API_KEY): saaras:v3 in "verbatim" mode — it writes
     down what was SAID, not a tidied sentence, which is the whole point of
     checking a child's reading (a tidying recognizer turns "बाई" into
     "भाई" and hides the slip). hi-IN / en-IN.
   · Any OpenAI-compatible transcription endpoint (WHISPER_API_KEY, and
     WHISPER_URL / WHISPER_MODEL to point it at another host).
   ================================================================== */
'use strict';

const LANGS = { hi: 'hi-IN', en: 'en-IN' };

function provider(env) {
  const want = String(env.TAKHTI_ASR_PROVIDER || '').toLowerCase();
  if (want === 'sarvam' && env.SARVAM_API_KEY) return 'sarvam';
  if (want === 'whisper' && env.WHISPER_API_KEY) return 'whisper';
  if (env.SARVAM_API_KEY) return 'sarvam';
  if (env.WHISPER_API_KEY) return 'whisper';
  return null;
}

/* One line of a child's reading → { transcript, provider } or { error }. */
async function transcribe(buf, mime, lang, env) {
  const who = provider(env);
  if (!who) return { error: 'no speech service is set up on this server', status: 503 };
  const type = /^audio\/[a-z0-9.+-]+(;.*)?$/i.test(String(mime || '')) ? String(mime).split(';')[0] : 'audio/webm';
  const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' }[type] || 'webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type }), 'line.' + ext);
  let url, headers;
  if (who === 'sarvam') {
    url = (env.SARVAM_API_BASE || 'https://api.sarvam.ai') + '/speech-to-text';
    headers = { 'api-subscription-key': env.SARVAM_API_KEY };
    form.append('model', env.SARVAM_STT_MODEL || 'saaras:v3');
    form.append('mode', 'verbatim');                       // what was said, not what was meant
    form.append('language_code', LANGS[lang] || 'hi-IN');
  } else {
    url = env.WHISPER_URL || 'https://api.openai.com/v1/audio/transcriptions';
    headers = { Authorization: 'Bearer ' + env.WHISPER_API_KEY };
    form.append('model', env.WHISPER_MODEL || 'whisper-1');
    form.append('language', lang === 'en' ? 'en' : 'hi');
  }
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), Number(env.TAKHTI_ASR_TIMEOUT_MS || 8000));
  try {
    const res = await fetch(url, { method: 'POST', headers, body: form, signal: ctl.signal });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { error: `the speech service said ${res.status}`, status: 502 };
    const transcript = String(d.transcript != null ? d.transcript : d.text || '').trim().slice(0, 400);
    return { transcript, provider: who };
  } catch (e) {
    return { error: 'the speech service did not answer in time', status: 504 };
  } finally { clearTimeout(to); }
}

/* POST /reading/asr — { consent: true, lang, mime, audio: base64 }. */
function createAsr(env) {
  const hits = new Map();
  const rateOk = ip => {
    const now = Date.now(), per = Number(env.TAKHTI_ASR_PER_HOUR || 120);
    const xs = (hits.get(ip) || []).filter(t => now - t < 36e5);
    if (xs.length >= per) { hits.set(ip, xs); return false; }
    xs.push(now); hits.set(ip, xs); return true;
  };
  async function handle(body, ip) {
    body = body || {};
    if (body.consent !== true) return { status: 403, body: { error: 'a parent has not turned on the clearer reading check' } };
    if (!provider(env)) return { status: 503, body: { error: 'no speech service is set up on this server' } };
    if (!rateOk(ip || '?')) return { status: 429, body: { error: 'enough for now — try later' } };
    const b64 = String(body.audio || '');
    if (!/^[A-Za-z0-9+/=]{200,}$/.test(b64)) return { status: 400, body: { error: 'no recording' } };
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 1.5 * 1024 * 1024) return { status: 413, body: { error: 'that recording is too long for one line' } };
    const r = await transcribe(buf, body.mime, body.lang === 'en' ? 'en' : 'hi', env);
    if (r.error) return { status: r.status || 502, body: { error: r.error } };
    return { status: 200, body: { transcript: r.transcript, provider: r.provider } };
  }
  return { handle, provider: () => provider(env) };
}

module.exports = { createAsr, transcribe, provider };
