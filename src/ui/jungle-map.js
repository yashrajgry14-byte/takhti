/* ==================================================================
   THE JUNGLE MAP — the hub every session returns to.

   A grid of four tiles is an adult's idea of navigation. Given four
   equal buttons, a six-year-old taps the same one every day, or none.

   So the app is a place instead. A path winds through a jungle, and
   the things you can do are places on it — a reading tree, a sand
   patch for writing, a pile of counting stones, a storyteller's fire,
   a clearing where the games are, Munni's pond for questions, and a
   picture hut where the cartoons are.

   Three things this buys that tiles do not:

     · Munni stands at the place she is suggesting, and says why, out
       loud if tapped. The nudge is physical — she is over there,
       waiting — rather than a badge.
     · A place the age band does not offer is simply not on the map,
       so nothing is ever greyed out and refused. A four-year-old's
       jungle is smaller, not locked. The places that ARE offered never
       appear and disappear between visits.
     · Coming back tomorrow means returning somewhere, which is a
       different feeling from reopening an app.

   All SVG and CSS. No tiles, no assets.
   ================================================================== */

/* gate: the AGE_BANDS module a place needs to appear (null = always).
   mod:  the daily-target module a place counts toward (null = none). */
/* The Sand Patch says what this child's class actually does there. */
function writeSub(hi){
  const w = typeof band === 'function' ? band().write : 'trace';
  if(w === 'trace') return hi ? 'अक्षर बनाओ' : 'Trace letters';
  if(w === 'paper') return hi ? 'कॉपी में लिखो' : 'Write in your notebook';
  return hi ? 'लिखो और बनाओ' : 'Trace and write';
}
const MAP_PLACES = [
  { id:'read',    screen:'read',    ic:'🌳', x:22, y:26, gate:'read',  mod:'read',
    en:'The Reading Tree',  hi:'पढ़ने का पेड़',  sub:{ en:'Read out loud', hi:'बोलकर पढ़ो' } },
  { id:'write',   screen:'write',   ic:'🏜️', x:68, y:20, gate:'write', mod:'write',
    en:'The Sand Patch',    hi:'रेत का मैदान',  sub:{ en:'Trace and write', hi:'लिखो और बनाओ' } },
  { id:'math',    screen:'math',    ic:'🪨', x:78, y:46, gate:'count', mod:'math',
    en:'Counting Stones',   hi:'गिनती के पत्थर', sub:{ en:'Add and take away', hi:'जोड़ो और घटाओ' } },
  { id:'story',   screen:'lessons', ic:'🔥', x:50, y:58, gate:'count', mod:null,
    en:'The Story Fire',    hi:'कहानी की आग',   sub:{ en:'Learn with a story', hi:'कहानी से सीखो' } },
  { id:'play',    screen:'games',   ic:'🎪', x:22, y:68, gate:null,    mod:null,
    en:'The Play Clearing', hi:'खेल का मैदान',  sub:{ en:'Six games', hi:'छह खेल' } },
  { id:'ask',     screen:'ask',     ic:'💧', x:52, y:86, gate:'ask',   mod:null,
    en:"Munni's Pond",      hi:'मुन्नी का तालाब', sub:{ en:'Ask anything', hi:'कुछ भी पूछो' } },
  { id:'theater', screen:'theater', ic:'📺', x:80, y:74, gate:'count', mod:null,
    en:'The Picture Hut',   hi:'तस्वीरों की झोपड़ी', sub:{ en:'Cartoons', hi:'कार्टून' } }
];
const MAP_PATH_LEN = 215;   // MAP_PATH's length in viewBox units, so 100% progress lights exactly all of it
const MAP_PATH = 'M22 26 C 44 18, 56 14, 68 20 S 84 34, 78 46 S 60 52, 50 58 S 30 60, 22 68 S 38 84, 52 86 S 76 84, 80 74';

function mapVisible(){
  return MAP_PLACES.filter(p => !p.gate || moduleAllowed(p.gate));
}

