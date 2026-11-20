#!/usr/bin/env node
/* ==================================================================
   ONE CHAPTER, LIVE, THROUGH TAKHTI'S OWN SYLLABUS PIPELINE

   The same path a teacher's "Draft this week's lessons" takes, without
   the app or the voice server, in one command:

     chapter (PDF / photo / text) → Gemini drafts (api/syllabus.mjs,
     draftCore) → the PHONE's own checks (sylClean + validateLesson,
     the real src/ files in a vm) → failures sent back to Gemini once
     with the checker's reasons → checked again → a report.

   Why: the drafting prompt, the structured aims and sylTidy() have
   only ever met a stand-in Gemini in the tests. This shows what the
   real one does with a real chapter, before anything is built on it.

     node tools/try-syllabus.mjs --file "C:\path\to\chapter.pdf" --class c3
     node tools/try-syllabus.mjs --text chapter.txt --class c2 --count 3 --note "borrowing"

   --class kg | c1 … c5 (default c3)     --count 2–5 lessons (default 4)
   --note "…" what to stress               --out folder (default syllabus-run)

     node tools/try-syllabus.mjs --recheck syllabus-run/raw.json
   checks a saved run's drafts again with today's checker (no Gemini, no
   key) and rewrites its report — what the same drafts would get now.

   The key comes from voice/.env (GEMINI_API_KEY), as the voice server
   reads it. It is never printed or written: the report and raw.json
   hold only what Gemini sent and what the checker said.
   Writes  <out>/report.md  (read it) and  <out>/raw.json  (send it).
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* voice/.env, the same tiny loader as voice/server.js; the shell's own variables win */
export function readEnv(file, base){
  const env = { ...(base || {}) };
  if(!fs.existsSync(file)) return env;
  for(const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)){
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if(m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

/* The phone's checker: the app's own content and core files, in index.html's
   order, in a vm. Only files that need a browser at load time are left out —
   none of them is part of checking a lesson. */
export function phoneChecker(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, JSON };
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1])
    .filter(f => /^src\/(config|state)\.js$|^src\/(content|core)\/|^src\/games\/game-core\.js$/.test(f))
    .filter(f => !/\/(speech|voice|sfx)\.js$/.test(f));
  for(const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  ctx.log = () => {};
  const call = src => JSON.parse(vm.runInContext(`JSON.stringify(${src})`, ctx));
  return {
    cls: id => call(`sylClass(${JSON.stringify(id)})`),
    rules: band => call(`sylRules(${JSON.stringify(band)})`),
    skills: (id, subject) => call(`sylSkills(sylClass(${JSON.stringify(id)}), ${JSON.stringify(subject || '')})`),
    // min: the questions a picture lesson must ask (the library builder sets 2 — a coin toss isn't kept)
    // all: every lesson, not only a picture one (a reader's library — Santoor, Veena)
    // mix: the questions mustn't all share one right answer (the library builder — always-"Yes" isn't kept)
    // lang: an English book's lesson ('en') — read in English whatever the app's language
    clean: (raw, band, skills, mend, min, all, mix, lang) => call(`sylClean(${JSON.stringify(raw)}, { band: ${JSON.stringify(band)}, skills: ${JSON.stringify(skills)}, mendHints: ${!!mend}, minQuestions: ${Number(min) || 0}, minAll: ${!!all}, mixRight: ${!!mix}, lang: ${JSON.stringify(lang === 'en' ? 'en' : null)} })`)
  };
}

/* A check only the builder can make (the library's: does a lesson copy its
   textbook? tools/book-words.mjs): vet(lesson) → a reason, or null. A lesson
   it stops is not kept, and the repair round is told why, like any other. */
export function vetted(res, vet){
  const why = vet && res && res.lesson ? vet(res.lesson) : null;
  return why ? { ...res, ok: false, errors: res.errors.concat([why]) } : res;
}

const MIMES = { '.pdf':'application/pdf', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };

