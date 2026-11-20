/* ==================================================================
   CLASSES 6–10 — the maths a middle- and secondary-school child does.

   Classes 6–10 share the top content band's look-ups (clocks, calendars,
   games: content/ages.js) but have their own work: reading lines at
   levels 7–10 (content/sentences.js) and, here, maths at levels 7–10 —
   integers, fractions, decimals, ratio and percentages (Class 6); simple
   equations, profit and interest, triangles, expressions (Class 7);
   powers, equations with x on both sides, volume, square roots,
   factorising (Class 8); Pythagoras, quadratics, progressions, mean,
   probability, trigonometry, distance, pairs of equations (Classes 9–10).

   The free-practice sums below level 7 are whole-number column sums
   (core/mathgen.js). These are not: each is a question with text answers
   ("−3", "3/4", "x = 5", "2⁷"), so every problem carries
     q      the question, English and Hindi
     ans    the right answer, worked out here from the numbers
     opts   the right answer and three wrong ones, shuffled
     why    for each wrong answer, the mistake that gives it (UPPER_MISTAKES,
            each with its help in both languages) — never "wrong", always
            which slip it was
     steps  how a teacher would start it, in both languages — never the
            final answer (the test checks every kind over many seeds)
   A problem is a plain object, so Counting Stones, Ask Munni (the steps),
   the twin (right or not) and the Story Fire's lessons (UPPER_CONCEPTS)
   all read the same thing. Everything is worked out on the phone, from a
   seed: no network, no model.
   ================================================================== */

const UP_MINUS = '−';
const upN = n => n < 0 ? UP_MINUS + Math.abs(n) : String(n);
const upGcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while(b){ [a, b] = [b, a % b]; } return a || 1; };
function upFrac(n, d){
  if(d < 0){ n = -n; d = -d; }
  const g = upGcd(n, d); n /= g; d /= g;
  return d === 1 ? upN(n) : `${upN(n)}/${d}`;
}
const upDec = x => String(Math.round(x * 1000) / 1000);
const UP_SUP = { 0:'⁰', 1:'¹', 2:'²', 3:'³', 4:'⁴', 5:'⁵', 6:'⁶', 7:'⁷', 8:'⁸', 9:'⁹' };
const upPow = (base, e) => `${base}${String(e).split('').map(d => UP_SUP[d]).join('')}`;
const upRupee = n => '₹' + n.toLocaleString('en-IN');
const upQ = (en, hi) => ({ en, hi });

/* The mistakes. Each is a real way a child gets these wrong; the help
   says how to check, never the answer itself. */
const UPPER_MISTAKES = {
  near:        upQ('Work it through once more, one step at a time.', 'एक-एक कदम करके फिर से हल करो।'),
  signflip:    upQ('The size is right — look again at the sign. Which number is bigger, the plus one or the minus one?', 'आकार सही है — चिह्न फिर देखो। धन वाली संख्या बड़ी है या ऋण वाली?'),
  addsizes:    upQ('With different signs, take the smaller size away from the bigger one — don\'t add them.', 'चिह्न अलग हों तो छोटी संख्या को बड़ी से घटाओ — जोड़ो मत।'),
  adddenoms:   upQ('When the bottoms are the same, add only the tops. The bottom stays.', 'नीचे की संख्या एक जैसी हो तो सिर्फ़ ऊपर वाली जोड़ो। नीचे वाली वही रहती है।'),
  multtops:    upQ('Adding fractions means adding the tops, not multiplying them.', 'भिन्न जोड़ने में ऊपर वाली संख्याएँ जोड़ते हैं, गुणा नहीं करते।'),
  decalign:    upQ('Line up the decimal points first, then add. Write 2.5 as 2.50 if it helps.', 'पहले दशमलव बिंदु एक सीध में रखो, फिर जोड़ो। 2.5 को 2.50 लिख सकते हो।'),
  ratioswap:   upQ('Keep the order the question uses: the first thing named comes first.', 'क्रम वही रखो जो सवाल में है: जो पहले कहा, वह पहले आता है।'),
  partial:     upQ('Can both numbers still be divided by the same number? Keep going until they can\'t.', 'क्या दोनों संख्याएँ अब भी एक ही संख्या से भाग होती हैं? तब तक भाग दो जब तक न हों।'),
  remaining:   upQ('That is what is left over. The question asks for the part itself.', 'यह बचा हुआ हिस्सा है। सवाल खुद उस हिस्से को पूछ रहा है।'),
  tenth:       upQ('Per cent means out of 100, not out of 10.', 'प्रतिशत का मतलब है 100 में से, 10 में से नहीं।'),
  concat:      upQ('3x means 3 times x, not "thirty-something". Multiply first.', '3x का मतलब है 3 गुणा x, "तीस कुछ" नहीं। पहले गुणा करो।'),
  addcoef:     upQ('The number in front multiplies x — it isn\'t added to it.', 'x के आगे की संख्या x से गुणा होती है — जुड़ती नहीं।'),
  dropconst:   upQ('Don\'t forget the number added at the end.', 'आख़िर में जुड़ी संख्या मत भूलो।'),
  signmove:    upQ('When a number crosses the = sign, plus becomes minus.', 'जब कोई संख्या = के पार जाती है, धन ऋण बन जाता है।'),
  nodivide:    upQ('You found what the x-term equals. One more step: divide by the number in front of x.', 'तुमने x वाले पद का मान निकाला। एक कदम और: x के आगे की संख्या से भाग दो।'),
  signrule:    upQ('Minus times minus is plus; minus times plus is minus.', 'ऋण गुणा ऋण धन होता है; ऋण गुणा धन ऋण।'),
  addinstead:  upQ('This one is multiplying, not adding.', 'यहाँ गुणा करना है, जोड़ना नहीं।'),
  addacross:   upQ('To multiply fractions: top times top, bottom times bottom.', 'भिन्न का गुणा: ऊपर गुणा ऊपर, नीचे गुणा नीचे।'),
  flipped:     upQ('Flipping the second fraction is for dividing, not multiplying.', 'दूसरी भिन्न को उलटना भाग में होता है, गुणा में नहीं।'),
  no100:       upQ('Interest = P × R × T ÷ 100. Don\'t forget the ÷ 100.', 'ब्याज = P × R × T ÷ 100. ÷ 100 मत भूलो।'),
  total:       upQ('That is the total amount. The question asks only for the interest.', 'यह कुल राशि है। सवाल सिर्फ़ ब्याज पूछ रहा है।'),
  oneyear:     upQ('That is one year\'s interest. Multiply by the number of years.', 'यह एक साल का ब्याज है। सालों की संख्या से गुणा करो।'),
  amount:      upQ('That is the profit in rupees. Turn it into a per cent of the cost price.', 'यह रुपयों में लाभ है। इसे क्रय मूल्य का प्रतिशत बनाओ।'),
  onsp:        upQ('Profit per cent is worked out on the cost price, not the selling price.', 'लाभ प्रतिशत क्रय मूल्य पर निकलता है, विक्रय मूल्य पर नहीं।'),
  nohalf:      upQ('A triangle is half of a rectangle: ½ × base × height.', 'त्रिभुज आयत का आधा होता है: ½ × आधार × ऊँचाई।'),
  addsides:    upQ('Area multiplies; adding the sides goes round the edge.', 'क्षेत्रफल में गुणा होता है; भुजाएँ जोड़ना किनारे का माप है।'),
  signignored: upQ('Look at the sign in front of each term — a minus term is taken away.', 'हर पद के आगे का चिह्न देखो — ऋण वाला पद घटता है।'),
  powerup:     upQ('Adding like terms adds the numbers in front; the x stays x, not x².', 'समान पद जोड़ने पर आगे की संख्याएँ जुड़ती हैं; x, x ही रहता है, x² नहीं।'),
  multexp:     upQ('A power means multiplying the base by itself, not base × power.', 'घात का मतलब है आधार को बार-बार ख़ुद से गुणा करना, आधार × घात नहीं।'),
  swapbase:    upQ('The big number is the base; the small raised number says how many times.', 'बड़ी संख्या आधार है; ऊपर की छोटी संख्या बताती है कितनी बार।'),
  onefewer:    upQ('Count the factors again: 2⁴ is four 2s multiplied.', 'गुणनखंड फिर गिनो: 2⁴ में चार बार 2 गुणा होता है।'),
  multpowers:  upQ('Same base, multiplying: add the powers.', 'आधार एक जैसा, गुणा हो रहा है: घातें जोड़ो।'),
  multbase:    upQ('The base stays the same; only the power changes.', 'आधार वही रहता है; सिर्फ़ घात बदलती है।'),
  surface:     upQ('That is the surface area. Volume is length × breadth × height.', 'यह पृष्ठीय क्षेत्रफल है। आयतन = लंबाई × चौड़ाई × ऊँचाई।'),
  sumsides:    upQ('Volume multiplies the three lengths; it doesn\'t add them.', 'आयतन में तीनों लंबाइयों का गुणा होता है, जोड़ नहीं।'),
  halved:      upQ('A square root asks: which number times itself gives this? Halving is different.', 'वर्गमूल पूछता है: कौन सी संख्या ख़ुद से गुणा होकर यह देती है? आधा करना अलग है।'),
  onlyfirst:   upQ('Divide every term inside the bracket by the common factor, not just the first.', 'कोष्ठक के अंदर हर पद को सार्व गुणनखंड से भाग दो, सिर्फ़ पहले को नहीं।'),
  signchange:  upQ('Factorising never changes a sign. Multiply back out to check.', 'गुणनखंड करने से चिह्न नहीं बदलता। वापस गुणा करके जाँचो।'),
  added:       upQ('The sides of a right triangle don\'t simply add: square, add, then take the square root.', 'समकोण त्रिभुज की भुजाएँ सीधे नहीं जुड़तीं: वर्ग करो, जोड़ो, फिर वर्गमूल लो।'),
  nosqrt:      upQ('That is the square of the answer. One more step: take the square root.', 'यह जवाब का वर्ग है। एक कदम और: वर्गमूल लो।'),
  signroots:   upQ('Put each answer back into the equation to check its sign.', 'हर जवाब को समीकरण में रखकर उसका चिह्न जाँचो।'),
  coefs:       upQ('The numbers in the equation are the sum and product of the roots, not the roots.', 'समीकरण की संख्याएँ मूलों का जोड़ और गुणनफल हैं, ख़ुद मूल नहीं।'),
  offbyone:    upQ('The first term has no d added yet: the nth term is a + (n − 1)d.', 'पहले पद में अभी d नहीं जुड़ा: n-वाँ पद a + (n − 1)d है।'),
  noa:         upQ('Start from the first term, then add the steps.', 'पहले पद से शुरू करो, फिर कदम जोड़ो।'),
  median:      upQ('That is the middle number. The mean adds them all and divides by how many.', 'यह बीच की संख्या है। माध्य में सब जोड़कर गिनती से भाग देते हैं।'),
  wrongcount:  upQ('Count how many numbers there are, and divide by exactly that.', 'गिनो कितनी संख्याएँ हैं, और ठीक उसी से भाग दो।'),
  partpart:    upQ('Probability is out of ALL the balls, not out of the other colour.', 'प्रायिकता सारी गेंदों में से होती है, दूसरे रंग में से नहीं।'),
  other:       upQ('That is the chance of the other colour.', 'यह दूसरे रंग की संभावना है।'),
  sincos:      upQ('sin and cos swap between 30° and 60°. Check which one the question asks.', 'sin और cos, 30° और 60° के बीच अदल-बदल होते हैं। देखो सवाल किसे पूछ रहा है।'),
  reciprocal:  upQ('tan is opposite over adjacent; that is the upside-down value.', 'tan = सामने ÷ पास वाली भुजा; यह उल्टा मान है।'),
  manhattan:   upQ('Distance is the straight line, not across then up: use Pythagoras.', 'दूरी सीधी रेखा है, पहले सीधे फिर ऊपर नहीं: पाइथागोरस लगाओ।'),
  gavey:       upQ('That is y. The question asks for x.', 'यह y है। सवाल x पूछ रहा है।'),
  nohalve:     upQ('Adding the two equations gives 2x. One more step: halve it.', 'दोनों समीकरण जोड़ने से 2x मिलता है। एक कदम और: आधा करो।')
};

