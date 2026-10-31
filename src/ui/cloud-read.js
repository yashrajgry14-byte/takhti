/* ==================================================================
   THE READING CHECK — Sarvam, under the terms a parent accepts (app half)

   How Takhti hears a child read:
   · Online: the line the child reads goes to Takhti's voice server and
     Sarvam's speech recognition in VERBATIM mode (voice/asr.js), which
     writes down what the child really said — "बाई", not a tidied "भाई" —
     so the slip can be named and taught. The text comes back and is
     graded HERE by the same matcher; the recording is not kept anywhere.
   · Offline: the phone's own on-device recognizer, where it has the
     language pack (core/speech.js) — the voice stays on the phone. It is
     made for adults and writes down dictionary words, so it misses some
     of a child's slips; good enough to keep practising without a signal.
   · Neither: the typed fallback, always on the reading screen.

   This is part of the terms a grown-up accepts once, at the end of
   onboarding (voiceTermsHTML(): what goes, to whom, that nothing is kept,
   in Hindi and English, versioned and timestamped in S.voiceTerms). It is
   not a switch. The law still gives a parent the right to withdraw
   consent (DPDP Act s.6(4)), so the parent dashboard can withdraw it —
   then nothing leaves the phone and reading uses the on-device
   recognizer or typing. A build without a voice server (TALK_URL empty)
   shows no terms step and keeps the old recognizer path.

   It never blocks the lesson: no answer in 10 s → the honest message and
   the typed fallback.
   ================================================================== */
const VOICE_TERMS_V = 1;
const VOICE_TERMS = {
  en: n => `When ${n} reads aloud in Takhti, or says a word after Munni, the recording goes over the internet to Takhti's voice server and to Sarvam AI, an Indian speech service, which writes down exactly what was said. Takhti checks it on this phone, shows ${n} what to fix, and Munni teaches the right way to say it. The recording is not kept — not on our server, not by us. What ${n} got right or wrong stays on this phone. Without internet, the phone's own recognizer is used, or ${n} types. You can withdraw this any time on the parent page.`,
  hi: n => `जब ${n} तख़्ती में ज़ोर से पढ़ते हैं, या मुन्नी के बाद कोई शब्द बोलते हैं, तो वह रिकॉर्डिंग इंटरनेट से तख़्ती के वॉइस सर्वर और Sarvam AI (एक भारतीय बोली पहचानने वाली सेवा) तक जाती है, जो ठीक वही लिखती है जो बोला गया। तख़्ती इसी फ़ोन पर जाँचती है, ${n} को बताती है क्या सुधारना है, और मुन्नी सही बोलना सिखाती है। रिकॉर्डिंग रखी नहीं जाती — न हमारे सर्वर पर, न हमारे पास। ${n} ने क्या सही किया, क्या नहीं, वह इसी फ़ोन पर रहता है। इंटरनेट न हो तो फ़ोन की अपनी पहचान इस्तेमाल होती है, या ${n} लिखकर देते हैं। माता-पिता वाले पेज पर इसे कभी भी वापस ले सकते हैं।`
};

/* Hear this turn with Sarvam? The terms accepted, a voice server, a signal. */
function cloudReadReady(){
  return !!(TALK_URL && S.voiceTerms && S.voiceTerms.v === VOICE_TERMS_V && S.online &&
            navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
}
/* With a voice server, a child's voice goes nowhere but Sarvam, and only
   under the terms: without them, only the phone's own on-device recognizer
   may listen (core/speech.js), or the child types. */
function deviceListenAllowed(){
  return !TALK_URL || STT_LOCAL[S.lang] === 'available' || !S.online;
}

/* ---------- the grown-ups' terms, at the end of onboarding ---------- */
function voiceTermsWanted(){ return !!TALK_URL && !(S.voiceTerms && S.voiceTerms.v === VOICE_TERMS_V); }
function voiceTermsHTML(){
  const hi = S.lang === 'hi', n = attr(S.name || (hi ? 'आपका बच्चा' : 'your child'));
  return `<div class="ob"><div class="card circlecard" style="text-align:left">
    <div class="kicker2">${hi ? 'बड़ों के लिए · शर्तें' : 'FOR A GROWN-UP · TERMS'}</div>
    <h3 style="margin:6px 0">${hi ? 'मुन्नी पढ़ना कैसे सुनती है' : 'How Munni listens to reading'}</h3>
    <div style="font-size:13.5px;line-height:1.55">${hi ? VOICE_TERMS.hi(n) : VOICE_TERMS.en(n)}</div>
    <div style="font-size:12.5px;opacity:.75;margin-top:8px;line-height:1.5">${hi ? VOICE_TERMS.en(n) : VOICE_TERMS.hi(n)}</div>
    <button class="btn" style="margin-top:12px" onclick="voiceTermsAccept()">${hi ? 'मैं माता-पिता/अभिभावक हूँ और सहमत हूँ →' : "I'm the parent or guardian, and I agree →"}</button>
  </div></div>`;
}
function voiceTermsAccept(){
  S.voiceTerms = { v: VOICE_TERMS_V, at: new Date().toISOString(), by: 'parent (onboarding)' };
  log(null, `Reading terms (v${VOICE_TERMS_V}) accepted by a grown-up for ${S.name || 'this child'} — reading is checked with Sarvam when online; recordings are not kept`);
  S.ob = null;
  if(typeof circleOnboardWanted === 'function' && circleOnboardWanted()){ S.ob = { step:'grownup' }; saveSoon(); return render(); }
  saveSoon();
  if(S.game) goHub(); else go('pick');
}

const blobB64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(blob); });