/* The whole run. fetchImpl is the test's stand-in Gemini; left out, the real one. */
export async function run(opts, fetchImpl){
  const env = { TAKHTI_SYLLABUS_MAX_MB: 12, TAKHTI_SYLLABUS_TIMEOUT_MS: 180000, ...readEnv(path.join(root, 'voice', '.env'), process.env), ...(opts.env || {}) };
  if(!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY)) throw new Error('no Gemini key: put GEMINI_API_KEY=… in voice/.env (see voice/.env.example)');
  const chapter = {};
  if(opts.file){
    const mime = MIMES[path.extname(opts.file).toLowerCase()];
    if(!mime) throw new Error('--file must be a PDF or a photo (.png, .jpg, .webp)');
    chapter.file = fs.readFileSync(opts.file).toString('base64'); chapter.mime = mime;
  }
  if(opts.text) chapter.text = fs.readFileSync(opts.text, 'utf8');
  if(!chapter.file && !chapter.text) throw new Error('give the chapter: --file chapter.pdf (or a photo) or --text chapter.txt');

  const lang = opts.lang === 'en' ? 'en' : undefined;     // an English book's lesson (api/syllabus.mjs englishText)
  const ph = phoneChecker();
  const cls = ph.cls(opts.cls || 'c3'), rules = ph.rules(cls.band), skills = ph.skills(cls.id, opts.subject);
  const { draftCore } = await import(pathToFileURL(path.join(root, 'api', 'syllabus.mjs')).href);
  const say = opts.say || (() => {});
  const t0 = Date.now();
  say(`Asking ${env.GEMINI_MODEL || 'gemini-4-hydrogen'} for ${opts.count || 4} lesson(s) for ${cls.en}…`);
  // Google's busy spells come and go (the first live run hit one): a busy or
  // timed-out draft is tried once more after a pause, as a person would
  let d = await draftCore({ mode:'draft', chapter, rules, count: opts.count || 4, skills, note: opts.note || '', lang }, env, 'try-syllabus', fetchImpl);
  if(d.status === 502 && /busy/.test(d.json.error || '') || d.status === 504){
    const pause = Number(opts.retryMs != null ? opts.retryMs : 60000);
    say(`${d.json.error} — trying once more in ${Math.round(pause / 1000)} s…`);
    await new Promise(r => setTimeout(r, pause));
    d = await draftCore({ mode:'draft', chapter, rules, count: opts.count || 4, skills, note: opts.note || '', lang }, env, 'try-syllabus', fetchImpl);
  }
  const draftMs = Date.now() - t0;
  if(d.status !== 200) throw new Error(`Gemini's draft failed (${d.status}): ${d.json.error}`);
  const raws = d.json.lessons || [];
  const min = opts.minQuestions || 0, all = !!opts.minAll, mix = !!opts.mixRight;
  const drafts = raws.map(raw => ({ raw, first: vetted(ph.clean(raw, cls.band, skills, false, min, all, mix, lang), opts.vet) }));
  say(`Drafted ${raws.length} in ${(draftMs / 1000).toFixed(0)} s (${d.json.model}) · ${drafts.filter(x => x.first.ok).length} passed the checker first time`);

  const failed = drafts.filter(x => !x.first.ok);
  let repair = null;
  if(failed.length){
    const t1 = Date.now();
    const r = await draftCore({ mode:'repair', repair: failed.map(x => ({ lesson: x.raw, errors: x.first.errors.concat(x.first.aimErrors || []).filter((e, i, a) => a.indexOf(e) === i).slice(0, 10) })), rules, lang }, env, 'try-syllabus', fetchImpl);
    repair = { status: r.status, model: r.json.model || '', error: r.json.error || '', ms: Date.now() - t1, tried: r.json.tried || [] };
    if(r.status === 200) (r.json.lessons || []).forEach((raw, k) => { if(failed[k]){ failed[k].repairRaw = raw; failed[k].second = vetted(ph.clean(raw, cls.band, skills, true, min, all, mix, lang), opts.vet); } });
    say(`Sent ${failed.length} back with the checker's reasons · ${failed.filter(x => x.second && x.second.ok).length} fixed`);
  }
  const result = {
    at: new Date().toISOString(), cls: cls.id, band: cls.band, rules, note: opts.note || '', ...(lang ? { lang } : {}),
    source: opts.file ? path.basename(opts.file) : path.basename(opts.text), model: d.json.model, chapter: d.json.chapter, draftMs, tried: d.json.tried || [], repair,
    drafts: drafts.map(x => ({ raw: x.raw, first: x.first, repairRaw: x.repairRaw || null, second: x.second || null,
      verdict: x.first.ok ? 'passed' : x.second && x.second.ok ? 'repaired' : 'not used' }))
  };
  return result;
}

/* A saved run checked again by today's checker — no Gemini, no key. After a
   change to the checks, this says what the same drafts would get now. */
