/* ==================================================================
   ARRIVAL

   The app does not open on a form. It opens on a morning.

   A jungle at whatever time of day it actually is — sunrise, midday,
   dusk, night — with a herd of elephants walking through, birds
   crossing, a rooster if it is early. The herd passes. Munni stays.
   She greets the child by name and they talk a little. Then she takes
   them in.

   ── on the conversation ──
   Munni asks, the child TAPS a reply, Munni responds from a script.
   There is no free text and no open microphone, and that is a
   deliberate legal position, not a shortcut. An AI that responds to
   whatever a child types is a companion, and a companion aimed at
   minors carries real liability — see Garcia v. Character
   Technologies — on top of DPDP §9. Tapped replies feel like talking
   and cannot go anywhere unplanned.

   Everything here is SVG and Web Audio. No images, no audio files, so
   the whole scene costs a few KB and works in airplane mode.
   ================================================================== */

const ARR = {
  dawn:  { h:[5,8],   sky:['#2B3A55','#7E6A8C','#E8A66B','#F6D9A8'], sun:'#FFC46B', sunY:0.62, stars:0.25 },
  day:   { h:[8,16],  sky:['#5FA8D8','#8FC6E6','#C8E3F2','#EAF3E4'], sun:'#FFDD66', sunY:0.18, stars:0 },
  dusk:  { h:[16,19], sky:['#3E4C7A','#A9628C','#E0834F','#F2B96B'], sun:'#FF9A4D', sunY:0.66, stars:0.35 },
  night: { h:[19,29], sky:['#0E1730','#1B2748','#2C3A5E','#3A4A6E'], sun:'#E8E6D8', sunY:0.16, stars:1 }
};
function arrPeriod(){
  const h = new Date().getHours();
  if(h >= 5  && h < 8)  return 'dawn';
  if(h >= 8  && h < 16) return 'day';
  if(h >= 16 && h < 19) return 'dusk';
  return 'night';
}

/* ---------------- ambient sound, synthesised ---------------- */
function arrAudio(){
  if(S.muted) return;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    S._ac = S._ac || new AC();
    const ac = S._ac;
    if(ac.state === 'suspended') return;          // waits for a tap; that is fine
    const p = arrPeriod();

    // a low elephant rumble under everything
    const rumble = () => {
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(58, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 1.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 2);
    };
    // a short bright chirp, two or three notes
    const chirp = () => {
      const t = ac.currentTime + Math.random() * 0.3;
      for(let i = 0; i < 2 + (Math.random()*2|0); i++){
        const o = ac.createOscillator(), g = ac.createGain();
        const s = t + i * 0.09, f = 1900 + Math.random() * 1400;
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, s);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, s + 0.05);
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.035, s + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.07);
        o.connect(g).connect(ac.destination); o.start(s); o.stop(s + 0.09);
      }
    };
    // only at dawn
    const rooster = () => {
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth';
      [[0,420],[0.18,760],[0.42,640],[0.62,900],[0.95,520]].forEach(([d,f])=>
        o.frequency.setValueAtTime(f, t + d));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
      g.gain.setValueAtTime(0.05, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1.3);
    };

    if(p === 'dawn') setTimeout(rooster, 400);
    setTimeout(rumble, 1200);
    const birds = () => {
      if(S.screen !== 'arrival' || S.muted) return;
      if(p !== 'night') chirp();
      S._arrBirds = setTimeout(birds, 2400 + Math.random() * 3600);
    };
    S._arrBirds = setTimeout(birds, 900);
  }catch(e){ /* sound is a bonus, never a dependency */ }
}
function arrAudioStop(){ clearTimeout(S._arrBirds); }

/* ---------------- the scene ---------------- */
function arrElephant(i, scale, delay, dur){
  return `<g class="ar-el" style="--s:${scale};--d:${delay}s;--t:${dur}s">
    <g class="ar-walk">
      <ellipse cx="60" cy="42" rx="34" ry="22" fill="var(--elBody)"/>
      <circle cx="94" cy="32" r="19" fill="var(--elBody)"/>
      <ellipse class="ar-ear" cx="88" cy="26" rx="9" ry="11" fill="var(--elEar)"/>
      <circle cx="103" cy="27" r="2.4" fill="#2A2118"/>
      <g class="ar-legs">
        <rect x="36" y="58" width="11" height="20" rx="5" fill="var(--elBody)"/>
        <rect x="52" y="58" width="11" height="20" rx="5" fill="var(--elBody)"/>
        <rect x="68" y="58" width="11" height="20" rx="5" fill="var(--elBody)"/>
        <rect x="82" y="58" width="11" height="20" rx="5" fill="var(--elBody)"/>
      </g>
      <path class="ar-trunk" d="M110 40c4 12 1 20-5 25" stroke="var(--elBody)"
            stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M32 40c-8 2-11 9-8 15" stroke="var(--elBody)" stroke-width="4"
            stroke-linecap="round" fill="none"/>
    </g></g>`;
}

