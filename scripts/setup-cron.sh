#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cloud Scheduler setup for the /api/cron/* jobs.
#
# Why this exists: the cron routes were written for Vercel Cron, but this app
# runs on Cloud Run. Nothing was ever triggering them, so the GDPR retention
# purge (art. 5(1)(e) storage limitation) had never executed in production.
#
# Idempotent — safe to re-run. Creates the CRON_SECRET secret if missing, then
# creates-or-updates one scheduler job per cron route.
#
# Run AFTER a deploy, so the service already has CRON_SECRET injected.
#
# Usage:
#   GCP_PROJECT=aipartner-starting-project ./scripts/setup-cron.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-aipartner-starting-project}"
GCP_REGION="${GCP_REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-aipartner}"
# All schedules are UTC and deliberately off-peak.
TIMEZONE="${TIMEZONE:-Etc/UTC}"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
say()  { printf "${CYN}▶ %s${NC}\n" "$*"; }
ok()   { printf "${GRN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YLW}! %s${NC}\n" "$*"; }
die()  { printf "${RED}✖ %s${NC}\n" "$*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud not found"

say "Enabling Cloud Scheduler API (no-op if already enabled)"
gcloud services enable cloudscheduler.googleapis.com --project="${GCP_PROJECT}"

# ── CRON_SECRET ──────────────────────────────────────────────────────────────
# The cron routes fall back to "localhost only" when this is unset, which means
# a scheduler call from outside would 401.
if gcloud secrets describe CRON_SECRET --project="${GCP_PROJECT}" >/dev/null 2>&1; then
  ok "CRON_SECRET already exists"
else
  say "Creating CRON_SECRET"
  # 32 random bytes, url-safe. Must be >= 16 chars to satisfy env validation.
  openssl rand -hex 32 | tr -d '\n' \
    | gcloud secrets create CRON_SECRET \
        --project="${GCP_PROJECT}" \
        --replication-policy=automatic \
        --data-file=-
  ok "CRON_SECRET created"
  warn "Re-deploy so the service picks it up: ./scripts/deploy.sh --skip-build"
fi

SECRET_VALUE="$(gcloud secrets versions access latest --secret=CRON_SECRET --project="${GCP_PROJECT}")"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${GCP_REGION}" --project="${GCP_PROJECT}" \
  --format='value(status.url)')"
[ -n "${SERVICE_URL}" ] || die "Could not resolve Cloud Run URL for ${SERVICE_NAME}"
say "Target service: ${SERVICE_URL}"

# ── Jobs ─────────────────────────────────────────────────────────────────────
# name|path|cron schedule|description
JOBS=(
  "aipartner-retention|/api/cron/retention|0 3 * * *|GDPR retention purge (nightly 03:00 UTC)"
  "aipartner-timers|/api/cron/timers|*/15 * * * *|Expire due timers (every 15 min)"
  "aipartner-jobs|/api/cron/jobs|*/10 * * * *|Drain background job queue (every 10 min)"
  "aipartner-digest|/api/cron/digest|0 7 * * 1|Weekly partner digest (Mondays 07:00 UTC)"
  "aipartner-partner-freshness|/api/cron/partner-freshness|0 4 * * 2|Queue quarterly partner profile re-scrapes (Tuesdays 04:00 UTC)"
)

for entry in "${JOBS[@]}"; do
  IFS='|' read -r name path schedule description <<<"${entry}"
  uri="${SERVICE_URL}${path}"

  # `create` fails if the job exists, so branch on describe rather than
  # relying on an --upsert flag (Cloud Scheduler has none).
  if gcloud scheduler jobs describe "${name}" \
       --location="${GCP_REGION}" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
    say "Updating ${name} (${schedule})"
    gcloud scheduler jobs update http "${name}" \
      --location="${GCP_REGION}" \
      --project="${GCP_PROJECT}" \
      --schedule="${schedule}" \
      --time-zone="${TIMEZONE}" \
      --uri="${uri}" \
      --http-method=GET \
      --update-headers="Authorization=Bearer ${SECRET_VALUE}" \
      --attempt-deadline=600s \
      --description="${description}" >/dev/null
  else
    say "Creating ${name} (${schedule})"
    gcloud scheduler jobs create http "${name}" \
      --location="${GCP_REGION}" \
      --project="${GCP_PROJECT}" \
      --schedule="${schedule}" \
      --time-zone="${TIMEZONE}" \
      --uri="${uri}" \
      --http-method=GET \
      --headers="Authorization=Bearer ${SECRET_VALUE}" \
      --attempt-deadline=600s \
      --description="${description}" >/dev/null
  fi
  ok "${name} → ${path}"
done

echo
ok "Scheduler configured. Verify with:"
echo "  gcloud scheduler jobs list --location=${GCP_REGION} --project=${GCP_PROJECT}"
echo "  gcloud scheduler jobs run aipartner-retention --location=${GCP_REGION} --project=${GCP_PROJECT}"
