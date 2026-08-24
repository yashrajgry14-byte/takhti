/* ---------------- content pack (ships in the APK) ---------------- */
/* Graded by word count: L1 3-4, L2 5-6, L3 6-8, L4 8-10, L5 10-12, L6 12-15.
   Vocabulary a child in India actually meets — family, school, animals,
   festivals, food, weather — not translated word lists. */
const SENTENCES = {
  en: {
    1:['The sun is hot.','A cat sat.','I see a bird.','My mango is sweet.',
       'I like milk.','The dog can run.','Rani has a ball.','We ate rice.'],
    2:['The big dog runs fast.','My sister has a red bag.','We fly a kite today.',
       'The cow gives us milk.','Birds sing in the morning.','I eat rice and dal.',
       'The ball rolled under the bed.','Grandmother tells a short story.'],
    3:['We walk to school every morning.','The farmer waters his green field.',
       'Children play cricket in the park.','My father drives me to school.',
       'The monkey jumped from tree to tree.','We light diyas during the festival.',
       'The teacher wrote our names on the board.','Grandfather waters the plants every evening.'],
    4:['Birds build their nests high in the tall trees.',
       'The children flew colourful kites on the terrace.',
       'Every evening the whole family sits together for dinner.',
       'The vendor sells mangoes and bananas near the station.',
       'Our school bus stops outside the big yellow gate.',
       'The farmer ploughed his field before the rains came.',
       'We drew a rangoli outside our house for the festival.',
       'The elephant walked slowly through the crowded village street.'],
    5:['The rain filled the village pond by the evening light.',
       'My grandmother tells stories about her childhood in the village.',
       'The whole class went on a trip to the museum.',
       'During the monsoon the river behind our house rises quickly.',
       'Every winter morning we wrap ourselves in warm woollen blankets.',
       'The fisherman rowed his small boat across the calm river.',
       'Farmers across the village celebrate the harvest with music and dance.',
       'Our teacher took us to the garden to plant new saplings.'],
    6:['Children carried their books carefully across the muddy road to reach school on time.',
       'Every year our whole family travels to our grandparents village to celebrate the festival.',
       'The old banyan tree has watched three generations of children play in its shade.',
       'After the heavy rains the farmers happily began sowing seeds in their ploughed fields.',
       'On Republic Day the whole school gathers in the ground to sing the national anthem.',
       'The fishermen returned to the shore as the sun began to set behind the hills.',
       'My grandfather says the mango tree in our courtyard is older than my father.',
       'During summer holidays we visit our cousins and play late into the warm evening.']
  },
  hi: {
    1:['सूरज गरम है।','बिल्ली बैठी है।','मैं पक्षी देखता हूँ।','आम मीठा है।',
       'मेरी माँ आई।','कुत्ता भौंकता है।','मुझे दूध पसंद है।','गेंद लाल है।'],
    2:['बड़ा कुत्ता तेज़ दौड़ता है।','मेरी बहन के पास बस्ता है।','नदी में नाव चलती है।',
       'छोटा बच्चा दूध पीता है।','हम रोज़ पार्क जाते हैं।','गाय हमें दूध देती है।',
       'तोता पेड़ पर बैठा है।','दादी मुझे कहानी सुनाती हैं।'],
    3:['हम रोज़ सुबह स्कूल जाते हैं।','किसान अपने खेत में पानी देता है।',
       'बच्चे मैदान में क्रिकेट खेलते हैं।','दीवाली पर हम घर में दीये जलाते हैं।',
       'पिताजी मुझे रोज़ स्कूल छोड़ते हैं।','बंदर पेड़ से पेड़ पर कूदता है।',
       'अध्यापक ने बच्चों के नाम बोर्ड पर लिखे।','दादा जी रोज़ पौधों को पानी देते हैं।'],
    4:['पक्षी ऊँचे पेड़ों पर अपना घोंसला बनाते हैं।',
       'बच्चों ने आज छत पर रंग-बिरंगी पतंगें उड़ाईं।',
       'शाम को पूरा परिवार साथ बैठकर खाना खाता है।',
       'गाँव के बाहर एक बहुत पुराना कुआँ है।',
       'मेला देखने के लिए सब लोग बाज़ार पहुँचे।',
       'किसान ने बारिश से पहले अपना खेत जोत दिया।',
       'हाथी धीरे-धीरे गाँव की भीड़भाड़ वाली गली से गुज़रा।',
       'त्योहार के दिन हमने घर के बाहर रंगोली बनाई।'],
    5:['शाम होते-होते बारिश ने पूरे गाँव का तालाब भर दिया।',
       'दादी हमें अपने बचपन के गाँव की कहानियाँ सुनाती हैं।',
       'आज पूरी कक्षा घूमने के लिए बड़े संग्रहालय गई थी।',
       'बरसात में हमारे घर के पीछे की नदी तेज़ी से बढ़ती है।',
       'सर्दियों की हर सुबह हम गरम ऊनी कंबल ओढ़ लेते हैं।',
       'मछुआरे ने अपनी छोटी नाव शांत नदी में खे दी।',
       'गाँव भर के किसान मिलकर फसल का त्योहार मनाते हैं।',
       'हमारी अध्यापिका हमें बगीचे में नए पौधे लगाना सिखाती हैं।'],
    6:['बच्चे अपनी किताबें सँभालकर कीचड़ भरी सड़क पार करके समय पर स्कूल पहुँचे।',
       'सर्दियों में सूरज पहाड़ों के पीछे जल्दी छिप जाता है और अँधेरा घिर आता है।',
       'हर साल हमारा पूरा परिवार त्योहार मनाने के लिए दादा-दादी के गाँव जाता है।',
       'गाँव के पुराने बरगद ने कई पीढ़ियों के बच्चों को बड़ा होते देखा है।',
       'तेज़ बारिश के बाद किसानों ने अपने जुते हुए खेतों में बीज बोना शुरू किया।',
       'गणतंत्र दिवस पर पूरा विद्यालय मैदान में इकट्ठा होकर राष्ट्रगान गाता है।',
       'मछुआरे सूरज ढलने से ठीक पहले अपनी नावें लेकर किनारे पर लौट आए।',
       'गर्मियों की छुट्टियों में हम अपने चचेरे भाई-बहनों के साथ देर शाम तक खेलते हैं।']
  }
};

