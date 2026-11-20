/* ==================================================================
   WATCH — Munni's videos (content/videos.js), 21 Nov 2026.

   One player, two forms of the same video:
     · filmed: a clip listed in video/clips.json for this language — a
       teacher with real sticks and a slate, filmed from video/SCRIPTS.md.
       It stops at each pause second the team wrote down, asks, waits.
     · animated: everything else — the script's scenes drawn on screen
       with the lesson player's own pictures and narrated by Munni, the
       same questions at the same moments.
   A filmed clip that can't play (offline and never watched) carries on
   as the animated version from the same question.

   Every pause's first tap is the child's own answer: real evidence for
   the video's skill (noteSkillAttempt → the twin and the mind), kept in
   S.videos. A wrong tap is shown kindly ("This one…"), never "wrong".
   A video ends on its own end screen, never rolling into another; no
   timers or limits (how long a child watches is the parent's call).
   ================================================================== */
let VID_CLIPS = null, VID_CLIPS_P = null, VID_RUN = 0;
/* The filmed clip's <video> lives outside render(): a screen drawn again
   (the question appearing, an answer marked) moves the same element into
   the new slot instead of starting a fresh one from 0:00 (AFTER.watch). */
let VID_EL = null;

/* video/clips.json: { clips: { <video id>: { <lang>: { src, pauses:[seconds…] } } } }.
   Loaded when a video list or a video opens, never at boot. */
function vidLoadClips(){
  if(VID_CLIPS) return Promise.resolve(VID_CLIPS);
  if(!VID_CLIPS_P){
    let f; try{ f = fetch('video/clips.json'); }catch(e){ f = Promise.reject(e); }   // no fetch at all: animated only
    VID_CLIPS_P = f.then(r => r.ok ? r.json() : {}).catch(() => ({})).then(d => (VID_CLIPS = (d && d.clips) || {}));
  }
  return VID_CLIPS_P;
}
/* A filmed clip for this video in this language, with one pause second per question. */
function vidFilm(v, lang){
  const c = VID_CLIPS && VID_CLIPS[v.id] && VID_CLIPS[v.id][lang];
  if(!c || typeof c.src !== 'string' || !/^video\/[\w.-]+\.(mp4|webm)$/.test(c.src)) return null;
  const n = videoPauses(v).length;
  if(!Array.isArray(c.pauses) || c.pauses.length !== n || c.pauses.some((t, i) => !(t > 0) || (i && t <= c.pauses[i - 1]))) return null;
  return c;
}
const vidLang = () => S.lang === 'hi' ? 'hi' : 'en';
const VX = o => o ? (o[vidLang()] || o.en) : '';
function vidRec(){ return S.videos || (S.videos = { n: {}, day: {}, log: [] }); }

/* ---------- the shelf (the Picture Hut, and UKG's home) ---------- */
function watchShelfHTML(){
  let list = [];
  try{ list = videosFor(band().cls); }catch(e){}
  if(!list.length) return '';
  vidLoadClips();
  const rec = vidRec(), hi = S.lang === 'hi';
  return `
    <div class="theater-h">🎬 ${hi ? 'मुन्नी के वीडियो' : "Munni's videos"}</div>
    <div class="video-grid">
      ${list.map(v => `
        <button class="watch-card glass-card" onclick="watchStart('${v.id}')">
          <span class="wc-thumb">${v.ic}</span>
          <span class="vc-title">${VX(v.title)}</span>
          ${rec.day[v.id] ? '<span class="vc-earned">⭐</span>' : ''}
        </button>`).join('')}
    </div>`;
}

/* ---------- the player ---------- */
function watchAlive(run){ return S.screen === 'watch' && S.ctx && S.ctx.run === run; }

