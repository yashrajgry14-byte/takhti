/* ==================================================================
   CARTOON EPISODES — a 4-scene animated episode for one maths skill.

   Deterministic, on-device, no model: "generative" here means the
   episode is assembled from the child's own data, not authored by hand.
   What actually varies per child:
     · the skill (from homework, a diagnosed gap, or the catalog)
     · both problems — skillProblem() (core/mathgen.js), so they really
       exercise that skill and stay inside the child's age band
     · the child's own favourite game (the objects in the animation)
     · the visual theme (content/themes.js)

   The four scenes:
     1. Hook          — the child, Gauri, and the challenge
     2. Watch how     — a WORKED EXAMPLE of the same skill (a different
                        problem, drawn with ui/lesson-player.js's lesArt()
                        beats where the numbers are small enough to draw)
     3. Your turn     — the child's own problem; the answer counts as
                        skill evidence (ui/video-player.js)
     4. Remember      — the one-line rule for this kind of sum, and a card
                        if they got scene 3 right

   Returns null for any skill skillProblem() can't turn into a question.
   ================================================================== */

const CARTOON_RULE = {
  '+':   { en:'Adding? Start from the bigger number and count on.',   hi:'जोड़ना है? बड़ी संख्या से शुरू करके आगे गिनो।' },
  '−':   { en:'Taking away? Start from the total and count back.',     hi:'घटाना है? कुल से शुरू करके पीछे गिनो।' },
  '×':   { en:'Times means equal groups — count the groups.',          hi:'गुणा मतलब बराबर समूह — समूह गिनो।' },
  '÷':   { en:'Dividing? Share out equally, one each, round and round.', hi:'भाग देना है? बराबर बाँटो, एक-एक करके।' },
  'mix': { en:'Multiply first, then add.',                             hi:'पहले गुणा, फिर जोड़।' }
};

/* The drawable beat for a worked example, or null when the numbers are
   too big to draw object-by-object (then scene 2 shows the steps as text). */
function cartoonExampleBeat(p){
  if(p.op === '+') return p.ans <= 20 ? { t:'add', a:p.a, b:p.b } : { t:'line', a:p.a, b:p.b, hops:1 };
  if(p.op === '−') return p.a <= 20 ? { t:'take', a:p.a, b:p.b } : { t:'bar', a:p.a, b:p.b };
  if(p.op === '×') return p.ans <= 40 ? { t:'array', a:p.a, b:p.b } : null;
  if(p.op === '÷') return p.a <= 40 ? { t:'share', a:p.a, b:p.b } : null;
  return { t:'array', a:p.b, b:p.c };                      // mix: draw the multiplication that happens first
}

/* How the worked example is said, step by step. */
function cartoonExampleSay(p){
  if(p.op === 'mix') return {
    en:`Watch: ${p.text}. Multiply first — ${p.b} × ${p.c} = ${p.b*p.c}. Then add ${p.a}: ${p.ans}.`,
    hi:`देखो: ${p.text}। पहले गुणा — ${p.b} × ${p.c} = ${p.b*p.c}। फिर ${p.a} जोड़ो: ${p.ans}।` };
  if(p.op === '×' && p.a >= 10){
    const t = Math.floor(p.a/10)*10, o = p.a % 10;
    return {
      en:`Watch: ${p.text}. Split ${p.a} into ${t} and ${o}: ${t} × ${p.b} = ${t*p.b}, ${o} × ${p.b} = ${o*p.b}. Together: ${p.ans}.`,
      hi:`देखो: ${p.text}। ${p.a} को ${t} और ${o} में तोड़ो: ${t} × ${p.b} = ${t*p.b}, ${o} × ${p.b} = ${o*p.b}। कुल: ${p.ans}।` };
  }
  return { en:`Watch: ${p.text} = ${p.ans}.`, hi:`देखो: ${p.text} = ${p.ans}।` };
}

/* One scene's backdrop: the theme sets the scenery and colour, the
   child's own game supplies the actor and object, and Gauri (the real
   chalk-sparrow drawing, ui/mascot.js) watches from the right. */
