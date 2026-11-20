/* ================= HANDLERS ================= */
// The handle listen() returns (a live SpeechRecognition object, when
// WebSpeech is actually running) — kept here, not on S, because it is a
// live browser object, not app state. Retained specifically so a turn
// nobody is waiting on any more (the child moved to the next sentence, a
// different screen, or a different profile) can be told to stop instead
// of going on to fire onresult/onerror against state that has moved on.
let ACTIVE_LISTEN = null;

function nextSentence(){
  if(typeof stopListening === 'function') stopListening();        // abandon any recognizer still listening for the sentence we're leaving
  if(typeof selfListenReset === 'function') selfListenReset();   // revoke any clip from the last attempt before it's unreachable
  // Drain any remaining due-for-review sentences (see VIEWS.read) before
  // going back to the normal random pool — same invisible spaced
  // repetition, carried across "Next" the way it carries across the
  // session's first sentence.
  SAY = null;                                                     // "say it with Munni" belongs to the line being left
  const queue = S.ctx._srsQueue || [];
  const again = typeof readAgainNext === 'function' ? readAgainNext() : null;   // a line the clearer check had to skip
  if(again){
    S.ctx = { sentence: again, _srsQueue: queue };
  } else if(queue.length){
    S.ctx = { sentence: queue[0], _srsQueue: queue.slice(1) };
  } else {
    const pool = ageSentences(S.lang, S.levels.read);
    S.ctx = { sentence: twinPickLine(pool) };
  }
  render();
}
function setReadLang(l){
  if(S.lang===l) return;
  S.lang = l;
  log(null, 'Reading language → ' + (l==='hi'?'Hindi (hi-IN)':'English (en-IN)'));
  nextSentence();
}
let STT_PREPARED = false;   // the first mic tap of a session also fetches offline language packs, while online
function startListening(){
  if(S.ctx.live) return;
  if(!STT_PREPARED && navigator.onLine){ STT_PREPARED = true; prepareOfflineSpeech(); }
  S.ctx.live = true; S.ctx.unsure = false; render();
  log(0,`Mic open · recognizer lang ${S.lang==='hi'?'hi-IN':'en-IN'} · 5 alternatives`);
  // A second, independent mic session for self-listen — listen() below
  // consumes its own stream internally and never exposes it, so this
  // cannot attach to it; the two start together and stop on the same
  // two signals (a result, or a recognizer error).
  if(typeof selfListenStart === 'function') selfListenStart();
  // online, under the reading terms: Sarvam hears it (ui/cloud-read.js); otherwise the
  // phone's own on-device recognizer — never a general cloud one without the terms
  S.ctx.heardBy = null;
  const hear = cloudReadReady() ? cloudListen : deviceListenAllowed() ? listen : (ok, end) => { end('no-terms'); return null; };
  ACTIVE_LISTEN = hear(alts=>{
    ACTIVE_LISTEN = null;
    if(typeof selfListenStop === 'function') selfListenStop();
    checkRead(alts);
  }, err=>{
    ACTIVE_LISTEN = null;
    if(typeof selfListenStop === 'function') selfListenStop();
    S.ctx.live=false;
    if(err === 'skipped' && typeof readAgainQueue === 'function') readAgainQueue(S.ctx.sentence);   // not graded: kept to read again later
    if(err && err!=='no-speech'){
      S.ctx.msg = micReason(err);
      log(null,'recognizer error: '+err);
    }
    render();
  });
}
/* The other half of the "never hangs with no way out" guarantee — see
   core/speech.js's listen(). Called wherever a live turn's screen/sentence/
   profile is about to change from under it (nextSentence(), go(), and
   switchProfile(), the same three reset points self-listen already uses).
   Guarded for a recognizer that never started, or already finished. */
function stopListening(){
  if(ACTIVE_LISTEN && typeof ACTIVE_LISTEN.stop === 'function'){
    try{ ACTIVE_LISTEN.stop(); }catch(e){}
  }
  ACTIVE_LISTEN = null;
}

/* accepts either an alternatives array (from the mic) or a plain string (typed) */
function checkRead(input){
  const alts = typeof input === 'string'
    ? (input.trim() ? [{transcript:input, confidence:1}] : [])
    : (input||[]);
  if(!alts.length) return;
  S.ctx.live = false;

  const r = gradeBest(S.ctx.sentence, alts, S.lang);
  const thresh = typeof getGradeThresholds === 'function' ? getGradeThresholds(S) : { pass: 78 };
  log(0,`Graded ${alts.length} alt(s) · best ${r.score}% · DDA pass threshold ${thresh.pass}% (${band().id}) · conf ${(r.confidence||0).toFixed(2)}${r.shaky?' · shaky pick':''}`);

  // Stage 5 — confidence gate. Never mark a child wrong for the recognizer's doubt.
  const verdict = gradeVerdict(r, S);
  if(verdict === 'unsure'){
    S.ctx.unsure = true; S.ctx.tokens = null; S.ctx.score = null;
    log(0,'Low confidence match → asking again, no attempt recorded');
    render();
    return;
  }

  S.ctx.unsure = false;
  S.ctx.tokens = r.tokens;
  S.ctx.score  = r.score;
  const ok = verdict === 'pass';

  if(ok){
    S.ctx.msg = S.lang==='hi' ? 'बहुत बढ़िया पढ़ा! ⭐' : 'Beautiful reading! ⭐';
    if(r.slips.length) S.ctx.msg += S.lang==='hi'
      ? ` थोड़ा ध्यान: ${r.slips.slice(0,2).join(', ')}`
      : ` Almost perfect on: ${r.slips.slice(0,2).join(', ')}`;
  } else if(r.misread.length){
    S.ctx.msg = S.lang==='hi'
      ? `इन शब्दों पर फिर से: ${r.misread.slice(0,3).join(', ')}`
      : `Let's practise: ${r.misread.slice(0,3).join(', ')}`;
  } else {
    S.ctx.msg = S.lang==='hi' ? 'थोड़ा धीरे, पूरा वाक्य पढ़ो' : 'Slow down a little and read the whole line';
  }

  S.ctx.missed = r.misread || [];             // Ask Munni starts from the word that tripped the child up
  // HOW it went wrong, not only which words (core/lang-mistakes.js) — into the twin
  const slips = lineMistakes(r.tokens, r.extra, S.lang);
  twinCheck('read:' + S.ctx.sentence, null, ok, S.ctx.helped);
  if(!S.ctx.helped) twinNote(readSkill(), slips);
  S.ctx.slip = slips.find(m => langTip(m, S.lang)) || null;
  const moved = S.ctx.helped ? null : record('read', ok);
  if(!S.ctx.helped) mindAttempt(readSkill(), ok);
  if(moved==='up') S.ctx.msg += S.lang==='hi' ? ' · नया स्तर! 🎉' : ' · New level! 🎉';
  S.ctx.passed = ok;
  render();

  // a slip: Munni teaches the right way to say the word, the child says it (ui/say-it.js) —
  // straight away when the line didn't pass, as a button when it did
  const teach = !S.ctx.helped && ((S.ctx.slip && S.ctx.slip.word) || r.misread[0] || (ok ? r.slips[0] : null));
  if(teach) sayOffer(r, S.ctx.slip);
  // no word to teach (the line was cut short): the child's way — Munni reads the whole line again
  else if(!ok && S.ctx.readWay === 'model') setTimeout(()=>speak(S.ctx.sentence), 420);
  if(!ok && r.misread.length) tier1Offer(r.misread.slice(0,2));
}

