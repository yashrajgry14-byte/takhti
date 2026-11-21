/* ==================================================================
   STORY TIME — the home and the story player for the youngest.

   Who sees what (decided 20 Nov 2026, see content/stories.js):
     Nursery, LKG (3–4)  "story" stage: a simple home with no map —
                         Munni's story of the day as one big picture,
                         three more stories, finger tracing. Nothing to
                         read, nothing to find.
     UKG (5)             "guided" stage: the same home plus Munni's pick
                         (the activity she would point at on the map) and
                         one other choice, as big pictures; the full map
                         is one tap away.
     Class 1+            the jungle map, as before.
   A parent can switch the simple home on or off for any child on the
   dashboard (S.home: 'simple' | 'map' | null = by class). There are no
   timers or usage limits: how long a child plays is the parent's call.

   The player (VIEWS.story) narrates each scene with Munni's voice and
   moves on by itself; it stops only for the moments the child joins in
   (tap to count, pick one of two, say it aloud — see stories.js). A pick
   is real evidence for the story's skill, through noteSkillAttempt() (the
   twin and the mind), so even a three-year-old's stories teach Takhti how
   that child is doing. A finished story waits on its end screen — it
   does not roll into the next one by itself.
   ================================================================== */

const SIMPLE_HOME_CLASSES = ['nur', 'lkg', 'ukg'];

/* Is this child's home the simple one (stories) rather than the map? */
function simpleHomeOn(){
  if(S.home === 'map') return false;
  if(S.home === 'simple') return true;
  return SIMPLE_HOME_CLASSES.includes(band().cls);
}
/* 'story' (Nursery–LKG: stories, finger tracing) or 'guided' (UKG, or any
   child whose parent turned the simple home on: stories + Munni's pick). */
function storyStage(){ return band().id === 'pre' ? 'story' : 'guided'; }

function storyRec(){
  if(!S.stories || typeof S.stories !== 'object') S.stories = { n:{}, day:{}, log:[] };
  S.stories.n = S.stories.n || {}; S.stories.day = S.stories.day || {}; S.stories.log = S.stories.log || [];
  return S.stories;
}

/* The class whose stories this child gets: their own if it has stories,
   else the nearest (a child moved into the simple home from Class 1 gets
   UKG's). */
function storyCls(){ const c = band().cls; return storyTplsFor(c).length ? c : 'ukg'; }
/* The stories this child can be offered: their class's own (only those in
   their language — व्यंजन is a Hindi story), and for Class 1–2 on the
   simple home UKG's as well, since Class 1–2 have only the read-along. */
function storyList(){
  const cls = storyCls(), lang = S.lang === 'hi' ? 'hi' : 'en';
  const own = storyTplsFor(cls, lang);
  return ['c1', 'c2', 'c3'].includes(cls) ? own.concat(storyTplsFor('ukg', lang).filter(id => !own.includes(id))) : own;
}

/* Today's stories, best first. Munni's pick is the one whose skill this
   child has shown least (fewest answers, then lowest share right), and a
   story already finished today goes to the back; the day's seed breaks
   ties, so the order is the same all day and different tomorrow. */
function storyOrder(){
  const rec = storyRec(), cls = storyCls(), today = dayKey();
  const o = { cls, lang: S.lang === 'hi' ? 'hi' : 'en' };
  const ownRe = { nur:/^n-/, lkg:/^l-/, ukg:/^u-/, c1:/^[eh]1-/, c2:/^[eh]2-/ }[cls];
  return storyList().map(id => {
    const skill = STORY_TPLS[id].skill(o);
    const h = (S.skillHistory || {})[skill] || { n:0, right:0 };
    const share = h.n ? h.right / h.n : 0;
    // between two stories shown as little, this class's own skill comes before a class below's (UKG: u- before l-)
    const own = ownRe && ownRe.test(skill) ? 0 : 1;
    return { id, done: rec.day[id] === today, n: h.n, share, own, tie: seedOf(today + '|' + id + '|' + (S.id || '')) };
  }).sort((a, b) => (a.done - b.done) || (a.n - b.n) || (a.share - b.share) || (a.own - b.own) || (a.tie - b.tie)).map(x => x.id);
}

