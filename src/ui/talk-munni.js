/* ==================================================================
   TALKING MUNNI — talk out loud with Munni at Munni's Pond.

   The one place in the app where a child's voice leaves the phone, so it
   is built to the strictest rules in the repo:

   - OFF for every child until a parent turns it on behind the PIN, after
     reading, in Hindi and English, exactly what happens to the voice
     (views.js parent(), talkParentHTML() below). This build has it at all
     only when TAKHTI_VOICE names a voice server (config.js TALK_URL).
   - It lives at Munni's Pond, the Tier 2 place, and never gates anything:
     every other screen, every lesson, runs exactly as before. No signal,
     no talk — and an honest sentence saying so.
   - It is a tutor call, not a companion: the server runs the same bounded
     lesson as a phone call (voice/session.js), with a daily limit.
   - The screen and the voice work together: the line to read is shown on
     screen, and after a first miss the two clue choices appear as buttons.
     A tap is graded on the server and Munni answers it at once (the
     server pushes her reply into the live call).
   - It stays on into the games (the Play Clearing and the six shells): the
     lesson waits, and Munni keeps the child company — a missed answer gets
     the right one, kindly, said from the server's own copy of the
     validated lesson bank; a finished round gets "well played". A small
     "Munni is with you" bar stays on screen the whole time, with an end
     button, so a live microphone is never invisible.
   - Going anywhere else (reading, writing, the parent dashboard…), losing
     signal, or switching child ends the talk.
   - Afterwards the talk's attempts are replayed through this child's own
     record() / skill history — once per talk (S.talkApplied), and only
     into the child who talked.

   The Bolna Web Call SDK is loaded from its CDN only when a parent has
   turned this on and the Pond is open with a signal; it is not part of
   the offline shell.
   ================================================================== */
const TALK_SDK = 'https://cdn.jsdelivr.net/gh/bolna-ai/web-call@v3.0.1/dist/bolna-web-call.min.js';
let TALK = null;   // the talk in progress: { childId, call, state, session, token, screen, timer, vol, msg }

const talkSetUp = () => !!TALK_URL;
const talkLive = () => !!(TALK && TALK.state && TALK.state !== 'ended');

/* ---------- the Pond's panel ---------- */
function talkPanelHTML(){
  if(!TALK_URL || !S.talkMunni) return '';
  const hi = S.lang === 'hi';
  if(talkLive()) return `<div class="talkpanel" id="talkpanel">${talkScreenHTML()}</div>`;
  if(!S.online) return `<div class="muted talknote">${hi
    ? 'मुन्नी से बोलकर बात करने के लिए इंटरनेट चाहिए। यहाँ बाकी सब बिना इंटरनेट के चलता है।'
    : 'Talking with Munni needs the internet. Everything else here works without it.'}</div>`;
  const msg = TALK && TALK.msg ? `<div class="muted talknote">${attr(TALK.msg)}</div>` : '';
  return `${msg}<button class="btn leaf" style="margin-top:12px" onclick="talkStart()">🎙️ ${hi?'मुन्नी से बात करो':'Talk with Munni'}</button>`;
}

function talkScreenHTML(){
  const hi = S.lang === 'hi', sc = TALK.screen;
  const status = TALK.state === 'active'
    ? (hi ? 'मुन्नी सुन रही है…' : 'Munni is listening…')
    : (hi ? 'मुन्नी को बुला रहे हैं…' : 'Calling Munni…');
  let body = '';
  if(sc && sc.text){
    if(sc.kind === 'read' || sc.kind === 'repeat') body = `<div class="talkline">${attr(sc.text)}</div>`;
    else {
      const ok = c => /^(\d{1,4}|yes|no)$/.test(String(c));
      const label = c => c === 'yes' ? (hi?'हाँ':'Yes') : c === 'no' ? (hi?'नहीं':'No') : c;
      const choices = (sc.choices || []).filter(ok);
      body = `<div class="talkq">${attr(sc.text)}</div>` + (choices.length
        ? `<div class="opts">${choices.map(c => `<button class="opt" onclick="talkTap('${c}')">${label(c)}</button>`).join('')}</div>`
        : '');
    }
  }
  return `<div class="talkstatus"><span class="talkdot"></span>${status}</div>
    ${body}
    <button class="btn ghost" style="margin-top:12px" onclick="talkStop()">${hi?'बात ख़त्म करो':'End the talk'}</button>`;
}

function talkRefresh(){
  if(TALK && TALK.help) return askPanel();      // a help call lives in the Ask Munni panel
  if(S.screen !== 'ask') return;
  const el = $('talkpanel');
  if(el && talkLive()) el.innerHTML = talkScreenHTML();
  else render();
}

