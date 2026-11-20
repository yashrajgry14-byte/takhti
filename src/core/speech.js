/* HTML-attribute-safe escaping. Never interpolate raw text into onclick. */
const attr = s => String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
  .replace(/</g,'&lt;').replace(/>/g,'&gt;');
function sayEl(el){ speak(el.dataset.say); }

/* Every spoken line uses online Google Cloud TTS. If Google fails, keep
   Sarvam/ElevenLabs and the existing Google-recorded pack as fallbacks.
   There is intentionally NO browser speechSynthesis/Heera fallback. */
async function speak(text, lang, onDone){
  text = String(text == null ? '' : text).trim();
  if(S.muted || !text){ if(onDone) onDone(); return; }
  const l = lang || S.lang;
  stopOnlineSpeech();
  const requestId = SPEECH_REQUEST;
  const pace = (typeof band === 'function' ? band().speechRate : 0.95);
  let completed = false;
  const finish = () => { if(completed || requestId !== SPEECH_REQUEST) return; completed = true; if(onDone) onDone(); };
  const recorded = async () => {
    if(requestId !== SPEECH_REQUEST || completed) return;
    let ok = false;
    try{ok = await playRecorded(text,l,finish);}catch(e){}
    if(requestId !== SPEECH_REQUEST || completed) return;
    if(!ok){ log(null,'Speech unavailable from Google, backup and recorded audio'); finish(); }
  };
  const backup = async () => {
    if(requestId !== SPEECH_REQUEST || completed) return;
    let ok = false;
    try{ok = await playBackup(text,l,finish,pace,requestId,() => { void recorded(); });}catch(e){}
    if(requestId !== SPEECH_REQUEST || completed) return;
    if(!ok) await recorded();
  };
  let google = false;
  try{google = await playLive(text,l,finish,pace,requestId,() => { void backup(); });}catch(e){}
  if(requestId !== SPEECH_REQUEST || completed) return;
  if(!google) await backup();
}
/* Never invoke browser-installed voices. For legacy callers, route through
   the same online voice pipeline rather than using device speech. */
function speakDevice(text,lang,onDone){return speak(text,lang,onDone);}
/* ==================================================================
   LISTENING — WebSpeech, on-device whenever the phone can.

   Newer Chrome can recognise speech ON THE DEVICE: it downloads a
   language pack once, then listens with no connection at all — and the
   child's voice never leaves the phone, which is the better default for
   children regardless of signal. The network loads tomorrow:
   prepareOfflineSpeech() fetches the packs while there is a connection
   (on the first mic tap, or the parent dashboard's button), so the next
   offline session can still be graded.

   STT_LOCAL[lang] holds the browser's own answer: 'available',
   'downloadable', 'downloading' or 'unavailable'. Recognition runs
   on-device whenever it says 'available', online or not. Otherwise:
   online → the browser's normal recognizer; offline → onEnd('network')
   synchronously, with an honest message and the typed fallback that is
   always on the reading screen. Never a microphone that can't answer.

   The recognizer this returns is a real, long-lived object —
   ui/handlers.js keeps it (ACTIVE_LISTEN) so stopListening() can end a
   turn nobody is waiting on.
   ================================================================== */
const STT_LANG = { en:'en-IN', hi:'hi-IN' };
const STT_LOCAL = { en:'unavailable', hi:'unavailable' };

function sttRecognizer(){
  return (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition) || null;
}

async function sttLocalStatus(lang){
  const SR = sttRecognizer();
  if(!SR || typeof SR.available !== 'function') return 'unavailable';
  try{ return await SR.available({ langs:[STT_LANG[lang]], processLocally:true }); }
  catch(e){ return 'unavailable'; }
}

/* Check both languages and, while online, download any pack the browser
   offers. Safe to call repeatedly; resolves to STT_LOCAL. */
