#!/usr/bin/env node
/* One-time staging smoke test with two OWNED Firebase test accounts.
   No actual child data. Never print credentials, Firebase tokens, or UIDs.
   Intentionally refuses production URLs: deploy a separate staging service
   backed by a test-only bucket before invoking this script. */
const args=process.argv.slice(2);
const i=args.indexOf('--url');
const raw=i>=0?args[i+1]:null;
if(!raw) {console.error('Usage: node tools/smoke-school-auth.mjs --url https://takhti-auth-staging-...a.run.app');process.exit(2);}
let base;
try{base=new URL(raw);}catch{console.error('Invalid staging URL');process.exit(2);}
if(base.protocol!=='https:' || !base.hostname.startsWith('takhti-auth-staging-') ||
   !base.hostname.endsWith('.a.run.app') || base.username || base.password || base.search || base.hash){
  console.error('Refusing to test any non-staging URL; use the Cloud Run takhti-auth-staging service.');
  process.exit(2);
}
const {TEACHER_EMAIL,TEACHER_PASSWORD,GUARDIAN_EMAIL,GUARDIAN_PASSWORD,
       FIREBASE_PROJECT_ID,TEACHER_UID,GUARDIAN_UID}=process.env;
if(!TEACHER_EMAIL||!TEACHER_PASSWORD||!GUARDIAN_EMAIL||!GUARDIAN_PASSWORD||
   FIREBASE_PROJECT_ID!=='gen-lang-client-0604938251'){
  console.error('Provide both test credentials and FIREBASE_PROJECT_ID=gen-lang-client-0604938251 in Cloud Shell.');
  process.exit(2);
}
const code='ABC123',child='TESTCHILD01';
const results=[];
const assert=(label,ok)=>{results.push({label,ok});console.log((ok?'PASS':'FAIL')+' '+label);};
const post=async(url,body,token)=>{
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),cache:'no-store'});
  let json={};try{json=await r.json();}catch{}
  return {status:r.status,json};
};
const api=async(path,token,body)=>{
  const r=await fetch(new URL(path,base),{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
  let json={};try{json=await r.json();}catch{}
  return {status:r.status,json};
};
const decodeClaims=t=>{try{return JSON.parse(Buffer.from(t.split('.')[1],'base64url').toString());}catch{return {}};};
const signIn=async(apiKey,email,password,uid)=>{
  const r=await post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(apiKey),
    {email,password,returnSecureToken:true});
  if(r.status!==200||!r.json.idToken)throw new Error('Firebase login failed for a test account (HTTP '+r.status+')');
  const claims=decodeClaims(r.json.idToken);
  if(claims.aud!==FIREBASE_PROJECT_ID || (uid&&r.json.localId!==uid))throw new Error('Firebase project or UID mismatch');
  return {token:r.json.idToken,verified:claims.email_verified===true};
};
try{
  const c=await api('/api/auth-config');
  if(c.status!==200||!c.json.enabled||!c.json.apiKey)throw new Error('Staging authentication config is disabled');
  const apiKey=c.json.apiKey;
  const teacher=await signIn(apiKey,TEACHER_EMAIL,TEACHER_PASSWORD,TEACHER_UID);
  const guardian=await signIn(apiKey,GUARDIAN_EMAIL,GUARDIAN_PASSWORD,GUARDIAN_UID);
  if(!teacher.verified||!guardian.verified){
    for(const [label,user] of [['Teacher',teacher],['Guardian',guardian]]){
      if(user.verified)continue;
      const sent=await post('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(apiKey),
        {requestType:'VERIFY_EMAIL',idToken:user.token});
      console.log(label+' email is unverified. '+(sent.status===200?'Firebase verification email requested.':'Please request a verification email in Firebase.'));
    }
    console.error('Open the email verification links, then rerun with freshly signed-in tokens.');
    process.exitCode=2;
  }else{
    const anonymous=await api('/api/class-identity');
    assert('anonymous identity denied',anonymous.status===401);
    const invalid=await api('/api/class-identity',teacher.token.slice(0,-1)+(teacher.token.endsWith('a')?'b':'a'));
    assert('tampered identity denied',invalid.status===401);
    const t=await api('/api/class-identity',teacher.token);
    const g=await api('/api/class-identity',guardian.token);
    assert('teacher role and class verified by the server',t.status===200&&t.json.role==='teacher'&&t.json.classes?.includes(code));
    assert('guardian role verified by the server',g.status===200&&g.json.role==='guardian'&&(!g.json.classes||g.json.classes.length===0));
    // Fail closed on every sensitive write before inserting synthetic data.
    const deniedAnon=await api('/api/class-sync',null,{code,children:{[child]:{at:1}}});
    const deniedOther=await api('/api/class-sync',guardian.token,{code,children:{SOMEONE_ELSES_CHILD:{childName:'FAKE',at:1}}});
    const deniedTeacherWrite=await api('/api/class-sync',teacher.token,{code,children:{[child]:{childName:'FORGED',at:1}}});
    const deniedGuardianHomework=await api('/api/class-sync',guardian.token,{code,children:{},homework:{skills:['add2'],note:'FORGED'}});
    const deniedOtherClass=await api('/api/class-sync',teacher.token,{code:'BAD001',children:{}});
    assert('anonymous child write denied',deniedAnon.status===401);
    assert('guardian cannot write another child',deniedOther.status===403);
    assert('teacher cannot forge guardian-owned child records',deniedTeacherWrite.status===403);
    assert('guardian cannot assign homework',deniedGuardianHomework.status===403);
    assert('teacher cannot access an unassigned class',deniedOtherClass.status===403);
    if(!results.every(r=>r.ok))throw new Error('Security denial check failed; refusing synthetic writes');
    const synthetic={childName:'SYNTHETIC TEST CHILD - NO REAL DATA',skillHistory:{add2:{n:1,right:1}},at:Date.now()};
    const own=await api('/api/class-sync',guardian.token,{code,children:{[child]:synthetic}});
    assert('guardian may sync their synthetic child',own.status===200&&own.json.children?.[child]?.childName===synthetic.childName);
    assert('guardian response contains no other children',own.status===200&&Object.keys(own.json.children||{}).every(id=>id===child));
    const teacherRead=await api('/api/class-sync',teacher.token,{code,children:{}});
    assert('assigned teacher reads the synthetic child',teacherRead.status===200&&teacherRead.json.children?.[child]?.childName===synthetic.childName);
    const homework={skills:['add2'],note:'SYNTHETIC STAGING TEST',assignedAt:Date.now()};
    const assigned=await api('/api/class-sync',teacher.token,{code,children:{},homework});
    assert('teacher may assign synthetic homework',assigned.status===200&&assigned.json.homework?.note===homework.note);
    const guardianRead=await api('/api/class-sync',guardian.token,{code,children:{[child]:synthetic}});
    assert('guardian can read homework for their child',guardianRead.status===200&&guardianRead.json.homework?.note===homework.note);
    console.log('\n'+results.filter(x=>x.ok).length+'/'+results.length+' live checks passed.');
    if(results.some(x=>!x.ok))process.exitCode=1;
  }
}catch(e){
  console.error('STAGING CHECK FAILED: '+String(e.message||e));
  process.exitCode=1;
}
