/* tools/live-check.mjs against a stand-in Gemini: three models — one that
   hears and judges properly, one that "tidies" a child's slip into the line
   and credits a vague explanation, one that is down — and the check must say
   which is which, recommend the good one, and keep the key out of everything. */
const path = require('path');
const { pathToFileURL } = require('url');
let passes = 0, failures = 0;
function check(name, pass, detail){ if(pass) passes++; else failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  → ' + String(detail).slice(0, 600)}`); }

const KEY = 'test-key-never-printed-123';
const calls = [];
// TTS: the "audio" is the spoken text itself, as 16-bit PCM bytes, so hearing can read it back
function standIn(url, init){
  const model = decodeURIComponent(url.match(/models\/([^:]+):/)[1]);
  const body = JSON.parse(init.body);
  calls.push({ model, key: init.headers['x-goog-api-key'] });
  const json = d => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(d) });
  if(model === 'down-model') return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
  const parts = body.contents[0].parts;
  if(body.generationConfig && body.generationConfig.responseModalities){
    const text = parts[0].text.replace(/^Say in .*? way: /, '');
    return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: Buffer.from(text, 'utf8').toString('base64') } }] } }] });
  }
  const sys = body.systemInstruction.parts[0].text;
  if(/write down exactly what a child said/.test(sys)){
    const audio = parts.find(p => p.inline_data);
    const said = Buffer.from(audio.inline_data.data, 'base64').slice(44).toString('utf8');
    const line = (parts.find(p => p.text) || {}).text;
    const out = model === 'tidy-model' && line ? line.replace('The line: ', '') : said;   // the tidier writes the line
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ said: out }) }] } }] });
  }
  if(/check how well a child explained/.test(sys)){
    const p = JSON.parse(parts[0].text), t = p.child_said;
    const aims = p.points.map(a => {
      if(model === 'tidy-model') return { id: a.id, verdict: 'covered', quote: t.split(' ').slice(0, 4).join(' ') };   // credits anything
      const hit = a.id === 'borrow.when' ? /(borrow \w+ ten|das udhaar lo)/.exec(t) : /(becomes 12|12 ho jayega)/.exec(t);
      return hit ? { id: a.id, verdict: 'covered', quote: hit[0] } : { id: a.id, verdict: 'missing', quote: '' };
    });
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ aims }) }] } }] });
  }
  return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) });
}

(async () => {
  const lc = await import(pathToFileURL(path.join(__dirname, '..', 'tools', 'live-check.mjs')).href);
  const env = { GEMINI_API_KEY: KEY, GEMINI_TTS_MODEL: 'tts-model', TAKHTI_TEACH_MODEL: 'down-model', GEMINI_SPEECH_MODEL: 'tidy-model', GEMINI_FALLBACK_MODEL: 'good-model', SARVAM_API_KEY: '' };
  const out = await lc.run({ env, quiet: true }, standIn);
  const hear = m => out.hear.find(x => x.model === m), judge = m => out.judge.find(x => x.model === m);

  check('the models tried: the judge\'s, the hearing\'s, then the fallbacks', out.models.join(',') === 'down-model,tidy-model,good-model', out.models);
  check('Munni\'s voice made, and the clips with it', out.tts.ok && out.hear.length >= 2, JSON.stringify(out.tts));
  check('the good model keeps the Hindi slip, the English slip and the skipped word, and writes a clean read as read',
    hear('good-model').rows.length === 4 && hear('good-model').rows.every(r => r.pass), JSON.stringify(hear('good-model').rows));
  const tidy = hear('tidy-model').rows;
  check('a model that writes the line instead of what was said fails on each slip, and says so ("wrote … — the line")',
    tidy.filter(r => !r.pass).length === 3 && /the line, not what was said/.test(tidy.find(r => r.case === 'hi-slip').why) && tidy.find(r => r.case === 'hi-clean').pass, JSON.stringify(tidy));
  check('a model that is down fails every case, with the reason', hear('down-model').rows.every(r => !r.pass && /503/.test(r.why)), JSON.stringify(hear('down-model').rows));
  check('the good judge: both full explanations covered, the vague and the echo not', judge('good-model').rows.every(r => r.pass), JSON.stringify(judge('good-model').rows));
  check('a judge that credits anything fails the vague explanation (its quote check can\'t save it when the quote is real)',
    !judge('tidy-model').rows.find(r => r.case === 'vague').pass, JSON.stringify(judge('tidy-model').rows));
  check('…and repeating Munni\'s own question back is downgraded for that point by the quote check, whatever the judge said',
    /borrow\.when=partly/.test(judge('tidy-model').rows.find(r => r.case === 'echo-munni').verdicts), JSON.stringify(judge('tidy-model').rows));
  check('a judge that is down gives no judgement — the phone\'s rubric would decide', judge('down-model').rows.every(r => !r.pass && /rubric/.test(r.why)), JSON.stringify(judge('down-model').rows));
  check('judging from a recording: heard by the good hearer, judged by the good judge, both points covered',
    out.judgeAudio && out.judgeAudio.pass && out.judgeAudio.hearModel === 'good-model' && out.judgeAudio.judgeModel === 'good-model', JSON.stringify(out.judgeAudio));
  check('the advice names the settings to change', out.advice.some(a => /GEMINI_SPEECH_MODEL=good-model/.test(a)) && out.advice.some(a => /TAKHTI_TEACH_MODEL=good-model/.test(a)), out.advice.join(' | '));
  const rep = lc.report(out);
  check('the report has every section, and neither the report nor the result holds the key',
    /## Hearing/.test(rep) && /## Judge from a recording/.test(rep) && !rep.includes(KEY) && !JSON.stringify(out).includes(KEY), rep.slice(0, 300));
  check('the key went to Google in the header only', calls.length > 0 && calls.every(c => c.key === KEY));

  // the judge's own model setting is used by the real endpoint, and GEMINI_MODEL is the fallback
  const { judgeCore } = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'teachback.mjs')).href);
  calls.length = 0;
  const body = { consent: true, lang: 'en', ask: 'borrow.when', aims: [{ id: 'borrow.when' }], transcript: 'you borrow one ten from the tens' };
  await judgeCore(body, { GEMINI_API_KEY: KEY, GEMINI_MODEL: 'draft-model', TAKHTI_TEACH_MODEL: 'good-model' }, 't1', standIn);
  await judgeCore(body, { GEMINI_API_KEY: KEY, GEMINI_MODEL: 'good-model' }, 't2', standIn);
  check('Teach Munni\'s judge uses TAKHTI_TEACH_MODEL when set, else GEMINI_MODEL', calls[0].model === 'good-model' && calls[1].model === 'good-model' && calls.length === 2, JSON.stringify(calls));

  let threw = '';
  try{ await lc.run({ env: { GEMINI_API_KEY: '', GOOGLE_API_KEY: '' }, quiet: true }, () => { throw new Error('called'); }); }catch(e){ threw = e.message; }
  check('no key → stops before calling anyone, and says where the key goes', /voice\/\.env/.test(threw), threw);

  console.log(`\n${passes}/${passes + failures} checks passed`);
  console.log(failures ? 'FAILED' : 'PASSED');
  process.exit(failures ? 1 : 0);
})();
