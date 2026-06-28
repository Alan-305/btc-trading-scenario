.PHONY: setup redis redis-brew redis-down dev dev-all test lint docker-up docker-down frontend-dev frontend-build gcp-bootstrap gcp-deploy firebase-deploy

GCP_PROJECT_ID ?= nexus-btc-trading

setup:
	chmod +x scripts/setup.sh
	./scripts/setup.sh

# Redis（任意）— Docker または Homebrew。なくても CACHE_BACKEND=auto で動作します
redis:
	@if command -v docker >/dev/null 2>&1; then \
		docker compose up redis -d; \
	elif command -v brew >/dev/null 2>&1; then \
		if brew list redis >/dev/null 2>&1; then \
			brew services start redis; \
			echo "Redis started via Homebrew"; \
		else \
			echo "Redis not installed. Options:"; \
			echo "  brew install redis && make redis"; \
			echo "  or skip Redis — API works with in-memory cache (CACHE_BACKEND=auto)"; \
			exit 1; \
		fi; \
	else \
		echo "Docker / Homebrew not found."; \
		echo "Skip Redis — run 'make dev' directly (in-memory cache is used)."; \
		exit 1; \
	fi

redis-brew:
	brew install redis
	brew services start redis

redis-down:
	@if command -v docker >/dev/null 2>&1 && docker compose ps redis 2>/dev/null | grep -q Up; then \
		docker compose stop redis; \
	elif command -v brew >/dev/null 2>&1; then \
		brew services stop redis 2>/dev/null || true; \
	fi

dev:
	cd backend && . .venv/bin/activate 2>/dev/null || true; \
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-all:
	@echo "Redis is optional (CACHE_BACKEND=auto uses in-memory if Redis is down)."
	@echo ""
	@echo "Terminal 1: make dev          → http://localhost:8000/docs"
	@echo "Terminal 2: make frontend-dev → http://localhost:5173"
	@echo ""
	@echo "Optional: make redis  (Docker or Homebrew)"

test:
	cd backend && pytest -v

lint:
	cd backend && python -m compileall app

docker-up:
	docker compose up --build

docker-down:
	docker compose down

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

gcp-bootstrap:
	GCP_PROJECT_ID=$(GCP_PROJECT_ID) ./scripts/gcp-bootstrap.sh

# GCP Cloud Run API + Firebase Hosting（本番 web.app は Hosting が配信元）
gcp-deploy:
	gcloud builds submit --config=infra/cloudbuild.yaml --project=$(GCP_PROJECT_ID) .
	$(MAKE) firebase-deploy

firebase-deploy:
	GCP_PROJECT_ID=$(GCP_PROJECT_ID) ./scripts/firebase-deploy-hosting.sh
