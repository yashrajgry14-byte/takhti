/* ==================================================================
   FOR TEACHERS — the class view (VIEWS.teacher).

   Reached from the bottom of the parent dashboard, so it sits behind the
   same PIN. It reads the class-code mirror (core/diagnose.js): every
   child on this phone linked to a code, plus every child on ANOTHER
   phone whose parent switched class sync on (core/class-sync.js — hourly,
   or "Sync now") or sent a progress code that was pasted in here
   (core/class-share.js). Homework reaches them the same two ways.

   What a teacher can do here:
     1. Say which skill the class got wrong in a test. tDiagnose() runs
        the real diagnosis for every linked child against their own app
        evidence, classPattern() finds the gap they share, and
        planSummary() gives the one-line verdict per child — including a
        confirmed slip, so a strong child isn't sent back over old work.
     2. Assign homework — the tested skill, or the shared gap under it.
        Each child's app then diagnoses it against THAT child's evidence
        (personalizeContentForHomework()).
     3. See what Takhti covers, by grade and subject, and what it can't
        teach yet — the numbers a school asks for, from the live graph.
   ================================================================== */

function teacherCode(){ return S.ctx.tcode || S.classCode || ''; }

function teacherRoster(code){
  flushClassMirror();   // the active child's latest checkpoints must be in before we read
  const shared = readClassShared(code);
  return Object.keys(shared).filter(k => !k.startsWith('_'))
    .map(id => ({ id, name: shared[id].childName || '?', skillHistory: shared[id].skillHistory || {} }));
}

/* The skills a teacher can pick as "what the class got wrong": anything
   the graph knows at the school grades this app reaches. */
function teacherSkillOptions(){
  return SKILLS.filter(s => s.g >= 1 && s.g <= 6 && s.strand !== 'lit')
    .sort((a,b) => a.g - b.g || a.en.localeCompare(b.en));
}

