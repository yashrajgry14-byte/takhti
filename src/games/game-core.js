/* ==================================================================
   GAME CORE

   A game shell is a RENDERER, not a content source. Every question a
   child meets in a game comes from the same 489 validated lessons —
   already checked for arithmetic, age band, narration length and
   bilingual completeness. So adding a game adds zero correctness risk,
   and a content fix improves every game at once.

   The second thing this does matters more: a game attempt is real
   evidence. Playing feeds `noteSkillAttempt()` exactly like a lesson
   checkpoint does, so a child who plays the runner for six minutes has
   given the teacher's diagnostic six minutes of data — without anyone
   entering anything.

   That is the honest version of "he is playing, and also learning."
   Not disguise. The answer IS the move.
   ================================================================== */

/* ---------- one-time pool built from the real bank ---------- */
function gameBuildPool(){
  const pool = [];
  const bank = (typeof lessonBank === 'function') ? lessonBank() : [];

  for(const les of bank){
    const skills = gameSkillsForConcept(les.concept || les.id);
    for(const b of les.beats){
      if(b.t !== 'ask' || !b.opts || b.opts.length < 2) continue;
      const right = b.opts[b.correct];
      const wrong = b.opts.filter((_,i) => i !== b.correct);
      const rightHi = (b.hiOpts || b.opts)[b.correct];
      const wrongHi = (b.hiOpts || b.opts).filter((_,i) => i !== b.correct);
      if(!right || !wrong.length) continue;
      pool.push({
        id: les.id + ':' + les.beats.indexOf(b),
        band: les.band,
        strand: (les.strand || gameStrandOf(les.concept)) || 'num',
        concept: les.concept || les.id,
        skills,
        prompt: { en: b.q.en, hi: b.q.hi },
        right:  { en: String(right),  hi: String(rightHi) },
        wrong:  wrong.map((w,i) => ({ en: String(w), hi: String(wrongHi[i] ?? w) })),
        // short answers work in an arcade shell; long ones do not
        terse: String(right).length <= 14
      });
    }
  }
  return pool;
}
function gameSkillsForConcept(c){
  if(typeof SKILLS === 'undefined') return [];
  return SKILLS.filter(s => (s.concepts || []).includes(c)).map(s => s.id);
}
function gameStrandOf(c){
  if(typeof SKILLS === 'undefined') return 'num';
  const s = SKILLS.find(x => (x.concepts || []).includes(c));
  return s ? s.strand : 'num';
}
function gamePool(){
  if(!S._gamePool) S._gamePool = gameBuildPool();
  return S._gamePool;
}

/* ---------- what this child should meet, right now ----------
   Age band is a hard filter. Within it, skills the child is weak at
   appear more often — but never so often that the game becomes a drill,
   because the point of a game is that it is winnable. */
function gameItems(n, opts){
  opts = opts || {};
  const bandId = (typeof band === 'function') ? band().id : 'developing';
  const order = ['pre','early','developing','fluent'];
  const cap = order.indexOf(bandId);

  // The child's own band, plus at most ONE below — never two. A ten-year-old
  // meeting Nursery items is the exact humiliation the age bands exist to
  // prevent, and it is worse in a game, where other children can see the
  // screen. Easier-than-current is a kindness; nursery work is an insult.
  const floor = Math.max(0, cap - 1);
  let pool = gamePool().filter(it => {
    const b = order.indexOf(it.band);
    return b <= cap && b >= floor;
  });
  if(opts.strand) pool = pool.filter(it => it.strand === opts.strand);
  if(opts.terse)  pool = pool.filter(it => it.terse);
  // an item with no skill tag still plays, but leaves no evidence — so
  // prefer tagged ones and only fall back if the pool would be too thin
  const tagged = pool.filter(it => it.skills.length);
  if(tagged.length >= n * 2) pool = tagged;
  if(!pool.length) pool = gamePool().filter(it => order.indexOf(it.band) === cap);
  if(!pool.length) return [];

  // weight by weakness, using the app's own record
  const weightOf = it => {
    let w = 1;
    for(const sid of it.skills){
      const h = (S.skillHistory || {})[sid];
      if(!h || h.n < 4) { w += 0.35; continue; }        // unseen: mild pull
      const acc = h.right / h.n;
      if(acc < 0.6) w += 1.4;                            // weak: strong pull
      else if(acc < 0.8) w += 0.6;
      else w -= 0.35;                                    // solid: back off
    }
    return Math.max(0.25, w);
  };

  const r = (typeof rng === 'function' && typeof seedOf === 'function')
    ? rng(seedOf((S.name||'x') + '|g|' + (S._gameRound || 0))) : Math.random;

  const out = [], used = new Set();
  let guard = 0;
  while(out.length < n && guard++ < n * 40){
    const total = pool.reduce((a,it) => a + weightOf(it), 0);
    let x = r() * total, i = 0;
    while(i < pool.length - 1 && x > weightOf(pool[i])){ x -= weightOf(pool[i]); i++; }
    const pick = pool[i];
    if(used.has(pick.id) && used.size < pool.length) continue;
    used.add(pick.id);
    out.push(pick);
  }
  S._gameRound = (S._gameRound || 0) + 1;
  return out;
}


