#!/usr/bin/env bash
# Register Cloud Run URL as OAuth JavaScript origin (required for Google popup sign-in).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"
FRONTEND_HOST="${FRONTEND_HOST:-btc-trading-frontend-ajjblismxa-an.a.run.app}"
ORIGIN="https://${FRONTEND_HOST}"

echo "Adding OAuth JavaScript origin: $ORIGIN"

cd "$(dirname "$0")/.."
firebase deploy --only auth --project="$PROJECT_ID" 2>&1 | tail -5

echo ""
echo "If login still fails, open GCP Console and add this origin manually:"
echo "  https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"
echo "  → Web client (auto created by Google Service)"
echo "  → Authorized JavaScript origins → Add: $ORIGIN"
echo "  → Authorized redirect URIs → Add: ${ORIGIN}/__/auth/handler"
