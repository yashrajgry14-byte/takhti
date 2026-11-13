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

/* Lines for a passage read this child's way (core/planner.js, core/mind.js). */
const LES_READ_SAY = {
  model:  { en: 'Listen — I will read it first. ', hi: 'सुनो — पहले मैं पढ़ती हूँ। ' },
  chunks: { en: 'Here are the hard words in pieces. Say them, then read it all.', hi: 'ये रहे कठिन शब्द टुकड़ों में। इन्हें बोलो, फिर पूरा पढ़ो।' },
  solo:   { en: 'You read it first. Then I will ask you about it.', hi: 'पहले तुम पढ़ो। फिर मैं पूछूँगी।' }
};
function lesSay(b){
  const rw = b.t === 'passage' && S.lesson && S.lesson.readWay;
  if(rw && LES_READ_SAY[rw]) return (LES_READ_SAY[rw][S.lang] || LES_READ_SAY[rw].en) + (rw === 'model' ? L(b.p) : '');
  if(typeof litSay === 'function'){ const s = litSay(b); if(s != null) return s; }
  if(typeof compSay === 'function'){ const s = compSay(b); if(s != null) return s; }
  if(typeof geoSay === 'function'){ const s = geoSay(b); if(s != null) return s; }
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
  if(typeof geoArt === 'function'){ const h = geoArt(b); if(h) return h; }

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
  const found = lessonBank().find(l => l.id === id) || schoolLessons().find(l => l.id === id);
  if(!found) return;
  S._lessonBusy = true;
  // a school lesson's words are the ones its teacher approved — never rewritten
  const les = S.online && !found.school ? await enrichLesson(found) : found;   // already falls back to `found` on any failure
  S._lessonBusy = false;
  S.lesson = { id, data: les, i:0, right:0, asked:0, picked:null };
  // a school reading lesson's passage is read this child's way (core/planner.js)
  if(les.school && typeof planFor === 'function' && les.skillId && mindDomain(les.skillId) === 'read'){ const p = planFor(les); S.lesson.readWay = p && p.way; }
  // a story is a way of being taught (core/mind.js): the answers that follow tell whether it stuck
  // (a shapes lesson: pictures or the school's story — or, after pictures, the check; core/planner.js)
  if(typeof mindTaught === 'function') for(const sk of [les.skillId].concat(CONCEPT_SKILLS[les.concept] || []).filter((x, i, a) => x && mindDomain(x) && a.indexOf(x) === i)){
    const way = typeof planMarkWay === 'function' ? planMarkWay(les, sk) : 'story';
    if(way) mindTaught(sk, way);
  }
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
/* A collectible card, kept in the child's own profile (S.cards — persisted,
   shown on the parent dashboard). Stable ids, so earning the same card
   twice doesn't duplicate it. Returns whether it was new. Shared with the
   cartoon player (ui/video-player.js). */
function awardCard(card){
  if(!card || S.cards.some(c => c.id === card.id)) return false;
  S.cards.push({ id: card.id, actor: card.actor, titleEn: card.titleEn, titleHi: card.titleHi });
  log(0, `Card earned · ${card.titleEn}`);
  saveSoon();
  return true;
}

function lesNext(){
  const les = S.lesson && S.lesson.data;
  if(!les) return;
  if(S.lesson.i >= les.beats.length - 1){
    if(!S.lesson.counted){
      S.lesson.counted = true;
      const passed = S.lesson.asked ? S.lesson.right >= S.lesson.asked/2 : true;
      if(!les.school || les.subject === 'math') record('math', passed);   // a school reading lesson isn't a maths rung
      markLessonDone(S.lesson.id);
      if(les.isHomeworkStory && S.lesson.hwAt){ S.hwDone = S.lesson.hwAt; saveSoon(); }
      if(passed && S.lesson.asked){
        if(typeof sfxChime === 'function') sfxChime();
        if(typeof triggerConfetti === 'function') triggerConfetti(1800);
      }
    }
    return;
  }
  S.lesson.i++; S.lesson.picked = null;
  if(typeof sfxCard === 'function') sfxCard();

  // the card is earned by getting the checkpoint right, not by reaching the end
  const newBeat = les.beats[S.lesson.i];
  if(newBeat && newBeat.card && S.lesson.right > 0 && awardCard(newBeat.card) && typeof sfxChime === 'function') sfxChime();

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
  // a homework story names its skill directly; a bank lesson names a concept
  const les = S.lesson.data;
  const helped = S.lesson.helpedAt === S.lesson.i;      // Ask Munni explained this one: help, not evidence
  if(typeof twinAnswerLesson === 'function') twinAnswerLesson(les, S.lesson.i, k, ok, helped);
  if(!helped && les.skillId) noteSkillAttempt(les.skillId, ok);
  else if(!helped && les.concept) noteSkillFromConcept(les.concept, ok);
  render();
  speak(ok ? (S.lang==='hi'?'बिलकुल सही!':'Exactly right!')
           : (S.lang==='hi'?`देखो — जवाब है ${b.opts[b.correct]}`:`Look — the answer is ${b.opts[b.correct]}`),
        null, () => setTimeout(() => { if(S.lesson) lesNext(); }, 700));
}

/* The homework story drills personalizeContentForHomework()'s storySkill —
   the deepest diagnosed gap it can teach, not necessarily the skill the
   teacher typed — in the child's own game. hwAt remembers which
   assignment this was, so finishing it lets Munni stop pointing at it. */
function startHomeworkStory(coop){
  const hw = personalizeContentForHomework(S);
  if(!hw || !hw.storySkill) return;
  const les = genHomeworkStory(hw.storySkill, S.game, S, { coop: !!coop, teacherNote: hw.note });
  if(!les) return;
  S.lesson = { id: les.id, data: les, i: 0, right: 0, asked: 0, picked: null, hwAt: hw.assignedAt };
  if(typeof mindTaught === 'function' && les.skillId && mindDomain(les.skillId)) mindTaught(les.skillId, 'story');
  if(typeof sfxCard === 'function') sfxCard();
  log(0, `Homework story · ${hw.storySkill}${hw.assignedSkills.includes(hw.storySkill) ? '' : ` (diagnosed under ${hw.assignedSkills.join(', ')})`} · in ${gameById(S.game).en}`);
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
  // a question about a shape keeps the shape on screen — the answer is in the picture
  const pic = asking && typeof geoPicFor === 'function' ? geoPicFor(les, S.lesson.i) : null;
  const opts = asking ? (S.lang==='hi' ? (b.hiOpts || b.opts) : b.opts) : [];
  if(asking && S.lesson.picked == null && S.lesson.helpedAt !== S.lesson.i && typeof twinExpectLesson === 'function') twinExpectLesson(les, S.lesson.i);

  // one shared match: the friend sets it up, the child answers, both win
  const coopBanner = les.coop ? `
    <div style="background:rgba(255,255,255,0.08);padding:6px 12px;border-radius:20px;font-size:12px;margin-bottom:8px;text-align:center;">
      👥 ${b.t === 'ask'
        ? (S.lang==='hi' ? `${les.p1Name} की बारी — ${les.p2Name} मदद कर सकता है` : `${les.p1Name}'s turn — ${les.p2Name} can help`)
        : `${les.p1Name} + ${les.p2Name}`}
    </div>
  ` : '';

  const earned = b.card && S.cards.some(c => c.id === b.card.id);
  const cardRewardHtml = !b.card ? '' : earned ? `
    <div class="card-reward-box" style="background:linear-gradient(135deg, ${g.accent || '#3FBB78'}33, rgba(0,0,0,0.4));border:2px solid ${g.accent || '#3FBB78'};border-radius:14px;padding:12px;margin:10px 0;text-align:center;">
      <div style="font-size:32px">${b.card.actor}</div>
      <div style="font-weight:bold;font-size:16px;color:#FFD700">${S.lang==='hi'?b.card.titleHi:b.card.titleEn}</div>
      <div style="font-size:12px;opacity:0.8">${S.lang==='hi'?'नया कार्ड!':'New card for your collection!'}</div>
    </div>` : `
    <div class="muted" style="text-align:center;margin:10px 0">${S.lang==='hi'
      ? 'अगली बार सवाल सही करो और यह कार्ड तुम्हारा!'
      : 'Get the question right next time and this card is yours!'}</div>`;

  return `
  <button class="back" onclick="endLesson()">← ${t('back')}</button>
  <div class="muted">${L(les.title)} <span class="agechip">${band()[S.lang] || band().en}</span></div>
  ${coopBanner}

  <div class="lesstage">
    ${b.svg ? b.svg : ''}
    <div class="lesart">${asking ? `${pic ? geoArt(pic) : ''}<div class="lesq">${L(b.q)}</div>` : lesArt(b, obj)}${!asking ? lesChunksHTML(b) : ''}</div>
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
    ${last
      ? `${typeof teachLessonButtonHTML === 'function' ? teachLessonButtonHTML(les) : ''}<button class="btn ${typeof teachUnitFor === 'function' && teachUnitFor(les) ? 'ghost' : 'leaf'}" onclick="endLesson()">${S.lang==='hi'?'हो गया ⭐':'Done ⭐'}</button>`
      : `<button class="btn" onclick="lesNext()">${t('next')} →</button>`}
  </div>`;
}

function lessonListHTML(){
  const mine = lessonsForChild(8);
  const total = lessonBank().filter(l => l.band === band().id).length;
  const g = gameById(S.game);
  const hwData = personalizeContentForHomework(S);
  // the diagnosed plan's own lessons: bank lessons open here, practice loops
  // (read/write) open their live screen — see core/diagnose.js's lessonsForSkill()
  const hwLessons = hwData ? hwData.lessons.slice(0, 3) : [];
  const hwStart = hwData && hwData.plan.find(p => p.verdict === 'gap' || p.verdict === 'wobbly');

  return `
  <button class="back" onclick="go('map')">← ${t('back')}</button>
  <div class="display" style="font-size:21px;margin:4px 0">
    ${S.lang==='hi'?'कहानी से सीखो':'Learn with a story'}</div>
  ${typeof circleLessonsHTML === 'function' ? circleLessonsHTML() : ''}

  ${hwData ? `
    <div class="hw-banner-card" style="background:linear-gradient(135deg, var(--marigold), #C5603A);border-radius:14px;padding:14px;margin:10px 0;color:#fff;">
      <div style="font-weight:bold;font-size:16px;">📝 ${S.lang==='hi'?'गृहकार्य':'Homework from your teacher'}</div>
      <div style="font-size:13px;margin:4px 0;opacity:0.9;">${hwData.note ? `"${attr(hwData.note)}"` : (S.lang==='hi'?'शिक्षक द्वारा दिया गया':'Assigned by your teacher')}</div>
      ${hwStart ? `<div style="font-size:12.5px;opacity:.9;margin-top:2px">${S.lang==='hi'
        ? `पहले: ${hwStart.skill.hi}`
        : `Start with: ${hwStart.skill.en}`}</div>` : ''}
      ${hwData.storySkill ? `
      <div class="row" style="gap:8px;margin-top:8px;">
        <button class="btn" style="background:#fff;color:#000;font-weight:bold;" onclick="startHomeworkStory(false)">
          ▶ ${S.lang==='hi'?'अकेले खेलो':'Play solo'}
        </button>
        <button class="btn ghost" style="color:#fff;border-color:#fff;" onclick="startHomeworkStory(true)">
          👥 ${S.lang==='hi'?'दोस्त के साथ':'With a friend'}
        </button>
      </div>` : ''}
      ${hwLessons.map(l => `<button class="lescard" style="margin-top:8px" onclick="${l.screen ? `go('${l.screen}')` : `startLesson('${l.id}')`}">
        <span class="lesic">${l.ic || '📘'}</span>
        <span><b>${L(l.title)}</b><small>${L(l.sub)}</small></span>
        <span class="lesgo">▶</span>
      </button>`).join('')}
    </div>
  ` : ''}

  ${schoolLessonsHTML()}
  ${typeof teachAgainHTML === 'function' ? teachAgainHTML() : ''}

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

/* The school's own lessons for this child's class (core/syllabus.js) —
   drafted by Gemini from the class's chapter, approved by the teacher,
   checked again on this phone. */
function schoolLessonsHTML(){
  const mine = schoolLessons();
  if(!mine.length) return '';
  const hi = S.lang === 'hi', done = S.doneLessons || [];
  // each lesson with this child's own path to its aims (core/planner.js)
  const path = l => {
    const p = typeof planFor === 'function' ? planFor(l) : null;
    if(!p || p.steps.length < 2) return '';
    return `<div class="planpath" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 0 46px;font-size:12px">${p.steps.map(s =>
      `<span class="planstep${s.done ? ' done' : s === p.next ? ' next' : ''}" title="${attr(L(s.why))}" style="padding:2px 7px;border-radius:10px;background:${s.done ? 'rgba(80,160,90,.18)' : s === p.next ? 'rgba(240,170,40,.25)' : 'rgba(0,0,0,.06)'}">${s.done ? '✓' : s === p.next ? '▶' : '○'} ${attr(L(s.label))}</span>`).join('')}</div>
      ${p.next ? `<div style="margin:2px 0 0 46px;font-size:11.5px;opacity:.7">${hi ? 'मुन्नी की योजना' : "Munni's plan"}: ${attr(L(p.next.why))}</div>` : ''}`;
  };
  return `<div class="card" style="margin:10px 0;padding:12px">
    <div class="kicker2">📚 ${hi ? 'तुम्हारे स्कूल से — इस हफ़्ते' : 'FROM YOUR SCHOOL — THIS WEEK'}</div>
    ${mine.map(l => `<button class="lescard" style="margin-top:8px" onclick="planGo('${l.id}')">
      <span class="lesic">${l.ic}</span>
      <span><b>${attr(L(l.title))}</b><small>${attr(L(l.sub))}</small></span>
      <span class="lesgo">${done.includes(l.id) ? '✓' : '▶'}</span>
    </button>${path(l)}`).join('')}
  </div>`;
}
/* A passage's two longest words, in pieces — the "hard words in pieces" way. */
function lesChunksHTML(b){
  if(b.t !== 'passage' || !S.lesson || S.lesson.readWay !== 'chunks' || typeof wordChunks !== 'function') return '';
  const text = L(b.p), lang = /[ऀ-ॿ]/.test(text) ? 'hi' : 'en';
  const len = w => typeof graphemes === 'function' ? graphemes(w).length : w.length;
  const words = text.replace(/[.,!?।"“”]/g, ' ').trim().split(/\s+/).filter((w, i, a) => len(w) >= 3 && a.indexOf(w) === i)
    .sort((x, y) => len(y) - len(x)).slice(0, 2);
  if(!words.length) return '';
  return `<div class="planchunks" style="margin-top:8px;font-size:15px">${words.map(w => `<div>${attr(wordChunks(w, lang).join(' · '))} → <b>${attr(w)}</b></div>`).join('')}</div>`;
}
/* The next step of this child's path for a school lesson. */
function planGo(id){
  const les = schoolLessons().find(l => l.id === id);
  if(!les) return;
  const p = typeof planFor === 'function' ? planFor(les) : null, s = p && p.next;
  log(0, `Plan · "${les.title.en}" for this child: ${p ? p.steps.map(x => (x.done ? '✓' : x === s ? '▶' : '·') + x.k + (x.k === 'gap' ? ' ' + x.skill : '')).join(' → ') : 'none'}${p && p.way ? ' · way: ' + p.way : ''}${p && p.knows ? ' · already knows it' : ''}`);
  if(s && s.k === 'teach' && typeof teachStart === 'function'){ const u = teachUnitFor(les); if(u){ teachStart(u); return; } }
  if(s && s.k === 'cartoon' && typeof startCartoonVideo === 'function'){ go('theater'); startCartoonVideo(s.skill); return; }
  startLesson(s && (s.k === 'gap' || s.k === 'show') ? s.lesson : id);
}
