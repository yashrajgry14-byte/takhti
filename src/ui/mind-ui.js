/* ==================================================================
   MIND, ON SCREEN — where core/mind.js meets the child and the parent

   · Counting Stones: a missed sum is taught the way that works for this
     child (objects, steps, or an invitation to a story or a cartoon), and
     practice leans towards the topic Munni is working on.
   · The Reading Tree: each line is offered the child's way — Munni reads
     it first, or the hard words are shown in pieces, or the child goes
     first on their own.
   · The map: "Munni's idea" — after a low school mark or a change of plan,
     one card that takes the child straight to the topic, taught their way.
   · The parent dashboard: what works for this child, what Munni changed
     and why, and the school marks (a parent types them; a class teacher's
     test arrives through the learning circle).
   ================================================================== */
const MW = k => (S.lang === 'hi' ? k.hi : k.en);

const readSkill = () => 'read' + Math.max(1, Math.min(6, S.levels.read || 1));
const mindSkillName = id => { const s = skillById(id); return s ? (S.lang === 'hi' ? s.hi : s.en) : id; };

/* the bank lessons and the cartoon this skill has, if any */
function mindStoryFor(skill){
  const l = (typeof lessonsForSkill === 'function' ? lessonsForSkill(skill, S) : []).find(x => !x.screen && x.id);
  return l ? l.id : null;
}
function mindHasCartoon(skill){
  return typeof getVideoCatalog === 'function' && getVideoCatalog(S).some(v => v.skillId === skill);
}
function mindMathWays(skill){
  const w = ['show', 'steps'];
  if(mindStoryFor(skill)) w.push('story');
  if(mindHasCartoon(skill)) w.push('cartoon');
  return w;
}

/* ---------- Counting Stones ---------- */
/* The next practice sum: about half the time, the topic Munni is working
   on (a low school mark, a changed plan) — otherwise the usual level. */
function mindPracticeProblem(){
  const nx = mindNext();
  if(nx && mindDomain(nx.skill) === 'math' && skillHasProblem(nx.skill) && mindRand() < 0.5){
    const sp = skillProblem(nx.skill, Math.floor(mindRand() * 1e9));
    if(sp && sp.c == null) return { a: sp.a, b: sp.b, op: sp.op, ans: sp.ans, opts: sp.opts.map(Number), focus: nx.skill };
  }
  return genProblem(S.levels.math);
}

/* A missed sum: teach it this child's way. */
function mindTeachMath(p){
  const skill = skillOfProblem(p);
  const way = skill ? mindChoose(skill, mindMathWays(skill)) : 'show';
  if(way === 'steps' && typeof askTeach === 'function'){
    mindTaught(skill, 'steps');
    setTimeout(() => askTeach(p), 450);
    return;
  }
  if(way === 'story' || way === 'cartoon'){
    S.ctx.idea = { skill, way };
    render();
    speak(S.lang === 'hi' ? 'मुन्नी के पास एक आइडिया है!' : 'Munni has an idea!');
    return;
  }
  setTimeout(playMath, 500);           // 'show' (and the default): watch it happen with objects
}
function mindIdeaHTML(){
  const i = S.ctx.idea; if(!i) return '';
  const hi = S.lang === 'hi';
  const what = i.way === 'story' ? (hi ? 'चलो इसे एक कहानी से सीखें!' : "Let's learn this with a story!")
                                 : (hi ? 'चलो इसे एक कार्टून से सीखें!' : "Let's learn this with a cartoon!");
  return `<button class="btn leaf" style="margin-top:10px" onclick="mindGoWay('${i.skill}','${i.way}')">✨ ${what}</button>`;
}
function mindGoWay(skill, way){
  if(way === 'story'){ const id = mindStoryFor(skill); if(id){ go('lessons'); startLesson(id); return; } }
  if(way === 'cartoon' && mindHasCartoon(skill)){ go('theater'); startCartoonVideo(skill); return; }
  if(mindDomain(skill) === 'read'){ go('read'); return; }
  S.mindFocus = skill; go('math');
}

