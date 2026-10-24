/* ==================================================================
   CLASS SHARING BETWEEN PHONES — short codes, no server.

   The class-code mirror (core/diagnose.js) lives in one phone's own
   storage, so on its own a teacher only sees children on the same phone.
   core/class-sync.js keeps classes in sync automatically when there is a
   connection; this is the path that needs no internet and no server, the
   way Indian schools already pass things around — WhatsApp or SMS:

     child's phone → teacher:  a PROGRESS CODE (classReportCode): the
                               child's class code, id, name and practice
                               counts per skill. The teacher pastes it
                               into the teacher view (importClassReport)
                               and the child joins the class diagnosis.
     teacher → child's phone:  a HOMEWORK CODE (homeworkCode): the skills
                               and note. The parent pastes it on the
                               dashboard (importHomework) and that child's
                               app diagnoses it like any other homework.

   A code goes nowhere by itself — it only travels when a parent or
   teacher sends it themselves, and it holds no more than the teacher's
   own diagnostic needs — no photos, no voice, no reading text.

   Format: PREFIX.base64url(json).checksum — the checksum catches a code
   cut short by a careless copy before it can corrupt a record.
   ================================================================== */

const SHARE_PREFIX = { report:'TKR1', homework:'TKH1' };

function shareB64(str){
  let bin = '';
  for(const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function shareUnB64(b64){
  const bin = atob(b64.replace(/-/g,'+').replace(/_/g,'/'));
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}
const shareSum = s => (seedOf(s) % 46656).toString(36).padStart(3, '0');

function shareEncode(kind, obj){
  const body = shareB64(JSON.stringify(obj));
  return `${SHARE_PREFIX[kind]}.${body}.${shareSum(body)}`;
}
/* The decoded object, or null for anything that isn't a whole, valid code
   of this kind (wrong kind, cut short, edited, or just text). */
function shareDecode(kind, text){
  const parts = String(text || '').replace(/\s+/g, '').split('.');
  if(parts.length !== 3 || parts[0] !== SHARE_PREFIX[kind] || shareSum(parts[1]) !== parts[2]) return null;
  try{ return JSON.parse(shareUnB64(parts[1])); }catch(e){ return null; }
}

/* Read-modify-write one class's mirror blob, wrapped like every other
   storage touch — a locked-down WebView must never throw from here. */
function classMirrorUpdate(code, mutate){
  try{
    const key = classMirrorKey(code);
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    mutate(all);
    localStorage.setItem(key, JSON.stringify(all));
    return true;
  }catch(e){ return false; }
}

function classReportCode(child){
  const c = child || S;
  if(!c.classCode || !c.id) return null;
  const h = Object.entries(c.skillHistory || {}).map(([id, v]) => [id, v.n, v.right]);
  return shareEncode('report', { c: c.classCode, i: c.id, n: c.name, h, t: Date.now() });
}

/* Teacher's side. Returns {ok, code, name} or {ok:false, why}. An older
   code for a child never overwrites a newer one already imported. */
function importClassReport(text){
  const o = shareDecode('report', text);
  if(!o || !/^[A-Z0-9]{6}$/.test(o.c) || !o.i || !Array.isArray(o.h)) return { ok:false, why:'invalid' };
  let stale = false;
  classMirrorUpdate(o.c, all => {
    const prev = all[o.i];
    if(prev && prev.at && prev.at > o.t){ stale = true; return; }
    const skillHistory = {};
    for(const [id, n, right] of o.h) if(skillById(id)) skillHistory[id] = { n: +n || 0, right: +right || 0 };
    all[o.i] = { childName: String(o.n || '?').slice(0, 40), skillHistory, at: o.t, viaCode: true };
  });
  return stale ? { ok:false, why:'older' } : { ok:true, code:o.c, name:o.n };
}

function homeworkCode(classCode){
  const hw = readClassShared(classCode)._homework;
  if(hw && hw.cleared) return null;
  return hw ? shareEncode('homework', { c: classCode, s: hw.skills, n: hw.note || '', a: hw.assignedAt }) : null;
}

/* Parent's side. A child already linked to a different class can't be
   given another class's homework; a child not linked yet is linked by it
   (the code carries the class code, so this is the same act as typing it). */
function importHomework(text, child){
  const c = child || S;
  const o = shareDecode('homework', text);
  if(!o || !/^[A-Z0-9]{6}$/.test(o.c) || !Array.isArray(o.s) || !o.s.every(id => skillById(id))) return { ok:false, why:'invalid' };
  if(c.classCode && c.classCode !== o.c) return { ok:false, why:'otherclass' };
  c.classCode = o.c;
  classMirrorUpdate(o.c, all => { all._homework = { skills: o.s, note: String(o.n || '').slice(0, 140), assignedAt: o.a }; });
  mirrorToClassNow(c);
  return { ok:true, code:o.c, skills:o.s };
}
