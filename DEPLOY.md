# Deploying AI Partner to Cloud Run

Production deployment uses **Cloud Build → Artifact Registry → Cloud Run**. Secrets (DB URLs, Auth secret, Anthropic key) are stored in **Secret Manager** and mounted as env vars at runtime.

## Prerequisites

- `gcloud` CLI installed and authenticated: `gcloud auth login`
- A GCP project with billing enabled
- Supabase database already provisioned (connection strings in hand)

## 1) One-time setup

```bash
export GCP_PROJECT=your-project-id
export GCP_REGION=europe-west1  # any Cloud Run region

./scripts/deploy.sh --setup
```

This enables Cloud Run / Cloud Build / Artifact Registry / Secret Manager APIs, creates the `ai-partner` Artifact Registry repo, and prints which secrets you still need to create.

### Create the secrets

```bash
echo -n "postgresql://postgres.<ref>:<pw>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1" \
  | gcloud secrets create DATABASE_URL --data-file=- --project=$GCP_PROJECT

echo -n "postgresql://postgres.<ref>:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" \
  | gcloud secrets create DIRECT_URL --data-file=- --project=$GCP_PROJECT

openssl rand -base64 48 \
  | gcloud secrets create AUTH_SECRET --data-file=- --project=$GCP_PROJECT

echo -n "sk-ant-…" \
  | gcloud secrets create ANTHROPIC_API_KEY --data-file=- --project=$GCP_PROJECT
```

Then run `./scripts/deploy.sh --setup` **once more** so it grants the Cloud Run runtime service account access to each secret.

## 2) Deploy

```bash
./scripts/deploy.sh
```

This will:
1. Pull the previous `:latest` image as a Docker layer cache, then build on an `e2-highcpu-8` Cloud Build worker using `cloudbuild.yaml`
2. Push the new image to `europe-west1-docker.pkg.dev/$GCP_PROJECT/ai-partner/aipartner:<timestamp>`
3. Tag the same image as `:latest`
4. Deploy a new Cloud Run revision with secrets mounted as env vars
5. Print the service URL

### Re-deploy the last image (no rebuild)

```bash
./scripts/deploy.sh --skip-build
```

## 3) Schema migrations

When you change `prisma/schema.prisma`, run migrations **from your laptop** against the Supabase direct URL (Cloud Run containers are read-only and short-lived):

```bash
npx prisma db push         # prototype — push schema directly
# or
npx prisma migrate deploy  # production — apply committed migrations
```

## Config overrides

| Env var | Default | Purpose |
|---|---|---|
| `GCP_PROJECT` | from `gcloud config` | Target project |
| `GCP_REGION` | `europe-west1` | Cloud Run region |
| `SERVICE_NAME` | `ai-partner` | Cloud Run service name |
| `AR_REPO` | `ai-partner` | Artifact Registry repo |
| `BUILD_CONFIG` | `cloudbuild.yaml` | Cached Docker build configuration |
| `BUILD_MACHINE_TYPE` | `e2-highcpu-8` | Valid Cloud Build worker type; override to trade build speed for cost |
| `IMAGE_TAG` | `YYYYMMDD-HHMMSS` | Image tag |

Example:

```bash
SERVICE_NAME=ai-partner-staging GCP_REGION=us-central1 ./scripts/deploy.sh
```

## Custom domain + auth URL

After adding a custom domain in Cloud Run (Domain Mappings), set the public URL so NextAuth generates correct callback URLs:

```bash
gcloud run services update ai-partner \
  --region=$GCP_REGION \
  --update-env-vars=AUTH_URL=https://app.your-domain.com
```

## Local Docker test

```bash
docker build -t ai-partner:local .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgresql://…:6543/postgres?pgbouncer=true&connection_limit=1" \
  -e DIRECT_URL="postgresql://…:5432/postgres" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_TRUST_HOST=true \
  ai-partner:local
```

Then visit http://localhost:8080.