/* ==================================================================
   ODD ONE OUT — sets, not single questions

   The archery shell needs four targets where one does not belong, which
   is a different shape from the bank's question-and-two-options. So we
   build sets from the same validated content: rhyme families, words
   sharing an initial sound, matra groups, multiples, nouns against a
   verb. The odd one is always odd for ONE stated reason, and the reason
   is shown after the shot — a child who guesses right learns nothing
   unless they are told why.
   ================================================================== */
function gameSets(n){
  const out = [];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x,y) => x[0]-y[0]).map(x => x[1]);

  const push = (band, strand, skills, kind, three, odd, why) => {
    const opts = shuffle([...three.map(t => ({ text:t, odd:false })), { text:odd, odd:true }]);
    out.push({ id:`set-${kind}-${out.length}`, band, strand, skills, kind,
               prompt: gameSetPrompt(kind), options: opts,
               correct: opts.findIndex(o => o.odd), why });
  };

  const L = (typeof LIT !== 'undefined') ? LIT : null;
  const G = (typeof GRAMMAR !== 'undefined') ? GRAMMAR : null;

  for(let k = 0; k < n * 3 && out.length < n * 3; k++){
    const which = k % 6;

    if(which === 0 && L && L.en.rhymes.length > 1){
      const a = pick(L.en.rhymes), b = pick(L.en.rhymes.filter(x => x !== a));
      push('pre','eng',['n-rhyme'],'rhyme', [a[0],a[1],a[2]], b[0],
           { en:`${a[0]}, ${a[1]} and ${a[2]} rhyme. ${b[0]} does not.`,
             hi:`${a[0]}, ${a[1]} और ${a[2]} तुक मिलाते हैं। ${b[0]} नहीं।` });
    }

    if(which === 1 && L){
      const a = pick(L.en.sounds), b = pick(L.en.sounds.filter(x => x[0] !== a[0]));
      push('early','eng',['l-sound','l-alpha'],'initial', a[2].slice(0,3), b[2][0],
           { en:`Three start with ${a[0]}. ${b[2][0]} starts with ${b[0]}.`,
             hi:`तीन ${a[0]} से शुरू हैं। ${b[2][0]} ${b[0]} से।` });
    }

    if(which === 2 && L){
      const a = pick(L.hi.matras), b = pick(L.hi.matras.filter(x => x[0] !== a[0]));
      push('early','hin',['u-matra1','h1-matra'],'matra', a[2].slice(0,3), b[2][0],
           { en:`Three carry the ${a[0]} matra. One does not.`,
             hi:`तीन में ${a[0]} की मात्रा है। एक में नहीं।` });
    }

    if(which === 3){
      const even = shuffle([2,4,6,8,10,12,14,16]).slice(0,3);
      const odd  = pick([3,5,7,9,11,13]);
      push('developing','num',['oddeven'],'parity', even.map(String), String(odd),
           { en:`${even.join(', ')} are even. ${odd} is odd.`,
             hi:`${even.join(', ')} सम हैं। ${odd} विषम है।` });
    }

    if(which === 4){
      const t = pick([3,4,5,6]);
      const mult = shuffle([2,3,4,5,6,7].map(x => x*t)).slice(0,3);
      let notm = mult[0] + 1; while(notm % t === 0) notm++;
      push('fluent','num',['tables'],'multiple', mult.map(String), String(notm),
           { en:`${mult.join(', ')} are all in the ${t} times table. ${notm} is not.`,
             hi:`${mult.join(', ')} सब ${t} के पहाड़े में हैं। ${notm} नहीं।` });
    }

    if(which === 5 && G){
      const ns = shuffle(G.nouns).slice(0,3).map(x => x.t.en);
      const v  = pick(G.verbs).t.en;
      push('developing','eng',['e2-noun','e3-verb'],'wordkind', ns, v,
           { en:`${ns.join(', ')} name things. ${v} is a doing word.`,
             hi:`${ns.join(', ')} नाम बताते हैं। ${v} काम बताता है।` });
    }
  }
  return shuffle(out).slice(0, n);
}
function gameSetPrompt(kind){
  const p = {
    rhyme:    { en:'Which one does not rhyme?',       hi:'तुक कौन नहीं मिलाता?' },
    initial:  { en:'Which starts with a different sound?', hi:'अलग ध्वनि से कौन शुरू है?' },
    matra:    { en:'Which has a different matra?',    hi:'अलग मात्रा किसमें?' },
    parity:   { en:'Which one is odd?',               hi:'विषम कौन सा है?' },
    multiple: { en:'Which is not in the table?',      hi:'पहाड़े में कौन नहीं?' },
    wordkind: { en:'Which is not a naming word?',     hi:'नाम वाला शब्द कौन नहीं?' }
  }[kind];
  return p || { en:'Which one does not belong?', hi:'कौन सा अलग है?' };
}

