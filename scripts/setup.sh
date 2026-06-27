#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Creating .env from .env.example (if missing)"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env"
else
  echo "    .env already exists — skipped"
fi

echo "==> Backend: Python venv + dependencies"
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "==> Frontend: npm dependencies"
cd "$ROOT/frontend"
npm install

echo "==> Frontend: .env.local"
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
# Empty = use Vite dev proxy (/api -> localhost:8000)
VITE_API_BASE_URL=
EOF
  echo "    Created frontend/.env.local"
else
  echo "    frontend/.env.local already exists — skipped"
fi

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Edit .env and add API keys (COINGLASS_API_KEY, etc.) if needed"
echo "  2. make redis          # start Redis"
echo "  3. make dev            # API  http://localhost:8000"
echo "  4. make frontend-dev   # UI   http://localhost:5173"
echo ""
echo "Or run everything: make dev-all"
