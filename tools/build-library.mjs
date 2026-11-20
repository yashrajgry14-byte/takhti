#!/usr/bin/env node
/* ==================================================================
   THE LESSON LIBRARY — built ahead, checked once, shipped offline.

   A school tells us which book it teaches from. The book is listed once
   in  library/<book>/book.json  (its chapters, and which PDF each one is);
   this tool drafts every chapter's lessons with Gemini, puts each through
   the phone's own checks and one repair round (tools/try-syllabus.mjs —
   the very same pipeline a teacher's upload goes through), and keeps only
   the lessons that pass. Then it bundles every book into
   src/content/library.js, which the app ships in its offline shell — so a
   teacher picks this week's chapter and approves its aims with no network
   and no waiting, and every school on that book gets the same checked
   lessons.

     node tools/build-library.mjs --book library/ncert-maths-mela-3
     node tools/build-library.mjs --book library/ncert-maths-mela-3 --only ch5 --force
     node tools/build-library.mjs --book library/ncert-maths-mela-3 --import ch5 syllabus-run/raw.json
     node tools/build-library.mjs --book library/ncert-maths-mela-3 --recheck
     node tools/build-library.mjs --bundle
     node tools/build-library.mjs --book library/ncert-maths-mela-3 --batch

     node tools/build-library.mjs --book library/ncert-maths-mela-3 --scan

   --scan            list every chapter PDF in the folder in book.json, in
                     order (a whole book downloaded as one PDF per chapter);
                     front matter and answer files are left out, and a
                     chapter already listed keeps its title, count and note
   --pdfs <folder>   where the chapter PDFs are (default: the book's folder)
   --only <ch>       just that chapter        --force  build it again
   --import <ch> <raw.json>   a try-syllabus run becomes that chapter (no Gemini)
   --recheck         every built chapter checked again by today's checker (no Gemini)
   --bundle          only rewrite src/content/library.js
   --no-bundle       build or re-check the chapters but leave src/content/library.js
                     as it is, so the result can be read before the app changes
  --batch           every chapter to build through the Gemini Batch API
                    (half price; the full Flash model, which is too busy
                    live; PDFs up to 50 MB through the Files API). The job
                    runs on Google's side: if it isn't done within --wait
                    minutes (default 60), run the same command again later
                    and it collects it (library/<book>/.batch.json)
  --replace         a new build replaces a chapter even when it keeps fewer
                    lessons than the one already built (otherwise the new
                    one is saved beside it as <ch>.candidate.json, to read)

   A chapter already built is skipped (so a run cut short carries on where
   it stopped). For each chapter it writes <ch>.json (the lessons that
   passed, and why the rest didn't), <ch>.raw.json (what Gemini sent, for
   --recheck) and <ch>.report.md (read it). The PDFs are never committed
   (.gitignore) — the books are their publishers'; the lessons are Gemini's
   own words, numbers and passages, checked by Takhti, and every school's
   teacher still approves each week's aims before a child sees them.
   ================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run, recheck, report, vetted, readEnv } from './try-syllabus.mjs';
import { ensureIndex, readIndex, copied, copyError } from './book-words.mjs';
/* A library lesson with a picture asks at least two questions — with two
   answers, one question is a coin toss; such a lesson is not kept (a
   teacher's own upload still gets the warning instead). */
const LIB_MIN_QUESTIONS = 2;
/* a reader (any book that isn't maths — Santoor, Veena, Mridang, Sarangi)
   holds every lesson to it: its lessons are passages, and a passage with one
   two-answer question is the same coin toss */
const minAllOf = book => !!book.subject && book.subject !== 'maths';
/* …and its questions don't all share one right answer: with two answers each,
   always-"Yes" is as weak as one question (Sarangi 1 ch7's first build kept two
   such lessons). Builder-only, like the two above: a teacher's own upload, and
   a lesson already on a phone, keep the warning instead. */
const LIB_MIX_ANSWERS = true;
/* …and no yes/no question is a teaching line said back ("तोता starts with त"
   → "does तोता have त?"): every content word of the question in one line
   Munni just said, so the child answers from what they heard (Sarangi 1 ch7's
   rebuild kept one). Builder-only too — a teacher's upload gets the warning. */
const LIB_SAID_BACK = true;
/* an English book's lessons are English lessons: drafted as English (the
   prompt's englishText), checked with lang 'en' (inside the id), read in
   English whatever the app's language (ui/lesson-player.js) */
const langOf = book => (book.subject === 'english' ? 'en' : undefined);
/* a reader's lesson never copies its textbook (tools/book-words.mjs): the
   chapter's index of the book's own words, made once from its PDF, hashes only */
