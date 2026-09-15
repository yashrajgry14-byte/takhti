/* ==================================================================
   LITERACY AND EARLY NUMERACY

   The arithmetic generator produces beats about quantity. Literacy is
   not about quantity, so it needs its own primitives — a letter you
   trace, three sounds sliding together into a word, a sight word with
   a picture. Nine new beat types, drawn by `litArt()`, which the
   existing player delegates to before its own switch.

   Everything else is unchanged: the same generator shape, the same
   validator, the same age bands. A literacy lesson is checked for
   bilingual completeness and narration length exactly like an
   arithmetic one.

   One honest limit, stated here rather than buried: this generates
   PRACTICE, not instruction. A child who has never met the letter
   'b' will not learn it from an app alone — a teacher or parent
   introduces it, and Takhti is where the child then meets it two
   hundred more times. That is the right division of labour and it is
   what the school pitch should say.
   ================================================================== */

/* ---------------- the alphabets ---------------- */
const LIT = {
  en: {
    caps:  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    small: 'abcdefghijklmnopqrstuvwxyz'.split(''),
    // letter → sound cue → three words a child in India actually meets
    sounds: [
      ['a','a as in apple',['apple','ant','arm'],'🍎'], ['b','b as in ball',['ball','bag','bus'],'⚽'],
      ['c','c as in cat',['cat','cup','cap'],'🐱'],     ['d','d as in dog',['dog','doll','door'],'🐕'],
      ['e','e as in egg',['egg','elephant','end'],'🥚'], ['f','f as in fan',['fan','fish','foot'],'🌀'],
      ['g','g as in goat',['goat','girl','gate'],'🐐'],  ['h','h as in hat',['hat','hand','house'],'🎩'],
      ['j','j as in jug',['jug','jam','jeep'],'🫙'],      ['k','k as in kite',['kite','key','kid'],'🪁'],
      ['l','l as in leaf',['leaf','lamp','leg'],'🍃'],    ['m','m as in mango',['mango','man','map'],'🥭'],
      ['n','n as in nest',['nest','nose','net'],'🪹'],    ['p','p as in pen',['pen','pot','pig'],'🖊️'],
      ['r','r as in rat',['rat','road','rain'],'🐀'],     ['s','s as in sun',['sun','star','sit'],'☀️'],
      ['t','t as in top',['top','tree','ten'],'🌳'],      ['v','v as in van',['van','vase','vet'],'🚐'],
      ['w','w as in water',['water','wall','win'],'💧'],  ['y','y as in yak',['yak','yes','yellow'],'🐃']
    ],
    // three sounds that slide together into one word
    blends: [['c','a','t','cat','🐱'], ['s','u','n','sun','☀️'], ['m','a','p','map','🗺️'],
             ['b','e','d','bed','🛏️'], ['p','i','g','pig','🐷'], ['d','o','g','dog','🐕'],
             ['c','u','p','cup','🥤'], ['h','a','t','hat','🎩'], ['n','e','t','net','🥅'],
             ['b','u','s','bus','🚌'], ['f','a','n','fan','🌀'], ['j','a','m','jam','🍓']],
    sight: [['the','🔤'],['is','🔤'],['a','🔤'],['and','🔤'],['to','🔤'],['my','🔤'],
            ['you','🧒'],['we','👨‍👩‍👧'],['it','🔤'],['in','📥'],['on','⬆️'],['at','📍']],
    rhymes: [['cat','bat','hat','🐱'], ['sun','fun','run','☀️'], ['bed','red','head','🛏️'],
             ['pig','big','dig','🐷'], ['top','hop','mop','🌳']]
  },
  hi: {
    swar:    'अ आ इ ई उ ऊ ए ऐ ओ औ'.split(' '),
    vyanjan: 'क ख ग घ च छ ज झ ट ठ ड ढ त थ द ध न प फ ब भ म य र ल व श ष स ह'.split(' '),
    matras:  [['ा','आ की मात्रा',['कान','हाथ','नाक'],'✋'], ['ि','इ की मात्रा',['किताब','दिन','मिट्टी'],'📖'],
              ['ी','ई की मात्रा',['नदी','चाबी','रोटी'],'🌊'], ['ु','उ की मात्रा',['गुड़','बुआ','सुबह'],'🍬'],
              ['ू','ऊ की मात्रा',['भूख','फूल','झूला'],'🌸'], ['े','ए की मात्रा',['पेड़','मेला','केला'],'🌳'],
              ['ो','ओ की मात्रा',['मोर','चोर','सोना'],'🦚']],
    blends: [['म','न','मन','💭'], ['क','ल','कल','📅'], ['घ','र','घर','🏠'], ['ज','ल','जल','💧'],
             ['न','ल','नल','🚰'], ['ब','स','बस','🚌'], ['ह','ल','हल','🚜'], ['द','म','दम','💪']],
    sight:  [['है','🔤'],['में','📥'],['और','🔤'],['यह','👉'],['वह','👉'],['मैं','🧒'],
             ['तुम','🧒'],['का','🔤'],['को','🔤'],['से','🔤']],
    sanyukt:[['क्','ष','क्ष','🐟'], ['त्','र','त्र','🔺'], ['ज्','ञ','ज्ञ','🧠'],
             ['स्','व','स्व','🏠'], ['प्','र','प्र','➡️']]
  }
};

