/* ==================================================================
   TOPIC CARTOON SERIES ENGINE — Multi-Episode Animated Arcs

   Generates multi-episode cartoon series following recurring Indian
   game champions & mascots across continuous curriculum topics.

   Requires: core/generative-brain.js, content/games.js
   ================================================================== */

function generateCartoonSeries(seriesId, child){
  const c = child || (typeof S !== 'undefined' ? S : {});
  const favGame = (c && c.favGame) || 'kabaddi';

  const SERIES_TEMPLATES = {
    kabaddi_league: {
      id: 'kabaddi_league',
      title: { en: "Kabir's Kabaddi Math League", hi: "कबीर की कबड्डी गणित लीग" },
      gameId: 'kabaddi',
      icon: '🤼',
      episodes: [
        { epNum: 1, title: { en: 'Ep 1: The First Raid (Counting)', hi: 'एपिसोड 1: पहली रेड (गिनती)' }, skillId: 'count' },
        { epNum: 2, title: { en: 'Ep 2: Defending the Line (Addition)', hi: 'एपिसोड 2: लाइन की रक्षा (जोड़)' }, skillId: 'add2' },
        { epNum: 3, title: { en: 'Ep 3: The Championship Trophy (Carrying)', hi: 'एपिसोड 3: चैम्पियनशिप ट्रॉफी (हासिल)' }, skillId: 'carry' }
      ]
    },
    jungle_fractions: {
      id: 'jungle_fractions',
      title: { en: "Munni's Jungle Fraction Adventure", hi: "मुन्नी की जंगल भिन्न यात्रा" },
      gameId: 'chupan',
      icon: '🐘',
      episodes: [
        { epNum: 1, title: { en: 'Ep 1: Sharing the Mangoes (Equal Shares)', hi: 'एपिसोड 1: आम बाँटना (बराबर हिस्से)' }, skillId: 'share' },
        { epNum: 2, title: { en: 'Ep 2: Cutting the Cake (Halves & Quarters)', hi: 'एपिसोड 2: केक काटना (आधा और चौथाई)' }, skillId: 'frac' },
        { epNum: 3, title: { en: 'Ep 3: The Grand Jungle Feast (Fractions)', hi: 'एपिसोड 3: बड़ा जंगल दावत (भिन्न)' }, skillId: 'frac' }
      ]
    },
    cricket_champions: {
      id: 'cricket_champions',
      title: { en: "Ananya's Cricket Multiplication Cup", hi: "अनन्या का क्रिकेट गुणा कप" },
      gameId: 'cricket',
      icon: '🏏',
      episodes: [
        { epNum: 1, title: { en: 'Ep 1: Boundary Runs (Skip Counting)', hi: 'एपिसोड 1: बाउंड्री रन (छलाँग गिनती)' }, skillId: 'skip' },
        { epNum: 2, title: { en: 'Ep 2: Array Grid Bowling (Multiplication)', hi: 'एपिसोड 2: एरे ग्रिड बॉलिंग (गुणा)' }, skillId: 'array' },
        { epNum: 3, title: { en: 'Ep 3: World Cup Final (Times Tables)', hi: 'एपिसोड 3: वर्ल्ड कप फाइनल (पहाड़ा)' }, skillId: 'times' }
      ]
    }
  };

  const template = SERIES_TEMPLATES[seriesId] || SERIES_TEMPLATES.kabaddi_league;

  // Generate video blueprints for each episode
  const episodeVideos = template.episodes.map(ep => {
    if(typeof generateCartoonBlueprint === 'function'){
      const vid = generateCartoonBlueprint(c, ep.skillId, {
        gameId: template.gameId,
        seriesTitleEn: template.title.en,
        seriesTitleHi: template.title.hi
      });
      vid.episodeNum = ep.epNum;
      vid.title = ep.title;
      return vid;
    }
    return null;
  }).filter(Boolean);

  return {
    id: template.id,
    title: template.title,
    icon: template.icon,
    gameId: template.gameId,
    episodes: episodeVideos
  };
}