const vetOf = idx => idx ? (les => { const r = copied(les, idx); return r ? copyError(r) : null; }) : undefined;
async function bookWordsFor(dir, book, meta, file, env, fetchImpl, say){
  if(!minAllOf(book)) return null;
  try{ return await ensureIndex(dir, meta, file, { ...readEnv(path.join(root, 'voice', '.env'), process.env), ...(env || {}) }, fetchImpl); }
  catch(e){ say(`  ${meta.id}: the book's own words were not checked — ${e.message}`); return null; }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(root, 'library');

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
const bookDir = b => path.isAbsolute(b) ? b : path.resolve(b);

/* A book's manifest, with what a person is likely to get wrong said plainly. */
export function readBook(dir){
  const f = path.join(dir, 'book.json');
  if(!fs.existsSync(f)) throw new Error(`no book.json in ${dir}`);
  const b = readJSON(f), errs = [];
  if(!/^[a-z0-9-]{3,40}$/.test(b.id || '')) errs.push('id: lower-case letters, digits and dashes');
  if(!b.title || !b.title.en) errs.push('title: { "en": …, "hi": … }');
  if(!/^(kg|c([1-9]|10))$/.test(b.cls || '')) errs.push('cls: kg or c1 … c10');
  if(!Array.isArray(b.chapters) || !b.chapters.length) errs.push('chapters: a list');
  const ids = new Set();
  for(const c of b.chapters || []){
    if(!/^[a-z0-9-]{1,24}$/.test(c.id || '')) errs.push(`chapter ${JSON.stringify(c.id)}: id of lower-case letters, digits and dashes`);
    if(ids.has(c.id)) errs.push(`chapter ${c.id}: listed twice`);
    ids.add(c.id);
  }
  if(errs.length) throw new Error(`${f}:\n  ` + errs.join('\n  '));
  return b;
}

/* One chapter's run → what the library keeps. */
export function chapterOf(meta, r){
  const keep = r.drafts.map(x => x.first.ok ? x.first : x.second && x.second.ok ? x.second : null);
  return {
    id: meta.id, n: meta.n || null,
    title: meta.title || (r.chapter ? { en: r.chapter, hi: r.chapter } : { en: meta.id, hi: meta.id }),
    built: r.rechecked || r.at, model: r.model || '', rechecked: r.rechecked || undefined,
    lessons: keep.filter(Boolean).map(c => c.lesson),
    notUsed: r.drafts.filter((x, i) => !keep[i]).map(x => ({ title: x.raw && x.raw.title, errors: ((x.second || x.first).errors || []).slice(0, 4) }))
  };
}

function saveChapter(dir, meta, r, opts = {}){
  const ch = chapterOf(meta, r);
  // a new build from Gemini never quietly makes a chapter worse: one that keeps
  // fewer lessons than the chapter already built is saved beside it, to read
  // and take with --replace — so a busy day can't empty a chapter a school
  // (or tonight's demo) already uses. --recheck and --import are deliberate
  // and replace as before.
  const was = path.join(dir, `${meta.id}.json`);
  if(opts.guard && !opts.replace && fs.existsSync(was)){
    const old = readJSON(was);
    if(ch.lessons.length < (old.lessons || []).length){
      writeJSON(path.join(dir, `${meta.id}.candidate.raw.json`), r);
      writeJSON(path.join(dir, `${meta.id}.candidate.json`), ch);
      fs.writeFileSync(path.join(dir, `${meta.id}.candidate.report.md`), report(r));
      return { ...ch, candidate: true, had: old.lessons.length };
    }
  }
  writeJSON(path.join(dir, `${meta.id}.raw.json`), r);
  writeJSON(was, ch);
  fs.writeFileSync(path.join(dir, `${meta.id}.report.md`), report(r));
  for(const f of ['candidate.json', 'candidate.raw.json', 'candidate.report.md']){ const c = path.join(dir, `${meta.id}.${f}`); if(fs.existsSync(c)) fs.unlinkSync(c); }
  return ch;
}
const keptSay = ch => ch.candidate
  ? `${ch.lessons.length} lesson(s) — fewer than the ${ch.had} already built, so the chapter is kept as it was; the new build is in ${ch.id}.candidate.report.md (take it with --replace)`
  : `${ch.lessons.length} lesson(s) kept, ${ch.notUsed.length} not used`;

/* Every chapter of a book, drafted (or imported, or checked again). */
export async function buildBook(dirArg, opts = {}, fetchImpl){
  const dir = bookDir(dirArg), book = readBook(dir), say = opts.say || (() => {});
  const out = [], failed = [];
  for(const meta of book.chapters){
    if(opts.only && meta.id !== opts.only) continue;
    const done = path.join(dir, `${meta.id}.json`), raw = path.join(dir, `${meta.id}.raw.json`);
    if(opts.import){
      if(meta.id !== opts.import.ch) continue;
      const r = readJSON(opts.import.file);
      if(r.cls && r.cls !== book.cls) throw new Error(`that run was for ${r.cls}, the book is ${book.cls}`);
      const ch = saveChapter(dir, meta, recheck({ ...r, cls: book.cls, band: r.band }, { minQuestions: LIB_MIN_QUESTIONS, minAll: minAllOf(book), mixRight: LIB_MIX_ANSWERS, saidBack: LIB_SAID_BACK, subject: book.subject, lang: langOf(book), vet: vetOf(readIndex(dir, meta.id)) }));
      say(`${meta.id}: imported — ${ch.lessons.length} lesson(s) kept, ${ch.notUsed.length} not used`);
      out.push(ch); continue;
    }
    if(opts.recheck){
      if(!fs.existsSync(raw)){ say(`${meta.id}: not built yet — skipped`); continue; }
      const ch = saveChapter(dir, meta, recheck(readJSON(raw), { minQuestions: LIB_MIN_QUESTIONS, minAll: minAllOf(book), mixRight: LIB_MIX_ANSWERS, saidBack: LIB_SAID_BACK, subject: book.subject, lang: langOf(book), vet: vetOf(readIndex(dir, meta.id)) }));
      say(`${meta.id}: checked again — ${ch.lessons.length} lesson(s) kept, ${ch.notUsed.length} not used`);
      out.push(ch); continue;
    }
    if(fs.existsSync(done) && !opts.force){ say(`${meta.id}: already built — skipped (--force to build again)`); continue; }
    if(!meta.file){ say(`${meta.id}: no file in book.json — skipped`); continue; }
    const file = path.resolve(opts.pdfs || dir, meta.file);
    if(!fs.existsSync(file)){ say(`${meta.id}: ${file} not found — skipped`); continue; }
    const mb = fs.statSync(file).size / 1048576;
    if(mb > 12){ say(`${meta.id}: ${path.basename(file)} is ${mb.toFixed(1)} MB — over the 12 MB a draft can take; split it — skipped`); failed.push({ id: meta.id, why: 'file over 12 MB' }); continue; }
    say(`${meta.id}: drafting from ${path.basename(file)}…`);
    // a whole book is a long run: one chapter Gemini can't do (busy, quota,
    // a file it can't read) is said and left for the next run, which picks
    // it up because it has no <ch>.json yet — the rest carry on
    try{
      const idx = await bookWordsFor(dir, book, meta, file, opts.env, fetchImpl, say);
      const r = await run({ vet: vetOf(idx), file, cls: book.cls, count: meta.count || 4, note: meta.note || '', minQuestions: LIB_MIN_QUESTIONS, minAll: minAllOf(book), mixRight: LIB_MIX_ANSWERS, saidBack: LIB_SAID_BACK, subject: book.subject, lang: langOf(book), env: opts.env, retryMs: opts.retryMs, say: s => say(`  ${s}`) }, fetchImpl);
      const ch = saveChapter(dir, meta, r, { guard: true, replace: opts.replace });
      say(`${meta.id}: ${keptSay(ch)}`);
      out.push(ch);
    }catch(e){
      if(/no Gemini key/.test(e.message)) throw e;            // nothing else can work either
      say(`${meta.id}: not built — ${e.message}. Run the same command again later; it carries on from here.`);
      failed.push({ id: meta.id, why: e.message });
    }
  }
  summary(dir, book, failed);
  return out;
}

/* ---------- the whole book through the Gemini Batch API ----------
   Half price, and the requests are exactly the live ones (api/syllabus.mjs
   buildRequest, GEN_SHAPES). Each chapter's PDF goes up once through the
   Files API (no 12 MB inline limit — up to 50 MB), the drafts go as one
   batch job, the phone's own checker reads every draft (two questions for
   a picture lesson), and the failures go back as a second job with the
   checker's reasons — the same one repair round as a live build. The job
   runs on Google's side: its name is kept in <book>/.batch.json, so a run
   that stops waiting picks it up again. The default model is the full
   Flash one, which has been too busy for live calls (the eighth and ninth
   live runs) — a batch waits for capacity instead of failing. */
const BATCH_MAX_MB = 50;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const stateOf = j => (j && ((j.metadata && j.metadata.state) || j.state)) || '';
const batchKeyed = j => {
  const r = (j && (j.response || j.dest || (j.metadata && j.metadata.output))) || {};
  const list = (r.inlinedResponses && (r.inlinedResponses.inlinedResponses || r.inlinedResponses)) || [];
  return Array.isArray(list) ? list : [];
};
function gemini(env, fetchImpl){
  const base = env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  const headers = { 'x-goog-api-key': key };
  const json = async (res, what) => {
    const d = await res.json().catch(() => ({}));
    if(!res.ok) throw new Error(`${what}: Gemini said ${res.status}${d && d.error && d.error.message ? ' — ' + String(d.error.message).slice(0, 160) : ''}`);
    return d;
  };
  return {
    /* the Files API's resumable upload: start, then the bytes */
    async upload(file, mime){
      const bytes = fs.readFileSync(file);
      const start = await fetchImpl(`${base}/upload/v1beta/files`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': mime },
        body: JSON.stringify({ file: { display_name: path.basename(file) } }) });
      const url = start.headers && (start.headers.get ? start.headers.get('x-goog-upload-url') : start.headers['x-goog-upload-url']);
      if(!start.ok || !url) throw new Error(`uploading ${path.basename(file)}: the Files API said ${start.status}`);
      const done = await fetchImpl(url, { method: 'POST', headers: { 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: bytes });
      const d = await json(done, `uploading ${path.basename(file)}`);
      return d.file || d;
    },
    /* a PDF is read before it can be used: wait until it is ACTIVE */
    async ready(f, pollMs, until){
      let cur = f;
      while(cur.state && cur.state !== 'ACTIVE'){
        if(cur.state === 'FAILED') throw new Error(`Gemini couldn't read ${cur.displayName || cur.name}`);
        if(Date.now() > until) throw new Error(`${cur.displayName || cur.name} is still being read — run again later`);
        await sleep(pollMs);
        cur = await json(await fetchImpl(`${base}/v1beta/${cur.name}`, { headers }), 'reading the file');
      }
      return cur;
    },
    async forget(name){ try{ await fetchImpl(`${base}/v1beta/${name}`, { method: 'DELETE', headers }); }catch(e){} },
    async submit(model, name, requests){
      const res = await fetchImpl(`${base}/v1beta/models/${encodeURIComponent(model)}:batchGenerateContent`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ batch: { display_name: name, input_config: { requests: { requests } } } }) });
      const job = await json(res, 'the batch');
      if(!job.name) throw new Error('the batch was not accepted (no job name)');
      return job;
    },
    async get(name){ return json(await fetchImpl(`${base}/v1beta/${name}`, { headers }), 'the batch'); }
  };
}
/* Wait for a job; null when it is still running at the deadline. */
async function waitJob(g, name, pollMs, until, say){
  let j = await g.get(name), last = '';
  while(!/SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(stateOf(j))){
    if(Date.now() > until) return null;
    const st = stateOf(j) || 'pending';
    if(st !== last){ say(`  the batch is ${st.replace(/^(JOB|BATCH)_STATE_/, '').toLowerCase()}…`); last = st; }
    await sleep(pollMs);
    j = await g.get(name);
  }
  if(!/SUCCEEDED/.test(stateOf(j))) throw new Error(`the batch ended ${stateOf(j)}`);
  return j;
}
const tokensOf = d => { const u = d && d.usageMetadata, n = v => Number.isFinite(v) ? v : 0; return u ? { in: n(u.promptTokenCount), out: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount), total: n(u.totalTokenCount) } : null; };