/* GLYPHS: levels 1-3 are the full Devanagari varnamala (vowels, then the
   consonants split across two levels); 4-6 are simple real words, graded
   short-to-long. English mirrors the same shape: the alphabet across
   levels 1-3, then words of growing length. */
const GLYPHS = {
  en: {
    1:['a','b','c','d','e','f','g','h','i'],
    2:['j','k','l','m','n','o','p','q','r'],
    3:['s','t','u','v','w','x','y','z'],
    4:['cat','sun','dog','hat','pen','run','mat','bus'],
    5:['bird','frog','kite','milk','rain','star','fish','moon'],
    6:['school','mother','father','garden','friend','animal','picture','birthday']
  },
  hi: {
    1:['अ','आ','इ','ई','उ','ऊ','ए','ऐ','ओ','औ'],
    2:['क','ख','ग','घ','ङ','च','छ','ज','झ','ञ','ट','ठ','ड','ढ','ण'],
    3:['त','थ','द','ध','न','प','फ','ब','भ','म','य','र','ल','व','श','ष','स','ह'],
    4:['घर','नल','फल','जल','कमल','बस','रथ','कलम'],
    5:['पानी','आम','गाय','हाथी','मछली','किताब','बकरी','कुर्सी'],
    6:['विद्यालय','बगीचा','कहानी','परिवार','त्योहार','दोस्ती','समुद्र','पहाड़']
  }
};
const OFFLINE_PACK = [
  { keys:['sky','blue','आसमान','नीला'], title:'Why is the sky blue?', hi:'आसमान नीला क्यों है?',
    panels:[
      {art:'☀️', en:'Sunlight looks white, but it is really all the colours mixed together.', hi:'सूरज की रोशनी सफ़ेद दिखती है, पर उसमें सारे रंग छिपे होते हैं।'},
      {art:'🌬️', en:'The air is full of tiny bits. Blue light bounces off them the most.', hi:'हवा में बहुत छोटे कण होते हैं। नीला रंग उनसे सबसे ज़्यादा टकराता है।'},
      {art:'🩵', en:'So blue light scatters all over the sky — and that is the colour you see!', hi:'इसलिए नीला रंग पूरे आसमान में फैल जाता है — वही तुम्हें दिखता है!'}
    ],
    quiz:{ en:'Which colour bounces around the most?', hi:'कौन सा रंग सबसे ज़्यादा टकराता है?', opts:['Blue','Red'], hiOpts:['नीला','लाल'], correct:0 } },
  { keys:['rain','बारिश','पानी'], title:'Where does rain come from?', hi:'बारिश कहाँ से आती है?',
    panels:[
      {art:'🌊', en:'The sun warms rivers and seas, and water quietly floats up as vapour.', hi:'सूरज नदी और समुद्र को गरम करता है, पानी भाप बनकर ऊपर उठता है।'},
      {art:'☁️', en:'High up it is cold. The vapour turns into tiny drops and makes a cloud.', hi:'ऊपर ठंड होती है। भाप छोटी बूँदें बनकर बादल बना देती है।'},
      {art:'🌧️', en:'When the drops get heavy, they fall back down. That is rain.', hi:'बूँदें भारी हो जाती हैं और गिर पड़ती हैं। यही बारिश है।'}
    ],
    quiz:{ en:'What makes water rise up?', hi:'पानी को ऊपर कौन उठाता है?', opts:['The sun','The moon'], hiOpts:['सूरज','चाँद'], correct:0 } },
  { keys:['moon','shape','चाँद'], title:'Why does the moon change shape?', hi:'चाँद अपना आकार क्यों बदलता है?',
    panels:[
      {art:'🌑', en:'The moon makes no light of its own. The sun lights up one side of it.', hi:'चाँद की अपनी रोशनी नहीं है। सूरज उसका एक हिस्सा चमकाता है।'},
      {art:'🌓', en:'As the moon travels around us, we see that lit side from different angles.', hi:'चाँद हमारे चारों ओर घूमता है, तो हमें चमकता हिस्सा अलग-अलग दिखता है।'},
      {art:'🌕', en:'Sometimes we see all of it, sometimes only a sliver. Same moon!', hi:'कभी पूरा दिखता है, कभी पतली रेखा। चाँद वही है!'}
    ],
    quiz:{ en:'Does the moon make its own light?', hi:'क्या चाँद की अपनी रोशनी है?', opts:['No','Yes'], hiOpts:['नहीं','हाँ'], correct:0 } }
];
