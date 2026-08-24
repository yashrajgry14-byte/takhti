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
function speak(text, lang){
  text = (text==null? '' : String(text)).trim();
  if(!text) return;
  if(!('speechSynthesis' in window)){ log(null,'This browser has no speech synthesis'); return; }
  const l = lang || S.lang;
  try{ speechSynthesis.cancel(); }catch(e){}
  // Chrome drops an utterance queued in the same tick as cancel() — give it a beat.
  clearTimeout(S._speakTimer);
  S._speakTimer = setTimeout(()=>{
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(l);
    if(v){ u.voice = v; u.lang = v.lang; }
    else { u.lang = l==='hi' ? 'hi-IN' : 'en-IN'; }
    u.rate = 0.85; u.pitch = 1.05;
    u.onerror = e => log(null, 'TTS error: ' + (e.error||'unknown'));
    speechSynthesis.speak(u);
    if(l==='hi' && v && !v.lang.toLowerCase().startsWith('hi'))
      log(null, 'No Hindi voice on this device — reading with ' + v.lang);
    else
      log(0, `TTS · ${v? v.name : (l==='hi'?'hi-IN':'en-IN')}`);
  }, 70);
}
function listen(onResult, onEnd){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ onEnd('unsupported'); return null; }
  const r = new SR();
  r.lang = S.lang==='hi' ? 'hi-IN' : 'en-IN';
  r.interimResults = false;
  r.maxAlternatives = 5;   // grade against all guesses, not just the top one
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
}

/* names the real cause instead of a blanket "mic unavailable" — a network
   drop and a denied permission need different next steps from a child. */
function micReason(err){
  if(err==='network' || err==='offline') return S.lang==='hi'
    ? 'आवाज़ पहचानने के लिए इंटरनेट चाहिए — ब्राउज़र में यही एक चीज़ है जिसे सिग्नल चाहिए, बाकी सब बिना नेट के चलता है।'
    : 'Speech recognition needs a connection in the browser — everything else works offline.';
  if(err==='not-allowed' || err==='service-not-allowed') return S.lang==='hi'
    ? 'माइक की अनुमति नहीं मिली — नीचे लिखकर देखो।'
    : 'Microphone permission denied — type what you read below.';
  if(err==='unsupported') return S.lang==='hi'
    ? 'यह ब्राउज़र सुन नहीं सकता — Chrome में खोलकर देखो।'
    : "This browser can't listen — try Chrome.";
  return S.lang==='hi' ? 'माइक नहीं चला — नीचे लिखकर देखो।' : 'Mic unavailable here — type what you read below.';
}

/* ==================================================================
   READING MATCHER (Tier 0) — deterministic, offline, Devanagari-aware
   Stage 1 capture → 2 normalize → 3 align → 4 grade → 5 gate → 6 score
   ================================================================== */
