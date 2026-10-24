/* ==================================================================
   LESSON PLAYER — animated arithmetic stories

   A lesson is a list of BEATS, not a video. Each beat names a visual
   primitive and the engine draws it in the child's own game: the same
   "share 12 equally between 3" script becomes 12 footballs for Aayush
   and 12 pithoo stones for Meera. Twenty scripts across twenty games
   is four hundred lessons, and adding the twenty-first is a data entry.

   It is also why this works offline. There is no video to stream, no
   file to cache, no bandwidth to find — a lesson is a few hundred bytes
   of JSON that the phone animates itself.

   Narration is generated from the beat by default, so a script only
   carries the words that are actually story. That keeps twenty lessons
   in both languages to a size a person can maintain.

   Beats:
     intro   the story setup, in their sport
     count   objects arrive one at a time and get counted
     add     two groups, then combined and recounted
     take    a group, some leave, recount what's left
     group   loose ones bundled into tens — place value
     line    hop along a number line
     array   rows and columns, multiplication as a shape
     share   a total dealt out equally into baskets
     bar     part-whole bar model
     frac    a whole cut into equal parts
     ask     a checkpoint: the story pauses until they answer
     win     the payoff
   ================================================================== */

/* --- narration templates. {n} {a} {b} {ans} {obj} get substituted. --- */
const LES_SAY = {
  count: { en:'Look — let us count them. {ans} in all.', hi:'देखो — आओ गिनें। कुल {ans}।' },
  add:   { en:'{a} here, and {b} more arrive. That makes {ans}.', hi:'यहाँ {a}, और {b} आ गए। कुल हुए {ans}।' },
  take:  { en:'{a} to start. {b} go away. {ans} are left.', hi:'शुरू में {a}। {b} चले गए। बचे {ans}।' },
  group: { en:'{a} loose ones. Bundle every ten — {tens} bundles and {ones} left over.', hi:'{a} अलग-अलग। हर दस का बंडल — {tens} बंडल और {ones} बचे।' },
  line:  { en:'Start at {a} and hop {b} at a time. We land on {ans}.', hi:'{a} से शुरू, {b} के कदम। पहुँचे {ans} पर।' },
  array: { en:'{a} rows of {b}. Count them all: {ans}.', hi:'{a} पंक्तियाँ, हर एक में {b}। कुल: {ans}।' },
  share: { en:'{a} shared equally between {b}. Everyone gets {ans}.', hi:'{a} को {b} में बराबर बाँटो। सबको मिले {ans}।' },
  bar:   { en:'{a} altogether. {b} of them are here, so {ans} must be there.', hi:'कुल {a}। इनमें से {b} यहाँ हैं, तो {ans} वहाँ होंगे।' },
  frac:  { en:'One whole, cut into {b} equal parts. Each part is one out of {b}.', hi:'एक पूरा, {b} बराबर हिस्सों में। हर हिस्सा {b} में से एक।' }
};

function lesSay(b){
  if(typeof litSay === 'function'){ const s = litSay(b); if(s != null) return s; }
  if(typeof compSay === 'function'){ const s = compSay(b); if(s != null) return s; }
  if(b.say) return L(b.say);
  const tpl = LES_SAY[b.t];
  if(!tpl) return '';
  const v = lesValues(b);
  return (tpl[S.lang] || tpl.en).replace(/\{(\w+)\}/g, (_, k) => v[k] != null ? v[k] : '');
}

function lesValues(b){
  const v = { a:b.a, b:b.b, n:b.n };
  if(b.t==='count') v.ans = b.n;
  if(b.t==='add')   v.ans = b.a + b.b;
  if(b.t==='take')  v.ans = b.a - b.b;
  if(b.t==='line')  v.ans = b.a + b.b * (b.hops||1);
  if(b.t==='array') v.ans = b.a * b.b;
  if(b.t==='share') v.ans = Math.floor(b.a / b.b);
  if(b.t==='bar')   v.ans = b.a - b.b;
  if(b.t==='group'){ v.tens = Math.floor(b.a/10); v.ones = b.a%10; }
  return v;
}

