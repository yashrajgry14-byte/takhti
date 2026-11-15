/* ==================================================================
   COMPREHENSION AND GRAMMAR

   The last seven gaps below Class 4. These are genuinely different
   from everything before: arithmetic beats show quantity, literacy
   beats show letters and sounds. Comprehension is about holding
   several sentences in your head and answering from them, and grammar
   is about noticing what a word is DOING in a sentence.

   Three more beat types:
     passage    a short text, read or heard, that stays on screen
     highlight  one sentence, one word to find, and a reason
     sentbuild  words out of order, put back into a sentence

   The passages are deliberately about things a child in an Indian
   primary classroom has actually seen — a water tanker, a school bag,
   a crow on a wall — rather than translated Western readers. A child
   comprehends what they can picture.
   ================================================================== */

/* ---------------- passages ---------------- */
const PASSAGES = {
  en2: [
    { art:'🐦', p:{en:"A crow sat on the school wall. It had a piece of roti in its beak. A dog barked. The crow flew away and dropped the roti.",
                   hi:"एक कौआ स्कूल की दीवार पर बैठा था। उसकी चोंच में रोटी थी। एक कुत्ता भौंका। कौआ उड़ गया और रोटी गिर गई।"},
      qs:[{q:{en:'Where did the crow sit?',hi:'कौआ कहाँ बैठा था?'},a:{en:'On the school wall',hi:'स्कूल की दीवार पर'},w:{en:'On a tree',hi:'पेड़ पर'}},
          {q:{en:'Why did the crow fly away?',hi:'कौआ क्यों उड़ गया?'},a:{en:'A dog barked',hi:'कुत्ता भौंका'},w:{en:'It was hungry',hi:'उसे भूख लगी'}}]},
    { art:'🚚', p:{en:"The water tanker comes on Tuesday. Amma fills three buckets. Ravi carries the small one. He spills a little every time.",
                   hi:"पानी का टैंकर मंगलवार को आता है। अम्मा तीन बाल्टी भरती हैं। रवि छोटी वाली उठाता है। हर बार थोड़ा गिर जाता है।"},
      qs:[{q:{en:'How many buckets does Amma fill?',hi:'अम्मा कितनी बाल्टी भरती हैं?'},a:{en:'Three',hi:'तीन'},w:{en:'Two',hi:'दो'}},
          {q:{en:'Which bucket does Ravi carry?',hi:'रवि कौन सी बाल्टी उठाता है?'},a:{en:'The small one',hi:'छोटी वाली'},w:{en:'The big one',hi:'बड़ी वाली'}}]},
    { art:'🎒', p:{en:"Sana lost her school bag. She looked under the bench. She looked near the gate. Her friend had picked it up by mistake.",
                   hi:"साना का बस्ता खो गया। उसने बेंच के नीचे देखा। उसने गेट के पास देखा। उसकी सहेली ग़लती से ले गई थी।"},
      qs:[{q:{en:'What did Sana lose?',hi:'साना का क्या खोया?'},a:{en:'Her school bag',hi:'उसका बस्ता'},w:{en:'Her book',hi:'उसकी किताब'}},
          {q:{en:'Who had the bag?',hi:'बस्ता किसके पास था?'},a:{en:'Her friend',hi:'उसकी सहेली'},w:{en:'The teacher',hi:'शिक्षिका'}}]}
  ],
  en3: [
    { art:'🌧️', p:{en:"It had not rained for weeks. The field was hard and grey. On Friday the clouds came, and by evening the mud was soft. The next morning, small green shoots stood in rows where Baba had put the seeds.",
                   hi:"हफ़्तों से बारिश नहीं हुई थी। खेत सख़्त और भूरा था। शुक्रवार को बादल आए, और शाम तक मिट्टी नरम हो गई। अगली सुबह, जहाँ बाबा ने बीज डाले थे, वहाँ हरे अंकुर कतार में खड़े थे।"},
      qs:[{q:{en:'What changed the hard field?',hi:'सख़्त खेत को किसने बदला?'},a:{en:'The rain',hi:'बारिश ने'},w:{en:'The sun',hi:'सूरज ने'}},
          {q:{en:'Why were the shoots in rows?',hi:'अंकुर कतार में क्यों थे?'},a:{en:'Baba planted them in rows',hi:'बाबा ने कतार में बोया'},w:{en:'The wind blew them',hi:'हवा ने किया'}}]},
    { art:'🚌', p:{en:"The bus was late again. Meera counted eleven people waiting. An old man gave up and started walking. When the bus finally came, it was so full that only four could get on. Meera was not one of them.",
                   hi:"बस फिर देर से थी। मीरा ने ग्यारह लोग गिने। एक बूढ़े आदमी ने हार मानी और पैदल चल दिया। जब बस आई, वह इतनी भरी थी कि सिर्फ़ चार लोग चढ़ सके। मीरा उनमें नहीं थी।"},
      qs:[{q:{en:'How many were waiting?',hi:'कितने लोग इंतज़ार में थे?'},a:{en:'Eleven',hi:'ग्यारह'},w:{en:'Four',hi:'चार'}},
          {q:{en:'How do you think Meera felt?',hi:'मीरा को कैसा लगा होगा?'},a:{en:'Disappointed',hi:'निराश'},w:{en:'Excited',hi:'उत्साहित'}}]},
    { art:'🪁', p:{en:"Arjun made his kite from a newspaper and two sticks. It flew well until the string caught on the neem tree. He pulled hard. The kite tore, but he kept the sticks for the next one.",
                   hi:"अर्जुन ने अख़बार और दो तीलियों से पतंग बनाई। वह अच्छी उड़ी, फिर डोर नीम के पेड़ में फँस गई। उसने ज़ोर से खींचा। पतंग फट गई, पर उसने तीलियाँ अगली के लिए रख लीं।"},
      qs:[{q:{en:'What was the kite made of?',hi:'पतंग किससे बनी थी?'},a:{en:'Newspaper and sticks',hi:'अख़बार और तीलियाँ'},w:{en:'Cloth and thread',hi:'कपड़ा और धागा'}},
          {q:{en:'Why did he keep the sticks?',hi:'उसने तीलियाँ क्यों रखीं?'},a:{en:'To make another kite',hi:'दूसरी पतंग बनाने को'},w:{en:'To burn them',hi:'जलाने के लिए'}}]}
  ],
  hi3: [
    { art:'🐘', p:{hi:"मेले में एक हाथी आया था। बच्चे उसे केला देना चाहते थे। महावत ने कहा कि हाथी अभी खा चुका है। हाथी ने सूँड उठाकर सबको नमस्ते किया।",
                   en:"An elephant came to the fair. The children wanted to give it a banana. The mahout said it had already eaten. The elephant raised its trunk and greeted everyone."},
      qs:[{q:{hi:'बच्चे हाथी को क्या देना चाहते थे?',en:'What did the children want to give?'},a:{hi:'केला',en:'A banana'},w:{hi:'रोटी',en:'Roti'}},
          {q:{hi:'हाथी ने कैसे नमस्ते किया?',en:'How did the elephant greet them?'},a:{hi:'सूँड उठाकर',en:'By raising its trunk'},w:{hi:'सिर हिलाकर',en:'By nodding'}}]},
    { art:'🌙', p:{hi:"दादी छत पर चारपाई बिछाती हैं। गर्मी की रात में हम वहीं सोते हैं। दादी चाँद की कहानियाँ सुनाती हैं। मुझे नींद आने से पहले तारे गिनना अच्छा लगता है।",
                   en:"Grandmother lays a cot on the roof. On summer nights we sleep there. She tells stories about the moon. I like counting stars before I fall asleep."},
      qs:[{q:{hi:'दादी चारपाई कहाँ बिछाती हैं?',en:'Where does grandmother lay the cot?'},a:{hi:'छत पर',en:'On the roof'},w:{hi:'आँगन में',en:'In the courtyard'}},
          {q:{hi:'सोने से पहले क्या अच्छा लगता है?',en:'What do they like before sleeping?'},a:{hi:'तारे गिनना',en:'Counting stars'},w:{hi:'गाना सुनना',en:'Listening to songs'}}]}
  ]
};

