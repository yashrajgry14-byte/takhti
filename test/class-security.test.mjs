/* Security regression tests: no anonymous access, no cross-school access,
   no client-assigned teacher role, no cross-child edits, and no unapproved
   guardian consent. Also verifies RSA-signed Firebase ID token validation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {authorizeClass,verifyIdToken} from '../api/lib/class-auth.mjs';
import {syncCore} from '../api/class-sync.mjs';

const teacher={active:true,role:'teacher',schoolId:'school-one',classes:['SCH001']};
const guardian={active:true,role:'guardian',schoolId:'school-one',children:[{code:'SCH001',id:'alice',consent:true}]};
const classData=()=>({code:'SCH001',children:{},homework:null,lessons:null,roster:null});
const store=()=>{const items=new Map();return {items,get:async k=>items.get(k)?structuredClone(items.get(k)):null,setJSON:async(k,v)=>items.set(k,structuredClone(v))};};

test('student data rejects every anonymous request',async()=>{
  const s=store();
  assert.equal((await syncCore(s,{code:'SCH001',children:{alice:{childName:'Alice'}}})).status,401);
  assert.equal(s.items.size,0);
});
test('verified teacher is scoped to assigned school class',()=>{
  assert.equal(authorizeClass({code:'SCH001',children:{}},teacher).ok,true);
  assert.equal(authorizeClass({code:'SCH002',children:{}},teacher).status,403);
  assert.equal(authorizeClass({code:'SCH001',children:{}},{...teacher,schoolId:'bad school id!'}).status,403);
  assert.equal(authorizeClass({code:'SCH001',children:{}},{...teacher,active:false}).status,403);
  assert.equal(authorizeClass({code:'SCH001',children:{}},{role:'teacher',schoolId:'school-one',classes:['SCH001']}).status,403);
});
test('a guardian cannot access another child or class',()=>{
  assert.equal(authorizeClass({code:'SCH001',children:{alice:{}}},guardian).ok,true);
  assert.equal(authorizeClass({code:'SCH001',children:{bob:{}}},guardian).status,403);
  assert.equal(authorizeClass({code:'SCH002',children:{alice:{}}},guardian).status,403);
  assert.equal(authorizeClass({code:'SCH001',children:{}},{...guardian,children:[{code:'SCH001',id:'alice',consent:false}]}).status,403);
});
test('a guardian cannot claim teacher powers using client fields',()=>{
  for(const field of ['teacherKey','homework','lessons','roster']){
    const body={code:'SCH001',children:{},[field]:field==='teacherKey'?'malicious':{}};
    assert.equal(authorizeClass(body,guardian).status,403);
  }
});
test('teacher cannot rewrite guardian-owned learning records',async()=>{
  const s=store(),identity=authorizeClass(classData(),teacher);
  const res=await syncCore(s,{code:'SCH001',children:{alice:{childName:'FORGED',at:1}}},identity);
  assert.equal(res.status,403);
  assert.equal(s.items.size,0);
});
test('guardian may update only own child; teacher may assign homework',async()=>{
  const s=store();
  const g=authorizeClass({code:'SCH001',children:{alice:{}}},guardian);
  let r=await syncCore(s,{code:'SCH001',children:{alice:{childName:'Alice',skillHistory:{add2:{n:3,right:2}},at:1}}},g);
  assert.equal(r.status,200);
  assert.deepEqual(Object.keys(r.json.children),['alice']);
  const t=authorizeClass({code:'SCH001',children:{}},teacher);
  r=await syncCore(s,{code:'SCH001',children:{},homework:{skills:['add2'],note:'Practice',assignedAt:2}},t);
  assert.equal(r.status,200);
  assert.deepEqual(Object.keys(r.json.children),['alice']);
  const g2=authorizeClass({code:'SCH001',children:{}},guardian);
  r=await syncCore(s,{code:'SCH001',children:{}},g2);
  assert.equal(r.status,200);
  assert.equal(r.json.homework.note,'Practice');
});
test('identical class code from different schools is stored separately',async()=>{
  const s=store();
  const schoolA=authorizeClass({code:'SCH001',children:{alice:{}}},guardian);
  const schoolB=authorizeClass({code:'SCH001',children:{alice:{}}},{...guardian,schoolId:'school-two'});
  assert.equal((await syncCore(s,{code:'SCH001',children:{alice:{childName:'School A',at:1}}},schoolA)).status,200);
  assert.equal((await syncCore(s,{code:'SCH001',children:{alice:{childName:'School B',at:1}}},schoolB)).status,200);
  assert.equal(s.items.size,2);
  assert.equal(s.items.get('class-school-one-SCH001').children.alice.childName,'School A');
  assert.equal(s.items.get('class-school-two-SCH001').children.alice.childName,'School B');
});
test('Firebase token verifier checks actual RSA signature, audience, issuer and expiry',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  const kid='test-key-1234', project='sample-project', now=Math.floor(Date.now()/1000);
  const sign=claims=>{
    const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid})).toString('base64url');
    const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature=createSign('RSA-SHA256').update(h+'.'+p).end().sign(privateKey).toString('base64url');
    return h+'.'+p+'.'+signature;
  };
  const claims={iss:'https://securetoken.google.com/'+project,aud:project,sub:'uid-123',iat:now-10,exp:now+600,auth_time:now-10,email_verified:true,firebase:{sign_in_provider:'password'}};
  const fetchImpl=async()=>({ok:true,json:async()=>({[kid]:publicKey.export({format:'pem',type:'spki'})}),headers:{get:()=> 'max-age=300'}});
  const good=sign(claims);
  assert.equal((await verifyIdToken(good,project,fetchImpl)).uid,'uid-123');
  await assert.rejects(()=>verifyIdToken(sign({...claims,aud:'other'}),project,fetchImpl));
  await assert.rejects(()=>verifyIdToken(sign({...claims,exp:now-1}),project,fetchImpl));
  const tampered=good.slice(0,-3)+'abc';
  await assert.rejects(()=>verifyIdToken(tampered,project,fetchImpl));
});
