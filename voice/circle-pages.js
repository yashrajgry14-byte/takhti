/* ==================================================================
   CIRCLE PAGES — one private page for each grown-up around a child

     /circle/p/:token   the parent: this week, tonight at home, the Friday
                        check, notes, who's in the circle (approve, remove,
                        invite a tutor), messages on/off
     /circle/t/:token   the tuition teacher: one pack per student — the
                        focus and why, what went wrong this week, three
                        ready questions with the mistake to watch for, a
                        place to tick results and leave a note
     /circle/c/:token   the class teacher: the class's focus, everyone's
                        week and Friday check, next week's suggestions,
                        family codes, linking a tutor

   The link is the key, as with the reading card. Server-rendered HTML
   and plain forms: they open from a WhatsApp link on a cheap phone.
   Parent and tutor pages are in that person's language; every string in
   both. Nothing here is ever shown to, or sent to, a child.
   ================================================================== */
'use strict';
const { shell, MUNNI, esc } = require('./pages');
const { LADDER } = require('./placement');

const H = (lang, en, hi) => (lang === 'hi' ? hi : en);
const btn = 'class="btn" style="margin:4px 0 0;padding:7px 12px"';
const small = 'class="sub"';
const VERDICT = {
  mastered: { en: 'Solid', hi: 'पक्का' }, nearly: { en: 'Nearly', hi: 'लगभग' }, not_yet: { en: 'Not yet', hi: 'अभी नहीं' }
};
const SOURCE = {
  homework: { en: "from the teacher's homework", hi: 'टीचर के होमवर्क से' }, 'last check': { en: "from last Friday's check", hi: 'पिछले शुक्रवार के टेस्ट से' },
  takhti: { en: "from Takhti's record", hi: 'तख़्ती के रिकॉर्ड से' }, placement: { en: 'from the placement call', hi: 'प्लेसमेंट कॉल से' },
  'teacher note': { en: "from a teacher's note", hi: 'टीचर के नोट से' }, 'class call': { en: 'from the class teacher', hi: 'कक्षा के टीचर से' },
  teacher: { en: 'set by the teacher', hi: 'टीचर ने तय किया' }, note: { en: 'from a note', hi: 'एक नोट से' }
};
const src = (s, lang) => (SOURCE[s] || SOURCE.takhti)[lang === 'hi' ? 'hi' : 'en'];

