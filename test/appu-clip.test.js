/* ==================================================================
   APPU'S CLIP — a cartoon of Appu making the child's mistake, inside
   Teach Appu (video/appu-clips.json, ui/teach-munni.js).

   1. The engine: teachFixAt() puts Appu's mistake on a sum chosen in
      advance (the clip's), with the same guarantees as his own sums —
      a real wrong answer, the right one among three, his working never
      saying it — and refuses a sum that can't carry the mistake.
   2. The list: valid JSON, every clip's file on disk, small enough for a
      phone, its sum carrying its mistake, its pause inside the clip.
   3. The app, through the real index.html and the demo class:
      · Kabir (demo): his habit (smallbig) has a clip made for him — his
        sum becomes 52 − 27, the clip plays when Appu reaches that point,
        stops at its pause, the options appear, the right tap is the same
        evidence as ever and the clip carries on; the mic waits until it
        ends.
      · Asha (demo): the usual mistake (noborrowback) has hers — a wrong
        tap keeps the clip stopped with Appu's nudge, never "wrong".
      · A child the clip wasn't made for gets no clip and a sum of
        Appu's own; a clip that can't play leaves the slate and his voice.
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const { installVoice } = require('./_helpers/voice-stub');
const root = path.resolve(__dirname, '..');
let passes = 0, failures = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 700)}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    const clean = decodeURIComponent(req.url.split('?')[0]), full = path.join(root, clean === '/' ? 'index.html' : clean);
    fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; return res.end(); } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const vc = new VirtualConsole(), jsErrors = [], spoken = [], fetched = [];
  vc.on('jsdomError', e => { if(!/Not implemented|Could not load link/.test(e.message)) jsErrors.push(e.message); });
  const list = fs.readFileSync(path.join(root, 'video/appu-clips.json'), 'utf8');
  let failPlay = false;
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { virtualConsole: vc, url: `http://127.0.0.1:${srv.address().port}/index.html`, runScripts:'dangerously', resources:'usable', pretendToBeVisual: true,
    beforeParse(win){
      win.navigator.vibrate = () => {};
      // a clip plays until the test moves its clock (no ended event of its own)
      win.HTMLMediaElement.prototype.play = function(){ this._playing = true; if(failPlay && this.id === 'appuclip') setTimeout(() => this.onerror && this.onerror(), 0); return Promise.resolve(); };
      win.HTMLMediaElement.prototype.pause = function(){ this._playing = false; };
      win.fetch = url => { fetched.push(String(url));
        return String(url) === 'video/appu-clips.json' ? Promise.resolve({ ok: true, json: async () => JSON.parse(list) }) : Promise.reject(new Error('offline')); };
      installVoice(win, spoken);   // Munni's voice stood in: what she says lands in `spoken`
    } });
  const win = dom.window, E = c => win.eval(c), $ = s => win.document.querySelector(s), $$ = s => [...win.document.querySelectorAll(s)];
  const screen = () => $('#screen').textContent;
  const btn = re => $$('button').find(b => re.test(b.textContent));
  const clipEl = () => win.document.getElementById('appuclip');
  const clock = t => { const el = clipEl(); Object.defineProperty(el, 'currentTime', { value: t, configurable: true, writable: true }); el.ontimeupdate && el.ontimeupdate(); };
  const settle = async () => { for(let i = 0; i < 50 && !E(`!!(TEACH && TEACH.s && (TEACH.clip || spokenOnce()))`); i++) await wait(20); };
  try{
    /* ================= 1. the engine ================= */
    await new Promise(r => win.addEventListener('load', r));
    E(`window.spokenOnce = () => false`);
    const k = JSON.parse(E(`JSON.stringify(teachFixAt('borrow', 52, 27, 'smallbig'))`));
    check('teachFixAt: Kabir\'s mistake on 52 − 27 — Appu says 35, the right 25 is one of three answers, and his working never says 25',
      k.text === '52 − 27' && k.wrong === 35 && k.ans === 25 && k.opts.includes(25) && k.opts[k.correct] === 25 && new Set(k.opts).size === 3
        && ![k.act.en, k.act.hi].some(s => (s.match(/\d+/g) || []).includes('25')), JSON.stringify(k));
    const a = JSON.parse(E(`JSON.stringify(teachFixAt('borrow', 61, 24, 'noborrowback'))`));
    check('…Asha\'s on 61 − 24 — Appu borrows but keeps six tens and says 47; the right 37 is among the answers', a.wrong === 47 && a.ans === 37 && a.opts[a.correct] === 37, JSON.stringify(a));
    check('…a sum that can\'t carry the mistake, a mistake Appu doesn\'t act, a negative answer or a one-digit sum: no fix (the clip is then ignored)',
      E(`teachFixAt('borrow', 58, 27, 'smallbig') === null && teachFixAt('borrow', 52, 27, 'nosuch') === null && teachFixAt('borrow', 27, 52, 'smallbig') === null && teachFixAt('borrow', 5, 2, 'smallbig') === null`), '');
    check('the refactor left Appu\'s own sums exactly as they were (same seed → same sum, mistake and order)',
      E(`S.age = 8, [1, 2, 3, 77].every(n => { const f = teachFixFor('borrow', n); return f && JSON.stringify(f) === JSON.stringify(teachFixFor('borrow', n)) && f.opts[f.correct] === f.ans; })`), '');

    /* ================= 2. the list ================= */
    const L = JSON.parse(list).clips, all = Object.entries(L).flatMap(([id, xs]) => xs.map(x => ({ id, ...x })));
    check('video/appu-clips.json: every clip is a file in video/, under 25 MB, with a sum that carries its mistake',
      all.length === 2 && all.every(c => /^video\/[\w.-]+\.mp4$/.test(c.src) && fs.existsSync(path.join(root, c.src)) && fs.statSync(path.join(root, c.src)).size < 25e6
        && E(`!!teachFixAt('borrow', ${c.a}, ${c.b}, '${c.id}')`)), JSON.stringify(all));
    let probe = null; try{ probe = cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(root, all[0].src)]).toString(); }catch(e){}
    if(probe) check('…each pause falls inside its clip', all.every(c => c.pause < Number(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(root, c.src)]).toString())), '');
    check('nothing is fetched at boot', !fetched.includes('video/appu-clips.json'), JSON.stringify(fetched));
    E(`S.age = null`);

    /* ================= 3. the app ================= */
    E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
    $$('.ob-av')[0].click(); $$('.ob-cakebtn')[5].click(); $('.ob-go').click();
    E(`S.game = S.game || 'cricket'; S.name = 'Riya'; S.age = 8; S.classCode = 'DEMO01'; go('map');
      CLASS_AUTH.token='test-approved-session'; CLASS_AUTH.expires=Date.now()+600000; CLASS_AUTH.role='teacher'; CLASS_AUTH.classes=['DEMO01']; CLASS_AUTH.email='teacher@example.test';
      S.ctx.tcode = 'DEMO01'; go('teacher')`);
    await wait(20);
    btn(/Add two demo children/).click(); await wait(20);
    // a borrowing unit: one point to explain, then Appu's sum
    const startOn = async (who, aims) => {
      E(`switchProfile(S.profiles.findIndex(p => p.name === '${who}'))`); await wait(20);
      E(`(() => { const u = teachUnitBuiltin('borrow'); u.aims = u.aims.filter(a => ${JSON.stringify(aims)}.includes(a.kind === 'fix' ? 'fix' : a.id)); teachStart(u); })()`);
      for(let i = 0; i < 50 && !E(`!!(TEACH && TEACH.s.line && document.querySelector('.teachchips'))`); i++) await wait(20);
      await wait(30);
    };

    // ---- Kabir: explain first, then Appu's sum on video ----
    spoken.length = 0;
    await startOn('Kabir (demo)', ['borrow.when', 'fix']);
    const kf = JSON.parse(E(`JSON.stringify(TEACH.s.items.find(x => x.fix).fix)`));
    check('Kabir: Appu\'s sum becomes the clip\'s — 52 − 27, his own habit (smallbig), Appu says 35', kf.text === '52 − 27' && kf.mistake === 'smallbig' && kf.habit === true && kf.wrong === 35, JSON.stringify(kf));
    check('…the first point is an explanation, so no clip yet: Appu asks it aloud as always', !clipEl() && spoken.some(t => /Elephants never forget/.test(t)), JSON.stringify(spoken.slice(-2)));
    if(!$('#teachtxt')) $('.teachtype').click();
    $('#teachtxt').value = 'you have to borrow a ten from the five';
    btn(/^\s*Tell\s*$/).click();
    for(let i = 0; i < 40 && !clipEl(); i++) await wait(20);
    check('…explained → Appu reaches his sum and the clip plays it (made for Kabir, in Hindi), with no options yet and nothing said over it',
      !!clipEl() && /appu-smallbig-kabir-hi\.mp4$/.test(clipEl().src) && clipEl()._playing && $$('.opts .opt').length === 0 && /Watch Appu try it/.test(screen()) && !!$('#appuslot video'),
      screen().slice(0, 300));
    clock(10);
    check('…before its pause the clip keeps playing', clipEl()._playing && $$('.opts .opt').length === 0, '');
    clock(24.8);
    check('…at the pause (his "is that right?") it stops: the slate 52 − 27 = 35 ? and three answers to tap',
      !clipEl()._playing && $$('.opts .opt').length === 3 && /52 − 27 = 35 \?/.test($('.teachslate').textContent) && !!$('#appuslot video'), screen().slice(0, 300));
    const before = E(`(S.skillHistory.borrow || {}).n || 0`);
    $$('.opts .opt')[kf.correct].click(); await wait(20);
    check('…the right tap: counted as an answer to a sum like any other, and the clip carries on with the fix (the mic waits)',
      E(`S.skillHistory.borrow.n`) === before + 1 && clipEl()._playing && !btn(/Tap and explain/) && /Watch, then tell him/.test(screen()), screen().slice(0, 300));
    E(`teachMic()`);
    check('…the mic can\'t open while the clip is still talking', !E(`TEACH.busy`), '');
    clipEl().onended();
    await wait(10);
    check('…the clip ends on its question: the mic opens, Appu\'s "teach me" under the clip\'s last frame',
      !!btn(/Tap and explain/) && /Where did I slip/.test($('.teachclipq').textContent) && !!$('#appuslot video'), screen().slice(0, 300));
    if(!$('#teachtxt')) $('.teachtype').click();
    $('#teachtxt').value = 'when the top is smaller you must borrow a ten';
    btn(/^\s*Tell\s*$/).click();
    for(let i = 0; i < 40 && !E(`!!(TEACH && TEACH.sum)`); i++) await wait(20);
    check('…explained: both points taught, the clip gone from the summary', E(`TEACH.sum.covered`) === 2 && !$('#appuslot'), screen().slice(0, 300));
    btn(/Done/).click(); await wait(10);
    check('…leaving stops the clip', E(`APPU_EL`) === null && E(`S.screen`) === 'lessons', '');

    // ---- Asha: Appu's sum first, a wrong tap, then the right one ----
    spoken.length = 0;
    await startOn('Asha (demo)', ['fix']);
    const af = JSON.parse(E(`JSON.stringify(teachItem(TEACH.s).fix)`));
    check('Asha: the usual mistake (noborrowback) on the clip\'s 61 − 24, the clip in English playing at once, nothing said over it',
      af.text === '61 − 24' && af.mistake === 'noborrowback' && !!clipEl() && /appu-noborrowback-asha-en\.mp4$/.test(clipEl().src) && !spoken.some(t => /61 take away 24/.test(t)), JSON.stringify([af.text, af.mistake, spoken]));
    check('…whichever mistake the day\'s sum gave Appu (here his smallbig on 52 − 43), Asha\'s clip wins: he makes her mistake on her clip\'s sum',
      E(`(() => { const u = teachUnitBuiltin('borrow'); u.aims = u.aims.filter(a => a.kind === 'fix'); const s = teachBegin(u); s.items[0].fix = teachFixAt('borrow', 52, 43, 'smallbig'); teachClipBind(s); return s.items[0].fix.mistake + ' ' + s.items[0].fix.text; })()`) === 'noborrowback 61 − 24', '');
    clock(30.1);
    const wrongK = af.opts.findIndex(v => v === 47);
    $$('.opts .opt')[wrongK].click(); await wait(20);
    check('…a wrong tap: the clip stays stopped, Appu nudges kindly (5 tens left, not 6), never "wrong"',
      !clipEl()._playing && $$('.opts .opt').length === 3 && /5 tens left now, not 6/.test($('.teachclipq').textContent) && !/\bwrong\b/i.test(screen()) && spoken.some(t => /5 tens left/.test(t)),
      screen().slice(0, 400));
    $$('.opts .opt')[af.correct].click(); await wait(20);
    check('…then the right one: the clip carries on', clipEl()._playing && /Watch, then tell him/.test(screen()), '');
    E(`teachLeave()`);

    // ---- a child the clips weren't made for ----
    await startOn('Riya', ['fix']);
    const rf = JSON.parse(E(`JSON.stringify(teachItem(TEACH.s).fix)`));
    check('Riya (a real child): no clip — Appu\'s own sum on the slate and his voice, as before',
      !clipEl() && !$('#appuslot') && rf.text !== '61 − 24' && $$('.opts .opt').length === 3 && !!$('.teachmunni'), JSON.stringify(rf.text));
    E(`teachLeave()`);

    // ---- a clip that can't play ----
    failPlay = true; spoken.length = 0;
    await startOn('Asha (demo)', ['fix']);
    for(let i = 0; i < 20 && $('#appuslot'); i++) await wait(20);
    check('a clip that can\'t play: the slate (still its sum) and Appu\'s voice carry on, the answers ready',
      !$('#appuslot') && /61 − 24 = 47 \?/.test($('.teachslate').textContent) && $$('.opts .opt').length === 3 && spoken.some(t => /61 take away 24/.test(t)), screen().slice(0, 300));
    E(`teachLeave()`); failPlay = false;

    E(`S.lang = 'hi'`);
    await startOn('Kabir (demo)', ['fix']);
    check('in Hindi: the clip plays and the screen says so in Hindi', !!clipEl() && /अप्पू ख़ुद सवाल कर रहा है/.test(screen()), screen().slice(0, 200));
    E(`teachLeave(); S.lang = 'en'`);
    check('no uncaught script errors', jsErrors.length === 0, jsErrors.join(' | '));
  }catch(e){ check('the app run finished', false, e.stack); }
  srv.close(); win.close();
  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
