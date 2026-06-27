# BTC Trading Scenario

BTC price prediction and trading scenario web application.

## Stack

- **Frontend**: React (Vite) + Tailwind CSS + Recharts
- **Backend**: Python FastAPI
- **Infra**: GCP Cloud Run, Redis, Cloud Scheduler

## Quick start

```bash
# Backend (local)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# With Docker Compose (API + Redis)
docker compose up --build

# Frontend
cd frontend
npm install
npm run dev

# Tests
cd backend && pytest
```

## API

- `GET /health` — health check
- `GET /api/v1/market/snapshot` — multi-exchange market snapshot
- `GET /api/v1/indicators/sentiment` — Fear & Greed index
- `GET /api/v1/scenario` — trading scenario (ML + LLM)
- `POST /api/v1/internal/collect` — trigger data collection (scheduler)

See [docs/api-contract.md](docs/api-contract.md) for JSON contracts.

## Disclaimer

This application provides market analysis for informational purposes only. It is not investment advice.
