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
  const firsts = run7.drafts.map(d => d.raw), fixes = run7.drafts.filter(d => !d.first.ok).map(d => d.repairRaw);

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
    await lib.buildBook(dir, { import: { ch: 'ch5', file: path.join(root, 'library/ncert-maths-mela-3/ch5.raw.json') } });
    check('--recheck checks the saved drafts again and --import turns a try-syllabus run into a chapter — neither calls Gemini',
      calls === c0 && re.length === 1 && JSON.parse(fs.readFileSync(path.join(dir, 'ch5.json'), 'utf8')).lessons.length === 4, calls - c0);
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
