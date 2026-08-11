#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Partner — apply pending SQL migrations.
#
# Applied migrations are recorded in the `_migration` table, so each file runs
# exactly once. Re-running this script is a no-op when nothing is pending.
#
# Why tracked rather than "just re-run everything": today's migrations happen to
# be idempotent, but that's a property of the files, not a guarantee. One
# non-idempotent migration (a data backfill, a column rename) would silently
# corrupt production the second time it ran. The tracking table makes that
# impossible instead of relying on everyone remembering the convention.
#
# Connection, in order of preference:
#   1. $MIGRATE_DATABASE_URL          — explicit override, used as-is
#   2. $DATABASE_URL from .env        — local development
#   3. DATABASE_URL from Secret Manager, with the Cloud SQL unix socket
#      rewritten to the local proxy (production)
#
# Usage:
#   ./scripts/migrate.sh                # apply pending migrations
#   ./scripts/migrate.sh --dry-run      # list what would be applied
#   ./scripts/migrate.sh --prod         # target production via the proxy
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

GCP_PROJECT="${GCP_PROJECT:-aipartner-starting-project}"
PROXY_HOST="${PROXY_HOST:-127.0.0.1}"
PROXY_PORT="${PROXY_PORT:-5433}"
MIGRATIONS_DIR="db/migrations"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
say()  { printf "${CYN}▶ %s${NC}\n" "$*"; }
ok()   { printf "${GRN}✔ %s${NC}\n" "$*"; }
warn() { printf "${YLW}! %s${NC}\n" "$*"; }
die()  { printf "${RED}✖ %s${NC}\n" "$*" >&2; exit 1; }

DRY_RUN=0
USE_PROD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --prod)    USE_PROD=1 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

command -v psql >/dev/null || die "psql not found (brew install libpq)"

# ── Resolve the connection string ────────────────────────────────────────────
resolve_url() {
  if [ -n "${MIGRATE_DATABASE_URL:-}" ]; then
    echo "${MIGRATE_DATABASE_URL}"
    return
  fi

  if [ "${USE_PROD}" -eq 1 ]; then
    local secret
    secret="$(gcloud secrets versions access latest \
      --secret=DATABASE_URL --project="${GCP_PROJECT}" 2>/dev/null)" \
      || die "Could not read DATABASE_URL from Secret Manager"

    # Production connects over a Cloud SQL unix socket (?host=/cloudsql/…),
    # which only exists inside Cloud Run. Swap it for the local proxy so the
    # same credentials work from a developer machine.
    node -e '
      const u = new URL(process.argv[1]);
      u.searchParams.delete("host");
      u.hostname = process.argv[2];
      u.port = process.argv[3];
      u.search = u.searchParams.toString();
      process.stdout.write(u.toString());
    ' "${secret}" "${PROXY_HOST}" "${PROXY_PORT}"
    return
  fi

  [ -f .env ] || die "No .env found and --prod not passed"
  # shellcheck disable=SC1091
  set -a; source .env; set +a
  [ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL not set in .env"
  # Strip query params (sslmode, pgbouncer flags) that psql rejects.
  echo "${DATABASE_URL%%\?*}"
}

DB_URL="$(resolve_url)"

if [ "${USE_PROD}" -eq 1 ]; then
  # Fail fast with a useful instruction rather than a psql connection timeout.
  nc -z "${PROXY_HOST}" "${PROXY_PORT}" 2>/dev/null || die \
    "Cloud SQL proxy not reachable on ${PROXY_HOST}:${PROXY_PORT}. Start it with:
    cloud-sql-proxy ${GCP_PROJECT}:europe-west1:aipartner-postgres --port ${PROXY_PORT}"
  warn "Targeting PRODUCTION via ${PROXY_HOST}:${PROXY_PORT}"
fi

psql "${DB_URL}" -c 'SELECT 1' >/dev/null 2>&1 || die "Cannot connect to the database"

# ── Tracking table ───────────────────────────────────────────────────────────
psql "${DB_URL}" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS "_migration" (
  "filename"   text PRIMARY KEY,
  "checksum"   text NOT NULL,
  "appliedAt"  timestamptz NOT NULL DEFAULT NOW()
);
SQL

# ── Apply pending migrations ─────────────────────────────────────────────────
shopt -s nullglob
FILES=("${MIGRATIONS_DIR}"/*.sql)
[ ${#FILES[@]} -gt 0 ] || { ok "No migration files found"; exit 0; }

APPLIED=0
PENDING=0

for file in "${FILES[@]}"; do
  name="$(basename "$file")"
  checksum="$(shasum -a 256 "$file" | awk '{print $1}')"

  recorded="$(psql "${DB_URL}" -t -A -c \
    "SELECT \"checksum\" FROM \"_migration\" WHERE \"filename\" = '${name}'")"

  if [ -n "${recorded}" ]; then
    if [ "${recorded}" != "${checksum}" ]; then
      # The file changed after being applied. Editing an applied migration means
      # environments have silently diverged, so refuse rather than guess.
      die "${name} was already applied but its contents changed.
    Applied checksum: ${recorded}
    Current checksum: ${checksum}
    Create a new migration instead of editing an applied one."
    fi
    continue
  fi

  PENDING=$((PENDING + 1))

  if [ "${DRY_RUN}" -eq 1 ]; then
    echo "  would apply: ${name}"
    continue
  fi

  say "Applying ${name}"
  # Single transaction per migration: a failure rolls the file back completely
  # and leaves it unrecorded, so a retry starts from a clean state.
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -q --single-transaction \
    -f "$file" \
    -c "INSERT INTO \"_migration\" (\"filename\", \"checksum\") VALUES ('${name}', '${checksum}')" \
    || die "${name} failed — nothing was committed"

  ok "Applied ${name}"
  APPLIED=$((APPLIED + 1))
done

echo
if [ "${DRY_RUN}" -eq 1 ]; then
  ok "${PENDING} migration(s) pending"
elif [ "${APPLIED}" -eq 0 ]; then
  ok "Schema up to date — nothing to apply"
else
  ok "Applied ${APPLIED} migration(s)"
fi
