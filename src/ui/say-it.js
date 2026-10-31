/* ==================================================================
   SAY IT WITH MUNNI — after a slip, Munni teaches the right way to say
   the word, the child says it, and it is checked again

   1. Munni says the word, then its pieces slowly — akshara for Hindi
      (भा · ई), syllables for English (pen · cil) — with the help aimed at
      HOW it slipped (core/lang-mistakes.js: "भ has a puff of air — hold
      your hand in front of your mouth"), then the whole word slowly, then
      at speed.
   2. "Now you say it": the child says the word; Sarvam writes down what
      was said (ui/cloud-read.js — the reading terms; offline, the phone's
      own recognizer) and it is graded here.
   3. Right → praise, and "now read the whole line again". Not yet →
      the pieces once more, slower, and another try. Two tries, then a
      kind "we'll do it again next time" — never "wrong".

   Munni's voice is Sarvam's (Bulbul): pre-rendered at build time for every
   word of every reading line and every piece of every word
   (tools/build-audio.mjs → audio/, played offline by core/voice.js); a
   line not in the pack is spoken by Sarvam live through the voice server
   (POST /reading/tts) when there is a signal; else the phone's own voice.

   The word said here is help, not evidence: nothing is recorded but a
   teaching moment (mindTaught(…, 'chunks')) — the next reading of the line
   is the child's own.
   ================================================================== */
let SAY = null;            // { word, pieces, slip, lang, tries, step, heard, line, busy }
const SAY_TTS = new Map(); // text|lang|pace -> data URL, for this session

const SAYL = {
  intro:  { en: w => `Let's say ${w} together.`,  hi: w => `चलो, ${w} साथ में बोलें।` },
  pieces: { en: 'Piece by piece:',                 hi: 'टुकड़ों में:' },
  slow:   { en: 'Slowly:',                         hi: 'धीरे से:' },
  you:    { en: 'Now you say it!',                 hi: 'अब तुम बोलो!' },
  again:  { en: "Almost! Listen once more, slowly.", hi: 'लगभग! एक बार और सुनो, धीरे से।' },
  yes:    { en: 'Yes! That is exactly it!',        hi: 'हाँ! बिलकुल ऐसे ही!' },
  line:   { en: 'Now read the whole line again.',  hi: 'अब पूरी पंक्ति फिर से पढ़ो।' },
  later:  { en: "That's okay — we'll say it again next time.", hi: 'कोई बात नहीं — अगली बार फिर बोलेंगे।' }
};
const sayT = (k, ...a) => { const v = SAYL[k][SAY && SAY.lang === 'hi' ? 'hi' : 'en']; return typeof v === 'function' ? v(...a) : v; };

