/* ==================================================================
   CELEBRATION PARTICLES — zero-dependency canvas confetti and star bursts.

   One shared full-screen canvas and ONE animation loop: every burst just
   adds particles to the same list, so two celebrations fired close
   together (a correct checkpoint right as a goal completes) layer
   instead of wiping each other's frames. The loop stops itself when the
   last particle fades, so nothing runs while nothing is celebrating.

   Visual only — callers play their own sound (sfxChime() etc.), so a
   celebration never double-chimes. Honors prefers-reduced-motion, and
   silently does nothing where a 2D canvas isn't available (old
   WebViews, test hosts) — a missing sparkle must never break a lesson.

   Deliberately rare (see where these are called): a goal met, a story
   finished, a new personal best, a correct cartoon checkpoint, a clean
   read-back. If everything celebrates, nothing does.
   ================================================================== */

const CELEB = { canvas: null, ctx: null, parts: [], running: false };
const CELEB_COLORS = ['#FFD166', '#00B894', '#6C5CE7', '#FF7675', '#74B9FF', '#F0A02A', '#E8447C'];

function celebCanvas(){
  if(typeof document === 'undefined') return null;
  try{
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  }catch(e){}
  if(!CELEB.canvas || !CELEB.canvas.isConnected){
    const c = document.createElement('canvas');
    c.id = 'confetti-canvas';
    c.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
    document.body.appendChild(c);
    let ctx = null;
    try{ ctx = c.getContext && c.getContext('2d'); }catch(e){ ctx = null; }
    if(!ctx){ c.remove(); return null; }
    CELEB.canvas = c; CELEB.ctx = ctx;
  }
  CELEB.canvas.width = window.innerWidth;
  CELEB.canvas.height = window.innerHeight;
  return CELEB.ctx;
}

function celebLoop(){
  const ctx = CELEB.ctx, now = Date.now();
  ctx.clearRect(0, 0, CELEB.canvas.width, CELEB.canvas.height);
  CELEB.parts = CELEB.parts.filter(p => now - p.born < p.life);
  for(const p of CELEB.parts){
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vRot;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (now - p.born) / p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * Math.PI / 180);
    ctx.fillStyle = p.color;
    if(p.star){
      ctx.beginPath();
      for(let i = 0; i < 10; i++){
        const r = i % 2 ? p.size * 0.45 : p.size, a = i * Math.PI / 5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
    }
    ctx.restore();
  }
  if(CELEB.parts.length) requestAnimationFrame(celebLoop);
  else CELEB.running = false;
}

function celebAdd(parts){
  CELEB.parts.push(...parts);
  if(!CELEB.running){ CELEB.running = true; requestAnimationFrame(celebLoop); }
}

/* The big one: falling confetti from the top centre. */
function triggerConfetti(durationMs = 2000){
  const ctx = celebCanvas(); if(!ctx) return;
  const w = CELEB.canvas.width, h = CELEB.canvas.height, born = Date.now();
  celebAdd([...Array(60)].map(() => ({
    x: w * 0.5 + (Math.random() - 0.5) * 200, y: h * 0.4,
    vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 1) * 14 - 4, g: 0.35,
    size: Math.random() * 8 + 6, rot: Math.random() * 360, vRot: (Math.random() - 0.5) * 10,
    color: CELEB_COLORS[Math.floor(Math.random() * CELEB_COLORS.length)],
    born, life: durationMs, star: false
  })));
}

/* The small one: a ring of stars bursting outward from a point (the
   element that earned it, if given, else the screen centre). */
function triggerStarBurst(count = 20, fromEl){
  const ctx = celebCanvas(); if(!ctx) return;
  let cx = CELEB.canvas.width / 2, cy = CELEB.canvas.height * 0.45;
  if(fromEl && fromEl.getBoundingClientRect){
    const r = fromEl.getBoundingClientRect();
    if(r.width){ cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  }
  const born = Date.now();
  celebAdd([...Array(count)].map((_, i) => {
    const a = (i / count) * Math.PI * 2, sp = 3 + Math.random() * 3;
    return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.08,
      size: 5 + Math.random() * 4, rot: 0, vRot: (Math.random() - 0.5) * 8,
      color: CELEB_COLORS[i % CELEB_COLORS.length], born, life: 1100, star: true };
  }));
}