/* The story a template gives this child now: a new one each time the
   last was finished (the play count is in the seed). */
function storyMake(tplId, seed){
  const rec = storyRec();
  const s = seed != null ? seed : seedOf((S.id || 'x') + '|story|' + tplId + '|' + (rec.n[tplId] || 0));
  return storyBuild(tplId, s, { cls: storyCls(), lang: S.lang === 'hi' ? 'hi' : 'en', name: S.name || '' });
}

const L2 = (en, hi) => S.lang === 'hi' ? hi : en;
const TX = o => o ? (S.lang === 'hi' ? o.hi : o.en) : '';

/* ---------- the simple home ---------- */
function storyHomeLine(){
  const n = S.name || '';
  return storyStage() === 'story'
    ? L2(`Hello ${n}! Shall we have a story? Tap the big picture!`, `नमस्ते ${n}! कहानी सुनें? बड़ी तस्वीर को छुओ!`)
    : L2(`Hello ${n}! Tap a picture — a story, or what Munni picked for you.`, `नमस्ते ${n}! किसी तस्वीर को छुओ — कहानी, या जो मुन्नी ने तुम्हारे लिए चुना।`);
}

function storyCardHTML(id, hero){
  const T = STORY_TPLS[id], done = storyRec().day[id] === dayKey();
  return `<button class="st-card ${hero ? 'hero' : ''}" onclick="storyStart('${id}')" aria-label="${attr(TX(T.title))}">
    <span class="st-card-ic">${T.ic}</span>
    <span class="st-card-t">${TX(T.title)}</span>
    ${hero ? '<span class="st-play">▶</span>' : ''}${done ? '<span class="st-done">⭐</span>' : ''}
  </button>`;
}

/* Munni's videos for this class (UKG: the मात्रा), as big pictures too. */
function storyVideosHTML(){
  const vids = typeof videosFor === 'function' ? videosFor(storyCls()) : [];
  return vids.length ? `<div class="st-row">${vids.map(v => `<button class="st-card place" onclick="watchStart('${v.id}')" aria-label="${attr(TX(v.title))}">
      <span class="st-card-ic">🎬</span><span class="st-card-t">${TX(v.title)}</span>${(S.videos && S.videos.day[v.id] === dayKey()) ? '<span class="st-done">⭐</span>' : ''}</button>`).join('')}</div>` : '';
}

function storyHomeHTML(){
  const order = storyOrder(), guided = storyStage() === 'guided';
  const line = storyHomeLine();
  let picks = '';
  if(guided){
    const spot = typeof mapSuggestion === 'function' ? mapSuggestion() : null;
    const places = mapVisible().filter(p => p.screen !== 'ask');
    const first = (spot && spot.place && places.find(p => p.id === spot.place.id)) || places[0];
    const other = places.filter(p => p !== first)[seedOf(dayKey() + '|other|' + (S.id || '')) % Math.max(1, places.length - 1)];
    const card = (p, mine) => p ? `<button class="st-card place ${mine ? 'mine' : ''}" onclick="mapGo('${p.screen}')">
        <span class="st-card-ic">${p.ic}</span><span class="st-card-t">${TX(p)}</span>
        ${mine ? `<span class="st-pick">${L2("Munni's pick", 'मुन्नी की पसंद')}</span>` : ''}</button>` : '';
    picks = `<div class="st-row two">${card(first, true)}${card(other, false)}</div>`;
  }
  const trace = !guided && moduleAllowed('write')
    ? `<button class="st-card place" onclick="mapGo('write')"><span class="st-card-ic">🖐️</span><span class="st-card-t">${L2('Draw with your finger', 'उँगली से बनाओ')}</span></button>` : '';
  return `
  ${topGamifyBar()}
  ${profileSwitcher()}
  <div class="st-home">
    <button class="st-munni" data-say="${attr(line)}" onclick="storyTapMunni(this)" aria-label="${attr(line)}">
      ${munniSmall()}<span class="st-bubble">${line}</span>
    </button>
    ${picks}
    ${storyCardHTML(order[0], true)}
    <div class="st-row">${order.slice(1, 4).map(id => storyCardHTML(id, false)).join('')}${trace}</div>
    ${storyVideosHTML()}
  </div>
  <div class="jm-foot">
    ${guided ? `<button class="btn ghost" style="width:100%;margin-bottom:8px" onclick="storyFullMap()">🗺️ ${L2('All places', 'सारी जगहें')}</button>` : ''}
    <button class="btn ghost" style="width:100%" onclick="go('parentlock')">${t('parent')} →</button>
  </div>`;
}

