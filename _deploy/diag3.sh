#!/usr/bin/env bash
PROJ=aipartner-starting-project

echo "===== authoritative NS for aipartner.cloud ====="
dig +short NS aipartner.cloud

echo "===== A @ via Google DNS (8.8.8.8) ====="
dig +short A aipartner.cloud @8.8.8.8
echo "===== A www via Google DNS (8.8.8.8) ====="
dig +short A www.aipartner.cloud @8.8.8.8
echo "===== A @ via Cloudflare DNS (1.1.1.1) ====="
dig +short A aipartner.cloud @1.1.1.1
echo "===== AAAA @ (should be EMPTY) ====="
dig +short AAAA aipartner.cloud @8.8.8.8

echo "===== cert statuses ====="
gcloud compute ssl-certificates describe aipartner-apex-cert --global --project="$PROJ" --format="value(managed.status, managed.domainStatus)" 2>&1
gcloud compute ssl-certificates describe aipartner-www-cert --global --project="$PROJ" --format="value(managed.status, managed.domainStatus)" 2>&1

echo "===== HTTP -> HTTPS redirect (DNS->LB path) ====="
curl -s -o /dev/null -w "http://aipartner.cloud code=%{http_code} redirect=%{redirect_url} ip=%{remote_ip}\n" "http://aipartner.cloud" --max-time 20
curl -s -o /dev/null -w "http://www.aipartner.cloud code=%{http_code} redirect=%{redirect_url} ip=%{remote_ip}\n" "http://www.aipartner.cloud" --max-time 20

echo "===== HTTPS (no -k: passes only when cert ACTIVE+trusted) ====="
curl -s -o /dev/null -w "https://aipartner.cloud code=%{http_code} ip=%{remote_ip}\n" "https://aipartner.cloud" --max-time 20 || echo "https apex: TLS not ready yet"
