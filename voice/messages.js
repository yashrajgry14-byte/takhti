/* ==================================================================
   CIRCLE MESSAGES — WhatsApp to the grown-ups, never to the child

   Who hears what, in their own language:
     parent    Monday: this week's focus and one thing to do together;
               Wednesday: one thing for the child to teach them; the
               Friday check's result; a tutor the school suggests
     tutor     before each session: what to work on (their page link);
               being added to a child's circle
     teacher   Saturday: the class's Friday checks and next week's
               suggestions

   Every message links to that person's own page (circle-pages.js), where
   the whole circle is current, so a message is only ever a pointer.
   Rules: nothing to a child; nothing in quiet hours (held till morning);
   at most TAKHTI_MSG_DAILY (3) a day per person; one of each kind per
   week; a parent can stop them all from their page or the app.

   Sending: AiSensy's API campaign (AISENSY_API_KEY + an approved
   template with two parameters: the text and the link). Without a key
   a message is 'ready': the dashboard shows a one-tap WhatsApp link for
   a person to send.
   ================================================================== */
'use strict';
const crypto = require('crypto');
const C = require('./clock');

function createMessages(brain, circle, envIn) {
  const env = envIn || process.env;
  const store = brain.store;
  const base = () => (env.TAKHTI_PUBLIC_URL || '').replace(/\/$/, '');
  const id = () => 'msg_' + crypto.randomBytes(9).toString('base64url');
  const L2 = l => (l === 'hi' ? 'hi' : 'en');

  /* when this may go out: not in quiet hours, under the daily cap */
  function sendAfter(phone, at) {
    let t = new Date(at || Date.now());
    for (let k = 0; k < 4; k++) {
      const lp = C.localParts(t, env);
      if (C.inQuiet(lp.minutes, env.TAKHTI_QUIET_HOURS)) {
        const end = C.toMinutes(C.quietBounds(env.TAKHTI_QUIET_HOURS).from);
        const ahead = ((end - lp.minutes) + 1440) % 1440 || 1440;
        t = new Date(t.getTime() + ahead * 60e3);
        continue;
      }
      const day = lp.day;
      const today = store.list('outbox').filter(m => m.to.phone === phone && m.status !== 'skipped' &&
        C.localParts(m.send_after, env).day === day).length;
      if (today >= Number(env.TAKHTI_MSG_DAILY || 3)) { t = new Date(t.getTime() + 864e5); continue; }
      break;
    }
    return t.toISOString();
  }

  function queue(m) {
    if (!m.to || !/^\+\d{10,15}$/.test(String(m.to.phone || ''))) return null;
    if (m.dedup && store.list('outbox').some(x => x.dedup === m.dedup)) return null;
    const msg = Object.assign({ id: id(), status: 'queued', created_at: new Date().toISOString() }, m);
    msg.send_after = sendAfter(m.to.phone, m.at);
    msg.wa = `https://wa.me/${m.to.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg.text + (msg.link ? ' ' + msg.link : ''))}`;
    store.put('outbox', msg.id, msg);
    return msg;
  }

  async function sendOne(m) {
    if (!env.AISENSY_API_KEY) { m.status = 'ready'; return m; }      // a person sends it from the dashboard
    const body = { apiKey: env.AISENSY_API_KEY, campaignName: env.AISENSY_CAMPAIGN || 'takhti_circle',
                   destination: m.to.phone.replace(/\D/g, ''), userName: m.to.name || 'Takhti family',
                   templateParams: [m.text.replace(/\s+/g, ' ').slice(0, 900), m.link || base()], source: 'takhti' };
    const res = await fetch(env.AISENSY_API_URL || 'https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e.message || e) }));
    if (res.ok) { m.status = 'sent'; m.sent_at = new Date().toISOString(); }
    else { m.status = 'failed'; m.error = `AiSensy said ${res.status}`; }
    return m;
  }

  /* send whatever is due (called by the scheduler) */
  async function flush(at) {
    const t = new Date(at || Date.now());
    const due = store.list('outbox').filter(m => m.status === 'queued' && new Date(m.send_after) <= t);
    const out = [];
    for (const m of due) {
      if (m.role === 'parent') {
        const ch = brain.getChild(m.child_id);
        if (ch && ch.circle && ch.circle.messages_off) { m.status = 'skipped'; m.error = 'the parent stopped messages'; store.put('outbox', m.id, m); continue; }
      }
      await sendOne(m);
      store.put('outbox', m.id, m);
      // a home activity that reached the family can be asked about
      if ((m.status === 'sent') && m.home_id) {
        const ch = brain.getChild(m.child_id);
        const w = ch && ch.circle && ch.circle.week;
        const h = w && (w.home || []).find(x => x.id === m.home_id);
        if (h && !h.sent_at) { h.sent_at = m.sent_at; store.put('children', ch.id, ch); }
      }
      out.push({ id: m.id, kind: m.kind, status: m.status });
    }
    return out;
  }

  /* ---------- the messages ---------- */
  const parentOf = ch => ch.parent_phone ? { phone: ch.parent_phone, name: '', lang: L2(ch.parent_lang || ch.lang) } : null;
  const parentLink = ch => `${base()}/circle/p/${circle.ensure(ch).parent_token}`;

  function weekStart(ch, w, at) {
    const to = parentOf(ch); if (!to) return null;
    const lang = to.lang, n = ch.name, sk = circle.skillName(w.skill, lang);
    const doIt = (w.home || []).find(h => h.kind === 'do');
    const text = lang === 'hi'
      ? `इस हफ़्ते ${n} ${sk} पर काम करेंगे। ${w.why.hi} घर पर: ${doIt ? doIt.text.hi : ''}`
      : `This week ${n} works on ${sk.toLowerCase()}. ${w.why.en} At home: ${doIt ? doIt.text.en : ''}`;
    return queue({ kind: 'week_start', role: 'parent', to, child_id: ch.id, lang, text, link: parentLink(ch), dedup: `week_start|${ch.id}|${w.key}`,
                   home_id: doIt && doIt.id, at });
  }
  function homeTeach(ch, w, at) {
    const to = parentOf(ch); if (!to) return null;
    const h = (w.home || []).find(x => x.kind === 'teach'); if (!h) return null;
    const text = to.lang === 'hi' ? `आज ${ch.name} के साथ: ${h.text.hi}` : `Tonight with ${ch.name}: ${h.text.en}`;
    return queue({ kind: 'home_teach', role: 'parent', to, child_id: ch.id, lang: to.lang, text, link: parentLink(ch), dedup: `home_teach|${ch.id}|${w.key}`, home_id: h.id, at });
  }
  const VERDICT = {
    mastered: { en: "It's solid. Wonderful!", hi: 'यह पक्का हो गया। बहुत बढ़िया!' },
    nearly:   { en: 'Nearly there.', hi: 'लगभग आ गया है।' },
    not_yet:  { en: "Not yet, and that's okay: it's a step.", hi: 'अभी नहीं, और यह ठीक है: यह एक कदम है।' }
  };
  function checkDone(ch, w) {
    const to = parentOf(ch); if (!to || !w.check) return null;
    const lang = to.lang, k = w.check;
    const how = k.source === 'reading' ? (lang === 'hi' ? ' (इस हफ़्ते के पढ़ने से)' : ' (from this week\'s reading)') : '';
    const text = lang === 'hi'
      ? `${ch.name} का शुक्रवार वाला छोटा टेस्ट, ${circle.skillName(w.skill, 'hi')}: ${k.of} में से ${k.right}${how}। ${VERDICT[k.verdict].hi} ${k.next && k.next.why ? k.next.why.hi : ''}`
      : `${ch.name}'s Friday check on ${circle.skillName(w.skill, 'en').toLowerCase()}: ${k.right} of ${k.of}${how}. ${VERDICT[k.verdict].en} ${k.next && k.next.why ? k.next.why.en : ''}`;
    return queue({ kind: 'check_done', role: 'parent', to, child_id: ch.id, lang, text, link: parentLink(ch), dedup: `check_done|${ch.id}|${w.key}` });
  }
  function tutorInvited(ch, t, status, by) {
    const school = ch.school_id && store.get('schools', ch.school_id);
    if (status === 'pending') {
      const to = parentOf(ch); if (!to) return null;
      const who = school ? school.name : (to.lang === 'hi' ? 'स्कूल' : 'The school');
      const text = to.lang === 'hi'
        ? `${who} ने ${t.name} को तख़्ती पर ${ch.name} के ट्यूशन टीचर के रूप में जोड़ने का सुझाव दिया है। वे ${ch.name} का अभ्यास तभी देख पाएँगे जब आप हाँ कहें।`
        : `${who} suggests ${t.name} as ${ch.name}'s tuition teacher on Takhti. They'll see ${ch.name}'s practice only if you approve.`;
      return queue({ kind: 'tutor_approve', role: 'parent', to, child_id: ch.id, lang: to.lang, text, link: parentLink(ch), dedup: `tutor_approve|${ch.id}|${t.id}` });
    }
    const lang = L2(t.lang);
    const who = by === 'parent' ? (lang === 'hi' ? `${ch.name} के परिवार` : `${ch.name}'s family`) : (school ? school.name : (lang === 'hi' ? 'स्कूल' : 'The school'));
    const text = lang === 'hi'
      ? `${who} ने आपको तख़्ती पर ${ch.name} के सीखने के घेरे में जोड़ा है। हर सत्र से पहले आपको मिलेगा कि किस पर काम करना है।`
      : `${who} added you to ${ch.name}'s learning circle on Takhti. Before each session you'll get what to work on.`;
    return queue({ kind: 'tutor_added', role: 'tutor', to: { phone: t.phone, name: t.name, lang }, child_id: ch.id, lang, text,
                   link: `${base()}/circle/t/${t.token}`, dedup: `tutor_added|${ch.id}|${t.id}` });
  }
  function tutorPack(t, ch, pack, day, at) {
    const lang = L2(t.lang);
    const text = lang === 'hi'
      ? `आज ${ch.name} के साथ: ${pack.skill_name}। इस हफ़्ते ${pack.so_far.tries} कोशिशें, ${pack.so_far.right} सही। तीन तैयार सवाल और क्या ग़लत हुआ:`
      : `Today with ${ch.name}: ${pack.skill_name.toLowerCase()}. ${pack.so_far.tries} tries this week, ${pack.so_far.right} right. Three ready questions and what went wrong:`;
    return queue({ kind: 'tutor_pack', role: 'tutor', to: { phone: t.phone, name: t.name, lang }, child_id: ch.id, lang, text,
                   link: `${base()}/circle/t/${t.token}#${ch.id}`, dedup: `tutor_pack|${t.id}|${ch.id}|${day}`, at });
  }
  function teacherDigest(teacher, code, rows, week, at) {
    if (!teacher.phone) return null;
    const lang = L2(teacher.lang);
    const done = rows.filter(r => r.check), solid = done.filter(r => r.check.verdict === 'mastered').length;
    const nearly = done.filter(r => r.check.verdict === 'nearly').length, notyet = done.filter(r => r.check.verdict === 'not_yet').length;
    const text = lang === 'hi'
      ? `कक्षा ${code} इस हफ़्ते: ${rows.length} में से ${done.length} बच्चों का शुक्रवार टेस्ट हुआ: ${solid} पक्के, ${nearly} लगभग, ${notyet} अभी नहीं। अगले हफ़्ते के सुझाव तैयार हैं:`
      : `Class ${code} this week: ${done.length} of ${rows.length} Friday checks done: ${solid} solid, ${nearly} nearly, ${notyet} not yet. Next week's suggestions are ready:`;
    return queue({ kind: 'teacher_digest', role: 'teacher', to: { phone: teacher.phone, name: teacher.name, lang }, lang, text,
                   link: `${base()}/circle/c/${teacher.token}`, dedup: `teacher_digest|${teacher.id}|${code}|${week}`, at });
  }

  return { queue, flush, weekStart, homeTeach, checkDone, tutorInvited, tutorPack, teacherDigest,
           list: () => store.list('outbox').sort((a, b) => b.created_at.localeCompare(a.created_at)) };
}

module.exports = { createMessages };