/* ---------------- the parent ---------------- */
function parentPage(circle, child, tok, msg) {
  const lang = child.parent_lang || child.lang;
  const w = circle.focusFor(child);
  const v = circle.view(child, 'parent');
  const m = v.members;
  const n = esc(child.name);
  const hist = require('./evidence').combinedHistory(child)[w.skill] || { n: 0, right: 0 };
  const tries = hist.n - (w.start.n || 0), right = hist.right - (w.start.right || 0);
  const act = (path, fields, label, style) => `<form method="post" action="/circle/p/${esc(tok)}/${path}" style="display:inline-flex;gap:6px;flex-wrap:wrap">${fields}<button ${btn}${style ? ` style="${style}"` : ''}>${label}</button></form>`;
  const hid = (k, val) => `<input type="hidden" name="${k}" value="${esc(val)}">`;
  const home = w.home.map(h => `<li style="margin:8px 0">${esc(h.text[lang] || h.text.en)} ${h.done_at
    ? `<span class="chip ok">${H(lang, 'done', 'हो गया')}</span>`
    : act('home', hid('id', h.id), H(lang, 'We did it ✓', 'कर लिया ✓'))}</li>`).join('');
  const k = w.check;
  const check = k ? `<p><b>${k.right} / ${k.of}</b> · ${VERDICT[k.verdict][lang === 'hi' ? 'hi' : 'en']}${k.source === 'reading' ? ` <span ${small}>(${H(lang, "from this week's reading", 'इस हफ़्ते के पढ़ने से')})</span>` : ''}</p>${k.next && k.next.why ? `<p ${small}>${esc(k.next.why[lang] || k.next.why.en)}</p>` : ''}`
    : `<p ${small}>${H(lang, 'Friday to Sunday: three questions on this week\'s step, in the app or on a call.', 'शुक्रवार से रविवार: इस हफ़्ते के कदम पर तीन सवाल, ऐप में या कॉल पर।')}</p>`;
  const tutors = m.tutors.map(t => `<li>${esc(t.name)} ${t.status === 'pending'
    ? `<span class="chip mid">${H(lang, 'waiting for you', 'आपकी हाँ का इंतज़ार')}</span> ${act('tutor', hid('id', t.id) + hid('action', 'approve'), H(lang, 'Approve', 'हाँ'))} ${act('tutor', hid('id', t.id) + hid('action', 'decline'), H(lang, 'Decline', 'नहीं'), 'background:#6E6355')}`
    : act('tutor', hid('id', t.id) + hid('action', 'remove'), H(lang, 'Remove', 'हटाएँ'), 'background:#6E6355')}</li>`).join('');
  const notes = v.notes.map(x => `<li>${esc(x.by)}: ${esc(x.skill_name[lang === 'hi' ? 'hi' : 'en'])} · ${x.ok ? H(lang, 'did well', 'अच्छा किया') : H(lang, 'found it hard', 'दिक्कत हुई')} <span ${small}>${esc(String(x.at).slice(0, 10))}</span></li>`).join('');
  const c = child.circle;
  const app = c.sync && c.sync.on
    ? H(lang, `The Takhti app is in sync (last ${esc(String(c.sync.last || c.sync.at).slice(0, 16).replace('T', ' '))}).`, `तख़्ती ऐप साथ जुड़ा है (आख़िरी बार ${esc(String(c.sync.last || c.sync.at).slice(0, 16).replace('T', ' '))})।`)
    : c.link_code ? H(lang, `Using the Takhti app? On its parent page, enter this family code: <b>${esc(c.link_code)}</b>`, `तख़्ती ऐप इस्तेमाल करते हैं? उसके पेरेंट पेज पर यह फ़ैमिली कोड डालें: <b>${esc(c.link_code)}</b>`) : '';
  const body = `<div class="sheet">
    <div class="head">${MUNNI}<div><h1>${H(lang, `${n}'s learning circle`, `${n} का सीखने का घेरा`)}</h1><div class="sub">Takhti · तख़्ती</div></div></div>
    ${msg ? `<p class="flag" style="color:var(--leaf)">${esc(msg)}</p>` : ''}
    <h2>${H(lang, 'This week', 'इस हफ़्ते')}: ${esc(circle.skillName(w.skill, lang))}</h2>
    <p>${esc(w.why[lang] || w.why.en)} <span ${small}>(${esc(src(w.source, lang))})</span></p>
    <p ${small}>${H(lang, `So far this week: ${tries} tries, ${right} right.`, `इस हफ़्ते अब तक: ${tries} कोशिशें, ${right} सही।`)}</p>
    <h2>${H(lang, 'At home', 'घर पर')}</h2><ul class="lines" style="font-size:16px">${home}</ul>
    <h2>${H(lang, 'Friday check', 'शुक्रवार वाला छोटा टेस्ट')}</h2>${check}
    ${notes ? `<h2>${H(lang, 'Notes from teachers', 'टीचर्स के नोट')}</h2><ul>${notes}</ul>` : ''}
    <h2>${H(lang, "Who's in the circle", 'घेरे में कौन है')}</h2>
    <p>${m.school ? esc(m.school) : ''}${m.class_code ? ` · ${H(lang, 'class', 'कक्षा')} ${esc(m.class_code)}` : ''}${m.teachers.length ? ` · ${esc(m.teachers.join(', '))}` : ''}</p>
    ${tutors ? `<ul>${tutors}</ul>` : `<p ${small}>${H(lang, 'No tuition teacher yet.', 'अभी कोई ट्यूशन टीचर नहीं।')}</p>`}
    <form method="post" action="/circle/p/${esc(tok)}/invite"><input name="name" placeholder="${H(lang, "Tuition teacher's name", 'ट्यूशन टीचर का नाम')}" required>
      <input name="phone" placeholder="+91…" required><select name="lang"><option value="hi">हिंदी</option><option value="en">English</option></select>
      <button ${btn}>${H(lang, 'Invite', 'जोड़ें')}</button></form>
    <p ${small}>${H(lang, `A tuition teacher you invite sees ${n}'s practice and this week's step, never a voice or a photo. Remove them any time.`, `आप जिन ट्यूशन टीचर को जोड़ते हैं, वे ${n} का अभ्यास और इस हफ़्ते का कदम देखते हैं, आवाज़ या फ़ोटो कभी नहीं। कभी भी हटा सकते हैं।`)}</p>
    ${app ? `<p ${small}>${app}</p>` : ''}
    <h2>${H(lang, 'Messages', 'संदेश')}</h2>
    ${act('messages', hid('on', c.messages_off ? 'yes' : 'no'), c.messages_off ? H(lang, 'Turn WhatsApp updates back on', 'WhatsApp संदेश फिर चालू करें') : H(lang, 'Stop WhatsApp updates', 'WhatsApp संदेश बंद करें'), c.messages_off ? '' : 'background:#6E6355')}
  </div>`;
  return shell(H(lang, `${child.name}'s circle`, `${child.name} का घेरा`), lang, body);
}