/* Load the SDK as soon as the Pond opens (opted in, with a signal), so a
   tap can start the call inside the tap itself — browsers only let audio
   start from a real user gesture. */
function talkPreload(){
  if(!TALK_URL || !S.talkMunni || !S.online || window.BolnaWebCall || $('bolna-sdk')) return;
  const sc = document.createElement('script');
  sc.id = 'bolna-sdk'; sc.src = TALK_SDK; sc.async = true;
  document.head.appendChild(sc);
}
AFTER.ask = talkPreload;

/* ---------- start, run, end ---------- */
function talkStart(){
  if(!TALK_URL || !S.talkMunni || !S.online || talkLive()) return;
  TALK = { childId: S.id, state: 'connecting', screen: null, msg: '', vol: 0 };
  render();
  if(window.BolnaWebCall) return talkBegin();
  talkPreload();
  const sc = $('bolna-sdk');
  if(sc) sc.onload = () => talkBegin();
}

/* "Still stuck? Munni calls" (ui/ask-munni.js): the same live call, about
   the one question on screen. The server plans the steps (voice/help.js). */
function talkHelp(item, onMsg){
  if(!TALK_URL || !S.talkMunni || !S.online || talkLive()) return;
  TALK = { childId: S.id, state: 'connecting', screen: null, msg: '', vol: 0, help: item, helpScreen: S.screen, onMsg };
  if(window.BolnaWebCall) return talkBegin();
  talkPreload();
  const sc = $('bolna-sdk');
  if(sc) sc.onload = () => talkBegin();
}

function talkBegin(){
  const call = new window.BolnaWebCall({ getSession: talkMint });
  TALK.call = call;
  call.on('call-start', () => {
    if(!TALK) return;
    TALK.state = 'active';
    log(2, TALK.help ? 'Ask Munni · Munni called to help with this question — the voice goes to the voice service while talking'
                     : 'Talking Munni · live call — the voice goes to the voice service while talking');
    talkRefresh(); talkPoll();
  });
  call.on('call-end', () => talkEnded());
  call.on('error', e => {
    if(!TALK) return;
    TALK.msg = talkErrorText(TALK.mintErr || (e && e.code));
    talkEnded();
  });
  call.on('volume-level', v => {
    const d = document.querySelector('.talkdot');
    if(d) d.style.transform = `scale(${1 + Math.min(1, v || 0) * 0.8})`;
  });
  call.start().catch(() => {});
}

/* The browser never holds the voice service's key: the voice server mints
   a short-lived, one-use session for this child's lesson. */
async function talkMint(){
  const res = await fetch(TALK_URL + '/voice/web/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, key: S.talkKey || undefined, circle_key: S.circleKey || undefined,
      help: TALK && TALK.help || undefined,
      child: { id: S.id, name: S.name, age: S.age || 6, lang: S.lang, levels: S.levels } })
  });
  const d = await res.json().catch(() => ({}));
  if(!res.ok){ if(TALK) TALK.mintErr = d.limit ? 'limit' : d.help === false ? 'no_help' : 'mint_failed'; throw new Error(d.error || 'mint'); }
  if(d.key){ S.talkKey = d.key; saveSoon(); }
  TALK.session = d.session_id; TALK.token = d.token;
  return d.bolna;
}

function talkErrorText(code){
  const hi = S.lang === 'hi';
  if(code === 'limit') return hi ? 'आज के लिए बहुत बात हो गई! कल फिर मिलेंगे।' : "That's enough talking for today! See you tomorrow.";
  if(code === 'microphone_denied') return hi ? 'माइक की अनुमति नहीं मिली। माता-पिता फ़ोन की सेटिंग में माइक चालू कर सकते हैं।' : 'The microphone was not allowed. A parent can turn it on in the phone settings.';
  if(code === 'no_help') return hi ? 'इस सवाल पर मुन्नी अभी कॉल नहीं कर सकती। ऊपर के क़दम फिर से सुनो।' : "Munni can't call about this one yet. Listen to the steps again.";
  if(code === 'autoplay_blocked') return hi ? 'एक बार फिर दबाओ।' : 'Tap once more.';
  return hi ? 'अभी मुन्नी से जुड़ नहीं पाए। बाद में फिर कोशिश करो।' : "Couldn't reach Munni just now. Try again later.";
}

/* What the screen should show: polled while the call is live. */
function talkPoll(){
  clearInterval(TALK && TALK.timer);
  if(!TALK || !TALK.session) return;
  const mine = TALK;
  mine.timer = setInterval(async () => {
    if(TALK !== mine || !talkLive()) return clearInterval(mine.timer);
    try{
      const res = await fetch(`${TALK_URL}/voice/web/state?session=${encodeURIComponent(mine.session)}&token=${encodeURIComponent(mine.token)}`);
      if(!res.ok) return;
      const d = await res.json();
      mine.screen = d.screen || null;
      talkRefresh();
    }catch(e){ /* a missed poll is not an error: the next one catches up */ }
  }, 900);
}

