#!/usr/bin/env node
/* ==================================================================
   QUIET MOMENTS AND GAMES — run with: node test/voice-quiet.test.js

   When a child goes quiet: an easier way into the same question, then a
   different one; never a wrong answer; kept live and from the transcript;
   in the report, the weekly call, the dashboard signal, the placement
   call; and the next call starts easier. And Talking Munni in the games:
   the lesson pauses, a miss gets a hint from the server's own validated
   bank (never the phone's text), lines are throttled, silence is play.
   ================================================================== */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const U = require('../voice/understand');
const S = require('../voice/session');
const PC = require('../voice/parent');
const { createBrain } = require('../voice/brain');
const { createWeb } = require('../voice/web');

let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); pass++; results.push('  ok    ' + name); }
  catch (e) { fail++; results.push('  FAIL  ' + name + '\n        ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); }
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'takhti-quiet-test-'));
let n = 0;
const phone = () => '+9196000' + String(10000 + (n++)).padStart(5, '0');
const perfect = it => it.expect === 'yesno' ? (it.answer ? 'yes' : 'no') : it.expect === 'number' ? String(it.answer) : it.target;
const cur = (brain, id) => { const s = brain.getSession(id); return s.items[s.items.length - 1]; };
function hangUp(brain, id, extra) {
  const s = brain.getSession(id);
  const lines = (s.live_turns || []).map(t => `${t.role}: ${t.text}`);
  return brain.onCallEvent({ id: 'ex-' + id + (extra && extra.tag || ''), status: 'completed', transcript: (extra && extra.edit ? extra.edit(lines) : lines).join('\n'),
                             conversation_duration: 240, telephony_data: {}, context_details: { recipient_data: { session_id: id } } });
}