/* ---------------- the tuition teacher ---------------- */
const DAYS = { en: ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hi: ['', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'] };
function tutorPage(circle, t, msg) {
  const lang = t.lang === 'en' ? 'en' : 'hi';
  const kids = circle.tutorChildren(t);
  const sch = t.schedule;
  const days = [1, 2, 3, 4, 5, 6, 7].map(d => `<label style="margin-right:6px"><input type="checkbox" name="d${d}" value="1"${sch && sch.days.includes(d) ? ' checked' : ''}> ${DAYS[lang][d]}</label>`).join('');
  const packs = kids.map(ch => {
    const p = circle.tutorPack(t, ch);
    const misses = p.misses.length ? `<ul>${p.misses.map(x => `<li><code>${esc(x.problem)}</code> = ${esc(x.answer)} · ${x.silent ? H(lang, 'went quiet', 'चुप रहे') : H(lang, `said "${esc(x.said)}"`, `बोले "${esc(x.said)}"`)}</li>`).join('')}</ul>`
      : `<p ${small}>${H(lang, 'Nothing missed on calls this week yet.', 'इस हफ़्ते कॉल पर अभी कोई चूक नहीं।')}</p>`;
    const qs = p.questions.length ? `<form method="post" action="/circle/t/${esc(t.token)}/result"><input type="hidden" name="child" value="${esc(ch.id)}">
      <ol>${p.questions.map((q, i) => `<li style="margin:8px 0"><span class="txt" style="font-size:24px">${esc(q.text)} = ?</span><br>
        <span ${small}>${H(lang, 'Answer', 'जवाब')}: <b>${esc(q.answer)}</b>${q.mistake != null && q.means ? ` · ${H(lang, `if they say ${esc(q.mistake)}: ${esc(q.means)}`, `अगर ${esc(q.mistake)} कहें: ${esc(q.means)}`)}` : ''}</span><br>
        <label><input type="checkbox" name="q${i}" value="right"> ${H(lang, 'got it right first time', 'पहली बार में सही')}</label></li>`).join('')}</ol>
      <button ${btn}>${H(lang, 'Save results', 'नतीजे सेव करें')}</button></form>`
      : `<p ${small}>${H(lang, 'This step is practised by reading, not sums: listen to them read one line from their book.', 'यह कदम सवालों से नहीं, पढ़ने से होता है: उनसे किताब की एक लाइन पढ़वाकर सुनें।')}</p>`;
    const done = (ch.circle.week.tutor_results || []).filter(r => r.tutor === t.id).map(r => `${r.right}/${r.of}`).join(', ');
    return `<div class="sheet" id="${esc(ch.id)}" style="margin-top:14px">
      <h2 style="margin-top:0">${esc(ch.name)} · ${esc(String(ch.age))} ${H(lang, 'yrs', 'साल')}</h2>
      <p><b>${H(lang, 'This week', 'इस हफ़्ते')}: ${esc(p.skill_name)}</b><br>${esc(p.why)}</p>
      <p ${small}>${H(lang, `${p.so_far.tries} tries this week, ${p.so_far.right} right`, `इस हफ़्ते ${p.so_far.tries} कोशिशें, ${p.so_far.right} सही`)}${p.check ? ` · ${H(lang, 'Friday check', 'शुक्रवार टेस्ट')}: ${p.check.right}/${p.check.of}` : ''}${done ? ` · ${H(lang, 'your results', 'आपके नतीजे')}: ${esc(done)}` : ''}</p>
      <h2>${H(lang, 'What went wrong', 'क्या ग़लत हुआ')}</h2>${misses}
      ${p.quiet.length ? `<p ${small}>${H(lang, `Went quiet most on: ${esc(p.quiet.join(', '))}. Go gently there.`, `सबसे ज़्यादा चुप्पी: ${esc(p.quiet.join(', '))}। वहाँ धीरे चलें।`)}</p>` : ''}
      ${p.notes.length ? `<p ${small}>${p.notes.map(x => `${esc(x.by)}: ${esc(x.skill)} ${x.ok ? '✓' : '✗'}`).join(' · ')}</p>` : ''}
      <h2>${H(lang, 'Three questions for today', 'आज के तीन सवाल')}</h2>${qs}
      <h2>${H(lang, 'A note for the circle', 'घेरे के लिए एक नोट')}</h2>
      <form method="post" action="/circle/t/${esc(t.token)}/note"><input type="hidden" name="child" value="${esc(ch.id)}">
        <input name="text" size="34" placeholder="${H(lang, 'e.g. finds carrying hard', 'जैसे: हासिल में दिक्कत')}" required><button ${btn}>${H(lang, 'Save', 'सेव')}</button></form>
      <p ${small}>${H(lang, 'At home this week', 'इस हफ़्ते घर पर')}: ${p.home.map(h => esc(h.text) + (h.done ? ' ✓' : '')).join(' · ')}</p>
    </div>`;
  }).join('');
  return shell(H(lang, `${t.name} · Takhti`, `${t.name} · तख़्ती`), lang, `
    <div class="sheet"><div class="head">${MUNNI}<div><h1>${H(lang, `Namaste ${esc(t.name)}`, `नमस्ते ${esc(t.name)} जी`)}</h1><div class="sub">${H(lang, 'Your students on Takhti', 'तख़्ती पर आपके छात्र')}</div></div></div>
    ${msg ? `<p style="color:var(--leaf);font-weight:600">${esc(msg)}</p>` : ''}
    <form method="post" action="/circle/t/${esc(t.token)}/schedule"><span>${H(lang, 'Your tuition days', 'आपके ट्यूशन के दिन')}:</span> ${days}
      <input type="time" name="time" value="${esc(sch ? sch.time : '17:00')}"><button ${btn}>${H(lang, 'Save', 'सेव')}</button></form>
    <p ${small}>${H(lang, 'An hour before each session you get a WhatsApp link to this page.', 'हर सत्र से एक घंटा पहले आपको इस पेज का WhatsApp लिंक मिलेगा।')}</p>
    ${kids.length ? '' : `<p>${H(lang, 'No students yet: a family or a school adds you.', 'अभी कोई छात्र नहीं: परिवार या स्कूल आपको जोड़ते हैं।')}</p>`}
    <button class="btn" onclick="window.print()" style="background:#6E6355">${H(lang, 'Print', 'प्रिंट')}</button></div>${packs}`);
}

/* ---------------- the class teacher ---------------- */
function classPage(circle, brain, teacher, msg) {
  const codes = teacher.class_codes || [];
  const skillOpts = [...LADDER.map(r => r[0]), 'read1', 'read2', 'read3', 'read4', 'read5', 'read6', 'h1-matra']
    .map(id => `<option value="${id}">${esc(circle.skillName(id, 'en'))}</option>`).join('');
  const sections = codes.map(code => {
    const rows = circle.classView(code);
    const sugg = {};
    for (const r of rows) if (r.check && r.check.next && r.check.next.skill) sugg[r.check.next.skill] = (sugg[r.check.next.skill] || 0) + 1;
    const top = Object.entries(sugg).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, k]) => `${esc(circle.skillName(id, 'en'))} (${k})`).join(', ');
    const tr = rows.map(r => `<tr><td>${esc(r.name)}${r.app ? ' <span class="chip ok">app</span>' : ''}${r.quiet && r.quiet.check_in ? ' <span class="flag">check in</span>' : ''}</td>
      <td>${esc(r.skill_name)}<br><span ${small}>${esc(r.source)}</span></td>
      <td>${r.week.tries} · ${r.week.right} ✓</td>
      <td>${r.check ? `${r.check.right}/${r.check.of} ${esc(VERDICT[r.check.verdict].en)}` : '–'}</td>
      <td>${r.check && r.check.next && r.check.next.skill ? esc(circle.skillName(r.check.next.skill, 'en')) : '–'}</td>
      <td>${r.home.done}/${r.home.of}</td>
      <td>${esc(r.tutors.join(', ') || '–')}${r.pending_tutors ? ` <span ${small}>(${r.pending_tutors} awaiting parent)</span>` : ''}</td>
      <td>${r.app ? '' : r.family_code ? `<code>${esc(r.family_code)}</code>` : `<form method="post" action="/circle/c/${esc(teacher.token)}/family-code"><input type="hidden" name="child" value="${esc(r.id)}"><button ${btn}>code</button></form>`}</td></tr>`).join('');
    return `<div class="sheet" style="margin-top:14px"><h2 style="margin-top:0">Class ${esc(code)}</h2>
      <form method="post" action="/circle/c/${esc(teacher.token)}/focus"><input type="hidden" name="code" value="${esc(code)}">
        <select name="skill">${skillOpts}</select><input name="note" placeholder="Note for families (optional)" size="22">
        <button ${btn}>Set this week's class focus</button></form>
      ${(() => { const hw = circle.classHomework(code); return hw ? `<form method="post" action="/circle/c/${esc(teacher.token)}/clear-focus" style="margin-top:6px"><input type="hidden" name="code" value="${esc(code)}">
        <span ${small}>Class focus now: <b>${esc((hw.skills || []).map(id => circle.skillName(id, 'en')).join(', '))}</b>${hw.note ? ` — “${esc(hw.note)}”` : ''}</span>
        <button ${btn}>Withdraw it</button></form>` : ''; })()}
      <p ${small}>Each child's app and calls adapt it to that child's real gap (a child weak on tables who's given BODMAS gets tables).${top ? ` Friday's checks suggest next: ${top}.` : ''}</p>
      <table><tr><th>Child</th><th>This week</th><th>Tries · right</th><th>Friday</th><th>Next</th><th>Home</th><th>Tutor</th><th>Family code</th></tr>${tr || '<tr><td colspan="8">No children linked to this class yet.</td></tr>'}</table>
      <form method="post" action="/circle/c/${esc(teacher.token)}/link-tutor" style="margin-top:10px"><select name="child">${rows.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select>
        <input name="name" placeholder="Tutor's name" required><input name="phone" placeholder="+91…" required><button ${btn}>Link a tuition teacher</button></form>
      <p ${small}>A tutor you link waits for the parent's yes before seeing anything.</p></div>`;
  }).join('');
  return shell(`Takhti · ${teacher.name}`, 'en', `<div class="sheet"><div class="head">${MUNNI}<div><h1>Namaste ${esc(teacher.name)}</h1><div class="sub">Your classes' learning circles</div></div></div>
    ${msg ? `<p style="color:var(--leaf);font-weight:600">${esc(msg)}</p>` : ''}
    <p ${small}>One step a week for every child, everywhere: the app, Munni's calls, the family and the tuition teacher all see the same.</p></div>${sections || '<p>No class codes on your record yet.</p>'}`);
}

module.exports = { parentPage, tutorPage, classPage };
