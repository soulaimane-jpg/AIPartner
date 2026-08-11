#!/usr/bin/env bash
PROJ=aipartner-starting-project
REGION=europe-west1
LBIP=34.13.122.98

echo "===== DNS: aipartner.cloud (A) ====="
dig +short aipartner.cloud A @8.8.8.8

echo "===== DNS: aipartner.cloud (AAAA) ====="
dig +short aipartner.cloud AAAA @8.8.8.8

echo "===== DNS: aipartner.cloud (CNAME) ====="
dig +short aipartner.cloud CNAME @8.8.8.8

echo "===== DNS: www.aipartner.cloud ====="
dig +short www.aipartner.cloud @8.8.8.8

echo "===== DNS: app.aipartner.cloud ====="
dig +short app.aipartner.cloud @8.8.8.8

echo "===== Expected LB IP ====="
echo "$LBIP"

echo "===== Cloud Run domain mappings ====="
gcloud beta run domain-mappings list --region="$REGION" --project="$PROJ" 2>&1

echo "===== LB reserved IP ====="
gcloud compute addresses describe aipartner-lb-ip --global --project="$PROJ" --format="value(address)" 2>&1

echo "===== SSL cert (status + domains) ====="
gcloud compute ssl-certificates describe aipartner-cert --global --project="$PROJ" --format="value(managed.status, managed.domains)" 2>&1

echo "===== curl http://aipartner.cloud (-> where?) ====="
curl -s -o /dev/null -w "code=%{http_code} redirect=%{redirect_url} ip=%{remote_ip}\n" "http://aipartner.cloud" --max-time 20 2>&1

echo "===== curl https://aipartner.cloud (cert?) ====="
curl -s -o /dev/null -w "code=%{http_code} ip=%{remote_ip}\n" "https://aipartner.cloud" --max-time 20 2>&1
echo "--- with -k (ignore cert) ---"
curl -sk -o /dev/null -w "code=%{http_code} ip=%{remote_ip}\n" "https://aipartner.cloud" --max-time 20 2>&1
