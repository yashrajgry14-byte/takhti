/* ==================================================================
   THE LEARNING CIRCLE — the app's side

   Around the child: the class teacher, the parents, the tuition
   teacher, Munni on calls, and this app. They all work on one step a week
   (voice/circle.js on the voice server decides it: the class homework
   adapted to this child, last Friday's suggestion, a teacher's note, or
   the child's own weakest step).

   A parent ticks "always keep in sync" once — in a grown-ups' step at
   the end of onboarding, or on the parent dashboard. Only then, and only
   with a signal, the app sends PROGRESS: levels, the skill history, the
   counts, the Friday check's result, the home-question answers. Never a
   voice, a photo, or a typed question. It gets back this week's step, the
   home activities, the Friday check, the circle's members and notes, the
   class homework (imported through the app's own importHomework()), and
   the evidence only the server saw (phone lessons, the tutor's ticks,
   teachers' notes) as S.circleHistory, which appEvidence() adds in.

   Sync is fire-and-forget at the map (between activities, never inside
   one), when the signal comes back, and from the dashboard. Nothing here
   ever blocks a lesson; with no signal or no server it simply waits.

   For the child: this week's step on the map, Munni's Friday check (three
   questions, kind feedback, never "wrong"), and once per activity "did
   you teach someone at home?". No reminders, no streaks, nothing sent to
   a child (CLAUDE.md).
   ================================================================== */
let CIRCLE_BUSY = false, CIRCLE_AGAIN = false;   // a forced sync asked for while one is in flight runs right after it
const circleSetUp = () => !!TALK_URL;
const circleOn = () => circleSetUp() && S.circleSync;
const hiL = () => S.lang === 'hi';

/* ---------- sync ---------- */
function circleSync(force){
  if(S.circleLeave) return circleLeaveSend();   // an "off" or an erase waiting for the signal goes first
  if(!circleOn() || !S.online) return;
  if(CIRCLE_BUSY){ if(force) CIRCLE_AGAIN = true; return; }
  if(!force && S.circleAt && Date.now() - Date.parse(S.circleAt) < 120e3) return;   // not more than every two minutes
  CIRCLE_BUSY = true;
  const childId = S.id;
  const srs = (typeof srsStats === 'function') ? srsStats(S) : null;
  const body = {
    child: { id: S.id, name: S.name, age: S.age || 6, lang: S.lang },
    key: S.circleKey || undefined,
    consent: { sync: true, at: S.circleSyncAt || null },
    link: S.circleCode || undefined,
    parent_phone: S.circlePhone || undefined,
    progress: { seq: Date.now(), levels: S.levels, skillHistory: S.skillHistory, attempts: S.attempts, correct: S.correct,
                stars: S.stars, cards: (S.cards || []).length, classCode: S.classCode || undefined,
                srs: srs ? { due: srs.due || 0, total: srs.total || 0 } : undefined },
    check: S.circleOut && S.circleOut.check || undefined,
    home: S.circleOut && S.circleOut.home && S.circleOut.home.length ? S.circleOut.home : undefined,
    invite: S.circleOut && S.circleOut.invite || undefined,
    tutor: S.circleOut && S.circleOut.tutor || undefined
  };
  const sent = JSON.parse(JSON.stringify(S.circleOut || {}));
  fetch(TALK_URL + '/circle/sync', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, d })))
    .then(({ ok, status, d }) => { CIRCLE_BUSY = false; if(S.id === childId) circleApply(ok, status, d, sent); circleAgain(); })
    .catch(() => { CIRCLE_BUSY = false; CIRCLE_AGAIN = false; });   // no signal after all: it waits for the next one
}

function circleAgain(){ if(CIRCLE_AGAIN){ CIRCLE_AGAIN = false; circleSync(true); } }