export function recheck(r, opts){
  const min = (opts && opts.minQuestions) || 0, all = !!(opts && opts.minAll), mix = !!(opts && opts.mixRight);
  const lang = (opts && opts.lang) || r.lang || undefined;     // a run keeps its lang; a library recheck says it again
  const ph = phoneChecker(), skills = ph.skills(r.cls, (opts && opts.subject) || r.subject);
  const drafts = r.drafts.map(x => {
    const vet = opts && opts.vet;
    const first = vetted(ph.clean(x.raw, r.band, skills, false, min, all, mix, lang), vet), second = x.repairRaw ? vetted(ph.clean(x.repairRaw, r.band, skills, true, min, all, mix, lang), vet) : null;
    return { ...x, first, second, verdict: first.ok ? 'passed' : second && second.ok ? 'repaired' : 'not used' };
  });
  return { ...r, ...(lang ? { lang } : {}), rechecked: new Date().toISOString(), drafts };
}

/* ---------- the report a person reads ---------- */
const t = o => o && typeof o === 'object' ? (o.en || '') + (o.hi ? '  ·  ' + o.hi : '') : String(o == null ? '' : o);
function beatLine(b){
  const say = b.say ? ` — "${t(b.say)}"` : '';
  switch(b.t){
    case 'ask': return `**Q:** ${t(b.q)}  \n  options: ${(b.opts || []).map((o, i) => i === b.correct ? `**${o} ✓**` : o).join(' / ')}  ·  ${(b.hiOpts || []).join(' / ')}` + (b.why ? `  \n  _teacher note:_ ${t(b.why)}` : '');
    case 'passage': return `passage: "${t(b.p)}"`;
    case 'figure': return `figure: ${b.kind}${b.s ? ' s=' + b.s : ''}${b.w ? ' ' + b.w + '×' + b.h : ''}${b.sides ? ' sides ' + b.sides.join(',') : ''}${b.folds != null ? ' folds ' + b.folds : ''}${b.ask ? ' · asks ' + b.ask : ''}${say}`;
    case 'corner': return `corner: ${b.deg}°${b.ask ? ' · asks ' + b.ask : ''}${say}`;
    case 'figures': return `row: ${(b.items || []).map(i => i.kind + (i.deg ? ' ' + i.deg + '°' : '')).join(', ')}${b.find ? ' · find ' + b.find : ''}${say}`;
    case 'clock': return `clock: ${b.h}:${String(b.m).padStart(2, '0')}${b.ask ? ' · asks ' + b.ask : ''}${say}`;
    case 'months': return `months${b.date ? ' · date ' + b.date : ''}${b.m ? ' · month ' + b.m : ''}${b.m2 ? ' to ' + b.m2 : ''}${b.k ? ' · ' + b.k + ' later' : ''}${b.ask ? ' · asks ' + b.ask : ''}${say}`;
    case 'calendar': return `calendar: ${b.days} days, 1st on day ${b.start}${b.month ? ' · month ' + b.month : ''}${b.d ? ' · date ' + b.d : ''}${b.w != null ? ' · column ' + b.w : ''}${b.k ? ' · ' + b.k + ' days later' : ''}${b.ask ? ' · asks ' + b.ask : ''}${say}`;
    case 'clocks': return `clocks: ${b.from ? b.from.h + ':' + String(b.from.m).padStart(2, '0') : '?'} → ${b.to ? b.to.h + ':' + String(b.to.m).padStart(2, '0') : '?'}${b.ask ? ' · asks ' + b.ask : ''}${say}`;
    default: return `${b.t}${['a','b','n','hops'].filter(k => b[k] != null).map(k => ' ' + k + '=' + b[k]).join('')}${say}`;
  }
}
function lessonBlock(les, check, label){
  const out = [`*${label}*`];
  if(!check.ok) out.push('', '**Why it failed:**', ...check.errors.map(e => `- ${e}`));
  if(check.aimErrors && check.aimErrors.length) out.push('', '**Aims dropped:**', ...check.aimErrors.map(e => `- ${e}`));
  if(check.aimFixes && check.aimFixes.length) out.push('', '**Hints replaced:**', ...check.aimFixes.map(e => `- ${e}`));
  const aims = (check.lesson && check.lesson.aims) || [];
  if(aims.length) out.push('', '**Aims kept (what the teacher approves):**', ...aims.map(a => `- ${t(a.point)}  \n  Appu forgets: "${t(a.forget)}"`));
  const beats = (check.ok ? check.lesson.beats : les.beats) || [];
  out.push('', '**The lesson:**', ...beats.map((b, i) => `${i + 1}. ${beatLine(b)}`));
  return out.join('\n');
}
export function report(r){
  const n = v => r.drafts.filter(x => x.verdict === v).length;
  const L = [
    `# Syllabus run — ${r.source}`, '',
    `${r.at} · ${r.cls} (${r.band}, numbers to ${r.rules.maxNumber}) · ${/^gemini/i.test(r.model || "") ? "Gemini model" : "drafted by"} **${r.model}** · chapter "${r.chapter}"`, '',
    `**${n('passed')} passed first time · ${n('repaired')} fixed by the repair round · ${n('not used')} not used** (of ${r.drafts.length})  `,
    `Draft took ${(r.draftMs / 1000).toFixed(0)} s` + (r.repair ? ` · repair ${r.repair.status === 200 ? 'took ' + (r.repair.ms / 1000).toFixed(0) + ' s (' + r.repair.model + ')' : 'failed: ' + r.repair.error}` : ''), ''
  ];
  // which models answered, and how — a 429 is the key's quota, not Google being busy
  const tl = a => (a || []).map(x => `${x.model} ${x.outcome} (${(x.ms / 1000).toFixed(0)} s${x.tokens ? `, ${x.tokens.in} in / ${x.tokens.out} out tokens` : ''})`).join(' → ');
  if(r.tried && r.tried.length) L.push(`Models for the draft: ${tl(r.tried)}  `);
  if(r.repair && r.repair.tried && r.repair.tried.length) L.push(`Models for the repair: ${tl(r.repair.tried)}  `);
  // what the run used, per model — price it from the model's page (prices change; none are written here)
  const used = {};
  for(const x of [...(r.tried || []), ...((r.repair && r.repair.tried) || [])]) if(x.tokens){ const u = used[x.model] = used[x.model] || { in: 0, out: 0 }; u.in += x.tokens.in; u.out += x.tokens.out; }
  if(Object.keys(used).length) L.push(`Tokens used: ${Object.entries(used).map(([m, u]) => `${m} ${u.in} in / ${u.out} out`).join('; ')}  `);
  if(r.rechecked) L.push(`_Checked again on ${r.rechecked} by today's checker (the same drafts, no new call to Gemini)._  `);
  L.push('');
  const why = {};
  r.drafts.forEach(x => (x.first.errors || []).forEach(e => { const k = e.replace(/\d+/g, 'N').replace(/"[^"]*"/g, '"…"').slice(0, 90); why[k] = (why[k] || 0) + 1; }));
  if(Object.keys(why).length) L.push('## What the checker caught first time', ...Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, c]) => `- ${c}× ${k}`), '');
  r.drafts.forEach((x, i) => {
    L.push(`## ${i + 1}. ${t(x.raw.title)} — ${x.verdict.toUpperCase()}`, `skill: ${x.raw.skill || '—'} · source: ${x.raw.source || '—'}`, '');
    L.push(lessonBlock(x.raw, x.first, 'First draft'), '');
    if(x.second) L.push(lessonBlock(x.repairRaw, x.second, 'After the repair round'), '');
  });
  return L.join('\n');
}