/* Tier 1: one more line using the words just missed (core/tier1.js).
   Offered, never forced — it appears under the feedback as a button. */
async function tier1Offer(words){
  const sentence = S.ctx.sentence;
  const p = await tier1PracticeLine(words, S.lang, S.levels.read, sentence);
  if(!p || S.screen !== 'read' || S.ctx.sentence !== sentence) return;   // the child moved on meanwhile
  S.ctx.practice = p;
  log(1, `Tier 1 · practice line for "${words.join(', ')}" from ${p.source === 'model' ? 'the on-device model' : 'the sentence bank'}`);
  render();
}
function practiseLine(){
  const line = S.ctx.practice && S.ctx.practice.line;
  if(!line) return;
  stopListening();
  selfListenReset();
  S.ctx = { sentence: line };
  render();
}

/* tap any word to hear it on its own — via data-say, so quotes and
   Devanagari can never break the handler */

/* ---- writing pad ----
   Pointer events (mouse, finger and stylus alike), and the strokes kept in
   S.ctx.strokes in CSS pixels: anything that re-renders the screen while a
   child is drawing (narration ending, a sync, the trace panel) used to give
   a fresh, empty canvas with no ink — now setupPad() draws the strokes back. */
let drawing=false, hasInk=false;
function setupPad(){
  const g=$('guide'), c=$('ink'); if(!g || !c) return;
  const w=g.parentElement.clientWidth || 300, h=g.parentElement.clientHeight || 246;
  [g,c].forEach(cv=>{ cv.width=w*2; cv.height=h*2; const x=cv.getContext('2d'); x.setTransform(2,0,0,2,0,0); });
  const gx=g.getContext('2d');
  gx.clearRect(0,0,w,h);
  gx.fillStyle='#EDE6D2'; gx.textAlign='center'; gx.textBaseline='middle';
  const size = S.ctx.glyph.length>2 ? h*0.45 : h*0.8;
  gx.font=`700 ${size}px 'Baloo 2', 'Noto Sans Devanagari', sans-serif`;
  gx.fillText(S.ctx.glyph, w/2, h/2);
  const cx=c.getContext('2d');
  const pen=()=>{ cx.lineWidth=14; cx.lineCap='round'; cx.lineJoin='round'; cx.strokeStyle='#F0A02A'; };
  cx.clearRect(0,0,w,h); pen();
  const strokes = S.ctx.strokes || (S.ctx.strokes = []);
  for(const st of strokes){                     // ink drawn before a re-render comes back
    if(!st.length) continue;
    cx.beginPath(); cx.moveTo(st[0][0], st[0][1]);
    if(st.length === 1) cx.lineTo(st[0][0]+0.1, st[0][1]+0.1);
    for(let i=1;i<st.length;i++) cx.lineTo(st[i][0], st[i][1]);
    cx.stroke();
  }
  hasInk = strokes.some(st => st.length);
  drawing=false;
  const pos=e=>{ const r=c.getBoundingClientRect(); const pt=e.touches?e.touches[0]:e;
    return [(pt.clientX-r.left)*(w/(r.width||w)), (pt.clientY-r.top)*(h/(r.height||h))]; };
  let cur=null;
  const start=e=>{ if(e.button>0) return; e.preventDefault(); drawing=true; hasInk=true;
    try{ if(e.pointerId!=null && c.setPointerCapture) c.setPointerCapture(e.pointerId); }catch(_){}
    const [x,y]=pos(e); cur=[[x,y]]; strokes.push(cur);
    pen(); cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x+0.1,y+0.1); cx.stroke(); };
  const move=e=>{ if(!drawing || !cur) return; e.preventDefault(); const [x,y]=pos(e);
    const [px,py]=cur[cur.length-1]; cur.push([x,y]);
    cx.beginPath(); cx.moveTo(px,py); cx.lineTo(x,y); cx.stroke();
    if(typeof sfxChalk === 'function') sfxChalk(); };
  const end=()=>{ drawing=false; cur=null; };
  if(window.PointerEvent){
    c.onpointerdown=start; c.onpointermove=move; c.onpointerup=end; c.onpointercancel=end; c.onpointerleave=end;
    c.onmousedown=c.onmousemove=c.ontouchstart=c.ontouchmove=c.ontouchend=null;
  }else{                                        // older browsers
    c.onmousedown=start; c.onmousemove=move; window.onmouseup=end;
    c.ontouchstart=start; c.ontouchmove=move; c.ontouchend=end;
  }
}
function clearInk(){ S.ctx.score=null; S.ctx.msg=null; S.ctx.strokes=[]; render(); }
function nextGlyph(){ const pool=GLYPHS[S.lang][S.levels.write]; S.ctx={glyph:pool[Math.floor(Math.random()*pool.length)]}; render(); }
function checkInk(){
  const g=$('guide'), c=$('ink');
  if(!hasInk){ S.ctx.msg = S.lang==='hi'?'पहले अक्षर बनाओ':'Draw the letter first'; S.ctx.score=0; render(); return; }
  const w=g.width, h=g.height;
  const G=g.getContext('2d').getImageData(0,0,w,h).data;
  const C=c.getContext('2d').getImageData(0,0,w,h).data;
  let guideOn=0, hit=0, inkOn=0, spill=0;
  const TOL = 26; // pixels of tolerance, sampled
  for(let i=3;i<G.length;i+=4*4){          // sample every 4th pixel for speed
    const gOn=G[i]>40, cOn=C[i]>40;
    if(gOn) guideOn++;
    if(cOn) inkOn++;
    if(gOn&&cOn) hit++;
    if(cOn&&!gOn) spill++;
  }
  const coverage = guideOn? hit/guideOn : 0;
  const precision = inkOn? 1-(spill/inkOn) : 0;
  const score = Math.max(0, Math.round((coverage*0.65 + precision*0.35)*100));
  log(0,`Stroke check · coverage ${Math.round(coverage*100)}% · precision ${Math.round(precision*100)}%`);
  S.ctx.score = score;
  const ok = score>=62;
  S.ctx.msg = ok ? (S.lang==='hi'?'शाबाश! अक्षर सही बना ⭐':'Nicely shaped! ⭐')
    : coverage<0.5 ? (S.lang==='hi'?'कुछ हिस्सा छूट गया — पूरी लकीर पर चलो':'Some of the letter is missing — trace the whole shape')
    : (S.lang==='hi'?'लकीर से बाहर चले गए — धीरे-धीरे बनाओ':'Your line wandered outside — go slower');
  // HOW the letter went (mirrored, top line missing, a part left out…) — core/lang-mistakes.js
  const slips = ok ? [] : inkMistakes(G, C, w, h, S.lang);
  twinCheck('write:' + S.ctx.glyph, null, ok, false);
  twinNote('write' + S.levels.write, slips);
  S.ctx.slip = slips[0] ? Object.assign({ glyph: S.ctx.glyph }, slips[0]) : null;
  record('write', ok);
  render();
}

