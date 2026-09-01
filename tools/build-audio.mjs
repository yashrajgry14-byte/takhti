#!/usr/bin/env node
/* ==================================================================
   BUILD-TIME NARRATION

   Walks the whole lesson bank, collects every unique line in both
   languages, sends each to ElevenLabs ONCE, and writes an mp3 plus a
   manifest keyed by a hash of (text + language).

   This is a build step, not a runtime feature. The child's phone never
   calls ElevenLabs — it plays a file. So the good voice works in
   airplane mode, which is the only kind of voice worth having here.

   Dedupe matters: 2,650 narration slots collapse to 982 unique lines,
   because shared narration is reused across dozens of generated
   lessons. You pay for 982.

     ELEVEN_API_KEY=... node tools/build-audio.mjs --lang hi
     ELEVEN_API_KEY=... node tools/build-audio.mjs --lang en

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

const KEY = process.env.ELEVEN_API_KEY;

/* ---------- load the bank in a sandbox, same as the tests do ---------- */
function loadBank(){
  const ctx = { console, Intl, S:{ lang:LANG, age:7, name:'build', day:0 } };
  vm.createContext(ctx);
  for(const f of ['src/core/matcher.js','src/core/readability.js','src/content/sentences.js',
                  'src/content/games.js','src/content/facts.js','src/content/ages.js',
                  'src/core/daily-engine.js','src/content/lessons.js','src/core/lesson-gen.js'])
    vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'), ctx);
  vm.runInContext('globalThis.__bank = LESSONS.concat(generateLessons());', ctx);
  return ctx.__bank;
}

/* Same hash the runtime uses to find a file — keep these in step. */
export const lineKey = (text, lang) =>
  crypto.createHash('sha1').update(lang + '|' + text.trim()).digest('hex').slice(0, 16);

function collect(bank, lang){
  const lines = new Map();          // key -> text
  const add = t => { if(t && t.trim()) lines.set(lineKey(t, lang), t.trim()); };
  for(const l of bank){
    add(l.title && l.title[lang]);
    for(const b of l.beats){
      if(b.say) add(b.say[lang]);
      if(b.q)   add(b.q[lang]);
    }
  }
  return lines;
}

async function render(text, file){
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
  const bank  = loadBank();
  const lines = collect(bank, LANG);
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
  if(DRY) return console.log('\n--dry-run: nothing sent.');
  if(!KEY)   return console.error('\nSet ELEVEN_API_KEY.');
  if(!VOICE) return console.error(`\nSet ELEVEN_VOICE_${LANG.toUpperCase()} to a voice id.`);

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
