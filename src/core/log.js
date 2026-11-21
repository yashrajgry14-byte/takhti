/* ---------------- trace log (judge panel) ---------------- */
/* The judge panel beside the phone (index.html .side: the tiers and this
   trace) is hidden on the live link (21 Nov 2026) — on a phone and on the
   web. Add ?judge to the address to show it, for a demo that points at the
   trace. The trace is still written either way. */
try{ if(/[?&]judge(=|&|$)/.test(location.search)) document.documentElement.classList.add('show-judge'); }catch(e){}
function log(tier, msg){
  const el = document.getElementById('log');
  const d = document.createElement('div');
  const cls = tier===null ? 'sys' : 't'+tier;
  d.className = cls;
  d.textContent = (tier===null? '· ' : 'T'+tier+' · ') + msg;
  el.appendChild(d); el.scrollTop = el.scrollHeight;
  if(tier!==null){
    const box = document.getElementById('tier'+tier);
    box.classList.add('hot');
    setTimeout(()=>box.classList.remove('hot'), 1400);
  }
}
