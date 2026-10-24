/* ==================================================================
   TIER 1 PRACTICE LINES — core/tier1.js.

   The curated bank path (every phone), and the on-device model path
   against a stub of the browser's Prompt API (`LanguageModel`): a good
   line is accepted, anything this app wouldn't ship itself is rejected,
   and a model that isn't already on the phone is never downloaded
   mid-lesson.
   ================================================================== */
const fs = require('fs'), vm = require('vm');

let failures = 0;
const checks = [];
function check(name, pass, detail){ checks.push({ name, pass, detail }); if(!pass) failures++; }

function load(model){
  const ctx = { console, Intl, S:{ lang:'en', age:6, name:'Asha', day:0 } };
  if(model) ctx.LanguageModel = model;
  vm.createContext(ctx);
  for(const f of ['src/content/sentences.js','src/content/ages.js','src/core/matcher.js','src/core/readability.js','src/core/tier1.js'])
    vm.runInContext(fs.readFileSync(f,'utf8'), ctx, { filename:f });
  vm.runInContext('globalThis.__ = { tier1PracticeLine, t1Valid, tier1ModelStatus, SENTENCES, S };', ctx);
  return ctx.__;
}
function stubModel(status, reply){
  const calls = { create:0, prompt:0, destroyed:0, availabilityArgs:null };
  return { calls, availability: async o => { calls.availabilityArgs = o; return status; },
    create: async () => { calls.create++; return { prompt: async () => { calls.prompt++; return reply; }, destroy(){ calls.destroyed++; } }; } };
}

(async () => {
  /* ---- the bank ---- */
  const X = load();
  const p = await X.tier1PracticeLine(['ball'], 'en', 1, 'Rani has a ball.');
  check('a missed word gets a different bank line that uses it', p && p.source === 'bank' && /\bball\b/i.test(p.line) && p.line !== 'Rani has a ball.', JSON.stringify(p));
  const hp = await X.tier1PracticeLine(['दूध'], 'hi', 2, '');
  check('…in Hindi too', hp && hp.source === 'bank' && hp.line.includes('दूध'), JSON.stringify(hp));
  check('no model and no bank match → nothing offered (never a made-up line)', (await X.tier1PracticeLine(['xylophone'], 'en', 1, '')) === null, 'offered something');
  check('without the Prompt API the model status is "unavailable"', await X.tier1ModelStatus('en') === 'unavailable', 'wrong status');

  /* ---- the validator ---- */
  check('validator accepts a plain, short line with the word', X.t1Valid('The cat drinks milk.', ['cat'], 'en'), 'rejected');
  check('…rejects a line missing the target word', !X.t1Valid('The dog drinks milk.', ['cat'], 'en'), 'accepted');
  check('…rejects anything that isn\'t plain words and punctuation (markup, links, digits)', !X.t1Valid('The <b>cat</b> sat.', ['cat'], 'en') && !X.t1Valid('See cat at www.x.com now', ['cat'], 'en') && !X.t1Valid('The cat ate 5 mangoes', ['cat'], 'en'), 'accepted');
  check('…rejects a line too long for this child\'s band', !X.t1Valid('The happy little cat ran across the long green field all day.', ['cat'], 'en'), 'accepted');

  /* ---- the on-device model ---- */
  const good = stubModel('available', '"The cat sleeps in the sun."');
  const M = load(good);
  const mp = await M.tier1PracticeLine(['cat', 'sleeps'], 'en', 1, '');
  check('a word the bank lacks is filled by the on-device model, when the phone has one', mp && mp.source === 'model' && mp.line === 'The cat sleeps in the sun.', JSON.stringify(mp));
  check('the model session is always closed after use', good.calls.destroyed === 1, JSON.stringify(good.calls));
  check('the model is asked for the child\'s language specifically', JSON.stringify(good.calls.availabilityArgs).includes('"en"'), JSON.stringify(good.calls.availabilityArgs));

  const bad = stubModel('available', 'Visit www.example.com to learn more about cats!');
  const B = load(bad);
  const bp = await B.tier1PracticeLine(['cat', 'sleeps'], 'en', 1, '');
  check('a model reply this app would not ship is thrown away — the child gets the nearest bank line instead', bp && bp.source === 'bank' && !/www/.test(bp.line), JSON.stringify(bp));

  const dl = stubModel('downloadable', 'The cat sleeps.');
  const D = load(dl);
  await D.tier1PracticeLine(['cat', 'sleeps'], 'en', 1, '');
  check('a model not already on the phone is never downloaded mid-lesson', dl.calls.create === 0, JSON.stringify(dl.calls));

  const bankFirst = stubModel('available', 'The ball is round today.');
  const F = load(bankFirst);
  const fp = await F.tier1PracticeLine(['ball'], 'en', 1, 'Rani has a ball.');
  check('the curated bank always comes first; the model only fills gaps', fp.source === 'bank' && bankFirst.calls.create === 0, JSON.stringify({ fp, calls: bankFirst.calls }));

  console.log('-'.repeat(70));
  checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
  console.log('-'.repeat(70));
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exitCode = failures ? 1 : 0;
})();
