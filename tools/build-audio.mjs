#!/usr/bin/env node
/* ==================================================================
   BUILD-TIME NARRATION

   Walks the whole lesson bank — and every reading line, and every letter
   a child hears on its own (the reading tips' "hear them side by side",
   the Sand Patch) — collects every unique line in both languages, sends
   each to a voice service ONCE, and writes an mp3 plus a manifest keyed
   by a hash of (text + language).

   Three services, the same files:
   · Gemini TTS (GEMINI_API_KEY; GEMINI_TTS_MODEL, default
     gemini-3.8-flash-tts; GEMINI_TTS_VOICE, default Kore) — the default
     since 12 Nov 2026 (SPEECH_PROVIDER=gemini). The whole pack goes through
     Gemini's Batch API in one job (half price; it can take a while), via
     voice/speech.js narrateBatch(). Gemini answers in WAV; with ffmpeg on
     the machine each file is made a small mp3, otherwise the WAV ships and
     the manifest says so (x:'wav' — src/core/voice.js plays either).
   · Sarvam Bulbul (SARVAM_API_KEY; SARVAM_SPEAKER, default "anushka" on
     bulbul:v2 or set SARVAM_TTS_MODEL=bulbul:v3 with a v3 speaker) — made
     for Indian voices, the backup.
   · ElevenLabs (ELEVEN_API_KEY + ELEVEN_VOICE_HI / ELEVEN_VOICE_EN)
   --provider gemini|sarvam|elevenlabs picks one; otherwise SPEECH_PROVIDER,
   else whichever has a key. --limit N renders at most N lines (try a few
   before paying for all); --out DIR writes somewhere other than audio/.

   This is a build step, not a runtime feature. The child's phone never
   calls a voice service — it plays a file. So the good voice works in
   airplane mode, which is the only kind of voice worth having here.

   Dedupe matters: 2,650 narration slots collapse to 982 unique lines,
   because shared narration is reused across dozens of generated
   lessons. You pay for 982.

     GEMINI_API_KEY=... node tools/build-audio.mjs --lang hi                     # Gemini, one batch job
     SARVAM_API_KEY=... node tools/build-audio.mjs --lang hi --provider sarvam
     ELEVEN_API_KEY=... node tools/build-audio.mjs --lang hi --provider elevenlabs
     node tools/build-audio.mjs --lang en --dry-run        # count, send nothing

   Re-running skips anything already rendered, so a content change costs
   only the lines that changed.
   ================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = k => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : '';
const OUT  = argv('--out') ? path.resolve(argv('--out')) : path.join(ROOT, 'audio');
const LIMIT = Number(argv('--limit')) || Infinity;
const LANG = (process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang')+1] : 'hi');
const DRY  = process.argv.includes('--dry-run');

/* Voices: pick warm, unhurried, mid-range. A children's narrator, not a
   newsreader. Override with ELEVEN_VOICE_HI / ELEVEN_VOICE_EN. */
const VOICE = LANG === 'hi'
  ? (process.env.ELEVEN_VOICE_HI || '')
  : (process.env.ELEVEN_VOICE_EN || '');

const ARG_PROVIDER = argv('--provider');
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const WANT = String(process.env.SPEECH_PROVIDER || 'gemini').toLowerCase();
const PROVIDER = ARG_PROVIDER
  || (WANT === 'gemini' && GEMINI_KEY ? 'gemini' : WANT === 'sarvam' && process.env.SARVAM_API_KEY ? 'sarvam' : '')
  || (GEMINI_KEY ? 'gemini' : process.env.SARVAM_API_KEY ? 'sarvam' : process.env.ELEVEN_API_KEY ? 'elevenlabs' : 'gemini');
const KEY = PROVIDER === 'gemini' ? GEMINI_KEY : PROVIDER === 'sarvam' ? process.env.SARVAM_API_KEY : process.env.ELEVEN_API_KEY;
const HAS_FFMPEG = (() => { try{ execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return !process.env.TAKHTI_NO_FFMPEG; }catch(e){ return false; } })();

