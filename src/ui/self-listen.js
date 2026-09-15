/* ==================================================================
   SELF-LISTEN — hear your own reading, then Munni's.

   listen() (core/speech.js) grades what the child said, but it never
   hands back audio — WebSpeech and the offline WASM engine both
   consume the microphone stream internally and never expose it. So
   this runs its OWN independent getUserMedia()/MediaRecorder session,
   in parallel with listen(), starting and stopping on the exact same
   two signals startListening() already has (the mic goes live; the
   recognizer calls back with a result or an error) rather than
   guessing at speech boundaries itself.

   The clip is Tier 0 in the strictest sense: it never leaves working
   memory. S.ctx already resets on every next sentence, every screen
   change and every profile switch (see nextSentence()/go()/
   switchProfile()) — the Blob and its Object URL live there for
   exactly that reason, so those three existing reset points are where
   this revokes, with nothing extra to remember. No fetch, no
   localStorage, no IndexedDB touches the Blob anywhere in this file —
   that is the actual claim made to a school, so it is what
   test/self-listen.test.js checks for directly, not just the DOM.

   getUserMedia is independent of, and never blocks, the
   SpeechRecognition-based grading loop: a permission denial here logs
   once and leaves S.ctx.clipUrl unset, and the reading screen falls
   back to a single "Hear Munni" control — see selfListenHTML().
   ================================================================== */

let SL_STREAM = null;
let SL_RECORDER = null;
let SL_SESSION = 0;   // invalidates a getUserMedia() promise that resolves after a newer attempt/reset has already started

/* ---------------- recording lifecycle ---------------- */
function selfListenStart(){
  selfListenReset();   // any previous attempt's stream/recorder/clip is done with — clear it before starting a new one
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    log(null, 'No getUserMedia here — self-listen unavailable, the reading loop is unaffected');
    return;
  }
  const mySession = ++SL_SESSION;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    // stale by the time permission resolved (child already stopped, or
    // tapped the mic again) — never attach to a screen that moved on
    if(mySession !== SL_SESSION || !S.ctx.live){
      stream.getTracks().forEach(tr => tr.stop());
      return;
    }
    SL_STREAM = stream;
    const chunks = [];
    let rec;
    try{ rec = new MediaRecorder(stream); }
    catch(e){
      stream.getTracks().forEach(tr => tr.stop());
      SL_STREAM = null;
      log(null, 'MediaRecorder unavailable — self-listen unavailable, the reading loop is unaffected');
      return;
    }
    SL_RECORDER = rec;
    rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(tr => tr.stop());
      if(SL_STREAM === stream) SL_STREAM = null;
      if(SL_RECORDER === rec) SL_RECORDER = null;
      if(mySession === SL_SESSION && chunks.length){
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        S.ctx.clipBlob = blob;
        S.ctx.clipUrl = URL.createObjectURL(blob);
        render();
      }
    };
    rec.start();
  }).catch(err => {
    // permission denied, no mic, a locked-down webview — the grading
    // loop never depended on this and keeps working exactly as before
    log(null, 'Self-listen mic unavailable: ' + (err && err.name ? err.name : err));
  });
}
/* The natural end of a listening turn — a result or a recognizer
   error — keeps whatever was captured. */
function selfListenStop(){
  if(SL_RECORDER && SL_RECORDER.state !== 'inactive') SL_RECORDER.stop();
}
/* A forced cleanup — leaving the screen, the next sentence, a profile
   switch — must not go on to mint a clip nobody asked for anymore. */
function selfListenReset(){
  SL_SESSION++;
  if(SL_RECORDER && SL_RECORDER.state !== 'inactive'){
    SL_RECORDER.onstop = null;   // discarding this attempt — do not let it create a URL after the fact
    try{ SL_RECORDER.stop(); }catch(e){}
  }
  if(SL_STREAM){ try{ SL_STREAM.getTracks().forEach(tr => tr.stop()); }catch(e){} }
  SL_STREAM = null; SL_RECORDER = null;
  selfListenReleaseClip();
}
/* The one place URL.revokeObjectURL() is called. Both the URL and the
   Blob are cleared together so there is never a moment where one
   survives the other and revocation becomes ambiguous. */
function selfListenReleaseClip(){
  if(S.ctx.clipUrl){ try{ URL.revokeObjectURL(S.ctx.clipUrl); }catch(e){} }
  S.ctx.clipUrl = null;
  S.ctx.clipBlob = null;
}

/* ---------------- playback ---------------- */
/* Munni's voice is not a second voice to build — every narrated line
   in this app already IS her speaking (see the arrival conversation,
   lesson beats, ...); this just reuses speak() exactly like the
   existing "Hear it" button on the reading screen does. */
function selfListenPlayMunni(){
  speak(S.ctx.sentence);
}
/* play() is spec'd to return a Promise, but not every real WebView
   honours that (and reports show it varies) — guard rather than
   assume, same "audio is a bonus, never a dependency" spirit as
   trumpet()'s own try/catch. */
function selfListenPlay(url, onSettled){
  try{
    const a = new Audio(url);
    if(onSettled) a.onended = onSettled;
    const p = a.play();
    if(p && typeof p.catch === 'function') p.catch(() => { if(onSettled) onSettled(); });
    else if(!p && onSettled) onSettled();   // play() didn't return a thenable at all — do not hang the sequence on it
  }catch(e){ if(onSettled) onSettled(); }
}
function selfListenPlayMe(){
  if(!S.ctx.clipUrl) return;
  selfListenPlay(S.ctx.clipUrl);
}
/* The primary control: the child's own clip, a 500ms gap, then Munni. */
function selfListenPlayBoth(){
  if(!S.ctx.clipUrl){ selfListenPlayMunni(); return; }
  selfListenPlay(S.ctx.clipUrl, () => setTimeout(selfListenPlayMunni, 500));
}

/* ---------------- render ---------------- */
/* Shown once an attempt has been graded. No clip (denied, unavailable,
   or a MediaRecorder that never got permission in time) renders only
   the Munni button — grading itself never waited on any of this. */
function selfListenHTML(){
  const hi = S.lang === 'hi';
  if(!S.ctx.clipUrl){
    return `<div class="row" style="margin-top:10px">
      <button class="btn ghost" onclick="selfListenPlayMunni()">🐘 ${hi?'मुन्नी को सुनो':'Hear Munni'}</button>
    </div>`;
  }
  return `
  <div class="row" style="margin-top:10px">
    <button class="btn" onclick="selfListenPlayBoth()">🎧 ${hi?'दोनों सुनो':'Hear both'}</button>
  </div>
  <div class="row" style="margin-top:8px">
    <button class="btn ghost" onclick="selfListenPlayMe()">🗣️ ${hi?'मुझे सुनो':'Hear me'}</button>
    <button class="btn ghost" onclick="selfListenPlayMunni()">🐘 ${hi?'मुन्नी को सुनो':'Hear Munni'}</button>
  </div>
  <div class="muted" style="font-size:11px;text-align:center;margin-top:4px">${hi
    ? 'सिर्फ़ इसी स्क्रीन पर — सेव या भेजी नहीं जाती'
    : 'Only ever plays back here — never saved or sent'}</div>`;
}
