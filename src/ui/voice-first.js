/* ==================================================================
   VOICE-FIRST — Nursery to Class 2 (21 Nov 2026).

   A six-year-old can do the maths long before they can read "Which
   number is right?", or the three words on the answer buttons. So for
   the youngest classes Munni reads every screen to the child:

     · the question, then each choice — the button lights up while she
       says it, so the child links the sound to the word on it
     · on arriving somewhere, what to do there ("Read the line out loud,
       then tap the microphone")
     · on the map, where she suggests going next
     · a round 🔊 button (bottom left) says it all again, any time

   Who: Nursery–Class 2 by default (band().cls); a parent switches it
   either way on the parent page ("Munni reads aloud", S.readAloud).
   Story Time (Nursery–UKG) and Teach Appu already speak everything, so
   this layer leaves them alone.

   Like ui/playful.js, it only listens to what render() drew: it never
   changes what a screen does or what is recorded. It never talks over a
   screen's own narration — it waits until Munni has finished (speechBusy()
   in core/speech.js) — and a question the screen reads itself (a lesson,
   a cartoon) gets only its choices read after it. Not during a Talking
   Munni call (Munni is talking live), and nothing when the sound is off.
   No network of its own: speak() is the same voice as everywhere else.
   ================================================================== */
const VF_CLASSES = ['nur', 'lkg', 'ukg', 'c1', 'c2'];
const VF_SKIP = new Set(['arrival', 'onboard', 'parent', 'parentlock', 'teacher', 'stories', 'story', 'teach', 'open']);

function voiceFirstOn(){
  if(S.readAloud === 'on') return true;
  if(S.readAloud === 'off') return false;
  try{ return VF_CLASSES.includes(band().cls); }catch(e){ return false; }
}

const VF = { key: null, ctx: null, arrival: 0, intro: {}, run: 0, now: null };
const vfL = (en, hi) => S.lang === 'hi' ? hi : en;
const vfText = el => (el ? el.textContent : '').replace(/[🔊❓]/g, '').replace(/\s+/g, ' ').trim();

/* "4 + 3", "4 + 3 = ?" → what Munni says. Digits stay digits; the signs become words. */
function vfMathWords(t, lang){
  const hi = (lang || S.lang) === 'hi';
  const W = hi ? { '+':'जमा', '-':'घटा', '−':'घटा', '×':'गुणा', 'x':'गुणा', '÷':'भाग' } : { '+':'plus', '-':'minus', '−':'minus', '×':'times', 'x':'times', '÷':'divided by' };
  let s = String(t).replace(/\s*=\s*\?\s*$/, '').trim();
  s = s.replace(/(\d)\s*([+\-−×x÷])\s*(?=\d)/g, (_, a, op) => `${a} ${W[op]} `);
  return s + (hi ? ' कितना?' : '?');
}

/* The screens' own words. Each intro is said once per arrival. A table, so
   tools/build-audio.mjs can put every one in the recorded pack. */
const VF_INTROS = {
  read:    { en:'The Reading Tree! Read the line out loud, then tap the microphone.', hi:'पढ़ने वाला पेड़! पंक्ति ज़ोर से पढ़ो, फिर माइक दबाओ।' },
  math:    { en:'Counting Stones!', hi:'गिनती के पत्थर!' },
  lessons: { en:'The Story Fire! Tap a story to learn.', hi:'कहानी की आग! सीखने के लिए कोई कहानी छुओ।' },
  games:   { en:'The Play Clearing! Pick a game.', hi:'खेल का मैदान! कोई खेल चुनो।' },
  theater: { en:'The Picture Hut! Tap a cartoon or a video to watch.', hi:'चित्र घर! देखने के लिए कोई कार्टून या वीडियो छुओ।' },
  ask:     { en:"Munni's Pond! Ask Munni anything you want to know.", hi:'मुन्नी का तालाब! जो जानना है, मुन्नी से पूछो।' },
  check:   { en:"Munni's Friday check! Three questions.", hi:'मुन्नी का शुक्रवार वाला खेल! तीन सवाल।' },
  pick:    { en:'Which game do you love most? Tap it.', hi:'तुम्हें कौन सा खेल सबसे अच्छा लगता है? उसे छुओ।' },
  trace:   { en:'Trace the letter with your finger, then tap Check.', hi:'उँगली से अक्षर बनाओ, फिर "जाँचो" दबाओ।' },
  dictate: { en:'Tap "Hear the line", then write it in your notebook.', hi:'"पंक्ति सुनो" दबाओ, फिर उसे अपनी कॉपी में लिखो।' },
  paper:   { en:'Copy the line into your notebook.', hi:'पंक्ति अपनी कॉपी में लिखो।' }
};
function vfIntro(screen){
  let k = screen;
  if(screen === 'write') k = S.ctx && S.ctx.mode;
  if(screen === 'lessons' && S.lesson) return '';
  if(screen === 'theater' && S.activeVideo) return '';
  const I = VF_INTROS[k];
  return I ? vfL(I.en, I.hi) : '';
}

