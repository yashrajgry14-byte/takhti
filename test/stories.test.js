/* ==================================================================
   STORY TIME — how Nursery–UKG children use Takhti (20 Nov 2026).

   A three-year-old can't read menus, so Nursery and LKG get a simple
   home of stories told by Munni (no map), UKG gets the same home plus
   Munni's pick of an activity, and Class 1 up keeps the jungle map. A
   parent can switch the simple home either way. Stories aren't only
   watched: each has moments to join in (tap to count, pick one of two,
   say it aloud), and a pick is real evidence for the story's skill.

   Two parts:
     · content (vm): every template, for every class it serves, in both
       languages, over many seeds — bilingual lines, two different
       pictures to pick from with the right one really right, numbers
       inside the class's range, the right answer in both slots across
       stories, the same seed giving the same story
     · the app (index.html in jsdom), through real taps: who lands where,
       the parent's switch, a story played start to end (counting, the
       pick as evidence, a wrong pick shown kindly, the end screen that
       waits, a star the first time only), "Again" and "Another", Hindi,
       and no network used by a story
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const root = path.resolve(__dirname, '..');

/* ---------------- content ---------------- */
{
  const c = {}; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/content/stories.js'), 'utf8') + ';this.T=STORY_TPLS;this.B=storyBuild;this.F=storyTplsFor;this.N=NUMW;', c);
  const MAXN = { nur: 6, lkg: 10, ukg: 10 };
  const faults = [], slots = {}, made = { nur: new Set(), lkg: new Set(), ukg: new Set() };
  let built = 0;
  const isHi = s => /[ऀ-ॿ]/.test(s);
  for(const cls of ['nur', 'lkg', 'ukg']) for(const lang of ['en', 'hi']) for(const id of c.F(cls)) for(let s = 1; s <= 120; s++){
    const st = c.B(id, s * 2654435761 >>> 0, { cls, lang, name: 'Riya' }); built++; made[cls].add(id);
    const txt = JSON.stringify(st);
    if(/undefined|NaN|null/.test(txt)) faults.push(`${id}/${cls}/${lang}: a hole in the text`);
    if(!st.grownup.en || !isHi(st.grownup.hi) || !st.home.en || !isHi(st.home.hi)) faults.push(`${id}: grown-up lines not in both languages`);
    let picks = 0;
    st.scenes.forEach((sc, k) => {
      if(!sc.say.en || !isHi(sc.say.hi)) faults.push(`${id} scene ${k}: not in both languages`);
      const j = sc.join; if(!j) return;
      if(j.t === 'pick'){
        picks++;
        if(j.opts.length !== 2 || ![0, 1].includes(j.right)) faults.push(`${id}: a pick needs two pictures and a right one`);
        if(JSON.stringify(j.opts[0]) === JSON.stringify(j.opts[1])) faults.push(`${id}: both pictures the same`);
        j.opts.forEach(o => { if(o.group && (o.n < 1 || o.n > MAXN[cls])) faults.push(`${id}/${cls}: a group of ${o.n}`); });
        if(!j.praise.en || !isHi(j.praise.hi) || !j.show.en || !isHi(j.show.hi)) faults.push(`${id}: praise / kind correction not bilingual`);
        (slots[id] = slots[id] || new Set()).add(j.right);
        // the counted / named number really is the right group
        if(id === 'fall' || id === 'match'){
          const n = id === 'fall' ? st.scenes.find(x => x.join && x.join.t === 'count').join.n : Number(st.scenes[0].stage.big);
          if(j.opts[j.right].n !== n || j.opts[1 - j.right].n === n) faults.push(`${id}: the right basket isn't the one with ${n}`);
        }
        if(id === 'sizes'){ const big = j.opts[j.right].size > j.opts[1 - j.right].size; if(big !== /BIG|बड़े/.test(sc.say.en + sc.say.hi)) faults.push('sizes: the right one is the wrong size'); }
      }
      if(j.t === 'count' && (j.n < 1 || j.n > (cls === 'nur' ? 5 : 9) || j.seq.length !== j.n || j.to.length !== j.n)) faults.push(`${id}/${cls}: counting ${j.n}`);
      if(j.t === 'say' && (!j.word.en || !j.word.hi)) faults.push(`${id}: nothing to say back`);
    });
    if(picks !== 1) faults.push(`${id}: ${picks} picks (one per story)`);
  }
  check(`every story template builds for every class it serves, in both languages (${built} stories)`, faults.length === 0, [...new Set(faults)].slice(0, 8).join(' | '));
  check('Nursery gets counting to 5, big and small, shapes, colours, rhymes and a tale; LKG adds more/fewer, patterns, first sounds and number matching',
    [...made.nur].sort().join(',') === 'colours,fall,rhyme,shapes,sizes,tale' && ['more', 'pattern', 'letter', 'match'].every(x => made.lkg.has(x)) && !made.nur.has('letter'),
    `${[...made.nur]} / ${[...made.lkg]}`);
  check('the right picture is in both slots across stories (never always the same one)', Object.values(slots).every(s => s.size === 2), JSON.stringify(Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, [...v]]))));
  check('the same seed gives the same story; another seed a different one',
    JSON.stringify(c.B('fall', 77, { cls:'lkg', lang:'en' })) === JSON.stringify(c.B('fall', 77, { cls:'lkg', lang:'en' }))
    && new Set([1, 2, 3, 4, 5, 6].map(s => JSON.stringify(c.B('fall', s * 99991, { cls:'lkg', lang:'en' }).scenes[0]))).size > 2, '');
  check("each story's pick is evidence for a real pre-primary skill (Nursery g −3, LKG up to −2)",
    ['nur', 'lkg'].every(cls => c.F(cls).every(id => /^(n|l)-/.test(c.T[id].skill({ cls, lang:'en' })) && (cls !== 'nur' || /^n-/.test(c.T[id].skill({ cls, lang:'en' }))))), '');
  check('first sounds follow the language: English letters, Hindi स्वर',
    c.B('letter', 5, { cls:'lkg', lang:'en' }).skill === 'l-sound' && c.B('letter', 5, { cls:'lkg', lang:'hi' }).skill === 'l-swar' && /[अआइउऊ]/.test(c.B('letter', 5, { cls:'lkg', lang:'hi' }).scenes[0].stage.big), '');
}

