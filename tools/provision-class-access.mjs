#!/usr/bin/env node
/* Run only from an administrator's authenticated Cloud Shell session.
   Provision a Firebase Auth UID into the private Takhti class ACL bucket.
   Does not create identities or collect consent: verify those separately. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

function fail(message){console.error(message);process.exit(1);}
const args={};
for(let i=2;i<process.argv.length;i+=2){
  const key=process.argv[i],value=process.argv[i+1];
  if(!key?.startsWith('--') || !value || value.startsWith('--')) fail('Each option must be --name value');
  args[key.slice(2)]=value;
}
const bucket=args.bucket,uid=args.uid,role=args.role,code=args.class?.toUpperCase(),schoolId=args.school;
if(!/^[a-z0-9][a-z0-9._-]{5,220}$/i.test(bucket||'')) fail('Specify valid --bucket');
if(!uid || uid.length>128 || /[\u0000-\u001f]/.test(uid)) fail('Specify a Firebase Authentication UID (--uid)');
if(!/^[A-Z0-9]{6}$/.test(code||'')) fail('Specify a six-character --class');
if(!/^[A-Za-z0-9_-]{6,64}$/.test(schoolId||'')) fail('Specify a unique verified --school SCHOOL_ID');
if(!['teacher','guardian'].includes(role)) fail('--role teacher or guardian required');
if(role==='guardian' && (!args.child || args.child.length>40 || !args['consent-record']))
  fail('Guardian requires --child CHILD_ID and --consent-record EXISTING_VERIFIED_REFERENCE');
if(role==='teacher' && (args.child || args['consent-record'])) fail('Teacher cannot specify guardian consent/child');
const acl=role==='teacher'
  ? {role:'teacher',active:true,schoolId,classes:[code]}
  : {role:'guardian',active:true,schoolId,children:[{code,id:args.child,consent:true,consentReference:args['consent-record']}]};
const hash=createHash('sha256').update(uid).digest('hex');
const dst=`gs://${bucket}/classes/access-${hash}.json`;
const dir=mkdtempSync(path.join(tmpdir(),'takhti-acl-'));
try{
  const source=path.join(dir,'access.json');
  writeFileSync(source,JSON.stringify(acl,null,2),{mode:0o600});
  // No overwrite by accident: administrator should revoke/reconcile old
  // assignments deliberately. This check is not an atomic create lock.
  try{execFileSync('gcloud',['storage','ls',dst],{stdio:'ignore'});fail('ACL exists; review and revoke/update it manually before replacing');}
  catch(e){if(e.status===0)throw e;}
  execFileSync('gcloud',['storage','cp',source,dst],{stdio:'inherit'});
  console.log('Created protected ACL for Firebase UID hash '+hash.slice(0,12)+'…');
}finally{rmSync(dir,{recursive:true,force:true});}
