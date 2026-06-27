#!/usr/bin/env bash
# Add Cloud Run origin to Firebase Google OAuth client (redirect + JS origin).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"
PROJECT_NUMBER="${GCP_PROJECT_NUMBER:-295064774233}"
FRONTEND_HOST="${FRONTEND_HOST:-btc-trading-frontend-ajjblismxa-an.a.run.app}"
ORIGIN="https://${FRONTEND_HOST}"
REDIRECT="${ORIGIN}/__/auth/handler"

echo "==> Enable clientauthconfig API"
gcloud services enable clientauthconfig.googleapis.com --project="$PROJECT_ID" --quiet 2>/dev/null || true

ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "==> List OAuth brands"
BRANDS=$(curl -s \
  "https://clientauthconfig.googleapis.com/v1/projects/${PROJECT_NUMBER}/brands" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}")

BRAND_NAME=$(echo "$BRANDS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
brands = data.get('brands', [])
if not brands:
    sys.exit(1)
print(brands[0]['name'])
" 2>/dev/null || true)

if [[ -z "$BRAND_NAME" ]]; then
  echo "No OAuth brand found. Running firebase deploy --only auth..."
  cd "$(dirname "$0")/.."
  firebase deploy --only auth --project="$PROJECT_ID"
  BRANDS=$(curl -s \
    "https://clientauthconfig.googleapis.com/v1/projects/${PROJECT_NUMBER}/brands" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")
  BRAND_NAME=$(echo "$BRANDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['brands'][0]['name'])")
fi

echo "Brand: $BRAND_NAME"

echo "==> List OAuth clients"
CLIENTS=$(curl -s \
  "https://clientauthconfig.googleapis.com/v1/${BRAND_NAME}/clients" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}")

CLIENT_NAME=$(echo "$CLIENTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
clients = data.get('clients', [])
if not clients:
    sys.exit(1)
# Prefer web client auto-created by Google Service
for c in clients:
    if 'Web client' in c.get('displayName', '') or c.get('clientType') == 'WEB':
        print(c['name'])
        sys.exit(0)
print(clients[0]['name'])
")

echo "Client: $CLIENT_NAME"

echo "==> Fetch current client config"
CURRENT=$(curl -s \
  "https://clientauthconfig.googleapis.com/v1/${CLIENT_NAME}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}")

python3 - "$CURRENT" "$ORIGIN" "$REDIRECT" "$ACCESS_TOKEN" "$PROJECT_ID" <<'PY'
import json, sys, urllib.request

current = json.loads(sys.argv[1])
origin, redirect = sys.argv[2], sys.argv[3]
token, project = sys.argv[4], sys.argv[5]
client_name = current["name"]

origins = list(current.get("javascriptOrigins", []) or [])
redirects = list(current.get("redirectUris", []) or [])

changed = False
if origin not in origins:
    origins.append(origin)
    changed = True
if redirect not in redirects:
    redirects.append(redirect)
    changed = True

if not changed:
    print("Already configured:", origin)
    sys.exit(0)

body = json.dumps({
    "javascriptOrigins": origins,
    "redirectUris": redirects,
}).encode()

req = urllib.request.Request(
    f"https://clientauthconfig.googleapis.com/v1/{client_name}?updateMask=javascriptOrigins,redirectUris",
    data=body,
    headers={
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": project,
        "Content-Type": "application/json",
    },
    method="PATCH",
)
with urllib.request.urlopen(req) as resp:
    updated = json.load(resp)
print("Updated origins:", updated.get("javascriptOrigins"))
print("Updated redirects:", updated.get("redirectUris"))
PY

echo "Done."
