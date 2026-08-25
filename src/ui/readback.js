/* ==================================================================
   READ IT BACK
   The child reads whatever is on the card aloud. We grade it against
   the displayed text with the same Tier 0 matcher the reading loop
   uses, then either celebrate and move on, or mark exactly where it
   went wrong and coach that word.

   Long text is split into chunks first — a whole fact sentence is too
   much for a six-year-old to hold in one breath, and grading a long
   utterance hides which part actually failed.
   ================================================================== */

const RB_WORD_PASS = 65;     // single-word practice is more forgiving
const RB_MAX_TRIES = 3;      // after this we switch to echo practice

/* --- split into speakable chunks of roughly 8 words, at punctuation --- */
function rbChunks(text){
  const clean = String(text).replace(/\s+/g,' ').trim();
  const words = clean.split(' ');
  if(words.length <= 10) return [clean];
  const parts = clean.split(/(?<=[,;:—।.!?])\s+/).filter(Boolean);
  const out = [];
  for(const p of parts){
    const w = p.split(' ');
    if(w.length <= 12){ out.push(p); continue; }
    const cw = band().chunkWords;
    for(let i=0;i<w.length;i+=cw) out.push(w.slice(i,i+cw).join(' '));
  }
  // Nobody should be asked to "read out" a two-word scrap. Fold short
  // fragments into a neighbour, preferring the one that stays under 14.
  const merged = [];
  for(const p of out){
    const prev = merged[merged.length-1];
    if(prev && (p.split(' ').length < 4 || prev.split(' ').length < 4)
            && (prev + ' ' + p).split(' ').length <= 14){
      merged[merged.length-1] = prev + ' ' + p;
    } else merged.push(p);
  }
  return merged.length ? merged : [clean];
}

/* --- start / reset --- */
function startReadBack(){
  const text = S.ctx.readText;
  if(!text) return;
  S.rb = { text, chunks: rbChunks(text), idx:0, tries:0,
           tokens:null, score:null, phase:'ready', live:false, practise:null };
  log(0, `Read-back started · ${S.rb.chunks.length} chunk(s) · target is the text on screen`);
  render();
}
function rbCancel(){ S.rb = null; render(); }
function rbCurrent(){ return S.rb ? S.rb.chunks[S.rb.idx] : ''; }

/* --- listen --- */
function rbListen(){
  if(!S.rb || S.rb.live) return;
  S.rb.live = true; S.rb.phase = 'listening'; render();
  log(0, `Read-back mic open · chunk ${S.rb.idx+1}/${S.rb.chunks.length}`);
  listen(
    alts => rbCheck(alts),
    err => {
      if(!S.rb) return;
      S.rb.live = false;
      if(err && err !== 'no-speech'){
        S.rb.phase = 'nomic';
        log(null, 'Read-back recognizer error: ' + err);
      } else if(S.rb.phase === 'listening'){
        S.rb.phase = 'ready';
      }
      render();
    }
  );
}

/* --- grade against the text that is on the screen --- */
function rbCheck(input){
  if(!S.rb) return;
  const alts = typeof input === 'string'
    ? (input.trim() ? [{transcript:input, confidence:1}] : [])
    : (input || []);
  if(!alts.length) return;
  S.rb.live = false;

  // single-word practice mode grades just that word
  if(S.rb.practise){
    const w = S.rb.practise;
    const r = gradeBest(w, alts, S.lang);
    log(0, `Word practice "${w}" · ${r.score}%`);
    if(r.score >= RB_WORD_PASS){
      S.rb.practise = null;
      S.rb.phase = 'ready';
      speak(S.lang==='hi' ? 'हाँ! अब पूरी पंक्ति बोलो।' : 'Yes! Now say the whole line.');
    } else {
      speak(w);
    }
    render();
    return;
  }

  const target = rbCurrent();
  const r = gradeBest(target, alts, S.lang);
  log(0, `Read-back graded · ${r.score}% · conf ${(r.confidence||0).toFixed(2)}${r.shaky?' · shaky pick':''}`);

  // never blame the child for the recognizer's doubt
  const verdict = gradeVerdict(r);
  if(verdict === 'unsure'){
    S.rb.phase = 'unsure'; S.rb.tokens = null; S.rb.score = null;
    log(0, 'Low confidence match → asking again, no attempt recorded');
    render();
    return;
  }

  S.rb.tokens = r.tokens;
  S.rb.score  = r.score;

  if(verdict === 'pass') rbPass(r);
  else {
    S.rb.tries++;
    S.rb.phase = S.rb.tries >= RB_MAX_TRIES ? 'echo' : 'fix';
    S.rb.guide = rbGuide(r);
    const first = r.misread[0] || r.slips[0];
    if(first) setTimeout(()=>speak(first), 450);
    render();
  }
}

