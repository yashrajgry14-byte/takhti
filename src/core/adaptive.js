/* ---------------- adaptive engine + goal counter (Tier 0) ---------------- */
function bumpToday(kind){
  if(S.today[kind] === undefined) return;
  if(S.today[kind] >= S.targets[kind]) return;      // never count past the goal
  S.today[kind]++;
  const done = S.today[kind] >= S.targets[kind];
  log(0, `Goal · ${kind} ${S.today[kind]}/${S.targets[kind]}${done?' · TARGET MET':''}`);
  if(done) setTimeout(()=>speak(S.lang==='hi'
    ? 'शाबाश! आज का लक्ष्य पूरा हुआ।'
    : "Well done! That goal is complete."), 700);
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
