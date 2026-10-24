/* ==================================================================
   CARTOON THEATER PLAYER & VIDEO LIBRARY UI ("YouTube for Kids")

   Renders vector SVG cartoon video playback, scene transitions, Web Audio
   SFX, synchronized subtitles, interactive checkpoints, and video gallery.

   Requires: core/generative-brain.js, core/video-library-catalog.js, core/cartoon-series.js
   ================================================================== */

function startCartoonVideo(videoId, skillId, gameId){
  let vid = null;
  if(typeof generateCartoonBlueprint === 'function'){
    vid = generateCartoonBlueprint(S, skillId || 'add2', { gameId: gameId || S.game });
  }
  if(!vid) return;

  S.activeVideo = {
    data: vid,
    sceneIdx: 0,
    picked: null,
    correctCount: 0
  };

  if(typeof sfxCard === 'function') sfxCard();
  log(0, `Cartoon Video "${vid.id}" started`);
  render();
  videoNarrateScene();
}

function videoNarrateScene(){
  const v = S.activeVideo && S.activeVideo.data;
  if(!v) return;
  const scene = v.scenes[S.activeVideo.sceneIdx];
  if(!scene) return;

  const line = scene.isCheckpoint ? L(scene.question) : L(scene.narration);
  if(!line) return;

  if(typeof speak === 'function'){
    speak(line, null, () => {
      if(!S.activeVideo || scene.isCheckpoint) return;
      setTimeout(() => {
        if(S.activeVideo && S.activeVideo.sceneIdx === scene.sceneIndex){
          videoNextScene();
        }
      }, 1500);
    });
  }
}

function videoNextScene(){
  const v = S.activeVideo && S.activeVideo.data;
  if(!v) return;

  if(S.activeVideo.sceneIdx >= v.scenes.length - 1){
    log(0, `Video finished · unlocked badge`);
    if(typeof sfxChime === 'function') sfxChime();
    const finalScene = v.scenes[v.scenes.length - 1];
    if(finalScene && finalScene.badge){
      S.unlockedCards = S.unlockedCards || [];
      if(!S.unlockedCards.some(c=>c.id===finalScene.badge.id)){
        S.unlockedCards.push(finalScene.badge);
      }
    }
    return;
  }

  S.activeVideo.sceneIdx++;
  S.activeVideo.picked = null;
  if(typeof sfxCard === 'function') sfxCard();
  render();
  videoNarrateScene();
}

function videoAnswer(k){
  const v = S.activeVideo && S.activeVideo.data;
  if(!v) return;
  const scene = v.scenes[S.activeVideo.sceneIdx];
  if(!scene || !scene.isCheckpoint || S.activeVideo.picked != null) return;

  S.activeVideo.picked = k;
  const ok = k === scene.correct;
  if(ok){
    S.activeVideo.correctCount++;
    if(typeof triggerConfetti === 'function') triggerConfetti(1800);
    if(typeof sfxChime === 'function') sfxChime();
  } else {
    if(typeof sfxThud === 'function') sfxThud();
  }

  render();
  if(typeof speak === 'function'){
    speak(ok ? (S.lang==='hi'?'शानदार! सही उत्तर!':'Brilliant! Correct answer!')
             : (S.lang==='hi'?`देखो — सही उत्तर है ${scene.opts[scene.correct]}`:`Look — the answer is ${scene.opts[scene.correct]}`),
          null, () => setTimeout(() => { if(S.activeVideo) videoNextScene(); }, 1000));
  }
}

function triggerVideoSelfListen(){
  const v = S.activeVideo && S.activeVideo.data;
  if(!v) return;
  const scene = v.scenes[S.activeVideo.sceneIdx];
  if(!scene) return;

  const line = scene.isCheckpoint ? L(scene.question) : L(scene.narration);
  if(typeof sfxChalk === 'function') sfxChalk();
  if(typeof speakWithSelfListen === 'function'){
    speakWithSelfListen(line);
  } else if(typeof speak === 'function'){
    speak(line);
  }
}

function endCartoonVideo(){
  S.activeVideo = null;
  render();
}

/* ================= THEATER & PLAYER RENDERERS ================= */

