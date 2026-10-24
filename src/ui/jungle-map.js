/* ==================================================================
   THE JUNGLE MAP

   A grid of four tiles is an adult's idea of navigation. Given four
   equal buttons, a six-year-old taps the same one every day, or none.

   So the app is a place instead. A path winds through a jungle, and
   the things you can do are places on it — a reading tree, a sand
   patch for writing, a pile of counting stones, a storyteller's fire,
   a clearing where the games are, Munni's pond for questions.

   Three things this buys that tiles do not:

     · Munni stands at the place she is suggesting. The nudge is
       physical — she is over there, waiting — rather than a badge.
     · A place the age band does not offer is simply not on the map,
       so nothing is ever greyed out and refused. A four-year-old's
       jungle is smaller, not locked.
     · Coming back tomorrow means returning somewhere, which is a
       different feeling from reopening an app.

   All SVG and CSS. No tiles, no assets.
   ================================================================== */

const MAP_PLACES = [
  { id:'read',  screen:'read',    ic:'🌳', x:22, y:26,
    en:'The Reading Tree',  hi:'पढ़ने का पेड़',
    sub:{ en:'Read out loud', hi:'बोलकर पढ़ो' }, mod:'read' },
  { id:'write', screen:'write',   ic:'🏜️', x:68, y:20,
    en:'The Sand Patch',    hi:'रेत का मैदान',
    sub:{ en:'Trace and write', hi:'लिखो और बनाओ' }, mod:'write' },
  { id:'math',  screen:'math',    ic:'🪨', x:78, y:48,
    en:'Counting Stones',   hi:'गिनती के पत्थर',
    sub:{ en:'Add and take away', hi:'जोड़ो और घटाओ' }, mod:'math' },
  { id:'story', screen:'lessons', ic:'🔥', x:50, y:60,
    en:'The Story Fire',    hi:'कहानी की आग',
    sub:{ en:'Learn with a story', hi:'कहानी से सीखो' }, mod:'math' },
  { id:'play',  screen:'games',   ic:'🎪', x:24, y:70,
    en:'The Play Clearing', hi:'खेल का मैदान',
    sub:{ en:'Six games', hi:'छह खेल' }, mod:null },
  { id:'ask',   screen:'ask',     ic:'💧', x:62, y:84,
    en:"Munni's Pond",      hi:'मुन्नी का तालाब',
    sub:{ en:'Ask anything', hi:'कुछ भी पूछो' }, mod:'ask' }
];

function mapVisible(){
  // AGE_BANDS' own modules list calls maths "count", not "math" — MAP_PLACES
  // uses "math" (matching content/copy.js's t('count') label instead) for
  // the two maths-flavoured places (Counting Stones, the Story Fire), so
  // that one name has to be translated before checking the band. Every
  // other place's mod already matches a real band module name directly.
  return MAP_PLACES.filter(p => {
    if(!p.mod) return true;
    if(typeof moduleAllowed !== 'function') return true;
    return moduleAllowed(p.mod === 'math' ? 'count' : p.mod);
  });
}

/* Where Munni is standing: due spaced-repetition items win first (see
   core/srs.js), then whichever module is furthest from its own daily
   target, so she waits at the thing worth doing rather than a fixed
   favourite.

   Chose option (b) over adding a seventh "review" place: a badge that
   appears and disappears is a notification wearing a jungle costume, and
   this app already has a hard rule against habit mechanics aimed at
   children (see CLAUDE.md's product constraints). Spaced repetition
   works precisely because the learner doesn't experience it as a
   separate event — Munni just happens to be standing at reading today,
   and the first sentence the child gets (see VIEWS.read in views.js)
   happens to be the one due for review. No new UI, no "3 things to
   remember" counter, nothing for the child to notice at all. A parent
   still gets the real signal — see parent()'s REMEMBERED section. */