function circleApply(ok, status, d, sent){
  if(!ok){
    if(status === 404 && d && d.link === false){ S.circleCode = ''; S.ctx.circleMsg = hiL() ? 'यह फ़ैमिली कोड नहीं मिला।' : 'That family code was not found.'; }
    else if(status === 409){ S.circleCode = ''; S.ctx.circleMsg = hiL() ? 'यह फ़ैमिली कोड किसी और फ़ोन पर इस्तेमाल हो चुका है।' : 'That family code is already used on another phone.'; }
    if(S.screen === 'parent') render();
    return;
  }
  if(d.key) S.circleKey = d.key;
  if(S.circleCode){ S.circleCode = ''; S.ctx.circleMsg = hiL() ? 'स्कूल से जुड़ गए।' : 'Joined to the school.'; }
  S.circle = d.circle || null;
  S.circleHistory = (d.circle && d.circle.circleHistory) || {};
  S.circleAt = new Date().toISOString();
  // a level a phone lesson moved since the last sync
  if(d.levels) for(const m of ['read','write','math']) if(d.levels[m]) S.levels[m] = clampLevel(m, d.levels[m]);
  // a class test the teacher entered: the strongest evidence of how a way of teaching is working
  for(const a of (d.circle && d.circle.assessments) || []) mindAssessment({ id: a.id, skill: a.skill, got: a.got, of: a.of, at: a.at, by: a.by || 'teacher' });
  // the class homework, through the app's own import (it checks the code).
  // S.circleHw remembers which assignment came this way, so that when the
  // teacher withdraws it (no code any more) the app drops exactly that one —
  // never homework a parent pasted from a code the circle didn't send.
  if(d.circle && d.circle.homework_code && typeof importHomework === 'function'){
    const hw = getAssignedHomework(S);
    const r = importHomework(d.circle.homework_code, S);
    if(r.ok){
      const now = getAssignedHomework(S);
      S.circleHw = now ? now.assignedAt : null;
      if(!hw || hw.assignedAt !== S.circleHw) log(2, 'Learning circle · the class homework arrived with the sync');
    }
  }else if(d.circle && S.circleHw != null){
    const hw = getAssignedHomework(S);
    const sameClass = !d.circle.members || !d.circle.members.class_code || d.circle.members.class_code === S.classCode;
    if(hw && hw.assignedAt === S.circleHw && sameClass && typeof clearHomework === 'function'){
      clearHomework(S.classCode);
      log(2, 'Learning circle · the teacher withdrew the class homework, so it is gone here too');
    }
    S.circleHw = null;
  }
  // what was sent is done
  const out = S.circleOut || {};
  if(sent.check && out.check && out.check.week === sent.check.week) delete out.check;
  if(sent.home) out.home = (out.home || []).filter(h => !sent.home.some(x => x.id === h.id && x.answer === h.answer));
  if(sent.invite) delete out.invite;
  if(sent.tutor) delete out.tutor;
  S.circleOut = out;
  log(2, 'Learning circle · progress synced (never a voice or a photo)');
  saveSoon();
  if(['map','parent','lessons'].includes(S.screen)) render();
}

