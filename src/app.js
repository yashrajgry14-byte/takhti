/* ---- boot ---- */
$('nettoggle').onclick = ()=> setOnline(!S.online);
$('langbtn').onclick = ()=>{ S.lang = S.lang==='en'?'hi':'en'; S.ctx={}; log(null,'Language switched to '+(S.lang==='hi'?'Hindi':'English')); render(); };
log(null,'Takhti started · no network required');
log(0,'Content pack loaded from device storage');
setOnline(false);
render();
