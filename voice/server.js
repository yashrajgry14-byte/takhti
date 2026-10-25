#!/usr/bin/env node
/* ==================================================================
   TAKHTI VOICE SERVER — run with: node voice/server.js

   No framework and no dependencies, like the rest of the repo. Three
   audiences, three kinds of auth:

   Bolna (during a call)   POST /voice/tools/next        Bearer TAKHTI_TOOL_TOKEN
                           POST /voice/tools/answer
                           POST /voice/tools/parent      (parent calls)
   Bolna Workflows         POST /voice/flow/*            Bearer TAKHTI_TOOL_TOKEN
   Bolna (after a call)    POST /voice/webhook?key=TAKHTI_WEBHOOK_KEY
   Families                GET  /voice/card/:session     unguessable link
                           GET  /voice/report/:session   unguessable link
   The team                GET  /voice/admin?key=TAKHTI_ADMIN_KEY  (+ JSON API)
   A school                GET  /voice/admin?key=<that school's key> — its own records only

   Bolna has to reach this server over HTTPS. Locally, put a tunnel in
   front of it (cloudflared or ngrok) — see voice/README.md.
   ================================================================== */
'use strict';
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createBrain } = require('./brain');
const { createWeb } = require('./web');
const { createFlow } = require('./flow');
const { createScheduler } = require('./schedule');
const { buildCorpus, corpusCsv } = require('./corpus');
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
  const web = createWeb(brain, env);
  const flow = createFlow(brain, env);
  const scheduler = createScheduler(brain, env);
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

      /* ---- Talking Munni in the app (CORS: the app may live on another origin) ---- */
      if (p.startsWith('/voice/web/')) {
        res.setHeader('Access-Control-Allow-Origin', env.TAKHTI_APP_ORIGIN || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
        const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        let r;
        if (req.method === 'POST' && p === '/voice/web/session') r = await web.startSession(await readBody(req, 16 * 1024), ip);
        else if (req.method === 'GET' && p === '/voice/web/state') r = web.state(url.searchParams.get('session'), url.searchParams.get('token'));
        else if (req.method === 'POST' && p === '/voice/web/tap') { const b = await readBody(req, 4 * 1024); r = await web.tap(b.session, b.token, b.choice); }
        else if (req.method === 'GET' && p === '/voice/web/result') r = web.result(url.searchParams.get('session'), url.searchParams.get('token'));
        else if (req.method === 'POST' && p === '/voice/web/forget') { const b = await readBody(req, 4 * 1024); r = web.forget(b.child_id, b.key); }
        else r = { status: 404, body: { error: 'not found' } };
        return send(res, r.status, r.body);
      }

      /* ---- the two tools the voice agent may call ---- */
      if (req.method === 'POST' && (p === '/voice/tools/next' || p === '/voice/tools/answer')) {
        if (!same(bearer(req), TOOL)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 64 * 1024);
        const id = sid(b.session_id);
        const out = p.endsWith('next') ? brain.toolNext(id, b.caller_name) : brain.toolAnswer(id, b.child_said);
        if (out.error) console.warn('[takhti] tool call for unknown session', JSON.stringify(b.session_id));
        // the model only needs these four fields; less text = less to misread
        return send(res, 200, { say: out.say, expect: out.expect, done: out.done, item: out.item });
      }

      /* ---- a teacher's voice note (the child agent's teacher node) ---- */
      if (req.method === 'POST' && p === '/voice/tools/note') {
        if (!same(bearer(req), TOOL)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 64 * 1024);
        const out = brain.toolNote(sid(b.session_id), b.teacher_said);
        return send(res, 200, { say: out.say, done: out.done });
      }

      /* ---- the parent agent's one tool ---- */
      if (req.method === 'POST' && p === '/voice/tools/parent') {
        if (!same(bearer(req), TOOL)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 64 * 1024);
        const out = brain.toolParent(sid(b.session_id), b.parent_said, env);
        return send(res, 200, { say: out.say, done: out.done });
      }

      /* ---- Bolna Workflows: the daily sequence and the consent call ---- */
      if (req.method === 'POST' && p.startsWith('/voice/flow/')) {
        if (!same(bearer(req), TOOL)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 16 * 1024);
        const fn = { '/voice/flow/plan': flow.plan, '/voice/flow/gate': flow.gate, '/voice/flow/result': flow.result,
                     '/voice/flow/missed': flow.missed, '/voice/flow/consent/plan': flow.consentPlan,
                     '/voice/flow/consent/result': flow.consentResult }[p];
        if (!fn) return send(res, 404, { error: 'not found' });
        return send(res, 200, fn(b));
      }

      /* ---- Bolna's caller lookup for the inbound line (GET, Bearer, < 3 s) ---- */
      if (req.method === 'GET' && p === '/voice/inbound/lookup') {
        if (!same(bearer(req), TOOL)) return send(res, 401, { error: 'unauthorized' });
        const q = Object.fromEntries(url.searchParams);
        return send(res, 200, brain.inboundLookup(q, env));
      }

      /* ---- Bolna's post-call webhook ---- */
      if (req.method === 'POST' && p === '/voice/webhook') {
        if (!same(url.searchParams.get('key'), HOOK)) return send(res, 401, { error: 'unauthorized' });
        const b = await readBody(req, 4 * 1024 * 1024);
        const r = brain.onCallEvent(b, env);
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
        // the server's own key sees everything; a school's key sees only its school
        let scope = null;
        if (same(key, ADMIN)) scope = { super: true, school: null };
        else { const sc = brain.schoolByKey(key); if (sc) scope = { super: false, school: sc }; }
        if (!scope) return send(res, 401, { error: 'unauthorized' });
        const wantsHtml = String(req.headers.accept || '').includes('text/html');
        const q = 'key=' + encodeURIComponent(key);
        const owns = c => !!c && (scope.super || c.school_id === scope.school.id);
        const view = scopedView(scope);

        // anything addressed by id must belong to this school: 404, not 403,
        // so one school can't even learn another school's ids exist
        const idm = p.match(/^\/voice\/admin\/(children|sessions|parentcalls|teachercalls)\/([A-Za-z0-9_-]+)/);
        if (idm) {
          const rec = idm[1] === 'children' ? brain.getChild(idm[2]) : idm[1] === 'sessions' ? brain.getSession(idm[2])
            : idm[1] === 'parentcalls' ? brain.getParentCall(idm[2]) : brain.getTeacherCall(idm[2]);
          const child = idm[1] === 'children' ? rec : rec && brain.getChild(rec.child_id);
          const ok = idm[1] === 'teachercalls' ? rec && (scope.super || rec.school_id === scope.school.id) : owns(child);
          if (!ok) return send(res, 404, { error: 'not found' });
        }

        if (req.method === 'GET' && p === '/voice/admin') return send(res, 200, P.dashboardPage(view, key, scope));
        if (req.method === 'GET' && p === '/voice/admin/children') return send(res, 200, view.listChildren().map(publicChild));

        /* ---- teachers, classes, the misreading corpus ---- */
        if (req.method === 'GET' && p === '/voice/admin/teachers') return send(res, 200, view.listTeachers());
        if (req.method === 'POST' && p === '/voice/admin/teachers') {
          const b = await readBody(req, 16 * 1024);
          const r = brain.registerTeacher({ name: b.name, phone: b.phone, lang: b.lang,
            class_codes: String(b.class_codes || b.class_code || '').split(/[\s,]+/).filter(Boolean),
            school_id: scope.super ? (b.school_id || null) : scope.school.id });
          if (wantsHtml) return r.error ? send(res, 400, `<!doctype html><p>${P.esc(r.error.join('; '))}</p><p><a href="/voice/admin?${q}">back</a></p>`) : redirect(res, `/voice/admin?${q}`);
          return send(res, r.error ? 400 : 201, r);
        }
        if (req.method === 'GET' && (mm = m(/^\/voice\/admin\/teachercalls\/([A-Za-z0-9_-]+)$/))) {
          const c = brain.getTeacherCall(mm[1]);
          return wantsHtml ? send(res, 200, P.teacherCallPage(c, brain.getTeacher(c.teacher_id), key)) : send(res, 200, c);
        }
        if ((mm = m(/^\/voice\/admin\/classes\/([A-Za-z0-9_-]{2,40})(\/parent-calls)?$/))) {
          const sch = scope.school && scope.school.id;
          if (req.method === 'GET' && !mm[2]) return send(res, 200, brain.classSummary(mm[1], sch, scope.super));
          if (req.method === 'POST' && mm[2]) {
            const b = await readBody(req, 8 * 1024);
            const r = await brain.classParentCalls(mm[1], { skill: b.skill || null, note: b.note || '', teacher: b.teacher || '' }, env, scope);
            if (wantsHtml) return r.error ? send(res, 400, `<!doctype html><p>${P.esc(r.error)}</p><p><a href="/voice/admin?${q}">back</a></p>`)
              : send(res, 200, P.classCallsPage(r, mm[1], key));
            return send(res, r.error ? 400 : 200, r);
          }
        }
        if (req.method === 'GET' && (p === '/voice/admin/corpus' || p === '/voice/admin/corpus.csv')) {
          const c = buildCorpus(view, env);
          if (p.endsWith('.csv')) return send(res, 200, corpusCsv(c), 'text/csv; charset=utf-8');
          return send(res, 200, c);
        }

        /* ---- schools (the server's own key only) ---- */
        if (p === '/voice/admin/schools' || p.startsWith('/voice/admin/schools/')) {
          if (!scope.super) return send(res, 404, { error: 'not found' });
          if (req.method === 'GET' && p === '/voice/admin/schools') return send(res, 200, brain.listSchools().map(brain.publicSchool));
          if (req.method === 'POST' && p === '/voice/admin/schools') {
            const b = await readBody(req, 16 * 1024);
            const r = brain.createSchool({ name: b.name, contact: b.contact, bolna: b.bolna || pick(b, ['api_key', 'agent_id', 'parent_agent_id', 'from_number', 'daily_workflow_id', 'consent_workflow_id']) });
            if (r.error) return send(res, 400, { error: r.error });
            if (wantsHtml) return send(res, 201, P.schoolCreatedPage(r, key));
            return send(res, 201, r);
          }
          if (req.method === 'POST' && (mm = m(/^\/voice\/admin\/schools\/([A-Za-z0-9_-]+)$/))) {
            const b = await readBody(req, 16 * 1024);
            const r = brain.updateSchool(mm[1], { name: b.name, contact: b.contact, bolna: b.bolna || pick(b, ['api_key', 'agent_id', 'parent_agent_id', 'from_number', 'daily_workflow_id', 'consent_workflow_id']) });
            return send(res, r.error ? 400 : 200, r);
          }
          return send(res, 404, { error: 'not found' });
        }

        if (req.method === 'POST' && p === '/voice/admin/children') {
          const b = await readBody(req, 64 * 1024);
          const r = brain.registerChild({
            school_id: scope.super ? (b.school_id || null) : scope.school.id,
            consent_recording: b.consent_recording === false || b.consent_recording === 'no' ? false : undefined,
            consent_research: b.consent_research === true || b.consent_research === 'yes',
            placement: b.placement === true || b.placement === 'yes',
            name: b.name, age: Number(b.age), lang: b.lang, parent_lang: b.parent_lang, parent_phone: b.parent_phone,
            consent: b.consent === true || b.consent === 'yes' ? true : b.consent === 'call' ? 'call' : false, consent_by: b.consent_by
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
        if (req.method === 'POST' && (mm = m(/^\/voice\/admin\/children\/([A-Za-z0-9_-]+)\/english$/))) {
          const b = await readBody(req, 4 * 1024);
          const r = brain.setEnglishPractice(mm[1], b.on === true || b.on === 'yes');
          if (wantsHtml) return redirect(res, `/voice/admin?${q}`);
          return send(res, r ? 200 : 404, r || { error: 'no such child' });
        }
        if (req.method === 'POST' && (mm = m(/^\/voice\/admin\/children\/([A-Za-z0-9_-]+)\/(consent-call|weekly-call|consent-confirm|schedule)$/))) {
          const b = await readBody(req, 8 * 1024);
          let r;
          if (mm[2] === 'consent-call') r = await brain.requestConsentCall(mm[1], env);
          else if (mm[2] === 'weekly-call') r = await brain.placeParentCall(mm[1], 'weekly', env);
          else if (mm[2] === 'consent-confirm') r = brain.confirmConsent(mm[1], b.by || 'team');
          else r = brain.setSchedule(mm[1], { time: b.time, days: Array.isArray(b.days) ? b.days : b.days, enabled: b.enabled,
                                               weekly: b.weekly, by: b.by || 'team' });
          const bad = r && (r.error || r.ok === false);
          if (wantsHtml) return bad ? send(res, 400, `<!doctype html><p>${P.esc([].concat(r.error || r.why).join('; '))}</p><pre>${P.esc(JSON.stringify(r.detail || {}, null, 1))}</pre><p><a href="/voice/admin?${q}">back</a></p>`)
                                    : redirect(res, `/voice/admin?${q}`);
          return send(res, bad ? 400 : 200, r);
        }
        if (req.method === 'GET' && (mm = m(/^\/voice\/admin\/parentcalls\/([A-Za-z0-9_-]+)$/))) {
          const s = brain.getParentCall(mm[1]);
          if (!s) return send(res, 404, { error: 'no such call' });
          const child = brain.getChild(s.child_id);
          return wantsHtml ? send(res, 200, P.parentCallPage(s, child, key)) : send(res, 200, s);
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
          const kid = brain.getChild(b.child_id);
          if (!owns(kid)) return send(res, 404, { error: 'no such child' });
          const kind = ['english', 'lesson', 'placement'].includes(b.kind) ? b.kind : (kid ? brain.nextKind(kid) : 'lesson');
          const r = brain.createSession(b.child_id, { seed: b.seed, kind });
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
  function publicChild(c) { const { profile, app_key, ...rest } = c; return rest; }
  const pick = (o, ks) => Object.fromEntries(ks.filter(k => o[k] != null && o[k] !== '').map(k => [k, o[k]]));
  /* what one admin key may see: everything, or one school's records */
  function scopedView(scope) {
    if (scope.super) return Object.assign(Object.create(brain), { listSchools: brain.listSchools, scope });
    const id = scope.school.id;
    const kids = () => brain.listChildren().filter(c => c.school_id === id);
    const ids = () => new Set(kids().map(c => c.id));
    return Object.assign(Object.create(brain), {
      scope,
      listChildren: kids,
      listSessions: () => { const k = ids(); return brain.listSessions().filter(s => k.has(s.child_id)); },
      listParentCalls: () => { const k = ids(); return brain.listParentCalls().filter(s => k.has(s.child_id)); },
      listTeachers: () => brain.listTeachers().filter(t => t.school_id === id),
      listTeacherCalls: () => brain.listTeacherCalls().filter(t => t.school_id === id),
      listSchools: () => [scope.school]
    });
  }

  const server = http.createServer(handle);
  return { server, brain, scheduler, flow, tokens: { TOOL, HOOK, ADMIN } };
}

if (require.main === module) {
  const { server, brain, scheduler } = createServer();
  const port = Number(process.env.PORT || 8787);
  // the daily lessons and weekly parent calls, at the times parents chose
  if (process.env.TAKHTI_SCHEDULER !== '0') scheduler.start();
  server.listen(port, () => {
    console.log(`[takhti] voice server on http://localhost:${port}  ·  ${brain.storyBank.length} validated story problems`);
    console.log(`[takhti] dashboard: http://localhost:${port}/voice/admin?key=${process.env.TAKHTI_ADMIN_KEY}`);
    if (!process.env.TAKHTI_PUBLIC_URL) console.log('[takhti] set TAKHTI_PUBLIC_URL to your tunnel URL so card links work outside this machine');
  });
}

module.exports = { createServer };
