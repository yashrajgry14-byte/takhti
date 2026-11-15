/* The lesson library: tools/build-library.mjs (a book's chapters drafted
   ahead, checked, only the passing lessons kept, bundled into the app) and
   the teacher's side (the school's book, the term's order, this week's
   chapter opened and approved — with no network). */
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
let passes = 0, failures = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const lib = await import(pathToFileURL(path.join(root, 'tools/build-library.mjs')).href);
  // the seventh live run's own drafts (Maths Mela Class 3, shapes) — what a real Gemini sends
  const run7 = JSON.parse(fs.readFileSync(path.join(root, 'library/ncert-maths-mela-3/ch5.raw.json'), 'utf8'));
  // the library keeps a picture lesson only with two or more questions (14 Nov 2026) and those
  // drafts ask one: the stand-in sends each with a second question of its own — a rectangle's
  // perimeter, whose answer (18) none of them shares, since the library also won't keep a lesson
  // whose questions all have one right answer — so every other decision below is the drafts'
  // own (the one-question drafts themselves: section 1b)
  const SECOND = [{ t:'figure', kind:'rectangle', w:7, h:2, ask:'perimeter' },
    { t:'ask', q:{ en:'How far is it all the way round?', hi:'चारों ओर कुल कितनी दूरी है?' }, opts:['18','9'], hiOpts:['18','9'], correct:0,
      why:{ en:'Children add only two sides.', hi:'बच्चे केवल दो भुजाएँ जोड़ते हैं।' } }];
  const twoQ = l => {
    if(!l || !Array.isArray(l.beats)) return l;
    const b = l.beats;
    if(!b.some(x => x && x.t === 'ask')) return l;
    const win = b.findIndex(x => x && x.t === 'win'), out = b.slice();
    out.splice(win >= 0 ? win : out.length, 0, ...JSON.parse(JSON.stringify(SECOND)));
    return { ...l, beats: out };
  };
  const firsts = run7.drafts.map(d => twoQ(d.raw)), fixes = run7.drafts.filter(d => !d.first.ok).map(d => twoQ(d.repairRaw));

  /* ---------- 1. the builder, against a stand-in Gemini ---------- */
  try{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-lib-'));
    const dir = path.join(tmp, 'test-book');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'book.json'), JSON.stringify({ id:'test-book', board:'NCERT', title:{ en:'Maths Mela', hi:'गणित मेला' }, cls:'c3', subject:'maths',
      chapters:[{ id:'ch5', n:5, file:'ch5.pdf', count:4 }, { id:'ch6', n:6, file:'missing.pdf' }] }));
    fs.writeFileSync(path.join(dir, 'ch5.pdf'), Buffer.from('%PDF-1.4 ' + 'x'.repeat(400)));
    let calls = 0, sent = [];
    const stand = (repairs) => async (url, o) => {
      calls++; sent.push(o.body);
      const body = JSON.parse(o.body), text = body.contents[0].parts[0].text || '';
      const repair = /"lessons"\s*:/.test(text) && /errors/.test(text);
      const r = repair ? { lessons: repairs } : { chapter: 'Fun with Shapes', lessons: firsts };
      return { ok: true, status: 200, json: async () => ({ candidates:[{ content:{ parts:[{ text: JSON.stringify(r) }] } }] }) };
    };
    const said = [];
    const env = { GEMINI_API_KEY: 'gk-library-secret', GEMINI_MODEL: 'gemini-test', GEMINI_FALLBACK_MODEL: 'none', TAKHTI_SYLLABUS_LOG: '0' };
    // the repair fixes one of the two; the other comes back as it was
    const out = await lib.buildBook(dir, { env, say: s => said.push(s) }, stand([fixes[0], firsts[run7.drafts.findIndex(d => !d.first.ok) + 1] || firsts[3]]));
    const ch5 = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8'));
    check('a chapter is drafted, checked and repaired once — the library keeps only the lessons that passed, and names the one that didn\'t, with why',
      out.length === 1 && ch5.lessons.length === 3 && ch5.notUsed.length === 1 && ch5.notUsed[0].errors.length > 0 && ch5.lessons.every(l => /^sch-/.test(l.id) && l.aims.length >= 1),
      JSON.stringify({ kept: ch5.lessons.length, notUsed: ch5.notUsed }));
    check('…its title comes from the chapter itself when book.json has none, and a chapter whose PDF is missing is skipped and said so',
      ch5.title.en === 'Fun with Shapes' && said.some(s => /ch6: .*missing\.pdf not found — skipped/.test(s)), JSON.stringify([ch5.title, said]));
    check('…the raw drafts and a report are written beside it, and the Gemini key is in none of the files',
      ['ch5.raw.json', 'ch5.report.md', 'ch5.json'].every(f => fs.existsSync(path.join(dir, f)) && !fs.readFileSync(path.join(dir, f), 'utf8').includes('gk-library-secret')), fs.readdirSync(dir).join());
    const before = calls;
    await lib.buildBook(dir, { env, say: s => said.push(s) }, stand(fixes));
    check('a chapter already built is skipped (a run cut short carries on where it stopped) — no call to Gemini', calls === before && said.some(s => /ch5: already built — skipped/.test(s)), calls - before);
    await lib.buildBook(dir, { env, force: true, only: 'ch5' }, stand(fixes));
    const ch5b = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8'));
    check('--force --only builds that chapter again (this time both repairs land: 4 of 4)', calls > before && ch5b.lessons.length === 4 && ch5b.notUsed.length === 0, ch5b.lessons.length);
    // --recheck and --import: no Gemini at all
    const c0 = calls;
    const re = await lib.buildBook(dir, { recheck: true });
    fs.unlinkSync(path.join(dir, 'ch5.json'));
    const run7two = { ...run7, drafts: run7.drafts.map(d => ({ ...d, raw: twoQ(d.raw), repairRaw: twoQ(d.repairRaw) })) };
    fs.writeFileSync(path.join(tmp, 'run7-two.json'), JSON.stringify(run7two));
    await lib.buildBook(dir, { import: { ch: 'ch5', file: path.join(tmp, 'run7-two.json') } });
    check('--recheck checks the saved drafts again and --import turns a try-syllabus run into a chapter — neither calls Gemini',
      calls === c0 && re.length === 1 && JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8')).lessons.length === 4, calls - c0);
    // 1b. the seventh run's own drafts ask one question each: the library keeps none of them now
    fs.unlinkSync(path.join(dir, 'ch5.json'));
    await lib.buildBook(dir, { import: { ch: 'ch5', file: path.join(root, 'library/ncert-maths-mela-3/ch5.raw.json') } });
    const one = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8'));
    check('a picture lesson with one question (a coin toss) is not kept in the library, each named with why — the same drafts with two questions keep 4',
      calls === c0 && one.lessons.length === 0 && one.notUsed.length === 4 && one.notUsed.every(n => n.errors.some(e => /asks at least 2 questions/.test(e))), JSON.stringify(one.notUsed.map(n => n.errors)));
    fs.unlinkSync(path.join(dir, 'ch5.json'));
    await lib.buildBook(dir, { import: { ch: 'ch5', file: path.join(tmp, 'run7-two.json') } });
    // a whole book: --scan lists every chapter PDF in order, leaving front matter and answers out
    const whole = path.join(tmp, 'whole');
    fs.mkdirSync(whole);
    fs.writeFileSync(path.join(whole, 'book.json'), JSON.stringify({ id:'whole', title:{ en:'Maths Mela', hi:'गणित मेला' }, cls:'c3', chapters:[{ id:'ch2', n:2, file:'old-two.pdf', title:{ en:'Toy Joy', hi:'खिलौने' }, count:3 }] }));
    fs.writeFileSync(path.join(whole, 'ch2.json'), JSON.stringify({ id:'ch2', lessons:[], notUsed:[] }));
    for(const n of ['cemm1ps.pdf', 'cemm110.pdf', 'cemm102.pdf', 'cemm101.pdf', 'cemm1an.pdf']) fs.writeFileSync(path.join(whole, n), Buffer.from('%PDF-1.4 ' + 'x'.repeat(400)));
    const emptyDir = path.join(tmp, 'empty'); fs.mkdirSync(path.join(emptyDir, 'unzipped'), { recursive: true });
    const keep = JSON.stringify({ id:'empty', title:{ en:'B', hi:'ब' }, cls:'c3', chapters:[{ id:'ch5', n:5, file:'ch5.pdf' }] });
    fs.writeFileSync(path.join(emptyDir, 'book.json'), keep); fs.writeFileSync(path.join(emptyDir, 'unzipped', 'a01.pdf'), '%PDF');
    let emsg = ''; try{ lib.scan(emptyDir); }catch(e){ emsg = e.message; }
    check('--scan on a folder with no PDFs refuses, leaves book.json untouched, and points at a subfolder that has them',
      /no chapter PDFs/.test(emsg) && /subfolder "unzipped"/.test(emsg) && fs.readFileSync(path.join(emptyDir, 'book.json'), 'utf8') === keep, emsg);
    fs.rmSync(emptyDir, { recursive: true });
    const sc = lib.scan(whole), wb = lib.readBook(whole);
    check('--scan lists a whole book\'s chapter PDFs in their order (01, 02, 10 — not 01, 10, 02), leaving the front matter and answers out',
      wb.chapters.map(c => `${c.id}:${c.file}`).join() === 'ch1:cemm101.pdf,ch2:cemm102.pdf,ch3:cemm110.pdf' && sc.left.join() === 'cemm1an.pdf,cemm1ps.pdf', JSON.stringify([wb.chapters, sc.left]));
    check('…a chapter already listed keeps its title and count, and one already built from another file is warned about, never silently kept',
      wb.chapters[1].title.en === 'Toy Joy' && wb.chapters[1].count === 3 && sc.warn.length === 1 && /ch2 was built from old-two\.pdf.*--only ch2 --force/.test(sc.warn[0]), JSON.stringify([wb.chapters[1], sc.warn]));
    // one chapter Gemini can't do doesn't stop the book
    let n2 = 0;
    const flaky = async (url, o) => { n2++; return { ok: false, status: 503, json: async () => ({ error:{ message:'overloaded' } }) }; };
    const said2 = [];
    fs.unlinkSync(path.join(whole, 'ch2.json'));
    const got = await lib.buildBook(whole, { env, retryMs: 0, say: s => said2.push(s) }, flaky);
    const sum = fs.readFileSync(path.join(whole, 'summary.md'), 'utf8');
    check('a chapter Gemini can\'t do is said and left for the next run, and the book carries on to the next chapter — every chapter tried',
      got.length === 0 && said2.filter(x => /not built — .*carries on from here/.test(x)).length === 3, said2.join(' | '));
    check('…and summary.md lists every chapter in order with what it has (here: not built, and why)',
      /0 of 3 chapters built · 0 lessons ready/.test(sum) && (sum.match(/not built:/g) || []).length === 3 && /\| 2 \| ch2 \| Toy Joy \|/.test(sum), sum);
    let msg = '';
    fs.writeFileSync(path.join(tmp, 'bad.json'), '{}');
    try{ fs.mkdirSync(path.join(tmp, 'bad')); fs.writeFileSync(path.join(tmp, 'bad', 'book.json'), JSON.stringify({ id:'Bad Book', cls:'class3', chapters:[] })); lib.readBook(path.join(tmp, 'bad')); }catch(e){ msg = e.message; }
    check('a book.json with a bad id, class or no chapters is refused, each fault said plainly', /id: lower-case/.test(msg) && /cls: kg or c1/.test(msg) && /chapters: a list/.test(msg) && /title/.test(msg), msg);
    // the bundle
    fs.rmSync(path.join(tmp, 'bad'), { recursive: true });
    fs.rmSync(whole, { recursive: true });
    const outFile = path.join(tmp, 'library.js'), b = lib.bundle(tmp, outFile), src = fs.readFileSync(outFile, 'utf8');
    const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.L = LIBRARY;', ctx);
    check('the bundle is one script defining LIBRARY: the book, every chapter in order (one not built yet, with no lessons), only the kept lessons — no raw drafts, no reports',
      b.books === 1 && ctx.L.books[0].chapters.map(c => `${c.id}:${c.lessons.length}`).join() === 'ch5:4,ch6:0' && !/notUsed|drafts|candidates/.test(src), JSON.stringify(ctx.L.books[0].chapters.map(c => [c.id, c.lessons.length])));
    // the shipped bundle is exactly what library/ makes (nobody edits it by hand)
    const shipped = path.join(tmp, 'shipped.js');
    lib.bundle(path.join(root, 'library'), shipped);
    check('src/content/library.js is exactly what library/ builds — regenerate it with tools/build-library.mjs --bundle, never by hand',
      fs.readFileSync(shipped, 'utf8') === fs.readFileSync(path.join(root, 'src/content/library.js'), 'utf8'), 'they differ');
    check('the chapter PDFs are never committed (.gitignore)', /library\/\*\*\/\*\.pdf/.test(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')), '');
    fs.rmSync(tmp, { recursive: true });
  }catch(e){ check('the builder ran', false, e.stack); }

  /* ---------- 1c. the whole book through the Batch API (half price) ---------- */
  try{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-batch-'));
    const dir = path.join(tmp, 'bk');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'book.json'), JSON.stringify({ id:'bk-test', title:{ en:'Maths Mela', hi:'गणित मेला' }, cls:'c3', chapters:[{ id:'ch5', n:5, file:'ch5.pdf', count:4 }] }));
    fs.writeFileSync(path.join(dir, 'ch5.pdf'), Buffer.from('%PDF-1.4 ' + 'x'.repeat(400)));
    const batchStand = o => {
      const log = { uploads: 0, deletes: [], submits: [], gets: 0 }, jobs = {};
      let n = 0;
      const reply = (status, body, headers = {}) => ({ ok: status < 300, status, headers: { get: k => headers[k.toLowerCase()] }, json: async () => body });
      const fetch = async (url, opt = {}) => {
        const u = String(url), H = opt.headers || {};
        if(u.endsWith('/upload/v1beta/files')){ log.start = H; return reply(200, {}, { 'x-goog-upload-url': 'https://up.example/u1' }); }
        if(u.startsWith('https://up.example/')){ log.uploads++; log.uploadHeaders = H; return reply(200, { file: { name: 'files/f1', uri: 'https://gen.example/files/f1', state: 'PROCESSING', displayName: 'ch5.pdf' } }); }
        if(/\/v1beta\/files\/f1$/.test(u) && opt.method === 'DELETE'){ log.deletes.push('files/f1'); return reply(200, {}); }
        if(/\/v1beta\/files\/f1$/.test(u)) return reply(200, { name: 'files/f1', uri: 'https://gen.example/files/f1', state: 'ACTIVE' });
        if(/:batchGenerateContent$/.test(u)){
          const b = JSON.parse(opt.body), name = 'batches/b' + (++n);
          log.submits.push({ url: u, body: b, key: H['x-goog-api-key'] }); jobs[name] = { body: b, polls: 0 };
          return reply(200, { name, metadata: { state: 'BATCH_STATE_PENDING' } });
        }
        if(/\/v1beta\/batches\//.test(u)){
          log.gets++;
          const name = u.split('/v1beta/')[1], jb = jobs[name];
          if(++jb.polls <= (o.pendingPolls || 0)) return reply(200, { name, metadata: { state: 'BATCH_STATE_RUNNING' } });
          const inl = jb.body.batch.input_config.requests.requests.map(r => {
            if(o.badShape0 && r.request.generationConfig.responseFormat) return { metadata: r.metadata, error: { code: 400, status: 'INVALID_ARGUMENT', message: 'unknown field responseFormat' } };
            const text = r.request.contents[0].parts.map(p => p.text || '').join(''), repair = /"lessons"\s*:/.test(text) && /errors/.test(text);
            const out = repair ? { lessons: o.repairs } : { chapter: 'Fun with Shapes', lessons: o.firsts };
            return { metadata: r.metadata, response: { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 300, totalTokenCount: 1300 } } };
          });
          return reply(200, { name, metadata: { state: 'BATCH_STATE_SUCCEEDED' }, response: { inlinedResponses: { inlinedResponses: inl } } });
        }
        return reply(404, {});
      };
      return { log, fetch };
    };
    const env = { GEMINI_API_KEY: 'gk-batch-secret', TAKHTI_SYLLABUS_LOG: '0' };
    const said = [];
    // the job is still running when the first run stops waiting; the second run collects it
    const sa = batchStand({ firsts, repairs: fixes, pendingPolls: 1 });
    const first = await lib.batchBook(dir, { env, pollMs: 0, waitMs: 0, say: s => said.push(s) }, sa.fetch);
    const state = fs.existsSync(path.join(dir, '.batch.json')) ? JSON.parse(fs.readFileSync(path.join(dir, '.batch.json'), 'utf8')) : null;
    check('--batch: the chapter PDF goes up once through the Files API (resumable upload, the key in a header) and the drafts go as one batch job to the full Flash model — never the PDF inline',
      sa.log.uploads === 1 && sa.log.start['X-Goog-Upload-Protocol'] === 'resumable' && sa.log.start['x-goog-api-key'] === 'gk-batch-secret'
        && sa.log.submits.length === 1 && /models\/gemini-3\.8-flash:batchGenerateContent$/.test(sa.log.submits[0].url)
        && JSON.stringify(sa.log.submits[0].body).includes('"file_uri":"https://gen.example/files/f1"') && !JSON.stringify(sa.log.submits[0].body).includes('inline_data'),
      JSON.stringify({ up: sa.log.uploads, subs: sa.log.submits.map(x => x.url) }));
    const { buildRequest } = await import(pathToFileURL(path.join(root, 'api/syllabus.mjs')).href);
    const req0 = sa.log.submits[0].body.batch.input_config.requests.requests[0];
    check('…each request is exactly the live one (api/syllabus.mjs buildRequest: the same prompt, the band\'s rules, the strict schema), keyed by its chapter',
      req0.metadata.key === 'ch5' && /Write 4 lesson\(s\)/.test(JSON.stringify(req0.request.contents)) && /You write short practice lessons for Takhti/.test(req0.request.systemInstruction.parts[0].text)
        && !!req0.request.generationConfig.responseFormat && typeof buildRequest === 'function', JSON.stringify(req0.request).slice(0, 300));
    check('…when the job isn\'t done by --wait, the run says so and keeps its name in .batch.json (no chapter written, nothing lost)',
      first.length === 0 && state && state.drafts && /^batches\//.test(state.drafts.job) && !fs.existsSync(path.join(dir, 'ch5.json')) && said.some(x => /still running on Google's side.*Run the same command again later/.test(x)),
      JSON.stringify({ state, said }));
    const sa2 = { ...sa };
    const got = await lib.batchBook(dir, { env, pollMs: 0, waitMs: 60000, say: s => said.push(s) }, sa.fetch);
    const ch5 = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8')), raw = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.raw.json'), 'utf8'));
    check('…the same command again collects it — no second upload, no second draft job — checks every draft on the phone, sends the failures back as one repair job, and keeps what passed (4 of 4)',
      got.length === 1 && sa.log.uploads === 1 && sa.log.submits.length === 2 && /errors/.test(JSON.stringify(sa.log.submits[1].body)) && ch5.lessons.length === 4 && ch5.notUsed.length === 0,
      JSON.stringify({ subs: sa.log.submits.length, kept: ch5.lessons.length }));
    check('…the chapter\'s report says it came by batch and what it used, the upload is deleted afterwards, .batch.json is gone, and the key is in no file',
      raw.batch && /^batches\//.test(raw.batch.drafts) && raw.tried[0].outcome === 'batch' && raw.tried[0].tokens.in === 1000 && /gemini-3\.8-flash batch/.test(fs.readFileSync(path.join(dir, 'ch5.report.md'), 'utf8'))
        && sa.log.deletes.length === 1 && !fs.existsSync(path.join(dir, '.batch.json')) && fs.readdirSync(dir).every(f => !fs.readFileSync(path.join(dir, f)).toString().includes('gk-batch-secret')),
      JSON.stringify({ batch: raw.batch, tried: raw.tried, del: sa.log.deletes, files: fs.readdirSync(dir) }));
    // a rebuild that comes back weaker never replaces the chapter
    const sb = batchStand({ firsts, repairs: [] });
    const weaker = await lib.batchBook(dir, { env, pollMs: 0, force: true, say: s => said.push(s) }, sb.fetch);
    const still = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8')), cand = JSON.parse(fs.readFileSync(path.join(dir, 'ch5.candidate.json'), 'utf8'));
    check('a rebuild that keeps fewer lessons than the chapter already has never replaces it: the chapter stays as it was, the new build is saved beside it as a candidate, and the run says so',
      still.lessons.length === 4 && cand.lessons.length < 4 && weaker[0].candidate && fs.existsSync(path.join(dir, 'ch5.candidate.report.md')) && said.some(x => /fewer than the 4 already built.*--replace/.test(x)),
      JSON.stringify({ still: still.lessons.length, cand: cand.lessons.length, said: said.slice(-2) }));
    const sc = batchStand({ firsts, repairs: [] });
    await lib.batchBook(dir, { env, pollMs: 0, force: true, replace: true }, sc.fetch);
    check('…--replace takes it (and the candidate files go)', JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8')).lessons.length === cand.lessons.length && !fs.existsSync(path.join(dir, 'ch5.candidate.json')), '');
    // a request shape the API refuses → the older field names, as live
    const sd = batchStand({ firsts, repairs: fixes, badShape0: true });
    await lib.batchBook(dir, { env: { ...env, GEMINI_BATCH_MODEL: 'gemini-batch-test' }, pollMs: 0, force: true }, sd.fetch);
    check('…every request refused as a bad request (the field names) → the batch is sent again with the older ones, as a live draft does; GEMINI_BATCH_MODEL picks the model',
      sd.log.submits.length === 3 && !!sd.log.submits[1].body.batch.input_config.requests.requests[0].request.generationConfig.responseJsonSchema && /gemini-batch-test:batch/.test(sd.log.submits[0].url)
        && JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8')).lessons.length === 4, sd.log.submits.map(x => x.url).join(' | '));
    let nokey = '';
    try{ await lib.batchBook(dir, { env: { GEMINI_API_KEY: '' }, force: true }, async () => { throw new Error('called'); }); }catch(e){ nokey = e.message; }
    check('…no key → said plainly, nobody called', /no Gemini key/.test(nokey), nokey);
    // a reader holds every lesson to two questions; a maths book only its picture lessons
    const { phoneChecker } = await import(pathToFileURL(path.join(root, 'tools/try-syllabus.mjs')).href);
    const ph = phoneChecker(), cl = ph.cls('c3'), sk = ph.skills('c3');
    const READ1 = { title:{ en:"Meena's kite", hi:'मीना की पतंग' }, sub:{ en:'Read and answer', hi:'पढ़ो और जवाब दो' }, ic:'🪁', skill:'read5', source:'Lesson 6',
      aims:[{ short:{ en:'Find where', hi:'कहाँ, ढूँढो' }, point:{ en:'The child can find where something happens in a short story.', hi:'बच्चा छोटी कहानी में ढूँढ सकता है कि कुछ कहाँ होता है।' },
        forget:{ en:'I forgot where Meena flies her kite! How can I find out?', hi:'मैं भूल गई मीना पतंग कहाँ उड़ाती है! कैसे पता करूँ?' },
        hints:[{ en:'Where is the answer hiding — in your head, or somewhere you can look?', hi:'जवाब कहाँ छिपा है — दिमाग़ में, या कहीं जहाँ देख सकते हो?' }, { en:'Which part of it talks about a place?', hi:'कौन सा हिस्सा किसी जगह की बात करता है?' }],
        ideas:[{ en:'look back in the story for the sentence that says where', hi:'कहानी में वापस देखो, वह वाक्य जो जगह बताता है', words:['story','read again','look back','sentence','kahani','dekho','कहानी','पढ़','देखो','वाक्य'] }] }],
      beats:[ { t:'passage', art:'🪁', p:{ en:'Meena has a red kite. She flies it on the roof. The wind is strong today.', hi:'मीना के पास लाल पतंग है। वह छत पर उड़ाती है। आज हवा तेज़ है।' } },
        { t:'ask', q:{ en:'Where does Meena fly the kite?', hi:'मीना पतंग कहाँ उड़ाती है?' }, opts:['On the roof','In the park'], hiOpts:['छत पर','पार्क में'], correct:0 },
        { t:'win', say:{ en:'The answer was in the story.', hi:'जवाब कहानी में था।' } } ] };
    const asMaths = ph.clean(READ1, cl.band, sk, false, 2, false), asReader = ph.clean(READ1, cl.band, sk, false, 2, true);
    const READ2 = JSON.parse(JSON.stringify(READ1));
    READ2.beats.splice(2, 0, { t:'ask', q:{ en:'What colour is the kite?', hi:'पतंग किस रंग की है?' }, opts:['Blue','Red'], hiOpts:['नीली','लाल'], correct:1 });
    check('a reader\'s library (Santoor, Veena…) holds every lesson to two questions — a passage with one two-answer question is a coin toss too; in a maths book only picture lessons are held to it; two questions pass',
      asMaths.ok && !asReader.ok && asReader.errors.some(e => /^a lesson asks at least 2 questions/.test(e)) && ph.clean(READ2, cl.band, sk, false, 2, true).ok,
      JSON.stringify([asMaths.errors, asReader.errors, ph.clean(READ2, cl.band, sk, false, 2, true).errors]));
    // the library's questions don't all share one right answer — always-Yes is as weak as one question
    const YES = { ...JSON.parse(JSON.stringify(READ1)), beats:[READ1.beats[0],
      { t:'ask', q:{ en:'Is the kite red?', hi:'क्या पतंग लाल है?' }, opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:0 },
      { t:'ask', q:{ en:'Is the wind strong today?', hi:'क्या आज हवा तेज़ है?' }, opts:['No','Yes'], hiOpts:['नहीं','हाँ'], correct:1 }, READ1.beats[2]] };
    const MIXED = JSON.parse(JSON.stringify(YES)); MIXED.beats[2] = { t:'ask', q:{ en:'Is the kite blue?', hi:'क्या पतंग नीली है?' }, opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:1 };
    const yesLib = ph.clean(YES, cl.band, sk, false, 2, true, true), yesUp = ph.clean(YES, cl.band, sk, false, 0, false, false);
    const libSrc = fs.readFileSync(path.join(root, 'tools/build-library.mjs'), 'utf8'), promptSrc = fs.readFileSync(path.join(root, 'api/syllabus.mjs'), 'utf8');
    check('the library rejects a lesson whose every right answer is the same (always "Yes" passes them all), with why; mixed answers pass; a teacher\'s own upload keeps it, with the warning',
      !yesLib.ok && yesLib.errors.some(e => /every question's right answer is "yes"/.test(e)) && ph.clean(MIXED, cl.band, sk, false, 2, true, true).ok && yesUp.ok, JSON.stringify([yesLib.errors, yesUp.errors]));
    check('…the builder sets it on every draft, repair and re-check, live and batch; the prompt and the repair round say why',
      /const LIB_MIX_ANSWERS = true/.test(libSrc) && (libSrc.match(/mixRight: LIB_MIX_ANSWERS/g) || []).length === 3 && (libSrc.match(/minAllOf\(book\), LIB_MIX_ANSWERS\)/g) || []).length === 2
      && /MIX THE RIGHT ANSWERS/.test(promptSrc) && /every question's right answer is …/.test(promptSrc), '');
    // a book set up but not built isn't bundled
    const lt = path.join(tmp, 'lib');
    fs.mkdirSync(path.join(lt, 'ready-book'), { recursive: true }); fs.mkdirSync(path.join(lt, 'new-book')); fs.mkdirSync(path.join(lt, 'scanned-book'));
    fs.writeFileSync(path.join(lt, 'ready-book', 'book.json'), JSON.stringify({ id:'ready-book', title:{ en:'A', hi:'अ' }, cls:'c3', subject:'maths', chapters:[{ id:'ch1', n:1 }] }));
    fs.writeFileSync(path.join(lt, 'ready-book', 'ch1.json'), JSON.stringify({ id:'ch1', lessons:[], notUsed:[] }));
    fs.writeFileSync(path.join(lt, 'new-book', 'book.json'), JSON.stringify({ id:'new-book', title:{ en:'B', hi:'ब' }, cls:'c4', subject:'english', chapters:[] }));
    fs.writeFileSync(path.join(lt, 'scanned-book', 'book.json'), JSON.stringify({ id:'scanned-book', title:{ en:'C', hi:'स' }, cls:'c5', subject:'hindi', chapters:[{ id:'ch1', n:1, file:'x.pdf' }] }));
    const lb = lib.bundle(lt, path.join(tmp, 'lb.js')), lsrc = fs.readFileSync(path.join(tmp, 'lb.js'), 'utf8');
    check('a book set up but not built yet (no chapters listed, or none built) is left out of the bundle, so a teacher is never offered an empty book',
      lb.books === 1 && /ready-book/.test(lsrc) && !/new-book|scanned-book/.test(lsrc), lsrc.slice(-200));
    const books = fs.readdirSync(path.join(root, 'library')).filter(d => fs.existsSync(path.join(root, 'library', d, 'book.json')));
    const ok = books.every(d => { const b = JSON.parse(fs.readFileSync(path.join(root, 'library', d, 'book.json'), 'utf8')); return /^(maths|english|hindi|evs)$/.test(b.subject) && b.title.hi && /^c[1-5]$/.test(b.cls); });
    check('the NCERT books for Classes 1–5 are set up and waiting (maths, English and Hindi readers, EVS, each with its class and both titles), with library/BOOKS.md saying how to build one',
      books.length >= 16 && ok && fs.existsSync(path.join(root, 'library/BOOKS.md')) && /--batch/.test(fs.readFileSync(path.join(root, 'library/BOOKS.md'), 'utf8')), books.join());
    /* the first book beyond maths and language: Our Wondrous World (EVS, Class 5), chapter 3 —
       every lesson a passage read for comprehension (its right answers are in the passage),
       with at least two questions and the science in its Teach Munni aims; its drafts were
       written by Claude, not Gemini, and the report says so */
    const evs = JSON.parse(fs.readFileSync(path.join(root, 'library/ncert-our-wondrous-world-5/ch3.json'), 'utf8'));
    const evsRaw = JSON.parse(fs.readFileSync(path.join(root, 'library/ncert-our-wondrous-world-5/ch3.raw.json'), 'utf8'));
    const evsRep = fs.readFileSync(path.join(root, 'library/ncert-our-wondrous-world-5/ch3.report.md'), 'utf8');
    check('EVS, Class 5 (Our Wondrous World, ch. 3 "The Mystery of Food"): 5 reading lessons, each ≥ 2 questions and ≥ 1 aim, counted as the EVS skill v5-health (health and hygiene), not as reading; drafted by Claude and the report says so, not "Gemini model"',
      evs.lessons.length === 5 && !evs.notUsed.length && evs.lessons.every(l => l.subject === 'read' && l.skillId === 'v5-health' && l.aims.length >= 1 && l.beats.filter(x => x.t === 'ask').length >= 2 && l.beats.some(x => x.t === 'passage'))
        && /claude/i.test(evsRaw.model) && /drafted by \*\*claude/.test(evsRep) && !/Gemini model \*\*claude/.test(evsRep),
      JSON.stringify(evs.lessons.map(l => [l.title.en, l.subject, l.skillId, l.aims.length])));
    check('….batch.json is never committed (.gitignore)', /library\/\*\*\/\.batch\.json/.test(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')), '');
    fs.rmSync(tmp, { recursive: true });
  }catch(e){ check('the batch builder ran', false, e.stack); }

  /* ---------- 2. the teacher's side, through real taps ---------- */
  const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
  const appServer = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]);
    const full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => appServer.listen(0, '127.0.0.1', r));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const vc = new VirtualConsole(), jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  let fetches = 0;
  const dom = new JSDOM(html, { virtualConsole: vc, url: `http://127.0.0.1:${appServer.address().port}/index.html`, runScripts:'dangerously', resources:'usable', pretendToBeVisual: true,
    beforeParse(win){
      win.SpeechSynthesisUtterance = function(t){ this.text = t; };
      win.speechSynthesis = { getVoices: () => [], cancel: () => {}, addEventListener: () => {}, speak: u => setTimeout(() => u.onend && u.onend(), 0) };
      win.navigator.vibrate = () => {};
      win.HTMLMediaElement.prototype.play = function(){ setTimeout(() => this.onended && this.onended(), 0); return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function(){};
      win.fetch = () => { fetches++; return Promise.reject(new Error('offline')); };
    } });
  const win = dom.window, E = c => win.eval(c), screen = () => win.document.querySelector('#screen').textContent;
  const btn = re => [...win.document.querySelectorAll('button')].find(b => re.test(b.textContent));
  try{
    await new Promise(r => win.addEventListener('load', r));
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    [...win.document.querySelectorAll('.ob-av')][0].click(); [...win.document.querySelectorAll('.ob-cakebtn')][5].click(); win.document.querySelector('.ob-go').click();
    E(`S.game = S.game || 'cricket'; S.name = 'Asha'; S.age = 8; S.classCode = 'CLS003'; setOnline(false); go('map')`);
    // the flow is tested on one chapter, whatever else the real library holds by now
    /* an EVS book offers its EVS skills first (so its lessons count as EVS); every other
       book leaves EVS out; and the shipped EVS chapter checks out again on a teacher's
       phone, offline — all 5 lessons offered, none "changed after it was built" */
    const evsSk = E(`JSON.stringify([sylSkills(sylClass('c5'), 'evs').slice(0, 3).map(s => s.id), sylSkills(sylClass('c5')).some(s => /^v\\d/.test(s.id))])`);
    const evsOffer = E(`(() => { const b = LIBRARY.books.find(x => x.id === 'ncert-our-wondrous-world-5'); const d = libDrafts(b, b.chapters.find(c => c.id === 'ch3')).drafts; return JSON.stringify([d.length, d.filter(x => x.ok).length, d.every(x => x.lesson.skillId === 'v5-health')]); })()`);
    check('an EVS book offers EVS skills first (v5-health among them) and a maths or language book none; the EVS chapter\'s 5 lessons are all offered to a Class 5 teacher, offline, each counting for v5-health',
      JSON.parse(evsSk)[0].every(id => /^v\d/.test(id)) && JSON.parse(evsSk)[0].includes('v5-health') && JSON.parse(evsSk)[1] === false && evsOffer === '[5,5,true]', evsSk + ' ' + evsOffer);
    E(`LIBRARY.books[0].chapters = LIBRARY.books[0].chapters.filter(c => c.id === 'ch5')`);
    fetches = 0;
    E(`S.ctx.tcode = 'CLS003'; S.ctx.sylCls = 'c2'; go('teacher')`);
    await wait(20);
    check('the teacher view says when the library has no book for the class yet (Class 2), and offers drafting from a chapter',
      /No book for Class 2 in Takhti's library yet/.test(screen()) && /DRAFT FROM A CHAPTER/.test(screen()), screen().slice(0, 300));
    E(`S.ctx.sylCls = 'c3'; render()`);
    const sel = [...win.document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'ncert-maths-mela-3'));
    check('for Class 3 it offers the library\'s books — Maths Mela, NCERT', !!sel && /FROM THE LIBRARY/.test(screen()) && /Maths Mela · NCERT/.test(sel.textContent), screen().slice(0, 400));
    sel.value = 'ncert-maths-mela-3'; sel.dispatchEvent(new win.Event('change'));
    await wait(10);
    check('choosing the school\'s book lays out its term, this week\'s chapter marked, with its ready lessons — kept on this phone as the teacher\'s own setting',
      /★ 5\. Fun with Shapes/.test(screen()) && /This week · 4 lessons ready/.test(screen()) && E(`S.libPlan.CLS003.book`) === 'ncert-maths-mela-3'
        && /"libPlan":\{"CLS003"/.test(Object.keys(win.localStorage).map(k => win.localStorage.getItem(k)).join(' ')), screen().slice(0, 500));
    btn(/Open this week's lessons/).click();
    await wait(10);
    const approve = [...win.document.querySelectorAll('button')].filter(b => /^Approve these aims$/.test(b.textContent.trim()));
    check('"Open this week\'s lessons" shows the chapter\'s lessons in the approval card — every one checked again on this phone, the aims first — with no network at all',
      approve.length === 4 && /📗 4 lesson\(s\) from "Fun with Shapes" · 4 passed the check/.test(screen()) && /AIMS — THE CHILD WILL BE ABLE TO/.test(screen()) && fetches === 0,
      `${approve.length} · fetches ${fetches} · ` + screen().slice(0, 300));
    const minis = [...win.document.querySelectorAll('.lesart.tmini')];
    check('…and reading a lesson there shows the pictures the child will see (drawn shapes), not only their codes',
      minis.length >= 4 && minis.every(m => m.querySelector('svg')) && minis.every(m => m.closest('details')), `${minis.length} pictures`);
    btn(/Approve all the checked lessons' aims/).click();
    await wait(10);
    check('approving puts them in the class like any approved lesson (and so into the class sync)', E(`sylApproved('CLS003').length`) === 4 && /APPROVED FOR THE CLASS/.test(screen()), E(`sylApproved('CLS003').length`));
    E(`go('lessons')`);
    await wait(20);
    check('the child sees them at the Story Fire — "From your school", each with their own path', /from your school/i.test(screen()) && /Square Corners/.test(screen()) && win.document.querySelectorAll('.planstep').length > 0, screen().slice(0, 300));
    // the term's order: a second chapter (not built yet) joins at the end; moving it, choosing it as this week
    E(`LIBRARY.books[0].chapters.push({ id:'ch6', n:6, title:{ en:'House of Hundreds', hi:'सैकड़ों का घर' }, built:null, lessons:[] }); S.ctx.tcode = 'CLS003'; go('teacher')`);
    await wait(10);
    check('a chapter added to the book later joins the term at the end, shown as not built yet', /6\. House of Hundreds/.test(screen()) && /not built yet/.test(screen()) && E(`libPlan('CLS003').order.join()`) === 'ch5,ch6', E(`libPlan('CLS003').order.join()`));
    E(`libUp('ch6')`);
    check('↑ moves a chapter earlier to match the school\'s calendar (this week stays where it was)', E(`libPlan('CLS003').order.join()`) === 'ch6,ch5' && E(`libPlan('CLS003').week`) === 'ch5', E(`JSON.stringify(libPlan('CLS003'))`));
    E(`libWeek('ch6')`);
    check('choosing a chapter not built yet as this week says so, and points to drafting it from its PDF', /isn't built in the library yet/.test(screen()) && !btn(/Open this week's lessons/), screen().slice(0, 500));
    E(`libNext()`);
    check('"Next chapter for next week" moves on in the term\'s order', E(`libPlan('CLS003').week`) === 'ch5', E(`libPlan('CLS003').week`));
    // nothing in the library is trusted
    E(`LIBRARY.books[0].chapters[0].lessons[1].beats[0].say.en = 'Changed after it was built.'; libOpen()`);
    await wait(10);
    check('a library lesson edited after it was built gets a different id on this phone, so it is shown as not used — never offered',
      E(`S.ctx.sylRes.drafts.filter(d => !d.ok).length`) === 1 && /changed after it was built/.test(screen()), E(`JSON.stringify(S.ctx.sylRes.drafts.map(d => [d.ok, (d.errors || [])[0]]))`));
    E(`S.lang = 'hi'; render()`);
    check('…all of it in Hindi too', /लाइब्रेरी से/.test(screen()) && /सत्र का क्रम/.test(screen()) && /आकृतियों के साथ मज़ा/.test(screen()), screen().slice(0, 400));
    check('no network was used for any of it', fetches === 0, fetches);
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  appServer.close();
  win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
