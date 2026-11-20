# Takhti on Google Cloud Run

One Cloud Run service (`cloud/server.mjs`, no dependencies) serves the app
and the Gemini endpoints the app already calls on its own origin:

| path | what | Google Cloud |
|------|------|--------------|
| `/` and the app's files | the app (works offline after the first visit) | Cloud Run |
| `POST /api/syllabus` | a chapter → Gemini drafts the week's lessons; the phone checks them | Gemini API, key in Secret Manager |
| `POST /api/teachback` | Teach Appu's judge, on words only | Gemini API |
| `POST /api/class-sync` | the class between phones | a private Cloud Storage bucket, reached with Cloud Run's own identity (no key file) |
| `GET /health` | `{ gemini, sync }` (Cloud Run reserves `/healthz` for itself) — is each set up? | |

Only a whitelist is ever served (`index.html`, `sw.js`, the manifest,
`src/`, `icons/`, `audio/`) — never `voice/`, `api/`, the notes or a `.env`.
`test/cloud.test.js` checks that, and the rest, over HTTP.

The voice server (`voice/`: Bolna calls, the reading check, Talking Munni)
is not part of this service — it keeps state in files and needs its own
secrets. This deploy is the app, lesson drafting, Teach Appu's judge and
class sync.

## Deploy (about 10 minutes, from a browser)

You need a Google Cloud project with **billing on**, and your Gemini API key.

1. Open **https://shell.cloud.google.com** (signed in with the Google account
   that owns the project).
2. Get the code:
   ```bash
   git clone https://github.com/yashrajgry14-byte/takhti.git
   cd takhti
   ```
   (While the repo is private, `git clone` asks for your GitHub username and a
   personal access token as the password — or make the repo public first.)
3. Pick the project and deploy:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   bash cloud/deploy.sh
   ```
   It asks for the Gemini key once (nothing shows as you paste it) and keeps
   it in Secret Manager. It turns on the APIs it needs, makes the bucket, gives
   Cloud Run's identity access to just the key and the bucket, builds the
   container and deploys to Mumbai (`asia-south1`). At the end it prints the
   link.
4. Open `LINK/health` — it should say `"gemini":true,"sync":true` — then the
   link itself on a phone.

To ship a new version: `git pull && bash cloud/deploy.sh`. A redeploy keeps
every variable already set on the service (it uses `--update-env-vars`), and
sets the models: drafting on `gemini-3.5-flash-lite` then `gemini-4-hydrogen`,
Teach Appu's judge on `gemini-4-hydrogen`. To pick others, export
`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` or `TAKHTI_TEACH_MODEL` before running.

## If something goes wrong

- **"billing account … not found / disabled"**: turn billing on for the
  project (Console → Billing), then run the script again.
- **"allUsers … violates organization policy"**: your account's organization
  blocks public services. Use a personal Google account's project, or ask the
  org admin to allow it.
- **Build fails with a permission error on the service account**: run the
  script again (new roles take a minute to apply). If it still fails, in the
  Console open Cloud Build → Settings and turn on the Cloud Run Admin and
  Service Account User roles.
- **`/health` says `gemini:false`**: the secret didn't attach; run the script
  again.

## Cost

Cloud Run with no traffic costs nothing (`--min-instances 0`); a demo stays in
the free tier. Gemini calls are billed to the key's own project. The bucket
holds one small JSON file per class.

## Online speech (Google first)

Takhti now requests speech from `POST /api/tts` for both Hindi and English.
Cloud Run authenticates to Cloud Text-to-Speech using its service account
(no browser key); the deployment script enables `texttospeech.googleapis.com`.
The selected voices are `hi-IN-Chirp3-HD-Kore` and
`en-IN-Chirp3-HD-Kore`. Existing Sarvam/ElevenLabs backup logic remains in
the separate voice service (`POST /reading/tts`) and is tried if Google
fails **when `window.TAKHTI_VOICE` points at that running service**.
Otherwise the app tries prerecorded Google narration. Browser TTS (including
Microsoft Heera) is not used.

Test the server from Cloud Shell after deployment:

```bash
curl -sS -X POST "$URL/api/tts" -H 'Content-Type: application/json' \
  -d '{"text":"नमस्ते!","lang":"hi"}' |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("provider"), d.get("voice"), len(d.get("audio","")), d.get("error",""))'
```

The endpoint is public like the app; it applies a simple per-instance
IP-based throttle and a 240-character request limit. For production scale,
use centralized rate limiting, budget alerts and abuse controls. Test
both Indian locales under your Cloud project and confirm pricing and quotas.
