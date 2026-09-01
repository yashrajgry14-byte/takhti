/* ==================================================================
   LESSON GENERATOR

   Arithmetic is fully enumerable. Every two-digit carrying problem,
   every array, every equal share — the whole space can be walked. So
   we do not hand-write lessons; we generate them, then refuse to ship
   any that fails a check.

   The order matters and it is the whole safety argument:

       generate (deterministic, on-device)
         → validate (arithmetic, age band, readability, bilingual)
           → ship only what passes

   An LLM never decides what a child sees. It may only rewrite the
   words of a lesson that already passed, and the rewrite is validated
   again before it is shown. If the model is unavailable, wrong, or
   hallucinating, the child still gets a correct lesson — because the
   correct lesson existed before the model was asked.

   Requires: content/ages.js, core/readability.js, ui/lesson-player.js
   ================================================================== */

/* ---------- narration used by generated lessons, both languages ---------- */
const GEN_TEXT = {
  countIntro: { en:"The game is starting. Let us count these.",
                hi:"खेल शुरू! आओ इन्हें गिनें।" },
  countWin:   { en:"You counted every one. Well done.",
                hi:"तुमने हर एक गिना। शाबाश!" },
  addIntro:   { en:"Some are already here. Watch what happens when more arrive.",
                hi:"कुछ पहले से हैं। देखो जब और आते हैं तो क्या होता है।" },
  addWin:     { en:"Adding just means putting two groups together.",
                hi:"जोड़ना यानी दो ढेरों को मिला देना।" },
  takeIntro:  { en:"Everyone is here. Then some have to go home.",
                hi:"सब यहीं हैं। फिर कुछ को घर जाना पड़ता है।" },
  takeWin:    { en:"Taking away is adding, walking backwards.",
                hi:"घटाना यानी उल्टी दिशा में जोड़ना।" },
  bondIntro:  { en:"Ten is a special number. Many pairs add up to exactly ten.",
                hi:"दस ख़ास संख्या है। कई जोड़ियाँ मिलकर ठीक दस बनाती हैं।" },
  bondWin:    { en:"Learn these pairs and every sum gets easier.",
                hi:"ये जोड़ियाँ याद हो जाएँ तो हर सवाल आसान।" },
  groupIntro: { en:"Counting them one by one takes forever. Bundle them instead.",
                hi:"एक-एक गिनना बहुत लंबा है। इन्हें बंडल कर लो।" },
  groupWin:   { en:"The first digit counts bundles. The second counts what is left.",
                hi:"पहला अंक बंडल गिनता है। दूसरा बचे हुए।" },
  carryIntro: { en:"Watch the loose ones carefully — there will be too many.",
                hi:"बचे हुओं को ध्यान से देखो — वे बहुत हो जाएँगे।" },
  carryWin:   { en:"Carrying is not a rule to memorise. It is a bundle being born.",
                hi:"हासिल रटने का नियम नहीं। यह नया बंडल बनना है।" },
  lineIntro:  { en:"You do not have to count one at a time. Jump instead.",
                hi:"एक-एक गिनना ज़रूरी नहीं। छलाँग लगाओ।" },
  lineWin:    { en:"Equal jumps are the beginning of multiplying.",
                hi:"बराबर छलाँगें ही गुणा की शुरुआत हैं।" },
  arrayIntro: { en:"Line everyone up in neat rows. Now you can count them fast.",
                hi:"सबको सीधी पंक्तियों में खड़ा करो। अब जल्दी गिन सकते हो।" },
  arrayWin:   { en:"Rows times columns. That is all multiplying is.",
                hi:"पंक्तियाँ गुणा स्तंभ। गुणा बस यही है।" },
  shareIntro: { en:"These must be shared equally. Deal them out one at a time.",
                hi:"इन्हें बराबर बाँटना है। एक-एक करके बाँटो।" },
  shareWin:   { en:"Every division is a multiplication asked backwards.",
                hi:"हर भाग उल्टा पूछा गया गुणा है।" },
  barIntro:   { en:"We know the whole and one part. The bar finds the rest.",
                hi:"हमें पूरा और एक हिस्सा पता है। पट्टी बाकी बता देगी।" },
  barWin:     { en:"The bar shows the missing part. No guessing needed.",
                hi:"पट्टी बचा हिस्सा दिखा देती है। अंदाज़े की ज़रूरत नहीं।" },
  fracIntro:  { en:"One whole thing, cut into equal parts. Equal is the important word.",
                hi:"एक पूरी चीज़, बराबर हिस्सों में। बराबर — यही ज़रूरी शब्द है।" },
  fracWin:    { en:"More pieces means smaller pieces. That surprises everyone at first.",
                hi:"ज़्यादा टुकड़े यानी छोटे टुकड़े। यह सबको पहले चौंकाता है।" }
};
const gq = (en, hi) => ({ en, hi });

