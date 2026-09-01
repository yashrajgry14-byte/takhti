/* ---------------- adaptive engine + goal counter (Tier 0) ---------------- */
function bumpToday(kind){
  // self-heal rather than throw: a profile persisted before daily goals
  // existed can reach here with S.today/S.targets missing entirely, and
  // record() calls this on every correct answer — mid-lesson, not on render
  if(!S.today) S.today = { read:0, write:0, math:0, facts:0 };
  if(!S.targets) S.targets = { read:5, write:5, math:5, facts:3 };
  if(S.today[kind] === undefined) return;
  const max = S.targets[kind] || 5;
  if(S.today[kind] >= max) return;      // never count past the goal
  S.today[kind]++;
  const done = S.today[kind] >= max;
  log(0, `Goal · ${kind} ${S.today[kind]}/${max}${done?' · TARGET MET':''}`);
  if(done){
    setTimeout(()=>speak(S.lang==='hi'
      ? 'शाबाश! आज का लक्ष्य पूरा हुआ।'
      : "Well done! That goal is complete."), 700);
    // newly met, right now: celebrate if we're already looking at home,
    // otherwise queue it for the next visit rather than lose it
    if(S.screen === 'home') homeCelebrate();
    else S._pendingCelebrate = true;
  }
}

function record(mod, ok){
  S.attempts[mod]++; if(ok) S.correct[mod]++;
  saveSoon();
  if(ok) bumpToday(mod);
  const w = S.window[mod]; w.push(ok?1:0); if(w.length>5) w.shift();
  if(ok) S.stars++;
  if(w.length>=4){
    const acc = w.reduce((a,b)=>a+b,0)/w.length;
    if(acc>=0.85 && S.levels[mod]<6){
      const next = clampLevel(mod, S.levels[mod]+1);
      if(next !== S.levels[mod]){
        S.levels[mod] = next; S.window[mod]=[];
        log(0,`${mod}: accuracy ${Math.round(acc*100)}% → level up to ${S.levels[mod]}`);
        noteLevelUp();
        return 'up';
      }
    }
    if(acc<=0.4 && S.levels[mod]>1){
      const next = clampLevel(mod, S.levels[mod]-1);
      if(next !== S.levels[mod]){
        S.levels[mod] = next; S.window[mod]=[];
        log(0,`${mod}: accuracy ${Math.round(acc*100)}% → step down to ${S.levels[mod]}`);
        return 'down';
      }
    }
  }
  log(0,`${mod}: attempt logged (${ok?'correct':'incorrect'}), window ${w.join('')}`);
  return null;
}

/* ---------------- speech ---------------- */
