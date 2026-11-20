/* ==================================================================
   MUNNI'S VIDEOS — five short teaching videos for the hardest early
   topics (21 Nov 2026).

   Stories teach by joining in; a few topics are easier to see done by a
   person with real things in their hands: bundling sticks into tens,
   carrying a ten, opening a bundle to borrow, the मात्रा joining a letter,
   the short hand of a clock. So each topic has a video, and every video
   stops two or three times for the child to answer — the first tap is
   real evidence for the topic's skill (noteSkillAttempt), the same as a
   story's pick. Watching alone teaches less than a person does; stopping
   to ask and answer is what makes video teach.

   Two forms of the same video, played by ui/watch.js:
     · filmed — the team films a teacher from video/SCRIPTS.md and lists
       the clip in video/clips.json with the second each pause comes at;
       played offline once it has been watched online once
     · animated — until then (and for any language not filmed yet), the
       same script drawn on screen: the lesson player's own pictures
       (bundles, clocks, sums) narrated by Munni. Every line is in the
       recorded pack once tools/build-audio.mjs is run (it reads this
       file), so it plays with no network.

   The pauses are the same questions in both forms, in the same order.
   Every line is in Hindi and English.

   Scene: { say:{en,hi}, art, pause? }
     art   a lesson-player beat (lesArt: group, count, clock…), or
           { t:'column', a, b, op, mark } — a column sum, or
           { t:'letters', text } — big letters
     pause { q:{en,hi}, opts:[{en,hi}, {en,hi}], right, praise:{en,hi}, show:{en,hi} }
   ================================================================== */
const vidT = (en, hi) => ({ en, hi: hi == null ? en : hi });