/* ================= WRITING: PAPER + CAMERA ================= */
/* The writing tasks this child's class has, first one opens (content/ages.js):
   Nursery–UKG trace; Class 1 trace then paper; Class 2 and up copy on paper
   or take dictation — no tracing above Class 1. */
function writeModes(){
  const w = band().write;
  if(w === 'trace') return ['trace'];
  if(w === 'trace+paper') return ['trace','paper'];
  return ['paper','dictate'];
}
function setWriteMode(m){
  S.ctx = { mode:m }; render();
  if(m === 'dictate' && S.ctx.line) speak(S.ctx.line);
}
function nextLine(mode){
  const m = mode === 'dictate' ? 'dictate' : 'paper';
  const pool = ageSentences(S.lang, S.levels.write);
  S.ctx = { mode:m, line: pool[Math.floor(Math.random()*pool.length)] };
  render();
  if(m === 'dictate') speak(S.ctx.line);
}
function grantCamera(){
  S.camOk = true;
  log(0,'Camera permission granted · photos stay in local storage, never uploaded');
  render();
  setTimeout(()=>{ const c=$('cam'); if(c) c.click(); }, 250);
}

/* Deterministic, on-device photo check: is there actually writing here?
   Grayscale → threshold → ink ratio + row projection to count lines.
   On Android this sits alongside ML Kit Text Recognition v2 (Devanagari). */
function analyseShot(img){
  const W=360, H=Math.max(1, Math.round(img.height * (W/img.width)));
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const cx=cv.getContext('2d'); cx.drawImage(img,0,0,W,H);
  const d=cx.getImageData(0,0,W,H).data;

  let sum=0;
  const lum=new Float32Array(W*H);
  for(let i=0,k=0;i<d.length;i+=4,k++){
    const y=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    lum[k]=y; sum+=y;
  }
  const mean=sum/(W*H);
  const thr=mean*0.72;                       // ink is meaningfully darker than the page
  const rows=new Int32Array(H);
  let ink=0;
  for(let y=0;y<H;y++){ let r=0;
    for(let x=0;x<W;x++) if(lum[y*W+x]<thr) r++;
    rows[y]=r; ink+=r;
  }
  const ratio=ink/(W*H);
  const rowThr=W*0.012;                      // a row counts as "text" if ~1% of it is ink
  let lines=0, run=0;
  for(let y=0;y<H;y++){
    if(rows[y]>rowThr){ run++; }
    else { if(run>=Math.max(2,H*0.012)) lines++; run=0; }
  }
  if(run>=Math.max(2,H*0.012)) lines++;
  return { ratio:+(ratio*100).toFixed(1), lines, ink: ratio>0.004 && ratio<0.34 && lines>=1 };
}

function handleShot(e){
  const f=e.target.files && e.target.files[0]; if(!f) return;
  const fr=new FileReader();
  fr.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const v=analyseShot(img);
      log(0,`Photo checked on device · ink ${v.ratio}% · ${v.lines} line(s) · ${v.ink?'writing found':'no writing found'}`);
      v.msg = v.ink
        ? (S.lang==='hi'?`अच्छा! मुझे तुम्हारी लिखाई दिख रही है — ${v.lines} पंक्ति।`:`Good — I can see your writing, ${v.lines} line${v.lines===1?'':'s'}.`)
        : v.ratio<=0.4
          ? (S.lang==='hi'?'पन्ना खाली लग रहा है। लिखकर फिर तस्वीर लो।':'That page looks empty. Write it first, then photograph it.')
          : (S.lang==='hi'?'तस्वीर बहुत धुँधली या अँधेरी है। रोशनी में फिर लो।':'Too dark or blurry. Try again in better light.');
      S.ctx.shot = fr.result;
      S.ctx.verdict = v;
      render();
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(f);
}