function arrivalHTML(){
  const p = arrPeriod(), cfg = ARR[p];
  const hi = S.lang === 'hi';
  const st = S.arr || { step:0 };

  const stars = cfg.stars ? [...Array(Math.round(26 * cfg.stars))].map((_,i)=>{
    const x = (i * 37) % 100, y = (i * 53) % 46;
    return `<i class="ar-star" style="left:${x}%;top:${y}%;animation-delay:${(i%7)*0.4}s"></i>`;
  }).join('') : '';

  return `
  <div class="arrival p-${p}" id="arrival"
       style="--sky0:${cfg.sky[0]};--sky1:${cfg.sky[1]};--sky2:${cfg.sky[2]};--sky3:${cfg.sky[3]};--sun:${cfg.sun}">
    <button class="ar-mute" onclick="arrToggleMute()" aria-label="sound">${S.muted ? '🔇' : '🔊'}</button>

    <div class="ar-sky">
      ${stars}
      <div class="ar-sun" style="top:${cfg.sunY * 100}%">${p==='night' ? '🌙' : ''}</div>
      <div class="ar-cloud c1"></div><div class="ar-cloud c2"></div>
      <div class="ar-birds"><i>ᵛ</i><i>ᵛ</i><i>ᵛ</i></div>
    </div>

    <div class="ar-hills"><span class="h1"></span><span class="h2"></span></div>
    <div class="ar-trees">${[...Array(9)].map((_,i)=>
      `<i style="left:${4+i*11}%;--h:${60+((i*37)%40)}px;--d:${(i%4)*0.6}s"></i>`).join('')}</div>

    <svg class="ar-herd ${st.step > 0 ? 'gone' : ''}" viewBox="0 0 140 90">
      ${arrElephant(0, 0.72, 0,   11)}
      ${arrElephant(1, 1.00, 1.4, 10)}
      ${arrElephant(2, 0.58, 2.9, 12)}
      ${arrElephant(3, 0.85, 4.1, 10.5)}
    </svg>

    <div class="ar-ground"></div>

    <div class="ar-munni ${st.step > 0 ? 'in' : ''}">
      ${typeof munniSmall === 'function' ? munniSmall() : ''}
    </div>

    ${st.step > 0 ? arrTalkHTML() : `
      <div class="ar-caption">${hi ? 'सुबह हो गई…' : arrOpeningLine(p)}</div>
      <button class="btn ar-skip" onclick="arrSkip()">${hi ? 'आगे चलो →' : 'Skip →'}</button>`}
  </div>`;
}
function arrOpeningLine(p){
  return { dawn:'The sun is coming up…', day:'The herd is passing through…',
           dusk:'The light is going…', night:'The jungle is quiet…' }[p];
}

/* ---------------- the bounded conversation ---------------- */
/* Every turn is scripted. Munni asks, the child picks from two or three
   replies, Munni answers that reply. Nothing is generated, nothing is
   typed, and the whole exchange is four taps at most. */
