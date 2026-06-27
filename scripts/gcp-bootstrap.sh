#!/usr/bin/env bash
# One-time GCP setup for nexus-btc-trading (secrets, APIs, Artifact Registry).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-nexus-btc-trading}"
REGION="${GCP_REGION:-asia-northeast1}"
REPOSITORY="${GCP_ARTIFACT_REPO:-btc-trading}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

echo "==> Project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

echo "==> Artifact Registry: $REPOSITORY"
if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="BTC Trading Scenario containers"
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

upsert_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  skip empty secret: $name"
    return
  fi
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
    echo "  updated secret: $name"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=-
    echo "  created secret: $name"
  fi
}

# Cloud Run secret mounts require at least one version (empty values are rejected).
upsert_optional_secret() {
  local name="$1"
  local value="$2"
  upsert_secret "$name" "${value:--}"
}

read_env() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo ""
    return
  fi
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true
}

echo "==> Secrets (from .env where present)"
GEMINI_KEY="$(read_env GEMINI_API_KEY)"
COINGLASS_KEY="$(read_env COINGLASS_API_KEY)"
INTERNAL_TOKEN="$(read_env INTERNAL_COLLECT_TOKEN)"

if [[ -z "$GEMINI_KEY" ]]; then
  echo "ERROR: GEMINI_API_KEY missing in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "$INTERNAL_TOKEN" ]]; then
  INTERNAL_TOKEN="$(openssl rand -hex 32)"
  echo "  generated INTERNAL_COLLECT_TOKEN (stored in Secret Manager)"
fi

upsert_secret "GEMINI_API_KEY" "$GEMINI_KEY"
upsert_optional_secret "COINGLASS_API_KEY" "$COINGLASS_KEY"
upsert_secret "INTERNAL_COLLECT_TOKEN" "$INTERNAL_TOKEN"

echo "==> Firebase web config (for Cloud Build frontend)"
FIREBASE_APP_ID="1:295064774233:web:6ef8ee4b2483e64ce07348"
FIREBASE_JSON="$(firebase apps:sdkconfig WEB "$FIREBASE_APP_ID" --project="$PROJECT_ID" 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read()
start = raw.find("{")
if start < 0:
    sys.exit(1)
data = json.loads(raw[start:])
print(json.dumps({
  "apiKey": data["apiKey"],
  "authDomain": data["authDomain"],
  "projectId": data["projectId"],
  "storageBucket": data["storageBucket"],
  "messagingSenderId": data["messagingSenderId"],
  "appId": data["appId"],
}))
' || true)"

if [[ -z "$FIREBASE_JSON" && -f "${ROOT}/frontend/.env.local" ]]; then
  FIREBASE_JSON="$(python3 - "${ROOT}/frontend/.env.local" <<'PY'
import json, pathlib, sys
env = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip()
mapping = {
    "apiKey": "VITE_FIREBASE_API_KEY",
    "authDomain": "VITE_FIREBASE_AUTH_DOMAIN",
    "projectId": "VITE_FIREBASE_PROJECT_ID",
    "storageBucket": "VITE_FIREBASE_STORAGE_BUCKET",
    "messagingSenderId": "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "appId": "VITE_FIREBASE_APP_ID",
}
out = {k: env[v] for k, v in mapping.items() if env.get(v)}
if len(out) != len(mapping):
    sys.exit(1)
print(json.dumps(out))
PY
)"
fi

if [[ -z "$FIREBASE_JSON" ]]; then
  echo "ERROR: could not resolve Firebase web config (firebase CLI or frontend/.env.local)" >&2
  exit 1
fi
upsert_secret "FIREBASE_WEB_CONFIG" "$FIREBASE_JSON"

echo "==> Cloud Build service account: Secret Manager access"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
for SECRET in GEMINI_API_KEY COINGLASS_API_KEY INTERNAL_COLLECT_TOKEN FIREBASE_WEB_CONFIG; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${CB_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
done

RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for SECRET in GEMINI_API_KEY COINGLASS_API_KEY INTERNAL_COLLECT_TOKEN FIREBASE_WEB_CONFIG; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:${RUN_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
done

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/firebaseauth.admin" \
  --quiet >/dev/null

echo "==> Cloud Build: Run admin (deploy to Cloud Run)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet >/dev/null

echo ""
echo "Bootstrap complete."
echo "Deploy with: gcloud builds submit --config=infra/cloudbuild.yaml ."
