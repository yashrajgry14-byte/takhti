/* ================= SCREENS ================= */
const $ = id => document.getElementById(id);
function render(){ $('screen').innerHTML = VIEWS[S.screen](); if(AFTER[S.screen]) AFTER[S.screen](); if(typeof askFab === 'function') askFab(); }
/* Stops everything that belongs to the screen being left — the arrival
   scene, a live recognizer, a self-listen clip, a cartoon in progress,
   the map's ambient sound — and every OTHER game shell's loop, never the
   shell we are simultaneously entering. playGame() calls e.g. popBegin()
   (which builds fresh module state) BEFORE go('pop'); if go() stopped
   'pop' too, it would null that state an instant after creating it, and
   the AFTER hook that spawns the first gate/bubble/target would silently
   no-op forever. Confirmed by rendering a real round in jsdom:
   PP/RN/etc. read back NULL immediately after playGame() without this
   exclusion — see test/shell-integration.test.js. */
function go(s){
  arrivalStop();
  stopListening();      // a recognizer still listening must not fire against the screen being left
  selfListenReset();    // stop/discard any in-flight self-listen clip — it must never outlive the reading screen
  if(s!=='theater') theaterStop();
  if(s!=='map') sfxAmbientStop();
  if(s!=='runner') runnerStop();
  if(s!=='pop')    popStop();
  if(s!=='tower')  towerStop();
  if(s!=='match')  matchStop();
  if(s!=='sort')   sortStop();
  if(s!=='archer') archerStop();
  askFollow(s);    // Ask Munni's help belongs to the screen it was asked on
  talkFollow(s);   // a Talking Munni call lives at the Pond and in the games, nowhere else
  if(typeof teachFollow === 'function') teachFollow(s);   // what the child taught Appu counts even if they leave half way
  // the youngest children's home is Story Time, not the map (ui/story-time.js) — every "back to the map" lands there
  if(s === 'map' && typeof simpleHomeOn === 'function' && simpleHomeOn() && !S._fullMap) s = 'stories';
  S.screen=s; S.ctx={}; render(); talkChip();
}

/* ---------- profile switcher: one phone, up to MAX_PROFILES siblings.
   Lives on the jungle map (the hub every session returns to), so a
   sibling can always be switched to or added without a parent PIN. ---------- */
function profileSwitcher(){
  const chips = S.profiles.map((p,i)=>`
    <button class="profilechip ${i===S.activeProfile?'sel':''}" onclick="switchProfile(${i})">
      <span class="pic">${p.avatar ? avatarById(p.avatar).ic : '🧒'}</span>${p.name||'?'}
    </button>`).join('');
  const add = S.profiles.length < MAX_PROFILES
    ? `<button class="profilechip add" onclick="addChild()">
        <span class="pic">➕</span>${S.lang==='hi'?'नया':'Add'}</button>`
    : '';
  return `<div class="profilebar">${chips}${add}</div>`;
}