/* ---------- the command ---------- */
function args(argv){
  const o = {};
  for(let i = 0; i < argv.length; i++){
    const k = argv[i], v = argv[i + 1];
    if(k === '--file') o.file = v, i++;
    else if(k === '--text') o.text = v, i++;
    else if(k === '--class') o.cls = v, i++;
    else if(k === '--count') o.count = Number(v), i++;
    else if(k === '--note') o.note = v, i++;
    else if(k === '--out') o.out = v, i++;
    else if(k === '--recheck') o.recheck = v, i++;
    else if(k === '--help' || k === '-h') o.help = true;
  }
  return o;
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const o = args(process.argv.slice(2));
  if(o.help || (!o.file && !o.text && !o.recheck)){
    console.log('node tools/try-syllabus.mjs --file chapter.pdf [--class c3] [--count 4] [--note "…"] [--out syllabus-run]');
    console.log('node tools/try-syllabus.mjs --recheck syllabus-run/raw.json   (the saved drafts, checked again — no Gemini)');
    process.exit(o.help ? 0 : 1);
  }
  const job = o.recheck ? Promise.resolve().then(() => recheck(JSON.parse(fs.readFileSync(o.recheck, 'utf8'))))
    : run({ ...o, say: s => console.log('· ' + s) });
  job.then(r => {
    const out = path.resolve(o.out || (o.recheck ? path.dirname(o.recheck) : 'syllabus-run'));
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'raw.json'), JSON.stringify(r, null, 2));
    fs.writeFileSync(path.join(out, 'report.md'), report(r));
    const n = v => r.drafts.filter(x => x.verdict === v).length;
    console.log(`\nDone: ${n('passed')} passed · ${n('repaired')} repaired · ${n('not used')} not used.`);
    console.log(`Read  ${path.join(out, 'report.md')}\nSend  ${path.join(out, 'raw.json')}`);
  }).catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
}
