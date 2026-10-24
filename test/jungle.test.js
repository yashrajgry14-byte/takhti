/* ==================================================================
   JUNGLE ARRIVAL / ONBOARDING / MAP TESTS

   Real index.html/CSS/JS in a real jsdom document, served over a real
   local HTTP origin (not file:// — jsdom correctly treats that as
   opaque, where localStorage throws; createProfile()/save() need it,
   same lesson as test/mute.test.js).

   Covers, in order: boot renders arrival without throwing; the herd
   exists; tapping through the scripted conversation reaches
   arrFinish(); onboarding sets S.avatar/S.name/S.age and seeds levels
   from the band; the map renders exactly the places the age band
   allows and puts Munni at mapSuggestion().
   ================================================================== */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { JSDOM, VirtualConsole } = require('jsdom');

let failures = 0;
const checks = [];
function check(name, pass, detail){
  checks.push({ name, pass, detail });
  if(!pass) failures++;
}

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

function StubAudioContext(){ this.state = 'suspended'; }
StubAudioContext.prototype.resume = function(){ this.state = 'running'; return Promise.resolve(); };
StubAudioContext.prototype.createOscillator = function(){
  return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, start(){}, stop(){} };
};
StubAudioContext.prototype.createGain = function(){
  return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(){} };
};
Object.defineProperty(StubAudioContext.prototype, 'currentTime', { get(){ return 0; } });
Object.defineProperty(StubAudioContext.prototype, 'destination', { get(){ return {}; } });

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const virtualConsole = new VirtualConsole();
  const jsErrors = [];
  virtualConsole.on('jsdomError', e => jsErrors.push(e.message));
  virtualConsole.forwardTo(console);

  const dom = new JSDOM(html, {
    virtualConsole,
    url: `http://127.0.0.1:${port}/index.html`,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window){
      window.speechSynthesis = {
        getVoices: () => [], speak: () => {}, cancel: () => {},
        addEventListener: () => {}, removeEventListener: () => {}
      };
      window.SpeechSynthesisUtterance = function(){};
      window.AudioContext = window.webkitAudioContext = StubAudioContext;
    }
  });
  const { window } = dom;
  window.navigator.vibrate = () => {};

  window.addEventListener('load', () => {
    console.log('=== boot: arrival renders without throwing ===');
    const boot = window.eval(`
      (function(){
        return {
          screen: S.screen,
          hasArrivalEl: !!document.getElementById('arrival'),
          rendered: document.getElementById('screen').innerHTML.length
        };
      })()
    `);
    console.log(JSON.stringify(boot));
    check('app.js boots straight to the arrival screen', boot.screen === 'arrival', `S.screen=${boot.screen}`);
    check('the arrival scene element exists in the DOM', boot.hasArrivalEl === true, JSON.stringify(boot));
    check('arrival rendered real content, not an empty view', boot.rendered > 500, `length=${boot.rendered}`);

    console.log('\n=== the herd: four elephants walking through ===');
    const herd = window.eval(`
      (function(){
        return {
          elCount: document.querySelectorAll('.ar-el').length,
          herdVisible: !document.querySelector('.ar-herd').classList.contains('gone')
        };
      })()
    `);
    console.log(JSON.stringify(herd));
    check('exactly four elephants are in the herd', herd.elCount === 4, `got ${herd.elCount}`);
    check('the herd is visible before the conversation starts (step 0)', herd.herdVisible === true, JSON.stringify(herd));

    console.log('\n=== tapping through the scripted conversation reaches arrFinish() ===');
    const convo = window.eval(`
      (function(){
        const log = [];
        arrSkip();   // skip the 8.2s herd-walk wait, straight to the conversation
        log.push('after skip: step=' + S.arr.step + ' turn=' + S.arr.turn);

        // turn 0: "How are you?" — pick "Great!" (index 0), not end
        arrReply(0);
        log.push('after reply 0: reply=' + JSON.stringify(S.arr.reply));
        arrAdvance();
        log.push('after advance: turn=' + S.arr.turn + ' screen=' + S.screen);

        // turn 1: "Shall I tell you something?" — pick "Yes!" (index 0), not end
        arrReply(0);
        arrAdvance();
        log.push('after turn 1: turn=' + S.arr.turn + ' screen=' + S.screen);

        // turn 2: "Shall we go?" — pick "Let us go!" (index 0), end:true
        arrReply(0);
        const endFlag = S.arr.end;
        arrAdvance();   // this call must reach arrFinish()

        return { log, endFlag, finalScreen: S.screen, arrCleared: S.arr === null };
      })()
    `);
    console.log(convo.log.join('\n'));
    console.log(JSON.stringify({ endFlag: convo.endFlag, finalScreen: convo.finalScreen, arrCleared: convo.arrCleared }));
    check('the third turn\'s reply is flagged end:true', convo.endFlag === true, `endFlag=${convo.endFlag}`);
    check('arrFinish() ran: S.arr is cleared', convo.arrCleared === true, `arrCleared=${convo.arrCleared}`);
    check('arrFinish() routed off the arrival screen (no avatar yet → onboard)', convo.finalScreen === 'onboard', `finalScreen=${convo.finalScreen}`);

    console.log('\n=== onboarding: avatar, name, age, and levels seeded from the band ===');
    const ob = window.eval(`
      (function(){
        obPickAvatar('tiger');
        const afterAvatar = { avatar: S.avatar, name: S.name, profileCount: S.profiles.length, activeProfile: S.activeProfile, obStep: S.ob.step };
        obPickAge(7);
        const afterAge = { age: S.age, obAge: S.ob.age };
        const expected = bandForAge(7).start;
        obFinishAge();
        return { afterAvatar, afterAge, expectedLevels: expected, actualLevels: { read:S.levels.read, write:S.levels.write, math:S.levels.math }, screenAfter: S.screen };
      })()
    `);
    console.log(JSON.stringify(ob, null, 2));
    check('picking an avatar sets S.avatar', ob.afterAvatar.avatar === 'tiger', JSON.stringify(ob.afterAvatar));
    check('picking an avatar sets S.name (no keyboard, the animal name in English)', ob.afterAvatar.name === 'Tiger', JSON.stringify(ob.afterAvatar));
    check('picking an avatar on a brand-new device actually creates a real, persisted profile', ob.afterAvatar.profileCount === 1 && ob.afterAvatar.activeProfile === 0, JSON.stringify(ob.afterAvatar));
    check('after the avatar, onboarding moves to the age step', ob.afterAvatar.obStep === 'age', JSON.stringify(ob.afterAvatar));
    check('picking a candle count sets S.age', ob.afterAge.age === 7, JSON.stringify(ob.afterAge));
    check("finishing onboarding seeds S.levels from the age band's own start values",
      ob.actualLevels.read === ob.expectedLevels.read && ob.actualLevels.write === ob.expectedLevels.write && ob.actualLevels.math === ob.expectedLevels.math,
      JSON.stringify({ expected: ob.expectedLevels, actual: ob.actualLevels }));
    check("onboarding routes onward correctly (no game yet → 'pick')", ob.screenAfter === 'pick', `screenAfter=${ob.screenAfter}`);

    console.log('\n=== the map renders exactly the places the age band allows ===');
    const mapDeveloping = window.eval(`
      (function(){
        S.game = 'cricket';
        go('map');
        const visible = mapVisible();
        const rendered = document.querySelectorAll('.jm-place').length;
        return {
          screen: S.screen,
          visibleIds: visible.map(p=>p.id),
          renderedCount: rendered,
          bandModules: band().modules
        };
      })()
    `);
    console.log(JSON.stringify(mapDeveloping, null, 2));
    check("choosing a game routes onward to 'map'", mapDeveloping.screen === 'map', `screen=${mapDeveloping.screen}`);
    check("age 7 (developing band, modules includes 'ask') shows all seven places, including Munni's Pond and the Picture Hut",
      mapDeveloping.visibleIds.length === 7 && mapDeveloping.visibleIds.includes('ask') && mapDeveloping.visibleIds.includes('theater'),
      JSON.stringify(mapDeveloping.visibleIds));
    check('the rendered DOM has exactly as many .jm-place buttons as mapVisible() returned',
      mapDeveloping.renderedCount === mapDeveloping.visibleIds.length, JSON.stringify(mapDeveloping));

    console.log('\n=== a younger band (no "ask" module) shows fewer places — not everything greyed out, actually absent ===');
    const mapPre = window.eval(`
      (function(){
        S.age = 4;   // 'pre' band: modules = ['read','write','count'], no 'ask'
        go('map');
        const visible = mapVisible();
        return {
          bandModules: band().modules,
          visibleIds: visible.map(p=>p.id),
          renderedCount: document.querySelectorAll('.jm-place').length,
          askButtonExists: !!Array.from(document.querySelectorAll('.jm-place')).find(el => el.getAttribute('onclick') === "mapGo('ask')")
        };
      })()
    `);
    console.log(JSON.stringify(mapPre, null, 2));
    check("the 'pre' band's own modules list genuinely excludes 'ask'", !mapPre.bandModules.includes('ask'), JSON.stringify(mapPre.bandModules));
    check("a 4-year-old's map has no Munni's Pond place at all (not shown disabled — genuinely absent)",
      !mapPre.visibleIds.includes('ask') && !mapPre.askButtonExists, JSON.stringify(mapPre));
    check("the 'pre' band still shows the other six places (read/write/math/story/play/theater all stay allowed)",
      mapPre.visibleIds.length === 6, JSON.stringify(mapPre.visibleIds));

    console.log("\n=== Munni stands at mapSuggestion() ===");
    const suggestion = window.eval(`
      (function(){
        S.age = 7; go('map');   // back to the full six-place board
        // make "write" clearly the furthest behind, so mapSuggestion() is unambiguous
        S.targets = { read:5, write:5, math:5, facts:3 };
        S.today   = { read:5, write:0, math:5, facts:3 };
        render();
        const sug = mapSuggestion();
        const munniEl = document.querySelector('.jm-munni');
        return {
          suggestedId: sug && sug.place.id, why: sug && sug.why,
          suggestedXY: sug && { x:sug.place.x, y:sug.place.y },
          munniExists: !!munniEl,
          munniLeft: munniEl && munniEl.style.left,
          munniTop: munniEl && munniEl.style.top
        };
      })()
    `);
    console.log(JSON.stringify(suggestion, null, 2));
    check('mapSuggestion() picks the module furthest from its daily target (write, 0% done)', suggestion.suggestedId === 'write', JSON.stringify(suggestion));
    check("Munni's marker is actually in the DOM once there is a suggestion", suggestion.munniExists === true, JSON.stringify(suggestion));
    check("Munni's marker sits at exactly mapSuggestion()'s own x/y",
      suggestion.munniLeft === `${suggestion.suggestedXY.x}%` && suggestion.munniTop === `${suggestion.suggestedXY.y}%`,
      JSON.stringify(suggestion));

    console.log('\n=== spaced repetition: a due item overrides the daily-target suggestion, invisibly ===');
    const srsOverride = window.eval(`
      (function(){
        S.age = 7; go('map');
        // 'write' would normally win (furthest behind daily target), but a
        // genuinely due 'read' item must win instead — see jungle-map.js's
        // mapSuggestion(), option (b): no new map place, spaced repetition
        // just wins the existing routing.
        S.targets = { read:5, write:5, math:5, facts:3 };
        S.today   = { read:5, write:0, math:5, facts:3 };
        S.srs = { 'read_l3_the cat sat': {
          id:'read_l3_the cat sat', mod:'read', content:'The cat sat.',
          step:2, attempts:2, correct:2, lastReview:Date.now()-1000, nextReview:Date.now()-1000
        }};
        render();
        const sug = mapSuggestion();
        return { suggestedId: sug && sug.place.id, why: sug && sug.why, dueCount: getDueSrsItems(S).length };
      })()
    `);
    console.log(JSON.stringify(srsOverride));
    check("a due read item overrides the daily-target suggestion — mapSuggestion() picks 'read', not 'write'",
      srsOverride.suggestedId === 'read' && srsOverride.dueCount === 1, JSON.stringify(srsOverride));

    console.log('\n=== the due item is genuinely the first sentence on the reading screen, not a fresh random pick ===');
    const srsFirstSentence = window.eval(`
      (function(){
        go('read');   // go() resets S.ctx — this is a fresh session, same as tapping the map place would give
        return { sentence: S.ctx.sentence, queueLeft: (S.ctx._srsQueue||[]).length };
      })()
    `);
    console.log(JSON.stringify(srsFirstSentence));
    check("the reading screen opens on the due item's own content, not a random sentence",
      srsFirstSentence.sentence === 'The cat sat.', JSON.stringify(srsFirstSentence));

    console.log('\n=== the map renders correctly with due items, with none, and with zero SRS history at all ===');
    const srsStates = window.eval(`
      (function(){
        function snapshot(){
          go('map');
          let threw = null;
          try { mapSuggestion(); } catch(e){ threw = e.message; }
          return {
            threw,
            placeCount: document.querySelectorAll('.jm-place').length,
            munniExists: !!document.querySelector('.jm-munni')
          };
        }
        const withDue = snapshot();   // S.srs still holds the due item from above

        S.srs = {};   // real SRS history, nothing currently due (all mastered / not yet time)
        const noDue = snapshot();

        delete S.srs;   // a child who has never triggered recordSrsItem() at all — the true zero-history case
        const noHistory = snapshot();

        return { withDue, noDue, noHistory };
      })()
    `);
    console.log(JSON.stringify(srsStates, null, 2));
    check('map renders (all 7 places, no throw) with a due SRS item present',
      srsStates.withDue.threw === null && srsStates.withDue.placeCount === 7, JSON.stringify(srsStates.withDue));
    check('map renders (all 7 places, no throw) with S.srs present but empty (nothing due)',
      srsStates.noDue.threw === null && srsStates.noDue.placeCount === 7, JSON.stringify(srsStates.noDue));
    check('map renders (all 7 places, no throw) for a child with no S.srs field at all — zero SRS history is not a broken state',
      srsStates.noHistory.threw === null && srsStates.noHistory.placeCount === 7, JSON.stringify(srsStates.noHistory));

    console.log('\n=== the parent dashboard REMEMBERED section: empty state and a real one, neither throws ===');
    const parentSrs = window.eval(`
      (function(){
        delete S.srs;
        go('parent');
        const emptyHtml = document.getElementById('screen').innerHTML;
        S.srs = {
          a: { id:'a', mod:'read', step:4, attempts:5, correct:5, lastReview:Date.now(), nextReview:Date.now()+9e8 },
          b: { id:'b', mod:'write', step:1, attempts:2, correct:1, lastReview:Date.now(), nextReview:Date.now()-1000 }
        };
        go('parent');
        const filledHtml = document.getElementById('screen').innerHTML;
        return {
          emptyLen: emptyHtml.length,
          emptyMentionsRemembered: emptyHtml.includes('REMEMBERED') || emptyHtml.includes('याद रहा'),
          filledLen: filledHtml.length,
          filledMentionsPct: filledHtml.includes('50%')
        };
      })()
    `);
    console.log(JSON.stringify(parentSrs));
    check('parent dashboard renders (non-trivial length) with zero SRS history', parentSrs.emptyLen > 500, JSON.stringify(parentSrs));
    check("parent dashboard's REMEMBERED section renders even with zero history (empty state, not missing)", parentSrs.emptyMentionsRemembered, JSON.stringify(parentSrs));
    check('parent dashboard renders correctly with real SRS stats — 1 of 2 mastered shows as 50%', parentSrs.filledMentionsPct, JSON.stringify(parentSrs));

    check('no uncaught script errors anywhere in this run', jsErrors.length === 0, jsErrors.join(' | '));

    console.log('\n' + '-'.repeat(70));
    checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
    console.log('-'.repeat(70));
    console.log(`${checks.length-failures}/${checks.length} checks passed`);
    server.close();
    process.exit(failures ? 1 : 0);
  });
});
