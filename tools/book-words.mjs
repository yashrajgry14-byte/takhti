/* ==================================================================
   THE BOOK'S OWN WORDS — a library lesson never copies its textbook.

   A reader's chapter is mostly a poem, a song and short sentences ("I see
   with my eyes."). Gemini is told to write its own, and on the first live
   Mridang build (15 Nov 2026) both lessons it kept still copied page 7 word
   for word. The phone's checker can't see the book, so the builder checks:

   - once per chapter, Gemini copies out the chapter's printed lines
     (transcribe()); only a hash of every five-word run is kept, in
     library/<book>/<ch>.book.json — never the text (the book is its
     publisher's; the PDF is never committed either);
   - every lesson the builder keeps is read against it (copied()): a run
     of five or more words in a row from the book rejects the lesson, and
     the repair round is told which words to write again in its own way.
     Nothing shorter counts: a single word ("eyes") or a short common
     phrase ("these are my legs", "with my eyes") is the language every
     Class 1 lesson shares, not copying.

   The words compared are what the child reads or hears: the passage, the
   questions, the answers, the words on cards and Munni's lines.
   ================================================================== */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RUN = 5;               // five words in a row from the book is copying — nothing shorter

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
/* lower case, letters and digits only, one space — "Two little hands go clap, clap, clap." → sentences of words */
const sentencesOf = text => String(text || '').replace(/\r/g, '').split(/[.!?।;:\n]+|\s[—–-]\s/)
  .map(s => s.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()).filter(Boolean)
  .map(s => s.split(' '));
/* a poem's sentence runs over its lines: the lines are joined first, then cut at the full stops */
const poemSentences = text => sentencesOf(String(text || '').replace(/([^.!?।\n])\n(?=\S)/g, '$1 '));
const runsOf = words => words.length < RUN ? [] : words.slice(0, words.length - RUN + 1).map((_, i) => words.slice(i, i + RUN).join(' '));

/* The chapter's printed text → what is kept: hashes only. */
export function bookIndex(text, meta = {}){
  const runs = new Set();
  for(const w of poemSentences(text).concat(sentencesOf(text))) for(const r of runsOf(w)) runs.add(hash(r));
  return { v: 2, at: new Date().toISOString(), ...meta, runs: [...runs].sort() };
}

/* What the child reads or hears in a lesson, English and Hindi. */
function lessonTexts(les){
  const out = [];
  const bi = o => { if(o && typeof o === 'object'){ if(o.en) out.push(o.en); if(o.hi) out.push(o.hi); } };
  // (not the title: naming the chapter's topic — "Parts of the Body" — is fine)
  for(const b of les.beats || []){
    bi(b.say); bi(b.p); bi(b.q);
    for(const k of ['w', 'word', 'text']) if(typeof b[k] === 'string') out.push(b[k]);
    for(const k of ['opts', 'hiOpts']) if(Array.isArray(b[k])) out.push(b[k].join('. '));
  }
  return out;
}

/* The first run of the book's words a lesson copies, as the lesson has it — or null. */
export function copied(les, idx){
  if(!idx || !les) return null;
  const runs = new Set(idx.runs || []);
  for(const t of lessonTexts(les))
    for(const w of sentencesOf(t)){
      const r = runsOf(w).find(x => runs.has(hash(x)));     // (a sentence shorter than five words has no run at all)
      if(r) return r;
    }
  return null;
}
export const copyError = run => `copies the textbook word for word ("${run}") — write the idea in your own words and sentences`;

/* library/<book>/<ch>.book.json — made once, from the chapter's PDF. */
export const indexPath = (dir, id) => path.join(dir, `${id}.book.json`);
export function readIndex(dir, id){
  const f = indexPath(dir, id);
  try{ return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }catch(e){ return null; }
}

/* Gemini copies out the chapter's printed lines (plain text). The model is
   TAKHTI_BOOKWORDS_MODEL, else flash-lite — copying out a page needs no
   thinking, and on every live run so far it is the one that answers. */
export async function transcribe(file, env, fetchImpl = fetch){
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if(!key) throw new Error('no Gemini key');
  const models = String(env.TAKHTI_BOOKWORDS_MODEL || 'gemini-3.5-flash-lite,gemini-3.8-flash').split(',').map(x => x.trim()).filter(Boolean);
  const data = fs.readFileSync(file).toString('base64');
  const body = {
    systemInstruction: { parts: [{ text: 'Copy out, exactly as printed, every line of text in this textbook chapter: poems and songs line by line, sentences, word lists, dialogues, exercises and instructions. One line of the page per line. Leave out page numbers, running headers and copyright marks. Plain text only — no commentary.' }] },
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'application/pdf', data } }, { text: 'Copy out the text of this chapter.' }] }],
    generationConfig: { temperature: 0 }
  };
  let last = '';
  for(const m of models){
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), Number(env.TAKHTI_BOOKWORDS_MS || 90000));
    try{
      const r = await fetchImpl(`${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(m)}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: ctl.signal });
      if(!r.ok){ last = `${m} ${r.status}`; continue; }
      const d = await r.json();
      const text = ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('\n').trim();
      if(text.split(/\s+/).length >= 20) return { text, model: m };
      last = `${m} sent almost nothing`;
    }catch(e){ last = `${m} ${e.name === 'AbortError' ? 'hung' : e.message}`; }
    finally{ clearTimeout(to); }
  }
  throw new Error(`the chapter's text could not be copied out (${last})`);
}

/* The chapter's index: kept if made before, else made now (needs the PDF and a key). */
export async function ensureIndex(dir, meta, file, env, fetchImpl){
  const had = readIndex(dir, meta.id);
  if(had && had.file === path.basename(file)) return had;
  const t = await transcribe(file, env, fetchImpl);
  const idx = bookIndex(t.text, { file: path.basename(file), model: t.model });
  fs.writeFileSync(indexPath(dir, meta.id), JSON.stringify(idx) + '\n');
  return idx;
}
