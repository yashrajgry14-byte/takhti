/* ==================================================================
   GENERATIVE AI BACKEND BRAIN — Cartoon Video & Animation Synthesizer

   Evaluates a child's learning profile, age band, skill history,
   favorite traditional game, and teacher homework assignments to
   generate structured multi-scene cartoon video blueprints.

   Requires: content/games.js, content/skills.js, content/ages.js
   ================================================================== */

function genCartoonSvgKeyframe(themeOrGameId, sceneIndex, stepIndex){
  const themeObj = typeof themeById === 'function' ? themeById(themeOrGameId) : null;
  const gList = typeof GAMES !== 'undefined' ? GAMES : [{id:'kabaddi', accent:'#3FBB78', actor:'🤼', proj:'🏃'}];
  const g = gList.find(x=>x.id===themeOrGameId);

  const accent = (themeObj && themeObj.accent) || (g && g.accent) || '#3FBB78';
  const actor = (themeObj && themeObj.actor) || (g && g.actor) || '🏃';
  const proj = (themeObj && themeObj.proj) || (g && g.proj) || '🔴';
  const themeId = (themeObj && themeObj.id) || (g && g.id) || 'sports';

  const offsetX = (stepIndex || 0) * 35;
  const bounceY = Math.sin((stepIndex || 0) * 1.5) * 8;

  let backdropElements = '';
  if(themeId === 'anime'){
    backdropElements = `
      <circle cx="180" cy="90" r="65" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="10,5" opacity="0.7"/>
      <path d="M 120 40 L 160 90 L 140 140" fill="none" stroke="#FFD700" stroke-width="2.5" opacity="0.8"/>
      <path d="M 240 40 L 200 90 L 220 140" fill="none" stroke="#FFD700" stroke-width="2.5" opacity="0.8"/>
    `;
  } else if(themeId === 'scifi'){
    backdropElements = `
      <ellipse cx="180" cy="90" rx="90" ry="30" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.7"/>
      <circle cx="90" cy="50" r="12" fill="#4C7BE0" opacity="0.8"/>
      <circle cx="280" cy="130" r="16" fill="#E8447C" opacity="0.7"/>
    `;
  } else if(themeId === 'cinema'){
    backdropElements = `
      <polygon points="40,20 180,140 320,20" fill="${accent}" opacity="0.15"/>
      <rect x="10" y="10" width="340" height="15" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8,8"/>
    `;
  } else if(themeId === 'fantasy'){
    backdropElements = `
      <path d="M 60 140 L 60 70 L 80 40 L 100 70 L 100 140 Z" fill="${accent}" opacity="0.4"/>
      <circle cx="180" cy="90" r="45" fill="none" stroke="#9B51E0" stroke-width="3" opacity="0.8"/>
    `;
  } else {
    backdropElements = `
      <line x1="20" y1="140" x2="340" y2="140" stroke="${accent}" stroke-width="3.5" opacity="0.8"/>
      <circle cx="180" cy="90" r="55" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="6,4" opacity="0.5"/>
    `;
  }

  return `
    <svg class="cartoon-svg-frame" viewBox="0 0 360 180" style="width:100%;height:180px;background:linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.95));border-radius:14px;margin:8px 0;box-shadow:0 6px 20px rgba(0,0,0,0.5);border:2px solid ${accent};">
      <defs>
        <radialGradient id="glow-${themeId}-${sceneIndex}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <filter id="star-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      <rect width="360" height="180" fill="url(#glow-${themeId}-${sceneIndex})"/>
      ${backdropElements}
      
      <text x="50" y="40" font-size="14" fill="#FFD700" filter="url(#star-glow)">✨</text>
      <text x="310" y="45" font-size="14" fill="#FFD700" filter="url(#star-glow)">✨</text>
      <text x="180" y="35" font-size="16" fill="#FFD700" filter="url(#star-glow)">⭐</text>

      <g transform="translate(${75 + offsetX}, ${95 + bounceY})">
        <text x="0" y="0" font-size="40" text-anchor="middle" dominant-baseline="middle" filter="url(#star-glow)">${actor}</text>
        <text x="32" y="-22" font-size="26" text-anchor="middle" dominant-baseline="middle">${proj}</text>
      </g>

      <g transform="translate(275, 95)">
        <text x="0" y="0" font-size="36" text-anchor="middle" dominant-baseline="middle">🦜</text>
        <rect x="-30" y="-38" width="60" height="18" rx="9" fill="${accent}" opacity="0.9"/>
        <text x="0" y="-26" font-size="10" fill="#FFFFFF" font-weight="bold" text-anchor="middle">GAURI</text>
      </g>
    </svg>
  `;
}