/* Each kind: its skill (content/skills.js), its level (7 Class 6, 8 Class 7,
   9 Class 8, 10 Classes 9–10), and make(r) → { q, ans, wrong:[[text, mistake]], steps, ex }
   where ex is the worked example the Story Fire's lesson teaches with. */
const UPPER_KINDS = {
  /* ---------------- Class 6 ---------------- */
  int_add: { skill:'integers', level:7, ic:'➖',
    title: upQ('Adding negative numbers', 'ऋणात्मक संख्याएँ जोड़ना'),
    teach: upQ('Different signs: take the smaller size from the bigger, and keep the sign of the bigger.', 'चिह्न अलग हों: छोटी संख्या बड़ी से घटाओ, और बड़ी वाली का चिह्न रखो।'),
    make(r){
      let a = r(-19, -3), b = r(2, 18); if(r(0, 1)) [a, b] = [-a, -b];
      if(Math.abs(a) === Math.abs(b)) b += b > 0 ? 1 : -1;
      // a hint names both sizes, so the answer's size must not be one of them (−9 + 18)
      if(Math.abs(a + b) === Math.abs(a) || Math.abs(a + b) === Math.abs(b)) b += b > 0 ? 1 : -1;
      const ans = a + b;
      const show = n => n < 0 ? `(${upN(n)})` : String(n);
      return { q: upQ(`${show(a)} + ${show(b)} = ?`, `${show(a)} + ${show(b)} = ?`), ans: upN(ans),
        wrong: [[upN(-ans), 'signflip'], [upN(Math.sign(a) * (Math.abs(a) + Math.abs(b))), 'addsizes'], [upN(ans + (ans > 0 ? 2 : -2)), 'near']],
        steps: [upQ(`The signs are different: one is minus ${Math.abs(a < 0 ? a : b)}, one is plus ${Math.abs(a > 0 ? a : b)}.`, `चिह्न अलग हैं: एक ऋण ${Math.abs(a < 0 ? a : b)}, एक धन ${Math.abs(a > 0 ? a : b)}।`),
                upQ('Take the smaller size away from the bigger one.', 'छोटी संख्या को बड़ी में से घटाओ।'),
                upQ('Then give it the sign of the bigger size. What do you get?', 'फिर उसे बड़ी संख्या का चिह्न दो। क्या मिला?')],
        ex: upQ(`(−7) + 3: 7 − 3 = 4, and 7 is the bigger, minus — so −4.`, `(−7) + 3: 7 − 3 = 4, और 7 बड़ा है, ऋण — तो −4।`) };
    } },
  frac_add: { skill:'fracops', level:7, ic:'½',
    title: upQ('Adding fractions', 'भिन्न जोड़ना'),
    teach: upQ('Same bottom number: add the tops, keep the bottom, then simplify.', 'नीचे की संख्या एक हो: ऊपर वाली जोड़ो, नीचे वाली रखो, फिर सरल करो।'),
    make(r){
      const d = [5, 7, 9, 11, 13][r(0, 4)]; const a = r(1, d - 3), b = r(1, d - 1 - a);
      const ans = upFrac(a + b, d);
      return { q: upQ(`${a}/${d} + ${b}/${d} = ?`, `${a}/${d} + ${b}/${d} = ?`), ans,
        wrong: [[upFrac(a + b, 2 * d), 'adddenoms'], [upFrac(a * b, d) === ans ? upFrac(a * b + 1, d) : upFrac(a * b, d), 'multtops'], [upFrac(a + b + 1, d), 'near']],
        steps: [upQ(`Both fractions are in ${d}ths, so the bottom stays ${d}.`, `दोनों भिन्न ${d} वें भाग में हैं, तो नीचे ${d} ही रहेगा।`),
                upQ(`Now add the tops: ${a} and ${b}. What fraction is that?`, `अब ऊपर वाली जोड़ो: ${a} और ${b}। कौन सी भिन्न बनी?`)],
        ex: upQ('2/9 + 4/9: the bottom stays 9, the tops make 6 — 6/9, which is 2/3.', '2/9 + 4/9: नीचे 9 रहता है, ऊपर 6 — 6/9, यानी 2/3।') };
    } },
  dec_add: { skill:'decimalops', level:7, ic:'🔢',
    title: upQ('Adding decimals', 'दशमलव जोड़ना'),
    teach: upQ('Line up the decimal points, fill gaps with zeros, then add like whole numbers.', 'दशमलव बिंदु एक सीध में रखो, ख़ाली जगह में शून्य भरो, फिर पूरी संख्याओं जैसे जोड़ो।'),
    make(r){
      const a = r(11, 89) / 10, b = r(101, 899) / 100;
      const ans = upDec(a + b);
      const mis = upDec((Math.round(a * 10) + Math.round(b * 100)) / 100);
      return { q: upQ(`${a} + ${b} = ?`, `${a} + ${b} = ?`), ans,
        wrong: [[mis === ans ? upDec(a + b + 1) : mis, 'decalign'], [upDec(a + b + 0.1), 'near'], [upDec(a + b - 1), 'near']],
        steps: [upQ(`Write ${a} as ${a.toFixed(2)} so both numbers have two places after the point.`, `${a} को ${a.toFixed(2)} लिखो ताकि दोनों में बिंदु के बाद दो अंक हों।`),
                upQ('Now add column by column, keeping the point in line.', 'अब बिंदु को सीध में रखकर स्तंभ-दर-स्तंभ जोड़ो।')],
        ex: upQ('1.5 + 2.25: write 1.50 + 2.25 = 3.75.', '1.5 + 2.25: 1.50 + 2.25 लिखो = 3.75।') };
    } },
  ratio: { skill:'ratio', level:7, ic:'⚖️',
    title: upQ('Simplest ratio', 'सबसे सरल अनुपात'),
    teach: upQ('Divide both parts of a ratio by the biggest number that goes into both.', 'अनुपात के दोनों भागों को उस सबसे बड़ी संख्या से भाग दो जो दोनों में जाए।'),
    make(r){
      const pairs = [[2,3],[3,4],[2,5],[3,5],[4,5],[5,6],[3,7],[4,7]];
      const [p, q] = pairs[r(0, pairs.length - 1)]; const k = [4, 6, 8, 9, 10, 12][r(0, 5)];
      const f = k % 2 === 0 ? 2 : 3;
      const boys = p * k, girls = q * k;
      return { q: upQ(`A class has ${boys} boys and ${girls} girls. What is the ratio of boys to girls, in its simplest form?`, `एक कक्षा में ${boys} लड़के और ${girls} लड़कियाँ हैं। लड़कों और लड़कियों का अनुपात, सबसे सरल रूप में?`),
        ans: `${p}:${q}`,
        wrong: [[`${q}:${p}`, 'ratioswap'], [`${p * k / f}:${q * k / f}`, 'partial'], [`${p + 1}:${q}`, 'near']],
        steps: [upQ(`Boys come first, so the ratio starts ${boys} : ${girls}.`, `लड़के पहले आते हैं, तो अनुपात ${boys} : ${girls} से शुरू होता है।`),
                upQ(`Find the biggest number that divides both ${boys} and ${girls}, and divide both by it.`, `वह सबसे बड़ी संख्या ढूँढो जो ${boys} और ${girls} दोनों को भाग दे, और दोनों को उससे भाग दो।`)],
        ex: upQ('12 : 18 — both divide by 6 — 2 : 3.', '12 : 18 — दोनों 6 से भाग होते हैं — 2 : 3।') };
    } },
  pct_of: { skill:'percent', level:7, ic:'％',
    title: upQ('A per cent of a number', 'किसी संख्या का प्रतिशत'),
    teach: upQ('P per cent of N means P out of every 100: N × P ÷ 100.', 'N का P प्रतिशत यानी हर 100 में से P: N × P ÷ 100।'),
    make(r){
      // the hint says "P out of every 100", so the answer is never P (10% of 100) or 100 (25% of 400)
      const P = [10, 20, 25, 50, 75][r(0, 4)]; let N = 20 * r(2, 20);
      while(N * P / 100 === P || N * P / 100 === 100) N += 20;
      const ans = N * P / 100;
      const w2 = N * P / 10;
      return { q: upQ(`What is ${P}% of ${N}?`, `${N} का ${P}% कितना है?`), ans: String(ans),
        wrong: [[String(N - ans === ans ? ans + 5 : N - ans), 'remaining'], [String(w2), 'tenth'], [String(ans + (ans >= 10 ? 5 : 1)), 'near']],
        steps: [upQ(`${P}% means ${P} out of every 100.`, `${P}% का मतलब हर 100 में से ${P}।`),
                upQ(`So work out ${N} × ${P} ÷ 100.`, `तो ${N} × ${P} ÷ 100 निकालो।`)],
        ex: upQ('25% of 80: 80 × 25 ÷ 100 = 20.', '80 का 25%: 80 × 25 ÷ 100 = 20।') };
    } },
  alg_value: { skill:'algebra1', level:7, ic:'𝑥',
    title: upQ('Putting a number in place of x', 'x की जगह संख्या रखना'),
    teach: upQ('3x means 3 times x. Put the number in for x, multiply, then add.', '3x का मतलब 3 गुणा x। x की जगह संख्या रखो, गुणा करो, फिर जोड़ो।'),
    make(r){
      const a = r(2, 9), b = r(1, 20), x = r(2, 9);
      const ans = a * x + b;
      const concat = a * 10 + x + b;
      return { q: upQ(`If x = ${x}, what is ${a}x + ${b}?`, `अगर x = ${x}, तो ${a}x + ${b} कितना है?`), ans: String(ans),
        wrong: [[String(concat === ans ? ans + 10 : concat), 'concat'], [String(a + x + b === ans ? ans + 3 : a + x + b), 'addcoef'], [String(a * x === ans ? ans + 2 : a * x), 'dropconst']],
        steps: [upQ(`${a}x means ${a} × x, and x is ${x}.`, `${a}x का मतलब ${a} × x, और x = ${x}।`),
                upQ(`Multiply first, then add ${b}.`, `पहले गुणा करो, फिर ${b} जोड़ो।`)],
        ex: upQ('If x = 4, 3x + 5 = 3 × 4 + 5 = 17.', 'अगर x = 4, तो 3x + 5 = 3 × 4 + 5 = 17।') };
    } },

  /* ---------------- Class 7 ---------------- */
  lin_eq: { skill:'lineareq', level:8, ic:'⚖️',
    title: upQ('Solving a simple equation', 'सरल समीकरण हल करना'),
    teach: upQ('Undo what was done to x, in reverse: first the plus, then the times.', 'x पर जो किया गया उसे उल्टे क्रम में हटाओ: पहले जोड़, फिर गुणा।'),
    make(r){
      const a = r(2, 9), b = r(1, 30); let x = r(2, 12);
      while(x === a || x === b) x++;             // the hints name a and b — the answer mustn't be either
      const c = a * x + b;
      const sm = (c + b) % a === 0 ? (c + b) / a : null;
      const wrong = [[`x = ${c - b}`, 'nodivide']];
      if(sm != null && sm !== x) wrong.push([`x = ${sm}`, 'signmove']);
      wrong.push([`x = ${x + 1}`, 'near'], [`x = ${x - 1}`, 'near']);
      return { q: upQ(`Solve: ${a}x + ${b} = ${c}`, `हल करो: ${a}x + ${b} = ${c}`), ans: `x = ${x}`, wrong: wrong.slice(0, 3),
        steps: [upQ(`Take ${b} from both sides: ${a}x = ${c} − ${b}.`, `दोनों ओर से ${b} घटाओ: ${a}x = ${c} − ${b}।`),
                upQ(`Then divide both sides by ${a}. What is x?`, `फिर दोनों ओर ${a} से भाग दो। x कितना है?`)],
        ex: upQ('3x + 4 = 19: 3x = 15, so x = 5.', '3x + 4 = 19: 3x = 15, तो x = 5।') };
    } },
  int_mult: { skill:'integers', level:8, ic:'✖️',
    title: upQ('Multiplying negative numbers', 'ऋणात्मक संख्याओं का गुणा'),
    teach: upQ('Same signs give plus; different signs give minus. Then multiply the sizes.', 'एक जैसे चिह्न से धन; अलग चिह्न से ऋण। फिर संख्याओं का गुणा करो।'),
    make(r){
      const a = r(2, 12), b = r(2, 12), both = !!r(0, 1);
      const A = -a, B = both ? -b : b, ans = A * B;
      const show = n => n < 0 ? `(${upN(n)})` : String(n);
      return { q: upQ(`${show(A)} × ${show(B)} = ?`, `${show(A)} × ${show(B)} = ?`), ans: upN(ans),
        wrong: [[upN(-ans), 'signrule'], [upN(A + B), 'addinstead'], [upN(ans + (ans > 0 ? a : -a)), 'near']],
        steps: [upQ(both ? 'Both numbers are minus.' : 'One number is minus, one is plus.', both ? 'दोनों संख्याएँ ऋण हैं।' : 'एक संख्या ऋण है, एक धन।'),
                upQ(`Decide the sign first, then multiply ${a} × ${b}.`, `पहले चिह्न तय करो, फिर ${a} × ${b} का गुणा करो।`)],
        ex: upQ('(−4) × (−6) = +24; (−4) × 6 = −24.', '(−4) × (−6) = +24; (−4) × 6 = −24।') };
    } },
  frac_mult: { skill:'rational', level:8, ic:'½',
    title: upQ('Multiplying fractions', 'भिन्नों का गुणा'),
    teach: upQ('Top times top, bottom times bottom, then simplify.', 'ऊपर गुणा ऊपर, नीचे गुणा नीचे, फिर सरल करो।'),
    make(r){
      const a = r(1, 5), b = r(a + 1, 9), c = r(1, 5), d = r(c + 1, 9);
      const ans = upFrac(a * c, b * d);
      const across = upFrac(a + c, b + d), flip = upFrac(a * d, b * c);
      const wrong = [];
      if(across !== ans) wrong.push([across, 'addacross']);
      if(flip !== ans && flip !== across) wrong.push([flip, 'flipped']);
      for(const k of [1, 2, 3]){ const n = upFrac(a * c + k, b * d); if(wrong.length < 3 && n !== ans && !wrong.some(w => w[0] === n)) wrong.push([n, 'near']); }
      return { q: upQ(`${a}/${b} × ${c}/${d} = ?`, `${a}/${b} × ${c}/${d} = ?`), ans, wrong,
        steps: [upQ(`Multiply the tops: ${a} × ${c}. Multiply the bottoms: ${b} × ${d}.`, `ऊपर का गुणा: ${a} × ${c}। नीचे का गुणा: ${b} × ${d}।`),
                upQ('Then simplify the fraction you made, if you can.', 'फिर जो भिन्न बनी उसे सरल करो, अगर हो सके।')],
        ex: upQ('2/3 × 3/4 = 6/12 = 1/2.', '2/3 × 3/4 = 6/12 = 1/2।') };
    } },
  si: { skill:'percentapp', level:8, ic:'🏦',
    title: upQ('Simple interest', 'साधारण ब्याज'),
    teach: upQ('Simple interest = Principal × Rate × Time ÷ 100.', 'साधारण ब्याज = मूलधन × दर × समय ÷ 100।'),
    make(r){
      const P = 500 * r(2, 20), R = r(2, 10), T = r(2, 5), ans = P * R * T / 100;
      return { q: upQ(`What is the simple interest on ${upRupee(P)} at ${R}% a year for ${T} years?`, `${upRupee(P)} पर ${R}% सालाना दर से ${T} साल का साधारण ब्याज कितना है?`),
        ans: upRupee(ans),
        wrong: [[upRupee(P + ans), 'total'], [upRupee(P * R / 100), 'oneyear'], [upRupee(P * R * T), 'no100']],
        steps: [upQ(`Principal ${upRupee(P)}, rate ${R}, time ${T} years.`, `मूलधन ${upRupee(P)}, दर ${R}, समय ${T} साल।`),
                upQ(`Work out ${P} × ${R} × ${T} ÷ 100.`, `${P} × ${R} × ${T} ÷ 100 निकालो।`)],
        ex: upQ('₹2,000 at 5% for 3 years: 2000 × 5 × 3 ÷ 100 = ₹300.', '₹2,000 पर 5% दर से 3 साल: 2000 × 5 × 3 ÷ 100 = ₹300।') };
    } },
  profit: { skill:'percentapp', level:8, ic:'🛒',
    title: upQ('Profit per cent', 'लाभ प्रतिशत'),
    teach: upQ('Profit % = profit ÷ cost price × 100. Always on the cost price.', 'लाभ % = लाभ ÷ क्रय मूल्य × 100। हमेशा क्रय मूल्य पर।'),
    make(r){
      const p = [10, 20, 25, 50][r(0, 3)], CP = 100 * r(2, 9), SP = CP * (100 + p) / 100;
      const prof = SP - CP, onsp = prof * 100 / SP;
      const wrong = [[`${prof}%`, 'amount']];
      if(Number.isInteger(onsp) && onsp !== p) wrong.push([`${onsp}%`, 'onsp']);
      for(const k of [5, 10, 15]) if(wrong.length < 3 && !wrong.some(w => w[0] === `${p + k}%`) && prof !== p + k) wrong.push([`${p + k}%`, 'near']);
      return { q: upQ(`A shopkeeper buys a fan for ${upRupee(CP)} and sells it for ${upRupee(SP)}. What is the profit per cent?`, `एक दुकानदार ${upRupee(CP)} में पंखा ख़रीदकर ${upRupee(SP)} में बेचता है। लाभ प्रतिशत कितना है?`),
        ans: `${p}%`, wrong: wrong.slice(0, 3),
        steps: [upQ(`Profit = selling price − cost price = ${SP} − ${CP}.`, `लाभ = विक्रय मूल्य − क्रय मूल्य = ${SP} − ${CP}।`),
                upQ(`Divide the profit by the cost price, ${CP}, and multiply by 100.`, `लाभ को क्रय मूल्य ${CP} से भाग देकर 100 से गुणा करो।`)],
        ex: upQ('Bought for ₹400, sold for ₹500: profit ₹100, and 100 ÷ 400 × 100 = 25%.', '₹400 में ख़रीदा, ₹500 में बेचा: लाभ ₹100, और 100 ÷ 400 × 100 = 25%।') };
    } },
  tri_area: { skill:'triarea', level:8, ic:'📐',
    title: upQ('Area of a triangle', 'त्रिभुज का क्षेत्रफल'),
    teach: upQ('A triangle is half a rectangle: area = ½ × base × height.', 'त्रिभुज आयत का आधा है: क्षेत्रफल = ½ × आधार × ऊँचाई।'),
    make(r){
      const b = 2 * r(2, 12), h = r(3, 15), ans = b * h / 2;
      return { q: upQ(`A triangle has base ${b} cm and height ${h} cm. What is its area?`, `एक त्रिभुज का आधार ${b} सेमी और ऊँचाई ${h} सेमी है। उसका क्षेत्रफल कितना है?`),
        ans: `${ans} cm²`,
        wrong: [[`${b * h} cm²`, 'nohalf'], [`${b + h === ans ? b + h + 2 : b + h} cm²`, 'addsides'], [`${ans + h} cm²`, 'near']],
        steps: [upQ(`Multiply base and height: ${b} × ${h}.`, `आधार और ऊँचाई का गुणा: ${b} × ${h}।`),
                upQ('A triangle is half of that rectangle — so take half.', 'त्रिभुज उस आयत का आधा है — तो आधा लो।')],
        ex: upQ('Base 10 cm, height 6 cm: 10 × 6 = 60, half is 30 cm².', 'आधार 10 सेमी, ऊँचाई 6 सेमी: 10 × 6 = 60, आधा 30 वर्ग सेमी।') };
    } },
  alg_simplify: { skill:'algexpr', level:8, ic:'𝑥',
    title: upQ('Adding like terms', 'समान पद जोड़ना'),
    teach: upQ('Like terms have the same letter: add and take away the numbers in front, keep the letter.', 'समान पदों में अक्षर एक होता है: आगे की संख्याएँ जोड़ो-घटाओ, अक्षर वही रखो।'),
    make(r){
      const a = r(3, 9), b = r(2, 8), c = r(1, a + b - 2), n = a + b - c;
      const v = k => k === 1 ? 'x' : `${k}x`;
      return { q: upQ(`Simplify: ${a}x + ${b}x − ${c}x`, `सरल करो: ${a}x + ${b}x − ${c}x`), ans: v(n),
        wrong: [[v(a + b + c), 'signignored'], [`${n}x²`, 'powerup'], [v(n + 1), 'near']],
        steps: [upQ('All three terms have x, so they are like terms.', 'तीनों पदों में x है, तो ये समान पद हैं।'),
                upQ(`Work out ${a} + ${b} − ${c}, and keep the x.`, `${a} + ${b} − ${c} निकालो, और x रखो।`)],
        ex: upQ('5x + 2x − 3x = (5 + 2 − 3)x = 4x.', '5x + 2x − 3x = (5 + 2 − 3)x = 4x।') };
    } },

  /* ---------------- Class 8 ---------------- */
  power: { skill:'exponents', level:9, ic:'²',
    title: upQ('Powers', 'घात'),
    teach: upQ('2⁵ means five 2s multiplied: 2 × 2 × 2 × 2 × 2.', '2⁵ का मतलब है पाँच बार 2 का गुणा: 2 × 2 × 2 × 2 × 2।'),
    make(r){
      const a = r(2, 5), e = r(3, a === 2 ? 7 : a === 3 ? 5 : 4), ans = a ** e;
      const wrong = [[String(a * e), 'multexp']];
      if(e ** a !== ans) wrong.push([String(e ** a), 'swapbase']);
      wrong.push([String(a ** (e - 1)), 'onefewer'], [String(ans + a), 'near']);
      return { q: upQ(`${upPow(a, e)} = ?`, `${upPow(a, e)} = ?`), ans: String(ans), wrong: wrong.slice(0, 3),
        steps: [upQ(`The base is ${a}; the small ${e} says how many ${a}s to multiply.`, `आधार ${a} है; छोटा ${e} बताता है कितने ${a} गुणा करने हैं।`),
                upQ(`Multiply ${Array(e).fill(a).join(' × ')}.`, `${Array(e).fill(a).join(' × ')} का गुणा करो।`)],
        ex: upQ('3⁴ = 3 × 3 × 3 × 3 = 81.', '3⁴ = 3 × 3 × 3 × 3 = 81।') };
    } },
  exp_law: { skill:'exponents', level:9, ic:'²',
    title: upQ('Multiplying powers', 'घातों का गुणा'),
    teach: upQ('Same base, multiplying: keep the base and add the powers.', 'आधार एक, गुणा हो रहा है: आधार रखो और घातें जोड़ो।'),
    make(r){
      const a = r(2, 9), m = r(2, 6), n = r(2, 6);
      return { q: upQ(`${upPow(a, m)} × ${upPow(a, n)} = ?`, `${upPow(a, m)} × ${upPow(a, n)} = ?`), ans: upPow(a, m + n),
        wrong: [[upPow(a, m * n === m + n ? m * n + 1 : m * n), 'multpowers'], [upPow(a * a, m + n), 'multbase'], [upPow(a, m + n + 1), 'near']],
        steps: [upQ(`Both have the same base, ${a}.`, `दोनों का आधार एक है, ${a}।`),
                upQ(`So keep ${a} and add the powers ${m} and ${n}.`, `तो ${a} रखो और घातें ${m} और ${n} जोड़ो।`)],
        ex: upQ('5² × 5³ = 5²⁺³ = 5⁵.', '5² × 5³ = 5²⁺³ = 5⁵।') };
    } },
  lin_eq2: { skill:'lineareq2', level:9, ic:'⚖️',
    title: upQ('x on both sides', 'दोनों ओर x'),
    teach: upQ('Bring the x terms to one side and the numbers to the other, changing sign as they cross.', 'x वाले पद एक ओर और संख्याएँ दूसरी ओर लाओ; पार जाते हुए चिह्न बदलता है।'),
    make(r){
      const c = r(1, 5), a = c + r(2, 6), b = r(1, 15); let x = r(2, 10);
      while([a - c, b, c].includes(x)) x++;      // the hints name these — the answer mustn't be one
      const d = (a - c) * x + b;
      const wrong = [];
      if((d + b) % (a - c) === 0 && (d + b) / (a - c) !== x) wrong.push([`x = ${(d + b) / (a - c)}`, 'signmove']);
      if((d - b) % (a + c) === 0 && (d - b) / (a + c) !== x) wrong.push([`x = ${(d - b) / (a + c)}`, 'signignored']);
      wrong.push([`x = ${d - b}`, 'nodivide']);
      for(const k of [1, -1, 2]) if(wrong.length < 3 && !wrong.some(w => w[0] === `x = ${x + k}`)) wrong.push([`x = ${x + k}`, 'near']);
      return { q: upQ(`Solve: ${a}x + ${b} = ${c === 1 ? '' : c}x + ${d}`, `हल करो: ${a}x + ${b} = ${c === 1 ? '' : c}x + ${d}`), ans: `x = ${x}`, wrong: wrong.slice(0, 3),
        steps: [upQ(`Take ${c === 1 ? '' : c}x from both sides: ${a - c}x + ${b} = ${d}.`, `दोनों ओर से ${c === 1 ? '' : c}x घटाओ: ${a - c}x + ${b} = ${d}।`),
                upQ(`Now take ${b} from both sides, then divide by ${a - c}.`, `अब दोनों ओर से ${b} घटाओ, फिर ${a - c} से भाग दो।`)],
        ex: upQ('5x + 3 = 2x + 18: 3x + 3 = 18, 3x = 15, x = 5.', '5x + 3 = 2x + 18: 3x + 3 = 18, 3x = 15, x = 5।') };
    } },
  volume: { skill:'mensuration', level:9, ic:'📦',
    title: upQ('Volume of a cuboid', 'घनाभ का आयतन'),
    teach: upQ('Volume = length × breadth × height, in cubic units.', 'आयतन = लंबाई × चौड़ाई × ऊँचाई, घन इकाई में।'),
    make(r){
      const l = r(4, 15), b = r(2, 10), h = r(2, 9), ans = l * b * h, surf = 2 * (l * b + b * h + h * l);
      return { q: upQ(`A box is ${l} cm long, ${b} cm wide and ${h} cm high. What is its volume?`, `एक डिब्बा ${l} सेमी लंबा, ${b} सेमी चौड़ा और ${h} सेमी ऊँचा है। उसका आयतन कितना है?`),
        ans: `${ans} cm³`,
        wrong: [[`${surf === ans ? surf + 2 : surf} cm³`, 'surface'], [`${l + b + h} cm³`, 'sumsides'], [`${ans + l * b} cm³`, 'near']],
        steps: [upQ(`Multiply the three lengths: ${l} × ${b} × ${h}.`, `तीनों लंबाइयों का गुणा: ${l} × ${b} × ${h}।`),
                upQ('The answer is in cubic centimetres, cm³.', 'जवाब घन सेंटीमीटर, cm³ में होगा।')],
        ex: upQ('5 cm × 4 cm × 3 cm = 60 cm³.', '5 सेमी × 4 सेमी × 3 सेमी = 60 cm³।') };
    } },
  sqrt: { skill:'squares', level:9, ic:'√',
    title: upQ('Square roots', 'वर्गमूल'),
    teach: upQ('The square root of a number is the number that, times itself, gives it.', 'किसी संख्या का वर्गमूल वह संख्या है जो ख़ुद से गुणा होकर वह देती है।'),
    make(r){
      let n = r(11, 29); if(n === 20) n = 21;    // the hint says "near" a round ten — never the answer itself
      const sq = n * n;
      return { q: upQ(`√${sq} = ?`, `√${sq} = ?`), ans: String(n),
        wrong: [[String(sq / 2), 'halved'], [String(n + 1), 'near'], [String(n - 1), 'near']],
        steps: [upQ(`Look for the number that, times itself, makes ${sq}.`, `वह संख्या ढूँढो जो ख़ुद से गुणा होकर ${sq} बनाए।`),
                upQ(`${sq} ends in ${sq % 10}, so the number ends in ${[0, 1, 4, 9, 6, 5].includes(sq % 10) ? ({0:'0',1:'1 or 9',4:'2 or 8',9:'3 or 7',6:'4 or 6',5:'5'})[sq % 10] : '?'}. Try one near ${Math.round(Math.sqrt(sq) / 10) * 10}.`,
                    `${sq} के अंत में ${sq % 10} है, तो संख्या के अंत में ${({0:'0',1:'1 या 9',4:'2 या 8',9:'3 या 7',6:'4 या 6',5:'5'})[sq % 10]} होगा। ${Math.round(Math.sqrt(sq) / 10) * 10} के पास वाली संख्या आज़माओ।`)],
        ex: upQ('√196: 14 × 14 = 196, so √196 = 14.', '√196: 14 × 14 = 196, तो √196 = 14।') };
    } },
  factor: { skill:'factorise', level:9, ic:'🧩',
    title: upQ('Taking out a common factor', 'सार्व गुणनखंड निकालना'),
    teach: upQ('Find the biggest number that divides every term, and write it outside a bracket.', 'वह सबसे बड़ी संख्या ढूँढो जो हर पद को भाग दे, और उसे कोष्ठक के बाहर लिखो।'),
    make(r){
      const pairs = [[2,3],[3,2],[2,5],[3,4],[4,3],[5,2],[3,5],[5,3]];
      const [p, q] = pairs[r(0, pairs.length - 1)], k = r(2, 7);
      const t = n => n === 1 ? 'x' : `${n}x`;
      return { q: upQ(`Factorise: ${t(k * p)} + ${k * q}`, `गुणनखंड करो: ${t(k * p)} + ${k * q}`), ans: `${k}(${t(p)} + ${q})`,
        wrong: [[`${k}(${t(p)} + ${k * q})`, 'onlyfirst'], [`${k}(${t(p)} − ${q})`, 'signchange'], [`${k}(${t(q)} + ${p})`, 'near']],
        steps: [upQ(`Which is the biggest number that goes into both ${k * p} and ${k * q}?`, `कौन सी सबसे बड़ी संख्या ${k * p} और ${k * q} दोनों में जाती है?`),
                upQ('Write it outside the bracket and divide each term by it.', 'उसे कोष्ठक के बाहर लिखो और हर पद को उससे भाग दो।')],
        ex: upQ('6x + 9 = 3(2x + 3). Check: 3 × 2x = 6x, 3 × 3 = 9.', '6x + 9 = 3(2x + 3)। जाँचो: 3 × 2x = 6x, 3 × 3 = 9।') };
    } },

  /* ---------------- Classes 9–10 ---------------- */
  pythag: { skill:'pythag', level:10, ic:'📐',
    title: upQ('Pythagoras', 'पाइथागोरस प्रमेय'),
    teach: upQ('In a right triangle, hypotenuse² = base² + height².', 'समकोण त्रिभुज में कर्ण² = आधार² + लंब²।'),
    make(r){
      const t = [[3,4,5],[5,12,13],[8,15,17],[7,24,25]][r(0, 3)], k = t[0] === 3 ? r(1, 4) : 1;
      const [a, b, c] = t.map(x => x * k);
      return { q: upQ(`A right triangle has sides ${a} cm and ${b} cm around the right angle. How long is the hypotenuse?`, `एक समकोण त्रिभुज की समकोण बनाने वाली भुजाएँ ${a} सेमी और ${b} सेमी हैं। कर्ण कितना लंबा है?`),
        ans: `${c} cm`,
        wrong: [[`${a + b} cm`, 'added'], [`${a * a + b * b} cm`, 'nosqrt'], [`${c + 1} cm`, 'near']],
        steps: [upQ(`Square both sides: ${a}² and ${b}², and add them.`, `दोनों भुजाओं का वर्ग करो: ${a}² और ${b}², और जोड़ो।`),
                upQ('Then take the square root of the total.', 'फिर कुल का वर्गमूल लो।')],
        ex: upQ('6 and 8: 36 + 64 = 100, and √100 = 10.', '6 और 8: 36 + 64 = 100, और √100 = 10।') };
    } },
  quad: { skill:'quadratic', level:10, ic:'𝑥²',
    title: upQ('Roots of a quadratic', 'द्विघात समीकरण के मूल'),
    teach: upQ('For x² − Sx + P = 0, find two numbers that add to S and multiply to P.', 'x² − Sx + P = 0 में ऐसी दो संख्याएँ ढूँढो जिनका जोड़ S और गुणा P हो।'),
    make(r){
      const p = r(1, 6), q = r(p + 1, 9), S = p + q, P = p * q;
      return { q: upQ(`Solve: x² − ${S}x + ${P} = 0`, `हल करो: x² − ${S}x + ${P} = 0`), ans: `x = ${p} or ${q}`,
        wrong: [[`x = −${p} or −${q}`, 'signroots'], [`x = ${S} or ${P}`, 'coefs'], [`x = ${p} or ${q + 1}`, 'near']],
        steps: [upQ(`Look for two numbers that add to ${S} and multiply to ${P}.`, `ऐसी दो संख्याएँ ढूँढो जिनका जोड़ ${S} और गुणा ${P} हो।`),
                upQ('Write it as (x − first)(x − second) = 0; each bracket gives a root.', 'इसे (x − पहली)(x − दूसरी) = 0 लिखो; हर कोष्ठक एक मूल देता है।')],
        ex: upQ('x² − 5x + 6 = 0: 2 + 3 = 5 and 2 × 3 = 6, so x = 2 or 3.', 'x² − 5x + 6 = 0: 2 + 3 = 5 और 2 × 3 = 6, तो x = 2 या 3।') };
    } },
  ap: { skill:'ap', level:10, ic:'🪜',
    title: upQ('Arithmetic progressions', 'समांतर श्रेढ़ी'),
    teach: upQ('The nth term is a + (n − 1)d: the first term, then n − 1 steps of d.', 'n-वाँ पद a + (n − 1)d है: पहला पद, फिर d के n − 1 कदम।'),
    make(r){
      const a = r(2, 15), d = r(2, 9), n = r(8, 25), ans = a + (n - 1) * d;
      const seq = [a, a + d, a + 2 * d].join(', ');
      return { q: upQ(`What is the ${n}th term of ${seq}, …?`, `${seq}, … का ${n}वाँ पद क्या है?`), ans: String(ans),
        wrong: [[String(a + n * d), 'offbyone'], [String(n * d), 'noa'], [String(ans - 1), 'near']],
        steps: [upQ(`The first term a is ${a}; the step d is ${d}.`, `पहला पद a = ${a}; अंतर d = ${d}।`),
                upQ(`Work out ${a} + (${n} − 1) × ${d}.`, `${a} + (${n} − 1) × ${d} निकालो।`)],
        ex: upQ('5, 8, 11, …: the 10th term is 5 + 9 × 3 = 32.', '5, 8, 11, …: 10वाँ पद 5 + 9 × 3 = 32।') };
    } },
  mean: { skill:'stats', level:10, ic:'📊',
    title: upQ('The mean', 'माध्य'),
    teach: upQ('Mean = add all the numbers, then divide by how many there are.', 'माध्य = सारी संख्याएँ जोड़ो, फिर उनकी गिनती से भाग दो।'),
    make(r){
      for(let tries = 0; tries < 50; tries++){
        const xs = [r(10, 60), r(10, 60), r(10, 60), r(10, 60)];
        const m = r(20, 50), last = 5 * m - xs.reduce((s, x) => s + x, 0);
        if(last < 5 || last > 95) continue;
        xs.push(last);
        const sorted = xs.slice().sort((a, b) => a - b), med = sorted[2], sum = 5 * m;
        const wrong = [];
        if(med !== m) wrong.push([String(med), 'median']);
        if(sum % 4 === 0 && sum / 4 !== m) wrong.push([String(sum / 4), 'wrongcount']);
        for(const k of [2, -2, 5]) if(wrong.length < 3 && !wrong.some(w => w[0] === String(m + k))) wrong.push([String(m + k), 'near']);
        return { q: upQ(`What is the mean of ${xs.join(', ')}?`, `${xs.join(', ')} का माध्य क्या है?`), ans: String(m), wrong: wrong.slice(0, 3),
          steps: [upQ(`Add all five numbers: ${xs.join(' + ')}.`, `पाँचों संख्याएँ जोड़ो: ${xs.join(' + ')}।`),
                  upQ('Then divide the total by 5.', 'फिर कुल को 5 से भाग दो।')],
          ex: upQ('4, 6, 8, 10, 12: the total is 40, and 40 ÷ 5 = 8.', '4, 6, 8, 10, 12: कुल 40, और 40 ÷ 5 = 8।') };
      }
      return null;
    } },
  prob: { skill:'probability', level:10, ic:'🎲',
    title: upQ('Probability', 'प्रायिकता'),
    teach: upQ('Probability = the ways you want ÷ all the ways that can happen.', 'प्रायिकता = चाही गई संभावनाएँ ÷ कुल संभावनाएँ।'),
    make(r){
      const red = r(2, 9), blue = r(2, 9) + (red === 5 ? 1 : 0), all = red + blue;
      const ans = upFrac(red, all), pp = upFrac(red, blue), ot = upFrac(blue, all);
      const wrong = [];
      if(pp !== ans) wrong.push([pp, 'partpart']);
      if(ot !== ans && ot !== pp) wrong.push([ot, 'other']);
      for(const k of [1, 2, 3]){ const v = upFrac(red, all + k); if(wrong.length < 3 && v !== ans && !wrong.some(w => w[0] === v)) wrong.push([v, 'near']); }
      return { q: upQ(`A bag has ${red} red and ${blue} blue balls. One is picked without looking. What is the probability it is red?`, `एक थैले में ${red} लाल और ${blue} नीली गेंदें हैं। बिना देखे एक निकाली जाती है। उसके लाल होने की प्रायिकता क्या है?`),
        ans, wrong,
        steps: [upQ(`There are ${red} red balls you want, out of ${red} + ${blue} balls in all.`, `चाही गई ${red} लाल गेंदें हैं, कुल ${red} + ${blue} गेंदों में से।`),
                upQ('Write it as a fraction and simplify it.', 'इसे भिन्न के रूप में लिखो और सरल करो।')],
        ex: upQ('3 red, 5 blue: 3 out of 8, so 3/8.', '3 लाल, 5 नीली: 8 में से 3, तो 3/8।') };
    } },
  trig: { skill:'trig', level:10, ic:'📐',
    title: upQ('Trigonometric ratios', 'त्रिकोणमितीय अनुपात'),
    teach: upQ('sin 30° = 1/2, sin 45° = 1/√2, sin 60° = √3/2; cos swaps 30° and 60°; tan = sin ÷ cos.', 'sin 30° = 1/2, sin 45° = 1/√2, sin 60° = √3/2; cos में 30° और 60° अदल-बदल; tan = sin ÷ cos।'),
    make(r){
      const T = { sin:{30:'1/2',45:'1/√2',60:'√3/2'}, cos:{30:'√3/2',45:'1/√2',60:'1/2'}, tan:{30:'1/√3',45:'1',60:'√3'} };
      const pool = [['sin',30],['sin',60],['cos',30],['cos',60],['tan',30],['tan',60]];
      const [f, a] = pool[r(0, pool.length - 1)], ans = T[f][a];
      const wrong = [];
      if(f === 'tan') wrong.push([T.tan[a === 30 ? 60 : 30], 'reciprocal'], [T.sin[a], 'sincos']);
      else wrong.push([T[f === 'sin' ? 'cos' : 'sin'][a], 'sincos']);
      for(const v of ['1/2','√3/2','1/√2','√3','1','1/√3','2']) if(wrong.length < 3 && v !== ans && !wrong.some(w => w[0] === v)) wrong.push([v, 'near']);
      return { q: upQ(`${f} ${a}° = ?`, `${f} ${a}° = ?`), ans, wrong: wrong.slice(0, 3),
        steps: [upQ('Picture the 30-60-90 triangle: the hypotenuse is 2 and the side opposite 30° is 1. Find the third side with Pythagoras.', '30-60-90 त्रिभुज सोचो: कर्ण 2 है और 30° के सामने की भुजा 1। तीसरी भुजा पाइथागोरस से निकालो।'),
                upQ(f === 'tan' ? `tan is the side opposite ${a}° over the side next to it.` : f === 'sin' ? `sin is the side opposite ${a}° over the hypotenuse.` : `cos is the side next to ${a}° over the hypotenuse.`,
                    f === 'tan' ? `tan = ${a}° के सामने की भुजा ÷ पास वाली भुजा।` : f === 'sin' ? `sin = ${a}° के सामने की भुजा ÷ कर्ण।` : `cos = ${a}° के पास वाली भुजा ÷ कर्ण।`)],
        ex: upQ('In the 30-60-90 triangle, the side opposite 30° is 1 and the hypotenuse is 2: sin 30° = 1/2.', '30-60-90 त्रिभुज में 30° के सामने की भुजा 1 और कर्ण 2: sin 30° = 1/2।') };
    } },
  dist: { skill:'coordgeo', level:10, ic:'📍',
    title: upQ('Distance between two points', 'दो बिंदुओं के बीच की दूरी'),
    teach: upQ('Distance = √((x₂ − x₁)² + (y₂ − y₁)²) — Pythagoras on the grid.', 'दूरी = √((x₂ − x₁)² + (y₂ − y₁)²) — ग्रिड पर पाइथागोरस।'),
    make(r){
      const [dx, dy, c] = [[3,4,5],[6,8,10],[5,12,13],[8,6,10]][r(0, 3)];
      const x1 = r(-3, 5), y1 = r(-3, 5), x2 = x1 + dx, y2 = y1 + dy;
      const P = (x, y) => `(${upN(x)}, ${upN(y)})`;
      return { q: upQ(`How far apart are the points ${P(x1, y1)} and ${P(x2, y2)}?`, `बिंदु ${P(x1, y1)} और ${P(x2, y2)} के बीच कितनी दूरी है?`), ans: String(c),
        wrong: [[String(dx + dy), 'manhattan'], [String(dx * dx + dy * dy), 'nosqrt'], [String(c + 1), 'near']],
        steps: [upQ(`Across: ${upN(x2)} − ${upN(x1)}. Up: ${upN(y2)} − ${upN(y1)}.`, `क्षैतिज: ${upN(x2)} − ${upN(x1)}। ऊर्ध्व: ${upN(y2)} − ${upN(y1)}।`),
                upQ('Square both, add them, and take the square root.', 'दोनों का वर्ग करो, जोड़ो, और वर्गमूल लो।')],
        ex: upQ('(1, 2) to (4, 6): across 3, up 4, √(9 + 16) = 5.', '(1, 2) से (4, 6): क्षैतिज 3, ऊर्ध्व 4, √(9 + 16) = 5।') };
    } },
  pair: { skill:'linear2', level:10, ic:'⚖️',
    title: upQ('A pair of equations', 'समीकरणों का युग्म'),
    teach: upQ('Add the two equations so y cancels, then find x.', 'दोनों समीकरण जोड़ो ताकि y कट जाए, फिर x निकालो।'),
    make(r){
      const x = r(5, 15), y = r(1, x - 1), s = x + y, d = x - y;
      return { q: upQ(`x + y = ${s} and x − y = ${d}. What is x?`, `x + y = ${s} और x − y = ${d}। x कितना है?`), ans: `x = ${x}`,
        wrong: [[`x = ${y}`, 'gavey'], [`x = ${s + d}`, 'nohalve'], [`x = ${x + 1}`, 'near']],
        steps: [upQ('Add the two equations: the +y and −y cancel.', 'दोनों समीकरण जोड़ो: +y और −y कट जाते हैं।'),
                upQ(`That leaves 2x = ${s} + ${d}. What is x?`, `बचता है 2x = ${s} + ${d}। x कितना है?`)],
        ex: upQ('x + y = 10, x − y = 4: 2x = 14, so x = 7.', 'x + y = 10, x − y = 4: 2x = 14, तो x = 7।') };
    } }
};

