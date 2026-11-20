/* ==================================================================
   CLASS SYNC — Tier 2. One small record per class code, so a teacher's
   phone and every consenting child's phone see the same class.

   POST { code, children:{ id:{childName, skillHistory, explained?, paths?, at} }, homework, lessons, roster, teacherKey }
   → merges what the phone sent into the stored class (newest wins, per
   child and for the homework) and answers with what that phone may see.

   Who sees what — the class code alone is not enough to read a class:
     · the TEACHER's phone holds a random teacherKey that never leaves it
       (the server keeps only its SHA-256). The first teacher phone to
       sync a class claims it. Only that key gets every child in the
       class back, and only that key can set or withdraw homework.
     · a CHILD's phone gets back only the homework and its own record —
       never its classmates'.
     · a wrong teacherKey for a claimed class is refused (403).

   Only what the teacher's diagnostic needs is accepted — a name and
   practice counts per skill, plus the homework — everything is
   type-checked and size-capped, and anything else in the request is
   dropped. A child's data only arrives here if a parent switched sync on
   for that child (src/core/class-sync.js). The class code is the only
   key, so treat it like a shared password: the app never shows a class's
   data to anyone without it.

   Storage: Netlify Blobs (store "takhti-classes"). Without a blob store
   (a host other than Netlify, or local dev) it answers 503, and the app
   keeps working exactly as before — sync is a bonus, never a dependency.
   Works as a Netlify function (Request → Response) and with the
   Vercel-style (req, res) signature api/ask.js uses.
   ================================================================== */

const CODE = /^[A-Z0-9]{6}$/;
const SKILL = /^[a-z0-9-]{1,24}$/;
const MAX_CHILDREN = 60, MAX_SKILLS = 200, MAX_BODY = 160 * 1024, MAX_LESSONS = 12, MAX_LESSON_JSON = 96 * 1024;

const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

function cleanChild(c){
  if(!c || typeof c !== 'object') return null;
  const skillHistory = {};
  for(const [id, h] of Object.entries(c.skillHistory || {}).slice(0, MAX_SKILLS)){
    if(!SKILL.test(id) || !h) continue;
    const n = int(h.n, 1e6);
    skillHistory[id] = { n, right: Math.min(n, int(h.right, 1e6)) };
  }
  // Teach Appu: which lesson points the child explained (c/p/g), ids only
  const explained = {};
  for(const [id, v] of Object.entries(c.explained && typeof c.explained === 'object' ? c.explained : {}).slice(0, 60))
    if(/^[a-z0-9.-]{1,32}$/.test(id) && ['c', 'p', 'g'].includes(v)) explained[id] = v;
  // can the child DO each point (y/n from their first answers) — letters only
  const did = {};
  for(const [id, v] of Object.entries(c.did && typeof c.did === 'object' ? c.did : {}).slice(0, 60))
    if(/^[a-z0-9.-]{1,32}$/.test(id) && (v === 'y' || v === 'n')) did[id] = v;
  // and each point's loop: first try, taught again, now — letters only (core/teachback.js)
  const loop = {};
  for(const [id, v] of Object.entries(c.loop && typeof c.loop === 'object' ? c.loop : {}).slice(0, 60))
    if(/^[a-z0-9.-]{1,32}$/.test(id) && /^(?:[cpg]|[pg]r|[pg]r?[cpg])$/.test(String(v))) loop[id] = v;
  // the child's path through each school lesson (core/planner.js): short codes only
  const paths = {};
  for(const [id, p] of Object.entries(c.paths && typeof c.paths === 'object' ? c.paths : {}).slice(0, MAX_LESSONS)){
    if(!/^sch-[a-z0-9]{1,24}$/.test(id) || !p || typeof p !== 'object') continue;
    const w = ['', 'show', 'story', 'cartoon', 'model', 'chunks', 'solo'].includes(p.w) ? p.w : '';
    const n = int(p.n, 6);
    paths[id] = { w, ...(p.k ? { k: 1 } : {}), ...(SKILL.test(p.g || '') ? { g: p.g } : {}), d: Math.min(n, int(p.d, 6)), n };
  }
  return { childName: String(c.childName || '?').slice(0, 40), skillHistory, ...(Object.keys(explained).length ? { explained } : {}), ...(Object.keys(loop).length ? { loop } : {}), ...(Object.keys(did).length ? { did } : {}),
    ...(Object.keys(paths).length ? { paths } : {}), at: int(c.at, 9e15) };
}
function cleanHomework(h){
  if(!h || typeof h !== 'object') return null;
  const skills = (Array.isArray(h.skills) ? h.skills : []).filter(s => SKILL.test(s)).slice(0, 10);
  return { skills, note: String(h.note || '').slice(0, 140), assignedAt: int(h.assignedAt, 9e15), cleared: !!h.cleared };
}

/* The school's own lessons (src/core/syllabus.js): the teacher approved
   them, and every child's phone checks them again with the app's lesson
   checker before showing one — so here they are only shape- and
   size-checked, never trusted. */
