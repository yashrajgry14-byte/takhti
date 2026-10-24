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

function cardPage(session, child) {
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

function dashboardPage(brain, key) {
  const q = 'key=' + encodeURIComponent(key);
  const kids = brain.listChildren().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sessions = brain.listSessions().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
  const byId = Object.fromEntries(kids.map(k => [k.id, k]));
  const rows = sessions.map(s => {
    const k = byId[s.child_id];
    return `<tr><td>${esc(k ? k.name : '?')}<br><span class="sub">${esc(s.created_at.slice(0, 16).replace('T', ' '))}</span></td>
      <td>${esc(s.status)}${s.flags && s.flags.safeguarding ? '<br><span class="flag">review</span>' : ''}</td>
      <td>${chips(s)}</td>
      <td>${s.relay ? `${s.relay.mismatched}/${s.relay.checked}` : '–'}</td>
      <td><a href="/voice/admin/sessions/${esc(s.id)}?${q}">open</a></td></tr>`;
  }).join('');
  const kidOpts = kids.map(k => `<option value="${esc(k.id)}">${esc(k.name)} (${k.age}, ${k.lang})</option>`).join('');
  const kidRows = kids.map(k => `<tr><td>${esc(k.name)}</td><td>${k.age} · ${esc(k.lang)}</td>
    <td>${esc(JSON.stringify(k.profile.levels))}</td><td>${k.profile.classCode ? esc(k.profile.classCode) : '–'}</td>
    <td><form method="post" action="/voice/admin/children/${esc(k.id)}/homework?${q}"><input name="code" placeholder="TKH1.… homework code" size="22"><button class="btn" style="margin:0;padding:6px 10px">Import</button></form></td></tr>`).join('');
  return shell('Takhti voice · dashboard', 'en', `<h1>Takhti voice</h1>
  <p class="sub">${kids.length} children · ${sessions.length} recent sessions · ${brain.storyBank.length} validated story problems</p>
  <h2>Add a child</h2>
  <form method="post" action="/voice/admin/children?${q}">
    <input name="name" placeholder="First name" required><input name="age" type="number" min="3" max="10" placeholder="Age" required>
    <select name="lang"><option value="hi">Hindi</option><option value="en">English</option></select>
    <input name="parent_phone" placeholder="+91…" required>
    <label><input type="checkbox" name="consent" value="yes" required> Parent consents</label>
    <button class="btn" style="margin:0">Add</button></form>
  <h2>Children</h2>
  <table><tr><th>Name</th><th>Age · lang</th><th>Levels</th><th>Class</th><th>Teacher's homework code</th></tr>${kidRows || '<tr><td colspan="5">None yet</td></tr>'}</table>
  <p class="note">A homework code from the app's teacher view links the child to that class; the next call asks the homework (personalised by the app's own diagnosis). After each call the parent report carries a progress code back to the teacher.</p>
  <h2>Plan a lesson</h2>
  <form method="post" action="/voice/admin/sessions?${q}"><select name="child_id">${kidOpts}</select>
    <label><input type="checkbox" name="call" value="yes"> and call now</label><button class="btn" style="margin:0">Plan</button></form>
  <h2>Sessions</h2>
  <table><tr><th>Child</th><th>Status</th><th>Items</th><th>Relay drift</th><th></th></tr>${rows || '<tr><td colspan="5">None yet</td></tr>'}</table>
  <p class="note">Relay drift = answers where the words the voice model passed to the tools differ from Bolna's own transcript. It should stay near zero.</p>`);
}

function sessionAdminPage(s, child, key) {
  const q = 'key=' + encodeURIComponent(key);
  const turns = (s.live_turns || []).map(t => `<div class="turn"><b>${t.role === 'user' ? esc(child.name) : 'Munni'}:</b> ${esc(t.text)}</div>`).join('');
  const items = s.items.map(it => `<tr><td>${it.n}</td><td>${esc(it.kind)}</td>
    <td>${esc(it.problem || it.target || it.prompt || '')}</td><td>${esc(it.answer != null ? String(it.answer) : '')}</td>
    <td>${esc((it.said || []).join(' | '))}</td><td>${esc((it.heard_tx || []).map(x => x == null ? '·' : x).join(' | '))}</td>
    <td><span class="chip ${OUT[it.outcome] || 'no'}">${esc(it.outcome || 'open')}</span>${it.evidence ? `<br>${esc(it.evidence.source)}: ${esc(it.evidence.verdict)} ${it.evidence.score}` : ''}</td></tr>`).join('');
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

module.exports = { cardPage, reportPage, dashboardPage, sessionAdminPage, esc };
