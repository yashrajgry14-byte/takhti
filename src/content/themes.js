/* ==================================================================
   THEMES REGISTRY — Multi-Theme Cartoon Universes

   Extends Takhti's generative cartoon engine beyond traditional sports
   into Anime Power-Up Arcs, Movies & Cinema Sagas, Folk & Fables,
   Sci-Fi Space Odysseys, and Fantasy Magic Quests.
   ================================================================== */

const THEMES = [
  { id:'sports', en:'Sports & Games', hi:'खेल और खेलकुद', ic:'🤼', actor:'🤼', proj:'🔴', accent:'#3FBB78', bg:'sports-arena' },
  { id:'anime', en:'Anime Power-Up', hi:'एनिमे पॉवर-अप', ic:'⚔️', actor:'⚔️', proj:'⚡', accent:'#E8447C', bg:'energy-aura' },
  { id:'cinema', en:'Movies & Cinema', hi:'सिनेमा और फ़िल्में', ic:'🎬', actor:'🎬', proj:'🍿', accent:'#F0A02A', bg:'movie-stage' },
  { id:'folktale', en:'Folk & Fables', hi:'लोक कथाएँ', ic:'📜', actor:'📜', proj:'🦉', accent:'#3FBB78', bg:'ancient-scroll' },
  { id:'scifi', en:'Sci-Fi Space', hi:'साइ-फ़ाइ अंतरिक्ष', ic:'🚀', actor:'🚀', proj:'🛸', accent:'#4C7BE0', bg:'cosmic-space' },
  { id:'fantasy', en:'Magic & Fantasy', hi:'जादू और फ़ैंटेसी', ic:'🐉', actor:'🐉', proj:'🔮', accent:'#9B51E0', bg:'magic-castle' }
];

function themeById(id){
  return THEMES.find(t => t.id === id) || THEMES[0];
}