function videoPlayerHTML(){
  const v = S.activeVideo && S.activeVideo.data;
  if(!v) return '';

  const scene = v.scenes[S.activeVideo.sceneIdx];
  const g = v.game || (typeof gameById === 'function' ? gameById(S.game) : { accent: '#3FBB78' });
  const isLast = S.activeVideo.sceneIdx >= v.scenes.length - 1;
  const isCheck = scene.isCheckpoint;

  const opts = isCheck ? (S.lang==='hi' ? (scene.hiOpts || scene.opts) : scene.opts) : [];

  return `
    <button class="back" onclick="endCartoonVideo()">← ${t('back')}</button>
    <div class="muted">${L(v.title)} <span class="agechip">${band()[S.lang] || band().en}</span></div>

    <div class="video-stage glass-card" style="border-radius:18px;padding:14px;margin:8px 0;border:2px solid ${g.accent || '#3FBB78'};box-shadow:0 12px 30px rgba(0,0,0,0.35);">
      <div style="font-size:13px;font-weight:bold;color:${g.accent || '#3FBB78'};margin-bottom:6px;font-family:'Baloo 2',cursive;">${L(scene.title)}</div>
      
      <!-- Vector SVG Animated Keyframe -->
      ${scene.svg ? scene.svg : ''}

      <!-- Subtitle Narration -->
      <div class="video-subtitles" style="background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);padding:12px;border-radius:14px;margin-top:10px;font-size:15px;line-height:1.45;text-align:center;">
        ${isCheck ? `<div style="font-weight:bold;color:#FECA57;margin-bottom:4px;font-size:16px;">❓ ${L(scene.question)}</div>` : ''}
        ${L(scene.narration)}
      </div>

      <!-- Interactive Checkpoint Options -->
      ${isCheck ? `
        <div class="opts" style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${opts.map((o,k)=>`<button class="btn-3d ${
            S.activeVideo.picked!=null && k===scene.correct ? 'leaf' :
            S.activeVideo.picked===k ? 'rani' : 'indigo'}" onclick="videoAnswer(${k})">${o}</button>`).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Progress bar -->
    <div class="pbar">${v.scenes.map((_,k)=>`<i class="${k<=S.activeVideo.sceneIdx?'on':''}"></i>`).join('')}</div>

    <!-- Video Controls -->
    <div class="row" style="margin-top:12px;gap:8px;">
      <button class="btn-3d ghost" style="flex:1" onclick="videoNarrateScene()">🔊 ${t('hear')}</button>
      <button class="btn-3d ghost" style="flex:1" onclick="triggerVideoSelfListen()">🎙️ ${S.lang==='hi'?'स्वयं बोलें':'Self-Listen'}</button>
      ${isLast
        ? `<button class="btn-3d leaf" style="flex:1.2" onclick="endCartoonVideo()">${S.lang==='hi'?'समाप्त ⭐':'Finish ⭐'}</button>`
        : `<button class="btn-3d" style="flex:1.2" onclick="videoNextScene()">${t('next')} →</button>`}
    </div>
  `;
}

function videoLibraryHTML(themeFilter){
  const c = S;
  const currentTheme = themeFilter || S.activeThemeFilter || 'all';
  const recommended = typeof recommendNextVideo === 'function' ? recommendNextVideo(c) : null;
  const catalog = typeof getVideoCatalog === 'function' ? getVideoCatalog(c, currentTheme) : [];

  const themePills = [
    { id:'all', label:{en:'🌟 All Themes', hi:'🌟 सभी थीम'} },
    { id:'anime', label:{en:'⚔️ Anime', hi:'⚔️ एनिमे'} },
    { id:'cinema', label:{en:'🎬 Movies', hi:'🎬 फ़िल्में'} },
    { id:'folktale', label:{en:'📜 Folk Tales', hi:'📜 लोक कथाएँ'} },
    { id:'scifi', label:{en:'🚀 Sci-Fi Space', hi:'🚀 साइ-फ़ाइ'} },
    { id:'fantasy', label:{en:'🐉 Magic & Fantasy', hi:'🐉 फ़ैंटेसी'} },
    { id:'sports', label:{en:'🤼 Sports', hi:'🤼 खेल'} }
  ];

  return `
    <button class="back" onclick="go('map')">← ${t('back')}</button>
    <div class="display" style="font-size:24px;margin:4px 0 2px;">
      📺 ${S.lang==='hi'?'बाल चित्रशाला (कार्टून थियेटर)':'Kids Cartoon Theater'}
    </div>
    <div class="muted">${S.lang==='hi' ? `एनिमे, फ़िल्में, लोक कथाएँ और खेल पर आधारित कार्टून` : `Animated cartoons starring Anime, Movies, Folk Tales, and Games`}</div>

    <!-- Theme Filter Deck -->
    <div class="theme-deck theme-filter-row">
      ${themePills.map(tp => `
        <button class="theme-pill ${currentTheme === tp.id ? 'active' : ''}" onclick="S.activeThemeFilter='${tp.id}';render();">
          ${L(tp.label)}
        </button>
      `).join('')}
    </div>

    <!-- Recommendation Hero Video -->
    ${recommended ? `
      <div class="hero-video-card glass-card" style="background:linear-gradient(135deg, rgba(76,123,224,0.35), rgba(197,96,58,0.35));border:2px solid var(--marigold);border-radius:18px;padding:16px;margin:10px 0;">
        <div style="font-size:11.5px;font-family:var(--mono);text-transform:uppercase;letter-spacing:1.2px;color:var(--marigold);">⭐ ${S.lang==='hi'?'आपके लिए विशेष कार्टून':'Recommended For You'}</div>
        <div style="font-size:19px;font-weight:bold;margin:4px 0;font-family:'Baloo 2',cursive;">${L(recommended.title)}</div>
        <div style="font-size:13px;opacity:0.9;margin-bottom:8px;">${recommended.recommendationReason ? L(recommended.recommendationReason) : ''}</div>
        <button class="btn-3d" style="width:100%;margin-top:6px;" onclick="startCartoonVideo('${recommended.id}', '${recommended.skillId}', '${recommended.gameId}')">
          ▶ ${S.lang==='hi'?'कार्टून देखें':'Play Cartoon'}
        </button>
      </div>
    ` : ''}

    <!-- Series Showcase -->
    <div style="font-weight:bold;font-size:17px;margin:16px 0 8px;font-family:'Baloo 2',cursive;">🍿 ${S.lang==='hi'?'कार्टून सीरीज़':'Popular Cartoon Series'}</div>
    <div class="row" style="gap:10px;overflow-x:auto;padding-bottom:8px;">
      <div class="series-card glass-card" style="min-width:140px;border-color:var(--rani);text-align:center;padding:12px 10px;">
        <div style="font-size:36px">⚔️</div>
        <div style="font-size:13.5px;font-weight:bold;margin-top:4px;font-family:'Baloo 2';">${S.lang==='hi'?'एनिमे पॉवर-अप':'Anime Power-Up'}</div>
        <button class="btn-3d rani" style="font-size:12px;padding:6px 12px;margin-top:8px;width:100%;" onclick="startCartoonVideo('series-anime', 'carry', 'anime')">▶ Ep 1</button>
      </div>
      <div class="series-card glass-card" style="min-width:140px;border-color:var(--marigold);text-align:center;padding:12px 10px;">
        <div style="font-size:36px">🎬</div>
        <div style="font-size:13.5px;font-weight:bold;margin-top:4px;font-family:'Baloo 2';">${S.lang==='hi'?'सिनेमा एडवेंचर':'Cinema Saga'}</div>
        <button class="btn-3d" style="font-size:12px;padding:6px 12px;margin-top:8px;width:100%;" onclick="startCartoonVideo('series-cinema', 'add2', 'cinema')">▶ Ep 1</button>
      </div>
      <div class="series-card glass-card" style="min-width:140px;border-color:var(--leaf);text-align:center;padding:12px 10px;">
        <div style="font-size:36px">📜</div>
        <div style="font-size:13.5px;font-weight:bold;margin-top:4px;font-family:'Baloo 2';">${S.lang==='hi'?'पंचतंत्र कथाएँ':'Panchatantra'}</div>
        <button class="btn-3d leaf" style="font-size:12px;padding:6px 12px;margin-top:8px;width:100%;" onclick="startCartoonVideo('series-folktale', 'frac', 'folktale')">▶ Ep 1</button>
      </div>
    </div>

    <!-- Infinite Video Catalog Grid -->
    <div style="font-weight:bold;font-size:17px;margin:18px 0 8px;font-family:'Baloo 2',cursive;">🎬 ${S.lang==='hi'?'वीडियो लाइब्रेरी':'Infinite Video Catalog'}</div>
    <div class="video-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${catalog.map(v => `
        <div class="video-card glass-card" style="padding:12px;text-align:center;">
          <div style="font-size:32px;margin-bottom:4px;">${v.thumbnail || '🎬'}</div>
          <div style="font-size:13.5px;font-weight:bold;font-family:'Baloo 2';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${L(v.title)}</div>
          <button class="btn-3d indigo" style="font-size:12px;width:100%;margin-top:8px;padding:7px 10px;" onclick="startCartoonVideo('${v.id}', '${v.skillId}', '${v.gameId}')">
            ▶ Play
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