function submitPaper(typed){
  if(!typed || !typed.trim()){
    S.ctx.msg = S.lang==='hi'?'जो लिखा वो टाइप करो।':'Type what you wrote.';
    render(); return;
  }
  if(!S.ctx.verdict || !S.ctx.verdict.ink){
    S.ctx.msg = S.lang==='hi'?'पहले अपनी कॉपी की साफ़ तस्वीर लो।':'Take a clear photo of your notebook first.';
    render(); return;
  }
  const { r, ok } = gradeWritten(typed, 'Paper writing');
  if(ok){
    S.photos.unshift({ img:S.ctx.shot, line:S.ctx.line, score:r.score, when:new Date().toLocaleDateString() });
    log(0,`Saved to the parent's notebook shelf · ${S.photos.length} photo(s) on device`);
  }
  record('write', ok);
  render();
}

/* The written line, checked word by word like reading — shared by paper and dictation. */
function gradeWritten(typed, what){
  const r = gradeReading(S.ctx.line, typed, S.lang);
  log(0,`${what} graded · ${r.score}% match against the target line`);
  S.ctx.tokens = r.tokens; S.ctx.score = r.score;
  const ok = r.score >= 75;
  // spelling: the same word checks as reading (a vowel sign left out, a half letter dropped…)
  const slips = lineMistakes(r.tokens, r.extra, S.lang).filter(m => m.id !== 'stopped' && m.id !== 'added');
  twinNote('write' + S.levels.write, slips);
  S.ctx.slip = slips.find(m => langTip(m, S.lang)) || null;
  S.ctx.msg = ok
    ? (S.lang==='hi'?'बहुत सुंदर लिखा! ⭐':'Beautifully written! ⭐')
    : (S.lang==='hi'?`इन शब्दों को फिर देखो: ${r.misread.slice(0,3).join(', ')}`:`Check these again: ${r.misread.slice(0,3).join(', ')}`);
  return { r, ok };
}

/* Dictation (Class 3+): Munni said the line, the child wrote it in their
   notebook and typed it back. No photo needed — a phone with no camera,
   or a child who said "not now" to it, still writes. */
function submitDictation(typed){
  if(!typed || !typed.trim()){
    S.ctx.msg = S.lang==='hi'?'जो लिखा वो टाइप करो।':'Type what you wrote.';
    render(); return;
  }
  const { ok } = gradeWritten(typed, 'Dictation');
  record('write', ok);
  render();
}

/* ================= ARITHMETIC ANIMATION ================= */
/* Three explainer modes, chosen by the problem — objects, number line, array. */
/* "Show me": every step waits for Munni to finish saying it before the
   next one starts. speak() cancels whatever is still playing, so steps on
   fixed timers cut each other off and the child heard only the last line
   (the answer). mathSay() resolves when the line has been said (or, muted,
   after a short pause), so the explanation is heard in full, in order. */
