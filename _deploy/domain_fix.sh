#!/usr/bin/env bash
# Re-point the custom domain aipartner.cloud away from the (incompatible) Cloud
# Run domain mapping and onto the external HTTPS Load Balancer + Cloud Armor.
set -euo pipefail
PROJ=aipartner-starting-project
REGION=europe-west1

echo "=== delete Cloud Run domain mapping aipartner.cloud (bypasses LB/Cloud Armor, blocked by locked ingress) ==="
gcloud beta run domain-mappings delete --domain=aipartner.cloud --region="$REGION" --project="$PROJ" --quiet

echo "=== create Google-managed cert for aipartner.cloud (will PROVISION until DNS -> LB IP) ==="
gcloud compute ssl-certificates create aipartner-apex-cert --domains=aipartner.cloud --global --project="$PROJ"

echo "=== attach both certs (sslip.io + aipartner.cloud) to the HTTPS proxy ==="
gcloud compute target-https-proxies update aipartner-https-proxy \
  --ssl-certificates=aipartner-cert,aipartner-apex-cert --global --project="$PROJ"

echo "=== DONE ==="
