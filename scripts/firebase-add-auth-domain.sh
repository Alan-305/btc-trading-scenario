#!/usr/bin/env bash
# Add Cloud Run frontend URL to Firebase authorized domains.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE="${FRONTEND_SERVICE:-btc-trading-frontend}"

URL=$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')
HOST=$(echo "$URL" | sed -E 's#https?://##')

echo "Adding authorized domain: $HOST"
ACCESS_TOKEN=$(gcloud auth print-access-token)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

CONFIG=$(curl -s \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_NUMBER}/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID")

if echo "$CONFIG" | grep -q "\"$HOST\""; then
  echo "Already authorized: $HOST"
  exit 0
fi

DOMAINS=$(echo "$CONFIG" | python3 -c "
import json, sys
host = sys.argv[1]
config = json.load(sys.stdin)
domains = config.get('authorizedDomains', [])
if host not in domains:
    domains.append(host)
print(json.dumps(domains))
" "$HOST")

curl -s -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_NUMBER}/config?updateMask=authorizedDomains" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d "{\"authorizedDomains\": $DOMAINS}" | python3 -c "
import json, sys
resp = json.load(sys.stdin)
if 'error' in resp:
    print(json.dumps(resp, indent=2), file=sys.stderr)
    sys.exit(1)
print('Authorized:', sys.argv[1])
" "$HOST"
