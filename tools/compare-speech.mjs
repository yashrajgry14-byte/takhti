#!/usr/bin/env node
/* ==================================================================
   DAY-1 COMPARISON — Gemini vs Sarvam on real children reading

   Runs the same folder of recordings through both speech providers
   (voice/speech.js checkReading(), the same call the reading check makes)
   and prints, clip by clip, where each one misjudged a word.

     node tools/compare-speech.mjs path/to/clips            # keys from voice/.env
     node tools/compare-speech.mjs path/to/clips --json out.json

   The folder, one set of files per recording:
     riya-01.webm         the recording (webm, ogg, wav, mp3, m4a)
     riya-01.txt          the line the child was reading (as on the screen)
     riya-01.truth.txt    optional, but it is the point: what the child
                          ACTUALLY said, written by a person who listened
                          ("बाई ने खाना खाया" for a "भाई" read as "बाई")
     riya-01.lang         optional: hi or en (default: Hindi if the line has
                          Devanagari)

   With a truth file, each provider's words are graded by the app's own
   matcher (src/core/matcher.js) and compared with the truth graded the same
   way. Two kinds of misjudgement:
     · MISSED A SLIP   the child misread, the provider heard it right —
                       the slip the child needed to learn is hidden
     · INVENTED A SLIP the child read it right, the provider heard a slip —
                       the child is corrected for nothing
   Without a truth file it prints where the two providers disagree.

   It ends with the totals for Hindi and English, and says whether to
   switch the reading check to Sarvam (SPEECH_PROVIDER=sarvam in
   voice/.env). Nothing is kept: recordings are read, sent, and dropped;
   only this report is printed (and written, with --json).
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--json');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
if(!dir || !fs.existsSync(dir)){ console.error('usage: node tools/compare-speech.mjs <folder of recordings> [--json out.json]'); process.exit(2); }

/* the voice server's .env, without overriding what is already set */
const envFile = path.join(ROOT, 'voice', '.env');
if(fs.existsSync(envFile)) for(const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)){
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if(m && m[2] && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const speech = require(path.join(ROOT, 'voice', 'speech.js'));

/* the app's own matcher, exactly as the phone grades */
const mctx = { console, Intl }; vm.createContext(mctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/core/matcher.js'), 'utf8') + ';this.G = gradeReading;', mctx);
const grade = (line, said, lang) => mctx.G(line, String(said || ''), lang).tokens.map(t => t.state);
const okState = s => s === 'ok';

const MIME = { '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const clips = fs.readdirSync(dir).filter(f => MIME[path.extname(f).toLowerCase()]).sort();
if(!clips.length){ console.error('no recordings (webm, ogg, wav, mp3, m4a) in ' + dir); process.exit(2); }
const env = { ...process.env, TAKHTI_SPEECH_BUDGET_MS: process.env.TAKHTI_SPEECH_BUDGET_MS || '30000' };   // no phone waiting here
const PROVIDERS = ['gemini', 'sarvam'];
const tot = {}; for(const p of PROVIDERS) tot[p] = { hi: { words: 0, missed: 0, invented: 0, failed: 0 }, en: { words: 0, missed: 0, invented: 0, failed: 0 } };
const report = [];

console.log(`Comparing ${clips.length} recording(s) — Gemini (${env.GEMINI_SPEECH_MODEL || 'gemini-3.8-flash'}) and Sarvam (${env.SARVAM_STT_MODEL || 'saaras:v3'}, verbatim)\n`);
for(const f of clips){
  const stem = path.join(dir, path.basename(f, path.extname(f)));
  const read = ext => fs.existsSync(stem + ext) ? fs.readFileSync(stem + ext, 'utf8').trim() : null;
  const line = read('.txt');
  if(!line){ console.log(`· ${f}: no ${path.basename(stem)}.txt with the line — skipped\n`); continue; }
  const truth = read('.truth.txt');
  const lang = (read('.lang') || (/[ऀ-ॿ]/.test(line) ? 'hi' : 'en')) === 'en' ? 'en' : 'hi';
  const clip = { buf: fs.readFileSync(path.join(dir, f)), mime: MIME[path.extname(f).toLowerCase()] };
  const words = line.split(/\s+/).filter(Boolean);
  const truthStates = truth != null ? grade(line, truth, lang) : null;
  const row = { clip: f, lang, line, truth, providers: {} };
  console.log(`· ${f}  [${lang}]  line: ${line}${truth != null ? `\n  truth: ${truth}` : ''}`);
  for(const p of PROVIDERS){
    const r = await speech.checkReading(clip, line, lang, { env, provider: p });
    if(r.error){ tot[p][lang].failed++; row.providers[p] = { error: r.error }; console.log(`  ${p.padEnd(6)}: — ${r.error}`); continue; }
    const states = grade(line, r.transcript, lang);
    const out = { heard: r.transcript, missed: [], invented: [] };
    if(truthStates){
      tot[p][lang].words += words.length;
      words.forEach((w, k) => {
        if(!okState(truthStates[k]) && okState(states[k])) out.missed.push(w);
        if(okState(truthStates[k]) && !okState(states[k])) out.invented.push(w);
      });
      tot[p][lang].missed += out.missed.length; tot[p][lang].invented += out.invented.length;
    }
    out.states = states;
    row.providers[p] = out;
    const marks = truthStates
      ? (out.missed.length || out.invented.length
        ? [out.missed.length ? `MISSED A SLIP on ${out.missed.join(', ')}` : '', out.invented.length ? `INVENTED A SLIP on ${out.invented.join(', ')}` : ''].filter(Boolean).join('; ')
        : 'judged every word right')
      : '';
    console.log(`  ${p.padEnd(6)}: ${r.transcript || '(nothing heard)'}${marks ? '  → ' + marks : ''}`);
  }
  const g = row.providers.gemini, s = row.providers.sarvam;
  if(!truthStates && g && s && g.states && s.states){
    const differ = words.filter((w, k) => okState(g.states[k]) !== okState(s.states[k]));
    console.log(`  ${differ.length ? 'they disagree on: ' + differ.join(', ') + ' (add a .truth.txt to see who is right)' : 'they agree on every word'}`);
  }
  console.log('');
  report.push(row);
}

/* totals, and the decision */
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
console.log('Totals (words misjudged, of words in clips with a truth file):');
for(const lang of ['hi', 'en']) for(const p of PROVIDERS){
  const t = tot[p][lang];
  if(!t.words && !t.failed) continue;
  console.log(`  ${lang === 'hi' ? 'Hindi  ' : 'English'} ${p.padEnd(6)}: ${t.missed} missed + ${t.invented} invented of ${t.words} words (${pct(t.missed + t.invented, t.words)})${t.failed ? `, ${t.failed} clip(s) failed` : ''}`);
}
const gh = tot.gemini.hi, sh = tot.sarvam.hi;
const bad = x => x.missed + x.invented;
let verdict;
if(!gh.words) verdict = 'No Hindi clips with a truth file — add some (with .truth.txt) to decide.';
else if(!sh.words) verdict = 'Sarvam gave no answers to compare against (is SARVAM_API_KEY set?).';
else if(bad(gh) > bad(sh) * 1.25 + 1 || gh.missed > sh.missed + 1)
  verdict = 'Gemini misjudges children reading Hindi clearly more than Sarvam (or hides more slips). Switch: SPEECH_PROVIDER=sarvam in voice/.env.';
else verdict = 'Gemini is not clearly worse on Hindi here. Keep SPEECH_PROVIDER=gemini, and keep testing with more children.';
console.log('\n' + verdict);
if(jsonOut){ fs.writeFileSync(jsonOut, JSON.stringify({ totals: tot, verdict, clips: report }, null, 2)); console.log(`(written to ${jsonOut})`); }
