import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../src/core/class-auth.js',import.meta.url),'utf8');
function browser(roleStatus,roleBody,{verifyOk=true}={}){
  const calls=[];
  const fields={classEmail:{value:'teacher@example.test'},classPassword:{value:'test-only-password'}};
  const storage=new Map([['takhti-class-ABC123','sensitive-old-class-data'],['other','kept']]);
  const localStorage={
    get length(){return storage.size;},
    key(i){return [...storage.keys()][i]??null;},
    removeItem(k){storage.delete(k);}
  };
  const context={
    document:{getElementById:id=>fields[id]||null},
    localStorage,Date,Promise,Error,
    attr:s=>String(s),render(){},
    fetch:async(url,opts={})=>{
      calls.push({url:String(url),body:opts.body&&JSON.parse(opts.body)});
      if(url==='/api/auth-config')return {ok:true,json:async()=>({enabled:true,apiKey:'test-key'})};
      if(String(url).includes('signInWithPassword'))return {ok:true,json:async()=>({idToken:'test-id-token',email:'teacher@example.test',expiresIn:'3600'})};
      if(url==='/api/class-identity')return {ok:roleStatus===200,status:roleStatus,json:async()=>roleBody};
      if(String(url).includes('sendOobCode'))return {ok:verifyOk,status:verifyOk?200:400,json:async()=>({})};
      throw new Error('unexpected request: '+url);
    }
  };
  vm.createContext(context);
  vm.runInContext(src,context);
  return {context,calls,storage,run:code=>vm.runInContext(code,context)};
}

test('unverified adult gets a real Firebase verification email, no active school session',async()=>{
  const b=browser(403,{error:'verify your email before accessing school records'});
  await b.run('classAuthSignIn()');
  assert.equal(b.calls.filter(c=>c.url.includes('sendOobCode')).length,1);
  assert.deepEqual(b.calls.find(c=>c.url.includes('sendOobCode')).body,{requestType:'VERIFY_EMAIL',idToken:'test-id-token'});
  assert.equal(b.run('classAuthToken()'),null);
  assert.match(b.run('CLASS_AUTH.error'),/Verification email sent/);
  assert.equal(b.storage.has('takhti-class-ABC123'),false);
});
test('approved verified teacher may sign in and sign out without persisted class records',async()=>{
  const b=browser(200,{role:'teacher',classes:['ABC123']});
  await b.run('classAuthSignIn()');
  assert.equal(b.run('CLASS_AUTH.role'),'teacher');
  assert.equal(b.run('classAuthToken()'),'test-id-token');
  assert.equal(b.calls.filter(c=>c.url.includes('sendOobCode')).length,0);
  b.run('classAuthSignOut()');
  assert.equal(b.run('classAuthToken()'),null);
  assert.equal(b.storage.has('other'),true);
});
test('unapproved adult is denied school access, without an email-verification request',async()=>{
  const b=browser(403,{error:'school administrator has not granted access'});
  await b.run('classAuthSignIn()');
  assert.equal(b.run('classAuthToken()'),null);
  assert.equal(b.calls.filter(c=>c.url.includes('sendOobCode')).length,0);
  assert.match(b.run('CLASS_AUTH.error'),/not granted access/);
});
test('failed Firebase verification email does not establish a session',async()=>{
  const b=browser(403,{error:'verify your email first'},{verifyOk:false});
  await b.run('classAuthSignIn()');
  assert.equal(b.run('classAuthToken()'),null);
  assert.match(b.run('CLASS_AUTH.error'),/Verify your email address/);
});
