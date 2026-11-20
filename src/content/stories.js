/* ==================================================================
   STORIES — how Nursery and LKG children (3–4) use Takhti.

   A three-year-old can't read a menu or find their way around an app, so
   the youngest don't get the jungle map: they get short stories told by
   Munni (ui/story-time.js plays them). But not stories to only watch —
   young children learn noticeably less from watching alone than from a
   person, and "engaged viewing" (stopping to ask, and answering) is what
   made preschool television work. So every story has one or two moments
   where the child joins in, none of which needs reading:

     count  tap anywhere on the picture — one tap, one thing, Munni says
            the number; if the child stops, Munni counts the rest herself
     pick   two big pictures, tap one — the first tap is real evidence for
            the story's skill (noteSkillAttempt → the twin and the mind);
            a wrong tap is shown kindly and the story goes on
     say    Munni says a word and the child says it back — nothing is
            recorded or sent; it is joining in, not a test

   Each story also carries a line for the grown-up watching with the child
   ("ask her: how many mangoes on your table?") and one thing to do away
   from the screen afterwards.

   Built from code, like the cartoon episodes (core/generative-brain.js):
   a template plus a seed (the child, the day, how many times it has been
   played) picks the objects and numbers, so one template is many stories
   and nothing needs drawing or filming. Every line is in Hindi and English.

   Stage format (drawn by storyStageHTML() in ui/story-time.js):
     { bg, big, items:[{ id, ic | shape+color, x, y (centre, % of the
       stage), size (px), anim, d (delay, s), hide }] }
   ================================================================== */

const NUMW = {
  en: ['zero','one','two','three','four','five','six','seven','eight','nine','ten'],
  hi: ['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस']
};

/* Things to count: a picture, and how each language says one / many. */
const STORY_THINGS = [
  { ic:'🥭', en:['mango','mangoes'],   hi:['आम','आम'],         tree:true },
  { ic:'🍎', en:['apple','apples'],    hi:['सेब','सेब'],        tree:true },
  { ic:'🍋', en:['lemon','lemons'],    hi:['नींबू','नींबू'],     tree:true },
  { ic:'🐦', en:['bird','birds'],      hi:['चिड़िया','चिड़ियाँ'] },
  { ic:'⭐', en:['star','stars'],      hi:['तारा','तारे'] },
  { ic:'🐟', en:['fish','fish'],       hi:['मछली','मछलियाँ'] },
  { ic:'🌸', en:['flower','flowers'],  hi:['फूल','फूल'] },
  { ic:'🥚', en:['egg','eggs'],        hi:['अंडा','अंडे'] }
];

const STORY_COLOURS = [
  { color:'#E5483B', en:'red',    hi:'लाल' },
  { color:'#F2C230', en:'yellow', hi:'पीला' },
  { color:'#3B7BE5', en:'blue',   hi:'नीला' },
  { color:'#3AA65B', en:'green',  hi:'हरा' }
];

const STORY_SHAPES = [
  { shape:'circle',   en:'circle',   hi:'गोला',   thing:{ ic:'☀️', en:'The sun is round, like a circle.',       hi:'सूरज गोल है, गोले जैसा।' } },
  { shape:'square',   en:'square',   hi:'चौकोर',  thing:{ ic:'🪟', en:'The window is a square.',                hi:'खिड़की चौकोर है।' } },
  { shape:'triangle', en:'triangle', hi:'तिकोन',  thing:{ ic:'⛺', en:'The tent is a triangle, with three sides.', hi:'तंबू तिकोना है, उसकी तीन भुजाएँ हैं।' } }
];

/* Big and small: the same kind of contrast a nursery book draws. */
const STORY_SIZES = [
  { big:{ ic:'🐘', en:'elephant', hi:'हाथी' }, small:{ ic:'🐭', en:'mouse',  hi:'चूहा' } },
  { big:{ ic:'🌳', en:'tree',     hi:'पेड़' },  small:{ ic:'🌱', en:'plant',  hi:'पौधा' } },
  { big:{ ic:'🚌', en:'bus',      hi:'बस' },    small:{ ic:'🚲', en:'cycle',  hi:'साइकिल' } },
  { big:{ ic:'🐄', en:'cow',      hi:'गाय' },   small:{ ic:'🐥', en:'chick',  hi:'चूज़ा' } }
];

/* Rhymes with pictures. The odd one out never rhymes with the pair. */
const STORY_RHYMES = {
  en: [ { a:{ ic:'🐱', w:'cat' },  b:{ ic:'🎩', w:'hat' },  odd:{ ic:'🐶', w:'dog' } },
        { a:{ ic:'🐝', w:'bee' },  b:{ ic:'🌳', w:'tree' }, odd:{ ic:'⚽', w:'ball' } },
        { a:{ ic:'⭐', w:'star' }, b:{ ic:'🚗', w:'car' },  odd:{ ic:'🐟', w:'fish' } },
        { a:{ ic:'🐸', w:'frog' }, b:{ ic:'🪵', w:'log' },  odd:{ ic:'☀️', w:'sun' } } ],
  hi: [ { a:{ ic:'🔒', w:'ताला' }, b:{ ic:'📿', w:'माला' }, odd:{ ic:'🐟', w:'मछली' } },
        { a:{ ic:'⛵', w:'नाव' },  b:{ ic:'🏡', w:'गाँव' }, odd:{ ic:'⚽', w:'गेंद' } },
        { a:{ ic:'🥭', w:'आम' },   b:{ ic:'🌇', w:'शाम' },  odd:{ ic:'☀️', w:'सूरज' } } ]
};

/* First sounds. English: the letter's sound and a word that starts with
   it. Hindi: the स्वर, as the Nursery/LKG Hindi book teaches them. */
const STORY_LETTERS = {
  en: [ { l:'a', ic:'🍎', w:'apple' }, { l:'b', ic:'⚽', w:'ball' },  { l:'c', ic:'🐱', w:'cat' },
        { l:'d', ic:'🐶', w:'dog' },   { l:'f', ic:'🐟', w:'fish' },  { l:'s', ic:'☀️', w:'sun' },
        { l:'m', ic:'🥭', w:'mango' } ],
  hi: [ { l:'अ', ic:'🍇', w:'अंगूर' }, { l:'आ', ic:'🥭', w:'आम' },  { l:'इ', ic:'🚂', w:'इंजन' },
        { l:'उ', ic:'🦉', w:'उल्लू' }, { l:'ऊ', ic:'🧶', w:'ऊन' } ]
};

/* What a letter SAYS, written so a voice says the sound, not the letter's
   name ("c" read aloud is "see"; the sound a child blends is "kuh"). */
const STORY_SOUND = { a:'aah', b:'buh', c:'kuh', d:'duh', e:'eh', f:'fff', g:'guh', h:'huh', i:'ih', m:'mmm', n:'nnn', o:'aw', p:'puh', s:'sss', t:'tuh', u:'uh' };

/* UKG: adding and taking away with pictures. How each thing arrives, and
   in Hindi the verb that agrees with it (चिड़ियाँ आईं, चूज़े आए). */
const STORY_ADDERS = [
  { ic:'🐦', en:['bird','birds'],   hi:['चिड़िया','चिड़ियाँ'], come:{ en:'fly in', hi:'उड़कर आईं' }, many:'कितनी' },
  { ic:'🐟', en:['fish','fish'],    hi:['मछली','मछलियाँ'],   come:{ en:'swim up', hi:'तैरकर आईं' }, many:'कितनी' },
  { ic:'🐥', en:['chick','chicks'], hi:['चूज़ा','चूज़े'],     come:{ en:'run in', hi:'दौड़कर आए' }, many:'कितने' }
];
const STORY_EATS = [
  { ic:'🍌', en:['banana','bananas'],   hi:['केला','केले'] },
  { ic:'🍪', en:['biscuit','biscuits'], hi:['बिस्किट','बिस्किट'] },
  { ic:'🥭', en:['mango','mangoes'],    hi:['आम','आम'] }
];

/* UKG: blending. A word said in its sounds, and a picture that starts the
   same way — so the first sound alone can't give the answer away. English
   words are three sounds (c-a-t); Hindi words are letters without मात्रा
   (क-म-ल → कमल), as UKG's Hindi book blends them. */
const STORY_BLENDS = {
  en: [ { s:['c','a','t'], w:'cat', ic:'🐱', odd:{ w:'cup',  ic:'☕' } },
        { s:['h','e','n'], w:'hen', ic:'🐔', odd:{ w:'hat',  ic:'🎩' } },
        { s:['p','i','g'], w:'pig', ic:'🐷', odd:{ w:'pen',  ic:'🖊️' } },
        { s:['b','u','s'], w:'bus', ic:'🚌', odd:{ w:'bat',  ic:'🦇' } },
        { s:['s','u','n'], w:'sun', ic:'☀️', odd:{ w:'sock', ic:'🧦' } },
        { s:['d','o','g'], w:'dog', ic:'🐶', odd:{ w:'duck', ic:'🦆' } },
        { s:['m','a','p'], w:'map', ic:'🗺️', odd:{ w:'man',  ic:'👨' } } ],
  hi: [ { s:['क','म','ल'], w:'कमल', ic:'🪷', odd:{ w:'कलम', ic:'🖊️' } },
        { s:['ब','त','ख'], w:'बतख', ic:'🦆', odd:{ w:'बस',  ic:'🚌' } },
        { s:['न','ल'],     w:'नल',  ic:'🚰', odd:{ w:'नमक', ic:'🧂' } },
        { s:['श','ह','द'], w:'शहद', ic:'🍯', odd:{ w:'शरबत', ic:'🥤' } },
        { s:['क','प'],     w:'कप',  ic:'☕', odd:{ w:'कमल', ic:'🪷' } } ]
};