function teacherHTML(){
  const hi = S.lang === 'hi';
  const code = teacherCode();
  const roster = code ? teacherRoster(code) : [];
  const skillId = S.ctx.tskill || '';
  const results = skillId && roster.length ? tDiagnose([skillId], roster, code) : [];
  const shared = classPattern(results.map(r => ({ name: r.student.name, plan: r.plan })));
  const hw = code ? (readClassShared(code)._homework || null) : null;
  const hwLive = hw && !hw.cleared ? hw : null;
  const cov = skillCoverage();
  const matrix = coverageMatrix(3);
  const ladders = ladderCoverage();
  const queue = contentQueue(3).slice(0, 5);
  const cell = c => c ? `${c.done}/${c.n}` : '—';

  return `
  <button class="back" onclick="go('parent')">← ${t('back')}</button>
  <div class="display" style="font-size:22px;margin:4px 0">🧑‍🏫 ${hi?'शिक्षकों के लिए':'For teachers'}</div>
  <div class="muted" style="font-size:12.5px">${hi
    ? 'इस फ़ोन पर कक्षा कोड से जुड़े बच्चे, और दूसरे फ़ोनों के वे बच्चे जिनके माता-पिता ने सिंक चालू किया या प्रगति कोड भेजा।'
    : 'Children on this phone linked to the class code, plus children on other phones whose parent switched sync on or sent a progress code.'}</div>

  <div class="paper" style="margin-top:10px">
    <div class="kicker2">${hi?'कक्षा का कोड':'CLASS CODE'}</div>
    <input class="input" id="tcode" maxlength="6" value="${attr(code)}" placeholder="${hi?'6 अक्षर का कोड':'6-character code'}"
      style="text-transform:uppercase;letter-spacing:2px;text-align:center;font-family:var(--mono)" autocomplete="off">
    <button class="btn ghost" style="margin-top:8px" onclick="teacherSetCode($('tcode').value)">${hi?'खोलो':'Open class'}</button>
    ${code ? `<div style="font-size:12.5px;opacity:.75;margin-top:6px">${roster.length
      ? (hi ? `${roster.length} बच्चे जुड़े: ${roster.map(r=>attr(r.name)).join(', ')}` : `${roster.length} linked: ${roster.map(r=>attr(r.name)).join(', ')}`)
      : (hi ? 'इस कोड से अभी कोई बच्चा नहीं जुड़ा।' : 'No children linked to this code yet.')}</div>` : ''}

    ${code ? `
    <div class="metric" style="margin-top:10px">
      <div><b>${hi?'इस कक्षा को सिंक रखो (हर घंटे)':'Keep this class synced (every hour)'}</b>
        <div style="font-size:12.5px;opacity:.7">${hi
          ? 'जिन बच्चों के माता-पिता ने सिंक चालू किया है, वे हर फ़ोन से यहाँ आते हैं, और गृहकार्य उन तक जाता है।'
          : 'Children whose parents switched sync on arrive here from every phone, and homework reaches them.'}</div></div>
      <button class="toggle ${S.syncClasses.includes(code)?'on':''}" onclick="toggleClassSync('${code}')" aria-label="sync"><span></span></button>
    </div>
    ${S.syncClasses.includes(code) ? `<div class="row" style="gap:8px;align-items:center;margin-top:6px">
      <div class="muted" style="font-size:12.5px;flex:1">${syncStatusLine(code)}</div>
      <button class="btn ghost" style="width:auto;padding:8px 14px" onclick="syncNow('${code}')">🔄 ${hi?'अभी सिंक करो':'Sync now'}</button>
    </div>` : ''}` : ''}

    <div class="kicker2" style="margin-top:12px">${hi?'या कोड से: दूसरे फ़ोन का प्रगति कोड':"OR BY CODE: A CHILD'S PROGRESS CODE"}</div>
    <textarea class="input sharecode" id="rcode" placeholder="TKR1…"></textarea>
    ${S.ctx.rMsg ? `<div class="${S.ctx.rOk?'muted':'retry'}" style="font-size:12.5px;margin-top:6px">${S.ctx.rMsg}</div>` : ''}
    <button class="btn ghost" style="margin-top:8px" onclick="teacherImport($('rcode').value)">${hi?'बच्चा जोड़ो':'Add to class'}</button>
    <div style="font-size:12px;opacity:.7;margin-top:4px">${hi
      ? 'माता-पिता अपने डैशबोर्ड से यह कोड WhatsApp/SMS पर भेजते हैं।'
      : 'Parents send this from their dashboard, over WhatsApp or SMS.'}</div>

    ${roster.length ? `
    <div class="kicker2" style="margin-top:14px">${hi?'कक्षा ने क्या गलत किया?':'WHAT DID THE CLASS GET WRONG?'}</div>
    <select class="input" onchange="S.ctx.tskill=this.value;render()">
      <option value="">${hi?'— एक कौशल चुनें —':'— pick the skill from the test —'}</option>
      ${teacherSkillOptions().map(s => `<option value="${s.id}" ${s.id===skillId?'selected':''}>${GRADE_LABEL[String(s.g)]} · ${STRAND_NAME[s.strand][hi?'hi':'en']} · ${hi?s.hi:s.en}</option>`).join('')}
    </select>
    ${results.length ? `
      ${shared.length ? `<div class="card" style="margin-top:10px;padding:10px">
        <b>${hi?'साझा कमी':'Shared gap'}: ${hi?shared[0].skill.hi:shared[0].skill.en}</b>
        <div style="font-size:12.5px;opacity:.8">${shared[0].children.map(attr).join(', ')} — ${hi?'कक्षा में 10 मिनट लायक':'worth ten minutes of class time'}</div>
      </div>` : ''}
      ${results.map(r => `<div class="metric"><div><b>${attr(r.student.name)}</b>
        <div style="font-size:12.5px;opacity:.75">${attr(planSummary(r.plan, r.student.name))}${r.guesswork ? (hi?' · ऐप में अभी कोई अभ्यास नहीं':' · no practice in the app yet — a guess') : ''}</div></div></div>`).join('')}
      <div class="kicker2" style="margin-top:12px">${hi?'गृहकार्य दें':'ASSIGN HOMEWORK'}</div>
      <input class="input" id="tnote" placeholder="${hi?'बच्चों के लिए एक छोटा संदेश (वैकल्पिक)':'A short note for the children (optional)'}">
      <div class="row" style="margin-top:8px;gap:8px">
        <button class="btn" onclick="teacherAssign('${skillId}', $('tnote').value)">${hi?'यही कौशल':'This skill'}</button>
        ${shared.length && shared[0].skill.id !== skillId ? `<button class="btn ghost" onclick="teacherAssign('${shared[0].skill.id}', $('tnote').value)">${hi?'साझा कमी':'The shared gap'}</button>` : ''}
      </div>
      <div style="font-size:12px;opacity:.7;margin-top:6px">${hi
        ? 'हर बच्चे का ऐप इसे उसी बच्चे के अभ्यास से फिर जाँचेगा और असली कमी से शुरू करेगा।'
        : "Each child's app re-checks this against that child's own practice and starts at their real gap."}</div>` : ''}
    ` : ''}

    ${hwLive ? `<div class="card" style="margin-top:12px;padding:10px;border:1px solid var(--marigold)">
      <b>📝 ${hi?'अभी का गृहकार्य':'Current homework'}</b>
      <div style="font-size:13px">${hwLive.skills.map(id => { const s = skillById(id); return s ? (hi?s.hi:s.en) : id; }).join(', ')}${hwLive.note ? ` — "${attr(hwLive.note)}"` : ''}</div>
      <div style="font-size:12px;opacity:.75;margin-top:8px">${hi
        ? 'दूसरे फ़ोनों पर बच्चों के लिए यह कोड भेजें — माता-पिता डैशबोर्ड पर डालते हैं:'
        : 'For children on other phones, send this code — parents paste it on their dashboard:'}</div>
      <textarea class="input sharecode" readonly onclick="this.select()">${homeworkCode(code)}</textarea>
      <div class="row" style="gap:8px;margin-top:8px">
        <button class="btn" onclick="shareText(homeworkCode('${code}'))">📤 ${hi?'भेजो':'Send'}</button>
        <button class="btn ghost" onclick="teacherClearHomework()">${hi?'हटाओ':'Remove'}</button>
      </div>
      ${S.ctx.shared ? `<div class="muted" style="font-size:12px;margin-top:4px">${S.ctx.shared}</div>` : ''}
    </div>` : ''}
  </div>

  <div class="paper" style="margin-top:12px">
    <div class="kicker2">${hi?'तख़्ती क्या सिखाती है':'WHAT TAKHTI COVERS'}</div>
    <div style="font-size:12.5px;opacity:.75;margin-bottom:6px">${hi
      ? `कौशल-ग्राफ़ के ${cov.total} में से ${cov.taught} कौशल आज सिखाए जा सकते हैं (${cov.pct}%)।`
      : `${cov.taught} of the ${cov.total} skills in the graph can be taught today (${cov.pct}%).`}</div>
    <div style="overflow-x:auto">
    <table class="covtable">
      <tr><th></th>${['num','eng','hin','evs'].map(st => `<th>${STRAND_NAME[st][hi?'hi':'en']}</th>`).join('')}</tr>
      ${matrix.map(r => `<tr><th>${r.grade}</th>${['num','eng','hin','evs'].map(st => `<td>${cell(r.cells[st])}</td>`).join('')}</tr>`).join('')}
    </table>
    </div>
    ${ladders.map(l => `<div style="font-size:12.5px;margin-top:4px">${hi?l.hi:l.en}: ${l.done}/${l.n}</div>`).join('')}
    ${queue.length ? `
      <div class="kicker2" style="margin-top:12px">${hi?'अभी नहीं सिखा सकते':'NOT TAUGHT YET'}</div>
      ${queue.map(q => `<div style="font-size:12.5px;opacity:.8">${q.grade} · ${STRAND_NAME[q.strand][hi?'hi':'en']} · ${attr(q.en)}${q.blocks ? (hi?` · ${q.blocks} कौशल इस पर टिके`:` · ${q.blocks} skill(s) build on it`) : ''}</div>`).join('')}` : ''}
  </div>`;
}

