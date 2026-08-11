#!/usr/bin/env bash
PROJ=aipartner-starting-project
echo "=== apex cert detail ==="
gcloud compute ssl-certificates describe aipartner-apex-cert --global --project="$PROJ" \
  --format="yaml(managed.status, managed.domainStatus, creationTimestamp)"
echo "=== www cert detail ==="
gcloud compute ssl-certificates describe aipartner-www-cert --global --project="$PROJ" \
  --format="yaml(managed.status, managed.domainStatus)"
echo "=== certs attached to HTTPS proxy ==="
gcloud compute target-https-proxies describe aipartner-https-proxy --global --project="$PROJ" \
  --format="value(sslCertificates)"
echo "=== Cloud Run domain mappings (expect NONE for aipartner.cloud) ==="
gcloud beta run domain-mappings list --region=europe-west1 --project="$PROJ" 2>&1 | head -20
echo "=== authoritative NS: apex A ==="
dig +short A aipartner.cloud @dns1.registrar-servers.com
echo "=== authoritative NS: apex AAAA (expect empty) ==="
dig +short AAAA aipartner.cloud @dns1.registrar-servers.com
echo "=== CAA on apex (must allow pki.goog / be empty) ==="
dig +short CAA aipartner.cloud @8.8.8.8
echo "=== CAA on parent zone .cloud-level (informational) ==="
dig +short CAA cloud @8.8.8.8
