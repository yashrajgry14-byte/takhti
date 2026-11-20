/* ==================================================================
   ONBOARDING, WITHOUT A KEYBOARD

   The old first screen was a text field and a Start button. That is a
   form, and a five-year-old cannot fill in a form — many of them are
   here precisely BECAUSE they cannot yet write their own name.

   So nobody types anything:

     who are you   → Munni asks the child's name (a grown-up types it); then tap an animal friend. With
                     no name given, the animal's name stands in, so a
                     child who cannot spell still gets called something.
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

/* ---------------- step 1: your name, then your animal friend ----------------
   Munni asks the child's own name, which a grown-up types (no microphone:
   a name is personal, and the browser's recognizer would send the voice
   off the phone). The name stays on this phone. A child who can't type yet, with no grown-up near,
   just taps an animal: the animal's name stands in until a parent sets the
   real one on the parent page. */
const AV_BG = ['#FFB547','#5BC0EB','#B39DDB','#7ED957','#FF8FAB','#FFD166','#4DD0C4','#F4A261','#9AD0EC'];
function obWhoHTML(){
  const hi = S.lang === 'hi';
  const typed = (S.ob && S.ob.name) || '';
  const greet = typed ? (hi ? `नमस्ते ${obEsc(typed)}! अब अपना जानवर दोस्त चुनो` : `Hi ${obEsc(typed)}! Now pick your animal friend`)
                      : (hi ? 'नमस्ते! तुम्हारा नाम क्या है?' : 'Hello! What is your name?');
  return `
  <div class="ob ob-who">
    <div class="ob-munni bob">${typeof munniSmall === 'function' ? munniSmall() : '🐘'}</div>
    <div class="ob-bubble" id="obGreet">${greet}</div>
    <div class="ob-namebox">
      <input class="input ob-name" id="obName" maxlength="24" autocomplete="off" autocapitalize="words"
             value="${obEsc(typed)}" placeholder="${hi ? 'अपना नाम लिखो' : 'Type your name'}"
             oninput="obNameTyped(this.value)" onkeydown="if(event.key==='Enter'){this.blur()}">
    </div>
    <div class="ob-sub">${hi ? 'अपना जानवर दोस्त चुनो 👇' : 'Pick your animal friend 👇'}</div>
    <div class="ob-avatars">
      ${AVATARS.map((a,i)=>`
        <button class="ob-av" style="animation-delay:${i*0.05}s;--avbg:${AV_BG[i % AV_BG.length]}" onclick="obPickAvatar('${a.id}')">
          <span class="ob-ic">${a.ic}</span>
          <span class="ob-nm">${hi ? a.hi : a.en}</span>
        </button>`).join('')}
    </div>
    <div class="langpick" style="margin-top:10px">
      <button class="${S.lang==='en'?'sel':''}" onclick="obKeepName();S.lang='en';render()">English</button>
      <button class="${S.lang==='hi'?'sel':''}" onclick="obKeepName();S.lang='hi';render()">हिंदी</button>
    </div>
  </div>`;
}
function obEsc(v){ return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* a name is letters (any script), spaces, dots and hyphens — nothing else is kept */
function obCleanName(v){ return String(v || '').replace(/[^\p{L}\p{M}\s.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
function obKeepName(){ const el = $('obName'); if(el){ S.ob = S.ob || { step:'who' }; S.ob.name = obCleanName(el.value); } }
function obNameTyped(v){
  S.ob = S.ob || { step:'who' }; S.ob.name = obCleanName(v);
  const g = $('obGreet'), hi = S.lang === 'hi', n = S.ob.name;
  if(g) g.textContent = n ? (hi ? `नमस्ते ${n}! अब अपना जानवर दोस्त चुनो` : `Hi ${n}! Now pick your animal friend`)
                          : (hi ? 'नमस्ते! तुम्हारा नाम क्या है?' : 'Hello! What is your name?');
}
function obPickAvatar(id){
  const a = avatarById(id);
  obKeepName();
  const own = S.ob && S.ob.name;
  const name = own || (S.lang === 'hi' ? a.hi : a.en);
  // The avatar tap IS the profile creation moment for a brand-new device
  // — nothing upstream of this (arrival) ever calls createProfile(), so
  // if this were skipped, S.avatar/S.name would sit on the un-persisted
  // bootstrap S with no S.profiles entry behind them, and vanish on the
  // next load(). An EXISTING profile re-picking (e.g. one that predates
  // avatars) just updates in place instead of creating a duplicate.
  // Adding a sibling (addChild()) always creates a new profile too, rather
  // than renaming whoever was active.
  if(S._addingChild || S.activeProfile == null || !S.profiles[S.activeProfile]){
    S.ob = null;              // don't leave the outgoing sibling's own profile marked mid-onboarding
    S._addingChild = false;
    createProfile(name);
  }else{
    S.name = name;
  }
  S.avatar = id;
  if(typeof trumpet === 'function') trumpet(1);
  S.ob = { step:'age' };
  log(null, own ? 'Child gave a name and chose an avatar · the name stays on this phone'
                : 'Child chose an avatar · no name given, the animal\'s name stands in');
  saveSoon();
  render();
  speak(S.lang === 'hi' ? (own ? `${own}, तुमने ${a.hi} चुना! बहुत अच्छा।` : `${a.hi}! अच्छा चुना।`)
                        : (own ? `${own}, you picked the ${a.en}! Lovely.` : `${a.en}! Good choice.`));
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
      </div>
      <div class="ob-older">
        <span class="ob-sub" style="margin:0">${hi ? 'और बड़े?' : 'Older?'}</span>
        ${[11,12,13,14,15,16].map(n => `<button class="ob-agechip" onclick="obPickAge(${n})">${n}</button>`).join('')}
      </div>`}
  </div>`;
}
/* A cake with n lit candles. The child counts them — which is genuinely
   the first thing we teach, happening before they are even inside. */
function obCake(n){
  return `<span class="cake">
    <span class="candles">${[...Array(Math.min(n, 10))].map((_,i)=>
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
  if(S.clsBy === 'school') return obFinishClass();   // the school already said which class (core/class-sync.js)
  // next: the class — what is taught follows the class, not the age
  S.ob = { step:'cls', cls: S.cls || clsForAge(S.age) };
  if(typeof saveSoon === 'function') saveSoon();
  render();
  speak(S.lang === 'hi' ? 'तुम किस कक्षा में हो?' : 'Which class are you in?');
}

/* ---------------- step 3: which class ----------------
   The class decides what Takhti teaches (content/ages.js CLASSES), so it
   matches the child's school book. The usual class for their age is
   already picked; a child (or the grown-up beside them) changes it with
   one tap. A parent or the school can change it later too. */
function obClassHTML(){
  const hi = S.lang === 'hi';
  const sel = (S.ob && S.ob.cls) || clsForAge(S.age);
  const k = classById(sel);
  return `
  <div class="ob">
    <div class="ob-munni bob">${typeof munniSmall === 'function' ? munniSmall() : '🐘'}</div>
    <div class="ob-bubble">${hi ? `तुम किस कक्षा में हो? <b>${k.hi}</b>?` : `Which class are you in? <b>${k.en}</b>?`}</div>
    <div class="ob-classes">
      ${CLASSES.map((c,i) => `
        <button class="ob-clsbtn ${c.id === sel ? 'sel' : ''}" style="animation-delay:${i*0.04}s" onclick="obPickClass('${c.id}')">${hi ? c.hi : c.en}</button>`).join('')}
    </div>
    <div class="ob-sub">${hi ? 'पक्का न हो तो किसी बड़े से पूछो' : 'Not sure? Ask a grown-up'}</div>
    <button class="btn ob-go" onclick="obFinishClass()">${hi ? 'चलो! →' : 'Let us go! →'}</button>
  </div>`;
}
function obPickClass(id){
  if(!classById(id)) return;
  S.ob = { step:'cls', cls:id };
  if(typeof trumpet === 'function') trumpet(1);
  render();
  const k = classById(id);
  speak(S.lang === 'hi' ? k.hi : k.en);
}
function obFinishClass(){
  if(S.clsBy !== 'school') S.cls = (S.ob && S.ob.cls) || clsForAge(S.age);
  // seed each module at the right rung for this class
  if(typeof band === 'function'){
    const b = band();
    for(const m of ['read','write','math'])
      if(b.start && b.start[m]) S.levels[m] = b.start[m];
  }
  S.ob = null;
  log(0, `Age ${S.age} · ${classById(S.cls).en} · levels seeded from the ${band ? band().id : 'default'} band (${band().stage})`);
  // the grown-ups' steps (only in a build with a voice server): the reading terms, then the learning circle
  if(typeof voiceTermsWanted === 'function' && voiceTermsWanted()){ S.ob = { step:'terms' }; if(typeof saveSoon === 'function') saveSoon(); return render(); }
  if(typeof circleOnboardWanted === 'function' && circleOnboardWanted()){ S.ob = { step:'grownup' }; if(typeof saveSoon === 'function') saveSoon(); return render(); }
  if(typeof saveSoon === 'function') saveSoon();
  if(S.game) goHub(); else go('pick');
}

/* ---------------- the router ---------------- */
function onboardHTML(){
  const st = S.ob || (S.ob = { step: S.avatar && !S._addingChild ? 'age' : 'who' });
  if(st.step === 'terms' && typeof voiceTermsHTML === 'function') return voiceTermsHTML();
  if(st.step === 'grownup' && typeof circleOnboardHTML === 'function') return circleOnboardHTML();
  if(st.step === 'cls') return obClassHTML();
  return st.step === 'age' ? obAgeHTML() : obWhoHTML();
}

/* A sibling joins the same way the first child did — tap an animal, count
   the candles — starting a fresh profile. Reached from the profile
   switcher on the jungle map. */
function addChild(){
  if(S.profiles.length >= MAX_PROFILES) return;
  S._addingChild = true;
  S.ob = null;
  go('onboard');
}

if(typeof VIEWS !== 'undefined') VIEWS.onboard = onboardHTML;
