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

   --pdfs <folder>   where the chapter PDFs are (default: the book's folder)
   --only <ch>       just that chapter        --force  build it again
   --import <ch> <raw.json>   a try-syllabus run becomes that chapter (no Gemini)
   --recheck         every built chapter checked again by today's checker (no Gemini)
   --bundle          only rewrite src/content/library.js

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
import { fileURLToPath } from 'node:url';
import { run, recheck, report } from './try-syllabus.mjs';

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
  if(!/^(kg|c[1-5])$/.test(b.cls || '')) errs.push('cls: kg or c1 … c5');
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

function saveChapter(dir, meta, r){
  const ch = chapterOf(meta, r);
  writeJSON(path.join(dir, `${meta.id}.raw.json`), r);
  writeJSON(path.join(dir, `${meta.id}.json`), ch);
  fs.writeFileSync(path.join(dir, `${meta.id}.report.md`), report(r));
  return ch;
}

/* Every chapter of a book, drafted (or imported, or checked again). */
export async function buildBook(dirArg, opts = {}, fetchImpl){
  const dir = bookDir(dirArg), book = readBook(dir), say = opts.say || (() => {});
  const out = [];
  for(const meta of book.chapters){
    if(opts.only && meta.id !== opts.only) continue;
    const done = path.join(dir, `${meta.id}.json`), raw = path.join(dir, `${meta.id}.raw.json`);
    if(opts.import){
      if(meta.id !== opts.import.ch) continue;
      const r = readJSON(opts.import.file);
      if(r.cls && r.cls !== book.cls) throw new Error(`that run was for ${r.cls}, the book is ${book.cls}`);
      const ch = saveChapter(dir, meta, recheck({ ...r, cls: book.cls, band: r.band }));
      say(`${meta.id}: imported — ${ch.lessons.length} lesson(s) kept, ${ch.notUsed.length} not used`);
      out.push(ch); continue;
    }
    if(opts.recheck){
      if(!fs.existsSync(raw)){ say(`${meta.id}: not built yet — skipped`); continue; }
      const ch = saveChapter(dir, meta, recheck(readJSON(raw)));
      say(`${meta.id}: checked again — ${ch.lessons.length} lesson(s) kept, ${ch.notUsed.length} not used`);
      out.push(ch); continue;
    }
    if(fs.existsSync(done) && !opts.force){ say(`${meta.id}: already built — skipped (--force to build again)`); continue; }
    if(!meta.file){ say(`${meta.id}: no file in book.json — skipped`); continue; }
    const file = path.resolve(opts.pdfs || dir, meta.file);
    if(!fs.existsSync(file)){ say(`${meta.id}: ${file} not found — skipped`); continue; }
    say(`${meta.id}: drafting from ${path.basename(file)}…`);
    const r = await run({ file, cls: book.cls, count: meta.count || 4, note: meta.note || '', env: opts.env, retryMs: opts.retryMs, say: s => say(`  ${s}`) }, fetchImpl);
    const ch = saveChapter(dir, meta, r);
    say(`${meta.id}: ${ch.lessons.length} lesson(s) kept, ${ch.notUsed.length} not used`);
    out.push(ch);
  }
  return out;
}

/* Every book in library/ → src/content/library.js, the app's offline copy.
   Only a book's own fields and its kept lessons go in (no raw drafts, no
   reports); a chapter not built yet goes in with no lessons, so the teacher
   sees it in the term's order and knows it is coming. */
export function bundle(libDir = LIB, outFile = path.join(root, 'src', 'content', 'library.js')){
  const books = [];
  const dirs = fs.existsSync(libDir) ? fs.readdirSync(libDir).filter(d => fs.existsSync(path.join(libDir, d, 'book.json'))).sort() : [];
  for(const d of dirs){
    const dir = path.join(libDir, d), b = readBook(dir);
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
    else if(k === '--import'){ o.import = { ch: argv[++i], file: argv[++i] }; }
    else if(k === '--help' || k === '-h') o.help = true;
  }
  return o;
}
if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const o = args(process.argv.slice(2));
  if(o.help || (!o.book && !o.bundleOnly)){
    console.log('node tools/build-library.mjs --book library/<book> [--pdfs folder] [--only ch] [--force] [--recheck] [--import ch raw.json]');
    console.log('node tools/build-library.mjs --bundle');
    process.exit(o.help ? 0 : 1);
  }
  (async () => {
    if(o.book) await buildBook(o.book, { ...o, say: s => console.log('· ' + s) });
    const b = bundle();
    console.log(`\nsrc/content/library.js: ${b.books} book(s), ${b.lessons} lesson(s). Bump CACHE in sw.js before you ship it.`);
  })().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
}

