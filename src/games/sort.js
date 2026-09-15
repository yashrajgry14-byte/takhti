/* ==================================================================
   SORT SHELL — "Sort it Fast"

   Two labelled bins at the bottom; one item falls at a time; tap left
   or right to send it. The rounds come from gameSets() — the exact
   "three fit a rule, one does not" shape a 2-bin sort already is — with
   each set's four options flattened into four individually-falling
   items and the bin labels for that stretch of the fall derived from
   that set's own set.why (split on its first sentence break: the
   "fits" clause labels one bin, the "does not" clause the other, and
   which physical side is which is re-randomised every set so the
   rule, not the side, is what has to be read).

   This is the shell where hesitation itself costs: an item that
   reaches the floor undecided is a miss, exactly like an unanswered
   runner gate or an escaped pop bubble. Three lives; falling speed
   follows accuracy the same way the runner's gate does.
   ================================================================== */

const SORT_LIVES      = 3;
const SORT_SETS       = 5;    // 5 sets × 4 options = 20 falling items
const SORT_BASE_MS    = 2600;
const SORT_FLOOR_MS   = 1000;
const SORT_CEIL_MS    = 3200;
const SORT_QUICKEN_MS = 120;
const SORT_EASE_MS    = 220;

let SR = null;   // module-local render/timing state — never on S

function srL(o){
  // gameSets()' own option text (game-core.js's push()) is a plain,
  // single-language string on purpose — a rhyme or a matra word does
  // not have a translation, and a number is just a numeral — so it is
  // NOT bilingual like a lesson's prompt/right/wrong text is. Only the
  // bin labels (derived from set.why, itself bilingual) and why text
  // ever reach here as {en,hi} objects; L() only knows that second
  // shape, so a plain string must pass straight through rather than
  // being run through it and coming back empty.
  if(typeof o === 'string') return o;
  if(typeof L === 'function') return L(o);
  return (o && (o[(typeof S!=='undefined'&&S.lang)||'en'] || o.en)) || '';
}
function srReducedMotion(){
  try{ return typeof window !== 'undefined' && window.matchMedia
    && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch(e){ return false; }
}

/* A set's why is always exactly two sentences (see game-core.js's
   gameSets(): every push() builds it as "<group clause>. <odd clause>."
   in English, "...। ...।" in Hindi) — split on the first sentence break
   for each language, with a same-string fallback if a why is ever
   shaped differently than expected. */
function sortBinLabels(why){
  const clean = s => String(s||'').replace(/[.।]\s*$/,'').trim();
  const splitOn = (s, sep) => {
    const parts = String(s||'').split(sep);
    return parts.length >= 2
      ? [clean(parts[0]), clean(parts.slice(1).join(sep))]
      : [clean(s), clean(s)];
  };
  const en = splitOn(why && why.en, '. ');
  const hi = splitOn(why && why.hi, '। ');
  return { fits:{en:en[0], hi:hi[0]}, odd:{en:en[1], hi:hi[1]} };
}

/* Reshapes gameSets()'s real output into one falling item per option —
   a presentation-grain change, not a reimplementation of gameSets()
   itself. match.js does the analogous thing to gameItems()'s output
   (building card pairs); this is the same idea applied to a set. */
function sortFlatten(sets){
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  const out = [];
  for(const set of sets){
    const labels = sortBinLabels(set.why);
    const fitsLeft = Math.random() < 0.5;
    for(const opt of shuffle(set.options)){
      out.push({
        text: opt.text, odd: opt.odd,
        band: set.band, strand: set.strand, skills: set.skills, why: set.why,
        leftLabel:  fitsLeft ? labels.fits : labels.odd,
        rightLabel: fitsLeft ? labels.odd  : labels.fits,
        correctBin: opt.odd ? (fitsLeft ? 'right' : 'left') : (fitsLeft ? 'left' : 'right')
      });
    }
  }
  return out;
}

/* ==================================================================
   ROUND LOGIC — no DOM.
   ================================================================== */
function sortBegin(){
  sortStop();
  const g = gameStart('sort', SORT_SETS);   // GAME_SHELLS.sort has sets:true — g.items currently = SETS
  g.items = sortFlatten(g.items);           // reshaped to one falling item per array slot
  g.lives = SORT_LIVES;
  SR = { duration: SORT_BASE_MS, fallStart: 0, raf: null, timer: null, attached: false, reduce: srReducedMotion() };
  return g;
}
function sortRecordAnswer(ok){
  const g = S.game_;
  if(!g || g.kind !== 'sort' || g.over) return ok;
  gameAnswer(ok);
  if(SR){
    SR.duration = ok
      ? Math.max(SORT_FLOOR_MS, SR.duration - SORT_QUICKEN_MS)
      : Math.min(SORT_CEIL_MS,  SR.duration + SORT_EASE_MS);
  }
  if(!ok){
    g.lives = Math.max(0, (g.lives || 0) - 1);
    if(g.lives <= 0 && !g.over) gameEnd();
  }
  return ok;
}

/* ==================================================================
   LIFECYCLE
   ================================================================== */
function sortStop(){
  if(SR){
    if(SR.raf != null) cancelAnimationFrame(SR.raf);
    if(SR.timer != null) clearTimeout(SR.timer);
  }
  SR = null;
}
function sortFinish(){
  sortStop();
  if(typeof render === 'function') render();
}

/* ==================================================================
   THE FALL — reduced motion swaps the per-frame climb for one timed
   step, same reasoning as every other falling/rising shell here: this
   loop writes style.top directly, so the blanket CSS rule can't help.
   ================================================================== */
function sortSpawnFall(){
  if(!SR) return;
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!it){ if(typeof gameEnd==='function') gameEnd(); sortFinish(); return; }

  const $$ = id => (typeof $ === 'function' ? $(id) : null);
  const el = $$('srFalling'), txt = $$('srFallText'), lb = $$('srBinLeft'), rb = $$('srBinRight');
  if(el) el.style.top = '0%';
  if(txt) txt.textContent = srL(it.text);
  if(lb) lb.textContent = srL(it.leftLabel);
  if(rb) rb.textContent = srL(it.rightLabel);

  SR.fallStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if(SR.reduce){
    SR.timer = setTimeout(sortResolveMiss, SR.duration);
  }else{
    SR.raf = requestAnimationFrame(sortTick);
  }
}
function sortTick(ts){
  if(!SR || !S.game_ || S.game_.over) return;
  const now = ts || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  const p = Math.min(1, (now - SR.fallStart) / SR.duration);
  const el = typeof $ === 'function' ? $('srFalling') : null;
  if(el) el.style.top = (p * 74) + '%';
  if(p >= 1){ sortResolveMiss(); return; }
  SR.raf = requestAnimationFrame(sortTick);
}
function sortResolveMiss(){
  if(!SR || !S.game_ || S.game_.over) return;
  sortRecordAnswer(false);
  if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
  if(S.game_ && S.game_.over){ sortFinish(); return; }
  sortSpawnFall();
}
function sortPickBin(side){
  if(!SR || !S.game_ || S.game_.over) return;
  const it = (typeof gameCurrent === 'function') ? gameCurrent() : null;
  if(!it) return;
  if(SR.raf != null) cancelAnimationFrame(SR.raf);
  if(SR.timer != null) clearTimeout(SR.timer);

  const ok = side === it.correctBin;
  sortRecordAnswer(ok);
  if(ok && typeof trumpet === 'function') trumpet(1);
  if(!ok && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);

  if(S.game_ && S.game_.over){ sortFinish(); return; }
  sortSpawnFall();
}

