/* ==================================================================
   CONFETTI & CELEBRATION PARTICLE ENGINE
   Zero-dependency, 60fps canvas particle burst system for Takhti.
   ================================================================== */

function triggerConfetti(durationMs = 2000) {
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#FFD166', '#00B894', '#6C5CE7', '#FF7675', '#74B9FF', '#F0A02A', '#E8447C'];
  const particles = [];
  const particleCount = 60;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 1) * 14 - 4,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.vRot;
      p.opacity = Math.max(0, 1 - elapsed / durationMs);

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    });

    if (elapsed < durationMs) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(animate);
  if (typeof sfxChime === 'function') sfxChime();
}

function triggerStarBurst(count = 20) {
  triggerConfetti(1500);
}