/* ---------- a round ---------- */
function gameStart(kind, len){
  S.game_ = {
    kind, i:0, right:0, wrong:0, best:(S.gameBest||{})[kind] || 0,
    items: (GAME_SHELLS[kind] && GAME_SHELLS[kind].sets)
             ? gameSets(len || GAME_SHELLS[kind].len || 14)
             : gameItems(len || (GAME_SHELLS[kind] && GAME_SHELLS[kind].len) || 12,
                         GAME_SHELLS[kind] ? GAME_SHELLS[kind].pick : {}),
    started: Date.now(), over:false
  };
  log(0, `Game "${kind}" · ${S.game_.items.length} items drawn from the validated bank`);
  return S.game_;
}
function gameCurrent(){ const g = S.game_; return g && g.items[g.i]; }

/* Every answer is evidence. This is the whole reason games are worth
   building rather than buying: a child playing produces exactly the
   data the teacher's diagnostic needs. */
function gameAnswer(ok){
  const g = S.game_, it = gameCurrent();
  if(!g || !it || g.over) return;
  if(ok) g.right++; else g.wrong++;
  if(typeof noteSkillAttempt === 'function')
    for(const sid of it.skills) noteSkillAttempt(sid, ok);
  if(typeof record === 'function' && it.strand === 'num') record('math', ok);
  g.i++;
  if(g.i >= g.items.length) gameEnd();
  return ok;
}
function gameEnd(){
  const g = S.game_; if(!g || g.over) return;
  g.over = true;
  S.gameBest = S.gameBest || {};
  if(g.right > (S.gameBest[g.kind] || 0)) { g.newBest = true; S.gameBest[g.kind] = g.right; }
  const secs = Math.round((Date.now() - g.started) / 1000);
  log(0, `Game over · ${g.right}/${g.items.length} in ${secs}s${g.newBest ? ' · new best' : ''}`);
}

/* Shown at the end. Deliberately about THIS round and the child's own
   previous best — never a streak, never a comparison with other children. */
function gameSummary(){
  const g = S.game_; if(!g) return '';
  const hi = S.lang === 'hi';
  if(g.newBest) return hi ? `तुम्हारा अब तक का सबसे अच्छा! ${g.right} सही।`
                          : `Your best yet! ${g.right} right.`;
  if(g.right === g.items.length) return hi ? 'सब सही! ⭐' : 'Every one right! ⭐';
  if(g.right >= g.items.length * 0.7) return hi ? `बढ़िया — ${g.right} सही।` : `Good going — ${g.right} right.`;
  return hi ? `${g.right} सही। अगली बार और।` : `${g.right} right. More next time.`;
}

/* ---------- the shells, and what each is FOR ----------
   Each targets a different thing. A runner builds speed; a memory grid
   builds association; a tower rewards care over speed. A child who only
   ever plays one gets good at one thing. */
const GAME_SHELLS = {
  runner: { ic:'🏃', en:'Run and Choose',  hi:'दौड़ो और चुनो',
            aim:{ en:'Fast recall — answer without stopping to think',
                  hi:'तेज़ याद — बिना रुके जवाब' },
            pick:{ terse:true }, len:18 },
  pop:    { ic:'🫧', en:'Pop the Right One', hi:'सही वाला फोड़ो',
            aim:{ en:'Spotting — find the one that fits the rule',
                  hi:'पहचान — नियम पर खरा कौन' },
            pick:{ terse:true }, len:16 },
  tower:  { ic:'🧱', en:'Build the Tower',  hi:'मीनार बनाओ',
            aim:{ en:'Care over speed — one wrong block and it wobbles',
                  hi:'सावधानी — एक ग़लत ईंट और मीनार हिली' },
            pick:{}, len:12 },
  match:  { ic:'🃏', en:'Find the Pairs',   hi:'जोड़े ढूँढो',
            aim:{ en:'Memory — hold what you saw and match it',
                  hi:'याददाश्त — देखा हुआ याद रखो' },
            pick:{ terse:true }, len:10 },
  sort:   { ic:'🗑️', en:'Sort it Fast',     hi:'जल्दी छाँटो',
            aim:{ en:'Deciding — two bins, no time to dither',
                  hi:'निर्णय — दो डिब्बे, सोचने का समय नहीं' },
            // sets, not items: sort.js needs the "three fit the rule, one is
            // odd" shape gameSets() produces (a 2-bin sort IS an odd-one-out
            // task), then flattens each 4-option set into individual falling
            // items itself. `len` here is SETS, not falling items — 5 sets
            // gives a round of 20 falling items, one bin decision each.
            sets:true, len:5 },
  archer: { ic:'🏹', en:'Find the Odd One',  hi:'अलग वाला ढूँढो',
            // Archery, not shooting. Same aiming, same appeal — and a
            // principal reviewing a children's app reacts very differently
            // to a bow than to a gun. There is nothing to gain by the
            // other framing and a sale to lose.
            aim:{ en:'Reasoning — work out WHY one does not belong',
                  hi:'तर्क — समझो कि एक अलग क्यों है' },
            sets:true, len:14 }
};
const gameList = () => Object.entries(GAME_SHELLS).map(([k,v]) => ({ kind:k, ...v }));