function storyTapMunni(el){ trumpet(1); speak(el.dataset.say); }
/* The jungle map, for a guided child who wants it (S._fullMap lasts until
   they come back to Munni's home). */
function storyFullMap(){ S._fullMap = true; go('map'); }
/* Back from a story: Munni's home for a simple-home child, else where the
   story was opened (the Picture Hut's or the Reading Tree's read-along). */
let STORY_FROM = null;
function storyHome(){
  S._fullMap = false;
  go(simpleHomeOn() || !STORY_FROM ? 'stories' : STORY_FROM);
}

function storyHomeArrive(){
  // a three-year-old can't read the bubble: Munni says it, once per arrival
  setTimeout(() => { if(S.screen === 'stories'){ const m = document.querySelector('.st-munni'); if(m) speak(m.dataset.say); } }, 350);
}

/* ---------- the player ---------- */
let STORY_RUN = 0;
function storyAlive(run){ return S.screen === 'story' && S.ctx && S.ctx.run === run; }

function storyStart(tplId, seed){
  trumpet(1);
  const st = storyMake(tplId, seed);
  if(!st) return;
  if(S.screen !== 'story') STORY_FROM = ['stories', 'map'].includes(S.screen) ? null : S.screen;
  go('story');
  S.ctx.st = st; S.ctx.i = 0; S.ctx.run = ++STORY_RUN;
  log(0, `Story "${st.title.en}" (${st.tpl}, seed ${st.seed}) · skill ${st.skill} · ${band().clsEn}`);
  render();
  storyRun(S.ctx.run);
}

/* Munni says a line; resolves when she has finished (or after a fair
   time, so a voice that never ends can't stall the story) — and never
   before the picture has had time to be looked at: with the sound off,
   speak() finishes at once, and a scene must not flash past. */
function storySay(text){
  const words = String(text).split(/\s+/).length;
  storyTalking(true);
  return Promise.all([
    new Promise(res => {
      let done = false; const fin = () => { if(!done){ done = true; res(); } };
      setTimeout(fin, 1200 + words * 650 + 2000);
      try{ speak(text, null, fin); }catch(e){ fin(); }
    }),
    storyWait(S.muted ? 1600 + words * 260 : 600)
  ]).then(() => storyTalking(false));
}
/* Munni's mouth moves while she talks (the class is redrawn from S.ctx, so
   a redraw mid-line keeps it). */
function storyTalking(on){
  if(!S.ctx) return;
  S.ctx.talking = on;
  const m = document.querySelector('.st-munni-sm'); if(m) m.classList.toggle('talking', !!on);
}
const storyWait = ms => new Promise(r => setTimeout(r, ms));

async function storyRun(run){
  const st = S.ctx.st;
  while(storyAlive(run) && S.ctx.i < st.scenes.length){
    const sc = st.scenes[S.ctx.i];
    S.ctx.phase = 'say'; S.ctx.counted = 0; S.ctx.picked = null;
    storyRender();
    // a read-along line lights up word by word as Munni reads it
    if(sc.stage && sc.stage.line && sc.stage.line === sc.say) await storyKaraoke(run, TX(sc.say));
    else await storySay(TX(sc.say));
    if(!storyAlive(run)) return;
    if(sc.join){
      S.ctx.phase = sc.join.t; storyRender();
      if(sc.join.t === 'count') await storyCount(run, sc.join);
      else if(sc.join.t === 'pick') await storyPickWait(run, sc.join);
      else if(sc.join.t === 'say') await storySayBack(run, sc.join);
      else if(sc.join.t === 'read') await storyReadAlong(run, sc.join);
      if(!storyAlive(run)) return;
    } else await storyWait(500);
    S.ctx.i++;
  }
  if(storyAlive(run)) storyEnd();
}

/* One scene into the next, like a cartoon rather than a slideshow: what
   stays on the stage glides to its new place instead of popping in again
   (same id from scene to scene), what leaves fades away, and only what is
   new pops in. With reduced motion asked for, it is a plain redraw. */