export async function batchBook(dirArg, opts = {}, fetchImpl){
  fetchImpl = fetchImpl || fetch;
  const dir = bookDir(dirArg), book = readBook(dir), say = opts.say || (() => {});
  const { readEnv, phoneChecker } = await import('./try-syllabus.mjs');
  const { buildRequest, lessonsFrom, answerJSON, GEN_SHAPES } = await import(pathToFileURL(path.join(root, 'api', 'syllabus.mjs')).href);
  const env = { ...readEnv(path.join(root, 'voice', '.env'), process.env), ...(opts.env || {}) };
  if(!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY)) throw new Error('no Gemini key: put GEMINI_API_KEY=… in voice/.env (see voice/.env.example)');
  const model = env.GEMINI_BATCH_MODEL || env.GEMINI_MODEL || 'gemini-4-hydrogen';
  const g = gemini(env, fetchImpl), pollMs = Number(opts.pollMs != null ? opts.pollMs : 30000);
  const until = Date.now() + Number(opts.waitMs != null ? opts.waitMs : 60 * 60000);
  const ph = phoneChecker(), cls = ph.cls(book.cls), rules = ph.rules(cls.band, cls.id), skills = ph.skills(cls.id, book.subject);
  const statePath = path.join(dir, '.batch.json');
  let st = fs.existsSync(statePath) ? readJSON(statePath) : null;
  const save = () => writeJSON(statePath, st);
  const failed = [], out = [];

  if(!st){
    // which chapters: the same choice as a live build
    const todo = [];
    for(const meta of book.chapters){
      if(opts.only && meta.id !== opts.only) continue;
      if(fs.existsSync(path.join(dir, `${meta.id}.json`)) && !opts.force){ say(`${meta.id}: already built — skipped (--force to build again)`); continue; }
      if(!meta.file){ say(`${meta.id}: no file in book.json — skipped`); continue; }
      const file = path.resolve(opts.pdfs || dir, meta.file);
      if(!fs.existsSync(file)){ say(`${meta.id}: ${file} not found — skipped`); continue; }
      const mb = fs.statSync(file).size / 1048576;
      if(mb > BATCH_MAX_MB){ say(`${meta.id}: ${path.basename(file)} is ${mb.toFixed(1)} MB — over the ${BATCH_MAX_MB} MB the Files API takes; split it — skipped`); failed.push({ id: meta.id, why: `file over ${BATCH_MAX_MB} MB` }); continue; }
      todo.push({ meta, file });
    }
    if(!todo.length){ say('nothing to build'); summary(dir, book, failed); return out; }
    st = { v: 1, model, shape: 0, stage: 'upload', at: new Date().toISOString(), chapters: [] };
    for(const { meta, file } of todo){
      say(`${meta.id}: sending ${path.basename(file)} to the Files API…`);
      try{
        const mime = /\.pdf$/i.test(file) ? 'application/pdf' : /\.png$/i.test(file) ? 'image/png' : /\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg';
        const f = await g.ready(await g.upload(file, mime), Math.min(pollMs, 5000), Date.now() + 10 * 60000);   // reading a PDF takes seconds to minutes — its own deadline, not --wait's
        st.chapters.push({ id: meta.id, file: path.basename(file), mime, uri: f.uri, name: f.name });
      }catch(e){ say(`${meta.id}: not sent — ${e.message}`); failed.push({ id: meta.id, why: e.message }); }
    }
    if(!st.chapters.length){ summary(dir, book, failed); return out; }
    st.stage = 'draft'; save();
  }

  const metaOf = id => book.chapters.find(c => c.id === id) || { id };
  const draftReq = c => { const meta = metaOf(c.id); return buildRequest({ mode: 'draft', rules, cls: cls.id, count: meta.count || 4, skills, note: meta.note || '', lang: langOf(book) }, { fileUri: c.uri, mime: c.mime }); };
  const asRequest = (q, shape) => ({ systemInstruction: { parts: [{ text: q.system }] }, contents: [{ role: 'user', parts: q.parts }], ...GEN_SHAPES[shape] });
  // every request erred as a bad request (the field names) → the next request shape, once each
  const allBad = list => list.length && list.every(x => x.error && (x.error.code === 400 || /INVALID_ARGUMENT/.test(x.error.status || '')));

  /* one job: submit it (or pick up the one already running), wait, read it */
  async function job(kind, build){
    for(;;){
      if(!st[kind]){
        const reqs = build().map(([k, q]) => ({ request: asRequest(q, st.shape), metadata: { key: k } }));
        if(!reqs.length) return {};
        const j = await g.submit(st.model, `takhti-${book.id}-${kind}`, reqs);
        st[kind] = { job: j.name, at: new Date().toISOString(), keys: reqs.map(r => r.metadata.key) }; save();
        say(`${kind === 'drafts' ? 'Drafts' : 'Repairs'}: ${reqs.length} request(s) sent to ${st.model} as one batch (${j.name})`);
      }
      const j = await waitJob(g, st[kind].job, pollMs, until, say);
      if(!j) return null;
      const list = batchKeyed(j);
      if(allBad(list) && st.shape < GEN_SHAPES.length - 1){ st.shape++; st[kind] = null; save(); say(`  the request shape was refused — sending again with the older field names`); continue; }
      const by = {};
      list.forEach((x, i) => { const k = (x.metadata && x.metadata.key) || st[kind].keys[i]; if(k) by[k] = x; });
      st[kind].done = true; save();
      return by;
    }
  }

  const idxs = {};
  for(const c of st.chapters) idxs[c.id] = await bookWordsFor(dir, book, metaOf(c.id), path.resolve(opts.pdfs || dir, c.file), opts.env, fetchImpl, say);
  // 1. the drafts
  const drafts = await job('drafts', () => st.chapters.map(c => [c.id, draftReq(c)]).filter(([, q]) => !q.error));
  if(drafts === null){ say(`The drafts are still running on Google's side (${st.drafts.job}). Run the same command again later — it picks the job up.`); return out; }
  if(!st.checked){
    st.checked = {};
    for(const c of st.chapters){
      const x = drafts[c.id], d = x && x.response, o = d && answerJSON(d);
      if(!o){ st.checked[c.id] = { error: (x && x.error && x.error.message) || 'no answer in the lesson format' }; continue; }
      const q = draftReq(c), got = lessonsFrom(o, q, { model: st.model });
      st.checked[c.id] = { chapter: got.chapter, tokens: tokensOf(d),
        drafts: got.lessons.map(raw => ({ raw, first: vetted(ph.clean(raw, cls.band, skills, false, LIB_MIN_QUESTIONS, minAllOf(book), LIB_MIX_ANSWERS, langOf(book), LIB_SAID_BACK, cls.id), vetOf(idxs[c.id])) })) };
    }
    save();
    const n = Object.values(st.checked).reduce((a, c) => a + (c.drafts ? c.drafts.length : 0), 0), ok = Object.values(st.checked).reduce((a, c) => a + (c.drafts ? c.drafts.filter(x => x.first.ok).length : 0), 0);
    say(`Drafted ${n} lesson(s) across ${st.chapters.length} chapter(s) · ${ok} passed the checker first time`);
  }

  // 2. one repair round, every chapter's failures in the same batch
  const toFix = id => (st.checked[id].drafts || []).map((x, i) => ({ x, i })).filter(({ x }) => !x.first.ok);
  const repairReq = id => buildRequest({ mode: 'repair', rules, cls: cls.id, lang: langOf(book), repair: toFix(id).map(({ x }) => ({ lesson: x.raw, errors: x.first.errors.concat(x.first.aimErrors || []).filter((e, i, a) => a.indexOf(e) === i).slice(0, 10) })) });
  const repairs = await job('repairs', () => st.chapters.filter(c => st.checked[c.id].drafts && toFix(c.id).length).map(c => [c.id, repairReq(c.id)]).filter(([, q]) => !q.error));
  if(repairs === null){ say(`The repairs are still running on Google's side (${st.repairs.job}). Run the same command again later — it picks the job up.`); return out; }

  // 3. each chapter, as a live build saves it — never making a chapter worse
  for(const c of st.chapters){
    const meta = metaOf(c.id), k = st.checked[c.id];
    if(k.error){ say(`${c.id}: not built — ${k.error}`); failed.push({ id: c.id, why: k.error }); continue; }
    const rx = repairs[c.id], rd = rx && rx.response, ro = rd && answerJSON(rd);
    const fixes = toFix(c.id);
    if(ro){ const got = lessonsFrom(ro, { mode: 'repair', count: fixes.length }); got.lessons.forEach((raw, j) => { const f = fixes[j]; if(f){ f.x.repairRaw = raw; f.x.second = vetted(ph.clean(raw, cls.band, skills, true, LIB_MIN_QUESTIONS, minAllOf(book), LIB_MIX_ANSWERS, langOf(book), LIB_SAID_BACK, cls.id), vetOf(idxs[c.id])); } }); }
    const r = {
      at: new Date().toISOString(), cls: cls.id, band: cls.band, rules, note: meta.note || '', ...(langOf(book) ? { lang: langOf(book) } : {}), source: c.file, model: st.model, chapter: k.chapter,
      draftMs: 0, batch: { drafts: st.drafts && st.drafts.job, repairs: st.repairs && st.repairs.job || null },
      tried: [{ model: st.model, outcome: 'batch', ms: 0, ...(k.tokens ? { tokens: k.tokens } : {}) }],
      repair: fixes.length ? { status: ro ? 200 : 502, model: st.model, error: ro ? '' : ((rx && rx.error && rx.error.message) || 'no answer'), ms: 0,
        tried: [{ model: st.model, outcome: 'batch', ms: 0, ...(tokensOf(rd) ? { tokens: tokensOf(rd) } : {}) }] } : null,
      drafts: k.drafts.map(x => ({ raw: x.raw, first: x.first, repairRaw: x.repairRaw || null, second: x.second || null,
        verdict: x.first.ok ? 'passed' : x.second && x.second.ok ? 'repaired' : 'not used' }))
    };
    const ch = saveChapter(dir, meta, r, { guard: true, replace: opts.replace });
    say(`${c.id}: ${keptSay(ch)}`);
    out.push(ch);
  }
  for(const c of st.chapters) await g.forget(c.name);       // the uploads aren't needed any more
  fs.unlinkSync(statePath);
  summary(dir, book, failed);
  return out;
}

