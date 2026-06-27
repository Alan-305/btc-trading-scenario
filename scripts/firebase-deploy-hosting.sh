#!/usr/bin/env bash
# Build frontend and deploy to Firebase Hosting (Google OAuth works on web.app).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo "==> Firebase web config"
FB_JSON=$(firebase apps:sdkconfig WEB 1:295064774233:web:6ef8ee4b2483e64ce07348 --project="$PROJECT_ID" 2>/dev/null \
  | python3 -c 'import json,sys; raw=sys.stdin.read(); print(raw[raw.find("{"):])')

export VITE_API_BASE_URL=""
export VITE_FIREBASE_API_KEY=$(echo "$FB_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['apiKey'])")
export VITE_FIREBASE_AUTH_DOMAIN=$(echo "$FB_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['authDomain'])")
export VITE_FIREBASE_PROJECT_ID=$(echo "$FB_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['projectId'])")
export VITE_FIREBASE_STORAGE_BUCKET=$(echo "$FB_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['storageBucket'])")
export VITE_FIREBASE_MESSAGING_SENDER_ID=$(echo "$FB_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['messagingSenderId'])")
export VITE_FIREBASE_APP_ID=$(echo "$FB_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['appId'])")
export VITE_INVITE_ONLY=true
export VITE_ALLOWED_EMAILS=matsuo@nexus-learning.com
export VITE_AUTH_OPEN_GOOGLE=true

echo "==> Build frontend"
cd frontend && npm run build

echo "==> Deploy Firebase Hosting"
cd "$ROOT"
firebase deploy --only hosting --project="$PROJECT_ID"

echo ""
echo "Login URL: https://nexus-btc-trading.web.app"
