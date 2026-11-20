/* ==================================================================
   THE PICTURE HUT — the cartoon shelf and player (VIEWS.theater).

   Reached from its own place on the jungle map. The shelf shows one
   recommended episode (recommendNextVideo()), the series this child's
   band reaches (cartoonSeriesFor()), and the full catalog with a theme
   filter. Playing an episode builds it on the spot
   (generateCartoonBlueprint(), core/generative-brain.js).

   Every episode ends in a real question, and the answer is real
   evidence: it feeds the same skill history the teacher's diagnostic
   reads (noteSkillAttempt) and the same maths level/goal counter every
   other maths activity does (record('math')). The card at the end is
   only awarded for a right answer, and kept in the child's profile.
   ================================================================== */

function startCartoonVideo(skillId, themeId, gameId){
  // the homework episode opens with the teacher's own note
  const hw = personalizeContentForHomework(S);
  const teacherNote = hw && hw.storySkill === skillId ? hw.note : '';
  const vid = generateCartoonBlueprint(S, skillId, { themeId, gameId, teacherNote });
  if(!vid) return;
  S.activeVideo = { data: vid, sceneIdx: 0, picked: null, right: false };
  if(typeof mindTaught === 'function') mindTaught(vid.skillId, 'cartoon');          // a cartoon is a way of being taught (core/mind.js)
  if(typeof sfxCard === 'function') sfxCard();
  log(0, `Cartoon · ${vid.skillId} in ${vid.theme.en} with ${vid.game.en}`);
  render();
  videoNarrateScene();
}

function videoNarrateScene(){
  const av = S.activeVideo; if(!av) return;
  const scene = av.data.scenes[av.sceneIdx];
  clearTimeout(S._vidTimer);
  const line = scene.isCheckpoint ? `${L(scene.narration)} ${L(scene.question)}` : L(scene.narration);
  speak(line, null, () => {
    // story scenes move on by themselves; the checkpoint waits for the child
    if(scene.isCheckpoint || S.activeVideo !== av || av.sceneIdx !== av.data.scenes.indexOf(scene)) return;
    S._vidTimer = setTimeout(() => { if(S.activeVideo === av) videoNextScene(); }, 1500);
  });
}

function videoNextScene(){
  const av = S.activeVideo; if(!av) return;
  clearTimeout(S._vidTimer);
  if(av.sceneIdx >= av.data.scenes.length - 1) return;
  const scene = av.data.scenes[av.sceneIdx];
  if(scene.isCheckpoint && av.picked == null) return;   // answer first
  av.sceneIdx++; av.picked = null;
  const next = av.data.scenes[av.sceneIdx];
  if(next.badge && av.right && awardCard(next.badge) && typeof sfxChime === 'function') sfxChime();
  if(typeof sfxCard === 'function') sfxCard();
  render();
  videoNarrateScene();
}

function videoAnswer(k){
  const av = S.activeVideo; if(!av) return;
  const scene = av.data.scenes[av.sceneIdx];
  if(!scene.isCheckpoint || av.picked != null) return;
  av.picked = k;
  const ok = k === scene.correct;
  av.right = ok;
  const helped = av.helpedAt === av.sceneIdx;
  const twin = typeof twinCheck === 'function', tp = twin ? parseProblem(scene.question.en) : null;
  if(twin) twinCheck('video:' + scene.question.en, Number(scene.opts[k]), ok, helped);
  if(!helped){ noteSkillAttempt(av.data.skillId, ok); record('math', ok); if(tp) twinAnswer(av.data.skillId, tp, Number(scene.opts[k])); }   // after Ask Munni: help, not evidence
  log(0, `Cartoon checkpoint · ${av.data.skillId} · ${ok ? 'correct' : 'incorrect'}`);
  if(ok){
    if(typeof sfxChime === 'function') sfxChime();
    if(typeof triggerConfetti === 'function') triggerConfetti(1800);
  } else if(typeof sfxThud === 'function') sfxThud();
  render();
  speak(ok ? (S.lang==='hi'?'शानदार! सही उत्तर!':'Brilliant! Correct answer!')
           : (S.lang==='hi'?`देखो — सही उत्तर है ${scene.opts[scene.correct]}`:`Look — the answer is ${scene.opts[scene.correct]}`),
        null, () => { S._vidTimer = setTimeout(() => { if(S.activeVideo === av) videoNextScene(); }, 1000); });
}

/* Back to the shelf from the player. */
function endCartoonVideo(){
  clearTimeout(S._vidTimer);
  S.activeVideo = null;
  render();
}
/* Leaving the Picture Hut altogether — called by go() for any other screen. */
function theaterStop(){
  clearTimeout(S._vidTimer);
  S.activeVideo = null;
}
function setTheaterTheme(id){
  S.ctx.theme = id;
  render();
}

/* ================= renderers ================= */

