#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Provision the private Cloud Storage bucket used for brief attachments.
#
# Idempotent — safe to re-run.
#
# Usage:
#   GCP_PROJECT=aipartner-starting-project ./scripts/setup-storage.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-aipartner-starting-project}"
# Co-located with Cloud Run: keeps uploads off the public internet and keeps
# EU customer data in the EU.
GCP_REGION="${GCP_REGION:-europe-west1}"
BUCKET="${GCS_BUCKET:-aipartner-brief-attachments}"
SERVICE_NAME="${SERVICE_NAME:-aipartner}"
# Backstop for the DB-driven retention job. Matches the BriefAttachment TTL in
# src/lib/jobs/retention.ts, so an object orphaned by a failed row-delete still
# disappears on schedule.
LIFECYCLE_DAYS="${LIFECYCLE_DAYS:-730}"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
say()  { printf "${CYN}▶ %s${NC}\n" "$*"; }
ok()   { printf "${GRN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YLW}! %s${NC}\n" "$*"; }
die()  { printf "${RED}✖ %s${NC}\n" "$*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud not found"

# ── Bucket ───────────────────────────────────────────────────────────────────
if gcloud storage buckets describe "gs://${BUCKET}" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
  ok "Bucket gs://${BUCKET} already exists"
else
  say "Creating private bucket gs://${BUCKET} in ${GCP_REGION}"
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="${GCP_PROJECT}" \
    --location="${GCP_REGION}" \
    --uniform-bucket-level-access \
    --public-access-prevention
  ok "Bucket created"
fi

# Re-assert on every run: these are the settings that keep customer uploads
# private, so they should never drift.
say "Enforcing uniform access + public access prevention"
gcloud storage buckets update "gs://${BUCKET}" \
  --project="${GCP_PROJECT}" \
  --uniform-bucket-level-access \
  --public-access-prevention >/dev/null
ok "Private access enforced"

# ── Lifecycle ────────────────────────────────────────────────────────────────
say "Applying ${LIFECYCLE_DAYS}-day lifecycle rule"
LIFECYCLE_FILE="$(mktemp)"
cat >"${LIFECYCLE_FILE}" <<JSON
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": ${LIFECYCLE_DAYS} }
    }
  ]
}
JSON
gcloud storage buckets update "gs://${BUCKET}" \
  --project="${GCP_PROJECT}" \
  --lifecycle-file="${LIFECYCLE_FILE}" >/dev/null
rm -f "${LIFECYCLE_FILE}"
ok "Lifecycle rule applied"

# ── IAM ──────────────────────────────────────────────────────────────────────
SA="$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${GCP_REGION}" --project="${GCP_PROJECT}" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [ -z "${SA}" ]; then
  PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT}" --format='value(projectNumber)')"
  SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  warn "Falling back to default compute SA: ${SA}"
fi

say "Granting objectAdmin on the bucket to ${SA}"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --project="${GCP_PROJECT}" \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectAdmin" >/dev/null
ok "Bucket access granted"

# NOTE: no signing role is needed. Downloads are streamed through the app
# (see openDownloadStream in src/lib/storage/gcs.ts) rather than served via V4
# signed URLs, so the service account never has to impersonate itself.
# objectAdmin above is the whole permission surface.

echo
ok "Storage ready. Add this to the Cloud Run service:"
echo "  GCS_BUCKET=${BUCKET}"
echo
echo "Local development:"
echo "  gcloud auth application-default login"
echo "  echo 'GCS_BUCKET=${BUCKET}' >> .env"
