/* ---- boot ---- */
$('nettoggle').onclick = ()=> setOnline(!S.online);
$('langbtn').onclick = ()=>{ S.lang = S.lang==='en'?'hi':'en'; S.ctx={}; log(null,'Language switched to '+(S.lang==='hi'?'Hindi':'English')); render(); };
log(null,'Takhti started · no network required');
log(0,'Content pack loaded from device storage');
load();
// Arrival (ui/arrival.js) is the first thing every session sees, new
// device or returning one — it is also where the browser gets its
// first real user gesture, which the rest of the app's audio depends
// on. arrFinish() routes onward exactly where this block used to send
// an existing profile directly: age() if never asked, home() if it
// was, or greet() for a brand-new device.
S.screen = 'arrival';
setOnline(false);
render();