function arrTalk(){
  const n = S.name || (S.lang === 'hi' ? 'दोस्त' : 'friend');
  const hi = S.lang === 'hi';
  return [
    { ask: hi ? `नमस्ते ${n}! कैसे हो?` : `Hello ${n}! How are you?`,
      opts: [
        { t: hi?'बढ़िया!':'Great!',        r: hi?'बहुत बढ़िया! मुझे भी अच्छा लग रहा है।':'Wonderful! I am having a good day too.' },
        { t: hi?'ठीक-ठाक':'So-so',        r: hi?'कोई बात नहीं। कुछ मज़ेदार करते हैं।':'That is alright. Let us do something fun.' },
        { t: hi?'थक गया':'Tired',          r: hi?'तो आज थोड़ा ही करेंगे। बस थोड़ा सा।':'Then we will do just a little today. Only a little.' }
      ]},
    { ask: hi ? 'एक बात बताऊँ?' : 'Shall I tell you something?',
      opts: [
        { t: hi?'हाँ!':'Yes!',   r: hi?'हाथी अपनी सूँड से साँस भी लेते हैं और सूँघते भी हैं!':'An elephant breathes AND smells with its trunk!' },
        { t: hi?'नहीं':'Not now', r: hi?'ठीक है, फिर कभी। चलो शुरू करें।':'Alright, another time. Let us begin.' }
      ]},
    { ask: hi ? 'चलें?' : 'Shall we go?',
      opts: [
        { t: hi?'चलो!':'Let us go!', r: hi?'मेरे पीछे आओ!':'Follow me!', end:true },
        { t: hi?'एक मिनट':'One minute', r: hi?'कोई जल्दी नहीं। जब तैयार हो।':'No hurry at all. When you are ready.' }
      ]}
  ];
}
function arrTalkHTML(){
  const st = S.arr, script = arrTalk();
  const turn = script[Math.min(st.turn || 0, script.length - 1)];
  return `
  <div class="ar-bubble">${st.reply || turn.ask}</div>
  ${st.reply ? `<button class="btn ar-next" onclick="arrAdvance()">${
      S.lang==='hi' ? 'आगे →' : 'Next →'}</button>`
    : `<div class="ar-opts">${turn.opts.map((o,i)=>
        `<button class="ar-opt" onclick="arrReply(${i})">${o.t}</button>`).join('')}</div>`}`;
}

function arrReply(i){
  const st = S.arr, turn = arrTalk()[st.turn || 0], o = turn.opts[i];
  st.reply = o.r; st.end = !!o.end;
  if(typeof trumpet === 'function') trumpet(1);
  render();
  speak(o.r);
}
function arrAdvance(){
  const st = S.arr, script = arrTalk();
  if(st.end || (st.turn || 0) >= script.length - 1) return arrFinish();
  st.turn = (st.turn || 0) + 1; st.reply = null;
  render();
  speak(arrTalk()[st.turn].ask);
}
/* arrival → onboard (if no avatar/age yet) → pick (if no game yet) → map.
   No separate "does a profile exist" branch: ui/onboarding.js's own
   obPickAvatar() creates one lazily the moment a child taps an animal,
   so entering 'onboard' is always safe, profile or not — see its
   comment for why that replaces the old text-field greet() screen. */
function arrFinish(){
  arrAudioStop();
  S.arr = null;
  if(!S.avatar || S.age == null){ go('onboard'); return; }
  if(!S.game){ go('pick'); return; }
  go('map');
}
function arrSkip(){
  clearTimeout(S._arrTimer);   // otherwise the 8.2s herd-walk timer still fires later and resets the chat to turn 0
  const st = S.arr || (S.arr = {});
  st.step = 1; st.turn = 0; st.reply = null;
  render();
  speak(arrTalk()[0].ask);
}
function arrToggleMute(){
  S.muted = !S.muted;
  if(S.muted) arrAudioStop(); else arrAudio();
  if(typeof saveSoon === 'function') saveSoon();   // muted is per-profile — see core/speech.js's speak()/ui/elephant.js's trumpet()
  render();
}

/* The herd walks for about eight seconds, then Munni stays and speaks.

   AFTER.arrival calls this on EVERY render() while S.screen is
   'arrival' — not just the first one. arrSkip()/arrReply()/arrAdvance()
   all call render() themselves to update the DOM as the conversation
   progresses, so without the guard below, each of those re-renders
   would re-invoke this, stomping S.arr back to {step:0,...} and
   restarting the 8.2s timer — a tapped reply would erase itself the
   instant it was drawn. Only initialise once per visit; S.arr already
   IS "has this been started", so it doubles as its own flag. */
function arrivalStart(){
  if(S.arr) return;
  S.arr = { step:0, turn:0, reply:null };
  arrAudio();
  clearTimeout(S._arrTimer);
  S._arrTimer = setTimeout(() => {
    if(S.screen !== 'arrival') return;
    S.arr.step = 1;
    render();
    speak(arrTalk()[0].ask);
  }, 8200);
}
function arrivalStop(){ clearTimeout(S._arrTimer); arrAudioStop(); S.arr = null; }

if(typeof VIEWS !== 'undefined') VIEWS.arrival = arrivalHTML;
if(typeof AFTER !== 'undefined') AFTER.arrival = arrivalStart;
