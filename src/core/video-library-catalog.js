/* ==================================================================
   INFINITE KIDS VIDEO LIBRARY CATALOG & RECOMMENDATION ENGINE

   Indexes, categorizes, and serves an expanding repository of
   personalized educational cartoon videos ("YouTube for Kids").

   Requires: core/generative-brain.js, core/diagnose.js, content/games.js
   ================================================================== */

function getVideoCatalog(child, filter){
  const c = child || (typeof S !== 'undefined' ? S : {});
  const gamesList = typeof GAMES !== 'undefined' ? GAMES : [{id:'kabaddi', en:'Kabaddi'}];
  const skillsList = typeof SKILLS !== 'undefined' ? SKILLS : [{id:'add2', en:'Addition', hi:'जोड़'}];

  // Pre-populate core catalog items for key skills & traditional games
  const catalog = [];

  for(let i = 0; i < Math.min(8, skillsList.length); i++){
    const s = skillsList[i];
    const g = gamesList[i % gamesList.length];
    if(typeof generateCartoonBlueprint === 'function'){
      const vid = generateCartoonBlueprint(c, s.id, { gameId: g.id });
      vid.thumbnail = g.actor || '🎬';
      vid.category = (i % 2 === 0) ? 'math' : 'literacy';
      catalog.push(vid);
    }
  }

  // Filter catalog if specified
  if(filter && filter !== 'all'){
    return catalog.filter(v => v.category === filter || (filter === 'homework' && v.isHomeworkVideo));
  }
  return catalog;
}

function recommendNextVideo(child){
  const c = child || (typeof S !== 'undefined' ? S : {});
  const favGame = (c && c.favGame) || 'kabaddi';

  // Check active homework assignments first
  if(typeof personalizeContentForHomework === 'function'){
    const hw = personalizeContentForHomework(c);
    if(hw && hw.assignedSkills && hw.assignedSkills.length){
      const skillId = hw.assignedSkills[0];
      if(typeof generateCartoonBlueprint === 'function'){
        const vid = generateCartoonBlueprint(c, skillId, { gameId: favGame, teacherNote: hw.note });
        vid.isHomeworkVideo = true;
        vid.recommendationReason = {
          en: 'Assigned by your teacher as Homework!',
          hi: 'आपके शिक्षक द्वारा गृहकार्य के रूप में निर्धारित!'
        };
        return vid;
      }
    }
  }

  // Fallback: recommend based on top skill gap or default
  const skillId = 'carry';
  if(typeof generateCartoonBlueprint === 'function'){
    const vid = generateCartoonBlueprint(c, skillId, { gameId: favGame });
    vid.recommendationReason = {
      en: 'Recommended to boost your math skills!',
      hi: 'गणित कौशल को मजबूत करने के लिए अनुशंसित!'
    };
    return vid;
  }
  return null;
}