/* Little tales for listening (n-listen): who did what. */
const STORY_TALES = [
  { ic:'🐦', helper:{ ic:'🐘', en:'Munni the elephant', hi:'मुन्नी हाथी' }, other:{ ic:'🦁', en:'the lion', hi:'शेर' },
    lines:[ { en:'A little bird was thirsty. The pond was too deep for her.', hi:'एक छोटी चिड़िया को प्यास लगी थी। तालाब बहुत गहरा था।' },
            { en:'Munni filled her trunk with water, and gave the bird a drink. Splash!', hi:'मुन्नी ने सूँड़ में पानी भरा और चिड़िया को पिलाया। छपाक!' } ],
    q:{ en:'Who gave the bird water?', hi:'चिड़िया को पानी किसने पिलाया?' } },
  { ic:'🐶', helper:{ ic:'🐄', en:'the cow', hi:'गाय' }, other:{ ic:'🐒', en:'the monkey', hi:'बंदर' },
    lines:[ { en:'A puppy was lost in the rain. He could not find his home.', hi:'बारिश में एक पिल्ला खो गया। उसे अपना घर नहीं मिल रहा था।' },
            { en:'The kind cow said, "Walk with me!" and took him home.', hi:'प्यारी गाय बोली, "मेरे साथ चलो!" और उसे घर पहुँचा दिया।' } ],
    q:{ en:'Who took the puppy home?', hi:'पिल्ले को घर कौन ले गया?' } }
];

