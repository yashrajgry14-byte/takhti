/* ==================================================================
   ONBOARDING, WITHOUT A KEYBOARD

   The old first screen was a text field and a Start button. That is a
   form, and a five-year-old cannot fill in a form — many of them are
   here precisely BECAUSE they cannot yet write their own name.

   So nobody types anything:

     who are you   → tap an animal. It carries a name already, so a
                     child who cannot spell still gets called something,
                     and it is the same animal every day after.
     how old       → tap the cake with your number of candles. Counting
                     the candles is the first thing the app ever teaches.
     Munni dances  → and says the age back, so the child hears that they
                     were understood.

   A parent can set the real name later in the dashboard. The child
   never needs to.
   ================================================================== */

const AVATARS = [
  { id:'tiger',    ic:'🐯', en:'Tiger',     hi:'बाघ' },
  { id:'peacock',  ic:'🦚', en:'Peacock',   hi:'मोर' },
  { id:'elephant', ic:'🐘', en:'Elephant',  hi:'हाथी' },
  { id:'parrot',   ic:'🦜', en:'Parrot',    hi:'तोता' },
  { id:'squirrel', ic:'🐿️', en:'Squirrel',  hi:'गिलहरी' },
  { id:'butterfly',ic:'🦋', en:'Butterfly', hi:'तितली' },
  { id:'turtle',   ic:'🐢', en:'Turtle',    hi:'कछुआ' },
  { id:'owl',      ic:'🦉', en:'Owl',       hi:'उल्लू' },
  { id:'monkey',   ic:'🐒', en:'Monkey',    hi:'बंदर' }
];
const avatarById = id => AVATARS.find(a => a.id === id) || AVATARS[0];

/* ---------------- step 1: who are you ---------------- */
function obWhoHTML(){
  const hi = S.lang === 'hi';
  return `
  <div class="ob">
    <div class="ob-munni">${typeof munniSmall === 'function' ? munniSmall() : '🐘'}</div>
    <div class="ob-bubble">${hi ? 'तुम कौन हो? एक चुनो!' : 'Who are you? Pick one!'}</div>
    <div class="ob-avatars">
      ${AVATARS.map((a,i)=>`
        <button class="ob-av" style="animation-delay:${i*0.05}s" onclick="obPickAvatar('${a.id}')">
          <span class="ob-ic">${a.ic}</span>
          <span class="ob-nm">${hi ? a.hi : a.en}</span>
        </button>`).join('')}
    </div>
    <div class="langpick" style="margin-top:6px">
      <button class="${S.lang==='en'?'sel':''}" onclick="S.lang='en';render()">English</button>
      <button class="${S.lang==='hi'?'sel':''}" onclick="S.lang='hi';render()">हिंदी</button>
    </div>
  </div>`;
}
function obPickAvatar(id){
  const a = avatarById(id);
  const name = S.lang === 'hi' ? a.hi : a.en;
  // The avatar tap IS the profile creation moment for a brand-new device
  // — nothing upstream of this (arrival) ever calls createProfile(), so
  // if this were skipped, S.avatar/S.name would sit on the un-persisted
  // bootstrap S with no S.profiles entry behind them, and vanish on the
  // next load(). An EXISTING profile re-picking (e.g. one that predates
  // avatars) just updates in place instead of creating a duplicate.
  if(S.activeProfile == null || !S.profiles[S.activeProfile]){
    createProfile(name);
  }else{
    S.name = name;
  }
  S.avatar = id;
  if(typeof trumpet === 'function') trumpet(1);
  S.ob = { step:'age' };
  log(null, 'Child chose an avatar · no name typed, nothing personal stored');
  saveSoon();
  render();
  speak(S.lang === 'hi' ? `${a.hi}! अच्छा चुना।` : `${a.en}! Good choice.`);
}

/* ---------------- step 2: how old, in candles ---------------- */
function obAgeHTML(){
  const hi = S.lang === 'hi';
  const picked = S.ob && S.ob.age;
  return `
  <div class="ob">
    <div class="ob-munni ${picked ? 'dance' : ''}">${typeof munniSmall === 'function' ? munniSmall() : '🐘'}</div>
    <div class="ob-bubble">${picked
      ? (hi ? `${picked} साल! बहुत बढ़िया।` : `${picked} years old! Wonderful.`)
      : (hi ? 'कितने साल के हो? मोमबत्तियाँ गिनो!' : 'How old are you? Count the candles!')}</div>

    ${picked ? `
      <div class="ob-cake big">${obCake(picked)}</div>
      <button class="btn ob-go" onclick="obFinishAge()">${hi ? 'चलो! →' : 'Let us go! →'}</button>
    ` : `
      <div class="ob-cakes">
        ${[3,4,5,6,7,8,9,10].map((n,i)=>`
          <button class="ob-cakebtn" style="animation-delay:${i*0.06}s" onclick="obPickAge(${n})">
            ${obCake(n)}
            <span class="ob-num">${n}</span>
          </button>`).join('')}
      </div>`}
  </div>`;
}
/* A cake with n lit candles. The child counts them — which is genuinely
   the first thing we teach, happening before they are even inside. */
function obCake(n){
  return `<span class="cake">
    <span class="candles">${[...Array(n)].map((_,i)=>
      `<i style="animation-delay:${(i%5)*0.18}s"></i>`).join('')}</span>
    <span class="cake-top"></span><span class="cake-body"></span>
  </span>`;
}
function obPickAge(n){
  S.ob = { step:'age', age:n };
  S.age = n;
  if(typeof trumpet === 'function') trumpet(2);
  render();
  speak(S.lang === 'hi' ? `${n} साल!` : `${n} years old!`);
}
function obFinishAge(){
  // seed each module at the right rung for this age
  if(typeof band === 'function'){
    const b = band();
    for(const m of ['read','write','math'])
      if(b.start && b.start[m]) S.levels[m] = b.start[m];
  }
  S.ob = null;
  log(0, `Age ${S.age} · levels seeded from the ${band ? band().id : 'default'} band`);
  if(typeof saveSoon === 'function') saveSoon();
  go(S.game ? 'map' : 'pick');
}

/* ---------------- the router ---------------- */
function onboardHTML(){
  const st = S.ob || (S.ob = { step: S.avatar ? 'age' : 'who' });
  return st.step === 'age' ? obAgeHTML() : obWhoHTML();
}

if(typeof VIEWS !== 'undefined') VIEWS.onboard = onboardHTML;