function mapSuggestion(){
  if(typeof getDueSrsItems === 'function'){
    const visibleMods = new Set(mapVisible().map(p => p.mod).filter(Boolean));
    const due = getDueSrsItems(S).filter(it => visibleMods.has(it.mod));
    if(due.length){
      const counts = {};
      for(const it of due) counts[it.mod] = (counts[it.mod] || 0) + 1;
      const topMod = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
      // math SRS items carry no specific problem to replay (genProblem()
      // generates fresh each time — see views.js's math()), so for math
      // "review" just means Munni sends the child back to practice at
      // their current level again; for read, the due item's own sentence
      // becomes the session's first one, see VIEWS.read.
      const place = mapVisible().find(p => p.mod === topMod);
      if(place) return place;
    }
  }
  const t = S.today || {}, g = S.targets || {};
  const cand = mapVisible()
    .filter(p => p.mod && g[p.mod])
    .map(p => ({ p, frac: (t[p.mod] || 0) / Math.max(1, g[p.mod] || 5) }))
    .sort((a,b) => a.frac - b.frac);
  return cand.length && cand[0].frac < 1 ? cand[0].p : null;
}

/* Progress shows as the path lighting up behind you, not as a number. */
function mapProgress(){
  const t = S.today || {}, g = S.targets || {};
  const mods = ['read','write','math'];
  const done = mods.reduce((a,m) => a + Math.min(1, (t[m]||0) / Math.max(1, g[m]||5)), 0);
  return Math.round((done / mods.length) * 100);
}

function jungleMapHTML(){
  const hi = S.lang === 'hi';
  const places = mapVisible();
  const here = mapSuggestion();
  const pct = mapProgress();

  const topBar = typeof topGamifyBar === 'function' ? topGamifyBar() : '';

  return `
  ${topBar}
  <div class="jmap glass-card" id="jmap" style="border-radius:24px;border:2px solid rgba(255,255,255,0.18);box-shadow:0 14px 36px rgba(0,0,0,0.35);">
    <svg class="jm-canvas" viewBox="0 0 100 100" preserveAspectRatio="none">
      <!-- the path, drawn through the places in order -->
      <path class="jm-path" d="M22 26 C 44 18, 56 14, 68 20 S 84 36, 78 48
                               S 60 54, 50 60 S 30 62, 24 70 S 46 82, 62 84"/>
      <path class="jm-path lit" style="stroke-dasharray:${pct * 3.4} 400"
            d="M22 26 C 44 18, 56 14, 68 20 S 84 36, 78 48
               S 60 54, 50 60 S 30 62, 24 70 S 46 82, 62 84"/>
    </svg>

    <!-- scenery, so the jungle is a jungle and not a diagram -->
    <i class="jm-deco" style="left:8%;top:46%">🌴</i>
    <i class="jm-deco" style="left:88%;top:70%">🌴</i>
    <i class="jm-deco sm" style="left:44%;top:34%">🌿</i>
    <i class="jm-deco sm" style="left:14%;top:88%">🌿</i>
    <i class="jm-deco sm" style="left:82%;top:14%">🦋</i>
    <i class="jm-bird">ᵛ</i>

    ${places.map((p,i) => {
      const isHere = here && here.id === p.id;
      const t = S.today || {}, g = S.targets || {};
      const full = p.mod && g[p.mod] && (t[p.mod]||0) >= g[p.mod];
      return `
      <button class="jm-place ${isHere ? 'here' : ''} ${full ? 'full' : ''}"
              style="left:${p.x}%;top:${p.y}%;animation-delay:${i*0.09}s"
              onclick="mapGo('${p.screen}')">
        <span class="jm-ic">${p.ic}</span>
        <span class="jm-label">
          <b>${hi ? p.hi : p.en}</b>
          <small>${hi ? p.sub.hi : p.sub.en}</small>
        </span>
        ${full ? '<span class="jm-tick">✓</span>' : ''}
      </button>`;
    }).join('')}

    ${here ? `<div class="jm-munni" style="left:${here.x}%;top:${here.y}%">
      ${typeof munniSmall === 'function' ? munniSmall() : '🐘'}
      <span class="jm-say">${hi ? 'इधर आओ!' : 'Over here!'}</span>
    </div>` : ''}
  </div>

  <div class="jm-foot">
    <button class="btn-3d ghost" style="width:100%" onclick="go('parent')">${t('parent')} →</button>
  </div>`;
}

function mapGo(screen){
  if(typeof trumpet === 'function') trumpet(1);
  if(typeof sfxChime === 'function') sfxChime();
  go(screen);
}

if(typeof VIEWS !== 'undefined') VIEWS.map = jungleMapHTML;