function storyRender(){
  const before = document.getElementById('ststage'), old = {};
  if(before) before.querySelectorAll('.st-it[id]').forEach(el => { old[el.id] = { l: el.style.left, t: el.style.top, html: el.outerHTML }; });
  render();
  const now = document.getElementById('ststage');
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!before || !now || still) return;
  now.querySelectorAll('.st-it[id]').forEach(el => {
    const o = old[el.id]; if(!o) return;
    delete old[el.id];
    el.classList.add('st-keep');
    if(o.l !== el.style.left || o.t !== el.style.top){
      const l = el.style.left, t = el.style.top;
      el.style.transition = 'none'; el.style.left = o.l; el.style.top = o.t;
      void el.offsetWidth;
      el.style.transition = ''; el.style.left = l; el.style.top = t;
    }
  });
  Object.keys(old).forEach(id => {
    const tmp = document.createElement('div'); tmp.innerHTML = old[id].html;
    const g = tmp.firstElementChild; if(!g) return;
    g.removeAttribute('id'); g.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    g.classList.add('st-leave'); g.setAttribute('aria-hidden', 'true');
    now.appendChild(g); setTimeout(() => g.remove(), 700);
  });
}

/* The words light up one by one as Munni reads the line, all of them once
   she has finished — a guide for the eye, not a timing the voice promises. */
async function storyKaraoke(run, text){
  const els = [...document.querySelectorAll('#ststage .stw')];
  const per = Math.round((S.muted ? 520 : 430) / Math.max(0.6, band().speechRate || 1));
  let k = 0;
  const show = () => els.forEach((e, i) => { e.classList.toggle('lit', i < k); e.classList.toggle('now', i === k); });
  show();
  const timer = setInterval(() => { if(storyAlive(run) && k < els.length - 1){ k++; show(); } }, per);
  await storySay(text);
  clearInterval(timer);
  if(storyAlive(run)) els.forEach(e => { e.classList.add('lit'); e.classList.remove('now'); });
}

/* The child's turn to read: the words light up at a reading pace, a finger
   to follow. Nothing is listened to or recorded — it is practice. */
async function storyReadAlong(run, j){
  const els = [...document.querySelectorAll('#ststage .stw')];
  for(let k = 0; k < els.length; k++){
    if(!storyAlive(run)) return;
    els.forEach((e, i) => { e.classList.toggle('lit', i < k); e.classList.toggle('now', i === k); });
    await storyWait(j.pace || 700);
  }
  if(!storyAlive(run)) return;
  els.forEach(e => { e.classList.add('lit'); e.classList.remove('now'); });
  await storySay(L2('Lovely reading!', 'बहुत अच्छा पढ़ा!'));
}

/* Tap to count: every tap anywhere on the picture moves the next thing
   and Munni says its number. A child who stops is nudged once, then
   Munni counts the rest herself — the story never waits forever. */
function storyCount(run, j){
  return new Promise(res => {
    S.ctx._countDone = res; S.ctx._countJ = j;
    let last = Date.now(), nudged = false, auto = false;
    const tick = setInterval(() => {
      if(!storyAlive(run) || S.ctx.counted >= j.n){ clearInterval(tick); return; }
      const idle = Date.now() - last;
      if(!nudged && idle > 7000){ nudged = true; speak(L2('Tap anywhere on the picture!', 'तस्वीर पर कहीं भी छुओ!')); }
      else if(nudged && !auto && idle > 15000){ auto = true; speak(L2("Let's count together!", 'चलो साथ में गिनें!')); }
      else if(auto && idle > 16200){ last = Date.now() - 15000; storyCountStep(); }
    }, 400);
    S.ctx._countTouch = () => { last = Date.now(); };
  });
}
function storyTap(){
  if(S.ctx.phase !== 'count') return;
  if(S.ctx._countTouch) S.ctx._countTouch();
  storyCountStep();
}
function storyCountStep(){
  const j = S.ctx._countJ; if(!j || S.ctx.counted >= j.n) return;
  const k = S.ctx.counted, el = document.getElementById('sti-' + j.seq[k]);
  if(el){ el.style.left = j.to[k].x + '%'; el.style.top = j.to[k].y + '%'; el.classList.add('st-fell');
          el.insertAdjacentHTML('beforeend', `<b class="st-num">${k + 1}</b>`); }
  S.ctx.counted = k + 1;
  if(typeof sfxChime === 'function') sfxChime();
  speak(NUMW[S.lang === 'hi' ? 'hi' : 'en'][k + 1]);
  if(S.ctx.counted >= j.n){ const done = S.ctx._countDone; S.ctx._countDone = null; setTimeout(() => done && done(), 1100); }
}

