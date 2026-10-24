/* ==================================================================
   CARTOON SERIES — a few episodes that build one idea, in order.

   Each series is a short ladder of real skills from the skill graph,
   easiest first, told in one game and one theme so the episodes feel
   like a story rather than a playlist. cartoonSeriesFor() keeps only the
   episodes this child's age band reaches (cartoonSkills(), see
   core/video-library-catalog.js) and drops a series with none left, so a
   five-year-old never sees a times-tables episode.
   ================================================================== */

const CARTOON_SERIES = [
  { id:'kabaddi_league', gameId:'kabaddi', themeId:'sports', icon:'🤼',
    title:{ en:'The Kabaddi Counting League', hi:'कबड्डी गिनती लीग' },
    episodes:['count20', 'add10', 'add2', 'carry'] },
  { id:'jungle_feast', gameId:'chupan', themeId:'folktale', icon:'🐘',
    title:{ en:"Munni's Jungle Feast", hi:'मुन्नी की जंगल दावत' },
    episodes:['sub10', 'sub2', 'borrow', 'divshare'] },
  { id:'cricket_cup', gameId:'cricket', themeId:'anime', icon:'🏏',
    title:{ en:'The Cricket Power-Up Cup', hi:'क्रिकेट पॉवर-अप कप' },
    episodes:['skip', 'tables', 'mult2x1', 'bodmas'] }
];

function cartoonSeriesFor(){
  const reach = new Set(cartoonSkills().map(s => s.id));
  return CARTOON_SERIES
    .map(sr => ({ ...sr, episodes: sr.episodes.filter(id => reach.has(id)) }))
    .filter(sr => sr.episodes.length);
}
