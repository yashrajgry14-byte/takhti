/* ==================================================================
   THE HOME SCENE

   The home screen is the one a child sees most often, and it was the
   flattest thing in the app: a name, some numbers, four buttons.

   Now Munni is standing there. She greets the child by name, says
   something that depends on what actually happened — not a generic
   hello — and points at the one thing worth doing next. Gauri the
   sparrow sits beside her.

   The greeting is chosen from state, so it is never the same twice in
   a row and it always means something:
     · nothing done yet today      → an invitation
     · partway through             → what is left, counted
     · everything done             → permission to stop, not pressure
     · levelled up recently        → she noticed

   That last one matters. A child who moves up a level and is told so
   by name, out loud, remembers it. No streak mechanic does that.

   ── on making her feel alive ──
   A single looping animation reads as a machine within about twenty
   seconds. What reads as alive is IRREGULARITY: long stillness, then
   an unpredictable small gesture. So the idle loops are slow and
   nearly invisible, and a director fires a random gesture every five
   to nine seconds — an ear scratch, a look around, a trunk sniff. The
   child cannot predict which, which is why she seems to be deciding
   rather than repeating.
   ================================================================== */

function homeMood(){
  const t = S.today || {}, g = S.targets || {};
  const mods = ['read','write','math'];
  const done = mods.filter(m => (t[m]||0) >= (g[m]||5));
  const total = mods.reduce((a,m)=>a+(t[m]||0), 0);

  if(S._justLevelled) return 'levelled';
  if(done.length === mods.length) return 'finished';
  if(total === 0) return 'fresh';
  return 'partway';
}

function homeLine(){
  const n = S.name || '';
  const hi = S.lang === 'hi';
  const t = S.today || {}, g = S.targets || {};

  switch(homeMood()){
    case 'levelled':
      S._justLevelled = false;
      return hi ? `${n}, तुम कल आगे बढ़ गए! मैंने देखा।`
                : `${n}, you moved up a level! I saw that.`;
    case 'finished':
      return hi ? `आज का सब हो गया, ${n}। और खेलना है तो चलो।`
                : `Everything is done today, ${n}. Play more if you want.`;
    case 'partway': {
      // Talk about the SAME module the nudge highlights, or she points at one
      // thing while naming another — which reads as her not paying attention.
      const m = homeNudge() || 'read';
      const left = Math.max(1, (g[m]||5) - (t[m]||0));
      const label = { read: hi?'वाक्य':'sentences', write: hi?'लिखाई':'writing',
                      math: hi?'सवाल':'sums' }[m];
      return hi ? `बस ${left} और ${label}, फिर आज पूरा!`
                : `Just ${left} more ${label} and today is done!`;
    }
    default:
      return hi ? `तैयार हो, ${n}? चलो कुछ पढ़ते हैं।`
                : `Ready, ${n}? Let us read something.`;
  }
}

/* Which tile deserves the "start here" flag: the module furthest from
   its own target, so the nudge follows the child rather than a fixed
   order. Skips anything the age band does not offer. */
function homeNudge(){
  const t = S.today || {}, g = S.targets || {};
  const cand = ['read','write','math']
    .filter(m => typeof moduleAllowed !== 'function' || moduleAllowed(m) || moduleAllowed('count'))
    .map(m => ({ m, frac: (t[m]||0) / Math.max(1, g[m]||5) }))
    .sort((a,b) => a.frac - b.frac);
  return cand.length && cand[0].frac < 1 ? cand[0].m : null;
}

