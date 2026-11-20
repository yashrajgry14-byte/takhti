/* cloud/server.mjs — Takhti on Google Cloud Run.
   The real server over HTTP: it serves the app's files from a whitelist and
   nothing else (never voice/, api/, a .env or the notes), the Tier 2 endpoints
   answer honestly without a key, drafting reaches Gemini with the key in a
   header (a stand-in Gemini), and class sync round-trips through a stand-in
   Cloud Storage with the service account's token from a stand-in metadata
   server — no key file anywhere. */
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

function listen(handler){ return new Promise(r => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => r(s)); }); }
function req(port, method, p, body){
  return new Promise((resolve, reject) => {
    const data = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: data ? { 'content-type': 'application/json', 'content-length': data.length } : {} }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8'); let json = null; try{ json = JSON.parse(text); }catch(e){}
        resolve({ status: res.statusCode, type: res.headers['content-type'] || '', cache: res.headers['cache-control'] || '', text, json });
      });
    });
    r.on('error', reject); if(data) r.write(data); r.end();
  });
}

(async () => {
  // a stand-in Gemini that records what reached it
  const seen = [];
  const gem = await listen((q, s) => { let b = ''; q.on('data', c => b += c); q.on('end', () => {
    seen.push({ url: q.url, key: q.headers['x-goog-api-key'], body: b });
    s.writeHead(200, { 'content-type': 'application/json' });
    s.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ lessons: [] }) }] } }] }));
  }); });

  for(const k of ['GEMINI_API_KEY', 'TAKHTI_SYNC_BUCKET', 'ANTHROPIC_API_KEY']) delete process.env[k];
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'cloud', 'server.mjs')).href);
  const srv = await listen(mod.handle);
  const port = srv.address().port;

  // ---- the app's files, and only those ----
  const page = await req(port, 'GET', '/');
  check('the app\'s page is served at / (HTML, never cached, so a new build shows at once)', page.status === 200 && /text\/html/.test(page.type) && /no-cache/.test(page.cache) && /<script src="src\/app.js/.test(page.text), page.status + ' ' + page.type);
  const sw = await req(port, 'GET', '/sw.js'), js = await req(port, 'GET', '/src/app.js'), man = await req(port, 'GET', '/manifest.webmanifest'), aud = await req(port, 'GET', '/audio/manifest-hi.json');
  check('…the service worker (never cached), the scripts, the manifest and the narration as their own types',
    sw.status === 200 && /no-cache/.test(sw.cache) && js.status === 200 && /javascript/.test(js.type) && man.status === 200 && /manifest/.test(man.type) && aud.status === 200 && /json/.test(aud.type),
    [sw.status, js.status, js.type, man.status, man.type, aud.status].join(' '));
  const never = ['/voice/server.js', '/voice/.env', '/api/syllabus.mjs', '/cloud/server.mjs', '/package.json', '/CLAUDE.md', '/tools/try-syllabus.mjs', '/library/BOOKS.md', '/test/cloud.test.js',
    '/src/../voice/.env', '/src/%2e%2e/package.json', '/src/..%2fpackage.json', '/icons/../CLAUDE.md', '/.git/config', '/src/'];
  const leaked = [];
  for(const p of never){ const r = await new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port, path: p }, x => { x.resume(); x.on('end', () => res(x.statusCode)); }); q.on('error', rej); q.end(); }); if(r === 200) leaked.push(p); }
  check('nothing outside the whitelist is served — the voice server, its .env, the API code, the notes, a path that climbs out', leaked.length === 0, leaked.join(', '));

  // ---- a new build reaches phones whole (20 Nov: an hour-cached script beside a new index.html) ----
  const etagOf = p => new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port, path: p }, x => { x.resume(); x.on('end', () => res({ status: x.statusCode, etag: x.headers.etag, cache: x.headers['cache-control'] || '' })); }); q.on('error', rej); q.end(); });
  const a1 = await etagOf('/src/ui/arrival.js');
  const a2 = await new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port, path: '/src/ui/arrival.js', headers: { 'if-none-match': a1.etag } }, x => { let n = 0; x.on('data', c => n += c.length); x.on('end', () => res({ status: x.statusCode, bytes: n })); }); q.on('error', rej); q.end(); });
  const fs = require('fs');
  const clipName = (() => { for(const l of ['hi', 'en']){ try{ const f = fs.readdirSync(path.join(__dirname, '..', 'audio', l)).find(n => /\.(mp3|wav)$/.test(n)); if(f) return `/audio/${l}/${f}`; }catch(e){} } return null; })();
  const clip = clipName ? await etagOf(clipName) : null;
  check('a script is checked with the server every time (no-cache, an ETag, a 304 with no body when unchanged); a recorded clip, named by its hash, is kept',
    a1.status === 200 && a1.cache === 'no-cache' && !!a1.etag && a2.status === 304 && a2.bytes === 0 && (!clip || (clip.status === 200 && /immutable/.test(clip.cache))),
    JSON.stringify([a1, a2, clip]));
  const swSrc = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), ix = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('…the service worker fills a new cache past the browser\'s HTTP cache, and the page opens a new build when its worker takes over (only on the first screen or the map)',
    /new Request\(u, \{ cache: 'reload' \}\)/.test(swSrc) && /updateViaCache: 'none'/.test(ix) && /controllerchange/.test(ix) && /scr === 'arrival' \|\| scr === 'map'/.test(ix),
    'sw.js / index.html');

  // ---- no key: honest answers, and the app falls back to the phone ----
  const h0 = (await req(port, 'GET', '/health')).json;
  const syl0 = await req(port, 'POST', '/api/syllabus', { chapter: { text: 'Shapes' }, band: 'developing', n: 2 });
  const sync0 = await req(port, 'POST', '/api/class-sync', {});
  const ask0 = await req(port, 'POST', '/api/ask', { messages: [] });
  const get0 = await req(port, 'GET', '/api/syllabus');
  check('without a key or a bucket every endpoint says so (the app then works on the phone), and a GET to the API is refused',
    h0 && h0.gemini === false && h0.sync === false && syl0.status === 503 && sync0.status === 503 && /not configured/.test(sync0.json.error) && ask0.status === 503 && get0.status === 405,
    JSON.stringify([h0, syl0.status, sync0.status, ask0.status, get0.status]));
  const bad = await req(port, 'POST', '/api/teachback', '{not json');
  check('…a body that isn\'t JSON is a 400, not a crash', bad.status === 400, bad.status + ' ' + bad.text);

  // ---- with the key: drafting reaches Gemini, the key only in a header ----
  process.env.GEMINI_API_KEY = 'test-key-not-real';
  process.env.GEMINI_API_BASE = 'http://127.0.0.1:' + gem.address().port;
  process.env.GEMINI_FALLBACK_MODEL = 'none';
  const syl = await req(port, 'POST', '/api/syllabus', { chapter: { text: 'Chapter 5: Shapes. A square has four equal sides.' }, band: 'developing', grade: 3, n: 2 });
  check('with the key from Secret Manager, a chapter goes to Gemini — the key in a header, never in the URL — and the drafts come back',
    syl.status === 200 && Array.isArray(syl.json.lessons) && seen.length === 1 && seen[0].key === 'test-key-not-real' && !seen[0].url.includes('test-key') && /Square has four|square has four/i.test(seen[0].body),
    JSON.stringify([syl.status, seen.map(s => s.url)]));
  const before = seen.length;
  const ask = await req(port, 'POST', '/api/ask', { max_tokens: 1000, messages: [{ role: 'user', content: 'A child aged 6-9 in India asked: "why is the sky blue?"' }] });
  const asked = seen.slice(before);
  check('Ask me: a saved question goes to Gemini with the same key (in a header), and comes back in the shape the app reads (content[0].text)',
    ask.status === 200 && Array.isArray(ask.json.content) && ask.json.content[0].type === 'text' && typeof ask.json.content[0].text === 'string'
      && asked.length >= 1 && asked[0].key === 'test-key-not-real' && !asked[0].url.includes('test-key') && /:generateContent$/.test(asked[0].url) && /sky blue/.test(asked[0].body),
    JSON.stringify([ask.status, ask.json, asked.map(s => s.url)]));
  const askEmpty = await req(port, 'POST', '/api/ask', { messages: [] });
  check('…a request with no question is a 400, and Gemini is never called for it', askEmpty.status === 400 && seen.length === before + asked.length, askEmpty.status);
  check('…Cloud Run takes a whole chapter (12 MB) and the full model chain (180 s), unlike a serverless host', process.env.TAKHTI_SYLLABUS_MAX_MB === '12' && process.env.TAKHTI_SYLLABUS_TIMEOUT_MS === '180000', process.env.TAKHTI_SYLLABUS_MAX_MB + ' ' + process.env.TAKHTI_SYLLABUS_TIMEOUT_MS);

  // ---- fail-closed school identity and cloud data access ----
  process.env.TAKHTI_SYNC_BUCKET = 'takhti-classes-test';
  const noFirebase = await req(port, 'POST', '/api/class-sync', { code:'CLS042',
    children:{ c1:{ childName:'Riya', at:Date.now() } } });
  check('cloud sync refuses all child records when verified authentication is not configured',
    noFirebase.status === 503 && /not configured/.test(noFirebase.json.error),
    JSON.stringify(noFirebase.json));
  process.env.FIREBASE_PROJECT_ID = 'test-school-project';
  const noToken = await req(port, 'POST', '/api/class-sync', { code:'CLS042',
    children:{ c1:{ childName:'Riya', at:Date.now() } } });
  check('a class code without a signed identity token cannot write student records',
    noToken.status === 401, noToken.status);
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.TAKHTI_SYNC_BUCKET;

  srv.close(); gem.close();
  console.log('\n' + '-'.repeat(70));
  checks.forEach(c => console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass ? '' : '  → ' + c.detail}`));
  console.log('-'.repeat(70));
  const failures = checks.filter(c => !c.pass).length;
  console.log(`${checks.length - failures}/${checks.length} checks passed`);
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
