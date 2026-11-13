/* ==================================================================
   TEACH MUNNI — the screen (VIEWS.teach), and where it shows elsewhere

   Elephants never forget. Munni does, on purpose: after a lesson she
   forgets its aims and the child teaches them back, out loud. The engine
   is core/teachback.js; this draws it and listens.

   How Munni hears an explanation:
   · Online, under the terms a grown-up accepted (v3 — ui/cloud-read.js):
     the recording goes to the voice server, is written down by the same
     speech provider as the reading check (voice/speech.js: Gemini, Sarvam
     as backup), and Gemini says which points it covered, quoting the child
     (POST /teach/judge, api/teachback.mjs).
     Nothing is kept there. The quote is checked again here.
   · Otherwise: the phone's own on-device recognizer, or typing, and the
     offline judge (teachRubric()). It never waits on the network: no
     answer in time → the honest message, and the child can type.

   The aim chips turning green is the point of the screen: the child sees
   each idea land. Never "wrong" — a point that won't come after two
   hints is "we'll figure it out together later", and comes back in the
   Story Fire as "Munni forgot again".

   Also here: the button at the end of a lesson, the "Munni forgot again"
   card, the parent's "How … explains" and the teacher's results per aim.
   ================================================================== */
let TEACH = null;   // { s: session, sum: summary once finished, busy, msg, typing }

const TMR = o => o ? (S.lang === 'hi' ? o.hi : o.en) : '';
const TMW = o => attr(TMR(o));