const mathWait = ms => new Promise(r => setTimeout(r, ms));
function mathSay(text, minMs){
  return Promise.all([
    new Promise(r => { let done = false; const fin = () => { if(!done){ done = true; r(); } };
      setTimeout(fin, 900 + String(text).split(/\s+/).length * 700 + 2500);   // a voice that never ends can't stall the scene
      try{ speak(text, null, fin); }catch(e){ fin(); } }),
    mathWait(minMs || 500)
  ]);
}
async function playMath(){
  if(S._mathBusy) return;
  const p=S.ctx.p, g=gameById(S.game), st=$('mstage'); if(!st) return;
  const sk = skillOfProblem(p); if(sk && !S.ctx.helped) mindTaught(sk, 'show');   // watching it happen is a way of being taught
  S._mathBusy = true;
  const run = S._mathRun = (S._mathRun || 0) + 1;
  const live = () => S._mathRun === run && S.screen === 'math' && !!$('mstage');   // left the screen or started again: stop
  const hi = S.lang === 'hi';
  const obj = g.proj || g.ic;
  const narr = m => { const n=$('mnarr'); if(n) n.textContent=m; };
  const big = Math.max(p.a,p.b) > 12 || (p.op!=='×' && p.a+p.b > 15);
  try{
    if(p.op==='×'){                                  /* ---- array grid ---- */
      log(0,`Explainer · array · ${p.b} rows of ${p.a}`);
      st.innerHTML=`<div class="arrgrid" id="grid"></div><div class="tally" id="tal"></div><div class="narr" id="mnarr"></div>`;
      const grid=$('grid'), line = hi?`${p.b} पंक्तियाँ, हर एक में ${p.a}`:`${p.b} rows of ${p.a}`;
      narr(line);
      const spans=[];
      for(let r=0;r<p.b;r++){
        const row=document.createElement('div'); row.className='row';
        for(let c=0;c<p.a;c++){
          const s=document.createElement('span'); s.className='obj'; s.textContent=obj;
          s.style.fontSize = p.a*p.b>28?'15px':'20px'; spans.push(s); row.appendChild(s);
        }
        grid.appendChild(row);
      }
      spans.forEach((s,k)=>setTimeout(()=>s.classList.add('in'), k*55));
      await mathSay(line, spans.length*55+300); if(!live()) return;
      // count the rows out loud: 4, 8, 12…
      const rows=[...grid.querySelectorAll('.row')];
      for(let r=0;r<rows.length;r++){
        rows[r].querySelectorAll('.obj').forEach(o=>o.classList.add('tick'));
        const tl=$('tal'); if(tl) tl.textContent=(r+1)*p.a;
        await mathSay(String((r+1)*p.a), 450); if(!live()) return;
        rows[r].querySelectorAll('.obj').forEach(o=>o.classList.remove('tick'));
      }
      narr(hi?`कुल ${p.ans}`:`That makes ${p.ans}`);
      await mathSay(hi?`कुल ${p.ans}`:`That makes ${p.ans}`);
      return;
    }

    if(big){                                          /* ---- number line ---- */
      log(0,`Explainer · number line · start ${p.a}, ${p.op==='+'?'forward':'back'} ${p.b}`);
      const lo=Math.max(0,Math.min(p.a,p.ans)-3), hiN=Math.max(p.a,p.ans)+3, span=hiN-lo;
      const ticks=[...Array(span+1)].map((_,i)=>{
        const x=20+(i*(320/span));
        const label=(lo+i)%5===0 || lo+i===p.a || lo+i===p.ans;
        return `<line x1="${x}" y1="26" x2="${x}" y2="${label?36:32}" stroke="#A9B8AF" stroke-width="1"/>
                ${label?`<text x="${x}" y="50" fill="#A9B8AF" font-size="9" text-anchor="middle">${lo+i}</text>`:''}`;
      }).join('');
      st.innerHTML=`<svg class="nline" viewBox="0 0 360 62">
          <line x1="20" y1="26" x2="340" y2="26" stroke="#A9B8AF" stroke-width="1.5"/>${ticks}
          <g class="nmark" id="mk" transform="translate(${20+((p.a-lo)*(320/span))},0)">
            <circle cx="0" cy="26" r="7" fill="#F0A02A"/><text x="0" y="15" fill="#F0A02A" font-size="11" text-anchor="middle" font-weight="700">${obj}</text>
          </g></svg>
        <div class="tally" id="tal">${p.a}</div><div class="narr" id="mnarr"></div>`;
      narr(hi?`${p.a} से शुरू, ${p.b} कदम ${p.op==='+'?'आगे':'पीछे'}`:`Start at ${p.a}, hop ${p.b} ${p.op==='+'?'forward':'back'}`);
      await mathSay(hi?`${p.a} से शुरू करो, ${p.b} कदम ${p.op==='+'?'आगे':'पीछे'}`:`Start at ${p.a}. Hop ${p.b} ${p.op==='+'?'forward':'back'}`); if(!live()) return;
      let cur=p.a;
      for(let i=1;i<=p.b;i++){
        cur += (p.op==='+'?1:-1);
        const mk=$('mk'); if(mk) mk.setAttribute('transform',`translate(${20+((cur-lo)*(320/span))},0)`);
        const tl=$('tal'); if(tl) tl.textContent=cur;
        if(typeof sfxPop === 'function') try{ sfxPop(); }catch(e){}
        await mathWait(p.b>12?220:380); if(!live()) return;
      }
      narr(hi?`जवाब ${p.ans}`:`We land on ${p.ans}`);
      await mathSay(hi?`हम ${p.ans} पर पहुँचे`:`We land on ${p.ans}`);
      return;
    }

    /* ---- object counting ---- */
    log(0,`Explainer · counting ${obj} · ${p.a} ${p.op} ${p.b}`);
    st.innerHTML=`<div class="plusrow">
        <div class="grp" id="gA"></div><div class="opsign">${p.op}</div><div class="grp" id="gB"></div>
      </div><div class="tally" id="tal"></div><div class="narr" id="mnarr"></div>`;
    const mk=(host,n,cls)=>{ for(let i=0;i<n;i++){
        const s=document.createElement('span'); s.className='obj'; s.textContent=obj;
        setTimeout(()=>s.classList.add(cls), i*130); host.appendChild(s); } };
    narr(hi?`पहले ${p.a}`:`First, ${p.a}`);
    mk($('gA'), p.a, 'in');
    await mathSay(hi?`पहले ${p.a}`:`First, ${p.a}`, p.a*130+300); if(!live()) return;

    let toCount;
    if(p.op==='+'){
      narr(hi?`फिर ${p.b} और आए`:`Then ${p.b} more arrive`);
      mk($('gB'), p.b, 'fly');
      await mathSay(hi?`फिर ${p.b} और आए`:`Then ${p.b} more arrive`, p.b*130+300); if(!live()) return;
      toCount=[...document.querySelectorAll('#gA .obj'),...document.querySelectorAll('#gB .obj')];
    } else {
      narr(hi?`${p.b} चले गए`:`${p.b} go away`);
      const gone=[...document.querySelectorAll('#gA .obj')].slice(-p.b);
      gone.forEach((el,i)=>setTimeout(()=>el.classList.add('leave'), i*150));
      await mathSay(hi?`${p.b} चले गए`:`Take away ${p.b}`, p.b*150+400); if(!live()) return;
      toCount=[...document.querySelectorAll('#gA .obj')].slice(0, p.a-p.b);
    }
    await countObjects(toCount, narr, live);
  } finally {
    if(S._mathRun === run) S._mathBusy = false;
  }
}
async function countObjects(els, narr, live){
  const hi = S.lang === 'hi';
  narr(hi?'अब गिनो…':'Now count…');
  await mathSay(hi?'अब गिनो':'Now count with me', 300); if(live && !live()) return;
  for(let i=0;i<els.length;i++){
    els[i].classList.add('tick');
    const tl=$('tal'); if(tl) tl.textContent=i+1;
    await mathSay(String(i+1), 380); if(live && !live()) return;
    els[i].classList.remove('tick');
  }
  narr(hi?`कुल ${els.length}`:`That makes ${els.length}`);
  await mathSay(hi?`कुल ${els.length}`:`That makes ${els.length}`);
}
function answerMath(o){
  if(S.ctx.picked!=null) return;
  if(typeof sfxPop === 'function') sfxPop();
  S.ctx.picked=o;
  const ok = o===S.ctx.p.ans;
  S.ctx.msg = ok ? (S.lang==='hi'?'सही! ⭐':'Correct! ⭐')
                 : (S.lang==='hi'?`जवाब है ${S.ctx.p.ans} — देखो कैसे`:`The answer is ${S.ctx.p.ans} — watch why`);
  const sk = skillOfProblem(S.ctx.p);
  twinCheck(twinKeyMath(S.ctx.p), o, ok, S.ctx.helped);   // was the twin's guess right? (core/twin.js)
  if(S.ctx.planMore){                         // the school lesson's harder/easier step is answered
    const m = S.ctx.planMore, sc = (S.lessonScores || {})[m.lesson];
    if(sc && !sc.x){ sc.x = ok && !S.ctx.helped ? 'y' : 'n'; log(0, `Plan · the step after the school lesson (${m.skill}) · ${ok ? 'right' : 'not yet'}`); saveSoon(); }
    S.ctx.planMore = null;
  }
  if(!S.ctx.helped){
    record('math', ok);                       // after Ask Munni explained it, the answer isn't counted as the child's own
    if(sk){
      mindAttempt(sk, ok);                    // the child's own answer settles a teaching round (core/mind.js)
      twinObserve(sk, ok, S, 1 / S.ctx.p.opts.length);
      const bug = twinAnswer(sk, S.ctx.p, o);
      // a wrong answer a known mistake explains gets help aimed at that mistake
      if(!ok && MISTAKES[bug]) S.ctx.tip = { id: bug, habit: !!(twinHabit(sk) && twinHabit(sk).id === bug) };
    }
  }
  render();
  if(ok) speak(S.lang==='hi'?'सही':'Correct');
  else if(S.ctx.helped) setTimeout(playMath, 500);
  else mindTeachMath(S.ctx.p);         // a missed sum is taught the way that works for this child
}
function nextProblem(){ S.ctx={p:mindPracticeProblem()}; render(); }

