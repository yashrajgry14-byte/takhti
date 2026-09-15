/* ==================================================================
   ARCHER SHELL — "Find the Odd One"

   Four targets in an arc, one gameSets() entry per shot: draw back
   (press and hold — or, on a touchscreen, the same tap that starts a
   press and the one that ends it) and loose an arrow at the target
   that does not belong. No time pressure anywhere in this file — this
   shell is for working it out, not reacting, and the runner already
   covers reacting.

   After every shot, right or wrong, set.why is shown before the next
   one is offered. That sentence is not a nice-to-have here — it is
   the entire teaching moment for a reasoning game, and the round
   deliberately waits on it rather than auto-advancing past it.

   Three arrows to lose, tracked the same way every other shell's
   lives are (g.lives) — the label is just archery's own word for it.

   Framing note, project-wide: a bow, a target, an arrow — never a gun,
   never "shooting". Same mechanic either way; a principal reviewing a
   children's app reacts very differently to the two, and there is
   nothing to gain from the other framing.
   ================================================================== */

const ARCHER_LIVES = 3;

let AR = null;   // module-local aim/session state — never on S

function arL(o){
  // gameSets()' own option text (game-core.js's push()) is a plain,
  // single-language string on purpose — a rhyme or a matra word does
  // not have a translation, and a number is just a numeral — so unlike
  // a lesson's prompt/right/wrong text it is NOT a {en,hi} object. Only
  // set.why ever reaches here as one; L() only knows that shape, so a
  // plain string must pass straight through rather than being run
  // through it and coming back empty.
  if(typeof o === 'string') return o;
  if(typeof L === 'function') return L(o);
  return (o && (o[(typeof S!=='undefined'&&S.lang)||'en'] || o.en)) || '';
}

/* ==================================================================
   ROUND LOGIC — no DOM. The one function that touches gameAnswer()/
   gameEnd(). gameStart('archer') already draws SETS (GAME_SHELLS.archer
   has sets:true) — one set IS one shot, so no reshaping is needed here
   the way sort.js needs for its falling items.
   ================================================================== */
function archerBegin(){
  archerStop();
  const g = gameStart('archer');
  g.lives = ARCHER_LIVES;
  AR = { aiming: null, revealed: false, attached: false };
  return g;
}
function archerRecordAnswer(ok){
  const g = S.game_;
  if(!g || g.kind !== 'archer' || g.over) return ok;
  gameAnswer(ok);   // one call per set/shot, in order — the sets run out and end the round on their own, unmodified
  if(!ok){
    g.lives = Math.max(0, (g.lives || 0) - 1);
    if(g.lives <= 0 && !g.over) gameEnd();
  }
  return ok;
}

/* ==================================================================
   LIFECYCLE — nothing continuous runs here either (no timer, no rAF),
   but the hook is still wired into go() for the same reason every
   shell gets one.
   ================================================================== */
function archerStop(){ AR = null; }
function archerFinish(){
  archerStop();
  if(typeof render === 'function') render();
}

/* ==================================================================
   INPUT — draw back on pointerdown, loose the arrow on pointerup. A
   plain tap on a touchscreen is just a very quick press-and-release of
   the same target, so this one pair of handlers covers both stated
   interaction styles without two separate code paths.
   ================================================================== */
function archerDraw(idx){
  if(!AR || !S.game_ || S.game_.over || AR.revealed) return;
  AR.aiming = idx;
  const el = typeof $ === 'function' ? $('arT'+idx) : null;
  if(el) el.classList.add('ar-drawn');
}
function archerRelease(idx){
  if(!AR || !S.game_ || S.game_.over || AR.revealed) return;
  if(AR.aiming !== idx) return;   // released off-target — no shot
  archerShoot(idx);
}
function archerShoot(idx){
  const g = S.game_;
  if(!g || !AR) return;
  const set = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!set || !set.options[idx]) return;
  const ok = !!set.options[idx].odd;

  archerRecordAnswer(ok);
  if(ok && typeof trumpet === 'function') trumpet(1);
  if(!ok && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);

  AR.revealed = true;
  AR.lastOk = ok;
  AR.lastWhy = set.why;
  archerRenderReveal();
}
/* The child has read set.why — only now does the round move on. */
function archerNext(){
  if(!AR) return;
  if(S.game_ && S.game_.over){ archerFinish(); return; }
  AR.aiming = null; AR.revealed = false;
  archerSpawnShot();
}