/* ---------------- grammar items ---------------- */
const GRAMMAR = {
  nouns: [
    {s:{en:'The dog ran to the gate.',hi:'कुत्ता गेट की ओर दौड़ा।'}, t:{en:'dog',hi:'कुत्ता'}, w:{en:'ran',hi:'दौड़ा'}},
    {s:{en:'Sana opened her book.',hi:'साना ने किताब खोली।'},       t:{en:'book',hi:'किताब'}, w:{en:'opened',hi:'खोली'}},
    {s:{en:'A crow sat on the wall.',hi:'कौआ दीवार पर बैठा।'},      t:{en:'wall',hi:'दीवार'}, w:{en:'sat',hi:'बैठा'}},
    {s:{en:'The bus was very full.',hi:'बस बहुत भरी थी।'},          t:{en:'bus',hi:'बस'},     w:{en:'full',hi:'भरी'}}
  ],
  verbs: [
    {s:{en:'Ravi carries the bucket.',hi:'रवि बाल्टी उठाता है।'},   t:{en:'carries',hi:'उठाता'}, w:{en:'bucket',hi:'बाल्टी'}},
    {s:{en:'The children sang loudly.',hi:'बच्चे ज़ोर से गाए।'},     t:{en:'sang',hi:'गाए'},      w:{en:'children',hi:'बच्चे'}},
    {s:{en:'Amma fills three buckets.',hi:'अम्मा तीन बाल्टी भरती हैं।'}, t:{en:'fills',hi:'भरती'}, w:{en:'three',hi:'तीन'}},
    {s:{en:'The kite tore in the tree.',hi:'पतंग पेड़ में फट गई।'},  t:{en:'tore',hi:'फट'},       w:{en:'tree',hi:'पेड़'}}
  ],
  // subject pronouns, for h3-vyakaran
  sarvanam: [
    {s:{hi:'मीरा स्कूल गई। वह देर से पहुँची।',en:'Meera went to school. She arrived late.'}, t:{hi:'वह',en:'She'}, w:{hi:'स्कूल',en:'school'}},
    {s:{hi:'बच्चे खेल रहे हैं। वे थक गए।',en:'The children are playing. They got tired.'},   t:{hi:'वे',en:'They'}, w:{hi:'बच्चे',en:'children'}},
    {s:{hi:'यह मेरी किताब है।',en:'This is my book.'},                                       t:{hi:'यह',en:'This'}, w:{hi:'किताब',en:'book'}}
  ],
  // words out of order, to be rebuilt into a sentence
  build: [
    {words:{en:['the','crow','flew','away'],hi:['कौआ','उड़','गया']},
     ans:{en:'the crow flew away',hi:'कौआ उड़ गया'}},
    {words:{en:['Ravi','carries','the','bucket'],hi:['रवि','बाल्टी','उठाता','है']},
     ans:{en:'Ravi carries the bucket',hi:'रवि बाल्टी उठाता है'}},
    {words:{en:['we','sleep','on','the','roof'],hi:['हम','छत','पर','सोते','हैं']},
     ans:{en:'we sleep on the roof',hi:'हम छत पर सोते हैं'}}
  ]
};

