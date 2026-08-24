/* ==================================================================
   THE DAILY VARIETY ENGINE  ("what does Aayush get today?")
   Seven formats drawn as a shuffled bag: each appears exactly once
   per week, so no two days in a row are ever the same shape.
   The ORDER is adaptive — weighted by what the child is weakest at.
   Seeded by (child + week) so reopening the app cannot reroll today.
   Runs entirely on-device. Tier 2 only swaps in fresher content.
   ================================================================== */
const FORMATS = [
  {id:'fact',      ic:'💡', en:'Did you know',     hi:'क्या पता था'},
  {id:'quiz',      ic:'❓', en:'Question',         hi:'सवाल'},
  {id:'anim',      ic:'🎬', en:'Watch',            hi:'देखो'},
  {id:'world',     ic:'🌍', en:'Around the world', hi:'दुनिया भर से'},
  {id:'word',      ic:'🔤', en:'New word',         hi:'नया शब्द'},
  {id:'story',     ic:'📖', en:'Story',            hi:'कहानी'},
  {id:'challenge', ic:'🎯', en:'Challenge',        hi:'चुनौती'}
];
const DAYNAMES = { en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], hi:['सोम','मंगल','बुध','गुरु','शुक्र','शनि','रवि'] };

/* deterministic RNG so the same child + same week = the same plan */
function seedOf(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619);} return h>>>0; }
function rng(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0;
  let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }
function weekKey(){ return new Date().getFullYear()+'-W'+Math.floor((Date.now()/864e5 + 4)/7); }

/* weighted draw WITHOUT replacement: every format lands once a week,
   but the ones this child needs most land earliest */
function weekPlan(){
  const acc = m => S.attempts[m] ? S.correct[m]/S.attempts[m] : 0.7;
  const w = { fact:1.0, quiz:1.0, anim:1.3, world:0.9, word:1.0, story:1.0, challenge:1.1 };
  if(acc('read') < 0.7){ w.word += 0.9; w.story += 0.7; }
  if(acc('math') < 0.7){ w.quiz += 0.8; w.challenge += 0.9; }
  if(S.attempts.write < 3) w.anim += 0.4;
  const r = rng(seedOf((S.name||'x') + '|' + weekKey()));
  const pool = FORMATS.map(f=>({...f, w:w[f.id]}));
  const out = [];
  while(pool.length){
    const total = pool.reduce((a,p)=>a+p.w,0);
    let x = r()*total, i=0;
    while(x > pool[i].w && i < pool.length-1){ x -= pool[i].w; i++; }
    out.push(pool.splice(i,1)[0]);
  }
  return out;
}
function todayFormat(){ return weekPlan()[S.day % 7]; }

/* ---- content pools (ship on-device; Tier 2 refreshes them) ---- */
const WORLD = [
  {ic:'🐘', en:'An elephant can hear another elephant calling from 6 kilometres away.', hi:'हाथी 6 किलोमीटर दूर से दूसरे हाथी की आवाज़ सुन लेता है।'},
  {ic:'🐧', en:'Penguins cannot fly, but they swim so fast it looks like flying underwater.', hi:'पेंगुइन उड़ नहीं सकते, पर इतनी तेज़ तैरते हैं कि लगे पानी में उड़ रहे हैं।'},
  {ic:'🌏', en:'India moves about 5 centimetres north every year — the whole country, slowly!', hi:'भारत हर साल लगभग 5 सेंटीमीटर उत्तर खिसकता है — पूरा देश, धीरे-धीरे!'},
  {ic:'🐝', en:'A bee visits around 2,000 flowers in one day to make a little honey.', hi:'एक मधुमक्खी दिन में लगभग 2,000 फूलों पर जाती है, तब थोड़ा शहद बनता है।'},
  {ic:'🌙', en:'The Moon has no wind, so footprints left there stay for millions of years.', hi:'चाँद पर हवा नहीं है, इसलिए वहाँ के पैरों के निशान लाखों साल रहते हैं।'},
  {ic:'🦒', en:'A giraffe has the same number of neck bones as you do — just seven!', hi:'जिराफ़ की गर्दन में उतनी ही हड्डियाँ हैं जितनी तुम्हारी — सिर्फ़ सात!'},
  {ic:'🌧️', en:'Cherrapunji in Meghalaya is one of the rainiest places on the whole planet.', hi:'मेघालय का चेरापूंजी धरती की सबसे ज़्यादा बारिश वाली जगहों में से एक है।'},
  {ic:'🐜', en:'Ants can lift things fifty times heavier than themselves.', hi:'चींटी अपने से पचास गुना भारी चीज़ उठा सकती है।'}
];
const WORDS = [
  {w:'curious', hi:'जिज्ञासु', m:{en:'Wanting to find out more. You are curious right now!', hi:'और जानने की चाह। तुम अभी जिज्ञासु हो!'}},
  {w:'brave',   hi:'बहादुर',  m:{en:'Doing a hard thing even when it feels scary.', hi:'डर लगने पर भी मुश्किल काम कर जाना।'}},
  {w:'gentle',  hi:'कोमल',    m:{en:'Soft and careful, the way you hold a baby bird.', hi:'नरम और सँभालकर, जैसे चिड़िया के बच्चे को पकड़ते हैं।'}},
  {w:'patient', hi:'धैर्यवान', m:{en:'Able to wait calmly without getting cross.', hi:'बिना चिढ़े शांति से इंतज़ार कर पाना।'}},
  {w:'clever',  hi:'चतुर',    m:{en:'Quick at working things out.', hi:'चीज़ें जल्दी समझ लेने वाला।'}},
  {w:'kind',    hi:'दयालु',   m:{en:'Caring about how someone else feels.', hi:'दूसरों की भावनाओं का ध्यान रखना।'}},
  {w:'sturdy',  hi:'मज़बूत',  m:{en:'Strong and steady, not easy to knock over.', hi:'मज़बूत और टिकाऊ, आसानी से न गिरने वाला।'}},
  {w:'joyful',  hi:'आनंदित',  m:{en:'So happy it shows on your face.', hi:'इतना खुश कि चेहरे पर दिख जाए।'}}
];