(async () => {

await test('silence is its own thing: an empty reply and the graph\'s "(silence)" marker', () => {
  for (const u of ['', '   ', '(silence)', '[silence]', '(no reply)']) assert.strictEqual(U.intentOf(u), 'silence', JSON.stringify(u));
  assert.strictEqual(U.intentOf('silence is golden'), 'answer');
  for (const k of ['quietClue', 'quietYN', 'quietRead', 'quietRepeat', 'quietAgain', 'quietMoveOn']) {
    assert.ok(S.L[k].en && S.L[k].hi && /[ऀ-ॿ]/.test(S.L[k].hi), k);
    assert.ok(!/wrong|गलत/i.test(S.L[k].en + S.L[k].hi), k);
  }
});

await test('a quiet child gets an easier way in, then a different question — never a wrong answer, never first-try credit', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Riya', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child;
  const { session } = brain.createSession(c.id, { seed: 'quiet-1' });
  brain.toolNext(session.id);
  // warm-up: quiet once → two choices
  let it = cur(brain, session.id);
  let r = brain.toolAnswer(session.id, '(silence)');
  assert.ok(/^Take your time\. Is it/.test(r.say), r.say);
  assert.ok(cur(brain, session.id).choices.includes(it.answer));
  r = brain.toolAnswer(session.id, String(it.answer));
  assert.strictEqual(brain.getSession(session.id).items[0].outcome, 'correct_after_clue', 'an eased answer counted as a first try');
  // the first sum: quiet twice → a different question, recorded as nothing
  const before = JSON.stringify(brain.getChild(c.id).profile.attempts || {});
  it = cur(brain, session.id);
  assert.strictEqual(it.kind, 'math');
  brain.toolAnswer(session.id, '');
  r = brain.toolAnswer(session.id, '');
  assert.ok(/That's okay! Let's try a different one\./.test(r.say), r.say);
  const s = brain.getSession(session.id);
  assert.strictEqual(s.items[1].outcome, 'silent');
  assert.strictEqual(JSON.stringify(brain.getChild(c.id).profile.attempts || {}), before, 'a silent sum was recorded');
  assert.strictEqual(s.silence_log.length, 3);
  // a reading line: quiet → the first words to start with
  let x = r;
  for (let i = 0; i < 20 && !x.done && cur(brain, session.id).expect !== 'reading'; i++) x = brain.toolAnswer(session.id, perfect(cur(brain, session.id)));
  const rd = cur(brain, session.id);
  r = brain.toolAnswer(session.id, '(silence)');
  assert.ok(r.say.startsWith('Take your time. Start with: ' + rd.target.split(/\s+/).slice(0, 2).join(' ')), r.say);
});

await test('after the call: quiet moments from the transcript too, in the report kindly, and the next call starts easier', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Aman', age: 7, lang: 'hi', parent_phone: phone(), consent: true }).child;
  const { session } = brain.createSession(c.id, { seed: 'quiet-2' });
  let r = brain.toolNext(session.id);
  // the child is quiet once live (graph marker) and the platform repeats a line on its own once (only in the transcript)
  brain.toolAnswer(session.id, '(silence)');
  for (let i = 0; i < 60 && !r.done; i++) r = brain.toolAnswer(session.id, perfect(cur(brain, session.id)));
  const s0 = brain.getSession(session.id);
  const second = s0.items[2];
  hangUp(brain, session.id, { edit: lines => {
    const k = lines.findIndex(l => l.startsWith('assistant:') && l.includes(second.prompts[0].slice(0, 20)));
    lines.splice(k + 1, 0, 'assistant: ' + second.prompts[0]);       // said twice, nothing in between
    return lines;
  } });
  const s = brain.getSession(session.id);
  assert.ok(s.silence && s.silence.live === 1 && s.silence.transcript >= 1, JSON.stringify(s.silence));
  assert.ok(s.silence.items.includes(1) && s.silence.items.includes(second.n), JSON.stringify(s.silence));
  assert.ok(/जवाब नहीं आया/.test(s.report.text) && /आसान शुरुआत/.test(s.report.text), s.report.text);
  assert.ok(!/गलत|wrong/i.test(s.report.text));
  const k = brain.getChild(c.id);
  assert.strictEqual(k.quiet.length, 1);
  assert.strictEqual(k.quiet[0].items, s.silence.items.length);
  // the promise in the report is kept: an extra (unscored) warm-up first
  const nx = brain.createSession(c.id, { seed: 'quiet-3' }).session;
  assert.strictEqual(nx.ease, 'after a quiet call');
  assert.deepStrictEqual(nx.slots.slice(0, 2), ['warm', 'warm']);
  // …once: after an ordinary call, an ordinary start
  let y = brain.toolNext(nx.id);
  for (let i = 0; i < 60 && !y.done; i++) y = brain.toolAnswer(nx.id, perfect(cur(brain, nx.id)));
  hangUp(brain, nx.id);
  assert.strictEqual(brain.createSession(c.id, { seed: 'quiet-4' }).session.ease, null);
});

await test('a call that ended because the child went quiet: said plainly; twice in a week → "check in" for a person, nothing sent', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Zoya', age: 8, lang: 'en', parent_phone: phone(), consent: true }).child;
  for (let k = 0; k < 2; k++) {
    const { session } = brain.createSession(c.id, { seed: 'q-end-' + k });
    brain.toolNext(session.id);
    brain.toolAnswer(session.id, '');
    hangUp(brain, session.id, { edit: lines => lines.concat('assistant: It sounds like now is not a good time. We will talk again. Bye bye!') });
    const s = brain.getSession(session.id);
    assert.ok(s.silence.ended_in_silence, JSON.stringify(s.silence));
    assert.ok(/The call ended because Zoya went quiet/.test(s.report.text), s.report.text);
  }
  const q = brain.quietSignal(brain.getChild(c.id));
  assert.ok(q.check_in && q.ended_calls === 2 && q.week_calls === 2, JSON.stringify(q));
});

await test('the weekly parent call mentions a quiet week, and where the child went quiet most', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Dev', age: 7, lang: 'en', parent_phone: phone(), consent: true }).child;
  for (let k = 0; k < 2; k++) {
    const { session } = brain.createSession(c.id, { seed: 'wq-' + k });
    let r = brain.toolNext(session.id);
    for (let i = 0; i < 60 && !r.done; i++) {
      const it = cur(brain, session.id);
      r = brain.toolAnswer(session.id, it.kind === 'math' && it.n <= 3 && !it.silences ? '' : perfect(it));
    }
    hangUp(brain, session.id);
  }
  const kid = brain.getChild(c.id);
  kid.quiet_skills = { carry: 3 }; brain.store.put('children', kid.id, kid);
  const f = PC.weekFacts(kid, brain.childSessions(kid));
  assert.ok(f.quiet >= 2, JSON.stringify(f));
  assert.ok(/went quiet on \d+ questions this week/.test(PC.weekSummary(kid, f, 'en')));
  const s = brain.createParentSession(c.id, 'weekly').session;
  brain.toolParent(s.id, 'yes');
  const out = brain.toolParent(s.id, 'how is he doing in maths');
  assert.ok(/went quiet most often on "carrying"/.test(out.say), out.say);
});