function storyRand(seed){ let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
function storyPick(r, arr){ return arr[Math.floor(r() * arr.length)]; }
const storyN = (k, n, lang) => (lang === 'hi' ? k.hi : k.en)[n === 1 ? 0 : 1];
const both = (en, hi) => ({ en, hi });

/* A group of n pictures laid out in a neat block (for a "which has n?" card). */
function storyGroup(ic, n){ return { group: true, ic, n }; }

/* ---------- the templates ----------
   classes: who is offered it (by class id). skill(o): the skill its pick
   moment is evidence for (o.cls, o.lang). build(r, o) → the story body. */
const STORY_TPLS = {

  /* Counting: things fall from a tree, one per tap. */
  fall: {
    classes: ['nur','lkg','ukg'], ic: '🌳',
    skill: o => o.cls === 'nur' ? 'n-count5' : 'l-count10',
    title: both('The counting tree', 'गिनती वाला पेड़'),
    build(r, o){
      const k = storyPick(r, STORY_THINGS.filter(t => t.tree));
      const max = o.cls === 'nur' ? 5 : 9, min = o.cls === 'nur' ? 2 : 5;
      const n = min + Math.floor(r() * (max - min + 1));
      const spots = [[34,22],[50,14],[66,22],[42,32],[58,32],[30,36],[70,36],[50,26],[38,16]];
      const items = Array.from({ length: n }, (_, i) => ({ id:'f'+i, ic:k.ic, x:spots[i][0], y:spots[i][1], size:30, anim:'sway', d:i*0.12 }));
      const ground = Array.from({ length: n }, (_, i) => ({ x: 50 + (i - (n - 1) / 2) * Math.min(10, 80 / n), y: 82 }));
      let other = n + (r() < 0.5 ? -2 : 2); if(other < 1) other = n + 2; if(other > max + 1) other = n - 2;
      const right = r() < 0.5 ? 0 : 1, groups = [n, other]; if(right) groups.reverse();
      return {
        bg: 'tree',
        scenes: [
          { say: both(`Look, ${o.name}! A big tree, full of ${k.en[1]}. They are ready to fall!`,
                      `देखो ${o.name}! एक बड़ा पेड़, ${k.hi[1]} से भरा हुआ। वे गिरने वाले हैं!`),
            stage: { items } },
          { say: both(`Tap anywhere, and one ${k.en[0]} falls down. Let's count together!`,
                      `कहीं भी छुओ, और एक ${k.hi[0]} नीचे गिरेगा। चलो साथ में गिनें!`),
            stage: { items },
            join: { t:'count', seq: items.map(it => it.id), to: ground, n } },
          { say: both(`${NUMW.en[n][0].toUpperCase() + NUMW.en[n].slice(1)} ${storyN(k, n, 'en')}! We counted them all.`,
                      `${NUMW.hi[n]} ${storyN(k, n, 'hi')}! हमने सब गिन लिए।`),
            stage: { big: String(n), items: items.map((it, i) => Object.assign({}, it, ground[i], { anim:'pop', d:0 })) } },
          { say: both(`Munni has two baskets. Which basket has ${NUMW.en[n]} ${storyN(k, n, 'en')}?`,
                      `मुन्नी के पास दो टोकरियाँ हैं। किस टोकरी में ${NUMW.hi[n]} ${storyN(k, n, 'hi')} हैं?`),
            join: { t:'pick', opts: groups.map(g => storyGroup(k.ic, g)), right,
                    praise: both(`Yes! ${NUMW.en[n]} ${storyN(k, n, 'en')}. Well counted!`, `हाँ! ${NUMW.hi[n]} ${storyN(k, n, 'hi')}। बहुत अच्छा गिना!`),
                    show: both(`This one has ${NUMW.en[n]}. Let's count it: ${NUMW.en.slice(1, n + 1).join(', ')}.`,
                               `इसमें ${NUMW.hi[n]} हैं। चलो गिनें: ${NUMW.hi.slice(1, n + 1).join(', ')}।`) } },
          { say: both(`Munni puts the ${k.en[1]} in her basket. Yum! Thank you for counting, ${o.name}.`,
                      `मुन्नी ने ${k.hi[1]} अपनी टोकरी में रख लिए। वाह! गिनने के लिए धन्यवाद, ${o.name}।`),
            stage: { items: [{ id:'bk', ic:'🧺', x:50, y:62, size:64, anim:'pop' }, { id:'mu', ic:'🐘', x:24, y:62, size:54, anim:'bob' }] } }
        ],
        grownup: both(`Count ${n} things at home together — spoons, shoes, steps. Touch each one as you say its number.`,
                      `घर पर साथ में ${n} चीज़ें गिनें — चम्मच, जूते, सीढ़ियाँ। हर चीज़ को छूकर उसकी गिनती बोलें।`),
        home: both(`Ask: "Can you bring me ${n} spoons?"`, `पूछें: "क्या तुम मुझे ${n} चम्मच ला सकते हो?"`)
      };
    }
  },

  /* Big and small. */
  sizes: {
    classes: ['nur','lkg'], ic: '🐘',
    skill: () => 'n-big',
    title: both('Big and small', 'बड़ा और छोटा'),
    build(r, o){
      const p = storyPick(r, STORY_SIZES);
      const askBig = r() < 0.5;
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ ic:p.big.ic, size:84 }, { ic:p.small.ic, size:34 }];
      const correctOpt = askBig ? 0 : 1;
      if(right !== correctOpt) opts.reverse();
      return {
        bg: 'plain',
        scenes: [
          { say: both(`This is a ${p.big.en}. It is big! Very, very big.`, `यह ${p.big.hi} है। यह बड़ा है! बहुत बड़ा।`),
            stage: { items: [{ id:'b', ic:p.big.ic, x:50, y:52, size:120, anim:'grow' }] } },
          { say: both(`And this is a ${p.small.en}. It is small. Tiny!`, `और यह ${p.small.hi} है। यह छोटा है। नन्हा सा!`),
            stage: { items: [{ id:'s', ic:p.small.ic, x:50, y:62, size:40, anim:'pop' }] } },
          { say: both(`Say it with Munni: big… and small!`, `मुन्नी के साथ बोलो: बड़ा… और छोटा!`),
            stage: { items: [{ id:'b', ic:p.big.ic, x:32, y:52, size:110 }, { id:'s', ic:p.small.ic, x:72, y:66, size:36 }] },
            join: { t:'say', word: both('big… small', 'बड़ा… छोटा') } },
          { say: both(askBig ? 'Now tap the BIG one!' : 'Now tap the SMALL one!', askBig ? 'अब बड़े वाले को छुओ!' : 'अब छोटे वाले को छुओ!'),
            join: { t:'pick', opts, right,
                    praise: both(askBig ? `Yes, the ${p.big.en} is big!` : `Yes, the ${p.small.en} is small!`,
                                 askBig ? `हाँ, ${p.big.hi} बड़ा है!` : `हाँ, ${p.small.hi} छोटा है!`),
                    show: both(askBig ? `This one is big — the ${p.big.en}.` : `This one is small — the ${p.small.en}.`,
                               askBig ? `यह वाला बड़ा है — ${p.big.hi}।` : `यह वाला छोटा है — ${p.small.hi}।`) } }
        ],
        grownup: both('Find something big and something small in the room together, and say "big" and "small".',
                      'कमरे में साथ मिलकर कोई बड़ी और कोई छोटी चीज़ ढूँढें, और "बड़ा", "छोटा" बोलें।'),
        home: both('Put a big spoon and a small spoon side by side. Ask: "Which one is big?"',
                   'एक बड़ा और एक छोटा चम्मच साथ रखें। पूछें: "बड़ा कौन सा है?"')
      };
    }
  },

  /* Circle, square, triangle. */
  shapes: {
    classes: ['nur','lkg'], ic: '🔺',
    skill: () => 'n-shapes',
    title: both('Shapes all around', 'चारों ओर आकार'),
    build(r, o){
      const order = STORY_SHAPES.slice();
      const ask = storyPick(r, order), other = storyPick(r, order.filter(s => s !== ask));
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ shape:ask.shape, color:'#E8963A', size:86 }, { shape:other.shape, color:'#E8963A', size:86 }];
      if(right) opts.reverse();
      return {
        bg: 'sky',
        scenes: order.map(s => ({
          say: both(`${s.thing.en} A ${s.en}!`, `${s.thing.hi} ${s.hi}!`),
          stage: { items: [{ id:'t', ic:s.thing.ic, x:32, y:52, size:76, anim:'pop' },
                           { id:'s', shape:s.shape, color:'#E8963A', x:70, y:52, size:80, anim:'grow', d:0.4 }] }
        })).concat([
          { say: both(`Which one is the ${ask.en}? Tap it!`, `${ask.hi} कौन सा है? उसे छुओ!`),
            join: { t:'pick', opts, right,
                    praise: both(`Yes! That is a ${ask.en}.`, `हाँ! यह ${ask.hi} है।`),
                    show: both(`This is the ${ask.en}.`, `यह ${ask.hi} है।`) } }
        ]),
        grownup: both('Look for a circle, a square and a triangle at home — a plate, a book, a slice of sandwich.',
                      'घर में गोला, चौकोर और तिकोन ढूँढें — थाली, किताब, सैंडविच का टुकड़ा।'),
        home: both(`Ask: "Can you find something shaped like a ${ask.en}?"`, `पूछें: "क्या तुम ${ask.hi} जैसी कोई चीज़ ढूँढ सकते हो?"`)
      };
    }
  },

  /* Colours (sorting by colour). */
  colours: {
    classes: ['nur','lkg'], ic: '🎈',
    skill: () => 'n-sort',
    title: both("Gauri's balloons", 'गौरी के गुब्बारे'),
    build(r, o){
      const a = storyPick(r, STORY_COLOURS), b = storyPick(r, STORY_COLOURS.filter(c => c !== a));
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ shape:'balloon', color:a.color, size:96 }, { shape:'balloon', color:b.color, size:96 }];
      if(right) opts.reverse();
      return {
        bg: 'sky',
        scenes: [
          { say: both(`Gauri has balloons! This one is ${a.en}.`, `गौरी के पास गुब्बारे हैं! यह वाला ${a.hi} है।`),
            stage: { items: [{ id:'a', shape:'balloon', color:a.color, x:50, y:46, size:110, anim:'float' }] } },
          { say: both(`Say it with Munni: ${a.en}!`, `मुन्नी के साथ बोलो: ${a.hi}!`),
            stage: { items: [{ id:'a', shape:'balloon', color:a.color, x:50, y:46, size:110, anim:'float' }] },
            join: { t:'say', word: both(a.en, a.hi) } },
          { say: both(`And this one is ${b.en}.`, `और यह वाला ${b.hi} है।`),
            stage: { items: [{ id:'a', shape:'balloon', color:a.color, x:34, y:46, size:96, anim:'float' },
                             { id:'b', shape:'balloon', color:b.color, x:66, y:46, size:96, anim:'float', d:0.3 }] } },
          { say: both(`Which balloon is ${a.en}? Tap it!`, `कौन सा गुब्बारा ${a.hi} है? उसे छुओ!`),
            join: { t:'pick', opts, right,
                    praise: both(`Yes! The ${a.en} balloon. Up it goes!`, `हाँ! ${a.hi} गुब्बारा। ऊपर उड़ चला!`),
                    show: both(`This one is ${a.en}.`, `यह वाला ${a.hi} है।`) } }
        ],
        grownup: both(`Find three ${a.en} things at home together.`, `घर में साथ मिलकर तीन ${a.hi} चीज़ें ढूँढें।`),
        home: both('Sort socks or blocks into piles by colour together.', 'साथ मिलकर मोज़े या खिलौने रंग के हिसाब से अलग-अलग ढेर में रखें।')
      };
    }
  },

  /* Rhyming words. */
  rhyme: {
    classes: ['nur','lkg'], ic: '🎵',
    skill: () => 'n-rhyme',
    title: both('Words that sound the same', 'एक जैसी आवाज़ वाले शब्द'),
    build(r, o){
      const lang = o.lang === 'hi' ? 'hi' : 'en';
      const p = storyPick(r, STORY_RHYMES[lang]);
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ ic:p.b.ic, size:84, word:p.b.w }, { ic:p.odd.ic, size:84, word:p.odd.w }];
      if(right) opts.reverse();
      const say = lang === 'hi'
        ? [both(`Listen: ${p.a.w}… ${p.b.w}. They sound the same at the end!`, `सुनो: ${p.a.w}… ${p.b.w}। इनकी आवाज़ आख़िर में एक जैसी है!`),
           both(`Which one sounds like ${p.a.w}? ${opts[0].word}, or ${opts[1].word}?`, `कौन सा ${p.a.w} जैसा सुनाई देता है? ${opts[0].word}, या ${opts[1].word}?`)]
        : [both(`Listen: ${p.a.w}… ${p.b.w}. They sound the same at the end!`, `सुनो: ${p.a.w}… ${p.b.w}। इनकी आवाज़ आख़िर में एक जैसी है!`),
           both(`Which one sounds like ${p.a.w}? ${opts[0].word}, or ${opts[1].word}?`, `कौन सा ${p.a.w} जैसा सुनाई देता है? ${opts[0].word}, या ${opts[1].word}?`)];
      return {
        bg: 'plain', lang,
        scenes: [
          { say: say[0],
            stage: { items: [{ id:'a', ic:p.a.ic, x:32, y:50, size:84, anim:'pop', label:p.a.w },
                             { id:'b', ic:p.b.ic, x:68, y:50, size:84, anim:'pop', d:0.6, label:p.b.w }] } },
          { say: both('Now you say them with Munni!', 'अब तुम मुन्नी के साथ बोलो!'),
            stage: { items: [{ id:'a', ic:p.a.ic, x:32, y:50, size:84, label:p.a.w }, { id:'b', ic:p.b.ic, x:68, y:50, size:84, label:p.b.w }] },
            join: { t:'say', word: both(`${p.a.w}… ${p.b.w}`, `${p.a.w}… ${p.b.w}`) } },
          { say: say[1],
            join: { t:'pick', opts, right,
                    praise: both(`Yes! ${p.a.w}, ${p.b.w} — they rhyme!`, `हाँ! ${p.a.w}, ${p.b.w} — इनकी तुक मिलती है!`),
                    show: both(`Listen: ${p.a.w}… ${p.b.w}. These two sound the same.`, `सुनो: ${p.a.w}… ${p.b.w}। ये दोनों एक जैसे सुनाई देते हैं।`) } }
        ],
        grownup: both(`Play a rhyme game: say "${p.a.w}" and take turns finding words that sound the same.`,
                      `तुकबंदी का खेल खेलें: "${p.a.w}" बोलें और बारी-बारी से उससे मिलते शब्द ढूँढें।`),
        home: both('Sing a rhyme you both know, and stop before the rhyming word — let your child finish it.',
                   'कोई कविता साथ गाएँ, और तुक वाले शब्द से पहले रुक जाएँ — बच्चे को पूरा करने दें।')
      };
    }
  },

  /* A little tale and one question about it (listening). */
  tale: {
    classes: ['nur','lkg','ukg'], ic: '📖',
    skill: () => 'n-listen',
    title: both('A little story', 'एक छोटी कहानी'),
    build(r, o){
      const tl = storyPick(r, STORY_TALES);
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ ic:tl.helper.ic, size:90 }, { ic:tl.other.ic, size:90 }];
      if(right) opts.reverse();
      return {
        bg: 'pond',
        scenes: [
          { say: tl.lines[0], stage: { items: [{ id:'h', ic:tl.ic, x:46, y:58, size:70, anim:'bob' }] } },
          { say: tl.lines[1], stage: { items: [{ id:'h', ic:tl.ic, x:62, y:58, size:60, anim:'bob' },
                                               { id:'p', ic:tl.helper.ic, x:30, y:56, size:96, anim:'pop', d:0.3 }] } },
          { say: tl.q,
            join: { t:'pick', opts, right,
                    praise: both(`Yes! It was ${tl.helper.en}. You listened so well!`, `हाँ! ${tl.helper.hi} ने। तुमने बहुत ध्यान से सुना!`),
                    show: both(`It was ${tl.helper.en}.`, `${tl.helper.hi} ने।`) } }
        ],
        grownup: both(`Ask your child to tell you the story again, in their own words: "${tl.q.en}"`,
                      `बच्चे से कहें कि कहानी अपने शब्दों में फिर सुनाए: "${tl.q.hi}"`),
        home: both('At bedtime, ask: "What happened in Munni\'s story today?"', 'सोते समय पूछें: "आज मुन्नी की कहानी में क्या हुआ?"')
      };
    }
  },

  /* More and fewer. */
  more: {
    classes: ['lkg','ukg'], ic: '🍬',
    skill: () => 'l-more',
    title: both('Who has more?', 'किसके पास ज़्यादा?'),
    build(r, o){
      const a = 1 + Math.floor(r() * 3), b = a + 2 + Math.floor(r() * 3);      // always at least 2 apart
      const askMore = r() < 0.7;
      const right = r() < 0.5 ? 0 : 1;
      const opts = [storyGroup('🍬', askMore ? b : a), storyGroup('🍬', askMore ? a : b)];
      if(right) opts.reverse();
      return {
        bg: 'room',
        scenes: [
          { say: both('Munni and Gauri each have a plate of sweets.', 'मुन्नी और गौरी, दोनों के पास मिठाई की एक-एक थाली है।'),
            stage: { items: [{ id:'m', ic:'🐘', x:28, y:46, size:64, anim:'bob' }, { id:'g', ic:'🐦', x:72, y:46, size:56, anim:'bob', d:0.3 }] } },
          { say: both(askMore ? 'Which plate has MORE sweets? Tap it!' : 'Which plate has FEWER sweets? Tap it!',
                      askMore ? 'किस थाली में ज़्यादा मिठाई है? उसे छुओ!' : 'किस थाली में कम मिठाई है? उसे छुओ!'),
            join: { t:'pick', opts, right,
                    praise: both(askMore ? 'Yes! That plate has more.' : 'Yes! That plate has fewer.', askMore ? 'हाँ! उस थाली में ज़्यादा है।' : 'हाँ! उस थाली में कम है।'),
                    show: both(askMore ? `This plate has more — ${NUMW.en[b]}, and the other has ${NUMW.en[a]}.` : `This plate has fewer — ${NUMW.en[a]}, and the other has ${NUMW.en[b]}.`,
                               askMore ? `इस थाली में ज़्यादा है — ${NUMW.hi[b]}, और दूसरी में ${NUMW.hi[a]}।` : `इस थाली में कम है — ${NUMW.hi[a]}, और दूसरी में ${NUMW.hi[b]}।`) } },
          { say: both('Munni shares, so both plates have the same. Sharing is fun!', 'मुन्नी बाँट देती है, अब दोनों थालियों में बराबर है। बाँटने में मज़ा है!'),
            stage: { items: [{ id:'m', ic:'🐘', x:28, y:50, size:60, anim:'bob' }, { id:'g', ic:'🐦', x:72, y:50, size:52, anim:'bob' }, { id:'h', ic:'💛', x:50, y:34, size:44, anim:'pop' }] } }
        ],
        grownup: both('At snack time, make two small piles and ask which has more.', 'नाश्ते के समय दो छोटे ढेर बनाएँ और पूछें किसमें ज़्यादा है।'),
        home: both('Ask: "Who has more — you or me?" with grapes or biscuits.', 'अंगूर या बिस्किट से पूछें: "किसके पास ज़्यादा है — तुम्हारे या मेरे?"')
      };
    }
  },

  /* Patterns. */
  pattern: {
    classes: ['lkg','ukg'], ic: '🌼',
    skill: () => 'l-pattern',
    title: both("Munni's garland", 'मुन्नी की माला'),
    build(r, o){
      const a = storyPick(r, STORY_COLOURS), b = storyPick(r, STORY_COLOURS.filter(c => c !== a));
      const row = [a, b, a, b, a];
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ shape:'flower', color:b.color, size:80 }, { shape:'flower', color:a.color, size:80 }];
      if(right) opts.reverse();
      return {
        bg: 'plain',
        scenes: [
          { say: both(`Munni is making a garland: ${a.en}, ${b.en}, ${a.en}, ${b.en}, ${a.en}…`, `मुन्नी माला बना रही है: ${a.hi}, ${b.hi}, ${a.hi}, ${b.hi}, ${a.hi}…`),
            stage: { items: row.map((c, i) => ({ id:'p'+i, shape:'flower', color:c.color, x:14 + i * 15, y:50, size:52, anim:'pop', d:i*0.35 }))
                     .concat([{ id:'q', ic:'❓', x:89, y:50, size:46, anim:'bob' }]) } },
          { say: both('Say it with Munni!', 'मुन्नी के साथ बोलो!'),
            stage: { items: row.map((c, i) => ({ id:'p'+i, shape:'flower', color:c.color, x:14 + i * 15, y:50, size:52 })).concat([{ id:'q', ic:'❓', x:89, y:50, size:46 }]) },
            join: { t:'say', word: both(`${a.en}, ${b.en}, ${a.en}, ${b.en}`, `${a.hi}, ${b.hi}, ${a.hi}, ${b.hi}`) } },
          { say: both('What comes next? Tap it!', 'आगे कौन सा आएगा? उसे छुओ!'),
            join: { t:'pick', opts, right,
                    praise: both(`Yes! ${b.en} comes next. What a pretty garland!`, `हाँ! अब ${b.hi} आएगा। कितनी सुंदर माला!`),
                    show: both(`${a.en}, ${b.en}, ${a.en}, ${b.en}… next comes ${b.en}.`, `${a.hi}, ${b.hi}, ${a.hi}, ${b.hi}… अब ${b.hi} आएगा।`) } }
        ],
        grownup: both('Make a pattern together with spoons and forks, or two colours of blocks.', 'चम्मच-काँटे या दो रंग के खिलौनों से साथ में पैटर्न बनाएँ।'),
        home: both('Clap, stamp, clap, stamp… and let your child carry on the pattern.', 'ताली, पैर, ताली, पैर… और बच्चे को पैटर्न आगे बढ़ाने दें।')
      };
    }
  },

  /* First sounds — English letters, or Hindi स्वर. */
  letter: {
    classes: ['lkg','ukg'], ic: '🔤',
    skill: o => o.lang === 'hi' ? 'l-swar' : 'l-sound',
    title: both('First sounds', 'पहली आवाज़'),
    build(r, o){
      const lang = o.lang === 'hi' ? 'hi' : 'en';
      const L = storyPick(r, STORY_LETTERS[lang]), odd = storyPick(r, STORY_LETTERS[lang].filter(x => x !== L));
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ ic:L.ic, size:84, word:L.w }, { ic:odd.ic, size:84, word:odd.w }];
      if(right) opts.reverse();
      const en = lang === 'en';
      const snd = en ? (STORY_SOUND[L.l] || L.l) : L.l;   // the sound, not the letter's name
      return {
        bg: 'plain', lang,
        scenes: [
          { say: en ? both(`This is the letter ${L.l}. It says "${snd}"… "${snd}"… like ${L.w}!`, `यह अक्षर ${L.l} है। इसकी आवाज़ है "${snd}"… जैसे ${L.w}!`)
                    : both(`This is ${L.l}. ${L.l} for ${L.w}!`, `यह ${L.l} है। ${L.l} से ${L.w}!`),
            stage: { big: L.l, items: [{ id:'w', ic:L.ic, x:74, y:56, size:80, anim:'pop', d:0.8, label:L.w }] } },
          { say: both('Say it with Munni!', 'मुन्नी के साथ बोलो!'),
            stage: { big: L.l, items: [{ id:'w', ic:L.ic, x:74, y:56, size:80, label:L.w }] },
            join: { t:'say', word: en ? both(`${snd}… ${snd}… ${L.w}`, `${snd}… ${snd}… ${L.w}`) : both(`${L.l} से ${L.w}`, `${L.l} से ${L.w}`) } },
          { say: en ? both(`Which one starts with "${L.l}"? ${opts[0].word}, or ${opts[1].word}?`, `कौन सा "${L.l}" से शुरू होता है? ${opts[0].word}, या ${opts[1].word}?`)
                    : both(`Which one starts with ${L.l}? ${opts[0].word}, or ${opts[1].word}?`, `कौन सा ${L.l} से शुरू होता है? ${opts[0].word}, या ${opts[1].word}?`),
            join: { t:'pick', opts, right,
                    praise: both(`Yes! ${L.w} starts with ${L.l}.`, `हाँ! ${L.w} ${L.l} से शुरू होता है।`),
                    show: both(`${L.w} starts with ${L.l}. Listen: ${L.w}.`, `${L.w} ${L.l} से शुरू होता है। सुनो: ${L.w}।`) } }
        ],
        grownup: en ? both(`Play "I spy": find things at home that start with "${L.l}".`, `"मैं देख रहा हूँ" खेलें: घर में "${L.l}" से शुरू होने वाली चीज़ें ढूँढें।`)
                    : both(`Find things at home whose names start with ${L.l}.`, `घर में ऐसी चीज़ें ढूँढें जिनके नाम ${L.l} से शुरू होते हैं।`),
        home: en ? both(`Draw a big "${L.l}" in the air together with your fingers.`, `साथ मिलकर उँगली से हवा में बड़ा "${L.l}" बनाएँ।`)
                 : both(`Draw a big ${L.l} in the air together with your fingers.`, `साथ मिलकर उँगली से हवा में बड़ा ${L.l} बनाएँ।`)
      };
    }
  },

  /* A number and the group that shows it. */
  match: {
    classes: ['lkg','ukg'], ic: '🪺',
    skill: () => 'l-match',
    title: both('Eggs in the nest', 'घोंसले में अंडे'),
    build(r, o){
      const n = 2 + Math.floor(r() * 7);                            // 2..8
      let other = n + (r() < 0.5 ? -2 : 2); if(other < 1 || other > 10) other = n + (other < 1 ? 2 : -2);
      const right = r() < 0.5 ? 0 : 1, groups = [n, other]; if(right) groups.reverse();
      return {
        bg: 'tree',
        scenes: [
          { say: both(`Gauri is holding a card. It says ${NUMW.en[n]}: ${n}.`, `गौरी के हाथ में एक कार्ड है। उस पर लिखा है ${NUMW.hi[n]}: ${n}।`),
            stage: { big: String(n), items: [{ id:'g', ic:'🐦', x:24, y:60, size:58, anim:'bob' }] } },
          { say: both(`Which nest has ${NUMW.en[n]} eggs? Tap it!`, `किस घोंसले में ${NUMW.hi[n]} अंडे हैं? उसे छुओ!`),
            join: { t:'pick', opts: groups.map(g => storyGroup('🥚', g)), right,
                    praise: both(`Yes! ${NUMW.en[n]} eggs — ${n}!`, `हाँ! ${NUMW.hi[n]} अंडे — ${n}!`),
                    show: both(`This nest has ${NUMW.en[n]}. Count: ${NUMW.en.slice(1, n + 1).join(', ')}.`, `इस घोंसले में ${NUMW.hi[n]} हैं। गिनो: ${NUMW.hi.slice(1, n + 1).join(', ')}।`) } },
          { say: both(`Crack! ${NUMW.en[n]} little chicks say hello!`, `चटाक! ${NUMW.hi[n]} नन्हे चूज़े नमस्ते कहते हैं!`),
            stage: { items: Array.from({ length: n }, (_, i) => ({ id:'c'+i, ic:'🐥', x: 50 + (i - (n - 1) / 2) * Math.min(11, 84 / n), y:60, size:34, anim:'pop', d:i*0.15 })) } }
        ],
        grownup: both(`Write the number ${n} on paper and put that many buttons or stones next to it.`, `कागज़ पर ${n} लिखें और उसके पास उतने ही बटन या कंकड़ रखें।`),
        home: both(`Ask: "Show me ${n} fingers!"`, `पूछें: "मुझे ${n} उँगलियाँ दिखाओ!"`)
      };
    }
  }
};

