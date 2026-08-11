#!/usr/bin/env bash
PROJ=aipartner-starting-project
for i in $(seq 1 8); do
  APEX=$(gcloud compute ssl-certificates describe aipartner-apex-cert --global --project="$PROJ" --format="value(managed.status)" 2>/dev/null)
  WWW=$(gcloud compute ssl-certificates describe aipartner-www-cert --global --project="$PROJ" --format="value(managed.status)" 2>/dev/null)
  echo "[$i $(date +%H:%M:%S)] apex=$APEX www=$WWW"
  if [ "$APEX" = "ACTIVE" ] && [ "$WWW" = "ACTIVE" ]; then echo "BOTH_ACTIVE"; break; fi
  [ "$i" -lt 8 ] && sleep 50
done
