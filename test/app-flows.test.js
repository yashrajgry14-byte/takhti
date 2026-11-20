/* ==================================================================
   APP FLOWS — the real index.html/CSS/JS in jsdom, over a real local
   HTTP origin (localStorage needs one; see test/mute.test.js).

   Every other cartoon/teacher/homework test drives functions directly,
   which is exactly how a whole subsystem once sat unreachable while its
   own tests passed. This one only moves the way a person does — taps
   on rendered buttons, real screen changes — and checks each feature
   is genuinely reachable and does what it says:
     · first run: arrival → onboarding → pick a game → today's opening
     · the map: seven places, no streak counter, the child's own avatar
     · the Picture Hut from its map place: play, answer, earn a card
     · the parent button goes through the PIN gate (it used to skip it)
     · the teacher view from the parent dashboard: class diagnosis,
       assigning homework
     · homework on the map: Munni at the Story Fire, the story plays,
       and finishing it moves her on
     · adding a sibling from the map's profile switcher
     · the daily opening plays once per day, not on every visit
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
  // Google Fonts can't load without open internet (a sandbox); that is the network, not the app — any other link still fails
  vc.on('jsdomError', e => { if(!/Not implemented/.test(e.message) && !/^Could not load link: "https:\/\/fonts\.googleapis\.com\//.test(e.message)) jsErrors.push(e.message); });
  const dom = new JSDOM(html, {
    virtualConsole: vc,
    url: `http://127.0.0.1:${server.address().port}/index.html`,
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w){
      w.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {}, addEventListener: () => {} };
      w.SpeechSynthesisUtterance = function(){};
      w.navigator.vibrate = () => {};
    }
  });
  const w = dom.window;
  const $ = sel => w.document.querySelector(sel);
  const $$ = sel => [...w.document.querySelectorAll(sel)];
  const E = code => w.eval(code);
  const tap = el => { if(!el) throw new Error('nothing to tap'); el.click(); };
  const byText = (sel, txt) => $$(sel).find(el => el.textContent.toLowerCase().includes(txt.toLowerCase()));

  w.addEventListener('load', async () => {
    const tick = () => new Promise(r => setTimeout(r, 60));
    try{
      /* ---- first run ---- */
      E(`arrSkip(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance(); arrReply(0); arrAdvance();`);
      check('a brand-new device goes from arrival to onboarding', E('S.screen') === 'onboard', E('S.screen'));
      tap($$('.ob-av').find(b => b.getAttribute('onclick').includes("'tiger'")));
      tap($$('.ob-cakebtn')[4]);                   // 7 candles
      tap($('.ob-go'));
      tap($('.ob-go'));                            // the class step: the usual class for that age is already picked
      check('onboarding creates a real profile and asks for a game next', E('S.profiles.length') === 1 && E('S.screen') === 'pick', `${E('S.profiles.length')} / ${E('S.screen')}`);
      tap($$('.gcard').find(b => b.getAttribute('onclick').includes("'cricket'")));
      check("picking a game plays today's opening, and records that it played today", E('S.screen') === 'open' && E('S.lastOpen === dayKey()'), `${E('S.screen')} lastOpen=${E('S.lastOpen')}`);

      /* ---- the map ---- */
      E(`go('map')`);
      const mapHtml = $('#screen').innerHTML;
      check('the map shows seven places, including the Picture Hut', $$('.jm-place').length === 7 && !!byText('.jm-place', 'Picture Hut'), `${$$('.jm-place').length}`);
      check('no day-streak counter anywhere on the map', !$('.streak-badge') && !/d+s*(Day|दिन)/.test($('.top-gamify-bar').textContent), $('.top-gamify-bar').textContent);
      check("the header shows the child's own avatar (🐯), not the id text 'tiger'", $('.mascot-avatar-btn').textContent.includes('🐯') && !$('.mascot-avatar-btn').textContent.includes('tiger'), $('.mascot-avatar-btn').textContent);
      check('the profile switcher is on the map, with an Add button', !!$('.profilebar') && !!$('.profilechip.add'), 'no switcher');
      check('Munni stands somewhere and says something', !!$('.jm-munni') && $('.jm-say').textContent.length > 5, 'no Munni line');

      /* ---- the Picture Hut ---- */
      tap(byText('.jm-place', 'Picture Hut'));
      check('the Picture Hut place opens the cartoon shelf', E('S.screen') === 'theater' && !!$('.video-card') && !!$('.hero-video-card'), E('S.screen'));
      const cards = $$('.video-card').length;
      tap(byText('.theme-pill', 'Anime'));
      check('a theme filter keeps the whole catalog, in that theme', $$('.video-card').length === cards && $$('.vc-thumb').every(t => t.textContent.includes('⚔️')), `${$$('.video-card').length} vs ${cards}`);
      tap($('.video-card'));
      check('tapping a cartoon plays it', E('!!S.activeVideo') && !!$('.video-stage'), 'not playing');
      const skillId = E('S.activeVideo.data.skillId');
      tap(byText('.btn', 'next')); tap(byText('.btn', 'next'));
      const correct = E('S.activeVideo.data.scenes[2].correct');
      tap($$('.video-stage .opt')[correct]);
      check('answering the cartoon checkpoint is real skill evidence', E(`(S.skillHistory['${skillId}']||{}).right`) === 1, E('JSON.stringify(S.skillHistory)'));
      E('videoNextScene()');
      check('a right answer earns the card, kept in the profile', E(`S.cards.some(c => c.id === 'card-vid-${skillId}')`), E('JSON.stringify(S.cards)'));
      tap(byText('.btn', 'Done'));
      tap($('.back'));
      check('back from the shelf returns to the map', E('S.screen') === 'map', E('S.screen'));

      /* ---- parent gate, dashboard, teacher view ---- */
      tap($('.jm-foot .btn'));
      check("the map's parent button goes through the PIN gate (it used to open the dashboard directly)", E('S.screen') === 'parentlock', E('S.screen'));
      $('#pin').value = '1234'; tap(byText('.btn', 'Save'));
      check('setting a PIN opens the parent dashboard', E('S.screen') === 'parent', E('S.screen'));
      check('the dashboard shows the card the child just earned', !!$('.earned-card'), 'no earned card');
      $('#classcode').value = 'ABC123'; tap(byText('.btn', 'Link'));
      check('class sync is OFF until a parent switches it on', E('S.syncOn') === false && /Sync automatically/.test($('#screen').textContent), 'not off');
      tap($$('.toggle').find(t => /sync/.test(t.getAttribute('aria-label'))));
      await tick();
      check("switching it on shows 'Sync now' and an honest status (no sync server in this test)", E('S.syncOn') === true && !!byText('.btn', 'Sync now') && /sync/i.test($('#screen').textContent), $('#screen').textContent.slice(0, 200));
      tap(byText('.btn', 'For teachers'));
      check('"For teachers" opens the teacher view', E('S.screen') === 'teacher', E('S.screen'));
      check('the teacher view shows what Takhti covers, from the live skill graph', !!$('.covtable') && $('#screen').textContent.includes('can be taught today'), 'no coverage');
      $('#tcode').value = 'ABC123'; tap(byText('.btn', 'Open class'));
      check('opening the class lists the linked child', $('#screen').textContent.includes('1 linked: Tiger'), $('#screen').textContent.slice(0, 400));
      tap($$('.toggle').find(t => t.getAttribute('aria-label') === 'sync'));
      await tick();
      check("'Keep this class synced' makes this phone the class's teacher (a private key, never shown)", E("S.syncClasses.includes('ABC123') && S.syncKeys.ABC123.length === 48") && !$('#screen').textContent.includes(E('S.syncKeys.ABC123')), 'no key');
      // the skill picker, not the class roster's "This class is…" (which now comes first)
      const sel = $$('#screen select').find(s => /tskill/.test(s.getAttribute('onchange') || '')); sel.value = 'tables'; sel.dispatchEvent(new w.Event('change'));
      check('picking the skill the class got wrong runs the real diagnosis per child', $$('#screen .metric').some(m => m.textContent.includes('Tiger')), 'no per-child result');
      $('#tnote').value = 'Practise your tables'; tap(byText('.btn', 'This skill'));
      check('assigning homework stores it for the class', E(`(readClassShared('ABC123')._homework||{}).skills+''`) === 'tables', E(`JSON.stringify(readClassShared('ABC123')._homework)`));

      /* ---- homework on the map ---- */
      E(`go('map')`);
      check('with homework assigned, Munni waits at the Story Fire and says the teacher left something', E('mapSuggestion().why') === 'homework' && $('.jm-say').textContent.includes('teacher'), $('.jm-say').textContent);
      tap(byText('.jm-place', 'Story Fire'));
      check('the Story Fire shows the homework, with a story to play', !!$('.hw-banner-card') && !!byText('.hw-banner-card .btn', 'Play solo'), 'no banner');
      tap(byText('.hw-banner-card .btn', 'Play solo'));
      check('the homework story plays in the child\'s own game', E('S.lesson && S.lesson.data.isHomeworkStory && S.lesson.data.gameId') === 'cricket', E('S.lesson && S.lesson.data.gameId'));
      E('lesNext()');
      tap($$('.opts .opt')[E('lesBeat().correct')]);
      E('lesNext(); lesNext();');
      check('finishing the homework story marks it done', E('S.hwDone') === E(`readClassShared('ABC123')._homework.assignedAt`), `${E('S.hwDone')}`);
      E('endLesson()'); E(`go('map')`);
      check('…and Munni moves on from it', E('(mapSuggestion()||{}).why') !== 'homework', E('JSON.stringify(mapSuggestion() && mapSuggestion().why)'));

      /* ---- a sibling ---- */
      tap($('.profilechip.add'));
      check("'Add' starts the same tap-an-animal onboarding for a new child", E('S.screen') === 'onboard' && !!$('.ob-av'), E('S.screen'));
      tap($$('.ob-av').find(b => b.getAttribute('onclick').includes("'peacock'")));
      check('picking an animal creates a second profile, leaving the first child untouched', E('S.profiles.length') === 2 && E('S.activeProfile') === 1 && E('S.profiles[0].avatar') === 'tiger', `${E('S.profiles.length')} ${E('S.profiles[0].avatar')}`);
      tap($$('.ob-cakebtn')[2]); tap($('.ob-go')); tap($('.ob-go'));
      check('the new child picks their own game next', E('S.screen') === 'pick', E('S.screen'));
      E(`switchProfile(0)`);
      check('switching back to the first child (already opened today) lands on the map, not the opening', E('S.screen') === 'map' && E('S.name') === 'Tiger', `${E('S.screen')} ${E('S.name')}`);

      /* ---- Tier 1: a practice line after a missed reading ---- */
      E(`go('read'); S.ctx.sentence = 'The dog can run.'; render();`);   // a known line whose words recur in the bank
      $('#typed').value = 'zzz qqq'; tap(byText('.btn', 'Check'));
      await tick();
      check('a missed reading offers one more line with the missed words', !!$('.practise'), $('#screen').textContent.slice(0, 300));
      const offered = E('S.ctx.practice && S.ctx.practice.line');
      tap($('.practise'));
      check('tapping it makes that line the one to read', E('S.ctx.sentence') === offered && !!offered, `${offered}`);

      /* ---- the dashboard's on-device status, and sharing with a teacher on another phone ---- */
      E(`go('parent')`); await tick();
      check('the parent dashboard shows what works without internet on this phone', $('#screen').textContent.includes('Reading aloud') && $('#screen').textContent.includes('Fresh practice lines'), 'missing');
      tap(byText('.btn', 'Make a progress code'));
      const pcode = $('.sharecode') && $('.sharecode').value;
      check('"Make a progress code" shows a code to send', /^TKR1./.test(pcode || ''), pcode);
      $('#hwcode').value = 'not a code'; tap(byText('.btn', 'Add homework'));
      check('a bad homework code is refused with a clear message', /whole homework code/.test($('#screen').textContent), 'no message');
      E(`go('teacher')`);
      $('#rcode').value = pcode; tap(byText('.btn', 'Add to class'));
      check('the teacher view takes a progress code (here, on the same phone, it rightly reports the live record is newer)', /added to class ABC123|newer code for this child is already here/.test($('#screen').textContent), $('#screen').textContent.slice(0, 300));

      /* ---- once a day ---- */
      E(`S.lastOpen = dayKey() - 1; goHub();`);
      check('on a new day, arriving plays the daily opening', E('S.screen') === 'open', E('S.screen'));
      E(`goHub();`);
      check('…and only once that day', E('S.screen') === 'map', E('S.screen'));

      /* ---- the goal celebration reaches the map ---- */
      E(`S._pendingCelebrate = true; go('map');`);
      check('a goal met elsewhere is celebrated on arrival at the map (the flag is consumed)', E('S._pendingCelebrate') === false, 'still pending');
    }catch(e){
      check('the flow ran to the end without an exception', false, e.stack);
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
