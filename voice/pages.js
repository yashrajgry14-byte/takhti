/* ==================================================================
   PAGES — the reading card, the parent report, the team dashboard.

   Server-rendered HTML, no client JavaScript: the card and report open
   from a WhatsApp link on a cheap phone, often on 2G. Same paper-and-ink
   daylight palette and fonts as the app (src/theme-light.css), and the
   same Munni.
   ================================================================== */
'use strict';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MUNNI = `<svg viewBox="40 40 170 110" width="120" height="78" aria-hidden="true">
  <path d="M62 92c-9 2-12 9-9 16" fill="none" stroke="#6E6355" stroke-width="3" stroke-linecap="round"/>
  <rect x="72" y="98" width="18" height="30" rx="8" fill="#6E6355"/><rect x="96" y="98" width="18" height="30" rx="8" fill="#6E6355"/>
  <rect x="120" y="98" width="18" height="30" rx="8" fill="#6E6355"/><rect x="144" y="98" width="18" height="30" rx="8" fill="#6E6355"/>
  <ellipse cx="112" cy="80" rx="52" ry="34" fill="#6E6355"/><circle cx="164" cy="66" r="30" fill="#6E6355"/>
  <ellipse cx="152" cy="60" rx="19" ry="22" fill="#2A2118"/><circle cx="176" cy="58" r="3.4" fill="#FBF6E9"/>
  <path d="M180 78c5 2 8 5 9 9" fill="none" stroke="#FBF6E9" stroke-width="3" stroke-linecap="round"/>
  <path d="M172 82c6 12 3 24-6 30s-8 14-2 18" fill="none" stroke="#6E6355" stroke-width="7" stroke-linecap="round"/>
</svg>`;

function shell(title, lang, body) {
  return `<!doctype html><html lang="${lang === 'hi' ? 'hi' : 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Mukta:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#2A2118;--dim:#6E6355;--paper:#FBF6E9;--card:#FFFDF6;--marigold:#E08A00;--leaf:#1E8F55;--rani:#D02A62;--line:rgba(42,33,24,.14)}
*{box-sizing:border-box}
body{margin:0;background:#EFE7D6;color:var(--ink);font:17px/1.55 'Mukta',system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:20px 16px 40px}
h1,h2,.display{font-family:'Baloo 2',system-ui,sans-serif;line-height:1.2;margin:0}
h1{font-size:26px} h2{font-size:19px;margin:22px 0 8px}
.sheet{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}
.head{display:flex;gap:12px;align-items:center;margin-bottom:6px}
.sub{color:var(--dim);font-size:15px}
ol.steps{padding-left:22px;margin:10px 0 0} ol.steps li{margin:4px 0}
.lines{list-style:none;padding:0;margin:8px 0 0}
.lines li{display:flex;gap:14px;align-items:baseline;border-top:1px dashed var(--line);padding:16px 0}
.lines li:first-child{border-top:none}
.num{font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:22px;color:var(--marigold);min-width:22px}
.txt{font-size:32px;line-height:1.35;font-weight:600}
.btn{display:inline-block;margin-top:18px;padding:12px 18px;border-radius:12px;background:var(--leaf);color:#fff;text-decoration:none;font-family:'Baloo 2',system-ui,sans-serif;font-weight:700;border:none;font-size:17px;cursor:pointer}
.note{margin-top:16px;color:var(--dim);font-size:14px}
.rep p{margin:6px 0}
table{border-collapse:collapse;width:100%;font-size:14px} td,th{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.chip{display:inline-block;padding:1px 7px;border-radius:999px;font-size:12px;margin:1px;border:1px solid var(--line)}
.ok{background:#E3F3E9;color:#14633B}.mid{background:#FCEFD6;color:#7A4B00}.no{background:#F1ECE2;color:#6E6355}
.turn{margin:4px 0}.turn b{font-family:'Baloo 2'}
code,pre{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
pre{white-space:pre-wrap;background:#F6F0E2;border-radius:10px;padding:10px;max-height:340px;overflow:auto}
form{display:flex;flex-wrap:wrap;gap:8px;align-items:center} input,select{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:#fff}
.flag{color:var(--rani);font-weight:600}
@media print{body{background:#fff}.btn,.note,form{display:none}.sheet{border:none}}
</style></head><body><main>${body}</main></body></html>`;
}

