#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Partner — Deploy to Google Cloud Run
#
# Builds the Docker image with Cloud Build, pushes it to Artifact Registry,
# and deploys a new revision to Cloud Run. Secrets (DATABASE_URL, DIRECT_URL,
# AUTH_SECRET, ANTHROPIC_API_KEY) are read from Google Secret Manager.
#
# Usage:
#   ./scripts/deploy.sh                    # full deploy (migrate + build + deploy)
#   ./scripts/deploy.sh --skip-build       # just re-deploy the latest image
#   ./scripts/deploy.sh --skip-migrations  # deploy without touching the schema
#   ./scripts/deploy.sh --setup            # one-time GCP resource bootstrap
#
# Pending migrations are applied to production through the Cloud SQL proxy
# before anything is built, so a new revision never starts against a stale
# schema. Start the proxy first:
#   cloud-sql-proxy <project>:europe-west1:aipartner-postgres --port 5433
#
# Required env (override as needed):
#   GCP_PROJECT     — your GCP project id
#   GCP_REGION      — e.g. europe-west1
#   SERVICE_NAME    — Cloud Run service name (default: aipartner)
#   AR_REPO         — Artifact Registry repo name (default: ai-partner)
#   BUILD_MACHINE_TYPE — Cloud Build worker (default: e2-highcpu-8)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
GCP_PROJECT="${GCP_PROJECT:-}"
GCP_REGION="${GCP_REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-aipartner}"
AR_REPO="${AR_REPO:-ai-partner}"
BUILD_CONFIG="${BUILD_CONFIG:-cloudbuild.yaml}"
BUILD_MACHINE_TYPE="${BUILD_MACHINE_TYPE:-e2-highcpu-8}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"

# Every secret the running service may need. Missing ones are skipped, so it's
# safe to list secrets that only exist in some environments.
#
# IMPORTANT: this list must stay complete. Deploys attach secrets with
# `--update-secrets` (never `--set-secrets`), so anything omitted here is left
# untouched rather than deleted — but keeping it complete means a fresh service
# comes up fully configured.
SECRETS=(
  "DATABASE_URL"
  "DIRECT_URL"
  "AUTH_SECRET"
  "ANTHROPIC_API_KEY"
  "AUDIT_HMAC_KEY"
  "AUTH_GOOGLE_SECRET"
  "GOOGLE_CALENDAR_CLIENT_SECRET"
  "SMTP_PASS"
  # Bearer token Cloud Scheduler presents to /api/cron/*. Without it those
  # routes only trust localhost, so the nightly retention purge never runs.
  "CRON_SECRET"
)

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
say()  { printf "${CYN}▶ %s${NC}\n" "$*"; }
ok()   { printf "${GRN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YLW}! %s${NC}\n" "$*"; }
die()  { printf "${RED}✖ %s${NC}\n" "$*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────
command -v gcloud >/dev/null 2>&1 || die "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"

if [ -z "$GCP_PROJECT" ]; then
  GCP_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
  [ -n "$GCP_PROJECT" ] || die "GCP_PROJECT not set and no default project configured (run: gcloud config set project <id>)"
fi

IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/${SERVICE_NAME}:latest"

# Flags can appear in any order.
SKIP_BUILD=0
SKIP_MIGRATIONS=0
for arg in "$@"; do
  case "$arg" in
    --skip-build)      SKIP_BUILD=1 ;;
    --skip-migrations) SKIP_MIGRATIONS=1 ;;
    --setup)           ;;  # handled below
    *) die "Unknown argument: $arg" ;;
  esac
done

# ── One-time setup ───────────────────────────────────────────────────────────
if [ "${1:-}" = "--setup" ]; then
  say "Bootstrapping GCP resources for ${SERVICE_NAME} in ${GCP_PROJECT} / ${GCP_REGION}"

  say "Enabling required APIs"
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    --project="${GCP_PROJECT}"

  if ! gcloud artifacts repositories describe "${AR_REPO}" \
        --location="${GCP_REGION}" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
    say "Creating Artifact Registry repo: ${AR_REPO}"
    gcloud artifacts repositories create "${AR_REPO}" \
      --repository-format=docker \
      --location="${GCP_REGION}" \
      --project="${GCP_PROJECT}" \
      --description="AI Partner container images"
  else
    ok "Artifact Registry repo already exists"
  fi

  say "Creating secrets in Secret Manager (skips those that already exist)"
  for name in "${SECRETS[@]}"; do
    if gcloud secrets describe "$name" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
      ok "$name already exists"
    else
      warn "$name missing — create it with:"
      echo "    echo -n 'VALUE' | gcloud secrets create $name --data-file=- --project=${GCP_PROJECT}"
    fi
  done

  # Grant Cloud Run runtime SA access to the secrets.
  PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT}" --format='value(projectNumber)')"
  RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  say "Granting secretmanager.secretAccessor to ${RUNTIME_SA}"
  for name in "${SECRETS[@]}"; do
    if gcloud secrets describe "$name" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
      gcloud secrets add-iam-policy-binding "$name" \
        --member="serviceAccount:${RUNTIME_SA}" \
        --role="roles/secretmanager.secretAccessor" \
        --project="${GCP_PROJECT}" >/dev/null
    fi
  done
  ok "Setup complete. Create any missing secrets, then run ./scripts/deploy.sh"
  exit 0
