# BTC Trading Scenario

BTC price prediction and trading scenario web application.

## Stack

- **Frontend**: React (Vite) + Tailwind CSS + Recharts
- **Backend**: Python FastAPI
- **Infra**: GCP Cloud Run, Redis, Cloud Scheduler（デプロイは後回し可）

## ローカル開発（クイックスタート）

```bash
# 初回のみ
make setup

# ターミナル1: API → http://localhost:8000/docs
make dev

# ターミナル2: UI → http://localhost:5173
make frontend-dev
```

Redis は任意です（`CACHE_BACKEND=auto` でメモリキャッシュに自動フォールバック）。

詳細は [docs/local-dev.md](docs/local-dev.md) を参照。

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [ユーザーマニュアル（初心者向け）](docs/user-manual.md) | 特徴・画面の見方・操作手順 |
| [ローカル開発](docs/local-dev.md) | 開発環境のセットアップ |
| [API 仕様](docs/api-contract.md) | JSON API の詳細 |

## API

| エンドポイント | 説明 |
|---|---|
| `GET /health` | ヘルスチェック |
| `GET /api/v1/market/snapshot` | マルチ取引所スナップショット |
| `GET /api/v1/indicators/sentiment` | Fear & Greed + Coinglass |
| `GET /api/v1/scenario` | トレーディングシナリオ |
| `POST /api/v1/internal/collect` | データ収集トリガー |

JSON 仕様: [docs/api-contract.md](docs/api-contract.md)

## テスト・CI

```bash
make test
```

`main` への push/PR で GitHub Actions が pytest + frontend build を実行します（デプロイなし）。

## Disclaimer

本アプリは参考情報であり、投資助言ではありません。