async function prepareOfflineSpeech(){
  const SR = sttRecognizer();
  for(const lang of ['en', 'hi']){
    let st = await sttLocalStatus(lang);
    if(st === 'downloadable' && navigator.onLine && typeof SR.install === 'function'){
      try{ if(await SR.install({ langs:[STT_LANG[lang]], processLocally:true })) st = 'available'; }
      catch(e){ /* stays downloadable — the next try, or the parent's button, will retry */ }
    }
    STT_LOCAL[lang] = st;
  }
  log(0, `On-device speech · English ${STT_LOCAL.en} · Hindi ${STT_LOCAL.hi}`);
  return STT_LOCAL;
}

function listen(onResult, onEnd){
  const SR = sttRecognizer();
  if(!SR){
    log(0, 'STT unavailable — this browser has no SpeechRecognition, typed fallback');
    onEnd('unsupported');
    return null;
  }
  const local = STT_LOCAL[S.lang] === 'available';
  if(!navigator.onLine && !local){
    log(0, `STT unavailable offline — no on-device pack for ${STT_LANG[S.lang]} (${STT_LOCAL[S.lang]}), typed fallback`);
    onEnd('network');
    return null;
  }
  try {
    const r = new SR();
    r.lang = STT_LANG[S.lang];
    r.interimResults = false;
    r.maxAlternatives = 5;
    if(local) r.processLocally = true;
    log(0, `STT · ${local ? 'on-device (no audio leaves the phone)' : 'browser recognizer'} · ${r.lang}`);
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
    log(0, 'Speech recognizer failed to start — typed fallback');
    onEnd('network');
    return null;
  }
}

/* names the real cause instead of a blanket "mic unavailable" — a network
   drop and a denied permission need different next steps from a child. */
function micReason(err){
  const hi = S.lang === 'hi';
  if(err==='network' || err==='offline'){
    if(STT_LOCAL[S.lang] === 'downloadable' || STT_LOCAL[S.lang] === 'downloading') return hi
      ? 'एक बार इंटरनेट से जुड़ो — तख़्ती ऑफ़लाइन पढ़ना डाउनलोड कर लेगी। अभी नीचे लिखकर देखो।'
      : 'Connect to the internet once and Takhti will download offline reading. For now, type it below.';
    return hi
      ? 'इस फ़ोन पर बोलकर पहचान के लिए इंटरनेट चाहिए — नीचे लिखकर देखो, बाकी सब कुछ ऑफ़लाइन काम करता है।'
      : 'Speech recognition needs a connection on this phone — type it below, everything else works offline.';
  }
  if(err==='no-terms') return hi
    ? 'इस फ़ोन पर बोलकर जाँच के लिए माता-पिता की सहमति चाहिए — अभी नीचे लिखकर देखो।'
    : 'Reading aloud here needs a grown-up to agree to the terms first — type it below for now.';
  if(err==='skipped') return hi
    ? 'मुन्नी अभी यह नहीं सुन पाई — यह पंक्ति बाद में फिर आएगी। चाहो तो फिर से पढ़ो, या नीचे लिखकर देखो।'
    : "Munni couldn't hear that one just now — this line will come back later. Read it again, or type it below.";
  if(err==='cloud-limit') return hi
    ? 'आज के लिए इतना ही साफ़ जाँच — नीचे लिखकर देखो।'
    : "That's enough of the clearer check for now — type it below.";
  if(err==='not-allowed' || err==='service-not-allowed') return hi
    ? 'माइक की अनुमति नहीं मिली — नीचे लिखकर देखो।'
    : 'Microphone permission denied — type what you read below.';
  if(err==='unsupported') return hi
    ? 'यह ब्राउज़र सुन नहीं सकता — Chrome में खोलकर देखो।'
    : "This browser can't listen — try Chrome.";
  return hi ? 'माइक नहीं चला — नीचे लिखकर देखो।' : 'Mic unavailable here — type what you read below.';
}