const UPPER_LEVELS = { 7:[], 8:[], 9:[], 10:[] };
for(const [id, k] of Object.entries(UPPER_KINDS)) UPPER_LEVELS[k.level].push(id);
const upperSkillKinds = skill => Object.keys(UPPER_KINDS).filter(id => UPPER_KINDS[id].skill === skill);
const upperHasProblem = skill => upperSkillKinds(skill).length > 0;

/* One problem of a kind, from a seed: the answer, three wrong answers
   (each a named mistake, all different from the answer and each other),
   shuffled; null only if the kind can't make one. */
function upperMake(kind, seed){
  const K = UPPER_KINDS[kind];
  if(!K) return null;
  const rnd = rng(seed >>> 0);
  const r = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for(let tries = 0; tries < 12; tries++){
    const m = K.make(r);
    if(!m) continue;
    const why = {}, seen = new Set([m.ans]);
    for(const [text, mis] of m.wrong) if(text && !seen.has(text)){ seen.add(text); why[text] = UPPER_MISTAKES[mis] ? mis : 'near'; }
    const wrong = Object.keys(why).slice(0, 3);
    if(wrong.length < 3) continue;
    for(const k of wrong.slice(3)) delete why[k];
    const opts = [m.ans, ...wrong].sort(() => rnd() - 0.5);
    return { kind:'upper', type: kind, id: `${kind}:${seed >>> 0}`, skill: K.skill, level: K.level,
             q: m.q, ans: m.ans, opts, why, steps: m.steps, ex: m.ex };
  }
  return null;
}
/* Free practice at a level (7–10): any kind at that level. */
function upperProblem(level, seed){
  const kinds = UPPER_LEVELS[Math.max(7, Math.min(10, level))] || [];
  const s = seed == null ? Math.floor(Math.random() * 1e9) : seed;
  return upperMake(kinds[s % kinds.length], s);
}
/* A problem for one skill (Munni's idea, a plan's step). */
function upperProblemFor(skill, seed){
  const kinds = upperSkillKinds(skill);
  if(!kinds.length) return null;
  const s = seed == null ? Math.floor(Math.random() * 1e9) : seed;
  return upperMake(kinds[s % kinds.length], s);
}
const upperMistakeTip = (p, picked, lang) => {
  const m = p && p.why && p.why[picked];
  return m && UPPER_MISTAKES[m] ? UPPER_MISTAKES[m][lang === 'hi' ? 'hi' : 'en'] : null;
};

