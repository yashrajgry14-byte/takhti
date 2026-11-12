/* ==================================================================
   TEACH MUNNI — the content (aims, Munni's acts, the rubric words)

   Elephants never forget. Munni does, on purpose: after a lesson she
   "forgets" its aims and the child teaches them back out loud
   (core/teachback.js runs it, ui/teach-munni.js draws it).

   A unit is one topic's AIMS — the 3–5 plain points a teacher would
   approve ("knows to borrow when the top ones digit is smaller"). The
   same list does three jobs: it is what the teacher approves, what Munni
   draws out of the child one point at a time, and what the teacher sees
   results for.

   Each aim carries everything Munni will ever say about it, written
   ahead, in Hindi and English — the model that judges a child's
   explanation never writes a word the child hears:
     forget  Munni's "I forgot!" question
     hints   two nudges, never the explanation itself
     ideas   what a full explanation contains: a description (for the
             judge) and the words that show it (for the offline judge,
             in English, Hindi and romanised Hindi)
   teachCheckAim() (core/teachback.js) rejects an aim whose question or
   hints would already pass as the explanation — that is how "never the
   answer" is checked, not promised.

   A 'fix' aim is different: Munni works a sum and makes a real mistake —
   this child's own habit when the twin has found one (core/twin.js),
   else the commonest one for the skill — and the child catches it and
   explains it. Its sum, its options and Munni's working come from
   skillProblem() and the mistakes engine (core/mathgen.js) at run time;
   what Munni says while making each mistake is in TEACH_ACTS below, and
   what an explanation of each mistake must say is in TEACH_FIX_IDEAS.
   ================================================================== */

/* ---------- Munni's own lines (every one ships in both languages) ---------- */
const TEACH_LINES = {
  intro:   { en: 'Elephants never forget… but I forgot everything we just learnt! Will you teach me?', hi: 'हाथी कभी नहीं भूलते… पर मैं तो अभी का सीखा सब भूल गई! तुम मुझे सिखाओगे?' },
  again:   { en: 'Oops… I forgot again! Can you teach me this once more?',                           hi: 'उफ़… मैं फिर भूल गई! एक बार और सिखाओगे?' },
  fixIntro:{ en: 'Wait — I tried one all by myself. Is my answer right?',                             hi: 'रुको — मैंने एक सवाल ख़ुद किया। क्या मेरा जवाब सही है?' },
  fixCaught:{ en: 'Oh no, so I slipped! Where did I slip? Teach me!',                                 hi: 'अरे, तो मुझसे गड़बड़ हुई! कहाँ गड़बड़ हुई? मुझे सिखाओ!' },
  fixAgree:{ en: 'Hmm, are you sure? Let’s look at it again.',                                       hi: 'हम्म, पक्का? चलो फिर से देखते हैं।' },
  fixLook: { en: 'Look at my working again. Which step looks funny to you?',                         hi: 'मेरा तरीक़ा फिर से देखो। कौन सा क़दम अजीब लगता है?' },
  fixShould:{ en: 'At that step, what should I have done instead?',                                  hi: 'उस क़दम पर मुझे असल में क्या करना चाहिए था?' },
  partly:  { en: 'Hmm, I think I get part of it…',                                                    hi: 'हम्म, थोड़ा-थोड़ा समझ आया…' },
  unsure:  { en: 'I couldn’t quite hear you. Can you tell me again?',                                 hi: 'मुझे ठीक से सुनाई नहीं दिया। फिर से बताओगे?' },
  gap:     { en: 'That’s a tricky one! We’ll figure it out together later.',                         hi: 'यह तो मुश्किल है! हम बाद में मिलकर समझेंगे।' },
  done:    { en: 'You taught me {n} of {m} things! Thank you, teacher!',                              hi: 'तुमने मुझे {m} में से {n} बातें सिखाईं! शुक्रिया, टीचर!' },
  doneAll: { en: 'You taught me everything! Now I will never forget. Thank you, teacher!',            hi: 'तुमने मुझे सब सिखा दिया! अब मैं कभी नहीं भूलूँगी। शुक्रिया, टीचर!' },
  praise: [
    { en: 'Oh! Now I remember!',            hi: 'अरे! अब याद आ गया!' },
    { en: 'Yes! That makes sense now!',     hi: 'हाँ! अब समझ आया!' },
    { en: 'You are a great teacher!',       hi: 'तुम तो बहुत अच्छे टीचर हो!' },
    { en: 'Got it — thank you!',            hi: 'समझ गई — शुक्रिया!' }
  ]
};