function cleanLessons(l){
  if(!l || typeof l !== 'object' || !Array.isArray(l.items)) return null;
  const items = l.items.slice(0, MAX_LESSONS).filter(x => x && typeof x === 'object' && /^sch-[a-z0-9]{1,16}$/.test(String(x.id))
    && Array.isArray(x.beats) && x.beats.length <= 12);
  if(JSON.stringify(items).length > MAX_LESSON_JSON) return null;
  return { items, at: int(l.at, 9e15) };
}

/* The school's roster (src/core/class-sync.js): the class's grade and, for
   a few children, their own — class ids only, from a fixed list. */
const CLS = /^(nur|lkg|ukg|c([1-9]|10))$/;
function cleanRoster(r){
  if(!r || typeof r !== 'object') return null;
  const kids = {};
  for(const [id, k] of Object.entries(r.kids && typeof r.kids === 'object' ? r.kids : {}).slice(0, MAX_CHILDREN))
    if(typeof id === 'string' && id && id.length <= 40 && !id.startsWith('_') && CLS.test(String(k))) kids[id] = String(k);
  return { cls: CLS.test(String(r.cls)) ? String(r.cls) : null, kids, at: int(r.at, 9e15) };
}
/* A child's phone sees the class's grade and its own children's entries — never a classmate's. */
const rosterFor = (r, ids) => r ? { cls: r.cls, kids: pick(r.kids || {}, ids), at: r.at } : null;

/* The merge itself, independent of any host — exported for the tests. */
export async function syncCore(store, body){
  const code = String(body && body.code || '').toUpperCase();
  if(!CODE.test(code)) return { status:400, json:{ error:'bad class code' } };
  const key = 'class-' + code;
  const cur = (await store.get(key, { type:'json' })) || { children:{}, homework:null, teacherKeyHash:null };

  let teacher = false;
  if(body.teacherKey){
    if(typeof body.teacherKey !== 'string' || body.teacherKey.length < 16 || body.teacherKey.length > 128) return { status:400, json:{ error:'bad teacher key' } };
    const h = await sha256(body.teacherKey);
    if(!cur.teacherKeyHash) cur.teacherKeyHash = h;               // the first teacher phone claims the class
    else if(cur.teacherKeyHash !== h) return { status:403, json:{ error:'this class is synced by another teacher phone' } };
    teacher = true;
  }
  const sent = [];

  for(const [id, c] of Object.entries((body && body.children) || {})){
    if(typeof id !== 'string' || !id || id.length > 40 || id.startsWith('_')) continue;
    const clean = cleanChild(c);
    if(!clean) continue;
    if(!cur.children[id] && Object.keys(cur.children).length >= MAX_CHILDREN) continue;
    if(!cur.children[id] || cur.children[id].at <= clean.at) cur.children[id] = clean;
    sent.push(id);
  }
  const hw = teacher ? cleanHomework(body.homework) : null;     // only the class's teacher sets homework
  if(hw && (!cur.homework || cur.homework.assignedAt < hw.assignedAt)) cur.homework = hw;
  const ls = teacher ? cleanLessons(body.lessons) : null;      // and the class's own lessons
  if(ls && (!cur.lessons || cur.lessons.at < ls.at)) cur.lessons = ls;
  const ro = teacher ? cleanRoster(body.roster) : null;        // and which class each child is in
  if(ro && (!cur.roster || cur.roster.at < ro.at)) cur.roster = ro;

  await store.setJSON(key, cur);
  return { status:200, json: teacher ? { children: cur.children, homework: cur.homework, lessons: cur.lessons || null, roster: cur.roster || null, teacher: true }
                                     : { children: pick(cur.children, sent), homework: cur.homework, lessons: cur.lessons || null, roster: rosterFor(cur.roster, sent) } };
}
const pick = (all, ids) => Object.fromEntries(ids.filter(id => all[id]).map(id => [id, all[id]]));
async function sha256(text){
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(String(text)).digest('hex');
}

async function blobStore(){
  try{
    const { getStore } = await import('@netlify/blobs');
    return getStore('takhti-classes');
  }catch(e){ return null; }
}

/* Netlify passes (Request, context); Vercel passes (req, res). */
export default async function handler(req, res){
  const vercel = res && typeof res.status === 'function';
  const reply = (status, json) => vercel
    ? res.status(status).json(json)
    : new Response(JSON.stringify(json), { status, headers:{ 'content-type':'application/json' } });

  if(req.method !== 'POST') return reply(405, { error:'POST only' });
  let body;
  try{
    if(vercel) body = req.body;
    else {
      const text = await req.text();
      if(text.length > MAX_BODY) return reply(413, { error:'too large' });
      body = JSON.parse(text);
    }
  }catch(e){ return reply(400, { error:'bad JSON' }); }

  const store = await blobStore();
  if(!store) return reply(503, { error:'sync storage not configured on this server' });
  try{
    const out = await syncCore(store, body);
    return reply(out.status, out.json);
  }catch(e){
    return reply(503, { error:'sync storage unavailable' });
  }
}