/* One page for the whole book: every chapter, in the term's order, what it
   has — read this first, then a chapter's own report. */
export function summary(dir, book, failed = []){
  const rows = book.chapters.map(meta => {
    const f = path.join(dir, `${meta.id}.json`), ch = fs.existsSync(f) ? readJSON(f) : null;
    const why = failed.find(x => x.id === meta.id);
    const title = (ch && ch.title && ch.title.en) || (meta.title && meta.title.en) || '—';
    const state = ch ? `${ch.lessons.length} kept · ${ch.notUsed.length} not used` : why ? `not built: ${why.why.slice(0, 80)}` : 'not built yet';
    return `| ${meta.n || ''} | ${meta.id} | ${title} | ${state} |`;
  });
  const kept = book.chapters.reduce((s, meta) => { const f = path.join(dir, `${meta.id}.json`); return s + (fs.existsSync(f) ? readJSON(f).lessons.length : 0); }, 0);
  const built = book.chapters.filter(meta => fs.existsSync(path.join(dir, `${meta.id}.json`))).length;
  fs.writeFileSync(path.join(dir, 'summary.md'), [`# ${book.title.en} — ${book.cls}`, '',
    `${built} of ${book.chapters.length} chapters built · ${kept} lessons ready`, '',
    '| # | chapter | title | lessons |', '|---|---|---|---|', ...rows, ''].join('\n'));
}

