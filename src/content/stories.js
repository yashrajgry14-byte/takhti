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
      return {
        bg: 'plain', lang,
        scenes: [
          { say: en ? both(`This is the letter ${L.l}. It says "${L.l}"… "${L.l}"… like ${L.w}!`, `यह अक्षर ${L.l} है। इसकी आवाज़ है "${L.l}"… जैसे ${L.w}!`)
                    : both(`This is ${L.l}. ${L.l} for ${L.w}!`, `यह ${L.l} है। ${L.l} से ${L.w}!`),
            stage: { big: L.l, items: [{ id:'w', ic:L.ic, x:74, y:56, size:80, anim:'pop', d:0.8, label:L.w }] } },
          { say: both('Say it with Munni!', 'मुन्नी के साथ बोलो!'),
            stage: { big: L.l, items: [{ id:'w', ic:L.ic, x:74, y:56, size:80, label:L.w }] },
            join: { t:'say', word: en ? both(`${L.l}… ${L.l}… ${L.w}`, `${L.l}… ${L.l}… ${L.w}`) : both(`${L.l} से ${L.w}`, `${L.l} से ${L.w}`) } },
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

/* Which templates this class gets. */
function storyTplsFor(cls){ return Object.keys(STORY_TPLS).filter(id => STORY_TPLS[id].classes.includes(cls)); }

/* One story: template + a seed. The id names the template, the class,
   the language and the seed, so the same story plays the same way again
   ("Again!") and a new seed makes a new one. */
function storyBuild(tplId, seed, o){
  const T = STORY_TPLS[tplId]; if(!T) return null;
  o = Object.assign({ cls:'nur', lang:'en', name:'' }, o || {});
  const body = T.build(storyRand(seed), o);
  return Object.assign({ id: `st-${tplId}-${o.cls}-${o.lang}-${seed >>> 0}`, tpl: tplId, ic: T.ic, title: T.title, skill: T.skill(o), seed: seed >>> 0 }, body);
}
