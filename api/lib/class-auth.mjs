/* Firebase Authentication ID-token verification for Takhti's class sync.
   Tokens must be signed RS256 Firebase ID tokens for this exact project.
   Roles and child memberships are never accepted from the browser. */
import { createVerify } from 'node:crypto';

const CERT_URL='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cache={until:0,certs:{}};
const decode = part => {
  if(!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('invalid token encoding');
  return JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
};
export async function verifyIdToken(token, projectId, fetchImpl=fetch){
  if(!projectId || typeof token!=='string' || token.length>10000) throw new Error('identity not configured');
  const chunks=token.split('.');
  if(chunks.length!==3 || chunks.some(x=>!x)) throw new Error('invalid ID token');
  const head=decode(chunks[0]), claims=decode(chunks[1]);
  const now=Math.floor(Date.now()/1000);
  if(head.alg!=='RS256' || typeof head.kid!=='string' || !/^[\w-]{4,120}$/.test(head.kid)) throw new Error('invalid ID token algorithm');
  if(claims.aud!==projectId || claims.iss!==`https://securetoken.google.com/${projectId}` ||
     typeof claims.sub!=='string' || !claims.sub || claims.sub.length>128 ||
     !Number.isFinite(claims.exp) || claims.exp<=now ||
     !Number.isFinite(claims.iat) || claims.iat>now+60 ||
     !Number.isFinite(claims.auth_time) || claims.auth_time>now+60 ||
     !claims.firebase || typeof claims.firebase.sign_in_provider!=='string') throw new Error('invalid ID token claims');
  if(Date.now()>=cache.until || !cache.certs[head.kid]){
    const r=await fetchImpl(CERT_URL,{headers:{accept:'application/json'}});
    if(!r.ok) throw new Error('Firebase public keys unavailable');
    const certs=await r.json();
    const maxAge=Number((r.headers?.get('cache-control')||'').match(/max-age=(\d+)/)?.[1]||600);
    cache={certs,until:Date.now()+Math.min(Math.max(maxAge,30),3600)*1000};
  }
  const cert=cache.certs[head.kid];
  if(!cert) throw new Error('unknown token signature');
  const verifier=createVerify('RSA-SHA256');
  verifier.update(chunks[0]+'.'+chunks[1]);verifier.end();
  if(!verifier.verify(cert,Buffer.from(chunks[2],'base64url'))) throw new Error('invalid token signature');
  return {uid:claims.sub,email:claims.email||null,emailVerified:claims.email_verified===true,claims};
}
export function bearerToken(req){
  const auth=String(req.headers?.authorization||'');
  const m=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(auth);
  return m?m[1]:null;
}
/* Only admin-provisioned ACL records are trusted: exact class membership,
   exact guardian-to-child bindings and recorded consent. */
export function authorizeClass(body,access){
  if(!body || typeof body!=='object' || !access || access.active!==true) return {ok:false,status:403};
  const code=String(body.code||'').toUpperCase();
  const schoolId=String(access.schoolId||'');
  if(!/^[A-Za-z0-9_-]{6,64}$/.test(schoolId)) return {ok:false,status:403};
  if(!/^[A-Z0-9]{6}$/.test(code)) return {ok:false,status:400};
  const kids=body.children && typeof body.children==='object' && !Array.isArray(body.children) ? Object.keys(body.children) : [];
  if(access.role==='teacher'){
    if(!Array.isArray(access.classes) || !access.classes.includes(code)) return {ok:false,status:403};
    if(kids.length) return {ok:false,status:403};
    return {ok:true,role:'teacher',code,schoolId};
  }
  if(access.role==='guardian'){
    if(body.teacherKey || body.homework || body.lessons || body.roster) return {ok:false,status:403};
    const grants=Array.isArray(access.children)?access.children:[];
    const allowed=new Set(grants.filter(g=>g && g.code===code && g.consent===true && typeof g.id==='string').map(g=>g.id));
    if(!allowed.size || kids.some(id=>!allowed.has(id))) return {ok:false,status:403};
    return {ok:true,role:'guardian',code,schoolId,children:allowed};
  }
  return {ok:false,status:403};
}
