/* ==================================================================
   THE SEVEN DAILY CARDS
   Each takes the child's favourite game and returns a different shape
   of learning. Same game every day, never the same experience.
   ================================================================== */
const L = (o) => (o && (o[S.lang] || o.en)) || '';
/* cards publish what the child can read back; see ui/readback.js */
function setReadText(txt){ S.ctx.readText = txt; return txt; }

function weekStrip(){
  const plan = weekPlan();
  return `<div class="week">${plan.map((f,i)=>`
    <div class="day ${i===S.day%7?'today':''} ${i<S.day%7?'done':''}">
      <b>${f.ic}</b>${DAYNAMES[S.lang][i]}
    </div>`).join('')}</div>`;
}
function shell(kicker, inner){
  return `<div class="factcard"><div class="kicker">${kicker}</div>${inner}</div>`;
}

const CARD = {

fact(g){
  const list = FACTS[g.id] || [g.fact];
  if(S.ctx.factIdx == null) S.ctx.factIdx = seedOf((S.name||'x')+'f'+S.day) % list.length;
  const i = S.ctx.factIdx % list.length;
  const f = list[i];
  const txt = L(f);
  S.ctx.readText = txt;
  const hero = (f.h != null)
    ? `<div class="facthero">
         <div><div class="bignum">${f.h}</div><div class="bigunit">${f.u? L(UNITS[f.u]) : ''}</div></div>
         <div class="factemoji drift">${g.ic}</div>
       </div>`
    : `<div class="facthero" style="justify-content:center"><div class="factemoji grow" style="margin:0;font-size:52px">${g.ic}</div></div>`;
  const strip = (f.dot && f.h>0 && f.h<=20)
    ? `<div class="shapes" style="margin:2px 0 10px;max-width:100%">${
        [...Array(f.h)].map((_,k)=>`<b style="animation-delay:${k*0.06}s;font-size:16px">${f.dot}</b>`).join('')}</div>`
    : '';
  return shell(S.lang==='hi'?'क्या तुम्हें पता था?':'DID YOU KNOW?', `
    ${hero}${strip}
    <p>${txt}</p>
    <div class="row" style="margin-top:12px">
      <button class="btn ghost" data-say="${attr(txt)}" onclick="sayEl(this)">🔊 ${t('hear')}</button>
      ${list.length>1?`<button class="btn ghost" onclick="nextFact(${list.length})">✨ ${S.lang==='hi'?'एक और':'One more'}</button>`:''}
    </div>
    ${list.length>1?`<div class="factidx">${i+1} / ${list.length} · ${S.lang==='hi'?g.hi:g.en}</div>`:''}`);
},

quiz(g){
  S.ctx.readText = null;
  const opts = S.lang==='hi' ? (g.quiz.hiOpts||g.quiz.opts) : g.quiz.opts;
  return shell(S.lang==='hi'?'आज का सवाल':"TODAY'S QUESTION", `
    <h3>${L(g.quiz)}</h3>
    <div class="opts" style="margin-top:12px">
      ${opts.map((o,i)=>`<button class="opt" style="font-size:16px;padding:13px" onclick="dailyAnswer(${i},${g.quiz.correct})">${o}</button>`).join('')}
    </div>
    <div class="feedback" id="dfb" style="text-align:center;margin-top:10px"></div>`);
},

anim(g){
  const sc = scenes(g);
  const i = Math.min(S.ctx.scene||0, sc.length-1);
  setReadText(L(sc[i].cap));
  return `
    <div class="player">
      <div class="scene" key="${i}">${sc[i].art}</div>
      <div class="caption">${L(sc[i].cap)}</div>
    </div>
    <div class="pbar">${sc.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost" onclick="S.ctx.scene=0;render();playScenes()">↻ ${S.lang==='hi'?'फिर से':'Replay'}</button>
      ${i<sc.length-1?`<button class="btn" onclick="stepScene()">${t('next')} →</button>`:''}
    </div>`;
},

world(){
  const w = WORLD[seedOf(S.name+S.day) % WORLD.length];
  return shell(S.lang==='hi'?'दुनिया भर से':'AROUND THE WORLD', `
    <div style="font-size:52px;text-align:center" class="drift">${w.ic}</div>
    <p style="margin-top:8px">${setReadText(L(w))}</p>
    <button class="btn ghost" style="margin-top:12px" data-say="${attr(L(w))}" onclick="sayEl(this)">🔊 ${t('hear')}</button>`);
},

word(){
  const d = WORDS[seedOf(S.name+'w'+S.day) % WORDS.length];
  const say = S.lang==='hi' ? d.hi : d.w;
  setReadText(L(d.m));
  return shell(S.lang==='hi'?'आज का नया शब्द':'NEW WORD TODAY', `
    <h3 style="font-size:30px">${say}</h3>
    <div class="muted" style="margin:-2px 0 8px">${S.lang==='hi'? d.w : d.hi}</div>
    <p>${L(d.m)}</p>
    <div class="row" style="margin-top:12px">
      <button class="btn ghost" data-say="${attr(say)}" onclick="sayEl(this)">🔊 ${S.lang==='hi'?'बोलकर सुनो':'Say it'}</button>
      <button class="btn ghost" data-say="${attr(L(d.m))}" onclick="sayEl(this)">${S.lang==='hi'?'मतलब':'Meaning'}</button>
    </div>`);
},

story(g){
  const s = OFFLINE_PACK[seedOf(S.name+'s'+S.day) % OFFLINE_PACK.length];
  const i = Math.min(S.ctx.scene||0, s.panels.length-1);
  const p = s.panels[i];
  setReadText(p[S.lang]||p.en);
  return `
    <div class="player" style="height:196px">
      <div class="scene"><div style="text-align:center">
        <div style="font-size:56px" class="drift">${p.art}</div>
      </div></div>
      <div class="caption">${p[S.lang]||p.en}</div>
    </div>
    <div class="pbar">${s.panels.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div>
    ${i<s.panels.length-1
      ? `<button class="btn" style="margin-top:10px" onclick="S.ctx.scene=${i+1};render();speak(document.querySelector('.caption').textContent)">${t('next')} →</button>`
      : `<div class="feedback" style="text-align:center;margin-top:10px">${S.lang==='hi'?'कहानी पूरी हुई ⭐':'Story finished ⭐'}</div>`}`;
},

challenge(g){
  S.ctx.readText = null;
  const n = Math.min(9, Math.max(3, (ANIM[g.id]&&ANIM[g.id].n) || 5));
  if(!S.ctx.items){
    const r = rng(seedOf(S.name+'c'+S.day));
    S.ctx.items = [...Array(n)].map((_,i)=>({ id:i, got:false,
      x: 6 + r()*80, y: 6 + r()*74, d:(r()*2).toFixed(1) }));
    S.ctx.tapped = 0;
  }
  const done = S.ctx.tapped >= n;
  return shell(S.lang==='hi'?'आज की चुनौती':"TODAY'S CHALLENGE", `
    <h3 style="font-size:18px">${S.lang==='hi'
      ? `सारे ${g.ic} पकड़ो और गिनते जाओ — कुल ${n}`
      : `Catch every ${g.ic} and count them — ${n} in all`}</h3>
    <div class="field" style="margin-top:10px">
      ${S.ctx.items.map(it=>`<div class="tapme ${it.got?'got':''}" style="left:${it.x}%;top:${it.y}%;animation-delay:${it.d}s"
         onclick="catchIt(${it.id})">${g.ic}</div>`).join('')}
    </div>
    <div class="tapcount">${done
      ? (S.lang==='hi'?`सब ${n} पकड़ लिए! ⭐`:`All ${n} caught! ⭐`)
      : `${S.ctx.tapped} / ${n}`}</div>`);
}
};

