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
  // a mistake this child keeps making decides the explanation: straight at it (core/twin.js)
  if(S.ctx.tip && S.ctx.tip.habit && skill && typeof askTeach === 'function'){
    mindTaught(skill, 'steps');
    setTimeout(() => askTeach(p), 450);
    return;
  }
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
  ${S.ctx.mindMsg ? `<div class="muted" style="font-size:12.5px">${attr(S.ctx.mindMsg)}</div>` : ''}
  ${twinParentHTML()}`;
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

/* ==================================================================
   THE TWIN ON SCREEN (core/twin.js)
   ================================================================== */
const twinKeyMath = p => `math:${p.a}${p.op}${p.b}`;

/* After a wrong answer a known mistake explains: one line aimed at it. */
function twinTipHTML(p){
  const tp = S.ctx.tip; if(!tp || !p) return '';
  const hi = S.lang === 'hi', line = mistakeTip(tp.id, p, S.lang);
  if(!line) return '';
  const lead = tp.habit ? (hi ? 'मुन्नी ने देखा, यह पहले भी हुआ है: ' : 'Munni noticed this happened before: ') : '';
  return `<div class="twintip" data-say="${attr(line)}" onclick="sayEl(this)">💡 ${attr(lead + line)}</div>`;
}

/* After a slip in reading or writing: one line of help, and the letters
   to hear side by side (core/lang-mistakes.js). */
function twinSlipHTML(){
  const m = S.ctx.slip; if(!m) return '';
  const hi = S.lang === 'hi', h = twinHabit(S.screen === 'read' ? readSkill() : 'write' + S.levels.write);
  const line = langTip(m, S.lang, m.glyph);
  if(!line) return '';
  const lead = h && h.id === m.id ? (hi ? 'मुन्नी ने देखा, यह पहले भी हुआ है: ' : 'Munni noticed this happened before: ') : '';
  const chips = langLetters(m).map(x => `<button class="chip" data-say="${attr(x)}" onclick="sayEl(this)">🔊 ${attr(x)}</button>`).join(' ');
  return `<div class="twintip" data-say="${attr(line)}" onclick="sayEl(this)">💡 ${attr(lead + line)}</div>${chips ? `<div class="mindchunks">${chips}</div>` : ''}`;
}

/* Before reading: a letter this child keeps slipping on is in this line —
   a word of warning first (the habit decides what Munni says). */
function twinHeadsUpHTML(line){
  const h = twinHabit(readSkill());
  if(!h || !h.pair || !h.pair[0] || !line.includes(h.pair[0])) return '';
  const hi = S.lang === 'hi', x = h.pair[0], y = h.pair[1];
  const say = hi ? `इस पंक्ति में ${x} है${y ? ` — ${y} नहीं` : ''}। ध्यान से पढ़ना!` : `This line has ${x}${y ? ` — not ${y}` : ''}. Read it carefully!`;
  return `<div class="twintip" data-say="${attr(say)}" onclick="sayEl(this)">👀 ${attr(say)}</div>`;
}

/* The next line to read: half the time, one with a letter this child
   keeps slipping on, so it gets practised. */
function twinPickLine(pool){
  const h = twinHabit(readSkill()), x = h && h.pair && h.pair[0];
  const withIt = x ? pool.filter(l => l.includes(x)) : [];
  const from = withIt.length && mindRand() < 0.5 ? withIt : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/* Story-lesson questions: the sum underneath, if there is one, and the skill. */
function twinLessonQ(les, i){
  const x = typeof explainLessonBeat === 'function' ? explainLessonBeat(les, i) : null;
  const p = x && x.op ? { a: x.a, b: x.b, op: x.op, c: x.c == null ? null : x.c } : null;
  // the skill it exercises: named, from its concept, from the sum itself — or,
  // for a lesson that names none, still guessed under its concept
  const skill = les.skillId || ((CONCEPT_SKILLS[les.concept] || []).find(id => mindDomain(id)) || (CONCEPT_SKILLS[les.concept] || [])[0])
    || (p ? skillOfProblem(p) : null) || (x && x.kind === 'count' ? 'count20' : null) || (les.concept ? 'concept:' + les.concept : null);
  return { skill, p };
}
function twinExpectLesson(les, i){
  const q = twinLessonQ(les, i), b = les.beats[i];
  if(!q.skill) return;
  const nums = (b.opts || []).map(Number);
  twinExpect(`lesson:${les.id}:${i}`, q.skill, q.p && nums.every(Number.isFinite) ? q.p : null, q.p && nums.every(Number.isFinite) ? nums : 1 / Math.max(2, (b.opts || []).length));
}
function twinAnswerLesson(les, i, k, ok, helped){
  const q = twinLessonQ(les, i), b = les.beats[i], given = Number((b.opts || [])[k]);
  twinCheck(`lesson:${les.id}:${i}`, given, ok, helped);
  if(!helped && q.skill && q.p && Number.isFinite(given)) twinAnswer(q.skill, q.p, given);
}

/* The parent dashboard, inside "How … learns": how well Munni knows how
   this child thinks — her guesses, what they know, what's fading, the
   mistakes she keeps seeing, in all three subjects. */
function twinParentHTML(){
  const hi = S.lang === 'hi', n = attr(S.name || '');
  const sm = twinSummary(), tw = twinOf();
  const nm = sk => attr(mindSkillName(sk));
  const sc = sm.score;
  const row = (title, body) => body ? `<div style="font-size:12.5px;margin-top:6px"><b>${title}</b> ${body}</div>` : '';
  const empty = !sm.knows.length && !sm.working.length && !sm.fading.length && !sm.habits.length;
  const label = id => { const l = twinLabel(id); return l ? attr(MW(l)).replace(/^./, x => x.toUpperCase()) : ''; };
  const found = Object.keys(tw.found);
  return `<div style="font-size:13px;font-weight:700;margin-top:12px">${hi ? `मुन्नी ${n} की सोच को कितना जानती है` : `How well Munni knows how ${n} thinks`}</div>
  <div style="font-size:12.5px;opacity:.75;line-height:1.5">${hi
    ? `सिर्फ़ ${n} के अपने जवाबों से, इसी फ़ोन पर। हर सवाल से पहले मुन्नी अंदाज़ा लगाती है कि ${n} क्या जवाब देंगे — ग़लत हो तो कौन-सा ग़लत। जितना सही अंदाज़ा, उतना अच्छा वह ${n} को समझती है।`
    : `Built only from ${n}'s own answers, on this phone. Before each question Munni guesses what ${n} will answer — and if it's a wrong one, which. The more often she's right, the better she understands how ${n} thinks.`}</div>
  ${sc && sc.late ? `<div class="metric"><div><b>${hi ? 'मुन्नी का अंदाज़ा' : "Munni's guesses"}</b><div style="font-size:12.5px;opacity:.75">${hi ? 'हाल में, गणित में ठीक वही जवाब' : 'lately, the exact answer to a sum'}</div></div>
     <div style="text-align:right"><b>${hi ? `${sc.late.of} में से ${sc.late.hit}` : `${sc.late.hit} of ${sc.late.of}`}</b>${sc.early ? `<div style="font-size:12px;opacity:.65">${hi ? `शुरू में ${sc.early.of} में से ${sc.early.hit}` : `at the start: ${sc.early.hit} of ${sc.early.of}`}</div>` : ''}</div></div>` : ''}
  ${sc && sc.rw && sc.rw.of ? `<div class="metric"><div><b>${hi ? 'सही होगा या नहीं' : 'Right or not'}</b><div style="font-size:12.5px;opacity:.75">${hi ? 'पढ़ना, लिखना, कहानियाँ, खेल और गणित' : 'reading, writing, stories, games and sums'}</div></div>
     <div style="text-align:right"><b>${hi ? `${sc.rw.of} में से ${sc.rw.hit}` : `${sc.rw.hit} of ${sc.rw.of}`}</b></div></div>` : ''}
  ${!sc ? `<div class="muted" style="font-size:12.5px">${hi ? `कुछ सवालों के बाद मुन्नी ${n} के जवाबों का अंदाज़ा लगाना शुरू करेगी।` : `After a few questions Munni starts guessing ${n}'s answers.`}</div>` : ''}
  ${row(hi ? 'अच्छे से आता है:' : 'Knows well:', sm.knows.slice(0, 5).map(nm).join(', '))}
  ${row(hi ? 'सीख रहे हैं:' : 'Getting there:', sm.working.slice(0, 4).map(w => `${nm(w.skill)} (${w.p}%)`).join(', '))}
  ${row(hi ? 'भूल रहे हैं — जल्दी दोहराएँ:' : 'Fading — practise soon:', sm.fading.slice(0, 3).map(f => `${nm(f.skill)} (${f.was}% → ${f.now}%)`).join(', '))}
  ${sm.habits.length ? `<div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'मुन्नी ने जो ग़लती बार-बार देखी' : 'A mistake Munni keeps seeing'}</div>
    ${sm.habits.slice(0, 4).map(h => `<div style="font-size:12.5px">${label(h.id)} — ${nm(h.skill)} <span style="opacity:.7">(${hi ? `हाल में ${h.n} बार` : `${h.n} times lately`})</span></div>`).join('')}
    <div style="font-size:12px;opacity:.7">${hi ? 'अगली बार मुन्नी ठीक इसी ग़लती पर मदद करेगी।' : 'Next time, Munni helps with exactly this mistake.'}</div>` : ''}
  ${found.length ? `<div style="font-size:12.5px;margin-top:6px"><b>${hi ? 'मुन्नी ने एक नई ग़लती पहचानी:' : 'A mistake Munni worked out herself:'}</b> ${found.slice(0, 2).map(label).join('; ')}</div>` : ''}
  ${empty ? `<div class="muted" style="font-size:12.5px">${hi ? `${n} जितना अभ्यास करेंगे, यह तस्वीर उतनी साफ़ होगी।` : `The more ${n} practises, the clearer this picture gets.`}</div>` : ''}`;
}