/* ---------- load the bank in a sandbox, same as the tests do ---------- */
function loadBank(){
  const ctx = { console, Intl, S:{ lang:LANG, age:7, name:'build', day:0 } };
  vm.createContext(ctx);
  for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                  'src/content/games.js','src/content/facts.js','src/content/ages.js',
                  'src/core/daily-engine.js','src/content/lessons.js','src/core/lesson-gen.js','src/core/explain.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'), ctx);
  vm.runInContext('globalThis.__bank = LESSONS.concat(generateLessons()); globalThis.__lines = SENTENCES; globalThis.__glyphs = GLYPHS; globalThis.__chunks = wordChunks;', ctx);
  return { bank: ctx.__bank, sentences: ctx.__lines, glyphs: ctx.__glyphs, chunks: ctx.__chunks };
}

/* Same hash the runtime uses to find a file — keep these in step. */
export const lineKey = (text, lang) =>
  crypto.createHash('sha1').update(lang + '|' + text.trim()).digest('hex').slice(0, 16);

/* "Say it with Munni" (src/ui/say-it.js): her fixed lines, and for every
   word of every reading line, the word, its pieces and "let's say it". */
const SAY_LINES = {
  en: ["Piece by piece:", "Slowly:", "Now you say it!", "Almost! Listen once more, slowly.", "Yes! That is exactly it!", "Now read the whole line again.", "That's okay — we'll say it again next time."],
  hi: ['टुकड़ों में:', 'धीरे से:', 'अब तुम बोलो!', 'लगभग! एक बार और सुनो, धीरे से।', 'हाँ! बिलकुल ऐसे ही!', 'अब पूरी पंक्ति फिर से पढ़ो।', 'कोई बात नहीं — अगली बार फिर बोलेंगे।']
};
const SAY_INTRO = { en: w => `Let's say ${w} together.`, hi: w => `चलो, ${w} साथ में बोलें।` };

function collect({ bank, sentences, glyphs, chunks }, lang){
  const lines = new Map();          // key -> text
  const add = t => { if(t && String(t).trim()) lines.set(lineKey(String(t), lang), String(t).trim()); };
  for(const l of bank){
    add(l.title && l.title[lang]);
    for(const b of l.beats){
      if(b.say) add(b.say[lang]);
      if(b.q)   add(b.q[lang]);
    }
  }
  // every reading line (Munni reads it first, for a child taught that way)
  for(const lv of Object.values((sentences || {})[lang] || {})) for(const s of lv){
    add(s);
    // "say it with Munni": every word, its pieces, and her line for it
    for(const w of s.replace(/[.,!?।"“”]/g, ' ').split(/\s+/).filter(Boolean)){
      add(w); add(SAY_INTRO[lang](w));
      if(chunks) for(const p of chunks(w, lang)) add(p);
    }
  }
  for(const l of SAY_LINES[lang] || []) add(l);
  // every letter heard on its own: the Sand Patch, and "hear them side by side"
  for(const lv of Object.values((glyphs || {})[lang] || {})) for(const g of lv) add(g);
  return lines;
}

async function renderSarvam(text, file){
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method:'POST',
    headers:{ 'api-subscription-key':KEY, 'Content-Type':'application/json' },
    body: JSON.stringify({
      text, language_code: LANG === 'hi' ? 'hi-IN' : 'en-IN',
      model: process.env.SARVAM_TTS_MODEL || 'bulbul:v2',
      speaker: process.env.SARVAM_SPEAKER || 'anushka',
      pace: 0.9,                                  // unhurried: a children's narrator
      speech_sample_rate: 22050, output_audio_codec: 'mp3'
    })
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok || !d.audios || !d.audios[0]) throw new Error(`${res.status} ${JSON.stringify(d).slice(0,160)}`);
  fs.writeFileSync(file, Buffer.from(d.audios[0], 'base64'));
}

async function render(text, file){
  if(PROVIDER === 'sarvam') return renderSarvam(text, file);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method:'POST',
    headers:{ 'xi-api-key':KEY, 'Content-Type':'application/json', 'Accept':'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id:'eleven_multilingual_v2',
      voice_settings:{ stability:0.55, similarity_boost:0.75, style:0.25, use_speaker_boost:true },
      // 32kbps mono is plenty for speech and keeps the whole bank under 10 MB
      output_format:'mp3_22050_32'
    })
  });
  if(!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0,160)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fileOf = (k, ext) => path.join(OUT, LANG, k + '.' + (ext || 'mp3'));

/* Gemini: the lines still to render, in batch jobs of up to 400 (inline
   requests stay well under the 20 MB limit), each answer written as it comes. */