/* Homework a teacher assigned that this child hasn't finished yet. */
function mapHomework(){
  const hw = personalizeContentForHomework(S);
  return hw && hw.assignedAt !== S.hwDone ? hw : null;
}

/* Where Munni is standing, and why — in priority order:
     1. 'homework' — unfinished teacher homework: the Story Fire, where it is
     2. 'review'   — spaced-repetition items due (core/srs.js): their place.
                     Invisible on purpose — no seventh "review" place, no
                     counter. A badge that appears and disappears is a
                     notification wearing a jungle costume, and this app has
                     a hard rule against habit mechanics aimed at children.
                     Munni just happens to be at reading today, and the
                     first sentence there happens to be the one due
                     (see VIEWS.read). The parent sees the real signal, on
                     the dashboard's REMEMBERED section.
     3. 'target'   — whichever module is furthest from today's goal
   null when everything is done today — then she rests at the Play
   Clearing and says so (see mapLine()). */
function mapSuggestion(){
  const places = mapVisible();
  if(mapHomework()){
    const fire = places.find(p => p.id === 'story');
    if(fire) return { place: fire, why: 'homework' };
  }
  const reach = new Set(places.map(p => p.mod).filter(Boolean));
  const due = getDueSrsItems(S).filter(it => reach.has(it.mod));
  if(due.length){
    const counts = {};
    for(const it of due) counts[it.mod] = (counts[it.mod] || 0) + 1;
    const topMod = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
    return { place: places.find(p => p.mod === topMod), why: 'review' };
  }
  const t = S.today, g = S.targets;
  const cand = places.filter(p => p.mod)
    .map(p => ({ p, frac: (t[p.mod] || 0) / Math.max(1, g[p.mod] || 5) }))
    .sort((a,b) => a.frac - b.frac);
  return cand.length && cand[0].frac < 1 ? { place: cand[0].p, why: 'target' } : null;
}

/* What Munni says. Chosen from what actually happened, never a generic
   hello: she noticed a level-up, she knows the teacher left homework, she
   counts what is left today, or she says it's fine to stop. A review is
   never called a review — she just invites the child to that place. */
function mapLine(sug){
  const n = S.name || '', hi = S.lang === 'hi';
  if(S._justLevelled){
    S._justLevelled = false;
    return hi ? `${n}, तुम एक स्तर आगे बढ़ गए! मैंने देखा।` : `${n}, you moved up a level! I saw that.`;
  }
  if(!sug) return hi ? `आज का सब हो गया, ${n}। चाहो तो खेलो!` : `Everything is done today, ${n}. Play if you want!`;
  const place = hi ? sug.place.hi : sug.place.en;
  if(sug.why === 'homework') return hi ? `${n}, शिक्षक ने ${place} पर कुछ छोड़ा है!` : `${n}, your teacher left you something at ${place}!`;
  if(sug.why === 'target'){
    const m = sug.place.mod, left = Math.max(1, (S.targets[m] || 5) - (S.today[m] || 0));
    const total = ['read','write','math'].reduce((a,k) => a + (S.today[k] || 0), 0);
    if(total){
      const label = { read: hi?'वाक्य':'sentences', write: hi?'लिखाई':'to write', math: hi?'सवाल':'sums' }[m];
      return hi ? `बस ${left} और ${label}, फिर आज का पूरा!` : `Just ${left} more ${label} and today is done!`;
    }
  }
  return hi ? `चलो ${n}, ${place} चलते हैं!` : `Come on ${n}, let us go to ${place}!`;
}

/* Progress shows as the path lighting up behind you, not as a number. */
function mapProgress(){
  const mods = ['read','write','math'];
  const done = mods.reduce((a,m) => a + Math.min(1, (S.today[m]||0) / Math.max(1, S.targets[m]||5)), 0);
  return Math.round((done / mods.length) * 100);
}