/* ---------- distractors that teach ----------
   A random wrong answer tells you nothing. A near-miss tells you which
   mistake the child actually made: off-by-one, forgot to carry, added
   instead of subtracted. */
function genDistractor(ans, kind){
  const cands = [];
  if(kind === 'add')   cands.push(ans-1, ans+1, ans-10, ans+10);
  if(kind === 'take')  cands.push(ans+1, ans-1, ans+10);
  if(kind === 'mul')   cands.push(ans-1, ans+1, ans+2);
  if(kind === 'count') cands.push(ans-1, ans+1);
  if(!cands.length)    cands.push(ans-1, ans+1);
  const ok = cands.filter(v => v >= 0 && v !== ans);
  return ok.length ? ok[0] : ans + 1;
}
function genOpts(ans, kind){
  const d = genDistractor(ans, kind);
  return { opts:[String(ans), String(d)], hiOpts:[String(ans), String(d)], correct:0 };
}

/* ==================================================================
   CONCEPTS — each enumerates its own parameter space
   ================================================================== */
const CONCEPTS = [

{ id:'count', band:'pre', ic:'🖐️',
  title:(p)=>gq(`Count to ${p.n}`, `${p.n} तक गिनो`),
  sub:()=>gq('One at a time', 'एक-एक करके'),
  space:()=>[3,4,5,6,7,8,9,10].map(n=>({n})),
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.countIntro},
    {t:'count', n:Math.max(2, p.n-2)},
    {t:'count', n:p.n},
    {t:'ask', q:gq('How many are there now?', 'अब कितने हैं?'), ...genOpts(p.n,'count')},
    {t:'win', say:GEN_TEXT.countWin}
  ]},

{ id:'compare', band:'pre', ic:'⚖️',
  title:(p)=>gq('More or fewer', 'ज़्यादा या कम'),
  sub:(p)=>gq(`${p.a} against ${p.b}`, `${p.a} बनाम ${p.b}`),
  space:()=>[[2,5],[3,6],[4,7],[1,4],[3,8],[2,6]].map(([a,b])=>({a,b})),
  beats:(p)=>[
    {t:'intro', say:gq('Two teams. One has more. Which one?',
                       'दो टीमें। एक के पास ज़्यादा है। कौन सी?')},
    {t:'count', n:p.a},
    {t:'count', n:p.b},
    {t:'ask', derived:true, q:gq(`Which is more?`, `ज़्यादा कौन?`),
      opts:[String(p.b), String(p.a)], hiOpts:[String(p.b), String(p.a)], correct:0},
    {t:'win', say:gq('Bigger pile, bigger number.', 'बड़ा ढेर, बड़ी संख्या।')}
  ]},