/* Every chapter PDF in the folder → book.json, in order. NCERT's book
   download is one PDF per chapter (…01.pdf, …02.pdf), plus front matter
   (…ps.pdf) and sometimes answers (…an.pdf) — those two are left out. */
export function scan(dirArg, pdfDir){
  const dir = bookDir(dirArg), f = path.join(dir, 'book.json'), book = readJSON(f);
  const from = pdfDir ? path.resolve(pdfDir) : dir;
  const skip = n => /^[a-z]{3,5}\d{0,2}(ps|an|a1|a2)\.pdf$/i.test(n) || /prelim|contents|answer|index|cover/i.test(n);
  const nat = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const all = fs.readdirSync(from).filter(n => /\.pdf$/i.test(n)).sort(nat);
  const pdfs = all.filter(n => !skip(n)), left = all.filter(skip);
  // nothing found: say where it looked and leave book.json as it is (the
  // first real scan found an empty folder and emptied the chapter list)
  if(!pdfs.length){
    const subs = fs.readdirSync(from, { withFileTypes: true }).filter(d => d.isDirectory()
      && fs.readdirSync(path.join(from, d.name)).some(n => /\.pdf$/i.test(n))).map(d => d.name);
    throw new Error(`no chapter PDFs in ${from} — book.json is unchanged.` + (subs.length
      ? ` There are PDFs in the subfolder "${subs[0]}": move them up, or add  --pdfs "${path.join(from, subs[0])}"`
      : ' Copy the chapter PDFs into that folder (unzip the book first), then scan again.'));
  }
  const old = new Map((book.chapters || []).map(c => [c.id, c])), warn = [];
  book.chapters = pdfs.map((file, i) => {
    const id = `ch${i + 1}`, was = old.get(id) || {}, rel = path.relative(dir, path.join(from, file)).split(path.sep).join('/');
    // a chapter already built from another file: its lessons may be another
    // chapter's now — said, never silently kept or thrown away
    if(was.file && was.file !== rel && fs.existsSync(path.join(dir, `${id}.json`)))
      warn.push(`${id} was built from ${was.file}${was.title ? ' (' + was.title.en + ')' : ''}; it is now ${rel}. If that is the same chapter, nothing to do; if not, build it again: --only ${id} --force`);
    return { ...was, id, n: i + 1, file: rel, count: was.count || 4 };
  });
  writeJSON(f, book);
  return { chapters: book.chapters.map(c => `${c.id} ← ${c.file}${c.title ? ' (' + c.title.en + ')' : ''}`), left, warn };
}

