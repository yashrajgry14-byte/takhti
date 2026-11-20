/* ==================================================================
   Tier 2 proxy for the question queue ("Ask me") — keeps the key on
   the server.

   Gemini first (GEMINI_API_KEY or GOOGLE_API_KEY), the same key the rest
   of Tier 2 uses. ANTHROPIC_API_KEY still works if it is the only key set.
   The reply keeps the shape the app already reads:
     { content: [{ type: 'text', text: '<the JSON answer>' }], model }

   Runs on Cloud Run (cloud/server.mjs → askCore), Netlify (Request in,
   Response out) and Vercel (req, res). If no key is set it is a 503,
   and the app queues the question — nothing is invented.
   ================================================================== */

import { classProfile, classText } from './lib/class-profile.mjs';

const MAX_BODY = 16 * 1024;
const MAX_PROMPT = 4000;

/* a small per-address limit: a child's questions, not a script's */
const hits = new Map();
function rateOk(ip, env){
  const max = Number((env || {}).TAKHTI_ASK_PER_10MIN || 40), now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if(list.length >= max){ hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list);
  if(hits.size > 5000) hits.clear();
  return true;
}

/* the models to ask, in turn: the team's default first, then flash-lite,
   which has answered on every live run (TAKHTI_ASK_FALLBACK='none' turns it off) */
export function askModels(env){
  env = env || {};
  const first = env.TAKHTI_ASK_MODEL || env.GEMINI_MODEL || 'gemini-4-hydrogen';
  const fb = String(env.TAKHTI_ASK_FALLBACK == null ? 'gemini-3.5-flash-lite' : env.TAKHTI_ASK_FALLBACK);
  const rest = fb.toLowerCase() === 'none' ? [] : fb.split(',').map(x => x.trim()).filter(Boolean);
  return [first, ...rest].filter((m, i, a) => a.indexOf(m) === i).slice(0, 3);
}

function promptFrom(body){
  const msgs = Array.isArray(body && body.messages) ? body.messages : [];
  const last = [...msgs].reverse().find(m => m && m.role === 'user');
  if(!last) return '';
  const c = last.content;
  const text = typeof c === 'string' ? c
    : Array.isArray(c) ? c.map(p => (p && typeof p.text === 'string') ? p.text : '').join('\n') : '';
  return text.trim().slice(0, MAX_PROMPT);
}

async function askGemini(prompt, env, fetchImpl){
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  const base = {
    systemInstruction: { parts: [{ text: 'You answer questions from young children in India for a learning app. Be factual, warm, simple and age-appropriate. Reply with JSON only, exactly in the shape asked for.' }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  };
  // low thinking first (an answer inside the app's patience), then without
  // the field for a model that refuses it (a 400)
  const shapes = [
    { generationConfig: { temperature: 0.4, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' } } },
    { generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } }
  ];
  const models = askModels(env), total = Number(env.TAKHTI_ASK_TIMEOUT_MS || 20000);
  const firstMs = Number(env.TAKHTI_ASK_FIRST_MS || 8000), start = Date.now();
  let last = { status: 504, error: 'Gemini did not answer in time' };
  for(let mi = 0; mi < models.length; mi++){
    const model = models[mi], left = total - (Date.now() - start);
    if(left < 800) break;
    const budget = mi < models.length - 1 ? Math.min(firstMs, left) : left;
    const url = `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), budget);
    try{
      let res, d;
      for(const shape of shapes){
        res = await fetchImpl(url, { method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ ...base, ...shape }) });
        d = await res.json().catch(() => ({}));
        if(res.status !== 400) break;
      }
      if(!res.ok){ last = { status: 502, error: `Gemini said ${res.status}` }; continue; }
      const text = ((((d.candidates || [])[0] || {}).content || {}).parts || [])
        .filter(p => !p.thought).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
      if(!text){ last = { status: 502, error: 'Gemini sent an empty answer' }; continue; }
      return { text, model };
    }catch(e){
      last = { status: 504, error: 'Gemini did not answer in time' };
    }finally{ clearTimeout(to); }
  }
  return last;
}

async function askAnthropic(prompt, env, fetchImpl){
  try{
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.TAKHTI_MODEL || 'claude-sonnet-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await res.json().catch(() => ({}));
    if(!res.ok) return { status: 502, error: `the model said ${res.status}` };
    const text = (d.content || []).filter(x => x.type === 'text').map(x => x.text).join('');
    return text ? { text, model: d.model } : { status: 502, error: 'an empty answer' };
  }catch(e){ return { status: 502, error: 'Upstream unavailable' }; }
}

/* The whole request, independent of any host — exported for cloud/server.mjs and the tests. */
export async function askCore(body, env, ip, fetchImpl){
  env = env || {}; fetchImpl = fetchImpl || fetch;
  const gemini = !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
  if(!gemini && !env.ANTHROPIC_API_KEY) return { status: 503, json: { error: 'No key configured' } };
  const asked = promptFrom(body);
  if(!asked) return { status: 400, json: { error: 'no question' } };
  // the class, from this server's own table (lib/class-profile.mjs): the answer is pitched at it
  const prof = classProfile(body && body.cls);
  const prompt = prof ? `${classText(prof)}\n${asked}` : asked;
  if(!rateOk(ip || '?', env)) return { status: 429, json: { error: 'enough for now — try again in a while' } };
  const r = gemini ? await askGemini(prompt, env, fetchImpl) : await askAnthropic(prompt, env, fetchImpl);
  if(r.error) return { status: r.status || 502, json: { error: r.error } };
  return { status: 200, json: { content: [{ type: 'text', text: r.text }], model: r.model } };
}

/* Netlify passes (Request, context); Vercel passes (req, res). */
export default async function handler(req, res){
  const vercel = res && typeof res.status === 'function';
  const reply = (status, json) => vercel
    ? res.status(status).json(json)
    : new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  if(req.method !== 'POST') return reply(405, { error: 'POST only' });
  let body;
  try{
    if(vercel) body = req.body;
    else {
      const text = await req.text();
      if(text.length > MAX_BODY) return reply(413, { error: 'too large' });
      body = JSON.parse(text);
    }
  }catch(e){ return reply(400, { error: 'bad JSON' }); }
  const ip = vercel ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                    : String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const out = await askCore(body, process.env, ip);
  return reply(out.status, out.json);
}

export const config = { maxDuration: 26 };
