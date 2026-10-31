/* ==================================================================
   ASK MUNNI — help with the question in front of you, right now

   A round Munni button floats on every screen that is asking the child
   something (Counting Stones, the Reading Tree, a story lesson's question,
   a cartoon's "your turn"). Tap it and, at once:

   1. Munni explains THIS question step by step, out loud and on screen
      (core/explain.js) — make ten, tens then ones, borrow a ten, multiply
      first, a hard word in pieces. On the phone, no network, offline too.
      She never says the final answer: the last line asks it, and the
      child answers on the screen as usual.
   2. Still stuck? "Talk to Munni" opens a live voice call in the app
      (Talking Munni, ui/talk-munni.js → voice/help.js): she walks the same
      steps and asks each one — "first the tens: thirty and twenty?" —
      listening to the child's answers. Only with a parent's Talking Munni
      switch on (the voice goes to the voice service during the call) and a
      signal; otherwise the panel says so, kindly, and offers to hear it again.

   Help is help, not a test: an answer given after Munni explained is not
   counted as the child's own (no record(), no skill evidence) — the next
   question is theirs again. Not on Munni's Friday check: that one is the
   week's measure.
   ================================================================== */
let ASK = null;   // { lines, i, call, where, playing }

/* What is being asked on this screen right now, if anything. */
function askTarget(){
  const hi = S.lang === 'hi';
  if(S.screen === 'math' && S.ctx.p && S.ctx.picked == null){
    const p = S.ctx.p;
    return { key: `math:${p.a}${p.op}${p.b}`, skill: skillOfProblem(p), p, x: explainMath(p), call: { kind: 'math', a: p.a, b: p.b, op: p.op } };
  }
  if(S.screen === 'read' && S.ctx.sentence){
    const lang = /[ऀ-ॿ]/.test(S.ctx.sentence) ? 'hi' : 'en';      // Munni explains a line in its own language
    return { key: 'read:' + S.ctx.sentence, lang, skill: readSkill(), x: explainRead(S.ctx.sentence, S.ctx.missed || [], lang), call: { kind: 'read', line: S.ctx.sentence, missed: S.ctx.missed || [] } };
  }
  if(S.screen === 'lessons' && S.lesson && S.lesson.data){
    const les = S.lesson.data, i = S.lesson.i, b = les.beats[i];
    if(!b || b.t !== 'ask' || S.lesson.picked != null) return null;
    const x = explainLessonBeat(les, i);
    // a bank lesson the server also has can go to a call; a homework story can't
    const inBank = !les.isHomeworkStory && !les.coop;
    const key = `lesson:${les.id}:${i}`;
    const skill = les.skillId || ((CONCEPT_SKILLS[les.concept] || []).find(id => mindDomain(id)) || null);
    if(x) return { key, skill, x, call: inBank ? { kind: 'lesson', id: les.id + ':' + i } : null, q: b };
    // no sum underneath: Munni retells the lesson, then asks the two choices
    const told = [];
    for(let k = i - 1; k >= 0 && les.beats[k].t !== 'ask'; k--) told.unshift(lesSay(les.beats[k]));
    const opts = hi ? (b.hiOpts || b.opts) : b.opts;
    const lines = told.filter(Boolean).concat(`${L(b.q)} ${opts.join(hi ? ' या ' : ' or ')}?`);
    return { key, lines, call: null };
  }
  if(S.screen === 'theater' && S.activeVideo){
    const av = S.activeVideo, sc = av.data.scenes[av.sceneIdx];
    if(!sc || !sc.isCheckpoint || av.picked != null) return null;
    const x = explainMath({ text: sc.question.en });
    return x ? { key: `video:${sc.question.en}`, skill: av.data.skillId, p: { a: x.a, b: x.b, c: x.c, op: x.op }, x, call: { kind: 'math', a: x.a, b: x.b, c: x.c, op: x.op } } : null;
  }
  return null;
}

/* The round button, kept in step with the screen after every render. */
function askFab(){
  let el = document.getElementById('askfab');
  const tg = askTarget();
  // the question moved on (answered, next one) while help was open: help goes with it
  const moved = ASK && (ASK.teach ? S.ctx.p !== ASK.p : (!tg || tg.key !== ASK.key));
  if(moved && !(talkLive() && TALK.help)) { ASK = null; askPanel(); }
  const show = !ASK && tg;
  if(!show){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement('button'); el.id = 'askfab'; el.className = 'askfab'; el.onclick = askMunni; document.body.appendChild(el); }
  el.innerHTML = `<span class="askfab-ic">🐘</span><span>${S.lang === 'hi' ? 'मुन्नी से पूछो' : 'Ask Munni'}</span>`;
  el.setAttribute('aria-label', S.lang === 'hi' ? 'मुन्नी से मदद लो' : 'Ask Munni for help');
}