/* ---- ask / the bridge ---- */
function findOffline(q){
  const s=q.toLowerCase();
  return OFFLINE_PACK.find(p=>p.keys.some(k=>s.includes(k)));
}
/* Munni is the loading state now: she plays out her praise → search → found
   sequence while resolve() does the real work in the background, and the
   screen only actually changes once she settles — see elephant.js. */
function submitQuestion(q){
  if(!q || !q.trim()) return;
  if(S.eleph && S.eleph.mood !== 'idle') return;
  elephAsk(q, () => new Promise(resolve => {
    const local = findOffline(q);
    if(local){
      log(0,'Question matched the on-device pack · no network needed');
      S.ctx.answer = { ...local, title: S.lang==='hi'? local.hi : local.title };
      S.ctx.panel = 0;
      resolve('answered');
    } else if(S.online){
      askCloud(q).then(ok => resolve(ok ? 'answered' : 'queued'));
    } else {
      queueQuestion(q);
      log(0,'No signal · question queued to disk, nothing lost');
      resolve('queued');
    }
  }), (outcome) => { if(outcome === 'answered' && S.ctx.answer) speakPanel(0); });
}
/* One saved question per wording: asking again while it waits doesn't add a copy. */
function queueQuestion(q){
  const key = q.trim().toLowerCase();
  if(!S.queue.some(x => String(x.q).trim().toLowerCase() === key)) S.queue.push({ id:'q'+Date.now(), q: q.trim() });
}
/* The Tier 2 call itself, shared by a live question and the queue's sync. */
async function cloudAnswer(prompt){
  const res = await fetch(API_URL,{
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ max_tokens:1000, messages:[{role:"user",content:prompt}], cls: band().cls })
  });
  if(!res.ok){
    const body = await res.text().catch(()=>'');
    const err = new Error('Tier 2 proxy returned HTTP '+res.status);
    err.status = res.status; err.body = body;
    throw err;
  }
  const data = await res.json();
  const txt = (data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('').replace(/```json|```/g,'').trim();
  const a = JSON.parse(txt);
  if(!a || !Array.isArray(a.panels) || !a.panels.length) throw new Error('Tier 2 answer had no panels');
  return a;
}
/* What went wrong, in words for the trace panel — never a page of HTML. */
function cloudProblem(e){
  if(!e || !e.status) return 'could not be reached';
  let why = '';
  try{ why = (JSON.parse(e.body||'{}').error) || ''; }catch(x){ why = ''; }
  if(e.status === 404) return 'has no /api/ask on this server (start the app with npm run dev, not a static server)';
  if(e.status === 503) return 'has no Gemini key on this server (GEMINI_API_KEY)';
  return `returned an error (HTTP ${e.status}${why ? ' · ' + String(why).slice(0,80) : ''})`;
}
function askPrompt(q){
  // pitched for THIS child (core/twin.js) — only if a parent agreed to share
  // progress (the learning circle or Talking Munni); ids made into sentences, no name
  const about = (S.circleSync || S.talkMunni) && typeof twinPrompt === 'function' ? `\nAbout this child: ${twinPrompt(twinProfile())}` : '';
  // the class goes to the server as its id (cloudAnswer): the server puts its own profile of it first (api/lib/class-profile.mjs)
  return `A child in India, in ${band().clsEn}, asked: "${q}".${about}
Reply ONLY with JSON, no markdown fences:
{"title":"the question restated simply","panels":[{"art":"ONE emoji","en":"one short simple sentence","hi":"same sentence in simple Hindi"},{...},{...}],"quiz":{"en":"one simple check question","hi":"same in Hindi","opts":["right","wrong"],"hiOpts":["right in Hindi","wrong in Hindi"],"correct":0}}
Exactly 3 panels. Each sentence under 18 words, warm, concrete, no jargon. Keep it factual and age-appropriate.`;
}
async function askCloud(q){
  log(2,'Signal available · generating answer + storyboard');
  const prompt = askPrompt(q);
  try{
    const a = await cloudAnswer(prompt);
    a.id = 'a'+Date.now();
    S.answered.unshift(a);
    log(2,'Answer cached to device · available offline from now on');
    // state only — no render()/speak() here. The elephant owns the reveal;
    // rendering now would flip the screen out from under her mid-animation.
    S.ctx.answer=a; S.ctx.panel=0;
    return true;
  }catch(e){
    // The cloud is optional, but honesty is not: showing a cached answer to a
    // DIFFERENT question would teach the child that Takhti makes things up.
    // Queue it instead — exactly what happens with no signal.
    queueQuestion(q);
    // A silent Tier 2 failure in front of judges is the worst case — tell the
    // trace panel WHICH kind of failure this was, not just that one happened.
    if(e && e.status){
      log(null, `Tier 2 ${cloudProblem(e)} · question queued, nothing lost`);
    } else {
      log(0, S._cloudNoted
        ? 'No Tier 2 endpoint reachable · question queued'
        : 'No Tier 2 endpoint here (no /api/ask proxy running) · question queued, nothing lost');
      S._cloudNoted = true;
    }
    S.ctx.answer = null;
    S.ctx.saved = q;
    return false;
  }
}
function openAnswer(id){ const a=S.answered.find(x=>x.id===id); if(a){ S.ctx.answer=a; S.ctx.panel=0; render(); speakPanel(0);} }
function speakPanel(i){ const a=S.ctx.answer; if(a) speak(a.panels[i][S.lang]||a.panels[i].en); }
function answerQuiz(i,correct){
  if(S.ctx.quizDone) return;
  const ok = i===correct;
  $('qfb').textContent = ok ? (S.lang==='hi'?'बिलकुल सही! ⭐':'Exactly right! ⭐') : (S.lang==='hi'?'फिर से सोचो':'Have another think');
  if(ok){ S.ctx.quizDone = true; S.stars++; log(0,'Comprehension checkpoint passed'); }
}


