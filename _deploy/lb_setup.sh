#!/usr/bin/env bash
# Provisions the external HTTPS Application Load Balancer that fronts the
# Cloud Run service `aipartner`, terminating TLS with a Google-managed cert for
# a <ip>.sslip.io hostname and enforcing the `aipartner-armor` Cloud Armor
# policy. Idempotent-ish: re-running will error on already-created resources.
set -euo pipefail

PROJ=aipartner-starting-project
REGION=europe-west1
DOMAIN="${1:?pass the sslip.io domain, e.g. 34.13.122.98.sslip.io}"

echo "=== backend service ==="
gcloud compute backend-services create aipartner-backend \
  --global --load-balancing-scheme=EXTERNAL_MANAGED --project="$PROJ"

echo "=== add serverless NEG backend ==="
gcloud compute backend-services add-backend aipartner-backend \
  --global --network-endpoint-group=aipartner-neg \
  --network-endpoint-group-region="$REGION" --project="$PROJ"

echo "=== attach Cloud Armor policy ==="
gcloud compute backend-services update aipartner-backend \
  --security-policy=aipartner-armor --global --project="$PROJ"

echo "=== url map ==="
gcloud compute url-maps create aipartner-urlmap \
  --default-service=aipartner-backend --global --project="$PROJ"

echo "=== managed ssl cert ($DOMAIN) ==="
gcloud compute ssl-certificates create aipartner-cert \
  --domains="$DOMAIN" --global --project="$PROJ"

echo "=== target https proxy ==="
gcloud compute target-https-proxies create aipartner-https-proxy \
  --url-map=aipartner-urlmap --ssl-certificates=aipartner-cert \
  --global --project="$PROJ"

echo "=== https forwarding rule (443) ==="
gcloud compute forwarding-rules create aipartner-https-fr \
  --address=aipartner-lb-ip --target-https-proxy=aipartner-https-proxy \
  --ports=443 --global --load-balancing-scheme=EXTERNAL_MANAGED --project="$PROJ"

echo "=== ALL LB RESOURCES CREATED ==="