/* Pick one of two: the first tap is the child's own answer. */
function storyPickWait(run, j){
  return new Promise(res => {
    S.ctx._pickDone = res;
    // a child who wanders off hears the question once more, then the story waits for them
    setTimeout(() => { if(storyAlive(run) && S.ctx.phase === 'pick' && S.ctx.picked == null) speak(TX(S.ctx.st.scenes[S.ctx.i].say)); }, 14000);
  });
}
async function storyChoose(i){
  if(S.ctx.phase !== 'pick' || S.ctx.picked != null) return;
  const run = S.ctx.run, st = S.ctx.st, j = st.scenes[S.ctx.i].join, ok = i === j.right;
  S.ctx.picked = i;
  noteSkillAttempt(st.skill, ok);
  const rec = storyRec();
  rec.log.push({ tpl: st.tpl, skill: st.skill, ok, at: Date.now() }); if(rec.log.length > 40) rec.log.splice(0, rec.log.length - 40);
  log(0, `Story pick · ${st.skill} · ${ok ? 'right' : 'not yet'} · first tap, counted as evidence`);
  saveSoon();
  const opts = document.querySelectorAll('.st-opt');
  opts.forEach((b, k) => { b.classList.add(k === j.right ? 'st-right' : 'st-dim'); b.disabled = true; });
  if(ok){ trumpet(1); if(typeof triggerStarBurst === 'function') triggerStarBurst(14, opts[i]); }
  await storySay(TX(ok ? j.praise : j.show));
  if(!storyAlive(run)) return;
  await storyWait(400);
  const done = S.ctx._pickDone; S.ctx._pickDone = null; if(done) done();
}

/* Say it back: Munni says it slowly, the child says it — nothing is
   listened to or recorded. */
async function storySayBack(run, j){
  await storyWait(300);
  await storySay(TX(j.word));
  if(!storyAlive(run)) return;
  S.ctx.yourTurn = true; render();
  await storyWait(3800);
  if(!storyAlive(run)) return;
  S.ctx.yourTurn = false;
  await storySay(L2('Lovely!', 'बहुत बढ़िया!'));
}

function storyEnd(){
  const st = S.ctx.st, rec = storyRec(), today = dayKey();
  const first = rec.day[st.tpl] !== today;
  rec.n[st.tpl] = (rec.n[st.tpl] || 0) + 1;
  rec.day[st.tpl] = today;
  if(first){ S.stars++; log(0, `Story finished · first time today · star added`); }   // stars only ever grow
  saveSoon();
  S.ctx.phase = 'end'; render();
  trumpet(2);
  if(typeof triggerConfetti === 'function') triggerConfetti(1600);
  speak(L2(`The end! Well done, ${S.name || ''}.`, `कहानी ख़त्म! शाबाश, ${S.name || ''}।`));
}

function storyAgain(){ const st = S.ctx.st; storyStart(st.tpl, st.seed); }
function storyNext(){
  const st = S.ctx.st;
  // a read-along goes on to the next story of the bank; anything else to Munni's next pick
  if(st.tpl === 'readalong') return storyStart('readalong', readAlongSeed((st.read + 1) % STORY_READS.length));
  // a maths story goes on to the next maths story, a shape hunt to the next hunt
  if(st.tpl === 'solvealong') return storyStart('solvealong', mathStorySeed((st.sum.theme + 1) % STORY_SUMS.length));
  if(st.tpl === 'shapehunt') return storyStart('shapehunt', (storyRec().n.shapehunt || 0) + 1);
  if(st.tpl === 'money') return storyStart('money', (storyRec().n.money || 0) + 1);
  if(st.tpl === 'measure') return storyStart('measure', (storyRec().n.measure || 0) + 1);
  const o = storyOrder().filter(id => id !== st.tpl); storyStart(o[0] || st.tpl);
}
/* A read-along story's seed: which story (its place in the bank), and how
   many read-alongs were finished, so the right answer moves between plays. */
