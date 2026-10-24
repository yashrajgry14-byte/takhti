/* ==================================================================
   OFFLINE STT — honest status: NOT built yet.

   The real destination is a bundled WASM recognizer (Vosk,
   vosk-model-small-hi-0.22, ~42MB) that takes over when WebSpeech has
   no connection to talk to — WebSpeech is cloud STT on every browser
   that ships it, so "offline" and "no recognizer" are the same
   situation today. That is a real model-loading, real-audio-pipeline
   build, not something to fake here.

   An earlier version of this file pretended otherwise: it opened the
   microphone, buffered real PCM audio into an array, and never fed
   that buffer to anything — onResult() was never called. A child
   reading offline would tap the mic and simply never be graded, with
   no error, no message, and (see core/speech.js's old fallback logic)
   no way to stop the stuck turn either. A working "type it instead"
   beats a silently hanging microphone, so core/speech.js's listen()
   now detects "no recognizer available" itself and says so plainly
   via micReason() — see there. This file no longer pretends to
   listen; isVoskReady() stays false until a real engine is wired in.

   When that build happens, wire the real ready-check in behind
   isVoskReady() and add a real listenVosk(onResult, onEnd) that
   actually calls onResult() with a transcript — core/speech.js's
   listen() already asks "is an offline recognizer available?" before
   trying to use one, so nothing else needs to change to plug it in.
   ================================================================== */
function isVoskReady(){
  return false;
}
