#!/usr/bin/env node
/* ==================================================================
   TAKHTI VOICE SERVER — run with: node voice/server.js

   No framework and no dependencies, like the rest of the repo. Three
   audiences, three kinds of auth:

   Bolna (during a call)   POST /voice/tools/next        Bearer TAKHTI_TOOL_TOKEN
                           POST /voice/tools/answer
   Bolna (after a call)    POST /voice/webhook?key=TAKHTI_WEBHOOK_KEY
   Families                GET  /voice/card/:session     unguessable link
                           GET  /voice/report/:session   unguessable link
   The team                GET  /voice/admin?key=TAKHTI_ADMIN_KEY  (+ JSON API)

   Bolna has to reach this server over HTTPS. Locally, put a tunnel in
   front of it (cloudflared or ngrok) — see voice/README.md.
   ================================================================== */
'use strict';
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createBrain } = require('./brain');
const P = require('./pages');

/* tiny .env loader so `node voice/server.js` just works */
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

function secret(name) {
  if (process.env[name]) return process.env[name];
  const v = crypto.randomBytes(18).toString('base64url');
  process.env[name] = v;
  console.log(`[takhti] ${name} not set — using a one-off value for this run: ${v}`);
  return v;
}

function createServer(opts) {
  opts = opts || {};
  const brain = opts.brain || createBrain({ dataDir: process.env.TAKHTI_DATA_DIR });
  const TOOL = opts.toolToken || secret('TAKHTI_TOOL_TOKEN');
  const HOOK = opts.webhookKey || secret('TAKHTI_WEBHOOK_KEY');
  const ADMIN = opts.adminKey || secret('TAKHTI_ADMIN_KEY');
  const env = opts.env || process.env;
  const base = () => (env.TAKHTI_PUBLIC_URL || '').replace(/\/$/, '');

  const same = (a, b) => {
    const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const bearer = req => (String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i) || [])[1];

  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const type = String(req.headers['content-type'] || '');
        if (!raw) return resolve({});
        try {
          if (type.includes('application/x-www-form-urlencoded')) return resolve(Object.fromEntries(new URLSearchParams(raw)));
          resolve(JSON.parse(raw));
        } catch (e) { reject(Object.assign(new Error('bad body'), { status: 400 })); }
      });
      req.on('error', reject);
    });
  }
  const send = (res, status, body, type) => {
    const isStr = typeof body === 'string';
    res.writeHead(status, {
      'Content-Type': type || (isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    });
    res.end(isStr ? body : JSON.stringify(body));
  };
  const redirect = (res, to) => { res.writeHead(303, { Location: to }); res.end(); };

  /* Bolna substitutes %(session_id)s from the call's user_data; if that
     ever fails we would receive the literal placeholder. */
  const sid = v => { const s = String(v || '').trim(); return /^[A-Za-z0-9_-]{8,80}$/.test(s) ? s : null; };

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const m = (re) => p.match(re);
    try {
      if (p === '/voice/health') return send(res, 200, { ok: true, stories: brain.storyBank.length });

      /* ---- the two tools the voice agent may call ---- */
      if (req.method === 'POST' && (p === '/voice/tools/next' || p === '/voice/tools/answer')) {
        if (!same(bearer(req), TOOL)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 64 * 1024);
        const id = sid(b.session_id);
        const out = p.endsWith('next') ? brain.toolNext(id) : brain.toolAnswer(id, b.child_said);
        if (out.error) console.warn('[takhti] tool call for unknown session', JSON.stringify(b.session_id));
        // the model only needs these four fields; less text = less to misread
        return send(res, 200, { say: out.say, expect: out.expect, done: out.done, item: out.item });
      }

      /* ---- Bolna's post-call webhook ---- */
      if (req.method === 'POST' && p === '/voice/webhook') {
        if (!same(url.searchParams.get('key'), HOOK)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 4 * 1024 * 1024);
        const r = brain.onCallEvent(b);
        return send(res, 200, r);
      }

      /* ---- family pages: the link is the key ---- */
      let mm;
      if (req.method === 'GET' && (mm = m(/^\/voice\/(card|report)\/([A-Za-z0-9_-]{8,80})$/))) {
        const s = brain.getSession(mm[2]);
        const child = s && brain.getChild(s.child_id);
        if (!s || !child) return send(res, 404, '<!doctype html><p>Not found</p>');
        return send(res, 200, mm[1] === 'card' ? P.cardPage(s, child) : P.reportPage(s, child));
      }

      /* ---- the team: dashboard and JSON API ---- */
      if (p.startsWith('/voice/admin')) {
        const key = url.searchParams.get('key') || bearer(req);
        if (!same(key, ADMIN)) return send(res, 401, { error: 'unauthorized' });
        const wantsHtml = String(req.headers.accept || '').includes('text/html');
        const q = 'key=' + encodeURIComponent(key);

        if (req.method === 'GET' && p === '/voice/admin') return send(res, 200, P.dashboardPage(brain, key));
        if (req.method === 'GET' && p === '/voice/admin/children') return send(res, 200, brain.listChildren());

        if (req.method === 'POST' && p === '/voice/admin/children') {
          const b = await readBody(req, 64 * 1024);
          const r = brain.registerChild({
            name: b.name, age: Number(b.age), lang: b.lang, parent_phone: b.parent_phone,
            consent: b.consent === true || b.consent === 'yes', consent_by: b.consent_by
          });
          if (r.error) return send(res, 400, wantsHtml ? `<!doctype html><p>${P.esc(r.error.join('; '))}</p><p><a href="/voice/admin?${q}">back</a></p>` : { error: r.error });
          return wantsHtml ? redirect(res, `/voice/admin?${q}`) : send(res, 201, { child: publicChild(r.child) });
        }
        if (req.method === 'POST' && (mm = m(/^\/voice\/admin\/children\/([A-Za-z0-9_-]+)\/homework$/))) {
          const b = await readBody(req, 64 * 1024);
          const r = brain.importHomeworkCode(mm[1], b.code);
          if (wantsHtml) return r.ok ? redirect(res, `/voice/admin?${q}`)
            : send(res, 400, `<!doctype html><p>That homework code was not accepted (${P.esc(r.why)}).</p><p><a href="/voice/admin?${q}">back</a></p>`);
          return send(res, r.ok ? 200 : 400, r);
        }
        if (req.method === 'GET' && (mm = m(/^\/voice\/admin\/children\/([A-Za-z0-9_-]+)\/progress-code$/))) {
          const code = brain.progressCode(mm[1]);
          return send(res, code ? 200 : 404, code ? { code } : { error: 'child not linked to a class yet — import a homework code first' });
        }
        if (req.method === 'DELETE' && (mm = m(/^\/voice\/admin\/children\/([A-Za-z0-9_-]+)$/))) {
          return send(res, brain.deleteChild(mm[1]) ? 200 : 404, { deleted: mm[1] });
        }
        if (req.method === 'POST' && p === '/voice/admin/sessions') {
          const b = await readBody(req, 64 * 1024);
          const r = brain.createSession(b.child_id, { seed: b.seed });
          if (r.error) return send(res, 400, { error: r.error });
          const links = sessionLinks(r.session);
          let call = null;
          if (b.call === true || b.call === 'yes') call = await brain.placeCall(r.session.id, env);
          if (wantsHtml) return redirect(res, `/voice/admin/sessions/${r.session.id}?${q}`);
          return send(res, 201, { session: { id: r.session.id, band: r.session.band, lines: r.session.lines, slots: r.session.slots }, links, call });
        }
        if ((mm = m(/^\/voice\/admin\/sessions\/([A-Za-z0-9_-]+)(\/call)?$/))) {
          const s = brain.getSession(mm[1]);
          if (!s) return send(res, 404, { error: 'no such session' });
          if (req.method === 'POST' && mm[2]) {
            const r = await brain.placeCall(s.id, env);
            if (wantsHtml) return r.error ? send(res, 400, `<!doctype html><p>${P.esc(r.error)}</p><pre>${P.esc(JSON.stringify(r.detail || {}, null, 1))}</pre><p><a href="/voice/admin/sessions/${s.id}?${q}">back</a></p>`)
                                          : redirect(res, `/voice/admin/sessions/${s.id}?${q}`);
            return send(res, r.error ? 400 : 200, r);
          }
          if (req.method === 'GET') {
            const child = brain.getChild(s.child_id);
            return wantsHtml ? send(res, 200, P.sessionAdminPage(s, child, key)) : send(res, 200, { session: s, links: sessionLinks(s) });
          }
        }
        return send(res, 404, { error: 'not found' });
      }

      if (p === '/' || p === '/voice') return send(res, 200, '<!doctype html><p>Takhti voice server. The team dashboard is at /voice/admin?key=…</p>');
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error('[takhti]', e);
      return send(res, status, { error: status === 500 ? 'server error' : e.message });
    }
  }

  function sessionLinks(s) {
    const b = base();
    return { card: `${b}/voice/card/${s.id}`, report: `${b}/voice/report/${s.id}` };
  }
  function publicChild(c) { const { profile, ...rest } = c; return rest; }

  const server = http.createServer(handle);
  return { server, brain, tokens: { TOOL, HOOK, ADMIN } };
}

if (require.main === module) {
  const { server, brain } = createServer();
  const port = Number(process.env.PORT || 8787);
  server.listen(port, () => {
    console.log(`[takhti] voice server on http://localhost:${port}  ·  ${brain.storyBank.length} validated story problems`);
    console.log(`[takhti] dashboard: http://localhost:${port}/voice/admin?key=${process.env.TAKHTI_ADMIN_KEY}`);
    if (!process.env.TAKHTI_PUBLIC_URL) console.log('[takhti] set TAKHTI_PUBLIC_URL to your tunnel URL so card links work outside this machine');
  });
}

module.exports = { createServer };
