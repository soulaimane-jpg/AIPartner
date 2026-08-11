#!/usr/bin/env bash
PROJ=aipartner-starting-project

echo "=== verify www cert (NO -k = real trusted cert; forced LB IP) ==="
curl -s -o /dev/null -w "https://www.aipartner.cloud code=%{http_code} ip=%{remote_ip}\n" \
  --resolve www.aipartner.cloud:443:34.13.122.98 "https://www.aipartner.cloud/auth/sign-in" --max-time 20 \
  || echo "www https NOT trusted yet"

echo "=== poll apex cert until ACTIVE ==="
for i in $(seq 1 9); do
  APEX=$(gcloud compute ssl-certificates describe aipartner-apex-cert --global --project="$PROJ" --format="value(managed.status)" 2>/dev/null)
  echo "[$i $(date +%H:%M:%S)] apex=$APEX"
  if [ "$APEX" = "ACTIVE" ]; then echo "APEX_ACTIVE"; break; fi
  [ "$i" -lt 9 ] && sleep 50
done

echo "=== verify apex cert (NO -k; forced LB IP) ==="
curl -s -o /dev/null -w "https://aipartner.cloud code=%{http_code} ip=%{remote_ip}\n" \
  --resolve aipartner.cloud:443:34.13.122.98 "https://aipartner.cloud/auth/sign-in" --max-time 20 \
  || echo "apex https NOT trusted yet"
