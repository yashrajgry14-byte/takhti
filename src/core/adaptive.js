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
  // Reading and writing have no separate "lesson" system the way maths
  // does via lesson-player.js — read()/write() themselves ARE the whole
  // practice loop, so this is the only place their entry in the skill
  // graph (read1-6/write1-6, see content/skills.js) can ever get real
  // evidence. Tag with the level the child was actually AT for this
  // attempt — captured here, before the level-adjustment logic below can
  // move S.levels[mod] out from under it.
  if((mod==='read' || mod==='write') && typeof noteSkillAttempt==='function'){
    noteSkillAttempt(mod + S.levels[mod], ok);
  }
  if(typeof recordSrsItem === 'function'){
    const itemId = `${mod}_l${S.levels[mod]||1}_${(S.ctx&&S.ctx.sentence)||(S.ctx&&S.ctx.glyph)||(S.ctx&&S.ctx.line)||mod}`;
    recordSrsItem(itemId, mod, S.ctx?S.ctx.sentence||S.ctx.glyph||'':'', ok, S);
  }
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
