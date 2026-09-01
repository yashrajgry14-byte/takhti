/* ==================================================================
   VOICE

   Every spoken line goes through here. If a pre-rendered file exists
   for that exact line, it plays. Otherwise the device's own speech
   synthesis says it.

   The fallback is not a degraded mode — it is the mode the app shipped
   with, and it still works. That is why the good voice can be an
   optional download rather than a dependency: a phone with 40 MB free
   gets device TTS and every lesson still runs.

   The hash must match tools/build-audio.mjs exactly. Both are
   sha1(lang + "|" + trimmed text), first 16 hex characters.
   ================================================================== */

const VOICE_BASE = 'audio';
let VOICE_MANIFEST = {};        // lang -> { key: true }
let VOICE_EL = null;            // one reused <audio>, so a new line cuts the old

/* Tiny sync SHA-1. The lines are short and this runs once per utterance;
   crypto.subtle is async and would complicate every call site. */
function sha1hex(str){
  function rol(n,s){ return (n<<s)|(n>>>(32-s)); }
  const bytes = new TextEncoder().encode(str);
  const ml = bytes.length * 8;
  const withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
  withPad.set(bytes); withPad[bytes.length] = 0x80;
  new DataView(withPad.buffer).setUint32(withPad.length - 4, ml, false);

  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476,h4=0xC3D2E1F0;
  const w = new Int32Array(80);
  for(let i=0;i<withPad.length;i+=64){
    const dv = new DataView(withPad.buffer, i, 64);
    for(let j=0;j<16;j++) w[j] = dv.getInt32(j*4, false);
    for(let j=16;j<80;j++) w[j] = rol(w[j-3]^w[j-8]^w[j-14]^w[j-16], 1);
    let a=h0,b=h1,c=h2,d=h3,e=h4;
    for(let j=0;j<80;j++){
      const f = j<20 ? ((b&c)|(~b&d)) : j<40 ? (b^c^d) : j<60 ? ((b&c)|(b&d)|(c&d)) : (b^c^d);
      const k = j<20 ? 0x5A827999 : j<40 ? 0x6ED9EBA1 : j<60 ? 0x8F1BBCDC : 0xCA62C1D6;
      const t = (rol(a,5) + f + e + k + w[j])|0;
      e=d; d=c; c=rol(b,30); b=a; a=t;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0;
  }
  return [h0,h1,h2,h3,h4].map(x => (x>>>0).toString(16).padStart(8,'0')).join('');
}
const lineKey = (text, lang) => sha1hex(lang + '|' + String(text).trim()).slice(0, 16);

/* Load the manifest once per language. A missing manifest is normal —
   it just means nobody has run the build step yet. */
async function loadVoiceManifest(lang){
  if(VOICE_MANIFEST[lang]) return VOICE_MANIFEST[lang];
  try{
    const res = await fetch(`${VOICE_BASE}/manifest-${lang}.json`);
    if(!res.ok) throw new Error(String(res.status));
    VOICE_MANIFEST[lang] = await res.json();
    log(0, `Recorded voice available · ${Object.keys(VOICE_MANIFEST[lang]).length} lines in ${lang}`);
  }catch(e){
    VOICE_MANIFEST[lang] = {};
    if(!S._voiceNoted){ S._voiceNoted = true; log(0, 'No recorded voice pack · using the device voice'); }
  }
  return VOICE_MANIFEST[lang];
}

/* The one entry point. Returns true if a file played, false to fall back. */
async function playRecorded(text, lang, onDone){
  const man = await loadVoiceManifest(lang);
  const key = lineKey(text, lang);
  if(!man || !man[key]) return false;

  try{
    if(!VOICE_EL){ VOICE_EL = new Audio(); VOICE_EL.preload = 'auto'; }
    VOICE_EL.pause();
    VOICE_EL.onended = null; VOICE_EL.onerror = null;
    VOICE_EL.src = `${VOICE_BASE}/${lang}/${key}.mp3`;

    // playbackRate follows the age band, exactly as device TTS does
    try{ VOICE_EL.playbackRate = (typeof band === 'function') ? band().speechRate / 0.85 : 1; }catch(e){}

    let settled = false;
    const finish = () => { if(settled) return; settled = true; if(onDone) onDone(); };
    VOICE_EL.onended = finish;
    VOICE_EL.onerror = () => { settled = true; speakDevice(text, lang, onDone); };

    await VOICE_EL.play();
    log(0, 'Voice · recorded narration');
    return true;
  }catch(e){
    // autoplay refused before a tap, file missing, decode failure — all
    // land here and all resolve the same way: say it with the device
    return false;
  }
}
