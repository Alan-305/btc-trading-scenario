# ローカル開発ガイド

デプロイ前にローカルで試すための手順です。

## 前提

- Python 3.12+
- Node.js 20+
- Redis は **任意**（`CACHE_BACKEND=auto` ならメモリキャッシュで動作）
- Docker または Homebrew（Redis を使う場合のみ）

## 初回セットアップ

```bash
cd /path/to/btc-trading-scenario
chmod +x scripts/setup.sh
./scripts/setup.sh
```

または:

```bash
make setup
```

`.env` が作成されます。必要に応じて API キーを編集してください。

| 変数 | 必須 | 説明 |
|------|------|------|
| `COINGLASS_API_KEY` | 任意 | 有料。未設定時は Binance 無料 API を使用 |
| `DERIVATIVES_PROVIDER` | 任意 | `free`（既定）/ `coinglass` / `auto` |
| `GEMINI_API_KEY` | 任意 | 未設定時はテンプレート文でシナリオ生成 |
| `INTERNAL_COLLECT_TOKEN` | 任意 | ローカルでは空で OK |
| `CACHE_BACKEND` | 任意 | `auto`（既定）= Redis がなければメモリ |

## 起動（Docker なしでも OK）

Redis は **必須ではありません**。`CACHE_BACKEND=auto`（既定）なら Redis がなくても API は動きます。

### ターミナル 1 — API

```bash
make dev
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### ターミナル 2 — Frontend

```bash
make frontend-dev
# → http://localhost:5173
```

### （任意）Redis を使う場合

**Homebrew（Docker なし）:**

```bash
make redis-brew   # 初回: install + start
make redis        # 2回目以降: start
```

**Docker がある場合:**

```bash
make redis
```

Vite のプロキシにより `/api` は自動で `localhost:8000` に転送されます。

## Docker Compose で API + Redis

```bash
make docker-up
```

フロントは別途 `make frontend-dev` で起動してください。

## 動作確認（curl）

```bash
# ヘルスチェック
curl http://localhost:8000/health

# マーケットスナップショット（4取引所・リアル API）
curl "http://localhost:8000/api/v1/market/snapshot?refresh=true" | jq .

# Fear & Greed
curl http://localhost:8000/api/v1/indicators/sentiment | jq .

# トレーディングシナリオ
curl "http://localhost:8000/api/v1/scenario?refresh=true" | jq .

# 定期収集の手動トリガー
curl -X POST http://localhost:8000/api/v1/internal/collect
```

## テスト

```bash
make test
```

## トラブルシューティング

### Redis 接続エラー

Redis は任意です。エラーが出る場合は `.env` で次を確認:

```bash
CACHE_BACKEND=auto   # 既定。Redis なしでメモリキャッシュ
# または
CACHE_BACKEND=memory # 常にメモリのみ
```

Redis を使う場合:

```bash
make redis-brew      # Homebrew でインストール
# または
docker compose ps    # Docker で redis が起動しているか
```

### 取引所 API が一部失敗する

`MarketAggregator` は partial success 設計です。1取引所が落ちても他は返ります。
`?refresh=true` でキャッシュをバイパスして再取得できます。

### フロントが API に繋がらない

- API が `localhost:8000` で起動しているか確認
- `frontend/.env.local` の `VITE_API_BASE_URL` を空にする（プロキシ利用時）

## VS Code / Cursor

`.vscode/` にデバッグ設定があります。

- **Debug API**: F5 で FastAPI をデバッグ起動
- **Run Tests**: テストタスクから pytest 実行
