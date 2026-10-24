/* HTML-attribute-safe escaping. Never interpolate raw text into onclick. */
const attr = s => String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
  .replace(/</g,'&lt;').replace(/>/g,'&gt;');
function sayEl(el){ speak(el.dataset.say); }

let VOICES = [];
function loadVoices(){
  if(!('speechSynthesis' in window)) return;
  VOICES = speechSynthesis.getVoices() || [];
}
if('speechSynthesis' in window){
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', ()=>{
    loadVoices();
    if(VOICES.length && !S._voiceLogged){
      S._voiceLogged = true;
      const hi = VOICES.some(v=>v.lang.toLowerCase().startsWith('hi'));
      log(0, `${VOICES.length} voices available · Hindi voice ${hi?'found':'NOT installed'}`);
    }
  });
}
function pickVoice(lang){
  if(!VOICES.length) loadVoices();
  const want = lang==='hi' ? 'hi' : 'en';
  const low = v => v.lang.toLowerCase();
  return VOICES.find(v=>low(v).startsWith(want+'-in'))
      || VOICES.find(v=>low(v).startsWith(want))
      || VOICES.find(v=>low(v).startsWith('en'))
      || VOICES[0] || null;
}
/* The one entry point everything calls: try the recorded voice first (see
   core/voice.js), fall back to the device's own synthesis on anything —
   no manifest entry, autoplay blocked before a tap, a thrown promise. */
async function speak(text, lang, onDone){
  // Muted still has to finish the call the way real speech eventually
  // would — onDone is how every narrated scene advances (lesson beats,
  // the reading screen, opening sequences...), and none of them expect
  // to wait forever for a sound that will never come.
  if(S.muted){ if(onDone) onDone(); return; }
  const l = lang || S.lang;
  let played = false;
  try{ played = await playRecorded(text, l, onDone); }catch(e){ played = false; }
  if(!played) speakDevice(text, l, onDone);
}
function speakDevice(text, lang, onDone){
  text = (text==null? '' : String(text)).trim();
  if(!text){ if(onDone) onDone(); return; }
  if(!('speechSynthesis' in window)){ log(null,'This browser has no speech synthesis'); if(onDone) onDone(); return; }
  const l = lang || S.lang;
  try{ speechSynthesis.cancel(); }catch(e){}
  // Chrome drops an utterance queued in the same tick as cancel() — give it a beat.
  clearTimeout(S._speakTimer);
  S._speakTimer = setTimeout(()=>{
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(l);
    if(v){ u.voice = v; u.lang = v.lang; }
    else { u.lang = l==='hi' ? 'hi-IN' : 'en-IN'; }
    u.rate = band().speechRate; u.pitch = 1.05;

    // some Android voices never fire onend, so onDone has a backstop timer;
    // both paths funnel through finish() so it only ever runs once.
    let done = false;
    const finish = () => { if(done) return; done = true; clearTimeout(safety); if(onDone) onDone(); };
    const words = text.split(/\s+/).length;
    const safety = setTimeout(finish, 900 + words*420 + 2500);

    u.onend = finish;
    u.onerror = e => {
      const err = e.error || 'unknown';
      // cancel() fires 'interrupted'/'canceled' on the utterance it just
      // stopped. That is the previous line being replaced, not a failure —
      // but whatever is waiting on onDone still needs to hear about it.
      if(err === 'interrupted' || err === 'canceled'){ finish(); return; }
      if(err === 'not-allowed'){
        log(null, 'Audio blocked until the child taps something — browser autoplay rule');
        finish();
        return;
      }
      log(null, 'TTS error: ' + err);
      finish();
    };
    speechSynthesis.speak(u);
    if(l==='hi' && v && !v.lang.toLowerCase().startsWith('hi'))
      log(null, 'No Hindi voice on this device — reading with ' + v.lang);
    else
      log(0, `TTS · ${v? v.name : (l==='hi'?'hi-IN':'en-IN')}`);
  }, 70);
}
/* WebSpeech is cloud STT on every browser that ships it — there is no
   on-device fallback yet (see core/vosk-stt.js for why, and what
   isVoskReady() is for once one exists). So "browser lacks the API",
   "no connection", and "the recognizer just failed to start" all mean
   the same thing to a child: no microphone grading is available right
   now, type it instead. Calling onEnd() immediately and synchronously
   in those cases — rather than opening a microphone that can never
   produce a result — is what keeps the reading screen from ever
   hanging with no way out; see startListening()/stopListening() in
   ui/handlers.js for the other half of that guarantee (the ONLINE
   WebSpeech recognizer this function returns is a real, long-lived
   object that must be stoppable too, not just this synchronous path). */
