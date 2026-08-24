/* --- grapheme clustering: "की" is क + ी, one letter, two codepoints --- */
const SEG = (typeof Intl!=='undefined' && Intl.Segmenter)
  ? new Intl.Segmenter('hi',{granularity:'grapheme'}) : null;
function graphemes(s){
  if(SEG) return [...SEG.segment(s)].map(x=>x.segment);
  // fallback: attach combining marks (matras, halant, nukta) to the base letter
  const out=[];
  for(const ch of s){
    const c=ch.codePointAt(0);
    const combining = (c>=0x093A&&c<=0x094F)||(c>=0x0951&&c<=0x0957)||(c>=0x0962&&c<=0x0963)||c===0x093C;
    if(combining && out.length) out[out.length-1]+=ch; else out.push(ch);
  }
  return out;
}

/* --- stage 2a: strict normalize (a match here is genuinely correct) --- */
const DEV_DIGITS = {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'};
function normWord(w, lang){
  w = (w||'').normalize('NFC')
       .replace(/[.,!?;:"'“”‘’()\[\]।॥…\-–—]/g,'')
       .replace(/[०-९]/g, d=>DEV_DIGITS[d])
       .trim();
  return lang==='hi' ? w : w.toLowerCase();
}

/* --- stage 2b: soft fold (a match ONLY here = "near", not wrong) ---
   Folds the differences a child and a recognizer both routinely produce. */
const NUKTA = {'क़':'क','ख़':'ख','ग़':'ग','ज़':'ज','ड़':'ड','ढ़':'ढ','फ़':'फ','य़':'य'};
function foldWord(w, lang){
  w = normWord(w, lang);
  if(lang!=='hi'){
    return w.replace(/[^a-z0-9]/g,'')
            .replace(/(.)\1+/g,'$1')      // running --> runing
            .replace(/ph/g,'f').replace(/ck/g,'k').replace(/qu/g,'kw');
  }
  w = w.normalize('NFD').replace(/\u093C/g,'').normalize('NFC');  // drop nukta
  for(const k in NUKTA) w = w.split(k).join(NUKTA[k]);
  return w
    .replace(/[\u0902\u0903\u0901]/g,'')   // anusvara / visarga / chandrabindu
    .replace(/\u0940/g,'\u093F')           // ी → ि   long/short i
    .replace(/\u0942/g,'\u0941')           // ू → ु   long/short u
    .replace(/\u0948/g,'\u0947')           // ै → े
    .replace(/\u094C/g,'\u094B')           // ौ → ो
    .replace(/ई/g,'इ').replace(/ऊ/g,'उ').replace(/ऐ/g,'ए').replace(/औ/g,'ओ')
    .replace(/ण/g,'न')                     // retroflex → dental nasal
    .replace(/[शष]/g,'स')                  // sh / ṣ / s all collapse
    .replace(/[वब]/g,'व')                  // the universal b/v confusion
    .replace(/ऋ/g,'रि')
    .replace(/[\u0946\u094A]/g,'');        // stray short e/o matras
}

/* --- grapheme-level edit distance --- */
function levG(a,b){
  const A=graphemes(a), B=graphemes(b), m=A.length, n=B.length;
  if(!m||!n) return Math.max(m,n);
  const d=Array.from({length:m+1},(_,i)=>[i,...new Array(n).fill(0)]);
  for(let j=0;j<=n;j++) d[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    d[i][j]=Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(A[i-1]===B[j-1]?0:1));
  return d[m][n];
}

/* --- stage 4: grade one target word against one spoken word --- */
function gradeWord(target, said, lang){
  const tN=normWord(target,lang), sN=normWord(said,lang);
  if(!tN) return 'ok';
  if(tN===sN) return 'ok';                        // exact
  const tF=foldWord(target,lang), sF=foldWord(said,lang);
  if(tF && tF===sF) return 'near';                // matra / nukta / nasal slip
  const len=graphemes(tF).length;
  const dist=levG(tF,sF);
  if(dist<=1 && len>=3) return 'near';            // one grapheme off
  if(dist<=Math.max(1, Math.floor(len*0.45))) return 'bad';  // recognisable but wrong
  return null;                                    // different word — don't align
}

/* --- stage 3 + 6: align the two sequences and score --- */
const WEIGHT = { ok:1, near:0.85, bad:0.35, miss:0 };
function gradeReading(sentence, transcript, lang){
  const disp = sentence.trim().split(/\s+/).filter(Boolean);   // keep original for display
  const said = transcript.trim().split(/\s+/).filter(Boolean);
  const m=disp.length, n=said.length;

  // LCS where "alignable" = anything not null from gradeWord
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  const gr=Array.from({length:m+1},()=>new Array(n+1).fill(null));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
    const g=gradeWord(disp[i-1], said[j-1], lang);
    gr[i][j]=g;
    dp[i][j] = g ? dp[i-1][j-1] + (g==='ok'?1.0:g==='near'?0.9:0.5)
                 : Math.max(dp[i-1][j], dp[i][j-1]);
  }
  const states=new Array(m).fill('miss');
  const heard=new Array(m).fill(null);
  let i=m,j=n, extra=0;
  while(i>0&&j>0){
    const g=gr[i][j];
    const keep = g && dp[i][j] === dp[i-1][j-1] + (g==='ok'?1.0:g==='near'?0.9:0.5);
    if(keep){ states[i-1]=g; heard[i-1]=said[j-1]; i--; j--; }
    else if(dp[i-1][j]>=dp[i][j-1]) i--; else { j--; extra++; }
  }
  extra += j;

  const raw = states.reduce((a,s)=>a+WEIGHT[s],0);
  let score = m ? (raw/m)*100 : 0;
  score -= Math.min(12, extra*4);                 // small penalty for added words
  score = Math.max(0, Math.round(score));

  const tokens = disp.map((w,k)=>({ text:w, state:states[k], heard:heard[k] }));
  return { tokens, score, extra,
           misread: tokens.filter(t=>t.state==='bad'||t.state==='miss').map(t=>t.text),
           slips:   tokens.filter(t=>t.state==='near').map(t=>t.text) };
}

/* --- stage 1 helper: grade every alternative, keep the kindest true reading --- */
function gradeBest(sentence, alternatives, lang){
  let best=null;
  for(const alt of alternatives){
    const r = gradeReading(sentence, alt.transcript, lang);
    r.confidence = alt.confidence ?? 0;
    if(!best || r.score > best.score) best = r;
  }
  return best;
}
