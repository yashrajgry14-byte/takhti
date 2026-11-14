#!/usr/bin/env node
/* The live check: does Gemini really hear and judge the way Takhti needs?

   Lesson drafting has been proven live; hearing a child, judging a Teach Munni
   explanation and Munni's own voice have only met a stand-in. This runs each
   of them against the real API, once per model in the chain, and says which
   models work, how long each took against the phone's budget, and what to put
   in voice/.env.

     node tools/live-check.mjs
     node tools/live-check.mjs --clip my-reading.webm --line "मेरा भाई स्कूल जाता है" --lang hi
     node tools/live-check.mjs --models gemini-3.5-flash-lite      # only these models

   1. Munni's voice: Gemini TTS says a line (saved as live-check/munni.wav to listen to).
   2. Hearing: Gemini TTS reads lines WITH A PLANTED SLIP ("बाई" for "भाई",
      "run" for "ran", a skipped word); Gemini must write the slip down, not
      the line. An adult voice is easier than a child's — passing here is
      necessary, not enough; real children come with tools/compare-speech.mjs.
   3. The judge: four explanations of borrowing (full English, full Hinglish,
      vague, only repeating Munni) must come out covered / covered / not
      covered / not covered.
      Each clip is heard with the line (as the app sends it) and without it;
      a model that gives no answer twice is skipped for the rest of a part.
   4. The judge from a recording: the full explanation spoken, heard, judged.
   5. With --clip: your own recording heard against --line.

   The key comes from voice/.env (GEMINI_API_KEY) and is never printed or
   written. live-check/ holds the report and the TTS clips — no child's voice,
   nothing secret — and is not committed. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readEnv } from './try-syllabus.mjs';
import { judgeCore } from '../api/teachback.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { narrate, checkReading } = require('../voice/speech.js');

/* What the phone allows, so a model that works but is too slow is said so. */
const BUDGET = { hear: 6000, judge: 9000 };

export const HEAR_CASES = [
  { id: 'hi-slip', lang: 'hi', line: 'मेरा भाई स्कूल जाता है', spoken: 'मेरा बाई स्कूल जाता है', keep: 'बाई', not: 'भाई',
    what: 'a Hindi slip (बाई for भाई) kept, not corrected' },
  { id: 'en-slip', lang: 'en', line: 'The dog ran to the park', spoken: 'The dog run to the park', keep: 'run', not: 'ran',
    what: 'an English slip (run for ran) kept' },
  { id: 'en-skip', lang: 'en', line: 'I like to eat red apples', spoken: 'I like to eat apples', keep: 'apples', not: 'red',
    what: 'a skipped word (red) left out' },
  { id: 'hi-clean', lang: 'hi', line: 'आज मौसम बहुत अच्छा है', spoken: 'आज मौसम बहुत अच्छा है', keep: 'मौसम', not: null,
    what: 'a clean Hindi read written as read' }
];

const AIMS = [{ id: 'borrow.when' }, { id: 'borrow.ten' }];
export const JUDGE_CASES = [
  { id: 'full-en', lang: 'en', expect: { 'borrow.when': true, 'borrow.ten': true },
    said: 'When the top ones number is smaller you borrow one ten from the tens, so the 2 becomes 12 and then you take away 7' },
  { id: 'full-hinglish', lang: 'hi', expect: { 'borrow.when': true, 'borrow.ten': true },
    said: 'upar wala 2 chhota hai to dahai se ek das udhaar lo, phir 2 ka 12 ho jayega kyunki ek dahai das ikai hai' },
  { id: 'vague', lang: 'en', expect: { 'borrow.when': false, 'borrow.ten': false },
    said: 'you just do it carefully and then take away the number' },
  { id: 'echo-munni', lang: 'en', expect: { 'borrow.when': false, 'borrow.ten': false },
    said: '2 is so small, I forgot what to do, does it stay 2' }
];

