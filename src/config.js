/* ==================================================================
   Tier 2 endpoint.

   The browser must never hold an API key. api/ask.js is a serverless
   proxy that adds the key server-side; set window.TAKHTI_API in
   index.html to point at it.

   If this endpoint is missing or unreachable — running locally with no
   proxy, or genuinely offline — every caller falls back to the
   on-device pack. That is the whole architecture in one line: the
   cloud is optional, always.
   ================================================================== */
const API_URL = (typeof window !== 'undefined' && window.TAKHTI_API) || '/api/ask';

/* Talking Munni's voice server (voice/server.js). Empty means this build
   has no Talking Munni at all: the parent toggle and the Pond button never
   appear. Even when set, it is off for every child until a parent turns it
   on — the child's voice leaves the phone while they talk. */
const TALK_URL = ((typeof window !== 'undefined' && window.TAKHTI_VOICE) || '').replace(/\/$/, '');

/* Teach Appu's judge when this build has no voice server: the host's own
   function (api/teachback.mjs on Netlify, served at /api/teachback). It
   takes words only — typed, or written down by the phone's own recognizer —
   never a recording, and only under the words terms a parent accepts
   (ui/teach-munni.js). Unreachable (a dev server with no functions) → the
   phone's own rubric judges, as offline. */
const TEACH_URL = ((typeof window !== 'undefined' && window.TAKHTI_TEACH) || '/api/teachback');
