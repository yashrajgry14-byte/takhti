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