/* The Story Fire: one built-in lesson per kind and seed — the rule, a
   worked example, then two questions of the kind (each its own seed), so
   every Class 6–10 skill here is teachable from the first day. */
const UPPER_CONCEPTS = Object.entries(UPPER_KINDS).map(([kind, K]) => ({
  id: 'up-' + kind, band: 'fluent', g: K.level === 7 ? 6 : K.level === 8 ? 7 : K.level === 9 ? 8 : 9, ic: K.ic, upper: true,
  key: p => `up-${kind}-${p.s}`,
  title: () => K.title,
  sub: () => upQ('Learn it, then two to try', 'सीखो, फिर दो सवाल'),
  space: () => [11, 23, 37, 51].map(s => ({ s })),
  beats: p => {
    const a = upperMake(kind, p.s * 7919 + 1), b = upperMake(kind, p.s * 104729 + 3);
    const ask = (x) => ({ t:'ask', derived:true, q: x.q, opts: x.opts, hiOpts: x.opts, correct: x.opts.indexOf(x.ans), why: x.why, upper: kind });
    return [
      { t:'intro', say: K.teach },
      { t:'intro', say: K.ex },
      ask(a),
      ask(b),
      { t:'win', say: upQ('You worked it out yourself.', 'तुमने ख़ुद हल किया।') }
    ];
  }
}));
if(typeof CONCEPTS !== 'undefined') CONCEPTS.push(...UPPER_CONCEPTS);

