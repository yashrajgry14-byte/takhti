/* ================= AFTER-RENDER HOOKS ================= */
const AFTER = {
  read(){ const m=$('mic'); if(m) m.onclick = startListening; },
  write(){ setupPad(); },
  open(){ runOpening(); },
  parentlock(){
    const i=$('pin'); if(!i) return;
    i.focus();
    i.onkeydown = e=>{ if(e.key==='Enter') S.parentPin ? checkParentPin(i.value) : setParentPin(i.value); };
  }
};

function chooseGame(id){
  S.game = id;
  const g = gameById(id);
  log(0, `Favourite game: ${g.en} · motion archetype "${g.type}" · same engine, new tokens`);
  go('open');
}
function skipOpening(){ S.ctx.phase = 2; render(); }

/* The hub to land on after arrival or a profile switch: today's opening
   (greeting → animation → today's card) the first time a child arrives
   on a given day — the pick screen promises "Every day will start with
   it" — and the jungle map every other time. */
function goHub(){ go(S.game && S.lastOpen !== dayKey() ? 'open' : 'map'); }

function runOpening(){
  const phase = S.ctx.phase || 0;
  if(phase === 0){
    S.visits++;
    S.lastOpen = dayKey();
    saveSoon();
    const g = gameById(S.game);
    // the greeting is spoken, not just printed — this is the moment the app feels alive
    setTimeout(()=> speak(GREETS[S.lang][(S.visits-1)%GREETS[S.lang].length](S.name)), 260);
    log(0, `Opening · ${g.type} timeline · greeting spoken via on-device TTS`);
    setTimeout(()=>{                       // motion, then impact
      if(S.screen!=='open') return;
      S.ctx.phase = 1; render();
      if(typeof sfxThud === 'function') sfxThud();
      const a = $('arena'); if(a) a.classList.add('shake');
      if(navigator.vibrate) navigator.vibrate([28,40,18]);
    }, 2300);
  }
  else if(phase === 1){
    setTimeout(()=>{                       // impact settles, today's card is revealed
      if(S.screen!=='open') return;
      const f = todayFormat();
      S.ctx.phase = 2; S.ctx.scene = 0;
      log(0, `${DAYNAMES.en[dayIndex()]} format: ${f.id} · adaptive draw, one format per day this week`);
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