/* --- the drawing, one function per beat type --- */
function lesArt(b, obj){
  if(typeof litArt === 'function'){ const h = litArt(b); if(h) return h; }
  if(typeof compArt === 'function'){ const h = compArt(b); if(h) return h; }

  const dots = (n, cls, delay=0.07, size=24) => [...Array(n)].map((_,i) =>
    `<span class="obj in" style="animation-delay:${(delay*i).toFixed(2)}s;font-size:${size}px">${obj}</span>`).join('');

  switch(b.t){
    case 'intro':
      return `<div class="lesintro"><div class="lesbig">${obj}</div></div>`;

    case 'count':
      return `<div class="grp">${dots(b.n, 'in', 0.13)}</div>
              <div class="tally" id="lestally">${b.n}</div>`;

    case 'add':
      return `<div class="plusrow">
                <div class="grp">${dots(b.a)}</div>
                <div class="opsign">+</div>
                <div class="grp">${dots(b.b, 'in', 0.07)}</div>
              </div>
              <div class="tally">${b.a + b.b}</div>`;

    case 'take':
      return `<div class="grp">
                ${dots(b.a - b.b)}
                ${[...Array(b.b)].map((_,i)=>
                  `<span class="obj in leaving" style="animation-delay:${(0.07*i).toFixed(2)}s">${obj}</span>`).join('')}
              </div>
              <div class="tally">${b.a - b.b}</div>`;

    case 'group': {
      const tens = Math.floor(b.a/10), ones = b.a%10;
      return `<div class="lesgroup">
        ${[...Array(tens)].map((_,i)=>
          `<div class="bundle in" style="animation-delay:${(0.12*i).toFixed(2)}s">
             <span>${obj}</span><b>10</b></div>`).join('')}
        <div class="grp loose">${dots(ones, 'in', 0.07, 20)}</div>
      </div>
      <div class="tally">${tens} × 10 + ${ones} = ${b.a}</div>`;
    }

    case 'line': {
      const hops = b.hops || 1, end = b.a + b.b*hops;
      const lo = Math.max(0, Math.min(b.a, end) - 2), hi = Math.max(b.a, end) + 2, span = hi - lo || 1;
      const x = v => 20 + (v - lo) * (320/span);
      return `<svg class="nline" viewBox="0 0 360 70">
        <line x1="20" y1="40" x2="340" y2="40" stroke="currentColor" stroke-width="1.5" opacity=".45"/>
        ${[...Array(span+1)].map((_,i)=>`
          <line x1="${x(lo+i)}" y1="40" x2="${x(lo+i)}" y2="46" stroke="currentColor" stroke-width="1" opacity=".45"/>
          <text x="${x(lo+i)}" y="60" font-size="9" text-anchor="middle" fill="currentColor" opacity=".7">${lo+i}</text>`).join('')}
        ${[...Array(hops)].map((_,i)=>{
          const from = b.a + b.b*i, to = from + b.b;
          return `<path class="hop" style="animation-delay:${(0.5*i).toFixed(2)}s"
            d="M${x(from)} 38 Q ${(x(from)+x(to))/2} 6 ${x(to)} 38"
            fill="none" stroke="var(--marigold)" stroke-width="2.5"/>`;}).join('')}
        <text x="${x(end)}" y="26" font-size="15" text-anchor="middle">${obj}</text>
      </svg>
      <div class="tally">${end}</div>`;
    }

    case 'array':
      return `<div class="arrgrid">
        ${[...Array(b.a)].map((_,r)=>`<div class="row">${
          [...Array(b.b)].map((_,c)=>
            `<span class="obj in" style="animation-delay:${(0.05*(r*b.b+c)).toFixed(2)}s;font-size:19px">${obj}</span>`
          ).join('')}</div>`).join('')}
      </div>
      <div class="tally">${b.a} × ${b.b} = ${b.a*b.b}</div>`;

    case 'share': {
      const each = Math.floor(b.a / b.b);
      return `<div class="baskets">
        ${[...Array(b.b)].map((_,k)=>`<div class="basket">
          <div class="grp">${[...Array(each)].map((_,i)=>
            `<span class="obj in" style="animation-delay:${(0.09*(i*b.b+k)).toFixed(2)}s;font-size:19px">${obj}</span>`).join('')}</div>
          <b>${each}</b></div>`).join('')}
      </div>
      <div class="tally">${b.a} ÷ ${b.b} = ${each}</div>`;
    }

    case 'bar':
      return `<div class="barmodel">
        <div class="whole"><span>${b.a}</span></div>
        <div class="parts">
          <div class="part known" style="flex:${b.b}"><span>${b.b}</span></div>
          <div class="part unknown" style="flex:${b.a-b.b}"><span>?</span></div>
        </div>
      </div>
      <div class="tally">${b.a} − ${b.b} = ${b.a-b.b}</div>`;

    case 'frac':
      return `<div class="fracpie">
        ${[...Array(b.b)].map((_,i)=>`<div class="slice in" style="animation-delay:${(0.14*i).toFixed(2)}s;
          transform:rotate(${i*(360/b.b)}deg) skewY(${90-(360/b.b)}deg)"></div>`).join('')}
      </div>
      <div class="tally">1 / ${b.b}</div>`;

    case 'win':
      return `<div class="leswin"><div class="lesbig">🎉</div><div class="grp">${dots(3,'in',0.15,26)}</div></div>`;

    default:
      return `<div class="lesbig">${obj}</div>`;
  }
}

/* ================= the session =================
   S.lesson.data holds the resolved lesson body (original or, when a signal
   is available, the Tier 2-rewritten copy) so every other function here
   reads THAT instead of re-looking the id up — lessonBank() now includes
   the generated bank, and re-fetching by id would also throw away
   whatever enrichLesson() came back with. */
async function startLesson(id){
  if(S._lessonBusy) return;
  const found = lessonBank().find(l => l.id === id);
  if(!found) return;
  S._lessonBusy = true;
  const les = S.online ? await enrichLesson(found) : found;   // already falls back to `found` on any failure
  S._lessonBusy = false;
  S.lesson = { id, data: les, i:0, right:0, asked:0, picked:null };
  log(0, `Lesson "${id}" · ${les.beats.length} beats · rendered in ${gameById(S.game).en}`);
  render();
  lesNarrate();
}
function endLesson(){
  const l = S.lesson;
  if(l && l.asked) log(0, `Lesson finished · ${l.right}/${l.asked} checkpoints correct`);
  S.lesson = null;
  render();
}
function lesBeat(){
  const les = S.lesson && S.lesson.data;
  return les ? les.beats[S.lesson.i] : null;
}
function lesNarrate(){
  const b = lesBeat();
  if(!b) return;
  const line = b.t === 'ask' ? L(b.q) : lesSay(b);
  if(!line) return;
  speak(line, null, () => {
    if(!S.lesson || b.t === 'ask') return;
    setTimeout(() => { if(S.lesson && lesBeat() === b) lesNext(); }, 900);
  });
}
function lesNext(){
  const les = S.lesson && S.lesson.data;
  if(!les) return;
  if(S.lesson.i >= les.beats.length - 1){
    if(!S.lesson.counted){
      S.lesson.counted = true;
      record('math', S.lesson.asked ? S.lesson.right >= S.lesson.asked/2 : true);
      markLessonDone(S.lesson.id);
    }
    return;
  }
  S.lesson.i++; S.lesson.picked = null;
  if(typeof sfxCard === 'function') sfxCard();

  const newBeat = les.beats[S.lesson.i];
  if(newBeat && newBeat.card){
    S.unlockedCards = S.unlockedCards || [];
    if(!S.unlockedCards.some(c=>c.id===newBeat.card.id)){
      S.unlockedCards.push(newBeat.card);
      if(typeof sfxChime === 'function') sfxChime();
    }
  }

  render(); lesNarrate();
}
function lesAnswer(k){
  const b = lesBeat(); if(!b || S.lesson.picked != null) return;
  S.lesson.picked = k;
  S.lesson.asked++;
  const ok = k === b.correct;
  if(ok){
    S.lesson.right++;
    if(typeof sfxChime === 'function') sfxChime();
  } else {
    if(typeof sfxThud === 'function') sfxThud();
  }
  log(0, `Lesson checkpoint · ${ok ? 'correct' : 'incorrect'}`);
  if(typeof noteSkillFromConcept === 'function'){
    const concept = S.lesson.data && S.lesson.data.concept;
    if(concept) noteSkillFromConcept(concept, ok);
  }
  render();
  speak(ok ? (S.lang==='hi'?'बिलकुल सही!':'Exactly right!')
           : (S.lang==='hi'?`देखो — जवाब है ${b.opts[b.correct]}`:`Look — the answer is ${b.opts[b.correct]}`),
        null, () => setTimeout(() => { if(S.lesson) lesNext(); }, 700));
}

function triggerStorySelfListen(){
  const b = lesBeat();
  if(!b) return;
  const line = b.t === 'ask' ? L(b.q) : lesSay(b);
  if(typeof sfxChalk === 'function') sfxChalk();
  if(typeof speakWithSelfListen === 'function'){
    speakWithSelfListen(line);
  } else if(typeof speak === 'function'){
    speak(line);
  }
}

function startHomeworkStory(skillId, gameId, coop){
  if(typeof genHomeworkStory !== 'function') return;
  const les = genHomeworkStory(skillId, gameId, S, { coop: !!coop });
  S.lesson = { id: les.id, data: les, i: 0, right: 0, asked: 0, picked: null };
  if(typeof sfxCard === 'function') sfxCard();
  log(0, `Homework Story "${les.id}" started in ${gameById(gameId || S.game).en}`);
  render();
  lesNarrate();
}

/* ================= render ================= */
function lessonHTML(){
  const les = S.lesson && S.lesson.data;
  if(!les) return '';
  const b = les.beats[S.lesson.i];
  const g = gameById(les.gameId || S.game);
  const obj = g.proj || g.ic;
  const last = S.lesson.i >= les.beats.length - 1;

  const asking = b.t === 'ask';
  const opts = asking ? (S.lang==='hi' ? (b.hiOpts || b.opts) : b.opts) : [];

  const coopBanner = les.coop ? `
    <div style="background:rgba(255,255,255,0.08);padding:6px 12px;border-radius:20px;font-size:12px;margin-bottom:8px;text-align:center;">
      👥 ${S.lesson.i % 2 === 0 ? (les.p1Name || 'Player 1') + "'s Turn" : (les.p2Name || 'Player 2') + "'s Turn"}
    </div>
  ` : '';

  const cardRewardHtml = b.card ? `
    <div class="card-reward-box" style="background:linear-gradient(135deg, ${g.accent || '#3FBB78'}33, rgba(0,0,0,0.4));border:2px solid ${g.accent || '#3FBB78'};border-radius:14px;padding:12px;margin:10px 0;text-align:center;">
      <div style="font-size:32px">${b.card.actor}</div>
      <div style="font-weight:bold;font-size:16px;color:#FFD700">${S.lang==='hi'?b.card.hiGameTitle:b.card.gameTitle} ${b.card.stamp}</div>
      <div style="font-size:12px;opacity:0.8">${S.lang==='hi'?'कौशल: ' + b.card.skillHi : 'Skill Mastered: ' + b.card.skillEn}</div>
    </div>
  ` : '';

  return `
  <button class="back" onclick="endLesson()">← ${t('back')}</button>
  <div class="muted">${L(les.title)} <span class="agechip">${band()[S.lang] || band().en}</span></div>
  ${coopBanner}

  <div class="lesstage">
    ${b.svg ? b.svg : ''}
    <div class="lesart">${asking ? `<div class="lesq">${L(b.q)}</div>` : lesArt(b, obj)}</div>
    ${!asking ? `<div class="lescap">${lesSay(b)}</div>` : ''}
    ${cardRewardHtml}
  </div>

  <div class="pbar">${les.beats.map((_,k)=>`<i class="${k<=S.lesson.i?'on':''}"></i>`).join('')}</div>

  ${asking ? `<div class="opts" style="margin-top:12px">
      ${opts.map((o,k)=>`<button class="opt ${
        S.lesson.picked!=null && k===b.correct ? 'right' :
        S.lesson.picked===k ? 'wrong' : ''}" onclick="lesAnswer(${k})">${o}</button>`).join('')}
    </div>` : ''}

  <div class="row" style="margin-top:12px;gap:6px;">
    <button class="btn ghost" onclick="lesNarrate()">🔊 ${t('hear')}</button>
    <button class="btn ghost" onclick="triggerStorySelfListen()">🎙️ ${S.lang==='hi'?'स्वयं बोलें':'Self-Listen'}</button>
    ${last
      ? `<button class="btn leaf" onclick="endLesson()">${S.lang==='hi'?'हो गया ⭐':'Done ⭐'}</button>`
      : `<button class="btn" onclick="lesNext()">${t('next')} →</button>`}
  </div>`;
}

function lessonListHTML(){
  const mine = lessonsForChild(8);
  const total = lessonBank().filter(l => l.band === band().id).length;
  const g = gameById(S.game);
  const hwData = typeof personalizeContentForHomework === 'function' ? personalizeContentForHomework() : null;

  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="display" style="font-size:21px;margin:4px 0">
    ${S.lang==='hi'?'कहानी से सीखो':'Learn with a story'}</div>
  
  ${hwData ? `
    <div class="hw-banner-card" style="background:linear-gradient(135deg, var(--marigold), #C5603A);border-radius:14px;padding:14px;margin:10px 0;color:#fff;">
      <div style="font-weight:bold;font-size:16px;">📝 ${S.lang==='hi'?'गृहकार्य कहानी':'Teacher Homework Story'}</div>
      <div style="font-size:13px;margin:4px 0;opacity:0.9;">${hwData.note ? `"${hwData.note}"` : (S.lang==='hi'?'शिक्षक द्वारा निर्धारित कार्य':'Assigned by teacher')}</div>
      <div class="row" style="gap:8px;margin-top:8px;">
        <button class="btn" style="background:#fff;color:#000;font-weight:bold;" onclick="startHomeworkStory('${hwData.assignedSkills[0]}', '${S.game}', false)">
          ▶ ${S.lang==='hi'?'सोलो खेलें':'Play Solo'}
        </button>
        <button class="btn ghost" style="color:#fff;border-color:#fff;" onclick="startHomeworkStory('${hwData.assignedSkills[0]}', '${S.game}', true)">
          👥 ${S.lang==='hi'?'2-खिलाड़ी मोड':'2-Player Co-Op'}
        </button>
      </div>
    </div>
  ` : ''}

  <div class="muted">${S.lang==='hi'
    ? `हर कहानी तुम्हारे ${g.hi} से बनी है।`
    : `Every story is told with your ${g.en}.`}</div>
  <div class="muted" style="font-size:12px;margin-top:2px">${S.lang==='hi'
    ? `तुम्हारी उम्र के लिए ${total} में से ${mine.length} कहानियाँ`
    : `${mine.length} of ${total} stories for your age`}</div>
  <div class="leslist">
    ${mine.map(l=>`<button class="lescard" onclick="startLesson('${l.id}')">
      <span class="lesic">${l.ic}</span>
      <span><b>${L(l.title)}</b><small>${L(l.sub)}</small></span>
      <span class="lesgo">▶</span>
    </button>`).join('')}
  </div>
  ${mine.length ? '' : `<div class="muted" style="margin-top:14px">${
    S.lang==='hi'?'इस उम्र के लिए कहानियाँ जल्द आ रही हैं।':'Stories for this age are coming soon.'}</div>`}`;
}