/* Content must not reach into the UI layer for a helper. `L()` lives in
   ui/cards.js and is not loaded when this file is tested or built, so we
   carry our own — and it falls back to the other language rather than
   returning empty, because a passage that renders blank is worse than a
   passage in the wrong language.
   A lesson in a language of its own (a school lesson from an English book,
   `lang` — core/syllabus.js) shows its passage in that language whatever the
   app's: an English lesson read in Hindi would teach nothing. */
const CL = o => { const l = (S.lesson && S.lesson.data && S.lesson.data.lang) || S.lang; return (o && (o[l] || o.en || o.hi)) || ''; };

/* ---------------- renderers for the three new beats ---------------- */
function compArt(b){
  switch(b.t){
    case 'passage':
      return `<div class="cmp-passage">
        <div class="cmp-art">${b.art || '📖'}</div>
        <p>${CL(b.p)}</p>
      </div>`;

    case 'highlight': {
      const sentence = CL(b.s), target = CL(b.t2);
      const html = sentence.split(/(\s+)/).map(w => {
        const clean = w.replace(/[.,!?।]/g,'');
        return clean && clean.toLowerCase() === target.toLowerCase()
          ? `<em class="cmp-hit">${w}</em>` : w;
      }).join('');
      return `<div class="cmp-sentence">${html}</div>
              <div class="cmp-kind">${b.kind || ''}</div>`;
    }

    case 'sentbuild':
      return `<div class="cmp-build">${(CL(b.words)||[]).map((w,i)=>
        `<span style="animation-delay:${i*0.12}s">${w}</span>`).join('')}</div>
        <div class="cmp-arrow">↓</div>
        <div class="cmp-sentence built">${CL(b.ans)}</div>`;

    default: return null;
  }
}
const COMP_SAY = {
  passage:  { en:'Read this carefully. I will ask you about it.', hi:'इसे ध्यान से पढ़ो। मैं पूछूँगी।' },
  highlight:{ en:'Look at the marked word. That is the one.',     hi:'निशान वाला शब्द देखो। वही है।' },
  sentbuild:{ en:'Put the words in order and it makes sense.',    hi:'शब्दों को क्रम में रखो, अर्थ बन जाएगा।' }
};
function compSay(b){
  const t = COMP_SAY[b.t];
  return t ? (t[S.lang] || t.en) : null;
}

