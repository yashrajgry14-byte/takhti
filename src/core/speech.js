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