{ id:'add', band:'early', ic:'➕',
  title:(p)=>gq(`Adding to ${p.a + p.b}`, `${p.a + p.b} तक जोड़ो`),
  sub:(p)=>gq('When more arrive', 'जब और आ जाएँ'),
  space:()=>{ const o=[]; for(let a=2;a<=7;a++) for(let b=1;b<=6;b++) if(a+b<=10) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.addIntro},
    {t:'add', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} and ${p.b} more makes…`, `${p.a} और ${p.b} मिलकर…`), ...genOpts(p.a+p.b,'add')},
    {t:'win', say:GEN_TEXT.addWin}
  ]},

{ id:'take', band:'early', ic:'➖',
  title:(p)=>gq(`Taking ${p.b} away`, `${p.b} घटाओ`),
  sub:(p)=>gq('When some leave', 'जब कुछ चले जाएँ'),
  space:()=>{ const o=[]; for(let a=4;a<=10;a++) for(let b=1;b<=5;b++) if(a-b>=1) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.takeIntro},
    {t:'take', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} take away ${p.b} leaves…`, `${p.a} में से ${p.b} गए, बचे…`), ...genOpts(p.a-p.b,'take')},
    {t:'win', say:GEN_TEXT.takeWin}
  ]},

{ id:'bond', band:'early', ic:'🤝',
  title:(p)=>gq('Pairs that make ten', 'दस बनाने वाली जोड़ियाँ'),
  sub:(p)=>gq(`${p.b} and what?`, `${p.b} और कितने?`),
  space:()=>[1,2,3,4,6,7,8,9].map(b=>({a:10,b})),
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.bondIntro},
    {t:'bar', a:10, b:p.b},
    {t:'ask', q:gq(`${p.b} and what makes 10?`, `${p.b} और कितने मिलकर 10?`), ...genOpts(10-p.b,'add')},
    {t:'win', say:GEN_TEXT.bondWin}
  ]},

{ id:'group', band:'developing', ic:'📦',
  title:(p)=>gq(`Bundles inside ${p.a}`, `${p.a} के अंदर बंडल`),
  sub:()=>gq('Why the digits mean what they mean', 'अंकों का मतलब'),
  space:()=>[23,31,47,52,64,76,38,45,29,87].map(a=>({a})),
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.groupIntro},
    {t:'group', a:p.a},
    {t:'ask', derived:true,
      q:gq(`How many bundles of ten in ${p.a}?`, `${p.a} में दस के कितने बंडल?`),
      ...genOpts(Math.floor(p.a/10),'count')},
    {t:'win', say:GEN_TEXT.groupWin}
  ]},

{ id:'carry', band:'developing', ic:'🎒',
  title:(p)=>gq(`${p.a} plus ${p.b}`, `${p.a} जमा ${p.b}`),
  sub:()=>gq('When ten ones become a bundle', 'जब दस इकाई बंडल बनें'),
  space:()=>{ const o=[]; for(const a of [18,26,28,35,47,56,68])
      for(const b of [4,5,6,7,8]) if((a%10)+b > 10 && a+b<=100) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.carryIntro},
    {t:'group', a:p.a},
    {t:'add', a:p.a%10, b:p.b},
    {t:'group', a:p.a+p.b},
    {t:'ask', q:gq(`${p.a} + ${p.b} = ?`, `${p.a} + ${p.b} = ?`), ...genOpts(p.a+p.b,'add')},
    {t:'win', say:GEN_TEXT.carryWin}
  ]},

