/* ==================================================================
   VOICE-FIRST — Munni reads every screen to Nursery–Class 2 (21 Nov 2026).

   A six-year-old can do the sum before they can read the question or the
   words on the buttons. So for the youngest classes Munni says what to do
   on arriving, reads the question and then each choice (lighting it up as
   she says it), and a 🔊 button says it all again. It never talks over a
   screen's own narration, and leaves Class 3 up alone unless a parent
   turns it on.

   The real app (index.html in jsdom), through real taps, with Google
   speech stood in (test/_helpers/voice-stub.js) — each clip "plays" for
   a moment, so waiting for Munni to finish is really tested.
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');
const { installVoice } = require('./_helpers/voice-stub');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

const root = path.resolve(__dirname, '..');
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
  const vc = new VirtualConsole(), jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented/.test(e.message) && !/^Could not load link: "https:\/\/fonts\.googleapis\.com\//.test(e.message)) jsErrors.push(e.message); });
  const spoken = [], lit = [];
  let voice;
  const dom = new JSDOM(html, {
    virtualConsole: vc,
    url: `http://127.0.0.1:${server.address().port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      voice = installVoice(w, spoken, { ms: 120 });   // each line takes a moment, like a real voice
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
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while(Date.now() - t0 < ms){ if(fn()) return true; await sleep(40); } return false; };
  const quiet = async (ms = 900) => { let n = spoken.length, t = Date.now(); while(Date.now() - t < 8000){ await sleep(ms); if(spoken.length === n) return; n = spoken.length; } };
  const child = (cls, age, lang = 'en') => E(`S.game = 'cricket'; S.name = 'Riya'; S.avatar = S.avatar || 'tiger'; S.ob = null; S.home = 'map'; S.readAloud = null; S.lang = '${lang}'; S.age = ${age}; setChildClass('${cls}'); S.lastOpen = dayKey(); S.muted = false; S._fullMap = true;`);

  w.addEventListener('load', async () => {
    try{
      E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
      // which button is lit while each line is said
      const orig = w.speak;
      w.speak = function(t){ const el = w.document.querySelector('.vf-now'); lit.push([String(t), el ? el.textContent.trim() : null]); return orig.apply(this, arguments); };

      /* ---- Counting Stones, Class 1 ---- */
      child('c1', 6);
      E(`go('map')`); await quiet();
      check('the map: Munni says where she suggests going, without being tapped', spoken.some(t => t === $('.jm-munni').dataset.say), spoken.slice(-2).join(' | '));
      spoken.length = 0; lit.length = 0;
      E(`S.ctx = {}; go('math')`);
      const prob = $('.problem').textContent.trim(), opts = $$('.opts .opt').map(b => b.textContent.trim());
      await quiet();
      const words = prob.replace(/\s*\+\s*/, ' plus ').replace(/\s*[−-]\s*/, ' minus ').replace(/\s*[×x]\s*/, ' times ') + '?';
      check('Class 1 at Counting Stones: Munni says where they are, the sum in words, then each answer, the last with "or"',
        spoken[0] === 'Counting Stones!' && spoken[1] === words && opts.every((o, i) => spoken[2 + i] === (i === opts.length - 1 ? `or ${o}?` : o)), JSON.stringify(spoken));
      check('…each answer button is lit up while she says it (and only then)',
        opts.every((o, i) => lit.some(([t, el]) => t === spoken[2 + i] && el === o)) && !$('.vf-now'), JSON.stringify(lit));
      check('…and a 🔊 button is there to hear it again', !!$('#vfagain'), '');
      spoken.length = 0;
      await sleep(1200); E(`render()`); await sleep(1200);
      check('a screen drawn again for any other reason is not read again', spoken.length === 0, spoken.join(' | '));
      spoken.length = 0;
      $('#vfagain').click(); await quiet();
      check('🔊 says it all again — where they are, the sum, the answers', spoken[0] === 'Counting Stones!' && spoken[1] === words && spoken.length === 2 + opts.length, JSON.stringify(spoken));

      // a wrong answer: the help on screen is read; nothing asks the sum again
      const ans = E('S.ctx.p.ans'), wrong = E('S.ctx.p.opts').find(o => o !== ans);
      spoken.length = 0;
      $$('.opts .opt').find(b => Number(b.textContent) === wrong).click();
      await quiet();
      const fb = ($('.feedback') || {}).textContent;
      check('a wrong answer: Munni reads the help shown on screen, and doesn\'t ask the sum again', !!fb && spoken.some(t => t === fb.trim()) && !spoken.includes(words), JSON.stringify([fb, spoken]));

      /* ---- never over a screen's own narration: a lesson question ---- */
      const les = E(`(() => { const l = lessonsForChild().find(x => x.beats.some(b => b.t === 'ask')); return l && l.id; })()`);
      E(`go('lessons'); startLesson(${JSON.stringify(les)})`); await quiet();
      spoken.length = 0; lit.length = 0;
      E(`(() => { const k = S.lesson.data.beats.findIndex(b => b.t === 'ask'); S.lesson.i = k; render(); lesNarrate(); })()`);
      const q = $('.lesq').textContent.trim(), lopts = $$('.opts .opt').map(b => b.textContent.trim());
      await quiet();
      check('a lesson\'s question: the lesson says it, then Munni reads the answers after it — never over it, never twice',
        spoken[0] === q && spoken.filter(t => t === q).length === 1 && lopts.every((o, i) => spoken[1 + i] === (i === lopts.length - 1 ? `or ${o}?` : o)), JSON.stringify(spoken));
      check('…the first answer was read only once the question had finished (no line was cut off)', lit.findIndex(x => x[0] === lopts[0]) > lit.findIndex(x => x[0] === q), JSON.stringify(lit));
      E(`endLesson()`);

      /* ---- the play clearing and the writing pad ---- */
      spoken.length = 0;
      E(`go('games')`); await quiet();
      const names = $$('.shelfcard .sc-name').map(x => x.textContent.trim());
      check('the Play Clearing: where they are, then each game\'s name', spoken[0] === 'The Play Clearing! Pick a game.' && names.every(n => spoken.includes(n)), JSON.stringify(spoken));
      spoken.length = 0;
      E(`go('write'); setWriteMode('trace')`); await quiet();
      check('Class 1 at the Sand Patch: "Trace the letter with your finger…"', spoken.some(t => /Trace the letter/.test(t)), JSON.stringify(spoken));

      /* ---- Hindi ---- */
      child('c2', 7, 'hi');
      spoken.length = 0;
      E(`go('math')`); await quiet();
      const hopts = $$('.opts .opt').map(b => b.textContent.trim());
      check('in Hindi: गिनती के पत्थर, the sum with जमा/घटा and कितना, the last answer with या',
        spoken[0] === 'गिनती के पत्थर!' && /(जमा|घटा|गुणा).*कितना\?$/.test(spoken[1]) && spoken[spoken.length - 1] === `या ${hopts[hopts.length - 1]}?`, JSON.stringify(spoken));

      /* ---- who: Class 3 not, unless a parent says ---- */
      child('c3', 8);
      spoken.length = 0;
      E(`go('math')`); await quiet();
      check('Class 3: nothing read, no 🔊 button (they read for themselves)', spoken.length === 0 && !$('#vfagain'), JSON.stringify(spoken));
      E(`go('parentlock'); S.parentPin = null`); E(`go('parent')`);
      check('the parent page has the switch ("Munni reads aloud"), off for Class 3', /Munni reads aloud/.test(w.document.body.textContent) && !$('button.toggle.on[onclick="toggleReadAloud()"]'), '');
      $('button.toggle[onclick="toggleReadAloud()"]').click();
      spoken.length = 0;
      E(`go('math')`); await quiet();
      check('a parent turns it on for a Class 3 child → read aloud', E('S.readAloud') === 'on' && spoken[0] === 'Counting Stones!', JSON.stringify(spoken));
      child('c1', 6);
      E(`go('parent')`); $('button.toggle[onclick="toggleReadAloud()"]').click();
      spoken.length = 0;
      E(`go('math')`); await quiet();
      check('…and off for a Class 1 child → nothing read', E('S.readAloud') === 'off' && spoken.length === 0 && !$('#vfagain'), JSON.stringify(spoken));

      /* ---- quiet when it should be ---- */
      E(`S.readAloud = null; S.muted = true`);
      spoken.length = 0;
      E(`go('math')`); await quiet();
      check('sound off: nothing is said', spoken.length === 0, JSON.stringify(spoken));
      E(`S.muted = false; go('map')`); await quiet();
      E(`TALK = { state: 'live', childId: S.id }`);   // a call that carries on into the games
      spoken.length = 0;
      E(`go('games')`); await quiet();
      check('during a Talking Munni call (Munni is talking live): nothing read over her', spoken.length === 0, JSON.stringify(spoken));
      E(`TALK = null; talkChip()`);
      child('nur', 3);
      E(`S.home = null; S._fullMap = false; goHub()`);
      spoken.length = 0; await quiet();
      check('Story Time (Nursery) speaks for itself: the layer adds nothing there', E('S.screen') === 'stories' && spoken.every(t => !/Counting|Pick a game|or /.test(t)) && !$('#vfagain'), JSON.stringify(spoken));

      check('only Munni\'s own voice goes online (Google speech); nothing else is sent', voice.ttsCalls.length > 0 && voice.ttsCalls.every(c => typeof c.text === 'string' && Object.keys(c).sort().join() === 'lang,pace,text'), JSON.stringify(voice.ttsCalls.slice(0, 2)));
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
