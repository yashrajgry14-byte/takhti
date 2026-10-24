/* ================= SCREENS ================= */
const $ = id => document.getElementById(id);
function render(){ $('screen').innerHTML = VIEWS[S.screen](); if(AFTER[S.screen]) AFTER[S.screen](); }
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
  S.screen=s; S.ctx={}; render();
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
    if(due.length){
      S.ctx.sentence = due[0];
      if(due.length > 1) S.ctx._srsQueue = due.slice(1);
    } else {
      const pool = ageSentences(S.lang, S.levels.read);
      S.ctx.sentence = pool[Math.floor(Math.random()*pool.length)];
    }
  }
  const s = S.ctx.sentence;
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
  ${S.ctx.tokens? `<div class="legend">
      <span><i style="background:rgba(63,187,120,.7)"></i>${S.lang==='hi'?'सही':'correct'}</span>
      <span><i style="background:rgba(240,160,42,.8)"></i>${S.lang==='hi'?'लगभग':'almost'}</span>
      <span><i style="background:rgba(232,68,124,.8)"></i>${S.lang==='hi'?'गलत':'misread'}</span>
      <span><i style="background:rgba(237,230,210,.3)"></i>${S.lang==='hi'?'छूटा':'skipped'}</span>
    </div>`:`<div class="muted" style="font-size:12px">${S.lang==='hi'?'किसी शब्द को दबाकर सुनो':'Tap any word to hear it'}</div>`}
  ${S.ctx.score!=null? `<div class="scorebar"><i style="width:${S.ctx.score}%"></i></div>
     <div class="feedback">${S.ctx.msg}</div>
     ${typeof selfListenHTML === 'function' ? selfListenHTML() : ''}`:''}
  ${S.ctx.unsure? `<div class="retry">${S.lang==='hi'?'साफ़ सुनाई नहीं दिया — थोड़ा पास आकर फिर बोलो।':'I could not hear that clearly — come a little closer and try again.'}</div>`:''}
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
  if(!S.ctx.mode) S.ctx.mode = 'trace';
  if(S.ctx.mode==='paper' && band().traceOnly) S.ctx.mode = 'trace';   // age moved, tab is gone
  const tabs = `
  <div class="tabs">
    <button class="${S.ctx.mode==='trace'?'sel':''}" onclick="setWriteMode('trace')">${S.lang==='hi'?'स्क्रीन पर बनाओ':'Trace on screen'}</button>
    ${band().traceOnly ? '' : `<button class="${S.ctx.mode==='paper'?'sel':''}" onclick="setWriteMode('paper')">${S.lang==='hi'?'कागज़ पर लिखो 📷':'Write on paper 📷'}</button>`}
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
        <button class="btn ghost" style="margin-top:8px" onclick="setWriteMode('trace')">${S.lang==='hi'?'अभी नहीं':'Not now'}</button>
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
      <button class="btn" style="margin-top:10px" onclick="nextLine()">${t('next')} →</button>`:''}`;
  }

  /* ---------- TRACE MODE ---------- */
  const pool = GLYPHS[S.lang][S.levels.write];
  if(!S.ctx.glyph) S.ctx.glyph = pool[Math.floor(Math.random()*pool.length)];
  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  ${tabs}
  ${levelLine}
  <div class="display" style="font-size:20px;margin-top:8px">${t('writeSub')}: <span style="color:var(--marigold)">${S.ctx.glyph}</span></div>
  <div class="padwrap">
    <canvas id="guide"></canvas>
    <canvas id="ink"></canvas>
  </div>
  ${S.ctx.score!=null? `<div class="scorebar"><i style="width:${S.ctx.score}%"></i></div><div class="feedback">${S.ctx.msg}</div>`:''}
  <div class="row" style="margin-top:10px">
    <button class="btn ghost" onclick="clearInk()">${t('clear')}</button>
    <button class="btn leaf" onclick="checkInk()">${t('check')}</button>
  </div>
  <button class="btn ghost" style="margin-top:10px" onclick="nextGlyph()">${t('next')} →</button>`;
},