async function renderGemini(todo, manifest, save){
  const speech = createRequire(import.meta.url)('../voice/speech.js');
  let done = 0, failed = 0;
  for(let i = 0; i < todo.length; i += 400){
    const part = todo.slice(i, i + 400);
    const got = await speech.narrateBatch(part.map(([key, text]) => ({ key, text })), LANG, {
      env: process.env, pollMs: Number(process.env.TAKHTI_BATCH_POLL_MS || 15000), name: `takhti-${LANG}-${i / 400 + 1}`,
      onWait: st => console.log(`  batch ${i / 400 + 1}: ${st}…`) });
    for(const [k, text] of part){
      const a = got.get(k);
      if(!a || a.error){ failed++; console.error(`  failed: "${text.slice(0, 42)}" — ${(a && a.error) || 'no answer'}`); continue; }
      const wav = Buffer.from(a.audio, 'base64');
      let ext = 'wav';
      if(HAS_FFMPEG){
        try{
          fs.writeFileSync(fileOf(k, 'wav'), wav);
          execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', fileOf(k, 'wav'), '-ac', '1', '-ar', '22050', '-b:a', '32k', fileOf(k, 'mp3')]);
          fs.unlinkSync(fileOf(k, 'wav'));
          ext = 'mp3';
        }catch(e){ ext = 'wav'; }
      }
      if(ext === 'wav') fs.writeFileSync(fileOf(k, 'wav'), wav);
      manifest[k] = { t: text, b: fs.statSync(fileOf(k, ext)).size, ...(ext === 'wav' ? { x: 'wav' } : {}), v: 'gemini' };
      done++;
    }
    save();
  }
  return { done, failed };
}

(async () => {
  const src   = loadBank();
  const bank  = src.bank;
  const lines = collect(src, LANG);
  const chars = [...lines.values()].reduce((a,s)=>a+s.length,0);

  fs.mkdirSync(path.join(OUT, LANG), { recursive:true });
  const manifestPath = path.join(OUT, `manifest-${LANG}.json`);
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : {};

  const pending = [...lines].filter(([k]) => !manifest[k] || !fs.existsSync(fileOf(k, manifest[k].x)));
  const todo = pending.slice(0, LIMIT);

  console.log(`bank         : ${bank.length} lessons`);
  console.log(`unique lines : ${lines.size} (${chars.toLocaleString()} chars)`);
  console.log(`already done : ${lines.size - pending.length}`);
  console.log(`to render    : ${todo.length}`);
  console.log(`voice service : ${PROVIDER}`);
  if(DRY) return console.log('\n--dry-run: nothing sent.');
  if(!KEY)   return console.error(PROVIDER === 'gemini' ? '\nSet GEMINI_API_KEY.' : PROVIDER === 'sarvam' ? '\nSet SARVAM_API_KEY.' : '\nSet ELEVEN_API_KEY.');
  if(PROVIDER === 'elevenlabs' && !VOICE) return console.error(`\nSet ELEVEN_VOICE_${LANG.toUpperCase()} to a voice id.`);

  let done = 0, failed = 0;
  if(PROVIDER === 'gemini'){
    if(!HAS_FFMPEG) console.log('no ffmpeg here: the files ship as WAV (bigger, played the same way)');
    ({ done, failed } = await renderGemini(todo, manifest, () => fs.writeFileSync(manifestPath, JSON.stringify(manifest))));
    todo.length = 0;
  }
  for(const [k, text] of todo){
    const file = fileOf(k, 'mp3');
    try{
      await render(text, file);
      manifest[k] = { t:text, b:fs.statSync(file).size };
      if(++done % 25 === 0){
        fs.writeFileSync(manifestPath, JSON.stringify(manifest));
        console.log(`  ${done}/${todo.length}`);
      }
      await sleep(120);                       // stay well inside rate limits
    }catch(e){
      failed++;
      console.error(`  failed: "${text.slice(0,42)}" — ${e.message}`);
      // a missing file is not fatal: the app falls back to device TTS
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const total = Object.values(manifest).reduce((a,v)=>a+(v.b||0),0);
  console.log(`\nrendered ${done}, failed ${failed}`);
  console.log(`bundle: ${(total/1048576).toFixed(2)} MB in audio/${LANG}/`);
})();
