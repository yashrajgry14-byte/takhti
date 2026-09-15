/* ==================================================================
   MATCH SHELL — "Find the Pairs"

   Six pairs, twelve face-down cards. A pair is one pool item's own
   `.prompt` and `.right` — "3 × 4" matches "12", a matra card matches
   the word carrying it — so every pair is a real, validated fact, not
   an arbitrary picture-matching gimmick. Capped at six pairs on
   purpose: twelve cards is already at the edge of what a six-year-old
   can hold in working memory, and going further turns a memory game
   into a frustration game.

   No lives, no round timer — the score is how few moves it takes, and
   a slow, careful child scores exactly as well as a fast one.

   A match calls gameAnswer(true) once; a mismatch calls gameAnswer
   (false) once — never once per card, which is why matchFlip() only
   ever calls matchRecordAttempt() at the moment a SECOND card completes
   a comparison, not when either card is individually turned over.

   Two real wrinkles, both worth stating plainly rather than papering
   over:

   1. gameAnswer()'s own end-of-round check (`g.i >= g.items.length`)
      assumes items are consumed in a fixed sequence, but a memory game
      is solved in whatever order the child flips cards.
      matchRecordAttempt() resolves this without touching gameAnswer()
      itself: a genuine match lets g.i advance by one (as gameAnswer()
      already does on its own); a mismatch's advance is immediately
      given back, netting zero. So g.i is, at every moment, exactly
      "how many of the six pairs have been found" — and it reaches six,
      ending the round through gameAnswer()'s own real check, at
      precisely the moment the board is solved, in ANY order.

   2. gameEnd()'s own "new best" logic compares g.right against the
      previous S.gameBest[kind], on the assumption that a HIGHER right
      count is the win condition. For match, g.right is always exactly
      6 the moment a round completes (all six pairs get found, always),
      so that comparison can only ever register a "best" once, on the
      very first completed round, and never again — completely missing
      "the score is how few moves it takes." gameEnd() still runs
      untouched (S.gameBest.match keeps whatever meaning it has), but
      the shell tracks its OWN, lower-is-better record under the
      separate key S.gameBest.matchMoves, computed once the round is
      genuinely over, rather than pretending gameEnd()'s number means
      something it does not. */

const MATCH_PAIRS = 6;
const MATCH_FLIP_BACK_MS = 850;   // how long a mismatch stays face-up before turning back

/* Module-local board/session state — never on S. g.moves (on the real
   round record) is the score that outlives this being cleared to null
   at the end of a round, exactly so the end card can still show it. */
let MTC = null;

function mtL(o){
  if(typeof L === 'function') return L(o);
  return (o && (o[(typeof S!=='undefined'&&S.lang)||'en'] || o.en)) || '';
}

/* ==================================================================
   ROUND LOGIC — no DOM. matchRecordAttempt() is the only function
   here that touches gameAnswer(); nothing calls gameEnd() directly —
   the six-pairs invariant above lets the real, unmodified gameAnswer()
   end the round itself, exactly like a non-memory shell would.
   ================================================================== */
function matchBegin(){
  matchStop();
  const g = gameStart('match', MATCH_PAIRS);
  g.moves = 0;
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
  const cards = [];
  g.items.forEach((it, idx) => {
    cards.push({ itemIndex: idx, side:'prompt', text: it.prompt, matched:false });
    cards.push({ itemIndex: idx, side:'right',  text: it.right,  matched:false });
  });
  MTC = { board: shuffle(cards), flipped: [], busy: false, timer: null, attached: false };
  return g;
}
function matchRecordAttempt(ok){
  const g = S.game_;
  if(!g || g.kind !== 'match' || g.over) return ok;
  g.moves = (g.moves || 0) + 1;
  gameAnswer(ok);
  if(!ok) g.i = Math.max(0, g.i - 1);   // give back the advance — only a found pair should move g.i toward g.items.length
  if(g.over){
    // the round just genuinely completed (see wrinkle 2 above) — record
    // the shell's own, real scoring metric before anything clears it.
    S.gameBest = S.gameBest || {};
    const prev = S.gameBest.matchMoves;
    g.newMovesBest = (prev == null || g.moves < prev);
    if(g.newMovesBest) S.gameBest.matchMoves = g.moves;
  }
  return ok;
}

/* ==================================================================
   LIFECYCLE
   ================================================================== */
function matchStop(){
  if(MTC && MTC.timer != null) clearTimeout(MTC.timer);
  MTC = null;
}
function matchFinish(){
  matchStop();
  if(typeof render === 'function') render();
}