/* ---- Munni again, smaller, in her idle pose ---- */
function munniSmall(){
  return `<svg class="hm-munni" viewBox="0 0 340 250" aria-hidden="true">
    <g class="hm-body">
      <path class="hm-tail" d="M56 152c-13 4-17 14-12 24" stroke="#B9A7C9"
            stroke-width="9" stroke-linecap="round" fill="none"/>
      <ellipse cx="150" cy="150" rx="96" ry="62" fill="#B9A7C9"/>
      <circle cx="248" cy="122" r="58" fill="#B9A7C9"/>
      <ellipse class="hm-ear" cx="228" cy="112" rx="26" ry="32" fill="#A692B8"/>
      <circle class="hm-eye" cx="272" cy="106" r="7" fill="#2A2118"/>
      <g class="hm-legs">
        <rect x="86"  y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
        <rect x="130" y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
        <rect x="172" y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
        <rect x="214" y="196" width="30" height="46" rx="14" fill="#B9A7C9"/>
      </g>
      <path class="hm-trunk" d="M282 160c6 26 0 44-14 56" stroke="#B9A7C9"
            stroke-width="26" stroke-linecap="round" fill="none"/>
      <path d="M292 148c9 4 14 10 15 18" stroke="#F6F1E2" stroke-width="7"
            stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;
}

/* ---- Gauri, perched and hopping ---- */
function gauriSmall(){
  return `<svg class="hm-gauri" viewBox="0 0 60 60" aria-hidden="true">
    <g class="hm-hop">
      <ellipse cx="30" cy="38" rx="15" ry="14" fill="#EDE6D2"/>
      <path class="hm-wing" d="M25 34c-6 1-9 6-8 10 5 1 9-2 12-7z" fill="#C9BFA4"/>
      <circle cx="35" cy="23" r="10" fill="#EDE6D2"/>
      <path d="M44 23l7 3-7 3z" fill="#F0A02A"/>
      <circle class="hm-eye" cx="37" cy="22" r="2.4" fill="#16302B"/>
      <path d="M23 48l3 7M35 48l3 7" stroke="#F0A02A" stroke-width="2.4" stroke-linecap="round"/>
    </g>
  </svg>`;
}

function homeSceneHTML(){
  const line = homeLine();
  return `
  <div class="homescene" id="homescene">
    <div class="hm-bubble" data-say="${attr(line)}" onclick="tapMunniHome()">${line}</div>
    <div class="hm-cast" onclick="tapMunniHome()">
      <i class="hm-petal p1">🍃</i><i class="hm-petal p2">🌼</i><i class="hm-petal p3">🍃</i>
      ${munniSmall()}
      ${gauriSmall()}
      <div class="hm-burst" id="hmburst"></div>
    </div>
  </div>`;
}

/* ==================================================================
   THE IDLE DIRECTOR — one random gesture every 5-9 seconds
   ================================================================== */
const HM_GESTURES = ['look','sniff','scratch','swish','perk'];

function homeSceneStart(){
  homeSceneStop();
  const tick = () => {
    const el = document.getElementById('homescene');
    if(!el || S.screen !== 'home') return homeSceneStop();     // screen changed
    const g = HM_GESTURES[Math.floor(Math.random() * HM_GESTURES.length)];
    el.classList.add('g-' + g);
    setTimeout(() => el.classList.remove('g-' + g), 1600);
    S._hmTimer = setTimeout(tick, 5000 + Math.random() * 4000);
  };
  S._hmTimer = setTimeout(tick, 2600);

  // Gauri leaves and comes back now and then — rare enough that noticing
  // it feels like a small event rather than wallpaper.
  const fly = () => {
    const el = document.getElementById('homescene');
    if(!el || S.screen !== 'home') return homeSceneStop();
    el.classList.add('g-fly');
    setTimeout(() => el.classList.remove('g-fly'), 3200);
    S._hmFly = setTimeout(fly, 22000 + Math.random() * 16000);
  };
  S._hmFly = setTimeout(fly, 12000 + Math.random() * 10000);
}

function homeSceneStop(){
  clearTimeout(S._hmTimer); clearTimeout(S._hmFly);
  S._hmTimer = S._hmFly = null;
}

/* ==================================================================
   CELEBRATION — only when a daily goal is actually met.
   Deliberately rare: if everything is a celebration, nothing is.
   ================================================================== */
function homeCelebrate(){
  const host = document.getElementById('hmburst');
  const el = document.getElementById('homescene');
  if(!host || !el) return;
  const cols = ['#F0A02A','#3FBB78','#4C7BE0','#E8447C','#EDE6D2'];
  host.innerHTML = [...Array(16)].map((_,i)=>{
    const a = (i / 16) * 360, d = 42 + Math.random() * 34;
    return `<i style="--a:${a}deg;--d:${d}px;background:${cols[i%cols.length]};
             animation-delay:${(i%5)*0.03}s"></i>`;
  }).join('');
  el.classList.add('hm-tapped');
  setTimeout(()=>{ el.classList.remove('hm-tapped'); host.innerHTML = ''; }, 1400);
  if(typeof trumpet === 'function') trumpet(2);
}

/* Tapping her does nothing useful, which is exactly why children do it. */
function tapMunniHome(){
  const el = document.getElementById('homescene');
  if(el){ el.classList.add('hm-tapped'); setTimeout(()=>el.classList.remove('hm-tapped'), 900); }
  if(typeof trumpet === 'function') trumpet(1);
  const b = el && el.querySelector('.hm-bubble');
  if(b) speak(b.dataset.say);
}

/* Called by record() when a level changes, so the next visit to home
   opens with her noticing. */
function noteLevelUp(){ S._justLevelled = true; }