/* Every book in library/ → src/content/library.js, the app's offline copy.
   Only a book's own fields and its kept lessons go in (no raw drafts, no
   reports); a chapter not built yet goes in with no lessons, so the teacher
   sees it in the term's order and knows it is coming. */
export function bundle(libDir = LIB, outFile = path.join(root, 'src', 'content', 'library.js')){
  const books = [];
  const dirs = fs.existsSync(libDir) ? fs.readdirSync(libDir).filter(d => fs.existsSync(path.join(libDir, d, 'book.json'))).sort() : [];
  for(const d of dirs){
    const dir = path.join(libDir, d), raw = readJSON(path.join(dir, 'book.json'));
    // a book set up but not built yet (library/BOOKS.md) isn't offered to a
    // teacher: no chapters listed, or none built
    if(!(raw.chapters || []).some(c => c && fs.existsSync(path.join(dir, `${c.id}.json`)))) continue;
    const b = readBook(dir);
    books.push({ id: b.id, board: b.board || '', title: b.title, edition: b.edition || '', cls: b.cls, subject: b.subject || '',
      chapters: b.chapters.map(meta => {
        const f = path.join(dir, `${meta.id}.json`);
        const ch = fs.existsSync(f) ? readJSON(f) : null;
        return { id: meta.id, n: meta.n || null, title: (ch && ch.title) || meta.title || { en: meta.id, hi: meta.id }, built: ch ? ch.built : null, lessons: ch ? ch.lessons : [] };
      }) });
  }
  const n = books.reduce((s, b) => s + b.chapters.reduce((t, c) => t + c.lessons.length, 0), 0);
  fs.writeFileSync(outFile, `/* ==================================================================
   THE LESSON LIBRARY — generated by tools/build-library.mjs from library/.
   Do not edit by hand: edit library/<book>/book.json, build, bundle.

   Every lesson here passed the phone's own checks when it was built, and
   the phone checks it again before a teacher sees it (core/library.js) —
   a lesson edited here gets a different id and is not offered.
   ${books.length} book(s), ${n} lesson(s).
   ================================================================== */
const LIBRARY = ${JSON.stringify({ v: 1, books })};
`);
  return { books: books.length, lessons: n };
}

