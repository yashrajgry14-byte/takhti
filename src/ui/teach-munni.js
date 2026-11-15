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
   · A build with no voice server (the Netlify link): the words — typed,
     or written down by the phone's own recognizer, never a recording — go
     to the host's own judge (TEACH_URL → api/teachback.mjs, the same
     judgeCore() and quote check), with a signal and under the words terms
     a grown-up accepts here or on the parent page (TEACH_WORDS_TERMS).
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

/* No voice server: words only, to the host's judge, under their own terms.
   Only the words go — no recording, no name — so these are separate from
   the reading terms, and asked where they are needed: the first time a
   child teaches Munni with a signal, or on the parent page. The wording is
   for the lawyer, like the reading terms. */
const TEACH_WORDS_V = 1;
const TEACH_WORDS_TERMS = {
  en: n => `When ${n} teaches Munni back what a lesson was about (Teach Munni) and this phone has a signal, the words ${n} types — or the words this phone's own speech recognition writes down — go over the internet to Takhti's server and to Google's Gemini, which checks which of the lesson's points ${n} explained. Gemini must quote ${n}'s own words for every point it counts, and Takhti checks that quote again on this phone. Only the words go: Takhti sends no recording and no name. We use Google's paid service, so Google does not train its models on them. Nothing is kept on our server — not the words, not the result. Which points ${n} explained stays on this phone (and with the class, if you switch on class sync). Without a signal, or without this, the phone checks it by itself. You can withdraw this any time on the parent page.`,
  hi: n => `जब ${n} मुन्नी को किसी पाठ की बातें वापस सिखाते हैं (मुन्नी को सिखाओ) और फ़ोन में सिग्नल हो, तो ${n} जो शब्द लिखते हैं — या जो शब्द इस फ़ोन की अपनी बोली पहचान लिखती है — वे इंटरनेट से तख़्ती के सर्वर और Google के Gemini तक जाते हैं, जो जाँचता है कि ${n} ने पाठ की कौन-सी बातें समझाईं। हर गिनी गई बात के लिए Gemini को ${n} के अपने शब्द दिखाने होते हैं, और तख़्ती उन्हें इसी फ़ोन पर फिर जाँचती है। सिर्फ़ शब्द जाते हैं: तख़्ती न रिकॉर्डिंग भेजती है, न नाम। हम Google की पेड सेवा इस्तेमाल करते हैं, इसलिए Google इनसे अपने मॉडल नहीं सिखाता। हमारे सर्वर पर कुछ नहीं रखा जाता — न शब्द, न नतीजा। ${n} ने कौन-सी बातें समझाईं, वह इसी फ़ोन पर रहता है (और क्लास के साथ, अगर आप क्लास सिंक चालू करते हैं)। सिग्नल न हो, या इसके बिना, फ़ोन ख़ुद जाँचता है। माता-पिता वाले पेज पर इसे कभी भी वापस ले सकते हैं।`
};
function teachWordsOk(){ return !TALK_URL && !!(S.teachWords && S.teachWords.v >= TEACH_WORDS_V); }
/* Where the words go to be judged right now, or '' for the phone's own rubric. */
function teachJudgeUrl(){
  if(!S.online) return '';
  if(teachTermsOk()) return TALK_URL + '/teach/judge';
  if(teachWordsOk()) return TEACH_URL;
  return '';
}
function teachWordsAsk(){ return !TALK_URL && S.online && !teachWordsOk() && TEACH && !TEACH.wordsLater && !TEACH.sum; }
function teachWordsAccept(where){
  S.teachWords = { v: TEACH_WORDS_V, at: new Date().toISOString(), by: 'parent (' + (where || 'Teach Munni') + ')' };
  log(null, `Teach Munni words terms (v${TEACH_WORDS_V}) accepted by a grown-up for ${S.name || 'this child'} — with a signal, the words go to Gemini to be judged; no recording, nothing kept`);
  saveSoon(); render();
}
function teachWordsWithdraw(){
  S.teachWords = null; S.ctx.wordsAsk = false;
  log(null, 'Teach Munni words terms withdrawn by a parent — explanations are judged on this phone only');
  saveSoon(); render();
}
function teachWordsCardHTML(){
  const hi = S.lang === 'hi', n = attr(S.name || (hi ? 'आपका बच्चा' : 'your child'));
  return `<div class="card circlecard teachterms" style="text-align:left;margin:10px 0">
    <div class="kicker2">${hi ? 'बड़ों के लिए · शर्तें' : 'FOR A GROWN-UP · TERMS'}</div>
    <b style="display:block;margin:4px 0">${hi ? `Gemini को ${n} का समझाना जाँचने दें?` : `Let Gemini check what ${n} explains?`}</b>
    <div style="font-size:12.5px;line-height:1.5">${hi ? TEACH_WORDS_TERMS.hi(n) : TEACH_WORDS_TERMS.en(n)}</div>
    <details style="font-size:12px;opacity:.75;margin-top:6px"><summary>${hi ? 'In English' : 'हिंदी में'}</summary>${hi ? TEACH_WORDS_TERMS.en(n) : TEACH_WORDS_TERMS.hi(n)}</details>
    <button class="btn" style="margin-top:8px" onclick="teachWordsAccept()">${hi ? 'मैं माता-पिता/अभिभावक हूँ और सहमत हूँ' : "I'm the parent or guardian, and I agree"}</button>
    <button class="btn ghost" style="margin-top:6px" onclick="TEACH.wordsLater=true;render()">${hi ? 'अभी नहीं — फ़ोन पर ही जाँचो' : 'Not now — check it on this phone'}</button>
  </div>`;
}
/* The parent page, in a build with no voice server: what was agreed, and the right to withdraw it. */
function teachWordsParentHTML(){
  if(TALK_URL) return '';
  const hi = S.lang === 'hi', n = attr(S.name || ''), t = S.teachWords;
  return `<div class="metric" style="display:block">
    <b>${hi ? 'मुन्नी को सिखाओ: Gemini की जाँच' : 'Teach Munni: checked by Gemini'}</b>
    <div style="font-size:12.5px;opacity:.75;line-height:1.5;margin-top:4px">${hi ? TEACH_WORDS_TERMS.hi(n) : TEACH_WORDS_TERMS.en(n)}</div>
    <div style="font-size:12.5px;margin-top:6px">${t
      ? (hi ? `सहमति दी: ${String(t.at).slice(0, 10)} (शर्तें v${t.v})` : `Agreed on ${String(t.at).slice(0, 10)} (terms v${t.v})`)
      : (hi ? 'अभी सहमति नहीं — समझाना इसी फ़ोन पर जाँचा जाता है।' : 'Not agreed — explanations are checked on this phone only.')}</div>
    ${t ? (S.ctx.wordsAsk
      ? `<div class="row" style="gap:8px;margin-top:6px"><button class="btn ghost" onclick="teachWordsWithdraw()">${hi ? 'हाँ, वापस लें' : 'Yes, withdraw'}</button><button class="btn" onclick="S.ctx.wordsAsk=false;render()">${hi ? 'रहने दें' : 'Keep it'}</button></div>`
      : `<button class="btn ghost" style="margin-top:6px" onclick="S.ctx.wordsAsk=true;render()">${hi ? 'सहमति वापस लें' : 'Withdraw consent'}</button>`)
      : `<button class="btn" style="margin-top:6px" onclick="teachWordsAccept('parent page')">${hi ? 'मैं माता-पिता/अभिभावक हूँ और सहमत हूँ' : "I'm the parent or guardian, and I agree"}</button>`}
  </div>`;
}
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
  const url = text.trim() ? teachJudgeUrl() : '';
  if(url){
    TEACH.busy = 'judge'; render();
    try{
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = setTimeout(() => ctl && ctl.abort(), url === TEACH_URL ? 10000 : 9000);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
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
  log(verdicts ? 2 : 0, `Teach Munni · "${it.aim.short.en}" · heard by ${d.provider || 'the phone'} · judged by ${how} → ${out}${!verdicts && !TALK_URL ? (!S.online ? ' (no signal: the phone judges; with a signal and the words terms, Gemini does)' : !teachWordsOk() ? ' (the words terms not agreed: the phone judges)' : ' (the judge did not answer in time)') : ''}`);
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

/* A gap → taught again, this child's way but not the way just used (the
   mind's second choice, core/mind.js mindChooseOther()), then Munni forgets again. */
function teachRemedy(){
  if(!TEACH || !TEACH.sum) return;
  const s = TEACH.s, gap = s.items.find(x => x.state !== 'covered');
  teachMarkRetaught(s);
  const skill = gap && (gap.aim.skill || s.unit.skill), dom = skill && mindDomain(skill);
  TEACH = null;
  const say = (from, to) => { if(typeof log === 'function') log(0, `Teach Munni · teaching ${skill} again a different way: ${from || '—'} → ${to}`); };
  const was = skill && typeof mindOf === 'function' ? ((mindOf().plan[skill] || {}).way || (mindOf().pending[skill] || {}).way) : null;
  if(dom === 'math'){ const w = mindChooseOther(skill, mindMathWays(skill)); say(was, w); mindGoWay(skill, w); return; }
  if(dom === 'shape'){ const w = mindChooseOther(skill, typeof planBuiltin === 'function' && planBuiltin(skill) ? ['show', 'story'] : ['story']); say(was, w); mindGoWay(skill, w); return; }
  if(s.unit.lessonId){
    go('lessons'); startLesson(s.unit.lessonId);
    // a reading lesson: the same passage, read another way (Munni first, in pieces, or on your own)
    if(dom === 'read' && S.lesson){
      const w = mindChooseOther(skill, ['model', 'chunks', 'solo']);
      say(S.lesson.readWay || was, w);
      S.lesson.readWay = w; mindTaught(skill, w); render();
    }
    return;
  }
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
  ${teachWordsAsk() ? teachWordsCardHTML() : ''}
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
    ${!TALK_URL && !S.online ? `<div class="muted" style="font-size:12px;margin-top:6px">${hi ? 'सिग्नल नहीं: मुन्नी इसी फ़ोन पर जाँचती है। सिग्नल हो तो Gemini जाँचता है।' : 'No signal: Munni checks it on this phone. With a signal, Gemini checks it.'}</div>`
      : teachWordsOk() && S.online ? `<div class="muted" style="font-size:12px;margin-top:6px">${hi ? 'Gemini जाँचता है कि कौन-सी बात समझाई — तुम्हारे अपने शब्दों से।' : 'Gemini checks which points you explained — from your own words.'}</div>` : ''}
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
  const all = readClassShared(code), hi = S.lang === 'hi', rows = {}, loops = {}, dids = {};
  for(const [id, c] of Object.entries(all)){
    if(id.startsWith('_') || !c || !c.explained) continue;
    for(const [aim, v] of Object.entries(c.explained)){ const r = rows[aim] = rows[aim] || { c: 0, p: 0, g: 0 }; if(r[v] != null) r[v]++; }
    for(const [aim, v] of Object.entries(c.loop || {})) (loops[aim] = loops[aim] || []).push({ v, name: c.childName || '?' });
    for(const [aim, v] of Object.entries(c.did || {})) (dids[aim] = dids[aim] || []).push({ v, said: c.explained[aim], name: c.childName || '?' });
  }
  const list = Object.entries(rows).sort((x, y) => (y[1].g + y[1].p) / (y[1].c + y[1].p + y[1].g) - (x[1].g + x[1].p) / (x[1].c + x[1].p + x[1].g)).slice(0, 12);
  if(!list.length) return '';
  // the loop across the class: of the children who couldn't explain a point at first, how many
  // could after Munni taught it again — the one number that says whether the teaching works
  const tot = teachLoopCounts(Object.values(loops).flat().map(x => x.v));
  const retaught = tot.after + tot.working;
  const head = tot.gap ? `<div class="teachloop-sum">${hi
      ? `जिन बातों को बच्चे पहली बार नहीं समझा पाए (${tot.gap}): ${tot.after} मुन्नी के फिर सिखाने के बाद समझा पाए${tot.alone ? `, ${tot.alone} अपने आप बाद में` : ''}${tot.waiting ? `, ${tot.waiting} फिर सीख चुके हैं, मुन्नी अभी पूछेगी` : ''}${tot.working ? `, ${tot.working} पर अभी काम चल रहा है` : ''}${tot.notyet ? `, ${tot.notyet} अभी फिर नहीं सिखाई गईं` : ''}।`
      : `Points children couldn't explain the first time (${tot.gap}): ${tot.after} explained after Munni taught them again${retaught ? ` (${tot.after} of ${retaught} re-taught and asked again)` : ''}${tot.alone ? `, ${tot.alone} on their own later` : ''}${tot.waiting ? `, ${tot.waiting} re-taught and still to be asked` : ''}${tot.working ? `, ${tot.working} still working on it` : ''}${tot.notyet ? `, ${tot.notyet} not re-taught yet` : ''}.`}</div>` : '';
  const loopLine = aim => {
    const xs = loops[aim] || [], k = teachLoopCounts(xs.map(x => x.v));
    if(!k.gap) return '';
    const who = f => xs.filter(x => f(x.v)).map(x => attr(x.name)).join(', ');
    const parts = [
      k.after && (hi ? `फिर सिखाने के बाद समझाई: ${who(v => v.includes('r') && v.endsWith('c'))}` : `explained after re-teaching: ${who(v => v.includes('r') && v.endsWith('c'))}`),
      k.alone && (hi ? `बाद में अपने आप: ${who(v => !v.includes('r') && v.length > 1 && v.endsWith('c'))}` : `later on their own: ${who(v => !v.includes('r') && v.length > 1 && v.endsWith('c'))}`),
      k.waiting && (hi ? `फिर सीखा, अभी पूछना है: ${who(v => v.endsWith('r'))}` : `re-taught, to ask again: ${who(v => v.endsWith('r'))}`),
      k.working && (hi ? `फिर सीखा, अभी काम चल रहा है: ${who(v => v.includes('r') && /[pg]$/.test(v))}` : `re-taught, still working: ${who(v => v.includes('r') && /[pg]$/.test(v))}`),
      k.notyet && (hi ? `अभी फिर नहीं सिखाई: ${who(v => !v.includes('r') && /[pg]$/.test(v))}` : `not re-taught yet: ${who(v => !v.includes('r') && /[pg]$/.test(v))}`)
    ].filter(Boolean);
    return `<div class="teachloop">↻ ${parts.join(' · ')}</div>`;
  };
  // doing it next to explaining it: a child who answers right but can't say why, and a
  // child who can say why but whose answers aren't right yet, need different help
  const didLine = aim => {
    const xs = (dids[aim] || []).filter(x => x.said);
    if(!xs.length) return '';
    const who = f => xs.filter(f).map(x => attr(x.name)).join(', ');
    const both = who(x => x.v === 'y' && x.said === 'c'), doOnly = who(x => x.v === 'y' && x.said !== 'c'),
          sayOnly = who(x => x.v === 'n' && x.said === 'c'), neither = who(x => x.v === 'n' && x.said !== 'c');
    const parts = [
      both && (hi ? `करते भी हैं, समझाते भी: ${both}` : `does it and explains it: ${both}`),
      doOnly && (hi ? `सही करते हैं, पर अभी समझा नहीं पाते: ${doOnly}` : `gets it right, can't explain it yet: ${doOnly}`),
      sayOnly && (hi ? `समझा लेते हैं, पर जवाब अभी सही नहीं: ${sayOnly}` : `explains it, answers not right yet: ${sayOnly}`),
      neither && (hi ? `अभी दोनों बाक़ी: ${neither}` : `neither yet: ${neither}`)
    ].filter(Boolean);
    return parts.length ? `<div class="teachdid">✎ ${parts.join(' · ')}</div>` : '';
  };
  return `<div class="paper" style="margin-top:12px">
    <div class="kicker2">🐘 ${hi ? 'बच्चे क्या समझा पाए ("मुन्नी को सिखाओ")' : 'WHAT THE CLASS COULD EXPLAIN (TEACH MUNNI)'}</div>
    <div style="font-size:12.5px;opacity:.75;margin-bottom:6px">${hi ? 'हर बात के लिए: कितने बच्चों ने अपने शब्दों में समझाई, कितनों ने थोड़ी, कितनों के लिए मुन्नी फिर पूछेगी — और जो पहली बार नहीं समझा पाए, उनका आगे क्या हुआ।' : 'For each point: how many children explained it in their own words, partly, or still to come — and, for those who couldn\'t at first, what happened next.'}</div>
    ${head}
    ${list.map(([aim, r]) => { const n = r.c + r.p + r.g; return `<div class="teachrow">
      <div style="font-size:13px">${TMW(teachAimLabel(aim, code))}</div>
      <div class="teachbar"><i class="c" style="width:${r.c / n * 100}%"></i><i class="p" style="width:${r.p / n * 100}%"></i><i class="g" style="width:${r.g / n * 100}%"></i></div>
      <div style="font-size:11.5px;opacity:.75">${hi ? `${r.c} ने समझाई · ${r.p} ने थोड़ी · ${r.g} बाक़ी` : `${r.c} explained · ${r.p} partly · ${r.g} still to come`}</div>${didLine(aim)}${loopLine(aim)}</div>`; }).join('')}
  </div>`;
}

if(typeof VIEWS !== 'undefined') VIEWS.teach = teachHTML;
