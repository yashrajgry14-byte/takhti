/* ==================================================================
   Tier 2 proxy — keeps the Anthropic key on the server.

   Works as-is on Vercel (api/ask.js) and Netlify (with the
   netlify.toml redirect below). Set ANTHROPIC_API_KEY in the host's
   environment variables — never in the repo.

   If this function is absent, the app still runs: every caller
   catches the failure and falls back to the on-device content pack.
   ================================================================== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'No key configured' });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.TAKHTI_MODEL || 'claude-sonnet-5',
        max_tokens: 1000,
        messages: req.body.messages
      })
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Upstream unavailable' });
  }
}