function askMunni(){
  const tg = askTarget();
  if(!tg) return;
  const lines = tg.lines || explainLines(tg.x, tg.lang || S.lang);
  if(!lines.length) return;
  // a mistake this child keeps making on this skill: Munni warns about it
  // just before she asks (core/twin.js), and a call goes at it too
  const habit = tg.p && tg.skill && twinHabit(tg.skill);
  if(habit && mistakeAnswers(tg.p).some(m => m.id === habit.id)){
    const tip = mistakeTip(habit.id, tg.p, S.lang);
    if(tip) lines.splice(lines.length - 1, 0, (S.lang === 'hi' ? 'ध्यान रहे: ' : 'Watch out: ') + tip);
    if(tg.call) tg.call.mistake = habit.id;
  }
  // whatever the child answers next on this question was helped
  if(S.screen === 'lessons' && S.lesson) S.lesson.helpedAt = S.lesson.i;
  else if(S.screen === 'theater' && S.activeVideo) S.activeVideo.helpedAt = S.activeVideo.sceneIdx;
  else S.ctx.helped = true;
  // asking is a teaching moment, step by step (core/mind.js learns whether it sticks)
  const sk = tg.skill || null;
  if(sk) mindTaught(sk, mindDomain(sk) === 'read' ? 'chunks' : 'steps');
  ASK = { lines, i: 0, call: tg.call || null, where: S.screen, key: tg.key };
  if(tg.call && TALK_URL && S.talkMunni && S.online) talkPreload();   // ready if the call is needed: audio may only start from a tap
  log(0, `Ask Munni · ${lines.length} step(s) for this question, on the phone`);
  askFab();
  askPanel();
  askPlay(0);
}

/* Munni's plan for this child says "step by step": after a missed sum,
   the same steps, then the answer (the question is already answered). */
function askTeach(p){
  if(S.screen !== 'math' || S.ctx.p !== p) return;
  const x = explainMath(p);
  if(!x) return playMath();
  // the mistake the child just made comes first (core/twin.js)
  const tip = S.ctx.tip ? mistakeTip(S.ctx.tip.id, p, S.lang) : '';
  const lines = (tip ? [tip] : []).concat(explainLines(x, S.lang).slice(0, -1), S.lang === 'hi' ? `${x.text} = ${x.ans}।` : `${x.text} = ${x.ans}.`);
  ASK = { lines, i: 0, call: null, where: 'math', teach: true, p };
  askFab(); askPanel(); askPlay(0);
}

function askPlay(i){
  if(!ASK) return;
  ASK.i = i; ASK.playing = true;
  askPanel();
  speak(ASK.lines[i], null, () => {
    if(!ASK || ASK.i !== i) return;
    if(i + 1 < ASK.lines.length) setTimeout(() => askPlay(i + 1), 350);
    else { ASK.playing = false; askPanel(); }
  });
}

function askCallReady(){ return !!(TALK_URL && S.talkMunni && S.online && ASK && ASK.call && !talkLive()); }

function askPanel(){
  let el = document.getElementById('askpanel');
  if(!ASK){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement('div'); el.id = 'askpanel'; el.className = 'askpanel'; document.body.appendChild(el); }
  const hi = S.lang === 'hi';
  // a live help call takes the panel over
  if(talkLive() && TALK.help){ el.innerHTML = `<div class="askhead">🐘 ${hi ? 'मुन्नी से बात' : 'Talking with Munni'}</div>${talkScreenHTML()}`; return; }
  const shown = ASK.lines.slice(0, ASK.i + 1).map((l, k) => `<div class="askline ${k === ASK.i && ASK.playing ? 'now' : ''}">${attr(l)}</div>`).join('');
  let tail = '';
  if(!ASK.playing){
    const why = !ASK.call ? '' : !TALK_URL ? '' : !S.talkMunni
      ? (hi ? 'मम्मी-पापा "मुन्नी से बात" चालू करें तो मुन्नी कॉल करके भी समझा सकती है।' : 'If a grown-up turns on Talking Munni, Munni can also call and explain.')
      : !S.online ? (hi ? 'इंटरनेट मिलने पर मुन्नी कॉल करके समझा सकती है।' : 'With the internet on, Munni can call you and explain.') : '';
    tail = `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn leaf" onclick="askClose()">✓ ${hi ? 'समझ गया!' : 'I get it!'}</button>
        <button class="btn ghost" onclick="askPlay(0)">🔁 ${hi ? 'फिर से सुनाओ' : 'Say it again'}</button>
      </div>
      ${askCallReady() ? `<button class="btn" style="margin-top:8px" onclick="askCall()">📞 ${hi ? 'अब भी समझ नहीं आया? मुन्नी को बुलाओ' : 'Still stuck? Talk to Munni'}</button>` : ''}
      ${why ? `<div class="muted" style="font-size:12.5px;margin-top:6px">${why}</div>` : ''}
      ${ASK.msg ? `<div class="muted" style="font-size:12.5px;margin-top:6px">${attr(ASK.msg)}</div>` : ''}`;
  }
  el.innerHTML = `<div class="askhead">🐘 ${hi ? 'चलो साथ में करते हैं' : "Let's do it together"}</div>${shown}${tail}`;
}

function askClose(){
  if(talkLive() && TALK.help) talkStop();
  try{ speechSynthesis.cancel(); }catch(e){}
  ASK = null;
  askPanel(); askFab();
}

/* Still stuck: Munni calls, inside the app. */
function askCall(){
  if(!askCallReady()) return;
  try{ speechSynthesis.cancel(); }catch(e){}
  if(typeof stopListening === 'function') stopListening();   // the Reading Tree's microphone is the call's now
  talkHelp(ASK.call, msg => { if(ASK){ ASK.msg = msg; askPanel(); } });
  askPanel();
}

/* A screen change takes the help (and a help call) with it. */
function askFollow(screen){
  if(ASK && screen !== ASK.where) askClose();
}
