/* ==================================================================
   TOWER SHELL — "Build the Tower"

   The deliberate counterweight to the runner: no timer anywhere in
   this file. A question sits at the top, three or four answer blocks
   wait below, and nothing moves until the child picks one. A fast,
   careless child does badly here — that is the point, not a bug — and
   a slow, careful one is rewarded with something visibly taller than
   where they started.

   Picking correctly drops a block onto the tower (a settling wobble,
   pure CSS, no JS-driven motion to speak of — see the reduced-motion
   note below). Picking wrong makes the tower lurch and removes its top
   block. The round ends at the item count (gameAnswer's own, unmodified
   end-of-pool behaviour) OR earlier if a tower that had actually been
   built collapses all the way back to zero — never on an empty tower's
   very first wrong guess, which would be a needlessly harsh reading of
   "the tower fell" for a game about care, not punishment.
   ================================================================== */

const TOWER_LEN = 12;   // matches GAME_SHELLS.tower.len

/* Module-local state — never on S, same reasoning as every other shell
   here. No raf/timer fields: there is nothing continuous to run, so
   there is nothing prefers-reduced-motion needs to intervene on in JS —
   the settle/lurch are ordinary CSS animations, already silenced by
   the blanket `*{animation:none}` rule for anyone who asked for less
   motion. */
let TW = null;

function twL(o){
  if(typeof L === 'function') return L(o);
  return (o && (o[(typeof S!=='undefined'&&S.lang)||'en'] || o.en)) || '';
}

/* ==================================================================
   ROUND LOGIC — no DOM. The one function that touches gameAnswer()/
   gameEnd().
   ================================================================== */
function towerBegin(){
  towerStop();
  const g = gameStart('tower', TOWER_LEN);
  TW = { height: 0, everBuilt: false, attached: false, correctIdx: -1, options: [] };
  return g;
}
function towerRecordAnswer(ok){
  const g = S.game_;
  if(!g || g.kind !== 'tower' || g.over) return ok;
  gameAnswer(ok);   // one call per question, in order — the pool runs out and ends the round on its own, unmodified
  if(TW){
    if(ok){ TW.height++; if(TW.height > 0) TW.everBuilt = true; }
    else   TW.height = Math.max(0, TW.height - 1);
  }
  // A tower that was never built cannot "fall" — this only fires for a
  // real collapse, not a cautious start.
  if(TW && TW.everBuilt && TW.height <= 0 && !g.over) gameEnd();
  return ok;
}

/* ==================================================================
   LIFECYCLE — nothing runs continuously here, but the hook stays wired
   into go() for the same reason every shell gets one: consistent, and
   future-proof if a timed variant is ever added.
   ================================================================== */
function towerStop(){ TW = null; }
function towerFinish(){
  towerStop();
  if(typeof render === 'function') render();
}

/* ==================================================================
   INPUT
   ================================================================== */
function towerPick(idx){
  const g = S.game_;
  if(!g || g.kind !== 'tower' || g.over || !TW) return;
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!it) return;
  const ok = idx === TW.correctIdx;
  towerRecordAnswer(ok);

  const stage = typeof $ === 'function' ? $('twTower') : null;
  if(ok){
    if(stage) stage.classList.add('tw-settle');
    if(typeof trumpet === 'function') trumpet(1);
  }else{
    if(stage) stage.classList.add('tw-lurch');
    if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
  }

  if(S.game_ && S.game_.over){ towerFinish(); return; }
  towerNextQuestion();
}

/* ==================================================================
   ROUND FLOW
   ================================================================== */
function towerNextQuestion(){
  if(!TW) return;
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!it){ if(typeof gameEnd==='function') gameEnd(); towerFinish(); return; }

  const shuffle = a => a.map(v => [Math.random(), v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  const opts = shuffle([{ text: it.right, ok:true }, ...it.wrong.map(w => ({ text:w, ok:false }))]);
  TW.correctIdx = opts.findIndex(o => o.ok);
  TW.options = opts;

  const q = typeof $ === 'function' ? $('twQuestion') : null;
  const opt = typeof $ === 'function' ? $('twOptions') : null;
  const hud = typeof $ === 'function' ? $('twHud') : null;
  if(q) q.textContent = twL(it.prompt);
  if(opt) opt.innerHTML = opts.map((o,i) =>
    `<button class="rn-opt tw-opt" onclick="towerPick(${i})">${twL(o.text)}</button>`).join('');
  if(hud) hud.innerHTML = towerHudHTML(S.game_);
  const stage = typeof $ === 'function' ? $('twTower') : null;
  if(stage) stage.innerHTML = towerBlocksHTML();
}

/* ==================================================================
   RENDER
   ================================================================== */
function towerHudHTML(g){
  return `<div class="rn-hearts" aria-label="height">🧱 × ${TW ? TW.height : 0}</div>
          <div class="rn-score">${g.right} / ${g.items.length}</div>`;
}
function towerBlocksHTML(){
  if(!TW) return '';
  return [...Array(TW.height)].map((_,i) =>
    `<div class="tw-block" style="animation-delay:${(i*0.02).toFixed(2)}s"></div>`).reverse().join('');
}
function towerStageHTML(g){
  return `
  <button class="back" onclick="go('games')">← ${S.lang==='hi'?'छोड़ो':'Quit'}</button>
  <div class="rn-hud" id="twHud">${towerHudHTML(g)}</div>
  <div class="rn-prompt" id="twQuestion"></div>
  <div class="tw-stage">
    <div class="tw-tower" id="twTower"></div>
    <div class="tw-ground"></div>
  </div>
  <div class="opts tw-options" id="twOptions" style="margin-top:12px"></div>`;
}
function towerEndHTML(g){
  const best = (S.gameBest || {}).tower || 0;
  const grew = TW && TW.height > 0;
  const icon = g.newBest ? '⭐' : (grew ? '🏗️' : '🎯');
  return `
  <button class="back" onclick="go('games')">← ${t('back')}</button>
  <div class="card rn-end">
    <div style="font-size:44px">${icon}</div>
    <div class="display" style="font-size:20px;margin-top:6px">${gameSummary()}</div>
    <div class="muted" style="margin-top:4px">${S.lang==='hi'?'मीनार की ऊँचाई':'Tower height'}: ${TW?TW.height:0} · ${S.lang==='hi'?'सबसे अच्छा':'Best'}: ${best}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" onclick="go('games')">${S.lang==='hi'?'शेल्फ़ पर वापस':'Back to shelf'}</button>
      <button class="btn" onclick="playGame('tower')">${S.lang==='hi'?'फिर खेलो':'Play again'}</button>
    </div>
  </div>`;
}
if(typeof VIEWS !== 'undefined') VIEWS.tower = function(){
  const g = S.game_;
  if(!g || g.kind !== 'tower') return '';
  return g.over ? towerEndHTML(g) : towerStageHTML(g);
};
if(typeof AFTER !== 'undefined') AFTER.tower = function(){
  const g = S.game_;
  if(!g || g.kind !== 'tower' || g.over) return;
  if(TW && !TW.attached){ TW.attached = true; towerNextQuestion(); }
};
