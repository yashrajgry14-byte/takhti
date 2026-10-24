/* ==================================================================
   SHELL INTEGRATION TEST — the real playGame() → go() → render() →
   AFTER.x() chain, in a real jsdom document loading the actual
   index.html/CSS/JS. This exists specifically because every other
   games test (games.test.js, runner.test.js, shells.test.js) drives
   each shell's xBegin()/xRecordAnswer() DIRECTLY, bypassing go()
   entirely — which is exactly how a real bug shipped: go()'s own
   blanket "stop every shell" cleanup was ALSO stopping the shell
   playGame() had just started, nulling its module state (RN/PP/TW/
   MTC/SR/AR) an instant after creation, so every AFTER hook's spawn
   call silently no-opped (each one already guards "no state, do
   nothing"). The HUD still rendered fine (it only reads S.game_,
   untouched by the bug) and gameStart() still logged correctly —
   which is exactly why "items are being drawn correctly" and "the
   stage is empty" could both be true at once.

   This test exists to make sure that class of bug — something that
   only shows up when the real navigation chain runs — cannot silently
   ship again. Top-level `const`/`let` in a classic script (state.js's
   `const S`, each shell's `let PP = null`, ...) do not become window
   properties (real JS spec, not a jsdom quirk), so this drives
   everything through window.eval(), the same global script scope
   index.html's own inline onclick handlers execute in.
   ================================================================== */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

let failures = 0;
const checks = [];
function check(name, pass, detail){
  checks.push({ name, pass, detail });
  if(!pass) failures++;
}

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const virtualConsole = new VirtualConsole();
const jsErrors = [];
virtualConsole.on('jsdomError', e => jsErrors.push(e.message));
virtualConsole.forwardTo(console);

const dom = new JSDOM(html, {
  virtualConsole,
  url: 'file://' + root.replace(/\\/g,'/') + '/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  beforeParse(window){
    window.speechSynthesis = {
      getVoices: () => [], speak: () => {}, cancel: () => {},
      addEventListener: () => {}, removeEventListener: () => {}
    };
    window.SpeechSynthesisUtterance = function(){};
    window.AudioContext = window.webkitAudioContext = undefined;
  }
});
const { window } = dom;
window.navigator.vibrate = () => {};

/* One entry per shell: the module-local render/timing state it owns
   (never on S — see each file's own header comment), and one DOM id
   that only exists once that state has actually been used to spawn
   real content, so "module state is live" and "the DOM was actually
   populated" are checked as two separate, both-necessary facts. */
const SHELLS = [
  { kind:'runner', moduleVar:'RN',  populatedCheck:`document.getElementById('rnGate') && document.getElementById('rnGate').style.top !== ''` },
  { kind:'pop',    moduleVar:'PP',  populatedCheck:`document.getElementById('ppStage').children.length > 0` },
  { kind:'tower',  moduleVar:'TW',  populatedCheck:`document.getElementById('twTower') !== null` },
  { kind:'match',  moduleVar:'MTC', populatedCheck:`document.getElementById('mtGrid').children.length === 12` },
  { kind:'sort',   moduleVar:'SR',  populatedCheck:`document.getElementById('srFallText').textContent.length > 0 && document.getElementById('srBinLeft').textContent.length > 0 && document.getElementById('srBinRight').textContent.length > 0` },
  { kind:'archer', moduleVar:'AR',  populatedCheck:`document.getElementById('arTargets').children.length === 4 && Array.from(document.getElementById('arTargets').children).every(c => c.textContent.length > 0)` }
];

window.addEventListener('load', () => {
  window.eval(`createProfile('TestChild'); S.age = 8; S.screen = 'map'; render();`);

  console.log('=== shell integration: real playGame() → go() → render() → AFTER.x() ===');
  for(const shell of SHELLS){
    const r = window.eval(`
      (function(){
        go('games');                 // start every shell from the same known screen
        playGame('${shell.kind}');
        return {
          screen: S.screen,
          gameKind: S.game_ && S.game_.kind,
          moduleState: (typeof ${shell.moduleVar} === 'undefined') ? 'undefined' : (${shell.moduleVar} === null ? 'null' : 'live'),
          populated: !!(${shell.populatedCheck})
        };
      })()
    `);
    console.log(`  [${shell.kind}]`, JSON.stringify(r));
    check(`${shell.kind}: entering via playGame() lands on the right screen with a live S.game_`,
      r.screen === shell.kind && r.gameKind === shell.kind, JSON.stringify(r));
    check(`${shell.kind}: its own module state (${shell.moduleVar}) is live, not nulled by go()'s cleanup`,
      r.moduleState === 'live', `moduleState=${r.moduleState}`);
    check(`${shell.kind}: the stage was actually populated (gate/bubbles/tower/cards/falling item/targets exist)`,
      r.populated === true, JSON.stringify(r));
  }

  console.log('\n=== gameStart() call count: exactly one per playGame() call ===');
  const startCount = window.eval(`
    (function(){
      go('games');
      let calls = 0;
      const real = gameStart;
      gameStart = function(kind, len){ calls++; return real(kind, len); };
      playGame('pop');
      gameStart = real;
      return calls;
    })()
  `);
  console.log('  gameStart() calls for one playGame("pop"):', startCount);
  check('gameStart() is called exactly once per playGame() call (not twice)', startCount === 1, `calls=${startCount}`);

  console.log('\n=== detail: runner\'s gate has a real position inside a real stage, in the light theme ===');
  const runnerDetail = window.eval(`
    (function(){
      go('games'); playGame('runner');
      return {
        gateTop: document.getElementById('rnGate').style.top,
        opt0: document.getElementById('rnOpt0').textContent,
        opt1: document.getElementById('rnOpt1').textContent
      };
    })()
  `);
  const rnStage = window.document.getElementById('rnStage');
  const stageHeight = rnStage ? window.getComputedStyle(rnStage).height : null;
  console.log('  gate top:', runnerDetail.gateTop, '· opt0:', runnerDetail.opt0, '· opt1:', runnerDetail.opt1, '· .rn-stage computed height:', stageHeight);
  const topPct = parseFloat(runnerDetail.gateTop);
  check("runner's gate has a numeric top offset within the stage's [0,100]% range on frame one",
    Number.isFinite(topPct) && topPct >= 0 && topPct <= 100, `gateTop=${runnerDetail.gateTop}`);
  check('runner\'s two answer options are both real, non-empty text (not placeholders)',
    !!runnerDetail.opt0 && !!runnerDetail.opt1, JSON.stringify(runnerDetail));
  check(".rn-stage has a non-zero computed height in the app's actual default (light) theme",
    stageHeight != null && parseFloat(stageHeight) > 0, `height=${stageHeight}`);

  check('no uncaught script errors during boot or any playGame() call', jsErrors.length === 0, jsErrors.join(' | '));

  console.log('\n' + '-'.repeat(70));
  checks.forEach(c => console.log(`  ${c.pass?'PASS':'FAIL'}  ${c.name}${c.pass?'':'  → '+c.detail}`));
  console.log('-'.repeat(70));
  console.log(`${checks.length-failures}/${checks.length} checks passed`);

  process.exitCode = failures ? 1 : 0;
  dom.window.close();   // stops the app's own timers (e.g. the hourly class-sync check) so the process can exit
});