/* ==================================================================
   INPUT — flip a card by board position. The comparison, and the one
   gameAnswer() call it produces, happens only once two cards are face
   up at the same time.
   ================================================================== */
function matchFlip(pos){
  const g = S.game_;
  if(!g || g.kind !== 'match' || g.over || !MTC || MTC.busy) return;
  const card = MTC.board[pos];
  if(!card || card.matched || MTC.flipped.includes(pos)) return;

  MTC.flipped.push(pos);
  matchRenderCard(pos);
  if(MTC.flipped.length < 2) return;

  const [p1, p2] = MTC.flipped;
  const c1 = MTC.board[p1], c2 = MTC.board[p2];
  const isMatch = c1.itemIndex === c2.itemIndex;

  if(isMatch){
    c1.matched = true; c2.matched = true;
    MTC.flipped = [];
    matchRecordAttempt(true);
    if(typeof trumpet === 'function') trumpet(1);
    matchRenderCard(p1); matchRenderCard(p2);
    matchUpdateHud();
    if(S.game_ && S.game_.over){ matchFinish(); return; }
  }else{
    MTC.busy = true;
    matchRecordAttempt(false);
    if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(60);
    matchUpdateHud();
    MTC.timer = setTimeout(() => {
      MTC.busy = false;
      MTC.flipped = [];
      matchRenderCard(p1); matchRenderCard(p2);
    }, MATCH_FLIP_BACK_MS);
  }
}

/* ==================================================================
   RENDER
   ================================================================== */
function matchUpdateHud(){
  const hud = typeof $ === 'function' ? $('mtHud') : null;
  if(hud && S.game_) hud.innerHTML = matchHudHTML(S.game_);
}
function matchHudHTML(g){
  return `<div class="rn-hearts" aria-label="pairs found">🃏 ${g.i} / ${MATCH_PAIRS}</div>
          <div class="rn-score">${g.moves||0} ${S.lang==='hi'?'चालें':'moves'}</div>`;
}
function matchRenderCard(pos){
  const el = typeof $ === 'function' ? $('mtC'+pos) : null;
  if(!el || !MTC) return;
  const card = MTC.board[pos];
  const faceUp = card.matched || MTC.flipped.includes(pos);
  el.className = 'mt-card' + (faceUp ? ' up' : '') + (card.matched ? ' matched' : '');
  el.textContent = faceUp ? mtL(card.text) : '';
}
function matchStageHTML(g){
  return `
  <button class="back" onclick="go('games')">← ${S.lang==='hi'?'छोड़ो':'Quit'}</button>
  <div class="rn-hud" id="mtHud">${matchHudHTML(g)}</div>
  <div class="mt-grid" id="mtGrid">
    ${MTC.board.map((c,i) => `<button class="mt-card" id="mtC${i}" onclick="matchFlip(${i})"></button>`).join('')}
  </div>`;
}
function matchEndHTML(g){
  const best = (S.gameBest || {}).matchMoves;
  const icon = g.newMovesBest ? '⭐' : '🃏';
  return `
  <button class="back" onclick="go('games')">← ${t('back')}</button>
  <div class="card rn-end">
    <div style="font-size:44px">${icon}</div>
    <div class="display" style="font-size:20px;margin-top:6px">${S.lang==='hi'
      ? `सब जोड़े मिल गए — ${g.moves} चालों में!`
      : `All six pairs found — in ${g.moves} moves!`}</div>
    <div class="muted" style="margin-top:4px">${S.lang==='hi'?'सबसे कम चालें':'Fewest moves so far'}: ${best!=null?best:'—'}</div>
    <div class="row" style="margin-top:16px">
      <button class="btn ghost" onclick="go('games')">${S.lang==='hi'?'शेल्फ़ पर वापस':'Back to shelf'}</button>
      <button class="btn" onclick="playGame('match')">${S.lang==='hi'?'फिर खेलो':'Play again'}</button>
    </div>
  </div>`;
}
if(typeof VIEWS !== 'undefined') VIEWS.match = function(){
  const g = S.game_;
  if(!g || g.kind !== 'match') return '';
  return g.over ? matchEndHTML(g) : matchStageHTML(g);
};
if(typeof AFTER !== 'undefined') AFTER.match = function(){
  const g = S.game_;
  if(!g || g.kind !== 'match' || g.over || !MTC) return;
  MTC.attached = true;
};