const VIDEOS = [

  /* ---------- tens and ones ---------- */
  { id:'v-tens', skill:'place2', classes:['c1','c2','c3'], ic:'🥢', obj:'🥢',
    title: vidT('Bundles of ten', 'दस का बंडल'),
    scenes: [
      { say: vidT('Ten sticks. Counting them one by one takes so long!', 'दस तीलियाँ। एक-एक करके गिनने में बहुत समय लगता है!'), art:{ t:'count', n:10 } },
      { say: vidT('So we tie ten sticks together. One bundle is one ten.', 'इसलिए हम दस तीलियों को एक साथ बाँध देते हैं। एक बंडल यानी एक दहाई।'), art:{ t:'group', a:10 } },
      { say: vidT('Two bundles and three loose sticks: two tens and three ones. That is twenty-three.', 'दो बंडल और तीन खुली तीलियाँ: दो दहाई और तीन इकाई। यानी तेईस।'), art:{ t:'group', a:23 } },
      { say: vidT('Look at these sticks.', 'इन तीलियों को देखो।'), art:{ t:'group', a:34, ask:'tens' },
        pause:{ q: vidT('How many bundles of ten?', 'दस के कितने बंडल हैं?'), opts:[vidT('3'), vidT('4')], right:0,
                praise: vidT('Yes! Three bundles: three tens.', 'हाँ! तीन बंडल: तीन दहाई।'),
                show: vidT('Count the bundles: one, two, three. The four loose sticks are the ones.', 'बंडल गिनो: एक, दो, तीन। चार खुली तीलियाँ इकाई हैं।') } },
      { say: vidT('In 34, the 3 tells the bundles of ten, and the 4 tells the loose ones.', '34 में, 3 बताता है दस के बंडल, और 4 बताता है खुली तीलियाँ।'), art:{ t:'letters', text:'34 = 3 × 10 + 4' } },
      { say: vidT('Now you think.', 'अब तुम सोचो।'), art:{ t:'letters', text:'5 × 10 + 2' },
        pause:{ q: vidT('Which number is five tens and two ones?', 'पाँच दहाई और दो इकाई कौन सी संख्या है?'), opts:[vidT('25'), vidT('52')], right:1,
                praise: vidT('Yes! Fifty-two. The tens come first.', 'हाँ! बावन। दहाई पहले आती है।'),
                show: vidT('Fifty-two: 5 tens first, then 2 ones. 25 would be two tens.', 'बावन: पहले 5 दहाई, फिर 2 इकाई। 25 में सिर्फ़ दो दहाई होतीं।') } }
    ],
    grownup: vidT('Make bundles of ten with matchsticks or straws and a rubber band, then make a number together.', 'माचिस की तीलियों या स्ट्रॉ से रबर बैंड लगाकर दस-दस के बंडल बनाएँ, फिर साथ में कोई संख्या बनाएँ।'),
    home: vidT('Ask: "Show me 23 with bundles."', 'पूछें: "बंडल से 23 बनाकर दिखाओ।"') },

  /* ---------- adding with carrying ---------- */
  { id:'v-carry', skill:'carry', classes:['c2','c3'], ic:'➕', obj:'🥢',
    title: vidT('Carrying a ten', 'हासिल लेना'),
    scenes: [
      { say: vidT('38 plus 24. We always start with the ones.', '38 जमा 24। हम हमेशा इकाई से शुरू करते हैं।'), art:{ t:'column', a:38, b:24, op:'+', mark:'' } },
      { say: vidT('8 ones and 4 ones make 12 ones. That is more than nine!', '8 इकाई और 4 इकाई मिलकर 12 इकाई। यह नौ से ज़्यादा है!'), art:{ t:'column', a:38, b:24, op:'+', mark:'ones' },
        pause:{ q: vidT('12 ones: what do we write under the ones?', '12 इकाई: इकाई के नीचे क्या लिखेंगे?'), opts:[vidT('12'), vidT('2')], right:1,
                praise: vidT('Yes! We write 2, and the ten goes up to the tens.', 'हाँ! हम 2 लिखते हैं, और दस दहाई में चला जाता है।'),
                show: vidT('Only one digit fits under the ones. 12 is one ten and 2 ones: write 2, carry the ten.', 'इकाई के नीचे एक ही अंक आता है। 12 यानी एक दहाई और 2 इकाई: 2 लिखो, दहाई हासिल लो।') } },
      { say: vidT('Write 2. The ten goes up: a little 1 on top of the tens.', '2 लिखो। दहाई ऊपर जाती है: दहाई के ऊपर छोटा सा 1।'), art:{ t:'column', a:38, b:24, op:'+', mark:'carry' } },
      { say: vidT('Tens: 3 and 2, and the 1 we carried.', 'दहाई: 3 और 2, और हासिल का 1।'), art:{ t:'column', a:38, b:24, op:'+', mark:'carry' },
        pause:{ q: vidT('So 38 plus 24 is…?', 'तो 38 जमा 24 कितना?'), opts:[vidT('62'), vidT('52')], right:0,
                praise: vidT('Yes! 62. You remembered the carried ten.', 'हाँ! 62। तुम्हें हासिल याद रहा।'),
                show: vidT('3 and 2 is 5, and the carried 1 makes 6: 62. Without the carried ten it would be 52.', '3 और 2 मिलकर 5, और हासिल का 1 जोड़कर 6: 62। हासिल भूल जाते तो 52 होता।') } },
      { say: vidT('38 plus 24 is 62.', '38 जमा 24 बराबर 62।'), art:{ t:'column', a:38, b:24, op:'+', mark:'done' } }
    ],
    grownup: vidT('Add with bundles: when ten loose sticks pile up, tie them into a bundle and move it to the tens.', 'बंडल से जोड़ें: जब दस खुली तीलियाँ हो जाएँ, उनका बंडल बनाकर दहाई में रखें।'),
    home: vidT('Ask: "17 plus 5 — do we need to carry?"', 'पूछें: "17 जमा 5 — क्या हासिल लेना पड़ेगा?"') },

  /* ---------- taking away with borrowing ---------- */
  { id:'v-borrow', skill:'borrow', classes:['c2','c3'], ic:'➖', obj:'🥢',
    title: vidT('Borrowing a ten', 'उधार लेना'),
    scenes: [
      { say: vidT('52 take away 27. Ones first: 2 take away 7.', '52 में से 27। पहले इकाई: 2 में से 7।'), art:{ t:'column', a:52, b:27, op:'−', mark:'ones' },
        pause:{ q: vidT('2 is smaller than 7. What do we do?', '2, 7 से छोटा है। क्या करें?'), opts:[vidT('Borrow a ten', 'एक दहाई उधार लो'), vidT('Do 7 take away 2', '7 में से 2 कर दो')], right:0,
                praise: vidT('Yes! We borrow a ten.', 'हाँ! हम एक दहाई उधार लेते हैं।'),
                show: vidT('We always take from the top number — 2, not 7. It is too small, so we borrow a ten.', 'हम हमेशा ऊपर वाली संख्या से घटाते हैं — 2 से, 7 से नहीं। वह छोटी है, इसलिए दहाई उधार लेते हैं।') } },
      { say: vidT('Open one bundle. Now there are 4 tens, and 12 ones.', 'एक बंडल खोलो। अब 4 दहाई हैं, और 12 इकाई।'), art:{ t:'column', a:52, b:27, op:'−', mark:'borrow' } },
      { say: vidT('12 take away 7 is 5. Tens: 4 take away 2.', '12 में से 7 गए, 5 बचे। दहाई: 4 में से 2।'), art:{ t:'column', a:52, b:27, op:'−', mark:'borrow' },
        pause:{ q: vidT('So 52 take away 27 is…?', 'तो 52 में से 27 घटाओ तो कितना?'), opts:[vidT('35'), vidT('25')], right:1,
                praise: vidT('Yes! 25. The borrowed ten left only 4 tens.', 'हाँ! 25। दहाई उधार देने से 4 ही बचीं।'),
                show: vidT('After borrowing there are 4 tens, not 5: 4 take away 2 is 2, so 25.', 'उधार देने के बाद 5 नहीं, 4 दहाई हैं: 4 में से 2 गए, 2 बचे, तो 25।') } },
      { say: vidT('52 take away 27 is 25.', '52 में से 27 घटाओ तो 25।'), art:{ t:'column', a:52, b:27, op:'−', mark:'done' } }
    ],
    grownup: vidT('Take away with bundles: when there aren\'t enough loose sticks, open a bundle.', 'बंडल से घटाएँ: जब खुली तीलियाँ कम पड़ें, एक बंडल खोल दें।'),
    home: vidT('Ask: "43 take away 8 — do we need to open a bundle?"', 'पूछें: "43 में से 8 — क्या बंडल खोलना पड़ेगा?"') },

  /* ---------- the आ and इ मात्रा ---------- */
  { id:'v-matra', skill:'u-matra1', classes:['ukg','c1'], ic:'🔡', obj:'✏️',
    title: vidT('The आ and इ signs', 'आ और इ की मात्रा'),
    scenes: [
      { say: vidT('This is क. Add the standing line ा after it, and क becomes long: का.', 'यह क है। इसके बाद खड़ी पाई ा लगाओ, तो क लंबा हो जाता है: का।'), art:{ t:'letters', text:'क + ा = का' } },
      { say: vidT('म and ा make मा. मा… मा… मामा!', 'म और ा से बना मा। मा… मा… मामा!'), art:{ t:'letters', text:'म + ा = मा' },
        pause:{ q: vidT('Which one says "का"?', 'कौन सा "का" है?'), opts:[vidT('क'), vidT('का')], right:1,
                praise: vidT('Yes! का has the standing line.', 'हाँ! का में खड़ी पाई है।'),
                show: vidT('This one: क with the standing line ा says का.', 'यह वाला: क में खड़ी पाई ा लगी है, यह का है।') } },
      { say: vidT('This sign ि is written BEFORE the letter, but we say it after: कि.', 'यह मात्रा ि अक्षर से पहले लिखी जाती है, पर बोली बाद में जाती है: कि।'), art:{ t:'letters', text:'क + ि = कि' } },
      { say: vidT('दिन. किताब. Can you hear इ?', 'दिन। किताब। इ सुनाई दी?'), art:{ t:'letters', text:'दिन · किताब' },
        pause:{ q: vidT('Which one says "मि"?', 'कौन सा "मि" है?'), opts:[vidT('मि'), vidT('मा')], right:0,
                praise: vidT('Yes! मि — the sign comes first, but we say म first.', 'हाँ! मि — मात्रा पहले लिखी है, पर बोलते म पहले हैं।'),
                show: vidT('This one: ि before म says मि. मा has the standing line.', 'यह वाला: म से पहले ि, यह मि है। मा में खड़ी पाई है।') } }
    ],
    grownup: vidT('Write क, म and न on paper, then add ा and ि together and read them aloud.', 'कागज़ पर क, म और न लिखें, फिर साथ में ा और ि लगाकर ज़ोर से पढ़ें।'),
    home: vidT('Ask: "What do क and ा make?"', 'पूछें: "क और ा से क्या बनता है?"') },

  /* ---------- o'clock ---------- */
  { id:'v-clock', skill:'time2', classes:['c1','c2'], ic:'🕒', obj:'🕒',
    title: vidT("What o'clock is it?", 'कितने बजे हैं?'),
    scenes: [
      { say: vidT('A clock has two hands. The short hand tells the hour.', 'घड़ी में दो सुइयाँ होती हैं। छोटी सुई घंटा बताती है।'), art:{ t:'clock', h:3, m:0 } },
      { say: vidT("The long hand points straight up, to the 12. So it is 3 o'clock.", 'बड़ी सुई सीधे ऊपर, 12 पर है। तो 3 बजे हैं।'), art:{ t:'clock', h:3, m:0 } },
      { say: vidT('Look at this clock.', 'इस घड़ी को देखो।'), art:{ t:'clock', h:7, m:0, ask:'time' },
        pause:{ q: vidT('What time is it?', 'कितने बजे हैं?'), opts:[vidT("7 o'clock", '7 बजे'), vidT("12 o'clock", '12 बजे')], right:0,
                praise: vidT("Yes! The short hand is on 7: 7 o'clock.", 'हाँ! छोटी सुई 7 पर है: 7 बजे।'),
                show: vidT("The short hand tells the hour — it is on 7. The long hand on 12 just means o'clock.", 'घंटा छोटी सुई बताती है — वह 7 पर है। बड़ी सुई 12 पर होने का मतलब है पूरे बजे।') } },
      { say: vidT('The long hand goes all the way round in one hour. The short hand moves to the next number.', 'बड़ी सुई एक घंटे में पूरा चक्कर लगाती है। छोटी सुई अगली संख्या पर पहुँचती है।'), art:{ t:'clock', h:4, m:0 } },
      { say: vidT('One more.', 'एक और।'), art:{ t:'clock', h:9, m:0, ask:'time' },
        pause:{ q: vidT('What time is it?', 'कितने बजे हैं?'), opts:[vidT("10 o'clock", '10 बजे'), vidT("9 o'clock", '9 बजे')], right:1,
                praise: vidT("Yes! 9 o'clock.", 'हाँ! 9 बजे।'),
                show: vidT("The short hand is on 9: 9 o'clock.", 'छोटी सुई 9 पर है: 9 बजे।') } }
    ],
    grownup: vidT('At each meal, look at a clock together and say the hour.', 'हर खाने के समय साथ में घड़ी देखें और घंटा बोलें।'),
    home: vidT('Ask: "Where is the short hand now?"', 'पूछें: "छोटी सुई अभी कहाँ है?"') }
];

/* The videos a class is offered, its own first. */
function videosFor(cls){ return VIDEOS.filter(v => v.classes.includes(cls)); }
function videoById(id){ return VIDEOS.find(v => v.id === id) || null; }
/* Every pause, in order — the filmed clip stops at the same questions. */
function videoPauses(v){ return v.scenes.filter(s => s.pause).map(s => s.pause); }
