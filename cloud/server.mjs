/* ==================================================================
   Takhti on Google Cloud Run — one service, no dependencies.

   It serves the app itself (index.html, src/, icons/, audio/ — and
   nothing else from the repo: never voice/, api/, tools/ or a .env) and
   the Tier 2 endpoints the app already calls on its own origin:

     POST /api/syllabus    a chapter → Gemini's draft lessons (api/syllabus.mjs)
     POST /api/teachback   Teach Appu's judge on words (api/teachback.mjs)
     POST /api/class-sync  class sync, stored in a Cloud Storage bucket
     POST /api/ask         the question queue (api/ask.js; 503 without its key)

   The rule still holds: the network loads tomorrow, it never serves
   today. Every lesson runs on the phone; these only draft next week's
   lessons, judge an explanation, and carry the class between phones.

   Settings (Cloud Run environment / Secret Manager):
     GEMINI_API_KEY        from Secret Manager — never in the image or the repo
     TAKHTI_SYNC_BUCKET    a Cloud Storage bucket for class sync (unset → the
                           app says "sync isn't set up" and the codes still work)
     PORT                  set by Cloud Run
   ================================================================== */
import http from 'node:http';
import {createHash} from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Cloud Run has no 6 MB / 60 s serverless cap: a whole NCERT chapter, and
// the full three-model chain (unless the deploy sets its own)
process.env.TAKHTI_SYLLABUS_MAX_MB ||= '12';
process.env.TAKHTI_SYLLABUS_TIMEOUT_MS ||= '180000';

const { draftCore } = await import('../api/syllabus.mjs');
const { judgeCore } = await import('../api/teachback.mjs');
const { syncCore } = await import('../api/class-sync.mjs');
const { askCore } = await import('../api/ask.js');
const { ttsCore } = await import('./tts.mjs');
const {verifyIdToken,bearerToken,authorizeClass} = await import('../api/lib/class-auth.mjs');

/* ---------- the app's files: a whitelist, never the whole repo ---------- */
const FILES = new Set(['/index.html', '/sw.js', '/manifest.webmanifest']);
const DIRS = ['/src/', '/icons/', '/fonts/', '/audio/'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2'
};

async function serveFile(req, res, urlPath){
  let p;
  try{ p = decodeURIComponent(urlPath); }catch(e){ return false; }
  if(p === '/') p = '/index.html';
  if(p.includes('\0') || p.split('/').includes('..')) return false;
  if(!FILES.has(p) && !DIRS.some(d => p.startsWith(d))) return false;
  const file = path.join(ROOT, p);
  if(!file.startsWith(ROOT + path.sep)) return false;
  try{
    const st = await stat(file);
    if(!st.isFile()) return false;
    // Every file is checked with the server on each load (a 304 when it is the
    // same): a script kept for an hour beside a new index.html was two builds
    // at once (20 Nov). Only a recorded clip, named by a hash of its text,
    // never changes and is kept.
    const clip = p.startsWith('/audio/') && !p.endsWith('.json');
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const head = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': clip ? 'public, max-age=31536000, immutable' : 'no-cache',
      'ETag': etag, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    };
    if(req.headers['if-none-match'] === etag){ res.writeHead(304, head); res.end(); return true; }
    const body = await readFile(file);
    res.writeHead(200, head);
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }catch(e){ return false; }
}

/* ---------- class sync in Cloud Storage (the shape api/class-sync.mjs asks for) ---------- */
let TOKEN = null;
async function gcsToken(){
  if(TOKEN && TOKEN.exp > Date.now() + 60000) return TOKEN.v;
  // Cloud Run's own service account, from the metadata server — no key file anywhere
  const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { headers: { 'Metadata-Flavor': 'Google' } });
  if(!r.ok) throw new Error('no metadata token');
  const j = await r.json();
  TOKEN = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return TOKEN.v;
}
function gcsStore(bucket){
  const name = key => 'classes/' + String(key).replace(/[^A-Za-z0-9_-]/g, '_') + '.json';
  const B = encodeURIComponent(bucket);
  return {
    async get(key){
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${B}/o/${encodeURIComponent(name(key))}?alt=media`, { headers: { Authorization: 'Bearer ' + await gcsToken() } });
      if(r.status === 404) return null;
      if(!r.ok) throw new Error('storage ' + r.status);
      return r.json();
    },
    async setJSON(key, value){
      const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${B}/o?uploadType=media&name=${encodeURIComponent(name(key))}`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + await gcsToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(value)
      });
      if(!r.ok) throw new Error('storage ' + r.status);
    }
  };
}