/* ---------- the reading card, for the family, before the call ---------- */
const C = {
  title:   { en: "{name}'s lines for today", hi: '{name} की आज की लाइनें' },
  steps:   { en: ['Copy these lines onto the takhti or into the notebook together.', 'When Munni calls, give {name} the phone and the notebook.', '{name} reads to Munni. No help needed: Munni will coach.'],
             hi: ['ये लाइनें साथ में तख़्ती या कॉपी पर लिख लें।', 'मुन्नी की कॉल आए तो {name} को फ़ोन और कॉपी दे दें।', '{name} मुन्नी को पढ़कर सुनाएँ। मदद की ज़रूरत नहीं, मुन्नी सिखाएगी।'] },
  oral:    { en: 'Nothing to prepare today. Munni will say these lines and {name} will say them after her.',
             hi: 'आज कुछ तैयार नहीं करना है। मुन्नी ये लाइनें बोलेगी और {name} उसके बाद बोलेंगे।' },
  print:   { en: 'Print this card', hi: 'कार्ड प्रिंट करें' },
  note:    { en: 'Writing the lines out is part of the lesson: copying, then reading what you wrote.', hi: 'लाइनें लिखना भी पाठ का हिस्सा है: पहले लिखना, फिर अपना लिखा पढ़ना।' }
};
const f = (o, lang, v) => { let s = o[lang] || o.en; for (const k in v) s = s.split('{' + k + '}').join(v[k]); return s; };

const EC = {
  title: { en: "{name}'s English words for today", hi: '{name} के आज के अंग्रेज़ी शब्द' },
  note:  { en: 'No need to prepare. If you like, say these words together before Munni calls.', hi: 'कुछ तैयार नहीं करना है। चाहें तो मुन्नी की कॉल से पहले ये शब्द साथ में बोल लें।' },
  words: { en: 'Words', hi: 'शब्द' }, phrases: { en: 'Sentences', hi: 'वाक्य' }
};
function englishCard(session, child) {
  const lang = session.lang, name = esc(child.name);
  const { wordByEn, PHRASES } = require('./english');
  const wordRows = (session.english.words || []).map(en => { const w = wordByEn(en); return `<li><span class="txt">${esc(en)}</span> <span class="sub">${esc(w ? w.hi : '')}</span></li>`; }).join('');
  const phraseRows = (session.english.phrases || []).map(en => { const p = PHRASES.find(x => x.en === en);
    return `<li><span class="txt" style="font-size:24px">${esc(en.replace('{name}', child.name))}</span> <span class="sub">${esc(p ? p.hi.replace('{name}', child.name) : '')}</span></li>`; }).join('');
  return shell(f(EC.title, lang, { name: child.name }), lang, `<div class="sheet">
    <div class="head">${MUNNI}<div><h1>${f(EC.title, lang, { name })}</h1><div class="sub">Takhti · तख़्ती</div></div></div>
    <p>${f(EC.note, lang, {})}</p>
    <h2>${f(EC.words, lang, {})}</h2><ul class="lines">${wordRows}</ul>
    <h2>${f(EC.phrases, lang, {})}</h2><ul class="lines">${phraseRows}</ul>
    <button class="btn" onclick="window.print()">${f(C.print, lang, {})}</button></div>`);
}

function cardPage(session, child) {
  if (session.kind === 'english' && session.english) return englishCard(session, child);
  const lang = session.lang;
  const oral = session.slots.includes('repeat') && !session.slots.includes('read');
  const name = esc(child.name);
  const steps = (C.steps[lang] || C.steps.en).map(x => `<li>${f({ en: x, hi: x }, lang, { name })}</li>`).join('');
  const body = `<div class="sheet">
    <div class="head">${MUNNI}<div><h1>${f(C.title, lang, { name })}</h1><div class="sub">Takhti · तख़्ती</div></div></div>
    ${oral ? `<p>${f(C.oral, lang, { name })}</p>` : `<ol class="steps">${steps}</ol>`}
    <ul class="lines">${session.lines.map((l, i) => `<li><span class="num">${i + 1}</span><span class="txt">${esc(l)}</span></li>`).join('')}</ul>
    ${oral ? '' : `<p class="note">${f(C.note, lang, {})}</p>`}
    <button class="btn" onclick="window.print()">${f(C.print, lang, {})}</button>
  </div>`;
  return shell(f(C.title, lang, { name: child.name }), lang, body);
}