/* ---------------- the new beat renderers ---------------- */
function litArt(b){
  switch(b.t){
    case 'letter':
      return `<div class="lit-letter">${b.ch}</div>
              <div class="lit-sub">${b.cue || ''}</div>`;

    case 'sound':
      return `<div class="lit-row">
        <div class="lit-letter sm">${b.ch}</div>
        <div class="lit-words">${(b.words||[]).map((w,i)=>
          `<span style="animation-delay:${i*0.18}s">${w}</span>`).join('')}</div>
        <div class="lit-pic">${b.art||''}</div>
      </div>`;

    case 'blend':
      return `<div class="lit-blend">
        ${(b.parts||[]).map((p,i)=>`<span class="bpart" style="animation-delay:${i*0.3}s">${p}</span>`).join(
          '<span class="bplus">+</span>')}
        <span class="barrow">→</span>
        <span class="bword">${b.word}</span>
      </div>
      <div class="lit-pic big">${b.art||''}</div>`;

    case 'word':
      return `<div class="lit-pic big">${b.art||'🔤'}</div>
              <div class="lit-letter sm">${b.w}</div>`;

    case 'rhyme':
      return `<div class="lit-words rhyme">${(b.words||[]).map((w,i)=>
        `<span style="animation-delay:${i*0.22}s">${w}</span>`).join('')}</div>
        <div class="lit-pic">${b.art||''}</div>`;

    case 'readline':
      return `<div class="lit-line">${b.text}</div>`;

    /* ---- early numeracy that is not about quantity ---- */
    case 'sortbin':
      return `<div class="lit-bins">${(b.groups||[]).map(g=>`
        <div class="bin"><b>${g.label}</b>
          <div class="binitems">${g.items.map((it,i)=>
            `<span style="animation-delay:${i*0.12}s">${it}</span>`).join('')}</div>
        </div>`).join('')}</div>`;

    case 'pattern':
      return `<div class="lit-pattern">${(b.seq||[]).map((x,i)=>
        `<span style="animation-delay:${i*0.14}s">${x}</span>`).join('')}
        <span class="pgap">?</span></div>`;

    case 'shape':
      return `<div class="lit-shapes">${(b.shapes||[]).map((s,i)=>
        `<span style="animation-delay:${i*0.16}s">${s}</span>`).join('')}</div>`;

    case 'clock':
      return `<svg class="lit-clock" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/>
        ${[...Array(12)].map((_,i)=>{const a=(i*30-90)*Math.PI/180;
          return `<text x="${60+Math.cos(a)*40}" y="${64+Math.sin(a)*40}" font-size="11"
                   text-anchor="middle" fill="currentColor" opacity=".7">${i||12}</text>`;}).join('')}
        <line x1="60" y1="60" x2="${60+Math.cos((b.h%12*30-90)*Math.PI/180)*24}"
              y2="${60+Math.sin((b.h%12*30-90)*Math.PI/180)*24}"
              stroke="var(--marigold)" stroke-width="5" stroke-linecap="round"/>
        <line x1="60" y1="60" x2="60" y2="22" stroke="var(--marigold)" stroke-width="3" stroke-linecap="round" opacity=".6"/>
        <circle cx="60" cy="60" r="4" fill="var(--marigold)"/>
      </svg>`;
    default:
      return null;      // not ours — let the arithmetic renderer handle it
  }
}