function readAlongSeed(i){ return i + STORY_READS.length * (storyRec().n.readalong || 0); }
function storyRepeat(){ const st = S.ctx.st; if(st && st.scenes[S.ctx.i]) speak(TX(st.scenes[S.ctx.i].say)); }

/* ---------- drawing ---------- */
function storyShapeSVG(shape, color, size){
  const s = size || 80;
  const inner = {
    circle:   `<circle cx="50" cy="50" r="42" fill="${color}"/>`,
    square:   `<rect x="12" y="12" width="76" height="76" rx="4" fill="${color}"/>`,
    triangle: `<polygon points="50,8 92,88 8,88" fill="${color}"/>`,
    balloon:  `<ellipse cx="50" cy="40" rx="30" ry="36" fill="${color}"/><polygon points="44,74 56,74 50,82" fill="${color}"/><path d="M50 82 C 44 90, 56 94, 50 100" stroke="#8a7a66" stroke-width="2" fill="none"/>`,
    flower:   `<g fill="${color}"><circle cx="50" cy="26" r="16"/><circle cx="74" cy="44" r="16"/><circle cx="65" cy="72" r="16"/><circle cx="35" cy="72" r="16"/><circle cx="26" cy="44" r="16"/></g><circle cx="50" cy="52" r="12" fill="#FFE27A"/>`
  }[shape] || '';
  return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" aria-hidden="true">${inner}</svg>`;
}
function storyItemHTML(it){
  const body = it.shape ? storyShapeSVG(it.shape, it.color, it.size) : it.ic;
  return `<span class="st-it ${it.anim ? 'a-' + it.anim : ''}" id="sti-${it.id}"
    style="left:${it.x}%;top:${it.y}%;font-size:${it.size || 44}px;animation-delay:${it.d || 0}s">${body}${it.num != null ? `<b class="st-tag">${it.num}</b>` : ''}${it.label ? `<small class="st-lbl">${it.label}</small>` : ''}</span>`;
}
/* A line (or lines) of words on the stage, each word its own span so it
   can light up; a sight word's own word is marked. */
