# Runbook

## Local development

```bash
docker compose up --build
# API: http://localhost:8000
# Redis: localhost:6379
```

## Cloud Run deployment

1. Set GCP project and enable APIs: Cloud Run, Cloud Build, Secret Manager, Cloud Scheduler
2. Store secrets: `COINGLASS_API_KEY`, `INTERNAL_COLLECT_TOKEN`, `GEMINI_API_KEY`
3. Deploy via `infra/cloudbuild.yaml`
4. Configure Cloud Scheduler:
   - Target: `POST https://<api-url>/api/v1/internal/collect`
   - Schedule: `*/1 * * * *` (every minute)
   - Auth: OIDC or `X-Internal-Token` header

## Monitoring

- Health: `GET /health`
- Logs: Cloud Logging JSON (structlog)
- Alert on: collector failure rate, Redis connection errors, 5xx rate

## Incident response

1. Check `/api/v1/market/snapshot?refresh=true`
2. Verify exchange API status pages
3. Check Redis connectivity
4. Rotate API keys if rate-limited