/* ---------------- narration for the new beats ---------------- */
const LIT_SAY = {
  letter: { en:'This is {ch}. Say it with me.',            hi:'यह {ch} है। मेरे साथ बोलो।' },
  sound:  { en:'{ch} says its sound. Listen: {words}.',    hi:'{ch} की ध्वनि सुनो: {words}।' },
  blend:  { en:'Slide the sounds together. They make {word}.', hi:'ध्वनियाँ जोड़ो। बनता है {word}।' },
  word:   { en:'This word is {w}. You will see it everywhere.', hi:'यह शब्द {w} है। यह हर जगह मिलेगा।' },
  rhyme:  { en:'These words end the same way. Hear it?',   hi:'इन शब्दों का अंत एक जैसा है। सुना?' },
  readline:{en:'Now you read this line out.',              hi:'अब तुम यह पंक्ति पढ़ो।' },
  sortbin:{ en:'Put each one where it belongs.',           hi:'हर एक को उसकी जगह रखो।' },
  pattern:{ en:'Look at the order. What comes next?',      hi:'क्रम देखो। आगे क्या आएगा?' },
  shape:  { en:'Look at the shapes. Count their sides.',   hi:'आकार देखो। भुजाएँ गिनो।' },
  clock:  { en:'The short hand points to {h}. It is {h} o clock.', hi:'छोटी सुई {h} पर है। {h} बजे हैं।' }
};
function litSay(b){
  const tpl = LIT_SAY[b.t];
  if(!tpl) return null;
  const v = { ch:b.ch, word:b.word, w:b.w, h:b.h, words:(b.words||[]).join(', ') };
  return (tpl[S.lang] || tpl.en).replace(/\{(\w+)\}/g, (_,k)=> v[k] != null ? v[k] : '');
}

/* ==================================================================
   THE CONCEPTS — one per gap in the Nursery to Class 3 graph
   ================================================================== */
