#!/usr/bin/env bash
# Add invite for Google sign-in (no email/password user). Usage:
#   ./scripts/firebase-add-user.sh user@example.com --invite-only
# Or create email/password user (legacy):
#   ./scripts/firebase-add-user.sh user@example.com [--send-reset]
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"
EMAIL="${1:?email required}"
INVITE_ONLY=false
SEND_RESET=false
PASSWORD=""

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --invite-only) INVITE_ONLY=true ;;
    --send-reset) SEND_RESET=true ;;
    *) PASSWORD="$1" ;;
  esac
  shift || true
done

EMAIL_LOWER=$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]')

save_invite() {
  ACCESS_TOKEN=$(gcloud auth print-access-token)
  DOC_ID=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$EMAIL_LOWER")
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  curl -s -X PATCH \
    "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/invites/${DOC_ID}?updateMask.fieldPaths=email&updateMask.fieldPaths=invitedAt" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"fields\":{\"email\":{\"stringValue\":\"${EMAIL_LOWER}\"},\"invitedAt\":{\"timestampValue\":\"${NOW}\"}}}" \
    | python3 -c '
import json, sys
resp = json.load(sys.stdin)
if "error" in resp:
    print(json.dumps(resp, indent=2), file=sys.stderr)
    sys.exit(1)
print("Invite saved:", resp.get("name", ""))
'
}

if [[ "$INVITE_ONLY" == "true" ]]; then
  save_invite
  echo "Invited (Google sign-in): $EMAIL_LOWER"
  exit 0
fi

API_KEY=$(firebase apps:sdkconfig WEB 1:295064774233:web:6ef8ee4b2483e64ce07348 --project="$PROJECT_ID" 2>/dev/null \
  | python3 -c 'import json,sys; raw=sys.stdin.read(); print(json.loads(raw[raw.find("{"):])["apiKey"])')

if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$(openssl rand -base64 18)"
  SEND_RESET=true
fi

RESP=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL_LOWER}\",\"password\":\"${PASSWORD}\",\"returnSecureToken\":true}")

if echo "$RESP" | grep -q '"error"'; then
  CODE=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("error",{}).get("message",""))')
  if [[ "$CODE" != "EMAIL_EXISTS" ]]; then
    echo "$RESP" | python3 -m json.tool
    exit 1
  fi
  echo "Auth user already exists: $EMAIL_LOWER"
else
  echo "Created auth user: $EMAIL_LOWER"
fi

save_invite

if [[ "$SEND_RESET" == "true" ]]; then
  RESET=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"requestType\":\"PASSWORD_RESET\",\"email\":\"${EMAIL_LOWER}\"}")
  if echo "$RESET" | grep -q '"error"'; then
    echo "$RESET" | python3 -m json.tool
    exit 1
  fi
  echo "Password reset email sent to: $EMAIL_LOWER"
fi