/* ---- parent controls ---- */
function setTarget(k, d){
  S.targets[k] = Math.max(1, Math.min(20, S.targets[k]+d));
  log(0, `Parent set target · ${k} = ${S.targets[k]} per day`);
  render();
}
function setParentAge(d){
  S.age = Math.max(3, Math.min(AGE_SHOWN_MAX, (S.age||6) + d));
  // the band may have narrowed — pull current levels back inside its window
  S.levels.read  = clampLevel('read',  S.levels.read);
  S.levels.write = clampLevel('write', S.levels.write);
  S.levels.math  = clampLevel('math',  S.levels.math);
  log(0, `Parent set age → ${S.age} · band "${band().id}"`);
  saveSoon();
  render();
}

/* The class decides what is taught (content/ages.js CLASSES). A parent
   (or the school, later through the roster) moves it one step at a time;
   levels are pulled back inside the new class's band, and a class that
   starts higher lifts a child sitting below its start. */
function setParentClass(d){
  if(S.clsBy === 'school') return;   // the school's roster sets it (core/class-sync.js)
  const shown = classesShown(), i = shown.findIndex(k => k.id === classFor(S).id);
  const k = shown[Math.max(0, Math.min(shown.length - 1, i < 0 ? shown.length - 1 : i + d))];
  setChildClass(k.id);
  log(0, `Parent set class → ${k.en} · band "${band().id}" · stage ${band().stage}`);
  saveSoon();
  render();
}
function setChildClass(id){
  if(!classById(id)) return;
  S.cls = id;
  for(const m of ['read','write','math']) S.levels[m] = clampLevel(m, S.levels[m]);
  S.ctx = {};          // a writing tab the new class doesn't have must not linger
}

/* ---- sound, per child — see core/speech.js's speak() and ui/elephant.js's
   trumpet(), both of which check S.muted directly. Reachable from the
   parent dashboard, not just the one-time arrival screen, since a parent
   may want to silence the app in a quiet room long after that first tap. */
function toggleMuted(){
  S.muted = !S.muted;
  if(S.muted) sfxAmbientStop();   // a looping sound must stop now, not at the next screen change
  log(0, `Sound ${S.muted ? 'muted' : 'unmuted'} for ${S.name || 'this child'}`);
  saveSoon();
  render();
}

/* ---- teacher class code ---- */
function setClassCode(v){
  const code = (v||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)){
    S.ctx.classCodeErr = true; render(); return;
  }
  S.ctx.classCodeErr = false;
  S.classCode = code;
  log(0, `Class code linked · ${code} · this child's progress will mirror to their teacher`);
  saveSoon();
  mirrorToClassNow(S);   // don't wait for the next checkpoint — link should feel immediate
  applySchoolClass(code);   // the school's class, if this phone already knows it
  render();
}
function unlinkClassCode(){
  S.classCode = null;
  if(S.clsBy === 'school') S.clsBy = null;   // the class stays; the parent may change it again
  log(0, 'Class code unlinked · this child no longer mirrors to a teacher');
  saveSoon();
  render();
}

/* ---- class sync (core/class-sync.js) ---- */
function toggleSyncConsent(){
  S.syncOn = !S.syncOn;
  log(0, `Parent ${S.syncOn ? 'switched ON' : 'switched off'} class sync for ${S.name}`);
  save();
  render();
  if(S.syncOn) syncNow(S.classCode);
}
async function syncNow(code){
  const p = syncClass(code);
  render();                 // show "Syncing…" straight away
  await p;
  render();
}

/* ---- sharing with a teacher on another phone (core/class-share.js) ---- */
function makeReportCode(){
  S.ctx.reportCode = classReportCode(S);
  S.ctx.shared = '';
  render();
}
/* The phone's own share sheet (WhatsApp, SMS…) where there is one, else
   the clipboard; the code is also shown, selectable, on screen. */
async function shareText(text){
  const hi = S.lang === 'hi';
  try{
    if(navigator.share){ await navigator.share({ text }); S.ctx.shared = hi ? 'भेज दिया।' : 'Sent.'; }
    else { await navigator.clipboard.writeText(text); S.ctx.shared = hi ? 'कॉपी हो गया — अब WhatsApp/SMS में चिपकाओ।' : 'Copied — paste it into WhatsApp or SMS.'; }
  }catch(e){
    S.ctx.shared = hi ? 'ऊपर का कोड दबाकर कॉपी करो।' : 'Tap the code above to select and copy it.';
  }
  render();
}
function receiveHomework(text){
  const hi = S.lang === 'hi';
  const r = importHomework(text, S);
  S.ctx.hwOk = r.ok;
  S.ctx.hwMsg = r.ok
    ? (hi ? 'गृहकार्य जुड़ गया — मुन्नी कहानी की आग के पास इंतज़ार करेगी।' : 'Homework added — Munni will wait at the Story Fire.')
    : r.why === 'otherclass'
      ? (hi ? 'यह कोड दूसरी कक्षा का है।' : 'This code is for a different class.')
      : (hi ? 'यह पूरा गृहकार्य कोड नहीं लगता — फिर से कॉपी करके देखो।' : "That doesn't look like a whole homework code — try copying it again.");
  if(r.ok){ log(0, `Homework received by code · class ${r.code} · ${r.skills.join(', ')}`); saveSoon(); }
  render();
}

