#!/usr/bin/env bash
PROJ=aipartner-starting-project
for i in $(seq 1 12); do
  S=$(gcloud compute ssl-certificates describe aipartner-apex-cert2 --global --project="$PROJ" --format="value(managed.status)" 2>/dev/null)
  D=$(gcloud compute ssl-certificates describe aipartner-apex-cert2 --global --project="$PROJ" --format="value(managed.domainStatus)" 2>/dev/null)
  echo "[$i $(date +%H:%M:%S)] status=$S domain=$D"
  if [ "$S" = "ACTIVE" ]; then echo "APEX_ACTIVE"; break; fi
  [ "$i" -lt 12 ] && sleep 55
done
echo "=== curl verify apex (NO -k, forced LB IP) ==="
curl -s -o /dev/null -w "apex https code=%{http_code} ip=%{remote_ip}\n" \
  --resolve aipartner.cloud:443:34.13.122.98 "https://aipartner.cloud/auth/sign-in" --max-time 20 \
  || echo "apex not trusted yet"