/* ==================================================================
   THE CONCEPTS
   ================================================================== */
const COMP_CONCEPTS = [

{ id:'compre2', band:'developing', ic:'📖', strand:'eng', key:(p)=>'compre2-' + p.i,
  title:()=>gq('Read and answer', 'पढ़ो और जवाब दो'),
  sub:()=>gq('A short story', 'छोटी कहानी'),
  space:()=>PASSAGES.en2.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'passage', p:p.p, art:p.art},
    {t:'ask', derived:true, q:p.qs[0].q,
     opts:[p.qs[0].a.en, p.qs[0].w.en], hiOpts:[p.qs[0].a.hi, p.qs[0].w.hi], correct:0},
    {t:'passage', p:p.p, art:p.art, say:gq('Look again if you need to.','ज़रूरत हो तो फिर देखो।')},
    {t:'ask', derived:true, q:p.qs[1].q,
     opts:[p.qs[1].a.en, p.qs[1].w.en], hiOpts:[p.qs[1].a.hi, p.qs[1].w.hi], correct:0},
    {t:'win', say:gq('The answer was in the story all along.','जवाब कहानी में ही था।')}
  ]},

{ id:'compre3', band:'fluent', ic:'📚', strand:'eng', key:(p)=>'compre3-' + p.i,
  title:()=>gq('Reading closely', 'ध्यान से पढ़ना'),
  sub:()=>gq('Work out what is not said', 'जो नहीं लिखा, वह समझो'),
  space:()=>PASSAGES.en3.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'passage', p:p.p, art:p.art},
    {t:'ask', derived:true, q:p.qs[0].q,
     opts:[p.qs[0].a.en, p.qs[0].w.en], hiOpts:[p.qs[0].a.hi, p.qs[0].w.hi], correct:0},
    {t:'ask', derived:true, q:p.qs[1].q,
     opts:[p.qs[1].a.en, p.qs[1].w.en], hiOpts:[p.qs[1].a.hi, p.qs[1].w.hi], correct:0},
    {t:'win', say:gq('Some answers are hinted at, not stated.','कुछ जवाब इशारों में होते हैं।')}
  ]},

{ id:'comprehi', band:'fluent', ic:'📗', strand:'hin', key:(p)=>'comprehi-' + p.i,
  title:()=>gq('Hindi reading', 'हिंदी पढ़ना'),
  sub:()=>gq('Read and answer', 'पढ़ो और जवाब दो'),
  space:()=>PASSAGES.hi3.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'passage', p:p.p, art:p.art},
    {t:'ask', derived:true, q:p.qs[0].q,
     opts:[p.qs[0].a.en, p.qs[0].w.en], hiOpts:[p.qs[0].a.hi, p.qs[0].w.hi], correct:0},
    {t:'ask', derived:true, q:p.qs[1].q,
     opts:[p.qs[1].a.en, p.qs[1].w.en], hiOpts:[p.qs[1].a.hi, p.qs[1].w.hi], correct:0},
    {t:'win', say:gq('You read it and you understood it.','तुमने पढ़ा और समझा भी।')}
  ]},

