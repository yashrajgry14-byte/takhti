/* ==================================================================
   PLAYFUL LAYER (20 Nov) — the app as a five-year-old expects a screen
   to behave: everything answers a tap.

     · every button squishes, sparkles and goes "pop" when pressed
     · a right answer bursts into confetti and the star counter jumps
     · the jungle map is alive: drifting clouds, a smiling sun, and
       animals that hop, swing and giggle when a child pokes them
     · Munni jumps when she is tapped
     · a heading with a 🔊 is read out loud when tapped — for a child
       who cannot read it yet

   It only decorates what render() has already drawn and listens for
   taps; it never changes what a screen does or what gets recorded. The
   grown-up pages (parent, teacher) and the arrival scene are left
   alone. Delete its <script> line (and its line in sw.js) and the app
   behaves exactly as it did.
   ================================================================== */
(function(){
  const GROWN_UP = new Set(['parent', 'parentlock', 'teacher', 'arrive']);
  const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PALETTE = ['#FF8C42', '#3FB4E6', '#7CC242', '#FFC93C', '#FF7FA3', '#A88BEB', '#2EC4B6'];

  const childScreen = () => typeof S !== 'undefined' && !GROWN_UP.has(S.screen);
  const pop = () => { if(typeof sfxPop === 'function') try { sfxPop(); } catch(e){} };

  /* ---------- little particles, drawn above everything ---------- */
  function burst(x, y, n, spread, kind){
    if(REDUCE) return;
    for(let i = 0; i < n; i++){
      const p = document.createElement('i');
      p.className = 'kid-bit ' + (kind || 'dot');
      const a = (Math.PI * 2 * i / n) + Math.random() * .6;
      const d = spread * (.55 + Math.random() * .6);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d - (kind === 'confetti' ? 40 : 0)) + 'px');
      p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      p.style.background = kind === 'star' ? 'none' : PALETTE[i % PALETTE.length];
      if(kind === 'star') p.textContent = i % 2 ? '✨' : '⭐';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    }
  }
  function floatUp(x, y, txt){
    if(REDUCE) return;
    const f = document.createElement('i');
    f.className = 'kid-float'; f.textContent = txt;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }
  const centre = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function replay(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ---------- 1. every press answers ---------- */
  document.addEventListener('pointerdown', e => {
    if(!childScreen()) return;
    const b = e.target.closest('#screen button, #screen [onclick], #askfab');
    if(!b || b.closest('.paper') || b.disabled) return;
    replay(b, 'kid-squish');
    burst(e.clientX, e.clientY, 7, 34, 'dot');
    pop();
  }, { passive: true });

  /* ---------- 2. Munni jumps; headings read themselves out ---------- */
  document.addEventListener('click', e => {
    if(!childScreen()) return;
    const m = e.target.closest('.jm-munni, .eleph, .kid-munni');
    if(m) replay(m, 'kid-jump');
    const h = e.target.closest('#screen .kid-say');
    if(h && typeof speak === 'function'){
      replay(h, 'kid-wiggle');
      speak(h.textContent.replace(/[🔊]/g, '').trim());
    }
  });

  /* ---------- 3. a right answer is a party ----------
     Screens redraw with the answer already marked, so this watches for
     the moment a .right answer appears with no .wrong beside it — the
     child got it, first time — and throws the confetti from it. */
  let lastStars = null, sawRight = false;
  function partyIfRight(){
    const right = document.querySelector('#screen .right');
    const wrong = document.querySelector('#screen .wrong');
    if(right && !wrong && !sawRight){
      const [x, y] = centre(right);
      burst(x, y, 26, 120, 'confetti');
      burst(x, y, 6, 70, 'star');
      if(typeof sfxChime === 'function') try { sfxChime(); } catch(e){}
    }
    sawRight = !!right;
  }

  /* ---------- 4. the living jungle ---------- */
  const CRITTERS = [
    { ic: '🐒', cls: 'swing', x: 10, y: 31, say: '🍌' },
    { ic: '🦜', cls: 'hop',   x: 34, y: 51, say: '🎵' },
    { ic: '🐇', cls: 'hop',   x: 50, y: 38, say: '🥕' },
    { ic: '🐢', cls: 'creep', x: 30, y: 92, say: '💚' },
    { ic: '🐸', cls: 'hop',   x: 72, y: 92, say: '💦' },
    { ic: '🦒', cls: 'sway',  x: 8,  y: 50, say: '😄', big: true },
  ];
  function decorateMap(){
    const map = document.querySelector('#screen .jmap');
    if(!map || map.dataset.kid) return;
    map.dataset.kid = '1';
    map.insertAdjacentHTML('afterbegin', `
      <i class="kid-cloud c1"></i><i class="kid-cloud c2"></i><i class="kid-cloud c3"></i>
      <button class="kid-sun" aria-label="Sun">🌞</button>
      <i class="kid-flyer">🦋</i>`);
    CRITTERS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'kid-critter ' + c.cls + (c.big ? ' big' : '');
      b.style.left = c.x + '%'; b.style.top = c.y + '%';
      b.style.animationDelay = (i * .4) + 's';
      b.textContent = c.ic; b.dataset.say = c.say;
      b.setAttribute('aria-label', 'Jungle friend');
      map.appendChild(b);
    });
    // a jungle friend or the sun only plays; it never opens a place
    map.addEventListener('click', e => {
      const t = e.target.closest('.kid-critter, .kid-sun, .jm-deco');
      if(!t) return;
      e.stopPropagation();
      replay(t, 'kid-boing');
      const [x, y] = centre(t);
      floatUp(x, y - 20, t.dataset.say || '✨');
      burst(x, y, 8, 40, 'star');
      if(!t.matches('button')) pop();   // buttons already popped on press
    });
  }

  /* ---------- 5. after every screen is drawn ---------- */
  function decorate(){
    const scr = document.querySelector('.screen');
    if(scr && typeof S !== 'undefined') scr.dataset.kid = GROWN_UP.has(S.screen) ? 'grown' : S.screen;
    if(!childScreen()) return;
    document.querySelectorAll('#screen > .display, #screen .ob-q, #screen .display.kid-heading').forEach(h => {
      if(!h.closest('.paper') && h.textContent.trim().length < 70) h.classList.add('kid-say');
    });
    decorateMap();
    partyIfRight();
    const star = document.querySelector('#screen .star-badge');
    if(star){
      const n = parseInt(star.textContent.replace(/\D/g, ''), 10);
      if(lastStars != null && n > lastStars){ replay(star, 'kid-starpop'); const [x, y] = centre(star); burst(x, y, 10, 50, 'star'); }
      if(!isNaN(n)) lastStars = n;
    }
  }

  function start(){
    const root = document.getElementById('screen');
    if(!root) return;
    let queued = false;
    new MutationObserver(() => {
      if(queued) return;
      queued = true;
      // a microtask, not a frame: it runs once per batch of changes and never
      // outlives the page (a test's jsdom window closes with frames still queued)
      Promise.resolve().then(() => { queued = false; try { decorate(); } catch(e){} });
    }).observe(root, { childList: true, subtree: true });
    decorate();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