/* ---------- UKG's own stories (21 Nov) ----------
   UKG is where picture adding, taking away and blending start. The pick
   here is a number or a picture with the scene still on screen
   (join.keep), because "with pictures" means the child can look and count
   while choosing — and the counting together comes after the choice, so
   the first tap is the child's own. */
Object.assign(STORY_TPLS, {

  /* Adding with pictures: a few, then a few more arrive. */
  add: {
    classes: ['ukg'], ic: '🐦',
    skill: () => 'u-addpic',
    title: both('More friends come!', 'और दोस्त आए!'),
    build(r, o){
      const k = storyPick(r, STORY_ADDERS);
      const a = 1 + Math.floor(r() * 4), b = 1 + Math.floor(r() * 4), n = a + b;
      // the wrong number is a real slip: one too many or one too few when counting all
      const wrong = n - 1 >= 1 && r() < 0.5 ? n - 1 : n + 1;
      const right = r() < 0.5 ? 0 : 1, nums = [n, wrong]; if(right) nums.reverse();
      const first = Array.from({ length: a }, (_, i) => ({ id:'a'+i, ic:k.ic, x:14 + i * 9, y:30, size:34, anim:'bob', d:i*0.1 }));
      const more  = Array.from({ length: b }, (_, i) => ({ id:'b'+i, ic:k.ic, x:60 + i * 9, y:30, size:34, anim:'fly', d:0.3 + i*0.25 }));
      const all = first.concat(more).map(it => Object.assign({}, it, { anim: it.anim === 'fly' ? 'bob' : it.anim, d:0 }));
      const ground = Array.from({ length: n }, (_, i) => ({ x: 50 + (i - (n - 1) / 2) * Math.min(10, 80 / n), y: 80 }));
      return {
        bg: k.ic === '🐟' ? 'pond' : 'tree',
        scenes: [
          { say: both(`Look, ${o.name}! ${NUMW.en[a][0].toUpperCase() + NUMW.en[a].slice(1)} ${storyN(k, a, 'en')}.`,
                      `देखो ${o.name}! ${NUMW.hi[a]} ${storyN(k, a, 'hi')}।`),
            stage: { items: first } },
          { say: both(`Then ${NUMW.en[b]} more ${storyN(k, b, 'en')} ${k.come.en}!`, `फिर ${NUMW.hi[b]} और ${storyN(k, b, 'hi')} ${k.come.hi}!`),
            stage: { items: first.concat(more) } },
          { say: both(`${NUMW.en[a][0].toUpperCase() + NUMW.en[a].slice(1)}, and ${NUMW.en[b]} more. How many ${k.en[1]} now? Tap the number!`,
                      `${NUMW.hi[a]}, और ${NUMW.hi[b]} और। अब ${k.many} ${k.hi[1]} हैं? संख्या छुओ!`),
            stage: { items: all },
            join: { t:'pick', keep: true, opts: nums.map(x => ({ num: x })), right,
                    praise: both(`Yes! ${NUMW.en[a]} and ${NUMW.en[b]} make ${NUMW.en[n]}!`, `हाँ! ${NUMW.hi[a]} और ${NUMW.hi[b]} मिलकर ${NUMW.hi[n]}!`),
                    show: both(`It's ${NUMW.en[n]}. Let's count them all to see.`, `${NUMW.hi[n]} हैं। चलो सब गिनकर देखें।`) } },
          { say: both("Let's count them all together. Tap!", 'चलो सब साथ में गिनें। छुओ!'),
            stage: { items: all },
            join: { t:'count', seq: all.map(it => it.id), to: ground, n } },
          { say: both(`${a} and ${b} make ${n}. ${a} plus ${b} is ${n}!`, `${a} और ${b} मिलकर ${n}। ${a} जमा ${b} बराबर ${n}!`),
            stage: { big: `${a} + ${b} = ${n}`, items: all.map((it, i) => Object.assign({}, it, ground[i], { anim:'pop', d:0 })) } }
        ],
        grownup: both(`Put ${a} spoons on the table, then add ${b} more. Ask: "How many now?" and count them together.`,
                      `मेज़ पर ${a} चम्मच रखें, फिर ${b} और रखें। पूछें: "अब कितने हैं?" और साथ में गिनें।`),
        home: both(`At snack time: "You have ${a} grapes. Here are ${b} more — how many now?"`, `नाश्ते के समय: "तुम्हारे पास ${a} अंगूर हैं। ये लो ${b} और — अब कितने?"`)
      };
    }
  },

  /* Taking away with pictures: Munni eats a few — how many are left? */
  take: {
    classes: ['ukg'], ic: '🍌',
    skill: () => 'u-subpic',
    title: both('Munni is hungry!', 'मुन्नी को भूख लगी!'),
    build(r, o){
      const k = storyPick(r, STORY_EATS);
      const n = 4 + Math.floor(r() * 5), t = 1 + Math.floor(r() * 3), left = n - t;   // 4..8, take 1..3
      // real slips: forgetting to take away (n), or counting one off
      const roll = r();
      const wrong = roll < 0.4 ? n : roll < 0.7 && left > 1 ? left - 1 : left + 1;
      const right = r() < 0.5 ? 0 : 1, nums = [left, wrong]; if(right) nums.reverse();
      const row = Array.from({ length: n }, (_, i) => ({ id:'t'+i, ic:k.ic, x: 50 + (i - (n - 1) / 2) * Math.min(10, 84 / n), y:32, size: n > 6 ? 26 : 34, anim:'pop', d:i*0.1 }));
      const gone = { en: t === 1 ? 'one is gone' : `${NUMW.en[t]} are gone`, hi: t === 1 ? 'गया' : 'गए' };
      const eaten = row.map((it, i) => Object.assign({}, it, { anim: i < t ? 'gone' : '', d: i < t ? 0.4 + i * 0.5 : 0 }));
      const after = row.map((it, i) => Object.assign({}, it, { anim: i < t ? 'ghost' : '', d:0 }));
      const leftIds = row.slice(t).map(it => it.id);
      const ground = Array.from({ length: left }, (_, i) => ({ x: 50 + (i - (left - 1) / 2) * Math.min(11, 84 / left), y: 80 }));
      return {
        bg: 'room',
        scenes: [
          { say: both(`Munni has ${NUMW.en[n]} ${k.en[1]}. Count them with your eyes!`, `मुन्नी के पास ${NUMW.hi[n]} ${k.hi[1]} हैं। आँखों से गिनो!`),
            stage: { items: row.concat([{ id:'m', ic:'🐘', x:14, y:72, size:56, anim:'bob' }]) } },
          { say: both(`Munni eats ${NUMW.en[t]}. Munch, munch! Gone!`, `मुन्नी ने ${NUMW.hi[t]} खा लिए। चप-चप! ख़त्म!`),
            stage: { items: eaten.concat([{ id:'m', ic:'🐘', x:14, y:72, size:56, anim:'bob' }]) } },
          { say: both(`${NUMW.en[n][0].toUpperCase() + NUMW.en[n].slice(1)}, and ${gone.en}. How many are left? Tap the number!`,
                      `${NUMW.hi[n]} थे, ${NUMW.hi[t]} ${gone.hi}। कितने बचे? संख्या छुओ!`),
            stage: { items: after },
            join: { t:'pick', keep: true, opts: nums.map(x => ({ num: x })), right,
                    praise: both(`Yes! ${NUMW.en[left]} left!`, `हाँ! ${NUMW.hi[left]} बचे!`),
                    show: both(`${NUMW.en[left][0].toUpperCase() + NUMW.en[left].slice(1)} are left. Let's count them.`, `${NUMW.hi[left]} बचे हैं। चलो गिनें।`) } },
          { say: both("Let's count what is left. Tap!", 'चलो जो बचे हैं उन्हें गिनें। छुओ!'),
            stage: { items: after },
            join: { t:'count', seq: leftIds, to: ground, n: left } },
          { say: both(`${n} take away ${t} leaves ${left}!`, `${n} में से ${t} ${gone.hi}, ${left} बचे!`),
            stage: { big: `${n} − ${t} = ${left}`, items: row.slice(t).map((it, i) => Object.assign({}, it, ground[i], { anim:'pop', d:0 })) } }
        ],
        grownup: both(`Put ${n} biscuits out. Eat ${t} together and ask: "How many are left?"`,
                      `${n} बिस्किट रखें। साथ में ${t} खाएँ और पूछें: "कितने बचे?"`),
        home: both(`Hold up ${n} fingers, fold down ${t}, and ask how many are still standing.`, `${n} उँगलियाँ दिखाएँ, ${t} मोड़ें, और पूछें कितनी खड़ी हैं।`)
      };
    }
  },

  /* Blending: a word in its sounds — push them together, which is it? */
  blend: {
    classes: ['ukg'], ic: '🧩',
    skill: () => 'u-blend',
    title: both("Munni's word puzzle", 'मुन्नी की शब्द पहेली'),
    build(r, o){
      const lang = o.lang === 'hi' ? 'hi' : 'en', en = lang === 'en';
      const p = storyPick(r, STORY_BLENDS[lang]);
      const said = en ? p.s.map(x => STORY_SOUND[x]).join('… ') : p.s.join('… ');
      const right = r() < 0.5 ? 0 : 1;
      const opts = [{ ic:p.ic, size:88 }, { ic:p.odd.ic, size:88 }];   // pictures only: the child blends, not reads
      if(right) opts.reverse();
      const cards = { big: p.s.join(' ') };
      return {
        bg: 'plain', lang,
        scenes: [
          { say: both(`Munni has a word in little pieces. Listen: ${said}.`, `मुन्नी के पास टुकड़ों में एक शब्द है। सुनो: ${said}।`),
            stage: cards },
          { say: both('Say the pieces with Munni, slowly.', 'मुन्नी के साथ टुकड़े धीरे-धीरे बोलो।'),
            stage: cards,
            join: { t:'say', word: both(said, said) } },
          { say: both(`Now say them fast, all together: ${said}! Which picture is it? Tap it!`, `अब जल्दी से सब मिलाकर बोलो: ${said}! कौन सी तस्वीर है? उसे छुओ!`),
            stage: cards,
            join: { t:'pick', opts, right,
                    praise: both(`Yes! ${said}… ${p.w}!`, `हाँ! ${said}… ${p.w}!`),
                    show: both(`Listen: ${said}… ${p.w}. This one.`, `सुनो: ${said}… ${p.w}। यह वाला।`) } },
          { say: both(`${p.w[0].toUpperCase() + p.w.slice(1)}! You put the pieces together.`, `${p.w}! तुमने टुकड़े जोड़ दिए।`),
            stage: { big: p.w, items: [{ id:'w', ic:p.ic, x:76, y:56, size:84, anim:'pop', label:p.w }] } }
        ],
        grownup: en ? both(`Say a word in its sounds — ${said} — and let your child put it together: ${p.w}.`,
                           `एक शब्द को उसकी आवाज़ों में बोलें — ${said} — और बच्चे को जोड़ने दें: ${p.w}।`)
                    : both(`Say a word letter by letter — ${said} — and let your child put it together: ${p.w}.`,
                           `एक शब्द को अक्षर-अक्षर बोलें — ${said} — और बच्चे को जोड़ने दें: ${p.w}।`),
        home: en ? both('Play "robot talk": say "sss… uh… nnn" and see who says "sun" first.', '"रोबोट की बोली" खेलें: "sss… uh… nnn" बोलें और देखें कौन पहले "sun" बोलता है।')
                 : both('Play "robot talk": say "घ… र" slowly and see who says "घर" first.', '"रोबोट की बोली" खेलें: "घ… र" धीरे बोलें और देखें कौन पहले "घर" बोलता है।')
      };
    }
  }
});