/* ---------- six animation templates cover all twenty games ---------- */
function scenes(g){
  const a = ANIM[g.id] || {tpl:'count', n:5, ic:g.ic, th:{en:'things',hi:'चीज़ें'}};
  const row = (n,ic,hl) => `<div class="shapes">${[...Array(n)].map((_,i)=>
    `<b style="animation-delay:${i*0.09}s;${hl===i?'filter:drop-shadow(0 0 7px #F0A02A)':''}">${ic}</b>`).join('')}</div>`;

  if(a.tpl==='count') return [
    {art:`<div style="font-size:60px" class="grow">${a.ic}</div>`,
     cap:{en:`Let us count the ${a.th.en}.`, hi:`आओ ${a.th.hi} गिनें।`}},
    {art:row(a.n, a.ic, a.one?0:-1),
     cap:{en:`One… two… three… all the way to ${a.n}.`, hi:`एक… दो… तीन… ${a.n} तक।`}},
    {art:`<div style="text-align:center"><div class="counter">${a.n}</div><div style="font-size:26px">${a.ic}</div></div>`,
     cap: a.one
       ? {en:`${a.n} chits, and only 1 is the chor. That is 1 out of ${a.n}.`, hi:`${a.n} पर्चियाँ, चोर सिर्फ़ 1। यानी ${a.n} में से 1।`}
       : {en:`${a.n} ${a.th.en}. Remember that number!`, hi:`${a.n} ${a.th.hi}। यह संख्या याद रखो!`}}
  ];

  if(a.tpl==='shape') return a.pattern ? [
    {art:row(8,'🧍'), cap:{en:'Eight players sit in a line.', hi:'आठ खिलाड़ी एक कतार में बैठते हैं।'}},
    {art:`<div class="shapes">${['⬅️','➡️','⬅️','➡️','⬅️','➡️','⬅️','➡️'].map((x,i)=>`<b style="animation-delay:${i*.1}s">${x}</b>`).join('')}</div>`,
     cap:{en:'But they face alternate ways: left, right, left, right.', hi:'पर वे बारी-बारी उल्टा देखते हैं: बाएँ, दाएँ, बाएँ, दाएँ।'}},
    {art:`<div style="font-size:58px" class="tilt">🤸</div>`, cap:{en:'That pattern is what makes kho kho so fast!', hi:'यही पैटर्न खो खो को इतना तेज़ बनाता है!'}}
  ] : [
    {art:row(20,'⬡'), cap:{en:'Twenty white patches with six sides each — hexagons.', hi:'बीस सफ़ेद टुकड़े, हर एक में छह भुजाएँ — षट्भुज।'}},
    {art:row(12,'⬟'), cap:{en:'Twelve black patches with five sides — pentagons.', hi:'बारह काले टुकड़े, पाँच भुजाओं वाले — पंचभुज।'}},
    {art:`<div style="text-align:center"><div class="counter">20 + 12 = 32</div><div style="font-size:46px" class="spin-slow">⚽</div></div>`,
     cap:{en:'Stitch them together and you have a football!', hi:'इन्हें जोड़ दो और फ़ुटबॉल तैयार!'}}
  ];

  if(a.tpl==='measure') return [
    {art:`<div style="font-size:56px" class="grow">${a.ic}</div>`,
     cap:{en:`How big is ${a.th.en}?`, hi:`${a.th.hi} कितनी बड़ी है?`}},
    {art:`<div style="text-align:center"><div class="bar"><u></u></div>
          <div style="margin-top:9px;font-size:20px">📏</div></div>`,
     cap:{en:'Let us measure it, step by step…', hi:'आओ इसे नापें, कदम-कदम…'}},
    {art:`<div style="text-align:center"><div class="counter">${a.n}</div>
          <div style="font-size:15px;color:var(--chalk-dim)">${L(a.u)}</div></div>`,
     cap:{en:`${a.n} ${a.u.en}. Now you know!`, hi:`${a.n} ${a.u.hi}। अब तुम्हें पता है!`}}
  ];

  if(a.tpl==='compare') return [
    {art:`<div style="font-size:46px;display:flex;gap:26px"><span class="drift">${a.a}</span><span class="drift" style="animation-delay:.5s">${a.b}</span></div>`,
     cap:{en:'Two of them. Which one wins?', hi:'दो चीज़ें। कौन जीतेगी?'}},
    {art:`<div style="font-size:46px;display:flex;gap:26px"><span class="grow">${a.a}</span><span style="opacity:.45">${a.b}</span></div>`,
     cap:{en:'Watch closely…', hi:'ध्यान से देखो…'}},
    {art:`<div style="font-size:56px" class="grow">${a.a}</div>`, cap:a.v}
  ];

  if(a.tpl==='balance') return [
    {art:`<div style="font-size:56px" class="tilt">${a.ic}</div>`, cap:{en:'Watch it wobble.', hi:'देखो कैसे डगमगाता है।'}},
    {art:`<div style="font-size:56px" class="spin-slow">${a.ic}</div>`, cap:{en:'Now watch what steadies it.', hi:'अब देखो इसे क्या सँभालता है।'}},
    {art:`<div style="font-size:56px" class="grow">${a.ic}</div>`, cap:a.v}
  ];

  /* melt: water changing state */
  return a.float ? [
    {art:`<div style="font-size:56px" class="drift">🫁</div>`, cap:{en:'Fill your lungs with air.', hi:'फेफड़ों में हवा भर लो।'}},
    {art:`<div style="font-size:56px" class="drift">🏊</div>`, cap:{en:'Full of air, your body floats on top.', hi:'हवा भरी हो तो शरीर ऊपर तैरता है।'}},
    {art:`<div style="font-size:56px">🌊</div>`, cap:{en:'Push the air out and you start to sink. Try it!', hi:'हवा निकाल दो और डूबने लगोगे। आज़माओ!'}}
  ] : [
    {art:`<div style="font-size:56px" class="grow">🧊</div>`, cap:{en:'Ice is water that got very, very cold.', hi:'बरफ़ वही पानी है जो बहुत ठंडा हो गया।'}},
    {art:`<div style="font-size:56px" class="drift">💧</div>`, cap:{en:'Warm it up and it melts back into water.', hi:'गरम करो तो पिघलकर फिर पानी बन जाता है।'}},
    {art:`<div style="text-align:center"><div class="counter">0°</div><div style="font-size:34px">🧊💧</div></div>`,
     cap:{en:'Water freezes at zero degrees. Baraf… paani!', hi:'पानी शून्य डिग्री पर जमता है। बरफ़… पानी!'}}
  ];
}