/* ---------- the built-in units, one per skill ---------- */
const TEACH_UNITS = {

  add10: { band: 'early', title: { en: 'Adding', hi: 'जोड़ना' }, aims: [
    { id: 'add10.join', kind: 'explain',
      short: { en: 'Plus means join', hi: 'जोड़ यानी मिलाना' },
      point: { en: 'Knows that plus means putting things together', hi: 'जानते हैं कि जोड़ का मतलब चीज़ें मिलाना है' },
      forget: { en: 'What does plus mean? Is it when things go away?', hi: 'प्लस का मतलब क्या होता है? क्या तब, जब चीज़ें चली जाती हैं?' },
      hints: [ { en: 'If I have 3 bananas and you give me 2, what happens to my pile?', hi: 'मेरे पास 3 केले हैं और तुम मुझे 2 देते हो, तो मेरे ढेर का क्या होगा?' },
               { en: 'Think of two heaps pushed into one big heap.', hi: 'सोचो, दो ढेरों को धकेलकर एक बड़ा ढेर बना दिया।' } ],
      ideas: [ { en: 'no — plus means putting together, so there are more', hi: 'नहीं — जोड़ का मतलब मिलाना, तो ज़्यादा हो जाते हैं',
                 words: ['together', 'join', 'more', 'add', 'adding', 'jod', 'jodna', 'milao', 'mila', 'saath', 'zyada', 'jyada', 'जोड़', 'मिला', 'साथ', 'ज़्यादा', 'ज्यादा', 'बढ़'] } ] },
    { id: 'add10.order', kind: 'explain',
      short: { en: 'Order doesn’t matter', hi: 'क्रम से फ़र्क नहीं' },
      point: { en: 'Knows that 3 + 5 and 5 + 3 give the same answer', hi: 'जानते हैं कि 3 + 5 और 5 + 3 का जवाब एक ही होता है' },
      forget: { en: '3 plus 5 makes something. But 5 plus 3 must be different, right?', hi: '3 और 5 जोड़ो तो कुछ बनता है। पर 5 और 3 का जवाब अलग होगा, है ना?' },
      hints: [ { en: 'Try it on your fingers both ways.', hi: 'उँगलियों पर दोनों तरह से करके देखो।' },
               { en: 'Does the heap get bigger if you swap who comes first?', hi: 'पहले कौन आए, यह बदलने से क्या ढेर बड़ा हो जाता है?' } ],
      ideas: [ { en: 'no — it is the same answer (8) both ways', hi: 'नहीं — दोनों तरह से जवाब एक ही (8) है',
                 words: ['same', 'equal', '8', 'eight', 'aath', 'barabar', 'wahi', 'vahi', 'आठ', 'बराबर', 'वही', 'एक ही', 'same answer'] } ] },
    { id: 'add10.fix', kind: 'fix', skill: 'add10',
      short: { en: 'Fix Munni’s sum', hi: 'मुन्नी का सवाल ठीक करो' },
      point: { en: 'Can find and explain a mistake in an adding sum', hi: 'जोड़ के सवाल में गड़बड़ ढूँढकर समझा सकते हैं' } }
  ] },

  carry: { band: 'developing', title: { en: 'Adding with carrying', hi: 'हासिल वाला जोड़' }, aims: [
    { id: 'carry.ones', kind: 'explain',
      short: { en: 'Ones first', hi: 'पहले इकाई' },
      point: { en: 'Starts adding from the ones', hi: 'जोड़ इकाई से शुरू करते हैं' },
      forget: { en: 'I want to add 38 and 24. Which digits do I add first? I forgot!', hi: 'मुझे 38 और 24 जोड़ना है। पहले कौन से अंक जोड़ूँ? मैं भूल गई!' },
      hints: [ { en: 'Which column holds the small loose things, not the bundles?', hi: 'किस कॉलम में छोटी-छोटी खुली चीज़ें होती हैं, बंडल नहीं?' },
               { en: 'Look at 38. Which digit tells you how many are loose, not in bundles?', hi: '38 को देखो। कौन सा अंक बताता है कि कितनी चीज़ें खुली हैं, बंडल में नहीं?' } ],
      ideas: [ { en: 'start with the ones (8 and 4)', hi: 'इकाई से शुरू करो (8 और 4)',
                 words: ['ones', "one's", 'ikai', 'ekai', 'इकाई', '8 and 4', '8 aur 4', '8 और 4', 'eight and four', 'right', 'daayen', 'dayen', 'दाईं', 'दाएँ', 'दायें'] } ] },
    { id: 'carry.carry', kind: 'explain',
      short: { en: 'Carry the ten', hi: 'दहाई हासिल लो' },
      point: { en: 'Knows 12 ones is 1 ten and 2 ones, and carries the ten', hi: 'जानते हैं कि 12 इकाई = 1 दहाई और 2 इकाई, और दहाई हासिल ले जाते हैं' },
      forget: { en: '8 and 4 make 12. But there is room for only one digit! Where does the other part go?', hi: '8 और 4 मिलकर 12। पर जगह तो एक ही अंक की है! दूसरा हिस्सा कहाँ जाए?' },
      hints: [ { en: '12 is one bundle and some loose ones. How many loose ones?', hi: '12 में एक बंडल और कुछ खुली चीज़ें हैं। कितनी खुली?' },
               { en: 'The bundle can’t stay with the loose ones. Which column do bundles live in?', hi: 'बंडल खुली चीज़ों के साथ नहीं रह सकता। बंडल किस कॉलम में रहते हैं?' } ],
      ideas: [ { en: 'write 2, and carry the 1 ten over to the tens', hi: '2 लिखो, और 1 दहाई को दहाई वाले कॉलम में ले जाओ',
                 words: ['carry', 'carried', 'tens', 'ten', 'hasil', 'haasil', 'dahai', 'हासिल', 'दहाई', 'one ten', '1 ten', 'upar', 'ऊपर', 'le jao', 'ले जाओ'] } ] },
    { id: 'carry.fix', kind: 'fix', skill: 'carry',
      short: { en: 'Fix Munni’s sum', hi: 'मुन्नी का सवाल ठीक करो' },
      point: { en: 'Can find and explain a carrying mistake', hi: 'हासिल वाली गड़बड़ ढूँढकर समझा सकते हैं' } },
    { id: 'carry.tens', kind: 'explain',
      short: { en: 'Add the extra one', hi: 'अतिरिक्त एक जोड़ो' },
      point: { en: 'Adds the carried ten in with the tens', hi: 'हासिल वाली दहाई को दहाइयों के साथ जोड़ते हैं' },
      forget: { en: 'Now the tens: 3 and 2 make 5. Is that all? I think I forgot something…', hi: 'अब दहाई: 3 और 2 मिलकर 5। बस इतना? लगता है मैं कुछ भूल गई…' },
      hints: [ { en: 'Remember the bundle we moved a moment ago? Where is it now?', hi: 'वह बंडल याद है जो अभी हमने खिसकाया था? वह अब कहाँ है?' },
               { en: 'Count everything sitting in the tens column, even the small one on top.', hi: 'दहाई वाले कॉलम में जो कुछ है सब गिनो, ऊपर वाला छोटा भी।' } ],
      ideas: [ { en: 'add the carried 1 too, so the tens make 6', hi: 'हासिल का 1 भी जोड़ो, तो दहाई 6 बनती है',
                 words: ['6', 'six', 'chhe', 'chhah', 'छह', 'छः', 'carried', 'carry', 'hasil', 'हासिल', 'one more', 'plus one', 'plus 1', 'add one', 'add 1', 'ek aur', 'एक और'] } ] }
  ] },

  borrow: { band: 'developing', title: { en: 'Taking away with borrowing', hi: 'उधार वाला घटाना' }, aims: [
    { id: 'borrow.when', kind: 'explain',
      short: { en: 'When to borrow', hi: 'कब उधार लें' },
      point: { en: 'Knows to borrow when the top ones digit is smaller', hi: 'जानते हैं कि ऊपर की इकाई छोटी हो तो उधार लेते हैं' },
      forget: { en: 'I have 52 take away 27. Ones first: 2 take away 7… but 2 is so small! I forgot what to do. Can you teach me?', hi: 'मेरे पास 52 में से 27 घटाना है। पहले इकाई: 2 में से 7… पर 2 तो बहुत छोटा है! मैं भूल गई क्या करना है। तुम सिखाओगे?' },
      hints: [ { en: 'Look next door at the 5. Could the 2 ask it for help?', hi: 'बगल में 5 को देखो। क्या 2 उससे मदद माँग सकता है?' },
               { en: 'What do we call it when the ones ask the next column for one bundle?', hi: 'जब इकाई अगले कॉलम से एक बंडल माँगती है, उसे क्या कहते हैं?' } ],
      ideas: [ { en: 'borrow a ten from the tens', hi: 'दहाई से एक दस उधार लो',
                 words: ['borrow', 'borrowed', 'ten', 'tens', 'udhar', 'udhaar', 'dahai', 'उधार', 'दहाई', 'दस'] } ] },
    { id: 'borrow.ten', kind: 'explain',
      short: { en: 'A ten is 10 ones', hi: 'एक दहाई = 10 इकाई' },
      point: { en: 'Knows a borrowed ten becomes ten ones, so 2 becomes 12', hi: 'जानते हैं कि उधार की दहाई 10 इकाई बन जाती है, तो 2 का 12 हो जाता है' },
      forget: { en: 'Okay, I borrowed one. But now what happens to my 2? Does it stay 2?', hi: 'ठीक है, मैंने एक उधार लिया। पर अब मेरे 2 का क्या होगा? क्या वह 2 ही रहेगा?' },
      hints: [ { en: 'One bundle has how many loose ones inside? Put them with the 2.', hi: 'एक बंडल में कितनी खुली चीज़ें होती हैं? उन्हें 2 के साथ रखो।' },
               { en: 'Count the 2 and everything that came out of the bundle.', hi: '2 को और बंडल से निकली सारी चीज़ों को गिनो।' } ],
      ideas: [ { en: 'the 2 becomes 12, because the ten is ten ones', hi: '2 का 12 हो जाता है, क्योंकि एक दहाई दस इकाई है',
                 words: ['12', 'twelve', 'barah', 'baarah', 'बारह', 'ten ones', '10 ones', 'दस इकाई', '10 इकाई'] } ] },
    { id: 'borrow.fix', kind: 'fix', skill: 'borrow',
      short: { en: 'Fix Munni’s sum', hi: 'मुन्नी का सवाल ठीक करो' },
      point: { en: 'Can find and explain a borrowing mistake', hi: 'उधार वाली गड़बड़ ढूँढकर समझा सकते हैं' } },
    { id: 'borrow.check', kind: 'explain',
      short: { en: 'Check by adding', hi: 'जोड़कर जाँचो' },
      point: { en: 'Checks a take-away by adding the answer back', hi: 'घटाने का जवाब वापस जोड़कर जाँचते हैं' },
      forget: { en: 'I did 43 take away 18 and got 25. How can I be sure I am right? Is there a trick to check?', hi: 'मैंने 43 में से 18 घटाया और 25 आया। मुझे कैसे पता चलेगा कि सही है? जाँचने की कोई तरकीब है?' },
      hints: [ { en: 'What is the opposite of taking away?', hi: 'घटाने का उल्टा क्या होता है?' },
               { en: 'Put the 25 and the 18 into one heap. How many is that?', hi: '25 और 18 को एक ढेर में रखो। कितने हुए?' } ],
      ideas: [ { en: 'add the answer and the number taken away', hi: 'जवाब और घटाई गई संख्या को जोड़ो',
                 words: ['add', 'adding', 'plus', 'jod', 'jodo', 'जोड़', 'जोड़ो', 'जोड़कर', 'together'] },
               { en: 'you should get the first number (43) back', hi: 'पहली संख्या (43) वापस मिलनी चाहिए',
                 words: ['43', 'forty three', 'forty-three', 'tentalis', 'taintalis', 'तैंतालीस', 'first number', 'start number', 'same', 'back', 'wapas', 'वापस', 'पहली संख्या', 'बराबर'] } ] }
  ] },

  place2: { band: 'developing', title: { en: 'Tens and ones', hi: 'दहाई और इकाई' }, aims: [
    { id: 'place2.tens', kind: 'explain',
      short: { en: 'What the 4 means', hi: '4 का मतलब' },
      point: { en: 'Knows the 4 in 47 means 4 tens, which is 40', hi: 'जानते हैं कि 47 में 4 का मतलब 4 दहाई, यानी 40' },
      forget: { en: 'In 47, the 4 is just four little things, right?', hi: '47 में 4 का मतलब बस चार छोटी चीज़ें, है ना?' },
      hints: [ { en: 'Which place is the 4 sitting in?', hi: '4 किस जगह पर बैठा है?' },
               { en: 'If each of those four is a whole bundle, how many is that?', hi: 'अगर उन चारों में हर एक पूरा बंडल हो, तो कुल कितने?' } ],
      ideas: [ { en: 'no — the 4 means 4 tens, which is 40', hi: 'नहीं — 4 का मतलब 4 दहाई, यानी 40',
                 words: ['40', 'forty', 'chalis', 'chaalis', 'चालीस', 'tens', 'ten', 'dahai', 'दहाई', 'दस'] } ] },
    { id: 'place2.zero', kind: 'explain',
      short: { en: 'Zero holds a place', hi: 'शून्य की जगह' },
      point: { en: 'Knows 30 is not the same as 3: the zero keeps the 3 in the tens place', hi: 'जानते हैं कि 30 और 3 एक नहीं: शून्य 3 को दहाई की जगह पर रखता है' },
      forget: { en: 'Is 30 the same as 3? The zero is nothing, so I can just drop it?', hi: 'क्या 30 और 3 एक ही हैं? शून्य तो खाली है, तो उसे हटा दूँ?' },
      hints: [ { en: 'Show 30 with bundles, and 3 with loose ones. Do they look the same?', hi: '30 को बंडलों से और 3 को खुली चीज़ों से दिखाओ। क्या दोनों एक जैसे दिखते हैं?' },
               { en: 'Without the zero, where would the 3 have to sit?', hi: 'शून्य के बिना 3 को कहाँ बैठना पड़ेगा?' } ],
      ideas: [ { en: 'no, they are not the same', hi: 'नहीं, दोनों एक नहीं हैं',
                 words: ['no', 'not', 'nahi', 'nahin', 'नहीं', 'different', 'alag', 'अलग'] },
               { en: 'the zero keeps the 3 in the tens place, so 30 is three tens', hi: 'शून्य 3 को दहाई की जगह रखता है, तो 30 मतलब तीन दहाई',
                 words: ['tens', 'ten', 'dahai', 'दहाई', 'place', 'jagah', 'जगह', 'thirty', 'tees', 'तीस', '30', 'bigger', 'bada', 'बड़ा'] } ] },
    { id: 'place2.compare', kind: 'explain',
      short: { en: 'Which is bigger', hi: 'कौन बड़ा' },
      point: { en: 'Knows 52 is bigger than 25 because 5 tens is more than 2 tens', hi: 'जानते हैं कि 52, 25 से बड़ा है क्योंकि 5 दहाई, 2 दहाई से ज़्यादा है' },
      forget: { en: 'Which is bigger, 52 or 25? They use the same digits, so they must be equal!', hi: '52 बड़ा है या 25? दोनों में वही अंक हैं, तो दोनों बराबर होंगे!' },
      hints: [ { en: 'Look at the first digit of each. What does it count?', hi: 'दोनों का पहला अंक देखो। वह क्या गिनता है?' },
               { en: 'Five bundles or two bundles — which pile would you rather have?', hi: 'पाँच बंडल या दो बंडल — तुम कौन सा ढेर लोगे?' } ],
      ideas: [ { en: 'no, they are not equal', hi: 'नहीं, बराबर नहीं हैं',
                 words: ['no', 'not', 'nahi', 'nahin', 'नहीं', 'different', 'alag', 'अलग', 'bigger', 'bada', 'बड़ा'] },
               { en: '52 is bigger because it has 5 tens, and 25 has only 2', hi: '52 बड़ा है क्योंकि उसमें 5 दहाई हैं, 25 में सिर्फ़ 2',
                 words: ['5 tens', 'five tens', '5 dahai', '5 दहाई', 'पाँच दहाई', 'tens', 'dahai', 'दहाई', 'fifty', 'pachas', 'पचास'] } ] }
  ] }
};

