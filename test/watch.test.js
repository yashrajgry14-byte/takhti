/* ==================================================================
   MUNNI'S VIDEOS — five teaching videos that stop and ask (21 Nov 2026).

   Two parts:
     · content (vm): every video in both languages, two pauses each with
       two different answers and the right one really right (the sum, the
       difference, the bundles of ten, the clock's hour, the मात्रा), real
       skills, the classes they're for
     · the app (index.html in jsdom), through real taps: the Picture Hut's
       shelf for the child's class, UKG's home card, the animated form
       played start to end (pauses wait, the first tap is evidence, a wrong
       tap is shown kindly, the end screen waits, a star once), the filmed
       form (stops at the listed seconds, the same <video> carries on after
       the question, a broken clip carries on animated from the same
       question, a badly listed clip is ignored), and nothing fetched at boot
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { installVoice } = require('./_helpers/voice-stub');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }
const root = path.resolve(__dirname, '..');

/* ---------------- content ---------------- */
{
  const c = { console }; vm.createContext(c);
  for(const f of ['src/content/skills.js', 'src/content/curriculum-early.js', 'src/content/videos.js'])
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c);
  vm.runInContext('this.X = VIDEOS; this.P = videoPauses; this.F = videosFor; this.SK = SKILLS;', c);
  const isHi = s => /[ऀ-ॿ]/.test(s), bare = s => /^[\d\s.+×−=·]+$/.test(s);
  const faults = [];
  const skillIds = new Set(c.SK.map(s => s.id).concat(['time2']));
  for(const v of c.X){
    const lines = [v.title, v.grownup, v.home].concat(...v.scenes.map(s => [s.say].concat(s.pause ? [s.pause.q, s.pause.praise, s.pause.show] : [])));
    lines.forEach(l => { if(!l.en || !l.hi || (!isHi(l.hi) && !bare(l.hi))) faults.push(`${v.id}: "${l.en}" has no Hindi`); });
    if(!skillIds.has(v.skill)) faults.push(`${v.id}: no skill ${v.skill}`);
    const ps = c.P(v);
    if(ps.length !== 2) faults.push(`${v.id}: ${ps.length} pauses`);
    ps.forEach((p, i) => {
      if(p.opts.length !== 2 || ![0, 1].includes(p.right) || p.opts[0].en === p.opts[1].en || p.opts[0].hi === p.opts[1].hi) faults.push(`${v.id} pause ${i}: two different answers and a right one`);
      if(/wrong|ग़लत|गलत/i.test(p.praise.en + p.show.en + p.praise.hi + p.show.hi)) faults.push(`${v.id}: says "wrong"`);
    });
    // the right answer is really right, read off the scene it stops on
    v.scenes.forEach((s, k) => {
      if(!s.pause) return;
      const right = s.pause.opts[s.pause.right].en, other = s.pause.opts[1 - s.pause.right].en;
      const col = v.scenes.slice(0, k + 1).reverse().map(x => x.art).find(a => a && a.t === 'column');
      if(/is…\?$/.test(s.pause.q.en) && col){ const want = col.op === '+' ? col.a + col.b : col.a - col.b; if(Number(right) !== want || Number(other) === want) faults.push(`${v.id}: ${col.a} ${col.op} ${col.b} isn't ${right}`); }
      if(s.art && s.art.t === 'group' && s.art.ask === 'tens' && Number(right) !== Math.floor(s.art.a / 10)) faults.push(`${v.id}: ${s.art.a} doesn't have ${right} tens`);
      if(s.art && s.art.t === 'clock' && !right.startsWith(String(s.art.h) + ' ')) faults.push(`${v.id}: the clock says ${s.art.h}, not ${right}`);
      if(/five tens and two ones/.test(s.pause.q.en) && right !== '52') faults.push('v-tens: 5 tens and 2 ones is 52');
      if(v.id === 'v-matra' && !s.pause.q.en.includes(right)) faults.push(`v-matra: the right sign isn't the one asked for (${right})`);
    });
  }
  check(`five videos, every line in Hindi and English, two pauses each with two different answers and the right one really right (${c.X.length} videos)`,
    c.X.length === 5 && faults.length === 0, faults.slice(0, 6).join(' | '));
  check('each class gets the videos for its own hardest topics (UKG the मात्रा; Class 2 tens, carrying, borrowing, the clock)',
    c.F('ukg').map(v => v.id).join() === 'v-matra' && c.F('c2').map(v => v.id).sort().join() === 'v-borrow,v-carry,v-clock,v-tens' && c.F('nur').length === 0 && c.F('c6').length === 0, c.F('c2').map(v => v.id).join());
  // the scripts the team films carry the same questions and answers
  const md = fs.readFileSync(path.join(root, 'video/SCRIPTS.md'), 'utf8');
  check('video/SCRIPTS.md has a script for every video, with each pause\'s answers', c.X.every(v => md.includes('`' + v.id + '`') && c.P(v).every(p => p.opts.every(o => md.includes(o.en.replace(/"/g, ''))))), '');
  const clips = JSON.parse(fs.readFileSync(path.join(root, 'video/clips.json'), 'utf8'));
  check('video/clips.json is valid and starts empty (every video animated until filmed)', clips && typeof clips.clips === 'object' && Object.keys(clips.clips).length === 0, '');
}

/* ---------------- the app ---------------- */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const full = path.join(root, clean === '/' ? 'index.html' : clean);
  fs.readFile(full, (err, data) => { if(err){ res.statusCode = 404; res.end(); return; } res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream'); res.end(data); });
});
server.listen(0, '127.0.0.1', () => {
  const vc = new VirtualConsole(), jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented/.test(e.message) && !/^Could not load link: "https:\/\/fonts\.googleapis\.com\//.test(e.message)) jsErrors.push(e.message); });
  const spoken = [], fetched = [];
  let clipsReply = null;
  const media = { played: 0, paused: 0 };
  const dom = new JSDOM(html, {
    virtualConsole: vc, url: `http://127.0.0.1:${server.address().port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      installVoice(w, spoken);
      const f = w.fetch;
      w.fetch = (u, i) => { fetched.push(String(u)); return clipsReply && /clips\.json/.test(String(u)) ? Promise.resolve({ ok: true, json: async () => clipsReply }) : f(u, i); };
      w.HTMLMediaElement.prototype.play = function(){ media.played++; return Promise.resolve(); };
      w.HTMLMediaElement.prototype.pause = function(){ media.paused++; };
      w.navigator.vibrate = () => {};
      const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
      w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
    }
  });
  const w = dom.window;
  const $ = sel => w.document.querySelector(sel);
  const $$ = sel => [...w.document.querySelectorAll(sel)];
  const E = code => w.eval(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); while(Date.now() - t0 < ms){ if(fn()) return true; await sleep(40); } return false; };
  const child = (cls, age, lang = 'en') => E(`S.game = 'cricket'; S.name = 'Riya'; S.avatar = S.avatar || 'tiger'; S.ob = null; S.home = null; S.lang = '${lang}'; S.age = ${age}; setChildClass('${cls}'); S.lastOpen = dayKey(); S.muted = false; S.videos = null; S._fullMap = false;`);

  w.addEventListener('load', async () => {
    try{
      check('nothing about videos is fetched at boot (the clip list loads when a video list opens)', !fetched.some(u => /video\//.test(u)), fetched.join(' | '));
      E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);

      /* ---- the Picture Hut shelf ---- */
      child('c2', 7);
      E(`go('theater')`);
      const shelf = $$('.watch-card').map(b => b.getAttribute('onclick')).filter(x => /watchStart/.test(x));
      check('Class 2\'s Picture Hut has "Munni\'s videos": bundles of ten, carrying, borrowing, the clock', /Munni's videos/.test(w.document.body.textContent) && shelf.length === 4 && ['v-tens', 'v-carry', 'v-borrow', 'v-clock'].every(id => shelf.some(x => x.includes(id))), shelf.join(' | '));

      /* ---- the animated form, start to end ---- */
      spoken.length = 0;
      E(`watchStart('v-carry')`);
      check('no clip filmed yet → the animated video: the column sum drawn, Munni narrating', await until(() => E('S.ctx.mode') === 'anim' && !!$('.vcol') && spoken.some(t => /38 plus 24/.test(t)), 8000), JSON.stringify([E('S.ctx.mode'), spoken.slice(0, 2)]));
      check('it reaches its first pause by itself: the question and two big answers, and it waits', await until(() => E('S.ctx.phase') === 'pause' && $$('.watch-opts .opt').length === 2, 30000) && /what do we write/.test($('.watch-q').textContent), E('S.ctx.phase'));
      check('…and Munni reads the two answers aloud for a Class 2 child (after the question, not over it)', await until(() => spoken.includes('12') && spoken.includes('or 2?'), 12000) && spoken.lastIndexOf('or 2?') > spoken.findIndex(t => /what do we write/.test(t)), spoken.slice(-4).join(' | '));
      await sleep(2500);
      check('…still waiting a moment later — a pause never runs on without the child', E('S.ctx.phase') === 'pause' && E('S.ctx.picked') === null, E('S.ctx.phase'));
      $$('.watch-opts .opt')[1].click(); $$('.watch-opts .opt')[0].click();
      check('the first tap is evidence for carrying; a second tap is ignored', E(`JSON.stringify(S.skillHistory.carry)`) === JSON.stringify({ n: 1, right: 1 }) && E('S.ctx.picked') === 1, E(`JSON.stringify(S.skillHistory.carry)`));
      check('…marked right, and Munni praises', $$('.watch-opts .opt')[1].classList.contains('right') && await until(() => spoken.some(t => /^Yes! We write 2/.test(t)), 8000), spoken.slice(-2).join(' | '));
      check('the second pause comes after the carried ten is drawn', await until(() => E('S.ctx.phase') === 'pause' && E('S.ctx.q') === 1, 30000) && !!$('.vc-carry') && /1/.test($('.vc-small').textContent), E('S.ctx.q'));
      $$('.watch-opts .opt')[1].click();   // 52: the carried ten forgotten
      check('a wrong tap counts as "not yet", the right answer is shown, and Munni explains — never "wrong"',
        E(`JSON.stringify(S.skillHistory.carry)`) === JSON.stringify({ n: 2, right: 1 }) && $$('.watch-opts .opt')[0].classList.contains('right')
        && await until(() => spoken.some(t => /carried 1 makes 6/.test(t)), 8000) && !spoken.some(t => /wrong/i.test(t)), spoken.slice(-2).join(' | '));
      const stars0 = E('S.stars');
      check('the video ends on its own end screen, with the grown-up card', await until(() => E('S.ctx.phase') === 'end', 30000) && /For the grown-up/.test(w.document.body.textContent), E('S.ctx.phase'));
      check('…a star, the first time today', E('S.stars') === stars0 + 1, `${stars0} → ${E('S.stars')}`);
      await sleep(1500);
      check('…and it waits there: no other video starts by itself', E('S.ctx.phase') === 'end' && E('S.screen') === 'watch', E('S.screen'));
      check('…what it kept: plays and the two answers, on the phone', E('S.videos.n["v-carry"]') === 1 && E('S.videos.log.length') === 2, E('JSON.stringify(S.videos)'));
      E(`watchAgain()`); E(`S.ctx.run = -1`); E(`S.ctx.phase = 'end'; render()`);
      E(`watchAgain(); S.ctx.run = -1; watchEnd()`);
      check('watching it again the same day adds no second star (stars only grow, once a day)', E('S.stars') === stars0 + 1, E('S.stars'));
      E(`watchLeave()`);
      check('"Back" returns to the Picture Hut', E('S.screen') === 'theater', E('S.screen'));

      /* ---- UKG's home card ---- */
      child('ukg', 5, 'hi');
      E(`goHub()`);
      check('UKG\'s home (Story Time) offers its video — the मात्रा — as a big picture', E('S.screen') === 'stories' && $$('.st-card').some(b => /watchStart\('v-matra'\)/.test(b.getAttribute('onclick')) && /मात्रा/.test(b.textContent)), '');
      spoken.length = 0;
      $$('.st-card').find(b => /v-matra/.test(b.getAttribute('onclick'))).click();
      check('…it plays in Hindi, with the big letters drawn', await until(() => !!$('.vid-letters') && spoken.some(t => /खड़ी पाई/.test(t)), 8000), spoken.slice(0, 2).join(' | '));
      E(`watchLeave()`);
      check('…and "Back" returns to Munni\'s home, not the map', E('S.screen') === 'stories', E('S.screen'));

      /* ---- the filmed form ---- */
      child('c1', 6);
      E(`VID_CLIPS = null; VID_CLIPS_P = null`);
      clipsReply = { clips: { 'v-clock': { en: { src: 'video/v-clock-en.mp4', pauses: [30, 70] } } } };
      const played0 = media.played;
      E(`watchStart('v-clock')`);
      check('a clip listed for this language → the filmed video plays (no animated scenes)', await until(() => E('S.ctx.mode') === 'film' && !!$('#vidfilm') && media.played > played0, 5000) && !$('.watch-stage') && /v-clock-en\.mp4$/.test($('#vidfilm').src), E('S.ctx.mode'));
      const el = E('VID_EL');
      E(`VID_EL.currentTime = 12; VID_EL.ontimeupdate()`); await sleep(100);
      check('…it runs on until the first listed second', E('S.ctx.phase') === 'say', E('S.ctx.phase'));
      E(`VID_EL.currentTime = 30.2; VID_EL.ontimeupdate()`);
      check('…then stops and asks, the clip still on screen behind the question — the same <video>, not a fresh one from 0:00',
        await until(() => E('S.ctx.phase') === 'pause', 3000) && $('#vidfilm') === el && E('VID_EL.currentTime') === 30.2 && $$('.watch-opts .opt').length === 2, E('S.ctx.phase'));
      const ans = E('S.ctx.pause.right');
      const p1 = media.played;
      $$('.watch-opts .opt')[ans].click();
      check('…the first tap is evidence for telling the hour, then the clip carries on by itself', E(`JSON.stringify(S.skillHistory.time2)`) === JSON.stringify({ n: 1, right: 1 }) && await until(() => E('S.ctx.phase') === 'say' && media.played > p1, 8000), E('S.ctx.phase'));
      E(`VID_EL.currentTime = 71; VID_EL.ontimeupdate()`);
      await until(() => E('S.ctx.phase') === 'pause', 3000);
      $$('.watch-opts .opt')[1 - E('S.ctx.pause.right')].click();
      await until(() => E('S.ctx.phase') === 'say', 8000);
      E(`VID_EL.onended()`);
      check('…the second pause, then the end screen when the clip ends', E(`JSON.stringify(S.skillHistory.time2)`) === JSON.stringify({ n: 2, right: 1 }) && E('S.ctx.phase') === 'end', E('S.ctx.phase'));

      // a clip that can't play carries on animated from the question it was at
      E(`watchStart('v-clock')`); await until(() => E('S.ctx.mode') === 'film', 3000);
      E(`VID_EL.currentTime = 31; VID_EL.ontimeupdate()`); await until(() => E('S.ctx.phase') === 'pause', 3000);
      $$('.watch-opts .opt')[E('S.ctx.pause.right')].click(); await until(() => E('S.ctx.phase') === 'say', 8000);
      E(`VID_EL.onerror()`);
      check('a clip that fails half way (offline, never watched) carries on as the animated video from the next question', await until(() => E('S.ctx.mode') === 'anim' && !!$('.watch-stage'), 3000) && await until(() => E('S.ctx.phase') === 'pause', 30000) && E('S.ctx.q') === 1, JSON.stringify([E('S.ctx.mode'), E('S.ctx.q')]));
      E(`S.ctx.run = -1; go('theater')`);

      // a badly listed clip (one pause for two questions) is ignored
      E(`VID_CLIPS = null; VID_CLIPS_P = null`);
      clipsReply = { clips: { 'v-clock': { en: { src: 'video/v-clock-en.mp4', pauses: [30] } }, 'v-tens': { en: { src: '../voice/.env', pauses: [10, 20] } } } };
      E(`watchStart('v-clock')`); await until(() => E('S.ctx.mode') != null, 3000);
      const m1 = E('S.ctx.mode'); E(`S.ctx.run = -1; watchStart('v-tens')`); await until(() => E('S.ctx.mode') != null, 3000);
      check('a clip listed wrongly (a pause missing, a path outside video/) is ignored: the animated video plays', m1 === 'anim' && E('S.ctx.mode') === 'anim', `${m1} / ${E('S.ctx.mode')}`);
      E(`S.ctx.run = -1; go('theater')`);

      check('nothing but the clip list, the clips, Munni\'s voice and her pack is fetched', fetched.every(u => /video\/clips\.json$|audio\/|\/api\/tts$|fonts\.googleapis/.test(u)), fetched.filter(u => !/video\/clips\.json$|audio\/|\/api\/tts$/.test(u)).join(' | '));
    }catch(e){
      check('the run finished without an exception', false, e.stack);
    }
    check('no uncaught script errors anywhere in the run', jsErrors.length === 0, jsErrors.join(' | '));
    console.log('-'.repeat(70));
    for(const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass || !c.detail ? '' : '  → ' + c.detail}`);
    console.log('-'.repeat(70));
    console.log(`${checks.length - failures}/${checks.length} checks passed`);
    w.close(); server.close();
    process.exit(failures ? 1 : 0);
  });
});
