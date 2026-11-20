/* Google Cloud Chirp 3 HD synthesis for Takhti's online-only narration.
   Runs on Cloud Run using its service account; never exposes credentials. */
const IP_WINDOW_MS = 60_000;
const IP_MAX = 40;
const usage = new Map();
const MAX_TEXT = 240;

export async function ttsCore(body, opts = {}){
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if(!text || text.length > MAX_TEXT || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) return {status:400,json:{error:'text must contain 1–240 printable characters'}};
  const lang = body.lang === 'hi' ? 'hi' : body.lang === 'en' ? 'en' : null;
  if(!lang) return {status:400,json:{error:'lang must be hi or en'}};
  const now = Date.now();
  const ip = String(opts.ip || 'unknown');
  if(usage.size > 4000) for(const [key,value] of usage) if(now-value.since > IP_WINDOW_MS) usage.delete(key);
  const u = usage.get(ip);
  if(u && now-u.since < IP_WINDOW_MS){
    if(u.count >= IP_MAX) return {status:429,json:{error:'speech rate limit reached'}};
    u.count++;
  }else usage.set(ip,{since:now,count:1});

  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const voice = `${locale}-Chirp3-HD-Kore`;
  try{
    const token = await opts.token();
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),8000);
    let response;
    try{
      response = await (opts.fetchImpl || fetch)('https://texttospeech.googleapis.com/v1/text:synthesize',{
        method:'POST',signal:controller.signal,
        headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({input:{text},voice:{languageCode:locale,name:voice},audioConfig:{audioEncoding:'MP3'}})
      });
    }finally{clearTimeout(timer);}
    if(!response.ok) return {status:502,json:{error:'Google speech unavailable',provider:'google',upstreamStatus:response.status}};
    const data = await response.json();
    if(typeof data.audioContent !== 'string' || !data.audioContent) return {status:502,json:{error:'Google returned no speech'}};
    return {status:200,json:{audio:data.audioContent,mime:'audio/mpeg',provider:'google',voice}};
  }catch(e){
    return {status:503,json:{error:'Google speech temporarily unavailable',provider:'google'}};
  }
}
