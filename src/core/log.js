/* ---------------- trace log (judge panel) ---------------- */
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