function listen(onResult, onEnd){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(!SR){
    log(0, 'STT unavailable — this browser has no SpeechRecognition, typed fallback');
    onEnd('unsupported');
    return null;
  }
  if(!navigator.onLine){
    // The one place a real on-device recognizer will plug in later — see
    // core/vosk-stt.js. isVoskReady() is false today, so this always falls
    // through to the honest "no recognizer, type it" message below.
    if(typeof isVoskReady === 'function' && isVoskReady() && typeof listenVosk === 'function')
      return listenVosk(onResult, onEnd);
    log(0, 'STT unavailable offline — no on-device recognizer bundled, typed fallback');
    onEnd('network');
    return null;
  }
  try {
    log(0, `STT · WebSpeech API (${S.lang})`);
    const r = new SR();
    r.lang = S.lang==='hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 5;
    r.onresult = e => {
      const res = e.results[0];
      const alts = [];
      for(let i=0;i<res.length;i++) alts.push({ transcript:res[i].transcript, confidence:res[i].confidence });
      onResult(alts);
    };
    r.onerror = e => onEnd(e.error);
    r.onend = () => onEnd(null);
    r.start();
    return r;
  } catch(err){
    log(0, 'WebSpeech failed to start — typed fallback');
    onEnd('network');
    return null;
  }
}

/* names the real cause instead of a blanket "mic unavailable" — a network
   drop and a denied permission need different next steps from a child. */
function micReason(err){
  if(err==='network' || err==='offline') return S.lang==='hi'
    ? 'बोलकर पहचान के लिए इंटरनेट चाहिए — नीचे लिखकर देखो, बाकी सब कुछ ऑफ़लाइन काम करता है।'
    : 'Speech recognition needs a connection — type it below, everything else works offline.';
  if(err==='not-allowed' || err==='service-not-allowed') return S.lang==='hi'
    ? 'माइक की अनुमति नहीं मिली — नीचे लिखकर देखो।'
    : 'Microphone permission denied — type what you read below.';
  if(err==='unsupported') return S.lang==='hi'
    ? 'यह ब्राउज़र सुन नहीं सकता — Chrome में खोलकर देखो।'
    : "This browser can't listen — try Chrome.";
  return S.lang==='hi' ? 'माइक नहीं चला — नीचे लिखकर देखो।' : 'Mic unavailable here — type what you read below.';
}

/* ==================================================================
   AUDIO SELF-LISTEN FEEDBACK LOOP
   Captures transient audio stream during reading for self-comparison.
   ================================================================== */
let ACTIVE_RECORDER = null;
let RECORDED_CHUNKS = [];

function startVoiceRecorder(){
  RECORDED_CHUNKS = [];
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    if(typeof MediaRecorder === 'undefined') return;
    try {
      ACTIVE_RECORDER = new MediaRecorder(stream);
      ACTIVE_RECORDER.ondataavailable = e => { if(e.data && e.data.size > 0) RECORDED_CHUNKS.push(e.data); };
      ACTIVE_RECORDER.onstop = () => {
        if(RECORDED_CHUNKS.length > 0){
          const blob = new Blob(RECORDED_CHUNKS, { type: 'audio/webm' });
          if(S.ctx) S.ctx.recordedVoice = URL.createObjectURL(blob);
          if(typeof render === 'function') render();
        }
        stream.getTracks().forEach(t => t.stop());
      };
      ACTIVE_RECORDER.start();
    } catch(e){}
  }).catch(e => {});
}

function stopVoiceRecorder(){
  if(ACTIVE_RECORDER && ACTIVE_RECORDER.state !== 'inactive'){
    try { ACTIVE_RECORDER.stop(); } catch(e){}
  }
}

function playSelfVoice(){
  if(S.ctx && S.ctx.recordedVoice){
    const audio = new Audio(S.ctx.recordedVoice);
    audio.play().catch(e => log(null, 'Audio playback blocked: ' + e.message));
  }
}


/* ==================================================================
   READING MATCHER (Tier 0) — deterministic, offline, Devanagari-aware
   Stage 1 capture → 2 normalize → 3 align → 4 grade → 5 gate → 6 score
   ================================================================== */