await test('placement: quiet on a step is not an attempt; quiet twice on the same step sends the search easier', () => {
  const brain = createBrain({ dataDir: tmp() });
  const c = brain.registerChild({ name: 'Kabir', age: 8, lang: 'en', parent_phone: phone(), consent: true }).child;
  const { session } = brain.createSession(c.id, { kind: 'placement', seed: 'pq' });
  brain.toolNext(session.id);
  const first = cur(brain, session.id).skill;
  let r = brain.toolAnswer(session.id, '(silence)');
  assert.ok(/^Take your time\./.test(r.say));
  r = brain.toolAnswer(session.id, '');                     // quiet twice: a fresh sum on the same step
  assert.strictEqual(cur(brain, session.id).skill, first);
  brain.toolAnswer(session.id, ''); brain.toolAnswer(session.id, '');   // and quiet again: the step counts as "not yet"
  const s = brain.getSession(session.id);
  assert.ok(s.place.tested[first].quiet, JSON.stringify(s.place.tested));
  assert.strictEqual((brain.getChild(c.id).profile.skillHistory || {})[first], undefined, 'silence was recorded as an attempt');
  assert.ok(s.place.hi <= s.place.ladder.indexOf(first) || s.items[s.items.length - 1].skill !== first, 'the search did not move on');
});

/* ---------------- Talking Munni in the games ---------------- */
await test('games: the lesson pauses, a miss gets a hint from the server\'s own bank, throttled; silence is play; back to the lesson', async () => {
  const injected = [];
  const fake = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      if (req.url === '/web-call/session') { const body = JSON.parse(b); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ run_id: 'run-' + body.user_data.session_id })); }
      const m = req.url.match(/^\/v1\/call\/([^/]+)\/events$/);
      if (m) { injected.push(JSON.parse(b)); res.writeHead(202); return res.end('{}'); }
      res.writeHead(404); res.end();
    });
  });
  await new Promise(r => fake.listen(0, r));
  try {
    const brain = createBrain({ dataDir: tmp() });
    const env = { BOLNA_API_KEY: 'k', BOLNA_AGENT_ID: 'a', BOLNA_API_BASE: `http://127.0.0.1:${fake.address().port}`, TAKHTI_PLAY_GAP_MS: '60000' };
    const web = createWeb(brain, env);
    const st = await web.startSession({ consent: true, child: { id: 'cGAME0001', name: 'Mira', age: 7, lang: 'en', levels: { read: 2, write: 2, math: 3 } } }, '1.2.3.4');
    const { session_id: sid, token } = st.body;
    brain.toolNext(sid);
    const open = cur(brain, sid);
    assert.strictEqual((await web.game(sid, token, { event: 'miss', item: 'x' })).body.said, null, 'a hint while not playing');
    let m = await web.mode(sid, token, 'play');
    assert.ok(m.body.changed && injected.pop().event === 'play_mode');
    assert.strictEqual(web.state(sid, token).body.screen, null, 'the lesson screen showed during a game');
    // what the child says while playing is not graded
    const r1 = brain.toolAnswer(sid, '7');
    assert.ok(/I'm watching/.test(r1.say), r1.say);
    assert.strictEqual(cur(brain, sid).said.length, open.said.length, 'a word during play was graded');
    assert.ok(!cur(brain, sid).outcome, 'the open question was settled during play');
    assert.strictEqual(brain.toolAnswer(sid, '(silence)').say, '', 'silence during play should be left alone');
    // a hint from the bank: find a real beat the app's games use
    const bank = brain.core.withChild(brain.core.freshProfile('x', 7), {}, T => T.lessonBank()).out;
    let id = null, beat = null;
    for (const les of bank) { const i = les.beats.findIndex(b => b.t === 'ask' && b.opts && b.q && b.q.en.length < 80); if (i >= 0) { id = les.id + ':' + i; beat = les.beats[i]; break; } }
    const right = String(beat.opts[beat.correct]);
    // the phone's copy disagrees → no hint (nothing unchecked is ever said)
    assert.strictEqual((await web.game(sid, token, { event: 'miss', item: id, right: right + '9' })).body.said, null);
    let g = await web.game(sid, token, { event: 'miss', item: id, right });
    assert.ok(g.body.said && g.body.said.startsWith('Almost!') && g.body.said.includes(right), JSON.stringify(g.body));
    const ev = injected.pop();
    assert.strictEqual(ev.event, 'game_say'); assert.strictEqual(ev.properties.screen_say, g.body.said);
    assert.strictEqual((await web.game(sid, token, { event: 'miss', item: id, right })).body.said, null, 'not throttled');
    // a different gap: set items and the end of a round
    const web2 = createWeb(brain, Object.assign({}, env, { TAKHTI_PLAY_GAP_MS: '0' }));
    assert.ok(/different from the others/.test((await web2.game(sid, token, { event: 'miss', item: 'set-parity-3' })).body.said));
    assert.strictEqual((await web2.game(sid, token, { event: 'end', score: 11 })).body.said, 'Well played! 11 right.');
    assert.strictEqual((await web2.game(sid, token, { event: 'end', score: 'lots' })).body.said, null);
    assert.strictEqual((await web2.game(sid, token, { event: 'miss', item: 'made-up:0', right: 'hello' })).body.said, null, 'an unknown item was spoken');
    assert.strictEqual((await web2.game(sid, 'wrong-token', { event: 'end', score: 3 })).status, 404);
    // back at the Pond: the open question again
    m = await web.mode(sid, token, 'lesson');
    const back = injected.pop();
    assert.ok(back.event === 'lesson_mode' && back.properties.screen_say.startsWith("Welcome back! Let's carry on.") && back.properties.screen_say.includes(open.prompts[0].slice(-20)), JSON.stringify(back));
    brain.toolAnswer(sid, String(open.answer));
    assert.ok(brain.getSession(sid).items.find(i => i.n === open.n).outcome, 'the lesson did not carry on after the game');
  } finally { fake.close(); }
});

