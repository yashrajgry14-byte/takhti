/* ==================================================================
   WEB AUDIO SYNTHESIZED SOUND EFFECTS (SFX) ENGINE (Tier 0)

   Zero-asset procedural sound effects generated on-device via WebAudio API.
   No external .mp3 files required.
   ================================================================== */

let SFX_CTX = null;
let SFX_AMBIENT_NODE = null;

function getAudioCtx(){
  if(typeof window === 'undefined') return null;
  if(!SFX_CTX){
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if(AudioContextClass) SFX_CTX = new AudioContextClass();
  }
  if(SFX_CTX && SFX_CTX.state === 'suspended'){
    SFX_CTX.resume().catch(e=>{});
  }
  return SFX_CTX;
}

function sfxAllowed(){
  if(typeof S !== 'undefined' && S.muted) return false;
  return !!getAudioCtx();
}

/* 1. Pop effect for math array-grid & option taps */
function sfxPop(){
  if(!sfxAllowed()) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(350, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

/* 2. Chalk scrape effect for slate writing strokes */
function sfxChalk(){
  if(!sfxAllowed()) return;
  const ctx = getAudioCtx();
  const bufferSize = ctx.sampleRate * 0.06;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 3.0;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
}

/* 3. Thud effect for game impact (Pithoo / Gilli Danda) */
function sfxThud(){
  if(!sfxAllowed()) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

/* 4. Victory / goal / level-up chime arpeggio */
function sfxChime(){
  if(!sfxAllowed()) return;
  const ctx = getAudioCtx();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    const startTime = ctx.currentTime + idx * 0.07;
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.25);
  });
}

/* 5. Card flip swoosh */
function sfxCard(){
  if(!sfxAllowed()) return;
  const ctx = getAudioCtx();
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1200;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
}

/* 6. Background procedural warm ambient noise texture for interactive elements */
function sfxAmbientBg(){
  if(!sfxAllowed()) return;
  if(SFX_AMBIENT_NODE) return; // already active
  const ctx = getAudioCtx();
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.02;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 150;

  const gain = ctx.createGain();
  gain.gain.value = 0.015;

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
  SFX_AMBIENT_NODE = noise;
}
