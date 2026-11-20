/* Class synchronization security checks for the verified school account model.
   Legacy first-writer teacher-key and anonymous child records are intentionally
   not supported. For deeper identity and isolation tests see class-security.test.mjs. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {createHash}=require('node:crypto');

(async()=>{
  const {syncCore,default:handler}=await import(pathToFileURL(path.resolve(__dirname,'../api/class-sync.mjs')).href);
  const {authorizeClass}=await import(pathToFileURL(path.resolve(__dirname,'../api/lib/class-auth.mjs')).href);
  function memory(){
    const map=new Map();
    return {map,get:async key=>map.has(key)?structuredClone(map.get(key)):null,
      setJSON:async(key,value)=>map.set(key,structuredClone(value))};
  }
  test('anonymous class code and teacher key do not enable child data writes',async()=>{
    const store=memory();
    const r=await syncCore(store,{code:'ABC123',teacherKey:'x'.repeat(48),
      children:{child1:{childName:'Forged'}}});
    assert.equal(r.status,401);assert.equal(store.map.size,0);
  });
  test('guardian consent and server-owned child binding permit only their child',async()=>{
    const store=memory();
    const g={role:'guardian',active:true,schoolId:'school-one',children:[{code:'ABC123',id:'meera',consent:true}]};
    const data={code:'ABC123',children:{meera:{childName:'Meera',skillHistory:{tables:{n:10,right:3}},at:1}}};
    const ctx=authorizeClass(data,g);assert.equal(ctx.ok,true);
    const ok=await syncCore(store,data,ctx);assert.equal(ok.status,200);
    assert.equal(ok.json.children.meera.skillHistory.tables.n,10);
    assert.equal(authorizeClass({code:'ABC123',children:{ravi:{}}},g).status,403);
    assert.equal(authorizeClass(data,{...g,children:[{code:'ABC123',id:'meera',consent:false}]}).status,403);
  });
  test('teacher reads class and can assign homework, but not forge a child',async()=>{
    const store=memory();
    const g=authorizeClass({code:'ABC123',children:{meera:{}}},{role:'guardian',active:true,children:[{code:'ABC123',id:'meera',consent:true}]});
    await syncCore(store,{code:'ABC123',children:{meera:{childName:'Meera',at:1}}},g);
    const t=authorizeClass({code:'ABC123',children:{}},{role:'teacher',active:true,schoolId:'school-one',classes:['ABC123']});
    const homework={skills:['tables'],note:'Practice tables',assignedAt:5};
    const result=await syncCore(store,{code:'ABC123',homework,children:{}},t);
    assert.equal(result.status,200);assert.equal(result.json.homework.note,'Practice tables');
    assert.equal((await syncCore(store,{code:'ABC123',children:{meera:{childName:'Fake'}}},t)).status,403);
  });
  test('standalone function denies unauthenticated writes, including valid class codes',async()=>{
    const r=await handler(new Request('https://x/api/class-sync',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({code:'ABC123',children:{}})}),{});
    assert.equal(r.status,503);
  });
  test('malformed class code denied by authorization layer',()=>{
    assert.equal(authorizeClass({code:'BAD!',children:{}},{role:'teacher',active:true,schoolId:'school-one',classes:['BAD!']}).status,400);
  });
})().catch(e=>{console.error(e);process.exitCode=1;});
