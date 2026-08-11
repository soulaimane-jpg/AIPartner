#!/usr/bin/env bash
PROJ=aipartner-starting-project
for i in $(seq 1 10); do
  APEX=$(gcloud compute ssl-certificates describe aipartner-apex-cert --global --project="$PROJ" --format="value(managed.status)" 2>/dev/null)
  echo "[$i $(date +%H:%M:%S)] apex=$APEX"
  if [ "$APEX" = "ACTIVE" ]; then echo "APEX_ACTIVE"; break; fi
  [ "$i" -lt 10 ] && sleep 55
done
echo "=== curl verify (NO -k) both hosts forced to LB IP ==="
curl -s -o /dev/null -w "apex  https code=%{http_code} ip=%{remote_ip}\n" --resolve aipartner.cloud:443:34.13.122.98 "https://aipartner.cloud/auth/sign-in" --max-time 20 || echo "apex not trusted yet"
curl -s -o /dev/null -w "www   https code=%{http_code} ip=%{remote_ip}\n" --resolve www.aipartner.cloud:443:34.13.122.98 "https://www.aipartner.cloud/auth/sign-in" --max-time 20 || echo "www not trusted yet"
