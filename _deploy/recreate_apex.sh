#!/usr/bin/env bash
# The original aipartner-apex-cert was created BEFORE DNS pointed at the LB, so
# it is stuck in FAILED_NOT_VISIBLE on a slow retry. DNS is now correct, so
# recreate it fresh to force immediate validation (as the www cert did).
set -euo pipefail
PROJ=aipartner-starting-project

echo "=== create fresh apex cert (DNS now -> LB) ==="
gcloud compute ssl-certificates create aipartner-apex-cert2 \
  --domains=aipartner.cloud --global --project="$PROJ"

echo "=== swap proxy certs: sslip + www + NEW apex (drops stuck apex) ==="
gcloud compute target-https-proxies update aipartner-https-proxy \
  --ssl-certificates=aipartner-cert,aipartner-www-cert,aipartner-apex-cert2 \
  --global --project="$PROJ"

echo "=== delete stuck old apex cert ==="
gcloud compute ssl-certificates delete aipartner-apex-cert --global --project="$PROJ" --quiet

echo "=== new apex cert status ==="
gcloud compute ssl-certificates describe aipartner-apex-cert2 --global --project="$PROJ" \
  --format="value(managed.status, managed.domainStatus)"
echo "=== DONE ==="
