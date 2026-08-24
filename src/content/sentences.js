/* ---------------- content pack (ships in the APK) ---------------- */
const SENTENCES = {
  en: {
    1:['The sun is hot.','A cat sat.','I see a bird.'],
    2:['The big dog runs fast.','My sister has a red bag.'],
    3:['We walk to school every morning.','The farmer waters his green field.'],
    4:['Birds build their nests high in the tall trees.'],
    5:['The rain filled the village pond by the evening.'],
    6:['Children carried their books carefully across the muddy road.']
  },
  hi: {
    1:['सूरज गरम है।','बिल्ली बैठी है।','मैं पक्षी देखता हूँ।','आम मीठा है।','माँ आई।'],
    2:['बड़ा कुत्ता तेज़ दौड़ता है।','मेरी बहन के पास लाल बस्ता है।','नदी में नाव चलती है।','छोटा बच्चा दूध पीता है।'],
    3:['हम रोज़ सुबह स्कूल जाते हैं।','किसान अपने खेत में पानी देता है।','दादी मुझे कहानी सुनाती है।'],
    4:['पक्षी ऊँचे पेड़ों पर अपना घोंसला बनाते हैं।','गाँव के बाहर एक पुराना कुआँ है।'],
    5:['शाम तक बारिश ने गाँव का तालाब भर दिया।','मेला देखने के लिए सब लोग बाज़ार पहुँचे।'],
    6:['बच्चे अपनी किताबें सँभालकर कीचड़ भरी सड़क पार ले गए।','सर्दियों में सूरज पहाड़ों के पीछे जल्दी छिप जाता है।']
  }
};
const GLYPHS = {
  en: { 1:['l','o','c'], 2:['a','e','n'], 3:['b','g','k'], 4:['cat','sun'], 5:['bird'], 6:['school'] },
  hi: { 1:['ा','ि','क'], 2:['अ','आ','न'], 3:['म','ग','ल'], 4:['घर'], 5:['नदी'], 6:['विद्यालय'] }
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