function stepScene(){ S.ctx.scene=(S.ctx.scene||0)+1; render(); narrateScene(); }
function nextFact(len){
  S.ctx.factIdx = ((S.ctx.factIdx||0) + 1) % len;
  log(0, `Fact ${S.ctx.factIdx+1} of ${len} · rotating within this game's library`);
  render();
  const p = document.querySelector('.factcard p');
  if(p) speak(p.textContent);
}
function narrateScene(){ const c=document.querySelector('.caption'); if(c) speak(c.textContent); }
function playScenes(){
  narrateScene();
  clearTimeout(S._sceneTimer);
  const g = gameById(S.game), total = scenes(g).length;
  const tick = () => {
    if(S.screen!=='open' || (S.ctx.scene||0) >= total-1) return;
    S.ctx.scene=(S.ctx.scene||0)+1; render(); narrateScene();
    S._sceneTimer = setTimeout(tick, 3400);
  };
  S._sceneTimer = setTimeout(tick, 3400);
}
function catchIt(id){
  const it = S.ctx.items.find(x=>x.id===id);
  if(!it || it.got) return;
  it.got = true; S.ctx.tapped++;
  speak(String(S.ctx.tapped));
  const done = S.ctx.tapped >= S.ctx.items.length;
  if(done){ S.stars++; record('math', true); log(0,'Challenge complete · counted to '+S.ctx.tapped); }
  render();
  if(done) cheer();
}
function nextDay(){
  S.day++;
  const f = todayFormat();
  log(0, `Day ${S.day%7+1} · scheduler drew "${f.id}" · bag guarantees no repeat this week`);
  S.ctx = { phase:0 }; render();
}
function cheer(){
  const m = document.querySelector('.mascot');
  if(m){ m.classList.add('cheer'); setTimeout(()=>m.classList.remove('cheer'), 750); }
}