/* UKG: sight words — the little words a child reads by their look, not by
   sounding them out. English: see, is, my…; Hindi: the words read most
   (में, है, और…). Each comes with the look-alike children really mix it
   up with (see/she, in/on, में/मैं, और/ओर, यह/वह), which is the other card. */
const STORY_SIGHT = {
  en: [ { w:'see', odd:'she',  line:'I see a cat.',      ic:'🐱' },
        { w:'is',  odd:'it',   line:'The sun is hot.',   ic:'☀️' },
        { w:'my',  odd:'me',   line:'This is my bag.',   ic:'🎒' },
        { w:'go',  odd:'no',   line:'We go to school.',  ic:'🏫' },
        { w:'he',  odd:'we',   line:'He has a kite.',    ic:'🪁' },
        { w:'in',  odd:'on',   line:'The fish is in the pond.', ic:'🐟' } ],
  hi: [ { w:'में', odd:'मैं', line:'मछली पानी में है।',     ic:'🐟' },
        { w:'और', odd:'ओर',  line:'राम और सीता खेलते हैं।', ic:'⚽' },
        { w:'यह', odd:'वह',  line:'यह मेरा घर है।',        ic:'🏠' },
        { w:'है',  odd:'हैं',  line:'आसमान नीला है।',        ic:'🌤️' },
        { w:'का', odd:'की',  line:'यह राजा का घोड़ा है।',    ic:'🐴' } ]
};

