const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const speech = fs.readFileSync(path.join(__dirname, '../src/core/speech.js'), 'utf8');

// In real app audio errors arrive asynchronously, after Audio.play() succeeds.
test('Google audio error triggers backup, not premature completion',async()=>{
  const events=[];let done=0;
  const ctx=vm.createContext({
    S:{muted:false,lang:'en'},band:()=>({speechRate:1}),log:()=>{},
    stopOnlineSpeech:()=>{vm.runInContext('SPEECH_REQUEST++',ctx)},
    playLive:async (_t,_l,_fin,_p,_id,onError)=>{events.push('google');setTimeout(onError,0);return true;},
    playBackup:async (_t,_l,finish)=>{events.push('backup');setTimeout(finish,0);return true;},
    playRecorded:async()=>{events.push('recorded');return false;},
    finished:()=>done++,setTimeout,clearTimeout,
  });
  vm.runInContext('let SPEECH_REQUEST=0;',ctx);
  vm.runInContext(speech,ctx);
  await vm.runInContext('speak("Hello","en",finished)',ctx);
  await new Promise(r=>setTimeout(r,30));
  assert.deepEqual(events,['google','backup']);
  assert.equal(done,1);
});
test('Both network providers unavailable falls back to prerecorded audio',async()=>{
  const events=[];let done=0;
  const ctx=vm.createContext({
    S:{muted:false,lang:'hi'},band:()=>({speechRate:0.8}),log:()=>{},
    stopOnlineSpeech:()=>vm.runInContext('SPEECH_REQUEST++',ctx),
    playLive:async()=>{events.push('google');return false;},
    playBackup:async()=>{events.push('backup');return false;},
    playRecorded:async (_t,_l,finish)=>{events.push('recorded');finish();return true;},
    finished:()=>done++,setTimeout,clearTimeout,
  });
  vm.runInContext('let SPEECH_REQUEST=0;',ctx);
  vm.runInContext(speech,ctx);
  await vm.runInContext('speak("नमस्ते","hi",finished)',ctx);
  assert.deepEqual(events,['google','backup','recorded']);
  assert.equal(done,1);
});
