/* ==================================================================
   A CLEARER READING CHECK — a parent's choice (app half)

   Reading is checked on the phone. Where the phone has an on-device
   recognizer for the language (core/speech.js), the child's voice never
   leaves it, and that stays the way whatever this switch says. Where it
   hasn't, the browser's own recognizer is a general one, made for adults,
   that tidies what it hears — so a child's "बाई" for "भाई" comes back as
   "भाई" and the slip is lost.

   With this switch on (a parent, behind the PIN, after a plain notice in
   Hindi and English) and a signal, the Reading Tree instead records the
   one line, sends it to Takhti's voice server, and a speech service built
   for Indian speech (Sarvam's verbatim mode — voice/asr.js) writes down
   what was really said. The text comes back and is graded HERE by the
   same matcher. The recording is not kept anywhere: not on the phone
   after the turn, not on the server.

   It never blocks the lesson: no answer in time → the honest message and
   the typed fallback, as always. A build without a voice server
   (TALK_URL empty) shows no switch at all.
   ================================================================== */

/* Use the speech service for this turn? */
function cloudReadReady(){
  return !!(TALK_URL && S.cloudRead && S.online && STT_LOCAL[S.lang] !== 'available' &&
            navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
}

const blobB64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(blob); });

/* Same shape as listen(): onResult(alternatives) or onEnd(reason); returns { stop }. */
function cloudListen(onResult, onEnd){
  let rec = null, stream = null, over = false, timer = null, ac = null, raf = null;
  const chunks = [];
  const words = String(S.ctx.sentence || '').split(/\s+/).length;
  const maxMs = Math.min(15000, 2500 + words * 900);          // a line's worth of time, no more
  const cleanup = () => {
    clearTimeout(timer); if(raf) cancelAnimationFrame(raf);
    try{ stream && stream.getTracks().forEach(t => t.stop()); }catch(e){}
    try{ ac && ac.close(); }catch(e){}
  };
  const end = (fn, arg) => { if(over) return; over = true; cleanup(); chunks.length = 0; fn(arg); };
  const finish = () => { if(rec && rec.state === 'recording') try{ rec.stop(); }catch(e){} };

  navigator.mediaDevices.getUserMedia({ audio: true }).then(st => {
    if(over){ st.getTracks().forEach(t => t.stop()); return; }
    stream = st;
    rec = new MediaRecorder(st);
    rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = send;
    rec.start();
    timer = setTimeout(finish, maxMs);
    // stop by itself after a pause, once the child has started reading
    try{
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const an = ac.createAnalyser(); ac.createMediaStreamSource(st).connect(an);
      const buf = new Uint8Array(an.fftSize); let spoke = false, quiet = 0;
      const tick = () => {
        if(over || !rec || rec.state !== 'recording') return;
        an.getByteTimeDomainData(buf);
        let peak = 0; for(const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        const now = performance.now();
        if(peak > 18){ spoke = true; quiet = 0; }
        else if(spoke){ if(!quiet) quiet = now; else if(now - quiet > 1300) return finish(); }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }catch(e){ /* no level meter: the time limit ends the turn */ }
  }).catch(() => end(onEnd, 'not-allowed'));

  async function send(){
    if(over) return;
    try{ stream.getTracks().forEach(t => t.stop()); }catch(e){}
    const blob = new Blob(chunks, { type: (rec && rec.mimeType) || 'audio/webm' });
    chunks.length = 0;
    if(blob.size < 2000) return end(onEnd, 'no-speech');
    try{
      const audio = await blobB64(blob);
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = setTimeout(() => ctl && ctl.abort(), 10000);
      const res = await fetch(TALK_URL + '/reading/asr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
        body: JSON.stringify({ consent: true, lang: S.lang, mime: blob.type, audio }) });
      clearTimeout(to);
      const d = await res.json().catch(() => ({}));
      if(over) return;
      if(!res.ok || typeof d.transcript !== 'string' || !d.transcript.trim()) return end(onEnd, res.status === 429 ? 'cloud-limit' : res.ok ? 'no-speech' : 'network');
      log(2, `Reading check · the line was written down by ${d.provider} on the voice server (the recording is not kept) and graded here on the phone`);
      end(onResult, [{ transcript: d.transcript, confidence: 0.9 }]);
    }catch(e){ end(onEnd, 'network'); }
  }
  return { stop(){ if(over) return; over = true; cleanup(); chunks.length = 0; if(rec && rec.state === 'recording') try{ rec.stop(); }catch(e){} } };
}

/* The parent's switch, on the dashboard. */
function cloudReadParentHTML(){
  if(!TALK_URL) return '';
  const hi = S.lang === 'hi', n = attr(S.name || '');
  return `<div class="metric">
    <div><b>${hi ? 'पढ़ने की और साफ़ जाँच' : 'A clearer reading check'}</b>
      <div style="font-size:12.5px;opacity:.75;line-height:1.5">${hi
        ? `जिस फ़ोन में अपनी भाषा पहचान नहीं है, वहाँ चालू करने पर ${n} की एक पंक्ति की पढ़ाई इंटरनेट से तख़्ती के वॉइस सर्वर और भारतीय बोली पहचानने वाली सेवा (Sarvam) तक जाती है, जो ठीक वही लिखती है जो ${n} ने बोला — फिर जाँच इसी फ़ोन पर होती है। रिकॉर्डिंग कहीं नहीं रखी जाती। जिस फ़ोन में अपनी पहचान है, वहाँ आवाज़ फ़ोन से बाहर नहीं जाती। शुरू में बंद; कभी भी बंद करें।`
        : `On a phone without its own recognizer for the language, ${n}'s reading of one line goes over the internet to Takhti's voice server and a speech service built for Indian speech (Sarvam), which writes down exactly what ${n} said — then it is checked here on the phone. The recording is not kept anywhere. On a phone with its own recognizer, the voice never leaves the phone. Off to begin with; turn it off any time.`}</div></div>
    <button class="toggle ${S.cloudRead ? 'on' : ''}" aria-pressed="${S.cloudRead ? 'true' : 'false'}" aria-label="${hi ? 'पढ़ने की और साफ़ जाँच' : 'A clearer reading check'}" onclick="toggleCloudRead()"><span></span></button>
  </div>`;
}
function toggleCloudRead(){
  S.cloudRead = !S.cloudRead;
  log(null, `Clearer reading check ${S.cloudRead ? 'turned on by a parent — one line at a time goes to the speech service when the phone has no recognizer of its own' : 'turned off'}`);
  saveSoon();
  render();
}