const VIEWS = {

/* ---------- 2. PICK YOUR GAME ---------- */
pick(){
  return `
  ${S.game? `<button class="back" onclick="go('map')">← ${t('back')}</button>`:''}
  <div class="display" style="font-size:23px;margin-top:4px">${S.lang==='hi'?`${S.name}, तुम्हें कौन सा खेल सबसे अच्छा लगता है?`:`${S.name}, which game do you love most?`}</div>
  <div class="muted" style="margin-top:4px">${S.lang==='hi'?'हर दिन इसी से शुरुआत होगी।':'Every day will start with it.'}</div>
  <div class="gamegrid">
    ${GAMES.map(g=>`<button class="gcard ${S.game===g.id?'sel':''}" onclick="chooseGame('${g.id}')">
      <span>${g.ic}</span>${S.lang==='hi'?g.hi:g.en}</button>`).join('')}
  </div>`;
},

/* ---------- 3. THE OPENING (animation → impact → card) ---------- */
open(){
  const g = gameById(S.game);
  const phase = S.ctx.phase || 0;
  const name = S.name;
  const hello = GREETS[S.lang][S.visits % GREETS[S.lang].length](name);

  if(phase < 2){
    let scene = '';
    if(g.type==='launch') scene = `
      <div class="actor a-launch">${g.actor}</div>
      <div class="proj p-launch">${g.proj}</div>`;
    else if(g.type==='chase') scene = `
      <div class="dust">💨</div>
      <div class="actor a-chase2">${g.actor2||'🏃'}</div>
      <div class="actor a-chase">${g.actor}</div>`;
    else scene = `
      <div class="hidebox">${g.hide||'🌳'}</div>
      <div class="actor a-reveal">${g.actor}</div>`;
    return `
    <div class="greet">${hello}<small>${S.lang==='hi'?g.hi:g.en} ${g.ic}</small></div>
    <div class="arena" id="arena" style="--gAccent:${g.accent}33">
      <div class="bubble">${S.lang==='hi'?'देखो ज़रा…':'Watch this…'}</div>
      <div class="ground"></div><div class="crowd">▪▪▪▪▪▪▪▪▪▪▪▪</div>
      ${scene}
      ${phase===1?`<div class="flash"></div>
        <svg class="crack" viewBox="0 0 300 236" preserveAspectRatio="none" fill="none"
             stroke="${g.accent}" stroke-width="2.5" stroke-linecap="round">
          <path d="M150 118 L96 40 M150 118 L214 34 M150 118 L58 96 M150 118 L252 132
                   M150 118 L104 206 M150 118 L206 202 M96 40 L74 16 M214 34 L238 12
                   M58 96 L26 82 M252 132 L286 150 M104 206 L88 232 M206 202 L226 228" opacity=".9"/>
          <circle cx="150" cy="118" r="17" fill="${g.accent}" opacity=".35" stroke="none"/>
        </svg>
        <div class="confetti">${[...Array(14)].map((_,i)=>
          `<i style="left:${6+i*6.6}%;background:${[g.accent,'#F0A02A','#EDE6D2','#E8447C'][i%4]};animation-delay:${(i%5)*.08}s"></i>`).join('')}</div>`:''}
    </div>
    <button class="btn ghost" style="margin-top:14px" onclick="skipOpening()">${S.lang==='hi'?'छोड़ो, आगे चलो':'Skip'}</button>`;
  }

  /* phase 2 — whatever today's format knocked loose */
  const f = todayFormat();
  return `
  <div class="greet">${hello}<small>${S.lang==='hi'?g.hi:g.en} ${g.ic} · ${S.lang==='hi'?f.hi:f.en}</small></div>
  ${weekStrip()}
  <div class="reveal" style="margin-top:12px">${CARD[f.id](g)}</div>
  ${f.id!=='fact'? factStrip(g) : ''}
  ${readBackPanel()}
  <button class="btn" style="margin-top:14px" onclick="go('map')">${S.lang==='hi'?'अब सीखते हैं →':'Now let us learn →'}</button>
  <div class="row" style="margin-top:9px">
    <button class="btn ghost" onclick="nextDay()">${S.lang==='hi'?'कल →':'Tomorrow →'}</button>
    <button class="btn ghost" onclick="go('pick')">${S.lang==='hi'?'खेल बदलो':'Change game'}</button>
  </div>`;
},

/* ---------- PARENT PIN GATE ---------- */
parentlock(){
  const hasPin = !!S.parentPin;
  const err = S.ctx.pinErr;
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div style="text-align:center;padding:26px 6px 0">
    <div style="font-size:44px">🔒</div>
    <div class="display" style="font-size:19px;margin-top:10px">
      ${hasPin
        ? (S.lang==='hi'?'माता-पिता का पिन डालें':'Enter the parent PIN')
        : (S.lang==='hi'?'माता-पिता के लिए 4 अंकों का पिन बनाएँ':'Set a 4-digit PIN for the parent dashboard')}
    </div>
    <div class="muted" style="margin:6px 0 18px">
      ${hasPin
        ? (S.lang==='hi'?'सिर्फ़ माता-पिता ही आगे जा सकते हैं':'Keeps this dashboard for grown-ups only')
        : (S.lang==='hi'?'अगली बार यही पिन माँगा जाएगा':'You will be asked for this PIN every time after')}
    </div>
    <input class="input namein" id="pin" type="tel" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off">
    ${err? `<div class="retry" style="margin-top:10px">${S.lang==='hi'?'गलत पिन — फिर कोशिश करो':'Wrong PIN — try again'}</div>`:''}
    <button class="btn" style="margin-top:14px"
      onclick="${hasPin?'checkParentPin':'setParentPin'}($('pin').value)">
      ${hasPin? (S.lang==='hi'?'खोलो →':'Unlock →') : (S.lang==='hi'?'सेव करो →':'Save →')}
    </button>
  </div>`;
},

/* ---------- READING ---------- */
read(){
  if(!S.ctx.sentence){
    // Spaced repetition, invisibly: due reading items (core/srs.js) are the
    // session's first sentences, most-overdue first, before any fresh random
    // pick — jungle-map.js's mapSuggestion() routed the child here for exactly
    // this. S.ctx._srsQueue carries the rest across nextSentence(). Items with
    // no stored sentence are skipped rather than shown as a blank line.
    const due = getDueSrsItems(S, 'read')
      .sort((a,b) => a.nextReview - b.nextReview)
      .map(it => it.content).filter(Boolean);
    const again = typeof readAgainNext === 'function' ? readAgainNext() : null;   // a line the clearer check had to skip
    if(again){
      S.ctx.sentence = again;
      if(due.length) S.ctx._srsQueue = due;
    } else if(due.length){
      S.ctx.sentence = due[0];
      if(due.length > 1) S.ctx._srsQueue = due.slice(1);
    } else {
      const pool = ageSentences(S.lang, S.levels.read);
      S.ctx.sentence = pool[Math.floor(Math.random()*pool.length)];
    }
  }
  const s = S.ctx.sentence;
  if(!S.ctx.tokens && !S.ctx.helped) twinExpect('read:' + s, readSkill(), null, 0.05);   // the twin's guess: will this line go well?
  const shown = S.ctx.tokens
    ? S.ctx.tokens.map(tk=>`<span class="w ${tk.state}" title="${tk.heard? 'heard: '+attr(tk.heard) : 'not heard'}" data-say="${attr(tk.text)}" onclick="sayEl(this)">${tk.text}</span>`).join(' ')
    : s.split(/\s+/).map(w=>`<span class="w" data-say="${attr(w)}" onclick="sayEl(this)">${w}</span>`).join(' ');
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="muted">${t('level')} ${S.levels.read} · ${t('read')} · ${competencyName('read',S.levels.read)}</div>
  <div class="langpick">
    <button class="${S.lang==='en'?'sel':''}" onclick="setReadLang('en')">English</button>
    <button class="${S.lang==='hi'?'sel':''}" onclick="setReadLang('hi')">हिंदी</button>
  </div>
  <div class="sentence">${shown}</div>
  ${S.ctx.tokens ? '' : twinHeadsUpHTML(s)}
  ${mindChunksHTML()}
  ${S.ctx.tokens? `<div class="legend">
      <span><i style="background:rgba(63,187,120,.7)"></i>${S.lang==='hi'?'सही':'correct'}</span>
      <span><i style="background:rgba(240,160,42,.8)"></i>${S.lang==='hi'?'लगभग':'almost'}</span>
      <span><i style="background:rgba(232,68,124,.8)"></i>${S.lang==='hi'?'गलत':'misread'}</span>
      <span><i style="background:rgba(237,230,210,.3)"></i>${S.lang==='hi'?'छूटा':'skipped'}</span>
    </div>`:`<div class="muted" style="font-size:12px">${S.lang==='hi'?'किसी शब्द को दबाकर सुनो':'Tap any word to hear it'}</div>`}
  ${S.ctx.score!=null? `<div class="scorebar"><i style="width:${S.ctx.score}%"></i></div>
     <div class="feedback">${S.ctx.msg}</div>
     ${twinSlipHTML()}
     ${sayHTML()}
     ${S.ctx.sayWord && !(SAY && SAY.line === S.ctx.sentence) ? `<button class="btn leaf" style="margin-top:8px" onclick="sayStart(S.ctx.sayWord, S.ctx.slip)">🐘 ${S.lang==='hi'?'मुन्नी के साथ बोलो':'Say it with Munni'}: <b>${attr(S.ctx.sayWord)}</b></button>` : ''}
     ${S.ctx.practice ? `<button class="btn ghost practise" onclick="practiseLine()">🔁 ${S.lang==='hi'?'इन शब्दों के साथ एक और':'One more with these words'}: <b>${S.ctx.practice.line}</b></button>` : ''}
     ${typeof selfListenHTML === 'function' ? selfListenHTML() : ''}`:''}
  ${S.ctx.unsure? `<div class="retry">${S.lang==='hi'?'साफ़ सुनाई नहीं दिया — थोड़ा पास आकर फिर बोलो।':'I could not hear that clearly — come a little closer and try again.'}</div>`:''}
  ${S.ctx.score==null && S.ctx.msg ? `<div class="retry">${S.ctx.msg}</div>` : ''}
  <button class="mic ${S.ctx.live?'live':''}" id="mic" aria-label="record">${S.ctx.live?'●':'🎙'}</button>
  <div class="muted" style="text-align:center">${S.ctx.live? t('listening') : t('tapMic')}</div>
  <div class="row" style="margin-top:14px">
    <button class="btn ghost" onclick="speak(S.ctx.sentence)">🔊 ${t('hear')}</button>
    <button class="btn" onclick="nextSentence()">${t('next')} →</button>
  </div>
  <div style="margin-top:10px">
    <input class="input" id="typed" placeholder="${t('typeInstead')}">
    <button class="btn ghost" style="margin-top:8px" onclick="checkRead($('typed').value)">${t('check')}</button>
  </div>`;
},

/* ---------- WRITING ---------- */
write(){
  // the child's class decides which writing tasks exist (content/ages.js CLASSES):
  // a Class 2+ child is never handed a trace pad
  const modes = writeModes();
  if(!S.ctx.mode || !modes.includes(S.ctx.mode)) S.ctx.mode = modes[0];   // class moved, tab is gone
  const wl = {
    trace:   S.lang==='hi'?'स्क्रीन पर बनाओ':'Trace on screen',
    paper:   S.lang==='hi'?'कागज़ पर लिखो 📷':'Write on paper 📷',
    dictate: S.lang==='hi'?'सुनो और लिखो 🔊':'Listen and write 🔊'
  };
  const tabs = `
  <div class="tabs">
    ${modes.map(m => `<button class="${S.ctx.mode===m?'sel':''}" onclick="setWriteMode('${m}')">${wl[m]}</button>`).join('')}
  </div>`;
  const levelLine = `<div class="muted">${t('level')} ${S.levels.write} · ${t('write')} · ${competencyName('write',S.levels.write)}</div>`;

  /* ---------- PAPER MODE: copy the sentence, photograph it, type it back ---------- */
  if(S.ctx.mode==='paper'){
    const pool = ageSentences(S.lang, S.levels.write);
    if(!S.ctx.line) S.ctx.line = pool[Math.floor(Math.random()*pool.length)];
    if(!S.camOk){
      return `
      <button class="back" onclick="go('map')">← ${t('back')}</button>
      ${tabs}
      ${levelLine}
      <div class="permcard" style="margin-top:12px">
        <div class="pi">📷</div>
        <h3>${S.lang==='hi'?'कैमरा चालू करें?':'Turn on the camera?'}</h3>
        <p class="muted" style="margin:0 0 4px">${S.lang==='hi'
          ? 'तख़्ती तुम्हारी कॉपी की तस्वीर देखकर बताएगी कि तुमने लिखा या नहीं। तस्वीर इसी फ़ोन में रहती है — कहीं नहीं भेजी जाती।'
          : 'Takhti will look at your notebook to check that you wrote it. The photo stays on this phone and is never sent anywhere.'}</p>
        <p class="muted" style="font-size:12px;margin:8px 0 0">${S.lang==='hi'?'सिर्फ़ माता-पिता ही तस्वीरें देख सकते हैं।':'Only a parent can see the photos.'}</p>
        <button class="btn" style="margin-top:12px" onclick="grantCamera()">${S.lang==='hi'?'ठीक है, चालू करो':'Allow camera'}</button>
        <button class="btn ghost" style="margin-top:8px" onclick="setWriteMode(band().trace?'trace':'dictate')">${S.lang==='hi'?'अभी नहीं':'Not now'}</button>
      </div>`;
    }
    const v = S.ctx.verdict;
    return `
    <button class="back" onclick="go('map')">← ${t('back')}</button>
    ${tabs}
    ${levelLine}
    <div class="muted" style="margin-top:8px">${S.lang==='hi'?'इसे अपनी कॉपी में लिखो:':'Copy this into your notebook:'}</div>
    <div class="copyline">${S.ctx.line}</div>
    <button class="btn ghost" style="margin-top:8px" onclick="speak(S.ctx.line)">🔊 ${t('hear')}</button>

    <input type="file" accept="image/*" capture="environment" id="cam" class="hidden" onchange="handleShot(event)">
    ${!S.ctx.shot
      ? `<button class="btn leaf" style="margin-top:12px" onclick="$('cam').click()">📷 ${S.lang==='hi'?'तस्वीर लो':'Take the photo'}</button>`
      : `<img class="shot" src="${S.ctx.shot}" alt="notebook">
         ${v? `<div class="card" style="margin-top:10px">
             <div class="verdict"><span class="vi">${v.ink?'✅':'⚠️'}</span><span>${v.msg}</span></div>
             ${v.ink? `<div class="muted" style="font-size:12px;margin-top:6px;font-family:var(--mono)">ink ${v.ratio}% · ${v.lines} line${v.lines===1?'':'s'} detected</div>`:''}
           </div>`:''}
         <div class="muted" style="margin-top:12px">${S.lang==='hi'?'अब जो लिखा वो यहाँ टाइप करो — तख़्ती जाँच लेगी।':'Now type what you wrote — Takhti will check it.'}</div>
         <input class="input" id="typedline" style="margin-top:8px" placeholder="${S.lang==='hi'?'जो लिखा वो टाइप करो':'Type what you wrote'}">
         <button class="btn" style="margin-top:9px" onclick="submitPaper($('typedline').value)">${t('check')}</button>
         <button class="btn ghost" style="margin-top:8px" onclick="$('cam').click()">${S.lang==='hi'?'दोबारा तस्वीर':'Retake photo'}</button>`}
    ${S.ctx.tokens? `<div class="sentence" style="font-size:20px;margin-top:14px">${
        S.ctx.tokens.map(tk=>`<span class="w ${tk.state}">${tk.text}</span>`).join(' ')}</div>
      <div class="scorebar"><i style="width:${S.ctx.score}%"></i></div>
      <div class="feedback">${S.ctx.msg}</div>
      ${twinSlipHTML()}
      <button class="btn" style="margin-top:10px" onclick="nextLine()">${t('next')} →</button>`:''}`;
  }

  /* ---------- DICTATION: Munni says a line, the child writes it, then types it back ---------- */
  if(S.ctx.mode==='dictate'){
    const pool = ageSentences(S.lang, S.levels.write);
    if(!S.ctx.line) S.ctx.line = pool[Math.floor(Math.random()*pool.length)];
    return `
    <button class="back" onclick="go('map')">← ${t('back')}</button>
    ${tabs}
    ${levelLine}
    <div class="muted" style="margin-top:8px">${S.lang==='hi'
      ? 'मुन्नी एक पंक्ति बोलेगी। उसे अपनी कॉपी में लिखो, फिर जो लिखा वो यहाँ टाइप करो।'
      : 'Munni will say a line. Write it in your notebook, then type what you wrote.'}</div>
    <div class="row" style="margin-top:10px">
      <button class="btn" onclick="speak(S.ctx.line)">🔊 ${S.lang==='hi'?'पंक्ति सुनो':'Hear the line'}</button>
    </div>
    ${S.ctx.tokens ? `<div class="copyline" style="margin-top:12px">${S.ctx.line}</div>` : `
    <input class="input" id="typedline" style="margin-top:12px" placeholder="${S.lang==='hi'?'जो लिखा वो टाइप करो':'Type what you wrote'}">
    <button class="btn leaf" style="margin-top:9px" onclick="submitDictation($('typedline').value)">${t('check')}</button>
    ${S.ctx.msg ? `<div class="feedback">${S.ctx.msg}</div>` : ''}`}
    ${S.ctx.tokens? `<div class="sentence" style="font-size:20px;margin-top:14px">${
        S.ctx.tokens.map(tk=>`<span class="w ${tk.state}">${tk.text}</span>`).join(' ')}</div>
      <div class="scorebar"><i style="width:${S.ctx.score}%"></i></div>
      <div class="feedback">${S.ctx.msg}</div>
      ${twinSlipHTML()}
      <button class="btn" style="margin-top:10px" onclick="nextLine('dictate')">${t('next')} →</button>`:''}`;
  }

  /* ---------- TRACE MODE ---------- */
  const pool = GLYPHS[S.lang][S.levels.write];
  if(!S.ctx.glyph) S.ctx.glyph = pool[Math.floor(Math.random()*pool.length)];
  if(S.ctx.score == null) twinExpect('write:' + S.ctx.glyph, 'write' + S.levels.write, null, 0.1);   // the twin's guess for this letter
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  ${tabs}
  ${levelLine}
  <div class="display" style="font-size:20px;margin-top:8px">${t('writeSub')}: <span style="color:var(--marigold)">${S.ctx.glyph}</span></div>
  <div class="padwrap">
    <canvas id="guide"></canvas>
    <canvas id="ink"></canvas>
  </div>
  ${S.ctx.score!=null? `<div class="scorebar"><i style="width:${S.ctx.score}%"></i></div><div class="feedback">${S.ctx.msg}</div>${twinSlipHTML()}`:''}
  <div class="row" style="margin-top:10px">
    <button class="btn ghost" onclick="clearInk()">${t('clear')}</button>
    <button class="btn leaf" onclick="checkInk()">${t('check')}</button>
  </div>
  <button class="btn ghost" style="margin-top:10px" onclick="nextGlyph()">${t('next')} →</button>`;
},

/* ---------- MATH ---------- */
math(){
  if(!S.ctx.p){
    // from Munni's idea on the map: the first sum is that topic
    const f = S.mindFocus && skillHasProblem(S.mindFocus) ? skillProblem(S.mindFocus, Math.floor(Math.random() * 1e9)) : null;
    S.mindFocus = null;
    S.ctx.p = f && f.c == null ? { a: f.a, b: f.b, op: f.op, ans: f.ans, opts: f.opts.map(Number) } : mindPracticeProblem();
    // the plan's harder/easier step after a school lesson: this sum is it
    if(S.planMore && f && f.c == null) S.ctx.planMore = S.planMore;
    S.planMore = null;
  }
  const p = S.ctx.p;
  const g = gameById(S.game);
  if(S.ctx.picked == null && !S.ctx.helped) twinExpect(twinKeyMath(p), skillOfProblem(p), p, p.opts);   // the twin's guess, before the answer
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="muted">${t('level')} ${S.levels.math} · ${t('count')} · ${competencyName('math',S.levels.math)}</div>
  <div class="problem">${p.a} ${p.op} ${p.b}</div>
  <div class="mathstage" id="mstage">
    <div class="narr" id="mnarr">${S.lang==='hi'?'"दिखाओ" दबाओ और देखो':'Tap "Show me" to watch it happen'}</div>
  </div>
  <button class="btn ghost" style="margin-top:10px" onclick="playMath()">${g.ic} ${S.lang==='hi'?'मुझे दिखाओ':'Show me'}</button>
  <div class="opts" style="margin-top:12px">
    ${p.opts.map(o=>`<button class="opt ${S.ctx.picked!=null&&o===p.ans?'right':''} ${S.ctx.picked===o&&o!==p.ans?'wrong':''}" onclick="answerMath(${o})">${o}</button>`).join('')}
  </div>
  ${S.ctx.msg? `<div class="feedback" style="text-align:center;margin-top:14px">${S.ctx.msg}</div>`:''}
  ${twinTipHTML(p)}
  ${mindIdeaHTML()}
  ${S.ctx.picked!=null? `<button class="btn" style="margin-top:12px" onclick="nextProblem()">${t('next')} →</button>`:''}`;
},

/* ---------- LEARN WITH A STORY ---------- */
lessons(){
  return S.lesson ? lessonHTML() : lessonListHTML();
},

/* ---------- PLAY: the games shelf ----------
   One entrance on the home screen, not one tile per game. Every entry
   in gameList() (src/games/game-core.js) gets a card here — icon,
   bilingual name, bilingual aim, and the child's own best if they have
   one. All six shells now have a real screen (src/games/*.js). */
games(){
  const list = gameList();
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="display" style="font-size:22px;margin-top:4px">${S.lang==='hi'?'खेलो':'Play'}</div>
  <div class="muted" style="margin-top:2px">${S.lang==='hi'
    ? 'हर खेल एक छोटा दौर है और अपने आप खत्म होता है — जितना खेलना चाहो, उतना ही खेलो, कोई दबाव नहीं।'
    : 'Each game is one short, bounded round that ends on its own — play one or several, there is no pressure to keep going.'}</div>
  <div class="gameshelf">
    ${list.map(g=>{
      // match's real score is fewest MOVES (lower is better), tracked under
      // its own key by src/games/match.js — S.gameBest.match itself is
      // gameEnd()'s own right-count bookkeeping, not a meaningful "best" here.
      const best = g.kind==='match' ? (S.gameBest||{}).matchMoves : (S.gameBest||{})[g.kind];
      const bestLabel = g.kind==='match'
        ? (S.lang==='hi'?'सबसे कम चालें':'Fewest moves')
        : (S.lang==='hi'?'सबसे अच्छा':'Best');
      return `<button class="shelfcard" onclick="playGame('${g.kind}')">
        <span class="sc-ic">${g.ic}</span>
        <span class="sc-name">${S.lang==='hi'?g.hi:g.en}</span>
        <span class="sc-aim">${S.lang==='hi'?g.aim.hi:g.aim.en}</span>
        ${best!=null? `<span class="sc-best">🏆 ${bestLabel}: ${best}</span>`:''}
        <span class="sc-note">${S.lang==='hi'?'एक दौर · जब चाहो रुको':'One round · stop anytime'}</span>
      </button>`;
    }).join('')}
  </div>`;
},

/* ---------- ASK (the bridge) ---------- */
ask(){
  const a = S.ctx.answer;
  if(a){
    const i = S.ctx.panel||0;
    const p = a.panels[i];
    return `
    <button class="back" onclick="S.ctx.answer=null;render()">← ${t('back')}</button>
    <div class="display" style="font-size:19px;margin:4px 0 10px">${a.title}</div>
    <div class="panelstage">
      <div>
        <div class="panelart">${p.art}</div>
        <div style="font-size:15.5px;line-height:1.5">${p[S.lang]||p.en}</div>
      </div>
    </div>
    <div class="dots">${a.panels.map((_,k)=>`<span class="dot ${k===i?'on':''}"></span>`).join('')}</div>
    <div class="row" style="margin-top:14px">
      <button class="btn ghost" data-say="${attr(p[S.lang]||p.en)}" onclick="sayEl(this)">🔊 ${t('hear')}</button>
      ${i < a.panels.length-1
        ? `<button class="btn" onclick="S.ctx.panel=${i+1};render();speakPanel(${i+1})">${t('next')} →</button>`
        : `<button class="btn leaf" onclick="go('askquiz')">${t('check')} ✓</button>`}
    </div>
    <div class="muted" style="margin-top:12px">${S.lang==='hi'?'यह फ़ोन में सुरक्षित है। बिना सिग्नल के भी फिर चलेगा।':'Saved to this phone. It will play again with no signal.'}</div>`;
  }
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="display" style="font-size:21px;margin:4px 0">${t('ask')}</div>
  <div class="muted">${t('askSub')}</div>
  ${elephantHTML()}
  ${talkPanelHTML()}
  <input class="input" id="q" style="margin-top:12px" placeholder="${t('typeQ')}">
  <button class="btn" style="margin-top:10px" onclick="submitQuestion($('q').value)">${t('sendQ')}</button>
  <div style="margin-top:8px" class="row">
    <button class="btn ghost" onclick="submitQuestion('Why is the sky blue?')">Why is the sky blue?</button>
  </div>
  ${S.answered.map(x=>`<div class="chit ready" onclick="openAnswer('${x.id}')"><b>${x.title}</b>Ready to watch · saved offline</div>`).join('')}
  ${S.queue.map(x=>`<div class="chit"><b>${x.q}</b>${t('savedQ')}</div>`).join('')}`;
},

askquiz(){
  const a = S.ctx.answer; const q = a.quiz;
  const opts = S.lang==='hi' ? (q.hiOpts||q.opts) : q.opts;
  return `
  <button class="back" onclick="go('ask')">← ${t('back')}</button>
  <div class="display" style="font-size:19px;margin:10px 0 14px">${q[S.lang]||q.en}</div>
  <div class="opts">${opts.map((o,i)=>`<button class="opt" style="font-size:18px" onclick="answerQuiz(${i},${q.correct})">${o}</button>`).join('')}</div>
  <div class="feedback" id="qfb" style="text-align:center;margin-top:14px"></div>`;
},

/* ---------- PARENT ---------- */
parent(){
  const pct = m => S.attempts[m]? Math.round(S.correct[m]/S.attempts[m]*100) : 0;
  const row = (label,m) => `<div class="metric"><div><b>${label}</b><div style="font-size:12.5px;opacity:.65">${t('level')} ${S.levels[m]} · ${competencyName(m,S.levels[m])} · ${S.attempts[m]} tries</div></div>
    <div style="text-align:right"><b>${pct(m)}%</b><div class="bar"><i style="width:${pct(m)}%"></i></div></div></div>`;
  const target = (label,k,unit) => {
    // same profile-created-before-goals-existed gap as bumpToday() — default rather than throw
    const now = (S.today && S.today[k]) || 0;
    const max = (S.targets && S.targets[k]) || 5;
    return `<div class="metric">
      <div><b>${label}</b><div style="font-size:12.5px;opacity:.65">${now} of ${max} ${unit} done today</div></div>
      <div style="display:flex;align-items:center;gap:9px">
        <button class="stepbtn" onclick="setTarget('${k}',-1)">−</button>
        <b style="min-width:20px;text-align:center">${max}</b>
        <button class="stepbtn" onclick="setTarget('${k}',1)">+</button>
      </div></div>`;
  };
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="paper">
    <h3>${S.name}${S.lang==='hi'?' का दिन':"'s day"}</h3>
    <div style="font-size:13px;opacity:.7;margin-bottom:8px">${S.lang==='hi'?'सुनने के लिए दबाएँ':'Tap to hear this read aloud'}</div>
    <button class="btn indigo" style="background:#2A2118;color:#F3EEE0;margin-bottom:10px" onclick="readReport()">🔊 सुनें / Listen</button>

    <div class="kicker2">${S.lang==='hi'?'उम्र':'AGE'}</div>
    <div class="metric">
      <div><b>${S.age||6} ${S.lang==='hi'?'साल':'yrs'}</b>
        <div style="font-size:12.5px;opacity:.65">${S.lang==='hi'?'मुन्नी की बोलने की रफ़्तार':"Munni's speaking pace"}</div>
      </div>
      <div style="display:flex;align-items:center;gap:9px">
        <button class="stepbtn" onclick="setParentAge(-1)">−</button>
        <b style="min-width:20px;text-align:center">${S.age||6}</b>
        <button class="stepbtn" onclick="setParentAge(1)">+</button>
      </div>
    </div>
    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'कक्षा':'CLASS'}</div>
    <div class="metric">
      <div><b>${S.lang==='hi'?band().clsHi:band().clsEn}</b>
        <div style="margin-top:3px"><span class="agechip">${S.lang==='hi'?band().stageHi:band().stageEn}</span>${
          S.clsBy === 'school' ? `<span style="font-size:12px;opacity:.7;margin-left:6px">🏫 ${S.lang==='hi'?'स्कूल ने तय की':'set by the school'}</span>`
          : S.cls ? '' : `<span style="font-size:12px;opacity:.6;margin-left:6px">${S.lang==='hi'?'(उम्र से अंदाज़ा)':'(guessed from age)'}</span>`}</div>
      </div>
      ${S.clsBy === 'school' ? '' : `<div style="display:flex;align-items:center;gap:9px">
        <button class="stepbtn" onclick="setParentClass(-1)">−</button>
        <button class="stepbtn" onclick="setParentClass(1)">+</button>
      </div>`}
    </div>
    <div style="font-size:12.5px;opacity:.7;line-height:1.5;margin:4px 0 2px">${S.lang==='hi'
      ? 'कक्षा तय करती है कि क्या सिखाया जाए; उम्र बस यह कि मुन्नी कैसे बोले। तख़्ती उसी कक्षा के भीतर बच्चे के हिसाब से ढल जाती है।'
      : 'Class decides what is taught; age only how Munni speaks. Takhti adapts to your child within their class.'}${S.clsBy === 'school'
      ? (S.lang==='hi' ? ' कक्षा बदलनी हो तो शिक्षक से कहें।' : ' To change the class, ask the teacher.') : ''}</div>
    ${typeof simpleHomeParentHTML === 'function' ? simpleHomeParentHTML() : ''}

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'आवाज़':'SOUND'}</div>
    <div class="metric">
      <div><b>${S.lang==='hi'?'आवाज़ और असर':'Sound & narration'}</b>
        <div style="font-size:12.5px;opacity:.65">${S.lang==='hi'
          ? 'मुन्नी की आवाज़ें और पढ़कर सुनाना — बंद होने पर भी हर पाठ पहले जैसा चलता है'
          : "Munni's sounds and read-aloud narration — every lesson still runs the same with this off"}</div>
      </div>
      <button class="toggle ${S.muted?'':'on'}" onclick="toggleMuted()" aria-label="${S.muted?'unmute':'mute'}"><span></span></button>
    </div>

    ${talkSetUp() ? talkParentHTML() : ''}
    ${cloudReadParentHTML()}
    ${typeof teachWordsParentHTML === 'function' ? teachWordsParentHTML() : ''}
    ${typeof circleParentHTML === 'function' ? circleParentHTML() : ''}
    ${mindParentHTML()}
    ${typeof teachParentHTML === 'function' ? teachParentHTML() : ''}

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'बिना इंटरनेट':'WITHOUT INTERNET'}</div>
    ${(() => {
      const d = S.ctx.dev;
      if(!d) return `<div class="muted" style="font-size:12.5px">${S.lang==='hi'?'जाँच रहे हैं…':'Checking this phone…'}</div>`;
      const word = st => ({
        available:   S.lang==='hi' ? 'तैयार ✓' : 'ready ✓',
        downloadable:S.lang==='hi' ? 'डाउनलोड हो सकता है' : 'can be downloaded',
        downloading: S.lang==='hi' ? 'डाउनलोड हो रहा है…' : 'downloading…',
        unavailable: S.lang==='hi' ? 'इस ब्राउज़र में नहीं' : 'not on this browser'
      })[st] || st;
      const canGet = d.en === 'downloadable' || d.hi === 'downloadable';
      return `<div class="metric"><div><b>${S.lang==='hi'?'बोलकर पढ़ना':'Reading aloud'}</b>
          <div style="font-size:12.5px;opacity:.7">English: ${word(d.en)} · हिंदी: ${word(d.hi)}</div></div></div>
        ${canGet ? `<button class="btn ghost" onclick="getOfflineReading()">⬇️ ${S.lang==='hi'?'ऑफ़लाइन पढ़ना डाउनलोड करो':'Download offline reading'}</button>` : ''}
        <div class="metric"><div><b>${S.lang==='hi'?'नए अभ्यास वाक्य':'Fresh practice lines'}</b>
          <div style="font-size:12.5px;opacity:.7">${d.model === 'available'
            ? (S.lang==='hi'?'फ़ोन का अपना AI मॉडल + वाक्य-भंडार':"this phone's own AI model + the sentence bank")
            : (S.lang==='hi'?'वाक्य-भंडार (इस ब्राउज़र में फ़ोन का AI मॉडल नहीं)':'the sentence bank (no on-device AI model in this browser)')}</div></div></div>
        <div style="font-size:12px;opacity:.7">${S.lang==='hi'
          ? 'फ़ोन पर ही पहचान हो तो बच्चे की आवाज़ फ़ोन से बाहर नहीं जाती।'
          : "When recognition runs on the phone, your child's voice never leaves it."}</div>`;
    })()}

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'कक्षा का कोड':'CLASS CODE'}</div>
    ${S.classCode ? `
    <div class="metric">
      <div><b style="font-family:var(--mono);letter-spacing:2px">${S.classCode}</b>
        <div style="font-size:12.5px;opacity:.65">${S.lang==='hi'?'शिक्षक से जुड़ा हुआ':'Linked to a teacher'}</div>
      </div>
      <button class="stepbtn" style="width:auto;padding:0 12px" onclick="unlinkClassCode()">${S.lang==='hi'?'हटाओ':'Unlink'}</button>
    </div>
    ${(() => {
      const hw = (typeof getAssignedHomework === 'function') ? getAssignedHomework(S) : null;
      if(hw){
        return `<div class="card" style="margin-top:8px;background:rgba(240,160,42,.1);border:1px solid var(--marigold);padding:10px">
          <b>📝 ${S.lang==='hi'?'अभी का गृहकार्य':'Current homework'}</b>
          <div style="font-size:13px;margin-top:4px">${(hw.skills||[]).map(id => { const s = skillById(id); return s ? (S.lang==='hi'?s.hi:s.en) : id; }).join(', ')}${hw.note ? ` — "${attr(hw.note)}"` : ''}</div>
        </div>`;
      }
      return `<div style="font-size:12.5px;opacity:.7;margin-top:8px">${S.lang==='hi'
        ? 'अभी कोई गृहकार्य नहीं।'
        : 'No homework right now.'}</div>`;
    })()}

    <div class="kicker2" style="margin-top:12px">${S.lang==='hi'?'शिक्षक के साथ सिंक':'SYNC WITH THE TEACHER'}</div>
    <div class="metric">
      <div><b>${S.lang==='hi'?'अपने आप सिंक करो (हर घंटे)':'Sync automatically (every hour)'}</b>
        <div style="font-size:12.5px;opacity:.7">${S.lang==='hi'
          ? `सिर्फ़ ${attr(S.name)} का नाम, अभ्यास की गिनती और पाठ की कौन-सी बातें अप्पू को समझाईं (और क्या मुन्नी ने कोई बात फिर से सिखाई) और स्कूल के हर पाठ का उसका रास्ता (चित्र, कहानी, कार्टून…), शिक्षक की कक्षा में भेजी जाती हैं — तस्वीरें, आवाज़, बोले गए शब्द या पढ़ा हुआ पाठ कभी नहीं। कभी भी बंद कर सकते हैं।`
          : `Only ${attr(S.name)}'s name, practice counts, which lesson points they explained to Appu (and whether Munni taught one again) and the way each school lesson is being taught to them (pictures, the story, the cartoon…) go to the teacher's class — never photos, voice, the words they said or what was read. You can switch it off any time.`}</div>
      </div>
      <button class="toggle ${S.syncOn?'on':''}" onclick="toggleSyncConsent()" aria-label="${S.syncOn?'sync on':'sync off'}"><span></span></button>
    </div>
    ${S.syncOn ? `<div class="row" style="gap:8px;align-items:center;margin-top:6px">
      <div class="muted" style="font-size:12.5px;flex:1">${syncStatusLine(S.classCode)}</div>
      <button class="btn ghost" style="width:auto;padding:8px 14px" onclick="syncNow(S.classCode)">🔄 ${S.lang==='hi'?'अभी सिंक करो':'Sync now'}</button>
    </div>` : ''}

    <div class="kicker2" style="margin-top:12px">${S.lang==='hi'?'या कोड से भेजो':'OR SEND BY CODE'}</div>
    ${S.ctx.reportCode ? `
      <textarea class="input sharecode" readonly onclick="this.select()">${S.ctx.reportCode}</textarea>
      <button class="btn" style="margin-top:8px" onclick="shareText(S.ctx.reportCode)">📤 ${S.lang==='hi'?'भेजो (WhatsApp/SMS)':'Send (WhatsApp/SMS)'}</button>
      ${S.ctx.shared ? `<div class="muted" style="font-size:12px;margin-top:4px">${S.ctx.shared}</div>` : ''}`
    : `<button class="btn ghost" onclick="makeReportCode()">${S.lang==='hi'?'प्रगति कोड बनाओ':'Make a progress code'}</button>`}
    <div style="font-size:12px;opacity:.7;line-height:1.5;margin-top:6px">${S.lang==='hi'
      ? 'कोड में सिर्फ़ नाम और अभ्यास की गिनती होती है — कुछ भी अपलोड नहीं होता, आप ख़ुद चुनते हैं कि किसे भेजना है। शिक्षक इसे "शिक्षकों के लिए" में डालते हैं।'
      : "The code holds only the name and practice counts — nothing is uploaded; you choose who to send it to. The teacher pastes it into \"For teachers\"."}</div>` : `
    <input class="input" id="classcode" maxlength="6" placeholder="${S.lang==='hi'?'6 अक्षर का कोड':'6-character code'}"
      style="text-transform:uppercase;letter-spacing:2px;text-align:center;font-family:var(--mono)" autocomplete="off">
    ${S.ctx.classCodeErr? `<div class="retry" style="margin-top:8px">${S.lang==='hi'?'कोड 6 अक्षर का होना चाहिए':'The code must be 6 letters or numbers'}</div>`:''}
    <button class="btn ghost" style="margin-top:9px" onclick="setClassCode($('classcode').value)">${S.lang==='hi'?'जोड़ो':'Link'}</button>
    <div style="font-size:12.5px;opacity:.7;line-height:1.5;margin-top:6px">${S.lang==='hi'
      ? 'अगर शिक्षक ने कोड दिया है, तो यहाँ डालो — बच्चे की प्रगति उनसे जुड़ जाएगी।'
      : "If your child's teacher gave you a code, enter it here to share their progress."}</div>`}

    <div class="kicker2" style="margin-top:12px">${S.lang==='hi'?'शिक्षक से गृहकार्य कोड मिला?':'GOT A HOMEWORK CODE FROM THE TEACHER?'}</div>
    <textarea class="input sharecode" id="hwcode" placeholder="TKH1…"></textarea>
    ${S.ctx.hwMsg ? `<div class="${S.ctx.hwOk?'muted':'retry'}" style="font-size:12.5px;margin-top:6px">${S.ctx.hwMsg}</div>` : ''}
    <button class="btn ghost" style="margin-top:8px" onclick="receiveHomework($('hwcode').value)">${S.lang==='hi'?'गृहकार्य जोड़ो':'Add homework'}</button>

    <div class="kicker2">${S.lang==='hi'?'आज का लक्ष्य':"TODAY'S TARGET"}</div>
    ${target(S.lang==='hi'?'बोलकर पढ़ना':'Sentences read aloud','read',S.lang==='hi'?'वाक्य':'sentences')}
    ${target(S.lang==='hi'?'लिखना':'Sentences written','write',S.lang==='hi'?'वाक्य':'sentences')}
    ${target(S.lang==='hi'?'गणित':'Sums learned','math',S.lang==='hi'?'सवाल':'sums')}
    ${target(S.lang==='hi'?'नई बातें':'New things learned','facts',S.lang==='hi'?'बातें':'facts')}

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'प्रगति':'PROGRESS'}</div>
    ${row(t('read'),'read')}
    ${row(t('write'),'write')}
    ${row(t('count'),'math')}
    <div class="metric"><div><b>${S.lang==='hi'?'पूछे गए सवाल':'Questions asked'}</b><div style="font-size:12.5px;opacity:.65">${S.answered.length} answered · ${S.queue.length} waiting for signal</div></div></div>

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'याद रहा':'REMEMBERED'}</div>
    ${(() => {
      // Plain language on purpose: what the child has held onto — never
      // "due", "review", a step number or an interval (core/srs.js's
      // internals stay internal; the child never sees them either).
      const srs = srsStats(S);
      if(!srs.total) return `<div style="font-size:13px;opacity:.7">${S.lang==='hi'
        ? 'अभी दिखाने को कुछ नहीं — बच्चा जैसे-जैसे अभ्यास करेगा, यह यहाँ दिखने लगेगा।'
        : 'Nothing to show yet — this fills in as your child practises things more than once.'}</div>`;
      const pct = Math.round(srs.mastered / srs.total * 100);
      return `<div class="metric">
        <div><b>${S.lang==='hi'?'हमेशा के लिए याद':'Stuck for good'}</b>
          <div style="font-size:12.5px;opacity:.65">${S.lang==='hi'
            ? `${srs.total} में से ${srs.mastered} चीज़ें`
            : `${srs.mastered} of ${srs.total} things practised`}</div>
        </div>
        <div style="text-align:right"><b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div>
      </div>
      <div style="font-size:12px;opacity:.7;margin-top:6px">${S.lang==='hi'
        ? 'बाकी अपने आप, समय-समय पर लौटकर आती हैं — बच्चे को इसका पता भी नहीं चलता।'
        : 'The rest come back around on their own, further apart each time — your child never sees a review screen.'}</div>`;
    })()}

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'जीते हुए कार्ड':'CARDS EARNED'}</div>
    ${S.cards.length
      ? `<div class="cardshelf">${S.cards.map(c=>`<span class="earned-card" title="${attr(S.lang==='hi'?c.titleHi:c.titleEn)}">${c.actor||'⭐'}<small>${S.lang==='hi'?c.titleHi:c.titleEn}</small></span>`).join('')}</div>`
      : `<div style="font-size:13px;opacity:.7">${S.lang==='hi'
          ? 'अभी कोई कार्ड नहीं। कहानी या कार्टून में सही जवाब देकर बच्चा कार्ड जीतता है।'
          : 'None yet. Your child earns a card by getting a story or cartoon checkpoint right.'}</div>`}

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'कॉपी की तस्वीरें':'NOTEBOOK SHELF'}</div>
    ${S.photos.length
      ? `<div class="gallery">${S.photos.slice(0,9).map(p=>`<img src="${p.img}" title="${p.line} · ${p.score}%">`).join('')}</div>
         <div style="font-size:12px;opacity:.7;margin-top:6px">${S.photos.length} ${S.lang==='hi'?'तस्वीरें इसी फ़ोन में':'photos, stored only on this phone'}</div>`
      : `<div style="font-size:13px;opacity:.7">${S.lang==='hi'?'अभी कोई तस्वीर नहीं। बच्चा कागज़ पर लिखकर तस्वीर लेगा तो यहाँ दिखेगी।':'No photos yet. When your child writes on paper and photographs it, it appears here.'}</div>`}
    <div style="font-size:12px;opacity:.7;margin-top:6px">${S.lang==='hi'
      ? 'पढ़ते समय की आवाज़ भी वैसी ही रहती है — सिर्फ़ उसी स्क्रीन पर बजती है, न सेव होती है, न कहीं भेजी जाती है।'
      : "Same with the reading screen's self-listen clip — it only ever plays back on that screen, never saved, never sent anywhere."}</div>

    <div style="font-size:12.5px;opacity:.7;line-height:1.5;margin-top:12px">${S.lang==='hi'
      ? 'कोई स्ट्रीक नहीं, कोई दबाव नहीं। तख़्ती बच्चों को याद दिलाने वाले संदेश नहीं भेजती।'
      : 'No streaks, no daily pressure. Takhti does not send reminders to children.'}</div>
  </div>
  <button class="btn ghost" style="margin-top:12px" onclick="go('teacher')">🧑‍🏫 ${S.lang==='hi'?'शिक्षकों के लिए →':'For teachers →'}</button>`;
}
};

/* The strip across the top of the map: who is playing, and their stars.
   Stars only ever grow — they are never spent, never reset, and never
   compared with anyone else — which is the one kind of habit mechanic
   this app allows (see CLAUDE.md's product constraints). There is
   deliberately NO day-streak counter here: a streak is a number that can
   be lost, and that loss is exactly the guilt mechanic the DPDP Act s.9
   bars for children. Tapping your own name is just for fun. */
function topGamifyBar(){
  if(!S.name) return '';
  const av = S.avatar ? avatarById(S.avatar).ic : '🧒';
  return `
  <div class="top-gamify-bar">
    <button class="mascot-avatar-btn" onclick="cheerMascotAvatar(this)">
      <span style="font-size:18px">${av}</span>
      <span>${S.name}</span>
    </button>
    <div class="star-badge" title="${S.lang==='hi'?'अब तक के सितारे':'Stars so far'}">
      <span class="star-sparkle">⭐</span>
      <span>${S.stars}</span>
    </div>
  </div>`;
}

function cheerMascotAvatar(el){
  sfxChime();
  triggerStarBurst(15, el);
}