/* ---------- the command ---------- */
function args(argv){
  const o = {};
  for(let i = 0; i < argv.length; i++){
    const k = argv[i];
    if(k === '--book') o.book = argv[++i];
    else if(k === '--pdfs') o.pdfs = argv[++i];
    else if(k === '--only') o.only = argv[++i];
    else if(k === '--force') o.force = true;
    else if(k === '--recheck') o.recheck = true;
    else if(k === '--bundle') o.bundleOnly = true;
    else if(k === '--no-bundle') o.noBundle = true;
    else if(k === '--scan') o.scan = true;
    else if(k === '--batch') o.batch = true;
    else if(k === '--replace') o.replace = true;
    else if(k === '--wait') o.waitMs = Number(argv[++i]) * 60000;
    else if(k === '--import'){ o.import = { ch: argv[++i], file: argv[++i] }; }
    else if(k === '--help' || k === '-h') o.help = true;
  }
  return o;
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const o = args(process.argv.slice(2));
  if(o.help || (!o.book && !o.bundleOnly)){
    console.log('node tools/build-library.mjs --book library/<book> --scan          (list every chapter PDF in the folder)');
    console.log('node tools/build-library.mjs --book library/<book> [--pdfs folder] [--only ch] [--force] [--recheck] [--import ch raw.json] [--no-bundle]');
    console.log('node tools/build-library.mjs --book library/<book> --batch [--wait 60] [--only ch] [--force] [--replace]   (half price, through the Batch API)');
    console.log('node tools/build-library.mjs --bundle');
    process.exit(o.help ? 0 : 1);
  }
  (async () => {
    if(o.book && o.scan){
      const r = scan(o.book, o.pdfs);
      console.log(`book.json now lists ${r.chapters.length} chapter(s), in this order — check it matches the book's contents:\n  ` + r.chapters.join('\n  '));
      if(r.left.length) console.log(`Left out (front matter / answers): ${r.left.join(', ')}`);
      for(const w of r.warn) console.log('⚠ ' + w);
      console.log('\nThen build:  node tools/build-library.mjs --book ' + o.book);
      return;
    }
    if(o.book && o.batch) await batchBook(o.book, { ...o, say: s => console.log('· ' + s) });
    else if(o.book) await buildBook(o.book, { ...o, say: s => console.log('· ' + s) });
    if(o.noBundle && !o.bundleOnly){ console.log('\n--no-bundle: src/content/library.js left as it was — run --bundle when the chapters are right.'); return; }
    const b = bundle();
    console.log(`\nsrc/content/library.js: ${b.books} book(s), ${b.lessons} lesson(s). Bump CACHE in sw.js before you ship it.`);
  })().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
}

