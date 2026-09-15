/* ==================================================================
   POP SHELL — "Pop the Right One"

   A rule sits at the top ("Tap the one that makes 12"). Bubbles carry
   candidate answers upward — one right, the rest wrong, three or four
   on screen at once, drawn straight from one gameItems() pool item's
   own right/wrong options. This is a SPOTTING game, not a deciding
   one: the child scans, not deliberates.

   Three lives. Three ways to lose one:
     · tap a wrong bubble        — it greys out, inert, the wave goes on
     · let the right bubble rise off the top without tapping it — a miss
     · (either of the above, at zero lives) ends the round
   The escape penalty is deliberate and is what makes this a spotting
   game rather than a deciding one: sitting still and reading carefully
   is exactly as risky here as guessing wrong, because the bubble does
   not wait.

   One gameAnswer() call per wave (per pool item) — exactly once,
   whether the wave resolves by a correct tap, an escape, or lives
   running out mid-wave — via popRecordAnswer(), the only function here
   that touches it. Wrong-bubble taps cost a life through popWrongTap()
   without resolving the wave themselves, keeping that "once per item"
   count honest even though the child may tap several bubbles in one
   wave.
   ================================================================== */

const POP_LIVES      = 3;
const POP_LEN        = 16;    // matches GAME_SHELLS.pop.len
const POP_BASE_MS    = 3400;  // time for the correct bubble to cross the stage
const POP_FLOOR_MS   = 1300;
const POP_CEIL_MS    = 4200;
const POP_QUICKEN_MS = 130;
const POP_EASE_MS    = 240;

/* Module-local render/timing state — never on S, exactly like
   src/games/runner.js's RN. */
let PP = null;