function genCartoonSvgKeyframe(theme, game, sceneIndex){
  const accent = theme.accent;
  const offsetX = sceneIndex * 35, bounceY = Math.sin(sceneIndex * 1.5) * 8;
  const backdrop = {
    anime:   `<circle cx="180" cy="90" r="65" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="10,5" opacity="0.7"/>
              <path d="M 120 40 L 160 90 L 140 140 M 240 40 L 200 90 L 220 140" fill="none" stroke="#FFD700" stroke-width="2.5" opacity="0.8"/>`,
    scifi:   `<ellipse cx="180" cy="90" rx="90" ry="30" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.7"/>
              <circle cx="90" cy="50" r="12" fill="#4C7BE0" opacity="0.8"/><circle cx="280" cy="130" r="16" fill="#E8447C" opacity="0.7"/>`,
    cinema:  `<polygon points="40,20 180,140 320,20" fill="${accent}" opacity="0.15"/>
              <rect x="10" y="10" width="340" height="15" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8,8"/>`,
    fantasy: `<path d="M 60 140 L 60 70 L 80 40 L 100 70 L 100 140 Z" fill="${accent}" opacity="0.4"/>
              <circle cx="180" cy="90" r="45" fill="none" stroke="#9B51E0" stroke-width="3" opacity="0.8"/>`,
    folktale:`<rect x="30" y="22" width="300" height="130" rx="18" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.6"/>
              <path d="M 40 140 Q 180 100 320 140" fill="none" stroke="#F0A02A" stroke-width="2" opacity="0.6"/>`,
    sports:  `<line x1="20" y1="140" x2="340" y2="140" stroke="${accent}" stroke-width="3.5" opacity="0.8"/>
              <circle cx="180" cy="90" r="55" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="6,4" opacity="0.5"/>`
  }[theme.id] || '';

  return `
    <svg class="cartoon-svg-frame" viewBox="0 0 360 180" role="img" aria-label="${attr(theme.en)}" style="width:100%;height:180px;background:linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.95));border-radius:14px;margin:8px 0;border:2px solid ${accent};">
      <defs>
        <radialGradient id="glow-${theme.id}-${sceneIndex}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="360" height="180" fill="url(#glow-${theme.id}-${sceneIndex})"/>
      ${backdrop}
      <text x="50" y="40" font-size="14">✨</text><text x="310" y="45" font-size="14">✨</text>
      <g transform="translate(${75 + offsetX}, ${95 + bounceY})">
        <text x="0" y="0" font-size="40" text-anchor="middle" dominant-baseline="middle">${game.actor}</text>
        <text x="32" y="-22" font-size="26" text-anchor="middle" dominant-baseline="middle">${gameObj(game)}</text>
      </g>
      ${gauriSmall('x="245" y="62" width="60" height="60"', 'cartoon-gauri')}
    </svg>`;
}

/* Skills whose skillProblem() is a plain sum that doesn't show the skill,
   so an episode would be titled one thing and ask another: "Counting to
   20" asked 11 + 8, "Hundreds" asked 1 + 3 in Class 2–3, "Rupees and
   paise" a sum with no ₹, "Tens and ones" a sum with no tens or ones
   asked about. They get no cartoon (Munni's video teaches tens and ones,
   Counting Stones the rest) until an episode can ask the skill itself. */
const CARTOON_NOT = ['count20', 'place2', 'place3', 'money2'];
function cartoonable(skillId){ return !CARTOON_NOT.includes(skillId); }

function generateCartoonBlueprint(child, skillId, options){
  options = options || {};
  if(!cartoonable(skillId)) return null;
  const c = child || S;
  const seed = seedOf((c.id || c.name || 'x') + '|vid|' + skillId + '|' + dayKey());
  const q = skillProblem(skillId, seed);
  if(!q) return null;
  const ex = skillProblem(skillId, seed + 101);           // a different worked example of the same skill
  const g = gameById(options.gameId || c.game);
  const theme = themeById(options.themeId);
  const skill = skillById(skillId);
  const name = c.name || '';
  const rule = CARTOON_RULE[q.op];

  return {
    id: `vid-${theme.id}-${g.id}-${skillId}`,
    skillId, gameId: g.id, themeId: theme.id, game: g, theme,
    title: { en:`${theme.ic} ${skill.en}`, hi:`${theme.ic} ${skill.hi}` },
    scenes: [
      { title:{ en:'The challenge', hi:'चुनौती' },
        svg: genCartoonSvgKeyframe(theme, g, 0),
        narration:{
          en:`${options.teacherNote ? `Your teacher says: "${options.teacherNote}". ` : ''}Welcome to the ${theme.en} ${g.en} arena, ${name}! Gauri has a ${skill.en.toLowerCase()} challenge for you.`,
          hi:`${options.teacherNote ? `शिक्षक का संदेश: "${options.teacherNote}"। ` : ''}${theme.hi} ${g.hi} मैदान में स्वागत है, ${name}! गौरी के पास तुम्हारे लिए ${skill.hi} की चुनौती है।` } },
      { title:{ en:'Watch how', hi:'ऐसे करते हैं' },
        svg: genCartoonSvgKeyframe(theme, g, 1),
        beat: cartoonExampleBeat(ex),
        narration: cartoonExampleSay(ex) },
      { title:{ en:'Your turn', hi:'अब तुम्हारी बारी' },
        svg: genCartoonSvgKeyframe(theme, g, 2),
        isCheckpoint: true,
        question:{ en:`${q.text} = ?`, hi:`${q.text} = ?` },
        opts: q.opts, correct: q.correct,
        narration:{ en:`Your turn, ${name}! Tap the answer to win the round.`,
                    hi:`अब तुम्हारी बारी, ${name}! राउंड जीतने के लिए सही उत्तर चुनो।` } },
      { title:{ en:'Remember', hi:'याद रखो' },
        svg: genCartoonSvgKeyframe(theme, g, 3),
        narration:{ en:`${rule.en} ${q.text} = ${q.ans}.`, hi:`${rule.hi} ${q.text} = ${q.ans}।` },
        badge:{ id:`card-vid-${skillId}`, actor: theme.ic,
                titleEn:`${theme.en} · ${skill.en}`, titleHi:`${theme.hi} · ${skill.hi}` } }
    ]
  };
}