const LIT_CONCEPTS = [

/* ---- English literacy ---- */
{ id:'letters', key:(p)=>'letters-' + p.ch, band:'pre', ic:'🔤', strand:'eng',
  title:(p)=>gq(`The letter ${p.ch.toUpperCase()}`, `अक्षर ${p.ch.toUpperCase()}`),
  sub:()=>gq('Look, say, trace', 'देखो, बोलो, बनाओ'),
  space:()=>LIT.en.sounds.map(([ch,cue,words,art])=>({ch,cue,words,art})),
  beats:(p)=>[
    {t:'letter', ch:p.ch.toUpperCase(), cue:p.cue},
    {t:'letter', ch:p.ch},
    {t:'sound',  ch:p.ch, words:p.words, art:p.art},
    {t:'ask', derived:true, q:gq(`Which word starts with ${p.ch}?`, `${p.ch} वाला शब्द कौन सा?`),
      opts:[p.words[0], 'zebra'], hiOpts:[p.words[0], 'zebra'], correct:0},
    {t:'win', say:gq(`${p.ch.toUpperCase()} and ${p.ch} are the same letter.`,
                     `${p.ch.toUpperCase()} और ${p.ch} एक ही अक्षर हैं।`)}
  ]},

{ id:'blending', key:(p)=>'blending-' + p.word, band:'early', ic:'🧩', strand:'eng',
  title:(p)=>gq(`Building "${p.word}"`, `"${p.word}" बनाना`),
  sub:()=>gq('Sounds slide together', 'ध्वनियाँ जुड़ती हैं'),
  space:()=>LIT.en.blends.map(([a,b,c,word,art])=>({parts:[a,b,c],word,art})),
  beats:(p)=>[
    {t:'intro', say:gq('Three sounds. Watch them slide together.', 'तीन ध्वनियाँ। इन्हें जुड़ते देखो।')},
    {t:'blend', parts:p.parts, word:p.word, art:p.art},
    {t:'ask', derived:true, q:gq('What word did they make?', 'कौन सा शब्द बना?'),
      opts:[p.word, p.parts.join('')+'o'], hiOpts:[p.word, p.parts.join('')+'o'], correct:0},
    {t:'readline', text:`I see a ${p.word}.`},
    {t:'win', say:gq('That is reading. Sounds, joined up.', 'यही पढ़ना है। ध्वनियाँ जुड़कर।')}
  ]},

{ id:'sightword', key:(p)=>'sight-' + p.w, band:'early', ic:'👁️', strand:'eng',
  title:(p)=>gq(`The word "${p.w}"`, `शब्द "${p.w}"`),
  sub:()=>gq('Know it on sight', 'देखते ही पहचानो'),
  space:()=>LIT.en.sight.map(([w,art])=>({w,art})),
  beats:(p)=>[
    {t:'word', w:p.w, art:p.art},
    {t:'readline', text:`This is ${p.w} book.`.replace('  ',' ')},
    {t:'ask', derived:true, q:gq('Did you spot the word?', 'शब्द दिखा?'),
      opts:['Yes','Not yet'], hiOpts:['हाँ','अभी नहीं'], correct:0},
    {t:'win', say:gq('Some words you read whole, without sounding out.',
                     'कुछ शब्द पूरे पढ़े जाते हैं, तोड़कर नहीं।')}
  ]},

{ id:'rhyming', key:(p)=>'rhyme-' + p.words[0], band:'pre', ic:'🎵', strand:'eng',
  title:(p)=>gq(`Words like "${p.words[0]}"`, `"${p.words[0]}" जैसे शब्द`),
  sub:()=>gq('Same ending sound', 'एक जैसा अंत'),
  space:()=>LIT.en.rhymes.map(([a,b,c,art])=>({words:[a,b,c],art})),
  beats:(p)=>[
    {t:'rhyme', words:p.words, art:p.art},
    {t:'ask', derived:true, q:gq('Do they end the same?', 'अंत एक जैसा है?'),
      opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:0},
    {t:'win', say:gq('Hearing endings helps you read new words.',
                     'अंत सुनना नए शब्द पढ़ने में मदद करता है।')}
  ]},

/* ---- Hindi literacy ---- */
{ id:'swar', key:(p)=>'swar-' + p.ch, band:'pre', ic:'अ', strand:'hin',
  title:(p)=>gq(`The vowel ${p.ch}`, `स्वर ${p.ch}`),
  sub:()=>gq('Look, say, trace', 'देखो, बोलो, बनाओ'),
  space:()=>LIT.hi.swar.map(ch=>({ch})),
  beats:(p)=>[
    {t:'letter', ch:p.ch},
    {t:'ask', derived:true, q:gq('Is this a vowel?', 'क्या यह स्वर है?'),
      opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:0},
    {t:'win', say:gq('Vowels come first in Hindi.', 'हिंदी में स्वर पहले आते हैं।')}
  ]},

{ id:'vyanjan', key:(p)=>'vyanjan-' + p.ch, band:'early', ic:'क', strand:'hin',
  title:(p)=>gq(`The letter ${p.ch}`, `अक्षर ${p.ch}`),
  sub:()=>gq('A consonant', 'व्यंजन'),
  space:()=>LIT.hi.vyanjan.map(ch=>({ch})),
  beats:(p)=>[
    {t:'letter', ch:p.ch},
    {t:'ask', derived:true, q:gq('Say it aloud. Ready?', 'बोलकर देखो। तैयार?'),
      opts:['Done','Again'], hiOpts:['हो गया','फिर से'], correct:0},
    {t:'win', say:gq('Consonants join with matras to make words.',
                     'व्यंजन मात्राओं से जुड़कर शब्द बनाते हैं।')}
  ]},

{ id:'matra', key:(p)=>'matra-' + p.ch, band:'early', ic:'ा', strand:'hin',
  title:(p)=>gq(`The matra ${p.ch}`, `मात्रा ${p.ch}`),
  sub:(p)=>gq(p.cue, p.cue),
  space:()=>LIT.hi.matras.map(([ch,cue,words,art])=>({ch,cue,words,art})),
  beats:(p)=>[
    {t:'letter', ch:p.ch, cue:p.cue},
    {t:'sound', ch:p.ch, words:p.words, art:p.art},
    {t:'ask', derived:true, q:gq('Which word has this matra?', 'यह मात्रा किसमें है?'),
      opts:[p.words[0],'कम'], hiOpts:[p.words[0],'कम'], correct:0},
    {t:'win', say:gq('A matra changes how a letter sounds.',
                     'मात्रा अक्षर की ध्वनि बदल देती है।')}
  ]},

{ id:'hiblend', key:(p)=>'hiblend-' + p.word, band:'early', ic:'🧩', strand:'hin',
  title:(p)=>gq(`Making "${p.word}"`, `"${p.word}" बनाना`),
  sub:()=>gq('Two letters, one word', 'दो अक्षर, एक शब्द'),
  space:()=>LIT.hi.blends.map(([a,b,word,art])=>({parts:[a,b],word,art})),
  beats:(p)=>[
    {t:'blend', parts:p.parts, word:p.word, art:p.art},
    {t:'ask', derived:true, q:gq('Which word is it?', 'कौन सा शब्द है?'),
      opts:[p.word, p.parts[0]+p.parts[0]], hiOpts:[p.word, p.parts[0]+p.parts[0]], correct:0},
    {t:'readline', text:`यह ${p.word} है।`},
    {t:'win', say:gq('Two letters joined. That is a word.', 'दो अक्षर जुड़े। यही शब्द है।')}
  ]},

{ id:'hisight', key:(p)=>'hisight-' + p.w, band:'early', ic:'👁️', strand:'hin',
  title:(p)=>gq(`The word "${p.w}"`, `शब्द "${p.w}"`),
  sub:()=>gq('Know it on sight', 'देखते ही पहचानो'),
  space:()=>LIT.hi.sight.map(([w,art])=>({w,art})),
  beats:(p)=>[
    {t:'word', w:p.w, art:p.art},
    {t:'ask', derived:true, q:gq('Seen this word before?', 'यह शब्द देखा है?'),
      opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:0},
    {t:'win', say:gq('These small words hold sentences together.',
                     'ये छोटे शब्द वाक्य को जोड़े रखते हैं।')}
  ]},

{ id:'sanyukt', key:(p)=>'sanyukt-' + p.joined, band:'developing', ic:'🔗', strand:'hin',
  title:(p)=>gq(`The conjunct ${p.joined}`, `संयुक्त अक्षर ${p.joined}`),
  sub:()=>gq('Two letters, joined', 'दो अक्षर, जुड़े हुए'),
  space:()=>LIT.hi.sanyukt.map(([a,b,joined,art])=>({parts:[a,b],joined,art})),
  beats:(p)=>[
    {t:'blend', parts:p.parts, word:p.joined, art:p.art},
    {t:'ask', derived:true, q:gq('Which letters joined?', 'कौन से अक्षर जुड़े?'),
      opts:[p.parts.join('+'), p.parts[0]+'+क'], hiOpts:[p.parts.join('+'), p.parts[0]+'+क'], correct:0},
    {t:'win', say:gq('The halant removes a sound, and they join.',
                     'हलंत ध्वनि हटाता है, और वे जुड़ जाते हैं।')}
  ]},

/* ---- early numeracy that is not about quantity ---- */
{ id:'sorting', key:(p)=>'sorting-' + p.by.replace(/\\s/g,''), band:'pre', ic:'🗂️', strand:'num',
  title:()=>gq('Putting things together', 'चीज़ें साथ रखना'),
  sub:(p)=>gq(p.by, p.byHi),
  space:()=>[
    {by:'By colour', byHi:'रंग से', groups:[{label:'🔴',items:['🍎','🌹','🍓']},{label:'🟡',items:['🍌','🌻','🧀']}]},
    {by:'By size',   byHi:'आकार से', groups:[{label:'big',items:['🐘','🐄','🐎']},{label:'small',items:['🐜','🐝','🐁']}]},
    {by:'By kind',   byHi:'प्रकार से', groups:[{label:'🐾',items:['🐕','🐈','🐇']},{label:'🌱',items:['🌳','🌷','🌵']}]}
  ],
  beats:(p)=>[
    {t:'intro', say:gq('Things that go together, go together.', 'जो साथ जाती हैं, साथ रखो।')},
    {t:'sortbin', groups:p.groups},
    {t:'ask', derived:true, q:gq('Are they sorted right?', 'सही छँटा है?'),
      opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:0},
    {t:'win', say:gq('Sorting is the first step to counting.', 'छाँटना गिनने का पहला कदम है।')}
  ]},

{ id:'shapes', key:(p)=>'shapes-' + p.sides, band:'pre', ic:'🔺', strand:'num',
  title:(p)=>gq(p.name, p.nameHi),
  sub:()=>gq('Look at the sides', 'भुजाएँ देखो'),
  space:()=>[
    {name:'Circles', nameHi:'गोल', shapes:['⭕','🔵','🟠'], sides:0, alt:'3'},
    {name:'Triangles', nameHi:'तिकोन', shapes:['🔺','🔻','🔺'], sides:3, alt:'4'},
    {name:'Squares', nameHi:'चौकोर', shapes:['🟥','🟦','🟩'], sides:4, alt:'3'}
  ],
  beats:(p)=>[
    {t:'shape', shapes:p.shapes},
    {t:'ask', derived:true, q:gq('How many sides?', 'कितनी भुजाएँ?'),
      opts:[String(p.sides), p.alt], hiOpts:[String(p.sides), p.alt], correct:0},
    {t:'win', say:gq('Shapes are named by their sides.', 'आकार भुजाओं से पहचाने जाते हैं।')}
  ]},

{ id:'patterns', key:(p)=>'pattern-' + p.seq.length + '-' + p.i, band:'pre', ic:'🔁', strand:'num',
  title:()=>gq('What comes next?', 'आगे क्या आएगा?'),
  sub:()=>gq('Reading a pattern', 'पैटर्न पढ़ना'),
  space:()=>[
    {i:1, seq:['🔴','🔵','🔴','🔵'], next:'🔴', alt:'🔵'},
    {i:2, seq:['⭐','⭐','🌙','⭐','⭐'], next:'🌙', alt:'⭐'},
    {i:3, seq:['🟥','🟨','🟩','🟥','🟨'], next:'🟩', alt:'🟥'},
    {i:4, seq:['🐤','🐤','🐣','🐤','🐤'], next:'🐣', alt:'🐤'}
  ],
  beats:(p)=>[
    {t:'pattern', seq:p.seq},
    {t:'ask', derived:true, q:gq('What comes next?', 'आगे क्या आएगा?'),
      opts:[p.next, p.alt], hiOpts:[p.next, p.alt], correct:0},
    {t:'win', say:gq('A pattern repeats. Find the repeat and you know.',
                     'पैटर्न दोहराता है। दोहराव मिला तो पता चल गया।')}
  ]},

{ id:'ordering', key:(p)=>'order-' + p.n, band:'pre', ic:'🔢', strand:'num',
  title:(p)=>gq(`Before and after ${p.n}`, `${p.n} से पहले और बाद`),
  sub:()=>gq('Where a number sits', 'संख्या कहाँ बैठती है'),
  space:()=>[3,4,5,6,7,8,9].map(n=>({n})),   // band ceiling for pre-readers is 10
  beats:(p)=>[
    {t:'line', a:Math.max(0,p.n-2), b:1, hops:3},
    {t:'ask', q:gq(`What comes after ${p.n}?`, `${p.n} के बाद क्या?`), ...genOpts(p.n+1,'count')},
    {t:'win', say:gq('Every number has a place in the line.', 'हर संख्या की एक जगह होती है।')}
  ]},

{ id:'clockhour', key:(p)=>'clock-' + p.h, band:'early', ic:'🕐', strand:'num',
  title:(p)=>gq(`${p.h} o'clock`, `${p.h} बजे`),
  sub:()=>gq('Reading the short hand', 'छोटी सुई पढ़ना'),
  space:()=>[1,2,3,4,5,6,7,8,9,10,11,12].map(h=>({h})),
  beats:(p)=>[
    {t:'clock', h:p.h},
    {t:'ask', derived:true, q:gq('What time is it?', 'क्या समय हुआ?'),
      opts:[`${p.h} o'clock`, `${p.h===12?1:p.h+1} o'clock`],
      hiOpts:[`${p.h} बजे`, `${p.h===12?1:p.h+1} बजे`], correct:0},
    {t:'win', say:gq('The short hand tells the hour.', 'छोटी सुई घंटा बताती है।')}
  ]}
];

