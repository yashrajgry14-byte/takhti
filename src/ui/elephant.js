/* ==================================================================
   MUNNI — the baby elephant on the Ask page.

   She is a state machine with four moods, driven by the question flow:

     idle    trunk curled, "ASK ME" on the sign, ears flapping.
             Tapping her makes her trumpet and nod.
     praise  question received: trunk shoots up, she trumpets, a
             bubble says what a good question it is.
     search  she walks off across the screen looking for the answer,
             kicking up dust, bubble counts her progress.
     found   she stops, trumpets twice, and the answer appears.

   No image assets: SVG for the elephant, Web Audio for the trumpet.
   Both work with no network, which is the point.
   ================================================================== */

const ELEPH_LINES = {
  praise: {
    en: ['Ooh, good question!', 'I like that one!', 'Clever! Let me look…', 'Nobody asked me that before!'],
    hi: ['वाह, बढ़िया सवाल!', 'यह तो मज़ेदार है!', 'होशियार! ढूँढती हूँ…', 'यह किसी ने नहीं पूछा था!']
  },
  search: {
    en: ['Looking…', 'Behind the trees…', 'Asking the birds…', 'Nearly there…'],
    hi: ['ढूँढ रही हूँ…', 'पेड़ों के पीछे…', 'चिड़ियों से पूछती हूँ…', 'बस पहुँची…']
  },
  found: { en: ['Found it!', 'Here it is!'], hi: ['मिल गया!', 'यह रहा!'] },
  saved: {
    en: ['I will keep it safe until we get signal.'],
    hi: ['सिग्नल आने तक सँभालकर रखूँगी।']
  }
};
const pickLine = (kind) => {
  const a = ELEPH_LINES[kind][S.lang] || ELEPH_LINES[kind].en;
  return a[Math.floor(Math.random() * a.length)];
};

/* --- a trunk toot, synthesised. No audio file, no network. --- */
function trumpet(times = 1) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    S._ac = S._ac || new AC();
    const ac = S._ac;
    if (ac.state === 'suspended') ac.resume();
    for (let n = 0; n < times; n++) {
      const t0 = ac.currentTime + n * 0.34;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      // a rising then falling pitch reads as a small animal, not an alarm
      osc.frequency.setValueAtTime(300, t0);
      osc.frequency.exponentialRampToValueAtTime(680, t0 + 0.11);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.28);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0); osc.stop(t0 + 0.32);
    }
  } catch (e) { /* audio is a bonus, never a dependency */ }
}

/* --- mood --- */
function setEleph(mood, line) {
  S.eleph = { mood, line: line || '' };
  const host = document.getElementById('elephhost');
  if (host) host.outerHTML = elephantHTML();   // swap in place; no full re-render
}

function tapEleph() {
  if (S.eleph && S.eleph.mood !== 'idle') return;
  trumpet(1);
  setEleph('idle', S.lang === 'hi' ? 'मुझसे कुछ भी पूछो!' : 'Ask me anything!');
  const el = document.querySelector('.eleph');
  if (el) { el.classList.add('nod'); setTimeout(() => el.classList.remove('nod'), 900); }
  setTimeout(() => setEleph('idle', ''), 2600);
}

/* --- the sequence the Ask flow drives --- */
function elephAsk(question, resolve, onSettled) {
  // 1. she is delighted
  setEleph('praise', pickLine('praise'));
  trumpet(1);

  // 2. she walks off to look, narrating as she goes
  setTimeout(() => {
    setEleph('search', pickLine('search'));
    let step = 1;
    clearInterval(S._elephTimer);
    S._elephTimer = setInterval(() => {
      if (!S.eleph || S.eleph.mood !== 'search') return clearInterval(S._elephTimer);
      setEleph('search', pickLine('search'));
      if (++step > 6) clearInterval(S._elephTimer);
    }, 1700);

    // 3. resolve() does the real work — local pack, cloud, or queue.
    //    Minimum walk time so the animation reads; the answer waits for her.
    const started = Date.now();
    Promise.resolve(resolve()).then((outcome) => {
      const wait = Math.max(0, 1900 - (Date.now() - started));
      setTimeout(() => {
        clearInterval(S._elephTimer);
        if (outcome === 'queued') {
          setEleph('found', pickLine('saved'));
          trumpet(1);
        } else {
          setEleph('found', pickLine('found'));
          trumpet(2);
        }
        setTimeout(() => { S.eleph = null; render(); if(onSettled) onSettled(outcome); }, 900);
      }, wait);
    });
  }, 1100);
}

/* --- the drawing --- */
function elephantHTML() {
  const st = S.eleph || { mood: 'idle', line: '' };
  const sign = S.lang === 'hi' ? 'पूछो' : 'ASK ME';
  return `
  <div id="elephhost" class="elephhost">
    ${st.line ? `<div class="elephbubble">${st.line}</div>` : ''}
    <div class="eleph is-${st.mood}" onclick="tapEleph()" role="img"
         aria-label="${S.lang==='hi'?'मुन्नी हाथी':'Munni the elephant'}">
      <svg viewBox="0 0 220 150">
        <!-- dust she kicks up while walking -->
        <g class="el-dust">
          <circle cx="42" cy="126" r="6"/><circle cx="28" cy="120" r="4"/><circle cx="52" cy="118" r="3"/>
        </g>

        <g class="el-body">
          <!-- tail -->
          <path class="el-line" d="M62 92c-9 2-12 9-9 16"/>
          <!-- legs -->
          <g class="el-legs">
            <rect class="el-fill" x="72"  y="98" width="18" height="30" rx="8"/>
            <rect class="el-fill" x="96"  y="98" width="18" height="30" rx="8"/>
            <rect class="el-fill" x="120" y="98" width="18" height="30" rx="8"/>
            <rect class="el-fill" x="144" y="98" width="18" height="30" rx="8"/>
          </g>
          <!-- body -->
          <ellipse class="el-fill" cx="112" cy="80" rx="52" ry="34"/>
          <!-- head -->
          <circle class="el-fill" cx="164" cy="66" r="30"/>
          <!-- ear -->
          <ellipse class="el-ear el-fill2" cx="152" cy="60" rx="19" ry="22"/>
          <!-- eye -->
          <circle class="el-eye" cx="176" cy="58" r="3.4"/>
          <!-- tusk -->
          <path class="el-tusk" d="M180 78c5 2 8 5 9 9"/>
          <!-- trunk: rotates from its base at the head -->
          <g class="el-trunk">
            <path class="el-trunkline" d="M172 82c6 12 3 24-6 30s-8 14-2 18"/>
            <g class="el-sign">
              <rect x="140" y="122" width="52" height="19" rx="6"/>
              <text x="166" y="135" text-anchor="middle">${sign}</text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  </div>`;
}