/* ==================================================================
   RENDER
   ================================================================== */
function archerHudHTML(g){
  const arrows = '🏹'.repeat(g.lives) + '·'.repeat(Math.max(0, ARCHER_LIVES - g.lives));
  return `<div class="rn-hearts" aria-label="arrows left">${arrows}</div>
          <div class="rn-score">${g.right} / ${g.items.length}</div>`;
}
function archerSpawnShot(){
  if(!AR) return;
  const set = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!set){ if(typeof gameEnd==='function') gameEnd(); archerFinish(); return; }
  const $$ = id => (typeof $ === 'function' ? $(id) : null);
  const prompt = $$('arPrompt'), targets = $$('arTargets'), hud = $$('arHud'), reveal = $$('arReveal');
  if(prompt) prompt.textContent = arL(set.prompt);
  if(hud) hud.innerHTML = archerHudHTML(S.game_);
  if(reveal) reveal.innerHTML = '';
  if(targets) targets.innerHTML = set.options.map((o,i) =>
    `<button class="ar-target" id="arT${i}"
       onpointerdown="archerDraw(${i})" onpointerup="archerRelease(${i})"
       onmousedown="archerDraw(${i})" onmouseup="archerRelease(${i})">${arL(o.text)}</button>`
  ).join('');
}
function archerRenderReveal(){
  const reveal = typeof $ === 'function' ? $('arReveal') : null;
  const hud = typeof $ === 'function' ? $('arHud') : null;
  if(hud && S.game_) hud.innerHTML = archerHudHTML(S.game_);
  if(!reveal) return;
  reveal.innerHTML = `
    <div class="ar-why ${AR.lastOk?'ok':'bad'}">${AR.lastOk ? '🎯 ' : '↩️ '}${arL(AR.lastWhy)}</div>
    <button class="btn" style="margin-top:10px" onclick="archerNext()">${S.game_ && S.game_.over
      ? (S.lang==='hi'?'नतीजा देखो':'See result')
      : (S.lang==='hi'?'अगला तीर →':'Next arrow →')}</button>`;
}
function archerStageHTML(g){
  return `
  <button class="back" onclick="go('games')">← ${S.lang==='hi'?'छोड़ो':'Quit'}</button>
  <div class="rn-hud" id="arHud">${archerHudHTML(g)}</div>
  <div class="rn-prompt" id="arPrompt"></div>
  <div class="ar-range">
    <div class="ar-targets" id="arTargets"></div>
    <div class="ar-bow">🏹</div>
  </div>
  <div id="arReveal"></div>`;
}
function archerEndHTML(g){
  const best = (S.gameBest || {}).archer || 0;
  const icon = g.newBest ? '⭐' : (g.right === g.items.length ? '🏆' : '🎯');
  return `
  <button class="back" onclick="go('games')">← ${t('back')}</button>
  <div class="card rn-end">
    <div style="font-size:44px">${icon}</div>
    <div class="display" style="font-size:20px;margin-top:6px">${gameSummary()}</div>
    <div class="muted" style="margin-top:4px">${S.lang==='hi'?'सबसे अच्छा':'Best'}: ${best}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" onclick="go('games')">${S.lang==='hi'?'शेल्फ़ पर वापस':'Back to shelf'}</button>
      <button class="btn" onclick="playGame('archer')">${S.lang==='hi'?'फिर खेलो':'Play again'}</button>
    </div>
  </div>`;
}
if(typeof VIEWS !== 'undefined') VIEWS.archer = function(){
  const g = S.game_;
  if(!g || g.kind !== 'archer') return '';
  // The reveal after a shot is a targeted DOM update (archerRenderReveal()),
  // not a re-render through here — this only ever sees g.over once the
  // child has actually moved past the final reveal via archerNext().
  return g.over ? archerEndHTML(g) : archerStageHTML(g);
};
if(typeof AFTER !== 'undefined') AFTER.archer = function(){
  const g = S.game_;
  if(!g || g.kind !== 'archer') return;
  if(AR && !AR.attached){ AR.attached = true; archerSpawnShot(); }
  else if(AR && AR.revealed){ archerRenderReveal(); }   // a re-render (e.g. language toggle) mid-reveal keeps showing it
};