/* What this screen asks, right now: {key, parts:[{text, el, lang, auto}]}.
   auto:false — the screen says this part itself; only 🔊 repeats it.
   all: the 🔊 button's readout — the intro too, even if already said. */
const VF_FEEDBACK = new Set(['math', 'askquiz']);   // screens that show a wrong answer's help without saying it
function vfReadout(all){
  const scr = document.getElementById('screen');
  if(!scr || VF_SKIP.has(S.screen) && !(S.screen === 'open' && scr.querySelector('.opts .opt'))) return null;
  const parts = [], keyBits = [S.screen];
  const intro = vfIntro(S.screen);
  if(intro && (all || !VF.intro[S.screen])) parts.push({ text: intro, intro: true });

  // the map: where Munni suggests going
  const munni = scr.querySelector('.jm-munni');
  if(S.screen === 'map' && munni){ parts.push({ text: munni.dataset.say, el: munni }); keyBits.push(munni.dataset.say); }

  // answered: only the help a screen shows silently, then nothing more to read
  const answered = scr.querySelector('.opts .right, .opts .wrong');
  if(answered){
    const fb = VF_FEEDBACK.has(S.screen) && vfText(scr.querySelector('.feedback'));
    if(fb && !all){ return { key: keyBits.concat('fb', fb).join('|'), parts: [{ text: fb }] }; }
    return all && parts.length ? { key: keyBits.join('|'), parts } : null;
  }

  // the question
  let lang = null, q = null, said = false;
  if(S.screen === 'lessons' && S.lesson){ lang = typeof lesLang === 'function' ? lesLang() : null; q = scr.querySelector('.lesq'); said = true; }
  else if(S.screen === 'theater' && S.activeVideo){ q = scr.querySelector('.video-q'); said = true; }
  else if(S.screen === 'math' || S.screen === 'check'){ const p = scr.querySelector(S.screen === 'math' ? '.problem' : '.display'); if(p) q = { text: vfMathWords(vfText(p)), el: p }; }
  else q = scr.querySelector({ askquiz: '.display', open: '.reveal h3' }[S.screen] || '.rn-prompt');
  if(q && q.nodeType) q = { text: vfText(q), el: q };
  if(q && q.text){ parts.push({ text: q.text, el: q.el, lang, auto: !said }); keyBits.push(q.text); }

  // the choices
  let opts = S.screen === 'games' ? [...scr.querySelectorAll('.shelfcard .sc-name')]
           : [...scr.querySelectorAll('.opts .opt, .opts .tw-opt, .rn-opt')].filter(b => vfText(b));
  if(opts.length > 6) opts = [];          // a menu of twenty is for looking at, not listening to
  const hiL = (lang || S.lang) === 'hi';
  opts.forEach((b, i) => {
    const t = vfText(b), last = i === opts.length - 1 && opts.length > 1 && S.screen !== 'games';
    parts.push({ text: last ? `${hiL ? 'या' : 'or'} ${t}?` : t, el: b.closest('button') || b, lang });
    keyBits.push(t);
  });

  if(!parts.length) return null;
  return { key: keyBits.join('|'), parts };
}

/* Wait until Munni has finished her own line (and a moment more, so a line
   a screen starts just after drawing gets to go first). Gives up waiting
   after 12 s: a voice that never ends must not keep the child unread to. */
function vfWhenFree(run){
  return new Promise(res => {
    const t0 = Date.now(); let quiet = 0;
    const tick = () => {
      if(run !== VF.run) return res(false);
      const busy = typeof speechBusy === 'function' && speechBusy();
      quiet = busy ? 0 : quiet + 1;
      if(quiet >= 3 || Date.now() - t0 > 12000) return res(true);
      setTimeout(tick, 200);
    };
    setTimeout(tick, 200);
  });
}