{ id:'barsub', band:'developing', ic:'🔙',
  title:(p)=>gq(`${p.a} minus ${p.b}`, `${p.a} में से ${p.b}`),
  sub:()=>gq('The part you cannot see', 'जो हिस्सा दिख नहीं रहा'),
  space:()=>{ const o=[]; for(const a of [20,25,30,35,40,45,50])
      for(const b of [8,12,15,18]) if(a-b>0) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.barIntro},
    {t:'bar', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} − ${p.b} = ?`, `${p.a} − ${p.b} = ?`), ...genOpts(p.a-p.b,'take')},
    {t:'win', say:GEN_TEXT.barWin}
  ]},

{ id:'skip', band:'developing', ic:'🦘',
  title:(p)=>gq(`Counting in ${p.b}s`, `${p.b}-${p.b} करके गिनो`),
  sub:(p)=>gq(`${p.hops} jumps`, `${p.hops} छलाँगें`),
  space:()=>{ const o=[]; for(const b of [2,3,5,10]) for(const hops of [3,4,5])
      if(b*hops<=50) o.push({a:0,b,hops}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.lineIntro},
    {t:'line', a:0, b:p.b, hops:p.hops},
    {t:'ask', q:gq(`${p.hops} jumps of ${p.b} lands on…`, `${p.b} की ${p.hops} छलाँगें पहुँचती हैं…`),
      ...genOpts(p.b*p.hops,'mul')},
    {t:'win', say:GEN_TEXT.lineWin}
  ]},

{ id:'array', band:'developing', ic:'🔲',
  title:(p)=>gq(`${p.a} rows of ${p.b}`, `${p.b} की ${p.a} पंक्तियाँ`),
  sub:()=>gq('Multiplying is a shape', 'गुणा एक आकार है'),
  space:()=>{ const o=[]; for(let a=2;a<=5;a++) for(let b=2;b<=6;b++) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.arrayIntro},
    {t:'array', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} × ${p.b} = ?`, `${p.a} × ${p.b} = ?`), ...genOpts(p.a*p.b,'mul')},
    {t:'win', say:GEN_TEXT.arrayWin}
  ]},

{ id:'table', band:'fluent', ic:'✖️',
  title:(p)=>gq(`The ${p.b} times table, seen`, `${p.b} का पहाड़ा, दिखते हुए`),
  sub:(p)=>gq(`Why ${p.a} × ${p.b} is ${p.a*p.b}`, `${p.a} × ${p.b} = ${p.a*p.b} क्यों`),
  space:()=>{ const o=[]; for(let b=2;b<=9;b++) for(const a of [3,4,6]) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:gq('A table is not a chant to memorise. It is a shape you can see.',
                       'पहाड़ा रटने की चीज़ नहीं। यह दिखने वाला आकार है।')},
    {t:'array', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} × ${p.b} = ?`, `${p.a} × ${p.b} = ?`), ...genOpts(p.a*p.b,'mul')},
    {t:'array', a:p.b, b:p.a,
      say:gq(`Turn it sideways: ${p.b} rows of ${p.a}. Same total — order does not matter.`,
             `बग़ल से देखो: ${p.a} की ${p.b} पंक्तियाँ। कुल वही — क्रम से फ़र्क़ नहीं।`)},
    {t:'win', say:gq('Turning a shape around does not change how much is in it.',
                     'आकार घुमाने से उसमें रखी चीज़ें नहीं बदलतीं।')}
  ]},

{ id:'share', band:'fluent', ic:'➗',
  title:(p)=>gq(`Sharing ${p.a} between ${p.b}`, `${p.a} को ${p.b} में बाँटो`),
  sub:()=>gq('Division without fear', 'भाग, बिना डर'),
  space:()=>{ const o=[]; for(const b of [2,3,4,5]) for(let q=2;q<=6;q++) o.push({a:b*q,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.shareIntro},
    {t:'share', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} ÷ ${p.b} = ?`, `${p.a} ÷ ${p.b} = ?`), ...genOpts(p.a/p.b,'mul')},
    {t:'array', a:p.b, b:p.a/p.b,
      say:gq(`And look — the same shape as ${p.b} × ${p.a/p.b}. Dividing undoes multiplying.`,
             `देखो — यह ${p.b} × ${p.a/p.b} वाला ही आकार है। भाग गुणा को उलट देता है।`)},
    {t:'win', say:GEN_TEXT.shareWin}
  ]},

