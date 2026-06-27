#!/usr/bin/env bash
# Google sign-in is enabled via firebase.json + firebase deploy --only auth
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"

echo "Google ログインは firebase deploy --only auth で有効化済みです。"
echo "Console: https://console.firebase.google.com/project/${PROJECT_ID}/authentication/providers"
echo ""
echo "招待ユーザーを追加: ./scripts/firebase-add-user.sh email@example.com --invite-only"