/* ---------- the grown-ups' step at the end of onboarding ---------- */
function circleOnboardWanted(){ return circleSetUp() && !S.circleAsked; }
function circleOnboardHTML(){
  const hi = hiL(), n = attr(S.name || '');
  return `<div class="ob"><div class="card circlecard" style="text-align:left">
    <div class="kicker2">${hi ? 'बड़ों के लिए' : 'FOR A GROWN-UP'}</div>
    <h3 style="margin:6px 0">${hi ? `${n} का सीखने का घेरा` : `${n}'s learning circle`}</h3>
    <div style="font-size:13.5px;line-height:1.55">${hi
      ? `स्कूल, ट्यूशन टीचर और परिवार एक ही कदम पर साथ काम करें: इस हफ़्ते क्या सीखना है, अभ्यास कैसा चल रहा है, शुक्रवार का छोटा टेस्ट। सिर्फ़ अभ्यास की जानकारी जाती है, आवाज़, फ़ोटो या लिखे सवाल कभी नहीं। कभी भी बंद कर सकते हैं।`
      : `The school, the tuition teacher and the family work on the same step together: what to learn this week, how practice is going, the Friday check. Only practice progress goes, never a voice, a photo or a typed question. Turn it off any time.`}</div>
    <label style="display:flex;gap:8px;align-items:center;margin:12px 0"><input type="checkbox" id="circleTick"> <b>${hi ? 'हमेशा साथ जोड़े रखें (sync)' : 'Always keep in sync'}</b></label>
    <input id="circleCodeIn" placeholder="${hi ? 'स्कूल का फ़ैमिली कोड (अगर है)' : "The school's family code (if you have one)"}" style="width:100%">
    <div class="row" style="gap:8px;margin-top:12px">
      <button class="btn" onclick="circleOnboardDone(true)">${hi ? 'आगे →' : 'Continue →'}</button>
      <button class="btn ghost" onclick="circleOnboardDone(false)">${hi ? 'बाद में' : 'Later'}</button>
    </div></div></div>`;
}
function circleOnboardDone(useTick){
  const box = $('circleTick'), code = $('circleCodeIn');
  S.circleAsked = true;
  if(useTick && box && box.checked) circleTurnOn(code ? code.value : '');
  S.ob = null;
  saveSoon();
  if(S.game) goHub(); else go('pick');
}
function circleTurnOn(code){
  S.circleSync = true; S.circleSyncAt = new Date().toISOString();
  if(S.circleLeave && !S.circleLeave.erase) S.circleLeave = null;   // an "off" not yet sent is simply undone
  if(code && code.trim()) S.circleCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  log(null, `Learning circle turned on by a parent for ${S.name || 'this child'} — progress only, never a voice or a photo`);
  circleSync(true);
}

/* ---------- the parent dashboard ---------- */
function circleParentHTML(){
  if(!circleSetUp()) return '';
  const hi = hiL(), n = attr(S.name || '');
  const head = `<div class="kicker2" style="margin-top:14px">${hi ? 'सीखने का घेरा' : 'LEARNING CIRCLE'}</div>
  <div class="metric"><div><b>${hi ? 'हमेशा साथ जोड़े रखें' : 'Always keep in sync'}</b>
    <div style="font-size:12.5px;opacity:.75;line-height:1.5">${hi
      ? `${n} का स्कूल, ट्यूशन टीचर और परिवार एक ही कदम पर साथ रहें। सिर्फ़ अभ्यास की जानकारी जाती है, आवाज़, फ़ोटो या लिखे सवाल कभी नहीं।`
      : `${n}'s school, tuition teacher and family stay on the same step. Only practice progress goes, never a voice, a photo or a typed question.`}</div></div>
    <button class="toggle ${S.circleSync ? 'on' : ''}" onclick="toggleCircle()" aria-label="sync"><span></span></button></div>
  ${S.ctx.circleMsg ? `<div class="muted" style="font-size:12.5px">${attr(S.ctx.circleMsg)}</div>` : ''}`;
  if(!S.circleSync) return head + (S.circleLeave && !S.circleLeave.erase ? `<div class="muted" style="font-size:12.5px">${hi ? 'घेरे को बताना बाकी है: इंटरनेट मिलते ही।' : 'The circle will be told when there is a signal.'}</div>` : '') + circleEraseHTML();
  const c = S.circle;
  if(!c) return head + `<div class="muted" style="font-size:12.5px">${S.online ? (hi ? 'जोड़ रहे हैं…' : 'Connecting…') : (hi ? 'इंटरनेट मिलने पर जुड़ेगा।' : 'Will connect when there is a signal.')}</div>`;
  const w = c.week, m = c.members;
  const L2 = o => o ? (hi ? (o.hi || o.en) : (o.en || o.hi)) : '';
  const home = (w.home || []).map(h => `<div class="metric"><div style="font-size:13px">${attr(L2(h.text))}</div>${h.done || (S.circleOut && (S.circleOut.home || []).some(x => x.id === h.id && x.answer === 'done'))
    ? `<span class="agechip">${hi ? 'हो गया' : 'done'}</span>` : `<button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleHomeDone('${h.id}')">${hi ? 'कर लिया ✓' : 'We did it ✓'}</button>`}</div>`).join('');
  const k = w.check;
  const tutors = (m.tutors || []).map(t => `<div class="metric"><div><b>${attr(t.name)}</b><div style="font-size:12px;opacity:.7">${t.status === 'pending' ? (hi ? 'स्कूल का सुझाव · आपकी हाँ का इंतज़ार' : 'suggested by the school · waiting for you') : (hi ? 'ट्यूशन टीचर' : 'tuition teacher')}</div></div>
    <div>${t.status === 'pending' ? `<button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleTutor('${t.id}','approve')">${hi ? 'हाँ' : 'Approve'}</button> <button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleTutor('${t.id}','decline')">${hi ? 'नहीं' : 'Decline'}</button>`
      : `<button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleTutor('${t.id}','remove')">${hi ? 'हटाएँ' : 'Remove'}</button>`}</div></div>`).join('');
  return head + `
  <div class="card circlecard" style="margin-top:8px">
    <b>${hi ? 'इस हफ़्ते' : 'This week'}: ${attr(L2(w.skill_name))}</b>
    <div style="font-size:12.5px;opacity:.8;margin-top:3px">${attr(L2(w.why))}</div>
    <div style="font-size:12.5px;margin-top:6px">${k && k.done ? `${hi ? 'शुक्रवार का टेस्ट' : 'Friday check'}: <b>${k.right}/${k.of}</b>` : (hi ? 'शुक्रवार से रविवार: तीन सवालों का छोटा टेस्ट।' : 'Friday to Sunday: a three-question check.')}</div>
  </div>
  <div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'घर पर' : 'At home'}</div>${home}
  <div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'घेरे में' : 'In the circle'}</div>
  <div style="font-size:12.5px;opacity:.8">${[m.school, m.class_code ? (hi ? 'कक्षा ' : 'class ') + m.class_code : '', (m.teachers || []).join(', ')].filter(Boolean).map(attr).join(' · ') || (hi ? 'अभी स्कूल से नहीं जुड़े' : 'Not joined to a school yet')}</div>
  ${tutors}
  ${m.school ? '' : `<div class="row" style="gap:6px;margin-top:6px"><input id="circleCode2" placeholder="${hi ? 'स्कूल का फ़ैमिली कोड' : "School's family code"}" style="flex:1"><button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleJoin()">${hi ? 'जोड़ें' : 'Join'}</button></div>`}
  <div class="row" style="gap:6px;margin-top:6px"><input id="tutName" placeholder="${hi ? 'ट्यूशन टीचर का नाम' : "Tuition teacher's name"}" style="flex:1"><input id="tutPhone" placeholder="+91…" style="flex:1">
    <button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleInvite()">${hi ? 'जोड़ें' : 'Invite'}</button></div>
  <div class="row" style="gap:6px;margin-top:6px"><input id="circlePhoneIn" value="${attr(S.circlePhone || '')}" placeholder="${hi ? 'आपका WhatsApp नंबर (+91…)' : 'Your WhatsApp number (+91…)'}" style="flex:1">
    <button class="stepbtn" style="width:auto;padding:0 10px" onclick="circleSetPhone()">${hi ? 'सेव' : 'Save'}</button></div>
  ${(c.notes || []).length ? `<div style="font-size:12.5px;font-weight:600;margin-top:8px">${hi ? 'टीचर्स के नोट' : 'Notes from teachers'}</div>${c.notes.slice(0, 3).map(x => `<div style="font-size:12.5px">${attr(x.by)}: ${attr(L2(x.skill_name))} ${x.ok ? '✓' : '✗'}</div>`).join('')}` : ''}
  <div style="font-size:12px;opacity:.65;margin-top:8px">${hi ? 'आख़िरी बार जुड़ा' : 'Last synced'}: ${attr(String(S.circleAt || '').slice(0, 16).replace('T', ' '))}
    ${c.parent_page ? ` · <a href="${attr(c.parent_page)}" target="_blank" rel="noopener">${hi ? 'घेरे का पेज' : 'Circle page'}</a>` : ''}</div>
  <button class="btn ghost" onclick="circleSync(true)">${hi ? 'अभी जोड़ें' : 'Sync now'}</button>
  ${circleEraseHTML()}`;
}
function toggleCircle(){
  if(S.circleSync){
    S.circleSync = false;
    // the server must hear it too, or the circle (messages, the plan, its parts of calls) would carry on
    if(S.circleKey && !(S.circleLeave && S.circleLeave.erase)) S.circleLeave = { erase: false };
    log(null, `Learning circle sync turned off for ${S.name || 'this child'}`);
    S.ctx.circleMsg = S.circleKey && !S.online ? (hiL() ? 'इंटरनेट मिलते ही घेरे को बता देंगे।' : 'The circle will be told as soon as there is a signal.') : '';
    saveSoon(); circleLeaveSend(); return render();
  }
  circleTurnOn('');
  saveSoon(); render();
}
/* Off or erase, to the server. It waits for a signal like everything else;
   until it has gone the dashboard says so. */
function circleLeaveSend(){
  const want = S.circleLeave;
  if(!want) return;
  if(CIRCLE_BUSY){ CIRCLE_AGAIN = true; return; }   // runs right after the sync in flight
  if(!S.circleKey){ S.circleLeave = null; if(want.erase) circleWipeLocal(); saveSoon(); return; }   // the server never had this child
  if(!circleSetUp() || !S.online) return;
  CIRCLE_BUSY = true;
  const childId = S.id;
  fetch(TALK_URL + '/circle/leave', { method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ child: { id: S.id }, key: S.circleKey, erase: !!want.erase }) })
    .then(r => r.json().then(d => ({ ok: r.ok, d })))
    .then(({ ok, d }) => {
      CIRCLE_BUSY = false;
      if(S.id !== childId || !ok) return;
      S.circleLeave = null;
      const hi = hiL();
      if(want.erase){
        circleWipeLocal();
        S.ctx.circleMsg = hi ? 'घेरे का डेटा मिटा दिया।' : "The circle's data is deleted.";
        log(null, `Learning circle data erased for ${S.name || 'this child'} (${d.erased || 'nothing kept'})`);
      }else{
        S.ctx.circleMsg = hi ? 'घेरे को बता दिया: अब कुछ नहीं जाएगा।' : 'The circle has been told: nothing more will go.';
        log(null, `Learning circle told: sync off for ${S.name || 'this child'}`);
      }
      saveSoon();
      if(S.circleSync) circleSync(true);
      if(S.screen === 'parent') render();
    })
    .catch(() => { CIRCLE_BUSY = false; });
}
function circleWipeLocal(){
  S.circleSync = false; S.circleKey = null; S.circle = null; S.circleAt = null; S.circleCode = '';
  S.circleHistory = {}; S.circleChecks = {}; S.circleHomeAns = {}; S.circleOut = {}; S.circleHw = null;
}
function circleErase(){
  if(!S.ctx.circleEraseAsk){ S.ctx.circleEraseAsk = true; return render(); }   // two taps: the first only explains
  S.ctx.circleEraseAsk = false;
  S.circleLeave = { erase: true };
  S.circleSync = false;
  S.ctx.circleMsg = S.online || !S.circleKey ? '' : (hiL() ? 'इंटरनेट मिलते ही मिटा देंगे।' : 'It will be deleted as soon as there is a signal.');
  saveSoon();
  circleLeaveSend();
  render();
}
function circleEraseHTML(){
  if(!S.circleKey && !S.circleLeave) return '';
  const hi = hiL(), n = attr(S.name || '');
  if(S.circleLeave && S.circleLeave.erase) return `<div class="muted" style="font-size:12.5px">${hi ? 'मिटाना बाकी है: इंटरनेट मिलते ही होगा।' : 'Deleting: it will happen when there is a signal.'}</div>`;
  return `${S.ctx.circleEraseAsk ? `<div style="font-size:12.5px;line-height:1.5;margin-top:8px">${hi
      ? `इससे घेरे में रखा ${n} का सब मिट जाएगा: जुड़ी हुई प्रगति, इस हफ़्ते की योजना, शुक्रवार के टेस्ट, घर की गतिविधियाँ, ट्यूशन टीचर का जुड़ाव और संदेश। स्कूल के अपने रिकॉर्ड (फ़ोन वाले पाठ, टीचर के नोट) स्कूल के पास रहते हैं, उन्हें मिटाने के लिए स्कूल से कहें। फ़ोन पर ${n} की अपनी प्रगति वैसी ही रहेगी।`
      : `This deletes everything the circle keeps about ${n}: the synced progress, this week's plan, the Friday checks, home activities, the tuition teacher's link and the messages. The school's own records (phone lessons, teachers' notes) stay with the school; ask the school to delete those. ${n}'s progress on this phone stays as it is.`}</div>` : ''}
  <button class="btn ghost" onclick="circleErase()">🗑️ ${S.ctx.circleEraseAsk ? (hi ? 'हाँ, मिटाएँ' : 'Yes, delete') : (hi ? 'घेरे का डेटा मिटाएँ' : "Delete the circle's data")}</button>`;
}
function circleQueue(kind, val){
  S.circleOut = S.circleOut || {};
  if(kind === 'home'){ S.circleOut.home = (S.circleOut.home || []).filter(h => h.id !== val.id).concat(val); }
  else S.circleOut[kind] = val;
  saveSoon();
  circleSync(true);
}
function circleHomeDone(id){ circleQueue('home', { id, answer: 'done' }); render(); }
function circleTutor(id, action){ circleQueue('tutor', { id, action }); S.ctx.circleMsg = hiL() ? 'हो गया।' : 'Done.'; render(); }
function circleJoin(){ const el = $('circleCode2'); if(!el || !el.value.trim()) return; S.circleCode = el.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); circleSync(true); }
function circleInvite(){
  const nm = $('tutName'), ph = $('tutPhone');
  const phone = ph ? ph.value.replace(/[\s-]/g, '') : '';
  if(!nm || !nm.value.trim() || !/^\+\d{10,15}$/.test(phone)){ S.ctx.circleMsg = hiL() ? 'नाम और +91 वाला नंबर लिखें।' : 'Write a name and a number starting with +91.'; return render(); }
  circleQueue('invite', { name: nm.value.trim().slice(0, 60), phone, lang: S.lang });
  S.ctx.circleMsg = hiL() ? `${nm.value.trim()} को बुलावा भेजा।` : `Invited ${nm.value.trim()}.`;
  render();
}
function circleSetPhone(){
  const el = $('circlePhoneIn'); const v = el ? el.value.replace(/[\s-]/g, '') : '';
  if(v && !/^\+\d{10,15}$/.test(v)){ S.ctx.circleMsg = hiL() ? '+91 वाला नंबर लिखें।' : 'Write the number starting with +91.'; return render(); }
  S.circlePhone = v; saveSoon(); circleSync(true);
}

/* ---------- for the child: the map ---------- */
function circleHomeAsk(){
  const w = S.circle && S.circle.week;
  if(!w) return null;
  const answered = id => (S.circleOut && (S.circleOut.home || []).some(x => x.id === id && x.answer !== 'done')) || (S.circleHomeAns || {})[id];
  return (w.home || []).find(h => h.ask && !answered(h.id)) || null;
}
function circleMapHTML(){
  if(!circleOn() || !S.circle || !S.circle.week) return '';
  const hi = hiL(), w = S.circle.week;
  const name = hi ? w.skill_name.hi : w.skill_name.en;
  const done = (S.circleChecks || {})[w.key];
  const checkBtn = w.check && w.check.due && !done && (w.check.questions || []).length
    ? `<button class="btn" style="margin-top:8px" onclick="go('check')">⭐ ${hi ? 'मुन्नी का शुक्रवार वाला खेल: 3 सवाल' : "Munni's Friday check: 3 questions"} →</button>` : '';
  const ask = circleHomeAsk();
  const askCard = ask ? `<div class="circleq"><div>${hi ? `क्या तुमने घर पर किसी को ${attr(ask.topic.hi)} के बारे में सिखाया?` : `Did you teach someone at home about ${attr(ask.topic.en)}?`}</div>
    <div class="row" style="gap:8px;margin-top:6px"><button class="btn" onclick="circleHomeAnswer('${ask.id}','yes')">${hi ? 'हाँ!' : 'Yes!'}</button>
      <button class="btn ghost" onclick="circleHomeAnswer('${ask.id}','no')">${hi ? 'अभी नहीं' : 'Not yet'}</button></div></div>` : '';
  return `<div class="card circlecard" style="margin:8px 0">
    <div style="font-size:13px">${hi ? 'इस हफ़्ते मुन्नी और तुम सीख रहे हो' : 'This week you and Munni are learning'}: <b>${attr(name)}</b> ✨</div>
    ${checkBtn}${askCard}</div>`;
}
function circleHomeAnswer(id, ans){
  S.circleHomeAns = Object.assign({}, S.circleHomeAns, { [id]: ans });
  circleQueue('home', { id, answer: ans });
  const hi = hiL();
  speak(ans === 'yes' ? (hi ? 'वाह! किसी को सिखाना सीखने का सबसे अच्छा तरीका है।' : 'Wonderful! Teaching someone is the best way to learn.') : (hi ? 'कोई बात नहीं!' : "That's okay!"));
  if(ans === 'yes' && typeof triggerStarBurst === 'function') triggerStarBurst();
  render();
}

/* the Story Fire: lessons for this week's step, when it isn't the homework */
function circleLessonsHTML(){
  if(!circleOn() || !S.circle || !S.circle.week || S.circle.week.source === 'homework') return '';
  const w = S.circle.week, hi = hiL();
  const lessons = (typeof lessonsForSkill === 'function' ? lessonsForSkill(w.skill, S) : []).slice(0, 3);
  if(!lessons.length) return '';
  return `<div class="card circlecard" style="margin:10px 0"><b>✨ ${hi ? 'इस हफ़्ते' : 'This week'}: ${attr(hi ? w.skill_name.hi : w.skill_name.en)}</b>
    ${lessons.map(l => `<button class="lescard" style="margin-top:8px" onclick="${l.screen ? `go('${l.screen}')` : `startLesson('${l.id}')`}">
      <span class="lesic">${l.ic || '📘'}</span><span><b>${L(l.title)}</b><small>${L(l.sub)}</small></span><span class="lesgo">▶</span></button>`).join('')}</div>`;
}

/* ---------- Munni's Friday check: three questions ---------- */
function checkHTML(){
  const hi = hiL(), w = S.circle && S.circle.week;
  const qs = w && w.check && w.check.questions || [];
  if(!qs.length) return `<button class="back" onclick="go('map')">← ${t('back')}</button><div class="muted">${hi ? 'अभी कोई टेस्ट नहीं।' : 'No check right now.'}</div>`;
  const st = S.ctx.check || (S.ctx.check = { i: 0, right: 0, fb: null });
  if(st.i >= qs.length){
    const r = st.right, line = r === qs.length ? (hi ? 'वाह, यह तुम्हें आ गया!' : "Wonderful, you've got it!") : r >= 2 ? (hi ? 'लगभग आ गया!' : 'Nearly there!') : (hi ? 'अच्छी कोशिश! हम और अभ्यास करेंगे।' : "Good try! We'll practise more.");
    return `<div class="card" style="text-align:center;padding:22px"><div style="font-size:44px">⭐</div>
      <div class="display" style="font-size:22px;margin:8px 0">${hi ? `${qs.length} में से ${r}` : `${r} of ${qs.length}`}</div><div>${line}</div>
      <button class="btn" style="margin-top:14px" onclick="go('map')">${hi ? 'जंगल में वापस' : 'Back to the jungle'}</button></div>`;
  }
  const q = qs[st.i];
  const tq = parseProblem(q.text);
  if(tq) twinExpect(`check:${w.key}:${st.i}`, q.skill, tq, q.opts);    // the twin's guess, before the answer
  return `<button class="back" onclick="go('map')">← ${t('back')}</button>
    <div class="kicker2">${hi ? 'मुन्नी का शुक्रवार वाला खेल' : "MUNNI'S FRIDAY CHECK"} · ${st.i + 1}/${qs.length}</div>
    <div class="display" style="font-size:34px;margin:14px 0">${attr(q.text)} = ?</div>
    ${st.fb ? `<div class="muted" style="margin-bottom:8px">${attr(st.fb)}</div>` : ''}
    <div class="opts">${q.opts.map(o => `<button class="opt" onclick="checkAnswer(${Number(o)})">${Number(o)}</button>`).join('')}</div>`;
}
function checkAnswer(v){
  const w = S.circle.week, qs = w.check.questions, st = S.ctx.check, q = qs[st.i];
  if(!q || st.i >= qs.length) return;
  const ok = Number(v) === Number(q.answer);
  // real evidence, the same as any question in the app
  twinCheck(`check:${w.key}:${st.i}`, Number(v), ok, false);
  if(skillById(q.skill)){ noteSkillAttempt(q.skill, ok); const tq = parseProblem(q.text); if(tq) twinAnswer(q.skill, tq, Number(v)); }
  record('math', ok);
  if(ok) st.right++;
  const hi = hiL();
  st.fb = ok ? (hi ? 'हाँ, सही!' : 'Yes!') : (hi ? `लगभग! जवाब ${q.answer} है।` : `Almost! It's ${q.answer}.`);
  if(ok && typeof trumpet === 'function') trumpet(1);
  st.i++;
  if(st.i >= qs.length){
    S.circleChecks = Object.assign({}, S.circleChecks, { [w.key]: { right: st.right, of: qs.length, at: new Date().toISOString() } });
    log(0, `Friday check · ${st.right}/${qs.length} on ${q.skill}`);
    circleQueue('check', { week: w.key, right: st.right, of: qs.length });
    if(st.right >= 2 && typeof triggerConfetti === 'function') triggerConfetti(1800);
  }
  saveSoon();
  render();
}

if(typeof VIEWS !== 'undefined') VIEWS.check = checkHTML;