/* ---------- the Reading Tree ---------- */
function mindReadWay(){
  if(!S.ctx.sentence) return null;
  if(!S.ctx.readWay){
    const sk = readSkill();
    S.ctx.readWay = mindChoose(sk);
    mindTaught(sk, S.ctx.readWay);
  }
  return S.ctx.readWay;
}
/* hard words in pieces: the ones the child missed, else the two longest */
function mindChunksHTML(){
  if(mindReadWay() !== 'chunks' || typeof wordChunks !== 'function') return '';
  const lang = /[ऀ-ॿ]/.test(S.ctx.sentence) ? 'hi' : 'en';
  const words = S.ctx.sentence.replace(/[.,!?।"“”]/g, ' ').trim().split(/\s+/);
  const len = w => typeof graphemes === 'function' ? graphemes(w).length : w.length;
  const pick = (S.ctx.missed && S.ctx.missed.length ? S.ctx.missed.map(w => w.replace(/[.,!?।]/g, '')) : words.slice().sort((x, y) => len(y) - len(x)))
    .filter((w, i, a) => len(w) >= 3 && a.indexOf(w) === i).slice(0, 2);
  if(!pick.length) return '';
  return `<div class="mindchunks">${pick.map(w => `<button class="chip" data-say="${attr(w)}" onclick="sayEl(this)">${wordChunks(w, lang).map(attr).join('<i>·</i>')}</button>`).join(' ')}</div>`;
}
/* 'model': Munni reads the line first, once, when it appears */
function mindReadAfter(){
  if(S.screen !== 'read' || mindReadWay() !== 'model' || S.ctx.modelled) return;
  S.ctx.modelled = true;
  setTimeout(() => { if(S.screen === 'read' && S.ctx.readWay === 'model') speak(S.ctx.sentence); }, 400);
}
AFTER.read = mindReadAfter;

/* ---------- the map ---------- */
function mindMapHTML(){
  const nx = mindNext();
  if(!nx) return '';
  const dom = mindDomain(nx.skill);
  const way = dom === 'math' ? mindChoose(nx.skill, mindMathWays(nx.skill)) : mindChoose(nx.skill);
  const hi = S.lang === 'hi';
  return `<div class="card mindcard" style="margin:8px 0">
    <div style="font-size:13px">✨ ${hi ? 'मुन्नी का आइडिया' : "Munni's idea"}: <b>${attr(mindSkillName(nx.skill))}</b> — ${hi ? `आज इसे ${attr(MW(WAYS[dom][way]))} सीखेंगे` : `let's learn it today, ${attr(MW(WAYS[dom][way]))}`}</div>
    <button class="btn" style="margin-top:8px" onclick="mindGoWay('${nx.skill}','${way}')">${hi ? 'चलो!' : "Let's go!"} →</button></div>`;
}

/* ---------- the parent dashboard ---------- */
const MIND_TOPICS = ['add10', 'sub10', 'add2', 'carry', 'sub2', 'borrow', 'tables', 'mult2x1', 'divshare', 'bodmas'];
function mindParentHTML(){
  const hi = S.lang === 'hi', n = attr(S.name || '');
  const m = mindOf();
  const best = ['math', 'read'].map(d => [d, mindBest(d)]).filter(([, b]) => b);
  const plans = Object.entries(m.plan).filter(([sk]) => mindDomain(sk)).slice(0, 6);
  const fmtDate = iso => String(iso || '').slice(0, 10);
  const subj = d => d === 'math' ? (hi ? 'गणित' : 'Maths') : (hi ? 'पढ़ना' : 'Reading');
  const topics = MIND_TOPICS.filter(id => skillById(id)).concat(['read1', 'read2', 'read3', 'read4', 'read5', 'read6']);
  return `<div class="kicker2" style="margin-top:14px">${hi ? `${n} कैसे सीखते हैं` : `HOW ${n.toUpperCase()} LEARNS`}</div>
  <div style="font-size:12.5px;opacity:.75;line-height:1.5">${hi
    ? `तख़्ती हर विषय को अलग-अलग तरीक़ों से सिखाकर देखती है और वही तरीक़ा रखती है जिससे ${n} सच में सीखते हैं — अंदाज़े से नहीं, बाद में ${n} ख़ुद कैसा करते हैं उससे। कोई तरीक़ा काम न करे तो मुन्नी बदल देती है। यह सब इसी फ़ोन पर रहता है।`
    : `Takhti tries different ways of teaching each topic and keeps the one that works for ${n} — judged by how ${n} does afterwards on their own, not guessed. When a way isn't working, Munni changes it. All of this stays on this phone.`}</div>
  ${best.map(([d, b]) => `<div class="metric"><div><b>${subj(d)}</b><div style="font-size:12.5px;opacity:.75">${hi ? 'सबसे अच्छा' : 'Works best'}: ${attr(MW(WAYS[d][b.way]))}</div></div><div style="text-align:right;font-size:12.5px">${hi ? `${b.n} में से ${b.a} बार` : `${b.a} of ${b.n} times`}<div style="opacity:.65">${hi ? 'बात बनी' : 'it stuck'}</div></div></div>`).join('')}
  ${!best.length ? `<div class="muted" style="font-size:12.5px">${hi ? `अभी देख रहे हैं कि ${n} किस तरह सबसे अच्छा सीखते हैं।` : `Still finding out which ways work best for ${n}.`}</div>` : ''}
  ${plans.length ? `<div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'अभी हर विषय ऐसे सिखा रहे हैं' : 'How each topic is taught now'}</div>
    ${plans.map(([sk, p]) => `<div style="font-size:12.5px">${attr(mindSkillName(sk))}: ${attr(MW(WAYS[mindDomain(sk)][p.way]))}</div>`).join('')}` : ''}
  ${m.changes.length ? `<div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'मुन्नी ने क्या बदला' : 'What Munni changed'}</div>
    ${m.changes.slice(0, 4).map(c => `<div style="font-size:12.5px">${fmtDate(c.at)} · ${attr(mindSkillName(c.skill))}: ${c.from ? attr(MW(WAYS[mindDomain(c.skill)][c.from])) + ' → ' : ''}${attr(MW(WAYS[mindDomain(c.skill)][c.to]))} <span style="opacity:.7">(${attr(MW(c.why))})</span></div>`).join('')}` : ''}
  <div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'स्कूल के नंबर' : 'School marks'}</div>
  ${(S.assessments || []).slice(0, 5).map(a => `<div style="font-size:12.5px">${fmtDate(a.at)} · ${attr(mindSkillName(a.skill))}: <b>${a.got}/${a.of}</b> <span style="opacity:.7">${a.by === 'parent' ? '' : '(' + attr(a.by) + ')'}</span></div>`).join('')}
  <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
    <select id="mkSkill" style="flex:2">${topics.map(id => `<option value="${id}">${attr(mindSkillName(id))}</option>`).join('')}</select>
    <input id="mkGot" type="number" min="0" placeholder="${hi ? 'मिले' : 'Got'}" style="width:64px">
    <input id="mkOf" type="number" min="1" placeholder="${hi ? 'में से' : 'Out of'}" style="width:64px">
    <button class="stepbtn" style="width:auto;padding:0 10px" onclick="mindSaveMark()">${hi ? 'जोड़ें' : 'Add'}</button></div>
  ${S.ctx.mindMsg ? `<div class="muted" style="font-size:12.5px">${attr(S.ctx.mindMsg)}</div>` : ''}`;
}
function mindSaveMark(){
  const hi = S.lang === 'hi';
  const sk = $('mkSkill') && $('mkSkill').value, got = Number($('mkGot') && $('mkGot').value), of = Number($('mkOf') && $('mkOf').value);
  if(!sk || !(of > 0) || !(got >= 0) || got > of || !Number.isFinite(got)){ S.ctx.mindMsg = hi ? 'नंबर ठीक से लिखें (जैसे 7 में से 10)।' : 'Please write the marks, like 7 out of 10.'; return render(); }
  mindAssessment({ skill: sk, got, of, by: 'parent' });
  const low = got / of < 0.5;
  S.ctx.mindMsg = low ? (hi ? `धन्यवाद! मुन्नी अब ${mindSkillName(sk)} पर ध्यान देगी और इसे नए तरीक़े से सिखाएगी।` : `Thank you! Munni will focus on ${mindSkillName(sk)} now and teach it a new way.`)
                      : (hi ? 'धन्यवाद! जोड़ दिया।' : 'Thank you! Added.');
  saveSoon();
  render();
}
