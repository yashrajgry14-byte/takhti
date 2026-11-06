/* ==================================================================
   RUNNER SHELL — "Run and Choose"

   Munni runs along the bottom of a stage in one of two lanes. A gate
   carrying two answers, one per lane, descends toward her. Whichever
   lane she is standing in when the gate arrives IS her answer — there
   is no separate submit button, because steering and answering are
   the same action. She is steered by tapping a stage half, by the two
   on-screen arrows, or by the left/right arrow keys.

   Three lives, shown as hearts. A wrong gate costs one life and the
   round keeps going — it does NOT end on the first miss. That matters:
   a child who is weak at the very skill this round is drilling will
   miss more often than a confident one, and instant death would eject
   exactly the child the round exists for, before the practice lands.
   The round ends only at zero lives or when the pool of items (built
   by game-core.js's gameStart()) runs out.

   Speed is tied to ACCURACY, not to how long the child survives: a
   correct gate quickens the next one a little, a miss eases off by
   more than that — kinder in the direction that matters — and both
   are clamped so the game never becomes unplayably fast or grinds to
   a crawl.

   Every gate resolves through the real, shared game-core.js functions
   (gameStart/gameCurrent/gameAnswer/gameEnd/gameSummary) — this file
   is a renderer and an input handler, not a second source of truth.
   runnerRecordAnswer() is deliberately the ONLY place that calls
   gameAnswer()/gameEnd(), kept free of any DOM access, so the whole
   "three misses end it, two don't" rule can be driven and verified
   headlessly, exactly like game-core.js's own functions are.
   ================================================================== */

const RN_LIVES      = 3;
const RN_BASE_MS    = 3000;   // a gate's fall time when the round starts
const RN_FLOOR_MS   = 1100;   // never faster than this — the hard floor
const RN_CEIL_MS    = 3600;   // never slower than this — a miss can't stall the game either
const RN_QUICKEN_MS = 140;    // a little faster on a correct gate
const RN_EASE_MS    = 260;    // eases off by MORE than it quickens — kind, on purpose

/* Module-local, closure-only render/input state. Deliberately never on S:
   nothing outside this file reads it, and it must not survive a profile
   switch or a save/load round-trip the way S.gameBest legitimately does.
   S.game_ (from game-core.js) stays the shared, inspectable "how is this
   round going" record; RN is purely this shell's own animation/steering
   bookkeeping. */
let RN = null;

/* A small local fallback for the same reason content/comprehension.js's
   own CL() exists: this file can load before ui/cards.js defines the
   real L(), and — for the headless tests below — may run with no UI
   files loaded at all. */
