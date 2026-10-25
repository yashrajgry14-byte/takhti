/* ==================================================================
   THE MISREADING CORPUS — what children actually read

   Every reading on a call is graded word by word from Bolna's transcript
   (report.js keeps each word's state and what the recognizer heard). Put
   together across thousands of calls, that is a map of real Indian
   children's misreadings — ण read as न, a matra dropped, "the" for "then"
   — which is what makes the diagnosis better over time.

   Rules:
   - Only children whose parent said yes to this separate purpose
     (consent.research) are included. Lessons never depend on it.
   - Nothing that identifies a child leaves this file: no names, no ids,
     no phone numbers, no session ids, no audio. Children are counted, not
     listed.
   - A heard form is only shown once at least K different children
     (TAKHTI_CORPUS_MIN_CHILDREN, default 3) produced it, so one child's
     odd reading can't be traced back through the export.
   ================================================================== */
'use strict';

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('hi', { granularity: 'grapheme' }) : null;
const graphemes = w => seg ? [...seg.segment(w)].map(x => x.segment) : Array.from(w);
const clean = w => String(w || '').normalize('NFC').replace(/[.,!?;:"'“”‘’()\[\]।॥…]/g, '').trim();
const lower = (w, lang) => lang === 'en' ? w.toLowerCase() : w;

/* One letter (grapheme) swapped for another: "ण→न", "b→d". Only for
   words the same length that differ in exactly one place, which is where
   a swap can honestly be named. */
function swapOf(target, heard) {
  const a = graphemes(target), b = graphemes(heard);
  if (a.length !== b.length || a.length < 2) return null;
  const diff = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push([a[i], b[i]]);
  if (diff.length !== 1) return null;
  // "पा" read as "मा": the matra is shared, the letter changed — name the letter
  let [x, y] = diff[0].map(g => Array.from(g));
  while (x.length > 1 && y.length > 1 && x[x.length - 1] === y[y.length - 1]) { x.pop(); y.pop(); }
  return { from: x.join(''), to: y.join('') };
}

function buildCorpus(brain, env) {
  env = env || process.env;
  const K = Math.max(1, Number(env.TAKHTI_CORPUS_MIN_CHILDREN || 3));
  const kids = new Map(brain.listChildren().filter(c => c.consent && c.consent.given && c.consent.research === true).map(c => [c.id, c]));
  const words = new Map(), swaps = new Map();
  const childrenSeen = new Set();
  let sessions = 0, readings = 0;

  for (const s of brain.listSessions()) {
    if (!kids.has(s.child_id) || !s.processed || !Array.isArray(s.items)) continue;
    let used = false;
    for (const it of s.items) {
      const ev = it.expect === 'reading' && it.kind === 'read' && it.evidence;
      if (!ev || !Array.isArray(ev.tokens) || ev.first_verdict === 'unsure') continue;
      used = true; readings++;
      const toks = ev.tokens;
      toks.forEach((t, i) => {
        const word = lower(clean(t.text), s.lang);
        if (!word) return;
        // a word after the point the child stopped wasn't attempted
        if (t.state === 'miss' && !toks.slice(i + 1).some(x => x.state !== 'miss')) return;
        const key = s.lang + '|' + word;
        const w = words.get(key) || { lang: s.lang, word, bands: new Set(), attempts: 0, ok: 0, near: 0, bad: 0, skipped: 0, children: new Set(), heard: new Map() };
        w.attempts++; w.children.add(s.child_id); w.bands.add(s.band);
        if (t.state === 'ok') w.ok++;
        else if (t.state === 'near') w.near++;
        else if (t.state === 'bad') w.bad++;
        else if (t.state === 'miss') w.skipped++;
        if ((t.state === 'near' || t.state === 'bad') && t.heard) {
          const h = lower(clean(t.heard), s.lang);
          if (h && h !== word) {
            const f = w.heard.get(h) || { count: 0, children: new Set() };
            f.count++; f.children.add(s.child_id); w.heard.set(h, f);
            const sw = swapOf(word, h);
            if (sw) {
              const sk = `${s.lang}|${sw.from}|${sw.to}`;
              const x = swaps.get(sk) || { lang: s.lang, from: sw.from, to: sw.to, count: 0, children: new Set(), words: new Set() };
              x.count++; x.children.add(s.child_id); x.words.add(word); swaps.set(sk, x);
            }
          }
        }
        words.set(key, w);
      });
    }
    if (used) { sessions++; childrenSeen.add(s.child_id); }
  }

  const wordRows = [...words.values()].map(w => ({
    lang: w.lang, word: w.word, bands: [...w.bands].sort(), attempts: w.attempts, ok: w.ok, near: w.near, bad: w.bad, skipped: w.skipped,
    children: w.children.size, trouble: w.attempts ? +((w.attempts - w.ok) / w.attempts).toFixed(3) : 0,
    heard: [...w.heard.entries()].filter(([, f]) => f.children.size >= K)
      .map(([form, f]) => ({ form, count: f.count, children: f.children.size })).sort((a, b) => b.count - a.count).slice(0, 5)
  })).filter(w => w.children >= Math.min(K, 2) || w.attempts >= 3)
    .sort((a, b) => (b.attempts - b.ok) - (a.attempts - a.ok) || b.attempts - a.attempts);

  const swapRows = [...swaps.values()].filter(x => x.children.size >= K)
    .map(x => ({ lang: x.lang, from: x.from, to: x.to, count: x.count, children: x.children.size, words: [...x.words].slice(0, 6) }))
    .sort((a, b) => b.count - a.count);

  return {
    generated_at: new Date().toISOString(), min_children: K,
    children: childrenSeen.size, sessions, readings,
    words: wordRows, swaps: swapRows
  };
}

function corpusCsv(c) {
  const q = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const rows = [['lang', 'word', 'bands', 'attempts', 'ok', 'near', 'bad', 'skipped', 'children', 'trouble', 'heard_as']];
  for (const w of c.words) rows.push([w.lang, w.word, w.bands.join(' '), w.attempts, w.ok, w.near, w.bad, w.skipped, w.children, w.trouble,
    w.heard.map(h => `${h.form} (${h.count})`).join('; ')]);
  return rows.map(r => r.map(q).join(',')).join('\n') + '\n';
}

module.exports = { buildCorpus, corpusCsv, swapOf };
