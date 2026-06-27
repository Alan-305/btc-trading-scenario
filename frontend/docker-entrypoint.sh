#!/bin/sh
set -e

if [ -z "$API_UPSTREAM" ]; then
  echo "API_UPSTREAM is required (e.g. https://btc-trading-api-xxx.run.app)" >&2
  exit 1
fi

export API_UPSTREAM
export FIREBASE_AUTH_UPSTREAM="${FIREBASE_AUTH_UPSTREAM:-nexus-btc-trading.firebaseapp.com}"
envsubst '${API_UPSTREAM} ${FIREBASE_AUTH_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