/* ---------- plumbing ---------- */
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
};
const LIMIT = 24 * 1024 * 1024;   // a 12 MB PDF is ~16 MB as base64
function readJSON(req){
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if(size > LIMIT){ reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try{ resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }catch(e){ reject(Object.assign(new Error('bad JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

export async function handle(req, res){
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try{
    if(p === '/health' || p === '/healthz') return json(res, 200, { ok: true, gemini: !!process.env.GEMINI_API_KEY, sync: !!(process.env.TAKHTI_SYNC_BUCKET && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_WEB_API_KEY) });
    if(p === '/api/auth-config' && req.method==='GET') return json(res,200,{enabled:!!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_WEB_API_KEY),apiKey:process.env.FIREBASE_WEB_API_KEY || null});
    if(p === '/api/class-identity' && req.method === 'GET') {
      if(!process.env.FIREBASE_PROJECT_ID || !process.env.TAKHTI_SYNC_BUCKET) return json(res,503,{error:'verified school access not configured'});
      const token=bearerToken(req); if(!token) return json(res,401,{error:'sign in first'});
      try{
        const user=await verifyIdToken(token,process.env.FIREBASE_PROJECT_ID);
        if(!user.emailVerified) return json(res,403,{error:'verify your email before accessing school records'});
        const aclId=createHash('sha256').update(user.uid).digest('hex');
        const access=await gcsStore(process.env.TAKHTI_SYNC_BUCKET).get('access-'+aclId);
        if(!access || access.active!==true || !['teacher','guardian'].includes(access.role)) return json(res,403,{error:'school administrator has not granted access'});
        return json(res,200,{role:access.role,classes:access.role==='teacher'?access.classes:[],email:user.email});
      }catch(e){return json(res,401,{error:'invalid or expired session'});}
    }
    if(p.startsWith('/api/')){
      if(req.method !== 'POST') return json(res, 405, { error: 'POST only' });
      const body = await readJSON(req);
      if(p === '/api/syllabus'){ const out = await draftCore(body, process.env, clientIp(req)); return json(res, out.status, out.json); }
      if(p === '/api/teachback'){ const out = await judgeCore(body, process.env, clientIp(req)); return json(res, out.status, out.json); }
      if(p === '/api/class-sync'){
        if(!process.env.TAKHTI_SYNC_BUCKET || !process.env.FIREBASE_PROJECT_ID)
          return json(res, 503, {error:'verified class sync is not configured'});
        const token=bearerToken(req);
        if(!token) return json(res,401,{error:'sign in as a verified teacher or guardian'});
        let user;
        try{user=await verifyIdToken(token,process.env.FIREBASE_PROJECT_ID);}
        catch(e){return json(res,401,{error:'invalid or expired identity token'});}
        if(!user.emailVerified) return json(res,403,{error:'verify email first'});
        try{
          // ACL documents are created only by the school administrator using
          // server-side Cloud Storage access. Clients cannot edit ACLs via HTTP.
          const aclId=createHash('sha256').update(user.uid).digest('hex');
          const store=gcsStore(process.env.TAKHTI_SYNC_BUCKET);
          const access=await store.get('access-'+aclId);
          const auth=authorizeClass(body,access);
          if(!auth.ok) return json(res,auth.status,{error:'class or child access denied'});
          const out=await syncCore(store,body,auth);
          return json(res,out.status,out.json);
        }catch(e){return json(res,503,{error:'class authorization unavailable'});}
      }
      if(p === '/api/ask'){ const out = await askCore(body, process.env, clientIp(req)); return json(res, out.status, out.json); }
      if(p === '/api/tts'){ const out = await ttsCore(body, { token: gcsToken, ip: clientIp(req) }); return json(res, out.status, out.json); }
      return json(res, 404, { error: 'not found' });
    }
    if((req.method === 'GET' || req.method === 'HEAD') && await serveFile(req, res, p)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }catch(e){
    if(!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'server error' });
  }
}

/* `npm run dev` runs this same server on the laptop (--local): the app and
   its /api endpoints on one origin, like Cloud Run. The Gemini key is read
   from voice/.env into this process only — never printed, never served
   (the whitelist above never serves voice/). Cloud Run sets K_SERVICE and
   gets its key from Secret Manager instead. */
async function loadLocalEnv(){
  try{
    const txt = await readFile(path.join(ROOT, 'voice', '.env'), 'utf8');
    for(const line of txt.split(/\r?\n/)){
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if(m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }catch(e){ /* no voice/.env: the app still runs, Tier 2 answers 503 and questions wait in the queue */ }
}

if(process.argv[1] === fileURLToPath(import.meta.url)){
  const args = process.argv.slice(2);
  const local = args.includes('--local');
  if(local && !process.env.K_SERVICE) await loadLocalEnv();
  const pi = args.indexOf('--port');
  const port = Number((pi >= 0 && args[pi + 1]) || process.env.PORT || 8080);
  // on the laptop, only this machine (and adb port forwarding) can reach it
  const host = local ? '127.0.0.1' : undefined;
  http.createServer(handle).listen(port, host, () => console.log(`[takhti] on ${local ? 'http://localhost:' + port : ':' + port} · Gemini ${(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'set' : 'not set'} · sync ${process.env.TAKHTI_SYNC_BUCKET || 'off'}`));
}