async function watchStart(id){
  const v = videoById(id); if(!v) return;
  if(VID_EL){ VID_EL.pause(); VID_EL = null; }
  if(typeof trumpet === 'function') trumpet(1);
  go('watch');
  const run = S.ctx.run = ++VID_RUN;
  S.ctx.v = v; S.ctx.i = 0; S.ctx.q = 0; S.ctx.phase = 'say'; S.ctx.picked = null;
  await vidLoadClips();
  if(!watchAlive(run)) return;
  const film = vidFilm(v, vidLang());
  S.ctx.mode = film ? 'film' : 'anim';
  log(0, `Video "${v.title.en}" · ${S.ctx.mode === 'film' ? 'filmed clip ' + film.src : 'animated'} · skill ${v.skill}`);
  render();
  if(film) watchFilm(run, film); else watchAnim(run, 0);
}

/* Munni says a line; resolves when she has, or after a fair time (a silent
   voice never stalls the video), never before the picture has been seen. */
function watchSay(text){
  const words = String(text).split(/\s+/).length;
  return Promise.all([
    new Promise(res => { let d = false; const fin = () => { if(!d){ d = true; res(); } };
      setTimeout(fin, 1500 + words * 650 + 2000); try{ speak(text, null, fin); }catch(e){ fin(); } }),
    new Promise(r => setTimeout(r, S.muted ? 1400 + words * 240 : 500))
  ]);
}

/* The animated form: scene by scene, from scene k. */
async function watchAnim(run, k){
  const v = S.ctx.v;
  S.ctx.mode = 'anim';
  for(S.ctx.i = k; watchAlive(run) && S.ctx.i < v.scenes.length; S.ctx.i++){
    const sc = v.scenes[S.ctx.i];
    S.ctx.phase = 'say'; S.ctx.picked = null; render();
    await watchSay(VX(sc.say));
    if(!watchAlive(run)) return;
    if(sc.pause){ await watchAsk(run, sc.pause); if(!watchAlive(run)) return; }
    else await new Promise(r => setTimeout(r, 400));
  }
  if(watchAlive(run)) watchEnd();
}

/* The filmed form: play, stop at each pause second, ask, carry on. */
function watchFilm(run, film){
  const el = VID_EL = document.createElement('video');
  el.id = 'vidfilm'; el.src = film.src; el.preload = 'auto'; el.playsInline = true; el.setAttribute('playsinline', '');
  watchSlot();
  const pauses = videoPauses(S.ctx.v);
  let busy = false;
  const fallBack = () => {
    if(!watchAlive(run) || S.ctx.mode !== 'film') return;
    log(null, 'Video clip could not play · carrying on with the animated video');
    if(VID_EL === el){ el.onerror = el.ontimeupdate = el.onended = null; VID_EL = null; }
    // from the first question not yet answered (its scene says its line, then asks)
    const k = S.ctx.v.scenes.map((s, i) => s.pause ? i : -1).filter(i => i >= 0)[S.ctx.q];
    watchAnim(run, k == null ? S.ctx.v.scenes.length : k);
  };
  el.onerror = fallBack;
  el.ontimeupdate = async () => {
    if(busy || !watchAlive(run) || S.ctx.q >= pauses.length || el.currentTime < film.pauses[S.ctx.q]) return;
    busy = true; el.pause();
    await watchAsk(run, pauses[S.ctx.q]);
    busy = false;
    if(watchAlive(run)){ S.ctx.phase = 'say'; render(); el.play().catch(fallBack); }
  };
  el.onended = () => { if(watchAlive(run) && !busy) watchEnd(); };
  el.play().catch(() => { S.ctx.tapToPlay = true; render(); });   // a phone that wants a tap first
}
function watchPlayTap(){
  S.ctx.tapToPlay = false;
  if(VID_EL) VID_EL.play().catch(() => {});
  render();
}
function watchSlot(){
  const slot = document.getElementById('vidslot');
  if(slot && VID_EL && S.ctx && S.ctx.mode === 'film') slot.insertBefore(VID_EL, slot.firstChild);
}

