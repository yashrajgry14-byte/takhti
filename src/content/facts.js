/* ==================================================================
   FACT LIBRARY — three per game, so "fact day" never repeats.
   h = the hero number the card pulls out big. u = unit key.
   dot = an emoji to lay out h times, turning the number into a
   countable row. Every fact carries one real curriculum idea.
   ================================================================== */
const UNITS = {
  metres:{en:'metres',hi:'मीटर'},        players:{en:'players',hi:'खिलाड़ी'},
  points:{en:'points',hi:'अंक'},          balls:{en:'balls',hi:'गेंदें'},
  stones:{en:'stones',hi:'पत्थर'},        feathers:{en:'feathers',hi:'पंख'},
  seconds:{en:'seconds',hi:'सेकंड'},      minutes:{en:'minutes',hi:'मिनट'},
  degrees:{en:'degrees',hi:'डिग्री'},     patches:{en:'patches',hi:'टुकड़े'},
  touches:{en:'touches',hi:'स्पर्श'},     boxes:{en:'boxes',hi:'खाने'},
  chits:{en:'chits',hi:'पर्चियाँ'},       walls:{en:'walls',hi:'दीवारें'},
  leg:{en:'leg',hi:'टाँग'},               kmh:{en:'km per hour',hi:'किमी प्रति घंटा'},
  percent:{en:'per cent water',hi:'प्रतिशत पानी'}, sticks:{en:'sticks',hi:'डंडे'}
};
const FACTS = {
 cricket:[
  {h:20,u:'metres',en:'A cricket pitch is about 20 metres long — that is 12 kids lying head to toe!',hi:'क्रिकेट की पिच लगभग 20 मीटर लंबी होती है — यानी 12 बच्चे सिर से पैर तक लेट जाएँ इतनी!'},
  {h:6,u:'balls',dot:'🔴',en:'One over is 6 balls. So two overs is 6 + 6 = 12 balls.',hi:'एक ओवर में 6 गेंदें। तो दो ओवर यानी 6 + 6 = 12 गेंदें।'},
  {h:11,u:'players',dot:'🧍',en:'Each team has 11 players. Two teams together make 22 people on the field.',hi:'हर टीम में 11 खिलाड़ी। दोनों मिलाकर मैदान पर 22 लोग।'}],
 football:[
  {h:32,u:'patches',en:'A football is stitched from 32 patches: 20 hexagons with 6 sides, and 12 pentagons with 5.',hi:'फ़ुटबॉल 32 टुकड़ों से सिली जाती है: 20 षट्भुज (6 भुजा) और 12 पंचभुज (5 भुजा)।'},
  {h:90,u:'minutes',en:'A match runs 90 minutes — that is one and a half hours of running.',hi:'मैच 90 मिनट का होता है — यानी डेढ़ घंटे की दौड़।'},
  {h:11,u:'players',dot:'🧍',en:'Eleven players a side: one keeper and ten others. 1 + 10 = 11.',hi:'हर तरफ़ ग्यारह खिलाड़ी: एक गोलकीपर और दस बाकी। 1 + 10 = 11।'}],
 tennis:[
  {en:'A tennis ball is fuzzy on purpose. The tiny hairs drag against the air and slow it down.',hi:'टेनिस गेंद पर रोएँ जान-बूझकर होते हैं। ये हवा से रगड़ खाकर गेंद को धीमा करते हैं।'},
  {h:15,u:'points',en:'Tennis scores go 15, 30, 40 — the first two jumps count up in fifteens.',hi:'टेनिस में गिनती 15, 30, 40 चलती है — पहले दो कदम पंद्रह-पंद्रह के।'},
  {h:2,u:'points',en:'If the ball bounces twice on your side, the point is gone. Once is fine, twice is out.',hi:'गेंद तुम्हारी तरफ़ दो बार उछल गई तो अंक गया। एक बार ठीक, दो बार आउट।'}],
 basketball:[
  {h:3,u:'metres',en:'A basketball hoop is 3 metres high — two grown-ups standing on each other!',hi:'बास्केटबॉल का घेरा 3 मीटर ऊँचा होता है — दो बड़े लोग एक के ऊपर एक खड़े हों, इतना!'},
  {h:5,u:'players',dot:'🧍',en:'Five players a side. Both teams together make 5 + 5 = 10 on court.',hi:'हर तरफ़ पाँच खिलाड़ी। दोनों मिलाकर 5 + 5 = 10 कोर्ट पर।'},
  {h:3,u:'points',en:'A shot from far away is worth 3 points; a close one is worth 2. Distance pays!',hi:'दूर से डाला गोल 3 अंक का, पास से 2 अंक का। दूरी का इनाम!'}],
 badminton:[
  {h:16,u:'feathers',dot:'🪶',en:'A shuttlecock has exactly 16 feathers. Count them: 4 + 4 + 4 + 4 = 16.',hi:'शटल में ठीक 16 पंख होते हैं। गिनो: 4 + 4 + 4 + 4 = 16।'},
  {h:21,u:'points',en:'You need 21 points to win a game — that is 20 and one more.',hi:'गेम जीतने के लिए 21 अंक चाहिए — यानी 20 और एक और।'},
  {h:400,u:'kmh',en:'A hard smash can fly faster than 400 km an hour — quicker than any other racket sport.',hi:'तेज़ स्मैश 400 किमी प्रति घंटा से भी तेज़ जा सकता है — किसी भी रैकेट खेल से तेज़।'}],
 volleyball:[
  {h:6,u:'players',dot:'🧍',en:'Six players on each side. 6 + 6 = 12 players on the whole court.',hi:'हर तरफ़ छह खिलाड़ी। 6 + 6 = 12 खिलाड़ी पूरे कोर्ट पर।'},
  {h:3,u:'touches',dot:'👐',en:'Your team gets only 3 touches before the ball must go over the net.',hi:'गेंद जाल के पार भेजने से पहले तुम्हारी टीम सिर्फ़ 3 बार छू सकती है।'},
  {h:25,u:'points',en:'A set is won at 25 points. That is 5 groups of 5.',hi:'सेट 25 अंक पर जीता जाता है। यानी 5 के 5 समूह।'}],
 squash:[
  {en:'A squash ball bounces higher when it is warm, so players hit it a few times to heat it up.',hi:'स्क्वैश की गेंद गरम होने पर ज़्यादा उछलती है, इसलिए खिलाड़ी पहले उसे मारकर गरम करते हैं।'},
  {h:4,u:'walls',en:'You may use all 4 walls — even the one behind you. The ball bounces off each one.',hi:'चारों दीवारें इस्तेमाल कर सकते हो — पीछे वाली भी। गेंद हर दीवार से टकराकर लौटती है।'},
  {h:11,u:'points',en:'A squash game goes to 11 points. Ten, and one more.',hi:'स्क्वैश का खेल 11 अंक तक चलता है। दस, और एक और।'}],
 pithoo:[
  {h:7,u:'stones',dot:'🪨',en:'Pithoo uses 7 flat stones. The widest goes at the bottom — that is why the tower stands.',hi:'पिट्ठू में 7 चपटे पत्थर होते हैं। सबसे चौड़ा नीचे — तभी ढेर खड़ा रहता है।'},
  {h:2,u:'players',en:'Two teams: one knocks the stones down, the other races to stack them back up.',hi:'दो टीमें: एक ढेर गिराती है, दूसरी दौड़कर फिर से जमाती है।'},
  {en:'A tall stack falls easily. A wide base holds it up — that is why buildings have big foundations.',hi:'ऊँचा ढेर जल्दी गिरता है। चौड़ी नींव उसे सँभालती है — इसीलिए इमारतों की नींव बड़ी होती है।'}],
 gilli:[
  {en:'Tap one end of the gilli and the other end flies up. That is a lever — just like a see-saw!',hi:'गिल्ली के एक सिरे पर मारो तो दूसरा उछल जाता है। यही लीवर है — सी-सॉ की तरह!'},
  {h:2,u:'sticks',en:'Two sticks: a long danda and a short gilli. Long hits short — that is the whole game.',hi:'दो डंडे: एक लंबा डंडा, एक छोटी गिल्ली। लंबा छोटे को मारता है — बस यही खेल है।'},
  {en:'You measure how far the gilli flew using the danda itself. Your bat becomes your ruler!',hi:'गिल्ली कितनी दूर गई, यह डंडे से ही नापते हो। तुम्हारा डंडा ही तुम्हारा पैमाना बन जाता है!'}],
 lattu:[
  {en:'A spinning top stays standing while it spins. The moment it slows, it topples over.',hi:'लट्टू घूमते-घूमते खड़ा रहता है। जैसे ही धीमा होता है, लुढ़क जाता है।'},
  {h:1,u:'points',en:'A whole lattu balances on a single tiny point. Try that with your finger!',hi:'पूरा लट्टू एक छोटे से नुकीले बिंदु पर टिका रहता है। उँगली से करके देखो!'},
  {en:'The string holds your pull and gives it back as spin. You store the push, then release it.',hi:'रस्सी तुम्हारा खिंचाव रोककर घुमाव में बदल देती है। तुम धक्का जमा करते हो, फिर छोड़ते हो।'}],
 kanche:[
  {en:'When your marble hits another, yours stops and the other shoots off. The push travels across.',hi:'तुम्हारा कंचा दूसरे से टकराए तो तुम्हारा रुक जाता है, दूसरा भाग जाता है। धक्का पार चला जाता है।'},
  {en:'You aim in a straight line, because a straight line is the shortest path to the target.',hi:'तुम सीधी रेखा में निशाना लगाते हो, क्योंकि सीधी रेखा ही सबसे छोटा रास्ता है।'},
  {en:'Glass marbles are made by rolling a blob of hot, soft glass until it becomes a perfect ball.',hi:'काँच के कंचे गरम नरम काँच को घुमाकर बनाए जाते हैं, जब तक वो पूरा गोल न हो जाए।'}],
 pakdam:[
  {en:'Whoever covers more ground in the same time is faster. Speed is distance in a given time.',hi:'जो उतने ही समय में ज़्यादा दूरी तय करे वो तेज़ है। चाल यानी समय में तय की गई दूरी।'},
  {en:'To turn sharply you lean inwards. Lean too far and you fall — that is balance at work.',hi:'तेज़ मुड़ना हो तो अंदर की ओर झुकते हो। ज़्यादा झुके तो गिर जाओगे — यही संतुलन है।'},
  {en:'Running makes you warm because your muscles give off heat while they work.',hi:'दौड़ने से गरमी लगती है क्योंकि काम करते समय माँसपेशियाँ गर्मी छोड़ती हैं।'}],
 khokho:[
  {h:9,u:'players',dot:'🧍',en:'Nine players a team: 8 sitting in the line and 1 chasing.',hi:'हर टीम में नौ खिलाड़ी: 8 कतार में बैठे और 1 पीछा करता हुआ।'},
  {h:8,u:'players',en:'The 8 sitting players face alternate ways — left, right, left, right. A pattern!',hi:'बैठे हुए 8 खिलाड़ी बारी-बारी उल्टा देखते हैं — बाएँ, दाएँ, बाएँ, दाएँ। यही पैटर्न है!'},
  {h:7,u:'minutes',en:'A turn lasts 7 minutes. Four turns make one full match.',hi:'एक पारी 7 मिनट की होती है। चार पारियों का पूरा मैच बनता है।'}],
 kabaddi:[
  {en:'A raider must keep saying "kabaddi" without breathing in. Your lungs hold that air the whole time!',hi:'रेडर को बिना साँस लिए लगातार "कबड्डी" बोलना होता है। पूरी हवा फेफड़ों में रुकी रहती है!'},
  {h:7,u:'players',dot:'🧍',en:'Seven players a side. When one is out, six defend — 7 − 1 = 6.',hi:'हर तरफ़ सात खिलाड़ी। एक आउट हुआ तो छह बचाव करते हैं — 7 − 1 = 6।'},
  {h:30,u:'seconds',en:'A raid can last up to 30 seconds — half a minute of holding your breath.',hi:'एक रेड 30 सेकंड तक चल सकती है — आधा मिनट साँस रोककर।'}],
 chorsipahi:[
  {h:4,u:'chits',dot:'📄',en:'Four folded chits, one says chor. Your chance of picking it is 1 out of 4 — a quarter.',hi:'चार मुड़ी पर्चियाँ, एक पर चोर। उसे उठाने का मौका 4 में से 1 है — एक चौथाई।'},
  {h:4,u:'players',en:'Four roles: raja, mantri, chor, sipahi. Everyone gets exactly one.',hi:'चार भूमिकाएँ: राजा, मंत्री, चोर, सिपाही। हर किसी को ठीक एक मिलती है।'},
  {en:'Play four rounds and you would expect to be the chor about once. Not always — just usually.',hi:'चार बार खेलो तो लगभग एक बार चोर बनने की उम्मीद है। हमेशा नहीं — आम तौर पर।'}],
 langdi:[
  {h:1,u:'leg',en:'On one leg you wobble, so you spread your arms. Wide arms make balancing easier.',hi:'एक टाँग पर डगमगाते हो, तो हाथ फैला लेते हो। फैले हाथ संतुलन आसान कर देते हैं।'},
  {en:'Standing on one leg uses far more muscles than two — your whole body works to hold you up.',hi:'एक टाँग पर खड़े होने में दो से कहीं ज़्यादा माँसपेशियाँ लगती हैं — पूरा शरीर सँभालता है।'},
  {h:30,u:'seconds',en:'Try holding one leg for 30 seconds. Then close your eyes — much harder!',hi:'30 सेकंड एक टाँग पर खड़े होकर देखो। फिर आँखें बंद करो — कहीं ज़्यादा मुश्किल!'}],
 chupan:[
  {h:10,u:'seconds',dot:'✋',en:'You count to 10 with your eyes shut. Ten fingers, ten counts — that is why we count in tens!',hi:'आँखें बंद करके 10 तक गिनते हो। दस उँगलियाँ, दस गिनती — इसीलिए हम दस में गिनते हैं!'},
  {en:'A giggle gives you away because sound travels through air and reaches ears around the corner.',hi:'हँसी तुम्हें पकड़वा देती है, क्योंकि आवाज़ हवा में चलकर कोने के पीछे तक पहुँच जाती है।'},
  {en:'Dark corners hide you well because light travels in straight lines and cannot bend around things.',hi:'अँधेरे कोने अच्छे छिपाव हैं क्योंकि रोशनी सीधी चलती है, चीज़ों के पीछे मुड़ नहीं सकती।'}],
 baraf:[
  {h:0,u:'degrees',en:'Real water turns to ice at 0 degrees, and melts back to water when it warms. Baraf… paani!',hi:'असली पानी 0 डिग्री पर बरफ़ बनता है, और गरम होते ही फिर पानी। बरफ़… पानी!'},
  {en:'Ice floats on water. Frozen water is lighter than the same amount of liquid water — unusual!',hi:'बरफ़ पानी पर तैरती है। जमा हुआ पानी उतने ही तरल पानी से हल्का होता है — अनोखी बात!'},
  {h:100,u:'degrees',en:'Heat water to 100 degrees and it boils away into steam. Ice, water, steam — all the same stuff.',hi:'पानी 100 डिग्री पर उबलकर भाप बन जाता है। बरफ़, पानी, भाप — सब एक ही चीज़।'}],
 swimming:[
  {en:'Fill your lungs with air and you float. Push all the air out and you start to sink. Try it!',hi:'फेफड़ों में हवा भर लो तो तैरते हो। सारी हवा निकाल दो तो डूबने लगते हो। आज़माओ!'},
  {h:60,u:'percent',en:'Your body is about 60 per cent water. You are mostly water learning to move through water!',hi:'तुम्हारा शरीर लगभग 60 प्रतिशत पानी है। तुम ज़्यादातर पानी हो, जो पानी में चलना सीख रहा है!'},
  {en:'You push water backwards to move forwards. Push harder behind you and you go faster ahead.',hi:'आगे बढ़ने के लिए पानी को पीछे धकेलते हो। पीछे ज़्यादा ज़ोर, तो आगे ज़्यादा तेज़।'}],
 stapu:[
  {h:9,u:'boxes',dot:'🔲',en:'Stapu boxes are numbered 1 to 9. Hop them forward, then hop them backward — 9, 8, 7…',hi:'स्टापू के खाने 1 से 9 तक होते हैं। आगे कूदो, फिर उल्टा कूदो — 9, 8, 7…'},
  {h:2,u:'leg',en:'Some boxes take two feet, some take one. You read the pattern before you jump.',hi:'कुछ खानों में दोनों पैर, कुछ में एक। कूदने से पहले तुम पैटर्न पढ़ते हो।'},
  {en:'Hopping backwards is harder than forwards, because counting down is harder than counting up.',hi:'उल्टा कूदना सीधे से मुश्किल है, क्योंकि उल्टी गिनती सीधी गिनती से मुश्किल होती है।'}]
};
