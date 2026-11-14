/* The demo class (core/demo.js): two plainly-labelled demo children whose
   records differ, so one approved lesson shows two paths — through real taps. */
const fs = require('fs'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
let passes = 0, failures = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]), full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const vc = new VirtualConsole(), jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  let fetches = 0;
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { virtualConsole: vc, url: `http://127.0.0.1:${srv.address().port}/index.html`, runScripts:'dangerously', resources:'usable', pretendToBeVisual: true,
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
    E(`S.game = S.game || 'cricket'; S.name = 'Riya'; S.age = 8; S.classCode = 'DEMO01'; go('map'); S.ctx.tcode = 'DEMO01'; S.ctx.sylCls = 'c3'; go('teacher')`);
    await wait(20);
    check('the teacher view offers the demo class, and says plainly what it is (not real children, never synced)',
      /DEMO CLASS/.test(screen()) && /aren't real children, are never synced/.test(screen()) && !!btn(/Add two demo children/), screen().slice(-500));
    btn(/Add two demo children/).click();
    await wait(20);
    const kids = JSON.parse(E(`JSON.stringify(S.profiles.filter(p => p.demo).map(p => ({ name: p.name, age: p.age, code: p.classCode, sync: p.syncOn, avatar: p.avatar })))`));
    check('two demo children join the class, plainly named "(demo)", flagged, ready to play, with sync off',
      kids.length === 2 && kids.every(k => /\(demo\)$/.test(k.name) && k.age === 8 && k.code === 'DEMO01' && k.sync === false && k.avatar) && E(`S.profiles.length`) === 3 && E(`S.name`) === 'Riya', JSON.stringify(kids));
    check('their records were written by the mind\'s own rounds: pictures stick for Asha on shapes, the story for Kabir',
      E(`(() => { const [a, k] = S.profiles.filter(p => p.demo); return [a.mind.arms.shapes2d.show.a, a.mind.arms.shapes2d.story.b, k.mind.arms.shapes2d.story.a, k.mind.arms.shapes2d.show.b].join(); })()`) === '6,5,6,5', E(`JSON.stringify(S.profiles.filter(p => p.demo)[0].mind.arms.shapes2d)`));
    check('Kabir has a real habit in the twin — the smaller digit from the bigger, twice, on two different sums — and Asha has none',
      E(`(twinHabit('borrow', S.profiles.filter(p => p.demo)[1]) || {}).id`) === 'smallbig' && E(`twinHabit('borrow', S.profiles.filter(p => p.demo)[0])`) === null, E(`JSON.stringify(twinHabit('borrow', S.profiles.filter(p => p.demo)[1]))`));
    // the library's chapter → approved → two paths
    E(`LIBRARY.books[0].chapters = LIBRARY.books[0].chapters.filter(c => c.id === 'ch5'); S.ctx.sylCls = 'c3'; render()`);
    const sel = [...win.document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'ncert-maths-mela-3'));
    sel.value = 'ncert-maths-mela-3'; sel.dispatchEvent(new win.Event('change')); await wait(10);
    btn(/Open this week's lessons/).click(); await wait(10);
    btn(/Approve all the checked lessons' aims/).click(); await wait(20);
    const paths = JSON.parse(E(`JSON.stringify(S.profiles.filter(p => p.demo).map(p => { const l = schoolLessons(p).find(x => mindDomain(x.skillId) === 'shape'); return planFor(l, p).steps.map(s => s.k); }))`));
    check('the same approved lesson gives the two children two different paths: pictures first for Asha, straight into the school\'s lesson for Kabir',
      paths[0][0] === 'show' && paths[1][0] === 'school' && paths[0].length === paths[1].length + 1, JSON.stringify(paths));
    const rows = [...win.document.querySelectorAll('.planrow')].map(x => x.textContent);
    check('…and the teacher\'s card shows who is on which path', rows.some(r => /Pictures first: .*Asha \(demo\)/.test(r)) && rows.some(r => /Straight into the school’s lesson: .*Kabir \(demo\)/.test(r)), JSON.stringify(rows.slice(0, 6)));
    E(`switchProfile(S.profiles.findIndex(p => p.demo))`); await wait(20);
    E(`go('lessons')`); await wait(20);
    check('switching to Asha goes straight to the map (no onboarding), and her Story Fire shows "Pictures first"', E(`S.name`) === 'Asha (demo)' && /Pictures first/.test(screen()) && /this has worked for you on this topic/.test(screen()), screen().replace(/\s+/g, ' ').slice(0, 700));
    E(`switchProfile(S.profiles.findIndex(p => p.name === 'Kabir (demo)'))`); await wait(20);
    E(`go('lessons')`); await wait(20);
    check('…and Kabir\'s shows no pictures step', E(`S.name`) === 'Kabir (demo)' && !/Pictures first/.test(screen()) && /school/i.test(screen()), screen().slice(0, 300));
    // The book's subtraction lessons are tagged sub2, whose sums never borrow; Kabir's habit
    // is on borrowing — Munni's sum must still be his own mistake, and Asha's the usual one.
    const fixOn = who => JSON.parse(E(`(() => { const i = S.profiles.findIndex(p => p.name === '${who}'); if(S.activeProfile !== i) switchProfile(i);
      const les = { id: 'sch-sub2demo', school: true, skillId: 'sub2', title: { en: 'Taking away', hi: 'घटाना' },
        aims: [{ id: 'a1', point: { en: 'can take away', hi: 'घटा सकते हैं' } }] };
      const u = teachUnitFor(les), f = u.aims.find(a => a.kind === 'fix'), s = teachBegin(u);
      const it = s && s.items.find(x => x.fix); return JSON.stringify({ skill: f && f.skill, m: it && it.fix.mistake, habit: it && it.fix.habit }); })()`));
    const kf = fixOn('Kabir (demo)'), af = fixOn('Asha (demo)');
    check('on the book\'s two-digit taking-away lesson (sub2, no borrowing), Munni acts out Kabir\'s own borrowing habit — and Asha gets the usual mistake',
      kf.skill === 'borrow' && kf.m === 'smallbig' && kf.habit === true && af.skill === 'sub2' && af.m !== 'smallbig' && !af.habit, JSON.stringify([kf, af]));
    E(`switchProfile(S.profiles.findIndex(p => p.name === 'Kabir (demo)'))`); await wait(20);
    const loops = JSON.parse(E(`JSON.stringify(S.profiles.filter(p => p.demo).map(p => p.teach && p.teach.loop))`));
    check('both have taught Munni borrowing through Teach Munni\'s own session: Asha gap → re-taught → explained, Kabir re-taught and still to be asked',
      loops[0]['borrow.ten'] === 'grc' && loops[0]['borrow.when'] === 'c' && loops[1]['borrow.when'] === 'gr' && loops[1]['borrow.ten'] === 'c', JSON.stringify(loops));
    E(`S.ctx.tcode = 'DEMO01'; go('teacher'); S.ctx.tcode = 'DEMO01'; render()`); await wait(20);
    check('…so the teacher\'s card shows the loop at once: explained after re-teaching (Asha), re-taught and to ask again (Kabir)',
      /explained after Munni taught them again/.test(screen()) && /explained after re-teaching: Asha \(demo\)/.test(screen()) && /re-taught, to ask again: Kabir \(demo\)/.test(screen()), screen().slice(screen().indexOf('WHAT THE CLASS'), screen().indexOf('WHAT THE CLASS') + 700));
    check('the class sync would send neither demo child (sync is off for both)', E(`typeof syncBody === 'function' ? Object.keys((syncBody('DEMO01') || {}).children || {}).length : S.profiles.filter(p => p.demo && p.syncOn).length`) === 0, '');
    E(`S.ctx.tcode = 'DEMO01'; S.lang = 'hi'; go('teacher')`); await wait(20);
    check('the demo card is in Hindi too, and now offers to remove them', /डेमो कक्षा/.test(screen()) && !!btn(/डेमो बच्चे हटाएँ/), screen().slice(-400));
    btn(/डेमो बच्चे हटाएँ/).click(); await wait(20);
    check('removing deletes exactly the demo children — from the phone and this phone\'s class mirror — and the real child is the active one again',
      E(`S.profiles.length`) === 1 && E(`S.name`) === 'Riya' && E(`Object.values(readClassShared('DEMO01')).filter(c => c && /demo/.test(c.childName || '')).length`) === 0, E(`JSON.stringify([S.profiles.map(p => p.name), S.name])`));
    E(`S.lang = 'en'; for(let i = 0; i < 2; i++) S.profiles.push(newProfile('Kid' + i)); render()`);
    check('with no room for two more children it says so instead of adding one', /needs two free places/.test(screen()) && !btn(/Add two demo children/), screen().slice(-300));
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  srv.close(); win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