function jungleMapHTML(){
  const hi = S.lang === 'hi';
  const places = mapVisible();
  const sug = mapSuggestion();
  // with nothing left today she rests at the Play Clearing instead of vanishing
  const spot = sug ? sug.place : places.find(p => p.id === 'play');
  const line = mapLine(sug);

  return `
  ${topGamifyBar()}
  ${profileSwitcher()}
  ${typeof circleMapHTML === 'function' ? circleMapHTML() : ''}
  ${mindMapHTML()}
  <div class="jmap glass-card" id="jmap">
    <svg class="jm-canvas" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path class="jm-path" d="${MAP_PATH}"/>
      <path class="jm-path lit" style="stroke-dasharray:${(mapProgress() * MAP_PATH_LEN / 100).toFixed(1)} 400" d="${MAP_PATH}"/>
    </svg>

    <!-- scenery, so the jungle is a jungle and not a diagram -->
    <i class="jm-deco" style="left:8%;top:44%">🌴</i>
    <i class="jm-deco" style="left:94%;top:90%">🌴</i>
    <i class="jm-deco sm" style="left:42%;top:34%">🌿</i>
    <i class="jm-deco sm" style="left:10%;top:90%">🌿</i>
    <i class="jm-deco sm" style="left:84%;top:12%">🦋</i>
    <i class="jm-deco" style="left:6%;top:20%">🌳</i>
    <i class="jm-deco sm" style="left:56%;top:52%">🌼</i>
    <i class="jm-deco sm" style="left:20%;top:70%">🍄</i>
    <i class="jm-deco sm" style="left:66%;top:96%">🌺</i>
    <i class="jm-bird">ᵛ</i>

    ${places.map((p,i) => {
      const full = p.mod && (S.today[p.mod]||0) >= (S.targets[p.mod]||5);
      const sub = p.id === 'ask' && S.queue.length
        ? (hi ? `${S.queue.length} सवाल सिग्नल का इंतज़ार कर रहे` : `${S.queue.length} waiting for signal`)
        : p.id === 'write' ? writeSub(hi)
        : (hi ? p.sub.hi : p.sub.en);
      return `
      <button class="jm-place ${spot && spot.id === p.id ? 'here' : ''} ${full ? 'full' : ''}"
              style="left:${p.x}%;top:${p.y}%;animation-delay:${i*0.09}s"
              onclick="mapGo('${p.screen}')">
        <span class="jm-ic">${p.ic}</span>
        <span class="jm-label"><b>${hi ? p.hi : p.en}</b><small>${sub}</small></span>
        ${full ? '<span class="jm-tick">✓</span>' : ''}
      </button>`;
    }).join('')}

    ${spot ? `<button class="jm-munni" style="left:${spot.x}%;top:${spot.y}%" data-say="${attr(line)}" onclick="mapTapMunni(this)" aria-label="${attr(line)}">
      ${munniSmall()}
      <span class="jm-say ${spot.x > 62 ? 'say-r' : spot.x < 38 ? 'say-l' : 'say-c'}">${line}</span>
    </button>` : ''}
  </div>

  <div class="jm-foot">
    <button class="btn ghost" style="width:100%" onclick="go('parentlock')">${t('parent')} →</button>
  </div>`;
}

function mapGo(screen){
  trumpet(1);
  if(typeof sfxChime === 'function') sfxChime();
  go(screen);
}

/* Tapping Munni says her line out loud — for a child who can't read it yet. */
function mapTapMunni(el){
  trumpet(1);
  speak(el.dataset.say);
}

/* On arriving at the map: the jungle's ambient sound, and — if a daily goal
   was met somewhere else since the last visit — the celebration for it
   (see core/adaptive.js's bumpToday()). Deliberately rare: if everything
   is a celebration, nothing is. */
function mapArrive(){
  if(typeof sfxAmbientBg === 'function') sfxAmbientBg();
  if(S._pendingCelebrate){
    S._pendingCelebrate = false;
    trumpet(2);
    if(typeof triggerConfetti === 'function') triggerConfetti(2200);
  }
  // between activities, never inside one: the learning circle catches up (if a parent turned it on)
  if(typeof circleSync === 'function') circleSync();
}

if(typeof VIEWS !== 'undefined') VIEWS.map = jungleMapHTML;
if(typeof AFTER !== 'undefined') AFTER.map = mapArrive;