/* --- passed this chunk --- */
function rbPass(r){
  const firstTry = S.rb.tries === 0;
  record('read', firstTry);                 // honest: only a clean read counts as correct
  S.stars++;
  cheer();
  const last = S.rb.idx >= S.rb.chunks.length - 1;
  const praise = last
    ? (S.lang==='hi' ? 'शाबाश! पूरी बात तुमने पढ़ ली।' : 'Wonderful — you read the whole thing!')
    : (S.lang==='hi' ? 'बढ़िया! अगला हिस्सा।' : 'Great! Next bit.');
  speak(praise);
  if(last){
    S.rb.phase = 'done';
    log(0, `Read-back complete · ${S.rb.chunks.length} chunk(s) · task finished`);
  } else {
    S.rb.idx++; S.rb.tries = 0; S.rb.tokens = null; S.rb.score = null; S.rb.phase = 'ready';
  }
  render();
}

/* --- turn a grade into specific, actionable coaching --- */
function rbGuide(r){
  const hi = S.lang === 'hi';
  const miss = r.tokens.filter(t => t.state === 'miss');
  const bad  = r.tokens.filter(t => t.state === 'bad');
  const near = r.tokens.filter(t => t.state === 'near');
  const rows = [];

  for(const t of miss.slice(0,3)) rows.push({
    ic:'👀', word:t.text,
    tip: hi ? 'यह शब्द छूट गया। दबाकर सुनो, फिर पूरी पंक्ति बोलो।'
            : 'This one got skipped. Tap it to hear it, then read the line again.'
  });
  for(const t of bad.slice(0,3)) rows.push({
    ic:'👂', word:t.text,
    tip: t.heard
      ? (hi ? `मैंने "${t.heard}" सुना। सही शब्द दबाकर सुनो।`
            : `I heard "${t.heard}". Tap the right word to hear it.`)
      : (hi ? 'यह शब्द फिर से बोलो।' : 'Say this one again.')
  });
  for(const t of near.slice(0,2)) rows.push({
    ic:'✨', word:t.text,
    tip: hi ? 'लगभग सही! मात्रा पर ध्यान दो।'
            : 'So close — listen to the vowel sound.'
  });
  return rows.slice(0,4);
}

/* --- practise a single word, then return to the line --- */
function rbPractise(word){
  if(!S.rb) return;
  S.rb.practise = word;
  S.rb.phase = 'practise';
  render();
  speak(word);
}

/* --- give up gracefully: hear it word by word, then finish --- */
function rbEcho(){
  if(!S.rb) return;
  const words = rbCurrent().split(/\s+/);
  log(0, 'Echo practice · reading the line word by word');
  words.forEach((w,i)=> setTimeout(()=>speak(w), i*900));
  setTimeout(()=>speak(rbCurrent()), words.length*900 + 400);
}
function rbFinish(){
  if(!S.rb) return;
  record('read', false);                    // it took help — log it honestly
  const last = S.rb.idx >= S.rb.chunks.length - 1;
  if(last){ S.rb.phase = 'done'; }
  else { S.rb.idx++; S.rb.tries = 0; S.rb.tokens = null; S.rb.score = null; S.rb.phase = 'ready'; }
  speak(S.lang==='hi' ? 'कोई बात नहीं, हम फिर अभ्यास करेंगे।' : 'No problem — we will practise it again.');
  render();
}

