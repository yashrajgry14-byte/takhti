#!/usr/bin/env node
/* ==================================================================
   BUILD-TIME NARRATION

   Walks the whole lesson bank — and every reading line, and every letter
   a child hears on its own (the reading tips' "hear them side by side",
   the Sand Patch) — collects every unique line in both languages, sends
   each to a voice service ONCE, and writes an mp3 plus a manifest keyed
   by a hash of (text + language).

   Two services, the same files:
   · ElevenLabs (ELEVEN_API_KEY + ELEVEN_VOICE_HI / ELEVEN_VOICE_EN)
   · Sarvam Bulbul (SARVAM_API_KEY; SARVAM_SPEAKER, default "anushka" on
     bulbul:v2 or set SARVAM_TTS_MODEL=bulbul:v3 with a v3 speaker) — made
     for Indian voices, and it says Hindi letters the way a teacher does.
   --provider sarvam|elevenlabs picks one; otherwise whichever has a key.

   This is a build step, not a runtime feature. The child's phone never
   calls a voice service — it plays a file. So the good voice works in
   airplane mode, which is the only kind of voice worth having here.

   Dedupe matters: 2,650 narration slots collapse to 982 unique lines,
   because shared narration is reused across dozens of generated
   lessons. You pay for 982.

     ELEVEN_API_KEY=... node tools/build-audio.mjs --lang hi
     SARVAM_API_KEY=... node tools/build-audio.mjs --lang hi --provider sarvam
     node tools/build-audio.mjs --lang en --dry-run        # count, send nothing

   Re-running skips anything already rendered, so a content change costs
   only the lines that changed.
   ================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, 'audio');
const LANG = (process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang')+1] : 'hi');
const DRY  = process.argv.includes('--dry-run');

/* Voices: pick warm, unhurried, mid-range. A children's narrator, not a
   newsreader. Override with ELEVEN_VOICE_HI / ELEVEN_VOICE_EN. */
const VOICE = LANG === 'hi'
  ? (process.env.ELEVEN_VOICE_HI || '')
  : (process.env.ELEVEN_VOICE_EN || '');

const ARG_PROVIDER = process.argv.includes('--provider') ? process.argv[process.argv.indexOf('--provider')+1] : '';
const PROVIDER = ARG_PROVIDER || (process.env.ELEVEN_API_KEY ? 'elevenlabs' : process.env.SARVAM_API_KEY ? 'sarvam' : 'elevenlabs');
const KEY = PROVIDER === 'sarvam' ? process.env.SARVAM_API_KEY : process.env.ELEVEN_API_KEY;

/* ---------- load the bank in a sandbox, same as the tests do ---------- */
function loadBank(){
  const ctx = { console, Intl, S:{ lang:LANG, age:7, name:'build', day:0 } };
  vm.createContext(ctx);
  for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                  'src/content/games.js','src/content/facts.js','src/content/ages.js',
                  'src/core/daily-engine.js','src/content/lessons.js','src/core/lesson-gen.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'), ctx);
  vm.runInContext('globalThis.__bank = LESSONS.concat(generateLessons()); globalThis.__lines = SENTENCES; globalThis.__glyphs = GLYPHS;', ctx);
  return { bank: ctx.__bank, sentences: ctx.__lines, glyphs: ctx.__glyphs };
}

/* Same hash the runtime uses to find a file — keep these in step. */
export const lineKey = (text, lang) =>
  crypto.createHash('sha1').update(lang + '|' + text.trim()).digest('hex').slice(0, 16);

function collect({ bank, sentences, glyphs }, lang){
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
  for(const lv of Object.values((sentences || {})[lang] || {})) for(const s of lv) add(s);
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

(async () => {
  const src   = loadBank();
  const bank  = src.bank;
  const lines = collect(src, LANG);
  const chars = [...lines.values()].reduce((a,s)=>a+s.length,0);

  fs.mkdirSync(path.join(OUT, LANG), { recursive:true });
  const manifestPath = path.join(OUT, `manifest-${LANG}.json`);
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : {};

  const todo = [...lines].filter(([k]) => !manifest[k] ||
    !fs.existsSync(path.join(OUT, LANG, k + '.mp3')));

  console.log(`bank         : ${bank.length} lessons`);
  console.log(`unique lines : ${lines.size} (${chars.toLocaleString()} chars)`);
  console.log(`already done : ${lines.size - todo.length}`);
  console.log(`to render    : ${todo.length}`);
  console.log(`voice service : ${PROVIDER}`);
  if(DRY) return console.log('\n--dry-run: nothing sent.');
  if(!KEY)   return console.error(PROVIDER === 'sarvam' ? '\nSet SARVAM_API_KEY.' : '\nSet ELEVEN_API_KEY.');
  if(PROVIDER !== 'sarvam' && !VOICE) return console.error(`\nSet ELEVEN_VOICE_${LANG.toUpperCase()} to a voice id.`);

  let done = 0, failed = 0;
  for(const [k, text] of todo){
    const file = path.join(OUT, LANG, k + '.mp3');
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