fi

# ── Migrate ──────────────────────────────────────────────────────────────────
# Before the build, not after: if the schema can't be updated there is no point
# spending ten minutes building an image that depends on it.
if [ "${SKIP_MIGRATIONS}" -eq 1 ]; then
  warn "Skipping migrations (--skip-migrations)"
else
  say "Applying pending database migrations to production"
  GCP_PROJECT="${GCP_PROJECT}" ./scripts/migrate.sh --prod \
    || die "Migrations failed — nothing was built or deployed"
fi

# ── Build + push ─────────────────────────────────────────────────────────────
if [ "${SKIP_BUILD}" -eq 0 ]; then
  [ -f "${BUILD_CONFIG}" ] || die "Cloud Build config not found: ${BUILD_CONFIG}"
  say "Building image with Cloud Build (${BUILD_MACHINE_TYPE}, cached) → ${IMAGE_URI}"
  gcloud builds submit \
    --config="${BUILD_CONFIG}" \
    --substitutions="_IMAGE_URI=${IMAGE_URI},_CACHE_IMAGE=${IMAGE_LATEST}" \
    --machine-type="${BUILD_MACHINE_TYPE}" \
    --project="${GCP_PROJECT}" \
    --region="${GCP_REGION}" \
    --timeout=1200s \
    .

  say "Tagging as :latest"
  gcloud artifacts docker tags add "${IMAGE_URI}" "${IMAGE_LATEST}" \
    --project="${GCP_PROJECT}" >/dev/null || warn "Could not tag :latest (non-fatal)"
  ok "Image pushed"
else
  warn "Skipping build — will deploy ${IMAGE_LATEST}"
  IMAGE_URI="${IMAGE_LATEST}"
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
say "Deploying ${SERVICE_NAME} to Cloud Run (${GCP_REGION})"

# Assemble --set-secrets flag: SECRET_NAME=secret:latest,…
SECRETS_FLAG=""
for name in "${SECRETS[@]}"; do
  if gcloud secrets describe "$name" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
    SECRETS_FLAG+="${name}=${name}:latest,"
  else
    warn "Secret ${name} missing in Secret Manager — skipping"
  fi
done
SECRETS_FLAG="${SECRETS_FLAG%,}"  # trim trailing comma

DEPLOY_ARGS=(
  run deploy "${SERVICE_NAME}"
  --image="${IMAGE_URI}"
  --region="${GCP_REGION}"
  --project="${GCP_PROJECT}"
  --platform=managed
  --allow-unauthenticated
  --port=8080
  --cpu=1
  --memory=1Gi
  --min-instances=0
  --max-instances=10
  --concurrency=80
  --timeout=300
  # `--update-env-vars` / `--update-secrets` MERGE into the existing revision
  # config. Never use `--set-env-vars` / `--set-secrets` here: those REPLACE
  # the whole set and silently drop runtime config that was configured out of
  # band (EMAIL_PROVIDER/SMTP_*, AUTH_URL, OAuth client ids, …), which breaks
  # email delivery, password resets and Google sign-in.
  # GCS_BUCKET: private bucket for brief attachments, provisioned by
  # scripts/setup-storage.sh. Uploads are rejected with a clear message if it's
  # missing, so it must be part of every deploy.
  --update-env-vars="NODE_ENV=production,AUTH_TRUST_HOST=true,NEXT_TELEMETRY_DISABLED=1,GCS_BUCKET=${GCS_BUCKET:-aipartner-brief-attachments}"
)
[ -n "$SECRETS_FLAG" ] && DEPLOY_ARGS+=(--update-secrets="${SECRETS_FLAG}")

gcloud "${DEPLOY_ARGS[@]}"

URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${GCP_REGION}" --project="${GCP_PROJECT}" \
  --format='value(status.url)')"

ok "Deployed: ${URL}"
echo
echo "Next: set NEXTAUTH_URL / AUTH_URL if you use a custom domain."