/* ================= RENDER ================= */
function readBackPanel(){
  const text = S.ctx.readText;
  if(!text) return '';
  const hi = S.lang === 'hi';
  const rb = S.rb;

  if(!rb || rb.text !== text){
    return `<button class="btn leaf" style="margin-top:12px" onclick="startReadBack()">
      🎤 ${hi ? 'अब तुम पढ़कर सुनाओ' : 'Now read it back to me'}</button>`;
  }

  if(rb.phase === 'done'){
    return `<div class="rb rbdone">
      <div class="rbhead">✅ ${hi ? 'काम पूरा हुआ!' : 'Task complete!'}</div>
      <div class="muted">${hi ? 'तुमने पूरी बात खुद पढ़ी।' : 'You read the whole thing yourself.'}</div>
      <div class="row" style="margin-top:11px">
        <button class="btn ghost" onclick="rbCancel()">↻ ${hi?'फिर से':'Again'}</button>
        <button class="btn" onclick="go('home')">${hi?'आगे चलो →':'Next task →'}</button>
      </div></div>`;
  }

  const total = rb.chunks.length;
  const line  = rbCurrent();
  const shown = rb.tokens
    ? rb.tokens.map(t=>`<span class="w ${t.state}" data-say="${attr(t.text)}" onclick="sayEl(this)">${t.text}</span>`).join(' ')
    : line.split(/\s+/).map(w=>`<span class="w" data-say="${attr(w)}" onclick="sayEl(this)">${w}</span>`).join(' ');

  const steps = total > 1
    ? `<div class="rbsteps">${rb.chunks.map((_,k)=>`<i class="${k<rb.idx?'done':k===rb.idx?'now':''}"></i>`).join('')}
       <span>${rb.idx+1} / ${total}</span></div>` : '';

  /* --- single-word drill --- */
  if(rb.phase === 'practise'){
    return `<div class="rb">
      <div class="rbhead">🔁 ${hi?'सिर्फ़ यह शब्द':'Just this word'}</div>
      <div class="rbword" data-say="${attr(rb.practise)}" onclick="sayEl(this)">${rb.practise}</div>
      <div class="muted" style="text-align:center">${hi?'दबाकर सुनो, फिर बोलो':'Tap to hear it, then say it'}</div>
      <button class="mic ${rb.live?'live':''}" onclick="rbListen()">${rb.live?'●':'🎙'}</button>
      <button class="btn ghost" onclick="S.rb.practise=null;S.rb.phase='fix';render()">← ${hi?'पूरी पंक्ति':'Back to the line'}</button>
    </div>`;
  }

  const guide = (rb.phase === 'fix' || rb.phase === 'echo') && rb.guide ? `
    <div class="rbguide">
      ${rb.guide.map(r=>`<div class="rbtip">
        <span class="ic">${r.ic}</span>
        <button class="chipword" onclick="rbPractise('${attr(r.word).replace(/'/g,'&#39;')}')">${r.word}</button>
        <span>${r.tip}</span></div>`).join('')}
    </div>` : '';

  const echo = rb.phase === 'echo' ? `
    <div class="row" style="margin-top:10px">
      <button class="btn ghost" onclick="rbEcho()">🔊 ${hi?'साथ में सुनो':'Hear it with me'}</button>
      <button class="btn ghost" onclick="rbFinish()">${hi?'ठीक है, आगे':'Move on'}</button>
    </div>` : '';

  return `<div class="rb">
    <div class="rbhead">🎤 ${hi?'पढ़कर सुनाओ':'Read this out'}</div>
    ${steps}
    <div class="rbline">${shown}</div>
    ${rb.score!=null ? `<div class="scorebar"><i style="width:${rb.score}%"></i></div>` : ''}
    ${rb.phase==='unsure' ? `<div class="retry">${hi?'साफ़ सुनाई नहीं दिया — पास आकर फिर बोलो।':'I could not hear that clearly — come closer and try again.'}</div>`:''}
    ${rb.phase==='nomic' ? `<div class="retry">${hi?'माइक नहीं चला। नीचे टाइप करके देखो।':'Mic unavailable. Type what you read instead.'}</div>`:''}
    ${guide}
    ${echo}
    <button class="mic ${rb.live?'live':''}" onclick="rbListen()">${rb.live?'●':'🎙'}</button>
    <div class="muted" style="text-align:center">${
      rb.live ? (hi?'सुन रहा हूँ…':'Listening…')
              : rb.tries ? (hi?`कोशिश ${rb.tries+1}`:`Try ${rb.tries+1}`)
              : (hi?'दबाओ और पढ़ो':'Tap and read it out')}</div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost" data-say="${attr(line)}" onclick="sayEl(this)">🔊 ${hi?'पहले सुनो':'Hear it first'}</button>
      <button class="btn ghost" onclick="rbCancel()">${hi?'बाद में':'Later'}</button>
    </div>
    <input class="input" id="rbtyped" style="margin-top:10px" placeholder="${hi?'बोलने की जगह लिखो':'Or type what you read'}">
    <button class="btn ghost" style="margin-top:8px" onclick="rbCheck($('rbtyped').value)">${t('check')}</button>
  </div>`;
}
