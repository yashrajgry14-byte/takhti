#!/usr/bin/env bash
# Takhti → Google Cloud Run, from Google Cloud Shell (shell.cloud.google.com).
# Run from the repo folder:   bash cloud/deploy.sh
# Safe to run again: it only creates what isn't there yet, then redeploys.
set -euo pipefail

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-south1}"          # Mumbai
SERVICE="${SERVICE:-takhti}"
SECRET="gemini-api-key"
BUCKET="${BUCKET:-${PROJECT}-takhti-classes}"
[ -n "$PROJECT" ] || { echo "No project. Run: gcloud config set project YOUR_PROJECT_ID"; exit 1; }
echo "Project $PROJECT · region $REGION · service $SERVICE"

echo "1/5 Turning on Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Storage…"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com texttospeech.googleapis.com --project "$PROJECT"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"   # the identity Cloud Run runs as

echo "2/5 The Gemini key, in Secret Manager (never in the code or the image)…"
if ! gcloud secrets describe "$SECRET" --project "$PROJECT" >/dev/null 2>&1; then
  printf 'Paste your Gemini API key and press Enter (it will not be shown): '
  read -rs KEY; echo
  [ -n "$KEY" ] || { echo "No key given."; exit 1; }
  printf '%s' "$KEY" | gcloud secrets create "$SECRET" --data-file=- --replication-policy=automatic --project "$PROJECT" >/dev/null
  unset KEY
  echo "   saved."
else
  echo "   already there (to change it: gcloud secrets versions add $SECRET --data-file=-)"
fi
gcloud secrets add-iam-policy-binding "$SECRET" --project "$PROJECT" \
  --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor >/dev/null

echo "3/5 A private Cloud Storage bucket for class sync ($BUCKET)…"
if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null

echo "4/5 Letting Cloud Build build the container…"
for ROLE in roles/run.builder roles/logging.logWriter roles/artifactregistry.writer roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" --condition=None >/dev/null 2>&1 || true
done

echo "5/5 Building and deploying (a few minutes the first time)…"
# Firebase Authentication must be configured separately. Never silently
# treat the parent PIN or a class code as an identity. Unconfigured sync fails closed.
# The models: drafting starts on flash-lite (Hydrogen as drafting's first
# model hung for over a minute on 20 Nov); Teach Appu's judge starts on
# Hydrogen (3–4.5 s). Override any of them by exporting it before running.
# --update-env-vars (not --set-env-vars) so a redeploy keeps every variable
# already set on the service by hand. Values are joined with "@" (gcloud's
# ^@^ delimiter) because GEMINI_FALLBACK_MODEL may itself be a comma list.
ENV_VARS="TAKHTI_SYNC_BUCKET=${BUCKET}"
ENV_VARS="${ENV_VARS}@GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.5-flash-lite}"
ENV_VARS="${ENV_VARS}@GEMINI_FALLBACK_MODEL=${GEMINI_FALLBACK_MODEL:-gemini-4-hydrogen}"
ENV_VARS="${ENV_VARS}@TAKHTI_TEACH_MODEL=${TAKHTI_TEACH_MODEL:-gemini-4-hydrogen}"
if [ -n "${FIREBASE_PROJECT_ID:-}" ] && [ -n "${FIREBASE_WEB_API_KEY:-}" ]; then
  ENV_VARS="${ENV_VARS}@FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}@FIREBASE_WEB_API_KEY=${FIREBASE_WEB_API_KEY}"
fi
gcloud run deploy "$SERVICE" --source . --project "$PROJECT" --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets "GEMINI_API_KEY=${SECRET}:latest" \
  --update-env-vars "^@^${ENV_VARS}" \
  --timeout 300 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
echo
echo "Takhti is live: $URL"
echo "Check:          $URL/health    (should say gemini: true, sync: true)"
