#!/usr/bin/env bash
# Add www.aipartner.cloud as its own managed cert and attach all three certs
# (sslip.io, apex, www) to the HTTPS proxy. Separate single-domain certs so one
# domain's validation can't block another's.
set -euo pipefail
PROJ=aipartner-starting-project

echo "=== create managed cert for www.aipartner.cloud ==="
gcloud compute ssl-certificates create aipartner-www-cert \
  --domains=www.aipartner.cloud --global --project="$PROJ"

echo "=== attach all certs to the HTTPS proxy ==="
gcloud compute target-https-proxies update aipartner-https-proxy \
  --ssl-certificates=aipartner-cert,aipartner-apex-cert,aipartner-www-cert \
  --global --project="$PROJ"

echo "=== DONE ==="