function rnL(o){
  if(typeof L === 'function') return L(o);
  return (o && (o[(typeof S!=='undefined'&&S.lang)||'en'] || o.en)) || '';
}
function rnMunniHTML(){
  return (typeof munniSmall === 'function') ? munniSmall() : '<div style="font-size:40px">🐘</div>';
}
function rnReducedMotion(){
  try{ return typeof window !== 'undefined' && window.matchMedia
    && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch(e){ return false; }
}

/* ==================================================================
   ROUND LOGIC — no DOM, no timers. This is the part the brief asks to
   be verified headlessly, and it is written so that is actually true.
   ================================================================== */

/* Sets up a fresh round: real gameStart('runner') plus this shell's own
   ephemeral lane/speed state. Safe to call again mid-round (e.g. "Play
   again") — it always starts clean. */
function runnerBegin(){
  runnerStop();                       // never leave a previous round's loop/listener running
  const g = gameStart('runner');
  g.lives = RN_LIVES;                 // shell-specific rule, kept on the shared round record
  RN = {
    lane: 0, rightLane: 0, text: [null, null],
    duration: RN_BASE_MS, gateStart: 0,
    raf: null, timer: null, keyHandler: null, attached: false,
    reduce: rnReducedMotion()
  };
  return g;
}

/* The one function that touches the real diagnostic pipeline. Pure
   round-state in, round-state out — a headless test can call this in a
   loop with no browser, no requestAnimationFrame, no DOM, exactly like
   game-core.js's own gameAnswer(). */
function runnerRecordAnswer(ok, picked){
  const g = S.game_;
  if(!g || g.kind !== 'runner' || g.over) return ok;

  gameAnswer(ok, picked);   // right/wrong, noteSkillAttempt() per tagged skill, the mistake it was; may itself end the round (pool exhausted)

  if(RN){
    RN.duration = ok
      ? Math.max(RN_FLOOR_MS, RN.duration - RN_QUICKEN_MS)
      : Math.min(RN_CEIL_MS,  RN.duration + RN_EASE_MS);
  }
  if(!ok){
    g.lives = Math.max(0, (g.lives || 0) - 1);
    if(g.lives <= 0 && !g.over) gameEnd();   // the rule this file adds on top of the shared core: zero lives ends it
  }
  return ok;
}

/* ==================================================================
   LIFECYCLE — cancelAnimationFrame / clearTimeout / removeEventListener,
   every time. Called from: views.js's go() (any screen change, including
   a mid-round quit), runnerFinish() (the round ending on its own), and
   the top of runnerBegin() (so "Play again" can never double up a loop).
   Idempotent — safe to call when nothing is running.
   ================================================================== */
function runnerStop(){
  if(RN){
    if(RN.raf != null) cancelAnimationFrame(RN.raf);
    if(RN.timer != null) clearTimeout(RN.timer);
    if(RN.keyHandler && typeof document !== 'undefined') document.removeEventListener('keydown', RN.keyHandler);
  }
  RN = null;
}
function runnerFinish(){
  runnerStop();
  if(typeof render === 'function') render();   // re-render on the SAME screen — VIEWS.runner() now shows the end card
}

/* ==================================================================
   INPUT — tap a stage half, tap an arrow button, or press an arrow key.
   All three call this. Steering and answering are the same action:
   this only ever moves Munni between lanes; the gate resolves itself
   on arrival (see runnerTick()/runnerResolve()).
   ================================================================== */
function runnerSteer(lane){
  if(!RN || !S.game_ || S.game_.over) return;
  RN.lane = lane;
  const m = typeof $ === 'function' ? $('rnMunni') : null;
  if(m){ m.classList.toggle('lane-1', lane===1); m.classList.toggle('lane-0', lane!==1); }
}

/* ==================================================================
   THE FALL — a gate spawns, descends, and resolves. Two paths:
   a normal requestAnimationFrame tick that moves it smoothly, or, under
   prefers-reduced-motion, a single setTimeout that keeps the same
   timing pressure without any continuous on-screen motion at all (the
   blanket `*{animation:none;transition:none}` rule in styles.css only
   catches CSS-driven motion — this loop writes to style.top directly,
   so it needs its own check).
   ================================================================== */
function runnerSpawnGate(){
  if(!RN) return;
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!it){ if(typeof gameEnd==='function') gameEnd(); runnerFinish(); return; }

  const w = it.wrong[Math.floor(Math.random() * it.wrong.length)];
  RN.rightLane = Math.random() < 0.5 ? 0 : 1;
  RN.text = [null, null];
  RN.text[RN.rightLane] = it.right;
  RN.text[1 - RN.rightLane] = w;

  const $$ = id => (typeof $ === 'function' ? $(id) : null);
  const o0 = $$('rnOpt0'), o1 = $$('rnOpt1'), pr = $$('rnPrompt'), gate = $$('rnGate');
  if(o0) o0.textContent = rnL(RN.text[0]);
  if(o1) o1.textContent = rnL(RN.text[1]);
  if(pr) pr.textContent = rnL(it.prompt);
  if(gate) gate.style.top = '0%';

  RN.gateStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  if(RN.reduce){
    RN.timer = setTimeout(runnerResolve, RN.duration);
  }else{
    RN.raf = requestAnimationFrame(runnerTick);
  }
}
function runnerTick(ts){
  if(!RN || !S.game_ || S.game_.over) return;
  const now = ts || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  const p = Math.min(1, (now - RN.gateStart) / RN.duration);
  const gate = typeof $ === 'function' ? $('rnGate') : null;
  if(gate) gate.style.top = (p * 78) + '%';   // 78%, not 100% — Munni stands a little above the very floor
  if(p >= 1){ runnerResolve(); return; }
  RN.raf = requestAnimationFrame(runnerTick);
}

/* Where a gate's arrival meets the shared game logic, plus the feedback
   a child actually sees/hears/feels. */
function runnerResolve(){
  if(!RN || !S.game_ || S.game_.over) return;
  const ok = RN.lane === RN.rightLane;
  runnerRecordAnswer(ok, RN.text && RN.text[RN.lane] ? RN.text[RN.lane].en : null);

  if(ok){
    runnerFlash('go');
    if(typeof trumpet === 'function') trumpet(1);
  }else{
    runnerFlash('bad');
    runnerBump();
    if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
  }

  if(S.game_ && S.game_.over){ runnerFinish(); return; }
  runnerSpawnGate();
}
function runnerFlash(kind){
  const el = typeof $ === 'function' ? $('rnFlash') : null;
  if(!el) return;
  el.classList.remove('go','bad');
  void el.offsetWidth;          // restart the CSS animation even if the same class fires twice in a row
  el.classList.add(kind);
}
function runnerBump(){
  const m = typeof $ === 'function' ? $('rnMunni') : null;
  if(!m) return;
  m.classList.remove('rn-bump');
  void m.offsetWidth;
  m.classList.add('rn-bump');
}