function teacherSetCode(v){
  const code = (v || '').trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code)) return;
  S.ctx.tcode = code; S.ctx.tskill = '';
  render();
}
function teacherImport(text){
  const hi = S.lang === 'hi';
  const r = importClassReport(text);
  S.ctx.rOk = r.ok;
  if(r.ok){
    S.ctx.tcode = r.code;
    S.ctx.rMsg = hi ? `${r.name} कक्षा ${r.code} में जुड़ गया।` : `${r.name} added to class ${r.code}.`;
    log(0, `Progress code imported · ${r.name} · class ${r.code}`);
  } else {
    S.ctx.rMsg = r.why === 'older'
      ? (hi ? 'इस बच्चे का नया कोड पहले से है।' : 'A newer code for this child is already here.')
      : (hi ? 'यह पूरा प्रगति कोड नहीं लगता — फिर से कॉपी करके देखो।' : "That doesn't look like a whole progress code — try copying it again.");
  }
  render();
}
function teacherAssign(skillId, note){
  const code = teacherCode();
  if(!code || !skillId) return;
  assignHomework(code, [skillId], (note || '').trim());
  log(0, `Teacher assigned homework · ${skillId} · class ${code}`);
  teacherSyncIfOn(code);
}
function teacherClearHomework(){
  const code = teacherCode();
  if(!code) return;
  clearHomework(code);
  log(0, `Teacher removed homework · class ${code}`);
  teacherSyncIfOn(code);
}
/* Homework shouldn't wait for the hourly sync to reach the children. */
function teacherSyncIfOn(code){
  if(S.syncClasses.includes(code)) syncNow(code); else render();
}
function toggleClassSync(code){
  S.syncClasses = S.syncClasses.includes(code) ? S.syncClasses.filter(c => c !== code) : [...S.syncClasses, code];
  if(S.syncClasses.includes(code) && !S.syncKeys[code]) S.syncKeys = { ...S.syncKeys, [code]: newTeacherKey() };
  log(0, `Teacher view · class ${code} sync ${S.syncClasses.includes(code) ? 'on' : 'off'}`);
  save();
  if(S.syncClasses.includes(code)) syncNow(code); else render();
}

if(typeof VIEWS !== 'undefined') VIEWS.teacher = teacherHTML;