{ id:'naming', band:'developing', ic:'🏷️', strand:'eng', key:(p)=>'naming-' + p.i,
  title:()=>gq('Naming words', 'नाम वाले शब्द'),
  sub:()=>gq('People, places, things', 'व्यक्ति, स्थान, वस्तु'),
  space:()=>GRAMMAR.nouns.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'intro', say:gq('Some words name a thing. Find it.','कुछ शब्द नाम बताते हैं। ढूँढो।')},
    {t:'highlight', s:p.s, t2:p.t, kind:'noun'},
    {t:'ask', derived:true, q:gq('Which word names a thing?','कौन सा शब्द नाम बताता है?'),
     opts:[p.t.en, p.w.en], hiOpts:[p.t.hi, p.w.hi], correct:0},
    {t:'win', say:gq('Naming words are called nouns.','नाम वाले शब्द संज्ञा कहलाते हैं।')}
  ]},

{ id:'doing', band:'fluent', ic:'🏃', strand:'eng', key:(p)=>'doing-' + p.i,
  title:()=>gq('Doing words', 'काम वाले शब्द'),
  sub:()=>gq('What is happening', 'क्या हो रहा है'),
  space:()=>GRAMMAR.verbs.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'intro', say:gq('Some words tell what happens. Find it.','कुछ शब्द बताते हैं क्या हुआ। ढूँढो।')},
    {t:'highlight', s:p.s, t2:p.t, kind:'verb'},
    {t:'ask', derived:true, q:gq('Which word shows an action?','कौन सा शब्द काम बताता है?'),
     opts:[p.t.en, p.w.en], hiOpts:[p.t.hi, p.w.hi], correct:0},
    {t:'win', say:gq('Doing words are called verbs.','काम वाले शब्द क्रिया कहलाते हैं।')}
  ]},

{ id:'sarvanam', band:'fluent', ic:'👉', strand:'hin', key:(p)=>'sarvanam-' + p.i,
  title:()=>gq('Words that replace a name', 'नाम की जगह वाले शब्द'),
  sub:()=>gq('सर्वनाम', 'सर्वनाम'),
  space:()=>GRAMMAR.sarvanam.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'intro', say:gq('One word stands in for a name. Find it.','एक शब्द नाम की जगह आता है। ढूँढो।')},
    {t:'highlight', s:p.s, t2:p.t, kind:'सर्वनाम'},
    {t:'ask', derived:true, q:gq('Which word replaces the name?','कौन सा शब्द नाम की जगह है?'),
     opts:[p.t.en, p.w.en], hiOpts:[p.t.hi, p.w.hi], correct:0},
    {t:'win', say:gq('These are called सर्वनाम.','ये सर्वनाम कहलाते हैं।')}
  ]},

{ id:'sentence', band:'fluent', ic:'🧱', strand:'eng', key:(p)=>'sentence-' + p.i,
  title:()=>gq('Building a sentence', 'वाक्य बनाना'),
  sub:()=>gq('Order makes meaning', 'क्रम से अर्थ बनता है'),
  space:()=>GRAMMAR.build.map((x,i)=>({...x,i:i+1})),
  beats:(p)=>[
    {t:'intro', say:gq('These words are jumbled. Order them.','ये शब्द बिखरे हैं। क्रम में लगाओ।')},
    {t:'sentbuild', words:p.words, ans:p.ans},
    {t:'ask', derived:true, q:gq('Does it make sense now?','अब अर्थ बनता है?'),
     opts:['Yes','No'], hiOpts:['हाँ','नहीं'], correct:0},
    {t:'readline', text:'—'},
    {t:'win', say:gq('A sentence needs the right order to mean anything.',
                     'सही क्रम के बिना वाक्य का अर्थ नहीं बनता।')}
  ]}
];

/* ---------------- register ---------------- */
const COMP_BEAT_TYPES = ['passage','highlight','sentbuild'];
if(typeof GEN_BEATS !== 'undefined')
  for(const t of COMP_BEAT_TYPES) if(!GEN_BEATS.includes(t)) GEN_BEATS.push(t);
if(typeof CONCEPTS !== 'undefined') CONCEPTS.push(...COMP_CONCEPTS);

const COMP_SKILL_MAP = {
  compre2:['e2-compre'], compre3:['e3-compre'], comprehi:['h3-compre'],
  naming:['e2-noun'],    doing:['e3-verb'],     sarvanam:['h3-vyakaran'],
  sentence:['e3-para']
};
if(typeof SKILLS !== 'undefined'){
  for(const [c, ids] of Object.entries(COMP_SKILL_MAP))
    for(const id of ids){
      const s = SKILLS.find(x => x.id === id);
      if(s && !s.concepts.includes(c)) s.concepts.push(c);
    }
}