/* UKG: व्यंजन, each with the letter it is really mistaken for (ब/व, म/भ,
   घ/ध, प/फ, थ/य, ख/रव, ट/ठ) and a word it starts, as the Hindi book has it. */
const STORY_VYANJAN = [
  { l:'ब', w:'बतख',   ic:'🦆', odd:'व' },
  { l:'म', w:'मछली',  ic:'🐟', odd:'भ' },
  { l:'घ', w:'घर',    ic:'🏠', odd:'ध' },
  { l:'प', w:'पतंग',  ic:'🪁', odd:'फ' },
  { l:'थ', w:'थैला',  ic:'👜', odd:'य' },
  { l:'ख', w:'खरगोश', ic:'🐇', odd:'रव' },
  { l:'ट', w:'टमाटर', ic:'🍅', odd:'ठ' }
];

/* Class 1–2: read-along stories. Three short lines, a picture for each
   (the same thing keeps its id, so it moves from scene to scene instead of
   popping again), one question whose answer is in the story and one that
   isn't. Written for this app, in both languages. A picture is an emoji,
   or [emoji, x, y] to place it. */
const STORY_READS = [
  { ic:'🔴', bg:'sky', title:both('The red ball', 'लाल गेंद'),
    en:['Ravi has a red ball.', 'He throws it up, up, up!', 'The ball lands in a tree.'],
    hi:['रवि के पास लाल गेंद है।', 'वह गेंद ऊपर फेंकता है।', 'गेंद पेड़ पर अटक गई!'],
    pics:[ [['👦',38,66],['🔴',58,70]], [['👦',38,66],['🔴',58,26]], [['🌳',62,56],['🔴',64,38],['👦',30,70]] ],
    q:both('Where did the ball land?', 'गेंद कहाँ अटकी?'), opts:['🌳','🏠'],
    ans:both('The ball landed in a tree.', 'गेंद पेड़ पर अटक गई।') },
  { ic:'🐟', bg:'room', title:both('The cat and the fish', 'बिल्ली और मछली'),
    en:['A cat sees a fish.', 'The fish is in a bowl.', 'The cat sits and waits.'],
    hi:['बिल्ली ने एक मछली देखी।', 'मछली कटोरे में है।', 'बिल्ली बैठकर इंतज़ार करती है।'],
    pics:[ [['🐱',34,64],['🐟',64,56]], [['🥣',62,70],['🐟',62,58]], [['🐱',30,66],['🥣',62,70],['🐟',62,58]] ],
    q:both('What did the cat see?', 'बिल्ली ने क्या देखा?'), opts:['🐟','🐭'],
    ans:both('The cat saw a fish.', 'बिल्ली ने मछली देखी।') },
  { ic:'☂️', bg:'sky', title:both('Meena in the rain', 'बारिश में मीना'),
    en:['Dark clouds come.', 'It rains on Meena.', 'She opens her umbrella.'],
    hi:['काले बादल आए।', 'मीना पर बारिश हुई।', 'मीना ने अपना छाता खोला।'],
    pics:[ [['☁️',38,34],['🌧️',62,30]], [['🌧️',50,30],['👧',50,70]], [['🌧️',50,24],['☂️',50,50],['👧',50,72]] ],
    q:both('What did Meena open?', 'मीना ने क्या खोला?'), opts:['☂️','🎒'],
    ans:both('Meena opened her umbrella.', 'मीना ने अपना छाता खोला।') },
  { ic:'🐘', bg:'pond', title:both("Munni's bath", 'मुन्नी का स्नान'),
    en:['Munni goes to the pond.', 'She fills her trunk with water.', 'Splash! Munni has a bath.'],
    hi:['मुन्नी तालाब पर गई।', 'उसने सूँड़ में पानी भरा।', 'छपाक! मुन्नी नहा ली।'],
    pics:[ [['🐘',30,62],['🏞️',66,58]], [['🐘',44,62],['💧',62,52]], [['🐘',44,62],['💦',58,40]] ],
    q:both('Where did Munni go?', 'मुन्नी कहाँ गई?'), opts:['🏞️','🏫'],
    ans:both('Munni went to the pond.', 'मुन्नी तालाब पर गई।') },
  { ic:'🌻', bg:'sky', title:both("Asha's seed", 'आशा का बीज'),
    en:['Asha plants a seed.', 'She waters it every day.', 'Now it is a big sunflower!'],
    hi:['आशा ने एक बीज बोया।', 'वह रोज़ उसे पानी देती है।', 'अब वह बड़ा सूरजमुखी बन गया!'],
    pics:[ [['👧',34,64],['🌰',62,74]], [['👧',34,64],['💧',58,52],['🌱',62,72]], [['👧',30,64],['🌻',62,60]] ],
    q:both('What grew from the seed?', 'बीज से क्या उगा?'), opts:['🌻','🍎'],
    ans:both('A big sunflower grew.', 'बड़ा सूरजमुखी उगा।') },
  { ic:'🚌', bg:'sky', title:both('The late bus', 'देर से आई बस'),
    en:['The school bus is late.', 'The children wait at the gate.', 'Beep beep! Here it comes.'],
    hi:['स्कूल बस को देर हो गई।', 'बच्चे गेट पर इंतज़ार करते हैं।', 'पीं-पीं! बस आ गई।'],
    pics:[ [['🚌',86,64]], [['🧒',36,70],['👧',50,70],['🚪',66,64]], [['🚌',58,64],['🧒',22,70],['👧',34,70]] ],
    q:both('Who waited at the gate?', 'गेट पर कौन इंतज़ार कर रहा था?'), opts:['🧒','🐄'],
    ans:both('The children waited at the gate.', 'बच्चे गेट पर इंतज़ार कर रहे थे।') },
  { ic:'🌕', bg:'night', title:both('The big moon', 'बड़ा चाँद'),
    en:['It is night.', 'Arun looks up at the sky.', 'He sees the big round moon.'],
    hi:['रात हो गई।', 'अरुण ने आसमान को देखा।', 'उसे बड़ा गोल चाँद दिखा।'],
    pics:[ [['🏠',50,66],['⭐',28,30]], [['👦',40,70],['⭐',28,30]], [['👦',40,70],['⭐',28,30],['🌕',66,30]] ],
    q:both('What did Arun see?', 'अरुण को क्या दिखा?'), opts:['🌕','☀️'],
    ans:both('Arun saw the big round moon.', 'अरुण को बड़ा गोल चाँद दिखा।') },
  { ic:'🐶', bg:'room', title:both('Moti and the shoe', 'मोती और जूता'),
    en:['Moti is a little dog.', "He takes Papa's shoe.", 'He hides it under the bed!'],
    hi:['मोती एक छोटा कुत्ता है।', 'वह पापा का जूता ले गया।', 'उसने जूता पलंग के नीचे छिपा दिया!'],
    pics:[ [['🐶',50,66]], [['🐶',40,66],['👞',58,72]], [['🛏️',58,62],['👞',60,74],['🐶',28,68]] ],
    q:both('What did Moti take?', 'मोती क्या ले गया?'), opts:['👞','🧢'],
    ans:both("Moti took Papa's shoe.", 'मोती पापा का जूता ले गया।') }
];
/* One id per emoji, so the same thing glides from scene to scene. */
const storyPicId = ic => 'p' + [...ic].map(ch => ch.codePointAt(0).toString(36)).join('');
function storyPics(list){
  return list.map((p, i) => {
    const [ic, x, y] = Array.isArray(p) ? p : [p, 50 + (i - (list.length - 1) / 2) * 26, 64];
    return { id: storyPicId(ic), ic, x, y, size: 60, anim: 'bob', d: i * 0.15 };
  });
}

