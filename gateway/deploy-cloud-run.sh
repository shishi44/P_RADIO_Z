#!/usr/bin/env bash
set -Eeuo pipefail

# P_RADIO_Z Image Gateway - Cloud Run deployment helper
#
# Run from Google Cloud Shell after cloning the repository:
#   PROJECT_ID="your-project-id" \
#   DRIVE_ALLOWED_FOLDER_ID="your-form-file-responses-folder-id" \
#   ./gateway/deploy-cloud-run.sh
#
# Optional:
#   REGION=asia-northeast1
#   SERVICE_NAME=p-radio-z-image-gateway
#   SERVICE_ACCOUNT_NAME=p-radio-z-gateway
#   ALLOWED_ORIGINS=https://shishi44.github.io
#   ROTATE_ACCESS_TOKEN=1
#   TEST_FILE_ID=<Drive file id>

PROJECT_ID="${PROJECT_ID:-${1:-}}"
DRIVE_ALLOWED_FOLDER_ID="${DRIVE_ALLOWED_FOLDER_ID:-${2:-}}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-p-radio-z-image-gateway}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-p-radio-z-gateway}"
SECRET_NAME="${SECRET_NAME:-p-radio-z-access-token}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://shishi44.github.io}"
ROTATE_ACCESS_TOKEN="${ROTATE_ACCESS_TOKEN:-0}"
TEST_FILE_ID="${TEST_FILE_ID:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${OUTPUT_FILE:-$HOME/p-radio-z-gateway-deploy.txt}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_command gcloud
require_command openssl
require_command curl

[[ -n "$PROJECT_ID" ]] || fail "PROJECT_ID is required."
[[ -n "$DRIVE_ALLOWED_FOLDER_ID" ]] || fail "DRIVE_ALLOWED_FOLDER_ID is required."
[[ "$DRIVE_ALLOWED_FOLDER_ID" =~ ^[A-Za-z0-9_-]{10,}$ ]] || fail "DRIVE_ALLOWED_FOLDER_ID format is invalid."
[[ "$SERVICE_NAME" =~ ^[a-z]([-a-z0-9]{0,47}[a-z0-9])?$ ]] || fail "SERVICE_NAME must be a valid Cloud Run service name (max 49 chars)."
[[ "$SERVICE_ACCOUNT_NAME" =~ ^[a-z]([-a-z0-9]{4,28}[a-z0-9])$ ]] || fail "SERVICE_ACCOUNT_NAME must be a valid service account id."

printf '\n== P_RADIO_Z Cloud Run deployment ==\n'
printf 'Project: %s\nRegion: %s\nService: %s\n' "$PROJECT_ID" "$REGION" "$SERVICE_NAME"

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud projects describe "$PROJECT_ID" >/dev/null

printf '\n[1/6] Enabling required APIs...\n'
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  drive.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
[[ -n "$PROJECT_NUMBER" ]] || fail "Could not resolve project number."
SA_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

printf '\n[2/6] Preparing runtime service account...\n'
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --project "$PROJECT_ID" \
    --display-name="P_RADIO_Z Image Gateway" \
    --description="Read-only runtime identity for P_RADIO_Z Cloud Run image gateway"
fi

printf '\n[3/6] Preparing access-token secret...\n'
if ! gcloud secrets describe "$SECRET_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET_NAME" \
    --project "$PROJECT_ID" \
    --replication-policy="automatic"
  ROTATE_ACCESS_TOKEN=1
fi

if [[ "$ROTATE_ACCESS_TOKEN" == "1" ]]; then
  ACCESS_TOKEN="$(openssl rand -hex 32)"
  printf '%s' "$ACCESS_TOKEN" | gcloud secrets versions add "$SECRET_NAME" \
    --project "$PROJECT_ID" \
    --data-file=- >/dev/null
else
  ACCESS_TOKEN=""
fi

SECRET_VERSION="$(
  gcloud secrets versions list "$SECRET_NAME" \
    --project "$PROJECT_ID" \
    --filter='state=ENABLED' \
    --sort-by='~createTime' \
    --limit=1 \
    --format='value(name)' | awk -F/ '{print $NF}'
)"
[[ -n "$SECRET_VERSION" ]] || fail "No enabled Secret Manager version found."

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

printf '\n[4/6] Preparing source-build identity...\n'
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
if gcloud iam service-accounts describe "$BUILD_SA" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/run.builder" \
    --condition=None \
    --quiet >/dev/null
fi

printf '\n[5/6] Deploying Cloud Run service from gateway/ source...\n'
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source "$SCRIPT_DIR" \
  --service-account "$SA_EMAIL" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 60 \
  --set-env-vars="DRIVE_ALLOWED_FOLDER_ID=${DRIVE_ALLOWED_FOLDER_ID},ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  --set-secrets="P_RADIO_ACCESS_TOKEN=${SECRET_NAME}:${SECRET_VERSION}" \
  --quiet

SERVICE_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --format='value(status.url)'
)"
[[ -n "$SERVICE_URL" ]] || fail "Cloud Run service URL was not returned."

printf '\n[6/6] Health check...\n'
curl --fail --silent --show-error --max-time 20 "${SERVICE_URL}/healthz" >/dev/null

if [[ -z "$ACCESS_TOKEN" ]]; then
  ACCESS_TOKEN="$(gcloud secrets versions access "$SECRET_VERSION" --secret "$SECRET_NAME" --project "$PROJECT_ID")"
fi

umask 077
cat > "$OUTPUT_FILE" <<OUT
GATEWAY_URL=${SERVICE_URL}
P_RADIO_ACCESS_TOKEN=${ACCESS_TOKEN}
SERVICE_ACCOUNT=${SA_EMAIL}
DRIVE_ALLOWED_FOLDER_ID=${DRIVE_ALLOWED_FOLDER_ID}
REGION=${REGION}
PROJECT_ID=${PROJECT_ID}
OUT
chmod 600 "$OUTPUT_FILE"

printf '\nDeployment completed.\n'
printf 'Gateway URL: %s\n' "$SERVICE_URL"
printf 'Runtime service account: %s\n' "$SA_EMAIL"
printf 'Private deployment handoff: %s\n' "$OUTPUT_FILE"
printf '\nIMPORTANT: Share the Google Forms "File responses" root folder with the runtime service account as Viewer.\n'

if [[ -n "$TEST_FILE_ID" ]]; then
  printf '\nTesting Drive image endpoint for %s...\n' "$TEST_FILE_ID"
  TEST_OUTPUT="${TMPDIR:-/tmp}/p-radio-z-gateway-test.webp"
  if curl --fail --silent --show-error --max-time 30 \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${SERVICE_URL}/v1/images/${TEST_FILE_ID}?variant=thumb" \
    -o "$TEST_OUTPUT"; then
    printf 'Image endpoint OK: %s\n' "$TEST_OUTPUT"
  else
    printf 'Image endpoint is not ready yet. Confirm the Drive folder is shared with %s as Viewer, then rerun the curl test.\n' "$SA_EMAIL" >&2
  fi
fi