/* The validator rejects any beat type it does not know — which is exactly
   what it should do, and it caught all 147 of these on the first run. New
   primitives have to be declared, not just drawn. */
const LIT_BEAT_TYPES = ['letter','sound','blend','word','rhyme','readline',
                        'sortbin','pattern','shape','clock'];
if(typeof GEN_BEATS !== 'undefined')
  for(const t of LIT_BEAT_TYPES) if(!GEN_BEATS.includes(t)) GEN_BEATS.push(t);

/* Merge into the generator's concept list and teach the skills they fill. */
const LIT_SKILL_MAP = {
  letters:['l-alpha','l-sound','n-hold','n-trace','l-write','u-small'],
  blending:['u-blend','e1-decode'],
  sightword:['u-sight'],
  rhyming:['n-rhyme','n-listen'],
  swar:['l-swar','l-matra0'],
  vyanjan:['u-vyanjan'],
  matra:['u-matra1','h1-matra'],
  hiblend:[], hisight:[], sanyukt:['h2-sanyukt'],
  sorting:['n-sort'], shapes:['n-shapes','shapes2d'],
  patterns:['l-pattern'], ordering:['u-order'], clockhour:['time2']
};

if(typeof CONCEPTS !== 'undefined') CONCEPTS.push(...LIT_CONCEPTS);
if(typeof SKILLS !== 'undefined'){
  for(const [concept, skillIds] of Object.entries(LIT_SKILL_MAP)){
    for(const sid of skillIds){
      const s = SKILLS.find(x => x.id === sid);
      if(s && !s.concepts.includes(concept)) s.concepts.push(concept);
    }
  }
}