/* Wires the keyboard and spawns the first gate — called once per round,
   after the stage HTML actually exists in the DOM. Idempotent: a
   re-render that does not change screen (e.g. the language toggle,
   which calls render() directly rather than go()) must not double up
   the listener or start a second loop. */
function runnerAttachLive(){
  if(!RN || RN.attached) return;
  RN.attached = true;
  RN.keyHandler = e => {
    if(e.key === 'ArrowLeft') runnerSteer(0);
    else if(e.key === 'ArrowRight') runnerSteer(1);
  };
  if(typeof document !== 'undefined') document.addEventListener('keydown', RN.keyHandler);
  runnerSpawnGate();
}

/* ==================================================================
   RENDER — plain HTML strings, exactly like every other screen. The
   falling gate and Munni's lane are then animated by direct style/class
   writes above, not by re-rendering this every frame.
   ================================================================== */
function runnerStageHTML(g){
  const hearts = '❤️'.repeat(g.lives) + '🖤'.repeat(Math.max(0, RN_LIVES - g.lives));
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  return `
  <button class="back" onclick="go('games')">← ${S.lang==='hi'?'छोड़ो':'Quit'}</button>
  <div class="rn-hud">
    <div class="rn-hearts" aria-label="lives">${hearts}</div>
    <div class="rn-score">${g.right} / ${g.items.length}</div>
  </div>
  <div class="rn-prompt" id="rnPrompt">${it ? rnL(it.prompt) : ''}</div>
  <div class="rn-stage" id="rnStage">
    <div class="rn-lane" onclick="runnerSteer(0)" role="button" aria-label="left lane"></div>
    <div class="rn-lane" onclick="runnerSteer(1)" role="button" aria-label="right lane"></div>
    <div class="rn-gate" id="rnGate">
      <div class="rn-opt" id="rnOpt0">${it ? rnL(RN.text[0]) : ''}</div>
      <div class="rn-opt" id="rnOpt1">${it ? rnL(RN.text[1]) : ''}</div>
    </div>
    <div class="rn-floor"></div>
    <div class="rn-munni ${RN.lane===1?'lane-1':'lane-0'}" id="rnMunni">${rnMunniHTML()}</div>
    <div class="rn-flash" id="rnFlash"></div>
  </div>
  <div class="rn-controls">
    <button class="rn-arrow" onclick="runnerSteer(0)" aria-label="steer left">◀</button>
    <div class="muted" style="text-align:center;font-size:11.5px">${S.lang==='hi'
      ? 'साइड दबाओ, तीर दबाओ, या ←/→'
      : 'Tap a side, use the arrows, or ←/→'}</div>
    <button class="rn-arrow" onclick="runnerSteer(1)" aria-label="steer right">▶</button>
  </div>`;
}
function runnerEndHTML(g){
  const best = (S.gameBest || {}).runner || 0;
  const icon = g.newBest ? '⭐' : (g.right === g.items.length ? '🏆' : '🎯');
  return `
  <button class="back" onclick="go('games')">← ${t('back')}</button>
  <div class="card rn-end">
    <div style="font-size:44px">${icon}</div>
    <div class="display" style="font-size:20px;margin-top:6px">${gameSummary()}</div>
    <div class="muted" style="margin-top:4px">${S.lang==='hi'?'सबसे अच्छा':'Best'}: ${best}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" onclick="go('games')">${S.lang==='hi'?'शेल्फ़ पर वापस':'Back to shelf'}</button>
      <button class="btn" onclick="playGame('runner')">${S.lang==='hi'?'फिर खेलो':'Play again'}</button>
    </div>
  </div>`;
}

/* Registered onto the real VIEWS/AFTER objects (defined in ui/views.js
   and ui/opening.js) by name, guarded — this file loads well after both
   in index.html, but the guard also means it degrades harmlessly if
   ever loaded standalone (e.g. a future headless test of this file
   alone), matching content/literacy.js's own SKILLS/CONCEPTS guard. */
if(typeof VIEWS !== 'undefined') VIEWS.runner = function(){
  const g = S.game_;
  if(!g || g.kind !== 'runner') return '';   // playGame() always sets this up before go('runner')
  return g.over ? runnerEndHTML(g) : runnerStageHTML(g);
};
if(typeof AFTER !== 'undefined') AFTER.runner = function(){
  const g = S.game_;
  if(!g || g.kind !== 'runner' || g.over) return;   // the end card needs no live wiring
  runnerAttachLive();                                // idempotent — safe on a same-screen re-render too
};
