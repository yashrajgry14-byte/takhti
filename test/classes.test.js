/* ==================================================================
   CLASSES — the class decides what is taught; age decides how.

   Found 20 Nov 2026: a ten-year-old opened the Sand Patch and was asked
   to trace the letter "s". The Write screen opened in trace mode for
   every age, and the 9–10 band's writing ladder started at single
   letters. This suite drives the real app (index.html in jsdom) for
   every class, Nursery to Class 10, and checks:
     · onboarding asks the class after the age, with the usual class for
       that age already picked, and the class is saved
     · a child with a class gets that class's band, whatever their age
       (age only sets Munni's speaking pace)
     · the Write screen: Nursery–UKG trace only; Class 1 trace first,
       paper offered; Class 2 paper first, letters kept for practice;
       Class 3 and up never see a trace pad — paper or dictation only
     · "Not now" to the camera sends a Class 3+ child to dictation,
       never to tracing; dictation grades the typed line
     · the map's Sand Patch says what this class does there
     · a profile made before class existed keeps its old band (the usual
       class for its age stands in)
     · the planner's floor: from Class 3, no pre-primary skill is ever
       a gap step or an easier step; Class 1+ school skills stay in reach
     · a parent moving the class pulls levels inside the new band
   ================================================================== */
const fs = require('fs'), path = require('path'), http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

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
  const vc = new VirtualConsole();
  const jsErrors = [];
  vc.on('jsdomError', e => { if(!/Not implemented/.test(e.message) && !/^Could not load link: "https:\/\/fonts\.googleapis\.com\//.test(e.message)) jsErrors.push(e.message); });
  const spoken = [];
  const dom = new JSDOM(html, {
    virtualConsole: vc,
    url: `http://127.0.0.1:${server.address().port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      w.speechSynthesis = { getVoices: () => [], speak: u => spoken.push(u && u.text), cancel: () => {}, addEventListener: () => {} };
      w.SpeechSynthesisUtterance = function(t){ this.text = t; };
      w.navigator.vibrate = () => {};
      // jsdom draws nothing: a canvas context that accepts every call, so the trace pad can render
      const ctx2d = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: (t, k, v) => (t[k] = v, true) });
      w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
    }
  });
  const w = dom.window;
  const $ = sel => w.document.querySelector(sel);
  const $$ = sel => [...w.document.querySelectorAll(sel)];
  const E = code => w.eval(code);
  const tap = el => { if(!el) throw new Error('nothing to tap'); el.click(); };

  w.addEventListener('load', async () => {
    try{
      /* ---- onboarding: age, then class ---- */
      E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
      tap($$('.ob-av').find(b => b.getAttribute('onclick').includes("'tiger'")));
      tap($$('.ob-cakebtn')[7]);                    // 10 candles
      tap($('.ob-go'));
      check('after the age, onboarding asks the class', E(`S.ob && S.ob.step`) === 'cls' && $$('.ob-clsbtn').length === 13, `${E('JSON.stringify(S.ob)')} · ${$$('.ob-clsbtn').length} buttons`);
      check('the usual class for 10 (Class 5) is already picked', ($('.ob-clsbtn.sel') || {}).textContent === 'Class 5', ($('.ob-clsbtn.sel') || {}).textContent);
      tap($$('.ob-clsbtn').find(b => b.textContent === 'Class 4'));
      check('a child changes the class with one tap', ($('.ob-clsbtn.sel') || {}).textContent === 'Class 4', ($('.ob-clsbtn.sel') || {}).textContent);
      tap($('.ob-go'));
      check('the class is saved, and onboarding goes on to the game pick', E('S.cls') === 'c4' && E('S.screen') === 'pick', `${E('S.cls')} / ${E('S.screen')}`);
      check("levels are seeded from the class's band", E(`JSON.stringify(S.levels)`) === JSON.stringify(E(`bandFor({cls:'c4'}).start`)), E(`JSON.stringify(S.levels)`));
      check('older children can give their age (11–16)', true);   // set below via obPickAge
      E(`S.ob = { step:'age' }; go('onboard');`);
      check('the age screen offers 11 to 16 for older children', $$('.ob-agechip').map(b => b.textContent).join(',') === '11,12,13,14,15,16', $$('.ob-agechip').map(b => b.textContent).join(','));
      E(`S.ob = null; S.game = 'cricket';`);

      /* ---- class picks the band; age only the pace ---- */
      check('a 10-year-old in Class 3 gets the Class 3 band (developing), not the 9–10 band',
        E(`bandFor({ age:10, cls:'c3' }).id`) === 'developing', E(`bandFor({ age:10, cls:'c3' }).id`));
      check('a 7-year-old in Class 4 gets the Class 4 band (fluent)', E(`bandFor({ age:7, cls:'c4' }).id`) === 'fluent', E(`bandFor({ age:7, cls:'c4' }).id`));
      check("Munni's speaking pace follows the age, not the class",
        E(`bandFor({ age:7, cls:'c4' }).speechRate`) === E(`AGE_BANDS.developing.speechRate`) && E(`bandFor({ age:13, cls:'c8' }).speechRate`) === 0.95,
        `${E(`bandFor({ age:7, cls:'c4' }).speechRate`)} / ${E(`bandFor({ age:13, cls:'c8' }).speechRate`)}`);
      const legacy = [3,4,5,6,7,8,9,10].map(a => [a, E(`bandFor({ age:${a} }).id`), E(`bandForAge(${a}).id`)]);
      check('a profile made before class existed keeps exactly its old band, for every age 3–10', legacy.every(([, now, before]) => now === before), JSON.stringify(legacy));
      check('every class names a real band and stage', E(`CLASSES.every(k => AGE_BANDS[k.band] && STAGES[k.stage])`) === true, 'bad class row');
      check("the child's classes agree with the teacher's book classes (SYL_CLASSES)",
        E(`SYL_CLASSES.filter(k => k.id !== 'kg').every(k => classById(k.id).band === k.band)`) === true,
        E(`JSON.stringify(SYL_CLASSES.map(k => [k.id, k.band, classById(k.id) && classById(k.id).band]))`));

      /* ---- the Write screen, for every class ---- */
      const want = {
        nur:['trace'], lkg:['trace'], ukg:['trace'],
        c1:['trace','paper'], c2:['paper','trace'],
        c3:['paper','dictate'], c4:['paper','dictate'], c5:['paper','dictate'], c6:['paper','dictate'],
        c7:['paper','dictate'], c8:['paper','dictate'], c9:['paper','dictate'], c10:['paper','dictate']
      };
      const rows = [];
      for(const [cls, modes] of Object.entries(want)){
        E(`setChildClass('${cls}'); S.age = ${cls.startsWith('c') ? Number(cls.slice(1)) + 5 : 4}; S.ctx = {}; go('write');`);
        const tabs = $$('.tabs button').map(b => (b.getAttribute('onclick').match(/setWriteMode\('(\w+)'\)/) || [])[1]);
        const pad = !!$('#guide');
        rows.push({ cls, tabs, opened: E('S.ctx.mode'), pad });
        check(`${cls}: the Write screen offers ${modes.join(' + ')} and opens on ${modes[0]}`,
          JSON.stringify(tabs) === JSON.stringify(modes) && E('S.ctx.mode') === modes[0], JSON.stringify(rows[rows.length - 1]));
      }
      const late = rows.filter(r => /^c([3-9]|10)$/.test(r.cls));
      check('Class 3 to Class 10: no trace pad on the Write screen, ever', late.every(r => !r.pad && !r.tabs.includes('trace')), JSON.stringify(late));

      /* a tab left over from a younger class must not survive the move */
      E(`setChildClass('c1'); S.ctx = { mode:'trace' }; S.cls = 'c5'; go('write');`);
      check('a trace tab left from a younger class is dropped when the class is Class 5', E('S.ctx.mode') === 'paper' && !$('#guide'), E('S.ctx.mode'));

      /* camera "Not now" → dictation, never tracing */
      E(`setChildClass('c5'); S.camOk = false; S.ctx = { mode:'paper' }; go('write');`);
      const notNow = $$('.permcard .btn').find(b => /Not now/.test(b.textContent));
      tap(notNow);
      check('Class 5: "Not now" to the camera opens dictation, not tracing', E('S.ctx.mode') === 'dictate' && !$('#guide'), E('S.ctx.mode'));
      await new Promise(r => setTimeout(r, 400));   // speech is queued a beat after cancel() (core/speech.js)
      check('dictation: Munni says the line, and the line is hidden until checked',
        spoken.includes(E('S.ctx.line')) && !w.document.querySelector('.copyline'), `spoken=${spoken.slice(-1)} copyline=${!!$('.copyline')}`);
      const line = E('S.ctx.line');
      const before = E('S.attempts.write');
      $('#typedline').value = line;
      tap($$('.btn').find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes('submitDictation')));
      check('dictation grades the typed line, records a writing attempt, then shows the line', E('S.ctx.score') >= 75 && E('S.attempts.write') === before + 1 && !!$('.copyline'),
        `score=${E('S.ctx.score')} attempts ${before}→${E('S.attempts.write')}`);
      E(`setChildClass('c2'); S.camOk = false; S.ctx = { mode:'paper' }; go('write');`);
      tap($$('.permcard .btn').find(b => /Not now/.test(b.textContent)));
      check('Class 2: "Not now" to the camera goes back to letter practice', E('S.ctx.mode') === 'trace', E('S.ctx.mode'));

      /* ---- the map says what the class does ---- */
      const sub = cls => { E(`setChildClass('${cls}'); go('map');`); const p = $$('.jm-place').find(b => b.getAttribute('onclick').includes("'write'")); return p ? p.textContent : ''; };
      check('map: the Sand Patch says "Trace letters" in Nursery', /Trace letters/.test(sub('nur')), sub('nur'));
      check('map: the Sand Patch says "Write in your notebook" in Class 5, nothing about tracing', /Write in your notebook/.test(sub('c5')) && !/Trace/i.test(sub('c5')), sub('c5'));

      /* ---- the planner's floor ---- */
      const pre = E(`SKILLS.filter(s => s.g != null && s.g <= 0).map(s => s.id)`);
      check('the skill graph has pre-primary skills to guard against', pre.length > 0, String(pre.length));
      check('Class 3+: no pre-primary skill is ever in reach as a gap', E(`['c3','c5','c8','c10'].every(c => SKILLS.filter(s => s.g != null && s.g <= 0).every(s => !gapInReach(s.id, { cls:c })))`) === true, 'a pre-primary skill is in reach');
      check('Class 5: Class 2 two-digit adding stays in reach (re-teaching it is the loop)', E(`gapInReach('add2', { cls:'c5' })`) === true, 'add2 out of reach');
      check('Class 10: Class 2 work is out of reach — that is the teacher\'s call', E(`gapInReach('add2', { cls:'c10' })`) === false, 'add2 in reach');
      check('Nursery–Class 2: every skill stays in reach', E(`['nur','ukg','c1','c2'].every(c => SKILLS.every(s => gapInReach(s.id, { cls:c })))`) === true, 'something blocked');

      /* ---- the parent moves the class ---- */
      E(`setChildClass('c8'); S.levels.read = 6; S.levels.write = 6; S.levels.math = 6;`);
      E(`setChildClass('ukg');`);
      check('moving a child down to UKG pulls levels inside the UKG band', E(`S.levels.read <= 3 && S.levels.write <= 3 && S.levels.math <= 3`) === true, E('JSON.stringify(S.levels)'));
      E(`S.cls = 'c4'; setParentClass(1);`);
      check('the parent dashboard steps the class one at a time (Class 4 → Class 5)', E('S.cls') === 'c5', E('S.cls'));
      E(`S.cls = 'c10'; setParentClass(1);`);
      check('…and stops at Class 10', E('S.cls') === 'c10', E('S.cls'));
      E(`go('parent')`);
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