/* ---------- the parent report, after the call ---------- */
function reportPage(session, child) {
  const lang = session.lang;
  const rep = session.report;
  if (!rep) {
    const msg = lang === 'hi' ? 'रिपोर्ट कॉल खत्म होने के बाद यहाँ दिखेगी।' : 'The report appears here after the call ends.';
    return shell('Takhti', lang, `<div class="sheet"><div class="head">${MUNNI}<h1>Takhti</h1></div><p>${msg}</p></div>`);
  }
  const [title, ...rest] = rep.text.split('\n');
  const share = rep.share ? `<a class="btn" href="${esc(rep.share)}">${lang === 'hi' ? 'WhatsApp पर शेयर करें' : 'Share on WhatsApp'}</a>` : '';
  // a progress code is for copying, not reading: its own selectable box
  const para = l => /^TKR1\./.test(l) ? `<pre style="user-select:all;word-break:break-all">${esc(l)}</pre>` : `<p>${esc(l)}</p>`;
  return shell(title, lang, `<div class="sheet rep"><div class="head">${MUNNI}<h1>${esc(title)}</h1></div>
    ${rest.map(para).join('')}${share}</div>`);
}

/* ---------- the team dashboard: the judge trace panel, for calls ---------- */
const OUT = { correct: 'ok', correct_after_clue: 'mid', revealed: 'mid', unsure: 'no' };
function chips(s) {
  return s.items.map(it => `<span class="chip ${OUT[it.outcome] || 'no'}" title="${esc(it.problem || it.target || it.prompt)}">${esc(it.kind)} · ${esc(it.outcome || 'open')}</span>`).join('');
}