function videoPlayerHTML(){
  const av = S.activeVideo, v = av.data;
  const scene = v.scenes[av.sceneIdx];
  const accent = v.theme.accent;
  const isLast = av.sceneIdx >= v.scenes.length - 1;
  const isCheck = !!scene.isCheckpoint;
  if(isCheck && av.picked == null && av.helpedAt !== av.sceneIdx && typeof twinExpect === 'function'){
    const tp = parseProblem(scene.question.en);
    if(tp) twinExpect('video:' + scene.question.en, v.skillId, tp, scene.opts);   // the twin's guess, before the answer
  }
  const earned = scene.badge && S.cards.some(c => c.id === scene.badge.id);

  return `
    <button class="back" onclick="endCartoonVideo()">← ${t('back')}</button>
    <div class="muted">${L(v.title)} <span class="agechip">${S.lang==='hi'?band().hi:band().en}</span></div>

    <div class="video-stage glass-card" style="border-radius:18px;padding:14px;margin:8px 0;border:2px solid ${accent};">
      <div style="font-size:13px;font-weight:bold;color:${accent};margin-bottom:6px">${L(scene.title)}</div>
      ${scene.svg}
      ${scene.beat ? `<div class="lesart">${lesArt(scene.beat, v.game.proj)}</div>` : ''}
      <div class="video-subtitles">
        ${isCheck ? `<div class="video-q">❓ ${L(scene.question)}</div>` : ''}
        ${L(scene.narration)}
      </div>
      ${isCheck ? `
        <div class="opts" style="margin-top:14px">
          ${scene.opts.map((o,k)=>`<button class="opt ${
            av.picked!=null && k===scene.correct ? 'right' :
            av.picked===k ? 'wrong' : ''}" onclick="videoAnswer(${k})">${o}</button>`).join('')}
        </div>` : ''}
      ${scene.badge ? (earned
        ? `<div class="card-reward-box"><div style="font-size:30px">${scene.badge.actor}</div><b>${S.lang==='hi'?scene.badge.titleHi:scene.badge.titleEn}</b>
             <div style="font-size:12px;opacity:.8">${S.lang==='hi'?'तुम्हारे संग्रह में!':'In your collection!'}</div></div>`
        : `<div class="muted" style="text-align:center;margin-top:8px">${S.lang==='hi'
             ? 'अगली बार सवाल सही करो और यह कार्ड तुम्हारा!' : 'Get the question right next time and this card is yours!'}</div>`) : ''}
    </div>

    <div class="pbar">${v.scenes.map((_,k)=>`<i class="${k<=av.sceneIdx?'on':''}"></i>`).join('')}</div>

    <div class="row" style="margin-top:12px;gap:8px;">
      <button class="btn ghost" onclick="videoNarrateScene()">🔊 ${t('hear')}</button>
      ${isLast
        ? `<button class="btn leaf" onclick="endCartoonVideo()">${S.lang==='hi'?'हो गया ⭐':'Done ⭐'}</button>`
        : `<button class="btn" ${isCheck && av.picked==null ? 'disabled' : ''} onclick="videoNextScene()">${t('next')} →</button>`}
    </div>`;
}

function videoLibraryHTML(){
  const hi = S.lang === 'hi';
  const theme = S.ctx.theme || 'all';
  const rec = recommendNextVideo(S);
  const recSkill = rec && skillById(rec.skillId);
  const series = cartoonSeriesFor();
  const catalog = getVideoCatalog(S, theme);
  const play = (skillId, themeId, gameId) =>
    `startCartoonVideo('${skillId}','${themeId}',${gameId ? `'${gameId}'` : 'null'})`;

  return `
    <button class="back" onclick="go('map')">← ${t('back')}</button>
    <div class="display" style="font-size:24px;margin:4px 0 2px;">📺 ${hi?'तस्वीरों की झोपड़ी':'The Picture Hut'}</div>
    <div class="muted">${hi?'छोटे कार्टून — हर एक के अंत में एक सवाल':'Short cartoons — each one ends with a question for you'}</div>

    ${typeof watchShelfHTML === 'function' ? watchShelfHTML() : ''}

    ${rec && recSkill ? `
      <div class="hero-video-card glass-card">
        <div class="hero-kicker">⭐ ${L(rec.reason)}</div>
        <div class="hero-title">${hi ? recSkill.hi : recSkill.en}</div>
        <button class="btn" style="margin-top:8px" onclick="${play(rec.skillId, rec.themeId, null)}">▶ ${hi?'कार्टून देखो':'Watch'}</button>
      </div>` : ''}

    ${series.length ? `
      <div class="theater-h">🍿 ${hi?'कार्टून सीरीज़':'Series'}</div>
      <div class="series-row">
        ${series.map(sr => `
          <div class="series-card glass-card">
            <div style="font-size:32px">${sr.icon}</div>
            <div class="series-title">${L(sr.title)}</div>
            ${sr.episodes.map((id, n) => `<button class="btn ghost series-ep" onclick="${play(id, sr.themeId, sr.gameId)}">
              ${S.cards.some(k => k.id === `card-vid-${id}`) ? '⭐' : '▶'} ${n+1}. ${hi ? skillById(id).hi : skillById(id).en}</button>`).join('')}
          </div>`).join('')}
      </div>` : ''}

    <div class="theater-h">🎬 ${hi?'सभी कार्टून':'All cartoons'}</div>
    <div class="theme-deck theme-filter-row">
      <button class="theme-pill ${theme==='all'?'active':''}" onclick="setTheaterTheme('all')">🌟 ${hi?'सभी':'All'}</button>
      ${THEMES.map(th => `<button class="theme-pill ${theme===th.id?'active':''}" onclick="setTheaterTheme('${th.id}')">${th.ic} ${hi?th.hi:th.en}</button>`).join('')}
    </div>
    <div class="video-grid">
      ${catalog.map(v => `
        <button class="video-card glass-card" onclick="${play(v.skillId, v.themeId, null)}">
          <span class="vc-thumb">${v.thumbnail}</span>
          <span class="vc-title">${L(v.title)}</span>
          ${v.earned ? '<span class="vc-earned">⭐</span>' : ''}
        </button>`).join('')}
    </div>`;
}

if(typeof VIEWS !== 'undefined') VIEWS.theater = () => S.activeVideo ? videoPlayerHTML() : videoLibraryHTML();