function ppL(o){
  if(typeof L === 'function') return L(o);
  return (o && (o[(typeof S!=='undefined'&&S.lang)||'en'] || o.en)) || '';
}
function ppReducedMotion(){
  try{ return typeof window !== 'undefined' && window.matchMedia
    && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch(e){ return false; }
}

/* ==================================================================
   ROUND LOGIC — no DOM. popRecordAnswer() is the only function that
   calls gameAnswer()/gameEnd(); popWrongTap() only ever reaches them
   through it, on the one path (lives hit zero mid-wave) where the
   in-progress wave must still be accounted for exactly once.
   ================================================================== */
function popBegin(){
  popStop();
  const g = gameStart('pop', POP_LEN);
  g.lives = POP_LIVES;
  PP = {
    duration: POP_BASE_MS, waveStart: 0, bubbles: [],
    raf: null, timer: null, attached: false, reduce: ppReducedMotion()
  };
  return g;
}
function popRecordAnswer(ok){
  const g = S.game_;
  if(!g || g.kind !== 'pop' || g.over) return ok;
  gameAnswer(ok);
  if(PP){
    PP.duration = ok
      ? Math.max(POP_FLOOR_MS, PP.duration - POP_QUICKEN_MS)
      : Math.min(POP_CEIL_MS,  PP.duration + POP_EASE_MS);
  }
  if(!ok){
    g.lives = Math.max(0, (g.lives || 0) - 1);
    if(g.lives <= 0 && !g.over) gameEnd();
  }
  return ok;
}
/* A wrong bubble, tapped mid-wave: a life is spent, but the wave itself
   is not resolved by it — the right bubble may still be tapped, or may
   still escape. Only if this tap empties the last life does the
   in-progress wave get closed out (as a miss, exactly once). */
function popWrongTap(){
  const g = S.game_;
  if(!g || g.kind !== 'pop' || g.over) return;
  g.lives = Math.max(0, (g.lives || 0) - 1);
  if(g.lives <= 0 && !g.over) popRecordAnswer(false);
}

/* ==================================================================
   LIFECYCLE
   ================================================================== */
function popStop(){
  if(PP){
    if(PP.raf != null) cancelAnimationFrame(PP.raf);
    if(PP.timer != null) clearTimeout(PP.timer);
  }
  PP = null;
}
function popFinish(){
  popStop();
  if(typeof render === 'function') render();
}

/* ==================================================================
   THE WAVE — bubbles rise; the correct one escaping (reaching the top
   untapped) is a miss, exactly like a runner gate arriving unanswered
   would be. Reduced motion swaps the rAF climb for one timed step, same
   reasoning as runner.js: the loop writes style.top directly, so the
   blanket CSS motion rule can't catch it on its own.
   ================================================================== */
function popSpawnWave(){
  if(!PP) return;
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!it){ if(typeof gameEnd==='function') gameEnd(); popFinish(); return; }

  const shuffle = a => a.map(v => [Math.random(), v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  const bubbles = shuffle([
    { id:'r', ok:true,  text: it.right },
    ...it.wrong.map((w,i) => ({ id:'w'+i, ok:false, text: w }))
  ]).map((b,i) => ({ ...b, slot:i, tapped:false }));
  PP.bubbles = bubbles;
  PP.waveStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  popRenderWave();
  if(PP.reduce){
    PP.timer = setTimeout(popResolveEscape, PP.duration);
  }else{
    PP.raf = requestAnimationFrame(popTick);
  }
}
function popTick(ts){
  if(!PP || !S.game_ || S.game_.over) return;
  const now = ts || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  const p = Math.min(1, (now - PP.waveStart) / PP.duration);
  const $$ = id => (typeof $ === 'function' ? $(id) : null);
  for(const b of PP.bubbles){
    if(b.tapped) continue;
    const el = $$('ppB' + b.slot);
    if(el) el.style.bottom = (p * 84) + '%';
  }
  if(p >= 1){ popResolveEscape(); return; }
  PP.raf = requestAnimationFrame(popTick);
}
/* The right bubble reached the top untapped — a miss, and the only way
   a wave resolves without the child touching anything at all. */
function popResolveEscape(){
  if(!PP || !S.game_ || S.game_.over) return;
  const right = PP.bubbles.find(b => b.ok);
  if(right && !right.tapped){
    right.tapped = true;
    popRecordAnswer(false);
  }
  if(S.game_ && S.game_.over){ popFinish(); return; }
  popSpawnWave();
}
function popTapBubble(slot){
  if(!PP || !S.game_ || S.game_.over) return;
  const b = PP.bubbles.find(x => x.slot === slot);
  if(!b || b.tapped) return;
  b.tapped = true;

  const el = typeof $ === 'function' ? $('ppB'+slot) : null;

  if(b.ok){
    if(el) el.classList.add('pp-pop');
    if(PP.raf != null) cancelAnimationFrame(PP.raf);
    if(PP.timer != null) clearTimeout(PP.timer);
    popRecordAnswer(true);
    if(typeof trumpet === 'function') trumpet(1);
    if(S.game_ && S.game_.over){ popFinish(); return; }
    popSpawnWave();
  }else{
    if(el) el.classList.add('pp-grey');
    if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
    popWrongTap();
    if(S.game_ && S.game_.over){ popFinish(); return; }
    // the wave continues — just re-render the hearts/score, bubble stays greyed
    const hud = typeof $ === 'function' ? $('ppHud') : null;
    if(hud) hud.innerHTML = popHudHTML(S.game_);
  }
}

/* ==================================================================
   RENDER
   ================================================================== */
function popHudHTML(g){
  const hearts = '❤️'.repeat(g.lives) + '🖤'.repeat(Math.max(0, POP_LIVES - g.lives));
  return `<div class="rn-hearts" aria-label="lives">${hearts}</div>
          <div class="rn-score">${g.right} / ${g.items.length}</div>`;
}
function popRenderWave(){
  const stage = typeof $ === 'function' ? $('ppStage') : null;
  if(!stage) return;
  stage.innerHTML = PP.bubbles.map(b =>
    `<div class="pp-bubble" id="ppB${b.slot}" style="left:${(b.slot+0.5)*(100/PP.bubbles.length)}%;bottom:0%"
      onclick="popTapBubble(${b.slot})">${ppL(b.text)}</div>`
  ).join('');
}
function popStageHTML(g){
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  return `
  <button class="back" onclick="go('games')">← ${S.lang==='hi'?'छोड़ो':'Quit'}</button>
  <div class="rn-hud" id="ppHud">${popHudHTML(g)}</div>
  <div class="rn-prompt">${it ? ppL(it.prompt) : ''}</div>
  <div class="pp-stage" id="ppStage"></div>`;
}
function popEndHTML(g){
  const best = (S.gameBest || {}).pop || 0;
  const icon = g.newBest ? '⭐' : (g.right === g.items.length ? '🏆' : '🎯');
  return `
  <button class="back" onclick="go('games')">← ${t('back')}</button>
  <div class="card rn-end">
    <div style="font-size:44px">${icon}</div>
    <div class="display" style="font-size:20px;margin-top:6px">${gameSummary()}</div>
    <div class="muted" style="margin-top:4px">${S.lang==='hi'?'सबसे अच्छा':'Best'}: ${best}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" onclick="go('games')">${S.lang==='hi'?'शेल्फ़ पर वापस':'Back to shelf'}</button>
      <button class="btn" onclick="playGame('pop')">${S.lang==='hi'?'फिर खेलो':'Play again'}</button>
    </div>
  </div>`;
}
if(typeof VIEWS !== 'undefined') VIEWS.pop = function(){
  const g = S.game_;
  if(!g || g.kind !== 'pop') return '';
  return g.over ? popEndHTML(g) : popStageHTML(g);
};
if(typeof AFTER !== 'undefined') AFTER.pop = function(){
  const g = S.game_;
  if(!g || g.kind !== 'pop' || g.over) return;
  if(!PP || !PP.attached){
    if(PP) PP.attached = true;
    popSpawnWave();
  }
};
