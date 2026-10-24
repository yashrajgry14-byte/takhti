/* ==================================================================
   THE CARTOON CATALOG — what the Picture Hut (ui/video-player.js) offers
   this child, and which episode it puts first.

   The catalog is one episode per maths skill this child's age band
   reaches (CARTOON_MAX_GRADE) that skillProblem() can teach. Entries are
   lightweight — skill, theme, title — and the full episode is only built
   when one is played (generateCartoonBlueprint(), core/generative-brain.js).

   Themes: with no filter, each skill gets a theme in rotation so the
   shelf is varied; filtering by a theme shows every skill in that style.
   ================================================================== */

/* Highest school grade (SKILLS[].g) whose maths an age band's cartoons
   cover — the same years content/curriculum-early.js maps the bands to. */
const CARTOON_MAX_GRADE = { pre:1, early:1, developing:3, fluent:5 };

function cartoonSkills(){
  const gmax = CARTOON_MAX_GRADE[band().id] || 1;
  return SKILLS.filter(s => s.g >= 1 && s.g <= gmax && skillHasProblem(s.id));
}

function getVideoCatalog(child, themeFilter){
  const c = child || S;
  const filtered = themeFilter && themeFilter !== 'all';
  return cartoonSkills().map((s, i) => {
    const theme = filtered ? themeById(themeFilter) : THEMES[i % THEMES.length];
    return {
      skillId: s.id, themeId: theme.id, thumbnail: theme.ic,
      title: { en: s.en, hi: s.hi },
      earned: c.cards.some(k => k.id === `card-vid-${s.id}`)
    };
  });
}

/* The one episode to put first, and why, in plain words:
     1. homework — the diagnosed skill under what the teacher assigned
     2. the cartoon skill this child has found hardest so far (3+ tries,
        under 80%), from the same skillHistory the diagnostic reads
     3. otherwise the first one they haven't earned the card for yet */
function recommendNextVideo(child){
  const c = child || S;
  const hw = personalizeContentForHomework(c);
  if(hw && hw.storySkill && skillById(hw.storySkill)){
    return { skillId: hw.storySkill, themeId: 'sports',
             reason: { en:'Your homework, as a cartoon!', hi:'तुम्हारा गृहकार्य, कार्टून में!' } };
  }
  const skills = cartoonSkills();
  const hist = c.skillHistory || {};
  const hardest = skills
    .map(s => ({ s, h: hist[s.id] }))
    .filter(x => x.h && x.h.n >= 3 && x.h.right / x.h.n < 0.8)
    .sort((a,b) => a.h.right/a.h.n - b.h.right/b.h.n)[0];
  if(hardest) return { skillId: hardest.s.id, themeId: 'anime',
    reason: { en:'A tricky one — let us watch it together.', hi:'थोड़ा मुश्किल है — चलो साथ में देखते हैं।' } };
  const next = skills.find(s => !c.cards.some(k => k.id === `card-vid-${s.id}`)) || skills[0];
  return next ? { skillId: next.id, themeId: 'cinema',
    reason: { en:'Something new to try.', hi:'कुछ नया आज़माओ।' } } : null;
}