/* ---- on-device capabilities, shown on the parent dashboard ---- */
async function refreshDeviceStatus(){
  S.ctx.dev = { en: STT_LOCAL.en, hi: STT_LOCAL.hi, model: await tier1ModelStatus(S.lang) };
  if(S.screen === 'parent') render();
}
async function getOfflineReading(){
  await prepareOfflineSpeech();
  S.ctx.dev = null;
  refreshDeviceStatus();
}
AFTER.parent = () => { if(!S.ctx.dev) refreshDeviceStatus(); };

/* ---- parent PIN gate ---- */
function setParentPin(v){
  const p = (v||'').trim();
  if(!/^\d{4}$/.test(p)){ S.ctx.pinErr = true; render(); return; }
  S.parentPin = p;
  log(null, 'Parent PIN set · stored only on this device');
  saveSoon();
  go('parent');
}
function checkParentPin(v){
  const p = (v||'').trim();
  if(p === S.parentPin) go('parent');
  else { S.ctx.pinErr = true; render(); }
}

/* ---- games shelf entry point ----
   The shelf (ui/views.js's games()) calls this for every BUILT shell.
   Each shell owns its own begin function (e.g. runner.js's runnerBegin())
   which sets up S.game_/its own state fully BEFORE go() switches the
   screen — so the very first render already has a real round to show,
   with no placeholder frame in between. Add one branch per shell as it
   ships; nothing here is runner-specific beyond the dispatch itself. */
function playGame(kind){
  if(kind === 'runner' && typeof runnerBegin === 'function'){ runnerBegin(); go('runner'); }
  else if(kind === 'pop'    && typeof popBegin    === 'function'){ popBegin();    go('pop'); }
  else if(kind === 'tower'  && typeof towerBegin  === 'function'){ towerBegin();  go('tower'); }
  else if(kind === 'match'  && typeof matchBegin  === 'function'){ matchBegin();  go('match'); }
  else if(kind === 'sort'   && typeof sortBegin   === 'function'){ sortBegin();   go('sort'); }
  else if(kind === 'archer' && typeof archerBegin === 'function'){ archerBegin(); go('archer'); }
}

/* ---- parent audio ---- */
function readReport(){
  const pct=m=>S.attempts[m]?Math.round(S.correct[m]/S.attempts[m]*100):0;
  speak(S.lang==='hi'
    ? `${S.name} ने पढ़ने में ${pct('read')} प्रतिशत सही किया। अभी स्तर ${S.levels.read} पर है।`
    : `${S.name} is reading at level ${S.levels.read}, ${pct('read')} percent correct. Counting is at level ${S.levels.math}.`);
}

/* ---- connectivity ---- */
function setOnline(v){
  S.online = v;
  $('nettoggle').classList.toggle('on', v);
  const pill=$('netpill');
  pill.className = 'pill '+(v?'on':'off');
  pill.textContent = v ? 'ONLINE · EXTRAS ON' : 'AIRPLANE MODE';
  $('netlabel').textContent = v? 'Signal' : 'No signal';
  log(null, v? 'Signal detected' : 'Signal lost — nothing in the lesson changes');
  if(!v) talkLeave();   // a Talking Munni call needs the signal; everything else carries on
  if(v && S.queue.length) flushQueue();
  if(v && typeof circleSync === 'function') circleSync(true);   // the learning circle, if a parent turned it on
}
async function flushQueue(){
  // a queue saved before copies were stopped may hold the same question twice
  const seen = new Set();
  S.queue = S.queue.filter(x => { const k = String(x.q).trim().toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; });
  log(2,`Sync · ${S.queue.length} saved question(s) being answered in the background`);
  const items=[...S.queue];
  for(const it of items){
    const local = findOffline(it.q);
    if(local){ S.answered.unshift({...local, id:it.id}); }
    else {
      try{
        const a = await cloudAnswer(askPrompt(it.q));
        a.id=it.id; S.answered.unshift(a);
      }catch(e){
        // leave it in the queue rather than inventing an answer;
        // it will be retried the next time a signal appears
        log(null, `Still no answer for "${it.q}" · Tier 2 ${cloudProblem(e)} · staying in the queue`);
        continue;
      }
    }
    S.queue = S.queue.filter(x=>x.id!==it.id);
    log(2,`Cached: "${it.q}" — now permanent on this device`);
    render();
  }
}

/* Ask by voice (20 Nov): a young child says the question instead of typing
   it. It goes through the same submitQuestion() as a typed one. Held in
   ACTIVE_LISTEN so leaving the screen (go() → stopListening()) stops it,
   and a question heard after the child has left is dropped. */
function askByVoice(){
  const hi = S.lang === 'hi';
  const btn = $('askmic');
  if(ACTIVE_LISTEN){ stopListening(); if(btn){ btn.classList.remove('live'); } return; }
  if(btn){ btn.classList.add('live'); btn.textContent = '👂 ' + (hi ? 'मुन्नी सुन रही है…' : 'Munni is listening…'); }
  let heard = '';
  ACTIVE_LISTEN = listen(alts => { heard = ((alts[0] && alts[0].transcript) || '').trim(); }, err => {
    ACTIVE_LISTEN = null;
    if(S.screen !== 'ask') return;
    if(heard){ submitQuestion(heard); return; }
    const b = $('askmic');
    if(b){ b.classList.remove('live'); b.textContent = '🎤 ' + (hi ? 'फिर से बोलो' : 'Tap and try again'); }
    // the recognizer can't run here: the typing box comes back for a grown-up
    if(err && err !== 'no-speech' && err !== 'aborted'){
      const box = document.querySelector('#screen .kid-type');
      if(box) box.classList.add('show');
    }
  });
}