/* The child tapped instead of speaking. The server grades it and makes
   Munni say her reply in the call straight away. */
async function talkTap(choice){
  if(!talkLive() || !TALK.session) return;
  try{
    const res = await fetch(TALK_URL + '/voice/web/tap', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: TALK.session, token: TALK.token, choice: String(choice) }) });
    const d = await res.json().catch(() => ({}));
    if(TALK){ TALK.screen = d.screen || null; talkRefresh(); }
  }catch(e){ /* the child can still say the answer out loud */ }
}

function talkStop(){ if(TALK && TALK.call) TALK.call.stop(); else talkEnded(); }

/* Called by setOnline(false), switching child, and turning it off. */
function talkLeave(){ if(talkLive()) talkStop(); }

/* go() calls this on every screen change. The talk lives at the Pond and
   in the games; the map is the path between them. Anywhere else it ends —
   the Reading Tree needs the microphone for itself. */
const TALK_KEEP = ['ask', 'map', 'games', 'runner', 'pop', 'tower', 'match', 'sort', 'archer'];
function talkFollow(screen){
  if(!talkLive()) return;
  if(TALK.help){ if(screen !== TALK.helpScreen || TALK.childId !== S.id) talkStop(); return; }   // a help call is about this one screen
  if(!TALK_KEEP.includes(screen) || TALK.childId !== S.id) return talkStop();   // and never for a sibling
  if(screen === 'ask') talkMode('lesson');
  else if(screen !== 'map') talkMode('play');
}
function talkMode(m){
  if(!talkLive() || !TALK.session || TALK.mode === m) return;
  if(!TALK.mode && m === 'lesson') { TALK.mode = m; return; }   // the talk starts as a lesson
  TALK.mode = m;
  fetch(TALK_URL + '/voice/web/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: TALK.session, token: TALK.token, mode: m }) }).catch(() => {});
}
/* game-core.js tells us about a missed answer and a finished round. Only
   the item's id goes (the server says the hint from its own bank), plus
   the answer as this phone shows it, so the server can check they match. */
function talkGame(event, it, score){
  if(!talkLive() || !TALK.session || TALK.mode !== 'play') return;
  const body = { session: TALK.session, token: TALK.token, event };
  if(it){ body.item = it.id; if(it.right) body.right = S.lang === 'hi' ? it.right.hi : it.right.en; }
  if(score != null) body.score = score;
  fetch(TALK_URL + '/voice/web/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
}
/* The bar that stays on screen while the talk is live away from the Pond. */
function talkChip(){
  let el = document.getElementById('talkchip');
  const show = talkLive() && S.screen !== 'ask' && !TALK.help;
  if(!show){ if(el) el.remove(); return; }
  const hi = S.lang === 'hi';
  if(!el){ el = document.createElement('div'); el.id = 'talkchip'; el.className = 'talkchip'; document.body.appendChild(el); }
  el.innerHTML = `<span class="talkdot"></span>${hi ? 'मुन्नी साथ है' : 'Munni is with you'}
    <button class="btn ghost" onclick="talkStop()">${hi ? 'बात ख़त्म करो' : 'End the talk'}</button>`;
}

function talkEnded(){
  if(!TALK) return;
  clearInterval(TALK.timer);
  const was = TALK.state;
  TALK.state = 'ended';
  if(was === 'active') log(2, 'Talking Munni · call ended');
  if(TALK.session) talkCollect(TALK.session, TALK.token, TALK.childId, 0);
  talkChip();
  if(TALK.help){ if(TALK.msg && TALK.onMsg) TALK.onMsg(TALK.msg); return askPanel(); }
  if(S.screen === 'ask') render();
}

/* After the call the server settles the reading from the call's own
   transcript (a few seconds); ask a few times, then let it go — the
   talk already happened, this is a bonus for the record, never a wait. */
function talkCollect(session, token, childId, tries){
  fetch(`${TALK_URL}/voice/web/result?session=${encodeURIComponent(session)}&token=${encodeURIComponent(token)}`)
    .then(r => r.json())
    .then(d => {
      if(d.pending){ if(tries < 8) setTimeout(() => talkCollect(session, token, childId, tries + 1), 4000); return; }
      if(Array.isArray(d.records)) talkApply(session, childId, d.records);
    })
    .catch(() => {});
}

/* Replay the talk through this child's own engine — record() (levels,
   goals, SRS) and the skill history — once, and only for the child who
   talked (a sibling may have been switched to since). */
function talkApply(session, childId, records){
  if(S.id !== childId){ log(null, 'Talking Munni · results kept for the child who talked, not shown to this profile'); return 0; }
  S.talkApplied = S.talkApplied || [];
  if(S.talkApplied.includes(session)) return 0;
  const keep = S.ctx;
  let n = 0;
  for(const r of records){
    if(r.mod === 'math'){
      if(r.concept) noteSkillFromConcept(r.concept, !!r.ok);
      else if(r.skill && skillById(r.skill)) noteSkillAttempt(r.skill, !!r.ok);
      record('math', !!r.ok); n++;
    } else if(r.mod === 'read' && r.sentence){
      S.ctx = { sentence: String(r.sentence) };   // record() keys the SRS item on the sentence
      record('read', !!r.ok); n++;
    }
  }
  S.ctx = keep;
  S.talkApplied = S.talkApplied.concat(session).slice(-50);
  log(2, `Talking Munni · ${n} answer(s) from the talk added to ${S.name}'s record`);
  saveSoon();
  if(S.screen === 'ask' || S.screen === 'map') render();
  return n;
}

/* ---------- the parent's switch ---------- */
function talkParentHTML(){
  const hi = S.lang === 'hi', n = S.name;
  return `<div class="kicker2" style="margin-top:14px">${hi?'मुन्नी से बात':'TALKING MUNNI'}</div>
  <div class="metric">
    <div><b>${hi?'मुन्नी से बोलकर बात':'Talk out loud with Munni'}</b>
      <div style="font-size:12.5px;opacity:.75;line-height:1.5">${hi
        ? `चालू होने पर ${n} मुन्नी के तालाब पर मुन्नी से बोलकर अभ्यास कर सकते हैं, और बात चलते-चलते खेल भी खेल सकते हैं (मुन्नी साथ रहती है)। किसी सवाल पर अटकें तो "मुन्नी से पूछो" के बाद मुन्नी ऐप में कॉल करके भी समझा सकती है। बात करते समय बच्चे की आवाज़ इंटरनेट से तख़्ती की आवाज़-सेवा (Bolna) तक जाती है, फ़ोन कॉल की तरह, और पाठ जाँचने के लिए बातचीत के शब्द रखे जाते हैं। तख़्ती का बाकी सब इसी फ़ोन पर रहता है। शुरू में बंद; कभी भी बंद कर सकते हैं।`
        : `When on, ${n} can practise out loud with Munni at Munni's Pond, and carry the talk into a game (Munni stays with them). If they are stuck on a question, after "Ask Munni" Munni can also call them in the app and explain. While they talk, their voice goes over the internet to Takhti's voice service (Bolna), like a phone call, and the words of the talk are kept to check the lesson. Everything else in Takhti stays on this phone. Off to begin with; turn it off any time.`}</div>
    </div>
    <button class="toggle ${S.talkMunni?'on':''}" onclick="toggleTalkMunni()" aria-label="${S.talkMunni?'turn off Talking Munni':'turn on Talking Munni'}"><span></span></button>
  </div>
  ${S.talkKey ? `<button class="btn ghost" onclick="talkForget()">🗑️ ${hi?'मुन्नी से बात का डेटा मिटाओ':'Delete Talking Munni data'}</button>` : ''}
  ${S.ctx.talkMsg ? `<div class="muted" style="font-size:12.5px;margin-top:4px">${attr(S.ctx.talkMsg)}</div>` : ''}`;
}

function toggleTalkMunni(){
  S.talkMunni = !S.talkMunni;
  if(!S.talkMunni) talkLeave();
  log(null, `Talking Munni ${S.talkMunni ? 'turned on by a parent — voice leaves the phone only during a talk' : 'turned off'} for ${S.name || 'this child'}`);
  saveSoon();
  render();
}

/* Erase this child's record on the voice server: the talks, their words,
   everything. Needs a signal; says so if there isn't one. */
async function talkForget(){
  const hi = S.lang === 'hi';
  if(!S.online){ S.ctx.talkMsg = hi ? 'मिटाने के लिए इंटरनेट चाहिए।' : 'Deleting needs the internet.'; return render(); }
  try{
    const res = await fetch(TALK_URL + '/voice/web/forget', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: S.id, key: S.talkKey }) });
    if(!res.ok && res.status !== 404) throw new Error('forget ' + res.status);
    S.talkKey = null;
    S.ctx.talkMsg = hi ? 'मुन्नी से बात का डेटा मिटा दिया गया।' : 'Talking Munni data deleted.';
    log(null, 'Talking Munni · voice-server record erased at a parent\'s request');
    saveSoon();
  }catch(e){
    S.ctx.talkMsg = hi ? 'अभी मिटा नहीं पाए, बाद में फिर कोशिश करें।' : "Couldn't delete just now — try again later.";
  }
  render();
}
