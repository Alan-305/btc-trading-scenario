.PHONY: dev test lint docker-up docker-down

dev:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	cd backend && pytest -v

docker-up:
	docker compose up --build

docker-down:
	docker compose down

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build