/* A pause: the question, two big answers, the first tap is evidence. */
function watchAsk(run, p){
  return new Promise(async res => {
    S.ctx.phase = 'pause'; S.ctx.picked = null; S.ctx._askDone = res; S.ctx.pause = p;
    render();
    await watchSay(VX(p.q));
    // a child who wandered off hears the question once more; then the video waits for them
    setTimeout(() => { if(watchAlive(run) && S.ctx.phase === 'pause' && S.ctx.picked == null) speak(VX(p.q)); }, 15000);
  });
}
async function watchChoose(k){
  if(S.ctx.phase !== 'pause' || S.ctx.picked != null) return;
  const run = S.ctx.run, v = S.ctx.v, p = S.ctx.pause, ok = k === p.right;
  S.ctx.picked = k;
  noteSkillAttempt(v.skill, ok);
  const rec = vidRec();
  rec.log.push({ v: v.id, skill: v.skill, q: S.ctx.q, ok, at: Date.now() }); if(rec.log.length > 40) rec.log.splice(0, rec.log.length - 40);
  log(0, `Video pause ${S.ctx.q + 1} · ${v.skill} · ${ok ? 'right' : 'not yet'} · first tap, counted as evidence`);
  saveSoon();
  render();
  if(ok){ if(typeof trumpet === 'function') trumpet(1); }
  await watchSay(VX(ok ? p.praise : p.show));
  if(!watchAlive(run)) return;
  S.ctx.q++;
  const done = S.ctx._askDone; S.ctx._askDone = null; if(done) done();
}

function watchEnd(){
  const v = S.ctx.v, rec = vidRec(), today = dayKey();
  const first = rec.day[v.id] !== today;
  rec.n[v.id] = (rec.n[v.id] || 0) + 1; rec.day[v.id] = today;
  if(first){ S.stars++; log(0, 'Video finished · first time today · star added'); }   // stars only grow
  saveSoon();
  S.ctx.phase = 'end'; render();
  if(typeof triggerConfetti === 'function') triggerConfetti(1400);
  speak(S.lang === 'hi' ? 'शाबाश! वीडियो पूरा हुआ।' : 'Well done! That is the end of the video.');
}
function watchAgain(){ watchStart(S.ctx.v.id); }
function watchLeave(){ go(S.home === 'simple' || (typeof simpleHomeOn === 'function' && simpleHomeOn() && !S._fullMap) ? 'stories' : 'theater'); }
function watchRepeat(){
  const v = S.ctx.v; if(!v) return;
  if(S.ctx.phase === 'pause') speak(VX(S.ctx.pause.q));
  else if(S.ctx.mode === 'anim' && v.scenes[S.ctx.i]) speak(VX(v.scenes[S.ctx.i].say));
}

/* ---------- drawing ---------- */
function vidColumn(a){
  const A = String(a.a).padStart(2, ' '), B = String(a.b).padStart(2, ' ');
  const sum = a.op === '+' ? a.a + a.b : a.a - a.b, R = String(sum).padStart(2, ' ');
  const carry = a.op === '+' && (a.mark === 'carry' || a.mark === 'done');
  const borrowed = a.op !== '+' && (a.mark === 'borrow' || a.mark === 'done');
  // the answer row: all of it at the end; after carrying, the ones digit just written
  const res = a.mark === 'done' ? R : carry ? ' ' + R[1] : '  ';
  const cell = (ch, cls) => `<span class="vc-d ${cls || ''}">${ch === ' ' ? '&nbsp;' : ch}</span>`;
  const top = borrowed
    ? `${cell(A[0], 'vc-struck')}${cell(A[1], 'vc-struck')}`
    : `${cell(A[0])}${cell(A[1], a.mark === 'ones' ? 'vc-hot' : '')}`;
  return `<div class="vcol">
    <div class="vc-row vc-small">${cell(' ')}${cell(carry ? '1' : borrowed ? String(Number(A[0]) - 1) : ' ', 'vc-carry')}${cell(borrowed ? '1' + A[1] : ' ', 'vc-carry')}</div>
    <div class="vc-row">${cell(' ')}${top}</div>
    <div class="vc-row">${cell(a.op)}${cell(B[0])}${cell(B[1], a.mark === 'ones' ? 'vc-hot' : '')}</div>
    <div class="vc-line"></div>
    <div class="vc-row">${cell(' ')}${cell(res[0])}${cell(res[1] || ' ', a.mark === 'carry' ? 'vc-hot' : '')}</div>
  </div>`;
}
function vidArt(art, obj){
  if(!art) return '';
  if(art.t === 'column') return vidColumn(art);
  if(art.t === 'letters') return `<div class="vid-letters">${art.text}</div>`;
  try{ return lesArt(art, obj); }catch(e){ return ''; }
}