/* ---------- 'fix' aims: which mistake Munni acts out, per skill ----------
   The twin's habit wins when it has one; otherwise the first of these the
   sum allows. Only mistakes Munni can act out AND a child can explain are
   listed (TEACH_ACTS × TEACH_FIX_IDEAS). */
const TEACH_FIX_DEFAULT = {
  add10: ['countincl', 'wrongop'], bonds10: ['countincl'], count20: ['countincl'],
  carry: ['nocarry', 'colsjoin'], add2: ['wrongop'], money2: ['wrongop'],
  sub10: ['wrongop'], sub2: ['wrongop'], borrow: ['noborrowback', 'smallbig'],
  tables: ['groupcount', 'wrongop'], mult2x1: ['xnocarry', 'tensnotx'],
  divshare: ['divmult'], bodmas: ['lefttoright'], twostep3: ['lefttoright']
};

/* What Munni says as she makes the mistake: her working, in the first
   person, ending in her answer. Never the right answer (the test checks). */
const TEACH_ACTS = {
  nocarry: (p, w, hi) => { const a1 = p.a % 10, b1 = p.b % 10, at = (p.a - a1) / 10, bt = (p.b - b1) / 10, s = a1 + b1;
    return hi ? `${p.a} और ${p.b}। इकाई में ${a1} और ${b1} मिलकर ${s} — मैंने ${s % 10} लिखा। दहाई में ${at} और ${bt} मिलकर ${at + bt}। तो जवाब ${w}!`
              : `${p.a} plus ${p.b}. Ones: ${a1} and ${b1} make ${s} — I wrote ${s % 10}. Tens: ${at} and ${bt} make ${at + bt}. So it’s ${w}!`; },
  colsjoin: (p, w, hi) => { const a1 = p.a % 10, b1 = p.b % 10, at = (p.a - a1) / 10, bt = (p.b - b1) / 10;
    return hi ? `${p.a} और ${p.b}। इकाई में ${a1} और ${b1} मिलकर ${a1 + b1}। दहाई में ${at} और ${bt} मिलकर ${at + bt}। दोनों को साथ-साथ लिख दिया: ${w}!`
              : `${p.a} plus ${p.b}. Ones: ${a1} and ${b1} make ${a1 + b1}. Tens: ${at} and ${bt} make ${at + bt}. I wrote them side by side: ${w}!`; },
  smallbig: (p, w, hi) => { const a1 = p.a % 10, b1 = p.b % 10, at = (p.a - a1) / 10, bt = (p.b - b1) / 10;
    return hi ? `${p.a} में से ${p.b}। इकाई में ${a1} और ${b1} — मैंने बड़े में से छोटा घटाया, ${Math.abs(a1 - b1)} बचे। दहाई में ${at} में से ${bt} घटाए, ${at - bt} बचे। तो जवाब ${w}!`
              : `${p.a} take away ${p.b}. Ones: ${a1} and ${b1} — I took the smaller from the bigger: ${Math.abs(a1 - b1)}. Tens: ${at} take away ${bt} is ${at - bt}. So it’s ${w}!`; },
  noborrowback: (p, w, hi) => { const a1 = p.a % 10, b1 = p.b % 10, at = (p.a - a1) / 10, bt = (p.b - b1) / 10;
    return hi ? `${p.a} में से ${p.b}। इकाई में ${a1}, ${b1} से छोटा है, तो मैंने एक दहाई उधार ली: ${a1 + 10} में से ${b1} घटाए, ${a1 + 10 - b1} बचे। दहाई में ${at} में से ${bt} घटाए, ${at - bt} बचे। तो जवाब ${w}!`
              : `${p.a} take away ${p.b}. Ones: ${a1} is less than ${b1}, so I borrowed a ten: ${a1 + 10} take away ${b1} is ${a1 + 10 - b1}. Tens: ${at} take away ${bt} is ${at - bt}. So it’s ${w}!`; },
  xnocarry: (p, w, hi) => { const big = Math.max(p.a, p.b), s = Math.min(p.a, p.b), d0 = big % 10, d1 = (big - d0) / 10, v = d0 * s;
    return hi ? `${big} गुणा ${s}। इकाई में ${d0} गुणा ${s} = ${v} — मैंने ${v % 10} लिखा। दहाई में ${d1} गुणा ${s} = ${d1 * s}। तो जवाब ${w}!`
              : `${big} times ${s}. Ones: ${d0} times ${s} is ${v} — I wrote ${v % 10}. Tens: ${d1} times ${s} is ${d1 * s}. So it’s ${w}!`; },
  tensnotx: (p, w, hi) => { const big = Math.max(p.a, p.b), s = Math.min(p.a, p.b), d0 = big % 10;
    return hi ? `${big} गुणा ${s}। मैंने बस ${d0} को ${s} से गुणा किया, और दहाई वैसे ही रहने दी। तो जवाब ${w}!`
              : `${big} times ${s}. I multiplied just the ${d0} by ${s}, and left the tens as they were. So it’s ${w}!`; },
  lefttoright: (p, w, hi) => hi ? `${p.a} + ${p.b} × ${p.c}। मैंने बाएँ से दाएँ किया: ${p.a} और ${p.b}, ${p.a + p.b}, फिर गुणा ${p.c}। तो जवाब ${w}!`
                                : `${p.a} + ${p.b} × ${p.c}. I went left to right: ${p.a} plus ${p.b} is ${p.a + p.b}, then times ${p.c}. So it’s ${w}!`,
  countincl: (p, w, hi) => { const seq = []; for(let i = 0; i < p.b; i++) seq.push(p.a + i);
    return hi ? `${p.a} और ${p.b}। मैंने ${p.a} से गिनना शुरू किया, ${p.b} बार: ${seq.join(', ')}। तो जवाब ${w}!`
              : `${p.a} plus ${p.b}. I started counting at ${p.a}, ${p.b} times: ${seq.join(', ')}. So it’s ${w}!`; },
  groupcount: (p, w, hi) => { const per = w % p.b === 0 && w / p.b !== p.a ? p.b : p.a, k = w / per;
    return hi ? `${p.a} गुणा ${p.b}। मैंने ${per} के समूह गिने: ${k} समूह। तो जवाब ${w}!`
              : `${p.a} times ${p.b}. I counted groups of ${per}: ${k} groups. So it’s ${w}!`; },
  divmult: (p, w, hi) => hi ? `${p.a} को ${p.b} में बाँटना है। मैंने ${p.a} को ${p.b} से गुणा कर दिया। तो जवाब ${w}!`
                            : `${p.a} shared between ${p.b}. I multiplied ${p.a} by ${p.b}. So it’s ${w}!`,
  wrongop: (p, w, hi) => {
    const did = { '+': ['took one from the other', 'एक में से दूसरा घटा दिया'], '−': ['added them up', 'दोनों को जोड़ दिया'],
                  '×': ['added them up', 'दोनों को जोड़ दिया'], '÷': ['took one from the other', 'एक में से दूसरा घटा दिया'] }[p.op] || ['did something else', 'कुछ और कर दिया'];
    return hi ? `${p.a} ${p.op} ${p.b}। मैंने ${did[1]}। तो जवाब ${w}!` : `${p.a} ${p.op} ${p.b}. I ${did[0]}. So it’s ${w}!`;
  }
};