Object.assign(STORY_TPLS, {

  /* Before, after, between: one coach of the number train lost its number. */
  order: {
    classes: ['ukg'], ic: '🚂',
    skill: () => 'u-order',
    title: both("Munni's number train", 'मुन्नी की नंबर रेल'),
    build(r, o){
      const start = 1 + Math.floor(r() * 15), nums = [0, 1, 2, 3, 4].map(i => start + i);   // up to 19 — UKG counts to 20
      const kind = storyPick(r, ['after', 'before', 'between']);
      const k = kind === 'after' ? 1 + Math.floor(r() * 4) : kind === 'before' ? Math.floor(r() * 4) : 1 + Math.floor(r() * 3);
      const n = nums[k];
      // real slips: the number before for "after" (and the reverse); for "between", the neighbour said again
      const wrong = kind === 'after' ? (n - 2 >= 1 ? n - 2 : n + 1) : kind === 'before' ? n + 2 : n + 1;
      const right = r() < 0.5 ? 0 : 1, pair = [n, wrong]; if(right) pair.reverse();
      const coach = (i, num, anim) => ({ id:'c' + i, ic:'🚃', num, x: 28 + i * 15, y: 56, size: 40, anim, d: i * 0.12 });
      const engine = { id:'eng', ic:'🚂', x: 12, y: 56, size: 44, anim:'bob' };
      const lost = nums.map((x, i) => coach(i, i === k ? '?' : x, 'fly')).concat([engine]);
      const still = lost.map(it => Object.assign({}, it, { anim: it.id === 'eng' ? 'bob' : '', d: 0 }));
      const fixed = nums.map((x, i) => coach(i, x, i === k ? 'pop' : '')).concat([engine]);
      const seen = nums.map((x, i) => i === k ? '…' : x).join(', ');
      const ask = kind === 'after' ? both(`Which number comes just after ${nums[k - 1]}?`, `${nums[k - 1]} के ठीक बाद कौन सी संख्या आती है?`)
                : kind === 'before' ? both(`Which number comes just before ${nums[k + 1]}?`, `${nums[k + 1]} से ठीक पहले कौन सी संख्या आती है?`)
                : both(`Which number is between ${nums[k - 1]} and ${nums[k + 1]}?`, `${nums[k - 1]} और ${nums[k + 1]} के बीच में कौन सी संख्या है?`);
      const said = kind === 'after' ? both(`${n} comes just after ${nums[k - 1]}.`, `${nums[k - 1]} के ठीक बाद ${n} आता है।`)
                 : kind === 'before' ? both(`${n} comes just before ${nums[k + 1]}.`, `${nums[k + 1]} से ठीक पहले ${n} आता है।`)
                 : both(`${n} is between ${nums[k - 1]} and ${nums[k + 1]}.`, `${nums[k - 1]} और ${nums[k + 1]} के बीच में ${n} है।`);
      return {
        bg: 'sky',
        scenes: [
          { say: both(`Choo choo! Munni's number train is here. One coach has lost its number! Look: ${seen}.`,
                      `छुक-छुक! मुन्नी की नंबर रेल आ गई। एक डिब्बे का नंबर खो गया! देखो: ${seen}।`),
            stage: { items: lost } },
          { say: both(`${ask.en} Tap the number!`, `${ask.hi} संख्या छुओ!`),
            stage: { items: still },
            join: { t:'pick', keep: true, opts: pair.map(x => ({ num: x })), right,
                    praise: both(`Yes! ${said.en}`, `हाँ! ${said.hi}`),
                    show: both(`It's ${n}. ${said.en}`, `${n} है। ${said.hi}`) } },
          { say: both("The coach has its number back! Say the numbers with Munni.", 'डिब्बे को उसका नंबर वापस मिल गया! मुन्नी के साथ संख्याएँ बोलो।'),
            stage: { items: fixed },
            join: { t:'say', word: both(nums.join(', '), nums.join(', ')) } },
          { say: both(`${said.en} Every number has its place on the train!`, `${said.hi} हर संख्या की रेल में अपनी जगह है!`),
            stage: { big: kind === 'between' ? `${nums[k - 1]}, ${n}, ${nums[k + 1]}` : kind === 'after' ? `${nums[k - 1]}, ${n}` : `${n}, ${nums[k + 1]}`, items: fixed.map(it => Object.assign({}, it, { anim:'', d:0 })) } }
        ],
        grownup: both(`On the stairs, count up and down together, and ask: "What comes after ${nums[2]}? What comes before it?"`,
                      `सीढ़ियों पर साथ में ऊपर-नीचे गिनें, और पूछें: "${nums[2]} के बाद क्या आता है? उससे पहले क्या आता है?"`),
        home: both('Number five cups with paper slips, hide one slip, and ask which number is missing.',
                   'पाँच कपों पर पर्चियों से नंबर लगाएँ, एक पर्ची छिपाएँ, और पूछें कौन सा नंबर गायब है।')
      };
    }
  },

  /* Sight words: Munni's word card, in a sentence, then which card says it? */
  sight: {
    classes: ['ukg'], ic: '🃏',
    skill: () => 'u-sight',
    title: both("Munni's word card", 'मुन्नी का शब्द-कार्ड'),
    build(r, o){
      const lang = o.lang === 'hi' ? 'hi' : 'en';
      const p = storyPick(r, STORY_SIGHT[lang]);
      const right = r() < 0.5 ? 0 : 1, opts = [{ txt: p.w }, { txt: p.odd }]; if(right) opts.reverse();
      const line = { text: p.line, hl: p.w };
      return {
        bg: 'plain', lang,
        scenes: [
          { say: both(`Munni found a word card. It says "${p.w}". Say it with Munni!`, `मुन्नी को एक शब्द-कार्ड मिला। उस पर लिखा है "${p.w}"। मुन्नी के साथ बोलो!`),
            stage: { big: p.w },
            join: { t:'say', word: both(p.w, p.w) } },
          { say: both(`Here is "${p.w}" in Munni's sentence: ${p.line}`, `मुन्नी के वाक्य में "${p.w}": ${p.line}`),
            stage: { line, items: [{ id:'pic', ic: p.ic, x: 50, y: 64, size: 72, anim:'bob' }] } },
          { say: both(`Which card says "${p.w}"? Tap it!`, `कौन सा कार्ड "${p.w}" कहता है? उसे छुओ!`),
            join: { t:'pick', opts, right,
                    praise: both(`Yes! That card says "${p.w}".`, `हाँ! यह कार्ड "${p.w}" कहता है।`),
                    show: both(`This one says "${p.w}". "${p.odd}" looks a little like it — look again.`, `यह "${p.w}" कहता है। "${p.odd}" थोड़ा इसके जैसा दिखता है — फिर से देखो।`) } },
          { say: both(`Now you can read "${p.w}"! Look for it in your books.`, `अब तुम "${p.w}" पढ़ सकते हो! इसे अपनी किताबों में ढूँढो।`),
            stage: { line, items: [{ id:'pic', ic: p.ic, x: 50, y: 64, size: 72, anim:'pop' }] } }
        ],
        grownup: both(`Write "${p.w}" and "${p.odd}" on two slips. Say "${p.w}" and let your child pick the right slip.`,
                      `दो पर्चियों पर "${p.w}" और "${p.odd}" लिखें। "${p.w}" बोलें और बच्चे को सही पर्ची चुनने दें।`),
        home: both(`When you read together, ask your child to find every "${p.w}" on the page.`, `साथ में पढ़ते समय बच्चे से पन्ने पर हर "${p.w}" ढूँढने को कहें।`)
      };
    }
  },

  /* व्यंजन: Munni's letter, its word, then which card is it — the other
     card the letter it is really mixed up with. Hindi only (langs). */
  vyanjan: {
    classes: ['ukg'], langs: ['hi'], ic: '🔤',
    skill: () => 'u-vyanjan',
    title: both("Munni's Hindi letter", 'मुन्नी का अक्षर'),
    build(r, o){
      const p = storyPick(r, STORY_VYANJAN);
      const right = r() < 0.5 ? 0 : 1, opts = [{ txt: p.l }, { txt: p.odd }]; if(right) opts.reverse();
      const pic = anim => ({ id:'pic', ic: p.ic, x: 76, y: 58, size: 80, anim, label: p.w });
      return {
        bg: 'plain', lang: 'hi',
        scenes: [
          { say: both(`Munni has a Hindi letter today: ${p.l}. ${p.l} for ${p.w}!`, `आज मुन्नी एक अक्षर लाई है: ${p.l}। ${p.l} से ${p.w}!`),
            stage: { big: p.l, items: [pic('pop')] } },
          { say: both('Say it with Munni.', 'मुन्नी के साथ बोलो।'),
            stage: { big: p.l, items: [pic('bob')] },
            join: { t:'say', word: both(`${p.l}… ${p.w}`, `${p.l}… ${p.w}`) } },
          { say: both(`Now find ${p.l}. Which card is ${p.l}? Tap it!`, `अब ${p.l} ढूँढो। ${p.l} कौन सा है? छुओ!`),
            join: { t:'pick', opts, right,
                    praise: both(`Yes! That is ${p.l}, as in ${p.w}.`, `हाँ! यह ${p.l} है — ${p.w} वाला।`),
                    show: both(`This one is ${p.l}. ${p.odd} looks a little like it — look again.`, `यह ${p.l} है। ${p.odd} थोड़ा इसके जैसा दिखता है — फिर से देखो।`) } },
          { say: both(`${p.l} for ${p.w}! Find ${p.l} in your Hindi book.`, `${p.l} से ${p.w}! अपनी हिंदी की किताब में ${p.l} ढूँढो।`),
            stage: { big: p.l, items: [pic('pop')] } }
        ],
        grownup: both(`Write ${p.l} and ${p.odd} with chalk and ask: "Which one is ${p.l}?"`, `चॉक से ${p.l} और ${p.odd} लिखें और पूछें: "${p.l} कौन सा है?"`),
        home: both(`Look for things at home that start with ${p.l}, like ${p.w}.`, `घर में ${p.l} से शुरू होने वाली चीज़ें ढूँढें — ${p.w} जैसी।`)
      };
    }
  },

  /* Class 1–2: a short story read aloud with each word lighting up as Munni
     reads it, the child reading it all with a finger, then one question. */
  readalong: {
    classes: ['c1', 'c2'], ic: '📖',
    skill: o => o.cls === 'c2' ? (o.lang === 'hi' ? 'h2-fluent' : 'e2-compre') : (o.lang === 'hi' ? 'h1-read' : 'e1-read'),
    title: both('Read along with Munni', 'मुन्नी के साथ पढ़ो'),
    build(r, o){
      const p = o.seed != null ? STORY_READS[(o.seed >>> 0) % STORY_READS.length] : storyPick(r, STORY_READS);
      const lines = p.en.map((en, i) => ({ en, hi: p.hi[i] }));
      const right = r() < 0.5 ? 0 : 1, opts = p.opts.map(ic => ({ ic, size: 88 })); if(right) opts.reverse();
      return {
        bg: p.bg, read: STORY_READS.indexOf(p), storyTitle: p.title,
        scenes: [
          { say: both(`${p.title.en}. Listen to Munni, and follow the words.`, `${p.title.hi}। मुन्नी को सुनो, और शब्दों के साथ चलो।`),
            stage: { items: [{ id: storyPicId(p.ic), ic: p.ic, x: 50, y: 52, size: 96, anim:'pop' }] } },
          ...lines.map((l, i) => ({ say: l, stage: { line: l, items: storyPics(p.pics[i]) } })),
          { say: both('Your turn! Read the whole story out loud, with your finger on each word.', 'अब तुम्हारी बारी! हर शब्द पर उँगली रखकर पूरी कहानी ज़ोर से पढ़ो।'),
            stage: { lines },
            join: { t:'read', pace: o.cls === 'c2' ? 620 : 780 } },
          { say: p.q,
            join: { t:'pick', opts, right,
                    praise: both(`Yes! ${p.ans.en}`, `हाँ! ${p.ans.hi}`),
                    show: both(`Let's look again: ${p.ans.en}`, `चलो फिर से देखें: ${p.ans.hi}`) } },
          { say: both('You read a whole story!', 'तुमने पूरी कहानी पढ़ ली!'),
            stage: { lines, lit: true, items: [{ id: storyPicId(p.ic), ic: p.ic, x: 84, y: 82, size: 52, anim:'pop' }] } }
        ],
        grownup: both(`Read it again together, pointing to each word. Then ask: "${p.q.en}"`, `साथ में फिर से पढ़ें, हर शब्द पर उँगली रखकर। फिर पूछें: "${p.q.hi}"`),
        home: both('Ask your child to tell the story in their own words — what happened first, and then?', 'बच्चे से अपने शब्दों में कहानी सुनाने को कहें — पहले क्या हुआ, फिर क्या?')
      };
    }
  }
});

/* Which templates this class gets. */
function storyTplsFor(cls, lang){
  return Object.keys(STORY_TPLS).filter(id => STORY_TPLS[id].classes.includes(cls) && (!lang || !STORY_TPLS[id].langs || STORY_TPLS[id].langs.includes(lang)));
}

/* One story: template + a seed. The id names the template, the class,
   the language and the seed, so the same story plays the same way again
   ("Again!") and a new seed makes a new one. */
function storyBuild(tplId, seed, o){
  const T = STORY_TPLS[tplId]; if(!T) return null;
  o = Object.assign({ cls:'nur', lang:'en', name:'' }, o || {}, { seed: seed >>> 0 });
  const body = T.build(storyRand(seed), o);
  return Object.assign({ id: `st-${tplId}-${o.cls}-${o.lang}-${seed >>> 0}`, tpl: tplId, ic: T.ic, title: T.title, skill: T.skill(o), seed: seed >>> 0 }, body);
}
