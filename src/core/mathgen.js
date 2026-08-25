/* ---------------- math generator (Tier 0) ---------------- */
function genProblem(lvl){
  const r=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
  let a,b,op,ans;
  if(lvl===1){ a=r(1,4); b=r(1,4); op='+'; }
  else if(lvl===2){ a=r(2,7); b=r(1,6); op='+'; }
  else if(lvl===3){ a=r(4,9); b=r(1,4); op='−'; }
  else if(lvl===4){ a=r(12,38); b=r(6,29); op='+'; }
  else if(lvl===5){ a=r(22,60); b=r(8,19); op='−'; }
  else { a=r(2,9); b=r(2,9); op='×'; }

  // age ceiling: never hand a child a number bigger than their band allows
  const cap = band().maxNumber;
  a = Math.min(a, cap); b = Math.min(b, cap);
  if(op==='−' && a<b) [a,b] = [b,a];   // keep subtraction non-negative after capping

  ans = op==='+'? a+b : op==='−'? a-b : a*b;
  const set = new Set([ans]);
  while(set.size<4){ const d=ans + (Math.random()<.5?-1:1)*r(1,Math.max(2,Math.round(ans*.3))); if(d>=0) set.add(d); }
  return { a,b,op,ans, opts:[...set].sort(()=>Math.random()-.5) };
}