const words = s => String(s || '').toLowerCase().replace(/[.,!?।]/g, ' ').split(/\s+/).filter(Boolean);
export function hearVerdict(c, transcript){
  const w = words(transcript);
  const kept = w.includes(c.keep.toLowerCase()), clean = !c.not || !w.includes(c.not.toLowerCase());
  return { pass: kept && clean, why: !transcript ? 'heard nothing' : !clean ? `wrote "${c.not}" — the line, not what was said` : !kept ? `"${c.keep}" not written down` : 'ok' };
}
export function judgeVerdict(c, judge){
  if(!judge) return { pass: false, why: 'no judgement (the phone\'s rubric would decide)' };
  const got = {};
  for(const a of judge.aims || []) got[a.id] = a.verdict === 'covered';
  const wrong = Object.keys(c.expect).filter(id => !!got[id] !== c.expect[id]);
  return { pass: !wrong.length, why: wrong.length ? wrong.map(id => `${id}: ${(judge.aims.find(a => a.id === id) || {}).verdict || 'none'}, wanted ${c.expect[id] ? 'covered' : 'not covered'}`).join('; ') : 'ok' };
}

function chain(env, flag){
  if(flag) return flag.split(',').map(s => s.trim()).filter(Boolean);
  const fb = String(env.GEMINI_FALLBACK_MODEL || 'gemini-3.7-flash,gemini-3.5-flash-lite');
  return [...new Set([env.TAKHTI_TEACH_MODEL || env.GEMINI_MODEL || 'gemini-3.8-flash', env.GEMINI_SPEECH_MODEL || 'gemini-3.8-flash', ...(fb === 'none' ? [] : fb.split(','))].map(s => s.trim()).filter(Boolean))];
}
const ms = t0 => Date.now() - t0;

