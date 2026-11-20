/* ==================================================================
   Munni's voice inside a jsdom window, for the tests (21 Nov 2026).

   Since PR #9 (Google speech) speak() never uses the phone's own voice:
   every line goes to Google TTS online (POST /api/tts), then the voice
   server's backup (POST <voice server>/reading/tts), then the recorded
   pack. A test can no longer listen at speechSynthesis, so this:

     · stands in for /api/tts — answers with a tiny clip, and keeps each
       request (ttsCalls) so a test can see what went online
     · stands in for Audio — play() works and the clip ends a moment
       later, so a screen that waits for Munni to finish moves on
     · records what Munni says (spoken), one entry per speak() call with
       the sound on — the same thing the old speechSynthesis stub recorded

   installVoice(w, spoken, { ms, tts }) in JSDOM's beforeParse:
     ms   how long a clip "plays" (default 5 ms)
     tts  false → /api/tts answers 503 (Google down): speech falls through
          to the backup and the pack, as on a phone with no Google
   ================================================================== */
function installVoice(w, spoken, opts){
  opts = opts || {};
  const ms = opts.ms == null ? 5 : opts.ms;
  const ttsCalls = [];
  const realFetch = w.fetch;
  w.fetch = function(url, init){
    if(/\/api\/tts(\?|$)/.test(String(url))){
      let body = {}; try{ body = JSON.parse(init && init.body || '{}'); }catch(e){}
      ttsCalls.push(body);
      if(opts.tts === false) return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ audio: 'SUQz', mime: 'audio/mpeg', provider: 'test' }) });
    }
    return realFetch ? realFetch.apply(this, arguments) : Promise.reject(new Error('no network in this test'));
  };
  w.Audio = function(src){
    this.src = src || ''; this.preload = ''; this.playbackRate = 1; this.paused = true;
    this.play = () => { this.paused = false; setTimeout(() => { if(!this.paused){ this.paused = true; if(this.onended) this.onended(); } }, ms); return Promise.resolve(); };
    this.pause = () => { this.paused = true; };
  };
  // what Munni says: wrap speak() once the app's scripts have defined it
  w.document.addEventListener('DOMContentLoaded', () => {
    const orig = w.speak;
    if(typeof orig !== 'function') return;
    w.speak = function(text){
      let muted = false; try{ muted = !!w.eval('S.muted'); }catch(e){}
      if(!muted && String(text == null ? '' : text).trim()) spoken.push(String(text).trim());
      return orig.apply(this, arguments);
    };
  });
  return { ttsCalls };
}

module.exports = { installVoice };