/* ---------------- the app ---------------- */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  const full = path.join(root, clean === '/' ? 'index.html' : clean);
  fs.readFile(full, (err, data) => {
    if(err){ res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(0, '127.0.0.1', () => {
  const vc = new VirtualConsole();
  const jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented/.test(e.message) && !/^Could not load link: "https:\/\/fonts\.googleapis\.com\//.test(e.message)) jsErrors.push(e.message); });
  const spoken = [], fetched = [];
  const dom = new JSDOM(html, {
    virtualConsole: vc,
    url: `http://127.0.0.1:${server.address().port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      // a voice that really finishes each line, quickly
      w.speechSynthesis = { getVoices: () => [], speak: u => { spoken.push(u && u.text); setTimeout(() => u && u.onend && u.onend(), 5); }, cancel: () => {}, addEventListener: () => {} };
      w.SpeechSynthesisUtterance = function(t){ this.text = t; };
      w.navigator.vibrate = () => {};
      const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
      w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
    }
  });
  const w = dom.window;
  const $ = sel => w.document.querySelector(sel);
  const $$ = sel => [...w.document.querySelectorAll(sel)];
  const E = code => w.eval(code);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); while(Date.now() - t0 < ms){ if(fn()) return true; await sleep(40); } return false; };
  const child = (cls, age, lang = 'en') => E(`S.game = 'cricket'; S.name = ${JSON.stringify(lang === 'hi' ? 'रिया' : 'Riya')}; S.avatar = S.avatar || 'tiger'; S.ob = null; S.home = null; S.lang = '${lang}'; S.age = ${age}; ${cls ? `setChildClass('${cls}')` : 'S.cls = null'}; S.stories = null; S.lastOpen = null; S._fullMap = false; goHub();`);

  w.addEventListener('load', async () => {
    try{
      E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);

      /* ---- who lands where ---- */
      const lands = {};
      for(const [cls, age] of [['nur', 3], ['lkg', 4], ['ukg', 5], ['c1', 6], ['c3', 8]]){ child(cls, age); lands[cls] = E('S.screen'); }
      check('Nursery, LKG and UKG land on Story Time; Class 1 and Class 3 on the map (or the daily opening)',
        lands.nur === 'stories' && lands.lkg === 'stories' && lands.ukg === 'stories' && ['map', 'open'].includes(lands.c1) && ['map', 'open'].includes(lands.c3), JSON.stringify(lands));
      child(null, 3);
      check('a profile with no class, age 3, gets the simple home (the usual class for the age)', E('S.screen') === 'stories', E('S.screen'));
      child(null, 7);
      check('…and age 7 with no class keeps the map, as before', E('S.screen') !== 'stories', E('S.screen'));

      child('nur', 3);
      check('the Nursery home: Munni, one big story, more stories, finger tracing — no map, no Munni\'s pick, no "All places"',
        !!$('.st-munni') && $$('.st-card.hero').length === 1 && $$('.st-row .st-card').length >= 3 && /Draw with your finger/.test(w.document.body.textContent)
        && !$('.jmap') && !$('.st-pick') && !/All places/.test(w.document.body.textContent), w.document.body.textContent.slice(0, 200));
      await sleep(500);
      check('Munni says the home line out loud (a three-year-old can\'t read the bubble)', spoken.some(t => /Shall we have a story/.test(t)), spoken.slice(-3).join(' | '));
      E(`go('map')`);
      check('"back to the map" from any screen lands a Nursery child on Story Time', E('S.screen') === 'stories', E('S.screen'));
      check('the parent link is still there', $$('.jm-foot .btn').some(b => /parentlock/.test(b.getAttribute('onclick'))), '');

      child('ukg', 5);
      check("the UKG home adds Munni's pick and one more choice, as big pictures, and the full map one tap away",
        !!$('.st-card.place.mine .st-pick') && $$('.st-row.two .st-card.place').length === 2 && /All places/.test(w.document.body.textContent), w.document.body.textContent.slice(0, 300));
      $$('.jm-foot .btn').find(b => /storyFullMap/.test(b.getAttribute('onclick'))).click();
      check('"All places" opens the jungle map, with a way back to Munni\'s home', E('S.screen') === 'map' && !!$('.jmap') && /Back to Munni's home/.test(w.document.body.textContent), E('S.screen'));
      $$('button').find(b => /storyHome\(\)/.test(b.getAttribute('onclick') || '')).click();
      check('…and back', E('S.screen') === 'stories', E('S.screen'));

      /* ---- the parent's switch ---- */
      child('c1', 6); E(`go('parent')`);
      check('the parent page has the simple-home switch, off for Class 1', /Simple home/.test(w.document.body.textContent) && !$('button.toggle.on[onclick="toggleSimpleHome()"]'), '');
      $('button[onclick="toggleSimpleHome()"]').click(); E('goHub()');
      check('a parent turns it on for a Class 1 child → Story Time (guided)', E('S.home') === 'simple' && E('S.screen') === 'stories' && !!$('.st-pick'), `${E('S.home')} / ${E('S.screen')}`);
      child('nur', 3); E(`S.home = 'map'; goHub();`);
      check("a parent turns it off for a Nursery child → the map", E('S.screen') !== 'stories', E('S.screen'));

      /* ---- a story, start to end (Hindi) ---- */
      child('nur', 3, 'hi');
      check('the home is in Hindi for a Hindi child', /कहानी सुनें/.test(w.document.body.textContent), '');
      const realFetch = w.fetch; w.fetch = (...a) => { fetched.push(String(a[0])); return realFetch ? realFetch(...a) : Promise.reject(new Error('no')); };
      spoken.length = 0;
      E(`storyStart('fall')`);
      check('the story starts with Munni speaking the first scene, in Hindi', await until(() => spoken.some(t => /पेड़/.test(t)), 5000) && E('S.screen') === 'story', spoken.join(' | '));
      check('…the picture, a caption and the grown-up line are on screen', !!$('#ststage .st-it') && /देखो/.test($('.st-cap').textContent) && /👪/.test($('.st-grown').textContent), '');
      check('it reaches the counting moment by itself', await until(() => E('S.ctx.phase') === 'count'), E('S.ctx.phase'));
      const n = E(`S.ctx.st.scenes[S.ctx.i].join.n`);
      spoken.length = 0;
      for(let k = 0; k < n; k++){ $('#ststage').click(); await sleep(450); }   // a child's pace: each number is said before the next tap
      check(`each tap counts one thing and Munni says its number (${n})`, E('S.ctx.counted') === n && $$('.st-num').length === n && spoken.includes('एक') && spoken.includes(E(`NUMW.hi[${n}]`)), `${E('S.ctx.counted')} · ${spoken.join(',')}`);
      check('then the pick: two big pictures', await until(() => E('S.ctx.phase') === 'pick' && $$('.st-opt').length === 2), E('S.ctx.phase'));
      const right = E(`S.ctx.st.scenes[S.ctx.i].join.right`), before = E(`JSON.stringify(S.skillHistory['n-count5'] || null)`);
      $$('.st-opt')[right].click(); $$('.st-opt')[1 - right].click();
      check('the first tap is evidence for the skill (counting to 5); a second tap is ignored',
        E(`JSON.stringify(S.skillHistory['n-count5'])`) === JSON.stringify({ n: (before === 'null' ? 0 : JSON.parse(before).n) + 1, right: (before === 'null' ? 0 : JSON.parse(before).right) + 1 }) && E('S.stories.log.length') === 1,
        E(`JSON.stringify(S.skillHistory['n-count5'])`));
      check('…the right picture is marked, the other dimmed, and Munni praises', $$('.st-opt')[right].classList.contains('st-right') && await until(() => spoken.some(t => /हाँ/.test(t)), 5000), spoken.slice(-2).join(' | '));
      const stars0 = E('S.stars');
      check('the story ends on its own end screen', await until(() => E('S.ctx.phase') === 'end'), E('S.ctx.phase'));
      check('…a star, the first time today (stars only grow)', E('S.stars') === stars0 + 1, `${stars0} → ${E('S.stars')}`);
      check('…the grown-up card and the thing to do at home, in Hindi', /बड़ों के लिए/.test(w.document.body.textContent) && /पूछें/.test(w.document.body.textContent), '');
      await sleep(2500);
      check('…and it waits there: no next story starts by itself', E('S.ctx.phase') === 'end' && E('S.screen') === 'story', E('S.ctx.phase'));
      check('a story uses no network at all', fetched.filter(u => !/fonts\.googleapis|audio\//.test(u)).length === 0, fetched.join(' | '));
      w.fetch = realFetch;

      const seed = E('S.ctx.st.seed');
      $$('.st-card').find(b => /storyAgain/.test(b.getAttribute('onclick'))).click();
      check('"Again" plays the very same story', E('S.ctx.st.seed') === seed && E('S.ctx.st.tpl') === 'fall', E('S.ctx.st.seed'));
      E(`S.ctx.phase = 'end'; render();`);
      $$('.st-card').find(b => /storyNext/.test(b.getAttribute('onclick'))).click();
      check('"Another story" starts a different one', E('S.ctx.st.tpl') !== 'fall', E('S.ctx.st.tpl'));
      E(`storyHome()`);
      check('a story finished today moves to the back of the home', !$('.st-card.hero').getAttribute('onclick').includes("'fall'") && E('storyOrder()').slice(-1)[0] === 'fall', E('JSON.stringify(storyOrder())'));

      /* ---- a wrong pick is shown kindly ---- */
      child('nur', 3);
      E(`storyStart('sizes')`);
      check('Big and small reaches its pick', await until(() => E('S.ctx.phase') === 'pick', 30000), E('S.ctx.phase'));
      const r2 = E(`S.ctx.st.scenes[S.ctx.i].join.right`);
      spoken.length = 0;
      $$('.st-opt')[1 - r2].click();
      check('a wrong first tap counts as "not yet", the right picture is shown, and nothing says "wrong"',
        E(`JSON.stringify(S.skillHistory['n-big'])`) === JSON.stringify({ n: 1, right: 0 }) && $$('.st-opt')[r2].classList.contains('st-right')
        && await until(() => spoken.some(t => /This one is/.test(t)), 5000) && !spoken.some(t => /wrong/i.test(t)), spoken.join(' | '));
      check('…and the story goes on to its end', await until(() => E('S.ctx.phase') === 'end'), E('S.ctx.phase'));
      E(`storyStart('sizes', S.ctx.st.seed)`); E(`S.ctx.run = -1; S.ctx.st && (S.ctx.phase = 'end');`);
      E(`storyHome()`);

      /* ---- say it aloud: nothing is recorded ---- */
      const recBefore = E(`typeof S.ctx === 'object'`) && E('JSON.stringify(S.stories.log)');
      E(`storyStart('colours')`);
      check('"say it with Munni" shows "your turn" and moves on — nothing listened to or recorded',
        await until(() => E('S.ctx.yourTurn') === true, 20000) && await until(() => E('S.ctx.phase') === 'pick', 20000) && E('JSON.stringify(S.stories.log)') === recBefore, E('S.ctx.phase'));
      E(`storyHome()`);

      /* ---- leaving mid-story stops it ---- */
      E(`storyStart('tale')`);
      await sleep(200);
      E(`storyHome()`);
      const s0 = spoken.length;
      await sleep(1500);
      check('leaving a story half way stops it (nothing more is said or recorded)', E('S.screen') === 'stories' && spoken.slice(s0).every(t => !/thirsty|puppy|Splash/.test(t)), spoken.slice(s0).join(' | '));
    }catch(e){
      check('the run finished without an exception', false, e.stack);
    }
    check('no uncaught script errors anywhere in the run', jsErrors.length === 0, jsErrors.join(' | '));

    console.log('-'.repeat(70));
    checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
    console.log('-'.repeat(70));
    console.log(`${checks.length - failures}/${checks.length} checks passed`);
    server.close();
    process.exit(failures ? 1 : 0);
  });
});
