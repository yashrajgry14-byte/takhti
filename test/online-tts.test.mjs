import test from 'node:test';
import assert from 'node:assert/strict';
import { ttsCore } from '../cloud/tts.mjs';

test('Google Chirp synthesis uses service-account token, Hindi voice and pacing', async () => {
  let request;
  const result = await ttsCore({text:'नमस्ते',lang:'hi',pace:0.8},{
    ip:'test-hindi',
    token:async()=> 'test-token',
    fetchImpl:async (url,opts)=>{
      request = {url,opts,body:JSON.parse(opts.body)};
      return {ok:true,json:async()=>({audioContent:'dGVzdA=='})};
    }
  });
  assert.equal(result.status,200);
  assert.equal(result.json.provider,'google');
  assert.equal(result.json.mime,'audio/mpeg');
  assert.equal(request.body.voice.name,'hi-IN-Chirp3-HD-Kore');
  assert.equal(request.body.audioConfig.speakingRate,0.8);
  assert.equal(request.opts.headers.Authorization,'Bearer test-token');
});

test('English has its own Google voice', async () => {
  let body;
  const result = await ttsCore({text:'Hello',lang:'en'},{ip:'test-english',
    token:async()=> 'token',fetchImpl:async (_url,opts)=>{
      body=JSON.parse(opts.body);
      return {ok:true,json:async()=>({audioContent:'dGVzdA=='})};
    }});
  assert.equal(result.status,200);
  assert.equal(body.voice.name,'en-IN-Chirp3-HD-Kore');
});

test('Reject oversized or invalid inputs before any API call',async()=>{
  let called=false;
  const opts={ip:'test-validation',token:async()=>{called=true;return 'token';}};
  assert.equal((await ttsCore({text:'a'.repeat(241),lang:'en'},opts)).status,400);
  assert.equal((await ttsCore({text:'Hello',lang:'fr'},opts)).status,400);
  assert.equal(called,false);
});

test('Google failure produces a fallback-friendly server response',async()=>{
  const r=await ttsCore({text:'Hello',lang:'en'},{ip:'test-upstream',
    token:async()=> 'token',fetchImpl:async()=>({ok:false,status:503})});
  assert.equal(r.status,502);
  assert.equal(r.json.provider,'google');
});