function teachTermsOk(){ return !!(TALK_URL && S.voiceTerms && S.voiceTerms.v >= VOICE_TERMS_V); }   // v3: Gemini hears it (ui/cloud-read.js)
function teachCloudReady(){
  return teachTermsOk() && S.online && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

/* ---------- starting ---------- */
function teachStart(unit, again){
  const s = unit && teachBegin(unit, { again: !!again });
  if(!s){ log(0, 'Teach Munni · nothing to teach in this unit for this child today'); return; }
  TEACH = { s, sum: null, busy: null, msg: '', typing: false };
  log(0, `Teach Munni · "${unit.title.en}" · ${s.items.length} point(s)${again ? ' (again — only the ones still to teach)' : ''}: ${s.items.map(x => x.aim.id + (x.fix ? ` [Munni's ${x.fix.mistake} on ${x.fix.text}${x.fix.habit ? ', this child’s habit' : ''}]` : '')).join(', ')}`);
  go('teach');
  teachSay();
}
/* the lesson just finished → its unit */
function teachFromLesson(){
  const les = S.lesson && S.lesson.data;
  const unit = teachUnitFor(les);
  if(!unit) return;
  if(!S.lesson.counted) lesNext();          // the lesson counts as finished first
  S.lesson = null;
  teachStart(unit);
}
/* "Munni forgot again": the points still to teach, for one unit */
function teachAgain(id){
  const builtin = teachUnitBuiltin(id);
  const les = !builtin && schoolLessons().find(l => l.id === id);
  teachStart(builtin || (les && teachUnitFor(les)), true);
}

/* ---------- Munni speaks ---------- */
function teachSay(){
  if(!TEACH) return;
  speak(TMR(TEACH.s.line));
}

/* ---------- the child answers ---------- */
function teachChoose(k){
  if(!TEACH || TEACH.busy) return;
  const it = teachItem(TEACH.s);
  const out = teachPick(TEACH.s, k);
  if(!out) return;
  log(0, `Teach Munni · Munni's sum ${it.fix.text}: the child picked ${it.fix.opts[k]} — ${out === 'caught' ? 'caught her mistake' : out === 'again' ? "agreed with Munni's answer; a nudge" : 'still not caught — later'}`);
  if(out === 'caught' && typeof sfxChime === 'function') sfxChime();
  teachAfter();
}

function teachMic(){
  if(!TEACH || TEACH.busy || TEACH.sum) return;
  const it = teachItem(TEACH.s);
  if(!it || (it.fix && it.phase !== 'why')) return;
  TEACH.busy = 'listen'; TEACH.msg = '';
  render();
  if(teachCloudReady()){
    ACTIVE_LISTEN = cloudListen(d => { ACTIVE_LISTEN = null; teachJudged(d); },
      err => { ACTIVE_LISTEN = null; teachNoHear(err); },
      { maxMs: 20000, pauseMs: 2200, timeout: 14000, url: TALK_URL + '/teach/judge', full: true, body: teachPayload() });
  } else if(deviceListenAllowed()){
    ACTIVE_LISTEN = listen(alts => { ACTIVE_LISTEN = null; teachText((alts[0] || {}).transcript || '', 'the phone'); },
      err => { ACTIVE_LISTEN = null; teachNoHear(err); });
  } else teachNoHear('no-terms');
}
function teachNoHear(err){
  if(!TEACH) return;
  TEACH.busy = null;
  TEACH.typing = true;
  TEACH.msg = err === 'no-speech' ? (S.lang === 'hi' ? 'कुछ सुनाई नहीं दिया। फिर से बोलो, या लिखकर बताओ।' : "I didn't hear anything. Try again, or type it.")
    : (typeof micReason === 'function' ? micReason(err) : '') || (S.lang === 'hi' ? 'आज बोलकर नहीं हो पाया — लिखकर बताओ।' : "Talking didn't work just now — type it instead.");
  render();
}

/* What the phone sends the judge: the points still to teach, nothing about the child. */
function teachPayload(){
  const s = TEACH.s, it = teachItem(s);
  return {
    ask: it.aim.id, ages: band().ages,
    aims: s.items.filter(x => x.state === 'todo' && (!x.fix || x === it)).slice(0, 5).map(x => x.fix
      ? { id: x.aim.id, kind: 'fix', point: x.aim.point, mistake: x.fix.mistake, munni: x.fix.act.en, said: teachSaid(x, 'en') + ' ' + teachSaid(x, 'hi') }
      : { id: x.aim.id, kind: 'explain', point: x.aim.point, forget: x.aim.forget, ideas: x.aim.ideas.map(i => ({ en: i.en, hi: i.hi })),
          said: teachSaid(x, 'en') + ' ' + teachSaid(x, 'hi') })
  };
}

/* Typed (or the phone's recognizer): the judge too, when the terms allow it. */
async function teachType(){
  if(!TEACH || TEACH.busy) return;
  const el = document.getElementById('teachtxt');
  const text = String(el && el.value || '').trim();
  if(!text) return;
  teachText(text, 'typing');
}
async function teachText(text, how){
  if(!TEACH) return;
  if(teachTermsOk() && S.online && text.trim()){
    TEACH.busy = 'judge'; render();
    try{
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = setTimeout(() => ctl && ctl.abort(), 9000);
      const res = await fetch(TALK_URL + '/teach/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
        body: JSON.stringify({ consent: true, lang: S.lang, transcript: text, ...teachPayload() }) });
      clearTimeout(to);
      const d = await res.json().catch(() => ({}));
      if(res.ok) return teachJudged({ ...d, transcript: d.transcript || text, provider: how });
    }catch(e){ /* the offline judge below */ }
  }
  teachJudged({ transcript: text, judge: null, provider: how });
}

function teachJudged(d){
  if(!TEACH) return;
  TEACH.busy = null;
  const s = TEACH.s, it = teachItem(s);
  if(!it) return;
  const text = String(d.transcript || '');
  const verdicts = d.judge ? teachApplyJudge(d.judge, text, s.items) : null;
  const how = verdicts ? `Gemini${d.model ? ' (' + d.model + ')' : ''}, each credit checked against the child's own words` : "Takhti's own rubric, on the phone";
  const out = teachHeard(s, text, verdicts, verdicts ? 'gemini' : 'rubric');
  log(verdicts ? 2 : 0, `Teach Munni · "${it.aim.short.en}" · heard by ${d.provider || 'the phone'} · judged by ${how} → ${out}${d.judge ? '' : ''}`);
  if(out === 'unsure' && it.unsure >= 2) TEACH.typing = true;
  if(out === 'covered' && typeof sfxChime === 'function') sfxChime();
  teachAfter();
}

function teachAfter(){
  const s = TEACH.s;
  if(s.done && !TEACH.sum){
    TEACH.sum = teachFinish(s);
    log(0, `Teach Munni · finished · ${TEACH.sum.covered}/${TEACH.sum.m} taught (${TEACH.sum.unaided} without a hint)${TEACH.sum.gaps.length ? ` · Munni will forget again: ${TEACH.sum.gaps.join(', ')}` : ''}`);
    if(TEACH.sum.covered === TEACH.sum.m && typeof triggerConfetti === 'function') triggerConfetti(1600);
  }
  TEACH.msg = '';
  render();
  teachSay();
}

/* A gap → taught again this child's way (core/mind.js), then Munni forgets again. */
function teachRemedy(){
  if(!TEACH || !TEACH.sum) return;
  const s = TEACH.s, gap = s.items.find(x => x.state !== 'covered');
  const skill = gap && (gap.aim.skill || s.unit.skill);
  TEACH = null;
  if(skill && mindDomain(skill) === 'math'){ mindGoWay(skill, mindChoose(skill, mindMathWays(skill))); return; }
  if(skill && mindDomain(skill) === 'shape'){ mindGoWay(skill, mindChoose(skill, typeof planBuiltin === 'function' && planBuiltin(skill) ? ['show', 'story'] : ['story'])); return; }
  if(s.unit.lessonId){ go('lessons'); startLesson(s.unit.lessonId); return; }
  go('lessons');
}
function teachLeave(){
  if(TEACH && !TEACH.sum && TEACH.s.items.some(x => x.state !== 'todo')) TEACH.sum = teachFinish(TEACH.s);
  TEACH = null;
  go('lessons');
}
/* leaving the screen any other way: what was taught still counts */
function teachFollow(screen){
  if(screen === 'teach' || !TEACH) return;
  if(!TEACH.sum && TEACH.s.items.some(x => x.state !== 'todo')) teachFinish(TEACH.s);
  TEACH = null;
}

/* ---------- the screen ---------- */
function teachChipsHTML(items, cur){
  return `<div class="teachchips">${items.map(x => `<span class="teachchip is-${x.state}${x === cur ? ' is-now' : ''}">${x.state === 'covered' ? '✓ ' : x.state === 'gap' || x.state === 'partly' ? '… ' : ''}${TMW(x.aim.short)}</span>`).join('')}</div>`;
}
function teachHTML(){
  if(!TEACH) return `<button class="back" onclick="go('lessons')">← ${t('back')}</button>`;
  const hi = S.lang === 'hi', s = TEACH.s, it = teachItem(s), sum = TEACH.sum;
  const listening = TEACH.busy === 'listen', judging = TEACH.busy === 'judge';
  const pick = it && it.fix && it.phase === 'pick';
  const slate = it && it.fix ? `<div class="teachslate"><span>${attr(it.fix.text)} = <b>${it.fix.wrong}</b></span>${it.phase === 'pick' ? ' ?' : ' ✗'}</div>` : '';
  return `
  <button class="back" onclick="teachLeave()">← ${t('back')}</button>
  <div class="display" style="font-size:21px;margin:4px 0">🐘 ${hi ? 'मुन्नी को सिखाओ' : 'Teach Munni'}</div>
  <div class="muted">${TMW(s.unit.title)}</div>
  ${teachChipsHTML(s.items, it)}
  <div class="teachstage">
    <div class="teachmunni${sum ? '' : ' is-puzzled'}">${munniSmall()}<span class="teachq">${sum ? '★' : '?'}</span></div>
    <div class="teachbubble">${TMW(s.line)}</div>
    ${slate}
  </div>
  ${sum ? teachSummaryHTML(sum) : pick ? `
    <div class="opts teachopts" style="margin-top:12px">${it.fix.opts.map((o, k) => `<button class="opt" onclick="teachChoose(${k})">${o}</button>`).join('')}</div>
    <div class="muted" style="font-size:12.5px;margin-top:6px">${hi ? 'सही जवाब छुओ।' : 'Tap the right answer.'}</div>` : `
    <button class="btn teachmic${listening ? ' live' : ''}" onclick="teachMic()" ${TEACH.busy ? 'disabled' : ''}>${listening
      ? (hi ? '🎙️ सुन रही हूँ… बोलते रहो' : '🎙️ Listening… keep talking')
      : judging ? (hi ? '🤔 सोच रही हूँ…' : '🤔 Thinking…')
      : (hi ? '🎤 छुओ और समझाओ' : '🎤 Tap and explain')}</button>
    ${TEACH.msg ? `<div class="retry" style="font-size:12.5px;margin-top:6px">${attr(TEACH.msg)}</div>` : ''}
    ${TEACH.typing ? `<div class="row" style="gap:6px;margin-top:8px">
      <input class="input" id="teachtxt" placeholder="${hi ? 'यहाँ लिखकर समझाओ' : 'Or type it here'}" autocomplete="off">
      <button class="btn ghost" style="width:auto;padding:8px 14px" onclick="teachType()">${hi ? 'बताओ' : 'Tell'}</button></div>`
      : `<button class="btn ghost teachtype" onclick="TEACH.typing=true;render()">${hi ? 'या लिखकर बताओ' : 'or type it'}</button>`}`}
  <div class="row" style="margin-top:10px;gap:6px"><button class="btn ghost" onclick="teachSay()">🔊 ${t('hear')}</button></div>`;
}
function teachSummaryHTML(sum){
  const hi = S.lang === 'hi', gaps = TEACH.s.items.filter(x => x.state !== 'covered');
  return `<div class="card" style="margin-top:12px;padding:12px">
    <b>${hi ? `तुमने ${sum.m} में से ${sum.covered} बातें सिखाईं` : `You taught ${sum.covered} of ${sum.m}`}</b>${sum.unaided ? ` <span class="muted" style="font-size:12.5px">· ${hi ? `${sum.unaided} बिना किसी इशारे के` : `${sum.unaided} without a hint`}</span>` : ''}
    ${gaps.length ? `<div style="font-size:13px;margin-top:6px">${hi ? 'मुन्नी बाद में फिर पूछेगी' : 'Munni will ask again later'}: ${gaps.map(x => TMW(x.aim.short)).join(', ')}</div>
      <button class="btn leaf" style="margin-top:10px" onclick="teachRemedy()">✨ ${hi ? 'चलो इसे फिर से सीखें' : "Let's learn it again"}</button>` : ''}
    <button class="btn ${gaps.length ? 'ghost' : 'leaf'}" style="margin-top:8px" onclick="teachLeave()">${hi ? 'हो गया ⭐' : 'Done ⭐'}</button>
  </div>`;
}

/* ---------- elsewhere ---------- */
/* at the end of a lesson: the button */
function teachLessonButtonHTML(les){
  if(!teachUnitFor(les)) return '';
  return `<button class="btn leaf" onclick="teachFromLesson()">🐘 ${S.lang === 'hi' ? 'मुन्नी को सिखाओ' : 'Teach Munni'}</button>`;
}
/* the Story Fire: what Munni has forgotten again */
function teachAgainHTML(){
  if(band().id === 'pre') return '';
  const list = teachAgainList().filter(u => teachUnitBuiltin(u.id) || schoolLessons().some(l => l.id === u.id)).slice(0, 3);
  if(!list.length) return '';
  const hi = S.lang === 'hi';
  return `<div class="card teachagain" style="margin:10px 0;padding:12px">
    <div class="kicker2">🐘 ${hi ? 'मुन्नी फिर भूल गई!' : 'MUNNI FORGOT AGAIN!'}</div>
    ${list.map(u => `<button class="lescard" style="margin-top:8px" onclick="teachAgain('${attr(u.id)}')">
      <span class="lesic">🐘</span><span><b>${TMW(u.title)}</b><small>${hi ? `${u.gaps.length} बात फिर से सिखाओ` : `teach her ${u.gaps.length} more`}</small></span><span class="lesgo">▶</span></button>`).join('')}
  </div>`;
}

/* the parent dashboard: how this child explains — their own trend, never compared */
function teachParentHTML(){
  const hi = S.lang === 'hi', n = attr(S.name || ''), t = teachOf(), log5 = t.log.slice(-5).reverse();
  const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
  if(!t.log.length) return `<div class="metric" style="display:block"><b>${hi ? `${n} कैसे समझाते हैं` : `How ${n} explains`}</b>
    <div style="font-size:12.5px;opacity:.75;margin-top:4px">${hi ? `अभी कुछ नहीं — किसी पाठ के बाद ${n} मुन्नी को सिखा सकते हैं ("मुन्नी को सिखाओ")।` : `Nothing yet — after a lesson, ${n} can teach Munni ("Teach Munni").`}</div></div>`;
  const all = t.log, sum = k => all.reduce((a, x) => a + (x[k] || 0), 0);
  const own = all.filter(x => x.own != null), key = all.filter(x => x.key != null);
  const avg = (xs, k) => xs.length ? xs.reduce((a, x) => a + x[k], 0) / xs.length : null;
  const later = teachAgainList();
  return `<div class="metric" style="display:block"><b>${hi ? `${n} कैसे समझाते हैं` : `How ${n} explains`}</b>
    <div style="font-size:12.5px;margin-top:4px">${hi
      ? `${all.length} बार मुन्नी को सिखाया · ${sum('m')} में से ${sum('covered')} बातें समझाईं, ${sum('unaided')} बिना इशारे के`
      : `Taught Munni ${all.length} time${all.length === 1 ? '' : 's'} · explained ${sum('covered')} of ${sum('m')} points, ${sum('unaided')} without a hint`}</div>
    <div style="font-size:12.5px;margin-top:2px">${hi
      ? `अपने शब्दों में: ${pct(avg(own, 'own'))} · गणित के शब्द इस्तेमाल किए: ${pct(avg(key, 'key'))}`
      : `In their own words: ${pct(avg(own, 'own'))} · used the lesson's words (borrow, carry, tens…): ${pct(avg(key, 'key'))}`}</div>
    ${log5.map(x => `<div style="font-size:12px;opacity:.8;margin-top:3px">${String(x.at).slice(0, 10)} · ${TMW(x.title)} — ${x.covered}/${x.m}${x.again ? (hi ? ' (दोबारा)' : ' (again)') : ''}</div>`).join('')}
    ${later.length ? `<div style="font-size:12.5px;margin-top:6px">${hi ? 'मुन्नी फिर पूछेगी' : 'Munni will ask again'}: ${later.map(u => TMW(u.title)).join(', ')}</div>` : ''}
    <div style="font-size:11.5px;opacity:.6;margin-top:6px">${hi ? 'यह सिर्फ़ इसी बच्चे की अपनी तरक़्क़ी है — किसी और से तुलना नहीं।' : "This is your child's own progress only — never compared with anyone."}</div></div>`;
}

/* the teacher view: which points the class could explain (from the class mirror) */
function teachAimLabel(id, code){
  for(const u of Object.values(TEACH_UNITS)) { const a = u.aims.find(x => x.id === id); if(a) return a.point; }
  for(const l of (typeof sylApproved === 'function' ? sylApproved(code) : [])) { const a = (l.aims || []).find(x => x.id === id); if(a) return a.point; }
  return { en: id, hi: id };
}
function teachTeacherHTML(code){
  const all = readClassShared(code), hi = S.lang === 'hi', rows = {};
  for(const [id, c] of Object.entries(all)){
    if(id.startsWith('_') || !c || !c.explained) continue;
    for(const [aim, v] of Object.entries(c.explained)){ const r = rows[aim] = rows[aim] || { c: 0, p: 0, g: 0 }; if(r[v] != null) r[v]++; }
  }
  const list = Object.entries(rows).sort((x, y) => (y[1].g + y[1].p) / (y[1].c + y[1].p + y[1].g) - (x[1].g + x[1].p) / (x[1].c + x[1].p + x[1].g)).slice(0, 12);
  if(!list.length) return '';
  return `<div class="paper" style="margin-top:12px">
    <div class="kicker2">🐘 ${hi ? 'बच्चे क्या समझा पाए ("मुन्नी को सिखाओ")' : 'WHAT THE CLASS COULD EXPLAIN (TEACH MUNNI)'}</div>
    <div style="font-size:12.5px;opacity:.75;margin-bottom:6px">${hi ? 'हर बात के लिए: कितने बच्चों ने अपने शब्दों में समझाई, कितनों ने थोड़ी, कितनों के लिए मुन्नी फिर पूछेगी।' : 'For each point: how many children explained it in their own words, partly, or still to come.'}</div>
    ${list.map(([aim, r]) => { const tot = r.c + r.p + r.g; return `<div class="teachrow">
      <div style="font-size:13px">${TMW(teachAimLabel(aim, code))}</div>
      <div class="teachbar"><i class="c" style="width:${r.c / tot * 100}%"></i><i class="p" style="width:${r.p / tot * 100}%"></i><i class="g" style="width:${r.g / tot * 100}%"></i></div>
      <div style="font-size:11.5px;opacity:.75">${hi ? `${r.c} ने समझाई · ${r.p} ने थोड़ी · ${r.g} बाक़ी` : `${r.c} explained · ${r.p} partly · ${r.g} still to come`}</div></div>`; }).join('')}
  </div>`;
}

if(typeof VIEWS !== 'undefined') VIEWS.teach = teachHTML;