/* Same shape as listen(): onResult(alternatives) or onEnd(reason); returns { stop }. */
function cloudListen(onResult, onEnd, opts){
  let rec = null, stream = null, over = false, timer = null, ac = null, raf = null;
  const chunks = [];
  const words = String((opts && opts.text) || S.ctx.sentence || '').split(/\s+/).length;
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
      log(2, `Reading check · written down by ${d.provider} (verbatim) on the voice server — the recording is not kept — and graded here on the phone`);
      S.ctx.heardBy = d.provider;
      end(onResult, [{ transcript: d.transcript, confidence: 0.9 }]);
    }catch(e){ end(onEnd, 'network'); }
  }
  return { stop(){ if(over) return; over = true; cleanup(); chunks.length = 0; if(rec && rec.state === 'recording') try{ rec.stop(); }catch(e){} } };
}

/* The parent page: what was agreed, and the right to withdraw it. */
function cloudReadParentHTML(){
  if(!TALK_URL) return '';
  const hi = S.lang === 'hi', n = attr(S.name || '');
  const t = S.voiceTerms;
  return `<div class="metric" style="display:block">
    <b>${hi ? 'मुन्नी पढ़ना कैसे सुनती है' : 'How Munni listens to reading'}</b>
    <div style="font-size:12.5px;opacity:.75;line-height:1.5;margin-top:4px">${hi ? VOICE_TERMS.hi(n) : VOICE_TERMS.en(n)}</div>
    <div style="font-size:12.5px;margin-top:6px">${t
      ? (hi ? `सहमति दी: ${String(t.at).slice(0, 10)} (शर्तें v${t.v})` : `Agreed on ${String(t.at).slice(0, 10)} (terms v${t.v})`)
      : (hi ? 'सहमति वापस ली गई — आवाज़ फ़ोन से बाहर नहीं जाती; पढ़ना फ़ोन की अपनी पहचान से या लिखकर।' : "Withdrawn — the voice doesn't leave the phone; reading uses the phone's own recognizer, or typing.")}</div>
    ${t ? (S.ctx.termsAsk
      ? `<div style="font-size:12.5px;margin-top:6px">${hi ? `वापस लेने पर ${n} की पढ़ाई की जाँच कम सटीक होगी और मुन्नी गलतियाँ उतनी अच्छी तरह नहीं सिखा पाएगी।` : `If you withdraw, ${n}'s reading is checked less closely and Munni can't teach slips as well.`}</div>
         <div class="row" style="gap:8px;margin-top:6px"><button class="btn ghost" onclick="voiceTermsWithdraw()">${hi ? 'हाँ, वापस लें' : 'Yes, withdraw'}</button><button class="btn" onclick="S.ctx.termsAsk=false;render()">${hi ? 'रहने दें' : 'Keep it'}</button></div>`
      : `<button class="btn ghost" style="margin-top:6px" onclick="S.ctx.termsAsk=true;render()">${hi ? 'सहमति वापस लें' : 'Withdraw consent'}</button>`)
      : `<button class="btn" style="margin-top:6px" onclick="voiceTermsAgain()">${hi ? 'फिर से सहमत हों' : 'Agree again'}</button>`}
  </div>`;
}
function voiceTermsAgain(){
  S.voiceTerms = { v: VOICE_TERMS_V, at: new Date().toISOString(), by: 'parent (parent page)' };
  log(null, `Reading terms (v${VOICE_TERMS_V}) accepted again by a parent`);
  saveSoon(); render();
}
function voiceTermsWithdraw(){
  S.voiceTerms = null; S.ctx.termsAsk = false;
  log(null, 'Reading terms withdrawn by a parent — from now on no recording leaves the phone');
  saveSoon(); render();
}
