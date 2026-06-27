# Runbook

## Local development

```bash
docker compose up --build
# API: http://localhost:8000
# Redis: localhost:6379
```

## Cloud Run deployment (nexus-btc-trading)

### 前提

- GCP プロジェクト: **nexus-btc-trading**（番号: 295064774233）
- リージョン: **asia-northeast1**
- **課金（Billing）が有効**であること
- ルートの `.env` に `GEMINI_API_KEY` が設定されていること

### 1. 初回セットアップ（Secret Manager など）

```bash
make gcp-bootstrap
```

以下を自動実行します:

- 必要 API の有効化
- Artifact Registry リポジトリ `btc-trading`
- Secret Manager への登録:
  - `GEMINI_API_KEY`（`.env` から）
  - `COINGLASS_API_KEY`（空でも可）
  - `INTERNAL_COLLECT_TOKEN`（未設定なら自動生成）
- Cloud Build / Cloud Run 用 IAM

### 2. デプロイ

```bash
make gcp-deploy
```

デプロイ後:

```bash
gcloud run services describe btc-trading-frontend --region=asia-northeast1 --format='value(status.url)'
gcloud run services describe btc-trading-api --region=asia-northeast1 --format='value(status.url)'
```

**ユーザー向け URL はフロントエンド**の方です。フロントの nginx が `/api` を API にプロキシするため、同一オリジンで動作します。

### アーキテクチャ

| サービス | 役割 |
|---------|------|
| `btc-trading-frontend` | React 静的配信 + `/api` プロキシ |
| `btc-trading-api` | FastAPI（シークレットは Secret Manager から注入） |

### シークレット

| Secret | 用途 |
|--------|------|
| `GEMINI_API_KEY` | シナリオ文生成 |
| `COINGLASS_API_KEY` | 有料データ（任意） |
| `INTERNAL_COLLECT_TOKEN` | Cloud Scheduler 用 |

### Cloud Scheduler（任意）

```bash
API_URL=$(gcloud run services describe btc-trading-api --region=asia-northeast1 --format='value(status.url)')
TOKEN=$(gcloud secrets versions access latest --secret=INTERNAL_COLLECT_TOKEN)

gcloud scheduler jobs create http btc-collect-job \
  --location=asia-northeast1 \
  --schedule="*/5 * * * *" \
  --uri="${API_URL}/api/v1/internal/collect" \
  --http-method=POST \
  --headers="X-Internal-Token=${TOKEN}"
```

## Monitoring

- Health: `GET /health`
- Logs: Cloud Logging JSON (structlog)
- Alert on: collector failure rate, 5xx rate

## Incident response

1. Check `/api/v1/market/snapshot?refresh=true`
2. Verify exchange API status pages
3. Rotate API keys in Secret Manager if rate-limited
