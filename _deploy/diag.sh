#!/usr/bin/env bash
PROJ=aipartner-starting-project
REGION=europe-west1

echo "===== Cloud Run ingress ====="
gcloud run services describe aipartner --region="$REGION" --project="$PROJ" \
  --format="value(metadata.annotations[run.googleapis.com/ingress])" 2>&1

echo
echo "===== Cloud Run URL + traffic ====="
gcloud run services describe aipartner --region="$REGION" --project="$PROJ" \
  --format="value(status.url)" 2>&1

echo
echo "===== domain mappings ($REGION) ====="
gcloud run domain-mappings list --region="$REGION" --project="$PROJ" 2>&1

echo
echo "===== LB forwarding rules ====="
gcloud compute forwarding-rules list --global --project="$PROJ" \
  --format="table(name,IPAddress,portRange)" 2>&1

echo
echo "===== ssl cert ====="
gcloud compute ssl-certificates describe aipartner-cert --global --project="$PROJ" \
  --format="value(managed.status, managed.domains)" 2>&1

echo
echo "===== sslip.io LB check ====="
curl -s -o /dev/null -w "sslip.io/auth/sign-in code=%{http_code}\n" \
  "https://34.13.122.98.sslip.io/auth/sign-in" --max-time 25 2>&1
