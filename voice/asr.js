/* ==================================================================
   THE "SARVAM" SPEECH PROVIDER — the backup since 12 Nov 2026

   voice/speech.js is the one door for speech now (narrate(),
   checkReading()); SPEECH_PROVIDER=gemini|sarvam in voice/.env picks the
   provider, default gemini. This file is the "sarvam" provider, unchanged:
   it is Gemini's fallback for the reading check, the live voice for a line
   the offline pack lacks, and the whole reading check again the moment
   SPEECH_PROVIDER=sarvam. Don't delete it.

   Under the reading terms a parent accepts at onboarding, whenever there
   is a signal (src/ui/cloud-read.js): the child's reading of ONE line (or
   one word said after Munni) arrives here, is written down as text by a
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
    // what was said, not what was meant. Verbatim writes in the language's own
    // script, so an English line came back in Devanagari ("द डॉग रन") and the
    // phone's matcher couldn't match it (compare-speech, 14 Nov); for English,
    // codemix keeps English words in English letters.
    form.append('mode', lang === 'en' ? (env.SARVAM_EN_MODE || 'codemix') : (env.SARVAM_HI_MODE || 'verbatim'));
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

/* Munni's voice, live, for a line the phone's pre-rendered pack doesn't
   have ("say it with Munni": a word, its pieces, a tip). Sarvam Bulbul —
   the same voice as the pack (SARVAM_TTS_MODEL / SARVAM_SPEAKER) — or
   ElevenLabs. Only short plain text: this is a teaching voice, not a
   general text-to-speech service anyone can use. */
async function synthesize(text, lang, pace, env) {
  if (env.SARVAM_API_KEY) {
    const res = await fetch((env.SARVAM_API_BASE || 'https://api.sarvam.ai') + '/text-to-speech', {
      method: 'POST', headers: { 'api-subscription-key': env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language_code: LANGS[lang] || 'hi-IN', model: env.SARVAM_TTS_MODEL || 'bulbul:v2', speaker: env.SARVAM_SPEAKER || 'anushka',
                             pace, speech_sample_rate: 22050, output_audio_codec: 'mp3' })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.audios || !d.audios[0]) return { error: `the voice service said ${res.status}`, status: 502 };
    return { audio: d.audios[0], mime: 'audio/mpeg', provider: 'sarvam' };
  }
  const voice = lang === 'en' ? env.ELEVEN_VOICE_EN : env.ELEVEN_VOICE_HI;
  if (env.ELEVEN_API_KEY && voice) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_22050_32`, {
      method: 'POST', headers: { 'xi-api-key': env.ELEVEN_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.55, similarity_boost: 0.75, speed: Math.max(0.7, Math.min(1.2, pace)) } })
    });
    if (!res.ok) return { error: `the voice service said ${res.status}`, status: 502 };
    return { audio: Buffer.from(await res.arrayBuffer()).toString('base64'), mime: 'audio/mpeg', provider: 'elevenlabs' };
  }
  return { error: 'no voice service is set up on this server', status: 503 };
}

/* The HTTP routes moved to voice/speech.js (they choose the provider);
   createAsr() stays the name the server and the tests use. */
function createAsr(env, opts) {
  return require('./speech').createSpeechRoutes(env || {}, opts);
}

module.exports = { createAsr, transcribe, synthesize, provider };