function generateCartoonBlueprint(child, topicOrSkillId, options){
  options = options || {};
  const c = child || (typeof S !== 'undefined' ? S : {});
  const childName = (c && c.name) || 'Kabir';
  const age = (c && c.age) || 6;
  const bandObj = typeof bandForAge === 'function' ? bandForAge(age) : { id:'early', maxNumber:20 };
  
  const gamesList = typeof GAMES !== 'undefined' ? GAMES : [{id:'kabaddi', en:'Kabaddi', hi:'कबड्डी', actor:'🤼', proj:'🏃', accent:'#C5603A'}];
  const gameId = options.gameId || (c && c.favGame) || 'kabaddi';
  const g = gamesList.find(x => x.id === gameId) || gamesList[0];

  const skillList = typeof SKILLS !== 'undefined' ? SKILLS : [];
  const skill = skillList.find(s=>s.id===topicOrSkillId) || { id: topicOrSkillId || 'add2', en:'Addition', hi:'जोड़' };
  
  const teacherNote = options.teacherNote || '';
  const seriesTitleEn = options.seriesTitleEn || `${g.en} Math League`;
  const seriesTitleHi = options.seriesTitleHi || `${g.hi} गणित लीग`;

  let numA = 12, numB = 8, ans = 20, op = '+';
  if(skill.id === 'barsub' || skill.id === 'sub2'){
    numA = 18; numB = 7; ans = 11; op = '-';
  } else if(skill.id === 'times' || skill.id === 'array'){
    numA = 3; numB = 4; ans = 12; op = '×';
  } else if(skill.id === 'share'){
    numA = 12; numB = 3; ans = 4; op = '÷';
  }

  const videoId = `vid-${g.id}-${skill.id || 'gen'}-${Date.now()}`;

  return {
    id: videoId,
    type: 'cartoon_video',
    seriesTitle: { en: seriesTitleEn, hi: seriesTitleHi },
    title: {
      en: `🎬 ${g.en}: Mastering ${skill.en}`,
      hi: `🎬 ${g.hi}: ${skill.hi} सीखें`
    },
    sub: {
      en: `Episode starring ${childName} & Gauri`,
      hi: `${childName} और गौरी का एपिसोड`
    },
    skillId: skill.id,
    gameId: g.id,
    game: g,
    band: bandObj.id,
    durationSeconds: 120,
    scenes: [
      {
        sceneIndex: 0,
        title: { en: 'Scene 1: The Challenge', hi: 'दृश्य 1: चुनौती' },
        svg: genCartoonSvgKeyframe(g.id, 0, 0),
        narration: {
          en: `${teacherNote ? `Teacher Note: "${teacherNote}". ` : ''}Welcome to ${g.en} arena ${childName}! Gauri has a special match challenge for you today.`,
          hi: `${teacherNote ? `शिक्षक का संदेश: "${teacherNote}"। ` : ''}${g.hi} मैदान में स्वागत है ${childName}! गौरी के पास आज तुम्हारे लिए एक ख़ास चुनौती है।`
        }
      },
      {
        sceneIndex: 1,
        title: { en: 'Scene 2: Cartoon Visual Breakdown', hi: 'दृश्य 2: कार्टून दृश्य व्याख्या' },
        svg: genCartoonSvgKeyframe(g.id, 1, 1),
        narration: {
          en: `Watch how we solve this: ${numA} ${op} ${numB}. We bundle them together step-by-step!`,
          hi: `देखो हम इसे कैसे हल करते हैं: ${numA} ${op} ${numB}। हम इन्हें एक-एक करके मिलाते हैं!`
        }
      },
      {
        sceneIndex: 2,
        title: { en: 'Scene 3: Interactive Cartoon Checkpoint', hi: 'दृश्य 3: इंटरैक्टिव चैकपॉइंट' },
        svg: genCartoonSvgKeyframe(g.id, 2, 2),
        isCheckpoint: true,
        question: {
          en: `${g.en} Checkpoint: What is ${numA} ${op} ${numB}?`,
          hi: `${g.hi} चेकपॉइंट: ${numA} ${op} ${numB} का उत्तर क्या है?`
        },
        opts: [String(ans), String(ans + 2), String(Math.max(1, ans - 3))],
        hiOpts: [String(ans), String(ans + 2), String(Math.max(1, ans - 3))],
        correct: 0,
        narration: {
          en: `Now it is your turn ${childName}! Tap the correct answer to win the match!`,
          hi: `अब तुम्हारी बारी है ${childName}! मैच जीतने के लिए सही उत्तर चुनो!`
        }
      },
      {
        sceneIndex: 3,
        title: { en: 'Scene 4: Rhyme Memory & Trophy', hi: 'दृश्य 4: याद रखने का नियम और ट्रॉफी' },
        svg: genCartoonSvgKeyframe(g.id, 3, 3),
        narration: {
          en: `Match Won! Remember: ${numA} ${op} ${numB} is always ${ans}! You unlocked the Gold ${g.en} Cartoon Badge!`,
          hi: `मैच जीत गए! याद रखो: ${numA} ${op} ${numB} हमेशा ${ans} होता है! तुमने गोल्ड ${g.hi} कार्टून बैज जीता!`
        },
        badge: {
          id: `badge-${g.id}-${Date.now()}`,
          actor: g.actor,
          titleEn: `${g.en} Master`,
          titleHi: `${g.hi} मास्टर`,
          stamp: '⭐ Mastered'
        }
      }
    ]
  };
}
