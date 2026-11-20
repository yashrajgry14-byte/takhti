#!/usr/bin/env bash
# Deploy Takhti's verified school-access branch into its own Cloud Run service.
# This NEVER deploys the live "takhti" service or uses its production bucket.
# Requires Google Cloud Shell access to project takhti-514811.
set -euo pipefail

export PROJECT=takhti-514811
export FIREBASE_PROJECT_ID=gen-lang-client-0604938251
export SERVICE=takhti-auth-staging
export BUCKET=takhti-514811-auth-test
export REGION=asia-south1

if [[ -z "${FIREBASE_WEB_API_KEY:-}" ]]; then
  read -rsp 'Firebase Web API key from Gemini Project 1: ' FIREBASE_WEB_API_KEY; echo
  export FIREBASE_WEB_API_KEY
fi
[[ -n "$FIREBASE_WEB_API_KEY" ]] || { echo 'Firebase API key required'; exit 2; }

if [[ -z "${TEACHER_UID:-}" ]]; then read -rp 'Firebase test teacher UID: ' TEACHER_UID; fi
if [[ -z "${GUARDIAN_UID:-}" ]]; then read -rp 'Firebase test guardian UID: ' GUARDIAN_UID; fi
[[ -n "$TEACHER_UID" && -n "$GUARDIAN_UID" && "$TEACHER_UID" != "$GUARDIAN_UID" ]] || {
  echo 'Two distinct Firebase test UIDs required'; exit 2;
}

gcloud config set project "$PROJECT"
echo 'Deploying ONLY takhti-auth-staging to its synthetic-data bucket...'
bash cloud/deploy.sh

# Idempotent: provision missing ACLs; preserve existing permissions unchanged.
provision() {
  local uid="$1" role="$2"
  local hash key
  hash="$(printf '%s' "$uid" | sha256sum | cut -d' ' -f1)"
  key="gs://$BUCKET/classes/access-$hash.json"
  if gcloud storage ls "$key" >/dev/null 2>&1; then
    echo "$role test ACL already exists; leaving it untouched."
  elif [[ "$role" == teacher ]]; then
    node tools/provision-class-access.mjs --bucket "$BUCKET" --uid "$uid" \
      --role teacher --school SCHOOL001 --class ABC123
  else
    node tools/provision-class-access.mjs --bucket "$BUCKET" --uid "$uid" \
      --role guardian --school SCHOOL001 --class ABC123 --child TESTCHILD01 \
      --consent-record TEST-ONLY-SYNTHETIC-NO-REAL-CONSENT
  fi
}
provision "$TEACHER_UID" teacher
provision "$GUARDIAN_UID" guardian

STAGING_URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
[[ "$STAGING_URL" == https://takhti-auth-staging-* ]] || { echo 'Unexpected staging URL'; exit 2; }
printf '\nStaging app: %s\n' "$STAGING_URL"
printf 'Only synthetic data is permitted in this test service.\n'
printf 'After entering test EMAIL/PASSWORD environment variables in Cloud Shell:\n'
printf '  node tools/smoke-school-auth.mjs --url %s\n' "$STAGING_URL"
