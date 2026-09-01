/* ================= AFTER-RENDER HOOKS ================= */
const AFTER = {
  read(){ const m=$('mic'); if(m) m.onclick = startListening; },
  write(){ setupPad(); },
  greet(){ const i=$('nm'); if(i){ i.focus(); i.onkeydown=e=>{ if(e.key==='Enter') saveName(i.value); }; } },
  open(){ runOpening(); },
  parentlock(){
    const i=$('pin'); if(!i) return;
    i.focus();
    i.onkeydown = e=>{ if(e.key==='Enter') S.parentPin ? checkParentPin(i.value) : setParentPin(i.value); };
  },
  home(){
    homeSceneStart();
    // a goal met while the child was on a different screen celebrates here instead
    if(S._pendingCelebrate){ S._pendingCelebrate = false; homeCelebrate(); }
  }
};

/* ================= OPENING SEQUENCE ================= */
function saveName(v){
  if(!createProfile(v)) return;
  go('age');
}

/* --- age: sets the ceiling/floor a fresh profile starts at, and is also
   how an existing profile (created before this screen existed) gets asked
   once. `next` is where we continue afterwards — 'pick' for a brand new
   profile finishing onboarding, 'home' when we caught an existing one
   without an age set. promptAge() bypasses go() because go() resets S.ctx,
   which is exactly where we need to remember `next`. */
function promptAge(next){
  S.screen = 'age';
  S.ctx = { ageNext: next };
  render();
}
function setAge(age){
  S.age = age;
  const st = band().start;
  S.levels.read = st.read; S.levels.write = st.write; S.levels.math = st.math;
  log(0, `Age set to ${age} · band "${band().id}" · starting levels read=${st.read} write=${st.write} math=${st.math}`);
  saveSoon();
  go(S.ctx.ageNext || 'pick');
}

function chooseGame(id){
  S.game = id;
  const g = gameById(id);
  log(0, `Favourite game: ${g.en} · motion archetype "${g.type}" · same engine, new tokens`);
  go('open');
}
function skipOpening(){ S.ctx.phase = 2; S.ctx.card = S.ctx.card || (S.visits%2 ? 'quiz':'fact'); render(); }

function runOpening(){
  const phase = S.ctx.phase || 0;
  if(phase === 0){
    S.visits++;
    const g = gameById(S.game);
    // the greeting is spoken, not just printed — this is the moment the app feels alive
    setTimeout(()=> speak(GREETS[S.lang][(S.visits-1)%GREETS[S.lang].length](S.name)), 260);
    log(0, `Opening · ${g.type} timeline · greeting spoken via on-device TTS`);
    setTimeout(()=>{                       // motion, then impact
      if(S.screen!=='open') return;
      S.ctx.phase = 1; render();
      const a = $('arena'); if(a) a.classList.add('shake');
      if(navigator.vibrate) navigator.vibrate([28,40,18]);
    }, 2300);
  }
  else if(phase === 1){
    setTimeout(()=>{                       // impact settles, today's card is revealed
      if(S.screen!=='open') return;
      const f = todayFormat();
      S.ctx.phase = 2; S.ctx.scene = 0;
      if(!S.seen.includes(f.id)) S.seen.push(f.id);
      log(0, `Day ${S.day%FORMATS.length+1} format: ${f.id} · adaptive bag draw, one of each per week`);
      bumpToday('facts');
      render();
      if(f.id==='anim' || f.id==='story') setTimeout(playScenes, 420);
      else if(f.id==='fact' || f.id==='world') setTimeout(()=>{
        const p=document.querySelector('.factcard p'); if(p) speak(p.textContent);
      }, 420);
    }, 1000);
  }
}
function dailyAnswer(i, correct){
  if(S.ctx.dailyDone) return;
  const fb=$('dfb'); if(!fb) return;
  const ok = i===correct;
  fb.textContent = ok ? (S.lang==='hi'?'बिलकुल सही! ⭐':'Exactly right! ⭐')
                      : (S.lang==='hi'?'फिर से सोचो — कोई बात नहीं':'Have another think — no problem');
  if(ok){ S.ctx.dailyDone = true; S.stars++; log(0,'Daily check passed · star added'); speak(S.lang==='hi'?'सही':'Correct'); }
}