function storyLinesHTML(stage){
  let n = 0;
  const strip = w => w.replace(/[।.,!?'"“”‘’]/g, '');
  const row = (text, hl) => text.split(/\s+/).filter(Boolean).map(w =>
    `<span class="stw${stage.lit ? ' lit' : ''}${hl && strip(w).toLowerCase() === hl.toLowerCase() ? ' hl' : ''}" id="stw-${n++}">${w}</span>`).join(' ');
  if(stage.line) return `<div class="st-line">${row(stage.line.text || TX(stage.line), stage.line.hl)}</div>`;
  return `<div class="st-lines">${stage.lines.map(l => `<div>${row(TX(l))}</div>`).join('')}</div>`;
}
function storyOptHTML(o, k){
  let body;
  if(o.group){
    const cols = o.n <= 4 ? 2 : 3;
    body = `<span class="st-group" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: o.n }, () => `<i>${o.ic}</i>`).join('')}</span>`;
  } else if(o.num != null) body = `<b class="st-numcard">${o.num}</b>`;
  else if(o.txt != null) body = `<b class="st-wordcard">${o.txt}</b>`;
  else body = o.shape ? storyShapeSVG(o.shape, o.color, o.size) : `<span style="font-size:${o.size || 80}px;line-height:1">${o.ic}</span>`;
  return `<button class="st-opt" onclick="event.stopPropagation();storyChoose(${k})">${body}${o.word ? `<small class="st-lbl">${o.word}</small>` : ''}</button>`;
}

function storyPlayerHTML(){
  const st = S.ctx.st;
  if(!st) return `<button class="back" onclick="storyHome()">← ${t('back')}</button>`;
  if(S.ctx.phase === 'end') return `
    <div class="st-top"><button class="st-ibtn" onclick="storyHome()" aria-label="${L2('Home', 'घर')}">🏠</button></div>
    <div class="st-endcard">
      <div class="st-end-ic">${st.ic}⭐</div>
      <div class="st-end-t">${L2('The end!', 'कहानी ख़त्म!')}</div>
      <div class="st-row two">
        <button class="st-card" onclick="storyAgain()"><span class="st-card-ic">🔁</span><span class="st-card-t">${L2('Again!', 'फिर से!')}</span></button>
        <button class="st-card" onclick="storyNext()"><span class="st-card-ic">▶️</span><span class="st-card-t">${L2('Another story', 'दूसरी कहानी')}</span></button>
      </div>
      <div class="st-grown"><b>👪 ${L2('For the grown-up', 'बड़ों के लिए')}</b><div>${TX(st.grownup)}</div><div style="margin-top:6px">${TX(st.home)}</div></div>
    </div>`;
  const sc = st.scenes[S.ctx.i] || st.scenes[st.scenes.length - 1];
  const j = sc.join, phase = S.ctx.phase;
  // a scene with no stage of its own keeps the last picture drawn
  let stage = sc.stage;
  for(let k = S.ctx.i; !stage && k >= 0; k--) stage = st.scenes[k].stage;
  stage = stage || { items: [] };
  const words = stage.line || stage.lines;
  const drawn = `${stage.big ? `<b class="st-big${String(stage.big).length > 3 ? ' wide' : ''}">${stage.big}</b>` : ''}${words ? storyLinesHTML(stage) : ''}${(stage.items || []).map(storyItemHTML).join('')}`;
  // a pick "with pictures" (join.keep) leaves the picture up, answers below it
  const inner = j && j.t === 'pick' && phase === 'pick'
    ? (j.keep ? `${drawn}<div class="st-opts low">${j.opts.map(storyOptHTML).join('')}</div>` : `<div class="st-opts">${j.opts.map(storyOptHTML).join('')}</div>`)
    : drawn;
  return `
  <div class="st-top">
    <button class="st-ibtn" onclick="storyHome()" aria-label="${L2('Home', 'घर')}">🏠</button>
    <span class="st-dots">${st.scenes.map((_, k) => `<i class="${k < S.ctx.i ? 'on' : k === S.ctx.i ? 'now' : ''}"></i>`).join('')}</span>
    <button class="st-ibtn" onclick="storyRepeat()" aria-label="${L2('Hear it again', 'फिर से सुनो')}">🔊</button>
  </div>
  <div class="st-stage bg-${st.bg || 'plain'} ${phase === 'count' ? 'tappable' : ''}" id="ststage" onclick="storyTap()" style="--drift:-${((Date.now() / 1000) % 40).toFixed(1)}s">
    ${inner}
    ${phase === 'count' ? `<span class="st-hint">👆 ${L2('Tap!', 'छुओ!')}</span>` : ''}
    ${S.ctx.yourTurn ? `<span class="st-turn">🗣️ ${L2('Your turn!', 'तुम्हारी बारी!')}</span>` : ''}
    <span class="st-munni-sm${S.ctx.talking ? ' talking' : ''}${S.ctx.i === 0 ? ' enter' : ''}">${munniSmall()}</span>
  </div>
  <div class="st-cap">${words && !(j && j.t === 'pick' && phase === 'pick') ? '' : TX(sc.say)}</div>
  <div class="st-grown small">👪 ${TX(st.grownup)}</div>`;
}

/* ---------- Class 1–2: the read-along shelf ---------- */
/* The Picture Hut's and the Reading Tree's shelf of read-along stories,
   for the classes that have them (Class 1–2). */
function readAlongShelfHTML(){
  if(!storyTplsFor(band().cls).includes('readalong')) return '';
  return `
    <div class="theater-h">📖 ${L2('Read along with Munni', 'मुन्नी के साथ पढ़ो')}</div>
    <div class="video-grid">
      ${STORY_READS.map((p, i) => `
        <button class="watch-card glass-card" onclick="storyStart('readalong',${readAlongSeed(i)})">
          <span class="wc-thumb">${p.ic}</span>
          <span class="vc-title">${TX(p.title)}</span>
        </button>`).join('')}
    </div>`;
}

/* ---------- Class 1–2: maths stories and the shape hunt ---------- */
/* A maths story's seed: its theme, then adding or taking away, which
   alternates with how many maths stories were finished (storySumOf). */
function mathStorySeed(theme){ return theme + STORY_SUMS.length * (storyRec().n.solvealong || 0); }
/* The Picture Hut's shelf of maths stories, and the shape hunt. */
function mathStoryShelfHTML(){
  const mine = storyTplsFor(band().cls), card = (tpl, ic) => `
      <button class="watch-card glass-card" onclick="storyStart('${tpl}',${storyRec().n[tpl] || 0})">
        <span class="wc-thumb">${ic}</span>
        <span class="vc-title">${TX(STORY_TPLS[tpl].title)}</span>
      </button>`;
  if(!mine.includes('solvealong')) return mine.includes('measure') ? `
    <div class="theater-h">🧮 ${L2('Maths stories with Munni', 'मुन्नी के साथ गणित की कहानियाँ')}</div>
    <div class="video-grid">${card('measure', '📏')}</div>` : '';
  return `
    <div class="theater-h">🧮 ${L2('Maths stories with Munni', 'मुन्नी के साथ गणित की कहानियाँ')}</div>
    <div class="video-grid">
      ${mine.includes('measure') ? card('measure', '📏') : ''}
      ${STORY_SUMS.map((th, i) => `
        <button class="watch-card glass-card" onclick="storyStart('solvealong',${mathStorySeed(i)})">
          <span class="wc-thumb">${th.ic}</span>
          <span class="vc-title">${TX(th.title)}</span>
        </button>`).join('')}
      <button class="watch-card glass-card" onclick="storyStart('money',${storyRec().n.money || 0})">
        <span class="wc-thumb">💰</span>
        <span class="vc-title">${TX(STORY_TPLS.money.title)}</span>
      </button>
      <button class="watch-card glass-card" onclick="storyStart('shapehunt',${storyRec().n.shapehunt || 0})">
        <span class="wc-thumb">🔺</span>
        <span class="vc-title">${TX(STORY_TPLS.shapehunt.title)}</span>
      </button>
    </div>`;
}
/* The Counting Stones' button: the next maths story. */
function mathStoryNext(){
  if(!storyTplsFor(band().cls).includes('solvealong')) return storyStart('measure', storyRec().n.measure || 0);   // Class 3: the ruler
  storyStart('solvealong', mathStorySeed((storyRec().n.solvealong || 0) % STORY_SUMS.length));
}

/* The Reading Tree's button: the next story in the bank. */
function readAlongNext(){ storyStart('readalong', readAlongSeed((storyRec().n.readalong || 0) % STORY_READS.length)); }

/* ---------- the parent's switch ---------- */
function simpleHomeParentHTML(){
  const on = simpleHomeOn();
  return `
    <div class="kicker2" style="margin-top:14px">${L2('HOME SCREEN', 'होम स्क्रीन')}</div>
    <div class="metric">
      <div><b>${L2('Simple home', 'आसान होम')}</b>
        <div style="font-size:12.5px;opacity:.65">${L2(
          'Stories told by Munni, and her pick of what to do — instead of the jungle map, for children who can\'t read menus yet. On by default for Nursery, LKG and UKG.',
          'जंगल के नक्शे की जगह मुन्नी की सुनाई कहानियाँ और उसकी पसंद की गतिविधि — उन बच्चों के लिए जो अभी मेन्यू नहीं पढ़ पाते। नर्सरी, एलकेजी और यूकेजी के लिए अपने-आप चालू।')}</div>
      </div>
      <button class="toggle ${on ? 'on' : ''}" onclick="toggleSimpleHome()" aria-label="${L2('Simple home', 'आसान होम')}"><span></span></button>
    </div>`;
}
function toggleSimpleHome(){
  S.home = simpleHomeOn() ? 'map' : 'simple';
  S._fullMap = false;
  log(0, `Parent set the home screen · ${S.home === 'simple' ? 'simple home (stories)' : 'jungle map'}`);
  saveSoon(); render();
}

if(typeof VIEWS !== 'undefined'){ VIEWS.stories = storyHomeHTML; VIEWS.story = storyPlayerHTML; }
if(typeof AFTER !== 'undefined') AFTER.stories = storyHomeArrive;
