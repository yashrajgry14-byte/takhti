/* ---- boot ---- */
/* The live link (https) is always online: no signal switch and no airplane
   pill — the phone's own connection decides, quietly. A local copy (http,
   npm run dev, the tests) keeps the switch, to show what works with none. */
const LIVE_LINK = typeof location !== 'undefined' && location.protocol === 'https:';
if(LIVE_LINK) document.documentElement.classList.add('live');
$('nettoggle').onclick = ()=> setOnline(!S.online);
/* the language switch: both languages on it, the one in use marked */
function langBtnLabel(){
  const b = $('langbtn'); if(!b) return;
  b.innerHTML = `<span class="${S.lang==='en'?'on':''}">English</span><span class="${S.lang==='hi'?'on':''}">हिंदी</span>`;
  b.setAttribute('aria-label', S.lang==='hi' ? 'Switch to English' : 'हिंदी में बदलें');
}
$('langbtn').onclick = ()=>{ S.lang = S.lang==='en'?'hi':'en'; S.ctx={}; log(null,'Language switched to '+(S.lang==='hi'?'Hindi':'English')); langBtnLabel(); render(); };
log(null,'Takhti started · no network required');
log(0,'Content pack loaded from device storage');
load();
// Arrival (ui/arrival.js) is the first thing every session sees, new
// device or returning one — it is also where the browser gets its first
// real user gesture, which the rest of the app's audio depends on.
// arrFinish() routes onward: onboarding, the game picker, or goHub().
// ?role=teacher provides an independent teacher entry point without a parent PIN.
// Server-approved teacher identity is still mandatory before any class data.
S.screen = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('role') === 'teacher') ? 'teacher' : 'arrival';
setOnline(LIVE_LINK ? navigator.onLine !== false : false);
if(LIVE_LINK){ addEventListener('online', () => setOnline(true)); addEventListener('offline', () => setOnline(false)); }
langBtnLabel();
render();
// Find out (and, while online, fetch) what on-device speech this phone
// has, so a reading attempt later today can be graded with no signal.
prepareOfflineSpeech();
// Keep each class this phone takes part in in sync — hourly, on reconnect,
// and on "Sync now" (core/class-sync.js). Only children a parent opted in.
startClassSync();