/* ---------- MATH ---------- */
math(){
  if(!S.ctx.p) S.ctx.p = genProblem(S.levels.math);
  const p = S.ctx.p;
  const g = gameById(S.game);
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
        <div style="margin-top:3px"><span class="agechip">${S.lang==='hi'?band().hi:band().en}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:9px">
        <button class="stepbtn" onclick="setParentAge(-1)">−</button>
        <b style="min-width:20px;text-align:center">${S.age||6}</b>
        <button class="stepbtn" onclick="setParentAge(1)">+</button>
      </div>
    </div>
    <div style="font-size:12.5px;opacity:.7;line-height:1.5;margin:4px 0 2px">${S.lang==='hi'
      ? 'उम्र सीमा तय करती है; तख़्ती उसी सीमा के भीतर बच्चे के हिसाब से ढल जाती है।'
      : 'Age sets the range — Takhti adapts to your child within it.'}</div>

    <div class="kicker2" style="margin-top:14px">${S.lang==='hi'?'आवाज़':'SOUND'}</div>
    <div class="metric">
      <div><b>${S.lang==='hi'?'आवाज़ और असर':'Sound & narration'}</b>
        <div style="font-size:12.5px;opacity:.65">${S.lang==='hi'
          ? 'मुन्नी की आवाज़ें और पढ़कर सुनाना — बंद होने पर भी हर पाठ पहले जैसा चलता है'
          : "Munni's sounds and read-aloud narration — every lesson still runs the same with this off"}</div>
      </div>
      <button class="toggle ${S.muted?'':'on'}" onclick="toggleMuted()" aria-label="${S.muted?'unmute':'mute'}"><span></span></button>
    </div>

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
          <b>📝 ${S.lang==='hi'?'वर्तमान गृहकार्य':'Active Homework'}</b>
          <div style="font-size:13px;margin-top:4px">${hw.note || (S.lang==='hi'?'शिक्षक द्वारा निर्धारित अभ्यास':'Assigned practice routine')}</div>
          <div style="font-size:11.5px;opacity:.7;margin-top:4px;font-family:var(--mono)">Skills: ${(hw.skills||[]).join(', ')}</div>
        </div>`;
      }
      return `<div style="font-size:12.5px;opacity:.7;margin-top:8px">${S.lang==='hi'
        ? 'अभी कोई गृहकार्य नहीं। शिक्षक नीचे "शिक्षकों के लिए" से गृहकार्य दे सकते हैं।'
        : 'No homework right now. A teacher can assign some from "For teachers" below.'}</div>`;
    })()}
    <div style="font-size:12.5px;opacity:.7;line-height:1.5;margin:6px 0 2px">${S.lang==='hi'
      ? 'तुम्हारे बच्चे की प्रगति शिक्षक के साथ इसी फ़ोन से जुड़ती रहेगी और गृहकार्य यहाँ प्राप्त होगा।'
      : "Only your child's practice record and assigned homework will keep syncing with their teacher from this phone."}</div>` : `
    <input class="input" id="classcode" maxlength="6" placeholder="${S.lang==='hi'?'6 अक्षर का कोड':'6-character code'}"
      style="text-transform:uppercase;letter-spacing:2px;text-align:center;font-family:var(--mono)" autocomplete="off">
    ${S.ctx.classCodeErr? `<div class="retry" style="margin-top:8px">${S.lang==='hi'?'कोड 6 अक्षर का होना चाहिए':'The code must be 6 letters or numbers'}</div>`:''}
    <button class="btn ghost" style="margin-top:9px" onclick="setClassCode($('classcode').value)">${S.lang==='hi'?'जोड़ो':'Link'}</button>
    <div style="font-size:12.5px;opacity:.7;line-height:1.5;margin-top:6px">${S.lang==='hi'
      ? 'अगर शिक्षक ने कोड दिया है, तो यहाँ डालो — बच्चे की प्रगति उनसे जुड़ जाएगी।'
      : "If your child's teacher gave you a code, enter it here to share their progress."}</div>`}

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