/* Munni's voice: the pre-rendered Sarvam file, else Sarvam live, else the phone. */
function sayVoice(text, lang, slow){
  return new Promise(done => {
    const finish = () => done();
    (async () => {
      try{
        if(typeof playRecorded === 'function' && await playRecorded(text, lang, finish)){
          if(slow && typeof VOICE_EL !== 'undefined' && VOICE_EL) VOICE_EL.playbackRate = Math.max(0.5, VOICE_EL.playbackRate * 0.7);
          return;
        }
      }catch(e){}
      if(TALK_URL && S.online){
        try{
          const k = `${text}|${lang}|${slow ? 0.7 : 0.95}`;
          let src = SAY_TTS.get(k);
          if(!src){
            const res = await fetch(TALK_URL + '/reading/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, lang, pace: slow ? 0.7 : 0.95 }) });
            const d = await res.json().catch(() => ({}));
            if(res.ok && d.audio){ src = 'data:' + (d.mime || 'audio/mpeg') + ';base64,' + d.audio; SAY_TTS.set(k, src); }
          }
          if(src){
            const a = new Audio(src);
            a.onended = finish; a.onerror = finish;
            await a.play();
            return;
          }
        }catch(e){ /* the phone's own voice below */ }
      }
      if(typeof speakDevice === 'function') speakDevice(text, lang, finish); else finish();
    })();
  });
}

/* Start teaching a word (from the Reading Tree, after a slip). */
async function sayStart(word, slip){
  const lang = /[ऀ-ॿ]/.test(word) ? 'hi' : 'en';
  word = String(word).replace(/[.,!?।"“”]/g, '');
  if(!word) return;
  if(typeof stopListening === 'function') stopListening();
  SAY = { word, pieces: wordChunks(word, lang), slip: slip && slip.word && slip.word.replace(/[.,!?।]/g, '') === word ? slip : null,
          lang, tries: 0, step: 'teach', heard: null, line: S.ctx.sentence };
  if(typeof mindTaught === 'function') mindTaught(readSkill(), 'chunks');   // a teaching moment, by pieces
  log(0, `Say it with Munni · "${word}" in pieces: ${SAY.pieces.join(' · ')}`);
  render();
  await sayTeach(false);
}

async function sayTeach(again){
  const s = SAY; if(!s) return;
  s.step = 'teach'; s.busy = true; render();
  const live = () => SAY === s && S.screen === 'read';
  const lines = again ? [[sayT('again'), false]] : [[sayT('intro', s.word), false]];
  for(const [t, slow] of lines){ if(!live()) return; await sayVoice(t, s.lang, slow); }
  for(let i = 0; i < s.pieces.length; i++){ if(!live()) return; s.now = i; render(); await sayVoice(s.pieces[i], s.lang, true); }
  s.now = null; render();
  if(s.slip && typeof langTip === 'function'){ const tip = langTip(s.slip, s.lang); if(tip && live()) await sayVoice(tip, s.lang, false); }
  if(!live()) return;
  await sayVoice(s.word, s.lang, true);
  if(!live()) return;
  await sayVoice(s.word, s.lang, false);
  if(!live()) return;
  await sayVoice(sayT('you'), s.lang, false);
  if(!live()) return;
  s.busy = false;
  sayListen();
}

/* The child says the word; Sarvam (or the phone) writes it down; graded here. */
function sayListen(){
  const s = SAY; if(!s) return;
  s.step = 'listen'; render();
  const got = alts => { if(SAY !== s) return; sayCheck((alts && alts[0] && alts[0].transcript) || ''); };
  const end = () => { if(SAY !== s) return; s.step = 'type'; render(); };      // no recognizer: the child can still type it
  const r = cloudReadReady() ? cloudListen(got, end, { text: s.word })
          : deviceListenAllowed() ? listen(got, err => { if(err) end(); }) : (end(), null);
  ACTIVE_LISTEN = r;
}

async function sayCheck(heard){
  const s = SAY; if(!s) return;
  ACTIVE_LISTEN = null;
  s.heard = String(heard || '').trim();
  const words = s.heard.split(/\s+/).filter(Boolean);
  const ok = words.some(w => gradeWord(s.word, w, s.lang) === 'ok');
  s.tries++;
  log(0, `Say it with Munni · heard "${s.heard}" for "${s.word}": ${ok ? 'said right' : 'not yet'} (help, not evidence)`);
  if(ok){
    s.step = 'done'; s.right = true; render();
    if(typeof trumpet === 'function') trumpet(1);
    await sayVoice(sayT('yes'), s.lang, false);
    if(SAY === s) await sayVoice(sayT('line'), s.lang, false);
    return;
  }
  // HOW it slipped this time, for the next try
  const m = typeof wordMistake === 'function' ? wordMistake(s.word, words[0] || '', s.lang) : null;
  if(m) s.slip = m;
  if(s.tries >= 2){ s.step = 'done'; s.right = false; render(); await sayVoice(sayT('later'), s.lang, false); return; }
  await sayTeach(true);
}

function sayClose(){ if(typeof stopListening === 'function') stopListening(); SAY = null; render(); }
function sayTyped(v){ if(SAY && String(v || '').trim()) sayCheck(v); }

/* The card on the Reading Tree. */
function sayHTML(){
  const s = SAY;
  if(!s || s.line !== S.ctx.sentence) return '';
  const hi = s.lang === 'hi';
  const pieces = s.pieces.map((p, i) => `<button class="chip ${s.now === i ? 'now' : ''}" data-say="${attr(p)}" onclick="sayEl(this)">${attr(p)}</button>`).join('<i>·</i>');
  const tip = s.slip && typeof langTip === 'function' ? langTip(s.slip, s.lang) : '';
  const status = s.step === 'listen' ? `<div class="muted" style="margin-top:8px">🎙 ${hi ? 'सुन रही हूँ… अब तुम बोलो' : "I'm listening… say it now"}</div>`
    : s.step === 'type' ? `<div style="margin-top:8px"><input class="input" id="sayTyped" placeholder="${hi ? 'शब्द लिखो' : 'Type the word'}"><button class="btn ghost" style="margin-top:6px" onclick="sayTyped($('sayTyped').value)">${hi ? 'जाँचो' : 'Check'}</button></div>`
    : s.step === 'done' ? `<div class="feedback" style="margin-top:8px">${s.right ? (hi ? 'शाबाश! अब पूरी पंक्ति फिर से पढ़ो।' : 'Well done! Now read the whole line again.') : (hi ? 'कोई बात नहीं — अगली बार फिर बोलेंगे।' : "That's okay — we'll say it again next time.")}</div>
        <button class="btn ghost" style="margin-top:6px" onclick="sayClose()">${hi ? 'ठीक है' : 'OK'}</button>` : '';
  return `<div class="card saycard" style="margin-top:10px">
    <div class="kicker2">🐘 ${hi ? 'मुन्नी के साथ बोलो' : 'SAY IT WITH MUNNI'}</div>
    <div class="display" style="font-size:30px;margin:4px 0" data-say="${attr(s.word)}" onclick="sayEl(this)">${attr(s.word)}</div>
    <div class="mindchunks">${pieces}</div>
    ${tip ? `<div class="twintip" style="margin-top:8px">💡 ${attr(tip)}</div>` : ''}
    ${s.heard && s.step !== 'done' ? `<div class="muted" style="font-size:12.5px;margin-top:6px">${hi ? 'मुन्नी ने सुना' : 'Munni heard'}: "${attr(s.heard)}"</div>` : ''}
    ${status}
  </div>`;
}

/* After a reading that slipped: the word to teach, and whether to start at once. */
function sayOffer(r, slip){
  if(!r || S.ctx.helped) return;
  const word = (slip && slip.word) || (r.misread || [])[0] || (r.slips || [])[0];
  if(!word) return;
  S.ctx.sayWord = word.replace(/[.,!?।"“”]/g, '');
  // a word read wrong (or a line that didn't pass): Munni starts teaching straight away;
  // a pass with only an "almost" word: the button
  if(S.ctx.score != null && (!S.ctx.passed || (r.misread || []).length)) setTimeout(() => { if(S.screen === 'read' && S.ctx.sayWord && !SAY) sayStart(S.ctx.sayWord, slip); }, 900);
}