function dashboardPage(brain, key, scope) {
  scope = scope || { super: true };
  const q = 'key=' + encodeURIComponent(key);
  const kids = brain.listChildren().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sessions = brain.listSessions().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
  const byId = Object.fromEntries(kids.map(k => [k.id, k]));
  const rows = sessions.map(s => {
    const k = byId[s.child_id];
    return `<tr><td>${esc(k ? k.name : '?')}<br><span class="sub">${esc(s.created_at.slice(0, 16).replace('T', ' '))}</span></td>
      <td>${esc(s.status)}${s.flags && s.flags.safeguarding ? '<br><span class="flag">review</span>' : ''}${s.silence && (s.silence.items.length || s.silence.ended_in_silence) ? `<br><span class="sub">quiet on ${s.silence.items.length}${s.silence.ended_in_silence ? ' · ended quiet' : ''}</span>` : ''}${s.ease ? '<br><span class="sub">eased start</span>' : ''}</td>
      <td>${chips(s)}</td>
      <td>${s.relay ? `${s.relay.mismatched}/${s.relay.checked}` : '–'}</td>
      <td><a href="/voice/admin/sessions/${esc(s.id)}?${q}">open</a></td></tr>`;
  }).join('');
  const parentRows = (brain.listParentCalls ? brain.listParentCalls() : []).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
    .map(c => `<tr><td>${esc(byId[c.child_id] ? byId[c.child_id].name : '?')}<br><span class="sub">${esc(c.created_at.slice(0, 16).replace('T', ' '))}</span></td>
      <td>${esc(c.kind)}</td><td>${esc(c.status)}</td><td>${esc(c.consent ? c.consent.status : c.outcome || '–')}${(c.changes || []).length ? '<br><span class="sub">' + esc(c.changes.join(', ')) + '</span>' : ''}</td>
      <td><a href="/voice/admin/parentcalls/${esc(c.id)}?${q}">open</a></td></tr>`).join('');
  const kidOpts = kids.map(k => `<option value="${esc(k.id)}">${esc(k.name)} (${k.age}, ${k.lang})</option>`).join('');
  const btn = 'class="btn" style="margin:0;padding:6px 10px"';
  const consentCell = k => {
    const c = k.consent || {};
    const label = { given: 'given', pending: 'waiting', needs_review: 'needs review', refused: 'refused' }[c.status || (c.given ? 'given' : 'pending')] || c.status;
    const how = c.given ? `${esc(c.method || '')}${c.recording ? ' · recording ok' : ' · no recording'}` : esc(c.why || c.last_result || '');
    const act = c.given ? '' : c.status === 'needs_review'
      ? `<form method="post" action="/voice/admin/children/${esc(k.id)}/consent-confirm?${q}"><a href="/voice/admin/parentcalls/${esc(c.call && c.call.session_id)}?${q}">listen</a> <button ${btn}>I heard a clear yes</button></form>`
      : c.status === 'refused' ? '' : `<form method="post" action="/voice/admin/children/${esc(k.id)}/consent-call?${q}"><button ${btn}>Consent call</button></form>`;
    const cc = k.circle || {};
    const circleBits = `<br><span class="sub">${cc.sync && cc.sync.on ? 'app in sync' : cc.link_code ? 'family code <code>' + esc(cc.link_code) + '</code>' : `<form method="post" action="/voice/admin/children/${esc(k.id)}/family-code?${q}" style="display:inline"><button class="btn" style="margin:0;padding:3px 8px;font-size:12px">family code</button></form>`}${cc.parent_token ? ` · <a href="/circle/p/${esc(cc.parent_token)}">parent page</a>` : ''}</span>`;
    return `<span class="chip ${c.given ? 'ok' : c.status === 'needs_review' ? 'mid' : 'no'}">${esc(label)}</span><br><span class="sub">${how}</span>${act}${circleBits}`;
  };
  const scheduleCell = k => {
    if (!k.consent || !k.consent.given) return '<span class="sub">after consent</span>';
    const sc = k.schedule || {}, w = k.weekly || {};
    const days = sc.days && sc.days.length === 7 ? 'daily' : 'alternate';
    return `<form method="post" action="/voice/admin/children/${esc(k.id)}/schedule?${q}">
      <input type="time" name="time" value="${esc(sc.time || '17:00')}">
      <select name="days"><option value="alternate"${days === 'alternate' ? ' selected' : ''}>Mon·Wed·Fri</option><option value="daily"${days === 'daily' ? ' selected' : ''}>every day</option></select>
      <select name="enabled"><option value="yes"${sc.enabled ? ' selected' : ''}>lessons on</option><option value="no"${sc.enabled ? '' : ' selected'}>lessons off</option></select>
      <select name="weekly"><option value="yes"${w.enabled ? ' selected' : ''}>weekly call on</option><option value="no"${w.enabled ? '' : ' selected'}>weekly call off</option></select>
      <button ${btn}>Save</button></form>
      <form method="post" action="/voice/admin/children/${esc(k.id)}/weekly-call?${q}"><button ${btn} style="margin:4px 0 0;padding:6px 10px;background:#6E6355">Weekly call now</button></form>
      ${k.requested_time ? `<span class="sub">parent asked for ${esc(k.requested_time)}</span>` : ''}`;
  };
  const quietCell = k => {
    const q = brain.quietSignal ? brain.quietSignal(k) : null;
    if (!q || !q.week_calls) return '';
    return `<br><span class="sub">went quiet on ${q.week_items} in 7 days${q.skills.length ? ' (most: ' + esc(q.skills.map(x => x.skill).join(', ')) + ')' : ''}</span>${q.check_in ? '<br><span class="flag">ended quiet twice this week: check in with the family</span>' : ''}`;
  };
  const kidRows = kids.map(k => `<tr><td>${esc(k.name)}</td><td>${k.age} · ${esc(k.lang)}${k.parent_lang && k.parent_lang !== k.lang ? ` · parent ${esc(k.parent_lang)}` : ''}</td>
    <td>${consentCell(k)}${quietCell(k)}</td><td>${scheduleCell(k)}</td>
    <td>${esc(JSON.stringify(k.profile.levels))}</td><td>${k.profile.classCode ? esc(k.profile.classCode) : '–'}</td>
    <td><form method="post" action="/voice/admin/children/${esc(k.id)}/english?${q}"><input type="hidden" name="on" value="${k.english_practice ? 'no' : 'yes'}"><button class="btn" style="margin:0;padding:6px 10px;${k.english_practice ? '' : 'background:#6E6355'}">${k.english_practice ? 'On' : 'Off'}</button></form></td>
    <td><form method="post" action="/voice/admin/children/${esc(k.id)}/homework?${q}"><input name="code" placeholder="TKH1.… homework code" size="22"><button class="btn" style="margin:0;padding:6px 10px">Import</button></form></td></tr>`).join('');
  const schoolBlock = scope.super ? `<h2>Schools</h2>
  <table><tr><th>School</th><th>Contact</th><th>Bolna account</th></tr>${(brain.listSchools() || []).map(sc => `<tr><td>${esc(sc.name)}<br><span class="sub">${esc(sc.id)}</span></td><td>${esc(sc.contact || '–')}</td><td>${sc.bolna && sc.bolna.api_key ? 'own sub-account' : '<span class="sub">server default</span>'}${sc.bolna && sc.bolna.agent_id ? ' · agent ' + esc(sc.bolna.agent_id) : ''}</td></tr>`).join('') || '<tr><td colspan="3">None yet: everything is on the server default.</td></tr>'}</table>
  <form method="post" action="/voice/admin/schools?${q}"><input name="name" placeholder="School name" required><input name="contact" placeholder="Contact for parents (phone)">
    <input name="api_key" placeholder="Bolna sub-account API key"><input name="agent_id" placeholder="Bolna agent id"><input name="parent_agent_id" placeholder="Parent agent id">
    <button class="btn" style="margin:0">Add school</button></form>
  <p class="note">Each school gets its own admin key (shown once) and sees only its own children, calls and teachers. With a Bolna sub-account key, its calls run on that account.</p>` : `<p class="sub">School: <b>${esc(scope.school.name)}</b></p>`;

  const teachers = (brain.listTeachers ? brain.listTeachers() : []);
  const codes = [...new Set(kids.map(k => k.profile && k.profile.classCode).filter(Boolean).map(c => String(c).toUpperCase()))].sort();
  const classRows = codes.map(code => {
    const sum = brain.classSummary(code, scope.school && scope.school.id, scope.super);
    const gaps = sum.gaps.slice(0, 3).map(g => `${esc(g.en)} (${g.children})`).join(', ') || '<span class="sub">no shared gap yet</span>';
    const ready = sum.children.filter(c => c.consent === 'given' && c.phone).length;
    return `<tr><td>${esc(code)}</td><td>${sum.children.length} children · ${ready} families can be called</td><td>${gaps}</td>
      <td><form method="post" action="/voice/admin/classes/${esc(code)}/parent-calls?${q}"><input name="skill" placeholder="skill id (blank = shared gap)" size="14">
      <input name="teacher" placeholder="Teacher's name" size="10"><input name="note" placeholder="Short note for parents" size="16"><button ${btn}>Call all parents</button></form></td></tr>`;
  }).join('');
  const tcalls = (brain.listTeacherCalls ? brain.listTeacherCalls() : []).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
  const tById = Object.fromEntries(teachers.map(t => [t.id, t]));
  const tcallRows = tcalls.map(c => `<tr><td>${esc((tById[c.teacher_id] || {}).name || '?')}<br><span class="sub">${esc(c.created_at.slice(0, 16).replace('T', ' '))}</span></td>
    <td>${(c.notes || []).map(n => `${esc(n.child_name)}: ${esc(n.skill)} ${n.ok ? '✓' : '✗'}${n.heard_in_transcript === false ? ' <span class="flag">name not in transcript</span>' : ''}`).join('<br>') || '<span class="sub">no notes</span>'}</td>
    <td><a href="/voice/admin/teachercalls/${esc(c.id)}?${q}">open</a></td></tr>`).join('');
  let corpus = null;
  try { corpus = require('./corpus').buildCorpus(brain); } catch (e) { corpus = null; }
  const corpusBlock = corpus ? `<h2>What children misread</h2>
  <p class="sub">${corpus.readings} readings from ${corpus.children} children whose parents said yes to improving Takhti. Heard forms appear once ${corpus.min_children}+ children produced them. <a href="/voice/admin/corpus?${q}">JSON</a> · <a href="/voice/admin/corpus.csv?${q}">CSV</a></p>
  <table><tr><th>Word</th><th>Attempts</th><th>Read well</th><th>Heard as</th></tr>${corpus.words.slice(0, 12).map(w => `<tr><td>${esc(w.word)}</td><td>${w.attempts}</td><td>${w.ok}</td><td>${w.heard.map(h => esc(h.form) + ' (' + h.count + ')').join(', ') || '–'}</td></tr>`).join('') || '<tr><td colspan="4">Nothing yet</td></tr>'}</table>
  ${corpus.swaps.length ? `<p>Letter swaps: ${corpus.swaps.slice(0, 8).map(x => `${esc(x.from)}→${esc(x.to)} (${x.count})`).join(' · ')}</p>` : ''}` : '';

  return shell('Takhti voice · dashboard', 'en', `<h1>Takhti voice</h1>
  <p class="sub">${kids.length} children · ${sessions.length} recent sessions · ${brain.storyBank.length} validated story problems</p>
  ${schoolBlock}
  <h2>Add a child</h2>
  <form method="post" action="/voice/admin/children?${q}">
    <input name="name" placeholder="First name" required><input name="age" type="number" min="3" max="10" placeholder="Age" required>
    <select name="lang"><option value="hi">Hindi</option><option value="en">English</option></select>
    <input name="parent_phone" placeholder="+91…" required>
    <select name="parent_lang"><option value="">Parent: same language</option><option value="hi">Parent: Hindi</option><option value="en">Parent: English</option></select>
    <select name="consent" required><option value="call">Ask on a consent call</option><option value="yes">Parent consented in person</option></select>
    <label><input type="checkbox" name="consent_research" value="yes"> (in person) words may improve Takhti</label>
    <label><input type="checkbox" name="placement" value="yes"> New admission: placement call first</label>
    <button class="btn" style="margin:0">Add</button></form>
  <p class="note">A consent call explains what Takhti keeps and asks the parent, yes or no, before any lesson; their answers are checked against Bolna's transcript afterwards. The time and days they choose start the daily lessons.</p>
  <h2>Children</h2>
  <table><tr><th>Name</th><th>Age · lang</th><th>Consent</th><th>Lessons · weekly call</th><th>Levels</th><th>Class</th><th>English practice</th><th>Teacher's homework code</th></tr>${kidRows || '<tr><td colspan="8">None yet</td></tr>'}</table>
  <p class="note">A homework code from the app's teacher view links the child to that class; the next call asks the homework (personalised by the app's own diagnosis). After each call the parent report carries a progress code back to the teacher.</p>
  <h2>Plan a lesson</h2>
  <form method="post" action="/voice/admin/sessions?${q}"><select name="child_id">${kidOpts}</select>
    <select name="kind"><option value="">Next in turn</option><option value="lesson">Reading + maths</option><option value="english">Spoken English</option><option value="placement">Placement (new admission)</option></select>
    <label><input type="checkbox" name="call" value="yes"> and call now</label><button class="btn" style="margin:0">Plan</button></form>
  <h2>Teachers</h2>
  <table><tr><th>Teacher</th><th>Phone</th><th>Classes</th><th>Class circle page</th></tr>${teachers.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.phone)}</td><td>${esc(t.class_codes.join(', '))}</td><td>${t.token ? `<a href="/circle/c/${esc(t.token)}">open</a> <span class="sub">(send this link to the teacher)</span>` : '–'}</td></tr>`).join('') || '<tr><td colspan="4">None yet</td></tr>'}</table>
  <form method="post" action="/voice/admin/teachers?${q}"><input name="name" placeholder="Teacher's name" required><input name="phone" placeholder="+91…" required>
    <input name="class_codes" placeholder="Class codes, comma separated"><select name="lang"><option value="hi">Hindi</option><option value="en">English</option></select>
    <button class="btn" style="margin:0">Add teacher</button></form>
  <p class="note">A teacher ringing the Munni number leaves a voice note ("Riya confused ण and न today"). Munni reads it back and saves it only on a yes. It becomes evidence in the child's skill history, and for a difficulty, what the next calls practise.</p>
  <h2>Teacher notes</h2>
  <table><tr><th>Teacher</th><th>Notes</th><th></th></tr>${tcallRows || '<tr><td colspan="3">None yet</td></tr>'}</table>
  <h2>Classes</h2>
  <table><tr><th>Class</th><th>Families</th><th>Shared gaps</th><th>Class-wide parent call</th></tr>${classRows || '<tr><td colspan="4">No child is linked to a class yet (import a homework code).</td></tr>'}</table>
  <h2>Circle messages</h2>
  <p class="sub">WhatsApp updates to parents, tutors and teachers. With AiSensy set up they go out by themselves; otherwise tap to send.</p>
  <table><tr><th>When</th><th>To</th><th>What</th><th>Status</th></tr>${(brain.messages ? brain.messages.list() : []).filter(mg => scope.super || kids.some(k => k.id === mg.child_id) || mg.role === 'teacher').slice(0, 25).map(mg => `<tr><td>${esc(String(mg.send_after).slice(0, 16).replace('T', ' '))}</td><td>${esc(mg.role)} ${esc(mg.to.name || mg.to.phone)}</td><td>${esc(mg.text.slice(0, 120))}</td><td>${esc(mg.status)}${mg.status === 'ready' || mg.status === 'queued' ? ` · <a href="${esc(mg.wa)}">send on WhatsApp</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="4">None yet</td></tr>'}</table>
  <h2>Parent calls</h2>
  <table><tr><th>Child</th><th>Kind</th><th>Status</th><th>Outcome</th><th></th></tr>${parentRows || '<tr><td colspan="5">None yet</td></tr>'}</table>
  <h2>Sessions</h2>
  <table><tr><th>Child</th><th>Status</th><th>Items</th><th>Relay drift</th><th></th></tr>${rows || '<tr><td colspan="5">None yet</td></tr>'}</table>
  ${corpusBlock}
  <p class="note">Relay drift = answers where the words the voice model passed to the tools differ from Bolna's own transcript. It should stay near zero.</p>`);
}

function sessionAdminPage(s, child, key) {
  const q = 'key=' + encodeURIComponent(key);
  const turns = (s.live_turns || []).map(t => `<div class="turn"><b>${t.role === 'user' ? esc(child.name) : 'Munni'}:</b> ${esc(t.text)}</div>`).join('');
  const items = s.items.map(it => `<tr><td>${it.n}</td><td>${esc(it.kind)}</td>
    <td>${esc(it.problem || it.target || it.prompt || '')}</td><td>${esc(it.answer != null ? String(it.answer) : '')}</td>
    <td>${esc((it.said || []).join(' | '))}</td><td>${esc((it.heard_tx || []).map(x => x == null ? '·' : x).join(' | '))}</td>
    <td><span class="chip ${OUT[it.outcome] || 'no'}">${esc(it.outcome || 'open')}</span>${it.silences || it.silent_tx ? `<br><span class="sub">quiet: ${it.silences || 0} live, ${it.silent_tx || 0} in transcript</span>` : ''}${it.evidence ? `<br>${esc(it.evidence.source)}: ${esc(it.evidence.verdict)} ${it.evidence.score}` : ''}</td></tr>`).join('');
  const trace = s.trace.concat(...s.items.map(i => i.trace || [])).map(t => 'T0 · ' + t).join('\n');
  return shell('Session ' + s.id, 'en', `<p><a href="/voice/admin?${q}">← dashboard</a></p>
  <h1>${esc(child.name)} · ${esc(s.band)} · ${esc(s.lang)}</h1>
  <p class="sub">${esc(s.status)} · ended by ${esc(s.ended_by || '–')} · levels ${esc(JSON.stringify(s.levels_before))} → ${esc(JSON.stringify(s.levels_after || child.profile.levels))}
  ${s.flags && s.flags.safeguarding ? ' · <span class="flag">safeguarding review needed</span>' : ''}</p>
  <p><a href="/voice/card/${esc(s.id)}">card</a> · <a href="/voice/report/${esc(s.id)}">parent report</a>
  ${s.report && s.report.whatsapp ? ` · <a href="${esc(s.report.whatsapp)}">send report to parent on WhatsApp</a>` : ''}
  ${s.call && s.call.recording_url ? ` · <a href="${esc(s.call.recording_url)}">recording</a>` : ''}</p>
  <form method="post" action="/voice/admin/sessions/${esc(s.id)}/call?${q}"><button class="btn" style="margin:0">Call now</button></form>
  <h2>Items</h2><table><tr><th>#</th><th>Kind</th><th>Asked</th><th>Answer</th><th>Relayed</th><th>Transcript</th><th>Outcome</th></tr>${items}</table>
  <h2>What the tools heard</h2>${turns || '<p class="sub">No turns yet.</p>'}
  <h2>Engine trace</h2><pre>${esc(trace || 'nothing yet')}</pre>
  ${s.transcript ? `<h2>Bolna transcript</h2><pre>${esc(s.transcript)}</pre>` : ''}`);
}

/* ---------- one parent call, for the team ---------- */
function parentCallPage(s, child, key) {
  const q = 'key=' + encodeURIComponent(key);
  const name = child ? child.name : '?';
  const turns = (s.live_turns || []).map(t => `<div class="turn"><b>${t.role === 'user' ? 'Parent' : 'Munni'}:</b> ${esc(t.text)}</div>`).join('');
  const items = s.items.map(it => `<tr><td>${esc(it.step)}</td><td>${esc(it.prompts[it.prompts.length - 1])}</td>
    <td>${esc(it.said.join(' | '))}</td><td>${esc((it.heard_tx || []).map(x => x == null ? '·' : x).join(' | '))}</td></tr>`).join('');
  const c = s.consent;
  return shell('Parent call ' + s.id, 'en', `<p><a href="/voice/admin?${q}">← dashboard</a></p>
  <h1>${esc(name)} · ${esc(s.kind)} call · ${esc(s.lang)}</h1>
  <p class="sub">${esc(s.status)} · outcome ${esc(s.outcome || '–')}${c ? ` · consent check: <b>${esc(c.status)}</b>${c.why ? ' (' + esc(c.why) + ')' : ''}` : ''}${s.notice ? ' · notice ' + esc(s.notice) : ''}</p>
  ${s.call && s.call.recording_url ? `<p><a href="${esc(s.call.recording_url)}">recording</a></p>` : ''}
  ${c && c.terms ? `<p>Agreed terms: ${esc(c.terms.time)} · days ${esc(c.terms.days.join(','))} · recording ${c.terms.recording ? 'yes' : 'no'} · weekly ${c.terms.weekly ? 'yes' : 'no'}</p>` : ''}
  ${(s.changes || []).length ? `<p>Changes the parent asked for: ${esc(s.changes.join(', '))}</p>` : ''}
  <h2>Questions</h2><table><tr><th>Step</th><th>Munni asked</th><th>Relayed</th><th>Transcript</th></tr>${items}</table>
  <h2>What the tool heard</h2>${turns || '<p class="sub">No turns yet.</p>'}
  ${s.transcript ? `<h2>Bolna transcript</h2><pre>${esc(s.transcript)}</pre>` : ''}`);
}

function schoolCreatedPage(r, key) {
  return shell('School added', 'en', `<p><a href="/voice/admin?key=${encodeURIComponent(key)}">← dashboard</a></p><h1>${esc(r.school.name)}</h1>
  <p>Give the school this admin key. It is shown <b>only now</b>; Takhti keeps only a hash of it.</p><pre style="user-select:all">${esc(r.key)}</pre>
  <p>Their dashboard: <code>/voice/admin?key=…</code> with that key. They see only their own children, calls and teachers.</p>`);
}
function teacherCallPage(c, teacher, key) {
  const q = 'key=' + encodeURIComponent(key);
  const turns = (c.live_turns || []).map(t => `<div class="turn"><b>${t.role === 'user' ? esc(teacher ? teacher.name : 'Teacher') : 'Munni'}:</b> ${esc(t.text)}</div>`).join('');
  return shell('Teacher call', 'en', `<p><a href="/voice/admin?${q}">← dashboard</a></p><h1>${esc(teacher ? teacher.name : '?')} · note call</h1>
  <p class="sub">${esc(c.status)} · ${c.notes.length} notes saved</p>
  <table><tr><th>Child</th><th>Skill</th><th>How</th><th>Letters</th><th>Name in transcript</th></tr>${c.notes.map(n => `<tr><td>${esc(n.child_name)}</td><td>${esc(n.skill)}</td><td>${n.ok ? 'did well' : 'found it hard'}</td><td>${esc((n.letters || []).join(' '))}</td><td>${n.heard_in_transcript == null ? '–' : n.heard_in_transcript ? 'yes' : '<span class="flag">no: check</span>'}</td></tr>`).join('')}</table>
  <h2>What the tool heard</h2>${turns || '<p class="sub">No turns.</p>'}${c.transcript ? `<h2>Bolna transcript</h2><pre>${esc(c.transcript)}</pre>` : ''}`);
}
function classCallsPage(r, code, key) {
  return shell('Class calls', 'en', `<p><a href="/voice/admin?key=${encodeURIComponent(key)}">← dashboard</a></p><h1>Class ${esc(String(code).toUpperCase())} · ${esc(r.skill)}</h1>
  <p>${r.placed.length} calls placed.</p><ul>${r.placed.map(x => `<li>${esc(x.child)}</li>`).join('')}</ul>
  ${r.skipped.length ? `<h2>Not called</h2><ul>${r.skipped.map(x => `<li>${esc(x.child)}: ${esc(x.why)}</li>`).join('')}</ul>` : ''}`);
}

module.exports = { shell, MUNNI, cardPage, reportPage, dashboardPage, sessionAdminPage, parentCallPage, schoolCreatedPage, teacherCallPage, classCallsPage, esc };
