/* ==================================================================
   TWENTY ARITHMETIC STORIES

   Each is a script, not a video. The engine in ui/lesson-player.js
   draws every beat using whichever game the child chose, so one script
   plays twenty different ways — and adding a twenty-first lesson costs
   a paragraph of JSON, not a week of animation.

   Narration is generated from the beat (see LES_SAY) except where the
   words carry story rather than maths; those beats have an explicit
   `say`. That is what keeps twenty bilingual lessons maintainable.

   A checkpoint marked `derived:true` asks about something other than the
   running total — bundles, tens, hands — so the arithmetic test must skip
   it rather than "fixing" a correct answer.

   Bands come from content/ages.js. A four-year-old never sees carrying;
   a nine-year-old never gets handed "count to five", which is the
   single most reliable way to make an older child close an app.
   ================================================================== */

const LESSONS = [

/* ---------------- 3–4 · pre-reader: numbers exist ---------------- */
{ id:'count5', band:'pre', ic:'🖐️',
  title:{en:'Count to five', hi:'पाँच तक गिनो'},
  sub:{en:'One at a time', hi:'एक-एक करके'},
  beats:[
    {t:'intro', say:{en:'The game is starting. Let us count these.', hi:'खेल शुरू! आओ इन्हें गिनें।'}},
    {t:'count', n:3},
    {t:'count', n:5},
    {t:'ask', q:{en:'How many are there now?', hi:'अब कितने हैं?'}, opts:['5','3'], hiOpts:['5','3'], correct:0},
    {t:'win', say:{en:'Five! You counted every single one.', hi:'पाँच! तुमने हर एक गिना।'}}
  ]},

{ id:'count10', band:'pre', ic:'🔟',
  title:{en:'Count to ten', hi:'दस तक गिनो'},
  sub:{en:'Like your fingers', hi:'उँगलियों जितने'},
  beats:[
    {t:'intro', say:{en:'You have ten fingers. Let us find ten of these too.', hi:'तुम्हारी दस उँगलियाँ हैं। आओ इनके भी दस ढूँढें।'}},
    {t:'count', n:7},
    {t:'count', n:10},
    {t:'ask', derived:true, q:{en:'Ten is the same as how many hands?', hi:'दस बराबर कितने हाथ?'}, opts:['2','5'], hiOpts:['2','5'], correct:0},
    {t:'win', say:{en:'Two hands, ten fingers, ten of these. Well done!', hi:'दो हाथ, दस उँगलियाँ, दस चीज़ें। शाबाश!'}}
  ]},

{ id:'morefewer', band:'pre', ic:'⚖️',
  title:{en:'More or fewer', hi:'ज़्यादा या कम'},
  sub:{en:'Which pile is bigger?', hi:'कौन सा ढेर बड़ा?'},
  beats:[
    {t:'intro', say:{en:'Two teams. One has more than the other — can you see which?', hi:'दो टीमें। एक के पास दूसरे से ज़्यादा है — दिखा?'}},
    {t:'count', n:2},
    {t:'count', n:5},
    {t:'ask', derived:true, q:{en:'Which is more?', hi:'ज़्यादा कौन?'}, opts:['5','2'], hiOpts:['5','2'], correct:0},
    {t:'win', say:{en:'Five is more than two. Bigger pile, bigger number.', hi:'पाँच दो से ज़्यादा है। बड़ा ढेर, बड़ी संख्या।'}}
  ]},

{ id:'samesame', band:'pre', ic:'🟰',
  title:{en:'Making them equal', hi:'बराबर करना'},
  sub:{en:'Same for everyone', hi:'सबके लिए बराबर'},
  beats:[
    {t:'intro', say:{en:'Two friends must get the same. Not more, not less.', hi:'दोनों दोस्तों को बराबर मिले। न कम, न ज़्यादा।'}},
    {t:'share', a:4, b:2},
    {t:'ask', q:{en:'How many did each friend get?', hi:'हर दोस्त को कितने मिले?'}, opts:['2','4'], hiOpts:['2','4'], correct:0},
    {t:'win', say:{en:'Two each. That is what fair means.', hi:'हर एक को दो। यही बराबरी है।'}}
  ]},

{ id:'ordinal', band:'pre', ic:'🥇',
  title:{en:'First, second, third', hi:'पहला, दूसरा, तीसरा'},
  sub:{en:'Who came where', hi:'कौन कहाँ आया'},
  beats:[
    {t:'intro', say:{en:'The race is over! Let us see who finished where.', hi:'दौड़ ख़त्म! देखें कौन कहाँ पहुँचा।'}},
    {t:'count', n:3},
    {t:'ask', q:{en:'How many finished the race?', hi:'दौड़ कितनों ने पूरी की?'}, opts:['3','1'], hiOpts:['3','1'], correct:0},
    {t:'win', say:{en:'First, second, third. Counting tells you the order.', hi:'पहला, दूसरा, तीसरा। गिनती क्रम बताती है।'}}
  ]},

/* ---------------- 5–6 · early: joining and taking ---------------- */
{ id:'add5', band:'early', ic:'➕',
  title:{en:'Adding up to five', hi:'पाँच तक जोड़ो'},
  sub:{en:'When more arrive', hi:'जब और आ जाएँ'},
  beats:[
    {t:'intro', say:{en:'Three are already here. Watch what happens when friends turn up.', hi:'तीन पहले से हैं। देखो जब दोस्त आते हैं तो क्या होता है।'}},
    {t:'add', a:3, b:2},
    {t:'ask', q:{en:'3 and 2 more makes…', hi:'3 और 2 मिलकर…'}, opts:['5','4'], hiOpts:['5','4'], correct:0},
    {t:'add', a:1, b:4},
    {t:'win', say:{en:'Adding just means putting groups together.', hi:'जोड़ना यानी ढेरों को मिला देना।'}}
  ]},

{ id:'add10', band:'early', ic:'🔟',
  title:{en:'Adding up to ten', hi:'दस तक जोड़ो'},
  sub:{en:'Bigger groups now', hi:'अब बड़े ढेर'},
  beats:[
    {t:'intro', say:{en:'A bigger match today. Bigger numbers too.', hi:'आज बड़ा मैच। संख्याएँ भी बड़ी।'}},
    {t:'add', a:6, b:3},
    {t:'ask', q:{en:'6 and 3 more makes…', hi:'6 और 3 मिलकर…'}, opts:['9','8'], hiOpts:['9','8'], correct:0},
    {t:'add', a:4, b:5},
    {t:'win', say:{en:'You can add without counting from one every time.', hi:'हर बार एक से गिनने की ज़रूरत नहीं।'}}
  ]},

{ id:'bonds10', band:'early', ic:'🤝',
  title:{en:'Pairs that make ten', hi:'दस बनाने वाली जोड़ियाँ'},
  sub:{en:'The most useful ten facts', hi:'सबसे काम की बातें'},
  beats:[
    {t:'intro', say:{en:'Ten is a special number. Many pairs add up to exactly ten.', hi:'दस ख़ास संख्या है। कई जोड़ियाँ मिलकर ठीक दस बनाती हैं।'}},
    {t:'bar', a:10, b:6},
    {t:'ask', q:{en:'6 and what makes 10?', hi:'6 और कितने मिलकर 10?'}, opts:['4','5'], hiOpts:['4','5'], correct:0},
    {t:'bar', a:10, b:7},
    {t:'win', say:{en:'Learn these pairs and every sum gets easier.', hi:'ये जोड़ियाँ याद हो जाएँ तो हर सवाल आसान।'}}
  ]},

{ id:'sub10', band:'early', ic:'➖',
  title:{en:'Taking away', hi:'घटाना'},
  sub:{en:'When some leave', hi:'जब कुछ चले जाएँ'},
  beats:[
    {t:'intro', say:{en:'Everyone is here. Then some have to go home.', hi:'सब यहीं हैं। फिर कुछ को घर जाना पड़ता है।'}},
    {t:'take', a:8, b:3},
    {t:'ask', q:{en:'8 take away 3 leaves…', hi:'8 में से 3 गए, बचे…'}, opts:['5','6'], hiOpts:['5','6'], correct:0},
    {t:'take', a:9, b:5},
    {t:'win', say:{en:'Taking away is just adding, walking backwards.', hi:'घटाना यानी उल्टी दिशा में जोड़ना।'}}
  ]},

{ id:'doubles', band:'early', ic:'👯',
  title:{en:'Doubles', hi:'दुगना'},
  sub:{en:'Two of the same', hi:'दो बराबर ढेर'},
  beats:[
    {t:'intro', say:{en:'Both teams brought exactly the same number. That is a double.', hi:'दोनों टीमें ठीक बराबर लाईं। यही दुगना है।'}},
    {t:'add', a:4, b:4},
    {t:'ask', q:{en:'Double 4 is…', hi:'4 का दुगना…'}, opts:['8','6'], hiOpts:['8','6'], correct:0},
    {t:'add', a:5, b:5},
    {t:'win', say:{en:'Doubles are quick to remember, and they help everywhere.', hi:'दुगने जल्दी याद होते हैं और हर जगह काम आते हैं।'}}
  ]},

/* ---------------- 7–8 · developing: tens, carrying, groups ---------------- */
{ id:'placevalue', band:'developing', ic:'📦',
  title:{en:'Bundles of ten', hi:'दस के बंडल'},
  sub:{en:'Why 23 means what it means', hi:'23 का मतलब क्या'},
  beats:[
    {t:'intro', say:{en:'Counting twenty-three one by one takes forever. Bundle them instead.', hi:'तेईस को एक-एक गिनना बहुत लंबा है। इन्हें बंडल कर लो।'}},
    {t:'group', a:23},
    {t:'ask', derived:true, q:{en:'How many bundles of ten in 23?', hi:'23 में दस के कितने बंडल?'}, opts:['2','3'], hiOpts:['2','3'], correct:0},
    {t:'group', a:47},
    {t:'win', say:{en:'The first digit counts bundles. The second counts what is left over.', hi:'पहला अंक बंडल गिनता है। दूसरा बचे हुए।'}}
  ]},

{ id:'add2digit', band:'developing', ic:'🧮',
  title:{en:'Adding two-digit numbers', hi:'दो अंकों का जोड़'},
  sub:{en:'Tens first, then ones', hi:'पहले दहाई, फिर इकाई'},
  beats:[
    {t:'intro', say:{en:'Twenty-three and fourteen. Do the bundles first, the loose ones after.', hi:'तेईस और चौदह। पहले बंडल जोड़ो, फिर बचे हुए।'}},
    {t:'group', a:23},
    {t:'line', a:23, b:10, hops:1, say:{en:'Add one bundle of ten: 23 becomes 33.', hi:'दस का एक बंडल जोड़ो: 23 से 33।'}},
    {t:'line', a:33, b:4, hops:1, say:{en:'Now the four loose ones: 33 becomes 37.', hi:'अब चार बचे हुए: 33 से 37।'}},
    {t:'ask', q:{en:'23 + 14 = ?', hi:'23 + 14 = ?'}, opts:['37','36'], hiOpts:['37','36'], correct:0},
    {t:'win', say:{en:'Tens with tens, ones with ones. Every time.', hi:'दहाई के साथ दहाई, इकाई के साथ इकाई। हर बार।'}}
  ]},

{ id:'carrying', band:'developing', ic:'🎒',
  title:{en:'When ten ones become a bundle', hi:'जब दस इकाई बंडल बनें'},
  sub:{en:'Carrying, explained', hi:'हासिल क्या होता है'},
  beats:[
    {t:'intro', say:{en:'Twenty-eight and five. Watch the loose ones — there will be too many.', hi:'अट्ठाईस और पाँच। बचे हुओं को देखो — वे बहुत हो जाएँगे।'}},
    {t:'group', a:28},
    {t:'add', a:8, b:5, say:{en:'Eight loose plus five is thirteen — more than ten!', hi:'आठ बचे और पाँच मिलकर तेरह — दस से ज़्यादा!'}},
    {t:'group', a:33, say:{en:'So ten of them become a new bundle. That is what carrying is.', hi:'तो उनमें से दस नया बंडल बन जाते हैं। यही हासिल है।'}},
    {t:'ask', q:{en:'28 + 5 = ?', hi:'28 + 5 = ?'}, opts:['33','32'], hiOpts:['33','32'], correct:0},
    {t:'win', say:{en:'Carrying is not a rule to memorise. It is a bundle being born.', hi:'हासिल रटने का नियम नहीं। यह नया बंडल बनना है।'}}
  ]},

{ id:'sub2digit', band:'developing', ic:'🔙',
  title:{en:'Taking away bigger numbers', hi:'बड़ी संख्याएँ घटाना'},
  sub:{en:'Hop backwards', hi:'उल्टा कूदो'},
  beats:[
    {t:'intro', say:{en:'Thirty-five, and twelve leave. Hop backwards to find what is left.', hi:'पैंतीस, और बारह चले गए। उल्टा कूदकर बचे हुए ढूँढो।'}},
    {t:'bar', a:35, b:12},
    {t:'ask', q:{en:'35 − 12 = ?', hi:'35 − 12 = ?'}, opts:['23','22'], hiOpts:['23','22'], correct:0},
    {t:'bar', a:40, b:15},
    {t:'win', say:{en:'The bar shows you the missing part. No guessing needed.', hi:'पट्टी बचा हिस्सा दिखा देती है। अंदाज़े की ज़रूरत नहीं।'}}
  ]},

{ id:'skipcount', band:'developing', ic:'🦘',
  title:{en:'Counting in jumps', hi:'छलाँग में गिनना'},
  sub:{en:'Twos, fives and tens', hi:'दो, पाँच और दस'},
  beats:[
    {t:'intro', say:{en:'You do not have to count one at a time. Jump instead.', hi:'एक-एक गिनना ज़रूरी नहीं। छलाँग लगाओ।'}},
    {t:'line', a:0, b:2, hops:5},
    {t:'ask', q:{en:'Five jumps of 2 lands on…', hi:'2 की पाँच छलाँगें पहुँचती हैं…'}, opts:['10','8'], hiOpts:['10','8'], correct:0},
    {t:'line', a:0, b:5, hops:4},
    {t:'win', say:{en:'Jumping in equal steps is the beginning of multiplying.', hi:'बराबर छलाँगें ही गुणा की शुरुआत हैं।'}}
  ]},

{ id:'arrays', band:'developing', ic:'🔲',
  title:{en:'Rows and columns', hi:'पंक्तियाँ और स्तंभ'},
  sub:{en:'Multiplying is a shape', hi:'गुणा एक आकार है'},
  beats:[
    {t:'intro', say:{en:'Line everyone up in neat rows. Now you can count them fast.', hi:'सबको सीधी पंक्तियों में खड़ा करो। अब जल्दी गिन सकते हो।'}},
    {t:'array', a:3, b:4},
    {t:'ask', q:{en:'3 rows of 4 is how many?', hi:'4 की 3 पंक्तियाँ मिलकर कितने?'}, opts:['12','7'], hiOpts:['12','7'], correct:0},
    {t:'array', a:2, b:5},
    {t:'win', say:{en:'Rows times columns. That is all multiplying is.', hi:'पंक्तियाँ गुणा स्तंभ। गुणा बस यही है।'}}
  ]},

/* ---------------- 9–10 · fluent: multiply, divide, parts ---------------- */
{ id:'tables', band:'fluent', ic:'✖️',
  title:{en:'Times tables, seen', hi:'पहाड़े, दिखते हुए'},
  sub:{en:'Why 6 × 4 is 24', hi:'6 × 4 = 24 क्यों'},
  beats:[
    {t:'intro', say:{en:'A table is not a chant to memorise. It is a shape you can see.', hi:'पहाड़ा रटने की चीज़ नहीं। यह दिखने वाला आकार है।'}},
    {t:'array', a:6, b:4},
    {t:'ask', q:{en:'6 × 4 = ?', hi:'6 × 4 = ?'}, opts:['24','20'], hiOpts:['24','20'], correct:0},
    {t:'array', a:4, b:6, say:{en:'Turn it sideways: 4 rows of 6. Same total — order does not matter.', hi:'बग़ल से देखो: 6 की 4 पंक्तियाँ। कुल वही — क्रम से फ़र्क़ नहीं पड़ता।'}},
    {t:'win', say:{en:'6 × 4 and 4 × 6 are the same shape, just turned around.', hi:'6 × 4 और 4 × 6 एक ही आकार हैं, बस घुमा हुआ।'}}
  ]},

{ id:'divide', band:'fluent', ic:'➗',
  title:{en:'Sharing equally', hi:'बराबर बाँटना'},
  sub:{en:'Division without fear', hi:'भाग, बिना डर'},
  beats:[
    {t:'intro', say:{en:'Fifteen to share between three teams. Deal them out one at a time.', hi:'पंद्रह को तीन टीमों में बाँटना है। एक-एक करके बाँटो।'}},
    {t:'share', a:15, b:3},
    {t:'ask', q:{en:'15 ÷ 3 = ?', hi:'15 ÷ 3 = ?'}, opts:['5','4'], hiOpts:['5','4'], correct:0},
    {t:'array', a:3, b:5, say:{en:'And look — it is the same shape as 3 × 5. Dividing undoes multiplying.', hi:'देखो — यह 3 × 5 वाला ही आकार है। भाग गुणा को उलट देता है।'}},
    {t:'win', say:{en:'Every division is a multiplication asked backwards.', hi:'हर भाग उल्टा पूछा गया गुणा है।'}}
  ]},

{ id:'fractions', band:'fluent', ic:'🍕',
  title:{en:'Halves and quarters', hi:'आधा और चौथाई'},
  sub:{en:'Parts of one whole', hi:'एक पूरे के हिस्से'},
  beats:[
    {t:'intro', say:{en:'One whole thing, cut into equal parts. Equal is the important word.', hi:'एक पूरी चीज़, बराबर हिस्सों में। बराबर — यही ज़रूरी शब्द है।'}},
    {t:'frac', b:2},
    {t:'frac', b:4},
    {t:'ask', q:{en:'Which is bigger, one half or one quarter?', hi:'बड़ा कौन, आधा या चौथाई?'},
      opts:['One half','One quarter'], hiOpts:['आधा','चौथाई'], correct:0},
    {t:'win', say:{en:'More pieces means smaller pieces. That surprises everyone at first.', hi:'ज़्यादा टुकड़े यानी छोटे टुकड़े। यह सबको पहले चौंकाता है।'}}
  ]},

{ id:'place1000', band:'fluent', ic:'🏗️',
  title:{en:'Hundreds and thousands', hi:'सैकड़ा और हज़ार'},
  sub:{en:'Bundles of bundles', hi:'बंडलों के बंडल'},
  beats:[
    {t:'intro', say:{en:'Ten ones make a bundle. Ten bundles make a bigger bundle. It never stops.', hi:'दस इकाई का बंडल। दस बंडल का बड़ा बंडल। यह चलता रहता है।'}},
    {t:'group', a:64},
    {t:'ask', derived:true, q:{en:'How many tens are in 64?', hi:'64 में कितनी दहाई?'}, opts:['6','4'], hiOpts:['6','4'], correct:0},
    {t:'group', a:87},
    {t:'win', say:{en:'Each place is ten times the one on its right. That is the whole system.', hi:'हर स्थान अपने दाएँ से दस गुना है। पूरी व्यवस्था यही है।'}}
  ]}
];