{ id:'frac', band:'fluent', ic:'🍕',
  title:(p)=>gq(`One out of ${p.b}`, `${p.b} में से एक`),
  sub:()=>gq('Parts of one whole', 'एक पूरे के हिस्से'),
  space:()=>[2,3,4,5,6,8].map(b=>({b})),
  beats:(p)=>[
    {t:'intro', say:GEN_TEXT.fracIntro},
    {t:'frac', b:p.b},
    {t:'ask', derived:true,
      q:gq(`How many equal parts is the whole cut into?`, `पूरे को कितने बराबर हिस्सों में काटा?`),
      opts:[String(p.b), String(p.b+1)], hiOpts:[String(p.b), String(p.b+1)], correct:0},
    {t:'win', say:GEN_TEXT.fracWin}
  ]},

/* ---------- second wave: money, time, measure, word problems ----------
   Every one of these reuses the eleven primitives the player already
   draws. No new renderer, no new risk — the breadth comes from the
   parameter space, and the validator checks each one the same way. */

{ id:'money', band:'early', ic:'🪙',
  title:(p)=>gq(`${p.a} rupees and ${p.b} more`, `${p.a} रुपये और ${p.b}`),
  sub:()=>gq('Counting money', 'पैसे गिनना'),
  space:()=>{ const o=[]; for(const a of [2,3,5,10]) for(const b of [1,2,5]) if(a+b<=20) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:gq('You have some rupees. Your uncle gives you more.',
                       'तुम्हारे पास कुछ रुपये हैं। चाचा और देते हैं।')},
    {t:'add', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} rupees and ${p.b} more?`, `${p.a} रुपये और ${p.b}?`), ...genOpts(p.a+p.b,'add')},
    {t:'win', say:gq('Money adds up the same way anything does.',
                     'पैसे भी उसी तरह जुड़ते हैं जैसे बाकी चीज़ें।')}
  ]},

{ id:'spend', band:'developing', ic:'🛒',
  title:(p)=>gq(`Spending from ${p.a} rupees`, `${p.a} रुपये में से खर्च`),
  sub:(p)=>gq(`What is left after ${p.b}?`, `${p.b} के बाद क्या बचा?`),
  space:()=>{ const o=[]; for(const a of [20,25,30,50,60,100]) for(const b of [5,10,15,20])
      if(a-b>0 && a<=100) o.push({a,b}); return o; },
  beats:(p)=>[
    {t:'intro', say:gq('You go to the shop with money in your pocket.',
                       'तुम जेब में पैसे लेकर दुकान जाते हो।')},
    {t:'bar', a:p.a, b:p.b},
    {t:'ask', q:gq(`${p.a} minus ${p.b} rupees?`, `${p.a} में से ${p.b} रुपये?`), ...genOpts(p.a-p.b,'take')},
    {t:'win', say:gq('Change is just the part of the bar you did not spend.',
                     'बचे पैसे वही हिस्सा हैं जो तुमने खर्च नहीं किया।')}
  ]},

{ id:'twostep', band:'developing', ic:'🧩',
  title:(p)=>gq('Two things happen', 'दो बातें होती हैं'),
  sub:(p)=>gq(`${p.a}, then ${p.b} more, then ${p.c} leave`, `${p.a}, फिर ${p.b} और, फिर ${p.c} गए`),
  space:()=>{ const o=[]; for(const a of [5,8,10,12]) for(const b of [3,4,6]) for(const c of [2,5])
      if(a+b-c > 0 && a+b <= 20) o.push({a,b,c}); return o; },
  beats:(p)=>[
    {t:'intro', say:gq('Two things happen, one after the other. Watch both.',
                       'दो बातें होती हैं, एक के बाद एक। दोनों देखो।')},
    {t:'add', a:p.a, b:p.b},
    {t:'take', a:p.a+p.b, b:p.c},
    {t:'ask', q:gq(`${p.a} + ${p.b} − ${p.c} = ?`, `${p.a} + ${p.b} − ${p.c} = ?`),
      ...genOpts(p.a+p.b-p.c,'take')},
    {t:'win', say:gq('Do one step, then the next. Never both at once.',
                     'एक कदम, फिर दूसरा। दोनों एक साथ नहीं।')}
  ]},

{ id:'measure', band:'developing', ic:'📏',
  title:(p)=>gq(`Measuring in ${p.b}s`, `${p.b}-${p.b} करके नापो`),
  sub:(p)=>gq(`${p.hops} lengths end to end`, `${p.hops} लंबाइयाँ जोड़कर`),
  space:()=>{ const o=[]; for(const b of [5,10]) for(const hops of [3,4,5,6]) o.push({a:0,b,hops}); return o; },
  beats:(p)=>[
    {t:'intro', say:gq('Lay the ruler down again and again. Count as you go.',
                       'पैमाना बार-बार रखो। साथ-साथ गिनते जाओ।')},
    {t:'line', a:0, b:p.b, hops:p.hops},
    {t:'ask', q:gq(`${p.hops} lengths of ${p.b} cm?`, `${p.b} सेमी की ${p.hops} लंबाइयाँ?`),
      ...genOpts(p.b*p.hops,'mul')},
    {t:'win', say:gq('Measuring is counting, with a ruler instead of fingers.',
                     'नापना भी गिनना है, उँगलियों की जगह पैमाने से।')}
  ]},

{ id:'oddeven', band:'developing', ic:'👥',
  title:(p)=>gq(`Can ${p.n} make pairs?`, `क्या ${p.n} जोड़े बन सकते हैं?`),
  sub:()=>gq('Odd and even', 'सम और विषम'),
  space:()=>[4,6,7,8,9,10,12,15].map(n=>({n, a:Math.floor(n/2), b:2})),
  beats:(p)=>[
    {t:'intro', say:gq('Everyone needs a partner. Will anyone be left over?',
                       'सबको साथी चाहिए। क्या कोई अकेला बचेगा?')},
    {t:'array', a:p.a, b:2},
    {t:'ask', derived:true, q:gq(`Is ${p.n} even?`, `क्या ${p.n} सम है?`),
      opts: p.n%2===0 ? ['Yes','No'] : ['No','Yes'],
      hiOpts: p.n%2===0 ? ['हाँ','नहीं'] : ['नहीं','हाँ'], correct:0},
    {t:'win', say:gq('Everyone paired means even. One left over means odd.',
                     'सबके जोड़े बने तो सम। एक बचा तो विषम।')}
  ]},

{ id:'half', band:'fluent', ic:'✂️',
  title:(p)=>gq(`Half of ${p.a}`, `${p.a} का आधा`),
  sub:()=>gq('Sharing between two', 'दो में बाँटना'),
  space:()=>[8,10,12,14,16,18,20,24,30].map(a=>({a,b:2})),
  beats:(p)=>[
    {t:'intro', say:gq('Two friends, and everything must be split evenly between them.',
                       'दो दोस्त, और सब कुछ बराबर बाँटना है।')},
    {t:'share', a:p.a, b:2},
    {t:'ask', q:gq(`Half of ${p.a} is?`, `${p.a} का आधा?`), ...genOpts(p.a/2,'mul')},
    {t:'win', say:gq('Half means two equal parts. Never two parts that look close.',
                     'आधा यानी दो बराबर हिस्से। लगभग बराबर नहीं चलेगा।')}
  ]}

];

/* ==================================================================
   THE VALIDATOR — nothing reaches a child without passing this
   ================================================================== */
const GEN_BEATS = ['intro','count','add','take','group','line','array','share','bar','frac','ask','win'];

function validateLesson(les){
  const errs = [];
  const bi = (o, where) => { if(!o || !o.en || !o.hi) errs.push(`${where} is not bilingual`); };

  if(!les.id) errs.push('missing id');
  if(!AGE_BANDS[les.band]) errs.push(`band "${les.band}" is not a real age band`);
  bi(les.title, 'title'); bi(les.sub, 'sub');
  if(!Array.isArray(les.beats) || les.beats.length < 3) errs.push('needs at least 3 beats');

  const b = AGE_BANDS[les.band] || AGE_BANDS.developing;
  let last = null, asks = 0;

  (les.beats || []).forEach((x, i) => {
    if(!GEN_BEATS.includes(x.t)) errs.push(`beat ${i}: unknown type "${x.t}"`);
    if(x.say) bi(x.say, `beat ${i} say`);

    // every number a child meets must sit inside their age band
    for(const k of ['a','b','n']){
      if(typeof x[k] === 'number' && x[k] > b.maxNumber)
        errs.push(`beat ${i}: ${k}=${x[k]} exceeds the band ceiling of ${b.maxNumber}`);
    }

    // track what the beats add up to, so the checkpoint can be checked
    if(x.t==='count') last = x.n;
    if(x.t==='add')   last = x.a + x.b;
    if(x.t==='take')  last = x.a - x.b;
    if(x.t==='array') last = x.a * x.b;
    if(x.t==='share') last = Math.floor(x.a / x.b);
    if(x.t==='bar')   last = x.a - x.b;
    if(x.t==='line')  last = x.a + x.b * (x.hops || 1);
    if(x.t==='group') last = x.a;

    if(x.t === 'ask'){
      asks++;
      bi(x.q, `beat ${i} question`);
      if(!Array.isArray(x.opts) || x.opts.length < 2) errs.push(`beat ${i}: needs 2+ options`);
      if(!Array.isArray(x.hiOpts) || x.hiOpts.length !== (x.opts||[]).length)
        errs.push(`beat ${i}: hiOpts length does not match opts`);
      if(typeof x.correct !== 'number' || x.correct < 0 || x.correct >= (x.opts||[]).length)
        errs.push(`beat ${i}: correct index out of range`);
      if(new Set(x.opts).size !== (x.opts||[]).length)
        errs.push(`beat ${i}: duplicate options — one of them is not wrong`);

      // the arithmetic check: does the marked answer match what the beats computed?
      const given = (x.opts || [])[x.correct];
      if(!x.derived && last != null && /^-?\d+$/.test(String(given)) && Number(given) !== last)
        errs.push(`beat ${i}: marked "${given}" correct but the beats compute ${last}`);
    }

    // Readability gates what a child must DECODE, not what the app SAYS.
    // A five-year-old who cannot read विद्यालय understands it perfectly when
    // it is spoken aloud. So narration is held to a listening standard —
    // sentence length — while the question, which the child reads on screen
    // while answering, is held to the reading standard for their band.
    if(typeof readability === 'function'){
      const order = ['pre','early','developing','fluent'];
      const cap = { pre:11, early:14, developing:18, fluent:24 }[les.band] || 18;

      if(x.say){
        const words = x.say.hi.trim().split(/\s+/).length;
        if(words > cap)
          errs.push(`beat ${i}: narration is ${words} words, over the ${cap}-word limit for "${les.band}"`);
      }
      if(x.t === 'ask' && x.q){
        // the question is spoken too, so it gets the listening cap...
        const qw = x.q.hi.trim().split(/\s+/).length;
        if(qw > cap)
          errs.push(`beat ${i}: question is ${qw} words, over the ${cap}-word limit for "${les.band}"`);
        // ...but the OPTIONS sit on screen and must be decoded, so at the
        // youngest ages they have to be a numeral or a single short word.
        if((les.band === 'pre' || les.band === 'early')){
          for(const o of (x.opts || [])){
            if(String(o).trim().split(/\s+/).length > 2)
              errs.push(`beat ${i}: option "${o}" is too long to read at "${les.band}"`);
          }
        }
        const got = readability(x.q.hi, 'hi').band;
        if(order.indexOf(got) > order.indexOf(b.read) + 1)
          errs.push(`beat ${i}: question decodes at "${got}", far above "${b.read}"`);
      }
    }
  });

  if(!asks) errs.push('no checkpoint — a lesson must ask the child something');
  return { ok: errs.length === 0, errors: errs };
}

/* ==================================================================
   BUILD — enumerate, validate, keep what passes
   ================================================================== */
function generateLessons(opts){
  opts = opts || {};
  const out = [], rejected = [];
  for(const c of CONCEPTS){
    for(const p of c.space()){
      const les = {
        id: `gen-${c.id}-${Object.values(p).join('-')}`,
        band: c.band, ic: c.ic, generated: true, concept: c.id,
        title: c.title(p), sub: c.sub(p), beats: c.beats(p)
      };
      const v = validateLesson(les);
      if(v.ok) out.push(les);
      else rejected.push({ id: les.id, errors: v.errors });
    }
  }
  if(opts.report) return { lessons: out, rejected };
  return out;
}

/* The bank the app actually reads: hand-written lessons first — they are
   the best-written ones — then the generated bank behind them. */
function lessonBank(){
  if(!S._bank) S._bank = (typeof LESSONS !== 'undefined' ? LESSONS.slice() : []).concat(generateLessons());
  return S._bank;
}

/* What to offer this child right now: their band, concepts they have not
   just done, a stable set per day. */
function lessonsForChild(n){
  n = n || 8;
  const mine = lessonBank().filter(l => l.band === band().id);
  const done = S.doneLessons || [];
  const fresh = mine.filter(l => !done.includes(l.id));
  const pool = fresh.length >= n ? fresh : mine;

  const r = rng(seedOf((S.name || 'x') + '|' + band().id + '|' + (S.day || 0)));
  const seen = new Set(), pick = [];
  const shuffled = pool.slice().sort(() => r() - 0.5);
  // one per concept first, so the list looks varied rather than eight
  // near-identical addition drills
  for(const l of shuffled){
    const k = l.concept || l.id;
    if(seen.has(k)) continue;
    seen.add(k); pick.push(l);
    if(pick.length >= n) break;
  }
  for(const l of shuffled){
    if(pick.length >= n) break;
    if(!pick.includes(l)) pick.push(l);
  }
  return pick;
}

function markLessonDone(id){
  S.doneLessons = S.doneLessons || [];
  if(!S.doneLessons.includes(id)) S.doneLessons.push(id);
  if(S.doneLessons.length > 200) S.doneLessons = S.doneLessons.slice(-200);
}

/* ==================================================================
   TIER 2 — optional narration polish.
   The model rewrites words. It never invents a lesson, never chooses
   what a child sees, and never touches a number. Its output goes
   through the same validator, and a failure is simply discarded.
   ================================================================== */
async function enrichLesson(les){
  if(!S.online) return les;
  const lines = les.beats.map((b,i) => b.say ? { i, en:b.say.en, hi:b.say.hi } : null).filter(Boolean);
  if(!lines.length) return les;

  const prompt = `Rewrite these lines for an Indian child aged ${AGE_BANDS[les.band].ages.join('–')} learning arithmetic.
Keep every number and every fact EXACTLY the same. Make them warmer and more concrete. Under 16 words each.
Reply ONLY with JSON: {"lines":[{"i":0,"en":"...","hi":"..."}]}
${JSON.stringify(lines)}`;

  try{
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ max_tokens:1000, messages:[{ role:'user', content:prompt }] }) });
    if(!res.ok) throw new Error('proxy ' + res.status);
    const data = await res.json();
    const txt = data.content.filter(x=>x.type==='text').map(x=>x.text).join('').replace(/```json|```/g,'').trim();
    const out = JSON.parse(txt);

    const copy = JSON.parse(JSON.stringify(les));
    for(const l of out.lines || []){
      if(copy.beats[l.i] && copy.beats[l.i].say && l.en && l.hi)
        copy.beats[l.i].say = { en:l.en, hi:l.hi };
    }
    const v = validateLesson(copy);
    if(!v.ok){ log(0, `Tier 1 rewrite rejected by the validator: ${v.errors[0]}`); return les; }
    log(2, 'Lesson narration refreshed · validated before showing');
    return copy;
  }catch(e){
    log(0, 'No narration rewrite available · shipping the on-device lesson');
    return les;
  }
}