export async function run(opts, fetchImpl){
  opts = opts || {};
  fetchImpl = fetchImpl || fetch;
  const env0 = { ...readEnv(path.join(root, 'voice', '.env'), process.env), ...(opts.env || {}) };
  if(!(env0.GEMINI_API_KEY || env0.GOOGLE_API_KEY)) throw new Error('no Gemini key: put GEMINI_API_KEY=… in voice/.env (see voice/.env.example)');
  // a probe waits longer than the phone would, so a slow model is measured, not just cut off
  const env = { ...env0, TAKHTI_SPEECH_BUDGET_MS: '40000', GEMINI_SPEECH_TIMEOUT_MS: '35000', TAKHTI_TEACH_TIMEOUT_MS: '35000', GEMINI_TTS_TIMEOUT_MS: '40000', TAKHTI_TEACH_PER_HOUR: '1000' };
  const models = chain(env0, opts.models);
  const say = opts.quiet ? () => {} : (...a) => console.log(...a);
  const out = { at: new Date().toISOString(), thinking: env.TAKHTI_THINKING || 'low', models, tts: null, hear: [], judge: [], judgeAudio: null, clip: null };
  let ip = 0;

  // 1. Munni's voice — also makes the clips for 2 and 4
  const ttsModel = env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  say(`\n1. Munni's voice (${ttsModel})`);
  const clips = {};
  let t0 = Date.now();
  const munni = await narrate('नमस्ते! मैं मुन्नी हूँ। चलो साथ में पढ़ते हैं।', 'hi', { env, fetch: fetchImpl, provider: 'gemini' });
  out.tts = { model: ttsModel, ok: !munni.error, ms: ms(t0), error: munni.error || null };
  if(!munni.error && opts.dir){ fs.writeFileSync(path.join(opts.dir, 'munni.wav'), Buffer.from(munni.audio, 'base64')); }
  say(munni.error ? `   ✗ ${munni.error}` : `   ✓ ${out.tts.ms} ms${opts.dir ? ' — listen: live-check/munni.wav' : ''}`);
  if(!munni.error){
    for(const c of HEAR_CASES){
      const r = await narrate(c.spoken, c.lang, { env, fetch: fetchImpl, provider: 'gemini', pace: 0.9 });
      if(!r.error) clips[c.id] = { buf: Buffer.from(r.audio, 'base64'), mime: r.mime };
    }
    const full = JUDGE_CASES[0];
    const r = await narrate(full.said, 'en', { env, fetch: fetchImpl, provider: 'gemini' });
    if(!r.error) clips.explain = { buf: Buffer.from(r.audio, 'base64'), mime: r.mime };
  }

  // 2. hearing, per model — with the line (as the app sends it) and without it
  say(`\n2. Hearing a reading (the phone waits ${BUDGET.hear / 1000} s; thinking ${env.TAKHTI_THINKING || 'low'})`);
  if(!Object.keys(clips).length) say('   — skipped: no clips (Munni\'s voice failed). Use --clip with your own recording.');
  const DOWN = 2;   // calls with no answer before a model's remaining cases are skipped
  for(const model of models){
    const rows = []; let dead = 0;
    for(const c of HEAR_CASES){
      if(!clips[c.id]) continue;
      if(dead >= DOWN){ rows.push({ case: c.id, what: c.what, ms: 0, heard: '', pass: false, why: 'skipped: no answer twice', error: true, skipped: true }); continue; }
      const hearOnce = async line => {
        const t = Date.now();
        const r = await checkReading(clips[c.id], c.line, c.lang, { env: { ...env, GEMINI_SPEECH_MODEL: model, GEMINI_HEAR_LINE: line ? '1' : '0' }, fetch: fetchImpl, provider: 'gemini' });
        const v = r.error ? { pass: false, why: (r.tried || [r.error]).join('; ') } : hearVerdict(c, r.transcript);
        return { ms: ms(t), heard: r.transcript || '', ...v, error: !!r.error };
      };
      const w = await hearOnce(true);
      const n = w.error && dead + 1 >= DOWN ? { ms: 0, heard: '', pass: false, why: 'skipped', error: true } : await hearOnce(false);
      dead = w.error && n.error ? dead + 1 : 0;
      rows.push({ case: c.id, what: c.what, ...w, noLine: n });
    }
    if(!rows.length) continue;
    out.hear.push({ model, rows });
    say(`   ${model}`);
    for(const x of rows){
      if(x.skipped){ say(`     – ${x.case.padEnd(9)} skipped (no answer twice)`); continue; }
      say(`     ${x.pass ? '✓' : '✗'} ${x.case.padEnd(9)} with line ${String(x.ms).padStart(6)} ms${x.ms > BUDGET.hear ? ' (too slow)' : ''}  "${x.heard}"${x.pass ? '' : '  — ' + x.why}`);
      say(`     ${x.noLine.pass ? '✓' : '✗'} ${''.padEnd(9)} no line   ${String(x.noLine.ms).padStart(6)} ms${x.noLine.ms > BUDGET.hear ? ' (too slow)' : ''}  "${x.noLine.heard}"${x.noLine.pass ? '' : '  — ' + x.noLine.why}`);
    }
  }

  // 3. the judge, per model
  say(`\n3. Judging a Teach Munni explanation (the phone waits ${BUDGET.judge / 1000} s)`);
  for(const model of models){
    const rows = []; let dead = 0;
    for(const c of JUDGE_CASES){
      if(dead >= DOWN){ rows.push({ case: c.id, ms: 0, verdicts: '', pass: false, why: 'skipped: no answer twice', error: 'skipped' }); continue; }
      t0 = Date.now();
      const r = await judgeCore({ consent: true, lang: c.lang, ages: [7, 8], ask: AIMS[0].id, aims: AIMS, transcript: c.said },
        { ...env, TAKHTI_TEACH_MODEL: model }, 'live-check-' + (ip++), fetchImpl);
      const j = r.json || {};
      const v = judgeVerdict(c, j.judge);
      rows.push({ case: c.id, ms: ms(t0), verdicts: (j.judge && j.judge.aims || []).map(a => `${a.id}=${a.verdict}`).join(' '), ...v, error: j.error || null });
      dead = j.judge ? 0 : dead + 1;
    }
    out.judge.push({ model, rows });
    say(`   ${model}`);
    for(const x of rows) say(`     ${x.pass ? '✓' : '✗'} ${x.case.padEnd(13)} ${String(x.ms).padStart(6)} ms${x.ms > BUDGET.judge ? ' (too slow)' : ''}  ${x.verdicts || x.error || ''}${x.pass ? '' : '  — ' + x.why}`);
  }

  // 4. the judge from a recording, with the first model that judged everything right
  const judgeOk = out.judge.find(m => m.rows.every(x => x.pass && x.ms <= BUDGET.judge)) || out.judge.find(m => m.rows.every(x => x.pass));
  const hearOk = hearPick(out.hear, true) || hearPick(out.hear, false);
  say('\n4. Judging from a recording');
  if(clips.explain && judgeOk){
    const hearModel = hearOk ? hearOk.model : models[0];
    const hear = (buf, mime, lang) => checkReading({ buf, mime }, null, lang, { env: { ...env, GEMINI_SPEECH_MODEL: hearModel }, fetch: fetchImpl, provider: 'gemini' });
    t0 = Date.now();
    const r = await judgeCore({ consent: true, lang: 'en', ages: [7, 8], ask: AIMS[0].id, aims: AIMS, audio: clips.explain.buf.toString('base64'), mime: clips.explain.mime },
      { ...env, TAKHTI_TEACH_MODEL: judgeOk.model }, 'live-check-' + (ip++), fetchImpl, hear);
    const j = r.json || {};
    out.judgeAudio = { hearModel, judgeModel: judgeOk.model, ms: ms(t0), heard: j.transcript || '', ...judgeVerdict(JUDGE_CASES[0], j.judge) };
    say(`   ${out.judgeAudio.pass ? '✓' : '✗'} ${out.judgeAudio.ms} ms  heard "${out.judgeAudio.heard}"${out.judgeAudio.pass ? '' : '  — ' + out.judgeAudio.why}`);
  } else say('   — skipped: ' + (!clips.explain ? 'no recording to judge' : 'no model judged all four right'));

  // 5. the user's own recording
  if(opts.clip){
    const buf = fs.readFileSync(opts.clip), ext = path.extname(opts.clip).slice(1).toLowerCase();
    const mime = { webm: 'audio/webm', wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', opus: 'audio/ogg' }[ext] || 'audio/webm';
    const model = hearOk ? hearOk.model : models[0];
    t0 = Date.now();
    const r = await checkReading({ buf, mime }, opts.line || null, opts.lang === 'en' ? 'en' : 'hi', { env: { ...env, GEMINI_SPEECH_MODEL: model }, fetch: fetchImpl, provider: 'gemini' });
    out.clip = { file: path.basename(opts.clip), line: opts.line || null, model, ms: ms(t0), heard: r.transcript || '', words: r.words || null, error: r.error || null };
    say(`\n5. Your recording (${out.clip.file}, ${model})\n   ${r.error ? '✗ ' + r.error : `${out.clip.ms} ms  heard "${out.clip.heard}"`}`);
    if(r.words) for(const w of r.words) if(w.said !== w.word) say(`     ${w.word} → "${w.said}"`);
  }

  out.advice = advise(out, env0, models);
  say('\nWhat to do\n' + out.advice.map(a => '   ' + a).join('\n'));
  return out;
}

/* The first model that heard every case right, in one way (with the line,
   as the app sends it, or without it), within the phone's time if `fast`. */
export function hearPick(hear, fast){
  for(const mode of ['line', 'noline'])
    for(const m of hear){
      const rs = m.rows.map(x => mode === 'line' ? x : x.noLine).filter(Boolean);
      if(rs.length && rs.every(x => x.pass && (!fast || x.ms <= BUDGET.hear))) return { model: m.model, line: mode === 'line' };
    }
  return null;
}

export function advise(out, env, models){
  const a = [];
  const fits = (m, b) => m.rows.length && m.rows.every(x => x.pass && x.ms <= b);
  const works = m => m.rows.length && m.rows.every(x => x.pass);
  const hear = hearPick(out.hear, true), hearSlow = hearPick(out.hear, false);
  const judge = out.judge.find(m => fits(m, BUDGET.judge)), judgeSlow = out.judge.find(works);
  const curHear = env.GEMINI_SPEECH_MODEL || 'gemini-3.8-flash', curJudge = env.TAKHTI_TEACH_MODEL || env.GEMINI_MODEL || 'gemini-3.8-flash';
  if(!out.tts || !out.tts.ok) a.push(`Munni's voice (${out.tts && out.tts.model}) failed: ${out.tts && out.tts.error}. The offline pack can't be built with Gemini until it works; tools/build-audio.mjs --provider sarvam still can.`);
  const lineNote = h => h.line ? '' : ' and GEMINI_HEAR_LINE=0 (with the line, it wrote the line instead of what was said)';
  if(hear) a.push(hear.model === curHear && hear.line ? `Hearing: ${curHear} works and fits the phone's time. Nothing to change.` : `Hearing: set GEMINI_SPEECH_MODEL=${hear.model}${lineNote(hear)} in voice/.env.`);
  else if(hearSlow) a.push(`Hearing: only ${hearSlow.model}${hearSlow.line ? '' : ' without the line'} heard every slip, and too slowly for the phone's 6 s. Readings would wait and then fall back to Sarvam: set SPEECH_PROVIDER=sarvam for now.`);
  else if(out.hear.length) a.push('Hearing: no model kept every slip in time. Set SPEECH_PROVIDER=sarvam in voice/.env for now, and run tools/compare-speech.mjs on real recordings before deciding.');
  if(judge) a.push(judge.model === curJudge ? `Judge: ${curJudge} works and fits. Nothing to change.` : `Judge: set TAKHTI_TEACH_MODEL=${judge.model} in voice/.env (${curJudge} failed or was too slow; lesson drafting keeps its own setting).`);
  else if(judgeSlow) a.push(`Judge: only ${judgeSlow.model} judged all four right, and too slowly for the phone's 9 s; the phone's own rubric would decide instead.`);
  else a.push('Judge: no model judged all four right; the phone\'s own rubric decides (safe: it hints, never says wrong).');
  a.push('Send live-check/report.md to Claude. It holds no key and no child\'s voice.');
  return a;
}

export function report(out){
  const L = [`# Live check — ${out.at}`, '', `Models tried: ${out.models.join(', ')}; thinking: ${out.thinking}`, '',
    `## Munni's voice`, out.tts ? `${out.tts.model}: ${out.tts.ok ? 'ok' : 'failed — ' + out.tts.error} (${out.tts.ms} ms)` : 'not run', '',
    `## Hearing (phone budget ${BUDGET.hear} ms)`];
  for(const m of out.hear){ L.push(`### ${m.model}`); for(const x of m.rows){ L.push(`- ${x.pass ? '✓' : '✗'} ${x.case} — ${x.what}, with the line: ${x.ms} ms, heard "${x.heard}"${x.pass ? '' : ' — ' + x.why}`); if(x.noLine) L.push(`  - ${x.noLine.pass ? '✓' : '✗'} without the line: ${x.noLine.ms} ms, heard "${x.noLine.heard}"${x.noLine.pass ? '' : ' — ' + x.noLine.why}`); } }
  L.push('', `## Judge (phone budget ${BUDGET.judge} ms)`);
  for(const m of out.judge){ L.push(`### ${m.model}`); for(const x of m.rows) L.push(`- ${x.pass ? '✓' : '✗'} ${x.case}: ${x.ms} ms, ${x.verdicts || x.error || 'no answer'}${x.pass ? '' : ' — ' + x.why}`); }
  L.push('', '## Judge from a recording', out.judgeAudio ? `${out.judgeAudio.pass ? '✓' : '✗'} heard by ${out.judgeAudio.hearModel}, judged by ${out.judgeAudio.judgeModel}: ${out.judgeAudio.ms} ms, heard "${out.judgeAudio.heard}"${out.judgeAudio.pass ? '' : ' — ' + out.judgeAudio.why}` : 'not run');
  if(out.clip) L.push('', '## Your recording', `${out.clip.file} (${out.clip.model}): ${out.clip.error || `${out.clip.ms} ms, heard "${out.clip.heard}"`}`, ...(out.clip.words || []).map(w => `- ${w.word} → "${w.said}"`));
  L.push('', '## What to do', ...out.advice.map(a => '- ' + a), '');
  return L.join('\n');
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const argv = process.argv.slice(2), flag = n => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
  const dir = path.join(root, 'live-check');
  fs.mkdirSync(dir, { recursive: true });
  run({ dir, clip: flag('clip'), line: flag('line'), lang: flag('lang'), models: flag('models') })
    .then(out => { fs.writeFileSync(path.join(dir, 'report.md'), report(out)); console.log('\nReport: live-check/report.md'); })
    .catch(e => { console.error('Stopped: ' + e.message); process.exit(1); });
}