function watchHTML(){
  const v = S.ctx.v, hi = S.lang === 'hi';
  if(!v) return `<button class="back" onclick="go('theater')">← ${t('back')}</button>`;
  const top = `<div class="st-top">
      <button class="st-ibtn" onclick="watchLeave()" aria-label="${hi ? 'वापस' : 'Back'}">←</button>
      <span class="watch-title">${v.ic} ${VX(v.title)}</span>
      <button class="st-ibtn" onclick="watchRepeat()" aria-label="${hi ? 'फिर से सुनो' : 'Hear it again'}">🔊</button>
    </div>`;
  if(S.ctx.phase === 'end') return `${top}
    <div class="st-endcard">
      <div class="st-end-ic">${v.ic}⭐</div>
      <div class="st-end-t">${hi ? 'वीडियो पूरा!' : 'The end!'}</div>
      <div class="st-row two">
        <button class="st-card" onclick="watchAgain()"><span class="st-card-ic">🔁</span><span class="st-card-t">${hi ? 'फिर से देखो' : 'Watch again'}</span></button>
        <button class="st-card" onclick="watchLeave()"><span class="st-card-ic">🏠</span><span class="st-card-t">${hi ? 'वापस' : 'Back'}</span></button>
      </div>
      <div class="st-grown"><b>👪 ${hi ? 'बड़ों के लिए' : 'For the grown-up'}</b><div>${VX(v.grownup)}</div><div style="margin-top:6px">${VX(v.home)}</div></div>
    </div>`;
  const p = S.ctx.phase === 'pause' ? S.ctx.pause : null;
  const sc = v.scenes[Math.min(S.ctx.i, v.scenes.length - 1)];
  const film = S.ctx.mode === 'film' ? vidFilm(v, vidLang()) : null;
  const stage = film
    ? `<div class="watch-film" id="vidslot">${S.ctx.tapToPlay ? `<button class="watch-play" onclick="watchPlayTap()" aria-label="${hi ? 'चलाओ' : 'Play'}">▶</button>` : ''}</div>`
    : `<div class="watch-stage"><div class="lesart">${vidArt(sc.art, v.obj)}</div><span class="st-munni-sm">${munniSmall()}</span></div>`;
  return `${top}
    ${stage}
    ${p ? `<div class="watch-q">${VX(p.q)}</div>
      <div class="opts watch-opts">${p.opts.map((o, k) => `<button class="opt ${S.ctx.picked != null && k === p.right ? 'right' : S.ctx.picked === k ? 'wrong' : ''}" onclick="watchChoose(${k})">${VX(o)}</button>`).join('')}</div>`
      : film ? '' : `<div class="st-cap">${VX(sc.say)}</div>`}
    <div class="st-grown small">👪 ${VX(v.grownup)}</div>`;
}

if(typeof VIEWS !== 'undefined') VIEWS.watch = watchHTML;
if(typeof AFTER !== 'undefined') AFTER.watch = watchSlot;