await test('the agent graph: a quiet node for silence, a play node with no silence repeats, and a web build that doesn\'t hang up on a silent game', () => {
  const phoneAgent = require('../voice/agent/build-agent').agent;
  const nodes = phoneAgent.agent_config.tasks[0].tools_config.llm_agent.llm_config.nodes;
  const byId = Object.fromEntries(nodes.map(x => [x.id, x]));
  for (const nd of nodes) for (const e of nd.edges) assert.ok(byId[e.to_node_id], e.to_node_id);
  assert.ok(byId.hush && byId.hush.function_call === 'takhti_answer' && /\(silence\)/.test(byId.hush.prompt));
  assert.ok(byId.lesson.edges.some(e => e.to_node_id === 'hush' && e.expression.conditions[0].variable === '_silence_repeats'));
  assert.ok(byId.play && !('repeat_after_silence_seconds' in byId.play), 'play repeats lines into silence');
  assert.ok(!byId.play.edges.some(e => e.to_node_id === 'quiet_end' || e.to_node_id === 'hush'), 'a silent game would end the call');
  assert.ok(byId.lesson.edges.some(e => e.event_name === 'play_mode') && byId.play.edges.some(e => e.event_name === 'game_say') && byId.play.edges.some(e => e.event_name === 'lesson_mode'));
  assert.strictEqual(phoneAgent.agent_config.tasks[0].task_config.hangup_after_silence, 25);
  delete require.cache[require.resolve('../voice/agent/build-agent')];
  process.env.TAKHTI_AGENT_FOR = 'web';
  const webAgent = require('../voice/agent/build-agent').agent;
  delete process.env.TAKHTI_AGENT_FOR;
  assert.ok(webAgent.agent_config.tasks[0].task_config.hangup_after_silence >= 600);
});

console.log(results.join('\n'));
console.log(`\n${pass}/${pass + fail} quiet-and-games checks passed`);
process.exit(fail ? 1 : 0);
})();