/* ==================================================================
   RENDER
   ================================================================== */
function sortHudHTML(g){
  const hearts = '❤️'.repeat(g.lives) + '🖤'.repeat(Math.max(0, SORT_LIVES - g.lives));
  return `<div class="rn-hearts" aria-label="lives">${hearts}</div>
          <div class="rn-score">${g.right} / ${g.items.length}</div>`;
}
function sortStageHTML(g){
  return `
  <button class="back" onclick="go('games')">← ${S.lang==='hi'?'छोड़ो':'Quit'}</button>
  <div class="rn-hud">${sortHudHTML(g)}</div>
  <div class="sr-stage">
    <div class="sr-falling" id="srFalling"><span id="srFallText"></span></div>
    <div class="sr-floor"></div>
  </div>
  <div class="sr-bins">
    <button class="sr-bin" id="srBinLeft" onclick="sortPickBin('left')"></button>
    <button class="sr-bin" id="srBinRight" onclick="sortPickBin('right')"></button>
  </div>`;
}
function sortEndHTML(g){
  const best = (S.gameBest || {}).sort || 0;
  const icon = g.newBest ? '⭐' : (g.right === g.items.length ? '🏆' : '🎯');
  return `
  <button class="back" onclick="go('games')">← ${t('back')}</button>
  <div class="card rn-end">
    <div style="font-size:44px">${icon}</div>
    <div class="display" style="font-size:20px;margin-top:6px">${gameSummary()}</div>
    <div class="muted" style="margin-top:4px">${S.lang==='hi'?'सबसे अच्छा':'Best'}: ${best}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" onclick="go('games')">${S.lang==='hi'?'शेल्फ़ पर वापस':'Back to shelf'}</button>
      <button class="btn" onclick="playGame('sort')">${S.lang==='hi'?'फिर खेलो':'Play again'}</button>
    </div>
  </div>`;
}
if(typeof VIEWS !== 'undefined') VIEWS.sort = function(){
  const g = S.game_;
  if(!g || g.kind !== 'sort') return '';
  return g.over ? sortEndHTML(g) : sortStageHTML(g);
};
if(typeof AFTER !== 'undefined') AFTER.sort = function(){
  const g = S.game_;
  if(!g || g.kind !== 'sort' || g.over) return;
  if(SR && !SR.attached){ SR.attached = true; sortSpawnFall(); }
};
