#!/usr/bin/env node
/* ==================================================================
   CALL SIMULATOR — rehearse a whole Munni call in the terminal.

     node voice/simulate.js                      you type as the child
     node voice/simulate.js --age 5 --lang en
     node voice/simulate.js --auto               a scripted child plays
     node voice/simulate.js --auto --mistakes    ...and gets some wrong

   It drives the same brain the server uses (tools, then the post-call
   webhook with a transcript built from the conversation), so what you
   see here is what a real call does — minus the phone line, the
   recognizer and the voice model, which are the parts Bolna supplies.
   ================================================================== */
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createBrain } = require('./brain');

function args() {
  const a = process.argv.slice(2), o = { name: 'Riya', age: 7, lang: 'hi' };
  for (let i = 0; i < a.length; i++) {
    const k = a[i].replace(/^--/, '');
    if (['auto', 'mistakes', 'quiet'].includes(k)) o[k] = true;
    else o[k] = a[++i];
  }
  o.age = Number(o.age);
  return o;
}

/* A child who mostly knows the answer. With --mistakes: an off-by-one
   sum, a skipped word, a "pata nahi", a request to repeat. */
function autoChild(it, turn, mistakes) {
  if (it.expect === 'yesno') return it.answer ? (it.lang === 'en' ? 'yes' : 'haan') : (it.lang === 'en' ? 'no' : 'nahi');
  if (it.expect === 'number') {
    if (mistakes && turn === 3) return it.lang === 'en' ? 'say it again' : 'phir se bolo';
    if (mistakes && it.n === 2 && it.attempts === 0) return String(it.answer + 1);
    if (mistakes && it.n === 4 && it.attempts === 0) return it.lang === 'en' ? "I don't know" : 'pata nahi';
    return String(it.answer);
  }
  const words = it.target.split(/\s+/);
  if (mistakes && it.line_no === 2 && it.attempts === 0) return words.filter((w, i) => i !== 1).join(' ');
  return it.target;
}

async function main() {
  const o = args();
  const dir = o.data || fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-sim-'));
  const brain = createBrain({ dataDir: dir });
  const r = brain.registerChild({ name: o.name, age: o.age, lang: o.lang, parent_phone: o.phone || '+919800000000', consent: true });
  if (r.error) { console.error(r.error.join('\n')); process.exit(1); }
  const { session } = brain.createSession(r.child.id, { seed: o.seed });
  const out = (who, text) => console.log(`${who === 'munni' ? '\x1b[33mMunni\x1b[0m' : '\x1b[36m' + r.child.name + '\x1b[0m'}: ${text}`);

  console.log(`\n${r.child.name}, age ${o.age}, ${o.lang} · band ${session.band} · plan: ${session.slots.join(' → ')}`);
  console.log(`Today's card:\n${session.lines.map((l, i) => `  ${i + 1}. ${l}`).join('\n')}\n`);

  const start = Date.now();
  let reply = brain.toolNext(session.id);
  out('munni', reply.say);

  const rl = o.auto ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise(res => rl.question('\x1b[36m> \x1b[0m', res));
  let turn = 0;
  while (!reply.done && turn < 60) {
    turn++;
    let said;
    if (o.auto) {
      const s = brain.getSession(session.id);
      const it = Object.assign({ lang: s.lang }, s.items[s.items.length - 1]);
      said = autoChild(it, turn, o.mistakes);
      out('child', said);
    } else {
      said = await ask();
    }
    reply = brain.toolAnswer(session.id, said);
    out('munni', reply.say);
  }
  if (rl) rl.close();

  // the call ends: build the webhook Bolna would send, from what was said
  const s = brain.getSession(session.id);
  const transcript = (s.live_turns || []).map(t => `${t.role}: ${t.text}`).join('\n');
  const res = brain.onCallEvent({
    id: 'sim-' + session.id, status: 'completed', transcript,
    conversation_duration: Math.max(60, Math.round((Date.now() - start) / 1000) + turn * 9),
    telephony_data: { recording_url: null, hangup_by: 'agent' },
    context_details: { recipient_data: { session_id: session.id } }
  });
  const done = brain.getSession(session.id);
  const child = brain.getChild(r.child.id);
  console.log(`\n— call processed: ${res.status} · relay drift ${done.relay.mismatched}/${done.relay.checked}`);
  console.log(`— levels ${JSON.stringify(done.levels_before)} → ${JSON.stringify(child.profile.levels)}`);
  console.log(`— items: ${done.items.map(i => `${i.kind}:${i.outcome}${i.evidence ? '/' + i.evidence.verdict : ''}`).join('  ')}`);
  console.log(`\nParent report (${done.report.lang}):\n${done.report.text.split('\n').map(l => '  ' + l).join('\n')}\n`);
  if (!o.data) fs.rmSync(dir, { recursive: true, force: true });
}

main().catch(e => { console.error(e); process.exit(1); });