/* The skills these make teachable (content/skills.js lists Classes 6–8;
   these add the rest, and Classes 9–10). */
const UPPER_SKILLS = [
  {id:'squares',     strand:'num', g:8,  en:'Squares and square roots', hi:'वर्ग और वर्गमूल',      pre:['mult2x2'],               concepts:[]},
  {id:'pythag',      strand:'num', g:9,  en:'Pythagoras theorem',       hi:'पाइथागोरस प्रमेय',     pre:['squares','triarea'],     concepts:[]},
  {id:'stats',       strand:'num', g:9,  en:'Mean of data',             hi:'आँकड़ों का माध्य',     pre:['average'],               concepts:[]},
  {id:'quadratic',   strand:'num', g:10, en:'Quadratic equations',      hi:'द्विघात समीकरण',       pre:['factorise','lineareq2'], concepts:[]},
  {id:'ap',          strand:'num', g:10, en:'Arithmetic progressions',  hi:'समांतर श्रेढ़ी',        pre:['lineareq'],              concepts:[]},
  {id:'probability', strand:'num', g:10, en:'Probability',              hi:'प्रायिकता',            pre:['rational'],              concepts:[]},
  {id:'trig',        strand:'num', g:10, en:'Trigonometric ratios',     hi:'त्रिकोणमितीय अनुपात',  pre:['pythag','ratio'],        concepts:[]},
  {id:'coordgeo',    strand:'num', g:10, en:'Distance on a grid',       hi:'निर्देशांक दूरी',       pre:['pythag','integers'],     concepts:[]},
  {id:'linear2',     strand:'num', g:10, en:'Pairs of equations',       hi:'समीकरणों का युग्म',     pre:['lineareq2'],             concepts:[]}
];
if(typeof SKILLS !== 'undefined'){
  for(const s of UPPER_SKILLS) if(!SKILLS.find(x => x.id === s.id)) SKILLS.push(s);
  // each skill is taught by its kinds' lessons
  for(const c of UPPER_CONCEPTS){
    const s = SKILLS.find(x => x.id === UPPER_KINDS[c.id.slice(3)].skill);
    if(s && !s.concepts.includes(c.id)) s.concepts.push(c.id);
  }
}
