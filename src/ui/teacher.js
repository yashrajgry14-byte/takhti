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
     3. Turn a chapter of the school's own syllabus into this week's
        lessons: Gemini drafts them, Takhti's checker tests every one,
        the teacher reads and approves (core/syllabus.js, syllabusHTML()).
     4. See what Takhti covers, by grade and subject, and what it can't
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

  ${code ? syllabusHTML(code) : ''}
  ${code ? planTeacherHTML(code) : ''}
  ${code && typeof teachTeacherHTML === 'function' ? teachTeacherHTML(code) : ''}

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

/* ---------- the school's own syllabus → this week's lessons ---------- */
function syllabusHTML(code){
  const hi = S.lang === 'hi', c = S.ctx, res = c.sylRes, approved = sylApproved(code);
  const cls = sylClass(c.sylCls || 'c2');
  const badge = k => ({ sum: hi ? '✓ जवाब गणित से जाँचा' : '✓ answer checked by the arithmetic',
                        text: hi ? '✓ जवाब पाठ में मिला' : '✓ answer found in the passage',
                        shape: hi ? '✓ जवाब चित्र से जाँचा' : '✓ answer checked against the drawing',
                        teacher: hi ? '👀 यह जवाब आप जाँच लें' : '👀 please check this answer yourself' })[k] || '';
  return `<div class="paper" style="margin-top:12px">
    <div class="kicker2">📚 ${hi ? 'आपके पाठ्यक्रम से इस हफ़्ते के पाठ' : "THIS WEEK'S LESSONS FROM YOUR SYLLABUS"}</div>
    <div style="font-size:12.5px;opacity:.8">${hi
      ? 'एक अध्याय दें — PDF, किताब के पन्ने की फ़ोटो, या उसका पाठ। Gemini छोटे पाठ बनाता है, तख़्ती हर पाठ का गणित, उम्र के हिसाब से संख्याएँ, वाक्यों की लंबाई और जवाब जाँचती है, और आप हर पाठ के उद्देश्य मंज़ूर करते हैं। बच्चे इन्हें कहानी की आग पर खेलते हैं।'
      : "Give it one chapter — a PDF, a photo of the textbook page, or its text. Gemini drafts short lessons, Takhti checks every one (the arithmetic, numbers for the age, sentence lengths, that each answer is really right and not given away), and you approve each lesson's aims. Children play them at the Story Fire."}</div>

    <div class="row" style="gap:8px;margin-top:10px">
      <select class="input" style="flex:1" onchange="S.ctx.sylCls=this.value;render()">
        ${SYL_CLASSES.map(k => `<option value="${k.id}" ${k.id === cls.id ? 'selected' : ''}>${hi ? k.hi : k.en}</option>`).join('')}
      </select>
      <select class="input" style="width:auto" onchange="S.ctx.sylCount=Number(this.value)">
        ${[2,3,4,5].map(n => `<option value="${n}" ${n === (c.sylCount || 3) ? 'selected' : ''}>${n} ${hi ? 'पाठ' : 'lessons'}</option>`).join('')}
      </select>
    </div>
    <label class="btn ghost" style="margin-top:8px;display:block;text-align:center;cursor:pointer">
      📎 ${c.sylFile ? attr(c.sylFile.name) : (hi ? 'PDF या फ़ोटो चुनें' : 'Choose a PDF or photo')}
      <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style="display:none" onchange="sylPickFile(this)">
    </label>
    <textarea class="input" style="margin-top:8px;min-height:70px" placeholder="${hi ? '…या अध्याय का पाठ यहाँ चिपकाएँ' : '…or paste the chapter text here'}" oninput="S.ctx.sylText=this.value">${attr(c.sylText || '')}</textarea>
    <input class="input" style="margin-top:8px" maxlength="200" value="${attr(c.sylNote || '')}" oninput="S.ctx.sylNote=this.value"
      placeholder="${hi ? 'कोई निर्देश? जैसे "हासिल वाले जोड़ पर ध्यान दें" (वैकल्पिक)' : 'Anything to focus on? e.g. "carrying in addition" (optional)'}">
    ${c.sylNeedKey ? `<input class="input" style="margin-top:8px" type="password" value="${attr(c.sylKey || '')}" oninput="S.ctx.sylKey=this.value"
      placeholder="${hi ? 'स्कूल की कुंजी' : 'School key'}">` : ''}
    <button class="btn" style="margin-top:8px" ${c.sylBusy ? 'disabled' : ''} onclick="sylGo()">${c.sylBusy
      ? (hi ? '⏳ Gemini पाठ बना रहा है, तख़्ती जाँच रही है…' : '⏳ Gemini is drafting, Takhti is checking…')
      : (hi ? '✨ इस हफ़्ते के पाठ बनाओ' : "✨ Draft this week's lessons")}</button>
    ${c.sylMsg ? `<div class="retry" style="font-size:12.5px;margin-top:6px">${attr(c.sylMsg)}</div>` : ''}

    ${res ? `<div style="margin-top:12px">
      <div style="font-size:12.5px;opacity:.8">${hi
        ? `"${attr(res.chapter || 'अध्याय')}" से ${res.drafts.length} पाठ · ${res.drafts.filter(d => d.ok).length} जाँच में पास${res.drafts.some(d => d.repaired) ? ` (${res.drafts.filter(d => d.repaired).length} Gemini ने जाँच के कारण पढ़कर ठीक किए)` : ''}`
        : `${res.drafts.length} lesson(s) from "${attr(res.chapter || 'the chapter')}" · ${res.drafts.filter(d => d.ok).length} passed the check${res.drafts.some(d => d.repaired) ? ` (${res.drafts.filter(d => d.repaired).length} fixed by Gemini from the checker's reasons)` : ''}`}</div>
      ${res.drafts.map((d, i) => sylDraftHTML(d, i, approved, badge)).join('')}
      ${res.drafts.filter(d => d.ok && !approved.some(a => a.id === d.lesson.id)).length > 1
        ? `<button class="btn leaf" style="margin-top:8px" onclick="sylApproveAll()">${hi ? 'सभी जाँचे हुए पाठों के उद्देश्य मंज़ूर करें' : "Approve all the checked lessons' aims"}</button>` : ''}
    </div>` : ''}

    ${approved.length ? `<div class="kicker2" style="margin-top:14px">${hi ? 'कक्षा के लिए मंज़ूर' : 'APPROVED FOR THE CLASS'}</div>
      ${approved.map(l => `<div class="metric"><div><b>${l.ic || '📘'} ${attr(L(l.title))}</b>
        <div style="font-size:12px;opacity:.7">${(l.aims || []).length ? (l.aims || []).map(a => attr(L(a))).join(' · ') : attr(L(l.sub))}</div></div>
        <button class="btn ghost" style="width:auto;padding:6px 12px" onclick="sylRemove('${l.id}')">${hi ? 'हटाओ' : 'Remove'}</button></div>`).join('')}
      <div style="font-size:12px;opacity:.7;margin-top:6px">${S.syncClasses.includes(code)
        ? (hi ? 'इस फ़ोन के बच्चों को और सिंक वाले हर फ़ोन को मिलते हैं — हर फ़ोन इन्हें दिखाने से पहले फिर जाँचता है।' : 'Children on this phone get them, and so does every synced phone — each one checks them again before showing them.')
        : (hi ? 'इस फ़ोन के बच्चों को मिलते हैं। दूसरे फ़ोनों तक भेजने के लिए ऊपर "कक्षा को सिंक रखो" चालू करें।' : 'Children on this phone get them. To reach other phones, switch on "Keep this class synced" above.')}</div>` : ''}
  </div>`;
}

/* One draft, as the teacher reads it: every line the child will hear or
   read, the two answers with the right one marked, and how it was checked. */
function sylDraftHTML(d, i, approved, badge){
  const hi = S.lang === 'hi', les = d.lesson, isIn = approved.some(a => a.id === les.id);
  const T = o => o ? attr(hi ? o.hi : o.en) : '';
  let k = 0;
  const lines = (les.beats || []).map(b => {
    if(b.t === 'ask'){
      const opts = hi ? b.hiOpts || b.opts : b.opts, check = d.checks[k++];
      return `<div style="margin:4px 0 4px 10px">❓ ${T(b.q)}<div style="font-size:12.5px">${(opts || []).map((o, j) =>
        `<span style="margin-right:10px;${j === b.correct ? 'font-weight:700' : 'opacity:.7'}">${j === b.correct ? '✓' : '✗'} ${attr(o)}</span>`).join('')}
        ${check ? `<span style="opacity:.7">· ${badge(check)}</span>` : ''}</div>
        ${b.why ? `<div style="font-size:12px;opacity:.75;font-style:italic">${hi ? 'बच्चे दूसरा जवाब क्यों चुनते हैं' : 'Why children pick the other answer'}: ${T(b.why)}</div>` : ''}</div>`;
    }
    const pic = { count:`${b.n}`, add:`${b.a} + ${b.b}`, take:`${b.a} − ${b.b}`, group:`${b.a}`, line:`${b.a}, +${b.b} × ${b.hops}`,
                  array:`${b.a} × ${b.b}`, share:`${b.a} ÷ ${b.b}`, bar:`${b.a} = ${b.b} + ?`, frac:`1/${b.b}` }[b.t];
    const shape = b.t === 'figure' ? `[${b.kind}${b.kind === 'square' ? ' ' + b.s : b.kind === 'rectangle' ? ` ${b.w} × ${b.h}` : b.kind === 'triangle' ? ' ' + (b.sides || []).join(', ') : b.folds ? `, ${b.folds} folds` : ''}${b.ask ? ' · asks ' + b.ask : ''}]`
      : b.t === 'corner' ? `[corner ${b.deg}°]` : b.t === 'figures' ? `[${(b.items || []).map((it, n) => `${n + 1}: ${it.kind === 'corner' ? it.deg + '°' : it.kind}`).join(' · ')} · find ${b.find}]` : '';
    if(shape) return `<div style="margin:3px 0 3px 10px;font-size:13px"><span style="font-family:var(--mono);opacity:.75">${attr(shape)}</span>${b.say ? ` ${T(b.say)}` : ''}</div>`;
    const words = b.t === 'passage' ? `📖 ${T(b.p)}` : b.t === 'word' ? `🔤 ${attr(b.w)}` : b.t === 'readline' ? `🗣 ${attr(b.text)}` : '';
    return `<div style="margin:3px 0 3px 10px;font-size:13px">${pic ? `<span style="font-family:var(--mono);opacity:.75">[${b.t} ${pic}]</span> ` : ''}${words}${b.say ? ` ${T(b.say)}` : ''}</div>`;
  }).join('');
  const why = (d.repairErrors || d.errors || []).slice(0, 3);
  return `<div class="card" style="margin-top:8px;padding:10px;${d.ok ? '' : 'opacity:.75;border:1px dashed var(--line)'}">
    <b>${les.ic} ${T(les.title)}</b> <span style="font-size:12px;opacity:.7">${T(les.sub)}</span>
    ${les.skillId && skillById(les.skillId) ? `<div style="font-size:12px;opacity:.75">${hi ? 'कौशल' : 'Skill'}: ${attr(hi ? skillById(les.skillId).hi : skillById(les.skillId).en)}</div>` : ''}
    ${les.source ? `<div style="font-size:12px;opacity:.6">${hi ? 'स्रोत' : 'From'}: ${attr(les.source)}</div>` : ''}
    ${(les.aims || []).length ? `<div style="margin-top:6px"><div class="kicker2" style="font-size:10.5px">${hi ? 'उद्देश्य — बच्चा यह कर पाएगा' : 'AIMS — THE CHILD WILL BE ABLE TO'}</div>
      ${les.aims.map(a => `<div style="font-size:13.5px;margin:2px 0">• ${T(a.point)}</div>`).join('')}
      <details style="margin-top:2px"><summary style="font-size:12px;cursor:pointer;opacity:.8">🐘 ${hi ? 'बाद में मुन्नी ये भूलेगी — बच्चा उसे वापस सिखाएगा' : 'Afterwards Munni forgets these — the child teaches her back'}</summary>
        ${les.aims.map(a => `<div style="font-size:12.5px;margin:3px 0 3px 10px">${T(a.short)}: "${T(a.forget)}"</div>`).join('')}</details></div>` : ''}
    ${(d.aimErrors || []).length ? `<div style="font-size:12px;opacity:.7;margin-top:2px">${hi ? 'छोड़े गए उद्देश्य' : 'Aims left out'}: ${d.aimErrors.slice(0, 2).map(attr).join('; ')}</div>` : ''}
    ${(d.aimFixes || []).length ? `<div style="font-size:12px;opacity:.7;margin-top:2px">${hi ? 'बदला गया संकेत' : 'Hint replaced'}: ${d.aimFixes.slice(0, 2).map(attr).join('; ')}</div>` : ''}
    ${d.ok && sylAimGaps(les).length ? `<div class="retry" style="font-size:12.5px;margin-top:4px">⚠ ${hi ? 'इस उद्देश्य को कोई प्रश्न नहीं जाँचता' : 'No question checks this aim'}: ${sylAimGaps(les).map(a => T(a.point || a)).join('; ')}</div>` : ''}
    <details style="margin-top:4px"><summary style="font-size:12.5px;cursor:pointer">${hi ? 'पूरा पाठ पढ़ें' : 'Read the whole lesson'}</summary>${lines}</details>
    ${d.ok
      ? (isIn ? `<div class="muted" style="font-size:12.5px;margin-top:4px">✓ ${hi ? 'कक्षा के लिए मंज़ूर' : 'Approved for the class'}</div>`
              : `<button class="btn ghost" style="margin-top:6px" onclick="sylApprove(${i})">${hi ? 'ये उद्देश्य मंज़ूर करें' : 'Approve these aims'}</button>`)
      : `<div class="retry" style="font-size:12.5px;margin-top:4px">${hi ? 'उपयोग नहीं होगा — जाँच में नहीं पास हुआ' : "Not used — it didn't pass the check"}: ${why.map(attr).join('; ')}${d.unchanged ? (hi ? ' (Gemini के सुधार में कुछ नहीं बदला)' : " (Gemini's fix changed nothing)") : ''}</div>`}
  </div>`;
}

async function sylPickFile(input){
  const f = input.files && input.files[0];
  if(!f) return;
  const hi = S.lang === 'hi';
  if(f.size > 12 * 1024 * 1024){ S.ctx.sylMsg = hi ? 'फ़ाइल बहुत बड़ी है — एक अध्याय या कुछ पन्ने भेजें।' : 'That file is too big — send one chapter, or a few pages.'; S.ctx.sylFile = null; return render(); }
  try{
    S.ctx.sylFile = { name: f.name, mime: f.type, b64: await sylReadFile(f) };
    S.ctx.sylMsg = '';
  }catch(e){ S.ctx.sylMsg = hi ? 'यह फ़ाइल पढ़ी नहीं जा सकी।' : "That file couldn't be read."; }
  render();
}

async function sylGo(){
  const c = S.ctx, hi = S.lang === 'hi';
  if(c.sylBusy) return;
  const text = (c.sylText || '').trim();
  if(!c.sylFile && text.length < 40){ c.sylMsg = hi ? 'पहले अध्याय दें — PDF, फ़ोटो, या उसका पाठ।' : 'Give it the chapter first — a PDF, a photo, or its text.'; return render(); }
  if(!S.online){ c.sylMsg = hi ? 'पाठ बनाने के लिए इंटरनेट चाहिए। बच्चों के मंज़ूर पाठ बिना इंटरनेट चलते रहेंगे।' : 'Drafting needs a connection. Approved lessons keep working offline for the children.'; return render(); }
  c.sylBusy = true; c.sylMsg = ''; render();
  try{
    const chapter = c.sylFile ? { file: c.sylFile.b64, mime: c.sylFile.mime, text } : { text };
    c.sylRes = await sylDraft({ cls: c.sylCls || 'c2', count: c.sylCount || 3, note: (c.sylNote || '').trim(), chapter });
    c.sylNeedKey = false;
    if(!c.sylRes.drafts.length) c.sylMsg = hi ? 'Gemini ने कोई पाठ नहीं लौटाया — दूसरा अध्याय या साफ़ फ़ोटो आज़माएँ।' : 'Gemini sent back no lessons — try another chapter or a clearer photo.';
  }catch(e){
    c.sylNeedKey = e.status === 403;
    c.sylMsg = e.status === 503 ? (hi ? 'इस सर्वर पर Gemini अभी चालू नहीं है।' : "Gemini isn't set up on this server yet.")
             : e.status === 403 ? (hi ? 'इस सर्वर के लिए स्कूल की कुंजी चाहिए — नीचे डालें और फिर कोशिश करें।' : 'This server needs the school key — enter it and try again.')
             : e.status === 413 ? (hi ? `फ़ाइल इस सर्वर के लिए बड़ी है${e.maxMb ? ` (${e.maxMb} MB तक)` : ''} — सिर्फ़ अध्याय के पन्ने भेजें।` : `That file is too big for this server${e.maxMb ? ` (up to ${e.maxMb} MB)` : ''} — send just the chapter's pages.`)
             : e.status === 429 ? (hi ? 'अभी के लिए बहुत हो गया — थोड़ी देर बाद कोशिश करें।' : 'That is enough for now — try again in a while.')
             : (hi ? 'Gemini तक नहीं पहुँच पाए — थोड़ी देर में फिर कोशिश करें।' : "Couldn't reach Gemini — try again shortly.");
    log(2, `Syllabus · not drafted (${e.message})`);
  }
  c.sylBusy = false;
  render();
}

function sylApprove(i){
  const code = teacherCode(), d = S.ctx.sylRes && S.ctx.sylRes.drafts[i];
  if(!code || !d || !d.ok) return;
  sylSave(code, sylApproved(code).filter(l => l.id !== d.lesson.id).concat(d.lesson));
  log(0, `Syllabus · teacher approved "${d.lesson.title.en}" for class ${code}`);
  teacherSyncIfOn(code);
}
function sylApproveAll(){
  const code = teacherCode(), res = S.ctx.sylRes;
  if(!code || !res) return;
  const add = res.drafts.filter(d => d.ok).map(d => d.lesson);
  sylSave(code, sylApproved(code).filter(l => !add.some(a => a.id === l.id)).concat(add));
  log(0, `Syllabus · teacher approved ${add.length} lesson(s) for class ${code}`);
  teacherSyncIfOn(code);
}
function sylRemove(id){
  const code = teacherCode();
  if(!code) return;
  sylSave(code, sylApproved(code).filter(l => l.id !== id));
  log(0, `Syllabus · teacher removed a lesson from class ${code}`);
  teacherSyncIfOn(code);
}

if(typeof VIEWS !== 'undefined') VIEWS.teacher = teacherHTML;


/* ==================================================================
   HOW EACH CHILD IS TAKING THIS WEEK'S LESSONS (core/planner.js)

   The same approved aims, a different path per child — from the paths the
   children's phones keep in the class mirror and carry with the class sync
   (ids and short codes only, under the parent's consent). Grouped the way a
   teacher would ask: who already knew it, who is being taken back to
   something underneath first, and which way each of the others is being
   taught. Never compared, never ranked: a path is how, not how well.
   ================================================================== */
const PLAN_TEACHER_WAY = {
  show:    { en: 'Pictures first',                   hi: 'पहले चित्र' },
  cartoon: { en: 'The cartoon first',                hi: 'पहले कार्टून' },
  story:   { en: 'Straight into the school’s lesson', hi: 'सीधे स्कूल का पाठ' },
  model:   { en: 'Munni reads it to them first',     hi: 'मुन्नी पहले पढ़कर सुनाती है' },
  chunks:  { en: 'Hard words in pieces',             hi: 'कठिन शब्द टुकड़ों में' },
  solo:    { en: 'They read it first',               hi: 'पहले ख़ुद पढ़ते हैं' },
  '':      { en: 'The school’s lesson',              hi: 'स्कूल का पाठ' }
};
function planTeacherHTML(code){
  const lessons = sylApproved(code), all = readClassShared(code), hi = S.lang === 'hi';
  const T = o => attr((o && (o[S.lang] || o.en)) || '');
  const kids = Object.entries(all).filter(([id, c]) => !id.startsWith('_') && c && c.paths);
  const cards = lessons.map(les => {
    const groups = {};
    for(const [, c] of kids){
      const p = c.paths[les.id];
      if(!p) continue;
      const sk = p.g && typeof skillById === 'function' ? skillById(p.g) : null;
      const key = p.k ? 'k' : p.g ? 'g:' + p.g : 'w:' + (p.w || '');
      const label = p.k ? (hi ? 'पहले से आता था — दिखाते हैं, फिर मुन्नी को सिखाते हैं' : 'Already knew it — shows it, then teaches Munni')
        : p.g ? (hi ? `पहले नीचे की बात: ${sk ? sk.hi || sk.en : p.g}` : `Something underneath first: ${sk ? sk.en : p.g}`)
        : T(PLAN_TEACHER_WAY[p.w] || PLAN_TEACHER_WAY['']);
      (groups[key] = groups[key] || { label, kids: [] }).kids.push(`${attr(c.childName || '?')} <small style="opacity:.6">${p.d}/${p.n}</small>`);
    }
    const rows = Object.values(groups);
    if(!rows.length) return '';
    return `<div style="margin-top:8px"><b style="font-size:13.5px">${T(les.title)}</b>
      ${rows.map(g => `<div class="planrow" style="font-size:12.5px;margin-top:3px">• ${g.label}: ${g.kids.join(', ')}</div>`).join('')}</div>`;
  }).filter(Boolean);
  if(!cards.length) return '';
  return `<div class="paper" style="margin-top:12px">
    <div class="kicker2">🧭 ${hi ? 'इस हफ़्ते के पाठ — हर बच्चे का अपना रास्ता' : 'HOW EACH CHILD IS TAKING THIS WEEK’S LESSONS'}</div>
    <div style="font-size:12.5px;opacity:.75">${hi ? 'उद्देश्य वही जो आपने मंज़ूर किए; हर बच्चे का तरीक़ा मुन्नी उसी के रिकॉर्ड से चुनती है। अंक = पूरे हुए क़दम।' : 'The same aims you approved; Munni picks each child’s way from what has worked for them. The numbers are steps done.'}</div>
    ${cards.join('')}
  </div>`;
}