/* One line, lit up while she says it. Resolves true when said, false if
   something else spoke over it (the child tapped, the screen moved on). */
function vfSay(part, run){
  return new Promise(res => {
    if(run !== VF.run) return res(false);
    const el = part.el && part.el.isConnected ? part.el : null;
    if(el) el.classList.add('vf-now');
    VF.now = el;
    let done = false;
    const end = ok => { if(done) return; done = true; if(el) el.classList.remove('vf-now'); if(VF.now === el) VF.now = null; res(ok); };
    try{ speak(part.text, part.lang || null, () => end(true)); }catch(e){ return end(false); }
    const mine = typeof SPEECH_REQUEST !== 'undefined' ? SPEECH_REQUEST : null;
    // cut off: a newer line started, or the screen stopped speech
    const watch = () => { if(done) return; if(run !== VF.run || (mine != null && SPEECH_REQUEST !== mine)) return end(false); setTimeout(watch, 250); };
    setTimeout(watch, 250);
    setTimeout(() => end(true), 2500 + String(part.text).split(/\s+/).length * 700);   // never stall on a silent voice
  });
}

async function vfRead(ro, replay){
  const run = ++VF.run;
  if(!replay && !(await vfWhenFree(run))) return;
  for(const p of ro.parts){
    if(!replay && p.auto === false) continue;
    if(!(await vfSay(p, run))) return;
    if(p.intro) VF.intro[S.screen] = true;
  }
}

/* The 🔊 button: everything on this screen once more, the question included. */
function vfAgain(){
  const ro = vfReadout(true);
  if(ro) vfRead(ro, true);
}

function vfButton(show){
  let b = document.getElementById('vfagain');
  if(!show){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement('button'); b.id = 'vfagain'; b.className = 'vfagain'; b.onclick = vfAgain; b.textContent = '🔊'; document.body.appendChild(b); }
  b.setAttribute('aria-label', vfL('Hear it again', 'फिर से सुनो'));
}

function vfTick(){
  if(typeof S === 'undefined') return;
  if(S.ctx !== VF.ctx){ VF.ctx = S.ctx; VF.arrival++; VF.intro = {}; VF.key = null; VF.run++; }
  const talking = typeof talkLive === 'function' && talkLive();
  const on = voiceFirstOn() && !talking;
  vfButton(on && !!vfReadout(true));
  const ro = on ? vfReadout(false) : null;
  if(!ro || S.muted) return;
  const key = VF.arrival + '#' + ro.key;
  if(key === VF.key) return;
  VF.key = key;
  vfRead(ro, false);
}

(function(){
  function start(){
    const root = document.getElementById('screen');
    if(!root) return;
    let queued = false;
    new MutationObserver(() => {
      if(queued) return;
      queued = true;
      Promise.resolve().then(() => { queued = false; try{ vfTick(); }catch(e){} });
    }).observe(root, { childList: true, subtree: true, characterData: true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* ---------- the parent's switch ---------- */
function readAloudParentHTML(){
  const on = voiceFirstOn();
  return `
    <div class="metric">
      <div><b>${vfL('Munni reads aloud', 'मुन्नी पढ़कर सुनाए')}</b>
        <div style="font-size:12.5px;opacity:.65">${vfL(
          'Munni reads every question and each answer aloud, and says what to do on each screen — for a child who can\'t read yet. On by default up to Class 2.',
          'मुन्नी हर सवाल और हर जवाब पढ़कर सुनाती है, और हर स्क्रीन पर बताती है कि क्या करना है — उस बच्चे के लिए जो अभी पढ़ नहीं पाता। कक्षा 2 तक अपने आप चालू।')}</div></div>
      <button class="toggle ${on ? 'on' : ''}" onclick="toggleReadAloud()" aria-label="${vfL('Munni reads aloud', 'मुन्नी पढ़कर सुनाए')}"><span></span></button>
    </div>`;
}
function toggleReadAloud(){
  S.readAloud = voiceFirstOn() ? 'off' : 'on';
  log(0, `Parent · Munni reads aloud ${S.readAloud}`);
  saveSoon();
  render();
}