/* What a child's explanation of each mistake must say. */
const CARRY_WORDS = ['carry', 'carried', 'ten', 'tens', 'hasil', 'haasil', 'dahai', 'हासिल', 'दहाई', 'दस', 'upar', 'ऊपर', 'one more', 'ek aur', 'एक और', 'forgot', 'bhool', 'भूल'];
const TEACH_FIX_IDEAS = {
  nocarry:  [ { en: 'the extra ten from the ones must be carried and added to the tens', hi: 'इकाई से बनी दहाई को हासिल लेकर दहाइयों में जोड़ना होता है', words: CARRY_WORDS } ],
  colsjoin: [ { en: 'write only the ones digit; the ten is carried to the tens', hi: 'इकाई का बस एक अंक लिखो; दहाई हासिल जाती है', words: CARRY_WORDS } ],
  xnocarry: [ { en: 'the carry from multiplying the ones is added to the tens', hi: 'इकाई के गुणा से बना हासिल दहाई में जोड़ा जाता है', words: CARRY_WORDS } ],
  tensnotx: [ { en: 'the tens must be multiplied too', hi: 'दहाई का भी गुणा करना होता है',
               words: ['tens', 'ten', 'dahai', 'दहाई', 'both', 'dono', 'दोनों', 'also', 'bhi', 'भी', 'whole', 'poora', 'पूरा'] } ],
  smallbig: [ { en: 'when the top ones digit is smaller, borrow a ten instead of swapping', hi: 'ऊपर की इकाई छोटी हो तो उलटने की जगह दहाई उधार लो',
               words: ['borrow', 'borrowed', 'udhar', 'udhaar', 'उधार', 'ten', 'tens', 'dahai', 'दहाई', 'दस', 'top', 'upar', 'ऊपर', 'can’t', "can't", 'cannot'] } ],
  noborrowback: [ { en: 'after borrowing, the tens digit goes down by one', hi: 'उधार लेने के बाद दहाई एक कम हो जाती है',
               words: ['one less', 'less', 'minus one', 'minus 1', 'goes down', 'went down', 'becomes', 'became', 'left', 'only', 'ek kam', 'kam', 'एक कम', 'कम', 'घट', 'बचे', 'बची', 'रह गए', 'रह गई', 'gave', 'given', 'diya', 'दिया'] } ],
  lefttoright: [ { en: 'multiply first, then add', hi: 'पहले गुणा करो, फिर जोड़ो',
               words: ['multiply first', 'times first', 'first multiply', 'first times', 'pehle guna', 'pahle guna', 'पहले गुणा', 'गुणा पहले', 'bodmas', 'before'] } ],
  countincl: [ { en: 'start counting from the next number, not the first number again', hi: 'अगली संख्या से गिनना शुरू करो, पहली संख्या दोबारा नहीं',
               words: ['next', 'after', 'agla', 'agle', 'अगला', 'अगले', 'बाद', 'baad', 'not count', 'don’t count', "don't count", 'again', 'dobara', 'दोबारा', 'twice'] } ],
  groupcount: [ { en: 'count exactly the right number of groups', hi: 'ठीक उतने ही समूह गिनो जितने चाहिए',
               words: ['groups', 'group', 'times', 'table', 'samooh', 'समूह', 'बार', 'baar', 'pahada', 'पहाड़ा', 'extra', 'one more', 'one less', 'too many', 'too few'] } ],
  divmult: [ { en: 'sharing means dividing into equal groups, not multiplying', hi: 'बाँटने का मतलब बराबर हिस्से करना है, गुणा नहीं',
               words: ['share', 'sharing', 'divide', 'divided', 'equal', 'baant', 'bant', 'बाँट', 'बांट', 'भाग', 'barabar', 'बराबर', 'not multiply', 'गुणा नहीं'] } ],
  wrongop: [ { en: 'look at the sign and do what it says', hi: 'चिह्न देखो और वही करो जो वह कहता है',
               words: ['sign', 'chinh', 'चिह्न', 'चिन्ह', 'plus', 'minus', 'take away', 'times', 'add', 'subtract', 'jod', 'ghata', 'जोड़', 'घटा', 'गुणा', 'should', 'chahiye', 'चाहिए'] } ]
};
