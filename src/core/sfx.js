/* ==================================================================
   SOUND EFFECTS (Tier 0) — synthesized on-device with Web Audio.
   No audio files: every effect is built from oscillators and noise.

   Audio is a bonus, never a dependency. Every effect goes through
   sfxPlay(), which skips it when the child's sound is muted (S.muted)
   or there is no AudioContext, and swallows any error from a partial
   Web Audio implementation (some older WebViews), so a missing sound can
   never interrupt a lesson.
   ================================================================== */

let SFX_CTX = null;

function getAudioCtx(){
  if(typeof window === 'undefined') return null;
  if(!SFX_CTX){
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if(AudioContextClass) SFX_CTX = new AudioContextClass();
  }
  if(SFX_CTX && SFX_CTX.state === 'suspended') SFX_CTX.resume().catch(() => {});
  return SFX_CTX;
}

function sfxAllowed(){
  if(typeof S !== 'undefined' && S.muted) return false;
  return !!getAudioCtx();
}

function sfxPlay(build){
  if(!sfxAllowed()) return;
  try{ build(getAudioCtx()); }catch(e){ /* a sound is a bonus, never a dependency */ }
}

/* A short pitched blip: oscillator type, start/end frequency, volume, length. */
function sfxTone(ctx, type, f0, f1, vol, dur, at){
  const t0 = ctx.currentTime + (at || 0);
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if(f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + dur);
}

/* One second of white noise, made once and shared: chalk, card and the
   ambient rustle all play slices of it rather than each allocating and
   filling a fresh buffer per call. */
let SFX_NOISE = null;
function sfxNoise(ctx){
  if(!SFX_NOISE || SFX_NOISE.sampleRate !== ctx.sampleRate){
    SFX_NOISE = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = SFX_NOISE.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return SFX_NOISE;
}
function sfxNoiseBurst(ctx, type, freq, q, vol, dur){
  const src = ctx.createBufferSource();
  src.buffer = sfxNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type; filter.frequency.value = freq;
  if(q) filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(0, Math.random() * (1 - dur), dur);
}

/* A tap on a maths answer. */
function sfxPop(){ sfxPlay(ctx => sfxTone(ctx, 'sine', 350, 750, 0.15, 0.05)); }

/* Chalk on slate while a child traces. Called on every pointer move, so
   it is throttled — one scrape per 70ms reads as a continuous stroke. */
let SFX_CHALK_AT = 0;
function sfxChalk(){
  const now = Date.now();
  if(now - SFX_CHALK_AT < 70) return;
  SFX_CHALK_AT = now;
  sfxPlay(ctx => sfxNoiseBurst(ctx, 'bandpass', 2400, 3.0, 0.08, 0.06));
}

/* An impact — the opening's big moment, a wrong answer. */
function sfxThud(){ sfxPlay(ctx => sfxTone(ctx, 'sine', 160, 35, 0.3, 0.12)); }

/* A goal met, a right answer, a card earned: C5-E5-G5-C6. */
function sfxChime(){
  sfxPlay(ctx => [523.25, 659.25, 783.99, 1046.50]
    .forEach((f, i) => sfxTone(ctx, 'triangle', f, f, 0.15, 0.25, i * 0.07)));
}

/* A page turning — the next beat of a story or cartoon. */
function sfxCard(){ sfxPlay(ctx => sfxNoiseBurst(ctx, 'highpass', 1200, 0, 0.05, 0.08)); }

/* The jungle map's ambient sound: a soft leaf-rustle, swelling and
   settling slowly. Starts when the map is shown (ui/jungle-map.js's
   mapArrive()), stops when any other screen opens (go()) or sound is
   muted (toggleMuted()). Quiet on purpose — it's a place, not music. */
let SFX_AMBIENT = null;
function sfxAmbientBg(){
  if(SFX_AMBIENT) return;
  sfxPlay(ctx => {
    const src = ctx.createBufferSource();
    src.buffer = sfxNoise(ctx); src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1100; filter.Q.value = 0.7;
    const gain = ctx.createGain(); gain.gain.value = 0.012;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;   // one slow swell every ~8s
    const depth = ctx.createGain(); depth.gain.value = 0.008;
    lfo.connect(depth); depth.connect(gain.gain);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(); lfo.start();
    SFX_AMBIENT = { src, lfo };
  });
}
function sfxAmbientStop(){
  if(!SFX_AMBIENT) return;
  try{ SFX_AMBIENT.src.stop(); SFX_AMBIENT.lfo.stop(); }catch(e){}
  SFX_AMBIENT = null;
}
